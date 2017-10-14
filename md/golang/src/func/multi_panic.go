package main

import "fmt"

func main() {
	defer func() {
		fmt.Printf("first defer recover '%v'\n", recover())
	}()
	defer func() {
		for i := 0; i < 3; i++ {
			fmt.Printf("recover in for '%v'\n", recover())
		}
		panic("defer with for")
	}()
	defer func() {
		panic("last defer")
	}()
	panic("in main")
}
