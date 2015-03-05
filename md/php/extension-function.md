## PHP扩展开发之函数与类的实现 ##

运行环境

- PHP Version 7.0.0-dev
- GNU gdb (GDB) Red Hat Enterprise Linux (7.2-75.el6)

前言：

我们知道函数包含函数申明，函数定义，函数申请又包括函数名以及函数参数，函数返回值。而类也有申明与定义。我们就按照这个思路来了解函数与类的实现。

目录：

1. 函数名与函数参数
2. 函数的定义
3. 函数的注册
4. 脚本调用函数
5. 注册全局常量
6. 类名与类的属性
7. 类的方法注册
8. 脚本调用类

### 函数名与函数参数 ###

函数的申明是PHP_FUNCTION宏实现的，我们展开这个宏。

	#define PHP_FUNCTION			ZEND_FUNCTION
	#define ZEND_FUNCTION(name)				ZEND_NAMED_FUNCTION(ZEND_FN(name))
	#define ZEND_NAMED_FUNCTION(name)		void name(INTERNAL_FUNCTION_PARAMETERS)
	#define INTERNAL_FUNCTION_PARAMETERS zend_execute_data *execute_data, zval *return_value
	#define ZEND_FN(name) zif_##name

	即 PHP_FUNCTION(function_name) == void zif_function_name(zend_execute_data *execute_data, zval *return_value)

所以我们申明的都是返回void有两个参数的函数。

第一个参数是zend_execute_data类型的

	typedef struct _zend_execute_data    zend_execute_data;
	
	struct _zend_execute_data {
		const zend_op       *opline;           /* executed opline                */
		zend_execute_data   *call;             /* current call                   */
		zval                *return_value;
		zend_function       *func;             /* executed op_array              */
		zval                 This;
	#if ZEND_EX_USE_RUN_TIME_CACHE
		void               **run_time_cache;
	#endif
	#if ZEND_EX_USE_LITERALS
		zval                *literals;
	#endif
		zend_class_entry    *called_scope;
		zend_execute_data   *prev_execute_data;
		zend_array          *symbol_table;
	};

第二个参数是zval类型的，实际上正是我们自定义函数的返回值。


#### 函数参数 ####

