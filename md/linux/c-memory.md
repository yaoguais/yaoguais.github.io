## c语言函数与变量的内存布局 ##

今天突然想知道C中函数是怎么在内存中分布的，虽然肯定是听过或看过结论的，但是还是想自己亲手试试，一探究竟！

目录：

1. 测试的源代码
2. 测试的汇编代码
3. gdb中的汇编代码
4. 调试程序
5. 总结



### 测试的源代码 ###

测试的文件比较简单，写了一个sum函数，计算3个参数的和并返回。

test.c:

	#include <stdio.h>
	
	int sum(int x,int y,int z){
		int sum = x + y + z;
		return sum;
	}
	
	int main(int argc,char ** argv){
		int x,y;
		x = sum(1,2,3);
		y = sum(4,5,6);
		return 0;
	}



### 测试的汇编代码 ###

使用gcc -S test.c，会自动在当前目录下生成test.s文件，其内容如下：

注：这里只是贴出文件内容，但是其对后面的分析并没有什么作用。分析使用的是整理后的汇编代码。

		.file	"test.c"
		.text
		.globl	sum
		.type	sum, @function
	sum:
	.LFB0:
		.cfi_startproc
		pushq	%rbp
		.cfi_def_cfa_offset 16
		.cfi_offset 6, -16
		movq	%rsp, %rbp
		.cfi_def_cfa_register 6
		movl	%edi, -20(%rbp)
		movl	%esi, -24(%rbp)
		movl	%edx, -28(%rbp)
		movl	-24(%rbp), %eax
		movl	-20(%rbp), %edx
		addl	%eax, %edx
		movl	-28(%rbp), %eax
		addl	%edx, %eax
		movl	%eax, -4(%rbp)
		movl	-4(%rbp), %eax
		popq	%rbp
		.cfi_def_cfa 7, 8
		ret
		.cfi_endproc
	.LFE0:
		.size	sum, .-sum
		.globl	main
		.type	main, @function
	main:
	.LFB1:
		.cfi_startproc
		pushq	%rbp
		.cfi_def_cfa_offset 16
		.cfi_offset 6, -16
		movq	%rsp, %rbp
		.cfi_def_cfa_register 6
		subq	$32, %rsp
		movl	%edi, -20(%rbp)
		movq	%rsi, -32(%rbp)
		movl	$3, %edx
		movl	$2, %esi
		movl	$1, %edi
		call	sum
		movl	%eax, -8(%rbp)
		movl	$6, %edx
		movl	$5, %esi
		movl	$4, %edi
		call	sum
		movl	%eax, -4(%rbp)
		movl	$0, %eax
		leave
		.cfi_def_cfa 7, 8
		ret
		.cfi_endproc
	.LFE1:
		.size	main, .-main
		.ident	"GCC: (Ubuntu 4.8.2-19ubuntu1) 4.8.2"
		.section	.note.GNU-stack,"",@progbits





### gdb中的汇编代码 ###

使用gcc test.c，生成a.out文件。然后gdb a.out进行调试，通过b main,b sum,disassemble等命令。可以得到main,sum函数的汇编代码。

