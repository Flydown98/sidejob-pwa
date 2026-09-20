const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={products:[],workers:[],draft:[],dailyData:null,monthlyData:null,accessKey:localStorage.getItem('sidejobAccessKey')||'',installPrompt:null};
const won=n=>`${Math.round(Number(n)||0).toLocaleString('ko-KR')}원`;
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const calcPrices=p=>({owner:Number(p.ownerPrice),worker:Math.max(0,Number(p.ownerPrice)-50),report:Math.round(Number(p.ownerPrice)*1.1)});
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function setStatus(text,type=''){const el=$('#status');el.textContent=text;el.className=`status ${type}`}
function apiUrl(){return (window.APP_CONFIG?.API_URL||'').trim()}
async function api(action,payload={}){
  if(!apiUrl()||apiUrl().includes('PASTE_')) throw new Error('config.js에 Apps Script URL을 입력하세요.');
  const r=await fetch(apiUrl(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,accessKey:state.accessKey,...payload}),redirect:'follow'});
  const data=await r.json();if(!data.ok)throw new Error(data.error||'요청 실패');return data.data;
}
async function init(){
  $('#workDate').value=today();$('#dailyDate').value=today();$('#monthlyMonth').value=today().slice(0,7);bind();
  if(!state.accessKey){$('#authModal').classList.add('open');return}await refreshAll();await loadWorkDayStatus();
}
async function refreshAll(){
  try{setStatus('동기화 중');const data=await api('bootstrap');state.products=data.products||[];state.workers=data.workers||[];renderAll();setStatus('연결됨','ok')}
  catch(e){setStatus('연결 실패','bad');toast(e.message);if(/접속키|인증/.test(e.message))$('#authModal').classList.add('open')}
}
function renderAll(){renderWorkerSelects();renderProductButtons();renderDraft();renderProductList();renderWorkerList()}
function workerOptions(includeAll=false){const active=state.workers.filter(w=>w.active!==false);return (includeAll?'<option value="">전체 작업자</option>':'')+active.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}${w.role==='owner'?' (주인장)':''}</option>`).join('')}
function renderWorkerSelects(){
  const current=$('#workerSelect').value,m=$('#monthlyWorker').value,d=$('#dailyWorker').value;
  $('#workerSelect').innerHTML=workerOptions(false);$('#monthlyWorker').innerHTML=workerOptions(true);$('#dailyWorker').innerHTML=workerOptions(true);
  if(current&&state.workers.some(w=>String(w.id)===String(current)))$('#workerSelect').value=current;if(m&&state.workers.some(w=>String(w.id)===String(m)))$('#monthlyWorker').value=m;if(d&&state.workers.some(w=>String(w.id)===String(d)))$('#dailyWorker').value=d;
}
function filteredProducts(q){q=(q||'').trim().toLowerCase();return state.products.filter(p=>p.active!==false&&(!q||String(p.name).toLowerCase().includes(q)))}
function renderProductButtons(){const items=filteredProducts($('#productSearch').value);$('#productButtons').innerHTML=items.length?items.map(p=>{const c=calcPrices(p);return `<button class="product-btn" data-add-product="${esc(p.id)}"><strong>${esc(p.name)}</strong><small>기준 ${won(c.owner)} · 직원 ${won(c.worker)} · 보고 ${won(c.report)}</small></button>`}).join(''):'<div class="empty">검색 결과가 없습니다.</div>'}
function addDraft(productId){const workerId=$('#workerSelect').value,date=$('#workDate').value;if(!workerId||!date)return toast('날짜와 작업자를 선택하세요.');const existing=state.draft.find(x=>x.productId===productId&&x.workerId===workerId&&x.date===date);if(existing)existing.qty++;else state.draft.push({productId,workerId,date,qty:1});renderDraft()}
function draftTotals(){let owner=0,worker=0,report=0;for(const d of state.draft){const p=state.products.find(x=>x.id===d.productId),w=state.workers.find(x=>x.id===d.workerId);if(!p||!w)continue;const c=calcPrices(p),q=Number(d.qty)||0,isOwner=w.role==='owner';owner+=c.owner*q;if(isOwner)report+=c.owner*q;else{worker+=c.worker*q;report+=c.report*q}}return{owner,worker,report}}
function renderDraft(){
  $('#draftEntries').innerHTML=state.draft.length?state.draft.map((d,i)=>{const p=state.products.find(x=>x.id===d.productId),w=state.workers.find(x=>x.id===d.workerId),c=p?calcPrices(p):{owner:0,worker:0},unit=w?.role==='owner'?c.owner:c.worker;return `<div class="entry"><div><strong>${esc(p?.name||'삭제된 품목')}</strong><div class="meta">${esc(d.date)}</div></div><div class="worker"><span class="pill">${esc(w?.name||'작업자')}</span></div><div class="qty-control"><button data-qty="${i}" data-delta="-1">−</button><input data-qty-input="${i}" type="number" min="1" value="${Number(d.qty)||1}"><button data-qty="${i}" data-delta="1">+</button></div><div class="remove"><button class="btn danger small" data-remove="${i}">삭제</button><div class="meta amount">${won(unit*(Number(d.qty)||0))}</div></div></div>`}).join(''):'<div class="empty">품목 버튼을 눌러 작업수량을 추가하세요.</div>';
  const t=draftTotals();$('#draftOwnerTotal').textContent=won(t.owner);$('#draftWorkerTotal').textContent=won(t.worker);$('#draftReportTotal').textContent=won(t.report);
}
function renderProductList(){const items=filteredProducts($('#dbSearch').value||'');$('#productList').innerHTML=items.length?items.map(p=>{const c=calcPrices(p);return `<div class="entry"><div><strong>${esc(p.name)}</strong><div class="meta">기준 ${won(c.owner)} · 직원 ${won(c.worker)} · 보고 ${won(c.report)}</div></div><div></div><div></div><div><button class="btn soft small" data-edit-product="${esc(p.id)}">수정</button> <button class="btn danger small" data-delete-product="${esc(p.id)}">삭제</button></div></div>`}).join(''):'<div class="empty">등록된 품목이 없습니다.</div>'}
function renderWorkerList(){const items=state.workers.filter(w=>w.active!==false);$('#workerList').innerHTML=items.map(w=>`<div class="entry"><div><strong>${esc(w.name)}</strong><div class="meta">${w.role==='owner'?'주인장 · 이름 변경 가능 · 삭제 불가':'직원 · 기준단가 - 50원 지급 · 보고 기준단가 +10%'}</div></div><div></div><div></div><div class="row-actions"><button class="btn soft small" data-edit-worker="${esc(w.id)}">이름수정</button>${w.role==='owner'?'':`<button class="btn danger small" data-delete-worker="${esc(w.id)}">삭제</button>`}</div></div>`).join('')}

async function loadWorkDayStatus(){
  const date=$('#workDate').value;if(!date)return;
  try{const d=await api('getDailyStatus',{date});$('#workDelivery').checked=!!d.delivery;$('#workVisit').checked=!!d.visit}catch(e){toast(e.message)}
}
async function saveWorkDayStatus(){
  const date=$('#workDate').value;if(!date)return;
  try{const d=await api('saveDailyStatus',{date,delivery:$('#workDelivery').checked,visit:$('#workVisit').checked});syncStatusControls(d);toast('일자 표시 저장')}catch(e){toast(e.message)}
}
function syncStatusControls(d){
  if($('#workDate').value===d.date){$('#workDelivery').checked=!!d.delivery;$('#workVisit').checked=!!d.visit}
  if($('#dailyDate').value===d.date){$('#dailyDelivery').checked=!!d.delivery;$('#dailyVisit').checked=!!d.visit}
}
async function saveDailyViewStatus(){
  const date=$('#dailyDate').value;if(!date)return;
  try{const d=await api('saveDailyStatus',{date,delivery:$('#dailyDelivery').checked,visit:$('#dailyVisit').checked});syncStatusControls(d);toast('일자 표시 저장');if(state.monthlyData&&date.slice(0,7)===$('#monthlyMonth').value)loadMonthly()}catch(e){toast(e.message)}
}
async function loadDaily(){
  try{
    const date=$('#dailyDate').value,workerId=$('#dailyWorker').value,d=await api('dailySummary',{date,workerId});state.dailyData=d;$('#dailyDelivery').checked=!!d.status?.delivery;$('#dailyVisit').checked=!!d.status?.visit;
    $('#dailyOwnerTotal').textContent=won(d.totals.ownerTotal);$('#dailyWorkerTotal').textContent=won(d.totals.workerPayoutTotal);$('#dailyReportTotal').textContent=won(d.totals.reportTotal);
    $('#workerSummary').innerHTML=table(['작업자','구분','수량','기준','직원지급','보고'],d.byWorker.map(x=>[esc(x.workerName),x.role==='owner'?'주인장':'직원',num(x.qty),won(x.ownerTotal),won(x.workerPayout),won(x.reportTotal)]),'worker-summary');
    $('#productSummary').innerHTML=table(['품목','수량','기준단가','직원단가','보고단가','기준금액','직원지급','보고'],d.byProduct.map(x=>[esc(x.productName),num(x.qty),won(x.ownerPrice),won(x.workerPrice),won(x.reportPrice),won(x.ownerTotal),won(x.workerPayout),won(x.reportTotal)]),'product-summary');
    $('#dailyDetails').innerHTML=table(['시간','작업자','품목','수량','지급단가','지급금액','보고','관리'],d.entries.map(x=>[esc(x.createdAtLabel),esc(x.workerName),esc(x.productName),num(x.qty),won(x.payoutUnit),won(x.payoutTotal),won(x.reportTotal),entryActions(x.id,'daily')]),'daily-detail');toast(`${date} 조회 완료`);
  }catch(e){toast(e.message)}
}
async function loadMonthly(){
  try{
    const month=$('#monthlyMonth').value,workerId=$('#monthlyWorker').value,d=await api('monthlySummary',{month,workerId});state.monthlyData=d;
    $('#monthlyQty').textContent=`${num(d.totals.qty)}개`;$('#monthlyOwnerTotal').textContent=won(d.totals.ownerTotal);$('#monthlyWorkerTotal').textContent=won(d.totals.workerPayoutTotal);$('#monthlyReportTotal').textContent=won(d.totals.reportTotal);
    renderCalendar(month,d.byDate||[],d.statuses||{});renderMonthlyPeople(d.byWorker||[],workerId);
    $('#monthlyByDate').innerHTML=table(['날짜','수량','기준금액','직원지급','보고'],(d.byDate||[]).map(x=>[esc(x.date),`${num(x.qty)}개`,won(x.ownerTotal),won(x.workerPayoutTotal),won(x.reportTotal)]),'monthly-date');
    $('#monthlyDetails').innerHTML=table(['날짜','작업자','품목','수량','지급단가','지급금액','보고','관리'],(d.entries||[]).map(x=>[esc(x.date),esc(x.workerName),esc(x.productName),num(x.qty),won(x.payoutUnit),won(x.payoutTotal),won(x.reportTotal),entryActions(x.id,'monthly')]),'monthly-detail');
    const selected=state.workers.find(w=>String(w.id)===String(workerId));$('#calendarTitle').textContent=`${month.replace('-','년 ')}월 ${selected?`· ${selected.name}`:'· 전체'}`;toast(`${month} 조회 완료`);
  }catch(e){toast(e.message)}
}
function entryActions(id,context){return `<div class="row-actions"><button class="btn soft small" data-edit-entry="${esc(id)}" data-entry-context="${context}">수정</button><button class="btn danger small" data-delete-entry="${esc(id)}" data-delete-context="${context}">삭제</button></div>`}
function renderCalendar(month,byDate,statuses={}){
  const [y,m]=month.split('-').map(Number),first=new Date(y,m-1,1),lastDay=new Date(y,m,0).getDate(),start=first.getDay(),map=Object.fromEntries(byDate.map(x=>[x.date,x]));let html='';
  for(let i=0;i<start;i++)html+='<div class="calendar-day empty-day"></div>';
  for(let day=1;day<=lastDay;day++){const date=`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,x=map[date],st=statuses[date]||{},hasStatus=st.delivery||st.visit;html+=`<button class="calendar-day ${x?'has-data':''} ${hasStatus?'has-status':''}" data-calendar-date="${date}"><div class="day-num">${day}</div>${hasStatus?`<div class="day-status-badges">${st.delivery?'<span>택배</span>':''}${st.visit?'<span>방문</span>':''}</div>`:''}${x?`<div class="cal-line cal-qty"><strong>${num(x.qty)}개</strong></div><div class="cal-line cal-owner">기준 ${won(x.ownerTotal)}</div><div class="cal-line cal-worker">지급 ${won(x.workerPayoutTotal)}</div><div class="cal-line cal-report">보고 ${won(x.reportTotal)}</div>`:'<div class="cal-line cal-empty">-</div>'}</button>`}$('#monthlyCalendar').innerHTML=html;
}
function renderMonthlyPeople(items,activeId){
  if(!items.length){$('#monthlyByWorker').innerHTML='<div class="empty">내역이 없습니다.</div>';return}
  $('#monthlyByWorker').innerHTML=items.map(x=>{const receive=x.role==='owner'?x.ownerTotal:x.workerPayout;return `<button class="person-card ${String(activeId)===String(x.workerId)?'active':''}" data-month-worker="${esc(x.workerId)}"><div class="person-head"><span class="person-name">${esc(x.workerName)}</span><span class="pill">${x.role==='owner'?'주인장':'직원'}</span></div><div class="person-stat">${num(x.qty)}개 · 기준 ${won(x.ownerTotal)}</div><div class="person-money">받을 금액 ${won(receive)}</div><div class="person-stat">보고 ${won(x.reportTotal)}</div></button>`}).join('');
}
function table(headers,rows,cls=''){if(!rows.length)return '<div class="empty">내역이 없습니다.</div>';return `<table class="table ${cls}"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`}

