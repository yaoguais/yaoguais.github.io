## iOS和Android使用MQTT协议实现消息推送和即时通讯


目录:

- 安装配置mosca
- 安装配置emqtt
- 配置mosca和emqtt的ssl连接





### 安装配置mosca

因为mosca是nodejs写的应用,所以需要先安装nodejs,安装最新的nodejs只需要两步.

    # curl --silent --location https://rpm.nodesource.com/setup_4.x | bash -
    # yum -y install nodejs

然后创建mosca项目

    # mkdir mosca
    # cd mosca
    # npm install mosca --save
    # mkdir bin
    # cp node_modules/mosca/examples/Server_Wtih_All\ Interfaces-Settings.js bin/server.js
    # cp -R node_modules/mosca/test/secure ./


然后我们需要在本地启动redis服务,这里安装启动省略了.
接着我们编辑bin/server.js.


    var mosca = require('mosca');

    var pubsubSettings = {
      type: 'redis',
      db: 12,
      port: 6379,
      return_buffers: true,
      host: "localhost"
    };

    var SECURE_KEY = __dirname + '/../secure/tls-key.pem';
    var SECURE_CERT = __dirname + '/../secure/tls-cert.pem';

    var moscaSetting = {
        interfaces: [
            { type: "mqtt", port: 1883 },
            { type: "mqtts", port: 8883, credentials: { keyPath: SECURE_KEY, certPath: SECURE_CERT } }
            { type: "http", port: 3000, bundle: true },
            { type: "https", port: 3001, bundle: true, credentials: { keyPath: SECURE_KEY, certPath: SECURE_CERT } }
        ],
        stats: false,

        logger: { name: 'MoscaServer', level: 'debug' },

        persistence: { factory: mosca.persistence.Redis, url: 'localhost:6379', ttl: { subscriptions: 1000 * 60 * 10, packets: 1000 * 60 * 10 } },

        backend: pubsubSettings,
    };

    var authenticate = function (client, username, password, callback) {
        if (username == "test" && password.toString() == "test")
            callback(null, true);
        else
            callback(null, false);
    }

    var authorizePublish = function (client, topic, payload, callback) {
        callback(null, true);
    }

    var authorizeSubscribe = function (client, topic, callback) {
        callback(null, true);
    }

    var server = new mosca.Server(moscaSetting);

    server.on('ready', setup);

    function setup() {
        server.authenticate = authenticate;
        server.authorizePublish = authorizePublish;
        server.authorizeSubscribe = authorizeSubscribe;

        console.log('Mosca server is up and running.');
    }

    server.on("error", function (err) {
        console.log(err);
    });

    server.on('clientConnected', function (client) {
        console.log('Client Connected \t:= ', client.id);
    });

    server.on('published', function (packet, client) {
        console.log("Published :=", packet);
    });

    server.on('subscribed', function (topic, client) {
        console.log("Subscribed :=", client.packet);
    });

    server.on('unsubscribed', function (topic, client) {
        console.log('unsubscribed := ', topic);
    });

    server.on('clientDisconnecting', function (client) {
        console.log('clientDisconnecting := ', client.id);
    });

    server.on('clientDisconnected', function (client) {
        console.log('Client Disconnected     := ', client.id);
    });


最后我们启动mosca服务器

    # node bin/server.js
    output:
    {"pid":693,"hostname":"devel","name":"MoscaServer","level":30,"time":1472108228321,"msg":"server started","mqtt":1883,"mqtts":8883,"v":1}
    Mosca server is up and running.


但是目前我们还不能向mosca发送数据,因为mosca是服务器,而我们还需要一个客户端.
客户端的选择有很多,因为我们这里还要安装emqtt,所以我们就使用emqtt_benchmark带的客户端来测试.







### 安装配置emqtt

emqtt是erlang写的应用,首先我们还是先安装erlang环境.

    # rpm -i https://packages.erlang-solutions.com/erlang/esl-erlang/FLAVOUR_1_general/esl-erlang_19.0~centos~6_i386.rpm

