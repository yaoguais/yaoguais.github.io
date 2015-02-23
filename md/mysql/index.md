## Mysql index及 orderby 优化 ##

前言：优化是指通过建立合理的索引来更快地查询出结果，由于优化会增加索引文件，所以会增加额外的磁盘消耗；而且在增删改的时候，由于数据发生变化，索引也会相应的发生变化，所以会增加额外的消耗。

目录:

1. 认识索引
2. 单列索引和多列索引
3. 分析索引的效率
4. 根据where语句及orderby语句进行优化
5. use index
6. 不要使用哪些语句造成系统不适用索引
7. 如何建立索引及where字段顺序


### 首先认识索引的类别 ###

1)普通索引

　　这是最基本的索引类型，而且它没有唯一性之类的限制。普通索引可以通过以下几种方式创建：

    创建索引，例如CREATE INDEX <索引的名字> ON tablename (列的列表);
    修改表，例如ALTER TABLE tablename ADD INDEX [索引的名字] (列的列表);
    创建表的时候指定索引，例如CREATE TABLE tablename ( [...], INDEX [索引的名字] (列的列表) );

2)唯一性索引

　　这种索引和前面的“普通索引”基本相同，但有一个区别：索引列的所有值都只能出现一次，即必须唯一。唯一性索引可以用以下几种方式创建：

    创建索引，例如CREATE UNIQUE INDEX <索引的名字> ON tablename (列的列表);
    修改表，例如ALTER TABLE tablename ADD UNIQUE [索引的名字] (列的列表);
    创建表的时候指定索引，例如CREATE TABLE tablename ( [...], UNIQUE [索引的名字] (列的列表) );

3)主键

　　主键是一种唯一性索引，但它必须指定为“PRIMARY KEY”。如果你曾经用过AUTO_INCREMENT类型的列，你可能已经熟悉主键之类的概念了。主键一般在创建表的时候指定，例如“CREATE TABLE tablename ( [...], PRIMARY KEY (列的列表) ); ”。但是，我们也可以通过修改表的方式加入主键，例如“ALTER TABLE tablename ADD PRIMARY KEY (列的列表); ”。每个表只能有一个主键。

4)全文索引

　　MySQL从3.23.23版开始支持全文索引和全文检索。在MySQL中，全文索引的索引类型为FULLTEXT。全文索引可以在VARCHAR或者TEXT类型的列上创建。它可以通过CREATE TABLE命令创建，也可以通过ALTER TABLE或CREATE INDEX命令创建。对于大规模的数据集，通过ALTER TABLE（或者CREATE INDEX）命令创建全文索引要比把记录插入带有全文索引的空表更快



### 单列索引和多列索引 ###

单列索引就是建立在一个字段上的索引，多列就是建立在多个字段上的索引。

多列索引还有另外一个优点，它通过称为最左前缀（Leftmost Prefixing）的概念体现出来。继续考虑前面的例子，现在我们有一个firstname、lastname、age列上的多列索引，我们称这个索引为fname_lname_age。当搜索条件是以下各种列的组合时，MySQL将使用fname_lname_age索引：

    firstname，lastname，age
    firstname，lastname
    firstname

从另一方面理解，它相当于我们创建了(firstname，lastname，age)、(firstname，lastname)以及(firstname)这些列组合上的索引


### 分析索引的效率 ###

现在我们已经知道了一些如何选择索引列的知识，但还无法判断哪一个最有效。MySQL提供了一个内建的SQL命令帮助我们完成这个任务，这就是EXPLAIN命令。EXPLAIN命令的一般语法是：EXPLAIN <SQL命令>。你可以在MySQL文档找到有关该命令的更多说明。下面是一个例子：

	EXPLAIN SELECT peopleid FROM people WHERE firstname='Mike' 
	AND lastname='Sullivan' AND age='17';

这个命令将返回下面这种分析结果：

　　下面我们就来看看这个EXPLAIN分析结果的含义。

table：这是表的名字。

type：连接操作的类型。下面是MySQL文档关于ref连接类型的说明：

“对于每一种与另一个表中记录的组合，MySQL将从当前的表读取所有带有匹配索引值的记录。如果连接操作只使用键的最左前缀，或者如果键不是UNIQUE或PRIMARY KEY类型（换句话说，如果连接操作不能根据键值选择出唯一行），则MySQL使用ref连接类型。如果连接操作所用的键只匹配少量的记录，则ref是一种好的连接类型。”

