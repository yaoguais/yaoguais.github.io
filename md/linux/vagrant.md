## VisualBox&Vagrant搭建开发环境

前言: 以前都是使用破解版的VMware,感觉也是挺好用的,但是需要周边的东西的话,可能还要找破解版的,不胜麻烦.干脆换成免费版的VisualBox,听过完全备份出来的文件也要小些,但是实际我测出来并没有小多少.

目录:

1. setup VisualBox
2. set Vagrant
3. setup dev
4. setup db
5. package box
6. setup bat





### setup VisualBox

VisualBox下载地址[https://www.virtualbox.org/wiki/Downloads](https://www.virtualbox.org/wiki/Downloads)

我这里选择的是[Windows版的](http://download.virtualbox.org/virtualbox/5.0.4/VirtualBox-5.0.4-102546-Win.exe)

安装好之后就不用再管它了,Vagrant会自动关联的.(配置网络时要用到一次)

### set Vagrant

Vagrant下载地址[https://www.vagrantup.com/downloads.html](https://www.vagrantup.com/downloads.html)

我选的还是[Windows版的](https://dl.bintray.com/mitchellh/vagrant/vagrant_1.7.4.msi)

它的配置较为繁琐,这里还要下载一个box文件,来安装我们的系统.这里有个[Vagrant的库](http://www.vagrantbox.es/).

我这里下载的是[centos65](http://www.lyricalsoftware.com/downloads/centos65.box
).作为我的初始操作系统.

搭建的过程中会经常使用到[Vagrant的文档](https://docs.vagrantup.com/v2/).
我这里也参考了[另一篇文章](http://segmentfault.com/a/1190000000264347).

Vagrant的box文件我存放到G:\VagrantWorkspace\box下。
虚拟机有两个，分别是dev和db.


### setup dev

	> win+R
	> mkdir G:\VagrantWorkspace\project\dev
	> notepad ./Vagrantfile
	/*
	Vagrant.configure(2) do |config|
	  config.vm.box = "dev"
	  config.vm.define "dev" do |dev|
	  end
	  config.vm.network "public_network", 
	    adapter: 1, 
	    ip: "192.168.1.143", 
	    bridge: "Realtek RTL8188EU Wireless LAN 802.11n USB 2.0 Network Adapter", 
	    auto_config: false
	  config.ssh.host     = "192.168.1.143"
	  config.ssh.username = "vagrant"
	  config.ssh.password = "vagrant"
	  config.vm.provision "shell",
	  	run: "always",
	   	inline: "/bin/sh /etc/init.d/network restart"
	#  config.vm.synced_folder "G:/workspace-143/", "/home/yaoguai/project",
	#    owner: "yaoguai", group: "yaoguai"
	end
	*/

我这里使用的是桥接的方式,ssh使用账号密码登录,但是首次使用桥接的话,因为系统是没有正确配置网络的,所以我们打开VisualBox找到改虚拟机并使用账号密码登录，编辑其网络配置.

	$sudo passwd root
	// 111111
	// 111111
	$su root
	#cd /etc/sysconfig/network-scripts
	#mkdir backup
	#cp ifcfg-eth0 backup/
	#vi ifcfg-eth0
	/*
	DEVICE="eth0"
	BOOTPROTO=static
	HWADDR="08:00:27:07:9E:3D"
	ONBOOT="yes"
	TYPE="Ethernet"
	BROADCAST=192.168.0.255
	IPADDR=192.168.1.143
	NETMASK=255.255.255.0
	NETWORK=192.168.1.0
	*/
	#cd /etc/udev/rules.d/
	#rm -f 70-persistent-net.rules
	#vi /etc/sysconfig/network
	/*
	NETWORKING=yes
	HOSTNAME=vagrant
	GATEWAY=192.168.1.1
	*/
	#vi /etc/resolv.conf
	// nameserver 192.168.1.1
	#service network restart
	#ifconfig
	#ping www.baidu.com
	// 一般能够正常ping通

这里的70-persistent-net.rules很特别,在我使用VMware时,如果把一个备份虚拟机考到另外一台电脑上,不删除这个文件就会出现网络问题,猜测应该是Mac地址造成的.



### setup db

创建db虚拟机的过程与dev的基本一致,也包括创建其配置文件与网络配置.这里只贴出其配置文件.

	Vagrant.configure(2) do |config|
	  config.vm.box = "db"
	  config.vm.define "db" do |db|
	  end
	  config.vm.network "public_network", 
	    adapter: 1, 
	    ip: "192.168.1.144", 
	    bridge: "Realtek RTL8188EU Wireless LAN 802.11n USB 2.0 Network Adapter", 
	    auto_config: false
	  config.ssh.host     = "192.168.1.144"
	  config.ssh.username = "vagrant"
	  config.ssh.password = "vagrant"
	  config.vm.provision "shell",
	  	run: "always",
	   	inline: "/bin/sh /etc/init.d/network restart"
	  config.vm.provider "virtualbox" do |v|
	    v.memory = 1024
	    v.cpus = 1
	  end
	end

### package box

打包后的虚拟机可以直接发送给其他用户,这对开发来说是很方便的.

	> vagrant -h
	> G:
	> cd G:\VagrantWorkspace\project\dev
	> vagrant halt
	> vagrant package --output ../../box/dev.box
	> cd G:\VagrantWorkspace\project\db
	> vagrant halt
	> vagrant package --output ../../box/db.box
	
我们开发的虚拟机就相当于做了一个快照保存到box文件夹下了.

### setup bat

其实单个配置文件是可以配置多个虚拟机同时启动的,但是我还是希望一个虚拟机一个配置文件,这样拷给别人也方便.

这个做了两个简单的批处理脚本,以免每次打开所有虚拟机都要在命令行中敲半天,还可以直接把他们添加到开机自启动中.


	> notepad G:\vagrant-up.bat
	/*
	G:
	cd VagrantWorkspace\project\dev
	vagrant up
	
	cd G:\VagrantWorkspace\project\db
	vagrant up
	*/
	> notepad G:\vagrant-halt.bat
	/*
	G:
	cd VagrantWorkspace\project\dev
	vagrant halt
	cd G:\VagrantWorkspace\project\db
	vagrant halt
	*/
