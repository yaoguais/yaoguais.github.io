## Golang细节梳理

熟话说，“工欲善其事，必先利其器”。接触Golang也近一年半，多次想梳理一下，都半途而废，这次趁着空闲，刚好可以一一记录下来。

内容多摘自《Go语言学习笔记》，或他人博文，或官方文档。形式为概括与代码结合，阐述也多以代码注释出现。

本篇文档概括至Go最新发布版，且不定更新。主要分三个方面：一是语言特性，如“类型、表达式、函数、数据、方法、接口”等；
二是编程技巧与理念，如“缓存池、用通信实现数据共享”；三是个人理解，如“对开源项目解构”。

目录：

1. 类型
2. 常量与变量
3. 表达式
4. 数据
5. 结构体
6. 函数
7. 方法
8. 接口
9. 通道




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

当声明一个变量时，系统都被默认初始化，以确保不会发生异常。这不同于C的局部变量。

其总结如下：

- false：bool
- 0：int族、uintptr
- 0.0：float族
- 空字符串""：string
- nil：function、interface、slice、map、channel

array、struct根据其元素不同而对应赋予默认值。

（7）类型推断

类型推断就是不用声明具体的类型，而根据被赋予的值推断类型。
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

在声明时，可以使用常量组，如果不指定类型和初始值，则与上一行非空常量右值表达式文本相同。
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
- 不能声明其数据类型
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





### 数据

Golang内置的数据类型我们已经在“类型”一章已经梳理。这部分重点讲解string、array、slice、map。
像struct我们单独放一章。

（1）字符串

字符串是不可变字符序列，在golang中的定义类似于[]byte+length。

其有一下特点：

- 不同于C的字符串，结尾没有NULL。而用额外字段length保存内存长度，因而是二进制安全的。
- 默认以UTF-8存储，但是支持十六进制、八进制、UTF编码，如"\x61\142\u0041"。
- 可用内置函数len获取长度，但不支持使用cap函数。
- 默认值是空字符串""，而不是nil。
- 可以使用命令提示符“`”，实现跨行字符串。
- 支持比较符，支持“+、=+”。
- 支持用下标获取元素，元素类型为uint8，如“str[0]”。
- 不支持设置元素，如“str[0] = 'A'”会报错。
- 使用for...range遍历可以获取Unicode字符，比如从字符串“好的”获取“好”出来。可以参考下面代码。
- 要修改字符串，可以将其转换为[]byte或[]rune，修改后再转换回来。但是一定会重新分配内存。
- 可用append函数将字符串添加到[]byte中，如“bs = append(bs, "abc"...)”。
- 拼接多个字符串，可用bytes.Buffer提升性能。
- 拼接字符串，可以考虑在栈上先分配一个大字节数组，避免垃圾回收，从而提升性能。
- 标准库“utf8”已提供方法用作判断Unicode字符串是否合法和获取其长度。

实现字符串截取：
```
s := "abcdefg"
s1 := s[:3]
s2 := s[1:4]
s3 := s[2:]
fmt.Printf("%s %s %s\n", s1, s2, s3)
fmt.Printf("%#v\n", (*reflect.StringHeader)(unsafe.Pointer(&s)))
fmt.Printf("%#v\n", (*reflect.StringHeader)(unsafe.Pointer(&s1)))
// s1[0] = 'A'
// fmt.Printf("%s %s %s\n", s1, s2, s3)

// output:
abc bcd cdefg
&reflect.StringHeader{Data:0x4b9008, Len:7}
&reflect.StringHeader{Data:0x4b9008, Len:3}
```

使用for...range遍历Unicode字符串：
```
s := "汉字a"
for i := 0; i < len(s); i++ {
        fmt.Printf("%d %c\n", i, s[i])
}
for i, v := range s {
        fmt.Printf("%d %c\n", i, v)
}
// output:
0 æ
1 ±
2 
3 å
4 ­
5 
6 a
0 汉
3 字
6 a
```

因为字符串和[]byte转换会涉及内存拷贝，可以取巧地使用unsafe.Pointer进行转换而不发生内存拷贝。

```
package main

import (
        "fmt"
        "reflect"
        "unsafe"
)

func SliceToString(bs []byte) string {
        return *(*string)(unsafe.Pointer(&bs))
}

