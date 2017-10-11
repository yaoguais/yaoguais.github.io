package main

import "fmt"

func main() {
Exit:
	// fmt.Println("generate invalid break label")
	for i := 0; i < 5; i++ {
		for j := 0; j < 5; j++ {
			fmt.Println(i, j)
			if i+j >= 4 {
				break Exit
			}
		}
	}
	fmt.Println("end")
}
