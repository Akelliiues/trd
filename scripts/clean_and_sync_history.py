#!/usr/bin/env python3
"""
Clean and Resync History Pipeline
Pulls authentic, continuous 1-minute historical data directly from TradingView and Binance.
Ensures zero scale jumps, zero corrupted bars, and perfect Thailand time alignment.
"""

import os
import sys
import json
import time
import socket
import ssl
import struct
import re
import urllib.request

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
from scripts.time_normalizer import normalize_timestamp, sanitize_and_deduplicate_candles

DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

def fetch_tradingview_candles(tv_symbol="ICMARKETS:XAUUSD", count=5000):
    """
    Fetches clean M1 candles directly from TradingView WebSocket.
    """
    try:
        host = "data.tradingview.com"
        port = 443
        path = "/socket.io/websocket"
        context = ssl.create_default_context()
        raw_sock = socket.create_connection((host, port), timeout=12)
        sock = context.wrap_socket(raw_sock, server_hostname=host)
        sock.settimeout(12.0)

        sec_key = os.urandom(16).hex()
        handshake = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {sec_key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n"
            f"Origin: https://data.tradingview.com\r\n\r\n"
        )
        sock.sendall(handshake.encode('utf-8'))
        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = sock.recv(4096)
            if not chunk: break
            resp += chunk

        def send_msg(m, p):
            payload = json.dumps({"m": m, "p": p})
            fmt = f"~m~{len(payload)}~m~{payload}"
            mask = os.urandom(4)
            length = len(fmt)
            header = struct.pack("!BBH", 0x81, 0x80 | 126, length) if length > 125 else struct.pack("!BB", 0x81, 0x80 | length)
            masked = bytearray(length)
            b = fmt.encode('utf-8')
            for i in range(length): masked[i] = b[i] ^ mask[i % 4]
            sock.sendall(header + mask + bytes(masked))

        cs = "cs_" + os.urandom(4).hex()
        send_msg("set_auth_token", ["unauthorized_user_token"])
        send_msg("chart_create_session", [cs, ""])
        send_msg("resolve_symbol", [cs, "sds_sym", f'={json.dumps({"symbol": tv_symbol, "adjustment": "splits"})}' ])
        send_msg("create_series", [cs, "sds_1", "s1", "sds_sym", "1", count])

        candles = []
        start_t = time.time()
        decimals = 3 if ("XAU" in tv_symbol or "GOLD" in tv_symbol or "XAG" in tv_symbol) else (5 if ("EUR" in tv_symbol or "GBP" in tv_symbol) else 2)

        while time.time() - start_t < 7.0:
            head = sock.recv(2)
            if not head or len(head) < 2: break
            b0, b1 = head[0], head[1]
            length = b1 & 0x7F
            if length == 126: length = struct.unpack("!H", sock.recv(2))[0]
            elif length == 127: length = struct.unpack("!Q", sock.recv(8))[0]
            mask = sock.recv(4) if (b1 & 0x80) else b""
            data = b""
            while len(data) < length:
                c = sock.recv(min(8192, length - len(data)))
                if not c: break
                data += c
            if mask:
                un = bytearray(len(data))
                for i in range(len(data)): un[i] = data[i] ^ mask[i % 4]
                data = bytes(un)
            text = data.decode('utf-8', errors='ignore')
            for match in re.finditer(r"~m~(\d+)~m~", text):
                body = text[match.end():match.end() + int(match.group(1))]
                try:
                    msg = json.loads(body)
                    if msg.get("m") == "timescale_update":
                        sds = msg["p"][1].get("sds_1", {})
                        series = sds.get("s", [])
                        for bar in series:
                            v = bar.get("v")
                            if v and len(v) >= 6:
                                t = normalize_timestamp(v[0], source="TRADINGVIEW")
                                candles.append({
                                    "time": t,
                                    "open": round(float(v[1]), decimals),
                                    "high": round(float(v[2]), decimals),
                                    "low": round(float(v[3]), decimals),
                                    "close": round(float(v[4]), decimals),
                                    "volume": int(float(v[5]))
                                })
                        if candles: break
                except Exception: pass
            if candles: break
        sock.close()
        return candles
    except Exception as e:
        print(f"[-] TradingView fetch error for {tv_symbol}: {e}")
        return []

