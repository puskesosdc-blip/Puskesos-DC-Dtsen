const DRIVE_FOLDER_ID = '1V5VamlpoX4qMNc5fXiRXQz2Gcz5swWUd';

const SHEET_NAME = 'DTSEN';

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

  const requiredImages = [
    {
      key: 'foto_kk',
      label: 'Foto KK'
    },
    {
      key: 'foto_rumah_depan',
      label: 'Foto Rumah Depan'
    },
    {
      key: 'foto_rumah_dalam',
      label: 'Foto Rumah Dalam'
    },
    {
      key: 'foto_toilet_wc',
      label: 'Foto Toilet WC'
    }
  ];

  requiredImages.forEach(item => {

    const image = dokumen[item.key];

    if (
      !image ||
      !image.data ||
      String(image.data).length < 50
    ) {
      throw new Error(
        item.label + ' wajib diupload sebelum dikirim.'
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

    const payload = JSON.parse(
      e.postData.contents
    );

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    let sheet =
      ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(
        SHEET_NAME
      );
    }

    const id =
      Utilities.getUuid();

    const timestamp =
      new Date();

    const keluarga =
      payload.keluarga || {};

    const sosek =
      payload.sosial_ekonomi || {};

    const aset =
      payload.aset_keluarga || [];

    const anggota =
      payload.anggota_keluarga || [];

    const dokumen =
      payload.dokumen || {};

    // FOTO WAJIB
    validateRequiredImages(dokumen);

    const namaKepala =
      cleanText(
        keluarga.nama_kepala_keluarga
      );

    const nikKepala =
      cleanText(
        keluarga.nik_kepala_keluarga
      );

    if (!namaKepala) {
      throw new Error(
        'Nama Kepala Keluarga tidak ditemukan.'
      );
    }

    if (!nikKepala) {
      throw new Error(
        'NIK Kepala Keluarga tidak ditemukan.'
      );
    }


    // =====================================================
    // VALIDASI NIK KEPALA KELUARGA
    // 1 NIK = 1 KELUARGA
    // =====================================================

    validateNIKKepalaDuplikat(
      sheet,
      nikKepala
    );

    validateNikFormat(
      nikKepala
    );


    // =====================================================
    // SATU OBJECT = SATU BARIS KELUARGA
    // =====================================================

    const rowData = {
      'ID Data': id,
      'Timestamp': timestamp
    };


    // =====================================================
    // DATA KELUARGA
    // =====================================================

    Object.keys(keluarga)
      .forEach(key => {

        rowData[
          formatHeader(key)
        ] =
          normalizeValue(
            keluarga[key]
          );

      });


    // =====================================================
    // SOSIAL EKONOMI
    // =====================================================

    Object.keys(sosek)
      .forEach(key => {

        rowData[
          'SosEk - ' +
          formatHeader(key)
        ] =
          normalizeValue(
            sosek[key]
          );

      });


    // =====================================================
    // DAFTAR ASET
    // =====================================================

    const assetConfig = {

      tabung_gas_3kg:
        '1. Tabung Gas 3 KG',

      tabung_gas_55kg_atau_lebih:
        '2. Tabung Gas 5,5 KG atau Lebih',

      televisi:
        '3. Televisi Layar Datar',

      kulkas:
        '4. Lemari Es / Kulkas',

      ac:
        '5. AC (Air Conditioner)',

      komputer_laptop:
        '6. Komputer / Laptop / Tablet',

      sepeda:
        '7. Sepeda',

      motor:
        '8. Sepeda Motor',

      mobil:
        '9. Mobil',

      telepon_rumah_pstn:
        '10. Telepon Rumah (PSTN)',

      emas:
        '11. Emas',

      kapal_perahu_motor:
        '12. Kapal / Perahu Motor',

      pemanas_air:
        '13. Pemanas Air (Water Heater)',

      perahu:
        '14. Perahu',

      smartphone:
        '15. Smartphone',

      rumah_lahan_lainnya:
        '16. Rumah / Lahan Lainnya'

    };


    // =====================================================
    // DATA ASET
    // =====================================================

    aset.forEach(item => {

      if (
        !item ||
        !item.jenis_aset
      ) {
        return;
      }

      const label =
        assetConfig[
          item.jenis_aset
        ] ||
        formatHeader(
          item.jenis_aset
        );

      const punya =
        isTrue(
          item.kepemilikan
        );

      rowData[
        'Aset - ' + label
      ] =
        punya
          ? 'YA'
          : 'TIDAK';

      if (
        item.jumlah !== undefined &&
        item.jumlah !== null &&
        item.jumlah !== ''
      ) {

        rowData[
          'Jumlah - ' + label
        ] =
          normalizeValue(
            item.jumlah
          );

      }

    });


    // =====================================================
    // ANGGOTA KELUARGA
    // =====================================================

    anggota.forEach(
      (person, index) => {

        const nomor =
          index + 1;

        Object.keys(
          person || {}
        )
          .forEach(key => {

            if (
              key ===
              'urutan_anggota'
            ) {
              return;
            }

            rowData[
              'Anggota ' +
              nomor +
              ' - ' +
              formatHeader(key)
            ] =
              normalizeValue(
                person[key]
              );

          });

      }
    );


    // =====================================================
    // DOKUMEN NON FOTO
    // =====================================================

    Object.keys(dokumen)
      .forEach(key => {

        if (
          isImageKey(key)
        ) {
          return;
        }

        rowData[
          'Dokumen - ' +
          formatHeader(key)
        ] =
          normalizeValue(
            dokumen[key]
          );

      });


    // =====================================================
    // FOTO
    // TIDAK MENGGUNAKAN GOOGLE DRIVE
    // =====================================================

    const imageFields = [

      {
        key: 'foto_kk',
        label: 'Foto KK'
      },

      {
        key: 'foto_rumah_depan',
        label: 'Foto Rumah Depan'
      },

      {
        key: 'foto_rumah_dalam',
        label: 'Foto Rumah Dalam'
      },

      {
        key: 'foto_toilet_wc',
        label: 'Foto Toilet WC'
      }

    ];


    const cellImages = {};


    imageFields.forEach(config => {

      const fileData =
        dokumen[
          config.key
        ];

      if (
        !fileData ||
        !fileData.data
      ) {
        throw new Error(
          config.label + ' wajib diupload.'
        );
      }

      const prepared =
        saveImageToDrive(
          fileData,
          namaKepala,
          nikKepala,
          config.label
        );

      rowData[
        config.label +
        ' - Nama File'
      ] =
        prepared.fileName;

      rowData[
        config.label +
        ' - Link Drive'
      ] =
        prepared.url;

      // Kolom preview disiapkan dari awal
      rowData[
        config.label +
        ' - Preview'
      ] = '';

      cellImages[
        config.label
      ] = null;

    });


    // =====================================================
    // BUAT HEADER DINAMIS
    // =====================================================

    ensureDynamicHeaders(
      sheet,
      Object.keys(rowData)
    );


    const headers =
      getHeaders(sheet);


    // =====================================================
    // UPSERT BERDASARKAN NIK KEPALA KELUARGA
    // Jika NIK sudah ada -> update baris lama
    // Jika NIK baru -> tambah baris baru
    // =====================================================

    const existingRow = findRowByNikDanKK(
      sheet,
      nikKepala,
      keluarga.no_kk || keluarga.nokk || keluarga.nomor_kk
    );

    const targetRow = existingRow ||
      Math.max(
        sheet.getLastRow() + 1,
        2
      );


    // =====================================================
    // FORMAT NIK / KK / NOMOR SEBAGAI TEXT
    // =====================================================

    formatTextColumns(
      sheet
    );


    // =====================================================
    // BENTUK SATU BARIS
    // =====================================================

    const row =
      headers.map(header => {

        if (
          Object.prototype
            .hasOwnProperty
            .call(
              rowData,
              header
            )
        ) {
          return rowData[
            header
          ];
        }

        return '';

      });


    // =====================================================
    // SIMPAN BARIS
    // =====================================================

    sheet
      .getRange(
        targetRow,
        1,
        1,
        row.length
      )
      .setValues(
        [row]
      );


    // =====================================================
    // PREVIEW FOTO DI DALAM SEL
    // =====================================================

    insertCellImages(

      sheet,

      targetRow,

      cellImages

    );


    if (
      Object.keys(
        cellImages
      ).length > 0
    ) {

      sheet.setRowHeight(
        targetRow,
        110
      );

    }


    SpreadsheetApp.flush();


    // =====================================================
    // RESPONSE SUKSES
    // =====================================================

    return jsonResponse({

      success: true,

      id: id,

      nama_kepala_keluarga:
        namaKepala,

      nik_kepala_keluarga:
        nikKepala

    });


  } catch (error) {


    return jsonResponse({

      success: false,

      error:
        error &&
        error.message

          ? error.message

          : String(error)

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

  const root = DriveApp.getFolderById(DRIVE_FOLDER_ID);

  const folderName = sanitizeFileName(nik + '_' + nama);

  let folders = root.getFoldersByName(folderName);

  const folder = folders.hasNext()
    ? folders.next()
    : root.createFolder(folderName);

  const base64 = String(fileData.data).split(',')[1];

  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    fileData.type || 'image/jpeg',
    sanitizeFileName(nik + '_' + label + '_' + Date.now())
  );

  const file = folder.createFile(blob);

  return {
    fileName: file.getName(),
    cellImage: null,
    url: file.getUrl()
  };
}

// =========================================================
// SIAPKAN CELL IMAGE
// =========================================================

function prepareCellImage(
  fileData,
  nama,
  nik,
  label
) {

  const dataUrl =
    String(
      fileData.data || ''
    );

  if (!dataUrl) {

    throw new Error(
      'Data gambar tidak ditemukan: ' +
      label
    );

  }

  if (
    dataUrl.indexOf(
      'data:image/'
    ) !== 0
  ) {

    throw new Error(
      'Format gambar tidak valid: ' +
      label
    );

  }

  const mimeType =
    fileData.type ||
    (
      dataUrl.match(
        /^data:([^;]+);base64,/
      ) || []
    )[1] ||
    'image/jpeg';

  const extension =
    getExtension(
      fileData.name,
      mimeType
    );

  const fileName =

    sanitizeFileName(
      nik
    ) +

    '_' +

    sanitizeFileName(
      nama
    ) +

    '_' +

    sanitizeFileName(
      label
    ) +

    '_' +

    Date.now() +

    extension;

  const cellImage =
    SpreadsheetApp
      .newCellImage()
      .setSourceUrl(
        dataUrl
      )
      .setAltTextTitle(
        label
      )
      .setAltTextDescription(
        fileName
      )
      .build();

  return {

    fileName:
      fileName,

    cellImage:
      cellImage

  };

}


// =========================================================
// TAMPILKAN FOTO DI DALAM SEL SPREADSHEET
// =========================================================

function insertCellImages(
  sheet,
  rowNumber,
  cellImages
) {

  const headers =
    getHeaders(
      sheet
    );

  Object.keys(
    cellImages
  )
    .forEach(label => {

      const previewHeader =

        label +
        ' - Preview';

      const colIndex =

        headers.indexOf(
          previewHeader
        );

      if (
        colIndex === -1
      ) {

        return;

      }

      const cell =
        sheet.getRange(
          rowNumber,
          colIndex + 1
        );

      try {

        // Gambar menjadi nilai sel,
        // bukan gambar mengambang di atas sel.
        if (cellImages[label]) {
          cell.setValue(
            cellImages[label]
          );
        }

        cell
          .setHorizontalAlignment(
            'center'
          )
          .setVerticalAlignment(
            'middle'
          );

        sheet.setColumnWidth(
          colIndex + 1,
          140
        );

      } catch (error) {

        cell.setValue(
          'Gambar gagal dimuat: ' +
          error.message
        );

      }

    });

  if (
    Object.keys(
      cellImages
    ).length > 0
  ) {

    sheet.setRowHeight(
      rowNumber,
      110
    );

  }

}


// =========================================================
// HEADER DINAMIS
// =========================================================

function ensureDynamicHeaders(
  sheet,
  requiredHeaders
) {

  let existing =
    getHeaders(sheet);


  // Jika masih placeholder setup
  if (

    sheet.getLastRow() <= 1 &&

    existing.length === 1 &&

    existing[0] ===
      'Data DTSEN akan otomatis masuk mulai baris berikutnya.'

  ) {

    sheet.clear();

    existing = [];

  }


  if (
    existing.length === 0
  ) {


    sheet
      .getRange(

        1,

        1,

        1,

        requiredHeaders.length

      )
      .setValues(

        [requiredHeaders]

      );


  } else {


    const missing =
      requiredHeaders.filter(

        header =>
          !existing.includes(
            header
          )

      );


    if (
      missing.length
    ) {


      sheet
        .getRange(

          1,

          existing.length + 1,

          1,

          missing.length

        )
        .setValues(

          [missing]

        );

    }

  }


  const totalColumns =
    sheet.getLastColumn();


  if (
    totalColumns > 0
  ) {


    sheet
      .getRange(

        1,

        1,

        1,

        totalColumns

      )
      .setFontWeight(
        'bold'
      )
      .setWrap(
        true
      )
      .setVerticalAlignment(
        'middle'
      );


    sheet.setFrozenRows(
      1
    );

  }

}


// =========================================================
// AMBIL HEADER
// =========================================================

function getHeaders(
  sheet
) {

  if (
    sheet.getLastColumn() === 0
  ) {

    return [];

  }


  return sheet
    .getRange(

      1,

      1,

      1,

      sheet.getLastColumn()

    )
    .getValues()[0]
    .map(

      value =>
        String(
          value
        ).trim()

    );

}


// =========================================================
// FORMAT NIK / KK / NOMOR SEBAGAI TEXT
// =========================================================

function formatTextColumns(
  sheet
) {

  const headers =
    getHeaders(sheet);


  headers.forEach(
    (header, index) => {


      const lower =
        header
          .toLowerCase();


      const harusText =

        lower.indexOf(
          'nik'
        ) !== -1

        ||

        lower.indexOf(
          'no kk'
        ) !== -1

        ||

        lower.indexOf(
          'nomor kartu keluarga'
        ) !== -1

        ||

        lower.indexOf(
          'nomor meter'
        ) !== -1

        ||

        lower.indexOf(
          'nomor langganan'
        ) !== -1

        ||

        lower.indexOf(
          'id pelanggan'
        ) !== -1

        ||

        lower.indexOf(
          'nomor kontak'
        ) !== -1;


      if (
        harusText
      ) {


        sheet
          .getRange(

            2,

            index + 1,

            Math.max(

              sheet.getMaxRows() - 1,

              1

            ),

            1

          )
          .setNumberFormat(
            '@'
          );

      }

    }
  );

}


// =========================================================
// NORMALISASI VALUE
// =========================================================

function normalizeValue(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';

  }


  if (
    Array.isArray(
      value
    )
  ) {

    return value.join(
      ', '
    );

  }


  if (
    value === true
  ) {

    return 'YA';

  }


  if (
    value === false
  ) {

    return 'TIDAK';

  }


  if (
    typeof value ===
    'object'
  ) {


    if (
      value.name
    ) {

      return String(
        value.name
      );

    }


    return JSON.stringify(
      value
    );

  }


  return String(
    value
  );

}


// =========================================================
// UBAH KEY JADI HEADER
// =========================================================

function formatHeader(
  key
) {

  return String(
    key
  )
    .replace(
      /_/g,
      ' '
    )
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );

}


// =========================================================
// KEY FOTO
// =========================================================

function isImageKey(
  key
) {

  return [

    'foto_kk',

    'foto_rumah_depan',

    'foto_rumah_dalam',

    'foto_toilet_wc'

  ].includes(
    key
  );

}


// =========================================================
// CEK TRUE / YA
// =========================================================

function isTrue(
  value
) {

  const normalized =
    String(
      value
    )
      .toLowerCase();


  return (

    value === true

    ||

    value === 1

    ||

    value === '1'

    ||

    normalized ===
      'true'

    ||

    normalized ===
      'ya'

  );

}


// =========================================================
// CLEAN TEXT
// =========================================================

function cleanText(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';

  }


  return String(
    value
  ).trim();

}


