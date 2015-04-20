<?php
error_reporting(0);
if(defined('SAE_MYSQL_DB')){
	$config = array(
		'DB_HOST' => SAE_MYSQL_HOST_M.','.SAE_MYSQL_HOST_S, // 服务器地址
		'DB_NAME' => SAE_MYSQL_DB, // 数据库名
		'DB_USER' => SAE_MYSQL_USER, // 用户名
		'DB_PWD' => SAE_MYSQL_PASS, // 密码
		'DB_PORT' => SAE_MYSQL_PORT, // 端口
		'DB_PREFIX' => 'pre_',
		'DB_CHARSET' => 'utf8'
	);
}else{
	$config = array(
		'DB_HOST' => 'localhost',
		'DB_PORT' => 3306,
		'DB_NAME' => 'test',
		'DB_USER' => 'root',
		'DB_PWD' => '',
		'DB_PREFIX' => 'pre_',
		'DB_CHARSET' => 'utf8'
	);
}

//提交一次自己的分数
if($_GET['ac']=='game' || $_GET['ac']=='fight'){
	if(!empty($_POST['weixin']) || !empty($_POST['username']) || !empty($_POST['phone'])){
		$db = new db($config);
		$begin = strtotime(date('Y-m-d',time()).' 00:00:00');
		$end = strtotime(date('Y-m-d',time()+86400).' 00:00:00');
		$t = $db->table('record');
		$number = $db->result("SELECT count(*) FROM $t where weixin=? AND dateline>=$begin AND dateline<=$end",array($_POST['weixin']));
		//游戏3次 挑战1次
		$numberMax = $_GET['ac']=='game' ? 3 : 4;
		if($number>=$numberMax){
			if($_GET['ac']=='game')
				echo '1';
			else
				echo '2';
			exit;
		}
		$ret = $db->insert('record',array(
			'weixin' => $_POST['weixin'],
			'username' => $_POST['username'],
			'phone' => $_POST['phone'],
			'score' => intval($_POST['score']),
			'dateline' => time()
		));
		if($ret)
			echo '0';
		else
			echo '3';
	}else{
		echo '4';
	}
//查看排行榜的数据
}elseif($_GET['ac']=='rank'){
	$begin = strtotime(date('Y-m-d',time()).' 00:00:00');
	$end = strtotime(date('Y-m-d',time()+86400).' 00:00:00');
	$db = new db($config);
	$t = $db->table('record');
	$list = $db->select("SELECT distinct weixin FROM $t where dateline>=$begin AND dateline<=$end ORDER BY score DESC LIMIT 10");
	$data = array();
	foreach($list as $row){
		$data[] = $db->find("SELECT weixin,score FROM $t where weixin=? AND dateline>=$begin AND dateline<=$end ORDER BY score DESC LIMIT 1",array($row['weixin']));
	}
	//header('Content-Type: text/html;charset=utf-8');echo '<pre>';print_r($data);exit;
	echo json_encode($data);
	//不错任何操作
}elseif($_GET['ac']=='count'){
	if(empty($_POST['weixin'])){
		echo '1';exit;
	}
	$db = new db($config);
	$begin = strtotime(date('Y-m-d',time()).' 00:00:00');
	$end = strtotime(date('Y-m-d',time()+86400).' 00:00:00');
	$t = $db->table('record');
	$number = $db->result("SELECT count(*) FROM $t where weixin=? AND dateline>=$begin AND dateline<=$end",array($_POST['weixin']));
	if($number>=3)
		echo '2';
	else
		echo '0';
}elseif($_GET['ac']=='search'){
	header('Content-Type: text/html;charset=utf-8');
	define('INDEX',true);
	$day = $_GET['day'];
	if(!$day){
		$list = array();
	}else{
		$begin = strtotime($day.' 00:00:00');
		$end = $begin + 86400;
		$db = new db($config);
		$t = $db->table('record');
		$data = $db->select("SELECT distinct weixin FROM $t where dateline>=$begin AND dateline<=$end ORDER BY score DESC LIMIT 10");
		$list = array();
		$ranks = array('第一名','第二名','第三名','第四名','第五名','第六名','第七名','第八名','第九名','第十名');
		$i = 0;
		foreach($data as $row){
			$tmp = $db->find("SELECT weixin,score,phone,username FROM $t where weixin=? AND dateline>=$begin AND dateline<=$end ORDER BY score DESC LIMIT 1",array($row['weixin']));
			$tmp['rank'] = $ranks[$i++];
			$list[] = $tmp;
		}
	}
	require('search.php');
}else{
	/*header('Content-Type: text/html;charset=utf-8');
	echo <<<EOF
	<form action="losloslos.php?ac=submit" method="POST" target="_blank">
		<input type="text" name="weixin" /><br>
		<input type="text" name="username" /><br>
		<input type="text" name="phone" /><br>
		<input type="text" name="score" /><br>
		<input type="submit" value="提交" />
	</form>
	<br>
	<a href="losloslos.php?ac=rank" target="_blank">排行榜</a>
EOF;*/
}

