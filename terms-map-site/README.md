# 术语地图展示站

这是术语地图的纯静态展示站。站点从 `terms-map-content/dist/` 读取文档索引、搜索索引和资源 JSON，渲染为首页、文档页、资源页和搜索页。

## 技术栈

- HTML
- CSS
- 原生 JavaScript
- GitHub Pages

## 本地预览

先在内容仓库生成 dist：

```bash
cd D:\Yuan\terms-map\terms-map-content
node scripts\build-index.mjs
```

再从项目根目录 `D:\Yuan\terms-map` 启动静态服务器：

```bash
cd D:\Yuan\terms-map
python -m http.server 8080
```

访问：

```text
http://localhost:8080/terms-map-site/
```

## 当前内容方向

首页优先呈现术语入口和资源索引。文案应服务用户正在遇到的词或工程对象，避免使用开发阶段、内部分类或解释项目机制的语言。

## License

MIT
