## PHP的PDO-commit函数在tidb上返回值错误的分析

问题是这样的, tidb使用乐观型事务, 在事务提交的一瞬间才进行冲突监测,

但是在PDO的commit()函数上就发生了诡异的事情, 失败提交失败了,

commit()函数返回成功且没有抛出异常.




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


### 修复bug

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
   0:>mysqlnd_init
   1:| >mysqlnd_driver::get_connection
   2:| | info : persistent=0
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | >mysqlnd_conn_data::set_state
   3:| | | info : New state=0
   2:| | <mysqlnd_conn_data::set_state
   2:| | >mysqlnd_conn_data::get_reference
   3:| | | info : conn=0 new_refcount=1
   2:| | <mysqlnd_conn_data::get_reference
   2:| | >mysqlnd_conn_data::init
   3:| | | >mysqlnd_net_init
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_object_factory::get_io_channel
   5:| | | | | info : persistent=0
   5:| | | | | >mysqlnd_net::init
   6:| | | | | | >mysqlnd_net::set_client_option
   7:| | | | | | | info : option=202
   7:| | | | | | | info : MYSQLND_OPT_NET_CMD_BUFFER_SIZE
   7:| | | | | | | info : new_length=4096
   7:| | | | | | | >_mysqlnd_pemalloc
   7:| | | | | | | <_mysqlnd_pemalloc
   6:| | | | | | <mysqlnd_net::set_client_option
   6:| | | | | | >mysqlnd_net::set_client_option
   7:| | | | | | | info : option=203
   7:| | | | | | | info : MYSQLND_OPT_NET_READ_BUFFER_SIZE
   7:| | | | | | | info : new_length=32768
   6:| | | | | | <mysqlnd_net::set_client_option
   6:| | | | | | >mysqlnd_net::set_client_option
   7:| | | | | | | info : option=11
   6:| | | | | | <mysqlnd_net::set_client_option
   5:| | | | | <mysqlnd_net::init
   4:| | | | <mysqlnd_object_factory::get_io_channel
   3:| | | <mysqlnd_net_init
   3:| | | >mysqlnd_protocol_init
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_object_factory::get_protocol_decoder
   5:| | | | | info : persistent=0
   4:| | | | <mysqlnd_object_factory::get_protocol_decoder
   3:| | | <mysqlnd_protocol_init
   2:| | <mysqlnd_conn_data::init
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   1:| <mysqlnd_driver::get_connection
   1:| >mysqlnd_conn_data::negotiate_client_api_capabilities
   1:| <mysqlnd_conn_data::negotiate_client_api_capabilities
   0:<mysqlnd_init
   0:>mysqlnd_conn_data::set_client_option
   1:| info : conn=0 option=0
   1:| >mysqlnd_conn_data::local_tx_start
   1:| <mysqlnd_conn_data::local_tx_start
   1:| >mysqlnd_net::set_client_option
   2:| | info : option=0
   2:| | info : MYSQL_OPT_CONNECT_TIMEOUT
   1:| <mysqlnd_net::set_client_option
   1:| >mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn_data::local_tx_end
   0:<mysqlnd_conn_data::set_client_option
   0:>mysqlnd_conn_data::set_client_option
   1:| info : conn=0 option=8
   1:| >mysqlnd_conn_data::local_tx_start
   1:| <mysqlnd_conn_data::local_tx_start
   1:| >mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn_data::local_tx_end
   0:<mysqlnd_conn_data::set_client_option
   0:>mysqlnd_connect
   1:| info : host=10.80.90.30 user=root db=test port=4000 flags=196608
   1:| >mysqlnd_conn::connect
   2:| | >mysqlnd_conn_data::local_tx_start
   2:| | <mysqlnd_conn_data::local_tx_start
   2:| | >mysqlnd_conn_data::set_client_option_2d
   3:| | | info : conn=0 option=25
   3:| | | >mysqlnd_conn_data::local_tx_start
   3:| | | <mysqlnd_conn_data::local_tx_start
   3:| | | info : Initializing connect_attr hash
   3:| | | >_mysqlnd_pemalloc
   3:| | | <_mysqlnd_pemalloc
   3:| | | info : Adding [_client_name][mysqlnd]
   3:| | | >mysqlnd_conn_data::local_tx_end
   3:| | | <mysqlnd_conn_data::local_tx_end
   2:| | <mysqlnd_conn_data::set_client_option_2d
   2:| | >mysqlnd_conn_data::connect
   3:| | | info : conn=0x7fc2a4082508
   3:| | | >mysqlnd_conn_data::local_tx_start
   3:| | | <mysqlnd_conn_data::local_tx_start
   3:| | | >mysqlnd_conn_data::get_state
   3:| | | <mysqlnd_conn_data::get_state
   3:| | | info : host=10.80.90.30 user=root db=test port=4000 flags=196608 persistent=0 state=0
   3:| | | >mysqlnd_conn_data::get_state
   3:| | | <mysqlnd_conn_data::get_state
   3:| | | >mysqlnd_conn_data::set_client_option
   4:| | | | info : conn=0 option=210
   4:| | | | >mysqlnd_conn_data::local_tx_start
   4:| | | | <mysqlnd_conn_data::local_tx_start
   4:| | | | >mysqlnd_conn_data::local_tx_end
   4:| | | | <mysqlnd_conn_data::local_tx_end
   3:| | | <mysqlnd_conn_data::set_client_option
   3:| | | info : transport=tcp://10.80.90.30:4000 conn->scheme=(null)
   3:| | | >_mysqlnd_pestrndup
   3:| | | <_mysqlnd_pestrndup
   3:| | | >mysqlnd_conn_data::get_updated_connect_flags
   3:| | | <mysqlnd_conn_data::get_updated_connect_flags
   3:| | | >mysqlnd_conn_data::connect_handshake
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_protocol::get_greet_packet
   4:| | | | <mysqlnd_protocol::get_greet_packet
   4:| | | | >mysqlnd_net::connect_ex
   5:| | | | | >mysqlnd_net::close_stream
   6:| | | | | | >mysqlnd_net::get_stream
   7:| | | | | | | info : 0
   6:| | | | | | <mysqlnd_net::get_stream
   5:| | | | | <mysqlnd_net::close_stream
   5:| | | | | >mysqlnd_net::get_open_stream
   5:| | | | | <mysqlnd_net::get_open_stream
   5:| | | | | >mysqlnd_net::open_tcp_or_unix
   6:| | | | | | info : calling php_stream_xport_create
   5:| | | | | <mysqlnd_net::open_tcp_or_unix
   5:| | | | | >mysqlnd_net::set_stream
   5:| | | | | <mysqlnd_net::set_stream
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::post_connect_set_opt
   6:| | | | | | info : setting 31536000 as PHP_STREAM_OPTION_READ_TIMEOUT
   6:| | | | | | >mysqlnd_set_sock_no_delay
   6:| | | | | | <mysqlnd_set_sock_no_delay
   6:| | | | | | >mysqlnd_set_sock_keepalive
   6:| | | | | | <mysqlnd_set_sock_keepalive
   5:| | | | | <mysqlnd_net::post_connect_set_opt
   4:| | | | <mysqlnd_net::connect_ex
   4:| | | | >mysqlnd_net::get_stream
   5:| | | | | info : 0x7fc2a4066a00
   4:| | | | <mysqlnd_net::get_stream
   4:| | | | info : stream=0x7fc2a4066a00
   4:| | | | >php_mysqlnd_greet_read
   5:| | | | | info : buf=0x7ffca191b280 size=2048
   5:| | | | | >mysqlnd_read_header
   6:| | | | | | info : compressed=0
   6:| | | | | | >mysqlnd_net::receive_ex
   6:| | | | | | <mysqlnd_net::receive_ex
   6:| | | | | | >mysqlnd_net::get_stream
   7:| | | | | | | info : 0x7fc2a4066a00
   6:| | | | | | <mysqlnd_net::get_stream
   6:| | | | | | >mysqlnd_net::network_read_ex
   7:| | | | | | | info : count=4
   6:| | | | | | <mysqlnd_net::network_read_ex
   6:| | | | | | info : HEADER: prot_packet_no=0 size= 60
   5:| | | | | <mysqlnd_read_header
   5:| | | | | >mysqlnd_net::receive_ex
   5:| | | | | <mysqlnd_net::receive_ex
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::network_read_ex
   6:| | | | | | info : count=60
   5:| | | | | <mysqlnd_net::network_read_ex
   5:| | | | | info : proto=10 server=5.7.1-TiDB-1.0 thread_id=285743
   5:| | | | | info : server_capabilities=41615 charset_no=83 server_status=2 auth_protocol=n/a scramble_length=20
   4:| | | | <php_mysqlnd_greet_read
   4:| | | | >_mysqlnd_pestrdup
   4:| | | | <_mysqlnd_pestrdup
   4:| | | | >mysqlnd_connect_run_authentication
   5:| | | | | >mysqlnd_switch_to_ssl_if_needed
   6:| | | | | | info : client_capability_flags=762509
   6:| | | | | | info : CLIENT_LONG_PASSWORD=	1
   6:| | | | | | info : CLIENT_FOUND_ROWS=		0
   6:| | | | | | info : CLIENT_LONG_FLAG=		1
   6:| | | | | | info : CLIENT_NO_SCHEMA=		0
   6:| | | | | | info : CLIENT_COMPRESS=		0
   6:| | | | | | info : CLIENT_ODBC=			0
   6:| | | | | | info : CLIENT_LOCAL_FILES=	1
   6:| | | | | | info : CLIENT_IGNORE_SPACE=	0
   6:| | | | | | info : CLIENT_PROTOCOL_41=	1
   6:| | | | | | info : CLIENT_INTERACTIVE=	0
   6:| | | | | | info : CLIENT_SSL=			0
   6:| | | | | | info : CLIENT_IGNORE_SIGPIPE=	0
   6:| | | | | | info : CLIENT_TRANSACTIONS=	1
   6:| | | | | | info : CLIENT_RESERVED=		0
   6:| | | | | | info : CLIENT_SECURE_CONNECTION=1
   6:| | | | | | info : CLIENT_MULTI_STATEMENTS=1
   6:| | | | | | info : CLIENT_MULTI_RESULTS=	1
   6:| | | | | | info : CLIENT_PS_MULTI_RESULTS=0
   6:| | | | | | info : CLIENT_CONNECT_ATTRS=	1
   6:| | | | | | info : CLIENT_PLUGIN_AUTH_LENENC_CLIENT_DATA=	0
   6:| | | | | | info : CLIENT_CAN_HANDLE_EXPIRED_PASSWORDS=	0
   6:| | | | | | info : CLIENT_SESSION_TRACK=		0
   6:| | | | | | info : CLIENT_SSL_DONT_VERIFY_SERVER_CERT=	0
   6:| | | | | | info : CLIENT_SSL_VERIFY_SERVER_CERT=	0
   6:| | | | | | info : CLIENT_REMEMBER_OPTIONS=		0
   6:| | | | | | >_mysqlnd_pecalloc
   6:| | | | | | <_mysqlnd_pecalloc
   6:| | | | | | >mysqlnd_protocol::get_auth_packet
   6:| | | | | | <mysqlnd_protocol::get_auth_packet
   6:| | | | | | info : PACKET_FREE(0x7fc2a405e1e8)
   6:| | | | | | >_mysqlnd_pefree
   6:| | | | | | <_mysqlnd_pefree
   5:| | | | | <mysqlnd_switch_to_ssl_if_needed
   5:| | | | | >mysqlnd_run_authentication
   6:| | | | | | >_mysqlnd_emalloc
   6:| | | | | | <_mysqlnd_emalloc
   6:| | | | | | >_mysqlnd_pestrdup
   6:| | | | | | <_mysqlnd_pestrdup
   6:| | | | | | >mysqlnd_conn_data::fetch_auth_plugin_by_name
   7:| | | | | | | info : looking for auth_plugin_mysql_native_password auth plugin
   6:| | | | | | <mysqlnd_conn_data::fetch_auth_plugin_by_name
   6:| | | | | | info : plugin found
   6:| | | | | | >_mysqlnd_pemalloc
   6:| | | | | | <_mysqlnd_pemalloc
   6:| | | | | | info : salt(20)=[vi|j,[U~+mAr	Ta]
   6:| | | | | | >mysqlnd_native_auth_get_auth_data
   6:| | | | | | <mysqlnd_native_auth_get_auth_data
   6:| | | | | | >mysqlnd_auth_handshake
   7:| | | | | | | >_mysqlnd_pecalloc
   7:| | | | | | | <_mysqlnd_pecalloc
   7:| | | | | | | >mysqlnd_protocol::get_auth_response_packet
   7:| | | | | | | <mysqlnd_protocol::get_auth_response_packet
   7:| | | | | | | >_mysqlnd_pecalloc
   7:| | | | | | | <_mysqlnd_pecalloc
   7:| | | | | | | >mysqlnd_protocol::get_auth_packet
   7:| | | | | | | <mysqlnd_protocol::get_auth_packet
   7:| | | | | | | >php_mysqlnd_auth_write
   8:| | | | | | | | >mysqlnd_net::send_ex
   9:| | | | | | | | | info : count=65 compression=0
   9:| | | | | | | | | info : to_be_sent=65
   9:| | | | | | | | | info : packets_sent=1
   9:| | | | | | | | | info : compressed_envelope_packet_no=0
   9:| | | | | | | | | info : packet_no=1
   9:| | | | | | | | | info : no compression
   9:| | | | | | | | | >mysqlnd_net::network_write_ex
  10:| | | | | | | | | | info : sending 69 bytes
  10:| | | | | | | | | | >mysqlnd_net::get_stream
  11:| | | | | | | | | | | info : 0x7fc2a4066a00
  10:| | | | | | | | | | <mysqlnd_net::get_stream
   9:| | | | | | | | | <mysqlnd_net::network_write_ex
   9:| | | | | | | | | info : packet_size=0 packet_no=2
   8:| | | | | | | | <mysqlnd_net::send_ex
   7:| | | | | | | <php_mysqlnd_auth_write
   7:| | | | | | | >php_mysqlnd_auth_response_read
   8:| | | | | | | | info : buf=0x7fc2a406f008 size=4095
   8:| | | | | | | | >mysqlnd_read_header
   9:| | | | | | | | | info : compressed=0
   9:| | | | | | | | | >mysqlnd_net::receive_ex
   9:| | | | | | | | | <mysqlnd_net::receive_ex
   9:| | | | | | | | | >mysqlnd_net::get_stream
  10:| | | | | | | | | | info : 0x7fc2a4066a00
   9:| | | | | | | | | <mysqlnd_net::get_stream
   9:| | | | | | | | | >mysqlnd_net::network_read_ex
  10:| | | | | | | | | | info : count=4
   9:| | | | | | | | | <mysqlnd_net::network_read_ex
   9:| | | | | | | | | info : HEADER: prot_packet_no=2 size=  7
   8:| | | | | | | | <mysqlnd_read_header
   8:| | | | | | | | >mysqlnd_net::receive_ex
   8:| | | | | | | | <mysqlnd_net::receive_ex
   8:| | | | | | | | >mysqlnd_net::get_stream
   9:| | | | | | | | | info : 0x7fc2a4066a00
   8:| | | | | | | | <mysqlnd_net::get_stream
   8:| | | | | | | | >mysqlnd_net::network_read_ex
   9:| | | | | | | | | info : count=7
   8:| | | | | | | | <mysqlnd_net::network_read_ex
   8:| | | | | | | | info : OK packet: aff_rows=0 last_ins_id=0 server_status=2 warnings=0
   7:| | | | | | | <php_mysqlnd_auth_response_read
   7:| | | | | | | info : PACKET_FREE(0)
   7:| | | | | | | info : PACKET_FREE(0x7fc2a405e1e8)
   7:| | | | | | | >_mysqlnd_pefree
   7:| | | | | | | <_mysqlnd_pefree
   7:| | | | | | | info : PACKET_FREE(0x7fc2a4071308)
   7:| | | | | | | >_mysqlnd_pefree
   7:| | | | | | | <_mysqlnd_pefree
   6:| | | | | | <mysqlnd_auth_handshake
   6:| | | | | | info : switch_to_auth_protocol=n/a
   6:| | | | | | >_mysqlnd_efree
   6:| | | | | | <_mysqlnd_efree
   6:| | | | | | info : conn->error_info->error_no = 0
   6:| | | | | | info : saving requested_protocol=mysql_native_password
   6:| | | | | | >mysqlnd_conn_data::set_client_option
   7:| | | | | | | info : conn=285743 option=211
   7:| | | | | | | >mysqlnd_conn_data::local_tx_start
   7:| | | | | | | <mysqlnd_conn_data::local_tx_start
   7:| | | | | | | >_mysqlnd_pestrdup
   7:| | | | | | | <_mysqlnd_pestrdup
   7:| | | | | | | info : auth_protocol=mysql_native_password
   7:| | | | | | | >mysqlnd_conn_data::local_tx_end
   7:| | | | | | | <mysqlnd_conn_data::local_tx_end
   6:| | | | | | <mysqlnd_conn_data::set_client_option
   6:| | | | | | >_mysqlnd_efree
   6:| | | | | | <_mysqlnd_efree
   5:| | | | | <mysqlnd_run_authentication
   4:| | | | <mysqlnd_connect_run_authentication
   4:| | | | info : PACKET_FREE(0x7fc2a4071008)
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <mysqlnd_conn_data::connect_handshake
   3:| | | >mysqlnd_conn_data::set_state
   4:| | | | info : New state=1
   3:| | | <mysqlnd_conn_data::set_state
   3:| | | >_mysqlnd_pestrndup
   3:| | | <_mysqlnd_pestrndup
   3:| | | >_mysqlnd_pestrndup
   3:| | | <_mysqlnd_pestrndup
   3:| | | >_mysqlnd_pestrndup
   3:| | | <_mysqlnd_pestrndup
   3:| | | >_mysqlnd_pestrndup
   3:| | | <_mysqlnd_pestrndup
   3:| | | >_mysqlnd_pestrdup
   3:| | | <_mysqlnd_pestrdup
   3:| | | >mysqlnd_conn_data::execute_init_commands
   3:| | | <mysqlnd_conn_data::execute_init_commands
   3:| | | info : connection_id=285743
   3:| | | >mysqlnd_conn_data::local_tx_end
   3:| | | <mysqlnd_conn_data::local_tx_end
   2:| | <mysqlnd_conn_data::connect
   2:| | >mysqlnd_conn_data::local_tx_end
   2:| | <mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn::connect
   0:<mysqlnd_connect
   0:>mysqlnd_conn_data::query
   1:| info : conn=0x7fc2a4082508 conn=285743 query=START TRANSACTION
   1:| >mysqlnd_conn_data::local_tx_start
   1:| <mysqlnd_conn_data::local_tx_start
   1:| >mysqlnd_conn_data::send_query
   2:| | info : conn=285743 query=START TRANSACTION
   2:| | info : conn->server_status=2
   2:| | >mysqlnd_conn_data::local_tx_start
   2:| | <mysqlnd_conn_data::local_tx_start
   2:| | >mysqlnd_conn_data::simple_command
   3:| | | >mysqlnd_conn_data::simple_command_send_request
   4:| | | | info : command=QUERY silent=0
   4:| | | | info : conn->server_status=2
   4:| | | | info : sending 18 bytes
   4:| | | | >mysqlnd_conn_data::get_state
   4:| | | | <mysqlnd_conn_data::get_state
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_protocol::get_command_packet
   4:| | | | <mysqlnd_protocol::get_command_packet
   4:| | | | >php_mysqlnd_cmd_write
   5:| | | | | >mysqlnd_net::send_ex
   6:| | | | | | info : count=18 compression=0
   6:| | | | | | info : to_be_sent=18
   6:| | | | | | info : packets_sent=1
   6:| | | | | | info : compressed_envelope_packet_no=0
   6:| | | | | | info : packet_no=0
   6:| | | | | | info : no compression
   6:| | | | | | >mysqlnd_net::network_write_ex
   7:| | | | | | | info : sending 22 bytes
   7:| | | | | | | >mysqlnd_net::get_stream
   8:| | | | | | | | info : 0x7fc2a4066a00
   7:| | | | | | | <mysqlnd_net::get_stream
   6:| | | | | | <mysqlnd_net::network_write_ex
   6:| | | | | | info : packet_size=0 packet_no=1
   5:| | | | | <mysqlnd_net::send_ex
   4:| | | | <php_mysqlnd_cmd_write
   4:| | | | info : PACKET_FREE(0x7fc2a405f5a8)
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <mysqlnd_conn_data::simple_command_send_request
   3:| | | info : PASS
   2:| | <mysqlnd_conn_data::simple_command
   2:| | >mysqlnd_conn_data::set_state
   3:| | | info : New state=2
   2:| | <mysqlnd_conn_data::set_state
   2:| | >mysqlnd_conn_data::local_tx_end
   2:| | <mysqlnd_conn_data::local_tx_end
   2:| | info : conn->server_status=2
   1:| <mysqlnd_conn_data::send_query
   1:| >mysqlnd_conn_data::get_state
   1:| <mysqlnd_conn_data::get_state
   1:| >mysqlnd_conn_data::reap_query
   2:| | info : conn=285743
   2:| | info : conn->server_status=2
   2:| | >mysqlnd_conn_data::local_tx_start
   2:| | <mysqlnd_conn_data::local_tx_start
   2:| | >mysqlnd_query_read_result_set_header
   3:| | | info : stmt=0
   3:| | | >_mysqlnd_pecalloc
   3:| | | <_mysqlnd_pecalloc
   3:| | | >mysqlnd_protocol::get_rset_header_packet
   3:| | | <mysqlnd_protocol::get_rset_header_packet
   3:| | | >php_mysqlnd_rset_header_read
   4:| | | | info : buf=0x7fc2a406f008 size=4096
   4:| | | | >mysqlnd_read_header
   5:| | | | | info : compressed=0
   5:| | | | | >mysqlnd_net::receive_ex
   5:| | | | | <mysqlnd_net::receive_ex
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::network_read_ex
   6:| | | | | | info : count=4
   5:| | | | | <mysqlnd_net::network_read_ex
   5:| | | | | info : HEADER: prot_packet_no=1 size=  7
   4:| | | | <mysqlnd_read_header
   4:| | | | >mysqlnd_net::receive_ex
   4:| | | | <mysqlnd_net::receive_ex
   4:| | | | >mysqlnd_net::get_stream
   5:| | | | | info : 0x7fc2a4066a00
   4:| | | | <mysqlnd_net::get_stream
   4:| | | | >mysqlnd_net::network_read_ex
   5:| | | | | info : count=7
   4:| | | | <mysqlnd_net::network_read_ex
   4:| | | | info : UPSERT
   4:| | | | info : affected_rows=0 last_insert_id=0 server_status=3 warning_count=0
   3:| | | <php_mysqlnd_rset_header_read
   3:| | | info : UPSERT
   3:| | | >mysqlnd_conn_data::set_state
   4:| | | | info : New state=1
   3:| | | <mysqlnd_conn_data::set_state
   3:| | | info : PACKET_FREE(0x7fc2a4071008)
   3:| | | >php_mysqlnd_rset_header_free_mem
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <php_mysqlnd_rset_header_free_mem
   3:| | | info : PASS
   2:| | <mysqlnd_query_read_result_set_header
   2:| | >mysqlnd_conn_data::local_tx_end
   2:| | <mysqlnd_conn_data::local_tx_end
   2:| | info : conn->server_status=3
   1:| <mysqlnd_conn_data::reap_query
   1:| >mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn_data::local_tx_end
   0:<mysqlnd_conn_data::query
   0:>mysqlnd_conn_data::more_results
   0:<mysqlnd_conn_data::more_results
   0:>mysqlnd_conn_data::query
   1:| info : conn=0x7fc2a4082508 conn=285743 query=update test set stock = stock - 10 where id = 1
   1:| >mysqlnd_conn_data::local_tx_start
   1:| <mysqlnd_conn_data::local_tx_start
   1:| >mysqlnd_conn_data::send_query
   2:| | info : conn=285743 query=update test set stock = stock - 10 where id = 1
   2:| | info : conn->server_status=3
   2:| | >mysqlnd_conn_data::local_tx_start
   2:| | <mysqlnd_conn_data::local_tx_start
   2:| | >mysqlnd_conn_data::simple_command
   3:| | | >mysqlnd_conn_data::simple_command_send_request
   4:| | | | info : command=QUERY silent=0
   4:| | | | info : conn->server_status=3
   4:| | | | info : sending 48 bytes
   4:| | | | >mysqlnd_conn_data::get_state
   4:| | | | <mysqlnd_conn_data::get_state
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_protocol::get_command_packet
   4:| | | | <mysqlnd_protocol::get_command_packet
   4:| | | | >php_mysqlnd_cmd_write
   5:| | | | | >mysqlnd_net::send_ex
   6:| | | | | | info : count=48 compression=0
   6:| | | | | | info : to_be_sent=48
   6:| | | | | | info : packets_sent=1
   6:| | | | | | info : compressed_envelope_packet_no=0
   6:| | | | | | info : packet_no=0
   6:| | | | | | info : no compression
   6:| | | | | | >mysqlnd_net::network_write_ex
   7:| | | | | | | info : sending 52 bytes
   7:| | | | | | | >mysqlnd_net::get_stream
   8:| | | | | | | | info : 0x7fc2a4066a00
   7:| | | | | | | <mysqlnd_net::get_stream
   6:| | | | | | <mysqlnd_net::network_write_ex
   6:| | | | | | info : packet_size=0 packet_no=1
   5:| | | | | <mysqlnd_net::send_ex
   4:| | | | <php_mysqlnd_cmd_write
   4:| | | | info : PACKET_FREE(0x7fc2a405f608)
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <mysqlnd_conn_data::simple_command_send_request
   3:| | | info : PASS
   2:| | <mysqlnd_conn_data::simple_command
   2:| | >mysqlnd_conn_data::set_state
   3:| | | info : New state=2
   2:| | <mysqlnd_conn_data::set_state
   2:| | >mysqlnd_conn_data::local_tx_end
   2:| | <mysqlnd_conn_data::local_tx_end
   2:| | info : conn->server_status=3
   1:| <mysqlnd_conn_data::send_query
   1:| >mysqlnd_conn_data::get_state
   1:| <mysqlnd_conn_data::get_state
   1:| >mysqlnd_conn_data::reap_query
   2:| | info : conn=285743
   2:| | info : conn->server_status=3
   2:| | >mysqlnd_conn_data::local_tx_start
   2:| | <mysqlnd_conn_data::local_tx_start
   2:| | >mysqlnd_query_read_result_set_header
   3:| | | info : stmt=0
   3:| | | >_mysqlnd_pecalloc
   3:| | | <_mysqlnd_pecalloc
   3:| | | >mysqlnd_protocol::get_rset_header_packet
   3:| | | <mysqlnd_protocol::get_rset_header_packet
   3:| | | >php_mysqlnd_rset_header_read
   4:| | | | info : buf=0x7fc2a406f008 size=4096
   4:| | | | >mysqlnd_read_header
   5:| | | | | info : compressed=0
   5:| | | | | >mysqlnd_net::receive_ex
   5:| | | | | <mysqlnd_net::receive_ex
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::network_read_ex
   6:| | | | | | info : count=4
   5:| | | | | <mysqlnd_net::network_read_ex
   5:| | | | | info : HEADER: prot_packet_no=1 size= 59
   4:| | | | <mysqlnd_read_header
   4:| | | | >mysqlnd_net::receive_ex
   4:| | | | <mysqlnd_net::receive_ex
   4:| | | | >mysqlnd_net::get_stream
   5:| | | | | info : 0x7fc2a4066a00
   4:| | | | <mysqlnd_net::get_stream
   4:| | | | >mysqlnd_net::network_read_ex
   5:| | | | | info : count=59
   4:| | | | <mysqlnd_net::network_read_ex
   4:| | | | >php_mysqlnd_read_error_from_line
   4:| | | | <php_mysqlnd_read_error_from_line
   4:| | | | info : conn->server_status=3
   3:| | | <php_mysqlnd_rset_header_read
   3:| | | >_mysqlnd_pestrdup
   3:| | | <_mysqlnd_pestrdup
   3:| | | info : adding error [BIGINT UNSIGNED value is out of range in '(0, 10)'] to the list
   3:| | | error: error=BIGINT UNSIGNED value is out of range in '(0, 10)'
   3:| | | >mysqlnd_conn_data::set_state
   4:| | | | info : New state=1
   3:| | | <mysqlnd_conn_data::set_state
   3:| | | info : PACKET_FREE(0x7fc2a4071008)
   3:| | | >php_mysqlnd_rset_header_free_mem
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <php_mysqlnd_rset_header_free_mem
   3:| | | info : FAIL
   2:| | <mysqlnd_query_read_result_set_header
   2:| | >mysqlnd_conn_data::local_tx_end
   2:| | <mysqlnd_conn_data::local_tx_end
   2:| | info : conn->server_status=3
   1:| <mysqlnd_conn_data::reap_query
   1:| >mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn_data::local_tx_end
   0:<mysqlnd_conn_data::query
   0:>mysqlnd_conn_data::tx_commit_or_rollback
   1:| >mysqlnd_conn_data::local_tx_start
   1:| <mysqlnd_conn_data::local_tx_start
   1:| >mysqlnd_escape_string_for_tx_name_in_comment
   1:| <mysqlnd_escape_string_for_tx_name_in_comment
   1:| >mysqlnd_conn_data::query
   2:| | info : conn=0x7fc2a4082508 conn=285743 query=ROLLBACK
   2:| | >mysqlnd_conn_data::local_tx_start
   2:| | <mysqlnd_conn_data::local_tx_start
   2:| | >mysqlnd_conn_data::send_query
   3:| | | info : conn=285743 query=ROLLBACK
   3:| | | info : conn->server_status=3
   3:| | | >mysqlnd_conn_data::local_tx_start
   3:| | | <mysqlnd_conn_data::local_tx_start
   3:| | | >mysqlnd_conn_data::simple_command
   4:| | | | >mysqlnd_conn_data::simple_command_send_request
   5:| | | | | info : command=QUERY silent=0
   5:| | | | | info : conn->server_status=3
   5:| | | | | info : sending 10 bytes
   5:| | | | | >mysqlnd_conn_data::get_state
   5:| | | | | <mysqlnd_conn_data::get_state
   5:| | | | | >mysqlnd_error_list_pdtor
   6:| | | | | | >_mysqlnd_pefree
   6:| | | | | | <_mysqlnd_pefree
   5:| | | | | <mysqlnd_error_list_pdtor
   5:| | | | | >_mysqlnd_pecalloc
   5:| | | | | <_mysqlnd_pecalloc
   5:| | | | | >mysqlnd_protocol::get_command_packet
   5:| | | | | <mysqlnd_protocol::get_command_packet
   5:| | | | | >php_mysqlnd_cmd_write
   6:| | | | | | >mysqlnd_net::send_ex
   7:| | | | | | | info : count=10 compression=0
   7:| | | | | | | info : to_be_sent=10
   7:| | | | | | | info : packets_sent=1
   7:| | | | | | | info : compressed_envelope_packet_no=0
   7:| | | | | | | info : packet_no=0
   7:| | | | | | | info : no compression
   7:| | | | | | | >mysqlnd_net::network_write_ex
   8:| | | | | | | | info : sending 14 bytes
   8:| | | | | | | | >mysqlnd_net::get_stream
   9:| | | | | | | | | info : 0x7fc2a4066a00
   8:| | | | | | | | <mysqlnd_net::get_stream
   7:| | | | | | | <mysqlnd_net::network_write_ex
   7:| | | | | | | info : packet_size=0 packet_no=1
   6:| | | | | | <mysqlnd_net::send_ex
   5:| | | | | <php_mysqlnd_cmd_write
   5:| | | | | info : PACKET_FREE(0x7fc2a405f6c8)
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   4:| | | | <mysqlnd_conn_data::simple_command_send_request
   4:| | | | info : PASS
   3:| | | <mysqlnd_conn_data::simple_command
   3:| | | >mysqlnd_conn_data::set_state
   4:| | | | info : New state=2
   3:| | | <mysqlnd_conn_data::set_state
   3:| | | >mysqlnd_conn_data::local_tx_end
   3:| | | <mysqlnd_conn_data::local_tx_end
   3:| | | info : conn->server_status=3
   2:| | <mysqlnd_conn_data::send_query
   2:| | >mysqlnd_conn_data::get_state
   2:| | <mysqlnd_conn_data::get_state
   2:| | >mysqlnd_conn_data::reap_query
   3:| | | info : conn=285743
   3:| | | info : conn->server_status=3
   3:| | | >mysqlnd_conn_data::local_tx_start
   3:| | | <mysqlnd_conn_data::local_tx_start
   3:| | | >mysqlnd_query_read_result_set_header
   4:| | | | info : stmt=0
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_protocol::get_rset_header_packet
   4:| | | | <mysqlnd_protocol::get_rset_header_packet
   4:| | | | >php_mysqlnd_rset_header_read
   5:| | | | | info : buf=0x7fc2a406f008 size=4096
   5:| | | | | >mysqlnd_read_header
   6:| | | | | | info : compressed=0
   6:| | | | | | >mysqlnd_net::receive_ex
   6:| | | | | | <mysqlnd_net::receive_ex
   6:| | | | | | >mysqlnd_net::get_stream
   7:| | | | | | | info : 0x7fc2a4066a00
   6:| | | | | | <mysqlnd_net::get_stream
   6:| | | | | | >mysqlnd_net::network_read_ex
   7:| | | | | | | info : count=4
   6:| | | | | | <mysqlnd_net::network_read_ex
   6:| | | | | | info : HEADER: prot_packet_no=1 size=  7
   5:| | | | | <mysqlnd_read_header
   5:| | | | | >mysqlnd_net::receive_ex
   5:| | | | | <mysqlnd_net::receive_ex
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::network_read_ex
   6:| | | | | | info : count=7
   5:| | | | | <mysqlnd_net::network_read_ex
   5:| | | | | info : UPSERT
   5:| | | | | info : affected_rows=0 last_insert_id=0 server_status=2 warning_count=0
   4:| | | | <php_mysqlnd_rset_header_read
   4:| | | | info : UPSERT
   4:| | | | >mysqlnd_conn_data::set_state
   5:| | | | | info : New state=1
   4:| | | | <mysqlnd_conn_data::set_state
   4:| | | | info : PACKET_FREE(0x7fc2a4071008)
   4:| | | | >php_mysqlnd_rset_header_free_mem
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   4:| | | | <php_mysqlnd_rset_header_free_mem
   4:| | | | info : PASS
   3:| | | <mysqlnd_query_read_result_set_header
   3:| | | >mysqlnd_conn_data::local_tx_end
   3:| | | <mysqlnd_conn_data::local_tx_end
   3:| | | info : conn->server_status=2
   2:| | <mysqlnd_conn_data::reap_query
   2:| | >mysqlnd_conn_data::local_tx_end
   2:| | <mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn_data::query
   1:| >mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn_data::local_tx_end
   0:<mysqlnd_conn_data::tx_commit_or_rollback
   0:>mysqlnd_conn::close
   1:| info : conn=285743
   1:| >mysqlnd_conn_data::local_tx_start
   1:| <mysqlnd_conn_data::local_tx_start
   1:| >mysqlnd_conn_data::get_state
   1:| <mysqlnd_conn_data::get_state
   1:| >mysqlnd_net::get_stream
   2:| | info : 0x7fc2a4066a00
   1:| <mysqlnd_net::get_stream
   1:| >mysqlnd_send_close
   2:| | info : conn=285743 net->data->stream->abstract=0x7fc2a4059a00
   2:| | >mysqlnd_conn_data::get_state
   2:| | <mysqlnd_conn_data::get_state
   2:| | >mysqlnd_conn_data::get_state
   2:| | <mysqlnd_conn_data::get_state
   2:| | info : state=1
   2:| | info : Connection clean, sending COM_QUIT
   2:| | >mysqlnd_conn_data::simple_command
   3:| | | >mysqlnd_conn_data::simple_command_send_request
   4:| | | | info : command=QUIT silent=1
   4:| | | | info : conn->server_status=2
   4:| | | | info : sending 1 bytes
   4:| | | | >mysqlnd_conn_data::get_state
   4:| | | | <mysqlnd_conn_data::get_state
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_protocol::get_command_packet
   4:| | | | <mysqlnd_protocol::get_command_packet
   4:| | | | >php_mysqlnd_cmd_write
   5:| | | | | >mysqlnd_net::send_ex
   6:| | | | | | info : count=1 compression=0
   6:| | | | | | info : to_be_sent=1
   6:| | | | | | info : packets_sent=1
   6:| | | | | | info : compressed_envelope_packet_no=0
   6:| | | | | | info : packet_no=0
   6:| | | | | | info : no compression
   6:| | | | | | >mysqlnd_net::network_write_ex
   7:| | | | | | | info : sending 5 bytes
   7:| | | | | | | >mysqlnd_net::get_stream
   8:| | | | | | | | info : 0x7fc2a4066a00
   7:| | | | | | | <mysqlnd_net::get_stream
   6:| | | | | | <mysqlnd_net::network_write_ex
   6:| | | | | | info : packet_size=0 packet_no=1
   5:| | | | | <mysqlnd_net::send_ex
   4:| | | | <php_mysqlnd_cmd_write
   4:| | | | info : PACKET_FREE(0x7fc2a405f308)
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <mysqlnd_conn_data::simple_command_send_request
   3:| | | info : PASS
   2:| | <mysqlnd_conn_data::simple_command
   2:| | >mysqlnd_net::close_stream
   3:| | | >mysqlnd_net::get_stream
   4:| | | | info : 0x7fc2a4066a00
   3:| | | <mysqlnd_net::get_stream
   3:| | | info : Freeing stream. abstract=0x7fc2a4059a00
   3:| | | >mysqlnd_net::set_stream
   3:| | | <mysqlnd_net::set_stream
   2:| | <mysqlnd_net::close_stream
   2:| | >mysqlnd_conn_data::set_state
   3:| | | info : New state=6
   2:| | <mysqlnd_conn_data::set_state
   1:| <mysqlnd_send_close
   1:| >mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn_data::local_tx_end
   1:| >mysqlnd_conn::dtor
   2:| | info : conn=285743
   2:| | >my   6:| | | | | | <mysqlnd_net::network_read_ex
   6:| | | | | | info : HEADER: prot_packet_no=1 size= 59
   5:| | | | | <mysqlnd_read_header
   5:| | | | | >mysqlnd_net::receive_ex
   5:| | | | | <mysqlnd_net::receive_ex
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::network_read_ex
   6:| | | | | | info : count=59
   5:| | | | | <mysqlnd_net::network_read_ex
   5:| | | | | >php_mysqlnd_read_error_from_line
   5:| | | | | <php_mysqlnd_read_error_from_line
   5:| | | | | info : conn->server_status=3
   4:| | | | <php_mysqlnd_rset_header_read
   4:| | | | >_mysqlnd_pestrdup
   4:| | | | <_mysqlnd_pestrdup
   4:| | | | info : adding error [BIGINT UNSIGNED value is out of range in '(0, 10)'] to the list
   4:| | | | error: error=BIGINT UNSIGNED value is out of range in '(0, 10)'
   4:| | | | >mysqlnd_conn_data::set_state
   5:| | | | | info : New state=1
   4:| | | | <mysqlnd_conn_data::set_state
   4:| | | | info : PACKET_FREE(0x7fc2a4071008)
   4:| | | | >php_mysqlnd_rset_header_free_mem
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   4:| | | | <php_mysqlnd_rset_header_free_mem
   4:| | | | info : FAIL
   3:| | | <mysqlnd_query_read_result_set_header
   3:| | | >mysqlnd_conn_data::local_tx_end
   3:| | | <mysqlnd_conn_data::local_tx_end
   3:| | | info : conn->server_status=3
   2:| | <mysqlnd_conn_data::reap_query
   2:| | >mysqlnd_conn_data::local_tx_end
   2:| | <mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn_data::query
   1:| >mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn_data::local_tx_end
   0:<mysqlnd_conn_data::tx_commit_or_rollback
   0:>_mysqlnd_stmt_init
   1:| >_mysqlnd_pecalloc
   1:| <_mysqlnd_pecalloc
   1:| >mysqlnd_object_factory::get_prepared_statement
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | info : stmt=0x7fc2a407d008
   2:| | >_mysqlnd_pemalloc
   2:| | <_mysqlnd_pemalloc
   2:| | >mysqlnd_conn_data::get_reference
   3:| | | info : conn=285734 new_refcount=2
   2:| | <mysqlnd_conn_data::get_reference
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   1:| <mysqlnd_object_factory::get_prepared_statement
   0:<_mysqlnd_stmt_init
   0:>mysqlnd_stmt::prepare
   1:| info : stmt=0
   1:| info : query=select * from test where id = 13
   1:| >mysqlnd_error_list_pdtor
   2:| | >_mysqlnd_pefree
   2:| | <_mysqlnd_pefree
   1:| <mysqlnd_error_list_pdtor
   1:| >mysqlnd_conn_data::simple_command
   2:| | >mysqlnd_conn_data::simple_command_send_request
   3:| | | info : command=STMT_PREPARE silent=0
   3:| | | info : conn->server_status=3
   3:| | | info : sending 33 bytes
   3:| | | >mysqlnd_conn_data::get_state
   3:| | | <mysqlnd_conn_data::get_state
   3:| | | >_mysqlnd_pecalloc
   3:| | | <_mysqlnd_pecalloc
   3:| | | >mysqlnd_protocol::get_command_packet
   3:| | | <mysqlnd_protocol::get_command_packet
   3:| | | >php_mysqlnd_cmd_write
   4:| | | | >mysqlnd_net::send_ex
   5:| | | | | info : count=33 compression=0
   5:| | | | | info : to_be_sent=33
   5:| | | | | info : packets_sent=1
   5:| | | | | info : compressed_envelope_packet_no=0
   5:| | | | | info : packet_no=0
   5:| | | | | info : no compression
   5:| | | | | >mysqlnd_net::network_write_ex
   6:| | | | | | info : sending 37 bytes
   6:| | | | | | >mysqlnd_net::get_stream
   7:| | | | | | | info : 0x7fc2a4066a00
   6:| | | | | | <mysqlnd_net::get_stream
   5:| | | | | <mysqlnd_net::network_write_ex
   5:| | | | | info : packet_size=0 packet_no=1
   4:| | | | <mysqlnd_net::send_ex
   3:| | | <php_mysqlnd_cmd_write
   3:| | | info : PACKET_FREE(0x7fc2a405f668)
   3:| | | >_mysqlnd_pefree
   3:| | | <_mysqlnd_pefree
   2:| | <mysqlnd_conn_data::simple_command_send_request
   2:| | info : PASS
   1:| <mysqlnd_conn_data::simple_command
   1:| >mysqlnd_stmt_read_prepare_response
   2:| | info : stmt=0
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | >mysqlnd_protocol::get_prepare_response_packet
   2:| | <mysqlnd_protocol::get_prepare_response_packet
   2:| | >php_mysqlnd_prepare_read
   3:| | | info : buf=0x7fc2a406f008 size=4096
   3:| | | >mysqlnd_read_header
   4:| | | | info : compressed=0
   4:| | | | >mysqlnd_net::receive_ex
   4:| | | | <mysqlnd_net::receive_ex
   4:| | | | >mysqlnd_net::get_stream
   5:| | | | | info : 0x7fc2a4066a00
   4:| | | | <mysqlnd_net::get_stream
   4:| | | | >mysqlnd_net::network_read_ex
   5:| | | | | info : count=4
   4:| | | | <mysqlnd_net::network_read_ex
   4:| | | | info : HEADER: prot_packet_no=1 size= 12
   3:| | | <mysqlnd_read_header
   3:| | | >mysqlnd_net::receive_ex
   3:| | | <mysqlnd_net::receive_ex
   3:| | | >mysqlnd_net::get_stream
   4:| | | | info : 0x7fc2a4066a00
   3:| | | <mysqlnd_net::get_stream
   3:| | | >mysqlnd_net::network_read_ex
   4:| | | | info : count=12
   3:| | | <mysqlnd_net::network_read_ex
   3:| | | info : Prepare packet read: stmt_id=1 fields=2 params=0
   2:| | <php_mysqlnd_prepare_read
   2:| | info : PACKET_FREE(0x7fc2a4078288)
   2:| | >_mysqlnd_pefree
   2:| | <_mysqlnd_pefree
   1:| <mysqlnd_stmt_read_prepare_response
   1:| >_mysqlnd_pecalloc
   1:| <_mysqlnd_pecalloc
   1:| >mysqlnd_result_init
   1:| <mysqlnd_result_init
   1:| >mysqlnd_conn_data::get_reference
   2:| | info : conn=285734 new_refcount=3
   1:| <mysqlnd_conn_data::get_reference
   1:| >mysqlnd_res::read_result_metadata
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | >mysqlnd_result_meta_init
   3:| | | info : persistent=0
   3:| | | >_mysqlnd_pecalloc
   3:| | | <_mysqlnd_pecalloc
   3:| | | >_mysqlnd_pecalloc
   3:| | | <_mysqlnd_pecalloc
   3:| | | info : meta=0x7fc2a4080088
   2:| | <mysqlnd_result_meta_init
   2:| | >mysqlnd_res_meta::read_metadata
   3:| | | >_mysqlnd_pecalloc
   3:| | | <_mysqlnd_pecalloc
   3:| | | >mysqlnd_protocol::get_result_field_packet
   3:| | | <mysqlnd_protocol::get_result_field_packet
   3:| | | >php_mysqlnd_rset_field_read
   4:| | | | info : buf=0x7fc2a406f008 size=4096
   4:| | | | >mysqlnd_read_header
   5:| | | | | info : compressed=0
   5:| | | | | >mysqlnd_net::receive_ex
   5:| | | | | <mysqlnd_net::receive_ex
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::network_read_ex
   6:| | | | | | info : count=4
   5:| | | | | <mysqlnd_net::network_read_ex
   5:| | | | | info : HEADER: prot_packet_no=2 size= 32
   4:| | | | <mysqlnd_read_header
   4:| | | | >mysqlnd_net::receive_ex
   4:| | | | <mysqlnd_net::receive_ex
   4:| | | | >mysqlnd_net::get_stream
   5:| | | | | info : 0x7fc2a4066a00
   4:| | | | <mysqlnd_net::get_stream
   4:| | | | >mysqlnd_net::network_read_ex
   5:| | | | | info : count=32
   4:| | | | <mysqlnd_net::network_read_ex
   4:| | | | >_mysqlnd_pemalloc
   4:| | | | <_mysqlnd_pemalloc
   4:| | | | info : allocing root. persistent=0
   4:| | | | info : FIELD=[test..]
   3:| | | <php_mysqlnd_rset_field_read
   3:| | | >php_mysqlnd_rset_field_read
   4:| | | | info : buf=0x7fc2a406f008 size=4096
   4:| | | | >mysqlnd_read_header
   5:| | | | | info : compressed=0
   5:| | | | | >mysqlnd_net::receive_ex
   5:| | | | | <mysqlnd_net::receive_ex
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::network_read_ex
   6:| | | | | | info : count=4
   5:| | | | | <mysqlnd_net::network_read_ex
   5:| | | | | info : HEADER: prot_packet_no=3 size= 35
   4:| | | | <mysqlnd_read_header
   4:| | | | >mysqlnd_net::receive_ex
   4:| | | | <mysqlnd_net::receive_ex
   4:| | | | >mysqlnd_net::get_stream
   5:| | | | | info : 0x7fc2a4066a00
   4:| | | | <mysqlnd_net::get_stream
   4:| | | | >mysqlnd_net::network_read_ex
   5:| | | | | info : count=35
   4:| | | | <mysqlnd_net::network_read_ex
   4:| | | | >_mysqlnd_pemalloc
   4:| | | | <_mysqlnd_pemalloc
   4:| | | | info : allocing root. persistent=0
   4:| | | | info : FIELD=[test..]
   3:| | | <php_mysqlnd_rset_field_read
   3:| | | info : PACKET_FREE(0x7fc2a4078288)
   3:| | | >_mysqlnd_pefree
   3:| | | <_mysqlnd_pefree
   2:| | <mysqlnd_res_meta::read_metadata
   1:| <mysqlnd_res::read_result_metadata
   1:| >mysqlnd_stmt_prepare_read_eof
   2:| | info : stmt=1
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | >mysqlnd_protocol::get_eof_packet
   2:| | <mysqlnd_protocol::get_eof_packet
   2:| | >php_mysqlnd_eof_read
   3:| | | info : buf=0x7fc2a406f008 size=4096
   3:| | | >mysqlnd_read_header
   4:| | | | info : compressed=0
   4:| | | | >mysqlnd_net::receive_ex
   4:| | | | <mysqlnd_net::receive_ex
   4:| | | | >mysqlnd_net::get_stream
   5:| | | | | info : 0x7fc2a4066a00
   4:| | | | <mysqlnd_net::get_stream
   4:| | | | >mysqlnd_net::network_read_ex
   5:| | | | | info : count=4
   4:| | | | <mysqlnd_net::network_read_ex
   4:| | | | info : HEADER: prot_packet_no=4 size=  5
   3:| | | <mysqlnd_read_header
   3:| | | >mysqlnd_net::receive_ex
   3:| | | <mysqlnd_net::receive_ex
   3:| | | >mysqlnd_net::get_stream
   4:| | | | info : 0x7fc2a4066a00
   3:| | | <mysqlnd_net::get_stream
   3:| | | >mysqlnd_net::network_read_ex
   4:| | | | info : count=5
   3:| | | <mysqlnd_net::network_read_ex
   3:| | | info : EOF packet: fields=254 status=2 warnings=0
   2:| | <php_mysqlnd_eof_read
   2:| | info : PACKET_FREE(0x7fc2a4078288)
   2:| | >_mysqlnd_pefree
   2:| | <_mysqlnd_pefree
   1:| <mysqlnd_stmt_prepare_read_eof
   1:| info : PASS
   0:<mysqlnd_stmt::prepare
   0:>mysqlnd_stmt::execute
   1:| >mysqlnd_stmt::send_execute
   2:| | info : stmt=1
   2:| | >mysqlnd_stmt::flush
   3:| | | info : stmt=1
   3:| | | info : skipping result
   3:| | | >mysqlnd_res::skip_result
   3:| | | <mysqlnd_res::skip_result
   3:| | | >mysqlnd_stmt::more_results
   3:| | | <mysqlnd_stmt::more_results
   3:| | | info : PASS
   2:| | <mysqlnd_stmt::flush
   2:| | >mysqlnd_res::free_result_buffers
   3:| | | info : unknown
   2:| | <mysqlnd_res::free_result_buffers
   2:| | >mysqlnd_stmt_execute_generate_request
   3:| | | >mysqlnd_stmt_execute_store_params
   4:| | | | >mysqlnd_stmt_execute_prepare_param_types
   4:| | | | <mysqlnd_stmt_execute_prepare_param_types
   4:| | | | >mysqlnd_stmt_execute_calculate_param_values_size
   4:| | | | <mysqlnd_stmt_execute_calculate_param_values_size
   4:| | | | info : ret=PASS
   3:| | | <mysqlnd_stmt_execute_store_params
   3:| | | info : ret=PASS
   2:| | <mysqlnd_stmt_execute_generate_request
   2:| | >mysqlnd_conn_data::simple_command
   3:| | | >mysqlnd_conn_data::simple_command_send_request
   4:| | | | info : command=STMT_EXECUTE silent=0
   4:| | | | info : conn->server_status=3
   4:| | | | info : sending 11 bytes
   4:| | | | >mysqlnd_conn_data::get_state
   4:| | | | <mysqlnd_conn_data::get_state
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_protocol::get_command_packet
   4:| | | | <mysqlnd_protocol::get_command_packet
   4:| | | | >php_mysqlnd_cmd_write
   5:| | | | | >mysqlnd_net::send_ex
   6:| | | | | | info : count=11 compression=0
   6:| | | | | | info : to_be_sent=11
   6:| | | | | | info : packets_sent=1
   6:| | | | | | info : compressed_envelope_packet_no=0
   6:| | | | | | info : packet_no=0
   6:| | | | | | info : no compression
   6:| | | | | | >mysqlnd_net::network_write_ex
   7:| | | | | | | info : sending 15 bytes
   7:| | | | | | | >mysqlnd_net::get_stream
   8:| | | | | | | | info : 0x7fc2a4066a00
   7:| | | | | | | <mysqlnd_net::get_stream
   6:| | | | | | <mysqlnd_net::network_write_ex
   6:| | | | | | info : packet_size=0 packet_no=1
   5:| | | | | <mysqlnd_net::send_ex
   4:| | | | <php_mysqlnd_cmd_write
   4:| | | | info : PACKET_FREE(0x7fc2a405f668)
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <mysqlnd_conn_data::simple_command_send_request
   3:| | | info : PASS
   2:| | <mysqlnd_conn_data::simple_command
   1:| <mysqlnd_stmt::send_execute
   1:| >mysqlnd_stmt_execute_parse_response
   2:| | >mysqlnd_conn_data::set_state
   3:| | | info : New state=2
   2:| | <mysqlnd_conn_data::set_state
   2:| | >mysqlnd_query_read_result_set_header
   3:| | | info : stmt=1
   3:| | | >_mysqlnd_pecalloc
   3:| | | <_mysqlnd_pecalloc
   3:| | | >mysqlnd_protocol::get_rset_header_packet
   3:| | | <mysqlnd_protocol::get_rset_header_packet
   3:| | | >php_mysqlnd_rset_header_read
   4:| | | | info : buf=0x7fc2a406f008 size=4096
   4:| | | | >mysqlnd_read_header
   5:| | | | | info : compressed=0
   5:| | | | | >mysqlnd_net::receive_ex
   5:| | | | | <mysqlnd_net::receive_ex
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::network_read_ex
   6:| | | | | | info : count=4
   5:| | | | | <mysqlnd_net::network_read_ex
   5:| | | | | info : HEADER: prot_packet_no=1 size=  1
   4:| | | | <mysqlnd_read_header
   4:| | | | >mysqlnd_net::receive_ex
   4:| | | | <mysqlnd_net::receive_ex
   4:| | | | >mysqlnd_net::get_stream
   5:| | | | | info : 0x7fc2a4066a00
   4:| | | | <mysqlnd_net::get_stream
   4:| | | | >mysqlnd_net::network_read_ex
   5:| | | | | info : count=1
   4:| | | | <mysqlnd_net::network_read_ex
   4:| | | | info : SELECT
   3:| | | <php_mysqlnd_rset_header_read
   3:| | | info : Result set pending
   3:| | | >mysqlnd_conn_data::set_state
   4:| | | | info : New state=4
   3:| | | <mysqlnd_conn_data::set_state
   3:| | | >mysqlnd_res::read_result_metadata
   4:| | | | >mysqlnd_res_meta::free
   5:| | | | | info : persistent=0
   5:| | | | | info : Freeing fields metadata
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | info : Freeing zend_hash_keys
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | info : Freeing metadata structure
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   4:| | | | <mysqlnd_res_meta::free
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_result_meta_init
   5:| | | | | info : persistent=0
   5:| | | | | >_mysqlnd_pecalloc
   5:| | | | | <_mysqlnd_pecalloc
   5:| | | | | >_mysqlnd_pecalloc
   5:| | | | | <_mysqlnd_pecalloc
   5:| | | | | info : meta=0x7fc2a4080088
   4:| | | | <mysqlnd_result_meta_init
   4:| | | | >mysqlnd_res_meta::read_metadata
   5:| | | | | >_mysqlnd_pecalloc
   5:| | | | | <_mysqlnd_pecalloc
   5:| | | | | >mysqlnd_protocol::get_result_field_packet
   5:| | | | | <mysqlnd_protocol::get_result_field_packet
   5:| | | | | >php_mysqlnd_rset_field_read
   6:| | | | | | info : buf=0x7fc2a406f008 size=4096
   6:| | | | | | >mysqlnd_read_header
   7:| | | | | | | info : compressed=0
   7:| | | | | | | >mysqlnd_net::receive_ex
   7:| | | | | | | <mysqlnd_net::receive_ex
   7:| | | | | | | >mysqlnd_net::get_stream
   8:| | | | | | | | info : 0x7fc2a4066a00
   7:| | | | | | | <mysqlnd_net::get_stream
   7:| | | | | | | >mysqlnd_net::network_read_ex
   8:| | | | | | | | info : count=4
   7:| | | | | | | <mysqlnd_net::network_read_ex
   7:| | | | | | | info : HEADER: prot_packet_no=2 size= 30
   6:| | | | | | <mysqlnd_read_header
   6:| | | | | | >mysqlnd_net::receive_ex
   6:| | | | | | <mysqlnd_net::receive_ex
   6:| | | | | | >mysqlnd_net::get_stream
   7:| | | | | | | info : 0x7fc2a4066a00
   6:| | | | | | <mysqlnd_net::get_stream
   6:| | | | | | >mysqlnd_net::network_read_ex
   7:| | | | | | | info : count=30
   6:| | | | | | <mysqlnd_net::network_read_ex
   6:| | | | | | >_mysqlnd_pemalloc
   6:| | | | | | <_mysqlnd_pemalloc
   6:| | | | | | info : allocing root. persistent=0
   6:| | | | | | info : FIELD=[.test.id]
   5:| | | | | <php_mysqlnd_rset_field_read
   5:| | | | | >php_mysqlnd_rset_field_read
   6:| | | | | | info : buf=0x7fc2a406f008 size=4096
   6:| | | | | | >mysqlnd_read_header
   7:| | | | | | | info : compressed=0
   7:| | | | | | | >mysqlnd_net::receive_ex
   7:| | | | | | | <mysqlnd_net::receive_ex
   7:| | | | | | | >mysqlnd_net::get_stream
   8:| | | | | | | | info : 0x7fc2a4066a00
   7:| | | | | | | <mysqlnd_net::get_stream
   7:| | | | | | | >mysqlnd_net::network_read_ex
   8:| | | | | | | | info : count=4
   7:| | | | | | | <mysqlnd_net::network_read_ex
   7:| | | | | | | info : HEADER: prot_packet_no=3 size= 36
   6:| | | | | | <mysqlnd_read_header
   6:| | | | | | >mysqlnd_net::receive_ex
   6:| | | | | | <mysqlnd_net::receive_ex
   6:| | | | | | >mysqlnd_net::get_stream
   7:| | | | | | | info : 0x7fc2a4066a00
   6:| | | | | | <mysqlnd_net::get_stream
   6:| | | | | | >mysqlnd_net::network_read_ex
   7:| | | | | | | info : count=36
   6:| | | | | | <mysqlnd_net::network_read_ex
   6:| | | | | | >_mysqlnd_pemalloc
   6:| | | | | | <_mysqlnd_pemalloc
   6:| | | | | | info : allocing root. persistent=0
   6:| | | | | | info : FIELD=[.test.stock]
   5:| | | | | <php_mysqlnd_rset_field_read
   5:| | | | | info : PACKET_FREE(0x7fc2a4078288)
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   4:| | | | <mysqlnd_res_meta::read_metadata
   3:| | | <mysqlnd_res::read_result_metadata
   3:| | | >_mysqlnd_pecalloc
   3:| | | <_mysqlnd_pecalloc
   3:| | | >mysqlnd_protocol::get_eof_packet
   3:| | | <mysqlnd_protocol::get_eof_packet
   3:| | | >php_mysqlnd_eof_read
   4:| | | | info : buf=0x7fc2a406f008 size=4096
   4:| | | | >mysqlnd_read_header
   5:| | | | | info : compressed=0
   5:| | | | | >mysqlnd_net::receive_ex
   5:| | | | | <mysqlnd_net::receive_ex
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::network_read_ex
   6:| | | | | | info : count=4
   5:| | | | | <mysqlnd_net::network_read_ex
   5:| | | | | info : HEADER: prot_packet_no=4 size=  5
   4:| | | | <mysqlnd_read_header
   4:| | | | >mysqlnd_net::receive_ex
   4:| | | | <mysqlnd_net::receive_ex
   4:| | | | >mysqlnd_net::get_stream
   5:| | | | | info : 0x7fc2a4066a00
   4:| | | | <mysqlnd_net::get_stream
   4:| | | | >mysqlnd_net::network_read_ex
   5:| | | | | info : count=5
   4:| | | | <mysqlnd_net::network_read_ex
   4:| | | | info : EOF packet: fields=254 status=2 warnings=0
   3:| | | <php_mysqlnd_eof_read
   3:| | | info : warnings=0 server_status=2
   3:| | | info : PACKET_FREE(0x7fc2a4078288)
   3:| | | >_mysqlnd_pefree
   3:| | | <_mysqlnd_pefree
   3:| | | info : PACKET_FREE(0x7fc2a4071008)
   3:| | | >php_mysqlnd_rset_header_free_mem
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <php_mysqlnd_rset_header_free_mem
   3:| | | info : PASS
   2:| | <mysqlnd_query_read_result_set_header
   2:| | info : server_status=2 cursor=0
   2:| | info : no cursor
   2:| | info : use_result
   2:| | info : server_status=2 cursor=0
   2:| | info : PASS
   1:| <mysqlnd_stmt_execute_parse_response
   0:<mysqlnd_stmt::execute
   0:>mysqlnd_stmt::bind_result
   1:| info : stmt=1 field_count=2
   1:| >mysqlnd_stmt_separate_one_result_bind
   2:| | info : stmt=1 result_bind=0 field_count=2 param_no=0
   1:| <mysqlnd_stmt_separate_one_result_bind
   1:| >_mysqlnd_pecalloc
   1:| <_mysqlnd_pecalloc
   1:| info : PASS
   0:<mysqlnd_stmt::bind_result
   0:>mysqlnd_stmt::bind_result
   1:| info : stmt=1 field_count=2
   1:| >mysqlnd_stmt_separate_one_result_bind
   2:| | info : stmt=1 result_bind=0x7fc2a405f668 field_count=2 param_no=1
   1:| <mysqlnd_stmt_separate_one_result_bind
   1:| >_mysqlnd_perealloc
   1:| <_mysqlnd_perealloc
   1:| info : PASS
   0:<mysqlnd_stmt::bind_result
   0:>mysqlnd_stmt::result_metadata
   1:| info : stmt=1 field_count=2
   1:| >_mysqlnd_pecalloc
   1:| <_mysqlnd_pecalloc
   1:| >mysqlnd_result_init
   1:| <mysqlnd_result_init
   1:| >_mysqlnd_pecalloc
   1:| <_mysqlnd_pecalloc
   1:| >mysqlnd_result_unbuffered_init
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | >_mysqlnd_ecalloc
   2:| | <_mysqlnd_ecalloc
   2:| | >mysqlnd_mempool_create
   3:| | | >_mysqlnd_emalloc
   3:| | | <_mysqlnd_emalloc
   2:| | <mysqlnd_mempool_create
   1:| <mysqlnd_result_unbuffered_init
   1:| >mysqlnd_res_meta::clone_metadata
   2:| | info : persistent=0
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | >_mysqlnd_pemalloc
   2:| | <_mysqlnd_pemalloc
   2:| | >_mysqlnd_pemalloc
   2:| | <_mysqlnd_pemalloc
   2:| | >_mysqlnd_pemalloc
   2:| | <_mysqlnd_pemalloc
   1:| <mysqlnd_res_meta::clone_metadata
   1:| info : result=0x7fc2a406c308
   0:<mysqlnd_stmt::result_metadata
   0:>mysqlnd_res::fetch_fields
   0:<mysqlnd_res::fetch_fields
   0:>mysqlnd_res_meta::fetch_fields
   0:<mysqlnd_res_meta::fetch_fields
   0:>mysqlnd_stmt::store_result
   1:| info : stmt=1
   1:| >mysqlnd_conn_data::get_state
   1:| <mysqlnd_conn_data::get_state
   1:| >_mysqlnd_pecalloc
   1:| <_mysqlnd_pecalloc
   1:| >mysqlnd_result_buffered_zval_init
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | >_mysqlnd_ecalloc
   2:| | <_mysqlnd_ecalloc
   2:| | >mysqlnd_mempool_create
   3:| | | >_mysqlnd_emalloc
   3:| | | <_mysqlnd_emalloc
   2:| | <mysqlnd_mempool_create
   1:| <mysqlnd_result_buffered_zval_init
   1:| >mysqlnd_res::store_result_fetch_data
   2:| | >_mysqlnd_pemalloc
   2:| | <_mysqlnd_pemalloc
   2:| | >_mysqlnd_pecalloc
   2:| | <_mysqlnd_pecalloc
   2:| | >mysqlnd_protocol::get_row_packet
   2:| | <mysqlnd_protocol::get_row_packet
   2:| | >php_mysqlnd_rowp_read
   3:| | | >php_mysqlnd_read_row_ex
   4:| | | | >mysqlnd_read_header
   5:| | | | | info : compressed=0
   5:| | | | | >mysqlnd_net::receive_ex
   5:| | | | | <mysqlnd_net::receive_ex
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0x7fc2a4066a00
   5:| | | | | <mysqlnd_net::get_stream
   5:| | | | | >mysqlnd_net::network_read_ex
   6:| | | | | | info : count=4
   5:| | | | | <mysqlnd_net::network_read_ex
   5:| | | | | info : HEADER: prot_packet_no=5 size=  5
   4:| | | | <mysqlnd_read_header
   4:| | | | >mysqlnd_mempool_get_chunk
   5:| | | | | >_mysqlnd_emalloc
   5:| | | | | <_mysqlnd_emalloc
   4:| | | | <mysqlnd_mempool_get_chunk
   4:| | | | >mysqlnd_net::receive_ex
   4:| | | | <mysqlnd_net::receive_ex
   4:| | | | >mysqlnd_net::get_stream
   5:| | | | | info : 0x7fc2a4066a00
   4:| | | | <mysqlnd_net::get_stream
   4:| | | | >mysqlnd_net::network_read_ex
   5:| | | | | info : count=5
   4:| | | | <mysqlnd_net::network_read_ex
   3:| | | <php_mysqlnd_read_row_ex
   3:| | | info : server_status=2 warning_count=0
   2:| | <php_mysqlnd_rowp_read
   2:| | >_mysqlnd_perealloc
   2:| | <_mysqlnd_perealloc
   2:| | >mysqlnd_conn_data::set_state
   3:| | | info : New state=1
   2:| | <mysqlnd_conn_data::set_state
   2:| | info : ret=PASS row_count=0 warnings=0 server_status=2
   2:| | info : PACKET_FREE(0x7fc2a4071008)
   2:| | >php_mysqlnd_rowp_free_mem
   3:| | | >mysqlnd_mempool_free_chunk
   4:| | | | >_mysqlnd_efree
   4:| | | | <_mysqlnd_efree
   3:| | | <mysqlnd_mempool_free_chunk
   3:| | | info : stack_allocation=0 persistent=0
   3:| | | >_mysqlnd_pefree
   3:| | | <_mysqlnd_pefree
   2:| | <php_mysqlnd_rowp_free_mem
   2:| | info : rows=0
   1:| <mysqlnd_res::store_result_fetch_data
   0:<mysqlnd_stmt::store_result
   0:>mysqlnd_stmt::fetch
   1:| info : stmt=1
   1:| info : result_bind=0x7fc2a407d048 separated_once=0
   1:| >mysqlnd_stmt_fetch_row_buffered
   2:| | info : stmt=1
   2:| | info : no more data
   2:| | info : PASS
   1:| <mysqlnd_stmt_fetch_row_buffered
   0:<mysqlnd_stmt::fetch
   0:>mysqlnd_res::free_result
   1:| >mysqlnd_res::free_result_internal
   2:| | >mysqlnd_res::skip_result
   2:| | <mysqlnd_res::skip_result
   2:| | >mysqlnd_res::free_result_contents_internal
   3:| | | >mysqlnd_res::free_result_buffers
   4:| | | | info : unbuffered
   4:| | | | >mysqlnd_result_unbuffered, free_result
   5:| | | | | >mysqlnd_res::unbuffered_free_last_data
   6:| | | | | | info : field_count=2
   5:| | | | | <mysqlnd_res::unbuffered_free_last_data
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | >mysqlnd_mempool_destroy
   6:| | | | | | >_mysqlnd_efree
   6:| | | | | | <_mysqlnd_efree
   6:| | | | | | >_mysqlnd_efree
   6:| | | | | | <_mysqlnd_efree
   5:| | | | | <mysqlnd_mempool_destroy
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   4:| | | | <mysqlnd_result_unbuffered, free_result
   3:| | | <mysqlnd_res::free_result_buffers
   3:| | | >mysqlnd_res_meta::free
   4:| | | | info : persistent=0
   4:| | | | info : Freeing fields metadata
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   4:| | | | info : Freeing zend_hash_keys
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   4:| | | | info : Freeing metadata structure
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <mysqlnd_res_meta::free
   2:| | <mysqlnd_res::free_result_contents_internal
   2:| | >_mysqlnd_pefree
   2:| | <_mysqlnd_pefree
   1:| <mysqlnd_res::free_result_internal
   0:<mysqlnd_res::free_result
   0:>mysqlnd_stmt::dtor
   1:| info : stmt=0x7fc2a407d008
   1:| >mysqlnd_stmt::net_close
   2:| | info : stmt=1
   2:| | info : skipping result
   2:| | >mysqlnd_res::skip_result
   2:| | <mysqlnd_res::skip_result
   2:| | >mysqlnd_stmt::more_results
   2:| | <mysqlnd_stmt::more_results
   2:| | >mysqlnd_conn_data::get_state
   2:| | <mysqlnd_conn_data::get_state
   2:| | >mysqlnd_conn_data::simple_command
   3:| | | >mysqlnd_conn_data::simple_command_send_request
   4:| | | | info : command=STMT_CLOSE silent=0
   4:| | | | info : conn->server_status=2
   4:| | | | info : sending 5 bytes
   4:| | | | >mysqlnd_conn_data::get_state
   4:| | | | <mysqlnd_conn_data::get_state
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_protocol::get_command_packet
   4:| | | | <mysqlnd_protocol::get_command_packet
   4:| | | | >php_mysqlnd_cmd_write
   5:| | | | | >mysqlnd_net::send_ex
   6:| | | | | | info : count=5 compression=0
   6:| | | | | | info : to_be_sent=5
   6:| | | | | | info : packets_sent=1
   6:| | | | | | info : compressed_envelope_packet_no=0
   6:| | | | | | info : packet_no=0
   6:| | | | | | info : no compression
   6:| | | | | | >mysqlnd_net::network_write_ex
   7:| | | | | | | info : sending 9 bytes
   7:| | | | | | | >mysqlnd_net::get_stream
   8:| | | | | | | | info : 0x7fc2a4066a00
   7:| | | | | | | <mysqlnd_net::get_stream
   6:| | | | | | <mysqlnd_net::network_write_ex
   6:| | | | | | info : packet_size=0 packet_no=1
   5:| | | | | <mysqlnd_net::send_ex
   4:| | | | <php_mysqlnd_cmd_write
   4:| | | | info : PACKET_FREE(0x7fc2a405f6c8)
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <mysqlnd_conn_data::simple_command_send_request
   3:| | | info : PASS
   2:| | <mysqlnd_conn_data::simple_command
   2:| | >_mysqlnd_pefree
   2:| | <_mysqlnd_pefree
   2:| | >mysqlnd_stmt::free_stmt_content
   3:| | | info : stmt=1 param_bind=0 param_count=0
   3:| | | >mysqlnd_stmt::free_stmt_result
   4:| | | | >mysqlnd_stmt_separate_result_bind
   5:| | | | | info : stmt=1 result_bind=0x7fc2a405f668 field_count=2
   5:| | | | | info : 0 has refcount=0
   5:| | | | | info : 1 has refcount=0
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   4:| | | | <mysqlnd_stmt_separate_result_bind
   4:| | | | >mysqlnd_res::free_result_internal
   5:| | | | | >mysqlnd_res::skip_result
   5:| | | | | <mysqlnd_res::skip_result
   5:| | | | | >mysqlnd_res::free_result_contents_internal
   6:| | | | | | >mysqlnd_res::free_result_buffers
   7:| | | | | | | info : buffered
   7:| | | | | | | >mysqlnd_result_buffered::free_result
   8:| | | | | | | | info : Freeing 0 row(s)
   8:| | | | | | | | >mysqlnd_result_buffered_zval::free_result
   8:| | | | | | | | <mysqlnd_result_buffered_zval::free_result
   8:| | | | | | | | >_mysqlnd_pefree
   8:| | | | | | | | <_mysqlnd_pefree
   8:| | | | | | | | >_mysqlnd_pefree
   8:| | | | | | | | <_mysqlnd_pefree
   8:| | | | | | | | >mysqlnd_mempool_destroy
   9:| | | | | | | | | >_mysqlnd_efree
   9:| | | | | | | | | <_mysqlnd_efree
   9:| | | | | | | | | >_mysqlnd_efree
   9:| | | | | | | | | <_mysqlnd_efree
   8:| | | | | | | | <mysqlnd_mempool_destroy
   8:| | | | | | | | >_mysqlnd_pefree
   8:| | | | | | | | <_mysqlnd_pefree
   7:| | | | | | | <mysqlnd_result_buffered::free_result
   6:| | | | | | <mysqlnd_res::free_result_buffers
   6:| | | | | | >mysqlnd_res_meta::free
   7:| | | | | | | info : persistent=0
   7:| | | | | | | info : Freeing fields metadata
   7:| | | | | | | >_mysqlnd_pefree
   7:| | | | | | | <_mysqlnd_pefree
   7:| | | | | | | >_mysqlnd_pefree
   7:| | | | | | | <_mysqlnd_pefree
   7:| | | | | | | >_mysqlnd_pefree
   7:| | | | | | | <_mysqlnd_pefree
   7:| | | | | | | info : Freeing zend_hash_keys
   7:| | | | | | | >_mysqlnd_pefree
   7:| | | | | | | <_mysqlnd_pefree
   7:| | | | | | | info : Freeing metadata structure
   7:| | | | | | | >_mysqlnd_pefree
   7:| | | | | | | <_mysqlnd_pefree
   6:| | | | | | <mysqlnd_res_meta::free
   5:| | | | | <mysqlnd_res::free_result_contents_internal
   5:| | | | | >mysqlnd_conn_data::free_reference
   6:| | | | | | info : conn=285734 old_refcount=3
   5:| | | | | <mysqlnd_conn_data::free_reference
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   4:| | | | <mysqlnd_res::free_result_internal
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <mysqlnd_stmt::free_stmt_result
   2:| | <mysqlnd_stmt::free_stmt_content
   2:| | >mysqlnd_conn_data::free_reference
   3:| | | info : conn=285734 old_refcount=2
   2:| | <mysqlnd_conn_data::free_reference
   1:| <mysqlnd_stmt::net_close
   1:| >_mysqlnd_pefree
   1:| <_mysqlnd_pefree
   1:| >_mysqlnd_pefree
   1:| <_mysqlnd_pefree
   1:| info : PASS
   0:<mysqlnd_stmt::dtor
   0:>mysqlnd_conn_data::more_results
   0:<mysqlnd_conn_data::more_results
   0:>mysqlnd_conn::close
   1:| info : conn=285734
   1:| >mysqlnd_conn_data::local_tx_start
   1:| <mysqlnd_conn_data::local_tx_start
   1:| >mysqlnd_conn_data::get_state
   1:| <mysqlnd_conn_data::get_state
   1:| >mysqlnd_net::get_stream
   2:| | info : 0x7fc2a4066a00
   1:| <mysqlnd_net::get_stream
   1:| >mysqlnd_send_close
   2:| | info : conn=285734 net->data->stream->abstract=0x7fc2a405aa00
   2:| | >mysqlnd_conn_data::get_state
   2:| | <mysqlnd_conn_data::get_state
   2:| | >mysqlnd_conn_data::get_state
   2:| | <mysqlnd_conn_data::get_state
   2:| | info : state=1
   2:| | info : Connection clean, sending COM_QUIT
   2:| | >mysqlnd_conn_data::simple_command
   3:| | | >mysqlnd_conn_data::simple_command_send_request
   4:| | | | info : command=QUIT silent=1
   4:| | | | info : conn->server_status=2
   4:| | | | info : sending 1 bytes
   4:| | | | >mysqlnd_conn_data::get_state
   4:| | | | <mysqlnd_conn_data::get_state
   4:| | | | >_mysqlnd_pecalloc
   4:| | | | <_mysqlnd_pecalloc
   4:| | | | >mysqlnd_protocol::get_command_packet
   4:| | | | <mysqlnd_protocol::get_command_packet
   4:| | | | >php_mysqlnd_cmd_write
   5:| | | | | >mysqlnd_net::send_ex
   6:| | | | | | info : count=1 compression=0
   6:| | | | | | info : to_be_sent=1
   6:| | | | | | info : packets_sent=1
   6:| | | | | | info : compressed_envelope_packet_no=0
   6:| | | | | | info : packet_no=0
   6:| | | | | | info : no compression
   6:| | | | | | >mysqlnd_net::network_write_ex
   7:| | | | | | | info : sending 5 bytes
   7:| | | | | | | >mysqlnd_net::get_stream
   8:| | | | | | | | info : 0x7fc2a4066a00
   7:| | | | | | | <mysqlnd_net::get_stream
   6:| | | | | | <mysqlnd_net::network_write_ex
   6:| | | | | | info : packet_size=0 packet_no=1
   5:| | | | | <mysqlnd_net::send_ex
   4:| | | | <php_mysqlnd_cmd_write
   4:| | | | info : PACKET_FREE(0x7fc2a405f308)
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <mysqlnd_conn_data::simple_command_send_request
   3:| | | info : PASS
   2:| | <mysqlnd_conn_data::simple_command
   2:| | >mysqlnd_net::close_stream
   3:| | | >mysqlnd_net::get_stream
   4:| | | | info : 0x7fc2a4066a00
   3:| | | <mysqlnd_net::get_stream
   3:| | | info : Freeing stream. abstract=0x7fc2a405aa00
   3:| | | >mysqlnd_net::set_stream
   3:| | | <mysqlnd_net::set_stream
   2:| | <mysqlnd_net::close_stream
   2:| | >mysqlnd_conn_data::set_state
   3:| | | info : New state=6
   2:| | <mysqlnd_conn_data::set_state
   1:| <mysqlnd_send_close
   1:| >mysqlnd_conn_data::local_tx_end
   1:| <mysqlnd_conn_data::local_tx_end
   1:| >mysqlnd_conn::dtor
   2:| | info : conn=285734
   2:| | >mysqlnd_conn_data::free_reference
   3:| | | info : conn=285734 old_refcount=1
   3:| | | >mysqlnd_net::get_stream
   4:| | | | info : 0
   3:| | | <mysqlnd_net::get_stream
   3:| | | >mysqlnd_send_close
   4:| | | | info : conn=285734 net->data->stream->abstract=0
   4:| | | | >mysqlnd_conn_data::get_state
   4:| | | | <mysqlnd_conn_data::get_state
   4:| | | | >mysqlnd_conn_data::get_state
   4:| | | | <mysqlnd_conn_data::get_state
   4:| | | | info : state=6
   4:| | | | >mysqlnd_net::close_stream
   5:| | | | | >mysqlnd_net::get_stream
   6:| | | | | | info : 0
   5:| | | | | <mysqlnd_net::get_stream
   4:| | | | <mysqlnd_net::close_stream
   3:| | | <mysqlnd_send_close
   3:| | | >mysqlnd_conn_data::dtor
   4:| | | | info : conn=285734
   4:| | | | >mysqlnd_conn_data::free_contents
   5:| | | | | >mysqlnd_net::free_contents
   5:| | | | | <mysqlnd_net::free_contents
   5:| | | | | info : Freeing memory of members
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | info : scheme=tcp://10.80.90.30:4000
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   4:| | | | <mysqlnd_conn_data::free_contents
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   4:| | | | >mysqlnd_net_free
   5:| | | | | >mysqlnd_net::dtor
   6:| | | | | | >mysqlnd_net::free_contents
   6:| | | | | | <mysqlnd_net::free_contents
   6:| | | | | | >mysqlnd_net::close_stream
   7:| | | | | | | >mysqlnd_net::get_stream
   8:| | | | | | | | info : 0
   7:| | | | | | | <mysqlnd_net::get_stream
   6:| | | | | | <mysqlnd_net::close_stream
   6:| | | | | | info : Freeing cmd buffer
   6:| | | | | | >_mysqlnd_pefree
   6:| | | | | | <_mysqlnd_pefree
   6:| | | | | | >_mysqlnd_pefree
   6:| | | | | | <_mysqlnd_pefree
   6:| | | | | | >_mysqlnd_pefree
   6:| | | | | | <_mysqlnd_pefree
   5:| | | | | <mysqlnd_net::dtor
   4:| | | | <mysqlnd_net_free
   4:| | | | >mysqlnd_protocol_free
   5:| | | | | >_mysqlnd_pefree
   5:| | | | | <_mysqlnd_pefree
   4:| | | | <mysqlnd_protocol_free
   4:| | | | >_mysqlnd_pefree
   4:| | | | <_mysqlnd_pefree
   3:| | | <mysqlnd_conn_data::dtor
   2:| | <mysqlnd_conn_data::free_reference
   2:| | >_mysqlnd_pefree
   2:| | <_mysqlnd_pefree
   1:| <mysqlnd_conn::dtor
   0:<mysqlnd_conn::close
   0:>RSHUTDOWN
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