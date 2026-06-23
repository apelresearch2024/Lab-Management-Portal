import jwt from 'jsonwebtoken';
import { getSheetsInstance, SPREADSHEET_ID } from '../config/googleSheets.js';

const otpCache = new Map();

const determineRole = (email) => {
  return email.toLowerCase() === process.env.PROFESSOR_EMAIL.toLowerCase() 
    ? 'Professor' 
    : 'Scholar';
};

export async function requestOTP(req, res) {
  const { email } = req.body;

  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2:B', 
    });

    const rows = response.data.values || [];
    const userRow = rows.find(row => row[1]?.toLowerCase() === email?.toLowerCase());

    if (!userRow) {
      return res.status(404).json({ message: 'Email not registered in Lab Portal.' });
    }

    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = Date.now() + 5 * 60 * 1000;

    otpCache.set(email.toLowerCase(), { otp: generatedOTP, expiresAt: expiryTime });

    // 🚀 Hits your Google Apps Script Deployment via standard web port 443
    const relayResponse = await fetch(process.env.EMAIL_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject: 'Your Lab Portal Verification Login OTP',
        htmlBody: `<h3>EE Lab Management Portal</h3>
               <p>Use the following secure OTP passcode to access your dashboard profile:</p>
               <h1 style="color: #2563eb; letter-spacing: 2px;">${generatedOTP}</h1>
               <p>This passkey is valid for 5 minutes.</p>`
      })
    });

    if (!relayResponse.ok) {
      throw new Error(`Google Relay responded with status code: ${relayResponse.status}`);
    }

    res.json({ success: true, message: 'OTP dispatched successfully via Google Relay.' });
  } catch (error) {
    console.error('❌ ERROR IN REQUEST_OTP:', error);
    res.status(500).json({ message: 'Failed to process OTP.', error: error.message });
  }
}

export async function verifyOTP(req, res) {
  const { email, otp } = req.body;
  const cachedData = otpCache.get(email?.toLowerCase());

  if (!cachedData) {
    return res.status(400).json({ message: 'No active verification records found.' });
  }

  if (Date.now() > cachedData.expiresAt) {
    otpCache.delete(email.toLowerCase());
    return res.status(400).json({ message: 'Verification code has expired.' });
  }

  if (cachedData.otp !== otp) {
    return res.status(401).json({ message: 'Incorrect OTP authentication code.' });
  }

  try {
    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2:B',
    });

    const rows = response.data.values || [];
    const userRow = rows.find(row => row[1] && row[1].toLowerCase() === email.toLowerCase());

    if (!userRow) {
      return res.status(404).json({ message: 'Authentication profile vanished from spreadsheet.' });
    }

    otpCache.delete(email.toLowerCase());
    const assignedRole = determineRole(email);

    const userPayload = {
      name: userRow[0] || 'Unknown Scholar',
      email: userRow[1],
      role: assignedRole,
    };

    const secretKey = process.env.JWT_SECRET || 'temporary_emergency_secret_key_2026';
    const accessToken = jwt.sign(userPayload, secretKey, { expiresIn: '24h' });

    res.json({ success: true, token: accessToken, user: userPayload });
  } catch (error) {
    console.error('CRITICAL CRASH INSIDE VERIFY_OTP:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

export async function addScholar(req, res) {
  const { scholarName, scholarEmail } = req.body;
  try {
    const sheets = await getSheetsInstance();
    const newScholarRow = [scholarName, scholarEmail.toLowerCase()];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newScholarRow] },
    });
    res.json({ success: true, message: `Scholar ${scholarName} registered.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed appending student record.' });
  }
}