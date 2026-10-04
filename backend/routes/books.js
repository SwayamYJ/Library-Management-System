const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Comment = require('../models/Comment');
const Activity = require('../models/Activity');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { lookupBook, normalizeCoverUrl } = require('../utils/bookLookup');
const LibraryLayout = require('../models/LibraryLayout');
const { getNextFreeSlot, pickShelfForCategory, totalSlotsOf } = require('../utils/slots');

// @route   GET api/books
// @desc    Get all books (with optional search, category filter, pagination)
// @access  Public
router.get('/', async (req, res) => {
    try {
        const { search, category, page, limit } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { Title: { $regex: search, $options: 'i' } },
                { Author: { $regex: search, $options: 'i' } },
                { ISBN: { $regex: search, $options: 'i' } }
            ];
        }
        if (category && category !== 'undefined' && category.trim() !== '') {
            query.Category = { $regex: category, $options: 'i' };
        }

        const attachGhostFlags = async (bookList) => {
            const borrowedIds = bookList
                .filter(b => b.status === 'Borrowed' || b.availableCount === 0)
                .map(b => b._id);
            if (borrowedIds.length === 0) return;
            const activeIssues = await Activity.find({ bookId: { $in: borrowedIds }, status: 'Active' }).populate('userId').lean();
            const ghostSet = new Set(
                activeIssues.filter(a => !a.userId).map(a => a.bookId.toString())
            );
            for (let book of bookList) {
                if (ghostSet.has(book._id.toString())) {
                    book.hasGhostBorrow = true;
                }
            }
        };

        if (page && limit) {
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.max(1, parseInt(limit, 10) || 10);
            const skip = (pageNum - 1) * limitNum;

            const books = await Book.find(query).skip(skip).limit(limitNum).sort({ createdAt: -1 }).lean();
            const total = await Book.countDocuments(query);

            await attachGhostFlags(books);

            return res.json({
                books,
                totalPages: Math.ceil(total / limitNum),
                currentPage: pageNum,
                total
            });
        }

        const books = await Book.find(query).sort({ createdAt: -1 }).lean();
        await attachGhostFlags(books);

        res.json(books);
    } catch (err) {
        console.error('Error fetching books:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/books/lookup?q=<isbn or title>
// @desc    Lookup book metadata via Google Books (with key) or Open Library fallback
// @access  Private/Admin
router.get('/lookup', [auth, admin], async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ msg: 'Search query parameter "q" is required.' });
    }

    try {
        const bookData = await lookupBook(query);
        res.json(bookData);
    } catch (err) {
        console.warn('Book lookup endpoint error:', err.message);
        const status = err.statusCode || (err.response?.status) || 500;
        let msg = err.message || 'Book lookup failed.';
        if (status === 429) {
            msg = 'Rate limited by upstream book providers. Please try again in a moment or enter manually.';
        } else if (status === 404) {
            msg = `No book records found for "${query}".`;
        }
        res.status(status).json({ msg });
    }
});

// @route   GET api/books/fetch/:isbn
// @desc    Backwards-compatible ISBN lookup alias
// @access  Private/Admin
router.get('/fetch/:isbn', [auth, admin], async (req, res) => {
    const { isbn } = req.params;
    try {
        const bookData = await lookupBook(isbn);
        res.json(bookData);
    } catch (err) {
        const status = err.statusCode || 500;
        res.status(status).json({ msg: err.message || 'ISBN lookup failed.' });
    }
});

// @route   GET api/books/:id
// @desc    Get a single book by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ msg: 'Book not found' });
        res.json(book);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ msg: 'Book not found' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/books
