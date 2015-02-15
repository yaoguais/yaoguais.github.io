## php 扩展开发 ##

运行环境

- PHP Version 7.0.0-dev (`./configure  --prefix=/root/php7d --without-pear --enable-fpm --enable-debug`)
- Linux version 2.6.32-504.1.3.el6.x86_64 (gcc version 4.4.7 20120313 (Red Hat 4.4.7-11) (GCC) )

我们的函数很简单，就是将用户传入的字符串函数原样的输出出来。

### 第一步，生成扩展框架代码 ###

- ext_skel 简介
	
首先切换到PHP-SRC/ext目录下面(`PHP-SRC即php源代码的文件夹路径`)

通过ls我们可以查看到一个叫ext_skel(`skel就是骨骼骨架的意思`)

执行./ext_sekl --help可以查看简要的帮助

	./ext_skel --extname=module [--proto=file] [--stubs=file] [--xml[=file]]
	[--skel=dir] [--full-xml] [--no-help]
	
	--extname=module   module is the name of your extension
	--proto=file   file contains prototypes of functions to create /*通过这个文件我们创建函数的模板*/
	--stubs=file   generate only function stubs in file
	--xml  generate xml documentation to be added to phpdoc-svn
	--skel=dir path to the skeleton directory
	--full-xml generate xml documentation for a self-contained extension
	(not yet implemented)
	--no-help  don't try to be nice and create comments in the code
	and helper functions to test if the module compiled


通常来说，开发一个新扩展时，仅需关注的参数是 --extname 和 --no-help。除非已经熟悉扩展的结构，不要想去使用 --no-help; 指定此参数会造成 ext_skel 不会在生成的文件里省略很多有用的注释。

剩下的 --extname 会将扩展的名称传给 ext_skel。"name" 是一个全为小写字母的标识符，仅包含字母和下划线，在 PHP 发行包的 ext/ 文件夹下是唯一的。

--proto 选项允许开发人员指定一个头文件，由此创建一系列 PHP 函数，表面上看就是要开发基于一个函数库的扩展，但对大多数头现代的文件来说很少能起作用。如果用 zlib.h 头文件来做测试，就会导致在 ext_skel 的输出文件中存在大量的空的和无意义的原型文件。--xml 和 --full-xml 选项当前完全不起作用。--skel 选项可用于指定用一套修改过的框架文件来工作，这是本节范围之外的话题了。
(摘自[php.net](http://php.net/manual/zh/internals2.buildsys.skeleton.php))

- proto参数的使用

在PHP-SRC/ext/下创建一个echo.proto的文件，其内容为
	
	void my_echo(string str)

- 执行ext_skel

	./ext_skel --extname=echo --proto=echo.proto

它会自动创建一个名为"扩展名"的文件夹,里面包含了扩展的整个框架代码


### 第二步，修改编译配置文件 ###

	修改PHP-SRC/ext/echo/config.m4
	把10、11、12行的dnl 去掉 修改为下面的样子
	PHP_ARG_WITH(echo, for echo support,
	Make sure that the comment is aligned:
	[  --with-echo             Include echo support])
 
### 第三步，实现我们的函数 ###
	
编辑echo.c,找到PHP_FUNCTION(my_echo)，修改为下面的代码

	/* {{{ proto void my_echo(string str)
	    */
	PHP_FUNCTION(my_echo)
	{
	        char *str = NULL;
	        int argc = ZEND_NUM_ARGS();
	        size_t str_len;
	
	        if (zend_parse_parameters(argc TSRMLS_CC, "s", &str, &str_len) == FAILURE)
	                return;
	
	        printf("%s",str);
	
	        //php_error(E_WARNING, "my_echo: not yet implemented");
	}
	/* }}} */

### 第四步，编译插件 ###

	/root/php7d/bin/phpize
	./configure --with-php-config=/root/php7d/bin/php-config
	make && make install

其中/root/php7d是php的安装目录

执行完成之后，会自动把生成的.so文件拷贝进php的扩展目录，我这里是/root/php7d/lib/php/extensions/debug-non-zts-20141001
	
编辑php.ini文件（我的在/root/php7d/lib/php.ini）,在最后添加一下代码让php加载扩展

	[echo]
	extension = echo.so
	
	; Local Variables:
	; tab-width: 4
	; End:

通过执行php -m便可以查看加载的扩展了

### 第五步，测试函数 ###

通过执行PHP-SRC/ext/echo/echo.php文件可以检验扩展是否安装成功

	[root@localhost echo]# /root/php7d/bin/php ./echo.php
	Functions available in the test extension:
	confirm_echo_compiled
	my_echo
	
	Congratulations! You have successfully modified ext/echo/config.m4. Module echo is now compiled into PHP.

接着可以编写一些单元测试文件。到此，一个基本的扩展开发就完成了。