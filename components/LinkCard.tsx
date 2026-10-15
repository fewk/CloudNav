import React, { memo } from 'react';
import { LinkItem } from '../types';

export interface LinkCardProps {
  link: LinkItem;
  isDetailedView: boolean;
  showDescription?: boolean;
  showTags?: boolean;
  openTarget?: '_blank' | '_self';
  isSelected?: boolean;
  isUnassignedHighlight?: boolean;
  isBatchEditMode?: boolean;
  onToggleSelection?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, link: LinkItem) => void;
  onEdit?: (link: LinkItem) => void;
  onTagClick?: (tag: string) => void;
}

export const LinkCard: React.FC<LinkCardProps> = memo(({
  link,
  isDetailedView,
  showDescription = true,
  showTags = false,
  openTarget = '_blank',
  isSelected = false,
  isUnassignedHighlight = false,
  isBatchEditMode = false,
  onToggleSelection,
  onContextMenu,
  onEdit,
  onTagClick,
}) => {
  const hasDescription = showDescription && !!link.description;
  const hasTags = isDetailedView && showTags && !!link.tags && link.tags.length > 0;
  const hasExtra = (isDetailedView && hasDescription) || hasTags;

  return (
    <div
      className={`group relative transition-all duration-200 ${
        isSelected 
          ? 'bg-red-50 dark:bg-red-900/30 ring-1 ring-red-300 dark:ring-red-800' 
          : isUnassignedHighlight
            ? 'bg-amber-50/70 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-800/50'
            : 'bg-white dark:bg-slate-800'
      } ${isBatchEditMode ? 'cursor-pointer' : 'hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:hover:shadow-black/20'} ${
        isDetailedView 
          ? `flex flex-col rounded-[10px] p-[14px] ${hasExtra ? 'min-h-[96px]' : 'min-h-[68px] justify-center'}` 
          : 'flex items-center justify-between rounded-[10px] p-2.5 px-3 hover:-translate-y-0.5'
      }`}
      onClick={() => isBatchEditMode && onToggleSelection?.(link.id)}
      onContextMenu={(e) => onContextMenu?.(e, link)}
    >
      {/* 链接内容 - 在批量编辑模式下不使用a标签 */}
      {isBatchEditMode ? (
        <div className={`flex flex-1 min-w-0 overflow-hidden h-full ${
          isDetailedView ? 'flex-col' : 'items-center gap-2.5 w-full'
        }`}>
          {/* 第一行：图标和标题 */}
          <div className={`flex items-center gap-2.5 ${isDetailedView ? 'w-full gap-3' : 'w-full min-w-0 flex-1'}`}>
            <div className={`text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase shrink-0 overflow-hidden bg-slate-50 dark:bg-slate-700/60 border border-slate-100 dark:border-slate-700/60 ${
              isDetailedView ? 'w-10 h-10 rounded-xl p-1.5' : 'w-7 h-7 rounded-lg p-1 text-xs'
            }`}>
              {link.icon ? (
                <img 
                  src={link.icon} 
                  alt="" 
                  loading="lazy" 
                  decoding="async" 
                  className="w-full h-full object-contain" 
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} 
                />
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
          {isDetailedView && hasDescription && (
            <p className="text-[12px] text-[#8f8f8f] dark:text-slate-400 leading-[18px] line-clamp-2 h-[36px] mt-2 group-hover:text-[#5a5a5a] dark:group-hover:text-slate-200 transition-colors">
              {link.description}
            </p>
          )}

          {/* 第三行：标签展示 */}
          {hasTags && (
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
      ) : (
        <a
          href={link.url}
          target={openTarget === '_self' ? '_self' : '_blank'}
          rel={openTarget === '_self' ? undefined : "noopener noreferrer"}
          className={`flex flex-1 min-w-0 overflow-hidden h-full ${
            isDetailedView ? 'flex-col' : 'items-center gap-2.5 w-full'
          }`}
          title={isDetailedView ? link.url : (hasDescription ? link.description : link.url)}
        >
          {/* 第一行：图标和标题 */}
          <div className={`flex items-center gap-2.5 ${isDetailedView ? 'w-full gap-3' : 'w-full min-w-0 flex-1'}`}>
            <div className={`text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase shrink-0 overflow-hidden bg-slate-50 dark:bg-slate-700/60 border border-slate-100 dark:border-slate-700/60 ${
              isDetailedView ? 'w-10 h-10 rounded-xl p-1.5' : 'w-7 h-7 rounded-lg p-1 text-xs'
            }`}>
              {link.icon ? (
                <img 
                  src={link.icon} 
                  alt="" 
                  loading="lazy" 
                  decoding="async" 
                  className="w-full h-full object-contain" 
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} 
                />
              ) : (
                link.title.charAt(0)
              )}
            </div>
            
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <h3 className={`font-semibold text-[#3c3c3c] dark:text-slate-100 truncate whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-[#ff6000] dark:group-hover:text-blue-400 transition-colors ${
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
          {isDetailedView && hasDescription && (
            <p className="text-[12px] text-[#8f8f8f] dark:text-slate-400 leading-[18px] line-clamp-2 h-[36px] mt-2 group-hover:text-[#5a5a5a] dark:group-hover:text-slate-200 transition-colors">
              {link.description}
            </p>
          )}

          {/* 第三行：标签展示 */}
          {hasTags && (
            <div className="flex flex-nowrap overflow-hidden items-center gap-1.5 mt-2.5 w-full whitespace-nowrap">
              {link.tags!.map((tag, idx) => (
                <span
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTagClick?.(tag);
                  }}
                  className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#f1f7fc] text-[#9ca7ae] hover:bg-orange-50 hover:text-[#ff6000] dark:bg-slate-700/70 dark:text-slate-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition-colors cursor-pointer select-none"
                  title={`按标签 #${tag} 筛选`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {!isDetailedView && hasDescription && (
            <div className="tooltip-custom absolute left-0 -top-8 w-max max-w-[200px] bg-black text-white text-xs p-2 rounded opacity-0 invisible group-hover:visible group-hover:opacity-100 transition-all z-20 pointer-events-none truncate">
              {link.description}
            </div>
          )}
        </a>
      )}

      {/* Hover Actions */}
      {!isBatchEditMode && onEdit && (
        <div className={`flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-800/90 shadow-sm border border-slate-200/80 dark:border-slate-700 rounded-md p-1 absolute ${
          isDetailedView ? 'top-3 right-3' : 'top-1/2 -translate-y-1/2 right-2'
        }`}>
            <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(link); }}
                className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                title="编辑"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.65-.07-.97l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.32-.07.64-.07.97c0 .33.03.65.07.97l-2.11 1.63c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.39 1.06.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.25 1.17-.59 1.69-.98l2.49 1c.22.08.49 0 .61-.22l2-3.46c.13-.22.07-.49-.12-.64l-2.11-1.63Z" fill="currentColor"/>
                </svg>
            </button>
        </div>
      )}
    </div>
  );
});

LinkCard.displayName = 'LinkCard';
export default LinkCard;
