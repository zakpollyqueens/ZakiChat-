(function(){
"use strict";
const links=[...document.querySelectorAll(".tg-zakiplay-launch")];
if(!links.length)return;
async function update(link){
 const lock=link.querySelector(".zplay-lock-badge");
 try{
  const client=window.ZakiChatAuth&&window.ZakiChatAuth.client;
  if(!client)return;
  const {data:sessionData}=await client.auth.getSession();
  const user=sessionData&&sessionData.session&&sessionData.session.user;
  if(!user)return;
  const {data,error}=await client.from("user_upgrades").select("id")
   .eq("user_id",user.id).eq("plan","personal_monthly").eq("status","active")
   .gt("expires_at",new Date().toISOString()).limit(1).maybeSingle();
  if(error)throw error;
  const entitled=!!data;
  link.classList.toggle("is-unlocked",entitled);
  link.setAttribute("aria-label",entitled?"Open ZakiPlay entertainment hub":"ZakiPlay is locked. Customized Personal access required");
  link.title=entitled?"ZakiPlay":"ZakiPlay · Customized Personal";
  if(lock)lock.hidden=entitled;
 }catch(error){console.warn("ZakiPlay launcher access check failed:",error)}
}
links.forEach(link=>update(link));
})();