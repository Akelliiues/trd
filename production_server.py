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

# In-Memory Cache for Live Ticks & Market Prices (Multi-Source Sync)
LIVE_RATES_CACHE = {}
LIVE_RATES_LOCK = threading.Lock()
CANDLE_CACHE = {}
CANDLE_CACHE_LOCK = threading.Lock()
MT5_ACTIVE = False
MT5_LAST_SEEN = 0

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

        # 2. Remote MT5 Push Rates Endpoint (รับราคา Tick สดจากเครื่อง MT5 ของผู้ใช้มายัง Server)
        elif path == '/api/push-rates':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len)
                data = json.loads(body.decode('utf-8'))
                
                rates = data.get('rates', {})
                for sym, r in rates.items():
                    LIVE_RATES_CACHE[sym] = r
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"ok","updated":true}')
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode('utf-8'))
            return

        # 3. Remote MT5 Push Candles Endpoint (รับแท่งเทียน M1 ล่าสุดมาอัปเดตลง JSON ใน data/)
        elif path == '/api/push-candles':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len)
                data = json.loads(body.decode('utf-8'))
                
                symbol = data.get('symbol', 'XAUUSD')
                candles = data.get('candles', [])
                
                if candles and len(candles) > 0:
                    out_path = os.path.join(BASE_DIR, "data", f"{symbol}_1m.json")
                    with open(out_path, "w", encoding="utf-8") as f:
                        json.dump(candles, f, indent=2)
                        
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"ok","message":"Candles updated"}')
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode('utf-8'))
            return

        super().do_POST()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # API: ดึงราคา Live Rates ล่าสุด (ความเร็วสูงจาก RAM Cache ทันทีระดับ Sub-Millisecond)
        if path in ['/api/live-rates', '/api/rates']:
            with LIVE_RATES_LOCK:
                rates_data = dict(LIVE_RATES_CACHE)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "rates": rates_data,
                "mt5_active": MT5_ACTIVE and (time.time() - MT5_LAST_SEEN < 3),
                "server_time": int(time.time()),
                "primary_source": "mt5_live" if MT5_ACTIVE else "spot_market_direct"
            }).encode('utf-8'))
            return

        # API: ส่งแท่งเทียน M1 สดล่าสุดจาก MT5 / RAM Cache (Zero-Lag Sync)
        if path == '/api/candles':
            qs = urllib.parse.parse_qs(parsed_url.query)
            symbol = qs.get('symbol', ['XAUUSD'])[0].upper()
            try:
                count = int(qs.get('count', [600])[0])
            except Exception:
                count = 600

            candles = []
            with CANDLE_CACHE_LOCK:
                if symbol in CANDLE_CACHE and len(CANDLE_CACHE[symbol]) > 0:
                    candles = CANDLE_CACHE[symbol][-count:]

            if not candles:
                data_file = os.path.join(BASE_DIR, "data", f"{symbol}_1m.json")
                if os.path.exists(data_file):
                    try:
                        with open(data_file, "r", encoding="utf-8") as f:
                            candles = json.load(f)[-count:]
                    except Exception:
                        candles = []

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

            # 1. Binance Crypto & Spot Gold (PAXGUSDT) Live Prices (Realtime Sub-Second)
            try:
                req = urllib.request.Request("https://api.binance.com/api/v3/ticker/price?symbols=%5B%22PAXGUSDT%22,%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D", headers={'User-Agent': 'TradingTools/2.5.7'})
                with urllib.request.urlopen(req, timeout=3) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode('utf-8'))
                        for item in data:
                            sym = item['symbol']
                            px = float(item['price'])
                            if sym == 'PAXGUSDT':
                                # Spot Gold OTC Price (ตรงกับ Exness/XM)
                                if not is_mt5_live:
                                    with LIVE_RATES_LOCK:
                                        LIVE_RATES_CACHE['XAUUSD'] = {
                                            'symbol': 'XAUUSD',
                                            'bid': round(px, 3),
                                            'ask': round(px + 0.15, 3),
                                            'close': round(px, 3),
                                            'digits': 3,
                                            'time': now,
                                            'source': 'spot_gold_live'
                                        }
                            else:
                                spread = 0.5 if sym == 'BTCUSDT' else (0.1 if sym == 'ETHUSDT' else 0.02)
                                if not is_mt5_live:
                                    with LIVE_RATES_LOCK:
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

            # 2. เมื่อ MT5 ไม่ได้เปิด: ดึงแท่งเทียน M1 สดต่อเนื่องจาก Binance (Gold + Crypto) ทุกๆ 4 วินาที
            if not is_mt5_live and (now - last_candle_sync >= 4):
                last_candle_sync = now

                gold_candles = fetch_binance_klines("PAXGUSDT", count=600, digits=3)
                if gold_candles:
                    with CANDLE_CACHE_LOCK:
                        CANDLE_CACHE['XAUUSD'] = gold_candles
                    out_path = os.path.join(BASE_DIR, "data", "XAUUSD_1m.json")
                    with open(out_path, "w", encoding="utf-8") as f:
                        json.dump(gold_candles, f)

                btc_candles = fetch_binance_klines("BTCUSDT", count=600, digits=2)
                if btc_candles:
                    with CANDLE_CACHE_LOCK:
                        CANDLE_CACHE['BTCUSD'] = btc_candles
                        CANDLE_CACHE['BTCUSDT'] = btc_candles
                    with open(os.path.join(BASE_DIR, "data", "BTCUSD_1m.json"), "w", encoding="utf-8") as f:
                        json.dump(btc_candles, f)
                    with open(os.path.join(BASE_DIR, "data", "BTCUSDT_1m.json"), "w", encoding="utf-8") as f:
                        json.dump(btc_candles, f)

                eth_candles = fetch_binance_klines("ETHUSDT", count=600, digits=2)
                if eth_candles:
                    with CANDLE_CACHE_LOCK:
                        CANDLE_CACHE['ETHUSD'] = eth_candles
                        CANDLE_CACHE['ETHUSDT'] = eth_candles
                    with open(os.path.join(BASE_DIR, "data", "ETHUSD_1m.json"), "w", encoding="utf-8") as f:
                        json.dump(eth_candles, f)

                sol_candles = fetch_binance_klines("SOLUSDT", count=600, digits=2)
                if sol_candles:
                    with CANDLE_CACHE_LOCK:
                        CANDLE_CACHE['SOLUSD'] = sol_candles
                        CANDLE_CACHE['SOLUSDT'] = sol_candles
                    with open(os.path.join(BASE_DIR, "data", "SOLUSD_1m.json"), "w", encoding="utf-8") as f:
                        json.dump(sol_candles, f)

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
                rates = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_M1, 0, 600)
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
                    
                    with CANDLE_CACHE_LOCK:
                        CANDLE_CACHE[target_name] = candles

                    out_path = os.path.join(BASE_DIR, "data", f"{target_name}_1m.json")
                    with open(out_path, "w", encoding="utf-8") as f:
                        json.dump(candles, f)
        except Exception:
            pass


