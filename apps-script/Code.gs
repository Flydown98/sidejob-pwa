const SHEETS={PRODUCTS:'Products',WORKERS:'Workers',ENTRIES:'Entries',SETTINGS:'Settings'};

/**
 * 최초 1회 실행: DB 스프레드시트/백업 폴더/주인장 A/샘플 품목을 생성합니다.
 * 실행 후 로그에 출력되는 WEB_APP_ACCESS_KEY를 안전하게 보관하세요.
 */
function setupSystem(){
  const props=PropertiesService.getScriptProperties();
  let ssId=props.getProperty('DB_SPREADSHEET_ID');
  let folderId=props.getProperty('BACKUP_FOLDER_ID');
  let ss;
  if(!ssId){
    ss=SpreadsheetApp.create('부업_작업정산_DB');
    ssId=ss.getId();props.setProperty('DB_SPREADSHEET_ID',ssId);
    ss.getSheets()[0].setName(SHEETS.PRODUCTS);
  }else{
    ss=SpreadsheetApp.openById(ssId);
  }
  ensureSheet_(ss,SHEETS.PRODUCTS,['id','name','ownerPrice','active','createdAt','updatedAt']);
  ensureSheet_(ss,SHEETS.WORKERS,['id','name','role','active','createdAt','updatedAt']);
  ensureSheet_(ss,SHEETS.ENTRIES,['id','date','workerId','productId','qty','ownerPriceSnapshot','workerPriceSnapshot','reportPriceSnapshot','createdAt','active','deletedAt']);
  ensureSheet_(ss,SHEETS.SETTINGS,['key','value','updatedAt']);
  const workers=readObjects_(SHEETS.WORKERS,true);
  if(!workers.some(x=>String(x.id)==='owner-a')){
    appendObject_(ss.getSheetByName(SHEETS.WORKERS),['id','name','role','active','createdAt','updatedAt'],{id:'owner-a',name:'A',role:'owner',active:true,createdAt:new Date(),updatedAt:new Date()});
  }
  if(readObjects_(SHEETS.PRODUCTS).length===0){
    appendObject_(ss.getSheetByName(SHEETS.PRODUCTS),['id','name','ownerPrice','active','createdAt','updatedAt'],{id:Utilities.getUuid(),name:'블루메모리',ownerPrice:200,active:true,createdAt:new Date(),updatedAt:new Date()});
  }
  if(!folderId){const f=DriveApp.createFolder('부업_작업정산_자동백업');folderId=f.getId();props.setProperty('BACKUP_FOLDER_ID',folderId)}
  if(!props.getProperty('ACCESS_KEY'))props.setProperty('ACCESS_KEY',makeAccessKey_());
  installDailyBackupTrigger();
  Logger.log('DB Spreadsheet: https://docs.google.com/spreadsheets/d/'+ssId);
  Logger.log('Backup Folder ID: '+folderId);
  Logger.log('WEB_APP_ACCESS_KEY: '+props.getProperty('ACCESS_KEY'));
  return {spreadsheetId:ssId,backupFolderId:folderId,accessKey:props.getProperty('ACCESS_KEY')};
}

function doGet(){return json_({ok:true,data:{service:'sidejob-settlement-api',status:'ready'}})}
function doPost(e){
  try{
    const req=JSON.parse(e.postData?.contents||'{}');
    verifyAccess_(req.accessKey);
    const data=route_(req.action,req);
    return json_({ok:true,data});
  }catch(err){return json_({ok:false,error:String(err&&err.message?err.message:err)})}
}

function route_(action,r){
  switch(action){
    case 'bootstrap': return bootstrap_();
    case 'addProduct': return saveProduct_(null,r.name,r.ownerPrice);
    case 'updateProduct': return saveProduct_(r.id,r.name,r.ownerPrice);
    case 'deleteProduct': return softDelete_(SHEETS.PRODUCTS,r.id);
    case 'addWorker': return addWorker_(r.name);
    case 'deleteWorker': return deleteWorker_(r.id);
    case 'addEntries': return addEntries_(r.entries||[]);
    case 'deleteEntry': return deleteEntry_(r.id);
    case 'dailySummary': return dailySummary_(r.date,r.workerId);
    case 'monthlySummary': return monthlySummary_(r.month,r.workerId);
    case 'backupNow': return backupDatabase_();
    default: throw new Error('알 수 없는 action입니다: '+action);
  }
}

