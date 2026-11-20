(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tools = JSON.parse($('tool-catalog-data').textContent);
  const grid = $('catalog-grid');
  const searchInput = $('search-input');
  let expanded = false;
  let submittedQuery = '';
  const selections = {stages:[],materials:[],layer:[],verificationLabel:[]};
  const facetGroups = [
    {key:'stages',label:'研究环节',values:['采集','识别','清洗','标注','建库','分析','出版','保存']},
    {key:'materials',label:'材料类型',values:['古籍','手稿','近现代文献','档案照片','地图','通用文本','音视频','网页','口述史']},
    {key:'layer',label:'平台层级',values:['核心平台','文史哲专业扩展平台','史料数据库与检索资源','辅助工具与技术底座','专题智能体与实验性项目','待核实或访问受限']},
    {key:'verificationLabel',label:'核实状态',values:['已核实','部分核实','待核实']}
  ];
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
  function filterCatalogue(records, query, selections = {}, omitKey = '') {
    const clean = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g,' ').trim();
    const needle = clean(query);
    return records.filter(item => {
      const text = clean([item.name,item.functions,item.scenarios,item.developer,item.language,item.sourceCategory,item.notes,item.layer,...(item.stages || []),...(item.materials || [])].join(' '));
      if (needle && !text.includes(needle)) return false;
      return Object.entries(selections).every(([key,values]) => !values.length || key===omitKey || values.some(value => Array.isArray(item[key]) ? item[key].includes(value) : item[key]===value));
    });
  }
  // CHAPTER_UTILITIES_END

  function renderFacets() {
    const focused = document.activeElement?.id;
    $('catalog-facet-groups').innerHTML = facetGroups.map(group => {
      const candidates = filterCatalogue(tools,submittedQuery,selections,group.key);
      return `<fieldset class="catalog-facet-group"><legend>${group.label}</legend>${group.values.map((value,index) => {
        const checked = selections[group.key].includes(value);
        const count = candidates.filter(item => Array.isArray(item[group.key]) ? item[group.key].includes(value) : item[group.key]===value).length;
        return `<label class="catalog-facet-option"><input type="checkbox" id="facet-${group.key}-${index}" data-facet="${group.key}" value="${escapeHTML(value)}"${checked?' checked':''}${!count&&!checked?' disabled':''}><span>${escapeHTML(value)}</span><small aria-label="${count} 项">${count}</small></label>`;
      }).join('')}</fieldset>`;
    }).join('');
    const selectedCount=Object.values(selections).reduce((sum,values)=>sum+values.length,0);
    $('catalog-reset-facets').disabled=!selectedCount;
    $('catalog-filter-summary').textContent=selectedCount?`已选 ${selectedCount} 项`:'全部条件';
    if (focused?.startsWith('facet-')) $(focused)?.focus({preventScroll:true});
  }
  function showPage() {
    grid.querySelectorAll('.tool-card').forEach(card => {card.hidden=false;});
    pager.hidden=true;
  }
  function applyFilters() {
    const visible = expanded || Boolean(submittedQuery);
    $('catalog-workspace').hidden=!visible;
    grid.hidden = !visible;
    $('catalog-result-count').hidden = !visible;
    $('catalog-print-tools').hidden = !visible;
    $('clear-filters').setAttribute('aria-expanded', String(expanded));
    $('clear-filters').textContent = expanded ? '收起全部' : '展开全部';
    if (!visible) {
      matches=[];
      $('catalog-count').textContent=0;
      grid.replaceChildren();
      pager.hidden=true;
      return;
    }
    matches = filterCatalogue(tools,submittedQuery,selections);
    pageNumber = 1;
    $('catalog-count').textContent = matches.length;
    grid.innerHTML = matches.length ? matches.map(toolCard).join('') : '<div class="empty-state"><strong>没有匹配条目</strong><br>请减少筛选条件、换一个关键词，或点击“展开全部”浏览目录。</div>';
    showPage();
    renderFacets();
  }
  function resetSelections() { Object.keys(selections).forEach(key=>{selections[key]=[];}); }
  $('catalog-filters').addEventListener('submit',event => { event.preventDefault();submittedQuery=normalize(searchInput.value);expanded=false;applyFilters(); });
  $('clear-filters').addEventListener('click',() => { searchInput.value='';submittedQuery='';resetSelections();expanded=!expanded;applyFilters(); });
  $('catalog-facet-groups').addEventListener('change',event=>{
    const input=event.target;
    if (!Object.hasOwn(selections,input.dataset.facet)) return;
    const values=selections[input.dataset.facet];
    selections[input.dataset.facet]=input.checked?[...new Set([...values,input.value])]:values.filter(value=>value!==input.value);
    applyFilters();
  });
  $('catalog-reset-facets').addEventListener('click',()=>{resetSelections();applyFilters();});
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
