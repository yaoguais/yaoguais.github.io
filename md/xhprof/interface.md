## xhprof 输入输出接口 ##

由于这次是进行一次扩展升级，所以留给用户的接口最好不要发生变化。只要接口不变，xhprof_html或者其他的一些分析工具基本可以无修改移植了。

目录：

1. 输入接口
2. 输出接口

### 输入接口 ###

扩展提供的接口目前只有两个

	void xhprof_enable([int $flags=0 [, array $options]]);
	void xhprof_sample_enable(void);
	
	其中flags有以下的值
	XHPROF_FLAGS_NO_BUILTINS   0x0001	//不记录内置函数
	XHPROF_FLAGS_CPU           0x0002	//CPU使用情况
	XHPROF_FLAGS_MEMORY        0x0004	//内存使用情况

	options数组目前只有一个键值ignored_functions(需要忽略的函数列表)

	xhprof_sample_enable是采样的意思，具体时间与CPU的时钟频率相关，大概是0.1s。


### 输出接口 ###

扩展提供的输出接口同样有两个

	array xhprof_disable(void);
	array xhprof_sample_disable(void);

通过一个简单的例子`xhprof_sample_disable`获取的输出

	array (
	  '1429660621.200000' => 'main()==>sleep',
	  '1429660621.300000' => 'main()==>sleep',
	  '1429660621.400000' => 'main()==>sleep',
	  '1429660621.500000' => 'main()==>sleep',
	  '1429660621.600000' => 'main()==>sleep',
	  '1429660621.700000' => 'main()==>sleep',
	)

结合源码

	while ((cycle_timer() - hp_globals.last_sample_tsc)
	         > hp_globals.sampling_interval_tsc) {
	         > 
	    hp_globals.last_sample_tsc += hp_globals.sampling_interval_tsc;

	    incr_us_interval(&hp_globals.last_sample_time, XHPROF_SAMPLING_INTERVAL);

	    hp_sample_stack(entries  TSRMLS_CC);
	  }

我们可以看出其输出是每个0.1获取当前执行的函数，如此进行采样。

我们同样通过一个简单的例子获取`xhprof_enable`的输出

	array(
	    'main()==>sleep' =>
	        array(
	            'ct' => 2,
	            'wt' => 2001714,
	            'cpu' => 1000,
	            'mu' => 752,
	            'pmu' => 0,
	        ),
	    'main()==>xhprof_disable' =>
	        array(
	            'ct' => 1,
	            'wt' => 2,
	            'cpu' => 0,
	            'mu' => 760,
	            'pmu' => 0,
	        ),
	    'main()' =>
	        array(
	            'ct' => 1,
	            'wt' => 2001963,
	            'cpu' => 1000,
	            'mu' => 6232,
	            'pmu' => 0,
	        ),
	);

同样结合源码，我们可以得出其中的规律
	
	$data = array(
		'键'	=>	array(
			'ct' => 调用次数(number),
            'wt' => 挂钟时间(us),
            'cpu' => cpu时间(us),
            'mu' => 内存占用(bytes),
            'pmu' => 内存峰值(bytes),
		)
	)

	键：父函数()==>子函数()[@递归次数]

	函数名称大概有以下几种：
	1.run_init::文件名
	2.eval
	3.全局函数名
	4.类名::方法名

关于函数具体实现的细节，我们在后面的文章中继续分析。