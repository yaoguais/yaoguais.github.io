/*
为微信特别书写的
原始左边在左上角 由于微信对横版的支持较差 所以写一个左边转换规则
*/
/***************************************************************************************************/
var __window = (function(){
	var w = 999999,h = 999999;
	if(typeof window.innerWidth == "number" && window.innerWidth<w){
		w = window.innerWidth;
		h = window.innerHeight;
	}
	if(document.documentElement && typeof document.documentElement.clientWidth == "number" && document.documentElement.clientWidth<w){
		w = document.documentElement.clientWidth;
		h = document.documentElement.clientHeight;
	}
	if(document.body && typeof document.body.clientWidth == "number" && document.body.clientWidth<w){
		w = document.body.clientWidth;
		h = document.body.clientHeight;
	}
	return {
		width:w,
		height:h
	}
})();
var Event  = (function(){
	function E(){
		this.events = [];
		this.event = null;
		this.lastMouse={x:0,y:0};
		this.lastTouch={x:0,y:0};
		this.lastDevice = {x:0,y:0,z:0};
	}
	E.prototype.addEvent = function(o,t,c){
		if(!this.events)
			this.events = [];
		this.events.push({
			"object":o,
			"type":t,
			"callback":c
		});
	}
	E.prototype.removeEvent = function(o,t){
		for(var i=0,l=this.events.length;i<l;i++)
			if((o && this.events[i].object===o) || (t && this.events[i].type==t))
				this.events[i].splice(i,1);
	}
	E.prototype.removeAllEvent = function(){
		this.events = null;
		this.events = [];
	}
	E.prototype.executeMouse = function(t){
		var p = this.parseMouse();
		for(var i=this.events.length-1;i>=0;i--)
			if(t && this.events[i].type==t && this.events[i].object.visible && PC.isPointInPath(p.x,p.y,this.events[i].object))
				if(!this.events[i].callback(p.x,p.y,this.events[i].object))
					break;
		this.lastMouse = p;
	}
	E.prototype.parseMouse = function(){
		var x,y,e = this.event;
		if(e.pageX || e.pageY){
			x = e.pageX;
			y = e.pageY;
		}else{
			x = e.clientX + document.body.scrollLeft - document.body.clientLeft;
			y = e.clientY + document.body.scrollTop - document.body.clientTop;
		}
		return {
			x:y*Global.scaleX,
			y:(__window.width-x)*Global.scaleY
		};
	}
	E.prototype.executeTouch = function(t){
		var p = this.parseTouch();
		if(!p || p==null)
			return;
		for(var i=this.events.length-1;i>=0;i--)
			if(t && this.events[i].type==t && this.events[i].object.visible && PC.isPointInPath(p.x,p.y,this.events[i].object))
				if(!this.events[i].callback(p.x,p.y,this.events[i].object,p.s))
					break;
		this.lastTouch = p;
	}
	E.prototype.parseTouch = function(){
		var e = this.event.touches;
		if(e.length<=0)
			return null;
		return {
			x:e[0].pageY*Global.scaleX,
			y:(__window.width-e[0].pageX)*Global.scaleY,
			s:e
		};
	}
	E.prototype.executeDevice = function(t){
		var p = this.parseDevice();
		for(var i=this.events.length-1;i>=0;i--)
			if(t && this.events[i].type==t && this.events[i].object.visible)
				if(this.events[i].callback(p.x,p.y,p.z,this.events[i].object))
					break;
		this.lastDevice = p;
	}
	E.prototype.parseDevice = function(){
		var e = this.event;
		return {
			x:e.accelerationIncludingGravity.x,
			y:e.accelerationIncludingGravity.y,
			z:e.accelerationIncludingGravity.z
		};
	}
	E.prototype.executeFrame = function(t){
		for(var i=this.events.length-1;i>=0;i--)
			if(t && this.events[i].type==t && this.events[i].object.visible)
				if(this.events[i].callback(this.events[i].object))
					break;
	}
	return new E();
})();