整理后如下：


	Dump of assembler code for function main:
	   0x000000000040050f <+0>:	push   %rbp
	   0x0000000000400510 <+1>:	mov    %rsp,%rbp
	   0x0000000000400513 <+4>:	sub    $0x20,%rsp
	   0x0000000000400517 <+8>:	mov    %edi,-0x14(%rbp)
	   0x000000000040051a <+11>:	mov    %rsi,-0x20(%rbp)
	   0x000000000040051e <+15>:	mov    $0x3,%edx
	   0x0000000000400523 <+20>:	mov    $0x2,%esi
	   0x0000000000400528 <+25>:	mov    $0x1,%edi
	   0x000000000040052d <+30>:	callq  0x4004ed <sum>
	   0x0000000000400532 <+35>:	mov    %eax,-0x8(%rbp)
	   0x0000000000400535 <+38>:	mov    $0x6,%edx
	   0x000000000040053a <+43>:	mov    $0x5,%esi
	   0x000000000040053f <+48>:	mov    $0x4,%edi
	   0x0000000000400544 <+53>:	callq  0x4004ed <sum>
	   0x0000000000400549 <+58>:	mov    %eax,-0x4(%rbp)
	   0x000000000040054c <+61>:	mov    $0x0,%eax
	   0x0000000000400551 <+66>:	leaveq 
	   0x0000000000400552 <+67>:	retq
	End of assembler dump.
	
	Dump of assembler code for function sum:
	   0x00000000004004ed <+0>:	push   %rbp
	   0x00000000004004ee <+1>:	mov    %rsp,%rbp
	   0x00000000004004f1 <+4>:	mov    %edi,-0x14(%rbp)
	   0x00000000004004f4 <+7>:	mov    %esi,-0x18(%rbp)
	   0x00000000004004f7 <+10>:	mov    %edx,-0x1c(%rbp)
	   0x00000000004004fa <+13>:	mov    -0x18(%rbp),%eax
	   0x00000000004004fd <+16>:	mov    -0x14(%rbp),%edx
	   0x0000000000400500 <+19>:	add    %eax,%edx
	   0x0000000000400502 <+21>:	mov    -0x1c(%rbp),%eax
	   0x0000000000400505 <+24>:	add    %edx,%eax
	   0x0000000000400507 <+26>:	mov    %eax,-0x4(%rbp)
	   0x000000000040050a <+29>:	mov    -0x4(%rbp),%eax
	   0x000000000040050d <+32>:	pop    %rbp
	   0x000000000040050e <+33>:	retq   
	End of assembler dump.

从上面可以看出，整个程序的入口地址应该是0x000000000040050f(如果b main的话,会停在0x0000000000400513)。






### 调试程序 ###
	
下面使用gdb调试a.out可执行文件：(中间可能有部分内容就直接省略了，这个都是我事后整理的)

	(gdb) b *0x000000000040050f
	Breakpoint 1 at 0x40050f
	(gdb) run
	Starting program: /home/yaoguai/c/a.out
	(gdb) p $rsp
	$1 = (void *) 0x7fffffffe388
	(gdb) ni
	0x0000000000400510 in main ()
	(gdb) p $rsp
	$2 = (void *) 0x7fffffffe380	;执行push以后，%rsp减到8。这里跟网上减少4不一样，我的机子是64位的。
	(gdb) ni
	0x0000000000400513 in main ()	;执行完mov %rsp,%rbp后，两个寄存器内容一致。
	(gdb) p $rsp
	$3 = (void *) 0x7fffffffe380
	(gdb) p $rbp
	$4 = (void *) 0x7fffffffe380
	(gdb) ni
	0x0000000000400517 in main ()
	(gdb) p $rsp
	$5 = (void *) 0x7fffffffe360	;执行%rsi,-0x20(%rbp)，大概是给局部变量等分配内存

进入sum函数前一步：
	
	(gdb) ni
	0x000000000040052d in main ()	;进入sum函数前，查看两寄存器内容
	(gdb) p $rsp
	$9 = (void *) 0x7fffffffe360
	(gdb) 
	(gdb) p $rbp
	$11 = (void *) 0x7fffffffe380

刚好进入sum函数：

	(gdb) si
	0x00000000004004ed in sum ()
	(gdb) p $rsp
	$13 = (void *) 0x7fffffffe358	;这里为什么减2还有待研究
	(gdb) p $rbp
	$14 = (void *) 0x7fffffffe380	;未发生改变

	0x00000000004004f1 in sum ()
	(gdb) p $rsp
	$18 = (void *) 0x7fffffffe350	;执行push后减8
	(gdb) p $rbp
	$19 = (void *) 0x7fffffffe350	;%rsp赋值给%rbp

