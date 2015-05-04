## xhprof扩展实现的一些细节 ##

我们知道zend的一些内核调用都是函数指针，对函数指针进行一层包裹，就可以实现在调用前后做相关的记录，这个就是一些优化、缓存、诊断扩展实现的部分原理。

目录：

1. `xhprof_enable`执行流程
2. 回调函数系列
3. `hp_globals`全局变量
4. BEGIN_PROFILING 宏
5. END_PROFILING 宏
6. wall time 实现
7. cpu usage 实现
8. memory usage 实现


###	xhprof_enable执行流程 ###

首选载入扩展时会调用MINIT函数，在此函数中注册了三个常量(用户`xhprof_enable`的第一个参数)、获取CPU的数量、设置CPU亲和力、初始化`hp_globals`的一些字段。

请求来了，会执行RINIT函数，在此函数并没有任何实质代码。

解析脚本，发现调用了`xhprof_enable`函数，在此函数中首先根据第二参数注册忽略的函数列表，然后调用`hp_begin`启动诊断。

`hp_begin`中，首先替换了`zend_compile_file`、`zend_compile_string`、`zend_execute`等函数指针。
然后根据调用模式，设置了一些回调指针。添加"main()"到统计中去，等等。

接着执行用户的代码，回调我们设置的函数，进行信息统计。

接着执行脚本到`xhprof_disable`，调用`hp_stop`做一些收尾工作，然后返回`hp_globals.stats_count`这个数组。

脚本执行结束调用RSHUTDOWN,执行部分收尾工作，如重置某些变量。

最后执行MSHUTDOWN函数，释放申请的变量。

`xhprof_sample_enable`与上面的流程基本一致，只是函数回调时做的工作不同而已。

接下来分析我们设置的回调函数。




### 回调函数系列 ###


设置的内核回调主要有个四个：
	
- `hp_compile_file`主要以key(load::文件名)记录相关信息。
- `hp_compile_string`主要以key(eval::文件名)记录eval函数执行的相关信息。
- `hp_execute`或`hp_execute_ex`记录用户代码执行的相关信息。
- `hp_execute_internal`记录C函数执行的相关信息。


### `hp_globals`全局变量 ###

该变量是一个`hp_global_t`结构体，其定义如下：

	typedef struct hp_global_t {
	  /*当前是否启动，默认是0，调用xhprof_enable等后会设置成1*/
	  int              enabled;
	
	  /*保证该全局变量只被初始化一次，类似于单例模式的实现*/
	  int              ever_enabled;
	
	  /*保存每个函数执行的信息,xhprof_disable等的返回值*/
	  zval            *stats_count;
	
	  /*采样模式还是一般模式*/
	  int              profiler_level;
	
	  /*被记录函数栈的栈顶指针*/
	  hp_entry_t      *entries;
	
	  /*空闲hp_entry_t变量的栈顶指针*/
	  hp_entry_t      *entry_free_list;
	
	  /*回调函数函数的集合，每一个函数的实现形式类似于C++中的虚函数*/
	  hp_mode_cb       mode_cb;
	
	  /*       ----------   Mode specific attributes:  -----------       */
	
	  /*最后的采样时间*/
	  struct timeval   last_sample_time;//使用gettimeofday获取
	  uint64           last_sample_tsc;//使用cycle_timer获取
	  /*采样的时间间隔，微妙，默认是0.1s*/
	  uint64           sampling_interval_tsc;
	
	  /*cpu的频率*/
	  double *cpu_frequencies;
	
	  /*cpu的个数*/
	  uint32 cpu_num;
	
	  /*cpu亲和力的掩码*/
	  cpu_set_t prev_mask;
	
	  /*当前cpu的ID*/
	  uint32 cur_cpu_id;
	
	  /*当前执行的模式，xhprof的第一个参数值，决定是否记录cpu、内存等*/
	  uint32 xhprof_flags;
	
	  /*被记录函数的映射哈希表*/
	  uint8  func_hash_counters[256];
	
	  /*忽略的函数列表，xhprof_enable的第二个参数*/
	  char  **ignored_function_names;
	  uint8   ignored_function_filter[XHPROF_IGNORED_FUNCTION_FILTER_SIZE];
	
	} hp_global_t;




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


这个宏，首先在hash表中检测本次记录的函数是否是被设置的忽略的函数，如果是的话，就跳过下面的步骤。


