## Swoole源码分析之数据接收与发送

目录：

1. 探索什么
2. 启动流程
3. process模式
4. base模式
5. 数据读写
6. 验证脚本



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

事实证明Swoole使用的是第二种,对应的是process模式.(就是swoole_server构造函数的第三个参数)

Swoole模式总共有三种,Base模式(多个Worker进程之间无法通讯),Thread模式(由于PHP对多线程支持不好已经废弃),Process模式(上面说的那种).
具体可以参见[Swoole的官方文档](http://wiki.swoole.com/wiki/page/353.html).




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

        // 我们在下面专门进行讨论, 这里究竟做了多少东西
        if (factory->start(factory) < 0)
        {
            return SW_ERR;
        }
        // 信号处理 比如热更新 平滑重启 计时器通知等实现,这里master进程接收的信号,某些也会通过kill函数发送给manager进程
        swServer_signal_init();

        // single模式, 就是swoole_server构造函数的第三个参数
        if (serv->factory_mode == SW_MODE_SINGLE)
        {
            ret = swReactorProcess_start(serv);
        }
        // base & process模式
        else
        {
            ret = swServer_start_proxy(serv);
        }
        ...

        return SW_OK;
    }


我们这里对factory->start进行讨论

    // factory->start是怎么进行赋值的

    // 在swoole_server->__construct中
    #ifdef __CYGWIN__
        // 如果是windows环境
        serv->factory_mode = SW_MODE_SINGLE;
    #else
        // 如果是thread或者base模式
        if (serv_mode == SW_MODE_THREAD || serv_mode == SW_MODE_BASE)
        {
            serv_mode = SW_MODE_SINGLE;
            // base模式也需要抛出错误???
            swoole_php_fatal_error(E_WARNING, "PHP can not running at multi-threading. Reset mode to SWOOLE_MODE_BASE");
        }
        serv->factory_mode = serv_mode;
    #endif

    * 说明不是process模式的,都是会设置称single模式



    swoole_server.start -> php_swoole_server_before_start -> swServer_create
    // 如果是single模式
    if (serv->factory_mode == SW_MODE_SINGLE)
    {
        return swReactorProcess_create(serv);
    }
    else
    {
        return swReactorThread_create(serv);
    }

    swReactorProcess_create -> swFactory_create -> "factory->start = swFactory_start"
    int swFactory_start(swFactory *factory)
    {
        return SW_OK;
    }

    * 说明thread base single等模式什么也不做


    swReactorThread_create函数:
    if (serv->factory_mode == SW_MODE_THREAD)
    {
        if (serv->worker_num < 1)
        {
            swError("Fatal Error: serv->worker_num < 1");
            return SW_ERR;
        }
        ret = swFactoryThread_create(&(serv->factory), serv->worker_num);
    }
    else if (serv->factory_mode == SW_MODE_PROCESS)
    {
        if (serv->worker_num < 1)
        {
            swError("Fatal Error: serv->worker_num < 1");
            return SW_ERR;
        }
        ret = swFactoryProcess_create(&(serv->factory), serv->worker_num);
    }
    else
    {
        ret = swFactory_create(&(serv->factory));
    }

    * 现在不会有thread模式了,只有process模式调用的才是swFactoryProcess_create
      该函数执行"factory->start = swFactoryProcess_start"


通过以上分析,我们可以得出结论: 只有设置模式为SWOOLE_PROCESS时,才会在"factory->start"处创建管理进程Worker进程Task进程.

可以看出虽然base模式被设置成了single模式,但是并没有修改其worker_num参数,也就是说base模式也是可以有多个worker的.通过后面的分析,
加上实际的测试脚本,也印证了上面的结论.

然后我们分析swFactoryProcess_start(process模式专有),看看它是怎么创建进程组的.





### process模式

