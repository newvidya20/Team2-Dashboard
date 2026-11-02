const SHEET_DEFINITIONS = {
  approvedUsers: ['email', 'displayName', 'role', 'capabilities', 'active', 'createdAt', 'updatedAt'],
  users: ['uid', 'email', 'displayName', 'role', 'capabilities', 'active', 'photoURL', 'passwordSalt', 'passwordHash', 'createdAt', 'updatedAt', 'linkedInUrl', 'whatsappNumber'],
  tasks: ['id', 'title', 'description', 'assignedTo', 'assignedToName', 'assigneeEmail', 'createdBy', 'createdByName', 'status', 'priority', 'dueDate', 'createdAt', 'updatedAt'],
  dailyReports: ['id', 'userId', 'userName', 'userEmail', 'date', 'whatIDid', 'leadsHandled', 'blockers', 'planTomorrow', 'createdAt', 'updatedAt'],
  weeklyReports: ['weekId', 'summary', 'totalLeads', 'updatedBy', 'updatedAt', 'sentAt'],
  calendarLeaves: ['id', 'userId', 'startDate', 'endDate', 'note', 'createdAt', 'updatedAt'],
  calendarNotes: ['id', 'date', 'userId', 'userName', 'title', 'note', 'createdAt', 'updatedAt'],
  activityLogs: ['id', 'userId', 'userName', 'userEmail', 'action', 'details', 'timestamp'],
  settings: ['key', 'value'],
};

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents);
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty('SHEETS_API_SECRET');
    const spreadsheetId = properties.getProperty('GOOGLE_SHEETS_ID');
    if (!expectedSecret || !spreadsheetId || request.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'The Sheets bridge is not authorized or is not configured.' });
    }

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const result = withLock(function () {
      switch (request.operation) {
        case 'initialize':
          initializeSpreadsheet(spreadsheet);
          return null;
        case 'bootstrapAdmin':
          return bootstrapAdmin(spreadsheet, request.approval, request.user);
        case 'listRowsMany':
          return listRowsMany(spreadsheet, request.sheetNames);
        case 'appendRows':
          appendRows(spreadsheet, request.sheetName, request.records);
          return null;
        case 'upsertRow':
          upsertRow(spreadsheet, request.sheetName, request.key, request.keyField, request.record);
          return null;
        case 'deleteRow':
          return deleteRow(spreadsheet, request.sheetName, request.key, request.keyField);
        case 'setSettings':
          setSettings(spreadsheet, request.settings);
          return null;
        default:
          throw new Error('Unsupported Sheets operation.');
      }
    });
    return jsonResponse({ ok: true, result: result });
  } catch (error) {
    console.error(error);
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'The Sheets operation failed.',
    });
  }
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function withLock(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function getSheet(spreadsheet, sheetName) {
  if (!Object.prototype.hasOwnProperty.call(SHEET_DEFINITIONS, sheetName)) {
    throw new Error('Unknown spreadsheet tab "' + sheetName + '".');
  }
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Spreadsheet tab "' + sheetName + '" was not found.');
  return sheet;
}

function initializeSpreadsheet(spreadsheet) {
  Object.keys(SHEET_DEFINITIONS).forEach(function (sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
    const headers = SHEET_DEFINITIONS[sheetName];
    const existingColumnCount = sheet.getLastColumn();
    const currentHeaderCount = Math.max(existingColumnCount, headers.length);
    const currentHeaders = sheet.getRange(1, 1, 1, currentHeaderCount).getDisplayValues()[0];
    if (currentHeaders.every(function (value) { return value === ''; })) {
      writeValues(sheet.getRange(1, 1, 1, headers.length), [headers]);
    } else if (
      currentHeaders.slice(0, existingColumnCount).some(function (header, index) {
        return index >= headers.length || header !== headers[index];
      }) ||
      currentHeaders.slice(headers.length).some(function (header) { return header !== ''; })
    ) {
      throw new Error('Spreadsheet tab "' + sheetName + '" has unexpected column headers.');
    } else if (sheet.getLastColumn() < headers.length) {
      writeValues(sheet.getRange(1, 1, 1, headers.length), [headers]);
    }
  });

  let approvals = listRows(spreadsheet, 'approvedUsers');
  let users = listRows(spreadsheet, 'users');
  const legacyEmail = 'abhiingole@gmail.com';
  const legacyApproval = approvals.find(function (row) { return row.email.toLowerCase() === legacyEmail; });
  if (legacyApproval && legacyApproval.active === 'true') {
    upsertRow(spreadsheet, 'approvedUsers', legacyEmail, 'email',
      Object.assign({}, legacyApproval, { active: 'false', updatedAt: new Date().toISOString() }));
    const legacyUser = users.find(function (row) { return row.email.toLowerCase() === legacyEmail; });
    if (legacyUser && legacyUser.uid) {
      upsertRow(spreadsheet, 'users', legacyUser.uid, 'uid',
        Object.assign({}, legacyUser, { active: 'false', updatedAt: new Date().toISOString() }));
    }
    approvals = listRows(spreadsheet, 'approvedUsers');
    users = listRows(spreadsheet, 'users');
  }

  const existingUserEmails = new Set(users.map(function (row) { return row.email.toLowerCase(); }));
  appendRows(spreadsheet, 'users', approvals
    .filter(function (approval) {
      return approval.active === 'true' && !existingUserEmails.has(approval.email.toLowerCase());
    })
    .map(function (approval) {
      return {
        uid: Utilities.getUuid(),
        email: approval.email.toLowerCase(),
        displayName: approval.displayName,
        role: approval.role,
        capabilities: approval.capabilities || '[]',
        active: 'true',
        photoURL: '',
        linkedInUrl: '',
        whatsappNumber: '',
        passwordSalt: '',
        passwordHash: '',
        createdAt: approval.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }));
}

function bootstrapAdmin(spreadsheet, approval, user) {
    if (!approval || !user || approval.role !== 'admin' || approval.active !== 'true' ||
        user.email !== approval.email || !user.passwordHash || !user.passwordSalt) {
      throw new Error('The initial administrator account is invalid.');
    }
    if (listRows(spreadsheet, 'approvedUsers').length || listRows(spreadsheet, 'users').length) {
      return false;
    }
    appendRows(spreadsheet, 'approvedUsers', [approval]);
    appendRows(spreadsheet, 'users', [user]);
    return true;
}

function listRowsMany(spreadsheet, sheetNames) {
  if (!Array.isArray(sheetNames)) throw new Error('A list of spreadsheet tabs is required.');
  return sheetNames.reduce(function (rowsBySheet, sheetName) {
    rowsBySheet[sheetName] = listRows(spreadsheet, sheetName);
    return rowsBySheet;
  }, {});
}

function listRows(spreadsheet, sheetName) {
  const headers = SHEET_DEFINITIONS[sheetName];
  const sheet = getSheet(spreadsheet, sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues()
    .map(function (values) {
      return headers.reduce(function (record, header, index) {
        record[header] = values[index] || '';
        return record;
      }, {});
    });
}

function appendRows(spreadsheet, sheetName, records) {
  if (!Array.isArray(records)) throw new Error('Rows must be supplied as a list.');
  if (!records.length) return;
  const headers = SHEET_DEFINITIONS[sheetName];
  const sheet = getSheet(spreadsheet, sheetName);
  const rows = records.map(function (record) {
    return headers.map(function (header) { return String(record[header] == null ? '' : record[header]); });
  });
  const startRow = Math.max(sheet.getLastRow() + 1, 2);
  writeValues(sheet.getRange(startRow, 1, rows.length, headers.length), rows);
}

function upsertRow(spreadsheet, sheetName, key, keyField, record) {
  const headers = SHEET_DEFINITIONS[sheetName];
  const keyColumn = headers && headers.indexOf(keyField);
  if (keyColumn === -1 || keyColumn === undefined) {
    throw new Error('Invalid key field "' + keyField + '" for spreadsheet tab "' + sheetName + '".');
  }
  const sheet = getSheet(spreadsheet, sheetName);
  const rows = listRows(spreadsheet, sheetName);
  const existingIndex = rows.findIndex(function (row) { return row[keyField] === String(key); });
  const rowNumber = existingIndex < 0 ? Math.max(sheet.getLastRow() + 1, 2) : existingIndex + 2;
  const values = headers.map(function (header) { return String(record[header] == null ? '' : record[header]); });
  writeValues(sheet.getRange(rowNumber, 1, 1, headers.length), [values]);
}

function deleteRow(spreadsheet, sheetName, key, keyField) {
  const headers = SHEET_DEFINITIONS[sheetName];
  if (!headers || headers.indexOf(keyField) < 0) {
    throw new Error('Invalid key field "' + keyField + '" for spreadsheet tab "' + sheetName + '".');
  }
  const sheet = getSheet(spreadsheet, sheetName);
  const row = listRows(spreadsheet, sheetName).findIndex(function (record) {
    return record[keyField] === String(key);
  });
  if (row < 0) return false;
  sheet.deleteRow(row + 2);
  return true;
}

function setSettings(spreadsheet, settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Settings must be supplied as an object.');
  }
  const sheet = getSheet(spreadsheet, 'settings');
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
  const rows = Object.keys(settings).map(function (key) {
    return [key, String(settings[key] == null ? '' : settings[key])];
  });
  if (rows.length) writeValues(sheet.getRange(2, 1, rows.length, 2), rows);
}

function writeValues(range, rows) {
  range.setNumberFormat('@');
  range.setValues(rows.map(function (row) {
    return row.map(function (value) {
      const text = String(value);
      return /^[=+\-@]/.test(text) ? "'" + text : text;
    });
  }));
}