然后快速分配一个`hp_entry_t`结构体，这个分配过程有点特别，并不是每次都emalloc。
其中`hp_globals.entries`是一个栈顶指针，而`hp_globals.entry_free_list`也是一个栈顶指针。当`hp_globals.entry_free_list`没有元素时，才分配内存。而当其有元素时，该栈就会出栈一个元素，而`hp_globals.entries`则入栈该元素。从而达到了快速分配的效果。

但是这样也有坏处，就是可能缓存栈上元素过多，占用更多的内存。这也是空间换时间的做法。

`hp_mode_common_beginfn`函数主要是添加本次函数调用的递归深度，其实现原理是从栈顶向栈底查找该函数已经被调用的次数，如果`name_hprof`相同的话，就说明已经调用了一次。最后还是利用了hash表的快速查找。

然后执行`begin_fn_cb`这个回调函数，在`xhprof_enable`模式下，这个指针指向的是`hp_mode_hier_beginfn_cb`这个函数，在此函数中，根据调试的需求，相应的记录函数的开始时间，内存占用，内存峰值等。

当被调试的函数执行完毕后，会调用`END_PROFILING`宏，进行计算，得出相应的结果，记录在`hp_globals.stats_count`中。

### END_PROFILING 宏 ###

END_PROFILING宏的定义如下：

	#define END_PROFILING(entries, profile_curr)                            \
	  do {                                                                  \
	    if (profile_curr) {                                                 \
	      hp_entry_t *cur_entry;                                            \
	      /* Call the mode's endfn callback. */                             \
	      /* NOTE(cjiang): we want to call this 'end_fn_cb' before */       \
	      /* 'hp_mode_common_endfn' to avoid including the time in */       \
	      /* 'hp_mode_common_endfn' in the profiling results.      */       \
	      hp_globals.mode_cb.end_fn_cb((entries) TSRMLS_CC);                \
	      cur_entry = (*(entries));                                         \
	      /* Call the universal callback */                                 \
	      hp_mode_common_endfn((entries), (cur_entry) TSRMLS_CC);           \
	      /* Free top entry and update entries linked list */               \
	      (*(entries)) = (*(entries))->prev_hprof;                          \
	      hp_fast_free_hprof_entry(cur_entry);                              \
	    }                                                                   \
	  } while (0)

在`xhprof_enable`下，`end_fn_cb`指向`hp_mode_hier_endfn_cb`函数,该函数调用`hp_mode_shared_endfn_cb`获取本次被记录函数的统计zval，并记录call count、wall time这两项内置指标。

然后根据配置，计算当前的CPU、内存等。对应的减去先前的CPU、内存，就得到了本次记录函数的执行相关信息。

所以，本扩展最关键的地方，就是这两个宏。

下面我们看看wall time、cpu、memory记录函数的实现。

### wall time 实现 ###

获取当前挂钟时间是通过xhprof的`cycle_timer`实现的，我们看看这个函数。

	inline uint64 cycle_timer() {
	  uint32 __a,__d;
	  uint64 val;
	  asm volatile("rdtsc" : "=a" (__a), "=d" (__d));
	  (val) = ((uint64)__a) | (((uint64)__d)<<32);
	  return val;
	}

