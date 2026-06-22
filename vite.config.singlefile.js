import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 单文件打包：把 JS / CSS / 字体全部内联进一个 index.html
// 产物可双击直接用浏览器打开(file://)，离线可用，便于直接发给任何人查看交互原型。
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist-single',
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000, // 强制内联所有资源(含字体)
    chunkSizeWarningLimit: 100000,
  },
});
