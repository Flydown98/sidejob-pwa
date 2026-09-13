const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={products:[],workers:[],draft:[],accessKey:localStorage.getItem('sidejobAccessKey')||'',installPrompt:null};
const won=n=>`${Math.round(Number(n)||0).toLocaleString('ko-KR')}원`;
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const calcPrices=p=>({owner:Number(p.ownerPrice),worker:Math.max(0,Number(p.ownerPrice)-50),report:Math.round(Number(p.ownerPrice)*1.1)});
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function setStatus(text,type=''){const el=$('#status');el.textContent=text;el.className=`status ${type}`}
function apiUrl(){return (window.APP_CONFIG?.API_URL||'').trim()}
async function api(action,payload={}){
  if(!apiUrl()||apiUrl().includes('PASTE_')) throw new Error('config.js에 Apps Script URL을 입력하세요.');
  const body={action,accessKey:state.accessKey,...payload};
  const r=await fetch(apiUrl(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),redirect:'follow'});
  const data=await r.json();
  if(!data.ok) throw new Error(data.error||'요청 실패');
  return data.data;
}
async function init(){
  $('#workDate').value=today();$('#dailyDate').value=today();$('#monthlyMonth').value=today().slice(0,7);
  bind();
  if(!state.accessKey){$('#authModal').classList.add('open');return}
  await refreshAll();
}
async function refreshAll(){try{setStatus('동기화 중');const data=await api('bootstrap');state.products=data.products||[];state.workers=data.workers||[];renderAll();setStatus('연결됨','ok')}catch(e){setStatus('연결 실패','bad');toast(e.message);if(/접속키|인증/.test(e.message)) $('#authModal').classList.add('open')}}
function renderAll(){renderWorkerSelect();renderProductButtons();renderDraft();renderProductList();renderWorkerList()}
function renderWorkerSelect(){const sel=$('#workerSelect');sel.innerHTML=state.workers.filter(w=>w.active!==false).map(w=>`<option value="${esc(w.id)}">${esc(w.name)}${w.role==='owner'?' (주인장)':''}</option>`).join('')}
function filteredProducts(q){q=(q||'').trim().toLowerCase();return state.products.filter(p=>p.active!==false&&(!q||p.name.toLowerCase().includes(q)))}
function renderProductButtons(){const items=filteredProducts($('#productSearch').value);$('#productButtons').innerHTML=items.length?items.map(p=>{const c=calcPrices(p);return `<button class="product-btn" data-add-product="${esc(p.id)}"><strong>${esc(p.name)}</strong><small>기준 ${won(c.owner)} · 직원 ${won(c.worker)} · 보고 ${won(c.report)}</small></button>`}).join(''):'<div class="empty">검색 결과가 없습니다.</div>'}
function addDraft(productId){const workerId=$('#workerSelect').value,date=$('#workDate').value;if(!workerId||!date)return toast('날짜와 작업자를 선택하세요.');const existing=state.draft.find(x=>x.productId===productId&&x.workerId===workerId&&x.date===date);if(existing)existing.qty++;else state.draft.push({productId,workerId,date,qty:1});renderDraft()}
function draftTotals(){let owner=0,worker=0,report=0;for(const d of state.draft){const p=state.products.find(x=>x.id===d.productId),w=state.workers.find(x=>x.id===d.workerId);if(!p||!w)continue;const c=calcPrices(p),q=Number(d.qty)||0;owner+=c.owner*q;report+=c.report*q;if(w.role!=='owner')worker+=c.worker*q}return{owner,worker,report}}
function renderDraft(){const el=$('#draftEntries');el.innerHTML=state.draft.length?state.draft.map((d,i)=>{const p=state.products.find(x=>x.id===d.productId),w=state.workers.find(x=>x.id===d.workerId),c=p?calcPrices(p):{owner:0,worker:0};const unit=w?.role==='owner'?c.owner:c.worker;return `<div class="entry"><div><strong>${esc(p?.name||'삭제된 품목')}</strong><div class="meta">${esc(d.date)}</div></div><div class="worker"><span class="pill">${esc(w?.name||'작업자')}</span></div><div class="qty-control"><button data-qty="${i}" data-delta="-1">−</button><input data-qty-input="${i}" type="number" min="1" value="${Number(d.qty)||1}"><button data-qty="${i}" data-delta="1">+</button></div><div class="remove"><button class="btn danger small" data-remove="${i}">삭제</button><div class="meta amount" style="margin-top:4px">지급기준 ${won(unit*(Number(d.qty)||0))}</div></div></div>`}).join(''):'<div class="empty">품목 버튼을 눌러 작업수량을 추가하세요.</div>';const t=draftTotals();$('#draftOwnerTotal').textContent=won(t.owner);$('#draftWorkerTotal').textContent=won(t.worker);$('#draftReportTotal').textContent=won(t.report)}
function renderProductList(){const q=$('#dbSearch').value||'';const items=filteredProducts(q);$('#productList').innerHTML=items.length?items.map(p=>{const c=calcPrices(p);return `<div class="entry"><div><strong>${esc(p.name)}</strong><div class="meta">기준 ${won(c.owner)} · 직원 ${won(c.worker)} · 보고 ${won(c.report)}</div></div><div></div><div></div><div><button class="btn soft small" data-edit-product="${esc(p.id)}">수정</button> <button class="btn danger small" data-delete-product="${esc(p.id)}">삭제</button></div></div>`}).join(''):'<div class="empty">등록된 품목이 없습니다.</div>'}
function renderWorkerList(){const items=state.workers.filter(w=>w.active!==false);$('#workerList').innerHTML=items.map(w=>`<div class="entry"><div><strong>${esc(w.name)}</strong><div class="meta">${w.role==='owner'?'주인장 · 기준단가 적용':'직원 · 기준단가 - 50원 적용'}</div></div><div></div><div></div><div>${w.role==='owner'?'':`<button class="btn danger small" data-delete-worker="${esc(w.id)}">삭제</button>`}</div></div>`).join('')}
async function loadDaily(){try{const date=$('#dailyDate').value;const d=await api('dailySummary',{date});$('#dailyOwnerTotal').textContent=won(d.totals.ownerTotal);$('#dailyWorkerTotal').textContent=won(d.totals.workerPayoutTotal);$('#dailyReportTotal').textContent=won(d.totals.reportTotal);$('#workerSummary').innerHTML=table(['작업자','구분','수량','기준금액','지급금액','보고금액'],d.byWorker.map(x=>[x.workerName,x.role==='owner'?'주인장':'직원',x.qty,won(x.ownerTotal),won(x.workerPayout),won(x.reportTotal)]));$('#productSummary').innerHTML=table(['품목','수량','기준단가','직원단가','보고단가','기준금액','직원지급','보고금액'],d.byProduct.map(x=>[x.productName,x.qty,won(x.ownerPrice),won(x.workerPrice),won(x.reportPrice),won(x.ownerTotal),won(x.workerPayout),won(x.reportTotal)]));$('#dailyDetails').innerHTML=table(['시간','작업자','품목','수량','적용 지급단가','지급금액'],d.entries.map(x=>[x.createdAtLabel,x.workerName,x.productName,x.qty,won(x.payoutUnit),won(x.payoutTotal)]));toast(`${date} 조회 완료`)}catch(e){toast(e.message)}}

