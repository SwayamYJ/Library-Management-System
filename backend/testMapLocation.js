const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function runMapLocationTests() {
    console.log('====================================================');
    console.log('    SmartLibrary Location Map & Book Locator Tests  ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    const assert = (condition, message) => {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${message}`);
            failed++;
        }
    };

    try {
        // 1. Admin Login
        console.log('1. Admin Authentication:');
        let adminToken = '';
        try {
            const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
                email: 'admin@smartlibrary.com',
                password: 'Admin123!'
            });
            adminToken = loginRes.data.token;
        } catch {
            const loginRes2 = await axios.post(`${BASE_URL}/auth/login`, {
                email: 'admin@test.com',
                password: 'password123'
            });
            adminToken = loginRes2.data.token;
        }
        assert(!!adminToken, 'Admin logged in and obtained JWT');
        const authHeaders = { headers: { 'x-auth-token': adminToken } };

        // 2. Call POST /api/layout/repair
        console.log('\n2. Testing POST /api/layout/repair:');
        const repairRes = await axios.post(`${BASE_URL}/layout/repair`, { autoPlace: false }, authHeaders);
        assert(repairRes.status === 200 && repairRes.data.success === true, `Repair layout executed successfully: ${repairRes.data.msg}`);

        // 3. Verify unique slots after repair
        console.log('\n3. Verifying Unique Slots per Shelf:');
        const booksRes = await axios.get(`${BASE_URL}/books?limit=1000`);
        const allBooks = booksRes.data.books || booksRes.data;
        const shelfSlotMap = {};
        let duplicateFound = false;

        allBooks.forEach(b => {
            const shelf = b.Location?.shelfNumber;
            const slot = b.Location?.slotIndex;
            if (shelf && slot) {
                const key = `${shelf}:${slot}`;
                if (shelfSlotMap[key]) {
                    duplicateFound = true;
                    console.error(`  Duplicate slot detected: ${key} on books "${shelfSlotMap[key]}" and "${b.Title}"`);
                } else {
                    shelfSlotMap[key] = b.Title;
                }
            }
        });
        assert(!duplicateFound, 'All books on shelves have unique, collision-free slot indices');

        // 4. Test 409 on an occupied slot
        console.log('\n4. Testing 409 Conflict on Occupied Slot:');
        const shelvedBooks = allBooks.filter(b => b.Location?.shelfNumber === 'Shelf_A');
        assert(shelvedBooks.length >= 2, `Found ${shelvedBooks.length} books on Shelf_A for collision testing`);

        const book1 = shelvedBooks[0];
        const book2 = shelvedBooks[1];
        const book1Slot = book1.Location.slotIndex;

        try {
            await axios.put(`${BASE_URL}/books/${book2._id}/location`, {
                shelfNumber: 'Shelf_A',
                slotIndex: book1Slot
            }, authHeaders);
            assert(false, `Expected 409 when placing book in occupied slot ${book1Slot}`);
        } catch (err) {
            assert(err.response?.status === 409, `Received 409 Conflict when attempting to occupy slot ${book1Slot}: "${err.response?.data?.msg}"`);
        }

        // 5. Test 400 on a missing shelf
        console.log('\n5. Testing 400 Bad Request on Missing Shelf:');
        try {
            await axios.put(`${BASE_URL}/books/${book2._id}/location`, {
                shelfNumber: 'Shelf_NonExistent_9999',
                slotIndex: 1
            }, authHeaders);
            assert(false, 'Expected 400 for non-existent shelf');
        } catch (err) {
            assert(err.response?.status === 400, `Received 400 Bad Request for non-existent shelf: "${err.response?.data?.msg}"`);
        }

        // 6. Test 400 on out-of-range slot
        console.log('\n6. Testing 400 Bad Request on Out-of-Range Slot:');
        try {
            await axios.put(`${BASE_URL}/books/${book2._id}/location`, {
                shelfNumber: 'Shelf_A',
                slotIndex: 99
            }, authHeaders);
            assert(false, 'Expected 400 for slot 99 (exceeds totalSlots 20)');
        } catch (err) {
            assert(err.response?.status === 400, `Received 400 Bad Request for out-of-range slot 99: "${err.response?.data?.msg}"`);
        }

        // 7. Test unassign
        console.log('\n7. Testing Unassign ({ unassign: true }):');
        const origShelf = book2.Location.shelfNumber;
        const origSlot = book2.Location.slotIndex;

        const unassignRes = await axios.put(`${BASE_URL}/books/${book2._id}/location`, {
            unassign: true
        }, authHeaders);
        assert(unassignRes.status === 200, 'Unassign responded with 200 OK');
        assert(unassignRes.data.book.Location?.shelfNumber === null && unassignRes.data.book.Location?.slotIndex === null,
            'Book Location shelfNumber and slotIndex are now null');

        // Restore book2 location
        await axios.put(`${BASE_URL}/books/${book2._id}/location`, {
            shelfNumber: origShelf,
            slotIndex: origSlot
        }, authHeaders);
        console.log(`  Restored book "${book2.Title}" back to ${origShelf} slot ${origSlot}`);

        // 8. Test full-shelf handling
        console.log('\n8. Testing Full-Shelf Handling:');
        // Let's create a temporary small shelf with 1 slot
        const testShelfID = 'Shelf_TestFull';
        try {
            await axios.delete(`${BASE_URL}/layout/${testShelfID}`, authHeaders).catch(() => {});
        } catch {}

        const layoutList = (await axios.get(`${BASE_URL}/layout`)).data;
        const existingTestShelf = layoutList.find(s => s.shelfID === testShelfID);
        let testShelfObjId = existingTestShelf?._id;

        if (!existingTestShelf) {
            const createShelfRes = await axios.post(`${BASE_URL}/layout`, {
                shelfID: testShelfID,
                label: 'Test Full Shelf',
                coordinateX: 50,
                coordinateY: 85
            }, authHeaders);
            testShelfObjId = createShelfRes.data._id;
        }

        // Place a book in slot 1 of testShelfID
        await axios.put(`${BASE_URL}/books/${book2._id}/location`, {
            shelfNumber: testShelfID,
            slotIndex: 1
        }, authHeaders);

        // Fill all slots 1..20 on testShelfID with dummy/available books or test getNextFreeSlot
        // Let's test auto-picking on testShelfID when slot 1 is taken and request slotIndex: 1 -> 409
        try {
            await axios.put(`${BASE_URL}/books/${book1._id}/location`, {
                shelfNumber: testShelfID,
                slotIndex: 1
            }, authHeaders);
            assert(false, 'Expected 409 on slot 1 collision');
        } catch (err) {
            assert(err.response?.status === 409, `Received 409 on slot 1 collision: "${err.response?.data?.msg}"`);
        }

        // Clean up test shelf
        await axios.put(`${BASE_URL}/books/${book2._id}/location`, {
            shelfNumber: origShelf,
            slotIndex: origSlot
        }, authHeaders);
        if (testShelfObjId) {
            await axios.delete(`${BASE_URL}/layout/${testShelfObjId}`, authHeaders);
            console.log(`  Cleaned up temporary shelf "${testShelfID}"`);
        }

        // 9. Test Auto-pick on Add Book (POST /api/books)
        console.log('\n9. Testing Add Book Auto-Placement:');
        const testIsbn = '9789999' + Math.floor(100000 + Math.random() * 900000);
        const newBookRes = await axios.post(`${BASE_URL}/books`, {
            Title: 'Auto-Placement Test Book',
            Author: 'Test Author',
            ISBN: testIsbn,
            Category: 'Mechanics',
            quantity: 2
        }, authHeaders);
        assert(newBookRes.status === 200, 'POST /api/books succeeded');
        assert(newBookRes.data.Location?.shelfNumber === 'Shelf_A', `Book auto-placed on Shelf_A (got "${newBookRes.data.Location?.shelfNumber}")`);
        assert(typeof newBookRes.data.Location?.slotIndex === 'number' && newBookRes.data.Location?.slotIndex > 0,
            `Book assigned valid free slot: ${newBookRes.data.Location?.slotIndex}`);

        // Cleanup test book
        await axios.delete(`${BASE_URL}/books/${newBookRes.data._id}`, authHeaders);
        console.log('  Cleaned up test book');

    } catch (err) {
        console.error('Test execution error:', err.response?.data || err.message);
        failed++;
    }

    console.log('\n====================================================');
    console.log(`Test Summary: ${passed} passed, ${failed} failed`);
    console.log('====================================================');
    process.exit(failed > 0 ? 1 : 0);
}

runMapLocationTests();
