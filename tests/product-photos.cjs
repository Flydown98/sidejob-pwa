// Run with: node tests/product-photos.cjs (Playwright + Chromium required).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
async function main(){
  // Execute the real Apps Script product write code against an in-memory sheet.
  const headers=['id','name','ownerPrice','active','createdAt','updatedAt'];
  const rows=[{id:'p1',name:'기존 품목',ownerPrice:200,active:true,_row:2}];
  const sh={getLastColumn:()=>headers.length,getRange:(r,c)=>({getValues:()=>[headers.slice()],setValue:v=>{if(r===1)headers[c-1]=v;else rows[r-2][headers[c-1]]=v}}),appendRow:values=>rows.push(Object.fromEntries(headers.map((h,i)=>[h,values[i]])))};
  const ctx=vm.createContext({db_:()=>({getSheetByName:()=>sh}),Utilities:{getUuid:()=> 'p2'}});
  vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),ctx);
  ctx.db_=()=>({getSheetByName:()=>sh});ctx.readObjects_=()=>rows;
  const photo='data:image/jpeg;base64,/9j/';
  ctx.saveProduct_('p1','기존 품목',200,photo);assert.equal(headers[6],'imageData');assert.equal(rows[0].imageData,photo);
  ctx.saveProduct_('p1','이름 수정',250);assert.equal(rows[0].imageData,photo);
  ctx.saveProduct_('p1','이름 수정',250,'');assert.equal(rows[0].imageData,'');
  ctx.saveProduct_(null,'새 품목',300,photo);assert.equal(rows[1].imageData,photo);
  assert.throws(()=>ctx.saveProduct_('p1','오류',200,'javascript:alert(1)'));
  assert.throws(()=>ctx.saveProduct_('p1','오류',200,'data:image/jpeg;base64,'+'A'.repeat(45000)));
  console.log('Backend: migration, create, preserve, remove, validation PASS');
  const server=spawn('python3',['-m','http.server','8123','--bind','127.0.0.1'],{stdio:'ignore'});
  let browser;
  try{
    for(let i=0;i<30;i++){try{if((await fetch('http://127.0.0.1:8123')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
    browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let product={id:'p1',name:'기존 품목',ownerPrice:200,active:true};
    await page.route('https://script.google.com/**',async route=>{const r=route.request().postDataJSON();if(r.action==='updateProduct')product={...product,...r};await route.fulfill({json:{ok:true,data:r.action==='bootstrap'?{products:[product],workers:[{id:'w1',name:'작업자',role:'worker'}]}:{}}})});
    await page.addInitScript(()=>localStorage.setItem('sidejobAccessKey','test-only'));
    await page.goto('http://127.0.0.1:8123');await page.waitForSelector('[data-add-product]');
    await page.click('[data-tab="products"]');await page.click('[data-edit-product]');
    const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=900;const x=c.getContext('2d');x.fillStyle='red';x.fillRect(0,0,1200,900);return c.toDataURL('image/png').split(',')[1]});
    await page.setInputFiles('#productPhoto',{name:'photo.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForSelector('#productPhotoPreview img');
    await page.click('#saveProduct');await page.waitForSelector('#productList img');assert(product.imageData.length<=45000);
    await page.click('#productList img');assert(await page.locator('#photoViewer').isVisible());await page.click('#closePhotoViewer');
    await page.reload();await page.waitForSelector('#productButtons img');await page.click('[data-add-product]');await page.waitForSelector('#draftEntries img');
    await page.evaluate(()=>{const x={productId:'p1',productName:'기존 품목'};document.querySelector('#dailyDetails').innerHTML=productLabel(x);document.querySelector('#monthlyDetails').innerHTML=productLabel(x)});
    assert.equal(await page.locator('#dailyDetails img').count(),1);assert.equal(await page.locator('#monthlyDetails img').count(),1);
    await page.click('[data-tab="products"]');await page.click('[data-edit-product]');await page.click('#removeProductPhoto');await page.click('#saveProduct');await page.waitForFunction(()=>!document.querySelector('#productModal.open'));assert.equal(product.imageData,'');assert.equal(await page.locator('#productList img').count(),0);
    assert.deepEqual(errors,[]);console.log('Browser mobile: upload, compress, save, reload, zoom, draft, summary labels, remove PASS');
  }finally{if(browser)await browser.close();server.kill()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
