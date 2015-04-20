function CloudSprite(list,pre,n){
	base(this,LSprite,[]);
	var s = this;
	var w = LGlobal.width/n;
	for(var i=0;i<n;i++){
		var name = pre+i;
		var bitmap = new LBitmap(new LBitmapData(list[name]));
		var sprite = new LSprite();
		sprite.addChild(bitmap);
		sprite.x = i*w + Math.floor(Math.random()*10);
		sprite.y = Math.floor(Math.random()*30+10);
		s.addChild(sprite);
	}
	s.addEventListener(LEvent.ENTER_FRAME,s.onFrame);
}
CloudSprite.prototype.onFrame = function(s){
	for(var i=0,l=s.childList.length;i<l;i++){
		s.childList[i].x -= 1;
		s.childList[i].y += Math.random()>0.5 ? 0.1 : -0.1;
		if(s.childList[i].x<-s.childList[i].getWidth()-2)
			s.childList[i].x = LGlobal.width;
	}
}