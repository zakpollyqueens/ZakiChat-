(function(){
"use strict";
const KEY="zakichat-keyboard-preferences";
const DEFAULTS={theme:"standard",enterToSend:true,showEmoji:true,compact:false,vibration:false};
const PREMIUM=["midnight","cyan","rose"];
let prefs={...DEFAULTS},premium=false,clientReady=false;
const $=id=>document.getElementById(id);
function read(){try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch(_){return {...DEFAULTS}}}
function save(){localStorage.setItem(KEY,JSON.stringify(prefs));apply();sync();const status=$("keyboardSaved");if(status){status.textContent="Saved on this device";clearTimeout(save.timer);save.timer=setTimeout(()=>status.textContent="Changes save automatically.",1800)}}
function apply(){
 const body=document.body;
 body.classList.remove("zckb-theme-standard","zckb-theme-midnight","zckb-theme-cyan","zckb-theme-rose","zckb-compact");
 body.classList.add("zckb-theme-"+(prefs.theme||"standard"));
 if(prefs.compact)body.classList.add("zckb-compact");
 const preview=$("keyboardPreviewComposer");if(preview){preview.style.background="var(--zckb-bg)";preview.style.color="var(--zckb-text)";preview.style.borderColor="var(--zckb-border)";const send=preview.querySelector(".keyboard-preview-send");if(send)send.style.background="var(--zckb-accent)"}
 const emoji=document.getElementById("emoji-button");if(emoji)emoji.hidden=!prefs.showEmoji;
 document.documentElement.dataset.zakiKeyboardTheme=prefs.theme||"standard";
 document.documentElement.dataset.zakiKeyboardCompact=String(!!prefs.compact);
}
function sync(){
 document.querySelectorAll("[data-keyboard-theme]").forEach(button=>{
  const theme=button.dataset.keyboardTheme,locked=PREMIUM.includes(theme)&&!premium;
  button.setAttribute("aria-pressed",String(prefs.theme===theme));
  button.classList.toggle("is-locked",locked);
  let badge=button.querySelector(".keyboard-lock-badge");
  if(locked&&!badge){badge=document.createElement("span");badge.className="keyboard-lock-badge";badge.textContent="🔒";button.appendChild(badge)}
  if(!locked&&badge)badge.remove();
 });
 for(const [id,key] of [["keyboardEnterToSend","enterToSend"],["keyboardShowEmoji","showEmoji"],["keyboardCompact","compact"],["keyboardVibration","vibration"]]){const input=$(id);if(input)input.checked=!!prefs[key]}
 const msg=$("keyboardAccessMessage");if(msg)msg.textContent=premium?"Customized Personal is active — all keyboard themes are available.":"Standard is available. Premium keyboard themes require Customized Personal.";
}
async function checkPlan(){
 try{
  const client=window.ZakiChatAuth?.client;if(!client)return;
  const {data:s,error}=await client.auth.getSession();if(error)throw error;
  const user=s?.session?.user;if(!user)return;
  const {data,error:queryError}=await client.from("user_upgrades").select("plan").eq("user_id",user.id).in("plan",["personal_monthly","business_monthly"]).eq("status","active").gt("expires_at",new Date().toISOString()).order("expires_at",{ascending:false}).limit(1).maybeSingle();
  if(queryError)throw queryError;
  premium=!!queryError?false:!!data?.plan;clientReady=true;
 }catch(error){console.warn("Could not verify keyboard customization entitlement",error)}
}
function bind(){
 document.querySelectorAll("[data-keyboard-theme]").forEach(button=>button.addEventListener("click",()=>{
  const theme=button.dataset.keyboardTheme;if(PREMIUM.includes(theme)&&!premium){const msg=$("keyboardAccessMessage");if(msg)msg.textContent="Unlock this theme with Customized Personal.";if(confirm("Premium keyboard themes are included with Customized Personal. View upgrade plans?"))location.href="about.html?upgrade=personal_monthly#paid-upgrades";return}
  prefs.theme=theme;save();
 }));
 for(const [id,key] of [["keyboardEnterToSend","enterToSend"],["keyboardShowEmoji","showEmoji"],["keyboardCompact","compact"],["keyboardVibration","vibration"]])$(id)?.addEventListener("change",e=>{prefs[key]=e.target.checked;save()});
 $("keyboardReset")?.addEventListener("click",()=>{prefs={...DEFAULTS};save()});
 const input=$("message-input");
 if(input){
  input.addEventListener("keydown",event=>{
   if(prefs.enterToSend||event.key!=="Enter"||event.shiftKey)return;
   event.stopImmediatePropagation();
  },true);
 }
 document.addEventListener("click",event=>{if(!prefs.vibration||!navigator.vibrate)return;if(event.target.closest("#send-button,#mic-button,#attach-button,#emoji-button"))navigator.vibrate(10)},true);
}
async function init(){prefs=read();await checkPlan();if(PREMIUM.includes(prefs.theme)&&!premium)prefs.theme="standard";apply();sync();bind()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();