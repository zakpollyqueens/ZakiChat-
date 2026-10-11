(() => {
"use strict";
const $ = (s, root=document) => root.querySelector(s);
const form=$("#web-search-form"), input=$("#web-search-input"), root=$("#web-search-results");
const buttons=[...document.querySelectorAll("[data-scope]")];
let scope="web", sequence=0;
function safeText(value){return String(value||"").replace(/[<>]/g,"").slice(0,1200)}
function renderMessage(title,message){root.replaceChildren();const icon=document.createElement("div");icon.className="zws-empty-icon";icon.textContent="⌕";const h=document.createElement("h2");h.className="zws-empty-title";h.textContent=title;const p=document.createElement("p");p.className="zws-empty-copy";p.textContent=message;root.append(icon,h,p)}
function renderResults(data,query){
 root.replaceChildren();
 const head=document.createElement("div");head.className="zws-results-head";
 const count=document.createElement("span");count.textContent=(data.results||[]).length+" web results for “"+query+"”";
 const safe=document.createElement("span");safe.className="zws-safe";safe.textContent="✓ Safe search";head.append(count,safe);root.append(head);
 if(!data.results?.length){renderMessage("No results found","Try a different phrase. Some pages may not be indexed, and adult results are filtered.");return}
 for(const item of data.results){
  if(!item.url||!/^https?:\/\//i.test(item.url))continue;
  const a=document.createElement("a");a.className="zws-result";a.href=item.url;a.target="_blank";a.rel="noopener noreferrer";
  const domain=document.createElement("span");domain.className="zws-domain";try{domain.textContent=new URL(item.url).hostname.replace(/^www\./,"")}catch{domain.textContent="Web result"}
  const title=document.createElement("strong");title.textContent=safeText(item.title)||domain.textContent;
  const snippet=document.createElement("p");snippet.textContent=safeText(item.snippet);
  a.append(domain,title,snippet);root.append(a);
 }
}
async function runSearch(){
 const query=input.value.trim();if(query.length<2){renderMessage("Type something to search","Enter at least two characters to search the web.");return}
 const seq=++sequence;const sentQuery=scope==="telegram"?query+" site:t.me":scope==="whatsapp"?query+" site:chat.whatsapp.com":query;
 history.replaceState(null,"","search.html?q="+encodeURIComponent(query)+(scope!=="web"?"&scope="+scope:""));
 renderMessage("Searching…","Looking across public web pages with strict safe-search filtering.");
 try{
  const client=window.ZakiChatAuth?.client;if(!client)throw new Error("Search services are not ready. Refresh and try again.");
  const {data,error}=await client.functions.invoke("web-search",{body:{query:sentQuery}});
  if(error)throw error;if(seq!==sequence)return;
  if(!data?.success)throw new Error(data?.error||"The search provider did not return results.");
  renderResults(data,query);
 }catch(error){if(seq!==sequence)return;console.error("Global web search failed",error);renderMessage("Search is temporarily unavailable",error?.message||"Please try again in a moment.");}
}
form.addEventListener("submit",e=>{e.preventDefault();runSearch()});
buttons.forEach(button=>button.addEventListener("click",()=>{scope=button.dataset.scope;buttons.forEach(b=>b.classList.toggle("is-active",b===button));if(input.value.trim())runSearch()}));
const params=new URLSearchParams(location.search);const q=params.get("q")||"";input.value=q;scope=params.get("scope")||"web";buttons.forEach(b=>b.classList.toggle("is-active",b.dataset.scope===scope));if(q)runSearch();
})();