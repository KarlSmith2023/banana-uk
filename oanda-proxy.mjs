#!/usr/bin/env node
/**
 * Local-only OANDA practice proxy for Banana UK.
 * Usage: OANDA_PRACTICE_TOKEN=… OANDA_PRACTICE_ACCOUNT=… node oanda-proxy.mjs
 * Never deploy this with a baked-in token. Listens on 8787.
 */
import http from "http";

const TOKEN = process.env.OANDA_PRACTICE_TOKEN || process.env.OANDA_API_TOKEN || "";
const ACCOUNT = process.env.OANDA_PRACTICE_ACCOUNT || "";
const HOST = "api-fxpractice.oanda.com";
const PORT = Number(process.env.PORT || 8787);

if (!TOKEN) {
  console.error("Set OANDA_PRACTICE_TOKEN (practice only). Refusing to start.");
  process.exit(1);
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  try {
    const u = new URL(req.url, "http://127.0.0.1");
    if (u.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, host: HOST, accountSet: Boolean(ACCOUNT) }));
      return;
    }
    if (u.pathname === "/v3/accounts" || u.pathname.startsWith("/v3/accounts/")) {
      const path = u.pathname + u.search;
      const r = await fetch("https://" + HOST + path, {
        headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
      });
      const body = await r.text();
      res.writeHead(r.status, { "Content-Type": "application/json" });
      res.end(body);
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("OANDA practice proxy on http://127.0.0.1:" + PORT + " (fxpractice only)");
});
