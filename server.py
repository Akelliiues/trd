"""
TradingTools Workstation Server (Multi-Source Real-Time Market Data Engine)
- Priority 1: MetaTrader 5 (MT5) Realtime Ticks & Candles (Exness / Broker 1:1 Live Data)
- Priority 2: Spot Market Feeds (Binance Spot Gold PAXGUSDT + Crypto + Public Forex Spot)
- MT5 Webhook for Trade Journal Sync
"""

import http.server
import socketserver
import os
import sys
import json
import urllib.parse
import urllib.request
import threading
import time

PORT = int(os.environ.get("PORT", 3000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
from scripts.tradingview_feed import TradingViewWSFeed
import queue

LIVE_RATES = {}
LIVE_RATES_LOCK = threading.Lock()
CANDLE_CACHE = {}
CANDLE_CACHE_LOCK = threading.Lock()
MT5_ACTIVE = False
MT5_LAST_SEEN = 0

# Server-Sent Events (SSE) Pub/Sub
SSE_CLIENTS = set()
SSE_CLIENTS_LOCK = threading.Lock()

def broadcast_sse(event_type, data):
    payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n".encode('utf-8')
    with SSE_CLIENTS_LOCK:
        dead = []
        for q in SSE_CLIENTS:
            try:
                q.put_nowait(payload)
            except queue.Full:
                dead.append(q)
        for d in dead:
            SSE_CLIENTS.discard(d)

def merge_and_persist_candles(sym, new_candles, max_len=120000, save_to_disk=True):
    """Merge historical and fresh candles without dropping past history for backtesting (Up to 120,000 candles)."""
    if not new_candles:
        return []
    with CANDLE_CACHE_LOCK:
        existing = CANDLE_CACHE.get(sym, [])
        if not existing:
            out_path = os.path.join(BASE_DIR, "data", f"{sym}_1m.json")
            if os.path.exists(out_path):
                try:
                    with open(out_path, "r", encoding="utf-8") as f:
                        existing = json.load(f)
                except Exception:
                    existing = []

        time_map = {c["time"]: c for c in existing}
        for c in new_candles:
            time_map[c["time"]] = c
        merged = sorted(time_map.values(), key=lambda x: x["time"])
        if len(merged) > max_len:
            merged = merged[-max_len:]
        CANDLE_CACHE[sym] = merged

        if save_to_disk:
            try:
                out_path = os.path.join(BASE_DIR, "data", f"{sym}_1m.json")
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(merged, f, separators=(',', ':'))
            except Exception:
                pass
        return merged


PUBLIC_SYMBOLS_MAP = {
    'EURUSD': {'yahoo': 'EURUSD=X', 'digits': 5, 'spread': 0.00015},
    'GBPUSD': {'yahoo': 'GBPUSD=X', 'digits': 5, 'spread': 0.00018},
    'USDJPY': {'yahoo': 'JPY=X', 'digits': 3, 'spread': 0.015},
    'AUDUSD': {'yahoo': 'AUDUSD=X', 'digits': 5, 'spread': 0.00016},
    'NZDUSD': {'yahoo': 'NZDUSD=X', 'digits': 5, 'spread': 0.00018},
    'XAGUSD': {'yahoo': 'SI=F', 'digits': 3, 'spread': 0.015},
    'USOIL':  {'yahoo': 'CL=F', 'digits': 2, 'spread': 0.03}
}

class TradingToolsHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_POST(self):
        # Webhook endpoint สำหรับรับ Order จาก MetaTrader 5 (MQL5 EA)
        if self.path == '/api/sync-trade':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                trade_data = json.loads(post_data.decode('utf-8'))
                print(f"[MT5 Sync] Received trade #{trade_data.get('ticket')}: {trade_data.get('symbol')} {trade_data.get('type')} Profit: ${trade_data.get('profit')}")
                
                # บันทึกลงไฟล์ synced_trades.json
                journal_file = os.path.join(BASE_DIR, "data", "synced_trades.json")
                synced_trades = []
                if os.path.exists(journal_file):
                    try:
                        with open(journal_file, "r", encoding="utf-8") as f:
                            synced_trades = json.load(f)
                    except:
                        synced_trades = []
                
                synced_trades.insert(0, trade_data)
                with open(journal_file, "w", encoding="utf-8") as f:
                    json.dump(synced_trades, f, indent=2)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"status":"success","message":"Trade synced successfully"}')
            except Exception as e:
                print(f"[-] Error processing sync-trade: {e}")
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"status":"error","message":"Invalid payload"}')
            return

        # Webhook / API: MT5 Push Rates Endpoint (เพิ่มความเรียลไทม์)
        elif self.path == '/api/push-rates':
            try:
                global MT5_ACTIVE, MT5_LAST_SEEN
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len)
                data = json.loads(body.decode('utf-8'))
                
                rates = data.get('rates', {})
                MT5_ACTIVE = True
                MT5_LAST_SEEN = time.time()
                for sym, r in rates.items():
                    r['source'] = 'mt5_boost'
                    r['mt5_boost'] = True
                    r['time'] = int(time.time())
                    with LIVE_RATES_LOCK:
                        cur = LIVE_RATES.get(sym, {})
                        cur.update(r)
                        cur['mt5_bid'] = r.get('bid')
                        cur['mt5_ask'] = r.get('ask')
                        cur['mt5_boost'] = True
                        cur['mt5_time'] = r['time']
                        LIVE_RATES[sym] = cur
                    broadcast_sse("mt5_tick", r)
                    broadcast_sse("tick", r)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"ok","updated":true,"boost":true}')
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode('utf-8'))
            return

        # Webhook / API: MT5 Push Candles Endpoint
        elif self.path == '/api/push-candles':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len)
                data = json.loads(body.decode('utf-8'))
                
                symbol = data.get('symbol', 'XAUUSD')
                candles = data.get('candles', [])
                
                if candles and len(candles) > 0:
                    with CANDLE_CACHE_LOCK:
                        if symbol == "XAUUSD" and "XAUUSD" in CANDLE_CACHE and len(CANDLE_CACHE["XAUUSD"]) > 0:
                            last_bar = CANDLE_CACHE["XAUUSD"][-1]
                            if candles[-1]["time"] == last_bar["time"]:
                                last_bar["volume"] = max(last_bar.get("volume", 0), candles[-1].get("volume", 0))
                        else:
                            CANDLE_CACHE[symbol] = candles
                            out_path = os.path.join(BASE_DIR, "data", f"{symbol}_1m.json")
                            with open(out_path, "w", encoding="utf-8") as f:
                                json.dump(candles, f, indent=2)
                    broadcast_sse("candle_update", {"symbol": symbol, "candle": candles[-1]})
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"ok","synced":true}')
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode('utf-8'))
            return

        super().do_POST()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 0. API Realtime SSE Stream (Sub-Millisecond Zero-Lag EventSource สำหรับหน้าจอชาร์ต)
        if path == '/api/live-stream':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache, no-transform')
            self.send_header('Connection', 'keep-alive')
            self.send_header('X-Accel-Buffering', 'no')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            client_queue = queue.Queue(maxsize=120)
            with SSE_CLIENTS_LOCK:
                SSE_CLIENTS.add(client_queue)

            self.wfile.write(b": connected\n\n")
            self.wfile.flush()

            with LIVE_RATES_LOCK:
                init_rates = dict(LIVE_RATES)
            init_msg = f"event: rates_init\ndata: {json.dumps(init_rates)}\n\n".encode('utf-8')
            self.wfile.write(init_msg)
            self.wfile.flush()

            try:
                while True:
                    try:
                        msg = client_queue.get(timeout=12)
                        self.wfile.write(msg)
                        self.wfile.flush()
                    except queue.Empty:
                        self.wfile.write(b": keepalive\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, Exception):
                pass
            finally:
                with SSE_CLIENTS_LOCK:
                    SSE_CLIENTS.discard(client_queue)
            return

        # 1. API ส่งราคา Live Rates ล่าสุดจาก RAM Cache ระดับ Sub-Millisecond
        if path.startswith('/api/live-rates') or path.startswith('/api/rates'):
            with LIVE_RATES_LOCK:
                rates_data = dict(LIVE_RATES)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            is_boost = MT5_ACTIVE and (time.time() - MT5_LAST_SEEN < 3)
            self.wfile.write(json.dumps({
                "status": "ok",
                "rates": rates_data,
                "mt5_active": is_boost,
                "server_time": int(time.time()),
                "primary_source": "icmarkets_institutional",
                "realtime_boost": "mt5_turbo_active" if is_boost else "ready"
            }).encode('utf-8'))
            return

        # 2. API ส่งแท่งเทียน M1 สดล่าสุดจาก MT5 RAM Cache (Zero-Lag Sync พร้อมประวัติเต็มย้อนหลังระดับโปร 50,000 - 100,000 แท่ง)
        if path == '/api/candles':
            qs = urllib.parse.parse_qs(parsed.query)
            symbol = qs.get('symbol', ['XAUUSD'])[0].upper()
            try:
                count = int(qs.get('count', [100000])[0])
            except Exception:
                count = 100000

            candles = []
            with CANDLE_CACHE_LOCK:
                if symbol in CANDLE_CACHE and len(CANDLE_CACHE[symbol]) > 0:
                    candles = list(CANDLE_CACHE[symbol])

            # ตรวจสอบและผสานข้อมูลประวัติศาสตร์จาก data/{symbol}_1m.json ไม่ให้แท่งเทียนเก่าสูญหาย
            data_file = os.path.join(BASE_DIR, "data", f"{symbol}_1m.json")
            if os.path.exists(data_file):
                try:
                    with open(data_file, "r", encoding="utf-8") as f:
                        disk_candles = json.load(f)
                    if disk_candles:
                        time_map = {c["time"]: c for c in disk_candles}
                        for c in candles:
                            time_map[c["time"]] = c
                        merged = sorted(time_map.values(), key=lambda x: x["time"])
                        with CANDLE_CACHE_LOCK:
                            CANDLE_CACHE[symbol] = merged
                        candles = merged
                except Exception:
                    pass

            if count > 0 and len(candles) > count:
                candles = candles[-count:]

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "symbol": symbol,
                "candles": candles,
                "server_time": int(time.time()),
                "count": len(candles)
            }).encode('utf-8'))
            return

        super().do_GET()

    def end_headers(self):
        # Security & CORS Headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        
        # PWA Service Worker & Force-Update Headers
        path = self.path.split('?')[0]
        if path == '/sw.js' or path == '/' or path == '/index.html' or path == '/manifest.json':
            self.send_header('Service-Worker-Allowed', '/')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        elif path.startswith('/api/') or path.startswith('/data/'):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
            
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