function openEntryEdit(id,context){
  const source=context==='daily'?state.dailyData:state.monthlyData,entry=source?.entries?.find(x=>String(x.id)===String(id));if(!entry)return toast('수정할 내역을 찾을 수 없습니다. 다시 조회해주세요.');
  $('#entryId').value=entry.id;$('#entryContext').value=context;$('#entryWorkerName').value=entry.workerName;$('#entryDate').value=entry.date;$('#entryQty').value=entry.qty;
  const active=state.products.filter(p=>p.active!==false);let options=active.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');if(!active.some(p=>String(p.id)===String(entry.productId)))options=`<option value="${esc(entry.productId)}">${esc(entry.productName)} (기존)</option>`+options;$('#entryProduct').innerHTML=options;$('#entryProduct').value=entry.productId;$('#entryModal').classList.add('open');
}
async function saveEntryEdit(){
  const id=$('#entryId').value,date=$('#entryDate').value,productId=$('#entryProduct').value,qty=Math.floor(Number($('#entryQty').value)),context=$('#entryContext').value;if(!date||!productId||!qty||qty<1)return toast('날짜·품목·수량을 확인하세요.');
  try{await api('updateEntry',{id,date,productId,qty});$('#entryModal').classList.remove('open');toast('작업내역 수정 완료');if(context==='daily')await loadDaily();else await loadMonthly()}catch(e){toast(e.message)}
}

