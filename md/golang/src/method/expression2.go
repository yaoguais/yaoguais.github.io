package main

import "fmt"

type N int

func (n N) value() {
	fmt.Printf("value %p %v\n", &n, n)
}

func (n *N) pointer() {
	fmt.Printf("pointer %p %v\n", n, *n)
}

func exec(f func()) {
	f()
}

func main() {
	{
		var n N
		p := &n
		n++
		f1 := n.value
		n++
		f2 := n.value
		n++
		fmt.Printf("main %p %v\n", p, n)
		f1()
		f2()
	}
	{
		var n N
		p := &n
		fmt.Printf("main %p %v\n", p, n)
		n++
		exec(n.value)
		n++
		exec(p.value)
	}
	{
		var n N
		p := &n
		n++
		f1 := n.pointer
		n++
		f2 := n.pointer
		n++
		fmt.Printf("main %p %v\n", p, n)
		f1()
		f2()
	}
}