func StringToSlice(s string) []byte {
        sh := (*reflect.SliceHeader)(unsafe.Pointer(&s))
        sh.Cap = len(s)
        return *(*[]byte)(unsafe.Pointer(sh))
}

func main() {
        bs := []byte("hello")
        arr := [2]byte{'a', 'b'}
        fmt.Println(SliceToString(bs))
        fmt.Println(SliceToString(arr[:]))
        fmt.Printf("%#v\n", StringToSlice("hello"))
}
// output:
hello
ab
[]byte{0x68, 0x65, 0x6c, 0x6c, 0x6f}
```


（2）数组

数组主要关注其声明和赋值，其常见形式如下：

```
// 声明
// 声明时，每一纬长度都要明确，要不然就声明成切片了。
var a [2]int
var b [2][2]int
var c [2]int
var d [2][2][2]int
// 初始化
e := [4]int{1, 2}
f := [4]int{10, 3: 13}
g := [...]int{1, 2, 3} // 自动推导长度
h := [...]int{10, 3: 13}
i := [...]int{10, 3: 13, 14}
type user struct {
        name string
}
j := [...]user{
        {"Tom"},
        {name: "Jack"},
}
k := [2]*user{
        &user{"Tom"},
        &user{"Jack"},
}
// 赋值
a = [2]int{1}
b = [2][2]int{1: {1: 1}}

fmt.Println(a, b, c, d, e, f, g, h, i, j, k)
```

综合来看数组有以下特点：

- 声明时，每一纬长度都要指明。
- 定义时，只有第一维能使用“...”进行推断。
- 内置函数len和cap都返回第一维长度
- 如果元素都支持“==或!=”比较符，那么数组也可以比较，否则会报错。
- 区别数组指针“*[2]int”和指针数组“[2]*int”。
- 数组作为参数或者赋值都会导致内存拷贝，解决办法是转换为切片或者指针。



（3）切片

切片是数组的包装。其还有一个指向底层数据的指针，和len、cap两个属性。

其声明和初始化如下：
```
// 声明
var a []int
var b []int
var c []int
// 初始化
a = make([]int, 0, 5) // len, cap
b = make([]int, 5)    // len, cap默认等于len
c = append(c, 1)
d := []int{10, 3: 13}
// 截取
e := []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9}
f := e[:]
g := e[1:2]
h := e[1:2:6]
i := e[:1:3]
// i := e[1::3] // 语法错误。按1个位置都可以忽略共7种可能，只有这种不行从而有6种可行。
// 其语法含义为[start:end:max]; len = end - start; cap = max - start; cap >= len;
fmt.Println(a, b, c, d)
fmt.Println(e)
fmt.Printf("%#v len:%d cap:%d\n", f, len(f), cap(f))
fmt.Printf("%#v len:%d cap:%d\n", g, len(g), cap(g))
fmt.Printf("%#v len:%d cap:%d\n", h, len(h), cap(h))
fmt.Printf("%#v len:%d cap:%d\n", i, len(i), cap(i))
// output:
[] [0 0 0 0 0] [1] [10 0 0 13]
[0 1 2 3 4 5 6 7 8 9]
[]int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9} len:10 cap:10
[]int{1} len:1 cap:9
[]int{1} len:1 cap:5
[]int{0} len:1 cap:3
```

切片还有以下特点：

- 不像数组，它不支持比较操作，仅可判断是否为nil。
- 可以使用“s[:]”进行截取。


- 支持append函数，append函数从第二个参数开始，都应是切片的元素。
- 支持copy(起始地址，新增内容)函数。


（4）字典

字典即为哈希表。
字典要求key必须能够比较，以便在哈希冲突时解决冲突。
如数字、字符串、指针、某些数组、结构体，某些接口。

其有如下特点：

- 因为是引用类型，需要用make初始化。
- 获取不存在的key，返回val的默认值。最好使用ok-idiom模式，“v, ok =:= m["k"]”。
- for...range每次遍历，生成的key的序列是不同的。即遍历访问key是随机的。
- 可以使用len获取元素个数，但不支持cap函数。
- 字典是非线程安全的，并发读写或删除都会导致错误。
- nil字典不可写，但可以读，只是key都是不存在的。
- 一般为避免重新哈希，需要多少个元素，应创建字典时就指定好。如“m:=make(map[string]string, 1024)”。
- 字典不会收缩内存，删除大部分key后，可考虑创建新字典以释放内存。
- Go1.9新增sync.Map作为线程安全的字典，其性能较高，但因为不是内置类型，使用上需当自定义类型使用。



### 结构体

结构体将不同类型的字段组合成一个复合类型。

常见的声明定义初始化如下：
```
type node struct {
        _    int
        _    int
        val  int
        next *node
}
type user struct {
        name string
        age  byte
}
// u1 := user{"Tom"} // error: too fewer values
u1 := user{"Tom", 16}
u2 := user{name: "Tom"}

