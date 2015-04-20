<?php	if(!defined('INDEX'))	exit; ?>
<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8" />
		<title>los los los</title>
		<script type="text/javascript" src="./jquery-1.11.1.min.js"></script>
		<script type="text/javascript" src="./home_calendar.js"></script>
	</head>
<style>
body,ul,dl,dt,dd,ol,table,th,tr,td{margin: 0;padding: 0;}
body{text-align: center;}
body *{text-align: left;}
.wp{width:960px;margin:0 auto;}
.top{
	width:100%;
	height:80px;
	background:#00B4FF;
}
.title{
	height:40px;
	color: #ffffff;
    font-family: "微软雅黑 Bold","微软雅黑";
    font-size: 20px;
    font-weight: 700;
	padding-top:32px;
}
.foot{
	width:100%;
	height:30px;
	background:#00B4FF;
}
.main{
	background:#E4E4E4;
	padding-top:25px;
}
.search{margin-left:20px;}
.search span{
	color: #333333;
    font-size: 13px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    text-align: left;
}
.submit{
	width:71px;
	height:35px;
	padding:0;
	margin:0;
	border:none;
	background:url("button.png");
	text-align:center;
	color:#FFFFFF;
	font-weight:700;
}
.table{
	margin:20px 0 0 20px;
}
.table th,.table td{
	width:128px;
	height:30px;
	text-align:center;
	vertical-align:middle;
	line-height:30px;
}
.table table{border-right:1px solid #66CCFF;border-bottom:1px solid #66CCFF}
.table table td{border-left:1px solid #66CCFF;border-top:1px solid #66CCFF}
.table table{color:#000000;background:#FFFFFF;}
.table .th td{background:#66CCFF;color:#FFFFFF;}
</style>
<body>
	<div class="top"><div class="wp title">微信游戏后台数据查询</div></div>
	<div class="wp main">
		<div class="search">
		<form action="losloslos.php">
			<input type="hidden" name="ac" value="search" />
			<span>日期:</span>
			<input class="text" type="text" name="day" readonly="readonly" onclick="new Calendar().show(this);" />
			<input class="submit" type="submit" value="查询" />
		</form>
		</div>
		<div class="table">
			<table>
				<tr class="th"><td>日期</td><td>微信号</td><td>姓名</td><td>联系方式</td><td>成绩</td><td>排行</td></tr>
				<?php foreach($list as $val){?>
				<tr><td><?=$day?></td><td><?=$val['weixin']?></td><td><?=$val['username']?></td><td><?=$val['phone']?></td><td><?=$val['score']?>米</td><td><?=$val['rank']?></td></tr>
				<?php }?>
			</table>
		</div>
	</div>
	<div class="foot"></div>
<script>
$(".main").height($(window).height()-$(".top").height()-$(".foot").height());
</script>
</body>
</html>
