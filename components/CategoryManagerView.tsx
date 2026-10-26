import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Trash2, Edit2, Plus, Check, Lock, Palette, X, FolderTree, CornerDownRight } from 'lucide-react';
import { Category } from '../types';
import Icon from './Icon';
import IconSelector from './IconSelector';
import CategoryDeleteModal from './CategoryDeleteModal';
import {
  normalizeCategories,
  moveCategory,
  setCategoryOrder,
  canMoveCategory
} from '../services/categoryUtils';

interface CategoryManagerViewProps {
  categories: Category[];
  onUpdateCategories: (newCategories: Category[]) => void;
  onDeleteCategory: (id: string, mode: 'migrate' | 'delete_all', targetId?: string) => void;
  onVerifyPassword?: (password: string) => Promise<boolean>;
}

const CategoryManagerView: React.FC<CategoryManagerViewProps> = ({
  categories,
  onUpdateCategories,
  onDeleteCategory,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIcon, setEditIcon] = useState('Folder');
  const [editParentId, setEditParentId] = useState<string | undefined>(undefined);
  const [editOrder, setEditOrder] = useState<string>('1');

  const [newCatName, setNewCatName] = useState('');
  const [newCatPassword, setNewCatPassword] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Folder');
  const [newCatParentId, setNewCatParentId] = useState<string | undefined>(undefined);
  const [newCatOrder, setNewCatOrder] = useState<string>('');

  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [iconSelectorTarget, setIconSelectorTarget] = useState<'edit' | 'new' | null>(null);

  // 删除确认弹窗状态
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  // 挂载时检测并自动纠正可能存在的异常/重复数据
  useEffect(() => {
    const normalized = normalizeCategories(categories);
    const hasDuplicates = normalized.length !== categories.length;
    const hasOrderMismatch = categories.some((c, i) => !c.order || c.order !== normalized[i]?.order || c.id !== normalized[i]?.id);
    if (hasDuplicates || hasOrderMismatch) {
      onUpdateCategories(normalized);
    }
  }, []);

  // ESC 键监听子弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isIconSelectorOpen) {
          setIsIconSelectorOpen(false);
          setIconSelectorTarget(null);
        } else if (isDeleteModalOpen) {
          setIsDeleteModalOpen(false);
          setDeletingCategory(null);
        } else if (editingId) {
          setEditingId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isIconSelectorOpen, isDeleteModalOpen, editingId]);

  const handleMove = (catId: string, direction: 'up' | 'down') => {
    const newCats = moveCategory(categories, catId, direction);
    onUpdateCategories(newCats);
  };

  const handleQuickOrderChange = (catId: string, val: string) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1) return;
    const currentCat = categories.find(c => c.id === catId);
    if (currentCat && currentCat.order === parsed) return;
    const newCats = setCategoryOrder(categories, catId, parsed);
    onUpdateCategories(newCats);
  };

  const canMoveUp = (catId: string) => canMoveCategory(categories, catId, 'up');
  const canMoveDown = (catId: string) => canMoveCategory(categories, catId, 'down');

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditPassword(cat.password || '');
    setEditIcon(cat.icon || 'Folder');
    setEditParentId(cat.parentId);
    setEditOrder(String(cat.order || 1));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;

    const parsedOrder = parseInt(editOrder, 10);
    const targetOrder = isNaN(parsedOrder) || parsedOrder < 1 ? 1 : parsedOrder;

    // 先应用名称、图标、密码、父分类属性
    const updatedCats = categories.map(c => c.id === editingId ? {
      ...c,
      name: editName.trim(),
      icon: editIcon,
      password: editPassword.trim() || undefined,
      parentId: editParentId,
      order: targetOrder
    } : c);

    // 通过规范的 setCategoryOrder 精准安置到指定序号并自动重排兄弟项
    const finalCats = setCategoryOrder(updatedCats, editingId, targetOrder);
    onUpdateCategories(finalCats);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!newCatName.trim()) return;

    // 计算默认排序序号（末尾）
    let defaultOrder = 1;
    if (newCatParentId) {
      const siblings = categories.filter(c => c.parentId === newCatParentId);
      defaultOrder = siblings.length + 1;
    } else {
      const roots = categories.filter(c => !c.parentId);
      defaultOrder = roots.length + 1;
    }

    const parsedOrder = parseInt(newCatOrder, 10);
    const targetOrder = !isNaN(parsedOrder) && parsedOrder >= 1 ? parsedOrder : defaultOrder;

    const newCat: Category = {
      id: Date.now().toString(),
      name: newCatName.trim(),
      icon: newCatIcon,
      password: newCatPassword.trim() || undefined,
      parentId: newCatParentId,
      order: targetOrder
    };

    const updatedCats = [...categories, newCat];
    const finalCats = setCategoryOrder(updatedCats, newCat.id, targetOrder);
    onUpdateCategories(finalCats);

    setNewCatName('');
    setNewCatPassword('');
    setNewCatIcon('Folder');
    setNewCatParentId(undefined);
    setNewCatOrder('');
  };

  const handleDeleteClick = (cat: Category) => {
    setDeletingCategory(cat);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = (mode: 'migrate' | 'delete_all', targetCategoryId?: string) => {
    if (deletingCategory) {
      onDeleteCategory(deletingCategory.id, mode, targetCategoryId);
      setIsDeleteModalOpen(false);
      setDeletingCategory(null);
    }
  };

  const openIconSelector = (target: 'edit' | 'new') => {
    setIconSelectorTarget(target);
    setIsIconSelectorOpen(true);
  };

  const handleIconSelect = (iconName: string) => {
    if (iconSelectorTarget === 'edit') {
      setEditIcon(iconName);
    } else if (iconSelectorTarget === 'new') {
      setNewCatIcon(iconName);
    }
    setIsIconSelectorOpen(false);
    setIconSelectorTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* 添加新分类卡片 */}
      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-600/80">
        <h4 className="text-sm font-semibold dark:text-white mb-3 flex items-center gap-2">
          <Plus size={16} className="text-blue-500" /> 添加新分类
        </h4>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">分类名称</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openIconSelector('new')}
                  className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-500 transition-colors shadow-sm"
                  title="点击选择图标"
                >
                  <Icon name={newCatIcon} size={18} />
                </button>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="例如：开发工具"
                  className="flex-1 p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">所属层级</label>
              <select
                value={newCatParentId || ''}
                onChange={(e) => setNewCatParentId(e.target.value || undefined)}
                className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 h-10"
              >
                <option value="">(作为一级分类)</option>
                {categories.filter(c => !c.parentId).map(c => (
                  <option key={c.id} value={c.id}>↳ 归属于：{c.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">排序序号</label>
              <input
                type="number"
                min="1"
                value={newCatOrder}
                onChange={(e) => setNewCatOrder(e.target.value)}
                placeholder="留空自动排末尾"
                className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 h-10"
                title="排序序号（数字越小越靠前，留空自动排在末尾）"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-1">
            <div className="relative flex-1 max-w-sm">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={newCatPassword}
                onChange={(e) => setNewCatPassword(e.target.value)}
                placeholder="访问保护密码 (可选)"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={!newCatName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0"
            >
              <Plus size={14} /> 添加分类
            </button>
          </div>
        </div>
      </div>

      {/* 分类列表 */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-semibold dark:text-white flex items-center gap-2">
            <FolderTree size={16} className="text-blue-500" /> 分类目录 ({categories.length})
          </h4>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            支持设置序号排序，也可通过上下箭头调整次序
          </span>
        </div>

        <div className="space-y-2">
          {categories.length === 0 ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              <FolderTree size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">暂无分类，请在上方添加</p>
            </div>
          ) : (
            categories.map((cat, index) => {
              const isSub = !!cat.parentId;
              const parentCat = isSub ? categories.find(c => c.id === cat.parentId) : null;
              const isEditing = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isSub
                      ? 'ml-6 bg-slate-50/60 dark:bg-slate-700/40 border-l-4 border-l-blue-400 dark:border-l-blue-500 border-slate-200/80 dark:border-slate-600/60'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex flex-col md:flex-row gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            type="button"
                            onClick={() => openIconSelector('edit')}
                            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-blue-500 bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400"
                            title="选择图标"
                          >
                            <Icon name={editIcon} size={16} />
                          </button>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="分类名称"
                            className="flex-1 p-2 text-sm rounded-lg border border-blue-500 dark:bg-slate-700 dark:text-white outline-none"
                            autoFocus
                          />
                        </div>

                        <select
                          value={editParentId || ''}
                          onChange={(e) => setEditParentId(e.target.value || undefined)}
                          className="p-2 text-xs rounded-lg border border-blue-500 dark:bg-slate-700 dark:text-white outline-none"
                        >
                          <option value="">(无 - 作为一级分类)</option>
                          {categories
                            .filter(c => !c.parentId && c.id !== editingId)
                            .map(c => (
                              <option key={c.id} value={c.id}>↳ 归属于：{c.name}</option>
                            ))
                          }
                        </select>

                        <div className="flex items-center gap-1.5 shrink-0 bg-blue-50/60 dark:bg-slate-700/60 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-900/50">
                          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">序号:</span>
                          <input
                            type="number"
                            min="1"
                            value={editOrder}
                            onChange={(e) => setEditOrder(e.target.value)}
                            placeholder="序号"
                            className="w-14 p-1 text-xs text-center font-semibold rounded border border-blue-400 dark:border-blue-600 dark:bg-slate-700 dark:text-white outline-none"
                            title="设置排序序号（数字越小越靠前）"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="relative flex-1 max-w-xs">
                          <Lock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="修改密码（留空则不设密码）"
                            className="w-full pl-7 pr-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveEdit}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Check size={14} /> 保存
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs rounded-lg transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {/* 排序与序号控制 */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleMove(cat.id, 'up')}
                              disabled={!canMoveUp(cat.id)}
                              className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="上移"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => handleMove(cat.id, 'down')}
                              disabled={!canMoveDown(cat.id)}
                              className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="下移"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>

                          {/* 序号快捷修改 */}
                          <div 
                            className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600/80 shadow-2xs"
                            title="当前排序序号（可直接输入修改，回车或失焦生效，数字越小越靠前）"
                          >
                            <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono select-none">#</span>
                            <input
                              type="number"
                              min="1"
                              defaultValue={cat.order ?? index + 1}
                              key={`${cat.id}-${cat.order}`}
                              onBlur={(e) => handleQuickOrderChange(cat.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-7 text-center text-xs font-semibold text-slate-700 dark:text-slate-200 bg-transparent outline-none focus:text-blue-600 dark:focus:text-blue-400 p-0"
                            />
                          </div>
                        </div>

                        {/* 图标与名称 */}
                        <div className="flex items-center gap-2 min-w-0">
                          {isSub && (
                            <CornerDownRight size={14} className="text-slate-400 shrink-0" />
                          )}
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSub 
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' 
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            <Icon name={cat.icon || 'Folder'} size={15} />
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            {isSub && parentCat && (
                              <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 truncate">
                                {parentCat.name} /
                              </span>
                            )}
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {cat.name}
                            </span>
                          </div>
                          {cat.password && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded font-medium shrink-0" title="已设访问密码">
                              <Lock size={10} /> 密码
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(cat)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="编辑分类"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(cat)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="删除分类"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 图标选择器弹窗 */}
      {isIconSelectorOpen && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setIsIconSelectorOpen(false); setIconSelectorTarget(null); } }}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Palette size={18} className="text-blue-500" /> 选择分类图标
              </h3>
              <button
                type="button"
                onClick={() => { setIsIconSelectorOpen(false); setIconSelectorTarget(null); }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <IconSelector onSelectIcon={handleIconSelect} />
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {isDeleteModalOpen && deletingCategory && (
        <CategoryDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => { setIsDeleteModalOpen(false); setDeletingCategory(null); }}
          categoryName={deletingCategory.name}
          categories={categories}
          categoryId={deletingCategory.id}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
};

export default CategoryManagerView;
