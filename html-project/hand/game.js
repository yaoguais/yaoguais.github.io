if(LGlobal.canTouch){
	LGlobal.stageScale = LStageScaleMode.EXACT_FIT;
	LSystem.screen(LStage.FULL_SCREEN);
}
var dataList = [
	{name:"back",path:"./images/back.png"},
	{name:"bh0",path:"./images/bh0.png"},
	{name:"bh1",path:"./images/bh1.png"},
	{name:"bh2",path:"./images/bh2.png"},
	{name:"th0",path:"./images/th0.png"},
	{name:"th1",path:"./images/th1.png"},
	{name:"gun",path:"./images/gun.png"},	
	{name:"jian",path:"./images/jian.png"},
	{name:"tr",path:"./images/tr.png"},
	{name:"br",path:"./images/br.png"},
	{name:"panelbg",path:"./images/panelbg.jpg"},
	{name:"once",path:"./images/oncemore.png"},
	{name:"share",path:"./images/share.png"},
	{name:"sharenote",path:"./images/sharenote.png"},
	{name:"c1",path:"./images/c1.png"},
	{name:"c2",path:"./images/c2.png"},
	{name:"c3",path:"./images/c3.png"},
	{name:"c4",path:"./images/c4.png"},
	{name:"c5",path:"./images/c5.png"},
	{name:"c6",path:"./images/c6.png"},
	{name:"c7",path:"./images/c7.png"},
	{name:"c8",path:"./images/c8.png"},
	{name:"c9",path:"./images/c9.png"},
	{name:"c10",path:"./images/c10.png"},
	{name:"c11",path:"./images/c11.png"},
	{name:"c12",path:"./images/c12.png"},
	{name:"gameIntro",path:"./images/gameIntro.png"},
	{name:"gameStart",path:"./images/gameStart.png"},
	{name:"gameSubscribe",path:"./images/gameSubscribe.png"},
];
var list;
var loadingLayer,beforeLayer;
var backLayer,bh0Layer,bh1Layer,bh2Layer,gunLayer,th0Layer,th1Layer,brLayer,trLayer,scoreLayer,shareLayer,shareNoteLayer,cryLayer;
var speed = 10;
var status = -1;//0进行中 1游戏结束
var startTime = 0;
var lifeTime = 0;
var gunGet = 0;
init(30,'yoge',320,570,main);
function main(){
	LGlobal.resize();
	loadingLayer = new LoadingSample3();
	addChild(loadingLayer);
	LLoadManage.load(dataList,function(progress){loadingLayer.setProgress(progress)},gameInit);
}
function gameInit(result){
	list = result;
	removeChild(loadingLayer);
	//添加背景图
	var bitmap = new LBitmap(new LBitmapData(list["back"]));
	backLayer = new LSprite();
	backLayer.addChild(bitmap);
	addChild(backLayer);
	
	//添加上面的手
	bitmap = new LBitmap(new LBitmapData(list["th0"]));
	th0Layer = new LSprite();
	th0Layer.addChild(bitmap);
	th0Layer.x = (LGlobal.width - th0Layer.getWidth())*0.5;
	th0Layer.y = 40;
	//th0Layer.visible = false;
	//添加上面的手
	bitmap = new LBitmap(new LBitmapData(list["th1"]));
	th1Layer = new LSprite();
	th1Layer.addChild(bitmap);
	th1Layer.x = th0Layer.x;
	th1Layer.y = th0Layer.y+23;
	th1Layer.visible = false;
	//添加下面的手
	bitmap = new LBitmap(new LBitmapData(list["bh0"]));
	bh0Layer = new LSprite();
	bh0Layer.addChild(bitmap);
	bh0Layer.x = (LGlobal.width - bh0Layer.getWidth())*0.5+5;
	bh0Layer.y = LGlobal.height - bh0Layer.getHeight() - 60;
	//bh0Layer.visible = false;
	//添加下面的手
	bitmap = new LBitmap(new LBitmapData(list["bh1"]));
	bh1Layer = new LSprite();
	bh1Layer.addChild(bitmap);
	bh1Layer.x = bh0Layer.x;
	bh1Layer.y = bh0Layer.y;
	bh1Layer.visible = false;
	//添加下面的手
	bitmap = new LBitmap(new LBitmapData(list["bh2"]));
	bh2Layer = new LSprite();
	bh2Layer.addChild(bitmap);
	bh2Layer.x = bh0Layer.x;
	bh2Layer.y = bh0Layer.y;
	bh2Layer.visible = false;
	//添加上面的人
	bitmap = new LBitmap(new LBitmapData(list["tr"]));
	trLayer = new LSprite();
	trLayer.addChild(bitmap);
	trLayer.x = th0Layer.x - trLayer.getWidth()+24;
	trLayer.y = th0Layer.y-20;
	//添加下面的人
	bitmap = new LBitmap(new LBitmapData(list["br"]));
	brLayer = new LSprite();
	brLayer.addChild(bitmap);
	brLayer.x = bh0Layer.x+bh0Layer.getWidth()-10;
	brLayer.y = bh0Layer.y-brLayer.getHeight()*0.45;
	//添加棍子
	gunLayer = new LGunLayer([list["gun"],list["jian"]]);
	gunLayer.x = th0Layer.x + 21;
	gunLayer.setImage(0);
	//添加开始的时间
	scoreLayer = new LTextField();
	scoreLayer.color = "#FFFFFF";
	scoreLayer.size = 30;
	scoreLayer.text = "0.00";
	scoreLayer.weight = 500;
	scoreLayer.font = 'Microsoft YaHei';
	scoreLayer.x = (LGlobal.width - scoreLayer.getWidth())*0.5;
	scoreLayer.y = 200;
	//添加分享的提示
	shareNoteLayer = new LShareNote(list["sharenote"]);
	//添加分享的图层
	shareLayer = new LSharePanel(list["panelbg"],list["once"],list["share"],function(e){
		shareLayer.visible = false;
		handAction.gameStart();
		e._ll_preventDefault = true;
	},function(){
		setWeinxin();
		shareNoteLayer.visible = true;
	});
	shareLayer.visible = false;
	shareLayer.setScore(scoreLayer.text);
	shareLayer.setText("");
	//添加哭的图层
	cryLayer = new LCryLayer(list);
	//添加开始按钮的图层
	beforeLayer = new LBeforeLayer([list["gameIntro"],list["gameStart"],list["gameSubscribe"]],function(){
		beforeLayer.gameStart();
		//添加渲染事件
		backLayer.addEventListener(LEvent.ENTER_FRAME,onframe);
		backLayer.addEventListener(LMouseEvent.MOUSE_DOWN,ondown);
		handAction.gameStart();
	});
	//添加图层的顺序
	backLayer.addChild(gunLayer);
	backLayer.addChild(th0Layer);
	backLayer.addChild(th1Layer);
	backLayer.addChild(trLayer);
	backLayer.addChild(brLayer);
	backLayer.addChild(bh0Layer);
	backLayer.addChild(bh1Layer);
	backLayer.addChild(bh2Layer);
	backLayer.addChild(scoreLayer);
	backLayer.addChild(shareLayer);
	backLayer.addChild(shareNoteLayer);
	backLayer.addChild(cryLayer);
	backLayer.addChild(beforeLayer);
}

