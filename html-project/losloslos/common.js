/*获取元素CSS文件中的属性值*/
function getStyle(obj,attribute){
 	return obj.currentStyle?obj.currentStyle[attribute]:document.defaultView.getComputedStyle(obj,false)[attribute];
}
/*分隔字符串*/
function explode(inputstring, separators, includeEmpties) {
  inputstring = new String(inputstring);
  separators = new String(separators);

  if(separators == "undefined") {
    separators = " :;";
  }

  fixedExplode = new Array(1);
  currentElement = "";
  count = 0;

  for(x=0; x < inputstring.length; x++) {
    str = inputstring.charAt(x);
    if(separators.indexOf(str) != -1) {
        if ( ( (includeEmpties <= 0) || (includeEmpties == false)) && (currentElement == "")) {
        }
        else {
            fixedExplode[count] = currentElement;
            count++;
            currentElement = "";
        }
    }
    else {
        currentElement += str;
    }
  }

  if (( ! (includeEmpties <= 0) && (includeEmpties != false)) || (currentElement != "")) {
      fixedExplode[count] = currentElement;
  }
  return fixedExplode;
}
/*Cookie 操作函数*/
function setCookie(name,value){
    var Days = 30;
    var exp = new Date();
    exp.setTime(exp.getTime() + Days*24*60*60*1000);
    document.cookie = name + "="+ escape (value) + ";expires=" + exp.toGMTString();
}
function getCookie(name){
    var arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)"); 
    if(arr=document.cookie.match(reg)) 
        return unescape(arr[2]);
    else
        return null;
}
function delCookie(name){
    var exp = new Date();
    exp.setTime(exp.getTime() - 1);
    var cval=getCookie(name);
    if(cval!=null)
        document.cookie= name + "="+cval+";expires="+exp.toGMTString();
}
/*封装的Ajax类*/
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
/**/