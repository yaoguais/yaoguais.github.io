package main

import "fmt"

func main() {
	var1 := 0
	var2 := 0.0
	// var3 := 0xffffffffffffffff //constant 18446744073709551615 overflows int
	var4 := 'c'
	var5 := '我'
	fmt.Printf("0: %T\n", var1)
	fmt.Printf("0.0: %T\n", var2)
	// fmt.Printf("0xffffffffffffffff: %T\n", var3)
	fmt.Printf("c: %T\n", var4)
	fmt.Printf("我: %T\n", var5)
}
