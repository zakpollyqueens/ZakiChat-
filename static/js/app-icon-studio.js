(function(){
  "use strict";
  const choices={
    emerald:{label:"Emerald Circuit",alias:"com.zakmolanitech.zakichat.LauncherEmerald"},
    crystal:{label:"Crystal Green",alias:"com.zakmolanitech.zakichat.LauncherCrystal"},
    neon:{label:"Neon Pulse",alias:"com.zakmolanitech.zakichat.LauncherNeon"},
    metal:{label:"Liquid Metal",alias:"com.zakmolanitech.zakichat.LauncherMetal"}
  };
  const key="zamivox-app-icon";
  const buttons=[...document.querySelectorAll("[data-icon]")];
  const status=document.getElementById("studio-status");
  const label=document.getElementById("selected-label");
  const apply=document.getElementById("apply-icon");
  let selected=localStorage.getItem(key)||"emerald";
  if(!choices[selected])selected="emerald";
  function select(value){
    if(!choices[value])return;
    selected=value;
    buttons.forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.icon===value)));
    label.textContent="Selected: "+choices[value].label;
  }
  buttons.forEach(button=>button.addEventListener("click",()=>select(button.dataset.icon)));
  apply.addEventListener("click",()=>{
    localStorage.setItem(key,selected);
    const native=window.ZakiChatNative;
    if(native&&typeof native.setLauncherIcon==="function"){
      apply.disabled=true;status.textContent="Applying your launcher icon…";
      try{
        native.setLauncherIcon(selected);
        status.textContent=choices[selected].label+" saved. Android may take a moment to refresh the launcher icon.";
      }catch(error){status.textContent="Saved in the app, but Android could not change the launcher icon: "+(error.message||"native update failed");}
      finally{apply.disabled=false;}
    }else{
      status.textContent=choices[selected].label+" saved for this browser. Install the updated Android APK to change the home-screen icon.";
    }
  });
  select(selected);
})();