在main中，把三个实参的值存到了三个寄存器中，在sum函数中又从寄存器中读出，并拷贝到内存空间中。

	(gdb) ni
	0x00000000004004f7 in sum ()
	(gdb) x/32x $rbp
	0x7fffffffe350:	0xffffe380	0x00007fff	0x00400532	0x00000000
	(gdb) x/4x $rbp-0x20
	0x7fffffffe330:	0xf7ffe1c8	0x00000003	0x00000002	0x00000001

因为x=1,y=2,z=3。

	main中					sum中
	
	mov    $0x3,%edx		mov    %edx,-0x1c(%rbp)
	mov    $0x2,%esi		mov    %esi,-0x18(%rbp)
	mov    $0x1,%edi		mov    %edi,-0x14(%rbp)

我们知道，在操作系统中，高地址空间是内核代码，低地址是用户空间。结合dump的信息，我们可以画出下面的图来表示当前的内存结构。

	kernel space
	...........
	
	0x7fffffffe378				0x00000006;main函数中x的值
	0x7fffffffe37c				0x0000000c;main函数中y的值	
	0x7fffffffe380				;第一次在main函数中%rbp的值

	0x7fffffffe358				0x0000000000400532	;sum中%rbp的值,也是main中call sum下一条指令的地址。
	0x7fffffffe350 				0x00007fffffffe380	;上一次%rbp的地址
	0x7fffffffe34c				0x00000006			;sum函数中sum的值
	
	0x7fffffffe330				0xf7ffe1c8	0x00000003	0x00000002	0x00000001;存放xyz的形参值
	...........
	;main函数的代码,从下往上看
	0x0000000000400552 <+67>:	retq
	0x0000000000400551 <+66>:	leaveq
	...
	0x000000000040052d <+30>:	callq  0x4004ed <sum>
	0x0000000000400528 <+25>:	mov    $0x1,%edi
	0x0000000000400523 <+20>:	mov    $0x2,%esi
	0x000000000040051e <+15>:	mov    $0x3,%edx
	0x000000000040050f <+0>:	push   %rbp
	..........
	；第一次sum求和的情况
	0x000000000040050e <+33>:	retq   
	0x000000000040050d <+32>:	pop    %rbp
	...
	0x00000000004004f7 <+10>:	mov    %edx,-0x1c(%rbp)	；z $0x03	0x7fffffffe334
	0x00000000004004f4 <+7>:	mov    %esi,-0x18(%rbp)	；y $0x02	0x7fffffffe338
	0x00000000004004f1 <+4>:	mov    %edi,-0x14(%rbp)	；x $0x01	0x7fffffffe33c
	0x00000000004004ee <+1>:	mov    %rsp,%rbp
	0x00000000004004ed <+0>:	push   %rbp

从上面我们可以看出，main函数通过寄存器传参给sum函数，sum函数中从寄存器读到栈空间，然后进行计算，将结果保存到%eax中。然后main函数再从%eax中读入。而%rbp中存放上一次%rbp的值，其前八个字节存放的是主调函数调用完子函数后即将执行的指令的地址。


### 总结 ###

- 函数参数可以通过寄存器传参
- 函数参数并不一定是从右向左入栈，查阅资料得知还与编译器有关
- 基址寄存器中，存放的是上一次该寄存器的值
- 基址寄存器前八字节，是主调函数的下一条指令地址

[扩展阅读：LINUX下目标文件的BSS段、数据段、代码段 ](http://blog.chinaunix.net/uid-27018250-id-3867588.html)

- 代码编译后的机器指令经常被放在代码段里，代码段名为".text";
- 已初始化的全局变量和已初始化的局部静态变量经常放在数据段里，数据段名为".data";
- 未初始化的全局变量和未初始化局部静态变量一般放在“.bss”段里，.bss在文件中不占据空间。
- 字符串常量一般放在“.rodata”段里。

