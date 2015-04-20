function ClockSprite(list,startPoint,endPoint,n){
	base(this,LSprite,[]);
	var s = this;
	s.startPoint = startPoint ? startPoint : 70;
	s.endPoint = endPoint ? endPoint : 300;
	n = n ? n : 5;
	s.range = (s.endPoint-s.startPoint)/n;
	s.range = 1;
	//添加表盘
	var bitmap = new LBitmap(new LBitmapData(list["clock"]));	
	s.clock = new LSprite();
	s.clock.addChild(bitmap);
	s.addChild(s.clock);
	//添加针
	bitmap = new LBitmap(new LBitmapData(list["clockPoint"]));	
	s.clockPoint = new LSprite();
	s.clockPoint.addChild(bitmap);
	s.addChild(s.clockPoint);
	s.clockPoint.x = 26;
	s.clockPoint.y = 26;
	s.clockPoint.rotate = s.startPoint;
}
ClockSprite.prototype.setPercent = function(n){
	if(!n || 0==n)	return;
	var s = this;
	s.clockPoint.rotate = (s.endPoint - s.startPoint)*n + s.startPoint;
}
ClockSprite.prototype.setGo = function(life){
	var s = this;
	s.life = life;
	s.overTime = false;
	s.startTime = Date.now();
	s.addEventListener(LEvent.ENTER_FRAME,s.onTime);
}
ClockSprite.prototype.onTime = function(s){
	if(Date.now()-s.startTime>=s.life){
		s.overTime = true;
		s.removeEventListener(LEvent.ENTER_FRAME,s.onTime);
	}else{
		s.clockPoint.rotate = (s.endPoint - s.startPoint)*(Date.now()-s.startTime)/s.life+s.startPoint;
	}
}