#!/usr/bin/env python3
"""
Unified Market Time & Data Normalizer Engine
- Standardizes all timestamps from TradingView, Binance, Yahoo Finance, and MT5 into unified Thailand Time (UTC+7 / Asia/Bangkok).
- Anti-Jitter, Deduplication, and Spike Outlier Filter to prevent chart scale jumps.
"""

import time
import datetime

THAILAND_OFFSET_SECONDS = 7 * 3600 # UTC+7 = +25,200 seconds

def normalize_timestamp(raw_timestamp, source="TRADINGVIEW", mt5_server_offset_hours=3):
    """
    Converts raw timestamp from any provider into unified Thailand Timestamp (+7h).
    """
    if raw_timestamp is None:
        return int(time.time()) + THAILAND_OFFSET_SECONDS

    t = int(raw_timestamp)

    # If timestamp is in milliseconds (e.g. Binance raw 13 digits), convert to seconds
    if t > 100000000000:
        t = int(t / 1000)

    # Source 1: Standard UTC+0 feeds (TradingView, Binance, Yahoo, Crypto)
    if source.upper() in ["TRADINGVIEW", "BINANCE", "YAHOO", "CRYPTO", "PUBLIC_SPOT"]:
        return t + THAILAND_OFFSET_SECONDS

    # Source 2: MT5 Broker Server Time (EET/EEST, typically UTC+3 summer / UTC+2 winter)
    elif source.upper() in ["MT5", "METATRADER", "MT5_BOOST"]:
        # Thailand is UTC+7. If MT5 is UTC+3, diff is +4h. If UTC+2, diff is +5h.
        hours_diff = 7 - int(mt5_server_offset_hours)
        return t + (hours_diff * 3600)

    # Source 3: Already normalized
    elif source.upper() in ["NORMALIZED", "THAILAND_TIME"]:
        return t

    return t + THAILAND_OFFSET_SECONDS


def sanitize_and_deduplicate_candles(candles, symbol="XAUUSD", max_allowed_jump_pct=8.0):
    """
    Sanitizes candle history:
    1. Removes duplicate timestamps (keeps latest).
    2. Sorts strictly in ascending chronological order.
    3. Detects and repairs impossible price step jumps caused by data cross-contamination.
    """
    if not candles:
        return []

    # 1. Deduplicate by time
    time_map = {}
    for c in candles:
        if not c or "time" not in c or "close" not in c:
            continue
        time_map[c["time"]] = {
            "time": int(c["time"]),
            "open": float(c.get("open", c["close"])),
            "high": float(c.get("high", max(c["open"], c["close"]))),
            "low": float(c.get("low", min(c["open"], c["close"]))),
            "close": float(c["close"]),
            "volume": int(c.get("volume", 0))
        }

    sorted_candles = sorted(time_map.values(), key=lambda x: x["time"])
    if len(sorted_candles) < 2:
        return sorted_candles

    # 2. Outlier / Spike Filter
    # If a candle suddenly jumps > max_allowed_jump_pct and immediately stays or drops,
    # smooth out obvious corrupted cross-stitched bars.
    cleaned = [sorted_candles[0]]
    decimals = 3 if ("XAU" in symbol or "GOLD" in symbol or "XAG" in symbol) else (5 if ("EUR" in symbol or "GBP" in symbol) else 2)

    for i in range(1, len(sorted_candles)):
        prev = cleaned[-1]
        curr = sorted_candles[i]

        price_diff = abs(curr["open"] - prev["close"])
        pct_jump = (price_diff / prev["close"]) * 100.0 if prev["close"] > 0 else 0

        # If jump is unreasonably massive on an M1 candle (e.g. > 8% = $350 on Gold in 1 minute without market open gap)
        # Check if time diff is just 1 minute
        time_diff = curr["time"] - prev["time"]
        if time_diff <= 120 and pct_jump > max_allowed_jump_pct:
            # Shift the corrupted candle level to maintain smooth continuous trajectory
            delta = prev["close"] - curr["open"]
            curr["open"] = round(curr["open"] + delta, decimals)
            curr["high"] = round(curr["high"] + delta, decimals)
            curr["low"] = round(curr["low"] + delta, decimals)
            curr["close"] = round(curr["close"] + delta, decimals)

        cleaned.append(curr)

    return cleaned
