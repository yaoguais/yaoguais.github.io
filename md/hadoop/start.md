## 海量数据处理之Hadoop配置使用

现在很多大公司都有海量的数据,而有些数据是不需要改变的,所有诞生了HDFS这种"一次写入多次读取"的文件系统.
加上对这些海量数据的分析,MapReduce也就产生了.
今天我们要做的就是配置一个简单的Hadoop集群,并完成小小的计算.

目录:

1. 海量数据知识体系
    - 基础组件
    - 组件归类
    - 组件对比
    - 常见组合
    - 一些思考
2. 配置Hadoop
3. 简单应用
4. 总结





### 海量数据知识体系

今天主要做的事情是部署实践Hadoop,但是我们也要知道为什么要做这件事,它解决的是怎样的应用场景,什么样的应用场景它是直接解决不了的.





### 基础组件

在回答前面的问题之前,我们先梳理一下当前关于海量数据火热的名词.

[Hadoop](http://hadoop.apache.org/)官方介绍说,它是一个可靠的,可扩展的,分布式计算开源程序.

它主要包括4个组件:

- Hadoop Common: 用作支持其他模块的公共工具.
- Hadoop Distributed File System (HDFS): 高吞吐量的分布式文件系统.
- Hadoop YARN: 任务安排及资源管理的框架.
- Hadoop MapReduce: 基于YARN的并行数据处理系统.

跟hadoop相关的系统大概有以下这些:

Ambari: 管理Hadoop生态圈的系统,包括安装部署等,[详细介绍](https://www.ibm.com/developerworks/cn/opensource/os-cn-bigdata-ambari/).

Avro: 数据序列化与反序列化的工具,[这里](http://langyu.iteye.com/blog/708568)有说明为什么要为hadoop重新开发这样的序列化工具.

Cassandra: 支持BigTable(巨大的数据表)的数据库,特点是去中心化.[简单介绍](http://yikebocai.com/2014/06/cassandra-principle/).

Chuwa: 数据采集系统,可以自动采集数据并存入hadoop中,[系统介绍](https://www.ibm.com/developerworks/cn/opensource/os-cn-chukwa/).

HBase: 支持BigTable的分布式数据库,[简单介绍](http://fangjian0423.github.io/2015/08/07/hbase-intro/).

Hive: 基于Hadoop的数据仓库工具,用来查询和管理分布式存储系统上的大数据集,并提供类似与SQL的HiveQL的查询语句,
[参见这里](http://fangjian0423.github.io/2015/07/31/hive-intro/).

Mahout: 机器学习与数据挖掘的库,[使用介绍](https://www.ibm.com/developerworks/cn/java/j-mahout/).

Pig: 为Hadoop应用提供了一种更加接近SQL的接口,[介绍](https://www.ibm.com/developerworks/cn/linux/l-apachepigdataquery/).

Spark: 大数据处理框架,包括数据传输转化/机器学习/流式处理/图像处理等.[参见](http://www.infoq.com/cn/articles/apache-spark-introduction).

Tez: 基于YARN的计算框架,可以将多个依赖的任务转换成一个任务,从而提高性能.[参见](http://www.infoq.com/cn/articles/apache-tez-saha-murthy).

ZooKeeper: 分布式应用的协调系统,[参见](https://www.ibm.com/developerworks/cn/opensource/os-cn-zookeeper/).





### 组建归类

然后我们对上面这些系统做个归类:

* 文件系统: 大文件(HDFS, GFS, KFS), 小文件(TFS, Tencent FS, Haystack, BFS), 中小文件(FastDFS)
* 数据库: 数据表型(Cassandra, HBase), 文档型(Mongodb, SequoiaDB)
* 管理工具: Ambari, Cloudera
* 协调工具: ZooKeeper, Consul
* 序列化工具: Avro, Thrift
* 任务分发: YARN
* 处理采集: Chuwa
* 数据处理: Hive, Pig, Spark, Tez





### 组件对比

* [bilibili 小文件系统BFS](http://weibo.com/ttarticle/p/show?id=2309403963119645890778)
* [选择怎样的linux文件系统作为底层文件系统](http://blog.chinaunix.net/uid-9460004-id-3294714.html)
* [各分布式文件系统的优劣](http://www.nosqlnotes.net/archives/119)
* [分布式数据库性能测试](http://www.csdn.net/article/2014-09-16/2821707-benchmark-test-of-mongodb-sequoiadb-hbase-cassandra)
* [协调系统CONSUL, ZOOKEEPER, DOOZERD, ETCD对比](https://www.consul.io/intro/vs/zookeeper.html)
* [Apache Avro 与 Thrift 比较](http://blog.csdn.net/fenglibing/article/details/6859802)





### 常见组合

* [HDFS+MapReduce+Hbase+Hive](http://www.csdn.net/article/2014-02-17/2818431-HDFS+MapReduce+Hbase)
* [HDFS+YARN+MapReduce](http://www.ibm.com/developerworks/cn/data/library/bd-yarn-intro/)





### 一些思考

我们再了解下别人[对海量数据的思考](http://blog.csdn.net/yczws1/article/category/1770499).
