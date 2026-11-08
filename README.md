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
- **Login Auth0:**
  - Pengguna masuk lewat Auth0 Universal Login. Setelah kembali ke aplikasi, nama dan foto profil ditampilkan, dan chat roleplay hanya terbuka saat sudah login.

---

## 🛠️ Teknologi yang Digunakan

- **Backend:** Node.js, Express.js
- **AI SDK:** `@google/genai` (Google Gemini API)
- **Auth:** Auth0 SPA SDK (`@auth0/auth0-spa-js` via CDN), Universal Login
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
AUTH0_DOMAIN=triotomato.jp.auth0.com
AUTH0_CLIENT_ID=wZvAlpEGr0ngXHT6VnHiEZK97c2YDOej
```

`AUTH0_DOMAIN` dan `AUTH0_CLIENT_ID` adalah nilai publik aplikasi Single Page Application. Jangan menambahkan *client secret*. Penjelasan pengaturan Auth0 ada di bagian berikutnya.

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

## 🔐 Login dengan Auth0

Chat roleplay hanya bisa dipakai setelah masuk. Basa mengikuti [panduan Auth0 untuk JavaScript SPA](https://auth0.com/docs/quickstart/spa/vanillajs): tombol **Log in** mengarahkan ke Universal Login, Auth0 mengembalikan pengguna ke aplikasi ini, lalu nama dan foto profil muncul bersama tombol **Log out**.

SDK dimuat dari CDN di browser (`@auth0/auth0-spa-js`). Server hanya membaca `AUTH0_DOMAIN` dan `AUTH0_CLIENT_ID` lewat `dotenv`, lalu mengirim keduanya ke frontend melalui `GET /api/config`. Tidak ada *client secret*.

### URL yang harus diisi di Auth0 Dashboard

1. Buka [Auth0 Dashboard](https://manage.auth0.com/) → **Applications** → aplikasi **Single Page Application** → tab **Settings**.
2. Di **Application URIs**, isi persis nilai berikut untuk development lokal. Port default dikonfirmasi dari `server.js`: `process.env.PORT || 3000`.

| Pengaturan di dashboard | Nilai |
| --- | --- |
| Allowed Callback URLs | `http://localhost:3000` |
| Allowed Logout URLs | `http://localhost:3000` |
| Allowed Web Origins | `http://localhost:3000` |

Jangan menambahkan garis miring di akhir. SDK memakai `window.location.origin` sebagai `redirect_uri` (callback) dan `returnTo` (logout), yaitu `http://localhost:3000` saat aplikasi dibuka di port 3000. **Allowed Web Origins** diperlukan agar sesi bisa dipulihkan saat halaman di-refresh (*silent authentication*).

3. Jenis aplikasi harus tetap **Single Page Application**. Di **Advanced Settings → OAuth**, **JsonWebToken Signature Algorithm** adalah `RS256` dan **OIDC Conformant** aktif.
4. Pastikan ada cara untuk masuk (biasanya koneksi database Username-Password, atau koneksi sosial) dan koneksi itu diizinkan untuk aplikasi ini.
5. Klik **Save Changes**, lalu jalankan ulang server (`npm start`).

Buka aplikasinya lewat `http://localhost:3000`. Jika kamu memakai `http://127.0.0.1:3000`, daftarkan `http://127.0.0.1:3000` juga di ketiga kolom di atas, karena origin-nya berbeda.

Jika `PORT` diubah, ganti `3000` pada ketiga URL. Untuk deployment, tambahkan origin produksi (misalnya `https://basa.example.com`) di kolom yang sama, dipisahkan dengan koma.

Kalau Universal Login menampilkan *Callback URL mismatch*, ketiga URL di atas belum tersimpan, atau origin yang dibuka (localhost vs `127.0.0.1`, atau port lain) tidak sama dengan yang terdaftar.

Gerbang login ada di frontend. Endpoint chat tidak memverifikasi access token, karena itu membutuhkan Auth0 API (*audience*) terpisah di luar alur login SPA ini.

---

## 📁 Struktur Direktori Proyek

```text
GeminiChatBot/
├── prompts/              # Prompt instruksi persona (atma.txt, raya.txt)
├── public/               # File antarmuka pengguna (Frontend)
│   ├── app.js            # Logika interaksi UI & panggilan API
│   ├── auth.js           # Login Auth0 (Universal Login)
│   ├── index.html        # Struktur HTML utama
│   └── style.css         # Styling & tata letak UI
├── .env.example          # Template variabel lingkungan
├── package.json          # Dependensi proyek & script runner
└── server.js             # Express web server & integrasi Gemini API
```

---

## 📌 Catatan Tambahan

- Instruksi karakter persona disimpan dalam direktori `prompts/`. Kamu bisa menyesuaikan gaya bicara atau skenario Atma dan Raya langsung melalui file `prompts/atma.txt` dan `prompts/raya.txt`.
