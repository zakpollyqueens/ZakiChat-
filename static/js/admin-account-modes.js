(function(){
"use strict";
const $=id=>document.getElementById(id);
const API=(window.ZakiChatConfig?.supabaseUrl||"https://xdpevlurgtvgduwzyoue.supabase.co")+"/functions/v1/admin-content";
const KEY=window.ZakiChatConfig?.supabaseKey||"";
const TOKEN_KEY="zakichat-admin-session";
let accounts=[],filter="all",selectedId="";
const escapeText=value=>String(value??"");
function token(){return localStorage.getItem(TOKEN_KEY)||""}
async function request(action,extra={}){
 const adminSessionToken=token();
 if(!adminSessionToken)throw new Error("Your administrator session is missing. Sign in to the Admin Control Center again.");
 const response=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY,"Authorization":"Bearer "+KEY},body:JSON.stringify({action,adminSessionToken,...extra})});
 const raw=await response.text();let data={};
 try{data=raw?JSON.parse(raw):{}}catch(_){}
 if(!response.ok||data.success===false){
  const reason=data.error||data.message||data.msg||("Server returned HTTP "+response.status+(raw?" with a non-standard response":" without a response body"));
  throw new Error(reason);
 }
 return data;
}
function showError(message){$("accountError").hidden=false;$("accountError").textContent=message;$("accountLoadStatus").textContent="Unable to load"}
function clearError(){$("accountError").hidden=true;$("accountError").textContent=""}
function modeLabel(account){
 if(account.account_mode==="personal_customized")return "Customized Personal";
 if(account.account_mode==="business_customized")return "Customized Business";
 if(account.active_personal)return "Personal plan active";
 if(account.active_business)return "Business plan active";
 return "Customized access";
}
function isBusiness(account){return account.account_mode==="business_customized"||account.active_business}
function avatar(name,url,large=false){
 const el=document.createElement("span");el.className="account-avatar";
 if(url){const img=document.createElement("img");img.src=url;img.alt="";img.referrerPolicy="no-referrer";img.onerror=()=>{el.textContent=(name||"Z").trim().charAt(0).toUpperCase()||"Z"};el.appendChild(img)}
 else el.textContent=(name||"Z").trim().charAt(0).toUpperCase()||"Z";
 return el;
}
function badge(text,business=false,inactive=false){const el=document.createElement("span");el.className="account-badge"+(business?" business":"")+(inactive?" inactive":"");el.textContent=text;return el}
function card(account){
 const button=document.createElement("button");button.type="button";button.className="account-card";button.addEventListener("click",()=>loadDetails(account.id));
 button.appendChild(avatar(account.full_name||account.username,account.avatar_url));
 const copy=document.createElement("span");copy.className="account-card-copy";
 const name=document.createElement("strong");name.textContent=account.full_name||account.username||"Unnamed account";
 const id=document.createElement("small");id.textContent=(account.username?"@"+account.username+" · ":"")+(account.email||account.phone||account.id);
 const badges=document.createElement("span");badges.className="account-card-meta";badges.appendChild(badge(modeLabel(account),isBusiness(account)));
 if(account.active_personal||account.active_business)badges.appendChild(badge("Paid access active"));
 else badges.appendChild(badge("No active plan",false,true));
 copy.append(name,id,badges);button.append(copy);
 const arrow=document.createElement("span");arrow.className="account-card-arrow";arrow.textContent="›";button.appendChild(arrow);
 return button;
}
function renderList(){
 const root=$("accountList");root.replaceChildren();
 const q=$("accountSearch").value.trim().toLowerCase();
 const visible=accounts.filter(a=>(filter==="all"||(filter==="personal"&&!isBusiness(a))||(filter==="business"&&isBusiness(a)))&&(!q||[a.full_name,a.username,a.email,a.phone,a.id,a.account_mode,modeLabel(a)].join(" ").toLowerCase().includes(q)));
 $("accountCount").textContent=String(accounts.length);
 if(!visible.length){const empty=document.createElement("div");empty.className="account-empty";empty.textContent=accounts.length?"No accounts match this filter or search.":"No customized accounts were found yet.";root.appendChild(empty);return}
 visible.forEach(a=>root.appendChild(card(a)));
}
function field(label,value){
 const row=document.createElement("div");row.className="detail-field";
 const name=document.createElement("span");name.textContent=label;
 const val=document.createElement("strong");val.textContent=value===null||value===undefined||value===""?"Not provided":String(value);
 row.append(name,val);return row;
}
function panel(title){const el=document.createElement("section");el.className="detail-panel";const h=document.createElement("h3");h.textContent=title;el.appendChild(h);return el}
function date(value){if(!value)return "Not recorded";const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString()}
function renderDetails(a){
 const root=$("accountDetailContent");root.replaceChildren();
 const profile=document.createElement("div");profile.className="detail-profile";profile.appendChild(avatar(a.full_name||a.username,a.avatar_url,true));
 const copy=document.createElement("div");copy.className="detail-profile-copy";
 const h=document.createElement("h3");h.textContent=a.full_name||a.username||"ZakiChat account";
 const username=document.createElement("p");username.textContent=a.username?"@"+a.username:"Username not set";
 const email=document.createElement("p");email.textContent=a.email||a.phone||"Contact information unavailable";
 const badges=document.createElement("div");badges.className="detail-badges";badges.appendChild(badge(modeLabel(a),isBusiness(a)));
 badges.appendChild(badge(a.active_personal?"Personal entitlement active":a.active_business?"Business entitlement active":"No current paid entitlement",false,!(a.active_personal||a.active_business)));
 copy.append(h,username,email,badges);profile.appendChild(copy);root.appendChild(profile);
 const grid=document.createElement("div");grid.className="detail-grid";
 const info=panel("Profile details");
 [["Full name",a.full_name],["Username",a.username?("@"+a.username):""],["Email",a.email],["Phone",a.phone],["About",a.bio],["Location",a.location],["Birthday",a.birthday],["Profile color",a.profile_color],["Account created",date(a.created_at)],["Profile updated",date(a.updated_at)]].forEach(([k,v])=>info.appendChild(field(k,v)));
 grid.appendChild(info);
 const entitlement=panel("Account mode & subscriptions");
 entitlement.appendChild(field("Account mode",a.account_mode||"local"));
 entitlement.appendChild(field("Mode last updated",date(a.preference_updated_at)));
 entitlement.appendChild(field("Active Personal access",a.active_personal?"Yes":"No"));
 entitlement.appendChild(field("Active Business access",a.active_business?"Yes":"No"));
 if(!(a.upgrades||[]).length)entitlement.appendChild(field("Subscription history","No subscription records"));
 (a.upgrades||[]).forEach((u,i)=>{const plan=u.plan==="personal_monthly"?"Customized Personal":u.plan==="business_monthly"?"Customized Business":u.plan;entitlement.appendChild(field("Plan "+(i+1),plan+" · "+u.status+" · "+(u.currency||"USD")+" "+u.price_usd+" · expires "+date(u.expires_at)))});
 grid.appendChild(entitlement);root.appendChild(grid);
 const workspaces=Array.isArray(a.business_workspaces)?a.business_workspaces:[];
 if(workspaces.length){
  const workspacePanel=panel("Business workspaces · "+workspaces.length);
  workspaces.forEach((w,index)=>{
   const section=document.createElement("div");section.className="detail-post";
   const title=document.createElement("h4");title.textContent=w.business_name||w.business_title||("Business workspace "+(index+1));title.style.margin="0 0 8px";
   section.appendChild(title);
   [["Business title",w.business_title],["Business email",w.business_email],["Description",w.description],["Business identity enabled",w.business_identity_enabled?"Yes":"No"],["Personal profile name",w.personal_profile_name],["Personal profile bio",w.personal_profile_bio],["Workspace created",date(w.created_at)]].forEach(([k,v])=>section.appendChild(field(k,v)));
   if(w.logo_url){const logo=document.createElement("img");logo.src=w.logo_url;logo.alt="Business logo";logo.loading="lazy";logo.referrerPolicy="no-referrer";logo.style.cssText="display:block;max-width:100px;max-height:70px;object-fit:contain;margin:10px 0;border-radius:10px";section.appendChild(logo)}
   const members=(a.business_members||[]).filter(m=>m.business_id===w.id);
   const memberTitle=document.createElement("h4");memberTitle.textContent="Team members · "+members.length;memberTitle.style.margin="14px 0 8px";section.appendChild(memberTitle);
   if(!members.length){const empty=document.createElement("p");empty.className="detail-post";empty.textContent="No staff or invitations recorded.";section.appendChild(empty)}
   members.forEach(m=>{const row=document.createElement("div");row.className="detail-post";const name=document.createElement("p");name.textContent=m.display_name||m.email||m.phone||"Invited member";const meta=document.createElement("small");meta.textContent=[m.role||"member",m.status||"unknown status",m.email,m.phone,date(m.created_at)].filter(Boolean).join(" · ");row.append(name,meta);section.appendChild(row)});
   workspacePanel.appendChild(section);
  });
  root.appendChild(workspacePanel);
 }else if(isBusiness(a)){
  const emptyWorkspace=panel("Business workspace");const p=document.createElement("p");p.className="detail-post";p.textContent="No business workspace has been created for this account yet.";emptyWorkspace.appendChild(p);root.appendChild(emptyWorkspace);
 }
 if(isBusiness(a)){const note=document.createElement("div");note.className="detail-note";note.textContent=a.business_workspace_note||"Business workspace details are shown when available.";root.appendChild(note)}

 const postsPanel=panel("Profile posts");
 const posts=(a.posts||[]).filter(p=>!p.archived);
 if(!posts.length){const p=document.createElement("p");p.className="detail-post";p.textContent="No active profile posts.";postsPanel.appendChild(p)}
 posts.forEach(post=>{const item=document.createElement("div");item.className="detail-post";const body=document.createElement("p");body.textContent=post.body;const meta=document.createElement("small");meta.textContent=date(post.created_at)+(post.archived?" · Archived":"");item.append(body,meta);postsPanel.appendChild(item)});
 root.appendChild(postsPanel);
 $("accountDetail").hidden=false;
}
async function loadDetails(id){
 selectedId=id;$("accountDetail").hidden=false;$("accountDetailContent").textContent="Loading protected account details…";
 $("accountDetail").scrollIntoView({behavior:"smooth",block:"start"});
 try{const data=await request("admin-customized-account-details",{userId:id});renderDetails(data.account)}
 catch(error){$("accountDetailContent").textContent=error.message||"Unable to load this account."}
}
async function loadList(){
 clearError();$("accountLoadStatus").textContent="Verifying protected access…";$("accountList").replaceChildren();
 const loading=document.createElement("div");loading.className="account-empty";const spinner=document.createElement("span");spinner.className="account-loader";const text=document.createElement("p");text.textContent="Loading customized accounts…";loading.append(spinner,text);$("accountList").appendChild(loading);
 try{const data=await request("admin-customized-account-list");accounts=Array.isArray(data.accounts)?data.accounts:[];renderList();$("accountLoadStatus").textContent="Protected account data loaded";if(selectedId){const still=accounts.find(a=>a.id===selectedId);if(still)await loadDetails(selectedId)}}
 catch(error){showError(error.message||"Unable to load customized accounts.");$("accountList").replaceChildren();const empty=document.createElement("div");empty.className="account-empty";empty.textContent="Account directory is unavailable until the protected admin request succeeds."; $("accountList").appendChild(empty)}
}
$("accountSearch").addEventListener("input",()=>{renderList();$("clearAccountSearch").hidden=!$("accountSearch").value});
$("clearAccountSearch").addEventListener("click",()=>{$("accountSearch").value="";$("clearAccountSearch").hidden=true;renderList()});
document.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>{filter=button.dataset.mode;document.querySelectorAll("[data-mode]").forEach(x=>x.classList.toggle("is-active",x===button));renderList()}));
$("accountRefresh").addEventListener("click",loadList);
$("closeAccountDetail").addEventListener("click",()=>{$("accountDetail").hidden=true;selectedId=""});
loadList();
})();