// =========================================================
// FILE NAME
// =========================================================

function sanitizeFileName(
  value
) {

  return String(
    value || ''
  )
    .replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );

}


// =========================================================
// EXTENSION
// =========================================================

function getExtension(
  name,
  mimeType
) {

  if (
    name &&
    name.indexOf('.') !== -1
  ) {

    return (
      '.' +
      name
        .split('.')
        .pop()
        .toLowerCase()
    );

  }


  if (
    mimeType ===
    'image/png'
  ) {

    return '.png';

  }


  if (
    mimeType ===
    'image/webp'
  ) {

    return '.webp';

  }


  return '.jpg';

}


// =========================================================
// JSON RESPONSE
// =========================================================

function jsonResponse(
  obj
) {

  return ContentService
    .createTextOutput(

      JSON.stringify(
        obj
      )

    )
    .setMimeType(

      ContentService
        .MimeType
        .JSON

    );

}

// =====================================================
// VALIDASI DUPLIKAT NIK KEPALA KELUARGA
// =====================================================
function validateNIKKepalaDuplikat(sheet, nikKepala) {

  if (!nikKepala) return false;

  const headers = getHeaders(sheet);

  const nikColumn = headers.findIndex(header =>
    String(header)
      .toLowerCase()
      .replace(/_/g, ' ')
      .includes('nik kepala keluarga')
  );

  if (nikColumn === -1) return false;

  if (sheet.getLastRow() <= 1) return false;

  const existingNik = sheet
    .getRange(2, nikColumn + 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .flat()
    .map(v => String(v).trim());

  return existingNik.includes(String(nikKepala).trim());
}


// =====================================================
// CARI BARIS BERDASARKAN NIK KEPALA KELUARGA
// =====================================================
function findRowByNikKepala(sheet, nikKepala) {

  const headers = getHeaders(sheet);

  const nikColumn = headers.findIndex(header =>
    String(header)
      .toLowerCase()
      .replace(/_/g, ' ')
      .includes('nik kepala keluarga')
  );

  if (nikColumn === -1) return null;

  if (sheet.getLastRow() <= 1) return null;

  const values = sheet
    .getRange(
      2,
      nikColumn + 1,
      sheet.getLastRow() - 1,
      1
    )
    .getValues()
    .flat();

  for (let i = 0; i < values.length; i++) {
    if (
      String(values[i]).trim() ===
      String(nikKepala).trim()
    ) {
      return i + 2;
    }
  }

  return null;
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
// BACKWARD COMPATIBILITY
// Mencegah error deployment lama yang masih memanggil nama lama
// validateNikKepalaDuplikat
// =====================================================
function validateNikKepalaDuplikat(sheet, nikKepala) {
  return validateNIKKepalaDuplikat(sheet, nikKepala);
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
