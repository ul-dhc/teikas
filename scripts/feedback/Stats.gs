// Private statistics gateway. Secrets live only in Script Properties.
// GOATCOUNTER_API_TOKEN: read-statistics key for ludhc.goatcounter.com.
// TEIKAS_STATS_PASSWORD: shared password entered by the project owner.
// A trailing four-digit year follows the current year in Europe/Riga.
function statsPost(p) {
  const result = {type:'teikas-stats',requestId:String(p.requestId || ''),ok:false};
  let origin = 'https://dhc.lu.lv';
  try {
    const match = String(p.clientUrl || '').match(/^(https?:\/\/[^/]+)(\/[^?#]*)/);
    if (!match || !/^(https:\/\/dhc\.lu\.lv|http:\/\/(127\.0\.0\.1|localhost):\d+)$/.test(match[1]) || match[2] !== '/teikas/stats/' || !/^[a-f0-9-]{36}$/i.test(result.requestId)) throw new Error('invalid');
    origin = match[1];
    const properties = PropertiesService.getScriptProperties();
    const configuredPassword = properties.getProperty('TEIKAS_STATS_PASSWORD');
    if (!configuredPassword) throw new Error('setup');
    const password = configuredPassword.replace(/\d{4}$/,Utilities.formatDate(new Date(),'Europe/Riga','yyyy'));
    const cache = CacheService.getScriptCache();
    const passwordHash = statsHash(password);
    if (p.action === 'stats-login') {
      const lock = LockService.getScriptLock();
      lock.waitLock(3000);
      try {
        const key = 'stats-attempt:' + Math.floor(Date.now()/60000);
        const count = Number(cache.get(key) || 0);
        if (count >= 10) throw new Error('busy');
        cache.put(key,String(count + 1),120);
      } finally { lock.releaseLock(); }
      const supplied = statsHash(String(p.password || '').slice(0,256));
      let difference = supplied.length ^ passwordHash.length;
      for (let i=0;i<passwordHash.length;i++) difference |= passwordHash.charCodeAt(i) ^ supplied.charCodeAt(i);
      if (difference) throw new Error('unauthorized');
      const token = Utilities.getUuid() + Utilities.getUuid();
      cache.put('stats-session:' + token,passwordHash,1800);
      result.token = token;
    } else {
      const token = String(p.token || '');
      if (!/^[a-f0-9-]{72}$/i.test(token) || cache.get('stats-session:' + token) !== passwordHash) throw new Error('unauthorized');
      if (p.action === 'stats-logout') cache.remove('stats-session:' + token);
      else if (p.action === 'stats-read') {
        const days = Number(p.days);
        if (![0,7,30,90,365].includes(days)) throw new Error('invalid');
        result.reports = statsReports();
        result.asOf = new Date().toISOString();
        try { result.visits = statsVisits(days); }
        catch (_) { result.visits = null; result.visitsError = 'unavailable'; }
      } else throw new Error('invalid');
    }
    result.ok = true;
  } catch (error) {
    result.code = ['invalid','setup','busy','unauthorized'].includes(error.message) ? error.message : 'unavailable';
  }
  const payload = JSON.stringify(result).replace(/</g,'\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><script>window.top.postMessage(' + payload + ',' + JSON.stringify(origin) + ');</script>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function statsHash(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8)
    .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}

function statsReports() {
  const sheet = SpreadsheetApp.openById(FEEDBACK_SHEET_ID).getSheetByName('Ziņojumi');
  if (!sheet) throw new Error('unavailable');
  const total = Math.max(0,sheet.getLastRow() - 1);
  const size = Math.min(total,1000);
  const rows = size ? sheet.getRange(total-size+2,1,size,5).getValues() : [];
  return {total,truncated:total>size,items:rows.reverse().map(row=>({
    date:row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ''),
    kind:String(row[1] || ''),description:String(row[2] || ''),page:String(row[3] || ''),status:String(row[4] || 'Jauns'),
  }))};
}

function statsIsTeikas(path,event) {
  const clean = String(path || '').split(/[?#]/)[0];
  return !event && (clean === '/teikas' || clean.startsWith('/teikas/')) && !/^\/teikas\/stats(?:\/|$)/.test(clean);
}

function statsApi(path,params) {
  const token = PropertiesService.getScriptProperties().getProperty('GOATCOUNTER_API_TOKEN');
  if (!token) throw new Error('unavailable');
  const query = Object.keys(params || {}).map(key=>encodeURIComponent(key)+'='+encodeURIComponent(params[key])).join('&');
  const url = 'https://ludhc.goatcounter.com/api/v0/' + path + (query ? '?' + query : '');
  const response = UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},muteHttpExceptions:true});
  if (response.getResponseCode() !== 200) throw new Error('unavailable');
  return JSON.parse(response.getContentText());
}

function statsPathIds() {
  const cache = CacheService.getScriptCache(), saved = cache.get('stats-path-ids:v1');
  if (saved) return JSON.parse(saved);
  let after = 0;
  const ids = [];
  for (let page=0;page<200;page++) {
    if (page) Utilities.sleep(300);
    const data = statsApi('paths',{Limit:200,After:after});
    const paths = data.paths || [];
    paths.forEach(path=>{if(statsIsTeikas(path.path,path.event))ids.push(path.id);});
    if (!data.more) { cache.put('stats-path-ids:v1',JSON.stringify(ids),120); return ids; }
    const next = Math.max(...paths.map(path=>Number(path.id)));
    if (!Number.isFinite(next) || next <= after) throw new Error('unavailable');
    after = next;
  }
  throw new Error('unavailable');
}

function statsVisits(days) {
  const cache = CacheService.getScriptCache(), key = 'stats-visits:v3:' + days, saved = cache.get(key);
  if (saved) return JSON.parse(saved);
  const today = Utilities.formatDate(new Date(),'Europe/Riga','yyyy-MM-dd');
  const last = new Date(today+'T00:00:00Z'), first = new Date(last);
  if (days === 0) first.setTime(Date.UTC(1970,0,1));
  else first.setUTCDate(first.getUTCDate()-days+1);
  const next = new Date(last); next.setUTCDate(next.getUTCDate()+1);
  const start = Utilities.parseDate(first.toISOString().slice(0,10),'Europe/Riga','yyyy-MM-dd').toISOString();
  const end = Utilities.parseDate(next.toISOString().slice(0,10),'Europe/Riga','yyyy-MM-dd').toISOString();
  const daily = {};
  for (let i=0;i<days;i++) { const date=new Date(first);date.setUTCDate(date.getUTCDate()+i);daily[date.toISOString().slice(0,10)]=0; }
  const ids = statsPathIds(), pages = [];
  for (let offset=0;offset<ids.length;offset+=80) {
    Utilities.sleep(300);
    const data = statsApi('stats/hits',{start,end,limit:100,group:'day',include_paths:ids.slice(offset,offset+80).join(',')});
    if (data.more) throw new Error('unavailable');
    (data.hits || []).forEach(hit=>{
      // Defend the boundary again even when GoatCounter has already filtered IDs.
      if (!statsIsTeikas(hit.path,hit.event)) return;
      pages.push({path:hit.path,title:hit.title || hit.path,count:Number(hit.count)||0});
      (hit.stats || []).forEach(day=>{if(/^\d{4}-\d{2}-\d{2}$/.test(day.day) && day.day >= first.toISOString().slice(0,10) && day.day <= today && (days === 0 || Object.prototype.hasOwnProperty.call(daily,day.day)))daily[day.day]=(daily[day.day] || 0)+(Number(day.daily)||0);});
    });
  }
  if (days === 0) {
    // Chart starts with the earliest recorded visit, rather than decades of empty days.
    const recorded = Object.keys(daily).filter(day=>daily[day]>0).sort();
    const cursor = new Date((recorded[0] || today)+'T00:00:00Z');
    while (cursor <= last) {
      const day=cursor.toISOString().slice(0,10);daily[day]=daily[day] || 0;cursor.setUTCDate(cursor.getUTCDate()+1);
    }
    Object.keys(daily).forEach(day=>{if(day<(recorded[0] || today))delete daily[day];});
  }
  const sections = {};
  pages.forEach(page=>{
    const part=page.path.split('/')[2] || 'home';
    const key=({teksti:'texts',teikas:'texts',personas:'people',temas:'themes',karte:'map',dati:'data','par-projektu':'about',home:'home'})[part] || 'other';
    sections[key]=(sections[key] || 0)+page.count;
  });
  const result = {sections:Object.keys(sections).map(key=>({key,count:sections[key]})),asOf:new Date().toISOString(),days,total:pages.reduce((sum,page)=>sum+page.count,0),pageCount:pages.length,
    daily:Object.keys(daily).sort().map(day=>({day,count:daily[day]})),pages:pages.sort((a,b)=>b.count-a.count).slice(0,50)};
  const serialized=JSON.stringify(result);
  // CacheService has a 100 KB value limit; a long history must still be returned.
  if (serialized.length < 45000) cache.put(key,serialized,120);
  return result;
}

// Run once as project owner to authorise the GoatCounter connection and check the key.
function checkTeikasStatsConnection() {
  const data = statsApi('paths',{Limit:1});
  console.log('GoatCounter connection OK; read-statistics permission confirmed.');
  return Boolean(data.paths);
}