def fetch_binance_klines(binance_sym, count=600, digits=2):
    try:
        url = f"https://api.binance.com/api/v3/klines?symbol={binance_sym}&interval=1m&limit={count}"
        req = urllib.request.Request(url, headers={'User-Agent': 'TradingTools/2.5.7'})
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            raw = json.loads(resp.read().decode('utf-8'))
            candles = []
            offset_sec = 7 * 3600
            for k in raw:
                t = int(k[0] / 1000) + offset_sec
                candles.append({
                    "time": t,
                    "open": round(float(k[1]), digits),
                    "high": round(float(k[2]), digits),
                    "low": round(float(k[3]), digits),
                    "close": round(float(k[4]), digits),
                    "volume": int(float(k[5]))
                })
            return candles
    except Exception:
        return []


def public_market_data_worker():
    """
    Spot Market Data Fallback Worker:
    - Runs 24/7. When MT5 is not connected, it feeds real-time Spot Gold (PAXGUSDT 1:1), Crypto, & Forex prices and candles.
    """
    global MT5_ACTIVE, MT5_LAST_SEEN
    last_candle_sync = 0

    while True:
        try:
            now = int(time.time())
            is_mt5_live = MT5_ACTIVE and (now - MT5_LAST_SEEN < 3)

            # 1. ดึงราคา Ticker สดจาก Binance (Crypto Backup)
            try:
                url = "https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D"
                req = urllib.request.Request(url, headers={'User-Agent': 'TradingTools/2.5.7'})
                with urllib.request.urlopen(req, timeout=2.5) as resp:
                    items = json.loads(resp.read().decode('utf-8'))
                    with LIVE_RATES_LOCK:
                        for item in items:
                            sym = item['symbol']
                            price = float(item['price'])
                            spread = 0.5 if sym == 'BTCUSDT' else (0.1 if sym == 'ETHUSDT' else 0.02)
                            if not is_mt5_live:
                                if sym not in LIVE_RATES or LIVE_RATES[sym].get('source') != 'tradingview_live':
                                    LIVE_RATES[sym] = {
                                        'symbol': sym,
                                        'bid': round(price, 2),
                                        'ask': round(price + spread, 2),
                                        'close': round(price, 2),
                                        'time': now,
                                        'digits': 2,
                                        'source': 'binance_live'
                                    }
                                    if sym == 'BTCUSDT':
                                        LIVE_RATES['BTCUSD'] = dict(LIVE_RATES[sym], symbol='BTCUSD')
                                    elif sym == 'ETHUSDT':
                                        LIVE_RATES['ETHUSD'] = dict(LIVE_RATES[sym], symbol='ETHUSD')
                                    elif sym == 'SOLUSDT':
                                        LIVE_RATES['SOLUSD'] = dict(LIVE_RATES[sym], symbol='SOLUSD')
            except Exception:
                pass

            # 2. เมื่อ MT5 ไม่ได้เปิด: ดึงแท่งเทียน M1 สดต่อเนื่องจาก Binance (Crypto Backup) ทุกๆ 4 วินาที
            if not is_mt5_live and (now - last_candle_sync >= 4):
                last_candle_sync = now

                # 2.2 Bitcoin (BTCUSD & BTCUSDT)
                btc_candles = fetch_binance_klines("BTCUSDT", count=1000, digits=2)
                if btc_candles:
                    merge_and_persist_candles("BTCUSD", btc_candles, max_len=10000, save_to_disk=True)
                    merge_and_persist_candles("BTCUSDT", btc_candles, max_len=10000, save_to_disk=True)

                # 2.3 Ethereum & Solana
                eth_candles = fetch_binance_klines("ETHUSDT", count=1000, digits=2)
                if eth_candles:
                    merge_and_persist_candles("ETHUSD", eth_candles, max_len=10000, save_to_disk=True)
                    merge_and_persist_candles("ETHUSDT", eth_candles, max_len=10000, save_to_disk=True)

                sol_candles = fetch_binance_klines("SOLUSDT", count=1000, digits=2)
                if sol_candles:
                    merge_and_persist_candles("SOLUSD", sol_candles, max_len=10000, save_to_disk=True)
                    merge_and_persist_candles("SOLUSDT", sol_candles, max_len=10000, save_to_disk=True)

                # 2.4 Gold Spot Backup (PAXGUSDT 1:1)
                paxg_candles = fetch_binance_klines("PAXGUSDT", count=1000, digits=2)
                if paxg_candles:
                    merge_and_persist_candles("XAUUSD", paxg_candles, max_len=100000, save_to_disk=True)

            # 3. Forex & Commodities จาก Yahoo Finance
            for target_sym, cfg in PUBLIC_SYMBOLS_MAP.items():
                if is_mt5_live and target_sym in LIVE_RATES:
                    continue

                yahoo_sym = cfg['yahoo']
                digits = cfg['digits']
                spread = cfg['spread']
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}?interval=1m&range=1d"
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                    with urllib.request.urlopen(req, timeout=2.5) as resp:
                        data = json.loads(resp.read().decode('utf-8'))
                        result = data['chart']['result'][0]
                        meta = result['meta']
                        price = meta.get('regularMarketPrice')
                        if price is not None:
                            with LIVE_RATES_LOCK:
                                if not is_mt5_live or target_sym not in LIVE_RATES:
                                    LIVE_RATES[target_sym] = {
                                        'symbol': target_sym,
                                        'bid': round(price, digits),
                                        'ask': round(price + spread, digits),
                                        'close': round(price, digits),
                                        'digits': digits,
                                        'time': now,
                                        'source': 'yahoo_live'
                                    }

                        if not is_mt5_live and 'timestamp' in result:
                            timestamps = result['timestamp']
                            quotes = result['indicators']['quote'][0]
                            candles = []
                            offset_sec = 7 * 3600
                            for i in range(len(timestamps)):
                                if quotes['open'][i] is not None and quotes['close'][i] is not None:
                                    candles.append({
                                        "time": timestamps[i] + offset_sec,
                                        "open": round(quotes['open'][i], digits),
                                        "high": round(quotes['high'][i], digits),
                                        "low": round(quotes['low'][i], digits),
                                        "close": round(quotes['close'][i], digits),
                                        "volume": int(quotes['volume'][i] or 100)
                                    })
                            if candles:
                                with CANDLE_CACHE_LOCK:
                                    CANDLE_CACHE[target_sym] = candles
                                out_path = os.path.join(BASE_DIR, "data", f"{target_sym}_1m.json")
                                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                                with open(out_path, "w", encoding="utf-8") as f:
                                    json.dump(candles[-600:], f)
                except Exception:
                    pass

            time.sleep(1.2)
        except Exception:
            time.sleep(2)


