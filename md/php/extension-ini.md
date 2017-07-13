## ini文件解析，php 扩展开发（二） ##

运行环境

- PHP Version 7.0.0-dev (`./configure  --prefix=/root/php7d --without-pear --enable-fpm --enable-debug`)
- Linux version 2.6.32-504.1.3.el6.x86_64 (gcc version 4.4.7 20120313 (Red Hat 4.4.7-11) (GCC) )
- swoole (1.7.8 stable for php extension)

前言：

我们都知道大多数扩展都有自己的配置项，那么它的怎么从配置文件中读取出来，又是怎么传给扩展自身的呢？今天就让我们一探究竟。

目录：

1. 配置文件解析
2. 模块扩展的配置
3. 总结

### 1.配置文件解析 ###

在[php cli执行流程](?s=md/php/cli.md)一文中，我们了解到php.ini文件解析是通过php\_module\_startup函数中的php\_init\_config实现的。php\_init\_config的实现如下：

	PHP-SRC/main/php_ini.c:384
	int php_init_config(void)
	{
		//...
		zend_hash_init(&configuration_hash, 8, NULL, config_zval_dtor, 1);/*首先初始化configuration_hash全局变量*/
		/*调用zend_parse_ini_file解析文件,并将解析的结果保存到configuration_hash中*/		
		zend_parse_ini_file(&fh, 1, ZEND_INI_SCANNER_NORMAL, (zend_ini_parser_cb_t) php_ini_parser_cb, &configuration_hash);
		{
			zval tmp;

			ZVAL_NEW_STR(&tmp, zend_string_init(fh.filename, strlen(fh.filename), 1));
			/*更新cfg_file_path这个key*/
			zend_hash_str_update(&configuration_hash, "cfg_file_path", sizeof("cfg_file_path")-1, &tmp);
			if (php_ini_opened_path) {
				efree(php_ini_opened_path);
			}
			php_ini_opened_path = zend_strndup(Z_STRVAL(tmp), Z_STRLEN(tmp));
		}
		/*确定其他配置文件的目录*/
		/* Check for PHP_INI_SCAN_DIR environment variable to override/set config file scan directory */
		php_ini_scanned_path = getenv("PHP_INI_SCAN_DIR");
		if (!php_ini_scanned_path) {
			/* Or fall back using possible --with-config-file-scan-dir setting (defaults to empty string!) */
			php_ini_scanned_path = PHP_CONFIG_FILE_SCAN_DIR;
		}
		php_ini_scanned_path_len = (int)strlen(php_ini_scanned_path);
		/*遍历目录，并获取所有文件*/
		bufpath = estrdup(php_ini_scanned_path);
		for (debpath = bufpath ; debpath ; debpath=endpath) {
			endpath = strchr(debpath, DEFAULT_DIR_SEPARATOR);
			if (endpath) {
				*(endpath++) = 0;
			}
			if (!debpath[0]) {
				/* empty string means default builtin value
				   to allow "/foo/phd.d:" or ":/foo/php.d" */
				debpath = PHP_CONFIG_FILE_SCAN_DIR;
			}
			lenpath = (int)strlen(debpath);

			if (lenpath > 0 && (ndir = php_scandir(debpath, &namelist, 0, php_alphasort)) > 0) {

				for (i = 0; i < ndir; i++) {

					/* check for any file with .ini extension */
					if (!(p = strrchr(namelist[i]->d_name, '.')) || (p && strcmp(p, ".ini"))) {
						free(namelist[i]);
						continue;
					}
					/* Reset active ini section */
					RESET_ACTIVE_INI_HASH();

					if (IS_SLASH(debpath[lenpath - 1])) {
						snprintf(ini_file, MAXPATHLEN, "%s%s", debpath, namelist[i]->d_name);
					} else {
						snprintf(ini_file, MAXPATHLEN, "%s%c%s", debpath, DEFAULT_SLASH, namelist[i]->d_name);
					}
					if (VCWD_STAT(ini_file, &sb) == 0) {
						if (S_ISREG(sb.st_mode)) {
							if ((fh2.handle.fp = VCWD_FOPEN(ini_file, "r"))) {
								fh2.filename = ini_file;
								fh2.type = ZEND_HANDLE_FP;
								/*调用zend_parse_ini_file解析文件并将解析结果添加到configuration_hash中*/
								if (zend_parse_ini_file(&fh2, 1, ZEND_INI_SCANNER_NORMAL,
									 (zend_ini_parser_cb_t) php_ini_parser_cb, &configuration_hash) == SUCCESS) {
									/* Here, add it to the list of ini files read */
									l = (int)strlen(ini_file);
									total_l += l + 2;
									p = estrndup(ini_file, l);
									zend_llist_add_element(&scanned_ini_list, &p);
								}
							}
						}
					}
					free(namelist[i]);
				}
				free(namelist);
			}
		}
		efree(bufpath);
		/...
		return SUCCESS;
	}


