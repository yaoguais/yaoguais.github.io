## Shell 简介与使用 ##

工作中难免会使用一些shell脚本进行自动化管理，今天就简单的总结下shell的使用。

目录：

1. shell 的简单介绍
2. shell 脚本的一般格式
3. shell 脚本的执行
4. 一个简单的例子
5. 卷标与运算符号：declare
6. shell 的输入输出
7. 逻辑判断与比较运算符
8. 条件式判断 if
9. 条件式判断 case
10. 循环语句 for((;;))、for in、while、until
11. 自定义函数
12. 如何 debug shell
13. 结语




### shell 的简单介绍 ###

部分摘自[Linux Shell编程入门](http://www.cnblogs.com/suyang/archive/2008/05/18/1201990.html)、
[鸟哥的认识与学习 BASH ](http://vbird.dic.ksu.edu.tw/linux_basic/0320bash.php)、
[鸟哥的学习 shell scripts](http://vbird.dic.ksu.edu.tw/linux_basic/Mandrake9.0/0340bashshell-scripts.php)

从程序员的角度来看， Shell本身是一种用C语言编写的程序，从用户的角度来看，Shell是用户与Linux操作系统沟通的桥梁。用户既可以输入命令执行，又可以利用 Shell脚本编程，完成更加复杂的操作。在Linux GUI日益完善的今天，在系统管理等领域，Shell编程仍然起着不可忽视的作用。深入地了解和熟练地掌握Shell编程，是每一个Linux用户的必修 功课之一。 

Linux的Shell种类众多，常见的有：Bourne Shell（/usr/bin/sh或/bin/sh）、Bourne Again Shell（/bin/bash）、C Shell（/usr/bin/csh）、K Shell（/usr/bin/ksh）、Shell for Root（/sbin/sh），等等。不同的Shell语言的语法有所不同，所以不能交换使用。每种Shell都有其特色之处，基本上，掌握其中任何一种 就足够了。在本文中，我们关注的重点是Bash，也就是Bourne Again Shell，由于易用和免费，Bash在日常工作中被广泛使用；同时，Bash也是大多数Linux系统默认的Shell。在一般情况下，人们并不区分 Bourne Shell和Bourne Again Shell，所以，在下面的文字中，我们可以看到#!/bin/sh，它同样也可以改为#!/bin/bash。 




### shell 脚本的一般格式 ###

利用vi等文本编辑器编写Shell脚本的格式是固定的，如下：

	#!/bin/sh	
	#comments	
	Your commands go here

首行中的符号#!告诉系统其后路径所指定的程序即是解释此脚本文件的Shell程序。如果首行没有这句话，在执行脚本文件的时候，将会出现错误。后续的部分就是主程序，Shell脚本像高级语言一样，也有变量赋值，也有控制语句。除第一行外，以#开头的行就是注释行，直到此行的结束。如果一行未完成，可以在行尾加上"，这个符号表明下一行与此行会合并为同一行。 



### shell 脚本的执行 ###

编辑完毕，将脚本存盘为filename.sh，文件名后缀sh表明这是一个Bash脚本文件。执行脚本的时候，要先将脚本文件的属性改为可执行的：

	chmod +x filename.sh

执行脚本的方法是：

	./filename.sh

使用 "sh 文件名" 也可以执行shell程序。



### 一个简单的例子 ###

这个例子很简单，就是在屏幕上打印"Hello ! How are you ?"。

	#!/bin/bash                        <==在 # 之后加上 ! 与 shell 的名称，用来宣告使用的 shell
	# 这个脚本的用途在于列出 Hello ! How are you 在屏幕上
	# 建檔日期： 2002/05/20
	# Made by VBird
	hello=Hello\ \!\ How\ are\ you\ \?      <==这就是变量啦！
	echo $hello

下面这个例子，用来区别单引号与双引号的。这个跟php中的效果是一样的。

	[root @test test]# vi test02-2var.sh
	#!/bin/bash 
	# 这个脚本用途在于引用两个变量，顺便比较一下 " 与 ' 的异同
	# Date: 2002/06/27
	# Made by VBird
	name="V.Bird"
	myname1="My name is $name"
	myname2='My name is $name'
	echo $name
	echo $myname1
	echo $myname2
	
	[root @test test]# sh test02-2var.sh
	V.Bird
	My name is V.Bird
	My name is $name



### 卷标与运算符号：declare ###

declare 这个用作声明变量的类型，跟SQL Server的存储过程类似。shell中变量的类型默认是字符型的，我们可以通过下面的例子看出。

	[root @test test]# a=3
	[root @test test]# b=5
	[root @test test]# c=$a*$b
	[root @test test]# echo $c
	3*5  <==糟糕！怎么变成了字符串了？！

declare的用法如下：

	[test @test test]# declare [-afirx]
	参数说明：
	-a  ：定义为数组 array
	-f  ：定义为函数 function 
	-i  ：定义为整数 integer
	-r  ：定义为『只读』
	-x  ：定义为透过环境输出变量
	范例：
	[test @test test]# declare -i a=3
	[test @test test]# declare -i b=5
	[test @test test]# declare -i c=$a*$b
	[test @test test]# echo $c
	15  <==变成数字啰！ ^_^





### shell 的输入输出 ###

输出在前面就用到很多次了，就是echo $name

而输入的话，用的是read命令，它的作用跟c中的scanf类似，将用户输入保存到某个变量。

	[root @test test]# vi test04-read.sh
	#!/bin/bash
	# This program is used to "read" variables
	# VBird 2002/06/27
	echo "Please keyin your name, and press Enter to start."
	read name
	echo "This is your keyin data ==> $name"
	[root @test test]# sh test04-read.sh
	Please keyin your name, and press Enter to start.
	VBird Tsai
	This is your keyin data ==> VBird Tsai

而命令行参数的读入，是保存在$0等变量中的。

	myscript opt1 opt2 opt3 opt4
    $0 : myscript 亦即是 script 的檔名
    $1 : opt1 亦即是第一个附加的参数 (parameter)
    $2 : opt2
    $3 : opt3

	$$ : Shell本身的PID（ProcessID） 
	$! : Shell最后运行的后台Process的PID 
	$? : 最后运行的命令的结束代码（返回值） 
	$- : 使用Set命令设定的Flag一览 
	$* : 所有参数列表。如"$*"用「"」括起来的情况、以"$1 $2 … $n"的形式输出所有参数。 
	$@ : 所有参数列表。如"$@"用「"」括起来的情况、以"$1" "$2" … "$n" 的形式输出所有参数。 
	$# : 添加到Shell的参数个数 
	$0 : Shell本身的文件名 
	$1～$n : 添加到Shell的各参数值。$1是第1参数、$2是第2参数…。



### 逻辑判断与比较运算符 ###

shell中逻辑表达式多而复杂，分为很多种类型，下面一一列举。

###### 逻辑判断式一：关于档案与目录的侦测逻辑卷标！ ######

	-f	常用！侦测『档案』是否存在
	-d	常用！侦测『目录』是否存在
	-b	侦测是否为一个『 block 档案』
	-c	侦测是否为一个『 character 档案』
	-S	侦测是否为一个『 socket 标签档案』
	-L	侦测是否为一个『 symbolic link 的档案』
	-e	侦测『某个东西』是否存在！

###### 逻辑判断式二：关于程序的逻辑卷标！ ######

	-G	侦测是否由 GID 所执行的程序所拥有
	-O	侦测是否由 UID 所执行的程序所拥有
	-p	侦测是否为程序间传送信息的 name pipe 或是 FIFO

###### 逻辑判断式三：关于档案的属性侦测！ ######

	-r	侦测是否为可读的属性
	-w	侦测是否为可以写入的属性
	-x	侦测是否为可执行的属性
	-s	侦测是否为『非空白档案』
	-u	侦测是否具有『 SUID 』的属性
	-g	侦测是否具有『 SGID 』的属性
	-k	侦测是否具有『 sticky bit 』的属性

###### 逻辑判断式四：两个档案之间的判断与比较 ；例如『 test file1 -nt file2 』 ######

	-nt	第一个档案比第二个档案新
	-ot	第一个档案比第二个档案旧
	-ef	第一个档案与第二个档案为同一个档案（ link 之类的档案）

###### 逻辑判断式五：逻辑的『与(and)』『或(or)』！ ######

	&&	逻辑的 AND 的意思
	||	逻辑的 OR 的意思


###### 比较运算符 ######

	=	等于
	!=	不等于
	<	小于
	>   大于
	-eq	等于
	-ne	不等于
	-lt	小于
	-gt	大于
	-le	小于或等于
	-ge	大于或等于
	-a	双方都成立（and）
	-o	单方成立（or）
	-z	空字符串
	-n	非空字符串

接下面是控制流程，一般的控制流程就是顺序、条件、循环。顺序就不用说了。



### 条件式判断 if ###

if主要有两种，一种只有一个条件判断，另一种是有多个条件判断。

一：if then fi 的方式
二：if ... then .... else if .... then ... end if

下面举个例子：

	if [ 条件判断一 ] && (||) [ 条件判断二 ]; then       <== if 是起始的意思，后面可以接若干个判断式，使用 && 或 ||
	    执行内容程序
	elif [ 条件判断三 ] && (||) [ 条件判断四 ]; then     <==第二段的判断，如果第一段没有符合就来此搜寻条件
	    执行第二段内容程序
	else                                            <==当前两段都不符合时，就以这段内容来执行！
	    执行第三段内容程序
	fi                                              <==结束 if then 的条件判断！

不过，这里有几个新手常犯的错误，我们需要来加强说明一下：

- 在 [ ] 当中，只能有一个判别式；
- 在 [ ] 与 [ ] 当中，可以使用 && 或 || 来组织判别式；
- 每一个独立的组件之间『都需要有空格键来隔开』！

尤其是最后一点，最容易犯的错啦！好了，我们来进行一个简单的判别式好了！ 





### 条件式判断 case ###

shell中的case跟c中的switch-case类似。

	case 种类方式(string) in          <==开始阶段，那个种类方式可分成两种类型，通常使用 $1 这一种直接下达类型！
	    种类方式一)
	       程序执行段
	       ;;                     <==种类方式一的结束符号！
	    种类方式二)
	       程序执行段
	       ;;
	    *)
	       echo "Usage: {种类方式一|种类方式二}"     <==列出可以利用的参数值！
	       exit 1
	esac                         <==这个 case 的设定结束处！

