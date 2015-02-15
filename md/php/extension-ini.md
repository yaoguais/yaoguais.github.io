## ini文件解析，php 扩展开发（二） ##

运行环境

- PHP Version 7.0.0-dev (`./configure  --prefix=/root/php7d --without-pear --enable-fpm --enable-debug`)
- Linux version 2.6.32-504.1.3.el6.x86_64 (gcc version 4.4.7 20120313 (Red Hat 4.4.7-11) (GCC) )
- swoole (1.7.8 stable for php extension)

前言：

我们都知道大多数扩展都有自己的配置项，那么它的怎么从配置文件中读取出来，又是怎么传给扩展自身的呢？今天就让我们一探究竟。

### 1.配置文件解析 ###

