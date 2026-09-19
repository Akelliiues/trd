/**
 * Unified Watchlist Manager (รายการเฝ้าดู & ปรับแต่งคู่สินทรัพย์)
 * รองรับการเพิ่ม ลบ เลื่อนลำดับคู่เงิน และสลับโหมดการแสดงผลแบบ Compact View
 */

class WatchlistManager {
    constructor() {
        this.defaultItems = [
            { symbol: 'XAUUSD', name: 'Gold / US Dollar', price: 4347.500, change: 0.85, flag: 'red' },
            { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', price: 75780.00, change: 1.45, flag: 'green' },
            { symbol: 'EURUSD', name: 'Euro / US Dollar', price: 1.15350, change: -0.21, flag: 'blue' },
            { symbol: 'GBPUSD', name: 'British Pound / USD', price: 1.34460, change: -0.15, flag: 'green' },
            { symbol: 'USDJPY', name: 'US Dollar / Yen', price: 155.100, change: 0.42, flag: 'none' },
            { symbol: 'AUDUSD', name: 'Aussie / US Dollar', price: 0.65400, change: -0.08, flag: 'yellow' },
            { symbol: 'XAGUSD', name: 'Silver / US Dollar', price: 31.420, change: 1.12, flag: 'purple' },
            { symbol: 'USOIL',   name: 'Crude Oil WTI', price: 71.30, change: -0.65, flag: 'none' },
            { symbol: 'ETHUSD',  name: 'Ethereum / US Dollar', price: 2380.20, change: 1.84, flag: 'blue' },
            { symbol: 'SOLUSD',  name: 'Solana / US Dollar', price: 125.40, change: 5.12, flag: 'red' }
        ];

        // คลังคู่สินทรัพย์แนะนำ (Catalogue)
        this.availablePresets = [
            { symbol: 'XAUUSD', name: 'Gold / US Dollar', category: 'Metals' },
            { symbol: 'PAXGUSDT', name: 'PAX Gold (24/7 Weekend Proxy)', category: 'Metals' },
            { symbol: 'XAGUSD', name: 'Silver / US Dollar', category: 'Metals' },
            { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar (MT5)', category: 'Crypto' },
            { symbol: 'BTCUSDT', name: 'Bitcoin / Tether (Spot)', category: 'Crypto' },
            { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'Forex' },
            { symbol: 'GBPUSD', name: 'British Pound / USD', category: 'Forex' },
            { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'Forex' },
            { symbol: 'AUDUSD', name: 'Aussie / US Dollar', category: 'Forex' },
            { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', category: 'Forex' },
            { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', category: 'Forex' },
            { symbol: 'GBPJPY', name: 'British Pound / Yen', category: 'Forex' },
            { symbol: 'EURJPY', name: 'Euro / Japanese Yen', category: 'Forex' },
            { symbol: 'NZDUSD', name: 'New Zealand / US Dollar', category: 'Forex' },
            { symbol: 'ETHUSD', name: 'Ethereum / US Dollar (MT5)', category: 'Crypto' },
            { symbol: 'ETHUSDT', name: 'Ethereum / Tether (Spot)', category: 'Crypto' },
            { symbol: 'SOLUSD', name: 'Solana / US Dollar (MT5)', category: 'Crypto' },
            { symbol: 'SOLUSDT', name: 'Solana / Tether (Spot)', category: 'Crypto' },
            { symbol: 'BNBUSDT', name: 'Binance Coin / Tether', category: 'Crypto' },
            { symbol: 'XRPUSDT', name: 'Ripple / Tether', category: 'Crypto' },
            { symbol: 'DOGEUSDT', name: 'Dogecoin / Tether', category: 'Crypto' },
            { symbol: 'USOIL', name: 'Crude Oil WTI Spot', category: 'Energy' },
            { symbol: 'UKOIL', name: 'Brent Crude Oil Spot', category: 'Energy' },
            { symbol: 'US30', name: 'Dow Jones Industrial', category: 'Indices' },
            { symbol: 'NAS100', name: 'Nasdaq 100 Index', category: 'Indices' },
            { symbol: 'SPX500', name: 'S&P 500 Index', category: 'Indices' }
        ];

        this.items = [...this.defaultItems];
        this.isCompact = localStorage.getItem('tradingtools_watchlist_compact') === 'true';
        this.loadFromStorage();
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('tradingtools_watchlist_unified');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.items = parsed.map(p => {
                        if (typeof p === 'string') {
                            const sym = p.toUpperCase().trim();
                            const preset = this.availablePresets.find(pr => pr.symbol === sym);
                            return {
                                symbol: sym,
                                name: preset ? preset.name : sym,
                                price: sym.includes('XAU') ? 4302.529 : (sym.includes('BTC') ? 92450.0 : 1.1408),
                                change: 0.25,
                                flag: 'blue'
                            };
                        } else if (p && typeof p === 'object') {
                            const sym = (p.symbol || 'XAUUSD').toUpperCase().trim();
                            const preset = this.availablePresets.find(pr => pr.symbol === sym);
                            return {
                                symbol: sym,
                                name: p.name || (preset ? preset.name : sym),
                                price: typeof p.price === 'number' && !isNaN(p.price) ? p.price : (sym.includes('XAU') ? 4302.529 : 1.1408),
                                change: typeof p.change === 'number' && !isNaN(p.change) ? p.change : 0.0,
                                flag: p.flag || 'blue'
                            };
                        }
                        return null;
                    }).filter(Boolean);

                    if (this.items.length === 0) {
                        this.items = JSON.parse(JSON.stringify(this.defaultItems));
                    }
                }
            }
        } catch (e) {
            console.warn('Cannot load watchlist from storage, using defaults', e);
            this.items = JSON.parse(JSON.stringify(this.defaultItems));
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('tradingtools_watchlist_unified', JSON.stringify(this.items));
        } catch (e) {}
    }

    getItems() {
        return this.items;
    }

    addItem(item) {
        const symbol = (item.symbol || '').toUpperCase().trim();
        if (!symbol) return false;
        const exists = this.items.some(i => i.symbol === symbol);
        if (!exists) {
            const preset = this.availablePresets.find(p => p.symbol === symbol);
            this.items.push({
                symbol: symbol,
                name: item.name || (preset ? preset.name : symbol),
                price: item.price || (symbol.includes('XAU') ? 4300 : (symbol.includes('BTC') ? 92000 : 1.15)),
                change: item.change || 0.25,
                flag: item.flag || 'blue'
            });
            this.saveToStorage();
            return true;
        }
        return false;
    }

    removeItem(symbol) {
        this.items = this.items.filter(i => i.symbol !== symbol);
        this.saveToStorage();
    }

    moveUp(index) {
        if (index > 0 && index < this.items.length) {
            const temp = this.items[index];
            this.items[index] = this.items[index - 1];
            this.items[index - 1] = temp;
            this.saveToStorage();
        }
    }

    moveDown(index) {
        if (index >= 0 && index < this.items.length - 1) {
            const temp = this.items[index];
            this.items[index] = this.items[index + 1];
            this.items[index + 1] = temp;
            this.saveToStorage();
        }
    }

    setFlag(symbol, flagColor) {
        const item = this.items.find(i => i.symbol === symbol);
        if (item) {
            item.flag = flagColor;
            this.saveToStorage();
        }
    }

    toggleCompact() {
        this.isCompact = !this.isCompact;
        localStorage.setItem('tradingtools_watchlist_compact', this.isCompact);
        return this.isCompact;
    }

    resetDefaults() {
        this.items = JSON.parse(JSON.stringify(this.defaultItems));
        this.saveToStorage();
    }

    updatePrice(symbol, newPrice, changePercent) {
        const item = this.items.find(i => i.symbol === symbol);
        if (item) {
            item.price = newPrice;
            if (changePercent !== undefined) item.change = changePercent;
        }
    }
}

window.WatchlistManager = WatchlistManager;
