(function(){
"use strict";

const Z={
db:null,user:null,conversations:[],selectedConversationId:null,

init(_,user){
this.db=window.ZakiChatAuth?.client;
this.user=user||null;
return this;
},

async load(){
const db=this.db,user=this.user;
if(!db||!user)
return{data:[],error:new Error("Not signed in")};

try{
const me=user.id;

const m=await db.from("conversation_members")
.select("conversation_id")
.eq("user_id",me);

if(m.error)throw m.error;

const ids=[...new Set((m.data||[])
.map(x=>x.conversation_id).filter(Boolean))];

if(!ids.length){
this.conversations=[];
return{data:[],error:null};
}

const c=await db.from("conversations")
.select("id,type,title,avatar_url,created_at,updated_at")
.in("id",ids);

if(c.error)throw c.error;

const cm=await db.from("conversation_members")
.select("conversation_id,user_id")
.in("conversation_id",ids);

if(cm.error)throw cm.error;

const memberMap={};
(cm.data||[]).forEach(x=>{
(memberMap[x.conversation_id]||(memberMap[x.conversation_id]=[]))
.push(x.user_id);
});

const otherIds=[...new Set(
(cm.data||[]).map(x=>x.user_id).filter(x=>x&&x!==me)
)];

let profiles={};

if(otherIds.length){
const p=await db.from("profiles")
.select("id,username,full_name,avatar_url,is_online,last_seen")
.in("id",otherIds);

if(p.error)throw p.error;
(p.data||[]).forEach(x=>profiles[x.id]=x);
}

let groups={};

const groupIds=(c.data||[])
.filter(x=>x.type==="group")
.map(x=>x.id);

if(groupIds.length){
const g=await db.from("groups")
.select("id,conversation_id,name,description,avatar_url")
.in("conversation_id",groupIds);

if(!g.error)
(g.data||[]).forEach(x=>groups[x.conversation_id]=x);
}

let prefs={};

try{
const p=await db.from("conversation_members")
.select("conversation_id,is_pinned,is_archived,is_favorite,is_muted,marked_unread")
.eq("user_id",me)
.in("conversation_id",ids);

if(!p.error)
(p.data||[]).forEach(x=>prefs[x.conversation_id]=x);
}catch(_){}

const messages=await db.from("messages")
.select("id,conversation_id,sender_id,content,message_type,created_at,read_at,edited_at,reply_to_message_id,deleted_at")
.in("conversation_id",ids)
.is("deleted_at",null)
.order("created_at",{ascending:false})
.limit(500);

if(messages.error)throw messages.error;

const latest={};
(messages.data||[]).forEach(x=>{
if(!latest[x.conversation_id])
latest[x.conversation_id]=x;
});

const unread={};

for(const id of ids){
const u=await db.from("messages")
.select("id",{count:"exact",head:true})
.eq("conversation_id",id)
.neq("sender_id",me)
.is("read_at",null)
.is("deleted_at",null);

if(!u.error)unread[id]=u.count||0;
}

const out=(c.data||[]).map(conv=>{
const pref=prefs[conv.id]||{};
const group=groups[conv.id];

let profile=null;

if(conv.type==="direct"){
const other=(memberMap[conv.id]||[]).find(x=>x!==me);
profile=other?profiles[other]||null:null;
}

return{
...conv,
title:group?.name||conv.title||null,
avatar_url:group?.avatar_url||conv.avatar_url||null,
profile,
is_pinned:!!pref.is_pinned,
is_archived:!!pref.is_archived,
is_favorite:!!pref.is_favorite,
is_muted:!!pref.is_muted,
marked_unread:!!pref.marked_unread,
latestMessage:latest[conv.id]||null,
unreadCount:unread[conv.id]||0
};
});

out.sort((a,b)=>{
if(a.is_pinned!==b.is_pinned)
return a.is_pinned?-1:1;

const at=a.latestMessage?.created_at||a.updated_at||a.created_at;
const bt=b.latestMessage?.created_at||b.updated_at||b.created_at;

return new Date(bt)-new Date(at);
});

this.conversations=out;

return{data:out,error:null};

}catch(error){
console.error("ZakiConversations:",error);
return{data:[],error};
}
},

getDisplayName(c){
if(c?.type==="group")
return c.title||"Group";

return c?.profile?.full_name||
c?.profile?.username||
"ZakiChat User";
},

getAvatar(c){
return c?.avatar_url||
c?.profile?.avatar_url||
"";
},

getPreview(c){
const m=c?.latestMessage;

if(!m)return"No messages yet";

if(m.message_type&&m.message_type!=="text")
return m.message_type.charAt(0).toUpperCase()+
m.message_type.slice(1);

return m.content||"Message";
},

getTime(c){
const v=c?.latestMessage?.created_at||
c?.updated_at||
c?.created_at;

if(!v)return"";

const d=new Date(v);

if(Number.isNaN(d.getTime()))
return"";

return d.toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
});
},

select(id){
this.selectedConversationId=id;
return this.find(id);
},

find(id){
return this.conversations.find(x=>x.id===id)||null;
},

findByUserId(id){
return this.conversations.find(
x=>x.profile?.id===id
)||null;
}
};

window.ZakiConversations=Z;
})();
