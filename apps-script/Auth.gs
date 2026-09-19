/**
 * PHASE 2: Authentication
 * Source of truth untuk login dan manajemen sesi.
 */

function handleLogin(requestData) {
  const username = requestData.username;
  const password = requestData.password;

  if (!username || !password) {
    return createErrorResponse('Username dan password harus diisi.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('SPRINTER_MASTER');
  if (!sheet) return createErrorResponse('Database belum siap.', 500);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return createErrorResponse('Database kosong.', 401);
  const headers = data[0];

  const userIdx = headers.indexOf('username');
  const passIdx = headers.indexOf('password_hash');
  const statusIdx = headers.indexOf('status');

  let foundUser = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[userIdx] === username) {
      if (row[passIdx] === password) {
        if (row[statusIdx] !== 'ACTIVE') {
          return createErrorResponse('Akun Anda tidak aktif. Hubungi Admin.');
        }

        foundUser = {
          sprinter_id: row[headers.indexOf('sprinter_id')],
          employee_code: row[headers.indexOf('employee_code')],
          nama_sprinter: row[headers.indexOf('nama_sprinter')],
          no_hp: row[headers.indexOf('no_hp')],
          drop_point_id: row[headers.indexOf('drop_point_id')],
          role: row[headers.indexOf('role')]
        };
        break;
      } else {
        return createErrorResponse('Username atau password salah.', 401);
      }
    }
  }

  if (!foundUser) return createErrorResponse('Username atau password salah.', 401);

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(token, JSON.stringify(foundUser), 21600);

  return createJsonResponse({
    success: true,
    message: 'Login berhasil',
    data: { user: foundUser, token: token }
  });
}
