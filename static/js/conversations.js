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
const db=this.db,me=this.user?.id;
if(!db||!me)return{data:[],error:new Error("Not signed in")};

try{
const m=await db.from("conversation_members")
.select("conversation_id").eq("user_id",me);
if(m.error)throw m.error;

const ids=[...new Set((m.data||[]).map(x=>x.conversation_id).filter(Boolean))];

if(!ids.length){
this.conversations=[];
return{data:[],error:null};
}

const c=await db.from("conversations")
.select("id,type,created_at").in("id",ids);
if(c.error)throw c.error;

const cm=await db.from("conversation_members")
.select("conversation_id,user_id").in("conversation_id",ids);
if(cm.error)throw cm.error;

const members={};
(cm.data||[]).forEach(x=>
(members[x.conversation_id]||(members[x.conversation_id]=[])).push(x.user_id)
);

const otherIds=[...new Set(
(cm.data||[]).map(x=>x.user_id).filter(x=>x&&x!==me)
)];

const profiles={};

if(otherIds.length){
const p=await db.from("profiles")
.select("id,username,full_name,avatar_url")
.in("id",otherIds);
if(p.error)throw p.error;
(p.data||[]).forEach(x=>profiles[x.id]=x);
}

const msgs=await db.from("messages")
.select("id,conversation_id,sender_id,content,message_type,created_at,read_at")
.in("conversation_id",ids)
.order("created_at",{ascending:false})
.limit(500);

if(msgs.error)throw msgs.error;

const latest={};
(msgs.data||[]).forEach(x=>{
if(!latest[x.conversation_id])latest[x.conversation_id]=x;
});

const unread={};

for(const id of ids){
const u=await db.from("messages")
.select("id",{count:"exact",head:true})
.eq("conversation_id",id)
.neq("sender_id",me)
.is("read_at",null);

if(!u.error)unread[id]=u.count||0;
}

const out=(c.data||[]).map(conv=>{
const other=(members[conv.id]||[]).find(x=>x!==me);
const profile=other?profiles[other]||null:null;

return{
...conv,
profile,
latestMessage:latest[conv.id]||null,
unreadCount:unread[conv.id]||0,
is_pinned:false,
is_archived:false,
is_favorite:false,
is_muted:false,
marked_unread:false
};
});

out.sort((a,b)=>{
const at=a.latestMessage?.created_at||a.created_at;
const bt=b.latestMessage?.created_at||b.created_at;
return new Date(bt)-new Date(at);
});

this.conversations=out;
return{data:out,error:null};

}catch(error){
console.error("ZakiConversations LOAD ERROR:",error);
return{data:[],error};
}
},

getDisplayName(c){
return c?.profile?.full_name||
c?.profile?.username||
"ZakiChat User";
},

getAvatar(c){
return c?.profile?.avatar_url||"";
},

getPreview(c){
const m=c?.latestMessage;
if(!m)return"No messages yet";
if(m.message_type&&m.message_type!=="text")
return m.message_type.charAt(0).toUpperCase()+m.message_type.slice(1);
return m.content||"Message";
},

getTime(c){
const v=c?.latestMessage?.created_at||c?.created_at;
if(!v)return"";
const d=new Date(v);
return Number.isNaN(d.getTime())?"":d.toLocaleTimeString([],{
hour:"2-digit",minute:"2-digit"
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
return this.conversations.find(x=>x.profile?.id===id)||null;
}
};

window.ZakiConversations=Z;
})();
