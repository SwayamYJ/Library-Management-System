import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import {
    BookOpen, LogOut, Clock, RotateCw, CornerDownLeft,
    User as UserIcon, Search, Box, CheckCircle2, AlertTriangle,
    BookMarked, IndianRupee, RefreshCw, History, BellRing
} from 'lucide-react';
import NotificationBar from '../components/NotificationBar';
import NotificationBell from '../components/NotificationBell';
import BookCover from '../components/BookCover';

const STATUSES = ['Ordered', 'Packed', 'Shipped', 'Delivered'];
const MOCK_LOCATIONS = {
    Ordered: 'SmartLibrary System',
    Packed: 'Main Library Hub',
    Shipped: 'Thane Warehouse',
    Delivered: 'Dombivli Delivery Hub',
};

// Live fine calculator (mirrors backend logic)
function calcFine(dueDate) {
    if (!dueDate) return 0;
    const now = new Date();
    const due = new Date(dueDate);
    if (now <= due) return 0;
    const daysOverdue = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
    return daysOverdue * 10; // ₹10 per day
}

const UserDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const [issuedBooks, setIssuedBooks] = useState([]);
    const [orders, setOrders] = useState([]);
    const [borrowHistory, setBorrowHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('issued');
    const [actionLoading, setActionLoading] = useState(null); // activityId that's loading

    const fetchIssued = useCallback(async () => {
        try {
            const res = await api.get('/actions/issued');
            setIssuedBooks(res.data);
        } catch (err) { console.error('Fetch issued error:', err); }
    }, []);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await api.get('/transactions/my-orders');
            setOrders(res.data);
        } catch (err) { console.error('Fetch orders error:', err); }
    }, []);

    const fetchBorrowHistory = useCallback(async () => {
        try {
            const res = await api.get('/actions/borrowing-history');
            setBorrowHistory(res.data);
        } catch (err) { console.error('Fetch history error:', err); }
    }, []);

    useEffect(() => {
        fetchIssued();
        fetchOrders();
        fetchBorrowHistory();
    }, [fetchIssued, fetchOrders, fetchBorrowHistory]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleRenew = async (activityId, renewCount) => {
        if (renewCount >= 2) {
            alert('❌ Renewal limit reached. This book can only be renewed 2 times.');
            return;
        }
        setActionLoading(activityId);
        try {
            const res = await api.post('/actions/renew', { activityId });
            alert(`✅ ${res.data.msg}`);
            fetchIssued();
        } catch (err) {
            alert(`❌ ${err.response?.data?.msg || 'Error renewing book'}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReturn = async (activityId, fine) => {
        const confirmMsg = fine > 0
            ? `⚠️ This book is overdue. You will incur a fine of ₹${fine}. Proceed with return?`
            : 'Return this book?';
        if (!window.confirm(confirmMsg)) return;

        setActionLoading(activityId);
        try {
            const res = await api.post('/actions/return', { activityId });
            alert(`✅ ${res.data.msg}`);
            fetchIssued();
            fetchBorrowHistory();
        } catch (err) {
            alert(`❌ ${err.response?.data?.msg || 'Error returning book'}`);
        } finally {
            setActionLoading(null);
        }
    };

    // Count active fines
    const totalFines = issuedBooks.reduce((sum, act) => sum + calcFine(act.dueDate), 0);

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* ── Sidebar ── */}
            <div className="w-64 bg-sky-900 text-white flex flex-col justify-between shadow-xl">
                <div>
                    {/* User Profile Summary */}
                    <div className="p-6 border-b border-sky-800">
                        <div className="flex items-center space-x-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-sky-700 flex items-center justify-center font-bold text-lg text-white border-2 border-sky-500 shadow-sm overflow-hidden">
                                {user?.profilePicture ? (
                                    <img src={user.profilePicture} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                                ) : (
                                    user?.username?.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="font-bold text-white text-base leading-tight truncate">{user?.username}</h2>
                                <p className="text-xs text-sky-200 truncate">{user?.email}</p>
                            </div>
                        </div>

                        {/* Fine badge in sidebar */}
                        {totalFines > 0 && (
                            <div className="mt-3 p-2.5 bg-red-950/80 border border-red-500/40 rounded-xl flex items-center space-x-2 text-xs text-red-200">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                <span>₹{totalFines} overdue fine</span>
                            </div>
                        )}

                        {/* Fine Details Box */}
                        {totalFines > 0 && (
                            <div className="mt-2 p-2 bg-sky-800/60 rounded-lg text-xs text-sky-200">
                                <h4 className="font-bold text-sky-200 mb-1 flex items-center"><IndianRupee className="w-3 h-3 mr-1" /> Fine Details</h4>
                                <div className="space-y-0.5 text-[11px] text-sky-300">
                                    <div className="flex justify-between">
                                        <span>Rate:</span>
                                        <span>₹10 / day overdue</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-white pt-1 border-t border-sky-700">
                                        <span>Total Due:</span>
                                        <span>₹{totalFines}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Nav */}
                    <nav className="p-4 space-y-1">
                        {[
                            { id: 'issued', label: 'My Issued Books', icon: BookMarked },
                            { id: 'orders', label: 'Track My Orders', icon: Box },
                            { id: 'history', label: 'Borrowing History', icon: History },
                        ].map((tab) => {
                            const TabIcon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-left
                                        ${activeTab === tab.id ? 'bg-sky-700 text-white font-medium' : 'text-sky-100 hover:bg-sky-800'}`}
                                >
                                    <TabIcon className="w-5 h-5 shrink-0" />
                                    <span className="text-sm">{tab.label}</span>
                                </button>
                            );
                        })}
                        <Link
                            to="/"
                            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sky-100 hover:bg-sky-800"
                        >
                            <Search className="w-5 h-5 shrink-0" />
                            <span className="text-sm">Browse Library</span>
                        </Link>
                        <Link
                            to="/profile"
                            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sky-100 hover:bg-sky-800"
                        >
                            <UserIcon className="w-5 h-5 shrink-0" />
                            <span className="text-sm">My Profile</span>
                        </Link>
                    </nav>
                </div>

                <div className="p-4 border-t border-sky-800">
                    <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-2 text-sky-300 hover:text-white transition-colors rounded-lg hover:bg-sky-800">
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-1">My Desk</h1>
                        <p className="text-gray-500 text-sm">
                            {activeTab === 'issued' ? 'Manage your currently issued library books.'
                                : activeTab === 'orders' ? 'Track your book delivery order status.'
                                    : 'View your complete borrowing history and past fines.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <NotificationBell />
                    </div>
                </div>

                {/* ── Global Notification Bar ── */}
                {activeTab === 'issued' && <NotificationBar issues={issuedBooks} />}

                {/* ── ISSUED BOOKS TAB ── */}
                {activeTab === 'issued' && (
                    <div>
                        {issuedBooks.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 text-center">
                                <BookOpen className="w-14 h-14 mx-auto mb-4 text-gray-200" />
                                <p className="text-lg font-medium text-gray-400">No books currently issued.</p>
                                <p className="text-sm text-gray-400 mt-1">Browse the library and use "Issue this Book" to borrow!</p>
                                <Link to="/" className="mt-4 inline-block px-5 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition">
                                    Browse Library
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {issuedBooks.map(act => {
                                    const fine = calcFine(act.dueDate);
                                    const isOverdue = fine > 0;
                                    const renewsLeft = 2 - (act.renewCount || 0);
                                    const loading = actionLoading === act._id;

                                    return (
                                        <div
                                            key={act._id}
                                            className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all
                                                ${isOverdue ? 'border-red-300 shadow-red-100' : 'border-gray-200'}`}
                                        >
                                            {/* Book Cover + Info */}
                                            <div className="flex p-4 space-x-4">
                                                <div className="w-16 h-22 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm" style={{ height: '88px' }}>
                                                    <BookCover book={act.bookId} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-gray-900 leading-tight truncate">{act.bookId?.Title}</h3>
                                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{act.bookId?.Author}</p>

                                                    <div className="mt-2">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold
                                                            ${isOverdue ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                                            {isOverdue ? `Overdue (₹${fine})` : 'Active Loan'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Due Date & Renew info */}
                                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 flex justify-between items-center">
                                                <span>Due: {act.dueDate ? new Date(act.dueDate).toLocaleDateString('en-IN') : 'N/A'}</span>
                                                <span className="text-gray-400">{renewsLeft} renewals left</span>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="p-4 pt-2 flex gap-2 mt-auto">
                                                <button
                                                    onClick={() => handleRenew(act._id, act.renewCount || 0)}
                                                    disabled={renewsLeft <= 0 || loading || isOverdue}
                                                    className="flex-1 py-2 px-3 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                                >
                                                    <RotateCw className="w-3.5 h-3.5" />
                                                    Renew
                                                </button>
                                                <button
                                                    onClick={() => handleReturn(act._id, fine)}
                                                    disabled={loading}
                                                    className="flex-1 py-2 px-3 bg-slate-800 text-white hover:bg-slate-900 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                                                >
                                                    <CornerDownLeft className="w-3.5 h-3.5" />
                                                    Return
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── TRACK ORDERS TAB ── */}
                {activeTab === 'orders' && (
                    <div>
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                                <Box className="w-5 h-5 mr-2 text-sky-600" /> Book Delivery Tracking
                            </h2>

                            {orders.length === 0 ? (
                                <div className="text-center py-16 text-gray-500">
                                    <Box className="w-14 h-14 mx-auto mb-4 text-gray-200" />
                                    <p className="text-lg font-medium text-gray-400">No orders placed yet.</p>
                                    <Link to="/" className="mt-4 inline-block px-5 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition">Browse Library</Link>
                                </div>
                            ) : (
                                <div className="space-y-10">
                                    {orders.map(order => {
                                        const currentIdx = STATUSES.indexOf(order.currentStatus);
                                        return (
                                            <div key={order._id} className="border border-gray-100 rounded-xl p-6 shadow-sm">
                                                <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="w-14 h-20 shrink-0 overflow-hidden rounded shadow-sm bg-slate-100">
                                                            <BookCover book={order.bookId} className="w-full h-full object-cover" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-gray-900 text-lg">{order.bookId?.Title || 'Unknown Book'}</h3>
                                                            <p className="text-sm text-gray-500">{order.bookId?.Author}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0
                                                        ${order.currentStatus === 'Delivered' ? 'bg-green-100 text-green-800' :
                                                            order.currentStatus === 'Shipped' ? 'bg-blue-100 text-blue-800' :
                                                                order.currentStatus === 'Packed' ? 'bg-amber-100 text-amber-800' :
                                                                    'bg-gray-100 text-gray-700'}`}>
                                                        {order.currentStatus}
                                                    </span>
                                                </div>
                                                <div className="relative ml-3">
                                                    <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-gray-200" />
                                                    <div className="space-y-6">
                                                        {STATUSES.map((step, idx) => {
                                                            const isCompleted = idx < currentIdx;
                                                            const isActive = idx === currentIdx;
                                                            const isFuture = idx > currentIdx;
                                                            const timelineEntry = order.timeline?.find(t => t.status === step);
                                                            return (
                                                                <div key={step} className="relative flex items-start space-x-4">
                                                                    <div className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0
                                                                        ${isCompleted ? 'bg-green-500 border-green-500' :
                                                                            isActive ? 'bg-sky-500 border-sky-500 ring-4 ring-sky-100' :
                                                                                'bg-white border-gray-300'}`}>
                                                                        {(isCompleted || isActive) ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> :
                                                                            <div className="w-2 h-2 rounded-full bg-gray-300" />}
                                                                    </div>
                                                                    <div className={`flex-1 pb-2 rounded-lg p-3 border transition-all
                                                                        ${isCompleted ? 'bg-green-50 border-green-100' :
                                                                            isActive ? 'bg-sky-50 border-sky-200 shadow-sm' :
                                                                                'bg-gray-50 border-gray-100 opacity-50'}`}>
                                                                        <div className="flex justify-between items-center">
                                                                            <p className={`font-bold text-sm
                                                                                ${isCompleted ? 'text-green-700' : isActive ? 'text-sky-700' : 'text-gray-400'}`}>
                                                                                {step}
                                                                                {isActive && <span className="ml-2 text-[10px] bg-sky-500 text-white px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide">Current</span>}
                                                                            </p>
                                                                            {timelineEntry && (
                                                                                <time className="text-xs text-gray-500 shrink-0">
                                                                                    {new Date(timelineEntry.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                                                </time>
                                                                            )}
                                                                        </div>
                                                                        <p className={`text-xs mt-1 ${isCompleted ? 'text-green-600' : isActive ? 'text-sky-600 font-medium' : 'text-gray-400'}`}>
                                                                            {timelineEntry ? timelineEntry.location : isFuture ? `Next: ${MOCK_LOCATIONS[step]}` : MOCK_LOCATIONS[step]}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── BORROWING HISTORY TAB ── */}
                {activeTab === 'history' && (
                    <div>
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-5 bg-gray-50 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                    <History className="w-5 h-5 mr-2 text-sky-600" /> Borrowing History ({borrowHistory.length})
                                </h2>
                            </div>
                            {borrowHistory.length === 0 ? (
                                <div className="text-center py-16 text-gray-500">
                                    <History className="w-14 h-14 mx-auto mb-3 text-gray-200" />
                                    <p className="text-lg font-medium text-gray-400">No borrowing history yet.</p>
                                    <p className="text-sm text-gray-400 mt-1">Returned books will appear here.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {borrowHistory.map(record => {
                                        const fine = record.fine ?? record.fineAmount ?? 0;
                                        return (
                                            <div key={record._id} className="flex items-center p-4 hover:bg-gray-50 transition">
                                                <div className="w-10 h-13 bg-gray-100 rounded overflow-hidden shadow-sm mr-4 shrink-0" style={{ height: '52px' }}>
                                                    <BookCover book={record.bookId} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-900 truncate">{record.bookId?.Title || 'Unknown Book'}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{record.bookId?.Author}</p>
                                                    <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                                                        <span>Issued: {new Date(record.issueDate || record.createdAt).toLocaleDateString('en-IN')}</span>
                                                        <span>•</span>
                                                        <span>Returned: {record.returnedAt ? new Date(record.returnedAt).toLocaleDateString('en-IN') : 'Active'}</span>
                                                        {record.renewCount > 0 && (
                                                            <><span>•</span><span className="text-amber-600">Renewed {record.renewCount}×</span></>
                                                        )}
                                                    </div>
                                                </div>
                                                {fine > 0 ? (
                                                    <div className="text-right shrink-0 ml-4">
                                                        <span className="text-red-600 font-bold text-sm">₹{fine}</span>
                                                        <p className="text-xs text-red-400">{record.finePaid ? 'Paid' : 'Unpaid fine'}</p>
                                                    </div>
                                                ) : (
                                                    <div className="ml-4 shrink-0">
                                                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">No fine</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserDashboard;
