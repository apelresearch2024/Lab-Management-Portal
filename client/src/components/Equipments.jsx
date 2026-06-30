import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config';
function Equipments({ user }) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  const [equipments, setEquipments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [viewTab, setViewTab] = useState(() => {
    const savedTab = sessionStorage.getItem('labPortal_equipments_viewTab');
    return (savedTab === 'registry' || savedTab === 'requests') ? savedTab : 'registry';
  });

  const [processingId, setProcessingId] = useState(null);
  const [eqPdf, setEqPdf] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [eqId, setEqId] = useState('');
  const [eqPartNo, setEqPartNo] = useState('');
  const [eqName, setEqName] = useState('');
  const [categoryTab, setCategoryTab] = useState('Major');
  const [eqCategory, setEqCategory] = useState('Major');
  const [submitting, setSubmitting] = useState(false);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [targetEquipment, setTargetEquipment] = useState(null);
  const [requestDuration, setRequestDuration] = useState('Short');
  const token = localStorage.getItem('labPortalToken');

  const checkAuthStatus = (response) => {
    if (response.status === 401) {
      toast.error("Your session has expired. Redirecting to login...");
      localStorage.removeItem('labPortalToken');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      return false;
    }
    return true;
  };

  const fetchInventoryAndRequests = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const eqRes = await fetch(`${API_BASE_URL}/api/equipments`, { headers });
      if (!checkAuthStatus(eqRes)) return;
      if (eqRes.ok) {
        const eqData = await eqRes.json();
        setEquipments(eqData);
      }

      const reqRes = await fetch(`${API_BASE_URL}/api/equipments/requests`, { headers });
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequests(reqData);
      }
    } catch (err) {
      toast.error('Network transmission error syncing asset tracking databases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryAndRequests();
  }, [token]);

  useEffect(() => {
    sessionStorage.setItem('labPortal_equipments_viewTab', viewTab);
  }, [viewTab]);

  const handleAddEquipment = async (e) => {
    e.preventDefault();
    if (!eqId.trim() || !eqName.trim()) {
      toast.warning('Equipment No and Product Description are required fields.');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('id', eqId);
      formData.append('partNo', eqPartNo);
      formData.append('name', eqName);
      formData.append('category', eqCategory);
      if (eqPdf) {
        formData.append('descriptionPdf', eqPdf);
      }
      const response = await fetch(`${API_BASE_URL}/api/equipments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        toast.success(`"${eqId}" successfully cataloged into registry!`);
        setEqId(''); setEqPartNo(''); setEqName(''), setEqPdf(null);;
        setShowModal(false);
        fetchInventoryAndRequests();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Registration rejected.');
      }
    } catch (err) {
      toast.error('Network fault during hardware registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!targetEquipment) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/equipments/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          equipmentId: targetEquipment.id,
          duration: requestDuration
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Workflow assignment request successfully filed!');
        setShowRequestModal(false);
        setTargetEquipment(null);
        fetchInventoryAndRequests();
      } else {
        toast.error(data.message || 'Request routing engine error.');
      }
    } catch (err) {
      toast.error('Network fault while transmitting transfer request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseAsset = async (itemId) => {
    setProcessingId(itemId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/equipments/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: itemId, status: 'Available' })
      });

      if (response.ok) {
        toast.success('Asset released back to public pool.');
        fetchInventoryAndRequests();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Status transition update rejected.');
      }
    } catch (err) {
      toast.error('Network transmission fault while releasing equipment.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleWorkflowAction = async (requestId, actionType) => {
    setProcessingId(requestId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/equipments/requests/${requestId}/action`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: actionType })
      });

      if (response.ok) {
        toast.success(`Workflow pipeline state updated successfully.`);
        fetchInventoryAndRequests();
      } else {
        const data = await response.json();
        toast.error(data.message || 'State validation change rejected by backend rules.');
      }
    } catch (err) {
      toast.error('Network communications error during validation shift.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveEquipment = (id) => {
    toast.warn(
      ({ closeToast }) => (
        <div className="p-1">
          <p className="text-[11px] font-bold text-slate-200 leading-relaxed mb-2.5">
            Are you sure you want to permanently delete <span className="text-red-400 font-mono font-black">Equipment No "{id}"</span> due to damage or decommissioning?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={closeToast}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                executeEquipmentRemoval(id);
                closeToast();
              }}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm shadow-red-950"
            >
              Confirm Delete ❌
            </button>
          </div>
        </div>
      ),
      {
        position: "top-center",
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        closeButton: false,
        theme: "dark"
      }
    );
  };

  const executeEquipmentRemoval = async (id) => {
    setProcessingId(id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/equipments/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success(`Equipment "${id}" removed permanently from registry.`);
        fetchInventoryAndRequests();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Removal request rejected.');
      }
    } catch (err) {
      toast.error('Network fault while transmitting removal request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    setProcessingId(id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/equipments/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id, status: newStatus })
      });

      if (response.ok) {
        toast.success(`Asset status updated to ${newStatus}.`);
        fetchInventoryAndRequests();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to alter asset operational status.');
      }
    } catch (err) {
      toast.error('Network fault while transmitting maintenance shift.');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredEquipments = equipments.filter(item => {
    const matchesSearch =
      (item.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.partNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.currentHolder || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = (item.category || 'Major') === categoryTab;

    return matchesSearch && matchesCategory;
  });

  const sortedEquipments = [...filteredEquipments].sort((a, b) => {
    if (a.currentHolder === user?.name && b.currentHolder !== user?.name) return -1;
    if (a.currentHolder !== user?.name && b.currentHolder === user?.name) return 1;
    return 0;
  });

  const pendingRequestsCount = requests.filter(req => {
    if (user?.role === 'Professor') return req.status === 'Pending Professor Approval';
    if (user?.role === 'Scholar') return req.status === 'Pending Holder Approval' && req.equipmentHolder === user?.name;
    return false;
  }).length;

  return (
    <div className="space-y-4 w-full max-w-7xl mx-auto">
      {/* NAVIGATION TABS MENU & UTILITY LAYER */}
      <div className="bg-[#111E43] border border-slate-800 rounded-xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="bg-slate-900/60 p-1 rounded-lg border border-slate-800/80 flex gap-1 w-full sm:w-auto">
          <button
            onClick={() => setViewTab('registry')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${viewTab === 'registry' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            📁 Equipment Registry
          </button>
          <button
            onClick={() => setViewTab('requests')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-2 ${viewTab === 'requests' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            <span>🔔 Requests Center</span>
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-red-500 text-white animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>

        {viewTab === 'registry' && (
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <input
              type="text"
              placeholder="🔍 Search equipments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 w-full max-w-xs focus:outline-none focus:border-blue-500"
            />
            {user?.role === 'Professor' && (
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-lg transition-all whitespace-nowrap"
              >
                ➕ Add Equipment
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-slate-400 font-mono">Syncing pipeline registries...</div>
      ) : viewTab === 'registry' ? (
        /* PANEL VIEW 1: CENTRAL INVENTORY REGISTRY GRID */
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setCategoryTab('Major')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${categoryTab === 'Major'
                ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-inner'
                : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-300'}`}
            >
              🛠️ Major Equipment
            </button>
            <button
              onClick={() => setCategoryTab('Minor')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${categoryTab === 'Minor'
                ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-inner'
                : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-300'}`}
            >
              🧰 Minor Equipment
            </button>
          </div>
          <div className="bg-[#111E43] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[1050px] table-fixed">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                    <th className="px-4 py-3.5 w-[12%]">Equipment No</th>
                    <th className="px-4 py-3.5 w-[12%]">Part No</th>
                    <th className="px-4 py-3.5 w-[28%]">Product Description</th>
                    <th className="px-4 py-3.5 w-[13%]">Status</th>
                    <th className="px-4 py-3.5 w-[15%]">Current Holder</th>
                    <th className="px-4 py-3.5 text-center w-[20%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-xs align-middle">
                  {sortedEquipments.map((item) => {
                    const isMyAsset = item.currentHolder === user?.name;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors duration-150 ${isMyAsset ? 'bg-blue-500/[0.03] hover:bg-blue-500/[0.07]' : 'hover:bg-slate-800/20'}`}
                      >
                        <td className="px-4 py-3.5 font-mono text-white font-semibold whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{item.id}</span>
                            {isMyAsset && <span className="text-blue-400 text-xs animate-bounce" title="Your assigned asset">📌</span>}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-slate-300 truncate">
                          {item.partNo || <span className="text-slate-600 italic font-sans">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-200 font-medium break-words pr-4">
                          <div className="flex flex-col gap-1">
                            <span>{item.name}</span>
                            {(item.pdfLink || item.webViewLink || item.pdfUrl || item.descriptionPdf) && (
                              <a
                                href={item.pdfLink || item.webViewLink || item.pdfUrl || item.descriptionPdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-lg text-[11px] font-bold tracking-wide transition-all duration-150 shadow-sm active:scale-95"
                              >
                                📄 View Equipment Manual
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-black border uppercase tracking-wider ${item.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            item.status === 'Reported Fault' ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' :
                              item.status === 'Maintenance' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                            {item.status === 'Maintenance' ? '🛠️ Maintenance' : item.status}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 font-semibold text-slate-300 truncate">
                          {item.status === 'Available' ? (
                            <span className="text-slate-500 font-normal italic">None (Pool)</span>
                          ) : (item.status === 'Maintenance' || item.status === 'Reported Fault') ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-slate-400 truncate">{item.currentHolder}</span>
                              <span className={`text-[9px] font-extrabold uppercase tracking-widest ${item.status === 'Reported Fault' ? 'text-red-400' : 'text-yellow-500'}`}>
                                ({item.status})
                              </span>
                            </div>
                          ) : (
                            <span className={isMyAsset ? "text-blue-400 font-bold" : ""}>
                              {item.currentHolder} {isMyAsset && '(You)'}
                            </span>
                          )}
                        </td>

                        {/* Dynamic Conditional Action Handling */}
                        <td className="px-4 py-3.5 text-center">
                          {user?.role === 'Scholar' ? (
                            <div className="w-full">
                              {isMyAsset ? (
                                (item.status === 'Maintenance' || item.status === 'Reported Fault') ? (
                                  <div className="flex py-1.5 items-center justify-center text-[10px] uppercase tracking-wider font-extrabold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-md w-full px-2 text-center">
                                    🛠️ {item.status === 'Reported Fault' ? 'Reviewing Fault' : 'Under Repair'}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-1.5 w-full">
                                    <button
                                      disabled={processingId !== null}
                                      onClick={() => handleUpdateStatus(item.id, 'Available')}
                                      className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-bold uppercase tracking-normal transition-all duration-150 shadow-sm shadow-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-0.5 whitespace-nowrap"
                                    >
                                      Release ✓
                                    </button>
                                    <button
                                      disabled={processingId !== null}
                                      onClick={() => handleUpdateStatus(item.id, 'Reported Fault')}
                                      className="py-1.5 px-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-md text-[11px] font-bold uppercase tracking-normal transition-all duration-150 shadow-sm shadow-yellow-900/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-0.5 whitespace-nowrap"
                                    >
                                      Fault 🛠️
                                    </button>
                                  </div>
                                )
                              ) : (
                                /* NEW LOOKUP INTERCEPTION BLOCK FOR SCHOLARS */
                                (() => {
                                  const pendingRequest = requests.find(req =>
                                    req.equipmentId === item.id &&
                                    (req.status === 'Pending Professor Approval' || req.status === 'Pending Holder Approval')
                                  );

                                  if (pendingRequest) {
                                    const isRequestedByMe = pendingRequest.requestedBy === user?.name;
                                    if (isRequestedByMe) {
                                      return (
                                        <div className="py-1.5 w-full px-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-[11px] font-bold uppercase text-center select-none">
                                          ⏳ Requested by You
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div className="py-1.5 w-full px-3 bg-slate-800/80 text-slate-400 border border-slate-700/50 rounded-md text-[11px] font-mono text-center truncate select-none" title={`Requested by ${pendingRequest.requestedBy}`}>
                                          🔒 Req. by {pendingRequest.requestedBy || "Scholar"}
                                        </div>
                                      );
                                    }
                                  }

                                  return (
                                    <button
                                      disabled={item.status === 'Maintenance' || item.status === 'Reported Fault' || processingId !== null}
                                      onClick={() => { setTargetEquipment(item); setShowRequestModal(true); }}
                                      className={`py-1.5 w-full px-3 text-white rounded-md text-[11px] font-bold uppercase tracking-normal transition-all duration-150 shadow-sm flex items-center justify-center whitespace-nowrap ${(item.status === 'Maintenance' || item.status === 'Reported Fault')
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40 shadow-none'
                                        : item.status === 'Available' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                                        }`}
                                    >
                                      {(item.status === 'Maintenance' || item.status === 'Reported Fault') ? 'Unavailable 🛠️' : item.status === 'Available' ? 'Request 📨' : 'Transfer 🔁'}
                                    </button>
                                  );
                                })()
                              )}
                            </div>
                          ) : user?.role === 'Professor' ? (
                            <div className="grid grid-cols-2 gap-1.5 w-full">
                              <button
                                disabled={processingId !== null}
                                onClick={() => handleRemoveEquipment(item.id)}
                                className="py-1.5 px-2 bg-red-600 hover:bg-red-500 text-white rounded-md text-[11px] font-bold uppercase tracking-normal transition-all duration-150 shadow-sm shadow-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-0.5 whitespace-nowrap"
                              >
                                Delete ❌
                              </button>

                              {item.status !== 'Maintenance' ? (
                                <button
                                  disabled={processingId !== null}
                                  onClick={() => handleUpdateStatus(item.id, 'Maintenance')}
                                  className={`py-1.5 px-1.5 text-white rounded-md text-[11px] font-bold uppercase tracking-normal transition-all duration-150 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center whitespace-nowrap ${item.status === 'Reported Fault'
                                    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20 animate-pulse border border-red-400/40'
                                    : 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20'
                                    }`}
                                >
                                  {item.status === 'Reported Fault' ? 'Approve 🛠️' : 'Maintain 🛠️'}
                                </button>
                              ) : (
                                <button
                                  disabled={processingId !== null}
                                  onClick={() => handleUpdateStatus(item.id, 'Available')}
                                  className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-bold uppercase tracking-normal transition-all duration-150 shadow-sm shadow-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-0.5 whitespace-nowrap"
                                >
                                  Fix Done ✅
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest bg-slate-900/50 border border-slate-800/60 py-1 px-2 rounded">
                              Locked
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* PANEL VIEW 2: MULTI-LEVEL REQUESTS WORKFLOW CENTER */
        <div className="space-y-6">
          <div className="bg-[#111E43] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-900/30">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                📥 Tasks Awaiting Your Action
              </h2>
            </div>

            {requests.filter(req => {
              if (user.role === 'Professor') return req.status === 'Pending Professor Approval';
              if (user.role === 'Scholar') return req.status === 'Pending Holder Approval' && req.equipmentHolder === user.name;
              return false;
            }).length === 0 ? (
              <div className="p-6 bg-slate-900/10">
                <p className="text-slate-400 italic text-xs">No pending request allocations require your signature at this time.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs border-collapse min-w-[1050px] table-fixed">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900/50">
                      <th className="px-4 py-3.5 w-[14%]">Asset ID</th>
                      <th className="px-4 py-3.5 w-[18%]">Requester</th>
                      <th className="px-4 py-3.5 w-[18%]">Duration Framework</th>
                      <th className="px-4 py-3.5 w-[28%]">Current Workflow Stage</th>
                      <th className="px-4 py-3.5 text-center w-[22%]">Execution Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 align-middle">
                    {requests.filter(req => {
                      if (user.role === 'Professor') return req.status === 'Pending Professor Approval';
                      if (user.role === 'Scholar') return req.status === 'Pending Holder Approval' && req.equipmentHolder === user.name;
                      return false;
                    }).map(req => (
                      <tr key={req.id} className="hover:bg-slate-800/20 transition-colors duration-150">
                        <td className="px-4 py-3.5 font-mono font-bold text-white whitespace-nowrap">
                          {req.equipmentId}
                        </td>
                        <td className="px-4 py-3.5 text-slate-300 font-medium truncate">
                          {req.requestedBy}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-black border uppercase tracking-wider ${req.duration === 'Short'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            }`}>
                            {req.duration} Term
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-amber-400 font-semibold italic truncate">
                          {req.status}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="grid grid-cols-2 gap-1.5 w-full">
                            <button
                              disabled={processingId !== null}
                              onClick={() => handleWorkflowAction(req.id, 'approve')}
                              className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md text-[11px] uppercase tracking-normal transition-all duration-150 shadow-sm shadow-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 whitespace-nowrap"
                            >
                              {processingId === req.id ? (
                                <>
                                  <span className="inline-block animate-spin text-xs">⏳</span>
                                  <span>Syncing...</span>
                                </>
                              ) : (
                                <span>{user.role === 'Professor' ? 'Approve ✓' : 'Accept ✓'}</span>
                              )}
                            </button>
                            <button
                              disabled={processingId !== null}
                              onClick={() => handleWorkflowAction(req.id, 'reject')}
                              className="py-1.5 px-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-md text-[11px] uppercase tracking-normal transition-all duration-150 shadow-sm shadow-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 whitespace-nowrap"
                            >
                              {processingId === req.id ? (
                                <>
                                  <span className="inline-block animate-spin text-xs">⏳</span>
                                  <span>Syncing...</span>
                                </>
                              ) : (
                                <span>{user.role === 'Professor' ? 'Reject ❌' : 'Decline ❌'}</span>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {user.role === 'Scholar' && (
            <div className="bg-[#111E43] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 bg-slate-900/30">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  📤 Track Your Sent Outbound Requests
                </h2>
              </div>

              {requests.filter(req => req.requestedBy === user.name).length === 0 ? (
                <div className="p-6 bg-slate-900/10">
                  <p className="text-slate-400 italic text-xs">You haven't initiated any asset allocation inquiries yet.</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-xl border border-slate-800 bg-[#0b132b]/40 shadow-inner">
                  <table className="w-full text-left text-xs border-collapse min-w-[1050px] table-fixed">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900/50">
                        <th className="px-4 py-3.5 w-[15%]">Asset ID</th>
                        <th className="px-4 py-3.5 w-[20%]">Duration Framework</th>
                        <th className="px-4 py-3.5 w-[25%]">Target Initial Holder</th>
                        <th className="px-4 py-3.5 w-[40%]">Current Tracking Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 align-middle">
                      {requests.filter(req => req.requestedBy === user.name).map(req => (
                        <tr key={req.id} className="hover:bg-slate-800/20 transition-colors duration-150">
                          <td className="px-4 py-3.5 font-mono text-white font-bold whitespace-nowrap">
                            {req.equipmentId}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-bold border border-slate-700/40 bg-slate-800/40 text-slate-300">
                              {req.duration} Duration
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-300 font-medium truncate">
                            {req.equipmentHolder || <span className="text-slate-500 font-normal italic font-sans">None (Pool)</span>}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-black border uppercase tracking-wider ${req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              req.status.startsWith('Rejected') || req.status.startsWith('Declined') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                              {req.status}
                            </span>
                          </td>
                          
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL WORKFLOW BOX */}
      {showRequestModal && targetEquipment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111E43] border border-slate-800 max-w-sm w-full rounded-xl p-5 shadow-xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white">Select Allocation Parameters</h3>
              <button onClick={() => { setShowRequestModal(false); setTargetEquipment(null); }} className="text-slate-400 hover:text-white text-lg">&times;</button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/60 text-xs text-slate-300">
                <p className="font-semibold text-white mb-1">Target Asset: {targetEquipment.id}</p>
                <p className="text-slate-400 text-[11px]">{targetEquipment.name}</p>
                <p className="mt-2 text-[11px]">
                  Current Status: <span className="text-amber-400 font-bold">{targetEquipment.status}</span>
                  {targetEquipment.currentHolder && ` (Held by ${targetEquipment.currentHolder})`}
                </p>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-2">Duration Matrix</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestDuration('Short')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center flex flex-col items-center justify-center ${requestDuration === 'Short' ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500' : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:border-slate-700'}`}
                  >
                    <span>⏱️ Short Duration</span>
                    <span className="text-[9px] font-normal text-slate-500 mt-0.5">Bypasses Sir's Approval</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRequestDuration('Long')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center flex flex-col items-center justify-center ${requestDuration === 'Long' ? 'bg-purple-600/10 text-purple-400 border-purple-500' : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:border-slate-700'}`}
                  >
                    <span>📅 Long Duration</span>
                    <span className="text-[9px] font-normal text-slate-500 mt-0.5">Requires Sir's Approval</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-400 italic">
                {targetEquipment.status === 'Available' ? (
                  requestDuration === 'Short'
                    ? '⚡ Since the equipment is currently Available, choosing a Short Duration allocation will instantly process your claim request.'
                    : '⏳ This item is Available, but a Long Duration allocation requires Professor approval before it can be processed.'
                ) : (
                  requestDuration === 'Short'
                    ? `🔁 This item is In Use. The request will be sent to ${targetEquipment.currentHolder}. If accepted, the item will transfer to you without needing Professor approval.`
                    : `⛓️ Sequential routing: This request goes to ${targetEquipment.currentHolder} first. If they accept, it routes to the Professor for final sign-off.`
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowRequestModal(false); setTargetEquipment(null); }} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-lg transition-all shadow-md">
                  {submitting ? 'Routing...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP: REGISTER NEW LAB EQUIPMENT ASSET (PROFESSOR ONLY) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111E43] border border-slate-800 max-w-md w-full rounded-xl p-5 shadow-xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white">Register Lab Equipment Asset</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg">&times;</button>
            </div>

            <form onSubmit={handleAddEquipment} className="space-y-4">
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Equipment No *</label>
                <input
                  type="text" required placeholder="e.g., APEL_FIG_01" value={eqId} onChange={(e) => setEqId(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Part No</label>
                <input
                  type="text" placeholder="e.g., MD043" value={eqPartNo} onChange={(e) => setEqPartNo(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Equipment Category *</label>
                <select
                  value={eqCategory}
                  onChange={(e) => setEqCategory(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Major" className="bg-[#111E43]">🛠️ Major Equipment</option>
                  <option value="Minor" className="bg-[#111E43]">🧰 Minor Equipment</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Description Manual (PDF)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setEqPdf(e.target.files[0])}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Product Description *</label>
                <textarea
                  rows="2" required placeholder="e.g., Unidirectional 5kW Power Supply" value={eqName} onChange={(e) => setEqName(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                ℹ️ This asset will register into the public tracking sheet with status <span className="text-emerald-400 font-bold">AVAILABLE</span> within the public pool.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-lg transition-all shadow-md">
                  {submitting ? 'Registering...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Equipments;