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
3. 配置mosca的ssl连接
4. 配置emqtt的ssl连接
5. iOS集成mqtt(含SSL)
6. Android集成mqtt(含SSL)
7. 配置mosca的集群支持
8. 配置emqtt的集群支持
9. 一些总结






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










### 配置mosca的ssl连接

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








### 配置emqtt的ssl连接

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







### iOS集成mqtt(含SSL)

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







### Android集成mqtt(含SSL)

Android的MQTT客户端我们使用官方实现,[GitHub地址](https://github.com/eclipse/paho.mqtt.android),
整个集成过程也很简单.

首先配置包依赖:

    repositories {
        maven {
            url "https://repo.eclipse.org/content/repositories/paho-releases/"
        }
    }


    dependencies {
        compile 'org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.1.0'
        compile 'org.eclipse.paho:org.eclipse.paho.android.service:1.1.0'
    }


然后修改AndroidManifest.xml, 添加网络权限及注入后台Service:

    <?xml version="1.0" encoding="utf-8"?>
    <manifest xmlns:android="http://schemas.android.com/apk/res/android"
        package="com.jegarn.mqtt">

        <!-- Permissions the Application Requires -->
        <uses-permission android:name="android.permission.WAKE_LOCK" />
        <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
        <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

        <uses-permission android:name="android.permission.READ_PHONE_STATE" />
        <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
        <uses-permission android:name="android.permission.INTERNET" />

        <application
            android:allowBackup="true"
            android:icon="@mipmap/ic_launcher"
            android:label="@string/app_name"
            android:supportsRtl="true"
            android:theme="@style/AppTheme">
            <activity android:name=".MainActivity">
                <intent-filter>
                    <action android:name="android.intent.action.MAIN" />

                    <category android:name="android.intent.category.LAUNCHER" />
                </intent-filter>
            </activity>
            <service android:name="org.eclipse.paho.android.service.MqttService">
            </service>
        </application>

    </manifest>


最后我们参照官方提供的示例代码,实现简单的连接/订阅/发送消息/接收消息.

[完整的源代码](https://github.com/Yaoguais/android-on-the-way/tree/master/Mqtt)


SSL连接与非SSL连接的差别很少,一个是连接字符串,另一个是SocketFactory类型.

    normal: "tcp://jegarn.com:1883"
    ssl: ssl://jegarn.com:8883


其中实现SSLSocketFactory我直接原样导入了com.zhy:okhttputils项目的HttpsUtils.java文件,
上次的API的Https请求也是依赖这个库实现的,特别的方便和强大.

    InputStream certificates = getResources().openRawResource(R.raw.server);
    InputStream pkcs12File = getResources().openRawResource(R.raw.client);
    String password = "111111";
    InputStream bksFile = HttpsUtils.pkcs12ToBks(pkcs12File, password);
    HttpsUtils.SSLParams sslParams = HttpsUtils.getSslSocketFactory(new InputStream[]{certificates}, bksFile, password);

    MqttConnectOptions mqttConnectOptions = new MqttConnectOptions();
    mqttConnectOptions.setSocketFactory(sslParams.sSLSocketFactory);


简单几行就实现了对SSL的支持.

至此iOS和Android对MQTT的集成(包含SSL连接)也算是完成了.







### 配置mosca的集群支持

我们复制bin/server.js到bin/server2.js, 修改其中的端口, 来实现一个两台服务器的集群.

    # cd mosca
    # cp bin/server.js bin/server2.js

修改端口:

    interfaces: [
        { type: "mqtt", port: 1884 },
        { type: "mqtts", port: 8884, credentials: { keyPath: SECURE_KEY, certPath: SECURE_CERT, caPaths: [SECURE_CA_CERT] } },
        { type: "http", port: 3002, bundle: true },
        { type: "https", port: 3003, bundle: true, credentials: { keyPath: SECURE_KEY, certPath: SECURE_CERT } }
    ],


由于我们使用的是redis的driver, 而mosca的发布订阅依赖于redis, 所以我们先了解redis的发布订阅.

首先我们看redis的[官方文档](http://redis.io/commands/pubsub), 关于查询发布订阅信息的命令是PUBSUB,
其又有三个子命令.

    PUBSUB CHANNELS [pattern] // 查看当前有订阅者的topic
    PUBSUB NUMSUB [channel-1 ... channel-N] // 查看指定的topic的订阅人数
    PUBSUB NUMPAT // 返回带通配符的topic数量

我们在未启动任何一个mqtt服务器的情况下,先查看redis当前的情况

    127.0.0.1:6379> select 12
    OK
    127.0.0.1:6379[12]> keys *
    (empty list or set)
    127.0.0.1:6379[12]> pubsub channels *
    (empty list or set)
    127.0.0.1:6379[12]> pubsub numpat
    (integer) 0
    127.0.0.1:6379[12]>

然后启动一个服务器:

    # node bin/server2.js

    127.0.0.1:6379[12]> pubsub channels *
    1) "$SYS/moscaSync"
    127.0.0.1:6379[12]> pubsub numpat
    (integer) 1
    127.0.0.1:6379[12]> pubsub numsub $SYS/moscaSync
    1) "$SYS/moscaSync"
    2) (integer) 1

