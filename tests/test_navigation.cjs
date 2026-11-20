const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
const utilities=html.match(/\/\/ CHAPTER_UTILITIES_BEGIN([\s\S]*?)\/\/ CHAPTER_UTILITIES_END/);
assert.ok(utilities,'navigation utilities are present');
const ctx={};vm.createContext(ctx);vm.runInContext(utilities[1],ctx);
const result=(x)=>JSON.parse(JSON.stringify(x));
assert.deepEqual(result(ctx.routeTarget('#profile-dedu',{catalog:'catalog',compare:'comparison'})),{id:'compare',page:'comparison'});
assert.deepEqual(result(ctx.routeTarget('#%E0%A4%A',{home:'home',catalog:'catalog'})),{id:'home',page:'home'});
assert.deepEqual(result(ctx.routeTarget('#unknown',{home:'home',catalog:'catalog'})),{id:'home',page:'home'});
assert.deepEqual(result(ctx.routeTarget('#__proto__',{home:'home',catalog:'catalog'})),{id:'home',page:'home'});
assert.deepEqual(result(ctx.pageWindow(115,10,12)),{page:10,pages:10,start:108,end:115});
assert.deepEqual(result(ctx.pageWindow(25,99,6)),{page:5,pages:5,start:24,end:25});
assert.deepEqual(result(ctx.pageWindow(0,3,12)),{page:1,pages:1,start:0,end:0});
assert.deepEqual(result(ctx.pageWindow(25,0,6)),{page:1,pages:5,start:0,end:6});
assert.deepEqual(result(ctx.routeTarget('',{home:'home',catalog:'catalog'})),{id:'home',page:'home'});
console.log('Routing and pagination: 9 assertions passed');

const fixtures=[
  {name:'古籍 OCR',stages:['识别','清洗'],materials:['古籍'],layer:'核心平台',verificationLabel:'已核实'},
  {name:'手稿 OCR',stages:['识别'],materials:['手稿'],layer:'核心平台',verificationLabel:'待核实'},
  {name:'古籍分析',stages:['分析'],materials:['古籍'],layer:'辅助工具与技术底座',verificationLabel:'已核实'}
];
const names=rows=>result(rows.map(row=>row.name));
assert.deepEqual(names(ctx.filterCatalogue(fixtures,'ocr',{})),['古籍 OCR','手稿 OCR']);
assert.deepEqual(names(ctx.filterCatalogue(fixtures,'OCR',{materials:['古籍']})),['古籍 OCR']);
assert.deepEqual(names(ctx.filterCatalogue(fixtures,'',{materials:['古籍','手稿']})),['古籍 OCR','手稿 OCR','古籍分析']);
assert.deepEqual(names(ctx.filterCatalogue(fixtures,'',{materials:['古籍'],stages:['识别'],verificationLabel:['已核实']})),['古籍 OCR']);
assert.deepEqual(names(ctx.filterCatalogue(fixtures,'',{materials:['手稿'],verificationLabel:['已核实']})),[]);
assert.deepEqual(names(ctx.filterCatalogue(fixtures,'OCR',{materials:['古籍']},'materials')),['古籍 OCR','手稿 OCR']);
assert.equal(ctx.filterCatalogue(fixtures,'',{}).length,3);
const actual=JSON.parse(readFileSync(join(__dirname,'../data/catalog.json'),'utf8'));
assert.equal(ctx.filterCatalogue(actual,'OCR',{}).length,22);
assert.ok(ctx.filterCatalogue(actual,'OCR',{materials:['古籍'],stages:['识别']}).every(row=>row.materials.includes('古籍')&&row.stages.includes('识别')));
console.log('Catalogue search and combined facets: 9 assertions passed');

