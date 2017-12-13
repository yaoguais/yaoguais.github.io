## istio网络路由分析

例子是istio的Bookinfo，地址：https://istio.io/docs/guides/bookinfo.html

首先安装istio并部署Bookinfo项目，并分析其路由规则。

首先查看istio的ingress监听的地址：

```
$ kubectl get svc -n istio-system | grep ingress
istio-ingress   LoadBalancer   10.68.93.55     <pending>     80:6259/TCP,443:4852/TCP                                           21h
```

可知其代理了http 80,和 https 443端口，并分别对应物理机的6259和4852端口，
我们通过浏览器访问 http://192.168.3.24:6259/productpage 即可查看网页。

然后我们逐步分析，请求数据包是怎么传递，响应数据包是怎么返回给浏览器的。

首先思路在iptables，因为k8s支持2种proxy模式，userspace和iptables。
从v1.2版本开始，默认采用iptables proxy。

- kube-proxy: https://ieevee.com/tech/2017/01/20/k8s-service.html
- iptables详解： http://blog.csdn.net/reyleon/article/details/12976341

```
$ iptables-save | grep -i 6259                     
-A KUBE-NODEPORTS -p tcp -m comment --comment "istio-system/istio-ingress:http" -m tcp --dport 6259 -j KUBE-MARK-MASQ
-A KUBE-NODEPORTS -p tcp -m comment --comment "istio-system/istio-ingress:http" -m tcp --dport 6259 -j KUBE-SVC-JSIH6CCNAROIS6ON
```

KUBE-MARK-MASQ是kube-dns的一个组件，用作更新每个container的hosts文件。我们暂时可以不管。

```
$ iptables-save | grep -i KUBE-SVC-JSIH6CCNAROIS6ON
-A KUBE-SVC-JSIH6CCNAROIS6ON -m comment --comment "istio-system/istio-ingress:http" -j KUBE-SEP-XMEMPNNJN7A5AOTI

$ iptables-save | grep -i KUBE-SEP-XMEMPNNJN7A5AOTI
-A KUBE-SEP-XMEMPNNJN7A5AOTI -p tcp -m comment --comment "istio-system/istio-ingress:http" -m tcp -j DNAT --to-destination 172.20.100.164:80
```

经过几次转发，请求到达172.20.100.164:80。

```
$ kubectl get po -n istio-system -o wide | grep 172.20.100.164 
istio-ingress-57b544fd9c-qr7sb   1/1       Running   0          22h       172.20.100.164   192.168.3.24
```

至此请求到达istio-ingress这个pod。

```
$ kubectl exec istio-ingress-57b544fd9c-qr7sb -n istio-system -i -t -- /bin/bash
root@istio-ingress-57b544fd9c-qr7sb:/# ps -efw
UID        PID  PPID  C STIME TTY          TIME CMD
root         1     0  0 Dec12 ?        00:00:00 /usr/local/bin/pilot-agent proxy ingress -v 2 --discoveryAddress istio-pilot:15003 -
root        99     1  1 07:02 ?        00:00:18 /usr/local/bin/envoy -c /etc/istio/proxy/envoy-rev8.json --restart-epoch 8 --drain-t
```

查看envoy配置：

```
cat /etc/istio/proxy/envoy-rev8. 
{
  "listeners": [],
  "lds": {
    "cluster": "lds",
    "refresh_delay_ms": 1000
  },
  "admin": {
    "access_log_path": "/dev/stdout",
    "address": "tcp://127.0.0.1:15000"
  },
  "cluster_manager": {
    "clusters": [
      {
        "name": "rds",
        "connect_timeout_ms": 10000,
        "type": "strict_dns",
        "lb_type": "round_robin",
        "hosts": [
          {
            "url": "tcp://istio-pilot:15003"
          }
        ]
      },
      {
        "name": "lds",
        "connect_timeout_ms": 10000,
        "type": "strict_dns",
        "lb_type": "round_robin",
        "hosts": [
          {
            "url": "tcp://istio-pilot:15003"
          }
        ]
      },
      {
        "name": "zipkin",
        "connect_timeout_ms": 10000,
        "type": "strict_dns",
        "lb_type": "round_robin",
        "hosts": [
          {
            "url": "tcp://zipkin:9411"
          }
        ]
      }
    ],
    "sds": {
      "cluster": {
        "name": "sds",
        "connect_timeout_ms": 10000,
        "type": "strict_dns",
        "lb_type": "round_robin",
        "hosts": [
          {
            "url": "tcp://istio-pilot:15003"
          }
        ]
      },
      "refresh_delay_ms": 1000
    },
    "cds": {
      "cluster": {
        "name": "cds",
        "connect_timeout_ms": 10000,
        "type": "strict_dns",
        "lb_type": "round_robin",
        "hosts": [
          {
            "url": "tcp://istio-pilot:15003"
          }
        ]
      },
      "refresh_delay_ms": 1000
    }
  },
  "statsd_udp_ip_address": "10.68.159.137:9125",
  "tracing": {
    "http": {
      "driver": {
        "type": "zipkin",
        "config": {
          "collector_cluster": "zipkin",
          "collector_endpoint": "/api/v1/spans"
        }
      }
    }
  }
}
```

