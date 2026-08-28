PERUBAHAN VALIDASI FOTO GEOTAG

1. FOTO KK TIDAK WAJIB GEOTAG.
   - Foto KK boleh foto biasa.
   - Cukup harus berupa file gambar dan wajib diupload.

2. FOTO KONDISI RUMAH WAJIB GEOTAG:
   - Foto Rumah Tampak Depan
   - Foto Rumah Tampak Dalam
   - Foto Toilet/WC

3. Sistem menerima dua bentuk geotag:
   A. Koordinat GPS pada metadata EXIF JPEG.
   B. Cap visual GPS Map Camera pada foto yang menampilkan tulisan Lat dan Long.
      Ini menangani aplikasi geotag yang menempelkan lokasi pada gambar tetapi tidak menyimpan GPS di EXIF.

4. Untuk cap visual GPS Map Camera, browser memakai OCR Tesseract.js pada bagian bawah foto.
   Foto tanpa geotag yang terbaca langsung ditolak, input dikosongkan, dan file tidak dibuat menjadi payload.

5. server.js dan APP_SCRIPT_DTSEN_FIX.js ikut diubah:
   - KK hanya diperiksa keberadaan file.
   - 3 foto kondisi rumah harus membawa hasil validasi geotag dengan source EXIF_GPS atau VISUAL_GEOTAG.

6. Setelah mengganti APP_SCRIPT_DTSEN_FIX.js di Google Apps Script, deploy ulang Web App agar validasi server terbaru aktif.

CATATAN KONEKSI:
Pemeriksaan cap visual membutuhkan internet saat halaman dibuka untuk memuat Tesseract.js dari CDN. Jika GPS/EXIF tersedia, foto dapat lolos tanpa OCR.


=== FIX V3 - 28/08/2026 ===
- Memperbaiki NotReadableError/permission file Android: foto disalin ke memori browser saat dipilih dan tidak dibaca ulang saat Ringkasan/Kirim.
- Foto KK tetap tidak wajib geotag.
- Foto rumah depan/dalam/toilet tetap wajib geotag EXIF atau cap GPS Map Camera.
- Footer/tombol Simpan & Periksa Ringkasan memakai dynamic visual viewport + safe-area agar tidak tertutup toolbar browser HP.
- Pesan error file dibuat lebih ramah dan tidak menampilkan error permission mentah.
