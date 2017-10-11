package main

import "fmt"

func main() {
	a := [2]int{10, 11}
	p := &a
	fmt.Printf("%T\n", p)
	for i, v := range p {
		fmt.Printf("i=%v, v=%v\n", i, v)
	}
}