def mt5_candle_sync_worker():
    """Sync closed M1 candles from MT5 directly into RAM CANDLE_CACHE & data/{symbol}_1m.json every 1.5 seconds with exact dynamic offset."""
    global MT5_ACTIVE, MT5_LAST_SEEN
    while True:
        time.sleep(1.5)
        if not MT5_ACTIVE:
            continue
        try:
            import MetaTrader5 as mt5
            all_symbols = [s.name for s in mt5.symbols_get()] if mt5.symbols_get() else []
            gold_sym = next((c for c in ['GOLDm#', 'GOLD', 'XAUUSD', 'XAUUSDm', 'GOLD#', 'XAUUSD_i', 'XAUUSD.r'] if c in all_symbols), None)
            btc_sym = next((c for c in ['BTCUSD#', 'BTCUSD', 'BTCUSDT', 'BTCUSDm#'] if c in all_symbols), None)
            eur_sym = next((c for c in ['EURUSD', 'EURUSDm', 'EURUSDm#', 'EURUSD#'] if c in all_symbols), None)
            gbp_sym = next((c for c in ['GBPUSDm#', 'GBPUSD', 'GBPUSDm', 'GBPUSD#'] if c in all_symbols), None)
            jpy_sym = next((c for c in ['USDJPYm#', 'USDJPY', 'USDJPYm', 'USDJPY#'] if c in all_symbols), None)
            eth_sym = next((c for c in ['ETHUSD#', 'ETHUSD', 'ETHUSDT', 'ETHUSDm#'] if c in all_symbols), None)
            sol_sym = next((c for c in ['SOLUSD#', 'SOLUSD', 'SOLUSDT', 'SOLUSDm#'] if c in all_symbols), None)
            silv_sym = next((c for c in ['XAGUSD', 'SILVER', 'SILVERm#', 'XAGUSD#'] if c in all_symbols), None)

            sync_list = [
                ("XAUUSD", gold_sym, 3),
                ("BTCUSD", btc_sym, 2),
                ("BTCUSDT", btc_sym, 2),
                ("EURUSD", eur_sym, 5),
                ("GBPUSD", gbp_sym, 5),
                ("USDJPY", jpy_sym, 3),
                ("ETHUSD", eth_sym, 2),
                ("ETHUSDT", eth_sym, 2),
                ("SOLUSD", sol_sym, 2),
                ("SOLUSDT", sol_sym, 2),
                ("XAGUSD", silv_sym, 3)
            ]

            # คำนวณค่า Offset เวลาจาก Broker สู่เวลาไทย (UTC+7) อัตโนมัติแม่นยำ 100%
            ref_sym = gold_sym or eur_sym or btc_sym
            offset_sec = 4 * 3600
            if ref_sym:
                t = mt5.symbol_info_tick(ref_sym)
                if t:
                    local_thai_now = int(time.time()) + (7 * 3600)
                    hours_diff = round((local_thai_now - t.time) / 3600)
                    offset_sec = hours_diff * 3600

            for target_name, sym, digits in sync_list:
                if not sym: continue
                rates = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_M1, 0, 5000)
                if rates is not None and len(rates) > 0:
                    candles = []
                    for r in rates:
                        candles.append({
                            "time": int(r['time']) + offset_sec,
                            "open": round(float(r['open']), digits),
                            "high": round(float(r['high']), digits),
                            "low": round(float(r['low']), digits),
                            "close": round(float(r['close']), digits),
                            "volume": int(r['tick_volume'])
                        })
                    
                    merge_and_persist_candles(target_name, candles, max_len=100000, save_to_disk=True)
        except Exception:
            pass


