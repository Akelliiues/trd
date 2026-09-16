"""
TradingTools Local Development & MT5 Webhook Server
รันเว็บเซิร์ฟเวอร์ Local พร้อม Webhook API สำหรับรับไม้เทรดจาก MT5 EA
"""

import http.server
import socketserver
import os
import json
import urllib.parse
import threading

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

LIVE_RATES = {}
LIVE_RATES_LOCK = threading.Lock()

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
                
                # บันทึกลงไฟล์ journal_synced.json
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
        # API ส่งราคา Tick สดจาก MetaTrader 5 (MT5) เข้าสู่หน้าเว็บทันทีในระดับ Sub-Millisecond จาก RAM Cache
        if self.path.startswith('/api/live-rates'):
            with LIVE_RATES_LOCK:
                rates_data = dict(LIVE_RATES)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "rates": rates_data}).encode('utf-8'))
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

def mt5_candle_sync_worker():
    """Sync closed M1 candles every 8 seconds in background without blocking tick loop."""
    import time
    offset_sec = 4 * 3600
    while True:
        time.sleep(8)
        try:
            import MetaTrader5 as mt5
            all_symbols = [s.name for s in mt5.symbols_get()] if mt5.symbols_get() else []
            gold_sym = next((c for c in ['GOLDm#', 'GOLD', 'XAUUSD', 'XAUUSDm', 'GOLD#'] if c in all_symbols), None)
            btc_sym = next((c for c in ['BTCUSD#', 'BTCUSD', 'BTCUSDT', 'BTCUSDm#'] if c in all_symbols), None)
            eur_sym = next((c for c in ['EURUSD', 'EURUSDm', 'EURUSDm#', 'EURUSD#'] if c in all_symbols), None)
            gbp_sym = next((c for c in ['GBPUSDm#', 'GBPUSD', 'GBPUSDm', 'GBPUSD#'] if c in all_symbols), None)
            jpy_sym = next((c for c in ['USDJPYm#', 'USDJPY', 'USDJPYm', 'USDJPY#'] if c in all_symbols), None)
            eth_sym = next((c for c in ['ETHUSD#', 'ETHUSD', 'ETHUSDT', 'ETHUSDm#'] if c in all_symbols), None)
            sol_sym = next((c for c in ['SOLUSD#', 'SOLUSD', 'SOLUSDT', 'SOLUSDm#'] if c in all_symbols), None)
            silv_sym = next((c for c in ['XAGUSD', 'SILVER', 'SILVERm#', 'XAGUSD#'] if c in all_symbols), None)

            sync_list = [
                ("XAUUSD", gold_sym, 3),
                ("BTCUSDT", btc_sym, 2),
                ("EURUSD", eur_sym, 5),
                ("GBPUSD", gbp_sym, 5),
                ("USDJPY", jpy_sym, 3),
                ("ETHUSDT", eth_sym, 2),
                ("SOLUSDT", sol_sym, 2),
                ("XAGUSD", silv_sym, 3)
            ]

            for target_name, sym, digits in sync_list:
                if not sym: continue
                rates = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_M1, 0, 300)
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
                    out_path = os.path.join(BASE_DIR, "data", f"{target_name}_1m.json")
                    existing = []
                    if os.path.exists(out_path):
                        try:
                            with open(out_path, "r", encoding="utf-8") as f:
                                existing = json.load(f)
                        except:
                            existing = []
                    by_time = {c['time']: c for c in existing}
                    for c in candles:
                        by_time[c['time']] = c
                    merged = [by_time[t] for t in sorted(by_time.keys())]
                    with open(out_path, "w", encoding="utf-8") as f:
                        json.dump(merged, f)
        except Exception as e:
            pass

def mt5_background_worker():
    """
    Dedicated persistent background worker for MetaTrader 5 (MT5).
    Keeps MT5 initialized continuously to provide instant ticks to the web app.
    High-frequency tick polling (~80ms) for ultra-accurate realtime prices.
    """
    import time
    while True:
        try:
            import MetaTrader5 as mt5
            if not mt5.initialize():
                print("[-] MT5 initialize failed. Retrying in 3 seconds...")
                time.sleep(3)
                continue

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
                # High frequency tick update (~80ms)
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
                                'digits': digits
                            }
                time.sleep(0.08)
        except Exception as e:
            print(f"[-] MT5 worker loop error: {e}")
            try:
                import MetaTrader5 as mt5
                mt5.shutdown()
            except:
                pass
            time.sleep(2)

if __name__ == "__main__":
    tick_thread = threading.Thread(target=mt5_background_worker, daemon=True)
    tick_thread.start()

    candle_thread = threading.Thread(target=mt5_candle_sync_worker, daemon=True)
    candle_thread.start()

    # Allow address reuse and handle requests concurrently
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), TradingToolsHandler) as httpd:
        print(f"==================================================")
        print(f" TradingTools Workstation Server Running (Multi-Threaded)")
        print(f" Web App URL : http://localhost:{PORT}")
        print(f" MT5 Webhook : http://localhost:{PORT}/api/sync-trade")
        print(f" MT5 Live Rate: http://localhost:{PORT}/api/live-rates")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
