import React, { useState } from 'react';
import { API_BASE_URL } from '../config';
function ManageScholars() {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  const [scholarName, setScholarName] = useState('');
  const [scholarEmail, setScholarEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleAddScholar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const token = localStorage.getItem('labPortalToken');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/add-scholar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scholarName, scholarEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Successfully registered ${scholarName}! They can now log in using OTP.` });
        setScholarName('');
        setScholarEmail('');
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to register scholar.' });
      }
    } catch (err) {
      if (error.response && error.response.status === 401) {
        sessionStorage.clear();
        window.location.reload();
      } else {

        setMessage({ type: 'error', text: 'An error has been occured.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">

      {/* INFO CARD */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-5">
        <h4 className="text-emerald-400 font-bold text-sm flex items-center gap-2">
          <span>👥</span> Whitelist Authorization Control
        </h4>
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          Adding a scholar here appends their profile into the Google Sheets user database registry. Once added, the scholar is authorized to request instant 6-digit verification codes to access the portal.
        </p>
      </div>

      {/* REGISTRATION FORM */}
      <div className="bg-[#111E43] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6">Register New Lab Scholar</h3>

        {message.text && (
          <div className={`p-4 rounded-xl text-xs font-medium mb-6 border ${message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
            {message.type === 'success' ? '✅ ' : '⚠️ '} {message.text}
          </div>
        )}

        <form onSubmit={handleAddScholar} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={scholarName}
                onChange={(e) => setScholarName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Institutional Email Address
              </label>
              <input
                type="email"
                required
                value={scholarEmail}
                onChange={(e) => setScholarEmail(e.target.value)}
                placeholder="rahul.s@university.edu"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 font-semibold text-white text-sm rounded-xl transition-all shadow-lg shadow-blue-600/10"
            >
              {loading ? 'Adding to Google Sheet...' : 'Authorize Scholar Profile'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}

export default ManageScholars;