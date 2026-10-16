const G=require('./game.js'),F=require('./fps.js');
let rs=1;const rnd=()=>{rs=(rs*16807)%2147483647;return rs/2147483647};
const ps=(L,gear)=>{const g=Math.max(1,Math.round(L*0.75));return G.playerStats(L,{kaki:g,paha:g,core:g,lengan:g,dada:g,bahu:g},gear||{weapon:'pipa',armor:'none'})};
let bad=0;
for(const z of G.ZONES){
  const row=[];
  for(const [name,L,rate] of [['rec',z.rec,1.3],['rec-slow',z.rec,0.8],['low',Math.max(1,Math.round(z.rec*0.5)),1.3]]){
    let w=0,N=40,hp=0;for(let i=0;i<N;i++){const s=F.runBot(ps(L),z,rate,rnd);if(s.status==='win'){w++;hp+=s.hp/s.maxhp}}
    row.push(name+' '+Math.round(100*w/N)+'%'+(w?' hp'+Math.round(100*hp/w):''));
  }
  console.log(z.id.padEnd(10),'rec',z.rec,row.join('  '));
}
// guard reduces damage
{ const z=G.ZONES[1],p=ps(3); const run=(g)=>{let s=F.createSim(p,z,rnd);s.setGuard(g);let n=0;while(s.status==='run'&&n++<60*30){s.walk(0);s.step(1/60)}return s.maxhp-s.hp}; const a=run(false),b=run(true); console.log('guard dmg taken 30s: no-guard',a,'guard',b); if(!(b<a*0.5)){console.log('FAIL guard');bad++} }
// assertions
const wr=(z,L,rate,N=40)=>{let w=0;for(let i=0;i<N;i++)if(F.runBot(ps(L),z,rate,rnd).status==='win')w++;return w/N};
for(const z of G.ZONES){ if(wr(z,z.rec,1.3)<0.85){console.log('FAIL rec win',z.id);bad++} }
const z4=G.ZONES[4]; if(wr(z4,2,1.3)>0.1){console.log('FAIL underlevel too easy');bad++}
console.log(bad?'FAILED':'ALL PASSED');process.exit(bad?1:0);
