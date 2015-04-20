function StoneSprite(list){
	base(this,LSprite,[]);
	var s = this;
	s.img  = list['stone'];
	s.originalX = LGlobal.width + 50;
	s.originalY = 100+89;
}
StoneSprite.prototype.add = function(){
	var s = this;
	var bitmap = new LBitmap(new LBitmapData(s.img));
	var stone = new LSprite();
	stone.addChild(bitmap);
	stone.x = s.originalX;
	stone.y = s.originalY;
	s.addChild(stone);
}
StoneSprite.prototype.moving = function(s){
	var max = 0;
	for(var i=s.childList.length-1;i>=0;i--){
		max = s.childList[i].x > max ? s.childList[i].x : max;
		if(s.childList[i].x<-s.childList[i].getWidth()){
			s.removeChild(s.childList[i]);
		}else{
			s.childList[i].x -= Game.playingLayer.getSpeed;
			s.childList[i].y += Game.playingLayer.getSpeed*1.41/3.20;
		}
	}
	var random =  Math.random();
	if(random>0.3 && (s.childList.length==0 || 90==max)){
		s.add();
	}	
	//console.log(random,s.childList.length,max);
}
StoneSprite.prototype.knock = function(o){
	//碰撞简化为圆与线段的碰撞,再简化为线段三点是否在圆内
	var pArr = [
		[ o.x + 17 , o.y + o.getHeight() ],
		[ o.x + o.getWidth()/2 + 10 , o.y + o.getHeight()/2 - 10 ],
		[ o.x + o.getWidth() , o.y]
	];
	//console.log(pArr);
	var s = this;
	for(var i=s.childList.length-1;i>=0;i--){
		var r = 15 , r2 = 225 , px = s.childList[i].x + r - 5 , py = s.childList[i].y + r + 8;
		for(var j=0;j<3;j++){
			var d1 = pArr[j][0] - px;
			var d2 = pArr[j][1] - py;
			if(d1*d1+d2*d2 < r2){
				console.log(i,j,px,py,pArr);
				return true;
			}				
		}
	}
	return false;
}