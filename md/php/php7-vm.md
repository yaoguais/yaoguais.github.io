## PHP7 实施细节(翻译) ##

目录:

1. 值的表示简介
2. zval的结构
3. VM的变化


### 值的表示简介 ###

在现有的ZEND引擎中,所有的值都是从堆上分配,并且受到引用计数、垃圾回收机制的影响.ZEND引擎操作zval大多是通过指针的,许多地方还是通过指针的指针.

在新的ZEND引擎中,直接操作的是zval自身,而不是指针.zval被直接的储存在VM栈、哈希表的桶中、属性槽中。这样极大的减少了堆分配/堆释放操作.这样还避免了一些基本类型的引用计数与垃圾回收，如null、bool、long、double、interned string(驻留字符串)、immutable arrays(不可变数组).

新的ZEND引擎实现更多的使用栈空间而不是堆,因为现在是直接保存zval结构而不是通过指针指向它.总之,内存的使用率减少了.某些时候，新引擎会进行直接复制,取代之前的写时复制，但是这不造成性能损失.因为,它会进行两次读+两次写,而之前的是一次读+一次写+引用计数自增,算下来同样是两次读+两次写.

### zval的结构 ###

新的zval占64位.前32位包含实际的值，它被定义成一个联合体.余下的位包含类型标记和一些标识.类型与标识有效的储存在同一个32位字中.最后32位字会因为zval类型的不同而拥有不同的作用.


- IS_UNDEF – 我们使用一个单独的类型来标识未定义的变量
- IS_NULL
- IS_FALSE –我们把IS\_BOOL分成IS\_FALSE和IS\_TRUE了
- IS_TRUE
- IS_LONG
- IS_DOUBLE
- IS_STRING – 一般字符串或驻留字符串
- IS_ARRAY – 一般数组或者不可变数组
- IS_OBJECT
- IS_RESOURCE
- IS_REFERENCE – 单独的引用类型 (后面将会特别讲解)
- IS_CONSTANT – 常量
- IS_CONSTANT_AST – 常量表达式
- IS_CALLABLE – 仅用作类型提示
- \_IS_BOOL – 仅用作类型提示
- IS_INDIRECT – 指向其他值
- IS\_STR\_OFFSET – 处理字符串偏移(used only in VM)
- IS\_PTR – 指向某些东西 (e.g. zend\_function, zend\_class\_entry, etc)


我们还定义了一些宏来处理这些类型

IS\_TYPE\_CONSTANT - 类型是一个常数（IS\_CONSTANT，IS\_CONSTANT\_AST）

IS\_TYPE\_REFCOUNTED - 类型是引用计数（IS\_STRING不包括驻留字符串，IS\_ARRAY不包括不变数组,IS\_OBJECT，IS\_RESOURCE，IS\_REFERENCE)。所有引用计数类型指针指向的值都有共同的（zend\_refcounted）结构，可以使用Z\_COUNTD()、Z\_GC\_TYPE()、Z\_GC\_FLAGS()、G\_GC\_INFO()、Z\_GC\_TYPE\_INFO()等宏函数获取zval的GC信息，也可以使用Z\_REFCOUNT()、Z\_SET\_REFCOUNT()、Z\_ADDREF()、Z\_DELREF()访问zval的引用计数。

IS\_TYPE\_COLLECTABLE - 垃圾回收对象(IS\_ARRAY, IS\_OBJECT)

IS\_TYPE\_COPYABLE - 使用zval\_copy\_ctor（）进行复制的（IS\_STRING不包括驻留字符串，IS\_ARRAY）

IS\_TYPE\_IMMUTABLE - 类型不能直接改变，但在写实复制时可能改变。用于不可变数组，避免了不必要的复制。


还有几个关于常量更加详细的宏

- IS\_CONSTANT\_UNQUALIFIED	(不合格常量)
- IS\_LEXICAL\_VAR			
- IS\_LEXICAL\_REF
- IS\_CONSTANT\_IN\_NAMESPACE

变量的类型可以使用Z\_TYPE() 或者 Z\_TYPE\_P() 来读取，type flags 可以使用Z\_TYPE\_FLAGS() 或 Z\_TYPE\_FLAGS\_P()读取，the combination of type and flags可以使用Z\_TYPE\_INFO() 或 Z\_TYPE\_INFO\_P()读取。PHP7不再使用指针的指针来访问zval，所以就没有Z\_TYPE\_PP这类的宏了。

###### IS_UNDEF类型 ######

我们使用IS\_UNDEF标识未定义的IS\_CV变量(编译变量)或者空的哈希元素,之前都是NULL指针进行初始化的.引擎只在少数的地方支持IS\_UNDEF,PHP脚本就不能，它们得到的依旧是NULL.

初始化: ZVAL\_UNDEF()

###### IS\_NULL类型 ######

初始化：ZVAL\_NULL()

###### IS\_FALSE and IS\_TRUE类型 ######

原来的IS\_BOOL被拆分成了IS\_TRUE和IS\_FALSE了，现在检测值可以避免额外的读内存了。

初始化: ZVAL\_BOOL(), ZVAL\_FALSE() , ZVAL\_TRUE() 

###### IS\_LONG类型 ######

读取：Z\_LVAL() or Z\_LVAL\_P() 
初始化： ZVAL\_LONG()

###### IS\_DOUBLE类型 ######

读取： Z\_DVAL() or Z\_DVAL\_P()
初始化：ZVAL\_DOUBLE()

###### IS\_STRING类型 ######

实际的值是保存在zend\_string中的，zval只是指向它。zend\_string的第一个字段是zend\_reference(它保存了引用计数)。It consists from reference counter, type that repeats the type of zval (might be with some variations), additional flags and some data used during GC.

