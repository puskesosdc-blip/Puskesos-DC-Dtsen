Kamu revisi project form survei DTSEN (index.html + APP_SCRIPT_DTSEN_FIX.js). Jangan ubah alur form, field, dan tampilan. Fokus 2 hal: (A) perbaiki gagal kirim, (B) buang kode mati.

MASALAH
Data sudah terisi semua dan validasi lolos, tapi "Kirim Data Final" gagal. Dugaan utama: 4 foto dikirim ukuran asli (base64, total bisa 25-30 MB) sehingga memori HP habis / fetch ke Apps Script gagal.

A. PERBAIKAN GAGAL KIRIM (index.html)
1. Di snapshotSelectedPhoto: kompres foto lewat canvas sebelum jadi dataUrl.
   - Sisi terpanjang maks 1600 px, JPEG kualitas 0.8, pakai createImageBitmap dengan fallback Image.
   - Foto asli (workingBlob) tetap dipakai untuk cek EXIF dan OCR geotag, jadi geotag tidak boleh hilang.
   - Snapshot.size dan type harus ikut hasil kompres.
2. Ganti arrayBufferToDataUrl (loop chunk + btoa) dengan canvas.toDataURL / FileReader.readAsDataURL.
3. Jangan simpan ArrayBuffer/binary string besar sekali pun setelah dikompres, biar cepat di-GC.
4. Perbaiki pesan error submit:
   - Bedakan "tidak ada koneksi / Failed to fetch" dari "server menolak".
   - Kalau respons bukan JSON, tampilkan 150 karakter awal respons untuk debug.
   - Tampilkan ukuran payload (MB) di pesan error.
   - Kalau payload > 20 MB, tolak sebelum kirim dengan pesan jelas.
5. Tombol Kirim: cegah klik ganda, dan beri timeout fetch 120 detik dengan AbortController.

B. APPS SCRIPT (APP_SCRIPT_DTSEN_FIX.js)
1. Hapus kode mati: prepareCellImage, getExtension, insertCellImages, cellImages, kolom "Preview", findRowByNikKepala, validateNikKepalaDuplikat (wrapper).
2. Daftar 4 foto ditulis 3 kali (requiredImages, imageFields, isImageKey). Jadikan satu konstanta PHOTO_FIELDS.
3. validateNIKKepalaDuplikat dipanggil tapi hasilnya diabaikan lalu baris ditimpa. Pertahankan perilaku upsert (NIK + No KK sama = update baris), hapus panggilan yang sia-sia itu.
4. Pesan error backend harus spesifik (NIK bukan 16 digit, foto tidak valid, dll), jangan sampai terbaca sebagai "tahap membaca respons".
5. Di saveImageToDrive: validasi dataUrl diawali "data:image/" sebelum split(','), dan lempar error jelas kalau format salah.

C. BERSIH-BERSIH
- Hapus server.js (tidak dipakai, skema sudah ketinggalan).
- Hapus blok <script> kosong di akhir index.html.
- Ganti README.md (UTF-16) dengan versi UTF-8 singkat: cara deploy GitHub Pages + cara deploy Apps Script.
- Update README_FIX.txt jadi "FIX v6".
- OCR Tesseract (loadImageForOcr, readVisualGeotag, script CDN) JANGAN dihapus dulu, tandai saja dengan komentar "opsional".

ATURAN
- Ubah seminimal mungkin, jangan tambah dependency baru.
- Semua tombol tetap type="button".
- Setelah selesai, beri ringkasan: file yang berubah, jumlah baris berkurang, dan langkah deploy ulang Apps Script (Deploy > Manage deployments > New version, akses "Anyone", jalankan sekali untuk otorisasi Drive).
- Tes dengan jsdom: isi semua field, set foto palsu, klik Ringkasan lalu Kirim, pastikan fetch terpanggil dan payload < 6 MB untuk 4 foto 12 MP.