import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        '__APP_VERSION__': JSON.stringify(pkg.version),
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        modulePreload: {
          polyfill: false,
          resolveDependencies: (filename, deps) => {
            // 避免新标签页预加载大型懒加载模块（如 AI SDK 和 Zip 导出）
            return deps.filter(dep => !dep.includes('vendor-genai') && !dep.includes('vendor-jszip'));
          }
        },
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('@google/genai')) {
                  return 'vendor-genai';
                }
                if (id.includes('jszip')) {
                  return 'vendor-jszip';
                }
                if (id.includes('@dnd-kit')) {
                  return 'vendor-dnd';
                }
                if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('\\react\\') || id.includes('\\react-dom\\')) {
                  return 'vendor-react';
                }
              }
            }
          }
        }
      }
    };
});
