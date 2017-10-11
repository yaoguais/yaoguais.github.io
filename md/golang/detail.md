## Golang细节梳理

熟话说，“工欲善其事，必先利其器”。接触Golang也近一年半，多次想梳理一下，都半途而废，这次趁着空闲，刚好可以一一记录下来。

内容多摘自《Go语言学习笔记》，或他人博文，或官方文档。形式为概括与代码结合，阐述也多以代码注释出现。

本篇文档概括至Go最新发布版，且不定更新。主要分三个方面：一是语言特性，如“类型、表达式、函数、数据、方法、接口”等；
二是编程技巧与理念，如“缓存池、用通信实现数据共享”；三是个人理解，如“对开源项目解构”。

目录：

1. 类型
2. 常量与变量
3. 表达式




### 类型

类型包含基础类型与引用类型，基础类型包含“int、float”等等，引用类型包含“slice、map、channel”三种类型。

（1）基础类型：

- 1字节的：bool、byte、int8、uint8
- 2字节的：int16、uint16
- 4字节的：int32、uint32、rune、float32
- 8字节的：int64、uint64、float64、complex64
- 16个字节的：complex128

跟32位、64位平台相关的有：

- 4或8字节：int、uint、uintptr

额外的基础类型还有：string、array、struct、function、interface。

（2）引用类型：

- slice
- map
- channel

引用类型有两个特点：

1. 作为参数作为返回值时，不发生内存拷贝。因此基础类型array是被发生拷贝的，大数组作为参数应该转换为slice。
2. 使用前应用make进行初始化，用new只会分配返回的指针的内存。如map就不会分配其附加属性count等，也不会正确初始化。


（3）类型转换与别名

golang中必须显式类型转换，不同于C/C++。
但是如果是别名的话，因为本身就是同一种类型，因为可以直接赋值。
1.9版本更是增加了定义别名特性。

内置的别名有：

- type byte = uint8
- type rune = uint32

类型转换中容易造成歧义，需要使用括号消除歧义，或使阅读更加清晰。如：

```
(*int)(p) 转换为指针。但*int(p) 即为*(int(p))，意为取地址p处的值，这种用法在操作系统管理内存时多用。
```

（4）自定义类型

- type color uint8

自定义类型不是别名。它是从现有的类型定义出一个新的类型，它们已是两种类型，只是拥有相同的底层数据结构。
其区别有以下几点：

- 不拥有原类型的“method set”，即不实现原类型已实现的接口
- 同原类型必须显式转换
- 同原类型不能直接比较

（5）未命名类型

array、slice、map、channel因为与其元素具体类型或长度有关，所以不能给出唯一的名称，固成为未命名类型。

像数组\[2\]int即是，但我们也可以给他取一个名称。

```
type data [2]int
```

未命名类型转换为有名类型的规则如下：

- 所属的类型相同
- 基础类型相同，其中一个是未命名类型。
- 数据类型相同，将双向通道赋值给单向通道，其中一个为未命名类型。
- 将nil赋值给slice、map、channel、指针、函数或接口。
- 将对象赋值给接口变量，只要对象实现了该接口。


（6）默认值

当申明一个变量时，系统都被默认初始化，以确保不会发生异常。这不同于C的局部变量。

其总结如下：

- false：bool
- 0：int族、uintptr
- 0.0：float族
- 空字符串""：string
- nil：function、interface、slice、map、channel

array、struct根据其元素不同而对应赋予默认值。

（7）类型推断

类型推断就是不用申明具体的类型，而根据被赋予的值推断类型。
所以我们在使用类型推断时，应该清楚的知道当前被赋予什么类型。


```
var1 := 0
var2 := 0.0
// var3 := 0xffffffffffffffff //constant 18446744073709551615 overflows int
var4 := 'c'
var5 := '我'
fmt.Printf("0: %T\n", var1)
fmt.Printf("0.0: %T\n", var2)
// fmt.Printf("0xffffffffffffffff: %T\n", var3)
fmt.Printf("c: %T\n", var4)
fmt.Printf("我: %T\n", var5)

//output:
0: int
0.0: float64
c: int32
我: int32
```

