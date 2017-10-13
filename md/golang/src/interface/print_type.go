package main

import "fmt"

func printType(x interface{}) {
	switch x.(type) {
	case int:
		fmt.Println("int")
	case *int:
		fmt.Println("*int")
	case string:
		fmt.Println("string")
	default:
		fmt.Printf("%T\n", x)
	}
}

func main() {
	printType(1)
	printType("hello")
	a := 1
	printType(&a)
	b := "s"
	printType(&b)
}
