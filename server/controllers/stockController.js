import { getSheetsInstance, SPREADSHEET_ID } from '../config/googleSheets.js';

// Retrieve all stock logs from the Stocks tab (Columns A to G)
export async function getStocks(req, res) {
  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Stocks!A2:G',
    });
    const rows = response.data.values || [];
    const structuredStocks = rows.map((row) => ({
      srNo: parseInt(row[0]) || 0,
      componentName: row[1] || 'Unknown Item',
      partNo: row[2] || '—',
      manufacturer: row[3] || '—',
      quantity: parseInt(row[4]) || 0,
      orderedBy: row[5] || 'Unknown Scholar',
      dateAdded: row[6] || '—'
    }));
    res.json(structuredStocks);
  } catch (error) {
    console.error('ERROR FETCHING STOCKS POOL:', error);
    res.status(500).json({ message: 'Failed retrieving spreadsheet stock registry.' });
  }
}

// Bulk insert stock records extracted from an invoice spreadsheet
export async function uploadStocks(req, res) {
  const { items, fallbackScholar } = req.body;
  try {
    const sheets = await getSheetsInstance();
    const currentData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Stocks!A2:A',
    });
    const currentRows = currentData.data.values || [];
    const startingSrNo = currentRows.length + 1;
    const dateToday = new Date().toLocaleDateString('en-IN');

    // Creates exactly 7 columns per line array match
    const rowsToAppend = items.map((item, idx) => [
      startingSrNo + idx,
      item.componentName || 'Unknown Item',
      item.partNo || '—',
      item.manufacturer || '—',
      parseInt(item.quantity) || 1,
      item.orderedBy || fallbackScholar || 'Unknown Scholar',
      dateToday
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Stocks!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: rowsToAppend },
    });

    res.json({ success: true, message: 'Stock items successfully updated into sheet registry.' });
  } catch (error) {
    console.error('ERROR BATCH WRITING STOCKS:', error);
    res.status(500).json({ message: 'Failed to insert invoice rows.' });
  }
}

// Increments or decrements a specific row cell instantly (Quantity remains at column E)
export async function adjustStockQuantity(req, res) {
  const { srNo, increment } = req.body; 
  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Stocks!A2:E',
    });
    const rows = response.data.values || [];
    
    const rowIndex = rows.findIndex(row => parseInt(row[0]) === parseInt(srNo));
    if (rowIndex === -1) {
      return res.status(404).json({ success: false, message: 'Stock entry reference record not found.' });
    }

    const targetSheetRow = rowIndex + 2; 
    const currentQty = parseInt(rows[rowIndex][4]) || 0;
    const computedQty = Math.max(0, currentQty + parseInt(increment));

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Stocks!E${targetSheetRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[computedQty]] },
    });

    res.json({ success: true, updatedQty: computedQty });
  } catch (error) {
    console.error('ERROR MUTATING STOCK COUNTS:', error);
    res.status(500).json({ message: 'Failed to update stock allocation count.' });
  }
}