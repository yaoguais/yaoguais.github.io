## 最小堆的插入与删除 ##

最小堆的概念：堆顶元素是堆中最小元素，左右孩子均小于父节点的值，它就是最小堆。最大堆同理。最小堆是优先队列，一般存储在数组中。

C语言代码：

	#include <iostream>
	using namespace std;
	class Heap{
	private:
	    int * heap;
	    int size;
	    int maxsize;
	public:
	    Heap(int sz):size(0),maxsize(sz){
	        if(sz>0)
	            heap = new int[sz];
	    }
	    ~Heap(){
	        delete []heap;
	    }
	    //插入新元素
	    bool push(int x){
	        if(size==maxsize)
	            return false;
	        int i = size++;
	        while(i>0){
	            int p = (i+1)/2-1;
	            if(x<heap){
	                heap = heap;
	                i = p;
	            }else{
	                break;
	            }
	        }
	        heap = x;
	        return true;
	    }
	    //将数组中的元素全部插入堆中
	    bool pushArray(int a[],int n){
	        for(int i=0;i<n;i++)
	            push(a);
	    }
	    //输出整个数列
	    void output(){
	        for(int i=0;i<size;i++)
	            cout<<heap<<" ";
	            cout<<endl;
	    }
	    //删除元素
	    bool shift(int &x){
	    /*
	     *删除一个元素，应该将最后一个元素放到堆顶，这时他的左右两个子树都是堆
	     *比较左孩子右孩子，较小着上移直至最小着到堆顶形成堆
	     * */
	        if(0==size)
	            return false;
	        x = heap[0];
	        heap[0] = heap[size-1];
	        size--;
	        //当左子树为空时退出循环
	        int p = 0;
	        int l = p*2+1;
	        while(l<size){
	            //右子为空就是左子 不空才比较左右孩子
	            int r = p*2+2;
	            int min = r<size ? (heap[l]<heap[r] ? l : r) : l;
	            //交换两个数 这里并不能保证子女中的较小者一定比父节点的小
	            if(heap[min]<heap){
	                int tmp = heap;
	                heap = heap[min];
	                heap[min] = tmp;
	            }
	            p = min;
	            l = p*2+1;
	        }
	        return true;
	    }
	};
	int main(void){
	    Heap h(10);
	    int a[] = {3,5,8,2,1,7};
	    h.pushArray(a,6);
	    int x;
	    for(int i=0;i<6;i++){
	        h.shift(x);
	        cout<<x<<" ";
	        h.output();
	    }
	    return 0;
	}
 

由完全二叉树知n个节点的树深度h=log2(n+1),那么插入与删除操作的渐进时间复杂度即为log2n,而建立堆要插入n个节点
因此建堆的时间复杂度为nlog2n