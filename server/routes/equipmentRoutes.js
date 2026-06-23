import express from 'express';
import { getSheetsInstance, SPREADSHEET_ID } from '../config/googleSheets.js';
import { authenticateToken } from '../middleware/authMiddleWare.js';

const router = express.Router();

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
    console.log(`Email successfully dispatched via Google Relay to ${toEmail}`);
  } catch (error) {
    console.error(`Failed to send email to ${toEmail} via Relay:`, error.message);
  }
};

const PROFESSOR_EMAIL = process.env.PROFESSOR_EMAIL || 'professor@institution.edu';

// 1. GET ALL EQUIPMENTS
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Equipments!A2:F',
    });
    const rows = response.data.values || [];
    const formatted = rows.map(row => ({
      id: row[0] || '—',
      partNo: row[1] || '—',
      name: row[2] || 'Unknown Item',
      currentHolder: row[3] || '',
      status: row[4] || 'Available',
      holderEmail: row[5] || ''
    }));
    res.json(formatted);
  } catch (error) {
    console.error('ERROR FETCHING EQUIPMENTS MATRIX:', error);
    res.status(500).json({ message: 'Error retrieving inventory layout.' });
  }
});

// 2. GET ALL WORKFLOW REQUESTS LOGS
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'EquipmentRequests!A2:H',
    });
    const rows = response.data.values || [];
    const formattedRequests = rows.map(row => ({
      id: row[0],
      equipmentId: row[1],
      requestedBy: row[2],
      requesterEmail: row[3],
      duration: row[4],
      status: row[5],
      equipmentHolder: row[6],
      holderEmail: row[7]
    }));
    res.json(formattedRequests);
  } catch (error) {
    console.error('ERROR FETCHING EQUIPMENT REQUESTS:', error);
    res.status(500).json({ message: 'Error retrieving multi-tier workflow requests.' });
  }
});

// 3. FILE A NEW ROUTED ASSET REQUEST
router.post('/request', authenticateToken, async (req, res) => {
  const { equipmentId, duration } = req.body; 
  const { name: requesterName, email: requesterEmail } = req.user;

  if (!equipmentId || !duration) {
    return res.status(400).json({ message: 'Asset identification and duration attributes are mandatory.' });
  }

  try {
    const sheets = await getSheetsInstance();
    const eqResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Equipments!A2:F',
    });
    const eqRows = eqResponse.data.values || [];
    const eqRowIndex = eqRows.findIndex(row => row[0]?.toString().trim() === equipmentId.trim());

    if (eqRowIndex === -1) {
      return res.status(404).json({ message: 'Target hardware asset not found in database registry.' });
    }

    const equipmentRow = eqRows[eqRowIndex];
    const currentHolder = equipmentRow[3] || '';
    const currentStatus = equipmentRow[4] || 'Available';
    const holderEmail = equipmentRow[5] || '';
    const eqSheetRowNumber = eqRowIndex + 2;

    const requestId = `REQ_${Date.now()}`;
    let requestStatus = '';
    let responseMessage = '';

    if (currentStatus === 'Reported Fault' || currentStatus === 'Maintenance') {
      return res.status(400).json({
        message: `Booking rejected. This item is currently flagged as "${currentStatus}" and cannot accept allocation requests.`
      });
    }

    if (currentStatus === 'Available') {
      if (duration === 'Short') {
        requestStatus = 'Approved';
        responseMessage = `Short duration request processed. Equipment "${equipmentId}" is now allocated to you.`;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Equipments!D${eqSheetRowNumber}:F${eqSheetRowNumber}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [[requesterName, 'In Use', requesterEmail]] }
        });
        await sendEmailNotification(
          requesterEmail,
          `Asset Request Auto-Approved: ${equipmentId}`,
          `Hello ${requesterName},\n\nYour short duration assignment request for "${equipmentId}" has been auto-approved since the pool item was available. You are now the official registered holder.`
        );
      } else {
        requestStatus = 'Pending Professor Approval';
        responseMessage = `Long duration request filed. Awaiting Professor authorization.`;
        await sendEmailNotification(
          PROFESSOR_EMAIL,
          `Action Required: Long-Term Allocation Request - ${equipmentId}`,
          `Respected Sir,\n\nScholar ${requesterName} has requested a long-duration lease allocation for the available asset "${equipmentId}". Please log in to the portal's Requests Center to accept or reject this workflow request.`
        );
      }
    } else {
      requestStatus = 'Pending Holder Approval';
      responseMessage = `Asset is currently held by ${currentHolder}. Request routed to their active queue for clearance.`;
      await sendEmailNotification(
        holderEmail,
        `Action Required: Asset Transfer Request - ${equipmentId}`,
        `Hello ${currentHolder},\n\nScholar ${requesterName} has requested a ${duration}-term transfer for the item currently in your custody ("${equipmentId}"). Please log into your lab dashboard's Requests Center to accept or decline this asset release request.`
      );
    }

    const newRequestRow = [
      requestId, equipmentId, requesterName, requesterEmail, duration, requestStatus, currentHolder || 'None (Pool)', holderEmail || ''
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'EquipmentRequests!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newRequestRow] },
    });

    res.json({ success: true, message: responseMessage });
  } catch (error) {
    console.error('WORKFLOW ROUTING POST ERROR:', error);
    res.status(500).json({ message: 'Pipeline failure executing structural sheet updates.' });
  }
});

