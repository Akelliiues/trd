/**
 * Main Application Controller
 * เชื่อมโยง UI ทั้งหมดเข้ากับ ChartEngine, ReplayEngine, Watchlist, และ TradeJournal
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Application Version Control & Forced Auto-Migration
    const APP_VERSION = '2.6.7';
    window.APP_VERSION = APP_VERSION;
    const prevVersion = localStorage.getItem('tt_app_version');
    if (prevVersion && prevVersion !== APP_VERSION) {
        console.log(`[TradingTools] New version detected: ${APP_VERSION} (was ${prevVersion}). Purging old caches and auto-reloading...`);
        localStorage.setItem('tt_app_version', APP_VERSION);
        if ('caches' in window) {
            caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
                window.location.replace(window.location.origin + window.location.pathname + '?v=' + Date.now());
            }).catch(() => {
                window.location.replace(window.location.origin + window.location.pathname + '?v=' + Date.now());
            });
            return;
        } else {
            window.location.replace(window.location.origin + window.location.pathname + '?v=' + Date.now());
            return;
        }
    }
    localStorage.setItem('tt_app_version', APP_VERSION);

    // 1. Initialize Core Engines
    const chartEngine = new ChartEngine('chart-grid-container');
    const replayEngine = new ReplayEngine(chartEngine);
    const watchlist = new WatchlistManager();
    const journal = new TradeJournal();

    window.chartEngine = chartEngine;
    window.replayEngine = replayEngine;
    window.watchlist = watchlist;
    window.journal = journal;

    // 2. UI Elements
    const replayBar = document.getElementById('replay-toolbar');
    const replayPlayBtn = document.getElementById('replay-play-btn');
    const replaySpeedSelect = document.getElementById('replay-speed-select');
    const layoutSelect = document.getElementById('layout-select');
    const vpToggleBtn = document.getElementById('btn-toggle-vp');
    const crosshairToggleBtn = document.getElementById('btn-toggle-crosshair');

    // 3. Initial Setup (โหลดการตั้งค่า Layout ล่าสุดจาก localStorage อัตโนมัติ)
    const savedLayout = localStorage.getItem('tradingtools_layout') || '2x2';
    if (layoutSelect) layoutSelect.value = savedLayout;
    await chartEngine.setLayout(savedLayout);
    chartEngine.redrawAllOrders();
    chartEngine.updateAutoScrollUI();

    // โหลดสถานะยุบ/ขยาย Watchlist จาก localStorage
    const savedWlCollapsed = localStorage.getItem('tradingtools_watchlist_collapsed') === 'true';
    if (savedWlCollapsed) {
        const sidebar = document.getElementById('app-sidebar') || document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.add('watchlist-collapsed');
        const arrow = document.getElementById('wl-collapse-arrow');
        if (arrow) arrow.innerText = '▸';
        const btnIcon = document.getElementById('btn-collapse-wl-icon');
        if (btnIcon) btnIcon.innerText = '▼';
        const headerTitle = document.getElementById('wl-header-title');
        if (headerTitle) headerTitle.innerText = 'รายการเฝ้าดู';
    }

    // 4. Replay State Listeners
    replayEngine.onStateChange = (state) => {
        if (state.isCutting !== undefined) {
            const cutBtn = document.getElementById('btn-cut-bar');
            if (cutBtn) cutBtn.classList.toggle('active', state.isCutting);
        }
        if (state.isActive !== undefined) {
            replayBar.classList.toggle('visible', state.isActive);
            document.getElementById('btn-replay-mode').classList.toggle('active', state.isActive);
        }
        if (state.isPlaying !== undefined) {
            replayPlayBtn.innerHTML = state.isPlaying ? '⏸️' : '▶️';
            replayPlayBtn.title = state.isPlaying ? 'Pause' : 'Play';
        }
        if (state.currentTime) {
            const timeLabel = document.getElementById('replay-time-label');
            if (timeLabel) {
                const d = new Date(state.currentTime * 1000);
                timeLabel.innerText = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }
    };

    replayEngine.onOrderUpdate = ({ openOrders, history, balance, metrics }) => {
        renderOrderPositions(openOrders);
        const m = metrics || (replayEngine.getAccountMetrics ? replayEngine.getAccountMetrics() : { balance, equity: balance, usedMargin: 0, freeMargin: balance, leverage: 500 });
        
        const balEl = document.getElementById('virtual-balance-val');
        if (balEl && m.balance !== undefined) {
            balEl.innerText = `$${m.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        const eqEl = document.getElementById('subbar-equity');
        if (eqEl && m.equity !== undefined) {
            eqEl.innerText = `Eq: $${m.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        const mrgEl = document.getElementById('subbar-margin');
        if (mrgEl && m.usedMargin !== undefined) {
            mrgEl.innerText = `Mrg: $${m.usedMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        const freeEl = document.getElementById('subbar-freemargin');
        if (freeEl && m.freeMargin !== undefined) {
            freeEl.innerText = `Free: $${m.freeMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        const levEl = document.getElementById('subbar-lev');
        if (levEl && m.leverage !== undefined) {
            levEl.innerText = `1:${m.leverage}`;
        }
    };

    // Call notifyOrderUpdate() so initial account balance, equity, leverage, free margin are displayed immediately on page load/refresh
    replayEngine.notifyOrderUpdate();

    // 5. Setup Watchlist UI (Unified List - รวมเป็นแถวเดียว ไม่แยกหมวดหมู่)
    renderWatchlistItems();

    function renderWatchlistItems() {
        const container = document.getElementById('watchlist-items-container');
        if (!container) return;
        container.innerHTML = '';
        const items = watchlist.getItems();
        const isCompact = watchlist.isCompact;

        const countEl = document.getElementById('wl-header-count');
        if (countEl) countEl.innerText = (items || []).length;

        const compactBtn = document.getElementById('btn-toggle-compact-wl');
        if (compactBtn) {
            compactBtn.classList.toggle('active', isCompact);
            compactBtn.title = isCompact ? 'มุมมองปกติ (Standard View)' : 'สลับโหมดมุมมองแบบกระชับ (Compact View)';
        }

        (items || []).forEach(item => {
            if (!item) return;
            const sym = item.symbol || 'XAUUSD';
            const name = item.name || sym;
            const price = (typeof item.price === 'number' && !isNaN(item.price)) ? item.price : 4300;
            const change = (typeof item.change === 'number' && !isNaN(item.change)) ? item.change : 0.0;
            const flag = item.flag || 'blue';

            const row = document.createElement('div');
            row.className = `wl-item-row ${isCompact ? 'compact' : ''}`;
            const changeClass = change >= 0 ? 'pos' : 'neg';

            const isGold = sym.includes('XAU') || sym.includes('GOLD');
            const isForex = sym.includes('EUR') || sym.includes('GBP') || sym.includes('JPY') || sym.includes('AUD');
            const precision = isGold ? 3 : (isForex ? 5 : 2);

            if (isCompact) {
                row.innerHTML = `
                    <div class="wl-item-left">
                        <span class="wl-flag-dot ${flag}"></span>
                        <span class="wl-symbol">${sym}</span>
                    </div>
                    <div class="wl-item-right" style="display: flex; align-items: center; gap: 8px;">
                        <span class="wl-price">${price.toFixed(precision)}</span>
                        <span class="wl-change ${changeClass}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</span>
                    </div>
                `;
            } else {
                row.innerHTML = `
                    <div class="wl-item-left">
                        <span class="wl-flag-dot ${flag}"></span>
                        <div>
                            <div class="wl-symbol">${sym}</div>
                            <div class="wl-name">${name}</div>
                        </div>
                    </div>
                    <div class="wl-item-right">
                        <div class="wl-price">${price.toFixed(precision)}</div>
                        <div class="wl-change ${changeClass}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</div>
                    </div>
                `;
            }

            row.onclick = () => {
                const active = chartEngine.getActiveChart();
                if (active) {
                    chartEngine.setCellSymbol(active.index, sym);
                }
            };

            container.appendChild(row);
        });
    }

    // 6. Setup Trade Positions UI
    function renderOrderPositions(orders) {
        const container = document.getElementById('virtual-positions-list');
        if (!container) return;
        container.innerHTML = '';

        const posCountEl = document.getElementById('pos-hdr-count');
        if (posCountEl) posCountEl.innerText = `${(orders || []).length} ไม้`;

        if (!orders || orders.length === 0) {
            container.innerHTML = '<div class="no-positions">ไม่มี Order ค้างอยู่</div>';
            return;
        }

        orders.forEach(ord => {
            const div = document.createElement('div');
            div.className = `pos-item ${ord.type.toLowerCase()}`;
            
            const pnlVal = ord.floatingPnl !== undefined ? ord.floatingPnl : (ord.pnl || 0);
            const pnlClass = pnlVal >= 0 ? 'positive' : 'negative';
            const pnlSign = pnlVal >= 0 ? '+' : '';

            const slDisplay = ord.sl
                ? `<span class="pos-target-chip sl">SL: <b>${ord.sl}</b><button class="btn-clear-target" onclick="window.app.removeOrderSL('${ord.id}')" title="ลบเฉพาะ Stop Loss (SL)">✕</button></span>`
                : `<span class="pos-target-chip empty" onclick="window.app.openEditSLTPModal('${ord.id}')" title="เพิ่ม SL">+SL</span>`;

            const tpDisplay = ord.tp
                ? `<span class="pos-target-chip tp">TP: <b>${ord.tp}</b><button class="btn-clear-target" onclick="window.app.removeOrderTP('${ord.id}')" title="ลบเฉพาะ Take Profit (TP)">✕</button></span>`
                : `<span class="pos-target-chip empty" onclick="window.app.openEditSLTPModal('${ord.id}')" title="เพิ่ม TP">+TP</span>`;

            div.innerHTML = `
                <div class="pos-item-info" onclick="window.chartEngine.selectOrder('${ord.id}')" style="cursor: pointer;" title="คลิกเพื่อเลือกและแสดงเส้น TP/SL บนกราฟ">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                        <b>${ord.type} ${ord.symbol} (${ord.lot}L)</b>
                        <span class="pos-pnl ${pnlClass}">${pnlSign}$${pnlVal.toFixed(2)}</span>
                    </div>
                    <span>Entry: @ <b>${ord.entryPrice}</b></span>
                    <div class="pos-sl-tp-row" onclick="event.stopPropagation();">
                        ${slDisplay}
                        ${tpDisplay}
                        <button class="btn-edit-sltp" onclick="window.app.openEditSLTPModal('${ord.id}')" title="แก้ไข SL / TP (MT5 Style)">✏️</button>
                    </div>
                </div>
                <button class="btn-close-pos" onclick="window.replayEngine.closeOrder('${ord.id}')" title="ปิดออเดอร์ทันที">✕ ปิด</button>
            `;
            container.appendChild(div);
        });
    }

    // 7. Global App Helpers for UI Buttons
    window.app = {
        // Multi-Chart Grid Layout Selector State & Handlers
        currentLayout: savedLayout,

        toggleLayoutDropdown(event) {
            if (event) event.stopPropagation();
            const container = document.getElementById('custom-layout-container');
            const menu = document.getElementById('custom-layout-menu');
            if (!menu || !container) return;

            const isOpen = menu.classList.contains('visible');
            if (isOpen) {
                this.closeLayoutDropdown();
            } else {
                if (this.closeTimeframeDropdown) this.closeTimeframeDropdown();
                if (this.closeDrawingDropdown) this.closeDrawingDropdown();
                this.syncLayoutBadge(this.currentLayout || chartEngine.layout || '2x2');
                menu.classList.add('visible');
                container.classList.add('open');
            }
        },

        closeLayoutDropdown() {
            const container = document.getElementById('custom-layout-container');
            const menu = document.getElementById('custom-layout-menu');
            if (menu) menu.classList.remove('visible');
            if (container) container.classList.remove('open');
        },

        async selectLayoutOption(layout) {
            this.currentLayout = layout;
            await chartEngine.setLayout(layout);
            this.syncLayoutBadge(layout);
            this.closeLayoutDropdown();
            const layoutLabels = {
                '1x1': '1 ชาร์ต (1x1)',
                '2x1': '2 ชาร์ต (2x1)',
                '2x2': '4 ชาร์ต (2x2)',
                '4x2': '8 ชาร์ต (4x2)',
                '4x4': '16 ชาร์ต (4x4)',
                '1L-2R': 'ซ้าย 1 ขวา 2 (1L-2R)',
                '2L-1R': 'ซ้าย 2 ขวา 1 (2L-1R)',
                '1T-2B': 'บน 1 ล่าง 2 (1T-2B)',
                '2T-1B': 'บน 2 ล่าง 1 (2T-1B)',
                '1L-3R': 'ซ้าย 1 ขวา 3 (1L-3R)',
                '3L-1R': 'ซ้าย 3 ขวา 1 (3L-1R)',
                '3x1': '3 ชาร์ตเรียง (3x1)'
            };
            this.showToast(`📊 จัดวางชาร์ต: ${layoutLabels[layout] || layout}`);
        },

        changeLayout(layout) {
            this.selectLayoutOption(layout);
        },

        syncLayoutBadge(layout) {
            // 1. Render Visual Grid Geometry without text
            const visualIcon = document.getElementById('tb-layout-visual-icon');
            if (visualIcon) {
                visualIcon.className = `layout-grid-preview tb-layout-visual-icon lp-${layout}`;
                const cellCounts = {
                    '1x1': 1, '2x1': 2, '2x2': 4, '4x2': 8, '4x4': 16,
                    '1L-2R': 3, '2L-1R': 3, '1T-2B': 3, '2T-1B': 3,
                    '1L-3R': 4, '3L-1R': 4, '3x1': 3
                };
                const count = cellCounts[layout] || 4;
                visualIcon.innerHTML = Array(count).fill('<div class="lp-cell"></div>').join('');
            }

            // 2. Optional text badge update (for backwards-compatibility or hidden mirrors)
            const badge = document.getElementById('tb-current-layout-badge');
            const layoutLabels = {
                '1x1': '1 ชาร์ต (1x1)',
                '2x1': '2 ชาร์ต (2x1)',
                '2x2': '4 ชาร์ต (2x2)',
                '4x2': '8 ชาร์ต (4x2)',
                '4x4': '16 ชาร์ต (4x4)',
                '1L-2R': 'ซ้าย 1 ขวา 2',
                '2L-1R': 'ซ้าย 2 ขวา 1',
                '1T-2B': 'บน 1 ล่าง 2',
                '2T-1B': 'บน 2 ล่าง 1',
                '1L-3R': 'ซ้าย 1 ขวา 3',
                '3L-1R': 'ซ้าย 3 ขวา 1',
                '3x1': '3 ชาร์ต (3x1)'
            };
            if (badge) {
                badge.innerText = layoutLabels[layout] || layout;
            }

            // 3. Highlight active layout option inside dropdown menu
            const items = document.querySelectorAll('.layout-card-item');
            items.forEach(el => {
                el.classList.toggle('active', el.dataset.layout === layout);
            });
        },

        // =========================================================
        // Theme Switcher Handlers (Neumorphic Dark / Light Mode)
        // =========================================================
        toggleTheme() {
            const isLight = document.body.classList.toggle('theme-light');
            const newTheme = isLight ? 'light' : 'dark';
            const sunIcon = document.getElementById('theme-icon-sun');
            const moonIcon = document.getElementById('theme-icon-moon');
            if (sunIcon && moonIcon) {
                sunIcon.style.display = isLight ? 'none' : 'inline-block';
                moonIcon.style.display = isLight ? 'inline-block' : 'none';
            }
            chartEngine.setTheme(newTheme);
            localStorage.setItem('tradingtools_theme', newTheme);
            this.showToast(isLight ? '☀️ โหมดสว่าง (Light Mode)' : '🌙 โหมดมืด (Dark Mode)');
        },

        initTheme() {
            const savedTheme = localStorage.getItem('tradingtools_theme') || 'dark';
            if (savedTheme === 'light') {
                document.body.classList.add('theme-light');
                const sunIcon = document.getElementById('theme-icon-sun');
                const moonIcon = document.getElementById('theme-icon-moon');
                if (sunIcon) sunIcon.style.display = 'none';
                if (moonIcon) moonIcon.style.display = 'inline-block';
                chartEngine.setTheme('light');
            }
        },

        // =========================================================
        // Consolidated Tools Palette (Unified Floating Menu)
        // =========================================================
        toggleToolsMenu(event) {
            if (event) event.stopPropagation();
            const container = document.getElementById('custom-tools-container') || document.getElementById('custom-draw-container');
            const menu = document.getElementById('custom-tools-palette') || document.getElementById('custom-draw-menu');
            if (!menu || !container) return;

            const isOpen = menu.classList.contains('visible') || container.classList.contains('open');
            if (isOpen) {
                this.closeToolsMenu();
            } else {
                if (this.closeLayoutDropdown) this.closeLayoutDropdown();
                if (this.closeTimeframeDropdown) this.closeTimeframeDropdown();
                menu.classList.add('visible');
                container.classList.add('open');
                this.updateToolsMenuButton();
            }
        },

        closeToolsMenu() {
            const container = document.getElementById('custom-tools-container') || document.getElementById('custom-draw-container');
            const menu = document.getElementById('custom-tools-palette') || document.getElementById('custom-draw-menu');
            if (menu) menu.classList.remove('visible');
            if (container) container.classList.remove('open');
        },

        toggleMeasureFromPalette() {
            chartEngine.toggleMeasureTool();
            this.closeToolsMenu();
            this.updateToolsMenuButton();
        },

        toggleFiboFromPalette() {
            chartEngine.toggleFibonacciTool();
            this.closeToolsMenu();
            this.updateToolsMenuButton();
        },

        selectToolFromPalette(tool) {
            if (chartEngine.activeDrawingTool === tool) {
                chartEngine.setDrawingTool(null);
            } else {
                chartEngine.setDrawingTool(tool);
            }
            this.closeToolsMenu();
            this.updateToolsMenuButton();
        },

        updateToolsMenuButton() {
            const btn = document.getElementById('btn-toggle-tools-menu') || document.getElementById('btn-toggle-drawing-menu');
            const label = document.getElementById('tb-current-tools-label') || document.getElementById('tb-current-draw-label');
            
            const toolNames = {
                'eraser': '🧹 ยางลบ',
                'pen': '🖊️ ปากกา',
                'arrow': '🏹 ลูกศร',
                'trendline': '📈 เทรนด์ไลน์',
                'horzline': '➖ แนวนอน',
                'horzray': '➡️ เรย์แนวนอน',
                'vertline': '╽ แนวตั้ง',
                'rectangle': '🟩 กล่องโซน',
                'path': '🔀 เส้นทาง',
                'text': '📝 ข้อความ',
                'long_position': '🎯 Long R:R',
                'short_position': '🎯 Short R:R',
                'price_alert': '🔔 Alert'
            };

            let isActive = false;
            let activeText = 'เครื่องมือ';

            if (chartEngine.isMeasureActive) {
                isActive = true;
                activeText = '📏 วัดระยะ';
            } else if (chartEngine.isFibonacciActive) {
                isActive = true;
                activeText = '📐 Fibo';
            } else if (chartEngine.activeDrawingTool) {
                isActive = true;
                activeText = toolNames[chartEngine.activeDrawingTool] || '🎨 วาด';
            }

            if (btn) btn.classList.toggle('active', isActive);
            if (label) label.innerText = activeText;

            // Update active states on palette cards
            const measureBtn = document.getElementById('btn-toggle-measure');
            if (measureBtn) measureBtn.classList.toggle('active', !!chartEngine.isMeasureActive);

            const fiboBtn = document.getElementById('btn-toggle-fibo');
            if (fiboBtn) fiboBtn.classList.toggle('active', !!chartEngine.isFibonacciActive);

            document.querySelectorAll('.draw-tool-item').forEach(el => {
                el.classList.toggle('active', el.dataset.tool === chartEngine.activeDrawingTool);
            });
        },

        // Legacy compatibility aliases
        toggleDrawingDropdown(event) {
            this.toggleToolsMenu(event);
        },

        closeDrawingDropdown() {
            this.closeToolsMenu();
        },

        selectDrawingTool(tool) {
            this.selectToolFromPalette(tool);
        },

        toggleDrawingToolDirect(tool) {
            this.selectToolFromPalette(tool);
        },

        clearCurrentChartDrawings() {
            chartEngine.clearAllDrawings();
            this.closeToolsMenu();
        },

        editingTextDrawing: null,
        
        openTextModal(existingData = null) {
            const modal = document.getElementById('text-annotation-modal');
            const input = document.getElementById('text-annotation-input');
            const colorInput = document.getElementById('text-annotation-color');
            const sizeInput = document.getElementById('text-annotation-size');
            
            this.editingTextDrawing = existingData;

            if (modal) {
                modal.classList.add('visible');
                modal.style.display = 'flex';
                if (input) {
                    input.value = existingData ? (existingData.text || '') : '';
                    setTimeout(() => {
                        input.focus();
                        input.select();
                    }, 80);
                }
                if (colorInput && existingData && existingData.color) {
                    colorInput.value = existingData.color;
                }
                if (sizeInput && existingData && existingData.fontSize) {
                    sizeInput.value = String(existingData.fontSize);
                }
            }
        },

        closeTextModal() {
            const modal = document.getElementById('text-annotation-modal');
            if (modal) {
                modal.classList.remove('visible');
                modal.style.display = 'none';
            }
            if (chartEngine.pendingTextCoords) {
                chartEngine.pendingTextCoords = null;
            }
            this.editingTextDrawing = null;
            chartEngine.setDrawingTool(null);
        },

        confirmTextAnnotation() {
            const input = document.getElementById('text-annotation-input');
            const colorInput = document.getElementById('text-annotation-color');
            const sizeInput = document.getElementById('text-annotation-size');
            const text = input ? input.value.trim() : '';
            const color = colorInput ? colorInput.value : '#38bdf8';
            const size = sizeInput ? parseInt(sizeInput.value) || 14 : 14;

            if (this.editingTextDrawing) {
                const { cellIndex, drawingId } = this.editingTextDrawing;
                if (text) {
                    chartEngine.updateTextAnnotation(cellIndex, drawingId, text, color, size);
                } else {
                    chartEngine.deleteDrawingById(cellIndex, drawingId);
                }
            } else {
                if (text) {
                    chartEngine.addTextAnnotation(text, color, size);
                }
            }
            this.closeTextModal();
        },

        // =========================================================
        // ฟีเจอร์ Display Mode (แสดงผลเต็มจอ ตัดเมนูออก เพิ่มพื้นที่กราฟสูงสุด)
        // =========================================================
        isDisplayMode: false,

        toggleDisplayMode() {
            if (this.isDisplayMode) {
                this.exitDisplayMode();
            } else {
                this.enterDisplayMode();
            }
        },

        enterDisplayMode() {
            this.isDisplayMode = true;
            document.body.classList.add('display-mode-active');

            // ซ่อน dropdown ที่อาจเปิดค้างอยู่
            this.closeLayoutDropdown();
            this.closeTimeframeDropdown();
            this.closeDrawingDropdown();

            // พยายามขอ Fullscreen เบราว์เซอร์เพื่อประสบการณ์เต็มหน้าจอสมบูรณ์แบบ
            try {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen();
                }
            } catch (e) {
                // Ignore fullscreen permission errors
            }

            // ทริกเกอร์ Resize และอัปเดต HUD ข้อมูลบนชาร์ต
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
                chartEngine.updateAllCountdownDisplays();
            }, 80);

            this.showToast('🖥️ เข้าสู่ Display Mode (กด Esc หรือแตะปุ่มเพื่อออก)');
        },

        exitDisplayMode() {
            this.isDisplayMode = false;
            document.body.classList.remove('display-mode-active');

            // ออกจาก Browser Fullscreen หากเปิดอยู่
            try {
                if (document.fullscreenElement || document.webkitFullscreenElement) {
                    if (document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    }
                }
            } catch (e) {
                // Ignore
            }

            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
                chartEngine.updateAllCountdownDisplays();
            }, 80);

            this.showToast('🖥️ ออกจาก Display Mode แล้ว');
        },

        // Active Chart sync & Timeframe selector state
        targetCellForTimeframe: 0,
        isTfScopeAll: false,
        isDropdownTfScopeAll: false,

        onActiveChartChanged(cell) {
            if (!cell) return;
            this.targetCellForTimeframe = cell.index;
            this.targetCellForRange = cell.index;
            this.targetCellForTick = cell.index;
            this.targetCellForSymbol = cell.index;
            this.syncTimeframeDropdown(cell.timeframe);
            if (chartEngine && chartEngine.updateActiveTitlebarPrice) {
                chartEngine.updateActiveTitlebarPrice(cell);
            }
            const analysisView = document.getElementById('view-full-analysis');
            const isAnalysisOpen = analysisView && analysisView.style.display !== 'none';
            if (!isAnalysisOpen && this.updateMarketIntelUI) {
                const sym = cell ? cell.symbol : 'XAUUSD';
                this.updateMarketIntelUI(this.marketIntelData, sym);
                if (this.fetchMarketIntelligence) {
                    this.fetchMarketIntelligence(sym);
                }
            }
        },

        focusActiveChart() {
            const active = chartEngine.getActiveChart();
            if (active && active.element) {
                active.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                active.element.classList.add('pulse-active');
                setTimeout(() => {
                    if (active.element) active.element.classList.remove('pulse-active');
                }, 800);
            }
        },

        toggleTimeframeDropdown(event) {
            if (event) event.stopPropagation();
            const container = document.getElementById('custom-tf-container');
            const menu = document.getElementById('custom-tf-menu');
            if (!menu || !container) return;

            const isOpen = menu.classList.contains('visible');
            if (isOpen) {
                this.closeTimeframeDropdown();
            } else {
                if (this.closeLayoutDropdown) this.closeLayoutDropdown();
                if (this.closeDrawingDropdown) this.closeDrawingDropdown();
                const active = chartEngine.getActiveChart();
                const targetNameEl = document.getElementById('tf-menu-target-name');
                if (targetNameEl && active) {
                    targetNameEl.innerText = `ชาร์ตที่ ${active.index + 1}: ${active.symbol} (${active.timeframe})`;
                }
                this.syncTimeframeDropdown(active ? active.timeframe : '15m');
                menu.classList.add('visible');
                container.classList.add('open');
            }
        },

        closeTimeframeDropdown() {
            const container = document.getElementById('custom-tf-container');
            const menu = document.getElementById('custom-tf-menu');
            if (menu) menu.classList.remove('visible');
            if (container) container.classList.remove('open');
        },

        setTfDropdownScope(isAll, event) {
            if (event) event.stopPropagation();
            this.isDropdownTfScopeAll = isAll;
            const activeBtn = document.getElementById('tf-menu-scope-active');
            const allBtn = document.getElementById('tf-menu-scope-all');
            if (activeBtn && allBtn) {
                activeBtn.classList.toggle('active', !isAll);
                allBtn.classList.toggle('active', isAll);
            }
        },

        async selectTimeframeMenu(tf) {
            if (this.isDropdownTfScopeAll) {
                for (const c of chartEngine.charts) {
                    await chartEngine.setCellTimeframe(c.index, tf, false);
                }
                this.showToast(`⏱️ ปรับ Timeframe เป็น ${tf} ให้กับทุกชาร์ตแล้ว`);
            } else {
                const active = chartEngine.getActiveChart();
                if (active) {
                    await chartEngine.setCellTimeframe(active.index, tf, false);
                    this.showToast(`⏱️ ชาร์ตที่ ${active.index + 1} (${active.symbol}): เปลี่ยนเป็น ${tf}`);
                }
            }
            this.syncTimeframeDropdown(tf);
            this.closeTimeframeDropdown();
        },

        async applyQuickRange(size) {
            const tfName = `R-${size}`;
            if (this.isDropdownTfScopeAll) {
                for (const c of chartEngine.charts) {
                    await chartEngine.setCellTimeframe(c.index, tfName, true, size);
                }
                this.showToast(`📐 ปรับ Range Bar (${size}) ให้กับทุกชาร์ตแล้ว`);
            } else {
                const active = chartEngine.getActiveChart();
                if (active) {
                    await chartEngine.setCellTimeframe(active.index, tfName, true, size);
                    this.showToast(`📐 ชาร์ตที่ ${active.index + 1} (${active.symbol}): ปรับ Range Bar ${size}`);
                }
            }
            this.syncTimeframeDropdown(tfName);
            this.closeTimeframeDropdown();
        },

        async applyQuickTick(ticks) {
            const tfName = `T-${ticks}`;
            if (this.isDropdownTfScopeAll) {
                for (const c of chartEngine.charts) {
                    await chartEngine.setCellTimeframe(c.index, tfName, false, 0, true, ticks);
                }
                this.showToast(`⚡ ปรับ Tick Bar (${ticks} Ticks) ให้กับทุกชาร์ตแล้ว`);
            } else {
                const active = chartEngine.getActiveChart();
                if (active) {
                    await chartEngine.setCellTimeframe(active.index, tfName, false, 0, true, ticks);
                    this.showToast(`⚡ ชาร์ตที่ ${active.index + 1} (${active.symbol}): ปรับ Tick Bar ${ticks}`);
                }
            }
            this.syncTimeframeDropdown(tfName);
            this.closeTimeframeDropdown();
        },

        async applyMenuCustomMinutes() {
            const input = document.getElementById('tf-menu-custom-min');
            const minutes = parseInt(input ? input.value : 7);
            if (!minutes || isNaN(minutes) || minutes <= 0) {
                this.showToast('⚠️ กรุณาระบุจำนวนนาทีที่ถูกต้อง');
                return;
            }
            const tf = `${minutes}m`;
            await this.selectTimeframeMenu(tf);
        },

        async selectTimeframe(tf) {
            await this.selectTimeframeMenu(tf);
        },

        syncTimeframeDropdown(tf) {
            if (!tf) return;
            // 1. Update Topbar Trigger Button Badge
            const badgeEl = document.getElementById('tb-current-tf-badge');
            if (badgeEl) {
                badgeEl.innerText = tf;
            }

            // 2. Update Header Target Name
            const targetNameEl = document.getElementById('tf-menu-target-name');
            const active = chartEngine.getActiveChart();
            if (targetNameEl && active) {
                targetNameEl.innerText = `ชาร์ตที่ ${active.index + 1}: ${active.symbol} (${tf})`;
            }

            // 3. Highlight Matching Chips in Dropdown Menu
            const normTf = String(tf).trim().toLowerCase();
            document.querySelectorAll('.tf-menu-chip').forEach(chip => {
                const chipTf = (chip.dataset.tf || chip.innerText).trim().toLowerCase();
                chip.classList.toggle('active', chipTf === normTf);
            });
            document.querySelectorAll('.tf-pro-chip').forEach(chip => {
                const chipTf = (chip.dataset.tf || chip.innerText).trim().toLowerCase();
                chip.classList.toggle('active', chipTf === normTf);
            });
        },

        openTimeframePicker(index, event) {
            if (event) event.stopPropagation();
            const active = chartEngine.getActiveChart();
            this.targetCellForTimeframe = (index !== undefined) ? index : (active ? active.index : 0);
            this.isTfScopeAll = false;

            const modal = document.getElementById('timeframe-picker-modal');
            if (!modal) return;

            const cell = chartEngine.charts[this.targetCellForTimeframe];
            const targetNameEl = document.getElementById('tf-target-cell-name');
            if (targetNameEl && cell) {
                targetNameEl.innerText = `ชาร์ตที่ ${this.targetCellForTimeframe + 1}: ${cell.symbol} (${cell.timeframe})`;
            }

            this.setTfScope(false);
            modal.classList.add('visible');
        },

        closeTimeframePicker() {
            const modal = document.getElementById('timeframe-picker-modal');
            if (modal) modal.classList.remove('visible');
        },

        setTfScope(isAll) {
            this.isTfScopeAll = isAll;
            const activeBtn = document.getElementById('tf-scope-active-btn');
            const allBtn = document.getElementById('tf-scope-all-btn');
            if (activeBtn && allBtn) {
                activeBtn.classList.toggle('active', !isAll);
                allBtn.classList.toggle('active', isAll);
            }
        },

        async selectTimeframeChip(tf) {
            if (this.isTfScopeAll) {
                for (const c of chartEngine.charts) {
                    await chartEngine.setCellTimeframe(c.index, tf, false);
                }
                this.showToast(`⏱️ ปรับ Timeframe เป็น ${tf} ให้กับทุกชาร์ตแล้ว`);
            } else {
                await chartEngine.setCellTimeframe(this.targetCellForTimeframe, tf, false);
                chartEngine.setActiveChart(this.targetCellForTimeframe);
                this.showToast(`⏱️ ปรับ Timeframe ชาร์ตที่ ${this.targetCellForTimeframe + 1} เป็น ${tf}`);
            }
            this.syncTimeframeDropdown(tf);
            this.closeTimeframePicker();
        },

        applyCustomMinute() {
            const input = document.getElementById('custom-tf-number-input');
            const minutes = parseInt(input ? input.value : 7);
            if (!minutes || isNaN(minutes) || minutes <= 0) {
                this.showToast('⚠️ กรุณาระบุจำนวนนาทีที่ถูกต้อง');
                return;
            }
            const tf = `${minutes}m`;
            this.selectTimeframeChip(tf);
        },

        // Dedicated Range Bar Modal
        targetCellForRange: 0,
        isRangeScopeAll: false,

        openRangeBarModal(index, event) {
            if (event) event.stopPropagation();
            this.closeTimeframePicker();
            const active = chartEngine.getActiveChart();
            this.targetCellForRange = (index !== undefined) ? index : (active ? active.index : 0);
            this.isRangeScopeAll = false;

            const modal = document.getElementById('range-bar-modal');
            if (!modal) return;

            const cell = chartEngine.charts[this.targetCellForRange];
            const targetNameEl = document.getElementById('range-target-cell-name');
            if (targetNameEl && cell) {
                targetNameEl.innerText = `ชาร์ตที่ ${this.targetCellForRange + 1}: ${cell.symbol}`;
            }

            this.setRangeScope(false);
            modal.classList.add('visible');
        },

        closeRangeBarModal() {
            const modal = document.getElementById('range-bar-modal');
            if (modal) modal.classList.remove('visible');
        },

        setRangeScope(isAll) {
            this.isRangeScopeAll = isAll;
            const activeBtn = document.getElementById('range-scope-active-btn');
            const allBtn = document.getElementById('range-scope-all-btn');
            if (activeBtn && allBtn) {
                activeBtn.classList.toggle('active', !isAll);
                allBtn.classList.toggle('active', isAll);
            }
        },

        async saveRangeBar() {
            const input = document.getElementById('range-bar-size-input');
            const size = parseFloat(input ? input.value : 2.0);
            if (!size || isNaN(size) || size <= 0) {
                this.showToast('⚠️ กรุณาระบุขนาด Range Bar ที่ถูกต้อง');
                return;
            }

            const tfName = `R-${size}`;
            if (this.isRangeScopeAll) {
                for (const c of chartEngine.charts) {
                    await chartEngine.setCellTimeframe(c.index, tfName, true, size);
                }
                this.showToast(`📐 ปรับ Range Bar (${size}) ให้กับทุกชาร์ตแล้ว`);
            } else {
                await chartEngine.setCellTimeframe(this.targetCellForRange, tfName, true, size);
                chartEngine.setActiveChart(this.targetCellForRange);
                this.showToast(`📐 ปรับ Range Bar ชาร์ตที่ ${this.targetCellForRange + 1} เป็น ${size}`);
            }
            this.syncTimeframeDropdown(tfName);
            this.closeRangeBarModal();
        },

        // Dedicated Tick Bar Modal
        targetCellForTick: 0,
        isTickScopeAll: false,

        openTickBarModal(index, event) {
            if (event) event.stopPropagation();
            this.closeTimeframePicker();
            const active = chartEngine.getActiveChart();
            this.targetCellForTick = (index !== undefined) ? index : (active ? active.index : 0);
            this.isTickScopeAll = false;

            const modal = document.getElementById('tick-bar-modal');
            if (!modal) return;

            const cell = chartEngine.charts[this.targetCellForTick];
            const targetNameEl = document.getElementById('tick-target-cell-name');
            if (targetNameEl && cell) {
                targetNameEl.innerText = `ชาร์ตที่ ${this.targetCellForTick + 1}: ${cell.symbol}`;
            }

            this.setTickScope(false);
            modal.classList.add('visible');
        },

        closeTickBarModal() {
            const modal = document.getElementById('tick-bar-modal');
            if (modal) modal.classList.remove('visible');
        },

        setTickScope(isAll) {
            this.isTickScopeAll = isAll;
            const activeBtn = document.getElementById('tick-scope-active-btn');
            const allBtn = document.getElementById('tick-scope-all-btn');
            if (activeBtn && allBtn) {
                activeBtn.classList.toggle('active', !isAll);
                allBtn.classList.toggle('active', isAll);
            }
        },

        async saveTickBar() {
            const input = document.getElementById('tick-bar-count-input');
            const ticks = parseInt(input ? input.value : 250);
            if (!ticks || isNaN(ticks) || ticks <= 0) {
                this.showToast('⚠️ กรุณาระบุจำนวน Tick ที่ถูกต้อง');
                return;
            }

            const tfName = `T-${ticks}`;
            if (this.isTickScopeAll) {
                for (const c of chartEngine.charts) {
                    await chartEngine.setCellTimeframe(c.index, tfName, false, 0, true, ticks);
                }
                this.showToast(`⚡ ปรับ Tick Bar (${ticks} Ticks) ให้กับทุกชาร์ตแล้ว`);
            } else {
                await chartEngine.setCellTimeframe(this.targetCellForTick, tfName, false, 0, true, ticks);
                chartEngine.setActiveChart(this.targetCellForTick);
                this.showToast(`⚡ ปรับ Tick Bar ชาร์ตที่ ${this.targetCellForTick + 1} เป็น ${ticks} Ticks`);
            }
            this.syncTimeframeDropdown(tfName);
            this.closeTickBarModal();
        },

        // Universal Confirm Dialog (แทน native confirm())
        confirmCallback: null,
        cancelCallback: null,

        showConfirm({ title, message, confirmText, cancelText, onConfirm, onCancel }) {
            const modal = document.getElementById('confirm-dialog-modal');
            if (!modal) {
                if (window.confirm(message)) {
                    if (onConfirm) onConfirm();
                } else {
                    if (onCancel) onCancel();
                }
                return;
            }

            document.getElementById('confirm-dialog-title').innerText = title || 'ยืนยันการทำรายการ';
            document.getElementById('confirm-dialog-message').innerText = message || 'คุณแน่ใจหรือไม่ที่จะดำเนินการต่อ?';
            
            const okBtn = document.getElementById('confirm-dialog-ok-btn');
            const cancelBtn = document.getElementById('confirm-dialog-cancel-btn');
            if (okBtn) okBtn.innerText = confirmText || 'ยืนยัน';
            if (cancelBtn) cancelBtn.innerText = cancelText || 'ยกเลิก';

            this.confirmCallback = onConfirm || null;
            this.cancelCallback = onCancel || null;

            modal.classList.add('visible');
        },

        executeConfirmDialog() {
            const modal = document.getElementById('confirm-dialog-modal');
            if (modal) modal.classList.remove('visible');
            if (this.confirmCallback) {
                this.confirmCallback();
                this.confirmCallback = null;
            }
        },

        cancelConfirmDialog() {
            const modal = document.getElementById('confirm-dialog-modal');
            if (modal) modal.classList.remove('visible');
            if (this.cancelCallback) {
                this.cancelCallback();
                this.cancelCallback = null;
            }
        },

        // Universal Toast Notification
        showToast(msg) {
            if (chartEngine && chartEngine.showToast) {
                chartEngine.showToast(msg);
            }
        },

        // Topbar Toggle VP (Volume Profile)
        toggleVP() {
            const active = chartEngine.getActiveChart();
            if (active) {
                chartEngine.toggleCellVP(active.index);
                const btn = document.getElementById('btn-toggle-vp');
                const cell = chartEngine.charts[active.index];
                if (btn && cell) {
                    btn.classList.toggle('active', cell.showVolumeProfile);
                }
            }
        },

        // Independent Per-Cell Toggles
        toggleCellVolume(index) {
            if (index !== undefined && chartEngine.setActiveChart) {
                chartEngine.setActiveChart(index);
            }
            chartEngine.toggleCellVolume(index);
        },

        toggleCellVP(index) {
            if (index !== undefined && chartEngine.setActiveChart) {
                chartEngine.setActiveChart(index);
            }
            chartEngine.toggleCellVP(index);
        },

        toggleCellFootprint(index) {
            if (index !== undefined && chartEngine.setActiveChart) {
                chartEngine.setActiveChart(index);
            }
            chartEngine.toggleCellFootprint(index);
        },

        toggleCellPatterns(index) {
            if (index !== undefined && chartEngine.setActiveChart) {
                chartEngine.setActiveChart(index);
            }
            chartEngine.toggleCellPatterns(index);
        },

        // Toggle Crosshair Sync
        toggleCrosshairSync() {
            chartEngine.isCrosshairSync = !chartEngine.isCrosshairSync;
            const btn = document.getElementById('btn-toggle-crosshair');
            if (btn) btn.classList.toggle('active', chartEngine.isCrosshairSync);
        },

        // Toggle Auto-Scroll (ล็อคแท่งเทียนล่าสุดในจอเสมอ)
        toggleAutoScroll() {
            if (chartEngine && chartEngine.toggleAutoScroll) {
                chartEngine.toggleAutoScroll();
            }
        },

        // Quick Symbol Selector (แตะเลือกเปลี่ยนคู่เงินบนหัวชาร์ต)
        targetCellForSymbol: 0,
        openSymbolSelector(index, event) {
            if (event) event.stopPropagation();
            this.targetCellForSymbol = index;
            if (index !== undefined && chartEngine.setActiveChart) {
                chartEngine.setActiveChart(index);
            }
            const modal = document.getElementById('symbol-picker-modal');
            if (modal) {
                modal.classList.add('visible');
                const searchInput = document.getElementById('symbol-picker-search');
                if (searchInput) {
                    searchInput.value = '';
                    setTimeout(() => searchInput.focus(), 60);
                }
                this.renderSymbolPickerList('');
            }
        },

        closeSymbolSelector() {
            const modal = document.getElementById('symbol-picker-modal');
            if (modal) modal.classList.remove('visible');
        },

        filterSymbolPicker(query) {
            this.renderSymbolPickerList(query);
        },

        renderSymbolPickerList(query = '') {
            const listEl = document.getElementById('symbol-picker-list');
            if (!listEl) return;
            listEl.innerHTML = '';

            const allItems = watchlist.getItems();
            const filtered = allItems.filter(i => 
                i.symbol.toLowerCase().includes(query.toLowerCase()) || 
                (i.name && i.name.toLowerCase().includes(query.toLowerCase()))
            );

            if (filtered.length === 0) {
                listEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">ไม่พบคู่เงินที่ค้นหา</div>';
                return;
            }

            const currentCell = chartEngine.charts[this.targetCellForSymbol];

            filtered.forEach(item => {
                const isGold = item.symbol.includes('XAU') || item.symbol.includes('GOLD');
                const isForex = item.symbol.includes('EUR') || item.symbol.includes('GBP');
                const precision = isGold ? 3 : (isForex ? 5 : 2);

                const div = document.createElement('div');
                div.className = `symbol-picker-item ${currentCell && currentCell.symbol === item.symbol ? 'active' : ''}`;
                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="wl-flag-dot ${item.flag}"></span>
                        <div>
                            <div class="spi-symbol">${item.symbol}</div>
                            <div class="spi-name">${item.name}</div>
                        </div>
                    </div>
                    <div class="spi-price">${item.price.toFixed(precision)}</div>
                `;
                div.onclick = () => {
                    this.selectSymbolForCell(item.symbol);
                };
                listEl.appendChild(div);
            });
        },

        selectSymbolForCell(symbol) {
            chartEngine.setCellSymbol(this.targetCellForSymbol, symbol);
            this.closeSymbolSelector();
        },

        // Bar Replay Controls
        startReplayMode() {
            if (!replayEngine.isActive) {
                replayEngine.startCutMode();
            } else {
                replayEngine.exitReplay();
            }
        },

        cutBar() {
            replayEngine.startCutMode();
        },

        stepForward() {
            replayEngine.stepForward();
        },

        stepBack() {
            replayEngine.stepBack();
        },

        togglePlay() {
            replayEngine.togglePlay();
        },

        setReplaySpeed(val, el) {
            const speedMs = parseInt(val);
            replayEngine.setSpeed(speedMs);
            document.querySelectorAll('.speed-pill').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.speed) === speedMs);
            });
        },

        exitReplay() {
            replayEngine.exitReplay();
        },

        // TradingView Strategy Backtesting Stats
        openBacktestStatsModal() {
            const stats = replayEngine.getBacktestStats();
            document.getElementById('bt-net-pnl').innerText = `${stats.netProfit >= 0 ? '+' : ''}$${stats.netProfit.toFixed(2)}`;
            document.getElementById('bt-net-pnl').className = `stat-val ${stats.netProfit >= 0 ? 'pos' : 'neg'}`;
            document.getElementById('bt-winrate').innerText = `${stats.winRate}%`;
            document.getElementById('bt-pf').innerText = `${stats.profitFactor}`;
            document.getElementById('bt-max-dd').innerText = `-$${stats.maxDrawdown.toFixed(2)}`;
            document.getElementById('bt-total-trades').innerText = `${stats.totalTrades} (W: ${stats.wins} / L: ${stats.losses})`;
            document.getElementById('bt-balance').innerText = `$${stats.currentBalance.toFixed(2)}`;

            const tbody = document.getElementById('bt-trades-tbody');
            if (tbody) {
                tbody.innerHTML = '';
                if (replayEngine.tradeHistory.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 16px;">ยังไม่มีประวัติการเทรดในเซสชันนี้</td></tr>';
                } else {
                    replayEngine.tradeHistory.forEach((t, idx) => {
                        const tr = document.createElement('tr');
                        const pnlClass = t.pnl >= 0 ? 'pos' : 'neg';
                        const reasonBadge = t.reason === 'HIT TP' ? '<span style="color:#089981; font-weight:700;">🎯 ชน TP</span>' : (t.reason === 'HIT SL' ? '<span style="color:#f23645; font-weight:700;">🛑 ชน SL</span>' : '<span style="color:var(--text-muted);">ปิดมือ</span>');
                        tr.innerHTML = `
                            <td>${replayEngine.tradeHistory.length - idx}</td>
                            <td><span class="badge ${t.type.toLowerCase()}">${t.type}</span></td>
                            <td><b>${t.symbol}</b></td>
                            <td>${t.lot}</td>
                            <td>${t.entryPrice}</td>
                            <td>${t.exitPrice}</td>
                            <td class="${pnlClass}" style="font-weight:700;">${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}</td>
                            <td>${reasonBadge}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }
            document.getElementById('backtest-stats-modal').classList.add('visible');
        },

        closeBacktestStatsModal() {
            document.getElementById('backtest-stats-modal').classList.remove('visible');
        },

        resetBacktestSession() {
            this.showConfirm({
                title: 'รีเซ็ตผลการซ้อมเทรด Backtest',
                message: 'ต้องการล้างผลการซ้อมเทรดในเซสชันนี้เพื่อเริ่มต้นใหม่ใช่หรือไม่? (ประวัติและสถิติจะถูกเคลียร์)',
                confirmText: 'ล้างข้อมูล',
                cancelText: 'ยกเลิก',
                onConfirm: () => {
                    replayEngine.resetBacktestSession();
                    this.openBacktestStatsModal();
                    this.showToast('🧹 เคลียร์สถิติการ Backtest เรียบร้อยแล้ว');
                }
            });
        },

        // Measure Tool (เครื่องมือวัดระยะ)
        toggleMeasureTool(cellIndex) {
            if (cellIndex !== undefined && chartEngine.setActiveChart) {
                chartEngine.setActiveChart(cellIndex);
            }
            chartEngine.toggleMeasureTool();
        },

        clearMeasurement(cellIndex) {
            if (cellIndex !== undefined) {
                chartEngine.clearCellMeasurement(cellIndex);
            } else {
                chartEngine.clearAllMeasurements();
            }
        },

        // Fibonacci Retracement Tool (เครื่องมือฟีโบนักชี)
        toggleFibonacciTool(cellIndex) {
            if (cellIndex !== undefined && chartEngine.setActiveChart) {
                chartEngine.setActiveChart(cellIndex);
            }
            chartEngine.toggleFibonacciTool();
        },

        clearFibonacci(cellIndex) {
            if (cellIndex !== undefined) {
                chartEngine.clearCellFibonacci(cellIndex);
            } else {
                chartEngine.clearAllFibonacci();
            }
        },

        // ซ่อน / แสดง ภาพวาดและเครื่องมือทั้งหมดบนชาร์ต
        toggleHideDrawings(cellIndex) {
            if (chartEngine && chartEngine.toggleHideDrawings) {
                chartEngine.toggleHideDrawings(cellIndex);
            }
        },

        // Account Balance & Leverage Settings Modal
        openAccountModal() {
            const modal = document.getElementById('account-settings-modal');
            if (!modal) return;
            document.getElementById('setting-balance-input').value = replayEngine.balance || 10000;
            document.getElementById('setting-leverage-select').value = replayEngine.leverage || 500;
            modal.classList.add('visible');
        },

        closeAccountModal() {
            const modal = document.getElementById('account-settings-modal');
            if (modal) modal.classList.remove('visible');
        },

        saveAccountSettings() {
            const bal = parseFloat(document.getElementById('setting-balance-input').value);
            const lev = parseInt(document.getElementById('setting-leverage-select').value);
            replayEngine.setAccountSettings(bal, lev);
            this.closeAccountModal();
        },

        // Edit SL/TP Modal (MT5 Style)
        openEditSLTPModal(orderId) {
            const order = replayEngine.openOrders.find(o => o.id === orderId);
            if (!order) return;

            document.getElementById('edit-sltp-order-id').value = order.id;
            document.getElementById('edit-order-sl').value = order.sl || '';
            document.getElementById('edit-order-tp').value = order.tp || '';

            const pnlVal = order.floatingPnl !== undefined ? order.floatingPnl : (order.pnl || 0);
            const pnlColor = pnlVal >= 0 ? '#4ade80' : '#f87171';
            const sign = pnlVal >= 0 ? '+' : '';

            document.getElementById('edit-sltp-order-summary').innerHTML = `
                <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 4px;">
                    <span style="color: ${order.type === 'BUY' ? '#4ade80' : '#f87171'};">${order.type} ${order.symbol} (${order.lot} Lot)</span>
                    <span style="color: ${pnlColor};">${sign}$${pnlVal.toFixed(2)}</span>
                </div>
                <div style="color: var(--text-secondary); font-size: 11px;">
                    ราคาเปิด: <b>${order.entryPrice}</b> | SL ปัจจุบัน: <b>${order.sl || '-'}</b> | TP ปัจจุบัน: <b>${order.tp || '-'}</b>
                </div>
            `;

            const modal = document.getElementById('edit-sltp-modal');
            if (modal) modal.classList.add('visible');
        },

        closeEditSLTPModal() {
            const modal = document.getElementById('edit-sltp-modal');
            if (modal) modal.classList.remove('visible');
        },

        setEditQuickRR(ratio) {
            document.querySelectorAll('#edit-sltp-modal .btn-rr-chip').forEach(btn => btn.classList.remove('active'));
            if (window.event && window.event.currentTarget) {
                window.event.currentTarget.classList.add('active');
            }

            const orderId = document.getElementById('edit-sltp-order-id').value;
            const order = replayEngine.openOrders.find(o => o.id === orderId);
            if (!order) return;

            const isGold = order.symbol.includes('XAU') || order.symbol.includes('GOLD');
            const isForex = order.symbol.includes('EUR') || order.symbol.includes('GBP') || order.symbol.includes('JPY') || order.symbol.includes('AUD');
            const decimals = isGold ? 3 : (isForex ? 5 : 2);

            let slVal = parseFloat(document.getElementById('edit-order-sl').value);
            if (isNaN(slVal) || slVal <= 0) {
                slVal = order.sl || (order.type === 'BUY' ? order.entryPrice - (isGold ? 3 : 0.003) : order.entryPrice + (isGold ? 3 : 0.003));
                document.getElementById('edit-order-sl').value = Number(slVal.toFixed(decimals));
            }

            // ถ้า SL เป็นราคาจริง
            if (slVal > order.entryPrice * 0.5 && slVal < order.entryPrice * 1.5) {
                const dist = Math.abs(order.entryPrice - slVal);
                const tpPrice = order.type === 'BUY' ? order.entryPrice + (dist * ratio) : order.entryPrice - (dist * ratio);
                document.getElementById('edit-order-tp').value = Number(tpPrice.toFixed(decimals));
            } else {
                const tpDist = Number((slVal * ratio).toFixed(isForex ? 1 : 2));
                document.getElementById('edit-order-tp').value = tpDist;
            }
        },

        saveEditSLTP() {
            const orderId = document.getElementById('edit-sltp-order-id').value;
            const slInput = document.getElementById('edit-order-sl').value.trim();
            const tpInput = document.getElementById('edit-order-tp').value.trim();

            replayEngine.updateOrderSLTP(orderId, slInput !== '' ? slInput : null, tpInput !== '' ? tpInput : null);
            this.closeEditSLTPModal();
        },

        removeOrderTP(orderId) {
            replayEngine.removeOrderTP(orderId);
        },

        removeOrderSL(orderId) {
            replayEngine.removeOrderSL(orderId);
        },

        clearEditSL() {
            const input = document.getElementById('edit-order-sl');
            if (input) input.value = '';
        },

        clearEditTP() {
            const input = document.getElementById('edit-order-tp');
            if (input) input.value = '';
        },

        // Virtual Trading Pad Quick R:R
        setQuickRR(ratio) {
            document.querySelectorAll('.trading-pad .btn-rr-chip').forEach(btn => btn.classList.remove('active'));
            if (window.event && window.event.currentTarget) {
                window.event.currentTarget.classList.add('active');
            }

            const active = chartEngine.getActiveChart();
            const symbol = active ? active.symbol : 'XAUUSD';
            const curPrice = chartEngine.getCurrentPrice(symbol) || 4270;
            const isGold = symbol.includes('XAU') || symbol.includes('GOLD');
            const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('AUD');
            const decimals = isGold ? 3 : (isForex ? 5 : 2);

            let slVal = parseFloat(document.getElementById('order-sl').value);
            if (isNaN(slVal) || slVal <= 0) {
                slVal = isGold ? 3.0 : (isForex ? 30 : 50);
                document.getElementById('order-sl').value = slVal;
            }

            // ถ้าผู้ใช้กรอกเป็นราคาจริง
            if (slVal > curPrice * 0.5 && slVal < curPrice * 1.5) {
                const dist = Math.abs(curPrice - slVal);
                const tpPrice = curPrice + (dist * ratio);
                document.getElementById('order-tp').value = Number(tpPrice.toFixed(decimals));
            } else {
                const tpVal = Number((slVal * ratio).toFixed(isForex ? 1 : 2));
                document.getElementById('order-tp').value = tpVal;
            }
        },

        placeOrder(type) {
            const active = chartEngine.getActiveChart();
            if (!active) return;
            const curPrice = chartEngine.getCurrentPrice(active.symbol);
            if (!curPrice) return;

            const lot = parseFloat(document.getElementById('order-lot').value) || 0.1;
            const slInput = document.getElementById('order-sl').value.trim();
            const tpInput = document.getElementById('order-tp').value.trim();

            replayEngine.placeOrder({
                type,
                symbol: active.symbol,
                lot,
                sl: slInput !== '' ? slInput : null,
                tp: tpInput !== '' ? tpInput : null
            });
        },

        // ==========================================
        // Indicator Modal & Active Indicators Manager
        // ==========================================
        openIndicatorModal(cellIndex = chartEngine.activeChartIndex) {
            const cell = chartEngine.charts[cellIndex] || chartEngine.getActiveChart();
            const realIdx = cell ? cell.index : 0;
            const targetCell = chartEngine.charts[realIdx];

            const modal = document.getElementById('indicator-modal');
            if (!modal) return;

            document.getElementById('modal-target-cell-idx').value = realIdx;
            
            const labelEl = document.getElementById('ind-modal-target-label');
            if (labelEl && targetCell) {
                labelEl.innerText = `ชาร์ตที่ ${realIdx + 1}: ${targetCell.symbol} (${targetCell.timeframe || '1h'})`;
            }

            // Sync color picker and preset chips
            this.setIndColor('#ff9800');
            this.setIndWidth(2);
            const styleSelect = document.getElementById('ind-style-select');
            if (styleSelect) styleSelect.value = 'solid';
            const periodInput = document.getElementById('ind-period-input');
            if (periodInput) periodInput.value = 14;

            this.renderActiveIndicatorsList(realIdx);
            modal.classList.add('visible');
        },

        closeIndicatorModal() {
            const modal = document.getElementById('indicator-modal');
            if (modal) modal.classList.remove('visible');
        },

        setIndColor(colorHex) {
            const colorInput = document.getElementById('ind-color-input');
            if (colorInput) colorInput.value = colorHex;

            const dots = document.querySelectorAll('.ind-color-palette .color-dot');
            dots.forEach(d => {
                if (d.getAttribute('data-color') && d.getAttribute('data-color').toLowerCase() === colorHex.toLowerCase()) {
                    d.classList.add('active');
                } else {
                    d.classList.remove('active');
                }
            });
        },

        setIndWidth(widthPx) {
            const widthInput = document.getElementById('ind-width-input');
            if (widthInput) widthInput.value = widthPx;

            const chips = document.querySelectorAll('.ind-width-chips .btn-rr-chip');
            chips.forEach(c => {
                const w = parseInt(c.getAttribute('data-width'));
                c.classList.toggle('active', w === parseInt(widthPx));
            });
        },

        setPeriodPreset(period) {
            const periodInput = document.getElementById('ind-period-input');
            if (periodInput) periodInput.value = period;

            document.querySelectorAll('#period-style-chips .btn-rr-chip').forEach(c => c.classList.remove('active'));
            if (window.event && window.event.currentTarget) {
                window.event.currentTarget.classList.add('active');
            }
        },

        setPSARPreset(step, max) {
            const stepInput = document.getElementById('ind-psar-step-input');
            const maxInput = document.getElementById('ind-psar-max-input');
            if (stepInput) stepInput.value = step;
            if (maxInput) maxInput.value = max;

            document.querySelectorAll('#ind-psar-params-group .btn-rr-chip').forEach(c => c.classList.remove('active'));
            if (window.event && window.event.currentTarget) {
                window.event.currentTarget.classList.add('active');
            }
        },

        onIndTypeChange(type) {
            const periodGroup = document.getElementById('ind-period-params-group');
            const psarGroup = document.getElementById('ind-psar-params-group');
            const styleSelect = document.getElementById('ind-style-select');
            const styleContainer = document.getElementById('ind-style-container');
            const widthLabel = document.getElementById('ind-width-label');

            if (type === 'PSAR') {
                if (periodGroup) periodGroup.style.display = 'none';
                if (psarGroup) psarGroup.style.display = 'block';
                if (styleContainer) styleContainer.style.display = 'none';
                if (widthLabel) widthLabel.textContent = 'ขนาดจุด (Dot Size):';
                this.setIndColor('#22c55e');
            } else {
                if (periodGroup) periodGroup.style.display = 'block';
                if (psarGroup) psarGroup.style.display = 'none';
                if (styleContainer) styleContainer.style.display = 'block';
                if (widthLabel) widthLabel.textContent = 'ขนาดเส้น (Line Width):';

                const periodInput = document.getElementById('ind-period-input');
                if (type === 'SMA') {
                    if (periodInput) periodInput.value = 20;
                    this.setIndColor('#ff9800');
                    if (styleSelect) styleSelect.value = 'solid';
                } else if (type === 'EMA') {
                    if (periodInput) periodInput.value = 20;
                    this.setIndColor('#38bdf8');
                    if (styleSelect) styleSelect.value = 'solid';
                } else if (type === 'RSI') {
                    if (periodInput) periodInput.value = 14;
                    this.setIndColor('#a855f7');
                    if (styleSelect) styleSelect.value = 'solid';
                }
            }
        },

        renderActiveIndicatorsList(cellIndex) {
            const listEl = document.getElementById('active-indicators-list');
            if (!listEl) return;
            listEl.innerHTML = '';

            const cell = chartEngine.charts[cellIndex];
            const indicators = (cell && cell.indicators) ? cell.indicators : [];

            if (indicators.length === 0) {
                listEl.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 12px 0;">
                        ยังไม่มี Indicator บนชาร์ตนี้
                    </div>
                `;
                return;
            }

            const styleLabels = {
                'solid': 'เส้นทึบ (Solid)',
                'dashed': 'เส้นประ (Dashed)',
                'dotted': 'เส้นจุด (Dotted)',
                'large_dashed': 'เส้นประยาว (Large Dashed)'
            };

            indicators.forEach(ind => {
                const item = document.createElement('div');
                item.className = 'active-ind-item';
                
                const styleName = styleLabels[ind.lineStyle] || ind.lineStyle || 'Solid';
                const subIndLabel = ind.parentIndicatorId ? `<span style="font-size:9px; color:#38bdf8; background:rgba(56,189,248,0.12); padding:1px 5px; border-radius:4px; margin-left:4px;">ซ้อนบน Indicator</span>` : '';
                const indTitle = ind.title || (ind.type === 'PSAR' ? `PSAR (${ind.step || 0.02}, ${ind.max || 0.20})` : `${ind.type} (${ind.period || 14})`);

                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; cursor: pointer;" onclick="window.app.openIndicatorEditSubModal(${cellIndex}, '${ind.id}')" title="คลิกเพื่อปรับแต่งอินดิเคเตอร์นี้">
                        <span class="active-ind-color-badge" style="background: ${ind.color || '#38bdf8'};"></span>
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <div style="font-weight: 700; color: #fff; font-size: 11.5px; display: flex; align-items: center;">
                                <span>${indTitle}</span>
                                ${subIndLabel}
                            </div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">
                                ${ind.lineWidth || 1}px · ${styleName}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                        <button type="button" class="btn-edit-ind" onclick="window.app.openIndicatorEditSubModal(${cellIndex}, '${ind.id}')" title="เปิดหน้าต่างปรับแต่งการตั้งค่า">⚙️</button>
                        <button type="button" class="btn-del-ind" onclick="window.app.deleteIndicator(${cellIndex}, '${ind.id}')" title="ลบอินดิเคเตอร์นี้">✕</button>
                    </div>
                `;
                listEl.appendChild(item);
            });
        },

        // --------------------------------------------------
        // SUB-MODAL: Nested Indicator Quick Edit Modal (ซ้อนบนหน้า FX)
        // --------------------------------------------------
        openIndicatorEditSubModal(cellIndex, indId) {
            const cell = chartEngine.charts[cellIndex];
            if (!cell || !cell.indicators) return;
            const ind = cell.indicators.find(i => i.id === indId);
            if (!ind) return;

            const subModal = document.getElementById('indicator-edit-modal');
            if (!subModal) return;

            document.getElementById('submodal-cell-idx').value = cellIndex;
            document.getElementById('submodal-ind-id').value = ind.id;
            document.getElementById('submodal-ind-type').value = ind.type;

            const isPSAR = (ind.type === 'PSAR' || ind.type === 'SAR');
            const titleEl = document.getElementById('submodal-ind-title');
            if (titleEl) {
                titleEl.textContent = `ปรับแต่ง: ${ind.title || ind.type}`;
            }

            const periodGroup = document.getElementById('submodal-period-group');
            const psarGroup = document.getElementById('submodal-psar-group');
            const styleContainer = document.getElementById('submodal-style-container');
            const widthLabel = document.getElementById('submodal-width-label');

            if (isPSAR) {
                if (periodGroup) periodGroup.style.display = 'none';
                if (psarGroup) psarGroup.style.display = 'block';
                if (styleContainer) styleContainer.style.display = 'none';
                if (widthLabel) widthLabel.textContent = 'ขนาดจุด (Dot Size):';
                const stepInput = document.getElementById('submodal-psar-step');
                const maxInput = document.getElementById('submodal-psar-max');
                if (stepInput) stepInput.value = ind.step || 0.02;
                if (maxInput) maxInput.value = ind.max || 0.20;
            } else {
                if (periodGroup) periodGroup.style.display = 'block';
                if (psarGroup) psarGroup.style.display = 'none';
                if (styleContainer) styleContainer.style.display = 'block';
                if (widthLabel) widthLabel.textContent = 'ขนาดเส้น (Line Width):';
                const periodInput = document.getElementById('submodal-period-input');
                if (periodInput) periodInput.value = ind.period || 14;
            }

            this.setSubModalColor(ind.color || '#38bdf8');
            this.setSubModalWidth(ind.lineWidth || 1);

            const styleSelect = document.getElementById('submodal-style-select');
            if (styleSelect) {
                styleSelect.value = ind.lineStyle || (isPSAR ? 'dotted' : 'solid');
            }

            subModal.classList.add('visible');
        },

        closeIndicatorEditSubModal() {
            const subModal = document.getElementById('indicator-edit-modal');
            if (subModal) subModal.classList.remove('visible');
        },

        setSubModalColor(colorHex) {
            const colorInput = document.getElementById('submodal-color-input');
            if (colorInput) colorInput.value = colorHex;

            const dots = document.querySelectorAll('#indicator-edit-modal .sub-dot');
            dots.forEach(d => {
                const c = d.getAttribute('data-color');
                d.classList.toggle('active', c && c.toLowerCase() === colorHex.toLowerCase());
            });
        },

        setSubModalWidth(widthPx) {
            const widthInput = document.getElementById('submodal-width-input');
            if (widthInput) widthInput.value = widthPx;

            const chips = document.querySelectorAll('#indicator-edit-modal .sub-w-chip');
            chips.forEach(c => {
                const w = parseInt(c.getAttribute('data-width'));
                c.classList.toggle('active', w === parseInt(widthPx));
            });
        },

        setSubModalPeriod(period) {
            const periodInput = document.getElementById('submodal-period-input');
            if (periodInput) periodInput.value = period;
        },

        setSubModalPSAR(step, max) {
            const stepInput = document.getElementById('submodal-psar-step');
            const maxInput = document.getElementById('submodal-psar-max');
            if (stepInput) stepInput.value = step;
            if (maxInput) maxInput.value = max;
        },

        saveIndicatorEditFromSubModal() {
            const cellIdx = parseInt(document.getElementById('submodal-cell-idx').value) || 0;
            const indId = document.getElementById('submodal-ind-id').value;
            const indType = document.getElementById('submodal-ind-type').value;

            const color = document.getElementById('submodal-color-input').value || '#38bdf8';
            const lineWidth = parseInt(document.getElementById('submodal-width-input').value) || 1;
            const lineStyle = document.getElementById('submodal-style-select').value || 'solid';

            const updatedConfig = {
                color,
                lineWidth,
                lineStyle
            };

            const isPSAR = (indType === 'PSAR' || indType === 'SAR');
            if (isPSAR) {
                const step = parseFloat(document.getElementById('submodal-psar-step').value) || 0.02;
                const max = parseFloat(document.getElementById('submodal-psar-max').value) || 0.20;
                updatedConfig.step = step;
                updatedConfig.max = max;
                updatedConfig.title = `PSAR (${step}, ${max})`;
            } else {
                const period = parseInt(document.getElementById('submodal-period-input').value) || 14;
                updatedConfig.period = period;
                updatedConfig.title = `${indType} (${period})`;
            }

            chartEngine.updateIndicator(cellIdx, indId, updatedConfig);
            this.renderActiveIndicatorsList(cellIdx);
            this.closeIndicatorEditSubModal();
        },

        loadIndicatorForEdit(cellIndex, indId) {
            this.openIndicatorEditSubModal(cellIndex, indId);
        },

        deleteIndicator(cellIndex, indId) {
            chartEngine.removeIndicator(cellIndex, indId);
            this.renderActiveIndicatorsList(cellIndex);
        },

        applyIndicator() {
            const cellIdx = parseInt(document.getElementById('modal-target-cell-idx').value) || 0;
            const type = document.getElementById('ind-type-select').value;
            const color = document.getElementById('ind-color-input').value || '#38bdf8';
            const lineWidth = parseInt(document.getElementById('ind-width-input').value) || 1;
            const lineStyle = document.getElementById('ind-style-select').value || (type === 'PSAR' ? 'dotted' : 'solid');
            const isSubInd = document.getElementById('ind-on-ind-check').checked;
            const parentIndType = document.getElementById('parent-ind-select').value;

            const config = {
                type,
                color,
                lineWidth,
                lineStyle
            };

            if (type === 'PSAR') {
                const step = parseFloat(document.getElementById('ind-psar-step-input').value) || 0.02;
                const max = parseFloat(document.getElementById('ind-psar-max-input').value) || 0.20;
                config.step = step;
                config.max = max;
                config.title = `PSAR (${step}, ${max})`;
            } else {
                const period = parseInt(document.getElementById('ind-period-input').value) || 14;
                config.period = period;
                config.title = `${type} (${period})`;
            }

            // หากเลือก "Indicator on Indicator"
            if (isSubInd) {
                const cell = chartEngine.charts[cellIdx];
                const parent = cell ? cell.indicators.find(i => i.type === parentIndType) : null;
                if (parent) {
                    config.parentIndicatorId = parent.id;
                    config.title = `${type} on ${parentIndType}`;
                }
            }

            chartEngine.addIndicator(cellIdx, config);
            this.renderActiveIndicatorsList(cellIdx);
        },

        applyStylePreset(presetKey) {
            const cellIdx = parseInt(document.getElementById('modal-target-cell-idx').value) || 0;
            chartEngine.applyIndicatorPreset(cellIdx, presetKey, true);
            this.renderActiveIndicatorsList(cellIdx);
        },

        clearChartIndicators() {
            const cellIdx = parseInt(document.getElementById('modal-target-cell-idx').value) || 0;
            this.showConfirm({
                title: 'ล้างอินดิเคเตอร์ทั้งหมด',
                message: `ต้องการลบอินดิเคเตอร์ทั้งหมดออกจากชาร์ตที่ ${cellIdx + 1} ใช่หรือไม่?`,
                confirmText: 'ล้างทั้งหมด',
                cancelText: 'ยกเลิก',
                onConfirm: () => {
                    chartEngine.clearChartIndicators(cellIdx);
                    this.renderActiveIndicatorsList(cellIdx);
                }
            });
        },

        // Journal Modal & Calendar
        openJournalModal() {
            document.getElementById('journal-modal').classList.add('visible');
            this.renderJournal();
        },

        closeJournalModal() {
            document.getElementById('journal-modal').classList.remove('visible');
        },

        renderJournal() {
            // Stats
            const stats = journal.getStats();
            document.getElementById('j-winrate').innerText = `${stats.winRate}%`;
            document.getElementById('j-pnl').innerText = `$${stats.netPnL}`;
            document.getElementById('j-pnl').className = stats.netPnL >= 0 ? 'stat-val pos' : 'stat-val neg';
            document.getElementById('j-pf').innerText = stats.profitFactor;
            document.getElementById('j-trades').innerText = stats.totalTrades;

            // Calendar
            this.renderCalendar();

            // Trade Log Table
            const tbody = document.getElementById('journal-table-body');
            tbody.innerHTML = '';
            journal.trades.forEach(t => {
                const tr = document.createElement('tr');
                const pnlClass = t.pnl >= 0 ? 'pos' : 'neg';
                tr.innerHTML = `
                    <td>${new Date(t.date).toLocaleDateString()}</td>
                    <td><b>${t.symbol}</b></td>
                    <td><span class="badge ${t.type.toLowerCase()}">${t.type}</span></td>
                    <td>${t.lot}</td>
                    <td class="${pnlClass}"><b>$${t.pnl}</b></td>
                    <td>${t.rr ? t.rr + 'R' : '-'}</td>
                    <td><span class="emotion-chip ${t.emotion}">${t.emotion || '-'}</span></td>
                    <td>${t.notes || '-'}</td>
                    <td><button class="btn-del-trade" onclick="window.app.deleteJournalTrade('${t.id}')">✕</button></td>
                `;
                tbody.appendChild(tr);
            });
        },

        deleteJournalTrade(id) {
            this.showConfirm({
                title: 'ลบรายการเทรด',
                message: 'ต้องการลบประวัติการเทรดนี้ออกจาก Journal ใช่หรือไม่?',
                confirmText: 'ลบรายการ',
                cancelText: 'ยกเลิก',
                onConfirm: () => {
                    journal.deleteTrade(id);
                    this.renderJournal();
                    this.showToast('🗑️ ลบรายการเทรดเรียบร้อยแล้ว');
                }
            });
        },

        renderCalendar() {
            const calGrid = document.getElementById('journal-calendar-grid');
            if (!calGrid) return;
            calGrid.innerHTML = '';

            const now = new Date(journal.currentYear, journal.currentMonth, 1);
            const firstDayIndex = now.getDay();
            const daysInMonth = new Date(journal.currentYear, journal.currentMonth + 1, 0).getDate();

            document.getElementById('calendar-month-label').innerText = now.toLocaleString('th-TH', { month: 'long', year: 'numeric' });

            const dailyData = journal.getMonthCalendarData();

            // Empty padding days
            for (let i = 0; i < firstDayIndex; i++) {
                const empty = document.createElement('div');
                empty.className = 'cal-day empty';
                calGrid.appendChild(empty);
            }

            // Actual days
            for (let d = 1; d <= daysInMonth; d++) {
                const cell = document.createElement('div');
                cell.className = 'cal-day';
                const dayData = dailyData[d];

                if (dayData) {
                    const pnlClass = dayData.pnl >= 0 ? 'pos' : 'neg';
                    cell.classList.add(pnlClass);
                    cell.innerHTML = `
                        <span class="cal-day-num">${d}</span>
                        <div class="cal-day-pnl ${pnlClass}">$${dayData.pnl.toFixed(0)}</div>
                        <div class="cal-day-trades">${dayData.count} ไม้</div>
                    `;
                } else {
                    cell.innerHTML = `<span class="cal-day-num">${d}</span>`;
                }
                calGrid.appendChild(cell);
            }
        },

        saveNewTrade() {
            const symbol = document.getElementById('add-trade-symbol').value;
            const type = document.getElementById('add-trade-type').value;
            const lot = parseFloat(document.getElementById('add-trade-lot').value) || 0.1;
            const pnl = parseFloat(document.getElementById('add-trade-pnl').value) || 0;
            const rr = parseFloat(document.getElementById('add-trade-rr').value) || 1.0;
            const emotion = document.getElementById('add-trade-emotion').value;
            const notes = document.getElementById('add-trade-notes').value;

            journal.addTrade({
                symbol,
                type,
                lot,
                pnl,
                rr,
                emotion,
                notes
            });

            this.renderJournal();
            this.showToast('💾 บันทึกผลการเทรดสำเร็จ!');
        },

        // Sidebar Toggle (ยุบ/ขยายเพื่อเพิ่มพื้นที่กราฟ)
        toggleSidebar() {
            const workspace = document.querySelector('.workspace');
            const tabBtn = document.getElementById('sidebar-tab-btn');
            const isCollapsed = workspace.classList.toggle('sidebar-collapsed');
            if (tabBtn) {
                tabBtn.innerText = isCollapsed ? '◀' : '▶';
                tabBtn.title = isCollapsed ? 'ขยาย Sidebar' : 'ยุบ Sidebar';
            }
            const tbBtn = document.getElementById('btn-toggle-sidebar');
            if (tbBtn) {
                tbBtn.classList.toggle('active', !isCollapsed);
            }
            // Trigger chart resize across all cells
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 260);
        },

        // AI Coach Modal
        openAICoach() {
            document.getElementById('ai-coach-modal').classList.add('visible');
            const promptText = journal.generateAICoachPrompt();
            document.getElementById('ai-coach-prompt-box').value = promptText;
        },

        closeAICoach() {
            document.getElementById('ai-coach-modal').classList.remove('visible');
        },

        // ==========================================
        // Watchlist Management Methods
        // ==========================================
        toggleWatchlistCollapse(forceState) {
            const sidebar = document.getElementById('app-sidebar') || document.querySelector('.sidebar');
            if (!sidebar) return;
            const isCurrentlyCollapsed = sidebar.classList.contains('watchlist-collapsed');
            const targetCollapsed = forceState !== undefined ? forceState : !isCurrentlyCollapsed;
            sidebar.classList.toggle('watchlist-collapsed', targetCollapsed);

            const arrow = document.getElementById('wl-collapse-arrow');
            if (arrow) {
                arrow.innerText = targetCollapsed ? '▸' : '▾';
            }

            const btnIcon = document.getElementById('btn-collapse-wl-icon');
            if (btnIcon) {
                btnIcon.innerText = targetCollapsed ? '▼' : '▲';
            }

            const headerTitle = document.getElementById('wl-header-title');
            if (headerTitle) {
                headerTitle.innerText = 'รายการเฝ้าดู';
            }

            try {
                localStorage.setItem('tradingtools_watchlist_collapsed', targetCollapsed ? 'true' : 'false');
            } catch (e) {}

            this.showToast(targetCollapsed ? '📂 ยุบรายการเฝ้าดู: ขยาย Trade Pad เต็มพื้นที่แล้ว' : '📋 ขยายรายการเฝ้าดูแล้ว');
        },

        toggleWatchlistCompact() {
            const isCompact = watchlist.toggleCompact();
            renderWatchlistItems();
            this.showToast(isCompact ? '📋 สลับสู่โหมดมุมมองกระชับ (Compact View)' : '📋 สลับสู่โหมดมุมมองปกติ (Standard View)');
        },

        openWatchlistModal() {
            const modal = document.getElementById('watchlist-manage-modal');
            if (!modal) return;
            this.renderWatchlistManageModal();
            modal.classList.add('visible');
            const input = document.getElementById('add-watchlist-input');
            if (input) {
                input.value = '';
                setTimeout(() => input.focus(), 60);
            }
        },

        closeWatchlistModal() {
            const modal = document.getElementById('watchlist-manage-modal');
            if (modal) modal.classList.remove('visible');
        },

        renderWatchlistManageModal() {
            // 1. Render Quick Add Presets
            const presetContainer = document.getElementById('watchlist-quick-presets');
            if (presetContainer) {
                presetContainer.innerHTML = '';
                const currentSymbols = new Set((watchlist.getItems() || []).map(i => i.symbol));
                (watchlist.availablePresets || []).forEach(p => {
                    const isAdded = currentSymbols.has(p.symbol);
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = `btn-rr-chip ${isAdded ? 'active' : ''}`;
                    btn.style.fontSize = '10.5px';
                    btn.style.padding = '3px 8px';
                    btn.innerHTML = `${isAdded ? '✓ ' : '+ '}${p.symbol}`;
                    btn.title = `${p.name} (${p.category})`;
                    btn.onclick = () => {
                        if (isAdded) {
                            this.removeWatchlistSymbol(p.symbol);
                        } else {
                            this.addPresetSymbol(p.symbol);
                        }
                    };
                    presetContainer.appendChild(btn);
                });
            }

            // 2. Render Current Items List with Reorder / Delete / Flags
            const listContainer = document.getElementById('watchlist-manage-items-list');
            if (!listContainer) return;
            listContainer.innerHTML = '';

            const items = watchlist.getItems() || [];
            if (items.length === 0) {
                listContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 16px; font-size: 11px;">ไม่มีคู่สินทรัพย์ในรายการเฝ้าดู</div>';
                return;
            }

            items.forEach((item, index) => {
                if (!item) return;
                const sym = item.symbol || 'XAUUSD';
                const name = item.name || sym;
                const flag = item.flag || 'blue';

                const row = document.createElement('div');
                row.className = 'wl-manage-item-row';
                row.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                        <span class="wl-flag-dot ${flag}" onclick="window.app.cycleWatchlistFlag('${sym}')" title="คลิกเพื่อเปลี่ยนสี Flag Tag" style="cursor: pointer; width: 10px; height: 10px;"></span>
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <span style="font-weight: 700; color: #fff; font-size: 12px;">${sym}</span>
                            <span style="font-size: 10px; color: var(--text-muted); margin-left: 4px;">${name}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                        <button type="button" class="btn-wl-ctrl" onclick="window.app.moveWatchlistUp(${index})" ${index === 0 ? 'disabled style="opacity: 0.3; cursor: default;"' : ''} title="เลื่อนขึ้น">▲</button>
                        <button type="button" class="btn-wl-ctrl" onclick="window.app.moveWatchlistDown(${index})" ${index === items.length - 1 ? 'disabled style="opacity: 0.3; cursor: default;"' : ''} title="เลื่อนลง">▼</button>
                        <button type="button" class="btn-wl-ctrl delete" onclick="window.app.removeWatchlistSymbol('${sym}')" title="ลบคู่นี้ออกจากรายการ">✕</button>
                    </div>
                `;
                listContainer.appendChild(row);
            });
        },

        addWatchlistSymbol() {
            const input = document.getElementById('add-watchlist-input');
            if (!input) return;
            const sym = input.value.trim().toUpperCase();
            if (!sym) return;

            const success = watchlist.addItem({ symbol: sym });
            if (success) {
                input.value = '';
                this.renderWatchlistManageModal();
                renderWatchlistItems();
                this.showToast(`✓ เพิ่ม ${sym} ในรายการเฝ้าดูแล้ว`);
            } else {
                this.showToast(`⚠️ ${sym} มีอยู่ในรายการเฝ้าดูแล้ว`);
            }
        },

        addPresetSymbol(symbol) {
            const success = watchlist.addItem({ symbol: symbol });
            if (success) {
                this.renderWatchlistManageModal();
                renderWatchlistItems();
                this.showToast(`✓ เพิ่ม ${symbol} ในรายการเฝ้าดูแล้ว`);
            }
        },

        removeWatchlistSymbol(symbol) {
            watchlist.removeItem(symbol);
            this.renderWatchlistManageModal();
            renderWatchlistItems();
            this.showToast(`🗑️ ลบ ${symbol} ออกจากรายการเฝ้าดูแล้ว`);
        },

        moveWatchlistUp(index) {
            watchlist.moveUp(index);
            this.renderWatchlistManageModal();
            renderWatchlistItems();
        },

        moveWatchlistDown(index) {
            watchlist.moveDown(index);
            this.renderWatchlistManageModal();
            renderWatchlistItems();
        },

        cycleWatchlistFlag(symbol) {
            const flags = ['red', 'blue', 'green', 'yellow', 'purple', 'none'];
            const item = watchlist.getItems().find(i => i.symbol === symbol);
            if (!item) return;
            const currentIdx = flags.indexOf(item.flag || 'none');
            const nextFlag = flags[(currentIdx + 1) % flags.length];
            watchlist.setFlag(symbol, nextFlag);
            this.renderWatchlistManageModal();
            renderWatchlistItems();
        },

        resetWatchlistDefaults() {
            this.showConfirm({
                title: 'คืนค่ารายการเริ่มต้น',
                message: 'ต้องการคืนค่ารายการคู่สินทรัพย์ทั้งหมดกลับสู่ค่าเริ่มต้นใช่หรือไม่?',
                confirmText: 'คืนค่าเริ่มต้น',
                cancelText: 'ยกเลิก',
                onConfirm: () => {
                    watchlist.resetDefaults();
                    this.renderWatchlistManageModal();
                    renderWatchlistItems();
                    this.showToast('↺ คืนค่ารายการเฝ้าดูเริ่มต้นเรียบร้อยแล้ว');
                }
            });
        },

        // PWA App Installation Handlers
        promptInstallPWA() {
            const modal = document.getElementById('pwa-install-modal');
            if (modal) {
                const nativePrompt = document.getElementById('pwa-native-prompt');
                if (nativePrompt) {
                    nativePrompt.style.display = deferredPrompt ? 'block' : 'none';
                }
                modal.classList.add('visible');
            }
        },

        closePWAInstallModal() {
            const modal = document.getElementById('pwa-install-modal');
            if (modal) modal.classList.remove('visible');
        },

        checkIfPWAInstalled() {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                                 window.matchMedia('(display-mode: fullscreen)').matches ||
                                 window.matchMedia('(display-mode: minimal-ui)').matches ||
                                 (window.navigator.standalone === true) ||
                                 (document.referrer && document.referrer.startsWith('android-app://')) ||
                                 (localStorage.getItem('tradingtools_pwa_installed') === 'true');

            if (isStandalone) {
                this.hideInstallButton();
                return true;
            }

            // Check via getInstalledRelatedApps API (Chrome / Edge / Android)
            if ('getInstalledRelatedApps' in navigator) {
                navigator.getInstalledRelatedApps().then(relatedApps => {
                    if (relatedApps && relatedApps.length > 0) {
                        localStorage.setItem('tradingtools_pwa_installed', 'true');
                        this.hideInstallButton();
                    }
                }).catch(() => {});
            }
            return false;
        },

        hideInstallButton() {
            document.documentElement.classList.add('app-is-installed');
            const btn = document.getElementById('btn-install-pwa');
            if (btn) {
                btn.style.display = 'none';
                btn.classList.add('app-installed-hidden');
            }
        },

        async triggerPWAInstall() {
            if (!deferredPrompt) {
                this.showToast('ℹ️ กรุณาติดตั้งตามขั้นตอนด้านล่าง');
                return;
            }
            deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice && choice.outcome === 'accepted') {
                localStorage.setItem('tradingtools_pwa_installed', 'true');
                this.hideInstallButton();
                this.showToast('✨ เริ่มต้นการติดตั้งแอป...');
            }
            deferredPrompt = null;
            this.closePWAInstallModal();
        },

        async forceUpdateApp() {
            if (confirm('คุณต้องการบังคับอัปเดตระบบและโหลดฟีเจอร์เวอร์ชันล่าสุดทั้งหมดใช่หรือไม่?\n(ระบบจะเคลียร์แคชเดิมและโหลดข้อมูลใหม่อัตโนมัติ โดยที่ออเดอร์และบันทึกจะไม่สูญหาย)')) {
                try {
                    this.showToast('🔄 กำลังอัปเดตระบบและล้างแคชเก่า...');
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (const reg of registrations) {
                            await reg.unregister();
                        }
                    }
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                    }
                    localStorage.setItem('tt_app_version', APP_VERSION);
                    setTimeout(() => {
                        window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
                    }, 400);
                } catch (e) {
                    console.error('Error during force update:', e);
                    window.location.reload(true);
                }
            }
        },

        // --- Market Intelligence & Weekend Analysis Controller ---
        marketIntelData: null,
        marketIntelCache: {},

        async fetchMarketIntelligence(targetSym) {
            const analysisView = document.getElementById('view-full-analysis');
            const isAnalysisOpen = analysisView && analysisView.style.display !== 'none';
            const activeChart = (window.chartEngine && window.chartEngine.getActiveChart) ? window.chartEngine.getActiveChart() : null;
            
            let sym = targetSym;
            if (!sym) {
                sym = (isAnalysisOpen && this.activeAnalysisSymbol) ? this.activeAnalysisSymbol : (activeChart && activeChart.symbol ? activeChart.symbol : 'XAUUSD');
            }
            sym = sym.toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();
            const requestSym = sym;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1800);
                const resp = await fetch(`/api/market-intelligence?symbol=${encodeURIComponent(sym)}&t=${Date.now()}`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data && data.status === 'ok' && data.intelligence) {
                        this.marketIntelCache[requestSym] = data.intelligence;
                        // Only update live state if symbol hasn't changed in the meantime
                        if (!isAnalysisOpen || this.activeAnalysisSymbol === requestSym) {
                            this.marketIntelData = data.intelligence;
                            this.updateMarketIntelUI(data.intelligence, requestSym);
                            this.renderMarketIntelModalContent(data.intelligence, requestSym);
                        }
                        return data.intelligence;
                    }
                }
            } catch (e) {
                console.warn('[MarketIntel] Remote API unavailable or timed out, falling back to Client Engine:', e);
            }

            // Standalone Client-Side Fallback Engine (Runs even if Apache/Host returns 404 for /api/)
            if (window.SMCICTEngine && window.SMCICTEngine.generateMarketIntelClientSide) {
                const clientIntel = window.SMCICTEngine.generateMarketIntelClientSide(requestSym);
                if (clientIntel && clientIntel.intelligence) {
                    this.marketIntelCache[requestSym] = clientIntel.intelligence;
                    if (!isAnalysisOpen || this.activeAnalysisSymbol === requestSym) {
                        this.marketIntelData = clientIntel.intelligence;
                        this.updateMarketIntelUI(clientIntel.intelligence, requestSym);
                        this.renderMarketIntelModalContent(clientIntel.intelligence, requestSym);
                    }
                    return clientIntel.intelligence;
                }
            }

            return null;
        },

        updateMarketIntelUI(intel, targetSymbol) {
            intel = intel || this.marketIntelData;

            const analysisView = document.getElementById('view-full-analysis');
            const isAnalysisOpen = analysisView && analysisView.style.display !== 'none';

            // 1. Determine currently Active Symbol
            let sym = targetSymbol;
            if (!sym) {
                sym = (isAnalysisOpen && this.activeAnalysisSymbol) ? this.activeAnalysisSymbol : ((window.chartEngine && window.chartEngine.getActiveChart && window.chartEngine.getActiveChart().symbol) ? window.chartEngine.getActiveChart().symbol : 'XAUUSD');
            }
            sym = sym.toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();

            const btn = document.getElementById('btn-market-intel');
            const dot = document.getElementById('tb-intel-dot');
            const label = document.getElementById('tb-intel-label');
            const badge = document.getElementById('tb-intel-badge');

            // Popover Elements
            const popDot = document.getElementById('popover-status-dot');
            const popTitle = document.getElementById('popover-status-title');
            const popModeTag = document.getElementById('popover-mode-tag');
            const popActiveSrc = document.getElementById('popover-active-source');
            const popSourcesList = document.getElementById('popover-sources-list');
            const popFriClose = document.getElementById('popover-fri-close');
            const popPaxgPrice = document.getElementById('popover-paxg-price');
            const popGapText = document.getElementById('popover-gap-text');
            const popGapCard = document.getElementById('popover-gap-card');
            const popFooterBtn = document.getElementById('btn-popover-open-full');
            const popLabelFri = document.getElementById('popover-label-fri');
            const popLabelCurr = document.getElementById('popover-label-curr');
            const popLabelGap = document.getElementById('popover-label-gap');

            // Asset Classification
            const isCrypto = sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('BNB') || sym.includes('XRP') || sym.includes('DOGE');
            const isGold = sym.includes('XAU') || sym.includes('GOLD') || sym.includes('PAXG');
            const isSilver = sym.includes('XAG') || sym.includes('SILVER');
            const isForex = !isCrypto && !isGold && !isSilver;

            // Extract specific symbol intelligence if available in multi-symbol bundle
            let symIntel = null;
            if (intel && intel.symbols_summary && intel.symbols_summary[sym]) {
                symIntel = intel.symbols_summary[sym];
            } else if (intel && intel.active_symbol === sym) {
                symIntel = intel;
            } else if (this.marketIntelCache[sym]) {
                symIntel = this.marketIntelCache[sym];
            }

            const isWeekend = intel ? (intel.is_weekend && !isCrypto) : false;
            const gap = (symIntel && symIntel.gap_analysis) ? symIntel.gap_analysis : (intel ? intel.gap_analysis : {}) || {};

            const decimals = isGold ? 2 : (isCrypto ? (sym.includes('XRP') || sym.includes('DOGE') ? 4 : 2) : (sym.includes('JPY') ? 3 : 5));
            const formatPrice = (p) => {
                if (p === undefined || p === null || isNaN(p)) return '$--.--';
                const prefix = isForex ? '' : '$';
                return prefix + Number(p).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
            };

            const gapPts = gap.gap_points !== undefined ? gap.gap_points : 0;
            const gapPips = gap.gap_pips !== undefined ? gap.gap_pips : 0;
            const gapPct = gap.gap_percent !== undefined ? gap.gap_percent : 0;
            const sign = gapPts > 0 ? '+' : '';

            // Gap color styling
            const getGapColor = (pts) => {
                if (pts > 0) return '#34d399';
                if (pts < 0) return '#f87171';
                return '#fbbf24';
            };

            // CASE 1: CRYPTO (24/7 Live Non-Stop)
            if (isCrypto) {
                const chg24 = gap.change_24h_percent !== undefined ? gap.change_24h_percent : 0;
                const chg24Sign = chg24 > 0 ? '+' : '';
                if (btn) {
                    btn.className = 'tb-btn tb-btn-market-intel market-open';
                    btn.title = `สินทรัพย์: ${sym} (Crypto) • ตลาดเปิด 24/7 Real-time สดจาก Binance (24h: ${chg24Sign}${chg24.toFixed(2)}%)`;
                }
                if (label) label.innerText = `${chg24Sign}${chg24.toFixed(2)}% 24/7`;
                if (badge) badge.innerText = 'BINANCE';

                if (popDot) { popDot.className = 'intel-popover-dot open'; }
                if (popTitle) popTitle.innerText = `ตลาดคริปโตเคอร์เรนซี (${sym})`;
                if (popModeTag) {
                    popModeTag.className = 'intel-popover-mode-tag open';
                    popModeTag.innerText = '24/7 Non-Stop';
                }
                if (popActiveSrc) popActiveSrc.innerText = `Binance Spot WebSocket (${sym.includes('USDT') ? sym : sym + 'T'} 1:1 Live Feed)`;
                
                if (popSourcesList) {
                    popSourcesList.innerHTML = `
                        <div class="source-item">
                            <div><span class="source-item-dot green"></span><span class="source-item-name">Binance WebSocket Live</span></div>
                            <span class="source-item-status" style="color: #34d399;">ทำงานต่อเนื่อง 24/7 ไม่มีวันหยุด</span>
                        </div>
                        <div class="source-item">
                            <div><span class="source-item-dot green"></span><span class="source-item-name">Multi-Exchange Liquidity</span></div>
                            <span class="source-item-status">Bybit / OKX / Kraken 1:1</span>
                        </div>
                        <div class="source-item">
                            <div><span class="source-item-dot green"></span><span class="source-item-name">Local History Cache</span></div>
                            <span class="source-item-status">120k+ M1 แท่งเทียน (Zero-MT5)</span>
                        </div>
                    `;
                }
                if (popGapCard) popGapCard.style.display = 'block';
                if (popLabelFri) popLabelFri.innerText = `ราคาปิดวันศุกร์:`;
                if (popLabelCurr) popLabelCurr.innerText = `ราคาปัจจุบัน (24/7):`;
                if (popLabelGap) popLabelGap.innerText = `ส่วนต่างวันหยุด (Move):`;

                if (popFriClose) popFriClose.innerText = formatPrice(gap.friday_close);
                if (popPaxgPrice) popPaxgPrice.innerText = formatPrice(gap.current_price);
                if (popGapText) {
                    popGapText.innerText = `${sign}${formatPrice(gapPts)} (${sign}${gapPct.toFixed(2)}%)`;
                    popGapText.style.color = getGapColor(gapPts);
                }

                if (popFooterBtn) popFooterBtn.innerText = '📊 เปิดแดชบอร์ดการวิเคราะห์ & แผนเทรด →';
            }
            // CASE 2: GOLD / METALS (XAUUSD / PAXG)
            else if (isGold) {
                if (sym.includes('PAXG')) {
                    if (btn) {
                        btn.className = 'tb-btn tb-btn-market-intel market-open';
                        btn.title = 'PAX Gold (PAXGUSDT) • ทองคำดิจิทัลมีทองจริงค้ำประกัน ซื้อขาย 24/7';
                    }
                    if (label) label.innerText = '24/7 LIVE';
                    if (badge) badge.innerText = 'PAXG TOKEN';

                    if (popDot) { popDot.className = 'intel-popover-dot open'; }
                    if (popTitle) popTitle.innerText = `PAX Gold (${sym})`;
                    if (popModeTag) {
                        popModeTag.className = 'intel-popover-mode-tag open';
                        popModeTag.innerText = '24/7 Gold Token';
                    }
                    if (popActiveSrc) popActiveSrc.innerText = 'Binance Spot 24/7 Live Feed (PAXG/USDT)';
                    if (popSourcesList) {
                        popSourcesList.innerHTML = `
                            <div class="source-item">
                                <div><span class="source-item-dot green"></span><span class="source-item-name">Binance PAXG WebSocket</span></div>
                                <span class="source-item-status" style="color: #34d399;">ซื้อขายสด 24/7 ตลอดวันหยุด</span>
                            </div>
                            <div class="source-item">
                                <div><span class="source-item-dot green"></span><span class="source-item-name">Physical Gold Backed</span></div>
                                <span class="source-item-status">1 Token = 1 Troy Oz of Gold</span>
                            </div>
                            <div class="source-item">
                                <div><span class="source-item-dot green"></span><span class="source-item-name">Weekend Proxy Indicator</span></div>
                                <span class="source-item-status">ประเมิน Gap ตลาดเช้าวันจันทร์</span>
                            </div>
                        `;
                    }
                    if (popGapCard) popGapCard.style.display = 'block';
                    if (popLabelFri) popLabelFri.innerText = `ราคาปิดวันศุกร์:`;
                    if (popLabelCurr) popLabelCurr.innerText = `PAXG ปัจจุบัน:`;
                    if (popLabelGap) popLabelGap.innerText = `คาดการณ์ Gap:`;

                    if (popFriClose) popFriClose.innerText = formatPrice(gap.friday_close);
                    if (popPaxgPrice) popPaxgPrice.innerText = formatPrice(gap.paxg_current || gap.current_price);
                    if (popGapText) {
                        popGapText.innerText = `${sign}${gapPts.toFixed(2)}$ (${sign}${gapPips.toFixed(0)} pips, ${sign}${gapPct.toFixed(2)}%)`;
                        popGapText.style.color = getGapColor(gapPts);
                    }
                    if (popFooterBtn) popFooterBtn.innerText = '📊 ดูการวิเคราะห์เต็ม & Weekly Pivots →';
                } else {
                    // XAUUSD
                    if (isWeekend) {
                        if (btn) {
                            btn.className = 'tb-btn tb-btn-market-intel';
                            btn.title = `ตลาดทองคำปิดทำการ (Weekend Mode) • คาดการณ์ Gap: ${sign}${gapPts.toFixed(2)}$ (${gapPips.toFixed(0)} pips)`;
                        }
                        if (label) {
                            label.innerText = `Gap ${sign}${gapPts.toFixed(2)}$`;
                        }
                        if (badge) badge.innerText = 'PAXG 24/7';

                        if (popDot) { popDot.className = 'intel-popover-dot'; }
                        if (popTitle) popTitle.innerText = 'สถานะตลาดทองคำ (XAUUSD)';
                        if (popModeTag) {
                            popModeTag.className = 'intel-popover-mode-tag';
                            popModeTag.innerText = 'Weekend Mode';
                        }
                        if (popActiveSrc) popActiveSrc.innerText = 'Binance PAXG/USDT (24/7 Weekend Proxy)';
                        if (popSourcesList) {
                            popSourcesList.innerHTML = `
                                <div class="source-item">
                                    <div><span class="source-item-dot" style="background:#f59e0b;"></span><span class="source-item-name">IC Markets (TradingView WS)</span></div>
                                    <span class="source-item-status">ปิดทำการ (ตรึงราคาปิดวันศุกร์)</span>
                                </div>
                                <div class="source-item">
                                    <div><span class="source-item-dot green"></span><span class="source-item-name">Binance PAXG 24/7 Token</span></div>
                                    <span class="source-item-status" style="color:#34d399;">ตรวจจับ Gap ตลอดวันหยุด</span>
                                </div>
                                <div class="source-item">
                                    <div><span class="source-item-dot green"></span><span class="source-item-name">Local History Cache</span></div>
                                    <span class="source-item-status">120k+ M1 แท่งเทียน (Zero-MT5)</span>
                                </div>
                            `;
                        }
                        if (popGapCard) popGapCard.style.display = 'block';
                        if (popLabelFri) popLabelFri.innerText = `ราคาปิดวันศุกร์:`;
                        if (popLabelCurr) popLabelCurr.innerText = `PAXG ปัจจุบัน:`;
                        if (popLabelGap) popLabelGap.innerText = `คาดการณ์ Gap:`;

                        if (popFriClose) popFriClose.innerText = formatPrice(gap.friday_close);
                        if (popPaxgPrice) popPaxgPrice.innerText = formatPrice(gap.paxg_current || gap.current_price);
                        if (popGapText) {
                            const pred = gap.predicted_monday_open ? ` (คาดเปิด ~$${gap.predicted_monday_open.toFixed(2)})` : '';
                            popGapText.innerText = `${sign}${gapPts.toFixed(2)}$ (${sign}${gapPips.toFixed(0)} pips)${pred}`;
                            popGapText.style.color = getGapColor(gapPts);
                        }
                        if (popFooterBtn) popFooterBtn.innerText = '📊 ดูการวิเคราะห์เต็ม & Weekly Pivots →';
                    } else {
                        if (btn) {
                            btn.className = 'tb-btn tb-btn-market-intel market-open';
                            btn.title = 'ตลาดทองคำเปิดทำการปกติ (Market LIVE) • สัญญาณสถาบัน IC Markets';
                        }
                        if (label) label.innerText = 'Market LIVE';
                        if (badge) badge.innerText = 'IC MARKETS';

                        if (popDot) { popDot.className = 'intel-popover-dot open'; }
                        if (popTitle) popTitle.innerText = 'สถานะตลาดทองคำ (XAUUSD)';
                        if (popModeTag) {
                            popModeTag.className = 'intel-popover-mode-tag open';
                            popModeTag.innerText = 'Market LIVE';
                        }
                        if (popActiveSrc) popActiveSrc.innerText = 'IC Markets (TradingView WebSocket Live)';
                        if (popSourcesList) {
                            popSourcesList.innerHTML = `
                                <div class="source-item">
                                    <div><span class="source-item-dot green"></span><span class="source-item-name">IC Markets Institutional</span></div>
                                    <span class="source-item-status" style="color:#34d399;">Zero-Lag Feed Sub-millisecond</span>
                                </div>
                                <div class="source-item">
                                    <div><span class="source-item-dot green"></span><span class="source-item-name">Pepperstone / OANDA</span></div>
                                    <span class="source-item-status">Multi-Broker Fallback</span>
                                </div>
                                <div class="source-item">
                                    <div><span class="source-item-dot green"></span><span class="source-item-name">Local History Cache</span></div>
                                    <span class="source-item-status">120k+ M1 แท่งเทียน (Zero-MT5)</span>
                                </div>
                            `;
                        }
                        if (popGapCard) popGapCard.style.display = 'none';
                        if (popFooterBtn) popFooterBtn.innerText = '📊 ดูการวิเคราะห์เต็ม & Weekly Pivots →';
                    }
                }
            }
            // CASE 3: FOREX & COMMODITIES (EURUSD, GBPUSD, USDJPY, GBPJPY, USOIL, etc.)
            else {
                if (isWeekend) {
                    if (btn) {
                        btn.className = 'tb-btn tb-btn-market-intel';
                        btn.title = `ตลาด Forex (${sym}) ปิดทำการในวันหยุด • รอเปิดเช้าวันจันทร์ 05:00 น.`;
                    }
                    if (label) label.innerText = 'Forex Closed';
                    if (badge) badge.innerText = sym;

                    if (popDot) { popDot.className = 'intel-popover-dot'; }
                    if (popTitle) popTitle.innerText = `ตลาดอัตราแลกเปลี่ยน (${sym})`;
                    if (popModeTag) {
                        popModeTag.className = 'intel-popover-mode-tag';
                        popModeTag.innerText = 'Weekend Closed';
                    }
                    if (popActiveSrc) popActiveSrc.innerText = `ตรึงราคาปิดสัปดาห์ (Friday Close: ${sym})`;
                    if (popSourcesList) {
                        popSourcesList.innerHTML = `
                            <div class="source-item">
                                <div><span class="source-item-dot" style="background:#f59e0b;"></span><span class="source-item-name">ตลาด Forex สากล</span></div>
                                <span class="source-item-status">ปิดทำการ เสาร์-อาทิตย์</span>
                            </div>
                            <div class="source-item">
                                <div><span class="source-item-dot green"></span><span class="source-item-name">เวลาเปิดทำการถัดไป</span></div>
                                <span class="source-item-status" style="color:#38bdf8;">จันทร์ 05:00 น. (เวลาไทย)</span>
                            </div>
                            <div class="source-item">
                                <div><span class="source-item-dot green"></span><span class="source-item-name">Local History Cache</span></div>
                                <span class="source-item-status">พร้อมสำหรับ Backtest & วิเคราะห์</span>
                            </div>
                        `;
                    }
                    if (popGapCard) popGapCard.style.display = 'block';
                    if (popLabelFri) popLabelFri.innerText = `ราคาปิดวันศุกร์:`;
                    if (popLabelCurr) popLabelCurr.innerText = `ราคาล่าสุด:`;
                    if (popLabelGap) popLabelGap.innerText = `สถานะตลาด:`;

                    if (popFriClose) popFriClose.innerText = formatPrice(gap.friday_close);
                    if (popPaxgPrice) popPaxgPrice.innerText = formatPrice(gap.current_price);
                    if (popGapText) {
                        popGapText.innerText = `ตลาดปิดวันหยุด (รอเปิดเช้าวันจันทร์ 05:00 น.)`;
                        popGapText.style.color = '#fbbf24';
                    }
                    if (popFooterBtn) popFooterBtn.innerText = '📊 เปิดแผนวิเคราะห์แนวรับแนวต้าน S&R →';
                } else {
                    if (btn) {
                        btn.className = 'tb-btn tb-btn-market-intel market-open';
                        btn.title = `ตลาด Forex (${sym}) เปิดทำการปกติ • สัญญาณสถาบัน FXCM / OANDA`;
                    }
                    if (label) label.innerText = 'Market LIVE';
                    if (badge) badge.innerText = 'FOREX LIVE';

                    if (popDot) { popDot.className = 'intel-popover-dot open'; }
                    if (popTitle) popTitle.innerText = `ตลาดอัตราแลกเปลี่ยน (${sym})`;
                    if (popModeTag) {
                        popModeTag.className = 'intel-popover-mode-tag open';
                        popModeTag.innerText = 'Market LIVE';
                    }
                    if (popActiveSrc) popActiveSrc.innerText = `TradingView Forex Feed (${sym} Institutional Live)`;
                    if (popSourcesList) {
                        popSourcesList.innerHTML = `
                            <div class="source-item">
                                <div><span class="source-item-dot green"></span><span class="source-item-name">TradingView WS Live</span></div>
                                <span class="source-item-status" style="color:#34d399;">จันทร์ 05:00 - เสาร์ 04:00 (ไทย)</span>
                            </div>
                            <div class="source-item">
                                <div><span class="source-item-dot green"></span><span class="source-item-name">Public Spot / Yahoo Finance</span></div>
                                <span class="source-item-status">ระบบสำรองอัตโนมัติ 24/5</span>
                            </div>
                            <div class="source-item">
                                <div><span class="source-item-dot green"></span><span class="source-item-name">Local History Cache</span></div>
                                <span class="source-item-status">120k+ M1 แท่งเทียน (Zero-MT5)</span>
                            </div>
                        `;
                    }
                    if (popGapCard) popGapCard.style.display = 'none';
                    if (popFooterBtn) popFooterBtn.innerText = '📊 เปิดแผนวิเคราะห์แนวรับแนวต้าน S&R →';
                }
            }
        },

        toggleMarketIntelPopover(e) {
            if (e) e.stopPropagation();
            const pop = document.getElementById('custom-intel-popover');
            if (!pop) return;
            const isVisible = pop.classList.contains('visible');
            if (isVisible) {
                this.closeMarketIntelPopover();
            } else {
                pop.classList.add('visible');
                const activeChart = (window.chartEngine && window.chartEngine.getActiveChart) ? window.chartEngine.getActiveChart() : null;
                const sym = activeChart ? activeChart.symbol : 'XAUUSD';
                this.updateMarketIntelUI(this.marketIntelData, sym);
                this.fetchMarketIntelligence(sym);
            }
        },

        closeMarketIntelPopover() {
            const pop = document.getElementById('custom-intel-popover');
            if (pop) pop.classList.remove('visible');
        },

        async openMarketIntelModal() {
            this.closeMarketIntelPopover();
            const modal = document.getElementById('modal-market-intel');
            if (!modal) return;
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('visible'), 10);

            const activeChart = (window.chartEngine && window.chartEngine.getActiveChart) ? window.chartEngine.getActiveChart() : null;
            const sym = activeChart ? activeChart.symbol : 'XAUUSD';

            // Render existing or fetch fresh data
            if (this.marketIntelData) {
                this.renderMarketIntelModalContent(this.marketIntelData, sym);
            }
            const intel = await this.fetchMarketIntelligence(sym);
            if (intel) {
                this.renderMarketIntelModalContent(intel, sym);
            }
        },

        closeMarketIntelModal() {
            const modal = document.getElementById('modal-market-intel');
            if (!modal) return;
            modal.classList.remove('visible');
            setTimeout(() => modal.style.display = 'none', 180);
        },

        renderMarketIntelModalContent(intel, targetSymbol) {
            if (!intel) return;

            const activeChart = (window.chartEngine && window.chartEngine.getActiveChart) ? window.chartEngine.getActiveChart() : null;
            let sym = targetSymbol || (activeChart ? activeChart.symbol : 'XAUUSD');
            sym = sym.toUpperCase().replace('/', '').replace('-', '');

            const isCrypto = sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('BNB') || sym.includes('XRP') || sym.includes('DOGE');
            const isGold = sym.includes('XAU') || sym.includes('GOLD') || sym.includes('PAXG');
            const isForex = !isCrypto && !isGold && !sym.includes('XAG') && !sym.includes('SILVER');

            let symIntel = null;
            if (intel.symbols_summary && intel.symbols_summary[sym]) {
                symIntel = intel.symbols_summary[sym];
            } else if (intel.active_symbol === sym) {
                symIntel = intel;
            } else {
                symIntel = intel;
            }

            const gap = symIntel.gap_analysis || {};
            const decimals = isGold ? 2 : (isCrypto ? (sym.includes('XRP') || sym.includes('DOGE') ? 4 : 2) : (sym.includes('JPY') ? 3 : 5));
            const formatPrice = (p) => {
                if (p === undefined || p === null || isNaN(p)) return '$--.--';
                const prefix = isForex ? '' : '$';
                return prefix + Number(p).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
            };

            // Status Badge
            const statusBadge = document.getElementById('intel-market-status-badge');
            const statusText = document.getElementById('intel-status-text');
            const subText = document.getElementById('intel-modal-sub');
            if (subText) {
                subText.innerText = `วิเคราะห์ตลาด & ทิศทางราคาสำหรับ ${sym} (Zero-MT5 Dependent)`;
            }

            if (statusBadge && statusText) {
                if (isCrypto) {
                    statusBadge.classList.add('open');
                    statusText.innerText = `ตลาดคริปโต 24/7 เปิดต่อเนื่อง (${sym})`;
                } else if (symIntel.is_weekend) {
                    statusBadge.classList.remove('open');
                    statusText.innerText = `โหมดวันหยุด (${sym} Weekend Closed)`;
                } else {
                    statusBadge.classList.add('open');
                    statusText.innerText = `ตลาดเปิดทำการปกติ (${sym} Market LIVE)`;
                }
            }

            // Stats Elements
            const friCloseEl = document.getElementById('intel-friday-close');
            const paxgPriceEl = document.getElementById('intel-paxg-price');
            const gapValEl = document.getElementById('intel-gap-val');
            const gapSubEl = document.getElementById('intel-gap-sub');
            const sentBanner = document.getElementById('intel-sentiment-banner');
            const sentIcon = document.getElementById('intel-sentiment-icon');
            const sentMsg = document.getElementById('intel-sentiment-msg');

            const friLabel = document.getElementById('intel-modal-fri-label');
            const paxgLabel = document.getElementById('intel-modal-paxg-label');
            const gapLabel = document.getElementById('intel-modal-gap-label');

            // Update Labels
            const updateLabel = (id, text) => {
                const el = document.getElementById(id);
                if (el) el.innerText = text;
            };
            updateLabel('intel-modal-fri-label', `ราคาปิดวันศุกร์ (${sym})`);
            updateLabel('full-fri-label', `ราคาปิดวันศุกร์ (${sym})`);
            updateLabel('intel-modal-paxg-label', isGold ? `ราคา PAXGUSDT (24/7)` : (isCrypto ? `ราคาปัจจุบัน (24/7)` : `ราคาล่าสุดก่อนปิดตลาด`));
            updateLabel('full-curr-label', isGold ? `ราคา PAXGUSDT (24/7)` : (isCrypto ? `ราคาปัจจุบัน (24/7)` : `ราคาล่าสุดก่อนปิดตลาด`));
            updateLabel('intel-modal-gap-label', isCrypto ? `ส่วนต่างวันหยุด (Move)` : (isGold ? `คาดการณ์ Gap เช้าวันจันทร์` : `สถานะช่วงวันหยุด`));
            updateLabel('full-gap-label', isCrypto ? `ส่วนต่างวันหยุด (Move)` : (isGold ? `คาดการณ์ Gap เช้าวันจันทร์` : `สถานะช่วงวันหยุด`));

            // Update Values
            const updateVal = (id, text) => {
                const el = document.getElementById(id);
                if (el) el.innerText = text;
            };
            const friPriceText = formatPrice(gap.friday_close);
            const currPriceText = formatPrice(gap.paxg_current || gap.current_price);
            updateVal('intel-friday-close', friPriceText);
            updateVal('full-fri-val', friPriceText);
            updateVal('intel-paxg-price', currPriceText);
            updateVal('full-curr-val', currPriceText);
            
            const gapPts = gap.gap_points !== undefined ? gap.gap_points : 0;
            const gapPips = gap.gap_pips !== undefined ? gap.gap_pips : 0;
            const gapPct = gap.gap_percent !== undefined ? gap.gap_percent : 0;
            const sign = gapPts > 0 ? '+' : '';

            let gapMainText = '';
            let gapColor = '#fbbf24';
            let gapSubText = '';

            if (isForex && symIntel.is_weekend) {
                gapMainText = `ตลาดปิดวันหยุด`;
                gapColor = '#fbbf24';
                gapSubText = `ตรึงราคาปิดสัปดาห์ • รอเปิดเช้าวันจันทร์ 05:00 น.`;
            } else if (isGold) {
                gapMainText = `${sign}${gapPts.toFixed(2)}$ (${sign}${gapPips.toFixed(0)} pips)`;
                gapColor = gapPts > 1.5 ? '#34d399' : (gapPts < -1.5 ? '#f87171' : '#fbbf24');
                gapSubText = gap.predicted_monday_open ? `คาดการณ์เปิดวันจันทร์ ~${formatPrice(gap.predicted_monday_open)} (${gapPct > 0 ? '+' : ''}${gapPct.toFixed(2)}%)` : `ความต่างเทียบวันศุกร์: ${gapPct > 0 ? '+' : ''}${gapPct.toFixed(2)}%`;
            } else {
                gapMainText = `${sign}${formatPrice(gapPts)} (${sign}${gapPct.toFixed(2)}%)`;
                gapColor = gapPts > 0 ? '#34d399' : (gapPts < 0 ? '#f87171' : '#fbbf24');
                gapSubText = `ความต่างเทียบวันศุกร์: ${gapPct > 0 ? '+' : ''}${gapPct.toFixed(2)}%`;
            }

            const setGapUI = (valId, subId) => {
                const valEl = document.getElementById(valId);
                const subEl = document.getElementById(subId);
                if (valEl) {
                    valEl.innerText = gapMainText;
                    valEl.style.color = gapColor;
                }
                if (subEl) subEl.innerText = gapSubText;
            };
            setGapUI('intel-gap-val', 'intel-gap-sub');
            setGapUI('full-gap-val', 'full-gap-sub');

            // Source Badge
            const srcBadge = document.getElementById('full-intel-src-badge');
            if (srcBadge) {
                srcBadge.innerText = isGold ? 'PAXG 24/7 Proxy' : (isCrypto ? 'Binance 24/7 Spot' : (symIntel.is_weekend ? 'MT5 / Broker Close' : 'Live Institutional Feed'));
            }

            // Sentiment Message
            const sent = gap.sentiment || 'NEUTRAL';
            let icon = '⚖️';
            let msg = gap.bias_message || 'ตลาดกำลังเคลื่อนไหวในกรอบปกติ';

            if (sent === 'BULLISH_GAP') {
                icon = '🚀';
            } else if (sent === 'BEARISH_GAP') {
                icon = '🔻';
            } else if (sent === 'LIVE_OPEN' || sent === 'ACTIVE_24_7') {
                icon = isCrypto ? '₿' : '🟢';
            }

            if (sentBanner) {
                sentBanner.className = `intel-sentiment-card ${sent.toLowerCase()}`;
            }
            if (sentIcon) sentIcon.innerText = icon;
            if (sentMsg) sentMsg.innerText = msg;

            // Full Analysis View Sentiment Box
            const fullSentBox = document.getElementById('full-sentiment-box');
            const fullSentIcon = document.getElementById('full-sentiment-icon');
            const fullSentText = document.getElementById('full-sentiment-text');
            if (fullSentBox) {
                fullSentBox.className = `intel-sentiment-box ${sent.toLowerCase()}`;
            }
            if (fullSentIcon) fullSentIcon.innerText = icon;
            if (fullSentText) fullSentText.innerText = msg;

            // Pivots Table (Both Modal and Full Analysis View)
            const piv = (symIntel && symIntel.weekly_pivots) ? symIntel.weekly_pivots : (intel.weekly_pivots || {});
            const std = piv.standard || {};
            const fib = piv.fibonacci || {};
            const cam = piv.camarilla || {};

            const setTxt = (id, val) => {
                const txt = (val !== undefined && val !== null && !isNaN(val)) ? formatPrice(val) : '-';
                const el = document.getElementById(id);
                if (el) el.innerText = txt;
                const fullEl = document.getElementById('full-' + id);
                if (fullEl) fullEl.innerText = txt;
            };

            setTxt('piv-std-s3', std.S3);
            setTxt('piv-std-s1', std.S1);
            setTxt('piv-std-p', std.P);
            setTxt('piv-std-r1', std.R1);
            setTxt('piv-std-r3', std.R3);

            setTxt('piv-fib-s3', fib.S3);
            setTxt('piv-fib-s1', fib.S1);
            setTxt('piv-fib-p', fib.P);
            setTxt('piv-fib-r1', fib.R1);
            setTxt('piv-fib-r3', fib.R3);

            setTxt('piv-cam-s3', cam.S3);
            setTxt('piv-cam-s1', cam.S1);
            setTxt('piv-cam-p', cam.P !== undefined ? cam.P : (cam.R1 ? ((cam.R1 + (cam.S1 || cam.R1)) / 2) : std.P));
            setTxt('piv-cam-r1', cam.R1);
            setTxt('piv-cam-r3', cam.R3);
        },

        plotWeeklyPivotsOnChart() {
            if (!this.marketIntelData || !this.marketIntelData.weekly_pivots) {
                this.showToast('⚠️ กำลังโหลดข้อมูลระดับราคา กรุณาลองใหม่อีกครั้ง');
                return;
            }

            const active = window.chartEngine ? window.chartEngine.getActiveChart() : null;
            if (!active) {
                this.showToast('⚠️ ไม่พบชาร์ตที่เลือกอยู่');
                return;
            }

            const std = this.marketIntelData.weekly_pivots.standard || {};
            const keys = this.marketIntelData.weekly_pivots.key_levels || {};
            const nowTime = Math.floor(Date.now() / 1000);

            const levels = [
                { name: 'Weekly R2', price: std.R2, color: '#ef4444' },
                { name: 'Weekly R1', price: std.R1, color: '#f87171' },
                { name: 'Weekly Pivot (P)', price: std.P, color: '#fbbf24' },
                { name: 'Weekly S1', price: std.S1, color: '#34d399' },
                { name: 'Weekly S2', price: std.S2, color: '#10b981' }
            ];

            if (keys.week_high) levels.push({ name: 'Weekly High', price: keys.week_high, color: '#ec4899' });
            if (keys.week_low) levels.push({ name: 'Weekly Low', price: keys.week_low, color: '#8b5cf6' });

            active.drawings = active.drawings || [];
            levels.forEach(lvl => {
                if (lvl.price) {
                    active.drawings.push({
                        id: 'draw_piv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        type: 'horzline',
                        points: [{ time: nowTime, price: lvl.price }],
                        color: lvl.color,
                        text: `${lvl.name} ($${lvl.price})`
                    });
                }
            });

            window.chartEngine.saveDrawings(active.symbol, active.drawings);
            window.chartEngine.updateOverlays(active);
            this.showToast(`✨ วาด ${levels.length} ระดับ Weekly Pivots ลงบน ${active.symbol} เรียบร้อย!`);
            this.closeMarketIntelModal();
        },

        // ==========================================
        // SMC & ICT Trading Plan & Analysis Methods
        // ==========================================
        tradingPlanData: null,
        tradingPlanCache: {},
        activePlanStyle: 'daytrade',
        activeAnalysisSymbol: 'XAUUSD',

        setAnalysisLoadingState(isLoading, symbol) {
            const sym = symbol || this.activeAnalysisSymbol || 'XAUUSD';
            const pageBody = document.getElementById('analysis-page-body');
            const banner = document.getElementById('analysis-loading-banner');
            const textEl = document.getElementById('analysis-loading-text');
            const refreshBtn = document.querySelector('.analysis-btn-refresh');

            if (isLoading) {
                if (pageBody) pageBody.classList.add('is-analyzing');
                if (banner) {
                    banner.classList.add('visible');
                    if (textEl) textEl.innerText = `🧠 กำลังประมวลผลโครงสร้างตลาด SMC & ICT และคำนวณระดับราคาสำหรับ ${sym}...`;
                }
                if (refreshBtn) refreshBtn.classList.add('spinning');

                const chips = document.querySelectorAll('.analysis-chip');
                chips.forEach(c => {
                    if (c.getAttribute('data-sym') === sym) c.classList.add('analyzing-chip');
                    else c.classList.remove('analyzing-chip');
                });
            } else {
                if (pageBody) pageBody.classList.remove('is-analyzing');
                if (banner) banner.classList.remove('visible');
                if (refreshBtn) refreshBtn.classList.remove('spinning');
                const chips = document.querySelectorAll('.analysis-chip');
                chips.forEach(c => c.classList.remove('analyzing-chip'));
            }
        },

        setAnalysisSkeleton(sym) {
            const priceEl = document.getElementById('analysis-active-price');
            if (priceEl) priceEl.innerHTML = '<span class="loading-skeleton-pulse" style="width: 80px;"></span>';

            const fullMatrixEntry = document.getElementById('full-matrix-entry-val');
            if (fullMatrixEntry) fullMatrixEntry.innerHTML = '<span class="loading-skeleton-pulse" style="width: 120px;"></span>';
            const fullMatrixOte = document.getElementById('full-matrix-ote-val');
            if (fullMatrixOte) fullMatrixOte.innerHTML = '<span class="loading-skeleton-pulse" style="width: 90px;"></span>';
            const fullMatrixSl = document.getElementById('full-matrix-sl-val');
            if (fullMatrixSl) fullMatrixSl.innerHTML = '<span class="loading-skeleton-pulse" style="width: 90px;"></span>';
            const fullMatrixTp1 = document.getElementById('full-matrix-tp1-val');
            if (fullMatrixTp1) fullMatrixTp1.innerHTML = '<span class="loading-skeleton-pulse" style="width: 90px;"></span>';
            const fullMatrixTp2 = document.getElementById('full-matrix-tp2-val');
            if (fullMatrixTp2) fullMatrixTp2.innerHTML = '<span class="loading-skeleton-pulse" style="width: 90px;"></span>';

            const fullFriVal = document.getElementById('full-fri-val');
            if (fullFriVal) fullFriVal.innerHTML = '<span class="loading-skeleton-pulse" style="width: 70px;"></span>';
            const fullCurrVal = document.getElementById('full-curr-val');
            if (fullCurrVal) fullCurrVal.innerHTML = '<span class="loading-skeleton-pulse" style="width: 70px;"></span>';
            const fullGapVal = document.getElementById('full-gap-val');
            if (fullGapVal) fullGapVal.innerHTML = '<span class="loading-skeleton-pulse" style="width: 110px;"></span>';
        },

        async openFullAnalysisView(symbol) {
            const chartSection = document.getElementById('chart-area-section') || document.querySelector('.chart-area');
            const analysisSection = document.getElementById('view-full-analysis');
            if (!analysisSection) return;

            if (chartSection) chartSection.style.display = 'none';
            analysisSection.style.display = 'flex';

            const activeChart = (window.chartEngine && window.chartEngine.getActiveChart) ? window.chartEngine.getActiveChart() : null;
            const targetSym = symbol || this.activeAnalysisSymbol || (activeChart ? activeChart.symbol : 'XAUUSD');
            const cleanSym = targetSym.toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();
            this.activeAnalysisSymbol = cleanSym;

            this.highlightAnalysisSymbolChip(cleanSym);
            this.setAnalysisLoadingState(true, cleanSym);

            if (this.tradingPlanCache[cleanSym]) {
                this.tradingPlanData = this.tradingPlanCache[cleanSym];
                this.renderTradingPlanModalContent();
            } else if (window.SMCICTEngine && window.SMCICTEngine.generateTradingPlanClientSide) {
                const clientData = window.SMCICTEngine.generateTradingPlanClientSide(cleanSym);
                this.tradingPlanData = clientData;
                this.tradingPlanCache[cleanSym] = clientData;
                this.renderTradingPlanModalContent();
            } else {
                this.setAnalysisSkeleton(cleanSym);
            }

            if (this.marketIntelCache[cleanSym]) {
                this.marketIntelData = this.marketIntelCache[cleanSym];
                this.renderMarketIntelModalContent(this.marketIntelCache[cleanSym], cleanSym);
            } else if (window.SMCICTEngine && window.SMCICTEngine.generateMarketIntelClientSide) {
                const clientIntel = window.SMCICTEngine.generateMarketIntelClientSide(cleanSym);
                if (clientIntel && clientIntel.intelligence) {
                    this.marketIntelData = clientIntel.intelligence;
                    this.marketIntelCache[cleanSym] = clientIntel.intelligence;
                    this.renderMarketIntelModalContent(clientIntel.intelligence, cleanSym);
                }
            }

            // Dismiss loading state promptly after instant render (200ms)
            setTimeout(() => {
                if (this.activeAnalysisSymbol === cleanSym) {
                    this.setAnalysisLoadingState(false, cleanSym);
                }
            }, 200);

            // Background network sync without blocking UI
            (async () => {
                try {
                    await Promise.all([
                        this.fetchTradingPlan(cleanSym),
                        this.fetchMarketIntelligence ? this.fetchMarketIntelligence(cleanSym) : Promise.resolve()
                    ]);
                } catch (e) {}

                try {
                    if (this.activeAnalysisSymbol === cleanSym) {
                        this.renderTradingPlanModalContent();
                        if (this.marketIntelData) {
                            this.renderMarketIntelModalContent(this.marketIntelData, cleanSym);
                        }
                    }
                } catch (err) {
                    console.warn('[AnalysisView] Render error in openFullAnalysisView background sync:', err);
                } finally {
                    if (this.activeAnalysisSymbol === cleanSym) {
                        this.setAnalysisLoadingState(false, cleanSym);
                    }
                }
            })();
        },

        closeFullAnalysisView() {
            const chartSection = document.getElementById('chart-area-section') || document.querySelector('.chart-area');
            const analysisSection = document.getElementById('view-full-analysis');
            if (analysisSection) analysisSection.style.display = 'none';
            if (chartSection) {
                chartSection.style.display = 'block';
                // Trigger chart reflow
                if (window.chartEngine && window.chartEngine.resizeAll) {
                    setTimeout(() => window.chartEngine.resizeAll(), 30);
                }
            }
        },

        highlightAnalysisSymbolChip(sym) {
            const chips = document.querySelectorAll('.analysis-chip');
            chips.forEach(c => {
                if (c.getAttribute('data-sym') === sym) c.classList.add('active');
                else c.classList.remove('active');
            });
        },

        async switchAnalysisSymbol(sym) {
            const cleanSym = (sym || 'XAUUSD').toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();
            this.activeAnalysisSymbol = cleanSym;
            this.highlightAnalysisSymbolChip(cleanSym);
            this.setAnalysisLoadingState(true, cleanSym);

            // Sync with active chart if appropriate
            if (window.chartEngine && window.chartEngine.getActiveChart) {
                const activeChart = window.chartEngine.getActiveChart();
                if (activeChart && activeChart.symbol !== cleanSym) {
                    activeChart.symbol = cleanSym;
                }
            }

            // Immediate render from cache or standalone client engine
            if (this.tradingPlanCache[cleanSym]) {
                this.tradingPlanData = this.tradingPlanCache[cleanSym];
                this.renderTradingPlanModalContent();
            } else if (window.SMCICTEngine && window.SMCICTEngine.generateTradingPlanClientSide) {
                const clientData = window.SMCICTEngine.generateTradingPlanClientSide(cleanSym);
                this.tradingPlanData = clientData;
                this.tradingPlanCache[cleanSym] = clientData;
                this.renderTradingPlanModalContent();
            } else {
                this.setAnalysisSkeleton(cleanSym);
            }

            if (this.marketIntelCache[cleanSym]) {
                this.marketIntelData = this.marketIntelCache[cleanSym];
                this.renderMarketIntelModalContent(this.marketIntelCache[cleanSym], cleanSym);
            } else if (window.SMCICTEngine && window.SMCICTEngine.generateMarketIntelClientSide) {
                const clientIntel = window.SMCICTEngine.generateMarketIntelClientSide(cleanSym);
                if (clientIntel && clientIntel.intelligence) {
                    this.marketIntelData = clientIntel.intelligence;
                    this.marketIntelCache[cleanSym] = clientIntel.intelligence;
                    this.renderMarketIntelModalContent(clientIntel.intelligence, cleanSym);
                }
            }

            // Dismiss loading state promptly after instant render (200ms)
            setTimeout(() => {
                if (this.activeAnalysisSymbol === cleanSym) {
                    this.setAnalysisLoadingState(false, cleanSym);
                }
            }, 200);

            // Background network sync without blocking UI
            (async () => {
                try {
                    await Promise.all([
                        this.fetchTradingPlan(cleanSym),
                        this.fetchMarketIntelligence ? this.fetchMarketIntelligence(cleanSym) : Promise.resolve()
                    ]);
                } catch (e) {}

                try {
                    if (this.activeAnalysisSymbol === cleanSym) {
                        this.renderTradingPlanModalContent();
                        if (this.marketIntelData) {
                            this.renderMarketIntelModalContent(this.marketIntelData, cleanSym);
                        }
                    }
                } catch (err) {
                    console.warn('[AnalysisView] Render error in switchAnalysisSymbol background sync:', err);
                } finally {
                    if (this.activeAnalysisSymbol === cleanSym) {
                        this.setAnalysisLoadingState(false, cleanSym);
                    }
                }
            })();
        },

        async openTradingPlanModal() {
            // Forward directly to the Full Analysis View
            await this.openFullAnalysisView();
        },

        closeTradingPlanModal() {
            this.closeFullAnalysisView();
        },

        switchTradingPlanTab(style) {
            this.activePlanStyle = style;
            const tabs = ['scalping', 'daytrade', 'swing'];
            tabs.forEach(t => {
                const btnFull = document.getElementById(`full-tab-${t}`);
                if (btnFull) {
                    if (t === style) btnFull.classList.add('active');
                    else btnFull.classList.remove('active');
                }
                const btnMod = document.getElementById(`plan-tab-${t}`);
                if (btnMod) {
                    if (t === style) btnMod.classList.add('active');
                    else btnMod.classList.remove('active');
                }
            });
            this.setAnalysisLoadingState(true, this.activeAnalysisSymbol);
            setTimeout(() => {
                this.renderTradingPlanModalContent();
                this.setAnalysisLoadingState(false, this.activeAnalysisSymbol);
            }, 80);
        },

        async refreshTradingPlan() {
            const sym = this.activeAnalysisSymbol || 'XAUUSD';
            this.setAnalysisLoadingState(true, sym);
            this.showToast(`🔄 กำลังรีเฟรชวิเคราะห์สด SMC สำหรับ ${sym}...`);
            try {
                await Promise.all([
                    this.fetchTradingPlan(sym, true),
                    this.fetchMarketIntelligence ? this.fetchMarketIntelligence(sym) : Promise.resolve()
                ]);
            } catch (e) {}
            this.renderTradingPlanModalContent();
            if (this.marketIntelData) {
                this.renderMarketIntelModalContent(this.marketIntelData, sym);
            }
            this.setAnalysisLoadingState(false, sym);
            this.showToast(`✅ อัปเดตแผนวิเคราะห์ ${sym} เรียบร้อย!`);
        },

        async fetchTradingPlan(symbol, force = false) {
            const targetSym = symbol || this.activeAnalysisSymbol || 'XAUUSD';
            const cleanSym = targetSym.toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();
            const requestSym = cleanSym;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1800);
                const res = await fetch(`/api/trading-plan?symbol=${encodeURIComponent(cleanSym)}${force ? '&force=1' : ''}`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.status === 'ok') {
                        this.tradingPlanCache[cleanSym] = data;
                        if (this.activeAnalysisSymbol === requestSym) {
                            this.tradingPlanData = data;
                            this.renderTradingPlanModalContent();
                        }
                        return data;
                    }
                }
            } catch (err) {
                console.warn('[TradingPlan] Remote API unavailable or timed out, falling back to Client Engine:', err);
            }

            // Standalone Client-Side Fallback Engine (Runs even if Apache/Host returns 404 for /api/)
            if (window.SMCICTEngine && window.SMCICTEngine.generateTradingPlanClientSide) {
                const clientData = window.SMCICTEngine.generateTradingPlanClientSide(cleanSym);
                this.tradingPlanCache[cleanSym] = clientData;
                if (this.activeAnalysisSymbol === requestSym) {
                    this.tradingPlanData = clientData;
                    this.renderTradingPlanModalContent();
                }
                return clientData;
            }

            return null;
        },

        renderTradingPlanModalContent() {
            const data = this.tradingPlanData;
            if (!data) return;

            const analysisView = document.getElementById('view-full-analysis');
            const isAnalysisOpen = analysisView && analysisView.style.display !== 'none';
            const sym = isAnalysisOpen ? (this.activeAnalysisSymbol || data.symbol || 'XAUUSD') : (data.symbol || this.activeAnalysisSymbol || 'XAUUSD');

            // If data is for a different symbol than the currently active analysis symbol, reject it
            if (isAnalysisOpen && data.symbol && this.activeAnalysisSymbol) {
                const cleanDataSym = data.symbol.toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();
                const cleanActiveSym = this.activeAnalysisSymbol.toUpperCase().replace('/', '').replace('-', '').replace('#', '').trim();
                if (cleanDataSym !== cleanActiveSym) {
                    return;
                }
            }

            const style = this.activePlanStyle || 'daytrade';
            const plans = data.trading_plans || {};
            let plan = plans[style] || plans[style.toLowerCase()] || plans[style + 'trade'] || plans[style.replace('trade', '')] || data.plan || null;
            if (!plan && Object.keys(plans).length > 0) {
                plan = plans[Object.keys(plans)[0]];
            }
            const currPrice = data.current_price || 0;
            
            let bias = data.overall_bias;
            if (!bias && data.market_structure && data.market_structure.m15) {
                bias = data.market_structure.m15.trend || 'NEUTRAL';
            }
            if (!bias && plan) {
                bias = plan.action === 'BUY' ? 'BULLISH' : (plan.action === 'SELL' ? 'BEARISH' : 'NEUTRAL');
            }
            bias = bias || 'BULLISH';

            const isGold = sym.includes('XAU') || sym.includes('GOLD') || sym.includes('PAXG');
            const isCrypto = sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('BNB') || sym.includes('XRP') || sym.includes('DOGE');
            const isForex = !isGold && !isCrypto && !sym.includes('XAG') && !sym.includes('SILVER');
            const decimals = isGold ? 2 : (isCrypto ? (sym.includes('XRP') || sym.includes('DOGE') ? 4 : 2) : (sym.includes('JPY') ? 3 : (sym.includes('XAG') ? 2 : 5)));
            const formatP = (p) => {
                if (p === undefined || p === null || isNaN(p)) return '-';
                const prefix = isForex ? '' : '$';
                return prefix + Number(p).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
            };

            // Update Header & Active Prices & Status Tag
            const priceEl = document.getElementById('analysis-active-price');
            if (priceEl) priceEl.innerText = formatP(currPrice);

            const tagEl = document.getElementById('analysis-market-tag');
            const dotEl = document.getElementById('analysis-status-dot');
            if (tagEl) {
                if (isCrypto) {
                    tagEl.innerText = 'Live 24/7 Crypto';
                    tagEl.className = 'analysis-badge open';
                } else if (this.marketIntelData && this.marketIntelData.is_weekend) {
                    tagEl.innerText = 'Weekend Closed';
                    tagEl.className = 'analysis-badge';
                } else {
                    tagEl.innerText = 'Live ECN / Spot';
                    tagEl.className = 'analysis-badge open';
                }
            }
            if (dotEl) {
                dotEl.className = `analysis-dot ${isCrypto || (this.marketIntelData && !this.marketIntelData.is_weekend) ? 'green' : 'amber'}`;
            }

            // Fallback plan synthesis if not present
            if (!plan) {
                const isBuy = (bias === 'BULLISH' || bias === 'BUY');
                const slDist = (currPrice * 0.006);
                const tp1Dist = (currPrice * 0.012);
                const tp2Dist = (currPrice * 0.024);
                plan = {
                    action: isBuy ? 'BUY' : (bias === 'BEARISH' || bias === 'SELL' ? 'SELL' : 'WAIT'),
                    confidence_score: 75,
                    timeframe: style === 'scalping' ? 'M1 - M5' : (style === 'daytrade' ? 'M15 - H1' : 'H4 - D1'),
                    entry_price: currPrice,
                    ote_price: isBuy ? currPrice - (slDist * 0.3) : currPrice + (slDist * 0.3),
                    stop_loss: isBuy ? currPrice - slDist : currPrice + slDist,
                    take_profit_1: isBuy ? currPrice + tp1Dist : currPrice - tp1Dist,
                    take_profit_2: isBuy ? currPrice + tp2Dist : currPrice - tp2Dist,
                    risk_reward: '1:2.5',
                    headline: `วิเคราะห์ ${sym}: พิจารณาเปิด ${isBuy ? 'BUY' : 'SELL'} ตามทิศทางแนวโน้ม ${bias}`,
                    details: `สไตล์ ${style.toUpperCase()} • ประเมินจากโครงสร้างราคาล่าสุด`,
                    confluences: {
                        structure_shift: true,
                        structure_desc: `ตรวจพบโครงสร้าง ${bias} ใน Timeframe หลัก`,
                        ob_present: true,
                        ob_desc: `โซน Order Block สอดคล้องกับแนวรับแนวต้าน`,
                        fvg_present: true,
                        fvg_desc: `มีช่องว่าง Fair Value Gap หนุนทิศทาง`,
                        liq_swept: true,
                        liq_desc: `เคลียร์สภาพคล่อง Liquidity เรียบร้อย`,
                        discount_zone: true,
                        discount_desc: isBuy ? 'ราคาอยู่ในโซน Discount เหมาะแก่การ BUY' : 'ราคาอยู่ในโซน Premium เหมาะแก่การ SELL'
                    }
                };
            }

            // Verdict Banner (Update both full view and modal if present)
            const updateVerdict = (prefix) => {
                const pill = document.getElementById(`${prefix}verdict-action-pill`);
                const arrow = document.getElementById(`${prefix}verdict-arrow`);
                const text = document.getElementById(`${prefix}verdict-action-text`);
                const head = document.getElementById(`${prefix}verdict-headline`);
                const sub = document.getElementById(`${prefix}verdict-subtext`);
                const confV = document.getElementById(`${prefix}verdict-confidence-val`);
                const confB = document.getElementById(`${prefix}verdict-confidence-bar`);
                const qual = document.getElementById(`${prefix}verdict-quality`);

                const act = plan.action || 'WAIT';
                if (pill) {
                    pill.className = `verdict-action-pill ${act === 'BUY' ? 'verdict-buy' : (act === 'SELL' ? 'verdict-sell' : 'verdict-wait')}`;
                }
                if (arrow) arrow.innerText = act === 'BUY' ? '▲' : (act === 'SELL' ? '▼' : '⏳');
                if (text) text.innerText = act === 'BUY' ? 'STRONG BUY' : (act === 'SELL' ? 'STRONG SELL' : 'WAIT / OBSERVE');

                if (head) head.innerText = plan.headline || plan.rationale || (act === 'BUY' ? `พิจารณาเปิด BUY เมื่อย่อทดสอบโซน Demand OB` : (act === 'SELL' ? `พิจารณาเปิด SELL เมื่อเด้งทดสอบโซน Supply OB` : `รอโครงสร้างตลาดชัดเจนหรือเกิดการ Sweep Liquidity`));
                if (sub) sub.innerText = plan.details || `สไตล์ ${style.toUpperCase()} (${plan.timeframe || ''}) • ประเมินจาก SMC/ICT Market Structure`;

                const confidence = plan.confidence_score || plan.confidence || (act === 'WAIT' ? 55 : 80);
                if (confV) confV.innerText = `${confidence}%`;
                if (confB) confB.style.width = `${confidence}%`;
                if (qual) {
                    qual.innerText = confidence >= 80 ? '⭐ A+ High Probability Setup' : (confidence >= 65 ? '✨ Valid Confluence Setup' : '⚠️ Moderate Setup / Wait Confirm');
                }
            };

            updateVerdict('full-');
            updateVerdict('');

            // Execution Matrix
            const updateMatrix = (prefix) => {
                const rrBadge = document.getElementById(`${prefix}matrix-rr-badge`);
                const entryVal = document.getElementById(`${prefix}matrix-entry-val`);
                const oteVal = document.getElementById(`${prefix}matrix-ote-val`);
                const slVal = document.getElementById(`${prefix}matrix-sl-val`);
                const tp1Val = document.getElementById(`${prefix}matrix-tp1-val`);
                const tp2Val = document.getElementById(`${prefix}matrix-tp2-val`);

                const rrText = plan.risk_reward || plan.rr_ratio || '1:2.5';
                if (rrBadge) rrBadge.innerText = `R:R ${rrText.includes('1:') ? rrText : '1:' + rrText}`;

                if (entryVal) {
                    if (plan.entry_zone) {
                        entryVal.innerText = `${formatP(plan.entry_zone.min)} - ${formatP(plan.entry_zone.max)}`;
                    } else if (plan.entry_price) {
                        entryVal.innerText = `${formatP(plan.entry_price)}`;
                    } else {
                        entryVal.innerText = formatP(currPrice);
                    }
                }

                if (oteVal) {
                    oteVal.innerText = plan.ote_price ? formatP(plan.ote_price) : formatP(plan.entry_price || currPrice);
                }

                if (slVal) {
                    const slDist = plan.sl_distance_pts ? ` (${plan.sl_distance_pts} pts)` : '';
                    slVal.innerHTML = `${formatP(plan.stop_loss)} <small style="color:#fca5a5; font-size:10.5px;">${slDist}</small>`;
                }

                if (tp1Val) {
                    const tp1Dist = plan.tp1_distance_pts ? ` (+${plan.tp1_distance_pts} pts)` : '';
                    tp1Val.innerHTML = `${formatP(plan.take_profit_1)} <small style="color:#86efac; font-size:10.5px;">${tp1Dist}</small>`;
                }

                if (tp2Val) {
                    const tp2Dist = plan.tp2_distance_pts ? ` (+${plan.tp2_distance_pts} pts)` : '';
                    tp2Val.innerHTML = `${formatP(plan.take_profit_2)} <small style="color:#86efac; font-size:10.5px;">${tp2Dist}</small>`;
                }
            };

            updateMatrix('full-');
            updateMatrix('');

            // Confluences Checklist
            const confs = plan.confluences || {};
            const act = plan.action || 'WAIT';

            const updateConfluences = (prefix) => {
                const confScore = document.getElementById(`${prefix}confluence-score`);
                let passedCount = 0;

                const updateConfItem = (id, passed, desc) => {
                    const item = document.getElementById(`${prefix}conf-item-${id}`);
                    const icon = document.getElementById(`${prefix}conf-icon-${id}`);
                    const descEl = document.getElementById(`${prefix}conf-desc-${id}`);
                    if (passed) passedCount++;
                    if (icon) icon.innerText = passed ? '✅' : '⚪';
                    if (descEl && desc) descEl.innerText = desc;
                    if (item) {
                        item.style.opacity = passed ? '1' : '0.65';
                    }
                };

                const structShift = confs.structure_shift !== undefined ? confs.structure_shift : (bias !== 'NEUTRAL');
                updateConfItem('structure', structShift, confs.structure_desc || (act === 'BUY' ? 'เกิด CHoCH/BOS ชนะแนวต้านเดิม ยืนยันขาขึ้น' : (act === 'SELL' ? 'เกิด CHoCH/BOS หลุดแนวรับเดิม ยืนยันขาลง' : 'โครงสร้างตลาดกำลังสะสมพลัง (Re-accumulation)')));
                updateConfItem('ob', confs.ob_present !== undefined ? confs.ob_present : true, confs.ob_desc || `ตรวจพบโซน Order Block แข็งแกร่งใน Timeframe ${style === 'scalping' ? 'M5' : 'M15'}`);
                updateConfItem('fvg', confs.fvg_present !== undefined ? confs.fvg_present : true, confs.fvg_desc || `มีช่องว่างราคา FVG (Imbalance) หนุนทิศทาง`);
                updateConfItem('liq', confs.liq_swept !== undefined ? confs.liq_swept : true, confs.liq_desc || `ราคาเคลียร์สภาพคล่อง ${act === 'BUY' ? 'SSL ใต้ฐานเดิม' : 'BSL เหนือยอดเดิม'} เรียบร้อย`);
                updateConfItem('discount', confs.discount_zone !== undefined ? confs.discount_zone : true, confs.discount_desc || (act === 'BUY' ? 'ราคาอยู่ในโซน Discount (ถูกกว่า 50%) คุ้มค่าต่อการ BUY' : (act === 'SELL' ? 'ราคาอยู่ในโซน Premium (แพงกว่า 50%) คุ้มค่าต่อการ SELL' : 'ราคาอยู่ใกล้จุดกึ่งกลาง Equilibrium 50%')));

                if (confScore) confScore.innerText = `${passedCount}/5 เงื่อนไขครบ`;
            };

            updateConfluences('full-');
            updateConfluences('');

            // Update Pivots & Intel in full view
            if (this.marketIntelData) {
                this.renderMarketIntelModalContent(this.marketIntelData, sym);
            }
        },

        plotSMCPlanAndReturnToChart() {
            if (!this.tradingPlanData) {
                this.showToast('⚠️ กรุณารอข้อมูลการวิเคราะห์แผนเทรดเสร็จสิ้น');
                return;
            }

            const activeChart = (window.chartEngine && window.chartEngine.getActiveChart) ? window.chartEngine.getActiveChart() : null;
            if (!activeChart) {
                this.showToast('⚠️ ไม่พบชาร์ตที่เลือกอยู่');
                return;
            }

            if (window.SMCICTEngine && window.SMCICTEngine.plotTradePlanOnChart) {
                const ok = window.SMCICTEngine.plotTradePlanOnChart(activeChart, this.tradingPlanData, this.activePlanStyle);
                if (ok) {
                    this.showToast(`✨ วาดแผนเทรด SMC (${this.activePlanStyle.toUpperCase()}) ลงบนชาร์ต ${activeChart.symbol} เรียบร้อย!`);
                    this.closeFullAnalysisView();
                    return;
                }
            }

            this.showToast('⚠️ เกิดข้อผิดพลาดในการวาดแผนเทรดลงชาร์ต');
        },

        plotSMCPlanOnChart() {
            this.plotSMCPlanAndReturnToChart();
        }
    };

    // โหลดการตั้งค่าธีม Light / Dark จาก localStorage
    if (window.app && window.app.initTheme) {
        window.app.initTheme();
    }

    // ตรวจสอบและซ่อนปุ่มติดตั้งทันทีหากเครื่องนี้ติดตั้งแอปแล้ว
    if (window.app && window.app.checkIfPWAInstalled) {
        window.app.checkIfPWAInstalled();
    }

    // PWA Service Worker & Install Prompt Setup
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        // ถ้าเครื่องติดตั้งแล้ว หรือรันในโหมด Standalone อยู่ ให้ซ่อนปุ่มและไม่แสดง
        if (localStorage.getItem('tradingtools_pwa_installed') === 'true' ||
            window.navigator.standalone === true ||
            window.matchMedia('(display-mode: standalone)').matches ||
            document.documentElement.classList.contains('app-is-installed')) {
            const btn = document.getElementById('btn-install-pwa');
            if (btn) btn.style.display = 'none';
            return;
        }

        deferredPrompt = e;
        const btn = document.getElementById('btn-install-pwa');
        if (btn) {
            btn.style.display = 'flex';
            btn.classList.add('highlight-install');
        }
        const nativePrompt = document.getElementById('pwa-native-prompt');
        if (nativePrompt) nativePrompt.style.display = 'block';
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        localStorage.setItem('tradingtools_pwa_installed', 'true');
        if (window.app && window.app.hideInstallButton) {
            window.app.hideInstallButton();
        } else {
            const btn = document.getElementById('btn-install-pwa');
            if (btn) btn.style.display = 'none';
        }
        console.log('[PWA] TradingTools installed successfully');
        if (window.app && window.app.showToast) {
            window.app.showToast('🎉 ติดตั้ง TradingTools สำเร็จแล้ว');
        }
    });

    // ตรวจจับเมื่อเปลี่ยนเป็นโหมด Standalone แบบ Dynamic
    try {
        window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
            if (evt.matches && window.app && window.app.hideInstallButton) {
                window.app.hideInstallButton();
            }
        });
    } catch (e) {}

    // ปิดเมนู Custom Timeframe, Custom Layout, และ Custom Tools Dropdown เมื่อคลิกที่อื่น
    window.addEventListener('click', (e) => {
        if (!e.target.closest('#custom-tf-container') && !e.target.closest('#timeframe-picker-modal')) {
            if (window.app && window.app.closeTimeframeDropdown) {
                window.app.closeTimeframeDropdown();
            }
        }
        if (!e.target.closest('#custom-layout-container')) {
            if (window.app && window.app.closeLayoutDropdown) {
                window.app.closeLayoutDropdown();
            }
        }
        if (!e.target.closest('#custom-tools-container') && !e.target.closest('#custom-draw-container') && !e.target.closest('#text-annotation-modal')) {
            if (window.app && window.app.closeToolsMenu) {
                window.app.closeToolsMenu();
            }
            if (window.app && window.app.closeDrawingDropdown) {
                window.app.closeDrawingDropdown();
            }
        }
        if (!e.target.closest('#custom-intel-container')) {
            if (window.app && window.app.closeMarketIntelPopover) {
                window.app.closeMarketIntelPopover();
            }
        }
    });

    // PWA Service Worker & Force-Update Auto Refresh Lifecycle
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js?v=2.6.7')
                .then(reg => {
                    console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
                    
                    // 1. ตรวจสอบอัปเดตทันทีที่เปิดแอป
                    reg.update().catch(() => {});

                    // 2. ตรวจสอบอัปเดตอัตโนมัติทุก 5 นาที
                    setInterval(() => {
                        reg.update().catch(() => {});
                    }, 5 * 60 * 1000);

                    // 3. หากมี Worker รออยู่ ให้สั่ง skipWaiting ทันที
                    if (reg.waiting) {
                        reg.waiting.postMessage({ action: 'skipWaiting' });
                    }

                    // 4. เมื่อพบ Service Worker เวอร์ชันใหม่กำลังติดตั้ง
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[PWA] New version installed! Triggering skipWaiting...');
                                newWorker.postMessage({ action: 'skipWaiting' });
                            }
                        });
                    });
                })
                .catch(err => console.log('[PWA] ServiceWorker registration failed:', err));
        });

        // 5. เมื่อ Service Worker ตัวใหม่เข้าควบคุม (controllerchange) ให้ Auto-Reload หน้าจอทันทีเพื่อโหลดฟีเจอร์ใหม่ทั้งหมด
        let isRefreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (isRefreshing) return;
            isRefreshing = true;
            console.log('[PWA] New Service Worker active -> Auto reloading app to apply new features...');
            if (window.app && window.app.showToast) {
                window.app.showToast('🚀 ระบบอัปเดตฟีเจอร์ใหม่เรียบร้อย กำลังโหลด...');
            }
            setTimeout(() => {
                window.location.reload();
            }, 500);
        });

        // 6. ตรวจสอบอัปเดตเมื่อสลับแท็บกลับมา หรือเปิดหน้าจอ iPad/มือถือขึ้นมาใหม่
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                navigator.serviceWorker.getRegistration().then(reg => {
                    if (reg) reg.update().catch(() => {});
                });
            }
        });

        // 7. รับข้อความ Broadcast จาก Service Worker เมื่อเปิดใช้งานเวอร์ชันใหม่
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                console.log('[PWA] Service Worker updated to version:', event.data.version);
                if (!isRefreshing) {
                    isRefreshing = true;
                    if (window.app && window.app.showToast) {
                        window.app.showToast('🚀 ติดตั้งเวอร์ชันใหม่เรียบร้อย กำลังรีเฟรช...');
                    }
                    setTimeout(() => {
                        window.location.reload();
                    }, 400);
                }
            }
        });
    }

    // คีย์ลัด Alt + R สำหรับรีเซ็ตสเกลกราฟ, Delete/Backspace ลบภาพวาด, Esc สำหรับออกจาก Display Mode
    window.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
            if (window.chartEngine && typeof window.chartEngine.deleteSelectedDrawing === 'function') {
                const hasSelected = window.chartEngine.charts && window.chartEngine.charts.some(c => c && c.selectedDrawingId);
                if (hasSelected) {
                    e.preventDefault();
                    window.chartEngine.deleteSelectedDrawing();
                }
            }
        } else if (e.altKey && (e.key === 'e' || e.key === 'E')) {
            e.preventDefault();
            if (window.app && window.app.selectToolFromPalette) {
                window.app.selectToolFromPalette('eraser');
            }
        } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
            e.preventDefault();
            const active = chartEngine.getActiveChart();
            if (active) {
                chartEngine.resetChartScale(active.index);
            }
        } else if (e.key === 'Escape') {
            if (window.chartEngine && window.chartEngine.isMeasureActive) {
                window.chartEngine.toggleMeasureTool(false);
            }
            if (window.chartEngine && window.chartEngine.isFibonacciActive) {
                window.chartEngine.toggleFibonacciTool(false);
            }
            if (window.chartEngine && window.chartEngine.activeDrawingTool) {
                window.chartEngine.setDrawingTool(null);
            }
            if (window.app && window.app.closeToolsMenu) {
                window.app.closeToolsMenu();
            }
            if (window.app && window.app.updateToolsMenuButton) {
                window.app.updateToolsMenuButton();
            }
            if (window.app && window.app.isDisplayMode) {
                window.app.exitDisplayMode();
            }
        }
    });

    // ตรวจสอบการออกจาก Fullscreen ผ่านเบราว์เซอร์เพื่อซิงค์ Display Mode ให้ตรงกัน
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (window.app && window.app.isDisplayMode) {
                window.app.exitDisplayMode();
            }
        }
    });

    // นาฬิกาบอกเวลาประเทศไทย (Asia/Bangkok, UTC+7 / GMT+7) แบบ Live วิ่งทุกวินาที
    function updateThailandClock() {
        const el = document.getElementById('live-bkk-clock');
        if (!el) return;
        const d = new Date();
        el.innerText = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
    }
    setInterval(updateThailandClock, 1000);
    updateThailandClock();

    // เริ่มต้นระบบติดตามข้อมูลตลาดอัจฉริยะ (Market Intelligence 24/7)
    if (window.app && window.app.fetchMarketIntelligence) {
        window.app.fetchMarketIntelligence();
        setInterval(() => {
            window.app.fetchMarketIntelligence();
        }, 12000);
    }

    console.log('[OK] TradingTools Workstation initialized (v2.6.9) with Market Intelligence Engine.');
});