function bootstrap_(){return {products:readObjects_(SHEETS.PRODUCTS).filter(x=>bool_(x.active)),workers:readObjects_(SHEETS.WORKERS).filter(x=>bool_(x.active))}}
function saveProduct_(id,name,ownerPrice){
  name=String(name||'').trim();ownerPrice=Number(ownerPrice);
  if(!name)throw new Error('품목명이 필요합니다.');if(!Number.isFinite(ownerPrice)||ownerPrice<0)throw new Error('기준단가가 올바르지 않습니다.');
  const ss=db_(),sh=ss.getSheetByName(SHEETS.PRODUCTS),rows=readObjects_(SHEETS.PRODUCTS,true);const now=new Date();
  const dup=rows.find(x=>bool_(x.active)&&String(x.name).trim().toLowerCase()===name.toLowerCase()&&x.id!==id);if(dup)throw new Error('같은 품목명이 이미 있습니다.');
  if(id){const row=rows.find(x=>x.id===id);if(!row)throw new Error('품목을 찾을 수 없습니다.');updateRow_(sh,row._row,{name,ownerPrice,updatedAt:now});return {id};}
  id=Utilities.getUuid();appendObject_(sh,['id','name','ownerPrice','active','createdAt','updatedAt'],{id,name,ownerPrice,active:true,createdAt:now,updatedAt:now});return {id};
}
function addWorker_(name){name=String(name||'').trim();if(!name)throw new Error('작업자 이름이 필요합니다.');const rows=readObjects_(SHEETS.WORKERS,true);if(rows.some(x=>bool_(x.active)&&String(x.name).toLowerCase()===name.toLowerCase()))throw new Error('같은 작업자 이름이 이미 있습니다.');const id=Utilities.getUuid(),now=new Date();appendObject_(db_().getSheetByName(SHEETS.WORKERS),['id','name','role','active','createdAt','updatedAt'],{id,name,role:'worker',active:true,createdAt:now,updatedAt:now});return{id};}
function deleteWorker_(id){if(id==='owner-a')throw new Error('주인장 A는 삭제할 수 없습니다.');return softDelete_(SHEETS.WORKERS,id)}
function softDelete_(sheetName,id){const sh=db_().getSheetByName(sheetName),rows=readObjects_(sheetName,true),row=rows.find(x=>x.id===id);if(!row)throw new Error('대상을 찾을 수 없습니다.');updateRow_(sh,row._row,{active:false,updatedAt:new Date()});return{id}}
function addEntries_(entries){if(!Array.isArray(entries)||!entries.length)throw new Error('저장할 작업내역이 없습니다.');const ss=db_(),sh=ss.getSheetByName(SHEETS.ENTRIES),products=indexBy_(readObjects_(SHEETS.PRODUCTS),'id'),workers=indexBy_(readObjects_(SHEETS.WORKERS),'id'),now=new Date();const rows=[];
  for(const e of entries){const p=products[e.productId],w=workers[e.workerId],q=Math.floor(Number(e.qty));if(!p||!bool_(p.active))throw new Error('유효하지 않은 품목이 포함되어 있습니다.');if(!w||!bool_(w.active))throw new Error('유효하지 않은 작업자가 포함되어 있습니다.');if(!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date||'')))throw new Error('날짜 형식이 올바르지 않습니다.');if(!Number.isFinite(q)||q<=0)throw new Error('수량은 1 이상이어야 합니다.');const owner=Number(p.ownerPrice),worker=Math.max(0,owner-50),report=Math.round(owner*1.1);rows.push([Utilities.getUuid(),e.date,w.id,p.id,q,owner,worker,report,now,true,'']);}
  sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);return{count:rows.length};
}
function deleteEntry_(id){
  id=String(id||'').trim();if(!id)throw new Error('삭제할 작업내역 ID가 없습니다.');
  const sh=db_().getSheetByName(SHEETS.ENTRIES),rows=readObjects_(SHEETS.ENTRIES,true),row=rows.find(x=>String(x.id)===id);
  if(!row)throw new Error('작업내역을 찾을 수 없습니다.');
  if(row.active===false||String(row.active).toLowerCase()==='false')throw new Error('이미 삭제된 작업내역입니다.');
  updateRow_(sh,row._row,{active:false,deletedAt:new Date()});return{id};
}
function dailySummary_(date,workerId){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))throw new Error('조회 날짜가 필요합니다.');
  const products=indexBy_(readObjects_(SHEETS.PRODUCTS),'id'),workers=indexBy_(readObjects_(SHEETS.WORKERS),'id');
  const entries=readObjects_(SHEETS.ENTRIES).filter(x=>entryIsActive_(x)&&normalizeDate_(x.date)===date&&(!workerId||String(x.workerId)===String(workerId)));
  let ownerTotal=0,workerPayoutTotal=0,reportTotal=0;const bw={},bp={},detail=[];
  for(const e of entries){
    const p=products[e.productId]||{name:'삭제된 품목'},w=workers[e.workerId]||{id:e.workerId,name:'삭제된 작업자',role:'worker'},q=Number(e.qty)||0;
    const op=Number(e.ownerPriceSnapshot)||0,wp=Number(e.workerPriceSnapshot)||0,rp=Number(e.reportPriceSnapshot)||Math.round(op*1.1),isOwner=w.role==='owner';
    const ownerAmt=op*q,workerAmt=isOwner?0:wp*q,reportAmt=(isOwner?op:rp)*q,payoutUnit=isOwner?op:wp,payoutTotal=payoutUnit*q;
    ownerTotal+=ownerAmt;workerPayoutTotal+=workerAmt;reportTotal+=reportAmt;
    if(!bw[w.id])bw[w.id]={workerId:w.id,workerName:w.name,role:w.role,qty:0,ownerTotal:0,workerPayout:0,reportTotal:0};
    bw[w.id].qty+=q;bw[w.id].ownerTotal+=ownerAmt;bw[w.id].workerPayout+=workerAmt;bw[w.id].reportTotal+=reportAmt;
    const pk=e.productId+'|'+op+'|'+wp+'|'+rp;
    if(!bp[pk])bp[pk]={productId:e.productId,productName:p.name,qty:0,ownerPrice:op,workerPrice:wp,reportPrice:rp,ownerTotal:0,workerPayout:0,reportTotal:0};
    bp[pk].qty+=q;bp[pk].ownerTotal+=ownerAmt;bp[pk].workerPayout+=workerAmt;bp[pk].reportTotal+=reportAmt;
    detail.push({id:e.id,createdAtLabel:formatDateTime_(e.createdAt),workerName:w.name,role:w.role,productName:p.name,qty:q,payoutUnit,payoutTotal,reportTotal:reportAmt});
  }
  return{date,workerId:workerId||'',totals:{ownerTotal,workerPayoutTotal,reportTotal},byWorker:Object.values(bw),byProduct:Object.values(bp),entries:detail};
}