// @desc    Add a new book
// @access  Private/Admin
router.post('/', [auth, admin], async (req, res) => {
    const {
        Title, Author, ISBN, Category, Location,
        price, publisher, description, imageUrl, thumbnail,
        pageCount, rawApiData, quantity, availableCount
    } = req.body;

    if (!Title || !Author || !ISBN) {
        return res.status(400).json({ msg: 'Title, Author, and ISBN are required fields.' });
    }

    const cleanIsbn = ISBN.toString().trim().replace(/[\s-]/g, '');
    if (!/^[a-zA-Z0-9]{8,17}$/.test(cleanIsbn)) {
        return res.status(400).json({ msg: 'Invalid ISBN format. Please provide a valid ISBN-10 or ISBN-13.' });
    }

    try {
        let existing = await Book.findOne({ ISBN: cleanIsbn });
        if (existing) {
            return res.status(400).json({ msg: `A book with ISBN "${cleanIsbn}" already exists.` });
        }

        // Auto-assign location if omitted or shelfNumber is missing
        let autoLocation = Location;
        if (!autoLocation || !autoLocation.shelfNumber) {
            const pickedShelfID = await pickShelfForCategory(Category, LibraryLayout);
            if (pickedShelfID) {
                const nextSlot = await getNextFreeSlot(pickedShelfID, Book, LibraryLayout);
                if (nextSlot) {
                    autoLocation = { floor: '1', section: 'Main', shelfNumber: pickedShelfID, slotIndex: nextSlot };
                } else {
                    autoLocation = { floor: '1', section: 'Main', shelfNumber: null, slotIndex: null };
                }
            } else {
                autoLocation = { floor: '1', section: 'Main', shelfNumber: null, slotIndex: null };
            }
        } else {
            // Validate provided shelf and slot
            const shelfObj = await LibraryLayout.findOne({ shelfID: autoLocation.shelfNumber });
            if (shelfObj) {
                const maxSlots = totalSlotsOf(shelfObj);
                let sIndex = Number(autoLocation.slotIndex);
                if (!sIndex || sIndex < 1 || sIndex > maxSlots) {
                    sIndex = await getNextFreeSlot(autoLocation.shelfNumber, Book, LibraryLayout);
                } else {
                    const occupied = await Book.findOne({
                        'Location.shelfNumber': autoLocation.shelfNumber,
                        'Location.slotIndex': sIndex
                    });
                    if (occupied) {
                        sIndex = await getNextFreeSlot(autoLocation.shelfNumber, Book, LibraryLayout);
                    }
                }
                autoLocation = {
                    floor: autoLocation.floor || '1',
                    section: autoLocation.section || shelfObj.label || 'General',
                    shelfNumber: sIndex ? autoLocation.shelfNumber : null,
                    slotIndex: sIndex || null
                };
            } else {
                autoLocation = { floor: '1', section: 'Main', shelfNumber: null, slotIndex: null };
            }
        }

        // Cover normalization and syncing
        const normalizedCover = normalizeCoverUrl(imageUrl || thumbnail || '');

        const bookQty = Math.max(1, parseInt(quantity, 10) || 1);
        const bookAvail = availableCount !== undefined ? Math.max(0, parseInt(availableCount, 10)) : bookQty;

        const book = new Book({
            Title: Title.trim(),
            Author: Array.isArray(Author) ? Author.join(', ') : Author.trim(),
            ISBN: cleanIsbn,
            Category: Category || 'General',
            price: Number(price) >= 0 ? Number(price) : 600,
            publisher: publisher || '',
            description: description || '',
            imageUrl: normalizedCover,
            thumbnail: normalizedCover,
            pageCount: parseInt(pageCount, 10) || 0,
            quantity: bookQty,
            availableCount: bookAvail,
            isAvailable: bookAvail > 0,
            status: bookAvail > 0 ? 'Available' : 'Out of Stock',
            rawApiData,
            Location: autoLocation
        });

        await book.save();
        res.json(book);
    } catch (err) {
        console.error('Error creating book:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/books/:id
// @desc    Update all book fields
// @access  Private/Admin
router.put('/:id', [auth, admin], async (req, res) => {
    try {
        let book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ msg: 'Book not found' });

        const {
            Title, Author, ISBN, Category, Location,
            price, publisher, description, imageUrl, thumbnail,
            pageCount, quantity, availableCount, status, isAvailable
        } = req.body;

        if (Title !== undefined) book.Title = Title;
        if (Author !== undefined) book.Author = Array.isArray(Author) ? Author.join(', ') : Author;
        if (ISBN !== undefined) book.ISBN = ISBN.toString().trim().replace(/[\s-]/g, '');
        if (Category !== undefined) book.Category = Category;
        if (Location !== undefined) book.Location = Location;
        if (price !== undefined) book.price = Number(price);
        if (publisher !== undefined) book.publisher = publisher;
        if (description !== undefined) book.description = description;
        if (pageCount !== undefined) book.pageCount = Number(pageCount);

        // Sync & normalize covers
        if (imageUrl !== undefined || thumbnail !== undefined) {
            const cover = normalizeCoverUrl(imageUrl || thumbnail || '');
            book.imageUrl = cover;
            book.thumbnail = cover;
        }

        // Sync quantity and available count
        if (quantity !== undefined) {
            const newQty = Math.max(0, parseInt(quantity, 10));
            const diff = newQty - (book.quantity || 1);
            book.quantity = newQty;
            if (availableCount === undefined) {
                book.availableCount = Math.max(0, (book.availableCount || 0) + diff);
            }
        }

        if (availableCount !== undefined) {
            book.availableCount = Math.max(0, parseInt(availableCount, 10));
        }

        if (status !== undefined) {
            book.status = status;
        } else {
            book.status = book.availableCount > 0 ? 'Available' : 'Out of Stock';
        }

        if (isAvailable !== undefined) {
            book.isAvailable = Boolean(isAvailable);
        } else {
            book.isAvailable = book.availableCount > 0;
        }

        await book.save();
        res.json(book);
    } catch (err) {
        console.error('Book update error:', err.message);
        if (err.name === 'CastError') {
            return res.status(404).json({ msg: 'Book not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/books/:id
// @desc    Delete a book (blocks if actively borrowed)
// @access  Private/Admin
router.delete('/:id', [auth, admin], async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ msg: 'Book not found' });
        }

        // Safety check: block deletion if book has active borrow records
        const activeBorrow = await Activity.findOne({ bookId: req.params.id, status: 'Active' });
        if (activeBorrow) {
            return res.status(400).json({
                msg: 'Cannot delete book that is currently borrowed. Please return or clear active borrows first.'
            });
        }

        await Book.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Book removed' });
    } catch (err) {
        console.error('Book delete error:', err.message);
        if (err.name === 'CastError') {
            return res.status(404).json({ msg: 'Book not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   POST api/books/:id/clear-history
// @desc    Clear active borrow records and restore book availability (clears ghost borrows)
// @access  Private Admin
router.post('/:id/clear-history', [auth, admin], async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ msg: 'Book not found' });

        // Complete any active borrows for this book
        const result = await Activity.updateMany(
            { bookId: book._id, status: 'Active' },
            { $set: { status: 'Completed', action: 'Return', returnedAt: new Date() } }
        );

        book.status = 'Available';
        book.isAvailable = true;
        book.availableCount = Math.max(book.availableCount || 0, book.quantity || 1);
        await book.save();

        res.json({
            msg: `Book status reset to Available and ${result.modifiedCount} active borrow(s) cleared.`,
            book
        });
    } catch (err) {
        console.error('Clear history error:', err.message);
        if (err.name === 'CastError') {
            return res.status(404).json({ msg: 'Book not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   POST api/books/restock-all
// @desc    Reset all books with <= 0 copies back to minCopies (Admin utility)
// @access  Private Admin
router.post('/restock-all', [auth, admin], async (req, res) => {
    try {
        const minCopies = parseInt(req.body.copies, 10) || 3;
        const result = await Book.updateMany(
            { availableCount: { $lte: 0 } },
            { $set: { availableCount: minCopies, quantity: minCopies, status: 'Available', isAvailable: true } }
        );
        res.json({
            msg: `Restocked ${result.modifiedCount} book(s) to ${minCopies} copies each.`,
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        console.error('Restock error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/books/:id/location
// @desc    Update only the Location (shelfNumber + slotIndex) of a book (with slot collision protection)
// @access  Private Admin
router.put('/:id/location', [auth, admin], async (req, res) => {
    const { shelfNumber, slotIndex, unassign } = req.body;
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ msg: 'Book not found' });
        if (!book.Location) book.Location = {};

        // Handle unassign request
        if (unassign === true || shelfNumber === null) {
            book.Location.shelfNumber = null;
            book.Location.slotIndex = null;
            await book.save();
            return res.json({ msg: 'Book unassigned successfully', book });
        }

        const targetShelfID = shelfNumber || book.Location?.shelfNumber;
        if (!targetShelfID) {
            return res.status(400).json({ msg: 'Target shelf ID is required.' });
        }

        // Validate shelf exists
        const shelf = await LibraryLayout.findOne({ shelfID: targetShelfID });
        if (!shelf) {
            return res.status(400).json({ msg: `Shelf "${targetShelfID}" does not exist in library layout.` });
        }

        const maxSlots = totalSlotsOf(shelf);
        let targetSlot = slotIndex !== undefined && slotIndex !== null ? Number(slotIndex) : null;

        // Auto-pick slot if none provided
        if (targetSlot === null || isNaN(targetSlot)) {
            targetSlot = await getNextFreeSlot(targetShelfID, Book, LibraryLayout);
            if (!targetSlot) {
                return res.status(409).json({
                    msg: `Shelf "${targetShelfID}" is full (${maxSlots} slots occupied).`,
                    isFull: true
                });
            }
        } else {
            // Validate slot range
            if (targetSlot < 1 || targetSlot > maxSlots) {
                return res.status(400).json({
                    msg: `Slot ${targetSlot} is out of range for shelf "${targetShelfID}" (valid: 1 to ${maxSlots}).`
                });
            }

            // Check if another book occupies this slot
            const existingBook = await Book.findOne({
                _id: { $ne: req.params.id },
                'Location.shelfNumber': targetShelfID,
                'Location.slotIndex': targetSlot
            });

            if (existingBook) {
                return res.status(409).json({
                    msg: `Slot ${targetSlot} on shelf "${targetShelfID}" is already occupied by "${existingBook.Title}".`,
                    occupiedBy: existingBook.Title
                });
            }
        }

        book.Location.shelfNumber = targetShelfID;
        book.Location.slotIndex = targetSlot;
        if (!book.Location.floor) book.Location.floor = '1';
        if (!book.Location.section) book.Location.section = shelf.label || 'General';

        await book.save();
        res.json({ msg: 'Location updated', book });
    } catch (err) {
        console.error('Location update error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/books/:id/restock
// @desc    Add custom quantity to a book
// @access  Private Admin
router.post('/:id/restock', [auth, admin], async (req, res) => {
    const { quantityToAdd } = req.body;
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ msg: 'Book not found' });

        const count = Number(quantityToAdd);
        if (isNaN(count) || count < 1) {
            return res.status(400).json({ msg: 'Please enter a valid quantity' });
        }

        book.quantity = (book.quantity || 0) + count;
        book.availableCount = (book.availableCount || 0) + count;

        if (book.availableCount > 0) {
            book.status = 'Available';
            book.isAvailable = true;
        }

        await book.save();
        res.json({
            msg: `Successfully added ${count} copies of "${book.Title}".`,
            totalStock: book.quantity,
            availableCount: book.availableCount,
            book
        });
    } catch (err) {
        console.error('Restock error:', err.message);
        res.status(500).send('Server Error');
    }
});

// ================= COMMENTS =================

// @route   GET api/books/:id/comments
// @desc    Get all comments for a book
// @access  Public
router.get('/:id/comments', async (req, res) => {
    try {
        const comments = await Comment.find({ bookId: req.params.id })
            .populate('userId', ['username', 'profilePicture'])
            .sort({ createdAt: -1 });
        res.json(comments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/books/:id/comments
// @desc    Add a comment to a book
// @access  Private
router.post('/:id/comments', auth, async (req, res) => {
    try {
        if (!req.body.text || !req.body.text.trim()) {
            return res.status(400).json({ msg: 'Comment text cannot be empty.' });
        }

        const newComment = new Comment({
            text: req.body.text.trim(),
            bookId: req.params.id,
            userId: req.user.id
        });

        const comment = await newComment.save();
        await comment.populate('userId', ['username', 'profilePicture']);
        res.json(comment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/books/:id/comments/:cid
// @desc    Update a comment
// @access  Private
router.put('/:id/comments/:cid', auth, async (req, res) => {
    try {
        let comment = await Comment.findById(req.params.cid);
        if (!comment) return res.status(404).json({ msg: 'Comment not found' });

        if (comment.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized to edit this comment' });
        }

        comment.text = req.body.text;
        await comment.save();
        await comment.populate('userId', ['username', 'profilePicture']);
        res.json(comment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/books/:id/comments/:cid
// @desc    Delete a comment
// @access  Private
router.delete('/:id/comments/:cid', auth, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.cid);
        if (!comment) return res.status(404).json({ msg: 'Comment not found' });

        if (comment.userId.toString() !== req.user.id && req.user.role !== 'Admin') {
            return res.status(401).json({ msg: 'User not authorized to delete this comment' });
        }

        await Comment.findByIdAndDelete(req.params.cid);
        res.json({ msg: 'Comment removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
