<?php

class a{
	private function func_a(){
	
	}
}

class b extends a{
	public function func_b(){
	
	}
}

$b = new b();
$b->func_a();

echo "end\n";

/*
(gdb) print_hash executor_globals->class_table
0: stdclass  17
1: traversable  17
2: iteratoraggregate  17
......................................................
140: xmlwriter  17
141: php_server  17
142: monster  17
143:   IS_UNDEF
144: a  17
145:   IS_UNDEF
146: b  17
(gdb) print_hash executor_globals->class_table.arData[144].val.value.ce.function_table
0: func_a  17
Cannot access memory at address 0x10
(gdb) print_hash executor_globals->class_table.arData[146].val.value.ce.function_table
0: func_b  17
1: func_a  17


可以看到作为class a的私有函数func_a在它的子类中也是存在的,只是不能访问而已.


调试一下，看看是哪一个方法进行了限制


(gdb) get_op_handlers op_array->opcodes
$1 = (opcode_handler_t) 0x879c1e <ZEND_NOP_SPEC_HANDLER>
$2 = (opcode_handler_t) 0x879c1e <ZEND_NOP_SPEC_HANDLER>
$3 = (opcode_handler_t) 0x879c1e <ZEND_NOP_SPEC_HANDLER>
$4 = (opcode_handler_t) 0x87d547 <ZEND_NEW_SPEC_CONST_HANDLER>
$5 = (opcode_handler_t) 0x87751c <ZEND_DO_FCALL_SPEC_HANDLER>
$6 = (opcode_handler_t) 0x8b8f4d <ZEND_ASSIGN_SPEC_CV_VAR_HANDLER>
$7 = (opcode_handler_t) 0x8b6174 <ZEND_INIT_METHOD_CALL_SPEC_CV_CONST_HANDLER>
$8 = (opcode_handler_t) 0x87751c <ZEND_DO_FCALL_SPEC_HANDLER>
$9 = (opcode_handler_t) 0x87c9b7 <ZEND_ECHO_SPEC_CONST_HANDLER>
$10 = (opcode_handler_t) 0x87d09b <ZEND_RETURN_SPEC_CONST_HANDLER>
$11 = (opcode_handler_t) 0x7ffff687b0d8
$12 = (opcode_handler_t) 0x140
$13 = (opcode_handler_t) 0x7ffff687b300
$14 = (opcode_handler_t) 0x7ffff6859a80
$15 = (opcode_handler_t) 0x900001406
$16 = (opcode_handler_t) 0x0
$17 = (opcode_handler_t) 0x7ffff6859b00


(gdb) b zend_error_noreturn
(gdb) bt
#0  zend_error (type=1, 
    format=0xc7d7e8 "Call to %s method %s::%s() from context '%s'")
    at /root/download/php-src-master/Zend/zend.c:1010
#1  0x000000000086580a in zend_std_get_method (obj_ptr=0x7fffffffaa50, 
    method_name=0x7ffff6859a40, key=0x7ffff6886050)
    at /root/download/php-src-master/Zend/zend_object_handlers.c:1088
#2  0x00000000008b649c in ZEND_INIT_METHOD_CALL_SPEC_CV_CONST_HANDLER (
    execute_data=0x7ffff6815030)
    at /root/download/php-src-master/Zend/zend_vm_execute.h:26948
#3  0x0000000000876798 in execute_ex (execute_data=0x7ffff6815030)
    at /root/download/php-src-master/Zend/zend_vm_execute.h:352
#4  0x00000000008768ee in zend_execute (op_array=0x7ffff6877000, 
    return_value=0x0)
    at /root/download/php-src-master/Zend/zend_vm_execute.h:381
#5  0x0000000000822ee0 in zend_execute_scripts (type=8, retval=0x0, 
    file_count=3) at /root/download/php-src-master/Zend/zend.c:1311
#6  0x0000000000793368 in php_execute_script (primary_file=0x7fffffffd0a0)
    at /root/download/php-src-master/main/main.c:2539
#7  0x00000000008d08ee in do_cli (argc=2, argv=0xfb5df0)
    at /root/download/php-src-master/sapi/cli/php_cli.c:979
#8  0x00000000008d1aad in main (argc=2, argv=0xfb5df0)
    at /root/download/php-src-master/sapi/cli/php_cli.c:1355
    
可以看出是在ZEND_INIT_METHOD_CALL_SPEC_CV_CONST_HANDLER这个opcode中进行了限制.

再次调试程序,在zend_std_get_method处打一个断点,可以发现是下面的代码导致致命错误.

if (fbc->op_array.fn_flags & ZEND_ACC_PRIVATE) {
	zend_function *updated_fbc;

	/* Ensure that if we're calling a private function, we're allowed to do so.
	 * If we're not and __call() handler exists, invoke it, otherwise error out.
	 */
	updated_fbc = zend_check_private_int(fbc, zobj->ce, lc_method_name);
	if (EXPECTED(updated_fbc != NULL)) {
		fbc = updated_fbc;
	} else {
		if (zobj->ce->__call) {
			fbc = zend_get_user_call_function(zobj->ce, method_name);
		} else {
			zend_error_noreturn(E_ERROR, "Call to %s method %s::%s() from context '%s'", zend_visibility_string(fbc->common.fn_flags), ZEND_FN_SCOPE_NAME(fbc), method_name->val, EG(scope) ? EG(scope)->name->val : "");
		}
	}
}