我们接着上面详细分析manager进程,worker进程组,task进程组是怎么创建的.它们又都做了写什么.稍后我们在分析master进程中reactor线程组是怎么工作的.


    static int swFactoryProcess_start(swFactory *factory)
    {
        ...

        //必须先启动manager进程组，否则会带线程fork
        if (swManager_start(factory) < 0)
        {
            swWarn("swFactoryProcess_manager_start failed.");
            return SW_ERR;
        }
        //主进程需要设置为直写模式
        factory->finish = swFactory_finish;
        return SW_OK;
    }

    int swManager_start(swFactory *factory)
    {
        ...

        // worker进程组初始化,创建workers与master进程通讯的管道
        for (i = 0; i < serv->worker_num; i++)
        {
            if (swPipeUnsock_create(&object->pipes[i], 1, SOCK_DGRAM) < 0)
            {
                return SW_ERR;
            }
            serv->workers[i].pipe_master = object->pipes[i].getFd(&object->pipes[i], SW_PIPE_MASTER);
            serv->workers[i].pipe_worker = object->pipes[i].getFd(&object->pipes[i], SW_PIPE_WORKER);
            serv->workers[i].pipe_object = &object->pipes[i];
            swServer_store_pipe_fd(serv, serv->workers[i].pipe_object);
        }

        // task进程组初始化
        if (SwooleG.task_worker_num > 0)
        {
            ...

            // 设置task的事件循环为swProcessPool_worker_loop, 设置task任务回调
            if (swProcessPool_create(&SwooleGS->task_workers, SwooleG.task_worker_num, SwooleG.task_max_request, key, create_pipe) < 0)
            {
                swWarn("[Master] create task_workers failed.");
                return SW_ERR;
            }
            ...
        }

        // process进程组初始化,现在应该还在完善当中,官方回调中也并没有指出onUserWorkerStart等UserProcess的相关php回调接口.
        if (serv->user_worker_num > 0)
        {
            serv->user_workers = sw_calloc(serv->user_worker_num, sizeof(swWorker *));
            swUserWorker_node *user_worker;
            i = 0;
            LL_FOREACH(serv->user_worker_list, user_worker)
            {
                if (swWorker_create(user_worker->worker) < 0)
                {
                    return SW_ERR;
                }
                serv->user_workers[i++] = user_worker->worker;
            }
        }

        pid = fork();
        switch (pid)
        {
        //创建manager进程
        case 0:

            ...

            // 创建并启动worker进程组
            for (i = 0; i < serv->worker_num; i++)
            {
                //close(worker_pipes[i].pipes[0]);
                pid = swManager_spawn_worker(factory, i);
                if (pid < 0)
                {
                    swError("fork() failed.");
                    return SW_ERR;
                }
                else
                {
                    serv->workers[i].pid = pid;
                }
            }

            // 创建并启动task进程组
            if (SwooleG.task_worker_num > 0)
            {
                swProcessPool_start(&SwooleGS->task_workers);
            }

            // 创建并启动process进程组
            if (serv->user_worker_list)
            {
                swUserWorker_node *user_worker;
                LL_FOREACH(serv->user_worker_list, user_worker)
                {
                    /**
                     * store the pipe object
                     */
                    if (user_worker->worker->pipe_object)
                    {
                        swServer_store_pipe_fd(serv, user_worker->worker->pipe_object);
                    }
                    swManager_spawn_user_worker(serv, user_worker->worker);
                }
            }

            //标识为管理进程
            SwooleG.process_type = SW_PROCESS_MANAGER;
            SwooleG.pid = getpid();

            if (serv->reload_async)
            {
                ret = swManager_loop_async(factory);
            }
            else
            {
                ret = swManager_loop_sync(factory);
            }
            exit(ret);
            break;

            //master process
        default:
            SwooleGS->manager_pid = pid;
            break;
        case -1:
            swError("fork() failed.");
            return SW_ERR;
        }
        return SW_OK;
    }