可以看出整数是推断出int，浮点数是推断出float64，字符是推断出int32，如果超出其范围，在编译时就会报错。




### 常量与变量

（1）常量

常量固不能改变的量。其值必须是编译时期可以确定的字符、字符串、数字或布尔值。

其有以下几个特点：

- 其值必须是字符、字符串、数字、布尔值
- 支持类型推断

在申明时，可以使用常量组，如果不指定类型和初始值，则与上一行非空常量右值表达式文本相同。
这里提到表达式文本，主要是针对iota而言的，因为处于不同行的iota的值是不相同的。

常量的值也可以是编译时期可以确定的表达式，其例子如下：
```
const (
    ptrSize = unsafe.Sizeof(uintptr(0))
    strSize = len("string")
    sliceCap = cap(sliceA)
)
```

- 常量也可以在不同作用域定义同名的常量而不会冲突。


（2）枚举

在Golang中没有内置枚举类型，但是我们一般是通过常量配合iota实现的。

iota有如下几个特点：

- 作用于常量组，不同常量组的iota的初始值都是0
- 常量组每增加一行，不管是否包含iota，iota的值都自增1
- 处于同一行的iota，其值也是相同的
- iota的默认类型的int，也可显示指定为其他类型，如float32等

（3）变量

变量使用var关键字定义，如果未给初始值系统会初始化为默认值。

变量支持简短模式，即使用操作符“:=”，其有以下三个限制：

- 定义变量需要同时显示初始化
- 不能申明其数据类型
- 只能用在函数内部，即不能作用于全局变量

变量支持退化赋值，其条件为：至少有一个新变量被定义，新变量须与旧变量处于统一作用域。

局部变量未使用会在编译时报错。但全局变量和常量不会有这个问题。

（4）多变量赋值

赋值时先从左至右依次计算右值，然后再依次赋值给左边的变量。

如下面这种情况：

```
func inc(x *int, name string) int {
        fmt.Printf("%s: %d\n", name, *x)
        *x++
        return *x
}

func main() {
        x, y := 1, 3
        x, y = inc(&y, "y"), inc(&x, "x")
        fmt.Printf("x=%d, y=%d\n", x, y)
}

// output:
y: 3
x: 1
x=4, y=2
```

（5）空标识符“_”

空标识符多用在接收多返回值时，忽略其中几个返回值。当然忽略error不是一个好习惯。

另一个常用的地方是检测某类型是否实现目标接口。如：

```
var _ InterfaceA = new(StructA)
```

（6）作用域

变量需要特别关注作用域，当多个同名变量出现时，一定要清楚改变的谁，谁又不变。

如下：
```
var x int
for x, y := 1, 1; x < 5; x, y = x+1, y+1 {
        fmt.Printf("%d ", x)
}
fmt.Printf("\nx=%d\n", x)
// output:
1 2 3 4
x=0

注意，Golang中没有逗号表达式，即不能使用“i++, j++”这样的语句。
解决办法就是前面提到的多变量赋值。
```


### 表达式

表达式这部分包含八部分：保留字、运算符、优先级、位运算符、二元运算符、自增、指针运算、控制流。

（1）保留字

如果你还不清楚一种语言的任何一个保留字，那么说明你还没有彻底理解这种语言。

Golang目前的保留字有25个，我们如下分类：

- 用作定义的：const、var、type、struct、interface、map、chan、func
- 用作包管理的：package、import
- 用作控制流的：if、else、switch、case、for、goto、continue、break、fallthrough、default、select
- 特殊的：go、defer、range、return

除上面这些保留字外，还有一些特殊的关键字，如len、cap。

（2）运算符

