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
- **Frontend:** Vanilla HTML, CSS, JavaScript. Huruf Nunito dan Fredoka (Google Fonts, SIL OFL).
- **Login:** Auth0 Universal Login lewat `@auth0/auth0-spa-js` (tanpa client secret)
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

Buka file `.env` dan masukkan API Key Gemini kamu. Nilai Auth0 di bawah ini adalah Domain dan Client ID publik aplikasi SPA (bukan rahasia):

```env
GEMINI_API_KEY=isi_dengan_api_key_gemini_kamu
PORT=3000
AUTH0_DOMAIN=triotomato.jp.auth0.com
AUTH0_CLIENT_ID=wZvAlpEGr0ngXHT6VnHiEZK97c2YDOej
```

Lalu isi URL callback di dashboard Auth0 seperti pada bagian [Login dengan Auth0](#login-dengan-auth0).

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
│   ├── auth.js           # Login / logout Auth0 (SPA SDK)
│   ├── assets/           # Ilustrasi persona, ikon, dan catatan lisensi
│   ├── index.html        # Struktur HTML utama
│   └── style.css         # Styling & tata letak UI
├── .env.example          # Template variabel lingkungan
├── package.json          # Dependensi proyek & script runner
└── server.js             # Express web server & integrasi Gemini API
```

---

## 🔐 Login dengan Auth0

Chat roleplay hanya bisa dipakai setelah login. Tombol **Log in** mengarahkan ke Auth0 Universal Login, lalu pengguna kembali ke aplikasi dan melihat nama serta foto profil, bersama tombol **Log out**.

Integrasinya mengikuti [panduan Auth0 untuk JavaScript SPA](https://auth0.com/docs/quickstart/spa/vanillajs):

1. Server membaca `AUTH0_DOMAIN` dan `AUTH0_CLIENT_ID` dari `.env`.
2. Browser mengambil kedua nilai itu dari `GET /api/auth-config`.
3. `@auth0/auth0-spa-js` melakukan login dengan PKCE (`loginWithRedirect`).

Jangan menambahkan client secret. Aplikasi ini bertipe **Single Page Application**, jadi Auth0 tidak memakai rahasia klien.

### URL yang harus diisi di Auth0 Dashboard

Buka [Auth0 Dashboard](https://manage.auth0.com/) → **Applications** → **Applications** → aplikasi Basa → tab **Settings** → bagian **Application URIs**. Untuk pengembangan lokal (port bawaan `3000`), isi persis nilai berikut, lalu klik **Save Changes**:

| Kolom | Nilai |
| --- | --- |
| Allowed Callback URLs | `http://localhost:3000` |
| Allowed Logout URLs | `http://localhost:3000` |
| Allowed Web Origins | `http://localhost:3000` |

- **Allowed Callback URLs** harus sama dengan `redirect_uri` (`window.location.origin`). Kalau tidak cocok, Auth0 menolak login.
- **Allowed Logout URLs** harus sama dengan `returnTo`, supaya setelah logout browser kembali ke Basa.
- **Allowed Web Origins** diperlukan untuk sesi senyap. Tanpa ini, pengguna terlihat logout setiap kali halaman di-refresh.

Jika `PORT` di `.env` bukan `3000`, ganti `3000` di ketiga kolom dengan port tersebut. Contoh untuk port `3001`: `http://localhost:3001`.

Buka aplikasinya lewat `http://localhost:3000`. Auth0 memperlakukan `http://127.0.0.1:3000` sebagai origin yang berbeda; kalau kamu memakai alamat itu, daftarkan juga ketiga URL dengan host `127.0.0.1`.

Rute Gemini (`/api/chat`, `/api/generate-topics`, `/api/start-session`) tidak diubah dan tidak memakai access token Auth0. Gerbang login ada di antarmuka.

---

## 🎨 Tampilan dan lisensi aset

Antarmuka memakai bentuk bulat, huruf tebal, dan tombol dengan sisi bawah yang lebih gelap supaya terasa bisa ditekan. Warna utama Basa adalah biru. Banner grammar memakai hijau untuk kalimat yang lebih baik dan merah untuk kalimat yang keliru.

| Peran | Hex |
| --- | --- |
| Biru utama | `#1A8CFF` |
| Sisi bawah tombol biru | `#0B6FD6` |
| Biru tua | `#0B3A73` |
| Biru muda | `#E7F4FF` |
| Langit (latar) | `#D6EEFF` |
| Teks | `#3C3C3C` |
| Teks sekunder | `#777777` |
| Garis | `#E5E5E5` |
| Benar | `#58CC02` (latar `#D7FFB8`, teks `#3F8F00`) |
| Salah | `#FF4B4B` (latar `#FFDFE0`, teks `#EA2B2B`) |
| Sorotan | `#FFC800` (latar `#FFF4CC`) |
| Aksen Raya | `#FF9600` |

Aset yang dipakai, dan lisensinya:

- **Nunito** dan **Fredoka**, dimuat dari [Google Fonts](https://fonts.google.com/). Keduanya berlisensi [SIL Open Font License 1.1](https://scripts.sil.org/OFL). Nunito © 2014 The Nunito Project Authors. Fredoka oleh The Fredoka Project Authors. Berkas font tidak disalin ke repositori ini.
- **Open Peeps** oleh Pablo Stanley, domain publik [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Sumber: [openpeeps.com](https://www.openpeeps.com/). Gambar `public/assets/raya.svg` dan `public/assets/atma.svg` dibuat dengan [DiceBear](https://www.dicebear.com/styles/open-peeps/), gaya Open Peeps yang juga ditandai CC0.
- **Lucide** (`lucide-static` v0.544.0), lisensi ISC. Ikon ada di `public/assets/icons/`. Teks lisensi lengkap ada di `public/assets/NOTICES.md`.

---

## 📌 Catatan Tambahan

- Instruksi karakter persona disimpan dalam direktori `prompts/`. Kamu bisa menyesuaikan gaya bicara atau skenario Atma dan Raya langsung melalui file `prompts/atma.txt` dan `prompts/raya.txt`.
