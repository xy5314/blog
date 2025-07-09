---
slug: mysql-problems
title: mysql的问题归纳
date: 2025-06-08
authors: silence
tags: [mysql]
keywords: [mysql]
description: mysql的问题归纳
sticky: 999
# 草稿 写了就不会部署
# draft: true 
---
mysql的一些问题

<!-- truncate -->

# 1.Mysql Too ManyConnect
https://www.cnblogs.com/q202105271618/p/16212647.html
```mysql
SHOW GLOBAL STATUS LIKE 'Max_used_connections';
SHOW VARIABLES LIKE '%max_connections%';
        
SET GLOBAL max_connections=2000;    

SELECT @@global.time_zone, @@session.time_zone;

SELECT NOW();

SET GLOBAL time_zone = '+08:00';
SET time_zone = '+08:00';

```
