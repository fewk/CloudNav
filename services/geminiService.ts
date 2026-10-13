import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AIConfig } from "../types";

/**
 * Helper to call OpenAI Compatible API
 */
const callOpenAICompatible = async (config: AIConfig, systemPrompt: string, userPrompt: string): Promise<string> => {
    try {
        let baseUrl = config.baseUrl.replace(/\/$/, '');
        // If user didn't provide full path, assume /v1/chat/completions logic or just trust them
        // Common convention: if URL ends with /v1, append /chat/completions
        if (!baseUrl.includes('/chat/completions')) {
            if (baseUrl.endsWith('/v1')) {
                baseUrl += '/chat/completions';
            } else {
                // If it's just a domain like api.openai.com, usually implies /v1/chat/completions
                // But let's assume user might input full path or standard base. 
                // To be safe, let's append /chat/completions if not present
                baseUrl += '/chat/completions';
            }
        }

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("OpenAI API Error:", err);
            return "";
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "";
    } catch (e) {
        console.error("OpenAI Call Failed", e);
        return "";
    }
};

export interface WebScrapeMetadata {
  url: string;
  domain: string;
  title: string;
  description: string;
  icon: string;
  keywords?: string[];
  bodyPreview?: string;
}

export interface AIAnalysisResult {
  title?: string;
  description: string;
  suggestedCategoryId?: string;
  tags: string[];
}

/**
 * 基于真实抓取的网页元数据，调用 AI 综合生成标题、精准简介、推荐分类与智能标签
 */
export const analyzeLinkWithAI = async (
  metadata: WebScrapeMetadata,
  categories: { id: string; name: string }[],
  config: AIConfig
): Promise<AIAnalysisResult> => {
  if (!config.apiKey) {
    return {
      title: metadata.title,
      description: metadata.description || '无描述',
      tags: metadata.keywords?.slice(0, 3) || [],
    };
  }

  const catList = categories.map(c => `- ID: "${c.id}", 名称: "${c.name}"`).join('\n');
  const prompt = `
你是一个专业的网页分析和书签整理专家。请根据以下真实抓取的网页信息进行分析：

网址: ${metadata.url}
网页标题: ${metadata.title}
网页官方描述: ${metadata.description || '无'}
关键词: ${metadata.keywords?.join(', ') || '无'}
网页正文预览: ${metadata.bodyPreview ? metadata.bodyPreview.slice(0, 800) : '无'}

现有分类列表:
${catList}

请输出严格的 JSON 格式数据，字段如下：
1. "title": 精简优雅的网站中文名称（去除多余后缀如"-官网"、"|最专业的..."等），如 "GitHub"、"Vite 文档"。
2. "description": 精准的中文简介（不超过30字），说明该网站的核心功能或特色。
3. "suggestedCategoryId": 从现有分类列表中选出最匹配的 ID。若都不适合则填 "common"。
4. "tags": 提取 2 到 4 个最相关的标签数组（如 ["前端开发", "开源", "工具"]）。

仅返回标准 JSON 对象，不要使用 markdown 标记或额外解释：
{"title": "...", "description": "...", "suggestedCategoryId": "...", "tags": ["..."]}
`;

  try {
    let rawText = '';
    if (config.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const modelName = config.model || 'gemini-2.5-flash';
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });
      rawText = response.text ? response.text.trim() : '';
    } else {
      rawText = await callOpenAICompatible(
        config,
        "You are an expert at bookmark tagging and website summarization. Output valid JSON only.",
        prompt
      );
    }

    // 清理 markdown 包裹 (例如 ```json ... ```)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || metadata.title,
        description: parsed.description || metadata.description || '无描述',
        suggestedCategoryId: parsed.suggestedCategoryId || 'common',
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(t => String(t).trim()).filter(Boolean) : (metadata.keywords?.slice(0, 3) || []),
      };
    }
  } catch (err) {
    console.warn("AI analysis failed, falling back to scraped metadata.", err);
  }

  // 兜底降级处理
  return {
    title: metadata.title,
    description: metadata.description || '',
    suggestedCategoryId: 'common',
    tags: metadata.keywords?.slice(0, 3) || [],
  };
};

/**
 * Uses configured AI to generate a description (保持兼容)
 */
export const generateLinkDescription = async (title: string, url: string, config: AIConfig): Promise<string> => {
  if (!config.apiKey) {
    return "请在设置中配置 API Key";
  }

  const prompt = `
      Title: ${title}
      URL: ${url}
      Please write a very short description (max 20 words) in Chinese (Simplified) that explains what this website is for. Return ONLY the description text. No quotes.
  `;

  try {
    if (config.provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const modelName = config.model || 'gemini-2.5-flash';
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: `I have a website bookmark. ${prompt}`,
        });
        return response.text ? response.text.trim() : "无法生成描述";
    } else {
        const result = await callOpenAICompatible(
            config, 
            "You are a helpful assistant that summarizes website bookmarks.", 
            prompt
        );
        return result || "生成描述失败";
    }
  } catch (error) {
    console.error("AI generation error:", error);
    return "生成描述失败";
  }
};

/**
 * Suggests a category (保持兼容)
 */
export const suggestCategory = async (title: string, url: string, categories: {id: string, name: string}[], config: AIConfig): Promise<string | null> => {
    if (!config.apiKey) return null;

    const catList = categories.map(c => `${c.id}: ${c.name}`).join('\n');
    const prompt = `
        Website: "${title}" (${url})

        Available Categories:
        ${catList}

        Return ONLY the 'id' of the best matching category. If unsure, return 'common'.
    `;

    try {
        if (config.provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey: config.apiKey });
            const modelName = config.model || 'gemini-2.5-flash';
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: modelName,
                contents: `Task: Categorize this website.\n${prompt}`,
            });
            return response.text ? response.text.trim() : null;
        } else {
            const result = await callOpenAICompatible(
                config,
                "You are an intelligent classification assistant. You only output the category ID.",
                prompt
            );
            return result || null;
        }
    } catch (e) {
        console.error(e);
        return null;
    }
};