u3 := struct {
        name string
        age  byte
}{
        name: "Tom",
        age:  20,
}
type file struct {
        name string
        attr struct {
                owner int
                perm  int
        }
}
f := file{
        name: "a.txt",
        //attr: {
        //  owner: 1,
        //  perm: 0755,
        //},
}
f.attr.owner = 1
f.attr.perm = 0775

type attr struct {
        perm int
}
type File struct {
        name string
        attr
}
f2 := File{
        name: "a.txt",
        attr: attr{
                perm: 0755,
        },
}
f2.perm = 0775

type FILE struct {
        name string
}
type log struct {
        name string
}
type data struct {
        FILE
        log
}
g := data{}
// g.name = "go" // error
g.log.name = "go"
fmt.Println(u1, u2, u3, f, f2, g)
```

综合上面，结构体具有以下特点：

- 可用“_”作为字段名进行占位，多用于补齐内存布局。
- 如果结构体只用一次，可以声明为匿名结构体。
- 空结构struct{}多用在通道，作为通知作用，因为其占内存最小。
- 结构体支持匿名字段，当匿名字段有属性重名时，需显式读写。
- 字段标签也是结构的一部分。Go1.9后，只有标签不同的结构体可以相互赋值。


### 函数

函数是特定功能的最小单元。Go中使用func定义函数。

（1）定义及特点

其定义如下：
```
func someFunc(int a, int b) (c int, err error) {
}
带变长参数函数：
func format(s string, a ...interface{}) (string, error){
}
```

函数具有以下特点：

- 仅能判断函数是否为nil, nil也为函数的默认值。不支持比较操作。
- 通道也可传递函数，包括匿名函数。
- 支持匿名函数。支持闭包。
- 支持延迟调用defer，其顺序是前进后出，构成延迟调用栈。
- 错误处理中，error多为最后一个返回值。如“func some() (int, error){}”。
- 没有try/catch，而使用panic/recover。


（2）参数

函数参数有以下特点：

- 参数不支持默认值，命名支持“_”。紧邻的参数类型相同，可只声明最后一个参数类型。
- 传递参数都是值拷贝，只不过拷贝引用类型，可以通过形参修改实参。
- 在调用变参函数时，可以使用“...”展开切片，如“format("%d %d", []interface{}{1, 2}...)”。

传参，是传递值还是指针？

- 值传递主要消耗在拷贝，但内存是分配在栈上的。
- 指针传递可能导致堆上的内存分配。
- 重点还是在拷贝成本，高则指针，不高则值。

```
// 指针参数导致实参重新被分配到堆上

func test(p *int) {
        go func() {
                println(p)
        }()
}

func main() {
        x := 0
        p := &x
        test(p)
}
```


（3）返回值

Golang是支持多返回值的，但常用在返回错误了。

其有以下几个特点：

- 函数返回局部变量是安全的。不同于C语言。
- 返回内容可以通过返回值，也可通过耳机指针参数，在C语言中常用。
- 返回值可以使用“_”忽略。
- 多返回可直接传入函数参数，不必展开。如“a(int,int){};b(int,int){};a(b());”。
- 命令返回值，多用于生成doc。它也是函数内部的局部变量，可以随时修改。
- 命令返回值，最好要么全部命名，全部不命名，不然return时会导致错误。


（4）匿名函数

匿名函数与一般函数无异，系统会自动给它分配一个隐式的名称。

其有以下特点：

- 未被使用的匿名函数，会导致错误。
- 可以赋值给变量，作为参数，作为返回值，作为结构体字段，通过通道传递。

常见的使用方式如下：
```
func exec(f func()) {
        f()
}

func add(a, b int) int {
        return a + b
}

type FuncAdd func(int, int) int

func returnFunc() FuncAdd {
        return func(a, b int) int {
                return a + b
        }
}

