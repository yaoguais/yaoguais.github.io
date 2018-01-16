## 持续集成与持续开发环境安装部署 ##

今天的任务是，首先搭建gitlab平台，然后搭建k8s集群，然后创建一个项目，

最后通过gitlab的runner把项目自动部署到k8s集群。


目录：

1. 安装配置gitlab
2. 安装配置k8s集群
3. 配置gitlab的runner
4. 安装部署docker仓库
5. 创建测试项目并触发CD


### 安装配置gitlab ###

gitlab的安装比较简单，官方有清楚的说明。我的物理机是 Ubuntu 16.04 LTS。

按照[https://about.gitlab.com/installation/#ubuntu](https://about.gitlab.com/installation/#ubuntu)的命令，
一路下来就行。

```
sudo apt-get update
sudo apt-get install -y curl openssh-server ca-certificates
```

我这里就不安装邮件服务器了，推荐使用mailgun，每个月有1000封免费邮件，作为开发已经够用了。

```
curl https://packages.gitlab.com/install/repositories/gitlab/gitlab-ee/script.deb.sh | sudo bash
```

我的物理机IP地址是192.168.3.38

```
sudo EXTERNAL_URL="http://192.168.3.38" apt-get install gitlab-ee
```

然后我们把https配置上。

参照[https://stackoverflow.com/questions/44458410/gitlab-ci-runner-ignore-self-signed-certificate](https://stackoverflow.com/questions/44458410/gitlab-ci-runner-ignore-self-signed-certificate)


修改openssl配置
```
vim /etc/pki/tls/openssl.cnf

[ v3_ca ]
subjectAltName=IP:192.168.3.38
```

生成证书，注意过期时间
```
cd /etc/gitlab/ssl
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout /etc/gitlab/ssl/192.168.3.38.key -out /etc/gitlab/ssl/192.168.3.38.crt
sudo openssl dhparam -out /etc/gitlab/ssl/dhparam.pem 2048
```

编辑配置
```
vim /etc/gitlab/gitlab.rb

external_url 'https://192.168.3.38'
nginx['ssl_certificate'] = "/etc/gitlab/ssl/192.168.3.38.crt"
nginx['ssl_certificate_key'] = "/etc/gitlab/ssl/192.168.3.38.key"
```

重启服务器
```
sudo gitlab-ctl reconfigure
sudo gitlab-ctl restart
```

然后登录gitlab平台"https://192.168.3.38/"，第一次登录会让你重置root的密码。

到目前为止，gitlab平台配置好了。可以创建一些用户和项目组什么的。


### 安装配置k8s集群 ###

k8s的配置按照[https://github.com/gjmzj/kubeasz](https://github.com/gjmzj/kubeasz)进行即可，

也是非常的方便。

目前我使用的是example/hosts.allinone.example配置文件，将k8s所有的组件全部部署在192.168.3.38这台机器上。

我的hosts文件
```
# 部署节点：运行ansible 脚本的节点
[deploy]
192.168.3.38

# etcd集群请提供如下NODE_NAME、NODE_IP变量
# 请注意etcd集群必须是1,3,5,7...奇数个节点
[etcd]
192.168.3.38 NODE_NAME=etcd1 NODE_IP="192.168.3.38"

[kube-master]
192.168.3.38 NODE_IP="192.168.3.38"

#确保node节点有变量NODE_ID=node1
[kube-node]
192.168.3.38 NODE_ID=node1 NODE_IP="192.168.3.38"

[kube-cluster:children]
kube-node
kube-master

# 如果启用harbor，请配置后面harbor相关参数
[harbor]
#192.168.1.8 NODE_IP="192.168.1.8"

# 预留组，后续添加node节点使用
[new-node]
#192.168.1.xx NODE_ID=node6 NODE_IP="192.168.1.xx"

[all:vars]
# ---------集群主要参数---------------
#集群 MASTER IP
MASTER_IP="192.168.3.38"

#集群 APISERVER
KUBE_APISERVER="https://192.168.3.38:6443"

#pause镜像地址
POD_INFRA_CONTAINER_IMAGE=mirrorgooglecontainers/pause-amd64:3.0

#TLS Bootstrapping 使用的 Token，使用 head -c 16 /dev/urandom | od -An -t x | tr -d ' ' 生成
BOOTSTRAP_TOKEN="4891e4c34f099ff133eb579b190ed31a"

# 集群网络插件，目前支持calico和flannel
CLUSTER_NETWORK="calico"

# 部分calico相关配置，更全配置可以去roles/calico/templates/calico.yaml.j2自定义
# 设置 CALICO_IPV4POOL_IPIP=“off”,可以提高网络性能，条件限制详见 05.安装calico网络组件.md
CALICO_IPV4POOL_IPIP="always"
# 设置 calico-node使用的host IP，bgp邻居通过该地址建立，可手动指定端口"interface=eth0"或使用如下自动发现
IP_AUTODETECTION_METHOD="can-reach=223.5.5.5"

# 部分flannel配置，详见roles/flannel/templates/kube-flannel.yaml.j2
FLANNEL_BACKEND="vxlan"

# 服务网段 (Service CIDR），部署前路由不可达，部署后集群内使用 IP:Port 可达
SERVICE_CIDR="10.68.0.0/16"

# POD 网段 (Cluster CIDR），部署前路由不可达，**部署后**路由可达
CLUSTER_CIDR="172.20.0.0/16"

# 服务端口范围 (NodePort Range)
NODE_PORT_RANGE="20000-40000"

# kubernetes 服务 IP (预分配，一般是 SERVICE_CIDR 中第一个IP)
CLUSTER_KUBERNETES_SVC_IP="10.68.0.1"

# 集群 DNS 服务 IP (从 SERVICE_CIDR 中预分配)
CLUSTER_DNS_SVC_IP="10.68.0.2"

# 集群 DNS 域名
CLUSTER_DNS_DOMAIN="cluster.local."

# etcd 集群间通信的IP和端口, **根据实际 etcd 集群成员设置**
ETCD_NODES="etcd1=https://192.168.3.38:2380"

# etcd 集群服务地址列表, **根据实际 etcd 集群成员设置**
ETCD_ENDPOINTS="https://192.168.3.38:2379"

# 集群basic auth 使用的用户名和密码
BASIC_AUTH_USER="admin"
BASIC_AUTH_PASS="be9f425154eb72e19c707bd195c75e70"

# ---------附加参数--------------------
#默认二进制文件目录
bin_dir="/sdc1/local/bin"

#证书目录
ca_dir="/etc/kubernetes/ssl"

#部署目录，即 ansible 工作目录
base_dir="/etc/ansible"

#私有仓库 harbor服务器 (域名或者IP)
#HARBOR_IP="192.168.1.8"
#HARBOR_DOMAIN="harbor.yourdomain.com"
```

至此k8s也是部署完了的。


### 配置gitlab的runner ###

runner的安装也是按照官方说明即可。

地址[https://docs.gitlab.com/runner/](https://docs.gitlab.com/runner/)

```
curl -L https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh | sudo bash
```

注册runner前需要拷贝一下证书给runner。
```
mkdir -p /etc/gitlab-runner/certs/
cp -a /etc/gitlab/ssl/192.168.3.38.crt /etc/gitlab-runner/certs/
```

然后我们注册runner，可以参照[https://www.jianshu.com/p/2b43151fb92e](https://www.jianshu.com/p/2b43151fb92e)
的图文说明。这里的executor我们选shell就行了。
```
gitlab-runner register
```

注册好了的配置文件大概是这样的。
```
cat /etc/gitlab-runner/config.toml

concurrent = 1
check_interval = 0

[[runners]]
  name = "ubuntu-xenial"
  url = "https://192.168.3.38/"
  token = "81c08feb52f79834c546f8e4d4ee84"
  executor = "shell"
```

因为runner要用到docker相关的东西，而docker是root用户启动的，因此要把runner的用户添加到root组里。
```
usermod -a -G root gitlab-runner
```

然后启动runner
```
nohup gitlab-ci-multi-runner run &
```

这里我备份一下runner里面内置的环境变量，当要使用的时候，可以在里面查找
```
$ env
CI_PROJECT_NAME=dev
CI_BUILD_TOKEN=xxxxxxxxxxxxxxxxxxxx
CI_PROJECT_URL=https://192.168.3.38/dev/dev
CI_PROJECT_VISIBILITY=private
SHELL=/bin/bash
CI_REGISTRY_USER=gitlab-ci-token
CI_BUILD_BEFORE_SHA=a07f2ed356e9e122ed623b29d820e62ac5bff449
GITLAB_USER_LOGIN=liuyong
CI_BUILD_ID=19
CI_SERVER_VERSION=10.3.3-ee
GITLAB_USER_EMAIL=liuyong@test.com
OLDPWD=/home/gitlab-runner
CONFIG_FILE=/etc/gitlab-runner/config.toml
CI_COMMIT_REF_NAME=master
CI_SERVER_TLS_CA_FILE=/home/gitlab-runner/builds/81c08feb/0/dev/dev.tmp/CI_SERVER_TLS_CA_FILE
USER=gitlab-runner
CI_PROJECT_ID=1
CI_JOB_TOKEN=xxxxxxxxxxxxxxxxxxxx
CI_RUNNER_ID=1
CI_PIPELINE_ID=10
CI_BUILD_REF_NAME=master
CI_BUILD_REF=a4339f58a45dce234f2355898210370013252fc0
CI_COMMIT_REF_SLUG=master
GITLAB_USER_NAME=liuyong
CI_REPOSITORY_URL=https://gitlab-ci-token:xxxxxxxxxxxxxxxxxxxx@192.168.3.38/dev/dev.git
PATH=/home/gitlab-runner/bin:/home/gitlab-runner/.local/bin:/sdc1/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games
MAIL=/var/mail/gitlab-runner
CI_BUILD_STAGE=build
CI_REGISTRY_PASSWORD=xxxxxxxxxxxxxxxxxxxx
CI_PROJECT_DIR=/home/gitlab-runner/builds/81c08feb/0/dev/dev
CI_RUNNER_TAGS=
PWD=/home/gitlab-runner/builds/81c08feb/0/dev/dev
CI_PIPELINE_SOURCE=push
CI_JOB_STAGE=build
CI_PROJECT_PATH=dev/dev
CI_SERVER_NAME=GitLab
LANG=en_US.UTF-8
GITLAB_CI=true
CI_SERVER_REVISION=3f64be9
CI_COMMIT_SHA=a4339f58a45dce234f2355898210370013252fc0
CI_CONFIG_PATH=.gitlab-ci.yml
CI_BUILD_NAME=build_job
HOME=/home/gitlab-runner
SHLVL=2
CI_PROJECT_PATH_SLUG=dev-dev
CI_SERVER=yes
CI=true
CI_PROJECT_NAMESPACE=dev
LOGNAME=gitlab-runner
CI_BUILD_REF_SLUG=master
GOPATH=/go/gopath
CI_SHARED_ENVIRONMENT=true
CI_RUNNER_DESCRIPTION=ubuntu-xenial
GITLAB_USER_ID=2
CI_JOB_ID=19
CI_JOB_NAME=build_job
_=/usr/bin/env
```

### 安装部署docker仓库 ###

因为安装k8s已经安装好了docker，我们按照docker官方的registry安装docker仓库即可。
地址[https://docs.docker.com/registry/#alternatives](https://docs.docker.com/registry/#alternatives)
```
docker run -d -p 5000:5000 --name registry registry:2
docker pull ubuntu
docker tag ubuntu localhost:5000/myfirstimage
docker push localhost:5000/myfirstimage
docker pull localhost:5000/myfirstimage
```

### 创建测试项目并触发CD ###

创建一个go的项目。

main.go
```
package main

import (
	"io"
	"net/http"
	"os"
)

func main() {
	io.WriteString(os.Stdout, "server start at localhost:3333\n")

	http.HandleFunc("/", IndexHandler)
	http.ListenAndServe(":3333", nil)
}

// IndexHandler index handler to handle "/"
func IndexHandler(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("hello world!"))
}
```

创建Dockerfile
```
FROM alpine:3.7

ADD http-server /usr/local/bin/http-server

CMD [ "http-server" ]
```

创建.gitlab.yml。gitlab会通过该文件，在提交合并代码时执行里面定义的任务。
```
stages:
  - build
  - deploy

before_script:
  - echo "Start pipeline..."

after_script:
  - echo "Finish pipeline..."

build_job:
  stage: build
  script:
  - echo "Build image..."
  - docker run -i --rm -v $PWD:/data -w /data localhost:5000/golang:1.10-rc-alpine go build -o http-server main.go
  - docker build -t localhost:5000/httpserver:${CI_COMMIT_SHA} .
  - docker push localhost:5000/httpserver:${CI_COMMIT_SHA}
  - echo "Push image \"localhost:5000/httpserver:${CI_COMMIT_SHA}\" into docker registry success."
  only:
  - master

deploy_job:
  stage: deploy
  script:
  - echo "Deploy image ..."
  - envsubst < deploy.yaml | kubectl apply -f - -n production
  only:
  - master
```

创建部署文件deploy.yaml
```
# Create namespace
apiVersion: v1
kind: Namespace
metadata:
  name: production
---
# Create service
apiVersion: v1
kind: Service
metadata:
  name: ${CI_PROJECT_NAME}-${CI_COMMIT_SHA}
spec:
  selector:
    app: ${CI_PROJECT_NAME}-${CI_COMMIT_SHA}
  ports:
    - protocol: TCP
      port: 3333
      targetPort: 3333
  externalIPs:
    - 192.168.3.38
---
# Create deploy
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: ${CI_PROJECT_NAME}-${CI_COMMIT_SHA}
spec:
  replicas: 2
  template:
    metadata:
      labels:
        app: ${CI_PROJECT_NAME}-${CI_COMMIT_SHA}
    spec:
      containers:
        - name:  ${CI_COMMIT_SHA}
          image: localhost:5000/httpserver:${CI_COMMIT_SHA}
          ports:
            - containerPort: 3333
```

最后提交代码，在物理机上查看pod状态
```
kubectl get po -n production -o wide
```

当pod的状态是Running时，我们使用curl请求该服务。
```
curl http://192.168.3.38:3333/
hello world!
```

至此，一个简易的持续集成持续开发环境即搭建完毕。

当然，还有高可用、安全和备份等方便有待优化。
