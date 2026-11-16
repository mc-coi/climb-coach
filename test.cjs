const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
for (const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
const core = html.match(/<script id="scoring-core">([\s\S]*?)<\/script>/)[1];
vm.runInThisContext(core);
let tests = 0;
function test(name, fn) { fn(); console.log('PASS ' + name); tests++; }
const g = DEFAULT_GRADES;
const climbs = grades => grades.map((grade, i) => ({ id: String(i), grade }));
test('mixed rope and bouldering use point values, not text order', () => {
  assert.deepEqual(bestThree(climbs(['5.9','V3','5.12','V0']),g).map(c=>c.grade),['5.12','V3','5.9']);
});
test('ties preserve order and distinct same-grade climbs count', () => {
  assert.deepEqual(bestThree(climbs(['5.10','V2','V2','5.10']),g).map(c=>c.id),['0','1','2']);
});
test('absent climbers retain history but score zero', () => {
  const p={present:false,climbs:climbs(['V3','V2','5.9','V0'])};
  assert.equal(points(p,g),0);p.present=true;assert.equal(points(p,g),300);
});
test('removing a counting climb promotes the next best climb', () => {
  const c=climbs(['V1','V4','5.12','V2']);c.splice(2,1);
  assert.deepEqual(bestThree(c,g).map(x=>x.grade),['V4','V2','V1']);
});
test('empty and None normalize to empty input slots', () => {
  assert.deepEqual(sheetState([true,'Alex','Boy','None',0,'',0]),{name:'Alex',category:'Boy',present:true,grades:['','','']});
});
test('loading unsorted grades is not a pending change', () => {
  const p={name:'Alex',category:'Boy',present:true,climbs:climbs(['V1','V4','V2']),baseline:{name:'Alex',category:'Boy',present:true,grades:['V1','V4','V2']}};
  assert.equal(dirty(p,g),false);p.present=false;assert.equal(dirty(p,g),true);
});
test('lower climbs do not cause unnecessary sheet changes', () => {
  const p={name:'Alex',present:true,climbs:climbs(['V1','V4','V2','V0']),baseline:{name:'Alex',category:'',present:true,grades:['V1','V4','V2']}};
  assert.equal(dirty(p,g),false);p.climbs.push({id:'new',grade:'V7'});assert.equal(dirty(p,g),true);
});
test('writes target only attendance and three input cells', () => {
  const p={name:'Alex',present:true,row:7,climbs:climbs(['V2'])};
  assert.deepEqual(writeRanges(p,g,"Coach's Meet"),[
    {range:"'Coach''s Meet'!A7",values:[[true]]},
    {range:"'Coach''s Meet'!D7",values:[['V2']]},
    {range:"'Coach''s Meet'!F7",values:[['None']]},
    {range:"'Coach''s Meet'!H7",values:[['None']]}
  ]);
});
test('changed names, categories, attendance and grades conflict', () => {
  const baseline=sheetState([true,'Alex','Boy','V1',90,'V2',100,'V3']);
  for(const [i,v] of [[0,false],[1,'Jordan'],[2,'Girl'],[3,'V4']]){
    const row=[true,'Alex','Boy','V1',90,'V2',100,'V3'];row[i]=v;
    assert.equal(sameState(baseline,sheetState(row)),false);
  }
});
test('custom table drives score and invalid tables fail', () => {
  const custom=readGradeTable([['None',0],['V1',17],['5.9',25]]);
  assert.equal(points({present:true,climbs:climbs(['V1','5.9'])},custom),42);
  assert.throws(()=>readGradeTable([['V1','ninety']]));assert.throws(()=>readGradeTable([]));
});
test('CSV neutralizes formula-like names and quotes safely', () => {
  assert.equal(safeCsv('=1+1'),'"\'=1+1"');assert.equal(safeCsv('Sam "A"'),'"Sam ""A"""');
});
test('backup validation rejects unknown grades and invalid scores', () => {
  const base={version:1,meet:{name:'Test',grades:g,people:[{name:'Alex',present:true,climbs:climbs(['V2'])}]}};
  assert.equal(validBackup(base).name,'Test');
  assert.throws(()=>validBackup({...base,meet:{...base.meet,grades:{V2:-5}}}));
  assert.throws(()=>validBackup({...base,meet:{...base.meet,people:[{name:'Alex',present:true,climbs:climbs(['V99'])}]}}));
});
test('formatted rope grade 5.10 retains its meaning', () => {
  const grades=readGradeTable([['5.10','100'],['V2','100']]);
  assert.equal(grades['5.10'],100);
  assert.deepEqual(sheetState(['TRUE','Alex','','5.10']).grades,['5.10','','']);
});

// Exercise the actual sync orchestration with a simulated Sheets service.
// This validates failure behavior without credentials or any live writes.
const syncSource=html.slice(html.indexOf('  async function syncScores()'),html.indexOf('\n  render();if(storageError)'));
async function syncScenario(kind){
  const p={name:'Alex',category:'Boy',row:2,present:true,climbs:climbs(['V2','V4']),baseline:{name:'Alex',category:'Boy',present:true,grades:['V2','','']}};
  const m={connection:{id:'test-sheet',title:'Meet'},grades:g,people:[p]};
  if(kind==='attendance-only'){
    p.climbs=[];
    p.baseline={name:'Alex',category:'Boy',present:false,grades:['','','']};
  }
  const before=JSON.stringify(p.baseline),writes=[],messages=[];
  const context={token:'test-token',tokenExpiry:Date.now()+60000,busy:false,meet:()=>m,
    $:()=>({disabled:false}),confirmAction:async()=>true,renderCard(){},renderRoster(){},renderRosterSync(){},render(){},persist(){},
    notify:(message,error)=>messages.push({message,error}),
    api:async(id,path,options)=>{writes.push(JSON.parse(options.body));if(kind==='denied')throw Error('Google denied access.');return{}},
    readRanges:async(id,ranges,format)=>{
      if(format==='FORMULA')return ranges.map((r,i)=>kind==='formula'&&i===0?[['=TRUE']]:[[true]]);
      if(ranges.length===2){const row=kind==='attendance-only'?[false,'Alex','Boy','None',0,'None',0,'None']:[true,kind==='conflict'?'Someone else':'Alex','Boy','V2',100,'',0,''];return [[[],row],Object.entries(g)];}
      if(kind==='readback-failed')throw Error('Network connection lost.');
      return kind==='attendance-only'?[[[true,'Alex','Boy','None',0,'None',0,'None']]]:[[[true,'Alex','Boy','V4',120,'V2',100,'None']]];
    }
  };
  if(kind==='expired')context.tokenExpiry=0;
  vm.runInNewContext(core+syncSource+'\nglobalThis.run = syncScores;',context);
  await context.run();
  if(kind==='success'||kind==='attendance-only'){
    assert.equal(writes.length,1);assert.deepEqual(writes[0].data.map(x=>x.range),["'Meet'!A2","'Meet'!D2","'Meet'!F2","'Meet'!H2"]);
    assert.equal(dirty(p,g),false);assert.ok(messages.some(x=>x.message.includes('synced and verified')));
  } else {
    assert.equal(writes.length,['denied','readback-failed'].includes(kind)?1:0);
    assert.equal(JSON.stringify(p.baseline),before);assert.equal(p.climbs.length,2);
    assert.ok(messages.some(x=>x.error));
  }
  assert.equal(context.busy,false);
  console.log('PASS sync '+kind);tests++;
}
(async()=>{
  const titles=['Instructions','Roster','DATE - TEAM','Summary'];
  const meetHeader=[['','','','CLIMB 1','','CLIMB 2','','CLIMB 3','','TOTAL']];
  const discover=vm.runInNewContext(core+html.slice(html.indexOf('  function isMeetHeader('), html.indexOf('  function savedTab('))+'\navailableMeetTabs',{
    api:async()=>({properties:{title:'League'},sheets:titles.map(title=>({properties:{title,gridProperties:{columnCount:26}}}))}),
    readRanges:async(id,ranges)=>ranges.map(range=>range.includes('Summary')?[['Results']]:meetHeader)
  });
  assert.deepEqual(Array.from((await discover('copy')).titles),['DATE - TEAM']);
  titles.push("Nov 18 - Coach's Meet");
  assert.deepEqual(Array.from((await discover('copy')).titles),['DATE - TEAM',"Nov 18 - Coach's Meet"]);
  console.log('PASS refreshed tab list discovers new meet tabs and skips unrelated tabs');tests++;
  for(const kind of ['success','attendance-only','conflict','formula','denied','expired','readback-failed'])await syncScenario(kind);
  console.log(`${tests} tests passed. All inline scripts parse successfully.`);
})().catch(e=>{console.error(e);process.exitCode=1});
