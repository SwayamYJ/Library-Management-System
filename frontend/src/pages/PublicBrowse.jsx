import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search, LogIn, Filter } from 'lucide-react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import BookCover from '../components/BookCover';

const PublicBrowse = () => {
    const [books, setBooks] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const { user } = useContext(AuthContext);

    const fetchBooks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/books?search=${encodeURIComponent(searchTerm)}&category=${encodeURIComponent(category)}`);
            setBooks(res.data);
        } catch (err) {
            console.error('Error fetching books:', err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, category]);

    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);

    const categories = [...new Set(books.map(b => b.Category).filter(Boolean))];

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Navbar */}
            <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <BookOpen className="w-8 h-8 text-sky-600 mr-2" />
                            <span className="text-xl font-bold tracking-tight text-slate-800">SmartLibrary Catalog</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            {user ? (
                                <Link to={user.role === 'Admin' ? '/admin' : '/dashboard'} className="text-sky-600 hover:text-sky-800 font-medium">
                                    My Dashboard
                                </Link>
                            ) : (
                                <Link to="/login" className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700">
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Staff / Member Login
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Search Section */}
            <div className="bg-sky-900 py-16 px-4">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="text-4xl font-extrabold text-white mb-6 tracking-tight">Discover Your Next Great Read</h1>

                    <div className="relative max-w-2xl mx-auto bg-white rounded-lg shadow-xl flex items-center p-2">
                        <Search className="w-6 h-6 text-slate-400 ml-3" />
                        <input
                            type="text"
                            placeholder="Search by title, author, or ISBN..."
                            className="px-4 py-3 w-full focus:outline-none text-lg text-slate-700 placeholder-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="h-8 border-r border-slate-300 mx-2"></div>
                        <div className="relative flex items-center min-w-[150px]">
                            <Filter className="w-5 h-5 text-slate-400 absolute left-3" />
                            <select
                                className="pl-10 pr-4 py-3 w-full focus:outline-none text-slate-700 bg-transparent appearance-none cursor-pointer"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                <option value="">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <p className="mt-4 text-sky-200 font-medium">Browse from our collection of {books.length} titles.</p>
                </div>
            </div>

            {/* Book Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {loading ? (
                    <div className="text-center py-20 text-slate-500">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent mb-4"></div>
                        <p className="text-lg">Loading books...</p>
                    </div>
                ) : books.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <BookOpen className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <p className="text-xl">No books found in database.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {books.map((book) => (
                            <Link to={`/book/${book._id}`} key={book._id} className="group flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                {/* Book Cover */}
                                <div className="h-64 bg-slate-100 border-b border-slate-200 relative flex items-center justify-center group-hover:bg-slate-50 transition-colors overflow-hidden">
                                    <BookCover book={book} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                </div>

                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                            {book.Category || 'Uncategorized'}
                                        </span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${book.availableCount > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {book.availableCount > 0 ? `${book.availableCount} Available` : 'Waitlist'}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 mt-2 line-clamp-2">{book.Title}</h3>
                                    <p className="text-sm text-slate-500 mb-4">{book.Author}</p>

                                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center text-sm font-medium text-sky-600 group-hover:text-sky-700">
                                        View Details & Comments <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicBrowse;