function setWeinxin(){
	_WXShare.img = "http://img1.ptpcp.com/v2/thumb/jpg/Njg0NSwxMzgsMTM4LDMsMywxLC0xLE5PTkUs/u/www.ptbus.com/uploads/1406/27/3880-14062G13503594.png";	
	var tmpword = "("+Math.floor(lifeTime)+"秒)"+wordList.getLastword();
	_WXShare.title = tmpword.replace("\n","");
	_WXShare.desc = tmpword.replace("\n","");
}
function onframe(){
	if(status==0){
		handAction.showScore();
		if(gunLayer.y>LGlobal.height){
			if(gunLayer.cur==0){
				status = 1;
				shareLayer.setText(wordList.getWord(gunLayer.cur==0 ? false : true ,gunGet));
			}else{
				handAction.reset();
			}	
		}else if(gunLayer.y>th0Layer.y){
			handAction.topHandOpen();
		}
		gunLayer.y += speed;
	}else if(status==1){
		cryLayer.visible = true;
		if(cryLayer.isOver()){
			cryLayer.visible = false;
			handAction.gameOver();
		}else{
			cryLayer.visible = true;
			cryLayer.onframe();
		}
	}else if(status>30){
		status = 0;
		handAction.reset();
	}else if(status>1){
		status++;
	}
	
}