func main() {
        f := func(a, b int) int {
                return a + b
        }
        println(f(1, 2))

        exec(func() {
                fmt.Println("as a parameter")
        })

        println(returnFunc()(1, 2))

        type data struct {
                x int
                f func(int, int) int
        }

        d1 := data{
                x: 1,
                f: func(a, b int) int {
                        return a + b
                },
        }
        println(d1.f(1, 2))
        d2 := data{
                x: 1,
                f: add,
        }
        println(d2.f(1, 2))

        c := make(chan func(int, int) int, 1)
        c <- func(a, b int) int {
                return a + b
        }
        f3 := <-c
        println(f3(1, 2))
}
```

（5）defer

defer常用在资源释放、释放锁、错误处理等。其顺序是前进后出，构成延迟调用栈。

defer也会有一定的性能损耗，因为它它需要执行注册、执行等操作。

可以理解为defer是插入在函数退栈指令前的指定片段，当然也就在return语句的指令后面了。

```
func test() (z int) {
        defer func() {
                println("defer", z)
                z += 1
        }()
        return 2
}

func main() {
        println("return", test())
}
// output:
defer 2
return 3
```




（6）panic/recover

它们的定义如下：

```
func panic(interface{})
func recover() interface{}
```

其有如下特点：

- 可以使用recover捕获panic提交的错误对象，panic提交什么对象，recover原样接收，必要时需要进行类型转换。
- panic会中断函数调用，忽略panic函数后面的语句，而执行延迟调用。 未命名的返回值，一定返回它的默认值。
- panic像其他语言一样，一直沿函数调用栈把异常提交到main函数，如果main函数也未捕捉，那么进程奔溃。
- recover必须放到函数体中，且必须和defer配合。否则不能catch住，而导致进程崩溃。
- defer里面再次panic，不会影响后续defer。相当于再次抛出异常，从而继续按函数栈回溯或被后面的defer捕获。
- 没有异常或非正确的recover，其返回值是interface{} nil。
- 连续的panic，仅最后一个会被recover捕获。

参考代码如下：

```
func test(n int) int {
        defer func() {
                if err := recover(); err != nil {
                        fmt.Printf("err: %#v\n", err)
                }
                n++
                fmt.Printf("after recover %v\n", n)
        }()
        n++
        panic("cause panic")
        n++
        fmt.Printf("after panic %v\n", n)
        return n
}

func testReturn() (n int) {
        defer func() {
                if err := recover(); err != nil {
                        fmt.Printf("err: %#v\n", err)
                }
                n++
                fmt.Printf("after recover %v\n", n)
        }()
        n++
        panic("cause panic")
        n++
        fmt.Printf("after panic %v\n", n)
        return n
}

func testParamInt() {
        defer func() {
                if err := recover(); err != nil {
                        fmt.Printf("err: %T %#v\n", err, err)
                }
        }()
        panic(1)
}

func testParamString() {
        defer func() {
                if err := recover(); err != nil {
                        fmt.Printf("err: %T %#v\n", err, err)
                }
        }()
        panic("hello")
}

func testParamFunc() {
        defer func() {
                if err := recover(); err != nil {
                        fmt.Printf("err: %T %#v\n", err, err)
                }
        }()
        panic(func() int {
                return 1
        })
}

func main() {
        fmt.Printf("main test %v\n", test(1))
        fmt.Printf("main testReturn %v\n", testReturn())
        testParamInt()
        testParamString()
        testParamFunc()
}
// output:
err: "cause panic"
after recover 3
main test 0
err: "cause panic"
after recover 2
main testReturn 2
err: int 1
err: string "hello"
err: func() int (func() int)(0x489f00)
```

recover一定要放到defer的函数体中，否则无法生效。但是defer的语句依然会正常执行。

```
func main() {
        defer println("recover", recover())
        panic("error come")
        println("ok")
}
// output:
recover (0x0,0x0)
panic: error come

goroutine 1 [running]:
main.main()

```

defer中再次抛出异常。

```
func test() {
        defer func() {
                fmt.Printf("test recover '%v'\n", recover())
                panic("test panic in defer")
        }()
        panic("test panic")
}

