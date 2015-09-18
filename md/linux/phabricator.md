## phabricator 项目管理平台

前言:以前都用的gerrit,感觉也是挺好用的,结合jenkins可以自动verify,也可以通过jenkins进行自动部署.但是phabricator不一样,它是全套自带.在好用完善的同时,界面风格与用户体验方便也是足足甩了gerrit一条街.(其实感觉SVN对小团队要好一点,用git的developer老是几天才提交一次代码...)

目录:

1. setup base
2. install phabricator
3. create project & repo
4. setup code review
5. extra explain
6. auto lint
7. auto unit test
8. auto deploy


### setup base

这里主要参考phabricator的官方文档.例如
[installation_guide](https://secure.phabricator.com/book/phabricator/article/installation_guide/),
[install_rhel-derivs](https://secure.phabricator.com/diffusion/P/browse/master/scripts/install/install_rhel-derivs.sh),
[configuration_guide](https://secure.phabricator.com/book/phabricator/article/configuration_guide/)

上次我们搭建了两台服务器,143开发服务器,配置了git,php,nginx.144数据库服务器,配置了mysql等.所以我就不重头搭建了,我安装的软件基本都是较新的,如果使用系统自带的yum源的话,可以直接`yum install httpd git php php-cli php-mysql php-process php-devel php-gd php-pecl-apc php-pecl-json php-mbstring mysql-server`完事.








### install phabricator

我这里参照了那个官方给出的shell脚本,将没有完善的东西继续安装完毕.

	#mkdir /phabricator
	#cd phabricator
	#git clone https://github.com/phacility/libphutil.git
	#git clone https://github.com/phacility/arcanist.git
	#git clone https://github.com/phacility/phabricator.git
	#yum install php56w-cli php56w-mysql php56w-pdo php56w-process php56w-devel php56w-gd php56w-opcache php56w-mbstring
	#php -m


原始的安装是这样的yum install httpd git php php-cli php-mysql php-process php-devel php-gd php-pecl-apc php-pecl-json php-mbstring mysql-server
需要哪些扩展一定要添加上去,apc我们用opcache代替.


	// 配置数据库
	#cd /phabricator/phabricator
	#./bin/storage upgrade
	#./bin/config set mysql.host 192.168.1.144
	#./bin/config set mysql.user root
	#./bin/config set mysql.pass 123456



这里就直接用root密码了,phabricator会创建1mol多的数据库,没错,是数据库.

	#./bin/storage upgrade



用不了多久,数据库就安装完成了.
SELECT count(*) FROM `SCHEMATA` WHERE `SCHEMA_NAME` LIKE 'phabricator%';
嗯,新建了57个数据库.


		#cd /etc/nginx/conf.d
		#vim
		/*
		server {
		  
		  listen          8090;
		  charset         utf-8;
		  server_name 192.168.1.143;
		  root        /phabricator/phabricator/webroot;
		
		  location / {
		    index index.php;
		    rewrite ^/(.*)$ /index.php?__path__=/$1 last;
		  }
		
		  location = /favicon.ico {
		    try_files $uri =204;
		  }
		
		  location /index.php {
		    fastcgi_pass    localhost:9000;
		    fastcgi_index   index.php;
		
		    #required if PHP was built with --enable-force-cgi-redirect
		    fastcgi_param  REDIRECT_STATUS    200;
		
		    #variables to make the $_SERVER populate in PHP
		    fastcgi_param  SCRIPT_FILENAME    $document_root$fastcgi_script_name;
		    fastcgi_param  QUERY_STRING       $query_string;
		    fastcgi_param  REQUEST_METHOD     $request_method;
		    fastcgi_param  CONTENT_TYPE       $content_type;
		    fastcgi_param  CONTENT_LENGTH     $content_length;
		
		    fastcgi_param  SCRIPT_NAME        $fastcgi_script_name;
		
		    fastcgi_param  GATEWAY_INTERFACE  CGI/1.1;
		    fastcgi_param  SERVER_SOFTWARE    nginx/$nginx_version;
		
		    fastcgi_param  REMOTE_ADDR        $remote_addr;
		  }
		}
		*/
		#service nginx reload
		#service php-fpm restart


打开浏览器访问192.169.1.143:8090,注册管理员账号

	yongliu
	yongliu
	1234!@#$
	1234!@#$
	yongliu@tjut.cc


设置一下时区与系统时间

	#yum install -y ntpdate
	#mv /etc/localtime /etc/localtime.bak
	#cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
	#ntpdate us.pool.ntp.org
	#date


根据web平台的提示,修复其他issue,这里只记录了部分,因为有点多.

	#cd /phabricator/phabricator/
	#./bin/config set phabricator.base-uri 'http://192.168.1.143:8090/'
	#mkdir -p '/var/repo/'
	
	#./bin/phd restart


启用phd后台进程,我们这里使用root进行启动

	#cd /phabricator/phabricator/
	#./bin/phd help
	#./bin/phd start


配置ssh

	#useradd -m -s "/bin/bash" sshpha
	#whereis git-upload-pack
	#vim /etc/sudoers
	/*
	sshpha ALL=(root) SETENV: NOPASSWD: /usr/bin/git-upload-pack, /usr/bin/git-receive-pack, /usr/bin/hg, /usr/bin/svnserve
	*/
	#vim /etc/shadow
	/*
	#sshpha:!!:16696:0:99999:7:::
	sshpha:NP:16696:0:99999:7:::
	*/
	#./bin/config set phd.user root
	#./bin/config set diffusion.ssh-user sshpha
	#vim /etc/ssh/sshd_config
	/*
	#Port 22
	Port 222
	*/
	#cp phabricator/resources/sshd/phabricator-ssh-hook.sh ssh/
	#cp phabricator/resources/sshd/sshd_config.phabricator.example ssh/sshd_config
	#vim ssh/sshd_config
	/*
	AuthorizedKeysCommand /phabricator/ssh/phabricator-ssh-hook.sh
	AuthorizedKeysCommandUser sshpha
	AllowUsers sshpha
	
	# You may need to tweak these options, but mostly they just turn off everything
	# dangerous.
	
	Port 22
	Protocol 2
	PermitRootLogin no
	AllowAgentForwarding no
	AllowTcpForwarding no
	PrintMotd no
	PrintLastLog no
	PasswordAuthentication yes
	RSAAuthentication yes
	PubkeyAuthentication yes
	AuthorizedKeysFile %h/.ssh/authorized_keys
	
	PidFile /var/run/sshd-phabricator.pid
	*/
	#vim ssh/phabricator-ssh-hook.sh
	/*
	#!/bin/sh
	
	# NOTE: Replace this with the username that you expect users to connect with.
	VCSUSER="sshpha"
	
	# NOTE: Replace this with the path to your Phabricator directory.
	ROOT="/phabricator/phabricator"
	
	if [ "$1" != "$VCSUSER" ];
	then
	  exit 1
	fi
	
	exec "$ROOT/bin/ssh-auth" $@
	*/

	#service sshd restart
	#/usr/sbin/sshd -f /phabricator/ssh/sshd_config
	/*error happend when openssh version is 5.3 not 6.2*/


这里系统自带的openssh-server是5.3的,而phabricator需要的某些sshd配置项只有6.2才用.这里就走上了漫长的openssh升级之路.主要是参照了这篇文章[upgrade openssh for centos6.5](https://www.ptudor.net/linux/openssh/).

升级完毕,我们先杀死自己配置sshd然后重启.

	#ps -ef | grep sshd
	#kill 15 xxxpid
	#/usr/sbin/sshd -f /phabricator/ssh/sshd_config

刚才配置的sshd是需要通过publicKey登录的，所以我们切换成sshpha用户并生成其ssh-key,这里就不写相关的命令了.


然后通过脚本创建web平台登录的用户sshpha.

	#./phabricator/bin/accountadmin
	/*
	创建sshpha用户
	sshpha
	1234!@#$
	   OLD VALUE                                   NEW VALUE                     
	    Username                                    sshpha                        
	   Real Name                                    sshpha                        
	       Email                                    sshpha@163.com                
	    Password                                    Updated                       
	         Bot   N                                N                             
	       Admin   N                                N 
	*/

创建好用户后,登录web平台,将刚才生成的ssh-key粘贴到ssh public key配置中,按钮是设置那个.

最后通过ssh测试是否配置成功.

	#ssh -T sshpha@192.168.1.143
	/*
	phabricator-ssh-exec: Welcome to Phabricator.
	
	You are logged in as sshpha.
	
	You haven't specified a command to run. This means you're requesting an interactive shell, but Phabricator does not provide an interactive shell over SSH.
	
	Usually, you should run a command like `git clone` or `hg push` rather than connecting directly with SSH.
	
	Supported commands are: conduit, git-receive-pack, git-upload-pack, hg, svnserve.
	*/

显示ssh配置成功.下面开始配置项目,并进行code review.


### create project & repo

我们使用管理员账号yongliu登录web平台.

创建项目比较简单,点击左侧的Project即可显示创建按钮.一步一步跟着提示创建就可以了.

然后是创建repo,点击左侧的Diffusion,即可显示创建按钮.这里我们添加sshpha的push权限.

创建完毕,我们同步项目.

	$cd /home/sshpha
	$git clone ssh://sshpha@192.168.1.143/diffusion/TEST/server-test.git
	$cd server-test
	$vim aa.txt
	/*
	aaaaaaaaaaaaa
	bbbbbbbbbbbbb
	*/
	$git add -A
	$git config --global user.email "sshpha@163.com"
	$git config --global user.name "sshpha"
	$git commit -m "for test"
	$git branch
	$git push origin master

我们到web平台查看一下,就会发现该repo的代码是更新了的.这里就有一个问题,没有code review!怎么行!所以最后我们将code review加上.

我们先取消sshpha用户的push权限,在Diffusion编辑repo就可以了.
然后我们push代码的话,就会发现没有push的权限了.


### setup code review

这里的code review跟github还不太一样,github是fork别人的项目到自己的主页,我们这里的开发可不能随意创建工程或者说fork工程的.所以这里用的是Differential应用完成的.

首先使用diff生成diff文件.

	$vim aa.txt
	/*
	ddddddddd
	ggergeragea
	gaergeragearg
	ge34yr834
	*/
	$git diff > ../diff.out

sshpha用户登录web平台,点击Differential创建一个diff,上传diff文件.然后生成Revisions,并指定yongliu为reviewer.上传完成后切换成yongliu登录.查看该Revisions,然后确认该Revisions后,该次sshpha的修改就自动合并带仓库中去了.

### extra explain

可能有很多的概念性的东西理解的不是很清楚,我们慢慢梳理.

下面接着的是使用phabricator的Lint(代码质量分析),Unit test(单元测试)和Auto deploy(代码自动部署).
