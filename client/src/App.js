import React from 'react';
import { FolderUp } from 'lucide-react';
import axios from 'axios';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import FileUpload from './components/FileUpload';
import DownloadPage from './components/DownloadPage';
import Navbar from './components/Navbar';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminSetup from './pages/AdminSetup';
import AdminDashboard from './pages/AdminDashboard';
import AdminWarningBanner from './components/AdminWarningBanner';
import AdminRedirect from './components/AdminRedirect';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  const [adminExists, setAdminExists] = React.useState(true);

  React.useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await axios.get('/api/admin/check');
        setAdminExists(res.data.exists);
      } catch (err) {
        console.error(err);
      }
    };
    checkAdmin();
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <div className="App">
          <Toaster
            position="top-center"
            toastOptions={{
              className: 'glass-toast',
              style: {
                padding: '16px',
                color: 'var(--md-sys-color-on-surface)',
              },
            }}
          />
          <Navbar />
          <AdminRedirect adminExists={adminExists} />
          <AdminWarningBanner adminExists={adminExists} />
          <header className="App-header">
            <h1>BytePorter <FolderUp size={32} className="header-icon" /></h1>
            <p>Simple, Fast, and Secure File Sharing</p>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<FileUpload />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/download/:uuid" element={<DownloadPage />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin/setup" element={<AdminSetup onAdminCreated={() => setAdminExists(true)} />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;