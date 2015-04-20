/*游戏结束弹出的框*/
function GameOverSprite(list){
	base(this,LSprite,[]);
	var s = this;
	s.list = list;
	//添加背景
	var bitmap = new LBitmap(new LBitmapData(list["overBg"]));
	s.overBg = new LSprite();
	s.overBg.addChild(bitmap);
	s.addChild(s.overBg);
	//添加本次分数的文字
	s.score = new LTextField();
	s.score.color = "#FEFEFF";
	s.score.size = 16;
	s.score.weight = "600";
	s.score.font = 'Microsoft YaHei';
	s.score.y = 41;
	s.addChild(s.score);
	s.setScore(0);
	//添加还剩余次数的文件
	s.number = new LTextField();
	s.number.color = "#FEFEFF";
	s.number.size = 16;
	s.number.weight = "600";
	s.number.font = 'Microsoft YaHei';
	s.number.y = 84;
	s.addChild(s.number);
	s.setNumber(3);
	//添加返回按钮
	bitmap = new LBitmap(new LBitmapData(list["overReturn"]));
	s.overReturn = new LSprite();
	s.overReturn.addChild(bitmap);
	s.addChild(s.overReturn);
	s.overReturn.x = 41;
	s.overReturn.y = 143;
	s.overReturn.addEventListener(LMouseEvent.MOUSE_UP,function(){
		if(Game.getCookieOneDay("cookieGameNumber")>=3){
			alert('今天的剩余次数已经用完了哦');
			return;
		}
		Game.beginGame();
	});
	//添加分享的提示图片
	bitmap = new LBitmap(new LBitmapData(list["overNote"]));
	s.overNote = new LSprite();
	s.overNote.addChild(bitmap);
	s.overNote.visible = false;
	s.overNote.addEventListener(LMouseEvent.MOUSE_UP,function(){
		s.overNote.visible = false;
		s.showInput();
	});
	//添加分享按钮
	bitmap = new LBitmap(new LBitmapData(list["overShare"]));
	s.overShare = new LSprite();
	s.overShare.addChild(bitmap);
	s.addChild(s.overShare);
	s.overShare.x = 134;
	s.overShare.y = 143;
	s.overShare.addEventListener(LMouseEvent.MOUSE_UP,function(){
		s.hideInput();
		s.overNote.visible = true;
	});
	//添加排行榜的按钮
	bitmap = new LBitmap(new LBitmapData(list["overRank"]));
	s.overRank = new LSprite();
	s.overRank.addChild(bitmap);
	s.addChild(s.overRank);
	s.overRank.x = 227;
	s.overRank.y = 143;
	s.overRank.addEventListener(LMouseEvent.MOUSE_UP,function(){
		if(s.rankLayer)
			s.removeChild(s.rankLayer);
		s.hideInput();
		s.rankLayer = new RankSprite(s.list);
		s.addChild(s.rankLayer);
	});
	//添加中间的面板
	bitmap = new LBitmap(new LBitmapData(list["overPanel"]));
	s.overPanel = new LSprite();
	s.overPanel.addChild(bitmap);
	s.addChild(s.overPanel);
	s.overPanel.x = (LGlobal.width-s.overPanel.getWidth())/2;
	s.overPanel.y = 229;
	//添加确定的按钮
	bitmap = new LBitmap(new LBitmapData(list["overOk"]));
	s.overOk = new LSprite();
	s.overOk.addChild(bitmap);
	s.addChild(s.overOk);
	s.overOk.x = 84;
	s.overOk.y = 399;
	s.overOk.canClick = true;
	s.overOk.addEventListener(LMouseEvent.MOUSE_UP,function(){
		if(!s.overOk.canClick)	return;
		s.overOk.canClick = false;
		var weixin = document.getElementById("weixin");
		var username = document.getElementById("username");
		var phone = document.getElementById("phone");
		if(weixin.value==""){
			alert("请填写您的微信号");
		}else if(username.value==""){
			alert("请填写您的姓名");
		}else if(phone.value==""){
			alert("请填写您的联系方式");
		}else{
			var ajax = new Ajax("POST","losloslos.php?ac=game",function(d){
				if("0"==d){
					setCookie("cookieWeixin",document.getElementById("weixin").value);
					setCookie("cookieUsername",document.getElementById("username").value);
					setCookie("cookiePhone",document.getElementById("phone").value);
					document.getElementById("weixin").setAttribute("disabled","disabled");
					alert("请耐心等候通知");
				}else if("1"==d){
					alert("您今天只剩一次挑战的机会了哦");
				}else if("2"==d){
					alert("明天再来哦");
				}else{
					alert("您的输入有误");
				}
			},"weixin="+weixin.value+"&username="+username.value+"&phone="+phone.value+"&score="+Game.getScore);
			ajax.exec();
		}
	});
	//添加取消的按钮
	bitmap = new LBitmap(new LBitmapData(list["overCancel"]));
	s.overCancel = new LSprite();
	s.overCancel.addChild(bitmap);
	s.addChild(s.overCancel);
	s.overCancel.x = 210;
	s.overCancel.y = 399;
	s.overCancel.addEventListener(LMouseEvent.MOUSE_UP,function(){
		if(Game.getCookieOneDay("cookieGameNumber")>=3){
			alert('今天的剩余次数已经用完了哦');
			return;
		}
		Game.beginGame();
	});
	//最后添加遮盖框	
	s.addChild(s.overNote);
	//输入框
	s.weixin = document.getElementById("weixin");
	s.username = document.getElementById("username");
	s.phone = document.getElementById("phone");
}

GameOverSprite.prototype.show = function(){
	var s = this;
	s.visible = true;
	s.showInput();
	s.setScore(Game.getScore);
	s.setNumber(3-Game.getCookieOneDay("cookieGameNumber"));
}

GameOverSprite.prototype.hide = function(){
	var s = this;
	s.hideInput();
	s.visible = false;
}
GameOverSprite.prototype.showInput = function(){
	var s = this;
	s.weixin.style.display = "block";
	s.username.style.display = "block";
	s.phone.style.display = "block";
}

GameOverSprite.prototype.hideInput = function(){
	var s = this;
	s.weixin.style.display = "none";
	s.username.style.display = "none";
	s.phone.style.display = "none";
}
GameOverSprite.prototype.setScore = function(n){
	this.score.text = "本次分数："+n+"米";
	this.score.x = (LGlobal.width-this.score.getWidth())/2;
}
GameOverSprite.prototype.setNumber = function(n){
	this.number.text = "剩余挑战次数："+n+"次";
	this.number.x = (LGlobal.width-this.number.getWidth())/2;
}