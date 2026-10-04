/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // On mount, try to restore session from a real stored token
        const token = localStorage.getItem('token');
        if (token) {
            // Validate token with backend and restore user
            api.get('/auth/me')
                .then(res => {
                    setUser(res.data);
                })
                .catch(() => {
                    // Token is invalid or expired — clear it
                    localStorage.removeItem('token');
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (credentials) => {
        const res = await api.post('/auth/login', credentials);
        localStorage.setItem('token', res.data.token);
        setUser(res.data.user);
        return res.data;
    };

    const logout = async () => {
        try {
            // Stamp lastActive in MongoDB before removing the token
            await api.post('/auth/logout');
        } catch {
            // Silent — token may already be expired
        } finally {
            localStorage.removeItem('token');
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, setUser }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
