(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tools = JSON.parse($('tool-catalog-data').textContent);
  const searchConfig = JSON.parse($('catalog-search-data').textContent);
  let searchMatches = new Map();
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
    const match = searchMatches.get(item.id);
    const explanation = match?.kind ? `<p class="tool-match"><span>${escapeHTML(match.kind)}</span>${match.kind==='材料提及'?'使用场景或说明中提及':'通过'}“${escapeHTML(match.term)}”${match.kind==='材料提及'?'':'找到'}</p>` : '';
    return `<article class="tool-card">
      <span class="tool-id">NO. ${String(item.id).padStart(3,'0')}</span>
      <h3>${escapeHTML(item.name)}</h3><span class="tool-layer">${escapeHTML(item.layer)}</span>
      <p>${escapeHTML(item.functions)}</p>
      ${explanation}
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
  function searchClean(value) {
    return String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g,' ').trim();
  }
  function analyseSearch(query,config={}) {
    const needle=searchClean(query).slice(0,200);
    const topics=(config.topics || []).filter(topic => topic.aliases.some(alias=>needle.includes(searchClean(alias))) || (topic.patterns || []).some(pattern=>new RegExp(pattern,'i').test(needle)));
    return {needle,topics,contexts:(config.contexts || []).filter(term=>needle.includes(searchClean(term))),materialGuide:(config.materialGuides || []).find(guide=>guide.aliases.some(alias=>searchClean(alias)===needle)) || null};
  }
  function rankCatalogue(records,query,config={}) {
    const plan=analyseSearch(query,config);
    const ranked=[];
    records.forEach((item,index)=>{
      const name=searchClean(item.name);
      const functions=searchClean(item.functions);
      const tags=(item.searchTags || config.tags?.[String(item.id)] || []).map(searchClean);
      const primary=searchClean([item.name,item.functions,item.sourceCategory,...tags].join(' '));
      const text=searchClean([item.name,item.functions,item.scenarios,item.developer,item.language,item.sourceCategory,item.notes,item.layer,...(item.stages || []),...(item.materials || [])].join(' '));
      const needle=plan.needle;
      let score=0,kind='',term='';
      if (!needle) { ranked.push({item,score:0,kind:'',term:'',index});return; }
      if (name===needle) {score=1000;kind='名称命中';term=query;}
      else if (name.includes(needle)) {score=900;kind='名称命中';term=query;}
      else if (functions.includes(needle)) {score=800;kind='功能命中';term=query;}
      else if (tags.some(tag=>tag===needle)) {score=700;kind='标签匹配';term=query;}
      else if (text.includes(needle)) {score=600;kind=plan.materialGuide?'材料提及':'关键词命中';term=query;}
      if (!score && plan.topics.length) {
        // Near synonyms use capability fields; incidental mentions stay related.
        const hits=plan.topics.map(topic=>{
          const direct=topic.terms.find(candidate=>{
            const clean=searchClean(candidate);
            return primary.includes(clean) && !(primary.includes(clean+'前处理') && !functions.includes(clean));
          });
          if (direct) return {score:500,kind:topic.aliases.some(alias=>searchClean(alias)===needle)?'同义关联':'任务关联',term:direct};
          const related=(topic.related || []).find(candidate=>primary.includes(searchClean(candidate)));
          if (related) return {score:200,kind:'相关功能',term:related};
          const mention=topic.terms.find(candidate=>text.includes(searchClean(candidate)));
          return mention?{score:150,kind:'相关提及',term:mention}:null;
        });
        if (hits.every(Boolean)) {
          const weakest=hits.reduce((a,b)=>a.score<b.score?a:b);
          ({score,kind,term}=weakest);
        }
      }
      // Plain multi-keyword requests use AND rather than unrelated single words.
      if (!score && !plan.topics.length) {
        const words=needle.split(/[\s，,、；;]+/).filter(Boolean);
        if (words.length>1 && words.every(word=>text.includes(word)||tags.some(tag=>tag.includes(word)))) {score=400;kind='组合匹配';term=words.join('、');}
      }
      if (score) {
        score+=plan.contexts.filter(context=>text.includes(searchClean(context))).length*10;
        ranked.push({item,score,kind,term,index});
      }
    });
    return ranked.sort((a,b)=>b.score-a.score||a.index-b.index);
  }
  function filterCatalogue(records,query,selections={},omitKey='',config={}) {
    return rankCatalogue(records,query,config).map(hit=>hit.item).filter(item=>Object.entries(selections).every(([key,values])=>!values.length||key===omitKey||values.some(value=>Array.isArray(item[key])?item[key].includes(value):item[key]===value)));
  }
  // CHAPTER_UTILITIES_END

  function renderFacets() {
    const focused = document.activeElement?.id;
    $('catalog-facet-groups').innerHTML = facetGroups.map(group => {
      const candidates = filterCatalogue(tools,submittedQuery,selections,group.key,searchConfig);
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
  function renderDiscovery() {
    const discovery=searchConfig.discovery;
    const panel=$('catalog-discovery');
    panel.innerHTML=`<h3>${escapeHTML(discovery.title)}</h3><p class="catalog-discovery-lead">${escapeHTML(discovery.description)}</p><div class="catalog-topic-grid">${discovery.topics.map(topic=>`<button type="button" data-discovery-query="${escapeHTML(topic.query)}"><strong>${escapeHTML(topic.label)}</strong><span>${escapeHTML(topic.description)}</span></button>`).join('')}</div><div class="catalog-material-shortcuts"><span>从材料开始</span><div>${discovery.materials.map(material=>`<button type="button" data-discovery-query="${escapeHTML(material)}">${escapeHTML(material)}</button>`).join('')}</div></div>`;
  }
  function showMaterialGuide(plan) {
    const panel=$('catalog-task-guide');
    const guide=plan.materialGuide;
    panel.hidden=!guide;
    if (!guide) {panel.replaceChildren();return;}
    panel.innerHTML=`<h3>你想用${escapeHTML(guide.label)}做什么？</h3><p>先选择研究任务，再按功能查找工具。</p><div class="catalog-task-options">${guide.tasks.map(task=>`<button type="button" data-task-query="${escapeHTML(task.query)}">${escapeHTML(task.label)}</button>`).join('')}</div><p class="catalog-task-note">下方原始命中仅表示说明中提及这类材料，不代表平台提供其原文或覆盖全部研究环节。</p>`;
  }
  function applyFilters() {
    const plan=analyseSearch(submittedQuery,searchConfig);
    showMaterialGuide(plan);
    const visible = expanded || Boolean(submittedQuery);
    $('catalog-discovery').hidden=visible;
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
    const ranked=rankCatalogue(tools,submittedQuery,searchConfig);
    searchMatches=new Map(ranked.map(hit=>[hit.item.id,hit]));
    matches = filterCatalogue(tools,submittedQuery,selections,'',searchConfig);
    const help=$('catalog-search-explanation');
    help.hidden=!submittedQuery;
    help.textContent=plan.materialGuide ? '介绍中直接提及“'+plan.materialGuide.label+'”的条目（不是该材料的完整工具清单）。' : plan.topics.length ? '已关联：'+plan.topics.map(topic=>topic.label).join('、')+'。名称与功能命中优先，相关功能排在后面；可在卡片查看匹配依据。' : '按名称、功能和资料文字检索；多个关键词可用空格分开。';
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
  $('catalog-discovery').addEventListener('click',event=>{
    const button=event.target.closest('button[data-discovery-query]');
    if (!button) return;
    searchInput.value=button.dataset.discoveryQuery;
    submittedQuery=normalize(searchInput.value);
    expanded=false;resetSelections();applyFilters();
    searchInput.focus({preventScroll:true});
  });
  $('catalog-task-guide').addEventListener('click',event=>{
    const button=event.target.closest('button[data-task-query]');
    if (!button) return;
    searchInput.value=button.dataset.taskQuery;
    submittedQuery=normalize(searchInput.value);
    expanded=false;resetSelections();applyFilters();
    searchInput.focus({preventScroll:true});
  });
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
  renderDiscovery();applyFilters();showRoute();
})();
