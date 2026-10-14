import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Bot, Key, Globe, Sparkles, PauseCircle, Wrench, Box, Copy, Check, LayoutTemplate, RefreshCw, Info, Download, Sidebar, Keyboard, MousePointerClick, AlertTriangle, Package, Zap, Menu, ExternalLink, FileText, Tag, Search, Plus, Trash2, RotateCcw, FolderTree } from 'lucide-react';
import { AIConfig, LinkItem, Category, SiteSettings, ExternalSearchSource } from '../types';
import { generateLinkDescription } from '../services/geminiService';
import CategoryManagerView from './CategoryManagerView';
import { APP_VERSION } from '../version';
import JSZip from 'jszip';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  siteSettings: SiteSettings;
  onSave: (config: AIConfig, siteSettings: SiteSettings) => void;
  links: LinkItem[];
  categories: Category[];
  onUpdateLinks: (links: LinkItem[]) => void;
  authToken: string | null;
  externalSearchSources?: ExternalSearchSource[];
  onSaveSearchSources?: (sources: ExternalSearchSource[]) => void;
  onUpdateCategories?: (categories: Category[]) => void;
  onDeleteCategory?: (id: string, mode: 'migrate' | 'delete_all', targetId?: string) => void;
  onVerifyPassword?: (password: string) => Promise<boolean>;
}

const getRandomColor = () => {
    const h = Math.floor(Math.random() * 360);
    const s = 70 + Math.random() * 20;
    const l = 45 + Math.random() * 15;
    return `hsl(${h}, ${s}%, ${l}%)`;
};

