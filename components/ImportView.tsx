import React, { useState, useRef } from 'react';
import { Upload, FileText, Check, AlertCircle, FolderInput, ListTree, Database, Tag, Sparkles } from 'lucide-react';
import { Category, LinkItem, SearchConfig, AIConfig } from '../types';
import { parseBookmarks } from '../services/bookmarkParser';

export interface ImportViewProps {
  existingLinks: LinkItem[];
  categories: Category[];
  onImport: (newLinks: LinkItem[], newCategories: Category[]) => void;
  onImportSearchConfig?: (searchConfig: SearchConfig) => void;
  onImportAIConfig?: (aiConfig: AIConfig) => void;
  authToken?: string | null;
  onSuccess?: () => void;
}

const ImportView: React.FC<ImportViewProps> = ({
  existingLinks,
  categories,
  onImport,
  onImportSearchConfig,
  onImportAIConfig,
  authToken,
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [analyzing, setAnalyzing] = useState(false);
  
  // Analysis Results
  const [newLinksCount, setNewLinksCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [newL1Count, setNewL1Count] = useState(0);
  const [newL2Count, setNewL2Count] = useState(0);
  const [taggedLinksCount, setTaggedLinksCount] = useState(0);
  
  // Staging Data
  const [parsedLinks, setParsedLinks] = useState<LinkItem[]>([]);
  const [parsedCategories, setParsedCategories] = useState<Category[]>([]);
  const [parsedSearchConfig, setParsedSearchConfig] = useState<SearchConfig | null>(null);
  const [parsedAIConfig, setParsedAIConfig] = useState<AIConfig | null>(null);
  
  // Options
  const [importMode, setImportMode] = useState<'original' | 'merge'>('original');
  const [targetCategoryId, setTargetCategoryId] = useState<string>(categories[0]?.id || 'common');
  const [importType, setImportType] = useState<'html' | 'json'>('html');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // Parse JSON backup file
  const parseJsonBackup = async (file: File): Promise<{ links: LinkItem[], categories: Category[], searchConfig?: SearchConfig, aiConfig?: AIConfig }> => {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.links || !Array.isArray(data.links) || !data.categories || !Array.isArray(data.categories)) {
      throw new Error('Invalid backup file format');
    }
    
    return {
      links: data.links,
      categories: data.categories,
      searchConfig: data.searchConfig,
      aiConfig: data.aiConfig
    };
  };

  const resetState = () => {
    setStep('upload');
    setParsedLinks([]);
    setParsedCategories([]);
    setParsedSearchConfig(null);
    setParsedAIConfig(null);
    setNewLinksCount(0);
    setDuplicateCount(0);
    setNewL1Count(0);
    setNewL2Count(0);
    setTaggedLinksCount(0);
    setImportType('html');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'html' | 'json') => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setAnalyzing(true);
    setImportType(type);

    try {
      let result: { links: LinkItem[], categories: Category[], searchConfig?: SearchConfig, aiConfig?: AIConfig };
      
      if (type === 'html') {
        result = await parseBookmarks(selectedFile);
      } else {
        result = await parseJsonBackup(selectedFile);
      }
      
      // 1. Link Diff Logic
      const existingUrls = new Set(existingLinks.map(l => l.url.trim().replace(/\/$/, '')));
      
      const uniqueNewLinks: LinkItem[] = [];
      let duplicates = 0;
      let taggedCount = 0;

      result.links.forEach(link => {
        const normalizedUrl = link.url.trim().replace(/\/$/, '');
        if (existingUrls.has(normalizedUrl)) {
          duplicates++;
        } else {
          uniqueNewLinks.push(link);
          if (link.tags && link.tags.length > 0) {
            taggedCount++;
          }
        }
      });

      // 2. Category Diff & Hierarchy Analysis
      const existingL1 = new Map<string, Category>();
      const existingL2 = new Map<string, Category>();

      categories.forEach(c => {
        if (!c.parentId) {
          existingL1.set(c.name.trim().toLowerCase(), c);
        } else {
          existingL2.set(`${c.parentId}:${c.name.trim().toLowerCase()}`, c);
        }
      });

      const tempL1Map = new Map<string, string>(); // parsedL1Id -> targetL1Id
      let l1New = 0;
      let l2New = 0;

      const parsedL1 = result.categories.filter(c => !c.parentId);
      parsedL1.forEach(l1 => {
        const normName = l1.name.trim().toLowerCase();
        const existing = existingL1.get(normName);
        if (existing) {
          tempL1Map.set(l1.id, existing.id);
        } else {
          l1New++;
          tempL1Map.set(l1.id, l1.id);
        }
      });

      const parsedL2 = result.categories.filter(c => !!c.parentId);
      parsedL2.forEach(l2 => {
        const normName = l2.name.trim().toLowerCase();
        const targetParentId = l2.parentId ? tempL1Map.get(l2.parentId) || l2.parentId : undefined;
        const key = `${targetParentId}:${normName}`;
        if (!existingL2.has(key)) {
          l2New++;
        }
      });

      setParsedLinks(uniqueNewLinks);
      setParsedCategories(result.categories);
      setParsedSearchConfig(result.searchConfig || null);
      setParsedAIConfig(result.aiConfig || null);
      setNewLinksCount(uniqueNewLinks.length);
      setDuplicateCount(duplicates);
      setNewL1Count(l1New);
      setNewL2Count(l2New);
      setTaggedLinksCount(taggedCount);
      
      setStep('preview');
    } catch (error) {
      const errorMessage = type === 'html' 
        ? "解析文件失败，请确保是标准的浏览器导出的 HTML 书签文件。"
        : "解析文件失败，请确保是有效的 cloudnav_backup.json 文件。";
      alert(errorMessage);
      console.error(error);
    } finally {
      setAnalyzing(false);
      e.target.value = '';
    }
  };

  const executeImport = () => {
    let finalLinks = [...parsedLinks];
    let finalCategories: Category[] = [];

    if (importMode === 'merge') {
      finalLinks = finalLinks.map(link => ({
        ...link,
        categoryId: targetCategoryId
      }));
      finalCategories = []; 
    } else {
      // 方案 A：精准层级重映射与去重
      const existingL1 = new Map<string, Category>();
      const existingL2 = new Map<string, Category>();

      categories.forEach(c => {
        if (!c.parentId) {
          existingL1.set(c.name.trim().toLowerCase(), c);
        } else {
          existingL2.set(`${c.parentId}:${c.name.trim().toLowerCase()}`, c);
        }
      });

      const categoryRemap = new Map<string, string>();
      const categoriesToAdd: Category[] = [];

      // 1. 匹配并映射一级主分类
      const parsedL1 = parsedCategories.filter(c => !c.parentId);
      parsedL1.forEach(l1 => {
        const normName = l1.name.trim().toLowerCase();
        const existing = existingL1.get(normName);
        if (existing) {
          categoryRemap.set(l1.id, existing.id);
        } else {
          categoriesToAdd.push(l1);
          categoryRemap.set(l1.id, l1.id);
          existingL1.set(normName, l1);
        }
      });

      // 2. 匹配并映射二级子分类 (parentId 指向已解析/已有的一级分类)
      const parsedL2 = parsedCategories.filter(c => !!c.parentId);
      parsedL2.forEach(l2 => {
        const normName = l2.name.trim().toLowerCase();
        const targetParentId = l2.parentId ? categoryRemap.get(l2.parentId) || l2.parentId : undefined;
        const key = `${targetParentId}:${normName}`;
        const existing = existingL2.get(key);

        if (existing) {
          categoryRemap.set(l2.id, existing.id);
        } else {
          const newL2: Category = {
            ...l2,
            parentId: targetParentId
          };
          categoriesToAdd.push(newL2);
          categoryRemap.set(l2.id, newL2.id);
          existingL2.set(key, newL2);
        }
      });

      // 3. 重映射所有新增链接的 categoryId
      finalLinks = finalLinks.map(link => {
        const targetCatId = categoryRemap.get(link.categoryId) || link.categoryId || 'common';
        return {
          ...link,
          categoryId: targetCatId
        };
      });

      finalCategories = categoriesToAdd;
    }

    onImport(finalLinks, finalCategories);
    
    if (parsedSearchConfig && onImportSearchConfig) {
      onImportSearchConfig(parsedSearchConfig);
    }
    
    if (parsedAIConfig && onImportAIConfig) {
      onImportAIConfig(parsedAIConfig);
    }

    resetState();
    onSuccess?.();
  };

  return (
    <div className="space-y-6">
      {!authToken && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">访客模式提示：</span>当前未验证管理员密码，导入的书签将保存在本地浏览器缓存中。如需同步至云端 KV 数据库，请先在顶部或侧边栏登录。
          </div>
        </div>
      )}

      {step === 'upload' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* HTML Import Option */}
          <div 
            className="flex flex-col items-center justify-center space-y-4 p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer group text-center"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".html" 
              onChange={(e) => handleFileChange(e, 'html')} 
            />
            
            {analyzing && importType === 'html' ? (
              <div className="flex flex-col items-center py-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-3"></div>
                <span className="text-sm text-slate-500 dark:text-slate-400">正在分析书签层级与链接...</span>
              </div>
            ) : (
              <>
                <div className="p-4 bg-blue-100 dark:bg-blue-900/40 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <FileText size={32} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">导入浏览器书签 (HTML)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">支持 Chrome、Edge、Firefox、Safari 导出的书签</p>
                </div>
                <span className="text-xs px-3 py-1 bg-white dark:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600 text-blue-600 dark:text-blue-300 font-medium">
                  点击上传 .html 文件
                </span>
              </>
            )}
          </div>
          
          {/* JSON Import Option */}
          <div 
            className="flex flex-col items-center justify-center space-y-4 p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 hover:bg-green-50/50 dark:hover:bg-slate-700/50 hover:border-green-400 dark:hover:border-green-500 transition-all cursor-pointer group text-center"
            onClick={() => jsonFileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={jsonFileInputRef} 
              className="hidden" 
              accept=".json" 
              onChange={(e) => handleFileChange(e, 'json')} 
            />
            
            {analyzing && importType === 'json' ? (
              <div className="flex flex-col items-center py-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mb-3"></div>
                <span className="text-sm text-slate-500 dark:text-slate-400">正在分析备份文件...</span>
              </div>
            ) : (
              <>
                <div className="p-4 bg-green-100 dark:bg-green-900/40 rounded-2xl text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                  <Database size={32} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">导入完整备份 (JSON)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">兼容 cloudnav_backup.json 与 WebDAV 备份格式</p>
                </div>
                <span className="text-xs px-3 py-1 bg-white dark:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600 text-green-600 dark:text-green-300 font-medium">
                  点击上传 .json 文件
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 bg-green-50/80 dark:bg-green-900/20 rounded-xl text-center border border-green-200/80 dark:border-green-900/40">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{newLinksCount}</div>
              <div className="text-xs text-green-700 dark:text-green-300 font-medium mt-1">新增链接</div>
            </div>
            <div className="p-4 bg-blue-50/80 dark:bg-blue-900/20 rounded-xl text-center border border-blue-200/80 dark:border-blue-900/40">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{importMode === 'original' ? newL1Count : 0}</div>
              <div className="text-xs text-blue-700 dark:text-blue-300 font-medium mt-1">新增主分类</div>
            </div>
            <div className="p-4 bg-indigo-50/80 dark:bg-indigo-900/20 rounded-xl text-center border border-indigo-200/80 dark:border-indigo-900/40">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{importMode === 'original' ? newL2Count : 0}</div>
              <div className="text-xs text-indigo-700 dark:text-indigo-300 font-medium mt-1">新增子分类</div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-center border border-slate-200 dark:border-slate-600">
              <div className="text-2xl font-bold text-slate-600 dark:text-slate-300">{duplicateCount}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">重复跳过</div>
            </div>
          </div>

          {/* 方案 A 智能标签提炼反馈提示 */}
          {taggedLinksCount > 0 && importMode === 'original' && (
            <div className="flex items-start gap-2.5 p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl text-purple-700 dark:text-purple-300 text-xs">
              <Sparkles size={16} className="shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
              <div>
                <span className="font-semibold">智能深层标签化：</span>检测到多层嵌套书签，已将三级及以上的子目录自动提取为对应书签的标签（共 <strong className="underline">{taggedLinksCount}</strong> 个书签附带标签），导入后可在卡片上直接点击标签或通过搜索框进行精准筛选！
              </div>
            </div>
          )}

          {newLinksCount === 0 ? (
            <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-sm border border-amber-200 dark:border-amber-800/40">
              <AlertCircle size={18} />
              <span>未发现任何新链接，文件中的所有书签已在当前库中存在。</span>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">选择导入方式</label>
              
              <div className="space-y-3">
                <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  importMode === 'original' 
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20 ring-1 ring-blue-500/20' 
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                }`}>
                  <input 
                    type="radio" 
                    name="mode" 
                    className="mt-1 text-blue-600 focus:ring-blue-500" 
                    checked={importMode === 'original'} 
                    onChange={() => setImportMode('original')} 
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-medium text-sm text-slate-800 dark:text-white">
                      <ListTree size={16} className="text-blue-500" /> 智能层级导入（主分类 + 子分类 + 深层标签化）
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      自动穿透系统根容器；第一层建一级主分类，第二层建二级子分类并绑定关联；三级及以上的更深层文件夹自动转换为书签标签（Tags）。
                    </p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  importMode === 'merge' 
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20 ring-1 ring-blue-500/20' 
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                }`}>
                  <input 
                    type="radio" 
                    name="mode" 
                    className="mt-1 text-blue-600 focus:ring-blue-500" 
                    checked={importMode === 'merge'} 
                    onChange={() => setImportMode('merge')} 
                  />
                  <div className="w-full space-y-2">
                    <div className="flex items-center gap-2 font-medium text-sm text-slate-800 dark:text-white">
                      <FolderInput size={16} className="text-blue-500" /> 全部归并到指定单一分类
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      不新建任何主分类或子分类，将本次解析出的所有新链接平铺导入到下方选中的目标分类中。
                    </p>
                    {importMode === 'merge' && (
                      <div className="pt-2">
                        <select 
                          value={targetCategoryId}
                          onChange={(e) => setTargetCategoryId(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-sm p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.parentId ? `  ↳ ${c.name}` : c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button 
              type="button"
              onClick={resetState} 
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
            >
              重新选择文件
            </button>
            <button 
              type="button"
              onClick={executeImport} 
              disabled={newLinksCount === 0}
              className="px-5 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm shadow-blue-500/20 flex items-center gap-2 font-medium"
            >
              <Check size={16} /> 确认导入 ({newLinksCount} 条)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportView;
