package main

import "fmt"

func main() {
	s := "汉字a"
	for i := 0; i < len(s); i++ {
		fmt.Printf("%d %c\n", i, s[i])
	}
	for i, v := range s {
		fmt.Printf("%d %c\n", i, v)
	}
}