const generateSvgIcon = (text: string, color1: string, color2: string) => {
    let char = '';
    if (text && text.length > 0) {
        char = text.charAt(0);
        if (/^[a-zA-Z]$/.test(char)) {
            char = '云';
        }
    } else {
        char = '云';
    }
    
    const gradientId = 'g_' + Math.random().toString(36).substr(2, 9);

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${color1}"/>
                <stop offset="100%" stop-color="${color2}"/>
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#${gradientId})" rx="16"/>
        <text x="50%" y="50%" dy=".35em" fill="white" font-family="Arial, sans-serif" font-weight="bold" font-size="32" text-anchor="middle">${char}</text>
    </svg>`.trim();

    try {
        const encoded = window.btoa(unescape(encodeURIComponent(svg)));
        return `data:image/svg+xml;base64,${encoded}`;
    } catch (e) {
        console.error("SVG Icon Generation Failed", e);
        return '';
    }
};

const getFaviconUrl = (urlStr: string) => {
    try {
        const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
        return `https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=https://${parsed.hostname}`;
    } catch {
        return '';
    }
};

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, config, siteSettings, onSave, links, categories, onUpdateLinks, authToken,
    externalSearchSources, onSaveSearchSources, onUpdateCategories, onDeleteCategory, onVerifyPassword
}) => {
  const [activeTab, setActiveTab] = useState<'site' | 'category' | 'search' | 'ai' | 'tools'>('site');
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  
  const [localSearchSources, setLocalSearchSources] = useState<ExternalSearchSource[]>(externalSearchSources || []);
  const [newSource, setNewSource] = useState<Partial<ExternalSearchSource>>({
    name: '',
    url: '',
    icon: 'Globe',
    enabled: true
  });

  useEffect(() => {
    if (externalSearchSources) {
      setLocalSearchSources(externalSearchSources);
    }
  }, [externalSearchSources, isOpen]);

  // ESC 键自动关闭窗口
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAddSource = () => {
    if (!newSource.name?.trim() || !newSource.url?.trim()) return;
    const source: ExternalSearchSource = {
      id: Date.now().toString(),
      name: newSource.name.trim(),
      url: newSource.url.trim(),
      icon: newSource.icon || 'Globe',
      enabled: newSource.enabled !== false,
      createdAt: Date.now()
    };
    const updated = [...localSearchSources, source];
    setLocalSearchSources(updated);
    if (onSaveSearchSources) onSaveSearchSources(updated);
    setNewSource({ name: '', url: '', icon: 'Globe', enabled: true });
  };

  const handleToggleSourceEnabled = (id: string) => {
    const updated = localSearchSources.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setLocalSearchSources(updated);
    if (onSaveSearchSources) onSaveSearchSources(updated);
  };

  const handleDeleteSource = (id: string) => {
    const updated = localSearchSources.filter(s => s.id !== id);
    setLocalSearchSources(updated);
    if (onSaveSearchSources) onSaveSearchSources(updated);
  };

  const handleResetSources = () => {
    const defaultSources: ExternalSearchSource[] = [
      { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={query}', icon: 'Globe', enabled: true, createdAt: 1 },
      { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={query}', icon: 'Search', enabled: true, createdAt: 2 },
      { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q={query}', icon: 'Search', enabled: true, createdAt: 3 },
      { id: 'github', name: 'GitHub', url: 'https://github.com/search?q={query}', icon: 'Github', enabled: true, createdAt: 4 },
      { id: 'bilibili', name: 'B站', url: 'https://search.bilibili.com/all?keyword={query}', icon: 'Play', enabled: true, createdAt: 5 },
    ];
    setLocalSearchSources(defaultSources);
    if (onSaveSearchSources) onSaveSearchSources(defaultSources);
  };
  
  const [localSiteSettings, setLocalSiteSettings] = useState<SiteSettings>(() => ({
      title: siteSettings?.title || 'CloudNav - 我的导航',
      navTitle: siteSettings?.navTitle || 'CloudNav',
      favicon: siteSettings?.favicon || '',
      cardStyle: siteSettings?.cardStyle || 'detailed',
      passwordExpiryDays: siteSettings?.passwordExpiryDays ?? 7,
      openTarget: siteSettings?.openTarget || '_blank'
  }));
  
  const [generatedIcons, setGeneratedIcons] = useState<string[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const shouldStopRef = useRef(false);

  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [browserType, setBrowserType] = useState<'chrome' | 'firefox'>('chrome');
  const [isZipping, setIsZipping] = useState(false);
  
  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({});

  const updateGeneratedIcons = (text: string) => {
      const newIcons: string[] = [];
      for (let i = 0; i < 6; i++) {
          const c1 = getRandomColor();
          const h2 = (parseInt(c1.split(',')[0].split('(')[1]) + 30 + Math.random() * 30) % 360;
          const c2 = `hsl(${h2}, 70%, 50%)`;
          newIcons.push(generateSvgIcon(text, c1, c2));
      }
      setGeneratedIcons(newIcons);
  };

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      const safeSettings: SiteSettings = {
          title: siteSettings?.title || 'CloudNav - 我的导航',
          navTitle: siteSettings?.navTitle || 'CloudNav',
          favicon: siteSettings?.favicon || '',
          cardStyle: siteSettings?.cardStyle || 'detailed',
          passwordExpiryDays: siteSettings?.passwordExpiryDays !== undefined ? siteSettings.passwordExpiryDays : 7,
          openTarget: siteSettings?.openTarget || '_blank',
          showDescription: siteSettings?.showDescription !== undefined ? siteSettings.showDescription : true,
          showTags: siteSettings?.showTags !== undefined ? siteSettings.showTags : false
      };
      setLocalSiteSettings(safeSettings);
      if (generatedIcons.length === 0) {
          updateGeneratedIcons(safeSettings.navTitle);
      }

      setIsProcessing(false);
      setIsZipping(false);
      setProgress({ current: 0, total: 0 });
      shouldStopRef.current = false;
      setDomain(window.location.origin);
      const storedToken = localStorage.getItem('cloudnav_auth_token');
      if (storedToken) setPassword(storedToken);
    }
  }, [isOpen, config, siteSettings]);

  const handleChange = (key: keyof AIConfig, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSiteChange = async (key: keyof SiteSettings, value: any) => {
    setLocalSiteSettings(prev => {
        const next = { ...prev, [key]: value };
        
        // 如果是身份验证过期天数、打开方式、介绍或标签显示修改，立即保存到 KV 空间
        if ((key === 'passwordExpiryDays' || key === 'openTarget' || key === 'showDescription' || key === 'showTags') && authToken) {
            saveWebsiteConfigToKV(next);
        }
        
        return next;
    });
  };

  // 保存网站配置到 KV 空间
  const saveWebsiteConfigToKV = async (siteSettings: SiteSettings) => {
    try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': authToken || ''
            },
            body: JSON.stringify({
                saveConfig: 'website',
                config: siteSettings
            })
        });
        
        if (!response.ok) {
            console.error('Failed to save website config to KV:', response.statusText);
        }
    } catch (error) {
        console.error('Error saving website config to KV:', error);
    }
  };

  const handleSave = () => {
    onSave(localConfig, localSiteSettings);
    saveWebsiteConfigToKV(localSiteSettings);
    onClose();
  };

  const handleBulkGenerate = async () => {
    if (!localConfig.apiKey) {
        alert("请先配置并保存 API Key");
        return;
    }

    const missingLinks = links.filter(l => !l.description);
    if (missingLinks.length === 0) {
        alert("所有链接都已有描述！");
        return;
    }

    if (!confirm(`发现 ${missingLinks.length} 个链接缺少描述，确定要使用 AI 自动生成吗？这可能需要一些时间。`)) return;

    setIsProcessing(true);
    shouldStopRef.current = false;
    setProgress({ current: 0, total: missingLinks.length });
    
    let currentLinks = [...links];

    for (let i = 0; i < missingLinks.length; i++) {
        if (shouldStopRef.current) break;

        const link = missingLinks[i];
        try {
            const desc = await generateLinkDescription(link.title, link.url, localConfig);
            currentLinks = currentLinks.map(l => l.id === link.id ? { ...l, description: desc } : l);
            onUpdateLinks(currentLinks);
            setProgress({ current: i + 1, total: missingLinks.length });
        } catch (e) {
            console.error(`Failed to generate for ${link.title}`, e);
        }
    }

    setIsProcessing(false);
  };

  const handleCopy = (text: string, key: string) => {
      navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
  };

  const handleDownloadFile = (filename: string, content: string) => {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const getManifestJson = () => {
    const json: any = {
        manifest_version: 3,
        name: (localSiteSettings.navTitle || "CloudNav") + " Pro",
        version: "7.6",
        minimum_chrome_version: "116",
        description: "CloudNav - 极速侧边栏与智能收藏",
        permissions: ["activeTab", "scripting", "sidePanel", "storage", "favicon", "contextMenus", "notifications", "tabs"],
        background: {
            service_worker: "background.js"
        },
        action: {
            default_title: "打开侧边栏 (Ctrl+Shift+E)"
        },
        side_panel: {
            default_path: "sidebar.html"
        },
        icons: {
            "128": "icon.png"
        },
        commands: {
          "_execute_action": {
            "suggested_key": {
              "default": "Ctrl+Shift+E",
              "mac": "Command+Shift+E"
            },
            "description": "打开/关闭 CloudNav 侧边栏"
          }
        }
    };
    
    if (browserType === 'firefox') {
        json.browser_specific_settings = {
            gecko: {
                id: "cloudnav@example.com",
                strict_min_version: "109.0"
            }
        };
    }
    
    return JSON.stringify(json, null, 2);
  };

  const extBackgroundJs = `// background.js - CloudNav Assistant v7.6
const CONFIG = {
  apiBase: "${domain}",
  password: "${password}"
};

let linkCache = [];
let categoryCache = [];

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  refreshCache().then(buildMenus);
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.cloudnav_data) {
        refreshCache().then(buildMenus);
    }
});

async function refreshCache() {
    const data = await chrome.storage.local.get('cloudnav_data');
    if (data && data.cloudnav_data) {
        linkCache = data.cloudnav_data.links || [];
        categoryCache = data.cloudnav_data.categories || [];
    }
    return;
}

const windowPorts = {};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'cloudnav_sidebar') return;
  port.onMessage.addListener((msg) => {
    if (msg.type === 'init' && msg.windowId) {
      windowPorts[msg.windowId] = port;
      port.onDisconnect.addListener(() => {
        if (windowPorts[msg.windowId] === port) {
          delete windowPorts[msg.windowId];
        }
      });
    }
  });
});

chrome.action.onClicked.addListener(async (tab) => {
    const windowId = tab.windowId;
    const existingPort = windowPorts[windowId];

    if (existingPort) {
        try {
            existingPort.postMessage({ action: 'close_panel' });
        } catch (e) {
            delete windowPorts[windowId];
            chrome.sidePanel.open({ windowId });
        }
    } else {
        try {
            await chrome.sidePanel.open({ windowId: windowId });
        } catch (e) {
            console.error('Failed to open sidebar', e);
        }
    }
});

function buildMenus() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "cloudnav_root",
            title: "⚡ 保存到 CloudNav",
            contexts: ["page", "link", "action"]
        });

        if (categoryCache.length > 0) {
            const parents = categoryCache.filter(c => !c.parentId);
            parents.forEach(cat => {
                const subCats = categoryCache.filter(c => c.parentId === cat.id);
                
                if (subCats.length > 0) {
                    // 有二级分类，创建父级菜单
                    chrome.contextMenus.create({
                        id: \`parent_\${cat.id}\`,
                        parentId: "cloudnav_root",
                        title: cat.name,
                        contexts: ["page", "link", "action"]
                    });

                    // 在父级菜单下添加“保存到 [当前分类]”选项
                    chrome.contextMenus.create({
                        id: \`save_to_\${cat.id}\`,
                        parentId: \`parent_\${cat.id}\`,
                        title: \`保存到 \${cat.name}\`,
                        contexts: ["page", "link", "action"]
                    });

                    // 添加分隔符
                    chrome.contextMenus.create({
                        id: \`sep_\${cat.id}\`,
                        parentId: \`parent_\${cat.id}\`,
                        type: "separator",
                        contexts: ["page", "link", "action"]
                    });

                    // 添加二级分类
                    subCats.forEach(sub => {
                        chrome.contextMenus.create({
                            id: \`save_to_\${sub.id}\`,
                            parentId: \`parent_\${cat.id}\`,
                            title: sub.name,
                            contexts: ["page", "link", "action"]
                        });
                    });
                } else {
                    // 没有二级分类，直接显示
                    chrome.contextMenus.create({
                        id: \`save_to_\${cat.id}\`,
                        parentId: "cloudnav_root",
                        title: cat.name,
                        contexts: ["page", "link", "action"]
                    });
                }
            });
        } else {
            chrome.contextMenus.create({
                id: "save_to_common",
                parentId: "cloudnav_root",
                title: "默认分类",
                contexts: ["page", "link", "action"]
            });
        }
    });
}

function updateMenuTitle(url) {
    if (!url) return;
    const cleanUrl = url.replace(/\\/$/, '').toLowerCase();
    const exists = linkCache.some(l => l.url && l.url.replace(/\\/$/, '').toLowerCase() === cleanUrl);
    const newTitle = exists ? "⚠️ 已存在 - 保存到 CloudNav" : "⚡ 保存到 CloudNav";
    chrome.contextMenus.update("cloudnav_root", { title: newTitle }, () => {
        if (chrome.runtime.lastError) { }
    });
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
   try {
       const tab = await chrome.tabs.get(activeInfo.tabId);
       if (tab && tab.url) updateMenuTitle(tab.url);
   } catch(e){}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
   if (changeInfo.status === 'complete' && tab.active && tab.url) {
       updateMenuTitle(tab.url);
   }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (String(info.menuItemId).startsWith("save_to_")) {
        const catId = String(info.menuItemId).replace("save_to_", "");
        const title = tab.title;
        const url = info.linkUrl || tab.url;
        const cleanUrl = url.replace(/\\/$/, '').toLowerCase();
        const exists = linkCache.some(l => l.url.replace(/\\/$/, '').toLowerCase() === cleanUrl);
        saveLink(title, url, catId);
    }
});

async function saveLink(title, url, categoryId, icon = '') {
    if (!CONFIG.password) {
        notify('保存失败', '未配置密码，请先在侧边栏登录。');
        return;
    }

    if (!icon) {
        try {
            const u = new URL(url);
            icon = \`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=\${encodeURIComponent(u.origin)}&size=128\`;
        } catch(e){}
    }

    try {
        const res = await fetch(\`\${CONFIG.apiBase}/api/link\`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-auth-password': CONFIG.password
            },
            body: JSON.stringify({
                title: title || '未命名',
                url: url,
                categoryId: categoryId,
                icon: icon
            })
        });

        if (res.ok) {
            notify('保存成功', \`已保存到 CloudNav\`);
            chrome.runtime.sendMessage({ type: 'refresh' }).catch(() => {});
            const newLink = { id: Date.now().toString(), title, url, categoryId, icon };
            linkCache.unshift(newLink);
            updateMenuTitle(url);
        } else {
            notify('保存失败', \`服务器错误: \${res.status}\`);
        }
    } catch (e) {
        notify('保存失败', '网络请求错误');
    }
}

function notify(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: title,
        message: message,
        priority: 1
    });
}
`;

  const extSidebarHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        :root {
            --bg: #ffffff;
            --text: #1e293b;
            --border: #e2e8f0;
            --hover: #f1f5f9;
            --accent: #3b82f6;
            --muted: #64748b;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0f172a;
                --text: #f1f5f9;
                --border: #334155;
                --hover: #1e293b;
                --accent: #60a5fa;
                --muted: #94a3b8;
            }
        }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding-bottom: 20px; width: 100%; box-sizing: border-box; }
        
        .header { position: sticky; top: 0; padding: 10px 12px; background: var(--bg); border-bottom: 1px solid var(--border); z-index: 10; display: flex; gap: 8px; }
        .search-input { flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--hover); color: var(--text); outline: none; box-sizing: border-box; font-size: 13px; }
        .search-input:focus { border-color: var(--accent); }
        
        .refresh-btn { width: 30px; display: flex; items-center; justify-content: center; border: 1px solid var(--border); background: var(--hover); border-radius: 6px; color: var(--muted); cursor: pointer; transition: all 0.2s; }
        .refresh-btn:hover { color: var(--accent); border-color: var(--accent); }
        .refresh-btn:active { transform: scale(0.95); }
        .rotating { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .content { padding: 4px; }
        .cat-group { margin-bottom: 2px; }
        .cat-header { 
            padding: 8px 10px; font-size: 13px; font-weight: 600; color: var(--text); 
            cursor: pointer; display: flex; items-center; gap: 8px; border-radius: 6px;
            user-select: none; transition: background 0.1s;
        }
        .cat-header:hover { background: var(--hover); }
        .cat-arrow { width: 14px; height: 14px; color: var(--muted); transition: transform 0.2s; }
        .cat-header.active .cat-arrow { transform: rotate(90deg); color: var(--accent); }
        
        .cat-header .lock-icon { width: 14px; height: 14px; color: #f59e0b; margin-left: auto; }

        .cat-links { display: none; padding-left: 8px; margin-bottom: 8px; }
        .cat-header.active + .cat-links { display: block; }
        
        .sub-cat-group { margin-top: 8px; margin-bottom: 4px; }
        .sub-cat-title { 
            padding: 4px 8px; font-size: 11px; font-weight: 700; color: var(--muted); 
            text-transform: uppercase; letter-spacing: 0.05em; display: flex; items-center; gap: 4px;
        }
        .sub-cat-title::before { content: ""; width: 4px; height: 4px; background: var(--accent); border-radius: 50%; opacity: 0.5; }

        .link-item { display: flex; items-center; gap: 8px; padding: 6px 8px; border-radius: 6px; text-decoration: none; color: var(--text); transition: background 0.1s; border-left: 2px solid transparent; }
        .link-item:hover { background: var(--hover); border-left-color: var(--accent); }
        .link-icon { width: 16px; height: 16px; flex-shrink: 0; display: flex; items-center; justify-content: center; overflow: hidden; }
        .link-icon img { width: 100%; height: 100%; object-fit: contain; }
        .link-info { min-width: 0; flex: 1; }
        .link-title { font-size: 13px; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
        
        .empty { text-align: center; padding: 20px; color: var(--muted); font-size: 12px; }
        .loading { display: flex; justify-content: center; padding: 40px; color: var(--accent); font-size: 12px; }

        /* 密码验证模态框样式 */
        .modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5); 
            display: none; items-center; justify-content: center; z-index: 100;
            backdrop-blur: 2px;
        }
        .modal-overlay.show { display: flex; }
        .modal-content {
            background: var(--bg); padding: 20px; border-radius: 12px;
            width: 240px; border: 1px solid var(--border); box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .modal-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; text-align: center; }
        .modal-input {
            width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border);
            background: var(--hover); color: var(--text); margin-bottom: 12px; box-sizing: border-box;
            outline: none; text-align: center;
        }
        .modal-input:focus { border-color: var(--accent); }
        .modal-btns { display: flex; gap: 8px; }
        .modal-btn {
            flex: 1; padding: 8px; border-radius: 6px; border: none; font-size: 13px; cursor: pointer;
        }
        .modal-btn-confirm { background: var(--accent); color: white; }
        .modal-btn-cancel { background: var(--hover); color: var(--text); }
    </style>