class db{
	private $link;
	private $prefix;
	public function __construct($config){
		$this->link = mysql_connect($config['DB_HOST'].':'.$config['DB_PORT'],$config['DB_USER'],$config['DB_PWD']) or die('connect error');
		mysql_select_db($config['DB_NAME'],$this->link) or die('dbname error');
		mysql_query('SET NAMES '.$config['DB_CHARSET'],$this->link) or die('charset error');
		$this->prefix = $config['DB_PREFIX'];
	}
	public function insert($t,$d,$i=true,$r=false){
		$k = $v = $g = '';
		foreach($d as $key=>$val){
			$k = $k.$g.$key;
			$v = $v.$g.($this->escapeString($val));
			$g = ',';
		}
		$sql = ($r ? 'REPLACE' : 'INSERT').' INTO '.$this->prefix.$t.'('.$k.') VALUES('.$v.')';
		//echo $sql;
		$ret = mysql_query($sql,$this->link);
		if($ret && $i)
			return mysql_insert_id($this->link);
		else
			return $ret;
	}
	public function result($s,$d=array()){
		if(!($sql = $this->prepare($s,$d)))
			return array();
		$result = mysql_query($sql,$this->link);
		$row = mysql_fetch_row($result);
		return isset($row[0]) ? $row[0] : false;
	}
	public function find($s,$d=array()){
		if(!($sql = $this->prepare($s,$d)))
			return array();
		$result = mysql_query($sql,$this->link);
		$row = mysql_fetch_assoc($result);
		return $row ? $row : array();
	}
	public function select($s,$d=array()){
		if(!($sql = $this->prepare($s,$d)))
			return array();
		$result = mysql_query($sql,$this->link);
		$data = array();
		while($row = mysql_fetch_assoc($result)){
			$data[] = $row;
		}
		return $data;
	}
	public function prepare($s,$d){
		if(empty($d))
			return $s;
		if(substr_count($s,'?')!=count($d))
			return false;
		$len = strlen($s);
		$i = $j = 0;
		$sql = "";		
		for($i=0;$i<$len;$i++){
			if($s{$i}=="?"){
				$sql = $sql . $this->escapeString($d[$j++]);
			}else{
				$sql = $sql . $s{$i};
			}
		}
		return $sql;
	}
	public function table($t){
		return $this->prefix.$t;
	}
	public function escapeString($str) {
		if (is_string($str))
			return '\'' . addcslashes($str, "\n\r\\'\"\032") . '\'';
		elseif (is_int($str) or is_float($str))
			return '\'' . $str . '\'';
		elseif (is_array($str))		
			return '\'\'';
		elseif (is_bool($str))
			return $str ? '1' : '0';
		else
			return '\'\'';
	}
}