## PHP的PDO-commit函数在tidb上返回值错误的分析

问题是这样的, tidb使用乐观型事务, 在事务提交的一瞬间才进行冲突监测,

但是在PDO的commit()函数上就发生了诡异的事情, 失败提交失败了,

commit()函数返回成功且没有抛出异常.

经过两天的努力, 终于发现了问题所在, 虽然...



目录:

1. 测试脚本
2. 正确执行结果协议分析
3. 错误执行结果协议分析
4. 通过mysqlnd调试信息修复bug
5. 再次通过xhprof修复bug
6. 再再次通过mysqlnd调试信息修复bug


### 测试脚本

测试脚本的思路是这样的:

首先创建一张表, 里面有个库存字段, 然后同时发起10个并发请求,

对该字段进行减库存操作, 同时新增一条纪录.

按照理论分析, 应该只有一个请求成功把库存减成0, 并新增了一条纪录.

tidb的最终结果也是这样的, 但是

PDO的commit()在10个并发上都返回成功了,

导致我们认为10次库存都减成功了, 这会给我们的后续判断带来误导.

```
test.php
<?php

// Copy from laravel
$options = $options = [
    PDO::ATTR_CASE => PDO::CASE_NATURAL,
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_ORACLE_NULLS => PDO::NULL_NATURAL,
    PDO::ATTR_STRINGIFY_FETCHES => false,
    PDO::ATTR_EMULATE_PREPARES => true,
];

$pdo = new PDO('mysql:host=192.168.12.254;port=4000;dbname=test', 'root', '', $options);
// $pdo = new PDO('mysql:host=127.0.0.1;dbname=test', 'root', '', $options);

// Test table
// create table test (id bigint(20) auto_increment primary key, stock int(10) unsigned not null default 0);

// First
// insert into test(id, stock) values(1, 10);
// or update test set stock = 10 where id = 1;


// Second, decrement stock and insert a value
$ret = $pdo->beginTransaction();
file_log(sprintf('begin ret %s', $ret));
if ($ret) {
    try {
        $ret = $pdo->exec('update test set stock = stock - 10 where id = 1');
        if (!$ret) {
            throw new \Exception('update stock failed');
        }
        $ret = $pdo->exec(sprintf('insert into test(stock) values(%d)', rand(0, 9999)));
        if (!$ret) {
            throw new Exception('insert failed');
        }
        $id = $pdo->lastInsertId();
        file_log(sprintf('last insertId %d', $id));
        $ret = $pdo->commit();
        file_log(sprintf('commit ret %d', $ret));
        $res = $pdo->query(sprintf('select * from test where id = %d', $id));
        $row = $res->fetch(PDO::FETCH_ASSOC);
        file_log(sprintf('inserted data %s', json_encode($row)));
    } catch (Exception $e) {
        $ret = $pdo->rollBack();
        file_log(sprintf('rollback %d exception %s', $ret, $e->getTraceAsString()));
    } catch (Throwable $e) {
        $ret = $pdo->rollBack();
        file_log(sprintf('rollback %d exception %s', $ret, $e->getTraceAsString()));
    }
}

// Third, one terminal 'php -S 127.0.0.1:9093'
//        another terminal 'ab -c 10 -n 10 http://127.0.0.1:9093/bug_test.php'

function file_log($msg)
{
    static $rId = null;
    if (is_null($rId)) {
        $rId = uniqid();
    }
    file_put_contents(__DIR__ . '/test.log', sprintf("%s %s\n", $rId, $msg), FILE_APPEND);
}
```




### 正确执行结果协议分析

我们首先使用tcpdump在本地监听tidb的4000端口, 然后执行"php test.php", 对tidb发起一次正确的请求.

然后使用wireshark分析抓取到的数据.

