---
slug: k8s-service
title: k8s文档
date: 2025-07-08
authors: silence
tags: [部署, k8s]
keywords: [部署, k8s]
description: k8s挂载外部服务
image: https://gitee.com/qixiangyang/pictures/raw/master/images/2025/07/20250711180315281.png
sticky: 999
# 草稿 写了就不会部署
# draft: true 
---
k8s挂载外部服务

<!-- truncate -->

# k8s挂载外部应用

## MYSQL
```yaml  showLineNumbers title="mysql.yaml" 
apiVersion: v1
kind: Service
metadata:
  name: mysql
  namespace: workspace
spec:
  #clusterIP: None
  type: ClusterIP
  ports:
    - name: mysql
      port: 3306
      protocol: TCP
      targetPort: 3306
---
apiVersion: v1
kind: Endpoints
metadata:
  name: mysql
  namespace: workspace
subsets:
  - addresses:
      # 外部的ip地址
      - ip: 172.16.0.101
    ports:
      - name: mysql
      # 外部的端口号
        port: 3306
        protocol: TCP
```

## MQ

```yaml  showLineNumbers
apiVersion: v1
kind: Service
metadata:
  name: mqcluster
  namespace: workspace
spec:
  #clusterIP: None
  type: ClusterIP
  ports:
    - name: mq-ui
      port: 15672
      protocol: TCP
      targetPort: 15672
    - name: mqcluster
      port: 5672
      protocol: TCP
      targetPort: 5672
---
apiVersion: v1
kind: Endpoints
metadata:
  name: mqcluster
  namespace: workspace
subsets:
  - addresses:
      # 外部的ip地址
      - ip: 172.16.0.110
      - ip: 172.16.0.111
      - ip: 172.16.0.112
    ports:
    - name: mq-ui
      port: 15672
      protocol: TCP
    - name: mqcluster
      port: 5672
      protocol: TCP
```

## MINIO

```yaml  showLineNumbers
apiVersion: v1
kind: Service
metadata:
  name: minio
  namespace: workspace
spec:
  type: ClusterIP
  ports:
    - name: minio-ui
      port: 9001
      protocol: TCP
      targetPort: 9001
    - name: minio
      port: 9000
      protocol: TCP
      targetPort: 9000
---
apiVersion: v1
kind: Endpoints
metadata:
  name: minio
  namespace: workspace
subsets:
  - addresses:
      # 外部的ip地址
      - ip: 172.16.0.121
      - ip: 172.16.0.122
      - ip: 172.16.0.123
      - ip: 172.16.0.124
    ports:
    - name: minio-ui
      port: 9001
      protocol: TCP
    - name: minio
      port: 9000
      protocol: TCP
```
