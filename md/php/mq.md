## PHP消息队列的一些实现 ##

消息队列（Message Queue）：把消息按照产生的次序加入队列，而由另外的处理程序/模块将其从队列中取出，并加以处理；从而形成了一个基本的消息队列。使用消息队列可以很好地将任务以异步的方式进行处理，或者进行数据传送和存储等。例如，当你频繁地向数据库中插入数据、频繁地向搜索引擎提交数据，就可采取消息队列来异步插入。另外，还可以将较慢/较复杂的处理逻辑、有并发数量限制的处理逻辑，通过消息队列放在后台处理。

应用场景：短信服务、电子邮件服务、图片处理服务、好友动态推送服务等。总结下来就是，一些耗时的操作，但是并不要求立即获取执行的结果。
[(参考文章)](http://www.360doc.com/content/15/0324/11/203871_457622006.shtml)


目录：

1. 应用场景-短信服务
2. 消息队列的实现-redis
3. 消息队列的实现-mongodb
4. 消息队列的实现-memcached
5. redis-mongodb-memcached性能的对比
6. 消息队列的实现amqp-rabbitmq
7. 消息队列的总结


### 应用场景-短信服务 ###

一般发送短信，都是调用服务商的接口，大多都是基于HTTP协议的，body的封装可能是js、xml等。在php中，使用socket，大概有`file_get_contents` 、curl 、 fsockopen 、stream系等。而这个过程是比较耗时的，如果存在大量这样的操作，必然会降低服务器的响应时间。

所以我们可以使用消息队列来解决这个问题。




### 消息队列的实现-redis ###

[整个项目的源代码](https://github.com/Yaoguais/message-queue)

利用redis实现消息队列，是基于redis本身支持的列表数据类型，其本身就是队列的一种的实现，支持入队rPush、出队lPop。

安装redis、php-redis的步骤省略，下面几个实现也省略了，都比较简单。

其关键的代码如下:

	class RedisQueue implements IQueue{
		
		private $_conn = null;
		private $_connInfo = null;
		
		public function __construct($connInfo){
			if(empty($connInfo['key'])){
				$connInfo['key'] = 'rmq';
			}
			$this->_connInfo = $connInfo;
		}
		
		public function open(){
			if(empty($this->_connInfo)){
				return false;
			}
			if($this->_connInfo['newlink']){
				$this->close();
			}
			if($this->_conn){
				return true;
			}
			$this->_conn = new Redis();
			if(empty($this->_conn)){
				return false;
			}
			if($this->_connInfo['persistent']){
				if(!$this->_conn->pconnect($this->_connInfo['host'],$this->_connInfo['port'])){
					return false;
				}
			}else{
				if(!$this->_conn->connect($this->_connInfo['host'],$this->_connInfo['port'])){
					return false;
				}
			}
			return true;
		}
		
		public function push($message){
			if(!$this->open()){
				return false;
			}
			return $this->_conn->rPush($this->_connInfo['key'],$message);
		}
		
		public function pop(){
			if(!$this->open()){
				return false;
			}
			return $this->_conn->lPop($this->_connInfo['key']);
		}
	}

经测试，redis的性能体现得不错。性能数据请看下面。













### 消息队列的实现-mongodb ###

mongodb使用的是timestamp+index实现的消息队列。还有一种使用findAndModify实现队列,但是出队并不删除元素,这个随着时间的推移,内存必爆，这里就不推荐了，网上有人做的这种实现。timestamp各种关系性数据库都能实现,这里也不实现mysql等数据库的了.

其关键的代码如下:

	class MongodbQueue implements IQueue{
		
		private $_conn;
		private $_connInfo;
		
		/**
		 * 返回当前的毫秒数
		 * @return number
		 */
		private function _getTimeStamp(){
			return intval(microtime(true)*1000);
		}
		
		public function __construct($connInfo){
			if(empty($connInfo['db_name'])){
				$connInfo['db_name'] = 'mmq';
			}
			if(empty($connInfo['collection_name'])){
				$connInfo['collection_name'] = 'cmmq';
			}
			$this->_connInfo = $connInfo;
		}
		
		public function open(){
			if($this->_conn){
				return true;
			}
			if(!class_exists('MongoClient')){
				return false;
			}
			$this->_conn = new MongoClient($this->_connInfo['server'],$this->_connInfo['server_options']);
			if(empty($this->_conn)){
				return false;
			}
			//初始化数据库，集合，索引等
			$collection = $this->_conn->{$this->_connInfo['db_name']}->{$this->_connInfo['collection_name']};
			$collection->createIndex(array('timestamp'=>1));
			return true;
		}
		
		public function push($message){
			if(!$this->open()){
				return false;
			}
			$arr = array(
					'timestamp' => $this->_getTimeStamp(),
					'message' => $message
			);
			$collection = $this->_conn->{$this->_connInfo['db_name']}->{$this->_connInfo['collection_name']};		
			$ret = $collection->insert($arr);
			return isset($ret['ok']) ? ($ret['ok'] ? true : false) : ($ret ? true : false);
		}
		
		public function pop(){
			if(!$this->open()){
				return false;
			}
			$collection = $this->_conn->{$this->_connInfo['db_name']}->{$this->_connInfo['collection_name']};
			$cursor = $collection->find()->sort(array('timestamp'=>1))->limit(1);
			$ret = $cursor->getNext();
			if(empty($ret)){
				return false;
			}
			if($collection->remove(array('_id'=>$ret['_id']),array("justOne"=>true))){
				return $ret;
			}else{
				return false;
			}
		}
	}

关于mongodb的使用这里也不多说了，可以关注一下[这篇文章](http://blog.csdn.net/DrifterJ/article/category/1191327/2)。

这里额外提一下遇到的坑，我在安装的时候，居然安装错了mongodb。
php 扩展mongodb与mongo的区别:
mongodb:[帮助手册](http://php.net/manual/zh/book.mongodb.php)
mongo:[帮助手册](http://php.net/manual/zh/book.mongo.php)
说简单点就是提供的接口不同。

mongodb(version 0.6.3)安装中的坑:

	apt-get install openssl
	apt-get install libssl-dev
	apt-get install libssl0.9.8

但是扩展在make的时候报X509未定义,经过分析得知是头文件未包含，但存在。在mongodb下有个php-ssl.h中`HAVE_OPENSSL_EXT`宏起着开关作用，注释即可。












### 消息队列的实现-memcached ###

memcached版的消息队列是参照[这篇文章-memcache消息队列](http://www.jb51.net/article/50286.htm)
实现的。该实现是用两个指针,分别指向队首与队尾,然后对队列进行操作。
这不具备事务特性,在多进程下会导致数据混乱的情况。

- 不具备事务特性：设想移动指针成功，但出队失败。
- 不具备原子性：设想只有一个元素，两个进程同时读取指针，发现合法，同时移动指针。但是后出队的会出现没有元素出队而失败的情况。

但是我们还是实现一下,看看其性能怎么样。

其关键的代码如下:

	class MemcachedQueue implements IQueue{
		private $_conn = null;
		private $_connInfo = null;
		private $_key = 'mmq';
		
		public function __construct($connInfo){
			if($connInfo['key']){
				$this->_key = $connInfo['key'];
			}
			$this->_connInfo = $connInfo;
		}
		
		public function open(){
			if(empty($this->_connInfo)){
				return false;
			}
			if($this->_conn){
				return true;
			}
			if($this->_connInfo['persistent_id ']){
				$this->_conn = new Memcached($this->_connInfo['persistent_id ']);
			}else{
				$this->_conn = new Memcached();
			}
			if(empty($this->_conn)){
				return false;
			}
			if($this->_connInfo['servers']){
				$this->_conn->addServers($this->_connInfo['servers']);
			}else{
				$this->_conn->addServer($this->_connInfo['host'],$this->_connInfo['port'],$this->_connInfo['weight'] ? : 0);
			}
			return true;
		}
		
		private function _setCounter( $key, $offset, $time=0 ){
			if(!$this->open()){
				return false;
			}
			$val = $this->_conn->get($key);
			if( !is_numeric($val) || $val < 0 ){
				$ret = $this->_conn->set( $key, 0, $time );
				if( !$ret ) return false;
				$val = 0;
			}
			$offset = intval( $offset );
			if( $offset > 0 ){
				return $this->_conn->increment( $key, $offset );
			}elseif( $offset < 0 ){
				return $this->_conn->decrement( $key, -$offset );
			}
			return $val;
		}
		
		public function push($message){
			if(!$this->open()){
				return false;
			}
			$pushKey = $this->_key.'w';
			if(false === ($pushIndex = $this->_setCounter($pushKey, 1))){
				return false;
			}
			$valueKey = $this->_key.$pushIndex;
			return $this->_conn->set($valueKey,$message);
		}
		
		public function pop(){
			if(!$this->open()){
				return false;
			}	
			$pushKey = $this->_key.'w';
			if(false === ($pushIndex = $this->_setCounter($pushKey, 0))){
				return false;
			}
			$popKey = $this->_key.'r';
			if(false === ($popIndex = $this->_setCounter($popKey, 0))){
				return false;
			}
			++$popIndex;
			if($pushIndex < $popIndex){
				return false;
			}
			$valueKey = $this->_key.$popIndex;
			if(false === ($this->_setCounter($popKey, 1))){
				return false;
			}
			$ret = $this->_conn->get($valueKey);
			if(empty($ret)){
				return false;
			}
			$this->_conn->delete($valueKey);
			return $ret;
		}
	}

性能测试发现数据表现还不错！







### redis-mongodb-memcached性能的对比 ###

最后我们比较一下三种实现的性能，最后写了一个benchmark的脚本：

	error_reporting(~E_WARNING & ~E_NOTICE & E_ALL);
	
	require 'IQueue.php';
	require 'MemcachedQueue.php';
	require 'MongodbQueue.php';
	require 'RedisQueue.php';
	require 'MessageQueueProxy.php';
	
	$config = require 'config.php';
	$class = $config['driver'];
	$mq = new $class($config['driverInfo']);
	$mobileMessageObj = new MessageQueueProxy($mq);
	
	$time = 100;
	$num = 10000;
	
	$success = 0;
	
	for($j=0;$j<$time;++$j){
		$start = microtime(true);
		
		for($i=0;$i<$num;++$i){
			$mobile = '1355'.rand(1000000,9999999);
			$content = 'this is your phone number: '.$mobile.'.';
			$message = array(
					'mobile' => $mobile,
					'content' => $content
			);
			if(!$mobileMessageObj->push(serialize($message))){
				echo "on index:",($j*$num+$i+1)," push error !";
				goto pushout;
			}
			++$success;
		}
		$result[] = microtime(true) - $start;
		echo intval(($j+1)/$time*100),"% ";
	}
	
	pushout:
	
	$request = $num * $time;
	echo "\n";
	echo "class: $class\n";
	echo "push\n";
	echo "times: $time num: $num\n";
	echo "request: ",$request,"\n";
	echo "faild: ",$request-$success,"\n";
	echo "max: ",max($result)," s/{$num}times\n";
	echo "min: ",min($result)," s/{$num}times\n";
	echo "takes: ",$sum = array_sum($result)," s\n";
	echo "average: ",$sum/count($result)," s/{$num}times\n";
	echo "rqs: ",intval($time*$num/$sum),"\n";
	
	if($success<$request){
		echo "push exit\n";
		exit();
	}
	
	$result = array();
	$success = 0;
	for($j=0;$j<$time;++$j){
		$start = microtime(true);
	
		for($i=0;$i<$num;++$i){
			if($mobileMessageObj->pop()===false){
				echo "on index:",($j*$num+$i+1)," pop error !";
				goto popout;
			}
			++$success;
		}
		$result[] = microtime(true) - $start;
		echo intval(($j+1)/$time*100),"% ";
	}
	
	popout:
	echo "\n";
	
	echo "pop\n";
	echo "times: $time num: $num\n";
	echo "request: ",$request,"\n";
	echo "faild: ",$request-$success,"\n";
	echo "max: ",max($result)," s/{$num}times\n";
	echo "min: ",min($result)," s/{$num}times\n";
	echo "takes: ",$sum = array_sum($result)," s\n";
	echo "average: ",$sum/count($result)," s/{$num}times\n";
	echo "rqs: ",intval($time*$num/$sum),"\n";


其中各项软件的版本如下(都是当前最新版本的):

	php: 5.4.40
	Linux: 3.13.0-34-generic(buildd@allspice) (gcc version 4.8.2 (Ubuntu 4.8.2-19ubuntu1) )
	memory: 4GB
	cpu: Intel(R)_Core(TM)_i5@3.00GHz*4
	redis: 3.0.1
	php-redis: 2.2.7
	mongodb: mongodb-linux-x86_64-ubuntu1404-3.0.2
	php-mongo: 1.6.7
	memcached: 1.4.24
	php-memcached: 2.2.0

redis的数据如下：

	class: RedisQueue
	push
	times: 100 num: 10000
	request: 1000000
	faild: 0
	max: 0.37430000305176 s/10000times
	min: 0.26855707168579 s/10000times
	takes: 32.56348824501 s
	average: 0.3256348824501 s/10000times
	rqs: 30709
	pop
	times: 100 num: 10000
	request: 1000000
	faild: 0
	max: 0.28984785079956 s/10000times
	min: 0.21943783760071 s/10000times
	takes: 26.595669269562 s
	average: 0.26595669269562 s/10000times
	rqs: 37600

mongodb+index的数据如下：

	class: MongodbQueue
	push
	times: 100 num: 10000
	request: 1000000
	faild: 0
	max: 1.8860659599304 s/10000times
	min: 1.038162946701 s/10000times
	takes:115.00487303734 s
	average: 1.1500487303734 s/10000times
	rqs: 8695
	pop
	times: 100 num: 10000
	request: 1000000
	faild: 0
	max: 2.2940940856934 s/10000times
	min: 1.8466329574585 s/10000times
	takes: 197.70558190346 s
	average: 1.9770558190346 s/10000times
	rqs: 5058

mongodb+noindex的数据如下:

	class: MongodbQueue
	push
	times: 100 num: 10000
	request: 1000000
	faild: 0
	max: 1.4391729831696 s/10000times
	min: 1.0708310604095 s/10000times
	takes: 120.37140989304 s
	average: 1.2037140989304 s/10000times
	rqs: 8307
	//下面根本跑不动了

memcached的数据如下:

	class: MemcachedQueue
	push
	times: 100 num: 10000
	request: 1000000
	faild: 0
	max: 0.83561706542969 s/10000times
	min: 0.67476201057434 s/10000times
	takes: 76.049747467041 s
	average: 0.76049747467041 s/10000times
	rqs: 13149
	pop
	times: 100 num: 10000
	request: 1000000
	faild: 0
	max: 1.3662950992584 s/10000times
	min: 1.2345328330994 s/10000times
	takes: 129.71623921394 s
	average: 1.2971623921394 s/10000times
	rqs: 7709

可以看出：

- 可以看出redis在push上是mongodb的3.53倍,在pop上是mongodb的7.43倍.
- mongodb没有索引,pop根本跑不动了。过了10多秒，我进数据库一看，才删除了99条.
- 可以看出redis的push是memcached的2.3倍,redis的pop是memcached的4.5倍.







###消息队列的实现amqp-rabbitmq###

先吐槽一下rabbitmq的安装，最开始我是在Ubuntu上面安装的，首先是源码编译，不行。然后apt-get，也不行！最后dpkg安装，还是不行！！
没办法，Ubuntu实在搞不动了。

我就换了centos，还是源码编译，php-amqp老是过不了。然后pecl安装，还是不行。

最后发现，这两样都会用到librabbitmq这个库，而报错是没有`amqp_tcp_socket.h`这个头文件。

正好我源码编译过`rabbitmq-c`源代码，发现刚好会提供这个文件，但是API对不上啊，这个库是0.6.0的，地址是https://github.com/alanxz/rabbitmq-c/releases/tag/v0.6.0，机智的我突然反应过来，很可能是版本不对。但是没有以前版本的链接啊，机智的我又突然反应过来，就是把v0.6.0改成v0.4.0，妈蛋，居然有下载页面了。

然后我小心翼翼的下载下来，删除原来的文件，重新一编译,php-amqp居然通过了。立马修改php.ini,再编写测试代码，发现队列成功入队出队了！！而这时，已经一点了，距我刚开始安装软件已经四个多小时了，一上午就装软件装完了。然后下午把RabbitQueue.php写完，然后做Benchmark，又发现两个内存相关的参数老是调不对，每次跑到70万就要停半天才继续。应该是内存数据交换到硬盘造成的。最后的benchmark就降低到50万了。但是效果还是不错。

下面是测试的数据：

	class: RabbitQueue
	push
	times: 100 num: 5000
	request: 500000
	faild: 0
	max: 0.56668591499329 s/5000times
	min: 0.019957065582275 s/5000times
	takes: 17.697237014771 s
	average: 0.17697237014771 s/5000times
	rqs: 28252
	pop
	times: 100 num: 5000
	request: 500000
	faild: 0
	max: 1.709969997406 s/5000times
	min: 0.56408095359802 s/5000times
	takes: 85.071734666824 s
	average: 0.85071734666824 s/5000times
	rqs: 5877

	VMware 10
	centos 6.6
	memory 2GB
	cpu i5*4

翻阅了N多的rabbitmq的资料，对其机制还是有基本的了解了。最后总结一下，rabbitmq可能在性能上不是很优越，但是它是一套完善的解决方案。个人觉得比redis更适合生产环境。还有redis没有通知机制，而rabbitmq是基于长连接的，是有推送的。这个就比redis的轮询高级很多了。











### 消息队列的总结 ###



1. 性能redis>memcached>mongodb
2. rabbitmq是成熟的解决方案
3. mongodb与amqp扩展的安装比较坑

