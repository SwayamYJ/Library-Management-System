import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, User, Shield, Lock } from 'lucide-react';
import api from '../services/api';

const Signup = () => {
    const { setUser } = useContext(AuthContext);
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [selectedRole, setSelectedRole] = useState('User');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            let res;

            if (selectedRole === 'Admin') {
                // Admin signup requires a secret key
                res = await api.post('/auth/admin-internal-signup', {
                    username, email, password, secretKey
                });
            } else {
                res = await api.post('/auth/signup', { username, email, password });
            }

            localStorage.setItem('token', res.data.token);
            setUser(res.data.user);

            if (res.data.user?.role === 'Admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }

        } catch (err) {
            setError(err.response?.data?.msg || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="bg-sky-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-600/30">
                        <BookOpen className="text-white w-9 h-9" />
                    </div>
                </div>
                <h2 className="mt-5 text-center text-3xl font-extrabold text-gray-900">
                    Create your account
                </h2>
                <p className="mt-2 text-center text-sm text-gray-500">
                    Join SmartLibrary today
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/80 rounded-2xl sm:px-10">

                    {/* Role Toggle */}
                    <div className="mb-6">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">I am a</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedRole('User')}
                                className={`flex flex-col items-center justify-center py-4 px-3 rounded-xl border-2 transition-all duration-200 cursor-pointer
                                    ${selectedRole === 'User'
                                        ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm shadow-sky-200'
                                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                    }`}
                            >
                                <User className={`w-6 h-6 mb-1.5 ${selectedRole === 'User' ? 'text-sky-600' : 'text-gray-400'}`} />
                                <span className="font-semibold text-sm">Student / User</span>
                                <span className="text-xs mt-0.5 opacity-70">Borrow & track books</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedRole('Admin')}
                                className={`flex flex-col items-center justify-center py-4 px-3 rounded-xl border-2 transition-all duration-200 cursor-pointer
                                    ${selectedRole === 'Admin'
                                        ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm shadow-purple-200'
                                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                    }`}
                            >
                                <Shield className={`w-6 h-6 mb-1.5 ${selectedRole === 'Admin' ? 'text-purple-600' : 'text-gray-400'}`} />
                                <span className="font-semibold text-sm">Administrator</span>
                                <span className="text-xs mt-0.5 opacity-70">Requires secret key</span>
                            </button>
                        </div>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start">
                                <span className="mr-1.5 mt-0.5">⚠️</span> {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Your display name"
                                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition sm:text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition sm:text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition sm:text-sm"
                            />
                        </div>

                        {/* Admin Secret Key Field — only visible when Admin is selected */}
                        {selectedRole === 'Admin' && (
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                <label className="block text-sm font-medium text-purple-800 mb-1 flex items-center">
                                    <Lock className="w-4 h-4 mr-1.5" /> Admin Secret Key
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={secretKey}
                                    onChange={(e) => setSecretKey(e.target.value)}
                                    placeholder="Enter the secret key..."
                                    className="appearance-none block w-full px-4 py-3 border border-purple-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition sm:text-sm bg-white"
                                />
                                <p className="text-xs text-purple-600 mt-2">This key is only given to authorized administrators.</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white transition-all disabled:opacity-60
                                ${selectedRole === 'Admin'
                                    ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-200 focus:ring-purple-500'
                                    : 'bg-sky-600 hover:bg-sky-700 shadow-sky-200 focus:ring-sky-500'
                                } focus:outline-none focus:ring-2 focus:ring-offset-2`}
                        >
                            {loading ? 'Creating Account...' : `Create ${selectedRole} Account`}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            Already have an account?{' '}
                            <Link to="/login" className="font-semibold text-sky-600 hover:text-sky-500 transition-colors">
                                Sign in here
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
