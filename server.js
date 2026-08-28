// server.js
// npm install express better-sqlite3 cors
const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
const db = new Database('dtsen.db');

app.use(express.json());
app.use(cors());

// --- SCHEMA INIT ---
db.exec(`
    CREATE TABLE IF NOT EXISTS keluarga (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_kepala_keluarga TEXT NOT NULL,
        nik_kepala_keluarga TEXT NOT NULL CHECK(length(nik_kepala_keluarga) >= 16),
        no_kk TEXT NOT NULL CHECK(length(no_kk) >= 16),
        jumlah_anggota_keluarga INTEGER,
        provinsi TEXT, kabupaten_kota TEXT, kecamatan TEXT, desa_kelurahan TEXT, kode_pos TEXT, rt_rw_dusun TEXT,
        alamat_lengkap TEXT, nama_jalan TEXT, nomor_rumah TEXT,
        sesuai_kk BOOLEAN, latitude REAL, longitude REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sosial_ekonomi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keluarga_id INTEGER REFERENCES keluarga(id) ON DELETE CASCADE,
        jenis_bangunan TEXT, status_kepemilikan_bangunan TEXT, ada_keluarga_lain BOOLEAN,
        jumlah_orang_tinggal INTEGER, bukti_kepemilikan TEXT, luas_lantai_m2 REAL,
        fasilitas_bab TEXT, pembuangan_akhir_tinja TEXT, sumber_air_minum TEXT,
        sumber_penerangan TEXT, pengeluaran_listrik REAL, pengeluaran_pulsa REAL,
        pengeluaran_makanan_mingguan REAL, total_pendapatan_bulanan REAL,
        memiliki_tempat_berteduh_tetap BOOLEAN, kepala_pengurus_masih_bekerja BOOLEAN,
        khawatir_tidak_makan_setahun BOOLEAN, pengeluaran_pangan_lebih_70 BOOLEAN,
        ada_pengeluaran_pakaian_setahun BOOLEAN,
        pengeluaran_internet_bulanan REAL,
        nomor_langganan_listrik TEXT, nomor_meter_listrik TEXT, besar_daya_listrik_va INTEGER
    );

    CREATE TABLE IF NOT EXISTS aset_keluarga (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keluarga_id INTEGER REFERENCES keluarga(id) ON DELETE CASCADE,
        jenis_aset TEXT, kepemilikan BOOLEAN, jumlah INTEGER
    );

    CREATE TABLE IF NOT EXISTS anggota_keluarga (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keluarga_id INTEGER REFERENCES keluarga(id) ON DELETE CASCADE,
        urutan_anggota INTEGER, nama_lengkap TEXT, jenis_kelamin TEXT,
        status_hubungan_kepala_keluarga TEXT, status_partisipasi_sekolah TEXT,
        ijazah_tertinggi TEXT, pekerjaan_utama TEXT, disabilitas_fisik BOOLEAN,
        keluhan_kesehatan_kronis TEXT, detail_keluhan_kesehatan TEXT,
        status_keberadaan TEXT, bekerja_seminggu_lalu BOOLEAN,
        lapangan_usaha_pekerjaan_utama TEXT, memiliki_usaha_sendiri_bersama BOOLEAN,
        pendapatan_sebulan_terakhir TEXT, status_disabilitas BOOLEAN,
        jenis_disabilitas TEXT, status_kehamilan BOOLEAN
    );

    CREATE TABLE IF NOT EXISTS dokumen_pendukung (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keluarga_id INTEGER REFERENCES keluarga(id) ON DELETE CASCADE,
        foto_kk TEXT, foto_rumah_depan TEXT, foto_rumah_dalam TEXT, foto_toilet_wc TEXT,
        nomor_kontak TEXT, keterangan_tambahan TEXT, usulan_bansos TEXT
    );
`);

// Migrasi ringan untuk database lama yang belum memiliki kolom foto Toilet/WC.
const dokumenColumns = db.prepare('PRAGMA table_info(dokumen_pendukung)').all().map(col => col.name);
if (!dokumenColumns.includes('foto_toilet_wc')) {
    db.exec('ALTER TABLE dokumen_pendukung ADD COLUMN foto_toilet_wc TEXT');
}

// Migrasi ringan: pecah detail kepemilikan daya listrik menjadi tiga kolom terstruktur.
const sosialEkColumns = db.prepare('PRAGMA table_info(sosial_ekonomi)').all().map(col => col.name);
if (!sosialEkColumns.includes('nomor_langganan_listrik')) {
    db.exec('ALTER TABLE sosial_ekonomi ADD COLUMN nomor_langganan_listrik TEXT');
}
if (!sosialEkColumns.includes('nomor_meter_listrik')) {
    db.exec('ALTER TABLE sosial_ekonomi ADD COLUMN nomor_meter_listrik TEXT');
}
if (!sosialEkColumns.includes('besar_daya_listrik_va')) {
    db.exec('ALTER TABLE sosial_ekonomi ADD COLUMN besar_daya_listrik_va INTEGER');
}

