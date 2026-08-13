/**
 * Test script to verify API Chatbot handler locally
 */
import handler from '../api/chat.js';
import dotenv from 'dotenv';
dotenv.config();

async function runMockTest() {
  console.log('--- Testing Tableau AI Chatbot Logic ---');

  const mockReq = {
    method: 'POST',
    body: {
      dashboardName: 'Executive Performance Dashboard',
      sheetsData: [
        {
          worksheetName: 'Data Penumpang Mentah',
          columns: ['Tahun', 'Wilayah', 'Kategori', 'Total Penumpang'],
          rows: [
            ['2025', 'Jakarta Pusat', 'Layanan Publik', '4500'],
            ['2025', 'Jakarta Selatan', 'Layanan Publik', '5000'],
            ['2026', 'Jakarta Pusat', 'Layanan Publik', '4800'],
            ['2026', 'Jakarta Selatan', 'Layanan Publik', '5300']
          ]
        }
      ],
      // Question is about 2026, which is in the raw dataset!
      message: 'Wilayah mana yang memiliki total penumpang tertinggi di tahun 2026?',
      chatHistory: [
        { role: 'user', content: 'Halo!' },
        { role: 'model', content: 'Halo! Saya asisten data Anda. Ada yang bisa saya bantu?' }
      ]
    }
  };

  let statusCode = 200;
  const headers = {};

  const mockRes = {
    setHeader: (k, v) => { headers[k] = v; },
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          console.log(`[Response Status]: ${statusCode}`);
          console.log('[Response Data]:', JSON.stringify(data, null, 2));
        },
        end: () => console.log(`[Response End]: ${statusCode}`)
      };
    }
  };

  await handler(mockReq, mockRes);
}

runMockTest().catch(console.error);
