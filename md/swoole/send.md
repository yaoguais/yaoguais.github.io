## Swoole源码分析之数据接收与发送

目录：

1. 探索什么
2. 启动流程
3. process模式
4. base模式
5. Master接收连接
6. Worker接收数据
7. Worker发送数据
8. Master转发数据
9. 验证脚本
10. 简单猜想
11. 单步证实



### 探索什么

事情的起因是这样的,进行Swoole应用开发的时候,发现各个Worker可以给任意一个客户端发送消息,即调用$serv->send($fd, $data),
而不用关心客户端第一次是哪个Worker接收的数据.

如果你细细一想,发现这是一件很神奇的事情,多个不同的进程居然可以给任意的fd(文件描述符,客户端的连接标识)发送数据.

因为不同的进程都有自己的文件描述符表,在当前进程进行send的时候,首先是根据fd去查自己进程的文件描述符表.
这里容易有一个误区,认为fd是一个数字,父子进程或者兄弟进程只要拿到这个fd数字就能发送数据,这个是不行的,
而必须要fd对应的表中纪录的指针指向"目标客户端"才行.

可以先看看这篇[关于文件描述符的文章](http://blog.csdn.net/cywosp/article/details/38965239),讲的很清晰.

那么纪录什么情况下产生,什么情况下不产生呢?当A进程fork出B,C等子进程时,A当前打开的文件描符就会被复制给他的子进程,
fork之后这些进程新产生的fd,只会在当前进程的fd表生成文件关联纪录,他的父子进程或兄弟进程并不会自动添加这条纪录.

知道以上情况后,我们就会明白那的确有点神奇.但是它是怎么实现的呢?有两种猜想.

一是父进程(Master)将所有的客户端文件描传递(通过sendmsg等)传递给子进程们(Workers),那么子进程就会在自己的fd表中添加纪录,
然后自然就可以接收与发送数据了.

二是父进程(Master)将所有客户端发来的数据转发给子进程(Worker),然后子进程收到数据进行处理.如果要发送数据给客户端,
那么先把数据转发给Master,然后再由Master发送给客户端.

事实证明Swoole是两种都使用了,一对应的是base模式,二对应的是process模式.(就是swoole_server构造函数的第三个参数)




### 启动流程


在具体分析数据的接收与发送之前我们先分析一下Swoole的启动流程,在将Swoole启动流程之前,先介绍一下PHP的启动流程,因为Swoole是基于PHP的.

PHP的启动流程大致分为4个过程(忽略sapi,配置文件解析等),我们以php-fpm+nginx举例.

* 首先启动php-fpm的时候会初始化所有的扩展,像PDO Swoole这些,我们称之为MINIT阶段.
* 然后当HTTP请求到达php-fpm,会调用所有扩展的RINIT函数,接下来我们写的PHP代码就会被解析运行,我们称之为RINIT阶段.
* 然后当我们的代码全部执行完毕,会调用所有扩展的RSHUTDOWN函数,执行一些重置或清理操作,我们称之为RSHUTDOWN阶段.
* 然后我们关闭php-fpm,这时会调用所有扩展的MSHUTDOWN函数,做一些申请的内存释放等操作,我们称之为MSHUTDOWN阶段.

Swoole自然也要遵循上面的流程.

MINIT阶段

    /* {{{ PHP_MINIT_FUNCTION
     */
    PHP_MINIT_FUNCTION(swoole)
    {
        // 全局变量初始化
        ZEND_INIT_MODULE_GLOBALS(swoole, php_swoole_init_globals, NULL);
        // 配置项的注册
        REGISTER_INI_ENTRIES();

        ....

        // 将一些常量注册到PHP中
        REGISTER_STRINGL_CONSTANT("SWOOLE_VERSION", PHP_SWOOLE_VERSION, sizeof(PHP_SWOOLE_VERSION) - 1, CONST_CS | CONST_PERSISTENT);

        // 将一些类注册到PHP中
        SWOOLE_INIT_CLASS_ENTRY(swoole_server_ce, "swoole_server", "Swoole\\Server", swoole_server_methods);
        swoole_server_class_entry_ptr = zend_register_internal_class(&swoole_server_ce TSRMLS_CC);

        // Swoole全局变量初始化 各个模块常量函数类的注册
        swoole_init();

        ....

        swoole_buffer_init(module_number TSRMLS_CC);
        swoole_websocket_init(module_number TSRMLS_CC);

        ....

        return SUCCESS;
    }
    /* }}} */



RINIT阶段

    PHP_RINIT_FUNCTION(swoole)
    {
        //将Server标识为启动状态
        SwooleG.running = 1;

        ...

        return SUCCESS;
    }


调用$serv->start()函数

    PHP_METHOD(swoole_server, start)
    {
        ...

        swServer *serv = swoole_get_object(zobject);
        // 根据配置注册所有的回调函数,如onConnect onReceive等
        php_swoole_register_callback(serv);

        ...
        // 更新对象的属性,比如当前进程ID Worker数量等
        php_swoole_server_before_start(serv, zobject TSRMLS_CC);

        // 最复杂的Server启动过程
        ret = swServer_start(serv);

        ...

        RETURN_TRUE;
    }



swServer_start函数

    int swServer_start(swServer *serv)
    {
        // 工厂模式
        // Base模式, 多进程, 在worker进程中直接accept连接
        // Thread模式, 现在都不支持了
        // Process模式, 多进程, 在master进程中accept连接
        swFactory *factory = &serv->factory;

        ...

        // 主要检查是否一些必须设置的回调没设置 比如配置了task数量却没有设置task回调函数
        ret = swServer_start_check(serv);

        ...


        // 变成守护进程的操作
        if (serv->daemonize > 0)
        {
            ....
        }
        ...

        // 分配workers的空间
        serv->workers = SwooleG.memory_pool->alloc(SwooleG.memory_pool, serv->worker_num * sizeof(swWorker));
        ....

        // 创建进程组,包括进程组管理进程 Worker进程 Task进程
        if (factory->start(factory) < 0)
        {
            return SW_ERR;
        }
        // 信号处理 比如热更新 平滑重启等实现
        swServer_signal_init();

        // base模式, 就是swoole_server构造函数的第三个参数
        if (serv->factory_mode == SW_MODE_SINGLE)
        {
            ret = swReactorProcess_start(serv);
        }
        // process模式
        else
        {
            ret = swServer_start_proxy(serv);
        }
        ...

        return SW_OK;
    }








### process模式

上面在启动Server的时候分为了base和process模式,process就是Master负责接收连接,然后通过管道传输数据.

    /**
     * proxy模式
     * 在单独的n个线程中接受维持TCP连接
     */
    static int swServer_start_proxy(swServer *serv)
    {
        ...

        // 初始化一个reactor, 这个函数指定了具体使用poll epoll kqueue等
        ret = swReactor_create(main_reactor, SW_REACTOR_MINEVENTS);

        ...

        // 根据配置的reactor_num创建指定大小的线程池, 用于执行swReactorThread_loop_stream函数,进行事件循环
        ret = swReactorThread_start(serv, main_reactor);

        ...

        // 额外创建心跳检测线程,用于执行swHeartbeatThread_loop函数,把超时的连接主动断掉
        swHeartbeatThread_start(serv);

        ...

        main_reactor->id = serv->reactor_num;
        main_reactor->ptr = serv;
        // 用于接收客户连接
        main_reactor->setHandle(main_reactor, SW_FD_LISTEN, swServer_master_onAccept);

        ...

        // master线程也进行事件循环
        return main_reactor->wait(main_reactor, &tmo);
    }

这里总结下来最多会创建1+reactor_num+1个线程

* 心跳线程用于关闭长时间没有发送消息的客户连接
* master线程用于接受客户端连接(单独的线程不必加锁)
* 其他线程用于接收与发送数据 关闭连接等



线程池的事件循环

    static int swReactorThread_loop_stream(swThreadParam *param)
    {
        ...

        // 设置当前线程的事件回调
        reactor->onFinish = NULL;
        reactor->onTimeout = NULL;
        reactor->close = swReactorThread_close;

        reactor->setHandle(reactor, SW_FD_CLOSE, swReactorThread_onClose);
        // 与worker进程通讯时的回调
        reactor->setHandle(reactor, SW_FD_PIPE | SW_EVENT_READ, swReactorThread_onPipeReceive);
        reactor->setHandle(reactor, SW_FD_PIPE | SW_EVENT_WRITE, swReactorThread_onPipeWrite);

        //set protocol function point
        // 与客户连接进行通讯的回调,如读数据调用swReactorThread_onRead函数
        swReactorThread_set_protocol(serv, reactor);

        ...

        // 多进程模式下,初始化进程间通讯管道的连接参数
        if (serv->factory_mode == SW_MODE_PROCESS)
        {
            for (i = 0; i < serv->worker_num; i++)
            {
                if (i % serv->reactor_num == reactor_id)
                {
                    pipe_fd = serv->workers[i].pipe_master;

                    ...

                    serv->connection_list[pipe_fd].from_id = reactor_id;
                    serv->connection_list[pipe_fd].fd = pipe_fd;
                    serv->connection_list[pipe_fd].object = sw_malloc(sizeof(swLock));

                    ...

                }
            }
        }

        ...

        //主要的事件循环,用于
        reactor->wait(reactor, NULL);
        //shutdown
        reactor->free(reactor);
        pthread_exit(0);
        return SW_OK;
    }


reactor->wait我们这里以epoll为例,分析事件循环都做些什么,具体的函数就是swReactorEpoll_wait

    static int swReactorEpoll_wait(swReactor *reactor, struct timeval *timeo)
    {
        ...

        while (reactor->running > 0)
        {
            msec = reactor->timeout_msec;
            n = epoll_wait(epoll_fd, events, max_event_num, msec);
            if (n < 0)
            {
                ...
            }
            else if (n == 0)
            {
                // 超时的回调
                if (reactor->onTimeout != NULL)
                {
                    reactor->onTimeout(reactor);
                }
                continue;
            }
            for (i = 0; i < n; i++)
            {
                event.fd = events[i].data.u64;
                event.from_id = reactor_id;
                event.type = events[i].data.u64 >> 32;
                event.socket = swReactor_get(reactor, event.fd);

                //read
                if ((events[i].events & EPOLLIN) && !event.socket->removed)
                {
                    // 即调用前面的swReactorThread_onRead函数
                    handle = swReactor_getHandle(reactor, SW_EVENT_READ, event.type);
                    ret = handle(reactor, &event);
                    ...
                }
                //write
                if ((events[i].events & EPOLLOUT) && !event.socket->removed)
                {
                    handle = swReactor_getHandle(reactor, SW_EVENT_WRITE, event.type);
                    ret = handle(reactor, &event);
                    ...
                }
                //error
                ....
                {
                    handle = swReactor_getHandle(reactor, SW_EVENT_ERROR, event.type);
                    ret = handle(reactor, &event);
                    ...
                }
            }

            if (reactor->onFinish != NULL)
            {
                reactor->onFinish(reactor);
            }
        }
        return 0;
    }


至此,master进程在process模式下的每个线程的具体工作也分析完毕了.