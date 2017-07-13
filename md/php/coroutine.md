## PHP与协程

协程可以理解为用户态的线程, 拥有比操作系统线程更小的开销,
而且受用户代码的调度, 在PHP中, 可以使用yield/Generator等特性进行调度.

目录:

1. 对基础术语的理解
2. 理解iterator的执行顺序
3. generator遍历的流程
4. 生成器的退出方式
5. 生成器的返回值
6. send方法的执行流程
7. generator的异常处理
8. 使用协程实现http服务器
9. swoole中协程的实现
10. 总结


在了解PHP的协程之前, 可以参照几篇关于这部分的内容.

- [生成器总览](http://php.net/manual/zh/language.generators.overview.php)
- [生成器语法](http://php.net/manual/zh/language.generators.syntax.php)
- [在PHP中使用协程实现多任务调度](http://www.laruence.com/2015/05/28/3038.html)
- [PHP 知识补全 —— 生成器 （generator）和协程的实现](https://laravel-china.org/articles/1430/single-php-generator-complete-knowledge-generator-implementation-process)

### 对基础术语的理解

yield关键字的用法:

放在函数中, 将函数转变成一个特殊对象, 即Generator对象.

Generator类的定义:

```
Generator implements Iterator {
    /* 方法 */
    public mixed current ( void )
    public mixed key ( void )
    public void next ( void )
    public void rewind ( void )
    public mixed send ( mixed $value )
    public void throw ( Exception $exception )
    public bool valid ( void )
    public void __wakeup ( void )
    public mixed function getReturn(void) // PHP7
}

Generator::current — 返回当前产生的值
Generator::key — 返回当前产生的键
Generator::next — 生成器继续执行
Generator::rewind — 重置生成器
Generator::send — 向生成器中传入一个值
Generator::throw — 向生成器中抛入一个异常
Generator::valid — 检查生成器是否被关闭
Generator::__wakeup — 序列化回调
```

从上面可以看出, Generator类实现了Iterator接口, 因此可以使用foreach进行遍历.

```
interface Iterator extends Traversable {
    public function current();
    public function next();
    public function key();
    public function valid();
    public function rewind();
}
```

### 理解iterator的执行顺序

下面写了一个简单的类实现Iterator接口.

```
<?php

class I implements Iterator {
   private $i;
   public function current() {
       echo "current\n";
       return $this->i;
    }
   public function next() {
       echo "next\n";
       $this->i++;
   }
   public function key() {
        echo "key\n";
        return $this->i + 1;
   }
   public function valid() {
        echo "valid\n";
        return $this->i < 2;
   }
   public function rewind(){
        echo "rewind\n";
        $this->i = 0;
   }
}

foreach((new I) as $k => $v) {
    echo "$k => $v\n";
}

// Output
rewind
valid
current
key
1 => 0
next
valid
current
key
2 => 1
next
valid
```

我们可以得出结论, 遍历开始时会调用rewind方法, 重置内部指针.

然后调用valid函数监测当前状态是否合法,

接着调用current获取当前值, key获取当前键.

紧接着执行echo语句输出当前键值, 最后执行next将指针移向下一个地方.

而Generator既然实现Iterator接口, 自然也有同样的流程.


### generator遍历的流程

下面写了一个简单的生成器测试代码.

```
<?php
function printer()
{
    $i = 0;
    while (true) {
        echo "before\n";
        yield $i;
        echo "after\n";
        $i++;
    }
}

$printer = printer();
echo "current1\n";
var_dump($printer->current());
echo "next\n";
var_dump($printer->next());
echo "current2\n";
var_dump($printer->current());

// Output
current1
before
int(0)
next
after
before
NULL
current2
int(1)
```

可以看出,调用current函数, 生成器会在第一个yield处停住, 并返回yield的右值.
接着回到main函数, 调用var_dump将返回值int(0)打印出来.

接着调用next函数, 生成器继续运行到下一个yield处停住, 因为next只移动指针不返回值,
所以当前yield并未执行.

接着调用current函数, 生成器返回int(1).

如果不调用next函数, 则两次current函数的输出都将是int(0), 且不会输出"after"关键字.


### 生成器的退出方式

生成器在执行过程中, 如果没有遇到yield关键字, 而直接遇到return或者函数结束,
那么此时生成器就会退出遍历, 即valid返回返回了false.

下面看一段代码:

```
<?php

function printer() {
    $i = 0;
    while($i < 2) {
        echo "before\n";
        yield $i + 1 => $i;
        echo "after\n";
        $i++;
    }
    echo "done";
}

foreach(printer() as $k => $v) {
    echo "$k => $v\n";
}

// Output
before
1 => 0
after
before
2 => 1
after
done
```

### 生成器的返回值

因为生成器在书写的时候, 是一个函数, 函数当然也有返回值.

而这个返回值可以通过生成器的getReturn方法获得.

看下面一段代码:

```
<?php

function printer() {
    $i = 0;
    while($i < 2) {
        echo "before\n";
        yield $i + 1 => $i;
        echo "after\n";
        $i++;
    }
    echo "done\n";

    return "returned";
}

$gen = printer();
// PHP Fatal error:  Uncaught Exception: Cannot get return value of a generator
// that hasn't returned
// var_dump($gen->getReturn());
foreach($gen as $k => $v) {
    echo "$k => $v\n";
}
var_dump($gen->getReturn());

// Output
before
1 => 0
after
before
2 => 1
after
done
string(8) "returned"
```

可以看出, 在生成器执行完毕后, 我们可以通过getReturn获取其返回值.

如果生成器还没有执行完毕, 调用getReturn会抛出异常.

### send方法的执行流程

下面先看一段代码:

```
<?php
function printer()
{
    $i = 0;
    while (true) {
        echo "before\n";
        printf("receive: %s\n", (yield ++$i));
        echo "after\n";
        $i++;
    }
}

$printer = printer();
printf("current1: %d\n", $printer->current());
var_dump($printer->send('hello'));
printf("current2: %d\n", $printer->current());
var_dump($printer->send('world'));
printf("current3: %d\n", $printer->current());

// Output
before
current1: 1
receive: hello
after
before
int(3)
current2: 3
receive: world
after
before
int(5)
current3: 5
```

从上面的流程, 调用current函数, 进入生成器, 停在yield语句并返回1给main函数,
然后调用send函数, 生成器继续执行, 直到遇到下一个yield,
然后send返回当前yield的值int(3).

而我们从send的[wiki](http://sg2.php.net/manual/en/generator.send.php)
得知, send的返回值是"Returns the yielded value.", 与上面的结果相吻合.

### generator的异常处理

还是看一段代码:
```
<?php
function gen() {
     echo "Foo\n";
     try {
        yield 1;
    } catch (Exception $e) {
        echo "Exception: {$e->getMessage()}\n";
    }
    echo "Bar\n";

}

$gen = gen();
var_dump($gen->current());
$gen->throw(new Exception('Test'));

// Output
Foo
int(1)
Exception: Test
Bar
```

可以看出, 调用current函数后, 生成器停在yield处, 而main调用throw函数,
则生成器中当前yield处会抛出指定的异常.


### 使用协程实现http服务器

参考鸟哥翻译的文章, 修改了部分代码, 实现用PHP协程写http服务器.

主要思路是使用IO多路复用, 当socket当有事件发生时, 才进行对应的操作,

而不是一直阻塞等待.

代码如下:

```
<?php

class Task
{
    protected $taskId;
    protected $coroutine;
    protected $sendValue = null;
    protected $beforeFirstYield = true;

    public function __construct($taskId, Generator $coroutine)
    {
        $this->taskId = $taskId;
        $this->coroutine = $coroutine;
    }

    public function getTaskId()
    {
        return $this->taskId;
    }

    public function setSendValue($sendValue)
    {
        $this->sendValue = $sendValue;
    }

    public function run()
    {
        if ($this->beforeFirstYield) {
            $this->beforeFirstYield = false;
            return $this->coroutine->current();
        } else {
            $retval = $this->coroutine->send($this->sendValue);
            $this->sendValue = null;
            return $retval;
        }
    }

    public function isFinished()
    {
        return !$this->coroutine->valid();
    }
}

class Scheduler
{
    protected $maxTaskId = 0;
    protected $taskMap = []; // taskId => task
    protected $taskQueue;
    protected $waitingForRead = [];
    protected $waitingForWrite = [];


    public function __construct()
    {
        $this->taskQueue = new SplQueue();
    }

    public function newTask(Generator $coroutine)
    {
        $tid = ++$this->maxTaskId;
        $task = new Task($tid, $coroutine);
        $this->taskMap[$tid] = $task;
        $this->schedule($task);
        return $tid;
    }

    public function schedule(Task $task)
    {
        $this->taskQueue->enqueue($task);
    }

    /*public function run() {
        while (!$this->taskQueue->isEmpty()) {
            $task = $this->taskQueue->dequeue();
            $task->run();

            if ($task->isFinished()) {
                unset($this->taskMap[$task->getTaskId()]);
            } else {
                $this->schedule($task);
            }
        }
    }*/

    public function run()
    {
        while (!$this->taskQueue->isEmpty()) {
            $task = $this->taskQueue->dequeue();
            $retval = $task->run();

            if ($retval instanceof SystemCall) {
                $retval($task, $this);
                continue;
            }

            if ($task->isFinished()) {
                unset($this->taskMap[$task->getTaskId()]);
            } else {
                $this->schedule($task);
            }
        }
    }

    public function waitForRead($socket, Task $task)
    {
        if (isset($this->waitingForRead[(int)$socket])) {
            $this->waitingForRead[(int)$socket][1][] = $task;
        } else {
            $this->waitingForRead[(int)$socket] = [$socket, [$task]];
        }
    }

    public function waitForWrite($socket, Task $task)
    {
        if (isset($this->waitingForWrite[(int)$socket])) {
            $this->waitingForWrite[(int)$socket][1][] = $task;
        } else {
            $this->waitingForWrite[(int)$socket] = [$socket, [$task]];
        }
    }

    protected function ioPoll($timeout)
    {
        $rSocks = [];
        foreach ($this->waitingForRead as list($socket)) {
            $rSocks[] = $socket;
        }

        $wSocks = [];
        foreach ($this->waitingForWrite as list($socket)) {
            $wSocks[] = $socket;
        }

        $eSocks = []; // dummy

        // fix PHP Warning:  stream_select(): No stream arrays were passed
        if (count($rSocks) == 0 && count($wSocks) == 0) {
            return;
        }

        echo "in select\n";
        if (!stream_select($rSocks, $wSocks, $eSocks, $timeout)) {
            echo "out select\n";
            return;
        }
        echo "out select\n";

        foreach ($rSocks as $socket) {
            list(, $tasks) = $this->waitingForRead[(int)$socket];
            unset($this->waitingForRead[(int)$socket]);

            foreach ($tasks as $task) {
                $this->schedule($task);
            }
        }

        foreach ($wSocks as $socket) {
            list(, $tasks) = $this->waitingForWrite[(int)$socket];
            unset($this->waitingForWrite[(int)$socket]);

            foreach ($tasks as $task) {
                $this->schedule($task);
            }
        }
    }

    public function ioPollTask()
    {
        while (true) {
            if ($this->taskQueue->isEmpty()) {
                $this->ioPoll(null);
            } else {
                $this->ioPoll(0);
            }
            yield;
        }
    }

}

class SystemCall
{
    protected $callback;

    public function __construct(callable $callback)
    {
        $this->callback = $callback;
    }

    public function __invoke(Task $task, Scheduler $scheduler)
    {
        $callback = $this->callback;
        return $callback($task, $scheduler);
    }
}

function newTask(Generator $coroutine)
{
    return new SystemCall(
        function (Task $task, Scheduler $scheduler) use ($coroutine) {
            $task->setSendValue($scheduler->newTask($coroutine));
            $scheduler->schedule($task);
        }
    );
}

function waitForRead($socket)
{
    return new SystemCall(
        function (Task $task, Scheduler $scheduler) use ($socket) {
            $scheduler->waitForRead($socket, $task);
        }
    );
}

function waitForWrite($socket)
{
    return new SystemCall(
        function (Task $task, Scheduler $scheduler) use ($socket) {
            $scheduler->waitForWrite($socket, $task);
        }
    );
}

function server($port)
{
    echo "Starting server at port $port...\n";

    $socket = @stream_socket_server("tcp://localhost:$port", $errNo, $errStr);
    if (!$socket) {
        throw new Exception($errStr, $errNo);
    }

    stream_set_blocking($socket, 0);
    $opts = stream_context_get_options($socket);
    $opts['socket']['backlog'] = 512;
    stream_context_set_option($socket, $opts);

    while (true) {
        echo "wait for accept\n";
        yield waitForRead($socket);
        while ($clientSocket = @stream_socket_accept($socket, 0)) {
            echo sprintf("accept client %d\n", $clientSocket);
            yield newTask(handleClient($clientSocket));
        }
    }
}

function handleClient($socket)
{
    echo sprintf("wait for read, client %d\n", $socket);
    yield waitForRead($socket);
    $data = fread($socket, 8192);

    $msg = "Received following request:\n\n$data";
    $msgLength = strlen($msg);

    echo sprintf("read success, client %d\n", $socket);

    $response = <<<RES
HTTP/1.1 200 OK\r
Content-Type: text/plain\r
Content-Length: $msgLength\r
Connection: close\r
\r
$msg
RES;

    echo sprintf("wait for write, client %d\n", $socket);
    yield waitForWrite($socket);
    fwrite($socket, $response);

    echo sprintf("write success, client %d\n", $socket);

    fclose($socket);
}

$scheduler = new Scheduler;
$scheduler->newTask(server(8000));
$scheduler->newTask($scheduler->ioPollTask());
$scheduler->run();


```

使用ab工具进行测试:
```
ab -c 100 -n 10000 http://localhost:8000/
This is ApacheBench, Version 2.3 <$Revision: 1706008 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking localhost (be patient)
Completed 1000 requests
Completed 2000 requests
Completed 3000 requests
Completed 4000 requests
Completed 5000 requests
Completed 6000 requests
Completed 7000 requests
Completed 8000 requests
Completed 9000 requests
Completed 10000 requests
Finished 10000 requests


Server Software:
Server Hostname:        localhost
Server Port:            8000

Document Path:          /
Document Length:        111 bytes

Concurrency Level:      100
Time taken for tests:   13.835 seconds
Complete requests:      10000
Failed requests:        0
Total transferred:      1960000 bytes
HTML transferred:       1110000 bytes
Requests per second:    722.78 [#/sec] (mean)
Time per request:       138.354 [ms] (mean)
Time per request:       1.384 [ms] (mean, across all concurrent requests)
Transfer rate:          138.35 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    7  87.9      0    3003
Processing:     0   79 728.2      6   12833
Waiting:        0   79 728.1      6   12833
Total:          1   87 801.8      6   13832

Percentage of the requests served within a certain time (ms)
  50%      6
  66%      7
  75%      7
  80%      8
  90%      9
  95%      9
  98%    867
  99%    902
 100%  13832 (longest request)
```

### swoole中协程的实现

Swoole2.0基于setjmp、longjmp实现，在进行协程切换时会自动保存Zend VM的内存状态（主要是EG全局内存和vm stack）。

setjmp、longjmp的使用如下:

```
#include <stdio.h>
#include <setjmp.h>

static jmp_buf buf;

void second(void) {
    printf("second\n");         // 打印
    longjmp(buf,1);             // 跳回setjmp的调用处 - 使得setjmp返回值为1
}

void first(void) {
    second();
    printf("first\n");          // 不可能执行到此行
}

int main() {
    if ( ! setjmp(buf) ) {
        first();                // 进入此行前，setjmp返回0
    } else {                    // 当longjmp跳转回，setjmp返回1，因此进入此行
        printf("main\n");       // 打印
    }

    return 0;
}

// Output
second
main
```

关于这两个函数的说明:
```
int setjmp(jmp_buf env)
    创建本地的jmp_buf缓冲区并且初始化，
    用于将来跳转回此处。这个子程序[1] 保存程序的调用环境于env参数所指的缓冲区，
    env将被longjmp使用。如果是从setjmp直接调用返回，
    setjmp返回值为0。如果是从longjmp恢复的程序调用环境返回，
    setjmp返回非零值。
void longjmp(jmp_buf env, int value)
    恢复env所指的缓冲区中的程序调用环境上下文，
    env所指缓冲区的内容是由setjmp子程序[1]调用所保存。
    value的值从longjmp传递给setjmp。
    longjmp完成后，程序从对应的setjmp调用处继续执行，
    如同setjmp调用刚刚完成。如果value传递给longjmp零值，
    setjmp的返回值为1；否则，setjmp的返回值为value。
```

swoole中协程的实现, 主要在
[swoole_coroutine.c](https://github.com/swoole/swoole-src/blob/master/swoole_coroutine.c)
文件中.

```
jmp_buf *swReactorCheckPoint = NULL;
```
即是jmp_buf缓冲区.


我们以下面的代码为例, 分析协程在swoole中的应用

首先编译php7,并启动调试模式.
然后编译swoole, 启用调试模式和协程.

```
swoole.php:
<?php

$server = new Swoole\Http\Server("0.0.0.0", 9502, SWOOLE_BASE);
$server->set([
    'worker_num' => 1,
]);

$server->on('Request', function ($request, $response) {
    $httpclient1 = new Swoole\Coroutine\Http\Client('127.0.0.1', 9503);
    $httpclient1->setHeaders(['Host' => "127.0.0.1"]);
    $httpclient1->set(['timeout' => 86400]);
    $httpclient1->setDefer();
    var_dump($httpclient1->get('/'));
    echo sprintf("httpclient1 recv %s %s\n", $httpclient1->recv(), $httpclient1->body);
    $response->end('hello');
});
$server->start();
```

使用gdb调试上面的代码
```
首先需要开启3个terminal,
terminal1: 使用gdb调试"php swoole.php"
terminal2: php -S 127.0.0.1:9503
terminal3: curl -i http://127.0.0.1:9502/
```

通过分析, 我们需要停在Request函数上, 那么gdb中我们在http_onReceive()函数处打一个断点.

```
代码在
https://github.com/swoole/swoole-src/blob/59c725db551453aee60440c98875a3ba4eb12abe/swoole_http_server.c:966
当执行curl后,
swoole执行事件循环,通过swServer_master_onAccept accept curl这个客户端连接,
然后curl发送数据给swoole, swoole事件循环接收到这个时间, 调用swReactorThread_onRead读取数据,
然后将数据传给 http_onReceive 函数,


http_onReceive 函数中创建coroutine.
zend_fcall_info_cache *cache = php_swoole_server_get_cache(serv, req->info.from_fd, callback_type);
(gdb)
1120	        int ret = coro_create(cache, args, 2, &retval, NULL, NULL);

```

创建协程的方法如下, 首先调用setjmp设置跳转点, 以便稍后回来.

然后进行执行zend\_execute\_ex(call), 即我们上面的Request的回调函数function(){$request, $response}


```
int sw_coro_create(zend_fcall_info_cache *fci_cache, zval **argv, int argc, zval *retval, void *post_callback, void* params)
{
    int coro_status;
    if (!setjmp(*swReactorCheckPoint))
    {
        zend_execute_ex(call);
        coro_close(TSRMLS_C);
        swTrace("Create the %d coro with stack. heap size: %zu\n", COROG.coro_num, zend_memory_usage(0));
        coro_status = CORO_END;
    }
    else
    {
        coro_status = CORO_YIELD;
    }
    COROG.require = 0;
    return coro_status;
}
```

在回调函数中一直执行到$httpclient1->recv()方法, 才会调用coro\_yield返回跳转点,

换句话就是说, function(){$request, $response} 回调执行到recv()就返回到http\_onReceive函数了,

但是返回之前通过coro\_save()保存了刚才执行的位置是recv()函数, 以便后面接着执行.

recv函数实现如下:

```
https://github.com/swoole/swoole-src/blob/2262414b371da2988884d5afea0f2b82253d2c9d/swoole_http_client_coro.c:1005
static PHP_METHOD(swoole_http_client_coro, recv)
{

    //todo
    http_client_property *hcc = swoole_get_property(getThis(), 0);

    if (!hcc->defer)
    {	//no defer
        swoole_php_fatal_error(E_WARNING, "you should not use recv without defer ");
        RETURN_FALSE;
    }


    switch (hcc->defer_status)
    {
        case HTTP_CLIENT_STATE_DEFER_DONE:
            hcc->defer_status = HTTP_CLIENT_STATE_DEFER_INIT;
            RETURN_BOOL(hcc->defer_result);
            break;
        case HTTP_CLIENT_STATE_DEFER_SEND:
            hcc->defer_status = HTTP_CLIENT_STATE_DEFER_WAIT;
            //not ready
            php_context *context = swoole_get_property(getThis(), 1);
            coro_save(context);
            coro_yield();
            break;
        case HTTP_CLIENT_STATE_DEFER_INIT:
            //not ready
            swoole_php_fatal_error(E_WARNING, "you should post or get or execute before recv  ");
            RETURN_FALSE;
            break;
        default:
            break;
    }
}

https://github.com/swoole/swoole-src/blob/master/swoole_coroutine.c:511
sw_inline void coro_yield()
{
    SWOOLE_GET_TSRMLS;
#if PHP_MAJOR_VERSION >= 7
    EG(vm_stack) = COROG.origin_vm_stack;
    EG(vm_stack_top) = COROG.origin_vm_stack_top;
    EG(vm_stack_end) = COROG.origin_vm_stack_end;
#else
    EG(argument_stack) = COROG.origin_vm_stack;
    EG(current_execute_data) = COROG.origin_ex;
#endif
    longjmp(*swReactorCheckPoint, 1);
}
```

然后接着时间循环, 这时httpclient发送给9503的数据可以写到缓冲区了, swoole调用swClient\_onWrite()
将数据发送给9503, 这时9503的控制台显示

```
[Thu Jul 13 21:28:00 2017] 127.0.0.1:51866 [200]: /
```

然后接着时间循环, 9503这次http请求返回http响应给我们了,
因此触发swoole的可读时间, 因此swoole调用swClient\_onStreamRead读取数据.


swClient\_onStreamRead函数实现如下:

```
https://github.com/swoole/swoole-src/blob/51e28bcf976a484b77c29c795b4d9a889bb98b17/src/network/Client.c:782
static int swClient_onStreamRead(swReactor *reactor, swEvent *event)
{
    cli->onReceive(cli, buf, n);
    // ...
}
```

其中这个cli->onReceive()即http\_client\_coro\_onReceive()函数.

其函数实现如下:

```
static void http_client_coro_onReceive(swClient *cli, char *data, uint32_t length)
{
    begin_resume:
    {
        //if should resume
        /*if next cr*/
        php_context *sw_current_context = swoole_get_property(zobject, 1);
        hcc->defer_status = HTTP_CLIENT_STATE_DEFER_INIT;
    //    hcc->defer_chunk_status = 0;
        http->completed = 0;

        int ret = coro_resume(sw_current_context, zdata, &retval);
        if (ret > 0)
        {
            goto free_zdata;
        }
        if (retval != NULL)
        {
            sw_zval_ptr_dtor(&retval);
        }
    }

    free_zdata:
    sw_zval_ptr_dtor(&zdata);
}
```

中前调用coro\_resume()

在zend\_execute\_ex(EG(current\_execute\_data) TSRMLS_CC)处

恢复到刚才recv()的调用,

并紧接着打印出"httpclient1 recv 1 world"字符串, 其中"world"即9503的返回值,

到这里function(){$request, $response}回调函数中执行

$response->end('hello')后结束.

```
int sw_coro_resume(php_context *sw_current_context, zval *retval, zval *coro_retval)
{
    EG(vm_stack) = SWCC(current_vm_stack);
    EG(vm_stack_top) = SWCC(current_vm_stack_top);
    EG(vm_stack_end) = SWCC(current_vm_stack_end);

    zend_execute_data *current = SWCC(current_execute_data);
    if (ZEND_CALL_INFO(current) & ZEND_CALL_RELEASE_THIS)
    {
        zval_ptr_dtor(&(current->This));
    }
    zend_vm_stack_free_args(current);
    zend_vm_stack_free_call_frame(current);

    EG(current_execute_data) = current->prev_execute_data;
    COROG.current_coro = SWCC(current_task);
    COROG.require = 1;
#if PHP_MINOR_VERSION < 1
    EG(scope) = EG(current_execute_data)->func->op_array.scope;
#endif
    COROG.allocated_return_value_ptr = SWCC(allocated_return_value_ptr);
    if ( EG(current_execute_data)->opline->result_type != IS_UNUSED)
    {
        ZVAL_COPY(SWCC(current_coro_return_value_ptr), retval);
    }
    EG(current_execute_data)->opline++;

    int coro_status;
    if (!setjmp(*swReactorCheckPoint))
    {
        //coro exit
        zend_execute_ex(EG(current_execute_data) TSRMLS_CC);
        coro_close(TSRMLS_C);
        coro_status = CORO_END;
    }
    else
    {
        //coro yield
        coro_status = CORO_YIELD;
    }
    COROG.require = 0;

    if (unlikely(coro_status == CORO_END && EG(exception)))
    {
        sw_zval_ptr_dtor(&retval);
        zend_exception_error(EG(exception), E_ERROR TSRMLS_CC);
    }
    return coro_status;
}
```

结束回调函数之后, swoole继续进行事件循环, 等待新的事件到来.


### 总结

本篇文章开始介绍了大部分php协程函数细节的地方, 然后使用gdb分析了swoole协程实现的细节.

但是php中的协程用起来并没有想象中的那么顺手, 使用场景也不能立即想出来,

后续会通过跟golang协程对比, 用php来实现一些golang常用的特性.