运算符除了加减乘除和各种括号外，一个比较的特别的是“&^”，我们叫它“位清除符”，
它将左右操作数都为1的位清除为0。


（3）指针运算

Golang中与指针相关的有取址运算符“&”、指针运算符“*”、类型uintptr、类型unsafe.Pointer。

指针可以支持相等运算符，但不能像C语言一样加减乘除和一般类型转换。

其拥有以下几种特殊操作：

- 任意类型的指针可以被转换成一个 Pointer对象。
- 相反一个Pointer也可以转换成任意类型的指针。
- 一个uintptr可以转换成一个Pointer。
- 相反一个Pointer可以转换成uintptr。
- 内建的new函数可以为类型T创建零值的对象,它返回的对象类型为*T。

unsafe.Pointer定义如下：

```
type ArbitraryType int  // shorthand for an arbitrary Go type; it is not a real type
type Pointer *ArbitraryType
```

示例代码如下：

```
// 移动指针
{
        x := [...]int{1, 2, 3, 4, 5}
        p := &x[0]
        //p = p + 1
        index2Pointer := unsafe.Pointer(uintptr(unsafe.Pointer(p)) + unsafe.Sizeof(x[0]))
        p = (*int)(index2Pointer) //x[1]
        fmt.Printf("%d\n", *p)    //2
}
// 任意类型的指针可以被转换成一个 Pointer对象
// *T -> Pointer to T2
{
        var i int64 = 100
        var p *int64 = &i //*int64
        P := unsafe.Pointer(p)
        fmt.Printf("%T\n", P)
}
// 相反一个Pointer也可以转换成任意类型的指针
// Pointer to T2 -> *T
{
        var i int64 = 100
        var p *int64 = &i //*int64
        P := unsafe.Pointer(p)
        p2 := (*int32)(P) //*int32
        fmt.Println(*p2)
}
// 一个uintptr可以转换成一个Pointer，相反一个Pointer可以转换成uintptr
{
        var i int64 = 200<<32 + 100
        var p = &i
        P0 := unsafe.Pointer(p)
        P := unsafe.Pointer(uintptr(P0) + 4)
        p2 := (*int32)(P)
        fmt.Println(*p2) //200
}
// 内建的new函数可以为类型T创建零值的对象,它返回的对象类型为*T
{
        var i = new(int)
        var s = new(string)
        var j = new(struct{ int })
        fmt.Printf("%T %T %T\n", i, s, j) //*int *string *struct { int }
}
// output:
2
unsafe.Pointer
100
200
*int *string *struct { int }
```

参考：

