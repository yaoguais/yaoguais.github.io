## 把扩展从php5升级到php7(翻译) ##

目录：

1. 概述
2. 建议
3. zval
4. reference
5. Boolean
6. string
7. zend_string API
8. smart\_str and smart\_string
9. strpprintf
10. arrays
11. HashTable API
12. HashTable Iteration API
13. object
14. custom object
15. zend\_object\_handlers
16. resource
17. parameters Parsing API
18. call frame (zend\_execute\_data)
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
- 如果PHP7直接操作zval，那么zval\*也需要改成zval，Z\_\*P()也要改成Z\_\*(),ZVAL\_\*(var, …) 需要改成 ZVAL\_\*(&var, …).一定要谨慎使用&符号，因为PHP7几乎不要求使用zval\*,那么很多地方的&也是要去掉的。
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

主要的区别是，现在处理基本类型和复杂类型有所不同。基本类型是在VM栈上分配的，而不是堆，包括HashTable与Object，并且他们不支持引用计数与垃圾回收。基本类型没有引用计数，也就不再支持Z\_ADDREF\*(), Z\_DELREF\*(), Z\_REFCOUNT\*(),Z\_SET\_REFCOUNT\*()这些宏了。你扩展中的基本类型使用了这些宏，那么程序会得到一个asset或者直接崩溃。

	- Z_ADDREF_P(zv)
	+ if (Z_REFCOUNTED_P(zv)) {Z_ADDREF_P(zv);}
	# or equivalently
	+ Z_TRY_ADDREF_P(zv);

一下是几点注意事项：

- 应该使用ZVAL\_COPY\_VALUE()进行值复制
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

The Z\_BVAL\*() macros are removed. Be careful, the return value of Z\_LVAL\*() on IS\_FALSE/IS\_TRUE is undefined. 

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

The double reallocation may be avoided using zend\_string API directly and creating zval directly from zend\_string. 

	- char * str = estrdup("Hello");
	- RETURN_STRING(str);
	+ zend_string *str = zend_string_init("Hello", sizeof("Hello")-1, 0);
	+ RETURN_STR(str);

Z\_STRVAL\*()返回的变量应该当作只读的，它不应该被赋值。但是如果一定要修改，那么你应该确定它并没有在其他地方被引用，也就意味着它不能是驻留字符串并且引用计数是1。还有，如果你修改了字符串的值，那么你需要手动计算并保存其HASH值。

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

复制string现在使用zend\_string\_dup()替代了。

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

并不是所有的扩展都要更新到zend\_string来替换char*,主要还是看哪一个更合适。

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

array的实现或多或少是不变的，但是之前是用一个指针指向HashTable，而现在指向的是zend\_array。读取HashTable同样使用Z\_ARRVAL\*()宏，但是现在不可能改变该HashTable的指针了，现在唯一可以读取和改变zend\_array的方法是通过Z\_ARR\*()宏。

使用array\_init()同样是创建array的最好方法，但是也可以使用ZVAL\_NEW\_ARR()创建一个未初始化的array，用ZVAL\_ARR()进行初始化。

可不变数组可以使用Z\_IMMUTABLE()进行检测，但是如果想改变该数组，请先复制它。使用internal position pointer迭代不可变数组也是不行的。但是可以使用external position pointer结合原来的迭代API可以遍历数组，或者也可以使用新的HashTable迭代API。

###  HashTable API  ###

HashTable API的变化很显著，移植扩展中要特别注意这点。