然后使用客户端命令订阅一个话题:

    # mosquitto_sub -R -h jegarn.com -p 8884 -c -i client_id_test_10008 -t user/9527 -u mqtt -P my_password -d -q 1 --cert client/client.crt --key client/client.key --cafile root/ca.crt

    127.0.0.1:6379[12]> pubsub channels *
    1) "user/9527/"
    2) "$SYS/moscaSync"
    127.0.0.1:6379[12]> pubsub numpat
    (integer) 1
    127.0.0.1:6379[12]> pubsub numsub $SYS/moscaSync
    1) "$SYS/moscaSync"
    2) (integer) 1
    127.0.0.1:6379[12]> pubsub numsub user/9527/
    1) "user/9527/"
    2) (integer) 1

我们发现增加了一个话筒"user/9527/", 并且订阅人数是1.

然后我们再启动一个服务器,并用新的clientId订阅"user/9527"这个topic:

    # node bin/server.js

    # mosquitto_sub -R -h jegarn.com -p 8883 -c -i client_id_test_10009 -t user/9527 -u mqtt -P my_password -d -q 1 --cert client/client.crt --key client/client.key --cafile root/ca.crt

    127.0.0.1:6379[12]> pubsub channels *
    1) "user/9527/"
    2) "$SYS/moscaSync"
    127.0.0.1:6379[12]> pubsub numpat
    (integer) 2
    127.0.0.1:6379[12]> pubsub numsub user/9527/
    1) "user/9527/"
    2) (integer) 2
    127.0.0.1:6379[12]> pubsub numsub $SYS/moscaSync
    1) "$SYS/moscaSync"
    2) (integer) 2

这里我们发现"user/9527/"的订阅人数是变成了2, 然后我们新开一个客户端, 随便选择一个服务器, 给这个话题发送一个消息.

    # mosquitto_pub -d -h jegarn.com -p 8883 -i app_service -t user/9527 -m "test" -u mqtt -P my_password -q 1  --cert client/client.crt --key client/client.key --cafile root/ca.crt

经测试, 订阅不同服务器的两个client都收到了消息.

另外需要说明的一点是, 如果订阅了一个通配符, 如果一个新的topic被发送消息, 并且这个topic匹配通配符, 那么这个通配符的订阅者
也会订阅上这个新产生的topic.

通过上面的实验, 我们发现mosca在redis驱动上的实现是依赖于redis服务器的发布订阅的,
所以所有连接的压力最终都会压在redis身上.

redis通过把key哈希到不同的槽点, 每个节点负责一定范围的槽点, 从而使用分片实现集群.

我们看Redis Cluster对发布订阅的支持

    Publish/Subscribe

    In a Redis Cluster clients can subscribe to every node, and can also publish to every other node.
    The cluster will make sure that published messages are forwarded as needed.

    The current implementation will simply broadcast each published message to all other nodes,
    but at some point this will be optimized either using Bloom filters or other algorithms.

本身Redis在集群间的同步带宽在一些公开的数据中占的50以上, 而发布订阅又是将消息广播给所有的节点,
那么在集群中所有的带宽很可能就被集群间的消息通讯和同步吃满, 从而拥有很低的利用率,
明显这个方案是不可取的.

所以mosca在大量用户的情况下, 是不可使用的.








### 配置emqtt的集群支持


为了方便,我们的集群还是部署在同一台物理机上, 但使用两个不同的实例.