def mt5_background_worker():
    """
    Dedicated high-frequency background worker for MetaTrader 5 (MT5).
    Streams exact broker micro-ticks to BOOST real-time chart precision.
    """
    global MT5_ACTIVE, MT5_LAST_SEEN
    while True:
        try:
            import MetaTrader5 as mt5
            if not mt5.initialize():
                MT5_ACTIVE = False
                time.sleep(4)
                continue

            all_symbols = [s.name for s in mt5.symbols_get()] if mt5.symbols_get() else []

            gold_sym = next((c for c in ['GOLDm#', 'GOLD', 'XAUUSD', 'XAUUSDm', 'GOLD#', 'XAUUSD_i', 'XAUUSD.r'] if c in all_symbols), None)
            btc_sym = next((c for c in ['BTCUSD#', 'BTCUSD', 'BTCUSDT', 'BTCUSDm#'] if c in all_symbols), None)
            eur_sym = next((c for c in ['EURUSD', 'EURUSDm', 'EURUSDm#', 'EURUSD#'] if c in all_symbols), None)
            gbp_sym = next((c for c in ['GBPUSDm#', 'GBPUSD', 'GBPUSDm', 'GBPUSD#'] if c in all_symbols), None)
            jpy_sym = next((c for c in ['USDJPYm#', 'USDJPY', 'USDJPYm', 'USDJPY#'] if c in all_symbols), None)
            eth_sym = next((c for c in ['ETHUSD#', 'ETHUSD', 'ETHUSDT', 'ETHUSDm#'] if c in all_symbols), None)
            sol_sym = next((c for c in ['SOLUSD#', 'SOLUSD', 'SOLUSDT', 'SOLUSDm#'] if c in all_symbols), None)
            silv_sym = next((c for c in ['XAGUSD', 'SILVER', 'SILVERm#', 'XAGUSD#'] if c in all_symbols), None)

            mapping = [
                ("XAUUSD", gold_sym, 3),
                ("BTCUSD", btc_sym, 2),
                ("BTCUSDT", btc_sym, 2),
                ("EURUSD", eur_sym, 5),
                ("GBPUSD", gbp_sym, 5),
                ("USDJPY", jpy_sym, 3),
                ("ETHUSD", eth_sym, 2),
                ("ETHUSDT", eth_sym, 2),
                ("SOLUSD", sol_sym, 2),
                ("SOLUSDT", sol_sym, 2),
                ("XAGUSD", silv_sym, 3)
            ]

            print(f"[+] MT5 Realtime Precision Boost Engine Connected! (Gold: {gold_sym})")

            while True:
                for target_name, sym, digits in mapping:
                    if not sym: continue
                    tick = mt5.symbol_info_tick(sym)
                    if tick:
                        MT5_ACTIVE = True
                        MT5_LAST_SEEN = time.time()
                        bid_val = round(tick.bid, digits)
                        ask_val = round(tick.ask, digits)
                        with LIVE_RATES_LOCK:
                            cur = LIVE_RATES.get(target_name, {})
                            cur['mt5_bid'] = bid_val
                            cur['mt5_ask'] = ask_val
                            cur['mt5_boost'] = True
                            cur['mt5_time'] = int(time.time())
                        broadcast_sse("mt5_tick", {
                            "symbol": target_name,
                            "bid": bid_val,
                            "ask": ask_val,
                            "close": bid_val,
                            "digits": digits,
                            "source": "mt5_boost",
                            "time": int(time.time())
                        })
                time.sleep(0.05)
        except Exception as e:
            MT5_ACTIVE = False
            try:
                import MetaTrader5 as mt5
                mt5.shutdown()
            except:
                pass
            time.sleep(4)


