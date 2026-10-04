import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Shield, User } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState('User'); // 'User' or 'Admin'

    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await login({ email, password });
            // Role comes from the database — the toggle is just a UX hint
            if (data.user.role === 'Admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.msg || 'Login failed. Please try again.');
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
                    Sign in to SmartLibrary
                </h2>
                <p className="mt-2 text-center text-sm text-gray-500">
                    Select your role to continue
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/80 rounded-2xl sm:px-10">

                    {/* Role Toggle */}
                    <div className="mb-6">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sign in as</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedRole('User')}
                                className={`flex flex-col items-center justify-center py-4 px-3 rounded-xl border-2 transition-all duration-200 cursor-pointer
                                    ${selectedRole === 'User'
                                        ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm shadow-sky-200'
                                        : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
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
                                        : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                                    }`}
                            >
                                <Shield className={`w-6 h-6 mb-1.5 ${selectedRole === 'Admin' ? 'text-purple-600' : 'text-gray-400'}`} />
                                <span className="font-semibold text-sm">Administrator</span>
                                <span className="text-xs mt-0.5 opacity-70">Manage the library</span>
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email address
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={selectedRole === 'Admin' ? 'admin@library.com' : 'you@example.com'}
                                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition sm:text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition sm:text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white transition-all disabled:opacity-60
                                ${selectedRole === 'Admin'
                                    ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500 shadow-purple-200'
                                    : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500 shadow-sky-200'
                                } shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2`}
                        >
                            {loading ? `Signing in as ${selectedRole}...` : `Sign in as ${selectedRole}`}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            Don't have an account?{' '}
                            <Link to="/signup" className="font-semibold text-sky-600 hover:text-sky-500 transition-colors">
                                Sign up here
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
