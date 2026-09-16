"""
Market Data Pipeline & Ingestion Script
ดึงข้อมูลราคาจริงแท้ 100% จาก MetaTrader 5 (MT5) โบรกเกอร์ Exness / XM / IC Markets
และสำรองด้วย Binance API สำหรับ Crypto
"""

import os
import json
import time
import urllib.request

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

def find_best_mt5_symbol(mt5, candidates):
    """
    ค้นหาชื่อ Symbol ที่มีอยู่ใน MT5 อัตโนมัติ (รองรับ Exness, XM, IC Markets)
    เช่น Exness Standard มี m ต่อท้าย (XAUUSDm), Pro ไม่มี (XAUUSD), หรือ GOLDm#
    """
    all_symbols = [s.name for s in mt5.symbols_get()]
    all_symbols_upper = {s.upper(): s for s in all_symbols}

    for c in candidates:
        if c.upper() in all_symbols_upper:
            actual_name = all_symbols_upper[c.upper()]
            mt5.symbol_select(actual_name, True)
            return actual_name

    # ค้นหาแบบ Partial match
    for c in candidates:
        for s in all_symbols:
            if c.upper() in s.upper():
                mt5.symbol_select(s, True)
                return s

    return None

def fetch_from_mt5(target_name="XAUUSD", candidates=None, count=3000):
    """
    ดึงข้อมูลราคาจริงจาก MT5 ตรงจาก Broker ที่คุณใช้งาน (Exness, XM, etc.)
    """
    if candidates is None:
        candidates = [target_name]

    try:
        import MetaTrader5 as mt5
        if not mt5.initialize():
            print(f"[-] MT5 initialization failed: {mt5.last_error()}")
            return None

        actual_symbol = find_best_mt5_symbol(mt5, candidates)
        if not actual_symbol:
            print(f"[-] Symbol not found in MT5 for candidates: {candidates}")
            mt5.shutdown()
            return None

        print(f"[*] Found MT5 Symbol '{actual_symbol}' for {target_name}. Pulling {count} M1 candles...")
        mt5.symbol_select(actual_symbol, True)
        rates = mt5.copy_rates_from_pos(actual_symbol, mt5.TIMEFRAME_M1, 0, count)
        mt5.shutdown()

        if rates is None or len(rates) == 0:
            print(f"[-] Failed to get rates for {actual_symbol}")
            return None

        candles = []
        for r in rates:
            # rates structure: (time, open, high, low, close, tick_volume, spread, real_volume)
            t = int(r['time'])
            o = float(r['open'])
            h = float(r['high'])
            l = float(r['low'])
            c = float(r['close'])
            v = int(r['tick_volume'])

            decimals = 5 if ("EUR" in target_name or "GBP" in target_name) else (3 if ("XAU" in target_name or "GOLD" in target_name) else 2)
            candles.append({
                "time": t,
                "open": round(o, decimals),
                "high": round(h, decimals),
                "low": round(l, decimals),
                "close": round(c, decimals),
                "volume": v
            })

        output_file = os.path.join(DATA_DIR, f"{target_name}_1m.json")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(candles, f, indent=2)

        print(f"[+] Successfully saved {len(candles)} REAL candles from MT5 ({actual_symbol}) to {output_file}")
        return candles

    except ImportError:
        print("[-] MetaTrader5 library not installed. Using backup feed.")
        return None
    except Exception as e:
        print(f"[-] Error in fetch_from_mt5: {e}")
        return None

def fetch_binance_klines(symbol="BTCUSDT", interval="1m", limit=1500):
    """
    ดึงข้อมูลแท่งเทียนจริงจาก Binance Public API (Crypto)
    """
    print(f"[*] Fetching {symbol} ({interval}) from Binance Public API...")
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.loads(response.read().decode())
            candles = []
            for item in data:
                candles.append({
                    "time": int(item[0] / 1000),
                    "open": float(item[1]),
                    "high": float(item[2]),
                    "low": float(item[3]),
                    "close": float(item[4]),
                    "volume": float(item[5])
                })
            output_file = os.path.join(DATA_DIR, f"{symbol}_{interval}.json")
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(candles, f, indent=2)
            print(f"[+] Successfully saved {len(candles)} REAL candles from Binance to {output_file}")
            return candles
    except Exception as e:
        print(f"[-] Error fetching Binance data: {e}")
        return None

if __name__ == "__main__":
    print("======================================================")
    print(" Market Data Ingestion Pipeline (100% Real MT5 Rates)")
    print("======================================================")

    # 1. ดึงทองคำ (XAUUSD) จาก MT5 โบรคเกอร์ Exness / MT5 โดยตรง
    # รองรับสัญลักษณ์ Exness: XAUUSD, XAUUSDm, GOLD, GOLDm#
    fetch_from_mt5(target_name="XAUUSD", candidates=["XAUUSD", "XAUUSDm", "GOLDm#", "GOLD", "XAUUSD.m"], count=3000)

    # 2. ดึง Forex (EURUSD) จาก MT5 โบรคเกอร์ Exness / MT5 โดยตรง
    # รองรับสัญลักษณ์ Exness: EURUSD, EURUSDm, EURUSD.m
    fetch_from_mt5(target_name="EURUSD", candidates=["EURUSD", "EURUSDm", "EURUSD#", "EURUSD.m"], count=3000)

    # 3. ดึง Bitcoin (BTCUSDT / BTCUSD) จาก MT5 หรือ Binance API
    btc = fetch_from_mt5(target_name="BTCUSDT", candidates=["BTCUSD", "BTCUSDm", "BTCUSDT"], count=1500)
    if not btc:
        fetch_binance_klines("BTCUSDT", "1m", limit=1500)

    print("[OK] Market data synchronization complete!")
