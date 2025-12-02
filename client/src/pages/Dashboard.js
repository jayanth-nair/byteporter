import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import './Dashboard.css';

const Dashboard = () => {
    const { user, token, refetchUser, loading } = useAuth(); // Get refetchUser from context
    const [files, setFiles] = useState([]);
    const [filesLoading, setFilesLoading] = useState(true);
    const [, setNow] = useState(new Date());
    const [storageQuotaMB, setStorageQuotaMB] = useState(100);

    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        } else if (user && user.role === 'admin') {
            navigate('/admin/dashboard');
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!token) {
                setFilesLoading(false);
                return;
            }
            try {
                setFilesLoading(true);
                const config = { headers: { 'Authorization': `Bearer ${token}` } };

                const [filesRes, configRes] = await Promise.all([
                    axios.get('/api/files/my-files', config),
                    axios.get('/api/config')
                ]);

                setFiles(filesRes.data);

                const defaultQuota = parseInt(configRes.data.defaultStorageQuotaMB);
                // If user has a custom quota, use it. Otherwise use system default.
                // Note: user object might be stale in closure, but we have it from useAuth
                // However, useAuth user might not be updated immediately if we just logged in? 
                // Actually, let's rely on the user object from context which is in dependency array of other useEffect
                // But here we are inside fetchData.

                // Better approach: Calculate quota in render or set it here based on current user context
                // We can't easily access the latest 'user' inside this async callback if it changes, 
                // but 'user' is in the dependency array of the useEffect? No, 'token' is.
                // Let's add 'user' to dependency array or just use the logic in render.

                // Actually, let's just set the default here, and override in render if user has custom.
                // OR set the state correctly here if we trust 'user' from outer scope.

                // Let's just store the system default in state, and calculate effective quota in render.
                setStorageQuotaMB(defaultQuota);
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setFilesLoading(false);
            }
        };

        fetchData();
    }, [token]);

    const copyToClipboard = (uuid) => {
        const link = `${window.location.origin}/download/${uuid}`;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(link)
                .then(() => toast.success('Link copied to clipboard!'))
                .catch(() => toast.error('Could not copy text.'));
        } else {
            // Fallback for non-secure contexts (HTTP)
            const textArea = document.createElement("textarea");
            textArea.value = link;
            textArea.style.position = "absolute";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                toast.success('Link copied to clipboard!');
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
                toast.error('Could not copy text.');
            }
            document.body.removeChild(textArea);
        }
    };

    const handleDelete = async (uuid) => {
        if (!window.confirm('Are you sure you want to permanently delete this file?')) {
            return;
        }

        try {
            const config = { headers: { 'Authorization': `Bearer ${token}` } };

            await axios.delete(`/api/files/${uuid}`, config);

            toast.success('File deleted successfully.');

            setFiles(files.filter(file => file.uuid !== uuid));
            refetchUser();

        } catch (err) {
            console.error('Error deleting file:', err);
            toast.error('Could not delete the file.');
        }
    };

    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const effectiveQuotaMB = user && user.storageQuota
        ? Math.round(user.storageQuota / (1024 * 1024))
        : storageQuotaMB;

    const storagePercentage = user ? (user.storageUsed / (effectiveQuotaMB * 1024 * 1024)) * 100 : 0;

    if (filesLoading) return <p>Loading dashboard...</p>;

    return (
        <div className="dashboard-container">
            {user && (
                <div className="storage-info">
                    <h3>Storage Usage</h3>
                    <div className="storage-bar-background">
                        <div className="storage-bar-foreground" style={{ width: `${storagePercentage}%` }}></div>
                    </div>
                    <p>{formatBytes(user.storageUsed)} of {effectiveQuotaMB}MB used</p>
                </div>
            )}

            <h2>Your Uploads</h2>
            {files.length === 0 && !filesLoading ? (
                <p>You haven't uploaded any files yet.</p>
            ) : (
                <ul className="file-list">
                    {files.map(file => (
                        <li key={file.uuid} className="file-item">
                            <div className="file-details">
                                <p className="file-name">{file.originalName}</p>
                                <p className="file-meta">
                                    {formatBytes(file.size)} &bull;
                                    {file.expiresAt
                                        ? ` Expires ${formatDistanceToNow(new Date(file.expiresAt), { addSuffix: true })}`
                                        : ' No expiration set'
                                    }
                                </p>
                            </div>
                            <div className="file-actions">
                                <button className="btn-primary" onClick={() => copyToClipboard(file.uuid)}>Copy Link</button>
                                <button className="delete-btn" onClick={() => handleDelete(file.uuid)}>Delete</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default Dashboard;