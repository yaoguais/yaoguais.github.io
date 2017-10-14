package main

import (
	"fmt"
	"time"
)

func main() {
	{
		a := 1
		p := &a
		c := make(chan *int)
		go func() {
			c <- p
			*p++
			fmt.Printf("sync channel write success, write %v\n", a)
		}()
		b := <-c
		fmt.Printf("sync channel read success, read %v\n", *b)
	}
	{
		n := 2
		c := make(chan int, n)
		go func() {
			for i := 0; i < n; i++ {
				c <- 1
				fmt.Println("async channel write success")
				time.Sleep(time.Second)
			}
		}()
		for i := 0; i < n; i++ {
			<-c
			fmt.Println("async channel read success")
		}
	}
}