通过gdb查看configuration_hash的内容
	
	(gdb) p configuration_hash
	$1 = {u = {v = {flags = 11 '\v', nApplyCount = 0 '\000', reserve = 0}, flags = 11}, nTableSize = 8, 
	  nTableMask = 7, nNumUsed = 2, nNumOfElements = 2, nInternalPointer = 0, nNextFreeElement = 0, 
	  arData = 0xfd1270, arHash = 0xfd1370, pDestructor = 0x79dc13 <config_zval_dtor>}
	/*可以看出Hash表中只用两个元素*/
	(gdb) p (*configuration_hash.arData[0].key.val)@20
	$2 = "report_zend_debug\000\000"
	/*第一个key是report_zend_debug*/
	(gdb) p (*configuration_hash.arData[1].key.val)@20
	$3 = "display_errors\000\000A\002\000"
	/*第二个key是display_errors*/

通过在编写$HOME/.gdbinit文件，实现一个用来打印php hashTable变量的命令，其内容如下

	
	define print_zval
        printf "  "
        if $arg0.u1.v.type == 0
                printf "IS_UNDEF\n"
        end
        if $arg0.u1.v.type == 1
                printf "IS_NULL\n"
        end
        if $arg0.u1.v.type == 2
                printf "IS_FALSE\n"
        end
        if $arg0.u1.v.type == 3
                printf "IS_TRUE\n"
        end
        if $arg0.u1.v.type == 4
                printf "IS_LONG\n"
        end
        if $arg0.u1.v.type == 5
                printf "IS_DOUBLE\n"
        end
        if $arg0.u1.v.type == 6
                printf "IS_STRING %s\n",$arg0.value.str.val
        end
        if $arg0.u1.v.type == 7
                printf "IS_ARRAY\n"
        end
        if $arg0.u1.v.type == 8
                printf "IS_OBJECT\n"
        end
        if $arg0.u1.v.type >= 9
                printf "%d\n",$arg0.u1.v.type
        end
	end


	define print_hash
        set $i = 0
        set $num = 0
        set $len = $arg0.nTableSize - 1
        while $i < $len
                if $arg0.arData[$i].key.len > 0
                        printf "%s",$arg0.arData[$i].key.val
                        print_zval $arg0.arData[$i].val
                        set $num = $num + 1
                end
                set $i = $i + 1
        end
        printf "total:%d\n",$num
	end