func main() {
        defer func() {
                fmt.Printf("main recover '%v'\n", recover())
        }()
        test()
}
// output:
test recover 'test panic'
main recover 'test panic in defer'
```

连续的panic。

```
func main() {
        defer func() {
                fmt.Printf("first defer recover '%v'\n", recover())
        }()
        defer func() {
                for i := 0; i < 3; i++ {
                        fmt.Printf("recover in for '%v'\n", recover())
                }
                panic("defer with for")
        }()
        defer func() {
                panic("last defer")
        }()
        panic("in main")
}
// output:
recover in for 'last defer'
recover in for '<nil>'
recover in for '<nil>'
first defer recover 'defer with for'
```


### 方法

方法是有名类型绑定的函数。

（1）定义

除内置的“int、string”等外，可以为任何有名类型定义绑定方法。

一般定义如下：

```
type N int
func (x N) toString() string {
    return fmt.Sprintf("%v", x)
}
```

（2）匿名字段

可以直接调用结构体中匿名字段的方法。
但是如果结构体也绑定同样的方法，直接调用会调用结构体的方法。若想调用匿名字段的方法，需写清楚字段名，如“f.log.ToString()”。

（3）方法集

类型的方法集，决定其是否实现某一接口。

其有如下规则：

- 类型T方法集包含所有receiver T的方法。
- 类型*T包含所有receiver T + *T方法。
- 匿名嵌入S，T还包含所有receiver S的方法。
- 匿名嵌入*S，T还包含所有receiver S + *S方法。
- 匿名嵌入S或*S，*T还包含所有receiver S + *S方法。

可见，匿名字段即为方法集而精心设计的。

（4）类型或类型指针

在定义方法时，是使用T还是*T时，有以下几个区别：

- 造成类型的方法集不同。
- 调用方法时，会发生内存拷贝，那么类型无法修改T的数据，*T由于是拷贝指针而可以修改。
- 下面讲到接口，做类型转换同样有T无法修改数据而*T可以的区别。

其实我们在调用时，把T或*T当成传入函数的第一个参数，就好理解了。发不发生拷贝，就看其是不是指针或引用类型。

```
type N int

func (n N) value() {
        n++
        fmt.Printf("%p %v\n", &n, n)
}

func (n *N) pointer() {
        *n++
        fmt.Printf("%p %v\n", n, *n)
}
func main() {
        var n N = 1
        n.value()
        fmt.Printf("%p %v\n", &n, n)
        n.pointer()
        fmt.Printf("%p %v\n", &n, n)
}
// output:
0xc4200120b8 2
0xc4200120b0 1
0xc4200120b0 2
0xc4200120b0 2
```

那么如何选择使用T还是*T，大致有如下的规则：

- 要修改实例的状态，用*T。
- 无需修改状态的小对象或固定值，用T。
- 大对象建议用*T，以减少内存拷贝的成本。
- 引用类型、字符串、函数等指针包装对象，直接使用T。
- 若包含Mutex等同步字段，用*T，以避免用T时内存拷贝，造成无效的锁操作。
- 其他无法确定的情况，建议使用*T。

总之就是一句话，不知道选哪个的时候，用*T就行了。


（5）方法作为表达式

就像我们在C语言中，能把函数名赋值给变量一样。Golang中也可以把函数和方法赋值给变量，同样可以用变量实现函数调用。

```
type N int

func (n N) value() {
        n++
        fmt.Printf("%p %v\n", &n, n)
}

func (n *N) pointer() {
        *n++
        fmt.Printf("%p %v\n", n, *n)
}