// 4. ACTION PROCESSOR
router.put('/requests/:id/action', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; 
  const { name: actorName, role: actorRole } = req.user;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: 'Invalid pipeline action type execution requested.' });
  }

  try {
    const sheets = await getSheetsInstance();
    const reqResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'EquipmentRequests!A2:H',
    });
    const reqRows = reqResponse.data.values || [];
    const reqRowIndex = reqRows.findIndex(row => row[0]?.toString().trim() === id.trim());

    if (reqRowIndex === -1) {
      return res.status(404).json({ message: 'Target workflow tracking record not found.' });
    }

    const currentReq = reqRows[reqRowIndex];
    const reqSheetRowNumber = reqRowIndex + 2;

    const equipmentId = currentReq[1];
    const requesterName = currentReq[2];
    const requesterEmail = currentReq[3];
    const duration = currentReq[4];
    const currentStatus = currentReq[5];
    const equipmentHolder = currentReq[6];
    const holderEmail = currentReq[7];

    const eqResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Equipments!A2:F',
    });
    const eqRows = eqResponse.data.values || [];
    const eqRowIndex = eqRows.findIndex(row => row[0]?.toString().trim() === equipmentId.trim());
    const eqSheetRowNumber = eqRowIndex + 2;

    let updatedStatus = currentStatus;

    if (currentStatus === 'Pending Holder Approval') {
      if (actorName !== equipmentHolder && actorRole !== 'Professor') {
        return res.status(403).json({ message: 'Unauthorized. Only the current asset holder can clear this stage.' });
      }

      if (action === 'reject') {
        updatedStatus = 'Rejected by Holder';
        await sendEmailNotification(
          requesterEmail,
          `Asset Transfer Declined: ${equipmentId}`,
          `Hello ${requesterName},\n\nYour request to transfer equipment "${equipmentId}" has been declined by the current holder (${equipmentHolder}).`
        );
      } else if (action === 'approve') {
        if (duration === 'Short') {
          updatedStatus = 'Approved';
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Equipments!D${eqSheetRowNumber}:F${eqSheetRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[requesterName, 'In Use', requesterEmail]] }
          });
          await sendEmailNotification(
            requesterEmail,
            `Asset Request Approved: ${equipmentId}`,
            `Hello ${requesterName},\n\nGreat news! ${equipmentHolder} has authorized the transfer of "${equipmentId}". Since this is a short duration framework, you are now registered as the active custodian.`
          );
        } else {
          updatedStatus = 'Pending Professor Approval';
          await sendEmailNotification(
            PROFESSOR_EMAIL,
            `Action Required: Sequential Transfer Request - ${equipmentId}`,
            `Respected Sir,\n\nA long duration transfer request for "${equipmentId}" from Scholar ${requesterName} has been ACCEPTED by the current holder (${equipmentHolder}). It now requires your final sign-off in the portal.`
          );
        }
      }
    } else if (currentStatus === 'Pending Professor Approval') {
      if (actorRole !== 'Professor') {
        return res.status(403).json({ message: 'Access Denied. Only professors can validate this decision step.' });
      }

      if (action === 'reject') {
        updatedStatus = 'Rejected by Professor';
        await sendEmailNotification(
          requesterEmail,
          `Asset Request Rejected: ${equipmentId}`,
          `Hello ${requesterName},\n\nYour long duration request for "${equipmentId}" has been rejected by the Professor.`
        );
      } else if (action === 'approve') {
        updatedStatus = 'Approved';
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Equipments!D${eqSheetRowNumber}:F${eqSheetRowNumber}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [[requesterName, 'In Use', requesterEmail]] }
        });
        await sendEmailNotification(
          requesterEmail,
          `Asset Request Fully Approved: ${equipmentId}`,
          `Hello ${requesterName},\n\nYour long duration request for "${equipmentId}" has been fully approved by the Professor. The asset records have been registered under your name.`
        );
      }
    } else {
      return res.status(400).json({ message: 'This request workflow loop is already closed or finalized.' });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `EquipmentRequests!F${reqSheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[updatedStatus]] }
    });

    res.json({ success: true, message: `Workflow escalated successfully. Current status: ${updatedStatus}` });
  } catch (error) {
    console.error('WORKFLOW MUTATION ENGINE ACTION ERROR:', error);
    res.status(500).json({ message: 'Failed writing step verification shifts to core database.' });
  }
});

// 5. REGISTER NEW EQUIPMENT
router.post('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Professor') {
    return res.status(403).json({ message: 'Access denied. Only professors are permitted to catalog new lab equipment assets.' });
  }
  const { id, partNo, name } = req.body;
  if (!id || id.trim() === '') return res.status(400).json({ message: 'Equipment No asset entry is mandatory.' });
  if (!name || name.trim() === '') return res.status(400).json({ message: 'Product Description field is mandatory.' });

  try {
    const sheets = await getSheetsInstance();
    const idCheck = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Equipments!A2:A',
    });
    const rows = idCheck.data.values || [];
    const idExists = rows.some(row => row[0]?.toString().trim().toLowerCase() === id.trim().toLowerCase());

    if (idExists) return res.status(400).json({ message: `Equipment No "${id}" already exists.` });

    const newEquipmentRow = [id.trim(), partNo ? partNo.trim() : '—', name.trim(), '', 'Available', ''];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Equipments!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newEquipmentRow] },
    });
    res.json({ success: true, message: `Equipment "${id}" successfully registered.` });
  } catch (error) {
    console.error('EQUIPMENT APPEND ERROR:', error);
    res.status(500).json({ message: 'Failed writing asset cell records.' });
  }
});

// 6. MUTATE EQUIPMENT STATUS & ROUTE FAULTS TO REQUEST CENTER
router.put('/status', authenticateToken, async (req, res) => {
  const { id, status } = req.body;
  const { name: scholarName, email: scholarEmail } = req.user;

  if (!id || !status) return res.status(400).json({ message: 'Missing required parameters.' });

  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Equipments!A2:F',
    });
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === id.toString().trim());

    if (rowIndex === -1) return res.status(404).json({ message: 'Asset not found.' });

    const existingRow = rows[rowIndex];
    const currentHolderName = existingRow[3] || '';
    const sheetRowNumber = rowIndex + 2;

    let updatedHolder = '';
    let updatedEmail = '';

    if (status === 'In Use') {
      updatedHolder = scholarName;
      updatedEmail = scholarEmail;
    } else if (status === 'Available') {
      if (currentHolderName !== scholarName && req.user.role !== 'Professor') {
        return res.status(403).json({ message: 'Unauthorized release action.' });
      }
    } else if (status === 'Reported Fault') {
      // Security: Only the current holder or the Professor can report a fault
      if (currentHolderName !== scholarName && req.user.role !== 'Professor') {
        return res.status(403).json({ message: 'Unauthorized fault report.' });
      }
      
      updatedHolder = currentHolderName;
      updatedEmail = existingRow[5] || '';
      const itemDescription = existingRow[2] || 'Unknown Item';

      // 1. Send Emergency Notification via Google Relay
      await sendEmailNotification(
        PROFESSOR_EMAIL,
        `⚠️ Emergency: Fault Reported on Equipment No. ${id}`,
        `Respected Sir,\n\nScholar "${scholarName}" has reported an operational fault on asset "${id}" (${itemDescription}).\n\nThe asset status has been moved automatically to "Reported Fault".`
      );

      // 2. ✅ NEW: Append this Fault report directly to the Request Center sheet
      const faultRequestId = `FAULT_${Date.now()}`;
      const faultRequestRow = [
        faultRequestId,                 // Column A: ID
        id.trim(),                      // Column B: Equipment ID
        scholarName,                    // Column C: Requested/Reported By
        scholarEmail,                   // Column D: Reporter Email
        'Fault Report',                 // Column E: Duration Field (Flagged as Fault)
        'Reported Fault',               // Column F: Status Field
        currentHolderName || 'None',    // Column G: Equipment Holder
        existingRow[5] || ''            // Column H: Holder Email
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'EquipmentRequests!A2',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [faultRequestRow] },
      });
      
      console.log(`🔧 Fault log ${faultRequestId} logged into Request Center.`);

    } else if (status === 'Maintenance') {
      if (req.user.role !== 'Professor') return res.status(403).json({ message: 'Access Denied.' });
      updatedHolder = currentHolderName;
      updatedEmail = existingRow[5] || '';
    }

    // Update main equipment row entry
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Equipments!D${sheetRowNumber}:F${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[updatedHolder, status, updatedEmail]] }
    });

    res.json({ success: true, message: `Asset status updated to ${status} and logged in tracking workflow.` });
  } catch (error) {
    console.error('ERROR MUTATING STATUS:', error);
    res.status(500).json({ message: 'Failed mutating equipment cells.' });
  }
});
// 7. DECOMMISSION EQUIPMENT
router.delete('/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Professor') return res.status(403).json({ message: 'Access Denied.' });
  const { id } = req.params;

  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Equipments!A2:A',
    });
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === id.trim());

    if (rowIndex === -1) return res.status(404).json({ message: 'Record not found.' });

    const targetSheetRowIndex = rowIndex + 1;
    const spreadsheetMetadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const matchSheet = spreadsheetMetadata.data.sheets.find(s => s.properties.title === 'Equipments');
    const sheetId = matchSheet ? matchSheet.properties.sheetId : 0;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: { sheetId: sheetId, dimension: 'ROWS', startIndex: targetSheetRowIndex, endIndex: targetSheetRowIndex + 1 }
          }
        }]
      }
    });
    res.json({ success: true, message: `Equipment No "${id}" removed permanently.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed deleting asset records.' });
  }
});

export default router;