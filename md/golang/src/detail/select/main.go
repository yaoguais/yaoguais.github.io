package main

import "fmt"

func main() {
	c := make(chan int)
	go func() {
		n := 0
	Exit:
		for {
			select {
			case v, ok := <-c:
				fmt.Printf("v=%v, ok=%v\n", v, ok)
				if !ok {
					n++
					if n > 2 {
						break Exit
					}
				}
			}
		}
	}()
	c <- 1
	close(c)

	done := make(chan int)
	<-done
}