调试php\_init\_config函数，在PHP-SRC/main/php_ini.c:595前停止
	
	591             if (fh.handle.fp) {
	(gdb) 
	592                     fh.type = ZEND_HANDLE_FP;
	(gdb) 
	593                     RESET_ACTIVE_INI_HASH();
	(gdb) 
	595                     zend_parse_ini_file(&fh, 1, ZEND_INI_SCANNER_NORMAL, (zend_ini_parser_cb_t)
								 php_ini_parser_cb, &configuration_hash);
	(gdb) print_hash configuration_hash
	report_zend_debug  IS_STRING 0
	display_errors  IS_STRING 1
	Cannot access memory at address 0x10
	(gdb) n
	600                             ZVAL_NEW_STR(&tmp, zend_string_init(fh.filename, strlen(fh.filename), 1));
	(gdb) print_hash configuration_hash
	report_zend_debug  IS_STRING 0
	display_errors  IS_STRING 1
	engine  IS_STRING 1
	short_open_tag  IS_STRING 
	precision  IS_STRING 14
	//...
	url_rewriter.tags  IS_STRING a=href,area=href,frame=src,input=src,form=fakeentry
	mssql.allow_persistent  IS_STRING 1
	mssql.max_persistent  IS_STRING -1
	mssql.max_links  IS_STRING -1
	mssql.min_error_severity  IS_STRING 10
	mssql.min_message_severity  IS_STRING 10
	mssql.compatibility_mode  IS_STRING 
	mssql.secure_connection  IS_STRING 
	tidy.clean_output  IS_STRING 
	soap.wsdl_cache_enabled  IS_STRING 1
	soap.wsdl_cache_dir  IS_STRING /tmp
	soap.wsdl_cache_ttl  IS_STRING 86400
	soap.wsdl_cache_limit  IS_STRING 5
	ldap.max_links  IS_STRING -1
	Cannot access memory at address 0x1700000048
	(gdb) 

我们可以发现，所有的元素都是STRING类型的，并且on、off已经被转换成1、-1了。




### 2.模块扩展的配置 ###

配置完configuration_hash后，紧接着就进行扩展的配置。
	
	if (php_init_config() == FAILURE) {
		return FAILURE;
	}

	/* Register PHP core ini entries */
	REGISTER_INI_ENTRIES();

REGISTER_INI_ENTRIES宏展开
	
	#define REGISTER_INI_ENTRIES() zend_register_ini_entries(ini_entries, module_number)
	
ini_entries是一个zend_ini_entry_def结构体

	typedef struct _zend_ini_entry_def {
		const char *name;
		ZEND_INI_MH((*on_modify));	/*配置项注册或修改的时候会调用*/
		void *mh_arg1;
		void *mh_arg2;
		void *mh_arg3;
		const char *value;
		void (*displayer)(zend_ini_entry *ini_entry, int type);
		int modifiable;
	
		uint name_length;
		uint value_length;
	} zend_ini_entry_def;

	#define ZEND_INI_MH(name) int name(zend_ini_entry *entry, 
			zend_string *new_value, void *mh_arg1, void *mh_arg2, void *mh_arg3, int stage)

通过分析，得出zend_register_ini_entries的ini_entries来自main.c:524的PHP_INI_BEGIN()宏

	#define PHP_INI_BEGIN		ZEND_INI_BEGIN
	#define ZEND_INI_BEGIN()		static const zend_ini_entry_def ini_entries[] = {
	#define ZEND_INI_END()		{ NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0} };



zend_register_ini_entries实现如下

	ZEND_API int zend_register_ini_entries(const zend_ini_entry_def *ini_entry, int module_number) /* { { { */
	{
		zend_ini_entry *p;
		zval *default_value;
		HashTable *directives = registered_zend_ini_directives;
	//...
	
		/*通过ZEND_INI_END可以看出第一个元素的name属性是NULL*/
		while (ini_entry->name) {
			p = pemalloc(sizeof(zend_ini_entry), 1);
			p->name = zend_string_init(ini_entry->name, ini_entry->name_length, 1);
			p->on_modify = ini_entry->on_modify;
			p->mh_arg1 = ini_entry->mh_arg1;
			p->mh_arg2 = ini_entry->mh_arg2;
			p->mh_arg3 = ini_entry->mh_arg3;
			p->value = NULL;
			p->orig_value = NULL;
			p->displayer = ini_entry->displayer;
			p->modifiable = ini_entry->modifiable;
	
			p->orig_modifiable = 0;
			p->modified = 0;
			p->module_number = module_number;
	
			if (zend_hash_add_ptr(directives, p->name, (void*)p) == NULL) {
				if (p->name) {
					zend_string_release(p->name);
				}
				zend_unregister_ini_entries(module_number);
				return FAILURE;
			}
			if (((default_value = zend_get_configuration_directive(p->name)) != NULL) &&
	            (!p->on_modify || p->on_modify(p, Z_STR_P(default_value), p->mh_arg1, p->mh_arg2, p->mh_arg3, ZEND_INI_STAGE_STARTUP) == SUCCESS)) {
	
				p->value = zend_string_copy(Z_STR_P(default_value));
			} else {
				p->value = ini_entry->value ?
					zend_string_init(ini_entry->value, ini_entry->value_length, 1) : NULL;
	
				if (p->on_modify) {
					p->on_modify(p, p->value, p->mh_arg1, p->mh_arg2, p->mh_arg3, ZEND_INI_STAGE_STARTUP);
				}
			}
			ini_entry++;
		}
		return SUCCESS;
	}


