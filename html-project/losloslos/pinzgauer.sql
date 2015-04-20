DROP TABLE IF EXISTS pre_record;
CREATE TABLE pre_record(
	rid int(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '部门ID',
	weixin varchar(100) NOT NULL DEFAULT '' COMMENT '用户名',
	username varchar(30) NOT NULL DEFAULT '' COMMENT '用户名',
	phone varchar(15) NOT NULL DEFAULT '' COMMENT '电话号码',
	dateline int(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT '提交时间',
	score int(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT '跑的米数',
	PRIMARY KEY(rid),
	INDEX record_weixin(weixin),
	INDEX record_dateline_score(dateline ASC,score DESC)
)ENGINE = MYISAM CHARACTER SET utf8 COLLATE utf8_general_ci COMMENT = '记录表';