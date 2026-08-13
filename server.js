import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/chat.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Handle local Vercel-style Serverless Function Route
  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const parsedBody = body ? JSON.parse(body) : {};
        
        // Mock Vercel request & response objects
        const vercelReq = {
          method: 'POST',
          body: parsedBody
        };

        const vercelRes = {
          statusCode: 200,
          headers: {},
          setHeader(name, value) {
            this.headers[name] = value;
            res.setHeader(name, value);
          },
          status(code) {
            this.statusCode = code;
            res.statusCode = code;
            return this;
          },
          json(data) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          },
          end() {
            res.end();
          }
        };

        // Call the serverless function handler directly
        await handler(vercelReq, vercelRes);
      } catch (err) {
        console.error('Error in local API handler execution:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Static File Router
  let relativePath = req.url === '/' || req.url === '/ui.html' ? 'ui.html' : req.url;
  
  // Clean URL queries
  if (relativePath.includes('?')) {
    relativePath = relativePath.split('?')[0];
  }

  const filePath = path.join(__dirname, 'public', relativePath);
  
  // Safe Directory Traversal Guard
  const publicDir = path.join(__dirname, 'public');
  if (!filePath.startsWith(publicDir)) {
    res.statusCode = 403;
    res.end('Akses Ditolak');
    return;
  }

  const extname = path.extname(filePath);
  let contentType = 'text/html';

  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
      contentType = 'image/jpg';
      break;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.end('File Tidak Ditemukan');
      } else {
        res.statusCode = 500;
        res.end(`Kesalahan Server: ${err.code}`);
      }
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n===================================================`);
  console.log(`Server lokal berjalan sukses di http://localhost:${PORT}`);
  console.log(`Preview Chatbot: http://localhost:${PORT}/ui.html`);
  console.log(`===================================================\n`);
});
