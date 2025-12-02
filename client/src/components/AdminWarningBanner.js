import React from 'react';
import { useLocation, Link } from 'react-router-dom';

const AdminWarningBanner = ({ adminExists }) => {
    const location = useLocation();

    if (adminExists) return null;
    if (location.pathname === '/admin/setup') return null;

    return (
        <div className="admin-warning-banner">
            <strong>Warning:</strong> No administrator account found. <Link to="/admin/setup">Click here to setup Admin</Link>
        </div>
    );
};

export default AdminWarningBanner;
