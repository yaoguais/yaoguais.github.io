## PHP7简介 ##

1.关于PHP7的相关资源
2.PHP7简单的介绍

### 关于PHP7的相关资源 ###

进入wiki.php.net搜索phpng即可找到很多相关的介绍内容.

1.[php7介绍](https://wiki.php.net/phpng)

2.[php7实现的细节](https://wiki.php.net/phpng-int)

3.[怎样把扩展从php5升级到php7](https://wiki.php.net/phpng-upgrading)

4.[鸟哥的博客](http://www.laruence.com/)

### PHP7简单的介绍 ###

PHPNG即PHP7,其中的NG是Next Generation下一代的意思.这里有个[关于php7内容的讨论页面](https://wiki.php.net/ideas/php6),介绍了php7一些可能的特性.

1.OpCache integration(整合opcache),已经做了,是一个zend扩展,就叫做opcahce,在php.ini中配置好就可以使用了.

2.Improved and actual 64bit support(64位的支持)

3.Unicode support(unicode编码支持)

4.internals API Cleanup(核心API的整改)

5.Warning free code(提示无用代码),PHP目前是没有做代码优化的,做代码优化的第一个目标就是提示无用的代码,比如一个条件分支永远进不了,那么里面的代码肯定是无用的,这个在java的编辑器中就有提示的.

6.Improve OPcodes, compilation and runtime(优化opcode,编译与运行时),整体来说就是优化zend引擎对掉本的解释执行.

7.JIT compiler(即时编译支持)

8.HTTP2 support(HTTP2协议的支持)

9.Native Annotation Support(原生注释的支持),就是在方法前面加一些标签,然后就能实现某种功能,比如java中的@inject@test这些.

10.Getter/Setter,从RFC看到语法跟C#的比较类似.

11.Scalar type hinting and return typing,函数参数与返回值支持限定类型,这个已经在做了,但是可以配置是否使用.



