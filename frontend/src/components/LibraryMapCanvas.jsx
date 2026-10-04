import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
    MapPin, Info, MousePointer2, Grid3X3, Trash2, Search,
    X, AlertTriangle, CheckCircle2, RefreshCw, Wand2,
    Package, Sparkles, Move
} from 'lucide-react';

/**
 * LibraryMapCanvas — Location Map & Book Locator
 * ─────────────────────────────────────────────────────────────
 * • Blueprint grid with brown wooden shelves
 * • Interactive 4×5 slot grid inside each shelf
 * • Scale-to-fit responsive design without horizontal page scroll
 * • Book Locator with pulse highlight, pin, and unassigned notice
 * • HTML5 Drag-and-Drop between slots, shelf bodies, and unassigned tray
 * • Collision-aware ghost preview in placement mode
 * • Auto-fix layout and Auto-place by category utilities
 * • Duplicate-slot warning indicators
 */

const MAP_W = 1200;
const MAP_H = 800;
const SHELF_W = 150;
const SHELF_H = 200;
const SNAP_SIZE = 20;
const SLOT_COLS = 4;
const SLOT_ROWS = 5;

// Helpers
const snapToGrid = (val) => Math.round(val / SNAP_SIZE) * SNAP_SIZE;
const pxToPercent = (px, total) => (px / total) * 100;
const percentToPx = (pct, total) => (pct / 100) * total;

const shelfToBox = (cxPct, cyPct, wPx = SHELF_W, hPx = SHELF_H) => {
    const halfW = (wPx / MAP_W * 100) / 2;
    const halfH = (hPx / MAP_H * 100) / 2;
    return {
        left: cxPct - halfW,
        right: cxPct + halfW,
        top: cyPct - halfH,
        bottom: cyPct + halfH
    };
};

