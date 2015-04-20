function PlayingSprite(list){
	base(this,LSprite,[]);
	var s = this;
	s.status = "pause";/*drag move climb jump sprint over*/
	s.getScore = 0;
	s.getSpeed = 1.1;
	s.maxSpeed = 5;
	s.minSpeed = 2;
	s.life = 20000;
	s.startTime = Date.now()+86400*365;
	//添加最后一层的游戏背景
	var bitmap = new LBitmap(new LBitmapData(list["gameBg"]));	
	s.gameBg = new LSprite();
	s.gameBg.addChild(bitmap);
	s.addChild(s.gameBg);
	//添加山的动画
	bitmap = new LBitmap(new LBitmapData(list["shan"]));	
	s.shan = new LSprite();
	s.shan.addChild(bitmap);
	s.addChild(s.shan);
	s.shan.x = 0;
	s.shan.y = 200;
	//添加坡的动画
	bitmap = new LBitmap(new LBitmapData(list["po"]));
	s.po = new LSprite();
	s.po.addChild(bitmap);
	s.addChild(s.po);
	s.po.x = 0;
	s.po.y = 100;
	//添加太阳的图片
	bitmap = new LBitmap(new LBitmapData(list["sun"]));
	s.sun = new LSprite();
	s.sun.addChild(bitmap);
	s.addChild(s.sun);
	s.sun.x = LGlobal.width-s.sun.getWidth();
	s.sun.y = 0;
	//添加云的动画
	bitmap = new LBitmap(new LBitmapData(list["yun"]));
	s.yun = new LSprite();
	s.yun.addChild(bitmap);
	s.addChild(s.yun);
	s.yun.x = 0;
	s.yun.y = 20;
	s.yun.addEventListener(LEvent.ENTER_FRAME,s.yunOnFrame);
	//添加商标的图片
	bitmap = new LBitmap(new LBitmapData(list["shangbiao"]));
	s.shangbiao = new LSprite();
	s.shangbiao.addChild(bitmap);
	s.addChild(s.shangbiao);
	s.shangbiao.x = LGlobal.width-s.sun.getWidth()-2;
	s.shangbiao.y = 22;
	//添加右下角的商城按钮
	bitmap = new LBitmap(new LBitmapData(list["shopBtn"]));
	s.shopBtn = new LSprite();
	s.shopBtn.addChild(bitmap);
	s.shopBtn.x = 120;
	s.shopBtn.y = LGlobal.height - 10 - s.shopBtn.getHeight();
	s.addChild(s.shopBtn);
	s.shopBtn.addEventListener(LMouseEvent.MOUSE_UP,function(){
		window.location.href = 'http://www.qq.com';
	});
	//添加左上角的分数背景
	bitmap = new LBitmap(new LBitmapData(list["starScore"]));
	s.starScore = new LSprite();
	s.starScore.addChild(bitmap);
	s.addChild(s.starScore);
	s.starScore.x = 26;
	s.starScore.y = 18;
	//添加分数的文字
	s.score = new LTextField();
	s.score.color = "#4c2401";
	s.score.size = 12;
	s.score.weight = "600";
	s.score.font = 'Microsoft YaHei';
	s.score.y = 30;
	s.addChild(s.score);
	s.setScore(0);
	//添加车的精灵
	var li  = LGlobal.divideCoordinate(210,30,1,3);
	var data = new LBitmapData(list["carFrame"],0,0,70,30);
	s.car = new LSprite();
	s.car.anime = new LAnimation(s.car,data,li);
	s.addChild(s.car);
	s.car.rotate = -25;
	s.car.startX = 190;
	s.car.startY = 0;
	s.car.setX = function(x){
		s.car.trueX = x;
		s.car.x = x - s.car.getWidth();
		s.car.y = 388 - x*1.41/3.20;
	}
	s.car.jump = false;
	s.car.jumpV = 70;
	s.car.jumpG = -20;
	s.car.jumpS = 80;
	s.car.setJump = function(){
		var t = (Date.now() - this.jumpS)/100;
		var ss = this.jumpV*t + 1/2*this.jumpG*t*t;
		if(ss<=0){
			this.jump = false;
			this.y = this.startY;
		}else
			this.y = this.startY - ss;
		//console.log(t,ss,this.y,this.startY);
	}
	s.car.setX(s.car.startX);
	//s.car.addEventListener(LMouseEvent.MOUSE_MOVE,s.onMove);
	//s.car.addEventListener(LMouseEvent.MOUSE_UP,s.onUp);
	//s.car.addEventListener(LMouseEvent.MOUSE_OUT,s.onUp);
	s.addEventListener(LMouseEvent.MOUSE_MOVE,s.Move);
	s.addEventListener(LMouseEvent.MOUSE_UP,s.Up);
	//添加失败成功的框
	bitmap = new LBitmap(new LBitmapData(list["win"]));
	s.win = new LSprite();
	s.win.addChild(bitmap);
	s.addChild(s.win);
	s.win.x = (LGlobal.width-s.win.getWidth())/2;
	s.win.y = (LGlobal.height-s.win.getHeight())/2;
	s.win.visible = false;
	s.win.addEventListener(LMouseEvent.MOUSE_UP,function(){
		s.win.visible = false;
		Game.overGame();
	});
	//添加失败的界面
	bitmap = new LBitmap(new LBitmapData(list["lose"]));
	s.lose = new LSprite();
	s.lose.addChild(bitmap);
	s.addChild(s.lose);
	s.lose.x = (LGlobal.width-s.lose.getWidth())/2;
	s.lose.y = (LGlobal.height-s.lose.getHeight())/2;
	s.lose.visible = false;
	s.lose.addEventListener(LMouseEvent.MOUSE_UP,function(){
		s.lose.visible = false;
		Game.overGame();
	});
	//添加速度表盘
	s.speedClock = new ClockSprite(list);
	s.speedClock.x = 174;
	s.speedClock.y = 427;
	s.addChild(s.speedClock);
	//添加时间的表盘
	s.timeClock = new ClockSprite(list);
	s.timeClock.x = 257;
	s.timeClock.y = 427;
	s.addChild(s.timeClock);
	//添加石头
	s.stone = new StoneSprite(list);
	s.addChild(s.stone);
	//添加帧事件
	s.addEventListener(LEvent.ENTER_FRAME,s.playing);
}
PlayingSprite.prototype.shanOnFrame = function(s){
	var shanSpeedX = 2 , shanSpeedY = 0;
	if(s.x<=-LGlobal.width+shanSpeedX){
		s.x = 0;
		s.y = 200;
	}else{
		s.x -= shanSpeedX;
		s.y += shanSpeedY;
	}
}
PlayingSprite.prototype.poOnFrame = function(s){
	var rate = (Math.random()*1+8)/10;
	Game.playingLayer.getSpeed = Game.playingLayer.maxSpeed*rate;
	var poSpeedX = Game.playingLayer.getSpeed;
	var poSpeedY=1.41/3.20*poSpeedX;
	if(s.x<=LGlobal.width - s.getWidth()+poSpeedX){
		s.x = -5;
		s.y = 100+5/3.20*1.41;
	}else{
		s.x -= poSpeedX;
		s.y += poSpeedY;
		Game.playingLayer.getScore += parseInt(poSpeedX);
	}
}
PlayingSprite.prototype.yunOnFrame = function(s){
	var poSpeedX = 1;
	if(s.x<=LGlobal.width - s.getWidth()+poSpeedX){
		s.x = 0;
	}else{
		s.x -= poSpeedX;
	}
}
PlayingSprite.prototype.setScore = function(n,a,r){
	var s = this;
	if(r){
		s.getScore = 0;
	}else if(a){
		s.getScore += n;
	}else{
		s.getScore = n;
	}
	s.getScore = Math.floor(s.getScore);
	s.score.text = ""+s.getScore;
	s.score.x = 100 - s.score.getWidth();
}

