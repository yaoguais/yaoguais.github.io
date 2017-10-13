package main

func test() (z int) {
	defer func() {
		println("defer", z)
		z += 1
	}()
	return 2
}

func main() {
	println("return", test())
}
