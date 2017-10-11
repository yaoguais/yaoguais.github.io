package main

import "fmt"

func inc(x *int, name string) int {
	fmt.Printf("%s: %d\n", name, *x)
	*x++
	return *x
}

func main() {
	x, y := 1, 3
	x, y = inc(&y, "y"), inc(&x, "x")
	fmt.Printf("x=%d, y=%d\n", x, y)
}
