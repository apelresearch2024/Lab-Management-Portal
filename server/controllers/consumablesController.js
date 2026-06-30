import { getSheetsInstance, SPREADSHEET_ID } from '../config/googleSheets.js';

const sendEmailNotification = async (toEmail, subject, textContent) => {
  if (!toEmail) return;
  try {
    const response = await fetch(process.env.EMAIL_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: toEmail,
        subject: subject,
        htmlBody: `<p style="font-family: sans-serif; white-space: pre-line; line-height: 1.6; color: #333;">${textContent}</p>`
      })
    });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    console.log(`🚀 Automated alert routed via Google Relay to ${toEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${toEmail} via Relay:`, error.message);
  }
};

const PROFESSOR_EMAIL = process.env.PROFESSOR_EMAIL;

export async function getConsumables(req, res) {
  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Consumables!A2:Q',
    });
    const rows = response.data.values || [];
    const structuredInventory = rows.map((row) => {
      const nameVal = row[1] || 'Unknown Item';
      const costVal = row[4] || 'N/A';
      return {
        srNo: row[0] || '—',
        name: nameVal,
        componentName: nameVal,
        quantity: parseInt(row[2]) || 0,
        leftoverQty: parseInt(row[3]) || 0,
        cost: costVal,
        unitCost: costVal,
        status: row[5] || 'Pending Approval',
        approvalDate: row[6] || '',
        orderDate: row[7] || '',
        receiveDate: row[8] || '',
        requestedBy: row[9] || 'Unknown Scholar',
        remark: row[10] || '',
        partNo: row[11] || '',
        description: row[12] || '',
        manufacturer: row[13] || '',
        package: row[14] || '',
        purchaseLink: row[15] || '',
        deliveredQty: (row[16] !== undefined && row[16] !== '') ? parseInt(row[16]) : '—',
      };
    });
    res.json(structuredInventory);
  } catch (error) {
    console.error('ERROR FETCHING CONSUMABLES LEDGER:', error);
    res.status(500).json({ message: 'Failed retrieving spreadsheet inventory matrix.' });
  }
}

export async function requestConsumables(req, res) {
  const { requests, scholarName } = req.body;

  try {
    const sheets = await getSheetsInstance();

    const currentData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Consumables!A2:A',
    });
    const startingSrNo = (currentData.data.values || []).length + 1;

    const rowsToAppend = requests.map((item, idx) => [
      startingSrNo + idx,                               // A: Sr No.
      item.name || item.componentName || 'Unknown Item', // B: Name of Item
      item.quantity || 1,                               // C: Quantity
      0,                                                // D: Leftover Qty
      item.cost || item.unitCost || 'N/A',              // E: Approx/Unit Cost
      'Pending Approval',                               // F: Status
      '',                                               // G: Approval Date
      '',                                               // H: Order Date
      '',                                               // I: Receive Date
      scholarName,                                      // J: Requested By
      item.remark || '',                                // K: Remarks
      item.partNo || '',                                // L: Part No
      item.description || '',                           // M: Description
      item.manufacturer || '',                          // N: Manufacturer
      item.package || '',                               // O: Package
      item.purchaseLink || '',                          // P: Purchase Link
      '',                                               //Q: Delivered Quantity
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Consumables!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: rowsToAppend },
    });

    const totalItems = requests.length;
    const emailSubject = `🚨 New Consumables Purchase Request Batch Submitted by ${scholarName}`;
    const emailBody = `Respected Sir,\n\nScholar "${scholarName}" has uploaded a new batch containing ${totalItems} consumable item request(s).\n\nPlease log into the Lab Portal dashboard to review.\n\nBest regards`;

    await sendEmailNotification(PROFESSOR_EMAIL, emailSubject, emailBody);
    res.json({ success: true, message: 'Requests loaded into database.' });
  } catch (error) {
    console.error('ERROR BATCH WRITING CONSUMABLES:', error);
    res.status(500).json({ message: 'Failed to upload rows.' });
  }
}

