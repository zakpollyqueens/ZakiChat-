/* ZakiChat Appearance and subscription-gated customization */
(function () {
  "use strict";
  const KEY = "zakichat-appearance";
  const PLAN_KEY = "zakichat-plan-cache";
  const STYLE_KEY = "zakichat-chat-style";
  const BASIC = ["dark", "light", "cyan"];
  const THEMES = {
    dark:["#07111f","#0d1a2b","#12243a","#f5f8fc","#9cafc4","rgba(255,255,255,.09)","#27d3a2","#18aef0"],
    light:["#f4f7fb","#ffffff","#e8eef6","#152235","#5e6d80","rgba(15,35,60,.13)","#0891b2","#2563eb"],
    cyan:["#061826","#0a2638","#10394f","#e9fbff","#9ccbd8","rgba(103,232,249,.16)","#22d3ee","#3b82f6"],
    aurora:["#07151a","#10272b","#17363a","#effff6","#a6c9bb","rgba(110,231,183,.18)","#34d399","#a78bfa"],
    rose:["#1d111c","#2b1828","#3a2035","#fff1f6","#d5aebe","rgba(251,113,133,.2)","#fb7185","#c084fc"],
    sunset:["#21130f","#321d16","#4a291b","#fff7ed","#d9b9a1","rgba(251,146,60,.2)","#fb923c","#facc15"],
    emerald:["#061b17","#0b2922","#10382e","#ecfdf5","#9bc7b6","rgba(52,211,153,.18)","#34d399","#2dd4bf"],
    lavender:["#171329","#241d40","#352b59","#f4f0ff","#c4b8e8","rgba(196,181,253,.18)","#a78bfa","#e879f9"],
    ocean:["#061a2a","#0b2c43","#10425c","#eaf8ff","#a5c7dc","rgba(56,189,248,.18)","#38bdf8","#2dd4bf"],
    midnight:["#090d1d","#111a31","#1c2945","#f1f5ff","#a6b3d0","rgba(129,140,248,.18)","#818cf8","#60a5fa"],
    graphite:["#17191d","#22262c","#30353d","#f5f6f7","#b1b7c0","rgba(203,213,225,.16)","#cbd5e1","#94a3b8"],
    cherry:["#220b18","#351126","#4b1833","#fff1f5","#e3a6bc","rgba(244,114,182,.18)","#f472b6","#fb7185"],
    gold:["#211a08","#33270d","#4a3914","#fff9e8","#d8c89b","rgba(250,204,21,.18)","#facc15","#f59e0b"],
    mint:["#071c19","#0d3028","#164438","#edfff8","#a5d7c6","rgba(110,231,183,.18)","#6ee7b7","#2dd4bf"],
    violet:["#170c2c","#271344","#391c5f","#f7f0ff","#c7b1e8","rgba(192,132,252,.2)","#c084fc","#818cf8"]
  };
  const FONTS = [
    ["system","System UI","system-ui, -apple-system, BlinkMacSystemFont, sans-serif",false],
    ["arial","Arial","Arial, Helvetica, sans-serif",false],
    ["georgia","Georgia","Georgia, serif",false],
    ["trebuchet","Trebuchet MS","'Trebuchet MS', Arial, sans-serif",false],
    ["verdana","Verdana","Verdana, Geneva, sans-serif",false],
    ["monospace","Monospace","ui-monospace, SFMono-Regular, Consolas, monospace",false],
    ["tahoma","Tahoma","Tahoma, sans-serif",true],["gill-sans","Gill Sans","'Gill Sans', sans-serif",true],
    ["optima","Optima","Optima, sans-serif",true],["candara","Candara","Candara, sans-serif",true],
    ["calibri","Calibri","Calibri, sans-serif",true],["segoe","Segoe UI","'Segoe UI', sans-serif",true],
    ["helvetica","Helvetica","Helvetica, Arial, sans-serif",true],["lucida","Lucida Sans","'Lucida Sans', sans-serif",true],
    ["palatino","Palatino","Palatino, serif",true],["book-antiqua","Book Antiqua","'Book Antiqua', serif",true],
    ["garamond","Garamond","Garamond, serif",true],["baskerville","Baskerville","Baskerville, serif",true],
    ["times","Times New Roman","'Times New Roman', serif",true],["didot","Didot","Didot, serif",true],
    ["rockwell","Rockwell","Rockwell, serif",true],["courier","Courier New","'Courier New', monospace",true],
    ["consolas","Consolas","Consolas, monospace",true],["monaco","Monaco","Monaco, monospace",true],
    ["copperplate","Copperplate","Copperplate, fantasy",true],["impact","Impact","Impact, sans-serif",true],
    ["comic-sans","Comic Sans MS","'Comic Sans MS', cursive",true],["papyrus","Papyrus","Papyrus, fantasy",true],
    ["fantasy","Fantasy","fantasy",true],["cursive","Cursive","cursive",true],
    ["sans-serif","Sans Serif","sans-serif",true],["serif","Serif","serif",true],
    ["noto-sans","Noto Sans","'Noto Sans', sans-serif",true],["noto-serif","Noto Serif","'Noto Serif', serif",true],
    ["roboto","Roboto","Roboto, sans-serif",true],["open-sans","Open Sans","'Open Sans', sans-serif",true],
    ["lato","Lato","Lato, sans-serif",true],["montserrat","Montserrat","Montserrat, sans-serif",true],
    ["poppins","Poppins","Poppins, sans-serif",true],["nunito","Nunito","Nunito, sans-serif",true],
    ["raleway","Raleway","Raleway, sans-serif",true],["ubuntu","Ubuntu","Ubuntu, sans-serif",true],
    ["oswald","Oswald","Oswald, sans-serif",true],["merriweather","Merriweather","Merriweather, serif",true],
    ["playfair","Playfair Display","'Playfair Display', serif",true],["lora","Lora","Lora, serif",true],
    ["fira-code","Fira Code","'Fira Code', monospace",true],["source-code","Source Code Pro","'Source Code Pro', monospace",true],
    ["space-grotesk","Space Grotesk","'Space Grotesk', sans-serif",true],["dm-sans","DM Sans","'DM Sans', sans-serif",true]
  ];
  const defaults = {theme:"dark",fontFamily:"system",fontSize:16,wallpaper:""};
  let settings = load();
  let plan = "local";
  let premium = false;
  function load(){try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(KEY)||"{}"));}catch{return Object.assign({},defaults);}}
  function apply(s){
    const root=document.documentElement, t=THEMES[s.theme]||THEMES.dark;
    const font=FONTS.find(f=>f[0]===s.fontFamily)||FONTS[0];
    const size=Math.max(13,Math.min(22,Number(s.fontSize)||16));
    root.dataset.zakichatTheme=THEMES[s.theme]?s.theme:"dark";
    root.dataset.zakichatFont=font[0];
    root.dataset.zakichatFontSize=String(size);
    root.style.setProperty("--bg",t[0]);
    root.style.setProperty("--surface",t[1]);
    root.style.setProperty("--surface-2",t[2]);
    root.style.setProperty("--text",t[3]);
    root.style.setProperty("--muted",t[4]);
    root.style.setProperty("--line",t[5]);
    root.style.setProperty("--primary",t[6]);
    root.style.setProperty("--primary-2",t[7]);
    /* Bridge the saved appearance into the shared ZakiChat design tokens.
       The signature stylesheet uses --zk-* tokens and !important body rules;
       without this bridge, saved themes/fonts appeared selected but not applied. */
    root.style.setProperty("--zk-bg",t[0]);
    root.style.setProperty("--zk-bg-2",t[1]);
    root.style.setProperty("--zk-bg-3",t[2]);
    root.style.setProperty("--zk-surface",t[1]);
    root.style.setProperty("--zk-surface-2",t[2]);
    root.style.setProperty("--zk-cyan",t[6]);
    root.style.setProperty("--zk-cyan-2",t[7]);
    root.style.setProperty("--zk-cyan-soft",t[5]);
    root.style.setProperty("--zk-text",t[3]);
    root.style.setProperty("--zk-muted",t[4]);
    root.style.setProperty("--zk-line",t[5]);
    root.style.setProperty("--zk-line-strong",t[6]);
    root.style.setProperty("--zk-font",font[2]);
    root.style.setProperty("--zakichat-font-family",font[2]);
    root.style.setProperty("--zakichat-font-size",size+"px");
    root.style.setProperty("font-size",size+"px","important");
    root.style.setProperty("color-scheme",s.theme==="light"?"light":"dark","important");
    if(document.body){
      document.body.style.setProperty("--zakichat-wallpaper",s.wallpaper?"url('"+s.wallpaper+"')":"none");
      document.body.style.setProperty("font-family",font[2],"important");
      document.body.style.setProperty("font-size",size+"px","important");
      document.body.style.setProperty("color",t[3],"important");
      document.body.style.setProperty("background-color",t[0],"important");
      const background=s.wallpaper
        ?"linear-gradient(rgba(4,12,22,.52),rgba(4,12,22,.7)),url('"+s.wallpaper+"')"
        :"radial-gradient(ellipse at 90% 0%,"+t[7]+"24,transparent 36%),linear-gradient(155deg,"+t[0]+","+t[1]+" 58%,"+t[2]+")";
      document.body.style.setProperty("background-image",background,"important");
      document.body.style.setProperty("background-size",s.wallpaper?"cover":"auto","important");
      document.body.style.setProperty("background-position","center","important");
      document.body.style.setProperty("background-attachment",s.wallpaper?"fixed":"scroll","important");
    }
    root.dataset.zakichatChatStyle=localStorage.getItem(STYLE_KEY)||"classic";
  }
  function save(changes){settings=Object.assign({},settings,changes);localStorage.setItem(KEY,JSON.stringify(settings));apply(settings);sync();}
  function upgrade(){const msg="This customization is included with Customized Personal. Open the upgrade plans?";if(confirm(msg))location.href="about.html?upgrade=personal_monthly#paid-upgrades";}
  async function loadPlan(){
    try{
      const client=window.ZakiChatAuth&&window.ZakiChatAuth.client;if(!client)return;
      const sessionResult=await client.auth.getSession(), user=sessionResult.data&&sessionResult.data.session&&sessionResult.data.session.user;if(!user)return;
      const result=await client.from("user_upgrades").select("plan,status,expires_at").eq("user_id",user.id).eq("status","active").gt("expires_at",new Date().toISOString()).order("expires_at",{ascending:false}).limit(1).maybeSingle();
      if(result.error)throw result.error;
      plan=result.data&&result.data.plan||"local";premium=["personal_monthly","business_monthly"].includes(plan);
      if(!premium){
        const {data:memberships,error:membershipError}=await client.from("business_members").select("business_id").eq("user_id",user.id).eq("status","active");
        if(membershipError)throw membershipError;
        for(const membership of memberships||[]){
          const {data:workspace}=await client.from("business_workspaces").select("owner_user_id").eq("id",membership.business_id).maybeSingle();
          if(!workspace?.owner_user_id)continue;
          const {data:businessUpgrade}=await client.from("user_upgrades").select("plan").eq("user_id",workspace.owner_user_id).eq("plan","business_monthly").eq("status","active").gt("expires_at",new Date().toISOString()).limit(1).maybeSingle();
          if(businessUpgrade){plan="business_monthly";premium=true;break;}
        }
      }
      localStorage.setItem(PLAN_KEY,JSON.stringify({plan:plan,checkedAt:Date.now()}));
    }catch(error){
      console.warn("Could not verify ZakiChat plan",error);
      try{const c=JSON.parse(localStorage.getItem(PLAN_KEY)||"{}");if(Date.now()-Number(c.checkedAt||0)<300000){plan=c.plan||"local";premium=["personal_monthly","business_monthly"].includes(plan);}}catch{}
    }
  }
  function sync(){
    document.querySelectorAll("[data-theme-choice]").forEach(b=>{
      const v=b.dataset.themeChoice,locked=!BASIC.includes(v)&&!premium;
      b.classList.toggle("active",settings.theme===v);b.classList.toggle("premium-locked",locked);
      b.setAttribute("aria-pressed",String(settings.theme===v));
      const small=b.querySelector("small");if(small&&b.dataset.premium==="true")small.textContent=locked?"🔒 Customized Personal":"Available with your plan";
    });
    const select=document.getElementById("fontFamily");
    if(select){select.innerHTML=FONTS.map(f=>'<option value="'+f[0]+'">'+f[1]+(f[3]&&!premium?" 🔒":"")+'</option>').join("");select.value=FONTS.some(f=>f[0]===settings.fontFamily)?settings.fontFamily:"system";if(FONTS.find(f=>f[0]===select.value)[3]&&!premium)select.value="system";}
    document.querySelectorAll("[data-chat-style]").forEach(b=>{const v=b.dataset.chatStyle,locked=v!=="classic"&&!premium;b.classList.toggle("active",(localStorage.getItem(STYLE_KEY)||"classic")===v);b.classList.toggle("premium-locked",locked);});
    const size=document.getElementById("fontSize"),out=document.getElementById("fontSizeValue");if(size)size.value=String(settings.fontSize||16);if(out)out.textContent=(settings.fontSize||16)+"px";
    const preview=document.getElementById("fontPreview");if(preview){preview.style.fontFamily=(FONTS.find(f=>f[0]===settings.fontFamily)||FONTS[0])[2];preview.style.fontSize=(settings.fontSize||16)+"px";}
    const wallpaper=document.getElementById("wallpaperPreview");if(wallpaper)wallpaper.style.backgroundImage=settings.wallpaper?"url('"+settings.wallpaper+"')":"";
  }
  function initControls(){
    document.querySelectorAll("[data-theme-choice]").forEach(b=>b.addEventListener("click",()=>{const v=b.dataset.themeChoice;if(!BASIC.includes(v)&&!premium){upgrade();return;}if(THEMES[v])save({theme:v});}));
    document.getElementById("fontFamily")?.addEventListener("change",e=>{const f=FONTS.find(item=>item[0]===e.target.value);if(!f)return;if(f[3]&&!premium){e.target.value=settings.fontFamily;upgrade();return;}save({fontFamily:f[0]});});
    document.getElementById("fontSize")?.addEventListener("input",e=>save({fontSize:Number(e.target.value)}));
    document.getElementById("wallpaperInput")?.addEventListener("change",e=>{const file=e.target.files&&e.target.files[0];if(!file)return;if(file.size>4*1024*1024){alert("Choose a wallpaper image under 4 MB.");e.target.value="";return;}const reader=new FileReader();reader.onload=()=>save({wallpaper:String(reader.result||"")});reader.readAsDataURL(file);});
    document.getElementById("removeWallpaper")?.addEventListener("click",()=>save({wallpaper:""}));
    document.querySelectorAll("[data-chat-style]").forEach(b=>b.addEventListener("click",()=>{const style=b.dataset.chatStyle;if(style!=="classic"&&!premium){upgrade();return;}localStorage.setItem(STYLE_KEY,style);apply(settings);sync();}));
  }
  window.ZakiChatAppearance={get:load,save:function(s){settings=Object.assign({},s);localStorage.setItem(KEY,JSON.stringify(settings));apply(settings);sync();},update:save,apply:apply,isPremium:function(){return premium;},getPlan:function(){return plan;},loadPlan:loadPlan};
  apply(settings);
  document.addEventListener("DOMContentLoaded",async()=>{apply(settings);initControls();await loadPlan();sync();});
})();
