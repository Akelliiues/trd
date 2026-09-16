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

    all_symbols = [s.name for s in mt5.symbols_get()]
    
    # 1. Match Gold
    gold_sym = None
    for c in ['GOLDm#', 'XAUUSD', 'XAUUSDm', 'GOLD']:
        if c in all_symbols:
            gold_sym = c
            break

    # 2. Match EURUSD
    eur_sym = None
    for c in ['EURUSD', 'EURUSDm', 'EURUSDm#']:
        if c in all_symbols:
            eur_sym = c
            break

    # 3. Match BTC
    btc_sym = None
    for c in ['BTCUSD', 'BTCUSDm#', 'BTCUSDT']:
        if c in all_symbols:
            btc_sym = c
            break

    # คำนวณความต่างเวลาที่แน่นอน: MT5 Server Time (GMT+3) -> Thailand Time (GMT+7) = +4 ชั่วโมง (+14,400s)
    # ทดสอบจาก Tick ล่าสุดเทียบกับเวลาประเทศไทย
    now_local = datetime.now()
    tick_gold = mt5.symbol_info_tick(gold_sym or 'GOLDm#')
    
    if tick_gold:
        server_dt = datetime.fromtimestamp(tick_gold.time, timezone.utc)
        # ความต่างชั่วโมง: เช่น Local 17:05, Server 13:05 -> 17 - 13 = 4
        diff_hours = (now_local.hour - server_dt.hour) % 24
        if diff_hours > 12:
            diff_hours -= 24
        offset_sec = diff_hours * 3600
        print(f"[*] Exact Offset from MT5 Server to Thailand Time: +{diff_hours} hours ({offset_sec}s)")
    else:
        offset_sec = 4 * 3600

    targets = [
        ("XAUUSD", gold_sym, 3),
        ("EURUSD", eur_sym, 5),
        ("BTCUSDT", btc_sym, 2)
    ]

    for target_name, sym, digits in targets:
        if not sym:
            continue
        mt5.symbol_select(sym, True)
        rates = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_M1, 0, 3000)
        if rates is None or len(rates) == 0:
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
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(candles, f, indent=2)

        last_c = candles[-1]
        t_str = datetime.fromtimestamp(last_c['time'], timezone.utc).strftime('%H:%M')
        print(f"[+] Synced {target_name} ({sym}) -> {len(candles)} candles. Latest Close: {last_c['close']} at Thailand Time: {t_str}")

    mt5.shutdown()
    return True

if __name__ == "__main__":
    sync_data()