zend\_string保存了hash值(被初始化成了0，但只会在第一次请求时被计算),长度，字符串。

字符串可能是保留的或动态的。保留字符串不必进行引用计数与复制，另一方面它也不能被修改。

一些字符串标识：

IS\_STR\_PERSISTENT - allocated using malloc (otherwise using emalloc)
IS\_STR\_INTERNED - interned string
IS\_STR\_PERMANENT – interned string that relives request boundary
IS\_STR\_CONSTANT – constant index
IS\_STR\_CONSTANT\_UNQUALIFIED - the same as IS\_CONSTANT\_UNQUALIFIED
IS\_STR\_AST - constant expression index

读取：Z\_STRVAL(), Z\_STRLEN(), Z\_STRHASH() or Z\_STR()
初始化：ZVAL\_STRINGL(), ZVAL\_STRING(), ZVAL\_STR(), ZVAL\_INT\_STR() or ZVAL\_NEW\_STR()

###### IS\_ARRAY类型 ######

IS\_ARRAY representation is more or less the same. 引用计数同zend\_string一样被转移到zend\_array中了, and embedded HashTable structure there, so the cost of HashTable fields access is the same. array 的赋值依旧是写时复制 (增加引用计数), 而不是直接复制.

The HashTable representation, on the other hand, is changed significantly. At first, now, it's an adaptive data structure that uses plain array of preallocated Buckets and construct hash index only if necessary (for some use case it's always possible to access array values by their index, like in C arrays). 

读取：Z\_ARR() and Z\_ARRVAL()
初始化：ZVAL\_ARR(), ZVAL\_NEW\_ARRAY() and ZVAL\_PERSISTENT\_ARRAY()

###### IS\_OBJECT类型 ######

IS\_OBJECT类型变化更加显著，We removed double indirection (through) object store handle and double reference counting. 但是依旧保证了兼容性。预定义的属性储存在embedded cells中，在分配zend\_object内存时一起被分配。dynamic\_properties table默认是NULL，它们在请求时才被构造。In this case it'll contain IS\_INDIRECT references to embedded cells.


读取：Z\_OBJ(), Z\_OBJ\_HT(), Z\_OBJ\_HANDLER(), Z\_OBJ\_HANDLE(), Z\_OBJCE(), Z\_OBJPROP(), Z\_OBJDEBUG()
初始化：object\_init() or object\_init\_ex()


###### IS\_RESOURCE类型 ######

资源对象我们使用直接指针来避免双重引用。当前也向前兼容。

读取：Z\_RES(), Z\_RES\_HANDLE(), Z\_RES\_TYPE() and Z\_RES\_VAL()
初始化：ZVAL\_RES(), ZVAL\_NEW\_RES() and ZVAL\_PERSISTENT\_RES()

###### IS\_REFERENCE类型 ######

最显著的变化应该是php的reference了，以前每个zval中保存一个is\_ref字段，现在reference被单独储存zend\_reference结构中，这个结构有额外的引用计数字段。名称不同的zval都指向同一个zend\_reference变量.

注：被引用的值可能是另一种标量，例如IS\_STRING, IS\_ARRAY, IS\_OBJECT, IS\_RESOURCE，但不会是IS\_REFERENCE、IS\_UNDEF。

注：当引用计数减到1后，PHP references很容易编程简单的值，而不会像以前那么繁琐了。

是否引用：Z\_ISREF() 
读取：Z\_REF() and Z\_REFVAL()
初始化：ZVAL\_REF(), ZVAL\_NEW\_REF() and ZVAL\_NEW\_PERSISTENT\_REF()


###### IS\_CONSTANT and IS\_CONSTANT\_AST ######

执行zend\_string,与一般的string和array不同。

###### IS\_INDIRECT类型 ######

新zend引擎假定，zval被储存在array和函数栈中，而非指针。 It must not be a problem for arrays because scalar values are going to be just duplicated, and compound values may point to shared reference-couned structures anyway. However it is a problem for local variables (IS\_CV), because they may be referenced through stack frame (by index) and through symbol table (by name). Both must point to the same structure. IS\_INDIRECT的值只是实际值得弱指针。 当我们延迟创建局部符号表, 我们在符号表中储存IS\_INDIRECT的值，然后用该指针指向的真正的CV槽的值初始化它。这意味着CV变量是通过索引访问的，很高效, as we don't need to perform double or even triple dereferences as before.

Global symbol tales are handled a bit differently. When we enter into some user code that uses global variables, we copy them from EG(symbol\_table) into CV slots and initialize symtable values with IS\_INDIRECT pointers. On exit we have to restore them back.

The same concept is used for object properties access. In case dynamic properties table is required it's first initialized with IS\_INDIRECT references to predefined object properties slots.

Also, IS\_INDIRECT pointers are used in VM during execution to pass address of variables between opcode handlers. 

###### IS\_STR\_OFFSET (used internally in VM) ######

This is another type used only in run-time to pass address of string element between opcodes. 

###### IS\_PTR (used internally by the Engine) ######

This type might be used to reuse the new HashTable implementation for some internal entities, not related to PHP values. (e.g. each zend\_class\_entry has to keep a HashTable of methods). 

这个类型用来辅助新的HashTable，跟php值没有关系。


### VM的变化 ###

新的zend引擎中， IS\_TMP\_VAR、IS\_VAR、IS\_CV的操作非常的相似。三种变量被保存在了当前上下文的函数栈中。 Such slots are allocated on segmented VM stack together with frame header (zend\_execute\_data). 插槽前面是CV变量，紧接着是IS\_TMP\_VAR与IS\_VAR变量。 Except for local and temporary variables we also allocate space for syntactically nested function calls and actual parameters, that this function may push. 
