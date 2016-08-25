## SaltStack安装使用

SaltStack是一个服务器集群管理的解决方案,通过salt命令可以高效的操作上万台服务器.

目录:

1. 简介
2. 安装
3. 配置
    - SLS文件语法
    - SLS文件实例
4. 实践






### 简介

SaltStack的组件有很多,我们主要关心salt-master和salt-minion两个.

salt-master通过将命令发送给salt-minion来实现操作salt-minions.

我这是使用两台主机,操作系统都是CentOS6.5的.

192.168.1.249同时作为master和minion,192.168.1.248作为minion.





### 安装

通过安装配置,我们需要实现在其中任意一台服务器上同时操作服务器集群.

安装的过程,我们参见其[官方文档](http://docs.saltstack.com/).

在249那台主机,添加yum源:

    vim /etc/yum.repo.d/saltstack.repo

添加配置

    [saltstack-repo]
    name=SaltStack repo for Red Hat Enterprise Linux $releasever
    baseurl=https://repo.saltstack.com/yum/redhat/$releasever/$basearch/latest
    enabled=1
    gpgcheck=1
    gpgkey=https://repo.saltstack.com/yum/redhat/$releasever/$basearch/latest/SALTSTACK-GPG-KEY.pub
           https://repo.saltstack.com/yum/redhat/$releasever/$basearch/latest/base/RPM-GPG-KEY-CentOS-6

生成缓存

    yum makecache

安装必须的软件包

    yum install salt-master salt-minion salt-ssh salt-syndic salt-cloud

注: 如果key下载不下来,可以把gpgcheck修改为0.

然后切换到248那台主机,添加yum源,安装salt-minion组件

    yum install salt-minions





### 配置

首先配置249主机,修改其master组件配置文件

    vim /etc/salt/master

修改其中3个字段

    interface: 192.168.1.249
    auto_accept: True
    hash_type: sha256

这里hash_type推荐使用sha256,如果使用配置文件默认的md5的话,会在日志文件/var/log/salt/master中生成一条警告.

然后重启服务

    service salt-master restart

然后配置249主机的minion组件,

    vim  /etc/salt/minion

修改其中的3个字段

    id: minion-dev
    master: 192.168.1.249
    hash_type: sha256

然后重启minion服务

    service salt-minion restart

由于我们开启了master的自动接受,过一会儿就能看到master接收了minion-dev了.

    # salt-key -L
    Accepted Keys:
    minion-dev
    Denied Keys:
    Unaccepted Keys:
    Rejected Keys:

接着配置248主机

    vim /etc/salt/minion

修改关键字段

    id: minion-dev2
    master: 192.168.1.249
    hash_type: sha256

启动服务

    service salt-minion restart

然后在249的主机上查看当前管理的minion,

    # salt-key -L
    Accepted Keys:
    minion-dev
    minion-dev2
    Denied Keys:
    Unaccepted Keys:
    Rejected Keys:

然后测试一下两台minion主机

    # salt "*" test.ping
    minion-dev2:
        True
    minion-dev:
        True

至此,master和minion的通讯基本配置完成了.


然后我们来使用salt部署系统.

首先找到/etc/salt/master中的file_roots字段,其中默认指定salt的state文件在/srv/salt目录下,我们先创建这个文件夹.

    mkdir -p /srv/salt

然后我们需要书写xxx.sls配置文件,这种配置文件是使用yaml标记语言写的,先了解一下[yaml](https://docs.saltstack.com/en/latest/topics/yaml/index.html)
在slat中的使用.





### SLS文件语法


这里有如下几个规则:

1. YAML使用一个固定的缩进来表示数据层之间的关系。salt要求每个级别的缺口正好有两个空格。不要使用制表符。

2. key: value组成一个键值对,当然还有另外一种写法

    key:
      value

value换行后用两个空格缩进.

但是一般使用换行都是为了表示复杂的value,例如

    first_level_dict_key:
      second_level_dict_key: value_in_second_level_dict

3. 相同缩进的破折号用来表示数组,破折号后面需要紧着一个空格,然后才是value,例如

    - list_value_one
    - list_value_two
    - list_value_three


数组一个作为键值对的value出现,例如

    my_dictionary:
      - list_value_one
      - list_value_two
      - list_value_three





### SLS文件实例

我们主要参见[salt官方文档](https://docs.saltstack.com/en/latest/topics/tutorials/states_pt1.html),先构建简单的配置.

在/srv/salt目录下,我们创建top.sls文件

    base:
      '*':
        - webserver

然后也是slat目录,我们接着创建webserver.sls文件

    httpd:                  # ID declaration
      pkg:                  # state declaration
        - installed         # function declaration


然后我们执行命令,让minion安装apache

    # salt '*' state.apply
    minion-dev2:
    ----------
              ID: httpd
        Function: pkg.installed
          Result: True
         Comment: Package httpd is already installed
         Started: 11:10:59.078186
        Duration: 621.726 ms
         Changes:

    Summary for minion-dev2
    ------------
    Succeeded: 1
    Failed:    0
    ------------
    Total states run:     1
    minion-dev:
    ----------
              ID: httpd
        Function: pkg.installed
          Result: True
         Comment: Package httpd is already installed
         Started: 19:11:13.506096
        Duration: 672.966 ms
         Changes:

    Summary for minion-dev
    ------------
    Succeeded: 1
    Failed:    0
    ------------
    Total states run:     1

注意:

- state.apply invoked without any SLS names will run state.highstate
- state.apply invoked with SLS names will run state.sls

上面的我们是通过state.apply来执行的,我们还可以通过

    salt "*" state.sls webserver

来执行特定的sls文件.多个文件去掉.sls后缀,用逗号分隔.





### 实践

这次我们使用salt部署完整的服务器架构,具体包括一台LB,两台WEB服务器,
WEB服务器分别部署NGINX,PHP7,MYSQL,MONGODB,REDIS,SUPERVISOR等服务.

主机:

	主机名: salt1 IP地址: 192.168.1.241 作用:LB和salt-master机器
	主机名: salt2 IP地址: 192.168.1.242 作用:WEB服务器和salt-minion机器1 salt名称: web-server1
	主机名: salt3 IP地址: 192.168.1.243 作用:WEB服务器和salt-minion机器2 salt名称: web-server2

网路配置:

	三台机器网络配置只有IP地址不同，其它完全相同。
	首先配置网卡eth0,设置静态IP。
	然后配置网关/etc/sysconfig/network
	然后配置DNS服务器/etc/resolv.conf


配置salt-master机器的salt服务:

    添加yum源: /etc/yum.repos.d/saltstack.repo
    yum install salt-master python-progressbar

    vim /etc/salt/master
    修改以下字段
    interface: 192.168.1.241
    hash_type: sha256
    启动服务
    service salt-master start

    yum install salt-minion
    vim /etc/salt/minion
    修改以下字段
    id: web-lb
    master: 192.168.1.241
    hash_type: sha256
    启动服务
    service salt-minion start


配置salt-minion机器1的salt服务:

	添加yum源: /etc/yum.repos.d/saltstack.repo
	yum install salt-minion

	vim /etc/salt/minion
	修改以下字段
	id: web-server1
	master: 192.168.1.241
	hash_type: sha256
	启动服务
	service salt-minion start


我们使用同样的方式配置salt-minion机器2的salt服务。



通过上面的操作，我们已经配置好了3台机器的salt服务，然后我们开始测试3台服务器的连接。

	查看所有的minion机器:
	# salt-key -L
	Accepted Keys:
	Denied Keys:
	Unaccepted Keys:
	web-server1
	web-server2
	Rejected Keys:

	接受2台minion服务器:
	# salt-key -a web-server1
	# salt-key -a web-server2

	测试两台服务器的连接:
	# salt "web-server*" test.ping
	web-server1:
    	True
	web-server2:
    	True


然后我们配置2台minion服务器组件:

- 基础组件 base.sls
- NGINX nginx.sls
- PHP7 php7.sls
- Redis redis.sls
- MySql mysql.sls
- MongoDB mongodb.sls
- Postgresql postgresql.sls
- NodeJs nodejs.sls
- Supervisor supervisor.sls
- PhpMyAdmin phpmyadmin.sls
- Golang golang.sls
- Sync sync.sls
- Lvs lvs.sls

写完这些配置文件,我们依次安装这些组件.
所有的配置文件可以到[这里找到](https://github.com/Yaoguais/cabin/tree/master/config/salt/salt1_file_system).

    # salt 'web-server*' state.sls install.base,install.nginx,install.php7,install.redis,
    install.mysql,install.mongodb,install.postgresql,install.nodejs,install.supervisor,install.phpmyadmin,
    install.golang,install.rsync
    # salt 'web-lb' state.sls install.lvs

运行完上面的这条命令,等待一段时间,所有的组件就安装完毕了.