然后并没有发现什么有用的东西....

然后我们查看网络：

```
root@istio-ingress-57b544fd9c-qr7sb:/var/log# netstat -anop | head
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name Timer
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      99/envoy         off (0.00/0/0)
tcp        0      0 127.0.0.1:15000         0.0.0.0:*               LISTEN      99/envoy         off (0.00/0/0)
```

的确是envoy在监听80端口，因此请求到了envoy。

所有我们要查看当前envoy的路由配置，然而listeners是空的。

原本想通过strace查看一下进程的系统调用，但是各种方式都不行，

试过下面的方式：

1. echo 0 > /proc/sys/kernel/yama/ptrace_scope
1. docker exec --privileged -ti <container> bash
1. mount -o remount,rw /proc/sys

谁知道啊。

没有办法，我们只能拿tcpdump看一下了。

```
root@istio-ingress-57b544fd9c-qr7sb:~# tcpdump -w tcpdump.out
tcpdump: listening on eth0, link-type EN10MB (Ethernet), capture size 262144 bytes
```

然后刷新几下页面，过滤内容：
```
$ grep -a -A 10 -B 10 -i "192.168.3.24:6259/productpage" tcpdump.out
```

实在无法看，我们安装一下wireshark，并用scp把tcpdump.out拷贝至物理机上。

```
$ apt-get install openssh-client
$ scp tcpdump.out yaoguai@192.168.3.24:
```

物理机
```
$ apt install wireshark
```

抓取的文件我放在这里了： https://github.com/yaoguais/cabin/tree/master/k8s/istio/tcpdump

用wireshark查看后，粘贴几个范例下来

```
Frame 7009: 1042 bytes on wire (8336 bits), 1042 bytes captured (8336 bits)
Ethernet II, Src: 8e:e2:57:d6:59:bf (8e:e2:57:d6:59:bf), Dst: 6e:6c:51:70:3f:da (6e:6c:51:70:3f:da)
Internet Protocol Version 4, Src: 172.20.100.164, Dst: 172.20.100.168
Transmission Control Protocol, Src Port: 55030, Dst Port: 9080, Seq: 1, Ack: 1, Len: 976
Hypertext Transfer Protocol
    GET /productpage HTTP/1.1\r\n
    host: 192.168.3.24:6259\r\n
    cache-control: max-age=0\r\n
    user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/63.0.3239.84 Chrome/63.0.3239.84 Safari/537.36\r\n
    upgrade-insecure-requests: 1\r\n
    accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8\r\n
    referer: http://192.168.3.24:6259/productpage\r\n
    accept-encoding: gzip, deflate\r\n
    accept-language: zh-CN,zh;q=0.9\r\n
    cookie: user=jason\r\n
        Cookie pair: user=jason
    x-forwarded-for: 192.168.3.24\r\n
    x-forwarded-proto: http\r\n
    x-envoy-internal: true\r\n
    x-request-id: 490bf443-2014-928f-9601-aec6f9e22309\r\n
    x-envoy-decorator-operation: default-route\r\n
    x-b3-traceid: 9e5393600f00c420\r\n
    x-b3-spanid: 9e5393600f00c420\r\n
    x-b3-sampled: 1\r\n
    x-ot-span-context: 9e5393600f00c420;9e5393600f00c420;0000000000000000\r\n
    x-istio-attributes: CkgKCnNvdXJjZS51aWQSOhI4a3ViZXJuZXRlczovL2lzdGlvLWluZ3Jlc3MtNTdiNTQ0ZmQ5Yy1xcjdzYi5pc3Rpby1zeXN0ZW0KDwoJc291cmNlLmlwEgISAA==\r\n
    content-length: 0\r\n
    \r\n
    [Full request URI: http://192.168.3.24:6259/productpage]
    [HTTP request 1/1]
    [Response in frame: 7023]
```

