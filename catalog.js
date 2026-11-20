(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tools = JSON.parse($('tool-catalog-data').textContent);
  const grid = $('catalog-grid');
  const controls = ['search-input','layer-filter','stage-filter','material-filter','verification-filter'].map($);
  const pager = $('catalog-pager');
  const pages = [...document.querySelectorAll('[data-page]')];
  let matches = tools, pageNumber = 1, printAll = false, printState = null;

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function normalize(value) {
    return String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g,' ').trim();
  }
  function safeURL(value) {
    try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : ''; }
    catch (_) { return ''; }
  }
  function toolCard(item) {
    const url = safeURL(item.url);
    return `<article class="tool-card">
      <span class="tool-id">NO. ${String(item.id).padStart(3,'0')}</span>
      <h3>${escapeHTML(item.name)}</h3><span class="tool-layer">${escapeHTML(item.layer)}</span>
      <p>${escapeHTML(item.functions)}</p>
      <dl><dt>开发者</dt><dd>${escapeHTML(item.developer || '未注明')}</dd><dt>类别</dt><dd>${escapeHTML(item.sourceCategory || '未分类')}</dd><dt>材料</dt><dd>${escapeHTML(item.materials.join('、'))}</dd><dt>环节</dt><dd>${escapeHTML(item.stages.join('、'))}</dd><dt>场景</dt><dd>${escapeHTML(item.scenarios)}</dd></dl>
      ${item.notes ? `<details><summary>注意事项与更新</summary><p>${escapeHTML(item.notes)}</p><p>${escapeHTML(item.updated)}</p></details>` : ''}
      <div class="tool-footer"><span class="verification${item.verificationLabel==='待核实'?' wait':''}">${escapeHTML(item.verificationLabel)}</span>${url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">项目来源 ↗</a>` : '<span>暂无可靠链接</span>'}</div>
    </article>`;
  }

  // CHAPTER_UTILITIES_BEGIN
  function routeTarget(hash, owners) {
    let id;
    try { id = decodeURIComponent(String(hash || '').replace(/^#/,'')) || 'home'; }
    catch (_) { id = 'home'; }
    if (['matrix','profiles','focus-comparison'].includes(id) || id.startsWith('profile-')) return {id:'compare',page:'comparison'};
    return Object.prototype.hasOwnProperty.call(owners,id) ? {id,page:owners[id]} : {id:'home',page:'home'};
  }
  function pageWindow(length, page, size) {
    const pages = Math.max(1,Math.ceil(length/size));
    page = Math.max(1,Math.min(pages,Math.floor(Number(page)||1)));
    return {page,pages,start:(page-1)*size,end:Math.min(page*size,length)};
  }
  // CHAPTER_UTILITIES_END

  function showPage() {
    const range = pageWindow(matches.length,pageNumber,12);
    pageNumber = range.page;
    [...grid.querySelectorAll('.tool-card')].forEach((card,index) => { card.hidden=index<range.start || index>=range.end; });
    pager.hidden = matches.length <= 12;
    pager.querySelector('[data-page-label]').textContent = `第 ${range.page} / ${range.pages} 页 · ${matches.length?range.start+1:0}—${range.end} / ${matches.length} 项`;
    pager.querySelector('[data-page-prev]').disabled = range.page===1;
    pager.querySelector('[data-page-next]').disabled = range.page===range.pages;
  }
  function applyFilters() {
    const [search,layer,stage,material,verification] = controls.map(control => control.value);
    const query = normalize(search);
    matches = tools.filter(item => {
      const text = normalize([item.name,item.functions,item.scenarios,item.developer,item.language,item.sourceCategory,item.notes,item.layer,...item.stages,...item.materials].join(' '));
      return (!query || text.includes(query)) && (!layer || item.layer===layer) && (!stage || item.stages.includes(stage)) && (!material || item.materials.includes(material)) && (!verification || item.verificationLabel===verification);
    });
    pageNumber = 1;
    $('catalog-count').textContent = matches.length;
    grid.innerHTML = matches.length ? matches.map(toolCard).join('') : '<div class="empty-state"><strong>没有匹配条目</strong><br>请减少筛选条件，或清除筛选后重新检索。</div>';
    showPage();
  }
  controls.forEach(control => control.addEventListener(control.tagName==='INPUT'?'input':'change',applyFilters));
  $('catalog-filters').addEventListener('submit',event => event.preventDefault());
  $('clear-filters').addEventListener('click',() => { controls.forEach(control => { control.value=''; });applyFilters();controls[0].focus(); });
  for (const [selector,delta] of [['[data-page-prev]',-1],['[data-page-next]',1]]) {
    pager.querySelector(selector).addEventListener('click',() => {
      pageNumber+=delta;showPage();
      grid.focus({preventScroll:true});
      grid.scrollIntoView({block:'start',behavior:'instant'});
    });
  }

  // Keep the original heading text accessible while revealing visual characters.
  const coverTitle = $('home-title');
  const titleTextNodes = [...coverTitle.childNodes].filter(node => node.nodeType===3);
  let coverCharacter = 0;
  coverTitle.setAttribute('aria-label', coverTitle.textContent);
  titleTextNodes.forEach(node => {
    const fragment=document.createDocumentFragment();
    for (const character of Array.from(node.textContent)) {
      const span=document.createElement('span');
      span.className='hero-character';
      span.setAttribute('aria-hidden','true');
      span.style.setProperty('--reveal-delay', `${coverCharacter++ * 85}ms`);
      span.textContent=character;
      fragment.append(span);
    }
    node.replaceWith(fragment);
  });
  document.getElementById('home').classList.add('hero-reveal');

  const owners = Object.create(null);
  pages.forEach(page => { owners[page.id]=page.dataset.page;page.querySelectorAll('[id]').forEach(el => { owners[el.id]=page.dataset.page; }); });
  const routeLabels = {home:'首页',catalog:'平台目录',comparison:'平台对比'};
  const routeHeadings = {home:$('home-title'),catalog:$('catalog-title'),comparison:$('comparison-title')};
  let activePage = null;
  function showRoute() {
    const route = routeTarget(location.hash,owners);
    const changed = activePage!==route.page;
    pages.forEach(page => { page.hidden=page.dataset.page!==route.page; });
    document.querySelectorAll('[data-primary-page]').forEach(link => {
      if (link.dataset.primaryPage===route.page) link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
    document.body.dataset.currentPage=route.page;
    document.body.classList.add('chapter-mode');
    document.title=routeLabels[route.page]+'｜数字人文研究工具指南';
    $('route-status').textContent='当前栏目：'+routeLabels[route.page];
    activePage=route.page;
    if (!location.hash || (route.id==='home' && location.hash!=='#home')) {
      const url=new URL(location.href);url.hash='home';window.history.replaceState({},'',url);
    }
    if (changed) {
      window.scrollTo({top:0,behavior:'instant'});
      routeHeadings[route.page].focus({preventScroll:true});
    }
  }
  window.addEventListener('hashchange',showRoute);
  window.addEventListener('popstate',showRoute);
  $('skip-link').addEventListener('click',event => {event.preventDefault();routeHeadings[activePage].focus();});

  $('print-button').addEventListener('click',() => {printAll=false;window.print();});
  $('print-all').addEventListener('click',() => {printAll=true;window.print();});
  window.addEventListener('beforeprint',() => {
    if (activePage!=='catalog' || printState) return;
    printState={nodes:[...grid.childNodes],details:[...grid.querySelectorAll('details')].map(node => [node,node.open])};
    if (printAll) grid.innerHTML=tools.map(toolCard).join('');
    grid.querySelectorAll('details').forEach(node => {node.open=true;});
  });
  window.addEventListener('afterprint',() => {
    if (!printState) return;
    if (printAll) grid.replaceChildren(...printState.nodes);
    printState.details.forEach(([node,open]) => {node.open=open;});
    printState=null;printAll=false;
  });
  applyFilters();showRoute();
})();