/***************************************************************************************************/
var Global = (function(){
	function G(){
		this.canvas = null,
		this.context = null;
		this.container = null;
		this.width = null;
		this.height = null;
		this.scaleX = 1.0;
		this.scaleY = 1.0;
		this.childList = [];
		this.speed = 30;
		this.intervalHanle = null;
		this.showNumber = 0;
		this.debugMsg = "";
	}
	G.prototype.createCanvas = function(id,w,h){
		this.container = document.getElementById(id);
		this.canvas = document.createElement("canvas");
		this.context = this.canvas.getContext("2d");
		this.height = this.canvas.width = w;
		this.width = this.canvas.height = h;		
		this.container.style.width = this.canvas.style.width = __window.width+"px";
		this.container.style.height = this.canvas.style.height = __window.height+"px";
		this.scaleX = h/__window.height;
		this.scaleY = w/__window.width;
		this.container.appendChild(this.canvas);
		this.addEvent();
	}
	G.prototype.addEvent = function(){
		this.canvas.addEventListener('mousedown',function(e){ Event.event = e || window.event; Event.executeMouse('mousedown');},false);
		this.canvas.addEventListener('mousemove',function(e){ Event.event = e || window.event; Event.executeMouse('mousemove');},false);
		this.canvas.addEventListener('mouseup',function(e){ Event.event = e || window.event; Event.executeMouse('mouseup');},false);
		this.canvas.addEventListener('mouseover',function(e){ Event.event = e || window.event; Event.executeMouse('mouseover');},false);
		this.canvas.addEventListener('mouseout',function(e){ Event.event = e || window.event; Event.executeMouse('mouseout');},false);
		this.canvas.addEventListener('touchstart',function(e){ Event.event = e || window.event; Event.executeTouch('touchstart');},false);
		this.canvas.addEventListener('touchmove',function(e){ Event.event = e || window.event; Event.executeTouch('touchmove');},false);
		this.canvas.addEventListener('touchend',function(e){ Event.event = e || window.event; Event.executeTouch('touchend');},false);
		window.addEventListener('devicemotion',function(e){ Event.event = e || window.event; Event.executeDevice('devicemotion');},false);
	}
	G.prototype.addChild = function(c){
		this.childList.push(c);
	}
	G.prototype.removeChild = function(c,n){
		if(typeof c == "number"){
			n = n || 1;
			this.childList.splice(c,n);
		}else if(typeof c == "object"){
			for(var i=0,l=this.childList.length;i<l;i++){
				if(this.childList[i]===c){
					this.childList.splice(i,1);
					break;
				}
			}
		}else{
			this.childList = null;
			this.childList = [];
		}
	}
	G.prototype.setSpeed = function(s){
		if(s!=this.speed){
			this.offFrame();
			this.onFrame();
		}
	}
	G.prototype.onFrame = function(){
		var s = this;
		this.offFrame();
		this.intervalHanle = setInterval(function(){
			Event.executeFrame("onframe");
			s.show();
		},this.speed);
	}
	G.prototype.offFrame = function(){
		if(this.intervalHanle){
			clearInterval(this.intervalHanle);
			this.intervalHanle = null;
		}
	}
	G.prototype.show = function(){
		this.context.rotate(90*Math.PI/180);
		this.context.clearRect(PC.x(0,0),PC.y(0,0),this.width,this.height);
		for(var i=0,l=this.childList.length;i<l;i++){
			if(this.childList[i].visible && PC.inCanvas(this.childList[i].x,this.childList[i].y,this.childList[i].width,this.childList[i].height)){
				this.childList[i].show();
				this.showNumber += 1;
			}
		}
		this.showDebug();
		this.context.rotate(270*Math.PI/180);
	}
	G.prototype.showDebug = function(){
		if(this.debug){
			this.context.fillStyle = "#FFFFFF";
			this.context.font = "normal normal bold 30px Microsoft YaHei";
			this.context.fillText(this.showNumber,PC.x(50,50),PC.y(50,50));
			if(this.debugMsg)
				this.context.fillText(this.debugMsg.replace(/^(\s+)|(\s+)$/,""),PC.x(50,80),PC.y(50,80));
		}
	}
	return new G;
})();
/***************************************************************************************************/
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
/***************************************************************************************************/
var Load = (function(){
	function L(){
		this.list = [];
	}
	L.prototype.exec = function(l,b,c){
		if(this.list.length==0){
			this.list = l;
		}else{
			for(var i=0;i<l.length;i++)
				this.list.push(l[i]);
		}
		this.update = b;
		this.completion = c;
		this.index = 0;
		this.length = this.list.length;
		this.data = {};
		this.load();
	}
	L.prototype.loadSound = function(f,c){
		var xmlhttp = Ajax.getXmlhttp();
		xmlhttp.open("GET",f,true);
		xmlhttp.responseType = "arraybuffer";
		xmlhttp.onload = function(){
			c(xmlhttp.response);
		}
		xmlhttp.send();
	}
	L.prototype.callLoad = function(){
		var s = this;
		s.index++;
		if(typeof s.update == "function")
			s.update(s.index/s.length);
		s.load();
	}
	L.prototype.load = function(){
		var s = this;
		if(s.index>=s.length){
			if(typeof s.completion == "function")
				s.completion(s.data);
			return;
		}else if(s.index==0){
			if(typeof s.update == "function")
				s.update(0);
		}
		var c = s.list[s.index];
		if(c.type=="js"){
			var d = document.createElement('script');
			d.type = 'text/javascript';
			d.src = c.path;
			document.documentElement.getElementsByTagName("head")[0].appendChild(d);
			d.onload = function(){
				s.callLoad();
			}
		}else if(c.type=="sound"){
			s.loadSound(c.path,function(e){
			 	s.data[c.key] = e;
				s.callLoad();
			});
		}else{
			var d = new Image();
			d.src = c.path;
			d.onload = function(){
				s.data[c.key] = d;
				s.callLoad();
			}
		}
	}
	return new L();
})();
/***************************************************************************************************/
/*PointConvert*/
var PC = (function(){
	function P(){

	}
	P.prototype.x = function(x,y){
		return x;
	}
	P.prototype.y = function(x,y){
		return y-Global.height;
	}
	P.prototype.inCanvas = function(x,y,w,h){
		return 0<=x+w && x<=Global.width && 0<=y+h && y<=Global.height;
	}
	P.prototype.isPointInPath = function(x,y,obj){
		if(obj.x<x && x<obj.x+obj.width && obj.y<y && y<obj.y+obj.height)
			return true;
		else
			return false;
	}
	return new P();
})();
/***************************************************************************************************/
function ImageSprite(i,x,y,w,h){
	this.image = i;
	this.x = x;
	this.y = y;
	if(w && h){
		this.width = w;
		this.height = h;
	}else if(this.image instanceof Image){
		this.width = this.image.width;
		this.height = this.image.height;
	}
	this.visible = true;
}
ImageSprite.prototype.show = function(){
	if(!(this.image instanceof Image))
		return;	
	var s = this;
	var x = PC.x(s.x,s.y);
	var y = PC.y(s.x,s.y);
	Global.context.drawImage(s.image,x,y,s.width,s.height);
}
/***************************************************************************************************/
function TextSprite(t,x,y,f,fs){
	this.x = x;
	this.y = y;
	this.size = 12;
	if(typeof f == "string")
		this.setFont(f);
	if(typeof t == "string")
		this.setText(t);
	this.fillStyle = fs;
	this.visible = true;
}
TextSprite.prototype.setText = function(t){
	this.text = t;
	Global.context.save();
	if(this.font)
		Global.context.font = this.font;
	this.width = Global.context.measureText(this.text).width;
	Global.context.restore();
}
TextSprite.prototype.setFont = function(f){
	this.font = f;
	if(this.font){
		var size = this.font.match(/\s(\d+)px/);
		if(typeof size[1] != "undefined"){
			this.size = parseInt(size[1]);
			this.height = this.size;
		}			
	}
}
TextSprite.prototype.setCenter = function(t){
	if(t && t!=this.text)
		this.setText(t);
	this.x = (Global.width-this.width)*0.5;
}
TextSprite.prototype.show = function(){
	var s = this;
	var x = PC.x(s.x,s.y);
	var y = PC.y(s.x,s.y+s.height);
	Global.context.save();
	if(s.font)
		Global.context.font = s.font;
	if(s.fillStyle)
		Global.context.fillStyle = s.fillStyle;
	Global.context.fillText(s.text,x,y);
	Global.context.restore();
}
/***************************************************************************************************/
function MultiTextSprite(t,x,y,f,fs,c,w,m){
	this.childList = null;
	this.x = x;
	this.y = y;
	this.font = f;
	this.fillStyle = fs;
	this.center = c || true;
	this.size = this.parseSize(f);
	this.margin = m || 0;
	this.height = 0;
	this.width = w || Global.width;
	this.visible = true;
	this.text = this.parseText(t);
}
MultiTextSprite.prototype.parseSize = function(f){
	var size = f.match(/\s(\d+)px/);
	if(typeof size[1] != "undefined")
		return parseInt(size[1]);
	else
		return 12;
}
MultiTextSprite.prototype.parseText = function(word){
	this.childList = null;
	this.childList = [];
	var text = word.split("\n");
	this.height = text.length*(this.size+this.margin)-this.margin;
	for(var i=0,l=text.length;i<l;i++){
		var t = new TextSprite(text[i],this.x,this.y+i*(this.size+this.margin),this.font,this.fillStyle);
		if(this.center)
			t.x = this.x+(this.width-t.width)*0.5;
		if(t.width>this.width)
			this.width = t.width;
		this.childList.push(t);
	}
	return word;
}
MultiTextSprite.prototype.show = function(){
	var s = this;
	for(var i=0,l=this.childList.length;i<l;i++)
		this.childList[i].show();
}
/***************************************************************************************************/
function RectSprite(x,y,w,h,fs,ss){
	this.x = y,this.y=y,this.width=w,this.height=h,this.fillStyle=fs,this.strokeStyle=ss;
	this.visible = true;
}
RectSprite.prototype.show = function(){
	var s = this;
	var x = PC.x(s.x,s.y);
	var y = PC.y(s.x,s.y);
	Global.context.save();
	if(s.fillStyle){
		Global.context.fillStyle = s.fillStyle;
		Global.context.fillRect(x,y,s.width,s.height);
	}		
	if(s.strokeStyle){
		Global.context.strokeStyle = s.strokeStyle;
		Global.context.strokeRect(x,y,s.width,s.height);
	}
	Global.context.restore();
}
/***************************************************************************************************/
var WeixinHelper = {
		appid:null,
		img:null,
		width:null,
		height:null,
		url:null,
		desc:null,
		title:null,
		friend: function(){
				WeixinJSBridge.invoke('sendAppMessage',{
					'appid': WeixinHelper.appid || '',
					'img_url': WeixinHelper.img,
					'img_width': WeixinHelper.width || 100,
					'img_height': WeixinHelper.height || 100,
					'link': WeixinHelper.url || window.location.href,
					'desc': WeixinHelper.desc || document.title,
					'title': WeixinHelper.title || document.title
					}, function(res){
					_report('send_msg', res.err_msg);
				});
		},
		pengyou: function(){
				WeixinJSBridge.invoke('shareTimeline',{
					'img_url': WeixinHelper.img,
					'img_width': WeixinHelper.width || 100,
					'img_height': WeixinHelper.height || 100,
					'link': WeixinHelper.url || window.location.href,
					'desc': WeixinHelper.desc || document.title,
					'title': WeixinHelper.title || document.title,
					}, function(res) {
						_report('timeline', res.err_msg);
				});
		},
		weibo: function(){
				WeixinJSBridge.invoke('shareWeibo',{
					  'content': WeixinHelper.desc || document.title,
					  'url': WeixinHelper.url || window.location.href,
					  }, function(res) {
					  _report('weibo', res.err_msg);
				});
		}
};
document.addEventListener('WeixinJSBridgeReady', function onBridgeReady() {
	WeixinJSBridge.on('menu:share:appmessage', function(argv){
		WeixinHelper.friend();
	});
	WeixinJSBridge.on('menu:share:timeline', function(argv){
		WeixinHelper.pengyou();
	});
	WeixinJSBridge.on('menu:share:weibo', function(argv){
		WeixinHelper.weibo();
   });
}, false);
/***************************************************************************************************/
var LoadingSprite = (function(){
	function L(){
		this.visible = true;
		this.progress = 0;
		this.background = "#000000";
		this.borderColor = "#00FFFF";
		this.innerColor = "#990033";
		this.getColor = "#FFFFFF";
		this.labelColor = "#FFFFFF";
		this.inited = false;
	}
	L.prototype.init = function(b,d,i,p,l){
		this.background = b || "#000000";
		this.borderColor = d || "#00FFFF";
		this.innerColor = i || "#990033";
		this.getColor = p || "#FFFFFF";
		this.labelColor = l || "#FFFFFF";
		this.height = Global.height*0.1;
		if(this.height>5)
			this.height = 5;
		this.width = Math.floor(Global.width*0.75);
		this.x = (Global.width-this.width)*0.5;
		this.y = (Global.height-this.height)*0.5;
		this.inited = true;
	}
	L.prototype.update = function(p){
		if(!this.inited)
			this.init();
		this.progress = p;
	}
	L.prototype.show = function(){
		var s = this;
		var c = Global.context;
		c.save();
		var x1 = PC.x(0,0);
		var y1 = PC.y(0,0);
		if(s.background instanceof Image){
			c.drawImage(s.background,x1,y1,Global.width,Global.height);
		}else{
			c.fillStyle = s.background;
			c.fillRect(x1,y1,Global.width,Global.height);
		}
		var x = PC.x(s.x,s.y);
		var y = PC.y(s.x,s.y);
		c.fillStyle = s.borderColor;
		c.fillRect(x,y,s.width,s.height);
		var borderWidth = 3;
		if(s.progress>0){
			c.fillStyle = s.getColor;
			c.fillRect(x+borderWidth,y+borderWidth,(s.width-2*borderWidth)*s.progress,s.height-2*borderWidth);
		}
		if(s.progress<100){
			c.fillStyle = s.innerColor;
			c.fillRect(x+borderWidth+(s.width-2*borderWidth)*s.progress,y+borderWidth,(s.width-2*borderWidth)*(1-s.progress),s.height-2*borderWidth);
		}
		var size = s.height*2;
		c.fillStyle = s.labelColor;
		c.font = "normal normal bold "+size+"px Microsoft YaHei";
		c.fillText(Math.floor(s.progress*100)+"%",x+s.width*0.5,y-2);
		c.restore();
	}
	return new L();
})();
/***************************************************************************************************/
function FrameSprite(i,x,y,w,h,d,l,s,p,o){
	this.image = i;
	this.x = x;
	this.y = y;
	this.visible = true;
	this.width = w;
	this.height = h;
	this.list = l;
	this.colIndex = 0;
	this.rowIndex = 0;
	this.interval = d;
	this.lastTime = 0;
	this.asc = true;
	this.stop = s || false;
	this.playOnce = p || false;
	this.loopNumber = o || -1;
	this.parseList();
}
FrameSprite.prototype.parseList = function(){
	var s = this;
	if(!s.list){
		var cols = s.image.width/s.width;
		var rows = s.image.height/s.height;
		s.list = [];
		for(var i=0;i<rows;i++){
			var c = [];
			for(var j=0;j<cols;j++){
				c.push({
					x:j*s.width,
					y:i*s.height,
					width:s.width,
					height:s.height
				});
			}
			s.list.push(c);
		}
	}
}
FrameSprite.prototype.setRowIndex = function(r){
	if(0<=r && r<this.list.length)
		this.rowIndex = r;
	else if(r==-1)
		this.rowIndex = (this.rowIndex+1)%this.list.length;
	else if(r==-2)
		this.rowIndex = (this.rowIndex-1+this.list.length)%this.list.length;
}
FrameSprite.prototype.show = function(){
	var s = this;
	s.colIndex = (s.colIndex+s.list[s.rowIndex].length)%s.list[s.rowIndex].length;
	var n = s.list[s.rowIndex][s.colIndex];
	if(s.loopNumber==0 || !n){
		s.visible = false;
		return;
	}
	var x = PC.x(s.x,s.y);
	var y = PC.y(s.x,s.y);
	Global.context.drawImage(s.image,n.x,n.y,n.width,n.height,x,y,n.width,n.height);
	if(s.interval){
		if(Date.now()-s.lastTime<s.interval)
			return;
		else
			s.lastTime = Date.now();
	}
	if(s.stop)
		return;
	else if(s.asc)
		s.colIndex = (s.colIndex+1)%s.list[s.rowIndex].length;
	else
		s.colIndex = (s.colIndex-1+s.list[s.rowIndex].length)%s.list[s.rowIndex].length;
	if(s.playOnce && s.colIndex==0)
		s.stop = true;
	if(s.loopNumber>0 && s.colIndex==0)
		s.loopNumber = s.loopNumber - 1;
}
/***************************************************************************************************/
/*通过客户端创建一个canvas进行拷贝实现原canvas图像的剪裁*/
function ImageData(c,x,y,w,h){
	var cc = document.createElement("canvas");
	cc.setAttribute("width",w);
	cc.setAttribute("height",h);
	var v = cc.getContext("2d");
	var d = c.getImageData(x,y,w,h);
	v.putImageData(d,0,0);
	return cc.toDataURL("image/png");
}
/***************************************************************************************************/
function AudioSound(f,a,i,l){
	var s = this;
	var c = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
	if(!c)
		Global.debugMsg += ' as';
	else
		Global.debugMsg += ' af';
	s.context = new c();
	s.file = f;		
	s.audioBuffer = null;
	s.playAfterLoad = i ? true : false;
	s.loop = l ? true : false;
	s.source = null;
	s.playingNumber = 0;
	if(f)
		Load.loadSound(f,function(e){
			s.arraybuffer = e;
			s.decodeAudioData();
		});
	else{
		s.arraybuffer = a;
		s.decodeAudioData();
	}
}
AudioSound.prototype.decodeAudioData = function(){
	var s = this;			
	s.context.decodeAudioData(s.arraybuffer, function(buffer) {
		s.audioBuffer = buffer;
		if(s.playAfterLoad)
			s.play();
	});
}
AudioSound.prototype.play = function(){
	var s = this;
	if(!s.audioBuffer)
		return;
	s.source = s.context.createBufferSource();
	s.source.buffer = s.audioBuffer;
	s.source.loop = s.loop;
	s.source.connect(s.context.destination);
	if(s.source.start)
		s.source.start(0);
	else
		s.source.noteOn(0);
	s.playingNumber++;
	setTimeout(function(){if(s.playingNumber>0)s.playingNumber--;},s.source.buffer.duration*1000);
}
AudioSound.prototype.stop = function(){
	var s = this;
	if(s.source && s.playingNumber>0)
		try{
			if(s.source.stop)
				s.source.stop(0);
			else
				s.source.noteOff(0);
			s.playingNumber--;
		}catch(e){}		
}
/***************************************************************************************************/
function InputSprite(){
	this.width = 280;
	this.height = 270;
	this.init();
}
InputSprite.prototype.init = function(){
	var str = '<style>\
				.weixinframe_input_background{\
				filter:"progid:DXImageTransform.Microsoft.AlphaImageLoader(sizingMethod=\'scale\')";\
				-moz-background-size:100% 100%;\
				background-size:100% 100%;\
				}\
				#weixinframe_input{\
					position: absolute;\
					left: 0;\
					top: 0;\
					background-image: url("./weixinframe/input_window.png");\
					z-index: 9999;\
					width: 280px;\
					height: 270px;\
					filter:"progid:DXImageTransform.Microsoft.AlphaImageLoader(sizingMethod=\'scale\')";\
					-moz-background-size:100% 100%;\
					background-size:100% 100%;\
				}\
				#weixinframe_input_title{\
					position: absolute;\
					left: 50%;\
					top: 0;\
					width: 87px;\
					height: 29px;\
					line-height: 29px;\
					font-size: 14px;\
					color: #FFFFFF;\
					margin-left: -43px;\
					margin-top: 2px;\
					text-align: center;\
					font-weight: 700;\
				}\
				#weixinframe_input_note1{\
					position: absolute;\
					left: 20px;\
					top: 50px;\
					color: #FFFFFF;\
					font-size: 12px;\
				}\
				#weixinframe_input_note2{\
					position: absolute;\
					left: 20px;\
					top: 80px;\
					color: #FFFFFF;\
					font-size: 12px;\
				}\
				#weixinframe_input_text{\
					position: absolute;\
					left: 20px;\
					top: 110px;\
					font-size: 14px;\
				}\
				#weixinframe_input_text_label{\
					float: left;\
					margin-right: 5px;\
					color: #FFFFFF;\
					height: 20px;\
					line-height: 20px;\
				}\
				#weixinframe_input_text_value{\
					float: left;\
					width: 100px;\
					padding: 1px 2px;\
				}\
				#weixinframe_input_note3{\
					position: absolute;\
					left: 20px;\
					top: 150px;\
					color: #FFFFFF;\
					font-size: 12px;\
				}\
				#weixinframe_input_leftbutton,#weixinframe_input_rightbutton{\
					background-image: url("./weixinframe/input_button.png");\
					width: 72px;\
					height: 24px;\
					position: absolute;\
					top: 210px;\
					color: #FFFFFF;\
					font-size: 12px;\
					font-weight: 700;\
					text-align: center;\
					line-height: 24px;\
					cursor: pointer;\
				}\
				#weixinframe_input_leftbutton{\
					left: 50px;\
				}\
				#weixinframe_input_rightbutton{\
					right: 50px;\
				}\
				</style>\
				<div id="weixinframe_input_title">游戏结束</div>\
				<div id="weixinframe_input_note1">DISTANCE：145</div>\
				<div id="weixinframe_input_note2">恭喜你现在排名200位</div>\
				<div id="weixinframe_input_text">\
					<div id="weixinframe_input_text_label">昵称：</div>\
					<input type="text" id="weixinframe_input_text_value" />\
				</div>\
				<div id="weixinframe_input_note3">继续加油哦</div>\
				<div id="weixinframe_input_leftbutton" class="weixinframe_input_background">再来一次</div>\
				<div id="weixinframe_input_rightbutton" class="weixinframe_input_background">炫耀一下</div>';
	this.object = document.createElement("div");
	this.object.id = "weixinframe_input";
	this.object.style.display = "none";
	this.visible = false;
	this.object.innerHTML = str;
	Global.container.parentNode.appendChild(this.object);
	this.title = document.getElementById("weixinframe_input_title");
	this.note1 = document.getElementById("weixinframe_input_note1");
	this.note2 = document.getElementById("weixinframe_input_note2");
	this.text = document.getElementById("weixinframe_input_text");
	this.label = document.getElementById("weixinframe_input_text_label");
	this.value = document.getElementById("weixinframe_input_text_value");
	this.note3 = document.getElementById("weixinframe_input_note3");
	this.leftButton = document.getElementById("weixinframe_input_leftbutton");
	this.rightButton = document.getElementById("weixinframe_input_rightbutton");
}
InputSprite.prototype.setY = function(y,s){
	this.y = y;
	this.object.style.top = y+"px";
	if(s)
		this.show();
}
InputSprite.prototype.setX = function(x,s){
	this.x = x;
	this.object.style.left = x+"px";
	if(s)
		this.show();
}
InputSprite.prototype.setOriginal = function(s,y){
	this.setX((__window.width-this.width)*0.5,s);
	if(y)
		this.setY(y,s);
}
InputSprite.prototype.show = function(){
	this.object.style.display = "block";
	this.value.focus();
	this.visible = true;
}
InputSprite.prototype.hide = function(){
	this.value.blur();
	this.object.style.display = "none";
	this.visible = false;
}
InputSprite.prototype.setText = function(a,b,c,d,e,f,g,h){
	if(a)
		this.title.innerHTML = a;
	if(b)
		this.note1.innerHTML = b;
	if(c)
		this.note2.innerHTML = c;
	if(d)
		this.label.innerHTML = d;
	if(e)
		this.value.value  = e;
	if(f)
		this.note3.innerHTML = f;
	if(g)
		this.leftButton.innerHTML = g;
	if(h)
		this.rightButton.innerHTML = h;
}
InputSprite.prototype.getValue = function(){
	return this.value.value;
}
InputSprite.prototype.setValue = function(v){
	var o = this.value.value;
	this.value.value = v || "";
	return o;
}
InputSprite.prototype.leftClick = function(f){
	this.leftButton.onclick = f;
}
InputSprite.prototype.rightClick = function(f){
	this.rightButton.onclick = f;
}
/***************************************************************************************************/
Load.list.push({"path":"./weixinframe/input_button.png","key":"input_button"});
Load.list.push({"path":"./weixinframe/input_window2.png","key":"input_window"});
function ShareSprite(x,y){
	this.x = x;
	this.y = y;
	this.width = Load.data["input_window"].width;
	this.height = Load.data["input_window"].height;
	this.back = new ImageSprite(Load.data["input_window"],0,0);
	this.title = new TextSprite("游戏结束",0,0,"normal normal bold 16px Microsoft YaHei","#FFFFFF");
	this.note1 = new TextSprite("you get five",0,0,"normal normal normal 12px Microsoft YaHei","#FFFFFF");
	this.note2 = new TextSprite("thank you",0,0,"normal normal normal 12px Microsoft YaHei","#FFFFFF");
	this.leftBack = new ImageSprite(Load.data["input_button"],0,0);
	this.leftButton = new TextSprite("再来一次",0,0,"normal normal bold 12px Microsoft YaHei","#FFFFFF");
	this.rightBack = new ImageSprite(Load.data["input_button"],0,0);
	this.rightButton = new TextSprite("炫耀一下",0,0,"normal normal bold 12px Microsoft YaHei","#FFFFFF");
	this.hide();
}
ShareSprite.prototype.setOriginal = function(s,y){
	this.x = (__window.height-this.height)*0.5;
	if(y)
		this.setY(y,s);
}
ShareSprite.prototype.setY = function(y,s){
	this.y = y;
	var s = this;
	var x = s.x;
	var y = s.y;
	s.back.x = x;
	s.back.y = y;
	s.title.x = x+120;
	s.title.y = y+8;
	s.note1.x = x+20;
	s.note1.y = y+50;
	s.note2.x = x+20;
	s.note2.y = y+80;
	s.leftBack.x = x+50;
	s.leftBack.y = y+210;
	s.leftButton.x = s.leftBack.x+(s.leftBack.width-s.leftButton.width)*0.5;
	s.leftButton.y = s.leftBack.y+5;
	s.rightBack.x = x+s.width-s.rightBack.width-50;
	s.rightBack.y = s.leftBack.y;
	s.rightButton.x = s.rightBack.x+(s.rightBack.width-s.rightButton.width)*0.5;
	s.rightButton.y = s.leftBack.y+5;
	if(s){
		s.visible = true;
		s.leftBack.visible = true;
		s.rightBack.visible = true;
	}
}
ShareSprite.prototype.show = function(){
	var s = this;
	s.visible = true;
	s.leftBack.visible = true;
	s.rightBack.visible = true;
	s.back.show();
	s.title.show();
	s.note1.show();
	s.note2.show();
	s.leftBack.show();
	s.leftButton.show();
	s.rightBack.show();
	s.rightButton.show();
}
ShareSprite.prototype.hide = function(){
	this.visible = false;
	this.leftBack.visible = false;
	this.rightBack.visible = false;
}
ShareSprite.prototype.leftClick = function(f){
	Event.removeEvent(this.leftBack);
	Event.addEvent(this.leftBack,"touchstart",f);
}
ShareSprite.prototype.rightClick = function(f){
	Event.removeEvent(this.rightBack);
	Event.addEvent(this.rightBack,"touchstart",f);
}
/***************************************************************************************************/
function StartSprite(b,s,c){
	this.back = new ImageSprite(b,0,0,Global.width,Global.height);
	this.start = new ImageSprite(s,0,0);
	this.callback = c;
	this.x = 0;
	this.y = 0;
	this.visible = true;
	this.width = Global.width;
	this.height = Global.height;
	var s = this;
	Event.addEvent(this.start,"touchstart",function(){
		s.visible = false;
		s.callback();
		Global.removeChild(s);
	});
}
StartSprite.prototype.show = function(){
	this.back.show();
	if(this.start.x==0)
		this.start.x = (Global.width-this.start.width)*0.5;
	if(this.start.y==0)
		this.start.y = Global.height-this.start.height-50;
	this.start.show();
}
/***************************************************************************************************/
/***************************************************************************************************/
/***************************************************************************************************/
/***************************************************************************************************/
/***************************************************************************************************/
/***************************************************************************************************/