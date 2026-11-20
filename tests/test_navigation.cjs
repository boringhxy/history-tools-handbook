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
