/**
 * slots.js — Library Slot & Shelf Utility Helpers
 */

/**
 * Returns total slots available on a given shelf layout object
 * @param {Object} shelf
 * @returns {number}
 */
const totalSlotsOf = (shelf) => {
    if (!shelf) return 20;
    if (typeof shelf.totalSlots === 'number' && shelf.totalSlots > 0) {
        return shelf.totalSlots;
    }
    const cols = shelf.slotCols || 4;
    const rows = shelf.slotRows || 5;
    return cols * rows;
};

/**
 * Finds the next available free slot index (1-based) on a shelf
 * @param {string} shelfID
 * @param {Object} BookModel
 * @param {Object} LibraryLayoutModel
 * @returns {Promise<number|null>} next free slot index, or null if shelf is full or not found
 */
const getNextFreeSlot = async (shelfID, BookModel, LibraryLayoutModel) => {
    if (!shelfID) return null;

    let totalSlots = 20;
    if (LibraryLayoutModel) {
        const shelf = await LibraryLayoutModel.findOne({ shelfID });
        if (!shelf) return null;
        totalSlots = totalSlotsOf(shelf);
    }

    const booksOnShelf = await BookModel.find({ 'Location.shelfNumber': shelfID }).lean();
    const occupiedSlots = new Set();
    for (const b of booksOnShelf) {
        const slot = b.Location?.slotIndex;
        if (typeof slot === 'number' && slot > 0) {
            occupiedSlots.add(slot);
        }
    }

    for (let slot = 1; slot <= totalSlots; slot++) {
        if (!occupiedSlots.has(slot)) {
            return slot;
        }
    }

    return null; // All slots occupied
};

/**
 * Picks an appropriate shelfID for a given book category
 * @param {string} category
 * @param {Object} [LibraryLayoutModel]
 * @returns {Promise<string|null>} preferred shelfID or null
 */
const pickShelfForCategory = async (category, LibraryLayoutModel) => {
    const cat = (category || '').toLowerCase().trim();
    let preferred = null;

    if (['mechanics', 'physics'].some(term => cat.includes(term))) {
        preferred = 'Shelf_A';
    } else if (['programming', 'mathematics', 'maths', 'c programming'].some(term => cat.includes(term))) {
        preferred = 'Shelf_B';
    } else if (['dbms', 'toc', 'computational theory'].some(term => cat.includes(term))) {
        preferred = 'Shelf_C';
    }

    if (!LibraryLayoutModel) {
        return preferred;
    }

    // If preferred matches an existing shelf in the database, return it
    if (preferred) {
        const exists = await LibraryLayoutModel.findOne({ shelfID: preferred });
        if (exists) return preferred;
    }

    // Fallback: check if any shelf label contains this category keyword
    if (cat) {
        const matchingShelf = await LibraryLayoutModel.findOne({
            label: { $regex: cat, $options: 'i' }
        });
        if (matchingShelf) return matchingShelf.shelfID;
    }

    // If no match, return null (leave unassigned)
    return null;
};

module.exports = {
    totalSlotsOf,
    getNextFreeSlot,
    pickShelfForCategory
};
