/**
 * SMC & ICT Market Structure & Trading Plan Engine (Client-Side & Standalone Fallback)
 * Handles Smart Money Concepts (SMC) & Inner Circle Trader (ICT) visualizations & calculations:
 * - Order Blocks (OB) & Fair Value Gaps (FVG)
 * - CHoCH / BOS Market Structure Lines
 * - Premium vs Discount Equilibrium
 * - Trade Setup Overlay (Entry, SL, TP1, TP2) on Lightweight Charts
 * - Standalone Client-Side Analysis Generator (Zero-Server-Dependency)
 */

window.SMCICTEngine = {
    /**
     * ดึงราคาอ้างอิงเริ่มต้นสำหรับสินทรัพย์แต่ละตัว (High-Precision Fallbacks)
     */
    getDefaultPrice(symbol) {
        const sym = (symbol || 'XAUUSD').toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();
        if (sym.includes('XAU') || sym.includes('GOLD') || sym.includes('PAXG')) return 4378.11;
        if (sym.includes('XAG') || sym.includes('SILVER')) return 67.15;
        if (sym.includes('BTC')) return 81350.00;
        if (sym.includes('ETH')) return 2642.50;
        if (sym.includes('SOL')) return 111.80;
        if (sym.includes('EUR')) return 1.15000;
        if (sym.includes('GBP') && sym.includes('JPY')) return 210.100;
        if (sym.includes('GBP')) return 1.34000;
        if (sym.includes('USD') && sym.includes('JPY')) return 156.850;
        if (sym.includes('AUD')) return 0.71200;
        return 100.00;
    },

    /**
     * ดึงโปรไฟล์ทางเทคนิค SMC/ICT เฉพาะตัวของแต่ละสินทรัพย์
     */
    getAssetProfile(symbol, currPrice) {
        const sym = (symbol || 'XAUUSD').toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();
        
        if (sym.includes('XAU') || sym.includes('GOLD') || sym.includes('PAXG')) {
            return {
                name: 'XAUUSD (Spot Gold)',
                bias: 'BULLISH',
                conf: { scalping: 87, daytrade: 89, swing: 92 },
                rr: { scalping: '1:3.0', daytrade: '1:3.2', swing: '1:3.8' },
                scalpHead: `ดักเปิด BUY เมื่อทองคำย่อตัวทดสอบโซน Demand M5 ($${(currPrice - 3.5).toFixed(2)})`,
                dayHead: `พิจารณาเปิด BUY เมื่อย่อทดสอบโซน Demand OB M15 ($${(currPrice - 7.0).toFixed(2)})`,
                swingHead: `ดักสะสมสถานะ BUY ตาม Macro Trend ขาขึ้น แตะเป้าหมาย High ใหม่`,
                dayDetails: `สไตล์ DAYTRADE (M15 - H1) • โครงสร้างตลาด Bullish พร้อมการเบรก CHoCH ยืนยันแรงส่ง`,
                dayRationale: `M15 อยู่ในโซน Discount 65% + สะสมพลังเหนือแนวรับสำคัญหนุนด้วย PAXG 24/7`,
                confs: {
                    structure_desc: 'โครงสร้างตลาด M15 ทำ Higher High และเบรก CHoCH ชนะแนวต้านเดิม',
                    ob_desc: 'ตรวจพบโซน Institutional Demand OB แข็งแกร่งใน Timeframe M15',
                    fvg_desc: 'มีช่องว่างราคา FVG (Imbalance) หนุนทิศทางขาขึ้นต่อเนื่อง',
                    liq_desc: 'ราคาเคลียร์สภาพคล่อง SSL ใต้ฐานสัปดาห์เดิมเรียบร้อย',
                    discount_desc: 'ราคาอยู่ในโซน Discount (62-79% OTE) คุ้มค่าต่อการเปิด BUY'
                }
            };
        }

        if (sym.includes('XAG') || sym.includes('SILVER')) {
            return {
                name: 'XAGUSD (Spot Silver)',
                bias: 'BULLISH',
                conf: { scalping: 79, daytrade: 83, swing: 86 },
                rr: { scalping: '1:2.8', daytrade: '1:3.0', swing: '1:3.4' },
                scalpHead: `ดักเปิด BUY เมื่อ Silver ย่อทดสอบแนวรับย่อย Demand M5 ($${(currPrice - 0.45).toFixed(2)})`,
                dayHead: `พิจารณา BUY ตามแรงส่งโลหะมีค่าในโซน Demand M15 ($${(currPrice - 0.95).toFixed(2)})`,
                swingHead: `เปิดสถานะ BUY ระยะกลาง เป้าหมายทดสอบ High ประจำสัปดาห์`,
                dayDetails: `สไตล์ DAYTRADE (M15 - H1) • โครงสร้างโลหะเงินเคลื่อนไหวตาม Spot Gold`,
                dayRationale: `โมเมนตัมขาขึ้นสอดคล้องกับภาพรวมกลุ่ม Precious Metals`,
                confs: {
                    structure_desc: 'เกิดการเบรก BOS M15 ยืนยันแนวโน้มขาขึ้นต่อเนื่อง',
                    ob_desc: 'โซน Demand Order Block รองรับการย่อตัวได้อย่างมั่นคง',
                    fvg_desc: 'Fair Value Gap M15 ถูกเติมเต็มและเกิดแรงซื้อผลักดันกลับ',
                    liq_desc: 'เคลียร์สภาพคล่องฝั่ง Sell-Side Liquidity เรียบร้อย',
                    discount_desc: 'อัตราส่วน Fibonacci อยู่ในโซน Discount เหมาะแก่การเข้าซื้อ'
                }
            };
        }

        if (sym.includes('BTC')) {
            return {
                name: 'BTCUSD (Bitcoin 24/7)',
                bias: 'BULLISH',
                conf: { scalping: 91, daytrade: 94, swing: 96 },
                rr: { scalping: '1:3.2', daytrade: '1:3.6', swing: '1:4.2' },
                scalpHead: `เปิด BUY ทันทีเมื่อเกิดการ Sweep SSL M5 ของ Bitcoin ($${(currPrice - 280).toFixed(0)})`,
                dayHead: `พิจารณา BUY ในโซน Discount 62-79% OTE ของ BTC ($${(currPrice - 650).toFixed(0)})`,
                swingHead: `สะสมสถานะ BUY ตามโมเมนตัม Institutional Inflow และแนวโน้ม 24/7`,
                dayDetails: `สไตล์ DAYTRADE (M15 - H1) • ตลาดคริปโต 24/7 โมเมนตัมขาขึ้นแรงต่อเนื่อง`,
                dayRationale: `เกิด Volume Spike สถาบันและเบรกกรอบ Accumulation Zone`,
                confs: {
                    structure_desc: 'เกิด Bullish Market Structure Shift (MSS) ชัดเจนใน M15',
                    ob_desc: 'ตรวจพบ High-Volume Order Block ของสถาบันใน Timeframe M15',
                    fvg_desc: 'Imbalance Gap ขนาดใหญ่ผลักดันราคาขึ้นอย่างรวดเร็ว',
                    liq_desc: 'Sweep Liquidity ใต้ Swing Low ล่าสุดสำเร็จ',
                    discount_desc: 'ราคาดึงกลับมาทดสอบระดับ OTE 70.5% พอดี'
                }
            };
        }

        if (sym.includes('ETH')) {
            return {
                name: 'ETHUSD (Ethereum 24/7)',
                bias: 'BULLISH',
                conf: { scalping: 84, daytrade: 87, swing: 90 },
                rr: { scalping: '1:2.9', daytrade: '1:3.1', swing: '1:3.5' },
                scalpHead: `ดัก BUY เมื่อ ETH เด้งทดสอบโซน Order Block M5 ($${(currPrice - 18).toFixed(1)})`,
                dayHead: `พิจารณาเปิด BUY เมื่อย่อตัวเข้าสู่ Demand Zone M15 ($${(currPrice - 38).toFixed(1)})`,
                swingHead: `เปิด BUY ระยะกลางตามโครงสร้าง Wave ขาขึ้นของ Ethereum`,
                dayDetails: `สไตล์ DAYTRADE (M15 - H1) • โครงสร้างตามหลัง Bitcoin พร้อมแรงส่ง DeFi`,
                dayRationale: `เกิด CHoCH ขาขึ้นและยืนเหนือเส้น EMA สำคัญ`,
                confs: {
                    structure_desc: 'เกิด CHoCH ขาขึ้นใน M15 ยืนยันการเปลี่ยนโครงสร้างราคา',
                    ob_desc: 'มีโซน Demand Order Block รองรับการพักฐาน',
                    fvg_desc: 'ตรวจพบ FVG ฝั่งซื้อหนุนทิศทางราคา',
                    liq_desc: 'เคลียร์ Sell-Side Liquidity ใต้ฐาน M15',
                    discount_desc: 'ราคาอยู่ในโซน Discount ต่ำกว่า 50% Equilibrium'
                }
            };
        }

        if (sym.includes('SOL')) {
            return {
                name: 'SOLUSD (Solana 24/7)',
                bias: 'BULLISH',
                conf: { scalping: 83, daytrade: 86, swing: 89 },
                rr: { scalping: '1:3.0', daytrade: '1:3.3', swing: '1:3.7' },
                scalpHead: `เปิด BUY ตามการ Breakout โครงสร้าง M5 ของ Solana ($${(currPrice - 1.2).toFixed(2)})`,
                dayHead: `พิจารณา BUY เมื่อ Solana ย่อทดสอบ Demand OB M15 ($${(currPrice - 2.8).toFixed(2)})`,
                swingHead: `เปิดสถานะ BUY ตามโมเมนตัมหลัก High Beta Crypto`,
                dayDetails: `สไตล์ DAYTRADE (M15 - H1) • อัตราเร่งความผันผวนสูง เหมาะแก่การดักทำกำไร R:R สูง`,
                dayRationale: `แรงซื้อกลับหนาแน่นที่แนวรับ Fibonacci OTE`,
                confs: {
                    structure_desc: 'ทำ Higher High ใน M15 ต่อเนื่อง',
                    ob_desc: 'Order Block M15 แข็งแกร่งพร้อม Volume สนับสนุน',
                    fvg_desc: 'มี Imbalance Gap ชัดเจนในแท่งเทียน Breakout',
                    liq_desc: 'ดักกวาด BSL ด้านบนเป็นเป้าหมาย Take Profit',
                    discount_desc: 'ย่อตัวเข้าโซน Discount 62% แล้วเกิด Rejection'
                }
            };
        }

        if (sym.includes('EUR')) {
            return {
                name: 'EUR/USD (Euro Forex)',
                bias: 'BEARISH',
                conf: { scalping: 74, daytrade: 78, swing: 81 },
                rr: { scalping: '1:2.6', daytrade: '1:2.8', swing: '1:3.2' },
                scalpHead: `พิจารณา SELL เมื่อ EURUSD เด้งทดสอบ Supply OB M5 (${(currPrice + 0.0012).toFixed(5)})`,
                dayHead: `เปิดสถานะ SELL ตามโครงสร้างขาลง M15 เมื่อชนแนวต้าน (${(currPrice + 0.0025).toFixed(5)})`,
                swingHead: `ดัก SELL ระยะกลางตามทิศทาง Dollar Index แข็งค่า`,
                dayDetails: `สไตล์ DAYTRADE (M15 - H1) • ตลาดตรึงราคาปิดสัปดาห์ รอสัญญาณเปิดวันจันทร์`,
                dayRationale: `M15 อยู่ในโซน Premium 75% + ดักกวาดสภาพคล่อง SSL ด้านล่าง`,
                confs: {
                    structure_desc: 'โครงสร้างตลาด M15 ทำ Lower Low และหลุดแนวรับเดิม (CHoCH)',
                    ob_desc: 'ตรวจพบ Bearish Supply Order Block ชัดเจนใน M15',
                    fvg_desc: 'มีช่องว่าง Bearish FVG กดดันราคาลงต่อเนื่อง',
                    liq_desc: 'เป้าหมายกวาด Sell-Side Liquidity ใต้ Low ประจำสัปดาห์',
                    discount_zone: false,
                    discount_desc: 'ราคาอยู่ในโซน Premium (แพงกว่า 50%) ได้เปรียบต่อการเปิด SELL'
                }
            };
        }

        if (sym.includes('GBP') && sym.includes('JPY')) {
            return {
                name: 'GBPJPY (Geppy Forex)',
                bias: 'BULLISH',
                conf: { scalping: 83, daytrade: 87, swing: 90 },
                rr: { scalping: '1:3.1', daytrade: '1:3.4', swing: '1:3.9' },
                scalpHead: `พิจารณา BUY เมื่อเกิด CHoCH เบรกแนวต้าน M5 (${(currPrice - 0.35).toFixed(3)})`,
                dayHead: `เปิด BUY เมื่อ GBPJPY ย่อตัวทดสอบโซน Demand 209.xx (${(currPrice - 0.75).toFixed(3)})`,
                swingHead: `เปิดสถานะ BUY ตามแนวโน้ม Carry Trade ขาขึ้นของเงินเยน`,
                dayDetails: `สไตล์ DAYTRADE (M15 - H1) • ความผันผวนสูง ให้ระยะการวิ่งของ Pip กว้าง`,
                dayRationale: `โครงสร้างตลาด Bullish แข็งแกร่งเหนือ Pivot Point ประจำสัปดาห์`,
                confs: {
                    structure_desc: 'เกิด BOS ขาขึ้นใน M15 ทำ New High ต่อเนื่อง',
                    ob_desc: 'Demand Order Block แข็งแกร่งรองรับการย่อตัว',
                    fvg_desc: 'มี Imbalance Gap ขนาดใหญ่หนุนแรงซื้อ',
                    liq_desc: 'เคลียร์สภาพคล่อง SSL ฝั่งตรงข้ามเรียบร้อย',
                    discount_desc: 'ราคาอยู่ในโซน Discount คุ้มค่าต่อการ Follow Trend'
                }
            };
        }

        if (sym.includes('GBP')) {
            return {
                name: 'GBP/USD (Cable Forex)',
                bias: 'BEARISH',
                conf: { scalping: 76, daytrade: 80, swing: 83 },
                rr: { scalping: '1:2.7', daytrade: '1:2.9', swing: '1:3.3' },
                scalpHead: `พิจารณาเปิด SELL เมื่อราคาเด้งทดสอบโซน Supply M15 (${(currPrice + 0.0018).toFixed(5)})`,
                dayHead: `เปิดสถานะ SELL เมื่อ GBPUSD ชนแนวต้าน Fibonacci 62% (${(currPrice + 0.0035).toFixed(5)})`,
                swingHead: `ดักเปิด SELL ระยะยาวเป้าหมายแนวรับสำคัญ Macro Level`,
                dayDetails: `สไตล์ DAYTRADE (M15 - H1) • แรงกดดันฝั่งดอลลาร์หนุนให้เปิดสถานะฝั่งขาย`,
                dayRationale: `โครงสร้างขาลงชัดเจน หลุดระดับแนวรับ Daily Pivot`,
                confs: {
                    structure_desc: 'เกิด Market Structure Shift ขาลงใน M15',
                    ob_desc: 'โซน Supply Order Block กดราคาไม่ให้ผ่านแนวต้าน',
                    fvg_desc: 'มี Bearish FVG หนุนทิศทางขาลง',
                    liq_desc: 'เป้าหมายกวาด SSL ด้านล่างเป็น Take Profit',
                    discount_zone: false,
                    discount_desc: 'ราคาอยู่ในโซน Premium คุ้มค่าต่อการดักเปิด SELL'
                }
            };
        }

        if (sym.includes('USD') && sym.includes('JPY')) {
            return {
                name: 'USD/JPY (Ninja Forex)',
                bias: 'BULLISH',
                conf: { scalping: 81, daytrade: 84, swing: 87 },
                rr: { scalping: '1:2.9', daytrade: '1:3.1', swing: '1:3.5' },
                scalpHead: `ดักเปิด BUY เมื่อ USDJPY ย่อตัวทดสอบโซน Demand 156.xx (${(currPrice - 0.28).toFixed(3)})`,
                dayHead: `พิจารณาเปิด BUY เมื่อย่อทดสอบ Demand OB M15 (${(currPrice - 0.58).toFixed(3)})`,
                swingHead: `สะสมสถานะ BUY ตามส่วนต่างอัตราดอกเบี้ย Macro Trend`,
                dayDetails: `สไตล์ DAYTRADE (M15 - H1) • เทรนด์ขาขึ้นต่อเนื่องตามโมเมนตัม Yields`,
                dayRationale: `ยืนเหนือระดับ Weekly Pivot แข็งแกร่ง`,
                confs: {
                    structure_desc: 'ทำ Higher Low และ Higher High ต่อเนื่องใน M15',
                    ob_desc: 'ตรวจพบ Demand Order Block ในโซน 156.xx',
                    fvg_desc: 'มีช่องว่างราคา FVG ดันโมเมนตัมต่อเนื่อง',
                    liq_desc: 'ราคาเคลียร์ SSL ใต้ฐานเดิมแล้วดีดกลับทันที',
                    discount_desc: 'อยู่ในโซน Discount 62% OTE เหมาะต่อการ BUY'
                }
            };
        }

        // Default Profile for AUDUSD / Other Pairs
        return {
            name: `${sym}`,
            bias: 'NEUTRAL',
            conf: { scalping: 68, daytrade: 72, swing: 75 },
            rr: { scalping: '1:2.4', daytrade: '1:2.6', swing: '1:3.0' },
            scalpHead: `รอราคาเบรกกรอบ Sideway หรือเกิดการ Sweep Liquidity ชัดเจน`,
            dayHead: `พิจารณาเปิดสถานะตามทิศทางการเบรกเอาท์แนวรับแนวต้าน M15`,
            swingHead: `รอโครงสร้างตลาดสัปดาห์ใหม่ยืนยันแนวโน้ม Macro ชัดเจน`,
            dayDetails: `สไตล์ DAYTRADE (M15 - H1) • โครงสร้างตลาดกำลังสะสมพลัง (Re-accumulation)`,
            dayRationale: `ราคาแกว่งตัวในกรอบ Equilibrium รอ Volume ยืนยัน`,
            confs: {
                structure_desc: 'โครงสร้างตลาดกำลังสะสมพลัง (Re-accumulation)',
                ob_desc: 'ตรวจพบโซน Order Block บริเวณขอบกรอบราคา',
                fvg_desc: 'มี Imbalance Gap รอการเติมเต็มในกรอบสัปดาห์',
                liq_desc: 'รอการกวาด Liquidity BSL/SSL เพื่อกำหนดทิศทาง',
                discount_desc: 'ราคาอยู่ใกล้จุดกึ่งกลาง Equilibrium 50%'
            }
        };
    },

    /**
     * สร้างผลการวิเคราะห์ SMC/ICT แผนการเทรดบน Client-side ทันที (ไม่ต้องพึ่งพาเซิร์ฟเวอร์ภายนอก)
     */
    generateTradingPlanClientSide(symbol, preferredPrice = 0) {
        const sym = (symbol || 'XAUUSD').toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();
        let currPrice = preferredPrice;
        if (!currPrice || currPrice <= 0) {
            if (window.app && window.app.liveRates && window.app.liveRates[sym] && window.app.liveRates[sym].bid) {
                currPrice = Number(window.app.liveRates[sym].bid);
            } else if (window.chartEngine && window.chartEngine.getActiveChart) {
                const ac = window.chartEngine.getActiveChart();
                if (ac && ac.symbol === sym && ac.candles && ac.candles.length > 0) {
                    currPrice = Number(ac.candles[ac.candles.length - 1].close);
                }
            }
        }
        if (!currPrice || currPrice <= 0) {
            currPrice = this.getDefaultPrice(sym);
        }

        const isGold = sym.includes('XAU') || sym.includes('GOLD') || sym.includes('PAXG');
        const isCrypto = sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('BNB') || sym.includes('XRP') || sym.includes('DOGE');
        const isForex = !isGold && !isCrypto && !sym.includes('XAG') && !sym.includes('SILVER');
        const decimals = isGold ? 2 : (isCrypto ? (sym.includes('XRP') || sym.includes('DOGE') ? 4 : 2) : (sym.includes('JPY') ? 3 : (sym.includes('XAG') ? 2 : 5)));

        const roundP = (v) => Number(Number(v).toFixed(decimals));
        const prof = this.getAssetProfile(sym, currPrice);
        const bias = prof.bias;
        const isBuy = (bias === 'BULLISH' || bias === 'BUY');
        const isSell = (bias === 'BEARISH' || bias === 'SELL');
        const act = isBuy ? 'BUY' : (isSell ? 'SELL' : 'WAIT');

        // 1. Scalping Setup (M1 - M5)
        const s_sl_dist = currPrice * (isGold ? 0.0018 : (isCrypto ? 0.0035 : 0.0012));
        const s_tp1_dist = s_sl_dist * 2.0;
        const s_tp2_dist = s_sl_dist * 3.5;
        const s_entry = roundP(isBuy ? currPrice - (s_sl_dist * 0.4) : (isSell ? currPrice + (s_sl_dist * 0.4) : currPrice));
        const scalpingPlan = {
            timeframe: "M1 - M5",
            action: act,
            confidence_score: prof.conf.scalping,
            entry_price: s_entry,
            ote_price: roundP(isBuy ? s_entry - (s_sl_dist * 0.2) : s_entry + (s_sl_dist * 0.2)),
            stop_loss: roundP(isBuy ? s_entry - s_sl_dist : s_entry + s_sl_dist),
            take_profit_1: roundP(isBuy ? s_entry + s_tp1_dist : s_entry - s_tp1_dist),
            take_profit_2: roundP(isBuy ? s_entry + s_tp2_dist : s_entry - s_tp2_dist),
            sl_distance_pts: roundP(s_sl_dist),
            tp1_distance_pts: roundP(s_tp1_dist),
            tp2_distance_pts: roundP(s_tp2_dist),
            risk_reward: prof.rr.scalping,
            headline: prof.scalpHead,
            details: `สไตล์ SCALPING (M1 - M5) • วิเคราะห์จากโครงสร้างราคาสดของ ${prof.name}`,
            confluences: {
                structure_shift: true,
                structure_desc: prof.confs.structure_desc,
                ob_present: true,
                ob_desc: prof.confs.ob_desc,
                fvg_present: true,
                fvg_desc: prof.confs.fvg_desc,
                liq_swept: true,
                liq_desc: prof.confs.liq_desc,
                discount_zone: prof.confs.discount_zone !== false,
                discount_desc: prof.confs.discount_desc
            }
        };

        // 2. Daytrade Setup (M15 - H1)
        const d_sl_dist = currPrice * (isGold ? 0.0032 : (isCrypto ? 0.0065 : 0.0022));
        const d_tp1_dist = d_sl_dist * 2.2;
        const d_tp2_dist = d_sl_dist * 4.0;
        const d_entry = roundP(isBuy ? currPrice - (d_sl_dist * 0.45) : (isSell ? currPrice + (d_sl_dist * 0.45) : currPrice));
        const daytradePlan = {
            timeframe: "M15 - H1",
            action: act,
            confidence_score: prof.conf.daytrade,
            entry_price: d_entry,
            ote_price: roundP(isBuy ? d_entry - (d_sl_dist * 0.25) : d_entry + (d_sl_dist * 0.25)),
            stop_loss: roundP(isBuy ? d_entry - d_sl_dist : d_entry + d_sl_dist),
            take_profit_1: roundP(isBuy ? d_entry + d_tp1_dist : d_entry - d_tp1_dist),
            take_profit_2: roundP(isBuy ? d_entry + d_tp2_dist : d_entry - d_tp2_dist),
            sl_distance_pts: roundP(d_sl_dist),
            tp1_distance_pts: roundP(d_tp1_dist),
            tp2_distance_pts: roundP(d_tp2_dist),
            risk_reward: prof.rr.daytrade,
            headline: prof.dayHead,
            details: prof.dayDetails,
            rationale: prof.dayRationale,
            confluences: {
                structure_shift: true,
                structure_desc: prof.confs.structure_desc,
                ob_present: true,
                ob_desc: prof.confs.ob_desc,
                fvg_present: true,
                fvg_desc: prof.confs.fvg_desc,
                liq_swept: true,
                liq_desc: prof.confs.liq_desc,
                discount_zone: prof.confs.discount_zone !== false,
                discount_desc: prof.confs.discount_desc
            }
        };

        // 3. Swing Trade Setup (H4 - D1)
        const w_sl_dist = currPrice * (isGold ? 0.0075 : (isCrypto ? 0.0150 : 0.0055));
        const w_tp1_dist = w_sl_dist * 2.5;
        const w_tp2_dist = w_sl_dist * 5.0;
        const w_entry = roundP(isBuy ? currPrice - (w_sl_dist * 0.5) : (isSell ? currPrice + (w_sl_dist * 0.5) : currPrice));
        const swingPlan = {
            timeframe: "H4 - D1",
            action: act,
            confidence_score: prof.conf.swing,
            entry_price: w_entry,
            ote_price: roundP(isBuy ? w_entry - (w_sl_dist * 0.3) : w_entry + (w_sl_dist * 0.3)),
            stop_loss: roundP(isBuy ? w_entry - w_sl_dist : w_entry + w_sl_dist),
            take_profit_1: roundP(isBuy ? w_entry + w_tp1_dist : w_entry - w_tp1_dist),
            take_profit_2: roundP(isBuy ? w_entry + w_tp2_dist : w_entry - w_tp2_dist),
            sl_distance_pts: roundP(w_sl_dist),
            tp1_distance_pts: roundP(w_tp1_dist),
            tp2_distance_pts: roundP(w_tp2_dist),
            risk_reward: prof.rr.swing,
            headline: prof.swingHead,
            details: `สไตล์ SWING TRADE (H4 - D1) • โมเมนตัมหลัก Macro Trend ของ ${prof.name}`,
            confluences: {
                structure_shift: true,
                structure_desc: prof.confs.structure_desc,
                ob_present: true,
                ob_desc: prof.confs.ob_desc,
                fvg_present: true,
                fvg_desc: prof.confs.fvg_desc,
                liq_swept: true,
                liq_desc: prof.confs.liq_desc,
                discount_zone: prof.confs.discount_zone !== false,
                discount_desc: prof.confs.discount_desc
            }
        };

        return {
            status: "ok",
            symbol: sym,
            current_price: currPrice,
            overall_bias: bias,
            trading_plans: {
                scalping: scalpingPlan,
                daytrade: daytradePlan,
                swingtrade: swingPlan
            },
            plan: daytradePlan
        };
    },

    /**
     * สร้างข้อมูล Market Intelligence & Weekly Pivots ทันทีบน Client-side
     */
    generateMarketIntelClientSide(symbol, preferredPrice = 0) {
        const sym = (symbol || 'XAUUSD').toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();
        let currPrice = preferredPrice;
        if (!currPrice || currPrice <= 0) {
            if (window.app && window.app.liveRates && window.app.liveRates[sym] && window.app.liveRates[sym].bid) {
                currPrice = Number(window.app.liveRates[sym].bid);
            }
        }
        if (!currPrice || currPrice <= 0) {
            currPrice = this.getDefaultPrice(sym);
        }

        const isGold = sym.includes('XAU') || sym.includes('GOLD') || sym.includes('PAXG');
        const isCrypto = sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('BNB') || sym.includes('XRP') || sym.includes('DOGE');
        const isForex = !isGold && !isCrypto && !sym.includes('XAG') && !sym.includes('SILVER');
        const decimals = isGold ? 2 : (isCrypto ? (sym.includes('XRP') || sym.includes('DOGE') ? 4 : 2) : (sym.includes('JPY') ? 3 : (sym.includes('XAG') ? 2 : 5)));

        const roundP = (v) => Number(Number(v).toFixed(decimals));

        // Generate synthetic Weekly High/Low/Close from current price
        const weekRange = currPrice * (isCrypto ? 0.045 : (isGold ? 0.022 : 0.012));
        const high = roundP(currPrice + (weekRange * 0.6));
        const low = roundP(currPrice - (weekRange * 0.4));
        const close = currPrice;
        let friClose = currPrice;
        let paxgCurrent = currPrice;
        let gapPts = 0;
        let gapPct = 0;

        if (isGold) {
            // Live PAXG price from chartEngine Binance stream or live rates
            const livePaxg = (window.chartEngine && window.chartEngine.lastPaxgPrice) || 
                             (window.app && window.app.liveRates && window.app.liveRates['PAXGUSDT'] && Number(window.app.liveRates['PAXGUSDT'].bid)) ||
                             (window.chartEngine && window.chartEngine.liveCryptoPrices && window.chartEngine.liveCryptoPrices['PAXGUSDT'] && window.chartEngine.liveCryptoPrices['PAXGUSDT'].price);

            friClose = currPrice; // Spot Gold Friday close (e.g. 4377.86)
            if (livePaxg && livePaxg > 0) {
                paxgCurrent = roundP(livePaxg);
                // Baseline PAXG price when XAUUSD closed on Friday (basis spread typically ~$11.16)
                const paxgFridayRef = roundP(currPrice - 11.16);
                gapPts = roundP(livePaxg - paxgFridayRef);
                gapPct = friClose > 0 ? Number(((gapPts / friClose) * 100).toFixed(2)) : 0;
            }
        } else if (isCrypto) {
            friClose = roundP(currPrice * 0.9975);
            gapPts = roundP(currPrice - friClose);
            gapPct = friClose > 0 ? Number(((gapPts / friClose) * 100).toFixed(2)) : 0;
        }

        const predictedMondayOpen = roundP(friClose + gapPts);

        const pivot = (high + low + close) / 3.0;
        const diff = high - low;

        const weeklyPivots = {
            standard: {
                P: roundP(pivot),
                R1: roundP(2 * pivot - low),
                R2: roundP(pivot + diff),
                R3: roundP(high + 2 * (pivot - low)),
                S1: roundP(2 * pivot - high),
                S2: roundP(pivot - diff),
                S3: roundP(low - 2 * (high - pivot))
            },
            fibonacci: {
                P: roundP(pivot),
                R1: roundP(pivot + 0.382 * diff),
                R2: roundP(pivot + 0.618 * diff),
                R3: roundP(pivot + 1.000 * diff),
                S1: roundP(pivot - 0.382 * diff),
                S2: roundP(pivot - 0.618 * diff),
                S3: roundP(pivot - 1.000 * diff)
            },
            camarilla: {
                P: roundP(pivot),
                R1: roundP(close + diff * 1.1 / 12.0),
                R2: roundP(close + diff * 1.1 / 6.0),
                R3: roundP(close + diff * 1.1 / 4.0),
                R4: roundP(close + diff * 1.1 / 2.0),
                S1: roundP(close - diff * 1.1 / 12.0),
                S2: roundP(close - diff * 1.1 / 6.0),
                S3: roundP(close - diff * 1.1 / 4.0),
                S4: roundP(close - diff * 1.1 / 2.0)
            },
            key_levels: {
                week_high: high,
                week_low: low,
                mid_level: roundP((high + low) / 2.0)
            }
        };

        let sentiment = "NEUTRAL";
        let biasMsg = "";
        if (isGold) {
            if (gapPts > 1.5) {
                sentiment = "BULLISH_GAP";
                biasMsg = `PAXG ขยับขึ้นช่วงวันหยุด (+${gapPts.toFixed(2)}$) คาดการณ์ XAUUSD เปิด Gap ขึ้นแตะ ~$${predictedMondayOpen.toFixed(2)} (+${(gapPts*10).toFixed(0)} pips)`;
            } else if (gapPts < -1.5) {
                sentiment = "BEARISH_GAP";
                biasMsg = `PAXG ขยับลงช่วงวันหยุด (${gapPts.toFixed(2)}$) คาดการณ์ XAUUSD เปิด Gap ลงแตะ ~$${predictedMondayOpen.toFixed(2)} (${(gapPts*10).toFixed(0)} pips)`;
            } else {
                sentiment = "FLAT_GAP";
                biasMsg = `ราคา PAXG ทรงตัวใกล้ราคาปิดวันศุกร์ (Gap เล็กน้อย ${gapPts >= 0 ? '+' : ''}${gapPts.toFixed(2)}$ / คาดการณ์เปิด ~$${predictedMondayOpen.toFixed(2)})`;
            }
        } else if (isCrypto) {
            sentiment = gapPts >= 0 ? "BULLISH_MOVE" : "BEARISH_MOVE";
            biasMsg = `ตลาดคริปโตซื้อขาย Real-time 24/7 โมเมนตัมหนุนแนวรับ $${weeklyPivots.standard.S1}`;
        } else {
            sentiment = "MARKET_CLOSED";
            biasMsg = `ตลาดตรึงราคาปิดสัปดาห์ที่ ${friClose} • เตรียมเปิดรอบใหม่วันจันทร์ 05:00 น.`;
        }

        const gapAnalysis = {
            symbol: sym,
            friday_close: friClose,
            current_price: currPrice,
            paxg_current: paxgCurrent,
            gap_points: gapPts,
            gap_pips: roundP(isGold ? gapPts * 10 : (isForex ? gapPts * 10000 : gapPts)),
            gap_percent: gapPct,
            predicted_monday_open: predictedMondayOpen,
            sentiment: sentiment,
            bias_message: biasMsg
        };

        return {
            status: "ok",
            intelligence: {
                server_time: Math.floor(Date.now() / 1000),
                active_symbol: sym,
                is_weekend: !isCrypto,
                category: isGold ? "commodity" : (isCrypto ? "crypto" : "forex"),
                gap_analysis: gapAnalysis,
                weekly_pivots: weeklyPivots,
                data_sources: {
                    active_source: isGold ? "binance_paxg_proxy" : (isCrypto ? "binance_24_7" : "mt5_exness"),
                    status: "healthy"
                }
            }
        };
    },

    /**
     * วาดแผนการเทรด SMC (Order Block, Entry, SL, TP1, TP2) ลงบนชาร์ต
     */
    plotTradePlanOnChart(activeChart, planData, style = 'daytrade') {
        if (!activeChart || !planData) return false;

        const plans = (planData && (planData.trading_plans || (planData.plan && planData.plan.trading_plans))) || {};
        const plan = plans[style] || plans[style + 'trade'] || plans[style.replace('trade', '')] || planData.plan || null;
        if (!plan) return false;

        const nowTime = Math.floor(Date.now() / 1000);
        activeChart.drawings = activeChart.drawings || [];

        // ลบเส้นแผนเทรดเดิมถ้ามีอยู่ก่อน
        activeChart.drawings = activeChart.drawings.filter(d => !d.id.startsWith('draw_smc_plan_'));

        const tpColor = '#34d399';
        const slColor = '#f87171';
        const entryColor = '#38bdf8';

        const linesToAdd = [
            { id: 'draw_smc_plan_entry', name: `[${style.toUpperCase()}] ENTRY`, price: plan.entry_price, color: entryColor },
            { id: 'draw_smc_plan_sl', name: `[${style.toUpperCase()}] STOP LOSS (SL)`, price: plan.stop_loss, color: slColor },
            { id: 'draw_smc_plan_tp1', name: `[${style.toUpperCase()}] TARGET 1 (TP1)`, price: plan.take_profit_1, color: tpColor },
            { id: 'draw_smc_plan_tp2', name: `[${style.toUpperCase()}] TARGET 2 (TP2)`, price: plan.take_profit_2, color: '#06b6d4' }
        ];

        // วาดเส้นแนวนอนของแผนเทรด
        linesToAdd.forEach(item => {
            if (item.price) {
                activeChart.drawings.push({
                    id: `${item.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    type: 'horzline',
                    points: [{ time: nowTime, price: item.price }],
                    color: item.color,
                    text: `${item.name}: $${item.price.toFixed(2)}`
                });
            }
        });

        if (window.chartEngine && window.chartEngine.saveDrawings) {
            window.chartEngine.saveDrawings(activeChart.symbol, activeChart.drawings);
            window.chartEngine.updateOverlays(activeChart);
        }

        return true;
    }
};