func main() {
        var n N = 1
        fmt.Printf("%p %v\n", &n, n)

        f1 := N.value
        f2 := (*N).value
        //f3 := N.pointer // N.pointer undefined (type N has no method pointer)
        f4 := (*N).pointer

        f1(n)
        fmt.Printf("%p %v\n", &n, n)
        f2(&n)
        fmt.Printf("%p %v\n", &n, n)
        // f3(&n)
        // fmt.Printf("%p %v\n", &n, n)
        f4(&n)
        fmt.Printf("%p %v\n", &n, n)

        N.value(n)
        fmt.Printf("%p %v\n", &n, n)
        // (*N).pointer(n)
        // cannot use n (type N) as type *N in argument to (*N).pointer

}
// output:
0xc4200120b0 1
0xc4200120d0 2
0xc4200120b0 1
0xc4200120e8 2
0xc4200120b0 1
0xc4200120b0 2
0xc4200120b0 2
0xc420012110 3
0xc4200120b0 2
```

从上面的输出可以看出以下几点：

- 方法的第一个参数需要与声明的类型一致，*T就必须传入指针，否则编译报类型不匹配。
- 不管使用T还是*T，只要调用的是T的方法，都会发生复制。
- 因为T类型的方法集中没有pointer方法，调用自然会编译报错。
- *T方法调用不会发生复制，从而可以修改原实例。





### 接口

接口是多个方法的集合。

接口只有包含两种内容：函数声明和嵌入的其他接口名。而不能有常量等等。

（1）特点

- 支持ok-idiom模式，尝试进行转换，如“v, ok := x.(fmt.Stringer)”。
- 超集接口变量可以转换为子集接口变量，就类似于把子类对象赋值给父类对象。
- 接口嵌入接口，不能形成循环嵌套。

（2）空接口

空接口类似于Java中的Object，任何值都可以赋予空接口。

比如我们想实现一个函数，可以处理任意类型的数据，那么我们可以把参数定义为空接口。

```
func printType(x interface{}) {
        switch x.(type) {
        case int:
                fmt.Println("int")
        case *int:
                fmt.Println("*int")
        case string:
                fmt.Println("string")
        default:
                fmt.Printf("%T\n", x)
        }
}

func main() {
        printType(1)
        printType("hello")
        a := 1
        printType(&a)
        b := "s"
        printType(&b)
}
// output:
int
string
*int
*string
```

（3）类型或类型指针

当我们把T或*T赋值给接口对象时，它们的区别如下：

- 必然的，它们都实现了目标接口。
- 无法修改T的数据，但是可以修改\*T的。原因是赋值给接口，那么接口中保存的是T或者\*T的拷贝。

```
type data struct {
        x int
}
// var t interface{} = data{100}
// p := &t.(data) // cannot take the address of t.(data)
// t.(data).x = 101 // cannot assign to t.(data).x
// fmt.Println(t)
a := &data{200}
var b interface{} = a
c := b.(*data)
c.x = 201
fmt.Println(a.x, c.x)
// output:
201 201
```

（4）是否相等

判断相等常见在判断error是否为nil，但是这里极易错误。
只有一个接口变量在类型和内容都为nil时，才为nil。

```
type myErr struct {
}

func (*myErr) Error() string {
        return "error"
}

func main() {
        var a interface{} = nil
        var b interface{} = (*int)(nil) // 内容是个指针
        var c, d interface{}
        type e struct {
                x int
        }
        var f interface{} = e{100}
        var g interface{} = e{100}
        var h interface{} = e{101}
        var i *myErr
        var j error = i
        fmt.Println(a == nil, b == nil, c == d, b == c, f == g, f == h, j == nil)
}
// output:
true false true false true false false
```




### 通道

通过是用作数据共享的队列。通道分为同步通道和异步通道。

（1）创建

通道可以创建同步通道、异步通道、单发通道、单收通道。

```
// 同步通道
a := make(chan int)
b := make(chan int, 0)
// 异步通道
c := make(chan int, 1)
d := make(chan int, 2)
// 单发通道
var e chan<- int = a
// 单收通道
var f <-chan int = a
```


（2）收发规则

对于已初始化的通道：

- 同步通道最多保存一个数据，当通道有数据时写入会阻塞，当通道没有数据时读取会阻塞。
- 异步通道可以保存一个或多个数据，当通道满时写入会阻塞，当通道没有数据时读取会阻塞。

对于closed和nil通道，有以下特点：

- 向closed通道发送数据，引发panic。
- 向closed通道接收数据，返回已缓冲数据或nil。
- nil通道，无论收发都会阻塞。

（3）关闭规则

- 重复关闭通道，会引发panic。
- 不能关闭单收通道。
- 关闭通道，所有接收操作都可以收到通知。常用作一次性通知事件。

（4）len与cap

同步通道len和cap函数都返回0。
函数len可以获取异步通道当前已缓冲的数量，cap获取缓冲区大小。
因此可以通过这点判断通道是同步还是异步。

（5）注意事项

- 发送大数据，应该使用指针，避免复制。
- 因为操作通道实际会有锁，所以可以通过把多个数据打包成一个数据发送，从而提升性能。
- 务必避免使通道永久阻塞，从而导致死锁或goroutine内存泄漏。


