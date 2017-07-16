## PHP在TIDB上遇到的坑

原因不多说, 总之部署了两套TIDB的集群环境.

TIDB现在相当的火, 还去过很多次pingcap的在西小口的线下meepup, 各种牛人的分享.

今天主要是总结一些在tidb中遇到的坑, 有PHP的, 也有TIDB的, 但是可能是自己坑自己的.

主要问题如下:

- 自增ID
- 事务提交
- prepare语句

可以先了解下[TIDB与MYSQL的差异](https://pingcap.com/doc-mysql-compatibility-zh)


目录:

1. 自增ID
2. 事务提交
3. prepare语句
4. 总结




### 自增ID

TIDB的自增ID不是按照时间增序的, 那么按照时间进行分页的需求就比较坑了.

比如有2台TIDB, t1 和 t2,

那么ID 1-5000 在t1, 5001-10000 在t2,
10001-15000又在t1, 15001-20000在t2.

如果新增两条纪录, 它们的ID会是1, 5001.

解决办法是在每张表新增一个字段, 然后到发号器去取一下这个ID.

而表的ID, TIDB建议使用UUID, 而不使用TIDB的自增ID.

个人觉得, 在要满足业务的条件是用UUID+发号器.

比如一个简单的实现为:

以表名在redis保存一个key, 每新增一条纪录, 使用incr命令取一下ID, 插入到表中.




### 事务提交

具体问题是PDO的commit()函数始终返回true, 所以会导致业务判断失误.

分析的文章在这里,
[PHP的PDO-commit函数在tidb上返回值错误的分析](https://yaoguais.github.io/article/php/tidb-pdo-commit.html)

解决办法是使用rawSql, 其php模版如下:

```
$options = $options = [
    PDO::ATTR_CASE => PDO::CASE_NATURAL,
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_ORACLE_NULLS => PDO::NULL_NATURAL,
    PDO::ATTR_STRINGIFY_FETCHES => false,
    PDO::ATTR_EMULATE_PREPARES => true,
];
$pdo = new PDO('', '', '', $options);
$pdo->exec('START TRANSACTION'); // will throw an exception if failed
try {
    // SQLs
    // ...
    $pdo->exec('COMMIT'); // will throw an exception
} catch (Exception $e) {
    $ret = $pdo->exec('ROLLBACK');
    throw $e;
} catch (Throwable $e) {
    $ret = $pdo->exec('ROLLBACK');
    throw $e;
}
```

而且commit()函数在返回true后, 虽然事实事务是失败的, 但是也没有设置errorCode,

所以办法只有使用rawSql.




### prepare语句

用PDO的可能会使用prepare语句, 但是在TIDB中遇到的一个问题就是,

用prepare语句查出来的纪录有时会比理论的少几条.

具体的问题我也给TIDB提了一个[issue](https://github.com/pingcap/tidb/issues/3712).


解决办法就是将prepare语句转换成rawSql, 这个PHP已经帮我们做了,

用法如下:

```
$options = $options = [
    PDO::ATTR_EMULATE_PREPARES => true,
];
$pdo = new PDO('', '', '', $options);
```

[摘自PHP手册 - PDO::setAttribute](http://php.net/manual/zh/pdo.setattribute.php)
```
PDO::ATTR_EMULATE_PREPARES 启用或禁用预处理语句的模拟。
有些驱动不支持或有限度地支持本地预处理。
使用此设置强制PDO总是模拟预处理语句（如果为 TRUE ），
或试着使用本地预处理语句（如果为 FALSE）。
如果驱动不能成功预处理当前查询，
它将总是回到模拟预处理语句上。
需要 bool 类型。
```




### 总结

虽然在TIDB听了他们开发者讲了很多细节,

但是离真正用好TIDB还有很长的一段距离.

目前遇到的问题, 都可以使用各种方式"解决",

但是或多或少都没有达到不修改代码直接迁移到TIDB的地步,

后续有什么其他的问题, 我也会一并整理到这篇文章.

