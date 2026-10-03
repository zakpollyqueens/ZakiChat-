"use strict";

const FUNCTION_URL="https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";
const SESSION_KEY="zakichat-admin-session";
const ROLE_KEY="zakichat-admin-role";
const EXPIRY_KEY="zakichat-admin-expiry";
const $=id=>document.getElementById(id);

function show(id,visible=true){const el=$(id);if(el)el.classList.toggle("hidden",!visible);}
function getToken(){return localStorage.getItem(SESSION_KEY);}
function clearAdminSession(){localStorage.removeItem(SESSION_KEY);localStorage.removeItem(ROLE_KEY);localStorage.removeItem(EXPIRY_KEY);}

async function rpc(name,body){
  const cfg=window.ZakiChatConfig;
  if(!cfg?.supabaseUrl||!cfg?.supabaseKey)throw new Error("Supabase configuration is unavailable.");
  const res=await fetch(cfg.supabaseUrl+"/rest/v1/rpc/"+name,{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.supabaseKey},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>null);
  if(!res.ok)throw new Error(data?.message||data?.error_description||data?.hint||data?.details||data?.error||"Administrator request failed.");
  return data;
}

async function verifyAdminSession(){
  const token=getToken();
  if(!token)return false;
  const expiry=Number(localStorage.getItem(EXPIRY_KEY)||0);
  if(expiry&&Date.now()>=expiry){clearAdminSession();return false;}
  try{return !!(await rpc("admin_session_user",{p_token:token}));}
  catch(error){console.error("Admin session verification failed:",error);return false;}
}

async function secureSignOut(){
  const token=getToken();
  try{
    if(token)await fetch(FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({action:"admin-session-revoke"})});
  }catch(error){console.warn("Remote admin sign-out failed:",error);}
  clearAdminSession();
  location.href="admin.html";
}

function activeMode(){return document.querySelector(".tab.active")?.dataset.tab||"groups";}
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function formatDate(value){if(!value)return"—";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleString();}

function setOverview(data){
  $("groupCount").textContent=Number(data?.groups||0).toLocaleString();
  $("groupMemberCount").textContent=Number(data?.group_members||0).toLocaleString();
  $("channelCount").textContent=Number(data?.channels||0).toLocaleString();
  $("subscriberCount").textContent=Number(data?.subscribers||0).toLocaleString();
  if($("openReportCount"))$("openReportCount").textContent=Number(data?.open_reports||0).toLocaleString();
}

function renderList(rows,mode){
  const list=$("directoryList");
  if(!list)return;
  if(!Array.isArray(rows)||!rows.length){
    list.innerHTML='<article class="empty-card"><div class="empty-icon">'+(mode==="groups"?"👥":"📢")+'</div><strong>No '+mode+' found</strong><p>The protected administrator directory returned no matching records.</p></article>';
    return;
  }
  list.innerHTML=rows.map(item=>{
    const secondary=mode==="groups"?(item.description||"No description"):(item.handle?("@"+item.handle):(item.description||"No description"));
    const count=mode==="groups"?item.member_count:item.subscriber_count;
    const reports=Number(item.open_report_count||0);
    const status=item.moderation_status||"normal";
    return '<button type="button" class="directory-card" data-id="'+esc(item.id)+'" data-type="'+mode.slice(0,-1)+'"><div class="directory-avatar">'+(mode==="groups"?"👥":"📢")+'</div><div class="directory-main"><strong>'+esc(item.name||"Unnamed")+'</strong><p>'+esc(secondary)+'</p><small>'+Number(count||0).toLocaleString()+' '+(mode==="groups"?"members":"subscribers")+(reports?" • "+reports+" open report"+(reports===1?"":"s"):"")+'</small></div><span class="directory-status">'+esc(status.replaceAll("_"," "))+'</span><span class="directory-arrow">›</span></button>';
  }).join("");
  list.querySelectorAll(".directory-card").forEach(card=>card.addEventListener("click",()=>openDetails(card.dataset.type,card.dataset.id)));
}

async function loadDirectory(){
  const mode=activeMode(),search=$("searchInput")?.value.trim()||"",status=$("statusFilter")?.value||"all";
  const fn=mode==="groups"?"admin_list_groups":"admin_list_channels";
  renderList(await rpc(fn,{p_token:getToken(),p_search:search,p_status:status}),mode);
}

async function loadOverview(){setOverview(await rpc("admin_community_overview",{p_token:getToken()}));}

function closeDetails(){document.getElementById("communityDetailModal")?.remove();}

async function openDetails(type,id){
  try{
    const data=await rpc("admin_community_details",{p_token:getToken(),p_community_type:type,p_community_id:id});
    const c=data?.community||{},m=data?.moderation||{},members=data?.members||[],reports=data?.reports||[],posts=data?.posts||[];
    closeDetails();
    document.body.insertAdjacentHTML("beforeend",'<div class="community-modal-backdrop" id="communityDetailModal"><div class="community-modal"><button class="community-modal-close" id="closeCommunityModal" type="button">×</button><span class="eyebrow">PROTECTED INSPECTION</span><h2>'+esc(c.name||"Community")+'</h2><p>'+esc(c.description||"No description")+'</p><div class="community-detail-grid"><div><strong>Type</strong><span>'+esc(data.type||"—")+'</span></div><div><strong>Status</strong><span>'+esc(m.status||"normal")+'</span></div><div><strong>Members</strong><span>'+members.length.toLocaleString()+'</span></div><div><strong>Reports</strong><span>'+reports.length.toLocaleString()+'</span></div>'+(data.type==="channel"?'<div><strong>Posts returned</strong><span>'+posts.length.toLocaleString()+'</span></div>':"")+'</div><div class="community-detail-section"><strong>Moderation reason</strong><p>'+esc(m.reason||"No moderation reason recorded.")+'</p></div><div class="community-detail-section"><strong>Created</strong><p>'+formatDate(c.created_at)+'</p></div></div></div>');
    $("closeCommunityModal")?.addEventListener("click",closeDetails);
    $("communityDetailModal")?.addEventListener("click",e=>{if(e.target.id==="communityDetailModal")closeDetails();});
  }catch(error){alert(error?.message||"Unable to load community details.");}
}

function renderError(error){
  const list=$("directoryList");
  if(list)list.innerHTML='<article class="empty-card denied"><strong>Unable to load protected data</strong><p>'+esc(error?.message||"Administrator request failed.")+'</p></article>';
}

function setupTabs(){
  document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",async()=>{
    document.querySelectorAll(".tab").forEach(tab=>tab.classList.remove("active"));
    button.classList.add("active");
    $("searchInput").placeholder=button.dataset.tab==="groups"?"Search groups...":"Search channels...";
    try{await loadDirectory();}catch(error){renderError(error);}
  }));
}

function setupSearch(){
  let timer;
  $("searchInput")?.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(()=>loadDirectory().catch(renderError),250);});
  $("statusFilter")?.addEventListener("change",()=>loadDirectory().catch(renderError));
}

function setupEvents(){
  $("refreshBtn")?.addEventListener("click",()=>location.reload());
  $("signOutBtn")?.addEventListener("click",secureSignOut);
  setupTabs();
  setupSearch();
}

async function init(){
  setupEvents();
  const valid=await verifyAdminSession();
  show("loadingState",false);
  if(!valid){show("deniedState",true);show("adminContent",false);return;}
  show("deniedState",false);show("adminContent",true);
  try{await Promise.all([loadOverview(),loadDirectory()]);}catch(error){console.error(error);renderError(error);}
}

document.addEventListener("DOMContentLoaded",init);
