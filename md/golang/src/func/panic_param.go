package main

import "fmt"

func test(n int) int {
	defer func() {
		if err := recover(); err != nil {
			fmt.Printf("err: %#v\n", err)
		}
		n++
		fmt.Printf("after recover %v\n", n)
	}()
	n++
	panic("cause panic")
	n++
	fmt.Printf("after panic %v\n", n)
	return n
}

func testReturn() (n int) {
	defer func() {
		if err := recover(); err != nil {
			fmt.Printf("err: %#v\n", err)
		}
		n++
		fmt.Printf("after recover %v\n", n)
	}()
	n++
	panic("cause panic")
	n++
	fmt.Printf("after panic %v\n", n)
	return n
}

func testParamInt() {
	defer func() {
		if err := recover(); err != nil {
			fmt.Printf("err: %T %#v\n", err, err)
		}
	}()
	panic(1)
}

func testParamString() {
	defer func() {
		if err := recover(); err != nil {
			fmt.Printf("err: %T %#v\n", err, err)
		}
	}()
	panic("hello")
}

func testParamFunc() {
	defer func() {
		if err := recover(); err != nil {
			fmt.Printf("err: %T %#v\n", err, err)
		}
	}()
	panic(func() int {
		return 1
	})
}

func main() {
	fmt.Printf("main test %v\n", test(1))
	fmt.Printf("main testReturn %v\n", testReturn())
	testParamInt()
	testParamString()
	testParamFunc()
}
