# BANANA://uk — OANDA practice FX / UK100 (static PWA)

Karl Smith’s **Banana UK** paper desk: **OANDA practice FX + UK100 CFD**, not LSE cash equities and not the India NSE blotter.

**Honesty first**

- [BananaPatterns](https://bananapatterns.com) is an **India-only** stock screener (no UK feed). This app applies the **same risk / breakout process** (Blue sky / VCP-style: 1.5% risk, 8% stop, 50-EMA trail, max 5, max 2 new/session, no chase >5%, prefer RS≥85) to **FX breakouts** and **UK100**, using public/practice quotes + manual ingest.
- **OANDA v20 cannot trade share CFDs.** This book is **FX pairs + UK100 index CFD** only (OANDA practice instruments such as `GBP_USD`, `EUR_GBP`, `UK100_GBP`).
- **Not financial advice.** Paper fills are local. Live `api-fxtrade.oanda.com` is **never** called. Practice order *send* stays locked behind the **60-session** gate (stub).

Phone-installable, no-Node: HTML / JS / CSS. Paper book in `localStorage` (`banana-uk-fx-v1`). OANDA practice token + account ID in `localStorage` (`banana-uk-oanda-creds-v1`) — **never commit**. Optional local `oanda-local.js` (gitignored) can pre-seed creds from env.

## Markets (seed)

| Instrument | Role |
|------------|------|
| `EUR_GBP`, `GBP_JPY`, `USD_JPY`, `AUD_USD` | Forming demos |
| `GBP_USD`, `EUR_USD`, `XAU_GBP`, `UK100_GBP`, `USD_CAD` | Fresh demos |
| `EUR_JPY`, `XAU_USD` | Do-not-chase demos |

Seed as-of **Fri 11 Sep 2026** (plausible marks, fake-but-consistent pivots/%). Quotes: **local TradingView proxy** (`npm run quotes`) when it is up, else **OANDA practice pricing** when token + account ID are set, else **seed marks**. Status chip: `tradingview` | `practice` | `seed`.

## Run

```bash
# from this folder (or repo-root /banana-uk)
python3 -m http.server 8765 --directory .
# open http://127.0.0.1:8765/  or  .../banana-uk/
```

### Live quotes on the PC (preferred)

OANDA practice from the **phone / GitHub Pages** hits CORS, so those clients stay on seed marks. On the PC, run the unofficial TradingView quote proxy (same box as the static PWA):

```bash
cd banana-uk          # or C:\\Users\\karls\\Projects\\banana-uk
npm i                 # installs @mathieuc/tradingview; node_modules is gitignored
npm run quotes        # node tv-quote-proxy.mjs → http://127.0.0.1:8791
# Playbook → Quotes: proxy URL http://127.0.0.1:8791 (saved in localStorage)
# Trade → Refresh quotes  (or Playbook → Test quotes)
```

Maps Banana instruments (`GBP_USD`, `UK100_GBP`, …) to TradingView `OANDA:GBPUSD`, `OANDA:UK100GBP`, etc. Returns JSON `{ prices: [{ instrument, last, bid, ask, … }] }`. CORS `*` for the local PWA.

**Honesty / ToS:** `@mathieuc/tradingview` is an **unofficial** community client (Mathieu2301 TradingView-API). It is **not** TradingView’s API, not affiliated with TradingView, and may break or violate TradingView’s terms if abused. Use only locally for personal paper marks. Never commit session cookies, `sessionid`, or any TV/OANDA secrets. Do not deploy this proxy to the public internet.

Optional OANDA practice creds (local only, fallback if the TV proxy is down):

```bash
export OANDA_PRACTICE_TOKEN=…
export OANDA_PRACTICE_ACCOUNT=…
# write gitignored oanda-local.js, or paste into Playbook → OANDA practice
```

Try: open Trade · **GBP_USD** → **Place paper order**. BP-style chase rejects on `EUR_JPY` / `XAU_USD`. **Sync to OANDA practice** is a stub until 60 sessions.

## Playbook defaults

| Rule | Default |
|------|---------|
| Universe | Blue sky or VCP∩Blue sky |
| Risk | **1.5%** equity / idea; stop **8%**; size = risk / stop% (fractional units OK for UK100/XAU) |
| Caps | Max **5** open; max **2** new / session |
| Chase | No chase if **>5%** above pivot; prefer RS ≥ **85** |
| Trail | Daily close below **50-EMA** |
| Gate | Live / practice **send** locked **60 sessions** |

Start equity **£800**. P&L **GBP only** (optional tiny USD note). Yellow Banana UI. PWA: name **Banana UK**, short_name **BananaUK**, theme `#F5C518`, SW cache `banana-uk-v2`.

## Paths

Relative assets (`./app.js`, …) work at GitHub Pages `/banana-uk/` or repo root `banana-uk`. Hash routes: `#/ticket?symbol=GBP_USD`.

## Reset

Playbook → **Reset paper book to seed**, or clear `banana-uk-fx-v1` / `banana-uk-oanda-creds-v1` / `banana-uk-quote-proxy-v1`.
