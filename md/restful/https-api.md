## RestFul API用SSL双向认证构建安全通讯信道

在移动开发中,服务端和客户端通讯一般都是使用restful接口,这里就会涉及到安全问题.
比如: 在服务器端返回的数据中有一个字段是控制某个资源是否可见的(像微信的私密照片),而恶意的开发者通过Charles等工具可以直接修改掉这个字段,
就会导致用户本不该看到的资源被看到.

这里面有几个可行的解决方案:

一、使用私密协议,比如发送接收的数据使用二进制私有协议,但是这会大大增加开发成本,调试起来也比较困难.
现在大多使用的方式是客户端到服务器使用http post get等请求,服务器返回json数据,中间也可以使用gzip压缩数据.

二、使用双向认证的ssl连接(单向的ssl是不安全的,数据会被任意篡改),客户端和服务器在建立连接的时候,
客户端会验证服务器的证书,服务器也会要求客户端发送服务端签名过的证书,达到双向认证,从而避免中间人攻击.

当然这两个方案都是建立的客户端不被反编译的前提下,如果被反编译成功.恶意开发者可以破解中间的加密算法,或者拿到所有的证书,
从而击破安全的壁垒.当然今天主要的内容是SSL双向认证,而不是反编译.


目录:

1. 服务器生成证书
2. IOS使用AFNetworking实现SSL双向认证
3. 浏览器加载客户端证书实现访问
4. charles加载客户端证书实现调试
5. Android使用okhttp实现SSL双向认证


### 服务器生成证书

nginx多使用bks格式的证书,而像java系的(像tomcat,openfire等)多使用jks格式的证书.
目前服务器这边多使用nginx,所以我们今天重点在生成bks格式的证书.

