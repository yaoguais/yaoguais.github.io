package main

import "fmt"

func main() {
	switch x := 1; x {
	case 1:
		fmt.Println(x)
	default:
		fmt.Println("true")
	}
}
