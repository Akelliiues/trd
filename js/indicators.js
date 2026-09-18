/**
 * Technical Indicators & "Indicator on Indicator" Engine
 * รองรับการคำนวณอินดิเคเตอร์ทั่วไป และการนำผลลัพธ์ของอินดิเคเตอร์ตัวหนึ่ง
 * ไปเป็นอินพุตให้กับอีกอินดิเคเตอร์หนึ่ง (Indicator on Indicator)
 */

const Indicators = {
    /**
     * ดึงชุดข้อมูลตัวเลขตาม Source ที่เลือก (Close, Open, High, Low, หรือ Custom Array)
     */
    extractSource(candlesOrArray, sourceField = 'close') {
        if (!candlesOrArray || candlesOrArray.length === 0) return [];
        if (typeof candlesOrArray[0] === 'number') {
            return candlesOrArray; // เป็นตัวเลขอินพุตอยู่แล้ว (จาก Indicator อื่น)
        }
        if (candlesOrArray[0].value !== undefined) {
            return candlesOrArray.map(item => item.value);
        }
        return candlesOrArray.map(c => c[sourceField] !== undefined ? c[sourceField] : c.close);
    },

    /**
     * Simple Moving Average (SMA)
     * รองรับทั้งแท่งเทียนราคา และข้อมูลจาก Indicator อื่น (Indicator on Indicator)
     */
    calculateSMA(data, period = 14, sourceField = 'close') {
        const values = this.extractSource(data, sourceField);
        const result = [];
        let sum = 0;

        for (let i = 0; i < values.length; i++) {
            sum += values[i];
            if (i >= period) {
                sum -= values[i - period];
            }
            if (i >= period - 1) {
                const time = (data[i] && data[i].time) ? data[i].time : i;
                result.push({
                    time: time,
                    value: Number((sum / period).toFixed(4))
                });
            }
        }
        return result;
    },

    /**
     * Exponential Moving Average (EMA)
     */
    calculateEMA(data, period = 14, sourceField = 'close') {
        const values = this.extractSource(data, sourceField);
        const result = [];
        if (values.length < period) return result;

        const k = 2 / (period + 1);
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += values[i];
        }
        let prevEma = sum / period;
        result.push({
            time: (data[period - 1] && data[period - 1].time) ? data[period - 1].time : period - 1,
            value: Number(prevEma.toFixed(4))
        });

        for (let i = period; i < values.length; i++) {
            const currentEma = (values[i] * k) + (prevEma * (1 - k));
            const time = (data[i] && data[i].time) ? data[i].time : i;
            result.push({
                time: time,
                value: Number(currentEma.toFixed(4))
            });
            prevEma = currentEma;
        }
        return result;
    },

    /**
     * Relative Strength Index (RSI)
     */
    calculateRSI(candles, period = 14) {
        const values = this.extractSource(candles, 'close');
        const result = [];
        if (values.length <= period) return result;

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const diff = values[i] - values[i - 1];
            if (diff >= 0) gains += diff;
            else losses += Math.abs(diff);
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;
        let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        let rsi = 100 - (100 / (1 + rs));

        result.push({
            time: candles[period].time,
            value: Number(rsi.toFixed(2))
        });

        for (let i = period + 1; i < values.length; i++) {
            const diff = values[i] - values[i - 1];
            const currentGain = diff > 0 ? diff : 0;
            const currentLoss = diff < 0 ? Math.abs(diff) : 0;

            avgGain = (avgGain * (period - 1) + currentGain) / period;
            avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
            rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi = 100 - (100 / (1 + rs));

            result.push({
                time: candles[i].time,
                value: Number(rsi.toFixed(2))
            });
        }
        return result;
    },

    /**
     * Bollinger Bands
     * รองรับ Indicator on Indicator (เช่น ใส่ Bollinger Bands ครอบบนค่า RSI)
     */
    calculateBollingerBands(data, period = 20, multiplier = 2.0, sourceField = 'close') {
        const values = this.extractSource(data, sourceField);
        const upper = [];
        const middle = [];
        const lower = [];

        for (let i = period - 1; i < values.length; i++) {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
                sum += values[j];
            }
            const mean = sum / period;

            let sumSquaredDiff = 0;
            for (let j = i - period + 1; j <= i; j++) {
                sumSquaredDiff += Math.pow(values[j] - mean, 2);
            }
            const stdDev = Math.sqrt(sumSquaredDiff / period);
            const time = (data[i] && data[i].time) ? data[i].time : i;

            middle.push({ time, value: Number(mean.toFixed(4)) });
            upper.push({ time, value: Number((mean + (multiplier * stdDev)).toFixed(4)) });
            lower.push({ time, value: Number((mean - (multiplier * stdDev)).toFixed(4)) });
        }

        return { upper, middle, lower };
    },

    /**
     * Parabolic SAR (Stop and Reverse)
     * @param {Array} candles - Array of candle objects { time, open, high, low, close }
     * @param {number} step - Acceleration Factor Step (default: 0.02)
     * @param {number} max - Maximum Acceleration Factor (default: 0.20)
     * @returns {Array} Array of { time, value, isUp }
     */
    calculatePSAR(candles, step = 0.02, max = 0.20) {
        if (!candles || candles.length < 2) return [];

        const result = [];
        // ตรวจสอบความละเอียดทศนิยมของราคาเพื่อไม่ให้ปัดเศษทิ้ง (เช่น Forex 5 ตำแหน่ง หรือ Crypto)
        const sampleClose = candles[0].close ? String(candles[0].close) : '';
        const decLen = sampleClose.includes('.') ? sampleClose.split('.')[1].length : 4;
        const precision = Math.max(4, Math.min(8, decLen));

        let isUptrend = (candles[1].close >= candles[0].close);
        let ep = isUptrend ? Math.max(candles[0].high, candles[1].high) : Math.min(candles[0].low, candles[1].low);
        let sar = isUptrend ? candles[0].low : candles[0].high;
        let af = step;
        let justReversed = false;

        result.push({
            time: candles[0].time,
            value: Number(sar.toFixed(precision)),
            isUp: isUptrend
        });

        for (let i = 1; i < candles.length; i++) {
            const prevCandle = candles[i - 1];
            const currCandle = candles[i];

            // คำนวณ SAR ของแท่งปัจจุบันตามอัตราเร่ง AF
            sar = sar + af * (ep - sar);

            if (isUptrend) {
                // ในเทรนด์ขาขึ้น SAR ต้องไม่สูงกว่า Low ของแท่งก่อนหน้า (และ 2 แท่งก่อนหน้า ถ้าไม่ได้เพิ่งกลับตัว)
                if (justReversed) {
                    sar = Math.min(sar, prevCandle.low);
                    justReversed = false;
                } else {
                    const prevPrevCandle = i >= 2 ? candles[i - 2] : prevCandle;
                    sar = Math.min(sar, prevCandle.low, prevPrevCandle.low);
                }

                if (currCandle.low < sar) {
                    // กลับตัวเป็นเทรนด์ขาลงทันที (Reversal to Downtrend)
                    // จุด SAR ย้ายข้างขึ้นไปอยู่ด้านบนแท่งเทียนที่จุดสูงสุด EP เดิม
                    isUptrend = false;
                    sar = Math.max(ep, currCandle.high);
                    ep = currCandle.low;
                    af = step;
                    justReversed = true;
                } else {
                    // ต่อเนื่องในขาขึ้น: อัปเดตจุดสูงสุดใหม่และเร่งค่า AF
                    if (currCandle.high > ep) {
                        ep = currCandle.high;
                        af = Math.min(max, af + step);
                    }
                }
            } else {
                // ในเทรนด์ขาลง SAR ต้องไม่ต่ำกว่า High ของแท่งก่อนหน้า (และ 2 แท่งก่อนหน้า ถ้าไม่ได้เพิ่งกลับตัว)
                if (justReversed) {
                    sar = Math.max(sar, prevCandle.high);
                    justReversed = false;
                } else {
                    const prevPrevCandle = i >= 2 ? candles[i - 2] : prevCandle;
                    sar = Math.max(sar, prevCandle.high, prevPrevCandle.high);
                }

                if (currCandle.high > sar) {
                    // กลับตัวเป็นเทรนด์ขาขึ้นทันที (Reversal to Uptrend)
                    // จุด SAR ย้ายข้างลงมาอยู่ด้านล่างแท่งเทียนที่จุดต่ำสุด EP เดิม
                    isUptrend = true;
                    sar = Math.min(ep, currCandle.low);
                    ep = currCandle.high;
                    af = step;
                    justReversed = true;
                } else {
                    // ต่อเนื่องในขาลง: อัปเดตจุดต่ำสุดใหม่และเร่งค่า AF
                    if (currCandle.low < ep) {
                        ep = currCandle.low;
                        af = Math.min(max, af + step);
                    }
                }
            }

            result.push({
                time: currCandle.time,
                value: Number(sar.toFixed(precision)),
                isUp: isUptrend
            });
        }

        return result;
    },

    /**
     * Helper: สร้าง "Indicator on Indicator"
     * ตัวอย่าง:
     * - 'SMA on RSI'
     * - 'Bollinger Bands on RSI'
     * - 'EMA on MACD'
     */
    createIndicatorOnIndicator(parentIndicatorResult, targetType = 'SMA', options = { period: 9 }) {
        if (!parentIndicatorResult || parentIndicatorResult.length === 0) return [];

        if (targetType === 'SMA') {
            return this.calculateSMA(parentIndicatorResult, options.period || 9);
        } else if (targetType === 'EMA') {
            return this.calculateEMA(parentIndicatorResult, options.period || 9);
        } else if (targetType === 'BollingerBands') {
            return this.calculateBollingerBands(parentIndicatorResult, options.period || 14, options.multiplier || 2.0);
        }
        return [];
    }
};

window.Indicators = Indicators;
