import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, UploadCloud } from 'lucide-react';
import './FileUpload.css';

const FileUpload = () => {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [downloadLink, setDownloadLink] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [expiration, setExpiration] = useState('permanent');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [oneTimeDownload, setOneTimeDownload] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [userQuotaMB, setUserQuotaMB] = useState(null);
    const [storageUsedMB, setStorageUsedMB] = useState(0);
    const [effectiveMaxFileSizeMB, setEffectiveMaxFileSizeMB] = useState(5);

    useEffect(() => {
        if (user && user.role === 'admin') {
            navigate('/admin/dashboard');
        }
    }, [user, navigate]);

    useEffect(() => {
        if (user) {
            setStorageUsedMB(user.storageUsed ? Math.round(user.storageUsed / (1024 * 1024)) : 0);
            // Fetch config to determine effective limits
        }
    }, [user]);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await axios.get('/api/config');
                const systemMaxMB = parseInt(res.data.maxFileSizeMB);

                if (user) {
                    const defaultQuota = parseInt(res.data.defaultStorageQuotaMB);
                    const myQuota = user.storageQuota ? Math.round(user.storageQuota / (1024 * 1024)) : defaultQuota;
                    setUserQuotaMB(myQuota);

                    // Calculate effective max file size: min(systemMax, remainingQuota)
                    // This ensures users cannot upload files larger than their remaining storage or the system limit.

                    const effectiveMax = Math.min(systemMaxMB, myQuota);
                    setEffectiveMaxFileSizeMB(effectiveMax);
                } else {
                    // For guests, just show the system max file size
                    setEffectiveMaxFileSizeMB(systemMaxMB);
                }
            } catch (err) {
                console.error("Could not fetch server config", err);
            }
        };
        fetchConfig();
    }, [user]);

    /**
     * Handles file selection from input or drop.
     * Validates file size against the effective maximum limit.
     */
    const handleFileChange = (selectedFile) => {
        if (selectedFile) {
            const MAX_SIZE_BYTES = effectiveMaxFileSizeMB * 1024 * 1024;

            if (selectedFile.size > MAX_SIZE_BYTES) {
                setMessage(`File is too large. Maximum size is ${effectiveMaxFileSizeMB}MB.`);
                setFile(null);
                return;
            }
            setFile(selectedFile);
            setDownloadLink('');
            setMessage(`Selected file: ${selectedFile.name}`);
            setUploadProgress(0);
        }
    };

    const handleDragEvents = (e, dragging) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(dragging);
    };

    const handleDrop = (e) => {
        handleDragEvents(e, false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileChange(droppedFile);
        }
    };

    /**
     * Submits the file to the server.
     * Appends file and metadata (expiration, password, etc.) to FormData.
     * Tracks upload progress and updates state.
     */
    const onFileUpload = async () => {
        if (!token) {
            setMessage('You must be logged in to upload a file.');
            return;
        }
        if (!file) {
            setMessage('No file selected!');
            return;
        }
        if (password && password !== confirmPassword) {
            setMessage('Passwords do not match!');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('expiration', expiration);
        formData.append('oneTimeDownload', oneTimeDownload);
        if (password) formData.append('password', password);

        try {
            setMessage('Uploading...');
            setUploadProgress(0);

            const res = await axios.post('/api/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });

            setMessage('Upload successful!');
            setTimeout(() => setUploadProgress(0), 1500);

            const link = `${window.location.origin}/download/${res.data.uuid}`;
            setDownloadLink(link);
            setFile(null);

        } catch (err) {
            console.error(err);
            setUploadProgress(0);
            if (err.response && err.response.status === 401) {
                setMessage('Your session has expired. Please log in again.');
            } else if (err.response && err.response.data && err.response.data.msg) {
                setMessage(err.response.data.msg);
            } else {
                setMessage('Upload failed. Please try again.');
            }
        }
    };

    const copyToClipboard = () => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(downloadLink)
                .then(() => toast.success('Link copied to clipboard!'))
                .catch(err => toast.error('Could not copy text.'));
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = downloadLink;
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

    return (
        <div className="upload-container">
            <label
                htmlFor="file-upload"
                className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => handleDragEvents(e, true)}
                onDragLeave={(e) => handleDragEvents(e, false)}
                onDrop={handleDrop}
            >
                <UploadCloud size={60} className="drop-zone-icon" />
                <p>Drag & Drop your file here or click to select</p>
                <input
                    id="file-upload"
                    type="file"
                    onChange={(e) => handleFileChange(e.target.files[0])}
                    style={{ display: 'none' }}
                />
                {user && (
                    <p className="max-size-text">
                        Effective Max File Size: {effectiveMaxFileSizeMB} MB
                    </p>
                )}
                {user && userQuotaMB !== null && (
                    <p className="quota-text">
                        Storage: {storageUsedMB} MB / {userQuotaMB} MB Used
                    </p>
                )}
            </label>

            <div className="options-container">
                <label htmlFor="expiration" className="option-label">Delete after:</label>
                <select
                    id="expiration"
                    value={expiration}
                    onChange={e => setExpiration(e.target.value)}
                    className="expiration-select"
                >
                    <option value="permanent">Disabled (Never delete)</option>
                    <option value="1m">1 Minute</option>
                    <option value="1h">1 Hour</option>
                    <option value="1d">24 Hours</option>
                    <option value="7d">7 Days</option>
                </select>
            </div>

            <div className="options-container password-container">
                <div className="password-field-group">
                    <label htmlFor="password" className="option-label">Password (Optional):</label>
                    <div className="password-input-wrapper">
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="password-input"
                            placeholder="Secret..."
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
                {password && (
                    <div className="password-field-group">
                        <label htmlFor="confirmPassword" className="option-label">Confirm:</label>
                        <input
                            id="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="password-input"
                            placeholder="Confirm..."
                        />
                    </div>
                )}
            </div>

            <div className="options-container" style={{ justifyContent: 'flex-start' }}>
                <input
                    type="checkbox"
                    id="oneTimeDownload"
                    checked={oneTimeDownload}
                    onChange={e => setOneTimeDownload(e.target.checked)}
                    className="checkbox-input"
                />
                <label htmlFor="oneTimeDownload" className="option-label view-once-label">
                    <EyeOff size={18} /> View Once (Single Download)
                </label>
            </div>

            <div className={`progress-bar-container ${uploadProgress > 0 ? 'visible' : ''}`}>
                <div className="progress-bar" style={{ width: `${uploadProgress}%` }}>
                    {uploadProgress}%
                </div>
            </div>

            {file && !downloadLink && <button className="btn-primary" onClick={onFileUpload}>Upload!</button>}

            <p className="message">{message}</p>

            {downloadLink && (
                <div className="link-container">
                    <input type="text" value={downloadLink} readOnly />
                    <button className="btn-primary" onClick={copyToClipboard}>Copy Link</button>
                </div>
            )}
        </div>
    );
};

export default FileUpload;