然后安装emqtt
注: 任何erlang的项目全路径里面带中文会导致项目编译不过,谁带谁SB.

    # git clone https://github.com/emqtt/emqttd.git
    # cd emqttd && make && make dist
    # cd rel/emqttd && ./bin/emqttd console

然后安装emqtt_benchmark

    # git clone git@github.com:emqtt/emqtt_benchmark.git && cd emqtt_benchmark && make

然后先使用emqtt_benchmark的pub/sub工具测试emqtt.

emqtt_benchmark:

    # ./emqtt_bench_sub -h 127.0.0.1 -p 1883 -c 2 -t bench_mark -q 1 -u test -P test -C
    # ./emqtt_bench_pub -h 127.0.0.1 -p 1883 -c 2 -u test -P test -t bench_mark -s 10 -q 1

然后我们再使用mosquitto测试pub/sub, 首先安装yum源.

    [home_oojah_mqtt]
    name=mqtt (CentOS_CentOS-6)
    type=rpm-md
    baseurl=http://download.opensuse.org/repositories/home:/oojah:/mqtt/CentOS_CentOS-6/
    gpgcheck=1
    gpgkey=http://download.opensuse.org/repositories/home:/oojah:/mqtt/CentOS_CentOS-6//repodata/repomd.xml.key
    enabled=1

安装客户端工具:

    # yum -y install mosquitto-clients

发布订阅测试:

    # mosquitto_sub -R -h 127.0.0.1 -p 1883 -c -i client_id_test_10007 -t user/10007 -u mqtt -P my_password -d -q 1
    # mosquitto_pub -d -h 127.0.0.1 -p 1883 -i app_service -t user/10007 -m "test" -u mqtt -P my_password -q 1

测试完成,接下来我们再部署基于ssl的连接.








### 配置mosca和emqtt的ssl连接


我们使用脚本生成ssl的证书:

    #/bin/bash

    pwd=`pwd`

    read -p "Enter your domain [jegarn.com]: " DOMAIN
    read -p "Enter your file prefix [server]: " NAME
    read -p "Enter your save directory [/tmp/ssl]: " DIR

    mkdir -p $DIR
    cd $DIR
    openssl genrsa -des3 -out $NAME.key 2048
    SUBJECT="/C=CN/ST=SiChuan/L=ChengDu/O=YaoGuai/OU=YaoGuai/CN=$DOMAIN"
    openssl req -new -subj $SUBJECT -key $NAME.key -out $NAME.csr
    # remove password
    mv $NAME.key $NAME.ori.key
    openssl rsa -in $NAME.ori.key -out $NAME.key
    openssl x509 -req -days 3650 -in $NAME.csr -signkey $NAME.key -out $NAME.crt
    cd $pwd


这里DOMAIN就填"127.0.0.1",NAME填server,DIR填/tmp/ssl, 中间过程会要求我们输入不小于4位的密码,
但是最终生成的server.key文件我们是把密码去掉了的,要不然像nginx这类服务器使用带密码的key,
会在每次启动关闭时让你输入key的.

我们修改mosca的server.js脚本, 将证书位置替换成我们刚才生成的证书.

    var SECURE_KEY = '/tmp/ssl/server.key';
    var SECURE_CERT = '/tmp/ssl/server.crt';

我们也修改emqtt的配置文件"emqttd/rel/emqttd/etc/emqttd.config",将证书路径替换.

    {mqtts, 8883, [
        %% Size of acceptor pool
        {acceptors, 4},

        %% Maximum number of concurrent clients
        {max_clients, 512},

        %% Socket Access Control
        {access, [{allow, all}]},

        %% SSL certificate and key files
        {ssl, [{certfile, "/tmp/ssl/server.crt"},
               {keyfile,  "/tmp/ssl/server.key"}]},

        %% Socket Options
        {sockopts, [
            {backlog, 1024}
            %{buffer, 4096},
        ]}
    ]},

