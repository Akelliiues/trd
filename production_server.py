#!/usr/bin/env python3
"""
TradingTools Workstation - High Performance Production Web & API Server
Domain: trd.ssotansum.com
Port: 3000 (Proxy via Nginx with HTTPS)
"""

import http.server
import socketserver
import os
import sys
import json
import urllib.parse
import threading
import time
import gzip
import io
import mimetypes

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

PORT = int(os.environ.get("PORT", 3000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Register additional MIME types for PWA & modern web
mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('application/javascript', '.js')

sys.path.insert(0, BASE_DIR)
from scripts.tradingview_feed import TradingViewWSFeed
import queue

# In-Memory Cache for Live Ticks & Market Prices (Multi-Source Sync)
LIVE_RATES_CACHE = {}
LIVE_RATES_LOCK = threading.Lock()
CANDLE_CACHE = {}
CANDLE_CACHE_LOCK = threading.Lock()
MT5_ACTIVE = False
MT5_LAST_SEEN = 0

# Server-Sent Events (SSE) Pub/Sub for Zero-Lag Sub-Millisecond Client Updates
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


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

class ProductionHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def guess_type(self, path):
        mime = super().guess_type(path)
        if path.endswith('.json'): return 'application/json'
        if path.endswith('.svg'): return 'image/svg+xml'
        if path.endswith('.webmanifest') or path.endswith('manifest.json'): return 'application/manifest+json'
        return mime

    def end_headers(self):
        # Security & PWA Headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        
        # PWA Service Worker & Force Update Header
        path = self.path.split('?')[0]
        if path == '/sw.js' or path == '/' or path == '/index.html' or path == '/manifest.json':
            self.send_header('Service-Worker-Allowed', '/')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        elif self.path.startswith('/api/') or self.path.startswith('/data/'):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        elif any(self.path.endswith(ext) for ext in ['.png', '.svg', '.ico', '.woff2']):
            self.send_header('Cache-Control', 'public, max-age=604800') # 7 Days Cache for Static Assets
            
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # 1. MT5 Trade Sync Webhook (รับผลการปิดออเดอร์จาก MT5 EA)
        if path == '/api/sync-trade':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len)
                trade_data = json.loads(body.decode('utf-8'))
                
                print(f"[MT5 Webhook] Synced trade #{trade_data.get('ticket')} - {trade_data.get('symbol')} {trade_data.get('type')} (${trade_data.get('profit')})")
                
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
                    json.dump(synced_trades, f, indent=2, ensure_ascii=False)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "ticket": trade_data.get('ticket')}).encode('utf-8'))
            except Exception as e:
                print(f"[-] Webhook error: {e}")
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode('utf-8'))
            return

        # 2. Remote MT5 Push Rates Endpoint (รับราคา Tick สดจากเครื่อง MT5 ของผู้ใช้มาเพิ่มความเรียลไทม์)
        elif path == '/api/push-rates':
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
                        cur = LIVE_RATES_CACHE.get(sym, {})
                        cur.update(r)
                        cur['mt5_bid'] = r.get('bid')
                        cur['mt5_ask'] = r.get('ask')
                        cur['mt5_boost'] = True
                        cur['mt5_time'] = r['time']
                        LIVE_RATES_CACHE[sym] = cur
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

        # 3. Remote MT5 Push Candles Endpoint (รับแท่งเทียน M1 ล่าสุดจาก MT5)
        elif path == '/api/push-candles':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len)
                data = json.loads(body.decode('utf-8'))
                
                symbol = data.get('symbol', 'XAUUSD')
                candles = data.get('candles', [])
                
                if candles and len(candles) > 0:
                    with CANDLE_CACHE_LOCK:
                        if symbol == "XAUUSD" and "XAUUSD" in CANDLE_CACHE and len(CANDLE_CACHE["XAUUSD"]) > 0:
                            # รักษาแท่งเทียน IC Markets ECN เป็นหลัก อัปเดตเฉพาะ volume ล่าสุดจาก MT5
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
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # API: Realtime SSE Stream (Sub-Millisecond Zero-Lag EventSource สำหรับหน้าจอชาร์ต)
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
                init_rates = dict(LIVE_RATES_CACHE)
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

        # API: ดึงราคา Live Rates ล่าสุด (ความเร็วสูงจาก RAM Cache ทันทีระดับ Sub-Millisecond)
        if path in ['/api/live-rates', '/api/rates']:
            with LIVE_RATES_LOCK:
                rates_data = dict(LIVE_RATES_CACHE)

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

        # API: ส่งแท่งเทียน M1 สดล่าสุดจาก MT5 / RAM Cache (Zero-Lag Sync พร้อมประวัติเต็มย้อนหลังระดับโปร 50,000 - 100,000 แท่ง)
        if path == '/api/candles':
            qs = urllib.parse.parse_qs(parsed_url.query)
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

        # API: สถานะระบบ (Health Check)
        if path == '/api/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "healthy",
                "app": "TradingTools Workstation",
                "domain": "trd.ssotansum.com",
                "timestamp": int(time.time()),
                "mt5_active": MT5_ACTIVE,
                "cached_symbols": list(LIVE_RATES_CACHE.keys())
            }).encode('utf-8'))
            return

        super().do_GET()