export async function updateConsumableStatus(req, res) {
  const { srNos, updateType, dateValue, usedQty, itemRemarks, deliveredQty } = req.body;
  const userRole = req.user.role;

  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Consumables!A2:Q',
    });
    const rows = response.data.values || [];
    const updateOperations = [];

    for (const srNo of srNos) {
      // Find the exact row matching the sequence reference number
      const matchIndex = rows.findIndex(row => row[0]?.toString().trim() === srNo?.toString().trim());
      if (matchIndex === -1) continue;

      const rowIndex = matchIndex + 2; // Range shifts accounting for index alignment
      const currentRow = rows[matchIndex];

      // Handle item remarks persistence updates
      if (itemRemarks && itemRemarks[srNo] !== undefined) {
        updateOperations.push({ range: `Consumables!K${rowIndex}`, values: [[itemRemarks[srNo]]] });
      }

      if (updateType === 'Reject') {
        updateOperations.push({ range: `Consumables!F${rowIndex}`, values: [['Rejected']] });
        continue;
      }

      // Professor Rules Engine
      if (userRole === 'Professor') {
        if (updateType === 'Approve') {
          updateOperations.push({ range: `Consumables!F${rowIndex}:G${rowIndex}`, values: [['Approved', dateValue]] });
        } else if (updateType === 'Order') {
          updateOperations.push({ range: `Consumables!F${rowIndex}`, values: [['Ordered']] });
          updateOperations.push({ range: `Consumables!H${rowIndex}`, values: [[dateValue]] });
        }
      } 
      
      // Scholar Rules Engine
      else if (userRole === 'Scholar') {
        if (updateType === 'Order') {
          updateOperations.push({ range: `Consumables!F${rowIndex}`, values: [['Ordered']] });
          updateOperations.push({ range: `Consumables!H${rowIndex}`, values: [[dateValue]] });
        } else if (updateType === 'Receive') {
          updateOperations.push({ range: `Consumables!F${rowIndex}`, values: [['Received']] });
          updateOperations.push({ range: `Consumables!I${rowIndex}`, values: [[dateValue]] });
          
          const finalDeliveredQty = parseInt(deliveredQty) || 0;
          updateOperations.push({ range: `Consumables!Q${rowIndex}`, values: [[finalDeliveredQty]] });
          
          // Initial receipt sets remaining stock pool equivalent to delivered pool
          updateOperations.push({ range: `Consumables!D${rowIndex}`, values: [[finalDeliveredQty]] });
        } 
        
        // Handling the initial component consumption declaration
        else if (updateType === 'MarkLeftover') {
          // Delivered quantity is index 16 (Column Q), fallback to requested quantity index 2 (Column C)
          const totalDelivered = parseInt(currentRow[16]) || parseInt(currentRow[2]) || 0;
          const totalUsed = parseInt(usedQty) || 0;
          
          // Equation: Delivered Quantity - Used Quantity = Leftover Quantity
          const computedLeftover = Math.max(0, totalDelivered - totalUsed);

          updateOperations.push({ range: `Consumables!D${rowIndex}`, values: [[computedLeftover]] });
          const newStatus = computedLeftover === 0 ? 'Distributed' : 'Surplus/Unused';
          updateOperations.push({ range: `Consumables!F${rowIndex}`, values: [[newStatus]] });
        } 
        
        // Deducting further usage values from the existing surplus pool
        else if (updateType === 'UpdateLeftoverQty') {
          const currentLeftover = parseInt(currentRow[3]) || 0; // Index 3 corresponds to Column D (Leftover Qty)
          const batchUsed = parseInt(usedQty) || 0;
          
          // Deduct newly used units from the remaining pool
          const computedLeftover = Math.max(0, currentLeftover - batchUsed);

          updateOperations.push({ range: `Consumables!D${rowIndex}`, values: [[computedLeftover]] });
          const newStatus = computedLeftover === 0 ? 'Distributed' : 'Surplus/Unused';
          updateOperations.push({ range: `Consumables!F${rowIndex}`, values: [[newStatus]] });
        }
      }
    }

    if (updateOperations.length === 0) {
      return res.status(400).json({ success: false, message: 'No matching records found.' });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { valueInputOption: 'USER_ENTERED', data: updateOperations },
    });

    res.json({ success: true, message: 'Inventory balances calculated and synchronized.' });
  } catch (error) {
    console.error('ERROR UPDATING CONSUMABLE LIFECYCLE:', error);
    res.status(500).json({ message: 'Internal server error processing inventory matrix.' });
  }
}