我们重点关注worker的创建: swManager_spawn_worker

    swManager_spawn_worker -> swWorker_loop

    int swWorker_loop(swFactory *factory, int worker_id)
    {
        ...

        // 创建reactor, 比如epoll
        if (swReactor_create(SwooleG.main_reactor, SW_REACTOR_MAXEVENTS) < 0)
        {
            swError("[Worker] create worker_reactor failed.");
            return SW_ERR;
        }

        serv->workers[worker_id].status = SW_WORKER_IDLE;

        int pipe_worker = serv->workers[worker_id].pipe_worker;

        swSetNonBlock(pipe_worker);
        SwooleG.main_reactor->ptr = serv;

        // 管道文件描述符监听
        SwooleG.main_reactor->add(SwooleG.main_reactor, pipe_worker, SW_FD_PIPE | SW_EVENT_READ);
        SwooleG.main_reactor->setHandle(SwooleG.main_reactor, SW_FD_PIPE, swWorker_onPipeReceive);
        SwooleG.main_reactor->setHandle(SwooleG.main_reactor, SW_FD_PIPE | SW_FD_WRITE, swReactor_onWrite);

        swWorker_onStart(serv);

        ...


        //main loop, 如果是epoll就是调用swReactorEpoll_wait函数
        SwooleG.main_reactor->wait(SwooleG.main_reactor, NULL);
        //clear pipe buffer
        swWorker_clean();
        //worker shutdown
        swWorker_onStop(serv);
        return SW_OK;
    }


通过上面的分析,我们可以看出

    worker读master的数据是调用的swWorker_onPipeReceive函数
    写数据给master会调用swReactor_onWrite函数


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

        //主要的事件循环,用于读写监听
        reactor->wait(reactor, NULL);
        //shutdown
        reactor->free(reactor);
        pthread_exit(0);
        return SW_OK;
    }


reactor->wait我们这里以epoll为例,分析事件循环都做些什么,具体的函数就是swReactorEpoll_wait.

这里多说一点,除心跳检测线程外(因为它不需要事件循环),其他线程都会创建一个swReactor对象,并拥有一个epoll_fd资源.

master线程负责接受客户端连接,然后把连接分配给一个工作线程,并让工作线程添加该连接的读写监听,那么该线程就负责该客户连接的所有读写事务了.


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
                    // 这里要区分是worker进程还是客户端的事件(下同)
                    // worker进程由于是管道通讯,所以设置的事件是"SW_FD_PIPE | SW_EVENT_READ"
                    // 其对应的回调是swReactorThread_onPipeReceive函数
                    // 而客户端连接由于是TCP连接,所以设置的是"SW_FD_TCP | SW_EVENT_READ"
                    // 其对应的回调是swReactorThread_onRead函数
                    // 这里的回调函数是通过查表得来的,因为管道的fd跟客户端的fd一定是不同的
                    // swoole即把其fd作为key,回调函数作为value.这样数据不用加锁也不会串,因为他们在不同的信道当中.

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



### base模式

base模式相较process模式就要简单的多了,因为它少了多个reactor线程,也少了worker与reactor之间的通讯,而是由worker独立维护客户端连接,
从swoole提供的默认参数是process模式来看,大多数服务端的应用场景并不是base模式.

