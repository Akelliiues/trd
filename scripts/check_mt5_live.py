import MetaTrader5 as mt5
from datetime import datetime

if not mt5.initialize():
    print("[-] MT5 initialize failed:", mt5.last_error())
else:
    print("[+] MT5 initialized successfully!")
    for sym in ['XAUUSD', 'XAUUSDm', 'GOLDm#', 'GOLD', 'XAUUSD.m']:
        info = mt5.symbol_info(sym)
        if info:
            tick = mt5.symbol_info_tick(sym)
            rates = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_M1, 0, 5)
            print("Symbol:", sym, "Bid:", tick.bid, "Ask:", tick.ask, "Digits:", info.digits)
            if rates is not None and len(rates) > 0:
                last_r = rates[-1]
                t = int(last_r['time'])
                print("Latest M1 Candle time:", t, "close:", last_r['close'])
                print("datetime.fromtimestamp(t):", datetime.fromtimestamp(t))
                print("datetime.utcfromtimestamp(t):", datetime.utcfromtimestamp(t))
            break
    mt5.shutdown()
