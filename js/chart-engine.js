/**
 * TradingView Multi-Chart Grid Engine
 * จัดการหน้าต่างกราฟ 1, 2, 4, 8, 16 ชาร์ต
 * พร้อมระบบ Crosshair Sync, Volume Profile, และ Custom Timeframe / Range Bars
 */

// =========================================================
// Indicator Presets สำหรับสไตล์การเทรด (Scalping, Daytrade, Swing, etc.)
// =========================================================
// =========================================================
// Indicator Presets สำหรับสไตล์การเทรด (Scalping, Daytrade, Swing, etc.)
// =========================================================
const INDICATOR_PRESETS = {
    'scalping': {
        name: '⚡ Scalping Pro (M1 - M5)',
        badge: 'Scalping',
        description: 'จับจังหวะสวิงเร็ว Momentum แรง เข้าไวออกไวด้วย Fast EMA 9/21, Parabolic SAR (0.02/0.2) และ Fast RSI 7',
        indicators: [
            { type: 'EMA', period: 9, color: '#38bdf8', lineWidth: 1, lineStyle: 'solid', title: 'EMA 9 (Fast)' },
            { type: 'EMA', period: 21, color: '#f472b6', lineWidth: 1, lineStyle: 'solid', title: 'EMA 21 (Trigger)' },
            { type: 'PSAR', step: 0.02, max: 0.20, color: '#34d399', lineWidth: 1, title: 'PSAR (0.02, 0.2)' },
            { type: 'RSI', period: 7, color: '#fbbf24', lineWidth: 1, lineStyle: 'solid', title: 'RSI 7 (Momentum)' }
        ]
    },
    'daytrade': {
        name: '🎯 Day Trading Master (M15 - H1)',
        badge: 'Day Trade',
        description: 'กลยุทธ์เทรดในวันยอดนิยม ใช้ EMA 20/50 เป็น Dynamic S/R, Parabolic SAR (0.015/0.15) และ RSI 14',
        indicators: [
            { type: 'EMA', period: 20, color: '#38bdf8', lineWidth: 1, lineStyle: 'solid', title: 'EMA 20 (Baseline)' },
            { type: 'EMA', period: 50, color: '#fb923c', lineWidth: 1, lineStyle: 'solid', title: 'EMA 50 (Trend)' },
            { type: 'PSAR', step: 0.015, max: 0.15, color: '#34d399', lineWidth: 1, title: 'PSAR (0.015, 0.15)' },
            { type: 'RSI', period: 14, color: '#c084fc', lineWidth: 1, lineStyle: 'solid', title: 'RSI 14' }
        ]
    },
    'swingtrade': {
        name: '🌊 Swing Trading Pro (H4 - D1)',
        badge: 'Swing Trade',
        description: 'เก็งกำไรรอบใหญ่ จับจุดเปลี่ยนแนวโน้ม Golden/Death Cross ด้วย EMA 50/200 และ Parabolic SAR (0.01/0.1)',
        indicators: [
            { type: 'EMA', period: 50, color: '#38bdf8', lineWidth: 1, lineStyle: 'solid', title: 'EMA 50 (Pullback)' },
            { type: 'EMA', period: 200, color: '#f87171', lineWidth: 1, lineStyle: 'solid', title: 'EMA 200 (Major Trend)' },
            { type: 'PSAR', step: 0.01, max: 0.10, color: '#fbbf24', lineWidth: 1, title: 'PSAR (0.01, 0.1)' },
            { type: 'RSI', period: 14, color: '#34d399', lineWidth: 1, lineStyle: 'solid', title: 'RSI 14' }
        ]
    },
    'trendmaster': {
        name: '📈 Trend Master (SMA Triple + SAR)',
        badge: 'Trend Following',
        description: 'ไตรภาคีเส้นค่าเฉลี่ย 3 เส้น (SMA 20, 50, 200) ผสาน Parabolic SAR เพื่อยืนยันแนวโน้มขาขึ้น/ลงแข็งแกร่ง',
        indicators: [
            { type: 'SMA', period: 20, color: '#38bdf8', lineWidth: 1, lineStyle: 'solid', title: 'SMA 20 (Fast)' },
            { type: 'SMA', period: 50, color: '#fb923c', lineWidth: 1, lineStyle: 'solid', title: 'SMA 50 (Med)' },
            { type: 'SMA', period: 200, color: '#f87171', lineWidth: 1, lineStyle: 'dashed', title: 'SMA 200 (Slow)' },
            { type: 'PSAR', step: 0.02, max: 0.20, color: '#34d399', lineWidth: 1, title: 'PSAR (0.02, 0.2)' }
        ]
    },
    'pullback_rsi': {
        name: '🔄 Mean Reversion & Reversal',
        badge: 'Pullback / Reversion',
        description: 'จับจังหวะ Oversold / Overbought และ Pullback พร้อม SMA ซ้อนบนเส้น RSI และ Parabolic SAR',
        indicators: [
            { type: 'EMA', period: 20, color: '#38bdf8', lineWidth: 1, lineStyle: 'solid', title: 'EMA 20' },
            { type: 'PSAR', step: 0.02, max: 0.20, color: '#f87171', lineWidth: 1, title: 'PSAR (Trailing Stop)' },
            { type: 'RSI', period: 14, color: '#f472b6', lineWidth: 1, lineStyle: 'solid', title: 'RSI 14' },
            { type: 'SMA', period: 9, color: '#fbbf24', lineWidth: 1, lineStyle: 'dashed', title: 'SMA 9 on RSI', parentType: 'RSI' }
        ]
    }
};

class ChartEngine {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.charts = []; // Array of chart cell objects { id, element, chart, candleSeries, volumeSeries, vpCanvas, symbol, timeframe, isRangeBar, rangeSize, rawM1, resampledCandles, indicators }
        this.layout = '2x2'; // Default 4 charts ('1x1', '2x1', '2x2', '4x2', '4x4')
        this.activeChartIndex = 0;
        this.isCrosshairSync = true;
        this.isVolumeProfileVisible = true;
        this.isAutoScrollToLatest = (localStorage.getItem('tradingtools_auto_scroll') !== 'false'); // ค่าเริ่มต้นเปิดใช้งานเสมอ
        this.replayTime = null;

        // Default symbols and timeframes for multi-chart view
        this.defaultConfigs = [
            { symbol: 'XAUUSD', timeframe: '15m', title: 'XAUUSD 15M (Execution)' },
            { symbol: 'XAUUSD', timeframe: '1h',  title: 'XAUUSD 1H (Intermediate)' },
            { symbol: 'XAUUSD', timeframe: '4h',  title: 'XAUUSD 4H (Higher Trend)' },
            { symbol: 'BTCUSD', timeframe: '15m', title: 'BTCUSD 15M' },
            { symbol: 'EURUSD', timeframe: '1h',  title: 'EURUSD 1H' },
            { symbol: 'GBPUSD', timeframe: '1h',  title: 'GBPUSD 1H' },
            { symbol: 'USDJPY', timeframe: '1h',  title: 'USDJPY 1H' },
            { symbol: 'XAGUSD', timeframe: '1h',  title: 'Silver 1H' },
            // Additional configs for 16-chart grid
            { symbol: 'XAUUSD', timeframe: '5m',  title: 'XAUUSD 5M' },
            { symbol: 'XAUUSD', timeframe: '1d',  title: 'XAUUSD Daily' },
            { symbol: 'BTCUSD', timeframe: '1h',  title: 'BTCUSD 1H' },
            { symbol: 'ETHUSD', timeframe: '1h',  title: 'ETHUSD 1H' },
            { symbol: 'SOLUSD', timeframe: '1h',  title: 'SOLUSD 1H' },
            { symbol: 'USOIL',   timeframe: '1h', title: 'Crude Oil 1H' },
            { symbol: 'AUDUSD',  timeframe: '1h', title: 'AUDUSD 1H' },
            { symbol: 'NZDUSD',  timeframe: '1h', title: 'NZDUSD 1H' }
        ];

        // Cache for Raw M1 market datasets
        this.rawCache = {};

        // Timezone ประเทศไทย (Asia/Bangkok, UTC+7 / GMT+7)
        this.thailandOffset = 7 * 3600; // 25,200 วินาที

        // ตัวจับเวลาขยับกราฟแบบ Live Real-time Ticker ตาม Timeframe
        this.liveTickerInterval = null;
        this.liveCryptoPrices = {};
        this.cachedLiveRates = {};
        this.sseEventSource = null;
        this.initLiveStreamSSE();
        this.initBinanceWebSocket();
        this.startLiveTicker();

        // Background M1 Candle Sync Engine (ดึงแท่งเทียนสดจาก MT5 Backend ต่อเนื่อง 0 Latency)
        this.backgroundSyncInterval = null;
        this.startBackgroundCandleSync();

        // ตัวจับเวลานับถอยหลังการจบแท่งเทียน (Candle Countdown Timer - MT5 / TradingView Style)
        this.countdownInterval = null;
        this.startCandleCountdownTimer();

        // โหลดการตั้งค่าเดิมที่บันทึกไว้ใน localStorage (Layout, Symbols, Timeframes, Vol/VP toggles)
        this.loadSettingsFromStorage();

        // เครื่องมือวัดระยะ (Measure Tool) และ Fibonacci Retracement
        this.isMeasureActive = false;
        this.isFibonacciActive = false;

        // Interactive Drawing Tools Engine (Trendline, HorzLine, HorzRay, VertLine, Rectangle, Path, Text, Long/Short Position, Price Alert)
        this.activeDrawingTool = null;
        this.pendingTextCoords = null;
        this.theme = localStorage.getItem('tradingtools_theme') || 'dark';

        // ระบบแจ้งเตือนราคาแบบเรียลไทม์ (Price Alerts Engine)
        this.priceAlerts = this.loadPriceAlerts();
        this.lastKnownAlertPrice = {};

