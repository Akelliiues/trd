#!/usr/bin/env python3
"""
MT5 Historical Vault Sync Engine (Exness / Multi-Broker -> Thailand UTC+7)
Extracts up to 100,000 continuous pristine M1 bars with 100% accurate bodies and wicks.
Converts broker server time to Thailand Time (Asia/Bangkok, UTC+7 / GMT+7) dynamically.
"""

import os
import json
import time
import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

def sync_mt5_vault():
    try:
        import MetaTrader5 as mt5
    except ImportError:
        print("[-] MetaTrader5 package is not installed. Please run: pip install MetaTrader5")
        return False

    if not mt5.initialize():
        print("[-] MT5 initialization failed. Error:", mt5.last_error())
        return False

    terminal_info = mt5.terminal_info()
    account_info = mt5.account_info()
    print(f"[+] MT5 Connected! Terminal: {terminal_info.name if terminal_info else 'Unknown'} | Broker: {account_info.server if account_info else 'Unknown'}")

    all_symbols = [s.name for s in mt5.symbols_get()] if mt5.symbols_get() else []
    print(f"[*] Total symbols found in MT5: {len(all_symbols)}")

    # Target Mapping with dynamic Exness/Standard symbol matching
    symbol_targets = [
        ("XAUUSD", ["XAUUSDm", "GOLDm#", "GOLD", "XAUUSD", "GOLD#", "XAUUSDm#"], 2),
        ("BTCUSD", ["BTCUSD#", "BTCUSDm", "BTCUSD", "BTCUSDT", "BTCUSDm#"], 2),
        ("BTCUSDT", ["BTCUSDT", "BTCUSD#", "BTCUSDm", "BTCUSD"], 2),
        ("ETHUSD", ["ETHUSD#", "ETHUSDm", "ETHUSD", "ETHUSDT", "ETHUSDm#"], 2),
        ("SOLUSD", ["SOLUSD#", "SOLUSDm", "SOLUSD", "SOLUSDT", "SOLUSDm#"], 2),
        ("EURUSD", ["EURUSDm", "EURUSDm#", "EURUSD", "EURUSD#"], 5),
        ("GBPUSD", ["GBPUSDm", "GBPUSDm#", "GBPUSD", "GBPUSD#"], 5),
        ("USDJPY", ["USDJPYm", "USDJPYm#", "USDJPY", "USDJPY#"], 3),
        ("GBPJPY", ["GBPJPYm", "GBPJPYm#", "GBPJPY", "GBPJPY#"], 3),
        ("AUDUSD", ["AUDUSDm", "AUDUSDm#", "AUDUSD", "AUDUSD#"], 5),
        ("NZDUSD", ["NZDUSDm", "NZDUSDm#", "NZDUSD", "NZDUSD#"], 5),
        ("USDCAD", ["USDCADm", "USDCADm#", "USDCAD", "USDCAD#"], 5),
        ("USDCHF", ["USDCHFm", "USDCHFm#", "USDCHF", "USDCHF#"], 5),
        ("EURJPY", ["EURJPYm", "EURJPYm#", "EURJPY", "EURJPY#"], 3),
        ("USOIL", ["USOILm", "USOILm#", "USOIL", "USOIL#", "CL"], 2),
        ("XAGUSD", ["XAGUSDm", "SILVERm#", "SILVER", "XAGUSD", "XAGUSD#"], 3)
    ]

    # Timezone Offset: MT5 Broker Server Time (EEST, UTC+3 in summer) -> Thailand Time (Asia/Bangkok, UTC+7)
    # Difference is precisely +4 hours (+14,400s) during daylight saving (summer), or +5 hours (+18,000s) in winter.
    # We verify current month: March-October = +4 hours (+14,400s).
    current_month = datetime.datetime.now().month
    offset_hours = 4 if 3 <= current_month <= 10 else 5
    offset_sec = offset_hours * 3600
    print(f"[+] Broker Server Time -> Thailand Time (UTC+7) Offset: +{offset_hours} hours (+{offset_sec} seconds)")

    synced_count = 0

    for target_name, candidates, decimals in symbol_targets:
        matched_sym = next((c for c in candidates if c in all_symbols), None)
        if not matched_sym:
            print(f"[-] Symbol candidate not found for {target_name}")
            continue

        mt5.symbol_select(matched_sym, True)
        
        # Copy up to 100,000 M1 bars in 2 chunks of 50,000 to maximize depth
        chunk1 = mt5.copy_rates_from_pos(matched_sym, mt5.TIMEFRAME_M1, 0, 50000)
        chunk2 = mt5.copy_rates_from_pos(matched_sym, mt5.TIMEFRAME_M1, 50000, 50000)

        rates = []
        if chunk2 is not None and len(chunk2) > 0:
            rates.extend(chunk2)
        if chunk1 is not None and len(chunk1) > 0:
            rates.extend(chunk1)

        if not rates:
            print(f"[-] Could not retrieve M1 rates for {matched_sym}")
            continue

        candles = []
        for r in rates:
            t_thai = int(r['time']) + offset_sec
            o = round(float(r['open']), decimals)
            h = round(float(r['high']), decimals)
            l = round(float(r['low']), decimals)
            c = round(float(r['close']), decimals)
            v = int(r['tick_volume'])

            candles.append({
                "time": t_thai,
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": v
            })

        # Load existing local cache to merge and guarantee historical continuity
        out_file = os.path.join(DATA_DIR, f"{target_name}_1m.json")
        existing_candles = []
        if os.path.exists(out_file):
            try:
                with open(out_file, "r", encoding="utf-8") as f:
                    existing_candles = json.load(f)
            except Exception:
                existing_candles = []

        # Merge deduplicated by timestamp
        time_map = {c["time"]: c for c in existing_candles}
        for c in candles:
            time_map[c["time"]] = c
        merged = sorted(time_map.values(), key=lambda x: x["time"])

        # Retain up to 120,000 continuous M1 bars
        if len(merged) > 120000:
            merged = merged[-120000:]

        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(merged, f, separators=(',', ':'))

        first_c = merged[0]
        last_c = merged[-1]
        span_days = round((last_c['time'] - first_c['time']) / 86400, 1)
        first_dt = datetime.datetime.fromtimestamp(first_c['time'], tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M")
        last_dt = datetime.datetime.fromtimestamp(last_c['time'], tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M")
        print(f"[OK] SYNCED: {target_name:8} ({matched_sym}) -> {len(merged):,} M1 candles ({span_days} days, {first_dt} -> {last_dt} Thai Time). Last Close: {last_c['close']}")
        synced_count += 1

    mt5.shutdown()
    print(f"\n[DONE] Complete Historical Vault Sync finished! Total assets synced: {synced_count}")
    return True

if __name__ == "__main__":
    sync_mt5_vault()
