
import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { 
  Search, Plus, Upload, Moon, Sun, Menu, 
  Trash2, Edit2, Loader2, Cloud, CheckCircle2, AlertCircle,
  Pin, Settings, Lock, CloudCog, Github, GitFork, GripVertical, Save, CheckSquare, LogOut, ExternalLink, X, Flame,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS, WebDavConfig, AIConfig, SearchMode, ExternalSearchSource, SearchConfig, SiteSettings } from './types';
import Icon from './components/Icon';
import ContextMenu from './components/ContextMenu';
import LinkCard from './components/LinkCard';

// 懒加载所有模态框组件与重量级依赖（@google/genai, jszip等），极大压缩首屏与新标签页 JS 体积
const LinkModal = React.lazy(() => import('./components/LinkModal'));
const AuthModal = React.lazy(() => import('./components/AuthModal'));
const CategoryManagerModal = React.lazy(() => import('./components/CategoryManagerModal'));
const BackupModal = React.lazy(() => import('./components/BackupModal'));
const CategoryAuthModal = React.lazy(() => import('./components/CategoryAuthModal'));
const ImportModal = React.lazy(() => import('./components/ImportModal'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const SearchConfigModal = React.lazy(() => import('./components/SearchConfigModal'));
const QRCodeModal = React.lazy(() => import('./components/QRCodeModal'));
import { APP_VERSION, BUILD_TIME } from './version';

// --- 配置项 ---
// 项目核心仓库地址
const GITHUB_REPO_URL = 'https://github.com/fewk/CloudNav';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';
const FAVICON_CACHE_KEY = 'cloudnav_favicon_cache';
const DEFAULT_SEARCH_SOURCES: ExternalSearchSource[] = [
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={query}', icon: 'Globe', enabled: true, createdAt: 1 },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={query}', icon: 'Search', enabled: true, createdAt: 2 },
  { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q={query}', icon: 'Search', enabled: true, createdAt: 3 },
  { id: 'github', name: 'GitHub', url: 'https://github.com/search?q={query}', icon: 'Github', enabled: true, createdAt: 4 },
  { id: 'bilibili', name: 'B站', url: 'https://search.bilibili.com/all?keyword={query}', icon: 'Play', enabled: true, createdAt: 5 },
];

const AUTH_KEY = 'cloudnav_auth_token';
const WEBDAV_CONFIG_KEY = 'cloudnav_webdav_config';
const AI_CONFIG_KEY = 'cloudnav_ai_config';
const SEARCH_CONFIG_KEY = 'cloudnav_search_config';

// 预加载本地缓存数据（实现 Chrome 新标签页 0 延迟秒开）
function getInitialNavData(): { links: LinkItem[]; categories: Category[] } {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      let loadedCategories = parsed.categories || DEFAULT_CATEGORIES;
      if (!loadedCategories.some((c: Category) => c.id === 'common')) {
        loadedCategories = [{ id: 'common', name: '常用推荐', icon: 'Star' }, ...loadedCategories];
      }
      const validCategoryIds = new Set(loadedCategories.map((c: Category) => c.id));
      let loadedLinks = (parsed.links || INITIAL_LINKS).map((link: LinkItem) => {
        if (!validCategoryIds.has(link.categoryId)) {
          return { ...link, categoryId: 'common' };
        }
        return link;
      });
      return { links: loadedLinks, categories: loadedCategories };
    }
  } catch (e) {}
  return { links: INITIAL_LINKS, categories: DEFAULT_CATEGORIES };
}

function getInitialSearchConfig(): { mode: SearchMode; sources: ExternalSearchSource[]; selected: ExternalSearchSource | null } {
  try {
    const saved = localStorage.getItem(SEARCH_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        mode: parsed.mode || 'external',
        sources: (parsed.externalSources && parsed.externalSources.length > 0) ? parsed.externalSources : DEFAULT_SEARCH_SOURCES,
        selected: parsed.selectedSource || null
      };
    }
  } catch (e) {}
  return {
    mode: 'external',
    sources: DEFAULT_SEARCH_SOURCES,
    selected: null
  };
}

