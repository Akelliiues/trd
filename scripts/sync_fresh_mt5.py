import MetaTrader5 as mt5
import os
import json
import time
from datetime import datetime, timezone

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

def sync_data():
    if not mt5.initialize():
        print("[-] MT5 initialization failed:", mt5.last_error())
        return False

    all_symbols = [s.name for s in mt5.symbols_get()] if mt5.symbols_get() else []
    
    # Symbols matching
    gold_sym = next((c for c in ['GOLDm#', 'GOLD', 'XAUUSD', 'XAUUSDm', 'GOLD#'] if c in all_symbols), None)
    eur_sym = next((c for c in ['EURUSD', 'EURUSDm', 'EURUSDm#', 'EURUSD#'] if c in all_symbols), None)
    gbp_sym = next((c for c in ['GBPUSDm#', 'GBPUSD', 'GBPUSDm', 'GBPUSD#'] if c in all_symbols), None)
    jpy_sym = next((c for c in ['USDJPYm#', 'USDJPY', 'USDJPYm', 'USDJPY#'] if c in all_symbols), None)
    btc_sym = next((c for c in ['BTCUSD#', 'BTCUSD', 'BTCUSDT', 'BTCUSDm#'] if c in all_symbols), None)
    eth_sym = next((c for c in ['ETHUSD#', 'ETHUSD', 'ETHUSDT', 'ETHUSDm#'] if c in all_symbols), None)
    sol_sym = next((c for c in ['SOLUSD#', 'SOLUSD', 'SOLUSDT', 'SOLUSDm#'] if c in all_symbols), None)
    silv_sym = next((c for c in ['XAGUSD', 'SILVER', 'SILVERm#', 'XAGUSD#'] if c in all_symbols), None)

    # คำนวณความต่างเวลาที่แน่นอน: MT5 Server Time (GMT+3) -> Thailand Time (GMT+7) = +4 ชั่วโมง (+14,400s)
    offset_sec = 4 * 3600
    ref_sym = gold_sym or eur_sym or btc_sym
    if ref_sym:
        tick = mt5.symbol_info_tick(ref_sym)
        if tick:
            local_thai_now = int(time.time()) + (7 * 3600)
            hours_diff = round((local_thai_now - tick.time) / 3600)
            offset_sec = hours_diff * 3600
            print(f"[*] Exact Offset from MT5 Server to Thailand Time: +{hours_diff} hours ({offset_sec}s)")

    targets = [
        ("XAUUSD", gold_sym, 3),
        ("EURUSD", eur_sym, 5),
        ("GBPUSD", gbp_sym, 5),
        ("USDJPY", jpy_sym, 3),
        ("BTCUSD", btc_sym, 2),
        ("BTCUSDT", btc_sym, 2),
        ("ETHUSD", eth_sym, 2),
        ("ETHUSDT", eth_sym, 2),
        ("SOLUSD", sol_sym, 2),
        ("SOLUSDT", sol_sym, 2),
        ("XAGUSD", silv_sym, 3)
    ]

    for target_name, sym, digits in targets:
        if not sym:
            continue
        mt5.symbol_select(sym, True)
        # ดึงแบบ 2 Chunks (0-50,000 และ 50,000-100,000) เพื่อให้ได้ประวัติระดับโปร 100,000 แท่ง
        rates1 = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_M1, 0, 50000)
        rates2 = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_M1, 50000, 50000)
        
        rates = []
        if rates2 is not None and len(rates2) > 0:
            rates.extend(rates2)
        if rates1 is not None and len(rates1) > 0:
            rates.extend(rates1)

        if not rates:
            print(f"[-] Failed to get rates for {sym}")
            continue

        candles = []
        for r in rates:
            # แปลงเวลา Server Time ให้เป็น Thailand Time
            t_thai = int(r['time']) + offset_sec
            o = round(float(r['open']), digits)
            h = round(float(r['high']), digits)
            l = round(float(r['low']), digits)
            c = round(float(r['close']), digits)
            v = int(r['tick_volume'])

            candles.append({
                "time": t_thai,
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": v
            })

        out_file = os.path.join(DATA_DIR, f"{target_name}_1m.json")
        existing_candles = []
        if os.path.exists(out_file):
            try:
                with open(out_file, "r", encoding="utf-8") as f:
                    existing_candles = json.load(f)
            except Exception:
                existing_candles = []

        # ผสานข้อมูลย้อนหลังเข้าด้วยกัน (สะสมประวัติศาสตร์ย้อนหลังระดับโปร)
        time_map = {c["time"]: c for c in existing_candles}
        for c in candles:
            time_map[c["time"]] = c
        merged = sorted(time_map.values(), key=lambda x: x["time"])
        if len(merged) > 120000:
            merged = merged[-120000:]

        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(merged, f, separators=(',', ':'))

        last_c = merged[-1]
        first_c = merged[0]
        span_days = round((last_c['time'] - first_c['time']) / 86400, 1)
        print(f"[+] PRO SYNC: {target_name} ({sym}) -> {len(merged)} candles ({span_days} days / {span_days/30:.1f} months). Latest: {last_c['close']}")

    mt5.shutdown()
    return True

if __name__ == "__main__":
    sync_data()