我这里写了一个shell脚本,帮助生成ca证书/服务端证书/客户端证书.


    #!/bin/bash
    # from http://blog.csdn.net/linvo/article/details/9173511
    # from http://www.cnblogs.com/guogangj/p/4118605.html

    dir=/tmp/ssl
    workspace=`pwd`

    if [ -d $dir ]; then
        printf "${dir} already exists, remove it?  yes/no: "
        read del
        if [ $del = "yes" ]; then
            rm -rf $dir
        else
            echo "user cancel"
        fi
    fi

    for d in ${dir} "${dir}/root" "${dir}/server" "${dir}/client" "${dir}/certs"
    do
        if [ ! -d $d ]; then
            mkdir $d
        fi
    done

    echo 'hello world!' >> "${dir}/index.php"
    echo 01 > "${dir}/serial"

    index_file="${dir}/index.txt"
    rm -f $index_file
    touch $index_file

    echo "generate openssl.cnf: "
    openssl_cnf="${dir}/openssl.cnf"
    touch $openssl_cnf
    echo "[ ca ]
    default_ca = yaoguais_ca

    [ yaoguais_ca ]
    certificate = ./ca.crt
    private_key = ./ca.key
    database = ./index.txt
    serial = ./serial
    new_certs_dir = ./certs

    default_days = 3650
    default_md = sha1

    policy = yaoguais_ca_policy
    x509_extensions = yaoguais_ca_extensions

    [ yaoguais_ca_policy ]
    commonName = supplied
    stateOrProvinceName = optional
    countryName = optional
    emailAddress = optional
    organizationName = optional
    organizationalUnitName = optional

    [ yaoguais_ca_extensions ]
    basicConstraints = CA:false


    [ req ]
    default_bits = 2048
    default_keyfile = ./ca.key
    default_md = sha1
    prompt = yes
    distinguished_name = root_ca_distinguished_name
    x509_extensions = root_ca_extensions

    [ root_ca_distinguished_name ]
    countryName_default = CN

    [ root_ca_extensions ]
    basicConstraints = CA:true
    keyUsage = cRLSign, keyCertSign

    [ server_ca_extensions ]
    basicConstraints = CA:false
    keyUsage = keyEncipherment

    [ client_ca_extensions ]
    basicConstraints = CA:false
    keyUsage = digitalSignature" > $openssl_cnf

    exit 0

    cd $dir
    echo "generate root ca: "
    # in this step, I always input a password of "ca.key111111"
    openssl genrsa -des3 -out root/ca.key 2048
    # in this step, I always input these and a password of "ca.csr111111"
    #Country Name (2 letter code) [XX]:CN
    #State or Province Name (full name) []:Si Chuan
    #Locality Name (eg, city) [Default City]:Cheng Du
    #Organization Name (eg, company) [Default Company Ltd]:Yao Guai Ltd
    #Organizational Unit Name (eg, section) []:Yao Guai
    #Common Name (eg, your name or your server's hostname) []:yaoguai.com
    #Email Address []:newtopstdio@163.com
    #A challenge password []:ca.csr111111
    #An optional company name []:Yao Guai Ltd
    openssl req -new -newkey rsa:2048 -key root/ca.key -out root/ca.csr
    openssl x509 -req -days 3650 -in root/ca.csr -signkey root/ca.key -out root/ca.crt

    echo "generate server keys: "
    # in this step, I always input a password of "server.key111111"
    openssl genrsa -des3 -out server/server.key 2048
    # in this step, I always input these and a password of none
    #Country Name (2 letter code) [XX]:CN
    #State or Province Name (full name) []:Si Chuan
    #Locality Name (eg, city) [Default City]:Cheng Du
    #Organization Name (eg, company) [Default Company Ltd]:Yao Guai Ltd
    #Organizational Unit Name (eg, section) []:Yao Guai
    #Common Name (eg, your name or your server's hostname) []:yaoguai.com
    #Email Address []:newtopstdio@163.com
    #A challenge password []:none
    #An optional company name []:none
    openssl req -new -newkey rsa:2048 -key server/server.key -out server/server.csr
    openssl ca -config openssl.cnf -in server/server.csr -cert root/ca.crt -keyfile root/ca.key -out server/server.crt -days 3650

    echo "generate client keys: "
    # in this step, I always input a password of "client.key111111"
    openssl genrsa -des3 -out client/client.key 2048
    # in this step, I always input these and a password of none
    #Country Name (2 letter code) [XX]:CN
    #State or Province Name (full name) []:Si Chuan
    #Locality Name (eg, city) [Default City]:Cheng Du
    #Organization Name (eg, company) [Default Company Ltd]:Yao Guai Ltd
    #Organizational Unit Name (eg, section) []:Yao Guai
    #Common Name (eg, your name or your server's hostname) []:yaoguai.com
    #Email Address []:newtopstdio@163.com
    #A challenge password []:none
    #An optional company name []:none
    openssl req -new -newkey rsa:2048 -key client/client.key -out client/client.csr
    # to prevent error "openssl TXT_DB error number 2 failed to update database"
    echo "unique_subject = no" > "index.txt.attr"
    openssl ca -config openssl.cnf -in client/client.csr -cert root/ca.crt -keyfile root/ca.key -out client/client.crt -days 3650

    # use these to config nginx
    : <<EOF
        ssl on;
        ssl_verify_client on;
        ssl_certificate /tmp/ssl/server/server.crt;
        ssl_certificate_key /tmp/ssl/server/server.key;
        ssl_client_certificate /tmp/ssl/root/ca.crt;
        ssl_session_timeout 5m;
        ssl_protocols SSLv3 TLSv1 TLSv1.1 TLSv1.2;
        ssl_ciphers "HIGH:!aNULL:!MD5 or HIGH:!aNULL:!MD5:!3DES";
        ssl_prefer_server_ciphers on;
    EOF

    echo "helps:"
    # 查看key文件签名信息
    echo "openssl rsa -in xxx.key -text -noout"
    # 查看csr文件签名
    echo "openssl req -noout -text -in xxx.csr"
    # 将pem格式转换成der格式
    echo "openssl x509 -in server/server.crt -outform DER -out server/server.cer"
    # 使用curl请求服务器
    echo 'curl -k --cert client/client.crt --key client/client.key --pass client.key111111 https://devel/index.php'
    # 生成p12文件, password export111111
    echo "openssl pkcs12 -export -in client/client.crt -inkey client/client.key -out client/client.p12 -certfile root/ca.crt"

    cd $workspace

中间会要求输入几次证书信息和密码, 需要自己严格保存下来, 如果泄漏也会产生通讯被破解的危险.


然后我们在nginx的server模块中添加ssl相关的配置:

    ssl on;
    ssl_verify_client on;
    ssl_certificate /tmp/ssl/server/server.crt;
    ssl_certificate_key /tmp/ssl/server/server.key;
    ssl_client_certificate /tmp/ssl/root/ca.crt;
    ssl_session_timeout 5m;
    ssl_protocols SSLv3 TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers "HIGH:!aNULL:!MD5 or HIGH:!aNULL:!MD5:!3DES";
    ssl_prefer_server_ciphers on;







### IOS使用AFNetworking实现SSL双向认证

