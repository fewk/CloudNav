import React, { useState, useEffect } from 'react';
import { Cloud, Download, Upload, CheckCircle2, AlertCircle, Save, HardDrive, RefreshCw } from 'lucide-react';
import { Category, LinkItem, WebDavConfig, SearchConfig, AIConfig } from '../types';
import { checkWebDavConnection, uploadBackup, uploadBackupWithTimestamp, downloadBackup } from '../services/webDavService';
import { generateBookmarkHtml, downloadHtmlFile } from '../services/exportService';

export interface BackupViewProps {
  links: LinkItem[];
  categories: Category[];
  onRestore: (links: LinkItem[], categories: Category[]) => void;
  webDavConfig: WebDavConfig;
  onSaveWebDavConfig: (config: WebDavConfig) => void;
  searchConfig: SearchConfig;
  onRestoreSearchConfig: (searchConfig: SearchConfig) => void;
  aiConfig: AIConfig;
  onRestoreAIConfig: (aiConfig: AIConfig) => void;
  authToken?: string | null;
}

const BackupView: React.FC<BackupViewProps> = ({
  links,
  categories,
  onRestore,
  webDavConfig,
  onSaveWebDavConfig,
  searchConfig,
  onRestoreSearchConfig,
  aiConfig,
  onRestoreAIConfig,
  authToken
}) => {
  const [config, setConfig] = useState<WebDavConfig>(webDavConfig);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'uploading' | 'downloading' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    setConfig(webDavConfig);
  }, [webDavConfig]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const success = await checkWebDavConnection(config);
      setTestResult(success ? 'success' : 'fail');
    } catch {
      setTestResult('fail');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = () => {
    onSaveWebDavConfig(config);
    if (config.enabled) {
      handleTestConnection();
    }
  };

  const handleBackupToCloud = async () => {
    setSyncStatus('uploading');
    setStatusMsg('正在上传备份至 WebDAV...');
    try {
      const success = await uploadBackup(config, { links, categories, searchConfig, aiConfig });
      if (success) {
        setSyncStatus('success');
        setStatusMsg('备份成功！已覆盖云端 cloudnav_backup.json');
      } else {
        setSyncStatus('error');
        setStatusMsg('上传失败，请检查 WebDAV 地址与密码配置。');
      }
    } catch {
      setSyncStatus('error');
      setStatusMsg('网络请求异常，上传失败。');
    }
  };

  const handleBackupToCloudWithTimestamp = async () => {
    setSyncStatus('uploading');
    setStatusMsg('正在生成带时间戳的双重备份...');
    try {
      const result = await uploadBackupWithTimestamp(config, { links, categories, searchConfig, aiConfig });
      if (result.success) {
        setSyncStatus('success');
        setStatusMsg(`双重备份成功！文件名: ${result.filename}`);
      } else {
        setSyncStatus('error');
        setStatusMsg('上传失败，请检查 WebDAV 配置。');
      }
    } catch {
      setSyncStatus('error');
      setStatusMsg('网络请求异常，上传失败。');
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!confirm("确定要从 WebDAV 恢复吗？当前本地所有书签将被云端备份覆盖。")) return;
    
    setSyncStatus('downloading');
    setStatusMsg('正在从 WebDAV 下载备份...');
    try {
      const data = await downloadBackup(config);
      if (data) {
        onRestore(data.links, data.categories);
        if (data.searchConfig) {
          onRestoreSearchConfig(data.searchConfig);
        }
        if (data.aiConfig) {
          onRestoreAIConfig(data.aiConfig);
        }
        setSyncStatus('success');
        setStatusMsg('恢复成功！数据已更新。');
      } else {
        setSyncStatus('error');
        setStatusMsg('下载失败或备份文件内容格式不正确。');
      }
    } catch {
      setSyncStatus('error');
      setStatusMsg('连接失败，请检查网络与配置。');
    }
  };

  const handleExportHtml = () => {
    const html = generateBookmarkHtml(links, categories);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadHtmlFile(html, `bookmarks_${dateStr}.html`);
  };

  const handleExportJson = () => {
    const data = { links, categories, searchConfig, aiConfig };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudnav_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* 提示信息 */}
      <div className="flex items-start gap-2 p-3 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200/70 dark:border-blue-800/40 rounded-xl text-blue-700 dark:text-blue-300 text-xs">
        <Cloud size={16} className="shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">双轨同步机制：</span>日常数据已自动实时同步至 Cloudflare KV 云端数据库。您亦可配置独立 WebDAV 服务器（如坚果云、InfiniCloud、OpenDrive、NAS）作为灾备冷存储，双重保障数据安全。
        </div>
      </div>

      {/* Section 1: WebDAV Configuration */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <Cloud size={18} className="text-blue-500" /> WebDAV 云备份配置
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              支持坚果云、群晖 NAS、<a href="https://www.opendrive.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenDrive</a>、<a href="https://infini-cloud.net" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">InfiniCloud</a> 等标准协议
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">启用 WebDAV</span>
          </label>
        </div>

        <div className={`space-y-4 transition-opacity ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">服务器地址 (URL)</label>
            <input 
              type="text" 
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="https://webdav.opendrive.com/ 或 https://dav.jianguoyun.com/dav/"
              className="w-full p-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">用户名 / 账号</label>
              <input 
                type="text" 
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="your-email@example.com"
                className="w-full p-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">应用授权密码 / Token</label>
              <input 
                type="password" 
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder="••••••••••••"
                className="w-full p-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 pt-1">
            <button 
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3.5 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={12} className={isTesting ? 'animate-spin' : ''} />
              {isTesting ? '正在测试连接...' : '测试连接'}
            </button>
            <button 
              type="button"
              onClick={handleSaveConfig}
              className="px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
            >
              <Save size={12} /> 保存配置
            </button>
            {testResult === 'success' && (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 font-medium">
                <CheckCircle2 size={13} /> WebDAV 连接成功
              </span>
            )}
            {testResult === 'fail' && (
              <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1 font-medium">
                <AlertCircle size={13} /> 连接失败，请核对地址与凭证
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: WebDAV Sync Actions */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
            <Upload size={18} className="text-indigo-500" /> WebDAV 云端备份与恢复
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            将当前的书签、分类、搜索引擎及 AI 设定一键上传或拉取
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button 
            type="button"
            onClick={handleBackupToCloud}
            disabled={!config.enabled}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group bg-white dark:bg-slate-800 text-center"
          >
            <Upload className="w-7 h-7 text-blue-500 mb-2 group-hover:-translate-y-0.5 transition-transform" />
            <span className="text-sm font-semibold text-slate-800 dark:text-white">上传覆盖备份</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">更新云端主备份</span>
          </button>

          <button 
            type="button"
            onClick={handleRestoreFromCloud}
            disabled={!config.enabled}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group bg-white dark:bg-slate-800 text-center"
          >
            <Download className="w-7 h-7 text-purple-500 mb-2 group-hover:-translate-y-0.5 transition-transform" />
            <span className="text-sm font-semibold text-slate-800 dark:text-white">从云端恢复</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">拉取覆盖当前数据</span>
          </button>

          <button 
            type="button"
            onClick={handleBackupToCloudWithTimestamp}
            disabled={!config.enabled}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-green-400 dark:hover:border-green-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group bg-white dark:bg-slate-800 text-center"
          >
            <Save className="w-7 h-7 text-green-500 mb-2 group-hover:-translate-y-0.5 transition-transform" />
            <span className="text-sm font-semibold text-slate-800 dark:text-white">带时间戳备份</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">保存历史独立版本</span>
          </button>
        </div>
        
        {syncStatus !== 'idle' && (
          <div className={`text-xs p-3 rounded-xl border font-medium ${
            syncStatus === 'success' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/40' : 
            syncStatus === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/40' : 
            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40'
          }`}>
            {statusMsg}
          </div>
        )}
      </section>

      {/* Section 3: Local Export */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
            <HardDrive size={18} className="text-emerald-500" /> 本地导出备份
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            导出离线文件至本地电脑，无需连接任何网络服务
          </p>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-4">
            <div>
              <h5 className="text-sm font-semibold text-slate-800 dark:text-white">导出标准 HTML 书签文件</h5>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                完全符合 Netscape Bookmark 规范，可直接导入至 Chrome、Edge、Safari、Firefox 等任意浏览器
              </p>
            </div>
            <button 
              type="button"
              onClick={handleExportHtml}
              className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-blue-500 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <Download size={14} /> 导出 HTML
            </button>
          </div>
          
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-4">
            <div>
              <h5 className="text-sm font-semibold text-slate-800 dark:text-white">导出完整 JSON 备份文件</h5>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                包含书签、分类层级、搜索引擎源与 AI 模型配置的完整数据包，便于无缝迁移或在新实例一键还原
              </p>
            </div>
            <button 
              type="button"
              onClick={handleExportJson}
              className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-green-500 text-slate-700 dark:text-slate-200 hover:text-green-600 dark:hover:text-green-400 rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <Download size={14} /> 导出 JSON
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BackupView;
