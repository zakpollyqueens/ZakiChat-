(function () {
  "use strict";
  const input = document.getElementById("phone");
  const quote = document.getElementById("registrationCurrencyQuote");
  const note = document.getElementById("fxRateTimestamp");
  if (!input || !quote) return;

  const africanCountries = new Set([
    "dz","ao","bj","bw","bf","bi","cv","cm","cf","td","km","cg","cd","ci","dj","eg","gq","er","sz","et","ga","gm","gh","gn","gw","ke","ls","lr","ly","mg","mw","ml","mr","mu","ma","mz","na","ne","ng","rw","st","sn","sc","sl","so","za","ss","sd","tz","tg","tn","ug","zm","zw"
  ]);
  const freeCountries = new Set(["ug", "ke", "tz"]);

  function selectedCountry() {
    try {
      const instance = window.intlTelInputGlobals?.getInstance?.(input);
      const country = instance?.getSelectedCountryData?.();
      if (country?.iso2) return country.iso2.toLowerCase();
    } catch (_) {}
    const value = input.value.trim();
    const dialCode = value.match(/^\+(\d{1,3})/);
    if (!dialCode) return "";
    const codes = { "256":"ug", "254":"ke", "255":"tz" };
    return codes[dialCode[1]] || "";
  }

  function render() {
    const country = selectedCountry();
    if (!country) {
      quote.textContent = "Select your country to see the one-time registration fee.";
      if (note) note.textContent = "Fees are shown in USD. No exchange rate is applied on this screen.";
      return;
    }
    if (freeCountries.has(country)) {
      quote.textContent = "Registration fee: Free";
    } else if (africanCountries.has(country)) {
      quote.textContent = "Registration fee: $1 one-time";
    } else {
      quote.textContent = "Registration fee: $5 one-time";
    }
    if (note) note.textContent = "The final fee is confirmed by the secure registration/payment flow.";
  }

  input.addEventListener("countrychange", render);
  input.addEventListener("change", render);
  input.addEventListener("input", render);
  document.addEventListener("DOMContentLoaded", render);
  let attempts = 0;
  const timer = setInterval(() => {
    render();
    attempts += 1;
    if (window.intlTelInputGlobals?.getInstance?.(input) || attempts >= 20) clearInterval(timer);
  }, 250);
  render();
})();
