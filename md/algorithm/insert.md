## 排序算法之插入排序 ##

1. 直接插入
2. 折半插入
3. 希尔排序

### 直接插入 ###

算法思想： 将整个序列分为两个序列,前面序列{V0,V1...Vi-1}是已经排列好了，在插入Vi时，依次比较Vi-1,Vi-2至V0,如果不是当前即把元素后移，找到合适的位置，将元素插入。
核心思路：将序列分为V0与剩下的元素两个序列，执行倒着顺序比较插入，因此额外的空间开销为零。

php版代码：

	function insert_sort(&$list,$left,$right){
	    $right = $right<0 ? count($list)-1 : $right;
	    for($i=$left+1;$i<=$right;$i++){
	        if($list[$i]<$list[$i-1]){
	            $tmp = $list[$i];
	            for($j=$i;$j>$left;$j--){
	                if($tmp<$list[$j-1])
	                    $list[$j] = $list[$j-1];
	                else
	                    break;
	            }
	            $list[$j] = $tmp;
	        }
	    }
	}

C语言代码：2014-4-11优化版

	void insert_sort(int list[],int left,int right){
	    for(int i=left+1;i<=right;i++){
	        for(int j=i-1;j>=left;j--){
	            if(list<list[j])
	                list[j+1] = list[j];
	            else
	                break;
	        }
	        //考察情况一 当第一次比较就不成立 pos= j+1
	        //情况二 进行比较 但没有到尾 pos= j+1
	        //情况三 比较到尾部 pos=j+1
	        list[j+1] = list;
	    }
	}

时间复杂度：O(n^2)

算法稳定性：由于元素比前面的小才会移动，而相等情况下并不移动，因此直接插入排序是一种稳定的排序算法。

### 折半插入 ###

核心思路：基本思想与直接插入一致，唯一的区别是折半插入在比较的时候，不是倒着顺序比较插入，而是在已经拍好的前部序列中折半查找待插入的位置，找到后，先把元素依次后移，然后再把元素插入。

php版代码：

	function binary_insert_sort(&$list,$left,$right){
	    $right = $right<0 ? count($list)-1 : $right;
	    for($i=$left+1;$i<=$right;$i++){
	        $tmp = $list[$i];
	        $low = $left;
	        $high = $i-1;
	        while($low<=$high){
	            $middle = floor(($low+$high)/2);
	            if($tmp<$list[$middle])
	                $high = $middle - 1;
	            else
	                $low = $middle + 1;
	        }
	        for($k=$i-1;$k>=$low;$k--)
	            $list[$k+1] = $list[$k];
	        $list[$low] = $tmp;
	    }
	}

//当与中间元素比较时，比它小，自然区间在它左边，比它大自然在右边，相等也应该在右边，因此出现middle+1和middle-1;而当low=high时区间中应该还有一个元素，应该与这个元素做最后一次比较，所以退出循环的条件是区间长度小于零，即high-low<0;反过来循环执行的条件即是high>=low;
时间复杂度：O(n^2)

算法稳定性：与直接插入一样是稳定的插入排序。

### 希尔排序 ###

核心思路：将原本的序列，按照相隔gap个元素的元素集合到一个序列，因此形成了gap个子序列，最后几个子序列的元素可能是少一个的哦！然后在这些子序列中执行直接插入排序，先前的gap选择比较大，比如2/n,3/n+1等等，然后按照gap=gap/2或gap=gap/3+1来缩小gap，直到gap=1时，这时就是跟直接插入排序一模一样了，但是由于前面已经做了很多的工作，所以排序起来移动的次数很少，很快就结束。

php版代码：

	//取gap=gap/3+1
	function shell_sort(&$list,$left,$right){
	    $right = $right<0 ? count($list)-1 : $right;
	    //减少gap的值
	    $gap = $right-$left+1;
	    do{
	        $gap = floor($gap/3)+1;
	        //由于划分成几个子序列，每个子序列插入排序一次，所以外循环可以写到一起
	        for($i=$left+$gap;$i<=$right;$i++){
	            if($list[$i]<$list[$i-$gap]){
	                $tmp = $list[$i];
	                for($j=$i;$j>=$left+$gap;$j=$j-$gap){
	                    if($list[$j-$gap]>$tmp)
	                        $list[$j] = $list[$j-$gap];
	                    else
	                        break;
	                }
	                $list[$j] = $tmp;
	            }
	        }
	       
	    }while($gap>1);
	}


这里取gap=gap/2注意这里要调用floor函数向下取整，因为php跟C语言不一样，整数相除可能会带小数。

	function shell_sort(&$list,$left,$right){
	    $right = $right<0 ? count($list)-1 : $right;
	    for($gap=floor(($right-$left+1)/2);$gap>0;$gap=floor($gap/=2)){
	        for($i=$left+$gap;$i<=$right;++$i){
	            for($j=$i-$gap;$j>=$left&&$list[$j+$gap]<$list[$j];$j-=$gap){
	                //这里使用交换的思路来后移元素 并非真正的插入
	                $tmp=$list[$j];
	                $list[$j]=$list[$j+$gap];
	                $list[$j+$gap]=$tmp;
	            }
	        }
	    }
	}

时间复杂度：由于增量的不同希尔排序的时间复杂度也不同，总结下来<=O(n^2),但是比直接插入快很多！

算法稳定性：由于相等的数据项可能被分到不同的子序列中，虽然每个子序列排序稳定，但是整体看来就会造成不稳定的现象产生，所以希尔排序是一种不稳定的排序算法！

总的来说：插入排序只适用于数据量小的排序场合，可以在大序列中使用快速排序，然后在小序列中使用插入排序。