package main

import "fmt"

func main() {
	// 申明
	// 申明时，每一纬长度都要明确，要不然就申明成切片了。
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
}
