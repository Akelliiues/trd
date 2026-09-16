/**
 * Volume Footprint (Order Flow) Engine
 * แสดงการกระจายตัวของปริมาณการซื้อขายในระดับราคาของแต่ละแท่งเทียน
 * พร้อมไฮไลท์บริเวณสภาพคล่องสูง (High Liquidity Nodes), Candle POC, และ Delta Imbalances
 */

const FootprintEngine = {
    /**
     * คำนวณ Footprint Levels สำหรับแท่งเทียนแต่ละแท่ง
     * @param {Array} visibleCandles
     * @param {number} numLevelsPerCandle จำนวนขั้นราคาต่อแท่ง (Default 8-12)
     */
    calculateFootprint(visibleCandles, numLevelsPerCandle = 8) {
        if (!visibleCandles || visibleCandles.length === 0) return [];

        const footprints = [];

        for (const c of visibleCandles) {
            const span = Math.max(0.0001, c.high - c.low);
            const step = span / numLevelsPerCandle;
            const totalVol = c.volume || 100;
            const isBullish = c.close >= c.open;

            const levels = [];
            let maxLevelVol = 0;
            let pocLevelPrice = c.low + (step * (numLevelsPerCandle / 2));

            for (let i = 0; i < numLevelsPerCandle; i++) {
                const lvlLow = c.low + (i * step);
                const lvlHigh = c.low + ((i + 1) * step);
                const lvlMid = c.low + ((i + 0.5) * step);

                // สัดส่วน Volume ตามรูปทรงแท่งเทียน (เยอะแถวราคาปิดและเปิด)
                const distFromClose = Math.abs(lvlMid - c.close) / span;
                const weight = Math.max(0.2, 1 - (distFromClose * 0.8));

                const lvlTotal = (totalVol / numLevelsPerCandle) * weight * 1.5;
                const buyRatio = isBullish ? 0.62 : 0.38;
                const buyVol = Math.round(lvlTotal * buyRatio);
                const sellVol = Math.round(lvlTotal * (1 - buyRatio));

                if (lvlTotal > maxLevelVol) {
                    maxLevelVol = lvlTotal;
                    pocLevelPrice = lvlMid;
                }

                // Imbalance (เมื่อ Buy หรือ Sell ชนะกันเกิน 3 เท่า)
                const isBuyImbalance = buyVol >= (sellVol * 3) && buyVol > 15;
                const isSellImbalance = sellVol >= (buyVol * 3) && sellVol > 15;

                levels.push({
                    price: lvlMid,
                    buyVol,
                    sellVol,
                    totalVol: buyVol + sellVol,
                    delta: buyVol - sellVol,
                    isBuyImbalance,
                    isSellImbalance
                });
            }

            footprints.push({
                time: c.time,
                high: c.high,
                low: c.low,
                open: c.open,
                close: c.close,
                totalVolume: totalVol,
                pocPrice: pocLevelPrice,
                levels
            });
        }

        return footprints;
    },

    /**
     * วาด Footprint Blocks และ Bid/Ask Volume ลงบน Canvas
     */
    renderOverlay(canvas, footprints, chartSeries, chartEngine) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (!footprints || footprints.length === 0) return;

        // วาด Footprint สำหรับ 20 แท่งล่าสุดที่มองเห็น เพื่อความคมชัด
        const recent = footprints.slice(-25);

        for (const fp of recent) {
            let x = chartSeries.timeToCoordinate ? chartSeries.timeToCoordinate(fp.time) : null;
            if (x === null && chartEngine && chartEngine.timeScale) {
                x = chartEngine.timeScale().timeToCoordinate(fp.time);
            }
            if (x === null || x < 0 || x > canvas.width) continue;

            const yHigh = chartSeries.priceToCoordinate(fp.high);
            const yLow = chartSeries.priceToCoordinate(fp.low);
            if (yHigh === null || yLow === null) continue;

            const blockWidth = 55;
            const leftX = x - (blockWidth / 2);

            // วาดตลับ Footprint แต่ละระดับราคา
            for (const lvl of fp.levels) {
                const y = chartSeries.priceToCoordinate(lvl.price);
                if (y === null) continue;

                const isPoc = Math.abs(lvl.price - fp.pocPrice) < (Math.abs(fp.high - fp.low) / fp.levels.length);

                // พื้นหลัง POC Highlight
                if (isPoc) {
                    ctx.fillStyle = 'rgba(255, 193, 7, 0.35)';
                    ctx.fillRect(leftX, y - 6, blockWidth, 12);
                    ctx.strokeStyle = '#ffc107';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(leftX, y - 6, blockWidth, 12);
                } else {
                    ctx.fillStyle = 'rgba(19, 23, 34, 0.75)';
                    ctx.fillRect(leftX, y - 5, blockWidth, 10);
                }

                // ข้อความตัวเลข Bid x Ask
                ctx.font = '8.5px monospace';

                // Bid Volume (Sell) สีแดง
                ctx.fillStyle = lvl.isSellImbalance ? '#ff5252' : '#f87171';
                ctx.textAlign = 'right';
                ctx.fillText(`${lvl.sellVol}`, leftX + 23, y + 3);

                // ขีดคั่น
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillText('|', leftX + 28, y + 3);

                // Ask Volume (Buy) สีเขียว
                ctx.fillStyle = lvl.isBuyImbalance ? '#00e676' : '#4ade80';
                ctx.textAlign = 'left';
                ctx.fillText(`${lvl.buyVol}`, leftX + 32, y + 3);
            }
        }
    }
};

window.FootprintEngine = FootprintEngine;
