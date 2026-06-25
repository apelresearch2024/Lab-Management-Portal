import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

function Stocks({ user }) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [parsedItems, setParsedItems] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Performance Scaling Variables (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15; // Controls maximum table elements loaded into DOM simultaneously

  const token = localStorage.getItem('labPortalToken');

  // Foolproof GPT Prompt text for user reference
  const gptPromptText = `Extract all components and items from this invoice data. Format the output directly into a clean spreadsheet structure with exactly these 5 columns:

1. Component Name (Full descriptive item title)
2. Part Number (Manufacturer code/SKU, use "—" if not present)
3. Manufacturer (Brand/Make name, use "—" if unknown)
4. Quantity (Clean numerical count integer only)
5. Ordered By (Name of the researcher or scholar who made the purchase)

Ensure there are no extraneous text introductions or summaries. Respond only with the spreadsheet-compatible rows data table.`;

  // Automatically kick user back to page 1 during live keyword queries to avoid empty view states
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stocks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStockItems(data);
      } else {
        toast.error('Failed to sync master stock logs.');
      }
    } catch (err) {
      toast.error('Network translation error syncing stock database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, []);

  const handleQtyAdjustment = async (srNo, incrementValue) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stocks/adjust`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ srNo, increment: incrementValue })
      });
      if (response.ok) {
        setStockItems(prev => prev.map(item => 
          item.srNo === srNo ? { ...item, quantity: Math.max(0, item.quantity + incrementValue) } : item
        ));
      } else {
        toast.error('Could not modify structural stock allocation values.');
      }
    } catch (err) {
      toast.error('Network connection timeout during item correction.');
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const binaryString = evt.target.result;
        const workbook = XLSX.read(binaryString, { type: 'binary' });
        const targetSheet = workbook.Sheets[workbook.SheetNames[0]];
        const dataRows = XLSX.utils.sheet_to_json(targetSheet);

        if (dataRows.length === 0) {
          toast.warning('The uploaded invoice sheet profile holds no rows.');
          return;
        }

        const matchHeaderValue = (row, headings) => {
          for (let header of headings) {
            if (row[header] !== undefined) return row[header];
            let matchingKey = Object.keys(row).find(k => k.trim().toLowerCase() === header.toLowerCase());
            if (matchingKey) return row[matchingKey];
          }
          return '';
        };

        const convertedRows = dataRows.map((row, index) => {
          const matchedName = matchHeaderValue(row, ['Component Name', 'Item Name', 'Item Description', 'Name', 'Component', 'Item']);
          return {
            id: index + 1,
            componentName: matchedName || 'Unknown Inventory Component',
            partNo: matchHeaderValue(row, ['Part No', 'Part Number', 'Part#', 'PartNo']) || '—',
            manufacturer: matchHeaderValue(row, ['Manufacturer', 'Mfr', 'Brand', 'Make']) || '—',
            quantity: parseInt(matchHeaderValue(row, ['Quantity', 'Qty', 'Units', 'Count'])) || 1,
            orderedBy: matchHeaderValue(row, ['Ordered By', 'Scholar Name', 'Scholar', 'Buyer', 'Requested By'])
          };
        });

        setParsedItems(convertedRows);
        toast.info(`Interpreted ${dataRows.length} item lines from structural spreadsheet payload.`);
      } catch (err) {
        toast.error('Failed processing data matrices within the document.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const submitBatchToRegistry = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stocks/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          items: parsedItems.map(it => ({ ...it, threshold: 0, remark: '—' })), 
          fallbackScholar: user?.name 
        })
      });
      if (response.ok) {
        toast.success('Invoice assets logged seamlessly to inventory stocks grid!');
        setParsedItems([]);
        setShowUploadModal(false);
        fetchStocks();
      } else {
        toast.error('The server rejected database log additions.');
      }
    } catch (err) {
      toast.error('Transmission fault processing data stream updates.');
    } finally {
      setActionLoading(false);
    }
  };

  // 1. FILTERING & SORTING LAYER (Forces newest Sr No items to the top index)
  const sortedAndFilteredStocks = stockItems
    .filter(item => {
      const term = searchQuery.toLowerCase().trim();
      if (!term) return true;
      return (
        item.componentName.toLowerCase().includes(term) ||
        item.partNo.toLowerCase().includes(term) ||
        item.manufacturer.toLowerCase().includes(term) ||
        item.orderedBy.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => b.srNo - a.srNo); // Newest items on top assignment tracking

  // 2. PAGINATION MATHEMATICS SLICE LAYER
  const totalPages = Math.ceil(sortedAndFilteredStocks.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDisplayedStocks = sortedAndFilteredStocks.slice(indexOfFirstItem, indexOfLastItem);

  const copyPromptToClipboard = () => {
    navigator.clipboard.writeText(gptPromptText);
    toast.success('GPT Invoice Prompt copied to clipboard!');
  };

  return (
    <div className="space-y-4 w-full max-w-[1600px] mx-auto text-slate-200 p-4">
      {/* Upper Navigation Layer Block Container */}
      <div className="bg-[#0b132b] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide">📦 Centralized Lab Stock Inventory</h1>
          <p className="text-xs text-slate-400">Direct invoice parser and real-time ledger count controls.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Filter stock components..."
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 transition-colors placeholder-slate-500 w-full sm:w-64"
          />
          <button
            onClick={() => setShowUploadModal(true)}
            className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-xs font-bold text-white rounded-lg transition-all shadow-md flex items-center justify-center gap-2"
          >
            📥 Upload GPT Invoice Excel
          </button>
        </div>
      </div>

      {/* Main Stock Inventory Ledger Frame */}
      {loading ? (
        <div className="text-center py-12 text-xs font-mono text-slate-400 animate-pulse">Loading stock records...</div>
      ) : sortedAndFilteredStocks.length === 0 ? (
        <div className="bg-[#111E43] border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400 italic">
          No stock reference materials mapped within the current filter configuration context.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-[#111E43] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse" style={{ minWidth: '1000px' }}>
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                    <th className="px-5 py-3.5" style={{ width: '90px' }}>Ref ID</th>
                    <th className="px-5 py-3.5" style={{ width: '320px' }}>Component Name</th>
                    <th className="px-5 py-3.5" style={{ width: '180px' }}>Part Number</th>
                    <th className="px-5 py-3.5" style={{ width: '180px' }}>Manufacturer</th>
                    <th className="px-5 py-3.5 text-center" style={{ width: '200px' }}>Current Stock Qty</th>
                    <th className="px-5 py-3.5" style={{ width: '180px' }}>Custodian (Ordered By)</th>
                    <th className="px-5 py-3.5 text-right" style={{ width: '150px' }}>Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-xs text-slate-300">
                  {currentDisplayedStocks.map((item) => (
                    <tr key={item.srNo} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-5 py-4 font-mono font-semibold text-slate-500">#{item.srNo}</td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">{item.componentName}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-400">{item.partNo}</td>
                      <td className="px-5 py-4 text-slate-400">{item.manufacturer}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleQtyAdjustment(item.srNo, -1)}
                            className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded flex items-center justify-center border border-slate-700 active:scale-95 transition-all"
                          >
                            -
                          </button>
                          <div className="w-16 text-center">
                            <span className="text-sm font-mono font-bold text-emerald-400">
                              {item.quantity}
                            </span>
                          </div>
                          <button
                            onClick={() => handleQtyAdjustment(item.srNo, 1)}
                            className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded flex items-center justify-center border border-slate-700 active:scale-95 transition-all"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-purple-300 font-medium">{item.orderedBy}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-500 text-[11px]">{item.dateAdded}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* HIGH PERFORMANCE UX PAGINATION ACTIONS BAR */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-[#0b132b] border border-slate-800/80 rounded-xl px-4 py-2.5 shadow-md">
              <span className="text-[11px] text-slate-400 font-mono">
                Showing entries <strong className="text-slate-200">{indexOfFirstItem + 1}</strong> to <strong className="text-slate-200">{Math.min(indexOfLastItem, sortedAndFilteredStocks.length)}</strong> of <strong className="text-purple-400">{sortedAndFilteredStocks.length}</strong> total items
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-300"
                >
                  ◀ Previous
                </button>
                <div className="text-xs font-mono px-3 text-slate-400">
                  Page <strong className="text-white">{currentPage}</strong> / {totalPages}
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-300"
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice Document Parsing Upload Overlay Modal Context Frame */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b132b] border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">📥 Log Stock Inventory from Invoice Document</h3>
              <button onClick={() => { setShowUploadModal(false); setParsedItems([]); }} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* CONDITION: ONLY SHOW PROMPT & DROPBOX IF NO SHEET HAS BEEN LOADED YET */}
              {parsedItems.length === 0 ? (
                <>
                  {/* Bulletproof Copyable Prompt System Layer */}
                  <div className="bg-slate-950/80 border border-purple-900/40 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider font-mono">📋 Step 1: Copy ChatGPT Conversion Prompt</span>
                      <button 
                        onClick={copyPromptToClipboard}
                        className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 text-[10px] rounded font-bold transition-all"
                      >
                        Copy Prompt 📄
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 italic bg-slate-900/60 p-2.5 rounded border border-slate-800/60 font-mono select-all whitespace-pre-line leading-normal">
                      {gptPromptText}
                    </p>
                  </div>

                  {/* Drop zone wrapper component frame */}
                  <div className="border-2 border-dashed border-slate-800 hover:border-purple-500/50 rounded-xl p-6 text-center transition-colors relative bg-slate-950/40">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleExcelUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <span className="text-2xl block mb-1">📊</span>
                    <span className="text-xs font-semibold text-slate-300 block">Step 2: Drag & Drop Generated Spreadsheet here</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-1 block">Successfully maps: Name, Part Number, Qty, and Ordered By</span>
                  </div>
                </>
              ) : (
                /* CHOSEN ALTERNATE VIEW: SHOW ONLY PARSED RESULTS MATRIX LOG OUTLINE */
                <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 animate-fadeIn">
                  <div className="text-[11px] uppercase font-bold text-purple-400 tracking-wider flex justify-between items-center">
                    <span>Parsed Invoice Rows Output Ledger ({parsedItems.length} items):</span>
                    <button 
                      onClick={() => setParsedItems([])} 
                      className="text-[10px] text-rose-400 hover:underline tracking-tight normal-case font-mono"
                    >
                      ✕ Clear / Upload Another File
                    </button>
                  </div>
                  <div className="divide-y divide-slate-800 max-h-[350px] overflow-y-auto border border-slate-800/50 rounded-lg bg-[#0b132b]/40">
                    {parsedItems.map((item) => (
                      <div key={item.id} className="p-2.5 flex items-start justify-between gap-4 text-xs">
                        <div>
                          <p className="font-semibold text-slate-200">{item.componentName}</p>
                          <div className="flex gap-3 text-[10px] text-slate-500 font-mono mt-0.5">
                            {item.partNo && <span>Part: {item.partNo}</span>}
                            {item.manufacturer && <span>Mfr: {item.manufacturer}</span>}
                            <span>Buyer: <strong className="text-purple-400/80 font-medium">{item.orderedBy || user?.name}</strong></span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-purple-400 font-mono">Qty: {item.quantity}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-4 shrink-0">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => { setShowUploadModal(false); setParsedItems([]); }}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || parsedItems.length === 0}
                onClick={submitBatchToRegistry}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg transition-all shadow-md"
              >
                {actionLoading ? 'Saving Asset Registry rows...' : 'Commit Stock Ledger Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stocks;