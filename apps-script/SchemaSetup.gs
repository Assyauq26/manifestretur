/**
 * PHASE 1: Database Schema Setup
 * Script ini digunakan untuk menginisialisasi Google Sheets sebagai database.
 * Jalankan fungsi 'setupDatabaseSchema' sekali saat pertama kali menyiapkan project.
 */

function setupDatabaseSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetsConfig = [
    {
      name: 'SPRINTER_MASTER',
      headers: [
        'sprinter_id', 'employee_code', 'nama_sprinter', 'no_hp', 'drop_point_id',
        'username', 'password_hash', 'role', 'status', 'created_at', 'updated_at'
      ]
    },
    {
      name: 'SELLER_MASTER',
      headers: [
        'seller_id', 'seller_name', 'receiver_name', 'phone', 'status'
      ]
    },
    {
      name: 'DROP_POINT_MASTER',
      headers: [
        'drop_point_id', 'code', 'name', 'address', 'status'
      ]
    },
    {
      name: 'MANIFEST',
      headers: [
        'manifest_id', 'manifest_number', 'manifest_date', 'shift', 'shift_name',
        'drop_point_id', 'drop_point_name', 'sprinter_id', 'sprinter_name', 'sprinter_phone',
        'seller_id', 'seller_name', 'receiver_name', 'receiver_phone', 'total_awb',
        'status', 'pdf_file_id', 'pdf_url', 'created_at', 'created_by', 'updated_at',
        'updated_by', 'generated_at', 'handover_at', 'completed_at'
      ]
    },
    {
      name: 'MANIFEST_AWB',
      headers: [
        'manifest_awb_id', 'manifest_id', 'awb', 'sequence', 'input_method',
        'scanned_at', 'scanned_by', 'status'
      ]
    },
    {
      name: 'HANDOVER',
      headers: [
        'handover_id', 'manifest_id', 'seller_id', 'seller_name', 'handover_at',
        'handover_by', 'photo_file_id', 'photo_url', 'signature_file_id',
        'signature_url', 'notes', 'status'
      ]
    },
    {
      name: 'AUDIT_LOG',
      headers: [
        'timestamp', 'user_id', 'user_name', 'role', 'action', 'object_type',
        'object_id', 'detail'
      ]
    },
    {
      name: 'CONFIG',
      headers: [
        'key', 'value', 'description'
      ]
    }
  ];

  sheetsConfig.forEach(config => {
    let sheet = ss.getSheetByName(config.name);
    if (!sheet) sheet = ss.insertSheet(config.name);

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
      sheet.getRange(1, 1, 1, config.headers.length)
        .setFontWeight('bold')
        .setBackground('#f3f4f6');
      sheet.setFrozenRows(1);
    }
  });

  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) ss.deleteSheet(sheet1);

  Logger.log('Database schema setup complete.');
}

function seedDummyData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const dpSheet = ss.getSheetByName('DROP_POINT_MASTER');
  if (dpSheet.getLastRow() === 1) {
    dpSheet.appendRow([
      'DP001', 'BTG', 'Drop Point Batang',
      'Jl. Jenderal Sudirman No.1, Batang', 'ACTIVE'
    ]);
  }

  const sprinterSheet = ss.getSheetByName('SPRINTER_MASTER');
  if (sprinterSheet.getLastRow() === 1) {
    sprinterSheet.appendRow([
      'SP001', 'EMP123', 'Ahmad Sprinter', '08123456789', 'DP001',
      'ahmad', '123456', 'SPRINTER', 'ACTIVE', new Date(), new Date()
    ]);
    sprinterSheet.appendRow([
      'AD001', 'EMP999', 'Budi Admin', '08987654321', 'DP001',
      'admin', 'admin123', 'ADMIN', 'ACTIVE', new Date(), new Date()
    ]);
  }

  const sellerSheet = ss.getSheetByName('SELLER_MASTER');
  if (sellerSheet.getLastRow() === 1) {
    sellerSheet.appendRow(['SEL001', 'Toko ABC', 'Bapak C', '08111111111', 'ACTIVE']);
    sellerSheet.appendRow(['SEL002', 'Hijab Style', 'Mbak H', '08222222222', 'ACTIVE']);
  }

  Logger.log('Dummy data seeded.');
}