        // คีย์ลัด Alt+R รีเซ็ตกราฟ, Alt+F วาด Fibonacci, Alt+M วัดระยะ, Shift สำหรับ Fast Measure, Delete ลบภาพวาด, และ Escape เคลียร์การวาด
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                document.body.classList.add('shift-measure-active');
            }
            if (e.altKey && (e.key === 'r' || e.key === 'R')) {
                e.preventDefault();
                this.resetChartScale(this.activeChartIndex);
            }
            if (e.altKey && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                this.toggleFibonacciTool();
            }
            if (e.altKey && (e.key === 'm' || e.key === 'M')) {
                e.preventDefault();
                this.toggleMeasureTool();
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                    this.deleteSelectedDrawing();
                }
            }
            if (e.key === '+' || e.key === '=') {
                if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                    const cell = this.charts[this.activeChartIndex];
                    if (cell && cell.selectedDrawingId) {
                        this.scaleTextDrawing(this.activeChartIndex, cell.selectedDrawingId, 2);
                    }
                }
            }
            if (e.key === '-' || e.key === '_') {
                if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                    const cell = this.charts[this.activeChartIndex];
                    if (cell && cell.selectedDrawingId) {
                        this.scaleTextDrawing(this.activeChartIndex, cell.selectedDrawingId, -2);
                    }
                }
            }
            if (e.key === 'Escape') {
                this.cancelInlineText();
                if (this.activeDrawingTool) {
                    this.setDrawingTool(null);
                    this.charts.forEach(c => {
                        c.currentDrawing = null;
                        this.updateOverlays(c);
                    });
                }
                this.deselectAllDrawings();
                this.clearAllMeasurements();
                this.clearAllFibonacci();
                this.clearActiveOrderLines();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                document.body.classList.remove('shift-measure-active');
            }
        });
    }

    /**
     * โหลดการตั้งค่า Layout และข้อมูลช่องกราฟจาก localStorage
     */
    loadSettingsFromStorage() {
        try {
            const savedLayout = localStorage.getItem('tradingtools_layout');
            if (savedLayout) {
                this.layout = savedLayout;
            }
            const savedConfigs = localStorage.getItem('tradingtools_chart_configs');
            if (savedConfigs) {
                const parsed = JSON.parse(savedConfigs);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsed.forEach((cfg, idx) => {
                        if (idx < this.defaultConfigs.length) {
                            this.defaultConfigs[idx] = { ...this.defaultConfigs[idx], ...cfg };
                        } else {
                            this.defaultConfigs.push(cfg);
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('Could not load chart settings from storage', e);
        }
    }

    /**
     * บันทึกการตั้งค่า Layout, Symbols, Timeframe, และสถานะปุ่ม Vol/VP ลง localStorage
     */
    saveSettingsToStorage() {
        try {
            localStorage.setItem('tradingtools_layout', this.layout);
            const configs = this.charts.map(c => ({
                symbol: c.symbol,
                timeframe: c.timeframe,
                showVolume: c.showVolume,
                showVolumeProfile: c.showVolumeProfile,
                showFootprint: c.showFootprint,
                showPatterns: c.showPatterns,
                isRangeBar: c.isRangeBar,
                rangeSize: c.rangeSize,
                isTickBar: c.isTickBar,
                ticksPerBar: c.ticksPerBar,
                indicators: (c.indicators || []).map(ind => ({
                    id: ind.id,
                    type: ind.type,
                    period: ind.period,
                    step: ind.step,
                    max: ind.max,
                    color: ind.color,
                    lineWidth: ind.lineWidth,
                    lineStyle: ind.lineStyle,
                    parentIndicatorId: ind.parentIndicatorId || null,
                    title: ind.title
                }))
            }));
            localStorage.setItem('tradingtools_chart_configs', JSON.stringify(configs));
        } catch (e) {
            console.warn('Could not save chart settings to storage', e);
        }
    }

    /**
     * กำหนด Layout ตารางชาร์ต (สมมาตร: 1, 2, 4, 8, 16 และไม่สมมาตร: 1L-2R, 2L-1R, 1T-2B, 2T-1B, 1L-3R, 3x1)
     */
    async setLayout(layout) {
        // 1. Snapshot config ของทุกชาร์ตที่กำลังแสดงอยู่ ก่อนทำลายชาร์ตเก่า
        //    เพื่อให้ Layout ใหม่สามารถนำ Symbol / TF / Settings เดิมกลับมาใช้ได้
        if (this.charts && this.charts.length > 0) {
            this.charts.forEach((c, idx) => {
                const snapshot = {
                    symbol: c.symbol,
                    timeframe: c.timeframe,
                    showVolume: c.showVolume,
                    showVolumeProfile: c.showVolumeProfile,
                    showFootprint: c.showFootprint,
                    showPatterns: c.showPatterns,
                    isRangeBar: c.isRangeBar,
                    rangeSize: c.rangeSize,
                    isTickBar: c.isTickBar,
                    ticksPerBar: c.ticksPerBar,
                    indicators: (c.indicators || []).map(ind => ({
                        id: ind.id,
                        type: ind.type,
                        period: ind.period,
                        step: ind.step,
                        max: ind.max,
                        color: ind.color,
                        lineWidth: ind.lineWidth,
                        lineStyle: ind.lineStyle,
                        parentIndicatorId: ind.parentIndicatorId || null,
                        title: ind.title
                    }))
                };
                // อัปเดต defaultConfigs ตามดัชนีที่ตรงกัน หรือเพิ่มใหม่
                if (idx < this.defaultConfigs.length) {
                    this.defaultConfigs[idx] = { ...this.defaultConfigs[idx], ...snapshot };
                } else {
                    this.defaultConfigs.push(snapshot);
                }
            });
        }

        this.layout = layout;
        let count = 1;
        if (layout === '1x1') count = 1;
        else if (layout === '2x1') count = 2;
        else if (layout === '2x2') count = 4;
        else if (layout === '4x2') count = 8;
        else if (layout === '4x4') count = 16;
        else if (layout === '1L-2R' || layout === '2L-1R' || layout === '1T-2B' || layout === '2T-1B' || layout === '3x1') count = 3;
        else if (layout === '1L-3R' || layout === '3L-1R') count = 4;

        this.container.className = `chart-grid layout-${layout}`;
        // 2. Await การ rebuild เพื่อให้ this.charts ถูกสร้างเสร็จก่อน save
        await this.rebuildGrid(count);
        // 3. Save หลัง rebuild เสร็จ — this.charts มีข้อมูลครบแล้ว
        this.saveSettingsToStorage();
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 60);
    }

    /**
     * โหลด Raw Data จาก MT5 API Endpoint หรือ data/{symbol}_1m.json
     */
    async getRawM1Data(symbol) {
        const now = Date.now();
        if (!this.rawCacheTime) this.rawCacheTime = {};

        // ใช้ Cache ไม่เกิน 4 วินาที เพื่อให้กราฟดึงแท่งเทียนสดล่าสุดจาก MT5 เสมอ
        if (this.rawCache[symbol] && (now - (this.rawCacheTime[symbol] || 0) < 4000)) {
            return this.rawCache[symbol];
        }

        let baseCandles = [];

        // 1. ดึงจาก RAM Cache Endpoint /api/candles (Realtime 0 Latency จาก MT5 หรือ Server Poller ประวัติระดับโปร 100,000 แท่ง)
        try {
            const resp = await fetch(`/api/candles?symbol=${symbol}&count=100000&t=${now}`, { cache: 'no-store' });
            if (resp.ok) {
                const resJson = await resp.json();
                if (resJson.status === 'ok' && resJson.candles && resJson.candles.length > 0) {
                    baseCandles = resJson.candles;
                }
            }
        } catch (e) {}

        // 2. หากยังไม่มี ให้โหลดประวัติศาสตร์จากไฟล์ static data/{symbol}_1m.json
        if (!baseCandles || baseCandles.length === 0) {
            try {
                const resp = await fetch(`data/${symbol}_1m.json?t=${now}`, { cache: 'no-store' });
                if (resp.ok) {
                    const data = await resp.json();
                    if (Array.isArray(data) && data.length > 0) {
                        baseCandles = data;
                    }
                }
            } catch (e) {
                console.warn(`Could not load local data for ${symbol}`, e);
            }
        }

        // ผสานเข้ากับแคชในหน่วยความจำเดิมถ้ามี เพื่อรักษาประวัติศาสตร์ Backtest เต็ม
        if (this.rawCache[symbol] && this.rawCache[symbol].length > 0) {
            const timeMap = new Map();
            for (const c of this.rawCache[symbol]) timeMap.set(c.time, c);
            for (const c of baseCandles) timeMap.set(c.time, c);
            baseCandles = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
        }

        // 3. ระบบ Auto Gap-Bridging อัจฉริยะ (เชื่อมช่องว่างเวลาสดตลอด 24/7 ไม่ให้กราฟกระโดด)
        // ดึงแท่งเทียนสด 1,000 แท่งล่าสุดจาก Binance Spot Klines (PAXG สำหรับทองคำ, BTC, ETH, SOL)
        // มาเติมช่องว่างระหว่างประวัติศาสตร์เดิมกับเวลาปัจจุบันแบบไร้รอยต่อ
        const isBtc = symbol.includes('BTC');
        const isEth = symbol.includes('ETH');
        const isSol = symbol.includes('SOL');
        const isGold = symbol.includes('XAU') || symbol.includes('GOLD');

        if (isBtc || isEth || isSol || isGold) {
            try {
                let binanceSym = isGold ? 'PAXGUSDT' : (isBtc ? 'BTCUSDT' : (isEth ? 'ETHUSDT' : 'SOLUSDT'));
                let decimals = isGold ? 2 : 2;
                const bResp = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=1m&limit=1000`);
                if (bResp.ok) {
                    const rawKlines = await bResp.json();
                    if (Array.isArray(rawKlines) && rawKlines.length > 0) {
                        const freshCandles = rawKlines.map(k => ({
                            time: Math.floor(k[0] / 1000) + this.thailandOffset,
                            open: Number(parseFloat(k[1]).toFixed(decimals)),
                            high: Number(parseFloat(k[2]).toFixed(decimals)),
                            low: Number(parseFloat(k[3]).toFixed(decimals)),
                            close: Number(parseFloat(k[4]).toFixed(decimals)),
                            volume: Math.round(parseFloat(k[5]))
                        }));

                        // ผสานแท่งเทียนสด 1,000 แท่งล่าสุดเข้ากับประวัติศาสตร์เดิม เชื่อม Gap ทันที
                        const timeMap = new Map();
                        for (const c of baseCandles) timeMap.set(c.time, c);
                        for (const c of freshCandles) timeMap.set(c.time, c);
                        baseCandles = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
                    }
                }
            } catch (e) {
                console.warn(`[Auto Gap-Bridging] Failed for ${symbol} via Binance:`, e);
            }
        }

        if (baseCandles && baseCandles.length > 0) {
            this.rawCache[symbol] = baseCandles;
            this.rawCacheTime[symbol] = now;
            return baseCandles;
        }

        // 4. Fallback generator กรณีไม่พบข้อมูลเลย
        const basePrice = symbol.includes('BTC') ? 76000 : (symbol.includes('XAU') ? 4345.000 : 1.15300);
        const data = this.generateSampleData(symbol, basePrice, 3000);
        this.rawCache[symbol] = data;
        this.rawCacheTime[symbol] = now;
        return data;
    }

    generateSampleData(symbol, basePrice, count = 1500) {
        const candles = [];
        let price = basePrice;
        // เวลาฐานอ้างอิงตามเวลาประเทศไทย (UTC+7)
        const now = Math.floor(Date.now() / 1000) + this.thailandOffset;
        const start = now - (count * 60);

        const isGold = symbol.includes('XAU') || symbol.includes('GOLD');
        const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);

        for (let i = 0; i < count; i++) {
            const time = start + (i * 60);
            const delta = (Math.random() - 0.49) * (basePrice * 0.001);
            const open = price;
            const close = price + delta;
            const high = Math.max(open, close) + (Math.random() * (basePrice * 0.0006));
            const low = Math.min(open, close) - (Math.random() * (basePrice * 0.0006));
            const vol = Math.floor(Math.random() * 200) + 50;

            candles.push({
                time,
                open: Number(open.toFixed(decimals)),
                high: Number(high.toFixed(decimals)),
                low: Number(low.toFixed(decimals)),
                close: Number(close.toFixed(decimals)),
                volume: vol
            });
            price = close;
        }
        return candles;
    }

    /**
     * สร้างตารางชาร์ตใหม่ทั้งหมด
     */
    async rebuildGrid(count) {
        // ทำลายชาร์ตเดิมเพื่อเคลียร์หน่วยความจำ
        this.charts.forEach(c => {
            if (c.chart) c.chart.remove();
        });
        this.charts = [];
        this.container.innerHTML = '';

        for (let i = 0; i < count; i++) {
            const config = this.defaultConfigs[i] || { symbol: 'XAUUSD', timeframe: '1h' };
            await this.createChartCell(i, config.symbol, config.timeframe, config);
        }

        // Setup Crosshair Synchronizer
        this.setupCrosshairSync();

        // ซิงค์วาดเส้น Order ที่เปิดค้างอยู่ลงบนทุกชาร์ตใหม่อัตโนมัติ
        this.redrawAllOrders();

        // เลื่อนกราฟไปยังแท่งล่าสุดหากเปิด Auto-Scroll
        if (this.isAutoScrollToLatest) {
            this.scrollToAllLatestBars();
        }
        this.updateAutoScrollUI();
    }

    /**
     * สร้างชาร์ต 1 Cell ใน Grid
     */
    async createChartCell(index, symbol, timeframe, initialConfig = {}) {
        const cellEl = document.createElement('div');
        cellEl.className = `chart-cell ${index === this.activeChartIndex ? 'active' : ''}`;
        cellEl.dataset.index = index;

        const isVolActive = initialConfig.showVolume !== undefined ? initialConfig.showVolume : true;
        const isVpActive = initialConfig.showVolumeProfile !== undefined ? initialConfig.showVolumeProfile : true;
        const isFpActive = initialConfig.showFootprint !== undefined ? initialConfig.showFootprint : false;
        const isPatActive = initialConfig.showPatterns !== undefined ? initialConfig.showPatterns : false;

        // Cell Header / Toolbar with Independent Vol, VP, Footprint, and Pattern Toggles
        cellEl.innerHTML = `
            <div class="chart-cell-header">
                <div class="cell-title">
                    <span class="cell-symbol clickable-symbol" onclick="window.app.openSymbolSelector(${index}, event)" title="แตะเพื่อเลือกเปลี่ยนคู่เงิน">${symbol} <span class="sym-chevron">▾</span></span>
                    <span class="cell-tf-badge" onclick="window.app.openTimeframePicker(${index}, event)" title="แตะเพื่อเปลี่ยน Timeframe">${timeframe}</span>
                    <span class="cell-countdown-badge" id="cell-countdown-${index}" title="เวลาที่เหลือก่อนจบแท่งเทียน (Candle Countdown)"><span class="countdown-dot"></span><span class="countdown-text">--:--</span></span>
                </div>
                <div class="cell-tools">
                    <button class="cell-tool-btn" title="เปลี่ยน Timeframe ในช่องนี้" onclick="window.app.openTimeframePicker(${index}, event)">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>
                    </button>
                    <button class="cell-tool-btn" title="เพิ่มอินดิเคเตอร์ (Indicators)" onclick="window.app.openIndicatorModal(${index})">
                        <span style="font-weight:700;font-family:serif;font-style:italic;font-size:11px;color:#38bdf8;">fx</span>
                    </button>
                    <button class="cell-tool-btn" id="btn-cell-measure-${index}" title="วัดระยะบนชาร์ตนี้" onclick="window.app.toggleMeasureTool(${index})">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;"><path d="M21.3 15.3l-6.6 6.6a1 1 0 01-1.4 0l-11-11a1 1 0 010-1.4l6.6-6.6a1 1 0 011.4 0l11 11a1 1 0 010 1.4zM7.5 4.5l2 2m-1 3l3 3m-1 3l2 2m-1 3l3 3"/></svg>
                    </button>
                    <button class="cell-tool-btn" id="btn-cell-fibo-${index}" title="วาด Fibonacci Retracement บนชาร์ตนี้" onclick="window.app.toggleFibonacciTool(${index})">
                        <span style="font-weight:700;font-size:10px;color:#eab308;">FIB</span>
                    </button>
                    <button class="cell-tool-btn ${isVolActive ? 'active' : ''}" id="btn-vol-${index}" title="ปิด/เปิด Volume แท่งแนวตั้ง" onclick="window.app.toggleCellVolume(${index})">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                    </button>
                    <button class="cell-tool-btn ${isVpActive ? 'active' : ''}" id="btn-vp-${index}" title="ปิด/เปิด Volume Profile แนวนอน (VPVR)" onclick="window.app.toggleCellVP(${index})">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;"><path d="M3 3v18h18M7 16h4M7 12h8M7 8h12"/></svg>
                    </button>
                    <button class="cell-tool-btn ${isFpActive ? 'active' : ''}" id="btn-fp-${index}" title="ปิด/เปิด Volume Footprint (Order Flow)" onclick="window.app.toggleCellFootprint(${index})">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    </button>
                    <button class="cell-tool-btn ${isPatActive ? 'active' : ''}" id="btn-pat-${index}" title="ปิด/เปิด รูปแบบราคาอัตโนมัติ (Elliott Wave, H&S, Flags)" onclick="window.app.toggleCellPatterns(${index})">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;"><path d="M3 20h18L12 4z"/></svg>
                    </button>
                </div>
            </div>

            <!-- Floating Overlay HUD inside Chart (สำหรับ Display Mode และมุมมองเต็มจอ ไร้แถบหัวชาร์ต) -->
            <div class="chart-display-hud" id="chart-hud-${index}">
                <span class="hud-symbol clickable-symbol" onclick="window.app.openSymbolSelector(${index}, event)" title="แตะเพื่อเลือกเปลี่ยนคู่เงิน">${symbol} <span class="sym-chevron" style="font-size: 8px;">▾</span></span>
                <span class="hud-tf-badge" onclick="window.app.openTimeframePicker(${index}, event)" title="แตะเพื่อเปลี่ยน Timeframe">${timeframe}</span>
                <span class="hud-countdown-badge" id="hud-countdown-${index}" title="เวลาที่เหลือก่อนจบแท่งเทียน (Candle Countdown)"><span class="countdown-dot"></span><span class="hud-countdown-text">--:--</span></span>
            </div>

            <div class="chart-viewport" id="chart-viewport-${index}"></div>
            <canvas class="vp-canvas" id="vp-canvas-${index}"></canvas>
            <div class="measure-floating-badge" id="measure-badge-${index}" style="display: none;">
                <span>📏 วัดระยะ</span>
                <button type="button" class="btn-del-measure" onclick="window.chartEngine.clearCellMeasurement(${index})" title="ลบการวัดระยะบนชาร์ตนี้">✕</button>
            </div>
            <div class="fibo-floating-badge" id="fibo-badge-${index}" style="display: none;">
                <span>📐 Fibonacci</span>
                <button type="button" class="btn-del-fibo" onclick="window.chartEngine.clearCellFibonacci(${index})" title="ลบเส้น Fibonacci บนชาร์ตนี้">✕</button>
            </div>
        `;

        const activateCell = () => {
            if (this.activeChartIndex !== index) {
                this.setActiveChart(index);
            }
        };

        cellEl.addEventListener('click', activateCell);
        this.container.appendChild(cellEl);

        const viewport = cellEl.querySelector(`#chart-viewport-${index}`);
        const vpCanvas = cellEl.querySelector(`#vp-canvas-${index}`);

        // กำหนดธีมเริ่มต้นของชาร์ต (รองรับ Neumorphic Light Mode และ Dark Mode)
        const isLight = (this.theme === 'light');
        const chartBg = isLight ? '#ebf0f7' : '#0f1118';
        const chartTextColor = isLight ? '#1e293b' : '#8e9aa8';
        const gridColor = isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.04)';
        const borderColor = isLight ? '#c8d3e2' : '#1e2330';
        const crosshairColor = isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.3)';

        // สร้าง TradingView Lightweight Chart
        const chart = LightweightCharts.createChart(viewport, {
            layout: {
                background: { color: chartBg },
                textColor: chartTextColor,
                fontSize: 11
            },
            grid: {
                vertLines: { color: gridColor },
                horzLines: { color: gridColor }
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: crosshairColor, width: 1, style: 2 },
                horzLine: { color: crosshairColor, width: 1, style: 2 }
            },
            timeScale: {
                borderColor: borderColor,
                timeVisible: true,
                secondsVisible: false
            },
            rightPriceScale: {
                borderColor: borderColor,
                autoScale: true
            }
        });

        // สลับ Active Chart ทันทีเมื่อคลิกหรือเลื่อนเคอร์เซอร์บนชาร์ต
        chart.subscribeClick(() => {
            this.setActiveChart(index);
        });
        chart.subscribeCrosshairMove((param) => {
            if (param && param.point) {
                if (this.activeChartIndex !== index) {
                    this.setActiveChart(index);
                }
            }
        });

        const candleSeries = chart.addCandlestickSeries({
            upColor: '#089981',
            downColor: '#f23645',
            borderVisible: false,
            wickUpColor: '#089981',
            wickDownColor: '#f23645'
        });

        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: '',
            scaleMargins: { top: 0.8, bottom: 0 }
        });

        const cellObj = {
            index,
            symbol,
            timeframe,
            element: cellEl,
            container: cellEl,
            viewport,
            vpCanvas,
            canvas: vpCanvas,
            ctx: vpCanvas.getContext('2d'),
            chart,
            candleSeries,
            volumeSeries,
            indicators: [],
            indicatorSeries: new Map(),
            showVolume: isVolActive,
            showVolumeProfile: isVpActive,
            showFootprint: isFpActive,
            showPatterns: isPatActive,
            isRangeBar: initialConfig.isRangeBar || false,
            rangeSize: initialConfig.rangeSize || 2.0,
            isTickBar: initialConfig.isTickBar || false,
            ticksPerBar: initialConfig.ticksPerBar || 250,
            rawM1: [],
            resampledCandles: [],
            visibleCandles: [],
            orderLines: [],
            drawings: this.loadDrawings(initialConfig.symbol || symbol),
            currentDrawing: null,
            selectedDrawingId: null
        };

        this.charts.push(cellObj);

        // คืนค่า Indicators ที่บันทึกไว้ใน localStorage หรือ Snapshot
        if (Array.isArray(initialConfig.indicators) && initialConfig.indicators.length > 0) {
            for (const indCfg of initialConfig.indicators) {
                if (indCfg && indCfg.type) {
                    this.addIndicator(index, indCfg, true /* silent */, true /* skipSave */);
                }
            }
        }

        // ซิงค์การวาด Overlays เมื่อมีการ Pan, Zoom, หรือ Scale กราฟ
        chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
            this.updateOverlays(cellObj);
        });
        chart.timeScale().subscribeVisibleTimeRangeChange(() => {
            this.updateOverlays(cellObj);
        });

        // Resize Observer สำหรับ Canvas Overlay
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    chart.applyOptions({ width, height });
                    vpCanvas.width = width;
                    vpCanvas.height = height;
                    vpCanvas.style.width = `${width}px`;
                    vpCanvas.style.height = `${height}px`;
                    this.updateOverlays(cellObj);
                }
            }
        });
        resizeObserver.observe(viewport);

        // ผูก Context Menu (คลิกขวาเพื่อเทรดด่วน / จัดการ Indicator)
        const handleContextMenu = (e) => {
            e.preventDefault();
            this.setActiveChart(index);
            this.showContextMenu(e, index);
        };
        viewport.addEventListener('contextmenu', handleContextMenu);
        vpCanvas.addEventListener('contextmenu', handleContextMenu);

        // ดับเบิ้ลคลิกเพื่อรีเซ็ตความกว้างและความสูงกลับสู่ค่าปกติทันที (Quick Reset)
        viewport.addEventListener('dblclick', () => {
            this.resetChartScale(index);
        });

        // เครื่องมือวัดระยะ (Measure Tool) & Fibonacci Retracement
        cellObj.measurePhase = 'idle'; // 'idle' | 'measuring' | 'pinned'
        cellObj.fiboPhase = 'idle'; // 'idle' | 'drawing' | 'pinned'

        const getChartCoords = (e, customX, customY) => {
            const rect = (vpCanvas && vpCanvas.getBoundingClientRect().width > 0)
                ? vpCanvas.getBoundingClientRect()
                : viewport.getBoundingClientRect();
            let clientX = (customX !== undefined) ? (customX + rect.left) : e.clientX;
            let clientY = (customY !== undefined) ? (customY + rect.top) : e.clientY;

            // รองรับระบบ Touch บนแท็บเล็ตและมือถือ
            if (customX === undefined && e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else if (customX === undefined && e.changedTouches && e.changedTouches.length > 0) {
                clientX = e.changedTouches[0].clientX;
                clientY = e.changedTouches[0].clientY;
            }

            if (clientX === undefined || clientY === undefined) {
                if (cellObj.fiboCurrent) return { ...cellObj.fiboCurrent };
                if (cellObj.measureCurrent) return { ...cellObj.measureCurrent };
                return { x: 0, y: 0, time: null, price: null };
            }

            const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

            const candles = (cellObj.visibleCandles && cellObj.visibleCandles.length > 0)
                ? cellObj.visibleCandles
                : (cellObj.resampledCandles && cellObj.resampledCandles.length > 0 ? cellObj.resampledCandles : (cellObj.rawM1 || []));

            let time = null;
            if (cellObj.chart && cellObj.chart.timeScale) {
                try {
                    const timeScale = cellObj.chart.timeScale();
                    if (typeof timeScale.coordinateToLogical === 'function') {
                        const logical = timeScale.coordinateToLogical(x);
                        if (logical !== null && typeof logical === 'number' && candles.length > 0) {
                            const idx = Math.round(logical);
                            if (idx >= 0 && idx < candles.length) {
                                time = candles[idx].time;
                            } else if (idx < 0) {
                                const step = (candles.length > 1) ? (candles[1].time - candles[0].time) : 60;
                                time = candles[0].time + idx * step;
                            } else {
                                const lastIdx = candles.length - 1;
                                const step = (candles.length > 1) ? (candles[lastIdx].time - candles[lastIdx - 1].time) : 60;
                                time = candles[lastIdx].time + (idx - lastIdx) * step;
                            }
                        }
                    }
                } catch (err) {}
            }

            // Fallback finding nearest candle along X axis if time is still null
            if (time === null && candles.length > 0) {
                let nearestCandle = null;
                let minDx = Infinity;
                for (let i = 0; i < candles.length; i++) {
                    const c = candles[i];
                    const cx = cellObj.chart.timeScale().timeToCoordinate(c.time);
                    if (cx !== null) {
                        const dist = Math.abs(cx - x);
                        if (dist < minDx) {
                            minDx = dist;
                            nearestCandle = c;
                        }
                    }
                }
                if (nearestCandle) {
                    time = nearestCandle.time;
                }
            }

            if (time === null && candles.length > 0) {
                if (x <= 20) time = candles[0].time;
                else time = candles[candles.length - 1].time;
            }
            if (time === null) {
                time = Math.floor(Date.now() / 1000) + this.thailandOffset;
            }

            let price = (cellObj.candleSeries && typeof cellObj.candleSeries.coordinateToPrice === 'function')
                ? cellObj.candleSeries.coordinateToPrice(y)
                : null;
            if (price === null && cellObj.candleSeries && typeof cellObj.candleSeries.coordinateToPrice === 'function') {
                price = cellObj.candleSeries.coordinateToPrice(Math.max(10, Math.min(rect.height - 10, y)));
            }
            if (price === null && candles.length > 0) {
                price = candles[candles.length - 1].close;
            }
            if (price === null) {
                price = 2000;
            }

            return { x, y, time, price };
        };

        // =========================================================
        // Click-to-Activate & Draggable Order TP / SL System & Tool Handlers
        // =========================================================
        let lastDownStamp = 0;
        const onViewportPointerDown = (e) => {
            if (e.button !== undefined && e.button !== 0) return; // Left click or touch
            if (e.timeStamp && e.timeStamp === lastDownStamp) return;
            lastDownStamp = e.timeStamp;
            this.setActiveChart(index);

            const coords = getChartCoords(e);

            // 0. ตรวจสอบคลิกปุ่ม [✕] เพื่อลบการแจ้งเตือนราคา (Price Alert) หรือภาพวาดที่กำลัง Active ทันที
            const hitAlert = this.getAlertHitTest(cellObj, coords.x, coords.y);
            if (hitAlert) {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                if (hitAlert.action === 'delete') {
                    this.deletePriceAlert(cellObj.symbol, hitAlert.alertId);
                }
                return;
            }

            const hitDeleteBtn = this.getDrawingDeleteButtonHit(cellObj, coords.x, coords.y);
            if (hitDeleteBtn) {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                this.deleteDrawingById(cellObj.index, hitDeleteBtn.drawingId);
                return;
            }

            const hit = this.getOrderHitTest(cellObj, coords.x, coords.y);

            // 0.1 ถ้าอยู่ในโหมดเครื่องมือวาด (Interactive Drawing Tool Mode)
            if (this.activeDrawingTool) {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                if (coords.time !== null && coords.price !== null) {
                    this.handleDrawingPointerDown(cellObj, coords);
                }
                return;
            }

            // 1. ตรวจสอบปุ่มลบ TP, ลบ SL, หรือปิด Order ทันที
            if (hit && (hit.type === 'DELETE_TP' || hit.type === 'DELETE_SL' || hit.type === 'CLOSE_ORDER')) {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();

                cellObj.activeOrderLine = null;
                viewport.style.cursor = '';

                if (hit.type === 'DELETE_TP') {
                    if (window.replayEngine) window.replayEngine.removeOrderTP(hit.orderId);
                } else if (hit.type === 'DELETE_SL') {
                    if (window.replayEngine) window.replayEngine.removeOrderSL(hit.orderId);
                } else if (hit.type === 'CLOSE_ORDER') {
                    if (window.replayEngine) window.replayEngine.closeOrder(hit.orderId);
                }
                this.updateOverlays(cellObj);
                return;
            }

            // 2. ถ้ามีเส้นที่กำลัง Active อยู่บนชาร์ตนี้ -> คลิกเพื่อ CONFIRM & LOCK ตำแหน่งใหม่
            if (cellObj.activeOrderLine) {
                const now = Date.now();
                const timeSinceActivated = now - (cellObj.activeOrderLine.pointerDownTime || 0);
                if (timeSinceActivated > 150) {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();

                    const active = cellObj.activeOrderLine;
                    cellObj.activeOrderLine = null;
                    viewport.style.cursor = '';

                    const targetType = active.type === 'ENTRY_PULL' ? active.resolvedTarget : active.type;
                    if (targetType === 'TP') {
                        if (window.replayEngine) window.replayEngine.updateOrderSLTP(active.orderId, undefined, active.currentPrice);
                        this.showToast(`🎯 ล็อค Take Profit ที่ ${active.currentPrice} เรียบร้อยแล้ว`);
                    } else if (targetType === 'SL') {
                        if (window.replayEngine) window.replayEngine.updateOrderSLTP(active.orderId, active.currentPrice, undefined);
                        this.showToast(`🛑 ล็อค Stop Loss ที่ ${active.currentPrice} เรียบร้อยแล้ว`);
                    }
                    this.updateOverlays(cellObj);
                    return;
                }
            }

            // 3. ถ้าอยู่ในโหมด Fibonacci หรือ Measure Tool
            if (this.isFibonacciActive) {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                if (coords.time === null || coords.price === null) return;

                if (!cellObj.fiboPhase || cellObj.fiboPhase === 'idle' || cellObj.fiboPhase === 'pinned') {
                    cellObj.fiboStart = { ...coords };
                    cellObj.fiboCurrent = { ...coords };
                    cellObj.fiboPinned = false;
                    cellObj.fiboPhase = 'drawing';
                    this.updateOverlays(cellObj);
                } else if (cellObj.fiboPhase === 'drawing') {
                    const dx = coords.x - cellObj.fiboStart.x;
                    const dy = coords.y - cellObj.fiboStart.y;
                    if (Math.hypot(dx, dy) > 2) {
                        cellObj.fiboCurrent = { ...coords };
                        cellObj.fiboPinned = true;
                        cellObj.fiboPhase = 'idle';
                        this.toggleFibonacciTool(false);
                        this.updateOverlays(cellObj);
                        this.showToast('✓ ล็อคระดับ Fibonacci แล้ว (สามารถเลื่อนและย่อขยายกราฟได้ทันที)');
                    }
                }
                return;
            }

            if (this.isMeasureActive || e.shiftKey) {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                if (coords.time === null || coords.price === null) return;

                if (!cellObj.measurePhase || cellObj.measurePhase === 'idle' || cellObj.measurePhase === 'pinned') {
                    cellObj.measureStart = { ...coords };
                    cellObj.measureCurrent = { ...coords };
                    cellObj.measurePinned = false;
                    cellObj.measurePhase = 'measuring';
                    this.updateOverlays(cellObj);
                } else if (cellObj.measurePhase === 'measuring') {
                    const dx = coords.x - cellObj.measureStart.x;
                    const dy = coords.y - cellObj.measureStart.y;
                    if (Math.hypot(dx, dy) > 2) {
                        cellObj.measureCurrent = { ...coords };
                        cellObj.measurePinned = true;
                        cellObj.measurePhase = 'idle';
                        this.toggleMeasureTool(false);
                        this.updateOverlays(cellObj);
                        this.showToast('✓ ล็อคการวัดระยะแล้ว');
                    }
                }
                return;
            }

            // 4. ตรวจสอบคลิกบน Order Interaction (คลิกเลือกเส้น TP/SL/Entry ให้ Active)
            if (hit) {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();

                cellObj.selectedOrderId = hit.orderId;

                // คลิกเลือกเส้น TP ให้ Active
                if (hit.type === 'DRAG_TP_TAG' || hit.type === 'DRAG_TP_LINE') {
                    cellObj.activeOrderLine = {
                        orderId: hit.orderId,
                        type: 'TP',
                        order: hit.order,
                        startPrice: hit.order.tp || coords.price,
                        currentPrice: hit.order.tp || coords.price,
                        startY: coords.y,
                        startX: coords.x,
                        currentX: coords.x,
                        currentY: coords.y,
                        pointerDownTime: Date.now(),
                        pointerDownX: coords.x,
                        pointerDownY: coords.y,
                        isMouseDown: true,
                        dragDist: 0,
                        isDragging: false
                    };
                    viewport.style.cursor = 'ns-resize';
                    this.updateOverlays(cellObj);
                    this.showToast('🎯 ปรับเส้น TP: เลื่อนเมาส์ไปที่ราคาเป้าหมาย | คลิกเพื่อล็อค');
                    return;
                }

                // คลิกเลือกเส้น SL ให้ Active
                if (hit.type === 'DRAG_SL_TAG' || hit.type === 'DRAG_SL_LINE') {
                    cellObj.activeOrderLine = {
                        orderId: hit.orderId,
                        type: 'SL',
                        order: hit.order,
                        startPrice: hit.order.sl || coords.price,
                        currentPrice: hit.order.sl || coords.price,
                        startY: coords.y,
                        startX: coords.x,
                        currentX: coords.x,
                        currentY: coords.y,
                        pointerDownTime: Date.now(),
                        pointerDownX: coords.x,
                        pointerDownY: coords.y,
                        isMouseDown: true,
                        dragDist: 0,
                        isDragging: false
                    };
                    viewport.style.cursor = 'ns-resize';
                    this.updateOverlays(cellObj);
                    this.showToast('🛑 ปรับเส้น SL: เลื่อนเมาส์ไปที่ราคาเป้าหมาย | คลิกเพื่อล็อค');
                    return;
                }

                // คลิกเลือกเส้น Entry ให้ Active (ดึงสร้าง TP หรือ SL)
                if (hit.type === 'DRAG_ENTRY_TAG' || hit.type === 'DRAG_ENTRY_LINE') {
                    cellObj.activeOrderLine = {
                        orderId: hit.orderId,
                        type: 'ENTRY_PULL',
                        order: hit.order,
                        startPrice: hit.order.entryPrice,
                        currentPrice: hit.order.entryPrice,
                        startY: coords.y,
                        startX: coords.x,
                        currentX: coords.x,
                        currentY: coords.y,
                        pointerDownTime: Date.now(),
                        pointerDownX: coords.x,
                        pointerDownY: coords.y,
                        resolvedTarget: hit.order.type === 'BUY' ? 'TP' : 'SL',
                        isMouseDown: true,
                        dragDist: 0,
                        isDragging: false
                    };
                    viewport.style.cursor = 'ns-resize';
                    this.updateOverlays(cellObj);
                    this.showToast('✨ ดึงจาก Entry: เลื่อนเมาส์ขึ้น/ลงเพื่อสร้าง TP หรือ SL | คลิกเพื่อล็อค');
                    return;
                }
            } else {
                // คลิกบนพื้นที่ว่างบนกราฟ -> ยกเลิกการเลือก Order (Deselect) เพื่อให้กราฟสะอาดตา
                if (cellObj.selectedOrderId || cellObj.activeOrderLine) {
                    cellObj.selectedOrderId = null;
                    cellObj.activeOrderLine = null;
                    viewport.style.cursor = '';
                    this.updateOverlays(cellObj);
                }

                // ตรวจสอบการคลิกเลือกภาพวาดบนกราฟ (Hit Test Drawings เพื่อเลือก ย้าย ย่อ/ขยาย หรือ ลบ)
                if (!this.isMeasureActive && !this.isFibonacciActive) {
                    const hitDrawing = this.getDrawingHitTest(cellObj, coords.x, coords.y);
                    if (hitDrawing) {
                        if (e.cancelable) e.preventDefault();
                        e.stopPropagation();

                        const now = Date.now();
                        const isDoubleClick = (cellObj.selectedDrawingId === hitDrawing.id && (now - (cellObj.lastDrawingClickTime || 0)) < 350);
                        cellObj.lastDrawingClickTime = now;

                        if (isDoubleClick && hitDrawing.type === 'text') {
                            this.editTextDrawing(cellObj.index, hitDrawing.id);
                            return;
                        }

                        cellObj.selectedDrawingId = hitDrawing.id;
                        cellObj.drawings.forEach(d => d.selected = (d.id === hitDrawing.id));

                        // คำนวณตำแหน่ง Anchor Point บนหน้าจอ เพื่อให้การลากนิ่ง ไม่กระโดด
                        let anchorScreenX = coords.x;
                        let anchorScreenY = coords.y;
                        if (hitDrawing.points && hitDrawing.points[0]) {
                            const sx = cellObj.chart.timeScale().timeToCoordinate(hitDrawing.points[0].time);
                            const sy = cellObj.candleSeries ? cellObj.candleSeries.priceToCoordinate(hitDrawing.points[0].price) : null;
                            if (sx !== null) anchorScreenX = sx;
                            if (sy !== null) anchorScreenY = sy;
                        }

                        // ปิดการ scroll/scale ของ chart ชั่วคราว เพื่อไม่ให้กราฟเลื่อนตามขณะกำลังลากข้อความ
                        if (cellObj.chart && cellObj.chart.applyOptions) {
                            cellObj.chart.applyOptions({
                                handleScroll: false,
                                handleScale: false
                            });
                        }

                        // เริ่มระบบ Drag & Move ย้ายตำแหน่งภาพวาด
                        cellObj.activeDrawingDrag = {
                            drawingId: hitDrawing.id,
                            drawing: hitDrawing,
                            startCoords: { ...coords },
                            anchorOffsetX: coords.x - anchorScreenX,
                            anchorOffsetY: coords.y - anchorScreenY,
                            origPoints: JSON.parse(JSON.stringify(hitDrawing.points)),
                            isDragging: false,
                            pointerDownTime: now
                        };
                        viewport.style.cursor = 'move';
                        this.showDrawingActionBar(cellObj, hitDrawing);
                        this.updateOverlays(cellObj);
                        this.showToast(`📌 เลือก ${this.getToolDisplayName(hitDrawing.type)} (ลากเพื่อย้าย | A−/A+ ย่อขยาย | Delete เพื่อลบ)`);
                        return;
                    } else if (cellObj.selectedDrawingId) {
                        cellObj.selectedDrawingId = null;
                        cellObj.drawings.forEach(d => d.selected = false);
                        if (cellObj.chart && cellObj.chart.applyOptions) {
                            cellObj.chart.applyOptions({
                                handleScroll: true,
                                handleScale: true
                            });
                        }
                        this.hideDrawingActionBar();
                        this.updateOverlays(cellObj);
                    }
                }
            }
        };

        const onGlobalPointerMove = (e) => {
            // A. กำลังขยับเส้น Order ที่ Active อยู่
            if (cellObj.activeOrderLine) {
                if (e.cancelable) e.preventDefault();
                const coords = getChartCoords(e);
                let rawPrice = cellObj.candleSeries.coordinateToPrice(coords.y);
                if (rawPrice === null) {
                    rawPrice = coords.price;
                }

                if (rawPrice !== null) {
                    const isGold = cellObj.symbol.includes('XAU') || cellObj.symbol.includes('GOLD');
                    const isForex = cellObj.symbol.includes('EUR') || cellObj.symbol.includes('GBP') || cellObj.symbol.includes('JPY') || cellObj.symbol.includes('AUD');
                    const decimals = isGold ? 3 : (isForex ? 5 : 2);
                    const price = Number(rawPrice.toFixed(decimals));

                    const active = cellObj.activeOrderLine;
                    active.dragDist = Math.hypot(coords.x - (active.pointerDownX || coords.x), coords.y - (active.pointerDownY || coords.y));

                    if (active.isMouseDown && active.dragDist > 12 && (Date.now() - (active.pointerDownTime || 0) > 150)) {
                        active.isDragging = true;
                    }

                    if (active.type === 'ENTRY_PULL') {
                        if (active.order.type === 'BUY') {
                            active.resolvedTarget = price >= active.order.entryPrice ? 'TP' : 'SL';
                        } else {
                            active.resolvedTarget = price <= active.order.entryPrice ? 'TP' : 'SL';
                        }
                    }

                    active.currentPrice = price;
                    active.currentX = coords.x;
                    active.currentY = coords.y;
                    this.updateOverlays(cellObj);
                    viewport.style.cursor = 'ns-resize';
                }
                return;
            }

            // A2. กำลังลากย้ายภาพวาด (Drawing Drag/Move)
            if (cellObj.activeDrawingDrag) {
                if (e.cancelable) e.preventDefault();
                const drag = cellObj.activeDrawingDrag;
                const curMouseCoords = getChartCoords(e);
                const dx = curMouseCoords.x - drag.startCoords.x;
                const dy = curMouseCoords.y - drag.startCoords.y;
                if (Math.hypot(dx, dy) > 2) {
                    drag.isDragging = true;
                    if (drag.drawing.type === 'text') {
                        // คำนวณตำแหน่ง Anchor โดยชดเชยระยะออฟเซ็ตจากจุดที่คลิก
                        const targetAnchorX = curMouseCoords.x - (drag.anchorOffsetX || 0);
                        const targetAnchorY = curMouseCoords.y - (drag.anchorOffsetY || 0);
                        const anchorCoords = getChartCoords(e, targetAnchorX, targetAnchorY);
                        if (anchorCoords.time !== null && anchorCoords.price !== null) {
                            drag.drawing.points = [{ time: anchorCoords.time, price: anchorCoords.price }];
                        }
                    } else if (drag.drawing.type === 'vertline') {
                        if (curMouseCoords.time !== null) {
                            drag.drawing.points = [{ time: curMouseCoords.time, price: curMouseCoords.price }];
                        }
                    } else if (drag.drawing.type === 'horzline' || drag.drawing.type === 'horzray') {
                        if (curMouseCoords.price !== null) {
                            drag.drawing.points = [{ time: curMouseCoords.time, price: curMouseCoords.price }];
                        }
                    } else {
                        // Multi-point drawings (trendline, rectangle, path)
                        const startAnchor = drag.origPoints[0];
                        if (startAnchor) {
                            let startScreenX = drag.startCoords.x;
                            let startScreenY = drag.startCoords.y;
                            const sx = cellObj.chart.timeScale().timeToCoordinate(startAnchor.time);
                            const sy = cellObj.candleSeries ? cellObj.candleSeries.priceToCoordinate(startAnchor.price) : null;
                            if (sx !== null) startScreenX = sx;
                            if (sy !== null) startScreenY = sy;

                            const targetAnchorX = startScreenX + dx;
                            const targetAnchorY = startScreenY + dy;
                            const newAnchorCoords = getChartCoords(e, targetAnchorX, targetAnchorY);

                            const deltaTime = (newAnchorCoords.time !== null && startAnchor.time !== null)
                                ? (newAnchorCoords.time - startAnchor.time)
                                : 0;
                            const deltaPrice = (newAnchorCoords.price !== null && startAnchor.price !== null)
                                ? (newAnchorCoords.price - startAnchor.price)
                                : 0;

                            drag.drawing.points = drag.origPoints.map(pt => ({
                                time: pt.time + deltaTime,
                                price: pt.price + deltaPrice
                            }));
                        }
                    }
                    this.updateOverlays(cellObj);
                    this.updateDrawingActionBarPosition(cellObj, drag.drawing);
                }
                return;
            }

            // B. Fibonacci
            if (this.isFibonacciActive && cellObj.fiboPhase === 'drawing' && cellObj.fiboStart) {
                if (e.cancelable) e.preventDefault();
                const coords = getChartCoords(e);
                if (coords.time !== null && coords.price !== null) {
                    cellObj.fiboCurrent = { ...coords };
                    this.updateOverlays(cellObj);
                }
                return;
            }

            // C. Measure Tool
            if ((this.isMeasureActive || e.shiftKey) && cellObj.measurePhase === 'measuring' && cellObj.measureStart) {
                if (e.cancelable) e.preventDefault();
                const coords = getChartCoords(e);
                if (coords.time !== null && coords.price !== null) {
                    cellObj.measureCurrent = { ...coords };
                    this.updateOverlays(cellObj);
                }
                return;
            }

            // D. Drawing Tool Preview Move (Trendline, Rectangle, Path)
            if (cellObj.currentDrawing) {
                if (e.cancelable) e.preventDefault();
                const coords = getChartCoords(e);
                if (coords.time !== null && coords.price !== null) {
                    this.handleDrawingPointerMove(cellObj, coords);
                }
                return;
            }

            // E. Hover บนปุ่ม [✕] ของภาพวาด หรือปุ่ม Order
            if (!this.isMeasureActive && !this.isFibonacciActive && !this.activeDrawingTool && !e.shiftKey) {
                const coords = getChartCoords(e);
                const hitDeleteBtn = this.getDrawingDeleteButtonHit(cellObj, coords.x, coords.y);
                if (hitDeleteBtn) {
                    viewport.style.cursor = 'pointer';
                    return;
                }
                const hit = this.getOrderHitTest(cellObj, coords.x, coords.y);
                if (hit) {
                    if (hit.type === 'DELETE_TP' || hit.type === 'DELETE_SL' || hit.type === 'CLOSE_ORDER') {
                        viewport.style.cursor = 'pointer';
                    } else {
                        viewport.style.cursor = 'ns-resize';
                    }
                } else {
                    viewport.style.cursor = '';
                }
            }
        };

        const onGlobalPointerUp = (e) => {
            // ปล่อยมือจากการลากย้ายภาพวาด
            if (cellObj.activeDrawingDrag) {
                if (cellObj.activeDrawingDrag.isDragging) {
                    this.saveDrawings(cellObj.symbol, cellObj.drawings);
                    this.showToast('✓ ย้ายตำแหน่งภาพวาดเรียบร้อย');
                }
                viewport.style.cursor = '';
                cellObj.activeDrawingDrag = null;

                // คืนค่าการเลื่อนกราฟ (Scroll / Scale) ตามปกติ
                if (cellObj.chart && cellObj.chart.applyOptions) {
                    cellObj.chart.applyOptions({
                        handleScroll: true,
                        handleScale: true
                    });
                }

                this.updateOverlays(cellObj);
            }

            if (cellObj.activeOrderLine) {
                const active = cellObj.activeOrderLine;
                active.isMouseDown = false;

                // ถ้าผู้ใช้กดค้างแล้วลาก (Drag & Drop) ให้ล็อคราคาใหม่ทันทีเมื่อปล่อยมือ
                if (active.isDragging) {
                    cellObj.activeOrderLine = null;
                    viewport.style.cursor = '';

                    const targetType = active.type === 'ENTRY_PULL' ? active.resolvedTarget : active.type;
                    if (targetType === 'TP') {
                        if (window.replayEngine) window.replayEngine.updateOrderSLTP(active.orderId, undefined, active.currentPrice);
                        this.showToast(`🎯 ปรับ Take Profit เป็น ${active.currentPrice} แล้ว`);
                    } else if (targetType === 'SL') {
                        if (window.replayEngine) window.replayEngine.updateOrderSLTP(active.orderId, active.currentPrice, undefined);
                        this.showToast(`🛑 ปรับ Stop Loss เป็น ${active.currentPrice} แล้ว`);
                    }
                    this.updateOverlays(cellObj);
                    return;
                }
                // มิฉะนั้น ถ้าเป็นการคลิกสั้น (Click-to-Activate Mode) -> ให้คงสถานะ Active ไว้
                active.isDragging = false;
            }

            // Fibonacci drag release
            if (this.isFibonacciActive && cellObj.fiboPhase === 'drawing' && cellObj.fiboStart) {
                const coords = getChartCoords(e);
                const dx = coords.x - cellObj.fiboStart.x;
                const dy = coords.y - cellObj.fiboStart.y;
                if (Math.hypot(dx, dy) > 8) {
                    cellObj.fiboCurrent = { ...coords };
                    cellObj.fiboPinned = true;
                    cellObj.fiboPhase = 'idle';
                    this.toggleFibonacciTool(false);
                    this.updateOverlays(cellObj);
                    this.showToast('✓ ล็อคระดับ Fibonacci แล้ว (สามารถเลื่อนและย่อขยายกราฟได้ทันที)');
                }
                return;
            }

            // Measure Tool drag release
            if ((this.isMeasureActive || e.shiftKey) && cellObj.measurePhase === 'measuring' && cellObj.measureStart) {
                const coords = getChartCoords(e);
                const dx = coords.x - cellObj.measureStart.x;
                const dy = coords.y - cellObj.measureStart.y;
                if (Math.hypot(dx, dy) > 8) {
                    cellObj.measureCurrent = { ...coords };
                    cellObj.measurePinned = true;
                    cellObj.measurePhase = 'idle';
                    this.toggleMeasureTool(false);
                    this.updateOverlays(cellObj);
                    this.showToast('✓ ล็อคการวัดระยะแล้ว');
                }
                return;
            }

            // Drawing Tool Drag Release (Trendline, Rectangle)
            if (cellObj.currentDrawing) {
                const coords = getChartCoords(e);
                this.handleDrawingPointerUp(cellObj, coords);
            }
        };

        // ผูก Event Listener ใน Capture Phase (true) เพื่อดักจับคลิกบนเส้น Order ก่อน LightweightCharts
        viewport.addEventListener('mousedown', onViewportPointerDown, true);
        vpCanvas.addEventListener('mousedown', onViewportPointerDown, true);
        window.addEventListener('mousemove', onGlobalPointerMove, true);
        window.addEventListener('mouseup', onGlobalPointerUp, true);

        viewport.addEventListener('touchstart', onViewportPointerDown, { passive: false, capture: true });
        vpCanvas.addEventListener('touchstart', onViewportPointerDown, { passive: false, capture: true });
        window.addEventListener('touchmove', onGlobalPointerMove, { passive: false, capture: true });
        window.addEventListener('touchend', onGlobalPointerUp, { passive: false, capture: true });
        window.addEventListener('touchcancel', onGlobalPointerUp, { passive: false, capture: true });

        // Load & Render Data
        await this.loadChartData(cellObj);

        // วาด Order เส้นที่มีอยู่แล้วบนคู่เงินนี้
        this.redrawAllOrders();

        return cellObj;
    }

    setActiveChart(index) {
        this.activeChartIndex = index;
        this.charts.forEach((c, idx) => {
            if (c.element) {
                c.element.classList.toggle('active', idx === index);
            }
        });
        if (window.app && window.app.onActiveChartChanged) {
            window.app.onActiveChartChanged(this.charts[index]);
        }
    }

    getActiveChart() {
        return this.charts[this.activeChartIndex] || this.charts[0];
    }

    /**
     * โหลดข้อมูล Resample และวาดลงบนชาร์ต
     */
    async loadChartData(cell) {
        cell.rawM1 = await this.getRawM1Data(cell.symbol);

        if (cell.isRangeBar) {
            cell.resampledCandles = Resampler.calculateRangeBars(cell.rawM1, cell.rangeSize);
        } else if (cell.isTickBar) {
            cell.resampledCandles = Resampler.calculateTickBars(cell.rawM1, cell.ticksPerBar);
        } else {
            // แปลง Timeframe เป็นนาที
            const minutes = this.parseTimeframeToMinutes(cell.timeframe);
            cell.resampledCandles = Resampler.resampleTimeframe(cell.rawM1, minutes);
        }

        // หากอยู่ในโหมด Replay ให้ slice ตาม replayTime
        let displayCandles = cell.resampledCandles;
        if (this.replayTime) {
            displayCandles = cell.resampledCandles.filter(c => c.time <= this.replayTime);
        }
        cell.visibleCandles = displayCandles;

        // วาดแท่งเทียน
        cell.candleSeries.setData(displayCandles.map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
        })));

        // วาด Volume แนวตั้ง (ถ้าเปิดใช้งาน)
        if (cell.showVolume) {
            cell.volumeSeries.applyOptions({ visible: true });
            cell.volumeSeries.setData(displayCandles.map(c => ({
                time: c.time,
                value: c.volume || 100,
                color: c.close >= c.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)'
            })));
        } else {
            cell.volumeSeries.applyOptions({ visible: false });
        }

        // อัปเดต Indicators
        this.recalculateIndicators(cell);

        // อัปเดต Overlays ทั้งหมด (Volume Profile, Footprint, Patterns)
        this.updateOverlays(cell);

        // เลื่อนไปยังแท่งเทียนล่าสุดตามการตั้งค่า Auto-Scroll
        if (this.isAutoScrollToLatest) {
            this.scrollToLatestBar(cell);
        } else {
            cell.chart.timeScale().fitContent();
        }
    }

    parseTimeframeToMinutes(tf) {
        if (!tf) return 1;
        const str = tf.toLowerCase();
        if (str.endsWith('m')) return parseInt(str) || 1;
        if (str.endsWith('h')) return (parseInt(str) || 1) * 60;
        if (str.endsWith('d')) return (parseInt(str) || 1) * 1440;
        return parseInt(str) || 1;
    }

    /**
     * เปลี่ยน Timeframe หรือเปลี่ยนเป็น Range Bar / Tick Bar
     */
    async setCellTimeframe(index, tf, isRange = false, rangeSize = 2.0, isTick = false, ticksPerBar = 250) {
        const cell = this.charts[index];
        if (!cell) return;

        cell.timeframe = tf;
        cell.isRangeBar = isRange;
        cell.rangeSize = rangeSize;
        cell.isTickBar = isTick;
        cell.ticksPerBar = ticksPerBar;

        const badge = cell.element.querySelector('.cell-tf-badge');
        const hudBadge = cell.element.querySelector('.hud-tf-badge');
        const tfText = isRange ? `R-${rangeSize}` : (isTick ? `T-${ticksPerBar}` : tf);
        if (badge) badge.innerText = tfText;
        if (hudBadge) hudBadge.innerText = tfText;

        await this.loadChartData(cell);
        this.updateAllCountdownDisplays();
        this.redrawAllOrders();
        this.saveSettingsToStorage();
    }

    /**
     * เปลี่ยน Symbol สำหรับ Cell ที่เลือก
     */
    async setCellSymbol(index, symbol) {
        const cell = this.charts[index];
        if (!cell) return;

        cell.symbol = symbol;
        cell.drawings = this.loadDrawings(symbol);
        cell.currentDrawing = null;
        cell.selectedDrawingId = null;
        const title = cell.element.querySelector('.cell-symbol');
        if (title) title.innerHTML = `${symbol} <span class="sym-chevron">▾</span>`;
        const hudTitle = cell.element.querySelector('.hud-symbol');
        if (hudTitle) hudTitle.innerHTML = `${symbol} <span class="sym-chevron" style="font-size: 8px;">▾</span>`;

        const isGold = symbol.includes('XAU') || symbol.includes('GOLD');
        const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('AUD');
        const precision = isGold ? 3 : (isForex ? 5 : 2);
        const minMove = isGold ? 0.001 : (isForex ? 0.00001 : 0.01);
        if (cell.candleSeries) {
            cell.candleSeries.applyOptions({
                priceFormat: {
                    type: 'price',
                    precision: precision,
                    minMove: minMove
                }
            });
        }

        await this.loadChartData(cell);
        this.redrawAllOrders();
        this.saveSettingsToStorage();
    }

    /**
     * ปุ่มสลับเปิด/ปิด Volume แนวตั้งแยกอิสระในแต่ละชาร์ต
     */
    toggleCellVolume(index) {
        const cell = this.charts[index];
        if (!cell) return;
        cell.showVolume = !cell.showVolume;
        const btn = cell.element.querySelector(`#btn-vol-${index}`);
        if (btn) btn.classList.toggle('active', cell.showVolume);
        cell.volumeSeries.applyOptions({ visible: cell.showVolume });
        this.saveSettingsToStorage();
    }

    /**
     * ปุ่มสลับเปิด/ปิด Volume Profile แนวนอนแยกอิสระในแต่ละชาร์ต
     */
    toggleCellVP(index) {
        const cell = this.charts[index];
        if (!cell) return;
        cell.showVolumeProfile = !cell.showVolumeProfile;
        const btn = cell.element.querySelector(`#btn-vp-${index}`);
        if (btn) btn.classList.toggle('active', cell.showVolumeProfile);
        this.updateOverlays(cell);
        this.saveSettingsToStorage();
    }

    /**
     * ปุ่มสลับเปิด/ปิด Volume Footprint (Order Flow) ในแต่ละชาร์ต
     */
    toggleCellFootprint(index) {
        const cell = this.charts[index];
        if (!cell) return;
        cell.showFootprint = !cell.showFootprint;
        const btn = cell.element.querySelector(`#btn-fp-${index}`);
        if (btn) btn.classList.toggle('active', cell.showFootprint);
        this.updateOverlays(cell);
        this.saveSettingsToStorage();
    }

    /**
     * ปุ่มสลับเปิด/ปิด Auto Chart Patterns (Elliott Wave, H&S, Flags)
     */
    toggleCellPatterns(index) {
        const cell = this.charts[index];
        if (!cell) return;
        cell.showPatterns = !cell.showPatterns;
        const btn = cell.element.querySelector(`#btn-pat-${index}`);
        if (btn) btn.classList.toggle('active', cell.showPatterns);
        this.updateOverlays(cell);
        this.saveSettingsToStorage();
    }

    /**
     * วาด Overlays ทั้งหมดลงบน Canvas (Volume Profile, Footprint, Patterns)
     */
    updateOverlays(cell) {
        if (!cell || !cell.vpCanvas) return;
        const ctx = cell.vpCanvas.getContext('2d');
        ctx.clearRect(0, 0, cell.vpCanvas.width, cell.vpCanvas.height);

        if (!cell.visibleCandles || cell.visibleCandles.length === 0) return;

        // 1. Volume Profile (VPVR)
        if (cell.showVolumeProfile && window.VolumeProfile) {
            const profile = VolumeProfile.compute(cell.visibleCandles, 55, 0.70);
            if (profile) {
                VolumeProfile.renderOverlay(cell.vpCanvas, profile, cell.candleSeries);
            }
        }

        // 2. Volume Footprint (Order Flow Bid/Ask per price level)
        if (cell.showFootprint && window.FootprintEngine) {
            const footprints = FootprintEngine.calculateFootprint(cell.visibleCandles, 8);
            FootprintEngine.renderOverlay(cell.vpCanvas, footprints, cell.candleSeries, cell.chart);
        }

        // 3. Auto Chart Pattern Recognition (Elliott Waves, Head & Shoulders, Flags)
        if (cell.showPatterns && window.PatternRecognizer) {
            const patterns = PatternRecognizer.detectAll(cell.visibleCandles);
            PatternRecognizer.renderOverlay(cell.vpCanvas, patterns, cell.candleSeries, cell.chart);
        }

        // 4. Price & Bar Measure Tool (เครื่องมือวัดระยะ)
        const measureBadge = cell.element ? cell.element.querySelector(`#measure-badge-${cell.index}`) : null;
        if (cell.measureStart && cell.measureCurrent) {
            this.renderMeasurementOverlay(cell, ctx);
            if (measureBadge) measureBadge.style.display = 'flex';
        } else {
            if (measureBadge) measureBadge.style.display = 'none';
        }

        // 5. Fibonacci Retracement Tool (เครื่องมือฟีโบนักชี)
        const fiboBadge = cell.element ? cell.element.querySelector(`#fibo-badge-${cell.index}`) : null;
        if (cell.fiboStart && cell.fiboCurrent) {
            this.renderFibonacciOverlay(cell, ctx);
            if (fiboBadge) fiboBadge.style.display = 'flex';
        } else {
            if (fiboBadge) fiboBadge.style.display = 'none';
        }

        // 6. Interactive Order Execution Overlay (Draggable TP / SL Lines & Delete Buttons)
        this.renderOrderOverlay(cell, ctx);

        // 7. Interactive Drawing Tools Overlay (Trendline, HorzLine, HorzRay, VertLine, Rectangle, Path, Text)
        this.renderDrawingOverlay(cell, ctx);
    }

    /**
     * ตรวจสอบ Hit Test ว่าตำแหน่ง (x, y) โดนปุ่มหรือเส้นของ Order หรือไม่
     */
    getOrderHitTest(cell, x, y) {
        if (!cell || !cell.orderHitBoxes || cell.orderHitBoxes.length === 0) return null;

        // 1. ตรวจสอบปุ่มคลิก Action ก่อน (เช่น ปุ่มลบ TP, ลบ SL, หรือปิด Order)
        for (const hb of cell.orderHitBoxes) {
            if (hb.type === 'DELETE_TP' || hb.type === 'DELETE_SL' || hb.type === 'CLOSE_ORDER') {
                if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) {
                    return hb;
                }
            }
        }

        // 2. ตรวจสอบป้าย Tag ป้ายลาก
        for (const hb of cell.orderHitBoxes) {
            if (hb.type === 'DRAG_TP_TAG' || hb.type === 'DRAG_SL_TAG' || hb.type === 'DRAG_ENTRY_TAG') {
                if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) {
                    return hb;
                }
            }
        }

        // 3. ตรวจสอบเส้นแนวนอน (รัศมี ±12px จากแนวแกน Y เพื่อการคลิกเลือกที่ง่ายและแม่นยำ)
        for (const hb of cell.orderHitBoxes) {
            if (hb.type === 'DRAG_TP_LINE' || hb.type === 'DRAG_SL_LINE' || hb.type === 'DRAG_ENTRY_LINE') {
                if (Math.abs(y - hb.y) <= 12) {
                    return hb;
                }
            }
        }

        return null;
    }

    /**
     * วาด Order Overlays ทั้งหมด (เส้น Entry, TP, SL, ป้ายกำกับที่ Active และลากได้, และปุ่มลบ TP/SL)
     */
    renderOrderOverlay(cell, ctx) {
        if (!window.replayEngine || !window.replayEngine.openOrders) return;
        const matchingOrders = window.replayEngine.openOrders.filter(o => o.symbol === cell.symbol);
        cell.orderHitBoxes = [];
        if (matchingOrders.length === 0) return;

        const canvasW = cell.vpCanvas.width;
        const canvasH = cell.vpCanvas.height;
        const isGold = cell.symbol.includes('XAU') || cell.symbol.includes('GOLD');
        const isForex = cell.symbol.includes('EUR') || cell.symbol.includes('GBP') || cell.symbol.includes('JPY') || cell.symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);
        const pointMultiplier = isGold ? 100 : (isForex ? 100000 : 1);
        const pointVal = isGold ? 100 : (isForex ? 100000 : 1);

        matchingOrders.forEach((order, orderIdx) => {
            const isSelected = (cell.selectedOrderId === order.id) || (cell.activeOrderLine && cell.activeOrderLine.orderId === order.id);
            const activeLine = (cell.activeOrderLine && cell.activeOrderLine.orderId === order.id) ? cell.activeOrderLine : null;
            const isTpActive = !!(activeLine && (activeLine.type === 'TP' || (activeLine.type === 'ENTRY_PULL' && activeLine.resolvedTarget === 'TP')));
            const isSlActive = !!(activeLine && (activeLine.type === 'SL' || (activeLine.type === 'ENTRY_PULL' && activeLine.resolvedTarget === 'SL')));

            // กำหนดค่า TP และ SL ที่มีผลจริง (รวมถึงค่าที่กำลัง Active หรือขยับอยู่)
            let activeTp = isTpActive ? activeLine.currentPrice : order.tp;
            let activeSl = isSlActive ? activeLine.currentPrice : order.sl;

            const entryY = cell.candleSeries.priceToCoordinate(order.entryPrice);
            const tpY = activeTp !== null && activeTp !== undefined ? cell.candleSeries.priceToCoordinate(activeTp) : null;
            const slY = activeSl !== null && activeSl !== undefined ? cell.candleSeries.priceToCoordinate(activeSl) : null;

            ctx.save();

            // 1. Shaded Profit & Risk Zones (แสดงเฉพาะเมื่อ Order นั้นถูกเลือกหรือ Active เท่านั้น เพื่อไม่ให้รกหน้าจอ)
            if (isSelected && entryY !== null) {
                if (tpY !== null) {
                    const topY = Math.min(entryY, tpY);
                    const botY = Math.max(entryY, tpY);
                    ctx.fillStyle = isTpActive ? 'rgba(8, 153, 129, 0.18)' : 'rgba(8, 153, 129, 0.08)';
                    ctx.fillRect(0, topY, canvasW, botY - topY);
                }
                if (slY !== null) {
                    const topY = Math.min(entryY, slY);
                    const botY = Math.max(entryY, slY);
                    ctx.fillStyle = isSlActive ? 'rgba(242, 54, 69, 0.18)' : 'rgba(242, 54, 69, 0.08)';
                    ctx.fillRect(0, topY, canvasW, botY - topY);
                }
            }

            const tagX = 14 + (orderIdx * 8);
            const tagH = 22;

            // 2. ENTRY Line & Tag
            if (entryY !== null) {
                const isBuy = order.type === 'BUY';
                const mainColor = isBuy ? '#089981' : '#f23645';

                // Entry Line
                ctx.strokeStyle = mainColor;
                ctx.lineWidth = isSelected ? 2.2 : 1.5;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(0, entryY);
                ctx.lineTo(canvasW, entryY);
                ctx.stroke();

                // Entry Text
                const pnlVal = order.floatingPnl !== undefined ? order.floatingPnl : (order.pnl || 0);
                const pnlSign = pnlVal >= 0 ? '+' : '';
                const pnlText = ` (${pnlSign}$${pnlVal.toFixed(2)})`;
                
                const entryText = isSelected 
                    ? `${order.type} ${order.lot}L @ ${order.entryPrice.toFixed(decimals)}${pnlText} ↕`
                    : `${order.type} ${order.lot}L${pnlText}`;

                ctx.font = 'bold 10.5px monospace';
                const textW = ctx.measureText(entryText).width;
                const tagW = textW + 30;

                // Entry Pill
                ctx.fillStyle = isSelected 
                    ? (isBuy ? 'rgba(8, 153, 129, 0.98)' : 'rgba(242, 54, 69, 0.98)')
                    : (isBuy ? 'rgba(8, 153, 129, 0.85)' : 'rgba(242, 54, 69, 0.85)');
                ctx.beginPath();
                ctx.roundRect(tagX, entryY - tagH / 2, tagW, tagH, 5);
                ctx.fill();
                ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = isSelected ? 1.5 : 1;
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(entryText, tagX + 7, entryY);

                // Close Button [✕]
                const closeBtnX = tagX + tagW - 14;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.beginPath();
                ctx.arc(closeBtnX, entryY, 6.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 9.5px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('✕', closeBtnX, entryY + 0.5);

                cell.orderHitBoxes.push({
                    type: 'CLOSE_ORDER',
                    orderId: order.id,
                    x: closeBtnX - 12,
                    y: entryY - 12,
                    w: 24,
                    h: 24
                });
                cell.orderHitBoxes.push({
                    type: 'DRAG_ENTRY_TAG',
                    orderId: order.id,
                    order,
                    x: tagX,
                    y: entryY - tagH / 2,
                    w: tagW - 24,
                    h: tagH
                });
                cell.orderHitBoxes.push({
                    type: 'DRAG_ENTRY_LINE',
                    orderId: order.id,
                    order,
                    y: entryY
                });
            }

            // 3. TAKE PROFIT (TP) Line & Tag
            if (activeTp !== null && activeTp !== undefined) {
                const activeTpY = cell.candleSeries.priceToCoordinate(activeTp);
                if (activeTpY !== null) {
                    ctx.save();
                    ctx.strokeStyle = isTpActive ? '#10b981' : (isSelected ? '#089981' : 'rgba(8, 153, 129, 0.7)');
                    ctx.lineWidth = isTpActive ? 2.5 : (isSelected ? 1.8 : 1.2);
                    ctx.setLineDash(isTpActive ? [6, 4] : [5, 3]);
                    if (isTpActive) {
                        ctx.shadowColor = 'rgba(16, 185, 129, 0.95)';
                        ctx.shadowBlur = 12;
                    }
                    ctx.beginPath();
                    ctx.moveTo(0, activeTpY);
                    ctx.lineTo(canvasW, activeTpY);
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    // วาด Grab Node ตรงกลางเส้นเมื่อ Active
                    if (isTpActive) {
                        const midX = canvasW * 0.5;
                        ctx.fillStyle = '#10b981';
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(midX, activeTpY, 5.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }

                    if (isSelected || isTpActive) {
                        // โหมดแสดงผลละเอียดเมื่อคลิกเลือก Order
                        const isBuy = order.type === 'BUY';
                        const tpDelta = isBuy ? (activeTp - order.entryPrice) : (order.entryPrice - activeTp);
                        const tpPoints = Math.round(Math.abs(tpDelta) * pointMultiplier);
                        const tpProfitUSD = tpDelta * order.lot * pointVal;
                        const tpSign = tpProfitUSD >= 0 ? '+' : '';
                        const tpActiveBadge = isTpActive ? ' [ACTIVE ↕]' : ' ↕';
                        const tpText = `TP: ${activeTp.toFixed(decimals)} (${tpSign}${tpPoints} pts | ${tpSign}$${tpProfitUSD.toFixed(2)})${tpActiveBadge}`;

                        ctx.font = isTpActive ? 'bold 11px monospace' : 'bold 10.5px monospace';
                        const textW = ctx.measureText(tpText).width;
                        const tagW = textW + 30;

                        ctx.fillStyle = isTpActive ? '#059669' : 'rgba(8, 153, 129, 0.94)';
                        ctx.beginPath();
                        ctx.roundRect(tagX, activeTpY - tagH / 2, tagW, tagH, 5);
                        ctx.fill();
                        ctx.strokeStyle = isTpActive ? '#a7f3d0' : 'rgba(255, 255, 255, 0.3)';
                        ctx.lineWidth = isTpActive ? 1.8 : 1;
                        ctx.stroke();

                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(tpText, tagX + 7, activeTpY);

                        // Delete TP Button [✕]
                        const delBtnX = tagX + tagW - 14;
                        ctx.fillStyle = isTpActive ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.2)';
                        ctx.beginPath();
                        ctx.arc(delBtnX, activeTpY, 6.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 9.5px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText('✕', delBtnX, activeTpY + 0.5);

                        cell.orderHitBoxes.push({
                            type: 'DELETE_TP',
                            orderId: order.id,
                            x: delBtnX - 12,
                            y: activeTpY - 12,
                            w: 24,
                            h: 24
                        });
                        cell.orderHitBoxes.push({
                            type: 'DRAG_TP_TAG',
                            orderId: order.id,
                            order,
                            x: tagX,
                            y: activeTpY - tagH / 2,
                            w: tagW - 24,
                            h: tagH
                        });
                    } else {
                        // โหมดกะทัดรัด (Compact Badge) เมื่อยังไม่ได้เลือก Order
                        const compactText = `TP ${activeTp.toFixed(decimals)}`;
                        ctx.font = 'bold 9.5px monospace';
                        const textW = ctx.measureText(compactText).width;
                        const tagW = textW + 14;
                        const compactH = 18;

                        ctx.fillStyle = 'rgba(8, 153, 129, 0.75)';
                        ctx.beginPath();
                        ctx.roundRect(tagX, activeTpY - compactH / 2, tagW, compactH, 4);
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(compactText, tagX + 6, activeTpY);

                        cell.orderHitBoxes.push({
                            type: 'DRAG_TP_TAG',
                            orderId: order.id,
                            order,
                            x: tagX,
                            y: activeTpY - compactH / 2,
                            w: tagW,
                            h: compactH
                        });
                    }

                    ctx.restore();

                    cell.orderHitBoxes.push({
                        type: 'DRAG_TP_LINE',
                        orderId: order.id,
                        order,
                        y: activeTpY
                    });
                }
            }

            // 4. STOP LOSS (SL) Line & Tag
            if (activeSl !== null && activeSl !== undefined) {
                const activeSlY = cell.candleSeries.priceToCoordinate(activeSl);
                if (activeSlY !== null) {
                    ctx.save();
                    ctx.strokeStyle = isSlActive ? '#ef4444' : (isSelected ? '#f23645' : 'rgba(242, 54, 69, 0.7)');
                    ctx.lineWidth = isSlActive ? 2.5 : (isSelected ? 1.8 : 1.2);
                    ctx.setLineDash(isSlActive ? [6, 4] : [5, 3]);
                    if (isSlActive) {
                        ctx.shadowColor = 'rgba(239, 68, 68, 0.95)';
                        ctx.shadowBlur = 12;
                    }
                    ctx.beginPath();
                    ctx.moveTo(0, activeSlY);
                    ctx.lineTo(canvasW, activeSlY);
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    // วาด Grab Node ตรงกลางเส้นเมื่อ Active
                    if (isSlActive) {
                        const midX = canvasW * 0.5;
                        ctx.fillStyle = '#ef4444';
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(midX, activeSlY, 5.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }

                    if (isSelected || isSlActive) {
                        // โหมดแสดงผลละเอียดเมื่อคลิกเลือก Order
                        const isBuy = order.type === 'BUY';
                        const slDelta = isBuy ? (order.entryPrice - activeSl) : (activeSl - order.entryPrice);
                        const slPoints = Math.round(Math.abs(slDelta) * pointMultiplier);
                        const slLossUSD = -Math.abs(slDelta * order.lot * pointVal);
                        const slActiveBadge = isSlActive ? ' [ACTIVE ↕]' : ' ↕';
                        const slText = `SL: ${activeSl.toFixed(decimals)} (-${slPoints} pts | -$${Math.abs(slLossUSD).toFixed(2)})${slActiveBadge}`;

                        ctx.font = isSlActive ? 'bold 11px monospace' : 'bold 10.5px monospace';
                        const textW = ctx.measureText(slText).width;
                        const tagW = textW + 30;

                        ctx.fillStyle = isSlActive ? '#dc2626' : 'rgba(242, 54, 69, 0.94)';
                        ctx.beginPath();
                        ctx.roundRect(tagX, activeSlY - tagH / 2, tagW, tagH, 5);
                        ctx.fill();
                        ctx.strokeStyle = isSlActive ? '#fecaca' : 'rgba(255, 255, 255, 0.3)';
                        ctx.lineWidth = isSlActive ? 1.8 : 1;
                        ctx.stroke();

                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(slText, tagX + 7, activeSlY);

                        // Delete SL Button [✕]
                        const delBtnX = tagX + tagW - 14;
                        ctx.fillStyle = isSlActive ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.2)';
                        ctx.beginPath();
                        ctx.arc(delBtnX, activeSlY, 6.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 9.5px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText('✕', delBtnX, activeSlY + 0.5);

                        cell.orderHitBoxes.push({
                            type: 'DELETE_SL',
                            orderId: order.id,
                            x: delBtnX - 12,
                            y: activeSlY - 12,
                            w: 24,
                            h: 24
                        });
                        cell.orderHitBoxes.push({
                            type: 'DRAG_SL_TAG',
                            orderId: order.id,
                            order,
                            x: tagX,
                            y: activeSlY - tagH / 2,
                            w: tagW - 24,
                            h: tagH
                        });
                    } else {
                        // โหมดกะทัดรัด (Compact Badge) เมื่อยังไม่ได้เลือก Order
                        const compactText = `SL ${activeSl.toFixed(decimals)}`;
                        ctx.font = 'bold 9.5px monospace';
                        const textW = ctx.measureText(compactText).width;
                        const tagW = textW + 14;
                        const compactH = 18;

                        ctx.fillStyle = 'rgba(242, 54, 69, 0.75)';
                        ctx.beginPath();
                        ctx.roundRect(tagX, activeSlY - compactH / 2, tagW, compactH, 4);
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(compactText, tagX + 6, activeSlY);

                        cell.orderHitBoxes.push({
                            type: 'DRAG_SL_TAG',
                            orderId: order.id,
                            order,
                            x: tagX,
                            y: activeSlY - compactH / 2,
                            w: tagW,
                            h: compactH
                        });
                    }

                    ctx.restore();

                    cell.orderHitBoxes.push({
                        type: 'DRAG_SL_LINE',
                        orderId: order.id,
                        order,
                        y: activeSlY
                    });
                }
            }

            // 5. Floating Active Order HUD Badge
            if (activeLine && activeLine.currentPrice) {
                const curX = activeLine.currentX || 120;
                const curY = activeLine.currentY || 100;
                const dragPrice = activeLine.currentPrice;
                const isTpMode = isTpActive;

                const hudW = 230;
                const hudH = 70;
                let hudX = curX + 18;
                let hudY = curY - hudH / 2;
                if (hudX + hudW > canvasW - 10) hudX = curX - hudW - 18;
                if (hudX < 10) hudX = 10;
                if (hudY < 10) hudY = 10;
                if (hudY + hudH > canvasH - 10) hudY = canvasH - hudH - 10;

                ctx.save();
                ctx.fillStyle = 'rgba(15, 20, 30, 0.95)';
                ctx.strokeStyle = isTpMode ? '#10b981' : '#ef4444';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.roundRect(hudX, hudY, hudW, hudH, 8);
                ctx.fill();
                ctx.stroke();

                const delta = Math.abs(dragPrice - order.entryPrice);
                const pts = Math.round(delta * pointMultiplier);
                const usd = delta * order.lot * pointVal;

                ctx.fillStyle = isTpMode ? '#4ade80' : '#f87171';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(isTpMode ? '🎯 กำลังปรับ Take Profit (TP)' : '🛑 กำลังปรับ Stop Loss (SL)', hudX + 10, hudY + 18);

                ctx.fillStyle = '#f8fafc';
                ctx.font = 'bold 11.5px monospace';
                ctx.fillText(`ราคา: ${dragPrice.toFixed(decimals)} (${pts} pts)`, hudX + 10, hudY + 35);

                ctx.fillStyle = isTpMode ? '#4ade80' : '#fca5a5';
                ctx.font = '600 11px monospace';
                ctx.fillText(isTpMode ? `กำไรคาดหวัง: +$${usd.toFixed(2)} USD` : `ความเสี่ยง: -$${usd.toFixed(2)} USD`, hudX + 10, hudY + 50);

                ctx.fillStyle = '#94a3b8';
                ctx.font = '9.5px sans-serif';
                ctx.fillText('💡 คลิกเพื่อล็อคราคา | Esc ยกเลิก', hudX + 10, hudY + 63);
                ctx.restore();
            }

            ctx.restore();
        });

        // 6. อัปเดตตำแหน่ง Drawing Action Bar เมื่อเลื่อนหรือย่อขยายกราฟ
        if (cell.selectedDrawingId) {
            const selDrawing = (cell.drawings || []).find(d => d.id === cell.selectedDrawingId);
            if (selDrawing) {
                this.updateDrawingActionBarPosition(cell, selDrawing);
            } else {
                this.hideDrawingActionBar();
            }
        }
    }

    /**
     * ระบบเชื่อมโยง Crosshair ให้วิ่งตามกันทุกชาร์ต (Synchronized Crosshairs)
     */
    setupCrosshairSync() {
        this.charts.forEach(sourceCell => {
            sourceCell.chart.subscribeCrosshairMove(param => {
                // วาดเส้นกรรไกรสีแดงเมื่ออยู่ในโหมดตัดกราฟ (TradingView Scissors Cut Mode)
                if (window.replayEngine && window.replayEngine.isCutting && sourceCell.vpCanvas) {
                    this.updateOverlays(sourceCell);
                    if (param && param.point) {
                        const ctx = sourceCell.vpCanvas.getContext('2d');
                        ctx.save();
                        ctx.strokeStyle = '#f23645';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([4, 3]);
                        ctx.beginPath();
                        ctx.moveTo(param.point.x, 0);
                        ctx.lineTo(param.point.x, sourceCell.vpCanvas.height);
                        ctx.stroke();

                        // วาดป้ายกรรไกรติดตามเมาส์
                        ctx.fillStyle = '#f23645';
                        const tagW = 74;
                        const tagH = 22;
                        ctx.fillRect(Math.max(10, param.point.x - tagW / 2), 12, tagW, tagH);
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 11px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText('✂️ ตัดตรงนี้', Math.max(10, param.point.x), 27);
                        ctx.restore();
                    }
                }

                if (!this.isCrosshairSync || !param || !param.time) return;
            });

            // ตรวจจับการคลิกบนแท่งเทียนสำหรับการตัดกราฟ (Cut Bar)
            sourceCell.chart.subscribeClick(param => {
                if (window.replayEngine && window.replayEngine.isCutting && param && param.time) {
                    window.replayEngine.cutAtTime(param.time);
                }
            });
        });
    }

    /**
     * ซิงค์เวลา Replay ข้ามทุกชาร์ตพร้อมกัน
     * เมื่อเข้าโหมด Backtest สินทรัพย์แบบเดียวกันในทุก Timeframe จะทำงานและขยับแท่งเทียนพร้อมๆ กัน
     */
    syncReplayTime(timestamp) {
        this.replayTime = timestamp;
        this.charts.forEach(cell => {
            if (!cell.rawM1 || cell.rawM1.length === 0) return;

            // กรองแท่งเทียนดิบ M1 ทั้งหมดจนถึง timestamp ที่กำลัง Replay
            const rawUntilT = cell.rawM1.filter(c => c.time <= timestamp);
            if (rawUntilT.length === 0) return;

            let currentCandles = [];
            if (cell.isRangeBar) {
                currentCandles = Resampler.calculateRangeBars(rawUntilT, cell.rangeSize || 2.0);
            } else if (cell.isTickBar) {
                currentCandles = Resampler.calculateTickBars(rawUntilT, cell.ticksPerBar || 250);
            } else {
                const tfMinutes = this.parseTimeframeToMinutes(cell.timeframe);
                currentCandles = Resampler.resampleTimeframe(rawUntilT, tfMinutes);
            }

            cell.visibleCandles = currentCandles;

            cell.candleSeries.setData(currentCandles.map(c => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
            })));

            if (cell.showVolume && cell.volumeSeries) {
                cell.volumeSeries.setData(currentCandles.map(c => ({
                    time: c.time,
                    value: c.volume || 100,
                    color: c.close >= c.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)'
                })));
            }

            this.recalculateIndicators(cell);
            this.updateOverlays(cell);
        });
    }

    resetToRealtime() {
        this.replayTime = null;
        this.charts.forEach(cell => {
            this.loadChartData(cell);
        });
    }

    getNextCandleTime(currentTime) {
        const masterCell = this.getActiveChart();
        if (!masterCell || !masterCell.rawM1 || masterCell.rawM1.length === 0) return null;

        // ขยับทีละแท่ง M1 เพื่อให้ทุก Timeframe (M1, M5, M15, H1) ขยับความเคลื่อนไหวไปพร้อมกัน
        const next = masterCell.rawM1.find(c => c.time > currentTime);
        return next ? next.time : null;
    }

    getPrevCandleTime(currentTime) {
        const masterCell = this.getActiveChart();
        if (!masterCell || !masterCell.rawM1 || masterCell.rawM1.length === 0) return null;

        const prevs = masterCell.rawM1.filter(c => c.time < currentTime);
        return prevs.length > 0 ? prevs[prevs.length - 1].time : null;
    }

    getCurrentPrice(symbol) {
        const cell = this.charts.find(c => c.symbol === symbol) || this.getActiveChart();
        if (!cell || !cell.visibleCandles || cell.visibleCandles.length === 0) return null;
        return cell.visibleCandles[cell.visibleCandles.length - 1].close;
    }

    getLatestVisibleCandle(symbol) {
        const cell = this.charts.find(c => c.symbol === symbol) || this.getActiveChart();
        if (!cell || !cell.visibleCandles || cell.visibleCandles.length === 0) return null;
        return cell.visibleCandles[cell.visibleCandles.length - 1];
    }

    // =========================================================
    // ระบบนับเวลาถอยหลังการจบแท่งเทียน (Candle Countdown Timer - MT5 / TradingView Style)
    // =========================================================
    startCandleCountdownTimer() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        this.updateAllCountdownDisplays();
        this.countdownInterval = setInterval(() => {
            this.updateAllCountdownDisplays();
        }, 1000);
    }

    getTimeframeDurationSeconds(tf) {
        if (!tf) return 60;
        const str = tf.toString().trim().toLowerCase();
        if (str.endsWith('m') && !str.endsWith('mn')) {
            const m = parseInt(str) || 1;
            return m * 60;
        }
        if (str.endsWith('h')) {
            const h = parseInt(str) || 1;
            return h * 3600;
        }
        if (str.endsWith('d') || str === 'd1' || str === 'd') {
            const d = parseInt(str) || 1;
            return d * 86400;
        }
        if (str.endsWith('w') || str === 'w1' || str === 'w') {
            const w = parseInt(str) || 1;
            return w * 604800;
        }
        if (str === '1m' || str === 'mn') {
            return 30 * 86400;
        }
        const num = parseInt(str);
        return !isNaN(num) ? num * 60 : 60;
    }

    formatCountdown(sec) {
        if (sec <= 0) return '00:00';
        const s = Math.floor(sec % 60);
        const m = Math.floor((sec / 60) % 60);
        const h = Math.floor((sec / 3600) % 24);
        const d = Math.floor(sec / 86400);

        const pad = (num) => String(num).padStart(2, '0');

        if (d > 0) {
            return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        return `${pad(m)}:${pad(s)}`;
    }

    getRemainingCandleTime(cell) {
        if (cell.isRangeBar) {
            if (!cell.visibleCandles || cell.visibleCandles.length === 0) return { type: 'range', text: `R-${cell.rangeSize}` };
            const last = cell.visibleCandles[cell.visibleCandles.length - 1];
            const currentDiff = (last.high || 0) - (last.low || 0);
            const rem = Math.max(0, cell.rangeSize - currentDiff);
            const isGold = (cell.symbol || '').includes('XAU') || (cell.symbol || '').includes('GOLD');
            const decimals = isGold ? 2 : 4;
            return {
                type: 'range',
                remaining: rem,
                total: cell.rangeSize,
                text: `Δ ${rem.toFixed(decimals)}`
            };
        }

        if (cell.isTickBar) {
            const currentTicks = cell._currentTickCount || 0;
            const remTicks = Math.max(0, (cell.ticksPerBar || 250) - currentTicks);
            return {
                type: 'tick',
                remaining: remTicks,
                total: cell.ticksPerBar || 250,
                text: `⚡ ${remTicks}`
            };
        }

        const tfSec = this.getTimeframeDurationSeconds(cell.timeframe);
        let nowSec;

        if (this.replayTime !== null) {
            nowSec = this.replayTime;
            if (cell.visibleCandles && cell.visibleCandles.length > 0) {
                const lastCandle = cell.visibleCandles[cell.visibleCandles.length - 1];
                const nextCandleTime = lastCandle.time + tfSec;
                const remaining = Math.max(0, nextCandleTime - nowSec);
                return {
                    type: 'time',
                    seconds: remaining,
                    text: this.formatCountdown(remaining)
                };
            }
        } else {
            nowSec = Math.floor(Date.now() / 1000) + this.thailandOffset;
        }

        const currentBucket = Math.floor(nowSec / tfSec) * tfSec;
        const nextBucket = currentBucket + tfSec;
        const remaining = Math.max(0, nextBucket - nowSec);

        return {
            type: 'time',
            seconds: remaining,
            text: this.formatCountdown(remaining)
        };
    }

    updateAllCountdownDisplays() {
        if (!this.charts || this.charts.length === 0) return;

        for (const cell of this.charts) {
            const info = this.getRemainingCandleTime(cell);
            if (cell.element) {
                const isUrgent = info.type === 'time' && info.seconds <= 10;
                
                // 1. Header countdown badge
                const badge = cell.element.querySelector(`#cell-countdown-${cell.index}`);
                if (badge) {
                    badge.classList.toggle('countdown-urgent', isUrgent);
                    badge.innerHTML = `<span class="countdown-dot"></span><span class="countdown-text">${info.text}</span>`;
                }

                // 2. Floating on-chart HUD countdown badge (Display Mode)
                const hudBadge = cell.element.querySelector(`#hud-countdown-${cell.index}`);
                if (hudBadge) {
                    hudBadge.classList.toggle('countdown-urgent', isUrgent);
                    hudBadge.innerHTML = `<span class="countdown-dot"></span><span class="hud-countdown-text">${info.text}</span>`;
                }
            }
        }
    }

    // =========================================================
    // ระบบ Realtime SSE Stream (Sub-Millisecond Zero-Lag จาก Server)
    // ส่งข้อมูลราคา Tick จริงและแท่งเทียนแท้จาก MT5 / IC Markets เข้าสู่หน้าจอโดยตรง
    // =========================================================
    initLiveStreamSSE() {
        try {
            if (this.sseEventSource) {
                this.sseEventSource.close();
            }
            this.sseEventSource = new EventSource('/api/live-stream');

            this.sseEventSource.addEventListener('rates_init', (event) => {
                try {
                    const rates = JSON.parse(event.data);
                    if (rates && typeof rates === 'object') {
                        this.cachedLiveRates = Object.assign(this.cachedLiveRates || {}, rates);
                    }
                } catch (e) {}
            });

            // 1. Tick จาก IC Markets ECN (Institutional Base Feed)
            this.sseEventSource.addEventListener('tick', (event) => {
                try {
                    const tick = JSON.parse(event.data);
                    if (tick && tick.symbol) {
                        this.handleLiveTickStream(tick);
                    }
                } catch (e) {}
            });

            // 2. MT5 Turbo Boost Tick (เมื่อเปิด MT5 จะนำไมโครทิคมาออสซิลเลตราคาเพื่อความเรียลไทม์สูงสุด)
            this.sseEventSource.addEventListener('mt5_tick', (event) => {
                try {
                    const tick = JSON.parse(event.data);
                    if (tick && tick.symbol) {
                        this.handleMT5BoostTick(tick);
                    }
                } catch (e) {}
            });

            // 3. แท่งเทียนสดจาก IC Markets ECN
            this.sseEventSource.addEventListener('candle_update', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.symbol && data.candle) {
                        this.handleLiveCandleStream(data.symbol, data.candle);
                    }
                } catch (e) {}
            });

            // 4. สแนปช็อตแท่งเทียน IC Markets เมื่อเริ่มต้นระบบ
            this.sseEventSource.addEventListener('candles_snapshot', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.symbol && data.candles) {
                        this.handleCandlesSnapshot(data);
                    }
                } catch (e) {}
            });

            this.sseEventSource.onerror = () => {
                // เบราว์เซอร์จะเชื่อมต่อใหม่ให้อัตโนมัติ (EventSource auto-reconnect)
            };
        } catch (err) {
            console.warn('Live Stream SSE init warning:', err);
        }
    }

    handleCandlesSnapshot(data) {
        if (!data || !data.symbol || !data.candles || data.candles.length === 0) return;
        const sym = data.symbol;
        if (this.rawCache[sym] && this.rawCache[sym].length > 0) {
            const timeMap = new Map();
            for (const c of this.rawCache[sym]) timeMap.set(c.time, c);
            for (const c of data.candles) timeMap.set(c.time, c);
            this.rawCache[sym] = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
        } else {
            this.rawCache[sym] = data.candles;
        }
        this.rawCacheTime[sym] = Date.now();
        if (this.charts) {
            for (const cell of this.charts) {
                if ((cell.symbol === sym || (sym === 'XAUUSD' && (cell.symbol.includes('XAU') || cell.symbol.includes('GOLD')))) && (!cell.visibleCandles || cell.visibleCandles.length < 50)) {
                    this.loadChartData(cell.index, cell.symbol, cell.timeframe);
                }
            }
        }
    }

    handleMT5BoostTick(tick) {
        if (!tick || !tick.symbol) return;
        this.lastMT5BoostTime = Date.now();
        this.isMT5BoostActive = true;

        const sym = tick.symbol;
        const price = tick.bid !== undefined ? tick.bid : (tick.close !== undefined ? tick.close : tick.lp);
        if (price === undefined || price === null || isNaN(price)) return;
        const decimals = tick.digits !== undefined ? tick.digits : (sym.includes('XAU') || sym.includes('GOLD') ? 3 : (sym.includes('JPY') ? 3 : (sym.includes('EUR') || sym.includes('GBP') ? 5 : 2)));

        if (sym === 'XAUUSD' || sym.includes('XAU') || sym.includes('GOLD')) {
            this.goldAnchorICPrice = price;
            if (this.lastPaxgPrice) {
                this.goldAnchorPaxgPrice = this.lastPaxgPrice;
                this.goldDelta = this.goldAnchorICPrice - this.goldAnchorPaxgPrice;
            }
        }

        if (!this.cachedLiveRates) this.cachedLiveRates = {};
        const cached = Object.assign({}, tick, { source: 'mt5_boost', mt5_active: true });
        this.cachedLiveRates[sym] = cached;
        if (sym === 'XAUUSD') {
            this.cachedLiveRates['GOLD'] = cached;
            this.cachedLiveRates['GOLDm#'] = cached;
            this.cachedLiveRates['GOLD#'] = cached;
            this.cachedLiveRates['XAUUSDm'] = cached;
        }

        // อัปเดตราคาใน Watchlist ทันทีด้วยความเร็วสูงจาก MT5
        if (window.watchlist && window.watchlist.items) {
            const item = window.watchlist.items.find(i => i.symbol === sym || (sym === 'XAUUSD' && (i.symbol === 'GOLD' || i.symbol === 'GOLDm#')));
            if (item) {
                item.price = price;
                const rows = document.querySelectorAll('.wl-item-row');
                rows.forEach(r => {
                    if (r.querySelector('.wl-symbol')?.innerText === item.symbol) {
                        const pEl = r.querySelector('.wl-price');
                        if (pEl) pEl.innerText = price.toFixed(decimals);
                    }
                });
            }
        }

        // หากอยู่ในโหมด Bar Replay จะไม่แก้ไขแท่งเทียนสด
        if (this.replayTime !== null || (window.replayEngine && window.replayEngine.isActive)) return;
        if (!this.charts || this.charts.length === 0) return;

        const matchingCharts = this.charts.filter(c => {
            if (c.symbol === sym) return true;
            if (sym === 'XAUUSD' && (c.symbol.includes('XAU') || c.symbol.includes('GOLD'))) return true;
            if (sym.includes('BTC') && c.symbol.includes('BTC')) return true;
            if (sym.includes('ETH') && c.symbol.includes('ETH')) return true;
            if (sym.includes('SOL') && c.symbol.includes('SOL')) return true;
            return false;
        });

        if (matchingCharts.length === 0) return;

        for (const cell of matchingCharts) {
            if (!cell.candleSeries || !cell.visibleCandles || cell.visibleCandles.length === 0) continue;
            if (cell.isRangeBar || cell.isTickBar) continue;

            const lastCandle = cell.visibleCandles[cell.visibleCandles.length - 1];
            if (lastCandle) {
                // ออสซิลเลตราคาปลายแท่งเทียนสด (Turbo Boost) โดยคงแท่งเทียนประวัติศาสตร์และราคาเปิดของ IC Markets ไว้
                lastCandle.high = Number(Math.max(lastCandle.high, price).toFixed(decimals));
                lastCandle.low = Number(Math.min(lastCandle.low, price).toFixed(decimals));
                lastCandle.close = price;
                lastCandle.volume = (lastCandle.volume || 100) + 1;

                cell.candleSeries.update({
                    time: lastCandle.time,
                    open: lastCandle.open,
                    high: lastCandle.high,
                    low: lastCandle.low,
                    close: lastCandle.close
                });
            }

            if (window.replayEngine) {
                if (window.replayEngine.checkLiveOrders) window.replayEngine.checkLiveOrders(cell.symbol, price);
                if (window.replayEngine.updateFloatingPnL) window.replayEngine.updateFloatingPnL(cell.symbol, price);
            }

            // ตรวจสอบ Price Alerts เมื่อราคาเคลื่อนผ่าน
            if (this.checkPriceAlerts) {
                this.checkPriceAlerts(cell.symbol, price);
            }
        }
    }

    handleLiveTickStream(tick) {
        if (!tick || !tick.symbol) return;
        const sym = tick.symbol;
        const price = tick.bid !== undefined ? tick.bid : (tick.close !== undefined ? tick.close : tick.lp);
        if (price === undefined || price === null || isNaN(price)) return;
        const decimals = tick.digits !== undefined ? tick.digits : (sym.includes('XAU') || sym.includes('GOLD') ? 3 : (sym.includes('JPY') ? 3 : (sym.includes('EUR') || sym.includes('GBP') ? 5 : 2)));

        if (sym === 'XAUUSD' || sym.includes('XAU') || sym.includes('GOLD')) {
            this.goldAnchorICPrice = price;
            if (this.lastPaxgPrice) {
                this.goldAnchorPaxgPrice = this.lastPaxgPrice;
                this.goldDelta = this.goldAnchorICPrice - this.goldAnchorPaxgPrice;
            }
        }

        if (!this.cachedLiveRates) this.cachedLiveRates = {};
        this.cachedLiveRates[sym] = tick;
        if (sym === 'XAUUSD') {
            this.cachedLiveRates['GOLD'] = tick;
            this.cachedLiveRates['GOLDm#'] = tick;
            this.cachedLiveRates['GOLD#'] = tick;
            this.cachedLiveRates['XAUUSDm'] = tick;
        } else if (sym === 'BTCUSDT') {
            this.cachedLiveRates['BTCUSD'] = tick;
        }

        // อัปเดตราคาใน Watchlist ทันที
        if (window.watchlist && window.watchlist.items) {
            const item = window.watchlist.items.find(i => i.symbol === sym || (sym === 'XAUUSD' && (i.symbol === 'GOLD' || i.symbol === 'GOLDm#')));
            if (item) {
                item.price = price;
                const rows = document.querySelectorAll('.wl-item-row');
                rows.forEach(r => {
                    if (r.querySelector('.wl-symbol')?.innerText === item.symbol) {
                        const pEl = r.querySelector('.wl-price');
                        if (pEl) pEl.innerText = price.toFixed(decimals);
                    }
                });
            }
        }

        // หากอยู่ในโหมด Bar Replay จะไม่แก้ไขแท่งเทียนสด
        if (this.replayTime !== null || (window.replayEngine && window.replayEngine.isActive)) return;
        if (!this.charts || this.charts.length === 0) return;

        const matchingCharts = this.charts.filter(c => {
            if (c.symbol === sym) return true;
            if (sym === 'XAUUSD' && (c.symbol.includes('XAU') || c.symbol.includes('GOLD'))) return true;
            if (sym.includes('BTC') && c.symbol.includes('BTC')) return true;
            if (sym.includes('ETH') && c.symbol.includes('ETH')) return true;
            if (sym.includes('SOL') && c.symbol.includes('SOL')) return true;
            return false;
        });

        if (matchingCharts.length === 0) return;

        const nowSec = Math.floor(Date.now() / 1000) + this.thailandOffset;

        for (const cell of matchingCharts) {
            if (!cell.candleSeries || !cell.visibleCandles || cell.visibleCandles.length === 0) continue;
            if (cell.isRangeBar || cell.isTickBar) continue;

            const tfMinutes = this.parseTimeframeToMinutes(cell.timeframe);
            const tfSeconds = tfMinutes * 60;
            const currentBucketTime = Math.floor(nowSec / tfSeconds) * tfSeconds;
            const lastCandle = cell.visibleCandles[cell.visibleCandles.length - 1];

            if (lastCandle && lastCandle.time === currentBucketTime) {
                lastCandle.high = Number(Math.max(lastCandle.high, price).toFixed(decimals));
                lastCandle.low = Number(Math.min(lastCandle.low, price).toFixed(decimals));
                lastCandle.close = price;
                lastCandle.volume = (lastCandle.volume || 100) + 1;

                cell.candleSeries.update({
                    time: lastCandle.time,
                    open: lastCandle.open,
                    high: lastCandle.high,
                    low: lastCandle.low,
                    close: lastCandle.close
                });

                if (cell.showVolume && cell.volumeSeries) {
                    cell.volumeSeries.update({
                        time: lastCandle.time,
                        value: lastCandle.volume,
                        color: lastCandle.close >= lastCandle.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)'
                    });
                }
            } else if (lastCandle && currentBucketTime > lastCandle.time) {
                const newCandle = {
                    time: currentBucketTime,
                    open: lastCandle.close,
                    high: Number(Math.max(lastCandle.close, price).toFixed(decimals)),
                    low: Number(Math.min(lastCandle.close, price).toFixed(decimals)),
                    close: price,
                    volume: 1
                };
                cell.visibleCandles.push(newCandle);
                cell.candleSeries.update(newCandle);
            }

            if (window.replayEngine) {
                if (window.replayEngine.checkLiveOrders) window.replayEngine.checkLiveOrders(cell.symbol, price);
                if (window.replayEngine.updateFloatingPnL) window.replayEngine.updateFloatingPnL(cell.symbol, price);
            }

            // ตรวจสอบ Price Alerts เมื่อราคาเคลื่อนผ่าน
            if (this.checkPriceAlerts) {
                this.checkPriceAlerts(cell.symbol, price);
            }
        }
    }

    handleLiveCandleStream(symbol, candle) {
        if (!candle || !symbol) return;
        if (this.replayTime !== null || (window.replayEngine && window.replayEngine.isActive)) return;
        if (!this.charts || this.charts.length === 0) return;

        const matchingCharts = this.charts.filter(c => {
            if (c.symbol === symbol) return true;
            if (symbol === 'XAUUSD' && (c.symbol.includes('XAU') || c.symbol.includes('GOLD'))) return true;
            return false;
        });

        for (const cell of matchingCharts) {
            if (!cell.candleSeries || !cell.visibleCandles || cell.visibleCandles.length === 0) continue;
            if (cell.isRangeBar || cell.isTickBar) continue;

            const tfMinutes = this.parseTimeframeToMinutes(cell.timeframe);
            if (tfMinutes === 1) {
                const existingIdx = cell.visibleCandles.findIndex(vc => vc.time === candle.time);
                if (existingIdx !== -1) {
                    cell.visibleCandles[existingIdx] = candle;
                } else if (candle.time > cell.visibleCandles[cell.visibleCandles.length - 1].time) {
                    cell.visibleCandles.push(candle);
                }
                cell.candleSeries.update(candle);
            } else {
                const tfSeconds = tfMinutes * 60;
                const bucketTime = Math.floor(candle.time / tfSeconds) * tfSeconds;
                const lastCandle = cell.visibleCandles[cell.visibleCandles.length - 1];

                if (lastCandle && lastCandle.time === bucketTime) {
                    lastCandle.high = Math.max(lastCandle.high, candle.high);
                    lastCandle.low = Math.min(lastCandle.low, candle.low);
                    lastCandle.close = candle.close;
                    lastCandle.volume = (lastCandle.volume || 0) + (candle.volume || 1);
                    cell.candleSeries.update({
                        time: lastCandle.time,
                        open: lastCandle.open,
                        high: lastCandle.high,
                        low: lastCandle.low,
                        close: lastCandle.close
                    });
                } else if (lastCandle && bucketTime > lastCandle.time) {
                    const newCandle = {
                        time: bucketTime,
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume || 1
                    };
                    cell.visibleCandles.push(newCandle);
                    cell.candleSeries.update(newCandle);
                }
            }
        }
    }

    // =========================================================
    // ระบบดึงราคาตลาดโลกสดตรงจาก Binance WebSocket (PAXG Gold & Crypto)
    // ผนวกราคา IC Markets Benchmark + Micro-Tick จาก PAXG ให้กราฟขยับเร็วสุดๆ Realtime
    // =========================================================
    initBinanceWebSocket() {
        try {
            const symbols = ['btcusdt', 'ethusdt', 'solusdt', 'paxgusdt'];
            const streams = symbols.map(s => `${s}@ticker`).join('/');
            const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;
            this.binanceWs = new WebSocket(wsUrl);

            this.binanceWs.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.s && data.c) {
                        const sym = data.s.toUpperCase();
                        const price = parseFloat(data.c);
                        this.liveCryptoPrices[sym] = {
                            price: price,
                            time: Date.now()
                        };
                        if (sym === 'PAXGUSDT') {
                            this.handlePaxgMicroTick(price);
                        }
                    }
                } catch (err) {}
            };

            this.binanceWs.onerror = () => {
                setTimeout(() => this.initBinanceWebSocket(), 5000);
            };

            this.binanceWs.onclose = () => {
                setTimeout(() => this.initBinanceWebSocket(), 5000);
            };
        } catch (e) {
            console.warn('Binance WebSocket init warning:', e);
        }
    }

    handlePaxgMicroTick(rawPaxg) {
        if (!rawPaxg || isNaN(rawPaxg) || rawPaxg <= 0) return;
        this.lastPaxgPrice = rawPaxg;

        // ซิงค์และปรับจูน Calibration Delta ให้ตรงกับ IC Markets / MT5 / TradingView แบบอัตโนมัติ
        const cachedXAU = (this.cachedLiveRates && this.cachedLiveRates['XAUUSD']) ? (this.cachedLiveRates['XAUUSD'].bid || this.cachedLiveRates['XAUUSD'].close) : null;
        if (cachedXAU && !isNaN(cachedXAU) && cachedXAU > 1000) {
            this.goldAnchorICPrice = Number(cachedXAU);
            this.goldAnchorPaxgPrice = rawPaxg;
            this.goldDelta = this.goldAnchorICPrice - this.goldAnchorPaxgPrice;
        } else if (this.goldDelta === undefined) {
            this.goldAnchorICPrice = rawPaxg;
            this.goldAnchorPaxgPrice = rawPaxg;
            this.goldDelta = 0;
        }

        // คำนวณราคา Gold ที่ผสาน IC Markets Benchmark เข้ากับความถี่ระดับ Micro-Tick จาก PAXG
        const calibratedGold = Number((rawPaxg + (this.goldDelta || 0)).toFixed(3));
        this.lastCalibratedGoldPrice = calibratedGold;
        this.applyLiveGoldMicroTick(calibratedGold);
    }

    applyLiveGoldMicroTick(price) {
        if (!price || isNaN(price)) return;
        if (!this.cachedLiveRates) this.cachedLiveRates = {};
        const rateObj = {
            symbol: 'XAUUSD',
            bid: price,
            ask: Number((price + 0.08).toFixed(3)),
            close: price,
            digits: 3,
            time: Math.floor(Date.now() / 1000),
            source: 'hybrid_realtime'
        };
        this.cachedLiveRates['XAUUSD'] = rateObj;
        this.cachedLiveRates['GOLD'] = rateObj;
        this.cachedLiveRates['GOLDm#'] = rateObj;
        this.cachedLiveRates['GOLD#'] = rateObj;
        this.cachedLiveRates['XAUUSDm'] = rateObj;

        // อัปเดตราคาใน Watchlist ทันทีแบบ Zero-Lag
        if (window.watchlist && window.watchlist.items) {
            const item = window.watchlist.items.find(i => i.symbol === 'XAUUSD' || i.symbol === 'GOLD' || i.symbol === 'GOLDm#');
            if (item) {
                item.price = price;
                const rows = document.querySelectorAll('.wl-item-row');
                rows.forEach(r => {
                    const symText = r.querySelector('.wl-symbol')?.innerText;
                    if (symText === 'XAUUSD' || symText === 'GOLD' || symText === 'GOLDm#') {
                        const pEl = r.querySelector('.wl-price');
                        if (pEl) pEl.innerText = price.toFixed(3);
                    }
                });
            }
        }

        // หากอยู่ในโหมด Bar Replay จะไม่แก้ไขแท่งเทียนสด
        if (this.replayTime !== null || (window.replayEngine && window.replayEngine.isActive)) return;
        if (!this.charts || this.charts.length === 0) return;

        const matchingCharts = this.charts.filter(c => c.symbol.includes('XAU') || c.symbol.includes('GOLD'));
        if (matchingCharts.length === 0) return;

        const nowSec = Math.floor(Date.now() / 1000) + this.thailandOffset;

        for (const cell of matchingCharts) {
            if (!cell.candleSeries || !cell.visibleCandles || cell.visibleCandles.length === 0) continue;
            if (cell.isRangeBar || cell.isTickBar) continue;

            const tfMinutes = this.parseTimeframeToMinutes(cell.timeframe);
            const tfSeconds = tfMinutes * 60;
            const currentBucketTime = Math.floor(nowSec / tfSeconds) * tfSeconds;
            const lastCandle = cell.visibleCandles[cell.visibleCandles.length - 1];

            if (lastCandle && lastCandle.time === currentBucketTime) {
                lastCandle.high = Number(Math.max(lastCandle.high, price).toFixed(3));
                lastCandle.low = Number(Math.min(lastCandle.low, price).toFixed(3));
                lastCandle.close = price;
                lastCandle.volume = (lastCandle.volume || 100) + 1;

                cell.candleSeries.update({
                    time: lastCandle.time,
                    open: lastCandle.open,
                    high: lastCandle.high,
                    low: lastCandle.low,
                    close: lastCandle.close
                });

                if (cell.showVolume && cell.volumeSeries) {
                    cell.volumeSeries.update({
                        time: lastCandle.time,
                        value: lastCandle.volume,
                        color: lastCandle.close >= lastCandle.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)'
                    });
                }
            } else if (lastCandle && currentBucketTime > lastCandle.time) {
                const newCandle = {
                    time: currentBucketTime,
                    open: lastCandle.close,
                    high: Number(Math.max(lastCandle.close, price).toFixed(3)),
                    low: Number(Math.min(lastCandle.close, price).toFixed(3)),
                    close: price,
                    volume: 1
                };
                cell.visibleCandles.push(newCandle);
                cell.candleSeries.update(newCandle);
            }

            if (window.replayEngine) {
                if (window.replayEngine.checkLiveOrders) window.replayEngine.checkLiveOrders(cell.symbol, price);
                if (window.replayEngine.updateFloatingPnL) window.replayEngine.updateFloatingPnL(cell.symbol, price);
            }
        }
    }

    // =========================================================
    // ระบบกราฟขยับตาม Timeframe และราคาตลาดจริงแบบ Live Realtime
    // =========================================================
    startLiveTicker() {
        if (this.liveTickerInterval) clearInterval(this.liveTickerInterval);

        // รัน Ticker ทุกๆ 250ms สำหรับส่งผ่านราคา Tick จริงแบบ Real-time ทันที (Fallback)
        this.liveTickerInterval = setInterval(() => {
            this.tickLiveCandles();
        }, 250);
    }

    async tickLiveCandles() {
        // หากอยู่ในโหมด Bar Replay จะหยุด Live ชั่วคราว
        if (this.replayTime !== null || (window.replayEngine && window.replayEngine.isActive)) {
            return;
        }

        if (!this.charts || this.charts.length === 0) return;

        // ดึงราคา Realtime ล่าสุดจาก Server API
        let liveRates = this.cachedLiveRates || null;
        try {
            const resp = await fetch('/api/live-rates', { cache: 'no-store' });
            if (resp.ok) {
                const resJson = await resp.json();
                if (resJson.status === 'ok' && resJson.rates) {
                    liveRates = Object.assign(liveRates || {}, resJson.rates);
                    this.cachedLiveRates = liveRates;
                }
            }
        } catch (e) {}

        // คำนวณราคา Ticks ปัจจุบันสำหรับแต่ละ Symbol ที่กำลังแสดงอยู่
        const activeSymbols = new Set(this.charts.map(c => c.symbol));
        const ticks = {};

        for (const sym of activeSymbols) {
            const isGold = sym.includes('XAU') || sym.includes('GOLD');
            const isForex = sym.includes('EUR') || sym.includes('GBP') || sym.includes('JPY') || sym.includes('AUD') || sym.includes('NZD');
            const decimals = isGold ? 3 : (isForex ? 5 : 2);

            let newPrice = null;
            let tickVol = Math.floor(Math.random() * 4) + 1;

            // ตรวจจับชื่อ Symbol ทั้งแบบตรงและแบบ Alias สำหรับคู่เงินยอดนิยม
            let rateObj = null;
            if (liveRates) {
                if (liveRates[sym]) {
                    rateObj = liveRates[sym];
                } else if (isGold) {
                    rateObj = liveRates['XAUUSD'] || liveRates['GOLD'] || liveRates['GOLDm#'] || liveRates['GOLD#'] || liveRates['XAUUSDm'];
                } else if (sym.includes('BTC')) {
                    rateObj = liveRates['BTCUSDT'] || liveRates['BTCUSD'] || liveRates['BTCUSD#'];
                } else if (sym.includes('EUR')) {
                    rateObj = liveRates['EURUSD'];
                } else if (sym.includes('GBP')) {
                    rateObj = liveRates['GBPUSD'];
                } else if (sym.includes('JPY')) {
                    rateObj = liveRates['USDJPY'];
                } else if (sym.includes('ETH')) {
                    rateObj = liveRates['ETHUSDT'] || liveRates['ETHUSD'];
                } else if (sym.includes('SOL')) {
                    rateObj = liveRates['SOLUSDT'] || liveRates['SOLUSD'];
                } else if (sym.includes('XAG') || sym.includes('SILV')) {
                    rateObj = liveRates['XAGUSD'] || liveRates['SILVER'];
                } else if (sym.includes('AUD')) {
                    rateObj = liveRates['AUDUSD'];
                } else if (sym.includes('NZD')) {
                    rateObj = liveRates['NZDUSD'];
                } else if (sym.includes('OIL')) {
                    rateObj = liveRates['USOIL'];
                }
            }

            const isMt5Live = rateObj && rateObj.source === 'mt5_live';

            if (isMt5Live && (rateObj.bid || rateObj.close)) {
                // 1. ถ้า MT5 กำลังเชื่อมต่ออยู่ ใช้ราคาจริงจากโบรกเกอร์ (Exness/XM 1:1) เป็นอันดับหนึ่งทันที!
                const rawBid = rateObj.bid || rateObj.close;
                newPrice = Number(rawBid.toFixed(decimals));
            } else if (rateObj && (rateObj.bid || rateObj.close)) {
                // 2. ใช้ราคาจริงจาก IC Markets Institutional Feed / TradingView Feed
                const rawBid = rateObj.bid || rateObj.close;
                newPrice = Number(rawBid.toFixed(decimals));
            } else {
                // 3. สำรองราคา Crypto และ Gold จาก Binance WebSocket
                let wsLive = null;
                if (isGold) {
                    const gPrice = this.lastCalibratedGoldPrice || (this.lastPaxgPrice ? (this.lastPaxgPrice + (this.goldDelta || 0)) : null);
                    if (gPrice) wsLive = { price: gPrice, time: Date.now() };
                } else {
                    wsLive = this.liveCryptoPrices[sym] || (sym.includes('BTC') ? this.liveCryptoPrices['BTCUSDT'] : (sym.includes('ETH') ? this.liveCryptoPrices['ETHUSDT'] : (sym.includes('SOL') ? this.liveCryptoPrices['SOLUSDT'] : null)));
                }
                if (wsLive && wsLive.price && (Date.now() - (wsLive.time || Date.now()) < 8000)) {
                    newPrice = Number(wsLive.price.toFixed(decimals));
                } else {
                    let lastPrice = this.getCurrentPrice(sym);
                    if (!lastPrice) {
                        lastPrice = isGold ? 4307.000 : (isForex ? 1.14660 : 76300.00);
                    }
                    newPrice = Number(lastPrice.toFixed(decimals));
                }
            }

            ticks[sym] = { price: newPrice, volume: tickVol, decimals };

            // อัปเดตราคาใน Watchlist แบบเรียลไทม์
            if (window.watchlist && window.watchlist.items) {
                const item = window.watchlist.items.find(i => i.symbol === sym);
                if (item) {
                    item.price = newPrice;
                    const rows = document.querySelectorAll('.wl-item-row');
                    rows.forEach(r => {
                        if (r.querySelector('.wl-symbol')?.innerText === sym) {
                            const pEl = r.querySelector('.wl-price');
                            if (pEl) pEl.innerText = newPrice.toFixed(decimals);
                        }
                    });
                }
            }
        }

        // อัปเดตแท่งเทียนในแต่ละช่องกราฟตาม Timeframe จริง
        const nowSec = Math.floor(Date.now() / 1000) + this.thailandOffset;

        for (const cell of this.charts) {
            if (!cell.candleSeries || !cell.visibleCandles || cell.visibleCandles.length === 0) continue;

            const tickData = ticks[cell.symbol];
            if (!tickData) continue;

            const livePrice = tickData.price;
            const tickVol = tickData.volume;

            if (cell.isRangeBar) {
                this.updateLiveRangeBar(cell, livePrice, tickVol);
            } else if (cell.isTickBar) {
                this.updateLiveTickBar(cell, livePrice, tickVol);
            } else {
                // Timeframe ปกติ (นาที/ชั่วโมง/วัน)
                const tfMinutes = this.parseTimeframeToMinutes(cell.timeframe);
                const tfSeconds = tfMinutes * 60;
                const currentBucketTime = Math.floor(nowSec / tfSeconds) * tfSeconds;

                const lastCandle = cell.visibleCandles[cell.visibleCandles.length - 1];

                if (lastCandle && lastCandle.time === currentBucketTime) {
                    // กำลังอยู่ในแท่งเวลาปัจจุบัน
                    lastCandle.high = Number(Math.max(lastCandle.high, livePrice).toFixed(tickData.decimals));
                    lastCandle.low = Number(Math.min(lastCandle.low, livePrice).toFixed(tickData.decimals));
                    lastCandle.close = livePrice;
                    lastCandle.volume = (lastCandle.volume || 100) + tickVol;

                    cell.candleSeries.update({
                        time: lastCandle.time,
                        open: lastCandle.open,
                        high: lastCandle.high,
                        low: lastCandle.low,
                        close: lastCandle.close
                    });

                    if (cell.showVolume && cell.volumeSeries) {
                        cell.volumeSeries.update({
                            time: lastCandle.time,
                            value: lastCandle.volume,
                            color: lastCandle.close >= lastCandle.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)'
                        });
                    }
                } else if (lastCandle && currentBucketTime > lastCandle.time) {
                    // เติมเต็มช่องว่างถ้ามีเวลาข้ามแท่ง (Gap filling เพื่อให้กราฟไหลลื่น ไม่มีช่องว่างแท่งหาย)
                    const missingBars = Math.min(30, Math.floor((currentBucketTime - lastCandle.time) / tfSeconds));
                    let prevClose = lastCandle.close;

                    for (let step = 1; step <= missingBars; step++) {
                        const barTime = lastCandle.time + (step * tfSeconds);
                        const isFinalBar = (barTime === currentBucketTime);
                        const barPrice = isFinalBar ? livePrice : prevClose;

                        const newCandle = {
                            time: barTime,
                            open: prevClose,
                            high: Number(Math.max(prevClose, barPrice).toFixed(tickData.decimals)),
                            low: Number(Math.min(prevClose, barPrice).toFixed(tickData.decimals)),
                            close: barPrice,
                            volume: isFinalBar ? tickVol : Math.floor(Math.random() * 20) + 10
                        };

                        cell.visibleCandles.push(newCandle);
                        cell.candleSeries.update(newCandle);

                        if (cell.showVolume && cell.volumeSeries) {
                            cell.volumeSeries.update({
                                time: newCandle.time,
                                value: newCandle.volume,
                                color: newCandle.close >= newCandle.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)'
                            });
                        }
                        prevClose = barPrice;
                    }
                } else if (!lastCandle) {
                    const newCandle = {
                        time: currentBucketTime,
                        open: livePrice,
                        high: livePrice,
                        low: livePrice,
                        close: livePrice,
                        volume: tickVol
                    };
                    cell.visibleCandles.push(newCandle);
                    cell.candleSeries.update(newCandle);
                }
            }

            // ซิงค์และยืดหดเส้นอินดิเคเตอร์ให้ตรงกับแท่งเทียนปัจจุบันแบบ Real-time
            if (cell.indicators && cell.indicators.length > 0) {
                this.recalculateIndicators(cell);
            }

            // ตรวจสอบ Order จำลองว่าชน TP/SL ในโหมด Live หรือไม่ และอัปเดต Floating P&L
            if (window.replayEngine) {
                if (window.replayEngine.checkLiveOrders) {
                    window.replayEngine.checkLiveOrders(cell.symbol, livePrice);
                }
                if (window.replayEngine.updateFloatingPnL) {
                    window.replayEngine.updateFloatingPnL(cell.symbol, livePrice);
                }
            }

            // ตรวจสอบ Price Alerts เมื่อราคาเคลื่อนผ่าน
            if (this.checkPriceAlerts) {
                this.checkPriceAlerts(cell.symbol, livePrice);
            }
        }
    }

    startBackgroundCandleSync() {
        if (this.backgroundSyncInterval) clearInterval(this.backgroundSyncInterval);

        // ดึงแท่งเทียนปิดจริงจาก MT5 ทุกๆ 2.5 วินาทีแบบ Zero-Lag Background Sync
        this.backgroundSyncInterval = setInterval(() => {
            this.syncCandlesFromBackend();
        }, 2500);

        // เมื่อแท็บกลับมา Active (ผู้ใช้สลับหน้าจอกลับมา) ให้ซิงค์แท่งเทียนล่าสุดทันที
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.syncCandlesFromBackend(true);
            }
        });
        window.addEventListener('focus', () => {
            this.syncCandlesFromBackend(true);
        });
    }

    async syncCandlesFromBackend(forceFullRefresh = false) {
        if (this.replayTime !== null || (window.replayEngine && window.replayEngine.isActive)) return;
        if (!this.charts || this.charts.length === 0) return;

        const uniqueSymbols = [...new Set(this.charts.map(c => c.symbol))];

        for (const sym of uniqueSymbols) {
            try {
                const reqCount = forceFullRefresh ? 100000 : 300;
                const resp = await fetch(`/api/candles?symbol=${sym}&count=${reqCount}&t=${Date.now()}`, { cache: 'no-store' });
                if (!resp.ok) continue;
                const resJson = await resp.json();
                if (resJson.status !== 'ok' || !resJson.candles || resJson.candles.length === 0) continue;

                const freshCandles = resJson.candles;
                // รวมแท่งเทียนสดเข้ากับข้อมูลเดิมโดยไม่ลบประวัติศาสตร์เดิม
                if (this.rawCache[sym] && this.rawCache[sym].length > 0) {
                    const timeMap = new Map();
                    for (const c of this.rawCache[sym]) timeMap.set(c.time, c);
                    for (const c of freshCandles) timeMap.set(c.time, c);
                    this.rawCache[sym] = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
                } else {
                    this.rawCache[sym] = freshCandles;
                }
                this.rawCacheTime[sym] = Date.now();

                const matchingCharts = this.charts.filter(c => c.symbol === sym);
                for (const cell of matchingCharts) {
                    if (cell.isRangeBar || cell.isTickBar) continue;
                    
                    const minutes = this.parseTimeframeToMinutes(cell.timeframe);
                    const resampled = Resampler.resampleTimeframe(this.rawCache[sym], minutes);
                    if (!resampled || resampled.length === 0) continue;

                    cell.rawM1 = this.rawCache[sym];

                    if (!cell.visibleCandles || cell.visibleCandles.length === 0) {
                        cell.visibleCandles = resampled;
                        cell.candleSeries.setData(resampled.map(c => ({
                            time: c.time,
                            open: c.open,
                            high: c.high,
                            low: c.low,
                            close: c.close
                        })));
                    } else {
                        // ผสานแท่งเทียนล่าสุดเข้ากับ visibleCandles อย่างราบรื่น
                        const lastVisible = cell.visibleCandles[cell.visibleCandles.length - 1];
                        const recentNew = resampled.slice(-8);

                        for (const rc of recentNew) {
                            const existingIdx = cell.visibleCandles.findIndex(vc => vc.time === rc.time);
                            if (existingIdx !== -1) {
                                cell.visibleCandles[existingIdx] = rc;
                                cell.candleSeries.update(rc);
                            } else if (rc.time > lastVisible.time) {
                                cell.visibleCandles.push(rc);
                                cell.candleSeries.update(rc);
                            }
                        }
                    }

                    if (cell.indicators && cell.indicators.length > 0) {
                        this.recalculateIndicators(cell);
                    }
                }
            } catch (e) {}
        }
    }

    updateLiveRangeBar(cell, livePrice, tickVol) {
        const last = cell.visibleCandles[cell.visibleCandles.length - 1];
        if (!last) return;

        const isGold = cell.symbol.includes('XAU') || cell.symbol.includes('GOLD');
        const decimals = isGold ? 3 : 2;

        last.high = Number(Math.max(last.high, livePrice).toFixed(decimals));
        last.low = Number(Math.min(last.low, livePrice).toFixed(decimals));
        last.close = livePrice;
        last.volume = (last.volume || 100) + tickVol;

        const diff = last.high - last.low;
        if (diff >= cell.rangeSize) {
            const newBar = {
                time: last.time + 60,
                open: livePrice,
                high: livePrice,
                low: livePrice,
                close: livePrice,
                volume: tickVol
            };
            cell.visibleCandles.push(newBar);
            cell.candleSeries.update(newBar);
        } else {
            cell.candleSeries.update(last);
        }

        if (cell.indicators && cell.indicators.length > 0) {
            this.recalculateIndicators(cell);
        }
    }

    updateLiveTickBar(cell, livePrice, tickVol) {
        const last = cell.visibleCandles[cell.visibleCandles.length - 1];
        if (!last) return;

        const isGold = cell.symbol.includes('XAU') || cell.symbol.includes('GOLD');
        const decimals = isGold ? 3 : 2;

        cell._currentTickCount = (cell._currentTickCount || 0) + tickVol;
        last.high = Number(Math.max(last.high, livePrice).toFixed(decimals));
        last.low = Number(Math.min(last.low, livePrice).toFixed(decimals));
        last.close = livePrice;
        last.volume = (last.volume || 100) + tickVol;

        if (cell._currentTickCount >= cell.ticksPerBar) {
            cell._currentTickCount = 0;
            const newBar = {
                time: last.time + 60,
                open: livePrice,
                high: livePrice,
                low: livePrice,
                close: livePrice,
                volume: tickVol
            };
            cell.visibleCandles.push(newBar);
            cell.candleSeries.update(newBar);
        } else {
            cell.candleSeries.update(last);
        }

        if (cell.indicators && cell.indicators.length > 0) {
            this.recalculateIndicators(cell);
        }
    }

    // ==========================================
    // ==========================================
    // Indicator & "Indicator on Indicator" Engine
    // ==========================================
    addIndicator(cellIndex, indicatorConfig, silent = false, skipSave = false) {
        const cell = this.charts[cellIndex];
        if (!cell) return;
        if (!cell.indicators) cell.indicators = [];

        const indType = (indicatorConfig.type || '').toUpperCase();
        const parentId = indicatorConfig.parentIndicatorId || null;
        const lineStyleMap = {
            'solid': (window.LightweightCharts && window.LightweightCharts.LineStyle) ? window.LightweightCharts.LineStyle.Solid : 0,
            'dashed': (window.LightweightCharts && window.LightweightCharts.LineStyle) ? window.LightweightCharts.LineStyle.Dashed : 2,
            'dotted': (window.LightweightCharts && window.LightweightCharts.LineStyle) ? window.LightweightCharts.LineStyle.Dotted : 1,
            'large_dashed': (window.LightweightCharts && window.LightweightCharts.LineStyle) ? window.LightweightCharts.LineStyle.LargeDashed : 3
        };

        const isPSAR = (indType === 'PSAR' || indType === 'SAR');
        const stepVal = parseFloat(indicatorConfig.step) || 0.02;
        const maxVal = parseFloat(indicatorConfig.max) || 0.20;

        const resolvedStyle = typeof indicatorConfig.lineStyle === 'number' ? indicatorConfig.lineStyle : (lineStyleMap[indicatorConfig.lineStyle] !== undefined ? lineStyleMap[indicatorConfig.lineStyle] : (isPSAR ? 1 : 0));
        const resolvedWidth = parseInt(indicatorConfig.lineWidth) || 1;
        const resolvedColor = indicatorConfig.color || (indType === 'SMA' ? '#fb923c' : (indType === 'EMA' ? '#38bdf8' : (isPSAR ? '#34d399' : '#c084fc')));
        const resolvedTitle = indicatorConfig.title || (isPSAR ? `PSAR (${stepVal}, ${maxVal})` : `${indType} (${indicatorConfig.period || 14})`);

        // ตรวจสอบว่ามี Indicator ค่าเดิมอยู่แล้วหรือไม่ (ถ้ามีค่าเดิม ให้ปรับแต่งของเดิม ไม่เพิ่มซ้ำ)
        const existing = cell.indicators.find(i => 
            (i.type || '').toUpperCase() === indType && 
            (isPSAR ? (i.step === stepVal && i.max === maxVal) : i.period === indicatorConfig.period) && 
            (i.parentIndicatorId || null) === parentId
        );

        if (existing) {
            existing.color = resolvedColor;
            existing.lineWidth = resolvedWidth;
            existing.lineStyle = indicatorConfig.lineStyle || (isPSAR ? 'dotted' : 'solid');
            existing.title = resolvedTitle;
            existing.step = stepVal;
            existing.max = maxVal;
            if (existing.series) {
                const updateOpts = {
                    color: resolvedColor,
                    lineWidth: resolvedWidth,
                    title: resolvedTitle
                };
                if (isPSAR) {
                    updateOpts.lineVisible = false;
                    updateOpts.pointMarkersVisible = true;
                    updateOpts.pointMarkersRadius = Math.max(2, resolvedWidth + 1.5);
                } else {
                    updateOpts.lineVisible = true;
                    updateOpts.pointMarkersVisible = false;
                    updateOpts.lineStyle = resolvedStyle;
                }
                existing.series.applyOptions(updateOpts);
            }
            this.recalculateIndicators(cell);
            if (!skipSave) this.saveSettingsToStorage();
            if (!silent && this.showToast) {
                this.showToast(`⚙️ ปรับแต่งเส้น ${resolvedTitle} แล้ว (ไม่ออกซ้ำ)`);
            }
            return existing.id;
        }

        const indId = indicatorConfig.id || ('IND_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
        let series = null;

        // ถ้าเป็น Child Indicator ที่ซ้อนบน RSI ให้จัด scaleId 'rsi' ให้อยู่โซนล่าง
        let targetPriceScaleId = undefined;
        if (indType === 'RSI') {
            targetPriceScaleId = 'rsi';
        } else if (parentId) {
            const parentInd = cell.indicators.find(i => i.id === parentId);
            if (parentInd && (parentInd.type || '').toUpperCase() === 'RSI') {
                targetPriceScaleId = 'rsi';
            }
        }

        if (indType === 'SMA' || indType === 'EMA') {
            const seriesOpts = {
                color: resolvedColor,
                lineWidth: resolvedWidth,
                lineStyle: resolvedStyle,
                title: resolvedTitle
            };
            if (targetPriceScaleId) seriesOpts.priceScaleId = targetPriceScaleId;
            series = cell.chart.addLineSeries(seriesOpts);
        } else if (isPSAR) {
            series = cell.chart.addLineSeries({
                color: resolvedColor,
                lineWidth: resolvedWidth,
                lineVisible: false,
                pointMarkersVisible: true,
                pointMarkersRadius: Math.max(2, resolvedWidth + 1.5),
                title: resolvedTitle,
                crosshairMarkerVisible: false
            });
        } else if (indType === 'RSI') {
            series = cell.chart.addLineSeries({
                color: resolvedColor,
                lineWidth: resolvedWidth,
                lineStyle: resolvedStyle,
                priceScaleId: 'rsi',
                title: resolvedTitle
            });
        }

        cell.indicators.push({
            id: indId,
            series,
            type: indType,
            period: indicatorConfig.period,
            step: stepVal,
            max: maxVal,
            color: resolvedColor,
            lineWidth: resolvedWidth,
            lineStyle: indicatorConfig.lineStyle || (isPSAR ? 'dotted' : 'solid'),
            parentIndicatorId: parentId,
            title: resolvedTitle
        });

        this.recalculateIndicators(cell);
        if (!skipSave) this.saveSettingsToStorage();
        if (!silent && this.showToast) {
            this.showToast(`✓ เพิ่ม ${resolvedTitle} บนชาร์ตที่ ${cellIndex + 1} แล้ว`);
        }
        return indId;
    }

    /**
     * แก้ไขการตั้งค่าของอินดิเคเตอร์ที่มีอยู่เดิม (ผ่านหน้าต่าง Sub-Modal)
     */
    updateIndicator(cellIndex, indicatorId, updatedConfig) {
        const cell = this.charts[cellIndex];
        if (!cell || !cell.indicators) return false;

        const ind = cell.indicators.find(i => i.id === indicatorId);
        if (!ind) return false;

        const lineStyleMap = {
            'solid': (window.LightweightCharts && window.LightweightCharts.LineStyle) ? window.LightweightCharts.LineStyle.Solid : 0,
            'dashed': (window.LightweightCharts && window.LightweightCharts.LineStyle) ? window.LightweightCharts.LineStyle.Dashed : 2,
            'dotted': (window.LightweightCharts && window.LightweightCharts.LineStyle) ? window.LightweightCharts.LineStyle.Dotted : 1,
            'large_dashed': (window.LightweightCharts && window.LightweightCharts.LineStyle) ? window.LightweightCharts.LineStyle.LargeDashed : 3
        };

        if (updatedConfig.color) ind.color = updatedConfig.color;
        if (updatedConfig.lineWidth) ind.lineWidth = parseInt(updatedConfig.lineWidth) || 1;
        if (updatedConfig.lineStyle) ind.lineStyle = updatedConfig.lineStyle;
        if (updatedConfig.period) ind.period = parseInt(updatedConfig.period) || 14;
        if (updatedConfig.step !== undefined) ind.step = parseFloat(updatedConfig.step) || 0.02;
        if (updatedConfig.max !== undefined) ind.max = parseFloat(updatedConfig.max) || 0.20;

        const isPSAR = (ind.type === 'PSAR' || ind.type === 'SAR');
        ind.title = updatedConfig.title || (isPSAR ? `PSAR (${ind.step}, ${ind.max})` : `${ind.type} (${ind.period})`);

        const resolvedStyle = typeof ind.lineStyle === 'number' ? ind.lineStyle : (lineStyleMap[ind.lineStyle] !== undefined ? lineStyleMap[ind.lineStyle] : (isPSAR ? 1 : 0));

        if (ind.series) {
            const updateOpts = {
                color: ind.color,
                lineWidth: ind.lineWidth,
                title: ind.title
            };
            if (isPSAR) {
                updateOpts.lineVisible = false;
                updateOpts.pointMarkersVisible = true;
                updateOpts.pointMarkersRadius = Math.max(2, ind.lineWidth + 1.5);
            } else {
                updateOpts.lineVisible = true;
                updateOpts.pointMarkersVisible = false;
                updateOpts.lineStyle = resolvedStyle;
            }
            ind.series.applyOptions(updateOpts);
        }

        this.recalculateIndicators(cell);
        this.saveSettingsToStorage();
        if (this.showToast) {
            this.showToast(`⚙️ บันทึกการแก้ไข ${ind.title} แล้ว`);
        }
        return true;
    }

    /**
     * ลบอินดิเคเตอร์ออกจากชาร์ต
     */
    removeIndicator(cellIndex, indicatorId) {
        const cell = this.charts[cellIndex];
        if (!cell || !cell.indicators) return;

        const indIndex = cell.indicators.findIndex(i => i.id === indicatorId);
        if (indIndex === -1) return;

        const ind = cell.indicators[indIndex];
        if (ind.series && cell.chart) {
            try {
                cell.chart.removeSeries(ind.series);
            } catch (e) {
                console.warn('Cannot remove series from chart', e);
            }
        }

        // ลบ Child Indicators ที่ซ้อนอยู่บนตัวนี้ออกด้วย
        const childIndicators = cell.indicators.filter(i => i.parentIndicatorId === indicatorId);
        for (const child of childIndicators) {
            if (child.series && cell.chart) {
                try {
                    cell.chart.removeSeries(child.series);
                } catch (e) {}
            }
        }

        cell.indicators = cell.indicators.filter(i => i.id !== indicatorId && i.parentIndicatorId !== indicatorId);
        this.recalculateIndicators(cell);
        this.saveSettingsToStorage();

        if (this.showToast) {
            this.showToast(`🗑️ ลบอินดิเคเตอร์ ${ind.title || ind.type} ออกจากชาร์ตแล้ว`);
        }
    }

    /**
     * คำนวณอินดิเคเตอร์ทั้งหมด รวมถึงกรณี Indicator on Indicator
     */
    recalculateIndicators(cell) {
        if (!cell.indicators || cell.indicators.length === 0) return;
        const candles = cell.visibleCandles;
        if (!candles || candles.length === 0) return;

        // ปรับแต่ง Scale Margins ให้กับ RSI เพื่อให้อยู่โซนล่างและไม่ชนกับ Candlesticks
        const hasRSI = cell.indicators.some(i => (i.type || '').toUpperCase() === 'RSI');
        if (hasRSI && cell.chart) {
            try {
                cell.chart.priceScale('rsi').applyOptions({
                    scaleMargins: {
                        top: 0.80,
                        bottom: 0.02
                    },
                    visible: false
                });
                cell.chart.priceScale('right').applyOptions({
                    scaleMargins: {
                        top: 0.08,
                        bottom: 0.22
                    }
                });
            } catch (e) {}
        } else if (cell.chart) {
            try {
                cell.chart.priceScale('right').applyOptions({
                    scaleMargins: {
                        top: 0.08,
                        bottom: 0.08
                    }
                });
            } catch (e) {}
        }

        // คำนวณ Parent Indicators ก่อน แล้วตามด้วย Child Indicators (Indicator on Indicator)
        const sortedIndicators = [...cell.indicators].sort((a, b) => {
            if (a.parentIndicatorId && !b.parentIndicatorId) return 1;
            if (!a.parentIndicatorId && b.parentIndicatorId) return -1;
            return 0;
        });

        for (const ind of sortedIndicators) {
            const type = (ind.type || '').toUpperCase();
            if (type === 'SMA') {
                let sourceData = candles;
                // ถ้าเป็น Indicator on Indicator ให้ดึงข้อมูลจาก Parent Indicator
                if (ind.parentIndicatorId) {
                    const parent = cell.indicators.find(i => i.id === ind.parentIndicatorId);
                    if (parent && parent.cachedResult) {
                        sourceData = parent.cachedResult;
                    }
                }
                const result = Indicators.calculateSMA(sourceData, ind.period || 14);
                ind.cachedResult = result;
                if (ind.series) ind.series.setData(result);
            } else if (type === 'EMA') {
                const result = Indicators.calculateEMA(candles, ind.period || 14);
                ind.cachedResult = result;
                if (ind.series) ind.series.setData(result);
            } else if (type === 'RSI') {
                const result = Indicators.calculateRSI(candles, ind.period || 14);
                ind.cachedResult = result;
                if (ind.series) ind.series.setData(result);
            } else if (type === 'PSAR' || type === 'SAR') {
                const result = Indicators.calculatePSAR(candles, ind.step || 0.02, ind.max || 0.20);
                ind.cachedResult = result;
                if (ind.series) ind.series.setData(result);
            }
        }
    }

    /**
     * นำเข้าชุด Preset อินดิเคเตอร์ตามสไตล์การเทรด (Scalping, Day Trade, Swing Trade, etc.)
     */
    applyIndicatorPreset(cellIndex, presetKey, replace = true) {
        const cell = this.charts[cellIndex];
        if (!cell) return;

        const preset = INDICATOR_PRESETS[presetKey];
        if (!preset) return;

        if (replace && cell.indicators && cell.indicators.length > 0) {
            const oldList = [...cell.indicators];
            for (const ind of oldList) {
                if (ind.series && cell.chart) {
                    try { cell.chart.removeSeries(ind.series); } catch (e) {}
                }
            }
            cell.indicators = [];
        }

        // เพิ่ม indicators ทั้งหมดใน preset
        for (const cfg of preset.indicators) {
            let parentId = null;
            if (cfg.parentType && cell.indicators) {
                const parent = cell.indicators.find(i => (i.type || '').toUpperCase() === (cfg.parentType || '').toUpperCase());
                if (parent) parentId = parent.id;
            }
            this.addIndicator(cellIndex, {
                type: cfg.type,
                period: cfg.period,
                step: cfg.step,
                max: cfg.max,
                color: cfg.color,
                lineWidth: cfg.lineWidth || 1,
                lineStyle: cfg.lineStyle || 'solid',
                title: cfg.title,
                parentIndicatorId: parentId
            }, true /* silent */, true /* skipSave until end */);
        }

        this.recalculateIndicators(cell);
        this.saveSettingsToStorage();
        this.showToast(`⚡ ใช้งาน Preset: ${preset.name} แล้ว`);
    }

    /**
     * ล้างอินดิเคเตอร์ทั้งหมดออกจากชาร์ต
     */
    clearChartIndicators(cellIndex) {
        const cell = this.charts[cellIndex];
        if (!cell || !cell.indicators) return;

        for (const ind of cell.indicators) {
            if (ind.series && cell.chart) {
                try { cell.chart.removeSeries(ind.series); } catch (e) {}
            }
        }
        cell.indicators = [];
        this.recalculateIndicators(cell);
        this.saveSettingsToStorage();
        this.showToast(`🧹 ล้างอินดิเคเตอร์ทั้งหมดบนชาร์ตที่ ${cellIndex + 1} แล้ว`);
    }

    // ==========================================
    // Visual Order Execution Lines (Multi-Chart Sync)
    // ==========================================
    drawOrderLines(order) {
        if (!order || !order.symbol) return;
        const matchingCells = this.charts.filter(c => c.symbol === order.symbol);
        if (matchingCells.length === 0) return;

        for (const cell of matchingCells) {
            // ลบเส้นเดิมของออเดอร์นี้ในชาร์ตช่องนี้ออกก่อน (ถ้ามี)
            if (cell.orderLines && cell.orderLines[order.id]) {
                const old = cell.orderLines[order.id];
                if (old.entryLine) old.series.removePriceLine(old.entryLine);
                if (old.slLine) old.series.removePriceLine(old.slLine);
                if (old.tpLine) old.series.removePriceLine(old.tpLine);
                delete cell.orderLines[order.id];
            }

            // Entry Line
            const entryLine = cell.candleSeries.createPriceLine({
                price: order.entryPrice,
                color: order.type === 'BUY' ? '#089981' : '#f23645',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Solid,
                title: `${order.type} ${order.lot}L`
            });

            let slLine = null;
            if (order.sl) {
                slLine = cell.candleSeries.createPriceLine({
                    price: order.sl,
                    color: '#f23645',
                    lineWidth: 1.5,
                    lineStyle: LightweightCharts.LineStyle.Dashed,
                    title: 'SL'
                });
            }

            let tpLine = null;
            if (order.tp) {
                tpLine = cell.candleSeries.createPriceLine({
                    price: order.tp,
                    color: '#089981',
                    lineWidth: 1.5,
                    lineStyle: LightweightCharts.LineStyle.Dashed,
                    title: 'TP'
                });
            }

            if (!cell.orderLines) cell.orderLines = {};
            cell.orderLines[order.id] = { entryLine, slLine, tpLine, series: cell.candleSeries };
            this.updateOverlays(cell);
        }
    }

    removeOrderLines(orderId) {
        for (const cell of this.charts) {
            if (cell.orderLines && cell.orderLines[orderId]) {
                const lines = cell.orderLines[orderId];
                if (lines.entryLine) lines.series.removePriceLine(lines.entryLine);
                if (lines.slLine) lines.series.removePriceLine(lines.slLine);
                if (lines.tpLine) lines.series.removePriceLine(lines.tpLine);
                delete cell.orderLines[orderId];
                this.updateOverlays(cell);
            }
        }
    }

    /**
     * เลือกโฟกัส Order บนชาร์ต (เมื่อคลิกที่ Position List หรือบนเส้นกราฟ)
     */
    selectOrder(orderId) {
        let found = false;
        this.charts.forEach(cell => {
            if (window.replayEngine && window.replayEngine.openOrders.some(o => o.id === orderId && o.symbol === cell.symbol)) {
                cell.selectedOrderId = orderId;
                this.updateOverlays(cell);
                found = true;
            }
        });
        if (found && this.showToast) {
            this.showToast('🎯 เลือกออเดอร์แล้ว: แสดงเส้น TP/SL และป้ายราคา');
        }
    }

    /**
     * ยกเลิกการเลือกเส้น Active Order บนทุกชาร์ต (เมื่อกด Esc หรือคลิกพื้นที่ว่าง)
     */
    clearActiveOrderLines() {
        let cleared = false;
        this.charts.forEach(cell => {
            if (cell.activeOrderLine || cell.selectedOrderId) {
                cell.activeOrderLine = null;
                cell.selectedOrderId = null;
                if (cell.element) {
                    const vp = cell.element.querySelector('.chart-viewport');
                    if (vp) vp.style.cursor = '';
                }
                this.updateOverlays(cell);
                cleared = true;
            }
        });
        if (cleared && this.showToast) {
            this.showToast('✕ ยกเลิกการเลือก Order แล้ว');
        }
    }

    /**
     * วาด Order ที่เปิดอยู่ทั้งหมดซ้ำลงบนทุกชาร์ต (เมื่อเปลี่ยน Layout, Symbol หรือ Timeframe)
     */
    redrawAllOrders() {
        if (!window.replayEngine || !window.replayEngine.openOrders) return;
        for (const order of window.replayEngine.openOrders) {
            this.drawOrderLines(order);
        }
    }

    // =========================================================
    // ฟีเจอร์วัดระยะ (TradingView Style Price & Bar Measure Tool)
    // =========================================================

    toggleMeasureTool(forceState) {
        this.isMeasureActive = forceState !== undefined ? forceState : !this.isMeasureActive;
        const btn = document.getElementById('btn-toggle-measure');
        if (btn) btn.classList.toggle('active', this.isMeasureActive);
        document.body.classList.toggle('measure-mode-active', this.isMeasureActive);

        // อัปเดตสถานะปุ่มวัดระยะบนหัวช่องกราฟทุกช่อง
        document.querySelectorAll('[id^="btn-cell-measure-"]').forEach(b => {
            b.classList.toggle('active', this.isMeasureActive);
        });

        if (!this.isMeasureActive) {
            this.charts.forEach(c => {
                c.measurePhase = 'idle';
                if (!c.measurePinned) {
                    delete c.measureStart;
                    delete c.measureCurrent;
                    const badge = c.element ? c.element.querySelector(`#measure-badge-${c.index}`) : null;
                    if (badge) badge.style.display = 'none';
                    this.updateOverlays(c);
                }
            });
        }

        // ปิด Fibo และ Drawing Tool ถ้าเปิด Measure
        if (this.isMeasureActive && this.isFibonacciActive) {
            this.toggleFibonacciTool(false);
        }
        if (this.isMeasureActive && this.activeDrawingTool) {
            this.setDrawingTool(null);
        }

        if (window.app && window.app.updateToolsMenuButton) {
            window.app.updateToolsMenuButton();
        }

        if (this.isMeasureActive) {
            this.showToast('📐 เปิดเครื่องมือวัดระยะ: แตะ/คลิกแล้วลากปล่อยเพื่อวัดจำนวนจุด, Pips, แท่ง และเวลา');
        }
    }

    clearAllMeasurements() {
        this.charts.forEach(c => {
            delete c.measureStart;
            delete c.measureCurrent;
            c.measurePinned = false;
            c.measurePhase = 'idle';
            const badge = c.element ? c.element.querySelector(`#measure-badge-${c.index}`) : null;
            if (badge) badge.style.display = 'none';
            this.updateOverlays(c);
        });
        if (this.isMeasureActive) {
            this.toggleMeasureTool(false);
        }
        this.showToast('🗑️ ลบการวัดระยะทั้งหมดแล้ว');
    }

    clearCellMeasurement(cellIndex) {
        const cell = this.charts[cellIndex];
        if (!cell) return;
        delete cell.measureStart;
        delete cell.measureCurrent;
        cell.measurePinned = false;
        cell.measurePhase = 'idle';
        const badge = cell.element ? cell.element.querySelector(`#measure-badge-${cellIndex}`) : null;
        if (badge) badge.style.display = 'none';
        this.updateOverlays(cell);
        this.showToast(`🗑️ ลบการวัดระยะบนชาร์ตที่ ${cellIndex + 1} แล้ว`);
    }

    renderMeasurementOverlay(cell, ctx) {
        if (!cell.measureStart || !cell.measureCurrent) return;
        const start = cell.measureStart;
        const curr = cell.measureCurrent;

        let x1 = cell.chart.timeScale().timeToCoordinate(start.time);
        let y1 = cell.candleSeries.priceToCoordinate(start.price);
        let x2 = cell.chart.timeScale().timeToCoordinate(curr.time);
        let y2 = cell.candleSeries.priceToCoordinate(curr.price);

        const canvasW = cell.vpCanvas.width;
        const canvasH = cell.vpCanvas.height;

        if (x1 === null) {
            if (cell.visibleCandles && cell.visibleCandles.length > 0) {
                const firstTime = cell.visibleCandles[0].time;
                const lastTime = cell.visibleCandles[cell.visibleCandles.length - 1].time;
                if (start.time < firstTime) x1 = -60;
                else if (start.time > lastTime) x1 = canvasW + 60;
                else {
                    const firstX = cell.chart.timeScale().timeToCoordinate(firstTime) || 0;
                    const lastX = cell.chart.timeScale().timeToCoordinate(lastTime) || canvasW;
                    const progress = (start.time - firstTime) / (lastTime - firstTime || 1);
                    x1 = firstX + progress * (lastX - firstX);
                }
            } else {
                x1 = start.x !== undefined ? start.x : 0;
            }
        }

        if (x2 === null) {
            if (cell.visibleCandles && cell.visibleCandles.length > 0) {
                const firstTime = cell.visibleCandles[0].time;
                const lastTime = cell.visibleCandles[cell.visibleCandles.length - 1].time;
                if (curr.time < firstTime) x2 = -60;
                else if (curr.time > lastTime) x2 = canvasW + 60;
                else {
                    const firstX = cell.chart.timeScale().timeToCoordinate(firstTime) || 0;
                    const lastX = cell.chart.timeScale().timeToCoordinate(lastTime) || canvasW;
                    const progress = (curr.time - firstTime) / (lastTime - firstTime || 1);
                    x2 = firstX + progress * (lastX - firstX);
                }
            } else {
                x2 = curr.x !== undefined ? curr.x : canvasW;
            }
        }

        if (y1 === null) {
            y1 = start.y !== undefined ? start.y : 50;
        }
        if (y2 === null) {
            y2 = curr.y !== undefined ? curr.y : canvasH - 50;
        }

        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        const width = Math.max(4, maxX - minX);
        const height = Math.max(4, maxY - minY);

        const isBullish = curr.price >= start.price;
        const deltaPrice = curr.price - start.price;
        const pct = ((deltaPrice / (start.price || 1)) * 100).toFixed(2);

        const isGold = cell.symbol.includes('XAU') || cell.symbol.includes('GOLD');
        const isForex = cell.symbol.includes('EUR') || cell.symbol.includes('GBP') || cell.symbol.includes('JPY') || cell.symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);
        const pointMultiplier = isGold ? 100 : (isForex ? 100000 : 100);
        const points = Math.round(Math.abs(deltaPrice) * pointMultiplier);
        const pips = (points / 10).toFixed(1);

        // คำนวณจำนวนแท่งและเวลาในช่วงที่วัด
        const minT = Math.min(start.time, curr.time);
        const maxT = Math.max(start.time, curr.time);
        const barsInRange = (cell.visibleCandles || []).filter(c => c.time >= minT && c.time <= maxT);
        const barCount = Math.max(1, barsInRange.length);
        const totalVol = barsInRange.reduce((sum, b) => sum + (b.volume || 0), 0);
        const timeDiffSec = maxT - minT;
        let timeStr = `${Math.round(timeDiffSec / 60)}m`;
        if (timeDiffSec >= 3600 && timeDiffSec < 86400) {
            timeStr = `${Math.floor(timeDiffSec / 3600)}h ${Math.round((timeDiffSec % 3600) / 60)}m`;
        } else if (timeDiffSec >= 86400) {
            timeStr = `${(timeDiffSec / 86400).toFixed(1)}d`;
        }

        ctx.save();

        // 1. กล่องสี่เหลี่ยมโปร่งแสง
        ctx.fillStyle = isBullish ? 'rgba(56, 189, 248, 0.16)' : 'rgba(239, 68, 68, 0.16)';
        ctx.fillRect(minX, minY, width, height);

        // 2. ขอบเส้นประ
        ctx.strokeStyle = isBullish ? '#38bdf8' : '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(minX, minY, width, height);

        // 3. เส้นทแยงมุม
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // 4. จุด Anchor เริ่มต้นและสิ้นสุด
        ctx.setLineDash([]);
        ctx.fillStyle = isBullish ? '#38bdf8' : '#ef4444';
        ctx.beginPath();
        ctx.arc(x1, y1, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x2, y2, 4, 0, Math.PI * 2);
        ctx.fill();

        // 5. ป้ายข้อมูลลอยตัว (Floating Measure HUD Badge)
        const hudW = 180;
        const hudH = 70;
        let hudX = x2 + 12;
        let hudY = y2 - hudH / 2;

        if (hudX + hudW > canvasW - 10) hudX = x2 - hudW - 12;
        if (hudX < 10) hudX = 10;
        if (hudY < 10) hudY = 10;
        if (hudY + hudH > canvasH - 10) hudY = canvasH - hudH - 10;

        ctx.fillStyle = 'rgba(15, 18, 26, 0.95)';
        ctx.strokeStyle = isBullish ? 'rgba(56, 189, 248, 0.7)' : 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(hudX, hudY, hudW, hudH, 8);
        ctx.fill();
        ctx.stroke();

        const sign = deltaPrice >= 0 ? '+' : '';
        const arrow = isBullish ? '▲' : '▼';
        
        // Line 1: Price Delta & Percent
        ctx.fillStyle = isBullish ? '#38bdf8' : '#ef4444';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`${arrow} ${sign}${deltaPrice.toFixed(decimals)} (${sign}${pct}%)`, hudX + 10, hudY + 20);

        // Line 2: Points & Pips
        ctx.fillStyle = '#f1f5f9';
        ctx.font = '600 11px monospace';
        ctx.fillText(`${points.toLocaleString()} Points (${pips} Pips)`, hudX + 10, hudY + 39);

        // Line 3: Bars, Time & Total Vol
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        const volStr = totalVol > 1000 ? `${(totalVol / 1000).toFixed(1)}K` : totalVol;
        ctx.fillText(`${barCount} Bars, ${timeStr} | Vol: ${volStr}`, hudX + 10, hudY + 56);

        ctx.restore();
    }

    // =========================================================
    // ฟีเจอร์ Fibonacci Retracement Tool (ระดับทองคำ 61.8%, 50%, 38.2%)
    // =========================================================

    toggleFibonacciTool(forceState) {
        this.isFibonacciActive = forceState !== undefined ? forceState : !this.isFibonacciActive;
        const btn = document.getElementById('btn-toggle-fibo');
        if (btn) btn.classList.toggle('active', this.isFibonacciActive);
        document.body.classList.toggle('fibo-mode-active', this.isFibonacciActive);

        // อัปเดตสถานะปุ่ม FIB บนหัวช่องกราฟทุกช่อง
        document.querySelectorAll('[id^="btn-cell-fibo-"]').forEach(b => {
            b.classList.toggle('active', this.isFibonacciActive);
        });

        if (!this.isFibonacciActive) {
            this.charts.forEach(c => {
                c.fiboPhase = 'idle';
                if (!c.fiboPinned) {
                    delete c.fiboStart;
                    delete c.fiboCurrent;
                    const badge = c.element ? c.element.querySelector(`#fibo-badge-${c.index}`) : null;
                    if (badge) badge.style.display = 'none';
                    this.updateOverlays(c);
                }
            });
        }

        // ปิด Measure tool และ Drawing Tool ถ้าเปิด Fibo
        if (this.isFibonacciActive && this.isMeasureActive) {
            this.toggleMeasureTool(false);
        }
        if (this.isFibonacciActive && this.activeDrawingTool) {
            this.setDrawingTool(null);
        }

        if (window.app && window.app.updateToolsMenuButton) {
            window.app.updateToolsMenuButton();
        }

        if (this.isFibonacciActive) {
            this.showToast('📐 เปิด Fibonacci Retracement: แตะ/คลิกจุด A (สวิง) แล้วลากปล่อยไปยังจุด B');
        }
    }

    clearAllFibonacci() {
        this.charts.forEach(c => {
            delete c.fiboStart;
            delete c.fiboCurrent;
            c.fiboPinned = false;
            c.fiboPhase = 'idle';
            const badge = c.element ? c.element.querySelector(`#fibo-badge-${c.index}`) : null;
            if (badge) badge.style.display = 'none';
            this.updateOverlays(c);
        });
        if (this.isFibonacciActive) {
            this.toggleFibonacciTool(false);
        }
        this.showToast('🗑️ ลบเส้น Fibonacci ทั้งหมดแล้ว');
    }

    clearCellFibonacci(cellIndex) {
        const cell = this.charts[cellIndex];
        if (!cell) return;
        delete cell.fiboStart;
        delete cell.fiboCurrent;
        cell.fiboPinned = false;
        cell.fiboPhase = 'idle';
        const badge = cell.element ? cell.element.querySelector(`#fibo-badge-${cellIndex}`) : null;
        if (badge) badge.style.display = 'none';
        this.updateOverlays(cell);
        this.showToast(`🗑️ ลบเส้น Fibonacci บนชาร์ตที่ ${cellIndex + 1} แล้ว`);
    }

    renderFibonacciOverlay(cell, ctx) {
        if (!cell.fiboStart || !cell.fiboCurrent) return;
        const start = cell.fiboStart;
        const curr = cell.fiboCurrent;

        let x1 = cell.chart.timeScale().timeToCoordinate(start.time);
        let y1 = cell.candleSeries.priceToCoordinate(start.price);
        let x2 = cell.chart.timeScale().timeToCoordinate(curr.time);
        let y2 = cell.candleSeries.priceToCoordinate(curr.price);

        const canvasW = cell.vpCanvas.width;
        const canvasH = cell.vpCanvas.height;

        if (x1 === null) {
            if (cell.visibleCandles && cell.visibleCandles.length > 0) {
                const firstTime = cell.visibleCandles[0].time;
                const lastTime = cell.visibleCandles[cell.visibleCandles.length - 1].time;
                if (start.time < firstTime) x1 = -60;
                else if (start.time > lastTime) x1 = canvasW + 60;
                else {
                    const firstX = cell.chart.timeScale().timeToCoordinate(firstTime) || 0;
                    const lastX = cell.chart.timeScale().timeToCoordinate(lastTime) || canvasW;
                    const progress = (start.time - firstTime) / (lastTime - firstTime || 1);
                    x1 = firstX + progress * (lastX - firstX);
                }
            } else {
                x1 = start.x !== undefined ? start.x : 0;
            }
        }

        if (x2 === null) {
            if (cell.visibleCandles && cell.visibleCandles.length > 0) {
                const firstTime = cell.visibleCandles[0].time;
                const lastTime = cell.visibleCandles[cell.visibleCandles.length - 1].time;
                if (curr.time < firstTime) x2 = -60;
                else if (curr.time > lastTime) x2 = canvasW + 60;
                else {
                    const firstX = cell.chart.timeScale().timeToCoordinate(firstTime) || 0;
                    const lastX = cell.chart.timeScale().timeToCoordinate(lastTime) || canvasW;
                    const progress = (curr.time - firstTime) / (lastTime - firstTime || 1);
                    x2 = firstX + progress * (lastX - firstX);
                }
            } else {
                x2 = curr.x !== undefined ? curr.x : canvasW;
            }
        }

        if (y1 === null) {
            y1 = start.y !== undefined ? start.y : 50;
        }
        if (y2 === null) {
            y2 = curr.y !== undefined ? curr.y : canvasH - 50;
        }

        const p1 = start.price; // Anchor A (ราคาจุดเริ่ม)
        const p2 = curr.price;  // Anchor B (ราคาจุดปลาย)
        const diff = p2 - p1;

        const isGold = cell.symbol.includes('XAU') || cell.symbol.includes('GOLD');
        const isForex = cell.symbol.includes('EUR') || cell.symbol.includes('GBP') || cell.symbol.includes('JPY') || cell.symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);

        const startX = Math.max(0, Math.min(x1, x2) - 20);
        const endX = canvasW - 55;

        // รายการระดับ Fibonacci มาตรฐานสากล
        const levels = [
            { ratio: 0.0,   label: '0.0% (0.000)',          color: '#94a3b8', lineWidth: 1.2, lineDash: [3, 3], bg: 'rgba(244, 63, 94, 0.05)' },
            { ratio: 0.236, label: '23.6% (0.236)',         color: '#f43f5e', lineWidth: 1.2, lineDash: [3, 3], bg: 'rgba(234, 179, 8, 0.06)' },
            { ratio: 0.382, label: '38.2% (0.382)',         color: '#eab308', lineWidth: 1.5, lineDash: [],       bg: 'rgba(56, 189, 248, 0.08)' },
            { ratio: 0.500, label: '50.0% (0.500)',         color: '#38bdf8', lineWidth: 1.8, lineDash: [],       bg: 'rgba(34, 197, 94, 0.16)' },
            { ratio: 0.618, label: '61.8% (0.618) ★ Golden', color: '#22c55e', lineWidth: 2.2, lineDash: [],       bg: 'rgba(168, 85, 247, 0.07)', isGolden: true },
            { ratio: 0.786, label: '78.6% (0.786)',         color: '#a855f7', lineWidth: 1.2, lineDash: [3, 3], bg: 'rgba(148, 163, 184, 0.04)' },
            { ratio: 1.000, label: '100.0% (1.000)',        color: '#94a3b8', lineWidth: 1.5, lineDash: [] },
            { ratio: 1.618, label: '161.8% (1.618) Target', color: '#f59e0b', lineWidth: 1.2, lineDash: [4, 4], isTarget: true }
        ];

        ctx.save();

        // คำนวณราคาและพิกัด Y สำหรับทุกระดับตาม Realtime Candle Series Price Scale
        const calculatedLevels = levels.map(lvl => {
            const price = p2 - (diff * lvl.ratio);
            let y = cell.candleSeries.priceToCoordinate(price);
            if (y === null) {
                y = y2 + (y1 - y2) * lvl.ratio;
            }
            return { ...lvl, price, y };
        });

        // 1. ระบายสีพื้นหลังแบ่งโซน (Zone Shading)
        for (let i = 0; i < calculatedLevels.length - 2; i++) {
            const current = calculatedLevels[i];
            const next = calculatedLevels[i + 1];
            if (current.y !== null && next.y !== null && current.bg) {
                const minY = Math.min(current.y, next.y);
                const height = Math.abs(current.y - next.y);
                ctx.fillStyle = current.bg;
                ctx.fillRect(startX, minY, endX - startX, height);
            }
        }

        // 2. ไฮไลท์โซนทองคำ (Golden Pocket Highlight: 0.500 - 0.618)
        const lvl500 = calculatedLevels.find(l => l.ratio === 0.500);
        const lvl618 = calculatedLevels.find(l => l.ratio === 0.618);
        if (lvl500 && lvl618 && lvl500.y !== null && lvl618.y !== null) {
            const gpMinY = Math.min(lvl500.y, lvl618.y);
            const gpH = Math.abs(lvl500.y - lvl618.y);
            ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
            ctx.fillRect(startX, gpMinY, endX - startX, gpH);
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(startX, gpMinY, endX - startX, gpH);
        }

        // 3. วาดเส้นระดับราคาและป้ายข้อมูล (Level Lines & Price Badges)
        calculatedLevels.forEach(lvl => {
            if (lvl.y === null) return;
            const y = lvl.y;

            // เส้นแนวนอน
            ctx.strokeStyle = lvl.color;
            ctx.lineWidth = lvl.lineWidth;
            ctx.setLineDash(lvl.lineDash);
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();

            // ป้ายบอกระดับราคา
            ctx.setLineDash([]);
            const labelText = `${lvl.label} : $${lvl.price.toFixed(decimals)}`;
            ctx.font = lvl.isGolden ? 'bold 11px monospace' : '10px monospace';
            const textMetrics = ctx.measureText(labelText);
            const badgeW = textMetrics.width + 12;
            const badgeH = 18;
            const badgeX = Math.max(10, Math.min(startX + 8, canvasW - badgeW - 60));
            const badgeY = y - badgeH / 2;

            ctx.fillStyle = lvl.isGolden ? 'rgba(18, 30, 24, 0.95)' : 'rgba(15, 18, 24, 0.9)';
            ctx.strokeStyle = lvl.color;
            ctx.lineWidth = lvl.isGolden ? 1.5 : 1;
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = lvl.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, badgeX + 6, y);
        });

        // 4. เส้น Trendline เชื่อมต่อระหว่างจุด Anchor A และ B
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // จุด Anchor จุดหมุน
        ctx.setLineDash([]);
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(x1, y1, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x2, y2, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`A ($${p1.toFixed(decimals)})`, x1 + 6, y1 - 6);
        ctx.fillText(`B ($${p2.toFixed(decimals)})`, x2 + 6, y2 - 6);

        // 5. ป้ายข้อความ Golden Pocket
        if (lvl618 && lvl500 && lvl618.y !== null && lvl500.y !== null) {
            const midY = (lvl500.y + lvl618.y) / 2;
            ctx.font = 'bold 9.5px sans-serif';
            ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
            ctx.fillText('✨ GOLDEN POCKET (0.5 - 0.618)', endX - 180, midY + 3);
        }

        ctx.restore();
    }

    // =========================================================
    // ฟีเจอร์ Auto-Scroll ล็อคแท่งเทียนล่าสุดในจอเสมอ
    // =========================================================

    /**
     * เลื่อนแกนเวลาของชาร์ตที่กำหนดไปยังแท่งเทียนล่าสุด โดยยังคงระดับการซูม/ย่อ/ขยายเดิมไว้ (Preserve Zoom / Bar Spacing)
     */
    scrollToLatestBar(cell) {
        if (!cell || !cell.chart) return;
        try {
            const timeScale = cell.chart.timeScale();
            // เลื่อนไปตำแหน่งแท่งล่าสุดโดยเว้นระยะ offset 5 bars จากขอบขวา โดยไม่ reset zoom
            if (typeof timeScale.scrollToPosition === 'function') {
                timeScale.scrollToPosition(5, false);
            } else if (typeof timeScale.scrollToRealtime === 'function') {
                timeScale.scrollToRealtime();
            }
        } catch (e) {
            console.warn('scrollToLatestBar error', e);
        }
    }

    /**
     * เลื่อนทุกชาร์ตใน Grid ให้แท่งเทียนล่าสุดอยู่ในจอเสมอ
     */
    scrollToAllLatestBars() {
        if (!this.charts || !this.charts.length) return;
        this.charts.forEach(cell => {
            this.scrollToLatestBar(cell);
        });
    }

    /**
     * สลับเปิด/ปิด โหมดล็อคแท่งเทียนล่าสุดในจอเสมอ
     */
    toggleAutoScroll(forceState) {
        if (typeof forceState === 'boolean') {
            this.isAutoScrollToLatest = forceState;
        } else {
            this.isAutoScrollToLatest = !this.isAutoScrollToLatest;
        }
        localStorage.setItem('tradingtools_auto_scroll', this.isAutoScrollToLatest ? 'true' : 'false');
        this.updateAutoScrollUI();

        if (this.isAutoScrollToLatest) {
            this.scrollToAllLatestBars();
            this.showToast('📍 ล็อคแท่งเทียนล่าสุดในจอเสมอ (Auto-Scroll ON)');
        } else {
            this.showToast('🔓 ปิดการล็อคแท่งเทียนล่าสุด (Auto-Scroll OFF)');
        }
    }

    /**
     * อัปเดตสถานะปุ่ม Auto-Scroll บน Menubar
     */
    updateAutoScrollUI() {
        const btn = document.getElementById('btn-toggle-autoscroll');
        if (btn) {
            if (this.isAutoScrollToLatest) {
                btn.classList.add('active');
                btn.setAttribute('title', 'ล็อคแท่งเทียนล่าสุดในจอเสมอ (เปิดอยู่) - คลิกเพื่อปิด');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('title', 'ล็อคแท่งเทียนล่าสุดในจอเสมอ (ปิดอยู่) - คลิกเพื่อเปิด');
            }
        }
    }

    // =========================================================
    // ฟีเจอร์รีเซ็ตกราฟ (ความกว้าง & ความสูง) + Context Menu
    // =========================================================

    /**
     * รีเซ็ตความกว้างและความสูงของแท่งกราฟกลับสู่ค่าปกติเดิม
     */
    resetChartScale(index) {
        const cell = this.charts[index];
        if (!cell || !cell.chart) return;

        // 1. รีเซ็ตแกนเวลา (ความกว้างแท่งเทียน / Time Scale Zoom)
        cell.chart.timeScale().resetTimeScale();
        if (this.isAutoScrollToLatest) {
            this.scrollToLatestBar(cell);
        } else {
            cell.chart.timeScale().fitContent();
        }

        // 2. รีเซ็ตแกนราคา (ความสูงแท่งเทียน / Price Scale AutoScale)
        cell.chart.priceScale('right').applyOptions({
            autoScale: true
        });

        // อัปเดต Overlay canvas
        this.updateOverlays(cell);

        // แสดงแจ้งเตือน
        this.showToast(`↺ รีเซ็ตสเกลและความกว้างของ ${cell.symbol} กลับสู่ค่าปกติแล้ว`);
    }

    /**
     * แสดง Context Menu เมื่อคลิกขวาที่ชาร์ต
     */
    showContextMenu(e, index) {
        let menu = document.getElementById('chart-context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'chart-context-menu';
            menu.className = 'chart-context-menu';
            document.body.appendChild(menu);

            // ซ่อนเมื่อคลิกที่อื่น
            document.addEventListener('click', () => {
                menu.classList.remove('visible');
            });
        }

        const cell = this.charts[index];
        if (!cell) return;

        const isGold = cell.symbol.includes('XAU') || cell.symbol.includes('GOLD');
        const isForex = cell.symbol.includes('EUR') || cell.symbol.includes('GBP') || cell.symbol.includes('JPY') || cell.symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);

        let clickedPrice = null;
        if (cell.candleSeries && cell.viewport) {
            const rect = cell.viewport.getBoundingClientRect();
            const relY = e.clientY - rect.top;
            clickedPrice = cell.candleSeries.coordinateToPrice(relY);
        }
        if (clickedPrice === null) {
            const lastC = cell.visibleCandles?.[cell.visibleCandles.length - 1];
            clickedPrice = lastC ? lastC.close : 2000;
        }
        const safeAlertPrice = Number(clickedPrice.toFixed(decimals));

        menu.innerHTML = `
            <button class="ctx-item primary" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);" onclick="window.chartEngine.addPriceAlert('${cell.symbol}', ${safeAlertPrice})">
                <span>🔔 ตั้งแจ้งเตือนราคา ($${safeAlertPrice.toFixed(decimals)})</span>
            </button>
            <div class="ctx-sep"></div>
            <button class="ctx-item primary" onclick="window.chartEngine.resetChartScale(${index})">
                <span>↺ รีเซ็ตมุมมองกราฟ (Reset Chart)</span>
                <span class="ctx-shortcut">Alt+R</span>
            </button>
            <div class="ctx-sep"></div>
            <button class="ctx-item" onclick="window.chartEngine.toggleMeasureTool()">
                <span>📏 เครื่องมือวัดระยะ (Measure Tool)</span>
                <span class="ctx-shortcut">Shift+Drag / Alt+M</span>
            </button>
            <button class="ctx-item" onclick="window.chartEngine.clearCellMeasurement(${index})">
                <span>🗑️ ลบการวัดระยะ</span>
            </button>
            <div class="ctx-sep"></div>
            <button class="ctx-item" onclick="window.chartEngine.toggleFibonacciTool()">
                <span>📐 วาด Fibonacci Retracement</span>
                <span class="ctx-shortcut">Alt+F</span>
            </button>
            <button class="ctx-item" onclick="window.chartEngine.clearCellFibonacci(${index})">
                <span>🗑️ ลบเส้น Fibonacci</span>
            </button>
            <div class="ctx-sep"></div>
            <button class="ctx-item" onclick="window.replayEngine.startCutMode()">
                <span>✂️ ตัดกราฟจากจุดนี้ (Bar Replay)</span>
            </button>
            <div class="ctx-sep"></div>
            <button class="ctx-item" onclick="window.chartEngine.toggleCellVolume(${index})">
                <span>📊 ${cell.showVolume ? '✓ ซ่อน Volume แนวตั้ง' : 'แสดง Volume แนวตั้ง'}</span>
            </button>
            <button class="ctx-item" onclick="window.chartEngine.toggleCellVP(${index})">
                <span>📈 ${cell.showVolumeProfile ? '✓ ซ่อน Volume Profile' : 'แสดง Volume Profile'}</span>
            </button>
            <button class="ctx-item" onclick="window.chartEngine.toggleCellFootprint(${index})">
                <span>👣 ${cell.showFootprint ? '✓ ซ่อน Volume Footprint' : 'แสดง Volume Footprint'}</span>
            </button>
            <button class="ctx-item" onclick="window.chartEngine.toggleCellPatterns(${index})">
                <span>🎯 ${cell.showPatterns ? '✓ ซ่อน Auto Patterns' : 'ตรวจจับ Auto Patterns'}</span>
            </button>
            <div class="ctx-sep"></div>
            <button class="ctx-item" onclick="window.chartEngine.clearAllDrawings(${index})">
                <span>🎨 ลบภาพวาดบนชาร์ตนี้</span>
            </button>
        `;

        // กำหนดตำแหน่งให้อยู่ในหน้าจอเสมอ
        const menuWidth = 230;
        const menuHeight = 250;
        let left = e.clientX;
        let top = e.clientY;

        if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
        if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.classList.add('visible');
    }

    // =========================================================
    // THEME SWITCHER (Neumorphic Dark / Light Mode)
    // =========================================================

    setTheme(theme) {
        this.theme = theme;
        const isLight = (theme === 'light');
        const chartBg = isLight ? '#ebf0f7' : '#0f1118';
        const chartTextColor = isLight ? '#1e293b' : '#8e9aa8';
        const gridColor = isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.04)';
        const borderColor = isLight ? '#c8d3e2' : '#1e2330';
        const crosshairColor = isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.3)';

        this.charts.forEach(cell => {
            if (!cell.chart) return;
            cell.chart.applyOptions({
                layout: {
                    background: { color: chartBg },
                    textColor: chartTextColor
                },
                grid: {
                    vertLines: { color: gridColor },
                    horzLines: { color: gridColor }
                },
                timeScale: {
                    borderColor: borderColor
                },
                rightPriceScale: {
                    borderColor: borderColor
                },
                crosshair: {
                    vertLine: { color: crosshairColor },
                    horzLine: { color: crosshairColor }
                }
            });
            this.updateOverlays(cell);
        });
    }

    // =========================================================
    // REAL-TIME PRICE ALERTS ENGINE (with Web Audio Chime)
    // =========================================================

    loadPriceAlerts() {
        try {
            const raw = localStorage.getItem('tradingtools_price_alerts');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    savePriceAlerts() {
        try {
            localStorage.setItem('tradingtools_price_alerts', JSON.stringify(this.priceAlerts || []));
        } catch (e) {}
    }

    playAlertSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const now = ctx.currentTime;
            
            // Tone 1: E5 (659.25Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(659.25, now);
            gain1.gain.setValueAtTime(0.3, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            // Tone 2: B5 (987.77Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(987.77, now + 0.12);
            gain2.gain.setValueAtTime(0.35, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.6);
        } catch (e) {
            console.warn('AudioContext beep error:', e);
        }
    }

    addPriceAlert(symbol, price, note = '') {
        if (!symbol || typeof price !== 'number') return;
        const isGold = symbol.includes('XAU') || symbol.includes('GOLD');
        const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);
        const alertPrice = Number(price.toFixed(decimals));

        if (!this.priceAlerts) this.priceAlerts = [];
        const alert = {
            id: 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            symbol,
            price: alertPrice,
            note: note || '',
            triggered: false,
            createdAt: Date.now()
        };

        this.priceAlerts.push(alert);
        this.savePriceAlerts();

        this.charts.forEach(c => {
            if (c.symbol === symbol) this.updateOverlays(c);
        });

        this.showToast(`🔔 ตั้งแจ้งเตือนราคา ${symbol} ที่ $${alertPrice.toFixed(decimals)} เรียบร้อย`);
    }

    deletePriceAlert(arg1, arg2) {
        const alertId = arg2 || arg1;
        if (!this.priceAlerts || !alertId) return;
        this.priceAlerts = this.priceAlerts.filter(a => a.id !== alertId);
        this.savePriceAlerts();
        this.charts.forEach(c => this.updateOverlays(c));
        this.showToast('🗑️ ลบการแจ้งเตือนราคาเรียบร้อย');
    }

    clearAllPriceAlerts(symbol) {
        if (!this.priceAlerts) return;
        this.priceAlerts = this.priceAlerts.filter(a => a.symbol !== symbol);
        this.savePriceAlerts();
        this.charts.forEach(c => {
            if (c.symbol === symbol) this.updateOverlays(c);
        });
        this.showToast(`🗑️ ลบการแจ้งเตือนราคาของ ${symbol} ทั้งหมดแล้ว`);
    }

    checkPriceAlerts(symbol, currentPrice) {
        if (!this.priceAlerts || this.priceAlerts.length === 0 || !currentPrice) return;
        if (!this.lastKnownAlertPrice) this.lastKnownAlertPrice = {};
        const prevPrice = this.lastKnownAlertPrice[symbol];
        this.lastKnownAlertPrice[symbol] = currentPrice;

        const matchingAlerts = this.priceAlerts.filter(a => a.symbol === symbol && !a.triggered);
        if (matchingAlerts.length === 0) return;

        const isGold = symbol.includes('XAU') || symbol.includes('GOLD');
        const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('AUD');
        const threshold = isGold ? 0.35 : (isForex ? 0.0003 : (symbol.includes('BTC') ? 15 : 0.5));

        for (const alert of matchingAlerts) {
            let isTriggered = false;
            if (prevPrice !== undefined && prevPrice !== null) {
                if ((prevPrice <= alert.price && currentPrice >= alert.price) ||
                    (prevPrice >= alert.price && currentPrice <= alert.price)) {
                    isTriggered = true;
                }
            }
            if (!isTriggered && Math.abs(currentPrice - alert.price) <= threshold) {
                isTriggered = true;
            }

            if (isTriggered) {
                alert.triggered = true;
                alert.triggeredAt = Date.now();
                this.savePriceAlerts();
                this.playAlertSound();
                this.showPriceAlertBanner(alert, currentPrice);
                this.charts.forEach(c => {
                    if (c.symbol === symbol) this.updateOverlays(c);
                });
            }
        }
    }

    showPriceAlertBanner(alert, currentPrice) {
        let banner = document.getElementById('price-alert-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'price-alert-banner';
            banner.className = 'price-alert-banner';
            document.body.appendChild(banner);
        }

        const isGold = alert.symbol.includes('XAU') || alert.symbol.includes('GOLD');
        const isForex = alert.symbol.includes('EUR') || alert.symbol.includes('GBP') || alert.symbol.includes('JPY') || alert.symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);

        banner.innerHTML = `
            <div class="pab-bell-pulse">🔔</div>
            <div class="pab-body">
                <div class="pab-title">ราคาแตะจุดแจ้งเตือน!</div>
                <div class="pab-detail"><b>${alert.symbol}</b> วิ่งถึงระดับ <b>$${alert.price.toFixed(decimals)}</b> แล้ว (ปัจจุบัน $${currentPrice.toFixed(decimals)})</div>
            </div>
            <button type="button" class="pab-close" onclick="window.chartEngine.dismissPriceAlertBanner()" title="ปิดการแจ้งเตือน">✕</button>
        `;

        banner.style.display = 'flex';
        banner.classList.add('visible');

        if (this.alertBannerTimeout) clearTimeout(this.alertBannerTimeout);
        this.alertBannerTimeout = setTimeout(() => {
            this.dismissPriceAlertBanner();
        }, 12000);
    }

    dismissPriceAlertBanner() {
        const banner = document.getElementById('price-alert-banner');
        if (banner) {
            banner.classList.remove('visible');
            setTimeout(() => { banner.style.display = 'none'; }, 250);
        }
    }

    // =========================================================
    // RISK / REWARD POSITION STATS CALCULATION
    // =========================================================

    calculatePositionStats(drawing, symbol) {
        if (!drawing || !drawing.points || drawing.points.length < 3) {
            return { rr: '0.00', rewardPts: 0, stopPts: 0, lotSize: '0.01', targetPrice: 0, stopPrice: 0, entryPrice: 0 };
        }
        const entryPrice = drawing.points[0].price;
        const targetPrice = drawing.points[1].price;
        const stopPrice = drawing.points[2].price;
        const isLong = (drawing.type === 'long_position');

        const reward = isLong ? (targetPrice - entryPrice) : (entryPrice - targetPrice);
        const risk = isLong ? (entryPrice - stopPrice) : (stopPrice - entryPrice);

        const rr = (risk > 0) ? (reward / risk).toFixed(2) : '0.00';

        const isGold = symbol.includes('XAU') || symbol.includes('GOLD');
        const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);

        let rewardPts = 0;
        let stopPts = 0;
        let contractSize = 100;

        if (isGold) {
            rewardPts = Math.round(reward * 10);
            stopPts = Math.round(risk * 10);
            contractSize = 100;
        } else if (isForex) {
            rewardPts = Math.round(reward * 10000);
            stopPts = Math.round(risk * 10000);
            contractSize = 100000;
        } else if (symbol.includes('BTC')) {
            rewardPts = Math.round(reward);
            stopPts = Math.round(risk);
            contractSize = 1;
        } else {
            rewardPts = Number(reward.toFixed(decimals));
            stopPts = Number(risk.toFixed(decimals));
            contractSize = 1;
        }

        const riskDollar = drawing.riskAmount || 100;
        let lotSize = 0.01;
        if (risk > 0 && contractSize > 0) {
            const lossPerLot = risk * contractSize;
            if (lossPerLot > 0) {
                lotSize = Math.max(0.01, Number((riskDollar / lossPerLot).toFixed(2)));
            }
        }

        return {
            rr,
            rewardPts,
            stopPts,
            lotSize: lotSize.toFixed(2),
            entryPrice,
            targetPrice,
            stopPrice,
            rewardPercent: entryPrice > 0 ? ((reward / entryPrice) * 100).toFixed(2) : '0.00',
            riskPercent: entryPrice > 0 ? ((risk / entryPrice) * 100).toFixed(2) : '0.00'
        };
    }

    // =========================================================
    // INTERACTIVE DRAWING TOOLS ENGINE (v2.6.0)
    // Locked Coordinates { time, price } to prevent drift during Zoom/Pan
    // =========================================================

    loadDrawings(symbol) {
        if (!symbol) return [];
        try {
            const raw = localStorage.getItem(`tradingtools_drawings_${symbol}`);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.warn('Failed to load drawings from storage', e);
            return [];
        }
    }

    saveDrawings(symbol, drawings) {
        if (!symbol) return;
        try {
            localStorage.setItem(`tradingtools_drawings_${symbol}`, JSON.stringify(drawings || []));
        } catch (e) {
            console.warn('Failed to save drawings to storage', e);
        }
    }

    getToolDisplayName(tool) {
        const names = {
            'trendline': 'เส้นแนวโน้ม (Trendline)',
            'horzline': 'เส้นแนวนอน (Horizontal Line)',
            'horzray': 'เรย์แนวนอน (Horizontal Ray)',
            'vertline': 'เส้นแนวตั้ง (Vertical Line)',
            'rectangle': 'กล่องโซน (Demand/Supply)',
            'path': 'เส้นทาง (Path)',
            'text': 'ข้อความ (Text)',
            'long_position': 'Long Position (R:R Ratio)',
            'short_position': 'Short Position (R:R Ratio)',
            'price_alert': 'Price Alert (แจ้งเตือนราคา)'
        };
        return names[tool] || tool;
    }

    setDrawingTool(tool) {
        this.activeDrawingTool = tool;

        const label = document.getElementById('tb-current-draw-label');
        const shortNames = {
            'trendline': 'เส้นแนวโน้ม',
            'horzline': 'เส้นแนวนอน',
            'horzray': 'เรย์แนวนอน',
            'vertline': 'เส้นแนวตั้ง',
            'rectangle': 'กล่องโซน',
            'path': 'เส้นทาง',
            'text': 'ข้อความ',
            'long_position': 'Long R:R',
            'short_position': 'Short R:R',
            'price_alert': 'แจ้งเตือนราคา'
        };
        if (label) {
            label.innerText = tool ? (shortNames[tool] || tool) : 'วาดอื่นๆ';
        }

        const btn = document.getElementById('btn-toggle-drawing-menu');
        if (btn) btn.classList.toggle('active', !!tool);

        // Update Quick-Access Topbar Buttons
        const btnTrend = document.getElementById('btn-draw-trendline');
        if (btnTrend) btnTrend.classList.toggle('active', tool === 'trendline');
        const btnHorz = document.getElementById('btn-draw-horzline');
        if (btnHorz) btnHorz.classList.toggle('active', tool === 'horzline');
        const btnRect = document.getElementById('btn-draw-rectangle');
        if (btnRect) btnRect.classList.toggle('active', tool === 'rectangle');

        document.querySelectorAll('.draw-tool-item').forEach(el => {
            el.classList.toggle('active', el.dataset.tool === tool);
        });

        document.body.classList.toggle('drawing-mode-active', !!tool);

        if (tool) {
            if (this.isMeasureActive) this.toggleMeasureTool(false);
            if (this.isFibonacciActive) this.toggleFibonacciTool(false);
            this.showToast(`🎨 เลือกเครื่องมือ: ${shortNames[tool]} (แตะ/คลิกบนกราฟเพื่อวาด)`);
        } else {
            this.charts.forEach(c => {
                if (c.currentDrawing) {
                    c.currentDrawing = null;
                    this.updateOverlays(c);
                }
            });
        }

        if (window.app && window.app.updateToolsMenuButton) {
            window.app.updateToolsMenuButton();
        }
    }

    handleDrawingPointerDown(cellObj, coords) {
        const tool = this.activeDrawingTool;
        if (!tool) return;

        const isGold = cellObj.symbol.includes('XAU') || cellObj.symbol.includes('GOLD');
        const isForex = cellObj.symbol.includes('EUR') || cellObj.symbol.includes('GBP') || cellObj.symbol.includes('JPY') || cellObj.symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);
        const safePrice = (typeof coords.price === 'number') ? coords.price : (cellObj.visibleCandles?.[cellObj.visibleCandles.length - 1]?.close || 2000);

        // 0. แจ้งเตือนราคา (Price Alert): คลิกจุดเดียว วางเส้น Alert ณ ระดับราคานั้นทันที
        if (tool === 'price_alert') {
            this.addPriceAlert(cellObj.symbol, safePrice);
            this.setDrawingTool(null);
            return;
        }

        // 0.1 Long & Short Position (Risk/Reward Ratio Calculator)
        if (tool === 'long_position' || tool === 'short_position') {
            const isLong = (tool === 'long_position');
            let defaultStopDist = isGold ? 3.0 : (isForex ? 0.0030 : (cellObj.symbol.includes('BTC') ? 500 : (safePrice * 0.01)));
            let defaultTargetDist = defaultStopDist * 2.0; // 2R default

            let targetPrice = isLong ? (safePrice + defaultTargetDist) : (safePrice - defaultTargetDist);
            let stopPrice = isLong ? (safePrice - defaultStopDist) : (safePrice + defaultStopDist);

            targetPrice = Number(targetPrice.toFixed(decimals));
            stopPrice = Number(stopPrice.toFixed(decimals));

            const tfMinutes = this.parseTimeframeToMinutes(cellObj.timeframe);
            const tfSec = tfMinutes * 60;
            const endTime = (coords.time || Math.floor(Date.now() / 1000)) + (22 * tfSec);

            const drawing = {
                id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                type: tool,
                points: [
                    { time: coords.time, price: safePrice },       // 0: Entry
                    { time: endTime, price: targetPrice },        // 1: Target (TP)
                    { time: endTime, price: stopPrice }           // 2: Stop Loss (SL)
                ],
                riskAmount: 100,
                selected: true
            };

            cellObj.drawings.push(drawing);
            cellObj.selectedDrawingId = drawing.id;
            this.saveDrawings(cellObj.symbol, cellObj.drawings);
            this.setDrawingTool(null);
            this.updateOverlays(cellObj);
            this.showDrawingActionBar(cellObj, drawing);
            this.showToast(`✓ วางกล่อง ${isLong ? 'Long (Buy)' : 'Short (Sell)'} R:R เรียบร้อย`);
            return;
        }

        // 1. เส้นแนวนอน (Horizontal Line): คลิกจุดเดียว วาดเส้นตลอดความกว้าง
        if (tool === 'horzline') {
            const drawing = {
                id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                type: 'horzline',
                points: [{ time: coords.time, price: safePrice }],
                color: '#38bdf8'
            };
            cellObj.drawings.push(drawing);
            this.saveDrawings(cellObj.symbol, cellObj.drawings);
            this.updateOverlays(cellObj);
            this.showToast(`✓ วาดเส้นแนวนอนที่ $${safePrice.toFixed(decimals)} เรียบร้อย`);
            this.setDrawingTool(null);
            return;
        }

        // 2. เรย์แนวนอน (Horizontal Ray): คลิกจุดเดียว ยิงเส้นตรงไปทางขวา
        if (tool === 'horzray') {
            const drawing = {
                id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                type: 'horzray',
                points: [{ time: coords.time, price: safePrice }],
                color: '#38bdf8'
            };
            cellObj.drawings.push(drawing);
            this.saveDrawings(cellObj.symbol, cellObj.drawings);
            this.updateOverlays(cellObj);
            this.showToast(`✓ วาดเรย์แนวนอนเรียบร้อย`);
            this.setDrawingTool(null);
        }

        // 3. เส้นแนวตั้ง (Vertical Line): คลิกจุดเดียว ลากเส้นระบุแท่งเทียน
        if (tool === 'vertline') {
            const drawing = {
                id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                type: 'vertline',
                points: [{ time: coords.time, price: coords.price }],
                color: '#38bdf8'
            };
            cellObj.drawings.push(drawing);
            this.saveDrawings(cellObj.symbol, cellObj.drawings);
            this.updateOverlays(cellObj);
            this.showToast(`✓ วาดเส้นแนวตั้งระบุแท่งเทียนเรียบร้อย`);
            this.setDrawingTool(null);
            return;
        }

        // 4. ข้อความ (Text Annotation): เปิดตัวพิมพ์ข้อความบนกราฟทันที (Inline Chart Text Editor)
        if (tool === 'text') {
            this.pendingTextCoords = {
                cellIndex: cellObj.index,
                symbol: cellObj.symbol,
                time: coords.time,
                price: coords.price,
                x: coords.x,
                y: coords.y
            };
            this.showInlineTextEditor(cellObj, coords, null);
            return;
        }

        // 5. เส้นแนวโน้ม (Trendline): จุดเริ่ม -> จุดสิ้นสุด
        if (tool === 'trendline') {
            if (!cellObj.currentDrawing) {
                cellObj.currentDrawing = {
                    id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    type: 'trendline',
                    points: [{ time: coords.time, price: coords.price }, { time: coords.time, price: coords.price }],
                    startX: coords.x,
                    startY: coords.y,
                    color: '#38bdf8',
                    phase: 'drawing'
                };
                this.updateOverlays(cellObj);
            } else {
                cellObj.currentDrawing.points[1] = { time: coords.time, price: coords.price };
                delete cellObj.currentDrawing.phase;
                delete cellObj.currentDrawing.startX;
                delete cellObj.currentDrawing.startY;
                cellObj.drawings.push(cellObj.currentDrawing);
                this.saveDrawings(cellObj.symbol, cellObj.drawings);
                cellObj.currentDrawing = null;
                this.setDrawingTool(null);
                this.updateOverlays(cellObj);
                this.showToast('✓ วาดเส้นแนวโน้มเรียบร้อย');
            }
            return;
        }

        // 6. Rectangle (กล่องโซน Demand/Supply): มุม A -> มุม B
        if (tool === 'rectangle') {
            if (!cellObj.currentDrawing) {
                cellObj.currentDrawing = {
                    id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    type: 'rectangle',
                    zoneType: 'demand',
                    extendRight: false,
                    label: 'Demand Zone',
                    points: [{ time: coords.time, price: coords.price }, { time: coords.time, price: coords.price }],
                    startX: coords.x,
                    startY: coords.y,
                    color: '#10b981',
                    phase: 'drawing'
                };
                this.updateOverlays(cellObj);
            } else {
                cellObj.currentDrawing.points[1] = { time: coords.time, price: coords.price };
                delete cellObj.currentDrawing.phase;
                delete cellObj.currentDrawing.startX;
                delete cellObj.currentDrawing.startY;
                cellObj.currentDrawing.selected = true;
                cellObj.selectedDrawingId = cellObj.currentDrawing.id;
                cellObj.drawings.push(cellObj.currentDrawing);
                this.saveDrawings(cellObj.symbol, cellObj.drawings);
                const finishedDrawing = cellObj.currentDrawing;
                cellObj.currentDrawing = null;
                this.setDrawingTool(null);
                this.updateOverlays(cellObj);
                this.showDrawingActionBar(cellObj, finishedDrawing);
                this.showToast('✓ วาดกล่องโซน Demand/Supply เรียบร้อย');
            }
            return;
        }

        // 7. เส้นทาง (Path / Polyline Arrow): คลิกเพิ่มจุดต่อเนื่อง ดับเบิ้ลคลิกเสร็จสิ้น
        if (tool === 'path') {
            if (!cellObj.currentDrawing) {
                cellObj.currentDrawing = {
                    id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    type: 'path',
                    points: [{ time: coords.time, price: coords.price }],
                    previewPoint: { time: coords.time, price: coords.price },
                    color: '#38bdf8',
                    lastClickTime: Date.now(),
                    phase: 'drawing'
                };
                this.updateOverlays(cellObj);
            } else {
                const now = Date.now();
                const isDoubleClick = (now - (cellObj.currentDrawing.lastClickTime || 0) < 320);
                cellObj.currentDrawing.lastClickTime = now;

                if (isDoubleClick && cellObj.currentDrawing.points.length >= 2) {
                    delete cellObj.currentDrawing.previewPoint;
                    delete cellObj.currentDrawing.lastClickTime;
                    delete cellObj.currentDrawing.phase;
                    cellObj.drawings.push(cellObj.currentDrawing);
                    this.saveDrawings(cellObj.symbol, cellObj.drawings);
                    cellObj.currentDrawing = null;
                    this.setDrawingTool(null);
                    this.updateOverlays(cellObj);
                    this.showToast('✓ วาดเส้นทางเรียบร้อย');
                    return;
                }

                cellObj.currentDrawing.points.push({ time: coords.time, price: coords.price });
                cellObj.currentDrawing.previewPoint = { time: coords.time, price: coords.price };
                this.updateOverlays(cellObj);
                this.showToast(`เส้นทาง: จุดที่ ${cellObj.currentDrawing.points.length} (ดับเบิ้ลคลิกเพื่อเสร็จสิ้น)`);
            }
        }
    }

    handleDrawingPointerMove(cellObj, coords) {
        if (!cellObj.currentDrawing) return;
        const type = cellObj.currentDrawing.type;
        if (type === 'trendline' || type === 'rectangle') {
            cellObj.currentDrawing.points[1] = { time: coords.time, price: coords.price };
            this.updateOverlays(cellObj);
        } else if (type === 'path') {
            cellObj.currentDrawing.previewPoint = { time: coords.time, price: coords.price };
            this.updateOverlays(cellObj);
        }
    }

    handleDrawingPointerUp(cellObj, coords) {
        if (!cellObj.currentDrawing) return;
        const cur = cellObj.currentDrawing;
        if (cur.type === 'trendline' || cur.type === 'rectangle') {
            if (cur.startX !== undefined && cur.startY !== undefined) {
                const dist = Math.hypot(coords.x - cur.startX, coords.y - cur.startY);
                if (dist > 15) {
                    cur.points[1] = { time: coords.time, price: coords.price };
                    delete cur.phase;
                    delete cur.startX;
                    delete cur.startY;
                    cellObj.drawings.push(cur);
                    this.saveDrawings(cellObj.symbol, cellObj.drawings);
                    cellObj.currentDrawing = null;
                    this.setDrawingTool(null);
                    this.updateOverlays(cellObj);
                    this.showToast(`✓ วาด${cur.type === 'trendline' ? 'เส้นแนวโน้ม' : 'Rectangle Zone'}เรียบร้อย`);
                }
            }
        }
    }

    showInlineTextEditor(cell, coords, existingDrawing = null) {
        let pop = document.getElementById('chart-inline-text-popover');
        if (!pop) {
            pop = document.createElement('div');
            pop.id = 'chart-inline-text-popover';
            pop.className = 'chart-inline-text-popover';
            document.body.appendChild(pop);
        }

        const currentCell = cell || this.getActiveChart();
        const cellIdx = currentCell ? currentCell.index : this.activeChartIndex;
        const sym = currentCell ? currentCell.symbol : 'SYMBOL';

        this.inlineTextContext = {
            cellIndex: cellIdx,
            symbol: sym,
            time: coords.time,
            price: coords.price,
            existingDrawingId: existingDrawing ? existingDrawing.id : null,
            selectedColor: existingDrawing ? (existingDrawing.color || '#38bdf8') : '#38bdf8',
            selectedSize: existingDrawing ? (existingDrawing.fontSize || 14) : 14
        };

        const ctx = this.inlineTextContext;
        const initText = existingDrawing ? (existingDrawing.text || '') : '';
        const isEdit = !!existingDrawing;

        pop.innerHTML = `
            <div class="citp-header">
                <span class="citp-title">${isEdit ? '✎ แก้ไขข้อความ' : '📝 ข้อความบนกราฟ'}</span>
                <button type="button" class="citp-close" onclick="window.chartEngine.cancelInlineText()" title="ยกเลิก (Esc)">✕</button>
            </div>
            <div class="citp-body">
                <input type="text" class="citp-input" id="citp-input" value="${initText.replace(/"/g, '&quot;')}" placeholder="พิมพ์ข้อความ... (กด Enter เพื่อวาง)" autocomplete="off" />
                <div class="citp-toolbar">
                    <div class="citp-colors">
                        <button type="button" class="citp-color-dot ${ctx.selectedColor === '#38bdf8' ? 'active' : ''}" data-color="#38bdf8" style="background:#38bdf8;" title="ฟ้า"></button>
                        <button type="button" class="citp-color-dot ${ctx.selectedColor === '#f59e0b' ? 'active' : ''}" data-color="#f59e0b" style="background:#f59e0b;" title="ส้ม/ทอง"></button>
                        <button type="button" class="citp-color-dot ${ctx.selectedColor === '#10b981' ? 'active' : ''}" data-color="#10b981" style="background:#10b981;" title="เขียว"></button>
                        <button type="button" class="citp-color-dot ${ctx.selectedColor === '#ef4444' ? 'active' : ''}" data-color="#ef4444" style="background:#ef4444;" title="แดง"></button>
                        <button type="button" class="citp-color-dot ${ctx.selectedColor === '#ffffff' ? 'active' : ''}" data-color="#ffffff" style="background:#ffffff;" title="ขาว"></button>
                    </div>
                    <div class="citp-sizes">
                        <button type="button" class="citp-size-btn ${ctx.selectedSize === 12 ? 'active' : ''}" data-size="12">12</button>
                        <button type="button" class="citp-size-btn ${ctx.selectedSize === 14 ? 'active' : ''}" data-size="14">14</button>
                        <button type="button" class="citp-size-btn ${ctx.selectedSize === 18 ? 'active' : ''}" data-size="18">18</button>
                        <button type="button" class="citp-size-btn ${ctx.selectedSize === 24 ? 'active' : ''}" data-size="24">24</button>
                    </div>
                </div>
            </div>
            <div class="citp-footer">
                <button type="button" class="citp-btn-cancel" onclick="window.chartEngine.cancelInlineText()">ยกเลิก</button>
                <button type="button" class="citp-btn-confirm" onclick="window.chartEngine.confirmInlineText()">✓ บันทึก</button>
            </div>
        `;

        // Bind color selection
        pop.querySelectorAll('.citp-color-dot').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                pop.querySelectorAll('.citp-color-dot').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.inlineTextContext.selectedColor = btn.dataset.color;
            };
        });

        // Bind size selection
        pop.querySelectorAll('.citp-size-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                pop.querySelectorAll('.citp-size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.inlineTextContext.selectedSize = parseInt(btn.dataset.size) || 14;
            };
        });

        // Input keyboard events
        const input = pop.querySelector('#citp-input');
        if (input) {
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.confirmInlineText();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelInlineText();
                }
            };
        }

        // Calculate absolute position on screen
        let screenX = window.innerWidth / 2 - 140;
        let screenY = window.innerHeight / 2 - 70;
        if (currentCell && currentCell.container) {
            const rect = currentCell.container.getBoundingClientRect();
            screenX = rect.left + (coords.x !== undefined ? coords.x : 100);
            screenY = rect.top + (coords.y !== undefined ? coords.y : 100);
        }

        const popW = 280;
        const popH = 145;
        let left = screenX + 10;
        let top = screenY - popH - 10;

        if (top < 70) top = screenY + 20;
        if (top + popH > window.innerHeight - 20) top = window.innerHeight - popH - 20;
        if (left + popW > window.innerWidth - 20) left = window.innerWidth - popW - 20;
        if (left < 16) left = 16;

        pop.style.left = `${left}px`;
        pop.style.top = `${top}px`;
        pop.classList.add('visible');
        pop.style.display = 'flex';

        setTimeout(() => {
            if (input) {
                input.focus();
                input.select();
            }
        }, 50);
    }

    confirmInlineText() {
        if (!this.inlineTextContext) return;
        const input = document.getElementById('citp-input');
        const text = input ? input.value.trim() : '';
        if (!text) {
            this.showToast('⚠️ กรุณากรอกข้อความ');
            if (input) input.focus();
            return;
        }

        const ctx = this.inlineTextContext;
        const cell = (ctx.cellIndex !== undefined && this.charts[ctx.cellIndex]) 
            ? this.charts[ctx.cellIndex] 
            : (this.charts.find(c => c.symbol === ctx.symbol) || this.getActiveChart());
        if (!cell) {
            this.cancelInlineText();
            return;
        }

        if (ctx.existingDrawingId) {
            // Edit existing text drawing
            const d = (cell.drawings || []).find(item => item.id === ctx.existingDrawingId);
            if (d) {
                d.text = text;
                d.color = ctx.selectedColor || '#38bdf8';
                d.fontSize = ctx.selectedSize || 14;
                d.selected = true;
                cell.selectedDrawingId = d.id;
                this.saveDrawings(cell.symbol, cell.drawings);
                this.updateOverlays(cell);
                this.showDrawingActionBar(cell, d);
                this.showToast(`✓ อัปเดตข้อความ "${text}" เรียบร้อย`);
            }
        } else {
            // Create new text annotation
            const drawing = {
                id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                type: 'text',
                text: text,
                color: ctx.selectedColor || '#38bdf8',
                fontSize: ctx.selectedSize || 14,
                points: [{ time: ctx.time, price: ctx.price }],
                selected: true
            };
            cell.drawings.push(drawing);
            cell.selectedDrawingId = drawing.id;
            this.saveDrawings(cell.symbol, cell.drawings);
            this.updateOverlays(cell);
            this.showDrawingActionBar(cell, drawing);
            this.showToast(`✓ บันทึกข้อความ "${text}" บนชาร์ต ${cell.symbol} เรียบร้อย`);
        }

        this.cancelInlineText();
        this.setDrawingTool(null);
    }

    cancelInlineText() {
        const pop = document.getElementById('chart-inline-text-popover');
        if (pop) {
            pop.classList.remove('visible');
            pop.style.display = 'none';
        }
        if (this.inlineTextContext && !this.inlineTextContext.existingDrawingId) {
            this.setDrawingTool(null);
        }
        this.inlineTextContext = null;
    }

    addTextAnnotation(text, color = '#38bdf8', fontSize = 14) {
        const coords = this.pendingTextCoords || (this.inlineTextContext ? {
            cellIndex: this.inlineTextContext.cellIndex,
            symbol: this.inlineTextContext.symbol,
            time: this.inlineTextContext.time,
            price: this.inlineTextContext.price
        } : null);
        if (!coords) return;
        const cell = (coords.cellIndex !== undefined && this.charts[coords.cellIndex]) 
            ? this.charts[coords.cellIndex] 
            : (this.charts.find(c => c.symbol === coords.symbol) || this.getActiveChart());
        if (!cell) return;

        const drawing = {
            id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            type: 'text',
            text: text,
            color: color,
            fontSize: parseInt(fontSize) || 14,
            points: [{ time: coords.time, price: coords.price }],
            selected: true
        };
        cell.drawings.push(drawing);
        cell.selectedDrawingId = drawing.id;
        this.saveDrawings(cell.symbol, cell.drawings);
        this.pendingTextCoords = null;
        this.setDrawingTool(null);
        this.updateOverlays(cell);
        this.showDrawingActionBar(cell, drawing);
        this.showToast(`✓ บันทึกข้อความบนชาร์ต ${cell.symbol} เรียบร้อย`);
    }

    deleteSelectedDrawing() {
        let deleted = false;
        for (const cell of this.charts) {
            if (cell && cell.selectedDrawingId) {
                const drawingId = cell.selectedDrawingId;
                cell.drawings = (cell.drawings || []).filter(d => d.id !== drawingId);
                cell.selectedDrawingId = null;
                this.saveDrawings(cell.symbol, cell.drawings);
                this.updateOverlays(cell);
                deleted = true;
            }
        }
        this.hideDrawingActionBar();
        if (deleted) {
            this.showToast('🗑️ ลบภาพวาดเรียบร้อย');
        }
    }

    deleteDrawingById(cellIndex, drawingId) {
        let found = false;
        const checkCells = [];
        if (cellIndex !== undefined && this.charts[cellIndex]) {
            checkCells.push(this.charts[cellIndex]);
        }
        for (const c of this.charts) {
            if (!checkCells.includes(c)) checkCells.push(c);
        }

        for (const cell of checkCells) {
            if (cell && cell.drawings && cell.drawings.some(d => d.id === drawingId)) {
                cell.drawings = cell.drawings.filter(d => d.id !== drawingId);
                if (cell.selectedDrawingId === drawingId) {
                    cell.selectedDrawingId = null;
                }
                this.saveDrawings(cell.symbol, cell.drawings);
                this.updateOverlays(cell);
                found = true;
            }
        }
        this.hideDrawingActionBar();
        if (found) {
            this.showToast('🗑️ ลบภาพวาดเรียบร้อย');
        }
    }

    scaleTextDrawing(cellIndex, drawingId, delta) {
        const idx = cellIndex !== undefined ? cellIndex : this.activeChartIndex;
        const cell = this.charts[idx];
        if (!cell) return;
        const d = (cell.drawings || []).find(item => item.id === drawingId);
        if (!d || d.type !== 'text') return;
        const curSize = d.fontSize || 14;
        d.fontSize = Math.max(10, Math.min(48, curSize + delta));
        this.saveDrawings(cell.symbol, cell.drawings);
        this.updateOverlays(cell);
        this.showDrawingActionBar(cell, d);
        this.showToast(`🔍 ปรับขนาดข้อความเป็น ${d.fontSize}px`);
    }

    updateTextAnnotation(cellIndex, drawingId, text, color, fontSize) {
        const idx = cellIndex !== undefined ? cellIndex : this.activeChartIndex;
        const cell = this.charts[idx];
        if (!cell) return;
        const d = (cell.drawings || []).find(item => item.id === drawingId);
        if (!d) return;
        d.text = text;
        if (color) d.color = color;
        if (fontSize) d.fontSize = parseInt(fontSize) || 14;
        d.selected = true;
        cell.selectedDrawingId = d.id;
        this.saveDrawings(cell.symbol, cell.drawings);
        this.updateOverlays(cell);
        this.showDrawingActionBar(cell, d);
        this.showToast(`✓ อัปเดตข้อความบนชาร์ต ${cell.symbol} เรียบร้อย`);
    }

    editTextDrawing(cellIndex, drawingId) {
        const idx = cellIndex !== undefined ? cellIndex : this.activeChartIndex;
        const cell = this.charts[idx];
        if (!cell) return;
        const d = (cell.drawings || []).find(item => item.id === drawingId);
        if (!d || d.type !== 'text') return;

        let screenCoords = null;
        if (d.points && d.points[0]) {
            const sx = cell.chart.timeScale().timeToCoordinate(d.points[0].time);
            const sy = cell.candleSeries.priceToCoordinate(d.points[0].price);
            if (sx !== null && sy !== null) {
                screenCoords = { x: sx, y: sy, time: d.points[0].time, price: d.points[0].price };
            }
        }
        if (!screenCoords) {
            screenCoords = { x: 120, y: 100, time: d.points[0]?.time, price: d.points[0]?.price };
        }
        this.showInlineTextEditor(cell, screenCoords, d);
    }

    showDrawingActionBar(cell, drawing) {
        if (!cell || (!cell.container && !cell.element) || !drawing) return;
        if (!cell.container && cell.element) cell.container = cell.element;
        let bar = document.getElementById('drawing-action-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'drawing-action-bar';
            bar.className = 'drawing-action-bar';
            document.body.appendChild(bar);
        }

        const cellIndex = cell.index;
        const drawingId = drawing.id;
        const isText = (drawing.type === 'text');

        if (isText) {
            const fontSize = drawing.fontSize || 14;
            bar.innerHTML = `
                <button type="button" class="dab-btn" onclick="window.chartEngine.scaleTextDrawing(${cellIndex}, '${drawingId}', -2)" title="ย่อขนาดตัวอักษร (-2px)">
                    <span>A−</span>
                </button>
                <span class="dab-label">${fontSize}px</span>
                <button type="button" class="dab-btn" onclick="window.chartEngine.scaleTextDrawing(${cellIndex}, '${drawingId}', 2)" title="ขยายขนาดตัวอักษร (+2px)">
                    <span>A+</span>
                </button>
                <div class="dab-sep"></div>
                <button type="button" class="dab-btn" onclick="window.chartEngine.editTextDrawing(${cellIndex}, '${drawingId}')" title="แก้ไขข้อความ">
                    <span>✎ แก้ไข</span>
                </button>
                <div class="dab-sep"></div>
                <button type="button" class="dab-btn dab-danger" onclick="window.chartEngine.deleteDrawingById(${cellIndex}, '${drawingId}')" title="ลบข้อความนี้ (✕)">
                    <span>✕ ลบ</span>
                </button>
                <button type="button" class="dab-btn" onclick="window.chartEngine.deselectAllDrawings()" title="ยกเลิกการเลือก" style="padding: 3px 6px;">
                    <span>✓</span>
                </button>
            `;
        } else if (drawing.type === 'rectangle') {
            const zone = drawing.zoneType || 'demand';
            const isExtended = !!drawing.extendRight;
            bar.innerHTML = `
                <button type="button" class="dab-btn ${zone === 'demand' ? 'dab-active' : ''}" style="${zone === 'demand' ? 'color:#10b981;font-weight:bold;' : ''}" onclick="window.chartEngine.setRectangleZoneType(${cellIndex}, '${drawingId}', 'demand')" title="โซน Demand (เขียว)">
                    <span>🟢 Demand</span>
                </button>
                <button type="button" class="dab-btn ${zone === 'supply' ? 'dab-active' : ''}" style="${zone === 'supply' ? 'color:#ef4444;font-weight:bold;' : ''}" onclick="window.chartEngine.setRectangleZoneType(${cellIndex}, '${drawingId}', 'supply')" title="โซน Supply (แดง)">
                    <span>🔴 Supply</span>
                </button>
                <button type="button" class="dab-btn ${zone === 'neutral' ? 'dab-active' : ''}" style="${zone === 'neutral' ? 'color:#3b82f6;font-weight:bold;' : ''}" onclick="window.chartEngine.setRectangleZoneType(${cellIndex}, '${drawingId}', 'neutral')" title="Order Block (น้ำเงิน)">
                    <span>🔵 OB</span>
                </button>
                <div class="dab-sep"></div>
                <button type="button" class="dab-btn ${isExtended ? 'dab-active' : ''}" onclick="window.chartEngine.toggleRectangleExtendRight(${cellIndex}, '${drawingId}')" title="${isExtended ? 'ปิดการยืดเส้นไปขวาสุด' : 'ยืดกล่องไปขวาสุดหน้าจออัตโนมัติ'}">
                    <span>${isExtended ? '⇤ หดขวา' : '⇥ ขยายขวา'}</span>
                </button>
                <button type="button" class="dab-btn" onclick="window.chartEngine.promptRectangleLabel(${cellIndex}, '${drawingId}')" title="เปลี่ยนชื่อป้ายโซน">
                    <span>🏷️ ป้าย</span>
                </button>
                <div class="dab-sep"></div>
                <button type="button" class="dab-btn dab-danger" onclick="window.chartEngine.deleteDrawingById(${cellIndex}, '${drawingId}')" title="ลบกล่องนี้ (✕)">
                    <span>✕ ลบ</span>
                </button>
                <button type="button" class="dab-btn" onclick="window.chartEngine.deselectAllDrawings()" title="ยกเลิกการเลือก" style="padding: 3px 6px;">
                    <span>✓</span>
                </button>
            `;
        } else if (drawing.type === 'long_position' || drawing.type === 'short_position') {
            const stats = this.calculatePositionStats(drawing, cell.symbol);
            const isLong = (drawing.type === 'long_position');
            bar.innerHTML = `
                <span class="dab-label" style="color: ${isLong ? '#10b981' : '#ef4444'}; font-weight: bold;">${isLong ? '▲ LONG' : '▼ SHORT'} R:R 1:${stats.rr}</span>
                <div class="dab-sep"></div>
                <button type="button" class="dab-btn" onclick="window.chartEngine.cyclePositionRisk(${cellIndex}, '${drawingId}')" title="คลิกเพื่อเปลี่ยนเงินทุนเสี่ยง ($50, $100, $200, $500, $1000)">
                    <span>💰 เสี่ยง: $${drawing.riskAmount || 100}</span>
                </button>
                <span class="dab-label" style="color: #38bdf8; font-size: 11px;">Lot: ${stats.lotSize}L</span>
                <div class="dab-sep"></div>
                <button type="button" class="dab-btn" onclick="window.chartEngine.deselectAllDrawings()" title="ปิดแถบเครื่องมือ (✓)" style="padding: 3px 6px;">
                    <span>✓</span>
                </button>
            `;
        } else {
            bar.innerHTML = `
                <span class="dab-label">${this.getToolDisplayName(drawing.type)}</span>
                <div class="dab-sep"></div>
                <button type="button" class="dab-btn dab-danger" onclick="window.chartEngine.deleteDrawingById(${cellIndex}, '${drawingId}')" title="ลบภาพวาดนี้ (✕)">
                    <span>✕ ลบ</span>
                </button>
                <button type="button" class="dab-btn" onclick="window.chartEngine.deselectAllDrawings()" title="ยกเลิกการเลือก" style="padding: 3px 6px;">
                    <span>✓</span>
                </button>
            `;
        }

        bar.classList.add('visible');
        this.updateDrawingActionBarPosition(cell, drawing);
    }

    setRectangleZoneType(cellIndex, drawingId, zoneType) {
        const idx = cellIndex !== undefined ? cellIndex : this.activeChartIndex;
        const cell = this.charts[idx];
        if (!cell) return;
        const d = (cell.drawings || []).find(item => item.id === drawingId);
        if (!d || d.type !== 'rectangle') return;
        d.zoneType = zoneType;
        if (zoneType === 'demand') {
            d.color = '#10b981';
            d.label = 'Demand Zone';
        } else if (zoneType === 'supply') {
            d.color = '#ef4444';
            d.label = 'Supply Zone';
        } else {
            d.color = '#3b82f6';
            d.label = 'Order Block';
        }
        this.saveDrawings(cell.symbol, cell.drawings);
        this.updateOverlays(cell);
        this.showDrawingActionBar(cell, d);
        this.showToast(`✓ เปลี่ยนกล่องเป็น ${d.label}`);
    }

    toggleRectangleExtendRight(cellIndex, drawingId) {
        const idx = cellIndex !== undefined ? cellIndex : this.activeChartIndex;
        const cell = this.charts[idx];
        if (!cell) return;
        const d = (cell.drawings || []).find(item => item.id === drawingId);
        if (!d || d.type !== 'rectangle') return;
        d.extendRight = !d.extendRight;
        this.saveDrawings(cell.symbol, cell.drawings);
        this.updateOverlays(cell);
        this.showDrawingActionBar(cell, d);
        this.showToast(d.extendRight ? '✓ ขยายโซนไปขวาสุด (Extend Right ON)' : '✓ ปิดการขยายขวา');
    }

    promptRectangleLabel(cellIndex, drawingId) {
        const idx = cellIndex !== undefined ? cellIndex : this.activeChartIndex;
        const cell = this.charts[idx];
        if (!cell) return;
        const d = (cell.drawings || []).find(item => item.id === drawingId);
        if (!d || d.type !== 'rectangle') return;
        const curLabel = d.label || (d.zoneType === 'supply' ? 'Supply Zone' : (d.zoneType === 'demand' ? 'Demand Zone' : 'Order Block'));
        const newLabel = prompt('ระบุป้ายชื่อโซน (เช่น Supply H4, Demand M15, OB Unmitigated):', curLabel);
        if (newLabel !== null) {
            d.label = newLabel.trim();
            this.saveDrawings(cell.symbol, cell.drawings);
            this.updateOverlays(cell);
            this.showDrawingActionBar(cell, d);
            this.showToast(`✓ ปรับป้ายชื่อเป็น "${d.label}"`);
        }
    }

    cyclePositionRisk(cellIndex, drawingId) {
        const idx = cellIndex !== undefined ? cellIndex : this.activeChartIndex;
        const cell = this.charts[idx];
        if (!cell) return;
        const d = (cell.drawings || []).find(item => item.id === drawingId);
        if (!d || (d.type !== 'long_position' && d.type !== 'short_position')) return;
        const risks = [50, 100, 200, 500, 1000];
        const curRisk = d.riskAmount || 100;
        const nextIdx = (risks.indexOf(curRisk) + 1) % risks.length;
        d.riskAmount = risks[nextIdx];
        this.saveDrawings(cell.symbol, cell.drawings);
        this.updateOverlays(cell);
        this.showDrawingActionBar(cell, d);
        this.showToast(`💰 เปลี่ยนความเสี่ยงเป็น $${d.riskAmount} USD`);
    }

    getAlertHitTest(cellObj, px, py) {
        if (!cellObj || !cellObj.candleSeries) return null;
        const alerts = (this.priceAlerts || []).filter(a => {
            if (!a || !a.symbol) return false;
            if (a.symbol === cellObj.symbol) return true;
            if ((cellObj.symbol.includes('XAU') || cellObj.symbol.includes('GOLD')) && (a.symbol.includes('XAU') || a.symbol.includes('GOLD'))) return true;
            if (cellObj.symbol.includes('BTC') && a.symbol.includes('BTC')) return true;
            return false;
        });
        if (alerts.length === 0) return null;

        const canvasW = (cellObj.vpCanvas && cellObj.vpCanvas.width) || (cellObj.container ? cellObj.container.clientWidth : 800);

        for (let i = alerts.length - 1; i >= 0; i--) {
            const alert = alerts[i];
            const y = cellObj.candleSeries.priceToCoordinate(alert.price);
            if (y === null) continue;

            const isGold = cellObj.symbol.includes('XAU') || cellObj.symbol.includes('GOLD');
            const isForex = cellObj.symbol.includes('EUR') || cellObj.symbol.includes('GBP') || cellObj.symbol.includes('JPY') || cellObj.symbol.includes('AUD');
            const decimals = isGold ? 3 : (isForex ? 5 : 2);
            const alertStr = `🔔 $${alert.price.toFixed(decimals)}  ✕`;
            const approxBadgeW = alertStr.length * 7 + 16;
            const badgeX = canvasW - approxBadgeW - 8;

            if (px >= badgeX - 6 && px <= canvasW && Math.abs(py - y) <= 12) {
                return { action: 'delete', alertId: alert.id, alert };
            }
        }
        return null;
    }

    hideDrawingActionBar() {
        const bar = document.getElementById('drawing-action-bar');
        if (bar) {
            bar.classList.remove('visible');
            bar.style.display = 'none';
        }
    }

    updateDrawingActionBarPosition(cell, drawing) {
        const bar = document.getElementById('drawing-action-bar');
        if (!bar || !bar.classList.contains('visible') || !cell || (!cell.container && !cell.element) || !drawing) return;
        if (!cell.container && cell.element) cell.container = cell.element;
        const pt = drawing.points ? drawing.points[0] : null;
        if (!pt) return;

        let x = cell.chart.timeScale().timeToCoordinate(pt.time);
        let y = cell.candleSeries.priceToCoordinate(pt.price);
        if (x === null || y === null) {
            bar.style.display = 'none';
            return;
        }

        const rect = cell.container.getBoundingClientRect();
        const barW = bar.offsetWidth || 210;
        const barH = bar.offsetHeight || 32;

        let screenX = rect.left + x + 8;
        let screenY = rect.top + y - barH - 12;

        if (screenX < rect.left + 8) screenX = rect.left + 8;
        if (screenX + barW > rect.right - 8) screenX = rect.right - barW - 8;
        if (screenY < rect.top + 34) screenY = rect.top + y + 24;

        bar.style.position = 'fixed';
        bar.style.left = `${screenX}px`;
        bar.style.top = `${screenY}px`;
        bar.style.display = 'flex';
    }

    deselectAllDrawings() {
        this.charts.forEach(c => {
            c.selectedDrawingId = null;
            (c.drawings || []).forEach(d => d.selected = false);
            this.updateOverlays(c);
        });
        this.hideDrawingActionBar();
    }

    clearAllDrawings(cellIndex) {
        const idx = cellIndex !== undefined ? cellIndex : this.activeChartIndex;
        const cell = this.charts[idx];
        if (!cell) return;
        cell.drawings = [];
        cell.currentDrawing = null;
        cell.selectedDrawingId = null;
        this.hideDrawingActionBar();
        this.saveDrawings(cell.symbol, []);
        this.updateOverlays(cell);
        this.showToast(`🗑️ ลบภาพวาดทั้งหมดบนชาร์ต ${cell.symbol} แล้ว`);
    }

    drawingCoordToScreen(cell, pt, canvasW) {
        if (!cell || !cell.chart || !pt) return { x: 0, y: 50 };
        const w = canvasW || (cell.vpCanvas ? cell.vpCanvas.width : (cell.container ? cell.container.clientWidth : 800));
        let x = cell.chart.timeScale().timeToCoordinate(pt.time);
        let y = cell.candleSeries ? cell.candleSeries.priceToCoordinate(pt.price) : null;

        if (x === null) {
            if (cell.visibleCandles && cell.visibleCandles.length > 0) {
                const firstT = cell.visibleCandles[0].time;
                const lastT = cell.visibleCandles[cell.visibleCandles.length - 1].time;
                const firstX = cell.chart.timeScale().timeToCoordinate(firstT) || 0;
                const lastX = cell.chart.timeScale().timeToCoordinate(lastT) || w;
                const barSpacing = (cell.chart.timeScale().options && cell.chart.timeScale().options().barSpacing) || 6;

                if (pt.time < firstT) {
                    const avgStep = (cell.visibleCandles.length > 1) ? (cell.visibleCandles[1].time - firstT) : 60;
                    const barsDiff = (firstT - pt.time) / (avgStep || 1);
                    x = firstX - barsDiff * barSpacing;
                } else if (pt.time > lastT) {
                    const avgStep = (cell.visibleCandles.length > 1) ? (lastT - cell.visibleCandles[cell.visibleCandles.length - 2].time) : 60;
                    const barsDiff = (pt.time - lastT) / (avgStep || 1);
                    x = lastX + barsDiff * barSpacing;
                } else {
                    let leftC = cell.visibleCandles[0];
                    let rightC = cell.visibleCandles[cell.visibleCandles.length - 1];
                    for (let i = 0; i < cell.visibleCandles.length - 1; i++) {
                        if (cell.visibleCandles[i].time <= pt.time && cell.visibleCandles[i+1].time >= pt.time) {
                            leftC = cell.visibleCandles[i];
                            rightC = cell.visibleCandles[i+1];
                            break;
                        }
                    }
                    const lx = cell.chart.timeScale().timeToCoordinate(leftC.time) || 0;
                    const rx = cell.chart.timeScale().timeToCoordinate(rightC.time) || w;
                    const factor = (rightC.time > leftC.time) ? (pt.time - leftC.time) / (rightC.time - leftC.time) : 0;
                    x = lx + factor * (rx - lx);
                }
            } else {
                x = 0;
            }
        }

        if (y === null) {
            y = 50;
        }
        return { x, y };
    }

    getDrawingDeleteBtnPos(d, cell, toScreen, canvasW, canvasH) {
        if (!d || !d.points || d.points.length === 0) return null;
        const screenFn = toScreen || ((pt) => this.drawingCoordToScreen(cell, pt, canvasW));
        if (d.type === 'text') {
            const p = screenFn(d.points[0]);
            const fontSize = d.fontSize || 14;
            const textStr = d.text || '';
            const approxW = Math.max(textStr.length * (fontSize * 0.72) + 24, 60);
            const boxH = fontSize + 16;
            const boxX = p.x + 8;
            const boxY = p.y - boxH - 6;
            return { x: boxX + approxW + 4, y: boxY - 4, r: 9 };
        }
        if (d.type === 'trendline' && d.points.length >= 2) {
            const p2 = screenFn(d.points[1]);
            return { x: p2.x + 14, y: p2.y - 14, r: 9 };
        }
        if (d.type === 'rectangle' && d.points.length >= 2) {
            const p1 = screenFn(d.points[0]);
            const p2 = screenFn(d.points[1]);
            const maxX = d.extendRight ? canvasW - 20 : Math.max(p1.x, p2.x);
            const minY = Math.min(p1.y, p2.y);
            return { x: maxX + 10, y: minY - 10, r: 9 };
        }
        if ((d.type === 'long_position' || d.type === 'short_position') && d.points.length >= 3) {
            const p0 = screenFn(d.points[0]);
            const p1 = screenFn(d.points[1]);
            const p2 = screenFn(d.points[2]);
            const rightX = Math.max(p0.x, p1.x);
            const topY = Math.min(p0.y, p1.y, p2.y);
            // วางปุ่มลบ [✕] สีแดงที่มุมบนขวาของกล่อง Position ตามภาพ และจำกัดให้อยู่ในหน้าจอเสมอ
            const safeX = Math.max(50, Math.min(canvasW - 20, rightX - 14));
            const safeY = Math.max(20, Math.min(canvasH - 20, topY + 14));
            return { x: safeX, y: safeY, r: 12 };
        }
        if (d.type === 'path' && d.points.length >= 2) {
            const lastPt = d.points[d.points.length - 1];
            const p = screenFn(lastPt);
            return { x: p.x + 14, y: p.y - 14, r: 9 };
        }
        if (d.type === 'horzline') {
            const pt = d.points[0];
            let y = cell.candleSeries ? cell.candleSeries.priceToCoordinate(pt.price) : null;
            if (y === null) y = screenFn(pt).y;
            return { x: Math.max(60, canvasW - 140), y: y - 14, r: 9 };
        }
        if (d.type === 'horzray') {
            const p1 = screenFn(d.points[0]);
            return { x: p1.x + 20, y: p1.y - 16, r: 9 };
        }
        if (d.type === 'vertline') {
            const p1 = screenFn(d.points[0]);
            return { x: p1.x + 16, y: 40, r: 9 };
        }
        const p0 = screenFn(d.points[0]);
        return { x: p0.x + 14, y: p0.y - 14, r: 9 };
    }

    getDrawingDeleteButtonHit(cell, px, py) {
        if (!cell || !cell.drawings) return null;
        const canvasW = (cell.vpCanvas && cell.vpCanvas.width) || (cell.container ? cell.container.clientWidth : 800);
        const canvasH = (cell.vpCanvas && cell.vpCanvas.height) || (cell.container ? cell.container.clientHeight : 600);
        const toScreen = (pt) => this.drawingCoordToScreen(cell, pt, canvasW);

        for (let i = cell.drawings.length - 1; i >= 0; i--) {
            const d = cell.drawings[i];
            if (!d || !d.points || d.points.length === 0) continue;
            const btn = this.getDrawingDeleteBtnPos(d, cell, toScreen, canvasW, canvasH);
            if (btn && Math.hypot(px - btn.x, py - btn.y) <= btn.r + 10) {
                return { type: 'DELETE_DRAWING', cellIndex: cell.index, drawingId: d.id, drawing: d };
            }
        }
        return null;
    }

    getDrawingHitTest(cell, px, py) {
        if (!cell || !cell.drawings || cell.drawings.length === 0) return null;
        const canvasW = (cell.vpCanvas && cell.vpCanvas.width) || (cell.container ? cell.container.clientWidth : 800);
        const toScreen = (pt) => this.drawingCoordToScreen(cell, pt, canvasW);

        const distToSegment = (x, y, x1, y1, x2, y2) => {
            const A = x - x1;
            const B = y - y1;
            const C = x2 - x1;
            const D = y2 - y1;
            const dot = A * C + B * D;
            const len_sq = C * C + D * D;
            let param = -1;
            if (len_sq !== 0) param = dot / len_sq;
            let xx, yy;
            if (param < 0) {
                xx = x1; yy = y1;
            } else if (param > 1) {
                xx = x2; yy = y2;
            } else {
                xx = x1 + param * C;
                yy = y1 + param * D;
            }
            return Math.hypot(x - xx, y - yy);
        };

        for (let i = cell.drawings.length - 1; i >= 0; i--) {
            const d = cell.drawings[i];
            if (!d || !d.points || d.points.length === 0) continue;

            if (d.type === 'trendline' && d.points.length >= 2) {
                const p1 = toScreen(d.points[0]);
                const p2 = toScreen(d.points[1]);
                if (distToSegment(px, py, p1.x, p1.y, p2.x, p2.y) <= 12) return d;
            } else if (d.type === 'horzline') {
                const pt = d.points[0];
                let y = cell.candleSeries.priceToCoordinate(pt.price);
                if (y === null) y = toScreen(pt).y;
                if (Math.abs(py - y) <= 12) return d;
            } else if (d.type === 'horzray') {
                const p1 = toScreen(d.points[0]);
                if (px >= p1.x - 10 && Math.abs(py - p1.y) <= 12) return d;
            } else if (d.type === 'vertline') {
                const p1 = toScreen(d.points[0]);
                if (Math.abs(px - p1.x) <= 12) return d;
            } else if (d.type === 'rectangle' && d.points.length >= 2) {
                const p1 = toScreen(d.points[0]);
                const p2 = toScreen(d.points[1]);
                const minX = Math.min(p1.x, p2.x) - 8;
                let maxX = Math.max(p1.x, p2.x) + 8;
                if (d.extendRight) maxX = canvasW;
                const minY = Math.min(p1.y, p2.y) - 8;
                const maxY = Math.max(p1.y, p2.y) + 8;
                if (px >= minX && px <= maxX && py >= minY && py <= maxY) return d;
            } else if ((d.type === 'long_position' || d.type === 'short_position') && d.points.length >= 3) {
                const p0 = toScreen(d.points[0]);
                const p1 = toScreen(d.points[1]);
                const p2 = toScreen(d.points[2]);
                const minX = Math.min(p0.x, p1.x) - 8;
                const maxX = Math.max(p0.x, p1.x) + 8;
                const minY = Math.min(p0.y, p1.y, p2.y) - 8;
                const maxY = Math.max(p0.y, p1.y, p2.y) + 8;
                if (px >= minX && px <= maxX && py >= minY && py <= maxY) return d;
            } else if (d.type === 'path' && d.points.length >= 2) {
                for (let j = 0; j < d.points.length - 1; j++) {
                    const p1 = toScreen(d.points[j]);
                    const p2 = toScreen(d.points[j + 1]);
                    if (distToSegment(px, py, p1.x, p1.y, p2.x, p2.y) <= 12) return d;
                }
            } else if (d.type === 'text') {
                const p = toScreen(d.points[0]);
                const fontSize = d.fontSize || 14;
                const textStr = d.text || '';
                const approxW = Math.max(textStr.length * (fontSize * 0.72) + 24, 60);
                const boxH = fontSize + 16;
                const boxX = p.x + 8;
                const boxY = p.y - boxH - 6;
                const inBox = (px >= boxX - 10 && px <= boxX + approxW + 10 && py >= boxY - 10 && py <= boxY + boxH + 10);
                const nearAnchor = (Math.hypot(px - p.x, py - p.y) <= 22);
                const nearLine = distToSegment(px, py, p.x, p.y, boxX, boxY + boxH / 2) <= 12;
                if (inBox || nearAnchor || nearLine) return d;
            }
        }
        return null;
    }

    drawSafeRoundedRect(ctx, x, y, w, h, r) {
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        } else {
            const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        }
    }

    renderDrawingOverlay(cell, ctx) {
        if (!cell || !cell.vpCanvas) return;
        const canvasW = cell.vpCanvas.width;
        const canvasH = cell.vpCanvas.height;

        const toScreen = (pt) => this.drawingCoordToScreen(cell, pt, canvasW);

        const isGold = cell.symbol.includes('XAU') || cell.symbol.includes('GOLD');
        const isForex = cell.symbol.includes('EUR') || cell.symbol.includes('GBP') || cell.symbol.includes('JPY') || cell.symbol.includes('AUD');
        const decimals = isGold ? 3 : (isForex ? 5 : 2);

        // 0. วาดเส้นแจ้งเตือนราคา (Price Alerts)
        const alerts = (this.priceAlerts || []).filter(a => {
            if (!a || !a.symbol) return false;
            if (a.symbol === cell.symbol) return true;
            if ((cell.symbol.includes('XAU') || cell.symbol.includes('GOLD')) && (a.symbol.includes('XAU') || a.symbol.includes('GOLD'))) return true;
            if (cell.symbol.includes('BTC') && a.symbol.includes('BTC')) return true;
            return false;
        });
        if (alerts.length > 0) {
            alerts.forEach(alert => {
                let y = cell.candleSeries ? cell.candleSeries.priceToCoordinate(alert.price) : null;
                if (y === null) return;
                ctx.save();
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 1.6;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvasW, y);
                ctx.stroke();

                ctx.setLineDash([]);
                const alertStr = `🔔 $${alert.price.toFixed(decimals)}  ✕`;
                ctx.font = 'bold 10px monospace';
                const metrics = ctx.measureText(alertStr);
                const badgeW = metrics.width + 12;
                const badgeH = 18;
                const badgeX = canvasW - badgeW - 8;
                const badgeY = y - badgeH / 2;

                ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                this.drawSafeRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#0f172a';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(alertStr, badgeX + 6, y);
                ctx.restore();
            });
        }

        const allDrawings = [...(cell.drawings || [])];
        if (cell.currentDrawing) {
            allDrawings.push(cell.currentDrawing);
        }

        allDrawings.forEach(d => {
            if (!d || !d.points || d.points.length === 0) return;
            const isSelected = !!d.selected;
            const isPreview = (d === cell.currentDrawing);
            const color = d.color || '#38bdf8';

            ctx.save();

            // 1. เส้นแนวโน้ม (Trendline)
            if (d.type === 'trendline' && d.points.length >= 2) {
                const p1 = toScreen(d.points[0]);
                const p2 = toScreen(d.points[1]);

                ctx.strokeStyle = isSelected ? '#a855f7' : color;
                ctx.lineWidth = isSelected ? 2.5 : 2;
                if (isPreview) ctx.setLineDash([4, 4]);

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();

                ctx.setLineDash([]);
                ctx.fillStyle = isSelected ? '#a855f7' : color;
                ctx.beginPath();
                ctx.arc(p1.x, p1.y, isSelected ? 5 : 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(p2.x, p2.y, isSelected ? 5 : 4, 0, Math.PI * 2);
                ctx.fill();

                if (isSelected) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(p1.x, p1.y, 6, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(p2.x, p2.y, 6, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            // 2. เส้นแนวนอน (Horizontal Line)
            else if (d.type === 'horzline') {
                const pt = d.points[0];
                let y = cell.candleSeries.priceToCoordinate(pt.price);
                if (y === null) y = toScreen(pt).y;

                ctx.strokeStyle = isSelected ? '#a855f7' : color;
                ctx.lineWidth = isSelected ? 2.2 : 1.8;
                if (isSelected) ctx.setLineDash([6, 3]);

                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvasW, y);
                ctx.stroke();

                ctx.setLineDash([]);
                const priceStr = `$${pt.price.toFixed(decimals)}`;
                ctx.font = 'bold 10.5px monospace';
                const metrics = ctx.measureText(priceStr);
                const badgeW = metrics.width + 12;
                const badgeH = 18;
                const badgeX = canvasW - badgeW - 8;
                const badgeY = y - badgeH / 2;

                ctx.fillStyle = isSelected ? 'rgba(168, 85, 247, 0.95)' : 'rgba(15, 23, 42, 0.9)';
                ctx.strokeStyle = isSelected ? '#ffffff' : color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = isSelected ? '#ffffff' : color;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(priceStr, badgeX + 6, y);
            }

            // 3. เรย์แนวนอน (Horizontal Ray)
            else if (d.type === 'horzray') {
                const pt = d.points[0];
                const p1 = toScreen(pt);

                ctx.strokeStyle = isSelected ? '#a855f7' : color;
                ctx.lineWidth = isSelected ? 2.2 : 1.8;
                if (isSelected) ctx.setLineDash([5, 3]);

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(canvasW, p1.y);
                ctx.stroke();

                ctx.setLineDash([]);
                ctx.fillStyle = isSelected ? '#a855f7' : color;
                ctx.beginPath();
                ctx.arc(p1.x, p1.y, isSelected ? 5 : 4, 0, Math.PI * 2);
                ctx.fill();

                const priceStr = `$${pt.price.toFixed(decimals)}`;
                ctx.font = 'bold 10px monospace';
                const metrics = ctx.measureText(priceStr);
                const badgeW = metrics.width + 10;
                const badgeH = 17;
                const badgeX = canvasW - badgeW - 8;
                const badgeY = p1.y - badgeH / 2;

                ctx.fillStyle = isSelected ? 'rgba(168, 85, 247, 0.95)' : 'rgba(15, 23, 42, 0.9)';
                ctx.strokeStyle = isSelected ? '#ffffff' : color;
                ctx.lineWidth = 1;
                this.drawSafeRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = isSelected ? '#ffffff' : color;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(priceStr, badgeX + 5, p1.y);
            }

            // 4. เส้นแนวตั้ง (Vertical Line)
            else if (d.type === 'vertline') {
                const pt = d.points[0];
                const p1 = toScreen(pt);

                ctx.strokeStyle = isSelected ? '#a855f7' : color;
                ctx.lineWidth = isSelected ? 2.2 : 1.8;
                ctx.setLineDash([4, 4]);

                ctx.beginPath();
                ctx.moveTo(p1.x, 0);
                ctx.lineTo(p1.x, canvasH);
                ctx.stroke();

                ctx.setLineDash([]);
                const dateObj = new Date(pt.time * 1000);
                const timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
                ctx.font = 'bold 9.5px monospace';
                const metrics = ctx.measureText(timeStr);
                const badgeW = metrics.width + 8;
                const badgeH = 16;
                const badgeX = p1.x - badgeW / 2;
                const badgeY = canvasH - 24;

                ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                ctx.strokeStyle = isSelected ? '#a855f7' : color;
                ctx.lineWidth = 1;
                this.drawSafeRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = isSelected ? '#c084fc' : color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(timeStr, p1.x, badgeY + badgeH / 2);
            }

            // 5. Rectangle (Demand/Supply / Order Block Zone)
            else if (d.type === 'rectangle' && d.points.length >= 2) {
                const p1 = toScreen(d.points[0]);
                const p2 = toScreen(d.points[1]);

                const minX = Math.min(p1.x, p2.x);
                let maxX = Math.max(p1.x, p2.x);
                if (d.extendRight) maxX = canvasW;
                const minY = Math.min(p1.y, p2.y);
                const maxY = Math.max(p1.y, p2.y);
                const w = Math.max(3, maxX - minX);
                const h = Math.max(3, maxY - minY);

                const zType = d.zoneType || 'demand';
                let fillColor = 'rgba(16, 185, 129, 0.16)';
                let strokeColor = '#10b981';
                let defaultLabel = 'Demand Zone';

                if (zType === 'supply') {
                    fillColor = 'rgba(239, 68, 68, 0.16)';
                    strokeColor = '#ef4444';
                    defaultLabel = 'Supply Zone';
                } else if (zType === 'neutral') {
                    fillColor = 'rgba(59, 130, 246, 0.16)';
                    strokeColor = '#3b82f6';
                    defaultLabel = 'Order Block';
                }

                if (isSelected) {
                    strokeColor = '#a855f7';
                    fillColor = 'rgba(168, 85, 247, 0.2)';
                }

                ctx.fillStyle = fillColor;
                ctx.fillRect(minX, minY, w, h);

                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = isSelected ? 2 : 1.5;
                if (isPreview) ctx.setLineDash([4, 4]);
                ctx.strokeRect(minX, minY, w, h);

                ctx.setLineDash([]);
                ctx.fillStyle = strokeColor;
                const corners = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: minX, y: maxY }, { x: maxX, y: maxY }];
                corners.forEach(c => {
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                });

                // Zone Label Badge (ป้ายชื่อโซน)
                const zoneLabel = d.label || defaultLabel;
                if (zoneLabel) {
                    ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, sans-serif';
                    const lm = ctx.measureText(zoneLabel);
                    const tagW = lm.width + 10;
                    const tagH = 16;
                    const tagX = minX + 6;
                    const tagY = minY + 5;

                    ctx.fillStyle = isSelected ? 'rgba(168, 85, 247, 0.9)' : strokeColor;
                    this.drawSafeRoundedRect(ctx, tagX, tagY, tagW, tagH, 3);
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(zoneLabel, tagX + 5, tagY + tagH / 2);
                }
            }

            // 5.1 Long & Short Position (Risk/Reward Ratio Calculator)
            else if ((d.type === 'long_position' || d.type === 'short_position') && d.points.length >= 3) {
                const isLong = (d.type === 'long_position');
                const p0 = toScreen(d.points[0]); // Entry
                const p1 = toScreen(d.points[1]); // Target
                const p2 = toScreen(d.points[2]); // Stop Loss

                const startX = Math.min(p0.x, p1.x);
                const endX = Math.max(p0.x, p1.x);
                const width = Math.max(30, endX - startX);

                const entryY = p0.y;
                const targetY = p1.y;
                const stopY = p2.y;

                const profTop = Math.min(entryY, targetY);
                const profH = Math.max(2, Math.abs(entryY - targetY));

                const lossTop = Math.min(entryY, stopY);
                const lossH = Math.max(2, Math.abs(entryY - stopY));

                // 1. Profit Box (เขียวโปร่งใส)
                ctx.fillStyle = isSelected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.16)';
                ctx.fillRect(startX, profTop, width, profH);
                ctx.strokeStyle = isSelected ? '#a855f7' : '#10b981';
                ctx.lineWidth = isSelected ? 2 : 1.5;
                ctx.strokeRect(startX, profTop, width, profH);

                // 2. Loss Box (แดงโปร่งใส)
                ctx.fillStyle = isSelected ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.16)';
                ctx.fillRect(startX, lossTop, width, lossH);
                ctx.strokeStyle = isSelected ? '#a855f7' : '#ef4444';
                ctx.lineWidth = isSelected ? 2 : 1.5;
                ctx.strokeRect(startX, lossTop, width, lossH);

                // 3. เส้นระดับ Entry
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(startX, entryY);
                ctx.lineTo(startX + width, entryY);
                ctx.stroke();

                // Vertex Anchors
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.arc(startX, entryY, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#10b981';
                ctx.beginPath();
                ctx.arc(startX + width, targetY, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(startX + width, stopY, 4, 0, Math.PI * 2);
                ctx.fill();

                // 4. คำนวณ Stats (R:R, Pips, Lot Size)
                const stats = this.calculatePositionStats(d, cell.symbol);
                const targetPrice = d.points[1].price;
                const stopPrice = d.points[2].price;

                // 5. HUD Card ตรงกลางแสดง R:R Ratio, Lot Size, และ Points
                const hudW = Math.min(Math.max(width - 8, 140), 220);
                const hudH = 58;
                let hudX = startX + (width - hudW) / 2;
                let hudY = entryY - hudH / 2;

                if (hudX < 10) hudX = 10;
                if (hudX + hudW > canvasW - 10) hudX = canvasW - hudW - 10;
                if (hudY < 10) hudY = 10;
                if (hudY + hudH > canvasH - 10) hudY = canvasH - hudH - 10;

                ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
                ctx.strokeStyle = isSelected ? '#a855f7' : (isLong ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)');
                ctx.lineWidth = 1.2;
                this.drawSafeRoundedRect(ctx, hudX, hudY, hudW, hudH, 6);
                ctx.fill();
                ctx.stroke();

                // HUD Line 1: Type & R:R Ratio
                ctx.font = 'bold 11px sans-serif';
                ctx.fillStyle = isLong ? '#10b981' : '#ef4444';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${isLong ? '▲ LONG' : '▼ SHORT'} | R:R 1 : ${stats.rr}`, hudX + 8, hudY + 14);

                // HUD Line 2: Target & Stop Points
                ctx.font = '10px monospace';
                ctx.fillStyle = '#e2e8f0';
                ctx.fillText(`TP: +${stats.rewardPts} pts  SL: -${stats.stopPts} pts`, hudX + 8, hudY + 30);

                // HUD Line 3: Risk Dollar & Recommended Lot Size
                ctx.font = 'bold 10px monospace';
                ctx.fillStyle = '#38bdf8';
                ctx.fillText(`เสี่ยง: $${d.riskAmount || 100} -> แนะนำ: ${stats.lotSize} Lot`, hudX + 8, hudY + 45);

                // ป้ายราคาริมขวากล่อง
                const priceBadgeW = 68;
                const priceBadgeH = 16;
                // Target Price Tag
                ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
                this.drawSafeRoundedRect(ctx, startX + width - priceBadgeW, targetY - priceBadgeH / 2, priceBadgeW, priceBadgeH, 3);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`$${targetPrice.toFixed(decimals)}`, startX + width - priceBadgeW / 2, targetY);

                // Stop Price Tag
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
                this.drawSafeRoundedRect(ctx, startX + width - priceBadgeW, stopY - priceBadgeH / 2, priceBadgeW, priceBadgeH, 3);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`$${stopPrice.toFixed(decimals)}`, startX + width - priceBadgeW / 2, stopY);
            }

            // 6. เส้นทาง (Path / Polyline Arrow)
            else if (d.type === 'path') {
                const screenPoints = d.points.map(pt => toScreen(pt));
                if (d.previewPoint) {
                    screenPoints.push(toScreen(d.previewPoint));
                }
                if (screenPoints.length >= 2) {
                    ctx.strokeStyle = isSelected ? '#a855f7' : color;
                    ctx.lineWidth = isSelected ? 2.5 : 2;
                    if (isPreview) ctx.setLineDash([4, 3]);

                    ctx.beginPath();
                    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
                    for (let i = 1; i < screenPoints.length; i++) {
                        ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
                    }
                    ctx.stroke();

                    // Arrow Head at final endpoint
                    ctx.setLineDash([]);
                    const lastP = screenPoints[screenPoints.length - 1];
                    const prevP = screenPoints[screenPoints.length - 2];
                    const angle = Math.atan2(lastP.y - prevP.y, lastP.x - prevP.x);
                    const headLen = 12;

                    ctx.fillStyle = isSelected ? '#a855f7' : color;
                    ctx.beginPath();
                    ctx.moveTo(lastP.x, lastP.y);
                    ctx.lineTo(lastP.x - headLen * Math.cos(angle - Math.PI / 7), lastP.y - headLen * Math.sin(angle - Math.PI / 7));
                    ctx.lineTo(lastP.x - headLen * Math.cos(angle + Math.PI / 7), lastP.y - headLen * Math.sin(angle + Math.PI / 7));
                    ctx.closePath();
                    ctx.fill();

                    // Vertex dots
                    ctx.fillStyle = isSelected ? '#c084fc' : color;
                    screenPoints.forEach(p => {
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
                        ctx.fill();
                    });
                }
            }

            // 7. ข้อความ (Text Annotation)
            else if (d.type === 'text') {
                const pt = d.points[0];
                const p = toScreen(pt);
                const fontSize = d.fontSize || 14;
                const textStr = d.text || 'Note';
                const isLight = (this.theme === 'light');

                ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
                const metrics = ctx.measureText(textStr);
                const boxW = Math.max(metrics.width + 18, 50);
                const boxH = fontSize + 14;
                const boxX = p.x + 8;
                const boxY = p.y - boxH - 6;

                // Connecting line
                const strokeCol = isSelected ? '#a855f7' : (isLight ? (d.color === '#38bdf8' ? '#0284c7' : (d.color || '#0284c7')) : (d.color || '#38bdf8'));
                ctx.strokeStyle = strokeCol;
                ctx.lineWidth = isSelected ? 2 : 1.4;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(boxX, boxY + boxH / 2);
                ctx.stroke();

                // Anchor dot
                ctx.fillStyle = strokeCol;
                ctx.beginPath();
                ctx.arc(p.x, p.y, isSelected ? 5 : 4, 0, Math.PI * 2);
                ctx.fill();

                // Background box (crisp solid background)
                ctx.fillStyle = isLight ? '#ffffff' : '#111827';
                ctx.strokeStyle = isSelected ? '#a855f7' : (isLight ? '#94a3b8' : strokeCol);
                ctx.lineWidth = isSelected ? 2 : 1.2;
                this.drawSafeRoundedRect(ctx, boxX, boxY, boxW, boxH, 6);
                ctx.fill();
                ctx.stroke();

                // Selection highlight ring
                if (isSelected) {
                    ctx.save();
                    ctx.strokeStyle = '#a855f7';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 3]);
                    this.drawSafeRoundedRect(ctx, boxX - 4, boxY - 4, boxW + 8, boxH + 8, 8);
                    ctx.stroke();
                    ctx.restore();
                }

                // Text string
                ctx.fillStyle = isSelected ? (isLight ? '#6b21a8' : '#e9d5ff') : (isLight ? '#0f172a' : (d.color || '#38bdf8'));
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(textStr, boxX + 9, boxY + boxH / 2);
            }

            // 8. ปุ่ม [✕] สำหรับลบภาพวาดอิสระเมื่อเครื่องมือนั้น Active อยู่ หรือกล่อง Position
            const shouldShowDeleteBtn = (isSelected && !isPreview) || (!isPreview && (d.type === 'long_position' || d.type === 'short_position'));
            if (shouldShowDeleteBtn) {
                const btn = this.getDrawingDeleteBtnPos(d, cell, toScreen, canvasW, canvasH);
                if (btn) {
                    ctx.save();
                    // เงาปุ่ม
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
                    ctx.shadowBlur = 4;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 1.5;

                    // วงกลมสีแดงสด
                    ctx.fillStyle = '#ef4444';
                    ctx.beginPath();
                    ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
                    ctx.fill();

                    // เส้นขอบขาว
                    ctx.shadowColor = 'transparent';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.6;
                    ctx.stroke();

                    // กากบาทสีขาว ✕
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.8;
                    ctx.lineCap = 'round';
                    const sz = 3.5;
                    ctx.beginPath();
                    ctx.moveTo(btn.x - sz, btn.y - sz);
                    ctx.lineTo(btn.x + sz, btn.y + sz);
                    ctx.moveTo(btn.x + sz, btn.y - sz);
                    ctx.lineTo(btn.x - sz, btn.y + sz);
                    ctx.stroke();

                    ctx.restore();
                }
            }

            ctx.restore();
        });
    }

    /**
     * แสดง Toast แจ้งเตือนสั้นๆ สไตล์ Modern Minimalist
     */
    showToast(msg) {
        let toast = document.getElementById('chart-toast-msg');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'chart-toast-msg';
            toast.className = 'toast-msg';
            document.body.appendChild(toast);
        }

        toast.innerText = msg;
        toast.classList.add('visible');

        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('visible');
        }, 1800);
    }
}

window.ChartEngine = ChartEngine;
if (typeof chartEngine !== 'undefined' && !window.chartEngine) {
    window.chartEngine = chartEngine;
}
