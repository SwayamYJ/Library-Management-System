import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import api from '../services/api';

const NotificationBell = () => {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadNotifications = async () => {
            try {
                const res = await api.get('/notifications');
                if (isMounted) {
                    setNotifications(res.data);
                }
            } catch (err) {
                console.error('Error fetching notifications:', err);
            }
        };

        void loadNotifications();
        
        // Poll every 60 seconds
        const interval = setInterval(loadNotifications, 60000);
        
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const markAsRead = async (id) => {
        try {
            await api.get(`/notifications/mark-read/${id}`);
            setNotifications(prev => prev.filter(n => n._id !== id));
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const hasUnread = notifications.length > 0;

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-sky-600 transition-colors bg-white rounded-full shadow-sm border border-slate-100"
            >
                <Bell className="w-6 h-6" />
                {hasUnread && (
                    <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] overflow-hidden transform origin-top-right transition-all">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                        <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-black uppercase">
                            {notifications.length} New
                        </span>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No new alerts</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {notifications.map(notification => (
                                    <div key={notification._id} className="p-4 hover:bg-slate-50 transition-colors relative group">
                                        <p className="text-xs text-slate-700 leading-relaxed pr-6">
                                            {notification.message}
                                        </p>
                                        <span className="text-[10px] text-slate-400 mt-2 block">
                                            {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <button 
                                            onClick={() => markAsRead(notification._id)}
                                            className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
                                            title="Mark as read"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
