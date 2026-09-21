FIX FOTO v5
===========

Perubahan utama:
1. Foto KK tidak wajib geotag.
2. Foto rumah depan, rumah dalam, dan Toilet/WC wajib geotag.
3. File dari picker Android/Brave hanya dibaca SATU KALI saat dipilih.
4. Setelah bytes foto berhasil disalin ke memori aplikasi, reference file picker langsung dilepas (input dikosongkan secara internal).
5. Ringkasan dan Kirim Data Final hanya memakai data URL plain string yang sudah tersimpan di memori; tidak membaca ulang File/FileReader/content URI.
6. Pesan error pengiriman sekarang menunjukkan tahap error: menyiapkan data, membuat payload, mengirim ke server, atau membaca respons server.
7. Tombol Ringkasan/Modal diberi type="button" eksplisit.

Cara update GitHub Pages:
- Ganti index.html dengan index.html versi v5.
- Tutup tab lama dan buka ulang halaman.
- Pastikan badge "FIX FOTO v5" terlihat di bagian Dokumen.

Untuk perubahan v5 ini APP_SCRIPT_DTSEN_FIX.js tidak perlu deploy ulang jika backend geotag v2/v4 sebelumnya sudah aktif.
