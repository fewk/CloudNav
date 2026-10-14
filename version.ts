// 集中管理项目版本号与构建元数据
// 由 package.json 的 version 字段驱动，在 Vite 构建中自动注入
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : 'v2.1.0';
export const BUILD_TIME: string = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
