const DRIVE_FOLDER_ID = '1V5VamlpoX4qMNc5fXiRXQz2Gcz5swWUd';

const SHEET_NAME = 'DTSEN';

// Konstanta 4 foto yang dipakai di seluruh validasi dan penyimpanan
const PHOTO_FIELDS = [
  { key: 'foto_kk', label: 'Foto KK', geotagRequired: false },
  { key: 'foto_rumah_depan', label: 'Foto Rumah Depan', geotagRequired: true },
  { key: 'foto_rumah_dalam', label: 'Foto Rumah Dalam', geotagRequired: true },
  { key: 'foto_toilet_wc', label: 'Foto Toilet WC', geotagRequired: true }
];

function setupDTSEN() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let main = ss.getSheetByName(SHEET_NAME);

  if (!main) {
    main = ss.insertSheet(SHEET_NAME);
  }

  const oldNames = [
    'Keluarga',
    'SosEk',
    'Aset',
    'Anggota',
    'Dokumen'
  ];

  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();

    if (name === SHEET_NAME) {
      return;
    }

    if (
      oldNames.includes(name) ||
      name.indexOf('Aset_Lama') === 0
    ) {
      ss.deleteSheet(sheet);
    }
  });

  // Tidak menghapus data DTSEN jika sudah ada.
  if (main.getLastRow() === 0) {
    main
      .getRange('A1')
      .setValue(
        'Data DTSEN akan otomatis masuk mulai baris berikutnya.'
      );
  }

  main.setFrozenRows(1);
  SpreadsheetApp.flush();
}

function doGet() {
  return jsonResponse({
    success: true,
    message: 'DTSEN Web App aktif'
  });
}

// =====================================================
// VALIDASI FOTO WAJIB
// =====================================================