def mt5_live_ticks_worker():
    """Stream broker tick quotes from MT5 every 60ms into LIVE_RATES_CACHE."""
    global MT5_ACTIVE, MT5_LAST_SEEN
    while True:
        try:
            import MetaTrader5 as mt5
            if not mt5.initialize():
                MT5_ACTIVE = False
                time.sleep(4)
                continue

            MT5_ACTIVE = True
            MT5_LAST_SEEN = time.time()
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
                        with LIVE_RATES_LOCK:
                            LIVE_RATES_CACHE[target_name] = {
                                'symbol': target_name,
                                'actual': sym,
                                'bid': round(tick.bid, digits),
                                'ask': round(tick.ask, digits),
                                'close': round(tick.bid, digits),
                                'time': int(time.time()),
                                'digits': digits,
                                'source': 'mt5_live'
                            }
                MT5_ACTIVE = True
                MT5_LAST_SEEN = time.time()
                time.sleep(0.06)
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

    # 1. Start MT5 Background Workers if MetaTrader 5 is installed
    try:
        import MetaTrader5 as mt5
        threading.Thread(target=mt5_live_ticks_worker, daemon=True).start()
        threading.Thread(target=mt5_candle_sync_worker, daemon=True).start()
        print(" [+] MT5 Background Synchronization Workers Started")
    except ImportError:
        print(" [!] MetaTrader5 library not present. Relying on Direct Spot Market Feeds.")

    if not args.no_market_poll:
        # 2. Start Public Spot Market Data Poller Thread (Fallback)
        poller_thread = threading.Thread(target=public_market_price_poller, daemon=True)
        poller_thread.start()

    print("==========================================================")
    print(" [*] TradingTools Production Server Started")
    print(" [*] Target Domain : https://trd.ssotansum.com")
    print(f" [*] Local Bind    : http://0.0.0.0:{active_port}")
    print(" [*] PWA Ready     : Yes (Service Worker & Manifest Active)")
    print(" [*] MT5 Webhook   : POST /api/sync-trade")
    print(" [*] Live Rates    : GET  /api/rates, GET /api/live-rates")
    print("==========================================================")

    server = ThreadedHTTPServer(("0.0.0.0", active_port), ProductionHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Server shutting down...")
        server.shutdown()
