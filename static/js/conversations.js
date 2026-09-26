(function(){
"use strict";

const Z={
db:null,currentUser:null,conversations:[],selectedConversationId:null,

init(config,user){
this.db=window.ZakiChatAuth?.client;
this.currentUser=user||null;
return this.db&&this.currentUser?this:null;
},

async load(){
if(!this.db||!this.currentUser)
return{data:[],error:new Error("Not initialized.")};

try{
const me=this.currentUser.id;

const m=await this.db
.from("conversation_members")
.select("conversation_id,is_pinned,is_archived,is_favorite,is_muted,marked_unread")
.eq("user_id",me);

if(m.error)throw m.error;

const mine=m.data||[];
const cids=[...new Set(mine.map(x=>x.conversation_id).filter(Boolean))];

if(!cids.length){
this.conversations=[];
return{data:[],error:null};
}

const c=await this.db
.from("conversations")
.select("id,type,title,avatar_url,created_at,updated_at")
.in("id",cids);

if(c.error)throw c.error;

const convs=c.data||[];

const cm=await this.db
.from("conversation_members")
.select("conversation_id,user_id")
.in("conversation_id",cids);

if(cm.error)throw cm.error;

const otherIds=[...new Set(
(cm.data||[])
.map(x=>x.user_id)
.filter(x=>x&&x!==me)
)];

let profiles={};

if(otherIds.length){
const p=await this.db
.from("profiles")
.select("id,username,full_name,avatar_url,is_online,last_seen")
.in("id",otherIds);

if(p.error)throw p.error;
(p.data||[]).forEach(x=>profiles[x.id]=x);
}

const pref={};
mine.forEach(x=>pref[x.conversation_id]=x);

const members={};
(cm.data||[]).forEach(x=>{
(members[x.conversation_id]||=[]).push(x.user_id);
});

const out=[];

for(const c of convs){
const ids=members[c.id]||[];
const otherId=ids.find(x=>x!==me);
const p=otherId?profiles[otherId]||null:null;

const q=await this.db
.from("messages")
.select("id,sender_id,content,message_type,created_at,read_at,edited_at,reply_to_message_id,deleted_at")
.eq("conversation_id",c.id)
.is("deleted_at",null)
.order("created_at",{ascending:false})
.limit(1);

if(q.error)throw q.error;

const u=await this.db
.from("messages")
.select("id",{count:"exact",head:true})
.eq("conversation_id",c.id)
.neq("sender_id",me)
.is("read_at",null)
.is("deleted_at",null);

if(u.error)throw u.error;

out.push({
...c,
...(pref[c.id]||{}),
profile:p,
latestMessage:q.data?.[0]||null,
unreadCount:u.count||0
});
}

out.sort((a,b)=>{
if(a.is_pinned!==b.is_pinned)
return a.is_pinned?-1:1;

return new Date(
b.latestMessage?.created_at||
b.updated_at||
b.created_at
)-new Date(
a.latestMessage?.created_at||
a.updated_at||
a.created_at
);
});

this.conversations=out;
return{data:out,error:null};

}catch(error){
console.error("ZakiConversations.load failed:",error);
return{data:[],error};
}
},

getDisplayName(c){
if(!c)return"Conversation";
if(c.type==="group")return c.title||"Group";
return c.profile?.full_name||
c.profile?.username||
"ZakiChat User";
},

getAvatar(c){
return c?.type==="group"
?(c.avatar_url||"")
:(c?.profile?.avatar_url||"");
},

getPreview(c){
const m=c?.latestMessage;
if(!m)return"No messages yet";
if(m.message_type&&m.message_type!=="text")
return m.message_type.charAt(0).toUpperCase()+m.message_type.slice(1);
return m.content||"Message";
},

getTime(c){
const v=c?.latestMessage?.created_at||c?.updated_at||c?.created_at;
if(!v)return"";
const d=new Date(v);
return Number.isNaN(d.getTime())?"":d.toLocaleTimeString([],{
hour:"2-digit",minute:"2-digit"
});
},

select(id){
const c=this.conversations.find(x=>x.id===id);
if(!c)return null;
this.selectedConversationId=id;
return c;
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