function openProduct(p){$('#productId').value=p?.id||'';$('#productName').value=p?.name||'';$('#ownerPrice').value=p?.ownerPrice||'';$('#productModalTitle').textContent=p?'품목 수정':'품목 추가';updatePricePreview();$('#productModal').classList.add('open')}
function updatePricePreview(){const v=Number($('#ownerPrice').value)||0;$('#pricePreview').textContent=v?`주인장 ${won(v)} (수수료 없음) / 직원 지급 ${won(Math.max(0,v-50))} / 직원 보고 ${won(Math.round(v*1.1))}`:''}
function switchTab(id){$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));$$('.panel').forEach(x=>x.classList.toggle('active',x.id===id));window.scrollTo({top:0,behavior:'smooth'})}

function groupPrintEntries(entries, role){
  const map=new Map();
  for(const x of entries){
    const unit=role==='owner'?Number(x.ownerPrice||0):Number(x.workerPrice||0);
    const k=[x.date,x.productId,unit].join('|');
    if(!map.has(k))map.set(k,{date:x.date,productName:x.productName,qty:0,unit,total:0});
    const g=map.get(k);g.qty+=Number(x.qty)||0;g.total+=unit*(Number(x.qty)||0);
  }
  return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||String(a.productName).localeCompare(String(b.productName),'ko'));
}
async function printMonthly(){
  const month=$('#monthlyMonth').value;if(!month)return toast('인쇄할 월을 선택하세요.');
  try{
    toast('인쇄자료 준비 중');
    const data=await api('monthlySummary',{month,workerId:''});
    const workers=state.workers.filter(w=>w.active!==false).sort((a,b)=>(a.role==='owner'?-1:b.role==='owner'?1:String(a.name).localeCompare(String(b.name),'ko')));
    const summaryMap=Object.fromEntries((data.byWorker||[]).map(x=>[String(x.workerId),x]));
    let pages='';

    // 개인별 페이지: 주인장은 현재 주인장 단가, 직원은 현재 직원단가(주인장단가-50원)만 표시한다.
    // 수수료/보고단가/주인장 기준 총액 등은 개인 페이지에서 노출하지 않는다.
    for(const w of workers){
      const entries=(data.entries||[]).filter(x=>String(x.workerId)===String(w.id));
      const sum=summaryMap[String(w.id)]||{qty:0,ownerTotal:0,workerPayout:0,reportTotal:0};
      const receive=w.role==='owner'?Number(sum.ownerTotal||0):Number(sum.workerPayout||0);
      const grouped=groupPrintEntries(entries,w.role);
      pages+=`<section class="print-page"><div class="print-title"><div><h1>${esc(month.replace('-','년 '))}월 작업 정산</h1><p>${esc(w.name)} · ${w.role==='owner'?'주인장':'직원'}</p></div><div class="print-badge">개인 정산</div></div><div class="print-metrics print-metrics-simple"><div><span>총 작업수량</span><b>${num(sum.qty)}개</b></div><div><span>월 합계</span><b>${won(receive)}</b></div></div><table class="print-table"><thead><tr><th>날짜</th><th>품목</th><th>수량</th><th>${w.role==='owner'?'적용단가':'직원단가'}</th><th>금액</th></tr></thead><tbody>${grouped.length?grouped.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.productName)}</td><td>${num(x.qty)}개</td><td>${won(x.unit)}</td><td>${won(x.total)}</td></tr>`).join(''):'<tr><td colspan="5" class="print-empty">이 달의 작업내역이 없습니다.</td></tr>'}</tbody><tfoot><tr><td colspan="2">합계</td><td>${num(sum.qty)}개</td><td></td><td>${won(receive)}</td></tr></tfoot></table>${w.role==='owner'?'':'<div class="print-note">※ 직원 정산표는 현재 품목DB 단가에서 50원을 뺀 직원단가만 적용합니다.</div>'}</section>`;
    }

    // 마지막 전체 총계: 주인장 직접 작업금액 + 직원 작업의 보고금액(현재 주인장단가×1.1)만 계산한다.
    const ownerSum=(data.byWorker||[]).filter(x=>x.role==='owner').reduce((s,x)=>s+Number(x.ownerTotal||0),0);
    const ownerQty=(data.byWorker||[]).filter(x=>x.role==='owner').reduce((s,x)=>s+Number(x.qty||0),0);
    const staffReport=(data.byWorker||[]).filter(x=>x.role!=='owner').reduce((s,x)=>s+Number(x.reportTotal||0),0);
    const staffQty=(data.byWorker||[]).filter(x=>x.role!=='owner').reduce((s,x)=>s+Number(x.qty||0),0);
    const grand=ownerSum+staffReport;
    pages+=`<section class="print-page print-total-page"><div class="print-title"><div><h1>${esc(month.replace('-','년 '))}월 전체 총계</h1><p>최종 보고용 정산</p></div><div class="print-badge total">전체 총계</div></div><div class="print-metrics print-final-metrics"><div><span>1. 주인장 총금액</span><b>${won(ownerSum)}</b><small>주인장 작업 ${num(ownerQty)}개 · 수수료 없음</small></div><div><span>2. 직원들 총금액</span><b>${won(staffReport)}</b><small>직원 작업 ${num(staffQty)}개 · 현재 주인장단가 × 1.1</small></div><div class="grand"><span>3. 전체 최종 합계</span><b>${won(grand)}</b><small>주인장 총금액 + 직원들 수수료 포함 총금액</small></div></div><table class="print-table print-final-table"><thead><tr><th>구분</th><th>수량</th><th>계산 기준</th><th>금액</th></tr></thead><tbody><tr><td>주인장</td><td>${num(ownerQty)}개</td><td>현재 주인장단가 · 수수료 없음</td><td>${won(ownerSum)}</td></tr><tr><td>직원 전체</td><td>${num(staffQty)}개</td><td>현재 주인장단가 × 1.1</td><td>${won(staffReport)}</td></tr></tbody><tfoot><tr><td>최종 합계</td><td>${num(ownerQty+staffQty)}개</td><td>전체</td><td>${won(grand)}</td></tr></tfoot></table></section>`;
    $('#printArea').innerHTML=pages;document.body.classList.add('printing');setTimeout(()=>window.print(),100);
  }catch(e){toast(e.message)}
}

function bind(){
  $$('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));$('#productSearch').oninput=renderProductButtons;$('#dbSearch').oninput=renderProductList;$('#ownerPrice').oninput=updatePricePreview;
  document.addEventListener('click',async e=>{
    const a=e.target.closest('[data-add-product]');if(a)return addDraft(a.dataset.addProduct);
    const q=e.target.closest('[data-qty]');if(q){const i=Number(q.dataset.qty);state.draft[i].qty=Math.max(1,(Number(state.draft[i].qty)||1)+Number(q.dataset.delta));return renderDraft()}
    const r=e.target.closest('[data-remove]');if(r){state.draft.splice(Number(r.dataset.remove),1);return renderDraft()}
    const cd=e.target.closest('[data-calendar-date]');if(cd){$('#dailyDate').value=cd.dataset.calendarDate;$('#dailyWorker').value=$('#monthlyWorker').value;switchTab('daily');return loadDaily()}
    const mw=e.target.closest('[data-month-worker]');if(mw){$('#monthlyWorker').value=mw.dataset.monthWorker;return loadMonthly()}
    const ee=e.target.closest('[data-edit-entry]');if(ee)return openEntryEdit(ee.dataset.editEntry,ee.dataset.entryContext);
    const de=e.target.closest('[data-delete-entry]');if(de){if(!confirm('이 작업내역을 삭제할까요? 합계에서도 제외됩니다.'))return;try{await api('deleteEntry',{id:de.dataset.deleteEntry});toast('삭제 완료');if(de.dataset.deleteContext==='daily')await loadDaily();else await loadMonthly()}catch(err){toast(err.message)}return}
    const ep=e.target.closest('[data-edit-product]');if(ep)return openProduct(state.products.find(x=>String(x.id)===String(ep.dataset.editProduct)));
    const dp=e.target.closest('[data-delete-product]');if(dp&&confirm('이 품목을 삭제(비활성화)할까요? 기존 작업내역은 유지됩니다.')){try{await api('deleteProduct',{id:dp.dataset.deleteProduct});await refreshAll();toast('품목 삭제 완료')}catch(err){toast(err.message)}return}
    const ew=e.target.closest('[data-edit-worker]');if(ew){const w=state.workers.find(x=>String(x.id)===String(ew.dataset.editWorker));if(!w)return toast('작업자를 찾을 수 없습니다.');const name=prompt(`${w.role==='owner'?'주인장':'작업자'} 이름을 변경하세요.`,w.name);if(name===null)return;const trimmed=name.trim();if(!trimmed)return toast('이름을 입력하세요.');try{await api('updateWorker',{id:w.id,name:trimmed});await refreshAll();toast('이름 수정 완료')}catch(err){toast(err.message)}return}
    const dw=e.target.closest('[data-delete-worker]');if(dw&&confirm('이 작업자를 삭제(비활성화)할까요? 기존 작업내역은 유지됩니다.')){try{await api('deleteWorker',{id:dw.dataset.deleteWorker});await refreshAll();toast('작업자 삭제 완료')}catch(err){toast(err.message)}return}
  });
  document.addEventListener('change',e=>{if(e.target.matches('[data-qty-input]')){const i=Number(e.target.dataset.qtyInput);state.draft[i].qty=Math.max(1,Math.floor(Number(e.target.value)||1));renderDraft()}});
  $('#saveEntries').onclick=async()=>{if(!state.draft.length)return toast('저장할 작업이 없습니다.');try{await api('addEntries',{entries:state.draft});const count=state.draft.length;state.draft=[];renderDraft();toast(`${count}건 저장 완료`)}catch(e){toast(e.message)}};
  $('#clearDraft').onclick=()=>{if(state.draft.length&&confirm('입력 중인 내용을 모두 비울까요?')){state.draft=[];renderDraft()}};
  $('#workDate').onchange=loadWorkDayStatus;$('#workDelivery').onchange=saveWorkDayStatus;$('#workVisit').onchange=saveWorkDayStatus;$('#dailyDate').onchange=loadDaily;$('#dailyDelivery').onchange=saveDailyViewStatus;$('#dailyVisit').onchange=saveDailyViewStatus;
  $('#loadDaily').onclick=loadDaily;$('#loadMonthly').onclick=loadMonthly;$('#monthlyWorker').onchange=loadMonthly;$('#dailyWorker').onchange=loadDaily;$('#printMonthly').onclick=printMonthly;
  $('#newProduct').onclick=()=>openProduct(null);$('#closeProductModal').onclick=()=>$('#productModal').classList.remove('open');$('#closeEntryModal').onclick=()=>$('#entryModal').classList.remove('open');$('#saveEntryEdit').onclick=saveEntryEdit;
  $('#saveProduct').onclick=async()=>{const id=$('#productId').value,name=$('#productName').value.trim(),ownerPrice=Number($('#ownerPrice').value);if(!name||ownerPrice<0)return toast('품목명과 기준단가를 확인하세요.');try{await api(id?'updateProduct':'addProduct',{id,name,ownerPrice});$('#productModal').classList.remove('open');await refreshAll();toast('품목 저장 완료')}catch(e){toast(e.message)}};
  $('#addWorker').onclick=async()=>{const name=$('#newWorkerName').value.trim();if(!name)return toast('작업자 이름을 입력하세요.');try{await api('addWorker',{name});$('#newWorkerName').value='';await refreshAll();toast('작업자 추가 완료')}catch(e){toast(e.message)}};
  $('#backupNow').onclick=async()=>{try{const d=await api('backupNow');toast(`백업 완료: ${d.fileName}`)}catch(e){toast(e.message)}};
  $('#saveAccessKey').onclick=async()=>{const key=$('#accessKey').value.trim();if(!key)return toast('접속키를 입력하세요.');state.accessKey=key;localStorage.setItem('sidejobAccessKey',key);$('#authModal').classList.remove('open');await refreshAll()};
  $('#installApp').onclick=async()=>{if(state.installPrompt){state.installPrompt.prompt();const result=await state.installPrompt.userChoice;state.installPrompt=null;$('#installApp').hidden=true;if(result.outcome==='accepted')toast('앱 설치를 시작합니다.')}else toast(/iPhone|iPad|iPod/.test(navigator.userAgent)?'Safari 공유 → 홈 화면에 추가를 눌러주세요.':'브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택해주세요.')};
}
function num(v){return Math.round(Number(v)||0).toLocaleString('ko-KR')}
function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('#installApp').hidden=false});window.addEventListener('appinstalled',()=>{$('#installApp').hidden=true;state.installPrompt=null;toast('앱 설치 완료')});window.addEventListener('afterprint',()=>{document.body.classList.remove('printing');$('#printArea').innerHTML=''});
if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.navigator.standalone)$('#installApp').hidden=false;if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));init();
