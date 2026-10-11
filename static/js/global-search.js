(() => {
"use strict";
const $=(s,root=document)=>root.querySelector(s);
const form=$("#web-search-form"),input=$("#web-search-input"),root=$("#web-search-results");
const buttons=[...document.querySelectorAll("[data-scope]")];
let scope="web",sequence=0;
function safeText(value){return String(value||"").replace(/[<>]/g,"").slice(0,1200)}
function renderMessage(title,message){root.replaceChildren();const icon=document.createElement("div");icon.className="zws-empty-icon";icon.textContent="⌕";const h=document.createElement("h2");h.className="zws-empty-title";h.textContent=title;const p=document.createElement("p");p.className="zws-empty-copy";p.textContent=message;root.append(icon,h,p)}
function host(url){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return "Web result"}}
function link(url,text,download=false){const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=text;if(download)a.setAttribute("download","");return a}
function renderResults(data,query){
 root.replaceChildren();
 const items=(data.results||[]).filter(x=>x.url&&/^https?:\/\//i.test(x.url));
 const head=document.createElement("div");head.className="zws-results-head";
 const count=document.createElement("span");count.textContent=items.length+" "+({images:"image",videos:"video",documents:"document"}[scope]||"web")+" results for “"+query+"”";
 const safe=document.createElement("span");safe.className="zws-safe";safe.textContent="✓ Safe search";head.append(count,safe);root.append(head);
 if(!items.length){renderMessage("No results found","Try another phrase. Some images, videos or files may not be publicly indexed.");return}
 if(scope==="images"||scope==="videos"){
  const grid=document.createElement("div");grid.className="zws-media-grid";
  for(const item of items){
   const a=document.createElement("a");a.className="zws-media-card";a.href=item.url;a.target="_blank";a.rel="noopener noreferrer";
   if(item.thumbnail&&/^https?:\/\//i.test(item.thumbnail)){const img=document.createElement("img");img.src=item.thumbnail;img.alt=safeText(item.title);img.loading="lazy";img.referrerPolicy="no-referrer";img.onerror=()=>{img.style.display="none"};a.append(img)}
   else {const icon=document.createElement("div");icon.className="zws-document-icon";icon.textContent=scope==="videos"?"▶":"▧";a.append(icon)}
   const copy=document.createElement("div");copy.className="zws-media-copy";const title=document.createElement("strong");title.textContent=safeText(item.title)||host(item.url);const domain=document.createElement("small");domain.textContent=host(item.url);copy.append(title,domain);a.append(copy);if(scope==="images"&&item.mediaUrl&&/^https?:\/\//i.test(item.mediaUrl)){const actions=document.createElement("div");actions.className="zws-result-actions";actions.style.padding="0 10px 10px";const mediaLink=link(item.mediaUrl,"Open image ↗");mediaLink.addEventListener("click",e=>e.stopPropagation());const downloadLink=link(item.mediaUrl,"Download image ↧",true);downloadLink.addEventListener("click",e=>e.stopPropagation());actions.append(mediaLink,downloadLink);a.append(actions)}
   if(scope==="videos"&&item.snippet){const p=document.createElement("p");p.textContent=safeText(item.snippet);p.style.cssText="padding:0 10px 10px;margin:0;color:#91aabe;font-size:11px;line-height:1.4";a.append(p)}
   grid.append(a)
  }root.append(grid);return
 }
 for(const item of items){
  const a=document.createElement("a");a.className="zws-result";a.href=item.url;a.target="_blank";a.rel="noopener noreferrer";
  const domain=document.createElement("span");domain.className="zws-domain";domain.textContent=host(item.url);
  const title=document.createElement("strong");title.textContent=safeText(item.title)||domain.textContent;
  const snippet=document.createElement("p");snippet.textContent=safeText(item.snippet);
  a.append(domain,title,snippet);
  if(scope==="documents"){
   const actions=document.createElement("div");actions.className="zws-result-actions";
   actions.append(link(item.url,"Open document ↗"),link(item.url,"Open / download ↧"));
   a.append(actions)
  }root.append(a)
 }
}
async function runSearch(){
 const query=input.value.trim();if(query.length<2){renderMessage("Type something to search","Enter at least two characters to search the web.");return}
 const seq=++sequence;let sentQuery=query;
 if(scope==="telegram")sentQuery+=" site:t.me";
 else if(scope==="whatsapp")sentQuery+=" site:chat.whatsapp.com";
 
 history.replaceState(null,"","search.html?q="+encodeURIComponent(query)+(scope!=="web"?"&scope="+scope:""));
 renderMessage("Searching…",({images:"Finding image previews from public websites.",videos:"Finding public video pages.",documents:"Looking for public PDFs and study documents."}[scope]||"Looking across public web pages with strict safe-search filtering."));
 try{
  const client=window.ZakiChatAuth?.client;if(!client)throw new Error("Search services are not ready. Refresh and try again.");
  const {data,error}=await client.functions.invoke("web-search",{body:{query:sentQuery,type:scope}});
  if(error)throw error;if(seq!==sequence)return;
  if(!data?.success)throw new Error(data?.error||"The search provider did not return results.");
  renderResults(data,query);
 }catch(error){if(seq!==sequence)return;console.error("Global web search failed",error);renderMessage("Search is temporarily unavailable",error?.message||"Please try again in a moment.")}
}
form.addEventListener("submit",e=>{e.preventDefault();runSearch()});
buttons.forEach(button=>button.addEventListener("click",()=>{scope=button.dataset.scope;buttons.forEach(b=>{const active=b===button;b.classList.toggle("is-active",active);if(b.hasAttribute("role"))b.setAttribute("aria-selected",String(active))});if(input.value.trim())runSearch();else renderMessage(({images:"Search for pictures",videos:"Search for videos",documents:"Find public documents"}[scope]||"Search the web"),"Enter a topic above and choose Search to see results.")}));
const params=new URLSearchParams(location.search);input.value=params.get("q")||"";scope=params.get("scope")||"web";buttons.forEach(b=>{const active=b.dataset.scope===scope;b.classList.toggle("is-active",active);if(b.hasAttribute("role"))b.setAttribute("aria-selected",String(active))});if(input.value.trim())runSearch();
})();