import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Edit2 } from 'lucide-react';

import './AdminDashboard.css';


const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const { user, token, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
            return;
        }

        if (user && user.role !== 'admin') {
            toast.error('Access denied. Admin only.');
            navigate('/');
            return;
        }

        const fetchUsers = async () => {
            try {
                const config = { headers: { 'Authorization': `Bearer ${token}` } };
                const res = await axios.get('/api/admin/users', config);
                setUsers(res.data);
            } catch (err) {
                toast.error('Error fetching users');
                console.error(err);
            }
        };

        if (token) {
            fetchUsers();
        }
    }, [user, token, navigate, loading]);

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            await axios.delete(`/api/admin/users/${userId}`, config);
            setUsers(users.filter(u => u._id !== userId));
            toast.success('User deleted successfully');
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Error deleting user');
        }
    };

    const [editingUserId, setEditingUserId] = useState(null);
    const [newQuota, setNewQuota] = useState('');

    const handleEditQuota = (user) => {
        setEditingUserId(user._id);
        const currentQuotaMB = user.storageQuota ? Math.round(user.storageQuota / (1024 * 1024)) : 1000;
        setNewQuota(currentQuotaMB);
    };

    const handleSaveQuota = async (userId) => {
        try {
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            const res = await axios.patch(`/api/admin/users/${userId}/quota`, { quotaInMB: newQuota }, config);

            setUsers(users.map(u => u._id === userId ? res.data : u));
            setEditingUserId(null);
            toast.success('Quota updated successfully');
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Error updating quota');
        }
    };

    const [activeTab, setActiveTab] = useState('users');
    const [config, setConfig] = useState({
        defaultStorageQuotaMB: 1000,
        maxFileSizeMB: 950,
        allowRegistration: true,
        isMaxFileSizeLinked: true
    });

    useEffect(() => {
        if (token) {
            const fetchConfig = async () => {
                try {
                    const configRes = { headers: { 'Authorization': `Bearer ${token}` } };
                    const res = await axios.get('/api/admin/config', configRes);
                    setConfig({
                        defaultStorageQuotaMB: Math.round(res.data.defaultStorageQuota / (1024 * 1024)),
                        maxFileSizeMB: Math.round(res.data.maxFileSize / (1024 * 1024)),
                        allowRegistration: res.data.allowRegistration,
                        isMaxFileSizeLinked: res.data.isMaxFileSizeLinked !== undefined ? res.data.isMaxFileSizeLinked : true
                    });
                } catch (err) {
                    console.error(err);
                    // Don't toast error here as it might be expected if config doesn't exist yet
                }
            };
            fetchConfig();
        }
    }, [token]);

    const handleConfigChange = (field, value) => {
        let newConfig = { ...config, [field]: value };

        if (field === 'defaultStorageQuotaMB') {
            const quota = parseInt(value) || 0;
            if (newConfig.isMaxFileSizeLinked) {
                newConfig.maxFileSizeMB = Math.floor(quota * 0.95);
            }
        }

        if (field === 'isMaxFileSizeLinked') {
            if (value === true) {
                const quota = parseInt(newConfig.defaultStorageQuotaMB) || 0;
                newConfig.maxFileSizeMB = Math.floor(quota * 0.95);
            }
        }

        setConfig(newConfig);
    };

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        try {
            const configRes = { headers: { 'Authorization': `Bearer ${token}` } };
            await axios.put('/api/admin/config', config, configRes);
            toast.success('System configuration updated!');
        } catch (err) {
            console.error(err);
            toast.error('Error updating config');
        }
    };

    const { logout } = useAuth();

    const handleFactoryReset = async () => {
        if (!window.confirm('WARNING: This will delete ALL users, files, and configurations. The system will be reset to a clean state. This action is IRREVERSIBLE. Are you sure?')) {
            return;
        }

        if (!window.confirm('Double Check: Are you absolutely sure you want to wipe the entire database?')) {
            return;
        }

        try {
            const configRes = { headers: { 'Authorization': `Bearer ${token}` } };
            await axios.post('/api/admin/reset', {}, configRes);
            toast.success('System reset successfully. Redirecting...');
            setTimeout(() => {
                logout();
                navigate('/admin/setup');
            }, 2000);
        } catch (err) {
            console.error(err);
            toast.error('Error resetting system');
        }
    };

    return (
        <div className="dashboard-container">
            <h2>Admin Dashboard</h2>

            <div className="dashboard-tabs">
                <button
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    Users
                </button>
                <button
                    className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    System Settings
                </button>
            </div>

            {activeTab === 'users' ? (
                <div className="users-list">
                    <h3>Registered Users ({users.length})</h3>
                    {users.length === 0 ? (
                        <p>No users found.</p>
                    ) : (
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Storage Used</th>
                                    <th>Quota (MB)</th>
                                    <th>Joined</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user._id}>
                                        <td>{user.username}</td>
                                        <td>{user.role}</td>
                                        <td>
                                            {user.role === 'admin' ? 'N/A' : formatBytes(user.storageUsed)}
                                        </td>
                                        <td>
                                            {user.role === 'admin' ? 'N/A' : (
                                                editingUserId === user._id ? (
                                                    <div className="quota-edit-container">
                                                        <input
                                                            type="number"
                                                            value={newQuota}
                                                            onChange={(e) => setNewQuota(e.target.value)}
                                                            className="quota-input"
                                                        />
                                                        <button onClick={() => handleSaveQuota(user._id)} className="btn-primary btn-small">Save</button>
                                                        <button onClick={() => setEditingUserId(null)} className="btn-secondary btn-small">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <div className="quota-display-container">
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span>{user.storageQuota ? Math.round(user.storageQuota / (1024 * 1024)) : config.defaultStorageQuotaMB} MB</span>
                                                            <small className="quota-type-label">{user.storageQuota ? '(Custom)' : '(Default)'}</small>
                                                        </div>
                                                        <button onClick={() => handleEditQuota(user)} className="edit-quota-btn"><Edit2 size={18} /></button>
                                                    </div>
                                                )
                                            )}
                                        </td>
                                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            {user.role !== 'admin' && (
                                                <button
                                                    onClick={() => handleDeleteUser(user._id)}
                                                    className="delete-user-btn"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                <div className="settings-container">
                    <h3>Global Configuration</h3>
                    <form onSubmit={handleSaveConfig} className="settings-form">
                        <div className="form-group">
                            <label>Default User Storage Quota (MB):</label>
                            <input
                                type="number"
                                value={config.defaultStorageQuotaMB}
                                onChange={(e) => handleConfigChange('defaultStorageQuotaMB', e.target.value)}
                                required
                            />
                            <small>New users and users without a custom quota will use this limit.</small>
                        </div>
                        <div className="form-group checkbox-group" style={{ marginBottom: '15px' }}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={config.isMaxFileSizeLinked}
                                    onChange={(e) => handleConfigChange('isMaxFileSizeLinked', e.target.checked)}
                                />
                                Link Max File Size to Quota (95%)
                            </label>
                        </div>
                        <div className="form-group">
                            <label>Max Single File Size (MB):</label>
                            <input
                                type="number"
                                value={config.maxFileSizeMB}
                                onChange={(e) => handleConfigChange('maxFileSizeMB', e.target.value)}
                                required
                                disabled={config.isMaxFileSizeLinked}
                            />
                            <small>Maximum size allowed for a single file upload.</small>
                        </div>
                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={config.allowRegistration}
                                    onChange={(e) => setConfig({ ...config, allowRegistration: e.target.checked })}
                                />
                                Allow New User Registrations
                            </label>
                        </div>
                        <button type="submit" className="btn-primary">Save Settings</button>
                    </form>

                    <div className="danger-zone">
                        <h3>Danger Zone</h3>
                        <p>Irreversible actions. Proceed with caution.</p>
                        <button onClick={handleFactoryReset} className="btn-danger">Factory Reset System</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