base模式调用的是swReactorProcess_start,我们就接着这个函数分析.



    int swReactorProcess_start(swServer *serv)
    {

        ...

        // 初始化event_workers字段
        if (swProcessPool_create(&SwooleGS->event_workers, serv->worker_num, serv->max_request, 0, 1) < 0)
        {
            return SW_ERR;
        }

        SwooleGS->event_workers.ptr = serv;
        // 设置worker的事件循环函数
        SwooleGS->event_workers.main_loop = swReactorProcess_loop;

        ...

        //
        if (SwooleG.task_worker_num > 0)
        {

            ...

            // 指定task的事件循环是swProcessPool_worker_loop函数
            // 这里主要是通过管道读取worker发过来的数据,然后调用pool->onTask把数据传输给用户设置的回调函数,消化这个task
            swTaskWorker_init(&SwooleGS->task_workers);
            // 运行task进程组
            swProcessPool_start(&SwooleGS->task_workers);

            int i;
            for (i = 0; i < SwooleGS->task_workers.worker_num; i++)
            {
                // 将task添加到manager管理的进程组中
                swProcessPool_add_worker(&SwooleGS->event_workers, &SwooleGS->task_workers.workers[i]);
            }
        }

        // 这里是通过swoole_server->addProcess添加的进程
        if (serv->user_worker_list)
        {
            swUserWorker_node *user_worker;
            LL_FOREACH(serv->user_worker_list, user_worker)
            {
                ...

                // fork进程并运行进程
                // 这里会调用php_swoole_process_start启动该process进程
                // 在该函数中,会读取swoole_process对象的callback属性,即用户设置的回调函数
                // 然后调用sw_call_user_function_ex执行用户设置的php函数

                swManager_spawn_user_worker(serv, user_worker->worker);
            }
            SwooleGS->event_workers.onWorkerNotFound = swManager_wait_user_worker;
        }

        ...

        // 信号量的初始化,同process模式
        swServer_signal_init();


        // worker进程组, 调用swReactorProcess_loop进程事件循环
        swProcessPool_start(&SwooleGS->event_workers);

        // manager进程进行循环,主要执行worker重启等操作
        swProcessPool_wait(&SwooleGS->event_workers);
        swProcessPool_shutdown(&SwooleGS->event_workers);

        return SW_OK;
    }



worker进程的事件循环回调

    static int swReactorProcess_loop(swProcessPool *pool, swWorker *worker)
    {

        ...

        // 创建事件循环对象,像process模式的例子,就是创建的epoll多路复用
        if (swReactor_create(reactor, SW_REACTOR_MAXEVENTS) < 0)
        {
            swWarn("ReactorProcess create failed.");
            return SW_ERR;
        }

        swListenPort *ls;
        int fdtype;

        //listen the all tcp port
        LL_FOREACH(serv->listen_list, ls)
        {
            fdtype = swSocket_is_dgram(ls->type) ? SW_FD_UDP : SW_FD_LISTEN;

            ...

            // 监听TCP与UDP的端口
            reactor->add(reactor, ls->sock, fdtype);
        }
        SwooleG.main_reactor = reactor;

        // 设置一系列的监听回调,这里跟比较特别的就是前面讲的设置了accept回调

        //connect
        reactor->setHandle(reactor, SW_FD_LISTEN, swServer_master_onAccept);
        //close
        reactor->setHandle(reactor, SW_FD_CLOSE, swReactorProcess_onClose);
        //pipe
        reactor->setHandle(reactor, SW_FD_PIPE | SW_EVENT_WRITE, swReactor_onWrite);
        reactor->setHandle(reactor, SW_FD_PIPE | SW_EVENT_READ, swReactorProcess_onPipeRead);

        ...


        // 设置客户端的读写回调
        swReactorThread_set_protocol(serv, reactor);

        ...

        // 每一个进程都有一个心跳检测的线程
        if (serv->heartbeat_check_interval > 0)
        {
            swHeartbeatThread_start(serv);
        }

        ...

        // 进程事件循环, 下面我们仍然以epoll举例
        struct timeval timeo;
        timeo.tv_sec = 1;
        timeo.tv_usec = 0;
        return reactor->wait(reactor, &timeo);
    }


base模式跟process模式一样(epoll为例),最后都是调用的swReactorEpoll_wait函数


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
                ...
            }
            for (i = 0; i < n; i++)
            {
                event.fd = events[i].data.u64;
                event.from_id = reactor_id;
                event.type = events[i].data.u64 >> 32;
                event.socket = swReactor_get(reactor, event.fd);

                // 下面我们以读操作为例
                if ((events[i].events & EPOLLIN) && !event.socket->removed)
                {
                    handle = swReactor_getHandle(reactor, SW_EVENT_READ, event.type);
                    ret = handle(reactor, &event);
                    if (ret < 0)
                    {
                        swSysError("EPOLLIN handle failed. fd=%d.", event.fd);
                    }
                }

                ...
            }
            ...
        }
        return 0;
    }

