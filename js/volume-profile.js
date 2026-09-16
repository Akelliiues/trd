/**
 * Volume Profile (VPVR) Engine
 * คำนวณการกระจายตัวของปริมาณการซื้อขายในแต่ละระดับราคา (Price Levels)
 * พร้อมแสดง POC (Point of Control), VAH (Value Area High), VAL (Value Area Low)
 */

const VolumeProfile = {
    /**
     * คำนวณ Volume Profile จากชุดแท่งเทียนที่ส่งเข้ามา
     * @param {Array} candles - แท่งเทียนที่ต้องการคำนวณ
     * @param {number} numBins - จำนวนชั้นระดับราคา (Default 60)
     * @param {number} valueAreaPercent - สัดส่วน Value Area (Default 70%)
     */
    compute(candles, numBins = 60, valueAreaPercent = 0.70) {
        if (!candles || candles.length === 0) return null;

        let highest = -Infinity;
        let lowest = Infinity;
        let totalVolume = 0;

        for (let i = 0; i < candles.length; i++) {
            const c = candles[i];
            if (c.high > highest) highest = c.high;
            if (c.low < lowest) lowest = c.low;
            totalVolume += (c.volume || 100);
        }

        if (highest <= lowest) return null;

        const priceRange = highest - lowest;
        const binSize = priceRange / numBins;

        const bins = [];
        for (let i = 0; i < numBins; i++) {
            bins.push({
                priceLow: lowest + (i * binSize),
                priceHigh: lowest + ((i + 1) * binSize),
                priceMid: lowest + ((i + 0.5) * binSize),
                buyVolume: 0,
                sellVolume: 0,
                totalVolume: 0
            });
        }

        // กระจาย Volume ของแต่ละแท่งลงใน Bins
        for (let i = 0; i < candles.length; i++) {
            const c = candles[i];
            const candleVol = c.volume || 100;
            const isBullish = c.close >= c.open;

            // สัดส่วน Buy/Sell volume โดยประมาณ
            const buyVol = isBullish ? candleVol * 0.65 : candleVol * 0.35;
            const sellVol = candleVol - buyVol;

            // กระจายตามช่วง High-Low ของแท่งเทียน
            const cLow = c.low;
            const cHigh = c.high;
            const span = Math.max(0.00001, cHigh - cLow);

            for (let b = 0; b < numBins; b++) {
                const bin = bins[b];
                // เช็คการทับซ้อนระหว่างแท่งเทียนกับ Bin
                const overlapLow = Math.max(cLow, bin.priceLow);
                const overlapHigh = Math.min(cHigh, bin.priceHigh);

                if (overlapHigh > overlapLow) {
                    const overlapRatio = (overlapHigh - overlapLow) / span;
                    bin.buyVolume += buyVol * overlapRatio;
                    bin.sellVolume += sellVol * overlapRatio;
                    bin.totalVolume += candleVol * overlapRatio;
                }
            }
        }

        // หา POC (Point of Control)
        let maxBinVolume = 0;
        let pocIndex = 0;
        for (let i = 0; i < numBins; i++) {
            if (bins[i].totalVolume > maxBinVolume) {
                maxBinVolume = bins[i].totalVolume;
                pocIndex = i;
            }
        }

        const poc = bins[pocIndex];

        // คำนวณ Value Area (70% Volume จากจุด POC ขยายขึ้นและลง)
        const targetVAVolume = totalVolume * valueAreaPercent;
        let currentVAVolume = poc.totalVolume;
        let upIdx = pocIndex + 1;
        let downIdx = pocIndex - 1;

        while (currentVAVolume < targetVAVolume && (upIdx < numBins || downIdx >= 0)) {
            const upVol = (upIdx < numBins) ? bins[upIdx].totalVolume : 0;
            const downVol = (downIdx >= 0) ? bins[downIdx].totalVolume : 0;

            if (upVol >= downVol && upIdx < numBins) {
                currentVAVolume += upVol;
                upIdx++;
            } else if (downIdx >= 0) {
                currentVAVolume += downVol;
                downIdx--;
            } else if (upIdx < numBins) {
                currentVAVolume += upVol;
                upIdx++;
            } else {
                break;
            }
        }

        const valBin = bins[Math.max(0, downIdx + 1)];
        const vahBin = bins[Math.min(numBins - 1, upIdx - 1)];

        return {
            bins,
            maxBinVolume,
            highest,
            lowest,
            poc: poc.priceMid,
            vah: vahBin.priceHigh,
            val: valBin.priceLow
        };
    },

    /**
     * วาด Volume Profile Overlay ลงบน Canvas
     */
    renderOverlay(canvas, profile, chartSeries) {
        if (!canvas || !profile) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        const maxVol = profile.maxBinVolume || 1;
        const maxBarWidth = Math.min(180, width * 0.28); // ความกว้างสูงสุดของฮิสโตแกรม
        const rightMargin = width - 5;

        // วาดแต่ละ Bin แนวนอน
        for (const bin of profile.bins) {
            const yTop = chartSeries.priceToCoordinate(bin.priceHigh);
            const yBottom = chartSeries.priceToCoordinate(bin.priceLow);
            if (yTop === null || yBottom === null) continue;

            const barHeight = Math.max(1.5, Math.abs(yBottom - yTop) - 0.5);
            const y = Math.min(yTop, yBottom);

            const totalWidth = (bin.totalVolume / maxVol) * maxBarWidth;
            const buyWidth = (bin.buyVolume / maxVol) * maxBarWidth;
            const sellWidth = totalWidth - buyWidth;

            const isValueArea = (bin.priceMid >= profile.val && bin.priceMid <= profile.vah);

            // Buy volume bar (Green/Teal)
            ctx.fillStyle = isValueArea ? 'rgba(38, 166, 154, 0.65)' : 'rgba(38, 166, 154, 0.30)';
            ctx.fillRect(rightMargin - totalWidth, y, buyWidth, barHeight);

            // Sell volume bar (Red/Orange)
            ctx.fillStyle = isValueArea ? 'rgba(239, 83, 80, 0.65)' : 'rgba(239, 83, 80, 0.30)';
            ctx.fillRect(rightMargin - totalWidth + buyWidth, y, sellWidth, barHeight);
        }

        // วาดเส้น POC (Point of Control) สีแดงเด่น
        const pocY = chartSeries.priceToCoordinate(profile.poc);
        if (pocY !== null) {
            ctx.strokeStyle = '#ef5350';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(rightMargin - maxBarWidth - 25, pocY);
            ctx.lineTo(rightMargin, pocY);
            ctx.stroke();

            // POC Label
            ctx.fillStyle = '#ef5350';
            ctx.font = '10px monospace';
            ctx.fillText(`POC ${profile.poc.toFixed(2)}`, rightMargin - maxBarWidth - 85, pocY + 3);
        }

        // วาดเส้น VAH และ VAL สีฟ้า
        const vahY = chartSeries.priceToCoordinate(profile.vah);
        if (vahY !== null) {
            ctx.strokeStyle = 'rgba(41, 98, 255, 0.8)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(rightMargin - maxBarWidth, vahY);
            ctx.lineTo(rightMargin, vahY);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        const valY = chartSeries.priceToCoordinate(profile.val);
        if (valY !== null) {
            ctx.strokeStyle = 'rgba(41, 98, 255, 0.8)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(rightMargin - maxBarWidth, valY);
            ctx.lineTo(rightMargin, valY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
};

window.VolumeProfile = VolumeProfile;
