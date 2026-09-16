/**
 * Resampler & Range Bar Engine
 * จัดการการรวมแท่งเทียนเป็น Timeframe ที่กำหนดเอง (Custom Timeframe)
 * และการคำนวณแท่งเทียนแบบ Range Bar (ระยะการเคลื่อนที่ของราคา)
 */

const Resampler = {
    /**
     * แปลงแท่งเทียน M1 (1 นาที) เป็น Custom Minute Timeframe (เช่น 3m, 7m, 45m, 120m)
     * @param {Array} m1Candles - Array of {time, open, high, low, close, volume}
     * @param {number} targetMinutes - จำนวนนาทีที่ต้องการรวม (เช่น 3, 7, 15, 60, 240)
     * @returns {Array} resampledCandles
     */
    resampleTimeframe(m1Candles, targetMinutes) {
        if (!m1Candles || m1Candles.length === 0) return [];
        if (targetMinutes <= 1) return [...m1Candles];

        const targetSeconds = targetMinutes * 60;
        const resampled = [];
        let currentBucket = null;

        for (let i = 0; i < m1Candles.length; i++) {
            const candle = m1Candles[i];
            // จัดกลุ่ม timestamp ตาม bucket boundary
            const bucketTime = Math.floor(candle.time / targetSeconds) * targetSeconds;

            if (!currentBucket || currentBucket.time !== bucketTime) {
                if (currentBucket) {
                    resampled.push(currentBucket);
                }
                currentBucket = {
                    time: bucketTime,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume || 0
                };
            } else {
                currentBucket.high = Math.max(currentBucket.high, candle.high);
                currentBucket.low = Math.min(currentBucket.low, candle.low);
                currentBucket.close = candle.close;
                currentBucket.volume += (candle.volume || 0);
            }
        }

        if (currentBucket) {
            resampled.push(currentBucket);
        }

        return resampled;
    },

    /**
     * คำนวณแท่งเทียนแบบ Range Bars ตามระยะความกว้างของราคา (Range Size)
     * แต่ละแท่งจะปิดตัวลงก็ต่อเมื่อ High - Low >= rangeSize
     * @param {Array} baseCandles - Array of {time, open, high, low, close, volume}
     * @param {number} rangeSize - ระยะราคาที่แท่งเทียนต้องแกว่งตัวเพื่อปิดแท่ง (เช่น 1.5 สำหรับทองคำ, 0.0015 สำหรับ EURUSD)
     * @returns {Array} rangeBars
     */
    calculateRangeBars(baseCandles, rangeSize) {
        if (!baseCandles || baseCandles.length === 0 || rangeSize <= 0) return baseCandles;

        const rangeBars = [];
        let currentBar = null;
        let barIndex = 0;

        for (let i = 0; i < baseCandles.length; i++) {
            const c = baseCandles[i];

            // จำลองการเคลื่อนที่ภายในแท่งจาก Open -> (High/Low) -> Close
            const subPrices = [c.open, (c.close >= c.open ? c.low : c.high), (c.close >= c.open ? c.high : c.low), c.close];

            for (const price of subPrices) {
                if (!currentBar) {
                    currentBar = {
                        time: c.time,
                        open: price,
                        high: price,
                        low: price,
                        close: price,
                        volume: 0
                    };
                    continue;
                }

                currentBar.high = Math.max(currentBar.high, price);
                currentBar.low = Math.min(currentBar.low, price);
                currentBar.close = price;

                // ตรวจสอบว่าขนาดแท่งถึง Range ที่กำหนดหรือยัง
                const currentSpread = currentBar.high - currentBar.low;
                if (currentSpread >= rangeSize) {
                    // ปิดแท่งนี้
                    currentBar.volume += (c.volume ? Math.round(c.volume / subPrices.length) : 100);
                    rangeBars.push(currentBar);

                    // สร้างแท่งถัดไป โดยเปิดที่ราคาปิดของแท่งก่อนหน้า
                    const nextTime = c.time + (++barIndex); // รับประกัน timestamp ไม่ซ้ำ
                    currentBar = {
                        time: nextTime,
                        open: price,
                        high: price,
                        low: price,
                        close: price,
                        volume: 0
                    };
                }
            }
        }

        if (currentBar && rangeBars.indexOf(currentBar) === -1) {
            rangeBars.push(currentBar);
        }

        return rangeBars;
    },

    /**
     * คำนวณแท่งเทียนอ้างอิงตามจำนวน Tick (Tick Bars) ไม่ใช่เวลาแบบคงที่
     * แต่ละแท่งจะปิดตัวลงก็ต่อเมื่อครบจำนวน Tick ที่กำหนด (เช่น 100, 250, 500 Ticks)
     * @param {Array} baseCandles - ข้อมูลแท่งเทียนฐาน
     * @param {number} ticksPerBar - จำนวน Tick ต่อหนึ่งแท่ง
     * @returns {Array} tickBars
     */
    calculateTickBars(baseCandles, ticksPerBar = 250) {
        if (!baseCandles || baseCandles.length === 0 || ticksPerBar <= 0) return baseCandles;

        const tickBars = [];
        let currentBar = null;
        let accumulatedTicks = 0;
        let barIndex = 0;

        for (let i = 0; i < baseCandles.length; i++) {
            const c = baseCandles[i];
            const candleTicks = c.volume || 100;

            if (!currentBar) {
                currentBar = {
                    time: c.time,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                    volume: 0
                };
            }

            currentBar.high = Math.max(currentBar.high, c.high);
            currentBar.low = Math.min(currentBar.low, c.low);
            currentBar.close = c.close;
            currentBar.volume += candleTicks;
            accumulatedTicks += candleTicks;

            if (accumulatedTicks >= ticksPerBar) {
                tickBars.push(currentBar);
                accumulatedTicks = 0;
                barIndex++;

                currentBar = {
                    time: c.time + barIndex,
                    open: c.close,
                    high: c.close,
                    low: c.close,
                    close: c.close,
                    volume: 0
                };
            }
        }

        if (currentBar && currentBar.volume > 0) {
            tickBars.push(currentBar);
        }

        return tickBars;
    }
};

window.Resampler = Resampler;