下面是一个具体的例子：

	[root @test test]# vi test10-case.sh
	#!/bin/bash
	# program:      Using case mode
	# Made by:      VBird
	# date:         2002/06/27
	# content:      I will use this program to study the case mode!
	# 1. print this program
	echo "Press your select one, two, three"
	read number
	
	case $number in
	  one)
	        echo "your choice is one"
	        ;;
	  two)
	        echo "your choice is two"
	        ;;
	  three)
	        echo "your choice is three"
	        ;;
	  *)
	        echo "Usage {one|two|three}"
	        exit 1
	esac
	[root @test test]# sh test10-case.sh
	Press your select one, two, three
	two   <=这一行是您输入的呦！
	your choice is two





### 循环语句 for((;;))、for in、while、until ###

这几种循环的意思跟其他语言是一致的，就不再解释了。只需要明白其写法就OK了，直接上例子。

**for((;;))**

	[test @test test]# vi test11-loop.sh
	#!/bin/bash
	# Using for and loop
	# VBird 2002/06/27
	declare -i s  # <==变量宣告
	for (( i=1; i<=100; i=i+1 ))
	do
	        s=s+i
	done
	echo "The count is ==> $s"
	
	[test @test test]# sh test11-loop.sh
	The count is ==> 5050


**while**

	[test @test test]# vi test12-loop.sh
	#!/bin/bash
	# Using while and loop
	# VBird 2002/06/27
	declare -i i
	declare -i s
	while [ "$i" != "101" ]
	do
	        s=s+i
	        i=i+1
	done
	echo "The count is ==> $s"


