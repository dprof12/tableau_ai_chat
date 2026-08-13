import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

/**
 * Serverless Handler for Tableau AI Chat Q&A
 * Focuses on answering user questions interactively based on full datasource data.
 */
export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Silakan kirim request POST.'
    });
  }

  try {
    const {
      dashboardName = 'Dashboard Tableau',
      sheetsData = [],
      columns,
      rows,
      message,
      chatHistory = []
    } = req.body || {};

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Pesan user kosong.'
      });
    }

    // 2. Read Environment Variables
    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();
    const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'AI_API_KEY belum dikonfigurasi di Environment Variables Vercel.'
      });
    }

    // 3. Format Data Representation
    let formattedDataText = '';

    if (sheetsData && sheetsData.length > 0) {
      formattedDataText = sheetsData.map(sheet => {
        return `#### Tabel Data: ${sheet.worksheetName}\n` + buildTable(sheet.columns, sheet.rows);
      }).join('\n\n');
    } else if (columns && rows) {
      formattedDataText = `#### Tabel Data\n` + buildTable(columns, rows);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Tidak ada data dashboard yang diterima.'
      });
    }

    // 4. Construct System Prompt
    const systemPrompt = `Anda adalah Data Assistant Chatbot untuk dashboard Tableau '${dashboardName}'. Tugas Anda adalah menjawab pertanyaan user secara interaktif dan spesifik HANYA berdasarkan data dashboard yang disediakan berikut.

ATURAN UTAMA:
1. Jawab HANYA menggunakan data dari tabel di bawah ini. Jangan pernah menggunakan pengetahuan eksternal atau mengarang fakta/angka di luar data yang diberikan.
2. Jika data tidak memadai atau tidak ada untuk menjawab pertanyaan user, jawab dengan sopan bahwa data tersebut tidak tersedia di dalam dataset dashboard ini.
3. Berikan jawaban yang ramah, profesional, ringkas, dan langsung pada intinya.
4. Gunakan format markdown: **tebal** untuk metrik/angka kunci dan nama kategori penting, serta tabel markdown jika menyajikan perbandingan data agar mudah dibaca.
5. Jika user menyapa (misal: "Halo", "Selamat pagi"), jawablah dengan ramah dan tawarkan bantuan terkait analisis data dashboard ini.
6. Jika user bertanya tentang hal umum yang tidak ada hubungannya dengan data dashboard (misal: "Siapa presiden Indonesia?", "Bagaimana cuaca hari ini?"), jawablah dengan ramah bahwa Anda adalah asisten khusus untuk data dashboard ini dan tidak dapat menjawab pertanyaan di luar konteks tersebut.

DATASET DASHBOARD:
${formattedDataText}`;

    let replyText = '';

    // 5. Invoke LLM (Gemini or OpenAI)
    if (provider === 'openai') {
      const modelName = process.env.AI_MODEL || 'gpt-4o-mini';
      const openai = new OpenAI({ apiKey });

      // Convert chat history format from {role: 'model' | 'user'} to OpenAI format
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.content
        })),
        { role: 'user', content: message }
      ];

      const completion = await openai.chat.completions.create({
        model: modelName,
        messages: messages,
        temperature: 0.3
      });

      replyText = completion.choices[0]?.message?.content || '';
    } else {
      // Default: Google Gemini
      const modelName = process.env.AI_MODEL || 'gemini-3.5-flash-lite';
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt
      });

      // Filter and format chat history to only keep 'user' and 'model' roles
      const formattedHistory = chatHistory
        .filter(h => h.role === 'user' || h.role === 'model')
        .map(h => ({
          role: h.role,
          parts: [{ text: h.content }]
        }));

      const chat = model.startChat({
        history: formattedHistory
      });

      const result = await chat.sendMessage(message);
      const response = await result.response;
      replyText = response.text();
    }

    return res.status(200).json({
      success: true,
      reply: replyText.trim(),
      meta: {
        provider,
        model: process.env.AI_MODEL || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-3.5-flash-lite'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in chat handler:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Terjadi kesalahan pada backend proxy AI Chat.'
    });
  }
}

/**
 * Builds compact Markdown Table from columns and rows (up to 200 rows to prevent token overflow)
 */
function buildTable(columns, rows) {
  if (!columns || columns.length === 0 || !rows || rows.length === 0) {
    return '*(Tidak ada data)*';
  }

  const headers = columns.map(c => (typeof c === 'string' ? c : c.fieldName || c.name || 'Kolom'));
  let table = `| ${headers.join(' | ')} |\n`;
  table += `| ${headers.map(() => '---').join(' | ')} |\n`;

  // Limit to 200 rows for chat to keep context window usage efficient
  const maxRows = Math.min(rows.length, 200);
  for (let i = 0; i < maxRows; i++) {
    const row = rows[i];
    const rowValues = Array.isArray(row)
      ? row.map(val => (val !== null && val !== undefined ? String(val).replace(/\|/g, '/') : '-'))
      : headers.map(h => (row[h] !== null && row[h] !== undefined ? String(row[h]).replace(/\|/g, '/') : '-'));

    table += `| ${rowValues.join(' | ')} |\n`;
  }

  return table;
}
