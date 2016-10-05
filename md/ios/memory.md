## iOS内存管理的实现与总结

因为Objective-C没有垃圾回收机制, 所以在iOS开发过程中, 一般是依靠自动引用计数(ARC)和手动引用计数(MRC)进行内存管理的.

虽然知道个大概也能写出很多APP, 并且也能拥有较低的崩溃率. 但是要写出更美的代码, 这些基础的东西是必须要掌握的.

下面的内容是基于《Objective-C高级编程 iOS与OS X多线程和内存管理》一书整理而来, 但是由于该书历史已久,
或许某些内容对于现在的版本已经不再适用, 所以我也新开了一个项目对书中的某些点进行实际的检验.


目录:

1. 自动引用计数基础实现规则
    - 自动引用计数的痛点
    - alloc/retain/release/dealloc的实现
    - autorelease的实现
2. 对象所有权修饰符
    - __strong修饰符
    - __weak修饰符
    - __unsafe_retained修饰符
    - __autoreleasing修饰符










### 自动引用计数基础实现规则

iOS自动引用计数可以归纳为下面这张表:


| 对象操作           | Objective-C的方法                           |
| ---               | ---                                        |
| 生成并持有对象      | alloc/new/copy/multiCopy命令规则开头的方法   |
| 持有对象           | retain方法                                 |
| 释放对象           | release方法                                |
| 废弃对象           | dealloc方法                                |

以上这些方法都是作用于NSObject对象的, 其对象都会拥有一个叫retainCount的属性, 调用上述方法即是对retainCount值进行加减.
其中我们并不手动调用dealloc方法, 而是在调用release时, release方法发现retainCount为0了, 便自动调用dealloc方法释放为其申请的内存.




#### 自动引用计数的痛点

在iOS中, 自动引用计数的痛点大致有两个, 一个是无法解决循环引用的问题, 另一个是iOS中仍然存在较多的框架未使用ARC,
所以会有一个两者之间转换的过程.

在有垃圾回收机制的语言中, 循环引用能够使用多种方式来解决. 例如PHP中使用[标记-清除](http://php.net/manual/zh/features.gc.collecting-cycles.php)
的方式.




#### alloc/retain/release/dealloc的实现

因为苹果是个闭源系统, 所以没法直接通过源代码查看其实现方式. 但是有一个跟苹果等价的开源系统实现GNUStep, 因此我们先了解它是怎么实现的.

###### GNUStep的实现

    struct obj_layout{
        NSUInteger retained;
    };

在64位的机器上NSUInteger占8个字节, 如果我们需要一个20子节的对象, 那么就得分配28字节,
前8个字节作为retained, 第9个字节就是对象的内存地址.

只要我们知道对象的地址, 那么也就能知道其引用计数了.

###### Apple的实现

我们可以使用lldb单步跟踪, 猜测出大致的实现.

使用hash表来实现的, 其中健值为对象内存地址的散列值, 健对应的桶里面装的即是引用计数.



#### release与autorelease的区别

在上面我们讲解了release方法的作用, 在MRC阶段, 一个对象的过程一般如下:

    {
        NSObject * obj = [[NSObject alloc] init]; // retainCount = 1
        [obj retain]; // retainCount = 2
        [obj release]; // retainCount = 1
    }
    // 生命周期结束, 调用release, 发现retainCount=0, 再调用dealloc方法释放内存