IOS端我们使用AFNetworking实现SSL双向认证,服务器我们搭建在127.0.0.1,在7080端口开通ssl验证.
但是实际使用服务器时一般会使用域名来指向具体的IP, 这里我们通过修改/etc/hosts来实现将yaoguai.com指向127.0.0.1,
因为我们的证书使用的是yaoguai.com这个Common Name来签名的,所以如果我们的服务器不是yaoguai.com,那么客户端会造成验证不通过.

而整个ssl的实现我就简单放到AppDelegate.m文件中了.
整个项目地址在[https-api](https://github.com/Yaoguais/ios-on-the-way/tree/master/https-api).


    #import <AFNetworking/AFNetworking.h>
    #import "AppDelegate.h"
    #define _AFNETWORKING_ALLOW_INVALID_SSL_CERTIFICATES_ 1


    #ifndef    weakify
    #if __has_feature(objc_arc)

    #define weakify( x ) \
    _Pragma("clang diagnostic push") \
    _Pragma("clang diagnostic ignored \"-Wshadow\"") \
    autoreleasepool{} __weak __typeof__(x) __weak_##x##__ = x; \
    _Pragma("clang diagnostic pop")

    #else

    #define weakify( x ) \
    _Pragma("clang diagnostic push") \
    _Pragma("clang diagnostic ignored \"-Wshadow\"") \
    autoreleasepool{} __block __typeof__(x) __block_##x##__ = x; \
    _Pragma("clang diagnostic pop")

    #endif
    #endif

    #ifndef    strongify
    #if __has_feature(objc_arc)

    #define strongify( x ) \
    _Pragma("clang diagnostic push") \
    _Pragma("clang diagnostic ignored \"-Wshadow\"") \
    try{} @finally{} __typeof__(x) x = __weak_##x##__; \
    _Pragma("clang diagnostic pop")

    #else

    #define strongify( x ) \
    _Pragma("clang diagnostic push") \
    _Pragma("clang diagnostic ignored \"-Wshadow\"") \
    try{} @finally{} __typeof__(x) x = __block_##x##__; \
    _Pragma("clang diagnostic pop")

    #endif
    #endif


    @interface AppDelegate ()

    @end

    @implementation AppDelegate




    - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
        // Override point for customization after application launch.
        [self setHttpsVerifyAndRequest];
        return YES;
    }

    - (void)applicationWillResignActive:(UIApplication *)application {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and throttle down OpenGL ES frame rates. Games should use this method to pause the game.

    }

    - (void)applicationDidEnterBackground:(UIApplication *)application {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.

    }

    - (void)applicationWillEnterForeground:(UIApplication *)application {
        // Called as part of the transition from the background to the inactive state; here you can undo many of the changes made on entering the background.
    }

    - (void)applicationDidBecomeActive:(UIApplication *)application {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    - (void)applicationWillTerminate:(UIApplication *)application {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    - (void) setHttpsVerifyAndRequest {
        NSString *certFilePath = [[NSBundle mainBundle] pathForResource:@"server" ofType:@"cer"];
        NSData *certData = [NSData dataWithContentsOfFile:certFilePath];
        NSSet *certSet = [NSSet setWithObject:certData];
        AFSecurityPolicy *policy = [AFSecurityPolicy policyWithPinningMode:AFSSLPinningModeCertificate withPinnedCertificates:certSet];
        policy.allowInvalidCertificates = NO;
        policy.validatesDomainName = YES;

        AFHTTPSessionManager * manager = [AFHTTPSessionManager manager];
        manager.securityPolicy = policy;
        manager.requestSerializer = [AFHTTPRequestSerializer serializer];
        manager.responseSerializer = [AFHTTPResponseSerializer serializer];
        //manager.responseSerializer.acceptableContentTypes = [NSSet setWithObjects:@"application/json", @"text/json", @"text/html", @"text/javascript", @"text/plain", nil];

        manager.requestSerializer.cachePolicy = NSURLRequestReloadIgnoringLocalCacheData;
        [manager setSessionDidBecomeInvalidBlock:^(NSURLSession * _Nonnull session, NSError * _Nonnull error) {
            NSLog(@"setSessionDidBecomeInvalidBlock %@", error);
        }];

        _manager = manager;

        @weakify(self);
        [manager setSessionDidReceiveAuthenticationChallengeBlock:^NSURLSessionAuthChallengeDisposition(NSURLSession*session, NSURLAuthenticationChallenge *challenge, NSURLCredential *__autoreleasing*_credential) {
            @strongify(self);
            NSURLSessionAuthChallengeDisposition disposition = NSURLSessionAuthChallengePerformDefaultHandling;
            __autoreleasing NSURLCredential *credential =nil;
            if([challenge.protectionSpace.authenticationMethod isEqualToString:NSURLAuthenticationMethodServerTrust]) {
                if([self.manager.securityPolicy evaluateServerTrust:challenge.protectionSpace.serverTrust forDomain:challenge.protectionSpace.host]) {
                    credential = [NSURLCredential credentialForTrust:challenge.protectionSpace.serverTrust];
                    if(credential) {
                        disposition =NSURLSessionAuthChallengeUseCredential;
                    } else {
                        disposition =NSURLSessionAuthChallengePerformDefaultHandling;
                    }
                } else {
                    disposition = NSURLSessionAuthChallengeCancelAuthenticationChallenge;
                }
            } else {
                // client authentication
                SecIdentityRef identity = NULL;
                SecTrustRef trust = NULL;
                NSString *p12 = [[NSBundle mainBundle] pathForResource:@"client"ofType:@"p12"];
                NSFileManager *fileManager =[NSFileManager defaultManager];

                if(![fileManager fileExistsAtPath:p12])
                {
                    NSLog(@"client.p12:not exist");
                }
                else
                {
                    NSData *PKCS12Data = [NSData dataWithContentsOfFile:p12];

                    if ([[self class]extractIdentity:&identity andTrust:&trust fromPKCS12Data:PKCS12Data])
                    {
                        SecCertificateRef certificate = NULL;
                        SecIdentityCopyCertificate(identity, &certificate);
                        const void*certs[] = {certificate};
                        CFArrayRef certArray =CFArrayCreate(kCFAllocatorDefault, certs,1,NULL);
                        credential =[NSURLCredential credentialWithIdentity:identity certificates:(__bridge  NSArray*)certArray persistence:NSURLCredentialPersistencePermanent];
                        disposition =NSURLSessionAuthChallengeUseCredential;
                    }
                }
            }
            *_credential = credential;
            return disposition;
        }];

        [manager GET:@"https://yaoguai.com:7080/index.php" parameters:nil progress:nil success:^(NSURLSessionTask *task, id responseObject) {
            NSLog(@"Data: %@", [[NSString alloc] initWithData:responseObject encoding:NSUTF8StringEncoding]);
        } failure:^(NSURLSessionTask *operation, NSError *error) {
            NSLog(@"Error: %@", error);
        }];
    }

    +(BOOL)extractIdentity:(SecIdentityRef*)outIdentity andTrust:(SecTrustRef *)outTrust fromPKCS12Data:(NSData *)inPKCS12Data {
        NSDictionary*optionsDictionary = @{(__bridge id) kSecImportExportPassphrase : @"export111111"};

        CFArrayRef items = CFArrayCreate(NULL, 0, 0, NULL);
        OSStatus securityError = SecPKCS12Import((__bridge CFDataRef)inPKCS12Data,(__bridge CFDictionaryRef)optionsDictionary,&items);

        if(securityError == 0) {
            CFDictionaryRef myIdentityAndTrust =CFArrayGetValueAtIndex(items,0);
            const void*tempIdentity =NULL;
            tempIdentity= CFDictionaryGetValue (myIdentityAndTrust,kSecImportItemIdentity);
            *outIdentity = (SecIdentityRef)tempIdentity;
            const void*tempTrust =NULL;
            tempTrust = CFDictionaryGetValue(myIdentityAndTrust,kSecImportItemTrust);
            *outTrust = (SecTrustRef)tempTrust;
        } else {
            NSLog(@"Failedwith error code %d",(int)securityError);
            return NO;
        }
        return YES;
    }
    @end

服务端的文件也很简单, 就是在网站根目录下放置一个index.php, 其中的内容为:

    <?php
    echo 'Hello World!';


最终我们可以看到在控制台返回"Hello World!".





### 浏览器加载客户端证书实现访问

我这里使用的Mac笔记本, 找到"钥匙串访问", 在"钥匙串" > "系统" 中选择添加钥匙串, 添加我们生成的client.p12文件, 并点击证书,
在详情中将认证设置为"始终信任".

然后在浏览器中访问"https://yaoguai.com:7080/index.php", 系统会要求你输入相应的密码.
然后我们就可以在浏览器中看到输出"Hello World!"





### charles加载客户端证书实现调试

我们打开charles, 勾选顶部菜单"Proxy" > "Mac OS X Proxy"启动代理,
然后点击"Proxy" > "SSL Proxying Settings..", 在"SSL Proxying"页点击Add, 添加一项"yaoguai.com:7080".

然后在"Client Certificates"页点击Add, 添加一项"yaoguai.com:7080",并添加client.p12文件.

当电脑或者代理到charles的手机访问yaoguai.com时, 会提示你输入client.p12的导出密码.

这时我们打开charles, 并运行"https-api"项目, 就可以在charles中截获"get https://yaoguai.com:7080/index.php"请求了.







### Android使用okhttp实现SSL双向认证

Android方面我们使用okhttp向服务器发起请求, 这里我们使用封装了okhttp的OkHttpUtils库, 因为它已经实现了SSL的双向认证.

由于一直在Android虚拟机中修改hosts文件失败, 我就使用自己的服务器jegarn.com重新生成了签名.

需要注意的是, 我们生成的是p12文件, 但是Android需要的是bks文件, 我这里写了一个pkcs12转bks的函数, 就统一了iOS和Android的证书.
另外一点就是转换的时候有个alias参数, 填写错误的话会导致生成的文件不正确, 可以通过下面的代码打印出来, 修正即可.

    Enumeration<String> aliases = pkcs12.aliases();
    while(aliases.hasMoreElements()){
        System.out.println("alias: " + aliases.nextElement());
    }

整个验证的过程我也直接写到了MainActivity.java文件中, 完整的源代码可以在这里找到
[https-api](https://github.com/Yaoguais/android-on-the-way/tree/master/https-api).



    package com.jegarn.https_api;

    import android.support.v7.app.AppCompatActivity;
    import android.os.Bundle;

    import com.zhy.http.okhttp.OkHttpUtils;
    import com.zhy.http.okhttp.callback.StringCallback;
    import com.zhy.http.okhttp.https.HttpsUtils;

    import java.io.ByteArrayInputStream;
    import java.io.ByteArrayOutputStream;
    import java.io.InputStream;
    import java.security.Key;
    import java.security.KeyStore;
    import java.security.cert.Certificate;
    import java.util.concurrent.TimeUnit;

    import okhttp3.Call;
    import okhttp3.OkHttpClient;

    public class MainActivity extends AppCompatActivity {

        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            setContentView(R.layout.activity_main);
            this.sslRequest();
        }

        protected void sslRequest() {

            // wiki: http://blog.csdn.net/lmj623565791/article/details/48129405

            InputStream certificates = getResources().openRawResource(R.raw.server);
            InputStream pkcs12File = getResources().openRawResource(R.raw.client);
            String password = "export111111";
            InputStream bksFile = this.pkcs12ToBks(pkcs12File, password);
            HttpsUtils.SSLParams sslParams = HttpsUtils.getSslSocketFactory(new InputStream[]{certificates}, bksFile, password);

            OkHttpClient okHttpClient = new OkHttpClient.Builder()
                    .connectTimeout(10000L, TimeUnit.MILLISECONDS)
                    .readTimeout(10000L, TimeUnit.MILLISECONDS)
                    .sslSocketFactory(sslParams.sSLSocketFactory, sslParams.trustManager)
                    .build();
            OkHttpUtils.initClient(okHttpClient);

            String url = "https://jegarn.com:7080/index.php";
            OkHttpUtils
                    .get()
                    .url(url)
                    .build()
                    .execute(new StringCallback() {
                        @Override
                        public void onError(Call call, Exception e, int id) {
                            e.printStackTrace();
                        }

                        @Override
                        public void onResponse(String response, int id) {
                            System.out.println(response);
                        }
                    });
        }

        protected InputStream pkcs12ToBks(InputStream pkcs12Stream, String pkcs12Password) {
            final String alias = "54b79d883ef1d8f74d018b6bb7443863d54a2beb";
            final char[] password = pkcs12Password.toCharArray();
            try {
                KeyStore pkcs12 = KeyStore.getInstance("PKCS12");
                pkcs12.load(pkcs12Stream, password);
                Certificate certificate = pkcs12.getCertificate(alias);
                /*Enumeration<String> aliases = pkcs12.aliases();
                while(aliases.hasMoreElements()){
                    System.out.println("alias: " + aliases.nextElement());
                }*/
                final Key key = pkcs12.getKey(alias, password);
                KeyStore bks = KeyStore.getInstance("BKS");
                bks.load(null, password);
                bks.setKeyEntry(alias, key, password, new Certificate[]{certificate});
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                bks.store(out, password);
                return new ByteArrayInputStream(out.toByteArray());
            } catch (Exception e) {
                e.printStackTrace();
            }

            return null;
        }
    }

运行项目,即可看到控制台输出"Hello World!".

至此, 移动端iOS和Android的SSL双向认证都成功完成了.