PUBLIC_SYMBOLS_MAP = {
    'EURUSD': {'yahoo': 'EURUSD=X', 'digits': 5, 'spread': 0.00015},
    'GBPUSD': {'yahoo': 'GBPUSD=X', 'digits': 5, 'spread': 0.00018},
    'USDJPY': {'yahoo': 'JPY=X', 'digits': 3, 'spread': 0.015},
    'AUDUSD': {'yahoo': 'AUDUSD=X', 'digits': 5, 'spread': 0.00016},
    'NZDUSD': {'yahoo': 'NZDUSD=X', 'digits': 5, 'spread': 0.00018},
    'XAGUSD': {'yahoo': 'SI=F', 'digits': 3, 'spread': 0.015},
    'USOIL':  {'yahoo': 'CL=F', 'digits': 2, 'spread': 0.03}
}

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


def public_market_price_poller():
    """
    Background Feed Poller: ดึงราคาและแท่งเทียนตลาดโลกสดจาก Binance (Spot Gold & Crypto) และ Yahoo Finance
    เพื่อให้กราฟบน Server ทำงานและกระพริบเรียลไทม์ 24/7 แม้ในขณะที่ไม่ได้เปิด MT5
    """
    import urllib.request
    last_candle_sync = 0

    while True:
        try:
            now = int(time.time())
            is_mt5_live = MT5_ACTIVE and (now - MT5_LAST_SEEN < 3)

            # 1. Binance Crypto Live Prices (Realtime Sub-Second for Crypto Pairs)
            try:
                req = urllib.request.Request("https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D", headers={'User-Agent': 'TradingTools/2.5.7'})
                with urllib.request.urlopen(req, timeout=3) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode('utf-8'))
                        for item in data:
                            sym = item['symbol']
                            px = float(item['price'])
                            spread = 0.5 if sym == 'BTCUSDT' else (0.1 if sym == 'ETHUSDT' else 0.02)
                            if not is_mt5_live:
                                with LIVE_RATES_LOCK:
                                    if sym not in LIVE_RATES_CACHE or LIVE_RATES_CACHE[sym].get('source') != 'tradingview_live':
                                        LIVE_RATES_CACHE[sym] = {
                                            'symbol': sym,
                                            'bid': round(px, 2),
                                            'ask': round(px + spread, 2),
                                            'close': round(px, 2),
                                            'digits': 2,
                                            'time': now,
                                            'source': 'binance_live'
                                        }
                                        if sym == 'BTCUSDT':
                                            LIVE_RATES_CACHE['BTCUSD'] = dict(LIVE_RATES_CACHE[sym], symbol='BTCUSD')
                                        elif sym == 'ETHUSDT':
                                            LIVE_RATES_CACHE['ETHUSD'] = dict(LIVE_RATES_CACHE[sym], symbol='ETHUSD')
                                        elif sym == 'SOLUSDT':
                                            LIVE_RATES_CACHE['SOLUSD'] = dict(LIVE_RATES_CACHE[sym], symbol='SOLUSD')
            except Exception:
                pass

            # 2. เมื่อ MT5 ไม่ได้เปิด: ดึงแท่งเทียน M1 สดต่อเนื่องจาก Binance (Crypto Backup) ทุกๆ 4 วินาที
            if not is_mt5_live and (now - last_candle_sync >= 4):
                last_candle_sync = now

                btc_candles = fetch_binance_klines("BTCUSDT", count=1000, digits=2)
                if btc_candles:
                    merge_and_persist_candles("BTCUSD", btc_candles, max_len=10000, save_to_disk=True)
                    merge_and_persist_candles("BTCUSDT", btc_candles, max_len=10000, save_to_disk=True)

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

            # 3. Forex & Commodities Live Prices (Yahoo Finance Real Market Data)
            for target_sym, cfg in PUBLIC_SYMBOLS_MAP.items():
                if is_mt5_live and target_sym in LIVE_RATES_CACHE:
                    continue

                yahoo_sym = cfg['yahoo']
                digits = cfg['digits']
                spread = cfg['spread']
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}?interval=1m&range=1d"
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        data = json.loads(resp.read().decode('utf-8'))
                        result = data['chart']['result'][0]
                        meta = result['meta']
                        price = meta.get('regularMarketPrice')
                        if price is not None:
                            with LIVE_RATES_LOCK:
                                if not is_mt5_live or target_sym not in LIVE_RATES_CACHE:
                                    LIVE_RATES_CACHE[target_sym] = {
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
                                with open(out_path, "w", encoding="utf-8") as f:
                                    json.dump(candles[-600:], f)
                except Exception:
                    pass

            time.sleep(1.5)
        except Exception:
            time.sleep(2)

def mt5_candle_sync_worker():
    """Sync closed M1 candles from MT5 directly into RAM CANDLE_CACHE & data/{symbol}_1m.json every 1.5 seconds."""
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


def mt5_live_ticks_worker():
    """Stream broker micro-ticks from MT5 to BOOST real-time chart precision."""
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
                            cur = LIVE_RATES_CACHE.get(target_name, {})
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
        except Exception:
            MT5_ACTIVE = False
            time.sleep(3)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="TradingTools Production Server")
    parser.add_argument("--port", "-p", type=int, default=PORT, help="Port to bind (default: 3000)")
    parser.add_argument("--no-market-poll", action="store_true", help="Disable background market poller")
    args = parser.parse_args()

    active_port = args.port

    # 1. Start MT5 Background Workers if MetaTrader 5 is installed (For Realtime Precision Boost)
    try:
        import MetaTrader5 as mt5
        threading.Thread(target=mt5_live_ticks_worker, daemon=True).start()
        threading.Thread(target=mt5_candle_sync_worker, daemon=True).start()
        print(" [+] MT5 Real-time Precision Boost Active")
    except ImportError:
        print(" [!] MetaTrader5 library not present. Relying on Direct Spot Market Feeds.")

    def handle_tv_rate_update(sym, rate_obj):
        with LIVE_RATES_LOCK:
            existing = LIVE_RATES_CACHE.get(sym, {})
            if MT5_ACTIVE and (time.time() - MT5_LAST_SEEN < 3):
                rate_obj['mt5_boost'] = True
                if 'mt5_bid' in existing:
                    rate_obj['mt5_bid'] = existing['mt5_bid']
                    rate_obj['mt5_ask'] = existing['mt5_ask']
            LIVE_RATES_CACHE[sym] = rate_obj

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

    # 2. Start TradingView Institutional Real-time Feed (IC Markets / Pepperstone Gold 24/7)
    tv_feed = TradingViewWSFeed(
        on_rate_update=handle_tv_rate_update,
        on_candle_update=handle_tv_candle_update,
        on_sse_broadcast=broadcast_sse,
        preferred_gold="ICMARKETS"
    )
    tv_feed.start()

    if not args.no_market_poll:
        # 3. Start Public Spot Market Data Poller Thread (Fallback)
        poller_thread = threading.Thread(target=public_market_price_poller, daemon=True)
        poller_thread.start()

    print("==========================================================")
    print(" [*] TradingTools Production Server Started")
    print(" [*] Target Domain : https://trd.ssotansum.com")
    print(f" [*] Local Bind    : http://0.0.0.0:{active_port}")
    print(" [*] Gold Feed     : IC Markets Institutional ECN (Zero-Lag)")
    print(" [*] SSE Streaming : GET  /api/live-stream (Sub-50ms push)")
    print(" [*] MT5 Webhook   : POST /api/sync-trade")
    print(" [*] Live Rates    : GET  /api/rates, GET /api/live-rates")
    print("==========================================================")


    server = ThreadedHTTPServer(("0.0.0.0", active_port), ProductionHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Server shutting down...")
        server.shutdown()