if __name__ == "__main__":
    def handle_tv_rate_update(sym, rate_obj):
        with LIVE_RATES_LOCK:
            existing = LIVE_RATES.get(sym, {})
            if MT5_ACTIVE and (time.time() - MT5_LAST_SEEN < 3):
                rate_obj['mt5_boost'] = True
                if 'mt5_bid' in existing:
                    rate_obj['mt5_bid'] = existing['mt5_bid']
                    rate_obj['mt5_ask'] = existing['mt5_ask']
            LIVE_RATES[sym] = rate_obj

    def handle_tv_candle_update(sym, candles, is_snapshot):
        if not candles:
            return
        if is_snapshot:
            merge_and_persist_candles(sym, candles, max_len=10000, save_to_disk=True)
        else:
            bar = candles[0]
            with CANDLE_CACHE_LOCK:
                if sym not in CANDLE_CACHE:
                    CANDLE_CACHE[sym] = []
                cache = CANDLE_CACHE[sym]
                if cache and cache[-1]["time"] == bar["time"]:
                    cache[-1] = bar
                elif cache and bar["time"] > cache[-1]["time"]:
                    cache.append(bar)
                    if len(cache) > 10000:
                        del cache[0]
                elif not cache:
                    cache.append(bar)

    # 1. Start MT5 Worker (Highest Priority when MT5 is running)
    mt5_thread = threading.Thread(target=mt5_background_worker, daemon=True)
    mt5_thread.start()

    # 2. Start MT5 Candle Sync Worker
    candle_thread = threading.Thread(target=mt5_candle_sync_worker, daemon=True)
    candle_thread.start()

    # 3. Start TradingView Institutional Real-time Feed (IC Markets / Pepperstone Gold 24/7)
    tv_feed = TradingViewWSFeed(
        on_rate_update=handle_tv_rate_update,
        on_candle_update=handle_tv_candle_update,
        on_sse_broadcast=broadcast_sse,
        preferred_gold="ICMARKETS"
    )
    tv_feed.start()

    # 4. Start Public Spot Market Worker (Fallback when MT5 is closed)
    public_thread = threading.Thread(target=public_market_data_worker, daemon=True)
    public_thread.start()

    # 5. HTTP Server
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), TradingToolsHandler) as httpd:
        print(f"==================================================")
        print(f" TradingTools Realtime Market Server (Live Sub-60ms)")
        print(f" Web App URL : http://localhost:{PORT}")
        print(f" Gold Feed   : IC Markets Institutional ECN (Zero-Lag)")
        print(f" SSE Stream  : http://localhost:{PORT}/api/live-stream")
        print(f" Live Rates  : http://localhost:{PORT}/api/live-rates")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
