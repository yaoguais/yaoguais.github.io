## 准备工作

目录：

1. 编译PHP
2. 编译Swoole
3. 安装CLion
4. 安装GDB
5. 测试脚本
6. 调试脚本

### 编译PHP

主要是以开启PHP的debug模式,在gdb调试的时候可以跟踪到PHP源代码的具体行数.


	tar -zvxf php-5.6.19.tar.gz
	mv php-5.6.19 /workspace/projects/php
	cd /workspace/projects/php
	./configure --prefix=/root/php5d --enable-debug
	make && make install
	cp php.ini-development /root/php5d/lib/php.ini


### 编译Swoole

	wget http://pecl.php.net/get/swoole-1.8.3.tgz
	tar -zvxf swoole-1.8.3.tgz
	mv swoole-src-swoole-1.8.3-stable /workspace/projects/swoole
	cd /workspace/projects/swoole
	/root/php5d/bin/phpize
	./configure --with-php-config=/root/php5d/bin/php-config
	make && make install
	echo "extension=swoole.so" >> /root/php5d/lib/php.ini
	/root/php5d/bin/php -m | grep swoole


### 安装CLion

CLion是JetBrains出的一款开发C/C++的IDE，是Storm系统之一。
安装之后，选择从文件夹添加项目，选择projects/swoole。
然后编辑项目根目录下面的CMakeLists.txt,添加PHP的include路径。


	INCLUDE_DIRECTORIES(BEFORE ./include ./ /workspace/projects/php)


添加之后点击右上角的"Reload changes",提交更新。至此，IDE安装完成。

### 安装GDB

安装GDB很简单,直接yum安装即可.比较重的是拷贝.gdbinit这个文件到你的用户目录下面，这里面是PHP用gdb进行调试的一些常用函数。


	yum -y install gdb
	cp /workspace/projects/php/.gdbinit ~/



### 测试脚本

测试脚本也比较简单，在各个回调函数中打印一行代码即可.在收到消息的时候,将消息转发给Task,
然后Task再将这条消息Echo给客户端.


	/root/test.php
	<?php
	$serv = new swoole_server("127.0.0.1", 9501);
	$serv->set(array(
	    'worker_num' => 2,
	    'task_worker_num' => 2
	));
	function my_onStart($serv){
		echo "onStart\n";	
	}
	function my_onShutdown($serv){
		echo "onShutdown\n";
	}
	function my_onTimer($serv, $interval){
		echo "onTimer\n";
	}
	function my_onClose($serv, $fd, $from_id){
		echo "onClose\n";
	}
	function my_onWorkerStart($serv, $worker_id){
		echo "onWorkerStart\n";
	}
	function my_onFinish(swoole_server $serv, $task_id, $from_worker_id, $data){
		echo "onFinish\n";
	}
	function my_onWorkerStop($serv, $worker_id){
		echo "onStop\n";
	}
	function my_onConnect($serv, $fd, $from_id)
	{
		echo "Client: fd=$fd is connect.\n";
	}
	function my_onReceive(swoole_server $serv, $fd, $from_id, $data){
		echo "Client: fd=$fd pid: " . posix_getpid() . " send: $data";
		$serv->task($fd . '|' . $data);
	}
	function my_onTask(swoole_server $serv, $task_id, $from_id, $data){
		list($fd, $recv) = explode('|', $data, 2);
		$serv->send(intval($fd), $recv);
		echo "Task: fd=$fd pid: " . posix_getpid() ." send: $recv";
	}
	function my_onWorkerError(swoole_server $serv, $worker_id, $worker_pid, $exit_code){
	    echo "worker abnormal exit. WorkerId=$worker_id|Pid=$worker_pid|ExitCode=$exit_code\n";
	}
	$serv->on('Start', 'my_onStart');
	$serv->on('Connect', 'my_onConnect');
	$serv->on('Receive', 'my_onReceive');
	$serv->on('Close', 'my_onClose');
	$serv->on('Shutdown', 'my_onShutdown');
	$serv->on('Timer', 'my_onTimer');
	$serv->on('WorkerStart', 'my_onWorkerStart');
	$serv->on('WorkerStop', 'my_onWorkerStop');
	$serv->on('Task', 'my_onTask');
	$serv->on('Finish', 'my_onFinish');
	$serv->on('WorkerError', 'my_onWorkerError');
	$serv->start();


### 调试脚本

这里主要在Swoole扩展的几个函数处打断点。包括


	#define ZEND_MODULE_STARTUP_N(module)       zm_startup_##module
	#define ZEND_MODULE_SHUTDOWN_N(module)		zm_shutdown_##module
	#define ZEND_MODULE_ACTIVATE_N(module)		zm_activate_##module
	#define ZEND_MODULE_DEACTIVATE_N(module)	zm_deactivate_##module
	#define ZEND_MODULE_POST_ZEND_DEACTIVATE_N(module)	zm_post_zend_deactivate_##module
	#define ZEND_MODULE_INFO_N(module)			zm_info_##module
	#define ZEND_MODULE_GLOBALS_CTOR_N(module)  zm_globals_ctor_##module
	#define ZEND_MODULE_GLOBALS_DTOR_N(module)  zm_globals_dtor_##module

	即zm_startup_swoole系列函数。然后包括swoole_server::start()方法,对应到Swoole扩展中，
	即PHP_METHOD(swoole_server, start)，展开即zim_swoole_server_start()函数。

	这个IDE还不是很习惯用,在eclipse中能直接显示宏展开，这里只能去PHP项目根目录搜索"#define PHP_METHOD"。

然后启动gdb调试脚本.


	# cd /root
	# ls -al test.php
	# gdb /root/php5d/bin/php
	(gdb) set args /root/test.php
	(gdb) b zm_startup_swoole
	(gdb) b zm_shutdown_swoole
	(gdb) b zm_activate_swoole
	(gdb) b zm_deactivate_swoole
	(gdb) b zm_post_zend_deactivate_swoole
	(gdb) b zm_info_swoole
	(gdb) b zm_globals_ctor_swoole
	(gdb) b zm_globals_dtor_swoole
	(gdb) b zim_swoole_server_start
	(gdb) info b
	(gdb) r
	当前停在了zm_startup_swoole函数处,即Swoole扩展的MINIT函数。
	GDB常用的几个操作命令:
	s step 类似于Step Into, 跳进函数.
	n next 类似于Step Over, 一步一步执行，遇见函数，不进入函数.
	f finish 类似于Step Out,忽略剩下的函数代码，结束当前的函数.
	c continue 略过后面的代码,直接跳到下一个断点处.
	l list 显示当前行周围的代码.
	p print 打印变量.
	call 调用函数,可以是gdb的函数,也可以是C代码中的函数.
	
