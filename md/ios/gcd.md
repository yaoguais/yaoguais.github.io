## iOS中GCD的实现与总结

GCD全称"Grand Central Dispatch", 中央调度的意思, 是iOS中标准异步处理的技术.

为什么会产生GCD呢, 这个跟其他语言类比下, 在Java中多使用线程, Erlang中使用协程,
其中协程比线程更加轻量更加优雅, 而iOS中的GCD就可以类比为协程这样让代码更加优雅的东西.

本篇内容是《Objective-C高级编程 iOS与OS X多线程和内存管理》的最后一部分, 也代表对这本书整理完毕了.

目录:

1. GCD的基础使用
2. GCD的分类
3. GCD相关的函数及其使用
    - dispatch\_queue\_create
    - dispatch\_get\_main\_queue
    - dispatch\_get\_global\_queue
    - dispatch\_set\_target\_queue
    - dispatch_after
    - dispatch_group
    - dispatch_barrier
    - dispatch_sync
    - dispatch_apply
    - dispatch\_suspend/dispatch\_resume
    - dispatch_semaphore
    - dispatch_once
    - dispatch I/O
4. GCD的实现
5. 总结




### GCD的基础使用

GCD的代码比较优雅, 应用简单, 也很好理解, 下面是一段示例代码:

    dispatch_async(queue, ^{
        // 后台长时间的处理
        dispatch_async(dispatch_get_main_queue(), ^{
            // 主线程(UI线程)处理
        });
    });

其中queue是"dispatch\_queue\_t"类型的变量, block是执行的代码块.

这段代码也可以使用NSObject的两个静态方法实现,

    [NSObject performSelectorOnMainThread:<#(SEL)aSelector#> withObject:<#(id)arg#> waitUntilDone:<#(BOOL)wait#>];
    [NSObject performSelectorInBackground:<#(SEL)aSelector#> withObject:<#(id)arg#>];

但是代码就会变得有点散杂乱了.




### GCD的分类

GCD的Queue总共分为两大类:

1. Serial Dispatch Queue
2. Concurrent Dispatch Queue

"Serial Dispatch Queue"是一个串行的队列, 添加到这种queue的block会依次执行. 但是也可以创建多个不同标识的这种queue,
它们内部的block依然是依次执行的, 但是这些queue之间是同时执行的. 需要注意的是, 一个serial类型的queue会对应一个线程,
创建大量的线程会损耗系统的性能.

"Concurrent Dispatch Queue"是"共享"多个串行的队列的结构, 每个队列跟serial类型的queue并无差别,
而队列的个数一般与操作系统的CPU个数相关.

上面"共享"的意思是不管你创建多少了concurrent类型的queue, 它们能使用的队列个数都是确定的一个值.


创建方式也很简单:

    dispatch_queue_t serialQueue = dispatch_queue_create("com.jegarn.serial_dispatch_queue", nil);
    dispatch_queue_t concurrentQueue = dispatch_queue_create("com.jegarn.concurrent_dispatch_queue", DISPATCH_QUEUE_CONCURRENT);

第一个参数是string类型的唯一标识, 第二个是Queue的类型标识.

需要注意的是"dispatch\_queue\_t"是C语言的结构体, 所以其并不在ARC的管理下, 所以在不使用的时候, 需要调用release方法释放.

    dispatch_release(serialQueue);

当然也可以增加其引用计数, 这与MRC管理内存的方式一致.

    dispatch_retain(concurrentQueue);

上面我们有提到"dispatch\_get\_main\_queue(void)"函数, 其实这是系统为我们提供获取主UI线程的queue的方法,
因为主UI线程的执行都是串行的, 那么获取也就是一个serial类型的queue.

系统还为我们提供一个函数"dispatch\_get\_global\_queue(,)", 这是为我们提供了一个全局的concurrent类型的queue.

用这两个函数的好处就是我们不需要做额外的内存管理了, 因为都是系统帮我们创建的, 其管理交给系统就好了.

"dispatch\_get\_global\_queue(,)"函数有两个参数, 第一个参数是设置放到这个queue里面的block的执行优先级, 第二个参数是一个flag,
传入0即可.

其优先级的定义如下:

    #define DISPATCH_QUEUE_PRIORITY_HIGH 2
    #define DISPATCH_QUEUE_PRIORITY_DEFAULT 0 // 默认
    #define DISPATCH_QUEUE_PRIORITY_LOW (-2)
    #define DISPATCH_QUEUE_PRIORITY_BACKGROUND INT16_MIN

根据我们上面对concurrent类型的queue的解释, 这个优先级并不一定就控制了block被执行的先后顺序, 它应该是一个建议的参数.




### GCD相关的函数及其使用


#### dispatch\_queue\_create

这个函数我们已经在上面详细的讲解了, 其函数原型为:

    dispatch_queue_t dispatch_queue_create(const char *label, dispatch_queue_attr_t attr);




#### dispatch\_get\_main\_queue

这个函数我们已经在上面详细的讲解了, 其函数原型为:

    dispatch_queue_t dispatch_get_main_queue(void);




#### dispatch\_get\_global\_queue

这个函数我们已经在上面详细的讲解了, 其函数原型为:

    dispatch_queue_t dispatch_get_global_queue(long identifier, unsigned long flags);




#### dispatch\_set\_target\_queue

其函数原型为:

    void dispatch_set_target_queue(dispatch_object_t object, dispatch_queue_t queue);

其含义类似于把一个queue当成block放到另一个queue里面去.

另一个就是通过"dispatch\_queue\_create()"获取的queue默认优先级是"DISPATCH\_QUEUE\_PRIORITY\_DEFAULT",
所以我们还可以通过这个函数改变其优先级.




#### dispatch_after

dispatch_after可以设置一个block在指定的时间执行

    void dispatch_after(dispatch_time_t when, dispatch_queue_t queue, dispatch_block_t block);

比如下面代码我们设置一个block在3秒后执行

    dispatch_time_t time = dispatch_time(DISPATCH_TIME_NOW, 3 * NSEC_PER_SEC);
    dispatch_after(time, dispatch_get_main_queue(), ^ { printf("hello\n"); });




#### dispatch_group

dispatch_group可以设置在多个block都执行完毕后回调一个block, 其用法的示例代码如下:

    dispatch_queue_t queue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0);
    dispatch_group_t group = dispatch_group_create();
    dispatch_group_async(group, queue, ^{ printf("1"); });
    dispatch_group_async(group, queue, ^{ printf("2"); });
    dispatch_group_async(group, queue, ^{ printf("3"); });
    dispatch_group_notify(group, dispatch_get_main_queue(), ^{ printf("all done!"); });
    dispatch_release(group);

我们也可以使用函数阻塞的等待添加的block执行, 其在等待了执行的时间之后, 如果返回0则代表所有block都执行完毕, 否则即有block仍在执行中.

其函数原型为:

    long dispatch_group_wait(dispatch_group_t group, dispatch_time_t timeout);




#### dispatch_barrier

这个函数的原型为:

    void dispatch_barrier_async(dispatch_queue_t queue, dispatch_block_t block);

这个函数一般作用于concurrent类型的queue上, 用于将调用这个函数前后的block分为两组, 前面的block组并发执行完毕后,
才会单独执行"dispatch\_barrier\_async"设置的block, 然后再并发执行后面的block组.

这个也能通过group实现, 但是barrier提供了更简单的实现.




#### dispatch_sync

其函数原型为:

    void dispatch_sync(dispatch_queue_t queue, dispatch_block_t block);

"dispatch_sync"从名字上也能看出是同步的处理, 意味该函数会一直阻塞到其设置的block执行完毕.




#### dispatch_apply

dispatch_apply能够实现把设置的block执行指定的次数.

    dispatch_apply(10, queue, ^(size_t index){
        printf("i am %d\n", index);
    });




#### dispatch\_suspend/dispatch\_resume

dispatch\_suspend()函数能够暂停queue, 将其挂起, 那么其中还未开始执行的block就会处于等待的状态,
然后调用dispatch\_resume()函数能够再次恢复执行.




#### dispatch_semaphore

dispatch_semaphore几乎跟操作系统的PV操作一致, 通过信号量保证资源的互斥访问.

    NSMutableArray * array = [[NSMutableArray alloc] initWithCapacity:10000];
    dispatch_queue_t queue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0);
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(1);
    for (int i = 0; i < 10000; ++i) {
        dispatch_async(queue, ^{
            // 一直等待semaphore的value大于等于1, 并且将value减1
            dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
            [array addObject:@(i)];
            // 将semaphore的value加1
            dispatch_semaphore_signal(semaphore);
        });
    }
    dispatch_release(semaphore);




