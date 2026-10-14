import React, { useEffect } from 'react';
import { X, FolderTree } from 'lucide-react';
import { Category } from '../types';
import CategoryManagerView from './CategoryManagerView';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onUpdateCategories: (newCategories: Category[]) => void;
  onDeleteCategory: (id: string, mode: 'migrate' | 'delete_all', targetId?: string) => void;
  onVerifyPassword?: (password: string) => Promise<boolean>;
}

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({ 
  isOpen, 
  onClose, 
  categories, 
  onUpdateCategories,
  onDeleteCategory,
  onVerifyPassword
}) => {
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

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl h-[660px] max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2">
            <FolderTree size={18} className="text-blue-500" /> 分类管理
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <CategoryManagerView
            categories={categories}
            onUpdateCategories={onUpdateCategories}
            onDeleteCategory={onDeleteCategory}
            onVerifyPassword={onVerifyPassword}
          />
        </div>
      </div>
    </div>
  );
};

export default CategoryManagerModal;