通过[文章](http://blog.chinaunix.net/uid-24774106-id-2779245.html)，
我们可以知道这是C与汇编的结合，通过rdtsc指令获取当前挂钟时间。

rdtsc指令返回的是自开机始CPU的周期数，返回的是一个64位的值EDX：EAX（高32在EDX，低32位在EAX）。


### cpu usage 实现 ###

cpu的信息是通过getrusage函数实现的，这里有篇[讲解该函数的文章](http://blog.sina.com.cn/s/blog_8eee7fb60101lgm6.html)。

该函数用来获取用户开销时间，系统开销时间，接收的信号量等等。

其用法如下：

	#include <sys/types.h>
	#include <sys/time.h>
	#include <sys/resource.h>
	
	#define   RUSAGE_SELF     0
	#define   RUSAGE_CHILDREN     -1
	
	int getrusage(int who, struct rusage *usage); 
	//当调用成功后，返回0，否则-1；

	who：可能选择有
	    RUSAGE_SELF：获取当前进程的资源使用信息。以当前进程的相关信息来填充rusage(数据)结构
	    RUSAGE_CHILDREN：获取子进程的资源使用信息。rusage结构中的数据都将是当前进程的子进程的信息
	    usage：指向存放资源使用信息的结构指针。

	struct rusage {
	        struct timeval ru_utime; // user time used 
	        struct timeval ru_stime; // system time used 
	        long ru_maxrss; // maximum resident set size 
	        long ru_ixrss; // integral shared memory size
	        long ru_idrss; // integral unshared data size 
	        long ru_isrss; // integral unshared stack size 
	        long ru_minflt; // page reclaims 
	        long ru_majflt; // page faults 
	        long ru_nswap;// swaps
	        long ru_inblock; // block input operations 
	        long ru_oublock; // block output operations 
	        long ru_msgsnd; // messages sent 
	        long ru_msgrcv; //messages received 
	        long ru_nsignals; // signals received 
	        long ru_nvcsw; // voluntary context switches 
	        long ru_nivcsw; // involuntary context switches 
	};

	struct timeval
    {
    __time_t tv_sec;        /* Seconds. */
    __suseconds_t tv_usec;  /* Microseconds. */
    };


在xhprof中，有如下的代码：

	struct rusage    ru_end;
	getrusage(RUSAGE_SELF, &ru_end);
	hp_inc_count(counts, "cpu", (get_us_interval(&(top->ru_start_hprof.ru_utime),
                                              &(ru_end.ru_utime)) +
                              get_us_interval(&(top->ru_start_hprof.ru_stime),
                                              &(ru_end.ru_stime)))
	static long get_us_interval(struct timeval *start, struct timeval *end) {
	  return (((end->tv_sec - start->tv_sec) * 1000000)
	          + (end->tv_usec - start->tv_usec));
	}

从这里也可以看出xhprof中记录的是微妙(microsecond)。


### memory usage 实现 ###

内存信息分为占用内存与内存峰值两部分。

其中获取当前内存占用值使用的是`zend_memory_usage`函数。这个函数的实现如下：

	long int mu_end  = zend_memory_usage(0 TSRMLS_CC);

	ZEND_API size_t zend_memory_usage(int real_usage TSRMLS_DC)
	{
		if (real_usage) {
			return AG(mm_heap)->real_size;
		} else {
			size_t usage = AG(mm_heap)->size;
	#if ZEND_MM_CACHE
			usage -= AG(mm_heap)->cached;
	#endif
			return usage;
		}
	}

	# define AG(v) (alloc_globals.v)
	static zend_alloc_globals alloc_globals;

	struct _zend_mm_heap {
		int                 use_zend_alloc;
		void               *(*_malloc)(size_t);
		void                (*_free)(void*);
		void               *(*_realloc)(void*, size_t);
		size_t              free_bitmap;
		size_t              large_free_bitmap;
		size_t              block_size;
		size_t              compact_size;
		zend_mm_segment    *segments_list;
		zend_mm_storage    *storage;
		size_t              real_size;
		size_t              real_peak;
		size_t              limit;
		size_t              size;
		size_t              peak;
		size_t              reserve_size;
		void               *reserve;
		int                 overflow;
		int                 internal;
	#if ZEND_MM_CACHE
		unsigned int        cached;
		zend_mm_free_block *cache[ZEND_MM_NUM_BUCKETS];
	#endif
		zend_mm_free_block *free_buckets[ZEND_MM_NUM_BUCKETS*2];
		zend_mm_free_block *large_free_buckets[ZEND_MM_NUM_BUCKETS];
		zend_mm_free_block *rest_buckets[2];
		int                 rest_count;
	#if ZEND_MM_CACHE_STAT
		struct {
			int count;
			int max_count;
			int hit;
			int miss;
		} cache_stat[ZEND_MM_NUM_BUCKETS+1];
	#endif
	};

而获取峰值是通过`zend_memory_peak_usage`函数实现的，该函数的定义如下：

	long int pmu_end = zend_memory_peak_usage(0 TSRMLS_CC);

	ZEND_API size_t zend_memory_peak_usage(int real_usage TSRMLS_DC)
	{
		if (real_usage) {
			return AG(mm_heap)->real_peak;
		} else {
			return AG(mm_heap)->peak;
		}
	}

关于内存管理，我们可以参考鸟哥的几篇文章
[PHP原理之内存管理中难懂的几个点](http://www.laruence.com/2011/11/09/2277.html)、
[深入理解PHP内存管理之谁动了我的内存](http://www.laruence.com/2011/03/04/1894.html)。

从实现可以简单的猜测，`real_size`、size、`real_peak`,peak会在特定的情况下进行更新，比如内存分配、内存释放等。

关于内存分配，主要还是参考上面两篇文章，能力有限，就不妄加解读了。

