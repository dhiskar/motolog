# MotoLog 🏍️

Aplikasi web (PWA) sederhana untuk mencatat perawatan sepeda motor: ganti oli, servis/repair, bensin, dan pengeluaran lainnya. Dibuat mobile-first untuk dipakai di HP, bisa diinstal ke layar utama, dan tetap berjalan tanpa internet.

**Semua data disimpan lokal di HP kamu** (localStorage). Tidak ada server, tidak ada akun, tidak ada data yang dikirim ke mana pun.

---

## Fitur

- **Multi-motor** — kelola beberapa motor sekaligus, ganti motor aktif dari header.
- **Ganti oli** — riwayat, interval km/bulan, status "sudah waktunya" otomatis.
- **Servis & perbaikan** — bengkel, kategori, biaya, catatan, foto nota.
- **Bensin** — liter, harga/liter, total otomatis, hitung konsumsi km/L.
- **Pengeluaran lain** — pajak, aksesori, cuci, dan lain-lain.
- **Dashboard** — ringkasan biaya bulan ini, total km, status oli, pengingat terdekat.
- **Riwayat** — filter jenis, pencarian, edit & hapus.
- **Statistik** — grafik pengeluaran bulanan, rincian per kategori, efisiensi bahan bakar.
- **Pengingat** — pengingat manual (pajak, servis, dll.) dengan target tanggal/odo.
- **Backup** — simpan JSON langsung ke folder pilihan HP lewat dialog “Simpan sebagai” (Chrome Android 132+), fallback ke folder Download; impor JSON; ekspor CSV untuk Excel/Spreadsheet.
- **Tema** — gelap, terang, atau ikut sistem.
- **Offline & installable** — service worker + manifest, bisa dipasang seperti aplikasi.

---

## Cara pakai di HP

1. Buka alamat GitHub Pages kamu di browser HP (Chrome / Samsung Internet).
2. Tambahkan motor pertama saat aplikasi meminta.
3. Tekan tombol **+** untuk menambah catatan.
4. Untuk memasang: menu browser → **Instal aplikasi** / **Tambahkan ke layar utama**.
5. Buka MotoLog dari layar utama. Data tetap ada meski offline.

> **Penting:** data terikat pada browser dan alamat situs. Menghapus data browser, memakai mode incognito, atau mengganti domain dapat menghilangkan data. Aktifkan **Pengaturan → Backup otomatis ke file** agar data punya salinan di penyimpanan HP.

### Menyimpan backup ke file HP

- **Chrome Android 132+ / Chrome desktop:** tombol **Ekspor backup (JSON)** membuka dialog **“Simpan sebagai”**, sehingga kamu bisa memilih folder di penyimpanan HP dan nama filenya.
- **Browser lama / Samsung Internet:** file otomatis masuk ke folder **Download**.
- File JSON berisi semua motor, catatan, pengingat, dan foto. Simpan juga salinan ke Google Drive atau WhatsApp.
- Untuk memulihkan: **Pengaturan → Impor backup**.
- Aplikasi juga berusaha meminta **penyimpanan persisten** agar data tidak mudah dihapus otomatis oleh browser saat ruang penyimpanan menipis. Ini bersifat best-effort dan tetap tidak melindungi dari penghapusan manual “cookie & data situs”.

### Backup otomatis ke file

1. Buka **Pengaturan → Backup otomatis ke file**, lalu pilih lokasi file (misalnya folder **Documents**).
2. Setiap kali kamu menyimpan, mengubah, atau menghapus catatan, MotoLog langsung menulis ulang file backup itu (sekitar 1 detik setelah perubahan).
3. Status di Pengaturan menunjukkan nama file dan waktu backup terakhir.

Batasan yang perlu diketahui:

