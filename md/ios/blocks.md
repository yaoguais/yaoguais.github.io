## iOS中Blocks的实现与总结

iOS中的Block有点像C中的函数指针, JS/PHP等语言中的匿名函数或闭包, 我觉得使用Block的主要目的是减少代码的复杂度,
将相关的代码放到一堆便于阅读与理解.

这篇文章的中内容也由阅读《Objective-C高级编程 iOS与OS X多线程和内存管理》一书后整理而来.


目录:

1. 基础使用规则
2. 截获自动变量
3. Block的实现
4. Block的类型
5. Block循环引用
6. 总结





### 基础使用规则

基础的语法公式是

    ^ [返回值类型] [(参数列表)] {表达式}

例如:

    ^ void (void) { printf("Blocks\n"); }

省略返回值

    ^ (void) { printf("Blocks\n"); }

再省略参数列表

    ^ { printf("Blocks\n"); }

其中如果省略返回值, 那么表达式返回什么类型, 返回值就是什么类型, 如果表达式中没有return, 那么就是返回void.

    ^ (void) { return 1; }

就和

    ^ NSInteger (void) { return 1; }

等效.

申明一个Block变量跟C语言中申明函数指针一致.

如:

    int (^ myBlock) (void) = ^ (void) { return 1; };

为了方便阅读, 我们一般会使用typedef定义一种block类型, 如:

    typedef int (^ MyBlock) (void);
    MyBlock myBlock = ^ (void) { return 1; };




### 截获自动变量

书中对Block的定义是"带有自动变量值的匿名函数", 那么什么是带有自动变量值呢, 请看下面的代码:

    {
        int dmy = 256;
        int val = 20;
        const char * fmt = "val = %d\n";

        void (^blk) (void) = ^{ printf(fmt, val); };
        val = 2;
        fmt = "changed val = %d\n";
        blk();

        // 输出 val = 20
    }

通过结果, 我们可以发现, block中的fmt/val在block被赋值的时候就定下来了.

如果我们在block中改变外部变量的值, 会引发编译错误, 比如:

    void (^blk) (void) = ^{ val = 1; };

要解决这个问题, 我们有两种方式, 一种提高变量的作用域, 比如将val申明为全局变量或静态全局变量,

    int val = 20;
    // 或
    // static int val = 20;
    int main() {

    }

但是申明为静态变量是不行的, 如

    int main() {
        static int val = 20;
    }

这个与Block的实现有关.

另一种就是使用__block关键字申明变量, 比如

    __block int val = 20;
    void (^blk) (void) = ^{ val = 1; }; // 允许




### Block的实现

Block的实现比较繁杂, 但书中也讲的比较清晰, 我这里做一个简单的类比.

大体上是根据block申明所处的环境, 构造一个类, 这个类包含一个方法, 方法体即是Block的表达式.

然后在block前面申明的变量, 如果也在block中使用的话, 就会成为block包装的类属性.

如果变量被__block修饰, 从而能够被修改, 并且影响到block外部的变量, 其区别在于类属性保存的是外部变量的地址.




### Block的类型

Block根据其赋值的位置被分为

- _NSConcreteGlobalBlock
- _NSConcreteStackBlock
- _NSConcreteMallocBlock

例如:

    int (^ myBlock) (void) = ^ (void) { return 1; };
    int main()
    {

myBlock就会标识为NSConcreteGlobalBlock类型的Block.

那么怎么标识一个Block究竟是哪一种类型呢, 可以参考下表:

###### NSConcreteGlobalBlock

1. 在申明全局变量的位置的Block
2. Block表达式中不使用截获变量的Block

###### NSConcreteStackBlock

1. 在函数或方法中的Block

###### NSConcreteMallocBlock

1. 函数返回值返回的Block
2. 调用Block的Copy方法生成的Block(NSConcreteGlobalBlock除外)


当我们需要将一个Block从栈上复制到堆上, 以增加其生命周期的时候, 调用Block的copy方法即可, 比如:

    void func(){
        typedef int (^ MyBlock) (void);
        MyBlock myBlock = ^ (void) { return 1; }; // 栈上
        MyBlock heapBlock = [myBlock copy]; // 堆上, 并交给ARC管理
    }

什么时候会导致栈上的Block被复制到堆上呢, 总结下来有下面5点:

1. 调用Block的copy方法时
2. Block作为函数返回值的时候
3. 将Block赋值给附有__strong修饰符id类型的实例或Block类型的实例时
4. 作为含有usingBlock的Cocoa框架方法的参数时
5. 作为GCD的API方法参数时

其他的情况, 如果也需要将一个Block复制到堆上, 就要手动调用其copy方法了.

需要注意的是, 当Block会复制到堆上时, 其截获的自动变量也会全部被复制到堆上.




### Block循环引用

当类实例持有Block并且Block也持有类实例时, 就会造成循环引用, 例如下面的代码

    typedef void (^ MyBlock) (void);
    self.myBlock = ^{ NSLog(@"circle ref %@", self); };

要解决循环引用, 我们可以使用__weak修饰符, 例如:

    typedef void (^ MyBlock) (void);
    id __weak tmp = self;
    self.myBlock = ^{ NSLog(@"no circle ref %@", tmp); };

同样, 截获类的任何一个属性, 也会造成循环引用

    typedef void (^ MyBlock) (void);
    self.myBlock = ^{ NSLog(@"circle ref %@", _myName); };

使用Block也能避免循环引用, 但是必须执行Block, 并且将截获变量置为nil, 否则也会有造成内存泄漏.

    typedef void (^ MyBlock) (void);
    __block id tmp = self;
    self.myBlock = ^{
        NSLog(@"no circle ref %@", tmp);
        tmp = nil;
    };

上面我们都是在ARC模式下的循环引用的解决方式.

但是当处于MRC模式下时, 一旦Block被复制到堆上, 我们就需要调用release方法来释放其内存, 例如

    void (^blk_on_head)(void) = [blk_on_stack copy]; // 复制到堆上
    [blk_on_head release]; // 释放内存

堆上的Block我们就可以使用retain/release等函数控制其引用计数了.
这时, 我们就把Block当成一个MRC的普通变量处理即可.
而栈上的Block会在调用栈结束的时候被释放, 所以调用其retain/release是没有意义的.

因为Blocks是C语言的扩展, 所以我们也可以使用Block\_retain/Block\_release这两个C函数代替
retain/release方法.




### 总结

Blocks在iOS开发中的使用频率相当的高, 正确的使用Block也是一门基础能力.

我们先学习了Block的基础使用方式, 然后又从语法实现上明白了Block的实现细节,
最后总结了使用Blocks容易造成的循环引用的解决办法.