PlayingSprite.prototype.playing = function(s){
	if(Date.now()-s.life>=s.startTime)	s.status = "over";
	if("over"==s.status){
		Game.getScore = s.getScore;
		Game.share();
		s.removeEventListener(LEvent.ENTER_FRAME,s.playing);
		if(Game.getCookieOneDay("cookieFightNumber")>=1 && Game.inFightScore){
			if(Game.getScore>Game.inFightScore)
				s.win.visible = true;
			else
				s.lose.visible = true;
			s.shan.removeEventListener(LEvent.ENTER_FRAME,s.shanOnFrame);
			s.po.removeEventListener(LEvent.ENTER_FRAME,s.poOnFrame);
			s.removeEventListener(LMouseEvent.MOUSE_DOWN,s.jump);
			console.log("playing inFight");
		}else{
			console.log("playing overGame");
			Game.incCookieOneDay("cookieGameNumber");
			Game.overGame();
		}
	}else if("drag"==s.status){
		s.car.anime.onframe();
		s.setScore(s.getScore);
	}else if("move"==s.status){
		s.getSpeed = s.getSpeed + 0.1 <= s.maxSpeed ? s.getSpeed + 0.1 : s.maxSpeed;
		var trueX = s.car.trueX+s.getSpeed;
		if(trueX<s.car.startX){
			s.car.setX(trueX);
		}else{
			s.status = "climb";
			s.car.startY = s.car.y;
			s.maxSpeed = 10;
			s.shan.addEventListener(LEvent.ENTER_FRAME,s.shanOnFrame);
			s.po.addEventListener(LEvent.ENTER_FRAME,s.poOnFrame);
			s.stone.addEventListener(LEvent.ENTER_FRAME,s.stone.moving);
			s.addEventListener(LMouseEvent.MOUSE_DOWN,s.jump);
		}
		s.getScore = s.car.trueX;
		s.car.anime.onframe();
		s.setScore(s.getScore);
		s.speedClock.setPercent((s.getSpeed-1)/s.maxSpeed);
	}else if("climb"==s.status){
		s.car.anime.onframe();
		s.setScore(s.getScore);
		s.speedClock.setPercent(s.getSpeed/s.maxSpeed);
		if(s.car.jump){
			s.car.setJump();
		}
		if(s.stone.knock(s.car)){
			console.log("knock");
			s.status = "over";
		}
	}else if("pause"==status){

	}
	
}
PlayingSprite.prototype.jump = function(e){
	var s = Game.playingLayer;
	if(!s.car.jump){
		s.car.jump = true;
		s.car.jumpS = Date.now();
	}	
}
PlayingSprite.prototype.carStartGo = function(){
	var s = Game.playingLayer;
	//s.car.removeEventListener(LMouseEvent.MOUSE_MOVE,s.onMove);
	//s.car.removeEventListener(LMouseEvent.MOUSE_UP,s.onUp);
	//s.car.removeEventListener(LMouseEvent.MOUSE_OUT,s.onUp);
	s.removeEventListener(LMouseEvent.MOUSE_MOVE,s.Move);
	s.removeEventListener(LMouseEvent.MOUSE_UP,s.Up);
	s.status = "move";
	s.startTime = Date.now();
	s.timeClock.setGo(s.life);
}
PlayingSprite.prototype.onMove = function(e){
	var s = Game.playingLayer;
	if(s.timeoutHandle)
		clearTimeout(s.timeoutHandle);
	if(s.car.trueX<30){
		s.carStartGo();
	}else{
		s.status = "drag";
		s.car.setX(s.car.trueX-1);
		if(!s.timeoutHandle)
			s.timeoutHandle = setTimeout(function(){Game.playingLayer.carStartGo()},300);
	}
}
PlayingSprite.prototype.onUp = function(e){
	var s = Game.playingLayer;
	s.carStartGo();
}

PlayingSprite.prototype.Move = function(e){
	var x = e.selfX, y = e.selfY;
	var s = Game.playingLayer;
	//如果点在车的附近的范围,就进行移动
	if(s.car.trueX<30){
		s.carStartGo();
	}else if(x>s.car.x-20 && x<s.car.x+s.car.getWidth()+20 && y>s.car.y-20 && y<s.car.y+s.car.getHeight()+20){
		s.status = "drag";
		s.car.setX(s.car.trueX-5);
	}
}
PlayingSprite.prototype.Up = function(e){
	var s = Game.playingLayer;
	s.carStartGo();
}