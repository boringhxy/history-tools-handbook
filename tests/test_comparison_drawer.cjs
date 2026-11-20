/* Exercise the drawer's event wiring without connecting to a model service. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Control extends EventTarget {
  focus() { this.focused=true; }
  click() { this.dispatchEvent(new Event('click')); }
}
const drawer=new Control(),close=new Control(),triggers=[new Control(),new Control()];
drawer.open=false;
drawer.showModal=function(){this.open=true;};
drawer.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
drawer.getBoundingClientRect=()=>({left:500,right:980,top:0,bottom:800});
const classes=new Set();
const body={dataset:{currentPage:'comparison'},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}};
const window=new EventTarget(),location={hash:'#compare'};
const source=fs.readFileSync(require('node:path').join(__dirname,'../comparison/ui.js'),'utf8');
const start=source.indexOf("  const aiDrawer=$('cmp-chat-panel');");
const end=source.indexOf('  function jump(key)',start);
assert.ok(start>0 && end>start);
vm.runInNewContext(source.slice(start,end),{$:id=>id==='cmp-chat-panel'?drawer:close,root:{querySelectorAll:()=>triggers},document:{body},window,location});
assert.equal(drawer.open,false);
triggers[0].click();assert.equal(drawer.open,true);assert.ok(classes.has('cmp-ai-open'));
const inside=new Event('click');Object.assign(inside,{clientX:600,clientY:400});drawer.dispatchEvent(inside);assert.equal(drawer.open,true);
close.click();assert.equal(drawer.open,false);assert.equal(classes.size,0);assert.ok(triggers[0].focused);
triggers[1].click();const outside=new Event('click');Object.assign(outside,{clientX:100,clientY:400});drawer.dispatchEvent(outside);
assert.equal(drawer.open,false);assert.ok(triggers[1].focused);
triggers[0].click();location.hash='#catalog';body.dataset.currentPage='catalog';window.dispatchEvent(new Event('hashchange'));
assert.equal(drawer.open,false);assert.equal(classes.size,0);
console.log('AI drawer: both entrances, close button, backdrop and navigation cleanup passed');
