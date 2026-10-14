import { LinkItem, Category } from '../types';

let idCounter = 0;
const generateId = () => {
  idCounter = (idCounter + 1) % 1000000;
  return `${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
};

export interface ImportResult {
  links: LinkItem[];
  categories: Category[];
}

/**
 * 判断是否为各大浏览器导出的系统根级容器文件夹
 * 这些文件夹是浏览器的系统包装，应自动穿透解构，不作为独立主分类
 */
const isSystemRootFolder = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  const systemNames = [
    'bookmarks bar', 'bookmarks toolbar', 'bookmarks menu', 'other bookmarks', 'mobile bookmarks', 'synced bookmarks',
    'favorites bar', 'favorites', 'other favorites',
    '书签栏', '书签工具栏', '书签菜单', '其他书签', '移动设备书签', '同步的书签', '个人收藏', '收藏夹栏', '其他收藏夹'
  ];
  return systemNames.includes(normalized);
};

/**
 * 依据分类名称智能推测匹配的 Lucide 图标名称
 */
const guessCategoryIcon = (name: string): string => {
  const lower = name.toLowerCase();
  if (/开发|代码|编程|程序|github|前端|后端|dev|code|git|api|技术/i.test(lower)) return 'Code';
  if (/设计|ui|ux|美工|插画|素材|图标|font|icon|design/i.test(lower)) return 'Palette';
  if (/视频|电影|影视|音乐|音频|bilibili|youtube|media|video|music/i.test(lower)) return 'Play';
  if (/文档|学习|教程|知识|书籍|阅读|wiki|doc|book|learn/i.test(lower)) return 'BookOpen';
  if (/工具|转换|效率|在线工具|tool|util/i.test(lower)) return 'Wrench';
  if (/社区|论坛|社交|群|chat|social|community/i.test(lower)) return 'Users';
  if (/购物|商城|电商|买|shop|store/i.test(lower)) return 'ShoppingCart';
  if (/新闻|资讯|博客|news|blog|feed/i.test(lower)) return 'Newspaper';
  if (/游戏|娱乐|game/i.test(lower)) return 'Gamepad2';
  if (/ai|人工智能|gpt|大模型|bot/i.test(lower)) return 'Bot';
  return 'Folder';
};

interface TraversalContext {
  depth: number;
  l1Category: Category | null;
  l2Category: Category | null;
  deepTags: string[];
}

export const parseBookmarks = async (file: File): Promise<ImportResult> => {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');

  const links: LinkItem[] = [];
  const categories: Category[] = [];

  const extractLink = (a: Element, context: TraversalContext) => {
    const url = a.getAttribute('href');
    if (!url || url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('javascript:')) {
      return;
    }

    const title = (a.textContent || a.getAttribute('href') || '未命名书签').trim();
    const icon = a.getAttribute('icon') || undefined;

    let targetCatId = 'common';
    if (context.l2Category) {
      targetCatId = context.l2Category.id;
    } else if (context.l1Category) {
      targetCatId = context.l1Category.id;
    }

    const tags = context.deepTags.length > 0 ? Array.from(new Set(context.deepTags)) : undefined;

    links.push({
      id: generateId(),
      title,
      url,
      categoryId: targetCatId,
      createdAt: Date.now(),
      icon,
      tags
    });
  };

  /**
   * 递归解析 DL 结构
   * 采用方案 A：
   * - 深度 0（系统根容器）：自动穿透
   * - 深度 1：一级主分类 (parentId 为空)
   * - 深度 2：二级子分类 (parentId = 一级主分类.id)
   * - 深度 >= 3：深层目录名称自动转化为书签的 tags，书签归属于直属二级分类
   */
  const traverseDl = (dlElement: Element, context: TraversalContext) => {
    const children = Array.from(dlElement.children);
    const handledNodes = new Set<Element>();

    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (handledNodes.has(node)) continue;

      const tagName = node.tagName.toUpperCase();

      if (tagName === 'DT') {
        const h3 = node.querySelector('h3');
        const a = node.querySelector('a');

        if (h3) {
          const folderName = (h3.textContent || '未命名文件夹').trim();

          // 寻找匹配的 subDl（可能嵌套在 DT 内，亦可能是 DT 的下一个同级元素）
          let subDl: Element | null = node.querySelector('dl');
          if (!subDl) {
            let sibling = node.nextElementSibling;
            while (sibling && sibling.tagName.toUpperCase() !== 'DL' && sibling.tagName.toUpperCase() !== 'DT') {
              sibling = sibling.nextElementSibling;
            }
            if (sibling && sibling.tagName.toUpperCase() === 'DL') {
              subDl = sibling;
              handledNodes.add(subDl);
            }
          }

          if (context.depth === 0 && isSystemRootFolder(folderName)) {
            // 系统外层包装容器（如“书签栏”、“其他书签”），穿透深入，保持在 depth 0
            if (subDl) {
              traverseDl(subDl, { depth: 0, l1Category: null, l2Category: null, deepTags: [] });
            }
          } else if (context.depth === 0) {
            // 第一层：生成 CloudNav 一级主分类
            let l1Cat = categories.find(c => c.name.toLowerCase() === folderName.toLowerCase() && !c.parentId);
            if (!l1Cat) {
              l1Cat = {
                id: generateId(),
                name: folderName,
                icon: guessCategoryIcon(folderName)
              };
              categories.push(l1Cat);
            }

            if (subDl) {
              traverseDl(subDl, { depth: 1, l1Category: l1Cat, l2Category: null, deepTags: [] });
            }
          } else if (context.depth === 1) {
            // 第二层：生成 CloudNav 二级子分类 (绑定 parentId)
            let l2Cat = categories.find(
              c => c.name.toLowerCase() === folderName.toLowerCase() && c.parentId === context.l1Category?.id
            );
            if (!l2Cat) {
              l2Cat = {
                id: generateId(),
                name: folderName,
                icon: guessCategoryIcon(folderName),
                parentId: context.l1Category?.id
              };
              categories.push(l2Cat);
            }

            if (subDl) {
              traverseDl(subDl, { depth: 2, l1Category: context.l1Category, l2Category: l2Cat, deepTags: [] });
            }
          } else {
            // 第三层及更深：方案 A，将文件夹名称作为深层标签深挖
            const nextTags = [...context.deepTags, folderName];
            if (subDl) {
              traverseDl(subDl, {
                depth: context.depth + 1,
                l1Category: context.l1Category,
                l2Category: context.l2Category,
                deepTags: nextTags
              });
            }
          }
        } else if (a) {
          extractLink(a, context);
        }
      } else if (tagName === 'A') {
        extractLink(node, context);
      }
    }
  };

  // 寻找所有顶层 DL 节点
  const allDls = Array.from(doc.querySelectorAll('dl'));
  const rootDls = allDls.filter(dl => !dl.parentElement?.closest('dl'));
  
  if (rootDls.length > 0) {
    rootDls.forEach(dl => {
      traverseDl(dl, { depth: 0, l1Category: null, l2Category: null, deepTags: [] });
    });
  } else {
    const singleDl = doc.querySelector('dl');
    if (singleDl) {
      traverseDl(singleDl, { depth: 0, l1Category: null, l2Category: null, deepTags: [] });
    }
  }

  return { links, categories };
};