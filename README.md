# Dadealbit Markdown 编辑器官网

首页、在线编辑器、下载入口和草稿迁移说明由 GitHub Pages 托管。现有的 [旧版编辑器](https://dadeal167.github.io/Dadeal.bit-Markdown-Editor/) 可继续打开并导出草稿。

要更新在线编辑器，在 [编辑器仓库](https://github.com/Dadeal167/Dadeal.bit-Markdown-Editor) 中运行 `pnpm build:online`，再将完整的 `dist/online` 交给本站打包脚本。

```sh
node scripts/package-editor.mjs "../Dadealbit/dist/online" 1.2.1
```

发布时一并提交新生成的 `editor/index.html`、`editor/sw.js`、`editor/shell-*.html` 和 `editor/releases/` 中的对应版本目录。在线版会在首次成功打开后缓存核心编辑功能，下次可在同一浏览器断网重开。已加载的可选工具可以复用本地缓存，云端文档和未缓存的工具仍需要网络。

绘图页的源码位于 `plot/`。修改源码后运行 `node scripts/package-plot.mjs`，使用相邻 `Dadealbit` 仓库的 esbuild 和 KaTeX 更新 `plot/plot.bundle.js`。浏览器打开绘图页时可离线排版公式。
