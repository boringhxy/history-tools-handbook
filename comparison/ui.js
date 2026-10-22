(function () {
  'use strict';
  const root = document.getElementById('compare');
  if (!root) return;
  const C = window.CompareCore;
  const data = JSON.parse(document.getElementById('comparison-platforms-data').textContent);
  const byId = new Map(data.platforms.map(p => [p.id,p]));
  const $ = id => document.getElementById(id);
  let pair = C.selectionFromURL(location.href, data.platforms) || ['shidian','dedu'];
  let history = [], conversation = [], epoch = 0, pending = false, requestController = null;
  let serviceAvailable = false, printingState = null;
  const endpoint = (document.querySelector('meta[name="comparison-api-base"]')?.content || '').replace(/\/$/,'');
  function el(tag, text, cls) { const node=document.createElement(tag); if(text !== undefined)node.textContent=text; if(cls)node.className=cls; return node; }
  function announce(text) { $('cmp-notice').textContent=text; }
  function sourceLinks(parent, sources) {
    for(const source of sources || []) {
      const url=C.safeURL(source.url); if(!url)continue;
      const a=el('a', source.label || '查看来源');a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);
    }
  }
  function renderCell(field) {
    const td=el('td');td.append(el('p',field.text));
    const meta=el('p',undefined,'cmp-cell-meta');
    const evidence=el('span',field.evidence || '资料待补充','cmp-evidence');
    evidence.dataset.unknown=String(/待|不足/.test(field.evidence || ''));
    meta.append(evidence,document.createTextNode('核对：'+(field.checkedAt || '日期未记录')));td.append(meta);
    if(field.sources?.length) {
      const details=el('details',undefined,'cmp-cell-sources');details.append(el('summary','依据与来源 · '+field.sources.length));sourceLinks(details,field.sources);td.append(details);
    }
    return td;
  }
  function drawTable() {
    const header=el('tr');header.append(el('th','比较维度'));
    pair.forEach(id=>header.append(el('th',byId.get(id).name)));
    header.querySelectorAll('th').forEach(th=>th.scope='col');$('cmp-thead').replaceChildren(header);
    const rows=C.comparisonRows(data,pair,{differences:$('cmp-diff').checked,task:$('cmp-task').value});
    const body=$('cmp-tbody');body.replaceChildren();
    for(const row of rows) {
      const tr=el('tr');tr.id='cmp-row-'+row.key;
      const title=el('th',row.label);title.scope='row';tr.append(title);
      row.cells.forEach(cell=>tr.append(renderCell(cell)));body.append(tr);
    }
    const tasks=C.comparisonTasks(data,pair,{differences:$('cmp-diff').checked,task:$('cmp-task').value});
    $('cmp-task-details').hidden=tasks.length===0;
    $('cmp-task-head').replaceChildren(header.cloneNode(true));
    $('cmp-task-body').replaceChildren();
    for(const row of tasks) {
      const tr=el('tr');const title=el('th',row.label);title.scope='row';tr.append(title);
      row.cells.forEach(cell=>tr.append(renderCell(cell)));$('cmp-task-body').append(tr);
    }
    $('cmp-task-summary').textContent='研究任务细比 · '+tasks.length+' 项（含具体条件与证据）';
    $('cmp-task-details').open=Boolean($('cmp-task').value);
    $('cmp-no-diff').hidden=rows.length>0;
    $('cmp-dimension-count').textContent=rows.length+' 项维度';
  }
  function writeURL(mode='push') {
    const u=new URL(location.href);u.searchParams.set('ca',pair[0]);u.searchParams.set('cb',pair[1]);u.hash='compare';
    if(mode==='push') window.history.pushState({},'',u); else window.history.replaceState({},'',u);
    window.dispatchEvent(new Event('hashchange'));
  }
  function updatePair(next, updateURL=true) {
    if(!C.validPair(data.platforms,next)){announce('请选择两个不同的平台。');return;}
    const changed=next.join('|')!==pair.join('|');pair=[...next];
    if(changed) {
      epoch++;requestController?.abort();requestController=null;history=[];conversation=[];pending=false;
      $('cmp-chat-log').replaceChildren();$('cmp-print-conversation').textContent='';
      $('cmp-send').disabled=!serviceAvailable;$('cmp-send').textContent='生成选型建议 ↗';
      announce('平台已更新。已开始新的问答；材料、任务和使用条件仍保留。');
    }
    ['a','b'].forEach((side,i)=>{
      $('cmp-search-'+side).value=byId.get(pair[i]).name;
      $('cmp-kind-'+side).textContent=byId.get(pair[i]).kind+' · '+(byId.get(pair[i]).materials || []).slice(0,3).join(' / ');
    });
    $('cmp-chat-pair').textContent=pair.map(id=>byId.get(id).name).join(' × ');
    if(byId.get(pair[0]).kind!==byId.get(pair[1]).kind)announce('这两个对象承担不同研究角色。请结合材料与目标比较其分工，不宜直接判断整体优劣。');
    drawTable();if(updateURL)writeURL();
  }
  for(const [i,side] of ['a','b'].entries()) {
    const input=$('cmp-search-'+side),list=$('cmp-options-'+side);
    let choices=[],active=-1;
    function close() {list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
    function highlight(n) {
      active=n;const nodes=[...list.querySelectorAll('[role="option"]')];
      nodes.forEach((node,j)=>node.setAttribute('aria-selected',String(j===active)));
      if(nodes[active]){input.setAttribute('aria-activedescendant',nodes[active].id);nodes[active].scrollIntoView({block:'nearest'});}
    }
    function pick(id) {
      if(id===pair[1-i]){announce('该平台已在另一侧，请选择不同的平台。');return;}
      const next=[...pair];next[i]=id;close();updatePair(next);input.focus();
    }
    function show(query) {
      choices=C.findPlatforms(data.platforms,query);active=-1;list.replaceChildren();
      choices.forEach((p,j)=>{
        const item=el('li',p.name);item.id='cmp-opt-'+side+'-'+j;item.setAttribute('role','option');item.setAttribute('aria-selected','false');
        item.setAttribute('aria-disabled',String(p.id===pair[1-i]));item.append(el('small',p.kind+(p.id===pair[1-i]?' · 已在另一侧选择':'')));
        item.addEventListener('pointerdown',event=>event.preventDefault());item.addEventListener('click',()=>pick(p.id));list.append(item);
      });
      if(!choices.length)list.append(el('li','没有找到匹配项，请尝试英文名称或别名。'));
      list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
    }
    input.addEventListener('focus',()=>show(''));
    input.addEventListener('input',()=>show(input.value));
    input.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();if(list.hidden)show(input.value===byId.get(pair[i]).name?'':input.value);
        if(choices.length)highlight((active+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length);
      } else if(event.key==='Enter') {
        event.preventDefault();if(!list.hidden&&choices.length)pick(choices[Math.max(0,active)].id);
      } else if(event.key==='Escape') {event.preventDefault();close();input.value=byId.get(pair[i]).name;}
    });
    input.addEventListener('blur',()=>{close();input.value=byId.get(pair[i]).name;});
  }
  $('cmp-swap').addEventListener('click',()=>updatePair([...pair].reverse()));
  root.querySelectorAll('[data-cmp-example]').forEach(button=>button.addEventListener('click',()=>updatePair(button.dataset.cmpExample.split(','))));
  $('cmp-diff').addEventListener('change',drawTable);$('cmp-task').addEventListener('change',drawTable);
  $('cmp-reset-filters').addEventListener('click',()=>{$('cmp-diff').checked=false;$('cmp-task').value='';drawTable();});
  function tab(view,focus=false) {
    root.querySelector('.cmp-workspace').dataset.mobileView=view;
    ['table','chat'].forEach(name=>{const button=$('cmp-tab-'+name);button.setAttribute('aria-selected',String(name===view));button.tabIndex=name===view?0:-1;});
    if(focus)$('cmp-tab-'+view).focus();
  }
  ['table','chat'].forEach(name=>{
    $('cmp-tab-'+name).addEventListener('click',()=>tab(name));
    $('cmp-tab-'+name).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();tab(event.key==='Home'?'table':event.key==='End'?'chat':name==='table'?'chat':'table',true);}});
  });
  function jump(key) {
    $('cmp-task').value='';$('cmp-diff').checked=false;drawTable();tab('table');
    const row=$('cmp-row-'+key);if(row){row.classList.add('cmp-highlight');row.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>row.classList.remove('cmp-highlight'),2500);}
  }
  function addMessage(role,text,result) {
    const box=el('div',undefined,'cmp-message');box.append(el('strong',role==='user'?'你的问题':'研究助手'));
    // Render untrusted model text as text; only known source IDs become links.
    const textNode=el('div');const sources=result?.sources || [];const chunks=String(text).split(/(\[\d+\])/g);
    chunks.forEach(chunk=>{
      const match=chunk.match(/^\[(\d+)\]$/);const source=match && sources.find(s=>String(s.id).replace(/[\[\]]/g,'')===match[1]);
      if(source&&C.safeURL(source.url)){const a=el('a',chunk);a.href=C.safeURL(source.url);a.target='_blank';a.rel='noopener noreferrer';textNode.append(a);}else textNode.append(document.createTextNode(chunk));
    });box.append(textNode);
    if(result) {
      const refs=el('div',undefined,'cmp-answer-sources');
      sources.forEach(s=>{const u=C.safeURL(s.url);if(!u)return;const a=el('a',`[${s.id}] ${s.label} · ${s.evidence || '资料来源'} · ${s.checkedAt || '日期未记录'}`);a.href=u;a.target='_blank';a.rel='noopener noreferrer';refs.append(a);});box.append(refs);
      box.append(el('p',(result.webChecked?'含本次联网核查':'依据资料库回答')+' · '+(result.checkedAt || '未记录时间')+' · 以下为研究方法建议，跨平台交接须先小样本验证。','cmp-answer-meta'));
      const jumps=el('div');data.dimensions.filter(d=>text.includes(d.label)).forEach(d=>{const b=el('button','查看'+d.label,'cmp-answer-jump');b.type='button';b.addEventListener('click',()=>jump(d.key));jumps.append(b);});box.append(jumps);
    }
    $('cmp-chat-log').append(box);conversation.push({role,text,sources});
  }
  function setService(available,message) { serviceAvailable=available;$('cmp-service-status').textContent=message;$('cmp-service-status').dataset.available=String(available);$('cmp-send').disabled=!available||pending; }
  async function status() {
    if(location.protocol==='file:'){setService(false,'离线阅读模式：基础对比可用；在线问答需要启动并配置服务。');return;}
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),6000);
    try {
      const response=await fetch(endpoint+'/api/status',{credentials:'include',signal:controller.signal});
      if(!response.ok)throw new Error('unavailable');const result=await response.json();
      setService(Boolean(result.available),result.message+(result.available?` · 今日剩余 ${result.remaining ?? result.dailyLimit} 轮`:'')+(result.available&&!result.webSearchAvailable?' · 官网核查未启用':''));
    }catch(_){setService(false,'在线问答尚未连接，或服务暂不可用。你仍可完整查看、复制和打印基础对比。');}finally{clearTimeout(timeout);}
  }
  $('cmp-reconnect').addEventListener('click',status);
  root.querySelectorAll('[data-cmp-question]').forEach(button=>button.addEventListener('click',()=>{$('cmp-question').value=button.dataset.cmpQuestion;$('cmp-question').focus();}));
  $('cmp-chat-form').addEventListener('submit',async event=>{
    event.preventDefault();if(pending||!serviceAvailable)return;
    const question=$('cmp-question').value.trim();if(!question){$('cmp-question').focus();announce('请先描述问题，或点击“如何选择”“如何配合”填入问题。');return;}
    const turn=epoch,platformIds=[...pair];pending=true;$('cmp-send').disabled=true;$('cmp-send').textContent='正在核对资料与生成建议…';
    addMessage('user',question);const controller=new AbortController();requestController=controller;const timeout=setTimeout(()=>controller.abort(),100000);
    try {
      const response=await fetch(endpoint+'/api/chat',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({platformIds,question,material:$('cmp-material').value.trim(),goal:$('cmp-goal').value.trim(),constraints:$('cmp-constraints').value.trim(),history:C.boundedHistory(history)})});
      const result=await response.json();if(turn!==epoch)return;
      if(!response.ok){const err=new Error(result.message||'问答请求未完成。');err.status=response.status;err.code=result.error;throw err;}
      if(typeof result.answer!=='string'||!Array.isArray(result.sources))throw new Error('服务返回格式异常，请稍后重试。');
      addMessage('assistant',result.answer,result);history.push({role:'user',content:question},{role:'assistant',content:result.answer});$('cmp-question').value='';
      if(result.remaining===0)setService(false,'今日问答额度已用尽，明日可继续。基础对比仍可使用。');
      else setService(true,`问答服务已连接 · 今日剩余 ${result.remaining ?? '—'} 轮`);
      announce('已生成建议。请核对回答中的来源与待确认事项。');
    } catch(error) {
      if(turn!==epoch)return;
      const msg=error.name==='AbortError'?'问答等待超时。服务端可能已计入本轮额度，请稍后重试。':error.message;
      const notice=el('div',msg,'cmp-message');notice.setAttribute('role','alert');$('cmp-chat-log').append(notice);
      if(error.status===429&&error.code==='rate_limit'){setService(false,msg+' 将在一分钟后重新检查，也可点击重新检查。');setTimeout(status,61000);}else if([429,503].includes(error.status))setService(false,msg);
    } finally {
      clearTimeout(timeout);if(turn===epoch){pending=false;requestController=null;$('cmp-send').textContent='生成选型建议 ↗';$('cmp-send').disabled=!serviceAvailable;}
    }
  });
  function fullReport() {
    const lines=[C.report(data,pair,{}),'\n【研究条件】',`材料：${$('cmp-material').value || '未填写'}`,`目标：${$('cmp-goal').value || '未填写'}`,`约束：${$('cmp-constraints').value || '未填写'}`];
    if(conversation.length)lines.push('\n【研究助手对话】');
    conversation.forEach(m=>{lines.push((m.role==='user'?'用户：':'助手：')+m.text);m.sources.forEach(s=>{if(C.safeURL(s.url))lines.push(`[${s.id}] ${s.label}：${s.url}；${s.evidence || '资料来源'}；${s.checkedAt || '日期未记录'}`);});});return lines.join('\n');
  }
  async function copy(text,success) {
    try {
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);
      else {const area=el('textarea');area.value=text;area.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error('copy');}
      announce(success);
    }catch(_){announce('浏览器未允许复制。可使用“打印 / 保存 PDF”保留对比内容。');}
  }
  $('cmp-copy').addEventListener('click',()=>copy(fullReport(),'完整报告已复制，包含全部维度、研究条件、来源和当前对话。'));
  $('cmp-share').addEventListener('click',()=>{const u=new URL(location.href);u.searchParams.set('ca',pair[0]);u.searchParams.set('cb',pair[1]);u.hash='compare';copy(u.href,'对比链接已复制。链接仅包含平台选择，不包含研究问题和对话。');});
  function preparePrint() {
    if(printingState)return;
    printingState=[...root.querySelectorAll('details')].map(d=>[d,d.open]);printingState.forEach(([d])=>d.open=true);
    const p=pair.map(id=>byId.get(id).name);$('cmp-print-conversation').textContent=`${p.join(' × ')}\n\n研究材料：${$('cmp-material').value || '未填写'}\n研究目标：${$('cmp-goal').value || '未填写'}\n使用条件：${$('cmp-constraints').value || '未填写'}\n\n`+conversation.map(m=>(m.role==='user'?'用户：':'助手：')+m.text+'\n'+m.sources.map(s=>`[${s.id}] ${s.label}：${s.url}；${s.evidence || '资料来源'}；${s.checkedAt || '日期未记录'}`).join('\n')).join('\n\n');
    document.body.classList.add('print-comparison');
  }
  $('cmp-print').addEventListener('click',()=>{preparePrint();window.print();});
  window.addEventListener('beforeprint',()=>{if(document.body.dataset.currentPage==='comparison'&&!root.hidden&&!document.body.classList.contains('print-all'))preparePrint();});
  window.addEventListener('afterprint',()=>{printingState?.forEach(([d,open])=>d.open=open);printingState=null;document.body.classList.remove('print-comparison');});
  window.addEventListener('popstate',()=>{const selected=C.selectionFromURL(location.href,data.platforms);if(selected)updatePair(selected,false);});
  window.addEventListener('online',status);window.addEventListener('offline',()=>setService(false,'当前离线，基础对比仍可使用；联网后可重新连接问答。'));
  window.addEventListener('load',()=>{if(location.hash==='#compare')requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'})));},{once:true});
  updatePair(pair,false);status();
})();