const boxesOverlap = (a, b) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const LibraryMapCanvas = ({
    shelves,
    layout = [],
    books = [],
    onPlace,
    onMapClick,
    onShelfDelete,
    onDeleteShelf,
    onRefreshLayout,
    onBooksChange,
    pickedPoint,
    pickedCoordsPx,
    readOnly = false,
    placementMode = false,
}) => {
    // Prop aliases
    const shelfList = useMemo(() => layout && layout.length > 0 ? layout : (shelves || []), [layout, shelves]);
    const handleMapClickCallback = onPlace || onMapClick;
    const handleDeleteShelfCallback = onShelfDelete || onDeleteShelf;
    const handleRefreshCallback = onRefreshLayout || onBooksChange;
    const activePicked = pickedPoint || pickedCoordsPx;

    const mapRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const scaleWrapperRef = useRef(null);

    // Scaling state for responsiveness
    const [canvasScale, setCanvasScale] = useState(1);

    // Interaction states
    const [tooltip, setTooltip] = useState(null);
    const [ghostPos, setGhostPos] = useState(null);
    const [ghostCollides, setGhostCollides] = useState(false);
    const [notice, setNotice] = useState(null); // { type: 'success' | 'error' | 'info', text: string }
    const [isRepairing, setIsRepairing] = useState(false);

    // Book locator search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [locatedBook, setLocatedBook] = useState(null);

    // Tray search & collapse state
    const [traySearch, setTraySearch] = useState('');
    const [isTrayOpen, setIsTrayOpen] = useState(true);

    // HTML5 Dragging state
    const [dragOverTarget, setDragOverTarget] = useState(null); // { shelfID, slotIndex, type: 'slot' | 'shelf' | 'tray' }

    // Auto-dismiss notices after 4 seconds
    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(timer);
    }, [notice]);

    // Responsive scale-to-fit calculation
    useEffect(() => {
        const updateScale = () => {
            if (!scaleWrapperRef.current) return;
            const containerWidth = scaleWrapperRef.current.clientWidth;
            if (containerWidth > 0) {
                // Ensure at least 50px padding room, scale smoothly
                const targetScale = Math.min(1, Math.max(0.55, (containerWidth - 32) / MAP_W));
                setCanvasScale(targetScale);
            }
        };

        updateScale();
        window.addEventListener('resize', updateScale);
        const observer = new ResizeObserver(updateScale);
        if (scaleWrapperRef.current) observer.observe(scaleWrapperRef.current);

        return () => {
            window.removeEventListener('resize', updateScale);
            observer.disconnect();
        };
    }, []);

    // ── Build Shelf & Slot Lookups ─────────────────────────────────────────────
    const { shelfSlotMap, duplicateSlotSet, unassignedBooks } = useMemo(() => {
        const map = {};
        const countMap = {};
        const duplicates = new Set();
        const unassigned = [];

        books.forEach(book => {
            const shelfID = book.Location?.shelfNumber;
            const slot = book.Location?.slotIndex;

            if (shelfID && typeof slot === 'number' && slot > 0) {
                if (!map[shelfID]) map[shelfID] = {};
                // If slot already occupied, record duplicate
                if (map[shelfID][slot]) {
                    duplicates.add(`${shelfID}:${slot}`);
                } else {
                    map[shelfID][slot] = book;
                }

                const key = `${shelfID}:${slot}`;
                countMap[key] = (countMap[key] || 0) + 1;
                if (countMap[key] > 1) duplicates.add(key);
            } else {
                unassigned.push(book);
            }
        });

        return { shelfSlotMap: map, duplicateSlotSet: duplicates, unassignedBooks: unassigned };
    }, [books]);

    // Filter unassigned books for tray search
    const filteredUnassignedBooks = useMemo(() => {
        if (!traySearch.trim()) return unassignedBooks;
        const q = traySearch.toLowerCase();
        return unassignedBooks.filter(b =>
            (b.Title && b.Title.toLowerCase().includes(q)) ||
            (b.Author && b.Author.toLowerCase().includes(q)) ||
            (b.Category && b.Category.toLowerCase().includes(q)) ||
            (b.ISBN && b.ISBN.toLowerCase().includes(q))
        );
    }, [unassignedBooks, traySearch]);

    // ── Book Locator Search Handler ────────────────────────────────────────────
    const handleSearchChange = (e) => {
        const q = e.target.value;
        setSearchQuery(q);
        if (!q.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const lowerQ = q.toLowerCase();
        const matches = books.filter(b =>
            (b.Title && b.Title.toLowerCase().includes(lowerQ)) ||
            (b.Author && b.Author.toLowerCase().includes(lowerQ)) ||
            (b.ISBN && b.ISBN.toLowerCase().includes(lowerQ))
        ).slice(0, 8);
        setSearchResults(matches);
    };

    const selectLocatedBook = (book) => {
        setLocatedBook(book);
        setSearchQuery(book.Title);
        setSearchResults([]);
        setIsSearching(false);

        const shelfID = book.Location?.shelfNumber;
        const slot = book.Location?.slotIndex;

        if (shelfID && slot) {
            const shelf = shelfList.find(s => s.shelfID === shelfID);
            if (shelf) {
                // Scroll canvas to bring shelf into view
                const cx = percentToPx(shelf.coordinateX, MAP_W);
                const cy = percentToPx(shelf.coordinateY, MAP_H);
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTo({
                        left: Math.max(0, cx * canvasScale - 300),
                        top: Math.max(0, cy * canvasScale - 200),
                        behavior: 'smooth'
                    });
                }

                // Show tooltip
                const isAvail = (book.status === 'Available' || book.isAvailable) && (book.availableCount ?? 1) > 0 && book.status !== 'Borrowed';
                setTooltip({
                    book,
                    x: cx,
                    y: cy - (shelf.height || SHELF_H) / 2,
                    isAvailable: isAvail
                });
            }
        } else {
            // Book is unassigned
            setNotice({
                type: 'info',
                text: `"${book.Title}" is currently unassigned (located in right-hand tray).`
            });
            setIsTrayOpen(true);
        }
    };

    const clearLocator = () => {
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
        setLocatedBook(null);
        setTooltip(null);
    };

    // ── Ghost Preview during Placement Mode ──────────────────────────────────
    const handleMouseMoveForGhost = useCallback((e) => {
        if (!placementMode || !mapRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        const rawX = ((e.clientX - rect.left) / rect.width) * MAP_W;
        const rawY = ((e.clientY - rect.top) / rect.height) * MAP_H;
        const snappedX = snapToGrid(rawX);
        const snappedY = snapToGrid(rawY);
        setGhostPos({ x: snappedX, y: snappedY });

        const ghostPct = { x: pxToPercent(snappedX, MAP_W), y: pxToPercent(snappedY, MAP_H) };
        const ghostBox = shelfToBox(ghostPct.x, ghostPct.y);
        const collides = shelfList.some(shelf => {
            const existingBox = shelfToBox(shelf.coordinateX, shelf.coordinateY, shelf.width || SHELF_W, shelf.height || SHELF_H);
            return boxesOverlap(ghostBox, existingBox);
        });
        const oob = ghostBox.left < 0 || ghostBox.right > 100 || ghostBox.top < 0 || ghostBox.bottom > 100;
        setGhostCollides(collides || oob);
    }, [placementMode, shelfList]);

    const handleCanvasClick = useCallback((e) => {
        if (!mapRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        const rawX = ((e.clientX - rect.left) / rect.width) * MAP_W;
        const rawY = ((e.clientY - rect.top) / rect.height) * MAP_H;
        const snappedX = snapToGrid(rawX);
        const snappedY = snapToGrid(rawY);
        const xPct = pxToPercent(snappedX, MAP_W);
        const yPct = pxToPercent(snappedY, MAP_H);

        if (placementMode && handleMapClickCallback) {
            handleMapClickCallback(xPct, yPct, snappedX, snappedY);
        }
    }, [placementMode, handleMapClickCallback]);

    // ── HTML5 Drag and Drop Handlers ──────────────────────────────────────────
    const handleDragStart = (e, book, source) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            bookId: book._id,
            bookTitle: book.Title,
            sourceShelf: book.Location?.shelfNumber || null,
            sourceSlot: book.Location?.slotIndex || null,
            source
        }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, targetInfo) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverTarget?.id !== targetInfo.id) {
            setDragOverTarget(targetInfo);
        }
    };

    const handleDragLeave = () => {
        setDragOverTarget(null);
    };

    const handleDropOnSlot = async (e, targetShelf, targetSlotNumber) => {
        e.preventDefault();
        setDragOverTarget(null);
        try {
            const raw = e.dataTransfer.getData('text/plain');
            if (!raw) return;
            const data = JSON.parse(raw);
            const { bookId, sourceShelf, sourceSlot } = data;

            // Dropping on the exact same slot
            if (sourceShelf === targetShelf.shelfID && sourceSlot === targetSlotNumber) {
                return;
            }

            // Check if slot is occupied
            const occupyingBook = shelfSlotMap[targetShelf.shelfID]?.[targetSlotNumber];
            if (occupyingBook && occupyingBook._id !== bookId) {
                setNotice({
                    type: 'error',
                    text: `Slot ${targetSlotNumber} on "${targetShelf.shelfID}" is already occupied by "${occupyingBook.Title}". Choose an empty slot.`
                });
                return;
            }

            // Call API to move book
            await api.put(`/books/${bookId}/location`, {
                shelfNumber: targetShelf.shelfID,
                slotIndex: targetSlotNumber
            });

            setNotice({
                type: 'success',
                text: `Placed book into ${targetShelf.shelfID} / Slot ${targetSlotNumber}`
            });
            handleRefreshCallback?.();
        } catch (err) {
            console.error('Drop slot error:', err);
            setNotice({
                type: 'error',
                text: err.response?.data?.msg || 'Failed to move book to slot.'
            });
        }
    };

    const handleDropOnShelfBody = async (e, targetShelf) => {
        e.preventDefault();
        setDragOverTarget(null);
        try {
            const raw = e.dataTransfer.getData('text/plain');
            if (!raw) return;
            const data = JSON.parse(raw);
            const { bookId } = data;

            // Auto-assign next free slot on shelf
            const res = await api.put(`/books/${bookId}/location`, {
                shelfNumber: targetShelf.shelfID
            });

            const assignedSlot = res.data.book?.Location?.slotIndex;
            setNotice({
                type: 'success',
                text: `Assigned book to ${targetShelf.shelfID} (Slot ${assignedSlot})`
            });
            handleRefreshCallback?.();
        } catch (err) {
            console.error('Drop shelf error:', err);
            setNotice({
                type: 'error',
                text: err.response?.data?.msg || `Shelf "${targetShelf.shelfID}" is full.`
            });
        }
    };

    const handleDropOnTray = async (e) => {
        e.preventDefault();
        setDragOverTarget(null);
        try {
            const raw = e.dataTransfer.getData('text/plain');
            if (!raw) return;
            const data = JSON.parse(raw);
            const { bookId, sourceShelf } = data;

            if (!sourceShelf) {
                // Already unassigned
                return;
            }

            await api.put(`/books/${bookId}/location`, {
                unassign: true
            });

            setNotice({
                type: 'success',
                text: `Moved book to Unassigned tray.`
            });
            handleRefreshCallback?.();
        } catch (err) {
            console.error('Drop tray error:', err);
            setNotice({
                type: 'error',
                text: err.response?.data?.msg || 'Failed to unassign book.'
            });
        }
    };

    // ── Auto-Fix and Auto-Place Handlers ─────────────────────────────────────
    const runRepair = async (autoPlace = false) => {
        setIsRepairing(true);
        try {
            const res = await api.post('/layout/repair', { autoPlace });
            setNotice({
                type: 'success',
                text: res.data.msg || 'Layout repair completed successfully!'
            });
            handleRefreshCallback?.();
        } catch (err) {
            console.error('Repair error:', err);
            setNotice({
                type: 'error',
                text: err.response?.data?.msg || 'Layout repair failed.'
            });
        } finally {
            setIsRepairing(false);
        }
    };

    // ── Internal Slot Grid Renderer ─────────────────────────────────────────
    const renderSlotGrid = (shelf) => {
        const cols = shelf.slotCols || SLOT_COLS;
        const rows = shelf.slotRows || SLOT_ROWS;
        const total = cols * rows;
        const slotsOnShelf = shelfSlotMap[shelf.shelfID] || {};

        const padX = 12;
        const padY = 32;
        const shelfW = shelf.width || SHELF_W;
        const shelfH = shelf.height || SHELF_H;
        const cellW = (shelfW - padX * 2) / cols;
        const cellH = (shelfH - padY - 10) / rows;

        const slotElements = [];
        for (let i = 1; i <= total; i++) {
            const row = Math.floor((i - 1) / cols);
            const col = (i - 1) % cols;
            const book = slotsOnShelf[i];
            const isOccupied = !!book;
            const isAvailable = book ? ((book.status === 'Available' || book.isAvailable) && (book.availableCount ?? 1) > 0 && book.status !== 'Borrowed') : false;

            const isDuplicate = duplicateSlotSet.has(`${shelf.shelfID}:${i}`);
            const isLocated = locatedBook && locatedBook._id === book?._id;
            const isDragOver = dragOverTarget?.id === `${shelf.shelfID}-${i}`;

            slotElements.push(
                <div
                    key={i}
                    id={`slot-${shelf.shelfID}-${i}`}
                    draggable={isOccupied && !readOnly}
                    onDragStart={(e) => isOccupied && handleDragStart(e, book, 'slot')}
                    onDragOver={(e) => handleDragOver(e, { id: `${shelf.shelfID}-${i}`, shelfID: shelf.shelfID, slotIndex: i })}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropOnSlot(e, shelf, i)}
                    className={`absolute rounded-sm border transition-all ${
                        isOccupied ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${
                        isLocated
                            ? 'ring-4 ring-amber-400 bg-amber-400 border-amber-500 scale-125 z-30 animate-pulse shadow-lg shadow-amber-400/80'
                            : isDuplicate
                            ? 'ring-2 ring-red-500 bg-red-500/90 border-red-600 animate-pulse'
                            : isDragOver
                            ? 'ring-2 ring-emerald-400 bg-emerald-400/50 border-emerald-500 scale-110'
                            : isOccupied
                            ? isAvailable
                                ? 'bg-blue-400/80 border-blue-500 shadow-sm shadow-blue-400/30 hover:brightness-110'
                                : 'bg-rose-400/80 border-rose-500 shadow-sm shadow-rose-400/40 hover:brightness-110'
                            : 'bg-white/10 border-white/20 hover:bg-white/30 hover:border-white/40'
                    }`}
                    style={{
                        left: padX + col * cellW + 2,
                        top: padY + row * cellH + 2,
                        width: cellW - 4,
                        height: cellH - 4,
                    }}
                    title={
                        isDuplicate
                            ? `⚠️ DUPLICATE: Slot ${i} has multiple books!`
                            : isOccupied
                            ? `Slot ${i}: ${book.Title} (${isAvailable ? 'Available' : 'Issued'})`
                            : `Slot ${i}: Empty (Drop book here)`
                    }
                    onMouseEnter={() => {
                        if (isOccupied) {
                            const cx = percentToPx(shelf.coordinateX, MAP_W);
                            const cy = percentToPx(shelf.coordinateY, MAP_H);
                            const shelfLeft = cx - (shelf.width || SHELF_W) / 2;
                            const shelfTop = cy - (shelf.height || SHELF_H) / 2;
                            setTooltip({
                                book,
                                x: shelfLeft + padX + col * cellW + cellW / 2,
                                y: shelfTop + padY + row * cellH + cellH / 2,
                                isAvailable
                            });
                        }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                >
                    {isLocated && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none">
                            <MapPin className="w-3.5 h-3.5 text-amber-500 fill-amber-400 drop-shadow" />
                        </div>
                    )}
                </div>
            );
        }
        return slotElements;
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-100 overflow-hidden select-none font-sans">
            {/* ── Top Controls & Locator Toolbar ──────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm z-30">
                {/* Book Locator Search Input */}
                <div className="relative flex-1 min-w-[280px] max-w-md">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Find book by title, author, or ISBN..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
                        {searchQuery && (
                            <button
                                onClick={clearLocator}
                                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Locator Search Results Dropdown */}
                    {isSearching && searchResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto z-50 p-1">
                            {searchResults.map(b => {
                                const isShelved = b.Location?.shelfNumber && b.Location?.slotIndex;
                                return (
                                    <button
                                        key={b._id}
                                        type="button"
                                        onClick={() => selectLocatedBook(b)}
                                        className="w-full text-left p-2 rounded-lg hover:bg-sky-50 flex items-center justify-between text-xs transition"
                                    >
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className="font-bold text-slate-800 truncate">{b.Title}</span>
                                            <span className="text-[10px] text-slate-500 truncate">{b.Author} · ISBN: {b.ISBN}</span>
                                        </div>
                                        <div className="shrink-0">
                                            {isShelved ? (
                                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono text-[10px] font-bold">
                                                    {b.Location.shelfNumber} : #{b.Location.slotIndex}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-mono text-[10px] font-bold">
                                                    Unassigned
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Located Book Indicator Banner */}
                {locatedBook && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-900">
                        <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate max-w-[200px]">{locatedBook.Title}</span>
                        <span className="text-amber-700 font-mono text-[11px]">
                            {locatedBook.Location?.shelfNumber
                                ? `(${locatedBook.Location.shelfNumber} / Slot ${locatedBook.Location.slotIndex})`
                                : '(Not on a shelf)'}
                        </span>
                        <button onClick={clearLocator} className="text-amber-500 hover:text-amber-800 ml-1">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Layout Action Buttons */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => runRepair(false)}
                        disabled={isRepairing}
                        className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        title="Align off-map shelves and resolve duplicate slot numbers"
                    >
                        {isRepairing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        Auto-fix Layout
                    </button>

                    <button
                        type="button"
                        onClick={() => runRepair(true)}
                        disabled={isRepairing}
                        className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        title="Auto-assign unshelved books to matching shelves by category"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Auto-place All
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsTrayOpen(!isTrayOpen)}
                        className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            isTrayOpen ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-white border-slate-300 text-slate-700'
                        }`}
                    >
                        <Package className="w-3.5 h-3.5" />
                        Unassigned Tray ({unassignedBooks.length})
                    </button>
                </div>
            </div>

            {/* Notification Toast */}
            {notice && (
                <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between border-b transition-all ${
                    notice.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : notice.type === 'info'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {notice.type === 'error' ? (
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        <span>{notice.text}</span>
                    </div>
                    <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* ── Main Canvas & Tray Split View ────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden relative" ref={scaleWrapperRef}>
                {/* Scrollable Map Area */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-auto bg-[#0f172a]/5 p-6 flex items-start justify-center cursor-crosshair relative"
                >
                    {/* Scale wrapper for responsive fit without sideways page scroll */}
                    <div
                        style={{
                            width: MAP_W * canvasScale,
                            height: MAP_H * canvasScale,
                            position: 'relative'
                        }}
                    >
                        <div
                            ref={mapRef}
                            onClick={handleCanvasClick}
                            onMouseMove={handleMouseMoveForGhost}
                            onMouseLeave={() => { setGhostPos(null); setGhostCollides(false); }}
                            className={`relative bg-white border-2 rounded-2xl shadow-2xl overflow-hidden select-none transition-colors ${
                                placementMode ? 'border-emerald-400 ring-4 ring-emerald-200/50' : 'border-slate-300'
                            }`}
                            style={{
                                width: MAP_W,
                                height: MAP_H,
                                transform: `scale(${canvasScale})`,
                                transformOrigin: 'top left'
                            }}
                        >
                            {/* Blueprint Grid Background */}
                            <div className="absolute inset-0 pointer-events-none opacity-[0.14]"
                                style={{
                                    backgroundImage: `linear-gradient(to right, #3b82f6 1.5px, transparent 1.5px), 
                                                      linear-gradient(to bottom, #3b82f6 1.5px, transparent 1.5px)`,
                                    backgroundSize: '80px 80px'
                                }}
                            />
                            <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                                style={{
                                    backgroundImage: `linear-gradient(to right, #3b82f6 1px, transparent 1px), 
                                                      linear-gradient(to bottom, #3b82f6 1px, transparent 1px)`,
                                    backgroundSize: `${SNAP_SIZE}px ${SNAP_SIZE}px`
                                }}
                            />

                            {/* Placement Mode Top Banner */}
                            {placementMode && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-emerald-500 text-white px-6 py-2 rounded-full shadow-lg text-xs font-bold tracking-wider flex items-center gap-2 animate-pulse">
                                    <Grid3X3 className="w-4 h-4" />
                                    PLACEMENT MODE — Click canvas to set coordinates
                                </div>
                            )}

                            {/* Active Picked Point Indicator */}
                            {activePicked && (
                                <div
                                    className="absolute z-30 pointer-events-none flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                                    style={{ left: activePicked.x, top: activePicked.y }}
                                >
                                    <div className="w-6 h-6 rounded-full border-2 border-emerald-500 bg-emerald-400/40 animate-ping absolute" />
                                    <MapPin className="w-6 h-6 text-emerald-600 fill-emerald-400 drop-shadow" />
                                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 bg-white/90 px-1.5 py-0.5 rounded shadow mt-1">
                                        Target Position
                                    </span>
                                </div>
                            )}

                            {/* Technical Legend */}
                            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md border border-slate-300 rounded-xl p-3 shadow-lg z-30 flex flex-col gap-2 min-w-[130px]">
                                <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1">Legend</h4>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-blue-400 border border-blue-500 shadow-sm" />
                                    <span className="text-[10px] font-bold text-slate-600">Available</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-rose-400 border border-rose-500 shadow-sm" />
                                    <span className="text-[10px] font-bold text-slate-600">Issued</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-white/10 border border-white/20 ring-1 ring-slate-300" />
                                    <span className="text-[10px] font-bold text-slate-600">Empty Slot</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-red-500 ring-2 ring-red-400" />
                                    <span className="text-[10px] font-bold text-red-600">Duplicate</span>
                                </div>
                            </div>

                            {/* Shelves List */}
                            {shelfList.map(shelf => {
                                const shelfW = shelf.width || SHELF_W;
                                const shelfH = shelf.height || SHELF_H;
                                const booksOnShelf = shelfSlotMap[shelf.shelfID] || {};
                                const occupiedCount = Object.keys(booksOnShelf).length;
                                const totalSlots = (shelf.slotCols || SLOT_COLS) * (shelf.slotRows || SLOT_ROWS);

                                return (
                                    <div
                                        key={shelf._id || shelf.shelfID}
                                        onDragOver={(e) => handleDragOver(e, { id: `shelf-${shelf.shelfID}`, shelfID: shelf.shelfID, type: 'shelf' })}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDropOnShelfBody(e, shelf)}
                                        className={`absolute bg-[#8B4513] border-2 border-amber-900 rounded-lg shadow-lg flex flex-col items-center transition-all group ${
                                            dragOverTarget?.id === `shelf-${shelf.shelfID}`
                                                ? 'ring-4 ring-sky-400 scale-[1.02]'
                                                : 'hover:scale-[1.01]'
                                        }`}
                                        style={{
                                            left: `${shelf.coordinateX}%`,
                                            top: `${shelf.coordinateY}%`,
                                            width: `${shelfW}px`,
                                            height: `${shelfH}px`,
                                            transform: 'translate(-50%, -50%)',
                                        }}
                                    >
                                        {/* Shelf Header */}
                                        <div className="absolute top-0 left-0 right-0 h-7 bg-amber-900/80 flex items-center justify-between px-2.5 rounded-t-md z-10">
                                            <span className="text-white text-[10px] font-black uppercase tracking-wider truncate max-w-[85px]">
                                                {shelf.shelfID}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-amber-200 text-[8px] font-mono font-bold bg-amber-950/60 px-1.5 py-0.5 rounded">
                                                    {occupiedCount}/{totalSlots}
                                                </span>
                                                {!readOnly && handleDeleteShelfCallback && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteShelfCallback(shelf);
                                                        }}
                                                        className="text-amber-300/70 hover:text-red-400 p-0.5 rounded transition"
                                                        title={`Delete shelf "${shelf.shelfID}"`}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Internal Slot Grid */}
                                        {renderSlotGrid(shelf)}

                                        {/* Shelf Label Footer */}
                                        <span className="absolute bottom-1 text-[7px] text-amber-200/60 font-medium uppercase tracking-tight truncate px-2 max-w-full">
                                            {shelf.label || 'Storage Unit'}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Ghost Preview Shelf (Placement Mode) */}
                            {placementMode && ghostPos && (
                                <div
                                    className={`absolute rounded-lg border-2 border-dashed pointer-events-none z-30 flex flex-col items-center justify-center transition-colors ${
                                        ghostCollides
                                            ? 'bg-red-500/20 border-red-500'
                                            : 'bg-emerald-500/20 border-emerald-500'
                                    }`}
                                    style={{
                                        left: ghostPos.x - SHELF_W / 2,
                                        top: ghostPos.y - SHELF_H / 2,
                                        width: SHELF_W,
                                        height: SHELF_H,
                                    }}
                                >
                                    <div className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/90 shadow ${
                                        ghostCollides ? 'text-red-600' : 'text-emerald-600'
                                    }`}>
                                        {ghostCollides ? '✕ SPACE OCCUPIED' : '✓ CLICK TO SET'}
                                    </div>
                                </div>
                            )}

                            {/* Dark Detailed Tooltip */}
                            {tooltip && (
                                <div 
                                    className="absolute z-[100] w-72 bg-slate-900/95 backdrop-blur-lg border border-slate-700 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)] pointer-events-none transition-all duration-200"
                                    style={{
                                        left: tooltip.x + 20 > MAP_W - 300 ? tooltip.x - 300 : tooltip.x + 15,
                                        top: tooltip.y + 20 > MAP_H - 180 ? tooltip.y - 180 : tooltip.y + 15,
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className="text-[9px] font-black text-sky-400 uppercase tracking-widest leading-none mb-1">
                                                Book Info
                                            </span>
                                            <h5 className="text-xs font-black text-white leading-tight truncate">
                                                {tooltip.book.Title}
                                            </h5>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight border flex items-center gap-1 shrink-0 ${
                                            tooltip.isAvailable
                                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/50'
                                                : 'bg-rose-950/60 text-rose-400 border-rose-500/50'
                                        }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${tooltip.isAvailable ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                            {tooltip.isAvailable ? 'Available' : (tooltip.book.status || 'Issued')}
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-[11px]">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 bg-slate-800 rounded">
                                                <Info className="w-3 h-3 text-slate-400" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[8px] text-slate-500 font-bold uppercase">Author</span>
                                                <span className="text-slate-200 font-semibold truncate">{tooltip.book.Author || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="p-1 bg-slate-800 rounded">
                                                <MapPin className="w-3 h-3 text-slate-400" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] text-slate-500 font-bold uppercase">Location</span>
                                                <span className="text-slate-200 font-semibold">
                                                    {tooltip.book.Location?.shelfNumber || 'Unassigned'} / Slot {tooltip.book.Location?.slotIndex || '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`mt-3 w-full h-1 rounded-full ${tooltip.isAvailable ? 'bg-blue-500' : 'bg-rose-500'}`} />
                                </div>
                            )}

                            {/* Canvas Navigation Hint Pill */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md px-5 py-2 rounded-full border border-slate-200 shadow-xl flex items-center gap-3 z-30 pointer-events-none">
                                <MousePointer2 className="w-3.5 h-3.5 text-sky-600" />
                                <span className="text-[10px] font-bold text-slate-700 tracking-tight flex items-center gap-2">
                                    {placementMode ? (
                                        <>
                                            <span className="text-emerald-600">📐 CLICK CANVAS</span> TO SET SHELF POSITION
                                            <span className="text-slate-300">|</span>
                                            <span className="text-slate-500">SNAP: {SNAP_SIZE}px</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-sky-600">🖱️ HOVER</span> FOR DETAILS
                                            <span className="text-slate-300">|</span>
                                            <span className="text-amber-600">✋ DRAG & DROP</span> SLOTS OR TO TRAY
                                        </>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Unassigned Books Side Tray ──────────────────────────────── */}
                {isTrayOpen && (
                    <div
                        onDragOver={(e) => handleDragOver(e, { id: 'tray-dropzone', type: 'tray' })}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDropOnTray}
                        className={`w-72 bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-lg transition-all z-20 ${
                            dragOverTarget?.type === 'tray' ? 'ring-4 ring-inset ring-amber-400 bg-amber-50/50' : ''
                        }`}
                    >
                        {/* Tray Header */}
                        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-sky-600" />
                                <h4 className="text-xs font-bold text-slate-800">Unassigned Books</h4>
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sky-100 text-sky-800 rounded-full">
                                    {unassignedBooks.length}
                                </span>
                            </div>
                            <button
                                onClick={() => setIsTrayOpen(false)}
                                className="text-slate-400 hover:text-slate-600 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Tray Drop Zone Banner */}
                        <div className="px-3 py-2 bg-sky-50/60 border-b border-sky-100 text-[10px] text-sky-800 flex items-center gap-2">
                            <Move className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span>Drag a shelf book here to unassign it, or drag books below onto the map.</span>
                        </div>

                        {/* Tray Filter Input */}
                        <div className="p-2 border-b border-slate-100">
                            <input
                                type="text"
                                placeholder="Filter unassigned..."
                                value={traySearch}
                                onChange={(e) => setTraySearch(e.target.value)}
                                className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                        </div>

                        {/* Tray Books List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {filteredUnassignedBooks.map(book => {
                                const isLocated = locatedBook && locatedBook._id === book._id;
                                return (
                                    <div
                                        key={book._id}
                                        draggable={!readOnly}
                                        onDragStart={(e) => handleDragStart(e, book, 'tray')}
                                        onClick={() => selectLocatedBook(book)}
                                        className={`p-2.5 rounded-lg border text-xs cursor-grab active:cursor-grabbing transition-all ${
                                            isLocated
                                                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                                                : 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-1">
                                            <h5 className="font-bold text-slate-800 leading-tight truncate">
                                                {book.Title}
                                            </h5>
                                            <span className="text-[9px] font-mono px-1 bg-slate-100 text-slate-600 rounded shrink-0">
                                                {book.Category || 'General'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{book.Author}</p>
                                        <div className="flex items-center justify-between text-[9px] text-slate-400 mt-2 pt-1 border-t border-slate-100">
                                            <span>ISBN: {book.ISBN}</span>
                                            <span className="text-sky-600 font-semibold flex items-center gap-1">
                                                <Move className="w-2.5 h-2.5" /> Drag to shelf
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredUnassignedBooks.length === 0 && (
                                <div className="p-8 text-center text-slate-400 text-xs italic">
                                    {unassignedBooks.length === 0
                                        ? 'All books are assigned to shelves!'
                                        : 'No matching unassigned books.'}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LibraryMapCanvas;
