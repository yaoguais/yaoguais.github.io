## jemalloc源码分析之分析工具

出于对计算机怎么管理内存的好奇, 然后开始了jemalloc的分析.
这几篇文章主要从如何使用分析工具, jemalloc中的数据结构, jemalloc实现细节三方面进行分析.



目录:

1. 简介
2. 实现原理
3. 开始调试
4. 总结




### 简介

jemalloc同malloc一样, 是一种内存管理的实现.

如果使用gcc编译软件, 默认使用的是glic实现的ptmalloc算法. 而同样的算法有google的C++实现tcmalloc算法,
而今天我们分析的是facebook使用C语言实现的jemalloc算法.

tcmalloc同jemalloc一样都是对多线程多核友好的分配算法, 被各种语言借鉴来实现自身的内存管理.




### 实现原理

如果使用C语言进行内存分配, 我们会调用malloc函数, 而jemalloc就是通过malloc的hook机制实现的.

[如何实现自定义的malloc函数](http://stackoverflow.com/questions/262439/create-a-wrapper-function-for-malloc-and-free-in-c)
这篇文章有介绍如何覆盖或重写默认的malloc函数.

[GNU基于hook机制实现自定义的的malloc函数](http://www.gnu.org/savannah-checkouts/gnu/libc/manual/html_node/Hooks-for-Malloc.html),
具体就是通过覆盖\_\_malloc\_hook函数指针来实现的.

在jemalloc中我们能找到类似的代码:

jemalloc.c:1830

    /*
     * Begin non-standard override functions.
     */

    #ifdef JEMALLOC_OVERRIDE_MEMALIGN
    JEMALLOC_EXPORT JEMALLOC_ALLOCATOR JEMALLOC_RESTRICT_RETURN
    void JEMALLOC_NOTHROW *
    JEMALLOC_ATTR(malloc)
    je_memalign(size_t alignment, size_t size)
    {
    	void *ret JEMALLOC_CC_SILENCE_INIT(NULL);
    	if (unlikely(imemalign(&ret, alignment, size, 1) != 0))
    		ret = NULL;
    	return (ret);
    }
    #endif

    #ifdef JEMALLOC_OVERRIDE_VALLOC
    JEMALLOC_EXPORT JEMALLOC_ALLOCATOR JEMALLOC_RESTRICT_RETURN
    void JEMALLOC_NOTHROW *
    JEMALLOC_ATTR(malloc)
    je_valloc(size_t size)
    {
    	void *ret JEMALLOC_CC_SILENCE_INIT(NULL);
    	if (unlikely(imemalign(&ret, PAGE, size, 1) != 0))
    		ret = NULL;
    	return (ret);
    }
    #endif

    /*
     * is_malloc(je_malloc) is some macro magic to detect if jemalloc_defs.h has
     * #define je_malloc malloc
     */
    #define	malloc_is_malloc 1
    #define	is_malloc_(a) malloc_is_ ## a
    #define	is_malloc(a) is_malloc_(a)

    #if ((is_malloc(je_malloc) == 1) && defined(JEMALLOC_GLIBC_MALLOC_HOOK))
    /*
     * glibc provides the RTLD_DEEPBIND flag for dlopen which can make it possible
     * to inconsistently reference libc's malloc(3)-compatible functions
     * (https://bugzilla.mozilla.org/show_bug.cgi?id=493541).
     *
     * These definitions interpose hooks in glibc.  The functions are actually
     * passed an extra argument for the caller return address, which will be
     * ignored.
     */
    JEMALLOC_EXPORT void (*__free_hook)(void *ptr) = je_free;
    JEMALLOC_EXPORT void *(*__malloc_hook)(size_t size) = je_malloc;
    JEMALLOC_EXPORT void *(*__realloc_hook)(void *ptr, size_t size) = je_realloc;
    # ifdef JEMALLOC_GLIBC_MEMALIGN_HOOK
    JEMALLOC_EXPORT void *(*__memalign_hook)(size_t alignment, size_t size) =
        je_memalign;
    # endif
    #endif

    /*
     * End non-standard override functions.
     */


如果我们在自己的函数调用malloc就会被je_malloc拦截. 例如下面的例子:

    int main(){
        void * ptr = malloc(10);
        free(ptr);
        return 0;
    }

整个过程是

    -> main
    -> malloc -> je_malloc(mmap等系统调用分配内存) -> malloc结束
    -> free -> jeje_free(munmap等系统调用释放内存) -> free结束
    -> main结束

上面是当我们程序调用malloc函数时执行的过程, 实际上在jemalloc载入的时候, 就已经进行了一些初始化操作.

具体是在jemalloc_constructor函数.

jemalloc.c:2576

    #ifndef JEMALLOC_JET
    JEMALLOC_ATTR(constructor)
    static void
    jemalloc_constructor(void)
    {

    	malloc_init();
    }
    #endif

    jemalloc_macros.h.in:67
    #  define JEMALLOC_ATTR(s) __attribute__((s))

通过这篇文章
[如何在共享库载入时进行初始化操作](http://stackoverflow.com/questions/1681145/how-to-initialize-a-shared-library-on-linux)
知道这是gcc的一个特性.

后面我们将结合"call graph"调用图分别分析这两个过程.




### 开始调试


这节主要介绍下载编译jemalloc, 编写测试代码, 使用callgrind生成调用图, 使用gdb调试jemalloc.

jemalloc当前托管在github上

    git clone git@github.com:jemalloc/jemalloc.git
    ./autogen.sh
    ./configure --enable-debug
    make dist
    make
    make install

然后使用ide添加jemalloc项目, 主要作用是方便查看源代码, 在gdb中查看源代码实在不太方便, 而且gdb-tui虽然提供了可视化界面,
但是偶尔会出现花屏的情况.

这中间可能因为doc文档找不到的原因安装失败, 根据[issue231](https://github.com/jemalloc/jemalloc/issues/231),
将最后两步换成

    make && make install_bin install_include install_lib

即可.


然后编写我们的调试代码:

a.c文件:

    #include <stdio.h>
    #include <stdlib.h>
    #include <malloc.h>

    int func_long_name_a();
    int func_long_name_b();
    int func_long_name_c();

    int func_long_name_a(){
    	printf("func_long_name_a called\n");
    	func_long_name_b();
    	return 0;
    }

    int func_long_name_b(){
    	printf("func_long_name_b called\n");
    	func_long_name_c();
    	return 0;
    }

    int func_long_name_c(){
    	printf("func_long_name_c called\n");
    	int sizeArr[] = {1, 4095, 4096, 8192, 8193, 4*1024*1024, 10*1024*1024};
    	int i;
    	for(i = 0; i < 7; ++i){
    		void * p = malloc(sizeArr[i]);
    		free(p);
    	}

    	return 0;
    }

    int main(int argc, char ** argv)
    {
    	printf("main called\n");
    	func_long_name_a();
    	func_long_name_c();
    	printf("main exit\n");
    	return 0;
    }



然后编写一个脚本来实现编译及调用图的生成

gen.sh文件

    #!/bin/bash

    JEMALLOC_PATH=/usr/local
    gcc -g -ljemalloc -o a -I${JEMALLOC_PATH}/include -L${JEMALLOC_PATH}/lib a.c
    valgrind --tool=callgrind ./a
    gprof2dot -f callgrind -n 0 callgrind.out.* | dot -Tsvg -o a.svg
    date=`date '+%Y%m%d%H%i%s'`
    mv a.svg "$(date '+%Y-%m-%d_%H:%M:%S').svg"
    #rm -f callgrind.out.* .DS_Store a a.out
    rm -f callgrind.out.* .DS_Store a.out
    echo
    ls -al .

中间需要安装一些特别的软件, 比如valgrind, gprof2dot, dot等, 这些都可以在网上找到相应的安装方法.

最后生成我们的[jemalloc_call_graph.svg](/images/jemalloc_call_graph.svg)调用图文件.



在gen.sh中我们并没有删除可执行文件"a", 下面我就使用gdb来调试该文件.

    # gdb a
    # b jemalloc_constructor
    # b src/jemalloc.c:1443
    # b src/jemalloc.c:1811
    # r

其中jemalloc_constructor是jemalloc共享库载入时的入口.

src/jemalloc.c:1443是je_malloc函数实现的地方.

src/jemalloc.c:1811是je_free函数实现的地方.

可根据自己的jemalloc版本找到两个函数的行数做出调整.

执行r后, gdb就停在了jemalloc_constructor函数处.

关于gdb的使用, 也很多, 这里也有[关于gdb可视化界面gdb-tui的使用](http://mingxinglai.com/cn/2013/07/gdbtui/).

其中在tui模式和传统模式切换的快捷键是ctrl+x接ctrl+a.




### 总结

这篇文章主要介绍了如何调试jemalloc, 是分析jemalloc的准备工作, 也是分析其他开源c程序的普遍方法.

首先使用valgrind+dot打印函数调用图, 找到函数执行的流程.
然后分析基础的数据结构与其附属的操作, 快速明白各种变量会有怎样的转换.
最后顺着调用图, 分析各个函数的实现, 以及各种结构体之间的关系.
至此, 所有的源代码几乎查看完毕, 一个软件也分析完毕.

