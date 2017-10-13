package main

import "fmt"

type myErr struct {
}

func (*myErr) Error() string {
	return "error"
}

func main() {
	var a interface{} = nil
	var b interface{} = (*int)(nil)
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
