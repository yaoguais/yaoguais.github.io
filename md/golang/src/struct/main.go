package main

import "fmt"

func main() {
	type node struct {
		_    int
		_    int
		val  int
		next *node
	}
	type user struct {
		name string
		age  byte
	}
	// u1 := user{"Tom"} // error: too fewer values
	u1 := user{"Tom", 16}
	u2 := user{name: "Tom"}

	u3 := struct {
		name string
		age  byte
	}{
		name: "Tom",
		age:  20,
	}
	type file struct {
		name string
		attr struct {
			owner int
			perm  int
		}
	}
	f := file{
		name: "a.txt",
		//attr: {
		//  owner: 1,
		//  perm: 0755,
		//},
	}
	f.attr.owner = 1
	f.attr.perm = 0775

	type attr struct {
		perm int
	}
	type File struct {
		name string
		attr
	}
	f2 := File{
		name: "a.txt",
		attr: attr{
			perm: 0755,
		},
	}
	f2.perm = 0775

	type FILE struct {
		name string
	}
	type log struct {
		name string
	}
	type data struct {
		FILE
		log
	}
	g := data{}
	// g.name = "go" // error
	g.log.name = "go"
	fmt.Println(u1, u2, u3, f, f2, g)
}
