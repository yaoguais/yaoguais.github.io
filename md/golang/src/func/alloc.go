package main

// 指针参数导致实参重新被分配到堆上

func test(p *int) {
	go func() {
		println(p)
	}()
}

func main() {
	x := 0
	p := &x
	test(p)
}
