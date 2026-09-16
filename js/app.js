/**
 * Main Application Controller
 * เชื่อมโยง UI ทั้งหมดเข้ากับ ChartEngine, ReplayEngine, Watchlist, และ TradeJournal
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Application Version Control & Forced Auto-Migration
    const APP_VERSION = '2.5.5';
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
                'trendline': '📈 เทรนด์ไลน์',
                'horzline': '➖ แนวนอน',
                'horzray': '➡️ เรย์แนวนอน',
                'vertline': '╽ แนวตั้ง',
                'rectangle': '🟩 กล่องโซน',
                'path': '🔀 เส้นทาง',
                'text': '📝 ข้อความ'
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

            if (type === 'PSAR') {
                if (periodGroup) periodGroup.style.display = 'none';
                if (psarGroup) psarGroup.style.display = 'block';
                this.setIndColor('#22c55e');
                if (styleSelect) styleSelect.value = 'dotted';
            } else {
                if (periodGroup) periodGroup.style.display = 'block';
                if (psarGroup) psarGroup.style.display = 'none';

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

            if (isPSAR) {
                if (periodGroup) periodGroup.style.display = 'none';
                if (psarGroup) psarGroup.style.display = 'block';
                const stepInput = document.getElementById('submodal-psar-step');
                const maxInput = document.getElementById('submodal-psar-max');
                if (stepInput) stepInput.value = ind.step || 0.02;
                if (maxInput) maxInput.value = ind.max || 0.20;
            } else {
                if (periodGroup) periodGroup.style.display = 'block';
                if (psarGroup) psarGroup.style.display = 'none';
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
    });

    // PWA Service Worker & Force-Update Auto Refresh Lifecycle
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js?v=2.5.7')
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

    // คีย์ลัด Alt + R สำหรับรีเซ็ตสเกลกราฟที่กำลัง Active, Esc สำหรับออกจาก Display Mode
    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'r' || e.key === 'R')) {
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

    console.log('[OK] TradingTools Workstation initialized (v2.5.5).');
});
