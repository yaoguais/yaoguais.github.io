## php脚本解析与调用  ##

1.赋值语句的分析


### 赋值语句的分析 ###

我们将分析一个简单的脚本来看看php在编译这个脚本的时候, 在内核中都做了什么?
能力有限,只能从执行opcode开始了.

	test.php(文件就3行)
	<?php
	$str = 'aaa';
	$strCopy = $str;
        
然后我们在gdb中通过调试php来查看内核是怎么分析这个脚本的。

	#gdb /root/php7d/bin/php
	(gdb) set args /home/yaoguai/github/test.php
	//我们知道php是在zend_execute函数中调用execute_ex函数执行opcode.
	(gdb) b execute_ex
	(gdb) r

然后程序停止在

	if (UNEXPECTED((ret = OPLINE->handler(execute_data)) != 0)) {
	    	if (EXPECTED(ret > 0)) {
	    		execute_data = EG(current_execute_data);
	    	} else {
	    		return;
	    	}
	}
	
	OPLINE->handler即是调用的函数指针，展开为execute_data->opline->handler
	#define EX(element) 			((execute_data)->element)
	#define OPLINE EX(opline)
	
	//打印该函数指针
	(gdb) p execute_data->opline->handler
	$1 = (opcode_handler_t) 0x8b607a <ZEND_ASSIGN_SPEC_CV_CONST_HANDLER>
        
从前面的文章中我们知道非函数/方法内的一般变量是保存在executor_globals.symbol_table变量中的,现在我们通过gdb打印这个变量.

	(gdb) p executor\_globals.symbol\_table
	$6 = {gc = {refcount = 1, u = {v = {type = 7 '\a', flags = 0 '\000', 
	    gc_info = 0}, type_info = 7}}, u = {v = {flags = 10 '\n', 
	  nApplyCount = 0 '\000', nIteratorsCount = 0 '\000', reserve = 0 '\000'}, 
	flags = 10}, nTableSize = 64, nTableMask = 63, nNumUsed = 9, 
	nNumOfElements = 9, nInternalPointer = 0, nNextFreeElement = 0, 
	arData = 0x7ffff685a000, arHash = 0x7ffff685a800, 
	pDestructor = 0x81fe95 <_zval_ptr_dtor_wrapper>}
          
可以知道符号表中有9个元素,前面的文章中我们定义了一个打印hash_table的gdb函数.

	(gdb) print_hash executor_globals.symbol_table
	_GET  IS_ARRAY
	_POST  IS_ARRAY
	_COOKIE  IS_ARRAY
	_FILES  IS_ARRAY
	argv  IS_ARRAY
	argc  IS_LONG
	_SERVER  IS_ARRAY
	str  15
	strCopy  15
        
这里的15是IS_INDIRECT,意思很明显是"直接的"的意思.

	#define IS_INDIRECT             	15
    
现在我们使用gdb查看一下这个$str变量中内容是什么.

	(gdb) printf "%s",executor_globals.symbol_table.arData[7].key.val
	str
	(gdb) call php_var_dump(executor_globals.symbol_table.arData[7].val,1)
	UNKNOWN:0
	
可以看到,变量中没有保存任何东西.从而也知道了IS_INDIRECT代表的意思.
        
我们现在看看ZEND\_ASSIGN\_SPEC\_CV\_CONST\_HANDLER这个函数的实现,首先分析函数的名字,
CV是compile\_var的意思,const是常量的意思.结合php脚本语句可以知道是把编译变量赋值给常量的意思.
        
	(gdb) s
	ZEND_ASSIGN_SPEC_CV_CONST_HANDLER (execute_data=0x7ffff6815030)
	//省略其他的代码        
	value = EX_CONSTANT(opline->op2);
	variable_ptr = _get_zval_ptr_cv_undef_BP_VAR_W(execute_data, opline->op1.var);
	(gdb) p *value
	$12 = {value = {lval = 140737328986688, dval = 6.9533479339779995e-310, 
	    counted = 0x7ffff6803a40, str = 0x7ffff6803a40, arr = 0x7ffff6803a40, 
	    obj = 0x7ffff6803a40, res = 0x7ffff6803a40, ref = 0x7ffff6803a40, 
	    ast = 0x7ffff6803a40, zv = 0x7ffff6803a40, ptr = 0x7ffff6803a40, 
	    ce = 0x7ffff6803a40, func = 0x7ffff6803a40, ww = {w1 = 4135598656, 
	      w2 = 32767}}, u1 = {v = {type = 6 '\006', type_flags = 0 '\000', 
	      const_flags = 0 '\000', reserved = 0 '\000'}, type_info = 6}, u2 = {
	    var_flags = 4294967295, next = 4294967295, cache_slot = 4294967295, 
	    lineno = 4294967295, num_args = 4294967295, fe_pos = 4294967295, 
	    fe_iter_idx = 4294967295}}
	//可以看到value.u1.type=6即是IS_STRING的意思
	(gdb) printf "%s",value.value.str.val
	aaa
	(gdb) call php_var_dump(executor_globals.symbol_table.arData[7].val,1)
	UNKNOWN:0
	//这时$str依旧没有被赋值
	value = zend_assign_to_variable(variable_ptr, value, IS_CONST);
	(gdb) printf "%s",value.value.str.val
	aaa
	(gdb) p value
	$15 = (zval *) 0x7ffff6815090
	//可以看到value的值并没有发生变化
	(gdb) call php_var_dump(executor_globals.symbol_table.arData[7].val,1)
	string(3) "aaa"
	//然后再打印$str的值,发现已经变成"aaa",可以得知赋值的操作是zend_assign_to_variable执行的.
	(gdb) call php_var_dump(executor_globals.symbol_table.arData[8].val,1)
	UNKNOWN:0
	//也可以发现$strCopy的值还是空的		
	//if条件不成立,调用ZEND_VM_NEXT_OPCODE();继续分析下一个OPCODE
	if (UNEXPECTED(RETURN_VALUE_USED(opline))) {
		ZVAL_COPY(EX_VAR(opline->result.var), value);
	}
	