- Browser hanya bisa menulis saat MotoLog sedang terbuka. Saat aplikasi ditutup, data tetap aman di penyimpanan browser dan akan ditulis ke file begitu aplikasi dibuka lagi.
- Setelah browser ditutup total, Chrome kadang meminta izin akses file lagi. Bila muncul tulisan **“Butuh izin akses file”**, ketuk baris tersebut sekali untuk mengizinkan.
- Fitur ini paling andal pada Chrome Android 132+ dan saat MotoLog dipasang sebagai aplikasi (PWA). Pada browser yang belum mendukung, gunakan ekspor manual.
- Backup otomatis tetap tidak bisa mencegah penghapusan manual “cookie & data situs”; file backup di penyimpanan HP tetap ada dan bisa dipulihkan lewat **Impor backup**.

---

## Menjalankan secara lokal

Karena aplikasi memakai service worker dan manifest, jalankan lewat server lokal (bukan `file://`).

```bash
# salah satu pilihan
npx serve .
python -m http.server 8080
```

Lalu buka `http://localhost:8080`.

---

## Deploy ke GitHub Pages

1. Buat repository baru di GitHub, misalnya `motolog`.
2. Dari folder proyek ini:

   ```bash
   git init
   git add .
   git commit -m "MotoLog v1.0.0"
   git branch -M main
   git remote add origin https://github.com/USERNAME/motolog.git
   git push -u origin main
   ```

3. Di GitHub buka **Settings → Pages**.
4. Pada **Build and deployment → Source**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`, lalu **Save**.
6. Tunggu 1–2 menit. Situs tersedia di:

   ```
   https://USERNAME.github.io/motolog/
   ```

Aplikasi memakai path relatif (`./`), jadi tetap berjalan di subfolder repository. File `.nojekyll` sudah disertakan agar GitHub Pages tidak memproses file dengan Jekyll.

### Memperbarui versi

1. Ubah `CACHE_VERSION` di `sw.js` (mis. `motolog-v1.0.1`) dan `APP_VERSION` di `assets/core.js`.
2. Commit dan push.
3. Buka aplikasi, lalu tutup dan buka kembali (atau refresh dua kali) agar service worker mengambil versi baru.

---

## Struktur proyek

```
motolog/
├─ index.html               # app shell + ikon SVG
├─ manifest.webmanifest     # metadata PWA
├─ sw.js                    # service worker (offline cache)
├─ .nojekyll                # agar GitHub Pages tidak memakai Jekyll
├─ assets/
│  ├─ style.css             # desain & tema
│  ├─ core.js               # data model, penyimpanan, perhitungan
│  ├─ ui.js                 # render semua halaman
│  ├─ sheets.js             # bottom sheet, form, simpan
│  └─ app.js                # event, ekspor/impor, PWA
└─ icons/                   # ikon PNG 192/512/maskable/apple
```

---

## Pemecahan masalah

| Masalah | Solusi |
| --- | --- |
| Ikon install tidak muncul | Pastikan dibuka via HTTPS (GitHub Pages), bukan `file://`. Di Samsung Internet gunakan menu → *Tambahkan halaman ke → Layar utama*. |
| Perubahan tidak muncul | Naikkan `CACHE_VERSION` di `sw.js`, push, lalu tutup-buka aplikasi. |
| Data hilang | Data hanya ada di browser tersebut. Pulihkan dari backup JSON di **Pengaturan → Impor backup**. |
| Foto tidak tersimpan | Ukuran localStorage terbatas (±5 MB). Foto otomatis dikompres, tetapi banyak foto bisa memenuhi kuota. Ekspor backup lalu hapus catatan lama bila perlu. |
| Grafik kosong | Tambahkan catatan dengan tanggal di bulan yang dipilih. |

---

## Privasi

MotoLog tidak memiliki backend. Seluruh data (termasuk foto) tersimpan di `localStorage` perangkat dan tidak pernah dikirim ke internet. Satu-satunya koneksi keluar adalah permintaan file aplikasi dari GitHub Pages.

---

## Lisensi

MIT — lihat [LICENSE](./LICENSE).