const searchConfig=JSON.parse(readFileSync(join(__dirname,'../data/catalog-search.json'),'utf8'));
const ranked=(q,records=actual)=>result(ctx.rankCatalogue(records,q,searchConfig));
const relationship=ranked('关系图谱');
for(const name of ['Gephi','Palladio','Cytoscape']) assert.ok(relationship.some(hit=>hit.item.name===name),name);
assert.ok(relationship.findIndex(hit=>hit.item.name==='Gephi') < relationship.findIndex(hit=>hit.item.id===18));
assert.ok(relationship.find(hit=>hit.item.id===25)?.kind==='相关功能');
assert.ok(!ranked('关系图谱',[{id:999,name:'纯实体识别',functions:'识别人名和地名'}]).length);
assert.ok(ranked('扫描件转文字').some(hit=>hit.item.name==='TextIn 古籍OCR'));
assert.ok(ranked('日记人物关系').some(hit=>hit.item.name==='Gephi'));
assert.ok(ranked('我想画人物之间的关系').some(hit=>hit.item.name==='Palladio'));
assert.ok(ranked('我想统计日记词频').some(hit=>hit.item.name==='Voyant Tools'));
assert.ok(ranked('地图可视化').some(hit=>hit.item.name==='QGIS'));
assert.ok(ranked('史料管理').some(hit=>hit.item.name==='Tropy'));
assert.equal(ranked('Gephi')[0].item.name,'Gephi');
assert.equal(ranked('ＧＥＰＨＩ')[0].item.name,'Gephi');
assert.equal(ranked('不存在xyz').length,0);
assert.equal(ranked('').length,119);
assert.equal(ranked('关系图谱',[{id:999,name:'关系图谱',functions:''},actual.find(item=>item.name==='Gephi')])[0].item.id,999);
assert.ok(ctx.filterCatalogue(actual,'关系图谱',{materials:['通用文本']},'',searchConfig).every(item=>item.materials.includes('通用文本')));
for(const id of Object.keys(searchConfig.tags)) assert.ok(actual.some(item=>String(item.id)===id),'tag target exists: '+id);
console.log('Synonyms, related-function ranking, natural queries and tag integrity passed');
for(const query of ['关系图谱','扫描件转文字','日记人物关系','词频统计','地图可视化','史料管理']) console.log(query,ranked(query).slice(0,5).map(hit=>hit.item.name+' ['+hit.kind+': '+hit.term+']').join(' / '));

const diaryPlan=result(ctx.analyseSearch('日记',searchConfig));
assert.equal(diaryPlan.materialGuide.label,'日记');
assert.equal(diaryPlan.topics.length,0,'a material alone must not imply a research task');
assert.ok(ranked('日记').every(hit=>hit.kind==='材料提及'));
assert.deepEqual(ranked('日记').map(hit=>hit.item.name),['FromThePage','Zooniverse']);
assert.equal(ctx.analyseSearch('日记 人物关系',searchConfig).materialGuide,null);
const diaryTasks=diaryPlan.materialGuide.tasks;
assert.ok(ranked(diaryTasks.find(task=>task.label==='人物关系分析').query).some(hit=>hit.item.name==='Gephi'));
assert.ok(ranked(diaryTasks.find(task=>task.label==='词频与文本分析').query).some(hit=>hit.item.name==='Voyant Tools'));
assert.ok(ranked(diaryTasks.find(task=>task.label==='识别与转录').query).some(hit=>hit.item.name==='Transkribus'));
assert.ok(ranked(diaryTasks.find(task=>task.label==='组织众包转录').query).some(hit=>hit.item.name==='FromThePage'));
console.log('Material-only guidance and explicit diary task paths passed');

assert.equal(searchConfig.discovery.topics.length,6);
for(const topic of searchConfig.discovery.topics) assert.ok(ranked(topic.query).length>0,'discovery topic returns tools: '+topic.label);
for(const material of searchConfig.discovery.materials) assert.ok(ctx.analyseSearch(material,searchConfig).materialGuide,'material shortcut has a task guide: '+material);
console.log('Discovery topic and material shortcuts resolve successfully');