// --- VALIDASI FOTO DOKUMEN & GEOTAG ---
const REQUIRED_PHOTOS = [
    ['foto_kk', 'Foto KK'],
    ['foto_rumah_depan', 'Foto Rumah Depan'],
    ['foto_rumah_dalam', 'Foto Rumah Dalam'],
    ['foto_toilet_wc', 'Foto Toilet/WC']
];

const GEOTAG_REQUIRED_PHOTOS = new Set([
    'foto_rumah_depan',
    'foto_rumah_dalam',
    'foto_toilet_wc'
]);

function validateGeotaggedPhotos(dokumen = {}) {
    for (const [key, label] of REQUIRED_PHOTOS) {
        const image = dokumen[key];
        if (!image || !image.data || String(image.data).length < 50) {
            throw new Error(`${label} wajib diupload sebelum dikirim.`);
        }

        // Foto KK cukup file gambar biasa; hanya foto kondisi rumah yang wajib geotag.
        if (!GEOTAG_REQUIRED_PHOTOS.has(key)) continue;

        const geo = image.geotag || {};
        const lat = Number(geo.latitude);
        const lon = Number(geo.longitude);
        const allowedSource = geo.source === 'EXIF_GPS' || geo.source === 'VISUAL_GEOTAG';
        const valid = geo.valid === true && allowedSource &&
            Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
            Number.isFinite(lon) && lon >= -180 && lon <= 180;

        if (!valid) {
            throw new Error(`${label} ditolak. Foto kondisi rumah wajib menggunakan geotag (GPS/EXIF atau cap GPS Map Camera dengan Lat/Long).`);
        }
    }
}

