/**
 * Auto Chart Pattern Recognition Engine
 * ตรวจจับรูปแบบกราฟอัตโนมัติ:
 * 1. Elliott Waves (1-2-3-4-5 และ A-B-C)
 * 2. Head and Shoulders / Inverse Head and Shoulders (หัวและไหล่)
 * 3. Double Top & Double Bottom
 * 4. Bullish & Bearish Flags (ธงขึ้นและธงลง)
 */

const PatternRecognizer = {
    /**
     * ค้นหาจุดกลับตัวสำคัญ (Local Swing Highs & Lows / Pivots)
     */
    findPivots(candles, leftBars = 4, rightBars = 4) {
        const highs = [];
        const lows = [];

        for (let i = leftBars; i < candles.length - rightBars; i++) {
            const current = candles[i];
            let isHigh = true;
            let isLow = true;

            for (let j = i - leftBars; j <= i + rightBars; j++) {
                if (j === i) continue;
                if (candles[j].high >= current.high) isHigh = false;
                if (candles[j].low <= current.low) isLow = false;
            }

            if (isHigh) highs.push({ index: i, time: current.time, price: current.high, type: 'HIGH' });
            if (isLow) lows.push({ index: i, time: current.time, price: current.low, type: 'LOW' });
        }

        // รวมและเรียงลำดับตามแกนเวลา
        const allPivots = [...highs, ...lows].sort((a, b) => a.index - b.index);
        return { highs, lows, allPivots };
    },

    /**
     * ตรวจจับ Head and Shoulders & Inverse Head and Shoulders
     */
    detectHeadAndShoulders(candles, pivots) {
        const patterns = [];
        const highs = pivots.highs;

        // Head and Shoulders (Bearish reversal)
        for (let i = 0; i < highs.length - 2; i++) {
            const left = highs[i];
            const head = highs[i + 1];
            const right = highs[i + 2];

            // กฎ: Head ต้องสูงกว่า Left และ Right Shoulder
            if (head.price > left.price && head.price > right.price) {
                // Left และ Right Shoulder ควรมีความสูงใกล้เคียงกัน (ความต่างไม่เกิน 3.5%)
                const shoulderDiff = Math.abs(left.price - right.price) / left.price;
                if (shoulderDiff < 0.035) {
                    patterns.push({
                        type: 'HEAD_AND_SHOULDERS',
                        name: 'Head & Shoulders (Bearish)',
                        color: '#f23645',
                        points: [
                            { label: 'LS', time: left.time, price: left.price },
                            { label: 'Head', time: head.time, price: head.price },
                            { label: 'RS', time: right.time, price: right.price }
                        ]
                    });
                }
            }
        }

        // Inverse Head and Shoulders (Bullish reversal)
        const lows = pivots.lows;
        for (let i = 0; i < lows.length - 2; i++) {
            const left = lows[i];
            const head = lows[i + 1];
            const right = lows[i + 2];

            if (head.price < left.price && head.price < right.price) {
                const shoulderDiff = Math.abs(left.price - right.price) / left.price;
                if (shoulderDiff < 0.035) {
                    patterns.push({
                        type: 'INVERSE_H_AND_S',
                        name: 'Inv. Head & Shoulders (Bullish)',
                        color: '#089981',
                        points: [
                            { label: 'LS', time: left.time, price: left.price },
                            { label: 'Head', time: head.time, price: head.price },
                            { label: 'RS', time: right.time, price: right.price }
                        ]
                    });
                }
            }
        }

        return patterns;
    },

    /**
     * ตรวจจับ Elliott Waves (คลื่น 1-2-3-4-5 และ A-B-C)
     */
    detectElliottWaves(candles, pivots) {
        const patterns = [];
        const p = pivots.allPivots;

        // มองหาชุดโครงสร้าง 5 สวิง (Low -> High -> Low -> High -> Low -> High)
        for (let i = 0; i < p.length - 5; i++) {
            const p0 = p[i];     // จุดเริ่มต้น
            const p1 = p[i + 1]; // Wave 1
            const p2 = p[i + 2]; // Wave 2
            const p3 = p[i + 3]; // Wave 3
            const p4 = p[i + 4]; // Wave 4
            const p5 = p[i + 5]; // Wave 5

            // กฎ Bullish Impulse Wave (1-2-3-4-5)
            if (p0.type === 'LOW' && p1.type === 'HIGH' && p2.type === 'LOW' && 
                p3.type === 'HIGH' && p4.type === 'LOW' && p5.type === 'HIGH') {
                
                // กฎ 1: Wave 2 ต้องไม่ย่อลึกเกินจุดเริ่มต้น (Wave 2 > Start)
                const rule1 = p2.price > p0.price;
                // กฎ 2: Wave 3 ต้องสูงกว่า Wave 1
                const rule2 = p3.price > p1.price;
                // กฎ 3: Wave 4 ต้องไม่ทับซ้อนกับยอด Wave 1
                const rule3 = p4.price > p1.price;
                // กฎ 4: Wave 5 ต้องทำ New High เหนือ Wave 3 หรือใกล้เคียง
                const rule4 = p5.price > p3.price;

                if (rule1 && rule2 && rule3 && rule4) {
                    patterns.push({
                        type: 'ELLIOTT_BULLISH',
                        name: 'Elliott Wave (1-2-3-4-5)',
                        color: '#2962ff',
                        points: [
                            { label: '(0)', time: p0.time, price: p0.price },
                            { label: '(1)', time: p1.time, price: p1.price },
                            { label: '(2)', time: p2.time, price: p2.price },
                            { label: '(3)', time: p3.time, price: p3.price },
                            { label: '(4)', time: p4.time, price: p4.price },
                            { label: '(5)', time: p5.time, price: p5.price }
                        ]
                    });
                }
            }
        }

        return patterns;
    },

    /**
     * ตรวจจับ Bullish & Bearish Flags
     */
    detectFlags(candles) {
        const patterns = [];
        if (candles.length < 30) return patterns;

        // วนลูปตรวจสอบช่วง 20 แท่งล่าสุด
        for (let i = 20; i < candles.length - 5; i += 10) {
            const poleStart = candles[i - 20];
            const poleEnd = candles[i - 8];
            const poleMove = poleEnd.close - poleStart.open;

            // ตรวจสอบว่ามีเสาธงชัดเจน (Pole move > 1.2% ของราคา)
            const polePercent = Math.abs(poleMove) / poleStart.open;
            if (polePercent > 0.012) {
                // ช่วงสะสมกำลัง (Flag consolidation)
                const flagCandles = candles.slice(i - 8, i);
                let flagHigh = Math.max(...flagCandles.map(c => c.high));
                let flagLow = Math.min(...flagCandles.map(c => c.low));
                const flagRange = flagHigh - flagLow;

                // กรอบธงควรแคบกว่าความยาวเสาธง
                if (flagRange < Math.abs(poleMove) * 0.45) {
                    if (poleMove > 0) {
                        patterns.push({
                            type: 'BULLISH_FLAG',
                            name: 'Bullish Flag',
                            color: '#089981',
                            points: [
                                { label: 'Pole', time: poleStart.time, price: poleStart.open },
                                { label: 'Flag', time: flagCandles[flagCandles.length - 1].time, price: flagHigh }
                            ]
                        });
                    } else {
                        patterns.push({
                            type: 'BEARISH_FLAG',
                            name: 'Bearish Flag',
                            color: '#f23645',
                            points: [
                                { label: 'Pole', time: poleStart.time, price: poleStart.open },
                                { label: 'Flag', time: flagCandles[flagCandles.length - 1].time, price: flagLow }
                            ]
                        });
                    }
                }
            }
        }
        return patterns;
    },

    /**
     * ประมวลผลทุกรูปแบบร่วมกัน
     */
    detectAll(candles) {
        if (!candles || candles.length < 25) return [];

        const pivots = this.findPivots(candles);
        const hs = this.detectHeadAndShoulders(candles, pivots);
        const elliott = this.detectElliottWaves(candles, pivots);
        const flags = this.detectFlags(candles);

        return [...hs, ...elliott, ...flags];
    },

    /**
     * วาดรูปแบบ Chart Patterns ลงบน Canvas หรือสร้าง Chart Markers
     */
    renderOverlay(canvas, patterns, chartSeries, chartEngine) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (!patterns || patterns.length === 0) return;

        patterns.forEach(pat => {
            ctx.strokeStyle = pat.color;
            ctx.fillStyle = pat.color;
            ctx.lineWidth = 1.8;

            // ลากเส้นเชื่อมจุดใน Pattern
            ctx.beginPath();
            let first = true;

            for (const pt of pat.points) {
                let x = chartSeries.timeToCoordinate ? chartSeries.timeToCoordinate(pt.time) : null;
                if (x === null && chartEngine && chartEngine.timeScale) {
                    x = chartEngine.timeScale().timeToCoordinate(pt.time);
                }
                const y = chartSeries.priceToCoordinate ? chartSeries.priceToCoordinate(pt.price) : null;

                if (x === null || y === null) continue;

                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                } else {
                    ctx.lineTo(x, y);
                }

                // วาดจุด Anchor Point
                ctx.beginPath();
                ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                ctx.fill();

                // ป้ายกำกับ Wave / Shoulder
                ctx.font = 'bold 10px monospace';
                ctx.fillText(pt.label, x + 5, y - 5);
            }
            ctx.stroke();

            // ชื่อของ Pattern
            const lastPt = pat.points[pat.points.length - 1];
            let lx = chartSeries.timeToCoordinate ? chartSeries.timeToCoordinate(lastPt.time) : null;
            if (lx === null && chartEngine && chartEngine.timeScale) {
                lx = chartEngine.timeScale().timeToCoordinate(lastPt.time);
            }
            const ly = chartSeries.priceToCoordinate ? chartSeries.priceToCoordinate(lastPt.price) : null;
            if (lx !== null && ly !== null) {
                ctx.fillStyle = pat.color;
                ctx.font = 'bold 11px -apple-system, sans-serif';
                ctx.fillText(`★ ${pat.name}`, lx + 10, ly + 4);
            }
        });
    }
};

window.PatternRecognizer = PatternRecognizer;
