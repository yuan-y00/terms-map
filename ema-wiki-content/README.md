# 术语地图内容仓库

本仓库保存术语地图的文档、术语表和资源索引。

项目目标很简单：用户在装机、维修、视频、项目或日常设备里遇到一个工程词，可以先查清它是什么意思，再找到相关知识和资源。

## 当前内容

- `data/resources.json`：外部资源索引。
- `docs/zh/05-foundation/engineering-terms-map.md`：工程术语查漏补缺表。
- `docs/zh/05-foundation/gpu-hot-plug.md`：显卡热插拔案例。
- `scripts/build-index.mjs`：生成 `dist/` 数据。

## 内容原则

资源和文档只服务这条路径：

```text
遇到一个工程词或工程对象
→ 知道它是什么意思
→ 看它牵到哪些知识
→ 打开对应资源继续看
```

资源条目优先包含：

- `scope: engineering-terms`
- `track`
- `foundation_module`
- `related_terms`
- `best_for`

## 本地构建

```bash
node scripts/build-index.mjs
node scripts/build-index.mjs --check --strict
```

## 本地预览

```bash
cd D:\Yuan\ema-wiki
python -m http.server 8080
```

访问：

```text
http://localhost:8080/ema-wiki-site/
```

## 不做什么

- 不做完整大学课程。
- 不做固定周计划。
- 不做德国学校、职业、申请或居留路线。
- 不做登录、后端数据库或复杂练习系统。
- 不搬运外部内容。

## License

MIT
