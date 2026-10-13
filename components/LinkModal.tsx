import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Pin, Wand2, Trash2, Tag, Plus } from 'lucide-react';
import { LinkItem, Category, AIConfig } from '../types';
import { analyzeLinkWithAI, generateLinkDescription, suggestCategory, WebScrapeMetadata } from '../services/geminiService';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (link: Omit<LinkItem, 'id' | 'createdAt'>) => void;
  onDelete?: (id: string) => void;
  categories: Category[];
  initialData?: LinkItem;
  aiConfig: AIConfig;
  defaultCategoryId?: string;
}

const LinkModal: React.FC<LinkModalProps> = ({ isOpen, onClose, onSave, onDelete, categories, initialData, aiConfig, defaultCategoryId }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'common');
  const [pinned, setPinned] = useState(false);
  const [icon, setIcon] = useState('');
  const [emoji, setEmoji] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingIcon, setIsFetchingIcon] = useState(false);
  const [autoFetchIcon, setAutoFetchIcon] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // 当模态框关闭时，重置批量模式为默认关闭状态
  useEffect(() => {
    if (!isOpen) {
      setBatchMode(false);
      setShowSuccessMessage(false);
    }
  }, [isOpen]);
  
  // 成功提示1秒后自动消失
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setUrl(initialData.url);
        setDescription(initialData.description || '');
        setCategoryId(initialData.categoryId);
        setPinned(initialData.pinned || false);
        setIcon(initialData.icon || '');
        setEmoji(initialData.emoji || '');
        setTags(initialData.tags || []);
        setTagInput('');
        setSuggestedTags([]);
      } else {
        setTitle('');
        setUrl('');
        setDescription('');
        // 如果有默认分类ID且该分类存在，则使用默认分类，否则使用第一个分类
        const defaultCategory = defaultCategoryId && categories.find(cat => cat.id === defaultCategoryId);
        setCategoryId(defaultCategory ? defaultCategoryId : (categories[0]?.id || 'common'));
        setPinned(false);
        setIcon('');
        setEmoji('');
        setTags([]);
        setTagInput('');
        setSuggestedTags([]);
      }
    }
  }, [isOpen, initialData, categories, defaultCategoryId]);

  // 当URL变化且启用自动获取图标时，自动获取图标
  useEffect(() => {
    if (url && autoFetchIcon && !initialData) {
      const timer = setTimeout(() => {
        handleFetchIcon();
      }, 500); // 延迟500ms执行，避免频繁请求
      
      return () => clearTimeout(timer);
    }
  }, [url, autoFetchIcon, initialData]);

  const handleDelete = () => {
    if (!initialData) return;
    onDelete && onDelete(initialData.id);
    onClose();
  };

  // 缓存自定义图标到KV空间
  const cacheCustomIcon = async (url: string, iconUrl: string) => {
    try {
      // 提取域名
      let domain = url;
      if (domain.startsWith('http://') || domain.startsWith('https://')) {
        const urlObj = new URL(domain);
        domain = urlObj.hostname;
      }
      
      // 将自定义图标保存到KV缓存
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        await fetch('/api/storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': authToken
          },
          body: JSON.stringify({
            saveConfig: 'favicon',
            domain: domain,
            icon: iconUrl
          })
        });
        console.log(`Custom icon cached for domain: ${domain}`);
      }
    } catch (error) {
      console.log("Failed to cache custom icon", error);
    }
  };

  const handleAddTag = (newTag?: string) => {
    const t = (newTag !== undefined ? newTag : tagInput).trim();
    if (!t) return;
    if (!tags.includes(t)) {
      setTags(prev => [...prev, t]);
    }
    setSuggestedTags(prev => prev.filter(st => st !== t));
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !url) return;
    
    // 确保URL有协议前缀
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    
    // 保存链接数据
    onSave({
      id: initialData?.id || '',
      title,
      url: finalUrl,
      icon,
      description,
      categoryId,
      pinned,
      emoji: emoji.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined
    });
    
    // 如果有自定义图标URL，缓存到KV空间
    if (icon && !icon.includes('gstatic.cn')) {
      cacheCustomIcon(finalUrl, icon);
    }
    
    // 批量模式下不关闭窗口，只显示成功提示
    if (batchMode) {
      setShowSuccessMessage(true);
      // 重置表单，但保留分类和批量模式设置
      setTitle('');
      setUrl('');
      setIcon('');
      setDescription('');
      setPinned(false);
      setEmoji('');
      setTags([]);
      setTagInput('');
      setSuggestedTags([]);
      // 如果开启自动获取图标，尝试获取新图标
      if (autoFetchIcon && finalUrl) {
        handleFetchIcon();
      }
    } else {
      onClose();
    }
  };

  const handleAIAssist = async () => {
    if (!url) {
      alert("请先输入 URL 链接");
      return;
    }

    setIsGenerating(true);
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
      setUrl(targetUrl);
    }

    try {
      // 1. 服务端无 CORS 边缘网页抓取
      const authToken = localStorage.getItem('authToken');
      let scrapeData: WebScrapeMetadata | null = null;
      try {
        const res = await fetch(`/api/scrape?url=${encodeURIComponent(targetUrl)}`, {
          headers: authToken ? { 'x-auth-password': authToken } : {}
        });
        if (res.ok) {
          scrapeData = await res.json();
        }
      } catch (err) {
        console.warn("Scrape endpoint call failed", err);
      }

      // 如果抓取到了网页图标，且当前没有图标或为默认图标，自动填入并缓存
      if (scrapeData?.icon && (!icon || icon.includes('gstatic.cn'))) {
        setIcon(scrapeData.icon);
        cacheCustomIcon(targetUrl, scrapeData.icon);
      } else if (!icon) {
        handleFetchIcon();
      }

      // 如果当前没有标题，填入抓取到的网页原始标题
      if (!title && scrapeData?.title) {
        setTitle(scrapeData.title);
      }

      // 2. 如果配置了 AI Key，则执行 AI 深度分析（精炼标题、精简描述、推荐分类、提取标签）
      if (aiConfig.apiKey) {
        let domain = '';
        try {
          domain = new URL(targetUrl).hostname;
        } catch (e) {
          domain = targetUrl;
        }

        const metadataToAnalyze: WebScrapeMetadata = scrapeData || {
          url: targetUrl,
          domain,
          title: title || targetUrl,
          description: description || '',
          icon: icon || '',
        };

        const aiResult = await analyzeLinkWithAI(metadataToAnalyze, categories, aiConfig);

        if (aiResult.title && (!title || title === scrapeData?.title)) {
          setTitle(aiResult.title);
        }
        if (aiResult.description) {
          setDescription(aiResult.description);
        }
        if (aiResult.suggestedCategoryId && categories.some(c => c.id === aiResult.suggestedCategoryId)) {
          setCategoryId(aiResult.suggestedCategoryId);
        }
        if (aiResult.tags && aiResult.tags.length > 0) {
          const newSuggestions = aiResult.tags.filter(t => !tags.includes(t));
          setSuggestedTags(newSuggestions);
        }
      } else {
        // 未配置 AI Key 时，降级填入抓取到的描述与关键词
        if (scrapeData?.description && !description) {
          setDescription(scrapeData.description);
        }
        if (scrapeData?.keywords && scrapeData.keywords.length > 0) {
          const newSuggestions = scrapeData.keywords.filter(t => !tags.includes(t)).slice(0, 5);
          setSuggestedTags(newSuggestions);
        }
      }
    } catch (e) {
      console.error("AI Assist failed", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFetchIcon = async () => {
    if (!url) return;
    
    setIsFetchingIcon(true);
    try {
      // 提取域名
      let domain = url;
      // 如果URL没有协议前缀，添加https://作为默认协议
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        domain = 'https://' + url;
      }
      
      if (domain.startsWith('http://') || domain.startsWith('https://')) {
        const urlObj = new URL(domain);
        domain = urlObj.hostname;
      }
      
      // 先尝试从KV缓存获取图标
      try {
        const response = await fetch(`/api/storage?getConfig=favicon&domain=${encodeURIComponent(domain)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.cached && data.icon) {
            setIcon(data.icon);
            setIsFetchingIcon(false);
            return;
          }
        }
      } catch (error) {
        console.log("Failed to fetch cached icon, will generate new one", error);
      }
      
      // 如果缓存中没有，则生成新图标
      const iconUrl = `https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=https://${domain}`;
      setIcon(iconUrl);
      
      // 将图标保存到KV缓存
      try {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          await fetch('/api/storage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-password': authToken
            },
            body: JSON.stringify({
              saveConfig: 'favicon',
              domain: domain,
              icon: iconUrl
            })
          });
        }
      } catch (error) {
        console.log("Failed to cache icon", error);
      }
    } catch (e) {
      console.error("Failed to fetch icon", e);
      alert("无法获取图标，请检查URL是否正确");
    } finally {
      setIsFetchingIcon(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold dark:text-white">
              {initialData ? '编辑链接' : '添加新链接'}
            </h3>
            <button
              type="button"
              onClick={() => setPinned(!pinned)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all ${
                pinned 
                ? 'bg-blue-100 border-blue-200 text-blue-600 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300' 
                : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400'
              }`}
              title={pinned ? "取消置顶" : "置顶"}
            >
              <Pin size={14} className={pinned ? "fill-current" : ""} />
              <span className="text-xs font-medium">置顶</span>
            </button>
            {!initialData && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md border bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                <input
                  type="checkbox"
                  id="batchMode"
                  checked={batchMode}
                  onChange={(e) => setBatchMode(e.target.checked)}
                  className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-slate-300 rounded dark:border-slate-600 dark:bg-slate-700"
                />
                <label htmlFor="batchMode" className="text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer">
                  批量添加不关窗口
                </label>
              </div>
            )}
            {initialData && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all ${
                  'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400 dark:hover:bg-red-900/30'
                }`}
                title="删除链接"
              >
                <Trash2 size={14} />
                <span className="text-xs font-medium">删除</span>
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">标题</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="网站名称"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium dark:text-slate-300">表情符号 / 标记 (选填)</label>
              {emoji && (
                <button
                  type="button"
                  onClick={() => setEmoji('')}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  清除标记
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-lg shrink-0">
                {[
                  { label: '无', val: '' },
                  { label: '⭐', val: '⭐' },
                  { label: '🔥', val: '🔥' },
                  { label: '❤️', val: '❤️' }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setEmoji(item.val)}
                    className={`px-2.5 py-1 text-sm rounded-md transition-all ${
                      emoji === item.val
                        ? 'bg-white dark:bg-slate-600 shadow-sm font-bold text-blue-600 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-600/50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                maxLength={6}
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="flex-1 p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center placeholder:text-xs"
                placeholder="或自定义输入 (如 🚀 / 💡)"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">URL 链接</label>
            <div className="flex gap-2">
                <input
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="example.com 或 https://..."
                />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">图标 URL</label>
            <div className="flex gap-2">
              {icon && (
                <div className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden flex-shrink-0 bg-white dark:bg-slate-700">
                  <img
                    src={icon}
                    alt="图标预览"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <input
                type="url"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="https://example.com/icon.png"
              />
              <button
                type="button"
                onClick={handleFetchIcon}
                disabled={!url || isFetchingIcon}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-1 transition-colors"
              >
                {isFetchingIcon ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                获取图标
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="autoFetchIcon"
                checked={autoFetchIcon}
                onChange={(e) => setAutoFetchIcon(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded dark:border-slate-600 dark:bg-slate-700"
              />
              <label htmlFor="autoFetchIcon" className="text-sm text-slate-700 dark:text-slate-300">
                自动获取URL链接的图标
              </label>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium dark:text-slate-300">描述 (选填)</label>
                {url && (
                    <button
                        type="button"
                        onClick={handleAIAssist}
                        disabled={isGenerating}
                        className="text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors font-medium cursor-pointer"
                        title="边缘抓取真实网页元数据，调用 AI 自动总结、推荐分类并提取标签"
                    >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {isGenerating ? 'AI 抓取解析中...' : 'AI 深度解析'}
                    </button>
                )}
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all h-20 resize-none"
              placeholder="简短描述..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium dark:text-slate-300">标签 (选填)</label>
              <span className="text-xs text-slate-400">回车或逗号添加</span>
            </div>

            {/* 已添加的标签 */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-500 rounded-full"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* 标签输入框 */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="添加标签 (如 前端、效率、开源)..."
                  className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddTag()}
                disabled={!tagInput.trim()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Plus size={14} />
                添加
              </button>
            </div>

            {/* 建议标签 (AI推荐或网页提取) */}
            {suggestedTags.length > 0 && (
              <div className="mt-2 flex items-center flex-wrap gap-1.5 text-xs">
                <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                  <Sparkles size={12} />
                  建议标签:
                </span>
                {suggestedTags.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleAddTag(st)}
                    className="inline-flex items-center px-2 py-0.5 rounded-full border border-dashed border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/30 transition-all cursor-pointer"
                    title="点击加入标签"
                  >
                    + {st}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">分类</label>
            <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
            {categories.filter(c => !c.parentId).map(parent => (
              <optgroup key={parent.id} label={parent.name}>
                <option value={parent.id}>{parent.name}</option>
                {categories.filter(c => c.parentId === parent.id).map(sub => (
                  <option key={sub.id} value={sub.id}>{parent.name} / {sub.name}</option>
                ))}
              </optgroup>
            ))}
            </select>
          </div>

          <div className="pt-2 relative">
            {/* 成功提示 */}
            {showSuccessMessage && (
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg transition-opacity duration-300">
                添加成功
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/30"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LinkModal;
