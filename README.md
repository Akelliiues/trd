# TradingTools Workstation & Trade Journal

ระบบวิเคราะห์กราฟระดับสูงสไตล์ **TradingTools Workstation Pro** ร่วมกับระบบ **Trade Journal**
พร้อมฟีเจอร์ Multi-Chart Grid (4/8/16 ชาร์ต), Volume Profile, Bar Replay ตัดกราฟย้อนหลัง, Custom Timeframe, Range Bars, Multi-Watchlists, และ Indicator on Indicator

---

## สารบัญฟีเจอร์เด่น (Key Features)

### 1. Multi-Chart Grid Layout (1, 2, 4, 8, 16 ชาร์ตต่อแท็บ)
- ปรับ Layout อิสระ:
  - **1x1**: แสดงชาร์ตเดี่ยวเต็มจอ
  - **2x1**: 2 ชาร์ตเรียงคู่กัน
  - **2x2**: 4 ชาร์ต Grid (ยอดนิยมสำหรับ Multi-Timeframe เช่น 15M, 1H, 4H, 1D)
  - **4x2**: 8 ชาร์ต
  - **4x4**: 16 ชาร์ต (สำหรับเฝ้าดูตะกร้าสกุลเงิน หรือดูหลายคู่พร้อมกัน)
- **Synchronized Crosshair**: เคอร์เซอร์บอกตำแหน่งเวลาจะเลื่อนตามกันทุกชาร์ตอัตโนมัติ
- **อิสระต่อ Cell**: แต่ละหน้าต่างสามารถเลือก Symbol และ Timeframe แยกจากกันได้

### 2. Volume Profile (VPVR - Visible Range Volume Profile)
- คำนวณและวาด Histogram แสดงปริมาณการซื้อขายในแต่ละระดับราคาแบบเรียลไทม์
- ไฮไลท์ระดับสำคัญอัตโนมัติ:
  - **POC (Point of Control)**: เส้นสีแดงบอกระดับราคาที่มีปริมาณการเทรดสูงสุด
  - **VAH (Value Area High)** และ **VAL (Value Area Low)**: กรอบ 70% Volume

### 3. ไทม์เฟรมที่กำหนดเอง (Custom Timeframe Engine)
- ปุ่ม **+ Custom TF**: กำหนดจำนวนนาทีใดๆ ได้อิสระ เช่น `2m`, `3m`, `7m`, `13m`, `45m`, `120m` (2h), `4h`
- ระบบ Resampler จะรวมแท่งเทียน M1 ให้อัตโนมัติตามอัลกอริทึม Open, High, Low, Close, Volume

### 4. เรนจ์บาร์ที่กำหนดได้เอง (Custom Range Bars)
- ปุ่ม **Range Bar**: เปลี่ยนแท่งเทียนเป็นกราฟไม่ขึ้นกับเวลา (Price Action Driven)
- กำหนดขนาดระยะราคา (เช่น `2.0` สำหรับทองคำ XAUUSD หรือ `0.0015` สำหรับ Forex)
- แท่งจะปิดตัวลงก็ต่อเมื่อราคาแกว่งตัวครบระยะ Range เท่านั้น ช่วยกรอง Noise สัญญาณหลอก

### 5. โหมดแสดงแท่งเทียนแบบเล่นซ้ำ (Bar Replay / ตัดกราฟแบบ TradingView)
- ปุ่ม **✂️ ตัดกราฟ / Bar Replay**:
  - คลิกปุ่มกรรไกร แล้วคลิกบนแท่งเทียนที่ต้องการย้อนเวลา
  - กราฟจะ **ตัดราคาในอนาคตออกทันที**
  - **Multi-Chart Replay Sync**: ซิงค์การตัดกราฟข้ามทุก Timeframe พร้อมกัน
- แถบควบคุม Replay:
  - ⏪ ถอยหลัง 1 แท่ง
  - ▶️ / ⏸️ เล่นอัตโนมัติ / หยุดชั่วคราว
  - ⏩ เดินหน้า 1 แท่ง
  - ปรับความเร็ว: 0.5x, 1.0x, 2.0x, 5.0x