MYSQL协议的分析文档:
[PAGE_PROTOCOL](https://dev.mysql.com/doc/dev/mysql-server/latest/PAGE_PROTOCOL.html)
[MySQL协议分析](http://forthxu.com/blog/usr/uploads/2014/06/2427908770.pdf)

```
监听4000端口:
# tcpdump port 4000 -s 0 -w 4000.pacp
安装wireshark
$ brew install wireshark --with-qt
把4000.pacp导入wireshark, 分析mysql协议.
```

我们重点分析COMMIT包:

```
请求包:
080000 00 03 434f4d4d495420
```

0-2字节代表payload为8个字节, 3字节是序列号0,

4字节代表命名类型, 3为query命令的值, 后面跟上命令内容,

当前为"COMMIT ".


```
响应包:
070000 01 00 00 00 0200 0000
```

0-2字节代表payload有7字节, 01为序列号,

4字节代表响应类型, 0x00为正确响应,

5字节00代表影响行数, 6字节00代表自增ID,

7-8字节2代表"SERVER\_STATUS\_AUTOCOMMIT"开启,

9-10字节00代表没有warnings.




### 错误执行结果协议分析

首先还是用tcpdump监听4000端口, 然后使用"ab -c 10 -n 10 http://xxx.com/test.php"

发起10个并发请求.


```
# tcpdump port 4000 -s 0 -w 4000_2.pacp
```

抓好包后同样导入wireshark进行分析,

使用

```
frame.len == 78
```

进行过滤, 结果出来10个结果, 查看内容后同上面的COMMIT包完全一致.

这里记下它们的序号, 方便纪录各自的响应.

```
80 98 110 120 130 132 136 177 189 196
```

然后纪录10次COMMIT请求的响应,

```
使用 ﻿tcp.srcport == 47640 or tcp.dstport == 47640 过滤端口
响应80: ﻿0700000100000002000000

响应98:  3b000001ff9a06233232303033424947494e5420554e5349...
响应100: 3b000001ff9a06233232303033424947494e5420554e5349...
响应120: 3b000001ff9a06233232303033424947494e5420554e5349...

3b0000 01 ff 9a06 23 3232303033 424947494e5420554e5349...
依次代表:
内容有59字节
序列号0x01
错误响应0xff
23是符号"#"
错误状态22003
错误信息"BIGINT UNSIGNED value is out range in '(0, 10)'"
```

响应80的包, 跟上面正确的一致,

剩下的包都返回超出限制

下面是脚本纪录的日志:

```
5968bf2e9d38b begin ret 1
5968bf2e9d38b last insertId 15014
5968bf2e9e07b begin ret 1
5968bf2e9ea59 begin ret 1
5968bf2e9eaae begin ret 1
5968bf2e9e07b last insertId 15015
5968bf2e9f0bb begin ret 1
5968bf2e9f22a begin ret 1
5968bf2e9f437 begin ret 1
5968bf2e9ea59 last insertId 15016
5968bf2e9fe35 begin ret 1
5968bf2e9f437 last insertId 15017
5968bf2e9f22a last insertId 15018
5968bf2e9f0bb last insertId 15019
5968bf2ea09e8 begin ret 1
5968bf2e9eaae last insertId 15020
5968bf2ea0b79 begin ret 1
5968bf2e9d38b commit ret 1
5968bf2e9eaae commit ret 1
5968bf2e9f0bb commit ret 1
5968bf2e9f22a commit ret 1
5968bf2e9d38b inserted data {"id":"15014","stock":"288"}
5968bf2e9f22a inserted data false
5968bf2e9f0bb inserted data false
5968bf2e9eaae inserted data false
5968bf2ea09e8 last insertId 15021
5968bf2ea09e8 commit ret 1
5968bf2ea09e8 inserted data false
5968bf2e9fe35 last insertId 15022
5968bf2e9fe35 commit ret 1
5968bf2ea0b79 last insertId 15023
5968bf2e9fe35 inserted data false
5968bf2ea0b79 commit ret 1
5968bf2ea0b79 inserted data false
5968bf2e9ea59 commit ret 1
5968bf2e9ea59 inserted data false
5968bf2e9e07b commit ret 1
5968bf2e9e07b inserted data false
5968bf2e9f437 commit ret 1
5968bf2e9f437 inserted data false
```

可以看出commit()函数都返回了1, 从而可以判断是PDO处理错误了.

测试用的PHP版本是ubuntu上的5.6.30,

而编译了一个7.0.16版本的PHP7, 同样有这个问题.

其输出如下:
```
59699b53bfea5 begin ret 1
59699b53c0480 begin ret 1
59699b53bfea5 last insertId 6
59699b53c0480 last insertId 7
59699b53bfea5 commit ret 1
59699b53bfea5 inserted data {"id":6,"stock":6824}
59699b53c42a2 begin ret 1
59699b53c42a2 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
59699b53c5bab begin ret 1
59699b53c5bab rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
59699b53c7817 begin ret 1
59699b53c7817 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
59699b53c98a4 begin ret 1
59699b53c98a4 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
59699b53cbe88 begin ret 1
59699b53cbe88 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
59699b53ce030 begin ret 1
59699b53ce030 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
59699b53d02c6 begin ret 1
59699b53d02c6 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
59699b53d214e begin ret 1
59699b53d214e rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
59699b53c0480 commit ret 1
59699b53c0480 inserted data false
```


### 通过mysqlnd调试信息修复bug

通过gdb单步调试, 基本理清php与mysql的交互流程,

第一个思路是首先纪录php从mysql处读取的数据是否正确.

其从网络读取数据的代码如下:

```
static enum_func_status
MYSQLND_METHOD(mysqlnd_net, network_read_ex)(MYSQLND_NET * const net, zend_uchar * const buffer, const size_t count,
                                             MYSQLND_STATS * const stats, MYSQLND_ERROR_INFO * const error_info)
{
    enum_func_status return_value = PASS;
    php_stream * net_stream = net->data->m.get_stream(net);
    size_t old_chunk_size = net_stream->chunk_size;
    size_t to_read = count, ret;
    zend_uchar * p = buffer;

    DBG_ENTER("mysqlnd_net::network_read_ex");
    DBG_INF_FMT("count="MYSQLND_SZ_T_SPEC, count);

    net_stream->chunk_size = MIN(to_read, net->data->options.net_read_buffer_size);
    while (to_read) {
        if (!(ret = php_stream_read(net_stream, (char *) p, to_read))) {
            DBG_ERR_FMT("Error while reading header from socket");
            return_value = FAIL;
            break;
        }
        p += ret;
        to_read -= ret;
    }
    MYSQLND_INC_CONN_STATISTIC_W_VALUE(stats, STAT_BYTES_RECEIVED, count - to_read);
    net_stream->chunk_size = old_chunk_size;
    DBG_RETURN(return_value);
}
```

为了方便查看, 我们将数据转换成16进制的字符串, 其函数如下:

```
#include <stdio.h>

void tohex(unsigned char * in, size_t insz, char * out, size_t outsz)
{
    unsigned char * pin = in;
    const char * hex = "0123456789ABCDEF";
    char * pout = out;
    for(; pin < in+insz; pout +=3, pin++){
        pout[0] = hex[(*pin>>4) & 0xF];
        pout[1] = hex[ *pin     & 0xF];
        pout[2] = ':';
        if (pout + 3 - out > outsz){
            /* Better to truncate output string than overflow buffer */
            /* it would be still better to either return a status */
            /* or ensure the target buffer is large enough and it never happen */
            break;
        }
    }
    pout[-1] = 0;
}

```

写入日志的函数如下:
```
#include <syslog.h>
syslog(LOG_DEBUG, "test info");
```

在mysqlnd_net.c添加如下代码:
```
    const int len = count * 3;
    char debug_str[len];
    tohex(buffer, count, debug_str, len);
    syslog(LOG_DEBUG, debug_str);
    syslog(LOG_DEBUG, buffer);

    MYSQLND_INC_CONN_STATISTIC_W_VALUE(stats, STAT_BYTES_RECEIVED, count - to_read);
    net_stream->chunk_size = old_chunk_size;
    DBG_RETURN(return_value);
```

最后编译php
```
# ./configure --enable-debug --enable-fpm --with-mysqli=mysqlnd --with-pdo-mysql=mysqlnd --prefix=/home/liuyong/php7016d
# make && make install
```

启动php-fpm配置nginx然后接着测试我们的脚本,

使用ab发起10个并发请求.

这次php脚本输出同样有问题, syslog也打印了响应的日志:

```
5969ae91c79bc begin ret 1
5969ae91c812b begin ret 1
5969ae91c79bc last insertId 8
5969ae91c812b last insertId 9
5969ae91c79bc commit ret 1
5969ae91c79bc inserted data {"id":8,"stock":9983}
5969ae91cc21d begin ret 1
5969ae91cc21d rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969ae91ce327 begin ret 1
5969ae91ce327 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969ae91d0040 begin ret 1
5969ae91d0040 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969ae91d1b0a begin ret 1
5969ae91d1b0a rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969ae91d35f3 begin ret 1
5969ae91d35f3 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969ae91d5018 begin ret 1
5969ae91d5018 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969ae91d6851 begin ret 1
5969ae91d6851 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969ae91d8326 begin ret 1
5969ae91d8326 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969ae91c812b commit ret 1
5969ae91c812b inserted data false
```

syslog
```
Jul 15 14:40:52 dev : pool www: 3C:00:00:00
Jul 15 14:40:52 dev : pool www: <
Jul 15 14:40:52 dev : pool www: 0A:35:2E:37:2E:31:2D:54:69:44:42:2D:31:2E:30:00:EA:5B:04:00:58:40:7C:5B:4F:05:59:3C:00:8F:A2:53:02:00:13:00:15:00:00:00:00:00:00:00:00:00:00:62:10:58:51:25:73:72:6E:26:78:3A:10:00
Jul 15 14:40:52 dev : pool www: #0125.7.1-TiDB-1.0
Jul 15 14:40:52 dev : pool www: 3C:00:00:00
Jul 15 14:40:52 dev : pool www: <
Jul 15 14:40:52 dev : pool www: 0A:35:2E:37:2E:31:2D:54:69:44:42:2D:31:2E:30:00:EB:5B:04:00:0C:12:2F:7A:79:52:69:35:00:8F:A2:53:02:00:13:00:15:00:00:00:00:00:00:00:00:00:00:12:01:54:65:31:43:3E:3F:5A:49:3E:30:00
Jul 15 14:40:52 dev : pool www: #0125.7.1-TiDB-1.0
Jul 15 14:40:52 dev : pool www: 07:00:00:02
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:02
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:01:00:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:01:00:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:01:0A:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:01:0B:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 0C:00:00:01
Jul 15 14:40:52 dev : pool www: #014
Jul 15 14:40:52 dev : pool www: 00:01:00:00:00:02:00:00:00:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 20:00:00:02
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 03:64:65:66:04:74:65:73:74:00:04:74:65:73:74:00:02:69:64:0C:3F:00:14:00:00:00:08:83:02:00:00:00
Jul 15 14:40:52 dev : pool www: #003def#004test
Jul 15 14:40:52 dev : pool www: 23:00:00:03
Jul 15 14:40:52 dev : pool www: #
Jul 15 14:40:52 dev : pool www: 03:64:65:66:04:74:65:73:74:00:04:74:65:73:74:00:05:73:74:6F:63:6B:0C:3F:00:0A:00:00:00:03:A1:00:00:00:00
Jul 15 14:40:52 dev : pool www: #003def#004test
Jul 15 14:40:52 dev : pool www: 05:00:00:04
Jul 15 14:40:52 dev : pool www: #005
Jul 15 14:40:52 dev : pool www: FE:00:00:02:00
Jul 15 14:40:52 dev : pool www: �
Jul 15 14:40:52 dev : pool www: 01:00:00:01
Jul 15 14:40:52 dev : pool www: #001
Jul 15 14:40:52 dev : pool www: 02
Jul 15 14:40:52 dev : pool www: #002
Jul 15 14:40:52 dev : pool www: 1E:00:00:02
Jul 15 14:40:52 dev : pool www: #036
Jul 15 14:40:52 dev : pool www: 03:64:65:66:00:04:74:65:73:74:00:02:69:64:02:69:64:0C:3F:00:14:00:00:00:08:83:02:00:00:00
Jul 15 14:40:52 dev : pool www: #003def
Jul 15 14:40:52 dev : pool www: 24:00:00:03
Jul 15 14:40:52 dev : pool www: $
Jul 15 14:40:52 dev : pool www: 03:64:65:66:00:04:74:65:73:74:00:05:73:74:6F:63:6B:05:73:74:6F:63:6B:0C:3F:00:0A:00:00:00:03:A1:00:00:00:00
Jul 15 14:40:52 dev : pool www: #003def
Jul 15 14:40:52 dev : pool www: 05:00:00:04
Jul 15 14:40:52 dev : pool www: #005
Jul 15 14:40:52 dev : pool www: FE:00:00:02:00
Jul 15 14:40:52 dev : pool www: �
Jul 15 14:40:52 dev : pool www: 0E:00:00:05
Jul 15 14:40:52 dev : pool www: #016
Jul 15 14:40:52 dev : pool www: 00:00:0B:00:00:00:00:00:00:00:FC:04:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 05:00:00:06
Jul 15 14:40:52 dev : pool www: #005
Jul 15 14:40:52 dev : pool www: FE:00:00:02:00
Jul 15 14:40:52 dev : pool www: �
Jul 15 14:40:52 dev : pool www: 3C:00:00:00
Jul 15 14:40:52 dev : pool www: <
Jul 15 14:40:52 dev : pool www: 0A:35:2E:37:2E:31:2D:54:69:44:42:2D:31:2E:30:00:EC:5B:04:00:3E:55:4F:1E:65:39:44:4A:00:8F:A2:53:02:00:13:00:15:00:00:00:00:00:00:00:00:00:00:1D:08:56:68:49:2D:78:67:70:73:1A:7C:00
Jul 15 14:40:52 dev : pool www: #0125.7.1-TiDB-1.0
Jul 15 14:40:52 dev : pool www: 07:00:00:02
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3B:00:00:01
Jul 15 14:40:52 dev : pool www: ;
Jul 15 14:40:52 dev : pool www: FF:9A:06:23:32:32:30:30:33:42:49:47:49:4E:54:20:55:4E:53:49:47:4E:45:44:20:76:61:6C:75:65:20:69:73:20:6F:75:74:20:6F:66:20:72:61:6E:67:65:20:69:6E:20:27:28:30:2C:20:31:30:29:27
Jul 15 14:40:52 dev : pool www: ��#006#22003BIGINT UNSIGNED value is out of range in '(0, 10)'s�
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3C:00:00:00
Jul 15 14:40:52 dev : pool www: <
Jul 15 14:40:52 dev : pool www: 0A:35:2E:37:2E:31:2D:54:69:44:42:2D:31:2E:30:00:ED:5B:04:00:08:0D:18:01:67:3D:43:78:00:8F:A2:53:02:00:13:00:15:00:00:00:00:00:00:00:00:00:00:5E:66:2F:2F:79:41:63:55:5C:79:4E:64:00
Jul 15 14:40:52 dev : pool www: #0125.7.1-TiDB-1.0
Jul 15 14:40:52 dev : pool www: 07:00:00:02
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3B:00:00:01
Jul 15 14:40:52 dev : pool www: ;
Jul 15 14:40:52 dev : pool www: FF:9A:06:23:32:32:30:30:33:42:49:47:49:4E:54:20:55:4E:53:49:47:4E:45:44:20:76:61:6C:75:65:20:69:73:20:6F:75:74:20:6F:66:20:72:61:6E:67:65:20:69:6E:20:27:28:30:2C:20:31:30:29:27
Jul 15 14:40:52 dev : pool www: ��#006#22003BIGINT UNSIGNED value is out of range in '(0, 10)'s�
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3C:00:00:00
Jul 15 14:40:52 dev : pool www: <
Jul 15 14:40:52 dev : pool www: 0A:35:2E:37:2E:31:2D:54:69:44:42:2D:31:2E:30:00:EE:5B:04:00:71:7A:01:2E:54:4F:33:21:00:8F:A2:53:02:00:13:00:15:00:00:00:00:00:00:00:00:00:00:65:1F:28:61:5F:63:05:6E:60:0B:6B:0B:00
Jul 15 14:40:52 dev : pool www: #0125.7.1-TiDB-1.0
Jul 15 14:40:52 dev : pool www: 07:00:00:02
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3B:00:00:01
Jul 15 14:40:52 dev : pool www: ;
Jul 15 14:40:52 dev : pool www: FF:9A:06:23:32:32:30:30:33:42:49:47:49:4E:54:20:55:4E:53:49:47:4E:45:44:20:76:61:6C:75:65:20:69:73:20:6F:75:74:20:6F:66:20:72:61:6E:67:65:20:69:6E:20:27:28:30:2C:20:31:30:29:27
Jul 15 14:40:52 dev : pool www: ��#006#22003BIGINT UNSIGNED value is out of range in '(0, 10)'s�
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3C:00:00:00
Jul 15 14:40:52 dev : pool www: <
Jul 15 14:40:52 dev : pool www: 0A:35:2E:37:2E:31:2D:54:69:44:42:2D:31:2E:30:00:EF:5B:04:00:60:5F:61:66:69:01:4F:38:00:8F:A2:53:02:00:13:00:15:00:00:00:00:00:00:00:00:00:00:09:01:05:6F:25:48:2D:4B:04:33:05:0B:00
Jul 15 14:40:52 dev : pool www: #0125.7.1-TiDB-1.0
Jul 15 14:40:52 dev : pool www: 07:00:00:02
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3B:00:00:01
Jul 15 14:40:52 dev : pool www: ;
Jul 15 14:40:52 dev : pool www: FF:9A:06:23:32:32:30:30:33:42:49:47:49:4E:54:20:55:4E:53:49:47:4E:45:44:20:76:61:6C:75:65:20:69:73:20:6F:75:74:20:6F:66:20:72:61:6E:67:65:20:69:6E:20:27:28:30:2C:20:31:30:29:27
Jul 15 14:40:52 dev : pool www: ��#006#22003BIGINT UNSIGNED value is out of range in '(0, 10)'s�
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3C:00:00:00
Jul 15 14:40:52 dev : pool www: <
Jul 15 14:40:52 dev : pool www: 0A:35:2E:37:2E:31:2D:54:69:44:42:2D:31:2E:30:00:F0:5B:04:00:34:5F:13:42:1B:42:42:75:00:8F:A2:53:02:00:13:00:15:00:00:00:00:00:00:00:00:00:00:17:7C:68:6D:64:0F:19:58:67:19:6D:63:00
Jul 15 14:40:52 dev : pool www: #0125.7.1-TiDB-1.0
Jul 15 14:40:52 dev : pool www: 07:00:00:02
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3B:00:00:01
Jul 15 14:40:52 dev : pool www: ;
Jul 15 14:40:52 dev : pool www: FF:9A:06:23:32:32:30:30:33:42:49:47:49:4E:54:20:55:4E:53:49:47:4E:45:44:20:76:61:6C:75:65:20:69:73:20:6F:75:74:20:6F:66:20:72:61:6E:67:65:20:69:6E:20:27:28:30:2C:20:31:30:29:27
Jul 15 14:40:52 dev : pool www: ��#006#22003BIGINT UNSIGNED value is out of range in '(0, 10)'s�
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3C:00:00:00
Jul 15 14:40:52 dev : pool www: <
Jul 15 14:40:52 dev : pool www: 0A:35:2E:37:2E:31:2D:54:69:44:42:2D:31:2E:30:00:F1:5B:04:00:53:03:1B:55:52:53:51:72:00:8F:A2:53:02:00:13:00:15:00:00:00:00:00:00:00:00:00:00:57:14:6B:70:0D:1D:61:2B:7D:6F:46:05:00
Jul 15 14:40:52 dev : pool www: #0125.7.1-TiDB-1.0
Jul 15 14:40:52 dev : pool www: 07:00:00:02
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 07:00:00:01
Jul 15 14:40:52 dev : pool www: #007
Jul 15 14:40:52 dev : pool www: 00:00:00:03:00:00:00
Jul 15 14:40:52 dev : pool www:
Jul 15 14:40:52 dev : pool www: 3B:00:00:01
Jul 15 14:40:52 dev : pool www: ;
Jul 15 14:40:53 dev : pool www: FF:9A:06:23:32:32:30:30:33:42:49:47:49:4E:54:20:55:4E:53:49:47:4E:45:44:20:76:61:6C:75:65:20:69:73:20:6F:75:74:20:6F:66:20:72:61:6E:67:65:20:69:6E:20:27:28:30:2C:20:31:30:29:27
Jul 15 14:40:53 dev : pool www: ��#006#22003BIGINT UNSIGNED value is out of range in '(0, 10)'s�
Jul 15 14:40:53 dev : pool www: 07:00:00:01
Jul 15 14:40:53 dev : pool www: #007
Jul 15 14:40:53 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:53 dev : pool www:
Jul 15 14:40:53 dev : pool www: 3C:00:00:00
Jul 15 14:40:53 dev : pool www: <
Jul 15 14:40:53 dev : pool www: 0A:35:2E:37:2E:31:2D:54:69:44:42:2D:31:2E:30:00:F2:5B:04:00:03:44:51:62:69:29:18:59:00:8F:A2:53:02:00:13:00:15:00:00:00:00:00:00:00:00:00:00:68:13:79:22:6C:77:43:3D:3D:04:22:29:00
Jul 15 14:40:53 dev : pool www: #0125.7.1-TiDB-1.0
Jul 15 14:40:53 dev : pool www: 07:00:00:02
Jul 15 14:40:53 dev : pool www: #007
Jul 15 14:40:53 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:53 dev : pool www:
Jul 15 14:40:53 dev : pool www: 07:00:00:01
Jul 15 14:40:53 dev : pool www: #007
Jul 15 14:40:53 dev : pool www: 00:00:00:03:00:00:00
Jul 15 14:40:53 dev : pool www:
Jul 15 14:40:53 dev : pool www: 3B:00:00:01
Jul 15 14:40:53 dev : pool www: ;
Jul 15 14:40:53 dev : pool www: FF:9A:06:23:32:32:30:30:33:42:49:47:49:4E:54:20:55:4E:53:49:47:4E:45:44:20:76:61:6C:75:65:20:69:73:20:6F:75:74:20:6F:66:20:72:61:6E:67:65:20:69:6E:20:27:28:30:2C:20:31:30:29:27
Jul 15 14:40:53 dev : pool www: ��#006#22003BIGINT UNSIGNED value is out of range in '(0, 10)'s�
Jul 15 14:40:53 dev : pool www: 07:00:00:01
Jul 15 14:40:53 dev : pool www: #007
Jul 15 14:40:53 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:53 dev : pool www:
Jul 15 14:40:53 dev : pool www: 3C:00:00:00
Jul 15 14:40:53 dev : pool www: <
Jul 15 14:40:53 dev : pool www: 0A:35:2E:37:2E:31:2D:54:69:44:42:2D:31:2E:30:00:F3:5B:04:00:3B:21:3E:76:0B:35:32:21:00:8F:A2:53:02:00:13:00:15:00:00:00:00:00:00:00:00:00:00:23:66:41:42:23:2A:7B:70:2F:0E:5A:17:00
Jul 15 14:40:53 dev : pool www: #0125.7.1-TiDB-1.0
Jul 15 14:40:53 dev : pool www: 07:00:00:02
Jul 15 14:40:53 dev : pool www: #007
Jul 15 14:40:53 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:53 dev : pool www:
Jul 15 14:40:53 dev : pool www: 07:00:00:01
Jul 15 14:40:53 dev : pool www: #007
Jul 15 14:40:53 dev : pool www: 00:00:00:03:00:00:00
Jul 15 14:40:53 dev : pool www:
Jul 15 14:40:53 dev : pool www: 3B:00:00:01
Jul 15 14:40:53 dev : pool www: ;
Jul 15 14:40:53 dev : pool www: FF:9A:06:23:32:32:30:30:33:42:49:47:49:4E:54:20:55:4E:53:49:47:4E:45:44:20:76:61:6C:75:65:20:69:73:20:6F:75:74:20:6F:66:20:72:61:6E:67:65:20:69:6E:20:27:28:30:2C:20:31:30:29:27
Jul 15 14:40:53 dev : pool www: ��#006#22003BIGINT UNSIGNED value is out of range in '(0, 10)'s�
Jul 15 14:40:53 dev : pool www: 07:00:00:01
Jul 15 14:40:53 dev : pool www: #007
Jul 15 14:40:53 dev : pool www: 00:00:00:02:00:00:00
Jul 15 14:40:53 dev : pool www:
Jul 15 14:40:53 dev : pool www: 3B:00:00:01
Jul 15 14:40:53 dev : pool www: ;
Jul 15 14:40:53 dev : pool www: FF:9A:06:23:32:32:30:30:33:42:49:47:49:4E:54:20:55:4E:53:49:47:4E:45:44:20:76:61:6C:75:65:20:69:73:20:6F:75:74:20:6F:66:20:72:61:6E:67:65:20:69:6E:20:27:28:30:2C:20:31:30:29:27
Jul 15 14:40:53 dev : pool www: ��#006#22003BIGINT UNSIGNED value is out of range in '(0, 10)'
Jul 15 14:40:53 dev : pool www: 0C:00:00:01
Jul 15 14:40:53 dev : pool www: #014
Jul 15 14:40:53 dev : pool www: 00:01:00:00:00:02:00:00:00:00:00:00
Jul 15 14:40:53 dev : pool www:
Jul 15 14:40:53 dev : pool www: 20:00:00:02
Jul 15 14:40:53 dev : pool www:
Jul 15 14:40:53 dev : pool www: 03:64:65:66:04:74:65:73:74:00:04:74:65:73:74:00:02:69:64:0C:3F:00:14:00:00:00:08:83:02:00:00:00
Jul 15 14:40:53 dev : pool www: #003def#004test
Jul 15 14:40:53 dev : pool www: 23:00:00:03
Jul 15 14:40:53 dev : pool www: #
Jul 15 14:40:53 dev : pool www: 03:64:65:66:04:74:65:73:74:00:04:74:65:73:74:00:05:73:74:6F:63:6B:0C:3F:00:0A:00:00:00:03:A1:00:00:00:00
Jul 15 14:40:53 dev : pool www: #003def#004test
Jul 15 14:40:53 dev : pool www: 05:00:00:04
Jul 15 14:40:53 dev : pool www: #005
Jul 15 14:40:53 dev : pool www: FE:00:00:02:00
Jul 15 14:40:53 dev : pool www: �
Jul 15 14:40:53 dev : pool www: 01:00:00:01
Jul 15 14:40:53 dev : pool www: #001
Jul 15 14:40:53 dev : pool www: 02
Jul 15 14:40:53 dev : pool www: #002
Jul 15 14:40:53 dev : pool www: 1E:00:00:02
Jul 15 14:40:53 dev : pool www: #036
Jul 15 14:40:53 dev : pool www: 03:64:65:66:00:04:74:65:73:74:00:02:69:64:02:69:64:0C:3F:00:14:00:00:00:08:83:02:00:00:00
Jul 15 14:40:53 dev : pool www: #003def
Jul 15 14:40:53 dev : pool www: 24:00:00:03
Jul 15 14:40:53 dev : pool www: $
Jul 15 14:40:53 dev : pool www: 03:64:65:66:00:04:74:65:73:74:00:05:73:74:6F:63:6B:05:73:74:6F:63:6B:0C:3F:00:0A:00:00:00:03:A1:00:00:00:00
Jul 15 14:40:53 dev : pool www: #003def
Jul 15 14:40:53 dev : pool www: 05:00:00:04
Jul 15 14:40:53 dev : pool www: #005
Jul 15 14:40:53 dev : pool www: FE:00:00:02:00
Jul 15 14:40:53 dev : pool www: �
Jul 15 14:40:53 dev : pool www: 05:00:00:05
Jul 15 14:40:53 dev : pool www: #005
Jul 15 14:40:53 dev : pool www: FE:00:00:02:00
Jul 15 14:40:53 dev : pool www: �
```

通过上面的日志内容, 看出10个请求有9个报错, 可以判断出pdo至少在接收数据上没有出错.

下面我们开启mysqlnd的调试日志, 重新纪录一次请求日志:

打开日志纪录:
```
mysqlnd.debug = 1
mysqlnd.log_mask = 0
```

其日志输出为:
```
// note: update 时删除
日志大概有1400行, 因为并没有发现什么重要的东西, 因此省略掉了.
不过通过git的提交日志, 还可以看到的.
```

对应的测试脚本输出:
```
5969c2f3187b1 begin ret 1
5969c2f3188bc begin ret 1
5969c2f3188bc last insertId 12
5969c2f3187b1 last insertId 13
5969c2f3188bc commit ret 1
5969c2f3188bc inserted data {"id":12,"stock":5312}
5969c2f31ec26 begin ret 1
5969c2f31ec26 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969c2f321f4f begin ret 1
5969c2f321f4f rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969c2f3242ce begin ret 1
5969c2f3242ce rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969c2f3267a8 begin ret 1
5969c2f3267a8 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969c2f328cbd begin ret 1
5969c2f328cbd rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969c2f32b1e7 begin ret 1
5969c2f32b1e7 rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969c2f32d5fd begin ret 1
5969c2f32d5fd rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969c2f32fabc begin ret 1
5969c2f32fabc rollback 1 exception #0 /data/test/bug_test.php(24): PDO->exec('update test set...')
#1 {main}
5969c2f3187b1 commit ret 1
5969c2f3187b1 inserted data false
```

观察了半天也没发现上面日志有什么不对的地方.

### 再次通过xhprof修复bug

昨天通过mysqlnd的trace日志, 并没有看出任何异常的地方,

这次我们使用xhprof跟踪函数的执行流程, 来诊断究竟是哪个函数没有正确处理数据.


安装好xhprof后, 我们首先修改脚本, 将xhprof日志文件名跟我们的脚本输出对应起来.

```
<?php
// Copy from laravel
$options = $options = [
    PDO::ATTR_CASE => PDO::CASE_NATURAL,
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_ORACLE_NULLS => PDO::NULL_NATURAL,
    PDO::ATTR_STRINGIFY_FETCHES => false,
    PDO::ATTR_EMULATE_PREPARES => false,
];
$pdo = new PDO('mysql:host=10.80.90.30;port=4000;dbname=test', 'root', '', $options);
//$pdo = new PDO('mysql:host=127.0.0.1;dbname=test', 'root', 'being2015', $options);
// Test table
// create table test (id bigint(20) auto_increment primary key, stock int(10) unsigned not null default 0);
// First
// insert into test(id, stock) values(1, 10);
// or update test set stock = 10 where id = 1;
// Second, decrement stock and insert a value

global $rid;
$rid = uniqid();

xhprof_enable();

$ret = $pdo->beginTransaction();
file_log(sprintf('begin ret %s', $ret));
if ($ret) {
    try {
        $ret = $pdo->exec('update test set stock = stock - 10 where id = 1');
        if (!$ret) {
            throw new \Exception('update stock failed');
        }
        $ret = $pdo->exec(sprintf('insert into test(stock) values(%d)', rand(0, 9999)));
        if (!$ret) {
            throw new Exception('insert failed');
        }
        $id = $pdo->lastInsertId();
        file_log(sprintf('last insertId %d', $id));
        $ret = $pdo->commit();
        file_log(sprintf('commit ret %d', $ret));
        $res = $pdo->query(sprintf('select * from test where id = %d', $id));
        $row = $res->fetch(PDO::FETCH_ASSOC);
        file_log(sprintf('inserted data %s', json_encode($row)));
    } catch (Exception $e) {
        $ret = -1;//$pdo->rollBack();
        file_log(sprintf('rollback %d exception %s', $ret, $e->getTraceAsString()));
    } catch (Throwable $e) {
        $ret = -1;//$pdo->rollBack();
        file_log(sprintf('rollback %d exception %s', $ret, $e->getTraceAsString()));
    }
}

file_put_contents((ini_get('xhprof.output_dir') ? : '/tmp') . '/' . $rid . '.xhprof.xhprof', serialize(xhprof_disable()));

// Third, one terminal 'php -S 127.0.0.1:9093'
//        another terminal 'ab -c 10 -n 10 http://127.0.0.1:9093/bug_test.php'
function file_log($msg)
{
	global $rid;
    file_put_contents(__DIR__ . '/test.log', sprintf("%s %s\n", $rid, $msg), FILE_APPEND);
}
```

然后是脚本输出日志:

```
596ad99b2fd95 begin ret 1
596ad99b2fe22 begin ret 1
596ad99b2fd95 last insertId 22
596ad99b2fe22 last insertId 23
596ad99b2fd95 commit ret 1
596ad99b2fd95 inserted data {"id":22,"stock":1585}
596ad99b2fe22 commit ret 1
596ad99b2fe22 inserted data false
596ad99b34c38 begin ret 1
596ad99b34c38 rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
596ad99b36baf begin ret 1
596ad99b36baf rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
596ad99b379da begin ret 1
596ad99b379da rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
596ad99b39645 begin ret 1
596ad99b39645 rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
596ad99b3a3fb begin ret 1
596ad99b3a3fb rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
596ad99b3c445 begin ret 1
596ad99b3c445 rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
596ad99b3c976 begin ret 1
596ad99b3c976 rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
596ad99b3e500 begin ret 1
596ad99b3e500 rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
```

然后是数据库当前内容:
```
mysql> select * from test;
+----+-------+
| id | stock |
+----+-------+
|  1 |     0 |
| 22 |  1585 |
+----+-------+
2 rows in set (0.00 sec)

mysql> select @@version;
+----------------+
| @@version      |
+----------------+
| 5.7.1-TiDB-1.0 |
+----------------+
1 row in set (0.01 sec)
```

然后是xhprof的输出:

日志我放到[github上了](https://github.com/yaoguais/cabin/tree/master/tidb/trans_test/xhprof_log).

然后用xhprof的可视化网页查看, 才反应过来, xhprof只能纪录php内置或用户写的函数,

并不能纪录全部的c函数调用流程.

这条路也走不通了, 花费了半个小时.


### 再再次通过mysqlnd调试信息修复bug

重新整理了一下思路, 一直的思路应该是没有问题, 首先排除mysql协议的问题,

确定是pdo的问题, 那么通过mysqlnd的内置的调制方法调试, 才是正确的方式.

之前没有找到正确的mysqlnd配置方式, 整理思路后重新查找了一下, 真的找到了.

地址在[这里](http://php.net/manual/zh/mysqlnd.config.php#ini.mysqlnd.debug).

查看了之后, 将mysqlnd的配置修改为:

```
mysqlnd.debug = "d:F:i:L:n:t,2000:x:A,/tmp/mysqlnd.trace"
mysqlnd.log_mask = 2043
```

脚本日志输出:
```
596aede076fc2 begin ret 1
596aede077912 begin ret 1
596aede078c5e begin ret 1
596aede076fc2 last insertId 26
596aede079ba5 begin ret 1
596aede07d689 begin ret 1
596aede07e25a begin ret 1
596aede07e63d begin ret 1
596aede07e263 begin ret 1
596aede076fc2 commit ret 1
596aede07d9fe begin ret 1
596aede07ebf1 begin ret 1
596aede077912 last insertId 27
596aede07e63d rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
596aede07e25a last insertId 28
596aede078c5e last insertId 29
596aede07e263 rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
596aede07ebf1 rollback -1 exception #0 /data/test/bug_test.php(30): PDO->exec('update test set...')
#1 {main}
596aede079ba5 last insertId 30
596aede07d9fe last insertId 31
596aede078c5e commit ret 1
596aede077912 commit ret 1
596aede07e25a commit ret 1
596aede07d9fe commit ret 1
596aede079ba5 commit ret 1
596aede07e25a inserted data false
596aede076fc2 inserted data {"id":26,"stock":1262}
596aede077912 inserted data false
596aede079ba5 inserted data false
596aede07d9fe inserted data false
596aede078c5e inserted data false
596aede07d689 last insertId 32
596aede07d689 commit ret 1
596aede07d689 inserted data false
```

数据库的内容为:
```
+----+-------+
| id | stock |
+----+-------+
|  1 |     0 |
| 26 |  1262 |
+----+-------+
2 rows in set (0.01 sec)
```

mysqlnd.trace因为文件太大, 我还是放到github上了.

[地址](https://github.com/yaoguais/cabin/blob/master/tidb/trans_test/mysqlnd.trace.2)

第一次的时候, 日志都混在一起了, 根本区分不了是哪个的日志,

然后我把php-fpm的进程数直接调到30, 然后通过进程号把文件拆分成10个文件,

这下日志就清晰了. 地址在[这里](https://github.com/yaoguais/cabin/tree/master/tidb/trans_test/mysqlnd.trace.2.separate).

看了半天的日志和代码, 终于找到问题所在了.

mysqlnd中status的返回值定义为:
```
/* Follow libmysql convention */
typedef enum func_status
{
	PASS = 0,
	FAIL = 1
} enum_func_status;
```

可以看出PASS=0, FAIL=1.

但是commit()函数的返回值是mysql\_handle\_commit()函数返回的,

仔细观察, 这个错误其实很简单的, 就是判断的时候, 无论PASS还是FAIL都返回true,

这就不能区分commit()函数是否提交成功了.

```
static int mysql_handle_commit(pdo_dbh_t *dbh)
{
	PDO_DBG_ENTER("mysql_handle_commit");
	PDO_DBG_INF_FMT("dbh=%p", dbh);
#if MYSQL_VERSION_ID >= 40100 || defined(PDO_USE_MYSQLND)
	PDO_DBG_RETURN(0 <= mysql_commit(((pdo_mysql_db_handle *)dbh->driver_data)->server));
#else
	PDO_DBG_RETURN(0 <= mysql_handle_doer(dbh, ZEND_STRL("COMMIT")));
#endif
}
```

好了, 问题得以解决, 直接判断返回值是否等于0即可.