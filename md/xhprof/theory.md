## xhprof扩展实现的基本原理 ##

我们知道zend的一些内核调用都是函数指针，对函数指针进行一层包裹，就可以实现在调用前后做相关的记录，这个就是一些优化、缓存、诊断扩展实现的部分原理。

目录：

1. `xhprof_enable`执行流程
2. 回调函数系列
3. BEGIN_PROFILING 宏
4. END_PROFILING 宏


###	xhprof_enable执行流程 ###

首选载入扩展时会调用MINIT函数，在此函数中注册了三个常量(用户`xhprof_enable`的第一个参数)、获取CPU的数量、设置CPU亲和力、初始化`hp_globals`的一些字段。

请求来了，会执行RINIT函数，在此函数并没有任何实质代码。

解析脚本，发现调用了`xhprof_enable`函数，在此函数中首先根据第二参数注册忽略的函数列表，然后调用`hp_begin`启动诊断。

`hp_begin`中，首先替换了`zend_compile_file``zend_compile_string``zend_execute`等函数指针。
然后根据调用模式，设置了一些回调指针。添加"main()"到统计中去，等等。

接着执行用户的代码，回调我们设置的函数，进行信息统计。

接着执行脚本到`xhprof_disable`，调用`hp_stop`做一些收尾工作，然后返回`hp_globals.stats_count`这个数组。

脚本执行结束调用RSHUTDOWN,执行部分收尾工作，如重置某些变量。

最后执行MSHUTDOWN函数，释放申请的变量。

`xhprof_sample_enable`与上面的流程基本一致，只是函数回调时做的工作不同而已。

接下来我们重点分析我们设置的回调函数。




### 回调函数系列 ###


设置的内核回调主要有个三个：
	
- `hp_compile_file`主要以key(load::文件名)记录相关信息。
- `hp_compile_string`主要以key(eval::文件名)记录eval函数执行的相关信息。
- `hp_execute`或`hp_execute_ex`记录用户代码执行的相关信息。
- `hp_execute_internal`记录C函数执行的相关信息。




### BEGIN_PROFILING 宏 ###

在执行原始的内核回调前都是使用BEGIN_PROFILING宏进行相关的初始化操作。

	#define BEGIN_PROFILING(entries, symbol, profile_curr)                  \
	  do {                                                                  \
	    /* Use a hash code to filter most of the string comparisons. */     \
	    uint8 hash_code  = hp_inline_hash(symbol);                          \
	    profile_curr = !hp_ignore_entry(hash_code, symbol);                 \
	    if (profile_curr) {                                                 \
	      hp_entry_t *cur_entry = hp_fast_alloc_hprof_entry();              \
	      (cur_entry)->hash_code = hash_code;                               \
	      (cur_entry)->name_hprof = symbol;                                 \
	      (cur_entry)->prev_hprof = (*(entries));                           \
	      /* Call the universal callback */                                 \
	      hp_mode_common_beginfn((entries), (cur_entry) TSRMLS_CC);         \
	      /* Call the mode's beginfn callback */                            \
	      hp_globals.mode_cb.begin_fn_cb((entries), (cur_entry) TSRMLS_CC); \
	      /* Update entries linked list */                                  \
	      (*(entries)) = (cur_entry);                                       \
	    }                                                                   \
	  } while (0)




