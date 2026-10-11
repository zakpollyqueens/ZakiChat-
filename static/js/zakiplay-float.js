(function(){
"use strict";
if(!document.body)return;
const KEY="zakichat-zakiplay-float-collapsed";
if(!document.querySelector(".zplay-floating-launch")){
 const wrap=document.createElement("div");wrap.className="zplay-floating-launch";
 wrap.innerHTML='<a class="zplay-floating-link tg-zakiplay-launch" href="zakiplay.html" title="ZakiPlay"><span class="zplay-floating-spark" aria-hidden="true">✦</span><span class="zplay-floating-label">ZakiPlay</span></a><button class="zplay-floating-toggle" type="button" aria-label="Minimize ZakiPlay shortcut" title="Minimize">−</button>';
 document.body.appendChild(wrap);
 const toggle=wrap.querySelector(".zplay-floating-toggle");
 function setCollapsed(value){wrap.classList.toggle("is-collapsed",value);localStorage.setItem(KEY,value?"1":"0");toggle.textContent=value?"+":"−";toggle.setAttribute("aria-label",value?"Show ZakiPlay shortcut":"Minimize ZakiPlay shortcut");toggle.title=value?"Show ZakiPlay":"Minimize";}
 toggle.addEventListener("click",()=>setCollapsed(!wrap.classList.contains("is-collapsed")));
 setCollapsed(localStorage.getItem(KEY)==="1");
}
})();