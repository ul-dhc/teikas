// Deploy as a web app: execute as owner, accept anonymous submissions.
// No read endpoint, email collection, or account lookup.
const FEEDBACK_SHEET_ID = '1IgdN_Y-OnftFJkTMwNr2PLCvxlqYWhCDtNu03rV_5GQ';
const FEEDBACK_TYPES = ['error', 'suggestion', 'data'];

function doPost(e) {
  const p = (e && e.parameter) || {};
  const result = {type: 'teikas-feedback', requestId: String(p.requestId || ''), ok: false};
  let origin = '';
  try {
    const match = String(p.pageUrl || '').match(/^(https?:\/\/[^/]+)(\/[^?#]*)/);
    if (!match || !/^(https:\/\/(dhc\.lu\.lv|ul-dhc\.github\.io)|http:\/\/(127\.0\.0\.1|localhost):\d+)$/.test(match[1]) || !match[2].startsWith('/teikas/')) throw new Error('Invalid page');
    origin = match[1];
    const description = String(p.description || '').trim();
    if (p.website || !FEEDBACK_TYPES.includes(p.kind) || description.length < 5 || description.length > 5000 || String(p.pageUrl).length > 20000 || !/^[a-f0-9-]{36}$/i.test(result.requestId)) throw new Error('Invalid submission');
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = SpreadsheetApp.openById(FEEDBACK_SHEET_ID).getSheetByName('Ziņojumi');
      if (!sheet) throw new Error('Missing sheet');
      // Retrying an unacknowledged request must not create a second report.
      const duplicate = sheet.getRange('F:F').createTextFinder(result.requestId).matchEntireCell(true).findNext();
      if (!duplicate) {
        const cache = CacheService.getScriptCache();
        const minute = 'feedback:' + Math.floor(Date.now() / 60000);
        const count = Number(cache.get(minute) || 0);
        if (count >= 30) throw new Error('Busy');
        cache.put(minute, String(count + 1), 120);
        const labels = {error:'Kļūda', suggestion:'Ieteikums', data:'Datu precizējums'};
        // User text is stored as literal text, never as a spreadsheet formula.
        const literal = value => /^[=+@\-\t\r]/.test(value) ? "'" + value : value;
        sheet.appendRow([new Date(), labels[p.kind], literal(description), literal(String(p.pageUrl)), 'Jauns', result.requestId]);
      }
      result.ok = true;
    } finally { lock.releaseLock(); }
  } catch (_) { /* Return no sheet contents or internal error details. */ }
  const payload = JSON.stringify(result).replace(/</g, '\\u003c');
  const target = JSON.stringify(origin || 'https://dhc.lu.lv');
  return HtmlService.createHtmlOutput('<!doctype html><script>window.top.postMessage(' + payload + ',' + target + ');</script>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet() {
  return ContentService.createTextOutput('TEIKAS feedback receiver');
}
