## Shell 简介与使用 ##

工作中难免会使用一些shell脚本进行自动化管理，今天就简单的总结下shell的使用。

目录：

1. shell 的简单介绍
2. shell 脚本的一般格式
3. shell 脚本的执行
4. 一个简单的例子
5. 卷标与运算符号：declare
6. shell 的输入输出
7. 逻辑判断式与表达式
8. 条件式判断 if
9. 条件式判断 case
10. 循环语句 for(;;)
11. 循环语句 for in
12. 循环语句 while
13. 循环语句 until
14. 如何 debug shell




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

