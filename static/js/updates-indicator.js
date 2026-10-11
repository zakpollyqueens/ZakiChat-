(function(){
"use strict";
const link=document.querySelector(".tg-updates-launch");
if(!link)return;
const dot=link.querySelector(".tg-updates-dot");
async function refresh(){
 try{
  const client=window.ZakiChatAuth?.client;
  if(!client)return;
  const {data:session,error:sessionError}=await client.auth.getSession();
  if(sessionError)throw sessionError;
  const user=session?.session?.user;
  if(!user)return;
  const {data:statuses,error}=await client.from("status_updates").select("id,user_id,created_at").neq("user_id",user.id).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(200);
  if(error)throw error;
  const rows=statuses||[];
  let viewed=new Set();
  if(rows.length){
   const {data:views,error:viewError}=await client.from("status_views").select("status_id").eq("viewer_id",user.id).in("status_id",rows.map(row=>row.id));
   if(viewError)throw viewError;
   viewed=new Set((views||[]).map(row=>row.status_id));
  }
  const unseen=rows.some(row=>!viewed.has(row.id));
  link.classList.toggle("has-unseen",unseen);
  link.setAttribute("aria-label",unseen?"Open Updates · new status updates":"Open Updates");
  link.title=unseen?"Updates · new statuses":"Updates";
  if(dot)dot.hidden=!unseen;
 }catch(error){console.debug("Could not refresh Updates indicator",error);if(dot)dot.hidden=true}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh,{once:true});else refresh();
window.addEventListener("focus",refresh);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
})();