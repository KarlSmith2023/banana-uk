#!/usr/bin/env node
/**
 * Local-only TradingView quote proxy for Banana UK.
 *
 * Uses unofficial @mathieuc/tradingview (Mathieu2301 TradingView-API).
 * Not affiliated with TradingView. Personal/local use only — respect TV ToS.
 * Never bake in session cookies or secrets.
 *
 * Usage (from banana-uk):
 *   npm i
 *   npm run quotes
 *
 * Listens 127.0.0.1:8791
 *   GET /health
 *   GET /quotes?instruments=GBP_USD,UK100_GBP
 */
import http from "http";
import TradingView from "@mathieuc/tradingview";

const BIND = "127.0.0.1";
const PORT = Number(process.env.PORT || 8791);
const CACHE_MS = Number(process.env.QUOTE_CACHE_MS || 2000);
const QUOTE_TIMEOUT_MS = Number(process.env.QUOTE_TIMEOUT_MS || 12000);

/** Banana UK (OANDA v20) → TradingView OANDA symbols — smoke-tested on this box. */
const TV_MAP = {
  EUR_GBP: "OANDA:EURGBP",
  GBP_JPY: "OANDA:GBPJPY",
  USD_JPY: "OANDA:USDJPY",
  GBP_USD: "OANDA:GBPUSD",
  EUR_USD: "OANDA:EURUSD",
  XAU_GBP: "OANDA:XAUGBP",
  UK100_GBP: "OANDA:UK100GBP",
  AUD_USD: "OANDA:AUDUSD",
  USD_CAD: "OANDA:USDCAD",
  EUR_JPY: "OANDA:EURJPY",
  XAU_USD: "OANDA:XAUUSD",
};

const DEFAULT_INSTRUMENTS = Object.keys(TV_MAP);

function normBanana(sym) {
  return String(sym || "").trim().toUpperCase().replace(/[/\-]/g, "_");
}

function inferBananaFromBare(bare) {
  const b = String(bare || "").toUpperCase();
  for (const [k, v] of Object.entries(TV_MAP)) {
    if (v.split(":")[1] === b) return k;
  }
  if (b.endsWith("GBP") && b.length > 6) return b.slice(0, -3) + "_GBP";
  if (b.length >= 6) return b.slice(0, -3) + "_" + b.slice(-3);
  return b;
}

function bananaToTv(sym) {
  const raw = String(sym || "").trim();
  const s = raw.toUpperCase().replace(/[/\-]/g, "_");
  if (TV_MAP[s]) return { banana: s, tv: TV_MAP[s] };
  if (s.includes(":")) {
    const tv = raw.includes(":") ? raw.replace(/_/g, "") : s;
    const bare = tv.split(":").pop();
    return { banana: inferBananaFromBare(bare), tv };
  }
  const compact = s.replace(/_/g, "");
  return { banana: s, tv: "OANDA:" + compact };
}

let client = null;
let ready = null;

function getClient() {
  if (client && client.isOpen) return Promise.resolve(client);
  client = new TradingView.Client();
  ready = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("tradingview client connect timeout")), 15000);
    const done = () => {
      clearTimeout(t);
      resolve(client);
    };
    client.onConnected(done);
    client.onError((...err) => {
      /* keep going — probe succeeded without treating WS noise as fatal */
      console.warn("tv client", ...err);
    });
    client.onDisconnected(() => {
      client = null;
      ready = null;
    });
    if (client.isOpen) done();
  });
  return ready;
}

function toPrice(banana, tv, q) {
  const bid = Number(q.bid);
  const ask = Number(q.ask);
  const lp = Number(q.lp);
  const last = lp > 0 ? lp : (bid > 0 && ask > 0 ? (bid + ask) / 2 : (ask > 0 ? ask : bid));
  return {
    instrument: banana,
    tv,
    last,
    bid: bid > 0 ? bid : last,
    ask: ask > 0 ? ask : last,
    changePct: Number(q.chp) || 0,
    bids: bid > 0 ? [{ price: String(bid) }] : (last > 0 ? [{ price: String(last) }] : []),
    asks: ask > 0 ? [{ price: String(ask) }] : (last > 0 ? [{ price: String(last) }] : []),
  };
}

function onceQuotes(mapped) {
  return getClient().then((c) => new Promise((resolve) => {
    const qs = new c.Session.Quote({ customFields: ["lp", "bid", "ask", "chp", "volume"] });
    const pending = mapped.map(({ banana, tv }) => new Promise((res) => {
      const m = new qs.Market(tv);
      const t = setTimeout(() => {
        try { m.close(); } catch { /* ignore */ }
        res({ instrument: banana, tv, error: "timeout" });
      }, QUOTE_TIMEOUT_MS);
      let settled = false;
      let hold = null;
      let lastQ = null;
      const finish = (row) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        if (hold) clearTimeout(hold);
        try { m.close(); } catch { /* ignore */ }
        res(row);
      };
      m.onData((q) => {
        lastQ = q;
        if (q.lp == null && q.bid == null && q.ask == null) return;
        if (q.bid != null && q.ask != null) {
          finish(toPrice(banana, tv, q));
          return;
        }
        if (!hold) {
          hold = setTimeout(() => finish(toPrice(banana, tv, lastQ || q)), 900);
        }
      });
      m.onError((e) => {
        finish({ instrument: banana, tv, error: String(e && e.message ? e.message : e) });
      });
    }));
    Promise.all(pending).then((rows) => {
      try { qs.delete(); } catch { /* ignore */ }
      resolve(rows);
    });
  }));
}

const cache = new Map();

function cacheKey(list) {
  return list.slice().sort().join(",");
}

async function fetchPrices(instruments) {
  const key = cacheKey(instruments);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.payload, cached: true };

  const mapped = instruments.map(bananaToTv);
  const rows = await onceQuotes(mapped);
  const prices = rows.filter((p) => p.last > 0 || p.error);
  const payload = {
    ok: prices.some((p) => p.last > 0),
    source: "tradingview",
    unofficial: true,
    prices,
  };
  cache.set(key, { at: Date.now(), payload });
  return { ...payload, cached: false };
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
}

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  try {
    const u = new URL(req.url, "http://127.0.0.1");
    if (u.pathname === "/health") {
      json(res, 200, {
        ok: true,
        source: "tradingview",
        unofficial: true,
        bind: BIND,
        port: PORT,
        clientOpen: !!(client && client.isOpen),
        cacheMs: CACHE_MS,
      });
      return;
    }
    if (u.pathname === "/quotes") {
      const raw = u.searchParams.get("instruments") || "";
      const instruments = raw.split(",").map(normBanana).filter(Boolean);
      const list = instruments.length ? instruments : DEFAULT_INSTRUMENTS;
      const payload = await fetchPrices(list);
      json(res, payload.ok ? 200 : 502, payload);
      return;
    }
    json(res, 404, { error: "not_found" });
  } catch (e) {
    json(res, 500, { error: String(e && e.message ? e.message : e) });
  }
});

server.listen(PORT, BIND, () => {
  console.log("Banana UK TV quote proxy on http://" + BIND + ":" + PORT);
  console.log("Unofficial @mathieuc/tradingview — local/personal use; respect TradingView ToS.");
});
