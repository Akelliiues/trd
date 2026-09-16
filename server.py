"""
TradingTools Workstation Server (Multi-Source Real-Time Market Data Engine)
- Zero-cost 24/7 Real-Time Data Pipeline
- Priority 1: MetaTrader 5 (MT5) Realtime Ticks & Closed Candles
- Priority 2: Direct Public Streams (Binance WebSocket/REST for Crypto + Yahoo Finance for Forex & Commodities)
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

LIVE_RATES = {}
LIVE_RATES_LOCK = threading.Lock()
MT5_ACTIVE = False

PUBLIC_SYMBOLS_MAP = {
    'XAUUSD': {'yahoo': 'GC=F', 'digits': 3, 'spread': 0.15},
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

        super().do_POST()

    def do_GET(self):
        # API ส่งราคา Live Rates ล่าสุดจาก RAM Cache ระดับ Sub-Millisecond
        if self.path.startswith('/api/live-rates') or self.path.startswith('/api/rates'):
            with LIVE_RATES_LOCK:
                rates_data = dict(LIVE_RATES)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "rates": rates_data,
                "mt5_active": MT5_ACTIVE,
                "server_time": int(time.time())
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


def public_market_data_worker():
    """
    Zero-Cost 24/7 Universal Real-Time Market Data Engine:
    - Fetches Crypto from Binance Public API (sub-second live rates)
    - Fetches Forex & Commodities from Yahoo Finance API
    - Automatically creates smooth micro-ticks and persists updated M1 candles
    """
    global MT5_ACTIVE
    last_candle_sync = 0

    while True:
        try:
            # If MT5 is actively providing data, sleep and let MT5 handle it
            if MT5_ACTIVE:
                time.sleep(1)
                continue

            now = int(time.time())
            # 1. Fetch Binance Crypto (BTC, ETH, SOL)
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
                            LIVE_RATES[sym] = {
                                'symbol': sym,
                                'bid': round(price, 2),
                                'ask': round(price + spread, 2),
                                'close': round(price, 2),
                                'time': now,
                                'digits': 2,
                                'source': 'binance_live'
                            }
            except Exception:
                pass

            # 2. Fetch Forex & Commodities from Yahoo Finance
            for target_sym, cfg in PUBLIC_SYMBOLS_MAP.items():
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
                                LIVE_RATES[target_sym] = {
                                    'symbol': target_sym,
                                    'bid': round(price, digits),
                                    'ask': round(price + spread, digits),
                                    'close': round(price, digits),
                                    'time': now,
                                    'digits': digits,
                                    'source': 'yahoo_live'
                                }

                        # Periodic candle file update (every 30 seconds)
                        if now - last_candle_sync > 30 and 'timestamp' in result:
                            timestamps = result['timestamp']
                            quotes = result['indicators']['quote'][0]
                            candles = []
                            offset_sec = 7 * 3600 # UTC+7
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
                                out_path = os.path.join(BASE_DIR, "data", f"{target_sym}_1m.json")
                                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                                with open(out_path, "w", encoding="utf-8") as f:
                                    json.dump(candles[-600:], f)
                except Exception:
                    pass

            if now - last_candle_sync > 30:
                last_candle_sync = now

            time.sleep(1.5)
        except Exception as e:
            time.sleep(2)


def mt5_background_worker():
    """
    Dedicated background worker for MetaTrader 5 (MT5).
    Connects to local MT5 when running, sets MT5_ACTIVE = True.
    If MT5 is not running, gracefully sets MT5_ACTIVE = False so public data worker kicks in.
    """
    global MT5_ACTIVE
    while True:
        try:
            import MetaTrader5 as mt5
            if not mt5.initialize():
                MT5_ACTIVE = False
                time.sleep(5)
                continue

            MT5_ACTIVE = True
            print("[+] MT5 Realtime Engine connected successfully.")
            all_symbols = [s.name for s in mt5.symbols_get()] if mt5.symbols_get() else []

            gold_sym = next((c for c in ['GOLDm#', 'GOLD', 'XAUUSD', 'XAUUSDm', 'GOLD#'] if c in all_symbols), None)
            btc_sym = next((c for c in ['BTCUSD#', 'BTCUSD', 'BTCUSDT', 'BTCUSDm#'] if c in all_symbols), None)
            eur_sym = next((c for c in ['EURUSD', 'EURUSDm', 'EURUSDm#', 'EURUSD#'] if c in all_symbols), None)
            gbp_sym = next((c for c in ['GBPUSDm#', 'GBPUSD', 'GBPUSDm', 'GBPUSD#'] if c in all_symbols), None)
            jpy_sym = next((c for c in ['USDJPYm#', 'USDJPY', 'USDJPYm', 'USDJPY#'] if c in all_symbols), None)
            eth_sym = next((c for c in ['ETHUSD#', 'ETHUSD', 'ETHUSDT', 'ETHUSDm#'] if c in all_symbols), None)
            sol_sym = next((c for c in ['SOLUSD#', 'SOLUSD', 'SOLUSDT', 'SOLUSDm#'] if c in all_symbols), None)
            silv_sym = next((c for c in ['XAGUSD', 'SILVER', 'SILVERm#', 'XAGUSD#'] if c in all_symbols), None)

            mapping = [
                ("XAUUSD", gold_sym, 3),
                ("BTCUSDT", btc_sym, 2),
                ("EURUSD", eur_sym, 5),
                ("GBPUSD", gbp_sym, 5),
                ("USDJPY", jpy_sym, 3),
                ("ETHUSDT", eth_sym, 2),
                ("SOLUSDT", sol_sym, 2),
                ("XAGUSD", silv_sym, 3)
            ]

            while True:
                for target_name, sym, digits in mapping:
                    if not sym: continue
                    tick = mt5.symbol_info_tick(sym)
                    if tick:
                        with LIVE_RATES_LOCK:
                            LIVE_RATES[target_name] = {
                                'symbol': target_name,
                                'actual': sym,
                                'bid': round(tick.bid, digits),
                                'ask': round(tick.ask, digits),
                                'close': round(tick.bid, digits),
                                'time': tick.time,
                                'digits': digits,
                                'source': 'mt5_live'
                            }
                time.sleep(0.1)
        except Exception:
            MT5_ACTIVE = False
            try:
                import MetaTrader5 as mt5
                mt5.shutdown()
            except:
                pass
            time.sleep(5)


if __name__ == "__main__":
    # 1. Start Public Realtime Market Worker (Zero-Cost 24/7)
    public_thread = threading.Thread(target=public_market_data_worker, daemon=True)
    public_thread.start()

    # 2. Start MT5 Background Worker (Auto-connect if available)
    mt5_thread = threading.Thread(target=mt5_background_worker, daemon=True)
    mt5_thread.start()

    # 3. HTTP Server
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), TradingToolsHandler) as httpd:
        print(f"==================================================")
        print(f" TradingTools Workstation Server Running (Multi-Threaded)")
        print(f" Web App URL : http://localhost:{PORT}")
        print(f" Data Mode   : Hybrid (MT5 + Public Realtime Fallback)")
        print(f" MT5 Webhook : http://localhost:{PORT}/api/sync-trade")
        print(f" Live Rates  : http://localhost:{PORT}/api/live-rates")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
