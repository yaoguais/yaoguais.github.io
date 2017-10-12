package main

import "fmt"

func main() {
	var a [2]int
	var b *[2]int
	b = &a
	fmt.Printf("%#v\n", b)

	var c int
	var d [2]*int
	d = [2]*int{&c}
	fmt.Printf("%#v\n", d)
}
