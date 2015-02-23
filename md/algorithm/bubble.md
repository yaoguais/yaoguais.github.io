### 排序算法之冒泡排序 ###

### 冒泡排序 ###

基本思路：倒着顺序扫描序列，如果后一个元素小于前一个元素，即交换两个元素的位置，直至最小的元素跑到第一个位置，然后再剩下的n-1个元素组成的序列重复以上操作，直至剩下最后一个元素不用交换，最终排序结束。

php代码：

	function bubble_sort(&$list,$left,$right){
	    $right = $right<0 ? count($list)-1 : $right;
	    for($i=$left+1;$i<=$right;$i++){
	        for($j=$right;$j>=$i;$j--){
	            if($list[$j]<$list[$j-1]){
	                $tmp = $list[$j-1];
	                $list[$j-1] = $list[$j];
	                $list[$j] = $tmp;
	            }
	        }
	    }
	}

时间复杂度：O(n^2)
算法稳定性：由于相等的元素之间并没有发生交换，所以该算法是稳定的算法！

改进冒泡排序：当排序中没有发生交换，说明此时是已经排列好了的序列。所以可以添加一个标志位。

php代码：

	function bubble_sort2(&$list,$left,$right){
	    $right = $right<0 ? count($list)-1 : $right;
	    for($i=$left+1;$i<=$right;$i++){
	        $exchange = false;
	        for($j=$right;$j>=$i;$j--){
	            if($list[$j]<$list[$j-1]){
	                $tmp = $list[$j-1];
	                $list[$j-1] = $list[$j];
	                $list[$j] = $tmp;
	                $exchange = true;
	            }
	        }
	        if(!$exchange)
	            break;
	    }
	}

改进后的代码的可以避免初始序列就是排列好，却仍要全部比较的结果！