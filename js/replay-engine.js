/**
 * Multi-Chart Synchronized Bar Replay & Virtual Trading Engine
 * ควบคุมการตัดกราฟ (Cut Bar) และเล่นแท่งเทียนย้อนหลัง (Bar Replay)
 * รองรับการซิงค์ข้ามหลายชาร์ต (Multi-Timeframe Sync) และจำลองการเปิด Order ซ้อมเทรด
 */

class ReplayEngine {
    constructor(chartEngine) {
        this.chartEngine = chartEngine;
        this.isActive = false;         // อยู่ในโหมด Replay หรือไม่
        this.isCutting = false;        // กำลังอยู่ในโหมดเลือกจุดตัดกราฟ (กรรไกร) หรือไม่
        this.isPlaying = false;        // กำลังเล่นอัตโนมัติหรือไม่
        this.playInterval = null;
        this.speedMs = 800;            // ความเร็วการเล่น (ms ต่อแท่ง)
        this.currentReplayTime = null; // Timestamp ปัจจุบันที่กำลัง Replay
        this.maxReplayTime = null;     // Timestamp สิ้นสุด (เวลาจริง)

        // ระบบจำลองพอร์ตซ้อมเทรด (Virtual Trading Account & Leverage Engine)
        const savedBalance = (typeof localStorage !== 'undefined') ? localStorage.getItem('tt_account_balance') : null;
        const savedInitial = (typeof localStorage !== 'undefined') ? localStorage.getItem('tt_initial_balance') : null;
        const savedLeverage = (typeof localStorage !== 'undefined') ? localStorage.getItem('tt_account_leverage') : null;
        const savedOrders = (typeof localStorage !== 'undefined') ? localStorage.getItem('tt_open_orders') : null;
        const savedHistory = (typeof localStorage !== 'undefined') ? localStorage.getItem('tt_trade_history') : null;

        this.balance = savedBalance ? parseFloat(savedBalance) : 10000;
        this.initialBalance = savedInitial ? parseFloat(savedInitial) : this.balance;
        this.leverage = savedLeverage ? parseInt(savedLeverage) : 500;

        try {
            this.openOrders = savedOrders ? JSON.parse(savedOrders) : [];
            if (!Array.isArray(this.openOrders)) this.openOrders = [];
        } catch (e) {
            this.openOrders = [];
        }

        try {
            this.tradeHistory = savedHistory ? JSON.parse(savedHistory) : [];
            if (!Array.isArray(this.tradeHistory)) this.tradeHistory = [];
        } catch (e) {
            this.tradeHistory = [];
        }
        
        // Callbacks
        this.onStateChange = null;
        this.onOrderUpdate = null;
    }