function ondown(e){
	if(status==0){
		var die = false;
		if(handAction.isHandle()){
			if(gunLayer.cur==0){
				status = 2;
				handAction.handled();
				speed += 5;
				gunGet++;
			}else{
				die = true;
			}			
		}else{
			if(gunLayer.cur==0)
				die = true;
		}
		if(die){
			status = 1;
			shareLayer.setText(wordList.getWord(gunLayer.cur==0 ? false : true ,gunGet));
			handAction.noHandled();
		}
	}
}

var handAction = {
	reset: function(){
		th0Layer.visible = true;
		th1Layer.visible = false;
		gunLayer.y = 0;
		status = 0;
		bh0Layer.visible = true;
		bh1Layer.visible = false;
		bh2Layer.visible = false;
		gunLayer.visible = false;
		if(gunGet>0){
			var random =Math.floor(Math.random()*3+3);
			if(gunGet%random==0 && gunGet>=random)
				gunLayer.setImage(1);
			else if(gunLayer.cur>0)
				gunLayer.setImage(0);
		}else{
			gunLayer.setImage(0);
		}
	},
	topHandOpen:function(){
		th0Layer.visible = false;
		th1Layer.visible = true;
		gunLayer.visible = true;
	},
	isHandle:function(){
		var y1,y2,y3,y4;
		y1 = gunLayer.y;
		y2 = bh0Layer.y;
		y3 = gunLayer.y+gunLayer.getHeight();
		y4 = bh0Layer.y+bh0Layer.getHeight();
		if(y3>=y2 && y1<=y4)
			return true;
		else
			return false;
	},
	handled:function(){
		bh0Layer.visible = false;
		bh1Layer.visible = false;
		bh2Layer.visible = true;
	},
	noHandled:function(){
		bh0Layer.visible = false;
		bh1Layer.visible = true;
		bh2Layer.visible = false;
	},
	gameStart:function(){
		startTime = Date.now();
		lifeTime = 0;
		gunGet = 0;		
		cryLayer.reset();
		handAction.reset();
	},
	gameOver:function(){
		speed = 5;
		shareLayer.setScore(scoreLayer.text);
		setWeinxin();
		shareLayer.visible = true;
	},
	showScore:function(){
		var t = Date.now() - startTime;
		lifeTime = t/1000;
		scoreLayer.text = Math.floor(t/1000)+'.'+Math.floor((t%1000)/10);+"'";
		scoreLayer.x = (LGlobal.width - scoreLayer.getWidth())*0.5;
	}
}

