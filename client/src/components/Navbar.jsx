import React, { useState } from 'react';
import apelLogo from '../assets/APEL_Logo.jpeg';
function Navbar({ user, activeTab, setActiveTab, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'consumables', label: 'Consumables Order List' },
    { id: 'equipments', label: 'Equipment Inventory Directory' },
    ...(user?.role === 'Professor' ? [{ id: 'scholars', label: 'Add Scholars' }] : [])
  ];

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    setIsOpen(false); 
  };

  return (
    <nav className="bg-[#111E43] border-b border-slate-800/80 px-4 sm:px-6 py-3.5 shadow-lg sticky top-0 z-50 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* LOGO */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group" 
        >
          <span className="text-xl group-hover:scale-110 transition-transform duration-200">
            <img src={apelLogo} alt="Logo" className="h-8 w-auto object-contain" />
          </span>
          <span className="text-sm font-bold text-white tracking-widest uppercase bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            LabPortal
          </span>
        </div>

        {/* DESKTOP WORKSPACE NAVIGATION (Hidden on Mobile) */}
        <div className="hidden lg:flex items-center gap-1.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                activeTab === 'item.id' || activeTab === item.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 font-bold border border-blue-500/30' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* DESKTOP AUTH CONTEXT PROFILE (Hidden on Mobile) */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-100">{user?.name || 'Authorized Session'}</p>
            <p className="text-[10px] text-blue-400 font-mono mt-0.5 uppercase tracking-wider font-semibold">
              {user?.role}
            </p>
          </div>

          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-red-950/40 border border-slate-700 hover:border-red-900/40 text-slate-300 hover:text-red-400 text-xs font-medium rounded-lg transition-all duration-200 shadow-sm"
          >
            Sign Out
          </button>
        </div>

        {/* MOBILE HAMBURGER TOGGLE BUTTON (Hidden on Desktop) */}
        <div className="flex lg:hidden items-center">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {isOpen ? (
              // Close symbol icon (X)
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Open menu symbol icon (☰)
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* MOBILE INTERACTIVE DROPDOWN DRAWER PANEL */}
      {isOpen && (
        <div className="lg:hidden absolute top-[100%] left-0 w-full bg-[#0d1735] border-b border-slate-800 shadow-2xl p-4 animate-fadeIn">
          {/* Menu Link Paths */}
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white font-bold shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="my-3 border-t border-slate-800/60"></div>

          {/* User Session Profile & Sign-out Context */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div>
              <p className="text-xs font-bold text-slate-200">{user?.name}</p>
              <p className="text-[10px] text-blue-400 font-mono tracking-wider uppercase mt-0.5">
                {user?.role}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="px-3.5 py-2 bg-red-950/30 border border-red-900/40 text-red-400 hover:bg-red-900 hover:text-white text-xs font-bold rounded-xl transition-all"
            >
              Sign Out 🚪
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;