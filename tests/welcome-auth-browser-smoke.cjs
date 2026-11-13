'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({
    viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#profileAuthModal.show').waitFor({state:'visible'});
  await page.locator('#authRegisterTab').click();
  await page.locator('#authName').fill('Путешественник');
  await page.locator('#authEmail').fill('traveller@example.com');
  await page.locator('#authPassword').fill('Ab123');
  await page.locator('#authConfirm').fill('Ab123');
  await page.locator('#authSubmit').click();
  assert.match(await page.locator('#authError').innerText(),/от 6 до 128 символов/);
  await page.locator('#authPassword').fill('A1b2c3');
  await page.locator('#authConfirm').fill('Different987');
  await page.locator('#authSubmit').click();
  assert.match(await page.locator('#authError').innerText(),/Пароли не совпадают/);
  await page.locator('#authConfirm').fill('A1b2c3');
  await page.locator('#authSubmit').click();
  await page.locator('#profileAuthModal').waitFor({state:'hidden',timeout:15000});
  assert.equal(await page.locator('#home.active').count(),1);
  const saved=await page.evaluate(()=>({
    accounts:JSON.parse(localStorage.getItem('rr_local_accounts_v2')||'[]'),
    profile:JSON.parse(localStorage.getItem('rr_user_profile')||'null'),
    session:localStorage.getItem('rr_user_session_v31')
  }));
  assert.equal(saved.accounts.length,1);
  assert.equal(saved.accounts[0].name,'Путешественник');
  assert.equal(saved.accounts[0].email,'traveller@example.com');
  assert.match(saved.accounts[0].salt,/^[0-9a-f]{32}$/);
  assert.match(saved.accounts[0].verifier,/^[0-9a-f]{64}$/);
  assert.equal(saved.accounts[0].password,undefined,'plaintext password must never be stored');
  assert.equal(saved.profile.name,'Путешественник');
  assert.equal(saved.session,'1');
  const allStorage=await page.evaluate(()=>JSON.stringify({...localStorage}));
  assert.ok(!allStorage.includes('A1b2c3'),'storage must not contain plaintext credentials');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#profileAuthModal.show').count(),0,'local session persists after reload');
  await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
  assert.equal(await page.locator('#profileName').innerText(),'Путешественник');
  await page.locator('#profileLogout').click();
  await page.locator('#profileAuthModal.show').waitFor({state:'visible'});
  assert.equal(await page.locator('#authLoginTab').getAttribute('aria-selected'),'true');
  await page.locator('#authEmail').fill('traveller@example.com');
  await page.locator('#authPassword').fill('D4e5f6');
  await page.locator('#authSubmit').click();
  await page.waitForFunction(()=>document.querySelector('#authError')?.textContent.includes('Неправильный пароль'),null,{timeout:9000});
  assert.match(await page.locator('#authError').innerText(),/Неправильный пароль/);
  assert.equal(await page.locator('#profileAuthModal.show').count(),1);
  await page.locator('#authPassword').fill('A1b2c3');
  await page.locator('#authSubmit').click();
  await page.locator('#profileAuthModal').waitFor({state:'hidden',timeout:15000});
  await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
  assert.equal(await page.locator('#profileName').innerText(),'Путешественник');
  await page.locator('#profileLogout').click();
  await page.locator('#authGuest').click();
  await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
  assert.equal(await page.locator('#profileName').innerText(),'Гость');
  assert.equal(await page.evaluate(()=>localStorage.getItem('rr_user_session_v31')),null);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rr_local_accounts_v2')).length),1,
    'guest must not delete existing local account');
  assert.equal(errors.filter(x=>/TypeError|ReferenceError/.test(x)).length,0,errors.join(' | '));
  console.log('LOCAL_AUTH_BROWSER_OK register validation, salted PBKDF2, wrong password, login, reload, guest switch');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