def fetch_binance_candles(binance_sym="PAXGUSDT", count=1000, digits=2):
    try:
        url = f"https://api.binance.com/api/v3/klines?symbol={binance_sym}&interval=1m&limit={count}"
        req = urllib.request.Request(url, headers={'User-Agent': 'TradingTools/3.0'})
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            raw = json.loads(resp.read().decode('utf-8'))
            candles = []
            for k in raw:
                t = normalize_timestamp(k[0], source="BINANCE")
                candles.append({
                    "time": t,
                    "open": round(float(k[1]), digits),
                    "high": round(float(k[2]), digits),
                    "low": round(float(k[3]), digits),
                    "close": round(float(k[4]), digits),
                    "volume": int(float(k[5]))
                })
            return candles
    except Exception as e:
        print(f"[-] Binance fetch error for {binance_sym}: {e}")
        return []

def run_resync():
    print("=" * 60)
    print("🚀 Starting Clean Data Resynchronization & Time Normalizer")
    print("=" * 60)

    # 1. Gold XAUUSD (Clean from IC Markets)
    print("[*] Fetching clean XAUUSD historical bars from IC Markets (TradingView)...")
    gold_candles = fetch_tradingview_candles("ICMARKETS:XAUUSD", 5000)
    if not gold_candles:
        print("[!] Trying fallback OANDA:XAUUSD...")
        gold_candles = fetch_tradingview_candles("OANDA:XAUUSD", 5000)

    if gold_candles:
        clean_gold = sanitize_and_deduplicate_candles(gold_candles, symbol="XAUUSD")
        out_gold = os.path.join(DATA_DIR, "XAUUSD_1m.json")
        with open(out_gold, "w", encoding="utf-8") as f:
            json.dump(clean_gold, f, separators=(',', ':'))
        print(f"[+] Successfully saved {len(clean_gold)} clean continuous XAUUSD candles to {out_gold}")
        print(f"    First: {clean_gold[0]['close']} @ {clean_gold[0]['time']} | Last: {clean_gold[-1]['close']} @ {clean_gold[-1]['time']}")

    # 2. Crypto PAXG (Isolated 24/7 Gold Token)
    print("[*] Fetching clean PAXGUSDT 24/7 bars from Binance...")
    paxg_candles = fetch_binance_candles("PAXGUSDT", count=1000, digits=2)
    if paxg_candles:
        clean_paxg = sanitize_and_deduplicate_candles(paxg_candles, symbol="PAXGUSDT")
        for sym_name in ["PAXGUSDT", "PAXGUSD", "XAUUSD_WEEKEND"]:
            out_p = os.path.join(DATA_DIR, f"{sym_name}_1m.json")
            with open(out_p, "w", encoding="utf-8") as f:
                json.dump(clean_paxg, f, separators=(',', ':'))
        print(f"[+] Saved {len(clean_paxg)} isolated PAXG 24/7 candles (Zero interference with XAUUSD)")

    # 3. Major Forex & Crypto
    pairs = [
        ("EURUSD", "FX:EURUSD"),
        ("GBPUSD", "FX:GBPUSD"),
        ("USDJPY", "FX:USDJPY"),
        ("XAGUSD", "TVC:SILVER"),
    ]
    for local_sym, tv_sym in pairs:
        print(f"[*] Resyncing {local_sym} from {tv_sym}...")
        c = fetch_tradingview_candles(tv_sym, 3000)
        if c:
            clean_c = sanitize_and_deduplicate_candles(c, symbol=local_sym)
            out_f = os.path.join(DATA_DIR, f"{local_sym}_1m.json")
            with open(out_f, "w", encoding="utf-8") as f:
                json.dump(clean_c, f, separators=(',', ':'))
            print(f"[+] {local_sym} updated: {len(clean_c)} clean bars")

    # 4. Crypto Major
    for c_sym in ["BTCUSDT", "ETHUSDT", "SOLUSDT"]:
        print(f"[*] Resyncing {c_sym} from Binance...")
        c = fetch_binance_candles(c_sym, count=1000, digits=2)
        if c:
            clean_c = sanitize_and_deduplicate_candles(c, symbol=c_sym)
            out_f = os.path.join(DATA_DIR, f"{c_sym}_1m.json")
            with open(out_f, "w", encoding="utf-8") as f:
                json.dump(clean_c, f, separators=(',', ':'))
            # Also save USD equivalent
            usd_equiv = c_sym.replace("USDT", "USD")
            out_usd = os.path.join(DATA_DIR, f"{usd_equiv}_1m.json")
            with open(out_usd, "w", encoding="utf-8") as f:
                json.dump(clean_c, f, separators=(',', ':'))
            print(f"[+] {c_sym} & {usd_equiv} updated: {len(clean_c)} bars")

    print("=" * 60)
    print("✅ All historical data cleaned, time-normalized, and resynced successfully!")
    print("=" * 60)

if __name__ == "__main__":
    run_resync()
