---
slug: git-change
title: git文档
date: 2025-03-08
authors: silence
tags: [git]
keywords: [git]
description: git文档
image: /img/blog/k8s.png
sticky: 999
# 草稿 写了就不会部署
# draft: true 
---
git代码迁移

<!-- truncate -->

代码更换到gitlab
```shell
# --mirror 会推送 所有分支、标签、引用，完全复制源仓库。
git clone --mirror git@github.com:user/source-repo.git

cd source-repo.git

git push --mirror <目标仓库URL>

```