当客户端连接来的时候,epoll会把客户端fd标识为可读,即EPOLLIN标志.

我们观察代码可以发现一个问题, Swoole并没有用加锁的方式处理惊群,
关于惊群可以看看[这篇文章](http://blog.csdn.net/russell_tao/article/details/7204260),
nginx中是所有加锁的方式来处理的惊群,对应其配置文件event模块的accept_mutex配置项.

Swoole这里采取让epoll_wait等待1秒钟,那么当一个客户连接到来时,每个worker都会收到read事件,但是只有一个worker
能接收这个客户端连接,这里是不是还有优化的空间呢?仍值得商榷.



### 数据读写

通过上面的分析(我们只分析了关于客户端的数据走向,并且是TCP协议的)
我们已经明确了swoole在启动的时候,做了哪些操作.下面我们仍然分别对base模式跟process模式进行讨论.

###### process模式


    master线程接收client连接:
    swReactorEpoll_wait -> swServer_master_onAccept -> accept系统调用

    master线程将client连接分配给reactor线程:
    swServer_master_onAccept -> "sub_reactor->add" -> epoll_ctl系统调用

    reactor线程读取client数据:
    swReactorEpoll_wait -> swReactorThread_onRead -> "port->onRead" -> swPort_onRead_raw -> swConnection_recv -> recv系统调用

    reactor线程转发数据给worker:
    swPort_onRead_raw -> "serv->factory.dispatch" -> swFactoryProcess_dispatch -> swReactorThread_send2worker -> write管道

    worker接收reactor线程数据:
    swReactorEpoll_wait -> swWorker_onPipeReceive -> read管道 -> swWorker_onTask -> "goto do_task" -> serv->onReceive
    -> php_swoole_onReceive -> sw_call_user_function_ex(将数据传递给用户设置的函数)

    worker发送数据给reactor线程:
    swoole_server.send -> PHP_METHOD(swoole_server, send) -> swServer_tcp_send -> "factory->finish" -> swFactoryProcess_finish
    -> swWorker_send2reactor -> swSocket_write_blocking -> write管道

    reactor线程接收worker数据:
    swReactorEpoll_wait -> swReactorThread_onPipeReceive -> read管道

    reactor线程发送数据给client:
    swReactorThread_send -> swConnection_send -> send系统调用

    server被动关闭连接:(同reactor线程读取客户端数据,但是recv 0)
    swPort_onRead_raw -> swReactorThread_onClose -> swReactor_close -> close系统调用

    server主动关闭连接:
    swoole_server.close(worker发起) -> PHP_METHOD(swoole_server, close) -> "factory->end" -> swFactoryProcess_end(type:SW_EVENT_CLOSE)
    -> "factory->finish" -> swFactoryProcess_finish -> swWorker_send2reactor -> swWorker_send2reactor
    -> swSocket_write_blocking -> write管道
    swReactorThread_onPipeReceive(reactor接收) -> read管道 -> swReactorThread_send -> "goto close_fd" -> "reactor->close"
    -> swReactorThread_close -> swReactor_close -> close系统调用


至此,process模式下怎么接收客户端连接,怎么关闭客户端连接,怎么接收客户端数据,怎么给客户端发送数据等都有了清晰的分析.

下面我们分析base模式的.


###### base模式

base模式是每个worker进程单独接收client连接,各个client不能在worker端进行共享.

    worker接收连接:
    swServer_master_onAccept -> accept系统调用

    worker接收client数据:
    swReactorEpoll_wait -> swReactorThread_onRead ->  "port->onRead" -> swPort_onRead_raw -> swConnection_recv -> recv系统调用
    swPort_onRead_raw -> "serv->factory.dispatch" -> swFactory_dispatch -> swWorker_onTask -> "goto do_task" -> serv->onReceive
    -> php_swoole_onReceive -> sw_call_user_function_ex(将数据传递给用户设置的函数)

    // todo
    worker发送数据给client:

    server被动关闭连接:

    server主动关闭连接:


base模式下的流程相较process模式要简单的多.




### 验证脚本

goon