package main

import "fmt"

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
