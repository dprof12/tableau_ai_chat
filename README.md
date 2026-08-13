# Tableau AI Chatbot Extension (Vercel Ready) 💬🚀

Solusi **Tableau Dashboard Chatbot Extension** modern dan terpisah yang memanfaatkan kecerdasan buatan (Google Gemini / OpenAI) untuk menjawab pertanyaan user secara interaktif dan dinamis berdasarkan seluruh data mentah (*unfiltered logical tables*) yang ada di dalam database dashboard Tableau.

---

## 🌟 Fitur Utama

- **Unfiltered Data-Locked Q&A (Option B)**: Chatbot mengakses data langsung dari `DataSource` Tableau menggunakan logical tables. Ini memotong filter visual, sehingga Anda bisa menanyakan data untuk tahun **2026** bahkan saat dashboard visual sedang Anda filter ke tahun **2025**.
- **Interactive Multi-Turn Chat**: AI mengingat riwayat percakapan sebelumnya (*chat history*) dalam sesi aktif, memungkinkan Anda mengajukan pertanyaan lanjutan (follow-up) tanpa kehilangan konteks.
- **Rekomendasi Pertanyaan (Suggestion Chips)**: Menampilkan rekomendasi pertanyaan pintar di atas input teks untuk memudahkan eksplorasi data sekali klik.
- **Aesthetic Glassmorphism UI**: Antarmuka obrolan yang elegan, ramah layar sempit (samping dashboard), dilengkapi animasi pengetikan (*typing indicator*), bubble gradien premium, dan scroll otomatis.
- **Vercel Serverless Ready**: Backend serverless `/api/chat.js` yang terintegrasi penuh untuk proxy request ke LLM secara aman tanpa mengekspos API key di sisi client.

---

## 📁 Struktur Direktori

```
tableau-ai-chat/
├── api/
│   └── chat.js                 # Vercel Serverless API Handler (Gemini / OpenAI Proxy)
├── public/
│   ├── ui.html                 # Halaman Antarmuka Extension Chatbot
│   ├── css/
│   │   └── style.css           # Styling Obrolan Modern & Responsif
│   └── js/
│       ├── app.js              # Logika Extension, DataSource Query, & Render Chat
│       └── tableau.extensions.1.latest.js  # Tableau SDK
├── manifest/
│   └── tableau-ai-chat.trex    # File Manifest XML untuk didaftarkan ke Tableau
├── test/
│   └── test-chat.js            # Script pengujian API offline
├── .env.example                # Template konfigurasi environment variables
├── package.json                # Konfigurasi dependensi Node.js
├── vercel.json                 # Konfigurasi CORS & routing Vercel
└── README.md                   # Dokumentasi panduan (File ini)
```

---

## 🚀 Langkah Deploy ke Vercel

### Langkah 1: Push Project ke Git Repository
Upload folder `tableau-ai-chat` ini ke GitHub / GitLab / Bitbucket Anda.

### Langkah 2: Import Project di Vercel
1. Buka [vercel.com](https://vercel.com) dan login ke akun Anda.
2. Klik **Add New...** > **Project**.
3. Pilih repository Git project ini.
4. Pada bagian **Root Directory**, pastikan mengarah ke folder `tableau-ai-chat`.

### Langkah 3: Konfigurasi Environment Variables di Vercel
Di dashboard Vercel pada menu **Settings** > **Environment Variables**, tambahkan:

| Variable Key | Contoh Nilai | Keterangan |
|---|---|---|
| `AI_PROVIDER` | `gemini` *(atau `openai`)* | Provider LLM yang digunakan |
| `AI_API_KEY` | `AIzaSy...` *(atau `sk-...`)* | API Key resmi dari Google AI Studio atau OpenAI |
| `AI_MODEL` | `gemini-3.5-flash-lite` | Nama model (opsional) |

### Langkah 4: Klik Deploy
Setelah proses build selesai, Anda akan mendapatkan URL HTTPS Vercel, misalnya:
`https://tableau-ai-chat.vercel.app`

---

## 📊 Langkah Import Extension ke Tableau

### Langkah 1: Sesuaikan URL Manifest (.trex)
Buka file `manifest/tableau-ai-chat.trex` dengan text editor, lalu ganti URL target dengan domain Vercel Anda:
```xml
<source-location>
  <url>https://tableau-ai-chat.vercel.app/ui.html</url>
</source-location>
```
*Simpan file tersebut.*

### Langkah 2: Masukkan ke Tableau Dashboard
1. Buka dashboard Anda di **Tableau Desktop**.
2. Pada panel **Objects** di sebelah kiri bawah, tarik objek **Extension** ke area dashboard yang diinginkan (saran: ditaruh di kolom samping/layout vertikal sempit).
3. Pilih file `manifest/tableau-ai-chat.trex`.
4. Klik **OK** pada dialog perizinan data Tableau (Extension meminta izin *Full Data* agar dapat query datasource langsung).
5. Chatbot Anda siap digunakan!

---

## 🛠️ Pengujian Lokal (Development)

1. Masuk ke folder project:
   ```bash
   cd tableau-ai-chat
   ```
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Salin template `.env.example` menjadi `.env` dan isi `AI_API_KEY`:
   ```bash
   cp .env.example .env
   ```
4. Jalankan pengujian API offline:
   ```bash
   npm run test-chat
   ```
5. Jalankan Vercel dev server secara lokal:
   ```bash
   npm run dev
   ```
   Buka `http://localhost:3000/ui.html` di browser Anda untuk menguji obrolan dalam mode preview browser menggunakan mock data.