zend_get_configuration_directive用来获取配置参数

	zend_get_configuration_directive_p = utility_functions->get_configuration_directive;
	
	:main.c:2097

	zuf.get_configuration_directive = php_get_configuration_directive_for_zend;
	static zval *php_get_configuration_directive_for_zend(zend_string *name)
	{
		return cfg_get_entry_ex(name);
	}
	PHPAPI zval *cfg_get_entry_ex(zend_string *name)
	{
		return zend_hash_find(&configuration_hash, name);
	}

最后我们可以看到，是获取configuration_hash中的值

	/*如果配置文件中存在配置项，那么就使用配置文件中的值,否则的话，就使用模块硬编码的默认值*/
	if (((default_value = zend_get_configuration_directive(p->name)) != NULL) &&
        (!p->on_modify || p->on_modify(p, Z_STR_P(default_value), p->mh_arg1, p->mh_arg2, p->mh_arg3, ZEND_INI_STAGE_STARTUP) == SUCCESS)) {

		p->value = zend_string_copy(Z_STR_P(default_value));
	}

这里初始化了ini_entries的值，现在我们对比一下扩展,以bcmath为例
	
	php_bcmath.h
	PHP_INI_BEGIN()
		STD_PHP_INI_ENTRY("bcmath.scale", "0", PHP_INI_ALL, OnUpdateLongGEZero, bc_precision, zend_bcmath_globals, bcmath_globals)
	PHP_INI_END()

	PHP_MINIT_FUNCTION(bcmath)
	{
		REGISTER_INI_ENTRIES();
	
		return SUCCESS;
	}
	
在MINIT函数中，调用REGISTER_INI_ENTRIES,读取configuration_hash中配置文件的内容，然后更新到自己的ini_entries变量中
这个同main.c中的ini_entries由于是不同文件的全局静态变量，所以没有联系。

同理，看一下swoole的实现

	PHP_INI_BEGIN()
	STD_PHP_INI_ENTRY("swoole.aio_thread_num", "2", PHP_INI_ALL, OnUpdateLong, aio_thread_num, zend_swoole_globals, swoole_globals)
	STD_PHP_INI_ENTRY("swoole.display_errors", "2", PHP_INI_ALL, OnUpdateBool, display_errors, zend_swoole_globals, swoole_globals)
	STD_PHP_INI_ENTRY("swoole.message_queue_key", "0", PHP_INI_ALL, OnUpdateString, message_queue_key, zend_swoole_globals, swoole_globals)
	/**
	 * Unix socket buffer size
	 */
	STD_PHP_INI_ENTRY("swoole.unixsock_buffer_size", "8388608", PHP_INI_ALL, OnUpdateLong, unixsock_buffer_size, zend_swoole_globals, swoole_globals)
	PHP_INI_END()

	PHP_MINIT_FUNCTION(swoole)
	{
		ZEND_INIT_MODULE_GLOBALS(swoole, php_swoole_init_globals, NULL);
		/*同样调用这个宏，让配置文件中的配置值覆盖硬编码的默认值*/
		REGISTER_INI_ENTRIES();

其中的ZEND_INIT_MODULE_GLOBALS展示

	#define ZEND_INIT_MODULE_GLOBALS(module_name, globals_ctor, globals_dtor)	\
		globals_ctor(&module_name##_globals);	
	#endif

即
	
	php_swoole_init_globals(&swoole_globals);

	static void php_swoole_init_globals(zend_swoole_globals *swoole_globals)
	{
	    swoole_globals->message_queue_key = 0;
	    swoole_globals->aio_thread_num = SW_AIO_THREAD_NUM_DEFAULT;
	    swoole_globals->socket_buffer_size = SW_SOCKET_BUFFER_SIZE;
	    swoole_globals->display_errors = 1;
	}


### 3.总结 ###

1. 解析配置文件，把解析的结果添加到configuration_hash变量中
2. 每个模块调用EGISTER_INI_ENTRIES();宏，来读取配置文件中用户设置的值，来覆盖自己的默认值

	