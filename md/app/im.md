## iOS和Android使用MQTT协议实现消息推送和即时通讯

大多数应用都会涉及到即时聊天的功能,在开源方案中有XMPP和MQTT.其中XMPP是基于XML的,并且不支持消息质量QOS,
所以本身并没有消息重传的机制,从而会导致丢消息.而MQTT是基于二进制的,支持QOS,并且已成为物联网的协议标准,
所以我们有理由抛弃XMPP而拥抱MQTT.

应用内部,在使用MQTT等实现即时聊天功能的同时,我们还可以在应用内部实现消息推动的功能,从而减少了我们对第三方的依赖.
而应用外部,我们仍然不可避免的要使用APNS/GCM/信鸽/极光等推送服务.

内外结合, 从而构建完整的推送机制和聊天机制.


目录:

1. 安装配置mosca
2. 安装配置emqtt
3. 配置mosca和emqtt的ssl连接
4. iOS集成mqtt
5. Android结成mqtt






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

首先我们使用新版本的ssl生成脚本生成jegarn.com的ssl证书.

[脚本下载地址](https://github.com/Yaoguais/cabin/blob/master/config/salt/salt1_file_system/srv/salt/dev/source/scripts/ssl.sh)

然后修改mosca的server.js文件, 替换成下面的部分:

    var SECURE_KEY = '/tmp/ssl/server/server.key';
    var SECURE_CERT = '/tmp/ssl/server/server.crt';
    var SECURE_CA_CERT = '/tmp/ssl/root/ca.crt';

    var moscaSetting = {
        interfaces: [
            { type: "mqtt", port: 1883 },
            { type: "mqtts", port: 8883, credentials: { keyPath: SECURE_KEY, certPath: SECURE_CERT, caPaths: [SECURE_CA_CERT] } },
            { type: "http", port: 3000, bundle: true },
            { type: "https", port: 3001, bundle: true, credentials: { keyPath: SECURE_KEY, certPath: SECURE_CERT } }
        ],
        stats: false,

        logger: { name: 'MoscaServer', level: 'debug' },

        persistence: { factory: mosca.persistence.Redis, url: 'localhost:6379', ttl: { subscriptions: 1000 * 60 * 10, packets: 1000 * 60 * 10 } },

        backend: pubsubSettings,
    };


然后我们使用mosquitto的工具测试:

    # mosquitto_sub -R -h jegarn.com -p 8883 -c -i client_id_test_10008 -t user/10007 -u mqtt -P my_password -d -q 1 --cert client/client.crt --key client/client.key --cafile root/ca.crt
    # mosquitto_pub -d -h jegarn.com -p 8883 -i app_service -t user/10007 -m "test" -u mqtt -P my_password -q 1  --cert client/client.crt --key client/client.key --cafile root/ca.crt

经测试订阅端可以正常收到消息,并且mosca也有正确的调试输出.


然后我们接着测试emqtt的ssl连接:

修改emqtt的配置文件"emqttd/rel/emqttd/etc/emqttd.config",将证书路径替换.

    {mqtts, 8883, [
        %% Size of acceptor pool
        {acceptors, 4},

        %% Maximum number of concurrent clients
        {max_clients, 512},

        %% Socket Access Control
        {access, [{allow, all}]},

        %% SSL certificate and key files
        {ssl, [{certfile, "/tmp/ssl/server/server.crt"},
               {keyfile,  "/tmp/ssl/server/server.key"},
               {cacertfile, "/tmp/ssl/root/ca.crt"}]},

        %% Socket Options
        {sockopts, [
            {backlog, 1024}
            %{buffer, 4096},
        ]}
    ]},


同样我们使用mosquitto的工具测试:

    # mosquitto_sub -R -h jegarn.com -p 8883 -c -i client_id_test_10008 -t user/10007 -u mqtt -P my_password -d -q 1 --cert client/client.crt --key client/client.key --cafile root/ca.crt
    # mosquitto_pub -d -h jegarn.com -p 8883 -i app_service -t user/10007 -m "test" -u mqtt -P my_password -q 1  --cert client/client.crt --key client/client.key --cafile root/ca.crt

经测试订阅端可以正常收到消息.

至此,mosca和emqtt的ssl都正确配置完成,接下来我们完成iOS和Android的SDK接入.





### iOS集成mqtt

iOS端我们使用[MQTTClient库](https://github.com/ckrey/MQTT-Client-Framework).

这里我们简单实现了连接/订阅/发送消息/接收消息, [完整源代码](https://github.com/Yaoguais/ios-on-the-way/tree/master/mqtt).

如果使用非ssl, 初始化代码如下:

    _session = [[MQTTSession alloc] init];
    _session.cleanSessionFlag = YES;
    _session.delegate = self;
    _session.userName = @"test";
    _session.password = @"test";

    [_session connectToHost:@"jegarn.com" port:1883 usingSSL:NO connectHandler:^(NSError *error) {
        NSLog(@"connect error %@", error);
        // 简单测试订阅/发布
        [self subscribeTest];
        [self publishTest];
    }];

ssl连接代码如下:

    MQTTSSLSecurityPolicy *securityPolicy = [MQTTSSLSecurityPolicy policyWithPinningMode:MQTTSSLPinningModeCertificate];
    NSString *certificate = [[NSBundle bundleForClass:[self class]] pathForResource:@"server" ofType:@"cer"];
    securityPolicy.pinnedCertificates = @[[NSData dataWithContentsOfFile:certificate]];
    securityPolicy.allowInvalidCertificates = YES;
    securityPolicy.validatesCertificateChain = NO;

    NSString *p12File = [[NSBundle mainBundle] pathForResource:@"client" ofType:@"p12"];
    NSString *p12Password = @"111111";
    NSArray * certificates = [MQTTCFSocketTransport clientCertsFromP12:p12File passphrase:p12Password];

    _session = [[MQTTSession alloc] init];
    _session.cleanSessionFlag = YES;
    _session.delegate = self;
    _session.userName = @"test";
    _session.password = @"test";
    _session.securityPolicy = securityPolicy;
    _session.certificates = certificates;

    [_session connectToHost:@"jegarn.com" port:8883 usingSSL:YES connectHandler:^(NSError *error) {
        NSLog(@"connect error %@", error);
        // 简单测试订阅/发布
        [self subscribeTest];
        [self publishTest];
    }];


其中要注意的是在使用SSL的时候,我们一般将validatesCertificateChain设置为NO,因为它会花很长的时间去验证证书链.
而allowInvalidCertificates设置为YES,会在验证系统证书的同时验证我们应用中添加的证书.


### Android结成mqtt

... 待续