首先我们复制emqtt的项目:

    # ls emqttd/
    CHANGES  deps  docs  ebin  include  LICENSE  Makefile  plugins  README.md  rebar  rebar.config  rel  src  test
    # cp -a emqttd emqttd2

通过启动一个实例前后对系统端口占用情况差别的分析,得出一下结论(摘自官方文档)

    1883 	MQTT协议端口
    8883 	MQTT(SSL)端口
    8083 	MQTT(WebSocket), HTTP API端口
    58785   穿透防火墙用的反弹型连接, 是一个可变端口
    18083   emqttd消息服务器的Web管理控制台,Dashboard插件

那么我们先关闭8083/18083端口, 然后将emqttd2的端口修改为1884/8884.
最后修改vm.args节点的名称.

    # vim emqttd/rel/emqttd/data/loaded_plugins
    删除里面的内容, 以移除Web管理功能
    # emqttd/rel/emqttd/etc/emqttd.conf
    关闭不使用的端口
    %% HTTP and WebSocket Listener
    %%{http, 8083, [
        %% Size of acceptor pool
        %%{acceptors, 4},
        %% Maximum number of concurrent clients
        %%{max_clients, 64},
        %% Socket Access Control
        %%{access, [{allow, all}]},
        %% Socket Options
        %%{sockopts, [
        %%    {backlog, 1024}
            %{buffer, 4096},
       %% ]}
    %%]}

    vm.args
    emqttd: -name node1@jegarn.com
    emqttd2: -name node2@jegarn.com


然后将一个实例加入另一个实例:

    [root@jegarn emqttd]# ./bin/emqttd_ctl cluster join node1@jegarn.com
    Join the cluster successfully.
    Cluster status: [{running_nodes,['node1@jegarn.com','node2@jegarn.com']}]
    [root@jegarn emqttd]# ./bin/emqttd_ctl cluster status
    Cluster status: [{running_nodes,['node1@jegarn.com','node2@jegarn.com']}]

同样我们使用一个client进行订阅:

    # mosquitto_sub -R -h jegarn.com -p 8883 -c -i client_id_test_10009 -t user/9527 -u mqtt -P my_password -d -q 1 --cert client/client.crt --key client/client.key --cafile root/ca.crt

然后使用另一个client在另一个实例上订阅同一个topic:

    # mosquitto_sub -R -h jegarn.com -p 8884 -c -i client_id_test_10008 -t user/9527 -u mqtt -P my_password -d -q 1 --cert client/client.crt --key client/client.key --cafile root/ca.crt

最后我们使用新的client向这个topic发送一条消息:

    # mosquitto_pub -d -h jegarn.com -p 8883 -i app_service -t user/9527 -m "test" -u mqtt -P my_password -q 1  --cert client/client.crt --key client/client.key --cafile root/ca.crt

经测试, 两个client同时都收到消息.

通过emqtt的官方说明, 其集群的实现是通过每个节点都保存一份主题树(Topic Trie)和路由表.
具体可以参照[这里的官方说明](http://emqtt.com/docs/cluster.html#topic-trie-route-table).

消息的转发是避免不了的, 那么集群节点间通讯的消耗主要集中在topic和node关系表的广播.

这种选择性的消息广播, 也要优于Redis Cluster的向所有节点广播, 将来Redis可能也会实现相关的功能以减少带宽的消耗.

最后假设拥有一千万的用户, 每个用户的收件箱的topic为"user/uid", 例如"user/10000",
那么每个topic所在的字节平均为10个字节, 我们再假设每个topic只在一个节点被订阅, 那么节点名称平均10个字节.

所以1个topic为20字节, 一千万用户为:

    10 000 000 * 20 = 200M

这个大小是可以接收的.

如果往极端的情况想, 一个topic被10个节点上被订阅, 那么这个大小就为2G左右了.
具体的情况还是需要以实际的测试为准.

总之, emqtt在设计上是要由于mosca的.






### 一些总结


通过以前的那篇[MQTT协议](http://yaoguais.com/article/protocol/mqtt.html), 和翻看mosquitto源码,
稍微深入的了解到了MQTT服务端和客户端的实现.

通过今天的这篇文章, 加深了对MQTT的应用, 通过两次实践, 完全有能力自己搭建服务端并完成基于MQTT的IM应用的开发.

