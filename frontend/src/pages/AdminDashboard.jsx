import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
    Users, BookOpen, LogOut, Search, Shield, Ban,
    Map as MapIcon, Plus, Box, Trash2, AlertTriangle,
    Key, CheckCircle2, DollarSign
} from 'lucide-react';
import LibraryMapCanvas from '../components/LibraryMapCanvas';
import BookCover from '../components/BookCover';

const AdminDashboard = () => {
    const { user, logout, loading } = useContext(AuthContext);
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('books'); // default to books

    // Data States
    const [users, setUsers] = useState([]);
    const [books, setBooks] = useState([]);
    const [layout, setLayout] = useState([]);
    const [orders, setOrders] = useState([]);

    // Search States
    const [userSearch, setUserSearch] = useState('');
    const [bookSearch, setBookSearch] = useState('');

    // Pagination States for Books
    const [bookPage, setBookPage] = useState(1);
    const [bookLimit, setBookLimit] = useState(10);
    const [bookTotalPages, setBookTotalPages] = useState(1);
    const [bookTotalResults, setBookTotalResults] = useState(0);

    // Map Editor State
    const [newShelf, setNewShelf] = useState({ shelfID: '', label: '', coordinateX: null, coordinateY: null });
    const [editingShelf, setEditingShelf] = useState(null);
    const [placementMode, setPlacementMode] = useState(false);
    const [shelfPlaceError, setShelfPlaceError] = useState('');
    const [pickedCoordsPx, setPickedCoordsPx] = useState(null);

    // Add Book Modal State
    const [showBookModal, setShowBookModal] = useState(false);
    const [newBook, setNewBook] = useState({
        Title: '', Author: '', ISBN: '', Category: 'Mechanics',
        description: '', imageUrl: '', thumbnail: '', pageCount: 0,
        rawApiData: null, Location: { floor: '1', section: 'Main', shelfNumber: '', slotIndex: 1 },
        price: 600, publisher: '', quantity: 1, availableCount: 1
    });
    const [isFetchingBook, setIsFetchingBook] = useState(false);
    const [previewList, setPreviewList] = useState([]);
    const [fetchError, setFetchError] = useState('');
    const [fetchSource, setFetchSource] = useState('');

    // Edit Book Modal State
    const [showEditBookModal, setShowEditBookModal] = useState(false);
    const [editingBook, setEditingBook] = useState(null);

    // Delete Account Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Change Password Modal State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    // Shelf Delete Confirmation State
    const [shelfToDelete, setShelfToDelete] = useState(null);
    const [shelfDeleteError, setShelfDeleteError] = useState('');
    const [isDeletingShelf, setIsDeletingShelf] = useState(false);

    // User Report Modal State
    const [selectedUserReport, setSelectedUserReport] = useState(null);
    const [showUserReportModal, setShowUserReportModal] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);

    // Conflict Resolution State
    const [apiBaseline, setApiBaseline] = useState(null);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflicts, setConflicts] = useState({});

    useEffect(() => {
        if (loading) return;
        if (!user) {
            navigate('/login');
        } else if (user.role !== 'Admin') {
            navigate('/dashboard');
        }
    }, [user, navigate, loading]);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await api.get(`/admin/users?search=${encodeURIComponent(userSearch)}`);
            setUsers(res.data);
        } catch (err) {
            console.error('Fetch users error:', err);
        }
    }, [userSearch]);

    const fetchBooks = useCallback(async () => {
        try {
            const currentLimit = activeTab === 'map' ? 1000 : bookLimit;
            const searchParam = activeTab === 'map' ? '' : bookSearch;
            const pageParam = activeTab === 'map' ? 1 : bookPage;
            const res = await api.get(`/books?search=${encodeURIComponent(searchParam)}&page=${pageParam}&limit=${currentLimit}`);
            if (res.data.books) {
                setBooks(res.data.books);
                setBookTotalPages(res.data.totalPages);
                setBookTotalResults(res.data.total);
            } else {
                setBooks(res.data);
            }
        } catch (err) {
            console.error('Fetch books error:', err);
        }
    }, [activeTab, bookLimit, bookSearch, bookPage]);

    const fetchLayout = useCallback(async () => {
        try {
            const res = await api.get('/layout');
            setLayout(res.data);
        } catch (err) {
            console.error('Fetch layout error:', err);
        }
    }, []);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await api.get('/transactions');
            setOrders(res.data);
        } catch (err) {
            console.error('Fetch orders error:', err);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'books' || activeTab === 'map') {
            fetchBooks();
            fetchLayout();
        }
        if (activeTab === 'orders') fetchOrders();
    }, [activeTab, fetchUsers, fetchBooks, fetchLayout, fetchOrders]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleDeleteAccount = async () => {
        setDeleteError('');
        if (!deletePassword) {
            setDeleteError('Please enter your password to confirm.');
            return;
        }
        setIsDeleting(true);
        try {
            await api.delete('/auth/me', { data: { password: deletePassword } });
            alert('✅ Your admin account has been permanently deleted.');
            localStorage.removeItem('token');
            window.location.href = '/';
        } catch (err) {
            setDeleteError(err.response?.data?.msg || 'Deletion failed. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match.');
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters.');
            return;
        }

        try {
            const res = await api.put('/profile/change-password', { currentPassword, newPassword });
            setPasswordSuccess(res.data.msg || 'Password updated successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                setShowPasswordModal(false);
                setPasswordSuccess('');
            }, 1500);
        } catch (err) {
            setPasswordError(err.response?.data?.msg || 'Failed to update password.');
        }
    };

    // User Actions
    const toggleRestrict = async (userId) => {
        try {
            await api.put(`/admin/users/${userId}/restrict`);
            fetchUsers();
        } catch (err) {
            console.error('Error toggling restriction:', err);
        }
    };

    const viewUserReport = async (userId) => {
        setReportLoading(true);
        setShowUserReportModal(true);
        try {
            const res = await api.get(`/admin/users/${userId}/report`);
            setSelectedUserReport(res.data);
        } catch (err) {
            console.error('Error loading user report:', err);
            alert('Failed to load user report');
            setShowUserReportModal(false);
        } finally {
            setReportLoading(false);
        }
    };

    const handlePayUserFines = async (userId) => {
        if (!window.confirm('Mark all unpaid fines for this user as paid?')) return;
        try {
            const res = await api.post(`/admin/users/${userId}/pay-fines`);
            alert(`✅ ${res.data.msg}`);
            viewUserReport(userId);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to mark fines paid.');
        }
    };

    const deleteUser = async (userId) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                await api.delete(`/admin/users/${userId}`);
                fetchUsers();
            } catch (err) {
                console.error('Error deleting user:', err);
                alert(err.response?.data?.msg || 'Failed to delete user');
            }
        }
    };

    // Book Actions
    const deleteBook = async (id) => {
        if (!window.confirm('Are you sure you want to delete this book?')) return;
        try {
            await api.delete(`/books/${id}`);
            alert('Book deleted successfully');
            fetchBooks();
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to delete book');
        }
    };

    const clearBookHistory = async (id) => {
        if (!window.confirm('Clear active borrows and reset status to Available?')) return;
        try {
            await api.post(`/books/${id}/clear-history`);
            alert('Book status reset successfully!');
            fetchBooks();
        } catch (err) {
            console.error('Clear history error:', err);
            alert('Failed to clear book history');
        }
    };

    const handleEditClick = (book) => {
        setEditingBook({
            _id: book._id,
            Title: book.Title || '',
            Author: book.Author || '',
            ISBN: book.ISBN || '',
            Category: book.Category || 'Mechanics',
            price: book.price ?? 600,
            publisher: book.publisher || '',
            description: book.description || '',
            imageUrl: book.imageUrl || '',
            thumbnail: book.thumbnail || '',
            pageCount: book.pageCount || 0,
            quantity: book.quantity ?? 1,
            availableCount: book.availableCount ?? 1,
            Location: {
                floor: book.Location?.floor || '1',
                section: book.Location?.section || 'Main',
                shelfNumber: book.Location?.shelfNumber || '',
                slotIndex: book.Location?.slotIndex || 1
            }
        });
        setShowEditBookModal(true);
    };

    const handleUpdateBook = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/books/${editingBook._id}`, editingBook);
            alert('✅ Book updated successfully!');
            setShowEditBookModal(false);
            setEditingBook(null);
            fetchBooks();
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to update book.');
        }
    };

    // Add Book Action
    const handleAddBook = async (e) => {
        if (e) e.preventDefault();

        if (apiBaseline && !showConflictModal) {
            const currentConflicts = {};
            const fieldsToCompare = ['Title', 'Author', 'ISBN', 'publisher', 'pageCount', 'description'];

            fieldsToCompare.forEach(field => {
                const manualVal = newBook[field];
                const apiVal = apiBaseline[field];
                if (String(manualVal) !== String(apiVal)) {
                    currentConflicts[field] = { api: apiVal, manual: manualVal, choice: 'manual' };
                }
            });

            if (Object.keys(currentConflicts).length > 0) {
                setConflicts(currentConflicts);
                setShowConflictModal(true);
                return;
            }
        }

        try {
            let finalizedBook = { ...newBook };
            if (Object.keys(conflicts).length > 0) {
                Object.keys(conflicts).forEach(field => {
                    finalizedBook[field] = conflicts[field].choice === 'api' ? conflicts[field].api : conflicts[field].manual;
                });
            }

            await api.post('/books', finalizedBook);
            fetchBooks();
            setShowBookModal(false);
            setShowConflictModal(false);
            setApiBaseline(null);
            setConflicts({});
            setFetchError('');
            setFetchSource('');
            setNewBook({
                Title: '', Author: '', ISBN: '', Category: 'Mechanics',
                description: '', imageUrl: '', thumbnail: '', pageCount: 0,
                rawApiData: null, Location: { floor: '1', section: 'Main', shelfNumber: '', slotIndex: 1 },
                price: 600, publisher: '', quantity: 1, availableCount: 1
            });
            alert('✅ Book added successfully!');
        } catch (err) {
            console.error('Error adding book:', err);
            alert(err.response?.data?.msg || 'Failed to add book. Please check required fields.');
        }
    };

    // Smart Fetch via Backend Universal Lookup
    const handleSmartFetch = async () => {
        const query = newBook.ISBN || newBook.Title;
        if (!query || !query.trim()) {
            return alert('Please enter an ISBN or Title to fetch details.');
        }

        setIsFetchingBook(true);
        setPreviewList([]);
        setFetchError('');
        setFetchSource('');

        try {
            const res = await api.get(`/books/lookup?q=${encodeURIComponent(query.trim())}`);
            const data = res.data;
            setFetchSource(data.source || 'Lookup Provider');

            let mappedCategory = 'Mechanics';
            const mainGenres = ['Mechanics', 'Programming', 'Physics', 'Mathematics', 'DBMS', 'TOC'];
            if (data.categories && data.categories.length > 0) {
                const catStr = (Array.isArray(data.categories) ? data.categories.join(' ') : String(data.categories)).toLowerCase();
                for (let g of mainGenres) {
                    if (catStr.includes(g.toLowerCase())) {
                        mappedCategory = g;
                        break;
                    }
                }
            }

            const bookData = {
                Title: data.title || '',
                Author: data.authors || '',
                description: data.description || '',
                pageCount: data.pageCount || 0,
                imageUrl: data.coverImageURL || '',
                thumbnail: data.coverImageURL || '',
                Category: mappedCategory,
                publisher: data.publisher || '',
                ISBN: data.isbn13 || data.isbn10 || newBook.ISBN || ''
            };

            setApiBaseline(bookData);
            setNewBook(prev => ({
                ...prev,
                ...bookData,
                rawApiData: data.rawItem || null
            }));

            if (data.results && data.results.length > 1) {
                setPreviewList(data.results);
            } else {
                setPreviewList([]);
            }
        } catch (err) {
            console.warn('Smart Fetch error:', err.message);
            const msg = err.response?.data?.msg || 'Book lookup failed. You can still enter details manually.';
            setFetchError(msg);
        } finally {
            setIsFetchingBook(false);
        }
    };

    const selectPreview = (item) => {
        let mappedCategory = 'Mechanics';
        const mainGenres = ['Mechanics', 'Programming', 'Physics', 'Mathematics', 'DBMS', 'TOC'];
        if (item.categories && item.categories.length > 0) {
            const catStr = (Array.isArray(item.categories) ? item.categories.join(' ') : String(item.categories)).toLowerCase();
            for (let g of mainGenres) {
                if (catStr.includes(g.toLowerCase())) {
                    mappedCategory = g;
                    break;
                }
            }
        }

        const bookData = {
            Title: item.title || '',
            Author: item.authors || '',
            description: item.description || '',
            pageCount: item.pageCount || 0,
            imageUrl: item.coverImageURL || '',
            thumbnail: item.coverImageURL || '',
            Category: mappedCategory,
            publisher: item.publisher || '',
            ISBN: item.isbn13 || item.isbn10 || ''
        };

        setApiBaseline(bookData);
        setFetchSource(item.source || 'Lookup Provider');
        setNewBook(prev => ({
            ...prev,
            ...bookData,
            rawApiData: item.rawItem || item
        }));
        setPreviewList([]);
    };

    const isConflicting = (field) => {
        if (!apiBaseline) return false;
        return String(newBook[field]) !== String(apiBaseline[field]);
    };

    // Order Actions
    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            await api.put(`/transactions/${orderId}/status`, { status: newStatus });
            fetchOrders();
        } catch (err) {
            console.error('Error updating order status:', err);
            alert(err.response?.data?.msg || 'Error updating status');
        }
    };

    // Restock all depleted books back to 3 copies
    const handleRestock = async () => {
        if (!window.confirm('Reset all books with 0 copies back to 3? This is an admin testing utility.')) return;
        try {
            const res = await api.post('/books/restock-all', { copies: 3 });
            alert(`✅ ${res.data.msg}`);
            fetchBooks();
        } catch (err) {
            alert(err.response?.data?.msg || 'Restock failed');
        }
    };

    // Map Click Handler
    const handleMapPlacement = (xPct, yPct, xPx, yPx) => {
        setNewShelf(prev => ({ ...prev, coordinateX: xPct, coordinateY: yPct }));
        setPickedCoordsPx({ x: xPx, y: yPx });
        setShelfPlaceError('');
    };

    // Layout Actions
    const addShelf = async (e) => {
        e.preventDefault();
        setShelfPlaceError('');

        if (newShelf.coordinateX === null || newShelf.coordinateY === null) {
            setShelfPlaceError('Please click on the map to set shelf position first.');
            return;
        }

        try {
            if (editingShelf) {
                await api.put(`/layout/${editingShelf._id}`, {
                    shelfID: newShelf.shelfID,
                    label: newShelf.label,
                    coordinateX: newShelf.coordinateX,
                    coordinateY: newShelf.coordinateY,
                });
                alert('✅ Shelf updated successfully!');
            } else {
                await api.post('/layout', {
                    shelfID: newShelf.shelfID,
                    label: newShelf.label,
                    coordinateX: newShelf.coordinateX,
                    coordinateY: newShelf.coordinateY,
                });
                alert('✅ Shelf created successfully!');
            }
            fetchLayout();
            fetchBooks();
            setNewShelf({ shelfID: '', label: '', coordinateX: null, coordinateY: null });
            setEditingShelf(null);
            setPickedCoordsPx(null);
            setPlacementMode(false);
        } catch (err) {
            setShelfPlaceError(err.response?.data?.msg || 'Error saving shelf position.');
        }
    };

    const confirmDeleteShelf = async () => {
        if (!shelfToDelete) return;
        setIsDeletingShelf(true);
        setShelfDeleteError('');
        try {
            const res = await api.delete(`/layout/${shelfToDelete._id}`);
            alert(`✅ ${res.data.msg}`);
            setShelfToDelete(null);
            fetchLayout();
            fetchBooks();
        } catch (err) {
            setShelfDeleteError(err.response?.data?.msg || 'Error deleting shelf.');
        } finally {
            setIsDeletingShelf(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center space-x-3 mb-4 text-red-600">
                            <AlertTriangle className="w-6 h-6" />
                            <h3 className="text-lg font-bold text-gray-900">Delete Admin Account</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                            Deleting your admin account will immediately log you out and permanently remove your record from the database.
                        </p>
                        {deleteError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-4">
                                {deleteError}
                            </div>
                        )}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm your password</label>
                            <input
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder="Enter your current password..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 text-sm outline-none"
                            />
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="flex-1 py-2.5 px-4 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-60 text-sm flex items-center justify-center"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center space-x-3 mb-4 text-sky-600">
                            <Key className="w-6 h-6" />
                            <h3 className="text-lg font-bold text-gray-900">Change Admin Password</h3>
                        </div>

                        {passwordError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-4">
                                {passwordError}
                            </div>
                        )}

                        {passwordSuccess && (
                            <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm mb-4 flex items-center">
                                <CheckCircle2 className="w-4 h-4 mr-2" /> {passwordSuccess}
                            </div>
                        )}

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Current Password</label>
                                <input
                                    required
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password..."
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">New Password (min 6 chars)</label>
                                <input
                                    required
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password..."
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Confirm New Password</label>
                                <input
                                    required
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password..."
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 text-sm outline-none"
                                />
                            </div>

                            <div className="flex space-x-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 px-4 bg-sky-600 text-white font-semibold rounded-xl hover:bg-sky-700 transition text-sm"
                                >
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <div className="w-64 bg-slate-800 text-white flex flex-col justify-between">
                <div>
                    <div className="p-4 flex items-center space-x-3 border-b border-slate-700">
                        <Shield className="w-8 h-8 text-sky-400" />
                        <span className="text-xl font-bold tracking-wider">Admin Panel</span>
                    </div>
                    <nav className="p-4 space-y-2">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            <Users className="w-5 h-5" />
                            <span>Manage Users</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('books')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'books' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            <BookOpen className="w-5 h-5" />
                            <span>Manage Books</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'map' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            <MapIcon className="w-5 h-5" />
                            <span>Library Map</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'orders' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            <Box className="w-5 h-5" />
                            <span>Manage Orders</span>
                        </button>
                    </nav>
                </div>

                <div className="p-4 border-t border-slate-700 space-y-2">
                    <button
                        onClick={() => { setShowPasswordModal(true); setPasswordError(''); setPasswordSuccess(''); }}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-700 text-sm"
                    >
                        <Key className="w-4 h-4 text-sky-400" />
                        <span>Change Password</span>
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-700 text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                    </button>
                    <button
                        onClick={() => { setShowDeleteModal(true); setDeletePassword(''); setDeleteError(''); }}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-red-400 hover:text-red-300 transition-colors rounded-lg hover:bg-red-900/30 text-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete My Account</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center">
                        <h1 className="text-3xl font-bold text-gray-800 capitalize mr-4">
                            {activeTab === 'map' ? 'Location Map & Book Locator' : `${activeTab} Management`}
                        </h1>
                        {activeTab === 'books' && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowBookModal(true)}
                                    className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition"
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Add Book
                                </button>
                                <button
                                    onClick={handleRestock}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition"
                                    title="Reset all books with 0 copies to 3 (testing utility)"
                                >
                                    🔄 Restock All
                                </button>
                            </div>
                        )}
                    </div>

                    {(activeTab === 'users' || activeTab === 'books') && (
                        <div className="relative w-64">
                            <input
                                type="text"
                                placeholder={`Search ${activeTab === 'users' ? 'users' : 'books'}...`}
                                value={activeTab === 'users' ? userSearch : bookSearch}
                                onChange={(e) => {
                                    if (activeTab === 'users') {
                                        setUserSearch(e.target.value);
                                    } else {
                                        setBookSearch(e.target.value);
                                        setBookPage(1);
                                    }
                                }}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm text-sm"
                            />
                            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                        </div>
                    )}
                </div>

                {/* Tab Views */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="p-4 font-semibold text-gray-600">Username</th>
                                    <th className="p-4 font-semibold text-gray-600">Email</th>
                                    <th className="p-4 font-semibold text-gray-600">Role</th>
                                    <th className="p-4 font-semibold text-gray-600">Status</th>
                                    <th className="p-4 font-semibold text-gray-600">Penalty Status</th>
                                    <th className="p-4 font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u._id} className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-medium">{u.username}</td>
                                        <td className="p-4 text-gray-500">{u.email}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${u.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {u.isRestricted ?
                                                <span className="flex items-center text-red-600 text-sm"><Ban className="w-4 h-4 mr-1" /> Restricted</span> :
                                                <span className="text-green-600 text-sm">Active</span>
                                            }
                                        </td>
                                        <td className="p-4">
                                            {u.totalPenalty > 0 ? (
                                                <span className="flex items-center text-red-600 text-sm font-bold bg-red-50 px-2 py-1 rounded w-max border border-red-200">
                                                    <AlertTriangle className="w-4 h-4 mr-1 text-red-500" /> ₹{u.totalPenalty}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-sm">Clear</span>
                                            )}
                                        </td>
                                        <td className="p-4 space-x-2">
                                            <button onClick={() => viewUserReport(u._id)} className="px-3 py-1 text-sm bg-sky-100 text-sky-700 rounded hover:bg-sky-200 transition">
                                                View Report
                                            </button>
                                            {u.role !== 'Admin' && (
                                                <button onClick={() => toggleRestrict(u._id)} className="px-3 py-1 text-sm bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition">
                                                    {u.isRestricted ? 'Unrestrict' : 'Restrict'}
                                                </button>
                                            )}
                                            <button onClick={() => deleteUser(u._id)} className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition">
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr><td colSpan="6" className="p-4 text-center text-gray-500">No users found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* BOOKS TAB */}
                    {activeTab === 'books' && (
                        <div className="flex flex-col h-full">
                            <div className="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200">
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                    <span className="font-medium">Show:</span>
                                    <select
                                        value={bookLimit}
                                        onChange={(e) => {
                                            setBookLimit(Number(e.target.value));
                                            setBookPage(1);
                                        }}
                                        className="border-gray-300 rounded-md text-sm p-1 focus:ring-sky-500 cursor-pointer"
                                    >
                                        <option value={5}>5 books</option>
                                        <option value={10}>10 books</option>
                                        <option value={20}>20 books</option>
                                        <option value={50}>50 books</option>
                                    </select>
                                </div>
                                <div className="text-sm text-gray-500">
                                    Total Books: {bookTotalResults || books.length}
                                </div>
                            </div>

                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left border-collapse min-w-max">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="p-4 font-semibold text-gray-600 uppercase tracking-wider text-xs">Book</th>
                                            <th className="p-4 font-semibold text-gray-600 uppercase tracking-wider text-xs">Author</th>
                                            <th className="p-4 font-semibold text-gray-600 uppercase tracking-wider text-xs">ISBN</th>
                                            <th className="p-4 font-semibold text-gray-600 uppercase tracking-wider text-xs">Stock</th>
                                            <th className="p-4 font-semibold text-gray-600 uppercase tracking-wider text-xs">Location</th>
                                            <th className="p-4 font-semibold text-gray-600 uppercase tracking-wider text-xs">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {books.map(b => (
                                            <tr
                                                key={b._id}
                                                className={`border-b transition-colors ${b.availableCount === 0 ? 'bg-red-50 hover:bg-red-100/70 border-red-100' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="p-4 font-medium text-gray-800 flex items-center">
                                                    <div className="w-8 h-11 shrink-0 overflow-hidden rounded shadow-sm mr-3 bg-gray-100 border border-gray-200">
                                                        <BookCover book={b} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 leading-tight">{b.Title}</p>
                                                        <span className="text-xs text-sky-600 font-medium">{b.Category || 'General'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-gray-600">{b.Author}</td>
                                                <td className="p-4 text-gray-500 font-mono text-xs">{b.ISBN}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${b.availableCount > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {b.availableCount} / {b.quantity || 1}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                                        {b.Location?.shelfNumber
                                                            ? `${b.Location.shelfNumber} (Slot ${b.Location.slotIndex || 1})`
                                                            : 'No shelf assigned'}
                                                    </span>
                                                </td>
                                                <td className="p-4 space-x-2">
                                                    <button
                                                        onClick={() => handleEditClick(b)}
                                                        className="px-3 py-1.5 text-xs font-medium rounded bg-sky-100 text-sky-700 hover:bg-sky-200 transition"
                                                    >
                                                        Edit
                                                    </button>
                                                    {b.hasGhostBorrow && (
                                                        <button
                                                            onClick={() => clearBookHistory(b._id)}
                                                            className="px-3 py-1.5 text-xs font-medium rounded bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300"
                                                        >
                                                            Clear Ghost
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => deleteBook(b._id)}
                                                        className="px-3 py-1.5 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 transition"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {books.length === 0 && (
                                            <tr><td colSpan="6" className="p-8 text-center text-gray-500 italic">No books found. Adjust search or filters.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {bookTotalPages > 1 && (
                                <div className="flex justify-between items-center p-4 bg-white border-t border-gray-200">
                                    <button
                                        onClick={() => setBookPage(prev => Math.max(1, prev - 1))}
                                        disabled={bookPage === 1}
                                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm font-medium text-gray-600 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                                        Page {bookPage} of {bookTotalPages}
                                    </span>
                                    <button
                                        onClick={() => setBookPage(prev => Math.min(bookTotalPages, prev + 1))}
                                        disabled={bookPage === bookTotalPages}
                                        className="px-4 py-2 border border-sky-600 text-sky-700 rounded-lg text-sm font-medium hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MAP TAB */}
                    {activeTab === 'map' && (
                        <div className="flex flex-col h-[750px]">
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                                <div>
                                    <h3 className="font-bold text-gray-800">Visual Layout Map Editor</h3>
                                    <p className="text-xs text-gray-500">Add shelves, place them with collision detection, and drag books directly into slots.</p>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingShelf(null);
                                            setPlacementMode(!placementMode);
                                            setShelfPlaceError('');
                                        }}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center shadow-sm ${
                                            placementMode
                                                ? 'bg-amber-600 text-white hover:bg-amber-700 animate-pulse'
                                                : 'bg-sky-600 text-white hover:bg-sky-700'
                                        }`}
                                    >
                                        <MapIcon className="w-4 h-4 mr-2" />
                                        {placementMode ? '🎯 Click Map to Place' : '➕ Place New Shelf'}
                                    </button>
                                </div>
                            </div>

                            {/* Placement Form */}
                            {placementMode && (
                                <div className="bg-sky-50 border-b border-sky-200 p-4 shrink-0">
                                    <form onSubmit={addShelf} className="flex items-center gap-4 flex-wrap">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                                {editingShelf ? 'Edit Shelf ID' : 'Shelf ID'}
                                            </label>
                                            <input
                                                required
                                                type="text"
                                                value={newShelf.shelfID}
                                                onChange={e => setNewShelf({ ...newShelf, shelfID: e.target.value })}
                                                className="px-3 py-1.5 border rounded-lg text-sm bg-white"
                                                placeholder="e.g. Shelf_D"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Shelf Label</label>
                                            <input
                                                required
                                                type="text"
                                                value={newShelf.label}
                                                onChange={e => setNewShelf({ ...newShelf, label: e.target.value })}
                                                className="px-3 py-1.5 border rounded-lg text-sm bg-white"
                                                placeholder="e.g. Chemistry Section"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Coordinates</label>
                                            <span className="text-xs font-mono bg-white px-3 py-2 border rounded-lg inline-block">
                                                {newShelf.coordinateX !== null ? `(${newShelf.coordinateX.toFixed(1)}%, ${newShelf.coordinateY.toFixed(1)}%)` : 'Click map to set'}
                                            </span>
                                        </div>
                                        <div className="flex items-end gap-2 pt-4">
                                            <button
                                                type="submit"
                                                disabled={newShelf.coordinateX === null}
                                                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                                            >
                                                {editingShelf ? 'Update Shelf' : 'Save Shelf'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPlacementMode(false);
                                                    setEditingShelf(null);
                                                    setNewShelf({ shelfID: '', label: '', coordinateX: null, coordinateY: null });
                                                    setPickedCoordsPx(null);
                                                }}
                                                className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                    {shelfPlaceError && (
                                        <p className="text-xs text-red-600 mt-2 font-bold flex items-center">
                                            <AlertTriangle className="w-4 h-4 mr-1 shrink-0" /> {shelfPlaceError}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Canvas Component */}
                            <div className="flex-1 overflow-hidden relative">
                                <LibraryMapCanvas
                                    layout={layout}
                                    shelves={layout}
                                    books={books}
                                    onShelfDelete={(shelf) => setShelfToDelete(shelf)}
                                    onShelfEdit={(shelf) => {
                                        setEditingShelf(shelf);
                                        setNewShelf({
                                            shelfID: shelf.shelfID,
                                            label: shelf.label,
                                            coordinateX: shelf.coordinateX,
                                            coordinateY: shelf.coordinateY
                                        });
                                        setPickedCoordsPx({
                                            x: (shelf.coordinateX / 100) * 1200,
                                            y: (shelf.coordinateY / 100) * 800
                                        });
                                        setPlacementMode(true);
                                    }}
                                    placementMode={placementMode}
                                    pickedPoint={pickedCoordsPx}
                                    pickedCoordsPx={pickedCoordsPx}
                                    onPlace={handleMapPlacement}
                                    onMapClick={handleMapPlacement}
                                    onRefreshLayout={() => { fetchLayout(); fetchBooks(); }}
                                    onBooksChange={() => { fetchLayout(); fetchBooks(); }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ORDERS TAB */}
                    {activeTab === 'orders' && (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="p-4 font-semibold text-gray-600">Order ID</th>
                                    <th className="p-4 font-semibold text-gray-600">Book</th>
                                    <th className="p-4 font-semibold text-gray-600">User</th>
                                    <th className="p-4 font-semibold text-gray-600">Status</th>
                                    <th className="p-4 font-semibold text-gray-600">Update Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <tr key={order._id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 font-mono text-xs text-gray-500">{order._id.slice(-8)}</td>
                                        <td className="p-4 font-medium text-gray-800">{order.bookId?.Title || 'Unknown Book'}</td>
                                        <td className="p-4 text-gray-600">{order.userId?.username || 'Unknown User'}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                order.currentStatus === 'Delivered' ? 'bg-green-100 text-green-800' :
                                                order.currentStatus === 'Shipped' ? 'bg-blue-100 text-blue-800' :
                                                order.currentStatus === 'Packed' ? 'bg-amber-100 text-amber-800' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {order.currentStatus}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <select
                                                value={order.currentStatus}
                                                onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                                                className="border rounded-md text-sm p-1.5 bg-white shadow-sm cursor-pointer"
                                            >
                                                {['Ordered', 'Packed', 'Shipped', 'Delivered'].map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                                {orders.length === 0 && (
                                    <tr><td colSpan="5" className="p-8 text-center text-gray-500 italic">No orders currently placed.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add Book Modal */}
            {showBookModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center">
                                <BookOpen className="w-5 h-5 mr-2 text-sky-600" /> Add Book to Catalog
                            </h3>
                            <button onClick={() => setShowBookModal(false)} className="text-gray-400 hover:text-gray-600 transition">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {/* Smart Fetch Toolbar */}
                            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6">
                                <label className="block text-xs font-bold text-sky-900 uppercase tracking-wider mb-2">
                                    Auto-Fetch from Internet (Google Books & Open Library)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Enter ISBN-10, ISBN-13, or Book Title..."
                                        value={newBook.ISBN || newBook.Title}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (/^[\d\-Xx]{7,}$/.test(val.replace(/[\s-]/g, ''))) {
                                                setNewBook(prev => ({ ...prev, ISBN: val }));
                                            } else {
                                                setNewBook(prev => ({ ...prev, Title: val }));
                                            }
                                        }}
                                        className="flex-1 px-4 py-2 border border-sky-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSmartFetch}
                                        disabled={isFetchingBook}
                                        className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2 shrink-0 shadow-sm"
                                    >
                                        {isFetchingBook ? 'Searching...' : '🔍 Smart Fetch'}
                                    </button>
                                </div>

                                {fetchSource && (
                                    <p className="text-xs text-emerald-700 font-semibold mt-2 flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Retrieved via {fetchSource}
                                    </p>
                                )}

                                {fetchError && (
                                    <p className="text-xs text-red-600 font-semibold mt-2 flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {fetchError}
                                    </p>
                                )}

                                {/* Multiple Preview Results */}
                                {previewList.length > 0 && (
                                    <div className="mt-3 border-t border-sky-200 pt-3">
                                        <p className="text-xs font-bold text-sky-800 mb-2">Select from multiple results:</p>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            {previewList.map((item, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => selectPreview(item)}
                                                    className="w-full text-left p-2 rounded bg-white hover:bg-sky-100 border border-sky-100 text-xs flex justify-between items-center transition"
                                                >
                                                    <span className="font-bold text-gray-900 truncate pr-2">{item.title} — {item.authors}</span>
                                                    <span className="text-sky-600 font-bold shrink-0">Select</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Book Form */}
                            <form onSubmit={handleAddBook} className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="w-32 h-44 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-200">
                                        <BookCover book={newBook} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Title *</label>
                                            <input
                                                required
                                                type="text"
                                                value={newBook.Title}
                                                onChange={e => setNewBook({ ...newBook, Title: e.target.value })}
                                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none ${isConflicting('Title') ? 'bg-yellow-50 border-yellow-400' : ''}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Author *</label>
                                            <input
                                                required
                                                type="text"
                                                value={newBook.Author}
                                                onChange={e => setNewBook({ ...newBook, Author: e.target.value })}
                                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none ${isConflicting('Author') ? 'bg-yellow-50 border-yellow-400' : ''}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">ISBN *</label>
                                            <input
                                                required
                                                type="text"
                                                value={newBook.ISBN}
                                                onChange={e => setNewBook({ ...newBook, ISBN: e.target.value })}
                                                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-sky-500 outline-none ${isConflicting('ISBN') ? 'bg-yellow-50 border-yellow-400' : ''}`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                                        <select
                                            value={newBook.Category}
                                            onChange={e => setNewBook({ ...newBook, Category: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                                        >
                                            {['Mechanics', 'Programming', 'Physics', 'Mathematics', 'DBMS', 'TOC', 'Fiction', 'General'].map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Total Quantity</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={newBook.quantity}
                                            onChange={e => setNewBook({ ...newBook, quantity: parseInt(e.target.value, 10) || 1, availableCount: parseInt(e.target.value, 10) || 1 })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Price (₹)</label>
                                        <input
                                            type="number"
                                            value={newBook.price}
                                            onChange={e => setNewBook({ ...newBook, price: parseInt(e.target.value, 10) || 0 })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Publisher</label>
                                        <input
                                            type="text"
                                            value={newBook.publisher}
                                            onChange={e => setNewBook({ ...newBook, publisher: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Cover Image URL</label>
                                        <input
                                            type="text"
                                            value={newBook.imageUrl}
                                            onChange={e => setNewBook({ ...newBook, imageUrl: e.target.value, thumbnail: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                                    <textarea
                                        rows="3"
                                        value={newBook.description}
                                        onChange={e => setNewBook({ ...newBook, description: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <button
                                        type="button"
                                        onClick={() => setShowBookModal(false)}
                                        className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                                    >
                                        Save Book
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Book Modal */}
            {showEditBookModal && editingBook && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center">
                                <BookOpen className="w-5 h-5 mr-2 text-sky-600" /> Edit Book Details
                            </h3>
                            <button onClick={() => setShowEditBookModal(false)} className="text-gray-400 hover:text-gray-600 transition">✕</button>
                        </div>

                        <form onSubmit={handleUpdateBook} className="p-6 overflow-y-auto space-y-4">
                            <div className="flex gap-4">
                                <div className="w-24 h-32 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                                    <BookCover book={editingBook} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Title</label>
                                        <input
                                            required
                                            type="text"
                                            value={editingBook.Title}
                                            onChange={e => setEditingBook({ ...editingBook, Title: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Author</label>
                                        <input
                                            required
                                            type="text"
                                            value={editingBook.Author}
                                            onChange={e => setEditingBook({ ...editingBook, Author: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">ISBN</label>
                                    <input
                                        type="text"
                                        value={editingBook.ISBN}
                                        onChange={e => setEditingBook({ ...editingBook, ISBN: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                                    <select
                                        value={editingBook.Category}
                                        onChange={e => setEditingBook({ ...editingBook, Category: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                                    >
                                        {['Mechanics', 'Programming', 'Physics', 'Mathematics', 'DBMS', 'TOC', 'Fiction', 'General'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Price (₹)</label>
                                    <input
                                        type="number"
                                        value={editingBook.price}
                                        onChange={e => setEditingBook({ ...editingBook, price: parseInt(e.target.value, 10) || 0 })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Total Quantity</label>
                                    <input
                                        type="number"
                                        value={editingBook.quantity}
                                        onChange={e => setEditingBook({ ...editingBook, quantity: parseInt(e.target.value, 10) || 1 })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Available Count</label>
                                    <input
                                        type="number"
                                        value={editingBook.availableCount}
                                        onChange={e => setEditingBook({ ...editingBook, availableCount: parseInt(e.target.value, 10) || 0 })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Cover Image URL</label>
                                <input
                                    type="text"
                                    value={editingBook.imageUrl}
                                    onChange={e => setEditingBook({ ...editingBook, imageUrl: e.target.value, thumbnail: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                                <textarea
                                    rows="3"
                                    value={editingBook.description}
                                    onChange={e => setEditingBook({ ...editingBook, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowEditBookModal(false)}
                                    className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Shelf Delete Confirmation Modal */}
            {shelfToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center space-x-3 mb-4 text-red-600">
                            <AlertTriangle className="w-6 h-6" />
                            <h3 className="text-lg font-bold text-gray-900">Delete Shelf "{shelfToDelete.shelfID}"?</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                            Deleting this shelf will unassign all books located on it. Books currently rented cannot be deleted until returned.
                        </p>
                        {shelfDeleteError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-4">
                                {shelfDeleteError}
                            </div>
                        )}
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShelfToDelete(null)}
                                className="flex-1 py-2.5 px-4 border rounded-xl text-gray-700 font-semibold hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteShelf}
                                disabled={isDeletingShelf}
                                className="flex-1 py-2.5 px-4 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition"
                            >
                                {isDeletingShelf ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Report Modal */}
            {showUserReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center">
                                <Users className="w-5 h-5 mr-2 text-sky-600" /> User Detailed Report
                            </h3>
                            <button onClick={() => { setShowUserReportModal(false); setSelectedUserReport(null); }} className="text-gray-400 hover:text-gray-600 transition p-1">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto w-full">
                            {reportLoading ? (
                                <div className="flex justify-center items-center py-20 text-gray-500">Loading Report...</div>
                            ) : selectedUserReport ? (
                                <div className="space-y-6">
                                    <div className="flex items-center space-x-4 border-b border-gray-100 pb-4">
                                        <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-2xl font-bold">
                                            {selectedUserReport.user?.username?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold text-gray-900">{selectedUserReport.user?.username}</h4>
                                            <p className="text-sm text-gray-500">{selectedUserReport.user?.email}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-sky-50 rounded-xl p-4 border border-sky-100 text-center">
                                            <p className="text-xs font-bold text-sky-700 uppercase tracking-wider mb-1">Purchased</p>
                                            <p className="text-2xl font-bold text-sky-900">{selectedUserReport.booksPurchased}</p>
                                        </div>
                                        <div className="bg-green-50 rounded-xl p-4 border border-green-100 text-center">
                                            <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Issued</p>
                                            <p className="text-2xl font-bold text-green-900">{selectedUserReport.booksIssued}</p>
                                        </div>
                                        <div className={`rounded-xl p-4 border text-center ${selectedUserReport.totalPenalty > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                                            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${selectedUserReport.totalPenalty > 0 ? 'text-red-700' : 'text-gray-600'}`}>Unpaid Penalty</p>
                                            <p className={`text-2xl font-bold ${selectedUserReport.totalPenalty > 0 ? 'text-red-600' : 'text-gray-800'}`}>₹{selectedUserReport.totalPenalty}</p>
                                            {selectedUserReport.totalPenalty > 0 && (
                                                <button
                                                    onClick={() => handlePayUserFines(selectedUserReport.user._id)}
                                                    className="mt-2 text-xs font-bold bg-red-600 text-white px-2 py-1 rounded shadow-sm hover:bg-red-700 transition"
                                                >
                                                    Mark Fines Paid
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h5 className="font-bold text-gray-800 mb-3 flex items-center"><BookOpen className="w-4 h-4 mr-2" /> Currently Held Books</h5>
                                        {selectedUserReport.heldBooks?.length === 0 ? (
                                            <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg">User holds no active books.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {selectedUserReport.heldBooks?.map(hb => (
                                                    <div key={hb._id} className={`flex flex-col p-3 border rounded-xl ${hb.fine > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'}`}>
                                                        <div className="flex items-center">
                                                            <div className="w-10 h-14 shrink-0 overflow-hidden rounded shadow-sm mr-4 bg-gray-100">
                                                                <BookCover book={hb.book} className="w-full h-full object-cover" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h6 className="font-bold text-gray-900 truncate text-sm">{hb.book?.Title}</h6>
                                                                <div className="flex items-center mt-1">
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                                        hb.fine > 0 ? 'bg-red-100 text-red-700 font-bold' : 'bg-green-100 text-green-700'
                                                                    }`}>
                                                                        {hb.fine > 0 ? `Overdue (₹${hb.fine})` : `${hb.daysRemaining} days remaining`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