function monthlySummary_(month,workerId){
  if(!/^\d{4}-\d{2}$/.test(String(month||'')))throw new Error('조회 월이 필요합니다.');
  const products=indexBy_(readObjects_(SHEETS.PRODUCTS),'id'),workers=indexBy_(readObjects_(SHEETS.WORKERS),'id');
  const entries=readObjects_(SHEETS.ENTRIES).filter(x=>entryIsActive_(x)&&normalizeDate_(x.date).slice(0,7)===month&&(!workerId||String(x.workerId)===String(workerId)));
  let qty=0,ownerTotal=0,workerPayoutTotal=0,reportTotal=0;const byDate={},byWorker={},detail=[];
  for(const e of entries){
    const p=products[e.productId]||{name:'삭제된 품목'},w=workers[e.workerId]||{id:e.workerId,name:'삭제된 작업자',role:'worker'},q=Number(e.qty)||0;
    const op=Number(e.ownerPriceSnapshot)||0,wp=Number(e.workerPriceSnapshot)||0,rp=Number(e.reportPriceSnapshot)||Math.round(op*1.1),isOwner=w.role==='owner';
    const ownerAmt=op*q,workerAmt=isOwner?0:wp*q,reportAmt=(isOwner?op:rp)*q,payoutUnit=isOwner?op:wp,payoutTotal=payoutUnit*q;
    qty+=q;ownerTotal+=ownerAmt;workerPayoutTotal+=workerAmt;reportTotal+=reportAmt;
    const d=normalizeDate_(e.date);if(!byDate[d])byDate[d]={date:d,qty:0,ownerTotal:0,workerPayoutTotal:0,reportTotal:0};
    byDate[d].qty+=q;byDate[d].ownerTotal+=ownerAmt;byDate[d].workerPayoutTotal+=workerAmt;byDate[d].reportTotal+=reportAmt;
    if(!byWorker[w.id])byWorker[w.id]={workerId:w.id,workerName:w.name,role:w.role,qty:0,ownerTotal:0,workerPayout:0,reportTotal:0};
    byWorker[w.id].qty+=q;byWorker[w.id].ownerTotal+=ownerAmt;byWorker[w.id].workerPayout+=workerAmt;byWorker[w.id].reportTotal+=reportAmt;
    detail.push({id:e.id,date:d,workerName:w.name,role:w.role,productName:p.name,qty:q,payoutUnit,payoutTotal,reportTotal:reportAmt});
  }
  return{month,workerId:workerId||'',totals:{qty,ownerTotal,workerPayoutTotal,reportTotal},byDate:Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date)),byWorker:Object.values(byWorker).sort((a,b)=>String(a.workerName).localeCompare(String(b.workerName),'ko')),entries:detail.sort((a,b)=>a.date.localeCompare(b.date))};
}

