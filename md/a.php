<?php

$str = <<<EOF
1.  ¸ÅÊö
2.  ½¨Òé
3.  zval
4.  reference
5.  Boolean
6.  string
7.  zend_string API
8.  smart_str and smart_string
9.  strpprintf
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
EOF;

$arr = explode("\n",$str);
$arr = array_map(function($item){
	return '###  '.trim(substr($item,4)).'  ###';
},$arr);

file_put_contents("a.txt",implode("\r\n",$arr));