function RankSprite(list){
	base(this,LSprite,[]);
	var s = this;
	//添加背景
	var bitmap = new LBitmap(new LBitmapData(list["rankBg"]));	
	s.rankBg = new LSprite();
	s.rankBg.addChild(bitmap);
	s.addChild(s.rankBg);
	s.x = (LGlobal.width - s.rankBg.getWidth())/2;
	s.y = (LGlobal.height - s.rankBg.getHeight())/2;
	//抓取服务器上面的数据然后遍历进行显示
	var ajax = new Ajax('GET','losloslos.php?ac=rank',function(d){
		if(d && d!="[]"){
			var obj = JSON.parse(d);
			var ranks = ["第一名","第二名","第三名","第四名","第五名","第六名","第七名","第八名","第九名","第十名"];
			var marginTop = 37;
			var top1 = 62, top2 = 51;
			for(var i=0,l=obj.length;i<l;i++){
				var t1 = top1 + marginTop*i , t2 = top2 + marginTop*i;
				//添加名次
				var rank = new LTextField();
				rank.text = ranks[i];
				rank.color = "#CC7200";
				rank.size = 10;
				rank.weight = "600";
				rank.font = 'Microsoft YaHei';
				rank.x = 35;
				rank.y = t1;
				s.addChild(rank);
				//添加姓名
				var username = new LTextField();
				username.text =obj[i].weixin.substr(0,9);
				username.color = "#CC7200";
				username.size = 10;
				username.weight = "600";
				username.font = 'Microsoft YaHei';
				username.x = s.rankBg.getWidth() - 153 - username.getWidth();
				username.y = t1;
				s.addChild(username);
				//添加成绩
				var score = new LTextField();
				score.text =obj[i].score+'米';
				score.color = "#CC7200";
				score.size = 10;
				score.weight = "600";
				score.font = 'Microsoft YaHei';
				score.x = s.rankBg.getWidth() - 98 - score.getWidth();
				score.y = t1;
				s.addChild(score);

				//添加按钮
				var btn = new LBitmap(new LBitmapData(list["fight"]));
				var fight = new LSprite();
				fight.addChild(btn);
				fight.x = 202;
				fight.y = t2;
				fight.score = parseInt(obj[i].score);
				fight.addEventListener(LMouseEvent.MOUSE_UP,function(e){
					if(Game.getCookieOneDay("cookieFightNumber")>=1){
						alert("今天已经挑战一次了哦，请明天再来吧");
						return;
					}
					Game.incCookieOneDay("cookieFightNumber");
					Game.inFightScore = e.currentTarget.score;
					console.log("fight score: "+Game.inFightScore);
					Game.beginGame();
				});
				s.addChild(fight);
			}			
		}
	});
	ajax.exec();
	//添加右上角的叉叉
	bitmap = new LBitmap(new LBitmapData(list["rankCancel"]));	
	s.rankCancel = new LSprite();
	s.rankCancel.addChild(bitmap);
	s.addChild(s.rankCancel);
	s.rankCancel.x = s.x + s.rankBg.getWidth()-50;
	s.rankCancel.y = s.y + 2;
	s.rankCancel.addEventListener(LMouseEvent.MOUSE_UP,function(){
		s.visible = false;
		Game.gameOverLayer.showInput();
	});
}