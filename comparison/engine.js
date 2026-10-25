/* Shared deterministic comparison logic. No network and no generated facts. */
(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const commonKeys = ['role','conditions','evidence'];
  const resourceKeys = ['resource_types','resource_scope','resource_forms','resource_search','resource_access'];
  const processingKeys = ['input_materials','tools','preparation','workflow','output'];
  const taskKeys = {
    resources: [...commonKeys,...resourceKeys],
    processing: [...commonKeys,...processingKeys],
    discovery: [...commonKeys,...resourceKeys],
    ocr: [...commonKeys,...processingKeys],
    annotation: [...commonKeys,...processingKeys],
    compare: [...commonKeys,...processingKeys],
    database: [...commonKeys,...processingKeys],
    analysis: [...commonKeys,...processingKeys],
    export: [...commonKeys,'resource_access','output']
  };
  const workflowStages = [
    ['01 确认用途与条件',['role','conditions']],
    ['02 查找与获取材料',resourceKeys],
    ['03 准备自有材料',['input_materials','preparation']],
    ['04 处理与分析材料',['tools','workflow']],
    ['05 导出与保存成果',['output']],
    ['06 核查依据与限制',['evidence']]
  ];
  function workflowDimensions(data) {
    return workflowStages.flatMap(([group,keys])=>keys.flatMap(key=>{
      const dimension=data.dimensions.find(d=>d.key===key);
      return dimension ? [{...dimension,group}] : [];
    }));
  }
  function capabilityTags(field,key) {
    const text=String(field.text || ''),evidence=String(field.evidence || '');
    const badge=label=>({label,kind:'feature'});
    if(!text || evidence==='资料待补充' || text==='资料待补充' || /专门资料待补充/.test(text))return [badge('功能待核实')];
    if(key==='evidence')return [badge('人工核查'),...(/出处|卷页|来源/.test(text)?[badge('核对出处')]:[])];
    // Match only explicit terms in the relevant dimension. A format alone never
    // establishes batch export, and negative/uncertain clauses never imply support.
    const features=[
      ['OCR',/\bOCR\b|光学字符识别|文字识别/,'含OCR','tools'],
      ['批量导出',/批量.{0,8}导出|导出.{0,8}批量/,'支持批量导出','tools output'],
      ['批量下载',/批量.{0,8}下载|下载.{0,8}批量/,'支持批量下载','resource_access output'],
      ['CSV导出',/\bCSV\b/i,'导出CSV','output'],
      ['JSON导出',/\bJSONL?\b/i,'导出JSON','output'],
      ['Excel导出',/\bExcel\b|\bXLSX?\b/i,'导出Excel','output'],
      ['DocuXML',/DocuXML/i,'保存DocuXML','output'],
      ['文本检索',/文本检索|检索文本|全文检索|全文查询|文献集检索|检索查询/,'文本检索','tools resource_search'],
      ['字段检索',/字段.{0,4}(检索|查询)|(检索|查询).{0,4}字段/,'字段检索','tools resource_search'],
      ['语义检索',/语义.{0,4}(检索|搜索)/,'语义检索','tools resource_search'],
      ['跨语种检索',/跨语种.{0,4}(检索|搜索)/,'跨语种检索','tools resource_search'],
      ['图文对照',/图文对照|原页回溯/,'图文对照','tools resource_search'],
      ['自动标点',/自动标点|断句标点/,'自动标点','tools'],
      ['文本比对',/文本比对|文本比较|版本对读|文字对勘|多文本对读|校勘/,'文本比对','tools'],
      ['信息抽取',/信息抽取|抽取信息|实体识别|关系抽取/,'信息抽取','tools'],
      ['文本标注',/标注|标记|实体校对/,'文本标注','tools'],
      ['自定义字段',/自定义字段|字段.{0,8}(定义|配置)|定义字段/,'自定义字段','tools'],
      ['知识图谱',/知识图谱/,'知识图谱','tools'],
      ['专题建库',/建库|构建个人数据库|专题数据库|个人数据库/,'专题建库','tools'],
      ['词频统计',/词频/,'词频统计','tools'],
      ['共现分析',/共现/,'共现分析','tools'],
      ['地图分析',/GIS|地图分析|空间分析/,'地图分析','tools'],
      ['网络分析',/网络分析/,'网络分析','tools'],
      ['图表展示',/图表|可视化/,'图表展示','tools'],
      ['团队协作',/团队协作|多人.{0,6}(协作|编辑)|成员协作/,'团队协作','tools'],
      ['文本材料',/文本/,'文本材料','input_materials resource_types'],
      ['图像材料',/图像|图片|扫描件|影像/,'图像材料','input_materials resource_types resource_forms'],
      ['元数据',/元数据/,'元数据','input_materials resource_forms'],
      ['DocuXML',/DocuXML/i,'DocuXML输入','input_materials'],
      ['古籍材料',/古籍|汉籍|四库/,'古籍材料','resource_types resource_scope'],
      ['书目资料',/书目|目录/,'书目资料','resource_types resource_forms'],
      ['公开实例',/公开研究实例|公开对读项目|共享项目/,'公开实例','resource_types resource_scope'],
      ['需账号',/需要账号|需账号|需注册|申请账号/,'需账号','conditions'],
      ['云端使用',/云端|在线|网页/,'云端使用','conditions'],
      ['本地运行',/本地|离线/,'本地运行','conditions'],
      ['命令行操作',/命令行/,'命令行操作','conditions'],
      ['付费使用',/付费|收费/,'付费使用','conditions'],
      ['免费使用',/免费/,'免费使用','conditions'],
      ['准备UTF-8文本',/UTF-8/i,'准备UTF-8文本','preparation'],
      ['准备字段',/字段/,'准备字段','preparation'],
      ['记录出处',/出处|来源/,'记录出处','preparation'],
      ['转换DocuXML',/DocuXML/i,'转换DocuXML','preparation'],
      ['处理材料',/处理工具|处理材料|数据组织|信息抽取/,'处理材料','role'],
      ['提供资源',/材料资源|资源库|文库|公开.*(实例|阅读)|数据社区共享/,'提供资源','role'],
    ];
    if(key==='workflow')return [badge('建议流程'),...(/人工|复核|核查/.test(text)?[badge('含人工复核')]:[])];
    const clauses=text.split(/[。；\n]+/),tags=[];
    for(const [name,pattern,label,keys] of features){
      if(!keys.split(' ').includes(key) && !String(key).startsWith('task-'))continue;
      const matches=clauses.filter(clause=>pattern.test(clause));
      if(!matches.length)continue;
      const uncertain=clause=>/待核|待确认|未确认|尚未|另核|未.{0,5}实测|未验证|不足以|不承诺|不支持|不提供|不.{0,4}(等同|等于|证明|代表|据此)|不将|另配|另用/.test(clause);
      let result;
      if(matches.some(clause=>!uncertain(clause)))result=label;
      else if(matches.some(clause=>/另配|另用/.test(clause)))result=name+'需另配';
      else result=name+'待核实';
      if(!tags.some(tag=>tag.label===result))tags.push(badge(result));
    }
    const fallback={resource_access:'获取权限见说明',resource_scope:'覆盖范围见说明',resource_forms:'材料形式见说明',preparation:'按要求准备材料',output:'导出方式见说明',conditions:'使用条件见说明',role:'用途见说明',resource_types:'材料类型见说明',resource_search:'检索方式待核实',input_materials:'输入要求见说明',tools:'具体功能待核实'};
    return tags.length?tags.sort((a,b)=>Number(a.label.endsWith('待核实'))-Number(b.label.endsWith('待核实'))).slice(0,8):[badge(fallback[key] || '具体功能见说明')];
  }
  function readingParts(text,key) {
    if(key==='workflow')return String(text || '').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    return String(text || '').split(/(?<=[。；])\s*|\n+/).map(s=>s.trim()).filter(Boolean);
  }
  function findPlatforms(platforms, query) {
    const q = normalize(query);
    return platforms.filter(p => !q || normalize([p.name, ...(p.aliases || [])].join(' ')).includes(q));
  }
  function validPair(platforms, pair) {
    return Array.isArray(pair) && pair.length === 2 && pair[0] !== pair[1] && pair.every(id => platforms.some(p => p.id === id));
  }
  function comparisonRows(data, pair, options = {}) {
    if (!validPair(data.platforms, pair)) return [];
    const selected = pair.map(id => data.platforms.find(p => p.id === id));
    const dimension=data.dimensions.find(d=>d.key===options.task);
    return workflowDimensions(data).filter(d => dimension ? d.key===dimension.key : !taskKeys[options.task] || taskKeys[options.task].includes(d.key)).map(d => ({
      ...d, cells: selected.map(p => p.fields[d.key] || {text:'资料待补充',evidence:'资料待补充',checkedAt:null,sources:[]})
    })).filter(row => !options.differences || normalize(row.cells[0].text) !== normalize(row.cells[1].text));
  }
  const taskLabels = ['资源发现','自有材料输入','OCR与校订','全文／字段检索','语义／跨语种检索','原页回溯','多文本对读','自定义抽取与标注','个人建库','统计与可视化','协作复核','导出与备份'];
  const taskIndexes = {resources:[0,3,4,5,11],processing:[1,2,6,7,8,9,10,11,3],discovery:[0,3,4,5],ocr:[1,2,5],annotation:[7,10],compare:[6],database:[8,3],analysis:[9],export:[10,11]};
  function comparisonTasks(data, pair, options = {}) {
    if (!validPair(data.platforms, pair)) return [];
    if (data.dimensions.some(d=>d.key===options.task)) return [];
    const selected = pair.map(id => data.platforms.find(p => p.id === id));
    if (!selected.some(p => p.tasks?.length)) return [];
    return (taskIndexes[options.task] || taskLabels.map((_, i) => i)).map(index => ({
      key:'task-'+index, label:taskLabels[index], cells:selected.map(p => {
        const t=p.tasks?.[index];
        return t ? {text:t.mode+'：'+t.note,evidence:t.evidence,checkedAt:t.checkedAt,sources:t.sources} : {text:'此任务的专门资料待补充，不能据此判断不支持。',evidence:'资料待补充',checkedAt:null,sources:[]};
      })
    })).filter(row => !options.differences || normalize(row.cells[0].text) !== normalize(row.cells[1].text));
  }
  function boundedHistory(history) {
    const items=history.slice(-8).map(m => ({role:m.role,content:String(m.content).slice(0,4000)}));
    while(items.reduce((sum,m)=>sum+m.content.length,0)>12000) items.splice(0,2);
    return items;
  }
  function safeURL(value) {
    try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch (_) { return null; }
  }
  function selectionFromURL(value, platforms) {
    const u = new URL(value);
    const pair = [u.searchParams.get('ca'), u.searchParams.get('cb')];
    return validPair(platforms, pair) ? pair : null;
  }
  function report(data, pair, options = {}) {
    if (!validPair(data.platforms, pair)) return '';
    const selected = pair.map(id => data.platforms.find(p => p.id === id));
    const lines = [`平台对比：${selected[0].name} × ${selected[1].name}`, `资料版本：${data.version || ''}；整理日期：${data.updated || '未记录'}`, '功能覆盖不表示性能排名；资料缺失不等于不支持。'];
    let group = '';
    for (const row of [...comparisonRows(data, pair, options), ...comparisonTasks(data, pair, options)]) {
      if(row.group && row.group !== group){group=row.group;lines.push(`\n━━ ${group} ━━`);}
      if(!row.group && group !== '任务细比'){group='任务细比';lines.push('\n━━ 任务细比 ━━');}
      lines.push(`\n【${row.label}】`);
      row.cells.forEach((cell, i) => {
        lines.push(`能力标签：${capabilityTags(cell,row.key).map(t=>t.label).join('、')}`, `${selected[i].name}：${cell.text}`, `证据：${cell.evidence}；核对日期：${cell.checkedAt || '未记录'}`);
        (cell.sources || []).forEach(s => { if (safeURL(s.url)) lines.push(`${s.label}：${s.url}`); });
      });
    }
    return lines.join('\n');
  }
  const api = {workflowDimensions, capabilityTags, readingParts, findPlatforms, validPair, comparisonRows, comparisonTasks, boundedHistory, safeURL, selectionFromURL, report};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CompareCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
