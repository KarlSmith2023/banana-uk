/* Banana UK quote overlay — no-ops if app.js already has refreshQuotes. */
(function () {
  "use strict";
  var QUOTE_PROXY_KEY = "banana-uk-quote-proxy-v1";
  var DEFAULT_QUOTE_PROXY = "http://127.0.0.1:8791";

  function loadQuoteProxy() {
    try {
      var raw = localStorage.getItem(QUOTE_PROXY_KEY);
      if (!raw) return { url: DEFAULT_QUOTE_PROXY, status: "seed", lastError: "" };
      var o = JSON.parse(raw);
      return {
        url: String(o.url != null ? o.url : DEFAULT_QUOTE_PROXY),
        status: o.status || "seed",
        lastError: o.lastError || "",
      };
    } catch (e) {
      return { url: DEFAULT_QUOTE_PROXY, status: "seed", lastError: "" };
    }
  }
  function saveQuoteProxy(patch) {
    var cur = loadQuoteProxy();
    var next = Object.assign({}, cur, patch || {}, { updatedAt: new Date().toISOString() });
    try { localStorage.setItem(QUOTE_PROXY_KEY, JSON.stringify(next)); } catch (e) {}
    return next;
  }
  function quoteSourceChip() {
    var p = loadQuoteProxy();
    if (p.status === "tradingview") return "tradingview";
    var desk = window.__desk;
    if (desk && desk.loadOandaCreds) {
      var c = desk.loadOandaCreds();
      if (c && c.status === "practice") return "practice";
    }
    return "seed";
  }

  function applyPriceTick(sym, last, bid, ask, source, changePct) {
    var book = window.__desk && window.__desk.getBook && window.__desk.getBook();
    if (!book) return;
    if (!book.quotes) book.quotes = {};
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
    if (book.setups) {
      var setup = book.setups.filter(function (s) { return s.symbol === sym; })[0];
      if (setup) { setup.last = last; setup.changePct = book.quotes[sym].changePct; }
    }
  }

  function refreshTradingViewQuotes(symbols, cb) {
    var desk = window.__desk;
    var book = desk && desk.getBook && desk.getBook();
    symbols = symbols || (book && book.setups ? book.setups.map(function (s) { return s.symbol; }) : ["GBP_USD"]);
    var proxy = loadQuoteProxy();
    var base = String(proxy.url || "").replace(/\/$/, "");
    if (!base) { if (cb) cb(0, "skip"); return; }
    var url = base + "/quotes?instruments=" + encodeURIComponent(symbols.join(","));
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
          var sym = String(pr.instrument || "").toUpperCase();
          var last = Number(pr.last);
          var bid = Number(pr.bid);
          var ask = Number(pr.ask);
          if (!(last > 0)) return;
          applyPriceTick(sym, last, bid, ask, "tradingview", pr.changePct);
          changed++;
        });
        if (changed) {
          saveQuoteProxy({ status: "tradingview", lastError: "" });
          if (cb) cb(changed, "tradingview");
        } else {
          saveQuoteProxy({ status: "error", lastError: "Proxy returned no prices" });
          if (cb) cb(0, "empty");
        }
      })
      .catch(function (err) {
        var raw = String(err && err.message ? err.message : err);
        var msg = /Failed to fetch|NetworkError|CORS|Load failed/i.test(raw)
          ? ("Quote proxy unreachable (" + base + "). Run: npm i && npm run quotes")
          : raw;
        saveQuoteProxy({ status: "error", lastError: msg });
        if (cb) cb(0, "error");
      });
  }

  function refreshQuotes(symbols, cb) {
    refreshTradingViewQuotes(symbols, function (n, mode) {
      if (mode === "tradingview") { if (cb) cb(n, "tradingview"); return; }
      var desk = window.__desk;
      if (desk && desk.refreshOandaPracticeQuotes) {
        desk.refreshOandaPracticeQuotes(symbols, cb);
      } else if (cb) cb(0, "seed");
    });
  }

  function paintChip() {
    var chip = quoteSourceChip();
    var nodes = document.querySelectorAll(".q, #quote-status, #oanda-status");
    nodes.forEach(function (el) {
      if (el.id === "quote-status" || el.id === "oanda-status") {
        if (el.id === "quote-status") el.innerHTML = "Status: <b>" + chip + "</b>";
      } else if (el.classList.contains("q")) {
        el.textContent = "\u00b7" + chip;
      }
    });
    var btn = document.getElementById("tk-refresh-quotes");
    if (btn) btn.textContent = "Refresh quotes";
  }

  function ensurePlaybookFields() {
    if (document.getElementById("pb-quote-proxy")) return;
    var oanda = document.getElementById("pb-oanda-token");
    if (!oanda) return;
    var panel = oanda.closest(".desk-panel");
    if (!panel || !panel.parentNode) return;
    var wrap = document.createElement("div");
    wrap.className = "desk-panel pad";
    wrap.style.cssText = "display:flex;flex-direction:column;gap:12px";
    var chip = quoteSourceChip();
    var p = loadQuoteProxy();
    wrap.innerHTML =
      "<h2>Quotes (tradingview \u2192 practice \u2192 seed)</h2>" +
      '<div class="msg" id="quote-status" style="margin:0">Status: <b>' + chip + "</b>" +
      (p.lastError ? " \u2014 " + p.lastError : "") + "</div>" +
      '<p class="muted" style="font-size:12px;margin:0">Local <code>npm i && npm run quotes</code> \u2014 unofficial @mathieuc/tradingview. Respect TV ToS. URL in localStorage only.</p>' +
      '<label class="field">Quote proxy URL<input class="desk-input" id="pb-quote-proxy" type="url" value="' + (p.url || DEFAULT_QUOTE_PROXY) + '" /></label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
      '<button type="button" class="desk-btn-primary" id="pb-quote-save" style="font-size:12px">Save proxy URL</button>' +
      '<button type="button" class="desk-btn" id="pb-quote-test" style="font-size:12px">Test quotes</button></div>';
    panel.parentNode.insertBefore(wrap, panel);
    var save = document.getElementById("pb-quote-save");
    if (save) save.addEventListener("click", function () {
      var url = ((document.getElementById("pb-quote-proxy") || {}).value || "").trim();
      saveQuoteProxy({ url: url || DEFAULT_QUOTE_PROXY, lastError: "" });
    });
    var test = document.getElementById("pb-quote-test");
    if (test) test.addEventListener("click", function () {
      var url = ((document.getElementById("pb-quote-proxy") || {}).value || "").trim();
      if (url) saveQuoteProxy({ url: url });
      refreshQuotes(null, function () { paintChip(); });
    });
  }

  function hookRefreshButton() {
    var btn = document.getElementById("tk-refresh-quotes");
    if (!btn || btn.getAttribute("data-tv-hooked")) return;
    btn.setAttribute("data-tv-hooked", "1");
    btn.textContent = "Refresh quotes";
    btn.addEventListener("click", function (e) {
      e.stopImmediatePropagation();
      refreshQuotes(null, function () { paintChip(); });
    }, true);
  }

  function install() {
    var desk = window.__desk;
    if (!desk) { setTimeout(install, 50); return; }
    if (typeof desk.refreshQuotes === "function") {
      try { desk.refreshQuotes(null, function () {}); } catch (e) {}
      return;
    }
    desk.refreshQuotes = refreshQuotes;
    desk.refreshTradingViewQuotes = refreshTradingViewQuotes;
    desk.loadQuoteProxy = loadQuoteProxy;
    desk.quoteSourceChip = quoteSourceChip;
    hookRefreshButton();
    ensurePlaybookFields();
    paintChip();
    try { refreshQuotes(null, function () { paintChip(); }); } catch (e) {}
    window.addEventListener("hashchange", function () {
      setTimeout(function () { hookRefreshButton(); ensurePlaybookFields(); paintChip(); }, 80);
    });
  }

  if (document.readyState === "complete") install();
  else window.addEventListener("load", install);
})();
