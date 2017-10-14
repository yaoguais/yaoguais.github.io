package main

import "fmt"

func test() {
	defer func() {
		fmt.Printf("test recover '%v'\n", recover())
		panic("test panic in defer")
	}()
	panic("test panic")
}

func main() {
	defer func() {
		fmt.Printf("main recover '%v'\n", recover())
	}()
	test()
}
