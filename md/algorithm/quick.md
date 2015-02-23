## 排序算法之快速排序 ##

### 快速排序 ###

基本思路：选择一个基准元素，将序列划分成两个子序列和基准元素，基准元素左边都是小于它的，右边都是大于等于它的。然后在对每个子序列同样进行以上操作，直至序列有序。在进行划分时，采用交换的策略，一般第一次选择V0作为基准元素,将小于V0的交换到V1,V2..Vi处，大于V0的交换到Vi+1...Vn-1中，最后将V0与Vi交换，完成序列的划分。

php代码：

	//划分的函数
	function quick_sort_partition(&$list,$left,$right){
	    $pivotpos = $left;
	    for($i=$left+1;$i<=$right;$i++){
	        if($list[$i]<$list[$left]){
	            $pivotpos++;
	            if($pivotpos!=$i){
	                $tmp = $list[$i];
	                $list[$i] = $list[$pivotpos];
	                $list[$pivotpos] = $tmp;
	            }
	        }
	    }
	    $tmp = $list[$left];
	    $list[$left] = $list[$pivotpos];
	    $list[$pivotpos] = $tmp;
	    return $pivotpos;
	}
	//快速排序的函数
	function quick_sort(&$list,$left,$right){
	    if($left<$right){
	        $pivotpos = quick_sort_partition($list,$left,$right);
	        quick_sort($list,$left,$pivotpos-1);
	        quick_sort($list,$pivotpos+1,$right);
	    }
	}

时间复杂度：由于递归的调用自身，容易的出复杂度为O(nlog2n)
由于需要额外的空间栈，会产生空间复杂度O(log2n)
算法稳定性：由于采用的交换策略，导致会发生逆序，所以快速排序是一种不稳定的排序算法！


快速排序的改进思路：

1.当元素太少时，由于要进行不停的划分，其效率远比不上直接插入排序，所以在大序列变成小序列的时候，采用插入排序而不用递归的快速排序。

2.当选择基准元素时，当基准元素是最小时或者最大时，会导致全部移动或者全部不移动，导致左右序列长度相差太大，退化严重。改进思路是，取left,right,middle中的中间大小的元素，作为基准元素，而为了更好的划分，可以将基准元素换到两个端点中的一处。