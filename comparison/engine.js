/* Shared deterministic comparison logic. No network and no generated facts. */
(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const taskKeys = {
    discovery: ['position','materials','capabilities','conditions','limits','sources'],
    ocr: ['materials','input','capabilities','review','output','limits','sources'],
    annotation: ['input','capabilities','review','output','limits','sources'],
    compare: ['materials','input','capabilities','review','output','limits','sources'],
    database: ['input','capabilities','conditions','output','collaboration','limits','sources'],
    analysis: ['materials','input','capabilities','review','output','limits','sources'],
    export: ['conditions','output','collaboration','limits','sources']
  };
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
    return data.dimensions.filter(d => !taskKeys[options.task] || taskKeys[options.task].includes(d.key)).map(d => ({
      ...d, cells: selected.map(p => p.fields[d.key] || {text:'资料待补充',evidence:'资料待补充',checkedAt:null,sources:[]})
    })).filter(row => !options.differences || normalize(row.cells[0].text) !== normalize(row.cells[1].text));
  }
  const taskLabels = ['资源发现','自有材料输入','OCR与校订','全文／字段检索','语义／跨语种检索','原页回溯','多文本对读','自定义抽取与标注','个人建库','统计与可视化','协作复核','导出与备份'];
  const taskIndexes = {discovery:[0,3,4,5],ocr:[1,2,5],annotation:[7,10],compare:[6],database:[8,3],analysis:[9],export:[10,11]};
  function comparisonTasks(data, pair, options = {}) {
    if (!validPair(data.platforms, pair)) return [];
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
    for (const row of [...comparisonRows(data, pair, options), ...comparisonTasks(data, pair, options)]) {
      lines.push(`\n【${row.label}】`);
      row.cells.forEach((cell, i) => {
        lines.push(`${selected[i].name}：${cell.text}`, `证据：${cell.evidence}；核对日期：${cell.checkedAt || '未记录'}`);
        (cell.sources || []).forEach(s => { if (safeURL(s.url)) lines.push(`${s.label}：${s.url}`); });
      });
    }
    return lines.join('\n');
  }
  const api = {findPlatforms, validPair, comparisonRows, comparisonTasks, boundedHistory, safeURL, selectionFromURL, report};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CompareCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
