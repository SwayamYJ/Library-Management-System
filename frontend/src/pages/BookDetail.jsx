import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BookOpen, MapPin, Hash, User, Clock, MessageSquare, Send, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import BookCover from '../components/BookCover';

const BookDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [book, setBook] = useState(null);
    const [comments, setComments] = useState([]);
    const [layout, setLayout] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [penalty, setPenalty] = useState(0);

    // Edit Comment States
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');
    const [tenureDays, setTenureDays] = useState(14);

    const fetchBookData = useCallback(async () => {
        try {
            const bookRes = await api.get(`/books/${id}`);
            setBook(bookRes.data);

            const commentsRes = await api.get(`/books/${id}/comments`);
            setComments(commentsRes.data);

            const layoutRes = await api.get(`/layout`);
            setLayout(layoutRes.data);

            if (user) {
                try {
                    const penaltyRes = await api.get('/actions/my-penalty');
                    setPenalty(penaltyRes.data.totalPenalty || 0);
                } catch (e) {
                    console.error('Error fetching penalty:', e);
                }
            }
        } catch (err) {
            console.error('Error loading book details:', err);
        } finally {
            setLoading(false);
        }
    }, [id, user]);

    useEffect(() => {
        fetchBookData();
    }, [fetchBookData]);

    const handleIssue = async () => {
        if (!user) return navigate('/login');
        if (!tenureDays || tenureDays < 1 || tenureDays > 30) {
            return alert('Please enter a valid borrowing duration between 1 and 30 days.');
        }
        try {
            await api.post('/actions/issue', { bookId: id, tenureDays: parseInt(tenureDays, 10) });
            alert('Book Issued successfully!');
            fetchBookData();
        } catch (err) {
            alert(err.response?.data?.msg || 'Error issuing book');
        }
    };

    const handleOrder = async () => {
        if (!user) return navigate('/login');
        try {
            await api.post('/transactions/order', { bookId: id });
            alert('Order placed! Track it from your dashboard.');
            fetchBookData();
        } catch (err) {
            alert(err.response?.data?.msg || 'Error placing order');
        }
    };

    const submitComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            await api.post(`/books/${id}/comments`, { text: newComment.trim() });
            setNewComment('');
            fetchBookData();
        } catch (err) {
            alert(err.response?.data?.msg || 'Error posting comment');
        }
    };

    const deleteComment = async (cid) => {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await api.delete(`/books/${id}/comments/${cid}`);
            fetchBookData();
        } catch (err) {
            alert(err.response?.data?.msg || 'Error deleting comment');
        }
    };

    const startEditing = (comment) => {
        setEditingId(comment._id);
        setEditText(comment.text);
    };

    const saveEdit = async (cid) => {
        try {
            await api.put(`/books/${id}/comments/${cid}`, { text: editText });
            setEditingId(null);
            fetchBookData();
        } catch (err) {
            alert(err.response?.data?.msg || 'Error updating comment');
        }
    };

    if (loading) return <div className="text-center py-20 text-slate-500">Loading book details...</div>;
    if (!book) return <div className="text-center py-20 text-xl font-medium text-slate-600">Book not found.</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <Link to="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-sky-600 transition">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Catalog
                    </Link>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Book Info Column */}
                <div className="md:col-span-1">
                    <div className="rounded-xl shadow-lg mb-6 overflow-hidden aspect-[2/3] relative bg-slate-900 border border-slate-200">
                        <BookCover book={book} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5">
                            <h1 className="text-xl font-bold text-white z-10 leading-tight drop-shadow-sm">{book.Title}</h1>
                            <p className="text-sky-200 font-medium text-sm mt-1 z-10 drop-shadow-sm">{book.Author}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                        <h3 className="font-bold text-slate-800 border-b pb-2">Location & Details</h3>

                        <div className="flex items-start">
                            <Hash className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">ISBN</p>
                                <p className="text-sm font-mono text-slate-800">{book.ISBN}</p>
                            </div>
                        </div>

                        {book.pageCount > 0 && (
                            <div className="flex items-start">
                                <BookOpen className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Pages</p>
                                    <p className="text-sm font-mono text-slate-800">{book.pageCount}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-start">
                            <MapPin className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Library Location</p>
                                <p className="text-sm text-slate-800">
                                    Floor {book.Location?.floor || '1'}, {book.Location?.section || 'Main'} Section<br />
                                    <span className="font-medium bg-slate-100 px-1 rounded inline-block mt-1">
                                        Shelf: {book.Location?.shelfNumber || 'General'} | Slot: {book.Location?.slotIndex || '1'}
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* Action Area */}
                        <div className="pt-4 mt-4 border-t border-slate-100">
                            <div className="mb-4 flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-600">Availability:</span>
                                <span className={`px-2 py-1 rounded text-sm font-bold ${book.availableCount > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {book.availableCount} Copies
                                </span>
                            </div>

                            {penalty > 50 && (
                                <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 flex items-start">
                                    <span className="mr-2">⚠️</span>
                                    <span>Unpaid penalty above ₹50. Please clear your dues before borrowing more books.</span>
                                </div>
                            )}

                            {user && book.availableCount > 0 && penalty <= 50 && (
                                <div className="mb-3">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Days to Borrow (1-30)*</label>
                                    <input
                                        type="number"
                                        min="1" max="30"
                                        value={tenureDays}
                                        onChange={(e) => setTenureDays(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        required
                                    />
                                </div>
                            )}

                            <button
                                onClick={handleIssue}
                                disabled={book.availableCount < 1 || penalty > 50 || !tenureDays || tenureDays < 1 || tenureDays > 30}
                                className="w-full py-3 bg-sky-600 text-white font-bold rounded-lg shadow hover:bg-sky-700 transition disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                            >
                                {book.availableCount > 0 ? (penalty > 50 ? 'Borrowing Blocked (Clear Dues)' : 'Issue this Book') : 'Currently Unavailable'}
                            </button>
                            <button
                                onClick={handleOrder}
                                disabled={book.availableCount < 1}
                                className="w-full py-2.5 bg-white border-2 border-sky-600 text-sky-700 font-bold rounded-lg hover:bg-sky-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                📦 Order this Book
                            </button>
                            {!user && <p className="text-xs text-center text-slate-500 mt-2">You must be logged in to issue books.</p>}
                        </div>
                    </div>
                </div>

                {/* Right Column: Synopsis, Map, and Comments */}
                <div className="md:col-span-2 space-y-8">

                    {/* Synopsis & Map Split Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex flex-col md:flex-row gap-8">

                            {/* Synopsis: 40% Width on Desktop */}
                            <div className="md:w-[40%] flex-shrink-0">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center mb-4">
                                    <BookOpen className="w-5 h-5 mr-2 text-sky-600" /> Book Synopsis
                                </h3>
                                {book.description ? (
                                    <div className="prose prose-sm text-slate-600 leading-relaxed text-justify">
                                        {book.description.split('\n').map((paragraph, i) => (
                                            <p key={i} className="mb-3">{paragraph}</p>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 italic">No synopsis available for this title.</p>
                                )}
                            </div>

                            {/* Visual Divider */}
                            <div className="hidden md:block w-px bg-slate-200"></div>
                            <div className="block md:hidden h-px w-full bg-slate-200 my-2"></div>

                            {/* Live Library Map */}
                            <div className="md:w-[60%] relative">
                                <div className="sticky top-6">
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center mb-4">
                                        <MapPin className="w-5 h-5 mr-2 text-sky-600" /> Live Library Map
                                    </h3>

                                    <div className="relative bg-slate-50 rounded-2xl border border-slate-200 w-full shadow-inner overflow-hidden flex items-center justify-center bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]" style={{ height: '400px' }}>
                                        
                                        <div className="grid grid-cols-3 gap-5 w-full max-w-4xl p-8 transition-all duration-700">
                                            {layout.sort((a, b) => a.coordinateX - b.coordinateX).map(shelf => {
                                                const activeShelfNumber = book.Location?.shelfNumber || 'General';
                                                const isTarget = shelf.shelfID === activeShelfNumber;

                                                return (
                                                    <div
                                                        key={shelf._id}
                                                        className={`bg-slate-50 border-2 rounded-lg flex flex-col items-center justify-start transition-all duration-700 relative
                                                            ${isTarget ? 'border-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.4)] z-20 scale-105'
                                                                : 'border-slate-300 opacity-90 z-10'}`}
                                                        style={{ height: '140px' }}
                                                    >
                                                        <div className={`w-full py-1 px-2 border-b flex justify-between items-center ${isTarget ? 'bg-blue-600 border-blue-700' : 'bg-slate-200 border-slate-300'}`}>
                                                            <span className={`text-[9px] font-black uppercase tracking-tight truncate ${isTarget ? 'text-white' : 'text-slate-600'}`}>
                                                                {shelf.shelfID}
                                                            </span>
                                                            {isTarget && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                                                        </div>

                                                        <div className="flex-1 w-full flex flex-wrap content-center p-2.5 gap-1.5 bg-white/50">
                                                            {Array.from({ length: shelf.totalSlots || 12 }, (_, i) => i + 1).map(slot => (
                                                                <div
                                                                    key={slot}
                                                                    className={`w-[20%] aspect-square border-2 rounded-sm transition-all duration-1000
                                                                        ${isTarget && book.Location?.slotIndex === slot 
                                                                            ? 'bg-emerald-500 border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse scale-125 z-10' 
                                                                            : 'bg-slate-100 border-slate-200/50'}`}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {book.Location?.shelfNumber && (
                                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-5 py-2.5 rounded-full shadow-[0_10px_25px_rgba(0,0,0,0.1)] border border-slate-200 z-40 flex items-center gap-3 scale-95 md:scale-100 transition-transform">
                                                <div className="bg-rose-100 p-1.5 rounded-full">
                                                    <MapPin className="w-4 h-4 text-rose-600 fill-rose-600" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Highlighted Spot</span>
                                                    <span className="text-sm font-black text-slate-800 leading-tight">
                                                        Shelf {book.Location.shelfNumber} <span className="text-slate-300 mx-1">|</span> Slot {book.Location.slotIndex || 1}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Member Reviews & Comments Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                            <MessageSquare className="w-5 h-5 mr-2 text-sky-600" /> Member Reviews & Comments
                        </h2>

                        {/* Add Comment Form */}
                        {user ? (
                            <form onSubmit={submitComment} className="mb-8 bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-start space-x-4">
                                <div className="w-10 h-10 rounded-full bg-sky-100 shrink-0 flex items-center justify-center overflow-hidden border border-sky-200">
                                    {user.profilePicture ?
                                        <img src={user.profilePicture} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} /> :
                                        <User className="w-5 h-5 text-sky-600" />
                                    }
                                </div>
                                <div className="flex-1 relative">
                                    <textarea
                                        required
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        placeholder="Share your thoughts on this book..."
                                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none h-24 text-sm"
                                    />
                                    <button type="submit" className="absolute bottom-3 right-3 p-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition shadow-sm">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                                <p className="text-sm text-slate-600 mb-3">Please log in to share your thoughts.</p>
                                <Link to="/login" className="inline-block px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50">Log In</Link>
                            </div>
                        )}

                        {/* Comments List */}
                        <div className="space-y-6">
                            {comments.length === 0 ? (
                                <p className="text-center text-slate-500 italic py-8 border-t border-slate-100">No reviews yet. Be the first to comment!</p>
                            ) : (
                                comments.map(c => (
                                    <div key={c._id} className="flex space-x-4 group">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 flex items-center justify-center overflow-hidden">
                                            {c.userId?.profilePicture ?
                                                <img src={c.userId.profilePicture} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} /> :
                                                <span className="font-bold text-slate-500">{c.userId?.username?.[0]?.toUpperCase()}</span>
                                            }
                                        </div>

                                        <div className="flex-1">
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-none p-4">
                                                <div className="flex items-baseline justify-between mb-1">
                                                    <span className="font-bold text-slate-800 text-sm">{c.userId?.username || 'Unknown User'}</span>
                                                    <span className="text-xs text-slate-400 flex items-center">
                                                        <Clock className="w-3 h-3 mr-1" /> {new Date(c.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                {editingId === c._id ? (
                                                    <div className="mt-2">
                                                        <textarea
                                                            className="w-full p-2 text-sm border rounded mb-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                            value={editText}
                                                            onChange={e => setEditText(e.target.value)}
                                                        />
                                                        <div className="flex space-x-2">
                                                            <button onClick={() => saveEdit(c._id)} className="text-xs px-3 py-1 bg-sky-600 text-white rounded">Save</button>
                                                            <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1 bg-slate-200 rounded">Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{c.text}</p>
                                                )}
                                            </div>

                                            {user && (user.id === c.userId?._id || user.role === 'Admin') && !editingId && (
                                                <div className="flex items-center space-x-3 mt-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {user.id === c.userId?._id && (
                                                        <button onClick={() => startEditing(c)} className="text-xs text-slate-500 hover:text-sky-600 flex items-center">
                                                            <Edit2 className="w-3 h-3 mr-1" /> Edit
                                                        </button>
                                                    )}
                                                    <button onClick={() => deleteComment(c._id)} className="text-xs text-slate-500 hover:text-red-600 flex items-center">
                                                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BookDetail;