数据包已转发至目标9080端口。

```
$ kubectl get pod -o wide | grep 172.20.100.168
productpage-v1-68b86cf77b-s5d4t   1/1       Running   0          23h       172.20.100.168   192.168.3.24
```

我们再看一下9080端口是谁在监听呢。

```
$ kubectl exec productpage-v1-68b86cf77b-s5d4t -n default -i -t --  /bin/bash
root@productpage-v1-68b86cf77b-s5d4t:/opt/microservices# ps -ef
UID        PID  PPID  C STIME TTY          TIME CMD
root         1     0  0 Dec12 ?        00:00:00 /bin/sh -c python productpage.py
root         6     1  0 Dec12 ?        00:00:00 python productpage.py 9080
root        10     6  0 Dec12 ?        00:08:53 /usr/local/bin/python productpag
root       398     0  0 08:43 pts/0    00:00:00 /bin/bash
root       404   398  0 08:43 pts/0    00:00:00 ps -ef
```

该容器中没有envoy，因此没有二次转发。

那么productpage在调用几个微服务后，拿到数据并渲染页面，就可以把html代码原路返回给浏览器了。

至此，istio的Bookinfo 网络路由分析完毕。

最后，我们还可以通过envoy的admin来查看当前envoy的配置：

刚才那个配置中，还有有点用的：

```
cat /etc/istio/proxy/envoy-rev8. 
{
  "listeners": [],
  "lds": {
    "cluster": "lds",
    "refresh_delay_ms": 1000
  },
  "admin": {
    "access_log_path": "/dev/stdout",
    "address": "tcp://127.0.0.1:15000"
  },
```

暴露管理平台的15000端口给物理机，我们就可以用浏览器查envoy的配置了，而不用使用tcpdump那么麻烦了。

```
$ kubectl get po,svc -n istio-system -o wide | grep ingress
po/istio-ingress-57b544fd9c-qr7sb   1/1       Running   0          23h       172.20.100.164   192.168.3.24

svc/istio-ingress   LoadBalancer   10.68.93.55     <pending>     80:6259/TCP,443:4852/TCP                                           23h       istio=ingress

$ kubectl expose po istio-ingress-57b544fd9c-qr7sb -n istio-system --port=15000 --target-port=15000 --type=NodePort
$ kubectl get svc -n istio-system -o wide | grep ingress
istio-ingress                    LoadBalancer   10.68.93.55     <pending>     80:6259/TCP,443:4852/TCP                                           23h       istio=ingress
istio-ingress-57b544fd9c-qr7sb   NodePort       10.68.228.16    <none>        15000:3576/TCP                                                     57s       istio=ingress,pod-template-hash=1361009857
```

可以看到为我们分配的是3576端口，那么我们访问 http://192.168.3.24:3576/ 即可查看该envoy的配置了。

然后，admin监听的是127.0.0.1 ...

因此：

```
kubectl exec istio-ingress-57b544fd9c-qr7sb -n istio-system -i -t -- /bin/bash
root@istio-ingress-57b544fd9c-qr7sb:/# curl 127.0.0.1:15000
envoy admin commands:
  /certs: print certs on machine
  /clusters: upstream cluster status
  /cpuprofiler: enable/disable the CPU profiler
  /healthcheck/fail: cause the server to fail health checks
  /healthcheck/ok: cause the server to pass health checks
  /hot_restart_version: print the hot restart compatability version
  /listeners: print listener addresses
  /logging: query/change logging levels
  /quitquitquit: exit the server
  /reset_counters: reset all counters to zero
  /routes: print out currently loaded dynamic HTTP route tables
  /server_info: print server version/status information
  /stats: print server stats
root@istio-ingress-57b544fd9c-qr7sb:/# curl 127.0.0.1:15000/routes
{
    "version_info": "hash_d4e3837fea97e162",
    "route_config_name": "80",
    "cluster_name": "rds",
    "route_table_dump": {"name":"80","virtual_hosts":[{"name":"*","domains":["*"],"routes":[{"match":{"prefix":"/"},"route":{"cluster":"out.productpage.default.svc.cluster.local|http","timeout":"0s"},"metadata":{"filter_metadata":{"envoy.router":{"destination.service":"productpage.default.svc.cluster.local","mixer_check":"on","mixer_report":"on","mixer_forward":"on"}}},"decorator":{"operation":"default-route"}}]}]}
}
```

至此，整个流程完毕。
