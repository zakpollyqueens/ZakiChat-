(function(){
"use strict";
const $=id=>document.getElementById(id);
const gate=$("zplayGate"),content=$("zplayContent"),locked=$("zplayLocked");
let activeUrl="",activeFileName="",activeObjectUrl="";
function showLocked(){gate.hidden=true;content.hidden=true;locked.hidden=false}
function showContent(){gate.hidden=true;locked.hidden=true;content.hidden=false}
async function checkAccess(){
 try{
  const client=window.ZakiChatAuth&&window.ZakiChatAuth.client;
  if(!client)throw new Error("Secure account service is not ready.");
  const {data:sessionData,error:sessionError}=await client.auth.getSession();
  if(sessionError)throw sessionError;
  const user=sessionData&&sessionData.session&&sessionData.session.user;
  if(!user){window.location.replace("login.html");return}
  const {data,error}=await client.from("user_upgrades").select("plan,status,expires_at")
   .eq("user_id",user.id).eq("plan","personal_monthly").eq("status","active")
   .gt("expires_at",new Date().toISOString()).order("expires_at",{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;
  if(!data){showLocked();return}
  showContent();
 }catch(error){
  console.error("ZakiPlay entitlement check failed:",error);
  gate.innerHTML="<strong>We couldn't verify your Customized Personal access. Please check your connection and try again.</strong><button class='zplay-button' id='zplayRetry' type='button'>Try again</button>";
  $("zplayRetry")?.addEventListener("click",()=>{gate.innerHTML="<div class='zplay-loader'></div><strong>Checking your Customized Personal access…</strong>";checkAccess()});
 }
}
function setMediaTitle(title,hint){$("zplayMediaTitle").textContent=title;$("zplayMediaHint").textContent=hint}
function providerEmbed(raw){
 try{
  const u=new URL(raw),host=u.hostname.replace(/^www\./,"").toLowerCase();
  if(host==="youtu.be"||host==="youtube.com"||host==="m.youtube.com"||host==="music.youtube.com"){
   let id=host==="youtu.be"?u.pathname.split("/").filter(Boolean)[0]:(u.searchParams.get("v")||u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]);
   if(id&&/^[a-zA-Z0-9_-]{6,20}$/.test(id))return {url:"https://www.youtube-nocookie.com/embed/"+id,title:"YouTube video",hint:"Embedded from YouTube. Playback and availability are controlled by YouTube."};
  }
  if(host==="open.spotify.com"){
   const parts=u.pathname.split("/").filter(Boolean),kind=parts[0],id=parts[1];
   if(["track","album","playlist","artist","episode","show"].includes(kind)&&id)return {url:"https://open.spotify.com/embed/"+kind+"/"+encodeURIComponent(id),title:"Spotify "+kind,hint:"Embedded from Spotify. A Spotify account may be required for full playback."};
  }
  if(host==="tiktok.com"||host.endsWith(".tiktok.com")){
   const match=u.pathname.match(/\/video\/(\d+)/);
   if(match)return {url:"https://www.tiktok.com/embed/v2/"+match[1],title:"TikTok video",hint:"Embedded from TikTok. TikTok controls availability and playback."};
  }
 }catch(_){}
 return null;
}
function useMedia(url,title,type){
 const stage=$("zplayMediaStage");stage.replaceChildren();
 const embed=providerEmbed(url);
 if(embed){
  const frame=document.createElement("iframe");frame.src=embed.url;frame.title=embed.title;frame.loading="lazy";frame.referrerPolicy="strict-origin-when-cross-origin";
  frame.allow="autoplay; encrypted-media; fullscreen; picture-in-picture";frame.allowFullscreen=true;stage.appendChild(frame);
  $("zplayDisc").classList.remove("is-playing");setMediaTitle(embed.title,embed.hint);
  $("zplayDownloadNote").textContent="Embedded platform content cannot be downloaded through ZakiPlay unless the provider explicitly offers that option.";
  return;
 }
 let media;
 if(type==="audio"){media=document.createElement("audio");media.controls=true;media.autoplay=true}
 else{media=document.createElement("video");media.controls=true;media.playsInline=true;media.autoplay=true}
 media.src=url;media.preload="metadata";stage.appendChild(media);
 $("zplayDisc").classList.toggle("is-playing",type==="audio");
 media.addEventListener("play",()=>{$("zplayDisc").classList.toggle("is-playing",type==="audio")});
 media.addEventListener("pause",()=>{$("zplayDisc").classList.remove("is-playing")});
 media.addEventListener("error",()=>{$("zplayDownloadNote").textContent="This source cannot be played here. Try a direct media file link or an official service.";});
 setMediaTitle(title,type==="audio"?"Audio is ready to play on this device.":"Video is ready to play on this device.");
}
function handleFile(file,type){
 if(!file)return;
 if(activeObjectUrl)URL.revokeObjectURL(activeObjectUrl);
 activeObjectUrl=URL.createObjectURL(file);activeUrl=activeObjectUrl;activeFileName=file.name;
 useMedia(activeObjectUrl,file.name,type);
 $("zplayDownloadNote").textContent="Selected files stay on this device; ZakiChat does not upload them.";
}
$("zplayAudioFile").addEventListener("change",e=>handleFile(e.target.files&&e.target.files[0],"audio"));
$("zplayVideoFile").addEventListener("change",e=>handleFile(e.target.files&&e.target.files[0],"video"));
$("zplayLoadUrl").addEventListener("click",()=>{
 const raw=$("zplayMediaUrl").value.trim();let url;
 try{url=new URL(raw);if(!["http:","https:"].includes(url.protocol))throw new Error()}catch{$("zplayDownloadNote").textContent="Enter a valid http or https direct media URL.";return}
 activeUrl=url.href;activeFileName=decodeURIComponent(url.pathname.split("/").pop()||"Media link");
 const ext=activeFileName.split(".").pop().toLowerCase().split("?")[0];const audio=["mp3","m4a","aac","ogg","wav","flac","opus"].includes(ext);
 useMedia(activeUrl,activeFileName,audio?"audio":"video");
 $("zplayDownloadNote").textContent="Playback depends on the source allowing direct media access.";
});
$("zplayDownloadUrl").addEventListener("click",async()=>{
 if(!activeUrl){$("zplayDownloadNote").textContent="Choose a local file or load a direct media URL first.";return}
 if(activeObjectUrl){$("zplayDownloadNote").textContent="This file is already on your device.";return}
 try{
  const url=new URL(activeUrl);
  const response=await fetch(url.href);if(!response.ok)throw new Error("The source did not provide a downloadable file.");
  const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);const a=document.createElement("a");a.href=objectUrl;a.download=activeFileName||"media";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
  $("zplayDownloadNote").textContent="Download started.";
 }catch(error){$("zplayDownloadNote").textContent=error.message||"This source does not allow direct downloading. Use the official source's download option."; }
});
function searchService(){
 const q=$("zplaySearch").value.trim();if(!q){$("zplaySearch").focus();return}
 const query=encodeURIComponent(q),results=$("zplaySearchResults");
 const destinations=[
  ["▶","YouTube","Search videos and music","https://www.youtube.com/results?search_query="+query],
  ["♫","Spotify","Search tracks, albums and podcasts","https://open.spotify.com/search/"+query],
  ["♪","TikTok","Search short videos and creators","https://www.tiktok.com/search?q="+query],
  ["▣","Internet Archive","Find films and media with rights details","https://archive.org/search?query="+query]
 ];
 results.replaceChildren();
 destinations.forEach(([icon,name,detail,url])=>{
  const a=document.createElement("a");a.className="zplay-search-result";a.href=url;a.target="_blank";a.rel="noopener noreferrer";
  const symbol=document.createElement("span");symbol.textContent=icon;
  const copy=document.createElement("span"),strong=document.createElement("strong"),small=document.createElement("small");
  strong.textContent=name;small.textContent=detail;copy.append(strong,small);
  const arrow=document.createElement("b");arrow.textContent="↗";a.append(symbol,copy,arrow);results.appendChild(a);
 });
 results.hidden=false;
}
$("zplaySearchButton").addEventListener("click",searchService);
$("zplaySearch").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchService()}});
window.addEventListener("beforeunload",()=>{if(activeObjectUrl)URL.revokeObjectURL(activeObjectUrl)});
checkAccess();
})();