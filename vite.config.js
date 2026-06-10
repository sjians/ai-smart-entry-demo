import { defineConfig } from 'vite';

// Vite + Vitest 统一配置
// - dev/build：纯前端静态应用（无后端依赖，开箱即跑）
// - test：使用 jsdom 模拟浏览器环境，便于对抽取引擎与 UI 进行单元测试
export default defineConfig({
  root: '.',
  // 相对路径基址：使构建产物可部署到任意子路径（GitHub Pages 的 username.github.io/<repo>/ 即子路径）。
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.js'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/core/**', 'src/data/**'],
    },
  },
});
