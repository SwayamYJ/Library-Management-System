const express = require('express');
const router = express.Router();
const LibraryLayout = require('../models/LibraryLayout');
const Book = require('../models/Book');
const Activity = require('../models/Activity');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { getNextFreeSlot, pickShelfForCategory, totalSlotsOf } = require('../utils/slots');

// ── Constants for OSMA coordinate conversion ─────────────────────────────────
const MAP_W = 1200; // Reference canvas width in px
const MAP_H = 800;  // Reference canvas height in px
const UNIFORM_WIDTH = 150;  // Fixed shelf width in px
const UNIFORM_HEIGHT = 200; // Fixed shelf height in px

// ── AABB Collision Detection Helper ──────────────────────────────────────────
const boxesOverlap = (a, b) => {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
};

const shelfToBox = (centerXPercent, centerYPercent, widthPx = UNIFORM_WIDTH, heightPx = UNIFORM_HEIGHT) => {
    const halfW = (widthPx / MAP_W * 100) / 2;
    const halfH = (heightPx / MAP_H * 100) / 2;
    return {
        left: centerXPercent - halfW,
        right: centerXPercent + halfW,
        top: centerYPercent - halfH,
        bottom: centerYPercent + halfH
    };
};

// @route   GET api/layout
// @desc    Get library layout map
router.get('/', async (req, res) => {
    try {
        const layout = await LibraryLayout.find();
        res.json(layout);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// @route   GET api/layout/next-slot/:shelfID
// @desc    Find the next available slot index for a given shelf
// @access  Private/Admin
router.get('/next-slot/:shelfID', [auth, admin], async (req, res) => {
    try {
        const { shelfID } = req.params;

        const shelf = await LibraryLayout.findOne({ shelfID });
        if (!shelf) return res.status(404).json({ msg: 'Shelf not found.' });

        const totalSlots = shelf.totalSlots || 20;

        const booksOnShelf = await Book.find({ 'Location.shelfNumber': shelfID });
        const occupiedSlots = new Set(booksOnShelf.map(b => b.Location?.slotIndex).filter(Boolean));

        let nextSlot = null;
        for (let i = 1; i <= totalSlots; i++) {
            if (!occupiedSlots.has(i)) {
                nextSlot = i;
                break;
            }
        }

        res.json({
            shelfID,
            totalSlots,
            occupiedCount: occupiedSlots.size,
            occupiedSlots: [...occupiedSlots].sort((a, b) => a - b),
            nextAvailableSlot: nextSlot,
            isFull: nextSlot === null
        });
    } catch (err) {
        console.error('Next slot error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/layout
// @desc    Add a shelf to layout with collision detection
// @access  Private/Admin
router.post('/', [auth, admin], async (req, res) => {
    const { shelfID, label, coordinateX, coordinateY } = req.body;

    const width = UNIFORM_WIDTH;
    const height = UNIFORM_HEIGHT;
    const slotCols = 4;
    const slotRows = 5;
    const totalSlots = slotCols * slotRows;

    try {
        const existingID = await LibraryLayout.findOne({ shelfID });
        if (existingID) {
            return res.status(400).json({ msg: `A shelf with ID "${shelfID}" already exists.` });
        }

        const newBox = shelfToBox(coordinateX, coordinateY, width, height);

        if (newBox.left < 0 || newBox.right > 100 || newBox.top < 0 || newBox.bottom > 100) {
            return res.status(409).json({ 
                msg: 'Shelf placement is partially outside the map boundaries. Please place it fully within the canvas.',
                type: 'OUT_OF_BOUNDS'
            });
        }

        const allShelves = await LibraryLayout.find();
        for (const existing of allShelves) {
            const existingBox = shelfToBox(
                existing.coordinateX, 
                existing.coordinateY, 
                existing.width || UNIFORM_WIDTH, 
                existing.height || UNIFORM_HEIGHT
            );

            if (boxesOverlap(newBox, existingBox)) {
                return res.status(409).json({
                    msg: `Space Occupied! The new shelf overlaps with "${existing.shelfID}" (${existing.label}). Please choose a different position.`,
                    type: 'COLLISION',
                    collidingWith: existing.shelfID
                });
            }
        }

        const newShelf = new LibraryLayout({
            shelfID,
            label,
            coordinateX,
            coordinateY,
            width,
            height,
            slotCols,
            slotRows,
            totalSlots
        });

        await newShelf.save();
        console.log(`📍 Shelf "${shelfID}" placed at (${coordinateX.toFixed(1)}%, ${coordinateY.toFixed(1)}%) — ${totalSlots} slots`);
        res.json(newShelf);
    } catch (err) {
        console.error('Layout POST error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/layout/:id
// @desc    Edit a shelf (label, coordinates, shelfID)
// @access  Private/Admin
router.put('/:id', [auth, admin], async (req, res) => {
    try {
        const shelf = await LibraryLayout.findById(req.params.id);
        if (!shelf) return res.status(404).json({ msg: 'Shelf not found.' });

        const { shelfID, label, coordinateX, coordinateY } = req.body;
        const oldShelfID = shelf.shelfID;

        if (shelfID && shelfID !== oldShelfID) {
            const duplicate = await LibraryLayout.findOne({ shelfID, _id: { $ne: shelf._id } });
            if (duplicate) {
                return res.status(400).json({ msg: `A shelf with ID "${shelfID}" already exists.` });
            }
            shelf.shelfID = shelfID;
        }

        if (label !== undefined) shelf.label = label;

        if (coordinateX !== undefined && coordinateY !== undefined) {
            const newBox = shelfToBox(coordinateX, coordinateY, shelf.width || UNIFORM_WIDTH, shelf.height || UNIFORM_HEIGHT);

            if (newBox.left < 0 || newBox.right > 100 || newBox.top < 0 || newBox.bottom > 100) {
                return res.status(409).json({
                    msg: 'Shelf placement is outside map boundaries.',
                    type: 'OUT_OF_BOUNDS'
                });
            }

            const otherShelves = await LibraryLayout.find({ _id: { $ne: shelf._id } });
            for (const existing of otherShelves) {
                const existingBox = shelfToBox(
                    existing.coordinateX,
                    existing.coordinateY,
                    existing.width || UNIFORM_WIDTH,
                    existing.height || UNIFORM_HEIGHT
                );

                if (boxesOverlap(newBox, existingBox)) {
                    return res.status(409).json({
                        msg: `Cannot move shelf: Overlaps with "${existing.shelfID}" (${existing.label}).`,
                        type: 'COLLISION'
                    });
                }
            }

            shelf.coordinateX = coordinateX;
            shelf.coordinateY = coordinateY;
        }

        await shelf.save();

        // If shelfID changed, update all books with that shelfNumber
        if (shelfID && shelfID !== oldShelfID) {
            await Book.updateMany(
                { 'Location.shelfNumber': oldShelfID },
                { $set: { 'Location.shelfNumber': shelfID } }
            );
        }

        res.json(shelf);
    } catch (err) {
        console.error('Shelf update error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/layout/:id
// @desc    Delete a shelf
// @access  Private Admin
router.delete('/:id', [auth, admin], async (req, res) => {
    try {
        const shelf = await LibraryLayout.findById(req.params.id);
        if (!shelf) return res.status(404).json({ msg: 'Shelf not found.' });

        const shelfID = shelf.shelfID;

        const booksOnShelf = await Book.find({ 'Location.shelfNumber': shelfID });
        const bookIds = booksOnShelf.map(b => b._id);

        if (bookIds.length > 0) {
            const activeRentals = await Activity.findOne({
                bookId: { $in: bookIds },
                status: 'Active'
            });

            if (activeRentals) {
                return res.status(400).json({
                    msg: `Cannot delete shelf while books are currently rented from it. Please wait until all active rentals for "${shelfID}" are returned.`
                });
            }
        }

        const unassigned = await Book.updateMany(
            { 'Location.shelfNumber': shelfID },
            { $set: { 'Location.shelfNumber': null, 'Location.slotIndex': null } }
        );

        await LibraryLayout.findByIdAndDelete(req.params.id);

        res.json({
            msg: `Shelf "${shelfID}" deleted. ${unassigned.modifiedCount} book(s) moved to Unassigned.`,
            unassignedCount: unassigned.modifiedCount
        });
    } catch (err) {
        console.error('Shelf delete error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/layout/repair
// @desc    Repair layout: clamp off-map shelves, resolve collisions, deduplicate slots, optional autoPlace
// @access  Private Admin
router.post('/repair', [auth, admin], async (req, res) => {
    try {
        const autoPlace = req.body?.autoPlace === true;

        // 1. Repair shelves
        const shelves = await LibraryLayout.find();
        let shelvesRepaired = 0;
        const placedBoxes = [];

        // Candidate grid positions for resolving collisions / out of bounds
        const candidatePositions = [
            { x: 20, y: 30 }, { x: 50, y: 30 }, { x: 80, y: 30 },
            { x: 20, y: 70 }, { x: 50, y: 70 }, { x: 80, y: 70 },
            { x: 35, y: 50 }, { x: 65, y: 50 }
        ];

        for (const shelf of shelves) {
            let modified = false;
            const w = shelf.width || UNIFORM_WIDTH;
            const h = shelf.height || UNIFORM_HEIGHT;
            if (!shelf.width || shelf.width !== UNIFORM_WIDTH) { shelf.width = UNIFORM_WIDTH; modified = true; }
            if (!shelf.height || shelf.height !== UNIFORM_HEIGHT) { shelf.height = UNIFORM_HEIGHT; modified = true; }
            if (shelf.slotCols !== 4 || shelf.slotRows !== 5 || shelf.totalSlots !== 20) {
                shelf.slotCols = 4;
                shelf.slotRows = 5;
                shelf.totalSlots = 20;
                modified = true;
            }

            let box = shelfToBox(shelf.coordinateX, shelf.coordinateY, w, h);
            let isOOB = box.left < 0 || box.right > 100 || box.top < 0 || box.bottom > 100;
            let isCollision = placedBoxes.some(b => boxesOverlap(box, b));

            if (isOOB || isCollision) {
                // Find first candidate position that does not collide
                let foundPos = null;
                for (const pos of candidatePositions) {
                    const testBox = shelfToBox(pos.x, pos.y, w, h);
                    const collides = placedBoxes.some(b => boxesOverlap(testBox, b));
                    if (!collides) {
                        foundPos = pos;
                        break;
                    }
                }

                if (foundPos) {
                    shelf.coordinateX = foundPos.x;
                    shelf.coordinateY = foundPos.y;
                } else {
                    // Fallback clamp
                    const halfW = (w / MAP_W * 100) / 2;
                    const halfH = (h / MAP_H * 100) / 2;
                    shelf.coordinateX = Math.max(halfW, Math.min(100 - halfW, shelf.coordinateX));
                    shelf.coordinateY = Math.max(halfH, Math.min(100 - halfH, shelf.coordinateY));
                }

                box = shelfToBox(shelf.coordinateX, shelf.coordinateY, w, h);
                modified = true;
            }

            placedBoxes.push(box);
            if (modified) {
                await shelf.save();
                shelvesRepaired++;
            }
        }

        // 2. Repair book slots & assignments
        const currentShelves = await LibraryLayout.find();
        const validShelves = new Map(currentShelves.map(s => [s.shelfID, s]));
        const shelfOccupied = {};
        for (const s of currentShelves) {
            shelfOccupied[s.shelfID] = new Set();
        }

        const books = await Book.find();
        let booksRepaired = 0;
        let unassignedCount = 0;

        const unplacedBooks = [];

        // Pass 1: Keep books that already have valid non-colliding slots on an existing shelf
        for (const book of books) {
            const sID = book.Location?.shelfNumber;
            const slot = book.Location?.slotIndex;
            const shelf = validShelves.get(sID);

            if (shelf && typeof slot === 'number' && slot >= 1 && slot <= totalSlotsOf(shelf) && !shelfOccupied[sID].has(slot)) {
                shelfOccupied[sID].add(slot);
            } else {
                unplacedBooks.push(book);
            }
        }

        // Pass 2: For books on a valid shelf that had invalid/duplicate slot, reassign on that same shelf
        const displacedBooks = [];
        for (const book of unplacedBooks) {
            const sID = book.Location?.shelfNumber;
            const shelf = validShelves.get(sID);
            if (shelf) {
                const maxSlots = totalSlotsOf(shelf);
                let assignedSlot = null;
                for (let i = 1; i <= maxSlots; i++) {
                    if (!shelfOccupied[sID].has(i)) {
                        assignedSlot = i;
                        shelfOccupied[sID].add(i);
                        break;
                    }
                }
                if (assignedSlot) {
                    book.Location.slotIndex = assignedSlot;
                    await book.save();
                    booksRepaired++;
                } else {
                    displacedBooks.push(book);
                }
            } else {
                displacedBooks.push(book);
            }
        }

        // Pass 3: Displaced / unshelved books
        for (const book of displacedBooks) {
            if (!book.Location) book.Location = {};

            if (autoPlace) {
                const prefShelfID = await pickShelfForCategory(book.Category, LibraryLayout);
                let targetShelf = null;
                let targetSlot = null;

                if (prefShelfID && validShelves.has(prefShelfID)) {
                    const prefShelf = validShelves.get(prefShelfID);
                    const maxSlots = totalSlotsOf(prefShelf);
                    for (let i = 1; i <= maxSlots; i++) {
                        if (!shelfOccupied[prefShelfID].has(i)) {
                            targetShelf = prefShelf;
                            targetSlot = i;
                            shelfOccupied[prefShelfID].add(i);
                            break;
                        }
                    }
                }

                // If preferred shelf is full or not found, try any other shelf
                if (!targetSlot) {
                    for (const [sID, sh] of validShelves.entries()) {
                        const maxSlots = totalSlotsOf(sh);
                        for (let i = 1; i <= maxSlots; i++) {
                            if (!shelfOccupied[sID].has(i)) {
                                targetShelf = sh;
                                targetSlot = i;
                                shelfOccupied[sID].add(i);
                                break;
                            }
                        }
                        if (targetSlot) break;
                    }
                }

                if (targetSlot && targetShelf) {
                    book.Location.shelfNumber = targetShelf.shelfID;
                    book.Location.slotIndex = targetSlot;
                    book.Location.floor = '1';
                    book.Location.section = targetShelf.label || 'General';
                    await book.save();
                    booksRepaired++;
                } else {
                    book.Location.shelfNumber = null;
                    book.Location.slotIndex = null;
                    await book.save();
                    unassignedCount++;
                }
            } else {
                // autoPlace is false: cleanly unassign
                if (book.Location.shelfNumber !== null || book.Location.slotIndex !== null) {
                    book.Location.shelfNumber = null;
                    book.Location.slotIndex = null;
                    await book.save();
                    booksRepaired++;
                }
                unassignedCount++;
            }
        }

        res.json({
            success: true,
            msg: `Layout repair complete. ${shelvesRepaired} shelf/shelves adjusted, ${booksRepaired} book(s) reassigned, ${unassignedCount} book(s) unassigned.`,
            shelvesRepaired,
            booksRepaired,
            unassignedCount,
            shelves: await LibraryLayout.find()
        });
    } catch (err) {
        console.error('Layout repair error:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