function LSharePanel(listBgKey,listOnceKey,listShareKey,restartGame,showShare){
	var s = this;
	base(this,LSprite,[]);
	var bitmap = new LBitmap(new LBitmapData(listBgKey));
	s.addChild(bitmap);
	s.y = (LGlobal.height-s.getHeight())*0.5-20;

	s.score = new LTextField();
	s.score.color = "#FFFFFF";
	s.score.size = 30;
	s.score.text = "$31";
	s.score.weight = 500;
	s.score.font = 'Microsoft YaHei';
	s.score.x = (LGlobal.width - s.score.getWidth())*0.5;
	s.score.y = 15;
	s.addChild(s.score);

	s.once = new LSprite();
	bitmap = new LBitmap(new LBitmapData(listOnceKey));
	s.once.addChild(bitmap);
	s.once.x = 30;
	s.once.y = 180;
	s.addChild(s.once);
	s.once.addEventListener(LMouseEvent.MOUSE_UP,restartGame);
	
	s.share = new LSprite();
	bitmap=new LBitmap(new LBitmapData(listShareKey));
	s.share.addChild(bitmap);
	s.share.x = LGlobal.width - s.once.getWidth() - 30;
	s.share.y = 180;
	s.addChild(s.share);
	s.share.addEventListener(LMouseEvent.MOUSE_UP,showShare);

	s.text0 = new LTextField();
	s.text0.color = "#FE9316";
	s.text0.size = 15;
	s.text0.text = "";
	s.text0.weight = 500;
	s.text0.font = 'Microsoft YaHei';
	s.text0.x = (LGlobal.width - s.text0.getWidth())*0.5;
	s.text0.y = 100;
	s.addChild(s.text0);

	s.text1 = new LTextField();
	s.text1.color = "#FE9316";
	s.text1.size = 15;
	s.text1.text = "";
	s.text1.weight = 500;
	s.text1.font = 'Microsoft YaHei';
	s.text1.x = (LGlobal.width - s.text1.getWidth())*0.5;
	s.text1.y = 100;
	//s.text1.visible = false;
	s.addChild(s.text1);
}
LSharePanel.prototype.setScore = function(score){
	var s = this;
	s.score.text = score;
	s.score.x = (LGlobal.width - s.score.getWidth())*0.5;
}
LSharePanel.prototype.setText = function(text){
	var s = this;
	var pos = -1;
	if(typeof text == "string" && (pos=text.indexOf("\n"))!=-1){
		var text0 = text.substr(0,pos);
		var text1 = text.substr(pos+1);
		s.text0.text = text0;
		s.text0.x = (LGlobal.width - s.text0.getWidth())*0.5;
		s.text0.y = 95;
		s.text1.visible = true;
		s.text1.text = text1;
		s.text1.x = (LGlobal.width - s.text1.getWidth())*0.5;
		s.text1.y = 120;
	}else{
		s.text0.text = text;
		s.text0.x = (LGlobal.width - s.text0.getWidth())*0.5;
		s.text0.y = 100;
		s.text1.visible = false;
	}
}

function LShareNote(listBgKey){
	var s = this;
	base(this,LSprite,[]);
	var bitmap = new LBitmap(new LBitmapData(listBgKey));
	s.addChild(bitmap);
	s.width = LGlobal.width;
	s.height = LGlobal.height;
	s.visible = false;
	s.addEventListener(LMouseEvent.MOUSE_DOWN,function(){
		s.visible = false;
	});
}

function LGunLayer(list){
	var s = this;
	base(this,LSprite,[]);
	s.list = list;
	s.cur = 0;
	var sprite,bitmap;
	for(var i=0;i<s.list.length;i++){
		bitmap = new LBitmap(new LBitmapData(s.list[i]));
		sprite = new LSprite();
		sprite.addChild(bitmap);
		sprite.visible = false;
		s.addChild(sprite);
	}

}
LGunLayer.prototype.setImage = function(i){
	var s = this;
	var l = s.childList.length;
	if(i>=0 && i<l){
		s.cur = i;
		for(var j=0;j<l;j++)
			s.childList[j].visible = false;
		s.childList[i].visible = true;
		s.width = s.childList[i].getWidth();
		s.height = s.childList[i].getHeight();
	}
}

function LCryLayer(dl){
	var s = this;
	base(this,LSprite,[]);
	s.begin = 1;
	s.end = 12;
	s.play = 0;
	var sprite,bitmap;
	for(var i=s.begin;i<=s.end;i++){
		bitmap = new LBitmap(new LBitmapData(dl['c'+i]));
		sprite = new LSprite();
		sprite.addChild(bitmap);
		sprite.visible = false;
		s.addChild(sprite);
	}
	s.width = sprite.getWidth();
	s.height = sprite.getWidth();
	s.x = (LGlobal.width-s.width)*0.5;
	s.y = (LGlobal.height-s.height)*0.5;
	s.cur = 0;
}
LCryLayer.prototype.onframe = function(){
	var s = this;
	s.childList[s.cur].visible = false;
	s.cur = (s.cur+1)%s.childList.length;
	s.childList[s.cur].visible = true;
	if(s.cur==s.childList.length-1)
		s.play++;
}
LCryLayer.prototype.isOver = function(){
	var s = this;
	if(s.play>4)
		return true;
	else
		return false;
}
LCryLayer.prototype.reset = function(){
	this.cur = this.play = 0;
}

var LSleep = {
	start:0,
	sleep:0,
	setSleep:function(sleep){
		this.start = Date.now();
		this.sleep = sleep;
	},
	isSleep:function(){
		if(Date.now()-this.start>this.sleep)
			return false;
		else
			return true;
	}
};