在本例中，由于索引不是UNIQUE类型，ref是我们能够得到的最好连接类型。

如果EXPLAIN显示连接类型是“ALL”，而且你并不想从表里面选择出大多数记录，那么MySQL的操作效率将非常低，因为它要扫描整个表。你可以加入更多的索引来解决这个问题。预知更多信息，请参见MySQL的手册说明。

possible\_keys：
可能可以利用的索引的名字。这里的索引名字是创建索引时指定的索引昵称；如果索引没有昵称，则默认显示的是索引中第一个列的名字（在本例中，它是“firstname”）。默认索引名字的含义往往不是很明显。

Key：
它显示了MySQL实际使用的索引的名字。如果它为空（或NULL），则MySQL不使用索引。

key\_len：
索引中被使用部分的长度，以字节计。在本例中，key\_len是102，其中firstname占50字节，lastname占50字节，age占2字节。如果MySQL只使用索引中的firstname部分，则key\_len将是50。

ref：
它显示的是列的名字（或单词“const”），MySQL将根据这些列来选择行。在本例中，MySQL根据三个常量选择行。

rows：
MySQL所认为的它在找到正确的结果之前必须扫描的记录数。显然，这里最理想的数字就是1。

Extra：
这里可能出现许多不同的选项，其中大多数将对查询产生负面影响。在本例中，MySQL只是提醒我们它将用WHERE子句限制搜索结果集。


### 根据where语句及orderby语句进行优化 ###

1)SELECT [column1],[column2],…. FROM [TABLE] ORDER BY [sort];
在[sort]这个栏位上建立索引就可以实现利用索引进行order by 优化。

2)SELECT [column1],[column2],…. FROM [TABLE] WHERE [columnX] = [value] ORDER BY [sort];
WHERE + ORDER BY的索引优化,建立一个联合索引(columnX,sort)来实现order by 优化。

注意：如果columnX对应多个值，如下面语句就无法利用索引来实现order by的优化

SELECT [column1],[column2],…. FROM [TABLE] WHERE [columnX] IN ([value1],[value2],…) ORDER BY[sort];


3)WHERE+ 多个字段ORDER BY

SELECT * FROM WHERE uid=1 ORDER x,y LIMIT 0,10;

建立索引(uid,x,y)实现order by的优化,比建立(x,y,uid)索引效果要好得多

在某些情况中，MySQL可以使用一个索引来满足ORDER BY子句，而不需要额外的排序。where条件和order by使用相同的索引，并且order by的顺序和索引顺序相同，并且order by的字段都是升序或者都是降序。


   

### use index ###

当我们查询时，Mysql可能使用错误的索引进行查询，我们可以手动的指定索引，来提高效率

SELECT columns  FROM tablename use index (\`indexname\`) WHERE



### 不要使用哪些语句造成系统不适用索引 ###

1)like语句操作   一般情况下不鼓励使用like操作，如果非使用不可，如何使用也是一个问题。like “%aaa%” 不会使用索引而like “aaa%”可以使用索引。

2)不要在列上进行运算 select * from users where  YEAR(adddate)

3)不要使用不使用NOT IN操作 

4）如果条件中有or，即使其中有条件带索引也不会使用

5）对于多列索引，不是遵循前缀规则，则不会使用索引

6）如果列类型是字符串，那一定要在条件中将数据使用引号引用起来,否则不使用索引

7）如果mysql估计使用全表扫描要比使用索引快,则不使用索引

8）>, >=, =, <, <=, IF NULL和BETWEEN 将要使用索引


在MySQL中，有Handler\_read\_key和Handler\_read\_rnd\_key两个变 量，如果Handler\_read\_key值很高而Handler\_read\_rnd\_key的值很低，则表明索引经常不被使用，应该重新考虑建立索引。 可以通过:show status like 'Handler\_read%'来查看着连个参数的值。


### 建立索引 ###

根据查询语句的where条件与orderby语句，进行合理的index建立，并且要避免不使用索引和使用索引造成得不偿失的情况。




相关博文：
[http://www.cnblogs.com/hustcat/archive/2009/10/28/1591648.html](http://www.cnblogs.com/hustcat/archive/2009/10/28/1591648.html)