[http://colobu.com/2016/06/16/dive-into-go-3/](http://colobu.com/2016/06/16/dive-into-go-3/)



（4）控制流

Golang用作控制流的保留字，已经在上面例举出来。

控制流也要特别关注变量的作用域，像上面已经列举的for语句，除外还有if、else、switch、select。

这里要提到goto，遇到很多人见到goto就一棒子打死，结果本来goto写出来很干净的代码，非要层层判断导致既冗余又难读，何必呢？

（5）switch

switch在golang中比较特殊，我们单独阐述。其基本结构如下：
```
switch 条件表达式 {
    case 比较表达式: 语句
    case 比较表达式2: 语句
    default: 语句
}
```

其有如下特点：

- 条件表达式可以为空，这时其值为true。
- 条件表达式支持初始化语句，如switch x := 5; x {}。
- 比较表达式可以有多个值，如case 5, 6，用逗号隔开即可。
- 每一个比较表达式的语句，最后会自动break。要继续执行紧挨着的下个case或default，需要使用fallthrough。
- 匹配规则是从上向下，从左向右。从左向右是因为比较表达式支持多个值。
- 比较表达式可以是布尔值、常量、变量、或逻辑表达式，或多个用逗号隔开的组合。
- 当所有比较表达式都匹配之后，才会执行default，而且不管default是否放到最后，但一般都放最后。


（6）select

select多用在选择多个通道，或结合default来尝试读写通道。

其结构与switch类似：
```
select {
case <-a:
case <-b:
case <-a:
default:
}
```

当有多个通道选择时，其具有下面的特点：

- 它会随机选择一个可用的通道，即便是同一通道。
- 若将通道设置成nil, 则通道便不会被选中。
- 当所有通道都不可用时，才会执行default的语句。如果没有default，那么select会一直等待通道可用。
- 关闭通道后，通道会一直可读，但是读出来的是nil。要避免select空跑。

（7）break

break用作跳出for、switch或select。

一个特殊用法是结合标签跳出多层循环，如：

```
func main() {
Exit:
        // fmt.Println("generate invalid break label")
        for i := 0; i < 5; i++ {
                for j := 0; j < 5; j++ {
                        fmt.Println(i, j)
                        if i+j >= 4 {
                                break Exit
                        }
                }
        }
        fmt.Println("end")
}
// output:
0 0
0 1
0 2
0 3
0 4
end
```


（8）for...range

for...range主要完成迭代，支持字符串、数组、数组指针、切片、字典、通道。

在遍历时的局部变量，也会被重复使用，因而其地址不变。

示例代码如下：

```
func main() {
        fmt.Println("普通字符串")
        for i, v := range "abc" {
                fmt.Printf("i=%v, v=%v\n", i, v)
        }
        fmt.Println("汉字字符串")
        for i, v := range "汉字" {
                fmt.Printf("i=%v, v=%v\n", i, v)
        }
        fmt.Println("数组")
        for i, v := range [2]int{10, 11} {
                fmt.Printf("i=%v, v=%v\n", i, v)
        }
        for i := range [2]int{10, 11} {
                fmt.Printf("i=%v\n", i)
        }
        fmt.Println("切片")
        for i, v := range []int{10, 11} {
                fmt.Printf("i=%v, v=%v\n", i, v)
        }
        fmt.Println("字典")
        m := make(map[string]string)
        m["a"] = "b"
        for k, v := range m {
                fmt.Printf("k=%v, v=%v\n", k, v)
        }
        for k := range m {
                fmt.Printf("k=%v\n", k)
        }
        fmt.Println("通道")
        c := make(chan int)
        go func() {
                for v := range c {
                        fmt.Printf("v=%v\n", v)
                }
                fmt.Println("read channel finish")
        }()
        c <- 20
        c <- 21
        close(c)
        // c = nil // 会导致for-range阻塞，从而可能导致死锁。
        fmt.Println("局部变量会重复使用")
        for i, v := range [2]int{10, 11} {
                fmt.Printf("i=%v, v=%v\n", &i, &v)
        }

        done := make(chan struct{})
        <-done
}
// output:
普通字符串
i=0, v=97
i=1, v=98
i=2, v=99
汉字字符串
i=0, v=27721
i=3, v=23383
数组
i=0, v=10
i=1, v=11
i=0
i=1
切片
i=0, v=10
i=1, v=11
字典
k=a, v=b
k=a
通道
v=20
局部变量会重复使用
i=0xc420014138, v=0xc420014140
i=0xc420014138, v=0xc420014140
v=21
read channel finish
fatal error: all goroutines are asleep - deadlock!
```

遍历数组指针，其实就是在遍历其指向的数组。如：
```
a := [2]int{10, 11}
p := &a
fmt.Printf("%T\n", p)
for i, v := range p {
        fmt.Printf("i=%v, v=%v\n", i, v)
}
// output:
*[2]int
i=0, v=10
i=1, v=11
```

在遍历数组时，实际遍历的是数组的复制品，所以会发生内存拷贝。可以转换为切片再遍历。
比如：
```
data := [3]int{10, 20, 30}
for i, x := range data { // 这里有内存拷贝
}
// 不会拷贝内存
for i, x := range data[:] {
}
```