- HashTable的元素始终是zval，即使存的是指针，也是被封装成IS_PTR类型的zval。

		- zend_hash_update(ht, Z_STRVAL_P(key), Z_STRLEN_P(key)+1, (void*)&zv, sizeof(zval**), NULL) == SUCCESS) {
		+ if (zend_hash_update(EG(function_table), Z_STR_P(key), zv)) != NULL) {


- API基本直接返回zval，而不是返回bool+参数返回zval。

		- if (zend_hash_find(ht, Z_STRVAL_P(key), Z_STRLEN_P(key)+1, (void**)&zv_ptr) == SUCCESS) {
		+ if ((zv = zend_hash_find(ht, Z_STR_P(key))) != NULL) {

- 元素的key是用zend\_string封装的，但是也同样提供了两类函数：zend\_string或者char*+int
- 注意：key不再包含"\0",一些地方+1/-1会发生变化。

		- if (zend_hash_find(ht, "value", sizeof("value"), (void**)&zv_ptr) == SUCCESS) {
		+ if ((zv = zend_hash_str_find(ht, "value", sizeof("value")-1)) != NULL) {

上面的规则同样也适用其他一些API。

	- add_assoc_bool_ex(&zv, "valid", sizeof("valid"), 0);
	+ add_assoc_bool_ex(&zv, "valid", sizeof("valid") - 1, 0);

- 同样提供了一组适用指针类型的参数，它们都有\_ptr后缀。

		- if (zend_hash_find(EG(class_table), Z_STRVAL_P(key), Z_STRLEN_P(key)+1, (void**)&ce_ptr) == SUCCESS) {
		+ if ((ce_ptr = zend_hash_find_ptr(EG(class_table), Z_STR_P(key))) != NULL) {
		
		- zend_hash_update(EG(class_table), Z_STRVAL_P(key), Z_STRLEN_P(key)+1, (void*)&ce, sizeof(zend_class_entry*), NULL) == SUCCESS) {
		+ if (zend_hash_update_ptr(EG(class_table), Z_STR_P(key), ce)) != NULL) {

- API provides a separate group of functions to store memory blocks of arbitrary size. Such functions have the same names with \_mem suffix and they implemented as inline wrappers of corresponding \_ptr functions. It doesn't mean if something was stored using \_mem or \_ptr variant. It always may be retrieved back using zend\_hash\_find\_ptr().

		- zend_hash_update(EG(function_table), Z_STRVAL_P(key), Z_STRLEN_P(key)+1, (void*)func, sizeof(zend_function), NULL) == SUCCESS) {
		+ if (zend_hash_update_mem(EG(function_table), Z_STR_P(key), func, sizeof(zend_function))) != NULL) {

- 提供了一些新的添加函数，它们被用在添加新的zval并且当前不存在同样的key。它们都有同样的后缀\_new。

		zval* zend_hash_add_new(HashTable *ht, zend_string *key, zval *zv);
		zval* zend_hash_str_add_new(HashTable *ht, char *key, int len, zval *zv);
		zval* zend_hash_index_add_new(HashTable *ht, pzval *zv);
		zval* zend_hash_next_index_insert_new(HashTable *ht, pzval *zv);
		void* zend_hash_add_new_ptr(HashTable *ht, zend_string *key, void *pData);
		...

- HashTable destructors 的参数总是zval*类型。(even if we use zend\_hash\_add\_ptr or zend\_hash\_add\_mem to add elements). Z\_PTR\_P() macro may be used to reach the actual pointer value in destructors. Also, if elements are added using zend\_hash\_add\_mem, destructor is also responsible for deallocation of the pointers themselves. 

		- void my_ht_destructor(void *ptr)
		+ void my_ht_destructor(zval *zv)
		  {
		-    my_ht_el_t *p = (my_ht_el_t*) ptr;
		+    my_ht_el_t *p = (my_ht_el_t*) Z_PTR_P(zv);
		     ...
		+    efree(p); // this efree() is not always necessary
		  }
		);

- 像zend\_hash\_apply\_\*(),zend\_hash\_copy(),zend\_hash\_merge()的参数同样需要用zval\*代替void\*&&。一些函数可能接收zend\_hash\_key指针变量作为参数，该结构被定义为下，如果key是字符串，那么h保存hash值，key保存字符串；如果key是数字，那么h就是该数字，而key是NULL。

		typedef struct _zend_hash_key {
			ulong        h;
			zend_string *key;
		} zend_hash_key;

注意：应该使用新的迭代API替换zend\_hash\_apply\*()此类函数，因为效率更高，代码更短。

更多请查看zend_hash.h



###  HashTable Iteration API  ###

我们提供了一些特别的宏来遍历HashTable，第一个参数是HashTable，剩下的参数变量将在每一步迭代中被复制。

	ZEND_HASH_FOREACH_VAL(ht, val)
	ZEND_HASH_FOREACH_KEY(ht, h, key)
	ZEND_HASH_FOREACH_PTR(ht, ptr)
	ZEND_HASH_FOREACH_NUM_KEY(ht, h)
	ZEND_HASH_FOREACH_STR_KEY(ht, key)
	ZEND_HASH_FOREACH_STR_KEY_VAL(ht, key, val)
	ZEND_HASH_FOREACH_KEY_VAL(ht, h, key, val)

最好适用新的宏代替原来的那么操作函数。

	- HashPosition pos;
	  ulong num_key;
	- char *key;
	- uint key_len;
	+ zend_string *key;
	- zval **pzv;
	+ zval *zv;
	-
	- zend_hash_internal_pointer_reset_ex(&ht, &pos);
	- while (zend_hash_get_current_data_ex(&ht, (void**)&ppzval, &pos) == SUCCESS) {
	-   if (zend_hash_get_current_key_ex(&ht, &key, &key_len, &num_key, 0, &pos) == HASH_KEY_IS_STRING){
	-   }
	+ ZEND_HASH_FOREACH_KEY_VAL(ht, num_key, key, val) {
	+   if (key) { //HASH_KEY_IS_STRING
	+   }
	    ........
	-   zend_hash_move_forward_ex(&ht, &pos);
	- }
	+ } ZEND_HASH_FOREACH_END();




###  object  ###

TODO: … 


###  custom object  ###

TODO: … 

zend\_object被定义为：

	struct _zend_object {
	    zend_refcounted   gc;
	    zend_uint         handle; // TODO: may be removed ???
	    zend_class_entry *ce;
	    const zend_object_handlers *handlers;
	    HashTable        *properties;
	    HashTable        *guards; /* protects from __get/__set ... recursion */
	    zval              properties_table[1];
	};

新的结构中properties\_table是内联的，这就带来了问题。以前我们是这样自定义对象的：

	struct custom_object {
	   zend_object std;
	   void  *custom_data;
	}
	 
	 
	zend_object_value custom_object_new(zend_class_entry *ce TSRMLS_DC) {
	 
	   zend_object_value retval;
	   struct custom_object *intern;
	 
	   intern = emalloc(sizeof(struct custom_object));
	   zend_object_std_init(&intern->std, ce TSRMLS_CC);
	   object_properties_init(&intern->std, ce);
	   retval.handle = zend_objects_store_put(intern,
	        (zend_objects_store_dtor_t)zend_objects_destroy_object,
	        (zend_objects_free_object_storage_t) custom_free_storage, 
	        NULL TSRMLC_CC);
	   intern->handle = retval.handle;
	   retval.handlers = &custom_object_handlers;
	   return retval;
	}
	 
	struct custom_object* obj = (struct custom_object *)zend_objects_get_address(getThis());

但是现在由于内联属性，zend\_object的长度是变化的，所以我们要做出下面的改变了。

	struct custom_object {
	   void  *custom_data;
	   zend_object std;
	}
	 
	zend_object * custom_object_new(zend_class_entry *ce TSRMLS_DC) {
	     # Allocate sizeof(custom) + sizeof(properties table requirements)
	     struct custom_object *intern = ecalloc(1, 
	         sizeof(struct custom_object) + 
	         zend_object_properties_size(ce));
	     # Allocating:
	     # struct custom_object {
	     #    void *custom_data;
	     #    zend_object std;
	     # }
	     # zval[ce->default_properties_count-1]
	     zend_object_std_init(&intern->std, ce TSRMLS_CC);
	     ...
	     custom_object_handlers.offset = XtOffsetof(struct custom_obj, std);
	     custom_object_handlers.free_obj = custom_free_storage;
	 
	     return &intern->std;
	}
 
	# Fetching the custom object:
	 
	static inline struct custom_object * php_custom_object_fetch_object(zend_object *obj) {
	      return (struct custom_object *)((char *)obj - XtOffsetOf(struct custom_object, std));
	}
	 
	#define Z_CUSTOM_OBJ_P(zv) php_custom_object_fetch_object(Z_OBJ_P(zv));
	 
	struct custom_object* obj = Z_CUSTOM_OBJ_P(getThis());


###  zend\_object\_handlers  ###

一个新的字段offset被定义进zend\_object\_handlers,当你使用自定义对象的时候，一定要对它赋值。

请使用zend\_objects\_store\_\*来找到分配的地址。

	// An example in spl_array
	memcpy(&spl_handler_ArrayObject, zend_get_std_object_handlers(), sizeof(zend_object_handlers));
	spl_handler_ArrayObject.offset = XtOffsetOf(spl_array_object, std);

对象的内存会自动被zend\_objects\_store\_\*释放，所以你不必通过free_obj句柄来释放。

###  resource  ###

IS\_RESOURCE类型zval不再保持resource handle，也不能使用Z\_LVAL\*()获取resource handle了,现在应该使用Z\_RES\*()宏获取。It contains type - resource type, ptr - pointer to actual data, handle - numeric resource index (for compatibility) and service fields for reference counter. Actually this zend_resurce structure is a replacement for indirectly referred zend\_rsrc\_list\_entry. 所有与zend\_rsrc\_list\_entry相关的应该被zend\_resource代替.

- zend\_list\_find()已被移除，因为资源能够被直接获取。

		- long handle = Z_LVAL_P(zv);
		- int  type;
		- void *ptr = zend_list_find(handle, &type);
		+ long handle = Z_RES_P(zv)->handle;
		+ int  type = Z_RES_P(zv)->type;
		+ void *ptr = = Z_RES_P(zv)->ptr;

- Z\_RESVAL\_\*()已被移除，用 Z\_RES\*()代替。

		- long handle = Z_RESVAL_P(zv);
		+ long handle = Z_RES_P(zv)->handle;

- ZEND\_REGISTER\_RESOURCE/ZEND\_FETCH\_RESOURCE()都被移除了。

		- ZEND_FETCH_RESOURCE2(ib_link, ibase_db_link *, &link_arg, link_id, LE_LINK, le_link, le_plink);
		
		//if you are sure that link_arg is a IS_RESOURCE type, then use :
		+if ((ib_link = (ibase_db_link *)zend_fetch_resource2(Z_RES_P(link_arg), LE_LINK, le_link, le_plink)) == NULL) {
		+    RETURN_FALSE;
		+}
		
		//otherwise, if you know nothing about link_arg's type, use
		+if ((ib_link = (ibase_db_link *)zend_fetch_resource2_ex(link_arg, LE_LINK, le_link, le_plink)) == NULL) {
		+    RETURN_FALSE;
		+}
		
		- REGISTER_RESOURCE(return_value, result, le_result);
		+ RETURN_RES(zend_register_resource(result, le_result);

- zend\_list\_addref()，zend\_list\_delref()都被移除。

		- zend_list_addref(Z_LVAL_P(zv));
		+ Z_ADDREF_P(zv);

		- zend_list_addref(Z_LVAL_P(zv));
		+ Z_RES_P(zv)->gc.refcount++;

- zend\_list\_delete()需传入 zend\_resource 指针变量

		- zend_list_delete(Z_LVAL_P(zv));
		+ zend_list_delete(Z_RES_P(zv));


- 在多数扩展函数中，像mysql\_close()，你应该使用zend\_list\_close()代替zend\_list\_delete()，因为close只是关闭实际连接与释放扩展特别的结构，但是不会释放zend\_reference structure，所以还可以从其他地方引用该zval，close同样也不会减少引用计数。

		- zend_list_delete(Z_LVAL_P(zv));
		+ zend_list_close(Z_RES_P(zv));


###  parameters Parsing API  ###

-	PHP7不再需要zval\*\*，所以请用"z"标识替换"Z"

		- zval **pzv;
		- if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "Z", &pzv) == FAILURE) {
		+ zval *zv;
		+ if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "z", &zv) == FAILURE) {

- PHP7建议适用"S"标识接收zend\_string变量。

		- char *str;
		- int len;
		- if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "s", &str, &len) == FAILURE) {
		+ zend_string *str;
		+ if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "S", &str) == FAILURE) {

- "+"/"*"只接收zval数组了

		- zval ***argv = NULL;
		+ zval *argv = NULL;
		  int argn;
		  if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "+", &argv, &argn) == FAILURE) {

- arguments passed by reference should be assigned into the referenced value. It's possible to separte such arguments, to get referenced value at first place.

		- zval **ret;
		- if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "Z", &ret) == FAILURE) {
		+ zval *ret;
		+ if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "z/", &ret) == FAILURE) {
		    return;
		  }
		- ZVAL_LONG(*ret, 0);
		+ ZVAL_LONG(ret, 0);

