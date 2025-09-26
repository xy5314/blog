---
slug: adb-doc
title: adb命令
date: 2025-08-31
authors: silence
tags: [安卓]
image: https://gitee.com/qixiangyang/pictures/raw/master/images/2025/08/20250831233025376.png
keywords: [安卓]
description: adb命令
sticky: 999
# 草稿 写了就不会部署
#draft: true 
---
adb命令

<!-- truncate -->


adb常用命令

```shell showLineNumbers
# 查看版本
adb version 
# 查看设备列表
adb devices
# 开启adb服务
adb start-server
# 关闭adb服务
adb kill-server
# 把电脑上的文件上传到手机上
adb -s <设备id号> push <电脑路径> <手机路径>

adb -s f3cf6774 push D:\Soft\miui-flush\Magisk-v29.0.apk  /sdcard/download

# 安装软件
adb install <软件路径>
# 卸载软件
adb uninstall <软件包名>
# 查看手机上所有安装的软件包名
adb shell pm list packages

#从手机上传输文件到电脑上
adb push <手机文件/目录> <电脑文件/目录>
adb push /storage/emulated/0/Android/data/top.niunaijun.blackdexa64/dump/cc.angis.hn /Users/edy/Desktop

```




```shell showLineNumbers
# 刷入面具
# https://www.bilibili.com/video/BV1er4y1C7wU/
fastboot flash boot D:\Soft\miui-flush\adb-fastboot\magisk_patched-29000_u39hS.img
```

![](https://gitee.com/qixiangyang/pictures/raw/master/images/2025/08/20250830154240893.png)
