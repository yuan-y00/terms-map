# Contributing

术语地图只接受能帮助用户理解工程术语或工程对象的内容。

## 可以添加什么

- 工程术语解释。
- 真实工程对象案例。
- 能帮助用户继续理解术语的外部资源卡片。

## 不添加什么

- 德国学校、职业、申请、居留规划。
- 泛泛职业介绍。
- 人物、组织、年表、作品索引。
- 与工程术语和工程对象无关的课程合集。
- 无法核验来源的内容。

## 文档要求

Markdown 文档必须包含 frontmatter：

```yaml
---
id: zh-example-topic
title: 示例标题
lang: zh
category: overview
tags: [Terms, Engineering]
summary: 一句话说明这篇文档帮助用户看懂什么词或对象。
order: 10
---
```

## 资源要求

资源条目优先包含：

- `scope: engineering-terms`
- `track`
- `category`
- `foundation_module`
- `related_terms`
- `best_for`

## 本地校验

```bash
node scripts/build-index.mjs
node scripts/build-index.mjs --check --strict
```
