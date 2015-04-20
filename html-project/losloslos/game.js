if(LGlobal.canTouch){
	LGlobal.stageScale = LStageScaleMode.EXACT_FIT;
	LSystem.screen(LStage.FULL_SCREEN);
}
var Game = {},list,bitmap;
Game.dataList = [
	{name:"introBg",path:"./images/introBg.png"},
	{name:"weixinBtn",path:"./images/weixinBtn.png"},
	{name:"shopBtn",path:"./images/shopBtn.png"},
	{name:"kaishiyouxi",path:"./images/kaishiyouxi.png"},
	{name:"shuoming",path:"./images/shuoming.png"},
	{name:"jiangli",path:"./images/jiangli.png"},
	{name:"introPanel",path:"./images/introPanel.png"},
	{name:"rewardPanel",path:"./images/rewardPanel.png"},
	{name:"gameBg",path:"./images/gameBg.png"},
	{name:"shan",path:"./images/shan2.png"},
	{name:"po",path:"./images/tutu.png"},
	{name:"yun",path:"./images/yunyun.png"},
	{name:"sun",path:"./images/sun2.png"},
	{name:"shangbiao",path:"./images/shangbiao.png"},
	{name:"overBg",path:"./images/overBg.png"},
	{name:"overReturn",path:"./images/overReturn.png"},
	{name:"overShare",path:"./images/overShare.png"},
	{name:"overRank",path:"./images/overRank.png"},
	{name:"overPanel",path:"./images/overPanel.png"},
	{name:"overNote",path:"./images/overNote.png"},
	{name:"overOk",path:"./images/overOk.png"},
	{name:"overCancel",path:"./images/overCancel.png"},
	{name:"rankBg",path:"./images/rankBg.png"},
	{name:"rankCancel",path:"./images/rankCancel.png"},
	{name:"fight",path:"./images/fight.png"},
	{name:"carFrame",path:"./images/carFrame.png"},
	{name:"starScore",path:"./images/starScore.png"},
	{name:"win",path:"./images/win.png"},
	{name:"lose",path:"./images/lose.png"},
	{name:"clock",path:"./images/clock.png"},
	{name:"clockPoint",path:"./images/clockPoint.png"},
	{name:"stone",path:"./images/stone.png"},
];
Game.setCookieOneDay = function (name,n){
    var Days = 30;
    var exp = new Date();
    var day = new Date(exp.getFullYear(),exp.getMonth(),exp.getDate());
    exp.setTime(day.getTime() + 86400*1000);
    //console.log(exp.toGMTString(),day.toGMTString());
    document.cookie = name + "="+ escape (n) + ";expires=" + exp.toGMTString();
}
Game.getCookieOneDay = function(name){
	var n = getCookie(name);
	if(n){
		return parseInt(n);
	}else{
		return 0;
	}
}
Game.incCookieOneDay = function(name){
	var n = getCookie(name);
	if(n){
		Game.setCookieOneDay(name,1+parseInt(n));
	}else{
		Game.setCookieOneDay(name,1);
	}
}
Game.share = function(){
	WeixinHelper.img = "http://img1.ptpcp.com/v2/thumb/jpg/Njg0NSwxMzgsMTM4LDMsMywxLC0xLE5PTkUs/u/www.ptbus.com/uploads/1406/27/3880-14062G13503594.png";
	WeixinHelper.title = WeixinHelper.desc = "玩了一把拖拉机，我跑了"+Game.getScore+"米";
}
Game.beginGame = function(){
	//清除所有元素
	LGlobal.stage.removeAllChild();
	LGlobal.stage.removeAllEventListener();
	//添加游戏中的场景
	Game.playingLayer = new PlayingSprite(list);
	addChild(Game.playingLayer);
	//添加游戏结束的场景并隐藏
	Game.gameOverLayer = new GameOverSprite(list);
	addChild(Game.gameOverLayer);
	Game.gameOverLayer.hide();
}
Game.overGame = function(){
	//删除游戏中的场景并显示游戏结束的场景
	removeChild(Game.playingLayer);
	Game.gameOverLayer.show();
}
Game.init = function(){
	//Game.beginGame();
	Game.introduceLayer = new IntroduceSprite(list,Game.beginGame);
	addChild(Game.introduceLayer);
	//addChild(new RankSprite(list));
	//Game.clock = new ClockSprite(list)
	//addChild(Game.clock);
	//Game.clock.setGo(10000);

	/*var weinxinAccount = getCookie("weinxinAccount");
	if(weinxinAccount){
		alert(weinxinAccount);
		setCookie("weinxinAccount","this is a weixin name"+Math.random());
	}else{
		setCookie("weinxinAccount","this is a weixin name");
		alert('first time');
	}*/
}
Game.beforeInit = function(){
	//设置三个输入框的位置
	var canvasObj = document.getElementById("yoge_canvas");
	var canvasMargin = canvasObj.style.margin;
	var scaleX = 1;
	var scaleY = 1;
	var canvasLeft = 0;
	var canvasTop = 0;
	var weixin = document.getElementById("weixin");
	var username = document.getElementById("username");
	var phone = document.getElementById("phone");
	if("0px"!=canvasMargin){
		canvasMargin = explode(canvasMargin,' ');
		canvasLeft = parseInt(canvasMargin[3]);
		canvasTop = parseInt(canvasMargin[0]);
	}
	if(canvasObj.style.width)
		scaleX = parseInt(canvasObj.style.width) / LGlobal.width;
	if(canvasObj.style.height)
		scaleY = parseInt(canvasObj.style.height) / LGlobal.height;
	weixin.style.top = parseInt(getStyle(weixin,"top"))*scaleY + canvasTop + "px";
	weixin.style.left = parseInt(getStyle(weixin,"left"))*scaleX + canvasLeft + "px";
	username.style.top = parseInt(getStyle(username,"top"))*scaleY + canvasTop + "px";
	username.style.left = parseInt(getStyle(username,"left"))*scaleX + canvasLeft + "px";
	phone.style.top = parseInt(getStyle(phone,"top"))*scaleY + canvasTop + "px";
	phone.style.left = parseInt(getStyle(phone,"left"))*scaleX + canvasLeft + "px";
	//alert(scaleY+' '+scaleX)
	//读取Cookie并设置微信号等信息
	var cookieWeixin = getCookie('cookieWeixin');
	var cookieUsername = getCookie('cookieUsername');
	var cookiePhone = getCookie('cookiePhone');
	if(cookieWeixin){
		weixin.value = cookieWeixin;
		weixin.setAttribute("disabled","disabled");
	}
	if(cookieUsername)
		username.value = cookieUsername;
	if(cookiePhone)
		phone.value = cookiePhone;
	removeChild(Game.loadingSprite);
	Game.loadingSprite = null;
	if(cookieWeixin){
		var ajax = new Ajax("POST","losloslos.php?ac=count",function(d){
			if("0"==d){
				Game.init();
			}else{
				alert("明天再来哦");
			}
		},"weixin="+cookieWeixin);
		ajax.exec();
	}else if(Game.getCookieOneDay("cookieGameNumber")>3){
		alert("明天再来哦");
	}else{
		Game.init();
	}
}
Game.beforeLoading = function(){
	LGlobal.resize();
	Game.loadingSprite = new LoadingSprite(3000,Game.beforeInit);
	addChild(Game.loadingSprite);
	LLoadManage.load(Game.dataList,function(progress){Game.loadingSprite.setProgress(progress)},function(result){list=result;});
}
init(50,'yoge',320,480,Game.beforeLoading);