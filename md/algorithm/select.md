## 排序算法之选择排序 ##

### 直接选择排序 ###

基本思路：选择序列中最小的元素，交换到第一个位置，然后在剩下的序列中重复以上操作，直至序列有序。

php代码：

	function select_sort(&$list,$left,$right){
	    $right = $right<0 ? count($list)-1 : $right;
	    for($i=0;$i<=$right;$i++){
	        $min = $i;
	        for($j=$i+1;$j<=$right;$j++){
	            if($list[$j]<$list[$min]){
	                $min = $j;
	            }
	        }
	        if($i!=$min){
	            $tmp = $list[$min];
	            $list[$min] = $list[$i];
	            $list[$i] = $tmp;
	        }
	    }
	}

时间复杂度：O(n^2)
算法稳定性：由于交换不是相邻的，所以可能发生逆序，因此直接插入排序是不稳定的排序算法！