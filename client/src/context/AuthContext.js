// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = React.useCallback(async () => {
        try {
            const res = await axios.get('/api/users/me');
            setUser(res.data);
        } catch (err) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const login = async () => {
        await fetchUser();
    };

    const logout = async () => {
        try {
            await axios.post('/api/users/logout');
        } catch (err) {
            console.error('Logout failed', err);
        } finally {
            setUser(null);
        }
    };

    const refetchUser = async () => {
        await fetchUser();
    };

    const value = {
        user,
        loading,
        login,
        logout,
        refetchUser,
        token: !!user // Derived from user state for compatibility
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};