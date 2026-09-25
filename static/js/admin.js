(() => {
"use strict";

const FN="https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";
const form=document.getElementById("adminLoginForm");
const msg=document.getElementById("adminMessage");
const email=document.getElementById("adminEmail");
const pass=document.getElementById("adminPassword");

if(!form||!window.ZakiChatAuth?.client)return;

let codeBox;

const say=t=>{if(msg)msg.textContent=t};

form.addEventListener("submit",async e=>{
e.preventDefault();

try{
say("Signing in...");

const {data,error}=await window.ZakiChatAuth.client.auth.signInWithPassword({
email:email.value.trim(),password:pass.value
});

if(error)throw error;

const r=await fetch(FN,{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${data.session.access_token}`
},
body:JSON.stringify({
action:"admin-verify"
})
});

const result=await r.json();

if(!r.ok||!result.adminSessionToken)
throw new Error(result.error||"Admin verification failed.");

sessionStorage.setItem("zakichat-admin-session",result.adminSessionToken);
sessionStorage.setItem("zakichat-admin-role",result.role||"");
sessionStorage.setItem("zakichat-admin-expiry",result.expiresAt||"");

location.href="admin-control.html";

}catch(err){
say(err.message||"Admin sign-in failed.");
}
});
})();
