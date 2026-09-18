#!/usr/bin/env python3
"""
TradingView Realtime Datafeed Engine
Provides ultra-low latency, institutional broker market data (IC Markets, Pepperstone, OANDA)
without requiring MetaTrader 5 (MT5) to remain open.
"""

import socket
import ssl
import json
import base64
import os
import struct
import time
import re
import threading
import queue

class TradingViewWSFeed:
    def __init__(self, on_rate_update=None, on_candle_update=None, on_sse_broadcast=None, preferred_gold="ICMARKETS"):
        self.preferred_gold = preferred_gold.upper() # "ICMARKETS", "PEPPERSTONE", "OANDA"
        self.on_rate_update = on_rate_update
        self.on_candle_update = on_candle_update
        self.on_sse_broadcast = on_sse_broadcast

        self.running = False
        self.sock = None
        self.thread = None
        self.last_seen = 0
        self.last_bar_save = 0

        # Primary symbols to subscribe
        self.gold_sym = "ICMARKETS:XAUUSD" if self.preferred_gold == "ICMARKETS" else ("PEPPERSTONE:XAUUSD" if self.preferred_gold == "PEPPERSTONE" else "OANDA:XAUUSD")
        self.quote_symbols = [
            "ICMARKETS:XAUUSD",
            "PEPPERSTONE:XAUUSD",
            "OANDA:XAUUSD",
            "FX:EURUSD",
            "FX:GBPUSD",
            "FX:USDJPY",
            "BINANCE:BTCUSDT",
            "BINANCE:ETHUSDT",
            "BINANCE:SOLUSDT"
        ]

        # Rate limiter for SSE tick broadcasts (max 25 updates/sec per symbol)
        self.last_sse_tick = {}

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True, name="TradingViewWSFeed")
        self.thread.start()
        print(f"[+] TradingView Realtime Feed started! Primary Gold: {self.gold_sym}")

    def stop(self):
        self.running = False
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass

    def _send_raw_frame(self, data_bytes):
        if not self.sock:
            return
        mask = os.urandom(4)
        length = len(data_bytes)
        if length <= 125:
            header = struct.pack("!BB", 0x81, 0x80 | length)
        elif length <= 65535:
            header = struct.pack("!BBH", 0x81, 0x80 | 126, length)
        else:
            header = struct.pack("!BBQ", 0x81, 0x80 | 127, length)

        masked = bytearray(length)
        for i in range(length):
            masked[i] = data_bytes[i] ^ mask[i % 4]

        self.sock.sendall(header + mask + bytes(masked))

    def _send_msg(self, method, params):
        payload = json.dumps({"m": method, "p": params})
        formatted = f"~m~{len(payload)}~m~{payload}"
        self._send_raw_frame(formatted.encode('utf-8'))

    def _read_frame(self):
        head = self.sock.recv(2)
        if not head or len(head) < 2:
            return None, None
        b0, b1 = head[0], head[1]
        opcode = b0 & 0x0F
        masked = (b1 & 0x80) != 0
        length = b1 & 0x7F

        if length == 126:
            ext = self.sock.recv(2)
            if len(ext) < 2: return None, None
            length = struct.unpack("!H", ext)[0]
        elif length == 127:
            ext = self.sock.recv(8)
            if len(ext) < 8: return None, None
            length = struct.unpack("!Q", ext)[0]

        mask = b""
        if masked:
            mask = self.sock.recv(4)
            if len(mask) < 4: return None, None

        data = b""
        while len(data) < length:
            chunk = self.sock.recv(min(8192, length - len(data)))
            if not chunk:
                break
            data += chunk

        if masked:
            unmasked = bytearray(len(data))
            for i in range(len(data)):
                unmasked[i] = data[i] ^ mask[i % 4]
            data = bytes(unmasked)

        return opcode, data

    def _run_loop(self):
        while self.running:
            try:
                self._connect_and_stream()
            except Exception as e:
                # print(f"[-] TradingView WS Feed disconnected: {e}. Reconnecting in 3s...")
                pass
            time.sleep(3)

    def _connect_and_stream(self):
        host = "data.tradingview.com"
        port = 443
        path = "/socket.io/websocket"
        context = ssl.create_default_context()
        raw_sock = socket.create_connection((host, port), timeout=12)
        self.sock = context.wrap_socket(raw_sock, server_hostname=host)
        self.sock.settimeout(20.0)

        sec_key = base64.b64encode(os.urandom(16)).decode('utf-8')
        handshake = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {sec_key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n"
            f"Origin: https://data.tradingview.com\r\n"
            f"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n\r\n"
        )
        self.sock.sendall(handshake.encode('utf-8'))

        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = self.sock.recv(4096)
            if not chunk:
                break
            resp += chunk

        if b"101" not in resp.split(b"\r\n\r\n")[0]:
            raise ConnectionError("TradingView WebSocket handshake refused")

        self.last_seen = time.time()
        # Session IDs
        quote_session = "qs_" + os.urandom(4).hex()
        chart_session = "cs_" + os.urandom(4).hex()

        self._send_msg("set_auth_token", ["unauthorized_user_token"])
        
        # 1. Quote Session: Sub-second bid/ask/spread ticks
        self._send_msg("quote_create_session", [quote_session])
        self._send_msg("quote_set_fields", [
            quote_session, "lp", "bid", "ask", "spread", "ch", "chp", "open_price", "high_price", "low_price", "volume"
        ])
        self._send_msg("quote_add_symbols", [quote_session] + self.quote_symbols)

        # 2. Chart Session: 1-minute OHLCV candles
        self._send_msg("chart_create_session", [chart_session, ""])
        self._send_msg("resolve_symbol", [
            chart_session, "sds_gold", f"={json.dumps({'symbol': self.gold_sym, 'adjustment': 'splits'})}"
        ])
        self._send_msg("create_series", [
            chart_session, "sds_1", "s1", "sds_gold", "1", 5000
        ])

        # Message processing loop
        while self.running:
            opcode, data = self._read_frame()
            if opcode is None:
                break
            if opcode == 8: # Close
                break
            if opcode == 9: # Ping
                self.sock.sendall(struct.pack("!BB", 0x8A, 0))
                continue
            if opcode == 1: # Text
                self.last_seen = time.time()
                text = data.decode('utf-8', errors='ignore')

                # Keep-alive heartbeat (~h~num)
                if "~h~" in text:
                    for m in re.finditer(r"~h~(\d+)", text):
                        pong = f"~m~{len(m.group(1)) + 4}~m~~h~{m.group(1)}"
                        self._send_raw_frame(pong.encode('utf-8'))
                    continue

                # Parse ~m~len~m~
                for match in re.finditer(r"~m~(\d+)~m~", text):
                    payload_len = int(match.group(1))
                    start_pos = match.end()
                    body = text[start_pos:start_pos + payload_len]
                    self._handle_message(body)

    def _handle_message(self, body):
        try:
            msg = json.loads(body)
        except Exception:
            return

        m_type = msg.get("m")
        params = msg.get("p")
        if not params:
            return

        now = int(time.time())

        # 1. Quote Tick: 'qsd'
        if m_type == "qsd" and len(params) > 1:
            item = params[1]
            raw_sym = item.get("n", "")
            vals = item.get("v", {})
            if not vals:
                return

            bid = vals.get("bid")
            ask = vals.get("ask")
            lp = vals.get("lp")
            digits = 3 if "XAU" in raw_sym or "GOLD" in raw_sym else (5 if ("EUR" in raw_sym or "GBP" in raw_sym) else 2)

            # Map raw symbol to unified symbols
            targets = []
            if raw_sym == self.gold_sym:
                targets.extend(["XAUUSD", "GOLD", "GOLDm#", "GOLD#", "XAUUSDm"])
            elif "XAU" in raw_sym and self.preferred_gold not in raw_sym:
                # Secondary gold update if primary missing
                targets.append("XAUUSD_SECONDARY")
            elif "BTCUSDT" in raw_sym:
                targets.extend(["BTCUSDT", "BTCUSD"])
            elif "ETHUSDT" in raw_sym:
                targets.extend(["ETHUSDT", "ETHUSD"])
            elif "SOLUSDT" in raw_sym:
                targets.extend(["SOLUSDT", "SOLUSD"])
            elif "EURUSD" in raw_sym:
                targets.append("EURUSD")
            elif "GBPUSD" in raw_sym:
                targets.append("GBPUSD")
            elif "USDJPY" in raw_sym:
                targets.append("USDJPY")

            if targets and (bid is not None or lp is not None):
                main_price = round(float(bid if bid is not None else lp), digits)
                ask_price = round(float(ask if ask is not None else main_price + (0.10 if digits == 3 else 0.00015)), digits)
                rate_obj = {
                    "symbol": targets[0],
                    "bid": main_price,
                    "ask": ask_price,
                    "close": main_price,
                    "digits": digits,
                    "time": now,
                    "source": "tradingview_live",
                    "broker": self.gold_sym.split(":")[0] if "XAU" in targets[0] else "TradingView"
                }

                if self.on_rate_update:
                    for t in targets:
                        self.on_rate_update(t, rate_obj)

                # SSE Broadcast rate-limited to ~30fps
                t_now = time.time()
                primary_target = targets[0]
                if t_now - self.last_sse_tick.get(primary_target, 0) > 0.035:
                    self.last_sse_tick[primary_target] = t_now
                    if self.on_sse_broadcast:
                        self.on_sse_broadcast("tick", rate_obj)

        # 2. Historical / Snapshot M1 Candles: 'timescale_update'
        elif m_type == "timescale_update" and len(params) > 1:
            sds = params[1].get("sds_1", {})
            series = sds.get("s", [])
            if series and self.on_candle_update:
                candles = []
                offset_sec = 7 * 3600 # Thailand time offset
                for bar in series:
                    v = bar.get("v")
                    if v and len(v) >= 6:
                        # v: [time, open, high, low, close, volume]
                        t = int(v[0]) + offset_sec
                        candles.append({
                            "time": t,
                            "open": round(float(v[1]), 3),
                            "high": round(float(v[2]), 3),
                            "low": round(float(v[3]), 3),
                            "close": round(float(v[4]), 3),
                            "volume": int(float(v[5]))
                        })
                if candles:
                    self.on_candle_update("XAUUSD", candles, is_snapshot=True)
                    if self.on_sse_broadcast:
                        self.on_sse_broadcast("candles_snapshot", {
                            "symbol": "XAUUSD",
                            "candles": candles[-2000:]
                        })

        # 3. Realtime Candlestick Update (Current Bar Tick-by-Tick): 'du'
        elif m_type == "du" and len(params) > 1:
            sds = params[1].get("sds_1", {})
            series = sds.get("s", [])
            if series and self.on_candle_update:
                offset_sec = 7 * 3600
                last_bar = series[-1].get("v")
                if last_bar and len(last_bar) >= 6:
                    t = int(last_bar[0]) + offset_sec
                    candle = {
                        "time": t,
                        "open": round(float(last_bar[1]), 3),
                        "high": round(float(last_bar[2]), 3),
                        "low": round(float(last_bar[3]), 3),
                        "close": round(float(last_bar[4]), 3),
                        "volume": int(float(last_bar[5]))
                    }
                    self.on_candle_update("XAUUSD", [candle], is_snapshot=False)
                    if self.on_sse_broadcast:
                        self.on_sse_broadcast("candle_update", {
                            "symbol": "XAUUSD",
                            "candle": candle
                        })
