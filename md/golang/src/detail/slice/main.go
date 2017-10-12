package main

import "fmt"

func main() {
	// 申明
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
}