**until**

	[test @test test]# vi test13-loop.sh
	#!/bin/bash
	# Using until and loop
	# VBird 2002/06/27
	declare -i i
	declare -i s
	until [ "$i" = "101" ]
	do
	        s=s+i
	        i=i+1
	done
	echo "The count is ==> $s"
	
	[test @test test]# sh test12-loop.sh
	The count is ==> 5050

**for in**

	[test @test test]# vi test14-for.sh
	#!/bin/bash
	# using for...do ....done
	# VBird 2002/06/27
	
	LIST="Tomy Jony Mary Geoge"
	
	for i in $LIST
	do
	        echo $i
	done
	
	[test @test test]# sh test5.sh
	Tomy
	Jony
	Mary
	Geoge

上面的 $LIST 这个变量当中，以空格键来分隔的时候，共可以分离出来四个！所以当以 do ..... done ... 就可以分别打印四个变量。

for in的类型较多，[这里贴一篇讲解for in的文章](http://blog.csdn.net/hainan16/article/details/6667483)，
总结下面大概有这么几种：

- 用空格分开的单个字符串
- 字符串数组-如 for i in a b c
- 字符串数组-利用``或$()合成的，如for i in $(ls *.txt)



### 自定义函数 ###

自定义函数主要有以下几个方面：
- 函数定义的格式
- 函数相关变量作用域
- 函数的作用域

[有参考这篇文章](http://www.cnblogs.com/chengmo/archive/2010/10/17/1853356.html)

函数的定义如下：

	[ function ] funname [()]
	{
	    action;
	    [return int;]
	}

说明：

1. 可以带function fun()  定义，也可以直接fun() 定义,不带任何参数。
2. 参数返回，可以显示加：return 返回，如果不加，将以最后一条命令运行结果，作为返回值。 return后跟数值n(0-255)
3. 必须在调用函数地方之前，声明函数，shell脚本是逐行运行。不会像其它语言一样先预编译。一次必须在使用函数前先声明函数。
4. shell中函数看作新的命令，因此各个输入参数直接用空格分隔。参数可以通过：$0…$n得到。 $0代表函数本身。 
5. 函数返回值，只能通过$? 系统变量获得。直接通过=,获得是空值。


函数相关变量作用域：

	#!/bin/sh

	declare num=1000;
	 
	uname()
	{
	    echo "test!";
	    ((num++));
	    return 100;
	}
	testvar()
	{
	    local num=10;
	    ((num++));
	    echo $num;
	 
	}
	 
	uname;
	echo $?
	echo $num;
	testvar;
	echo $num;
	                                     
	sh testfun2.sh
	test!
	100
	1001
	11
	1001

从上面可以看出：

- 在函数外面申请的变量是全局变量
- 在函数内用local申明的变量是局部变量


函数的作用域：

还有个例子就不举了，函数在申明之后才能使用。在申明以前调用会报未定义的错误。







### 如何 debug shell ###

scripts 在执行之前，最怕的就是出现问题了！那么我们如何 debug 呢？有没有办法不需要透过直接执行该 scripts 就可以来判断是否有问题呢！？呵呵！当然是有的！我们就直接以 sh 来进行判断吧！ 

	[test @test test]# sh [-nvx] scripts
	-n ：不要执行 scripts ，查询 scripts 内的语法，若有错误则予以列出！
	-v ：在执行 scripts 之前，先将 scripts 的内容显示在屏幕上；
	-x ：将有使用到的 scripts 内容显示在屏幕上，与 -v 稍微不同！
	[test @test test]# sh -n test01-hello.sh
	[test @test test]# sh -v test01-hello.sh
	#!/bin/bash
	# This program will print the "Hello! How are you" in your monitor
	# Date: 2002/06/27
	# User: VBird
	hello="Hello! How are you"
	echo $hello
	Hello! How are you
	[test @test test]# sh -x test01-hello.sh
	+ hello=Hello! How are you
	+ echo 'Hello!' How are you
	Hello! How are you

对于 Shell scripts 的学习方法上面，需要『多看、多模仿、并加以修改成自己的样式！』是最快的学习手段了！网络上有相当多的朋友在开发一些相当有用的 scripts ，若是您可以将对方的 scripts 拿来，并且改成适合自己主机的样子！那么学习的效果会是最快的呢！





### 结语 ###

shell在当今窗口程序盛行的时代，还是占有一席之地。就我作为一个PHPer，用到shell的场景并不是很多，如果单单作为开发，把运维的工作也包了，这个我也是醉了。对于某些提高工作效率的工具，能够使用自己更得心应手的语言实现，就没有用shell的必要了。比如文本分析，我就个PHPer，肯定不会去学英汉字典厚的AWK。

所以，对于我来说，shell的学习，更多的是熟悉Linux的命令，做点低级的运维。


