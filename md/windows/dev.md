# 如何在Windows上搭建开发环境

前言：好久没用Windows了，依然一样的好用..
这篇是记录如何在Windows上搭建Golang的开发环境，其中还用到Git、Github、Vscode。

目录:

1. [下载迅雷](#下载迅雷)
2. [安装golang](#安装golang)
3. [配置git和github](#配置git和github)
4. [vscode安装](#vscode安装)
5. [配置vpn](#配置vpn)


## 下载迅雷

真的，不开VPN，你就不晓得访问国外的网站究竟有多慢。
所以下载个迅雷加速软件的下载，下载的时候注意查看下迅雷的实际下载地址。
不要又下成别人的木马了。
至于怎么在WIndows上安装VPN，后面再试。

## 安装golang

Golang的话，最好也在中国的官方下载，国外慢的不能忍！

下载地址：http://golangtc.com/download

如果是32位电脑下载386的msi,如果是64位的下载amd64的，现在应该没开发还在用32位的系统了吧？

1.8beta1的版本安装老是有问题，总是提示

```
C:\workspace\src>go build main.go
can't load package: package main:
main.go:1:1: expected 'package', found 'EOF'
```

Stackoverflow上找了一下，说的只有重装，重试了几次都不行。

所有下载的是1.7.4的稳定版：http://golangtc.com/static/go/1.7.4/go1.7.4.windows-amd64.msi

下载后点击安装就行了，然后我们设置工作目录跟gopath。

在C盘下面创建workspace目录, 然后接着创建workspace/gopath,workspace/src。

在src下面我们创建main.go

main.go:
```
package main

import "fmt"
import "time"

func main() {
    fmt.Print("hello\n")
    time.Sleep(100 * time.Second)
}
```

然后设置环境变量添加gopath。

```
C:\workspace\src>go env
set GOARCH=amd64
set GOBIN=
set GOEXE=.exe
set GOHOSTARCH=amd64
set GOHOSTOS=windows
set GOOS=windows
set GOPATH=C:\workspace\gopath;C:\workspace\src
set GORACE=
set GOROOT=C:\Go
set GOTOOLDIR=C:\Go\pkg\tool\windows_amd64
set CC=gcc
set GOGCCFLAGS=-m64 -mthreads -fmessage-length=0
set CXX=g++
set CGO_ENABLED=1
```

切换到src目录，执行"go run main.go"

```
C:\workspace\src>go run main.go
hello

C:\workspace\src>go env
```

看到正确的输出，就证明我们的Golang环境配置好了。

写个bat脚本，直接粘贴并命名为init.bat，然后右键以管理员运行即可。

可以看到执行了go run编译并运行了写好的脚本，输出Hello。

还可以看到go env的配置。

```
c:
mkdir workspace
cd workspace
mkdir gopath
mkdir src
mkdir repos
cd repos
mkdir src
cd ..

: wmic ENVIRONMENT where "name='path' and username='<system>'" set VariableValue="%path%;e:\tools"
wmic ENVIRONMENT create name="GOPATH",username="<system>",VariableValue="c:\workspace\gopath;c:\workspace\repos"

cd src
del main.go
echo package main >> main.go
echo import "fmt" >> main.go
echo func main() { >> main.go
echo fmt.Println("Hello") >> main.go
echo } >> main.go
go run main.go

go env

pause
```


## 配置git和github

首先还是下载客户端软件，刚才是一直下错，直到找到正确的下载页面还恍然大悟，找你找的好苦。。

下载地址：https://git-for-windows.github.io/

不是这个：https://git-scm.com/download/win ！！！

下载之后就是安装一下即可，要选择的看着选就行。

然后配置github的状态访问权限：
打开GitBash，执行：
```
Administrator@060 MINGW64 /c/workspace/src
$

Administrator@060 MINGW64 /c/workspace/src
$ ssh-keygen
Generating public/private rsa key pair.
Enter file in which to save the key (/c/Users/Administrator/.ssh/id_rsa):
Created directory '/c/Users/Administrator/.ssh'.
Enter passphrase (empty for no passphrase):
Enter same passphrase again:
Your identification has been saved in /c/Users/Administrator/.ssh/id_rsa.
Your public key has been saved in /c/Users/Administrator/.ssh/id_rsa.pub.
The key fingerprint is:
SHA256:jea8UB76sPq9Exeh1jGPVd+sYnVn+ggT4eGC2Ut0rLU Administrator@060
The key's randomart image is:
+---[RSA 2048]----+
|          ..+..  |
|         =+++o o.|
|        oo+X+.. B|
|        o+=oEo =.|
|       .S o.= o  |
|       B.... + o |
|      + +o    . .|
|       *..       |
|    .oo =o       |
+----[SHA256]-----+

Administrator@060 MINGW64 /c/workspace/src
$

Administrator@060 MINGW64 /c/workspace/src
$



Administrator@060 MINGW64 /c/workspace/src
$

Administrator@060 MINGW64 /c/workspace/src
$

Administrator@060 MINGW64 /c/workspace/src
$ git config --global user.email "newtopstdio@163.com"

Administrator@060 MINGW64 /c/workspace/src
$ git config --global user.name "Yaoguais"

Administrator@060 MINGW64 /c/workspace/src

```
然后把
```
c/Users/Administrator/.ssh/id_rsa.pub
就是
C://Users/Administrator/.ssh/id_rsa.pub
```
的内容粘贴到github的ssh key config里面去，具体就是

点头像》Settings》SSH and GPG keys
然后回到GitBash,执行：

```
Administrator@060 MINGW64 /c/workspace/src
$ ssh -T git@github.com
The authenticity of host 'github.com (192.30.253.113)' can't be established.
RSA key fingerprint is SHA256:nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8.
Are you sure you want to continue connecting (yes/no)? yes
Warning: Permanently added 'github.com,192.30.253.113' (RSA) to the list of known hosts.
Hi Yaoguais! You've successfully authenticated, but GitHub does not provide shell access.

Administrator@060 MINGW64 /c/workspace/src
$ cd ../

Administrator@060 MINGW64 /c/workspace
$ ls
gopath/  src/

Administrator@060 MINGW64 /c/workspace
$ git clone  git@github.com:Yaoguais/yaoguais.github.io.git
Cloning into 'yaoguais.github.io'...
remote: Counting objects: 1811, done.
remote: Compressing objects: 100% (7/7), done.
Receiving objects:  11% (200/1811), 12.01 KiB | 2.00 KiB/s

Connection reset by 192.30.253.113 port 22 KiB | 2.00 KiB/s
fatal: The remote end hung up unexpectedly
fatal: early EOF
fatal: index-pack failed

Administrator@060 MINGW64 /c/workspace
```

慢的要死，又失败了！

## vscode安装

直接Google搜索vscode就可以下载了，至于怎么才能google，
你用百度搜索一下"hosts"，然后就能找到laod.cn这个神奇的网站了，
剩下的你就懂了。

至此，Golang+git+github+vscode，安装完毕。
然后再折腾下怎么在Windows上配置VPN。

## 配置vpn

VPN配置问了我们的架构师，比较简单，之前他给公司使用Windows的同事配置过，但是我这应该是防火墙的问题，老是使用不了。

不要问我为什么关不了防火墙...

网吧的喇叭显示在屏幕上方也是醉了，发现结束进程树后几秒后会被其他进程唤醒，我先找到喇叭.exe位置，
然后结束进程树，最后删除exe，整个世界都清静了好少。

最后就是因为网络的问题，我添加这点内容提交了好几次...
