"use strict";var net=require("net");var tls=require("tls");var events=require("events");var dns=require("dns");var fs=require("fs");var path=require("path");var utils=require("./utils");var CRLF="\r\n";var UNDEFINED="undefined";var errors={notvalid:"E-mail address is not valid",resolve:"Cannot resolve MX of ",connection:"Cannot connect to any SMTP server."};function Mailer(){this.debug=false;this.Message=Message;this.Mail=Message}Mailer.prototype=new events.EventEmitter;Mailer.prototype.create=function(subject,body){return new Message(subject,body)};function resolveMx(domain,callback){dns.resolveMx(domain,function(err,data){if(err){callback(err,data);return}if(!data||data.length===0){callback(new Error(errors.resolve+domain));return}data.sort(function(a,b){return a.priority<b.priority});function tryConnect(index){if(index>=data.length){callback(new Error(errors.connection));return}var sock=net.createConnection(25,data[index].exchange);sock.on("error",function(err){tryConnect(++index)});sock.on("connect",function(){sock.removeAllListeners("error");callback(null,sock)})}tryConnect(0)})}function Message(subject,body){this.subject=subject||"";this.body=body||"";this.files=[];this.addressTo=[];this.addressReply=[];this.addressCC=[];this.addressBCC=[];this.addressFrom={name:"",address:""};this.callback=null}Message.prototype.sender=function(address,name){return this.from(address,name)};Message.prototype.from=function(address,name){if(!address.isEmail())throw new Error(errors.notvalid);var self=this;self.addressFrom.name=name||"";self.addressFrom.address=address;return self};Message.prototype.to=function(address){if(!address.isEmail())throw new Error(errors.notvalid);var self=this;self.addressTo.push(address);return self};Message.prototype.cc=function(address){if(!address.isEmail())throw new Error(errors.notvalid);var self=this;self.addressCC.push(address);return self};Message.prototype.bcc=function(address){if(!address.isEmail())throw new Error(errors.notvalid);var self=this;self.addressBCC.push(address);return self};Message.prototype.reply=function(address){if(!address.isEmail())throw new Error(errors.notvalid);var self=this;self.addressReply.push(address);return self};Message.prototype.attachment=function(filename,name){var self=this;if(name===undefined)name=path.basename(filename);self.files.push({name:name,filename:filename,contentType:utils.getContentType(path.extname(name))});return self};Message.prototype.send=function(smtp,options,fnCallback){var self=this;smtp=smtp||null;if(typeof options==="function"){var tmp=fnCallback;fnCallback=options;options=tmp}self.callback=fnCallback;options=utils.copy(options,{secure:false,port:25,user:"",password:"",timeout:1e4});if(smtp===null||smtp===""){smtp=getHostName(self.addressFrom.address);resolveMx(smtp,function(err,socket){if(err){mailer.emit("error",err,self);if(fnCallback)fnCallback(err);return}socket.on("error",function(err){mailer.emit("error",err,self);if(fnCallback)fnCallback(err)});self._send(socket,options)});return self}var socket=options.secure?tls.connect(options.port,smtp,function(){self._send(this,options)}):net.createConnection(options.port,smtp);socket.on("error",function(err){mailer.emit("error",err,self)});socket.on("clientError",function(err){mailer.emit("error",err,self)});socket.on("connect",function(){if(!options.secure){self._send(socket,options)}});return self};Message.prototype._send=function(socket,options){var self=this;var command="";var buffer=[];var message=[];var host=getHostName(self.addressFrom.address);var date=new Date;var boundary="--totaljs"+date.getTime();var isAuthenticated=false;var isAuthorization=false;var authType="";var auth=[];var err=null;var ending=null;mailer.emit("send",self);socket.setTimeout(options.timeout||5e3,function(){mailer.emit("error",new Error(utils.httpStatus(408)),self);if(socket!==null)socket.destroy();socket=null});socket.setEncoding("utf8");var write=function(line){if(mailer.debug)console.log("SEND",line);socket.write(line+CRLF)};buffer.push("MAIL FROM: <"+self.addressFrom.address+">");message.push("Message-ID: <"+GUID()+"@WIN-"+s4()+">");message.push("MIME-Version: 1.0");message.push("From: "+(self.addressFrom.name.length>0?'"'+self.addressFrom.name+'" '+"<"+self.addressFrom.address+">":self.addressFrom.address));var length=self.addressTo.length;var builder="";if(length>0){for(var i=0;i<length;i++){var mail="<"+self.addressTo[i]+">";buffer.push("RCPT TO: "+mail);builder+=(builder!==""?", ":"")+mail}message.push("To: "+builder);builder=""}length=self.addressCC.length;if(length>0){for(var i=0;i<length;i++){var mail="<"+self.addressCC[i]+">";buffer.push("RCPT TO: "+mail);builder+=(builder!==""?", ":"")+mail}message.push("Cc: "+builder);builder=""}length=self.addressBCC.length;if(length>0){for(var i=0;i<length;i++)buffer.push("RCPT TO: <"+self.addressBCC[i]+">")}buffer.push("DATA");buffer.push("QUIT");buffer.push("");message.push("Date: "+date.toUTCString());message.push("Subject: "+self.subject);length=self.addressReply.length;if(length>0){for(var i=0;i<length;i++)builder+=(builder!==""?", ":"")+"<"+self.addressReply[i]+">";message.push("Reply-To: "+builder);builder=""}message.push("Content-Type: multipart/mixed; boundary="+boundary);message.push("");message.push("--"+boundary);message.push("Content-Type: "+(self.body.indexOf("<")!==-1&&self.body.lastIndexOf(">")!==-1?"text/html":"text/plain")+"; charset=utf-8");message.push("Content-Transfer-Encoding: base64");message.push("");message.push(prepareBASE64(new Buffer(self.body.replace(/\r\n/g,"\n").replace(/\n/g,"\r\n")).toString("base64")));length=self.files.length;if(mailer.debug){socket.on("end",function(){console.log("END")})}socket.on("data",function(data){var response=data.toString().split(CRLF);var length=response.length;for(var i=0;i<length;i++){var line=response[i];if(line==="")continue;if(socket)socket.emit("line",line)}});socket.on("line",function(line){line=line.toUpperCase();if(mailer.debug)console.log("–––>",line);var code=parseInt(line.match(/\d+/)[0],10);if(code===250&&!isAuthorization){if(line.indexOf("AUTH LOGIN PLAIN")!==-1||line.indexOf("AUTH PLAIN LOGIN")!==-1||options.user&&options.password){authType="plain";isAuthorization=true;if(line.indexOf("XOAUTH")===-1){auth.push("AUTH LOGIN");auth.push(new Buffer(options.user).toString("base64"));auth.push(new Buffer(options.password).toString("base64"))}else auth.push("AUTH PLAIN "+new Buffer("\x00"+options.user+"\x00"+options.password).toString("base64"))}}if(line.substring(3,4)==="-"){return}if(!isAuthenticated&&isAuthorization){isAuthenticated=true;code=334}switch(code){case 220:command=/\besmtp\b/i.test(line)?"EHLO":"HELO";write(command+" "+host);break;case 221:case 250:case 251:case 235:write(buffer.shift());if(buffer.length===0){mailer.emit("success",self);if(self.callback)self.callback(null);ending=setTimeout(function(){if(socket!==null)socket.destroy();socket=null},500)}break;case 334:var value=auth.shift();if(value===undefined){err=new Error("Forbidden.");mailer.emit("error",err,self);if(self.callback)self.callback(err);if(socket!==null)socket.destroy();socket=null;break}write(value);break;case 354:write(message.join(CRLF));if(self.files.length>0){message=null;self._writeAttachment(write,boundary,socket);return}write("--"+boundary+"--");write("");write(".");message=null;break;default:if(code<400)break;err=new Error(line);if(socket!==null)socket.destroy();socket=null;mailer.emit("error",err,self);if(self.callback)self.callback(err);break}})};Message.prototype._writeAttachment=function(write,boundary,socket){var self=this;var attachment=self.files.shift();if(attachment===undefined){write("--"+boundary+"--");write("");write(".");return}var name=attachment.name;var stream=fs.createReadStream(attachment.filename,{encoding:"base64"});var message=[];var ext=path.extname(attachment.filename);message.push("--"+boundary);message.push('Content-Disposition: attachment; filename="'+name+'"');message.push('Content-Type: application/octet-stream; name="'+name+'"');message.push("Content-Transfer-Encoding: base64");message.push(CRLF);write(message.join(CRLF));stream.on("data",function(buf){var length=buf.length;var count=0;var beg=0;while(count<length){count+=68;if(count>length)count=length;write(buf.slice(beg,count).toString("base64"));beg=count}});stream.on("end",function(){write(CRLF);self._writeAttachment(write,boundary,socket)});return self};function prepareBASE64(value){var index=0;var output="";var length=value.length;while(index<length){var max=index+68;if(max>length)max=length;output+=value.substring(index,max)+"\n";index=max}return output}function getHostName(address){return address.substring(address.indexOf("@")+1)}function s4(){return Math.floor((1+Math.random())*65536).toString(16).substring(1).toUpperCase()}function GUID(){return s4()+s4()+"-"+s4()+"-"+s4()+"-"+s4()+"-"+s4()+s4()+s4()}var mailer=new Mailer;module.exports=mailer;