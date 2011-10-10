/*

 Copyright (c) 2011 by Ramesh Nair (www.hiddentao.com)

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.

 Asynchronous LZW algorithm implementation.

 Blog post: http://www.hiddentao.com/archives/2011/08/01/asynchronous-implementation-of-lzw-algorithm-in-javascript/
 Source: https://github.com/hiddentao/lzw-async
*/
(function(){var n=this;(function(s){var t,i,r,u,v;t=function(){var a="";this.append=function(f){a+=f};this.getOutput=function(){return a}};u=function(){var a=[],f=0,e=16;this.write=function(c,d){for(;0<d;){var b=0;a.length>f&&(b=a[f].charCodeAt(0));d>e?(d-=e,b|=c>>d,c&=(1<<d)-1,e=0):(e-=d,b|=c<<e,d=0);a[f]=String.fromCharCode(b);0===e&&(f++,e=16)}};this.getOutput=function(){return a.join("")}};v=function(a){var f=0,e=a.length*16,c=16;this.read=function(d){if(e<d)return null;e-=d;for(var b=0,h;0<d;)h=
a.charCodeAt(f),h&=(1<<c)-1,d>c?(d-=c,b|=h<<d,c=0):(b|=h>>c-d,c-=d,d=0),0===c&&(f++,c=16);return b};this.percent_read=function(){return Math.round((f+1)/a.length*100)}};i=function(a,f){this.str=a;this.code=f;this.right=this.left=null};i.getDummy=function(){return new i("",-1)};r=function(a,f){var e,c,d=-1;this.bitSize=function(){return parseInt(Math.ceil(Math.log(c+1)/Math.LN2),10)};this.reset=function(){e={};var b=c=0;if(void 0!==a&&0<a.length)for(b=0;b<a.length;++b)f?e[a.charCodeAt(b)]=new i(a.charAt(b),
b):e[b]=a.charAt(b);else for(b=0;b<256;b++)e[b]=f?new i(String.fromCharCode(b),b):String.fromCharCode(b);d=c=b;c++};this.findAdd=function(b,a){var d=b.str+a,f=true,g=b,l=null;if(0<=b.code){do l=g,g=g.str>d?g.left:g.right;while(null!==g&&g.str!==d);null!==g?b=g:(d=new i(d,c),c++,l.str>b.str?l.left=d:l.right=d,b=e[a.charCodeAt(0)],f=false)}else b=e[a.charCodeAt(0)];return{found:f,dictString:b,nextCode:c}};this.decode=function(b,a){if(d===b)return null;var f=e.hasOwnProperty(b)?e[b]:"";0>=f.length?(f=
a+a.charAt(0),e[c]=f,c++):0<a.length&&(e[c]=a+f.charAt(0),c++);return{str:f,nextCode:c}};this.getEOF=function(){return d};this.reset()};s.compress=function(a){if(!a.hasOwnProperty("progress"))a.progress=function(){};var f=a.input,e=new r(a.dict||void 0,true),c=e.bitSize(),d=(1<<c)-1,b=0,h=new u,j=i.getDummy(),o=0,g,l;g=function(){var a=false;d<=b&&(16===c?(e.reset(),c=e.bitSize(),a=true):c++,d=(1<<c)-1);return a};l=function(){for(var q=(new Date).getTime(),m,k=0,p;o<f.length;){m=f.charAt(o);o++;p=
e.findAdd(j,m);if(!p.found)0<=j.code&&h.write(j.code,c),b=p.nextCode,g()&&(p=e.findAdd(i.getDummy(),m));j=p.dictString;k++;if(0===k%10&&(m=(new Date).getTime()-q,100<m))break}n.setTimeout(function(){a.progress(Math.round(o/f.length*100))},0);o<f.length?n.setTimeout(function(){l()},0):(0<=j.code&&h.write(j.code,c),d-1===b&&(b++,g()),h.write(e.getEOF(),c),n.setTimeout(function(){a.output.call(null,h.getOutput())},0))};l()};s.decompress=function(a){if(!a.hasOwnProperty("progress"))a.progress=function(){};
var f=new v(a.input),e=new r(a.dict||void 0,false),c=e.bitSize(),d=(1<<c)-2,b=0,h=new t,j="",i,g;i=function(){var a=false;d<=b&&(16===c?(a=true,e.reset(),c=e.bitSize()):c++,d=(1<<c)-2);return a};g=function(){for(var d=(new Date).getTime(),q,m=0,k=0;null!==k;){k=e.decode(f.read(c),j);if(null===k)break;j=k.str;b=k.nextCode;h.append(j);i()&&(j="");m++;if(0===m%10&&(q=(new Date).getTime()-d,100<q))break}n.setTimeout(function(){a.progress(f.percent_read())},0);null!==k?n.setTimeout(function(){g()},0):
n.setTimeout(function(){a.output.call(null,h.getOutput())},0)};g()}})(typeof exports==="undefined"?n.LZWAsync={}:exports)})();