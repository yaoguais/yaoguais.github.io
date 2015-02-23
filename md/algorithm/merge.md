## 排序算法之归并排序 ##

### 两路归并排序 ###

核心思路：将序列评分为AB两个子序列，直至将子序列的长度小于2，然后进行归并，直至最后的序列有序。

php代码：

	<?php
	function merge_sort(&$list,&$copyList,$left,$right){
	    //当长度大于等于2时才进行划分
	    if($right>$left){
	        //进行做划分
	        $mid = floor(($left+$right)/2);
	        merge_sort($list,$copyList,$left,$mid);
	        //进行右划分
	        merge_sort($list,$copyList,$mid+1,$right);
	        //合并划分的元素
	        merge($list,$copyList,$left,$mid,$right);
	    }
	}
	function merge(&$list,&$copyList,$left,$mid,$right){
	    //将排序后的序列复制给复制序列
	    //这里不采用复制给原序列是因为最初复制序列是空的，
		//否则调用排序函数前还需复制一下浪费操作
	    for($i=$left;$i<=$right;$i++){
	        $copyList[$i] = $list[$i];
	    }
	    //依次拷贝至最短的子序列结束
	    for($t=$left,$i=$left,$j=$mid+1;$i<=$mid && $j<=$right;$t++){
	        if($copyList[$i]<$copyList[$j]){
	            $list[$t] = $copyList[$i];
	            $i++;
	        }else{
	            $list[$t] = $copyList[$j];
	            $j++;
	        }
	    }
	    //拷贝剩下的
	    for(;$i<=$mid;$i++,$t++)
	        $list[$t] = $copyList[$i];
	    for(;$j<=$right;$j++,$t++)
	        $list[$t] = $copyList[$j];
	}
	
	$arr = array(6,4,7,2,5,3);
	merge_sort($arr,$arr2,0,count($arr)-1);
	print_r($arr);


时间复杂度：O(nlgn)
算法稳定性：由于从左序列进行比较，前面的仍然会排到前面，所以归并排序是稳定的排序算法。