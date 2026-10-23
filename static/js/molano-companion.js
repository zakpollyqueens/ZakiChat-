(function () {
  "use strict";
  if (window.__MOLANO_CHAT_COMPANION__) return;
  window.__MOLANO_CHAT_COMPANION__ = true;

  const API = "https://molanoai.zakpollyqueens.workers.dev/api/chat";
  const STYLE_ID = "molano-chat-companion-style";
  const ROOT_ID = "molano-chat-companion";
  let user = null, tier = "local", history = [], busy = false, recognition = null;
  let speechEnabled = true;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID}{position:fixed;z-index:10020;right:16px;bottom:calc(88px + env(safe-area-inset-bottom,0px));font-family:inherit;color:#eef8ff}
    #${ROOT_ID} *{box-sizing:border-box}
    #${ROOT_ID} .mca-launch{width:58px;height:58px;border:1px solid #8af0ff99;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,#a8f8ff,#39c7ed 44%,#174b85 78%,#0a1830);box-shadow:0 8px 28px #12bfe966,0 0 0 5px #3fd6f31a;color:#041629;font-size:22px;font-weight:950;cursor:pointer;position:relative}
    #${ROOT_ID} .mca-launch:after{content:"";position:absolute;inset:-5px;border:1px solid #7beaff55;border-radius:50%;animation:mcaPulse 2.8s ease-out infinite}
    #${ROOT_ID} .mca-panel{position:absolute;right:0;bottom:70px;width:min(390px,calc(100vw - 24px));height:min(590px,calc(100dvh - 150px));display:none;flex-direction:column;overflow:hidden;border:1px solid #78dff455;border-radius:24px;background:linear-gradient(155deg,#081a2d,#0c2438 60%,#0b1527);box-shadow:0 24px 80px #0009,inset 0 1px #ffffff19}
    #${ROOT_ID}.mca-panel.open{display:flex;animation:mcaEnter .2s ease-out}
    #${ROOT_ID} .mca-head{display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid #ffffff17;background:#ffffff06}
    #${ROOT_ID} .mca-avatar{width:42px;height:42px;flex:none;border-radius:15px;display:grid;place-items:center;color:#06182a;font-weight:950;background:linear-gradient(145deg,#a8f8ff,#39c7ed 54%,#638cff);box-shadow:0 4px 16px #40c9e944}
    #${ROOT_ID} .mca-brand{min-width:0;flex:1}.mca-brand strong{display:block;font-size:14px}.mca-brand small{display:block;color:#9cc3d7;font-size:11px;margin-top:3px}
    #${ROOT_ID} .mca-close{border:0;background:#ffffff12;color:#e8f8ff;border-radius:10px;width:34px;height:34px;font-size:20px;cursor:pointer}
    #${ROOT_ID} .mca-tier{padding:8px 13px;background:#53d9ee12;color:#a9eafa;font-size:10px;font-weight:800;letter-spacing:.06em;border-bottom:1px solid #ffffff0e}
    #${ROOT_ID} .mca-messages{flex:1;min-height:0;overflow:auto;padding:13px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
    #${ROOT_ID} .mca-welcome{padding:16px 13px;margin:auto 0;text-align:center;border:1px solid #ffffff12;border-radius:18px;background:#ffffff06}
    #${ROOT_ID} .mca-welcome .star{font-size:28px}.mca-welcome h3{margin:7px 0;font-size:16px}.mca-welcome p{margin:0;color:#b5ccdc;font-size:12px;line-height:1.55}
    #${ROOT_ID} .mca-bubble{max-width:90%;padding:10px 12px;border-radius:15px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
    #${ROOT_ID} .mca-bubble.user{align-self:flex-end;background:linear-gradient(130deg,#235d85,#254b78);border:1px solid #82caff2b;border-bottom-right-radius:5px}
    #${ROOT_ID} .mca-bubble.ai{align-self:flex-start;background:#142c42;border:1px solid #ffffff12;border-bottom-left-radius:5px}
    #${ROOT_ID} .mca-actions{display:flex;gap:7px;flex-wrap:wrap;padding:0 12px 10px}
    #${ROOT_ID} .mca-chip{border:1px solid #66d7ed45;background:#ffffff08;color:#d8f8ff;border-radius:20px;padding:7px 10px;font:inherit;font-size:11px;cursor:pointer}
    #${ROOT_ID} .mca-composer{display:flex;gap:7px;align-items:flex-end;padding:10px;border-top:1px solid #ffffff17;background:#061425}
    #${ROOT_ID} textarea{flex:1;min-width:0;min-height:43px;max-height:100px;resize:none;background:#10253a;border:1px solid #35516b;border-radius:13px;color:#f2fbff;padding:12px;font:inherit;font-size:13px;outline:none}
    #${ROOT_ID} textarea:focus{border-color:#5be1f3}
    #${ROOT_ID} .mca-send,#${ROOT_ID} .mca-mic{width:43px;height:43px;flex:none;border:0;border-radius:13px;display:grid;place-items:center;font-size:17px;font-weight:900;cursor:pointer}
    #${ROOT_ID} .mca-send{background:linear-gradient(135deg,#9af5ff,#53c8f0);color:#062039}#${ROOT_ID} .mca-mic{background:#17334b;border:1px solid #41617c;color:#c9f5ff}
    #${ROOT_ID} .mca-mic.recording{background:#7b3048;color:white;animation:mcaPulse 1s infinite}
    #${ROOT_ID} .mca-note{padding:0 12px 10px;background:#061425;color:#8faec3;font-size:10px;line-height:1.4}
    @keyframes mcaPulse{50%{box-shadow:0 0 0 8px #46d9f322}}@keyframes mcaEnter{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
    @media(max-width:440px){#${ROOT_ID}{right:12px;bottom:calc(82px + env(safe-area-inset-bottom,0px))}#${ROOT_ID} .mca-panel{right:-2px;width:calc(100vw - 20px);height:min(620px,calc(100dvh - 140px))}}
    @media(prefers-reduced-motion:reduce){#${ROOT_ID} .mca-launch:after{animation:none}#${ROOT_ID} .mca-panel.open{animation:none}}
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <section class="mca-panel" id="mca-panel" role="dialog" aria-label="Molano AI assistant" aria-modal="false">
      <header class="mca-head"><div class="mca-avatar" aria-hidden="true">M</div><div class="mca-brand"><strong>Molano AI</strong><small id="mca-status">Your Molan Chat companion</small></div><button class="mca-close" id="mca-close" aria-label="Close assistant">×</button></header>
      <div class="mca-tier" id="mca-tier">LOCAL ACCOUNT · ESSENTIAL HELP</div>
      <div class="mca-messages" id="mca-messages" aria-live="polite"><div class="mca-welcome"><div class="star">✦</div><h3>Hi, I'm Molano.</h3><p>Ask me for help with Molan Chat. Personalized accounts can also use voice commands, contact assistance and ZakiPlay.</p></div></div>
      <div class="mca-actions" id="mca-actions"><button class="mca-chip" data-prompt="Help me use Molan Chat">Chat help</button><button class="mca-chip" data-prompt="What can you do?">What can you do?</button><button class="mca-chip" data-action="upgrade">Unlock more</button></div>
      <form class="mca-composer" id="mca-form"><textarea id="mca-input" rows="1" placeholder="Message Molano…" aria-label="Message Molano AI"></textarea><button class="mca-mic" id="mca-mic" type="button" aria-label="Voice command" title="Voice command">🎙</button><button class="mca-send" id="mca-send" type="submit" aria-label="Send message">➤</button></form>
      <div class="mca-note" id="mca-note">Your chats stay in Molan Chat. AI replies are generated by Molano AI.</div>
    </section>
    <button class="mca-launch" id="mca-launch" type="button" aria-label="Open Molano AI" title="Talk to Molano AI">M</button>`;
  document.body.appendChild(root);

  const $ = id => document.getElementById(id);
  const panel = $("mca-panel"), messages = $("mca-messages"), input = $("mca-input");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function addMessage(role, text) {
    const welcome = messages.querySelector(".mca-welcome"); if (welcome) welcome.remove();
    const node = document.createElement("div"); node.className = "mca-bubble " + role; node.textContent = text;
    messages.appendChild(node); messages.scrollTop = messages.scrollHeight;
    return node;
  }
  function speak(text) {
    if (!speechEnabled || !("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 1800));
      const language = navigator.language || "en";
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase()) || voices.find(v => v.lang.toLowerCase().startsWith(language.split("-")[0].toLowerCase())) || null;
      utterance.lang = utterance.voice?.lang || language;
      utterance.rate = .98; window.speechSynthesis.speak(utterance);
    } catch (_) {}
  }
  function setTier(plan) {
    tier = plan;
    const premium = plan === "personal_monthly" || plan === "business_monthly";
    $("mca-tier").textContent = premium ? (plan === "business_monthly" ? "CUSTOMIZED BUSINESS · VOICE & PRODUCT ACTIONS" : "CUSTOMIZED PERSONAL · VOICE & PERSONAL ASSISTANCE") : "LOCAL ACCOUNT · ESSENTIAL HELP";
    $("mca-status").textContent = premium ? "Personalized companion enabled" : "Essential help enabled";
    $("mca-note").textContent = premium
      ? "Voice commands are enabled. Calls and app actions require your confirmation."
      : "Local access includes essential chat help. Upgrade to Customized Personal or Customized Business for voice commands and personal actions.";
    const unlock = $("mca-actions").querySelector('[data-action="upgrade"]');
    if (unlock) unlock.hidden = premium;
    $("mca-mic").disabled = !premium;
    $("mca-mic").title = premium ? "Voice command" : "Voice commands require a customized account";
  }
  async function loadAccount() {
    try {
      const auth = window.ZakiChatAuth;
      if (auth?.ready) await auth.ready;
      const client = auth?.client;
      if (!client) return setTier("local");
      const {data: sessionData} = await client.auth.getSession();
      user = sessionData?.session?.user || null;
      if (!user) return setTier("local");
      const {data, error} = await client.from("user_upgrades").select("plan,status,expires_at").eq("user_id", user.id).eq("status", "active").gt("expires_at", new Date().toISOString()).order("expires_at", {ascending:false}).limit(1).maybeSingle();
      if (!error && data?.plan) setTier(data.plan); else setTier("local");
    } catch (_) { setTier("local"); }
  }
  function openPanel() { panel.classList.add("open"); $("mca-launch").setAttribute("aria-expanded","true"); setTimeout(()=>input.focus(),100); loadAccount(); }
  function closePanel() { panel.classList.remove("open"); $("mca-launch").setAttribute("aria-expanded","false"); stopRecognition(); }
  function requirePremium() {
    addMessage("ai", "I can help with essential Molan Chat questions on a local account. For personalized voice commands, contact assistance and ZakiPlay control, choose Customized Personal or Customized Business in Molan Chat's upgrade section.");
    speak("Personalized voice commands are available with a customized account.");
  }
  function findAction(text) {
    const t = text.toLowerCase();
    if (/\b(play|start|put on|listen to)\b/.test(t) && /\b(music|song|songs|playlist|zakiplay)\b/.test(t)) return {type:"play", reply:"I'll open ZakiPlay so you can choose and play your music."};
    const call = t.match(/\b(?:call|voice call|ring|phone)\s+(?:my friend\s+|contact\s+)?([\p{L}][\p{L} .'-]{0,38})/iu);
    if (call) return {type:"call", name:call[1].trim().replace(/[.!?,]+$/,""), reply:"I'll help you find that contact. Please confirm the correct person in Molan Chat before placing the call."};
    if (/\b(help|how do i|how to)\b/.test(t) && /\b(chat|message|group|status|updates|call|settings|contact)\b/.test(t)) return {type:"help",reply:"You can start a chat from the + menu, find people using search, view statuses in Updates, and change app preferences in Settings. For a call, open the contact or conversation and tap the call control."};
    return null;
  }
  async function performAction(action) {
    if (action.type === "play") { addMessage("ai",action.reply); speak(action.reply); location.href = "zakiplay.html"; return true; }
    if (action.type === "call") {
      const reply = action.reply + " Searching for: " + action.name + ".";
      addMessage("ai",reply); speak(reply);
      location.href = "search.html?q=" + encodeURIComponent(action.name) + "&from=molano-voice-call";
      return true;
    }
    if (action.type === "help") { addMessage("ai",action.reply); speak(action.reply); return true; }
    return false;
  }
  async function send(text) {
    text = String(text || "").trim(); if (!text || busy) return;
    await loadAccount();
    addMessage("user",text); history.push({role:"user",content:text}); history = history.slice(-12);
    input.value = ""; busy = true; $("mca-send").disabled = true; $("mca-status").textContent = "Thinking…";
    try {
      const action = findAction(text);
      const premium = tier === "personal_monthly" || tier === "business_monthly";
      if (action) {
        if (["play","call"].includes(action.type) && !premium) { requirePremium(); return; }
        await performAction(action); return;
      }
      if (!premium && /\b(voice command|call [\p{L}]|play music|zakiplay|navigate to|open my business|manage my business)\b/i.test(text)) { requirePremium(); return; }
      const auth = window.ZakiChatAuth;
      if (auth?.ready) await auth.ready;
      const client = auth?.client;
      const {data:sessionData} = client ? await client.auth.getSession() : {data:null};
      const token = sessionData?.session?.access_token;
      if (!token) { addMessage("ai","Please sign in to Molan Chat to use Molano AI."); return; }
      const system = premium
        ? "You are Molano AI, the friendly built-in assistant in Molan Chat by Zakmolanitech Solutions. Detect the user's language and reply in that same language. Help with personal and business tasks, app help, and concise voice-command support. Do not claim you placed calls, played music, or changed settings unless a connected app confirms it. Ask for confirmation before consequential actions. For calls, direct the user to select the correct contact and confirm the call. ZakiPlay is the music destination."
        : "You are Molano AI, the built-in essential help assistant in Molan Chat by Zakmolanitech Solutions. Detect the user's language and reply in that same language. Provide short, basic guidance about using Molan Chat and general everyday questions. Do not perform personalized voice commands, contact/call actions, business management, or control ZakiPlay for local accounts. Explain politely that Customized Personal or Customized Business unlocks those capabilities.";
      const response = await fetch(API, {method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token,"X-Molano-Client":"molan-chat"},body:JSON.stringify({messages:[{role:"user",content:system},...history]})});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || "Molano AI is temporarily unavailable. Please try again.");
      const reply = String(data.reply || "I couldn't prepare a reply just now. Please try again.");
      history.push({role:"assistant",content:reply}); history = history.slice(-12); addMessage("ai",reply); speak(reply);
    } catch (error) {
      addMessage("ai",error.message || "Molano AI is temporarily unavailable. Please try again.");
    } finally {
      busy = false; $("mca-send").disabled = false; $("mca-status").textContent = "Ready when you are";
    }
  }
  function startRecognition() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { addMessage("ai","Voice recognition is not available in this browser. You can type your command, or try the Molan Chat Android app."); return; }
    stopRecognition(); recognition = new Ctor(); recognition.lang = navigator.language || "en-US"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => $("mca-mic").classList.add("recording");
    recognition.onresult = event => { const transcript = event.results?.[0]?.[0]?.transcript || ""; if (transcript) send(transcript); };
    recognition.onerror = event => { if (event.error !== "aborted" && event.error !== "no-speech") addMessage("ai","I couldn't hear that command clearly. Please try again."); };
    recognition.onend = () => { recognition = null; $("mca-mic").classList.remove("recording"); };
    try { recognition.start(); } catch (_) {}
  }
  function stopRecognition() { if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; } $("mca-mic").classList.remove("recording"); }

  $("mca-launch").addEventListener("click",()=>panel.classList.contains("open")?closePanel():openPanel());
  $("mca-close").addEventListener("click",closePanel);
  $("mca-form").addEventListener("submit",event=>{event.preventDefault();send(input.value);});
  $("mca-mic").addEventListener("click",()=>{if (tier !== "personal_monthly" && tier !== "business_monthly") return requirePremium(); if (recognition) stopRecognition(); else startRecognition();});
  $("mca-actions").addEventListener("click",event=>{const button=event.target.closest("button");if(!button)return;if(button.dataset.prompt)send(button.dataset.prompt);if(button.dataset.action==="upgrade"){location.href="upgrade.html";}});
  input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();send(input.value);}});
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&recognition)stopRecognition();});
  loadAccount();
})();