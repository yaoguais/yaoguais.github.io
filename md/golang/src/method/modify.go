package main

import "fmt"

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