function App() {
  const initialNavData = useMemo(() => getInitialNavData(), []);
  const initialSearch = useMemo(() => getInitialSearchConfig(), []);

  // --- State ---
  const [links, setLinks] = useState<LinkItem[]>(initialNavData.links);
  const [categories, setCategories] = useState<Category[]>(initialNavData.categories);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cloudnav_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(prev => !prev);
    } else {
      setIsSidebarCollapsed(prev => {
        const next = !prev;
        try {
          localStorage.setItem('cloudnav_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  const handleCloseSidebar = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    } else {
      setIsSidebarCollapsed(true);
      try {
        localStorage.setItem('cloudnav_sidebar_collapsed', 'true');
      } catch {}
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Search Mode State
  const [searchMode, setSearchMode] = useState<SearchMode>(initialSearch.mode);
  const [externalSearchSources, setExternalSearchSources] = useState<ExternalSearchSource[]>(initialSearch.sources);
  const [selectedSearchSource, setSelectedSearchSource] = useState<ExternalSearchSource | null>(initialSearch.selected || DEFAULT_SEARCH_SOURCES[0]);
  const [isLoadingSearchConfig, setIsLoadingSearchConfig] = useState(false);
  
  // Category Security State
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());

  // WebDAV Config State
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
      url: 'https://webdav.opendrive.com/',
      username: '',
      password: '',
      enabled: false
  });

  // AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
      const saved = localStorage.getItem(AI_CONFIG_KEY);
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) {}
      }
      return {
          provider: 'gemini',
          apiKey: process.env.API_KEY || '', 
          baseUrl: '',
          model: 'gemini-2.5-flash'
      };
  });

  // Site Settings State
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
      const saved = localStorage.getItem('cloudnav_site_settings');
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              return {
                  openTarget: '_blank' as const,
                  showDescription: true,
                  showTags: false,
                  ...parsed
              };
          } catch (e) {}
      }
      return {
          title: 'CloudNav - 我的导航',
          navTitle: 'CloudNav',
          favicon: '',
          cardStyle: 'detailed' as const,
          passwordExpiryDays: 7,
          openTarget: '_blank' as const,
          showDescription: true,
          showTags: false
      };
  });
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSearchConfigModalOpen, setIsSearchConfigModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);
  
  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  // State for data pre-filled from Bookmarklet
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);
  
  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string>('');
  const [requiresAuth, setRequiresAuth] = useState<boolean | null>(null); // null表示未检查，true表示需要认证，false表示不需要
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Sort State
  const [isSortingMode, setIsSortingMode] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('pinned');
  const contentScrollRef = useRef<HTMLDivElement>(null); // 存储正在排序的分类ID，null表示不在排序模式
  const [isSortingPinned, setIsSortingPinned] = useState(false); // 是否正在排序置顶链接
  
  // Batch Edit State
  const [isBatchEditMode, setIsBatchEditMode] = useState(false); // 是否处于批量编辑模式
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set()); // 选中的链接ID集合
  
  // Sub-category State
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null); // 当前悬浮的一级分类ID
  const [hoveredCategoryTop, setHoveredCategoryTop] = useState<number>(0); // 当前悬浮的一级分类的垂直位置
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    link: LinkItem | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    link: null
  });
  
  // QR Code Modal State
  const [qrCodeModal, setQrCodeModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
  }>({
    isOpen: false,
    url: '',
    title: ''
  });

  // Mobile Search State
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  
  // Category Action Auth State
  const [categoryActionAuth, setCategoryActionAuth] = useState<{
    isOpen: boolean;
    action: 'edit' | 'delete';
    categoryId: string;
    categoryName: string;
  }>({
    isOpen: false,
    action: 'edit',
    categoryId: '',
    categoryName: ''
  });
  
  // --- Helpers & Sync Logic ---

  const loadFromLocal = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        let loadedCategories = parsed.categories || DEFAULT_CATEGORIES;
        
        // 确保"常用推荐"分类始终存在，并确保它是第一个分类
        if (!loadedCategories.some(c => c.id === 'common')) {
          loadedCategories = [
            { id: 'common', name: '常用推荐', icon: 'Star' },
            ...loadedCategories
          ];
        } else {
          // 如果"常用推荐"分类已存在，确保它是第一个分类
          const commonIndex = loadedCategories.findIndex(c => c.id === 'common');
          if (commonIndex > 0) {
            const commonCategory = loadedCategories[commonIndex];
            loadedCategories = [
              commonCategory,
              ...loadedCategories.slice(0, commonIndex),
              ...loadedCategories.slice(commonIndex + 1)
            ];
          }
        }
        
        // 检查是否有链接的categoryId不存在于当前分类中，将这些链接移动到"常用推荐"
        const validCategoryIds = new Set(loadedCategories.map(c => c.id));
        let loadedLinks = parsed.links || INITIAL_LINKS;
        loadedLinks = loadedLinks.map(link => {
          if (!validCategoryIds.has(link.categoryId)) {
            return { ...link, categoryId: 'common' };
          }
          return link;
        });
        
        setLinks(loadedLinks);
        setCategories(loadedCategories);
      } catch (e) {
        setLinks(INITIAL_LINKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setLinks(INITIAL_LINKS);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const syncToCloud = async (newLinks: LinkItem[], newCategories: Category[], token: string) => {
    setSyncStatus('saving');
    try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': token
            },
            body: JSON.stringify({ links: newLinks, categories: newCategories })
        });

        if (response.status === 401) {
            // 检查是否是密码过期
            try {
                const errorData = await response.json();
                if (errorData.error && errorData.error.includes('过期')) {
                    alert('您的密码已过期，请重新登录');
                }
            } catch (e) {
                // 如果无法解析错误信息，使用默认提示
                console.error('Failed to parse error response', e);
            }
            
            setAuthToken('');
            localStorage.removeItem(AUTH_KEY);
            setIsAuthOpen(true);
            setSyncStatus('error');
            return false;
        }

        if (!response.ok) throw new Error('Network response was not ok');
        
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return true;
    } catch (error) {
        console.error("Sync failed", error);
        setSyncStatus('error');
        return false;
    }
  };

  const updateData = (newLinks: LinkItem[], newCategories: Category[]) => {
      // 1. Optimistic UI Update
      setLinks(newLinks);
      setCategories(newCategories);
      
      // 2. Save to Local Cache
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories }));

      // 3. Sync to Cloud (if authenticated)
      if (authToken) {
          syncToCloud(newLinks, newCategories, authToken);
      }
  };

  // --- Context Menu Functions ---
  const handleContextMenu = useCallback((event: React.MouseEvent, link: LinkItem) => {
    event.preventDefault();
    event.stopPropagation();
    
    // 在批量编辑模式下禁用右键菜单
    if (isBatchEditMode) return;
    
    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      link: link
    });
  }, [isBatchEditMode]);

  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      link: null
    });
  };

  const copyLinkToClipboard = () => {
    if (!contextMenu.link) return;
    
    navigator.clipboard.writeText(contextMenu.link.url)
      .then(() => {
        // 可以添加一个短暂的提示
        console.log('链接已复制到剪贴板');
      })
      .catch(err => {
        console.error('复制链接失败:', err);
      });
    
    closeContextMenu();
  };

  const showQRCode = () => {
    if (!contextMenu.link) return;
    
    setQrCodeModal({
      isOpen: true,
      url: contextMenu.link.url,
      title: contextMenu.link.title
    });
    
    closeContextMenu();
  };

  const editLinkFromContextMenu = () => {
    if (!contextMenu.link) return;
    
    setEditingLink(contextMenu.link);
    setIsModalOpen(true);
    closeContextMenu();
  };

  const deleteLinkFromContextMenu = () => {
    if (!contextMenu.link) return;
    
    if (window.confirm(`确定要删除"${contextMenu.link.title}"吗？`)) {
      const newLinks = links.filter(link => link.id !== contextMenu.link!.id);
      updateData(newLinks, categories);
    }
    
    closeContextMenu();
  };

  const togglePinFromContextMenu = () => {
    if (!contextMenu.link) return;
    
    const linkToToggle = links.find(l => l.id === contextMenu.link!.id);
    if (!linkToToggle) return;
    
    // 如果是设置为置顶，则设置pinnedOrder为当前置顶链接数量
    // 如果是取消置顶，则清除pinnedOrder
    const updated = links.map(l => {
      if (l.id === contextMenu.link!.id) {
        const isPinned = !l.pinned;
        return { 
          ...l, 
          pinned: isPinned,
          pinnedOrder: isPinned ? links.filter(link => link.pinned).length : undefined
        };
      }
      return l;
    });
    
    updateData(updated, categories);
    closeContextMenu();
  };

  const setEmojiFromContextMenu = (emoji: string) => {
    if (!contextMenu.link) return;
    if (!authToken) { setIsAuthOpen(true); return; }
    
    const targetId = contextMenu.link.id;
    const updated = links.map(l => {
      if (l.id === targetId) {
        return {
          ...l,
          emoji: emoji || undefined
        };
      }
      return l;
    });
    
    updateData(updated, categories);
    closeContextMenu();
  };

  // 加载链接图标缓存（极速轻量化，读取本地缓存优先，避免新标签页高频并发请求）
  const loadLinkIcons = async (linksToLoad: LinkItem[]) => {
    if (!authToken) return;
    
    let localFavicons: Record<string, string> = {};
    try {
      const cached = localStorage.getItem(FAVICON_CACHE_KEY);
      if (cached) localFavicons = JSON.parse(cached);
    } catch (e) {}

    const domainsToFetch: string[] = [];
    for (const link of linksToLoad) {
      if (!link.url) continue;
      try {
        let domain = link.url;
        if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
          domain = 'https://' + link.url;
        }
        const hostname = new URL(domain).hostname;
        if (localFavicons[hostname] || (link.icon && !link.icon.includes('gstatic.cn'))) {
          continue;
        }
        if (!domainsToFetch.includes(hostname)) {
          domainsToFetch.push(hostname);
        }
      } catch (e) {}
    }

    if (domainsToFetch.length === 0) return;

    // 限制单次最多异步查询 8 个域名，不阻塞关键网络
    const toQuery = domainsToFetch.slice(0, 8);
    const results = await Promise.allSettled(
      toQuery.map(async (domain) => {
        try {
          const response = await fetch(`/api/storage?getConfig=favicon&domain=${encodeURIComponent(domain)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.cached && data.icon) {
              return { domain, icon: data.icon };
            }
          }
        } catch (e) {}
        return null;
      })
    );

    let updated = false;
    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value) {
        localFavicons[res.value.domain] = res.value.icon;
        updated = true;
      }
    });

    if (updated) {
      try {
        localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(localFavicons));
      } catch (e) {}
    }
  };

  // --- Effects ---

  useEffect(() => {
    // Theme init
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Load Token and check expiry
    const savedToken = localStorage.getItem(AUTH_KEY);
    const lastLoginTime = localStorage.getItem('lastLoginTime');
    
    if (savedToken) {
      const currentTime = Date.now();
      
      if (lastLoginTime) {
        const lastLogin = parseInt(lastLoginTime);
        const timeDiff = currentTime - lastLogin;
        
        const expiryDays = siteSettings.passwordExpiryDays !== undefined ? siteSettings.passwordExpiryDays : 7;
        const expiryTimeMs = expiryDays > 0 ? expiryDays * 24 * 60 * 60 * 1000 : 0;
        
        if (expiryTimeMs > 0 && timeDiff > expiryTimeMs) {
          localStorage.removeItem(AUTH_KEY);
          localStorage.removeItem('lastLoginTime');
          setAuthToken('');
        } else {
          setAuthToken(savedToken);
        }
      } else {
        setAuthToken(savedToken);
      }
    }

    // Load WebDAV Config
    const savedWebDav = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (savedWebDav) {
        try {
            setWebDavConfig(JSON.parse(savedWebDav));
        } catch (e) {}
    }

    // Handle URL Params for Bookmarklet (Add Link)
    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
        const addTitle = urlParams.get('add_title') || '';
        window.history.replaceState({}, '', window.location.pathname);
        
        setPrefillLink({
            title: addTitle,
            url: addUrl,
            categoryId: 'common'
        });
        setEditingLink(undefined);
        setIsModalOpen(true);
    }

    // Initial Data Fetch (采用单次聚合请求优化，快速后台同步，不阻塞首屏渲染)
    const initData = async () => {
      const tokenToUse = authToken || localStorage.getItem(AUTH_KEY) || savedToken;

      try {
        // 1. 尝试使用聚合端点 /api/storage?all=true 一次性获取认证状态、数据与所有配置
        const res = await fetch('/api/storage?all=true', {
          headers: tokenToUse ? { 'x-auth-password': tokenToUse } : {}
        });

        if (res.ok) {
          const payload = await res.json();
          setRequiresAuth(payload.requiresAuth);

          if (payload.requiresAuth && !payload.authenticated && !tokenToUse) {
            setIsCheckingAuth(false);
            setIsAuthOpen(true);
            return;
          }

          if (payload.data && payload.data.links && payload.data.links.length > 0) {
            setLinks(payload.data.links);
            setCategories(payload.data.categories || DEFAULT_CATEGORIES);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload.data));
            loadLinkIcons(payload.data.links);
          }

          if (payload.searchConfig) {
            const sc = payload.searchConfig;
            if (sc.mode || sc.externalSources || sc.selectedSource) {
              if (sc.mode) setSearchMode(sc.mode);
              if (sc.externalSources) setExternalSearchSources(sc.externalSources);
              if (sc.selectedSource) setSelectedSearchSource(sc.selectedSource);
              localStorage.setItem(SEARCH_CONFIG_KEY, JSON.stringify(sc));
            }
          }

          if (payload.websiteConfig) {
            const wc = payload.websiteConfig;
            setSiteSettings(prev => {
              const updated = {
                ...prev,
                title: wc.title || prev.title,
                navTitle: wc.navTitle || prev.navTitle,
                favicon: wc.favicon || prev.favicon,
                cardStyle: wc.cardStyle || prev.cardStyle,
                passwordExpiryDays: wc.passwordExpiryDays !== undefined ? wc.passwordExpiryDays : prev.passwordExpiryDays,
                openTarget: wc.openTarget || prev.openTarget || '_blank',
                showDescription: wc.showDescription !== undefined ? wc.showDescription : (prev.showDescription !== undefined ? prev.showDescription : true),
                showTags: wc.showTags !== undefined ? wc.showTags : (prev.showTags !== undefined ? prev.showTags : false)
              };
              localStorage.setItem('cloudnav_site_settings', JSON.stringify(updated));
              return updated;
            });
          }

          setIsCheckingAuth(false);
          setIsLoadingSearchConfig(false);
          return;
        } else if (res.status === 401) {
          setAuthToken('');
          localStorage.removeItem(AUTH_KEY);
          localStorage.removeItem('lastLoginTime');
          setIsAuthOpen(true);
          setIsCheckingAuth(false);
          return;
        }
      } catch (e) {
        console.warn("Unified initData failed, using local cache.", e);
      }

      // 如果聚合请求不可用，从本地缓存加载并解除 loading 状态
      loadFromLocal();
      setIsCheckingAuth(false);
      setIsLoadingSearchConfig(false);
    };

    initData();
  }, []);

  // Update page title and favicon when site settings change
  useEffect(() => {
    if (siteSettings.title) {
      document.title = siteSettings.title;
    }
    
    if (siteSettings.favicon) {
      // Remove existing favicon links
      const existingFavicons = document.querySelectorAll('link[rel="icon"]');
      existingFavicons.forEach(favicon => favicon.remove());
      
      // Add new favicon
      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.href = siteSettings.favicon;
      document.head.appendChild(favicon);
    }
  }, [siteSettings.title, siteSettings.favicon]);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // 视图模式切换处理函数
  const handleViewModeChange = (cardStyle: 'detailed' | 'simple') => {
    const newSiteSettings = { ...siteSettings, cardStyle };
    setSiteSettings(newSiteSettings);
    localStorage.setItem('cloudnav_site_settings', JSON.stringify(newSiteSettings));
  };

  // --- Batch Edit Functions ---
  const toggleBatchEditMode = () => {
    setIsBatchEditMode(!isBatchEditMode);
    setSelectedLinks(new Set()); // 退出批量编辑模式时清空选中项
  };

  const toggleLinkSelection = useCallback((linkId: string) => {
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(linkId)) {
        newSet.delete(linkId);
      } else {
        newSet.add(linkId);
      }
      return newSet;
    });
  }, []);

  const handleBatchDelete = () => {
    if (!authToken) { setIsAuthOpen(true); return; }
    
    if (selectedLinks.size === 0) {
      alert('请先选择要删除的链接');
      return;
    }
    
    if (confirm(`确定要删除选中的 ${selectedLinks.size} 个链接吗？`)) {
      const newLinks = links.filter(link => !selectedLinks.has(link.id));
      updateData(newLinks, categories);
      setSelectedLinks(new Set());
      setIsBatchEditMode(false);
    }
  };

  const handleBatchMove = (targetCategoryId: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    
    if (selectedLinks.size === 0) {
      alert('请先选择要移动的链接');
      return;
    }
    
    const newLinks = links.map(link => 
      selectedLinks.has(link.id) ? { ...link, categoryId: targetCategoryId } : link
    );
    updateData(newLinks, categories);
    setSelectedLinks(new Set());
    setIsBatchEditMode(false);
  };

  const handleSelectAll = () => {
    // 获取当前显示的所有链接ID
    const currentLinkIds = displayedLinks.map(link => link.id);
    
    // 如果已选中的链接数量等于当前显示的链接数量，则取消全选
    if (selectedLinks.size === currentLinkIds.length && currentLinkIds.every(id => selectedLinks.has(id))) {
      setSelectedLinks(new Set());
    } else {
      // 否则全选当前显示的所有链接
      setSelectedLinks(new Set(currentLinkIds));
    }
  };

  // --- Actions ---

  const handleLogin = async (password: string, rememberForever: boolean = false): Promise<boolean> => {
      try {
        // 首先验证密码
        const authResponse = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': password
            },
            body: JSON.stringify({ authOnly: true }) // 只用于验证密码，不更新数据
        });
        
        if (authResponse.ok) {
            setAuthToken(password);
            localStorage.setItem(AUTH_KEY, password);
            setIsAuthOpen(false);
            setSyncStatus('saved');
            
            // 确定过期天数：如果勾选了“永不退出”，设为 0，否则默认 7 天
            let newExpiryDays = rememberForever ? 0 : 7;
            
            // 登录成功后，获取网站配置
            try {
                const websiteConfigRes = await fetch('/api/storage?getConfig=website');
                if (websiteConfigRes.ok) {
                    const websiteConfigData = await websiteConfigRes.json();
                    if (websiteConfigData) {
                        if (!rememberForever && websiteConfigData.passwordExpiryDays !== undefined && websiteConfigData.passwordExpiryDays !== 0) {
                            newExpiryDays = websiteConfigData.passwordExpiryDays;
                        }
                        setSiteSettings(prev => ({
                            ...prev,
                            title: websiteConfigData.title || prev.title,
                            navTitle: websiteConfigData.navTitle || prev.navTitle,
                            favicon: websiteConfigData.favicon || prev.favicon,
                            cardStyle: websiteConfigData.cardStyle || prev.cardStyle,
                            passwordExpiryDays: newExpiryDays,
                            openTarget: websiteConfigData.openTarget || prev.openTarget || '_blank',
                            showDescription: websiteConfigData.showDescription !== undefined ? websiteConfigData.showDescription : (prev.showDescription !== undefined ? prev.showDescription : true),
                            showTags: websiteConfigData.showTags !== undefined ? websiteConfigData.showTags : (prev.showTags !== undefined ? prev.showTags : false)
                        }));
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch website config after login.", e);
            }
            
            setSiteSettings(prev => {
                const updated = {
                    ...prev,
                    passwordExpiryDays: newExpiryDays
                };
                localStorage.setItem('cloudnav_site_settings', JSON.stringify(updated));
                return updated;
            });

            // 如果勾选了永不退出，同步保存到 KV 空间
            if (rememberForever) {
                try {
                    await fetch('/api/storage', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-auth-password': password
                        },
                        body: JSON.stringify({
                            saveConfig: 'website',
                            config: { ...siteSettings, passwordExpiryDays: 0 }
                        })
                    });
                } catch (e) {
                    console.warn("Failed to sync website config to KV after login.", e);
                }
            }
            
            localStorage.setItem('lastLoginTime', Date.now().toString());
            
            // 登录成功后，从服务器获取数据
            try {
                const res = await fetch('/api/storage', {
                    headers: { 'x-auth-password': password }
                });
                if (res.ok) {
                    const data = await res.json();
                    // 如果服务器有数据，使用服务器数据
                    if (data.links && data.links.length > 0) {
                        setLinks(data.links);
                        setCategories(data.categories || DEFAULT_CATEGORIES);
                        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
                        
                        // 加载链接图标缓存
                        loadLinkIcons(data.links);
                    } else {
                        // 如果服务器没有数据，使用本地数据
                        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links, categories }));
                        // 并将本地数据同步到服务器
                        syncToCloud(links, categories, password);
                        
                        // 加载链接图标缓存
                        loadLinkIcons(links);
                    }
                } 
            } catch (e) {
                console.warn("Failed to fetch data after login.", e);
                loadFromLocal();
                // 尝试将本地数据同步到服务器
                syncToCloud(links, categories, password);
            }
            
            // 登录成功后，从KV空间加载AI配置
            try {
                const aiConfigRes = await fetch('/api/storage?getConfig=ai');
                if (aiConfigRes.ok) {
                    const aiConfigData = await aiConfigRes.json();
                    if (aiConfigData && Object.keys(aiConfigData).length > 0) {
                        setAiConfig(aiConfigData);
                        localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiConfigData));
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch AI config after login.", e);
            }
            
            return true;
        }
        return false;
      } catch (e) {
          return false;
      }
  };

  const handleLogout = () => {
      setAuthToken(null);
      localStorage.removeItem(AUTH_KEY);
      setSyncStatus('offline');
      // 退出后重新加载本地数据
      loadFromLocal();
  };

  // 分类操作密码验证处理函数
  const handleCategoryActionAuth = async (password: string): Promise<boolean> => {
    try {
      // 验证密码
      const authResponse = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': password
        },
        body: JSON.stringify({ authOnly: true })
      });
      
      return authResponse.ok;
    } catch (error) {
      console.error('Category action auth error:', error);
      return false;
    }
  };

  // 打开分类操作验证弹窗
  const openCategoryActionAuth = (action: 'edit' | 'delete', categoryId: string, categoryName: string) => {
    setCategoryActionAuth({
      isOpen: true,
      action,
      categoryId,
      categoryName
    });
  };

  // 关闭分类操作验证弹窗
  const closeCategoryActionAuth = () => {
    setCategoryActionAuth({
      isOpen: false,
      action: 'edit',
      categoryId: '',
      categoryName: ''
    });
  };

  const handleImportConfirm = (newLinks: LinkItem[], newCategories: Category[]) => {
      // Merge categories: Avoid duplicate names/IDs
      const mergedCategories = [...categories];
      
      // 确保"常用推荐"分类始终存在
      if (!mergedCategories.some(c => c.id === 'common')) {
        mergedCategories.push({ id: 'common', name: '常用推荐', icon: 'Star' });
      }
      
      newCategories.forEach(nc => {
          if (!mergedCategories.some(c => c.id === nc.id || (c.name.toLowerCase() === nc.name.toLowerCase() && (c.parentId || '') === (nc.parentId || '')))) {
              mergedCategories.push(nc);
          }
      });

      const mergedLinks = [...links, ...newLinks];
      updateData(mergedLinks, mergedCategories);
      setIsImportModalOpen(false);
      alert(`成功导入 ${newLinks.length} 个新书签!`);
  };

  const handleAddLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    
    // 处理URL，确保有协议前缀
    let processedUrl = data.url;
    if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }
    
    // 获取当前分类下的所有链接（不包括置顶链接）
    const categoryLinks = links.filter(link => 
      !link.pinned && (data.categoryId === 'all' || link.categoryId === data.categoryId)
    );
    
    // 计算新链接的order值，使其排在分类最后
    const maxOrder = categoryLinks.length > 0 
      ? Math.max(...categoryLinks.map(link => link.order || 0))
      : -1;
    
    const newLink: LinkItem = {
      ...data,
      url: processedUrl, // 使用处理后的URL
      id: Date.now().toString(),
      createdAt: Date.now(),
      order: maxOrder + 1, // 设置为当前分类的最大order值+1，确保排在最后
      // 如果是置顶链接，设置pinnedOrder为当前置顶链接数量
      pinnedOrder: data.pinned ? links.filter(l => l.pinned).length : undefined
    };
    
    // 将新链接插入到合适的位置，而不是直接放在开头
    // 如果是置顶链接，放在置顶链接区域的最后
    if (newLink.pinned) {
      const firstNonPinnedIndex = links.findIndex(link => !link.pinned);
      if (firstNonPinnedIndex === -1) {
        // 如果没有非置顶链接，直接添加到末尾
        updateData([...links, newLink], categories);
      } else {
        // 插入到非置顶链接之前
        const updatedLinks = [...links];
        updatedLinks.splice(firstNonPinnedIndex, 0, newLink);
        updateData(updatedLinks, categories);
      }
    } else {
      // 非置顶链接，按照order字段排序后插入
      const updatedLinks = [...links, newLink].sort((a, b) => {
        // 置顶链接始终排在前面
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        
        // 同类型链接按照order排序
        const aOrder = a.order !== undefined ? a.order : a.createdAt;
        const bOrder = b.order !== undefined ? b.order : b.createdAt;
        return aOrder - bOrder;
      });
      updateData(updatedLinks, categories);
    }
    
    // Clear prefill if any
    setPrefillLink(undefined);
  };

  const handleEditLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!editingLink) return;
    
    // 处理URL，确保有协议前缀
    let processedUrl = data.url;
    if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }
    
    const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data, url: processedUrl } : l);
    updateData(updated, categories);
    setEditingLink(undefined);
  };

  // 拖拽结束事件处理函数
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 获取当前分类下的所有链接（包括子分类）
      const subCategoryIds = categories.filter(c => c.parentId === selectedCategory).map(c => c.id);
      const categoryLinks = links.filter(link => 
        selectedCategory === 'all' || 
        link.categoryId === selectedCategory || 
        subCategoryIds.includes(link.categoryId)
      );
      
      // 找到被拖拽元素和目标元素的索引
      const activeIndex = categoryLinks.findIndex(link => link.id === active.id);
      const overIndex = categoryLinks.findIndex(link => link.id === over.id);
      
      if (activeIndex !== -1 && overIndex !== -1) {
        // 重新排序当前分类的链接
        const reorderedCategoryLinks = arrayMove<LinkItem>(categoryLinks, activeIndex, overIndex);
        
        // 更新所有链接的顺序
        const updatedLinks = links.map(link => {
          const reorderedIndex = reorderedCategoryLinks.findIndex(l => l.id === link.id);
          if (reorderedIndex !== -1) {
            return { ...link, order: reorderedIndex };
          }
          return link;
        });
        
        // 按照order字段重新排序
        updatedLinks.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        updateData(updatedLinks, categories);
      }
    }
  };

  // 置顶链接拖拽结束事件处理函数
  const handlePinnedDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 获取所有置顶链接
      const pinnedLinksList = links.filter(link => link.pinned);
      
      // 找到被拖拽元素和目标元素的索引
      const activeIndex = pinnedLinksList.findIndex(link => link.id === active.id);
      const overIndex = pinnedLinksList.findIndex(link => link.id === over.id);
      
      if (activeIndex !== -1 && overIndex !== -1) {
        // 重新排序置顶链接
        const reorderedPinnedLinks = arrayMove<LinkItem>(pinnedLinksList, activeIndex, overIndex);
        
        // 创建一个映射，存储每个置顶链接的新pinnedOrder
        const pinnedOrderMap = new Map<string, number>();
        reorderedPinnedLinks.forEach((link, index) => {
          pinnedOrderMap.set(link.id, index);
        });
        
        // 只更新置顶链接的pinnedOrder，不改变任何链接的顺序
        const updatedLinks = links.map(link => {
          if (link.pinned) {
            return { 
              ...link, 
              pinnedOrder: pinnedOrderMap.get(link.id) 
            };
          }
          return link;
        });
        
        // 按照pinnedOrder重新排序整个链接数组，确保置顶链接的顺序正确
        // 同时保持非置顶链接的相对顺序不变
        updatedLinks.sort((a, b) => {
          // 如果都是置顶链接，按照pinnedOrder排序
          if (a.pinned && b.pinned) {
            return (a.pinnedOrder || 0) - (b.pinnedOrder || 0);
          }
          // 如果只有一个是置顶链接，置顶链接排在前面
          if (a.pinned) return -1;
          if (b.pinned) return 1;
          // 如果都不是置顶链接，保持原位置不变（按照order或createdAt排序）
          const aOrder = a.order !== undefined ? a.order : a.createdAt;
          const bOrder = b.order !== undefined ? b.order : b.createdAt;
          return bOrder - aOrder;
        });
        
        updateData(updatedLinks, categories);
      }
    }
  };

  // 开始排序
  const startSorting = (categoryId: string) => {
    setIsSortingMode(categoryId);
  };

  // 保存排序
  const saveSorting = () => {
    // 在保存排序时，确保将当前排序后的数据保存到服务器和本地存储
    updateData(links, categories);
    setIsSortingMode(null);
  };

  // 取消排序
  const cancelSorting = () => {
    setIsSortingMode(null);
  };

  // 保存置顶链接排序
  const savePinnedSorting = () => {
    // 在保存排序时，确保将当前排序后的数据保存到服务器和本地存储
    updateData(links, categories);
    setIsSortingPinned(false);
  };

  // 取消置顶链接排序
  const cancelPinnedSorting = () => {
    setIsSortingPinned(false);
  };

  // 设置dnd-kit的传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要拖动8px才开始拖拽，避免误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDeleteLink = (id: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (confirm('确定删除此链接吗?')) {
      updateData(links.filter(l => l.id !== id), categories);
    }
  };

  const togglePin = (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!authToken) { setIsAuthOpen(true); return; }
      
      const linkToToggle = links.find(l => l.id === id);
      if (!linkToToggle) return;
      
      // 如果是设置为置顶，则设置pinnedOrder为当前置顶链接数量
      // 如果是取消置顶，则清除pinnedOrder
      const updated = links.map(l => {
        if (l.id === id) {
          const isPinned = !l.pinned;
          return { 
            ...l, 
            pinned: isPinned,
            pinnedOrder: isPinned ? links.filter(link => link.pinned).length : undefined
          };
        }
        return l;
      });
      
      updateData(updated, categories);
  };

  const handleSaveAIConfig = async (config: AIConfig, newSiteSettings?: any) => {
      setAiConfig(config);
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
      
      if (newSiteSettings) {
          setSiteSettings(newSiteSettings);
          localStorage.setItem('cloudnav_site_settings', JSON.stringify(newSiteSettings));
      }
      
      if (authToken) {
          try {
              const response = await fetch('/api/storage', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'x-auth-password': authToken
                  },
                  body: JSON.stringify({
                      saveConfig: 'ai',
                      config: config
                  })
              });
              
              if (!response.ok) {
                  console.error('Failed to save AI config to KV:', response.statusText);
              }
          } catch (error) {
              console.error('Error saving AI config to KV:', error);
          }
          
          if (newSiteSettings) {
              try {
                  const response = await fetch('/api/storage', {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                          'x-auth-password': authToken
                      },
                      body: JSON.stringify({
                          saveConfig: 'website',
                          config: newSiteSettings
                      })
                  });
                  
                  if (!response.ok) {
                      console.error('Failed to save website config to KV:', response.statusText);
                  }
              } catch (error) {
                  console.error('Error saving website config to KV:', error);
              }
          }
      }
  };

  const handleRestoreAIConfig = async (config: AIConfig) => {
      setAiConfig(config);
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
      
      // 同时保存到KV空间
      if (authToken) {
          try {
              const response = await fetch('/api/storage', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'x-auth-password': authToken
                  },
                  body: JSON.stringify({
                      saveConfig: 'ai',
                      config: config
                  })
              });
              
              if (!response.ok) {
                  console.error('Failed to restore AI config to KV:', response.statusText);
              }
          } catch (error) {
              console.error('Error restoring AI config to KV:', error);
          }
      }
  };

  // --- Category Management & Security ---

  const handleCategoryClick = (cat: Category) => {
      // 检查当前分类或其父分类是否设置了密码且未解锁
      const getLockedAncestor = (category: Category): Category | null => {
          // 如果当前分类有密码且未解锁，返回当前分类
          if (category.password && !unlockedCategoryIds.has(category.id)) {
              return category;
          }
          // 如果有父分类，递归检查父分类
          if (category.parentId) {
              const parent = categories.find(c => c.id === category.parentId);
              if (parent) {
                  return getLockedAncestor(parent);
              }
          }
          return null;
      };

      const lockedAncestor = getLockedAncestor(cat);
      if (lockedAncestor) {
          setCatAuthModalData(lockedAncestor);
          setSidebarOpen(false);
          return;
      }
      
      setSelectedCategory(cat.id);
      setSidebarOpen(false);
  };

  const handleUnlockCategory = (catId: string) => {
      setUnlockedCategoryIds(prev => new Set(prev).add(catId));
      setSelectedCategory(catId);
  };

  const handleUpdateCategories = (newCats: Category[]) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      updateData(links, newCats);
  };

  const handleDeleteCategory = (catId: string, mode: 'migrate' | 'delete_all' = 'migrate', targetId: string = 'common') => {
      if (!authToken) { setIsAuthOpen(true); return; }
      
      // 找出所有要删除的分类ID（包括子分类）
      const idsToDelete = [catId];
      const children = categories.filter(c => c.parentId === catId);
      children.forEach(child => idsToDelete.push(child.id));

      let newCats = categories.filter(c => !idsToDelete.includes(c.id));
      
      let newLinks;
      if (mode === 'migrate') {
        // 迁移书签
        newLinks = links.map(l => idsToDelete.includes(l.categoryId) ? { ...l, categoryId: targetId } : l);
      } else {
        // 连同书签一起删除
        newLinks = links.filter(l => !idsToDelete.includes(l.categoryId));
      }
      
      updateData(newLinks, newCats);
  };

  // --- WebDAV Config ---
  const handleSaveWebDavConfig = (config: WebDavConfig) => {
      setWebDavConfig(config);
      localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  };

  // 搜索源选择弹出窗口状态
  const [showSearchSourcePopup, setShowSearchSourcePopup] = useState(false);
  const [hoveredSearchSource, setHoveredSearchSource] = useState<ExternalSearchSource | null>(null);
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [isPopupHovered, setIsPopupHovered] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 处理弹出窗口显示/隐藏逻辑
  useEffect(() => {
    if (isIconHovered || isPopupHovered) {
      // 如果图标或弹出窗口被悬停，清除隐藏定时器并显示弹出窗口
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setShowSearchSourcePopup(true);
    } else {
      // 如果图标和弹出窗口都没有被悬停，设置一个延迟隐藏弹出窗口
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setShowSearchSourcePopup(false);
        setHoveredSearchSource(null);
      }, 100);
    }
    
    // 清理函数
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isIconHovered, isPopupHovered]);

  // 优设导航热门标签计算
  const topHotTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    links.forEach(link => {
      if (link.tags && Array.isArray(link.tags)) {
        link.tags.forEach(t => {
          const clean = t.trim();
          if (clean) tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
        });
      }
    });
    const sorted = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
    if (sorted.length === 0) {
      return ['AI', '设计神器', '前端开发', '效率工具'];
    }
    return sorted;
  }, [links]);

  // 搜索提交按钮文案
  const submitButtonText = useMemo(() => {
    if (searchMode === 'internal') return '站内搜索';
    const cur = selectedSearchSource || externalSearchSources.find(s => s.enabled) || DEFAULT_SEARCH_SOURCES[0];
    if (cur.id === 'baidu' || cur.name.includes('百度')) return '百度一下';
    if (cur.id === 'google' || cur.name.toLowerCase().includes('google')) return 'Google 搜索';
    if (cur.id === 'bing' || cur.name.includes('必应')) return '必应搜索';
    return `${cur.name} 搜索`;
  }, [searchMode, selectedSearchSource, externalSearchSources]);

  // 切换搜索引擎
  const handleSwitchEngine = (source: ExternalSearchSource | 'internal') => {
    if (source === 'internal') {
      setSearchMode('internal');
      handleSaveSearchConfig(externalSearchSources, 'internal', selectedSearchSource);
    } else {
      setSearchMode('external');
      setSelectedSearchSource(source);
      handleSaveSearchConfig(externalSearchSources, 'external', source);
    }
  };

  // 触发搜索
  const handleTriggerSearch = () => {
    if (!searchQuery.trim()) return;
    if (searchMode === 'external') {
      const current = selectedSearchSource || externalSearchSources.find(s => s.enabled) || DEFAULT_SEARCH_SOURCES[0];
      const searchUrl = current.url.replace('{query}', encodeURIComponent(searchQuery));
      window.open(searchUrl, siteSettings.openTarget === '_self' ? '_self' : '_blank');
    }
  };

  // 滚动监听
  const handleContentScroll = () => {
    if (!contentScrollRef.current) return;
    const container = contentScrollRef.current;
    const scrollY = container.scrollTop;
    
    // 按 DOM 纵向渲染顺序收集所有锚点 ID（包含置顶、父分类及各子分类）
    const sectionIds: string[] = ['pinned'];
    for (const cat of categories.filter(c => !c.parentId)) {
      sectionIds.push(`cat-${cat.id}`);
      const subCats = categories.filter(c => c.parentId === cat.id);
      for (const sub of subCats) {
        sectionIds.push(`cat-${sub.id}`);
      }
    }
    
    for (const secId of sectionIds) {
      const el = document.getElementById(secId);
      if (el) {
        const top = el.offsetTop - container.offsetTop;
        if (top <= scrollY + 140) {
          setActiveSection(secId);
        }
      }
    }
  };

  // 锚点平滑滚动
  const scrollToSection = (targetId: string) => {
    if (searchQuery.trim()) {
      setSearchQuery('');
      // 若处于搜索结果态，等状态清空切回主分类流后再执行平滑滚动
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.history.replaceState(null, '', `#${targetId}`);
          setActiveSection(targetId);
        }
      }, 50);
    } else {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${targetId}`);
        setActiveSection(targetId);
      }
    }
    setSidebarOpen(false);
  };

  // 处理搜索源选择
  const handleSearchSourceSelect = (source: ExternalSearchSource) => {
    handleSwitchEngine(source);
    setShowSearchSourcePopup(false);
    setHoveredSearchSource(null);
  };


  // --- Search Config ---
  const handleSaveSearchConfig = async (sources: ExternalSearchSource[], mode: SearchMode, selectedSource?: ExternalSearchSource | null) => {
      const searchConfig: SearchConfig = {
          mode,
          externalSources: sources,
          selectedSource: selectedSource !== undefined ? selectedSource : selectedSearchSource
      };
      
      setExternalSearchSources(sources);
      setSearchMode(mode);
      if (selectedSource !== undefined) {
          setSelectedSearchSource(selectedSource);
      }
      
      // 保存到本地缓存和 KV 空间
      try {
        localStorage.setItem(SEARCH_CONFIG_KEY, JSON.stringify(searchConfig));
      } catch (e) {}
      try {
          const headers: Record<string, string> = {
              'Content-Type': 'application/json'
          };
          
          // 如果有认证令牌，添加认证头
          if (authToken) {
              headers['x-auth-password'] = authToken;
          }
          
          const response = await fetch('/api/storage', {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({
                  saveConfig: 'search',
                  config: searchConfig
              })
          });
          
          if (!response.ok) {
              console.error('Failed to save search config to KV:', response.statusText);
          }
      } catch (error) {
          console.error('Error saving search config to KV:', error);
      }
  };

  const handleSaveSearchSources = (sources: ExternalSearchSource[]) => {
      handleSaveSearchConfig(sources, searchMode);
  };

  const handleSearchModeChange = (mode: SearchMode) => {
      setSearchMode(mode);
      
      // 如果切换到外部搜索模式且搜索源列表为空，自动加载默认搜索源
      if (mode === 'external' && externalSearchSources.length === 0) {
          const defaultSources: ExternalSearchSource[] = [
              {
                  id: 'bing',
                  name: '必应',
                  url: 'https://www.bing.com/search?q={query}',
                  icon: 'Search',
                  enabled: true,
                  createdAt: Date.now()
              },
              {
                  id: 'google',
                  name: 'Google',
                  url: 'https://www.google.com/search?q={query}',
                  icon: 'Search',
                  enabled: true,
                  createdAt: Date.now()
              },
              {
                  id: 'baidu',
                  name: '百度',
                  url: 'https://www.baidu.com/s?wd={query}',
                  icon: 'Globe',
                  enabled: true,
                  createdAt: Date.now()
              },
              {
                  id: 'sogou',
                  name: '搜狗',
                  url: 'https://www.sogou.com/web?query={query}',
                  icon: 'Globe',
                  enabled: true,
                  createdAt: Date.now()
              },
              {
                  id: 'yandex',
                  name: 'Yandex',
                  url: 'https://yandex.com/search/?text={query}',
                  icon: 'Globe',
                  enabled: true,
                  createdAt: Date.now()
              },
              {
                  id: 'github',
                  name: 'GitHub',
                  url: 'https://github.com/search?q={query}',
                  icon: 'Github',
                  enabled: true,
                  createdAt: Date.now()
              },
              {
                  id: 'linuxdo',
                  name: 'Linux.do',
                  url: 'https://linux.do/search?q={query}',
                  icon: 'Terminal',
                  enabled: true,
                  createdAt: Date.now()
              },
              {
                  id: 'bilibili',
                  name: 'B站',
                  url: 'https://search.bilibili.com/all?keyword={query}',
                  icon: 'Play',
                  enabled: true,
                  createdAt: Date.now()
              },
              {
                  id: 'youtube',
                  name: 'YouTube',
                  url: 'https://www.youtube.com/results?search_query={query}',
                  icon: 'Video',
                  enabled: true,
                  createdAt: Date.now()
              },
              {
                  id: 'wikipedia',
                  name: '维基',
                  url: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}',
                  icon: 'BookOpen',
                  enabled: true,
                  createdAt: Date.now()
              }
          ];
          
          // 保存默认搜索源到状态和KV空间
          handleSaveSearchConfig(defaultSources, mode);
      } else {
          handleSaveSearchConfig(externalSearchSources, mode);
      }
  };

  const handleExternalSearch = () => {
      if (searchQuery.trim() && searchMode === 'external') {
          // 如果搜索源列表为空，自动加载默认搜索源
          if (externalSearchSources.length === 0) {
              const defaultSources: ExternalSearchSource[] = [
                  {
                      id: 'bing',
                      name: '必应',
                      url: 'https://www.bing.com/search?q={query}',
                      icon: 'Search',
                      enabled: true,
                      createdAt: Date.now()
                  },
                  {
                      id: 'google',
                      name: 'Google',
                      url: 'https://www.google.com/search?q={query}',
                      icon: 'Search',
                      enabled: true,
                      createdAt: Date.now()
                  },
                  {
                      id: 'baidu',
                      name: '百度',
                      url: 'https://www.baidu.com/s?wd={query}',
                      icon: 'Globe',
                      enabled: true,
                      createdAt: Date.now()
                  },
                  {
                      id: 'sogou',
                      name: '搜狗',
                      url: 'https://www.sogou.com/web?query={query}',
                      icon: 'Globe',
                      enabled: true,
                      createdAt: Date.now()
                  },
                  {
                      id: 'yandex',
                      name: 'Yandex',
                      url: 'https://yandex.com/search/?text={query}',
                      icon: 'Globe',
                      enabled: true,
                      createdAt: Date.now()
                  },
                  {
                      id: 'github',
                      name: 'GitHub',
                      url: 'https://github.com/search?q={query}',
                      icon: 'Github',
                      enabled: true,
                      createdAt: Date.now()
                  },
                  {
                      id: 'linuxdo',
                      name: 'Linux.do',
                      url: 'https://linux.do/search?q={query}',
                      icon: 'Terminal',
                      enabled: true,
                      createdAt: Date.now()
                  },
                  {
                      id: 'bilibili',
                      name: 'B站',
                      url: 'https://search.bilibili.com/all?keyword={query}',
                      icon: 'Play',
                      enabled: true,
                      createdAt: Date.now()
                  },
                  {
                      id: 'youtube',
                      name: 'YouTube',
                      url: 'https://www.youtube.com/results?search_query={query}',
                      icon: 'Video',
                      enabled: true,
                      createdAt: Date.now()
                  },
                  {
                      id: 'wikipedia',
                      name: '维基',
                      url: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}',
                      icon: 'BookOpen',
                      enabled: true,
                      createdAt: Date.now()
                  }
              ];
              
              // 保存默认搜索源到状态和KV空间
              handleSaveSearchConfig(defaultSources, 'external');
              
              // 使用第一个默认搜索源立即执行搜索
              const searchUrl = defaultSources[0].url.replace('{query}', encodeURIComponent(searchQuery));
              window.open(searchUrl, siteSettings.openTarget === '_self' ? '_self' : '_blank');
              return;
          }
          
          // 如果有选中的搜索源，使用选中的搜索源；否则使用第一个启用的搜索源
          let source = selectedSearchSource;
          if (!source) {
              const enabledSources = externalSearchSources.filter(s => s.enabled);
              if (enabledSources.length > 0) {
                  source = enabledSources[0];
              }
          }
          
          if (source) {
              const searchUrl = source.url.replace('{query}', encodeURIComponent(searchQuery));
              window.open(searchUrl, siteSettings.openTarget === '_self' ? '_self' : '_blank');
          }
      }
  };

  const handleRestoreBackup = (restoredLinks: LinkItem[], restoredCategories: Category[]) => {
      updateData(restoredLinks, restoredCategories);
      setIsBackupModalOpen(false);
  };

  const handleRestoreSearchConfig = (restoredSearchConfig: SearchConfig) => {
      handleSaveSearchConfig(restoredSearchConfig.externalSources, restoredSearchConfig.mode);
  };

  // --- Filtering & Memo ---

  // Helper to check if a category is "Locked" (Has password AND not unlocked, or its parent is locked)
  const isCategoryLocked = (catId: string): boolean => {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return false;
      
      // 检查当前分类是否锁定
      if (cat.password && !unlockedCategoryIds.has(catId)) return true;
      
      // 如果有父分类，递归检查父分类是否锁定
      if (cat.parentId) {
          return isCategoryLocked(cat.parentId);
      }
      
      return false;
  };

  const pinnedLinks = useMemo(() => {
      // Don't show pinned links if they belong to a locked category
      const filteredPinnedLinks = links.filter(l => l.pinned && !isCategoryLocked(l.categoryId));
      // 按照pinnedOrder字段排序，如果没有pinnedOrder字段则按创建时间排序
      return filteredPinnedLinks.sort((a, b) => {
        // 如果有pinnedOrder字段，则使用pinnedOrder排序
        if (a.pinnedOrder !== undefined && b.pinnedOrder !== undefined) {
          return a.pinnedOrder - b.pinnedOrder;
        }
        // 如果只有一个有pinnedOrder字段，有pinnedOrder的排在前面
        if (a.pinnedOrder !== undefined) return -1;
        if (b.pinnedOrder !== undefined) return 1;
        // 如果都没有pinnedOrder字段，则按创建时间排序
        return a.createdAt - b.createdAt;
      });
  }, [links, categories, unlockedCategoryIds]);

  // 预计算搜索字符串索引，避免每次按键对数千条数据进行重复 toLowerCase 与频繁内存分配
  const searchIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of links) {
      const text = `${l.title} ${l.url} ${l.description || ''} ${l.emoji || ''} ${l.tags ? l.tags.join(' ') : ''}`.toLowerCase();
      map.set(l.id, text);
    }
    return map;
  }, [links]);

  // 预先建立父分类下的所有关联链接映射表，极大减少首页全景流对于海量链接的反复遍历过滤
  const parentCategoryLinksMap = useMemo(() => {
    const subToParentMap = new Map<string, string>();
    for (const c of categories) {
      if (c.parentId) {
        subToParentMap.set(c.id, c.parentId);
      }
    }

    const map = new Map<string, LinkItem[]>();
    for (const c of categories) {
      if (!c.parentId) {
        map.set(c.id, []);
      }
    }

    for (const l of links) {
      if (map.has(l.categoryId)) {
        map.get(l.categoryId)!.push(l);
      } else {
        const parentId = subToParentMap.get(l.categoryId);
        if (parentId && map.has(parentId)) {
          map.get(parentId)!.push(l);
        }
      }
    }
    return map;
  }, [links, categories]);

  // 建立单个分类 (含一级直属与二级分类) 的链接映射表
  const directCategoryLinksMap = useMemo(() => {
    const map = new Map<string, LinkItem[]>();
    for (const c of categories) {
      map.set(c.id, []);
    }
    for (const l of links) {
      if (map.has(l.categoryId)) {
        map.get(l.categoryId)!.push(l);
      }
    }
    return map;
  }, [links, categories]);

  const displayedLinks = useMemo(() => {
    let result = links;
    
    // Security Filter: Always hide links from locked categories
    result = result.filter(l => !isCategoryLocked(l.categoryId));

    // Search Filter using deferredSearchQuery and searchIndex
    const q = deferredSearchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(l => {
        const text = searchIndex.get(l.id);
        return text ? text.includes(q) : false;
      });
    }

    // Category Filter
    if (selectedCategory !== 'all') {
      // 获取当前分类及其所有子分类的ID
      const subCategoryIds = categories.filter(c => c.parentId === selectedCategory).map(c => c.id);
      result = result.filter(l => l.categoryId === selectedCategory || subCategoryIds.includes(l.categoryId));
    }
    
    // 按照order字段排序，如果没有order字段则按创建时间排序
    // 修改排序逻辑：order值越大排在越前面，新增的卡片order值最大，会排在最前面
    // 我们需要反转这个排序，让新增的卡片(order值最大)排在最后面
    return result.sort((a, b) => {
      const aOrder = a.order !== undefined ? a.order : a.createdAt;
      const bOrder = b.order !== undefined ? b.order : b.createdAt;
      // 改为升序排序，这样order值小(旧卡片)的排在前面，order值大(新卡片)的排在后面
      return aOrder - bOrder;
    });
  }, [links, selectedCategory, deferredSearchQuery, categories, unlockedCategoryIds, searchIndex]);

  // 计算其他目录的搜索结果
  const otherCategoryResults = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q || selectedCategory === 'all') {
      return {};
    }
    
    // 获取其他目录中匹配的链接
    const otherLinks = links.filter(link => {
      // 排除当前目录的链接
      if (link.categoryId === selectedCategory) {
        return false;
      }
      
      // 排除锁定的目录
      if (isCategoryLocked(link.categoryId)) {
        return false;
      }
      
      // 搜索匹配
      const text = searchIndex.get(link.id);
      return text ? text.includes(q) : false;
    });

    // 按目录分组
    const groupedByCategory = otherLinks.reduce((acc, link) => {
      if (!acc[link.categoryId]) {
        acc[link.categoryId] = [];
      }
      acc[link.categoryId].push(link);
      return acc;
    }, {} as Record<string, LinkItem[]>);

    // 对每个目录内的链接进行排序
    Object.keys(groupedByCategory).forEach(categoryId => {
      groupedByCategory[categoryId].sort((a, b) => {
        const aOrder = a.order !== undefined ? a.order : a.createdAt;
        const bOrder = b.order !== undefined ? b.order : b.createdAt;
        return aOrder - bOrder;
      });
    });

    return groupedByCategory;
  }, [links, selectedCategory, deferredSearchQuery, categories, unlockedCategoryIds, searchIndex]);


  // --- Render Components ---

  // 创建可排序的链接卡片组件
  const SortableLinkCard: React.FC<{ link: LinkItem; key?: string }> = ({ link }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: link.id });
    
    const isDetailedView = siteSettings.cardStyle === 'detailed';
    const showDesc = (siteSettings.showDescription !== false) && isDetailedView && !!link.description;
    const showTags = (siteSettings.showTags === true) && isDetailedView && !!link.tags && link.tags.length > 0;
    const hasExtra = showDesc || (isDetailedView && showTags);
    
    const style = {
      transform: CSS.Transform.toString(transform),
      transition: isDragging ? 'none' : transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 1000 : 'auto',
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative transition-all duration-200 cursor-grab active:cursor-grabbing min-w-0 max-w-full overflow-hidden ${
          isSortingMode || isSortingPinned
            ? 'bg-blue-50/50 dark:bg-blue-900/30 ring-1 ring-blue-300 dark:ring-blue-700' 
            : 'bg-white dark:bg-slate-800'
        } ${isDragging ? 'shadow-2xl scale-105 z-50' : 'hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:hover:shadow-black/20'} ${
          isDetailedView 
            ? `flex flex-col rounded-[10px] p-[14px] ${hasExtra ? 'min-h-[96px]' : 'min-h-[68px] justify-center'}` 
            : 'flex items-center rounded-[10px] p-2.5 px-3 hover:-translate-y-0.5'
        }`}
        {...attributes}
        {...listeners}
      >
        <div className={`flex flex-1 min-w-0 overflow-hidden ${
          isDetailedView ? 'flex-col' : 'items-center gap-2.5 w-full'
        }`}>
          {/* 第一行：图标和标题 */}
          <div className={`flex items-center gap-2.5 ${isDetailedView ? 'w-full gap-3' : 'w-full min-w-0 flex-1'}`}>
            <div className={`text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase shrink-0 overflow-hidden bg-slate-50 dark:bg-slate-700/60 border border-slate-100 dark:border-slate-700/60 ${
              isDetailedView ? 'w-10 h-10 rounded-xl p-1.5' : 'w-7 h-7 rounded-lg p-1 text-xs'
            }`}>
              {link.icon ? (
                <img src={link.icon} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              ) : (
                link.title.charAt(0)
              )}
            </div>
            
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <h3 className={`font-semibold text-[#3c3c3c] dark:text-slate-100 truncate overflow-hidden text-ellipsis ${
                isDetailedView ? 'text-[16px]' : 'text-[14px]'
              }`} title={link.title}>
                {link.title}
              </h3>
              {link.emoji && (
                <span className="shrink-0 text-sm select-none" title={`标记: ${link.emoji}`}>
                  {link.emoji}
                </span>
              )}
            </div>
          </div>
          
          {/* 第二行：描述文字 */}
          {showDesc && (
            <p className="text-[12px] text-[#8f8f8f] dark:text-slate-400 leading-[18px] line-clamp-2 h-[36px] mt-2 group-hover:text-[#5a5a5a] dark:group-hover:text-slate-200 transition-colors">
              {link.description}
            </p>
          )}

          {/* 第三行：标签展示 */}
          {isDetailedView && showTags && (
            <div className="flex flex-nowrap overflow-hidden items-center gap-1.5 mt-2.5 w-full whitespace-nowrap">
              {link.tags!.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#f1f7fc] text-[#9ca7ae] dark:bg-slate-700/60 dark:text-slate-300 select-none"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- LinkCard Memoized Callbacks & Helpers ---
  const handleOpenEditModal = useCallback((link: LinkItem) => {
    setEditingLink(link);
    setIsModalOpen(true);
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    setSearchQuery(tag);
  }, []);

  const isDetailedView = siteSettings.cardStyle === 'detailed';
  const isSelectedCategoryParentWithChildren = useMemo(() => {
    if (selectedCategory === 'all') return false;
    const currentCat = categories.find(c => c.id === selectedCategory);
    if (currentCat?.parentId) return false;
    return categories.some(c => c.parentId === selectedCategory);
  }, [selectedCategory, categories]);

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      {/* 认证遮罩层 - 当需要认证时显示 */}
      {requiresAuth && !authToken && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex items-center justify-center">
          <div className="w-full max-w-md p-6">
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                需要身份验证
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                此导航页面设置了访问密码，请输入密码以继续访问
              </p>
            </div>
            <React.Suspense fallback={null}>
              <AuthModal 
                isOpen={true} 
                onLogin={handleLogin} 
                defaultRememberForever={siteSettings.passwordExpiryDays === 0}
              />
            </React.Suspense>
          </div>
        </div>
      )}
      
      {/* 主要内容 - 只有在不需要认证或已认证时显示 */}
      {(!requiresAuth || authToken) && (
        <>
          <React.Suspense fallback={null}>
            {isAuthOpen && (
              <AuthModal 
                isOpen={isAuthOpen} 
                onClose={() => setIsAuthOpen(false)}
                onLogin={handleLogin} 
                defaultRememberForever={siteSettings.passwordExpiryDays === 0}
              />
            )}
        
            {!!catAuthModalData && (
              <CategoryAuthModal 
                isOpen={!!catAuthModalData}
                category={catAuthModalData}
                onClose={() => setCatAuthModalData(null)}
                onUnlock={handleUnlockCategory}
              />
            )}

            {isCatManagerOpen && (
              <CategoryManagerModal 
                isOpen={isCatManagerOpen} 
                onClose={() => setIsCatManagerOpen(false)}
                categories={categories}
                onUpdateCategories={handleUpdateCategories}
                onDeleteCategory={handleDeleteCategory}
              />
            )}

            {isBackupModalOpen && (
              <BackupModal
                isOpen={isBackupModalOpen}
                onClose={() => setIsBackupModalOpen(false)}
                links={links}
                categories={categories}
                onRestore={handleRestoreBackup}
                webDavConfig={webDavConfig}
                onSaveWebDavConfig={handleSaveWebDavConfig}
                searchConfig={{ mode: searchMode, externalSources: externalSearchSources }}
                onRestoreSearchConfig={handleRestoreSearchConfig}
                aiConfig={aiConfig}
                onRestoreAIConfig={handleRestoreAIConfig}
              />
            )}

            {isImportModalOpen && (
              <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                existingLinks={links}
                categories={categories}
                onImport={handleImportConfirm}
                onImportSearchConfig={handleRestoreSearchConfig}
                onImportAIConfig={handleRestoreAIConfig}
              />
            )}

            {isSettingsModalOpen && (
              <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                config={aiConfig}
                siteSettings={siteSettings}
                onSave={handleSaveAIConfig}
                links={links}
                categories={categories}
                onUpdateLinks={(newLinks) => updateData(newLinks, categories)}
                authToken={authToken}
                externalSearchSources={externalSearchSources}
                onSaveSearchSources={handleSaveSearchSources}
                onUpdateCategories={handleUpdateCategories}
                onDeleteCategory={handleDeleteCategory}
                onImport={handleImportConfirm}
                onImportSearchConfig={handleRestoreSearchConfig}
                onImportAIConfig={handleRestoreAIConfig}
                webDavConfig={webDavConfig}
                onSaveWebDavConfig={handleSaveWebDavConfig}
                searchConfig={{ mode: searchMode, externalSources: externalSearchSources }}
                onRestoreSearchConfig={handleRestoreSearchConfig}
                onRestoreBackup={handleRestoreBackup}
                onRestoreAIConfig={handleRestoreAIConfig}
              />
            )}

            {isSearchConfigModalOpen && (
              <SearchConfigModal
                isOpen={isSearchConfigModalOpen}
                onClose={() => setIsSearchConfigModalOpen(false)}
                sources={externalSearchSources}
                onSave={(sources) => handleSaveSearchConfig(sources, searchMode)}
              />
            )}
          </React.Suspense>

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          bg-white dark:bg-slate-800 flex flex-col shrink-0
          transition-all duration-300 ease-in-out overflow-hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarCollapsed 
            ? 'w-64 lg:w-0 lg:border-r-0 lg:pointer-events-none border-r border-slate-200 dark:border-slate-700' 
            : 'w-64 lg:w-64 border-r border-slate-200 dark:border-slate-700'
          }
        `}
      >
        <div 
          className={`w-64 flex flex-col h-full shrink-0 transition-transform duration-300 ease-in-out ${
            isSidebarCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'
          }`}
        >
          {/* Logo & Close Button */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-700/80 shrink-0 select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* 品牌专属图标 */}
              <div className="relative group/logo shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-[1.5px] shadow-sm shadow-blue-500/20 shrink-0 flex items-center justify-center transition-transform duration-200 group-hover/logo:scale-105">
                  <div className="w-full h-full rounded-[10px] bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center overflow-hidden">
                    {siteSettings.favicon ? (
                      <img 
                        src={siteSettings.favicon} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} 
                      />
                    ) : (
                      <Cloud size={19} className="text-white fill-white/20 stroke-[2.2]" />
                    )}
                  </div>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800" title="服务就绪"></span>
              </div>

              {/* 品牌字形与微字幕 (Typography & Subtitle) */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 leading-none">
                  {(!siteSettings.navTitle || siteSettings.navTitle === 'CloudNav') ? (
                    <span className="font-brand font-black text-[18px] tracking-tight flex items-baseline">
                      <span className="text-slate-800 dark:text-white">Cloud</span>
                      <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400 bg-clip-text text-transparent ml-0.5">Nav</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-1 mb-1 animate-pulse"></span>
                    </span>
                  ) : (
                    <span className="font-brand font-black text-[18px] tracking-tight bg-gradient-to-r from-slate-900 via-blue-700 to-indigo-600 dark:from-white dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent truncate">
                      {siteSettings.navTitle}
                    </span>
                  )}
                  <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200/60 dark:border-blue-700/60 uppercase select-none shrink-0">
                    PRO
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 tracking-wider mt-1 truncate select-none">
                  云航 · 智能聚合导航
                </span>
              </div>
            </div>

            {/* 关闭边栏按钮 (PC端折叠边栏，移动端关闭抽屉) */}
            <button
              onClick={handleCloseSidebar}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
              title="关闭边栏 (Ctrl+B)"
            >
              <PanelLeftClose size={18} className="hidden lg:block" />
              <X size={18} className="lg:hidden" />
            </button>
          </div>

        {/* Categories List */}
        <div 
          className="flex-1 overflow-y-auto py-4 space-y-1 scrollbar-hide"
          onScroll={() => setHoveredCategory(null)}
        >
            <div className="px-4">
              <button
                onClick={() => scrollToSection('pinned')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                  activeSection === 'pinned' && !searchQuery
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                }`}
              >
                <div className={`p-1.5 rounded-lg flex items-center justify-center ${activeSection === 'pinned' && !searchQuery ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  <Icon name="LayoutGrid" size={16} />
                </div>
                <span className="truncate flex-1 text-left text-sm font-medium">热门推荐</span>
                {activeSection === 'pinned' && !searchQuery && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
              </button>
            </div>

            {categories.filter(c => !c.parentId).map(cat => {
                const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);
                const subCats = categories.filter(c => c.parentId === cat.id);
                const isActive = (activeSection === `cat-${cat.id}` || subCats.some(sc => activeSection === `cat-${sc.id}`)) && !searchQuery;

                return (
                  <div 
                    key={cat.id} 
                    className="relative px-4"
                    onMouseEnter={(e) => {
                      setHoveredCategory(cat.id);
                      setHoveredCategoryTop(e.currentTarget.getBoundingClientRect().top);
                    }}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <button
                      onClick={() => {
                        if (isLocked) {
                          setCatAuthModalData(cat);
                          setSidebarOpen(false);
                          return;
                        }
                        scrollToSection(`cat-${cat.id}`);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold shadow-sm' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${isActive ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        {isLocked ? <Lock size={16} className="text-amber-500" /> : <Icon name={cat.icon} size={16} />}
                      </div>
                      <span className="truncate flex-1 text-left text-sm font-medium">{cat.name}</span>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                      {subCats.length > 0 && (
                        <div className="text-slate-400 group-hover:text-blue-500 transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </div>
                      )}
                    </button>

                    {/* 二级分类悬浮菜单 */}
                    {hoveredCategory === cat.id && subCats.length > 0 && (
                      <div 
                          className="fixed left-64 w-[166px] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-[60] animate-in fade-in slide-in-from-left-2 duration-200 hidden lg:block"
                          style={{ top: hoveredCategoryTop }}
                        >
                        <div className="absolute -left-4 top-0 bottom-0 w-4 bg-transparent" />
                        <div className="px-4 py-1 mb-1 border-b border-slate-100 dark:border-slate-700">
                          <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">{cat.name} / 二级分类</span>
                        </div>
                        {subCats.map(subCat => {
                          const isSubLocked = isCategoryLocked(subCat.id);
                          const isSubActive = activeSection === `cat-${subCat.id}`;
                          return (
                            <button
                              key={subCat.id}
                              onClick={() => {
                                if (isSubLocked) {
                                  setCatAuthModalData(subCat);
                                  setSidebarOpen(false);
                                  return;
                                }
                                scrollToSection(`cat-${subCat.id}`);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left ${
                                isSubActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {isSubLocked ? <Lock size={14} className="text-amber-500" /> : <Icon name={subCat.icon} size={14} />}
                              <span className="text-sm truncate">{subCat.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
            })}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div className="flex items-center justify-between text-xs px-1">
               <div className="flex items-center gap-1.5">
                 <button 
                   onClick={() => setIsSettingsModalOpen(true)}
                   className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-lg transition-all flex items-center justify-center shadow-none hover:shadow-sm"
                   title="系统设置"
                   aria-label="系统设置"
                 >
                   <Settings size={15} />
                 </button>

                 <div 
                   className="flex items-center gap-1 text-slate-400 cursor-help pl-0.5"
                   title={authToken ? "已连接 Cloudflare KV 云端数据库（数据已自动实时同步）" : "未登录，当前为本地离线模式"}
                 >
                   {syncStatus === 'saving' && <Loader2 className="animate-spin w-3 h-3 text-blue-500" />}
                   {syncStatus === 'saved' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                   {syncStatus === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                   {authToken ? <span className="text-green-600 dark:text-green-400 font-medium">已同步</span> : <span className="text-amber-500 dark:text-amber-400">离线</span>}
                 </div>
               </div>

               <a 
                 href={GITHUB_REPO_URL} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                 title={`fewk/CloudNav 开源仓库 (${APP_VERSION}${BUILD_TIME ? ` · 构建于 ${BUILD_TIME}` : ''})`}
               >
                 <Github size={14} />
                 <span>CloudNav {APP_VERSION}</span>
               </a>
            </div>
        </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-[#f4f5f7] dark:bg-[#0b1120] overflow-hidden relative">
        
        {/* Header */}
        <header className="h-16 px-4 lg:px-8 flex items-center justify-between bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 flex-1">
            {/* 移动端打开边栏按钮 */}
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="打开边栏"
            >
              <Menu size={20} />
            </button>

            {/* 桌面端展开边栏按钮：仅在边栏收起时显示，确保界面上始终只有一个开关图标 */}
            {isSidebarCollapsed && (
              <button
                onClick={handleToggleSidebar}
                className="hidden lg:flex items-center justify-center p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="展开边栏 (Ctrl+B)"
              >
                <PanelLeftOpen size={20} />
              </button>
            )}

            {/* Mini Brand: 移动端一直显示，桌面端在边栏收起时显示 */}
            <div className={`${isSidebarCollapsed ? 'flex' : 'lg:hidden flex'} items-center gap-2 select-none shrink-0`}>
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm overflow-hidden">
                {siteSettings.favicon ? (
                  <img src={siteSettings.favicon} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                ) : (
                  <Cloud size={15} className="fill-white/20 stroke-[2.2]" />
                )}
              </div>
              <span className="font-brand font-black text-[16px] tracking-tight flex items-baseline">
                <span className="text-slate-800 dark:text-white">Cloud</span>
                <span className="text-blue-500 ml-0.5">Nav</span>
              </span>
            </div>

            {/* 搜索模式切换 + 搜索框 (UISDC 风格) */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* 移动端搜索图标 - 仅在手机端显示 */}
              <button 
                onClick={() => {
                  setIsMobileSearchOpen(!isMobileSearchOpen);
                  if (searchMode !== 'external') {
                    handleSearchModeChange('external');
                  }
                }}
                className="sm:flex md:hidden lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                title="搜索"
              >
                <Search size={20} />
              </button>

              {/* 搜索引擎平铺 Tabs (UISDC 风格) */}
              <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-700/70 p-1 rounded-full text-xs shrink-0 border border-slate-200/50 dark:border-slate-600/50">
                <button
                  onClick={() => handleSwitchEngine('internal')}
                  className={`px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                    searchMode === 'internal'
                      ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="站内书签与标签搜索"
                >
                  <span>站内</span>
                </button>
                {externalSearchSources.filter(s => s.enabled).slice(0, 4).map((source) => {
                  const isCurrent = searchMode === 'external' && (
                    selectedSearchSource?.id === source.id ||
                    (!selectedSearchSource && externalSearchSources.filter(s => s.enabled)[0]?.id === source.id)
                  );
                  return (
                    <button
                      key={source.id || source.name}
                      onClick={() => handleSwitchEngine(source)}
                      className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 font-semibold shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <img
                        src={`https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=https://${new URL(source.url).hostname}`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-3.5 h-3.5"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                      <span>{source.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* 搜索框 (UISDC 现代高光胶囊) */}
              <div className={`relative flex-1 max-w-lg ${isMobileSearchOpen ? 'block' : 'hidden'} sm:block`}>
                <div className="flex items-center w-full bg-slate-100 dark:bg-slate-700/60 hover:bg-white dark:hover:bg-slate-700/90 focus-within:bg-white dark:focus-within:bg-slate-800 rounded-full border border-slate-200/60 dark:border-slate-600/50 focus-within:border-blue-500/70 dark:focus-within:border-blue-400 shadow-sm focus-within:shadow-md focus-within:ring-2 focus-within:ring-blue-500/20 transition-all pl-3.5 pr-2 py-1.5">
                  <div className="text-slate-400 shrink-0 mr-2 flex items-center">
                    {searchMode === 'internal' ? (
                      <Search size={15} />
                    ) : (selectedSearchSource || externalSearchSources.filter(s => s.enabled)[0]) ? (
                      <img 
                        src={`https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=https://${new URL((selectedSearchSource || externalSearchSources.filter(s => s.enabled)[0]).url).hostname}`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-4 h-4"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Search size={15} />
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder={
                      searchMode === 'internal' 
                        ? "搜索站内书签、标签或表情..." 
                        : selectedSearchSource 
                          ? `在 ${selectedSearchSource.name} 搜索内容...` 
                          : "搜索站外内容..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchMode === 'external') {
                        handleExternalSearch();
                      }
                    }}
                    className="w-full bg-transparent border-none text-sm dark:text-white placeholder-slate-400 outline-none"
                    style={{ fontSize: '14px' }}
                    inputMode="search"
                    enterKeyHint="search"
                  />

                  {searchQuery.trim() && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors mr-1.5 shrink-0"
                      title="清空"
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  )}

                  {searchMode === 'external' && searchQuery.trim() && (
                    <button
                      onClick={handleExternalSearch}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-medium flex items-center gap-1 transition-colors shrink-0 shadow-sm"
                      title="执行站外搜索"
                    >
                      <span>搜索</span>
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 视图切换控制器 - 移动端：搜索框展开时隐藏，桌面端始终显示 */}
            <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'} lg:flex items-center bg-slate-100 dark:bg-slate-700 rounded-full p-1`}>
              <button
                onClick={() => handleViewModeChange('simple')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  siteSettings.cardStyle === 'simple'
                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
                title="简约版视图"
              >
                简约
              </button>
              <button
                onClick={() => handleViewModeChange('detailed')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  siteSettings.cardStyle === 'detailed'
                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
                title="详情版视图"
              >
                详情
              </button>
            </div>

            {/* 主题切换按钮 - 移动端：搜索框展开时隐藏，桌面端始终显示 */}
            <button onClick={toggleTheme} className={`${isMobileSearchOpen ? 'hidden' : 'flex'} lg:flex p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700`}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* 登录/退出按钮 - 移动端：搜索框展开时隐藏，桌面端始终显示 */}
            <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'}`}>
              {!authToken ? (
                  <button onClick={() => setIsAuthOpen(true)} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-medium">
                      <Cloud size={14} /> <span className="hidden sm:inline">登录</span>
                  </button>
              ) : (
                  <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-medium">
                      <LogOut size={14} /> <span className="hidden sm:inline">退出</span>
                  </button>
              )}
            </div>

            {/* 添加按钮 - 移动端：搜索框展开时隐藏，桌面端始终显示 */}
            <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'}`}>
              <button
                onClick={() => { if(!authToken) setIsAuthOpen(true); else { setEditingLink(undefined); setIsModalOpen(true); }}}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-sm font-medium shadow-lg shadow-blue-500/30"
              >
                <Plus size={16} /> <span className="hidden sm:inline">添加</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div ref={contentScrollRef} onScroll={handleContentScroll} className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-10 scroll-smooth">
          
          {/* Hero 大搜索 Banner */}
          <div className="part-search relative overflow-hidden rounded-[10px] sm:rounded-2xl mb-[30px] bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 dark:from-slate-900/95 dark:via-slate-800/95 dark:to-slate-900/95 dark:border dark:border-slate-700/60 shadow-lg dark:shadow-2xl text-white flex justify-center items-center min-h-[280px] sm:min-h-[320px]">
            {/* 原来科技感波点网格背景 */}
            <div className="absolute inset-0 opacity-15 dark:opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

            {/* search-main 主搜索核心 */}
            <div className="search-main pt-[36px] sm:pt-[44px] pb-[36px] sm:pb-[48px] px-4 relative text-center w-full max-w-[760px] mx-auto z-10 flex flex-col justify-center">
              <h2 className="search-title text-[28px] sm:text-[42px] text-white whitespace-nowrap font-brand font-black tracking-tight mb-[20px] sm:mb-[32px] drop-shadow-sm select-none" style={{ lineHeight: '1.18' }}>
                {siteSettings.title && siteSettings.title.replace(' - 我的导航', '') !== 'CloudNav' ? (
                  siteSettings.title.replace(' - 我的导航', '')
                ) : (
                  <span className="inline-flex items-center">
                    <span>Cloud</span>
                    <span className="text-cyan-300 ml-1">Nav</span>
                    <span className="hidden sm:inline-block text-[12px] font-bold tracking-wider text-white/90 bg-white/20 dark:bg-slate-700/60 dark:text-slate-200 px-2.5 py-0.5 rounded-full ml-3 backdrop-blur-sm self-center align-middle font-sans">
                      云航 · 智能聚合
                    </span>
                  </span>
                )}
              </h2>

              <div className="s-form relative text-[14px] mb-[18px] sm:mb-[24px] w-full">
                {/* 选项卡 s-titles：以居中显示 */}
                <div className="s-titles flex items-end justify-center text-[14px] text-white whitespace-nowrap overflow-x-auto no-scrollbar">
                  <div className={`item ${searchMode === 'internal' ? 'current' : ''}`}>
                    <span
                      onClick={() => handleSwitchEngine('internal')}
                      className={`item-a block px-[18px] sm:px-[20px] rounded-t-[6px] cursor-pointer transition-colors ${
                        searchMode === 'internal'
                          ? 'bg-white text-[#000] dark:bg-slate-800 dark:text-blue-400 font-semibold'
                          : 'text-white/90 hover:text-white hover:bg-white/10 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/40'
                      }`}
                      style={{ height: '30px', lineHeight: '30px' }}
                    >
                      站内
                    </span>
                  </div>
                  {externalSearchSources.filter(s => s.enabled).slice(0, 5).map(source => {
                    const isCur = searchMode === 'external' && (
                      selectedSearchSource?.id === source.id ||
                      (!selectedSearchSource && externalSearchSources.filter(s => s.enabled)[0]?.id === source.id)
                    );
                    return (
                      <div key={source.id} className={`item ${isCur ? 'current' : ''}`}>
                        <span
                          onClick={() => handleSwitchEngine(source)}
                          className={`item-a block px-[18px] sm:px-[20px] rounded-t-[6px] cursor-pointer transition-colors ${
                            isCur
                              ? 'bg-white text-[#000] dark:bg-slate-800 dark:text-blue-400 font-semibold'
                              : 'text-white/90 hover:text-white hover:bg-white/10 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/40'
                          }`}
                          style={{ height: '30px', lineHeight: '30px' }}
                        >
                          {source.name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* 输入框与按钮 */}
                <div className="relative w-full">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleTriggerSearch();
                      }
                    }}
                    placeholder={
                      searchMode === 'internal'
                        ? '搜索站内书签、标签或直接输入网址...'
                        : `在 ${selectedSearchSource?.name || '百度'} 搜索内容...`
                    }
                    className="s block w-full bg-white dark:bg-slate-800 text-[#3c3c3c] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[14px] rounded-[6px] border border-transparent dark:border-slate-700/80 outline-none transition-shadow shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-black/40 focus:ring-2 focus:ring-blue-500/20"
                    style={{
                      padding: '14px 145px 14px 20px',
                      boxSizing: 'border-box'
                    }}
                  />
                  {searchQuery.trim() && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-[136px] top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:text-slate-300 dark:hover:text-white transition-colors"
                      title="清空"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  )}
                  <button
                    onClick={handleTriggerSearch}
                    className="s-btn absolute right-0 top-0 h-full text-white text-[14px] sm:text-[15px] font-medium border-none cursor-pointer rounded-r-[6px] transition-colors flex items-center justify-center bg-[#ff6000] hover:bg-[#e65600] dark:bg-orange-600 dark:hover:bg-orange-500"
                    style={{
                      width: '126px'
                    }}
                  >
                    <span>{submitButtonText}</span>
                  </button>
                </div>
              </div>

              {/* 热搜关键词 part-search-keywords：强制单行不折行 */}
              {topHotTags.length > 0 && (
                <div className="search-keywords part-search-keywords flex flex-nowrap whitespace-nowrap items-center justify-center gap-1.5 sm:gap-2 text-[12px] text-white overflow-x-auto no-scrollbar max-w-full" style={{ lineHeight: '2.5em' }}>
                  {topHotTags.slice(0, 8).map(tag => (
                    <span
                      key={tag}
                      onClick={() => {
                        setSearchMode('internal');
                        setSearchQuery(tag);
                      }}
                      className="item shrink-0 inline-block px-2.5 py-0.5 rounded cursor-pointer transition-all text-white hover:text-white bg-white/20 hover:bg-white/30 dark:bg-slate-800/90 dark:hover:bg-slate-700 dark:text-slate-200 dark:border dark:border-slate-700/60 whitespace-nowrap select-none"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 搜索视图：当用户输入搜索词时展示全局匹配结果 */}
          {searchQuery.trim() ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shrink-0"></div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    搜索结果
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-full border border-blue-100 dark:border-blue-800/40">
                    {displayedLinks.length}
                  </span>
                </div>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  清空搜索
                </button>
              </div>

              {displayedLinks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  <Search size={40} className="opacity-30 mb-4" />
                  <p className="text-sm">没有找到相关内容</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {displayedLinks.map(link => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      isDetailedView={isDetailedView}
                      showDescription={siteSettings.showDescription !== false}
                      showTags={siteSettings.showTags === true}
                      openTarget={siteSettings.openTarget}
                      isSelected={selectedLinks.has(link.id)}
                      isUnassignedHighlight={isSelectedCategoryParentWithChildren && link.categoryId === selectedCategory}
                      isBatchEditMode={isBatchEditMode}
                      onToggleSelection={toggleLinkSelection}
                      onContextMenu={handleContextMenu}
                      onEdit={handleOpenEditModal}
                      onTagClick={handleTagClick}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              {/* 热门推荐 / 置顶专区 (#pinned) */}
              {pinnedLinks.length > 0 && (
                <section id="pinned" className="scroll-mt-6 space-y-4 content-visibility-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shrink-0"></div>
                      <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        热门推荐
                      </h2>
                      <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-full border border-blue-100 dark:border-blue-800/40">
                        {pinnedLinks.length}
                      </span>
                    </div>
                    {isSortingPinned ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={savePinnedSorting}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-full transition-colors"
                          title="保存顺序"
                        >
                          <Save size={14} />
                          <span>保存顺序</span>
                        </button>
                        <button 
                          onClick={cancelPinnedSorting}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                          title="取消排序"
                        >
                          取消
                        </button>
                      </div>
                    ) : authToken ? (
                      <button 
                        onClick={() => setIsSortingPinned(true)}
                        className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
                        title="排序"
                      >
                        <GripVertical size={13} />
                        <span>排序</span>
                      </button>
                    ) : null}
                  </div>
                  {isSortingPinned ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCorners}
                      onDragEnd={handlePinnedDragEnd}
                    >
                      <SortableContext
                        items={pinnedLinks.map(link => link.id)}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                          {pinnedLinks.map(link => (
                            <SortableLinkCard key={link.id} link={link} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {pinnedLinks.map(link => (
                        <LinkCard
                          key={link.id}
                          link={link}
                          isDetailedView={isDetailedView}
                          showDescription={siteSettings.showDescription !== false}
                          showTags={siteSettings.showTags === true}
                          openTarget={siteSettings.openTarget}
                          isSelected={selectedLinks.has(link.id)}
                          isUnassignedHighlight={isSelectedCategoryParentWithChildren && link.categoryId === selectedCategory}
                          isBatchEditMode={isBatchEditMode}
                          onToggleSelection={toggleLinkSelection}
                          onContextMenu={handleContextMenu}
                          onEdit={handleOpenEditModal}
                          onTagClick={handleTagClick}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* 全景分类流：所有分类依次纵向排列展示 */}
              {categories.filter(c => !c.parentId).map(cat => {
                const subCats = categories.filter(c => c.parentId === cat.id);
                const isLocked = isCategoryLocked(cat.id);
                const catLinks = parentCategoryLinksMap.get(cat.id) || [];

                return (
                  <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-6 space-y-4 content-visibility-auto">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center flex-wrap gap-2.5">
                        <div className="w-1.5 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shrink-0"></div>
                        <div className="flex items-center gap-2">
                          <Icon name={cat.icon} size={18} className="text-blue-500 shrink-0" />
                          <h2 className="text-[17px] font-bold text-slate-800 dark:text-slate-100">
                            {cat.name}
                          </h2>
                          {isLocked && <Lock size={14} className="text-amber-500" />}
                        </div>
                        <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-full border border-blue-100 dark:border-blue-800/40">
                          {catLinks.length}
                        </span>

                        {/* 二级分类快速定位 */}
                        {subCats.length > 0 && (
                          <div className="flex items-center gap-2 ml-2 overflow-x-auto no-scrollbar py-0.5">
                            {subCats.map(sub => {
                              const isSubLocked = isCategoryLocked(sub.id);
                              const isSubActive = activeSection === `cat-${sub.id}`;
                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => {
                                    if (isSubLocked) {
                                      setCatAuthModalData(sub);
                                      return;
                                    }
                                    scrollToSection(`cat-${sub.id}`);
                                  }}
                                  className={`text-xs px-2.5 py-1 rounded-full border transition-all shadow-sm flex items-center gap-1.5 ${
                                    isSubActive
                                      ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 font-semibold shadow-blue-500/10'
                                      : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300'
                                  }`}
                                  title={`跳转到 ${sub.name}`}
                                >
                                  {isSubLocked ? (
                                    <Lock size={11} className="text-amber-500" />
                                  ) : (
                                    <Icon name={sub.icon} size={12} className={isSubActive ? 'text-blue-500' : 'text-slate-400'} />
                                  )}
                                  <span>{sub.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 排序按钮 */}
                      {authToken && !isLocked && (
                        <div className="flex items-center gap-2">
                          {isSortingMode === cat.id ? (
                            <div className="flex gap-2">
                              <button 
                                onClick={saveSorting}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-full transition-colors"
                                title="保存顺序"
                              >
                                <Save size={14} />
                                <span>保存顺序</span>
                              </button>
                              <button 
                                onClick={cancelSorting}
                                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                                title="取消排序"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => startSorting(cat.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
                              title="排序"
                            >
                              <GripVertical size={13} />
                              <span>排序</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isLocked ? (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        <Lock size={32} className="text-amber-400 mb-2" />
                        <p className="text-sm">该目录已加锁锁定</p>
                        <button onClick={() => setCatAuthModalData(cat)} className="mt-3 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium">输入密码解锁</button>
                      </div>
                    ) : catLinks.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700/60 rounded-xl text-xs">
                        暂无链接
                      </div>
                    ) : isSortingMode === cat.id ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={catLinks.map(link => link.id)}
                          strategy={rectSortingStrategy}
                        >
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {catLinks.map(link => (
                              <SortableLinkCard key={link.id} link={link} />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : subCats.length === 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {catLinks.map(link => (
                          <LinkCard
                            key={link.id}
                            link={link}
                            isDetailedView={isDetailedView}
                            showDescription={siteSettings.showDescription !== false}
                            showTags={siteSettings.showTags === true}
                            openTarget={siteSettings.openTarget}
                            isSelected={selectedLinks.has(link.id)}
                            isUnassignedHighlight={isSelectedCategoryParentWithChildren && link.categoryId === selectedCategory}
                            isBatchEditMode={isBatchEditMode}
                            onToggleSelection={toggleLinkSelection}
                            onContextMenu={handleContextMenu}
                            onEdit={handleOpenEditModal}
                            onTagClick={handleTagClick}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* 1. 一级分类直属链接 (若存在) */}
                        {(directCategoryLinksMap.get(cat.id)?.length || 0) > 0 && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                              {directCategoryLinksMap.get(cat.id)!.map(link => (
                                <LinkCard
                                  key={link.id}
                                  link={link}
                                  isDetailedView={isDetailedView}
                                  showDescription={siteSettings.showDescription !== false}
                                  showTags={siteSettings.showTags === true}
                                  openTarget={siteSettings.openTarget}
                                  isSelected={selectedLinks.has(link.id)}
                                  isUnassignedHighlight={isSelectedCategoryParentWithChildren && link.categoryId === selectedCategory}
                                  isBatchEditMode={isBatchEditMode}
                                  onToggleSelection={toggleLinkSelection}
                                  onContextMenu={handleContextMenu}
                                  onEdit={handleOpenEditModal}
                                  onTagClick={handleTagClick}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. 各二级分类独立锚点区域 */}
                        {subCats.map(sub => {
                          const isSubLocked = isCategoryLocked(sub.id);
                          const subLinks = directCategoryLinksMap.get(sub.id) || [];

                          return (
                            <div 
                              key={sub.id} 
                              id={`cat-${sub.id}`} 
                              className="scroll-mt-6 space-y-3 pt-2"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-3.5 bg-blue-500/70 dark:bg-blue-400 rounded-full shrink-0"></div>
                                <h3 className="text-[14px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                  <Icon name={sub.icon} size={15} className="text-blue-500/80 dark:text-blue-400" />
                                  <span>{sub.name}</span>
                                </h3>
                                {isSubLocked && <Lock size={12} className="text-amber-500" />}
                                <span className="text-[11px] px-1.5 py-0.5 font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                                  {subLinks.length}
                                </span>
                              </div>

                              {isSubLocked ? (
                                <div className="flex flex-col items-center justify-center py-6 text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                  <Lock size={24} className="text-amber-400 mb-1.5" />
                                  <p className="text-xs">该子分类已加锁保护</p>
                                  <button onClick={() => setCatAuthModalData(sub)} className="mt-2 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-medium">输入密码解锁</button>
                                </div>
                              ) : subLinks.length === 0 ? (
                                <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700/60 rounded-xl text-xs">
                                  暂无链接
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                  {subLinks.map(link => (
                                    <LinkCard
                                      key={link.id}
                                      link={link}
                                      isDetailedView={isDetailedView}
                                      showDescription={siteSettings.showDescription !== false}
                                      showTags={siteSettings.showTags === true}
                                      openTarget={siteSettings.openTarget}
                                      isSelected={selectedLinks.has(link.id)}
                                      isUnassignedHighlight={isSelectedCategoryParentWithChildren && link.categoryId === selectedCategory}
                                      isBatchEditMode={isBatchEditMode}
                                      onToggleSelection={toggleLinkSelection}
                                      onContextMenu={handleContextMenu}
                                      onEdit={handleOpenEditModal}
                                      onTagClick={handleTagClick}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </>
          )}
        </div>
      </main>

          <React.Suspense fallback={null}>
            {isModalOpen && (
              <LinkModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }}
                onSave={editingLink ? handleEditLink : handleAddLink}
                onDelete={editingLink ? handleDeleteLink : undefined}
                categories={categories}
                initialData={editingLink || (prefillLink as LinkItem)}
                aiConfig={aiConfig}
                defaultCategoryId={selectedCategory !== 'all' ? selectedCategory : undefined}
              />
            )}

            {/* 右键菜单 */}
            <ContextMenu
              isOpen={contextMenu.isOpen}
              position={contextMenu.position}
              onClose={closeContextMenu}
              onCopyLink={copyLinkToClipboard}
              onShowQRCode={showQRCode}
              onEditLink={editLinkFromContextMenu}
              onDeleteLink={deleteLinkFromContextMenu}
              onTogglePin={togglePinFromContextMenu}
              currentEmoji={contextMenu.link?.emoji}
              onSetEmoji={setEmojiFromContextMenu}
            />

            {/* 二维码模态框 */}
            {qrCodeModal.isOpen && (
              <QRCodeModal
                isOpen={qrCodeModal.isOpen}
                url={qrCodeModal.url || ''}
                title={qrCodeModal.title || ''}
                onClose={() => setQrCodeModal({ isOpen: false, url: '', title: '' })}
              />
            )}
          </React.Suspense>
        </>
      )}
    </div>
  );
}

export default App;