var wordList = {
	lastword:"",
	word:[
		"长老，师太说你太慢了！",
		"体力这么差啊人家不满意啦！",
		"施主真是个没用的东西啊！",
		"长老好棒！",
		"长老手好快！",
		"长老果然身怀绝技！",
	],
	daoWord:[
		"长着眼睛没看见\n这是刀子啊还接？！！",
		"你以为我不敢\n戳你是吗？！！",
		"阿米豆腐，施主\n死的太惨烈了！",
		"下辈子再见着刀子\n不要再乱用手抓了傻孩子！"
	],
	getWord:function(dao,socre){
		if(dao){
			this.lastword = this.daoWord[Math.floor(Math.random()*this.daoWord.length)];
		}else{
			if(socre<5){
				this.lastword = this.word[Math.floor(Math.random()*3)];
			}else{
				this.lastword = this.word[Math.floor(Math.random()*3+3)];
			}
		}
		return this.lastword;
	},
	getLastword:function(){
		return this.lastword;
	}
};

function LBeforeLayer(l,gameStartIt){
	//0是说明 1是开始按钮 2是关注我们
	var s = this;
	base(this,LSprite,[]);
	s.x = s.y = 0;
	var sprite,bitmap;

	bitmap = new LBitmap(new LBitmapData(l[0]));
	sprite = new LSprite();
	sprite.addChild(bitmap);
	sprite.x = sprite.y = 0;
	s.addChild(sprite);

	bitmap = new LBitmap(new LBitmapData(l[1]));
	sprite = new LSprite();
	sprite.addChild(bitmap);
	sprite.x = 0;
	sprite.y = LGlobal.height-180;
	s.addChild(sprite);

	bitmap = new LBitmap(new LBitmapData(l[2]));
	sprite = new LSprite();
	sprite.addChild(bitmap);
	sprite.x = 10;
	sprite.y = LGlobal.height - sprite.getHeight()-10;
	s.addChild(sprite);
	s.childList[1].addEventListener(LMouseEvent.MOUSE_UP,function(){
		gameStartIt();
	});
	s.childList[2].addEventListener(LMouseEvent.MOUSE_UP,function(){
		window.location.href = 'http://mp.weixin.qq.com/s?__biz=MzA4ODk0ODgxMA==&mid=200443928&idx=1&sn=02c44d97efda42b534f48c7cacf644b1#rd';
	});
}
LBeforeLayer.prototype.gameStart = function(){
	var s = this;
	s.childList[0].visible = false;
	s.childList[1].visible = false;
}

var _WXShare = {
		appid:null,
		img:null,
		width:null,
		height:null,
		url:null,
		desc:null,
		title:null,
		friend: function(){
				WeixinJSBridge.invoke('sendAppMessage',{
					'appid': _WXShare.appid || '',
					'img_url': _WXShare.img,
					'img_width': _WXShare.width || 100,
					'img_height': _WXShare.height || 100,
					'link': _WXShare.url || window.location.href,
					'desc': _WXShare.desc || document.title,
					'title': _WXShare.title || document.title
					}, function(res){
					_report('send_msg', res.err_msg);
				});
		},
		pengyou: function(){
				WeixinJSBridge.invoke('shareTimeline',{
					'img_url': _WXShare.img,
					'img_width': _WXShare.width || 100,
					'img_height': _WXShare.height || 100,
					'link': _WXShare.url || window.location.href,
					'desc': _WXShare.desc || document.title,
					'title': _WXShare.title || document.title,
					}, function(res) {
						_report('timeline', res.err_msg);
				});
		},
		weibo: function(){
				WeixinJSBridge.invoke('shareWeibo',{
					  'content': _WXShare.desc || document.title,
					  'url': _WXShare.url || window.location.href,
					  }, function(res) {
					  _report('weibo', res.err_msg);
				});
		}
};
document.addEventListener('WeixinJSBridgeReady', function onBridgeReady() {
	WeixinJSBridge.on('menu:share:appmessage', function(argv){
		_WXShare.friend();
	});
	WeixinJSBridge.on('menu:share:timeline', function(argv){
		_WXShare.pengyou();
	});
	WeixinJSBridge.on('menu:share:weibo', function(argv){
		_WXShare.weibo();
   });
}, false);