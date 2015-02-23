## 二叉搜索树的基本操作 ##

二叉搜索树的基本性质：节点的左子值小于等于节点的，右子值大于等于节点值，的二叉树。

二叉树的插入删除查找操作：

	#include <iostream>
	using namespace std;
	class BinTreeNode{
	public:
	    BinTreeNode * p;
	    BinTreeNode * left;
	    BinTreeNode * right;
	    int key;
	    BinTreeNode(int key,BinTreeNode * p=NULL,
			BinTreeNode* left=NULL,BinTreeNode*right=NULL){
	        this->key = key;
	        this->p = p;
	        this->left = left;
	        this->right = right;
	    }
	};
	class SearchTree{
	public:
	    SearchTree();
	    ~SearchTree();
	    void Insert(int x);
	    BinTreeNode * Search(int x);
	    void Empty(BinTreeNode * n);
	    BinTreeNode * Minimum(BinTreeNode *n);
	    BinTreeNode * Maximum(BinTreeNode *n);
	    int Delete(BinTreeNode * n);
	    void InorderTreeWalk(){
	        InorderTreeWalk(root);
	    }
	    void PreTreeWalk(){
	        PreTreeWalk(root);
	    }
	    void PostTreeWalk(){
	        PostTreeWalk(root);
	    }
	    BinTreeNode * Root(){
	        return root;
	    }
	    BinTreeNode * Successor(BinTreeNode * n);
	    BinTreeNode * Predecessor(BinTreeNode * n);
	private:
	    void InorderTreeWalk(BinTreeNode * n);
	    void PreTreeWalk(BinTreeNode * n);
	    void PostTreeWalk(BinTreeNode * n);
	    BinTreeNode * root;
	};
	
	SearchTree::SearchTree(){
	    root = NULL;
	}
	/**
	 * 析构函数 删除所有节点并释放内存
	 */
	SearchTree::~SearchTree(){
	    Empty(root);
	}
	/**
	 * 清空元素
	 */
	void SearchTree::Empty(BinTreeNode * n){
	    if(n){
	        Empty(n->left);
	        Empty(n->right);
	        delete n;
	    }
	}
	/**
	 * 插入一个元素
	 */
	void SearchTree::Insert(int x){
	    if(NULL == root){
	        root = new BinTreeNode(x);
	    }else{
	        BinTreeNode *t = root,*p = NULL;
	        while(t){
	            p = t;
	            if(x<t->key)
	                t = t->left;
	            else
	                t = t->right;
	        }
	        t = new BinTreeNode(x,p);
	        if(x<p->key)
	            p->left = t;
	        else
	            p->right = t;
	    }
	}
	/**
	 * 查找指定节点子树中最小值节点
	 */
	BinTreeNode * SearchTree::Minimum(BinTreeNode * n){
	    /**
	     * 子树中最小的节点应该在根的左最小子孙节点，因为左边始终比右边小
	     */
	    while(n->left)
	        n = n->left;
	    return n;
	}
	/**
	 * 查找指定节点子树中最大的节点
	 */
	BinTreeNode * SearchTree::Maximum(BinTreeNode * n){
	    while(n->right)
	        n = n->right;
	    return n;
	}
	/**
	 * 中序遍历
	 */
	void SearchTree::InorderTreeWalk(BinTreeNode * n){
	    if(n){
	        InorderTreeWalk(n->left);
	        cout<<n->key<<" ";
	//      cout<<n->key<<"后驱"<<(Successor(n) ? Successor(n)->key : -1)
			<<"前驱"<<(Predecessor(n) ? Predecessor(n)->key : -1)<<endl;
	        InorderTreeWalk(n->right);
	    }
	}
	/**
	 * 前序遍历
	 */
	void SearchTree::PreTreeWalk(BinTreeNode * n){
	    if(n){
	        cout<<n->key<<" ";
	        PreTreeWalk(n->left);
	        PreTreeWalk(n->right);
	    }
	}
	/**
	 * 后序遍历
	 */
	void SearchTree::PostTreeWalk(BinTreeNode * n){
	    if(n){
	        PostTreeWalk(n->left);
	        PostTreeWalk(n->right);
	        cout<<n->key<<" ";
	    }
	}
	/**
	 * 查找一个节点的后继
	 */
	BinTreeNode * SearchTree::Successor(BinTreeNode * n){
	    /**
	     * 如果有右孩子 那么是右子树中最小者
	     */
	    if(n->right){
	        return Minimum(n->right);
	    }else{
	        /**
	         * 如果无右孩子，所求节点为左节点仍是x祖先的节点 且是最近的
	         * 算法：记录当前节点与父节点 如果父节点的左节点是当前节点
	         * 那么就是父节点
	         */
	        while(n->p){
	            if(n->p->left == n)
	                break;
	            else
	                n = n->p;
	        }
	        return n->p;
	    }
	}
	/**
	 * 查找一个节点的前区
	 */
	BinTreeNode * SearchTree::Predecessor(BinTreeNode * n){
	    /**
	     * 如果有左孩子 就是左子树中最大的节点
	     */
	    if(n->left){
	        return Maximum(n->left);
	    }else{
	    /**
	     * 如果没有左子树 所求节点为右节点仍然是x的祖先的节点
	     * 算法：类比上面
	     */
	        while(n->p){
	            if(n->p->right == n)
	                break;
	            else
	                n = n->p;
	        }
	        return n->p;
	    }
	}
	int SearchTree::Delete(BinTreeNode * n){
	    /**
	     * 如果节点没有孩子 直接将父节点指向该节点的指针置为空即可
	     * 如果有一个孩子 那么将父节点指向子节点即可
	     * 如果有两个孩子 那么找到后继 因为x有右子，
	     * 那么后继在右树中最小没有左孩子
	     * 删除后继 然后用后继的数据代替x即可
	     */
	    BinTreeNode * y,*x;
	    if(!n->left || !n->right)//有一个孩子 或 无孩子
	        y = n;
	    else//n有两个孩子 但y只有右孩子
	        y = Successor(n);
	    if(y->left != NULL)//有左孩子 无右孩子
	        x = y->left;
	    else//有右孩子或者无
	        x = y->right;
	    //y代表待删除节点 x代表待删除节点的子节点，因为无论n有几个孩子
		//待删除元素最多只有一个孩子
	    //先将父节点指针链接上 然后是左右节点指针
	    if(x!=NULL)
	        x->p = y->p;
	    if(y->p == NULL)
	        root = x;
	    else
	        if(y== y->p->left)
	            y->p->left = x;
	        else
	            y->p->right = x;
	    if(y != n)
	        n->key = y->key;
	    int key = y->key;
	    delete y;
	    return key;
	}
	int main(void){
	    SearchTree st;
	    st.Insert(6);
	    st.Insert(2);
	    st.Insert(8);
	    st.Insert(5);
	    st.Insert(9);
	    st.Insert(7);
	    st.InorderTreeWalk();
	    cout<<endl;
	    st.Delete(st.Root()->right);
	    st.InorderTreeWalk();
	    cout<<endl;
	    st.Delete(st.Root()->right);
	    st.InorderTreeWalk();
	    cout<<endl;
	    st.Delete(st.Root()->right);
	    st.InorderTreeWalk();
	    cout<<endl;
	    return 0;
	}

二叉搜索树的插入搜索删除取决于树的高度，其时间复杂度为 O(logn)