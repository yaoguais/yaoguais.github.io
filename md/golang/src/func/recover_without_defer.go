package main

func main() {
	defer println("recover", recover())
	panic("error come")
	println("ok")
}
