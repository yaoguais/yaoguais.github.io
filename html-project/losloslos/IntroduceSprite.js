function IntroduceSprite(list,callback){
	base(this,LSprite,[]);
	var s = this;
	s.callback = callback;
	//添加背景
	var bitmap = new LBitmap(new LBitmapData(list["introBg"]));	
	s.background = new LSprite();
	s.background.addChild(bitmap);
	s.addChild(s.background);
	//添加左下角的微信按钮
	bitmap = new LBitmap(new LBitmapData(list["weixinBtn"]));
	s.weixinBtn = new LSprite();
	s.weixinBtn.addChild(bitmap);
	s.weixinBtn.x = 10;
	s.weixinBtn.y = LGlobal.height - 10 - s.weixinBtn.getHeight();
	s.addChild(s.weixinBtn);
	s.weixinBtn.addEventListener(LMouseEvent.MOUSE_UP,function(){
		window.location.href = 'http://www.baidu.com';
	});
	//添加右下角的商城按钮
	bitmap = new LBitmap(new LBitmapData(list["shopBtn"]));
	s.shopBtn = new LSprite();
	s.shopBtn.addChild(bitmap);
	s.shopBtn.x = LGlobal.width - 10 - s.shopBtn.getWidth();
	s.shopBtn.y = LGlobal.height - 10 - s.shopBtn.getHeight();
	s.addChild(s.shopBtn);
	s.shopBtn.addEventListener(LMouseEvent.MOUSE_UP,function(){
		window.location.href = 'http://www.qq.com';
	});
	//添加开始游戏按钮
	bitmap = new LBitmap(new LBitmapData(list["kaishiyouxi"]));
	s.kaishiyouxi = new LSprite();
	s.kaishiyouxi.addChild(bitmap);
	s.kaishiyouxi.x = (LGlobal.width - s.kaishiyouxi.getWidth())/2;
	s.kaishiyouxi.y = 284;
	s.addChild(s.kaishiyouxi);
	s.kaishiyouxi.addEventListener(LMouseEvent.MOUSE_UP,function(){
		s.removeAllChild();		
		LGlobal.stage.removeAllChild();
		s.callback();
	});
	//添加游戏说明的面板
	bitmap = new LBitmap(new LBitmapData(list["introPanel"]));
	s.introPanel = new LSprite();
	s.introPanel.addChild(bitmap);
	s.introPanel.x = (LGlobal.width - s.introPanel.getWidth())/2;
	s.introPanel.y = (LGlobal.height - s.introPanel.getHeight())/2;
	s.introPanel.visible = false;
	s.introPanel.addEventListener(LMouseEvent.MOUSE_UP,function(){
		s.introPanel.visible = false;
	});
	//添加游戏说明的按钮
	bitmap = new LBitmap(new LBitmapData(list["shuoming"]));
	s.shuoming = new LSprite();
	s.shuoming.addChild(bitmap);
	s.shuoming.x = (LGlobal.width - s.shuoming.getWidth())/2;
	s.shuoming.y = 347;
	s.addChild(s.shuoming);
	s.shuoming.addEventListener(LMouseEvent.MOUSE_UP,function(){
		s.introPanel.visible = true;
	});
	//添加游戏奖励的面板
	bitmap = new LBitmap(new LBitmapData(list["rewardPanel"]));
	s.rewardPanel = new LSprite();
	s.rewardPanel.addChild(bitmap);
	s.rewardPanel.x = (LGlobal.width - s.rewardPanel.getWidth())/2;
	s.rewardPanel.y = (LGlobal.height - s.rewardPanel.getHeight())/2;
	s.rewardPanel.visible = false;
	s.rewardPanel.addEventListener(LMouseEvent.MOUSE_UP,function(){
		s.rewardPanel.visible = false;
	});
	//添加游戏奖励的按钮
	bitmap = new LBitmap(new LBitmapData(list["jiangli"]));
	s.jiangli = new LSprite();
	s.jiangli.addChild(bitmap);
	s.jiangli.x = (LGlobal.width - s.jiangli.getWidth())/2;
	s.jiangli.y = 386;
	s.addChild(s.jiangli);
	s.jiangli.addEventListener(LMouseEvent.MOUSE_UP,function(){
		s.rewardPanel.visible = true;
	});
	//最后添加面板
	s.addChild(s.introPanel);
	s.addChild(s.rewardPanel);
}