document.addEventListener("DOMContentLoaded",async()=>{
"use strict";

const list=document.querySelector("#conversation-list");

if(!list)return;

const db=window.ZakiChatAuth?.client;

if(!db){
list.innerHTML='<div class="conversation-empty">Unable to connect to ZakiChat.</div>';
return;
}

let user=null;
let filter="all";
let timer=null;

function name(c){
return window.ZakiConversations.getDisplayName(c);
}

function avatar(c){
const box=document.createElement("div");
box.className="conversation-avatar";

const url=window.ZakiConversations.getAvatar(c);

if(url){
box.style.backgroundImage=`url("${url}")`;
box.style.backgroundSize="cover";
box.style.backgroundPosition="center";
}else{
box.textContent=name(c)
.split(/\s+/)
.slice(0,2)
.map(x=>x[0]?.toUpperCase()||"")
.join("")||"Z";
}

if(c.type==="group")
box.classList.add("group-avatar");

return box;
}

function filtered(data){
return data.filter(c=>{
if(c.is_archived)return false;

if(filter==="unread")
return c.unreadCount>0||c.marked_unread;

if(filter==="favorites")
return c.is_favorite;

if(filter==="groups")
return c.type==="group";

return true;
});
}

function render(data){
list.innerHTML="";

const rows=filtered(data);

if(!rows.length){
const empty=document.createElement("div");
empty.className="conversation-empty";
empty.textContent=
filter==="unread"?"No unread conversations":
filter==="favorites"?"No favorite conversations":
filter==="groups"?"No group conversations":
"No conversations yet.";
list.appendChild(empty);
return;
}

rows.forEach(c=>{
const link=document.createElement("a");

link.className="conversation";
link.href=c.type==="group"
?`groups.html?id=${encodeURIComponent(c.id)}`
:`chat.html?user=${encodeURIComponent(c.profile?.id||"")}`;

const info=document.createElement("div");
info.className="conversation-info";

const line1=document.createElement("div");
line1.className="conversation-line";

const strong=document.createElement("strong");
strong.textContent=name(c);

const time=document.createElement("time");
time.textContent=window.ZakiConversations.getTime(c);

line1.append(strong,time);

const line2=document.createElement("div");
line2.className="conversation-line";

const preview=document.createElement("span");
preview.className="conversation-preview";
preview.textContent=window.ZakiConversations.getPreview(c);

line2.appendChild(preview);

if(c.unreadCount>0){
const badge=document.createElement("span");
badge.className="unread-badge";
badge.textContent=c.unreadCount>99?"99+":c.unreadCount;
line2.appendChild(badge);
}

info.append(line1,line2);
link.append(avatar(c),info);

link.addEventListener("click",()=>{
window.ZakiConversations.select(c.id);
});

list.appendChild(link);
});
}

async function refresh(){
const result=await window.ZakiConversations.load();

if(result.error){
console.error("ZakiChat conversation list:",result.error);

list.innerHTML=
'<div class="conversation-empty">Unable to load conversations. Check your connection and sign-in session.</div>';

return;
}

render(result.data||[]);
}

document.querySelectorAll("[data-filter]").forEach(button=>{
button.addEventListener("click",()=>{
document.querySelectorAll("[data-filter]")
.forEach(x=>x.classList.remove("active"));

button.classList.add("active");
filter=button.dataset.filter||"all";

render(window.ZakiConversations.conversations||[]);
});
});

const search=document.querySelector(
'.search-box input[type="search"]'
);

if(search){
search.addEventListener("input",()=>{
const q=search.value.trim().toLowerCase();

let data=window.ZakiConversations.conversations||[];

if(q){
data=data.filter(c=>
name(c).toLowerCase().includes(q)||
window.ZakiConversations
.getPreview(c)
.toLowerCase()
.includes(q)
);
}

render(data);
});
}

const session=await db.auth.getSession();

user=session.data?.session?.user||null;

if(!user){
list.innerHTML=
'<div class="conversation-empty">Please sign in to view your conversations.</div>';
return;
}

window.ZakiConversations.init(
window.ZakiChatConfig,
user
);

await refresh();

if(window.ZakiRealtime){
window.ZakiRealtime.init(
window.ZakiChatConfig
);

window.ZakiRealtime.subscribeToAllMessages(
()=>{clearTimeout(timer);timer=setTimeout(refresh,300);}
);

window.ZakiRealtime.subscribe(
"conversation-list-members",
"conversation_members",
`user_id=eq.${user.id}`,
()=>{clearTimeout(timer);timer=setTimeout(refresh,300);},
"*"
);

window.ZakiRealtime.subscribe(
"conversation-list-conversations",
"conversations",
null,
()=>{clearTimeout(timer);timer=setTimeout(refresh,300);},
"*"
);
}

window.addEventListener("beforeunload",()=>{
if(window.ZakiRealtime){
window.ZakiRealtime.unsubscribe("messages:all");
window.ZakiRealtime.unsubscribe("conversation-list-members");
window.ZakiRealtime.unsubscribe("conversation-list-conversations");
}
});
});
