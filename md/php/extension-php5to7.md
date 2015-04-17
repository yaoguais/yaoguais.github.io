## 把扩展从php5升级到php7(翻译) ##

目录：

1. 概述
2. 建议
3. zval
4. reference
5. Boolean
6. string
7. zend_string API
8. smart_str and smart_string
9. strpprintf
10. arrays
11. HashTable API
12. HashTable Iteration API
13. object
14. custom object
15. zend_object_handlers
16. resource
17. parameters Parsing API
18. call frame (zend_execute_data)
19. executor globals
20. opcodes
21. temp variable
22. pcre

###  概述  ###

很多常用的ZEND API已经发生了变化，例如HashTable API。这篇文章会尽可能多的记录这些变化。强烈建议你先阅读PHP7的实现([我这里有个现成的翻译](?s=md/php/php7-vm.md))。

当然，这肯定不会一篇完整的指南，它不可能涵盖所有的内容，但它收集了那些最常用的案例。

###  建议  ###

- 在php7下编译你的扩展，编译错误与警告会告诉你绝大部分需要修改的地方。
- 在DEBUG模式下编译与调试你的扩展，在run-time你可以通过断言捕捉一些错误。你还可以看到内存泄露的情况。

###  zval  ###

- PHP7不再需要指针的指针，绝大部分zval\*\*需要修改成zval\*。Z\_\*\_PP()宏也需要修改成 Z\_\*\_P().
- 如果地方PHP7直接操作zval，那么zval\*也需要改成zval，Z\_\*P()也要改成Z\_\*(),ZVAL\_\*(var, …) 需要改成 ZVAL\_\*(&var, …).一定要谨慎使用&符号，因为PHP7几乎不要求使用zval\*,那么很多地方的&也是要去掉的。
- ALLOC\_ZVAL, ALLOC\_INIT\_ZVAL, MAKE\_STD\_ZVAL 这几个分配内存的宏已经被移除了。大多数情况下，zval\*应该修改为zval，而 INIT_PZVAL宏也被移除了。

		//初始化的一些示例代码
		-  zval *zv;
		-  ALLOC_INIT_ZVAL();
		-  ZVAL_LONG(zv, 0);
		+  zval zv;
		+  ZVAL_LONG(&zv, 0);
	
zval 结构体也发生变化，它如今的定义如下

	struct _zval_struct {
		zend_value        value;			/* value */
		union {
			struct {
				ZEND_ENDIAN_LOHI_4(
					zend_uchar    type,			/* active type */
					zend_uchar    type_flags,
					zend_uchar    const_flags,
					zend_uchar    reserved)	    /* various IS_VAR flags */
			} v;
			zend_uint type_info;
		} u1;
		union {
			zend_uint     var_flags;
			zend_uint     next;                 /* hash collision chain */
			zend_uint     str_offset;           /* string offset */
			zend_uint     cache_slot;           /* literal cache slot */
		} u2;
	};

	typedef union _zend_value {
		long              lval;				/* long value */
		double            dval;				/* double value */
		zend_refcounted  *counted;
		zend_string      *str;
		zend_array       *arr;
		zend_object      *obj;
		zend_resource    *res;
		zend_reference   *ref;
		zend_ast_ref     *ast;
		zval             *zv;
		void             *ptr;
		zend_class_entry *ce;
		zend_function    *func;
	} zend_value;

主要的区别是，现在处理基本类型和复杂类型有所不同。基本类型实在VM栈上分配的，而不是堆，包括HashTable与Object，并且他们不支持引用计数与垃圾回收。基本类型没有引用计数，也就不再支持Z\_ADDREF\*(), Z\_DELREF\*(), Z\_REFCOUNT\*(),Z\_SET\_REFCOUNT\*()这些宏了。你扩展中的基本类型是否使用了这些宏，那么程序会得到一个asset或者直接崩溃。

	- Z_ADDREF_P(zv)
	+ if (Z_REFCOUNTED_P(zv)) {Z_ADDREF_P(zv);}
	# or equivalently
	+ Z_TRY_ADDREF_P(zv);

一下是几点注意事项：

- 应该使用ZVAL\_COPY\_VALUE()进行复制
- 使用ZVAL\_COPY()拷贝是增加引用计数
- 可以使用ZVAL\_DUP() 替代zval\_copy\_ctor进行复制
- 原本的NULL被替换成IS\_UNDEF类型了，可以使用Z\_ISUNDEF(zv)进行读取，ZVAL\_UNDEF(&zv)进行初始化
- 可以使用zval\_get\_long(zv), zval\_get\_double(zv), zval\_get\_string(zv)等函数获取zval的值，这样不会改变原始的zval

		//一些示例代码
		- zval tmp;
		- ZVAL_COPY_VALUE(&tmp, zv);
		- zval_copy_ctor(&tmp);
		- convert_to_string(&tmp);
		- // ...
		- zval_dtor(&tmp);
		+ zend_string *str = zval_get_string(zv);
		+ // ...
		+ zend_string_release(str);

更多请查看[zend\_types.h](https://github.com/php/php-src/blob/master/Zend/zend_types.h)

###  reference  ###
###  Boolean  ###
###  string  ###
###  zend_string API  ###
###  smart_str and smart_string  ###
###  strpprintf  ###
###  arrays  ###
###  HashTable API  ###
###  HashTable Iteration API  ###
###  object  ###
###  custom object  ###
###  zend_object_handlers  ###
###  resource  ###
###  parameters Parsing API  ###
###  call frame (zend_execute_data)  ###
###  executor globals  ###
###  opcodes  ###
###  temp variable  ###
###  pcre  ###