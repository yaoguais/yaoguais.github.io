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
					//_report('send_msg', res.err_msg);
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
						//_report('timeline', res.err_msg);
				});
		},
		weibo: function(){
				WeixinJSBridge.invoke('shareWeibo',{
					  'content': WeixinHelper.desc || document.title,
					  'url': WeixinHelper.url || window.location.href,
					  }, function(res) {
					  //_report('weibo', res.err_msg);
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