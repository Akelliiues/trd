/**
 * Trade Journal & Analytics Module (TradingTools Pro)
 * ปฏิทินบันทึกผลการเทรด, สถิติ Win Rate/PnL/Drawdown, อารมณ์การเทรด, และ AI Coach
 */

class TradeJournal {
    constructor() {
        this.trades = [];
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.loadTrades();
    }

    loadTrades() {
        try {
            const saved = localStorage.getItem('tradingtools_journal');
            if (saved) {
                this.trades = JSON.parse(saved);
            } else {
                // ข้อมูลตัวอย่างเริ่มต้นเพื่อให้เห็นสถิติและปฏิทินทันที
                this.trades = this.getMockTrades();
                this.saveTrades();
            }
        } catch (e) {
            this.trades = this.getMockTrades();
        }
    }

    saveTrades() {
        try {
            localStorage.setItem('tradingtools_journal', JSON.stringify(this.trades));
        } catch (e) {}
    }

    getMockTrades() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        return [
            { id: 'T1', date: new Date(year, month, 2).toISOString(), symbol: 'XAUUSD', type: 'BUY', lot: 0.5, pnl: 450.0, rr: 2.1, emotion: 'disciplined', notes: 'Breakout pullback H1 confirmed' },
            { id: 'T2', date: new Date(year, month, 3).toISOString(), symbol: 'BTCUSDT', type: 'BUY', lot: 0.2, pnl: 280.0, rr: 1.8, emotion: 'calm', notes: 'Support bounce' },
            { id: 'T3', date: new Date(year, month, 5).toISOString(), symbol: 'EURUSD', type: 'SELL', lot: 1.0, pnl: -150.0, rr: -1.0, emotion: 'fomo', notes: 'Entered too late before London close' },
            { id: 'T4', date: new Date(year, month, 8).toISOString(), symbol: 'XAUUSD', type: 'SELL', lot: 0.5, pnl: 620.0, rr: 3.1, emotion: 'confident', notes: 'Clean rejection from 2690 resistance' },
            { id: 'T5', date: new Date(year, month, 9).toISOString(), symbol: 'BTCUSDT', type: 'BUY', lot: 0.3, pnl: -190.0, rr: -1.0, emotion: 'revenge', notes: 'Overtraded on weekend' },
            { id: 'T6', date: new Date(year, month, 12).toISOString(), symbol: 'XAUUSD', type: 'BUY', lot: 0.4, pnl: 380.0, rr: 1.9, emotion: 'disciplined', notes: 'Trend continuation' },
            { id: 'T7', date: new Date(year, month, 14).toISOString(), symbol: 'GBPUSD', type: 'BUY', lot: 0.8, pnl: 195.0, rr: 1.5, emotion: 'calm', notes: 'London breakout' }
        ];
    }

    addTrade(trade) {
        trade.id = 'TRD_' + Date.now();
        if (!trade.date) trade.date = new Date().toISOString();
        this.trades.unshift(trade);
        this.saveTrades();
        return trade;
    }

    deleteTrade(id) {
        this.trades = this.trades.filter(t => t.id !== id);
        this.saveTrades();
    }

    getStats() {
        const totalTrades = this.trades.length;
        if (totalTrades === 0) {
            return { totalTrades: 0, winRate: 0, profitFactor: 0, netPnL: 0, avgRR: 0, wins: 0, losses: 0 };
        }

        let wins = 0;
        let losses = 0;
        let totalWinAmount = 0;
        let totalLossAmount = 0;
        let totalRR = 0;

        for (const t of this.trades) {
            const pnl = Number(t.pnl) || 0;
            if (pnl > 0) {
                wins++;
                totalWinAmount += pnl;
            } else if (pnl < 0) {
                losses++;
                totalLossAmount += Math.abs(pnl);
            }
            if (t.rr) totalRR += Number(t.rr);
        }

        const winRate = Number(((wins / totalTrades) * 100).toFixed(1));
        const profitFactor = totalLossAmount === 0 ? totalWinAmount : Number((totalWinAmount / totalLossAmount).toFixed(2));
        const netPnL = Number((totalWinAmount - totalLossAmount).toFixed(2));
        const avgRR = Number((totalRR / totalTrades).toFixed(2));

        return {
            totalTrades,
            wins,
            losses,
            winRate,
            profitFactor,
            netPnL,
            avgRR
        };
    }

    /**
     * ดึงข้อมูลจัดกลุ่มตามวัน สำหรับแสดงใน Monthly Calendar
     */
    getMonthCalendarData(year = this.currentYear, month = this.currentMonth) {
        const dailyData = {};

        for (const t of this.trades) {
            const d = new Date(t.date);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const dayKey = d.getDate();
                if (!dailyData[dayKey]) {
                    dailyData[dayKey] = {
                        pnl: 0,
                        count: 0,
                        trades: [],
                        emotions: []
                    };
                }
                dailyData[dayKey].pnl += Number(t.pnl) || 0;
                dailyData[dayKey].count++;
                dailyData[dayKey].trades.push(t);
                if (t.emotion) dailyData[dayKey].emotions.push(t.emotion);
            }
        }

        return dailyData;
    }

    /**
     * สร้าง AI Coach Analysis Prompt จากประวัติการเทรดจริง
     */
    generateAICoachPrompt() {
        const stats = this.getStats();
        const recentTrades = this.trades.slice(0, 15);

        const prompt = `คุณคือโค้ชวิเคราะห์จิตวิทยาและพฤติกรรมการเทรด (AI Trading Coach) มืออาชีพ
วิเคราะห์ข้อมูลประวัติการเทรดต่อไปนี้ของเทรดเดอร์ เพื่อระบุจุดแข็ง จุดอ่อน พฤติกรรมอารมณ์ และข้อแนะนำในการปรับปรุง:

[ภาพรวมสถิติ]:
- จำนวนไม้ทั้งหมด: ${stats.totalTrades}
- Win Rate: ${stats.winRate}% (ชนะ ${stats.wins} ไม้, แพ้ ${stats.losses} ไม้)
- Profit Factor: ${stats.profitFactor}
- Net Profit/Loss: $${stats.netPnL}
- ค่าเฉลี่ย Risk:Reward: ${stats.avgRR}R

[รายการเทรดย้อนหลัง]:
${recentTrades.map(t => `- วันที่: ${new Date(t.date).toLocaleDateString()}, สินทรัพย์: ${t.symbol}, ประเภท: ${t.type}, Lot: ${t.lot}, กำไร/ขาดทุน: $${t.pnl}, R:R: ${t.rr || '-'}, อารมณ์/นิสัย: ${t.emotion || '-'}, โน้ต: ${t.notes || '-'}`).join('\n')}

คำสั่ง:
1. ชี้จุดเด่นในการเทรดที่ทำได้ดี
2. ชี้จุดที่ก่อให้เกิดการขาดทุนมากที่สุด (เช่น ปัญหา FOMO, Revenge trade, หรือการไม่รักษาวินัย)
3. สรุป 3 กฎเหล็กที่เทรดเดอร์คนนี้ควรนำไปปฏิบัติในสัปดาห์หน้า`;

        return prompt;
    }
}

window.TradeJournal = TradeJournal;
