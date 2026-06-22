import { getSheetsInstance, SPREADSHEET_ID } from '../config/googleSheets.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});
const sendEmailNotification = async (toEmail, subject, textContent) => {
  if (!toEmail) return;
  try {
    await transporter.sendMail({
      from: `"Lab Portal Notification" <${process.env.LAB_EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      text: textContent,
    });
  } catch (error) {
    console.error(`Failed to send email to ${toEmail}:`, error.message);
  }
};
const PROFESSOR_EMAIL = process.env.PROFESSOR_EMAIL || 'professor@institution.edu';

// 1. GET ALL CONSUMABLES 
export async function getConsumables(req, res) {
  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Consumables!A2:P',
    });

    const rows = response.data.values || [];

    const structuredInventory = rows.map((row) => {
      const nameVal = row[1] || 'Unknown Item';
      const costVal = row[4] || 'N/A';

      return {
        srNo: row[0] || '—',
        name: nameVal,
        componentName: nameVal,                // Map to both keys to protect layout
        quantity: parseInt(row[2]) || 0,
        leftoverQty: parseInt(row[3]) || 0,
        cost: costVal,
        unitCost: costVal,                     // Map to both keys to protect layout
        status: row[5] || 'Pending Approval',
        approvalDate: row[6] || '',
        orderDate: row[7] || '',
        receiveDate: row[8] || '',
        requestedBy: row[9] || 'Unknown Scholar',
        remark: row[10] || '',                  // Column K
        partNo: row[11] || '',                  // Column L
        description: row[12] || '',             // Column M
        manufacturer: row[13] || '',            // Column N
        package: row[14] || '',                 // Column O
        purchaseLink: row[15] || ''             // Column P
      };
    });

    res.json(structuredInventory);
  } catch (error) {
    console.error('ERROR FETCHING CONSUMABLES LEDGER:', error);
    res.status(500).json({ message: 'Failed retrieving spreadsheet inventory matrix.' });
  }
}


// 2. REQUEST CONSUMABLES
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
      item.cost || item.unitCost || 'N/A',            // E: Approx/Unit Cost
      'Pending Approval',                             // F: Status
      '',                                             // G: Approval Date
      '',                                             // H: Order Date
      '',                                             // I: Receive Date
      scholarName,                                    // J: Requested By
      item.remark || '',                              // K: Remarks
      item.partNo || '',                              // L: Part No
      item.description || '',                         // M: Description
      item.manufacturer || '',                        // N: Manufacturer
      item.package || '',                             // O: Package
      item.purchaseLink || ''                         // P: Purchase Link
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Consumables!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: rowsToAppend },
    });
    const totalItems = requests.length;
    const emailSubject = `🚨 New Consumables Purchase Request Batch Submitted by ${scholarName}`;
    const emailBody = `Respected Sir,\n\nScholar "${scholarName}" has uploaded a new batch containing ${totalItems} consumable item request(s) into the database registry.\n\nPlease log into the Lab Portal's dashboard and navigate to the Pending Queue to review, modify, or approve these entries.\n\nBest regards,\nLab Inventory Automated Engine`;

    await sendEmailNotification(PROFESSOR_EMAIL, emailSubject, emailBody);
    res.json({ success: true, message: 'Requests loaded into database with quantities.' });
  } catch (error) {
    console.error('ERROR BATCH WRITING CONSUMABLES:', error);
    res.status(500).json({ message: 'Failed to upload inventory rows.' });
  }
}


// 3. MUTATE CONSUMABLE STATUS 
export async function updateConsumableStatus(req, res) {
  const { srNos, updateType, dateValue, leftoverQty, itemRemarks } = req.body;
  const userRole = req.user.role;

  try {
    const sheets = await getSheetsInstance();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Consumables!A2:K',
    });
    const rows = response.data.values || [];

    const updateOperations = [];

    for (const srNo of srNos) {
      const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === srNo?.toString().trim()) + 2;
      if (rowIndex === 1) continue; 
      if (itemRemarks && itemRemarks[srNo] !== undefined) {
        updateOperations.push({
          range: `Consumables!K${rowIndex}`,
          values: [[itemRemarks[srNo]]],
        });
      }
      if (updateType === 'Reject') {
        updateOperations.push({
          range: `Consumables!F${rowIndex}`,
          values: [['Rejected']],
        });
        continue; 
      }
      if (userRole === 'Professor') {
        if (updateType === 'Approve') {
          updateOperations.push({
            range: `Consumables!F${rowIndex}:G${rowIndex}`,
            values: [['Approved', dateValue]],
          });
        }
        else if (updateType === 'Order') {
          updateOperations.push({
            range: `Consumables!F${rowIndex}`,
            values: [['Ordered']],
          });
          updateOperations.push({
            range: `Consumables!H${rowIndex}`,
            values: [[dateValue]],
          });
        }
      }
      else if (userRole === 'Scholar') {
        if (updateType === 'Order') {
          updateOperations.push({
            range: `Consumables!F${rowIndex}`,
            values: [['Ordered']],
          });
          updateOperations.push({
            range: `Consumables!H${rowIndex}`,
            values: [[dateValue]],
          });
        }
        else if (updateType === 'Receive') {
          updateOperations.push({
            range: `Consumables!F${rowIndex}`,
            values: [['Received']],
          });
          updateOperations.push({
            range: `Consumables!I${rowIndex}`,
            values: [[dateValue]],
          });
        }
        else if (updateType === 'MarkLeftover') {
          updateOperations.push({
            range: `Consumables!D${rowIndex}`,
            values: [[leftoverQty]],
          });
          updateOperations.push({
            range: `Consumables!F${rowIndex}`,
            values: [['Surplus/Unused']],
          });
        }
        else if (updateType === 'UpdateLeftoverQty') {
          updateOperations.push({
            range: `Consumables!D${rowIndex}`,
            values: [[leftoverQty]],
          });

          if (parseInt(leftoverQty) === 0) {
            updateOperations.push({
              range: `Consumables!F${rowIndex}`,
              values: [['Distributed']],
            });
          }
        }
      }
    }

    if (updateOperations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No matching records were updated. Verify that the update action type or item identifier is correct.'
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: updateOperations,
      },
    });

    res.json({ success: true, message: 'Ledger database states synchronized successfully.' });
  } catch (error) {
    console.error('ERROR UPDATING CONSUMABLE LIFECYCLE MATRIX:', error);
    res.status(500).json({ message: 'Failed modifying sheet inventory values.' });
  }
}