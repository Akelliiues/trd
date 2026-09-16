//+------------------------------------------------------------------+
//|                                            TradingTools_Sync.mq5 |
//|                                 Copyright 2026, TradingTools PRO |
//|                        Auto-sync Trade History to Workstation Web|
//+------------------------------------------------------------------+
#property copyright "TradingTools PRO 2026"
#property link      "https://trd.ssotansum.com"
#property version   "1.00"
#property strict

input string InpApiUrl    = "https://trd.ssotansum.com/api/sync-trade"; // Web App Webhook URL (or http://localhost:3000/api/sync-trade)
input string InpSecretKey = "tradingtools_secret_key";                  // Secret Token for Auth
input string InpAccountTag = "Exness-Pro-01";                           // Account Label

datetime g_lastCheckTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("[TradingTools Sync] EA Initialized successfully. Tracking closed trades...");
   g_lastCheckTime = TimeCurrent() - 86400; // Check last 24h on start
   EventSetTimer(5); // Check every 5 seconds
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[TradingTools Sync] EA Stopped.");
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   CheckAndSendClosedTrades();
}

//+------------------------------------------------------------------+
//| Check closed orders in history and send JSON via WebRequest      |
//+------------------------------------------------------------------+
void CheckAndSendClosedTrades()
{
   datetime now = TimeCurrent();
   if(!HistorySelect(g_lastCheckTime, now)) return;

   int totalDeals = HistoryDealsTotal();
   for(int i = 0; i < totalDeals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket <= 0) continue;

      long dealEntry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(dealEntry != DEAL_ENTRY_OUT) continue; // Only process closing deals

      datetime dealTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      if(dealTime <= g_lastCheckTime) continue;

      string symbol   = HistoryDealGetString(ticket, DEAL_SYMBOL);
      long   dealType = HistoryDealGetInteger(ticket, DEAL_TYPE);
      double volume   = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double closePx  = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double profit   = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      double swap     = HistoryDealGetDouble(ticket, DEAL_SWAP);
      double comm     = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      long   orderId  = HistoryDealGetInteger(ticket, DEAL_ORDER);

      // Build JSON payload
      string typeStr = (dealType == DEAL_TYPE_BUY) ? "BUY" : "SELL";
      string json = StringFormat(
         "{\"ticket\":%I64u,\"order\":%I64u,\"symbol\":\"%s\",\"type\":\"%s\",\"volume\":%.2f,\"close_price\":%.5f,\"profit\":%.2f,\"swap\":%.2f,\"commission\":%.2f,\"close_time\":%I64d,\"account\":\"%s\",\"key\":\"%s\"}",
         ticket, orderId, symbol, typeStr, volume, closePx, profit, swap, comm, (long)dealTime, InpAccountTag, InpSecretKey
      );

      // Send to Web App via HTTP POST
      char postData[];
      char resultData[];
      string headers = "Content-Type: application/json\r\n";
      StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);

      string resultHeaders;
      int res = WebRequest("POST", InpApiUrl, headers, 3000, postData, resultData, resultHeaders);
      if(res == 200 || res == 201)
      {
         PrintFormat("[TradingTools Sync] Trade #%I64u synced successfully! Profit: $%.2f", ticket, profit);
      }
      else
      {
         PrintFormat("[TradingTools Sync] Note: WebRequest returned code %d (Make sure URL is added in MT5 Tools -> Options -> Expert Advisors -> Allow WebRequest)", res);
      }
   }

   g_lastCheckTime = now;
}
