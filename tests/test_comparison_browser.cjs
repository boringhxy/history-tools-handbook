/* Browser acceptance. Run against the local service; provider fixtures never call a paid API. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 const context = await browser.newContext({viewport:{width:1440,height:1000}});
 const page = await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const origin=process.env.PREVIEW_URL || 'http://127.0.0.1:8765';
 await page.goto(origin+'/?ca=shidian&cb=dedu#compare');
 await page.waitForSelector('#cmp-tbody tr');
 assert.equal(await page.locator('#cmp-search-a').inputValue(),'识典古籍');
 assert.equal(await page.locator('#cmp-tbody>tr[data-dimension]').count(),13);
 await page.waitForFunction(()=>!document.getElementById('cmp-service-status').textContent.includes('正在检查'));
 assert.equal(await page.locator('#cmp-send').isDisabled(),true);
 assert.match(await page.locator('#cmp-service-status').innerText(),/未|配置|不可用/);
 const dimensions=await page.locator('.cmp-workspace').evaluate(e=>{let a=e.children[0].getBoundingClientRect(),b=e.children[1].getBoundingClientRect();return [a.width,b.width]});
 assert.ok(dimensions[0]/dimensions[1]>1.8);
 const shots=path.resolve(__dirname,'../../../outputs');
 await page.screenshot({path:path.join(shots,'双平台Agent_桌面预览.png'),fullPage:false});
 // Alias search by keyboard and duplicate prevention.
 await page.locator('#cmp-search-a').fill('shidian');await page.locator('#cmp-search-a').press('ArrowDown');await page.locator('#cmp-search-a').press('Enter');
 assert.equal(await page.locator('#cmp-search-a').inputValue(),'识典古籍');
 await page.locator('#cmp-search-b').fill('shidian');await page.locator('#cmp-search-b').press('Enter');
 assert.equal(await page.locator('#cmp-search-b').inputValue(),'shidian'); // invalid draft is reset on blur
 await page.locator('#cmp-search-b').press('Escape');
 assert.equal(await page.locator('#cmp-search-b').inputValue(),'DEDU 对读');
 await page.locator('#cmp-swap').click();assert.equal(await page.locator('#cmp-search-a').inputValue(),'DEDU 对读');
 await page.goBack();await page.waitForTimeout(80);assert.equal(await page.locator('#cmp-search-a').inputValue(),'识典古籍');
 assert.equal(await page.locator('#cmp-tbody td .cmp-capability-tags').count(),26);
 const groupLabels=await page.locator('#cmp-tbody>.cmp-group-row').allTextContents();
 assert.deepEqual(groupLabels,['01 确认用途与条件','02 查找与获取材料','03 准备自有材料','04 处理与分析材料','05 导出与保存成果','06 核查依据与限制']);
 const expectedDimensions=await page.locator('#comparison-platforms-data').evaluate(e=>window.CompareCore.workflowDimensions(JSON.parse(e.textContent)));
 assert.deepEqual(await page.locator('#cmp-task option').allTextContents(),['全部比较维度',...expectedDimensions.map(d=>d.label)]);
 for(const dimension of expectedDimensions){
  await page.locator('#cmp-task').selectOption(dimension.key);
  assert.equal(await page.locator('#cmp-tbody>tr[data-dimension]').count(),1);
  assert.equal(await page.locator('#cmp-row-'+dimension.key).count(),1);
  assert.equal(await page.locator('#cmp-task-details').isVisible(),false);
 }
 await page.locator('#cmp-diff').check();await page.locator('#cmp-reset-filters').click();assert.equal(await page.locator('#cmp-tbody>tr[data-dimension]').count(),13);
 await page.locator('[data-cmp-example="zotero,tropy"]').click();assert.equal(await page.locator('#cmp-search-a').inputValue(),'Zotero');
 await page.locator('#cmp-share').click();await page.locator('#cmp-copy').click();
 // Old links route to intact reference panels.
 await page.goto(origin+'/#profile-dedu');await page.waitForSelector('#compare:not([hidden])');
 assert.equal(await page.locator('#comparison-legacy').isVisible(),false);
 await page.goto(origin+'/#focus-comparison');assert.equal(await page.locator('#compare').isVisible(),true);
 await page.goto(origin+'/?ca=markus&cb=comparativus#compare');await page.waitForSelector('#cmp-tbody tr');
 assert.ok(!(await page.locator('#cmp-tbody').innerText()).includes('核心档案整理'));
 // Provider API fixtures validate UI behavior only, never shipped in page.
 await page.route('**/api/status',route=>route.fulfill({json:{available:true,message:'测试服务',dailyLimit:5,remaining:5,webSearchAvailable:true}}));
 await page.route('**/api/chat',async route=>{
  const request=route.request().postDataJSON();assert.equal(request.platformIds.length,2);
  await route.fulfill({json:{answer:'选型建议：先核对支持处理的自有材料 [1]。\n跨平台衔接为建议路径，未验证直连。',sources:[{id:1,label:'测试来源',url:'https://example.org/',evidence:'测试夹具',checkedAt:'2026-10-22'}],checkedAt:'2026-10-22',remaining:4,webChecked:false}});
 });
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#cmp-send').disabled);
 await page.locator('#cmp-material').fill('两种古籍文本');await page.locator('#cmp-question').fill('应该如何选择？');await page.locator('#cmp-send').click();
 await page.waitForSelector('.cmp-answer-sources');assert.equal(await page.locator('#cmp-chat-log .cmp-message').count(),2);
 await page.locator('#cmp-question').fill('再解释一下');await page.locator('#cmp-send').click();await page.waitForFunction(()=>document.querySelectorAll('.cmp-answer-sources').length===2);
 await page.locator('#cmp-swap').click();assert.equal(await page.locator('#cmp-chat-log .cmp-message').count(),0);
 assert.equal(await page.locator('#cmp-material').inputValue(),'两种古籍文本');
 await page.route('**/api/chat',route=>route.fulfill({status:429,json:{error:'rate_limit',message:'请求过于频繁'}}));
 await page.locator('#cmp-question').fill('测试限频');await page.locator('#cmp-send').click();await page.waitForFunction(()=>document.getElementById('cmp-service-status').textContent.includes('一分钟'));
 await page.locator('#cmp-reconnect').click();await page.waitForFunction(()=>!document.getElementById('cmp-send').disabled);
 // Mobile tabs, no document overflow, state survives switching.
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/?ca=shidian&cb=dedu#compare');await page.waitForSelector('#cmp-tbody tr');
 await page.waitForTimeout(150);
 assert.equal(await page.locator('#page-comparison>.page-subnav').count(),0);
 assert.equal(await page.locator('[data-primary-page="comparison"]').innerText(),'平台对比');
 assert.equal(await page.locator('.chapter-toolbar').isVisible(),false);
 assert.equal(await page.locator('#cmp-chat-panel').isVisible(),false);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:path.join(shots,'双平台Agent_手机预览.png'),fullPage:false});
 await page.locator('#cmp-tab-chat').click();assert.equal(await page.locator('#cmp-chat-panel').isVisible(),true);
 await page.locator('#cmp-goal').fill('版本对读');await page.locator('#cmp-tab-table').click();await page.locator('#cmp-tab-chat').click();assert.equal(await page.locator('#cmp-goal').inputValue(),'版本对读');
 await page.locator('#cmp-tab-chat').press('ArrowLeft');assert.equal(await page.locator('#cmp-tab-table').getAttribute('aria-selected'),'true');
 // Print reports only active comparison, retains metadata; restores screen state.
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('#matrix').isVisible(),false);assert.equal(await page.locator('#cmp-table-panel').isVisible(),true);
 await page.pdf({path:path.join(shots,'双平台Agent_打印验证.pdf'),format:'A4',landscape:true,printBackground:true});
 await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('print-comparison')),false);
 // Offline packaged page still compares and never pretends AI is connected.
 const offline=await context.newPage();await offline.goto('file://'+path.resolve(__dirname,'../index.html')+'#compare');await offline.waitForSelector('#cmp-tbody tr');
 assert.match(await offline.locator('#cmp-service-status').innerText(),/离线/);assert.equal(await offline.locator('#cmp-send').isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('Browser acceptance passed: desktop/mobile/search/swap/history/tasks/references/chat/print/offline; no page errors');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
