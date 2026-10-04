import React, { useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { User, Upload, ArrowLeft, Save, Lock } from 'lucide-react';

const Profile = () => {
    const { user, setUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwdMessage, setPwdMessage] = useState('');
    const [pwdLoading, setPwdLoading] = useState(false);

    // Protect route
    if (!user) {
        navigate('/login');
        return null;
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setMessage('');
        } else {
            setMessage('Please select a valid image file.');
            setSelectedFile(null);
            setPreviewUrl(null);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            setMessage('Please select a file first.');
            return;
        }

        const formData = new FormData();
        formData.append('profilePicture', selectedFile);

        setUploading(true);
        setMessage('');

        try {
            const res = await api.put('/profile/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setMessage('Profile picture updated successfully!');
            setUser(prev => ({ ...prev, profilePicture: res.data.profilePicture }));
        } catch (err) {
            console.error(err);
            setMessage(err.response?.data?.msg || 'Error uploading file.');
        } finally {
            setUploading(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPwdMessage('');

        if (newPassword.length < 6) {
            setPwdMessage('New password must be at least 6 characters.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPwdMessage('New passwords do not match.');
            return;
        }

        setPwdLoading(true);
        try {
            await api.put('/profile/change-password', {
                currentPassword,
                newPassword
            });
            setPwdMessage('Password updated successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setPwdMessage(err.response?.data?.msg || 'Failed to update password.');
        } finally {
            setPwdLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
                <div className="mb-6 flex justify-between items-center">
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Your Profile</h1>
                    <Link to={user.role === 'Admin' ? '/admin' : '/dashboard'} className="text-sm flex items-center text-sky-600 hover:text-sky-800 font-medium">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                    </Link>
                </div>

                <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-100 sm:px-10">

                    {message && (
                        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes('success') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                            {message}
                        </div>
                    )}

                    <div className="flex flex-col items-center">
                        {/* Avatar Display */}
                        <div className="relative group cursor-pointer mb-6" onClick={() => fileInputRef.current.click()}>
                            <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-lg flex items-center justify-center">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : user.profilePicture ? (
                                    <img src={`http://localhost:5000${user.profilePicture}`} alt="Current Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-16 h-16 text-slate-300" />
                                )}
                            </div>

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="w-6 h-6 text-white mb-1" />
                                <span className="text-xs text-white font-medium">Change Photo</span>
                            </div>
                        </div>

                        <h2 className="text-xl font-bold text-slate-800 mb-1">{user.username}</h2>
                        <p className="text-slate-500 text-sm mb-6">{user.email}</p>

                        <form onSubmit={handleUpload} className="w-full">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*"
                            />

                            <button
                                type="submit"
                                disabled={!selectedFile || uploading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {uploading ? 'Uploading...' : 'Save Profile Picture'}
                                {!uploading && <Save className="w-4 h-4 ml-2" />}
                            </button>
                        </form>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Account Role</span>
                            <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{user.role}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-3">
                            <span className="text-slate-500">Account Status</span>
                            <span className={`font-medium px-2 py-0.5 rounded ${user.isRestricted ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {user.isRestricted ? 'Restricted' : 'Active'}
                            </span>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-sky-600" />
                            Change Password
                        </h3>

                        {pwdMessage && (
                            <div className={`mb-3 p-2.5 rounded-lg text-xs font-semibold ${pwdMessage.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {pwdMessage}
                            </div>
                        )}

                        <form onSubmit={handlePasswordChange} className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Current Password</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                    placeholder="At least 6 characters"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                    placeholder="Repeat new password"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={pwdLoading || !currentPassword || !newPassword}
                                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                                {pwdLoading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
