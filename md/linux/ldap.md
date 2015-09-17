## LDAP域服务器搭建

注: LDAP是轻量目录访问协议(Lightweight Directory Access Protocol)的缩写,当前使用其进行用户管理.

目录:

1. introduction
2. install ldap server
3. install ldap client
4. config ldap ssl



### introduction

ldap可以作为很多服务的用户验证服务器,相当于用户的集中管理.例如每台服务器都可以配置成ldap的客户端,然后在服务端通过web界面创建用户后,客户端不需要创建该用户,也可以通过该用户登录本台机器.

本文参照了几篇文章.如
[openldap 安装](http://www.live-in.org/archives/1731.html),
[openldap集成ssl](http://mosquito.blog.51cto.com/2973374/1098456),
[openldap 调试log](http://blog.chinaunix.net/uid-25800-id-120646.html)

### install ldap server

	#yum install openldap openldap-servers openldap-clients openldap-devel compat-openldap
	#yum install db4 db4-utils
	#yum install httpd php php-bcmath php-gd php-mbstring php-xml php-ldap
	#yum -y install wget
	#wget http://ncu.dl.sourceforge.net/project/phpldapadmin/phpldapadmin-php5/1.2.3/phpldapadmin-1.2.3.zip
	#unzip phpldapadmin-1.2.3.zip 
	#ls
	#cp -R phpldapadmin-1.2.3 /var/www/html/phpldapadmin
	#cd /var/www/html/phpldapadmin/config
	#cp config.php.example config.php
	#yum -y install vim
	#slappasswd
	// 123456
	// 123456
	{SSHA}ZD5rhWbfFXMKM/PEhnMlszhtQF3WLvUz
	#cd /etc/openldap/slapd.d/cn=config/
	#ls
	#vim olcDatabase={2}bdb.ldif
	/*
	#olcSuffix: dc=my-domain,dc=com
	olcSuffix: dc=yaoguai,dc=com
	#olcRootDN: cn=Manager,dc=my-domain,dc=com
	olcRootDN: cn=Manager,dc=yaoguai,dc=com
	olcRootPW: {SSHA}ZD5rhWbfFXMKM/PEhnMlszhtQF3WLvUz
	*/
	#vim olcDatabase={1}monitor.ldif
	/*
	olcAccess: {0}to *  by dn.base="gidNumber=0+uidNumber=0,cn=peercred,cn=exter
	#nal,cn=auth" read  by dn.base="cn=manager,dc=my-domain,dc=com" read  by * n
	 nal,cn=auth" read  by dn.base="cn=manager,dc=yaoguai,dc=com" read  by * n
	*/
	#cp /usr/share/openldap-servers/DB_CONFIG.example /var/lib/ldap/DB_CONFIG
	#chown -R ldap:ldap /var/lib/ldap/
	#slaptest -u
	/*
	55f94176 ldif_read_file: checksum error on "/etc/openldap/slapd.d/cn=config/olcDatabase={1}monitor.ldif"
	55f94176 ldif_read_file: checksum error on "/etc/openldap/slapd.d/cn=config/olcDatabase={2}bdb.ldif"
	#显示有CRC校验错误,是由于我们不是使用命令修改所以没有自动同步校验和,但是不影响大局
	#校正校验和http://injustfiveminutes.com/2014/10/28/how-to-fix-ldif_read_file-checksum-error/
	*/
	#vim /var/www/html/phpldapadmin/config/config.php
	/*
	$servers = new Datastore();
	$servers->newServer('ldap_pla');
	$servers->setValue('server','name','My LDAP Server');
	$servers->setValue('server','host','127.0.0.1');
	$servers->setValue('server','port',389);
	$servers->setValue('server','base',array('dc=yaoguai,dc=com'));
	$servers->setValue('login','auth_type','session');
	*/
	#service slapd start
	#chown -R apache:apache /var/www/html/phpldapadmin
	#service httpd start
	/*
	#http://tgrove.com/2007/12/02/httpd-apr_sockaddr_info_get-failed-for-hostname/
	*/
	#hostname
	ldap
	#vim /etc/hosts
	/*
	#127.0.0.1 localhost localhost.localdomain localhost4 localhost4.localdomain4
	#::1       localhost localhost.localdomain localhost6 localhost6.localdomain6
	127.0.0.1 ldap   localhost localhost.localdomain localhost4 localhost4.localdomain4
	::1       ldap  localhost localhost.localdomain localhost6 localhost6.localdomain6
	*/
	#service httpd restart
	#chkconfig --levels 345 httpd on
	#chkconfig --levels 345 slapd on
	/*
	登录进去后,可以看到dc=yaoguai,dc=com前面打了一个问号,并不能添加用户.
	下面添加根节点
	*/
	#cd /etc/openldap
	#vim base.ldif
	/*
	dn: dc=yaoguai,dc=com
	o: ldap
	objectclass: dcObject
	objectclass: organization
	*/
	#ldapadd -f base.ldif -x -D cn=manager,dc=yaoguai,dc=com -W
	// 123456

刷新或者退出重进后,前面的问号消失了.
点击一下,选择Create a child entry创建一个实体
选择Generic: Posix Group创建一个组
Group填写developer,GID Number默认是500,最后提交.
"dc=yaoguai,dc=com (1+)"出现cn=developer子栏目.

点击cn=developer选择Create a child entry,然后选择
然后出现表单，其中关键的是User ID,即登录的用户名.
我这里填写的是yaoguai,密码123456.
至此,服务器(192.168.1.141)端搭建完毕.

下面搭建ldap的客户端(192.168.1.140,配置网络的步骤省略).





### install ldap client


	#yum install openldap-clients pam_ldap nss-pam-ldapd
	#vim /etc/openldap/ldap.conf
	/*
	#BASE   dc=example,dc=com
	#URI    ldap://ldap.example.com ldap://ldap-master.example.com:666
	BASE    dc=yaoguai,dc=com
	URI     ldap://192.168.1.141
	*/
	#ldapsearch -x -b "dc=yaoguai,dc=com"
	/*
	dn: dc=yaoguai,dc=com
	o: ldap
	objectClass: dcObject
	objectClass: organization
	dc: yaoguai
	
	# developer, yaoguai.com
	dn: cn=developer,dc=yaoguai,dc=com
	cn: developer
	gidNumber: 500
	objectClass: posixGroup
	objectClass: top
	
	# yao guai, developer, yaoguai.com
	dn: cn=yao guai,cn=developer,dc=yaoguai,dc=com
	givenName: yao
	sn: guai
	cn: yao guai
	uid: yaoguai
	userPassword:: e01ENX00UXJjT1VtNldhdStWdUJYOGcrSVBnPT0=
	uidNumber: 1000
	gidNumber: 500
	homeDirectory: /home/users/yaoguai
	loginShell: /bin/sh
	objectClass: inetOrgPerson
	objectClass: posixAccount
	objectClass: top
	
	# search result
	search: 2
	result: 0 Success
	
	# numResponses: 4
	# numEntries: 3
	*/
	#vi /etc/pam_ldap.conf
	/*
	#host 127.0.0.1
	host 192.168.1.141
	#base dc=example,dc=com
	base dc=yaoguai,dc=com
	*/
	#authconfig-tui
	User Information选择：
	Use LDAP
	Authentication选择：
	Use Shadow Passwords
	Use LDAP Authentication
	Local authorization is sufficient
	/*
	PS：交互界面修改了/etc/pam_ldap.conf、/etc/pam.d/system-auth、/etc/nsswitch.conf这三个文件。
	*/
	#vi /etc/pam.d/system-auth
	/*
	session required pam_mkhomedir.so skel=/etc/skel umask=0077
	*/


然后使用yaoguai 123456登录client端,提示登录成功,home在/home/users/yaoguai
最后我们再给ldap加上TLS.





### config ldap ssl

	server端
	#yum -y install openssl openssl-devel
	#cd /etc/openldap/certs/
	#openssl genrsa -out ldap.key 1024
	#openssl req -new -key ldap.key -out ldap.csr
	#openssl x509 -req -days 1095 -in ldap.csr -signkey ldap.key -out ldap.crt
	#chmod 700 certs/
	#chown ldap.ldap certs/ -R
	#vim /etc/openldap/ldap.conf
	/*
	TLS_CACERTDIR   /etc/openldap/certs
	TLS_REQCERT allow
	*/
	#vim /etc/openldap/slapd.conf
	TLSCertificateFile /etc/openldap/certs/ldap.crt
	TLSCertificateKeyFile /etc/openldap/certs/ldap.key
	#service slapd stop
	#slapd -h "ldaps:///" -d -1 -f /etc/openldap/slapd.conf -F /etc/openldap/slapd.d/ -u ldap
	#Ctrl+C
	#vi /etc/sysconfig/ldap


	client端
	#yum -y install openssl openssl-devel
	#vim /etc/openldap/ldap.conf
	/*
	TLS_REQCERT allow
	TLS_CACERTDIR /etc/openldap/cacerts
	URI ldaps://192.168.1.141
	BASE dc=yaoguai,dc=com
	*/
	#ldapwhoami -v -x -Z
	/*
	ldap_initialize( <DEFAULT> )
	ldap_start_tls: Operations error (1)
	        additional info: TLS already started
	anonymous
	Result: Success (0)
	*/
	#ldapwhoami -D "cn=yao guai,cn=developer,dc=yaoguai,dc=com" -W -H ldaps://192.168.1.141 -v

至此LDAP服务器安装完成.