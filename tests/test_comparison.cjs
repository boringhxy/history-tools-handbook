const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../comparison/engine.js');
assert.ok(fs.existsSync(file), 'comparison engine must exist');
const C = require(file);
const field = text => ({text, evidence:'资料待补充', sources:[], checkedAt:null});
const data = {dimensions:[{key:'role',label:'平台的主要用途',group:'网站角色'},{key:'input_materials',label:'支持处理的自有材料',group:'处理工具'},{key:'output',label:'处理成果与导出方式',group:'处理工具'}],platforms:[
 {id:'a',name:'识典古籍',aliases:['shidian'],kind:'处理工具',fields:{role:field('古籍阅读'),input_materials:field('图像'),output:field('资料待补充')}},
 {id:'b',name:'DEDU',aliases:['对读'],kind:'处理工具',fields:{role:field('平行文本'),input_materials:field('图像'),output:field('资料待补充')}}]};
assert.equal(C.findPlatforms(data.platforms,'SHIDIAN')[0].id,'a');
assert.equal(C.findPlatforms(data.platforms,'对读')[0].id,'b');
assert.equal(C.findPlatforms(data.platforms,'不存在').length,0);
assert.equal(C.validPair(data.platforms,['a','a']),false);
assert.equal(C.validPair(data.platforms,['a','__proto__']),false);
assert.equal(C.validPair(data.platforms,['a','b']),true);
assert.deepEqual(C.comparisonRows(data,['a','b'],{differences:true}).map(x=>x.key),['role']);
assert.ok(C.comparisonRows(data,['a','b'],{task:'export'}).some(x=>x.key==='output'));
assert.equal(C.safeURL('javascript:alert(1)'),null);
assert.equal(C.safeURL('https://example.org'), 'https://example.org/');
assert.deepEqual(C.selectionFromURL('https://example.org/?ca=b&cb=a#compare',data.platforms),['b','a']);
assert.deepEqual(C.selectionFromURL('https://example.org/?ca=a&cb=a#compare',data.platforms),null);
assert.match(C.report(data,['a','b'],{}),/资料待补充/);
assert.match(C.report(data,['a','b'],{}),/识典古籍/);
console.log('Comparison engine: 14 assertions passed');
const enriched = JSON.parse(JSON.stringify(data));enriched.platforms[0].tasks=Array.from({length:12},(_,i)=>({mode:'平台内完成',note:'专门任务'+i,evidence:'官方说明',sources:[],checkedAt:'2026-10-19'}));
assert.equal(C.comparisonTasks(enriched,['a','b'],{}).length,12);
assert.equal(C.comparisonTasks(enriched,['a','b'],{task:'export'}).length,2);
assert.match(C.report(enriched,['a','b'],{}),/专门任务11/);
const longHistory=Array.from({length:8},(_,i)=>({role:i%2?'assistant':'user',content:'甲'.repeat(i%2?5000:2000)}));
const bounded=C.boundedHistory(longHistory);
assert.ok(bounded.length<=8&&bounded.reduce((n,m)=>n+m.content.length,0)<=12000);
assert.ok(bounded.every(m=>m.content.length<=4000));
assert.equal(longHistory[1].content.length,5000);
console.log('Task evidence and history bounds: 6 assertions passed');

const framed=JSON.parse(JSON.stringify(data));
framed.dimensions.splice(1,0,{key:'resource_types',label:'提供的材料类型',group:'材料资源'});
framed.platforms.forEach(p=>p.fields.resource_types=field('资料待补充'));
assert.deepEqual(C.comparisonRows(framed,['a','b'],{task:'resources'}).map(r=>r.key),['role','resource_types']);
assert.ok(!C.comparisonRows(framed,['a','b'],{task:'processing'}).some(r=>r.key==='resource_types'));
assert.equal(C.comparisonTasks(enriched,['a','b'],{task:'resources'}).length,5);
assert.equal(C.comparisonTasks(enriched,['a','b'],{task:'processing'}).length,9);
assert.match(C.report(framed,['a','b'],{}),/查找与获取材料/);
console.log('Research framework filters and grouped reports: 5 assertions passed');
assert.deepEqual(C.comparisonRows(framed,['a','b'],{task:'resource_types'}).map(r=>r.key),['resource_types']);
assert.deepEqual(C.comparisonRows(framed,['a','b'],{task:'input_materials'}).map(r=>r.key),['input_materials']);
assert.equal(C.comparisonTasks(enriched,['a','b'],{task:'role'}).length,0);
console.log('Individual dimension selection: 3 assertions passed');

// Reading follows research stages, while capability tags preserve uncertainty.
const actual=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/platforms.json'),'utf8'));
const flow=C.workflowDimensions(actual);
assert.equal(flow.length,13);
assert.deepEqual(flow.map(d=>d.key),['role','conditions','resource_types','resource_scope','resource_forms','resource_search','resource_access','input_materials','preparation','tools','workflow','output','evidence']);
assert.equal(new Set(flow.map(d=>d.group)).size,6);
assert.deepEqual(C.capabilityTags(field('资料待补充'),'tools').map(t=>t.label),['功能待核实']);
const mixed={text:'可检索文本；OCR须另配上游工具；协作机制尚未核实。',evidence:'官方资料整理',sources:[]};
assert.deepEqual(C.capabilityTags(mixed,'tools').map(t=>t.label),['OCR需另配','文本检索']);
assert.deepEqual(C.capabilityTags({text:'准备UTF-8文本。',evidence:'研究方法建议'},'preparation').map(t=>t.label),['准备UTF-8文本']);
assert.deepEqual(C.capabilityTags({text:'词频与共现分析',evidence:'目录资料'},'tools').map(t=>t.label),['词频统计','共现分析']);
assert.deepEqual(C.readingParts('第一项。第二项；\n第三项。'),['第一项。','第二项；','第三项。']);

assert.deepEqual(C.capabilityTags({text:'建议另行准备CSV给网络工具。',evidence:'研究方法建议'},'evidence').map(t=>t.label),['人工核查']);
assert.deepEqual(C.readingParts('流程建议：\n1. 导出；保存。\n2. 检查。','workflow'),['流程建议：','1. 导出；保存。','2. 检查。']);

assert.deepEqual(C.capabilityTags({text:'支持OCR；支持批量导出CSV。',evidence:'官方说明'},'tools').map(t=>t.label),['含OCR','支持批量导出']);
assert.deepEqual(C.capabilityTags({text:'批量导出格式尚未确认。',evidence:'官方说明'},'output').map(t=>t.label),['批量导出待核实']);
assert.ok(!C.capabilityTags({text:'数据库可导出CSV。',evidence:'官方说明'},'output').some(t=>t.label==='支持批量导出'));
assert.deepEqual(C.capabilityTags({text:'未确认有OCR功能。',evidence:'官方说明'},'tools').map(t=>t.label),['OCR待核实']);

assert.deepEqual(C.capabilityTags({text:'不直接等同于已验证跨语种检索。',evidence:'官方说明'},'tools').map(t=>t.label),['跨语种检索待核实']);
assert.deepEqual(C.capabilityTags({text:'原始图片不应直接等同于可分析语料。',evidence:'官方说明'},'input_materials').map(t=>t.label),['图像材料待核实']);
console.log('Research workflow and concrete feature tags: 16 assertions passed');
