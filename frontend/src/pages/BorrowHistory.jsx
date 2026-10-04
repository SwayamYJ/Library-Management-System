import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History, BookOpen, Clock, CheckCircle, ChevronLeft } from 'lucide-react';
import api from '../services/api';
import BookCover from '../components/BookCover';

const BorrowHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await api.get('/borrow/my-history');
                setHistory(res.data);
            } catch (err) {
                console.error('Borrow history fetch error:', err);
                setError('Failed to fetch borrowing history. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-600 font-medium">Loading your borrowing history...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            <div className="bg-sky-700 text-white">
                <div className="max-w-5xl mx-auto px-4 py-8">
                    <div className="flex items-center space-x-3 mb-2">
                        <Link to="/profile" className="text-sky-200 hover:text-white transition flex items-center text-sm font-medium">
                            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Profile
                        </Link>
                    </div>
                    <h1 className="text-3xl font-bold flex items-center">
                        <History className="w-8 h-8 mr-3 text-sky-300" /> My Borrowing History
                    </h1>
                    <p className="text-sky-100 mt-2 text-lg opacity-90">A permanent record of all the books you've read.</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 mt-8">
                {error && (
                    <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl mb-6 flex items-center">
                        <span className="font-bold mr-2">Error:</span> {error}
                    </div>
                )}

                {!loading && history.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <BookOpen className="w-10 h-10 text-slate-400" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">No Borrowing History</h2>
                        <p className="text-slate-500 mb-6 max-w-sm">You haven't borrowed any books yet. Explore the catalog to start reading!</p>
                        <Link to="/" className="px-6 py-3 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-700 transition">
                            Browse Catalog
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                                        <th className="p-4 font-semibold uppercase tracking-wider">Book Name</th>
                                        <th className="p-4 font-semibold uppercase tracking-wider">Author</th>
                                        <th className="p-4 font-semibold uppercase tracking-wider">Issue Date</th>
                                        <th className="p-4 font-semibold uppercase tracking-wider">Return Date</th>
                                        <th className="p-4 font-semibold uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((record) => (
                                        <tr key={record._id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                                            <td className="p-4 flex items-center space-x-4">
                                                <div className="w-12 h-16 shrink-0 overflow-hidden rounded shadow-sm border border-slate-200 bg-slate-100">
                                                    <BookCover book={record.bookId} className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{record.bookId?.Title || 'Unknown Book'}</p>
                                                    <p className="text-xs font-mono text-slate-500 mt-0.5">ID: {record._id.slice(-6)}</p>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-600 font-medium">
                                                {record.bookId?.Author || 'Unknown'}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center text-slate-600 text-sm">
                                                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 shrink-0" />
                                                    {new Date(record.issueDate || record.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {record.returnedAt ? (
                                                    <div className="flex items-center text-slate-600 text-sm">
                                                        <Clock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                                                        {new Date(record.returnedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                    </div>
                                                ) : (
                                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                                                        Currently Borrowed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {record.returnedAt ? (
                                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 font-bold rounded border border-slate-200 text-sm">Returned</span>
                                                ) : (
                                                    <span className="px-3 py-1 bg-green-100 text-green-700 font-bold rounded border border-green-200 text-sm">Active</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BorrowHistory;
