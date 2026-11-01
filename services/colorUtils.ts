/**
 * 色彩与渐变工具函数
 * 用于手机 APP 图标模式下为无图标网站动态生成高质感 iOS 风格渐变底色
 */

export interface AppGradientStyle {
  gradientClass: string;
  shadowClass: string;
  textClass: string;
}

const APP_GRADIENTS: AppGradientStyle[] = [
  {
    gradientClass: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600',
    shadowClass: 'shadow-blue-500/20',
    textClass: 'text-white',
  },
  {
    gradientClass: 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700',
    shadowClass: 'shadow-purple-500/20',
    textClass: 'text-white',
  },
  {
    gradientClass: 'bg-gradient-to-br from-emerald-400 via-teal-500 to-teal-700',
    shadowClass: 'shadow-emerald-500/20',
    textClass: 'text-white',
  },
  {
    gradientClass: 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500',
    shadowClass: 'shadow-orange-500/20',
    textClass: 'text-white',
  },
  {
    gradientClass: 'bg-gradient-to-br from-rose-500 via-pink-600 to-rose-700',
    shadowClass: 'shadow-rose-500/20',
    textClass: 'text-white',
  },
  {
    gradientClass: 'bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600',
    shadowClass: 'shadow-sky-500/20',
    textClass: 'text-white',
  },
  {
    gradientClass: 'bg-gradient-to-br from-fuchsia-500 via-purple-600 to-pink-600',
    shadowClass: 'shadow-fuchsia-500/20',
    textClass: 'text-white',
  },
  {
    gradientClass: 'bg-gradient-to-br from-teal-400 via-emerald-500 to-cyan-600',
    shadowClass: 'shadow-teal-500/20',
    textClass: 'text-white',
  },
  {
    gradientClass: 'bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-600',
    shadowClass: 'shadow-amber-500/20',
    textClass: 'text-white',
  },
  {
    gradientClass: 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900',
    shadowClass: 'shadow-slate-500/20',
    textClass: 'text-white',
  },
];

/**
 * 根据字符串计算确定性哈希
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 根据标题或唯一标识获取稳定的 iOS 应用质感渐变样式
 */
export function getAppGradient(seed: string): AppGradientStyle {
  if (!seed) {
    return APP_GRADIENTS[0];
  }
  const index = hashString(seed) % APP_GRADIENTS.length;
  return APP_GRADIENTS[index];
}

/**
 * 提取标题的首个有效展示字符
 */
export function getInitialChar(title: string): string {
  if (!title) return '★';
  const trimmed = title.trim();
  if (!trimmed) return '★';
  // 处理前导符号或直接返回首字符大写
  return trimmed.charAt(0).toUpperCase();
}
