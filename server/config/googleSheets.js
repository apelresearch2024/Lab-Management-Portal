import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

export const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// Core Node.js helper operations computed safely at top-level file scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getGoogleAuth = () => {
  // If cloud production environment variable exists, parse it directly
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  
  // Otherwise, use the local file fallback directory path
  return new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

const auth = getGoogleAuth();

export async function getSheetsInstance() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}