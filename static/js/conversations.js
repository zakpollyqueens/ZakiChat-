(function(){
"use strict";

const Z={
db:null,currentUser:null,conversations:[],selectedConversationId:null,

init(config,user){
this.db=window.ZakiChatAuth?.client;
if(!this.db||!user)return null;
this.currentUser=user;
return this;
},

async load(){
if(!this.db||!this.currentUser)
return{data:[],error:new Error("Not initialized.")};

const {data:rows,error}=await this.db
.from("conversation_members")
.select(`
conversation_id,is_pinned,is_archived,is_favorite,is_muted,marked_unread,
conversations(id,type,title,avatar_url,created_at,updated_at,
conversation_members(user_id))
`)
.eq("user_id",this.currentUser.id);

if(error)return{data:[],error};

const base=(rows||[])
.map(r=>({...r.conversations,
is_pinned:!!r.is_pinned,
is_archived:!!r.is_archived,
is_favorite:!!r.is_favorite,
is_muted:!!r.is_muted,
marked_unread:!!r.marked_unread}))
.filter(c=>c&&c.id);

const ids=[...new Set(base.flatMap(c=>
(c.conversation_members||[])
.map(m=>m.user_id)
.filter(id=>id&&id!==this.currentUser.id)
))];

let profiles={};

if(ids.length){
const p=await this.db
.from("profiles")
.select("id,username,full_name,avatar_url,is_online,last_seen")
.in("id",ids);

if(!p.error)
(p.data||[]).forEach(x=>profiles[x.id]=x);
}

const enriched=[];

for(const c of base){
const other=(c.conversation_members||[])
.find(m=>m.user_id!==this.currentUser.id);

const profile=other?profiles[other.user_id]||null:null;

let latestMessage=null,unreadCount=0;

const latest=await this.db
.from("messages")
.select("id,sender_id,content,message_type,created_at,read_at,edited_at,reply_to_message_id,deleted_at")
.eq("conversation_id",c.id)
.is("deleted_at",null)
.order("created_at",{ascending:false})
.limit(1);

if(!latest.error)latestMessage=latest.data?.[0]||null;

const unread=await this.db
.from("messages")
.select("id",{count:"exact",head:true})
.eq("conversation_id",c.id)
.neq("sender_id",this.currentUser.id)
.is("read_at",null)
.is("deleted_at",null);

if(!unread.error)unreadCount=unread.count||0;

enriched.push({
...c,profile,latestMessage,unreadCount
});
}

enriched.sort((a,b)=>{
if(a.is_pinned!==b.is_pinned)
return a.is_pinned?-1:1;

const at=new Date(
a.latestMessage?.created_at||
a.updated_at||
a.created_at
).getTime();

const bt=new Date(
b.latestMessage?.created_at||
b.updated_at||
b.created_at
).getTime();

return bt-at;
});

this.conversations=enriched;

return{data:enriched,error:null};
},

getDisplayName(c){
if(!c)return"Conversation";
if(c.type==="group")return c.title||"Group";
return c.profile?.full_name||
c.profile?.username||
"ZakiChat User";
},

getAvatar(c){
if(!c)return"";
return c.type==="group"
?(c.avatar_url||"")
:(c.profile?.avatar_url||"");
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
c?.updated_at||c?.created_at;

if(!v)return"";

const d=new Date(v);
if(Number.isNaN(d.getTime()))return"";

return d.toLocaleTimeString([],{
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
if(!id)return null;
return this.conversations.find(
c=>c.profile?.id===id
)||null;
}
};

window.ZakiConversations=Z;
})();
