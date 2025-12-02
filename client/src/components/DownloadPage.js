import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import './DownloadPage.css';

const DownloadPage = () => {
    const { uuid } = useParams();
    const [fileInfo, setFileInfo] = useState(null);
    const [error, setError] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const fetchFileInfo = async () => {
            try {
                const response = await axios.get(`/api/files/${uuid}`);
                setFileInfo(response.data);
            } catch (err) {
                if (err.response && err.response.data && err.response.data.msg) {
                    setError(err.response.data.msg);
                } else {
                    setError('Could not find the file. The link may have expired.');
                }
                console.error(err);
            }
        };

        fetchFileInfo();
    }, [uuid]);

    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const handleDownload = async () => {
        try {
            const response = await axios.post(`/api/files/download/${uuid}`, {
                password: password
            }, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileInfo.name);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            if (err.response && err.response.data && err.response.data.msg) {
                setError(err.response.data.msg);
            } else if (err.response && err.response.status === 401) {
                setError('Incorrect password.');
            } else {
                setError('Download failed. Please try again.');
            }
        }
    };

    const [previewContent, setPreviewContent] = useState(null);
    const [previewType, setPreviewType] = useState(null);

    useEffect(() => {
        return () => {
            if (previewContent && previewType === 'image') {
                window.URL.revokeObjectURL(previewContent);
            }
        };
    }, [previewContent, previewType]);

    const handlePreview = async () => {
        try {
            const response = await axios.post(`/api/files/preview/${uuid}`, {
                password: password
            }, {
                responseType: 'blob'
            });

            const contentType = response.headers['content-type'];

            if (contentType.startsWith('image/')) {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                setPreviewType('image');
                setPreviewContent(url);
            } else if (contentType.startsWith('text/') || contentType === 'application/json' || contentType === 'application/javascript') {
                setPreviewType('text');
                const text = await response.data.text();
                setPreviewContent(text);
            }
        } catch (err) {
            console.error(err);
            if (err.response && err.response.data && err.response.data.msg) {
                setError(err.response.data.msg);
            } else if (err.response && err.response.status === 401) {
                setError('Incorrect password for preview.');
            } else if (err.response && err.response.status === 403) {
                setError('Preview disabled for one-time downloads.');
            } else {
                setError('Preview failed.');
            }
        }
    };

    const isPreviewable = fileInfo && !fileInfo.oneTimeDownload && (
        fileInfo.name.match(/\.(jpg|jpeg|png|gif|webp|txt|md|json|js|css|html)$/i)
    );

    return (
        <div className="download-container">
            {error && <p style={{ color: '#e94560' }}>{error}</p>}
            {fileInfo && (
                <div>
                    <h2>File Ready for Download</h2>
                    <p><strong>Filename:</strong> {fileInfo.name}</p>
                    <p><strong>Size:</strong> {formatBytes(fileInfo.size)}</p>

                    {fileInfo.oneTimeDownload && (
                        <div className="warning-box">
                            <AlertTriangle size={24} />
                            <p style={{ margin: 0 }}><strong>Warning:</strong> This file will be deleted immediately after you download it.</p>
                        </div>
                    )}

                    {fileInfo.hasPassword && (
                        <div className="password-section">
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
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
                    )}

                    <div className="action-buttons">
                        <button onClick={handleDownload} className="btn-primary">
                            Download File
                        </button>
                        {isPreviewable && (
                            <button onClick={handlePreview} className="btn-secondary">
                                Preview
                            </button>
                        )}
                    </div>

                    {previewContent && (
                        <div className="preview-container">
                            <h3>Preview</h3>
                            {previewType === 'image' ? (
                                <img src={previewContent} alt="Preview" className="preview-image" />
                            ) : (
                                <pre className="preview-text">
                                    <code>{previewContent}</code>
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DownloadPage;