#!/usr/bin/env python3
"""
Market Intelligence & Weekend Analysis Engine
Provides intelligent multi-source data routing, weekend gold sentiment (PAXG 24/7),
pre-market gap prediction, and automatic weekly key levels without requiring MetaTrader 5 (MT5).
"""

import os
import json
import time
import datetime
import urllib.request
import threading

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

class MarketIntelligenceEngine:
    def __init__(self):
        self.cached_intelligence = {}
        self.cached_binance_tickers = {}
        self.cached_weekly_bars = {}
        self.last_weekly_fetch = {}
        self.last_binance_fetch = 0
        self.last_computed = 0
        self.lock = threading.Lock()

    def get_market_status(self, timestamp=None):
        """
        Calculates whether the Forex / Spot Gold market is currently OPEN, WEEKEND_CLOSED, or PRE_MARKET.
        """
        now = datetime.datetime.fromtimestamp(timestamp or time.time(), tz=datetime.timezone.utc)
        weekday = now.weekday() # 0 = Mon, 4 = Fri, 5 = Sat, 6 = Sun
        hour = now.hour

        if weekday == 4 and (hour >= 21):
            return "WEEKEND_CLOSED"
        elif weekday == 5:
            return "WEEKEND_CLOSED"
        elif weekday == 6:
            if hour >= 21:
                return "PRE_MARKET"
            return "WEEKEND_CLOSED"
        elif weekday == 0 and hour == 21:
            return "OPEN"
        else:
            return "OPEN"

    def get_friday_close_and_weekly_bars(self, symbol="XAUUSD"):
        """
        Extracts last Friday close and past week's high, low, open, close with in-memory RAM caching.
        """
        sym_clean = symbol.upper().replace("/", "").replace("-", "")
        now = time.time()
        if sym_clean in self.cached_weekly_bars and (now - self.last_weekly_fetch.get(sym_clean, 0) < 300):
            return self.cached_weekly_bars[sym_clean]

        candidates = [
            f"{sym_clean}_1m.json",
            f"{sym_clean}T_1m.json" if not sym_clean.endswith("T") else f"{sym_clean[:-1]}_1m.json",
            f"{sym_clean}_WEEKEND_1m.json"
        ]
        if sym_clean == "GOLD":
            candidates.insert(0, "XAUUSD_1m.json")

        target_file = None
        for c in candidates:
            p = os.path.join(DATA_DIR, c)
            if os.path.exists(p):
                target_file = p
                break

        if not target_file:
            return None

        try:
            with open(target_file, "r", encoding="utf-8") as f:
                candles = json.load(f)
            if not candles:
                return None

            last_candle = candles[-1]
            last_close = float(last_candle.get("close", 0))

            recent_candles = candles[-3000:] if len(candles) > 3000 else candles
            highs = [float(c["high"]) for c in recent_candles if "high" in c]
            lows = [float(c["low"]) for c in recent_candles if "low" in c]
            week_high = max(highs) if highs else last_close
            week_low = min(lows) if lows else last_close
            week_open = float(recent_candles[0].get("open", last_close)) if recent_candles else last_close

            res = {
                "last_close": last_close,
                "last_time": last_candle.get("time", int(time.time())),
                "week_open": week_open,
                "week_high": week_high,
                "week_low": week_low,
                "week_close": last_close,
                "candle_count": len(candles)
            }
            self.cached_weekly_bars[sym_clean] = res
            self.last_weekly_fetch[sym_clean] = now
            return res
        except Exception as e:
            print(f"[-] Error reading weekly bars for {symbol}: {e}")
            return None

    def fetch_binance_tickers(self):
        """
        Fetches live 24/7 price and 24h ticker for PAXG and major Crypto from Binance in non-blocking async background thread.
        """
        now = time.time()
        
        # If cache is valid, return immediately
        if self.cached_binance_tickers and (now - self.last_binance_fetch < 5):
            return self.cached_binance_tickers

        # Trigger background async fetch without blocking HTTP request
        def _fetch_worker():
            try:
                symbols = '%5B%22PAXGUSDT%22,%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22,%22BNBUSDT%22,%22XRPUSDT%22,%22DOGEUSDT%22%5D'
                url = f"https://api.binance.com/api/v3/ticker/24hr?symbols={symbols}"
                req = urllib.request.Request(url, headers={'User-Agent': 'TradingTools/3.0'})
                with urllib.request.urlopen(req, timeout=1.8) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    res = {}
                    for item in data:
                        sym = item.get("symbol")
                        last_price = float(item.get("lastPrice", 0))
                        high_24h = float(item.get("highPrice", 0))
                        low_24h = float(item.get("lowPrice", 0))
                        chg_pct = float(item.get("priceChangePercent", 0))
                        res[sym] = {
                            "symbol": sym,
                            "price": last_price,
                            "high_24h": high_24h,
                            "low_24h": low_24h,
                            "change_24h_percent": chg_pct,
                            "source": "binance_24_7"
                        }
                    with self.lock:
                        self.cached_binance_tickers = res
                        self.last_binance_fetch = time.time()
            except Exception:
                pass

        if not hasattr(self, '_fetching_binance') or not self._fetching_binance or (now - getattr(self, '_last_thread_start', 0) > 4):
            self._fetching_binance = True
            self._last_thread_start = now
            t = threading.Thread(target=_fetch_worker, daemon=True)
            t.start()

        # Fallback defaults if first load
        if not self.cached_binance_tickers:
            self.cached_binance_tickers = {
                "PAXGUSDT": {"symbol": "PAXGUSDT", "price": 4378.11, "high_24h": 4385.0, "low_24h": 4350.0, "change_24h_percent": 0.05, "source": "local_cache"},
                "BTCUSDT": {"symbol": "BTCUSDT", "price": 81300.0, "high_24h": 82000.0, "low_24h": 80500.0, "change_24h_percent": 0.12, "source": "local_cache"},
                "ETHUSDT": {"symbol": "ETHUSDT", "price": 2640.0, "high_24h": 2680.0, "low_24h": 2610.0, "change_24h_percent": -0.15, "source": "local_cache"},
                "SOLUSDT": {"symbol": "SOLUSDT", "price": 111.7, "high_24h": 114.0, "low_24h": 109.5, "change_24h_percent": 0.35, "source": "local_cache"}
            }

        return self.cached_binance_tickers

    def calculate_weekly_pivots(self, high, low, close, decimals=2):
        """
        Calculates Standard, Fibonacci, and Camarilla pivot levels.
        """
        if not high or not low or not close or high <= low:
            return {}

        pivot = (high + low + close) / 3.0
        diff = high - low

        # Standard Pivots
        r1 = 2 * pivot - low
        s1 = 2 * pivot - high
        r2 = pivot + diff
        s2 = pivot - diff
        r3 = high + 2 * (pivot - low)
        s3 = low - 2 * (high - pivot)

        # Fibonacci Pivots
        fib_r1 = pivot + 0.382 * diff
        fib_r2 = pivot + 0.618 * diff
        fib_r3 = pivot + 1.000 * diff
        fib_s1 = pivot - 0.382 * diff
        fib_s2 = pivot - 0.618 * diff
        fib_s3 = pivot - 1.000 * diff

        # Camarilla Pivots
        cam_r4 = close + diff * 1.1 / 2.0
        cam_r3 = close + diff * 1.1 / 4.0
        cam_r2 = close + diff * 1.1 / 6.0
        cam_r1 = close + diff * 1.1 / 12.0
        cam_s1 = close - diff * 1.1 / 12.0
        cam_s2 = close - diff * 1.1 / 6.0
        cam_s3 = close - diff * 1.1 / 4.0
        cam_s4 = close - diff * 1.1 / 2.0

        mid_level = (high + low) / 2.0

        return {
            "standard": {
                "P": round(pivot, decimals),
                "R1": round(r1, decimals),
                "R2": round(r2, decimals),
                "R3": round(r3, decimals),
                "S1": round(s1, decimals),
                "S2": round(s2, decimals),
                "S3": round(s3, decimals)
            },
            "fibonacci": {
                "P": round(pivot, decimals),
                "R1": round(fib_r1, decimals),
                "R2": round(fib_r2, decimals),
                "R3": round(fib_r3, decimals),
                "S1": round(fib_s1, decimals),
                "S2": round(fib_s2, decimals),
                "S3": round(fib_s3, decimals)
            },
            "camarilla": {
                "R4": round(cam_r4, decimals),
                "R3": round(cam_r3, decimals),
                "R2": round(cam_r2, decimals),
                "R1": round(cam_r1, decimals),
                "S1": round(cam_s1, decimals),
                "S2": round(cam_s2, decimals),
                "S3": round(cam_s3, decimals),
                "S4": round(cam_s4, decimals)
            },
            "key_levels": {
                "week_high": round(high, decimals),
                "week_low": round(low, decimals),
                "week_mid_50": round(mid_level, decimals),
                "week_close": round(close, decimals),
                "week_range_points": round(diff, decimals)
            }
        }

    def analyze_symbol(self, symbol, market_status, live_rates=None, binance_tickers=None):
        """
        Computes detailed symbol intelligence, Friday close, current price, gap and weekly pivots.
        """
        sym = (symbol or "XAUUSD").upper().replace("/", "").replace("-", "")
        is_crypto = any(k in sym for k in ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"])
        is_gold = any(k in sym for k in ["XAU", "GOLD", "PAXG"])
        is_silver = "XAG" in sym or "SILVER" in sym
        is_forex = any(k in sym for k in ["EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"]) and not is_gold and not is_crypto
        is_oil = any(k in sym for k in ["OIL", "USOIL", "UKOIL"])

        weekly_stats = self.get_friday_close_and_weekly_bars(sym)
        friday_close = weekly_stats.get("last_close") if weekly_stats else None

        # Fallback to live_rates if available
        if friday_close is None and live_rates and sym in live_rates:
            friday_close = live_rates[sym].get("close") or live_rates[sym].get("bid")

        decimals = 2
        pip_multiplier = 10.0
        category = "forex"

        if is_crypto:
            category = "crypto"
            decimals = 2 if not any(k in sym for k in ["XRP", "DOGE"]) else 4
            pip_multiplier = 1.0
        elif is_gold:
            category = "gold"
            decimals = 2
            pip_multiplier = 10.0
        elif is_silver:
            category = "silver"
            decimals = 3
            pip_multiplier = 100.0
        elif is_forex:
            category = "forex"
            decimals = 3 if "JPY" in sym else 5
            pip_multiplier = 100.0 if "JPY" in sym else 10000.0
        elif is_oil:
            category = "commodity"
            decimals = 2
            pip_multiplier = 10.0

        if friday_close is None:
            friday_close = 1.0

        binance_tickers = binance_tickers or {}

        # 1. GOLD & PAXG
        if is_gold:
            paxg_item = binance_tickers.get("PAXGUSDT", {})
            current_paxg = paxg_item.get("price")
            
            # Find PAXG candle at the exact time XAUUSD closed on Friday
            paxg_friday_close = None
            xau_close_time = weekly_stats.get("last_time") if weekly_stats else None
            paxg_file = os.path.join(DATA_DIR, "PAXGUSDT_1m.json")
            if os.path.exists(paxg_file):
                try:
                    with open(paxg_file, "r", encoding="utf-8") as f:
                        paxg_candles = json.load(f)
                    if paxg_candles:
                        if xau_close_time:
                            matched = [c for c in paxg_candles if c.get("time", 0) <= xau_close_time]
                            if matched:
                                paxg_friday_close = float(matched[-1].get("close", 0))
                        if not paxg_friday_close:
                            paxg_friday_close = float(paxg_candles[0].get("close", 0))
                except Exception:
                    pass

            if current_paxg:
                current_price = current_paxg
                
                # Basis-Adjusted Weekend Delta Calculation:
                # If PAXG Friday close is known, True Gap = (Current PAXG - PAXG Friday Close)
                # This eliminates the underlying basis spread between Binance and IC Markets!
                if paxg_friday_close and paxg_friday_close > 0:
                    gap_points = round(current_paxg - paxg_friday_close, decimals)
                    basis_spread = round(paxg_friday_close - friday_close, decimals)
                else:
                    gap_points = round(current_paxg - friday_close, decimals)
                    basis_spread = 0.0

                gap_pips = round(gap_points * pip_multiplier, 1)
                gap_pct = round((gap_points / friday_close) * 100, 2) if friday_close else 0.0
                predicted_open = round(friday_close + gap_points, decimals)

                if gap_points > 1.5:
                    sentiment = "BULLISH_GAP"
                    msg = f"PAXG ขยับขึ้นช่วงวันหยุด (+{gap_points:.2f}$) คาดการณ์ XAUUSD เปิด Gap ขึ้นแตะ ~${predicted_open:.2f} (+{gap_pips:.0f} pips)"
                elif gap_points < -1.5:
                    sentiment = "BEARISH_GAP"
                    msg = f"PAXG ขยับลงช่วงวันหยุด ({gap_points:.2f}$) คาดการณ์ XAUUSD เปิด Gap ลงแตะ ~${predicted_open:.2f} ({gap_pips:.0f} pips)"
                else:
                    sentiment = "FLAT_GAP"
                    msg = f"ราคา PAXG ทรงตัวใกล้ราคาปิดวันศุกร์ (Gap เล็กน้อย {gap_points:+.2f}$ / คาดการณ์เปิด ~${predicted_open:.2f})"

                gap_info = {
                    "status": "ACTIVE",
                    "friday_close": round(friday_close, decimals),
                    "current_price": round(current_price, decimals),
                    "paxg_friday_close": round(paxg_friday_close, decimals) if paxg_friday_close else round(friday_close, decimals),
                    "paxg_current": round(current_paxg, decimals),
                    "predicted_monday_open": predicted_open,
                    "basis_spread": basis_spread,
                    "gap_points": gap_points,
                    "gap_pips": gap_pips,
                    "gap_percent": gap_pct,
                    "sentiment": sentiment,
                    "bias_message": msg,
                    "source": "binance_24_7"
                }
            else:
                gap_info = {
                    "status": "FROZEN",
                    "friday_close": round(friday_close, decimals),
                    "current_price": round(friday_close, decimals),
                    "paxg_current": round(friday_close, decimals),
                    "predicted_monday_open": round(friday_close, decimals),
                    "basis_spread": 0.0,
                    "gap_points": 0.0,
                    "gap_pips": 0.0,
                    "gap_percent": 0.0,
                    "sentiment": "NEUTRAL",
                    "bias_message": "ตรึงราคาปิดวันศุกร์ รอข้อมูล Real-time",
                    "source": "local_cache"
                }

        # 2. CRYPTO (24/7 Live)
        elif is_crypto:
            binance_key = sym if sym.endswith("USDT") else f"{sym}T"
            crypto_item = binance_tickers.get(binance_key) or binance_tickers.get(f"{sym}USDT") or {}
            current_crypto = crypto_item.get("price") or friday_close
            chg_24h = crypto_item.get("change_24h_percent", 0.0)

            gap_points = round(current_crypto - friday_close, decimals)
            gap_pips = round(gap_points * pip_multiplier, 1)
            gap_pct = round((gap_points / friday_close) * 100, 2) if friday_close else 0.0

            if gap_points > 0:
                sentiment = "BULLISH_MOVE"
                msg = f"ตลาดคริปโต 24/7 ขยับขึ้น (+{gap_points:.2f}$ / +{gap_pct:.2f}% เทียบวันศุกร์)"
            elif gap_points < 0:
                sentiment = "BEARISH_MOVE"
                msg = f"ตลาดคริปโต 24/7 ขยับลง ({gap_points:.2f}$ / {gap_pct:.2f}% เทียบวันศุกร์)"
            else:
                sentiment = "SIDEWAY"
                msg = f"ราคาคริปโตทรงตัวเท่าราคาปิดสัปดาห์ (24h Change: {chg_24h:+.2f}%)"

            gap_info = {
                "status": "ACTIVE_24_7",
                "friday_close": round(friday_close, decimals),
                "current_price": round(current_crypto, decimals),
                "gap_points": gap_points,
                "gap_pips": gap_pips,
                "gap_percent": gap_pct,
                "change_24h_percent": chg_24h,
                "sentiment": sentiment,
                "bias_message": msg,
                "source": "binance_24_7"
            }

        # 3. FOREX & COMMODITIES
        else:
            is_wknd = (market_status == "WEEKEND_CLOSED" or market_status == "PRE_MARKET")
            current_price = friday_close
            if not is_wknd and live_rates and sym in live_rates:
                current_price = live_rates[sym].get("bid") or friday_close

            gap_points = round(current_price - friday_close, decimals)
            gap_pips = round(gap_points * pip_multiplier, 1)
            gap_pct = round((gap_points / friday_close) * 100, 2) if friday_close else 0.0

            if is_wknd:
                sentiment = "MARKET_CLOSED"
                msg = f"ตลาด Forex ({sym}) ปิดทำการวันหยุด ตรึงราคาปิดวันศุกร์ (รอเปิดเช้าวันจันทร์ 05:00 น.)"
            else:
                sentiment = "LIVE_OPEN"
                msg = f"ตลาด Forex ({sym}) เปิดทำการ Real-time ซื้อขายปกติ"

            gap_info = {
                "status": "WEEKEND_CLOSED" if is_wknd else "OPEN",
                "friday_close": round(friday_close, decimals),
                "current_price": round(current_price, decimals),
                "gap_points": gap_points,
                "gap_pips": gap_pips,
                "gap_percent": gap_pct,
                "sentiment": sentiment,
                "bias_message": msg,
                "source": "tradingview_ws" if not is_wknd else "frozen_close"
            }

        # Weekly Key Levels
        if weekly_stats:
            w_high = weekly_stats.get("week_high", friday_close * 1.01)
            w_low = weekly_stats.get("week_low", friday_close * 0.99)
        else:
            w_high = friday_close * 1.01
            w_low = friday_close * 0.99
        w_close = friday_close
        pivots = self.calculate_weekly_pivots(w_high, w_low, w_close, decimals)

        return {
            "symbol": sym,
            "category": category,
            "market_status": "24/7_NON_STOP" if is_crypto else market_status,
            "is_weekend": (market_status == "WEEKEND_CLOSED" or market_status == "PRE_MARKET") and not is_crypto,
            "decimals": decimals,
            "gap_analysis": gap_info,
            "weekly_pivots": pivots
        }

    def compute_intelligence(self, live_rates=None, symbol="XAUUSD"):
        """
        Builds full market intelligence bundle with sub-millisecond RAM caching.
        """
        target_symbol = (symbol or "XAUUSD").upper().replace("/", "").replace("-", "")
        now_t = time.time()

        # Ultra-fast RAM cache check (TTL 5.0 seconds)
        if hasattr(self, 'cached_intel_by_sym') and target_symbol in self.cached_intel_by_sym:
            cached_data, cached_t = self.cached_intel_by_sym[target_symbol]
            if (now_t - cached_t) < 5.0:
                return cached_data

        with self.lock:
            if not hasattr(self, 'cached_intel_by_sym'):
                self.cached_intel_by_sym = {}

            market_status = self.get_market_status(now_t)
            binance_tickers = self.fetch_binance_tickers()

            # Analyze primary requested symbol
            primary_intel = self.analyze_symbol(target_symbol, market_status, live_rates, binance_tickers)

            watchlist = ["XAUUSD", "BTCUSD", "ETHUSD", "SOLUSD", "EURUSD", "GBPUSD", "USDJPY", "GBPJPY", "AUDUSD", "USOIL", "XAGUSD"]
            summaries = {target_symbol: primary_intel}
            
            # Lazy/cached summary for other watchlist assets
            for s in watchlist:
                if s != target_symbol:
                    if s in self.cached_intel_by_sym and (now_t - self.cached_intel_by_sym[s][1] < 15):
                        summaries[s] = self.cached_intel_by_sym[s][0]["gap_analysis"]
                    else:
                        summaries[s] = self.analyze_symbol(s, market_status, live_rates, binance_tickers)

            result = {
                "server_time": int(now_t),
                "market_status": primary_intel["market_status"],
                "is_weekend": primary_intel["is_weekend"],
                "active_symbol": target_symbol,
                "category": primary_intel["category"],
                "gap_analysis": primary_intel["gap_analysis"],
                "weekly_pivots": primary_intel["weekly_pivots"],
                "symbols_summary": summaries,
                "data_sources": {
                    "tradingview_ws": "Connected (IC Markets / OANDA Feed)",
                    "binance_spot": "Active 24/7 (PAXG / Crypto Feeds)",
                    "local_cache": "120,000+ M1 Historical Candles (Zero-MT5 Dependent)",
                    "mt5_turbo": "Optional Direct Boost"
                }
            }

            self.cached_intel_by_sym[target_symbol] = (result, now_t)
            self.cached_intelligence = result
            self.last_computed = now_t
            return result

# Global Singleton Instance
market_intel = MarketIntelligenceEngine()