    /**
     * บันทึกสถานะ Open Orders และ Trade History ลง LocalStorage
     */
    saveOrdersToStorage() {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem('tt_open_orders', JSON.stringify(this.openOrders));
            localStorage.setItem('tt_trade_history', JSON.stringify(this.tradeHistory));
        } catch (e) {
            console.error('Error saving orders to localStorage:', e);
        }
    }

    /**
     * คำนวณ Margin, Equity, Free Margin และ Margin Level %
     */
    getAccountMetrics() {
        const balance = this.balance;
        let floatingPnl = 0;
        let usedMargin = 0;

        for (const ord of this.openOrders) {
            floatingPnl += (ord.floatingPnl || 0);
            const isGold = ord.symbol.includes('XAU') || ord.symbol.includes('GOLD');
            const isForex = ord.symbol.includes('EUR') || ord.symbol.includes('GBP') || ord.symbol.includes('JPY') || ord.symbol.includes('AUD');
            const isCrypto = ord.symbol.includes('BTC') || ord.symbol.includes('ETH');
            
            let notional = 0;
            if (isGold) {
                notional = ord.lot * 100 * ord.entryPrice;
            } else if (isForex) {
                notional = ord.lot * 100000 * ord.entryPrice;
            } else if (isCrypto) {
                notional = ord.lot * 1 * ord.entryPrice;
            } else {
                notional = ord.lot * 100 * ord.entryPrice;
            }

            const lev = isCrypto ? Math.min(this.leverage, 100) : this.leverage;
            usedMargin += notional / lev;
        }

        const equity = Number((balance + floatingPnl).toFixed(2));
        usedMargin = Number(usedMargin.toFixed(2));
        const freeMargin = Number((equity - usedMargin).toFixed(2));
        const marginLevel = usedMargin > 0 ? Number(((equity / usedMargin) * 100).toFixed(1)) : 0;

        return {
            balance: Number(balance.toFixed(2)),
            equity,
            floatingPnl: Number(floatingPnl.toFixed(2)),
            usedMargin,
            freeMargin,
            marginLevel,
            leverage: this.leverage
        };
    }

    /**
     * ปรับตั้งค่าเงินทุนและ Leverage ในพอร์ต
     */
    setAccountSettings(balance, leverage) {
        if (balance !== undefined && !isNaN(parseFloat(balance)) && parseFloat(balance) > 0) {
            this.balance = parseFloat(balance);
            this.initialBalance = this.balance;
            localStorage.setItem('tt_account_balance', this.balance);
            localStorage.setItem('tt_initial_balance', this.initialBalance);
        }
        if (leverage !== undefined && !isNaN(parseInt(leverage)) && parseInt(leverage) > 0) {
            this.leverage = parseInt(leverage);
            localStorage.setItem('tt_account_leverage', this.leverage);
        }

        if (this.chartEngine && this.chartEngine.showToast) {
            this.chartEngine.showToast(`⚙️ บันทึกพอร์ต: Balance $${this.balance.toLocaleString()}, Leverage 1:${this.leverage}`);
        }

        this.notifyOrderUpdate();
    }

    notifyOrderUpdate() {
        if (this.onOrderUpdate) {
            this.onOrderUpdate({
                openOrders: this.openOrders,
                history: this.tradeHistory,
                balance: this.balance,
                metrics: this.getAccountMetrics()
            });
        }
    }

    /**
     * เริ่มโหมดกรรไกร (Cut Tool)
     */
    startCutMode() {
        this.isCutting = true;
        document.body.classList.add('replay-cut-cursor');
        if (this.onStateChange) this.onStateChange({ isCutting: true });
    }

    cancelCutMode() {
        this.isCutting = false;
        document.body.classList.remove('replay-cut-cursor');
        if (this.onStateChange) this.onStateChange({ isCutting: false });
    }

    /**
     * ตัดกราฟ ณ จุดเวลา timestamp ที่ระบุ
     * จะตัดข้อมูลในทุกชาร์ต (Multi-Chart Sync) ให้อนาคตหายไปพร้อมกัน
     */
    cutAtTime(timestamp) {
        this.cancelCutMode();
        this.isActive = true;
        this.isPlaying = false;
        clearInterval(this.playInterval);
        this.currentReplayTime = timestamp;

        // สั่งให้ Chart Engine อัปเดตทุกชาร์ตให้แสดงเฉพาะแท่งที่ time <= timestamp
        this.chartEngine.syncReplayTime(this.currentReplayTime);

        if (this.onStateChange) {
            this.onStateChange({
                isActive: true,
                isPlaying: false,
                currentTime: this.currentReplayTime
            });
        }
    }

    /**
     * เล่นอัตโนมัติ (Play / Pause toggle)
     */
    togglePlay() {
        if (!this.isActive) return;

        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        if (!this.isActive) return;
        this.isPlaying = true;
        clearInterval(this.playInterval);
        this.playInterval = setInterval(() => {
            const hasMore = this.stepForward();
            if (!hasMore) {
                this.pause();
            }
        }, this.speedMs);

        if (this.onStateChange) this.onStateChange({ isPlaying: true });
    }

    pause() {
        this.isPlaying = false;
        clearInterval(this.playInterval);
        if (this.onStateChange) this.onStateChange({ isPlaying: false });
    }

    setSpeed(speedMs) {
        this.speedMs = speedMs;
        if (this.isPlaying) {
            this.play(); // รีสตาร์ท interval ด้วยความเร็วใหม่
        }
    }

    /**
     * เดินหน้าทีละ 1 แท่ง (Step Forward)
     */
    stepForward() {
        if (!this.isActive) return false;

        // หา Next Timestamp ที่ใกล้ที่สุดจาก Master Chart (หรือชาร์ตที่เล็กที่สุด)
        const nextTime = this.chartEngine.getNextCandleTime(this.currentReplayTime);
        if (!nextTime) {
            return false; // ถึงแท่งปัจจุบันสุดแล้ว
        }

        this.currentReplayTime = nextTime;
        this.chartEngine.syncReplayTime(this.currentReplayTime);

        // ตรวจสอบ Order จำลองว่าชน SL หรือ TP หรือไม่
        this.checkOrdersExecution();

        // อัปเดต Floating P&L ของออเดอร์ที่ยังเปิดอยู่ตามราคาแท่งเทียนล่าสุด
        for (const order of this.openOrders) {
            const candle = this.chartEngine.getLatestVisibleCandle(order.symbol);
            if (candle) {
                this.updateFloatingPnL(order.symbol, candle.close);
            }
        }

        if (this.onStateChange) {
            this.onStateChange({
                currentTime: this.currentReplayTime
            });
        }
        return true;
    }

    /**
     * ถอยหลังทีละ 1 แท่ง (Step Back)
     */
    stepBack() {
        if (!this.isActive) return;
        this.pause();

        const prevTime = this.chartEngine.getPrevCandleTime(this.currentReplayTime);
        if (prevTime) {
            this.currentReplayTime = prevTime;
            this.chartEngine.syncReplayTime(this.currentReplayTime);
            if (this.onStateChange) {
                this.onStateChange({ currentTime: this.currentReplayTime });
            }
        }
    }

    /**
     * ออกจากโหมด Replay กลับสู่ราคาเรียลไทม์ปัจจุบัน
     */
    exitReplay() {
        this.pause();
        this.isActive = false;
        this.currentReplayTime = null;
        this.chartEngine.resetToRealtime();
        if (this.onStateChange) {
            this.onStateChange({ isActive: false, isPlaying: false });
        }
    }

    // ==========================================
    // Virtual Trading Pad (ระบบซ้อมเทรดเสมือนจริง)
    // ==========================================

    /**
     * คำนวณค่า SL และ TP อัจฉริยะหากผู้ใช้ไม่ได้ระบุ หรือระบุเป็นระยะ Points / Pips
     */
    calculateSmartSLTP(type, symbol, entryPrice, slInput, tpInput) {
        const isGold = symbol.includes('XAU') || symbol.includes('GOLD');
        const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('AUD');
        const isCrypto = symbol.includes('BTC') || symbol.includes('ETH');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);

        // ค่า Default SL / TP สำหรับแต่ละประเภทสินทรัพย์ (Risk:Reward = 1:1 ค่าเริ่มต้นตามคำสั่งผู้ใช้)
        let defaultSlDist = isGold ? 3.000 : (isForex ? 0.00300 : (isCrypto ? entryPrice * 0.01 : entryPrice * 0.005));
        let defaultTpDist = isGold ? 3.000 : (isForex ? 0.00300 : (isCrypto ? entryPrice * 0.01 : entryPrice * 0.005));

        let finalSl = null;
        let finalTp = null;

        // 1. วิเคราะห์ค่า SL
        if (slInput !== null && slInput !== undefined && slInput !== '' && !isNaN(parseFloat(slInput)) && parseFloat(slInput) > 0) {
            const val = parseFloat(slInput);
            if (val > entryPrice * 0.5 && val < entryPrice * 1.5) {
                // ระบุเป็นราคาเป้าหมายตรงๆ (Absolute Price)
                finalSl = val;
            } else {
                // ระบุเป็นระยะทาง (Distance / Points / Pips)
                let dist = val;
                if (isForex && val >= 1) dist = val * 0.00010;
                finalSl = type === 'BUY' ? entryPrice - dist : entryPrice + dist;
            }
        } else {
            // ค่าเริ่มต้นอัตโนมัติหากไม่ระบุ SL
            finalSl = type === 'BUY' ? entryPrice - defaultSlDist : entryPrice + defaultSlDist;
        }

        // คำนวณระยะ SL จริงเพื่อใช้กำหนดอัตราส่วน R:R (เริ่มต้น RR 1:1)
        const slDist = Math.abs(entryPrice - finalSl);

        // 2. วิเคราะห์ค่า TP
        if (tpInput !== null && tpInput !== undefined && tpInput !== '' && !isNaN(parseFloat(tpInput)) && parseFloat(tpInput) > 0) {
            const val = parseFloat(tpInput);
            if (val > entryPrice * 0.5 && val < entryPrice * 1.5) {
                // ระบุเป็นราคาเป้าหมายตรงๆ
                finalTp = val;
            } else {
                // ระบุเป็นระยะทาง (Distance / Points / Pips)
                let dist = val;
                if (isForex && val >= 1) dist = val * 0.00010;
                finalTp = type === 'BUY' ? entryPrice + dist : entryPrice - dist;
            }
        } else {
            // ค่าเริ่มต้นอัตโนมัติ R:R 1:1 จากระยะ SL
            const tpDist = slDist > 0 ? slDist : defaultTpDist;
            finalTp = type === 'BUY' ? entryPrice + tpDist : entryPrice - tpDist;
        }

        return {
            sl: Number(finalSl.toFixed(decimals)),
            tp: Number(finalTp.toFixed(decimals))
        };
    }

    /**
     * แปลง Input ราคาหรือระยะ Point ให้เป็นราคาจริง (หรือคืนค่า null ถ้าถูกลบออก)
     */
    parsePriceLevel(type, symbol, entryPrice, inputVal, isTP = false) {
        if (inputVal === null || inputVal === undefined || inputVal === '' || String(inputVal).trim() === '') {
            return null;
        }
        const val = parseFloat(inputVal);
        if (isNaN(val) || val <= 0) return null;

        const isGold = symbol.includes('XAU') || symbol.includes('GOLD');
        const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);

        if (val > entryPrice * 0.5 && val < entryPrice * 1.5) {
            return Number(val.toFixed(decimals));
        }

        let dist = val;
        if (isForex && val >= 1) dist = val * 0.00010;

        let calculatedPrice;
        if (isTP) {
            calculatedPrice = type === 'BUY' ? entryPrice + dist : entryPrice - dist;
        } else {
            calculatedPrice = type === 'BUY' ? entryPrice - dist : entryPrice + dist;
        }
        return Number(calculatedPrice.toFixed(decimals));
    }

    placeOrder({ type, symbol, lot = 0.1, sl = null, tp = null }) {
        const currentPrice = this.chartEngine.getCurrentPrice(symbol);
        if (!currentPrice) return null;

        // คำนวณ SL และ TP เริ่มต้นที่อัตราส่วน Risk:Reward 1:1 เสมอ (ตามคำสั่งผู้ใช้)
        let finalSl = null;
        let finalTp = null;

        if ((sl !== null && sl !== undefined && sl !== '' && String(sl).trim() !== '') ||
            (tp !== null && tp !== undefined && tp !== '' && String(tp).trim() !== '')) {
            // ผู้ใช้กรอก SL หรือ TP มาตัวใดตัวหนึ่งหรือทั้งสองตัว
            finalSl = (sl !== null && sl !== undefined && sl !== '' && String(sl).trim() !== '') 
                ? this.parsePriceLevel(type, symbol, currentPrice, sl, false) 
                : null;
            finalTp = (tp !== null && tp !== undefined && tp !== '' && String(tp).trim() !== '') 
                ? this.parsePriceLevel(type, symbol, currentPrice, tp, true) 
                : null;

            // หากระบุ SL แต่ยังไม่ได้ระบุ TP ให้ตั้ง TP ที่ RR 1:1 อัตโนมัติ
            if (finalSl !== null && finalTp === null) {
                const dist = Math.abs(currentPrice - finalSl);
                finalTp = type === 'BUY' ? Number((currentPrice + dist).toFixed(3)) : Number((currentPrice - dist).toFixed(3));
            } else if (finalTp !== null && finalSl === null) {
                const dist = Math.abs(currentPrice - finalTp);
                finalSl = type === 'BUY' ? Number((currentPrice - dist).toFixed(3)) : Number((currentPrice + dist).toFixed(3));
            }
        } else {
            // ถ้าไม่ได้กรอกทั้ง SL และ TP ให้คำนวณ Default SL/TP ที่ RR 1:1 ทันที
            const smart = this.calculateSmartSLTP(type, symbol, currentPrice, null, null);
            finalSl = smart.sl;
            finalTp = smart.tp;
        }

        const nowSec = this.currentReplayTime || Math.floor(Date.now() / 1000);
        const order = {
            id: 'ORD_' + Date.now(),
            symbol: symbol,
            type: type, // 'BUY' or 'SELL'
            lot: lot,
            entryPrice: currentPrice,
            entryTime: nowSec,
            sl: finalSl,
            tp: finalTp,
            status: 'OPEN',
            pnl: 0,
            floatingPnl: 0
        };

        this.openOrders.push(order);
        this.saveOrdersToStorage();
        this.chartEngine.drawOrderLines(order);

        // ตั้งค่าให้ออเดอร์ที่เพิ่งเปิดเป็น Selected Order บนกราฟทันที
        if (this.chartEngine && this.chartEngine.charts) {
            this.chartEngine.charts.forEach(cell => {
                if (cell.symbol === symbol) {
                    cell.selectedOrderId = order.id;
                    this.chartEngine.updateOverlays(cell);
                }
            });
        }

        // แจ้งเตือน Toast เมื่อเปิด Order สำเร็จ
        if (this.chartEngine.showToast) {
            const slStr = order.sl ? `SL: ${order.sl}` : 'SL: ไม่มี';
            const tpStr = order.tp ? `TP: ${order.tp}` : 'TP: ไม่มี';
            this.chartEngine.showToast(`🚀 เปิดออเดอร์ ${type} ${lot}L ${symbol} @ ${currentPrice} | ${slStr} | ${tpStr} (RR 1:1)`);
        }

        this.notifyOrderUpdate();
        return order;
    }

    /**
     * อัปเดต SL และ TP ของ Order ที่ยังเปิดค้างอยู่ (รองรับการส่ง null เพื่อลบอย่างใดอย่างหนึ่ง)
     */
    updateOrderSLTP(orderId, newSl, newTp) {
        const order = this.openOrders.find(o => o.id === orderId);
        if (!order) return;

        if (newSl !== undefined) {
            order.sl = (newSl === null || newSl === '') ? null : this.parsePriceLevel(order.type, order.symbol, order.entryPrice, newSl, false);
        }
        if (newTp !== undefined) {
            order.tp = (newTp === null || newTp === '') ? null : this.parsePriceLevel(order.type, order.symbol, order.entryPrice, newTp, true);
        }

        // บันทึกลง Storage ทันที
        this.saveOrdersToStorage();

        // อัปเดตเส้นบนชาร์ต
        this.chartEngine.removeOrderLines(order.id);
        this.chartEngine.drawOrderLines(order);

        if (this.chartEngine.showToast) {
            const slText = order.sl ? `SL=${order.sl}` : 'SL=ไม่มี';
            const tpText = order.tp ? `TP=${order.tp}` : 'TP=ไม่มี';
            this.chartEngine.showToast(`✏️ แก้ไข SL/TP ของ ${order.symbol}: ${slText}, ${tpText}`);
        }

        this.notifyOrderUpdate();
    }

    /**
     * ลบเฉพาะ Take Profit (TP) ของ Order
     */
    removeOrderTP(orderId) {
        const order = this.openOrders.find(o => o.id === orderId);
        if (!order) return;

        order.tp = null;
        this.saveOrdersToStorage();
        this.chartEngine.removeOrderLines(order.id);
        this.chartEngine.drawOrderLines(order);

        if (this.chartEngine.showToast) {
            this.chartEngine.showToast(`🎯 ลบ Take Profit (TP) ของ ${order.symbol} เรียบร้อยแล้ว`);
        }

        this.notifyOrderUpdate();
    }

    /**
     * ลบเฉพาะ Stop Loss (SL) ของ Order
     */
    removeOrderSL(orderId) {
        const order = this.openOrders.find(o => o.id === orderId);
        if (!order) return;

        order.sl = null;
        this.saveOrdersToStorage();
        this.chartEngine.removeOrderLines(order.id);
        this.chartEngine.drawOrderLines(order);

        if (this.chartEngine.showToast) {
            this.chartEngine.showToast(`🛑 ลบ Stop Loss (SL) ของ ${order.symbol} เรียบร้อยแล้ว`);
        }

        this.notifyOrderUpdate();
    }

    closeOrder(orderId, closePrice = null, reason = 'MANUAL') {
        const idx = this.openOrders.findIndex(o => o.id === orderId);
        if (idx === -1) return;

        const order = this.openOrders[idx];
        const exitPx = closePrice || this.chartEngine.getCurrentPrice(order.symbol);
        
        let pnl = 0;
        const isGold = order.symbol.includes('XAU') || order.symbol.includes('GOLD');
        const pointVal = isGold ? 100 : (order.symbol.includes('EUR') ? 100000 : 1);
        if (order.type === 'BUY') {
            pnl = (exitPx - order.entryPrice) * order.lot * pointVal;
        } else {
            pnl = (order.entryPrice - exitPx) * order.lot * pointVal;
        }

        order.exitPrice = exitPx;
        order.exitTime = this.currentReplayTime || Math.floor(Date.now() / 1000);
        order.pnl = Number(pnl.toFixed(2));
        order.status = 'CLOSED';
        order.reason = reason;

        this.balance = Number((this.balance + order.pnl).toFixed(2));
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('tt_account_balance', this.balance);
        }
        this.tradeHistory.unshift(order);
        this.openOrders.splice(idx, 1);
        this.saveOrdersToStorage();

        this.chartEngine.removeOrderLines(order.id);

        // แสดงแจ้งเตือน Toast เมื่อชน TP, SL หรือปิดมือ
        if (this.chartEngine.showToast) {
            if (reason === 'HIT TP') {
                this.chartEngine.showToast(`🎯 ชน Take Profit (TP)! ${order.symbol} กำไร +$${order.pnl.toFixed(2)} USD`);
            } else if (reason === 'HIT SL') {
                this.chartEngine.showToast(`🛑 ชน Stop Loss (SL)! ${order.symbol} ขาดทุน -$${Math.abs(order.pnl).toFixed(2)} USD`);
            } else {
                const sign = order.pnl >= 0 ? '+' : '';
                this.chartEngine.showToast(`📋 ปิดออเดอร์ ${order.symbol} (${sign}$${order.pnl.toFixed(2)} USD)`);
            }
        }

        this.notifyOrderUpdate();
    }

    /**
     * อัปเดตกำไร/ขาดทุนแบบลอยตัว (Floating P&L) ของ Order ทั้งหมด
     */
    updateFloatingPnL(symbol, currentPrice) {
        if (!this.openOrders || this.openOrders.length === 0) return;
        let changed = false;
        for (const order of this.openOrders) {
            if (order.symbol !== symbol) continue;
            const isGold = order.symbol.includes('XAU') || order.symbol.includes('GOLD');
            const pointVal = isGold ? 100 : (order.symbol.includes('EUR') ? 100000 : 1);
            let pnl = 0;
            if (order.type === 'BUY') {
                pnl = (currentPrice - order.entryPrice) * order.lot * pointVal;
            } else {
                pnl = (order.entryPrice - currentPrice) * order.lot * pointVal;
            }
            order.floatingPnl = Number(pnl.toFixed(2));
            changed = true;
        }

        if (changed) {
            this.notifyOrderUpdate();
        }
    }

    /**
     * ตรวจสอบว่าแท่งเทียนใหม่ชน TP หรือ SL หรือไม่ (ในโหมด Backtest Replay)
     * - หาก SL และ TP ถูกแตะในแท่งเดียวกัน (gap/volatile candle) ให้ SL มีผลก่อน (worst case)
     * - ไม่ตรวจแท่งที่เพิ่ง Entry เพื่อป้องกัน same-bar trigger
     */
    checkOrdersExecution() {
        const toClose = [];
        for (const order of this.openOrders) {
            const candle = this.chartEngine.getLatestVisibleCandle(order.symbol);
            if (!candle) continue;

            // ข้ามแท่งที่เพิ่ง Entry เข้ามาในแท่งเดียวกัน (same-bar entry guard)
            if (order.entryTime && candle.time === order.entryTime) continue;

            if (order.type === 'BUY') {
                const hitSL = order.sl && candle.low <= order.sl;
                const hitTP = order.tp && candle.high >= order.tp;
                // SL มีผลก่อนในกรณีที่ทั้ง SL และ TP ถูกแตะพร้อมกัน (worst-case realism)
                if (hitSL) {
                    toClose.push({ id: order.id, price: order.sl, reason: 'HIT SL' });
                } else if (hitTP) {
                    toClose.push({ id: order.id, price: order.tp, reason: 'HIT TP' });
                }
            } else if (order.type === 'SELL') {
                const hitSL = order.sl && candle.high >= order.sl;
                const hitTP = order.tp && candle.low <= order.tp;
                if (hitSL) {
                    toClose.push({ id: order.id, price: order.sl, reason: 'HIT SL' });
                } else if (hitTP) {
                    toClose.push({ id: order.id, price: order.tp, reason: 'HIT TP' });
                }
            }
        }

        for (const item of toClose) {
            this.closeOrder(item.id, item.price, item.reason);
        }
    }

    /**
     * ตรวจสอบว่าราคา Live ปัจจุบันชน TP หรือ SL ของ Order จำลองหรือไม่ (ในโหมด Forward Test / Realtime)
     */
    checkLiveOrders(symbol, currentPrice) {
        if (!this.openOrders || this.openOrders.length === 0) return;
        const toClose = [];
        for (const order of this.openOrders) {
            if (order.symbol !== symbol) continue;
            if (order.type === 'BUY') {
                if (order.sl && currentPrice <= order.sl) {
                    toClose.push({ id: order.id, price: order.sl, reason: 'HIT SL' });
                } else if (order.tp && currentPrice >= order.tp) {
                    toClose.push({ id: order.id, price: order.tp, reason: 'HIT TP' });
                }
            } else if (order.type === 'SELL') {
                if (order.sl && currentPrice >= order.sl) {
                    toClose.push({ id: order.id, price: order.sl, reason: 'HIT SL' });
                } else if (order.tp && currentPrice <= order.tp) {
                    toClose.push({ id: order.id, price: order.tp, reason: 'HIT TP' });
                }
            }
        }
        for (const item of toClose) {
            this.closeOrder(item.id, item.price, item.reason);
        }
    }

    /**
     * คำนวณสถิติกลยุทธ์การ Backtest (TradingView Style Performance Summary)
     */
    getBacktestStats() {
        const totalTrades = this.tradeHistory.length;
        if (totalTrades === 0) {
            return {
                totalTrades: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
                netProfit: 0,
                profitFactor: 0,
                maxDrawdown: 0,
                currentBalance: Number(this.balance.toFixed(2))
            };
        }

        let grossProfit = 0;
        let grossLoss = 0;
        let wins = 0;
        let losses = 0;
        let peakBalance = 10000;
        let maxDD = 0;
        let curBal = 10000;

        const chronological = [...this.tradeHistory].reverse();
        for (const t of chronological) {
            if (t.pnl > 0) {
                grossProfit += t.pnl;
                wins++;
            } else {
                grossLoss += Math.abs(t.pnl);
                losses++;
            }
            curBal += t.pnl;
            if (curBal > peakBalance) peakBalance = curBal;
            const dd = peakBalance - curBal;
            if (dd > maxDD) maxDD = dd;
        }

        const winRate = Number(((wins / totalTrades) * 100).toFixed(1));
        const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 99.99 : 0);
        const netProfit = Number((this.balance - 10000).toFixed(2));

        return {
            totalTrades,
            wins,
            losses,
            winRate,
            netProfit,
            profitFactor,
            maxDrawdown: Number(maxDD.toFixed(2)),
            currentBalance: Number(this.balance.toFixed(2))
        };
    }

    /**
     * ล้างประวัติการทดสอบกลยุทธ์ เพื่อเริ่มซ้อมใหม่อีกครั้ง
     */
    resetBacktestSession() {
        this.balance = this.initialBalance || 10000;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('tt_account_balance', this.balance);
        }
        this.openOrders.forEach(o => this.chartEngine.removeOrderLines(o.id));
        this.openOrders = [];
        this.tradeHistory = [];
        this.saveOrdersToStorage();
        this.notifyOrderUpdate();
    }
}

window.ReplayEngine = ReplayEngine;
if (typeof module !== 'undefined') {
    module.exports = { ReplayEngine };
}
