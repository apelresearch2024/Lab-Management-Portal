import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

export const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getGoogleAuth = () => {
 
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
      scopes: ['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive.file'],
    });
  }
  
  return new google.auth.GoogleAuth({
    credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
    scopes: ['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive.file'],
  });
};

const auth = getGoogleAuth();

export async function getSheetsInstance() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}