## 排序算法之堆排序 ##

核心思想：利用最大堆的堆顶元素最大原理，进行排序，每次移除堆顶元素，将最大的移动到当前子序列最后，在剩下元素中重复上述操作，直至序列有效。

C语言代码：

	#include <iostream>
	using namespace std;
	//排序时可以将a传给heap然后利用heap自身排序节约一个空间
	class MaxHeap{
	private:
	    int * heap;
	    int size;
	    int maxsize;
	public:
	    MaxHeap(int sz):size(0),maxsize(sz){
	        if(sz>0)
	            heap = new int[sz];
	    }
	    ~MaxHeap(){
	        delete [] heap;
	    }
	    //插入元素建立最大堆
	    bool push(int x){
	        if(size==maxsize)
	            return false;
	        int i = size++;
	        //这里i应该>0，才能保证i节点有父节点，否则会出现数组越界
	        while(i>0){
	            int p = (i+1)/2-1;
	            if(x>heap){
	                heap = heap;
	                i = p;
	            }else{
	                break;
	            }
	        }
	        heap = x;
	        return true;
	    }
	    void pushArray(int a[],int n){
	        for(int i=0;i<n;i++)
	            push(a);
	    }
	    //堆排序算法
	    /**
	     * 通过将原序列建立最大堆，因为堆顶的元素最大，所以每次将堆顶的元素放到最后
	     * 再剩下的元素中重复此操作，直至剩下一个元素
	     */
	    void sort(int a[],int n){
	        //先将a保存到堆中
	        pushArray(a,n);
	        int x;
	        for(int i=n-1;i>=0;i--){
	            shift(x);
	            a = x;
	        }
	    }
	    //移除元素
	    bool shift(int& x){
	        if(0==size)
	            return false;
	        x = heap[0];
	        /**
	         * 将最后一个元素放到堆顶，然后再进行重构
	         */
	        heap[0] = heap[size-1];
	        size--;
	        int p = 0;
	        int l = p*2+1;
	        while(l<size){
	            int r = l+1;
	            int max = r<size ? (heap[l]>heap[r] ? l : r) : l;
	            //交换
	            if(heap[max]>heap){
	                int tmp = heap;
	                heap = heap[max];
	                heap[max] = tmp;
	            }
	            p = max;
	            l = p*2+1;
	        }
	        return true;
	    }
	    void output(){
	        for(int i=0;i<size;i++)
	            cout<<heap<<" ";
	        cout<<endl;
	    }
	};
	int main(void){
	    MaxHeap h(10);
	    int a[] = {1,9,2,8,18,4,2,7,3,8};
	    h.sort(a,10);
	    for(int i=0;i<10;i++)
	        cout<<a<<" ";
	    cout<<endl;
	    return 0;
	}

时间复杂度：nlog2n
空间复杂度：将待排序数组传给堆中的堆序列，因此不需要额外的空间。
算法稳定性：因为建立堆本身就是不是稳定的，所以堆排序是一种不稳定的排序算法。