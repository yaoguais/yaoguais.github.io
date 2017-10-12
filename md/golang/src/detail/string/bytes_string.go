package main

import (
	"fmt"
	"reflect"
	"unsafe"
)

func SliceToString(bs []byte) string {
	return *(*string)(unsafe.Pointer(&bs))
}

func StringToSlice(s string) []byte {
	sh := (*reflect.SliceHeader)(unsafe.Pointer(&s))
	sh.Cap = len(s)
	return *(*[]byte)(unsafe.Pointer(sh))
}

func main() {
	bs := []byte("hello")
	arr := [2]byte{'a', 'b'}
	fmt.Println(SliceToString(bs))
	fmt.Println(SliceToString(arr[:]))
	fmt.Printf("%#v\n", StringToSlice("hello"))
}
