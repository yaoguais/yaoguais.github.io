package main

import (
	"fmt"
	"time"
)

var globN int

func addGlobN() int {
	globN++
	return globN
}

func test1() []func() {
	var s []func()
	for i := 0; i < 2; i++ {
		s = append(s, func() {
			fmt.Printf("test1 %p %v\n", &i, i)
		})
	}
	return s
}

func test2() []func() {
	var s []func()
	for i := 0; i < 2; i++ {
		x := i
		s = append(s, func() {
			fmt.Printf("test2 %p %v\n", &x, x)
		})
	}
	return s
}

func main() {
	for _, f := range test1() {
		f()
	}
	for _, f := range test2() {
		f()
	}
	{
		a := 1
		go func() {
			fmt.Printf("go a=%v\n", a)
		}()
		a++
		fmt.Printf("main a=%v\n", a)
	}
	{
		b := 1
		func() {
			b++
			fmt.Printf("func b=%v\n", b)
		}()
		b++
		fmt.Printf("main b=%v\n", b)
	}
	{
		go func(n int) {
			fmt.Printf("go n=%v\n", n)
		}(addGlobN())
		fmt.Printf("main globN=%v\n", addGlobN())
	}
	time.Sleep(2 * time.Second)
}
