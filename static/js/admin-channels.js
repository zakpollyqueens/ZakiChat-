"use strict";

const FN="https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";
const SESSION_KEY="zakichat-admin-session";
const ROLE_KEY="zakichat-admin-role";
const EXPIRY_KEY="zakichat-admin-expiry";

const $=id=>document.getElementById(id);

function token(){return localStorage.getItem(SESSION_KEY)}

function clearSession(){
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}

function show(id,on){
  $(id)?.classList.toggle("hidden",!on);
}

async function rpc(name,body){
  const cfg=window.ZakiChatConfig;
  if(!cfg?.supabaseUrl||!cfg?.supabaseKey)throw new Error("Supabase configuration is unavailable.");
  const map={
    admin_list_groups:"admin-list-groups",
    admin_list_channels:"admin-list-channels",
    admin_community_overview:"admin-community-overview",
    admin_community_details:"admin-community-details"
  };
  if(map[name]){
    const payload={action:map[name],adminSessionToken:body?.p_token};
    if(name==="admin_list_groups"||name==="admin_list_channels"){
      payload.search=body?.p_search||"";
      payload.status=body?.p_status||"all";
    }
    if(name==="admin_community_details"){
      payload.communityType=body?.p_community_type;
      payload.communityId=body?.p_community_id;
    }
    const res=await fetch(cfg.supabaseUrl+"/functions/v1/admin-content",{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.supabaseKey,"Authorization":"Bearer "+cfg.supabaseKey},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.success!==true)throw new Error(data.error||"Administrator request failed.");
    return data.result;
  }
  const res=await fetch(cfg.supabaseUrl+"/rest/v1/rpc/"+name,{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.supabaseKey},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>null);
  if(!res.ok)throw new Error(data?.message||data?.error_description||data?.hint||data?.details||data?.error||"Administrator request failed.");
  return data;
}

async function verify(){
  const t=token();
  if(!t)return false;

  const expiry=(Date.parse(localStorage.getItem(EXPIRY_KEY)||"")||Number(localStorage.getItem(EXPIRY_KEY)||0));

  if(expiry&&Date.now()>=expiry){
    clearSession();
    return false;
  }

  try {
    const cfg = window.ZakiChatConfig;
    if (!cfg?.supabaseKey) return false;
    const response = await fetch(FN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": cfg.supabaseKey,
        "Authorization": "Bearer " + cfg.supabaseKey
      },
      body: JSON.stringify({ action: "admin-session-verify", adminSessionToken: t })
    });
    const data = await response.json().catch(() => ({}));
    return response.ok && (data.success === true || data.valid === true || data.active === true);
  }catch(e){
    console.error(e);
    return false;
  }
}

async function signOut(){
  const t=token();

  try{
    if(t){
      const cfg=window.ZakiChatConfig;
      if(cfg?.supabaseKey)await fetch(FN,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "apikey":cfg.supabaseKey,
          "Authorization":"Bearer "+cfg.supabaseKey
        },
        body:JSON.stringify({action:"admin-session-revoke",adminSessionToken:t})
      });
    }
  }catch(e){}

  clearSession();
  location.href="admin.html";
}

function esc(v){
  return String(v??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function setOverview(data){
  $("channelCount").textContent=
    Number(data?.channels||0).toLocaleString();

  $("subscriberCount").textContent=
    Number(data?.subscribers||0).toLocaleString();

  $("reportCount").textContent=
    Number(data?.open_reports||0).toLocaleString();
}

function render(rows){
  const list=$("directoryList");

  if(!Array.isArray(rows)||!rows.length){
    list.innerHTML='<div class="empty">No matching channels found.</div>';
    return;
  }

  list.innerHTML=rows.map(x=>{
    const status=x.moderation_status||"normal";
    return `
      <button class="channel-card" type="button"
        data-id="${esc(x.id)}">

        <span class="avatar">📣</span>

        <span class="info">
          <strong>${esc(x.name||"Unnamed channel")}</strong>
          <p>${esc(x.handle?"@"+x.handle:(x.description||"No description"))}</p>
          <small>
            ${Number(x.subscriber_count||0).toLocaleString()}
            subscribers
            ${Number(x.open_report_count||0)?
              " • "+Number(x.open_report_count)+" open reports":""}
          </small>
        </span>

        <span class="status">
          ${esc(status.replaceAll("_"," "))}
        </span>
      </button>
    `;
  }).join("");

  list.querySelectorAll(".channel-card")
    .forEach(card=>{
      card.addEventListener("click",()=>details(card.dataset.id));
    });
}

async function load(){
  const search=$("searchInput")?.value.trim()||"";
  const status=$("statusFilter")?.value||"all";

  const rows=await rpc(
    "admin_list_channels",
    {
      p_token:token(),
      p_search:search,
      p_status:status
    }
  );

  render(rows);
}

async function overview(){
  const data=await rpc(
    "admin_community_overview",
    {p_token:token()}
  );

  setOverview(data);
}

async function details(id){
  try{
    const data=await rpc(
      "admin_community_details",
      {
        p_token:token(),
        p_community_type:"channel",
        p_community_id:id
      }
    );

    const c=data?.community||{};
    const m=data?.moderation||{};
    const reports=data?.reports||[];
    const posts=data?.posts||[];

    alert(
      "Channel: "+(c.name||"Unnamed")+
      "\n\n"+
      "Handle: "+(c.handle?"@"+c.handle:"—")+
      "\nStatus: "+(m.status||"normal")+
      "\nSubscribers: "+posts.length+
      "\nReports: "+reports.length+
      "\n\nThis is protected administrator inspection."
    );
  }catch(e){
    alert(e?.message||"Unable to load channel details.");
  }
}

let timer;

function setup(){
  $("refreshBtn")?.addEventListener(
    "click",()=>location.reload()
  );

  $("signOutBtn")?.addEventListener(
    "click",signOut
  );

  $("searchInput")?.addEventListener(
    "input",()=>{
      clearTimeout(timer);
      timer=setTimeout(
        ()=>load().catch(e=>renderError(e)),
        250
      );
    }
  );

  $("statusFilter")?.addEventListener(
    "change",
    ()=>load().catch(e=>renderError(e))
  );
}

function renderError(e){
  $("directoryList").innerHTML=
    '<div class="empty">'+
    esc(e?.message||"Unable to load protected data.")+
    '</div>';
}

async function init(){
  setup();

  const valid=await verify();

  show("loadingState",false);

  if(!valid){
    show("deniedState",true);
    show("content",false);
    return;
  }

  show("deniedState",false);
  show("content",true);

  try{
    await Promise.all([overview(),load()]);
  }catch(e){
    console.error(e);
    renderError(e);
  }
}

document.addEventListener("DOMContentLoaded",init);
