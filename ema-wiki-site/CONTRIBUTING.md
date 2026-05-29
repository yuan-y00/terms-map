# Contributing

展示站改动应优先保证：

- 首页能直接进入术语表和资源索引。
- 资源页能按数学、物理、电子、编程、信号与控制筛选。
- 文档页和搜索页继续读取 `ema-wiki-content/dist/`。
- 不新增登录、后端数据库或复杂进度系统。
- 不在用户界面使用开发阶段或内部分类语言。

内容改动请在 `ema-wiki-content` 中完成，并运行：

```bash
node scripts/build-index.mjs --check --strict
```
