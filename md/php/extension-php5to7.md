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

PHP7中的zval不再有is\_ref字段了，而是使用zend\_reference复合类型。如果你仍然使用Z\_ISREF\*()去检验zval是否是引用，实际上你是在判断zval是否是IS\_REFERENCE类型。is\_ref相关的宏已经被移除了。Z\_SET\_ISREF\*(), Z\_UNSET\_ISREF\*(), Z\_SET\_ISREF\_TO\*()这些宏的用法已经发生了改变，请参照下面。

	- Z_SET_ISREF_P(zv);
	+ ZVAL_MAKE_REF(zv);
	
	- Z_UNSET_ISREF_P(zv);
	+ if (Z_ISREF_P(zv)) {ZVAL_UNREF(zv);}

以前我们直接通过引用类型检测引用，但是现在我们需要使用Z\_REFVAL\*()间接检测了。

	- if (Z_ISREF_P(zv) && Z_TYPE_P(zv) == IS_ARRAY) {
	+ if (Z_ISREF_P(zv) && Z_TYPE_P(Z_REFVAL_P(zv)) == IS_ARRAY) {

或者手动使用ZVAL\_DEREF()来减少引用计数。

	- if (Z_ISREF_P(zv)) {...}
	- if (Z_TYPE_P(zv) == IS_ARRAY) {
	+ if (Z_ISREF_P(zv)) {...}
	+ ZVAL_DEREF(zv);
	+ if (Z_TYPE_P(zv) == IS_ARRAY) {

###  Boolean  ###

IS\_BOOL已经被IS\_TRUE和IS\_FALSE取代了。

	- if ((Z_TYPE_PP(item) == IS_BOOL || Z_TYPE_PP(item) == IS_LONG) && Z_LVAL_PP(item)) {
	+ if (Z_TYPE_P(item) == IS_TRUE || (Z_TYPE_P(item) == IS_LONG && Z_LVAL_P(item))) {

The Z_BVAL*() macros are removed. Be careful, the return value of Z_LVAL*() on IS_FALSE/IS_TRUE is undefined. 

Z\_BVAL\*()宏已经被移除，注意，对IS\_FALSE/IS\_TRUE使用Z\_LVAL\*()得到的结果将是undefined。


###  string  ###

string的值、长度可以分别使用Z\_STRVAL\*()、Z\_STRLEN\*()进行获取。而且现在使用zend\_string来表示字符串，可以使用Z\_STR\*()从zval中获取zend\_string的值，也是用使用Z\_STRHASH\*()获取字符串的HASH值。

如果现在要检测是否是驻留字符串，参数应该是zend\_string而不是char*。

	- if (IS_INTERNED(Z_STRVAL_P(zv))) {
	+ if (IS_INTERNED(Z_STR_P(zv))) {

创建string类型的zval也发生了一些变化。 之前ZVAL\_STRING()有个参数是控制字符串是否被复制的。现在这些宏都是用来创建zend\_string的，所以这个参数变得没有必要了。 However if its actual value was 0, 你需要释放原始字符串来避免内存泄露。

	- ZVAL_STRING(zv, str, 1);
	+ ZVAL_STRING(zv, str);
	
	- ZVAL_STRINGL(zv, str, len, 1);
	+ ZVAL_STRINGL(zv, str, len);
	
	- ZVAL_STRING(zv, str, 0);
	+ ZVAL_STRING(zv, str);
	+ efree(str);
	
	- ZVAL_STRINGL(zv, str, len, 0);
	+ ZVAL_STRINGL(zv, str, len);
	+ efree(str);

RETURN\_STRING(), RETVAL\_STRNGL()和一些核心API并没有发生变化。

	- add_assoc_string(zv, key, str, 1);
	+ add_assoc_string(zv, key, str);
	
	- add_assoc_string(zv, key, str, 0);
	+ add_assoc_string(zv, key, str);
	+ efree(str);

The double reallocation may be avoided using zend_string API directly and creating zval directly from zend_string. 

	- char * str = estrdup("Hello");
	- RETURN_STRING(str);
	+ zend_string *str = zend_string_init("Hello", sizeof("Hello")-1, 0);
	+ RETURN_STR(str);

Z\_STRVAL\*()返回的变量应该当作只读的，它不应该被赋值。但是如果一定要修改，那么你应该确定它并没有在其他地方被引用，也就意味着它不是驻留字符串并且引用计数是1。还有，如果你修改了字符串的值，那么你需要手动计算兵保存其HASH值。

	+ SEPARATE_ZVAL(zv);
	+ Z_STRVAL_P(zv)[0] = Z_STRVAL_P(zv)[0] + ('A' - 'a');
	+ zend_string_forget_hash_val((Z_STR_P(zv))

###  zend_string API  ###

新引擎有新的zend\_string API，以前大量使用char*+int的地方，都替换成了zend_string。

zend\_string(not IS\_STRING zvals)变量可以使用zend\_string\_init(char *val, int len, int persistent)进行创建。The actual characters may be accessed as str→val and string length as str→len.可以使用zend\_string\_hash\_val获取hash值，它会再必要的时候重新进行计算。

应该使用zend\_string\_release()来释放string占用的内存，但是不一定会立即释放，因为这个string可能被多次引用。

如果你想保持一个zend\_string的指针，那么你需要增加其引用计数，或者你可以直接使用zend\_string\_copy()来实现。很多时候拷贝只是为了获取其值，那么请尽量使用该函数。

	- ptr->str = estrndup(Z_STRVAL_P(zv), Z_STRLEN_P(zv));
	+ ptr->str = zend_string_copy(Z_STR_P(zv));
	  ...
	- efree(str);
	+ zend_string_release(str);

赋值string现在使用zend\_string\_dup()替代了。

	- char *str = estrndup(Z_STRVAL_P(zv), Z_STRLEN_P(zv));
	+ zend_string *str = zend_string_dup(Z_STR_P(zv));
	  ...
	- efree(str);
	+ zend_string_release(str);

原来string的那些宏还是支持的，所以并不是一定要用新的写法。

如果一些string的长度是知道的但是需要一个缓冲区，那么你可以使用zend\_string\_alloc()或zend\_string\_realloc()进行内存分配。

	- char *ret = emalloc(16+1);
	- md5(something, ret); 
	- RETURN_STRINGL(ret, 16, 0);
	+ zend_string *ret = zend_string_alloc(16, 0);
	+ md5(something, ret->val);
	+ RETURN_STR(ret);

并不是所有的扩展都要更新到zend\_string来替换char*,主要还是看哪一个合适些。

查看zend_string.h可以找到更详细的用法。

###  smart\_str and smart\_string  ###

smart\_str相关的API已经被重命名为smart\_string了，除了新名字，用法基本没变。

	- smart_str str = {0};
	- smart_str_appendl(str, " ", sizeof(" ") - 1);
	- smart_str_0(str);
	- RETURN_STRINGL(implstr.c, implstr.len, 0);
	+ smart_string str = {0};
	+ smart_string_appendl(str, " ", sizeof(" ") - 1);
	+ smart_string_0(str);
	+ RETVAL_STRINGL(str.c, str.len);
	+ smart_string_free(&str);


	- smart_str str = {0};
	- smart_str_appendl(str, " ", sizeof(" ") - 1);
	- smart_str_0(str);
	- RETURN_STRINGL(implstr.c, implstr.len, 0);
	+ smart_str str = {0};
	+ smart_str_appendl(str, " ", sizeof(" ") - 1);
	+ smart_str_0(str);
	+ if (str.s) {
	+   RETURN_STR(str.s);
	+ } else {
	+   RETURN_EMPTY_STRING();
	+ }

	typedef struct {
	    zend_string *s;
	    size_t a;
	} smart_str;

事实上smart\_str和smart\_string非常类似，在PHP5中它们基本算重复的，所以更新代码并不是必要的。

the biggest question what AI to select for each particular case, but it depends the way the final result is used.

但是检测其是否为空发生了一些变化。

	- if (smart_str->c) {
	+ if (smart_str->s) {

###  strpprintf  ###

spprintf()和vspprintf()的返回值从char*变成了zend_string,那么你需要改变你的代码了。

	+ PHPAPI zend_string *vstrpprintf(size_t max_len, const char *format, va_list ap);
	+ PHPAPI zend_string *strpprintf(size_t max_len, const char *format, ...);

###  arrays  ###
###  HashTable API  ###
###  HashTable Iteration API  ###
###  object  ###
###  custom object  ###
###  zend\_object\_handlers  ###
###  resource  ###
###  parameters Parsing API  ###
###  call frame (zend\_execute\_data)  ###
###  executor globals  ###
###  opcodes  ###
###  temp variable  ###
###  pcre  ###