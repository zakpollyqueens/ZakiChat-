(function () {
  "use strict";
  const KEY_PREFIX = "zakichat-upgrade-celebration:";
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function addStyles() {
    if (document.getElementById("zaki-upgrade-celebration-css")) return;
    const style = document.createElement("style");
    style.id = "zaki-upgrade-celebration-css";
    style.textContent = ".zaki-upgrade-overlay{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;padding:20px;background:rgba(2,8,18,.82);backdrop-filter:blur(14px);animation:zakiOverlayIn .25s ease}.zaki-upgrade-card{position:relative;width:min(460px,100%);overflow:hidden;text-align:center;padding:32px 24px;border:1px solid rgba(39,211,162,.35);border-radius:28px;background:linear-gradient(145deg,#10243a,#07111f 72%);color:#f5f8fc;box-shadow:0 25px 100px rgba(0,0,0,.5)}.zaki-upgrade-spinner{width:62px;height:62px;margin:0 auto 18px;border:4px solid rgba(39,211,162,.16);border-top-color:#27d3a2;border-right-color:#18aef0;border-radius:50%;animation:zakiSpin .8s linear infinite}.zaki-upgrade-success{display:grid;place-items:center;width:76px;height:76px;margin:0 auto 15px;border-radius:50%;background:linear-gradient(135deg,#27d3a2,#18aef0);color:#031a17;font-size:2.5rem;font-weight:900;animation:zakiPop .55s cubic-bezier(.18,.89,.32,1.4)}.zaki-upgrade-card h2{font-size:1.75rem;line-height:1.15;margin:9px 0}.zaki-upgrade-card p{color:#b8c8d9;line-height:1.55;margin:10px 0 18px}.zaki-upgrade-kicker{font-size:.68rem;letter-spacing:.15em;color:#55e5c0;font-weight:900}.zaki-upgrade-actions{display:grid;gap:9px}.zaki-upgrade-actions a,.zaki-upgrade-actions button{display:block;padding:12px 16px;border:0;border-radius:12px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none}.zaki-upgrade-primary{background:linear-gradient(110deg,#27d3a2,#18aef0);color:#031a17}.zaki-upgrade-secondary{background:rgba(255,255,255,.07);color:#eaf2fb}.zaki-upgrade-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden}.zaki-upgrade-confetti i{position:absolute;top:-12px;width:7px;height:13px;border-radius:2px;background:var(--confetti);animation:zakiConfetti var(--duration) linear forwards;left:var(--left);transform:rotate(var(--rotation))}@keyframes zakiSpin{to{transform:rotate(360deg)}}@keyframes zakiPop{0%{transform:scale(.2);opacity:0}100%{transform:scale(1);opacity:1}}@keyframes zakiOverlayIn{from{opacity:0}to{opacity:1}}@keyframes zakiConfetti{to{top:115%;transform:translateX(var(--drift)) rotate(680deg);opacity:.15}}@media(prefers-reduced-motion:reduce){.zaki-upgrade-overlay,.zaki-upgrade-success,.zaki-upgrade-spinner,.zaki-upgrade-confetti i{animation:none!important}}";
    document.head.appendChild(style);
  }
  function showCelebration(plan, userId) {
    const business = plan === "business_monthly";
    const overlay = document.createElement("div");
    overlay.className = "zaki-upgrade-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "zakiUpgradeTitle");
    const destination = business ? "business.html" : "appearance.html";
    const title = business ? "Customized Business" : "Customized Personal";
    const detail = business
      ? "Your Business plan is active. Set up your business brand, invite your team and start assigning tasks."
      : "Your Personal plan is active. Explore your new fonts, themes, keyboard styles and expanded chat customization.";
    overlay.innerHTML = "<div class='zaki-upgrade-card'><div class='zaki-upgrade-confetti' aria-hidden='true'></div><div class='zaki-upgrade-loading'><div class='zaki-upgrade-spinner'></div><span class='zaki-upgrade-kicker'>SETTING THINGS UP</span><h2>Preparing your " + title + " experience…</h2><p>Checking your account features and personalizing your ZakiChat.</p></div><div class='zaki-upgrade-finished' hidden><div class='zaki-upgrade-success' aria-hidden='true'>✓</div><span class='zaki-upgrade-kicker'>UPGRADE CONFIRMED</span><h2 id='zakiUpgradeTitle'>Congratulations!</h2><p>" + detail + "</p><div class='zaki-upgrade-actions'><a class='zaki-upgrade-primary' href='" + destination + "'>" + (business ? "Set Up Business Workspace" : "Personalize My Account") + "</a><button type='button' class='zaki-upgrade-secondary' data-close-upgrade>Continue to ZakiChat</button></div></div></div>";
    document.body.appendChild(overlay);
    const confetti = overlay.querySelector(".zaki-upgrade-confetti");
    const colors = ["#27d3a2","#18aef0","#facc15","#fb7185","#a78bfa","#ffffff"];
    for (let i=0;i<34;i++) {
      const piece=document.createElement("i");
      piece.style.setProperty("--confetti",colors[i%colors.length]);
      piece.style.setProperty("--left",(Math.random()*100)+"%");
      piece.style.setProperty("--duration",(1.8+Math.random()*2.2)+"s");
      piece.style.setProperty("--rotation",(Math.random()*360)+"deg");
      piece.style.setProperty("--drift",((Math.random()-.5)*120)+"px");
      piece.style.animationDelay=(Math.random()*.45)+"s";
      confetti.appendChild(piece);
    }
    overlay.querySelector("[data-close-upgrade]").addEventListener("click",()=>overlay.remove());
    sleep(1450).then(()=>{
      const loading=overlay.querySelector(".zaki-upgrade-loading");
      const finished=overlay.querySelector(".zaki-upgrade-finished");
      if(loading)loading.hidden=true;
      if(finished)finished.hidden=false;
    });
  }
  async function init() {
    const client=window.ZakiChatAuth?.client;
    if(!client)return;
    try {
      const {data:sessionData}=await client.auth.getSession();
      const user=sessionData?.session?.user;
      if(!user)return;
      const {data,error}=await client.from("user_upgrades")
        .select("plan,status,expires_at")
        .eq("user_id",user.id).eq("status","active")
        .gt("expires_at",new Date().toISOString())
        .in("plan",["personal_monthly","business_monthly"])
        .order("expires_at",{ascending:false}).limit(1).maybeSingle();
      if(error||!data?.plan)return;
      const key=KEY_PREFIX+user.id+":"+data.plan;
      if(localStorage.getItem(key)==="shown")return;
      localStorage.setItem(key,"shown");
      addStyles();
      showCelebration(data.plan,user.id);
    } catch(error) {
      console.warn("Could not check for a newly activated ZakiChat upgrade.",error);
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();