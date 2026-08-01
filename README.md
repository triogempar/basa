# Basa - AI English Roleplay & Live Grammar Partner

**Basa** adalah aplikasi web interaktif untuk latihan percakapan bahasa Inggris melalui simulasi *roleplay*. Saat kamu melakukan percakapan, AI tidak hanya merespons obrolan, tetapi juga menganalisis dan mengoreksi tata bahasa (*grammar*) atau pilihan kata yang kurang tepat secara *real-time*, lengkap dengan penjelasan ringkas dalam bahasa Indonesia.

---

## 🌟 Fitur Utama

- **2 Persona Avatar:**
  - **Atma (Formal - HR Interviewer):** Dirancang untuk simulasi wawancara kerja, diskusi profesional, negosiasi gaji, dan komunikasi bisnis.
  - **Raya (Casual - Daily Companion):** Dirancang untuk obrolan santai sehari-hari, hobi, rencana *traveling*, atau topik umum.
- **Koreksi Grammar Real-time:**
  - Setiap pesan dari pengguna dianalisis secara otomatis. Jika terdapat kesalahan kalimat, sistem akan menampilkan kalimat asli, versi perbaikannya (*corrected version*), serta penjelasan dalam bahasa Indonesia tanpa mengganggu jalannya percakapan.
- **Generator Skenario Dinamis:**
  - Fitur untuk menghasilkan topik *roleplay* baru secara acak menggunakan AI Gemini, sehingga latihan tidak membosankan.
- **Handover & Fallback Model AI:**
  - Server dilengkapi mekanisme *fallback* otomatis antar model Gemini untuk menjaga ketersediaan koneksi jika salah satu model mengalami kemacetan (*timeout*) atau beban tinggi.

---

## 🛠️ Teknologi yang Digunakan

- **Backend:** Node.js, Express.js
- **AI SDK:** `@google/genai` (Google Gemini API)
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Utilitas:** `dotenv`, `cors`

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Prasyarat
- Node.js (versi 18 atau lebih baru)
- API Key dari [Google AI Studio](https://aistudio.google.com/)

### 2. Install Dependensi
Buka terminal di direktori proyek ini, lalu jalankan:

```bash
npm install
```

### 3. Konfigurasi Variabel Lingkungan (.env)
Salin file contoh konfigurasi `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Buka file `.env` dan masukkan API Key Gemini kamu:

```env
GEMINI_API_KEY=isi_dengan_api_key_gemini_kamu
PORT=3000
```

### 4. Jalankan Server
Jalankan salah satu perintah berikut:

```bash
# Mode standar
npm start

# Mode development (otomatis reload jika ada perubahan server.js)
npm run dev
```

Buka browser dan kunjungi: `http://localhost:3000`

---

## 📁 Struktur Direktori Proyek

```text
GeminiChatBot/
├── prompts/              # Prompt instruksi persona (atma.txt, raya.txt)
├── public/               # File antarmuka pengguna (Frontend)
│   ├── app.js            # Logika interaksi UI & panggilan API
│   ├── index.html        # Struktur HTML utama
│   └── style.css         # Styling & tata letak UI
├── .env.example          # Template variabel lingkungan
├── package.json          # Dependensi proyek & script runner
└── server.js             # Express web server & integrasi Gemini API
```

---

## 📌 Catatan Tambahan

- Instruksi karakter persona disimpan dalam direktori `prompts/`. Kamu bisa menyesuaikan gaya bicara atau skenario Atma dan Raya langsung melalui file `prompts/atma.txt` dan `prompts/raya.txt`.
