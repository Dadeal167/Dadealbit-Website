# Dadealbit Markdown 编辑器官网

首页、在线编辑器、下载入口和草稿迁移说明由 GitHub Pages 托管。现有的 [旧版编辑器](https://dadeal167.github.io/Dadeal.bit-Markdown-Editor/) 可继续打开并导出草稿。

要更新在线编辑器，在 [编辑器仓库](https://github.com/Dadeal167/Dadeal.bit-Markdown-Editor) 中运行 `pnpm build:online`，再在本仓库用新构建的 HTML 生成在线包。

```sh
node scripts/package-editor.mjs "../Dadealbit/dist/online/index.html" 1.2.1
```

发布时提交新的 `editor/index.html` 和它引用的构建包。
