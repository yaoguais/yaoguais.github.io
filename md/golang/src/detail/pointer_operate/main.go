package main

import (
	"fmt"
	"unsafe"
)

func main() {
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
}
