---
slug: k8s-content
title: k8s文档
date: 2024-11-28
authors: silence
tags: [部署, k8s]
keywords: [部署, k8s]
description: k8s文档详情
image: /img/blog/k8s.png
sticky: 999
draft: true # 
---
k8s的文档详情！！！

<!-- truncate -->
## k8s的基础架构

### 1.工作方式

Kubernetes Cluster = N Master Node + N Worker Node：**N主节点**+**N工作节点**； N>=1

### 2.组织架构

![img](https://gitee.com/qixiangyang/pictures/raw/master/images/202405221110778.png)

![image20240522112754180](https://gitee.com/qixiangyang/pictures/raw/master/images/202405221127260.png)

api-server:集群之间的交互

kube-proxy：与子节点交互

## K8S集群部署

### 1.前期准备

- 每台机器都需要安装**dokcer(运行环境)**、**kubelet(节点管理)**、kubectl(命令行工具)、kubeadm(快速搭建k8s集群)其中只有`docker`和`kubelet`是必须的

- 选择1台机器作为<font>主节点</font> 使用 `kubeadm init`来完成主节点的初始化

    - 完成主节点上的scheduler、kube-proxy、etcd、api-server、controller-manager创建
- <font>每个子节点</font> 使用命令`cubeadm join `加入主节点 自动完成kube-proxy的创建


#### 1.1搭建基础环境

> centOS7下载：https://mirror-hk.koddos.net/centos/7.9.2009/isos/x86_64/
> 选择 [CentOS-7-x86_64-Minimal-2009.iso](https://mirror-hk.koddos.net/centos/7.9.2009/isos/x86_64/CentOS-7-x86_64-Minimal-2009.iso)

##### 1.1.1固定ip地址

> 配置三台机器的IP地址

![image20240523112713904](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231127037.png)

```sh
# 网关 192.168.70.2
master 192.168.70.123   255.255.255.0
node1  192.168.70.124   255.255.255.0
node2  192.168.70.125   255.255.255.0

yum install vim
# 修改配置文件 如下：
vim /etc/sysconfig/network-scripts/ifcfg-ens33
# 重启网络服务
systemctl restart network

TYPE="Ethernet"
PROXY_METHOD="none"
BROWSER_ONLY="no"
BOOTPROTO="static"
DEFROUTE="yes"
IPV4_FAILURE_FATAL="no"
IPV6INIT="yes"
IPV6_AUTOCONF="yes"
IPV6_DEFROUTE="yes"
IPV6_FAILURE_FATAL="no"
IPV6_ADDR_GEN_MODE="stable-privacy"
NAME="ens33"
UUID="79b45022-dde8-4d25-961e-d7fffab67422"
DEVICE="ens33"
ONBOOT="yes"
IPADDR="192.168.70.124"
PREFIX="24"
GATEWAY="192.168.70.2"
IPV6_PRIVACY="no"
DNS1="114.114.114.114"
```

##### 1.1.2配置yum源

```sh
sudo yum install -y yum-utils
sudo yum-config-manager \
--add-repo \
http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
```

##### 1.1.3移除之前的docker

```sh
sudo yum remove docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-engine
```

##### 1.1.4安装docker

```bash
sudo yum install -y docker-ce docker-ce-cli containerd.io


# 以下是在安装k8s的时候使用
yum install -y docker-ce-20.10.7 docker-ce-cli-20.10.7  containerd.io-1.4.6
```

##### 1.1.5启动docker

```sh
systemctl enable docker --now
```

##### 1.1.6配置docker加速

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": ["https://82m9ar63.mirror.aliyuncs.com"],
  "exec-opts": ["native.cgroupdriver=systemd"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m"
  },
  "storage-driver": "overlay2"
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

##### 1.1.7克隆子节点

使用vm的克隆技术，快速产生剩余的两个node节点

#### 1.2k8s的环境准备

##### 1.2.1 为三台机器准备不同的主机名

```sh
hostnamectl set-hostname k8s-master
hostnamectl set-hostname k8s-node1
hostnamectl set-hostname k8s-node2
```

##### 1.2.2三台机器的组内通信

服务器之间相互ping可以畅通不丢包

关闭防火墙

```sh
# 停止firewalld服务：
systemctl stop firewalld
# 禁用firewalld服务开机自启动：
systemctl disable firewalld
#@、 检查防火墙状态是否已停止：
systemctl status firewalld
```

##### 1.2.3三台机器均关闭swap分区

```sh
# 将 SELinux 设置为 permissive 模式（相当于将其禁用）
sudo setenforce 0
sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config

#关闭swap
swapoff -a  
sed -ri 's/.*swap.*/#&/' /etc/fstab

#允许 iptables 检查桥接流量
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
br_netfilter
EOF

cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-ip6tables = 1
net.bridge.bridge-nf-call-iptables = 1
EOF
sudo sysctl --system
```

##### 1.2.4三台机器安装kubelet、kubeadm、kubectl

> kubelet的安装

```sh
# 1.配置好k8s的下载地址
cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=http://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-x86_64
enabled=1
gpgcheck=0
repo_gpgcheck=0
gpgkey=http://mirrors.aliyun.com/kubernetes/yum/doc/yum-key.gpg
   http://mirrors.aliyun.com/kubernetes/yum/doc/rpm-package-key.gpg
exclude=kubelet kubeadm kubectl
EOF

# 2.安装三大件
sudo yum install -y kubelet-1.20.9 kubeadm-1.20.9 kubectl-1.20.9 --disableexcludes=kubernetes
# 3.所有的机器都启动kubelet
sudo systemctl enable --now kubelet
```

<blockquote alt="success"><p>之后使用  systemctl status kubelet 检查kubelet的状态 </p><p>
    现在每隔几秒就会重启，因为它陷入了一个等待 kubeadm 指令的死循环
    </p> <p>这是正常的！</p></blockquote>

> kubeadm的安装

```sh
# 编写脚本 去下载需要的镜像
sudo tee ./images.sh <<-'EOF'
#!/bin/bash
images=(
kube-apiserver:v1.20.9
kube-proxy:v1.20.9
kube-controller-manager:v1.20.9
kube-scheduler:v1.20.9
coredns:1.7.0
etcd:3.4.13-0
pause:3.2
)
for imageName in ${images[@]} ; do
docker pull registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/$imageName
done
EOF

# 给予脚本执行权限 并下载镜像
chmod +x ./images.sh && ./images.sh
```

> 初始化主节点<font>(只需要在master上运行)</font>

```sh
#所有机器添加master域名映射，以下需要修改为自己的
# 让所有机器都知道master节点在哪里 ping  cluster-endpoint 能通
echo "192.168.70.123  cluster-endpoint" >> /etc/hosts


# --apiserver-advertise-address=主节点的ip地址
# --control-plane-endpoint=cluster-endpoint 控制平面端点 设置为master的域名
# --image-repository registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images 镜像仓库
# --kubernetes-version k8s的版本
# --service-cidr
# --pod-network-cidr  与 pod-network-cidr 的网络范围不重叠
# 主节点初始化
kubeadm init \
--apiserver-advertise-address=192.168.70.123 \
--control-plane-endpoint=cluster-endpoint \
--image-repository registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images \
--kubernetes-version v1.20.9 \
--service-cidr=10.96.0.0/16 \
--pod-network-cidr=192.169.0.0/16

#所有网络范围不重叠
```

```shell
# 成功的提示信息
Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:
# 接下来要执行这个命令
  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

Alternatively, if you are the root user, you can run:

  export KUBECONFIG=/etc/kubernetes/admin.conf
# 你应该部署一个pod 网络插件 使用网络插件给k8s的所有机器串起来
You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/
# 你可以加入任意多的主节点
You can now join any number of control-plane nodes by copying certificate authorities
and service account keys on each node and then running the following as root:
# 加入主节点的命令 成为集群的领导
  kubeadm join cluster-endpoint:6443 --token 5vxi8n.duexcrq774qnhb6z \
    --discovery-token-ca-cert-hash sha256:e453bb83fa29e143827e884604a539d230f83beb60f1988ade45ede08a59ebf2 \
    --control-plane 
# 你可以加入任意多的工作节点
Then you can join any number of worker nodes by running the following on each as root:

kubeadm join cluster-endpoint:6443 --token 5vxi8n.duexcrq774qnhb6z \
    --discovery-token-ca-cert-hash sha256:e453bb83fa29e143827e884604a539d230f83beb60f1988ade45ede08a59ebf2 
```

> **设置.kube/config** <font>(只需要在master上运行)</font>

```shell
# 运行下面三条命令 ，配置文件 ，在上面的成功日志中会给出
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

> 部署网络插件calico 使用网络插件给k8s的所有机器串起来 <font>(只需要在master上运行)</font>
>
> [calico官网](https://docs.projectcalico.org/getting-started/kubernetes/self-managed-onprem/onpremises#install-calico-with-kubernetes-api-datastore-more-than-50-nodes)

```sh
# 下载插件
curl https://docs.projectcalico.org/v3.20/manifests/calico.yaml -O
# 安装插件
kubectl apply -f calico.yaml

下图calico的配置信息需要改成和--pod-network-cidr=192.169.0.0/16 一样的
注意缩进和ip地址 ！！！ 
```

![image20240523150614587](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231506678.png)

##### 1.2.5常用命令

```sh
#查看集群所有节点
kubectl get nodes

#根据配置文件，给集群创建资源
kubectl apply -f xxxx.yaml
# 删除资源
kubectl delete -f xxxx.yaml

#查看集群部署了哪些应用？
docker ps   < = 替换成了= >   kubectl get pods -A
# 运行中的应用在docker里面叫容器，在k8s里面叫Pod
kubectl get pods -A
kubectl get pods -A -w 监控节点变化

# 每秒执行一次
watch -n 1 kubectl get pods -A
```

> 使用命令` kubectl get nodes` 能获取到当前的master节点状态为已就绪

![image20240523151713674](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231517797.png)

:smile:至此 master节点部署完毕！！！

##### <a name="Workjoin" alt="none"> </a>1.2.6worker工作子节点加入主节点

```sh
# 使用上面的命令
kubeadm join cluster-endpoint:6443 --token 5vxi8n.duexcrq774qnhb6z \
    --discovery-token-ca-cert-hash sha256:e453bb83fa29e143827e884604a539d230f83beb60f1988ade45ede08a59ebf2 
# 这个命令24小时有效
# 过期的话需要在master上运行 会再次生成令牌
kubeadm token create --print-join-command
```

:warning: 遇到错误!

![image20240523152854299](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231528411.png)

查看ip 转发的规则是否是1 使用命令`cat /proc/sys/net/ipv4/ip_forward`查看

上图看到结果是0 需要改成1 参考地址：https://blog.csdn.net/qq_42666043/article/details/108259390

```sh
# 使用命令修改设置允许端口转发
echo "sysctl -w net.ipv4.ip_forward=1" >> /etc/rc.d/rc.local \
&& echo "sysctl -p" >> /etc/rc.d/rc.local \
&& chmod +x /etc/rc.d/rc.local \
&& ll /etc/rc.d/rc.local \
&& cat /proc/sys/net/ipv4/ip_forward
# 重启完成之后
cat /proc/sys/net/ipv4/ip_forward
# 结果为1 就可以了
```

在次执行上面命令[上面命令](#Workjoin) 即可完成本步操作

> 日志信息解读如下：

```sh
[root@k8s-node1 ~]# kubeadm join cluster-endpoint:6443 --token 5vxi8n.duexcrq774qnhb6z \
>     --discovery-token-ca-cert-hash sha256:e453bb83fa29e143827e884604a539d230f83beb60f1988ade45ede08a59ebf2
# 一些校验
[preflight] Running pre-flight checks
        [WARNING SystemVerification]: this Docker version is not on the list of validated versions: 26.1.3. Latest validated version: 19.03
        [WARNING Hostname]: hostname "k8s-node1" could not be reached
        [WARNING Hostname]: hostname "k8s-node1": lookup k8s-node1 on 114.114.114.114:53: no such host
[preflight] Reading configuration from the cluster...
[preflight] FYI: You can look at this config file with 'kubectl -n kube-system get cm kubeadm-config -o yaml'
[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"
[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"
[kubelet-start] Starting the kubelet
[kubelet-start] Waiting for the kubelet to perform the TLS Bootstrap...
# 节点已经加入到集群中
This node has joined the cluster:
* Certificate signing request was sent to apiserver and a response was received.
* The Kubelet was informed of the new secure connection details.
# 可以使用kubectl get nodes 在主节点上查看节点是否加入
Run 'kubectl get nodes' on the control-plane to see this node join the cluster.
```

`kubectl get nodes` 命令只能在主节点运行

> <font>切换到主节点上运行该命令查看k8s的全部节点信息</font>

![image20240523154215173](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231542258.png)

在master上查看pods的状态信息`kubectl get pods -A`

![image20240523154433624](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231544719.png)

### 2.安装dashboard

> 官方提供的k8s可视化界面 <font>在master上安装</font>

#### 2.1部署

```sh
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.3.1/aio/deploy/recommended.yaml
```

yaml的详细信息

```yaml
# Copyright 2017 The Kubernetes Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

apiVersion: v1
kind: Namespace
metadata:
  name: kubernetes-dashboard

---

apiVersion: v1
kind: ServiceAccount
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
  namespace: kubernetes-dashboard

---

kind: Service
apiVersion: v1
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
  namespace: kubernetes-dashboard
spec:
  ports:
    - port: 443
      targetPort: 8443
  selector:
    k8s-app: kubernetes-dashboard

---

apiVersion: v1
kind: Secret
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard-certs
  namespace: kubernetes-dashboard
type: Opaque

---

apiVersion: v1
kind: Secret
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard-csrf
  namespace: kubernetes-dashboard
type: Opaque
data:
  csrf: ""

---

apiVersion: v1
kind: Secret
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard-key-holder
  namespace: kubernetes-dashboard
type: Opaque

---

kind: ConfigMap
apiVersion: v1
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard-settings
  namespace: kubernetes-dashboard

---

kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
  namespace: kubernetes-dashboard
rules:
  # Allow Dashboard to get, update and delete Dashboard exclusive secrets.
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["kubernetes-dashboard-key-holder", "kubernetes-dashboard-certs", "kubernetes-dashboard-csrf"]
    verbs: ["get", "update", "delete"]
    # Allow Dashboard to get and update 'kubernetes-dashboard-settings' config map.
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["kubernetes-dashboard-settings"]
    verbs: ["get", "update"]
    # Allow Dashboard to get metrics.
  - apiGroups: [""]
    resources: ["services"]
    resourceNames: ["heapster", "dashboard-metrics-scraper"]
    verbs: ["proxy"]
  - apiGroups: [""]
    resources: ["services/proxy"]
    resourceNames: ["heapster", "http:heapster:", "https:heapster:", "dashboard-metrics-scraper", "http:dashboard-metrics-scraper"]
    verbs: ["get"]

---

kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
rules:
  # Allow Metrics Scraper to get metrics from the Metrics server
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods", "nodes"]
    verbs: ["get", "list", "watch"]

---

apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
  namespace: kubernetes-dashboard
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: kubernetes-dashboard
subjects:
  - kind: ServiceAccount
    name: kubernetes-dashboard
    namespace: kubernetes-dashboard

---

apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kubernetes-dashboard
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kubernetes-dashboard
subjects:
  - kind: ServiceAccount
    name: kubernetes-dashboard
    namespace: kubernetes-dashboard

---

kind: Deployment
apiVersion: apps/v1
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
  namespace: kubernetes-dashboard
spec:
  replicas: 1
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      k8s-app: kubernetes-dashboard
  template:
    metadata:
      labels:
        k8s-app: kubernetes-dashboard
    spec:
      containers:
        - name: kubernetes-dashboard
          image: kubernetesui/dashboard:v2.3.1
          imagePullPolicy: Always
          ports:
            - containerPort: 8443
              protocol: TCP
          args:
            - --auto-generate-certificates
            - --namespace=kubernetes-dashboard
            # Uncomment the following line to manually specify Kubernetes API server Host
            # If not specified, Dashboard will attempt to auto discover the API server and connect
            # to it. Uncomment only if the default does not work.
            # - --apiserver-host=http://my-address:port
          volumeMounts:
            - name: kubernetes-dashboard-certs
              mountPath: /certs
              # Create on-disk volume to store exec logs
            - mountPath: /tmp
              name: tmp-volume
          livenessProbe:
            httpGet:
              scheme: HTTPS
              path: /
              port: 8443
            initialDelaySeconds: 30
            timeoutSeconds: 30
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            runAsUser: 1001
            runAsGroup: 2001
      volumes:
        - name: kubernetes-dashboard-certs
          secret:
            secretName: kubernetes-dashboard-certs
        - name: tmp-volume
          emptyDir: {}
      serviceAccountName: kubernetes-dashboard
      nodeSelector:
        "kubernetes.io/os": linux
      # Comment the following tolerations if Dashboard must not be deployed on master
      tolerations:
        - key: node-role.kubernetes.io/master
          effect: NoSchedule

---

kind: Service
apiVersion: v1
metadata:
  labels:
    k8s-app: dashboard-metrics-scraper
  name: dashboard-metrics-scraper
  namespace: kubernetes-dashboard
spec:
  ports:
    - port: 8000
      targetPort: 8000
  selector:
    k8s-app: dashboard-metrics-scraper

---

kind: Deployment
apiVersion: apps/v1
metadata:
  labels:
    k8s-app: dashboard-metrics-scraper
  name: dashboard-metrics-scraper
  namespace: kubernetes-dashboard
spec:
  replicas: 1
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      k8s-app: dashboard-metrics-scraper
  template:
    metadata:
      labels:
        k8s-app: dashboard-metrics-scraper
      annotations:
        seccomp.security.alpha.kubernetes.io/pod: 'runtime/default'
    spec:
      containers:
        - name: dashboard-metrics-scraper
          image: kubernetesui/metrics-scraper:v1.0.6
          ports:
            - containerPort: 8000
              protocol: TCP
          livenessProbe:
            httpGet:
              scheme: HTTP
              path: /
              port: 8000
            initialDelaySeconds: 30
            timeoutSeconds: 30
          volumeMounts:
          - mountPath: /tmp
            name: tmp-volume
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            runAsUser: 1001
            runAsGroup: 2001
      serviceAccountName: kubernetes-dashboard
      nodeSelector:
        "kubernetes.io/os": linux
      # Comment the following tolerations if Dashboard must not be deployed on master
      tolerations:
        - key: node-role.kubernetes.io/master
          effect: NoSchedule
      volumes:
        - name: tmp-volume
          emptyDir: {}
```

#### 2.2开放端口

> <font>需要在master节点上操作</font>

```sh
# 首先来修改集群中的某个资源
kubectl edit svc kubernetes-dashboard -n kubernetes-dashboard
# 敲 /type:
# 输入i修改
type: ClusterIP 改为 type: NodePort
# wq 退出保存
# 类似于docker 的-p一样 暴露端口映射
```

继续查看暴露出的端口

```sh
kubectl get svc -A |grep kubernetes-dashboard
# 该端口就是访问控制台的端口号
[root@k8s-master ~]# kubectl get svc -A |grep kubernetes-dashboard
kubernetes-dashboard   dashboard-metrics-scraper   ClusterIP   10.96.240.77   <none>        8000/TCP                 7m28s
kubernetes-dashboard   kubernetes-dashboard        NodePort    10.96.39.213   <none>        443:32731/TCP            7m28s
# 32731就是端口号
```

![image20240523160609944](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231606058.png)

访问地址：https://192.168.70.123:32731/#/login

如果提示不是安全连接没有继续前往的按钮 就直接键盘敲击`thisisunsafe`

![image20240523162824658](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231628922.png)

#### 2.3令牌获取

> <font>需要在master节点上操作</font>

> 创建访问账号

```sh
#创建访问账号，准备一个yaml文件； 、
vi dash-user.yaml
```

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: admin-user
  namespace: kubernetes-dashboard
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: admin-user
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: admin-user
  namespace: kubernetes-dashboard
```

> 执行上述的yaml配置 生成pod

```sh
kubectl apply -f dash-user.yaml
```

> 获取令牌

```sh
#获取访问令牌
kubectl -n kubernetes-dashboard get secret $(kubectl -n kubernetes-dashboard get sa/admin-user -o jsonpath="{.secrets[0].name}") -o go-template="{{.data.token | base64decode}}"
```

> 令牌内容

```sh
eyJhbGciOiJSUzI1NiIsImtpZCI6ImIzT0gxS05GSDNGa3dWSkZ1WU1UN3g4ZFlDNGlZcGt6bHdNcjB2bVkzdFUifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJrdWJlcm5ldGVzLWRhc2hib2FyZCIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJhZG1pbi11c2VyLXRva2VuLXZmcXdjIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQubmFtZSI6ImFkbWluLXVzZXIiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC51aWQiOiJkNDYwYWU5Ni04MzJhLTQwNWQtYTY1Yi0zN2E5MzJjM2U1MGQiLCJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6a3ViZXJuZXRlcy1kYXNoYm9hcmQ6YWRtaW4tdXNlciJ9.oPQfL-BP8qhSrdrocuniYcdx1MzbtVepndailNtFJ0Xk6q4Jpn7nHzZi2tLq2B1-js-ng4KjktulC3ZOmnu-qUwiAb66GFvZ5E89frc9bbDDgGt8BP6_F-W6b3g_YsiczD0u4cFM_onpZ_7Yo5Ff3Ub6zYg3nQdRMtrRmzvQGQANySErWZy-HOzsvzxV6dykyaYDYnMxRDHanrdyCW1E3tOUqs8TQ2tXanDa5MAuHvGi1-uZqfEcuOOzZrjJ19qWNHjFc5xL5iJjC_ngzlcMLB4PsQBrsE9HddvNnEDqAylkRmRVzBHx1R7FW8JBLpGMKbXZBp30gCAuPyGSIqK6EQ
```

> 界面如下

![image20240523164134586](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231641871.png)

### 3.核心功能

#### 3.1【namespace】

> namespaces 命名空间

名称空间用来隔离资源

> 命令行获取名称空间

```sh
# 命令行获取名称空间
kubectl get ns
# 获取全部的应用 属于哪个应用空间
kubectl get pods -A
# 获取指定的名称空间里的应用 
kubectl get pods -n [namespace]
# 部署资源不指定名称空间的话 默认是default
# 创建hello的名称空间
kubectl create ns hello
# 删除hello的名称空间 会连带删除名称空间里的资源[需谨慎]
kubectl delete ns hello
```

> yaml创建名称空间

```yaml
# 指定版本号
apiVersion: v1
# 创建的类型是名称空间
kind: Namespace
# 元数据
metadata:
  # 名字是hello
  name: hello
```

![image20240523173844738](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231738968.png)

#### 3.2【pod】

pod是运行中的一组容器，pod是kubernetes中应用的最小单位

![image20240523174038519](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231740660.png)

> 命令行创建pod

```sh
# 命令行创建nginx 名字为mynginx 使用nginx镜像
kubectl run mynginx --image=nginx

# 查看default名称空间的Pod
kubectl get pod 
# 描述
kubectl describe pod 你自己的Pod名字
# 详情如下
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
    # 交给node1创建nginx
  Normal  Scheduled  111s  default-scheduler  Successfully assigned default/mynginx to k8s-node1
  Normal  Pulling    110s  kubelet            Pulling image "nginx"
  Normal  Pulled     85s   kubelet            Successfully pulled image "nginx" in 25.184892292s
  Normal  Created    84s   kubelet            Created container mynginx
  Normal  Started    84s   kubelet            Started container mynginx
# 在node1上查看应用
docker ps |grep mynginx
# 能找到该应用

# 删除 不给n 的话 就是默认名称空间 default
kubectl delete pod [Pod名字] -n [名称空间]
# 查看Pod的运行日志
kubectl logs [-f 持续输出] Pod名字

# 每个Pod - k8s都会分配一个ip
kubectl get pod -owide
# 使用Pod的ip+pod里面运行容器的端口 naginx 的默认端口是80
curl 192.169.36.69 

# 集群中的任意一个机器以及任意的应用都能通过Pod分配的ip来访问这个Pod

docker exec -it  mynginx  /bin/bash
kubectl exec -it mynginx -- /bin/bash
```

> 配置文件创建

```yaml
apiVersion: v1
# 资源类型 pod
kind: Pod
# 元数据
metadata:
  labels:
    run: mynginx
  name: mynginx
#  不指定命名空间的话就是默认default
#  namespace: default
#  详情
spec:
# 容器列表
  containers:
  # 镜像名称
  - image: nginx
  # 容器名称
    name: mynginx
```

`kubectl apply -f nginx-pod.yaml` 按照这个yaml 创建该pod

`kubectl delete -f nginx-pod.yaml` 按照当前yaml删除该pod

> 创建pod里多容器

```yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: myapp
  name: myapp
spec:
  containers:
  - image: nginx
    name: nginx
  - image: tomcat:8.5.68
    name: tomcat
```

![image20240524101739765](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241017922.png)

<details>
    <summary>访问nginx</summary>
    <p>
        先查看ip kubectl get pod -owide   192.169.169.131
    </p>
    <p>
        在查看nginx ：  192.169.169.131:80
    </p>
    <p>
        再查看tomcat：  192.169.169.131:8080
    </p>
</details>
<blockquote>
  <p>一个 pod 里的多个应用不能用同一个端口！！！</p>
  <p>会影响到 pod 的启用，导致 k8s 一直在尝试重启，均失败！</p>
</blockquote>


#### 3.3【**Deployment**】

> 无状态应用 ，控制Pod，使Pod拥有多副本，自愈，扩缩容

##### 3.3.1创建

> 使用命令行来完成deployment的创建

```sh
# 使用deployment的方式来创建mytomcat
kubectl create deployment mytomcat --image=tomcat:8.5.68
# 查询全部的deployment
kubectl get deploy
# 删除指定的deployment 删除后就不会自愈了
kubectl delete deploy [deployment的名称：mytomcat]
```

<blockquote alt="success"><p>使用Deployment创建的应用 直接操作pod删除之后会有自愈能力 不怕机器宕机和崩溃</p></blockquote>

##### 3.3.2 多副本

```sh
# 创建nginx 部署三份
kubectl create deployment my-dep --image=nginx --replicas=3
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: my-dep
  name: my-dep
spec:
#部署三份
  replicas: 3
  selector:
    matchLabels:
      app: my-dep
  template:
    metadata:
      labels:
        app: my-dep
    spec:
    #启动的镜像
      containers:
      - image: nginx
        name: nginx
```

##### 3.3.3扩缩容

```sh
# 变成5份
kubectl scale --replicas=5 deployment/my-dep
```

监控deploy状态

`watch -n 1 kubectl get deploy `

扩容到5份

`kubectl scale --replicas=5 deployment/my-dep`

修改副本

```sh
kubectl edit deployment my-dep

#修改 replicas 想要的副本量
```

##### 3.3.4自愈&故障转移

> 保证副本数量

- 停机
- 删除pod
- 容器崩溃
- ...

##### 3.3.5滚动更新 不停机更新

```sh
kubectl set image deployment/my-dep nginx=nginx:1.16.1 --record
kubectl rollout status deployment/my-dep

#修改yaml文件也可以实现滚动更新
kubectl edit deployment/my-dep
```

##### 3.3.6版本回退 也是滚动更新的过程

```sh
#历史记录
kubectl rollout history deployment/my-dep

#查看某个历史详情
kubectl rollout history deployment/my-dep --revision=2

#回滚(回到上次)
kubectl rollout undo deployment/my-dep

#回滚(回到指定版本)
kubectl rollout undo deployment/my-dep --to-revision=2

# 查看最新使用的镜像版本号
kubectl get deploy/my-dep -oyaml|grep image
```

![image20240524130242609](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241302924.png)

> 更多：
> 除了Deployment，k8s还有 StatefulSet 、DaemonSet 、Job 等 类型资源。我们都称为 工作负载。
> 有状态应用使用 StatefulSet 部署，无状态应用使用 Deployment 部署
> https://kubernetes.io/zh/docs/concepts/workloads/controllers/

#### 3.4【Service】

> 将一组pods公开为网络服务的抽象方法

![image20240524130717894](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241307052.png)

配置service 的地址 可以负载均衡的方式来访问pod 带服务发现

service 服务发现 其中一个宕机后会想另一个pod进行请求

> 命令行的方式

```sh
#暴露Deploy 
# 在集群内使用service的ip:port就可以负载均衡的访问
kubectl expose deployment my-dep --port=8000 --target-port=80

# 获取服务列表
kubectl get service
# 等同于
kubectl get svc

# 负载均衡 集群内有效
curl 10.96.90.94:8000
# 可以通过服务名进行访问
curl my-dep:8000

#使用标签检索Pod
kubectl get pod -l app=my-dep

# 创建tomcat
kubectl create deploy my-tomcat --image=tomcat
```

> yaml的方式

```yaml
apiVersion: v1
#类型
kind: Service
metadata:
  labels:
    app: my-dep
  name: my-dep
spec:
# 选择 哪一组pod进行暴露
  selector:
  #标签 进行选择同样的一组pod 名字叫app 值是my-dep的pod进行统一暴露
    app: my-dep
  ports:
  # 暴露出的端口号 外边请求用这个
  - port: 8000
    protocol: TCP
    # 里面的映射端口 pod里的都是80 
    targetPort: 80
```

```sh
# 负载均衡 集群内有效
curl 10.96.90.94:8000
curl my-dep:8000
# 可以通过服务名进行访问  my-dep[.defult 命名空间]
curl my-dep.defult:8000
```

##### 3.4.1 **ClusterIP**

集群IP 只能在集群里访问

```sh
# 等同于没有--type的 默认值就是ClusterIP 只能在集群内部进行访问
kubectl expose deployment my-dep --port=8000 --target-port=80 --type=ClusterIP
```

```yaml
apiVersion: v1
kind: Service
metadata:
  labels:
    app: my-dep
  name: my-dep
spec:
  ports:
  - port: 8000
    protocol: TCP
    targetPort: 80
  selector:
    app: my-dep
  type: ClusterIP
```

##### 3.4.2NodePort

```sh
kubectl expose deployment my-dep --port=8000 --target-port=80 --type=NodePort
```

```yaml
apiVersion: v1
kind: Service
metadata:
  labels:
    app: my-dep
  name: my-dep
spec:
  ports:
  - port: 8000
    protocol: TCP
    targetPort: 80
  selector:
    app: my-dep
  type: NodePort
```

<blockquote alt="warn"><p>NodePort范围在 30000-32767 之间</p></blockquote>

![image20240524142146063](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241421276.png)

> 注：上述的30984是开放在每一个服务器的端口上的 包括master节点以及node节点

#### 3.5【**Ingress**】

##### 3.5.1 架构

> Service的统一网关入口 总网关
>
> service 统一pod
>
> ingress 统一service

入口的意思 k8s希望 它 成为集群流量的唯一入口

pod 请求service ==> service 调用别的pod

![image20240524144336199](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241443378.png)

![image20240524150555342](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241505506.png)

![image20240524150514934](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241505063.png)

##### 3.5.2 安装

> 命令行下载

```sh
wget https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v0.47.0/deploy/static/provider/baremetal/deploy.yaml

#修改镜像
vi deploy.yaml
#将image的值改为如下值：
registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/ingress-nginx-controller:v0.46.0

# 检查安装的结果
kubectl get pod,svc -n ingress-nginx

# 最后别忘记把svc暴露的端口要放行
```

> yaml下载

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx

---
# Source: ingress-nginx/templates/controller-serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: controller
  name: ingress-nginx
  namespace: ingress-nginx
automountServiceAccountToken: true
---
# Source: ingress-nginx/templates/controller-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: controller
  name: ingress-nginx-controller
  namespace: ingress-nginx
data:
---
# Source: ingress-nginx/templates/clusterrole.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
  name: ingress-nginx
rules:
  - apiGroups:
      - ''
    resources:
      - configmaps
      - endpoints
      - nodes
      - pods
      - secrets
    verbs:
      - list
      - watch
  - apiGroups:
      - ''
    resources:
      - nodes
    verbs:
      - get
  - apiGroups:
      - ''
    resources:
      - services
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - extensions
      - networking.k8s.io   # k8s 1.14+
    resources:
      - ingresses
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - ''
    resources:
      - events
    verbs:
      - create
      - patch
  - apiGroups:
      - extensions
      - networking.k8s.io   # k8s 1.14+
    resources:
      - ingresses/status
    verbs:
      - update
  - apiGroups:
      - networking.k8s.io   # k8s 1.14+
    resources:
      - ingressclasses
    verbs:
      - get
      - list
      - watch
---
# Source: ingress-nginx/templates/clusterrolebinding.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
  name: ingress-nginx
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: ingress-nginx
subjects:
  - kind: ServiceAccount
    name: ingress-nginx
    namespace: ingress-nginx
---
# Source: ingress-nginx/templates/controller-role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: controller
  name: ingress-nginx
  namespace: ingress-nginx
rules:
  - apiGroups:
      - ''
    resources:
      - namespaces
    verbs:
      - get
  - apiGroups:
      - ''
    resources:
      - configmaps
      - pods
      - secrets
      - endpoints
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - ''
    resources:
      - services
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - extensions
      - networking.k8s.io   # k8s 1.14+
    resources:
      - ingresses
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - extensions
      - networking.k8s.io   # k8s 1.14+
    resources:
      - ingresses/status
    verbs:
      - update
  - apiGroups:
      - networking.k8s.io   # k8s 1.14+
    resources:
      - ingressclasses
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - ''
    resources:
      - configmaps
    resourceNames:
      - ingress-controller-leader-nginx
    verbs:
      - get
      - update
  - apiGroups:
      - ''
    resources:
      - configmaps
    verbs:
      - create
  - apiGroups:
      - ''
    resources:
      - events
    verbs:
      - create
      - patch
---
# Source: ingress-nginx/templates/controller-rolebinding.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: controller
  name: ingress-nginx
  namespace: ingress-nginx
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: ingress-nginx
subjects:
  - kind: ServiceAccount
    name: ingress-nginx
    namespace: ingress-nginx
---
# Source: ingress-nginx/templates/controller-service-webhook.yaml
apiVersion: v1
kind: Service
metadata:
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: controller
  name: ingress-nginx-controller-admission
  namespace: ingress-nginx
spec:
  type: ClusterIP
  ports:
    - name: https-webhook
      port: 443
      targetPort: webhook
  selector:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/component: controller
---
# Source: ingress-nginx/templates/controller-service.yaml
apiVersion: v1
kind: Service
metadata:
  annotations:
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: controller
  name: ingress-nginx-controller
  namespace: ingress-nginx
spec:
  type: NodePort
  ports:
    - name: http
      port: 80
      protocol: TCP
      targetPort: http
    - name: https
      port: 443
      protocol: TCP
      targetPort: https
  selector:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/component: controller
---
# Source: ingress-nginx/templates/controller-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: controller
  name: ingress-nginx-controller
  namespace: ingress-nginx
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: ingress-nginx
      app.kubernetes.io/instance: ingress-nginx
      app.kubernetes.io/component: controller
  revisionHistoryLimit: 10
  minReadySeconds: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ingress-nginx
        app.kubernetes.io/instance: ingress-nginx
        app.kubernetes.io/component: controller
    spec:
      dnsPolicy: ClusterFirst
      containers:
        - name: controller
          image: registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/ingress-nginx-controller:v0.46.0
          imagePullPolicy: IfNotPresent
          lifecycle:
            preStop:
              exec:
                command:
                  - /wait-shutdown
          args:
            - /nginx-ingress-controller
            - --election-id=ingress-controller-leader
            - --ingress-class=nginx
            - --configmap=$(POD_NAMESPACE)/ingress-nginx-controller
            - --validating-webhook=:8443
            - --validating-webhook-certificate=/usr/local/certificates/cert
            - --validating-webhook-key=/usr/local/certificates/key
          securityContext:
            capabilities:
              drop:
                - ALL
              add:
                - NET_BIND_SERVICE
            runAsUser: 101
            allowPrivilegeEscalation: true
          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: LD_PRELOAD
              value: /usr/local/lib/libmimalloc.so
          livenessProbe:
            failureThreshold: 5
            httpGet:
              path: /healthz
              port: 10254
              scheme: HTTP
            initialDelaySeconds: 10
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 1
          readinessProbe:
            failureThreshold: 3
            httpGet:
              path: /healthz
              port: 10254
              scheme: HTTP
            initialDelaySeconds: 10
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 1
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
            - name: https
              containerPort: 443
              protocol: TCP
            - name: webhook
              containerPort: 8443
              protocol: TCP
          volumeMounts:
            - name: webhook-cert
              mountPath: /usr/local/certificates/
              readOnly: true
          resources:
            requests:
              cpu: 100m
              memory: 90Mi
      nodeSelector:
        kubernetes.io/os: linux
      serviceAccountName: ingress-nginx
      terminationGracePeriodSeconds: 300
      volumes:
        - name: webhook-cert
          secret:
            secretName: ingress-nginx-admission
---
# Source: ingress-nginx/templates/admission-webhooks/validating-webhook.yaml
# before changing this value, check the required kubernetes version
# https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#prerequisites
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: admission-webhook
  name: ingress-nginx-admission
webhooks:
  - name: validate.nginx.ingress.kubernetes.io
    matchPolicy: Equivalent
    rules:
      - apiGroups:
          - networking.k8s.io
        apiVersions:
          - v1beta1
        operations:
          - CREATE
          - UPDATE
        resources:
          - ingresses
    failurePolicy: Fail
    sideEffects: None
    admissionReviewVersions:
      - v1
      - v1beta1
    clientConfig:
      service:
        namespace: ingress-nginx
        name: ingress-nginx-controller-admission
        path: /networking/v1beta1/ingresses
---
# Source: ingress-nginx/templates/admission-webhooks/job-patch/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ingress-nginx-admission
  annotations:
    helm.sh/hook: pre-install,pre-upgrade,post-install,post-upgrade
    helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: admission-webhook
  namespace: ingress-nginx
---
# Source: ingress-nginx/templates/admission-webhooks/job-patch/clusterrole.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ingress-nginx-admission
  annotations:
    helm.sh/hook: pre-install,pre-upgrade,post-install,post-upgrade
    helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: admission-webhook
rules:
  - apiGroups:
      - admissionregistration.k8s.io
    resources:
      - validatingwebhookconfigurations
    verbs:
      - get
      - update
---
# Source: ingress-nginx/templates/admission-webhooks/job-patch/clusterrolebinding.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ingress-nginx-admission
  annotations:
    helm.sh/hook: pre-install,pre-upgrade,post-install,post-upgrade
    helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: admission-webhook
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: ingress-nginx-admission
subjects:
  - kind: ServiceAccount
    name: ingress-nginx-admission
    namespace: ingress-nginx
---
# Source: ingress-nginx/templates/admission-webhooks/job-patch/role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ingress-nginx-admission
  annotations:
    helm.sh/hook: pre-install,pre-upgrade,post-install,post-upgrade
    helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: admission-webhook
  namespace: ingress-nginx
rules:
  - apiGroups:
      - ''
    resources:
      - secrets
    verbs:
      - get
      - create
---
# Source: ingress-nginx/templates/admission-webhooks/job-patch/rolebinding.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ingress-nginx-admission
  annotations:
    helm.sh/hook: pre-install,pre-upgrade,post-install,post-upgrade
    helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: admission-webhook
  namespace: ingress-nginx
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: ingress-nginx-admission
subjects:
  - kind: ServiceAccount
    name: ingress-nginx-admission
    namespace: ingress-nginx
---
# Source: ingress-nginx/templates/admission-webhooks/job-patch/job-createSecret.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: ingress-nginx-admission-create
  annotations:
    helm.sh/hook: pre-install,pre-upgrade
    helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: admission-webhook
  namespace: ingress-nginx
spec:
  template:
    metadata:
      name: ingress-nginx-admission-create
      labels:
        helm.sh/chart: ingress-nginx-3.33.0
        app.kubernetes.io/name: ingress-nginx
        app.kubernetes.io/instance: ingress-nginx
        app.kubernetes.io/version: 0.47.0
        app.kubernetes.io/managed-by: Helm
        app.kubernetes.io/component: admission-webhook
    spec:
      containers:
        - name: create
          image: docker.io/jettech/kube-webhook-certgen:v1.5.1
          imagePullPolicy: IfNotPresent
          args:
            - create
            - --host=ingress-nginx-controller-admission,ingress-nginx-controller-admission.$(POD_NAMESPACE).svc
            - --namespace=$(POD_NAMESPACE)
            - --secret-name=ingress-nginx-admission
          env:
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
      restartPolicy: OnFailure
      serviceAccountName: ingress-nginx-admission
      securityContext:
        runAsNonRoot: true
        runAsUser: 2000
---
# Source: ingress-nginx/templates/admission-webhooks/job-patch/job-patchWebhook.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: ingress-nginx-admission-patch
  annotations:
    helm.sh/hook: post-install,post-upgrade
    helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded
  labels:
    helm.sh/chart: ingress-nginx-3.33.0
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/version: 0.47.0
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/component: admission-webhook
  namespace: ingress-nginx
spec:
  template:
    metadata:
      name: ingress-nginx-admission-patch
      labels:
        helm.sh/chart: ingress-nginx-3.33.0
        app.kubernetes.io/name: ingress-nginx
        app.kubernetes.io/instance: ingress-nginx
        app.kubernetes.io/version: 0.47.0
        app.kubernetes.io/managed-by: Helm
        app.kubernetes.io/component: admission-webhook
    spec:
      containers:
        - name: patch
          image: docker.io/jettech/kube-webhook-certgen:v1.5.1
          imagePullPolicy: IfNotPresent
          args:
            - patch
            - --webhook-name=ingress-nginx-admission
            - --namespace=$(POD_NAMESPACE)
            - --patch-mutating=false
            - --secret-name=ingress-nginx-admission
            - --patch-failure-policy=Fail
          env:
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
      restartPolicy: OnFailure
      serviceAccountName: ingress-nginx-admission
      securityContext:
        runAsNonRoot: true
        runAsUser: 2000
```

![image20240524151545856](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241515066.png)

以nodeport的方式端口暴露出来Ingress 网关路由

> 使用 ： 底层就是nginx
>
> 官网地址：https://kubernetes.github.io/ingress-nginx/
>
> https：https://192.168.70.123:32252/
>
> http：http://192.168.70.123:32022/

##### 3.5.3 测试

> 测试环境所需要的yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hello-server
  template:
    metadata:
      labels:
        app: hello-server
    spec:
      containers:
      - name: hello-server
        image: registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/hello-server
        ports:
        - containerPort: 9000
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: nginx-demo
  name: nginx-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-demo
  template:
    metadata:
      labels:
        app: nginx-demo
    spec:
      containers:
      - image: nginx
        name: nginx
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: nginx-demo
  name: nginx-demo
spec:
  selector:
    app: nginx-demo
  ports:
  - port: 8000
    protocol: TCP
    targetPort: 80
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: hello-server
  name: hello-server
spec:
  selector:
    app: hello-server
  ports:
  - port: 8000
    protocol: TCP
    targetPort: 9000
```

> 域名访问

```sh
apiVersion: networking.k8s.io/v1
# 创建类型为Ingress
kind: Ingress  
metadata:
# 起一个名字 不重复 见名知意
  name: ingress-host-bar
spec:
  ingressClassName: nginx
  # 设置规则
  rules:
  # 设置域名
  - host: "hello.silence.com"
    http:
      paths:
      # 给我的前缀模式
      - pathType: Prefix
      #路径是/
        path: "/"
        # 后台服务转交
        backend:
        # 指定service
          service:
          # 具体的server名
            name: hello-server
            # server的端口8000
            port:
              number: 8000
  - host: "demo.silence.com"
    http:
      paths:
      - pathType: Prefix
        path: "/nginx"  # 把请求会转给下面的服务，下面的服务一定要能处理这个路径，不能处理就是404
        backend:
          service:
            name: nginx-demo  ## java，比如使用路径重写，去掉前缀nginx
            port:
              number: 8000
```

查看集群里有多少个规则

`kubectl get ingress`

![image20240524154302321](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241543424.png)

访问：http://hello.silence.com:32022/

![image20240524155256914](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241552012.png)

访问：http://demo.silence.com:32022/

![image20240524160535467](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241605698.png)

`实现根据不同的域名得到不同的服务内容`

##### 3.5.4 修改

```sh
#查看全部的ingress 缩写ing
kubctl get ing 
# 修改
kubectl edit ing ingress-host-bar -n 名称空间[default可以省略]
：wq 保存生效
```

问题： path: "/nginx" 与 path: "/" 一个是ingress能解析到 一个是nginx能解析到

> 路径重写

```yaml
apiVersion: networking.k8s.io/v1
# 创建类型为Ingress
kind: Ingress  
metadata:
# 路径重写 开启高级功能 注解信息 
# $2 就是以$为分隔符 后面的东西是我们要的 前面的东西是我们不要的
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
# 起一个名字 不重复 见名知意
  name: ingress-host-bar
spec:
  ingressClassName: nginx
  # 设置规则
  rules:
  # 设置域名
  - host: "hello.develop.com"
    http:
      paths:
      # 给我的前缀模式
      - pathType: Prefix
      #路径是/
        path: "/"
        # 后台服务转交
        backend:
        # 指定service
          service:
          # 具体的server名
            name: hello-server
            # server的端口8000
            port:
              number: 8000
  - host: "demo.develop.com"
    http:
      paths:
      - pathType: Prefix
        path: "/nginx(/|$)(.*)"  # 把请求会转给下面的服务，下面的服务一定要能处理这个路径，不能处理就是404
        backend:
          service:
            name: nginx-demo  ## java，比如使用路径重写，去掉前缀nginx
            port:
              number: 8000
```

> 流量限制 每秒放进去一个

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-limit-rate
  annotations:
    nginx.ingress.kubernetes.io/limit-rps: "1"
spec:
  ingressClassName: nginx
  rules:
  - host: "haha.develop.com"
    http:
      paths:
      # 精确模式 必须是/才会分发到这个服务里
      - pathType: Exact
        path: "/"
        backend:
          service:
            name: nginx-demo
            port:
              number: 8000
```

访问： http://haha.silence.com:32022/ 有限流结果503 限流结果503

![image20240524163337814](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241633976.png)

### 4.存储抽象

> 数据持久化

#### 4.1架构

![img](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241653331.png)

#### 4.2搭建网络文件系统

![image20240524165355431](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241653592.png)

#### 4.3环境准备

> 所有节点

```sh
#所有机器安装
yum install -y nfs-utils
```

<blockquote alt="warn"><p>
    主节点安装
    </p> </blockquote>

```sh
#nfs主节点
# 在master上暴露 /nfs/data/ 牡蛎  以非安全的 读写的方式 进行同步
echo "/nfs/data/ *(insecure,rw,sync,no_root_squash)" > /etc/exports

mkdir -p /nfs/data
# 启动rpcbind 服务
systemctl enable rpcbind --now
# 启动 nfs 服务  开启自启 现在也启动
systemctl enable nfs-server --now
#配置生效
exportfs -r
```

<blockquote><p>
    子节点安装
    </p>
</blockquote>
```sh
# ip地址是master上的ip地址
# 可以看一下哪些目录可以挂载  [检查命令]
showmount -e 192.168.70.123

#执行以下命令挂载 nfs 服务器上的共享目录到本机路径 /root/nfsmount
# 目录可以与master的不一致
mkdir -p /nfs/data
# 挂载远程这个服务器的地址加暴露的文件夹   我本地的文件夹 
# 进行同步
mount -t nfs 192.168.70.123:/nfs/data /nfs/data
# 任何一台机器 写入一个测试文件 
# 其他机器都会获得同步 删除也是一样
echo "hello nfs server" > /nfs/data/test.txt
```

#### 4.4原生方式挂载pod数据

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: nginx-pv-demo
  name: nginx-pv-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-pv-demo
  template:
    metadata:
      labels:
        app: nginx-pv-demo
    spec:
      containers:
      - image: nginx
        name: nginx
        volumeMounts:
        # 内部的/usr/share/nginx/html 文件夹挂载到外部叫html
        - name: html
          mountPath: /usr/share/nginx/html
      volumes:
      # 这个就是上面指定的name 的html
        - name: html
        # 指定挂载方式
          nfs:
          # 最终映射到 当前服务器ip的具体路径
            server: 192.168.70.123
            path: /nfs/data/nginx-pv
```

![image20240524171306564](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241713681.png)

问题：

1. 每次挂载新的目录都需要在服务器上创建对应的文件夹！ 要不然会挂载失败
2. 把这次部署给删掉之后会发现持久化的内容还在！不会自动清理
3. 对每个pod 所使用的空间没有限制 没有做容量上的等等限制

#### 4.5PV&PVC

> PV：持久卷（Persistent Volume），将应用需要持久化的数据保存到指定位置
> PVC：持久卷申明（Persistent Volume Claim），申明需要使用的持久卷规格

- 持久卷就是要挂载的目录
- 持久卷申明就是我要做的限制
- 也是就申请书 上面要多少空间 我按照申请书给你空间

##### 4.5.1 创建PV池

> 静态供应

```sh
#nfs主节点 创建三个文件夹
mkdir -p /nfs/data/01
mkdir -p /nfs/data/02
mkdir -p /nfs/data/03
```

> 创建PV

```yaml
apiVersion: v1
# PV 持久化卷
kind: PersistentVolume
metadata:
# 名字自定义 见名知意
  name: pv01-10m
spec:
  capacity:
  # 这个卷只用10M的空间
    storage: 10M
  accessModes:
  # 可读可写多节点
    - ReadWriteMany
  # 名字随便起 下面对应好
  storageClassName: nfs
  nfs:
  # 要在nfs上挂载的目录与主节点的ip地址
    path: /nfs/data/01
    server: 192.168.70.123
# 三个短横线表示分割一个完整的文档
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv02-1gi
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteMany
  storageClassName: nfs
  nfs:
    path: /nfs/data/02
    server: 192.168.70.123
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv03-3gi
spec:
  capacity:
    storage: 3Gi
  accessModes:
    - ReadWriteMany
  storageClassName: nfs
  nfs:
    path: /nfs/data/03
    server: 192.168.70.123
```

![image20240524173935279](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241739424.png)

获取系统中的=PV资源列表 ` kubectl get persistentvolume`简写：`kubectl get pv`

![image20240524174114558](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241741674.png)

##### 4.5.2PVC的创建与绑定

> 创建PVC

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: nginx-pvc
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
    # 申请一个200M的空间
      storage: 200Mi
  # 要与上次创建pv的时候要一致
  storageClassName: nfs
```

> 创建PVC ` kubectl apply -f pvc-create.yaml`

> 查看PV列表 `kubectl get pv`
>
> 结果是绑定到了1G的 因为10M的不够3G 的太大了 所以就选中了1G的

![image20240524174616310](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241746466.png)

##### 4.5.3创建pod绑定PVC

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: nginx-deploy-pvc
  name: nginx-deploy-pvc
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-deploy-pvc
  template:
    metadata:
      labels:
        app: nginx-deploy-pvc
    spec:
      containers:
      - image: nginx
        name: nginx
        volumeMounts:
        - name: html
        # 内部的这块内容与申请书的内容绑定起来
          mountPath: /usr/share/nginx/html
      volumes:
        - name: html
        # 指定申请书要用的空间
          persistentVolumeClaim:
            claimName: nginx-pvc
```

> 编辑 创建一个yaml文件 vi nginx-pvc-pod.yaml

![image20240524175308416](https://gitee.com/qixiangyang/pictures/raw/master/images/202405241753637.png)

#### 4.6ConfigMap

> 配置的集合 全部存在ETCD中 【明文信息】

##### 4.6.1Redis示例

> Redis的配置文件

```sh
vi redis.conf
# 内容
appendonly yes

# 创建configmap 简称
# 使用配置文件做成k8s的configmap配置集
kubectl create cm redis-conf --from-file=redis.conf

# 之前引用的redis.conf 就没有用了 可以删掉了
rm -rf redis.conf

# 使用yaml 的格式查看配置集的详情信息
kubectl get cm redis-conf -oyaml
```

![image20240526182045402](https://gitee.com/qixiangyang/pictures/raw/master/images/202405261820508.png)

`kubectl get cm redis-conf -oyaml`

```yaml
apiVersion: v1
# data里面是所有的真正的数据
data:
# 文件名是key value就是配置文件的内容 
# 短竖线 是大文本
  redis.conf: |
    appendonly yes
# 资源的类型 配置集
kind: ConfigMap
metadata:
  creationTimestamp: "2024-05-26T08:52:03Z"
  managedFields:
  - apiVersion: v1
    fieldsType: FieldsV1
    fieldsV1:
      f:data:
        .: {}
        f:redis.conf: {}
    manager: kubectl-create
    operation: Update
    time: "2024-05-26T08:52:03Z"
  # 每一个资源的名字
  name: redis-conf
  namespace: default
  resourceVersion: "71919"
  uid: 5373b7ed-5819-4cdb-8cb5-5701a577072a
```

> 启动一个pod 让这个pod 使用这个配置集作为配置

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: redis
spec:
  containers:
  - name: redis
    image: redis
    command:
    # redis启动的时候 使用自定义启动命令来加载我的redis配置文件
      - redis-server
      # 里面的内容是下面已经使用cm配置集做好的文件内容
      - "/redis-master/redis.conf"  #指的是redis容器内部的位置
    ports:
    - containerPort: 6379
    # 卷挂载 将redis里的目录 mountPath: /data进行挂载
    # 以名字为data的方式挂载  
    volumeMounts:
    - mountPath: /data
      name: data
    # /redis-master 目录的配置以名称为为config的方式挂载
    - mountPath: /redis-master
      name: config
  volumes:
  # 15行中的 以名字为data的方式如下 
    - name: data
      # 随便找一个空目录进行挂载
      emptyDir: {}
  # 19行中名称为config的挂载方式为configmap 配置集挂载
    - name: config
      configMap:
      # 配置集挂载的名称是上一步创建好的redis-conf的cm配置集
        name: redis-conf
        # items来获取cm配置文件中配置集的data的所有项
        items:
        # 引入一个名字叫redis.conf 的这个配置 在上面创建cpnfigmap的第六行
        # 是cm的key值 来引用这个key作为redis的配置信息
        - key: redis.conf
        # 配置信息放到这个路径下  这个路径是放在/redis-master 下面的 20行
        # 就完成了redis 的pod内部的 /redis-master下的redis.conf的配置挂载
          path: redis.conf
```

`kubectl apply -f redis-create.yaml` 创建redis

> 使用configMap做系统的配置集的好处是：
>
> 如果把redis的配置文件改了 它在内部会自动改掉

`kubectl edit cm redis-conf`

修改配置文件为 requirepass 123456

![image20240526184953352](https://gitee.com/qixiangyang/pictures/raw/master/images/202405261849436.png)

![image20240526185047375](https://gitee.com/qixiangyang/pictures/raw/master/images/202405261850444.png)

然后在redis的容器内部进行等待数据同步 **大概半分钟**

如果中间件有**热更新** 就相当于跟nacos配置中心的功能是一样的了

> 检查指定文件内容是否已经更新
> 修改了CM。Pod里面的配置文件会跟着变

![image20240526185125640](https://gitee.com/qixiangyang/pictures/raw/master/images/202405261851690.png)

> 注 这里的配置文件只是配置进去了 没有重启
>
> redis还是沿用原来的配置信息
>
> 如果需要引用最新的配置 需要进行服务重启 才可以完成密码的配置更新

![image20240526185507485](https://gitee.com/qixiangyang/pictures/raw/master/images/202405261855540.png)

> 配置值未更改，因为需要**重新启动 Pod** 才能从关联的 ConfigMap 中获取更新的值。
> 原因：我们的Pod部署的中间件自己本身没有热更新能力

#### 4.7Secret

> Secret 对象类型用来保存敏感信息，例如密码、OAuth 令牌和 SSH 密钥。 将这些信息放在 secret 中比放在 [Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/) 的定义或者 [容器镜像](https://kubernetes.io/zh/docs/reference/glossary/?all=true#term-image) 中来说更加安全和灵活。【私有信息】

首先不配置docker 信息去下载镜像`访问拒绝`

![image20240526192240681](https://gitee.com/qixiangyang/pictures/raw/master/images/202405261922749.png)

##### 4.7.1创建方式

```sh
# 语法格式
kubectl create secret docker-registry <secret-name> 秘钥名称 \
  --docker-server=<docker-server> docker 服务器地址\
  --docker-username=<docker-username> 用户名 \
  --docker-password=<docker-password> 密码 \
  [--docker-email=<docker-email>] 邮箱是选填的 \
  [--dry-run=client|server|none]
```

> 命令内容

```sh
kubectl create secret docker-registry develop-docker \
--docker-server=registry.cn-hangzhou.aliyuncs.com \
--docker-username=xy5314 \
--docker-password=Yang53146925 \
--docker-email=852448345@qq.com
```

> 查看秘钥 `kubectl get secret`

![image20240526193537178](https://gitee.com/qixiangyang/pictures/raw/master/images/202405261935242.png)

> 查看详情信息 `kubectl get secret silence-docker -oyaml`

![image20240526193657160](https://gitee.com/qixiangyang/pictures/raw/master/images/202405261936336.png)

> data部分被加密了 base64加密了的

##### 4.7.2使用方法

> 创建一个使用秘钥拉取镜像的pod文件

`vi silence-aliyun-private-docker.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-docker-image
spec:
  containers:
  - name: private-docker-image
    image: registry.cn-hangzhou.aliyuncs.com/silecne/images:1.0
  imagePullSecrets:
  - name: develop-docker
```

` kubectl apply -f silence-aliyun-private-docker.yaml`

创建镜像文件信息

![image20240526194421764](https://gitee.com/qixiangyang/pictures/raw/master/images/202405261944839.png)

在控制面板查看创建结果

![image20240526195619341](https://gitee.com/qixiangyang/pictures/raw/master/images/202405261956415.png)

## **KubeSphere平台安装**

### 1.基础环境搭建

#### 1.1网络配置

> 固定IP

```sh
# 网关 192.168.70.2
master 192.168.70.127   255.255.255.0
node1  192.168.70.128   255.255.255.0
node2  192.168.70.129   255.255.255.0

yum install vim
# 修改配置文件 如下：
vim /etc/sysconfig/network-scripts/ifcfg-ens33
# 重启网络服务
systemctl restart network

TYPE="Ethernet"
PROXY_METHOD="none"
BROWSER_ONLY="no"
BOOTPROTO="static"
DEFROUTE="yes"
IPV4_FAILURE_FATAL="no"
IPV6INIT="yes"
IPV6_AUTOCONF="yes"
IPV6_DEFROUTE="yes"
IPV6_FAILURE_FATAL="no"
IPV6_ADDR_GEN_MODE="stable-privacy"
NAME="ens33"
UUID="2685f5d0-40d6-475d-9910-7bfb9b037d23"
DEVICE="ens33"
ONBOOT="yes"
IPADDR="192.168.70.127"
PREFIX="24"
GATEWAY="192.168.70.2"
DNS1="114.114.114.114"
IPV6_PRIVACY="no"
```

#### 1.2安装docker

```sh
sudo yum remove docker*
sudo yum install -y yum-utils

#配置docker的yum地址
sudo yum-config-manager \
--add-repo \
http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo


#安装指定版本
yum install -y docker-ce-20.10.7 docker-ce-cli-20.10.7  containerd.io-1.4.6

#    启动&开机启动docker
systemctl enable docker --now

# docker加速配置
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": ["https://82m9ar63.mirror.aliyuncs.com"],
  "exec-opts": ["native.cgroupdriver=systemd"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m"
  },
  "storage-driver": "overlay2"
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

> 关闭防火墙

```sh
# 停止firewalld服务：
systemctl stop firewalld
# 禁用firewalld服务开机自启动：
systemctl disable firewalld
# 检查防火墙状态是否已停止：
systemctl status firewalld
```

> 随后克隆两台机器

```sh
#设置每个机器自己的hostname
hostnamectl set-hostname xxx

# 将 SELinux 设置为 permissive 模式（相当于将其禁用）
sudo setenforce 0
sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config

#关闭swap
swapoff -a  
sed -ri 's/.*swap.*/#&/' /etc/fstab

#允许 iptables 检查桥接流量
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
br_netfilter
EOF

cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-ip6tables = 1
net.bridge.bridge-nf-call-iptables = 1
EOF
sudo sysctl --system
```

#### 1.3安装一下k8s三大件

> **安装kubelet、kubeadm、kubectl** 三大件

```sh
#配置k8s的yum源地址
cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=http://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-x86_64
enabled=1
gpgcheck=0
repo_gpgcheck=0
gpgkey=http://mirrors.aliyun.com/kubernetes/yum/doc/yum-key.gpg
   http://mirrors.aliyun.com/kubernetes/yum/doc/rpm-package-key.gpg
EOF


#安装 kubelet，kubeadm，kubectl
sudo yum install -y kubelet-1.20.9 kubeadm-1.20.9 kubectl-1.20.9

#启动kubelet
sudo systemctl enable --now kubelet

#所有机器配置master域名
echo "192.168.70.127  k8s-master" >> /etc/hosts
```

#### 1.4初始化master节点【只在master做】

##### 1.4.1初始化master

```sh
kubeadm init \
--apiserver-advertise-address=192.168.70.127 \
--control-plane-endpoint=k8s-master \
--image-repository registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images \
--kubernetes-version v1.20.9 \
--service-cidr=10.96.0.0/16 \
--pod-network-cidr=192.170.0.0/16
```

> 成功关键的成功信息
>
> 【记录master执行完成后的日志】

```sh
Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

Alternatively, if you are the root user, you can run:

  export KUBECONFIG=/etc/kubernetes/admin.conf

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/

You can now join any number of control-plane nodes by copying certificate authorities
and service account keys on each node and then running the following as root:

  kubeadm join k8s-master:6443 --token p2d33t.psv19fq344vqtyxh \
    --discovery-token-ca-cert-hash sha256:93cf5f604729f46c1a2dd49c72a154ac4a1e46ebebb217e1bfb71435a28fe704 \
    --control-plane 

Then you can join any number of worker nodes by running the following on each as root:

kubeadm join k8s-master:6443 --token p2d33t.psv19fq344vqtyxh \
    --discovery-token-ca-cert-hash sha256:93cf5f604729f46c1a2dd49c72a154ac4a1e46ebebb217e1bfb71435a28fe704 
```

> 执行命令 把核心管理员配置文件放到root目录下
>
> 命令行才可以操作集群

```sh
  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

##### 1.4.2安装Calico网络组件

```sh
# 下载calico资源
curl https://docs.projectcalico.org/v3.20/manifests/calico.yaml -O
修改 calico中的网络断与1.4.1中写的一致  在3800多行呢
            - name: CALICO_IPV4POOL_CIDR
              value: "192.170.0.0/16"
# 安装calico网络组件
kubectl apply -f calico.yaml
```

#### 1.5**加入worker节点**【只在子节点做】

##### 1.5.1worker节点加入集群

```sh
# 复制master节点的子节点加入命令
kubeadm join k8s-master:6443 --token p2d33t.psv19fq344vqtyxh \
    --discovery-token-ca-cert-hash sha256:93cf5f604729f46c1a2dd49c72a154ac4a1e46ebebb217e1bfb71435a28fe704 
```

遇到错误!

![image20240523152854299](https://gitee.com/qixiangyang/pictures/raw/master/images/202405231528411.png)

查看ip 转发的规则是否是1 使用命令`cat /proc/sys/net/ipv4/ip_forward`查看

上图看到结果是0 需要改成1 参考地址：https://blog.csdn.net/qq_42666043/article/details/108259390

```sh
# 使用命令修改设置允许端口转发
echo "sysctl -w net.ipv4.ip_forward=1" >> /etc/rc.d/rc.local \
&& echo "sysctl -p" >> /etc/rc.d/rc.local \
&& chmod +x /etc/rc.d/rc.local \
&& ll /etc/rc.d/rc.local \
&& cat /proc/sys/net/ipv4/ip_forward
# 重启完成之后
cat /proc/sys/net/ipv4/ip_forward
# 结果为1 就可以了
```

在次执行上面命令[上面命令](#Workjoin) 即可完成本步操作

`kubectl get nodes` 查看子节点信息

能看到node子节点都在初始化 ，至此 k8s基础环境搭建完成！

### 2.**安装KubeSphere前置环境**

#### 2.1**安装nfs文件系统**

> 在安装之前，需要配置 Kubernetes 集群中的**默认**存储类型。

##### 2.1.1安装nfs-server

> 在所有机器节点都安装

```sh
# 在每个机器都安装nfs的工具类 能实现数据之间的同步。
yum install -y nfs-utils
```

> 在master上执行

```sh
# 在master 执行以下命令 
echo "/nfs/data/ *(insecure,rw,sync,no_root_squash)" > /etc/exports


# 执行以下命令，启动 nfs 服务;创建共享目录
mkdir -p /nfs/data


# 在master执行
systemctl enable rpcbind
systemctl enable nfs-server
systemctl start rpcbind
systemctl start nfs-server

# 使配置生效
exportfs -r

#检查配置是否生效
exportfs

# 提示/nfs/data  <world> 则配置已生效
```

##### 2.1.2 其他节点做数据同步【只在子节点做】

```sh
showmount -e 192.168.70.127

mkdir -p /nfs/data

mount -t nfs 192.168.70.127:/nfs/data /nfs/data
```

##### 2.1.3 实现动态供应能力

> 安装默认存储【配置动态供应的默认存储类】
>
> <font>！！！里面涉及到的IP地址需要换成主节点的IP地址</font>

```yaml
## 创建了一个存储类
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-storage
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: k8s-sigs.io/nfs-subdir-external-provisioner
parameters:
  archiveOnDelete: "true"  ## 删除pv的时候，pv的内容是否要备份

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nfs-client-provisioner
  labels:
    app: nfs-client-provisioner
  # replace with namespace where provisioner is deployed
  namespace: default
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: nfs-client-provisioner
  template:
    metadata:
      labels:
        app: nfs-client-provisioner
    spec:
      serviceAccountName: nfs-client-provisioner
      containers:
        - name: nfs-client-provisioner
          image: registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/nfs-subdir-external-provisioner:v4.0.2
          # resources:
          #    limits:
          #      cpu: 10m
          #    requests:
          #      cpu: 10m
          volumeMounts:
            - name: nfs-client-root
              mountPath: /persistentvolumes
          env:
            - name: PROVISIONER_NAME
              value: k8s-sigs.io/nfs-subdir-external-provisioner
            - name: NFS_SERVER
              value: 192.168.70.127 ## 指定自己nfs服务器地址
            - name: NFS_PATH  
              value: /nfs/data  ## nfs服务器共享的目录
      volumes:
        - name: nfs-client-root
          nfs:
            server: 192.168.70.127
            path: /nfs/data
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nfs-client-provisioner
  # replace with namespace where provisioner is deployed
  namespace: default
---
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: nfs-client-provisioner-runner
rules:
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["persistentvolumes"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "update"]
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create", "update", "patch"]
---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: run-nfs-client-provisioner
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    # replace with namespace where provisioner is deployed
    namespace: default
roleRef:
  kind: ClusterRole
  name: nfs-client-provisioner-runner
  apiGroup: rbac.authorization.k8s.io
---
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: leader-locking-nfs-client-provisioner
  # replace with namespace where provisioner is deployed
  namespace: default
rules:
  - apiGroups: [""]
    resources: ["endpoints"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
---
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: leader-locking-nfs-client-provisioner
  # replace with namespace where provisioner is deployed
  namespace: default
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    # replace with namespace where provisioner is deployed
    namespace: default
roleRef:
  kind: Role
  name: leader-locking-nfs-client-provisioner
  apiGroup: rbac.authorization.k8s.io
```

```sh
# 编辑sc的配置文件
vi sc-storage-class.yaml
# 创建sc资源
kubectl apply -f sc-storage-class.yaml
# 查看sc资源
kubectl get sc
```

![image20240527110431498](https://gitee.com/qixiangyang/pictures/raw/master/images/202405271104856.png)

> 测试一下

先创建一个PVC `vi create-pvc.yaml`

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: nginx-pvc
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
    # 申请一个200M的空间
      storage: 200Mi
```

`kubectl apply -f create-pvc.yaml`创建pvc【申请书】

`kubuctl get pv` 查看系统中全部现存的PV 持久卷

![image20240527111347000](https://gitee.com/qixiangyang/pictures/raw/master/images/202405271113269.png)

#### 2.2安装 **metrics-server** 集群指标监控组件

> 查看集群的CPU啊 内存等资源的占用率

```yaml
apiVersion: v1 
kind: ServiceAccount
metadata:
  labels:
    k8s-app: metrics-server
  name: metrics-server
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  labels:
    k8s-app: metrics-server
    rbac.authorization.k8s.io/aggregate-to-admin: "true"
    rbac.authorization.k8s.io/aggregate-to-edit: "true"
    rbac.authorization.k8s.io/aggregate-to-view: "true"
  name: system:aggregated-metrics-reader
rules:
- apiGroups:
  - metrics.k8s.io
  resources:
  - pods
  - nodes
  verbs:
  - get
  - list
  - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  labels:
    k8s-app: metrics-server
  name: system:metrics-server
rules:
- apiGroups:
  - ""
  resources:
  - pods
  - nodes
  - nodes/stats
  - namespaces
  - configmaps
  verbs:
  - get
  - list
  - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  labels:
    k8s-app: metrics-server
  name: metrics-server-auth-reader
  namespace: kube-system
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: extension-apiserver-authentication-reader
subjects:
- kind: ServiceAccount
  name: metrics-server
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  labels:
    k8s-app: metrics-server
  name: metrics-server:system:auth-delegator
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:auth-delegator
subjects:
- kind: ServiceAccount
  name: metrics-server
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  labels:
    k8s-app: metrics-server
  name: system:metrics-server
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:metrics-server
subjects:
- kind: ServiceAccount
  name: metrics-server
  namespace: kube-system
---
apiVersion: v1
kind: Service
metadata:
  labels:
    k8s-app: metrics-server
  name: metrics-server
  namespace: kube-system
spec:
  ports:
  - name: https
    port: 443
    protocol: TCP
    targetPort: https
  selector:
    k8s-app: metrics-server
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    k8s-app: metrics-server
  name: metrics-server
  namespace: kube-system
spec:
  selector:
    matchLabels:
      k8s-app: metrics-server
  strategy:
    rollingUpdate:
      maxUnavailable: 0
  template:
    metadata:
      labels:
        k8s-app: metrics-server
    spec:
    # 镜像做到阿里云上了 下载比较快
      containers:
      - args:
        - --cert-dir=/tmp
        - --kubelet-insecure-tls
        - --secure-port=4443
        - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
        - --kubelet-use-node-status-port
        image: registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/metrics-server:v0.4.3
        imagePullPolicy: IfNotPresent
        livenessProbe:
          failureThreshold: 3
          httpGet:
            path: /livez
            port: https
            scheme: HTTPS
          periodSeconds: 10
        name: metrics-server
        ports:
        - containerPort: 4443
          name: https
          protocol: TCP
        readinessProbe:
          failureThreshold: 3
          httpGet:
            path: /readyz
            port: https
            scheme: HTTPS
          periodSeconds: 10
        securityContext:
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1000
        volumeMounts:
        - mountPath: /tmp
          name: tmp-dir
      nodeSelector:
        kubernetes.io/os: linux
      priorityClassName: system-cluster-critical
      serviceAccountName: metrics-server
      volumes:
      - emptyDir: {}
        name: tmp-dir
---
apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  labels:
    k8s-app: metrics-server
  name: v1beta1.metrics.k8s.io
spec:
  group: metrics.k8s.io
  groupPriorityMinimum: 100
  insecureSkipTLSVerify: true
  service:
    name: metrics-server
    namespace: kube-system
  version: v1beta1
  versionPriority: 100
```

```sh
# 配置监控组件的yaml
vi metrics-server-create.yaml
# 将上述内容粘贴到yaml中
# 创建 metrics-server-create.yaml
kubectl apply -f metrics-server-create.yaml
```

使用命令查看全部的node的状态`kubectl top nodes`

![image20240527111845929](https://gitee.com/qixiangyang/pictures/raw/master/images/202405271118113.png)

### 3.安装KubeSphere

参考 [kubesphere官网](https://kubesphere.io/zh/docs/v3.4/quick-start/minimal-kubesphere-on-k8s/)

安装wget 先给官方的安装器下载下来

`yum install -y wget`

> 先下载<a href='https://github.com/kubesphere/ks-installer/releases/download/v3.4.1/cluster-configuration.yaml'>安装器</a> kubesphere_installer.yaml

wget https://github.com/kubesphere/ks-installer/releases/download/v3.4.1/kubesphere-installer.yaml

安装器没什么需要改的

```yaml
---
apiVersion: apiextensions.k8s.io/v1beta1
kind: CustomResourceDefinition
metadata:
  name: clusterconfigurations.installer.kubesphere.io
spec:
  group: installer.kubesphere.io
  versions:
  - name: v1alpha1
    served: true
    storage: true
  scope: Namespaced
  names:
    plural: clusterconfigurations
    singular: clusterconfiguration
    kind: ClusterConfiguration
    shortNames:
    - cc

---
apiVersion: v1
kind: Namespace
metadata:
  name: kubesphere-system

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ks-installer
  namespace: kubesphere-system

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ks-installer
rules:
- apiGroups:
  - ""
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - apps
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - extensions
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - batch
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - rbac.authorization.k8s.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - apiregistration.k8s.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - apiextensions.k8s.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - tenant.kubesphere.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - certificates.k8s.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - devops.kubesphere.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - monitoring.coreos.com
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - logging.kubesphere.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - jaegertracing.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - storage.k8s.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - admissionregistration.k8s.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - policy
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - autoscaling
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - networking.istio.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - config.istio.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - iam.kubesphere.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - notification.kubesphere.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - auditing.kubesphere.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - events.kubesphere.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - core.kubefed.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - installer.kubesphere.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - storage.kubesphere.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - security.istio.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - monitoring.kiali.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - kiali.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - networking.k8s.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - kubeedge.kubesphere.io
  resources:
  - '*'
  verbs:
  - '*'
- apiGroups:
  - types.kubefed.io
  resources:
  - '*'
  verbs:
  - '*'

---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: ks-installer
subjects:
- kind: ServiceAccount
  name: ks-installer
  namespace: kubesphere-system
roleRef:
  kind: ClusterRole
  name: ks-installer
  apiGroup: rbac.authorization.k8s.io

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ks-installer
  namespace: kubesphere-system
  labels:
    app: ks-install
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ks-install
  template:
    metadata:
      labels:
        app: ks-install
    spec:
      serviceAccountName: ks-installer
      containers:
      - name: installer
        image: kubesphere/ks-installer:v3.1.1
        imagePullPolicy: "Always"
        resources:
          limits:
            cpu: "1"
            memory: 1Gi
          requests:
            cpu: 20m
            memory: 100Mi
        volumeMounts:
        - mountPath: /etc/localtime
          name: host-time
      volumes:
      - hostPath:
          path: /etc/localtime
          type: ""
        name: host-time
```

> 集群配置文件需要改一下

再下载<a href='https://github.com/kubesphere/ks-installer/releases/download/v3.4.1/cluster-configuration.yaml'>集群配置文件</a>cluster-configuration.yaml

wget https://github.com/kubesphere/ks-installer/releases/download/v3.4.1/cluster-configuration.yaml

由于实验中我们要实验kubesphere的全部功能 所以需要给集群配置文件中能看到的false都改成true

```yaml
---
apiVersion: installer.kubesphere.io/v1alpha1
kind: ClusterConfiguration
metadata:
  name: ks-installer
  namespace: kubesphere-system
  labels:
    version: v3.1.1
spec:
  persistence:
    storageClass: ""        # If there is no default StorageClass in your cluster, you need to specify an existing StorageClass here.
  authentication:
    jwtSecret: ""           # Keep the jwtSecret consistent with the Host Cluster. Retrieve the jwtSecret by executing "kubectl -n kubesphere-system get cm kubesphere-config -o yaml | grep -v "apiVersion" | grep jwtSecret" on the Host Cluster.
  local_registry: ""        # Add your private registry address if it is needed.
  etcd:
    monitoring: true       # Enable or disable etcd monitoring dashboard installation. You have to create a Secret for etcd before you enable it.
    endpointIps: 172.31.0.4  # etcd cluster EndpointIps. It can be a bunch of IPs here.
    port: 2379              # etcd port.
    tlsEnable: true
  common:
    redis:
      enabled: true
    openldap:
      enabled: true
    minioVolumeSize: 20Gi # Minio PVC size.
    openldapVolumeSize: 2Gi   # openldap PVC size.
    redisVolumSize: 2Gi # Redis PVC size.
    monitoring:
      # type: external   # Whether to specify the external prometheus stack, and need to modify the endpoint at the next line.
      endpoint: http://prometheus-operated.kubesphere-monitoring-system.svc:9090 # Prometheus endpoint to get metrics data.
    es:   # Storage backend for logging, events and auditing.
      # elasticsearchMasterReplicas: 1   # The total number of master nodes. Even numbers are not allowed.
      # elasticsearchDataReplicas: 1     # The total number of data nodes.
      elasticsearchMasterVolumeSize: 4Gi   # The volume size of Elasticsearch master nodes.
      elasticsearchDataVolumeSize: 20Gi    # The volume size of Elasticsearch data nodes.
      logMaxAge: 7                     # Log retention time in built-in Elasticsearch. It is 7 days by default.
      elkPrefix: logstash              # The string making up index.md names. The index.md name will be formatted as ks-<elk_prefix>-log.
      basicAuth:
        enabled: false
        username: ""
        password: ""
      externalElasticsearchUrl: ""
      externalElasticsearchPort: ""
  console:
    enableMultiLogin: true  # Enable or disable simultaneous logins. It allows different users to log in with the same account at the same time.
    port: 30880
  alerting:                # (CPU: 0.1 Core, Memory: 100 MiB) It enables users to customize alerting policies to send messages to receivers in time with different time intervals and alerting levels to choose from.
    enabled: true         # Enable or disable the KubeSphere Alerting System.
    # thanosruler:
    #   replicas: 1
    #   resources: {}
  auditing:                # Provide a security-relevant chronological set of records，recording the sequence of activities happening on the platform, initiated by different tenants.
    enabled: true         # Enable or disable the KubeSphere Auditing Log System. 
  devops:                  # (CPU: 0.47 Core, Memory: 8.6 G) Provide an out-of-the-box CI/CD system based on Jenkins, and automated workflow tools including Source-to-Image & Binary-to-Image.
    enabled: true             # Enable or disable the KubeSphere DevOps System.
    jenkinsMemoryLim: 2Gi      # Jenkins memory limit.
    jenkinsMemoryReq: 1500Mi   # Jenkins memory request.
    jenkinsVolumeSize: 8Gi     # Jenkins volume size.
    jenkinsJavaOpts_Xms: 512m  # The following three fields are JVM parameters.
    jenkinsJavaOpts_Xmx: 512m
    jenkinsJavaOpts_MaxRAM: 2g
  events:                  # Provide a graphical web console for Kubernetes Events exporting, filtering and alerting in multi-tenant Kubernetes clusters.
    enabled: true         # Enable or disable the KubeSphere Events System.
    ruler:
      enabled: true
      replicas: 2
  logging:                 # (CPU: 57 m, Memory: 2.76 G) Flexible logging functions are provided for log query, collection and management in a unified console. Additional log collectors can be added, such as Elasticsearch, Kafka and Fluentd.
    enabled: true         # Enable or disable the KubeSphere Logging System.
    logsidecar:
      enabled: true
      replicas: 2
  metrics_server:                    # (CPU: 56 m, Memory: 44.35 MiB) It enables HPA (Horizontal Pod Autoscaler).
    enabled: false                   # Enable or disable metrics-server.
  monitoring:
    storageClass: ""                 # If there is an independent StorageClass you need for Prometheus, you can specify it here. The default StorageClass is used by default.
    # prometheusReplicas: 1          # Prometheus replicas are responsible for monitoring different segments of data source and providing high availability.
    prometheusMemoryRequest: 400Mi   # Prometheus request memory.
    prometheusVolumeSize: 20Gi       # Prometheus PVC size.
    # alertmanagerReplicas: 1          # AlertManager Replicas.
  multicluster:
    clusterRole: none  # host | member | none  # You can install a solo cluster, or specify it as the Host or Member Cluster.
  network:
    networkpolicy: # Network policies allow network isolation within the same cluster, which means firewalls can be set up between certain instances (Pods).
      # Make sure that the CNI network plugin used by the cluster supports NetworkPolicy. There are a number of CNI network plugins that support NetworkPolicy, including Calico, Cilium, Kube-router, Romana and Weave Net.
      enabled: true # Enable or disable network policies.
    ippool: # Use Pod IP Pools to manage the Pod network address space. Pods to be created can be assigned IP addresses from a Pod IP Pool.
      type: calico # Specify "calico" for this field if Calico is used as your CNI plugin. "none" means that Pod IP Pools are disabled.
    topology: # Use Service Topology to view Service-to-Service communication based on Weave Scope.
      type: none # Specify "weave-scope" for this field to enable Service Topology. "none" means that Service Topology is disabled.
  openpitrix: # An App Store that is accessible to all platform tenants. You can use it to manage apps across their entire lifecycle.
    store:
      enabled: true # Enable or disable the KubeSphere App Store.
  servicemesh:         # (0.3 Core, 300 MiB) Provide fine-grained traffic management, observability and tracing, and visualized traffic topology.
    enabled: true     # Base component (pilot). Enable or disable KubeSphere Service Mesh (Istio-based).
  kubeedge:          # Add edge nodes to your cluster and deploy workloads on edge nodes.
    enabled: true   # Enable or disable KubeEdge.
    cloudCore:
      nodeSelector: {"node-role.kubernetes.io/worker": ""}
      tolerations: []
      cloudhubPort: "10000"
      cloudhubQuicPort: "10001"
      cloudhubHttpsPort: "10002"
      cloudstreamPort: "10003"
      tunnelPort: "10004"
      cloudHub:
        advertiseAddress: # At least a public IP address or an IP address which can be accessed by edge nodes must be provided.
          - ""            # Note that once KubeEdge is enabled, CloudCore will malfunction if the address is not provided.
        nodeLimit: "100"
      service:
        cloudhubNodePort: "30000"
        cloudhubQuicNodePort: "30001"
        cloudhubHttpsNodePort: "30002"
        cloudstreamNodePort: "30003"
        tunnelNodePort: "30004"
    edgeWatcher:
      nodeSelector: {"node-role.kubernetes.io/worker": ""}
      tolerations: []
      edgeWatcherAgent:
        nodeSelector: {"node-role.kubernetes.io/worker": ""}
        tolerations: []
```

> 安装
>
> `kubectl apply -f kubesphere-installer.yaml`
>
> `kubectl apply -f cluster-configuration.yaml`

> 检查安装日志

`kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f`

#### 可拔插组件安装

| 配置项 | 功能组件 | 描述  |
| --- | --- | --- |
| `alerting` | KubeSphere 告警系统 | 可以为工作负载和节点自定义告警策略。告警策略被触发后，告警消息会通过不同的渠道（例如，邮件和 Slack）发送至接收人。 |
| `auditing` | KubeSphere 审计日志系统 | 提供一套与安全相关并按时间顺序排列的记录，记录平台上不同租户的活动。 |
| `devops` | KubeSphere DevOps 系统 | 基于 Jenkins 提供开箱即用的 CI/CD 功能，提供一站式 DevOps 方案、内置 Jenkins 流水线与 B2I & S2I。 |
| `events` | KubeSphere 事件系统 | 提供一个图形化的 Web 控制台，用于导出、过滤和警告多租户 Kubernetes 集群中的 Kubernetes 事件。 |
| `logging` | KubeSphere 日志系统 | 在统一的控制台中提供灵活的日志查询、收集和管理功能。可以添加第三方日志收集器，例如 Elasticsearch、Kafka 和 Fluentd。 |
| `metrics_server` | HPA | 根据设定指标对 Pod 数量进行动态伸缩，使运行在上面的服务对指标的变化有一定的自适应能力。 |
| `networkpolicy` | 网络策略 | 可以在同一个集群内部之间设置网络策略（比如限制或阻止某些实例 Pod 之间的网络请求）。 |
| `kubeedge` | KubeEdge | 为集群添加边缘节点并在这些节点上运行工作负载。 |
| `openpitrix` | KubeSphere 应用商店 | 基于 Helm 的应用程序商店，允许用户管理应用的整个生命周期。 |
| `servicemesh` | KubeSphere 服务网格 (基于 Istio) | 提供细粒度的流量治理、可观测性、流量追踪以及可视化流量拓扑图。 |
| `ippool` | 容器组 IP 池 | 创建容器组 IP 池并从 IP 池中分配 IP 地址到 Pod。 |
| `topology` | 服务拓扑图 | 集成 [Weave Scope](https://www.weave.works/oss/scope/) 以查看应用和容器的服务间通信（拓扑图）。 |

> 要安装的全能力列表

![image20240527114945499](https://gitee.com/qixiangyang/pictures/raw/master/images/202405271149702.png)

> 我的全能力列表

![image20240527115336246](https://gitee.com/qixiangyang/pictures/raw/master/images/202405271153637.png)

> 等待安装完成 大概需要10~20分钟

安装结果

```sh
**************************************************
Collecting installation results ...
#####################################################
###              Welcome to KubeSphere!           ###
#####################################################

Console: http://192.168.70.127:30880
Account: admin
Password: P@88w0rd

NOTES：
  1. After you log into the console, please check the
     monitoring status of service components in
     "Cluster Management". If any service is not
     ready, please wait patiently until all components 
     are up and running.
  2. Please change the default password web login.

#####################################################
https://kubesphere.io             2024-05-28 10:47:37
#####################################################
```

```sh
# 单节点
Collecting installation results ...
#####################################################
###              Welcome to KubeSphere!           ###
#####################################################

Console: http://192.168.70.130:30880
Account: admin
Password: P@88w0rd
NOTES：
  1. After you log into the console, please check the
     monitoring status of service components in
     "Cluster Management". If any service is not
     ready, please wait patiently until all components 
     are up and running.
  2. Please change the default password web login.

#####################################################
https://kubesphere.io             2024-05-28 14:48:50
#####################################################
```

## KubeSphere平台使用

### MYSQL的安装部署

> 配置环境变量

![image20240603141709828](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031425690.png)

![image20240603141803169](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031425482.png)

![image20240603141932168](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031425691.png)

> 在集群的内部是可以直接访问的

mysql -uroot -hmysql-silence-3v7q.ruoyi-cloud -p 123456

其中 `mysql-silence-3v7q.ruoyi-cloud`【服务的应用名.项目名】为服务的DNS

> 集群外部访问

![image20240603144304082](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031443283.png)

### Redis的部署

redis与mysql不同的是redis有自定义的启动命令

![image20240603145507021](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031455086.png)

![image20240603150733060](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031507231.png)

存储挂载

![image20240603145740125](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031457321.png)

> 数据挂载 configMap的key名就是文件名

![image20240603150057511](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031500670.png)

### ES的部署启动

```sh
# 容器启动
docker run --restart=always -d -p 9200:9200 -p 9300:9300 \

# 因为环境配置里有. 所以需要加上引号作为固定配置
-e "discovery.type=single-node" \
# java的一些配置
-e ES_JAVA_OPTS="-Xms512m -Xmx512m" \
# 具名卷挂载 就算卷里面没有东西 docker会将容器内的东西复制一份到外部，然后进行挂载
-v es-config:/usr/share/elasticsearch/config \
# 直接挂载的话 外部文件夹没有东西 内部就也没有东西
-v /mydata/es-01/data:/usr/share/elasticsearch/data \
# 指定名称
--name es-01 \
# 指定ES的镜像和版本
elasticsearch:7.13.4
```

> ES真正挂载的时候 只挂载某两个文件 不挂载也不覆盖其他配置文件
>
> 在一个configMap里配置了两个配置文件

![image20240603153018121](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031530211.png)

![image20240603153214949](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031532036.png)

![image20240603153323146](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031533233.png)

![image20240603174719580](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031747754.png)

> 同一个文件夹挂载个别文件 使用子路径**【相对路径】**

![image20240603175957555](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031759679.png)

![image20240603175342095](https://gitee.com/qixiangyang/pictures/raw/master/images/202406031753169.png)

### 若依分布式系统部署

1. 应用的部署方式
2. 数据的挂载、配置文件
3. 应用的可访问性、负载均衡网络

### SpringBoot项目的配置文件挂载到K8s上

> 先准备DockerFile

```sh
# java 环境
FROM java:8u111
# 定义工作目录
WORKDIR /app
# 把项目中的所有东西复制到工作目录(app)下面
COPY . .
# 把打包好的文件 赋值到app下面 方便操作
ADD target/*.jar /app.jar
# 改变容器的时区
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
RUN echo 'Asia/Shanghai' >/etc/timezone
#端口号
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app.jar"]
```

> 接着在k8s里准备configMap

![image20240605104223671](https://gitee.com/qixiangyang/pictures/raw/master/images/202406051042805.png)

> 准备deployment文件

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: kubesphere
    component: ks-sample-dev
    tier: backend
  name: ks-sample-dev
  namespace: ruoyi-cloud
spec:
  progressDeadlineSeconds: 600
  replicas: 1
  selector:
    matchLabels:
      app: kubesphere
      component: ks-sample-dev
      tier: backend
  template:
    metadata:
      labels:
        app: kubesphere
        component: ks-sample-dev
        tier: backend
    spec:
      imagePullSecrets:
        - name: aliyun-docker-image
      containers:
        - image: $REGISTRY/$DOCKERHUB_NAMESPACE:SNAPSHOT-$BUILD_NUMBER
          readinessProbe:
            httpGet:
              path: /
              port: 8080
            timeoutSeconds: 10
            failureThreshold: 30
            periodSeconds: 5
          imagePullPolicy: Always
          name: ks-sample
          # 容器启动时，指定参数启动 使用挂载的配置文件启动
          args: ["--spring.config.location=application.yaml"]
          ports:
            - containerPort: 8080
              protocol: TCP
          resources:
            limits:
              cpu: 300m
              memory: 600Mi
            requests:
              cpu: 100m
              memory: 100Mi
          terminationMessagePath: /dev/termination-log
          terminationMessagePolicy: File
          # 实现配置挂载
          volumeMounts:
          # 与下面的挂载内容名称一致
            - name: volume-demo
            # 要挂载的路径
              mountPath: /app/application.yaml
            # 当前configMap中涉及到多个文件 指定文件名称
              subPath: application.yaml
      volumes:
      # 挂载内容名称
        - name: volume-demo
          configMap:
          # 与系统创建的configMap的名字要一致
            name: springboot-develop-demo
            items:
            # 均为系统中configMap的一致
              - key: application.yaml
                path: application.yaml
      dnsPolicy: ClusterFirst
      restartPolicy: Always
      terminationGracePeriodSeconds: 30
```

> 准备必要的凭证信息

1.k8s登录凭证【部署时要用 要有部署权限】

![image20240605105002416](https://gitee.com/qixiangyang/pictures/raw/master/images/202406051050499.png)

2.镜像仓库凭证【打包镜像并上传到镜像仓库时要用】

![image20240605105026341](https://gitee.com/qixiangyang/pictures/raw/master/images/202406051050412.png)

3.git的登录凭证【拉取代码要用】

![image20240605105045446](https://gitee.com/qixiangyang/pictures/raw/master/images/202406051050521.png)

5.设置镜像仓库 <font>【配置在项目里哦】</font>【从deploy.yaml中拉取镜像并部署的时候要用】

> 编写Jenkinsfile

```sh
pipeline {
    agent {
        node {
            label 'maven'
        }

    }
    stages {
        stage('查看mave配置信息') {
            agent none
            steps {
                container('maven') {
                    sh 'java -version'
                }

            }
        }

        stage('拉取代码') {
            agent none
            steps {
                git(url: 'https://gitee.com/qixiangyang/devops-maven.git', credentialsId: 'gitee-login', branch: 'master', changelog: true, poll: false)
                container('maven') {
                    sh 'mvn clean package -Dmaven.test.skip=true'
                }

            }
        }

        stage('构建镜像') {
            agent none
            steps {
                container('maven') {
                    sh 'docker build -t $APP_NAME:latest -f   Dockerfile-online .'
                }

            }
        }

        stage('推送镜像到镜像仓库') {
            agent none
            steps {
                container('maven') {
                    withCredentials([usernamePassword(credentialsId: 'aliyun-docker-image', passwordVariable: 'PASSWORD', usernameVariable: 'USER')]) {
                        sh 'docker login --username=$USER --password=$PASSWORD registry.cn-beijing.aliyuncs.com'
                        sh 'docker tag  $APP_NAME:latest  $REGISTRY/$DOCKERHUB_NAMESPACE:SNAPSHOT-$BUILD_NUMBER'
                        sh 'docker push  $REGISTRY/$DOCKERHUB_NAMESPACE:SNAPSHOT-$BUILD_NUMBER'
                        sh 'docker images'
                    }

                }

            }
        }

        stage('部署') {
            agent none
            steps {
                container('maven') {
                    withCredentials([kubeconfigFile(credentialsId: 'admin-develop-kubeconfig', variable: 'KUBECONFIG')]) {
                        sh 'ls'
                        sh 'envsubst < deploy/dev/devops-sample.yaml | kubectl apply -f -'
                    }

                }

            }
        }

    }

    environment {
        REGISTRY = 'registry.cn-beijing.aliyuncs.com'
        DOCKERHUB_NAMESPACE = 'silecne/devops'
        APP_NAME = 'springboot-demo'
    }
}
```

# Ubuntu上安装docker

```sh
sudo echo "deb https://download.docker.com/linux/ubuntu zesty edge" > /etc/apt/sources.list

sudo apt-get -y install apt-transport-https ca-certificates curl software-properties-common

curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo apt-key add -

sudo add-apt-repository "deb [arch=amd64] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable"

sudo apt-get -y install docker-ce

sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": ["https://5biptv7a.mirror.aliyuncs.com"]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

## k8s挂载外部应用

```yaml
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

> mq

```yaml
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

```yaml
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