到这里$str = 'aaa';这句代码就分析完了.
下面分析$str = $strCopy;这句.

	(gdb) n
	(gdb) p execute_data->opline->handler
	$1 = (opcode_handler_t) 0x8bf1f7 <ZEND_ASSIGN_SPEC_CV_CV_HANDLER>
	//这里可以猜测函数的意思是编译变量赋值给编译变量的意思
	(gdb) s
	ZEND_ASSIGN_SPEC_CV_CV_HANDLER (execute_data=0x7ffff6815030)
	value = _get_zval_ptr_cv_deref_BP_VAR_R(execute_data, opline->op2.var);
	variable_ptr = _get_zval_ptr_cv_undef_BP_VAR_W(execute_data, opline->op1.var);
	(gdb) call php_var_dump(executor_globals.symbol_table.arData[7].val,1)
	string(3) "aaa"
	(gdb) call php_var_dump(executor_globals.symbol_table.arData[8].val,1)
	UNKNOWN:0
	(gdb) call php_var_dump(value,1)
	string(3) "aaa"
	(gdb) call php_var_dump(variable_ptr,1)
	string(3) "aaa"
	value = zend_assign_to_variable(variable_ptr, value, IS_CV);
	(gdb) call php_var_dump(executor_globals.symbol_table.arData[8].val,1)
	string(3) "aaa"
	//这里看到执行zend_assign_to_variable后$strCopy的值也变成"aaa"了.
	
继续执行程序.
	(gdb) p execute_data->opline->handler
	$4 = (opcode_handler_t) 0x87d09b <ZEND_RETURN_SPEC_CONST_HANDLER>
	//从前面的分析我们知道$str,$strCopy已经被正确赋值了,那么这是在干什么呢?
	(gdb) s
	ZEND_RETURN_SPEC_CONST_HANDLER (execute_data=0x7ffff6815030)
	(gdb) s
	zend_leave_helper_SPEC (execute_data=0x7ffff6815030)
	//最后进入到这个条件分支
	else /* if (call_kind == ZEND_CALL_TOP_CODE) */ {
		zend_array *symbol_table = EX(symbol_table);
	
		zend_detach_symbol_table(execute_data);
		old_execute_data = EX(prev_execute_data);
		while (old_execute_data) {
			if (old_execute_data->func && ZEND_USER_CODE(old_execute_data->func->op_array.type)) {
				if (old_execute_data->symbol_table == symbol_table) {
					zend_attach_symbol_table(old_execute_data);
				}
				break;
			}
			old_execute_data = old_execute_data->prev_execute_data;
		}
		EG(current_execute_data) = EX(prev_execute_data);
	}
	zend_vm_stack_free_call_frame(execute_data);
	ZEND_VM_RETURN();//return -1;
	
最后还是返回execute_ex函数中,此时函数的返回值是-1

	if (UNEXPECTED((ret = OPLINE->handler(execute_data)) != 0)) {
		if (EXPECTED(ret > 0)) {
			execute_data = EG(current_execute_data);
		} else {
			return;
		}
	}
	//根据条件会执行return;语句,直接跳出了while循环.
	
	(gdb) n
	zend_execute_scripts (type=8, retval=0x0, file_count=3)

最后返回zend_execute_scripts函数.然后执行完我们的脚本,再调佣rshutdown函数,最后mshutdown,至此php程序正常终止.