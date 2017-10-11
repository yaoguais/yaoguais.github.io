package main

import "fmt"

func main() {
	var x int
	for x, y := 1, 1; x < 5; x, y = x+1, y+1 {
		fmt.Printf("%d ", x)
	}
	fmt.Printf("\nx=%d\n", x)
}
