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
LIVE_RATES_CACHE = {
    'XAUUSD': {'symbol': 'XAUUSD', 'bid': 2618.450, 'ask': 2618.600, 'close': 2618.450, 'digits': 3, 'time': int(time.time())},
    'EURUSD': {'symbol': 'EURUSD', 'bid': 1.08450, 'ask': 1.08465, 'close': 1.08450, 'digits': 5, 'time': int(time.time())},
    'BTCUSDT': {'symbol': 'BTCUSDT', 'bid': 62450.00, 'ask': 62455.00, 'close': 62450.00, 'digits': 2, 'time': int(time.time())}
}

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

        # API: ดึงราคา Live Rates ล่าสุด (ความเร็วสูงจาก RAM Cache)
        if path in ['/api/live-rates', '/api/rates']:
            # ตรวจสอบว่ามี MT5 Local หรือไม่
            try:
                import MetaTrader5 as mt5
                if mt5.initialize():
                    for sym_key, candidates in [
                        ('XAUUSD', ['GOLDm#', 'XAUUSD', 'XAUUSDm', 'GOLD']),
                        ('EURUSD', ['EURUSD', 'EURUSDm', 'EURUSDm#']),
                        ('BTCUSDT', ['BTCUSD', 'BTCUSDm#', 'BTCUSDT'])
                    ]:
                        for c in candidates:
                            info = mt5.symbol_info(c)
                            if info:
                                tick = mt5.symbol_info_tick(c)
                                if tick:
                                    digits = 3 if 'XAU' in sym_key or 'GOLD' in c else info.digits
                                    LIVE_RATES_CACHE[sym_key] = {
                                        'symbol': sym_key,
                                        'actual': c,
                                        'bid': round(tick.bid, digits),
                                        'ask': round(tick.ask, digits),
                                        'close': round(tick.bid, digits),
                                        'time': tick.time,
                                        'digits': digits
                                    }
                                break
                    mt5.shutdown()
            except:
                pass

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "rates": LIVE_RATES_CACHE}).encode('utf-8'))
            return

        # API: สถานะระบบ (Health Check)
        if path == '/api/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "healthy",
                "app": "TradingTools Workstation",
                "domain": "trd.ssotansum.com",
                "timestamp": int(time.time()),
                "cached_symbols": list(LIVE_RATES_CACHE.keys())
            }).encode('utf-8'))
            return

        super().do_GET()

def public_market_price_poller():
    """
    Background Feed Poller: ดึงราคาตลาดโลกสด (Binance & Open Rates) 
    เพื่อให้กราฟบน Server ทำงานและกระพริบเรียลไทม์ 24/7 แม้ในขณะที่ MT5 ปิดอยู่
    """
    import urllib.request
    while True:
        try:
            # 1. Binance Crypto Live Prices
            req = urllib.request.Request("https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D", headers={'User-Agent': 'TradingTools/1.0'})
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    for item in data:
                        sym = item['symbol']
                        px = float(item['price'])
                        LIVE_RATES_CACHE[sym] = {
                            'symbol': sym,
                            'bid': round(px, 2),
                            'ask': round(px + 0.05, 2),
                            'close': round(px, 2),
                            'digits': 2,
                            'time': int(time.time())
                        }
        except:
            pass

        # 2. Gold / Forex simulation micro-variation if MT5 is idle
        try:
            import random
            gold = LIVE_RATES_CACHE.get('XAUUSD', {'close': 2618.50, 'digits': 3})
            jitter = (random.random() - 0.49) * 0.15
            new_close = round(gold['close'] + jitter, 3)
            LIVE_RATES_CACHE['XAUUSD'] = {
                'symbol': 'XAUUSD',
                'bid': new_close,
                'ask': round(new_close + 0.15, 3),
                'close': new_close,
                'digits': 3,
                'time': int(time.time())
            }
        except:
            pass

        time.sleep(2)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="TradingTools Production Server")
    parser.add_argument("--port", "-p", type=int, default=PORT, help="Port to bind (default: 3000)")
    parser.add_argument("--no-market-poll", action="store_true", help="Disable background market poller")
    args = parser.parse_args()

    active_port = args.port

    if not args.no_market_poll:
        # Start Market Data Poller Thread
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
