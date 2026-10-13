import React, { useEffect, useRef } from 'react';
import { Copy, QrCode, Edit2, Trash2, Pin } from 'lucide-react';

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onCopyLink: () => void;
  onShowQRCode: () => void;
  onEditLink: () => void;
  onDeleteLink: () => void;
  onTogglePin: () => void;
  currentEmoji?: string;
  onSetEmoji?: (emoji: string) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  onCopyLink,
  onShowQRCode,
  onEditLink,
  onDeleteLink,
  onTogglePin,
  currentEmoji,
  onSetEmoji
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      
      // 防止页面滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 确保菜单位置不会超出屏幕边界
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200),
    y: Math.min(position.y, window.innerHeight - 200)
  };

  const menuItems = [
    { icon: Copy, label: '复制链接', onClick: onCopyLink },
    { icon: QrCode, label: '显示二维码', onClick: onShowQRCode },
    { icon: Edit2, label: '编辑链接', onClick: onEditLink },
    { icon: Pin, label: '置顶/取消置顶', onClick: onTogglePin },
    { icon: Trash2, label: '删除链接', onClick: onDeleteLink, className: 'text-red-600 dark:text-red-400' }
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y
      }}
    >
      {/* 快捷表情标记 */}
      {onSetEmoji && (
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 select-none">
            <span>快捷标记</span>
            {currentEmoji && <span className="font-medium text-blue-500">当前: {currentEmoji}</span>}
          </div>
          <div className="flex items-center gap-1">
            {[
              { label: '无', val: '' },
              { label: '⭐', val: '⭐' },
              { label: '🔥', val: '🔥' },
              { label: '❤️', val: '❤️' }
            ].map((item) => (
              <button
                key={item.label}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSetEmoji(item.val);
                  onClose();
                }}
                className={`flex-1 py-1 text-xs rounded transition-all text-center ${
                  (currentEmoji || '') === item.val
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
                title={item.val ? `标记为 ${item.val}` : '清除标记'}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            item.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
            item.className || 'text-slate-700 dark:text-slate-300'
          }`}
        >
          <item.icon size={16} className={item.className} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;