async function loadMonthly(){try{const month=$('#monthlyMonth').value;const d=await api('monthlySummary',{month});$('#monthlyQty').textContent=`${Number(d.totals.qty||0).toLocaleString('ko-KR')}개`;$('#monthlyOwnerTotal').textContent=won(d.totals.ownerTotal);$('#monthlyWorkerTotal').textContent=won(d.totals.workerPayoutTotal);$('#monthlyReportTotal').textContent=won(d.totals.reportTotal);$('#monthlyByDate').innerHTML=table(['날짜','수량','주인장 기준','직원 지급','보고금액'],d.byDate.map(x=>[x.date,Number(x.qty).toLocaleString('ko-KR')+'개',won(x.ownerTotal),won(x.workerPayoutTotal),won(x.reportTotal)]));toast(`${month} 월간 합계 조회 완료`)}catch(e){toast(e.message)}}
function table(headers,rows){if(!rows.length)return '<div class="empty">내역이 없습니다.</div>';return `<table class="table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
function openProduct(p){$('#productId').value=p?.id||'';$('#productName').value=p?.name||'';$('#ownerPrice').value=p?.ownerPrice||'';$('#productModalTitle').textContent=p?'품목 수정':'품목 추가';updatePricePreview();$('#productModal').classList.add('open')}
function updatePricePreview(){const v=Number($('#ownerPrice').value)||0;$('#pricePreview').textContent=v?`자동 계산 → 직원 ${won(Math.max(0,v-50))} / 보고 ${won(Math.round(v*1.1))}`:''}
function bind(){
  $$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});
  $('#productSearch').oninput=renderProductButtons;$('#dbSearch').oninput=renderProductList;$('#ownerPrice').oninput=updatePricePreview;
  document.addEventListener('click',async e=>{
    const a=e.target.closest('[data-add-product]');if(a)return addDraft(a.dataset.addProduct);
    const q=e.target.closest('[data-qty]');if(q){const i=Number(q.dataset.qty);state.draft[i].qty=Math.max(1,(Number(state.draft[i].qty)||1)+Number(q.dataset.delta));return renderDraft()}
    const r=e.target.closest('[data-remove]');if(r){state.draft.splice(Number(r.dataset.remove),1);return renderDraft()}
    const ep=e.target.closest('[data-edit-product]');if(ep)return openProduct(state.products.find(x=>x.id===ep.dataset.editProduct));
    const dp=e.target.closest('[data-delete-product]');if(dp&&confirm('이 품목을 삭제(비활성화)할까요? 기존 작업내역은 유지됩니다.')){try{await api('deleteProduct',{id:dp.dataset.deleteProduct});await refreshAll();toast('품목 삭제 완료')}catch(err){toast(err.message)}return}
    const dw=e.target.closest('[data-delete-worker]');if(dw&&confirm('이 작업자를 삭제(비활성화)할까요? 기존 작업내역은 유지됩니다.')){try{await api('deleteWorker',{id:dw.dataset.deleteWorker});await refreshAll();toast('작업자 삭제 완료')}catch(err){toast(err.message)}return}
  });
  document.addEventListener('change',e=>{const i=e.target.dataset.qtyInput;if(i!==undefined){state.draft[Number(i)].qty=Math.max(1,Number(e.target.value)||1);renderDraft()}});
  $('#saveEntries').onclick=async()=>{if(!state.draft.length)return toast('저장할 작업이 없습니다.');try{await api('addEntries',{entries:state.draft});state.draft=[];renderDraft();toast('작업내역 저장 완료')}catch(e){toast(e.message)}};
  $('#clearDraft').onclick=()=>{if(state.draft.length&&confirm('입력 중인 내용을 비울까요?')){state.draft=[];renderDraft()}};
  $('#loadDaily').onclick=loadDaily;$('#loadMonthly').onclick=loadMonthly;$('#dailyDate').onchange=()=>{$('#monthlyMonth').value=$('#dailyDate').value.slice(0,7);loadMonthly()};$('#newProduct').onclick=()=>openProduct(null);$('#closeProductModal').onclick=()=>$('#productModal').classList.remove('open');
  $('#saveProduct').onclick=async()=>{const id=$('#productId').value,name=$('#productName').value.trim(),ownerPrice=Number($('#ownerPrice').value);if(!name||ownerPrice<0)return toast('품목명과 기준단가를 확인하세요.');try{await api(id?'updateProduct':'addProduct',{id,name,ownerPrice});$('#productModal').classList.remove('open');await refreshAll();toast('품목 저장 완료')}catch(e){toast(e.message)}};
  $('#addWorker').onclick=async()=>{const name=$('#newWorkerName').value.trim();if(!name)return toast('작업자 이름을 입력하세요.');try{await api('addWorker',{name});$('#newWorkerName').value='';await refreshAll();toast('작업자 추가 완료')}catch(e){toast(e.message)}};
  $('#backupNow').onclick=async()=>{try{const d=await api('backupNow');toast(`백업 완료: ${d.fileName}`)}catch(e){toast(e.message)}};
  $('#saveAccessKey').onclick=async()=>{const key=$('#accessKey').value.trim();if(!key)return toast('접속키를 입력하세요.');state.accessKey=key;localStorage.setItem('sidejobAccessKey',key);$('#authModal').classList.remove('open');await refreshAll()};
  $('#installApp').onclick=async()=>{if(state.installPrompt){state.installPrompt.prompt();const result=await state.installPrompt.userChoice;state.installPrompt=null;$('#installApp').hidden=true;if(result.outcome==='accepted')toast('앱 설치를 시작합니다.')}else{toast(/iPhone|iPad|iPod/.test(navigator.userAgent)?'iPhone/iPad: Safari 공유 버튼 → 홈 화면에 추가를 눌러주세요.':'브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택해주세요.')}};
}
function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('#installApp').hidden=false});
window.addEventListener('appinstalled',()=>{$('#installApp').hidden=true;state.installPrompt=null;toast('앱 설치 완료')});
if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.navigator.standalone)$('#installApp').hidden=false;
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
init();
