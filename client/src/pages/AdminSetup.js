import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import './AdminSetup.css';

const AdminSetup = ({ onAdminCreated }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '' // Added confirmPassword to formData for consistency
    });
    const [showPassword, setShowPassword] = useState(false);

    const { username, password, confirmPassword } = formData;
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        // Double check if admin already exists
        const checkAdmin = async () => {
            try {
                const res = await axios.get('/api/admin/check');
                if (res.data.exists) {
                    navigate('/');
                }
            } catch (err) {
                console.error(err);
            }
        };
        checkAdmin();
    }, [navigate]);

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        try {
            await axios.post('/api/admin/setup', { username, password });
            await login();
            if (onAdminCreated) onAdminCreated();
            toast.success('Admin account created successfully!');
            navigate('/admin/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Error creating admin account');
        }
    };

    return (
        <div className="auth-container">
            <h2>Admin Setup</h2>
            <p>Create the administrator account.</p>
            <form className="auth-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="username">Admin Username</label>
                    <input
                        type="text"
                        name="username"
                        value={username}
                        onChange={onChange}
                        required
                        placeholder="Choose an admin username"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <div className="password-input-wrapper">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={password}
                            onChange={onChange}
                            required
                            placeholder="Create a strong password"
                            minLength="6"
                            className="password-input"
                        />
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <div className="password-input-wrapper">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={confirmPassword}
                            onChange={onChange}
                            required
                            placeholder="Confirm your password"
                            minLength="6"
                            className="password-input"
                        />
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <button type="submit" className="btn-primary">Create Admin Account</button>
            </form>
        </div>
    );
};

export default AdminSetup;