</head>
<body>
    <div class="header">
        <input type="text" id="search" class="search-input" placeholder="搜索..." autocomplete="off">
        <button id="refresh" class="refresh-btn" title="同步最新数据">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        </button>
    </div>
    <div id="content" class="content">
        <div class="loading">初始化...</div>
    </div>

    <div id="auth-modal" class="modal-overlay">
        <div class="modal-content">
            <div id="auth-title" class="modal-title">请输入密码</div>
            <input type="password" id="auth-input" class="modal-input" placeholder="密码">
            <div class="modal-btns">
                <button id="auth-cancel" class="modal-btn modal-btn-cancel">取消</button>
                <button id="auth-confirm" class="modal-btn modal-btn-confirm">确定</button>
            </div>
        </div>
    </div>

    <script src="sidebar.js"></script>
</body>
</html>`;

  const extSidebarJs = `const CONFIG = {
  apiBase: "${domain}",
  password: "${password}"
};
const CACHE_KEY = 'cloudnav_data';

let port = null;
try {
    port = chrome.runtime.connect({ name: 'cloudnav_sidebar' });
    chrome.windows.getCurrent((win) => {
        if (win && port) {
            port.postMessage({ type: 'init', windowId: win.id });
        }
    });

    port.onMessage.addListener((msg) => {
        if (msg.action === 'close_panel') {
            window.close();
        }
    });
} catch(e) {
    console.error('Connection failed', e);
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('content');
    const searchInput = document.getElementById('search');
    const refreshBtn = document.getElementById('refresh');
    
    // 密码模态框元素
    const authModal = document.getElementById('auth-modal');
    const authTitle = document.getElementById('auth-title');
    const authInput = document.getElementById('auth-input');
    const authCancel = document.getElementById('auth-cancel');
    const authConfirm = document.getElementById('auth-confirm');
    
    let allLinks = [];
    let allCategories = [];
    let expandedCats = new Set(); 
    let unlockedCategoryIds = new Set();
    let currentAuthCat = null;

    const getArrowIcon = () => {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cat-arrow"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    };

    const getLockIcon = () => {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lock-icon"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
    };

    const isCategoryLocked = (catId) => {
        const cat = allCategories.find(c => c.id === catId);
        if (!cat) return false;
        if (cat.password && !unlockedCategoryIds.has(catId)) return true;
        if (cat.parentId) return isCategoryLocked(cat.parentId);
        return false;
    };

    const getLockedAncestor = (cat) => {
        if (cat.password && !unlockedCategoryIds.has(cat.id)) return cat;
        if (cat.parentId) {
            const parent = allCategories.find(c => c.id === cat.parentId);
            if (parent) return getLockedAncestor(parent);
        }
        return null;
    };

    const showAuthModal = (cat) => {
        currentAuthCat = cat;
        authTitle.textContent = \`解锁 "\${cat.name}"\`;
        authInput.value = '';
        authModal.classList.add('show');
        authInput.focus();
    };

    const hideAuthModal = () => {
        authModal.classList.remove('show');
        currentAuthCat = null;
    };

    authCancel.onclick = hideAuthModal;
    authConfirm.onclick = () => {
        if (currentAuthCat && authInput.value === currentAuthCat.password) {
            unlockedCategoryIds.add(currentAuthCat.id);
            const idToExpand = currentAuthCat.id;
            hideAuthModal();
            render(searchInput.value);
            // 如果解锁的是父分类，尝试展开它
            if (!currentAuthCat.parentId) {
                toggleCat(idToExpand, true);
            }
        } else {
            alert('密码错误');
            authInput.value = '';
            authInput.focus();
        }
    };

    authInput.onkeydown = (e) => {
        if (e.key === 'Enter') authConfirm.onclick();
        if (e.key === 'Escape') hideAuthModal();
    };

    const getFaviconUrl = (pageUrl) => {
        try {
            const url = new URL(chrome.runtime.getURL("/_favicon/"));
            url.searchParams.set("pageUrl", pageUrl);
            url.searchParams.set("size", "32");
            return url.toString();
        } catch (e) {
            return '';
        }
    };

    const toggleCat = (id, forceOpen = false) => {
        const header = document.querySelector(\`.cat-header[data-id="\${id}"]\`);
        if (header) {
            if (forceOpen) {
                header.classList.add('active');
                expandedCats.add(id);
            } else {
                header.classList.toggle('active');
                if (header.classList.contains('active')) {
                    expandedCats.add(id);
                } else {
                    expandedCats.delete(id);
                }
            }
        }
    };

    container.addEventListener('click', (e) => {
        const header = e.target.closest('.cat-header');
        if (header) {
            const catId = header.dataset.id;
            const cat = allCategories.find(c => c.id === catId);
            if (cat) {
                const lockedAncestor = getLockedAncestor(cat);
                if (lockedAncestor) {
                    showAuthModal(lockedAncestor);
                    return;
                }
            }
            toggleCat(catId);
        }

        const linkItem = e.target.closest('.link-item');
        if (linkItem) {
            // 链接点击时也可以增加一层校验，虽然渲染时已经过滤了，但为了安全
            const url = linkItem.getAttribute('href');
            const link = allLinks.find(l => l.url === url);
            if (link && isCategoryLocked(link.categoryId)) {
                e.preventDefault();
                const cat = allCategories.find(c => c.id === link.categoryId);
                const lockedAncestor = getLockedAncestor(cat);
                if (lockedAncestor) showAuthModal(lockedAncestor);
            }
        }
    });

    const render = (filter = '') => {
        const q = filter.toLowerCase();
        let html = '';
        let hasContent = false;
        
        const isSearching = q.length > 0;

        const parents = allCategories.filter(c => !c.parentId);

        parents.forEach(cat => {
            const subCats = allCategories.filter(sc => sc.parentId === cat.id);
            const directLinks = allLinks.filter(l => l.categoryId === cat.id);
            
            const isLocked = isCategoryLocked(cat.id);
            
            const matchesQuery = (l) => !q || 
                                       l.title.toLowerCase().includes(q) || 
                                       l.url.toLowerCase().includes(q) || 
                                       (l.description && l.description.toLowerCase().includes(q));

            const filteredDirectLinks = isLocked ? [] : directLinks.filter(matchesQuery);
            const subCatResults = isLocked ? [] : subCats.map(sc => ({
                ...sc,
                links: allLinks.filter(l => l.categoryId === sc.id).filter(matchesQuery)
            })).filter(res => res.links.length > 0);

            if (!isLocked && filteredDirectLinks.length === 0 && subCatResults.length === 0) return;
            hasContent = true;

            const isOpen = expandedCats.has(cat.id) || isSearching;
            const activeClass = isOpen ? 'active' : '';

            html += \`
            <div class="cat-group">
                <div class="cat-header \${activeClass}" data-id="\${cat.id}">
                    \${getArrowIcon()}
                    <span>\${cat.name}</span>
                    \${isLocked ? getLockIcon() : ''}
                </div>
                <div class="cat-links">
            \`;
            
            // 渲染直接属于父分类的链接
            filteredDirectLinks.forEach(link => {
                const iconSrc = getFaviconUrl(link.url);
                html += \`
                    <a href="\${link.url}" target="_blank" class="link-item">
                        <div class="link-icon"><img src="\${iconSrc}" /></div>
                        <div class="link-info">
                            <div class="link-title">\${link.title}</div>
                        </div>
                    </a>
                \`;
            });

            // 渲染二级分类及其链接
            subCatResults.forEach(sub => {
                const isSubLocked = isCategoryLocked(sub.id);
                html += \`
                    <div class="sub-cat-group">
                        <div class="sub-cat-title" style="display: flex; align-items: center; justify-content: space-between;">
                            <span>\${sub.name}</span>
                            \${isSubLocked ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#f59e0b;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' : ''}
                        </div>
                        \${isSubLocked ? '' : sub.links.map(link => {
                            const iconSrc = getFaviconUrl(link.url);
                            return \`
                                <a href="\${link.url}" target="_blank" class="link-item" style="margin-left: 8px;">
                                    <div class="link-icon"><img src="\${iconSrc}" /></div>
                                    <div class="link-info">
                                        <div class="link-title">\${link.title}</div>
                                    </div>
                                </a>
                            \`;
                        }).join('')}
                    </div>
                \`;
            });

            html += \`</div></div>\`;
        });

        if (!hasContent) {
            container.innerHTML = filter ? '<div class="empty">无搜索结果</div>' : '<div class="empty">暂无数据</div>';
        } else {
            container.innerHTML = html;
        }
    };

    const loadData = async (forceRefresh = false) => {
        try {
            if (!forceRefresh) {
                const cached = await chrome.storage.local.get(CACHE_KEY);
                if (cached[CACHE_KEY]) {
                    const data = cached[CACHE_KEY];
                    allLinks = data.links || [];
                    allCategories = data.categories || [];
                    render(searchInput.value);
                    return;
                }
            }

            refreshBtn.classList.add('rotating');
            container.innerHTML = '<div class="loading">同步数据中...</div>';
            
            const res = await fetch(\`\${CONFIG.apiBase}/api/storage\`, {
                headers: { 'x-auth-password': CONFIG.password }
            });
            
            if (!res.ok) throw new Error("Sync failed");
            
            const data = await res.json();
            allLinks = data.links || [];
            allCategories = data.categories || [];
            
            await chrome.storage.local.set({ [CACHE_KEY]: data });
            
            render(searchInput.value);
        } catch (e) {
            container.innerHTML = \`<div class="empty" style="color:#ef4444">加载失败: \${e.message}<br>请点击右上角刷新</div>\`;
        } finally {
            refreshBtn.classList.remove('rotating');
        }
    };

    loadData();

    searchInput.addEventListener('input', (e) => render(e.target.value));
    refreshBtn.addEventListener('click', () => loadData(true));

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'refresh') {
            loadData(true);
        }
    });
});`;

  const renderCodeBlock = (filename: string, code: string) => (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">{filename}</span>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => handleDownloadFile(filename, code)}
                    className="text-xs flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                    title="下载文件"
                >
                    <Download size={12}/>
                    Download
                </button>
                <div className="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
                <button 
                    onClick={() => handleCopy(code, filename)}
                    className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                    {copiedStates[filename] ? <Check size={12}/> : <Copy size={12}/>}
                    {copiedStates[filename] ? 'Copied' : 'Copy'}
                </button>
            </div>
        </div>
        <div className="bg-slate-900 p-3 overflow-x-auto">
            <pre className="text-[10px] md:text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
                {code}
            </pre>
        </div>
    </div>
  );

  const generateIconBlob = async (): Promise<Blob | null> => {
     const iconUrl = localSiteSettings.favicon;
     if (!iconUrl) return null;

     try {
         const img = new Image();
         img.crossOrigin = "anonymous";
         img.src = iconUrl;

         await new Promise((resolve, reject) => {
             img.onload = resolve;
             img.onerror = reject;
         });

         const canvas = document.createElement('canvas');
         canvas.width = 128;
         canvas.height = 128;
         const ctx = canvas.getContext('2d');
         if (!ctx) throw new Error('Canvas error');

         ctx.drawImage(img, 0, 0, 128, 128);

         return new Promise((resolve) => {
             canvas.toBlob((blob) => {
                 resolve(blob);
             }, 'image/png');
         });
     } catch (e) {
         console.error(e);
         return null;
     }
  };

  const handleDownloadIcon = async () => {
    const blob = await generateIconBlob();
    if (!blob) {
        alert("生成图片失败 (可能是跨域限制)。\n\n请尝试右键点击下方的预览图片，选择 '图片另存为...' 保存。");
        return;
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "icon.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
        const zip = new JSZip();
        
        zip.file("manifest.json", getManifestJson());
        zip.file("background.js", extBackgroundJs);
        zip.file("sidebar.html", extSidebarHtml);
        zip.file("sidebar.js", extSidebarJs);
        
        const iconBlob = await generateIconBlob();
        if (iconBlob) {
            zip.file("icon.png", iconBlob);
        } else {
            console.warn("Could not generate icon for zip");
            zip.file("icon_missing.txt", "Icon generation failed due to CORS. Please save the icon manually.");
        }

        const content = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "CloudNav-Ext.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch(e) {
        console.error(e);
        alert("打包下载失败");
    } finally {
        setIsZipping(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'site', label: '网站设置', icon: LayoutTemplate },
    { id: 'category', label: '分类管理', icon: FolderTree },
    { id: 'search', label: '搜索引擎', icon: Search },
    { id: 'ai', label: 'AI 设置', icon: Bot },
    { id: 'tools', label: '扩展工具', icon: Wrench },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl md:w-[880px] h-[660px] max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="w-full md:w-48 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 flex flex-row md:flex-col p-2 gap-1 overflow-x-auto md:overflow-y-auto shrink-0 md:h-full">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        activeTab === tab.id 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                    <tab.icon size={18} />
                    {tab.label}
                </button>
            ))}
        </div>

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white dark:bg-slate-800">
             <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2">
                    设置 
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-normal font-mono">
                        {APP_VERSION}
                    </span>
                </h3>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <X className="w-5 h-5 dark:text-slate-400" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 pb-12">
                
                {activeTab === 'site' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">网页标题 (Title)</label>
                                <input 
                                    type="text" 
                                    value={localSiteSettings.title}
                                    onChange={(e) => handleSiteChange('title', e.target.value)}
                                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">导航栏标题</label>
                                <input 
                                    type="text" 
                                    value={localSiteSettings.navTitle}
                                    onChange={(e) => handleSiteChange('navTitle', e.target.value)}
                                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">网站图标 (Favicon URL)</label>
                                <div className="flex gap-3 items-center">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                                        {localSiteSettings.favicon ? <img src={localSiteSettings.favicon} className="w-full h-full object-cover"/> : <Globe size={20} className="text-slate-400"/>}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={localSiteSettings.favicon}
                                        onChange={(e) => handleSiteChange('favicon', e.target.value)}
                                        placeholder="https://example.com/favicon.ico"
                                        className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="mt-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs text-slate-500">选择生成的随机图标 (点击右侧按钮刷新):</p>
                                        <button 
                                            type="button"
                                            onClick={() => updateGeneratedIcons(localSiteSettings.navTitle)}
                                            className="text-xs flex items-center gap-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                                        >
                                            <RefreshCw size={12} /> 随机生成
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        {generatedIcons.map((icon, idx) => (
                                            <button 
                                                key={idx}
                                                onClick={() => handleSiteChange('favicon', icon)}
                                                className="w-8 h-8 rounded hover:ring-2 ring-blue-500 transition-all border border-slate-100 dark:border-slate-600"
                                            >
                                                <img src={icon} className="w-full h-full rounded" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {/* 链接打开方式 */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    链接打开方式
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleSiteChange('openTarget', '_blank')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                                            (localSiteSettings.openTarget || '_blank') === '_blank'
                                                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800'
                                        }`}
                                    >
                                        <ExternalLink size={16} />
                                        <span>新页面打开</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSiteChange('openTarget', '_self')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                                            localSiteSettings.openTarget === '_self'
                                                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800'
                                        }`}
                                    >
                                        <Globe size={16} />
                                        <span>当前页面打开</span>
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {(localSiteSettings.openTarget || '_blank') === '_blank' 
                                        ? '点击书签卡片时，在新的浏览器标签页中打开站点' 
                                        : '点击书签卡片时，直接在当前标签页中跳转'}
                                </p>
                            </div>

                            {/* 卡片内容显示 */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    卡片内容显示
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div 
                                        onClick={() => handleSiteChange('showDescription', localSiteSettings.showDescription === false ? true : false)}
                                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                            localSiteSettings.showDescription !== false
                                                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} />
                                            <span className="text-sm font-medium">显示介绍</span>
                                        </div>
                                        <input 
                                            type="checkbox"
                                            checked={localSiteSettings.showDescription !== false}
                                            onChange={() => {}}
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 pointer-events-none"
                                        />
                                    </div>
                                    <div 
                                        onClick={() => handleSiteChange('showTags', !localSiteSettings.showTags)}
                                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                            localSiteSettings.showTags
                                                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Tag size={16} />
                                            <span className="text-sm font-medium">显示标签</span>
                                        </div>
                                        <input 
                                            type="checkbox"
                                            checked={!!localSiteSettings.showTags}
                                            onChange={() => {}}
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 pointer-events-none"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    控制书签卡片上是否显示文字介绍与分类标签（默认关闭标签展示以保持页面极简清爽）
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    身份验证有效期
                                </label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="neverExpireCheckbox"
                                        checked={localSiteSettings.passwordExpiryDays === 0}
                                        onChange={(e) => {
                                            const isNever = e.target.checked;
                                            handleSiteChange('passwordExpiryDays', isNever ? 0 : 7);
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label htmlFor="neverExpireCheckbox" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                        永不退出（直至修改密码）
                                    </label>
                                </div>
                                {localSiteSettings.passwordExpiryDays !== 0 && (
                                    <div className="pt-1">
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">自动退出天数（默认 7 天）</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={localSiteSettings.passwordExpiryDays || 7}
                                            onChange={(e) => handleSiteChange('passwordExpiryDays', Math.max(1, parseInt(e.target.value) || 7))}
                                            className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}
                                <p className="text-xs text-slate-500 mt-1">
                                    {localSiteSettings.passwordExpiryDays === 0 
                                        ? '已勾选永不退出：只要 Cloudflare 后台未修改密码，将永久保持登录状态' 
                                        : `默认 7 天：未操作 ${localSiteSettings.passwordExpiryDays || 7} 天后需重新验证密码`}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'category' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <CategoryManagerView
                            categories={categories}
                            onUpdateCategories={onUpdateCategories || (() => {})}
                            onDeleteCategory={onDeleteCategory || (() => {})}
                            onVerifyPassword={onVerifyPassword}
                        />
                    </div>
                )}

                {activeTab === 'search' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* 添加新搜索引擎 */}
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-600/80">
                            <h4 className="text-sm font-semibold dark:text-white mb-3 flex items-center gap-2">
                                <Plus size={16} className="text-blue-500" /> 添加自定义搜索引擎
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">名称</label>
                                    <input
                                        type="text"
                                        value={newSource.name || ''}
                                        onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                                        placeholder="例如：知乎"
                                        className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">搜索 URL</label>
                                    <input
                                        type="text"
                                        value={newSource.url || ''}
                                        onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                                        placeholder="例如：https://www.zhihu.com/search?type=content&q={query}"
                                        className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="mt-3 flex justify-between items-center">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    提示：URL 中必须包含 <code className="bg-slate-200 dark:bg-slate-600 px-1 py-0.5 rounded text-blue-600 dark:text-blue-300">{'{query}'}</code> 占位符
                                </span>
                                <button
                                    onClick={handleAddSource}
                                    disabled={!newSource.name?.trim() || !newSource.url?.trim()}
                                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <Plus size={14} /> 添加引擎
                                </button>
                            </div>
                        </div>

                        {/* 已配置的搜索引擎列表 */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-semibold dark:text-white flex items-center gap-2">
                                    <Globe size={16} className="text-blue-500" /> 已配置搜索引擎
                                </h4>
                                <button
                                    onClick={handleResetSources}
                                    className="text-xs text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                                    title="恢复默认自带搜索引擎列表"
                                >
                                    <RotateCcw size={12} /> 恢复默认配置
                                </button>
                            </div>

                            <div className="space-y-2">
                                {localSearchSources.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                                        <Globe size={28} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-xs">暂无配置的搜索引擎</p>
                                    </div>
                                ) : (
                                    localSearchSources.map((source) => (
                                        <div 
                                            key={source.id} 
                                            className="flex items-center justify-between p-3 bg-slate-50/70 dark:bg-slate-700/50 border border-slate-200/80 dark:border-slate-600/60 rounded-xl"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                                                <input
                                                    type="checkbox"
                                                    checked={source.enabled}
                                                    onChange={() => handleToggleSourceEnabled(source.id)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                    title={source.enabled ? "点击禁用" : "点击启用"}
                                                />
                                                {getFaviconUrl(source.url) ? (
                                                    <img
                                                        src={getFaviconUrl(source.url)}
                                                        alt=""
                                                        className="w-4 h-4 shrink-0"
                                                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <Globe size={16} className="text-slate-400 shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm dark:text-white truncate">{source.name}</span>
                                                        {source.enabled ? (
                                                            <span className="px-1.5 py-0.2 text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded font-medium">
                                                                已启用
                                                            </span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.2 text-[10px] bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 rounded font-medium">
                                                                未启用
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-400 dark:text-slate-400 truncate font-mono">
                                                        {source.url}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleDeleteSource(source.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="删除"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 说明卡片 */}
                        <div className="p-3 bg-blue-50/70 dark:bg-blue-900/20 rounded-xl border border-blue-200/70 dark:border-blue-800/60 text-xs text-blue-700 dark:text-blue-300 space-y-1">
                            <p className="font-semibold flex items-center gap-1"><Info size={14} /> 聚合搜索引擎说明：</p>
                            <p>• 启用的前几个搜索引擎将平铺展示在首页 Banner 和顶部搜索框内。</p>
                            <p>• 支持任意包含搜索词占位符的网址，例如知乎、豆瓣、小红书、GitHub、Linux.do 等。</p>
                            <p>• 配置会自动同步至 Cloudflare KV 云端数据库，换设备自动保持一致。</p>
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">AI 提供商</label>
                            <select 
                                value={localConfig.provider}
                                onChange={(e) => handleChange('provider', e.target.value)}
                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI Compatible (ChatGPT, DeepSeek, Claude...)</option>
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">API Key</label>
                            <div className="relative">
                                <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="password" 
                                    value={localConfig.apiKey}
                                    onChange={(e) => handleChange('apiKey', e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full pl-10 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Key 仅存储在本地浏览器缓存中，不会发送到我们的服务器。</p>
                        </div>

                        {localConfig.provider === 'openai' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Base URL (API 地址)</label>
                                <input 
                                    type="text" 
                                    value={localConfig.baseUrl}
                                    onChange={(e) => handleChange('baseUrl', e.target.value)}
                                    placeholder="https://api.openai.com/v1"
                                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">模型名称 (Model Name)</label>
                            <input 
                                type="text" 
                                value={localConfig.model}
                                onChange={(e) => handleChange('model', e.target.value)}
                                placeholder={localConfig.provider === 'gemini' ? "gemini-2.5-flash" : "gpt-3.5-turbo"}
                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                            <h4 className="text-sm font-semibold mb-2 dark:text-slate-200">批量操作</h4>
                            {isProcessing ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                                        <span>正在生成描述... ({progress.current}/{progress.total})</span>
                                        <button onClick={() => { shouldStopRef.current = true; setIsProcessing(false); }} className="text-red-500 flex items-center gap-1 hover:underline">
                                            <PauseCircle size={12}/> 停止
                                        </button>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleBulkGenerate}
                                    className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-3 py-2 rounded-lg transition-colors border border-purple-200 dark:border-purple-800"
                                >
                                    <Sparkles size={16} /> 一键补全所有缺失的描述
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'tools' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        
                        <div className="space-y-3">
                            <h4 className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-                                -6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">1</span>
                                输入访问密码
                            </h4>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="space-y-3">
                                     <div>
                                        <label className="text-xs text-slate-500 mb-1 block">API 域名 (自动获取)</label>
                                        <code className="block w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-600 dark:text-slate-400 font-mono truncate">
                                            {domain}
                                        </code>
                                     </div>
                                     <div>
                                        <label className="text-xs text-slate-500 mb-1 block">访问密码 (Password)</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={password} 
                                                readOnly 
                                                className="flex-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm outline-none font-mono"
                                                placeholder="未登录 / 未设置"
                                            />
                                             <button onClick={() => handleCopy(password, 'pwd')} className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-blue-500 rounded text-slate-600 dark:text-slate-400 transition-colors">
                                                {copiedStates['pwd'] ? <Check size={16}/> : <Copy size={16}/>}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">此密码对应您部署时设置的 PASSWORD 环境变量。</p>
                                     </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">2</span>
                                选择浏览器类型
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setBrowserType('chrome')}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${browserType === 'chrome' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 bg-white dark:bg-slate-800'}`}
                                >
                                    <span className="font-semibold">Chrome / Edge</span>
                                </button>
                                <button 
                                    onClick={() => setBrowserType('firefox')}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${browserType === 'firefox' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 bg-white dark:bg-slate-800'}`}
                                >
                                    <span className="font-semibold">Mozilla Firefox</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">3</span>
                                配置步骤与代码
                            </h4>
                            
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h5 className="font-semibold text-sm mb-3 dark:text-slate-200">
                                    安装指南 ({browserType === 'chrome' ? 'Chrome/Edge' : 'Firefox'}):
                                </h5>
                                <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
                                    <li>在电脑上新建文件夹 <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-xs">CloudNav-Pro</code>。</li>
                                    <li><strong>[重要]</strong> 将下方图标保存为 <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-xs">icon.png</code>。</li>
                                    <li>获取插件代码文件：
                                        <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-slate-500">
                                            <li><strong>方式一 (推荐)：</strong>点击下方的 <span className="text-blue-600 dark:text-blue-400 font-bold">"📦 一键下载所有文件"</span> 按钮，解压到该文件夹。</li>
                                            <li><strong>方式二 (备用)：</strong>分别点击下方代码块的 <Download size={12} className="inline"/> 按钮下载或复制 <code className="bg-white dark:bg-slate-900 px-1 rounded">manifest.json</code>, <code className="bg-white dark:bg-slate-900 px-1 rounded">background.js</code> 等文件到该文件夹。</li>
                                        </ul>
                                    </li>
                                    <li>
                                        打开浏览器扩展管理页面 
                                        {browserType === 'chrome' ? (
                                            <> (Chrome: <code className="select-all bg-white dark:bg-slate-900 px-1 rounded">chrome://extensions</code>)</>
                                        ) : (
                                            <> (Firefox: <code className="select-all bg-white dark:bg-slate-900 px-1 rounded">about:debugging</code>)</>
                                        )}。
                                    </li>
                                    <li className="text-blue-600 font-bold">操作关键点：</li>
                                    <li>1. 开启右上角的 "开发者模式" (Chrome)。</li>
                                    <li>2. 点击 "加载已解压的扩展程序"，选择包含上述文件的文件夹。</li>
                                    <li>3. 前往 <code className="select-all bg-white dark:bg-slate-900 px-1 rounded">chrome://extensions/shortcuts</code>。</li>
                                    <li>4. <strong>[重要]</strong> 找到 "打开/关闭 CloudNav 侧边栏"，设置快捷键 (如 Ctrl+Shift+E)。</li>
                                </ol>
                                
                                <div className="mt-4 mb-4">
                                    <button 
                                        onClick={handleDownloadZip}
                                        disabled={isZipping}
                                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                                    >
                                        <Package size={20} />
                                        {isZipping ? '打包中...' : '📦 一键下载所有文件 (v7.6 Pro)'}
                                    </button>
                                </div>
                                
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded border border-green-200 dark:border-green-900/50 text-sm space-y-2">
                                    <div className="font-bold flex items-center gap-2"><Zap size={16}/> 完美交互方案 (v7.6):</div>
                                    <ul className="list-disc list-inside text-xs space-y-1">
                                        <li><strong>左键 / 快捷键:</strong> 极速打开/关闭侧边栏 (无弹窗延迟)。</li>
                                        <li><strong>网页右键:</strong> 直接展示分类列表 (支持判重警告)。</li>
                                        <li><strong>图标右键:</strong> 同上，统一为级联菜单，直接保存。</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                     <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                                        {localSiteSettings.favicon ? <img src={localSiteSettings.favicon} className="w-full h-full object-cover"/> : <Globe size={24} className="text-slate-400"/>}
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm dark:text-white">插件图标 (icon.png)</div>
                                        <div className="text-xs text-slate-500">请保存此图片为 icon.png</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleDownloadIcon}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-lg transition-colors"
                                >
                                    <Download size={16} /> 下载图标
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    <Sidebar size={18} className="text-purple-500"/> 核心配置
                                </div>
                                {renderCodeBlock('manifest.json', getManifestJson())}
                                {renderCodeBlock('background.js', extBackgroundJs)}
                                
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    <Keyboard size={18} className="text-green-500"/> 侧边栏导航功能 (Sidebar)
                                </div>
                                {renderCodeBlock('sidebar.html', extSidebarHtml)}
                                {renderCodeBlock('sidebar.js', extSidebarJs)}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                    <Save size={18} /> 保存更改
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;