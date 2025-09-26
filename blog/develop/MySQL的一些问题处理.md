---
slug: mysql-problems
title: mysql的问题归纳
date: 2025-06-08
authors: silence
tags: [mysql]
image: https://gitee.com/qixiangyang/pictures/raw/master/images/2025/07/20250711180427031.png
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
```mysql  showLineNumbers
SHOW GLOBAL STATUS LIKE 'Max_used_connections';
SHOW VARIABLES LIKE '%max_connections%';
        
SET GLOBAL max_connections=2000;    

SELECT @@global.time_zone, @@session.time_zone;

SELECT NOW();

SET GLOBAL time_zone = '+08:00';
SET time_zone = '+08:00';


# 解决 SQLSTATE[HY000] [2054] 认证方法未知错误
# 方案1：修改用户认证方式（推荐）
SELECT  * from mysql.user
ALTER USER 'your_username'@'host' IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;

将 your_username、host 和 your_password 替换为实际值
```
