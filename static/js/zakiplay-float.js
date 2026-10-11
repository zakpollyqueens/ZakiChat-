(function(){
"use strict";
if(!document.body)return;
const KEY="zakichat-zakiplay-float-collapsed";
if(document.querySelector(".zplay-floating-launch"))return;
const wrap=document.createElement("div");
wrap.className="zplay-floating-launch";
wrap.setAttribute("aria-label","ZakiPlay quick controls");
wrap.innerHTML='<a class="zplay-floating-link tg-zakiplay-launch" href="zakiplay.html" title="Open ZakiPlay"><span class="zplay-floating-orbit" aria-hidden="true"><span class="zplay-floating-spark">♫</span></span><span class="zplay-floating-copy"><span class="zplay-floating-label">ZakiPlay</span><span class="zplay-floating-caption">Your sound space</span></span><span class="zplay-floating-arrow" aria-hidden="true">↗</span></a><button class="zplay-floating-toggle" type="button" aria-label="Minimize ZakiPlay shortcut" title="Minimize ZakiPlay shortcut"><span aria-hidden="true">−</span></button>';
document.body.appendChild(wrap);
const toggle=wrap.querySelector(".zplay-floating-toggle");
function setCollapsed(value){
 wrap.classList.toggle("is-collapsed",value);
 try{localStorage.setItem(KEY,value?"1":"0")}catch(_){}
 toggle.innerHTML=value?'<span aria-hidden="true">♫</span>':'<span aria-hidden="true">−</span>';
 toggle.setAttribute("aria-label",value?"Show ZakiPlay shortcut":"Minimize ZakiPlay shortcut");
 toggle.title=value?"Show ZakiPlay shortcut":"Minimize ZakiPlay shortcut";
}
toggle.addEventListener("click",()=>setCollapsed(!wrap.classList.contains("is-collapsed")));
let collapsed=false;try{collapsed=localStorage.getItem(KEY)==="1"}catch(_){}
setCollapsed(collapsed);
})();