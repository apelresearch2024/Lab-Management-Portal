import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Consumables from './components/Consumable';
import ManageScholars from './components/ManageScholars';
import Navbar from './components/Navbar';
import Equipments from './components/Equipments';
import Stocks from './components/Stocks';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ScrollToTop from './components/ScrollToTop';
function App() {
  const [user, setUser] = useState(null);

  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = sessionStorage.getItem('labPortal_main_activeTab');
    const validTabs = ['consumables', 'scholars', 'equipments'];
    return validTabs.includes(savedTab) ? savedTab : 'consumables';
  });

  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('labPortalToken');

    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );

        const userData = JSON.parse(jsonPayload);

        if (userData.exp * 1000 > Date.now()) {
          setUser(userData);
        } else {
          localStorage.removeItem('labPortalToken');
        }
      } catch (error) {
        console.error('Stale or malformed token corrupted:', error);
        localStorage.removeItem('labPortalToken');
      }
    }
    setLoadingSession(false);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('labPortal_main_activeTab', activeTab);
  }, [activeTab]);
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [activeTab]);
  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('labPortalToken');
    sessionStorage.removeItem('labPortal_main_activeTab');
    setUser(null);
    setActiveTab('consumables');
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex items-center justify-center text-slate-400 font-mono text-xs">
        Verifying active cryptographic token string...
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#0B132B] text-slate-100 font-sans flex flex-col">

      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="flex-1 p-4 sm:p-6 md:p-10 bg-[#0B132B]">
        <header className="mb-6">
          <h2 className="text-2xl font-bold text-white capitalize">
            {activeTab === 'scholars' ? 'Scholar Access Management' : `${activeTab} Management`}
          </h2>
          <p className="text-sm text-slate-400 mt-1">Authorized Profile: {user.name} ({user.role})</p>
        </header>

        {activeTab === 'consumables' && <Consumables user={user} />}
        {activeTab === 'scholars' && user.role === 'Professor' && <ManageScholars />}
        {activeTab === 'equipments' && <Equipments user={user} />}

        <ToastContainer
          position="top-center"
          autoClose={3500}
          hideProgressBar={true}
          newestOnTop={true}
          closeOnClick={false}
          rtl={false}
          pauseOnFocusLoss
          draggable={false}
          pauseOnHover
          theme="light"
        />
      </main>
      <ScrollToTop />
    </div>
  );
}

export default App;