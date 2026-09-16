#!/usr/bin/env python3
"""
TradingTools Remote MT5 Sync Agent
รันสคริปต์นี้บนเครื่อง Windows ที่เปิด MT5 อยู่
เพื่อส่งราคาเรียลไทม์และแท่งเทียน M1 ไปยัง Cloud Server https://trd.ssotansum.com
"""

import time
import json
import os
import sys
import urllib.request
import urllib.error

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

SERVER_URL = os.environ.get("TRADINGTOOLS_SERVER", "https://trd.ssotansum.com")
# SERVER_URL = "http://localhost:3000" # สำหรับทดสอบบน Localhost

def sync_live_ticks_and_candles():
    try:
        import MetaTrader5 as mt5
    except ImportError:
        print("[-] MetaTrader5 package not installed. Run: pip install MetaTrader5")
        return

    if not mt5.initialize():
        print("[-] Cannot initialize MT5. Please make sure MetaTrader 5 is running.")
        return

    print(f"[✓] MT5 Connected successfully!")
    print(f"[✓] Streaming live market data to {SERVER_URL}...")

    symbols_map = {
        'XAUUSD': ['GOLDm#', 'XAUUSD', 'XAUUSDm', 'GOLD'],
        'EURUSD': ['EURUSD', 'EURUSDm', 'EURUSDm#'],
        'BTCUSDT': ['BTCUSD', 'BTCUSDm#', 'BTCUSDT']
    }

    all_mt5_symbols = [s.name for s in mt5.symbols_get()]
    actual_symbols = {}
    for target, candidates in symbols_map.items():
        matched = next((c for c in candidates if c in all_mt5_symbols), None)
        if matched:
            actual_symbols[target] = matched
            print(f" -> Mapping {target} -> {matched}")

    last_candle_sync = 0

    while True:
        try:
            # 1. Live Ticks Stream
            rates_payload = {}
            for sym_key, actual_sym in actual_symbols.items():
                info = mt5.symbol_info(actual_sym)
                tick = mt5.symbol_info_tick(actual_sym)
                if info and tick:
                    digits = 3 if 'XAU' in sym_key or 'GOLD' in actual_sym else info.digits
                    rates_payload[sym_key] = {
                        'symbol': sym_key,
                        'actual': actual_sym,
                        'bid': round(tick.bid, digits),
                        'ask': round(tick.ask, digits),
                        'close': round(tick.bid, digits),
                        'time': tick.time,
                        'digits': digits
                    }

            if rates_payload:
                req = urllib.request.Request(
                    f"{SERVER_URL}/api/push-rates",
                    data=json.dumps({"rates": rates_payload}).encode('utf-8'),
                    headers={'Content-Type': 'application/json'}
                )
                try:
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        pass
                except Exception as e:
                    pass

            # 2. Push M1 Candles (Every 10 seconds)
            now = time.time()
            if now - last_candle_sync >= 10:
                last_candle_sync = now
                offset_sec = 4 * 3600 # Thailand time offset
                for target_name, sym in actual_symbols.items():
                    digits = 3 if 'XAU' in target_name else 5
                    rates = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_M1, 0, 1500)
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
                        
                        req = urllib.request.Request(
                            f"{SERVER_URL}/api/push-candles",
                            data=json.dumps({"symbol": target_name, "candles": candles}).encode('utf-8'),
                            headers={'Content-Type': 'application/json'}
                        )
                        try:
                            with urllib.request.urlopen(req, timeout=5) as resp:
                                pass
                        except Exception as e:
                            pass

        except Exception as e:
            print(f"[-] Loop error: {e}")

        time.sleep(1.5)

if __name__ == "__main__":
    sync_live_ticks_and_candles()
