## iOS内存管理的实现与总结

因为Objective-C没有垃圾回收机制, 所以在iOS开发过程中, 一般是依靠自动引用计数(ARC)和手动引用计数(MRC)进行内存管理的.

虽然知道个大概也能写出很多APP, 并且也能拥有较低的崩溃率. 但是要写出更美的代码, 这些基础的东西是必须要掌握的.

下面的内容是基于《Objective-C高级编程 iOS与OS X多线程和内存管理》一书整理而来, 但是由于该书历史已久,
或许某些内容对于现在的版本已经不再适用, 所以我也新开了一个项目对书中的某些点进行实际的检验.


目录:

1. 自动引用计数基础实现规则
    - 设置是否启用自动引用计数
    - 自动引用计数的痛点
    - alloc/retain/release/dealloc的实现
    - autorelease的实现
2. 对象所有权修饰符
3. OC对象与Core Foundation对象的转换
4. 对象属性
5. 内存管理的总结





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

在MRC阶段, 一个对象的过程一般如下:

    {
        NSObject * obj = [[NSObject alloc] init]; // retainCount = 1
        [obj retain]; // retainCount = 2
        [obj release]; // retainCount = 1
    }
    // 生命周期结束, (编译器)调用release, 发现retainCount=0, 再调用dealloc方法释放内存

在ARC阶段, 开发人员并不需要手动调用retain和release函数, 这些都由编译器解决了, 具体实现就是通过代码分析, 在合适的位置插入retain和release调用.
并且编译器会显式的禁止开发人员调用这类函数, 在ARC模式下的文件调用这些函数会导致编译错误.




#### 设置是否启用自动引用计数

在高版本的编译器中, 默认都是为每个文件.m源文件开启ARC的.

如果要使用手动引用计数, 在Xcode中, 首先双击左边的项目, 依次选择 TARGETS -> Build Phases
-> Compile Source(x items).

这里可以看到一个表格, 有两列, 第一列叫Name, 是很多的.m源文件的名称. 第二列叫Compiler Flags, 目前是空的,
双击文件即可编辑Flag字段, 我们在里面输入"-fno-objc-arc", 代表不使用ARC.

这个时候我们在该文件中调用retain/release/retainCount等函数就不会报错了.

在AppCode中, 我们找到并打开project.pbxproj文件.

    /* Begin PBXBuildFile section */
    AF745BF338CC5827474DE20F /* main.m in Sources */ = {isa = PBXBuildFile; fileRef = AF7457EBDAB03899B095FC2D /* main.m */; };
    // 为了好看, 我们把下面一行换行成三行
        AF745EF38F5BC3BB6E44D005 /* Chapter1Test.m in Sources */ =
          {isa = PBXBuildFile; fileRef = AF74507734BE45DC4D2EE6A5 /* Chapter1Test.m */;
           settings = {COMPILER_FLAGS = "-fno-objc-arc"; }; };
    /* End PBXBuildFile section */

我们可以发现, 在"PBXBuildFile section"中Chapter1Test.m文件多了一个settings属性, 其中一个字段即为COMPILER_FLAGS = "-fno-objc-arc".

因为我们要禁止某个文件自动引用计数, 在此处正确加上COMPILER_FLAGS = "-fno-objc-arc"即可.




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

在64位的机器上NSUInteger占8个字节, 如果我们需要一个20字节的对象, 那么就得分配28字节,
前8个字节作为retained, 第9个字节就是对象的内存地址.

只要我们知道对象的地址, 那么也就能知道其引用计数了.

###### Apple的实现

我们可以使用lldb单步跟踪, 猜测出大致的实现.

最终发现是通过hash表来实现的, 其中健值为对象内存地址的散列值, 健对应的桶里面装的即是引用计数.



#### autorelease的实现

autorelease顾名思义即是"自动释放", 其类似于C语言中的局部变量, 当这种变量超出其作用域时, 便被自动释放掉.

其使用方式如下

1. 生成并持有NSAutoreleasePool对象
2. 调用已分配对象的autorelease方法
3. 废弃NSAutoreleasePool对象

其示例代码如下:

    {
        NSAutoreleasePool * pool = [[NSAutoreleasePool alloc] init];
        NSObject * obj = [[NSObject alloc] init];
        [obj autorelease];
        [pool drain];
    }

首先创建了一个自动释放池, 然后调用obj的autorelease将自身放到这个pool的池子中.
这个池子的实现可以是一个数组.

因为autorelease方法并没有传入pool对象, 那么我们能猜测的一种实现方式是, 在NSAutoreleasePool调用init时将自身注册到一个pool栈中,
obj的autorelease就取栈顶的pool即可,考虑到多线程问题,可以每个线程一个pool栈.

在调用pool的drain方法时, 遍历pool内部的数组, 取出保存的对象, 依次调用其release方法.