我们的php自定义函数的参数又是怎么来的呢？通过PHP_FE(mysqli_affected_rows,	arginfo_mysqli_only_link)可以推出，第二个参数正是我们的参数实现。

	mysqli_fe.c

	ZEND_BEGIN_ARG_INFO_EX(arginfo_mysqli_autocommit, 0, 0, 2)
		MYSQLI_ZEND_ARG_OBJ_INFO_LINK()
		ZEND_ARG_INFO(0, mode)
	ZEND_END_ARG_INFO()

	#define ZEND_ARG_INFO(pass_by_ref, name)							 { #name, NULL, 0, pass_by_ref, 0, 0 },
	#define ZEND_ARG_PASS_INFO(pass_by_ref)								 { NULL,  NULL, 0, pass_by_ref, 0, 0 },
	#define ZEND_ARG_OBJ_INFO(pass_by_ref, name, classname, allow_null)  { #name, #classname, IS_OBJECT, pass_by_ref, allow_null, 0 },
	#define ZEND_ARG_ARRAY_INFO(pass_by_ref, name, allow_null)           { #name, NULL, IS_ARRAY, pass_by_ref, allow_null, 0 },
	#define ZEND_ARG_TYPE_INFO(pass_by_ref, name, type_hint, allow_null) { #name, NULL, type_hint, pass_by_ref, allow_null, 0 },
	#define ZEND_ARG_VARIADIC_INFO(pass_by_ref, name) 					 { #name, NULL, 0, pass_by_ref, 0, 1 },
	
	#define ZEND_BEGIN_ARG_INFO_EX(name, _unused, return_reference, required_num_args)	\
		static const zend_internal_arg_info name[] = {																		\
			{ (const char*)(zend_uintptr_t)(required_num_args), NULL, 0, return_reference, 0, 0 },
	#define ZEND_BEGIN_ARG_INFO(name, _unused)	\
		ZEND_BEGIN_ARG_INFO_EX(name, 0, ZEND_RETURN_VALUE, -1)
	#define ZEND_END_ARG_INFO()		};

	#define MYSQLI_ZEND_ARG_OBJ_INFO_LINK() ZEND_ARG_INFO(0, link)

展开上面的宏
	
	static const zend_internal_arg_info arginfo_mysqli_autocommit[] = {
	    { (const char*)(zend_uintptr_t)(2), NULL, 0, 0, 0, 0 },
	    { "link", NULL, 0, 0, 0, 0 },
	    { "mode", NULL, 0, 0, 0, 0 },
	};

zend_internal_arg_info的定义如下

	/* arg_info for internal functions */
	typedef struct _zend_internal_arg_info {
		const char *name;	/*参数的名称 或者 个数*/
		const char *class_name;/*类的名称*/
		zend_uchar type_hint;/*参数类型*/
		zend_uchar pass_by_reference;/*是否引用*/
		zend_bool allow_null;/*是否允许空*/
		zend_bool is_variadic;/*是否可变参数*/
	} zend_internal_arg_info;

其中type_hint的在上面都是0，其函数如下

	/* regular data types */
	#define IS_UNDEF					0
	#define IS_NULL						1
	#define IS_FALSE					2
	#define IS_TRUE						3
	#define IS_LONG						4
	#define IS_DOUBLE					5
	#define IS_STRING					6
	#define IS_ARRAY					7
	#define IS_OBJECT					8
	#define IS_RESOURCE					9
	#define IS_REFERENCE				10
	
	/* constant expressions */
	#define IS_CONSTANT					11
	#define IS_CONSTANT_AST				12
	
	/* fake types */
	#define _IS_BOOL					13
	#define IS_CALLABLE					14
	
	/* internal types */
	#define IS_INDIRECT             	15
	#define IS_PTR						17

0即是IS_UNDEF，未定义。


### 函数的定义 ###

	mysqli_api.c

	/* {{{ proto void mysqli_debug(string debug) U
	*/
	PHP_FUNCTION(mysqli_debug)
	{
		char	*debug;
		size_t		debug_len;
	
		if (zend_parse_parameters(ZEND_NUM_ARGS(), "s", &debug, &debug_len) == FAILURE) {
			return;
		}
	
		mysql_debug(debug);
		RETURN_TRUE;
	}
	/* }}} */

	/* {{{ proto bool mysqli_autocommit(object link, bool mode)
	   Turn auto commit on or of */
	PHP_FUNCTION(mysqli_autocommit)
	{
		MY_MYSQL	*mysql;
		zval		*mysql_link;
		zend_bool	automode;
	
		if (zend_parse_method_parameters(ZEND_NUM_ARGS(), getThis(), "Ob", &mysql_link, mysqli_link_class_entry, &automode) == FAILURE) {
			return;
		}
		MYSQLI_FETCH_RESOURCE_CONN(mysql, mysql_link, MYSQLI_STATUS_VALID);
	
		if (mysql_autocommit(mysql->mysql, (my_bool)automode)) {
			RETURN_FALSE;
		}
		RETURN_TRUE;
	}
	/* }}} */

其中最常用到的函数就是zend_parse_parameters和zend_parse_method_parameters了

	ZEND_API int zend_parse_parameters(int num_args, const char *type_spec, ...);

	ZEND_API int zend_parse_method_parameters(int num_args, zval *this_ptr, const char *type_spec, ...);

	num_args  参数的个数
	this_ptr  this指针
	type_spec 参数的格式化字符串
	...       接受参数的变量地址


在zend_parse_va_args进行预处理

	static int zend_parse_va_args(int num_args, const char *type_spec, va_list *va, int flags) /* {{{ */
	{
	
		for (spec_walk = type_spec; *spec_walk; spec_walk++) {
			c = *spec_walk;
			switch (c) {
				case 'l': case 'd':
				case 's': case 'b':
				case 'r': case 'a':
				case 'o': case 'O':
				case 'z': case 'Z':
				case 'C': case 'h':
				case 'f': case 'A':
				case 'H': case 'p':
				case 'S': case 'P':
				case 'L':
					max_num_args++;
					break;
	
				case '|':
					min_num_args = max_num_args;
					break;
	
				case '/':
				case '!':
					/* Pass */
					break;
	
				case '*':
				case '+':
					break;
	
				default:
					return FAILURE;
			}
		}
	}

实际的参数的解析是由zend\_parse\_arg\_impl进行的，对解析进行整理可以得出下表。

	|	在它之前的变量都是必须的，后面的都有默认值。
	!	将!占为变量置为0(即NULL)，连续的多个!只为一个变量占位。
	/	如果传递过来的变量与别的变量共用一个zval，而且不是引用，则进行强制分离。
		多个连续的/只为一个变量占位。(注:1)

	l、L		zend_long *			integer/long
	d		double *p			float/double
	s		char **,size_t *	string
	p		char **,size_t *	a valid path
	P（大写）zend_string **		a valid path
	S		zend_string **		string
	b		zend_bool *p		boolean
	r		zval **				resource
	A、a		zval **				array
	H、h		HashTable **		array
	o		zval **				object
	O		zval **,zend_class_entry *	
	C		zend_class_entry **
	f		zend_fcall_info *,zend_fcall_info_cache * valid callback
	z		zval **				everything
	Z		'Z' iz not supported anymore and should be replaced with 'z'

	其中s,pO,f都是一个占位符接受两个变量，其余都是一个。

那么 ZEND\_NUM\_ARGS()又是什么呢？

	#define ZEND_NUM_ARGS()						EX_NUM_ARGS()
	#define EX_NUM_ARGS()			ZEND_CALL_NUM_ARGS(execute_data)
	#define ZEND_CALL_NUM_ARGS(call) \
		(call)->This.u2.num_args

即
	
	ZEND_NUM_ARGS() == （execute_data）->This.u2.num_args

那么脚本中用户传入的参数是怎么传递给我们的C函数的呢？

查看zend\_parse\_va\_args函数我们能找到下面的代码

	arg = ZEND_CALL_ARG(EG(current_execute_data), i + 1);

	if (zend_parse_arg(i+1, arg, va, &type_spec, quiet) == FAILURE) {
		/* clean up varargs array if it was used */
		if (varargs && *varargs) {
			*varargs = NULL;
		}
		return FAILURE;
	}

	其中
	# define EG(v) (executor_globals.v)
	
即在executor_globals.current_execute_data中找到第一个参数的位置,从而使用可变参数把php脚本中的值填充到C函数中的变量中去。

### 函数的注册 ###

我们在mysqli_fe.c中可以找到函数注册的代码

	const zend_function_entry mysqli_functions[] = {
		PHP_FE(mysqli_affected_rows,arginfo_mysqli_only_link)
		//中间的省略
		PHP_FE_END
	};

	#define PHP_FE			ZEND_FE
	#define ZEND_FE(name, arg_info)	ZEND_FENTRY(name, ZEND_FN(name), arg_info, 0)
	#define ZEND_FENTRY(zend_name, name, arg_info, flags)	{ #zend_name, name, arg_info, (uint32_t) (sizeof(arg_info)/sizeof(struct _zend_arg_info)-1), flags },
	#define ZEND_FN(name) zif_##name
	#define PHP_FE_END      ZEND_FE_END
	#define ZEND_FE_END            { NULL, NULL, NULL, 0, 0 }

	展开即：

	const zend_function_entry mysqli_functions[] = {
		PHP_FE(mysqli_affected_rows,arginfo_mysqli_only_link)
		{"mysqli_affected_rows",zif_mysqli_affected_rows,
			arginfo_mysqli_only_link,参数个数,0},
		//中间的省略
		{ NULL, NULL, NULL, 0, 0 }
	};
	typedef struct _zend_function_entry {
		const char *fname;
		void (*handler)(INTERNAL_FUNCTION_PARAMETERS);
		const struct _zend_internal_arg_info *arg_info;
		uint32_t num_args;
		uint32_t flags;
	} zend_function_entry;

	在分析cli执行过程的时候，我们知道循环注册函数判断条件是函数名是否为空。

那么这些我们自定义的函数是怎么注册到Zend的全局函数中去的呢？

在前面我们的php cli执行过程中，我们知道，每一个扩展都会有一个zend_module_entry全局变量，而这个变量的名称正是 扩展名_module_entry

	php_mysqli.h
	extern zend_module_entry mysqli_module_entry;

	mysqli.c
	zend_module_entry mysqli_module_entry = {
	#if ZEND_MODULE_API_NO >= 20050922
		STANDARD_MODULE_HEADER_EX, NULL,
		mysqli_deps,
	#elif ZEND_MODULE_API_NO >= 20010901
		STANDARD_MODULE_HEADER,
	#endif
		"mysqli",
		mysqli_functions,
		PHP_MINIT(mysqli),
		PHP_MSHUTDOWN(mysqli),
		PHP_RINIT(mysqli),
		PHP_RSHUTDOWN(mysqli),
		PHP_MINFO(mysqli),
		"0.1", /* Replace with version number for your extension */
		PHP_MODULE_GLOBALS(mysqli),
		PHP_GINIT(mysqli),
		NULL,
		NULL,
		STANDARD_MODULE_PROPERTIES_EX
	};

	mysqli_fe.c
	const zend_function_entry mysqli_functions[] = {
		PHP_FE(mysqli_affected_rows,						arginfo_mysqli_only_link)
		PHP_FE_END
	};

经过上面的分析，我们得出全局函数注册是通过"扩展名_module_entry"中的functions字段进行注册的。

### 脚本调用函数 ###

那么脚本是怎么调用到我们的函数的呢？比如我们的扩展中有个函数test_php_server()，在Zend引擎解析php脚本时，发现函数名是test_php_server,那么它就会去compiler_globals.function_table中去找我们注册的C函数，并且按照要求给C函数填充参数的值，并且调用C函数。从而调用php的函数，实现了调用C函数。

	zend_API.c:1950:zend_register_functions
	if (!target_function_table) {
		target_function_table = CG(function_table);
	}
	# define CG(v) (compiler_globals.v)


### 注册全局常量 ###

	PHP_MINIT_FUNCTION(mysqli){
		//....
		/* mysqli_options */
		REGISTER_LONG_CONSTANT("MYSQLI_READ_DEFAULT_GROUP", 
		MYSQL_READ_DEFAULT_GROUP, CONST_CS | CONST_PERSISTENT);
	}

	zend_constants.h
	#define REGISTER_NULL_CONSTANT(name, flags)  zend_register_null_constant((name), sizeof(name)-1, (flags), module_number)
	#define REGISTER_BOOL_CONSTANT(name, bval, flags)  zend_register_bool_constant((name), sizeof(name)-1, (bval), (flags), module_number)
	#define REGISTER_LONG_CONSTANT(name, lval, flags)  zend_register_long_constant((name), sizeof(name)-1, (lval), (flags), module_number)
	#define REGISTER_DOUBLE_CONSTANT(name, dval, flags)  zend_register_double_constant((name), sizeof(name)-1, (dval), (flags), module_number)
	#define REGISTER_STRING_CONSTANT(name, str, flags)  zend_register_string_constant((name), sizeof(name)-1, (str), (flags), module_number)
	#define REGISTER_STRINGL_CONSTANT(name, str, len, flags)  zend_register_stringl_constant((name), sizeof(name)-1, (str), (len), (flags), module_number)
	
	#define REGISTER_NS_NULL_CONSTANT(ns, name, flags)  zend_register_null_constant(ZEND_NS_NAME(ns, name), sizeof(ZEND_NS_NAME(ns, name))-1, (flags), module_number)
	#define REGISTER_NS_BOOL_CONSTANT(ns, name, bval, flags)  zend_register_bool_constant(ZEND_NS_NAME(ns, name), sizeof(ZEND_NS_NAME(ns, name))-1, (bval), (flags), module_number)
	#define REGISTER_NS_LONG_CONSTANT(ns, name, lval, flags)  zend_register_long_constant(ZEND_NS_NAME(ns, name), sizeof(ZEND_NS_NAME(ns, name))-1, (lval), (flags), module_number)
	#define REGISTER_NS_DOUBLE_CONSTANT(ns, name, dval, flags)  zend_register_double_constant(ZEND_NS_NAME(ns, name), sizeof(ZEND_NS_NAME(ns, name))-1, (dval), (flags), module_number)
	#define REGISTER_NS_STRING_CONSTANT(ns, name, str, flags)  zend_register_string_constant(ZEND_NS_NAME(ns, name), sizeof(ZEND_NS_NAME(ns, name))-1, (str), (flags), module_number)
	#define REGISTER_NS_STRINGL_CONSTANT(ns, name, str, len, flags)  zend_register_stringl_constant(ZEND_NS_NAME(ns, name), sizeof(ZEND_NS_NAME(ns, name))-1, (str), (len), (flags), module_number)
	
	#define REGISTER_MAIN_NULL_CONSTANT(name, flags)  zend_register_null_constant((name), sizeof(name)-1, (flags), 0)
	#define REGISTER_MAIN_BOOL_CONSTANT(name, bval, flags)  zend_register_bool_constant((name), sizeof(name)-1, (bval), (flags), 0)
	#define REGISTER_MAIN_LONG_CONSTANT(name, lval, flags)  zend_register_long_constant((name), sizeof(name)-1, (lval), (flags), 0)
	#define REGISTER_MAIN_DOUBLE_CONSTANT(name, dval, flags)  zend_register_double_constant((name), sizeof(name)-1, (dval), (flags), 0)
	#define REGISTER_MAIN_STRING_CONSTANT(name, str, flags)  zend_register_string_constant((name), sizeof(name)-1, (str), (flags), 0)
	#define REGISTER_MAIN_STRINGL_CONSTANT(name, str, len, flags)  zend_register_stringl_constant((name), sizeof(name)-1, (str), (len), (flags), 0)

其中注册的常量是一个zend_constant结构体

	typedef struct _zend_constant {
		zval value;
		zend_string *name;
		int flags;
		int module_number;
	} zend_constant;


zend\_register\_xxx\_constant会调用zend\_register\_constant函数，进而将常量注册到
EG(zend_constants)即executor_globals.zend_constants中

	# define EG(v) (executor_globals.v)


### 类名与类的属性 ###

我们可以在PHP_MINIT_FUNCTION中找到注册类的的代码

	pdo.c	
	PHP_MINIT_FUNCTION(pdo)
	{
		pdo_stmt_init();
	
		return SUCCESS;
	}

	pdo_stmt.c
	void pdo_stmt_init(void)
	{
		zend_class_entry ce;
	
		INIT_CLASS_ENTRY(ce, "PDOStatement", pdo_dbstmt_functions);
		pdo_dbstmt_ce = zend_register_internal_class(&ce);
		pdo_dbstmt_ce->get_iterator = pdo_stmt_iter_get;
		pdo_dbstmt_ce->create_object = pdo_dbstmt_new;
		zend_class_implements(pdo_dbstmt_ce, 1, zend_ce_traversable);
		zend_declare_property_null(pdo_dbstmt_ce, "queryString", sizeof("queryString")-1, ZEND_ACC_PUBLIC);
		//...
	}

首先调用INIT\_CLASS\_ENTRY初始化zend\_class\_entry结构体，然后调用zend\_register\_internal\_class将类注册到内核中。

由于内容太多就不进行展开，但是我们看一下zend\_class\_entry结构体，最终

	ce.name = "PDOStatement";
	ce.info.internal.builtin_functions = pdo_dbstmt_functions;

zend\_class\_entry结构体

	struct _zend_class_entry {
		char type;
		zend_string *name;
		struct _zend_class_entry *parent;
		int refcount;
		uint32_t ce_flags;
	
		int default_properties_count;
		int default_static_members_count;
		zval *default_properties_table;
		zval *default_static_members_table;
		zval *static_members_table;
		HashTable function_table;
		HashTable properties_info;
		HashTable constants_table;
	
		union _zend_function *constructor;
		union _zend_function *destructor;
		union _zend_function *clone;
		union _zend_function *__get;
		union _zend_function *__set;
		union _zend_function *__unset;
		union _zend_function *__isset;
		union _zend_function *__call;
		union _zend_function *__callstatic;
		union _zend_function *__tostring;
		union _zend_function *__debugInfo;
		union _zend_function *serialize_func;
		union _zend_function *unserialize_func;
	
		zend_class_iterator_funcs iterator_funcs;
	
		/* handlers */
		zend_object* (*create_object)(zend_class_entry *class_type);
		zend_object_iterator *(*get_iterator)(zend_class_entry *ce, zval *object, int by_ref);
		int (*interface_gets_implemented)(zend_class_entry *iface, zend_class_entry *class_type); /* a class implements this interface */
		union _zend_function *(*get_static_method)(zend_class_entry *ce, zend_string* method);
	
		/* serializer callbacks */
		int (*serialize)(zval *object, unsigned char **buffer, size_t *buf_len, zend_serialize_data *data);
		int (*unserialize)(zval *object, zend_class_entry *ce, const unsigned char *buf, size_t buf_len, zend_unserialize_data *data);
	
		uint32_t num_interfaces;
		uint32_t num_traits;
		zend_class_entry **interfaces;
	
		zend_class_entry **traits;
		zend_trait_alias **trait_aliases;
		zend_trait_precedence **trait_precedences;
	
		union {
			struct {
				zend_string *filename;
				uint32_t line_start;
				uint32_t line_end;
				zend_string *doc_comment;
			} user;
			struct {
				const struct _zend_function_entry *builtin_functions;
				struct _zend_module_entry *module;
			} internal;
		} info;
	};

然后调用注册函数,最后执行以下代码，将类加入到compiler_globals.class_table中

	zend_hash_update_ptr(CG(class_table), lowercase_name, class_entry);

ce.ce_flags可以设置类的可见性，它可以有以下的值。
	
	/* method flags (types) */
	#define ZEND_ACC_STATIC			0x01
	#define ZEND_ACC_ABSTRACT		0x02
	#define ZEND_ACC_FINAL			0x04
	#define ZEND_ACC_IMPLEMENTED_ABSTRACT		0x08
	
	/* class flags (types) */
	/* ZEND_ACC_IMPLICIT_ABSTRACT_CLASS is used for abstract classes (since it is set by any abstract method even interfaces MAY have it set, too). */
	/* ZEND_ACC_EXPLICIT_ABSTRACT_CLASS denotes that a class was explicitly defined as abstract by using the keyword. */
	#define ZEND_ACC_IMPLICIT_ABSTRACT_CLASS	0x10
	#define ZEND_ACC_EXPLICIT_ABSTRACT_CLASS	0x20
	#define ZEND_ACC_INTERFACE		            0x80
	#define ZEND_ACC_TRAIT						0x120
	
	/* method flags (visibility) */
	/* The order of those must be kept - public < protected < private */
	#define ZEND_ACC_PUBLIC		0x100
	#define ZEND_ACC_PROTECTED	0x200
	#define ZEND_ACC_PRIVATE	0x400
	#define ZEND_ACC_PPP_MASK  (ZEND_ACC_PUBLIC | ZEND_ACC_PROTECTED | ZEND_ACC_PRIVATE)
	
	#define ZEND_ACC_CHANGED	0x800
	#define ZEND_ACC_IMPLICIT_PUBLIC	0x1000
	
	/* method flags (special method detection) */
	#define ZEND_ACC_CTOR		0x2000
	#define ZEND_ACC_DTOR		0x4000
	#define ZEND_ACC_CLONE		0x8000
	
	/* method flag (bc only), any method that has this flag can be used statically and non statically. */
	#define ZEND_ACC_ALLOW_STATIC	0x10000
	
	/* shadow of parent's private method/property */
	#define ZEND_ACC_SHADOW 0x20000
	
	/* deprecation flag */
	#define ZEND_ACC_DEPRECATED 0x40000
	
	/* class implement interface(s) flag */
	#define ZEND_ACC_IMPLEMENT_INTERFACES 0x80000
	#define ZEND_ACC_IMPLEMENT_TRAITS	  0x400000
	
	/* class constants updated */
	#define ZEND_ACC_CONSTANTS_UPDATED	  0x100000
	
	/* user class has methods with static variables */
	#define ZEND_HAS_STATIC_IN_METHODS    0x800000
	
	
	#define ZEND_ACC_CLOSURE              0x100000
	#define ZEND_ACC_GENERATOR            0x800000
	
	/* function flag for internal user call handlers __call, __callstatic */
	#define ZEND_ACC_CALL_VIA_HANDLER     0x200000
	
	/* disable inline caching */
	#define ZEND_ACC_NEVER_CACHE          0x400000
	
	#define ZEND_ACC_VARIADIC				0x1000000
	
	#define ZEND_ACC_RETURN_REFERENCE		0x4000000
	#define ZEND_ACC_DONE_PASS_TWO			0x8000000
	
	/* function has arguments with type hinting */
	#define ZEND_ACC_HAS_TYPE_HINTS			0x10000000
	
	/* op_array has finally blocks */
	#define ZEND_ACC_HAS_FINALLY_BLOCK		0x20000000
	
	/* internal function is allocated at arena */
	#define ZEND_ACC_ARENA_ALLOCATED		0x20000000
	
	/* Function has a return type hint (or class has such non-private function) */
	#define ZEND_ACC_HAS_RETURN_TYPE		0x40000000


#### 属性的实现 ####

通过调用zend\_declare\_property\_xxx将非常量属性添加到ce.properties\_info中。

	typedef struct _zend_property_info {
		uint32_t offset; /* property offset for object properties or
		                      property index for static properties */
		uint32_t flags;/*访问属性*/
		zend_string *name;
		zend_string *doc_comment;
		zend_class_entry *ce;
	} zend_property_info;

通过zend\_declare\_class\_constant\_xxx将常量添加到ce.constants\_table中。
常量的哈希表的key对应常量的名称，value对应常量的值。


### 类的方法注册 ###

在上面类名与属性中我们已经知道类是怎么被注册到compiler_globals.class_table中的，那么方法又是怎么被注册到类中呢？我们发现INIT\_CLASS\_ENTRY第三个参数就是我们的方法列表。

	INIT_CLASS_ENTRY(ce, "PDOStatement", pdo_dbstmt_functions);

	const zend_function_entry pdo_dbstmt_functions[] = {
		PHP_ME(PDOStatement, execute,		arginfo_pdostatement_execute,		ZEND_ACC_PUBLIC)
		//...
		{NULL, NULL, NULL}
	};

	#define PHP_ME          ZEND_ME
	#define ZEND_ME(classname, name, arg_info, flags)	ZEND_FENTRY(name, ZEND_MN(classname##_##name), arg_info, flags)
	#define ZEND_MN(name) zim_##name
	#define ZEND_FENTRY(zend_name, name, arg_info, flags)	{ #zend_name, name, arg_info, (uint32_t) (sizeof(arg_info)/sizeof(struct _zend_arg_info)-1), flags },

展开即：

	const zend_function_entry pdo_dbstmt_functions[] = {
		PHP_ME(PDOStatement, execute,		arginfo_pdostatement_execute,		ZEND_ACC_PUBLIC)

		{"execute",zim_PDOStatement_execute,arginfo_pdostatement_execute,
			参数个数,ZEND_ACC_PUBLIC},
		//...
		{NULL, NULL, NULL}
	};

mysqli扩展中

	const zend_function_entry mysqli_link_methods[] = {
		PHP_FALIAS(autocommit, mysqli_autocommit, arginfo_class_mysqli_autocommit)
	{NULL, NULL, NULL}
	};

	#define PHP_FALIAS		ZEND_FALIAS
	#define ZEND_FALIAS(name, alias, arg_info)			ZEND_FENTRY(name, ZEND_FN(alias), arg_info, 0)
	#define ZEND_FN(name) zif_##name

展开即：

	{"autocommit","zif_mysqli_autocommit",
		arginfo_class_mysqli_autocommit,0},

可见要设置方法的访问属性，最好还是用ZEND_FENTRY宏。

	#define ZEND_FUNCTION(name)				ZEND_NAMED_FUNCTION(ZEND_FN(name))
	#define ZEND_METHOD(classname, name)	ZEND_NAMED_FUNCTION(ZEND_MN(classname##_##name))

通过上面的代码，可以看出，申明全局函数可以用PHP_FUNCTION

声明类的方法名可以用PHP\_METHOD，由于方法最终都是函数的结构体，所以用上面的也行。
当需要支持类与全局函数时，最好用PHP\_FUNCTION进行申明，然后用PHP\_FALIAS进行注册。


### 脚本调用类 ###

上面我们解析了脚本调用函数，通过简单的分析，我们可以知道调用方法跟调用函数基本一致，区别在多了运行的上下文环境，即方法是某个类的成员函数，调用时要判断访问权限之类的。


