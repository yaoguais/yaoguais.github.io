## AVL平衡二叉树的实现 ##

什么是AVL树？AVL也是一颗搜索二叉树，右子不小于父值，左子不大于父值。平衡的要求是每一个节点的平衡因子在-1,0,1中取，平衡因子=右树高度-左树高度。

C语言实现的代码：

	include <iostream>
	using namespace std;
	class AvlNode{
	public:
	    int key;
	    int bf;/*balance factor 平衡因子*/
	    AvlNode * left, * right;
	    AvlNode(int k,int b=0,AvlNode * l=NULL,AvlNode * r=NULL){
	        key = k;
	        bf = b;
	        left = l;
	        right = r;
	    }
	};
	//一个链式栈
	class StackNode{
	public:
	    AvlNode * data;
	    StackNode * next;
	    StackNode(AvlNode * data,StackNode * next = NULL){
	        this->data = data;
	        this->next = next;
	    }
	    StackNode():data(NULL),next(NULL){}
	};
	class AvlStack{
	public:
	    AvlStack();
	    ~AvlStack();
	    void Push(AvlNode * & n);
	    AvlNode * Pop();
	    void output(){
	        StackNode * p = top;
	        while(p){
	            cout<<p->data->key<<" ";
	            p = p->next;
	        }
	        cout<<endl;
	    }
	    bool IsEmpty(){
	        return top==NULL ? true : false;
	    }
	    AvlNode * GetTop(){
	        return top->data;
	    }
	private:
	    StackNode * top;
	};
	AvlStack::AvlStack():top(NULL){
	/*    AvlNode * t = new AvlNode(5);
	    Push(t);       
	    Push(new AvlNode(2));       
	    Push(new AvlNode(0));       
	    Push(new AvlNode(9));       
	    Push(new AvlNode(4));
	    cout<<(Pop() ? Pop()->key : -1)<<" ";
	    output();*/
	}
	AvlStack::~AvlStack(){
	    //释放内存
	    StackNode * p = top;
	    while(p){
	        top = p->next;
	        delete p;
	        p = top;
	    }
	}
	void AvlStack::Push(AvlNode * & n){
	    StackNode * t = new StackNode(n,top);
	    top = t;
	}
	AvlNode * AvlStack::Pop(){
	    if(NULL == top)
	        return NULL;
	    StackNode * p = top;
	    top = top->next;
	    AvlNode * n = p->data;
	    delete p;
	    return n;
	}
	//结束
	/**
	 * 首先AVL树也是一棵搜索树，它也满足左子不大于父，右子不小于父
	 * 而且 节点的左右子树高度不超过1 空树高度为零、只有根为一
	 * bf 指的是右子树减去左子树的高度
	 */
	class AvlTree{
	public:
	    AvlTree():root(NULL){
	        /*手动构造一棵AVL树 628579
	        root = new AvlNode(6,0);
	        root->left = new AvlNode(2,1);
	        root->left->right = new AvlNode(5,0);
	        root->right = new AvlNode(8,0);
	        root->right->left = new AvlNode(7,0);
	        root->right->right = new AvlNode(9,0);*/
	    }
	    ~AvlTree(){Empty(root);}
	    void InorderTreeWalk(){
	        InorderTreeWalk(root);
	        cout<<endl;
	    }
	    AvlNode * Root(){
	        return root;
	    }
	    void Insert(int x);
	    bool Delete(int x);
	    AvlNode * root;
	    //左单旋转
	    void RotateLeft(AvlNode * & n);
	    //右单旋转
	    void RotateRight(AvlNode * & n);
	    //先左后右旋转
	    void RotateLeftRight(AvlNode * & n);
	    //先右后左旋转
	    void RotateRightLeft(AvlNode * & n);
	private:
	    //求树的高度
	    int Height(AvlNode * n);
	    //清空所有元素
	    void Empty(AvlNode * n);
	    //中序遍历
	    void InorderTreeWalk(AvlNode * n);
	};
	/**
	 *左旋形状是”八“的右边 并不是指左单就只有左树
	 *旋转时 确定中间大小的元素是重点
	 *把中间的元素作为父 小的左子 大的右子
	 *指针最初应该是指向的 最顶上元素
	 */
	void AvlTree::RotateLeft(AvlNode * & n){
	   /**
	    * n最小将旋钻到左下
	    */
	   AvlNode * l = n;
	   n = n->right;//原右节点上升
	   l->right = n->left;//右节点的左子成为 最小的右子
	   n->left = l;//原右节点左子 为最小元素
	   l->bf = n->bf = 0;//改变节点的高度
	}
	void AvlTree::RotateRight(AvlNode * & n){
	    /**
	     * 右旋 形状是八的左边
	     */
	    AvlNode * r = n;
	    n = n->left;
	    r->left = n->right;
	    n->right = r;
	    r->bf = n->bf = 0;
	}
	void AvlTree::RotateLeftRight(AvlNode * & n){
	    /**
	     * 先左后右的旋转 形状是“女”的第一划
	     */
	    AvlNode * r = n, * l = n->left;
	    n = l->right;
	    //因为新n要成为根 需要把左子正确移动
	    l->right = n->left;
	    n->left = l;
	    //原本新n的bf=0,由于在新n左树插入节点，导致左树高度加一
	    if(n->bf <=0)
	        l->bf = 0;
	    else//在新n的右树插入节点
	        l->bf = -1;
	    //需要将新n的右子正确移动
	    r->left = n->right;
	    n->right = r;
	    if(n->bf == -1)
	        r->bf = 1;
	    else//新节点加在了右子上
	        r->bf = 0;
	    n->bf = 0;
	}
	void AvlTree::RotateRightLeft(AvlNode * & n){
	    /**
	     * 先右旋再左旋 形状是“女”的非第一划
	     */
	    AvlNode * l = n, * r = n->right;
	    n = r->left;
	    //正确移动右子
	    r->left = n->right;
	    n->right = r;
	    if(n->bf >= 0)//新节点加在右子
	        r->bf = 0;
	    else
	        r->bf = 1;
	    //正确移动左子
	    l->right = n->left;
	    n->left = l;
	    if(n->bf == 1)//加在了右树
	        l->bf = -1;
	    else
	        l->bf = 0;
	    n->bf = 0;
	}
	int AvlTree::Height(AvlNode * n){
	    return 0;
	}
	void AvlTree::Insert(int x){
	/**
	 *插入新节点后 会导致根到该节点的bf被修改 因此要从节点到根回溯
	 *新节点的bf=0 考虑插入父节点的左右子树
	 *插入后 父节点bf=0 那么是插入到了父节点的较矮树上 路径上bf不变 不必处理
	 *父节点的bf=1 说明原父节点bf=0 可能会导致路径上出现不平衡
	 *父节点bf=2 说明是在父节点的较高树插入了元素
	 * 考察 p父节点 q父节点直接子女 x新节点q的子女
	 * 若bf=2 右高 q=1 左单
	 *             q=-1 先右后左
	 *若bf=-2 左高 q=-1 右单
	 *             q=1 先左后右
	 *旋转后 bf等于2的高度将为原本平衡的1 因此不需要再进行回溯平衡
	 */
	    AvlNode * p = root, * pr = NULL/*路径上除待插入节点的节点
		停在待插入父节点上*/ ,* q=NULL/*pr父节点*/;
	    AvlStack as;
	    //查找x应该插入的节点 但并不进行插入
	    //cout<<"install insert: ";
	    while(p){
	        pr = p;
	        as.Push(p);
	        if(x<p->key)
	            p = p->left;
	        else
	            p = p->right;
	    }
	    as.output();
	    //创建插入节点
	    p = new AvlNode(x,0);
	    if(pr==NULL){
	        root = p;//说明是空树 把新节点赋值给根即可
	        return;
	    }
	    /*将节点正确的插入到树中*/
	    if(x<pr->key)
	        pr->left = p;
	    else
	        pr->right = p;
	    while(as.IsEmpty() == false){
	        pr = as.Pop();
	       // cout<<pr<<":"<<pr->key<<endl;
	        //调整父节点的平衡因子
	        if(p == pr->left)
	            pr->bf--;
	        else
	            pr->bf++;
	        if(pr->bf == 0)
	            break;//出现第一种情况 bf=0
	        if(pr->bf == 1 || pr->bf == -1){
	            p = pr;//出现第二种情况 向上回溯即可
	        }else{//第三种情况
	            // 首先出现第二种情况 然后上升一个节点 出现第三种情况
	            //按照上面第三种情况判断
	            if(pr->bf>0){//右高
	                if(p->bf==1)
	                    RotateLeft(pr);
	                else
	                    RotateRightLeft(pr);
	            }else{
	                if(p->bf==-1)
	                    RotateRight(pr);
	                else
	                    RotateLeftRight(pr);
	            }
	            break;
	        }
	    }
	    //当回溯到根了 第二种情况
	    if(as.IsEmpty()==true){
	        root = pr; // 最后弹出来的一定是根 所以这句可以不要
	    }else{
	        q = as.GetTop();
	        if(q->key>pr->key)
	            q->left = pr;
	        else
	            q->right = pr;
	    }
	    cout<<endl;
	}
	bool AvlTree::Delete(int x){
	    AvlNode * pr = NULL, * p = root;
	    AvlStack as;/*记录搜索的路径*/
	    //首先查找节点的位置
	    while(p){
	        if(p->key == x)
	            break;//找到了元素
	        as.Push(p);
	        pr = p;
	        if(x<p->key)
	            p = p->left;
	        else
	            p = p->right;
	    }
	    if(!p)
	        return false;//到了nil节点还没有找到
	    AvlNode * q;
	    if(p->left && p->right){
	        //有两个子女的情况 变为删除其后继 然后用前区或后继的数据
			//替换它的数据
	        //前驱是左子树的最大者 就是最右边的节点
	        pr = p;
	        as.Push(p);
	        q = p->left;
	        while(q->right){
	            pr = q;
	            as.Push(q);
	            q = q->right;
	        }
	        p->key = q->key;//交换数据
	        /*此时q即为前驱元素 后继的话 就是右子树的最大者即最左边*/
	        p = q;/*待删除的节点重新赋值给q*/
	    }
	    /*此时被删除的元素都转化为只有一个节点了 */
	    if(p->left)
	        q = p->left;
	    else if(p->right)
	        q = p->right;//q记录被删除节点的为一子女
	    else
	        q = NULL;/*p是没有子女的节点 考察其父节点*/
	    if(pr == NULL){
	        root = q;//被删除节点为根 则q成为新根
	    }else{
	        /*删除p pr q之间的链接
	         *还要正确标识 p是pr的左还是右节点才行 要不q为空会导致错误
	         * */
	        bool pLeft = true;
	        if(pr->left == p){
	            pr->left = q;
	            pLeft = true;
	        }else{
	            pr->right = q;
	            pLeft = false;
	        }
	        int d;//用来标识q 这个较高的子树是左子树 还是右子树
	        //重新平衡树
	
	        while(as.IsEmpty()==false){
	            pr = as.Pop();
	            if(q){
	                if(pr->right == q)
	                    pr->bf--;/*p是右子但被删除了 应该减一*/
	                else
	                    pr->bf++;
	            }else if(pLeft){
						/*当第一次回溯时 如果p没有子女的话 将q赋值给pr
                        * 而pr又只有一个p子女的时候
                        * 会导致将无法比较删除掉的原本是左支还是右支
                        * 进而会错误的导致bf的改变
                        *  但是进行第二次回溯时q就一定不是空了*/
	                    pr->bf++;
	            }else{
	                    pr->bf--;
	            }
	            int dd=0;
	            AvlNode * ppr;
	            if(as.IsEmpty()==false){
	                ppr = as.GetTop();
	                dd = (ppr->left==pr) ? -1 : 1;
	            }
	            //pr 的高度没有发生改变 停止平衡
	            if(pr->bf==1 || pr->bf==-1)
	                break;
	            if(pr->bf==2 || pr->bf==-2){/*当出现不平横 需要进行平衡操作*/
	                //使用q指示较高的子树
	                if(pr->bf<0){
	                    q = pr->left;
	                    d = -1;
	                }else{
	                    q = pr->right;
	                    d = 1;
	                }
	                if(q->bf==0){/*当q的bf为零 进行一次单旋即可*/
	                    if(d==-1){//当q是左树的 进行右单旋转
	                        RotateRight(pr);
	                        pr->bf = 1;
	                        q->bf = -1;
	                    }else{
	                        RotateLeft(pr);
	                        pr->bf = -1;
	                        q->bf = 1;
	                    }
	                    break;
	                }
	                if(q->bf == d){//同号说明是单旋转
	                    if(d== -1)
	                        RotateRight(pr);
	                    else
	                        RotateLeft(pr);
	                }else{//不同号 那么就要进行双旋转了
	                    if(d==-1)//先左后右
	                        RotateLeftRight(pr);
	                    else
	                        RotateRightLeft(pr);
	                }
	                if(dd==-1)
	                    ppr->left = pr;
	                else if(dd==1)
	                    ppr->right = pr;
	            }
	            q = pr;
	        }
	        if(as.IsEmpty()==true)//回溯到根了
	            root = pr;
	    }
	    delete p;
	    return true;
	}
	void AvlTree::Empty(AvlNode * n){
	    if(n){
	        Empty(n->left);
	        Empty(n->right);
	        delete n;
	    }
	}
	void AvlTree::InorderTreeWalk(AvlNode * n){
	    if(n){
	        InorderTreeWalk(n->left);
	        cout<<n->key<<" ";
	        InorderTreeWalk(n->right);
	    }
	}
	int main(void){
	    AvlTree avl;
	    avl.Insert(9);
	    avl.Insert(5);
	    avl.Insert(7);
	    avl.Insert(2);
	    avl.Insert(8);
	    avl.Insert(1);
	    avl.InorderTreeWalk();
	    avl.Delete(7);
	    avl.InorderTreeWalk();
	    avl.Delete(1);
	    avl.InorderTreeWalk();
	    //先删除7再删除1会出错 已经修正于2014-4-11
	/*    avl.InorderTreeWalk();
	    avl.RotateLeft(avl.root);
	    cout<<avl.root->key<<endl;
	    avl.InorderTreeWalk();
	    avl.RotateRight(avl.root);
	    cout<<avl.root->key<<endl;
	    avl.InorderTreeWalk();
	    avl.RotateLeftRight(avl.root);
	    cout<<avl.root->key<<endl;
	    avl.InorderTreeWalk();
	//    AvlStack as;
	//    avl.RotateRightLeft(avl.root);
	//    avl.InorderTreeWalk();*/
	    return 0;
	}

AVL树的时间复杂度分析：由于也是一棵搜索树，因此复杂度跟树的高度有关，插入查找删除均为O(log2n)。
经分析，AVL是可以包涵相同值得节点的，但是搜索和删除会导致不知道删除哪一个，所以我们在插入的时候，如果节点的值已经有了，我们就不用插入了。