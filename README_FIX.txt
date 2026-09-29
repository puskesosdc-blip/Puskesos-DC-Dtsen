FIX v6
======

Perubahan utama:
1. Kompresi Foto Otomatis di Canvas (index.html):
   - Sisi terpanjang maksimal 1600 px, JPEG kualitas 0.8 menggunakan createImageBitmap dengan fallback Image.
   - Mengurangi ukuran payload dari ~25-30 MB menjadi < 6 MB untuk 4 foto resolusi tinggi (12 MP).
   - Snapshot size dan type disesuaikan dengan hasil kompresi.
   - ArrayBuffer/binary string besar langsung dilepas dan tidak disimpan di memori agar cepat di-GC.
   - Foto asli (workingBlob) tetap dipakai untuk verifikasi EXIF GPS dan OCR geotag.
2. Peningkatan Ketahanan dan Pesan Pengiriman Form:
   - Validasi batas ukuran payload maksimum 20 MB sebelum pengiriman.
   - Timeout pengiriman 120 detik menggunakan AbortController.
   - Pencegahan klik ganda pada tombol Kirim Data Final.
   - Pembedaan pesan error yang jelas: koneksi terputus/timeout vs penolakan oleh server.
   - Penampilan cuplikan 150 karakter awal jika respons server bukan JSON (memudahkan debug).
   - Penampilan ukuran payload (MB) pada pesan error.
3. Pembersihan Backend Google Apps Script (APP_SCRIPT_DTSEN_FIX.js):
   - Penghapusan kode mati: prepareCellImage, getExtension, insertCellImages, cellImages, kolom Preview, findRowByNikKepala, validateNikKepalaDuplikat (wrapper).
   - Penggabungan definisi field foto menjadi satu konstanta PHOTO_FIELDS.
   - Penghapusan pemanggilan redundan validateNIKKepalaDuplikat (mempertahankan perilaku upsert NIK + No KK).
   - Validasi awalan "data:image/" pada saveImageToDrive dengan pesan error spesifik.
4. Pembersihan Repositori:
   - Penghapusan server.js yang usang.
   - Penghapusan tag script kosong di akhir index.html.
   - Penggantian README.md dengan format UTF-8 singkat (panduan deploy GitHub Pages dan Apps Script).

Langkah Deploy:
- GitHub Pages: Commit & push perubahan file index.html ke branch repository Anda.
- Google Apps Script: Buka Apps Script > Salin isi APP_SCRIPT_DTSEN_FIX.js > Deploy > Manage deployments > Edit > New version > Akses "Anyone" > Deploy. Jalankan sekali fungsi doPost / doGet bila diminta otorisasi Drive.
