(function(){
"use strict";
const $=id=>document.getElementById(id);
const endpoint=()=>window.ZakiChatConfig?.supabaseUrl+"/functions/v1/business-workspace";
let client,user,workspace,memberRole="viewer",isOwner=false,hasBusinessPlan=false,members=[],tasks=[];
function notice(message,type="success"){const n=$("businessNotice");n.textContent=message;n.className="business-notice visible "+type;}
function clearNotice(){const n=$("businessNotice");n.textContent="";n.className="business-notice";}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
async function invoke(action,payload={}){const {data}=await client.auth.getSession();const token=data?.session?.access_token;if(!token)throw new Error("Please sign in again.");const response=await fetch(endpoint(),{method:"POST",headers:{"Content-Type":"application/json","apikey":window.ZakiChatConfig.supabaseKey,"Authorization":"Bearer "+token},body:JSON.stringify({action,...payload})});const result=await response.json().catch(()=>({}));if(!response.ok||result.success!==true)throw new Error(result.error||"Business request failed.");return result;}
async function loadPlan(){const {data,error}=await client.from("user_upgrades").select("plan,status,expires_at").eq("user_id",user.id).eq("status","active").gt("expires_at",new Date().toISOString()).order("expires_at",{ascending:false}).limit(1).maybeSingle();if(error)throw error;hasBusinessPlan=data?.plan==="business_monthly";return data?.plan||"local";}
async function uploadLogo(input){const file=input?.files?.[0];if(!file)return null;if(file.size>5*1024*1024)throw new Error("Business logo must be 5 MB or smaller.");if(!["image/png","image/jpeg","image/webp","image/svg+xml"].includes(file.type))throw new Error("Choose a PNG, JPG, WEBP or SVG logo.");const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=user.id+"/"+Date.now()+"-"+safe;const {error}=await client.storage.from("business-logos").upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;return client.storage.from("business-logos").getPublicUrl(path).data.publicUrl;}
function fillProfile(prefix,w){$(prefix+"BusinessName")&&($(prefix+"BusinessName").value=w.business_name||"");$(prefix+"BusinessTitle")&&($(prefix+"BusinessTitle").value=w.business_title||"");$(prefix+"BusinessEmail")&&($(prefix+"BusinessEmail").value=w.business_email||"");$(prefix+"BusinessDescription")&&($(prefix+"BusinessDescription").value=w.description||"");}
async function createWorkspace(event){
event.preventDefault();const btn=event.submitter;btn.disabled=true;
try{
  clearNotice();
  if(!hasBusinessPlan)throw new Error("An active Customized Business subscription is required to create a workspace.");
  const logo=await uploadLogo($("businessLogo"));
  const useIdentity=$("createBusinessIdentity").checked;
  const {data:profile,error:profileError}=await client.from("profiles").select("full_name,avatar_url,bio").eq("id",user.id).maybeSingle();
  if(profileError)throw profileError;
  const row={
    owner_user_id:user.id,
    business_name:$("businessName").value.trim(),
    business_title:$("businessTitle").value.trim(),
    business_email:$("businessEmail").value.trim(),
    description:$("businessDescription").value.trim(),
    logo_url:logo,
    business_identity_enabled:useIdentity,
    personal_profile_name:profile?.full_name||null,
    personal_profile_avatar_url:profile?.avatar_url||null,
    personal_profile_bio:profile?.bio||null
  };
  const {error}=await client.from("business_workspaces").insert(row);
  if(error)throw error;
  if(useIdentity){
    const {error:identityError}=await client.from("profiles").update({full_name:row.business_name,avatar_url:logo,bio:row.business_title,updated_at:new Date().toISOString()}).eq("id",user.id);
    if(identityError)notice("Workspace created, but the public profile could not be switched: "+identityError.message,"error");
    else notice("Business workspace created. Your public ZakiChat identity now displays the business profile.");
  }else notice("Business workspace created.");
  await loadWorkspace();
}catch(e){notice(e.message||"Could not create business workspace.","error");}
finally{btn.disabled=false;}
}
async function updateWorkspace(event){
event.preventDefault();const btn=event.submitter;btn.disabled=true;
try{
  clearNotice();
  const uploaded=await uploadLogo($("editBusinessLogo"));
  const useIdentity=$("editBusinessIdentity").checked;
  const businessName=$("editBusinessName").value.trim();
  const businessTitle=$("editBusinessTitle").value.trim();
  const row={business_name:businessName,business_title:businessTitle,business_email:$("editBusinessEmail").value.trim(),description:$("editBusinessDescription").value.trim(),updated_at:new Date().toISOString()};
  if(uploaded)row.logo_url=uploaded;
  if(useIdentity&&!workspace.business_identity_enabled){
    const {data:profile,error:profileError}=await client.from("profiles").select("full_name,avatar_url,bio").eq("id",user.id).maybeSingle();
    if(profileError)throw profileError;
    row.personal_profile_name=profile?.full_name||null;
    row.personal_profile_avatar_url=profile?.avatar_url||null;
    row.personal_profile_bio=profile?.bio||null;
    row.business_identity_enabled=true;
  }else if(!useIdentity&&workspace.business_identity_enabled){
    row.business_identity_enabled=false;
  }
  const {error}=await client.from("business_workspaces").update(row).eq("id",workspace.id);
  if(error)throw error;
  let identityMessage="Business profile saved.";
  if(useIdentity){
    const {error:identityError}=await client.from("profiles").update({full_name:businessName,avatar_url:uploaded||workspace.logo_url||null,bio:businessTitle,updated_at:new Date().toISOString()}).eq("id",user.id);
    if(identityError)identityMessage="Business profile saved, but public identity could not be updated: "+identityError.message;
    else identityMessage="Business profile saved. Your public ZakiChat identity shows the business profile.";
  }else if(workspace.business_identity_enabled){
    const {error:restoreError}=await client.from("profiles").update({full_name:workspace.personal_profile_name,avatar_url:workspace.personal_profile_avatar_url,bio:workspace.personal_profile_bio,updated_at:new Date().toISOString()}).eq("id",user.id);
    if(restoreError)identityMessage="Business profile saved, but personal identity could not be restored: "+restoreError.message;
    else identityMessage="Business profile saved. Your saved personal identity has been restored.";
  }
  notice(identityMessage);
  await loadWorkspace();
}catch(e){notice(e.message||"Could not save profile.","error");}
finally{btn.disabled=false;}
}
async function inviteStaff(event){event.preventDefault();const btn=event.submitter;btn.disabled=true;try{clearNotice();const phone=$("staffPhone").value.trim().replace(/[\s()-]/g,"");if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new Error("Enter the staff member's phone in international format, for example +2567XXXXXXXX.");const email=$("staffEmail").value.trim().toLowerCase();const {error}=await client.from("business_members").insert({business_id:workspace.id,phone,email:email||null,display_name:$("staffName").value.trim(),role:$("staffRole").value,status:"invited",invited_by:user.id});if(error)throw error;$("businessInviteForm").reset();notice("Invitation created for "+phone+". Ask the staff member to sign into ZakiChat with this phone and accept it from Business Workspace.");await loadMembers();}catch(e){notice(e.message||"Could not invite staff.","error");}finally{btn.disabled=false;}}
async function createTask(event){event.preventDefault();const btn=event.submitter;btn.disabled=true;try{clearNotice();const row={business_id:workspace.id,title:$("taskTitle").value.trim(),description:$("taskDescription").value.trim(),priority:$("taskPriority").value,assigned_to:$("taskAssignee").value||null,due_at:$("taskDue").value?new Date($("taskDue").value+"T23:59:59").toISOString():null,created_by:user.id};const {error}=await client.from("business_tasks").insert(row);if(error)throw error;$("businessTaskForm").reset();notice("Task created and assigned.");await loadTasks();}catch(e){notice(e.message||"Could not create task.","error");}finally{btn.disabled=false;}}
async function loadWorkspace(){const {data,error}=await client.from("business_workspaces").select("*").order("created_at",{ascending:false});if(error)throw error;const rows=data||[];if(!rows.length){await loadInvitations();const plan=await loadPlan();$("businessLocked").hidden=hasBusinessPlan;$("businessSetup").hidden=!hasBusinessPlan;$("businessWorkspace").hidden=true;if(!hasBusinessPlan)notice("No business workspace is linked to this account. Choose Customized Business to create one after payment is verified.","error");return;}
workspace=rows[0];isOwner=workspace.owner_user_id===user.id;const ownMembership=await client.from("business_members").select("role,status").eq("business_id",workspace.id).eq("user_id",user.id).eq("status","active").maybeSingle();memberRole=isOwner?"owner":(ownMembership.data?.role||"viewer");hasBusinessPlan=isOwner?await loadPlan()==="business_monthly":true;
$("businessLocked").hidden=true;$("businessSetup").hidden=true;$("businessWorkspace").hidden=false;
$("businessWorkspaceName").textContent=workspace.business_name;$("businessWorkspaceTitle").textContent=workspace.business_title||workspace.business_email;$("businessWorkspaceDescription").textContent=workspace.description||"";
const img=$("businessLogoPreview");if(workspace.logo_url){img.src=workspace.logo_url;img.hidden=false;}else{img.removeAttribute("src");img.hidden=true;}
fillProfile("edit",workspace);
$("editBusinessIdentity").checked=Boolean(workspace.business_identity_enabled);
const canManage=(isOwner&&hasBusinessPlan)||(memberRole==="manager"&&hasBusinessPlan);
$("businessProfilePanel").hidden=!isOwner||!hasBusinessPlan;$("businessInviteForm").hidden=!canManage;$("businessTaskForm").hidden=!canManage;
$("businessInvitations").hidden=true;
await Promise.all([loadMembers(),loadTasks()]);
}
async function loadInvitations(){try{const data=await invoke("list-invitations");const host=$("businessInvitationList");host.innerHTML="";if(!data.invitations?.length){$("businessInvitations").hidden=true;return;} $("businessInvitations").hidden=false;data.invitations.forEach(inv=>{const card=document.createElement("article");card.className="business-list-card";const name=inv.workspace?.business_name||"Business";card.innerHTML="<div class='business-card-top'><h3>"+esc(name)+"</h3><span class='business-tag'>"+esc(inv.role)+"</span></div><p>You have been invited to join this business workspace.</p><div class='business-card-actions'><button type='button' data-accept-invitation='"+esc(inv.id)+"'>Accept invitation</button></div>";host.appendChild(card);});host.querySelectorAll("[data-accept-invitation]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;try{await invoke("accept-invitation",{invitationId:b.dataset.acceptInvitation});notice("Invitation accepted.");await loadWorkspace();}catch(e){notice(e.message,"error");b.disabled=false;}}));}catch(e){console.warn("Could not load business invitations",e);}}
async function loadMembers(){const {data,error}=await client.from("business_members").select("*").eq("business_id",workspace.id).order("created_at",{ascending:false});if(error)throw error;members=data||[];$("businessMemberCount").textContent=String(members.filter(m=>m.status==="active").length);const host=$("businessMemberList");host.innerHTML="";if(!members.length){host.innerHTML="<p class='business-muted'>No staff invited yet.</p>";}members.forEach(m=>{const card=document.createElement("article");card.className="business-list-card";const identity=m.display_name||m.phone||m.email||"Staff member";card.innerHTML="<div class='business-card-top'><h3>"+esc(identity)+"</h3><span class='business-tag'>"+esc(m.status)+" · "+esc(m.role)+"</span></div><p>"+esc(m.phone||m.email||"Phone invitation")+"</p>"+(isOwner&&hasBusinessPlan&&m.status!=="suspended"?"<div class='business-card-actions'><button type='button' data-remove-member='"+esc(m.id)+"'>Remove access</button></div>":"");host.appendChild(card);});host.querySelectorAll("[data-remove-member]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Remove this staff member or pending invitation?"))return;b.disabled=true;const {error}=await client.from("business_members").delete().eq("id",b.dataset.removeMember);if(error)notice(error.message,"error");else{notice("Staff access removed.");await loadMembers();}}));const select=$("taskAssignee");select.innerHTML='<option value="">Unassigned</option>'+members.filter(m=>m.status==="active"&&m.user_id).map(m=>'<option value="'+esc(m.user_id)+'">'+esc(m.display_name||m.phone||m.email||"Staff")+'</option>').join("");}
async function loadTasks(){const {data,error}=await client.from("business_tasks").select("*").eq("business_id",workspace.id).order("created_at",{ascending:false});if(error)throw error;tasks=data||[];$("businessOpenTasks").textContent=String(tasks.filter(t=>!["completed","cancelled"].includes(t.status)).length);$("businessCompletedTasks").textContent=String(tasks.filter(t=>t.status==="completed").length);const host=$("businessTaskList");host.innerHTML="";if(!tasks.length){host.innerHTML="<p class='business-muted'>No tasks yet. Create one to get your team started.</p>";return;}tasks.forEach(t=>{const assignee=members.find(m=>m.user_id===t.assigned_to);const card=document.createElement("article");card.className="business-list-card";card.innerHTML="<div class='business-card-top'><h3>"+esc(t.title)+"</h3><span class='business-tag'>"+esc(t.status.replace("_"," "))+"</span></div><p>"+esc(t.description||"No description provided.")+"</p><small>Priority: "+esc(t.priority)+" · Assigned: "+esc(assignee?.display_name||assignee?.phone||"Unassigned")+" · Due: "+esc(t.due_at?new Date(t.due_at).toLocaleDateString():"Not set")+"</small><div class='business-card-actions'>"+(t.status!=="completed"&&t.status!=="cancelled"&&(isOwner||t.assigned_to===user.id||memberRole==="manager")?"<button type='button' data-complete-task='"+esc(t.id)+"'>Mark complete</button>":"")+(isOwner&&hasBusinessPlan?"<button type='button' data-delete-task='"+esc(t.id)+"'>Delete task</button>":"")+"</div>";host.appendChild(card);});host.querySelectorAll("[data-complete-task]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;const {error}=await client.from("business_tasks").update({status:"completed",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",b.dataset.completeTask);if(error)notice(error.message,"error");else{notice("Task marked complete.");await loadTasks();}}));host.querySelectorAll("[data-delete-task]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this task?"))return;const {error}=await client.from("business_tasks").delete().eq("id",b.dataset.deleteTask);if(error)notice(error.message,"error");else await loadTasks();}));}
async function init(){client=window.ZakiChatAuth?.client;if(!client){notice("Supabase client is unavailable. Please refresh and try again.","error");return;}const {data,error}=await client.auth.getSession();if(error||!data?.session?.user){notice("Sign in to ZakiChat to access your business workspace.","error");$("businessLocked").hidden=false;$("businessLocked").querySelector("h2").textContent="Sign in to continue";$("businessLocked").querySelector("p").textContent="Your business profile, staff and tasks are available after sign-in.";return;}user=data.session.user;try{await loadWorkspace();}catch(e){console.error(e);notice(e.message||"Unable to load business workspace.","error");}}
$("businessProfileForm")?.addEventListener("submit",createWorkspace);
$("businessUpdateForm")?.addEventListener("submit",updateWorkspace);
$("businessInviteForm")?.addEventListener("submit",inviteStaff);
$("businessTaskForm")?.addEventListener("submit",createTask);
document.addEventListener("DOMContentLoaded",init);
})();