function validateRequiredImages(dokumen) {
  if (!dokumen || typeof dokumen !== 'object') {
    throw new Error('Data dokumen foto tidak ditemukan.');
  }

  PHOTO_FIELDS.forEach(item => {
    const image = dokumen[item.key];

    if (
      !image ||
      !image.data ||
      typeof image.data !== 'string' ||
      image.data.length < 50
    ) {
      throw new Error(
        item.label + ' wajib diupload sebelum dikirim.'
      );
    }

    // Foto KK boleh foto biasa. Hanya foto kondisi rumah yang wajib geotag.
    if (!item.geotagRequired) return;

    // Browser menerima GPS/EXIF maupun cap visual GPS Map Camera + Lat/Long.
    // Server tetap memeriksa penanda dan rentang koordinat sebelum menyimpan file.
    const geotag = image.geotag || {};
    const latitude = Number(geotag.latitude);
    const longitude = Number(geotag.longitude);
    const sourceValid = geotag.source === 'EXIF_GPS' || geotag.source === 'VISUAL_GEOTAG' || geotag.source === 'IN_APP_CAMERA';

    if (
      geotag.valid !== true ||
      !sourceValid ||
      !isFinite(latitude) ||
      !isFinite(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      throw new Error(
        item.label + ' ditolak. Foto kondisi rumah wajib menggunakan geotag (GPS/EXIF atau cap GPS Map Camera dengan Lat/Long).'
      );
    }
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    if (!lock.tryLock(30000)) {
      throw new Error(
        'Server sedang memproses data lain. Silakan coba beberapa detik lagi.'
      );
    }

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {
      throw new Error(
        'Payload tidak ditemukan.'
      );
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      throw new Error('Format payload JSON tidak valid.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    const id = Utilities.getUuid();
    const timestamp = new Date();

    const keluarga = payload.keluarga || {};
    const sosek = payload.sosial_ekonomi || {};
    const aset = payload.aset_keluarga || [];
    const anggota = payload.anggota_keluarga || [];
    const dokumen = payload.dokumen || {};

    // FOTO WAJIB
    validateRequiredImages(dokumen);

    const namaKepala = cleanText(keluarga.nama_kepala_keluarga);
    const nikKepala = cleanText(keluarga.nik_kepala_keluarga);

    if (!namaKepala) {
      throw new Error('Nama Kepala Keluarga tidak ditemukan.');
    }

    if (!nikKepala) {
      throw new Error('NIK Kepala Keluarga tidak ditemukan.');
    }

    // VALIDASI FORMAT NIK (16 DIGIT)
    validateNikFormat(nikKepala);

    const rowData = {
      'ID Data': id,
      'Timestamp': timestamp
    };

    // DATA KELUARGA
    Object.keys(keluarga).forEach(key => {
      rowData[formatHeader(key)] = normalizeValue(keluarga[key]);
    });

    // SOSIAL EKONOMI
    Object.keys(sosek).forEach(key => {
      rowData['SosEk - ' + formatHeader(key)] = normalizeValue(sosek[key]);
    });

    // DAFTAR ASET
    const assetConfig = {
      tabung_gas_3kg: '1. Tabung Gas 3 KG',
      tabung_gas_55kg_atau_lebih: '2. Tabung Gas 5,5 KG atau Lebih',
      televisi: '3. Televisi Layar Datar',
      kulkas: '4. Lemari Es / Kulkas',
      ac: '5. AC (Air Conditioner)',
      komputer_laptop: '6. Komputer / Laptop / Tablet',
      sepeda: '7. Sepeda',
      motor: '8. Sepeda Motor',
      mobil: '9. Mobil',
      telepon_rumah_pstn: '10. Telepon Rumah (PSTN)',
      emas: '11. Emas',
      kapal_perahu_motor: '12. Kapal / Perahu Motor',
      pemanas_air: '13. Pemanas Air (Water Heater)',
      perahu: '14. Perahu',
      smartphone: '15. Smartphone',
      rumah_lahan_lainnya: '16. Rumah / Lahan Lainnya'
    };

    aset.forEach(item => {
      if (!item || !item.jenis_aset) return;
      const label = assetConfig[item.jenis_aset] || formatHeader(item.jenis_aset);
      const punya = isTrue(item.kepemilikan);
      rowData['Aset - ' + label] = punya ? 'YA' : 'TIDAK';

      if (
        item.jumlah !== undefined &&
        item.jumlah !== null &&
        item.jumlah !== ''
      ) {
        rowData['Jumlah - ' + label] = normalizeValue(item.jumlah);
      }
    });

    // ANGGOTA KELUARGA
    anggota.forEach((person, index) => {
      const nomor = index + 1;
      Object.keys(person || {}).forEach(key => {
        if (key === 'urutan_anggota') return;
        rowData['Anggota ' + nomor + ' - ' + formatHeader(key)] = normalizeValue(person[key]);
      });
    });

    // DOKUMEN NON FOTO
    Object.keys(dokumen).forEach(key => {
      if (isImageKey(key)) return;
      rowData['Dokumen - ' + formatHeader(key)] = normalizeValue(dokumen[key]);
    });

    // FOTO DISIMPAN KE GOOGLE DRIVE
    PHOTO_FIELDS.forEach(config => {
      const fileData = dokumen[config.key];
      if (!fileData || !fileData.data) {
        throw new Error(config.label + ' wajib diupload.');
      }

      const prepared = saveImageToDrive(
        fileData,
        namaKepala,
        nikKepala,
        config.label
      );

      rowData[config.label + ' - Nama File'] = prepared.fileName;
      rowData[config.label + ' - Link Drive'] = prepared.url;
    });

    // BUAT HEADER DINAMIS
    ensureDynamicHeaders(sheet, Object.keys(rowData));
    const headers = getHeaders(sheet);

    // UPSERT BERDASARKAN NIK + NO KK KEPALA KELUARGA
    const existingRow = findRowByNikDanKK(
      sheet,
      nikKepala,
      keluarga.no_kk || keluarga.nokk || keluarga.nomor_kk
    );

    const targetRow = existingRow || Math.max(sheet.getLastRow() + 1, 2);

    // FORMAT NIK / KK / NOMOR SEBAGAI TEXT
    formatTextColumns(sheet);

    // BENTUK SATU BARIS
    const row = headers.map(header => {
      if (Object.prototype.hasOwnProperty.call(rowData, header)) {
        return rowData[header];
      }
      return '';
    });

    // SIMPAN BARIS
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();

    // RESPONSE SUKSES
    return jsonResponse({
      success: true,
      id: id,
      nama_kepala_keluarga: namaKepala,
      nik_kepala_keluarga: nikKepala
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error && error.message ? error.message : String(error)
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignore) {}
  }
}

// =========================================================
// SIMPAN FOTO KE GOOGLE DRIVE
// =========================================================

function saveImageToDrive(fileData, nama, nik, label) {
  if (!fileData || !fileData.data) {
    throw new Error('Data foto ' + label + ' tidak ditemukan.');
  }

  const dataUrl = String(fileData.data);
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Format foto ' + label + ' tidak valid (harus diawali "data:image/").');
  }

  const parts = dataUrl.split(',');
  if (parts.length < 2 || !parts[1]) {
    throw new Error('Data base64 foto ' + label + ' tidak valid atau kosong.');
  }

  const base64 = parts[1];
  const mimeType = (dataUrl.match(/^data:([^;]+);base64,/) || [])[1] || fileData.type || 'image/jpeg';
  const ext = mimeType === 'image/png' ? '.png' : (mimeType === 'image/webp' ? '.webp' : '.jpg');

  const root = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const folderName = sanitizeFileName(nik + '_' + nama);

  let folders = root.getFoldersByName(folderName);
  const folder = folders.hasNext()
    ? folders.next()
    : root.createFolder(folderName);

  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    mimeType,
    sanitizeFileName(nik + '_' + label + '_' + Date.now()) + ext
  );

  const file = folder.createFile(blob);

  return {
    fileName: file.getName(),
    url: file.getUrl()
  };
}

// =========================================================
// HEADER DINAMIS
// =========================================================

function ensureDynamicHeaders(sheet, requiredHeaders) {
  let existing = getHeaders(sheet);

  // Jika masih placeholder setup
  if (
    sheet.getLastRow() <= 1 &&
    existing.length === 1 &&
    existing[0] === 'Data DTSEN akan otomatis masuk mulai baris berikutnya.'
  ) {
    sheet.clear();
    existing = [];
  }

  if (existing.length === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
  } else {
    const missing = requiredHeaders.filter(header => !existing.includes(header));
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    }
  }

  const totalColumns = sheet.getLastColumn();
  if (totalColumns > 0) {
    sheet
      .getRange(1, 1, 1, totalColumns)
      .setFontWeight('bold')
      .setWrap(true)
      .setVerticalAlignment('middle');
    sheet.setFrozenRows(1);
  }
}

// =========================================================
// AMBIL HEADER
// =========================================================

function getHeaders(sheet) {
  if (sheet.getLastColumn() === 0) {
    return [];
  }

  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(value => String(value).trim());
}

// =========================================================
// FORMAT NIK / KK / NOMOR SEBAGAI TEXT
// =========================================================

function formatTextColumns(sheet) {
  const headers = getHeaders(sheet);

  headers.forEach((header, index) => {
    const lower = header.toLowerCase();
    const harusText =
      lower.indexOf('nik') !== -1 ||
      lower.indexOf('no kk') !== -1 ||
      lower.indexOf('nomor kartu keluarga') !== -1 ||
      lower.indexOf('nomor meter') !== -1 ||
      lower.indexOf('nomor langganan') !== -1 ||
      lower.indexOf('id pelanggan') !== -1 ||
      lower.indexOf('nomor kontak') !== -1;

    if (harusText) {
      sheet
        .getRange(2, index + 1, Math.max(sheet.getMaxRows() - 1, 1), 1)
        .setNumberFormat('@');
    }
  });
}

// =========================================================
// NORMALISASI VALUE
// =========================================================

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (value === true) {
    return 'YA';
  }

  if (value === false) {
    return 'TIDAK';
  }

  if (typeof value === 'object') {
    if (value.name) {
      return String(value.name);
    }
    return JSON.stringify(value);
  }

  return String(value);
}

// =========================================================
// UBAH KEY JADI HEADER
// =========================================================

function formatHeader(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

// =========================================================
// KEY FOTO
// =========================================================

function isImageKey(key) {
  return PHOTO_FIELDS.some(field => field.key === key);
}

// =========================================================
// CEK TRUE / YA
// =========================================================

function isTrue(value) {
  const normalized = String(value).toLowerCase();
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    normalized === 'true' ||
    normalized === 'ya'
  );
}

// =========================================================
// CLEAN TEXT
// =========================================================

function cleanText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

// =========================================================
// FILE NAME
// =========================================================

function sanitizeFileName(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

// =========================================================
// JSON RESPONSE
// =========================================================

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================
// UPSERT BERDASARKAN NIK + NO KK KEPALA KELUARGA
// =====================================================

function findRowByNikDanKK(sheet, nikKepala, noKK) {
  const headers = getHeaders(sheet);

  const nikColumn = headers.findIndex(header =>
    String(header).toLowerCase().includes('nik kepala keluarga')
  );

  const kkColumn = headers.findIndex(header =>
    String(header).toLowerCase().includes('no kk')
  );

  if (nikColumn === -1 || kkColumn === -1) return null;
  if (sheet.getLastRow() <= 1) return null;

  const values = sheet.getRange(
    2,
    1,
    sheet.getLastRow() - 1,
    sheet.getLastColumn()
  ).getValues();

  for (let i = 0; i < values.length; i++) {
    const existingNik = String(values[i][nikColumn]).trim();
    const existingKK = String(values[i][kkColumn]).trim();

    if (
      existingNik === String(nikKepala).trim() &&
      existingKK === String(noKK).trim()
    ) {
      return i + 2;
    }
  }

  return null;
}

// =====================================================
// VALIDASI FORMAT NIK
// =====================================================

function validateNikFormat(nik) {
  if (!nik) {
    throw new Error('NIK Kepala Keluarga kosong.');
  }

  const value = String(nik).trim();

  if (!/^\d{16}$/.test(value)) {
    throw new Error('Format NIK tidak valid. NIK harus terdiri dari 16 angka.');
  }

  return true;
}
