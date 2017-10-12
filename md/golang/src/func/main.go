package main

import "fmt"

func main() {
	a := fmt.Sprintf("%d %d", []interface{}{1, 2}...)
	fmt.Println(a)
}
