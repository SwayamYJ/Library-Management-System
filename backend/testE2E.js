const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
    console.log('====================================================');
    console.log('   SmartLibrary Comprehensive End-to-End API Test   ');
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
        // ── 1. Public Browse & Covers ──────────────────────────────────────────
        console.log('1. Testing Public Browse & Books API:');
        const booksRes = await axios.get(`${BASE_URL}/books`);
        assert(Array.isArray(booksRes.data) && booksRes.data.length > 0, `Books list returned (${booksRes.data.length} books)`);
        
        const firstBook = booksRes.data[0];
        assert(firstBook.thumbnail && !firstBook.thumbnail.includes('via.placeholder.com'), `First book (${firstBook.Title}) has valid thumbnail: ${firstBook.thumbnail.slice(0, 45)}...`);
        assert(firstBook.imageUrl && !firstBook.imageUrl.includes('via.placeholder.com'), `First book has valid imageUrl`);

        // Search test
        const searchRes = await axios.get(`${BASE_URL}/books?search=Code`);
        assert(Array.isArray(searchRes.data), `Search endpoint responded with ${searchRes.data.length} results`);

        // Detail & Comments test
        const detailRes = await axios.get(`${BASE_URL}/books/${firstBook._id}`);
        assert(detailRes.data && detailRes.data.Title === firstBook.Title, `Book detail retrieved successfully for '${firstBook.Title}'`);

        // ── 2. Authentication & RBAC ──────────────────────────────────────────
        console.log('\n2. Testing Auth & Role Access:');
        // Standard user login
        const userLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'user@smartlibrary.com',
            password: 'User123!'
        });
        const userToken = userLoginRes.data.token;
        const userObj = userLoginRes.data.user;
        assert(userToken && userObj.role === 'User', `Student user logged in successfully (role: ${userObj.role})`);

        // Admin login
        const adminLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@smartlibrary.com',
            password: 'Admin123!'
        });
        const adminToken = adminLoginRes.data.token;
        const adminObj = adminLoginRes.data.user;
        assert(adminToken && adminObj.role === 'Admin', `Admin user logged in successfully (role: ${adminObj.role})`);

        // Verify Student cannot access Admin lookup (403 expected)
        try {
            await axios.get(`${BASE_URL}/books/lookup?q=9780131103627`, {
                headers: { 'x-auth-token': userToken }
            });
            assert(false, 'Student should be forbidden from /api/books/lookup');
        } catch (err) {
            assert(err.response?.status === 403, `Student correctly received 403 Forbidden on admin lookup route`);
        }

        // ── 3. External Book Lookup (Problem 2) ───────────────────────────────
        console.log('\n3. Testing Universal Book Lookup (Open Library / Google Books):');
        // Real ISBN: 9780131103627 (The C Programming Language)
        const lookupRes = await axios.get(`${BASE_URL}/books/lookup?q=9780131103627`, {
            headers: { 'x-auth-token': adminToken }
        });
        assert(lookupRes.data && lookupRes.data.title, `Lookup for ISBN 9780131103627 returned title: '${lookupRes.data.title}'`);
        assert(lookupRes.data.coverImageURL && !lookupRes.data.coverImageURL.includes('via.placeholder.com'), `Lookup returned valid cover URL: ${lookupRes.data.coverImageURL.slice(0, 45)}...`);
        assert(lookupRes.data.source === 'GoogleBooks' || lookupRes.data.source === 'Open Library' || lookupRes.data.source === 'OpenLibrary', `Lookup source identified as '${lookupRes.data.source}'`);

        // Title search lookup
        const titleLookupRes = await axios.get(`${BASE_URL}/books/lookup?q=Clean Code`, {
            headers: { 'x-auth-token': adminToken }
        });
        assert(titleLookupRes.data && titleLookupRes.data.title, `Title search for 'Clean Code' succeeded: '${titleLookupRes.data.title}'`);

        // Nonexistent ISBN or unresolvable query (should return 404 or 429 cleanly)
        try {
            await axios.get(`${BASE_URL}/books/lookup?q=9789999999999`, {
                headers: { 'x-auth-token': adminToken }
            });
            assert(false, 'Nonexistent ISBN lookup should not succeed');
        } catch (err) {
            assert(err.response?.status === 404 || err.response?.status === 429, `Nonexistent/unresolvable ISBN cleanly handled with status ${err.response?.status}`);
        }

        // Verify Student cannot access Admin endpoints (403 expected)
        try {
            await axios.get(`${BASE_URL}/admin/users`, {
                headers: { 'x-auth-token': userToken }
            });
            assert(false, 'Student should be forbidden from /api/admin/users');
        } catch (err) {
            assert(err.response?.status === 403, `Student correctly received 403 Forbidden on admin route`);
        }

        // ── 4. Admin Management Operations ────────────────────────────────────
        console.log('\n4. Testing Admin Capabilities:');
        // Admin users list
        const adminUsersRes = await axios.get(`${BASE_URL}/admin/users`, {
            headers: { 'x-auth-token': adminToken }
        });
        assert(Array.isArray(adminUsersRes.data) && adminUsersRes.data.length > 0, `Admin fetched users list (${adminUsersRes.data.length} users)`);

        // Book Edit (PUT /api/books/:id saves all fields)
        const updatePayload = {
            Title: firstBook.Title,
            Author: firstBook.Author,
            ISBN: firstBook.ISBN,
            Category: firstBook.Category,
            price: 49.99,
            publisher: 'SmartLibrary Press',
            description: 'Updated end-to-end verified description.',
            quantity: 5,
            availableCount: 5,
            status: 'Available'
        };
        const editRes = await axios.put(`${BASE_URL}/books/${firstBook._id}`, updatePayload, {
            headers: { 'x-auth-token': adminToken }
        });
        assert(editRes.data.price === 49.99 && editRes.data.publisher === 'SmartLibrary Press', `Admin book update saved extended fields (price: $${editRes.data.price}, publisher: '${editRes.data.publisher}')`);

        // Layout & Shelves
        const layoutRes = await axios.get(`${BASE_URL}/layout`);
        assert(Array.isArray(layoutRes.data) && layoutRes.data.length > 0, `Library layout fetched (${layoutRes.data.length} shelves)`);

        // Shelf Collision Test
        const shelfA = layoutRes.data[0];
        const bookInSlot1 = booksRes.data.find(b => b.Location?.shelfNumber === shelfA.shelfID && b.Location?.slotIndex === 1) || firstBook;
        const secondBook = booksRes.data.find(b => b._id !== bookInSlot1._id);

        if (secondBook) {
            try {
                await axios.put(`${BASE_URL}/books/${secondBook._id}/location`, {
                    shelfNumber: shelfA.shelfID,
                    slotIndex: 1
                }, { headers: { 'x-auth-token': adminToken } });
                assert(false, 'Assigning second book to same slot should be rejected');
            } catch (err) {
                assert(err.response?.status === 409, `Slot collision correctly prevented with 409 Conflict: '${err.response?.data?.msg}'`);
            }
        }

        // Ghost transaction clearing test
        const clearHistoryRes = await axios.post(`${BASE_URL}/books/${firstBook._id}/clear-history`, {}, {
            headers: { 'x-auth-token': adminToken }
        });
        assert(clearHistoryRes.data && clearHistoryRes.data.book.status === 'Available', `Clear ghost history restored book status to 'Available'`);

        // ── 5. User Borrowing & Fine Management ──────────────────────────────
        console.log('\n5. Testing Borrowing, Fines & Returns:');
        // Pay fines test
        const payFinesRes = await axios.post(`${BASE_URL}/admin/users/${userObj.id}/pay-fines`, {}, {
            headers: { 'x-auth-token': adminToken }
        });
        assert(payFinesRes.data.fineAmount === 0, `Pay fines successfully reset user fines to 0`);

        // Password change test (verifying wrong password rejects, right password succeeds)
        try {
            await axios.put(`${BASE_URL}/profile/change-password`, {
                currentPassword: 'WrongPassword!',
                newPassword: 'NewUser123!'
            }, { headers: { 'x-auth-token': userToken } });
            assert(false, 'Password change with wrong current password should fail');
        } catch (err) {
            assert(err.response?.status === 400, `Password change with wrong current password rejected (400)`);
        }

        const pwdChangeRes = await axios.put(`${BASE_URL}/profile/change-password`, {
            currentPassword: 'User123!',
            newPassword: 'User123!'
        }, { headers: { 'x-auth-token': userToken } });
        assert(pwdChangeRes.data && pwdChangeRes.data.msg.includes('successfully'), `User password change with valid password succeeded`);

    } catch (error) {
        console.error('Unexpected test error:', error.message, error.response?.data);
        failed++;
    }

    console.log('\n====================================================');
    console.log(`   E2E Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');
    
    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
