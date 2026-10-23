(function(){
"use strict";
const $=id=>document.getElementById(id);
const gate=$("zplayGate"),content=$("zplayContent"),locked=$("zplayLocked");
let activeUrl="",activeFileName="",activeObjectUrl="";
function showLocked(){gate.hidden=true;content.hidden=true;if(locked)locked.hidden=false}
function showContent(){gate.hidden=true;if(locked)locked.hidden=true;content.hidden=false}
async function checkAccess(){
 try{
  const client=window.ZakiChatAuth&&window.ZakiChatAuth.client;
  if(!client)throw new Error("Secure account service is not ready.");
  const {data:sessionData,error:sessionError}=await client.auth.getSession();
  if(sessionError)throw sessionError;
  const user=sessionData&&sessionData.session&&sessionData.session.user;
  if(!user){window.location.replace("signup.html?next=zakiplay.html");return}
  showContent();
 }catch(error){
  console.error("ZakiPlay account check failed:",error);
  gate.innerHTML="<strong>We couldn't connect to Molan Chat. Check your connection and try again.</strong><button class='zplay-button' id='zplayRetry' type='button'>Try again</button>";
  $("zplayRetry")?.addEventListener("click",()=>{gate.innerHTML="<div class='zplay-loader'></div><strong>Opening ZakiPlay…</strong>";checkAccess()});
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
 $("zplayDownloadNote").textContent="Selected files stay on this device; Molan Chat does not upload them.";
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
async function loadArchiveOptions(item,container){
 container.textContent="Checking available files and rights…";
 try{
  const response=await fetch("https://archive.org/metadata/"+encodeURIComponent(item.identifier));
  if(!response.ok)throw new Error("The media record could not be checked right now.");
  const meta=await response.json(),metadata=meta.metadata||{};
  const license=String(metadata.licenseurl||metadata.license||metadata.rights||"");
  const rightsOkay=/creativecommons\.org\/(licenses|publicdomain)|creativecommons\.org\/publicdomain|public domain|\bcc0\b/i.test(license);
  const files=(meta.files||[]).filter(file=>file.name&&file.source!=="original-metadata"&&!file.name.endsWith("_meta.xml")&&!file.name.endsWith("_files.xml"));
  const playable=files.filter(file=>/\.(mp3|m4a|aac|ogg|wav|flac|opus|mp4|m4v|webm|ogv|mov)$/i.test(file.name)&&(!file.size||Number(file.size)<1500000000));
  container.replaceChildren();
  const rights=document.createElement("small");rights.className="zplay-archive-rights";rights.textContent=rightsOkay?"License metadata found: "+license:"No recognized open license was found. Review the record rights before using files.";container.appendChild(rights);
  if(!rightsOkay||!playable.length){const link=document.createElement("a");link.className="zplay-archive-action";link.href="https://archive.org/details/"+encodeURIComponent(item.identifier);link.target="_blank";link.rel="noopener noreferrer";link.textContent="Review item and rights ↗";container.appendChild(link);return}
  const preferred=playable.sort((a,b)=>{const rank=f=>/\.mp3$/i.test(f.name)?0:/\.mp4$/i.test(f.name)?1:/\.m4a$/i.test(f.name)?2:/\.webm$/i.test(f.name)?3:5;return rank(a)-rank(b)})[0];
  const mediaUrl="https://archive.org/download/"+encodeURIComponent(item.identifier)+"/"+preferred.name.split("/").map(encodeURIComponent).join("/");
  const type=/\.(mp3|m4a|aac|ogg|wav|flac|opus)$/i.test(preferred.name)?"audio":"video";
  const play=document.createElement("button");play.type="button";play.className="zplay-archive-action primary";play.textContent=type==="audio"?"▶ Play in ZakiPlay":"▶ Watch in ZakiPlay";
  play.addEventListener("click",()=>{activeUrl=mediaUrl;activeFileName=preferred.name.split("/").pop();useMedia(mediaUrl,item.title||activeFileName,type);$("zplayDownloadNote").textContent="Playing open-licensed media from Internet Archive. Respect the license terms shown above.";document.getElementById("zplayMediaStage").scrollIntoView({behavior:"smooth",block:"center"})});
  const download=document.createElement("button");download.type="button";download.className="zplay-archive-action";download.textContent="↓ Download open-licensed file";
  download.addEventListener("click",async()=>{
   download.disabled=true;download.textContent="Preparing download…";
   try{
    if(preferred.size&&Number(preferred.size)>300000000)throw new Error("This file is too large for a safe in-page download on a mobile device. Open the official record to choose a download option.");
    const fileResponse=await fetch(mediaUrl);if(!fileResponse.ok)throw new Error("The source did not allow a direct download. Open the official record to check available download options.");
    const blob=await fileResponse.blob(),objectUrl=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=objectUrl;a.download=preferred.name.split("/").pop()||"zaki-media";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    download.textContent="Download started";
   }catch(error){download.textContent="Open download options ↗";download.onclick=()=>window.open("https://archive.org/details/"+encodeURIComponent(item.identifier),"_blank","noopener,noreferrer");$("zplayDownloadNote").textContent=error.message||"Download unavailable for this source."}
   finally{download.disabled=false}
  });
  container.append(play,download);
 }catch(error){container.textContent=(error.message||"Unable to check this media record.")+" You can review the item on Internet Archive.";const link=document.createElement("a");link.className="zplay-archive-action";link.href="https://archive.org/details/"+encodeURIComponent(item.identifier);link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open item ↗";container.appendChild(link)}
}
function archiveCard(item){
 const card=document.createElement("article");card.className="zplay-archive-card";
 const title=document.createElement("strong");title.textContent=item.title||item.identifier;
 const meta=document.createElement("small");meta.textContent=[item.mediatype==="audio"?"Audio":item.mediatype==="movies"?"Movie/video":"Media",item.year||"",item.creator||""].filter(Boolean).join(" · ");
 const actions=document.createElement("div");actions.className="zplay-archive-actions";
 const check=document.createElement("button");check.type="button";check.className="zplay-archive-action";check.textContent="Check playback & download";check.addEventListener("click",()=>loadArchiveOptions(item,actions));
 const open=document.createElement("a");open.className="zplay-archive-action";open.href="https://archive.org/details/"+encodeURIComponent(item.identifier);open.target="_blank";open.rel="noopener noreferrer";open.textContent="Record ↗";
 actions.append(check,open);card.append(title,meta,actions);return card;
}
async function searchService(){
 const q=$("zplaySearch").value.trim();if(!q){$("zplaySearch").focus();return}
 const results=$("zplaySearchResults"),query=encodeURIComponent(q);results.replaceChildren();results.hidden=false;
 const quick=document.createElement("div");quick.className="zplay-search-quicklinks";
 [["▶","YouTube","https://www.youtube.com/results?search_query="+query],["♫","Spotify","https://open.spotify.com/search/"+query],["♪","TikTok","https://www.tiktok.com/search?q="+query]].forEach(([icon,name,url])=>{const a=document.createElement("a");a.className="zplay-search-result";a.href=url;a.target="_blank";a.rel="noopener noreferrer";const sym=document.createElement("span");sym.textContent=icon;const textWrap=document.createElement("span"),strong=document.createElement("strong"),small=document.createElement("small");strong.textContent=name;small.textContent="Search official service";textWrap.append(strong,small);a.append(sym,textWrap);quick.appendChild(a)});
 results.appendChild(quick);
 const heading=document.createElement("h3");heading.className="zplay-archive-heading";heading.textContent="Open-license music and movies";results.appendChild(heading);
 const status=document.createElement("p");status.className="zplay-archive-status";status.textContent="Searching Internet Archive for media related to “"+q+"”…";results.appendChild(status);
 try{
  const queryText=encodeURIComponent(q+" AND (mediatype:movies OR mediatype:audio)");
  const url="https://archive.org/advancedsearch.php?q="+queryText+"&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&fl[]=mediatype&rows=8&page=1&output=json";
  const response=await fetch(url);if(!response.ok)throw new Error("Media search is temporarily unavailable.");
  const data=await response.json(),docs=data?.response?.docs||[];status.remove();
  if(!docs.length){const empty=document.createElement("p");empty.className="zplay-archive-status";empty.textContent="No matching audio or movie records were returned. Try a shorter search phrase.";results.appendChild(empty);return}
  docs.forEach(item=>results.appendChild(archiveCard(item)));
  const foot=document.createElement("p");foot.className="zplay-archive-status";foot.textContent="Playback and downloads are offered only when Internet Archive metadata identifies an open license. Some records may not permit in-page playback.";results.appendChild(foot);
 }catch(error){status.textContent=(error.message||"Search failed.")+" Use the official service shortcuts above or open Internet Archive search.";const link=document.createElement("a");link.className="zplay-archive-action";link.href="https://archive.org/search?query="+query;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Search Internet Archive ↗";results.appendChild(link)}
}
$("zplaySearchButton").addEventListener("click",searchService);
$("zplaySearch").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchService()}});
window.addEventListener("beforeunload",()=>{if(activeObjectUrl)URL.revokeObjectURL(activeObjectUrl)});
checkAccess().then(()=>{
 const params=new URLSearchParams(window.location.search),song=String(params.get("song")||"").trim();
 if(song){const search=$("zplaySearch");if(search){search.value=song;setTimeout(()=>searchService(),180)}}
});
})();