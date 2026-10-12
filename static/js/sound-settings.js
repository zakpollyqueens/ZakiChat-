(() => {
"use strict";
const KEY="zakichat_sound_settings";
const categories=["message","voiceCall","videoCall"];
const defaults={messageTone:"default",voiceCallTone:"default",videoCallTone:"chime",messageVolume:.85,voiceCallVolume:.85,videoCallVolume:.85,messageSounds:true,callSounds:true};
const names={message:"message",voiceCall:"voice call",videoCall:"video call"};
const $=id=>document.getElementById(id);
let settings={...defaults};
function load(){try{const saved=JSON.parse(localStorage.getItem(KEY)||"{}");settings={...defaults,...saved};if(localStorage.getItem("zakichat_sound_volume_migrated_v1")!=="yes"){const oldDefaults={messageVolume:.45,voiceCallVolume:.45,videoCallVolume:.5};Object.keys(oldDefaults).forEach(k=>{if(Number(saved[k])===oldDefaults[k])settings[k]=.85});localStorage.setItem("zakichat_sound_volume_migrated_v1","yes");}}catch(_){settings={...defaults}}}
function save(){localStorage.setItem(KEY,JSON.stringify(settings))}
function status(text){const el=$("soundStatus");el.textContent=text;el.hidden=false;clearTimeout(status.timer);status.timer=setTimeout(()=>el.hidden=true,2600)}
function render(){categories.forEach(kind=>{const select=$(kind+"Tone"),volume=$(kind+"Volume"),fileName=$(kind+"FileName"),remove=document.querySelector('[data-remove-tone="'+kind+'"]');if(select)select.value=settings[kind+"Tone"]||"default";if(volume){volume.value=String(settings[kind+"Volume"]??.85);volume.nextElementSibling.value=Math.round(Number(volume.value)*100)+"%"}if(fileName)fileName.textContent=settings[kind+"FileName"]||"No personal tone selected";if(remove)remove.hidden=!settings[kind+"FileName"]});$("messageSounds").checked=settings.messageSounds!==false;$("callSounds").checked=settings.callSounds!==false}
load();render();
categories.forEach(kind=>{
 $(kind+"Tone").addEventListener("change",()=>{settings[kind+"Tone"]=$(kind+"Tone").value;save();status("Your "+names[kind]+" tone has been saved.");if(settings[kind+"Tone"]==="custom"&&!settings[kind+"FileName"])$(kind+"File").click()});
 $(kind+"Volume").addEventListener("input",e=>{settings[kind+"Volume"]=Number(e.target.value);e.target.nextElementSibling.value=Math.round(settings[kind+"Volume"]*100)+"%";save()});
 $(kind+"File").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("audio/")){status("Choose an audio file, such as MP3, M4A, WAV or OGG.");e.target.value="";return}try{await window.ZakiRingtones.saveCustom(kind,file);settings[kind+"FileName"]=file.name;settings[kind+"Tone"]="custom";save();render();status("Saved "+file.name+" as your "+names[kind]+" tone.");await window.ZakiRingtones.test(kind)}catch(err){console.error(err);status(err.message||"Could not save that audio file.")}finally{e.target.value=""}});
 document.querySelector('[data-test-tone="'+kind+'"]').addEventListener("click",async()=>{try{await window.ZakiRingtones.test(kind);status("Previewing your "+names[kind]+" tone.")}catch(err){status("Tone preview could not start. Tap Preview again.")}});
 document.querySelector('[data-remove-tone="'+kind+'"]').addEventListener("click",async()=>{try{await window.ZakiRingtones.removeCustom(kind);settings[kind+"FileName"]="";if(settings[kind+"Tone"]==="custom")settings[kind+"Tone"]="default";save();render();window.ZakiRingtones.stop();status("Personal "+names[kind]+" audio removed.")}catch(err){status("Could not remove the saved audio.")}});
});
$("messageSounds").addEventListener("change",()=>{settings.messageSounds=$("messageSounds").checked;save();status(settings.messageSounds?"Message sounds enabled.":"Message sounds disabled.")});
$("callSounds").addEventListener("change",()=>{settings.callSounds=$("callSounds").checked;save();status(settings.callSounds?"Call sounds enabled.":"Call sounds disabled.");if(!settings.callSounds)window.ZakiRingtones.stop()});
})();