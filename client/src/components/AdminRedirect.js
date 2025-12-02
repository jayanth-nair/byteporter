import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AdminRedirect = ({ adminExists }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const hasRedirected = useRef(false);

    useEffect(() => {
        // Check if we have already redirected in this session
        const sessionRedirected = sessionStorage.getItem('admin_setup_redirected');

        // Only redirect if:
        // 1. Admin does not exist
        // 2. We are at the root path '/'
        // 3. We haven't redirected yet (in this session)
        if (adminExists === false && location.pathname === '/' && !sessionRedirected) {
            sessionStorage.setItem('admin_setup_redirected', 'true');
            hasRedirected.current = true;
            navigate('/admin/setup');
        }
    }, [adminExists, navigate, location]);

    return null;
};

export default AdminRedirect;
