import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config';
function Consumables({ user }) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [parsedItems, setParsedItems] = useState([]);

  const [filterMode, setFilterMode] = useState(() => {
    const savedFilter = sessionStorage.getItem('labPortal_consumables_filterMode');
    return (savedFilter === 'pending' || savedFilter === 'all') ? savedFilter : 'pending';
  });
  const [expandedScholars, setExpandedScholars] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [viewTab, setViewTab] = useState(() => {
    const savedTab = sessionStorage.getItem('labPortal_consumables_viewTab');
    return (savedTab === 'dashboard' || savedTab === 'library') ? savedTab : 'dashboard';
  });
  const [remarks, setRemarks] = useState({});

  const [librarySearch, setLibrarySearch] = useState('');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [scholarPages, setScholarPages] = useState({});

  const itemsPerPage = 10;
  const dashboardItemsPerPage = 15;
  const token = localStorage.getItem('labPortalToken');

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/consumables`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItems(data);

        setExpandedScholars(prev => {
          if (Object.keys(prev).length === 0) {
            const initialCollapseState = {};
            data.forEach(item => {
              if (item.status === 'Pending Approval' || (item.status === 'Approved' && !item.orderDate)) {
                initialCollapseState[item.requestedBy] = true;
              }
            });
            return initialCollapseState;
          }
          return prev;
        });
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        sessionStorage.clear();
        window.location.reload();
      }
      else {
        toast.error('Failed to sync lab inventory database.');
      }
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!items || items.length === 0) {
      toast.error("No inventory tracking records available to export.");
      return;
    }

    let targetItems = [...items];
    if (user?.role === 'Scholar') {
      targetItems = targetItems.filter(item => item.requestedBy === user?.name);
    }

    if (targetItems.length === 0) {
      toast.error("No history records found for your user profile to export.");
      return;
    }

    const getMonthYearGroupLabel = (item) => {
      const rawDate = item.receiveDate || item.orderDate || item.approvalDate;
      if (!rawDate || rawDate === '—' || rawDate.toLowerCase().includes('pending')) {
        return "Pending Queue";
      }

      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIdx = parseInt(parts[1], 10) - 1;
        if (monthIdx >= 0 && monthIdx < 12) {
          return `${months[monthIdx]} ${parts[2]}`;
        }
      }
      return "Other Logged History";
    };

    const dateGroups = {};
    targetItems.forEach(item => {
      const groupName = getMonthYearGroupLabel(item);
      if (!dateGroups[groupName]) dateGroups[groupName] = [];
      dateGroups[groupName].push(item);
    });

    const workbook = XLSX.utils.book_new();

    const sortedGroupKeys = Object.keys(dateGroups).sort((a, b) => {
      if (a === "Pending Queue") return -1;
      if (b === "Pending Queue") return 1;
      return b.localeCompare(a);
    });

    sortedGroupKeys.forEach((groupName) => {
      const currentGroupItems = dateGroups[groupName];
      let spreadsheetRows = [];

      if (user?.role === 'Professor') {
        spreadsheetRows = currentGroupItems.map(item => {
          const qtyNum = parseFloat(item.quantity) || 0;
          const baseCostNum = parseFloat(String(item.unitCost || item.cost).replace(/[^0-9.]/g, '')) || 0;

          return {
            "Serial No.": item.srNo,
            "Scholar Name": item.requestedBy || "N/A",
            "Component Name": item.componentName || item.name || "N/A",
            "Part No.": item.partNo || "N/A",
            "Manufacturer": item.manufacturer || "N/A",
            "Package": item.package || "N/A",
            "Detailed Specifications": item.description || "—",
            "Total Allocation Qty": qtyNum,
            "Remaining Surplus Pool Qty": item.leftoverQty || 0,
            "Current Tracking Status": item.status,
            "Unit Price Rate": item.unitCost || item.cost || "—",
            "Total Spent/Budget": baseCostNum > 0 ? (qtyNum * baseCostNum).toFixed(2) : "—",
            "Approval Date": item.approvalDate || "—",
            "Logged Purchase Date": item.orderDate || "—",
            "Received Date": item.receiveDate || "—",
            "Component Source URL": item.purchaseLink || "—",
            "Remarks": item.remark || "—"
          };
        });
      } else {
        spreadsheetRows = currentGroupItems.map(item => {
          const qtyNum = parseFloat(item.quantity) || 0;
          const baseCostNum = parseFloat(String(item.unitCost || item.cost).replace(/[^0-9.]/g, '')) || 0;

          return {
            "Sr. No.": item.srNo,
            "Component Name": item.componentName || item.name || "N/A",
            "Part No.": item.partNo || "N/A",
            "Manufacturer": item.manufacturer || "N/A",
            "Package": item.package || "N/A",
            "Description": item.description || "—",
            "Requested Qty": qtyNum,
            "Declared Leftover": item.leftoverQty || 0,
            "Status": item.status,
            "Cost per Unit": item.unitCost || item.cost || "—",
            "Total Allocation Value": baseCostNum > 0 ? (qtyNum * baseCostNum).toFixed(2) : "—",
            "Date Approved": item.approvalDate || "—",
            "Date Ordered": item.orderDate || "—",
            "Date Received": item.receiveDate || "—",
            "Target Procurement URL": item.purchaseLink || "—",
            "Remarks": item.remark || "—"
          };
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(spreadsheetRows);
      const safeSheetTabName = groupName.substring(0, 31).replace(/[\\"\/?*\[\]]/g, "");
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetTabName);
    });

    const fileTimestamp = new Date().toISOString().split('T')[0];
    const outputFileName = user?.role === 'Professor'
      ? `Professor_Master_Inventory_Ledger_${fileTimestamp}.xlsx`
      : `${user?.name || 'Scholar'}_Consumables_History_${fileTimestamp}.xlsx`;

    XLSX.writeFile(workbook, outputFileName);
    toast.success(`${user?.role} ledger history file downloaded successfully!`);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    sessionStorage.setItem('labPortal_consumables_viewTab', viewTab);
  }, [viewTab]);

  useEffect(() => {
    sessionStorage.setItem('labPortal_consumables_filterMode', filterMode);
  }, [filterMode]);
  useEffect(() => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}, [viewTab,filterMode]);
  const handleLifecycleUpdate = async (srNosArray, updateType, extraData = {}) => {
    console.log(updateType)
    setActionLoading(true);
    try {
      const relevantRemarks = {};
      srNosArray.forEach(id => {
        if (remarks[id] !== undefined) {
          relevantRemarks[id] = remarks[id];
        }
      });

      const response = await fetch(`${API_BASE_URL}/api/consumables/update-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          srNos: srNosArray,
          updateType,
          dateValue: new Date().toLocaleDateString('en-IN'),
          itemRemarks: relevantRemarks,
          ...extraData
        })
      });
      console.log(response)
      if (response.ok) {
        toast.success(`Inventory successfully updated: ${updateType}`);
        await fetchInventory();
      } else {
        const errData = await response.json();
        toast.error(errData.message || 'Action rejected by server.');
      }
    } catch (err) {
      toast.error('Network transmission error.');
    } finally {
      setActionLoading(false);
    }
  };

  const LeftoverInputToast = ({ item, closeToast, onSave }) => {
    const [qty, setQty] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      const parsedQty = parseInt(qty);

      if (isNaN(parsedQty) || parsedQty <= 0 || parsedQty > item.quantity) {
        toast.error(`Invalid! Please input a value between 1 and ${item.quantity}.`, {
          toastId: 'validation-guard-heavy'
        });
        return;
      }

      onSave(parsedQty);
      closeToast();
    };

    return (
      <div className="p-3 w-full text-slate-200 relative">
        <button
          type="button"
          onClick={closeToast}
          className="absolute top-1.5 right-1.5 text-slate-400 hover:text-white transition-colors text-xl font-bold p-1 leading-none z-10"
          aria-label="Close notification"
        >
          &times;
        </button>

        <div className="flex items-center gap-3 mb-3 pb-2 border-b border-slate-800/60 pr-6">
          <span className="text-xl">📦</span>
          <div>
            <h4 className="text-sm font-bold text-white tracking-wider uppercase">
              Inventory Surplus Declaration
            </h4>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Asset Reference ID: #{item.srNo}</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-4 leading-relaxed">
          Specify remaining allocation details for <strong className="text-purple-400 font-semibold">"{item.componentName || item.name}"</strong>.
          <span className="block text-xs text-slate-400 font-medium mt-1 bg-slate-950/40 p-2 rounded border border-slate-800/40">
            ⚠️ Maximum trackable units allowed by purchase log: <strong className="text-white font-mono">{item.quantity}</strong>
          </span>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
          <label className="block flex-1 sm:flex-initial">
            <span className="sr-only">Surplus Quantity Units</span>
            <input
              type="number"
              min="1"
              max={item.quantity}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty units"
              className="bg-slate-950 border-2 border-slate-800 rounded-xl px-4 py-2.5 text-sm w-full sm:w-36 text-white font-mono font-bold focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-inner"
              autoFocus
            />
          </label>
          <button
            type="submit"
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold uppercase tracking-wider py-3 px-4 rounded-xl shadow-lg hover:shadow-purple-900/20 transform active:scale-[0.98] transition-all"
          >
            Submit Return To Surplus Pool
          </button>
        </form>
      </div>
    );
  };

  const triggerLeftoverPrompt = (item) => {
    toast(
      ({ closeToast }) => (
        <LeftoverInputToast
          item={item}
          closeToast={closeToast}
          onSave={(parsedQty) =>
            handleLifecycleUpdate([item.srNo], 'MarkLeftover', { leftoverQty: parsedQty })
          }
        />
      ),
      {
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        icon: false,
        className: '!w-full !max-w-[550px] !bg-[#0b132b] border-2 border-slate-800 rounded-2xl shadow-2xl p-2 my-2'
      }
    );
  };

  const DisburseInputToast = ({ item, closeToast, onSave }) => {
    const [qty, setQty] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      const parsedQty = parseInt(qty);

      if (isNaN(parsedQty) || parsedQty <= 0 || parsedQty > parseInt(item.leftoverQty)) {
        toast.error(`Invalid amount! Input a configuration value between 1 and ${item.leftoverQty}.`, {
          toastId: 'validation-guard-disburse'
        });
        return;
      }

      onSave(parsedQty);
      closeToast();
    };

    return (
      <div className="p-3 w-full text-slate-200 relative">
        <button
          type="button"
          onClick={closeToast}
          className="absolute top-1.5 right-1.5 text-slate-400 hover:text-white transition-colors text-xl font-bold p-1 leading-none z-10"
          aria-label="Close notification"
        >
          &times;
        </button>

        <div className="flex items-center gap-3 mb-3 pb-2 border-b border-slate-800/60 pr-6">
          <span className="text-xl">📤</span>
          <div>
            <h4 className="text-sm font-bold text-white tracking-wider uppercase">
              Disburse Stock Units
            </h4>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Asset Sheet Row: #{item.srNo}</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-4 leading-relaxed">
          Specify the total number of units given away from <strong className="text-purple-400 font-semibold">"{item.componentName || item.name}"</strong>.
          <span className="block text-xs text-slate-400 font-medium mt-1 bg-slate-950/40 p-2 rounded border border-slate-800/40">
            📦 Available inventory allocation pool: <strong className="text-white font-mono">{item.leftoverQty}</strong> units
          </span>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
          <label className="block flex-1 sm:flex-initial">
            <span className="sr-only">Disbursed Quantity Units</span>
            <input
              type="number"
              min="1"
              max={item.leftoverQty}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty given"
              className="bg-slate-950 border-2 border-slate-800 rounded-xl px-4 py-2.5 text-sm w-full sm:w-36 text-white font-mono font-bold focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-inner"
              autoFocus
            />
          </label>
          <button
            type="submit"
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold uppercase tracking-wider py-3 px-4 rounded-xl shadow-lg hover:shadow-purple-900/20 transform active:scale-[0.98] transition-all"
          >
            Confirm Distribution
          </button>
        </form>
      </div>
    );
  };

  const triggerDisbursePrompt = (item) => {
    toast(
      ({ closeToast }) => (
        <DisburseInputToast
          item={item}
          closeToast={closeToast}
          onSave={(inputQty) => {
            const adjustedTargetQty = parseInt(item.leftoverQty) - inputQty;
            handleLifecycleUpdate([item.srNo], 'UpdateLeftoverQty', { leftoverQty: adjustedTargetQty });
          }}
        />
      ),
      {
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        icon: false,
        className: '!w-full !max-w-[550px] !bg-[#0b132b] border-2 border-slate-800 rounded-2xl shadow-2xl p-2 my-2'
      }
    );
  };

  const toggleScholarAccordion = (scholarName) => {
    setExpandedScholars(prev => ({ ...prev, [scholarName]: !prev[scholarName] }));
  };

  const getGroupedData = () => {
    let processedList = [...items];

    if (user?.role === 'Professor') {
      if (filterMode === 'pending') {
        processedList = processedList.filter(
          item => item.status === 'Pending Approval' || item.status === 'Approved'
        );
      }
    } else if (user?.role === 'Scholar') {
      if (filterMode === 'pending') {
        processedList = processedList.filter(
          item => item.requestedBy === user?.name && (item.status === 'Ordered' || item.status === 'Approved')
        );
      } else {
        processedList = processedList.filter(
          item => item.requestedBy === user?.name
        );
      }
    }

    const searchLower = dashboardSearch.toLowerCase().trim();
    if (searchLower) {
      processedList = processedList.filter(item =>
        (item.componentName || item.name || '').toLowerCase().includes(searchLower) ||
        (item.partNo || '').toLowerCase().includes(searchLower) ||
        (item.manufacturer || '').toLowerCase().includes(searchLower) ||
        (item.status || '').toLowerCase().includes(searchLower)
      );
    }

    return processedList.reduce((acc, item) => {
      if (!acc[item.requestedBy]) acc[item.requestedBy] = [];
      acc[item.requestedBy].push(item);
      return acc;
    }, {});
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          toast.warning('The uploaded Excel sheet appears to be empty.');
          return;
        }

        const getValByAlias = (row, aliases) => {
          for (let alias of aliases) {
            if (row[alias] !== undefined) return row[alias];
            let foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === alias.toLowerCase());
            if (foundKey) return row[foundKey];
          }
          return '';
        };

        const mappedData = rawData.map((row, idx) => {
          const componentName = getValByAlias(row, ['Name of Component', 'Component Name', 'Item Name', 'Name', 'Component', 'Item']) || 'Unknown Component';
          const unitCost = getValByAlias(row, ['Unit Cost', 'Cost', 'Price', 'Unit Price']) || 'N/A';

          return {
            id: idx + 1,
            srNo: getValByAlias(row, ['Sr No', 'Sr No.', 'Serial No', 'SNo', 'S.No.']) || (idx + 1),
            componentName: componentName,
            name: componentName,
            partNo: getValByAlias(row, ['Part No', 'Part Number', 'Part#', 'PartNo', 'Part No.']),
            description: getValByAlias(row, ['Description', 'Desc', 'Details']),
            manufacturer: getValByAlias(row, ['Manufacturer', 'Mfr', 'Brand', 'Make']),
            quantity: parseInt(getValByAlias(row, ['Quantity', 'Qty', 'Count', 'Units'])) || 1,
            package: getValByAlias(row, ['Package', 'Pkg', 'Type']),
            purchaseLink: getValByAlias(row, ['Purchase Link', 'Link', 'URL', 'Buy Link']),
            unitCost: unitCost,
            cost: unitCost,
            remark: getValByAlias(row, ['Remark', 'Remarks', 'Note', 'Notes'])
          };
        });

        setParsedItems(mappedData);
        toast.info(`Parsed ${rawData.length} rows from spreadsheet.`);
      } catch (err) {
        toast.error('Failed to interpret Excel file structural integrity.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFinalSubmission = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/consumables/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ requests: parsedItems, scholarName: user?.name })
      });
      if (response.ok) {
        toast.success('Excel batch successfully uploaded to master spreadsheet!');
        setParsedItems([]);
        setShowModal(false);
        fetchInventory();
      } else {
        toast.error('Server rejected batch insertion rows.');
      }
    } catch (err) {
      toast.error('Network connection failure during file post.');
    } finally {
      setActionLoading(false);
    }
  };

  const getSurplusRecommendations = () => {
    if (parsedItems.length === 0) return [];
    const activeSurplusItems = items.filter(i => i.status === 'Surplus/Unused' && i.leftoverQty > 0);
    return activeSurplusItems.filter(surplusItem =>
      parsedItems.some(uploadedItem => {
        const uploadedName = (uploadedItem.componentName || uploadedItem.name || '').toLowerCase().trim();
        const surplusName = (surplusItem.componentName || surplusItem.name || '').toLowerCase().trim();
        return uploadedName && surplusName && uploadedName === surplusName;
      })
    );
  };

  const groupedInventory = getGroupedData();
  const scholarNamesKeys = Object.keys(groupedInventory);
  const recommendations = getSurplusRecommendations();

  const surplusLibraryItems = items.filter(item => item.status === 'Surplus/Unused' && parseInt(item.leftoverQty) > 0);
  const pendingCount = items.filter(item => {
    if (user?.role === 'Professor') {
      return item.status === 'Pending Approval' || item.status === 'Approved';
    }
    if (user?.role === 'Scholar') {
      return item.requestedBy === user?.name && (item.status === 'Ordered' || item.status === 'Approved');
    }
    return false;
  }).length;

  const filteredLibraryItems = surplusLibraryItems.filter(item => {
    const searchLower = librarySearch.toLowerCase().trim();
    if (!searchLower) return true;

    return (
      (item.componentName || item.name || '').toLowerCase().includes(searchLower) ||
      (item.partNo || '').toLowerCase().includes(searchLower) ||
      (item.manufacturer || '').toLowerCase().includes(searchLower) ||
      (item.requestedBy || '').toLowerCase().includes(searchLower)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPaginatedItems = filteredLibraryItems.slice(indexOfFirstItem, indexOfLastItem);

  const statusBadgeClass = (status) => {
    switch (status) {
      case 'Received': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Surplus/Unused': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Distributed': return 'bg-slate-500/15 text-slate-400 border-slate-700/30';
      case 'Ordered': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Approved': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Rejected': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  return (
    <div className="space-y-4 w-full max-w-[1600px] mx-auto text-slate-200 px-2 sm:px-4">

      {/* MENU BAR */}
      <div className="bg-[#111E43] border border-slate-800 rounded-xl p-3 sm:p-4 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="bg-slate-900/60 p-1 rounded-lg border border-slate-800/80 flex gap-1 w-full sm:w-auto overflow-x-auto scrollbar-none">
          <button
            onClick={() => { setFilterMode('pending'); setViewTab('dashboard'); }}
            className={`flex-1 sm:flex-none text-center whitespace-nowrap px-3 sm:px-4 py-2 sm:py-1.5 rounded-md text-xs font-semibold transition-all ${viewTab === 'dashboard' && filterMode === 'pending'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            🎯 {user?.role === 'Professor' ? 'Pending Queue' : 'My Tasks'}
            {pendingCount > 0 && (
              <span className={`px-1.5 ml-1 py-0.5 rounded-md text-[10px] font-bold font-mono border transition-all ${viewTab === 'dashboard' && filterMode === 'pending'
                ? 'bg-white text-blue-600 border-white'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                }`}>
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setFilterMode('all'); setViewTab('dashboard'); }}
            className={`flex-1 sm:flex-none text-center whitespace-nowrap px-3 sm:px-4 py-2 sm:py-1.5 rounded-md text-xs font-semibold transition-all ${viewTab === 'dashboard' && filterMode === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            📁 All History
          </button>

          <button
            onClick={() => setViewTab('library')}
            className={`flex-1 sm:flex-none text-center whitespace-nowrap px-3 sm:px-4 py-2 sm:py-1.5 rounded-md text-xs font-semibold transition-all ${viewTab === 'library'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            🏛️ Surplus Library
          </button>
        </div>

        {/* Global Dashboard Search Field Input Container */}
        {viewTab === 'dashboard' && filterMode === 'all' && (
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={dashboardSearch}
              onChange={(e) => setDashboardSearch(e.target.value)}
              placeholder="🔍 Search history records..."
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-500"
            />
          </div>
        )}

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={exportToExcel}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-lg transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.99]"
          >
            <span>📊</span> {user?.role === 'Scholar' ? 'Download My History' : 'Download Master Log'}
          </button>

          {user?.role === 'Scholar' && viewTab === 'dashboard' && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto px-5 py-2.5 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white rounded-lg transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40 active:scale-[0.99]"
            >
              <span>📥</span> Upload Sheet
            </button>
          )}
        </div>
      </div>

      {/* VIEW ROUTING */}
      {viewTab === 'library' ? (
        <div className="bg-[#111E43] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-900/30 border-b border-slate-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Global Laboratory Surplus Repository</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Available unallocated components logged across cells.</p>
            </div>

            <div className="w-full sm:w-72">
              <label className="block">
                <span className="sr-only">Search Repository</span>
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="🔍 Search name, part no, custodian..."
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 transition-colors placeholder-slate-500"
                />
              </label>
            </div>
          </div>

          {/* Mobile Display Blocks */}
          <div className="block lg:hidden divide-y divide-slate-800/60">
            {filteredLibraryItems.length === 0 ? (
              <div className="p-8 text-center text-slate-500 italic text-xs">No entries found matching criteria.</div>
            ) : (
              filteredLibraryItems.map((item) => (
                <div key={item.srNo} className="p-4 space-y-2 bg-[#111E43] hover:bg-slate-800/10">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{item.componentName || item.name}</span>
                    <span className="text-xs font-mono text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded">{item.leftoverQty} units</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px] text-slate-400 font-mono">
                    <div>Ref ID: <span className="text-slate-300">#{item.srNo}</span></div>
                    <div>Part No: <span className="text-slate-300">{item.partNo || '—'}</span></div>
                    <div>Mfr: <span className="text-slate-300">{item.manufacturer || '—'}</span></div>
                    <div>Custodian: <span className="text-slate-300">{item.requestedBy || '—'}</span></div>
                  </div>
                  {item.description && <p className="text-[11px] text-slate-300 pt-1 border-t border-slate-800/40">{item.description}</p>}
                </div>
              ))
            )}
          </div>

          {/* Desktop Spreadsheet Matrix Data Grid View */}
          <div className="hidden lg:block overflow-x-auto w-full">
            <table className="w-full text-left border-collapse" style={{ minWidth: '1100px' }}>
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="px-4 py-3" style={{ width: '90px' }}>Source ID</th>
                  <th className="px-4 py-3" style={{ width: '220px' }}>Component Name</th>
                  <th className="px-4 py-3" style={{ width: '150px' }}>Part No</th>
                  <th className="px-4 py-3" style={{ width: '120px' }}>Available Qty</th>
                  <th className="px-4 py-3" style={{ width: '180px' }}>Manufacturer</th>
                  <th className="px-4 py-3" style={{ width: '250px' }}>Description</th>
                  <th className="px-4 py-3" style={{ width: '160px' }}>Original Custodian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs text-slate-300">
                {filteredLibraryItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500 italic">No records matches.</td>
                  </tr>
                ) : (
                  currentPaginatedItems.map((item) => (
                    <tr key={item.srNo} className="hover:bg-slate-800/10 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-slate-500">#{item.srNo}</td>
                      <td className="px-4 py-3.5 font-semibold text-white">{item.componentName || item.name}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-400">{item.partNo || '—'}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-purple-400">{item.leftoverQty} units</td>
                      <td className="px-4 py-3.5 text-slate-400">{item.manufacturer || '—'}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-400">{item.description || '—'}</td>
                      <td className="px-4 py-3.5 text-slate-400 font-medium">
                        {item.requestedBy || '—'} {item.requestedBy === user?.name && <span className="text-slate-500">(You)</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredLibraryItems.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 bg-slate-900/40 border-t border-slate-800/60 text-xs font-mono">
              <div className="text-slate-400">
                Showing <span className="text-white font-bold">{indexOfFirstItem + 1}</span> to{" "}
                <span className="text-white font-bold">
                  {Math.min(indexOfLastItem, filteredLibraryItems.length)}
                </span>{" "}
                of <span className="text-purple-400 font-bold">{filteredLibraryItems.length}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage(prev => prev - 1);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  ◀ Previous
                </button>
                <span className="px-3 py-1 bg-slate-950/60 border border-slate-800 text-slate-400 rounded-md">
                  Page {currentPage} of {Math.ceil(filteredLibraryItems.length / itemsPerPage)}
                </span>
                <button
                  disabled={indexOfLastItem >= filteredLibraryItems.length}
                  onClick={() => {
                    setCurrentPage(prev => prev + 1);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        loading && items.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 font-mono">Loading data...</div>
        ) : scholarNamesKeys.length === 0 ? (
          <div className="bg-[#111E43] border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 italic">
            No records found matching criteria.
          </div>
        ) : (
          <div className="space-y-3">
            {scholarNamesKeys.map((scholarName) => {
              const scholarRecords = groupedInventory[scholarName];
              const isExpanded = !!expandedScholars[scholarName];

              const pendingApprovalIds = scholarRecords.filter(r => r.status === 'Pending Approval').map(r => r.srNo);
              const approvedOrderIds = scholarRecords.filter(r => r.status === 'Approved').map(r => r.srNo);

              const currentScholarPage = scholarPages[scholarName] || 1;
              const lastDashIdx = currentScholarPage * dashboardItemsPerPage;
              const firstDashIdx = lastDashIdx - dashboardItemsPerPage;
              const paginatedScholarRecords = scholarRecords.slice(firstDashIdx, lastDashIdx);

              return (
                <div key={scholarName} className="bg-[#111E43] border border-slate-800 rounded-xl overflow-hidden shadow-sm relative">
                  {actionLoading && (
                    <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[0.5px] z-30 cursor-not-allowed flex items-center justify-center text-white font-mono text-[10px]" />
                  )}

                  {/* Accordion Trigger Header */}
                  <div
                    onClick={() => !actionLoading && toggleScholarAccordion(scholarName)}
                    className={`p-4 bg-slate-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/20 ${actionLoading ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-900/30 cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white">{scholarName}</span>
                      <span className="text-[11px] text-slate-400">({scholarRecords.length} entries)</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                      {user?.role === 'Professor' && isExpanded && (
                        <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {pendingApprovalIds.length > 0 && (
                            <button
                              disabled={actionLoading}
                              onClick={() => handleLifecycleUpdate(pendingApprovalIds, 'Approve')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-[10px] font-bold text-white rounded transition-all"
                            >
                              ✓ Approve All ({pendingApprovalIds.length})
                            </button>
                          )}
                          {approvedOrderIds.length > 0 && (
                            <button
                              disabled={actionLoading}
                              onClick={() => handleLifecycleUpdate(approvedOrderIds, 'Order')}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-[10px] font-bold text-white rounded transition-all"
                            >
                              📦 Order All ({approvedOrderIds.length})
                            </button>
                          )}
                        </div>
                      )}

                      <span className="text-slate-400 text-xs font-mono self-end sm:self-auto">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Accordion Canvas View Routing Matrix */}
                  {isExpanded && (
                    <div className="p-2 sm:p-0">
                      {/* Mobile Adaptive Collapsed Cards Layout */}
                      <div className="block lg:hidden divide-y divide-slate-800/40">
                        {paginatedScholarRecords.map((item) => {
                          const surplusMatch = surplusLibraryItems.find(sItem => {
                            const sName = (sItem.componentName || sItem.name || '').toLowerCase().trim();
                            const iName = (item.componentName || item.name || '').toLowerCase().trim();
                            return sName && iName && sName === iName;
                          });

                          return (
                            <div key={item.srNo} className="p-3.5 space-y-3 bg-[#0b132b]/20">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <div className="font-semibold text-white text-sm">{item.componentName || item.name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">Ref: #{item.srNo} | Part: {item.partNo || '—'}</div>
                                </div>
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide whitespace-nowrap ${statusBadgeClass(item.status)}`}>
                                  {item.status}
                                </span>
                              </div>

                              {user?.role === 'Professor' && item.status === 'Pending Approval' && surplusMatch && (
                                <div className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2 rounded block">
                                  💡 {surplusMatch.leftoverQty} match pools found in unallocated stocks held by {surplusMatch.requestedBy}
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono border-t border-b border-slate-800/30 py-2">
                                <div>Qty Req: <span className="text-blue-400 font-bold">{item.quantity}</span></div>
                                <div>Qty Surplus: <span className="text-purple-400 font-bold">{item.status === 'Surplus/Unused' ? item.leftoverQty : '0'}</span></div>
                                <div>Cost/Unit: <span className="text-slate-300">{item.unitCost || item.cost || '—'}</span></div>
                                <div>Mfr: <span className="text-slate-300 truncate block max-w-[120px]">{item.manufacturer || '—'}</span></div>
                              </div>

                              {/* Responsive Remarks Box Layout Area */}
                              <div className="text-xs">
                                {user?.role === 'Professor' ? (
                                  <label className="block w-full">
                                    <span className="sr-only">Add system notes</span>
                                    <textarea
                                      disabled={actionLoading}
                                      placeholder="Add system notes..."
                                      rows={2}
                                      value={remarks[item.srNo] !== undefined ? remarks[item.srNo] : (item.remark || '')}
                                      onChange={(e) => setRemarks({ ...remarks, [item.srNo]: e.target.value })}
                                      className="w-full bg-slate-950 border border-slate-800 text-[11px] text-slate-200 px-2.5 py-1.5 rounded focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600 resize-y min-h-[50px] block font-sans leading-relaxed"
                                    />
                                  </label>
                                ) : (
                                  item.remark && (
                                    <p className="text-[11px] text-slate-400 bg-slate-950/20 p-2 rounded border border-slate-800/40 break-words whitespace-pre-wrap leading-relaxed">
                                      <span className="font-bold text-slate-500 block mb-0.5 text-[10px]">Remark:</span>
                                      {item.remark}
                                    </p>
                                  )
                                )}
                              </div>

                              {/* Responsive Core Lifecycle Actions Row Panel */}
                              <div className="pt-1">
                                {user?.role === 'Professor' && (
                                  <div className="flex gap-2 w-full">
                                    {item.status === 'Pending Approval' && (
                                      <>
                                        <button onClick={() => handleLifecycleUpdate([item.srNo], 'Approve')} className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded text-xs transition-colors">✓ Approve</button>
                                        <button onClick={() => handleLifecycleUpdate([item.srNo], 'Reject')} className="flex-1 py-2 bg-rose-600 text-white font-bold rounded text-xs transition-colors">✗ Reject</button>
                                      </>
                                    )}
                                    {item.status === 'Approved' && (
                                      <button onClick={() => handleLifecycleUpdate([item.srNo], 'Order')} className="w-full py-2 bg-blue-600 text-white font-bold rounded text-xs transition-colors">📦 Log Purchase</button>
                                    )}
                                  </div>
                                )}

                                {user?.role === 'Scholar' && (
                                  <div className="w-full">
                                    {item.status === 'Approved' && <button onClick={() => handleLifecycleUpdate([item.srNo], 'Order')} className="w-full py-2 bg-amber-600 text-white font-bold text-xs rounded transition-colors">🧾 Log Purchase</button>}
                                    {item.status === 'Ordered' && <button onClick={() => handleLifecycleUpdate([item.srNo], 'Receive')} className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded transition-colors">✓ Mark Received</button>}
                                    {item.status === 'Received' && item.requestedBy === user?.name && <button onClick={() => triggerLeftoverPrompt(item)} className="w-full py-2 bg-purple-600 text-white font-bold text-xs rounded transition-colors">Mark Excess Stock</button>}
                                    {item.status === 'Surplus/Unused' && item.requestedBy === user?.name && parseInt(item.leftoverQty) > 0 && (
                                      <button onClick={() => triggerDisbursePrompt(item)} className="w-full py-2 bg-purple-600/30 text-purple-400 font-bold text-xs rounded border border-purple-500/20 transition-all">Disburse Units 📦</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Spreadsheet Matrix Data Grid View */}
                      <div className="hidden lg:block w-full overflow-x-auto border-t border-slate-800 bg-[#0b132b]/40">
                        <table className="text-left border-collapse" style={{ minWidth: '2000px', width: '100%' }}>
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                              <th className="px-4 py-3.5" style={{ width: '100px' }}>Sr No.</th>
                              <th className="px-4 py-3.5" style={{ width: '250px' }}>Component Name</th>
                              <th className="px-4 py-3.5" style={{ width: '180px' }}>Part No</th>
                              <th className="px-4 py-3.5" style={{ width: '350px' }}>Description</th>
                              <th className="px-4 py-3.5" style={{ width: '200px' }}>Manufacturer</th>
                              <th className="px-4 py-3.5" style={{ width: '120px' }}>Qty Ordered</th>
                              <th className="px-4 py-3.5" style={{ width: '120px' }}>Qty Surplus</th>
                              <th className="px-4 py-3.5" style={{ width: '150px' }}>Package</th>
                              <th className="px-4 py-3.5" style={{ width: '250px' }}>Purchase Link</th>
                              <th className="px-4 py-3.5" style={{ width: '120px' }}>Unit Cost</th>
                              <th className="px-4 py-3.5" style={{ width: '150px' }}>Status</th>
                              <th className="px-4 py-3.5" style={{ width: '280px' }}>Remarks</th>
                              <th className="px-4 py-3.5" style={{ width: '140px' }}>Approval Date</th>
                              <th className="px-4 py-3.5" style={{ width: '140px' }}>Order Date</th>
                              <th className="px-4 py-3.5" style={{ width: '140px' }}>Receive Date</th>
                              <th className="px-4 py-3.5 text-center" style={{ width: '220px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40 text-xs">
                            {paginatedScholarRecords.map((item) => {
                              const surplusMatch = surplusLibraryItems.find(sItem => {
                                const sName = (sItem.componentName || sItem.name || '').toLowerCase().trim();
                                const iName = (item.componentName || item.name || '').toLowerCase().trim();
                                return sName && iName && sName === iName;
                              });

                              return (
                                <tr key={item.srNo} className="hover:bg-slate-800/10 transition-colors">
                                  <td className="px-4 py-4 font-mono text-slate-500">{item.srNo}</td>
                                  <td className="px-4 py-4">
                                    <div className="font-semibold text-white leading-snug">{item.componentName || item.name}</div>
                                    {user?.role === 'Professor' && item.status === 'Pending Approval' && surplusMatch && (
                                      <div className="mt-1.5 text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded inline-flex items-center gap-1 animate-pulse">
                                        💡 {surplusMatch.leftoverQty} units in Surplus with {surplusMatch.requestedBy}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 font-mono text-slate-400 text-[11px]">{item.partNo || '—'}</td>
                                  <td className="px-4 py-4 text-slate-300 text-[11px] leading-relaxed max-w-[350px]">
                                    <span className="line-clamp-3" title={item.description}>{item.description || '—'}</span>
                                  </td>
                                  <td className="px-4 py-4 text-slate-300 text-[11px]">{item.manufacturer || '—'}</td>
                                  <td className="px-4 py-4 font-mono text-blue-400 font-bold text-sm">{item.quantity}</td>
                                  <td className="px-4 py-4 font-mono text-purple-400 font-bold text-sm">
                                    {item.status === 'Surplus/Unused' ? item.leftoverQty : '0'}
                                  </td>
                                  <td className="px-4 py-4 text-slate-400 text-[11px]">{item.package || '—'}</td>
                                  <td className="px-4 py-4">
                                    {item.purchaseLink ? (
                                      <a
                                        href={item.purchaseLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 underline underline-offset-2 text-[11px] font-mono break-all line-clamp-2"
                                      >
                                        {item.purchaseLink.length > 35 ? item.purchaseLink.slice(0, 35) + '…' : item.purchaseLink}
                                      </a>
                                    ) : (
                                      <span className="text-slate-600 text-[11px]">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 font-mono text-slate-300 text-[11px]">{item.unitCost || item.cost || '—'}</td>
                                  <td className="px-4 py-4">
                                    <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold border uppercase tracking-wide whitespace-nowrap ${statusBadgeClass(item.status)}`}>
                                      {item.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-4">
                                    {user?.role === 'Professor' ? (
                                      <label className="block w-full">
                                        <span className="sr-only">Table row item configuration note</span>
                                        <textarea
                                          disabled={actionLoading}
                                          placeholder="Add remark..."
                                          rows={2}
                                          value={remarks[item.srNo] !== undefined ? remarks[item.srNo] : (item.remark || '')}
                                          onChange={(e) => setRemarks({ ...remarks, [item.srNo]: e.target.value })}
                                          className="w-full bg-slate-950 border border-slate-800 text-[11px] text-slate-200 px-2.5 py-1.5 rounded focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600 resize-y min-h-[50px] block font-sans leading-normal"
                                        />
                                      </label>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 italic font-mono block max-w-[260px] break-words whitespace-pre-wrap leading-relaxed" title={item.remark}>
                                        {item.remark || '—'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">{item.approvalDate || '—'}</td>
                                  <td className="px-4 py-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">{item.orderDate || '—'}</td>
                                  <td className="px-4 py-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">{item.receiveDate || '—'}</td>
                                  <td className="px-3 py-4 text-center">
                                    <div className="flex flex-col justify-center gap-1.5">
                                      {user?.role === 'Professor' && (
                                        <>
                                          {item.status === 'Pending Approval' && (
                                            <div className="flex gap-1.5 w-full">
                                              <button onClick={() => handleLifecycleUpdate([item.srNo], 'Approve')} className="flex-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold">✓ Approve</button>
                                              <button onClick={() => handleLifecycleUpdate([item.srNo], 'Reject')} className="flex-1 px-2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold">✗ Reject</button>
                                            </div>
                                          )}
                                          {item.status === 'Approved' && (
                                            <button onClick={() => handleLifecycleUpdate([item.srNo], 'Order')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold w-full">📦 Log Order</button>
                                          )}
                                          {['Ordered', 'Received', 'Surplus/Unused', 'Rejected', 'Distributed'].includes(item.status) && (
                                            <span className="text-[11px] text-slate-500 italic select-none">Locked</span>
                                          )}
                                        </>
                                      )}
                                      {user?.role === 'Scholar' && (
                                        <>
                                          {item.status === 'Approved' && <button onClick={() => handleLifecycleUpdate([item.srNo], 'Order')} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold w-full">🧾 Log Order</button>}
                                          {item.status === 'Ordered' && <button onClick={() => handleLifecycleUpdate([item.srNo], 'Receive')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold w-full">✓ Mark Received</button>}
                                          {item.status === 'Received' && item.requestedBy === user?.name && <button onClick={() => triggerLeftoverPrompt(item)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold w-full">Mark Leftover</button>}
                                          {item.status === 'Surplus/Unused' && (
                                            <div className="flex flex-col gap-1 items-center w-full">
                                              <span className="text-[11px] text-purple-400 font-bold select-none">Surplus Pool</span>
                                              {item.requestedBy === user?.name && parseInt(item.leftoverQty) > 0 && (
                                                <button onClick={() => triggerDisbursePrompt(item)} className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white text-[11px] font-bold rounded w-full">Disburse Items 📦</button>
                                              )}
                                            </div>
                                          )}
                                          {item.status === 'Distributed' && <span className="text-[11px] text-slate-500 font-medium italic select-none">Fully Distributed 🏅</span>}
                                          {item.status === 'Pending Approval' && <span className="text-[11px] text-slate-500 italic select-none">Pending Review</span>}
                                          {item.status === 'Rejected' && <span className="text-[11px] text-rose-400 font-bold select-none">Rejected</span>}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Per-Accordion History Pagination Controls */}
                      {scholarRecords.length > dashboardItemsPerPage && (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 bg-slate-900/40 border-t border-slate-800/20 text-xs font-mono">
                          <div className="text-slate-400">
                            Showing <span className="text-white font-bold">{firstDashIdx + 1}</span> to{" "}
                            <span className="text-white font-bold">{Math.min(lastDashIdx, scholarRecords.length)}</span> of{" "}
                            <span className="text-blue-400 font-bold">{scholarRecords.length}</span> results
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              disabled={currentScholarPage === 1}
                              onClick={() => setScholarPages(prev => ({ ...prev, [scholarName]: currentScholarPage - 1 }))}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed text-[11px]"
                            >
                              ◀ Prev
                            </button>
                            <span className="text-slate-400 px-2">
                              Page {currentScholarPage} of {Math.ceil(scholarRecords.length / dashboardItemsPerPage)}
                            </span>
                            <button
                              disabled={lastDashIdx >= scholarRecords.length}
                              onClick={() => setScholarPages(prev => ({ ...prev, [scholarName]: currentScholarPage + 1 }))}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed text-[11px]"
                            >
                              Next ▶
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* EXCEL IMPORT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-[#111E43] border border-slate-800 max-w-3xl w-full rounded-xl p-4 sm:p-5 shadow-xl relative">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Import Component Sheet</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">Expected columns: Sr No, Name of Component, Part No, Description, Manufacturer, Quantity, Package, Purchase Link, Unit Cost, Remark</p>
              </div>
              <button disabled={actionLoading} onClick={() => { setShowModal(false); setParsedItems([]); }} className="text-slate-400 hover:text-white text-lg px-2">&times;</button>
            </div>

            {parsedItems.length === 0 ? (
              <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-lg p-6 sm:p-8 text-center relative cursor-pointer bg-slate-900/40 transition-colors">
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                <p className="text-xs text-slate-300 font-semibold">Click or drag Excel file here</p>
                <p className="text-[10px] text-slate-500 mt-1">Ensure your sheet contains the required column headers.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recommendations.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-amber-400 font-bold text-xs flex items-center gap-1.5 mb-2">⚠️ Smart Suggestion: The following components are available in surplus!</p>
                    <div className="max-h-[120px] overflow-y-auto space-y-1 divide-y divide-amber-500/10 text-[11px]">
                      {recommendations.map((rec, i) => (
                        <div key={i} className="pt-1 text-slate-300 flex justify-between items-center">
                          <span>📦 <strong className="text-white">{rec.componentName || rec.name}</strong></span>
                          <span className="text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{rec.leftoverQty} units with {rec.requestedBy}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-slate-900/60 rounded-lg border border-slate-800 max-h-[220px] overflow-y-auto divide-y divide-slate-800">
                  {parsedItems.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between items-start text-[11px] gap-4">
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-white font-semibold">{item.componentName}</p>
                        {item.partNo && <p className="text-slate-500 font-mono">Part: {item.partNo}</p>}
                        {item.manufacturer && <p className="text-slate-500">Mfr: {item.manufacturer}</p>}
                        {item.description && <p className="text-slate-600 truncate">{item.description}</p>}
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="text-xs font-mono text-blue-400 font-bold">Qty: {item.quantity}</div>
                        <div className="text-slate-500 font-mono">{item.unitCost}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <button disabled={actionLoading} onClick={() => setParsedItems([])} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">Reset</button>
                  <button
                    disabled={actionLoading}
                    onClick={handleFinalSubmission}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2"
                  >
                    {actionLoading ? 'Uploading Registry...' : 'Submit Batch'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Consumables;