/* Banana UK static PWA — OANDA practice FX / UK100 paper blotter (BananaPatterns method; India screener has no UK feed) */
(function () {
  "use strict";

  var LS_KEY = "banana-uk-fx-v1";
  var OANDA_CREDS_KEY = "banana-uk-oanda-creds-v1"; /* token+account in localStorage only — never commit */
  var QUOTE_PROXY_KEY = "banana-uk-quote-proxy-v1"; /* local TV proxy URL — never commit secrets */
  var DEFAULT_QUOTE_PROXY = "http://127.0.0.1:8791";
  var SEED_AS_OF = "2026-09-11";
  var DEFAULT_FX_USD = 1.27; /* optional tiny USD note — book is GBP-only */
  var DEFAULT_CASH = 800; /* £800 start equity */
  var OANDA_PRACTICE_HOST = "https://api-fxpractice.oanda.com";
  /* Never use api-fxtrade.oanda.com — live send stays locked. */
  var HOST_BADGE_HTML = '<span class="host-badge"><span class="host-name">banana-uk</span><span class="host-credit">\u00B7 OANDA practice FX / UK100 \u00B7 playbook inspired by BananaPatterns (India screener has no UK feed)</span></span>';

  var LINKS = [
    { href: "scanner", label: "Markets", short: "FX", ico: "▣" },
    { href: "ticket", label: "Trade", short: "Trade", ico: "⇄" },
    { href: "api", label: "API", short: "API", ico: "⌁" },
    { href: "scorecard", label: "P&L", short: "P&L", ico: "☰" },
    { href: "playbook", label: "More", short: "More", ico: "▤" },
    { href: "journal", label: "Journal", short: "Journal", ico: "✎" },
  ];
  var DESKTOP_LINKS = [
    { href: "overview", label: "Overview" },
    { href: "scanner", label: "Markets" },
    { href: "ticket", label: "Trade" },
    { href: "positions", label: "Positions" },
    { href: "charts", label: "Charts" },
    { href: "api", label: "API" },
    { href: "scorecard", label: "P&L" },
    { href: "journal", label: "Journal" },
    { href: "playbook", label: "Playbook" },
  ];
  var MORE_SHEET = [
    { href: "overview", label: "Overview" },
    { href: "positions", label: "Positions" },
    { href: "charts", label: "Charts" },
    { href: "playbook", label: "Playbook" },
  ];

  var DEFAULT_PLAYBOOK = {
    universe: "Both",
    entryMode: "Both",
    maxChasePct: 5,
    preferRsMin: 85,
    riskPctPerIdea: 1.5,
    stopPct: 8,
    maxOpenPositions: 5,
    maxNewPerSession: 2,
    trail: "EMA50",
    noAveragingDown: true,
    slippageBps: 10,
    fxGbpUsd: DEFAULT_FX_USD,
    startingCashGbp: DEFAULT_CASH,
    queueMarketOutsideHours: true,
    simSession: false,
    liveGateSessionsRequired: 60,
    checklistReviewedScorecard: false,
    checklistMaxDdAcceptable: false,
    checklistExpectancyRecorded: false,
  };

  /* OANDA v20-style instruments. Seed as-of Fri 11 Sep 2026 — plausible marks,
     fake-but-consistent pivot/% for Forming / Fresh / DoNotChase demos.
     OANDA practice pricing used when token+account present; else these seeds. */
  var SEED_SETUPS = [
    { symbol: "EUR_GBP", name: "EUR/GBP", last: 0.8425, changePct: -0.2, pivot: 0.8450, rs: 88, tags: ["Forming", "BlueSky"], note: "Forming watch — ~0.3% below pivot 0.8450" },
    { symbol: "GBP_JPY", name: "GBP/JPY", last: 191.20, changePct: -0.4, pivot: 192.80, rs: 90, tags: ["Forming", "VCP\u2229BlueSky", "VCP", "BlueSky"], note: "Forming — VCP\u2229Blue sky, ~0.8% below pivot" },
    { symbol: "USD_JPY", name: "USD/JPY", last: 146.10, changePct: -0.3, pivot: 147.20, rs: 84, tags: ["Forming", "BlueSky"], note: "Forming — RS near floor" },
    { symbol: "GBP_USD", name: "GBP/USD", last: 1.3148, changePct: 0.35, pivot: 1.3095, rs: 94, tags: ["Fresh", "VCP\u2229BlueSky", "VCP", "BlueSky"], note: "Fresh proposed — BO 11 Sep VCP\u2229Blue sky +0.4% over pivot" },
    { symbol: "EUR_USD", name: "EUR/USD", last: 1.1082, changePct: 0.22, pivot: 1.1040, rs: 91, tags: ["Fresh", "BlueSky"], note: "Fresh proposed — +0.4% over pivot" },
    { symbol: "XAU_GBP", name: "Gold/GBP", last: 1985.0, changePct: 0.5, pivot: 1970.0, rs: 93, tags: ["Fresh", "BlueSky"], note: "Fresh proposed — gold breakout in GBP" },
    { symbol: "UK100_GBP", name: "UK 100 (FTSE CFD)", last: 8325.0, changePct: 0.3, pivot: 8280.0, rs: 89, tags: ["Fresh", "VCP\u2229BlueSky", "VCP", "BlueSky"], note: "Fresh proposed — UK100 CFD +0.5% over pivot" },
    { symbol: "AUD_USD", name: "AUD/USD", last: 0.6720, changePct: -0.1, pivot: 0.6755, rs: 82, tags: ["Forming"], note: "Forming — RS 82 below prefer-85" },
    { symbol: "USD_CAD", name: "USD/CAD", last: 1.3580, changePct: 0.15, pivot: 1.3520, rs: 86, tags: ["Fresh", "BlueSky"], note: "Fresh proposed — +0.4% over pivot" },
    { symbol: "EUR_JPY", name: "EUR/JPY", last: 161.90, changePct: 6.2, pivot: 152.00, rs: 95, tags: ["DoNotChase", "BlueSky"], note: "Do-not-chase example +6.5% above pivot" },
    { symbol: "XAU_USD", name: "Gold/USD", last: 2685.0, changePct: 8.1, pivot: 2450.0, rs: 97, tags: ["DoNotChase"], note: "Do-not-chase example +9.6% above pivot" },
  ];

  function gbp(n, digits) {
    if (digits == null) digits = 2;
    var neg = n < 0;
    var abs = Math.abs(n);
    var fixed = abs.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return (neg ? "-" : "") + "\u00A3" + fixed;
  }
  function usdNote(n, fx, digits) {
    if (digits == null) digits = 2;
    var v = n * (fx || DEFAULT_FX_USD);
    var neg = v < 0;
    var abs = Math.abs(v);
    var fixed = abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return (neg ? "-" : "") + "$" + fixed;
  }
  function dual(n, fx, digits) {
    /* Book is GBP-only; fx arg kept for call-site compatibility (ignored for primary). */
    return gbp(n, digits);
  }
  function moneyHtml(n, fx, colored) {
    var cls = colored ? (n >= 0 ? "pos" : "neg") : "";
    var note = fx ? '<span class="usd-note" title="approx USD">\u00B7 ' + esc(usdNote(n, fx)) + "</span>" : "";
    return '<span class="money ' + cls + '"><span class="gbp">' + esc(gbp(n)) + "</span>" + note + "</span>";
  }
  function fmtPx(n, symbol) {
    var sym = normalizeInstrument(symbol || "");
    var x = Number(n);
    if (!(x === x)) return "—";
    var d = 2;
    if (/_JPY$/.test(sym) || sym === "UK100_GBP") d = 2;
    else if (/^XAU_/.test(sym)) d = 2;
    else if (/_USD$|_GBP$|_CAD$|_AUD$|_NZD$|_CHF$/.test(sym) || sym.indexOf("_") >= 0) d = 5;
    return x.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function pct(n, digits) {
    if (digits == null) digits = 1;
    return (n > 0 ? "+" : "") + n.toFixed(digits) + "%";
  }
    function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function uid() {
    return "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  function nowLondon() {
    var s = new Date().toLocaleString("en-US", { timeZone: "Europe/London" });
    return new Date(s);
  }
  function formatLondonDate(d) {
    d = d || nowLondon();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  function isWeekdayLondon(d) {
    d = d || nowLondon();
    var day = d.getDay();
    return day >= 1 && day <= 5;
  }
  /* FX spot ~24h Sun 22:00–Fri 22:00 London; UK100 cash hours narrower — label as FX session. */
  function isFxOpen(d) {
    d = d || nowLondon();
    var day = d.getDay();
    var mins = d.getHours() * 60 + d.getMinutes();
    if (day === 0) return mins >= 22 * 60; /* Sunday open */
    if (day === 6) return false;
    if (day === 5) return mins <= 22 * 60; /* Friday close */
    return true;
  }
  function sessionLabel(simSession, d) {
    d = d || nowLondon();
    var open = isFxOpen(d);
    var weekend = !isWeekdayLondon(d) && !(d.getDay() === 0 && isFxOpen(d));
    var isSim = !!(simSession || weekend);
    var label = "CLOSED";
    if (isSim && open) label = "SIM \u00B7 OPEN";
    else if (isSim) label = "SIM \u00B7 DEMO";
    else if (open) label = "FX OPEN";
    else if (isWeekdayLondon(d)) label = "FX CLOSED";
    else label = "WEEKEND";
    return { label: label, isSim: isSim, isOpen: open || isSim, sessionDate: formatLondonDate(d) };
  }

  function synthCloses(last, n) {
    n = n || 60;
    var out = [];
    var p = last * 0.72;
    for (var i = 0; i < n; i++) {
      var drift = (last - p) / (n - i);
      var noise = (Math.sin(i * 1.7) + Math.cos(i * 0.4)) * last * 0.008;
      p = p + drift + noise;
      out.push(Math.max(0.01, Math.round(p * 100) / 100));
    }
    out[out.length - 1] = last;
    return out;
  }
  function barsFromCloses(symbol, last) {
    var closes = synthCloses(last, 60);
    var bars = [];
    for (var i = 0; i < closes.length; i++) {
      var d = new Date("2026-09-11T10:00:00Z");
      d.setUTCDate(d.getUTCDate() - (closes.length - 1 - i));
      var ts = d.toISOString().slice(0, 10);
      var c = closes[i];
      bars.push({
        symbol: symbol,
        ts: ts,
        open: c * (1 - 0.004),
        high: c * (1 + 0.01),
        low: c * (1 - 0.012),
        close: c,
        volume: 100000 + i * 1000,
      });
    }
    return bars;
  }

  var book = null;
  var saveTimer = null;

  function emptyIds() {
    return { order: 1, fill: 1, position: 1, session: 1, equity: 1, closed: 1, regime: 1, setup: 1 };
  }

  function seedBook() {
    var now = new Date().toISOString();
    var ids = emptyIds();
    var setups = [];
    var quotes = {};
    var bars = {};
    for (var i = 0; i < SEED_SETUPS.length; i++) {
      var s = SEED_SETUPS[i];
      setups.push({
        id: ids.setup++,
        symbol: s.symbol,
        name: s.name,
        last: s.last,
        changePct: s.changePct,
        pivot: s.pivot,
        rs: s.rs,
        tags: s.tags.slice(),
        note: s.note,
        asOf: SEED_AS_OF,
        createdAt: now,
      });
      var slip = s.last * 0.0005;
      quotes[s.symbol] = {
        symbol: s.symbol,
        last: s.last,
        bid: s.last - slip,
        ask: s.last + slip,
        changePct: s.changePct,
        source: "seed",
        updatedAt: now,
      };
      bars[s.symbol] = barsFromCloses(s.symbol, s.last);
    }
    return {
      version: 1,
      settings: Object.assign({}, DEFAULT_PLAYBOOK),
      account: {
        cash: DEFAULT_CASH,
        peakEquity: DEFAULT_CASH,
        startingCash: DEFAULT_CASH,
        dayPnl: 0,
        daySession: SEED_AS_OF,
      },
      setups: setups,
      quotes: quotes,
      bars: bars,
      orders: [],
      fills: [],
      positions: [],
      sessions: [],
      equityCurve: [{ id: ids.equity++, ts: now, equity: DEFAULT_CASH, sessionDate: SEED_AS_OF }],
      closedTrades: [],
      regimes: [
        {
          id: ids.regime++,
          settingsJson: JSON.stringify(DEFAULT_PLAYBOOK),
          note: "Initial regime — default VCP/Blue sky playbook",
          createdAt: now,
        },
      ],
      nextIds: ids,
    };
  }

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(book)); }
    catch (e) { console.warn("Banana UK persist failed", e); }
  }
  function persistSoon() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 40);
  }

  function loadBook() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) { book = seedBook(); persist(); return; }
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !parsed.settings || !parsed.account) {
        book = seedBook(); persist(); return;
      }
      book = parsed;
      book.settings = Object.assign({}, DEFAULT_PLAYBOOK, book.settings);
      if (!book.nextIds) book.nextIds = emptyIds();
      if (!book.quotes) book.quotes = {};
      if (!book.bars) book.bars = {};
    } catch (e) {
      book = seedBook();
      persist();
    }
  }

  function resetBook() {
    book = seedBook();
    persist();
  }

  function getSettings() { return book.settings; }

  function getPositions() {
    return book.positions.filter(function (p) { return p.qty !== 0; }).slice().sort(function (a, b) {
      return a.openedAt < b.openedAt ? -1 : 1;
    });
  }

  function getWorkingOrders() {
    return book.orders.filter(function (o) {
      return o.status === "WORKING" || o.status === "PARTIAL" || o.status === "PENDING" || o.status === "QUEUED";
    });
  }

  function markToMarketEquity() {
    var mtm = book.account.cash;
    var positions = getPositions();
    for (var i = 0; i < positions.length; i++) mtm += positions[i].qty * positions[i].last;
    return mtm;
  }

  function getAccount() {
    var settings = getSettings();
    var row = book.account;
    var positions = getPositions();
    var posValue = 0;
    var openRisk = 0;
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      posValue += p.qty * p.last;
      if (p.stopPrice != null && p.qty > 0) openRisk += Math.max(0, (p.last - p.stopPrice) * p.qty);
      else if (p.qty > 0) openRisk += p.last * p.qty * (settings.stopPct / 100);
    }
    var equity = row.cash + posValue;
    var peak = Math.max(row.peakEquity, equity);
    if (peak > row.peakEquity) row.peakEquity = peak;
    var maxDd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    return {
      cash: row.cash,
      equity: equity,
      buyingPower: row.cash,
      openRisk: openRisk,
      dayPnl: row.dayPnl,
      totalPnl: equity - row.startingCash,
      peakEquity: peak,
      maxDrawdownPct: maxDd,
      startingCash: row.startingCash,
      currency: "GBP",
    };
  }

  function ema(closes, period) {
    if (closes.length < period) {
      if (!closes.length) return null;
      var s = 0;
      for (var i = 0; i < closes.length; i++) s += closes[i];
      return s / closes.length;
    }
    var k = 2 / (period + 1);
    var e = 0;
    for (var j = 0; j < period; j++) e += closes[j];
    e /= period;
    for (var t = period; t < closes.length; t++) e = closes[t] * k + e * (1 - k);
    return e;
  }
  function sma(closes, period) {
    if (!closes.length) return null;
    var slice = closes.slice(-period);
    var s = 0;
    for (var i = 0; i < slice.length; i++) s += slice[i];
    return s / slice.length;
  }

  function computeSize(equity, entry, settings, stopPct) {
    var stop = stopPct != null ? stopPct : settings.stopPct;
    var riskGbp = equity * (settings.riskPctPerIdea / 100);
    var stopDist = entry * (stop / 100);
    if (stopDist <= 0) return 0;
    var raw = riskGbp / stopDist;
    /* FX/CFD: allow fractional units so UK100 / XAU can size on £800 book */
    if (raw >= 1) return Math.floor(raw);
    return Math.round(raw * 100) / 100;
  }

  function normalizeInstrument(sym) {
    return String(sym || "").trim().toUpperCase().replace(/\//g, "_").replace(/-/g, "_");
  }

  function getQuote(symbol) {
    var sym = normalizeInstrument(symbol);
    if (book.quotes[sym]) return book.quotes[sym];
    var setup = book.setups.filter(function (s) { return s.symbol === sym; })[0];
    if (setup) {
      var slip = setup.last * 0.0005;
      var q = {
        symbol: sym, last: setup.last, bid: setup.last - slip, ask: setup.last + slip,
        changePct: setup.changePct, source: "seed", updatedAt: new Date().toISOString(),
      };
      book.quotes[sym] = q;
      return q;
    }
    var now = new Date().toISOString();
    return { symbol: sym, last: 1, bid: 0.9995, ask: 1.0005, changePct: 0, source: "mark", updatedAt: now };
  }

  function loadOandaCreds() {
    try {
      var raw = localStorage.getItem(OANDA_CREDS_KEY);
      if (!raw) return { token: "", accountId: "", status: "disconnected" };
      var o = JSON.parse(raw);
      return {
        token: String(o.token || ""),
        accountId: String(o.accountId || ""),
        status: o.status || "disconnected",
        lastError: o.lastError || "",
        updatedAt: o.updatedAt || "",
      };
    } catch (e) {
      return { token: "", accountId: "", status: "disconnected" };
    }
  }
  function saveOandaCreds(patch) {
    var cur = loadOandaCreds();
    var next = Object.assign({}, cur, patch || {}, { updatedAt: new Date().toISOString() });
    try { localStorage.setItem(OANDA_CREDS_KEY, JSON.stringify(next)); }
    catch (e) { console.warn("Banana UK OANDA creds persist failed", e); }
    return next;
  }
  function clearOandaCreds() {
    try { localStorage.removeItem(OANDA_CREDS_KEY); } catch (e) {}
    return { token: "", accountId: "", status: "disconnected" };
  }

  function loadQuoteProxy() {
    try {
      var raw = localStorage.getItem(QUOTE_PROXY_KEY);
      if (!raw) return { url: DEFAULT_QUOTE_PROXY, status: "seed", lastError: "" };
      var o = JSON.parse(raw);
      return {
        url: String(o.url != null ? o.url : DEFAULT_QUOTE_PROXY),
        status: o.status || "seed",
        lastError: o.lastError || "",
        updatedAt: o.updatedAt || "",
      };
    } catch (e) {
      return { url: DEFAULT_QUOTE_PROXY, status: "seed", lastError: "" };
    }
  }
  function saveQuoteProxy(patch) {
    var cur = loadQuoteProxy();
    var next = Object.assign({}, cur, patch || {}, { updatedAt: new Date().toISOString() });
    try { localStorage.setItem(QUOTE_PROXY_KEY, JSON.stringify(next)); }
    catch (e) { console.warn("Banana UK quote proxy persist failed", e); }
    return next;
  }
  function quoteSourceChip() {
    var p = loadQuoteProxy();
    if (p.status === "tradingview") return "tradingview";
    var c = loadOandaCreds();
    if (c.status === "practice") return "practice";
    return "seed";
  }

  function applyPriceTick(sym, last, bid, ask, source, changePct) {
    var prev = book.quotes[sym] ? book.quotes[sym].last : last;
    var chg = (changePct != null && isFinite(Number(changePct)))
      ? Number(changePct)
      : (prev > 0 ? ((last - prev) / prev) * 100 : 0);
    book.quotes[sym] = {
      symbol: sym, last: last,
      bid: bid > 0 ? bid : last,
      ask: ask > 0 ? ask : last,
      changePct: Math.round(chg * 10000) / 10000,
      source: source,
      updatedAt: new Date().toISOString(),
    };
    var setup = book.setups.filter(function (s) { return s.symbol === sym; })[0];
    if (setup) { setup.last = last; setup.changePct = book.quotes[sym].changePct; }
  }

  function refreshTradingViewQuotes(symbols, cb) {
    symbols = symbols || book.setups.map(function (s) { return s.symbol; });
    var proxy = loadQuoteProxy();
    var base = String(proxy.url || "").replace(/\/$/, "");
    if (!base) {
      if (cb) cb(0, "skip");
      return;
    }
    var instruments = symbols.map(normalizeInstrument).join(",");
    var url = base + "/quotes?instruments=" + encodeURIComponent(instruments);
    saveQuoteProxy({ status: "connecting" });
    fetch(url, { credentials: "omit" })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("HTTP " + r.status + " " + String(t).slice(0, 160)); });
        return r.json();
      })
      .then(function (data) {
        var prices = (data && data.prices) || [];
        var changed = 0;
        prices.forEach(function (pr) {
          if (pr.error && !(Number(pr.last) > 0)) return;
          var sym = normalizeInstrument(pr.instrument);
          var last = Number(pr.last);
          var bid = Number(pr.bid);
          var ask = Number(pr.ask);
          if (!(last > 0) && !(bid > 0) && !(ask > 0)) {
            var bids = pr.bids || [];
            var asks = pr.asks || [];
            bid = bids[0] ? Number(bids[0].price) : bid;
            ask = asks[0] ? Number(asks[0].price) : ask;
            last = (bid > 0 && ask > 0) ? (bid + ask) / 2 : (ask > 0 ? ask : bid);
          }
          if (!(last > 0)) return;
          applyPriceTick(sym, last, bid, ask, "tradingview", pr.changePct);
          changed++;
        });
        if (changed) {
          saveQuoteProxy({ status: "tradingview", lastError: "" });
          persistSoon();
          if (cb) cb(changed, "tradingview");
        } else {
          saveQuoteProxy({ status: "error", lastError: "Proxy returned no prices" });
          if (cb) cb(0, "empty");
        }
      })
      .catch(function (err) {
        var raw = String(err && err.message ? err.message : err);
        var msg = raw;
        if (/Failed to fetch|NetworkError|CORS|Load failed/i.test(raw)) {
          msg = "Quote proxy unreachable (" + base + "). Run locally: npm i && npm run quotes";
        }
        saveQuoteProxy({ status: "error", lastError: msg });
        if (cb) cb(0, "error");
      });
  }

  /* Prefer local TV proxy, then OANDA practice, then seed marks. */
  function refreshQuotes(symbols, cb) {
    refreshTradingViewQuotes(symbols, function (n, mode) {
      if (mode === "tradingview") { if (cb) cb(n, "tradingview"); return; }
      refreshOandaPracticeQuotes(symbols, function (n2, mode2) {
        if (cb) cb(n2, mode2);
      });
    });
  }

  /* Practice pricing only — never api-fxtrade. Falls back to seed marks offline / no token. */
  function refreshOandaPracticeQuotes(symbols, cb) {
    symbols = symbols || book.setups.map(function (s) { return s.symbol; });
    var creds = loadOandaCreds();
    if (!creds.token || !creds.accountId) {
      saveOandaCreds({ status: "seed", lastError: "No practice token/account — using seed marks" });
      if (cb) cb(0, "seed");
      return;
    }
    var instruments = symbols.map(normalizeInstrument).join(",");
    var url = OANDA_PRACTICE_HOST + "/v3/accounts/" + encodeURIComponent(creds.accountId) +
      "/pricing?instruments=" + encodeURIComponent(instruments);
    saveOandaCreds({ status: "connecting" });
    fetch(url, {
      credentials: "omit",
      headers: {
        Authorization: "Bearer " + creds.token,
        "Content-Type": "application/json",
      },
    })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("HTTP " + r.status + " " + String(t).slice(0, 120)); });
        return r.json();
      })
      .then(function (data) {
        var prices = (data && data.prices) || [];
        var changed = 0;
        prices.forEach(function (pr) {
          var sym = normalizeInstrument(pr.instrument);
          var bids = pr.bids || [];
          var asks = pr.asks || [];
          var bid = bids[0] ? Number(bids[0].price) : NaN;
          var ask = asks[0] ? Number(asks[0].price) : NaN;
          if (!(bid > 0) && !(ask > 0)) return;
          var last = (bid > 0 && ask > 0) ? (bid + ask) / 2 : (ask > 0 ? ask : bid);
          applyPriceTick(sym, last, bid, ask, "oanda-practice", null);
          changed++;
        });
        saveOandaCreds({ status: "practice", lastError: "" });
        if (changed) persistSoon();
        if (cb) cb(changed, "practice");
      })
      .catch(function (err) {
        var raw = String(err && err.message ? err.message : err);
        var msg = raw;
        if (/Failed to fetch|NetworkError|CORS|Load failed/i.test(raw)) {
          msg = "Browser blocked OANDA (CORS). GitHub Pages cannot call api-fxpractice from the phone. Paper still uses seed marks. For live practice quotes, run locally: node oanda-proxy.mjs";
        }
        saveOandaCreds({ status: "error", lastError: msg });
        if (cb) cb(0, "error");
      });
  }

  function syncToOandaPracticeStub() {
    var bits = liveBits();
    if (!bits.unlocked) {
      return {
        ok: false,
        msg: "Sync to OANDA practice is locked until " + bits.left + " more paper sessions (60-session live/practice send gate). Orders stay local paper only.",
      };
    }
    return {
      ok: false,
      msg: "Practice send stub — even after the gate, Banana UK keeps orders paper-local unless you wire a dedicated practice sync. Live fxtrade is never called.",
    };
  }

  function bumpSessionTrades(sessionDate) {
    var sess = book.sessions.filter(function (s) { return s.sessionDate === sessionDate; })[0];
    if (!sess) return;
    sess.trades += 1;
    sess.dayPnl = book.account.dayPnl;
  }

  function applyFill(order, qty, price, slipBps) {
    var now = new Date().toISOString();
    var sessionDate = order.sessionDate;
    var newFilled = order.filledQty + qty;
    var prevAvg = order.avgFillPrice || 0;
    var avg = newFilled > 0 ? (prevAvg * order.filledQty + price * qty) / newFilled : price;
    order.filledQty = newFilled;
    order.avgFillPrice = avg;
    order.status = newFilled >= order.qty - 1e-9 ? "FILLED" : "PARTIAL";
    order.updatedAt = now;

    book.fills.unshift({
      id: book.nextIds.fill++,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      qty: qty,
      price: price,
      slippageBps: slipBps,
      createdAt: now,
      sessionDate: sessionDate,
    });

    var settings = getSettings();
    if (order.side === "BUY") {
      book.account.cash -= qty * price;
      var pos = book.positions.filter(function (p) { return p.symbol === order.symbol; })[0];
      if (pos) {
        var newQty = pos.qty + qty;
        pos.avgPrice = (pos.avgPrice * pos.qty + price * qty) / newQty;
        pos.qty = newQty;
        pos.last = price;
        pos.updatedAt = now;
      } else {
        var riskGbp = (settings.riskPctPerIdea / 100) * markToMarketEquity();
        book.positions.push({
          id: book.nextIds.position++,
          symbol: order.symbol,
          qty: qty,
          avgPrice: price,
          last: price,
          stopPrice: null,
          trailKind: settings.trail,
          openedAt: now,
          updatedAt: now,
          realizedPnl: 0,
          entryRiskGbp: riskGbp,
        });
      }
    } else {
      var p2 = book.positions.filter(function (p) { return p.symbol === order.symbol; })[0];
      if (p2) {
        var pnl = (price - p2.avgPrice) * qty;
        var remain = p2.qty - qty;
        book.account.cash += qty * price;
        book.account.dayPnl += pnl;
        var rMult = p2.entryRiskGbp > 0 ? pnl / p2.entryRiskGbp : null;
        if (remain <= 1e-9) {
          book.closedTrades.push({
            id: book.nextIds.closed++,
            symbol: order.symbol,
            qty: p2.qty,
            entryAvg: p2.avgPrice,
            exitAvg: price,
            pnl: pnl + (p2.realizedPnl || 0),
            rMultiple: rMult,
            openedAt: p2.openedAt,
            closedAt: now,
            sessionDate: sessionDate,
          });
          book.positions = book.positions.filter(function (p) { return p.symbol !== order.symbol; });
          book.orders.forEach(function (o) {
            if (o.symbol === order.symbol && (o.status === "WORKING" || o.status === "PARTIAL" || o.status === "QUEUED" || o.status === "PENDING") && o.side === "SELL") {
              o.status = "CANCELLED";
              o.updatedAt = now;
            }
          });
        } else {
          p2.qty = remain;
          p2.last = price;
          p2.realizedPnl += pnl;
          p2.updatedAt = now;
        }
      }
    }

    var eq = markToMarketEquity();
    book.equityCurve.push({ id: book.nextIds.equity++, ts: now, equity: eq, sessionDate: sessionDate });
    book.account.peakEquity = Math.max(book.account.peakEquity, eq);
    bumpSessionTrades(sessionDate);
  }

  function tryMatch(order, mark, settings) {
    var slipBps = settings.slippageBps;
    var fillPrice = null;
    var remaining = order.qty - order.filledQty;

    if (order.type === "MARKET") {
      var slip = mark * (slipBps / 10000);
      fillPrice = order.side === "BUY" ? mark + slip : mark - slip;
    } else if (order.type === "LIMIT") {
      if (order.limitPrice == null) return null;
      if (order.side === "BUY" && mark <= order.limitPrice) fillPrice = Math.min(mark, order.limitPrice);
      if (order.side === "SELL" && mark >= order.limitPrice) fillPrice = Math.max(mark, order.limitPrice);
    } else if (order.type === "STOP") {
      if (order.stopPrice == null) return null;
      if (order.side === "SELL" && mark <= order.stopPrice) fillPrice = mark - mark * (slipBps / 10000);
      if (order.side === "BUY" && mark >= order.stopPrice) fillPrice = mark + mark * (slipBps / 10000);
    } else if (order.type === "STOP_LIMIT") {
      if (order.stopPrice == null || order.limitPrice == null) return null;
      var triggered =
        (order.side === "SELL" && mark <= order.stopPrice) ||
        (order.side === "BUY" && mark >= order.stopPrice);
      if (triggered) {
        if (order.side === "BUY" && mark <= order.limitPrice) fillPrice = Math.min(mark, order.limitPrice);
        if (order.side === "SELL" && mark >= order.limitPrice) fillPrice = Math.max(mark, order.limitPrice);
      }
    }

    if (fillPrice == null || fillPrice <= 0) return null;

    var fillQty = remaining;
    if (order.type === "MARKET" && remaining > 10 && Math.random() < 0.15) {
      fillQty = Math.max(1, Math.floor(remaining * (0.6 + Math.random() * 0.35)));
    }

    applyFill(order, fillQty, fillPrice, slipBps);

    if (
      order.side === "BUY" &&
      order.filledQty > 0 &&
      !order.parentId &&
      (order.role === "ENTRY" || order.role == null)
    ) {
      var existingStop = book.orders.filter(function (o) {
        return o.parentId === order.id && o.role === "STOP" &&
          (o.status === "WORKING" || o.status === "PARTIAL" || o.status === "QUEUED" || o.status === "PENDING" || o.status === "FILLED");
      })[0];
      if (!existingStop) {
        var fillPx = order.avgFillPrice != null ? order.avgFillPrice : fillPrice;
        var stopPx = fillPx * (1 - settings.stopPct / 100);
        var now = new Date().toISOString();
        book.orders.unshift({
          id: book.nextIds.order++,
          clientId: uid(),
          symbol: order.symbol,
          side: "SELL",
          type: "STOP",
          tif: "GTC",
          qty: order.filledQty,
          filledQty: 0,
          limitPrice: null,
          stopPrice: stopPx,
          status: "WORKING",
          parentId: order.id,
          role: "STOP",
          avgFillPrice: null,
          rejectReason: null,
          createdAt: now,
          updatedAt: now,
          sessionDate: order.sessionDate,
        });
        var pos = book.positions.filter(function (p) { return p.symbol === order.symbol; })[0];
        if (pos) {
          pos.stopPrice = stopPx;
          pos.trailKind = settings.trail;
        }
      }
    }
    return order;
  }

  function placeOrder(input) {
    var settings = getSettings();
    var symbol = normalizeInstrument(input.symbol);
    var quote = getQuote(symbol);
    var account = getAccount();
    var session = sessionLabel(settings.simSession);
    var now = new Date().toISOString();

    var qty = input.qty || 0;
    if (input.riskBased || (!qty && input.side === "BUY")) {
      qty = computeSize(account.equity, quote.last, settings);
    }
    if (!qty || qty <= 0) return { ok: false, error: "Qty must be positive" };

    if (input.side === "BUY" && !input.parentId && input.role !== "STOP") {
      var positions = getPositions();
      if (positions.length >= settings.maxOpenPositions) {
        return { ok: false, error: "Max " + settings.maxOpenPositions + " open positions" };
      }
      var existing = positions.filter(function (p) { return p.symbol === symbol; })[0];
      if (existing && settings.noAveragingDown) {
        return { ok: false, error: "No averaging down (playbook)" };
      }
      var newToday = book.orders.filter(function (o) {
        return o.sessionDate === session.sessionDate && o.side === "BUY" &&
          (o.status === "FILLED" || o.status === "WORKING" || o.status === "PARTIAL" || o.status === "PENDING" || o.status === "QUEUED") &&
          (o.role == null || o.role === "ENTRY") && !o.parentId;
      }).length;
      if (newToday >= settings.maxNewPerSession) {
        return { ok: false, error: "Max " + settings.maxNewPerSession + " new entries per session" };
      }
      var setup = book.setups.filter(function (s) { return s.symbol === symbol; }).slice(-1)[0];
      if (setup && setup.pivot) {
        var above = ((quote.last - setup.pivot) / setup.pivot) * 100;
        if (above > settings.maxChasePct) {
          return { ok: false, error: "Do not chase: " + above.toFixed(1) + "% above pivot (max " + settings.maxChasePct + "%)" };
        }
      }
    }

    var notional = qty * quote.last;
    if (input.side === "BUY" && notional > account.buyingPower + 0.01) {
      return { ok: false, error: "Insufficient buying power (need " + gbp(notional, 0) + ", have " + gbp(account.buyingPower, 0) + ")" };
    }
    if (input.side === "SELL") {
      var pos = book.positions.filter(function (p) { return p.symbol === symbol; })[0];
      if (!pos || pos.qty < qty) return { ok: false, error: "Insufficient position to sell" };
    }

    var status = "WORKING";
    if (input.type === "MARKET" && !session.isOpen && settings.queueMarketOutsideHours) {
      status = "QUEUED";
    }

    var order = {
      id: book.nextIds.order++,
      clientId: uid(),
      symbol: symbol,
      side: input.side,
      type: input.type,
      tif: input.tif || "DAY",
      qty: qty,
      filledQty: 0,
      limitPrice: input.limitPrice != null ? input.limitPrice : null,
      stopPrice: input.stopPrice != null ? input.stopPrice : null,
      status: status,
      parentId: input.parentId != null ? input.parentId : null,
      role: input.role != null ? input.role : (input.parentId ? null : "ENTRY"),
      avgFillPrice: null,
      rejectReason: null,
      createdAt: now,
      updatedAt: now,
      sessionDate: session.sessionDate,
    };
    book.orders.unshift(order);

    if (status === "WORKING") tryMatch(order, quote.last, settings);
    persistSoon();
    return { ok: true, order: order };
  }

  function cancelOrder(id) {
    var o = book.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return { ok: false, error: "Order not found" };
    if (["WORKING", "PARTIAL", "PENDING", "QUEUED"].indexOf(o.status) < 0) {
      return { ok: false, error: "Cannot cancel " + o.status };
    }
    o.status = "CANCELLED";
    o.updatedAt = new Date().toISOString();
    persistSoon();
    return { ok: true };
  }

  function markUpdate(symbol) {
    var settings = getSettings();
    var positions = getPositions();
    var targets = symbol ? positions.filter(function (p) { return p.symbol === symbol; }) : positions;
    for (var i = 0; i < targets.length; i++) {
      var p = targets[i];
      var q = getQuote(p.symbol);
      p.last = q.last;
      p.updatedAt = new Date().toISOString();
      var bars = (book.bars[p.symbol] || []).slice();
      var closes = bars.map(function (b) { return b.close; });
      if (closes.length) closes[closes.length - 1] = q.last;
      var ma = settings.trail === "EMA50" ? ema(closes, 50) : sma(closes, Math.min(50, closes.length));
      if (ma != null && q.last < ma && p.qty > 0) {
        var workingExit = book.orders.filter(function (o) {
          return o.symbol === p.symbol && o.side === "SELL" &&
            (o.status === "WORKING" || o.status === "PARTIAL" || o.status === "QUEUED") && o.role === "TRAIL";
        })[0];
        if (!workingExit) {
          placeOrder({ symbol: p.symbol, side: "SELL", type: "MARKET", qty: p.qty, attachStop: false, role: "TRAIL" });
        }
      }
    }

    var working = getWorkingOrders();
    for (var w = 0; w < working.length; w++) {
      var o = working[w];
      if (symbol && o.symbol !== symbol) continue;
      var qq = getQuote(o.symbol);
      if (o.status === "QUEUED") {
        var sess = sessionLabel(settings.simSession);
        if (sess.isOpen || settings.simSession) {
          o.status = "WORKING";
          o.updatedAt = new Date().toISOString();
          tryMatch(o, qq.last, settings);
        }
        continue;
      }
      tryMatch(o, qq.last, settings);
    }
    persistSoon();
  }

  function getScorecard() {
    var settings = getSettings();
    var sessions = book.sessions.slice();
    var closed = book.closedTrades;
    var wins = closed.filter(function (t) { return t.pnl > 0; });
    var losses = closed.filter(function (t) { return t.pnl <= 0; });
    var cumR = 0;
    for (var i = 0; i < closed.length; i++) cumR += closed[i].rMultiple || 0;
    var winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
    var avgWinR = 0, avgLossR = 0, a, b, sw = 0, sl = 0;
    for (a = 0; a < wins.length; a++) sw += wins[a].rMultiple || 0;
    if (wins.length) avgWinR = sw / wins.length;
    for (b = 0; b < losses.length; b++) sl += losses[b].rMultiple || 0;
    if (losses.length) avgLossR = sl / losses.length;
    var expectancy = closed.length ? (winRate / 100) * avgWinR + (1 - winRate / 100) * avgLossR : 0;
    var account = getAccount();
    var sessionsLogged = sessions.length;
    var required = settings.liveGateSessionsRequired;
    var checklist = settings.checklistReviewedScorecard && settings.checklistMaxDdAcceptable && settings.checklistExpectancyRecorded;
    var liveUnlocked = sessionsLogged >= required && checklist;
    var left = Math.max(0, required - sessionsLogged);
    var liveLockedReason = "";
    if (sessionsLogged < required) liveLockedReason = "Live locked \u00B7 " + left + " sessions left";
    else if (!checklist) liveLockedReason = "Live locked \u00B7 complete go/no-go checklist";
    else liveLockedReason = "Live unlocked (stub \u2014 connect a broker after paper confirmation)";
    return {
      sessionsLogged: sessionsLogged,
      sessionsRequired: required,
      cumR: cumR,
      winRate: winRate,
      expectancy: expectancy,
      maxDdPct: account.maxDrawdownPct,
      totalTrades: closed.length,
      wins: wins.length,
      losses: losses.length,
      liveUnlocked: liveUnlocked,
      liveLockedReason: liveLockedReason,
      reference: { label: "Rule C bake-off (reference, not a promise)", cagr: 68.8, maxDd: -12.5, winRate: 52 },
    };
  }

  function logSession(notes) {
    var settings = getSettings();
    var sess = sessionLabel(settings.simSession);
    var existing = book.sessions.filter(function (s) { return s.sessionDate === sess.sessionDate; })[0];
    var acct = getAccount();
    if (!existing) {
      book.sessions.push({
        id: book.nextIds.session++,
        sessionDate: sess.sessionDate,
        isSim: sess.isSim,
        notes: notes || "",
        dayPnl: acct.dayPnl,
        trades: 0,
        createdAt: new Date().toISOString(),
      });
    } else {
      existing.notes = notes || existing.notes;
      existing.dayPnl = acct.dayPnl;
      existing.isSim = sess.isSim;
    }
    if (book.account.daySession !== sess.sessionDate) {
      book.account.dayPnl = 0;
      book.account.daySession = sess.sessionDate;
    }
    persistSoon();
    return { ok: true, sessionDate: sess.sessionDate };
  }

  function saveSettings(patch, note) {
    var prev = JSON.stringify(book.settings);
    Object.assign(book.settings, patch);
    if (JSON.stringify(book.settings) !== prev) {
      book.regimes.unshift({
        id: book.nextIds.regime++,
        settingsJson: JSON.stringify(book.settings),
        note: note || "Settings updated",
        createdAt: new Date().toISOString(),
      });
    }
    persistSoon();
  }

  function ingestSetups(payload) {
    var asOf = payload.asOf || formatLondonDate();
    var list = payload.setups || [];
    var now = new Date().toISOString();
    var added = 0;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!s || !s.symbol) continue;
      var symbol = String(s.symbol).toUpperCase();
      var last = Number(s.last) || 100;
      book.setups.push({
        id: book.nextIds.setup++,
        symbol: symbol,
        name: s.name || symbol,
        last: last,
        changePct: Number(s.changePct) || 0,
        pivot: s.pivot != null ? Number(s.pivot) : null,
        rs: s.rs != null ? Number(s.rs) : null,
        tags: Array.isArray(s.tags) ? s.tags : [],
        note: s.note || "Manual ingest \u2014 not from a BananaPatterns API",
        asOf: asOf,
        createdAt: now,
      });
      var slip = last * 0.0005;
      book.quotes[symbol] = {
        symbol: symbol, last: last, bid: last - slip, ask: last + slip,
        changePct: Number(s.changePct) || 0, source: "seed", updatedAt: now,
      };
      if (!book.bars[symbol]) book.bars[symbol] = barsFromCloses(symbol, last);
      added++;
    }
    persistSoon();
    return added;
  }

  function drawCandles(canvas, bars) {
    if (!canvas || !bars || !bars.length) return;
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth || 600;
    var cssH = canvas.clientHeight || 320;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0f1520";
    ctx.fillRect(0, 0, cssW, cssH);

    var padL = 8, padR = 56, padT = 12, padB = 22;
    var w = cssW - padL - padR;
    var h = cssH - padT - padB;
    var highs = bars.map(function (b) { return b.high; });
    var lows = bars.map(function (b) { return b.low; });
    var min = Math.min.apply(null, lows);
    var max = Math.max.apply(null, highs);
    var span = max - min || 1;
    min -= span * 0.04;
    max += span * 0.04;
    span = max - min;
    function y(v) { return padT + (1 - (v - min) / span) * h; }
    var n = bars.length;
    var slot = w / n;

    ctx.strokeStyle = "#1a2332";
    ctx.lineWidth = 1;
    for (var g = 0; g < 4; g++) {
      var gy = padT + (h * g) / 3;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + w, gy);
      ctx.stroke();
      ctx.fillStyle = "#6b7a90";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "left";
      var pv = max - (span * g) / 3;
      ctx.fillText(pv.toFixed(2), padL + w + 6, gy + 3);
    }

    var closes = bars.map(function (b) { return b.close; });
    var e50 = [];
    var k = 2 / 51;
    var e = 0;
    for (var i = 0; i < closes.length; i++) {
      if (i === 0) e = closes[0];
      else if (i < 50) {
        var s = 0;
        for (var j = 0; j <= i; j++) s += closes[j];
        e = s / (i + 1);
      } else e = closes[i] * k + e * (1 - k);
      e50.push(e);
    }

    ctx.beginPath();
    ctx.strokeStyle = "#40c4ff";
    ctx.lineWidth = 1.2;
    for (var m = 0; m < e50.length; m++) {
      var x = padL + slot * m + slot / 2;
      if (m === 0) ctx.moveTo(x, y(e50[m]));
      else ctx.lineTo(x, y(e50[m]));
    }
    ctx.stroke();

    for (var c = 0; c < n; c++) {
      var b = bars[c];
      var cx = padL + slot * c + slot / 2;
      var up = b.close >= b.open;
      ctx.strokeStyle = up ? "#F5C518" : "#e8544a";
      ctx.fillStyle = up ? "#F5C518" : "#e8544a";
      ctx.beginPath();
      ctx.moveTo(cx, y(b.high));
      ctx.lineTo(cx, y(b.low));
      ctx.stroke();
      var bw = Math.max(2, slot * 0.6);
      var yo = y(b.open);
      var yc = y(b.close);
      var top = Math.min(yo, yc);
      var bh = Math.max(1, Math.abs(yc - yo));
      ctx.fillRect(cx - bw / 2, top, bw, bh);
    }

    ctx.fillStyle = "#6b7a90";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(bars[0].ts, padL, cssH - 6);
    ctx.textAlign = "right";
    ctx.fillText(bars[n - 1].ts, padL + w, cssH - 6);
  }

  function equitySpark(points, height) {
    height = height || 80;
    if (!points || !points.length) return '<div class="muted" style="font-size:0.875rem">No equity history yet</div>';
    var vals = points.map(function (p) { return p.equity; });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var span = max - min || 1;
    var w = 600, h = height;
    var d = vals.map(function (v, i) {
      var x = (i / Math.max(vals.length - 1, 1)) * w;
      var yv = h - ((v - min) / span) * (h - 8) - 4;
      return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + yv.toFixed(1);
    }).join(" ");
    var up = vals[vals.length - 1] >= vals[0];
    return '<svg viewBox="0 0 ' + w + " " + h + '" style="width:100%;height:6rem" preserveAspectRatio="none"><path d="' + d + '" fill="none" stroke="' + (up ? "#F5C518" : "#e8544a") + '" stroke-width="2"/></svg>';
  }

  var moreOpen = false;
  var ticketState = {
    symbol: "GBP_USD", side: "BUY", type: "MARKET", tif: "DAY",
    qty: 0, riskBased: true, limitPrice: "", stopPrice: "", msg: "", busy: false,
    sizePct: 100, reduceOnly: false, tpsl: false, tpPrice: "", slPrice: "",
  };
  var chartSymbol = "GBP_USD";
  var playMsg = "";
  var scoreNotes = "";
  var scoreMsg = "";
  var ingestText = "";
  var ingestMsg = "";
  var deferredPrompt = null;

  function parseRoute() {
    var h = (location.hash || "").replace(/^#/, "") || "/overview";
    var qi = h.indexOf("?");
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var qs = qi >= 0 ? h.slice(qi + 1) : "";
    var page = (path.replace(/^\//, "") || "overview").split("/")[0];
    var known = { overview: 1, scanner: 1, ticket: 1, positions: 1, charts: 1, playbook: 1, scorecard: 1, api: 1, journal: 1 };
    if (!known[page]) page = "overview";
    var params = {};
    qs.split("&").forEach(function (pair) {
      if (!pair) return;
      var kv = pair.split("=");
      params[decodeURIComponent(kv[0] || "")] = decodeURIComponent((kv[1] || "").replace(/\+/g, " "));
    });
    return { page: page, params: params };
  }

  function go(page, params) {
    var h = "#/" + page;
    if (params) {
      var bits = [];
      Object.keys(params).forEach(function (k) {
        if (params[k] != null && params[k] !== "") bits.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
      });
      if (bits.length) h += "?" + bits.join("&");
    }
    location.hash = h;
  }

  function liveBits() {
    var score = getScorecard();
    var settings = getSettings();
    var left = Math.max(0, score.sessionsRequired - score.sessionsLogged);
    var liveLabel = score.liveUnlocked
      ? "Live unlocked (stub)"
      : score.sessionsLogged < score.sessionsRequired
        ? "Live locked \u00B7 " + left + " sessions left"
        : "Live locked \u00B7 checklist";
    var sess = sessionLabel(settings.simSession);
    return { score: score, settings: settings, left: left, liveLabel: liveLabel, sess: sess };
  }

  function actionableSetups(settings) {
    settings = settings || getSettings();
    return book.setups.filter(function (s) {
      if ((s.tags || []).indexOf("DoNotChase") >= 0) return false;
      if (s.pivot == null) return false;
      var vs = ((s.last - s.pivot) / s.pivot) * 100;
      if (vs > settings.maxChasePct) return false;
      if (s.rs != null && s.rs < settings.preferRsMin) return false;
      return (s.tags || []).indexOf("Fresh") >= 0 || (s.tags || []).indexOf("Forming") >= 0;
    });
  }

  function headerIntent(bits) {
    if (!bits.score.liveUnlocked) return { label: "PAPER", cls: "warn" };
    return { label: "LIVE", cls: "acc" };
  }

  function renderNav() {
    var route = parseRoute();
    var bits = liveBits();
    var settings = bits.settings;
    var actionables = actionableSetups(settings);
    var intent = headerIntent(bits);

    var dateEl = document.getElementById("stat-date");
    if (dateEl) dateEl.textContent = formatLondonDate();
    var namesEl = document.getElementById("stat-names");
    if (namesEl) namesEl.textContent = String(book.setups.length);
    var actEl = document.getElementById("stat-actionable");
    if (actEl) {
      actEl.textContent = String(actionables.length);
      actEl.className = "v" + (actionables.length ? " pos" : " dim");
    }
    var intentEl = document.getElementById("stat-intent");
    if (intentEl) {
      intentEl.textContent = intent.label;
      intentEl.className = "v " + intent.cls;
    }

    var pillPaper = document.getElementById("pill-paper");
    var pillLive = document.getElementById("pill-live");
    if (pillPaper && pillLive) {
      if (bits.score.liveUnlocked) {
        pillPaper.className = "mode-pill paper";
        pillLive.className = "mode-pill live on";
        pillLive.textContent = "LIVE";
        pillLive.title = "Live stub unlocked — still paper until broker connected";
      } else {
        pillPaper.className = "mode-pill paper on";
        pillLive.className = "mode-pill live locked";
        pillLive.textContent = "LIVE 🔒";
        pillLive.title = bits.liveLabel + " · " + bits.score.liveLockedReason;
      }
    }

    var desk = DESKTOP_LINKS.map(function (l) {
      var active = route.page === l.href;
      return '<a href="#/' + l.href + '" class="' + (active ? "active" : "") + '" data-nav="' + l.href + '">' + esc(l.label) + "</a>";
    }).join("");
    var deskNav = document.getElementById("desktop-nav");
    if (deskNav) deskNav.innerHTML = desk;

    var tabs = LINKS.map(function (l) {
      var active = route.page === l.href;
      if (l.href === "playbook") {
        var moreActive = MORE_SHEET.some(function (m) { return m.href === route.page; }) || route.page === "playbook";
        return (
          '<button type="button" class="tab' + (moreOpen || moreActive ? " on" : "") + '" id="more-btn" aria-expanded="' + moreOpen + '" aria-label="More">' +
          '<span class="ico">' + l.ico + "</span>More</button>"
        );
      }
      return (
        '<a href="#/' + l.href + '" class="' + (active ? "on" : "") + '" data-nav="' + l.href + '">' +
        '<span class="ico">' + l.ico + "</span>" + esc(l.short) + "</a>"
      );
    }).join("");

    var sheet = MORE_SHEET.map(function (l) {
      var active = route.page === l.href;
      return '<a href="#/' + l.href + '" class="' + (active ? "active" : "") + '" data-nav="' + l.href + '">' + esc(l.label) + "</a>";
    }).join("");
    var bottom = document.getElementById("bottom-tabs");
    if (bottom) {
      bottom.innerHTML = tabs;
      // more sheet as sibling after bottom nav
      var existing = document.getElementById("more-sheet");
      if (!existing) {
        existing = document.createElement("div");
        existing.id = "more-sheet";
        existing.className = "more-sheet";
        bottom.parentNode.insertBefore(existing, bottom);
      }
      existing.className = "more-sheet" + (moreOpen ? " open" : "");
      existing.innerHTML = sheet;
    }
  }

  function scannerRow(s, settings) {
    var vs = s.pivot != null ? ((s.last - s.pivot) / s.pivot) * 100 : null;
    var chase = vs != null && vs > settings.maxChasePct;
    var rsOk = s.rs == null || s.rs >= settings.preferRsMin;
    return (
      '<tr style="' + (chase ? "opacity:.6" : "") + '">' +
      '<td class="bright">' + esc(s.symbol) + "</td>" +
      "<td>" + s.last.toFixed(2) + "</td>" +
      '<td class="' + (s.changePct >= 0 ? "pos" : "neg") + '">' + esc(pct(s.changePct)) + "</td>" +
      "<td>" + (s.pivot != null ? s.pivot.toFixed(2) : "\u2014") + "</td>" +
      '<td class="' + (vs != null && vs > 0 ? "pos" : "neg") + '">' + (vs != null ? esc(pct(vs)) : "\u2014") + "</td>" +
      '<td class="' + (rsOk ? "pos" : "amber") + '">' + (s.rs != null ? s.rs : "\u2014") + "</td>" +
      '<td class="muted" style="font-size:12px">' + esc(s.tags.join(" \u00B7 ")) + "</td>" +
      '<td class="muted truncate" style="font-size:12px">' + esc(s.note) + "</td>" +
      "<td>" + (chase
        ? '<span style="font-size:10px;color:var(--red);text-transform:uppercase">No chase</span>'
        : '<a href="#/ticket?symbol=' + encodeURIComponent(s.symbol) + '">Ticket</a>') +
      "</td></tr>"
    );
  }

  function scannerSection(title, items, settings, tone) {
    var rows = items.map(function (s) { return scannerRow(s, settings); }).join("");
    if (!rows) rows = '<tr><td colspan="9" class="muted">None</td></tr>';
    return (
      '<div class="desk-panel" style="overflow:hidden">' +
      '<div class="panel-head ' + (tone || "") + '"><h2>' + esc(title) + " (" + items.length + ")</h2></div>" +
      '<div class="desk-scroll"><table class="desk-table min-w-720"><thead><tr>' +
      "<th>Symbol</th><th>Last</th><th>Chg</th><th>Pivot</th><th>vs Pivot</th><th>RS</th><th>Tags</th><th>Note</th><th></th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div></div>"
    );
  }

  function viewOverview() {
    markUpdate();
    var account = getAccount();
    var settings = getSettings();
    var fx = settings.fxGbpUsd;
    var positions = getPositions();
    var working = getWorkingOrders();
    var score = getScorecard();
    var setups = book.setups.slice(0, 8);
    var equity = book.equityCurve;
    var bits = liveBits();
    var checklistOk = settings.checklistReviewedScorecard && settings.checklistMaxDdAcceptable && settings.checklistExpectancyRecorded;

    var kpis = [
      { label: "Equity", v: account.equity },
      { label: "Cash", v: account.cash },
      { label: "Buying power", v: account.buyingPower },
      { label: "Open risk", v: account.openRisk },
      { label: "Day P&L", v: account.dayPnl, colored: true },
      { label: "Total P&L", v: account.totalPnl, colored: true },
    ].map(function (c) {
      return '<div class="desk-panel kpi"><div class="kpi-label">' + esc(c.label) + '</div><div class="kpi-val">' + moneyHtml(c.v, fx, !!c.colored) + "</div></div>";
    }).join("");

    var setupRows = setups.map(function (s) {
      return "<tr><td><a href=\"#/ticket?symbol=" + encodeURIComponent(s.symbol) + '">' + esc(s.symbol) + "</a></td><td>" + s.last.toFixed(2) + '</td><td class="' + (s.changePct >= 0 ? "pos" : "neg") + '">' + esc(pct(s.changePct)) + "</td><td>" + (s.rs != null ? s.rs : "\u2014") + '</td><td class="muted" style="font-size:12px">' + esc((s.tags || []).slice(0, 2).join(" \u00B7 ")) + "</td></tr>";
    }).join("");

    var posHtml;
    if (!positions.length) {
      posHtml = '<p class="empty">No open positions. Try paper-buying <a href="#/ticket?symbol=GBP_USD">GBP_USD</a> from the ticket.</p>';
    } else {
      posHtml = '<div class="desk-scroll"><table class="desk-table min-w-420"><thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th><th>UPL</th></tr></thead><tbody>' +
        positions.map(function (p) {
          var upl = (p.last - p.avgPrice) * p.qty;
          return "<tr><td>" + esc(p.symbol) + "</td><td>" + p.qty + "</td><td>" + p.avgPrice.toFixed(2) + "</td><td>" + p.last.toFixed(2) + '</td><td class="' + (upl >= 0 ? "pos" : "neg") + '">' + esc(dual(upl, fx)) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    return (
      '<div class="space-y">' +
      '<div class="flex-end"><div><h1 class="page-title">Overview ' + HOST_BADGE_HTML + '</h1><p class="page-sub">OANDA practice FX / UK100 paper desk \u00B7 ' + esc(bits.sess.label) + " \u00B7 seed as-of 11 Sep 2026</p></div>" +
      '<div class="mono" style="text-align:right;font-size:0.875rem"><div class="amber">' + esc(score.liveUnlocked ? "Live unlocked (broker stub)" : "Live locked \u00B7 " + bits.left + " sessions left") + "</div>" +
      '<div class="muted" style="font-size:12px;margin-top:2px">' + score.sessionsLogged + "/" + score.sessionsRequired + " sessions \u00B7 checklist " + (checklistOk ? "\u2713" : "\u25CB") + "</div></div></div>" +
      '<div class="kpis">' + kpis + "</div>" +
      '<div class="grid-3"><div class="desk-panel pad"><div class="flex-end" style="margin-bottom:8px"><h2 class="bright" style="font-weight:500;margin:0">Equity curve</h2><span class="muted" style="font-size:12px">Peak DD ' + account.maxDrawdownPct.toFixed(2) + "%</span></div>" + equitySpark(equity) + "</div>" +
      '<div class="desk-panel pad" style="font-size:0.875rem"><h2 class="bright" style="font-weight:500;margin:0 0 8px">Scorecard snapshot</h2><div class="mono" style="display:flex;flex-direction:column;gap:4px">' +
      '<div style="display:flex;justify-content:space-between"><span class="muted">Sessions</span><span>' + score.sessionsLogged + "</span></div>" +
      '<div style="display:flex;justify-content:space-between"><span class="muted">Cum R</span><span>' + score.cumR.toFixed(2) + "</span></div>" +
      '<div style="display:flex;justify-content:space-between"><span class="muted">Win rate</span><span>' + score.winRate.toFixed(1) + "%</span></div>" +
      '<div style="display:flex;justify-content:space-between"><span class="muted">Expectancy</span><span>' + score.expectancy.toFixed(2) + " R</span></div>" +
      '<div style="display:flex;justify-content:space-between"><span class="muted">Max DD</span><span>' + score.maxDdPct.toFixed(2) + "%</span></div></div>" +
      '<p class="muted" style="font-size:11px;padding-top:8px;border-top:1px solid var(--border);margin:8px 0 0">Ref (not a promise): Rule C bake-off ' + score.reference.cagr + "% CAGR / " + score.reference.maxDd + "% DD / " + score.reference.winRate + "% WR</p>" +
      '<a href="#/scorecard" class="desk-btn-primary" style="margin-top:8px;font-size:12px">Open scorecard</a></div></div>' +
      '<div class="grid-2"><div class="desk-panel" style="overflow:hidden"><div class="panel-head"><h2>Markets · FX / UK100 (seed)</h2><a href="#/scanner" style="font-size:12px">All setups \u2192</a></div>' +
      '<div class="desk-scroll"><table class="desk-table min-w-480"><thead><tr><th>Symbol</th><th>Last</th><th>Chg</th><th>RS</th><th>Tags</th></tr></thead><tbody>' + setupRows + "</tbody></table></div></div>" +
      '<div class="desk-panel" style="overflow:hidden"><div class="panel-head"><h2>Positions (' + positions.length + ") \u00B7 Working (" + working.length + ')</h2><a href="#/positions" style="font-size:12px">Blotter \u2192</a></div>' + posHtml + "</div></div></div>"
    );
  }

  function viewScanner() {
    var settings = getSettings();
    var setups = book.setups;
    var forming = setups.filter(function (s) { return s.tags.indexOf("Forming") >= 0; });
    var fresh = setups.filter(function (s) { return s.tags.indexOf("Fresh") >= 0; });
    var dnc = setups.filter(function (s) { return s.tags.indexOf("DoNotChase") >= 0; });
    return (
      '<div class="space-y"><div><h1 class="page-title">Markets ' + HOST_BADGE_HTML + '</h1>' +
      '<p class="page-sub">FX + UK100 CFD setups \u00B7 Seeded as-of Fri 11 Sep 2026 close \u00B7 Universe: ' + esc(settings.universe) + " \u00B7 Prefer RS \u2265 " + settings.preferRsMin + " \u00B7 No chase &gt; " + settings.maxChasePct + "%</p>" +
      '<p class="page-hint">BananaPatterns has no official API. Ingest your own rows below \u2014 paste JSON. Not financial advice.</p></div>' +
      scannerSection("Forming watch", forming, settings) +
      scannerSection("Fresh proposed", fresh, settings, "tone-green") +
      scannerSection("Do-not-chase examples", dnc, settings, "tone-red") +
      '<div class="desk-panel pad"><h2 style="margin-bottom:8px">Manual ingest</h2>' +
      '<p class="muted" style="font-size:12px;margin:0 0 8px">Example: <code>{"asOf":"2026-09-12","setups":[{"symbol":"EXAMPLE","name":"Example Ltd","last":100.5,"changePct":1.2,"pivot":99,"rs":91,"tags":["Fresh","BlueSky"],"note":"Manual ingest"}]}</code></p>' +
      '<textarea class="desk-input" id="ingest-json" placeholder="Paste setups JSON\u2026">' + esc(ingestText) + "</textarea>" +
      '<div style="margin-top:8px"><button type="button" class="desk-btn-primary" id="ingest-btn">Ingest setups</button></div>' +
      (ingestMsg ? '<div class="msg ok" style="margin-top:8px">' + esc(ingestMsg) + "</div>" : "") +
      "</div></div>"
    );
  }

  function viewTicket() {
    var route = parseRoute();
    if (route.params.symbol) ticketState.symbol = String(route.params.symbol).toUpperCase();
    var settings = getSettings();
    var quote = getQuote(ticketState.symbol);
    var account = getAccount();
    var fx = settings.fxGbpUsd;
    var bits = liveBits();
    var setup = book.setups.filter(function (s) { return s.symbol === ticketState.symbol; }).slice(-1)[0];
    var pivot = setup ? setup.pivot : null;
    var last = quote.last;
    var riskQty = computeSize(account.equity, last, settings);
    if (ticketState.riskBased) {
      ticketState.qty = Math.max(0, Math.floor(riskQty * (ticketState.sizePct / 100)));
    }
    var notional = ticketState.qty * last;
    var estSlip = last * (settings.slippageBps / 10000);
    var vsPivot = pivot != null && last ? ((last - pivot) / pivot) * 100 : null;
    var canSubmit = ticketState.qty > 0 && ticketState.symbol && !(ticketState.side === "BUY" && notional > account.buyingPower);
    var showLimit = ticketState.type === "LIMIT" || ticketState.type === "STOP_LIMIT";
    var showStop = ticketState.type === "STOP" || ticketState.type === "STOP_LIMIT";
    var okMsg = /FILLED|WORKING|QUEUED|PARTIAL/.test(ticketState.msg);
    var chgCls = quote.changePct >= 0 ? "pos" : "neg";
    var bars = book.bars[ticketState.symbol];
    if (!bars || !bars.length) {
      book.bars[ticketState.symbol] = barsFromCloses(ticketState.symbol, last);
      bars = book.bars[ticketState.symbol];
    }

    var types = ["MARKET", "LIMIT", "STOP", "STOP_LIMIT"].map(function (t) {
      return "<option" + (ticketState.type === t ? " selected" : "") + ">" + t + "</option>";
    }).join("");
    var tifs = ["DAY", "GTC"].map(function (t) {
      return "<option" + (ticketState.tif === t ? " selected" : "") + ">" + t + "</option>";
    }).join("");

    return (
      '<div class="space-y">' +
      '<div class="flex-end" style="margin-bottom:8px"><h1 class="page-title" style="margin:0">Trade ' + HOST_BADGE_HTML + '</h1></div>' +
      '<div class="card pad" style="margin-bottom:0">' +
      '<div class="tr-head"><div>' +
      '<div class="tr-pair"><span id="tr-pair-name">' + esc(ticketState.symbol) + '</span><span class="q">·' + esc(quoteSourceChip()) + '</span></div>' +
      '<div class="sub">' + esc(setup && setup.name ? setup.name : "cash equity") + ' · ' + esc(quote.source || quoteSourceChip()) + ' mark · FX & UK100 CFD</div>' +
      '</div><div class="tr-px">' +
      '<div class="mid num" id="tr-mid">' + last.toFixed(2) + '</div>' +
      '<div class="chg num ' + chgCls + '" id="tr-chg">' + esc(pct(quote.changePct)) + '</div>' +
      '</div></div>' +
      '<div class="chart-box"><div class="chart-label">Mark · daily spark</div><canvas id="tr-spark" width="640" height="144"></canvas></div>' +
      '<div class="avail-row">' +
      '<span>Avail to trade <b>' + esc(dual(account.buyingPower, fx)) + '</b></span>' +
      '<span>Cash <b>' + esc(dual(account.cash, fx)) + '</b></span>' +
      '</div></div>' +

      '<div class="trade-layout">' +
      '<div class="card pad">' +
      '<div class="side">' +
      '<button type="button" class="buy' + (ticketState.side === "BUY" ? " on" : "") + '" id="tk-buy">Buy / Long</button>' +
      '<button type="button" class="sell' + (ticketState.side === "SELL" ? " on" : "") + '" id="tk-sell" title="Sell closes long. Short N/A for paper cash.">Sell</button>' +
      '</div>' +
      '<div class="banner warn-banner" style="margin-bottom:10px"><b>FX / UK100 CFD paper</b> — Buy opens long · Sell closes · Sync to OANDA practice gated (60 sessions). Live fxtrade never called.</div>' +

      '<div class="mode-row">' +
      '<select id="tk-type" title="Order type">' + types + '</select>' +
      '<div class="seg" id="tk-cash-seg"><button type="button" class="on" disabled>Cash</button><button type="button" disabled title="N/A paper cash">N/A</button></div>' +
      '<select id="tk-tif" title="TIF">' + tifs + '</select>' +
      '</div>' +

      '<label class="field">Symbol<input class="desk-input" id="tk-symbol" value="' + esc(ticketState.symbol) + '" autocomplete="off" /></label>' +

      (showLimit ? '<label class="field"><span>Limit price</span><input class="desk-input" id="tk-limit" value="' + esc(ticketState.limitPrice) + '" inputmode="decimal" /></label>' : "") +
      (showStop ? '<label class="field"><span>Stop price</span><input class="desk-input" id="tk-stop" value="' + esc(ticketState.stopPrice) + '" inputmode="decimal" /></label>' : "") +

      '<label class="field"><span>Size <span class="size-toggle">' +
      '<button type="button" class="' + (ticketState.riskBased ? "on" : "") + '" id="tk-unit-risk" data-u="risk">Risk</button>' +
      '<button type="button" class="' + (!ticketState.riskBased ? "on" : "") + '" id="tk-unit-qty" data-u="qty">Qty</button>' +
      '</span></span>' +
      '<input class="desk-input" id="tk-qty" type="number" min="0" step="1" inputmode="numeric" value="' + ticketState.qty + '"' + (ticketState.riskBased ? " disabled" : "") + " /></label>" +
      '<div class="slider-wrap">' +
      '<input id="tk-pct" type="range" min="0" max="100" step="5" value="' + ticketState.sizePct + '"' + (!ticketState.riskBased ? " disabled" : "") + " />" +
      '<div class="pct-row"><span>0%</span><span id="tk-pct-label">' + ticketState.sizePct + '%</span><span>100%</span></div>' +
      '</div>' +
      '<div class="sub" style="margin:-4px 0 8px">Risk size @ ' + settings.riskPctPerIdea + '% / ' + settings.stopPct + '% stop · full = ' + riskQty + ' sh</div>' +

      '<label class="check-row"><input type="checkbox" id="tk-reduce"' + (ticketState.reduceOnly ? " checked" : "") + ' /> Reduce only</label>' +
      '<label class="check-row"><input type="checkbox" id="tk-tpsl"' + (ticketState.tpsl ? " checked" : "") + ' /> Take profit / Stop loss</label>' +
      '<div class="tpsl-fields' + (ticketState.tpsl ? "" : " hidden") + '" id="tk-tpsl-wrap">' +
      '<label class="field"><span>TP price</span><input class="desk-input" id="tk-tp" value="' + esc(ticketState.tpPrice) + '" inputmode="decimal" placeholder="TP" /></label>' +
      '<label class="field"><span>SL price</span><input class="desk-input" id="tk-sl" value="' + esc(ticketState.slPrice) + '" inputmode="decimal" placeholder="SL (' + settings.stopPct + '%)" /></label>' +
      '</div>' +

      '<div class="est-grid">' +
      '<div class="e"><div class="k">Order value</div><div class="v">' + esc(dual(notional, fx)) + '</div></div>' +
      '<div class="e"><div class="k">Slippage</div><div class="v">~' + settings.slippageBps + ' bps (±' + estSlip.toFixed(2) + ')</div></div>' +
      '<div class="e"><div class="k">vs Pivot</div><div class="v">' +
      (pivot != null ? esc(pivot.toFixed(2)) + ' <span class="' + (vsPivot != null && vsPivot > 0 ? "pos" : "neg") + '">(' + (vsPivot != null ? esc(pct(vsPivot)) : "—") + ")</span>" : "—") +
      '</div></div>' +
      '<div class="e"><div class="k">Buying power</div><div class="v">' + esc(dual(account.buyingPower, fx)) + '</div></div>' +
      '</div>' +

      '<button type="button" class="btn live' + (ticketState.side === "SELL" ? " sell-mode" : "") + '" id="tk-submit"' + (!canSubmit || ticketState.busy ? " disabled" : "") + ">" +
      (ticketState.busy ? "Sending…" : "Place paper order") + "</button>" +
      '<button type="button" class="btn secondary" id="tk-keep-paper">Keep paper</button>' +
      '<button type="button" class="btn secondary" id="tk-refresh-quotes" style="margin-top:6px">Refresh quotes</button>' +
      '<button type="button" class="btn secondary" id="tk-sync-oanda" style="margin-top:6px">Sync to OANDA practice (stub)</button>' +
      '<div class="halt-cap"><b>live locked</b> · ' + esc(bits.liveLabel) + ' · PLACE PAPER ORDER only · never fxtrade</div>' +
      (ticketState.msg ? '<div class="msg ' + (okMsg ? "ok" : "err") + '" style="margin-top:8px">' + esc(ticketState.msg) + "</div>" : "") +
      '<div class="sub" style="margin-top:8px" id="tr-msg">Attached stop (' + settings.stopPct + '%) + trail on filled BUY · Outside FX hours market queues for next open · Quotes: tradingview proxy → OANDA practice → seed · Not financial advice</div>' +
      '</div>' +

      '<div class="card pad">' +
      '<div class="sec" style="margin-top:0">Estimate / gate</div>' +
      '<div class="bal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<div class="bal" style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px"><div class="k" style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)">Last</div><div class="v num" style="font-size:14px;margin-top:4px;font-weight:600">' + esc(fmtPx(last, ticketState.symbol)) + '</div></div>' +
      '<div class="bal" style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px"><div class="k" style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)">Equity</div><div class="v num" style="font-size:14px;margin-top:4px;font-weight:600">' + esc(dual(account.equity, fx)) + '</div></div>' +
      '</div>' +
      (vsPivot != null && vsPivot > settings.maxChasePct ? '<div class="banner warn-banner" style="margin-top:10px"><b>Above chase limit</b> — order will reject (&gt;' + settings.maxChasePct + '% over pivot)</div>' : "") +
      '<p class="sub" style="margin-top:12px">Paper engine · £800 start · GBP only · quotes tradingview|practice|seed · 60-session live lock · localStorage</p>' +
      '</div></div></div>'
    );
  }

  function viewPositions() {
    var settings = getSettings();
    var fx = settings.fxGbpUsd;
    var account = getAccount();
    var positions = getPositions().map(function (p) {
      var upl = (p.last - p.avgPrice) * p.qty;
      var r = p.entryRiskGbp > 0 ? upl / p.entryRiskGbp : null;
      return Object.assign({}, p, { upl: upl, rMultiple: r });
    });
    var working = getWorkingOrders();
    var fills = book.fills.slice(0, 30);

    var posBody;
    if (!positions.length) {
      posBody = '<p class="empty">Flat. <a href="#/ticket?symbol=GBP_USD">Paper-buy GBP_USD</a></p>';
    } else {
      posBody = '<div class="desk-scroll"><table class="desk-table min-w-720"><thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th><th>Stop</th><th>Trail</th><th>UPL</th><th>R</th><th></th></tr></thead><tbody>' +
        positions.map(function (p) {
          return "<tr><td class=\"bright\">" + esc(p.symbol) + "</td><td>" + p.qty + "</td><td>" + p.avgPrice.toFixed(2) + "</td><td>" + p.last.toFixed(2) + "</td><td>" + (p.stopPrice != null ? p.stopPrice.toFixed(2) : "\u2014") + '</td><td class="muted" style="font-size:12px">' + esc(p.trailKind || "\u2014") + '</td><td class="' + (p.upl >= 0 ? "pos" : "neg") + '">' + esc(dual(p.upl, fx)) + "</td><td>" + (p.rMultiple != null ? p.rMultiple.toFixed(2) : "\u2014") + '</td><td><a href="#/charts?symbol=' + encodeURIComponent(p.symbol) + '">Chart</a></td></tr>';
        }).join("") + "</tbody></table></div>";
    }

    var wrkBody;
    if (!working.length) wrkBody = '<p class="empty">No working orders</p>';
    else wrkBody = '<div class="desk-scroll"><table class="desk-table min-w-800"><thead><tr><th>ID</th><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Filled</th><th>Limit</th><th>Stop</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>' +
      working.map(function (o) {
        return "<tr><td>" + o.id + "</td><td>" + esc(o.symbol) + '</td><td class="' + (o.side === "BUY" ? "pos" : "neg") + '">' + o.side + "</td><td>" + o.type + "</td><td>" + o.qty + "</td><td>" + o.filledQty + "</td><td>" + (o.limitPrice != null ? o.limitPrice : "\u2014") + "</td><td>" + (o.stopPrice != null ? Number(o.stopPrice).toFixed(2) : "\u2014") + '</td><td style="font-size:12px">' + esc(o.role || "\u2014") + "</td><td>" + o.status + '</td><td><button type="button" class="desk-btn" style="font-size:12px" data-cancel="' + o.id + '">Cancel</button></td></tr>';
      }).join("") + "</tbody></table></div>";

    var fillRows = fills.map(function (f) {
      return "<tr><td class=\"muted\" style=\"font-size:12px\">" + esc(new Date(f.createdAt).toLocaleString()) + "</td><td>" + esc(f.symbol) + '</td><td class="' + (f.side === "BUY" ? "pos" : "neg") + '">' + f.side + "</td><td>" + f.qty + "</td><td>" + f.price.toFixed(2) + "</td></tr>";
    }).join("");
    if (!fills.length) fillRows = '<tr><td colspan="5" class="muted">No fills yet</td></tr>';

    return (
      '<div class="space-y"><div class="flex-end"><div><h1 class="page-title">Positions / Orders</h1><p class="page-sub">Blotter \u00B7 fills \u00B7 child stops &amp; trails</p></div>' +
      '<div class="mono" style="font-size:0.875rem"><div>Equity <span class="bright">' + esc(dual(account.equity, fx)) + '</span></div><div>Day <span class="' + (account.dayPnl >= 0 ? "pos" : "neg") + '">' + esc(dual(account.dayPnl, fx)) + "</span></div></div></div>" +
      '<div class="desk-panel" style="overflow:hidden"><div class="panel-head"><h2>Open positions</h2></div>' + posBody + "</div>" +
      '<div class="desk-panel" style="overflow:hidden"><div class="panel-head"><h2>Working orders</h2></div>' + wrkBody + "</div>" +
      '<div class="desk-panel" style="overflow:hidden"><div class="panel-head"><h2>Recent fills</h2></div>' +
      '<div class="desk-scroll"><table class="desk-table min-w-480"><thead><tr><th>Time</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th></tr></thead><tbody>' + fillRows + "</tbody></table></div></div></div>"
    );
  }

  function viewCharts() {
    var route = parseRoute();
    if (route.params.symbol) chartSymbol = String(route.params.symbol).toUpperCase();
    var quote = getQuote(chartSymbol);
    var chips = ["GBP_USD", "EUR_GBP", "UK100_GBP", "XAU_GBP", "EUR_USD"].map(function (s) {
      return '<button type="button" class="desk-btn" style="font-size:12px" data-chip="' + s + '">' + s + "</button>";
    }).join("");
    return (
      '<div class="space-y"><div class="flex-end" style="align-items:flex-end;justify-content:flex-start;gap:12px">' +
      '<div><h1 class="page-title">Charts</h1><p class="page-sub">Daily candles \u00B7 seed marks \u00B7 50-EMA overlay</p></div>' +
      '<input class="desk-input" id="ch-symbol" value="' + esc(chartSymbol) + '" aria-label="Symbol" style="max-width:12rem" />' +
      '<div class="mono" style="font-size:0.875rem"><span class="bright">' + quote.last.toFixed(2) + '</span> <span class="' + (quote.changePct >= 0 ? "pos" : "neg") + '">' + esc(pct(quote.changePct)) + '</span> <span class="muted" style="font-size:12px">(' + esc(quote.source) + ")</span></div></div>" +
      '<div class="desk-panel pad-sm"><canvas class="chart" id="candle" style="height:min(42vh,420px);min-height:260px"></canvas></div>' +
      '<div class="tag-row">' + chips + "</div></div>"
    );
  }

  function viewPlaybook() {
    var s = getSettings();
    var regimes = book.regimes;
    function numField(id, label, val, step) {
      return '<label class="field">' + esc(label) + '<input class="desk-input" id="' + id + '" type="number"' + (step ? ' step="' + step + '"' : "") + ' value="' + val + '" /></label>';
    }
    return (
      '<div class="space-y"><div><h1 class="page-title">Playbook / Settings</h1><p class="page-sub">Editable &amp; persisted in localStorage \u00B7 changing settings snapshots a regime \u00B7 Not financial advice</p></div>' +
      (playMsg ? '<div class="msg ok">' + esc(playMsg) + "</div>" : "") +
      '<div class="play-grid">' +
      '<div class="desk-panel pad" style="display:flex;flex-direction:column;gap:12px"><h2>Entry / universe</h2>' +
      '<label class="field">Universe<select class="desk-input" id="pb-universe">' +
      [["BlueSky", "Blue sky"], ["VCP\u2229BlueSky", "VCP\u2229Blue sky"], ["Both", "Both"]].map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (s.universe === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field">Entry mode<select class="desk-input" id="pb-entry">' +
      [["FreshBreakout", "Fresh breakout close"], ["FormingThenBreakout", "Forming \u22642% then wait for BO close"], ["Both", "Both"]].map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (s.entryMode === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>";
      }).join("") + "</select></label>" +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + numField("pb-chase", "Max chase %", s.maxChasePct) + numField("pb-rs", "Prefer RS \u2265", s.preferRsMin) + "</div></div>" +
      '<div class="desk-panel pad" style="display:flex;flex-direction:column;gap:12px"><h2>Risk / size</h2>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      numField("pb-risk", "Risk % / idea", s.riskPctPerIdea, "0.1") + numField("pb-stop", "Stop %", s.stopPct, "0.1") +
      numField("pb-maxopen", "Max open", s.maxOpenPositions) + numField("pb-maxnew", "Max new / session", s.maxNewPerSession) + "</div>" +
      '<label class="field">Trail<select class="desk-input" id="pb-trail">' +
      '<option value="EMA50"' + (s.trail === "EMA50" ? " selected" : "") + ">Daily close below 50-EMA</option>" +
      '<option value="SMA50"' + (s.trail === "SMA50" ? " selected" : "") + ">Daily close below 50-SMA</option></select></label>" +
      '<label class="check"><input type="checkbox" id="pb-avg"' + (s.noAveragingDown ? " checked" : "") + " /> No averaging down</label></div>" +
      '<div class="desk-panel pad" style="display:flex;flex-direction:column;gap:12px"><h2>Banana / FX / session</h2>' +
      numField("pb-fx", "Optional GBPUSD note (display only)", s.fxGbpUsd, "0.01") + numField("pb-slip", "Slippage bps (market)", s.slippageBps) +
      '<label class="check"><input type="checkbox" id="pb-queue"' + (s.queueMarketOutsideHours ? " checked" : "") + " /> Queue market orders outside FX hours</label>" +
      '<label class="check"><input type="checkbox" id="pb-sim"' + (s.simSession ? " checked" : "") + " /> SIM session (weekend / demo labelled SIM)</label></div>" +
            '<div class="desk-panel pad" style="display:flex;flex-direction:column;gap:12px"><h2>Quotes (tradingview → practice → seed)</h2>' +
      (function () {
        var chip = quoteSourceChip();
        var p = loadQuoteProxy();
        var c = loadOandaCreds();
        var tone = chip === "tradingview" || chip === "practice" ? "ok" : (p.status === "error" || c.status === "error" ? "err" : "");
        var extra = p.lastError || c.lastError || "";
        return '<div class="msg ' + tone + '" id="quote-status" style="margin:0">Status: <b>' + esc(chip) + '</b>' +
          (extra ? " — " + esc(extra) : "") + "</div>";
      })() +
      '<p class="muted" style="font-size:12px;margin:0">Local <code>tv-quote-proxy.mjs</code> (<code>npm i && npm run quotes</code>) uses unofficial <code>@mathieuc/tradingview</code>. Not affiliated with TradingView — personal use, respect their ToS. Phone / GitHub Pages cannot reach localhost; set the URL only for a PC serving the PWA locally. No secrets committed.</p>' +
      '<label class="field">Quote proxy URL<input class="desk-input" id="pb-quote-proxy" type="url" autocomplete="off" placeholder="http://127.0.0.1:8791" value="' + esc(loadQuoteProxy().url || DEFAULT_QUOTE_PROXY) + '" /></label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
      '<button type="button" class="desk-btn-primary" id="pb-quote-save" style="font-size:12px">Save proxy URL</button>' +
      '<button type="button" class="desk-btn" id="pb-quote-test" style="font-size:12px">Test quotes</button>' +
      '</div></div>' +
            '<div class="desk-panel pad" style="display:flex;flex-direction:column;gap:12px"><h2>OANDA practice (pricing)</h2>' +
      '<p class="muted" style="font-size:12px;margin:0">Token + account ID stay in <code>localStorage</code> only (never committed). Host is <code>api-fxpractice.oanda.com</code> only — live <code>fxtrade</code> is never called. GitHub Pages cannot reach OANDA (CORS) — quotes stay seed there unless the TV proxy is running on this machine. Local <code>oanda-proxy.mjs</code> remains the practice fallback path.</p>' +
      (function () {
        var c = loadOandaCreds();
        var st = c.status || "disconnected";
        var tone = st === "practice" ? "ok" : (st === "error" ? "err" : "");
        return '<div class="msg ' + tone + '" id="oanda-status" style="margin:0">OANDA: <b>' + esc(st) + '</b>' +
          (c.lastError ? " — " + esc(c.lastError) : "") +
          (c.accountId ? " · account …" + esc(String(c.accountId).slice(-4)) : " · no account") + "</div>";
      })() +
      '<label class="field">Practice API token<input class="desk-input" id="pb-oanda-token" type="password" autocomplete="off" placeholder="OANDA practice token" value="" /></label>' +
      '<label class="field">Practice account ID<input class="desk-input" id="pb-oanda-account" type="text" autocomplete="off" placeholder="001-…" value="' + esc(loadOandaCreds().accountId || "") + '" /></label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
      '<button type="button" class="desk-btn-primary" id="pb-oanda-save" style="font-size:12px">Save practice creds</button>' +
      '<button type="button" class="desk-btn" id="pb-oanda-test" style="font-size:12px">Test practice pricing</button>' +
      '<button type="button" class="desk-btn" id="pb-oanda-clear" style="font-size:12px">Clear creds</button>' +
      '</div></div>' +

      '<div class="desk-panel pad" style="display:flex;flex-direction:column;gap:12px"><h2>Live gate (go / no-go)</h2>' +
      '<p class="muted" style="font-size:12px;margin:0">Live stays hard-locked until ' + s.liveGateSessionsRequired + " paper trading sessions are recorded <em>and</em> the checklist below is ticked. Live itself is a stub \u2014 connect a broker after paper confirmation.</p>" +
      '<label class="check"><input type="checkbox" id="pb-ck1"' + (s.checklistReviewedScorecard ? " checked" : "") + " /> Reviewed scorecard</label>" +
      '<label class="check"><input type="checkbox" id="pb-ck2"' + (s.checklistMaxDdAcceptable ? " checked" : "") + " /> Max DD acceptable</label>" +
      '<label class="check"><input type="checkbox" id="pb-ck3"' + (s.checklistExpectancyRecorded ? " checked" : "") + " /> Expectancy recorded</label>" +
      '<button type="button" class="desk-btn" id="pb-reset">Reset paper book to seed</button></div></div>' +
      '<div class="desk-panel" style="overflow:hidden"><div class="panel-head"><h2>Regime snapshots</h2></div>' +
      '<div class="desk-scroll"><table class="desk-table min-w-420"><thead><tr><th>ID</th><th>When</th><th>Note</th></tr></thead><tbody>' +
      regimes.map(function (r) {
        return "<tr><td>" + r.id + '</td><td class="muted" style="font-size:12px">' + esc(new Date(r.createdAt).toLocaleString()) + "</td><td>" + esc(r.note) + "</td></tr>";
      }).join("") + "</tbody></table></div></div></div>"
    );
  }

  function viewScorecard() {
    var scorecard = getScorecard();
    var fx = getSettings().fxGbpUsd;
    var sessions = book.sessions.slice().sort(function (a, b) { return a.sessionDate < b.sessionDate ? 1 : -1; });
    var left = Math.max(0, scorecard.sessionsRequired - scorecard.sessionsLogged);
    var account = getAccount();
    var moneyKpis = [
      { l: "Equity", v: account.equity, colored: false },
      { l: "Day P&L", v: account.dayPnl, colored: true },
      { l: "Total P&L", v: account.totalPnl, colored: true },
      { l: "Cash", v: account.cash, colored: false },
    ].map(function (c) {
      return '<div class="desk-panel kpi"><div class="kpi-label">' + esc(c.l) + ' \u00B7 GBP</div><div class="kpi-val">' + moneyHtml(c.v, fx, !!c.colored) + "</div></div>";
    }).join("");
    var kpis = [
      { l: "Sessions", v: String(scorecard.sessionsLogged) },
      { l: "Cum R", v: scorecard.cumR.toFixed(2) },
      { l: "Win rate", v: scorecard.winRate.toFixed(1) + "%" },
      { l: "Expectancy", v: scorecard.expectancy.toFixed(2) + " R" },
      { l: "Max DD", v: scorecard.maxDdPct.toFixed(2) + "%" },
      { l: "Trades", v: scorecard.totalTrades + " (" + scorecard.wins + "W/" + scorecard.losses + "L)" },
    ].map(function (c) {
      return '<div class="desk-panel kpi"><div class="kpi-label">' + esc(c.l) + '</div><div class="kpi-val mono bright">' + esc(c.v) + "</div></div>";
    }).join("");
    var closed = book.closedTrades.slice().sort(function (a, b) { return a.closedAt < b.closedAt ? 1 : -1; }).slice(0, 40);
    var closedRows = closed.map(function (tr) {
      return "<tr><td>" + esc(tr.symbol) + "</td><td>" + tr.qty + "</td><td>" + Number(tr.entryAvg).toFixed(2) + "</td><td>" + Number(tr.exitAvg).toFixed(2) + '</td><td class="' + (tr.pnl >= 0 ? "pos" : "neg") + '">' + esc(dual(tr.pnl, fx)) + "</td><td>" + (tr.rMultiple != null ? Number(tr.rMultiple).toFixed(2) : "\u2014") + '</td><td class="muted" style="font-size:12px">' + esc(tr.sessionDate || "") + "</td></tr>";
    }).join("");
    if (!closed.length) closedRows = '<tr><td colspan="7" class="muted">No closed trades yet</td></tr>';
    var sessRows = sessions.map(function (s) {
      return "<tr><td>" + esc(s.sessionDate) + "</td><td>" + (s.isSim ? "SIM" : "\u2014") + "</td><td>" + s.trades + '</td><td class="' + (s.dayPnl >= 0 ? "pos" : "neg") + '">' + esc(dual(s.dayPnl, fx)) + '</td><td class="muted truncate" style="font-size:12px">' + esc(s.notes) + "</td></tr>";
    }).join("");
    if (!sessions.length) sessRows = '<tr><td colspan="5" class="muted">No sessions logged yet \u2014 use \u201cLog session\u201d after a paper day</td></tr>';
    return (
      '<div class="space-y"><div class="flex-end"><div><h1 class="page-title">P&amp;L / Scorecard</h1><p class="page-sub">GBP only \u00B7 sessions \u00B7 expectancy \u00B7 CSV</p></div>' +
      '<button type="button" class="desk-btn-primary" style="font-size:12px" id="sc-csv">Export CSV</button></div>' +
      '<div class="desk-panel pad tone-amber"><div class="amber mono" style="font-size:0.875rem">' + esc(scorecard.liveLockedReason) + '</div>' +
      '<div class="muted" style="font-size:12px;margin-top:4px">' + scorecard.sessionsLogged + "/" + scorecard.sessionsRequired + " sessions" + (!scorecard.liveUnlocked && left > 0 ? " \u00B7 " + left + " left" : "") + " \u00B7 Live is a stub: connect a broker after paper confirmation</div></div>" +
      '<div class="kpis">' + moneyKpis + kpis + "</div>" +
      '<div class="desk-panel pad"><h2 style="margin-bottom:8px">Equity curve</h2>' + equitySpark(book.equityCurve, 100) + "</div>" +
      '<div class="desk-panel pad" style="font-size:0.875rem"><h2>Reference bake-off</h2><p class="muted" style="font-size:12px;margin:4px 0 8px">' + esc(scorecard.reference.label) + '</p><div class="mono">' + scorecard.reference.cagr + "% CAGR \u00B7 " + scorecard.reference.maxDd + "% DD \u00B7 " + scorecard.reference.winRate + "% WR</div></div>" +
      '<div class="desk-panel pad" style="display:flex;flex-direction:column;gap:12px"><h2>Session journal</h2>' +
      '<textarea class="desk-input" id="sc-notes" placeholder="Notes for today\u2019s session\u2026">' + esc(scoreNotes) + "</textarea>" +
      '<button type="button" class="desk-btn-primary" id="sc-log">Log session</button>' +
      (scoreMsg ? '<div class="msg ok">' + esc(scoreMsg) + "</div>" : "") + "</div>" +
      '<div class="desk-panel" style="overflow:hidden"><div class="panel-head"><h2>Closed trades P&amp;L</h2><span class="muted" style="font-size:12px">\u00A3</span></div>' +
      '<div class="desk-scroll"><table class="desk-table min-w-720"><thead><tr><th>Symbol</th><th>Qty</th><th>Entry</th><th>Exit</th><th>P&amp;L</th><th>R</th><th>Session</th></tr></thead><tbody>' + closedRows + '</tbody></table></div></div>' +
      '<div class="desk-panel" style="overflow:hidden"><div class="panel-head"><h2>Logged sessions</h2></div>' +
      '<div class="desk-scroll"><table class="desk-table min-w-560"><thead><tr><th>Date</th><th>SIM</th><th>Trades</th><th>Day P&amp;L</th><th>Notes</th></tr></thead><tbody>' + sessRows + "</tbody></table></div></div></div>"
    );
  }

  function viewApi() {
    return (
      '<div class="space-y"><div><h1 class="page-title">API · Setups ingest</h1>' +
      '<p class="page-sub">BananaPatterns has <b>no official API</b>. Paste your own setups JSON — Banana UK never invents vendor endpoints.</p></div>' +
      '<div class="banner">Secrets never leave this device. This static PWA has no broker keys — paper blotter only. Live stays locked for ' +
      liveBits().left + ' sessions.</div>' +
      '<div class="card pad">' +
      '<div class="sec" style="margin-top:0">Manual ingest</div>' +
      '<p class="sub" style="margin:0 0 8px">Example: <code>{"asOf":"2026-09-12","setups":[{"symbol":"EXAMPLE","name":"Example Ltd","last":100.5,"changePct":1.2,"pivot":99,"rs":91,"tags":["Fresh","BlueSky"],"note":"Manual ingest"}]}</code></p>' +
      '<textarea class="desk-input" id="ingest-json" placeholder="Paste setups JSON…">' + esc(ingestText) + "</textarea>" +
      '<div style="margin-top:10px"><button type="button" class="btn live" id="ingest-btn" style="font-size:13px">Ingest setups</button></div>' +
      (ingestMsg ? '<div class="msg ' + (ingestMsg.indexOf("Invalid") === 0 ? "err" : "ok") + '" style="margin-top:8px">' + esc(ingestMsg) + "</div>" : "") +
      '</div>' +
      '<div class="card pad"><div class="sec" style="margin-top:0">Relative paths · GitHub Pages</div>' +
      '<p class="sub" style="margin:0">Host as <code>KarlSmith2023/banana-uk</code> (FX/UK100 paper) (GitHub Pages) or open <code>index.html</code>. All assets use <code>./</code> relative URLs. PWA install needs HTTPS or localhost — see README Add to Home Screen.</p></div></div>'
    );
  }

  function viewJournal() {
    var scorecard = getScorecard();
    var fx = getSettings().fxGbpUsd;
    var sessions = book.sessions.slice().sort(function (a, b) { return a.sessionDate < b.sessionDate ? 1 : -1; });
    var sessRows = sessions.map(function (s) {
      return "<tr><td>" + esc(s.sessionDate) + "</td><td>" + (s.isSim ? "SIM" : "—") + "</td><td>" + s.trades + '</td><td class="' + (s.dayPnl >= 0 ? "pos" : "neg") + '">' + esc(dual(s.dayPnl, fx)) + '</td><td class="muted truncate" style="font-size:12px">' + esc(s.notes) + "</td></tr>";
    }).join("");
    if (!sessions.length) sessRows = '<tr><td colspan="5" class="muted">No sessions logged yet — log after a paper day</td></tr>';
    return (
      '<div class="space-y"><div><h1 class="page-title">Journal</h1>' +
      '<p class="page-sub">Session log · feeds the 60-session live gate · ' + scorecard.sessionsLogged + "/" + scorecard.sessionsRequired + '</p></div>' +
      '<div class="card pad" style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="sec" style="margin-top:0">Log session</div>' +
      '<textarea class="desk-input" id="sc-notes" placeholder="Notes for today’s session…">' + esc(scoreNotes) + "</textarea>" +
      '<button type="button" class="btn live" id="sc-log" style="font-size:13px">Log session</button>' +
      (scoreMsg ? '<div class="msg ok">' + esc(scoreMsg) + "</div>" : "") +
      '</div>' +
      '<div class="card" style="overflow:hidden"><div class="panel-head"><h2>Logged sessions</h2><a href="#/scorecard" style="font-size:12px">Brief →</a></div>' +
      '<div class="desk-scroll"><table class="desk-table min-w-560"><thead><tr><th>Date</th><th>SIM</th><th>Trades</th><th>Day P&amp;L</th><th>Notes</th></tr></thead><tbody>' + sessRows + "</tbody></table></div></div></div>"
    );
  }

  function exportCsv() {
    var score = getScorecard();
    var fx = getSettings().fxGbpUsd;
    var lines = ["# Banana UK scorecard", "sessions," + score.sessionsLogged, "cumR," + score.cumR, "winRate," + score.winRate, "expectancy," + score.expectancy, "maxDdPct," + score.maxDdPct, "trades," + score.totalTrades, "wins," + score.wins, "losses," + score.losses, "", "session_date,is_sim,trades,day_pnl_gbp,day_pnl_usd_note,notes"];
    book.sessions.forEach(function (s) {
      lines.push([s.sessionDate, s.isSim ? 1 : 0, s.trades, s.dayPnl, (s.dayPnl * fx).toFixed(2), '"' + String(s.notes || "").replace(/"/g, '""') + '"'].join(","));
    });
    lines.push("", "symbol,qty,entry_avg,exit_avg,pnl,r_multiple,opened_at,closed_at,session_date");
    book.closedTrades.forEach(function (t) {
      lines.push([t.symbol, t.qty, t.entryAvg, t.exitAvg, t.pnl, t.rMultiple, t.openedAt, t.closedAt, t.sessionDate].join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "banana-uk-scorecard.csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  }

  function bindPlaybook() {
    function num(id) { return Number(document.getElementById(id).value); }
    function chk(id) { return document.getElementById(id).checked; }
    function onSave(sel, ev, patchFn, note) {
      var el = document.getElementById(sel);
      if (!el) return;
      el.addEventListener(ev, function () {
        saveSettings(patchFn(), note);
        playMsg = "Saved \u2014 regime snapshot recorded";
        render();
      });
    }
    onSave("pb-universe", "change", function () { return { universe: document.getElementById("pb-universe").value }; }, "Universe change");
    onSave("pb-entry", "change", function () { return { entryMode: document.getElementById("pb-entry").value }; }, "Entry mode change");
    onSave("pb-trail", "change", function () { return { trail: document.getElementById("pb-trail").value }; }, "Trail change");
    ["pb-chase", "pb-rs", "pb-risk", "pb-stop", "pb-maxopen", "pb-maxnew", "pb-fx", "pb-slip"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("blur", function () {
        var map = {
          "pb-chase": ["maxChasePct", "Chase %"],
          "pb-rs": ["preferRsMin", "RS min"],
          "pb-risk": ["riskPctPerIdea", "Risk %"],
          "pb-stop": ["stopPct", "Stop %"],
          "pb-maxopen": ["maxOpenPositions", "Max open"],
          "pb-maxnew": ["maxNewPerSession", "Max new/session"],
          "pb-fx": ["fxGbpUsd", "USD note FX"],
          "pb-slip": ["slippageBps", "Slippage"],
        };
        var m = map[id];
        var o = {};
        o[m[0]] = num(id);
        saveSettings(o, m[1]);
        playMsg = "Saved \u2014 regime snapshot recorded";
        render();
      });
    });
    onSave("pb-avg", "change", function () { return { noAveragingDown: chk("pb-avg") }; }, "Averaging rule");
    onSave("pb-queue", "change", function () { return { queueMarketOutsideHours: chk("pb-queue") }; }, "Queue outside hours");
    onSave("pb-sim", "change", function () { return { simSession: chk("pb-sim") }; }, "SIM session toggle");
    onSave("pb-ck1", "change", function () { return { checklistReviewedScorecard: chk("pb-ck1") }; }, "Checklist scorecard");
    onSave("pb-ck2", "change", function () { return { checklistMaxDdAcceptable: chk("pb-ck2") }; }, "Checklist max DD");
    onSave("pb-ck3", "change", function () { return { checklistExpectancyRecorded: chk("pb-ck3") }; }, "Checklist expectancy");

    var qSave = document.getElementById("pb-quote-save");
    if (qSave) qSave.addEventListener("click", function () {
      var url = ((document.getElementById("pb-quote-proxy") || {}).value || "").trim();
      saveQuoteProxy({ url: url || DEFAULT_QUOTE_PROXY, lastError: "" });
      playMsg = "Quote proxy URL saved in localStorage (not committed)";
      render();
    });
    var qTest = document.getElementById("pb-quote-test");
    if (qTest) qTest.addEventListener("click", function () {
      var url = ((document.getElementById("pb-quote-proxy") || {}).value || "").trim();
      if (url) saveQuoteProxy({ url: url });
      playMsg = "Testing quotes (tradingview → practice → seed)…";
      render();
      refreshQuotes(null, function (n, mode) {
        playMsg = mode === "tradingview"
          ? ("TradingView proxy OK — updated " + n + " instrument(s)")
          : (mode === "practice"
            ? ("Practice pricing OK — updated " + n + " instrument(s)")
            : (mode === "seed"
              ? "No proxy / practice — using seed marks"
              : "Quote refresh failed — still on seed marks"));
        render();
      });
    });

    var oSave = document.getElementById("pb-oanda-save");
    if (oSave) oSave.addEventListener("click", function () {
      var tok = (document.getElementById("pb-oanda-token") || {}).value || "";
      var acc = (document.getElementById("pb-oanda-account") || {}).value || "";
      saveOandaCreds({ token: tok.trim(), accountId: acc.trim(), status: tok && acc ? "saved" : "disconnected", lastError: "" });
      playMsg = "OANDA practice creds saved in localStorage (not committed)";
      render();
    });
    var oTest = document.getElementById("pb-oanda-test");
    if (oTest) oTest.addEventListener("click", function () {
      playMsg = "Testing OANDA practice pricing…";
      render();
      refreshQuotes(null, function (n, mode) {
        playMsg = mode === "tradingview"
          ? ("TradingView proxy OK — updated " + n + " instrument(s)")
          : (mode === "practice"
            ? ("Practice pricing OK — updated " + n + " instrument(s)")
            : (mode === "seed"
              ? "No proxy / practice token — using seed marks"
              : "Quote refresh failed — see status (still on seed marks)"));
        render();
      });
    });
    var oClr = document.getElementById("pb-oanda-clear");
    if (oClr) oClr.addEventListener("click", function () {
      clearOandaCreds();
      playMsg = "OANDA practice creds cleared";
      render();
    });

    var rst = document.getElementById("pb-reset");
    if (rst) rst.addEventListener("click", function () {
      if (!confirm("Reset paper book to seed (\u00A3800 GBP, 11 Sep 2026 FX/UK100 setups)? This clears positions, orders, and sessions.")) return;
      resetBook();
      playMsg = "Paper book reset to seed";
      render();
    });
  }

  function bindTicket() {
    var sym = document.getElementById("tk-symbol");
    if (sym) {
      sym.addEventListener("input", function () { ticketState.symbol = normalizeInstrument(sym.value); });
      sym.addEventListener("blur", function () { ticketState.symbol = normalizeInstrument(sym.value); go("ticket", { symbol: ticketState.symbol }); });
    }
    var buy = document.getElementById("tk-buy");
    var sell = document.getElementById("tk-sell");
    if (buy) buy.addEventListener("click", function () { ticketState.side = "BUY"; render(); });
    if (sell) sell.addEventListener("click", function () { ticketState.side = "SELL"; render(); });
    var type = document.getElementById("tk-type");
    if (type) type.addEventListener("change", function () { ticketState.type = type.value; render(); });
    var tif = document.getElementById("tk-tif");
    if (tif) tif.addEventListener("change", function () { ticketState.tif = tif.value; });
    var riskBtn = document.getElementById("tk-unit-risk");
    var qtyBtn = document.getElementById("tk-unit-qty");
    if (riskBtn) riskBtn.addEventListener("click", function () { ticketState.riskBased = true; render(); });
    if (qtyBtn) qtyBtn.addEventListener("click", function () { ticketState.riskBased = false; render(); });
    var qty = document.getElementById("tk-qty");
    if (qty) qty.addEventListener("input", function () { ticketState.qty = Number(qty.value); });
    var pct = document.getElementById("tk-pct");
    if (pct) {
      pct.addEventListener("input", function () {
        ticketState.sizePct = Number(pct.value);
        var lab = document.getElementById("tk-pct-label");
        if (lab) lab.textContent = ticketState.sizePct + "%";
      });
      pct.addEventListener("change", function () { ticketState.sizePct = Number(pct.value); render(); });
    }
    var lim = document.getElementById("tk-limit");
    if (lim) lim.addEventListener("input", function () { ticketState.limitPrice = lim.value; });
    var stp = document.getElementById("tk-stop");
    if (stp) stp.addEventListener("input", function () { ticketState.stopPrice = stp.value; });
    var red = document.getElementById("tk-reduce");
    if (red) red.addEventListener("change", function () { ticketState.reduceOnly = red.checked; });
    var tpsl = document.getElementById("tk-tpsl");
    if (tpsl) tpsl.addEventListener("change", function () { ticketState.tpsl = tpsl.checked; render(); });
    var tp = document.getElementById("tk-tp");
    if (tp) tp.addEventListener("input", function () { ticketState.tpPrice = tp.value; });
    var sl = document.getElementById("tk-sl");
    if (sl) sl.addEventListener("input", function () { ticketState.slPrice = sl.value; });
    function submitPaper() {
      ticketState.busy = true;
      ticketState.msg = "";
      var attachStop = ticketState.side === "BUY" && !ticketState.reduceOnly;
      var stopPx = ticketState.stopPrice ? Number(ticketState.stopPrice) : null;
      if (ticketState.tpsl && ticketState.slPrice) stopPx = Number(ticketState.slPrice);
      var res = placeOrder({
        symbol: ticketState.symbol,
        side: ticketState.side,
        type: ticketState.type,
        tif: ticketState.tif,
        qty: ticketState.riskBased ? ticketState.qty : ticketState.qty,
        riskBased: false,
        limitPrice: ticketState.limitPrice ? Number(ticketState.limitPrice) : null,
        stopPrice: stopPx,
        attachStop: attachStop,
      });
      ticketState.busy = false;
      if (!res.ok) ticketState.msg = res.error || "Rejected";
      else ticketState.msg = "Order #" + res.order.id + " " + res.order.status + (res.order.avgFillPrice ? " @ " + res.order.avgFillPrice.toFixed(2) : "");
      render();
    }
    var sub = document.getElementById("tk-submit");
    if (sub) sub.addEventListener("click", submitPaper);
    var keep = document.getElementById("tk-keep-paper");
    if (keep) keep.addEventListener("click", function () {
      ticketState.msg = "Keeping paper · live stays locked · " + liveBits().liveLabel;
      render();
    });

    var refq = document.getElementById("tk-refresh-quotes");
    if (refq) refq.addEventListener("click", function () {
      ticketState.msg = "Refreshing quotes (tradingview → practice → seed)…";
      render();
      refreshQuotes(null, function (n, mode) {
        ticketState.msg = mode === "tradingview"
          ? ("Quotes updated from TradingView proxy (" + n + ")")
          : (mode === "practice"
            ? ("Quotes updated from OANDA practice (" + n + ")")
            : (mode === "seed" ? "No proxy / practice creds — seed marks" : "Quote refresh failed — seed marks"));
        render();
      });
    });
    var syn = document.getElementById("tk-sync-oanda");
    if (syn) syn.addEventListener("click", function () {
      var r = syncToOandaPracticeStub();
      ticketState.msg = r.msg;
      render();
    });

    var canvas = document.getElementById("tr-spark");
    if (canvas) {
      var bars = book.bars[ticketState.symbol] || barsFromCloses(ticketState.symbol, getQuote(ticketState.symbol).last);
      book.bars[ticketState.symbol] = bars;
      drawCandles(canvas, bars.slice(-40));
    }
  }

  function computeNextMove() {
    var settings = getSettings();
    var actionables = actionableSetups(settings);
    var bits = liveBits();
    if (!actionables.length) {
      return {
        action: "WAIT",
        title: "Next move",
        body: "No actionable Fresh/Forming names inside chase + RS gates.\n\nKeep paper. Reassess scanner after next session.\nDo-not-chase examples (EUR_JPY / XAU_USD) stay blocked.",
        meta: "intent PAPER · live " + bits.liveLabel + " · names " + book.setups.length,
      };
    }
    var top = actionables.slice().sort(function (a, b) {
      var va = a.pivot != null ? Math.abs(((a.last - a.pivot) / a.pivot) * 100) : 99;
      var vb = b.pivot != null ? Math.abs(((b.last - b.pivot) / b.pivot) * 100) : 99;
      return va - vb;
    })[0];
    var vs = top.pivot != null ? ((top.last - top.pivot) / top.pivot) * 100 : null;
    var ready = (top.tags || []).indexOf("Fresh") >= 0 && vs != null && vs <= settings.maxChasePct;
    return {
      action: ready ? "READY" : "WAIT",
      title: "Next move · " + top.symbol,
      body: (ready ? "Paper BUY candidate: " : "Watch / wait: ") + top.symbol +
        " @ " + top.last.toFixed(2) +
        (top.pivot != null ? " · pivot " + top.pivot.toFixed(2) + " (" + pct(vs) + ")" : "") +
        " · RS " + (top.rs != null ? top.rs : "—") +
        "\n\n" + (top.note || "") +
        "\n\nSize with risk " + settings.riskPctPerIdea + "% / stop " + settings.stopPct +
        "%. Open Trade → Place paper order. Live remains locked.",
      meta: "actionable " + actionables.length + " · " + bits.liveLabel,
      symbol: top.symbol,
    };
  }

  function openNextMove() {
    var nm = computeNextMove();
    var modal = document.getElementById("nm-modal");
    var action = document.getElementById("nm-action");
    var title = document.getElementById("nm-title");
    var body = document.getElementById("nm-body");
    var meta = document.getElementById("nm-meta");
    if (!modal) return;
    action.textContent = nm.action;
    action.className = "nm-action " + nm.action;
    title.textContent = nm.title;
    body.textContent = nm.body;
    meta.textContent = nm.meta || "";
    modal.classList.add("on");
    modal.setAttribute("aria-hidden", "false");
    modal._symbol = nm.symbol;
  }

  function closeNextMove() {
    var modal = document.getElementById("nm-modal");
    if (!modal) return;
    modal.classList.remove("on");
    modal.setAttribute("aria-hidden", "true");
  }

  function bindIngest() {
    var ta = document.getElementById("ingest-json");
    if (ta) ta.addEventListener("input", function () { ingestText = ta.value; });
    var ib = document.getElementById("ingest-btn");
    if (ib) ib.addEventListener("click", function () {
      try {
        var payload = JSON.parse(ingestText);
        if (Array.isArray(payload)) payload = { setups: payload };
        var n = ingestSetups(payload);
        ingestMsg = "Ingested " + n + " setup(s) — not from a BananaPatterns API";
        ingestText = "";
        render();
      } catch (e) {
        ingestMsg = "Invalid JSON: " + e.message;
        render();
      }
    });
  }

  function bindJournalControls() {
    var notes = document.getElementById("sc-notes");
    if (notes) notes.addEventListener("input", function () { scoreNotes = notes.value; });
    var log = document.getElementById("sc-log");
    if (log) log.addEventListener("click", function () {
      var r = logSession(scoreNotes);
      scoreMsg = "Session logged: " + r.sessionDate;
      scoreNotes = "";
      render();
    });
  }

  function bindPage() {
    var route = parseRoute();
    var more = document.getElementById("more-btn");
    if (more) more.addEventListener("click", function () { moreOpen = !moreOpen; renderNav(); });
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      a.addEventListener("click", function () { moreOpen = false; });
    });

    if (route.page === "ticket") bindTicket();
    if (route.page === "positions") {
      document.querySelectorAll("[data-cancel]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          cancelOrder(Number(btn.getAttribute("data-cancel")));
          render();
        });
      });
    }
    if (route.page === "charts") {
      var inp = document.getElementById("ch-symbol");
      if (inp) inp.addEventListener("change", function () {
        chartSymbol = inp.value.toUpperCase();
        go("charts", { symbol: chartSymbol });
      });
      document.querySelectorAll("[data-chip]").forEach(function (b) {
        b.addEventListener("click", function () {
          chartSymbol = b.getAttribute("data-chip");
          go("charts", { symbol: chartSymbol });
        });
      });
      var canvas = document.getElementById("candle");
      var bars = book.bars[chartSymbol] || [];
      if (!bars.length) {
        book.bars[chartSymbol] = barsFromCloses(chartSymbol, getQuote(chartSymbol).last);
        bars = book.bars[chartSymbol];
      }
      drawCandles(canvas, bars);
    }
    if (route.page === "playbook") bindPlaybook();
    if (route.page === "scorecard") {
      bindJournalControls();
      var csv = document.getElementById("sc-csv");
      if (csv) csv.addEventListener("click", exportCsv);
    }
    if (route.page === "journal") bindJournalControls();
    if (route.page === "scanner" || route.page === "api") bindIngest();
  }

  function render() {
    renderNav();
    var route = parseRoute();
    var views = {
      overview: viewOverview,
      scanner: viewScanner,
      ticket: viewTicket,
      positions: viewPositions,
      charts: viewCharts,
      playbook: viewPlaybook,
      scorecard: viewScorecard,
      api: viewApi,
      journal: viewJournal,
    };
    document.getElementById("view").innerHTML = (views[route.page] || viewOverview)();
    bindPage();
  }

  function registerSW() {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (location.protocol === "file:") return;
    var register = function () {
      navigator.serviceWorker.register("./sw.js").catch(function (err) {
        console.warn("Banana SW registration failed", err);
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }

  loadBook();

  /* Optional env/local inject — never commit oanda-local.js */
  try {
    if (typeof window !== "undefined" && window.__OANDA_PRACTICE__ && window.__OANDA_PRACTICE__.token) {
      saveOandaCreds({
        token: String(window.__OANDA_PRACTICE__.token || ""),
        accountId: String(window.__OANDA_PRACTICE__.accountId || ""),
        status: "saved",
        lastError: "",
      });
    }
  } catch (e) {}

  if (typeof window !== "undefined") {
    window.__desk = {
      placeOrder: placeOrder,
      getAccount: getAccount,
      getPositions: getPositions,
      getWorkingOrders: getWorkingOrders,
      getScorecard: getScorecard,
      logSession: logSession,
      getSettings: getSettings,
      cancelOrder: cancelOrder,
      resetBook: resetBook,
      computeSize: computeSize,
      getQuote: getQuote,
      ingestSetups: ingestSetups,
      saveSettings: saveSettings,
      refreshOandaPracticeQuotes: refreshOandaPracticeQuotes,
      refreshQuotes: refreshQuotes,
      refreshTradingViewQuotes: refreshTradingViewQuotes,
      loadOandaCreds: loadOandaCreds,
      loadQuoteProxy: loadQuoteProxy,
      quoteSourceChip: quoteSourceChip,
      syncToOandaPracticeStub: syncToOandaPracticeStub,
      getBook: function () { return book; },
    };
  }

  var hasDom = typeof document !== "undefined" && document.getElementById && document.getElementById("view");
  if (hasDom) {
    var btnNext = document.getElementById("btn-next-move");
    if (btnNext) btnNext.addEventListener("click", openNextMove);
    var nmClose = document.getElementById("nm-close");
    if (nmClose) nmClose.addEventListener("click", closeNextMove);
    var nmModal = document.getElementById("nm-modal");
    if (nmModal) nmModal.addEventListener("click", function (e) {
      if (e.target === nmModal) closeNextMove();
    });

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      var banner = document.getElementById("install-banner");
      if (banner) banner.classList.add("show");
    });
    var installBtn = document.getElementById("install-btn");
    if (installBtn) installBtn.addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt = null;
      document.getElementById("install-banner").classList.remove("show");
    });
    window.addEventListener("hashchange", function () { moreOpen = false; render(); });
    window.addEventListener("resize", function () {
      if (parseRoute().page === "charts") {
        var canvas = document.getElementById("candle");
        if (canvas) drawCandles(canvas, book.bars[chartSymbol] || []);
      }
    });
    if (!location.hash) location.hash = "#/ticket?symbol=GBP_USD";
    try { refreshQuotes(null, function () {}); } catch (e) {}
    render();
    registerSW();
    setInterval(function () {
      markUpdate();
      var pg = parseRoute().page;
      if (pg === "overview" || pg === "positions" || pg === "ticket") render();
      else renderNav();
    }, 15000);
  }
})();
