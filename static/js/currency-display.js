(function () {
  "use strict";
  const input=document.getElementById("phone");
  const quote=document.getElementById("registrationCurrencyQuote");
  const note=document.getElementById("fxRateTimestamp");
  const africanCountries=new Set(["dz","ao","bj","bw","bf","bi","cv","cm","cf","td","km","cg","cd","ci","dj","eg","gq","er","sz","et","ga","gm","gh","gn","gw","ke","ls","lr","ly","mg","mw","ml","mr","mu","ma","mz","na","ne","ng","rw","st","sn","sc","sl","so","za","ss","sd","tz","tg","tn","ug","zm","zw"]);
  const freeCountries=new Set(["ug","ke","tz"]);
  const currencyByCountry={
    ug:"UGX",ke:"KES",tz:"TZS",us:"USD",lr:"USD",ec:"USD",sv:"USD",pa:"USD",mh:"USD",fm:"USD",pw:"USD",
    gb:"GBP",je:"GBP",gg:"GBP",im:"GBP",eu:"EUR",de:"EUR",fr:"EUR",it:"EUR",es:"EUR",pt:"EUR",nl:"EUR",be:"EUR",ie:"EUR",at:"EUR",fi:"EUR",gr:"EUR",cy:"EUR",mt:"EUR",lu:"EUR",sk:"EUR",si:"EUR",ee:"EUR",lv:"EUR",lt:"EUR",hr:"EUR",
    ca:"CAD",au:"AUD",nz:"NZD",za:"ZAR",ng:"NGN",gh:"GHS",rw:"RWF",bi:"BIF",et:"ETB",eg:"EGP",ma:"MAD",zm:"ZMW",zw:"ZWG",mw:"MWK",mz:"MZN",na:"NAD",bw:"BWP",ls:"LSL",sz:"SZL",cm:"XAF",sn:"XOF",ci:"XOF",bf:"XOF",ml:"XOF",ne:"XOF",tg:"XOF",bj:"XOF",gn:"GNF",sl:"SLE",gm:"GMD",lr:"LRD",so:"SOS",sd:"SDG",ss:"SSP",ly:"LYD",mu:"MUR",sc:"SCR",ao:"AOA",dz:"DZD",tn:"TND",cv:"CVE",st:"STN",gq:"XAF",ga:"XAF",cg:"XAF",td:"XAF",cf:"XAF",km:"KMF",dj:"DJF",er:"ERN",
    in:"INR",pk:"PKR",bd:"BDT",lk:"LKR",np:"NPR",jp:"JPY",cn:"CNY",kr:"KRW",sg:"SGD",my:"MYR",id:"IDR",ph:"PHP",th:"THB",vn:"VND",kh:"KHR",la:"LAK",mm:"MMK",hk:"HKD",tw:"TWD",ae:"AED",sa:"SAR",qa:"QAR",kw:"KWD",bh:"BHD",om:"OMR",il:"ILS",tr:"TRY",ru:"RUB",ua:"UAH",ch:"CHF",no:"NOK",se:"SEK",dk:"DKK",pl:"PLN",cz:"CZK",hu:"HUF",ro:"RON",bg:"BGN",is:"ISK",br:"BRL",mx:"MXN",ar:"ARS",cl:"CLP",co:"COP",pe:"PEN",uy:"UYU",py:"PYG",bo:"BOB",cr:"CRC",do:"DOP",jm:"JMD",tt:"TTD",bs:"BSD",bb:"BBD",bz:"BZD",gy:"GYD",sr:"SRD"
  };
  const dialCountry={"256":"ug","254":"ke","255":"tz","1":"us","44":"gb","33":"fr","49":"de","39":"it","34":"es","351":"pt","31":"nl","32":"be","353":"ie","43":"at","358":"fi","30":"gr","45":"dk","46":"se","47":"no","41":"ch","48":"pl","420":"cz","36":"hu","40":"ro","359":"bg","90":"tr","7":"ru","380":"ua","91":"in","92":"pk","880":"bd","94":"lk","977":"np","81":"jp","86":"cn","82":"kr","65":"sg","60":"my","62":"id","63":"ph","66":"th","84":"vn","852":"hk","886":"tw","971":"ae","966":"sa","974":"qa","965":"kw","973":"bh","968":"om","972":"il","55":"br","52":"mx","54":"ar","56":"cl","57":"co","51":"pe","61":"au","64":"nz","27":"za","234":"ng","233":"gh","250":"rw","257":"bi","251":"et","20":"eg","212":"ma","260":"zm","263":"zw","265":"mw","258":"mz","264":"na","267":"bw","266":"ls","268":"sz","237":"cm","221":"sn","225":"ci","226":"bf","223":"ml","227":"ne","228":"tg","229":"bj","224":"gn","232":"sl","220":"gm","252":"so","249":"sd","211":"ss","218":"ly","230":"mu","248":"sc","244":"ao","213":"dz","216":"tn","238":"cv","239":"st","240":"gq","241":"ga","242":"cg","235":"td","236":"cf","269":"km","253":"dj","291":"er"};
  let rates=null,rateTime="";
  function getSelectedCountry(){
    try{const selected=window.intlTelInputGlobals?.getInstance?.(input)?.getSelectedCountryData?.();if(selected?.iso2)return selected.iso2.toLowerCase()}catch(_){}
    const value=input?.value?.trim()||"";
    const match=value.match(/^\+(\d{1,3})/);
    if(!match)return "";
    for(let n=match[1].length;n>0;n--){const key=match[1].slice(0,n);if(dialCountry[key])return dialCountry[key]}
    return "";
  }
  function countryFromPhone(phone){
    const digits=String(phone||"").replace(/[^+\d]/g,"");
    const m=digits.match(/^\+(\d{1,3})/);if(!m)return "";
    for(let n=m[1].length;n>0;n--){const key=m[1].slice(0,n);if(dialCountry[key])return dialCountry[key]}
    return "";
  }
  function fmt(amount,currency){
    try{return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:currency==="UGX"||currency==="TZS"||currency==="RWF"||currency==="JPY"||currency==="KRW"||currency==="VND"?0:2}).format(amount)}catch(_){return currency+" "+amount.toLocaleString()}
  }
  async function loadRates(){
    if(rates)return rates;
    try{const cached=JSON.parse(localStorage.getItem("molan_fx_usd_rates")||"null");if(cached&&cached.rates&&Date.now()-cached.savedAt<6*60*60*1000){rates=cached.rates;rateTime=cached.time||"";return rates}}catch(_){}
    const response=await fetch("https://open.er-api.com/v6/latest/USD",{cache:"no-store"});
    if(!response.ok)throw Error("Exchange rates are temporarily unavailable.");
    const data=await response.json();if(data.result!=="success"||!data.rates)throw Error("Exchange rates are temporarily unavailable.");
    rates=data.rates;rateTime=data.time_last_update_utc||data.time_next_update_utc||"";
    try{localStorage.setItem("molan_fx_usd_rates",JSON.stringify({rates,savedAt:Date.now(),time:rateTime}))}catch(_){}
    return rates;
  }
  async function renderPrices(country){
    const currency=currencyByCountry[country]||"USD";
    const priceNodes=document.querySelectorAll("[data-plan-id][data-price]");
    let rate=1,converted=false;
    if(currency!=="USD"){try{const r=await loadRates();rate=Number(r[currency]);if(!Number.isFinite(rate)||rate<=0)throw Error("Missing exchange rate");converted=true}catch(_){rate=1}}
    priceNodes.forEach(card=>{
      const usd=Number(card.dataset.price);if(!Number.isFinite(usd))return;
      const priceText=fmt(converted?Math.round(usd*rate):usd,converted?currency:"USD");const strong=card.querySelector(".upgrade-price strong");if(strong)strong.textContent=priceText;const priceLabel=card.querySelector("[data-upgrade-price]");if(priceLabel)priceLabel.textContent="Upgrade fee: "+priceText+"/month";
      const button=card.querySelector("[data-upgrade-plan]");if(button){const type=card.dataset.accountType==="business"?"Business":"Personal";button.textContent="Upgrade "+type+" · "+fmt(converted?Math.round(usd*rate):usd,converted?currency:"USD")+"/month"}
    });
    document.querySelectorAll("[data-plan-choice]").forEach(button=>{
      const plan=button.dataset.planChoice;if(plan==="personal_monthly"||plan==="business_monthly"){const usd=plan==="personal_monthly"?2:10;const label=plan==="personal_monthly"?"Personal":"Business";button.textContent=(button.dataset.planDisplayLabel||("Choose "+label))+" · "+fmt(converted?Math.round(usd*rate):usd,converted?currency:"USD")+"/month"}
    });
    let info=document.getElementById("planCurrencyNote");
    if(!info){info=document.createElement("p");info.id="planCurrencyNote";info.className="currency-quote-note";const target=document.querySelector(".upgrade-plans-grid")||document.querySelector(".account-plan-showcase")||document.getElementById("updatesUpgradeList")?.parentElement;target?.append(info)}
    if(info){if(currency==="USD")info.textContent="Prices shown in USD for your registered account country.";else if(converted)info.textContent="Prices converted from USD using the latest available exchange rate"+(rateTime?" ("+rateTime+")":"")+". The final amount is confirmed at secure checkout.";else info.textContent="Live exchange rates are temporarily unavailable. Prices are shown in USD until a rate can be retrieved."}
  }
  async function getAccountCountry(){
    const phoneInputCountry=getSelectedCountry();if(phoneInputCountry)return phoneInputCountry;
    try{const client=window.ZakiChatAuth?.client;if(!client)return "";const {data:{session}}=await client.auth.getSession();if(!session?.user)return "";const {data}=await client.from("profiles").select("phone").eq("id",session.user.id).maybeSingle();return countryFromPhone(data?.phone||session.user.phone||"")}catch(_){return ""}
  }
  async function renderRegistration(){
    if(!input||!quote)return;
    const country=getSelectedCountry();
    if(!country){quote.textContent="Select your country to see the one-time registration fee.";if(note)note.textContent="Registration fees are set in USD and displayed in your local currency where exchange rates are available.";return}
    const free=freeCountries.has(country),usd=free?0:(africanCountries.has(country)?1:5),currency=currencyByCountry[country]||"USD";
    if(free){quote.textContent="Registration fee: Free";if(note)note.textContent="No registration fee applies to Uganda, Kenya or Tanzania."}
    else if(currency==="USD"){quote.textContent="Registration fee: "+fmt(usd,"USD")+" one-time";if(note)note.textContent="The final fee is confirmed by the secure registration/payment flow."}
    else {try{const r=await loadRates();const rate=Number(r[currency]);if(!Number.isFinite(rate)||rate<=0)throw Error("Missing rate");quote.textContent="Registration fee: "+fmt(Math.round(usd*rate),currency)+" one-time";if(note)note.textContent="Converted from "+fmt(usd,"USD")+" using the latest exchange rate"+(rateTime?" ("+rateTime+")":"")+". Final fees are confirmed by secure checkout."}catch(_){quote.textContent="Registration fee: "+fmt(usd,"USD")+" one-time";if(note)note.textContent="Live exchange rates are temporarily unavailable; this is the USD reference fee."}}
  }
  window.ZakiChatCurrency={refreshPrices:async()=>{const country=await getAccountCountry();if(country)await renderPrices(country)},hasRate:country=>{const currency=currencyByCountry[String(country||"").toLowerCase()]||"USD";return currency==="USD"||Number(rates?.[currency])>0},formatUsd:(amount,countryCode)=>{const code=String(countryCode||"").toLowerCase(),currency=currencyByCountry[code]||"USD";if(currency==="USD")return fmt(Number(amount),"USD");const rate=Number(rates?.[currency]);if(!Number.isFinite(rate)||rate<=0)return fmt(Number(amount),"USD");return fmt(Math.round(Number(amount)*rate),currency)},getCountryCurrency:country=>currencyByCountry[String(country||"").toLowerCase()]||"USD",countryFromPhone,loadRates,renderPrices,format:fmt};
  async function refresh(){const country=await getAccountCountry();if(country)await renderPrices(country);await renderRegistration()}
  if(input){input.addEventListener("countrychange",()=>{void renderRegistration()});input.addEventListener("change",()=>{void renderRegistration()});input.addEventListener("input",()=>{void renderRegistration()});renderRegistration();let tries=0;const timer=setInterval(()=>{void renderRegistration();if(window.intlTelInputGlobals?.getInstance?.(input)||++tries>=20)clearInterval(timer)},250)}
  document.addEventListener("DOMContentLoaded",()=>{void refresh()});
  setTimeout(()=>{void refresh()},500);
})();