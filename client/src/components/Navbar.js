// src/components/Navbar.js
import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, User, LogOut, ChevronDown } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Close dropdown on route change
    useEffect(() => {
        setIsDropdownOpen(false);
    }, [location]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-brand" style={{ display: 'flex', alignItems: 'center', padding: '4px' }}>
                <img src="/logo.svg" alt="BytePorter" style={{ height: '32px', width: '32px' }} />
            </Link>
            {(!user || user.role !== 'admin') && (
                <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Upload</Link>
            )}
            {token ? (
                <>
                    {user && user.role === 'admin' ? (
                        <Link to="/admin/dashboard" className={location.pathname === '/admin/dashboard' ? 'active' : ''}>Admin Dashboard</Link>
                    ) : (
                        <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
                    )}

                    <div className="navbar-user-menu" ref={dropdownRef}>
                        <button
                            className="user-menu-btn"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <User size={18} />
                            <span className="username">{user?.username}</span>
                            <ChevronDown size={14} />
                        </button>

                        {isDropdownOpen && (
                            <div className="dropdown-menu">
                                <button onClick={handleLogout} className="dropdown-item">
                                    <LogOut size={16} />
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="auth-links">
                    <Link to="/login" className={location.pathname === '/login' ? 'active' : ''}>Login</Link>
                    <Link to="/register" className={location.pathname === '/register' ? 'active' : ''}>Register</Link>
                </div>
            )}
            <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
        </nav>
    );
};

export default Navbar;