- **Virtual Trade Pad (ห้องซ้อมเทรดเสมือนจริง)**:
  - วางคำสั่ง BUY / SELL พร้อมกำหนด Lot, Stop Loss, Take Profit
  - แสดงเส้นระดับราคาบนกราฟ และระบบจะตัดสินผลอัตโนมัติเมื่อแท่งถัดไปขยับไปชน SL หรือ TP

### 6. อินดิเคเตอร์บนอินดิเคเตอร์ (Indicator on Indicator)
- คลิกปุ่ม **fx Indicators**
- มีตัวเลือก **เปิดโหมด "Indicator on Indicator"**:
  - คำนวณอินดิเคเตอร์ซ้อนทับบนผลลัพธ์ของอินดิเคเตอร์ตัวอื่นได้ เช่น:
    - **SMA บน RSI** (Moving Average of RSI)
    - **EMA บน MACD**
- แสดงผลพร้อมกันในหน้าต่างเดียวกันอย่างถูกต้อง

### 7. รายการเฝ้าดูที่ยกระดับขึ้นแบบหลายอัน (Advanced Multi-Watchlists)
- แบ่งหมวดหมู่ได้หลายชุด (Forex Majors, Metals & Commodities, Crypto Hot, Scalping Setups)
- ติด Color Tag (แดง, เขียว, ฟ้า, ม่วง, ส้ม) เพื่อจัดลำดับความสำคัญ
- แสดงราคา Real-time และ Change %
- คลิกที่คู่เงินใดเพื่อเปลี่ยนกราฟของชาร์ตที่เลือกทันที

### 8. ระบบบันทึกการเทรดขั้นสูง (Trade Journal & AI Coach)
- **Trading Calendar**: ปฏิทินรายเดือน แสดงกำไร/ขาดทุนสุทธิแต่ละวันด้วยสีเขียว/แดง และ Emotion Tag
- **Trade Log Table**: บันทึกไม้เทรด, Entry, Exit, Lot, P&L, R:R, สภาพอารมณ์ (Disciplined, Calm, FOMO, Revenge trade)
- **Performance Analytics**: Win Rate, Profit Factor, Net P&L, Total Trades
- **AI Trading Coach**: รวบรวมสถิติและพฤติกรรมเทรดเพื่อสร้าง Prompt ส่งให้ AI (เช่น Google Gemini) วิเคราะห์ข้อบกพร่อง

---

## วิธีติดตั้งและเริ่มใช้งาน

### 1. รัน Local Web Server
เปิด PowerShell หรือ Terminal ในโฟลเดอร์นี้ แล้วรันคำสั่ง:
```bash
python server.py
```
เปิดเว็บเบราว์เซอร์ไปที่:
👉 **`http://localhost:3000`**

### 2. กระบวนการดึงข้อมูลกราฟจริง (Market Data Pipeline)
รันสคริปต์เพื่อดึงข้อมูลแท่งเทียนจริงจาก Binance หรืออัปเดตชุดข้อมูลทองคำ/Forex:
```bash
python scripts/fetch_market_data.py
```
ชุดข้อมูลจะถูกบันทึกลงในโฟลเดอร์ `data/` ในรูปแบบ JSON ความละเอียดสูง (M1)

### 3. การเชื่อมต่อ MetaTrader 5 (MT5 Auto-Sync)
1. คัดลอกไฟล์ `scripts/TradingTools_Sync.mq5` ไปไว้ในโฟลเดอร์ `MQL5/Experts` ของโปรแกรม MT5
2. คอมไพล์ใน MetaEditor แล้วลาก EA ลงบนชาร์ตใดก็ได้ใน MT5
3. เปิดใช้งาน **WebRequest** ใน MT5:
   - ไปที่ `Tools` -> `Options` -> แท็บ `Expert Advisors`
   - ติ๊กถูกที่ `Allow WebRequest for listed URL:`
   - เพิ่ม URL: `http://localhost:3000` (หรือ `https://trd.ssotansum.com`)
4. เมื่อใดก็ตามที่ปิดไม้ใน MT5 ระบบจะส่งข้อมูลผ่าน Webhook เข้ามาเก็บในสมุดบันทึกเทรดโดยอัตโนมัติ!
