/* ZakiChat currency display: USD remains the canonical billing currency. */
(function () {
  'use strict';

  const CACHE_KEY = 'zakichat-usd-fx-v1';
  const CACHE_TTL = 6 * 60 * 60 * 1000;
  const CURRENCIES = {
    ug:'UGX', ke:'KES', tz:'TZS', rw:'RWF', bi:'BIF', cd:'CDF', ss:'SSP',
    ng:'NGN', gh:'GHS', za:'ZAR', zm:'ZMW', mw:'MWK', et:'ETB', so:'SOS',
    sd:'SDG', eg:'EGP', ma:'MAD', dz:'DZD', tn:'TND', ly:'LYD', bw:'BWP',
    na:'NAD', sz:'SZL', ls:'LSL', mz:'MZN', ao:'AOA', cm:'XAF', sn:'XOF',
    ci:'XOF', bj:'XOF', tg:'XOF', bf:'XOF', ml:'XOF', ne:'XOF', ga:'XAF',
    cg:'XAF', cf:'XAF', td:'XAF', gq:'XAF', us:'USD', gb:'GBP', ca:'CAD',
    au:'AUD', nz:'NZD', in:'INR', pk:'PKR', bd:'BDT', lk:'LKR', np:'NPR',
    ph:'PHP', sg:'SGD', my:'MYR', id:'IDR', th:'THB', vn:'VND', cn:'CNY',
    jp:'JPY', kr:'KRW', ae:'AED', sa:'SAR', qa:'QAR', kw:'KWD', bh:'BHD',
    om:'OMR', il:'ILS', tr:'TRY', ch:'CHF', no:'NOK', se:'SEK', dk:'DKK',
    pl:'PLN', cz:'CZK', hu:'HUF', ro:'RON', bg:'BGN', is:'ISK',
    de:'EUR', fr:'EUR', es:'EUR', it:'EUR', pt:'EUR', nl:'EUR', be:'EUR',
    ie:'EUR', fi:'EUR', gr:'EUR', at:'EUR', sk:'EUR', si:'EUR', cy:'EUR',
    mt:'EUR', ee:'EUR', lv:'EUR', lt:'EUR', hr:'EUR', lu:'EUR'
  };

  let rates = { USD: 1 };
  let rateDate = '';

  function number(value, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency, maximumFractionDigits: currency === 'UGX' || currency === 'TZS' || currency === 'RWF' ? 0 : 2
      }).format(value);
    } catch (_) {
      return currency + ' ' + Number(value).toFixed(2);
    }
  }

  async function loadRates() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && cached.savedAt && Date.now() - cached.savedAt < CACHE_TTL && cached.rates) {
        rates = cached.rates;
        rateDate = cached.date || '';
        return;
      }
    } catch (_) {}

    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
      if (!response.ok) throw new Error('Exchange-rate service unavailable');
      const payload = await response.json();
      if (payload.result !== 'success' || !payload.rates) throw new Error('Invalid exchange-rate response');
      rates = { ...payload.rates, USD: 1 };
      rateDate = payload.time_last_update_utc || payload.time_last_update_unix || '';
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, date: rateDate, savedAt: Date.now() }));
    } catch (error) {
      console.warn('ZakiChat FX rates unavailable; showing USD until rates load.', error);
    }
  }

  function selectedCountry() {
    const input = document.getElementById('phone');
    const instance = input && window.intlTelInputGlobals && window.intlTelInputGlobals.getInstance(input);
    return instance?.getSelectedCountryData()?.iso2 || 'ug';
  }

  function countryCurrency(iso) {
    return CURRENCIES[iso] || 'USD';
  }

  function displayQuote(amount, currency) {
    const rate = rates[currency];
    if (!rate || !Number.isFinite(Number(rate))) return number(amount, 'USD') + ' (USD reference)';
    return number(Number(amount) * Number(rate), currency);
  }

  function render() {
    const iso = selectedCountry();
    const currency = countryCurrency(iso);
    document.querySelectorAll('[data-usd-price]').forEach(el => {
      const usd = Number(el.dataset.usdPrice);
      if (!Number.isFinite(usd)) return;
      const local = displayQuote(usd, currency);
      el.textContent = currency === 'USD' ? number(usd, 'USD') : local + ' estimate';
      el.title = currency === 'USD'
        ? 'Canonical price in USD'
        : 'Approximate conversion from USD; checkout remains in USD until local-currency payment is supported.';
    });

    const quote = document.getElementById('registrationCurrencyQuote');
    if (quote) {
      const fee = ['ug','ke','tz'].includes(iso) ? 0 : (
        ['dz','ao','bj','bw','bf','bi','cv','cm','cf','td','km','cg','cd','ci','dj','eg','gq','er','sz','et','ga','gm','gh','gn','gw','ke','ls','lr','ly','mg','mw','ml','mr','mu','ma','mz','na','ne','ng','rw','st','sn','sc','sl','so','za','ss','sd','tz','tg','tn','ug','zm','zw'].includes(iso) ? 1 : 5
      );
      quote.textContent = fee === 0
        ? 'Registration fee: Free in Uganda, Kenya and Tanzania.'
        : 'Registration fee: ' + displayQuote(fee, currency) + ' estimate (' + '$' + fee.toFixed(2) + ' USD canonical).';
    }

    const timestamp = document.getElementById('fxRateTimestamp');
    if (timestamp) timestamp.textContent = rateDate ? 'Exchange-rate reference: ' + rateDate : 'Live exchange rates will appear when a connection is available.';
  }

  window.ZakiChatCurrency = Object.freeze({
    formatUsd(amount, countryIso) {
      return displayQuote(Number(amount), countryCurrency(String(countryIso || 'ug').toLowerCase()));
    },
    getCurrency(countryIso) {
      return countryCurrency(String(countryIso || 'ug').toLowerCase());
    }
  });

  function bindCountry() {
    const input = document.getElementById('phone');
    if (!input) return;
    input.addEventListener('countrychange', render);
    input.addEventListener('change', render);
  }

  document.addEventListener('DOMContentLoaded', async function () {
    bindCountry();
    await loadRates();
    render();
    document.querySelectorAll('[data-plan-price-usd]').forEach(el => {
      el.dataset.usdPrice = el.dataset.planPriceUsd;
    });
    render();
  });
})();