## PHP7简介 ##

目录:

1. 关于PHP7的相关资源
2. PHP7简单的介绍
3. PHP7性能压测




### 关于PHP7的相关资源 ###

进入wiki.php.net搜索phpng即可找到很多相关的介绍内容.

- [php7介绍](https://wiki.php.net/phpng)
- [php7实现的细节](https://wiki.php.net/phpng-int)
- [怎样把扩展从php5升级到php7](https://wiki.php.net/phpng-upgrading)
- [鸟哥的博客](http://www.laruence.com/)


### PHP7简单的介绍 ###

PHPNG即PHP7,其中的NG是Next Generation下一代的意思.

这里有个[关于php7内容的讨论页面](https://wiki.php.net/ideas/php6),介绍了php7一些可能的特性.

1.OpCache integration(整合opcache),已经做了,是一个zend扩展,就叫做opcahce,在php.ini中配置好就可以使用了.

2.Improved and actual 64bit support(64位的支持)

3.Unicode support(unicode编码支持)

4.internals API Cleanup(核心API的整改)

5.Warning free code(提示无用代码),PHP目前是没有做代码优化的,做代码优化的第一个目标就是提示无用的代码,比如一个条件分支永远进不了,那么里面的代码肯定是无用的,这个在java的编辑器中就有提示的.

6.Improve OPcodes, compilation and runtime(优化opcode,编译与运行时),整体来说就是优化zend引擎对脚本的解释执行.

7.JIT compiler(即时编译支持)

8.HTTP2 support(HTTP2协议的支持)

9.Native Annotation Support(原生注释的支持),就是在方法前面加一些标签,然后就能实现某种功能,比如java中的@inject@test这些.

10.Getter/Setter,从RFC看到语法跟C#的比较类似.

11.Scalar type hinting and return typing,函数参数与返回值支持限定类型,这个已经在做了,但是可以配置是否使用.



### PHP7性能压测 ###

性能肯定是比较出来的，PHP7比较php5在某些压测数据下提交了3以上.而最多的比较应该是php7 vs hhvm，中国用php两大阵营应该就是百度贴吧与新浪微博了，贴吧直接转成hhvm了.这里贴出鸟哥的压测数据,结果显示性能基本差不多,php7在这个条件下还有一点小优.

[php7 vs hhvm](http://www.laruence.com/2014/12/18/2976.html)

结论,

- PHP7 – 258.22 QPS
- HHVM – 230.97 QPS

考虑到HHVM的运维复杂度, 他是多线程模型, 这就代表着如果一个线程导致crash了, 那么整个服务就挂了, 并且它不会自动重启

另外它采用JIT, 那么意味着, 重启以后要预热, 没有预热的情况下, 性能较为糟糕

并且多线程模型调试困难, 这对于追求稳定来说的Web服务来说, 是非常不适合的.

那么, PHP7性能提升以后, 我们还有什么理由要用HHVM么?

最后, PHP7将会在明年10月发布正式版, 我相信我们还会让它更快, 大家拭目以待吧