#### dispatch_once

dispatch_once能够保证其设置的block被执行一次, 多用来实现单例模式.

    static id instance;

    + (instancetype)shareInstance {
        static dispatch_once_t once;
        dispatch_once(&once, ^{
            instance = [[XxxClass alloc] init];
        });
        return instance;
    }




#### dispatch I/O

当我们读取大文件时, 其实可以通过concurrent的queue并发读取, 但是已经iOS为我们提供这方面的支持.

下面是一段示例代码:

    pipe_q = dispatch_queue_create("PipeQ", NULL);
    pipe_channel = dispatch_io_create(DISPATCH_IO_STREAM, fd, pipe_q, ^(int err){
        close(fd);
    });

    *out_fd = fdpair[1];

    dispatch_io_set_low_water(pipe_channel, SIZE_MAX);

    dispatch_io_read(pipe_channel, 0, SIZE_MAX, pipe_q, ^(bool done, dispatch_data_t pipedata, int err){
        if (err == 0)
        {
            size_t len = dispatch_data_get_size(pipedata);
            if (len > 0)
            {
                const char *bytes = NULL;
                char *encoded;
                dispatch_data_t md = dispatch_data_create_map(pipedata, (const void **)&bytes, &len);
                encoded = asl_core_encode_buffer(bytes, len);
                asl_set((aslmsg)merged_msg, ASL_KEY_AUX_DATA, encoded);
                free(encoded);
                _asl_send_message(NULL, merged_msg, -1, NULL);
                asl_msg_release(merged_msg);
                dispatch_release(md);
            }
        }

        if (done)
        {
            dispatch_semaphore_signal(sem);
            dispatch_release(pipe_channel);
            dispatch_release(pipe_q);
        }
    });




### GCD的实现

GCD中最多出现的字就是queue, 而queue即是一个先进先出的队列, 队列的实现方式就很多了.

然后并发的执行难免会使用多线程, GCD是在内核级别的多线程的运用,
不同于pthreads/NSThread这种直接对应操作系统线程的方式.

多线程中的资源操作必然会使用到锁, 在上面的函数中我们也看到GCD有使用semaphore信号量.

最后在服务器编程中, 实现高效的运行一般会运用到事件驱动, 在linux中一般为epoll, 而iOS中则为kqueue.

GCD即是通过这些基础的东西实现的, 而且是优雅的, 易用的.




### 总结

花了两天时间, 把《Objective-C高级编程 iOS与OS X多线程和内存管理》一书全部读完了,
全书分为3章:内存管理,Blocks,GCD. 我也对应的写了3篇总结, 几乎涉及到应用的部分我都有记录下来,
而具体实现的部分实在太过冗长, 也就基本一笔带过了.

读完这本数, 对iOS一些基础的东西有了更清晰的认识, 基本算是入门了.