package main

import "fmt"

func main() {
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
}
