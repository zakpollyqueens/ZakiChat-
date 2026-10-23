(function(){
'use strict';
const $=id=>document.getElementById(id);
const root=$('biz-content');
const page=document.body.dataset.bizPage;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaults=()=>({profile:{name:'',category:'',phone:'',email:'',address:'',description:''},products:[],customers:[],orders:[]});
let client=null,user=null,workspace=null,busy=false;
function toast(message,error=false){const el=$('biz-toast');if(!el)return;el.textContent=message;el.style.display='block';el.style.background=error?'#512633':'#d5fbff';el.style.color=error?'#fff0f2':'#062035';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',3000)}
function gate(message){document.querySelector('.biz-shell').innerHTML='<section class="biz-gate"><div class="biz-mark" style="margin:auto">✧</div><h1>Customized Business access</h1><p>'+esc(message)+'</p><p>This workspace is reserved for signed-in Molan Chat accounts with an active Customized Business subscription.</p><p><a href="settings.html">Settings</a> · <a href="chats.html">Back to Chats</a></p></section>'}
async function authorize(){
 const auth=window.ZakiChatAuth;
 if(auth?.ready)await auth.ready;
 client=auth?.client;
 if(!client)throw new Error('Molan Chat account services are not ready. Refresh and try again.');
 const {data:sessionData,error:sessionError}=await client.auth.getSession();
 if(sessionError)throw sessionError;
 user=sessionData?.session?.user;
 if(!user){gate('Sign in to Molan Chat first, then return to this page.');return false}
 const {data:plans,error:planError}=await client.from('user_upgrades').select('plan,status,expires_at').eq('user_id',user.id).eq('status','active').gt('expires_at',new Date().toISOString()).order('expires_at',{ascending:false}).limit(10);
 if(planError)throw planError;
 const hasBusiness=(plans||[]).some(item=>['business_monthly','business_customized'].includes(String(item.plan||'')));
 if(!hasBusiness){gate('This account does not have an active Customized Business plan. Your existing chats and personal account remain available.');return false}
 const {data:row,error:workspaceError}=await client.from('molan_business_workspaces').select('user_id,profile,products,customers,orders,updated_at').eq('user_id',user.id).maybeSingle();
 if(workspaceError)throw new Error(workspaceError.message+' If this is the first launch after an update, the workspace database migration may still need to be applied.');
 if(row){workspace={profile:row.profile||defaults().profile,products:Array.isArray(row.products)?row.products:[],customers:Array.isArray(row.customers)?row.customers:[],orders:Array.isArray(row.orders)?row.orders:[]};return true}
 const blank=defaults();
 const {data:created,error:createError}=await client.from('molan_business_workspaces').insert({user_id:user.id,...blank}).select('user_id,profile,products,customers,orders,updated_at').single();
 if(createError)throw new Error(createError.message+' The business workspace database migration must be applied before first use.');
 workspace={profile:created.profile||blank.profile,products:Array.isArray(created.products)?created.products:[],customers:Array.isArray(created.customers)?created.customers:[],orders:Array.isArray(created.orders)?created.orders:[]};
 return true;
}
async function persist(){
 if(!client||!user||!workspace)throw new Error('Your business workspace is not ready.');
 const {error}=await client.from('molan_business_workspaces').update({profile:workspace.profile,products:workspace.products,customers:workspace.customers,orders:workspace.orders}).eq('user_id',user.id);
 if(error)throw error;
}
function profileForm(){
 const p=workspace.profile||defaults().profile;
 return '<section class="biz-card"><div class="biz-profile-summary"><div class="biz-logo-placeholder">'+esc((p.name||'B').trim().slice(0,1).toUpperCase())+'</div><div><h2>Business profile</h2><p>Your business identity and contact details, synced to your signed-in account.</p></div></div><form class="biz-form" id="profile-form"><div class="biz-field full"><label for="bp-name">Business name</label><input id="bp-name" name="name" required maxlength="140" value="'+esc(p.name)+'" placeholder="e.g. Zakmolanitech Solutions"></div><div class="biz-field"><label for="bp-category">Business category</label><input id="bp-category" name="category" maxlength="100" value="'+esc(p.category)+'" placeholder="Technology, retail, services…"></div><div class="biz-field"><label for="bp-phone">Business phone</label><input id="bp-phone" name="phone" maxlength="40" value="'+esc(p.phone)+'" placeholder="+256…"></div><div class="biz-field"><label for="bp-email">Business email</label><input id="bp-email" name="email" type="email" maxlength="180" value="'+esc(p.email)+'"></div><div class="biz-field"><label for="bp-address">Business address / service area</label><input id="bp-address" name="address" maxlength="220" value="'+esc(p.address)+'"></div><div class="biz-field full"><label for="bp-description">About your business</label><textarea id="bp-description" name="description" maxlength="2000" placeholder="Describe your products, services and customers">'+esc(p.description)+'</textarea></div><div class="biz-field full"><button class="biz-button" type="submit">Save business profile</button></div></form></section>';
}
function table(items,kind){
 if(!items.length)return '<div class="biz-empty">Nothing here yet. Add your first '+({products:'product or service',customers:'customer',orders:'order'}[kind])+' above.</div>';
 const cols=kind==='products'?['name','price','stock']:kind==='customers'?['name','contact','notes']:['customer','item','total','status'];
 return '<div class="biz-table-wrap"><table class="biz-table"><thead><tr>'+cols.map(col=>'<th>'+esc(col)+'</th>').join('')+'<th>Action</th></tr></thead><tbody>'+items.map((item,index)=>'<tr>'+cols.map(col=>'<td>'+esc(item[col]||'—')+'</td>').join('')+'<td><button type="button" class="biz-button secondary" data-delete="'+kind+'" data-index="'+index+'">Remove</button></td></tr>').join('')+'</tbody></table></div>';
}
function formFor(kind){
 if(kind==='products')return '<form class="biz-form" id="item-form"><div class="biz-field"><label>Product or service</label><input name="name" maxlength="140" required placeholder="Name"></div><div class="biz-field"><label>Price</label><input name="price" type="number" min="0" step="any" required placeholder="0"></div><div class="biz-field"><label>Stock / availability</label><input name="stock" maxlength="100" placeholder="e.g. 12 or Available"></div><div class="biz-field"><label>Category</label><input name="category" maxlength="100" placeholder="Optional"></div><div class="biz-field full"><button class="biz-button">Add to catalogue</button></div></form>';
 if(kind==='customers')return '<form class="biz-form" id="item-form"><div class="biz-field"><label>Customer name</label><input name="name" maxlength="140" required placeholder="Full name or business"></div><div class="biz-field"><label>Phone or email</label><input name="contact" maxlength="180" placeholder="Contact details"></div><div class="biz-field full"><label>Notes</label><textarea name="notes" maxlength="1200" placeholder="Customer preferences or follow-up notes"></textarea></div><div class="biz-field full"><button class="biz-button">Save customer</button></div></form>';
 return '<form class="biz-form" id="item-form"><div class="biz-field"><label>Customer</label><input name="customer" maxlength="140" required placeholder="Customer name"></div><div class="biz-field"><label>Item / service</label><input name="item" maxlength="180" required placeholder="What was ordered?"></div><div class="biz-field"><label>Total amount</label><input name="total" type="number" min="0" step="any" required placeholder="0"></div><div class="biz-field"><label>Status</label><select name="status"><option>New</option><option>Processing</option><option>Completed</option><option>Cancelled</option></select></div><div class="biz-field full"><button class="biz-button">Record order</button></div></form>';
}
function wireProfile(){
 const form=$('profile-form');if(!form)return;
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;const button=form.querySelector('button');button.disabled=true;
 try{workspace.profile=Object.fromEntries(new FormData(form).entries());await persist();render();toast('Business profile saved to your account.')}
 catch(error){toast(error.message||'Could not save the business profile.',true)}
 finally{busy=false}
 });
}
function render(){
 const w=workspace,p=w.profile,productCount=w.products.length,customerCount=w.customers.length,orderCount=w.orders.length,revenue=w.orders.filter(item=>item.status==='Completed').reduce((sum,item)=>sum+(Number(item.total)||0),0);
 if(page==='dashboard'||page==='profile'){
  root.innerHTML=profileForm()+(page==='dashboard'?'<h2 class="biz-section-title">Business workspace</h2><div class="biz-grid"><a class="biz-card biz-card-link" href="business-products.html"><div class="biz-card-icon">▦</div><h3>Products & services</h3><div class="biz-metric">'+productCount+'</div><p>Catalogue items</p></a><a class="biz-card biz-card-link" href="business-customers.html"><div class="biz-card-icon">♙</div><h3>Customers</h3><div class="biz-metric">'+customerCount+'</div><p>Saved customer records</p></a><a class="biz-card biz-card-link" href="business-orders.html"><div class="biz-card-icon">▤</div><h3>Orders & sales</h3><div class="biz-metric">'+orderCount+'</div><p>Recorded orders</p></a><a class="biz-card biz-card-link" href="business-reports.html"><div class="biz-card-icon">↗</div><h3>Reports</h3><div class="biz-metric">'+esc(String(revenue))+'</div><p>Completed order total</p></a></div>':'')+'<p class="biz-footer">These workspace records sync to your signed-in account.</p>';
  wireProfile();return;
 }
 if(page==='reports'){
  root.innerHTML='<div class="biz-grid">'+[['Catalogue items',productCount],['Customers',customerCount],['Orders',orderCount],['Completed sales total',revenue],['Open orders',w.orders.filter(item=>!['Completed','Cancelled'].includes(item.status)).length],['Business profile',p.name?'Set up':'Not set up']].map(item=>'<section class="biz-card"><div class="biz-card-icon">✦</div><p>'+item[0]+'</p><div class="biz-metric" style="font-size:25px">'+esc(String(item[1]))+'</div></section>').join('')+'</div><p class="biz-footer">Reports summarize orders and records saved in your workspace. Completed order totals are not payment-provider confirmations.</p>';return;
 }
 const kind=page==='products'?'products':page==='customers'?'customers':'orders';
 root.innerHTML='<section class="biz-card"><h2>'+({products:'Add a product or service',customers:'Add a customer',orders:'Record an order'}[kind])+'</h2>'+formFor(kind)+'</section><h2 class="biz-section-title">'+({products:'Your catalogue',customers:'Customer directory',orders:'Orders and sales'}[kind])+'</h2><section class="biz-card">'+table(w[kind],kind)+'</section>';
 $('item-form').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const item=Object.fromEntries(new FormData(event.currentTarget).entries());if(kind==='products')delete item.category;w[kind].unshift(item);await persist();render();toast('Saved to your business account.')}
 catch(error){toast(error.message||'Could not save the record.',true)}
 finally{busy=false}
 });
 root.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',async()=>{if(busy)return;const yes=window.confirm('Remove this record from your business workspace?');if(!yes)return;busy=true;button.disabled=true;
 try{w[button.dataset.delete].splice(Number(button.dataset.index),1);await persist();render();toast('Record removed.')}
 catch(error){toast(error.message||'Could not remove the record.',true)}
 finally{busy=false}
 }));
}
(async()=>{try{if(!await authorize())return;document.querySelectorAll('.biz-nav a').forEach(link=>link.classList.toggle('active',link.dataset.nav===page));render()}catch(error){gate(error.message||'Could not verify your Customized Business access.')}})();
})();