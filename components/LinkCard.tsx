import React, { memo } from 'react';
import { Check } from 'lucide-react';
import { LinkItem, CardStyle } from '../types';
import { getAppGradient, getInitialChar } from '../services/colorUtils';

export interface LinkCardProps {
  link: LinkItem;
  cardStyle?: CardStyle;
  isDetailedView?: boolean; // 向后兼容
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
  cardStyle,
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
  // 计算有效的卡片展示形态
  const effectiveStyle: CardStyle = cardStyle ?? (isDetailedView ? 'detailed' : 'simple');
  const isIconView = effectiveStyle === 'icon';
  const isDetail = effectiveStyle === 'detailed';
  const isSimple = effectiveStyle === 'simple';

  const hasDescription = showDescription && !!link.description;
  const hasTags = isDetail && showTags && !!link.tags && link.tags.length > 0;
  const hasExtra = (isDetail && hasDescription) || hasTags;

  const gradient = getAppGradient(link.title);
  const initialChar = getInitialChar(link.title);

  // 渲染图标内部内容（Favicon 或 iOS 灵动渐变首字母）
  const renderIconContent = (sizeClass: string) => {
    if (link.icon) {
      return (
        <img
          src={link.icon}
          alt=""
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-contain ${sizeClass}`}
          onError={(e) => {
            const target = e.target as HTMLElement;
            target.style.display = 'none';
          }}
        />
      );
    }
    return (
      <span className="select-none font-bold tracking-wider">
        {initialChar}
      </span>
    );
  };

  // --- 1. 📱 手机 APP 图标模式 (Icon Mode) ---
  if (isIconView) {
    return (
      <div
        className={`group relative flex flex-col items-center justify-start text-center p-2 rounded-2xl transition-all duration-200 select-none ${
          isSelected
            ? 'bg-red-50/80 dark:bg-red-950/40 ring-2 ring-red-400 dark:ring-red-700'
            : isUnassignedHighlight
              ? 'bg-amber-50/80 dark:bg-amber-950/30 ring-2 ring-amber-400 dark:ring-amber-700/50'
              : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
        } ${isBatchEditMode ? 'cursor-pointer' : ''}`}
        onClick={() => isBatchEditMode && onToggleSelection?.(link.id)}
        onContextMenu={(e) => onContextMenu?.(e, link)}
      >
        {isBatchEditMode ? (
          <div className="flex flex-col items-center w-full">
            {/* 图标与角标外壳 */}
            <div className="relative w-14 h-14 sm:w-[58px] sm:h-[58px] rounded-[18px] transition-transform duration-200 group-hover:scale-105">
              <div className={`w-full h-full rounded-[18px] overflow-hidden flex items-center justify-center border border-black/[0.08] dark:border-white/[0.12] shadow-sm ${
                link.icon ? 'bg-white dark:bg-slate-800 p-2' : `${gradient.gradientClass} ${gradient.textClass}`
              }`}>
                {renderIconContent('p-1')}
              </div>

              {/* 批量编辑选中勾选框 */}
              <div className={`absolute -top-1.5 -right-1.5 z-20 w-5 h-5 rounded-full flex items-center justify-center shadow-md transition-colors ${
                isSelected ? 'bg-blue-600 text-white' : 'bg-white/95 dark:bg-slate-700 border border-slate-300 dark:border-slate-500'
              }`}>
                {isSelected && <Check size={12} strokeWidth={3} />}
              </div>

              {/* Emoji 标记（如果未被勾选框覆盖） */}
              {link.emoji && !isBatchEditMode && (
                <div className="absolute -top-1.5 -right-1.5 z-10 text-[12px] bg-white/95 dark:bg-slate-800/95 shadow-sm border border-slate-200/80 dark:border-slate-700 rounded-full w-5 h-5 flex items-center justify-center">
                  {link.emoji}
                </div>
              )}
            </div>

            {/* 标题 */}
            <div className="mt-2 w-full px-0.5">
              <span className="text-[12px] sm:text-[12.5px] font-medium leading-[16px] text-slate-700 dark:text-slate-200 line-clamp-2 break-all">
                {link.title}
              </span>
            </div>
          </div>
        ) : (
          <a
            href={link.url}
            target={openTarget === '_self' ? '_self' : '_blank'}
            rel={openTarget === '_self' ? undefined : "noopener noreferrer"}
            className="flex flex-col items-center w-full group/link"
            title={link.description ? `${link.title} - ${link.description}` : link.title}
          >
            {/* 图标与角标外壳 */}
            <div className="relative w-14 h-14 sm:w-[58px] sm:h-[58px] rounded-[18px] transition-all duration-200 group-hover:-translate-y-1 group-hover:scale-105 active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
              <div className={`w-full h-full rounded-[18px] overflow-hidden flex items-center justify-center border border-black/[0.08] dark:border-white/[0.12] ${
                link.icon ? 'bg-white dark:bg-slate-800 p-2' : `${gradient.gradientClass} ${gradient.textClass} text-xl shadow-inner`
              }`}>
                {renderIconContent('p-1')}
              </div>

              {/* Emoji 标记角标 */}
              {link.emoji && (
                <div
                  className="absolute -top-1.5 -right-1.5 z-10 text-[12px] bg-white/95 dark:bg-slate-800/95 shadow-sm border border-slate-200/80 dark:border-slate-700 rounded-full w-5 h-5 flex items-center justify-center select-none"
                  title={`标记: ${link.emoji}`}
                >
                  {link.emoji}
                </div>
              )}
            </div>

            {/* 标题 */}
            <div className="mt-2 w-full px-0.5">
              <span className="text-[12px] sm:text-[12.5px] font-medium leading-[16px] text-slate-700 dark:text-slate-200 group-hover/link:text-blue-600 dark:group-hover/link:text-blue-400 transition-colors line-clamp-2 break-all">
                {link.title}
              </span>
            </div>
          </a>
        )}
      </div>
    );
  }

  // --- 2. ⚡ 简约模式 (Simple Mode) 与 3. 📄 详情模式 (Detailed Mode) ---
  return (
    <div
      className={`group relative transition-all duration-200 border ${
        isSelected
          ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 ring-1 ring-red-300 dark:ring-red-800'
          : isUnassignedHighlight
            ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/50 ring-1 ring-amber-300 dark:ring-amber-800/50'
            : 'bg-white dark:bg-slate-800/90 border-slate-100/90 dark:border-slate-700/60 shadow-[0_1px_3px_rgba(0,0,0,0.02)]'
      } ${
        isBatchEditMode
          ? 'cursor-pointer'
          : isDetail
            ? 'hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-black/30'
            : 'hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] dark:hover:shadow-black/20'
      } ${
        isDetail
          ? `flex flex-col rounded-xl p-3.5 ${hasExtra ? 'min-h-[96px]' : 'min-h-[68px] justify-center'}`
          : 'flex items-center justify-between rounded-xl p-2.5 px-3'
      }`}
      onClick={() => isBatchEditMode && onToggleSelection?.(link.id)}
      onContextMenu={(e) => onContextMenu?.(e, link)}
    >
      {/* 链接内容 - 批量模式使用 div，正常模式使用 a 标签 */}
      {isBatchEditMode ? (
        <div className={`flex flex-1 min-w-0 overflow-hidden h-full ${
          isDetail ? 'flex-col' : 'items-center gap-2.5 w-full'
        }`}>
          {/* 第一行：图标与标题 */}
          <div className={`flex items-center gap-2.5 ${isDetail ? 'w-full gap-3' : 'w-full min-w-0 flex-1'}`}>
            <div className={`flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 dark:border-slate-700/60 ${
              isDetail ? 'w-10 h-10 rounded-xl' : 'w-7 h-7 rounded-lg text-xs'
            } ${link.icon ? 'bg-slate-50 dark:bg-slate-700/60 p-1.5' : `${gradient.gradientClass} ${gradient.textClass}`}`}>
              {renderIconContent('p-0.5')}
            </div>

            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <h3 className={`font-semibold text-slate-800 dark:text-slate-100 truncate ${
                isDetail ? 'text-[15px]' : 'text-[13.5px]'
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

          {/* 第二行：描述文字 (详情模式) */}
          {isDetail && hasDescription && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-[18px] line-clamp-2 h-[36px] mt-2 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">
              {link.description}
            </p>
          )}

          {/* 第三行：标签 (详情模式) */}
          {hasTags && (
            <div className="flex flex-nowrap overflow-hidden items-center gap-1.5 mt-2.5 w-full whitespace-nowrap">
              {link.tags!.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300 select-none"
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
            isDetail ? 'flex-col' : 'items-center gap-2.5 w-full'
          }`}
          title={isDetail ? link.url : (hasDescription ? link.description : link.url)}
        >
          {/* 第一行：图标与标题 */}
          <div className={`flex items-center gap-2.5 ${isDetail ? 'w-full gap-3' : 'w-full min-w-0 flex-1'}`}>
            <div className={`flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 dark:border-slate-700/60 ${
              isDetail ? 'w-10 h-10 rounded-xl' : 'w-7 h-7 rounded-lg text-xs'
            } ${link.icon ? 'bg-slate-50 dark:bg-slate-700/60 p-1.5' : `${gradient.gradientClass} ${gradient.textClass}`}`}>
              {renderIconContent('p-0.5')}
            </div>

            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <h3 className={`font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${
                isDetail ? 'text-[15px]' : 'text-[13.5px]'
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

          {/* 第二行：描述文字 (详情模式) */}
          {isDetail && hasDescription && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-[18px] line-clamp-2 h-[36px] mt-2 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">
              {link.description}
            </p>
          )}

          {/* 第三行：标签 (详情模式) */}
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
                  className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-700/70 dark:text-slate-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition-colors cursor-pointer select-none"
                  title={`按标签 #${tag} 筛选`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 简约模式下的浮动 Tooltip */}
          {isSimple && hasDescription && (
            <div className="tooltip-custom absolute left-0 -top-8 w-max max-w-[220px] bg-slate-900/95 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg opacity-0 invisible group-hover:visible group-hover:opacity-100 transition-all z-20 pointer-events-none truncate border border-slate-700">
              {link.description}
            </div>
          )}
        </a>
      )}
    </div>
  );
});

LinkCard.displayName = 'LinkCard';
export default LinkCard;