// --- ENDPOINTS ---
app.post('/api/dtsen', (req, res) => {
    const { keluarga, sosial_ekonomi, aset_keluarga, anggota_keluarga, dokumen } = req.body;
    
    if (!keluarga.nik_kepala_keluarga || keluarga.nik_kepala_keluarga.length < 16) return res.status(400).json({ error: 'NIK min 16 digit' });
    if (!keluarga.no_kk || keluarga.no_kk.length < 16) return res.status(400).json({ error: 'No KK min 16 digit' });

    try {
        validateGeotaggedPhotos(dokumen);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    const insertKeluarga = db.prepare(`INSERT INTO keluarga (nama_kepala_keluarga, nik_kepala_keluarga, no_kk, jumlah_anggota_keluarga, provinsi, kabupaten_kota, kecamatan, desa_kelurahan, kode_pos, rt_rw_dusun, alamat_lengkap, nama_jalan, nomor_rumah, sesuai_kk, latitude, longitude) VALUES (@nama_kepala_keluarga, @nik_kepala_keluarga, @no_kk, @jumlah_anggota_keluarga, @provinsi, @kabupaten_kota, @kecamatan, @desa_kelurahan, @kode_pos, @rt_rw_dusun, @alamat_lengkap, @nama_jalan, @nomor_rumah, @sesuai_kk, @latitude, @longitude)`);
    const insertSosEk = db.prepare(`INSERT INTO sosial_ekonomi (keluarga_id, jenis_bangunan, status_kepemilikan_bangunan, ada_keluarga_lain, jumlah_orang_tinggal, bukti_kepemilikan, luas_lantai_m2, fasilitas_bab, pembuangan_akhir_tinja, sumber_air_minum, sumber_penerangan, pengeluaran_listrik, pengeluaran_pulsa, pengeluaran_makanan_mingguan, total_pendapatan_bulanan, memiliki_tempat_berteduh_tetap, kepala_pengurus_masih_bekerja, khawatir_tidak_makan_setahun, pengeluaran_pangan_lebih_70, ada_pengeluaran_pakaian_setahun, pengeluaran_internet_bulanan, nomor_langganan_listrik, nomor_meter_listrik, besar_daya_listrik_va) VALUES (@keluarga_id, @jenis_bangunan, @status_kepemilikan_bangunan, @ada_keluarga_lain, @jumlah_orang_tinggal, @bukti_kepemilikan, @luas_lantai_m2, @fasilitas_bab, @pembuangan_akhir_tinja, @sumber_air_minum, @sumber_penerangan, @pengeluaran_listrik, @pengeluaran_pulsa, @pengeluaran_makanan_mingguan, @total_pendapatan_bulanan, @memiliki_tempat_berteduh_tetap, @kepala_pengurus_masih_bekerja, @khawatir_tidak_makan_setahun, @pengeluaran_pangan_lebih_70, @ada_pengeluaran_pakaian_setahun, @pengeluaran_internet_bulanan, @nomor_langganan_listrik, @nomor_meter_listrik, @besar_daya_listrik_va)`);
    const insertAset = db.prepare(`INSERT INTO aset_keluarga (keluarga_id, jenis_aset, kepemilikan, jumlah) VALUES (@keluarga_id, @jenis_aset, @kepemilikan, @jumlah)`);
    const insertAnggota = db.prepare(`INSERT INTO anggota_keluarga (keluarga_id, urutan_anggota, nama_lengkap, jenis_kelamin, status_hubungan_kepala_keluarga, status_partisipasi_sekolah, ijazah_tertinggi, pekerjaan_utama, keluhan_kesehatan_kronis, status_keberadaan, bekerja_seminggu_lalu, lapangan_usaha_pekerjaan_utama, memiliki_usaha_sendiri_bersama, pendapatan_sebulan_terakhir, status_disabilitas, jenis_disabilitas, status_kehamilan) VALUES (@keluarga_id, @urutan_anggota, @nama_lengkap, @jenis_kelamin, @status_hubungan_kepala_keluarga, @status_partisipasi_sekolah, @ijazah_tertinggi, @pekerjaan_utama, @keluhan_kesehatan_kronis, @status_keberadaan, @bekerja_seminggu_lalu, @lapangan_usaha_pekerjaan_utama, @memiliki_usaha_sendiri_bersama, @pendapatan_sebulan_terakhir, @status_disabilitas, @jenis_disabilitas, @status_kehamilan)`);
    const insertDokumen = db.prepare(`INSERT INTO dokumen_pendukung (keluarga_id, foto_kk, foto_rumah_depan, foto_rumah_dalam, foto_toilet_wc, nomor_kontak, keterangan_tambahan, usulan_bansos) VALUES (@keluarga_id, @foto_kk, @foto_rumah_depan, @foto_rumah_dalam, @foto_toilet_wc, @nomor_kontak, @keterangan_tambahan, @usulan_bansos)`);

    const transaction = db.transaction(() => {
        const kId = insertKeluarga.run(keluarga).lastInsertRowid;
        if(sosial_ekonomi) insertSosEk.run({ ...sosial_ekonomi, keluarga_id: kId });
        (aset_keluarga || []).forEach(a => insertAset.run({ ...a, keluarga_id: kId }));
        (anggota_keluarga || []).forEach(a => insertAnggota.run({ ...a, keluarga_id: kId }));
        if (dokumen) insertDokumen.run({
            keluarga_id: kId,
            foto_kk: dokumen.foto_kk ? JSON.stringify(dokumen.foto_kk) : null,
            foto_rumah_depan: dokumen.foto_rumah_depan ? JSON.stringify(dokumen.foto_rumah_depan) : null,
            foto_rumah_dalam: dokumen.foto_rumah_dalam ? JSON.stringify(dokumen.foto_rumah_dalam) : null,
            foto_toilet_wc: dokumen.foto_toilet_wc ? JSON.stringify(dokumen.foto_toilet_wc) : null,
            nomor_kontak: dokumen.nomor_kontak || null,
            keterangan_tambahan: dokumen.keterangan_tambahan || null,
            usulan_bansos: JSON.stringify(dokumen.usulan_bansos || [])
        });
        return kId;
    });

    try {
        res.json({ id: transaction() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/dtsen/:id', (req, res) => {
    const keluarga = db.prepare('SELECT * FROM keluarga WHERE id = ?').get(req.params.id);
    if (!keluarga) return res.status(404).json({ error: 'Not found' });
    keluarga.sosial_ekonomi = db.prepare('SELECT * FROM sosial_ekonomi WHERE keluarga_id = ?').get(keluarga.id);
    keluarga.aset_keluarga = db.prepare('SELECT * FROM aset_keluarga WHERE keluarga_id = ?').all(keluarga.id);
    keluarga.anggota_keluarga = db.prepare('SELECT * FROM anggota_keluarga WHERE keluarga_id = ? ORDER BY urutan_anggota ASC').all(keluarga.id);
    keluarga.dokumen = db.prepare('SELECT * FROM dokumen_pendukung WHERE keluarga_id = ?').get(keluarga.id);
    res.json(keluarga);
});

app.put('/api/dtsen/:id', (req, res) => {
    // Note: Skipped full atomic UPDATE tree for brevity. Add targeted UPDATE queries when partial edits are needed.
    res.status(501).json({ error: 'Use POST to create. PUT requires full tree diffing logic (YAGNI for form initial submit).' });
});

app.listen(3000, () => console.log('API running on :3000'));