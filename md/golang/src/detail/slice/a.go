package main

func main() {
	a := [2]int{1, 2}
	b := &a[1]
	c := &a[0]
	println(b, c)
}
