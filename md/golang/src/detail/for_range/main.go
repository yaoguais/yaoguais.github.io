package main

import "fmt"

func main() {
	fmt.Println("普通字符串")
	for i, v := range "abc" {
		fmt.Printf("i=%v, v=%v\n", i, v)
	}
	fmt.Println("汉字字符串")
	for i, v := range "汉字" {
		fmt.Printf("i=%v, v=%v\n", i, v)
	}
	fmt.Println("数组")
	for i, v := range [2]int{10, 11} {
		fmt.Printf("i=%v, v=%v\n", i, v)
	}
	for i := range [2]int{10, 11} {
		fmt.Printf("i=%v\n", i)
	}
	fmt.Println("切片")
	for i, v := range []int{10, 11} {
		fmt.Printf("i=%v, v=%v\n", i, v)
	}
	fmt.Println("字典")
	m := make(map[string]string)
	m["a"] = "b"
	for k, v := range m {
		fmt.Printf("k=%v, v=%v\n", k, v)
	}
	for k := range m {
		fmt.Printf("k=%v\n", k)
	}
	fmt.Println("通道")
	c := make(chan int)
	go func() {
		for v := range c {
			fmt.Printf("v=%v\n", v)
		}
		fmt.Println("read channel finish")
	}()
	c <- 20
	c <- 21
	close(c)
	// c = nil // 会导致for-range阻塞，从而可能导致死锁。
	fmt.Println("局部变量会重复使用")
	for i, v := range [2]int{10, 11} {
		fmt.Printf("i=%v, v=%v\n", &i, &v)
	}

	done := make(chan struct{})
	<-done
}