最后再销毁pool对象本身.

需要注意的点有两个, 一是pool内部还可以创建pool, 二是在pool中调用autorelease的对象, 要在
pool销毁的时候才会被释放, 因为如果有很多很大的局部变量时, 可以放到一个零时的pool中处理,
以避免这些变量占用太多的内存而被系统kill掉.




### 对象所有权修饰符

Objective-C中的对象跟C语言的变量一样, 都是需要被修饰符修饰的, C语言中默认的修饰符是auto, 而OC中的是__strong.

OC中的修饰符有4个:

- __strong修饰符
- __weak修饰符
- __unsafe_retained修饰符
- __autoreleasing修饰符

其中__strong修饰符代表拥有的是对象的强引用.

将一个变量赋值给另一个变量时, 如果被赋值的是__strong修饰的变量,  会将这两个变量指向的内存对象引用计数加一;

如果被赋值的是__weak修饰的变量, 那么这两个变量指向的内存对象引用计数不变, 这点主要用来解决循环引用;

被__unsafe_retained修饰的变量跟__weak修饰的变量一样, 唯一的区别在于对象被释放时候, __weak被把对象置为nil,
而__unsafe_retained保持其值不变, 这就会导致一个被释放的内存还有指针指向它, 也就是俗称的野指针,
如果再次访问极容易导致程序奔溃.

如果被赋值的是__autoreleasing修饰的变量, 相当于赋值给一个被__strong修饰的变量, 并调用其autorelease方法,
将其注册到autoreleasePool里面.




### OC对象与Core Foundation对象的转换

Core Foundation对象只需要使用MRC进行管理即可, 其中的区别在于将retain换成CFRetain函数,
release换成CFRelease函数.

但是我们偶尔会遇到OC对象与Core Foundation对象的转换, 这就会涉及到"bridge"桥.

bridge桥分为3中:

    NSObject * p = (__bridge NSObject *) obj;

__bridge将obj的地址复制给p, 不增加引用计数, 且obj仍然持有该对象, 因此需要调用

    CFRelease(obj);

来释放obj变量, 一旦obj被释放, p很可能就会成为一个野指针.

    NSObject * p = (__bridge_retained NSObject *) obj;

__bridge_retained将obj地址赋值给p, 同时增加引用计数, 其中obj的计数需要手动调用CFRelease减一,
p的引用计数就交给ARC进行管理.

__bridge_transfer将obj地址赋值给p后, 就由p持有这个对象了. 具体的实现过程可以是在__bridge_retained
基础上, 编译器会自动调用一次CFRelease.

然后有两个函数与bridge中的两个关键字等效.

    NSObject * p = (__bridge_retained NSObject *) obj;
    等同于
    NSObject * p = CFBridgingRetain(obj);

    NSObject * p = (__bridge_transfer NSObject *) obj;
    等同于
    NSObject * p = CFBridgingRelease(obj);




### 对象属性

我们通过会使用@property来申明属性, 而属性关键字中又有几个是跟内存管理相关的.
具体的关系如下表:

| 属性申明的属性    | 所有权修饰符                 |
| ---             |             ---            |
| assign          | __unsafe_retained          |
| copy            | __strong, 但赋值的是复制的对象|
| retain          | __strong                   |
| strong          | __strong                   |
| unsafe_retained | __unsafe_retained          |
| weak            | __weak                     |


以上只有copy属性是通过NSCoping接口的CopyWithZone方法复制赋值源所生成的对象.

这些对应关系决定了该属性被赋值时, 其内存管理策略是什么, 比如

    申明:
    @property (nonatomic, weak) NSObject * obj;
    赋值:
    self.obj = p;
    等同于
    NSObject __weak obj = p;

这里就跟上面讲解的__weak用法一致, obj不持有p指向的对象, 并且该对象的引用计数保持不变.

赋值其实就是调用对象的setter方法, @property的作用也就是根据设置的关键字简化setter函数的生成.


### 内存管理的总结

在ARC有效的情况下, 需要遵守下面的规则.

- 不能使用retain/release/retainCount/autorelease方法
- 不能使用NSAllocateObject/NSDeallocateObject方法
- 必须遵守内存管理的方法命令规则
- 不能显示的调用dealloc方法
- 使用@autoreleasepool块替代NSAutoreleasePool
- 不能使用区域(NSZone)
- 对象型变量不能做为C语言结构体/联合体的成员
- 需要显示转换"id"和"void *"

Xcode和AppCode都可以使用Instruments进行内存泄漏/循环引用的检测.

通过上面的整理, 我们较为清晰的明白了Objective-C内存管理的内部实现,
关于内存管理的一些关键字的使用, 和ARC与MRC混用情况的处理.有了这些基础,
加上对工具的熟练使用, 避免内存泄漏也便不再是什么难事了.