function installDailyBackupTrigger(){ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='scheduledBackup').forEach(t=>ScriptApp.deleteTrigger(t));ScriptApp.newTrigger('scheduledBackup').timeBased().everyDays(1).atHour(3).create()}
function scheduledBackup(){backupDatabase_()}
function backupDatabase_(){const props=PropertiesService.getScriptProperties(),ss=db_(),folderId=props.getProperty('BACKUP_FOLDER_ID');if(!folderId)throw new Error('백업 폴더가 설정되지 않았습니다. setupSystem()을 먼저 실행하세요.');const folder=DriveApp.getFolderById(folderId),stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Seoul','yyyyMMdd_HHmmss');const snapshot={version:1,createdAt:new Date().toISOString(),products:readObjects_(SHEETS.PRODUCTS),workers:readObjects_(SHEETS.WORKERS),entries:readObjects_(SHEETS.ENTRIES)};const file=folder.createFile(`부업정산_backup_${stamp}.json`,JSON.stringify(snapshot,null,2),MimeType.PLAIN_TEXT);return{fileName:file.getName(),fileId:file.getId()}}

function db_(){const id=PropertiesService.getScriptProperties().getProperty('DB_SPREADSHEET_ID');if(!id)throw new Error('DB가 없습니다. Apps Script에서 setupSystem()을 먼저 실행하세요.');return SpreadsheetApp.openById(id)}
function ensureSheet_(ss,name,headers){let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0)sh.appendRow(headers);else sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);return sh}
function readObjects_(sheetName,withRow){const sh=db_().getSheetByName(sheetName);if(!sh||sh.getLastRow()<2)return[];const values=sh.getDataRange().getValues(),h=values[0].map(String);return values.slice(1).map((r,i)=>{const o={};h.forEach((k,j)=>o[k]=r[j]);if(withRow)o._row=i+2;return o})}
function appendObject_(sh,headers,obj){sh.appendRow(headers.map(h=>obj[h]??''))}
function updateRow_(sh,rowNum,patch){const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);Object.entries(patch).forEach(([k,v])=>{const idx=h.indexOf(k);if(idx>=0)sh.getRange(rowNum,idx+1).setValue(v)})}
function indexBy_(arr,key){return arr.reduce((m,x)=>(m[x[key]]=x,m),{})}
function bool_(v){return v===true||String(v).toLowerCase()==='true'||v===1||v==='1'}
function entryIsActive_(x){return !(x.active===false||String(x.active).toLowerCase()==='false')}
function verifyAccess_(key){const expected=PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');if(!expected)throw new Error('접속키가 없습니다. setupSystem()을 실행하세요.');if(String(key||'')!==expected)throw new Error('접속키 인증에 실패했습니다.')}
function makeAccessKey_(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'').slice(0,12)}

function normalizeDate_(v){
  if(v instanceof Date && !isNaN(v)){
    return Utilities.formatDate(v,Session.getScriptTimeZone()||'Asia/Seoul','yyyy-MM-dd');
  }
  const s=String(v||'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d=new Date(v);
  if(!isNaN(d)) return Utilities.formatDate(d,Session.getScriptTimeZone()||'Asia/Seoul','yyyy-MM-dd');
  return s;
}

function formatDateTime_(v){try{return Utilities.formatDate(new Date(v),Session.getScriptTimeZone()||'Asia/Seoul','HH:mm:ss')}catch(e){return''}}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
