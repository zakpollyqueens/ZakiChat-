(function () {
  "use strict";
  if (window.__MOLANO_CHAT_COMPANION__) return;
  window.__MOLANO_CHAT_COMPANION__ = true;

  const API = "https://molanoai.zakpollyqueens.workers.dev/api/chat";
  const STYLE_ID = "molano-chat-companion-style";
  const ROOT_ID = "molano-chat-companion";
  let user = null, tier = "local", history = [], busy = false, recognition = null, pendingComposeRecipient = "";
  let speechEnabled = true;
  let voiceSessionActive = false;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID}{position:fixed;z-index:10020;right:16px;bottom:calc(88px + env(safe-area-inset-bottom,0px));font-family:inherit;color:#eef8ff}
    #${ROOT_ID} *{box-sizing:border-box}
    #${ROOT_ID} .mca-launch{width:58px;height:58px;border:1px solid #8af0ff99;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,#a8f8ff,#39c7ed 44%,#174b85 78%,#0a1830);box-shadow:0 8px 28px #12bfe966,0 0 0 5px #3fd6f31a;color:#041629;font-size:0;font-weight:950;cursor:pointer;position:relative;isolation:isolate}
    #${ROOT_ID} .mca-launch svg{width:32px;height:32px;display:block;filter:drop-shadow(0 1px 4px #05253c55)}
    #${ROOT_ID} .mca-launch:after{content:"";position:absolute;inset:-5px;border:1px solid #7beaff55;border-radius:50%;animation:mcaPulse 2.8s ease-out infinite}
    #${ROOT_ID} .mca-panel{position:absolute;right:0;bottom:70px;width:min(390px,calc(100vw - 24px));height:min(590px,calc(100dvh - 150px));display:none;flex-direction:column;overflow:hidden;border:1px solid #78dff455;border-radius:24px;background:linear-gradient(155deg,#081a2d,#0c2438 60%,#0b1527);box-shadow:0 24px 80px #0009,inset 0 1px #ffffff19}
    #${ROOT_ID}.mca-panel.open{display:flex;animation:mcaEnter .2s ease-out}
    #${ROOT_ID} .mca-head{display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid #ffffff17;background:#ffffff06}
    #${ROOT_ID} .mca-avatar{width:42px;height:42px;flex:none;border-radius:15px;display:grid;place-items:center;color:#06182a;font-weight:950;background:linear-gradient(145deg,#a8f8ff,#39c7ed 54%,#638cff);box-shadow:0 4px 16px #40c9e944}
    #${ROOT_ID} .mca-avatar svg{width:27px;height:27px;display:block}
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
    #${ROOT_ID} .mca-send,#${ROOT_ID} .mca-mic,#${ROOT_ID} .mca-camera{width:43px;height:43px;flex:none;border:0;border-radius:13px;display:grid;place-items:center;font-size:17px;font-weight:900;cursor:pointer}
    #${ROOT_ID} .mca-send{background:linear-gradient(135deg,#9af5ff,#53c8f0);color:#062039}#${ROOT_ID} .mca-mic,#${ROOT_ID} .mca-camera{background:#17334b;border:1px solid #41617c;color:#c9f5ff}#${ROOT_ID} .mca-camera{position:relative;overflow:hidden}#${ROOT_ID} .mca-camera input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
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
      <header class="mca-head"><div class="mca-avatar" aria-hidden="true"><svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" focusable="false"><path d="M24 5.5 28.2 17.2 40 21.5 28.2 25.8 24 37.5 19.8 25.8 8 21.5 19.8 17.2Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M35.5 7.5v8m-4-4h8M11 33v8m-4-4h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="35.5" cy="7.5" r="2" fill="currentColor"/><circle cx="11" cy="33" r="2" fill="currentColor"/></svg></div><div class="mca-brand"><strong>Molano AI</strong><small id="mca-status">Your Molan Chat companion</small></div><button class="mca-close" id="mca-close" aria-label="Close assistant">×</button></header>
      <div class="mca-tier" id="mca-tier">LOCAL ACCOUNT · ESSENTIAL HELP</div>
      <div class="mca-messages" id="mca-messages" aria-live="polite"><div class="mca-welcome"><div class="star">✦</div><h3>Hi, I'm Molano.</h3><p>Ask me for help with Molan Chat. Personalized accounts can also use voice commands, contact assistance and ZakiPlay.</p></div></div>
      <div class="mca-actions" id="mca-actions"><button class="mca-chip" data-prompt="Help me use Molan Chat">Chat help</button><button class="mca-chip" data-prompt="What can you do?">What can you do?</button><button class="mca-chip" data-action="upgrade">Unlock more</button></div>
      <form class="mca-composer" id="mca-form"><textarea id="mca-input" rows="1" placeholder="Message Molano…" aria-label="Message Molano AI"></textarea><button class="mca-camera" id="mca-camera" type="button" aria-label="Scan a paper" title="Take or upload a photo of a paper">📷</button><button class="mca-mic" id="mca-mic" type="button" aria-label="Voice command" title="Voice command">🎙</button><button class="mca-send" id="mca-send" type="submit" aria-label="Send message">➤</button><input id="mca-image" type="file" accept="image/*" capture="environment" hidden></form>
      <div class="mca-note" id="mca-note">Your chats stay in Molan Chat. AI replies are generated by Molano AI.</div>
    </section>
    <button class="mca-launch" id="mca-launch" type="button" aria-label="Open Molano AI" title="Talk to Molano AI"><svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" focusable="false"><path d="M24 5.5 28.2 17.2 40 21.5 28.2 25.8 24 37.5 19.8 25.8 8 21.5 19.8 17.2Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M35.5 7.5v8m-4-4h8M11 33v8m-4-4h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="35.5" cy="7.5" r="2" fill="currentColor"/><circle cx="11" cy="33" r="2" fill="currentColor"/></svg></button>`;
  document.body.appendChild(root);

  const $ = id => document.getElementById(id);
  const panel = $("mca-panel"), messages = $("mca-messages"), input = $("mca-input");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function addMessage(role, text, afterSpeak) {
    // Customized accounts use Molano as a spoken companion, not a text-message bot.
    // Standard/local accounts keep the readable AI chat experience.
    if (role === "ai" && (tier === "personal_monthly" || tier === "business_monthly")) {
      speak(text, afterSpeak);
      return null;
    }
    const welcome = messages.querySelector(".mca-welcome"); if (welcome) welcome.remove();
    const node = document.createElement("div"); node.className = "mca-bubble " + role; node.textContent = text;
    messages.appendChild(node); messages.scrollTop = messages.scrollHeight;
    if (typeof afterSpeak === "function") speak(text, afterSpeak);
    return node;
  }
  let speechToken = 0;
  function speak(text, onend) {
    const token = ++speechToken;
    const finish = () => { if (token === speechToken && typeof onend === "function") onend(); };
    if (!speechEnabled || !("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) { if (onend) setTimeout(finish, 0); return; }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 1800));
      const language = navigator.language || "en";
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase()) || voices.find(v => v.lang.toLowerCase().startsWith(language.split("-")[0].toLowerCase())) || null;
      utterance.lang = utterance.voice?.lang || language;
      utterance.rate = .98;
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
      if (onend) setTimeout(() => { if (token === speechToken && window.speechSynthesis.speaking === false && window.speechSynthesis.pending === false) finish(); }, Math.min(8500, Math.max(1200, String(text).length * 70)));
    } catch (_) { finish(); }
  }
  const hasVoiceEntitlement = () => tier === "personal_monthly" || tier === "business_monthly";
  function continueVoiceConversation() {
    if (voiceSessionActive && panel.classList.contains("open") && hasVoiceEntitlement() && !busy && !recognition) {
      setTimeout(() => {
        if (voiceSessionActive && panel.classList.contains("open") && hasVoiceEntitlement() && !busy && !recognition) startRecognition();
      }, 220);
    }
  }
  function answer(text, afterSpeak) {
    if (hasVoiceEntitlement()) {
      addMessage("ai", text, () => {
        if (typeof afterSpeak === "function") afterSpeak();
        else continueVoiceConversation();
      });
    } else {
      addMessage("ai", text);
      speak(text, afterSpeak);
    }
  }
  function setTier(plan) {
    tier = plan;
    const premium = plan === "personal_monthly" || plan === "business_monthly";
    $("mca-tier").textContent = premium ? (plan === "business_monthly" ? "CUSTOMIZED BUSINESS · VOICE & PRODUCT ACTIONS" : "CUSTOMIZED PERSONAL · VOICE & PERSONAL ASSISTANCE") : "LOCAL ACCOUNT · ESSENTIAL HELP";
    $("mca-status").textContent = premium ? "Personalized companion enabled" : "Essential help enabled";
    $("mca-note").textContent = premium
      ? "Voice commands are enabled. Calls and app actions require your confirmation."
      : "Local access includes essential chat help. Upgrade to Customized Personal or Customized Business for voice commands and personal actions.";
    const welcome = messages.querySelector(".mca-welcome");
    if (welcome) welcome.hidden = premium;
    const actions = $("mca-actions");
    const unlock = actions.querySelector('[data-action="upgrade"]');
    if (unlock) unlock.hidden = premium;
    let business = actions.querySelector('[data-action="business-workspace"]');
    if (plan === "business_monthly" && !business) {
      business = document.createElement("button"); business.type = "button"; business.className = "mca-chip"; business.dataset.action = "business-workspace"; business.textContent = "Business workspace"; actions.appendChild(business);
    }
    if (business) business.hidden = plan !== "business_monthly";
    $("mca-mic").disabled = !premium;
    $("mca-mic").title = premium ? "Voice command" : "Voice commands require a customized account";
  }
  async function loadAccount() {
    try {
      const auth = window.ZakiChatAuth;
      if (auth?.ready) await auth.ready;
      const client = auth?.client;
      if (!client) { setTier("local"); return tier; }
      const {data: sessionData, error: sessionError} = await client.auth.getSession();
      if (sessionError) throw sessionError;
      user = sessionData?.session?.user || null;
      if (!user) { setTier("local"); return tier; }
      const {data: rows, error} = await client.from("user_upgrades").select("plan,status,expires_at").eq("user_id", user.id).eq("status", "active").gt("expires_at", new Date().toISOString()).order("expires_at", {ascending:false}).limit(10);
      if (error) throw error;
      const plans = Array.isArray(rows) ? rows : [];
      // If an account has more than one valid upgrade row, business access wins.
      const selected = plans.some(row => ["business_monthly","business_customized"].includes(row.plan))
        ? "business_monthly"
        : plans.some(row => ["personal_monthly","personal_customized"].includes(row.plan))
          ? "personal_monthly"
          : "local";
      setTier(selected);
      return tier;
    } catch (error) { console.warn("Could not verify Molano companion subscription.",error); setTier("local"); return tier; }
  }
  async function openPanel() {
    panel.classList.add("open");
    $("mca-launch").setAttribute("aria-expanded","true");
    voiceSessionActive = false;
    const plan = await loadAccount();
    if (!panel.classList.contains("open")) return;
    if (plan === "personal_monthly" || plan === "business_monthly") {
      voiceSessionActive = true;
      const greeting = plan === "business_monthly"
        ? "Hello, welcome back! I’m Molano, your AI companion for Molan Chat and your business workspace. Tell me what you need, and I’ll explain what I’m about to do before carrying it out."
        : "Hello! I’m Molano, your personal AI companion. Tell me what you’d like help with, and I’ll guide you through it.";
      $("mca-status").textContent = "Welcome back — listening after the greeting";
      speak(greeting, () => {
        if (panel.classList.contains("open") && voiceSessionActive && hasVoiceEntitlement() && !recognition) startRecognition();
      });
    } else {
      $("mca-status").textContent = "Essential help enabled";
      setTimeout(()=>{ if(panel.classList.contains("open")) input.focus(); },100);
    }
  }
  function closePanel() {
    panel.classList.remove("open");
    $("mca-launch").setAttribute("aria-expanded","false");
    voiceSessionActive = false;
    stopRecognition();
    speechToken++;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    $("mca-status").textContent = "Molano AI is silent. Tap to speak again.";
  }
  function requirePremium() {
    addMessage("ai", "I can help with essential Molan Chat questions on a local account. For personalized voice commands, contact assistance and ZakiPlay control, choose Customized Personal or Customized Business in Molan Chat's upgrade section.");
    speak("Personalized voice commands are available with a customized account.");
  }
  function findAction(text) {
    const t = text.toLowerCase();
    const directPlay = text.match(/^\s*(?:please\s+)?(?:play|put on|listen to)\s+(.+?)\s*$/i);
    const naturalListen = text.match(/\b(?:listen to|hear|play|put on)\s+(?:(?:the|this|a|some)\s+)?(?:(?:song|track)\s+(?:called\s+)?)?(.+?)\s*$/i);
    const playMatch = directPlay || naturalListen;
    if (playMatch) {
      const requested = playMatch[1].trim().replace(/^(?:(?:the|this|a|some)\s+)?(?:song|track|music)\s+/i, "").replace(/^(?:the|this|a|some)\s+/i, "").replace(/[.!?,]+$/, "").trim();
      const generic = /^(?:music|some music|songs?|a song|a playlist|playlist|zakiplay|something|)$/i.test(requested);
      const song = generic ? "music" : requested;
      return {type:"play", song, autoplay:true, reply:generic ? "I’ll open ZakiPlay and look for a track with a confirmed open licence. I’ll start it automatically if a suitable playable track is available." : "I’ll open ZakiPlay and search for " + requested + ". I’ll start playback only if a suitable open-licensed match is available."};
    }
    if (/\b(music|song|songs|playlist|zakiplay)\b/.test(t)) return {type:"play", song:"music", autoplay:true, reply:"I’ll open ZakiPlay and look for a track with a confirmed open licence. I’ll start it automatically if a suitable playable track is available."};
    const messageWithColon = text.match(/\b(?:write|compose|draft|send)\s+(?:a\s+)?message\s+(?:for|to)\s+([\p{L}][\p{L} .'-]{0,38}?)\s*:\s*(.+)$/iu);
    if (messageWithColon) return {type:"message", name:messageWithColon[1].trim(), draft:messageWithColon[2].trim(), reply:"I’ll open the right contact and prepare a draft. You can review it before sending."};
    const messageWithSaying = text.match(/\b(?:write|compose|draft|send)\s+(?:a\s+)?message\s+(?:for|to)\s+(.+?)\s+(?:saying|that says)\s+(.+)$/iu);
    if (messageWithSaying) return {type:"message", name:messageWithSaying[1].trim().replace(/[.!?,]+$/, ""), draft:messageWithSaying[2].trim(), reply:"I’ll open the right contact and prepare a draft. You can review it before sending."};
    const messageSimple = text.match(/\b(?:write|compose|draft)\s+(?:a\s+)?message\s+(?:for|to)\s+([\p{L}][\p{L} .'-]{0,38})\s*$/iu);
    if (messageSimple) return {type:"message", name:messageSimple[1].trim(), draft:"", reply:"I’ll open that contact. Tell me what you’d like the message to say, then review it before sending."};
    if (/\b(check|read|show|look for)\b.*\b(messages|new messages|unread messages)\b|\bcheck my messages\b/i.test(text)) return {type:"messages", reply:"I’ll open your Chats so you can review your conversations and unread messages."};
    const call = t.match(/\b(?:call|voice call|ring|phone)\s+(?:my friend\s+|contact\s+)?([\p{L}][\p{L} .'-]{0,38})/iu);
    if (call) return {type:"call", name:call[1].trim().replace(/[.!?,]+$/,""), reply:"I'll help you find that contact. Please confirm the correct person in Molan Chat before placing the call."};
    if (/\b(help|how do i|how to)\b/.test(t) && /\b(chat|message|group|status|updates|call|settings|contact)\b/.test(t)) return {type:"help",reply:"You can start a chat from the + menu, find people using search, view statuses in Updates, and change app preferences in Settings. For a call, open the contact or conversation and tap the call control."};
    return null;
  }
  function savePendingDraft(name, draft) {
    if (!user?.id) throw new Error("Sign in again before preparing a private message draft.");
    const key = "molano-pending-message-draft:" + user.id;
    localStorage.setItem(key, JSON.stringify({name:String(name||"").trim(),draft:String(draft||"").slice(0,4000),createdAt:new Date().toISOString()}));
  }
  async function performAction(action) {
    if (action.type === "play") {
      answer(action.reply,()=>{location.href = "zakiplay.html" + (action.song ? "?song=" + encodeURIComponent(action.song) : "") + (action.autoplay ? (action.song ? "&" : "?") + "autoplay=1" : "");});
      return true;
    }
    if (action.type === "call") {
      const reply = action.reply + " Searching for: " + action.name + ".";
      answer(reply,()=>{location.href = "contacts.html?molanoContact=" + encodeURIComponent(action.name) + "&molanoCall=1";});
      return true;
    }
    if (action.type === "message") {
      if (!action.draft) {
        pendingComposeRecipient = action.name;
        const prompt = "What would you like me to write for " + action.name + "? Say or type the message, and I’ll prepare a draft for you to review before sending.";
        answer(prompt);
        return true;
      }
      answer(action.reply,()=>{
        try { savePendingDraft(action.name,action.draft); location.href = "contacts.html?molanoContact=" + encodeURIComponent(action.name); }
        catch(error) { answer(error.message||"I couldn't save that draft. Please try again."); }
      });
      return true;
    }
    if (action.type === "messages") {
      answer(action.reply,()=>{location.href = "chats.html";});
      return true;
    }
    if (action.type === "help") {
      answer(action.reply);
      return true;
    }
    return false;
  }
  async function sendImage(file, question) {
    if (!file || busy) return;
    await loadAccount();
    if (!/^image\\//i.test(file.type || "") || file.size > 8 * 1024 * 1024) {
      addMessage("ai", "Please choose a photo smaller than 8 MB.");
      return;
    }
    const auth = window.ZakiChatAuth;
    if (auth?.ready) await auth.ready;
    const client = auth?.client;
    const {data:sessionData} = client ? await client.auth.getSession() : {data:null};
    const token = sessionData?.session?.access_token;
    if (!token) { addMessage("ai", "Please sign in to Molan Chat to scan a paper."); return; }
    busy = true; $("mca-send").disabled = true; $("mca-camera").disabled = true; $("mca-status").textContent = "Reading your paper…";
    try {
      const imageData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("The photo could not be read. Please try again."));
        reader.readAsDataURL(file);
      });
      const response = await fetch(API.replace("/api/chat", "/api/solve-image"), {
        method: "POST",
        headers: {"Content-Type":"application/json","Authorization":"Bearer "+token,"X-Molano-Client":"molan-chat"},
        body: JSON.stringify({image: imageData, question: String(question || "Read this paper and explain the solution step by step.")})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "I couldn't read that paper. Please try another photo.");
      const reply = String(data.reply || "I couldn't prepare a solution for that image.");
      history.push({role:"user",content:"[Paper image] "+String(question || "Solve and explain this paper.")},{role:"assistant",content:reply});
      history = history.slice(-12);
      answer(reply);
    } catch (error) {
      answer(error.message || "Paper scanning is temporarily unavailable.");
    } finally {
      busy = false; $("mca-send").disabled = false; $("mca-camera").disabled = false; $("mca-status").textContent = "Ready when you are";
    }
  }
  async function send(text) {
    text = String(text || "").trim(); if (!text || busy) return;
    await loadAccount();
    addMessage("user",text); history.push({role:"user",content:text}); history = history.slice(-12);
    input.value = ""; busy = true; $("mca-send").disabled = true; $("mca-status").textContent = "Thinking…";
    try {
      const action = findAction(text);
      const premium = tier === "personal_monthly" || tier === "business_monthly";
      if (pendingComposeRecipient) {
        const recipient = pendingComposeRecipient; pendingComposeRecipient = "";
        if (/^(cancel|never mind|stop)$/i.test(text)) { const cancelled = "Okay, I cancelled the message draft."; answer(cancelled); return; }
        const reply = "I’ll prepare your message for " + recipient + ". Please review it in the conversation before sending.";
        answer(reply,()=>{
          try { savePendingDraft(recipient,text); location.href = "contacts.html?molanoContact=" + encodeURIComponent(recipient); }
          catch(error) { addMessage("ai",error.message||"I couldn't save that draft. Please try again."); }
        });
        return;
      }
      if (action) {
        if (["play","call","message","messages"].includes(action.type) && !premium) { requirePremium(); return; }
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
      const response = await fetch(API, {method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token,"X-Molano-Client":"molan-chat"},body:JSON.stringify({messages:history})});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || "Molano AI is temporarily unavailable. Please try again.");
      const reply = String(data.reply || "I couldn't prepare a reply just now. Please try again.");
      history.push({role:"assistant",content:reply}); history = history.slice(-12); answer(reply);
    } catch (error) {
      answer(error.message || "Molano AI is temporarily unavailable. Please try again.");
    } finally {
      busy = false; $("mca-send").disabled = false; $("mca-status").textContent = "Ready when you are";
    }
  }
  function startRecognition() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      voiceSessionActive=false;
      answer("Voice recognition is not available in this browser. You can type your command, or try the Molan Chat Android app.");
      return;
    }
    stopRecognition();
    let heardTranscript=false;
    const instance=new Ctor();
    recognition=instance;
    instance.lang=navigator.language||"en-US";
    instance.interimResults=false;
    instance.maxAlternatives=1;
    instance.onstart=()=>{$("mca-mic").classList.add("recording");$("mca-status").textContent="Listening — speak naturally"};
    instance.onresult=event=>{
      const transcript=event.results?.[0]?.[0]?.transcript||"";
      if(transcript){heardTranscript=true;send(transcript);}
    };
    instance.onerror=event=>{
      if(event.error==="not-allowed"||event.error==="service-not-allowed"){
        voiceSessionActive=false;
        answer("Microphone access was denied. Allow microphone access in your browser or Android app settings, then tap the AI assistant again.");
      }else if(event.error!=="aborted"&&event.error!=="no-speech"){
        answer("I couldn't hear that command clearly. Please try again.");
      }
    };
    instance.onend=()=>{
      if(recognition===instance)recognition=null;
      $("mca-mic").classList.remove("recording");
      // If the user was silent, keep the active voice session ready. A real
      // transcript is restarted only after Molano has finished its reply.
      if(!heardTranscript&&voiceSessionActive&&panel.classList.contains("open")&&hasVoiceEntitlement()){
        setTimeout(()=>{if(voiceSessionActive&&panel.classList.contains("open")&&hasVoiceEntitlement()&&!busy&&!recognition)startRecognition()},450);
      }
    };
    try{instance.start()}catch(_){if(recognition===instance)recognition=null}
  }
  function stopRecognition() {
    if(recognition){const instance=recognition;recognition=null;try{instance.stop()}catch(_){}}
    $("mca-mic").classList.remove("recording");
  }

  $("mca-launch").addEventListener("click",()=>panel.classList.contains("open")?closePanel():openPanel());
  $("mca-close").addEventListener("click",closePanel);
  $("mca-form").addEventListener("submit",event=>{event.preventDefault();send(input.value);});
  $("mca-mic").addEventListener("click",()=>{if (!hasVoiceEntitlement()) return requirePremium(); if (recognition) { voiceSessionActive=false; stopRecognition(); speechToken++; if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } else { voiceSessionActive=true; startRecognition(); }});
  $("mca-camera").addEventListener("click",()=> $("mca-image").click());
  $("mca-image").addEventListener("change",event=>{const file=event.target.files?.[0];if(file)sendImage(file,input.value.trim());event.target.value="";});
  $("mca-actions").addEventListener("click",event=>{const button=event.target.closest("button");if(!button)return;if(button.dataset.prompt)send(button.dataset.prompt);if(button.dataset.action==="upgrade"){addMessage("ai","Open Settings and choose the upgrade/subscription option to select Customized Personal or Customized Business."); location.href="settings.html";}if(button.dataset.action==="business-workspace"){location.href="business-dashboard.html";}});
  input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();send(input.value);}});
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&recognition)stopRecognition();});
  loadAccount();
})();