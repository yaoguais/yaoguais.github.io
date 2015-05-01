## xhprof 简介与环境搭建 ##

xhprof是Facebook的一款诊断PHP应用性能的扩展，拥有清晰明显的图表数据展示，可以方便快捷的帮助开发人员找到应用的性能瓶颈。

目录：

1. 编译安装
2. 使用范例
3. 字段分析
4. 相关软件

### 编译安装 ###

目前xhprof最新版本是0.9.4，适用于php5.2及以上的版本。我安装的是php5.4.40，xhprof0.9.2。

解压文件后可以看到基本的目录结构

	examples	//这里面有一个示例文件
	extension	//扩展的源码
	xhprof_html	//在浏览器中查看分析结果的web应用
	xhprof_lib	//一些公共的库文件

进入extension目录进行安装

	phpize
	./configure
	make && make install

编辑php.ini文件，在最后添加xhprof的配置。

	[xhprof]
	extension = xhprof.so
	xhprof.output_dir = /tmp/xhprof

到此整个配置完成

### 使用范例 ###

我们这里直接列出扩展自带的范例sample.php

	<?php
	
	function bar($x) {
	  if ($x > 0) {
	    bar($x - 1);
	  }
	}
	
	function foo() {
	  for ($idx = 0; $idx < 5; $idx++) {
	    bar($idx);
	    $x = strlen("abc");
	  }
	}
	
	// start profiling
	xhprof_enable();
	
	// run program
	foo();
	
	// stop profiler
	$xhprof_data = xhprof_disable();
	
	// display raw xhprof data for the profiler run
	print_r($xhprof_data);
	
	
	$XHPROF_ROOT = realpath(dirname(__FILE__) .'/..');
	include_once $XHPROF_ROOT . "/xhprof_lib/utils/xhprof_lib.php";
	include_once $XHPROF_ROOT . "/xhprof_lib/utils/xhprof_runs.php";
	
	// save raw data for this profiler run using default
	// implementation of iXHProfRuns.
	$xhprof_runs = new XHProfRuns_Default();
	
	// save the run under a namespace "xhprof_foo"
	$run_id = $xhprof_runs->save_run($xhprof_data, "xhprof_foo");
	
	echo "---------------\n".
	     "Assuming you have set up the http based UI for \n".
	     "XHProf at some address, you can view run at \n".
	     "http://<xhprof-ui-address>/index.php?run=$run_id&source=xhprof_foo\n".
	     "---------------\n";


一般我们的项目都有一个入口文件，在入口文件开始处加入

	xhprof_enable();

开启扩展的分析诊断模式。在文件结尾处加入

	$xhprof_data = xhprof_disable();

将诊断的结果保存到一个数组中去。还可以添加后面的代码将结果保存到一个文件中。还能使用xhprof_html在网页中进行分析。

最后贴[一篇最详尽的博客](http://www.cnblogs.com/wangtao_20/archive/2013/09/13/3320497.html)

### 字段分析 ###

	Calls		//调用次数
	inclusive	//包含子函数执行的时间
	exclusive	//函数本身执行的时间
	Wall Time	//挂钟时间，就是执行流逝的时间
	User Cpu Time	//用户CPU使用时间
	System Cpu Time	//内核CPU使用时间
	Cpu Time		//上面两个和
	Memory Usage	//内存使用值
	Peak Memory Usage	//内存使用峰值

### 相关软件 ###

类似的软件还有xDebug、phpTrace等。

