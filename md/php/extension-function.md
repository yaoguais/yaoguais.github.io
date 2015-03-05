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
5. 类名与类的属性
6. 类的方法注册
7. 脚本调用类
8. 示例代码

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

其中最常用到的函数就是zend_parse_method_parameters了

	ZEND_API int zend_parse_method_parameters(int num_args, zval *this_ptr, const char *type_spec, ...);
	num_args  参数的个数
	this_ptr  this指针
	type_spec 参数的格式化字符串
	...       接受参数的变量地址