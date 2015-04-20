<?php
if(empty($_GET['pwd']) || $_GET['pwd']!='123')
	exit;
if(empty($_POST)){
	echo <<<EOF
<!DOCTYPE HTML>
<html charset="utf-8">
	<head><title>Mysql Console window</title></head>
	<body style="background:#000;color:#FFF">
		<div style="width:1000px;height:620px;margin:50px 0 0 100px;overflow:hidden"><div id="output" style="width:1040px;height:600px;overflow-y:scroll;">output:<br></div></div><br>
		<input id="input" style="margin:0 0 0 100px;width:1000px;height:20px;background:#000;color:#FFF" type="text" onkeyup="return submit(event);" />
		<script>
		function Ajax(m,u,c,d,e,a){
			this.xmlhttp = Ajax.getXmlhttp();
			this.method  = m;
			this.url = u;
			this.async = a ?  true : false;
			this.callback = c;
			this.error = e;
			this.data = d;
			
		}
		Ajax.getXmlhttp = function(){
			if(window.XMLHttpRequest){
				return new XMLHttpRequest();
			}
			var xmlhttp;
			try{
				xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
			}catch(e){
				try{
					xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
				}catch(e){}
			}
			return xmlhttp;
		}
		Ajax.prototype.setData = function(d){
			this.data = d;
		}
		Ajax.prototype.setRequestHeader = function(k,v){
			this.xmlhttp.setRequestHeader(k,v);
		}
		Ajax.prototype.exec = function(){
			var s = this;
			s.xmlhttp.onreadystatechange = function(){
				if(s.xmlhttp.readyState==4 ){
					if(s.xmlhttp.status>=200 && s.xmlhttp.status<300 || s.xmlhttp.status===304){
						if(s.callback){
							if (s.xmlhttp.responseType == "arraybuffer" || s.xmlhttp.responseType == "blob") {
								s.callback(s.xmlhttp.response);
							} else if (s.xmlhttp.responseText.length > 0) {
								s.callback(s.xmlhttp.responseText);
							} else {
								s.callback();
							}
						}
					}else if(s.error)
						s.error();			
				}
			}
			s.xmlhttp.open(s.method,s.url,s.async);
			if(s.method=="POST"){
				s.xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
			}
			if(s.data)
				s.xmlhttp.send(s.data);
			else
				s.xmlhttp.send();
		}
		function submit(ev){
			ev = ev || event;
			var keycode = window.event ? ev.keycode : ev.which;
			//console.log(keycode);
			//if((ev.ctrlKey || ev.altKey) && (keycode==117 || keycode==85)){
			if(keycode==173 && !ev.shiftKey){
				document.getElementById("input").value = "";
				return false;
			}else if(keycode!=13){
				return false;
			}
			var sqlstr = document.getElementById("input").value;
			if(sqlstr==""){
				alert("");
				return false;
			}else if(sqlstr.toLowerCase()=="clear"){
				var output = document.getElementById("output");
				output.innerHTML = "output:<br>";
				return false;
			}else if(sqlstr.toLowerCase()=="help"){
				var output = document.getElementById("output");
				output.innerHTML = "output:<br>support select,update,insert,delete,show,desc,-,help commands";
				return false;
			}
			var ajax = new Ajax("POST","database.php?pwd=123",function(res){
				var output = document.getElementById("output");
				output.innerHTML += res;
				output.scrollTop = output.scrollHeight;
			},"sqlstr="+sqlstr);
			ajax.exec();
		}
		</script>
	</body>
</html>
EOF;
}else{
	$sqlstr = trim($_POST['sqlstr']);
	$command = strtoupper(substr($sqlstr,0,strpos($sqlstr,' ')));
	if(in_array($command,array('SELECT','UPDATE','DELETE','INSERT','SHOW','DESC'))){
		$conn = mysql_connect(SAE_MYSQL_HOST_M.':'.SAE_MYSQL_PORT,SAE_MYSQL_USER,SAE_MYSQL_PASS) or die('connect error');
		mysql_select_db(SAE_MYSQL_DB,$conn) or die('select error');
		mysql_query("SET NAMES UTF8") or die('charset error');
		$res = mysql_query($sqlstr,$conn);
		if(!$res){
			echo mysql_errno($conn).':'.mysql_error($conn).'<br>';
		}else{
			if(in_array($command,array('SELECT','SHOW','DESC'))){
				$data = array();
				while($row = mysql_fetch_assoc($res))
					$data[] = $row;
				echo "<pre>";
				print_r($data);
				echo "</pre>";
			}else{
				echo mysql_affected_rows($conn).'<br>';
			}			
		}
		mysql_close($conn);
	}else{
		echo "command error<br>";
	}
}