import MetaTrader5 as mt5
from datetime import datetime, timezone, timedelta
import json

mt5.initialize()
account = mt5.account_info()
terminal = mt5.terminal_info()
print("Broker Company:", account.company if account else "N/A", "Server:", account.server if account else "N/A")

gold_symbols = [s.name for s in mt5.symbols_get() if 'XAU' in s.name.upper() or 'GOLD' in s.name.upper()]
print("Gold symbols found:", gold_symbols)

for sym in gold_symbols:
    mt5.symbol_select(sym, True)
    info = mt5.symbol_info(sym)
    tick = mt5.symbol_info_tick(sym)
    if info and tick:
        print(f"{sym}: Digits={info.digits}, Bid={tick.bid}, Ask={tick.ask}, Point={info.point}")

# Check time
sym = gold_symbols[0] if gold_symbols else 'GOLDm#'
tick = mt5.symbol_info_tick(sym)
if tick:
    t = tick.time
    # Windows local time in Thailand
    now = datetime.now()
    # If tick.time is UTC+3 (Exness Server Time), then to get Thailand time (UTC+7):
    # Thailand time = Server Time + 4 hours!
    print("Tick timestamp:", t)
    print("Local PC Time:", now.strftime("%Y-%m-%d %H:%M:%S"))
    print("Server Time representation:", datetime.utcfromtimestamp(t).strftime("%Y-%m-%d %H:%M:%S"))
    
mt5.shutdown()