###  call frame (zend\_execute\_data)  ###

每一次的函数调用都记录在zend\_execute\_data结构链表中，EG(current\_execute\_data)指向当前执行函数的调用栈，之前只有PHP用户函数才这样。我会尽量解释清楚新旧调用栈之间的区别。


- zend\_execute\_data.opline - 当前执行的用户函数的指针。内核函数它的值是未定义，之前是NULL。

- zend\_execute\_data.function\_state - 被移除，用 zend\_execute\_data.call代替。

- zend\_execute\_data.call - 旧引擎中是call\_slot的指针，现在是当前调用函数的指针，它被初始化为NULL, 然后被ZEND\_INIT\_FCALL (or similar) opcodes改变，最后被ZEND\_FO\_FCALL回复. 嵌套函数调用，例如foo($a, bar($c)), 将通过zend\_execute\_data.prev\_nested\_call构造一个链表。

- zend\_execute\_data.op\_array - 已被zend\_execute\_data.func替代, 因为现在它不仅代表用户函数也代表内核函数。

- zend\_execute\_data.func - 当前执行的函数

- zend\_execute\_data.object - $this of the currently executed function (previously it was a zval\*, now it's a zend\_object*)

- zend\_execute\_data.symbol\_table - current symbol table or NULL

- zend\_execute\_data.prev\_execute\_data - link of backtrace call chain

- original\_return\_value, current\_scope, current\_called\_scope, current\_this - 这些缓存变量值以便在调用后恢复现场的字段已被移除。

- zend\_execute\_data.scope - scope of the currently executed function (this is a new field).

- zend\_execute\_data.called\_scope - called\_scope of the currently executed function (this is a new field).

- zend\_execute\_data.run\_time\_cache - run-time-cache of the currently executed function. this is a new field and actually it's a copy of op\_array.run\_time\_cache.

- zend\_execute\_data.num\_args - number of arguments passed to the function (this is a new field)

- zend\_execute\_data.return\_value - pointer to zval* where the currently executed op\_array should store the result. 如果不关心返回值它可能就是NULL. (this is a new field).

函数参数都被直接储存在zval插槽中，在内存中紧接着zend\_execute\_data结构。他们可以通过ZEND\_CALL\_ARG(execute\_data, arg\_num)宏获取。如果是用户函数，函数的第一个参数内存位置将会和第一个compiled variable - CV0 重合。In case caller passes more arguments that callee receives, all extra arguments are copied to be after all used by calee CVs and TMP variables.



###  executor globals  ###

- EG(symbol\_table)已经变成了zend\_array了，而非HashTable。

		- symbols = zend_hash_num_elements(&EG(symbol_table));
		+ symbols = zend_hash_num_elements(&EG(symbol_table).ht);

- EG(uninitialized\_zval\_ptr) and EG(error\_zval\_ptr) were removed. Use &EG(uninitialized\_zval) and &EG(error\_zval) instead.
- EG(current\_execute\_data) - 此字符发生了一些变化，之前是一个指向最后调用函数的栈帧。现在它指向最后执行的调用栈帧，并不区别是脚本函数还是内核函数。It's possible to get the zend\_execute\_data structure for the last op\_array traversing call chain list.

		  zend_execute_data *ex = EG(current_execute_data);
		+ while (ex && (!ex->func || !ZEND_USER_CODE(ex->func->type))) {
		+    ex = ex->prev_execute_data;
		+ }
		  if (ex) {


- EG(opline\_ptr) - 被移除，用execute\_data->opline替代

- EG(return\_value\_ptr\_ptr) - 被移除，用execute\_data->return\_value替代

- EG(active\_symbol\_table) - 被移除，用execute\_data->symbol\_table替代

- EG(active\_op\_array) - 被移除，用execute\_data->func替代

- EG(called\_scope) - 被移除，用execute\_data->called\_scope替代

- EG(This) - 变成zval, 之前是zval*。不应被修改。

- EG(in\_execution) - 被移除. If EG(current\_excute\_data) is not NULL, we are executing something.

- EG(exception) and EG(prev\_exception) - 被改成zend\_object\*,之前是zval\*


###  opcodes  ###

- ZEND\_DO\_FCALL\_BY\_NAME - 已被移除,新增ZEND\_INIT\_FCALL\_BY\_NAME.

- ZEND\_BIND\_GLOBAL - "global $var"的handler

- ZEND\_STRLEN - 代替了strlen函数

- ZEND\_TYPE\_CHECK - 在必要的时候,用来代替is\_array/is\_int/is\_*

- ZEND\_DEFINED - 在必要的时候代替zif\_defined(if only one parameter and it's constant string and it's not in namespace style)

- ZEND\_SEND\_VAR\_EX - was added to do more check than ZEND\_SEND\_VAR if the condition can not be settled in compiling time

- ZEND\_SEND\_VAL\_EX - was added to do more check than ZEND\_SEND\_VAL if the condition can not be settled in compiling time

- ZEND\_INIT\_USER\_CALL - was added to replace call\_user\_func(\_array) if possible if the function can not be found in compiling time, otherwise it can convert to ZEND\_INIT\_FCALL

- ZEND\_SEND\_ARRAY - was added to send the second parameter, the array of the call\_user\_func\_array after it is converted to opcode

- ZEND\_SEND\_USER - was added to send the the parameters of call\_user\_func after it is converted to opcode




###  temp variable  ###

TODO: … 


###  pcre  ###

一些正则API使用zend\_string作为参数或者返回值了。php\_pcre\_replace returns a zend\_string and takes a zend\_string as 1st argument. 仔细检查函数申明与编译错误, 可以发现多数是类型错误。