import { mkdir, writeFile } from 'node:fs/promises';

const SOURCE = 'https://classroom-behavior.hatchable.site/offline.html?tools=1';
const res = await fetch(SOURCE, { redirect: 'follow' });
if (!res.ok) throw new Error(`Source fetch failed: ${res.status}`);
let html = await res.text();
if (!html.includes('Classroom Compass Pro')) throw new Error('Unexpected source page; refusing to publish an authentication/block page.');

html = html.replace('<script src="/__hatchable/events.js"></script>', '');
html = html.replace("planInfo={plan:'free',feature_overrides:{}}", "planInfo={plan:'pro',feature_overrides:{standalone:true}}");

html = html.replace('</head>', `<style>
#ccReinforce{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.ccRe{border:0;border-radius:999px;padding:7px 10px;font-weight:900;cursor:pointer;background:#e7f5eb;color:#17472f}.ccBonus{display:flex;gap:7px;align-items:center;margin-top:8px}.ccBonus select{max-width:150px}.ccBurst{position:fixed;pointer-events:none;z-index:99999;font-size:34px;animation:ccBurst 1.2s ease-out forwards}@keyframes ccBurst{0%{transform:translate(0,0) scale(.5);opacity:0}15%{opacity:1}100%{transform:translate(var(--x),var(--y)) scale(1.5) rotate(25deg);opacity:0}}
</style></head>`);

html = html.replace('</body>', `<script>
(() => {
  const badge = document.getElementById('accountBadge');
  if (badge) badge.textContent = 'Vercel standalone • Local save';
  const status = document.getElementById('saveStatus');
  if (status) status.textContent = 'Saved on this device • محفوظ على هذا الجهاز';
  const refresh = document.getElementById('refreshClasses');
  if (refresh) { refresh.textContent='↻ Local classes / الصفوف المحلية'; refresh.onclick=()=>{ if(status) status.textContent=document.documentElement.lang==='ar'?'✓ الصفوف محفوظة على هذا الجهاز':'✓ Classes are saved on this device'; }; }
  const signout=document.getElementById('signout'); if(signout) signout.style.display='none';

  const phrase=document.getElementById('phrase');
  const reinf={
    en:['Excellent work!','Amazing thinking!','Brilliant answer!','Fantastic participation!','Great effort!','Super improvement!','Creative idea!','Wonderful teamwork!','You nailed it!','Keep shining!'],
    ar:['عمل ممتاز!','تفكير رائع!','إجابة مبدعة!','مشاركة مميزة!','مجهود رائع!','تطور ممتاز!','فكرة إبداعية!','عمل جماعي رائع!','أحسنت جدًا!','استمر في التألق!']
  };
  if(phrase){ phrase.innerHTML=''; reinf.en.forEach((v,i)=>{const o=document.createElement('option');o.value=v;o.textContent=v+' / '+reinf.ar[i];phrase.appendChild(o)}); const bar=document.createElement('div');bar.id='ccReinforce'; const labels=[['🌟 Excellent','🌟 ممتاز'],['🧠 Smart','🧠 ذكي'],['🔥 Great effort','🔥 مجهود رائع'],['🎨 Creative','🎨 مبدع'],['👏 Participation','👏 مشاركة'],['🤝 Teamwork','🤝 تعاون']]; labels.forEach((x,i)=>{const b=document.createElement('button');b.className='ccRe';b.type='button';b.textContent=x[0]+' / '+x[1];b.onclick=()=>{const ar=document.documentElement.lang==='ar';const msg=ar?reinf.ar[i]:reinf.en[i];phrase.value=reinf.en[i];if(typeof active!=='undefined'&&active>=0&&typeof showStudent==='function')showStudent(active,true,msg);burst();};bar.appendChild(b)});phrase.insertAdjacentElement('afterend',bar); }

  function burst(){const icons=['⭐','🌟','👏','🎉','✨'];for(let i=0;i<10;i++){const e=document.createElement('div');e.className='ccBurst';e.textContent=icons[Math.floor(Math.random()*icons.length)];e.style.left=(45+Math.random()*10)+'vw';e.style.top=(45+Math.random()*10)+'vh';e.style.setProperty('--x',((Math.random()-.5)*360)+'px');e.style.setProperty('--y',(-80-Math.random()*260)+'px');document.body.appendChild(e);setTimeout(()=>e.remove(),1300)}}

  const ex=document.getElementById('excellentBtn');
  if(ex){const wrap=document.createElement('div');wrap.className='ccBonus';wrap.innerHTML='<b>💡 Excellent answer bonus / نقاط الإجابة المميزة</b><select id="ccExcellentBonus"><option value="3">+3</option><option value="5" selected>+5</option><option value="10">+10</option></select>';ex.parentElement?.insertAdjacentElement('afterend',wrap); const sel=wrap.querySelector('#ccExcellentBonus'); const update=()=>ex.innerHTML='💡 '+(document.documentElement.lang==='ar'?'إجابة مميزة ':'Excellent answer ')+sel.value+'+';sel.onchange=update;update();ex.onclick=()=>{if(typeof active==='undefined'||active<0)return alert(document.documentElement.lang==='ar'?'اختر طالبًا أولاً':'Select a student first');const bonus=Number(sel.value||5);if(typeof doAction==='function'){doAction(active,'excellent',bonus);burst();}};}

  function getFairState(c){const key='cc_fair_spinner_'+c.id;let st={pool:[],last:null,round:1};try{st=JSON.parse(localStorage.getItem(key)||'null')||st}catch{}return {key,st};}
  function fairPick(){if(typeof sync==='function')sync();const c=typeof current==='function'?current():null;if(!c)return;const eligible=(c.students||[]).filter(s=>s.attendance!=='Absent');if(!eligible.length)return alert(document.documentElement.lang==='ar'?'لا يوجد طلاب حاضرون للاختيار':'No present students to pick');const {key,st}=getFairState(c);const ids=eligible.map(s=>String(s.id));st.pool=(st.pool||[]).filter(id=>ids.includes(String(id)));if(!st.pool.length){st.pool=[...ids];st.round=(st.round||0)+1;}let pool=st.pool;if(pool.length>1&&st.last)pool=pool.filter(id=>String(id)!==String(st.last));const chosenId=pool[Math.floor(Math.random()*pool.length)];const idx=c.students.findIndex(s=>String(s.id)===String(chosenId));st.pool=st.pool.filter(id=>String(id)!==String(chosenId));st.last=chosenId;localStorage.setItem(key,JSON.stringify(st));const caption=document.getElementById('spinnerCaption');const stage=document.getElementById('spinnerStage');const wheel=document.getElementById('spinnerWheel');if(typeof ccSpinnerEnabled!=='undefined'&&ccSpinnerEnabled&&stage&&wheel){stage.hidden=false;if(caption)caption.textContent=(document.documentElement.lang==='ar'?'الدور العادل '+st.round+' • المتبقون: ':'Fair round '+st.round+' • remaining: ')+st.pool.length;if(typeof ccSpinRotation!=='undefined'){ccSpinRotation+=1440+Math.floor(Math.random()*360);wheel.style.transform='rotate('+ccSpinRotation+'deg)';setTimeout(()=>{if(typeof showStudent==='function')showStudent(idx,true);if(caption)caption.textContent=c.students[idx].name+' ✓';},2050);}else if(typeof showStudent==='function')showStudent(idx,true);}else if(typeof showStudent==='function')showStudent(idx,true);}
  const pickBtn=document.getElementById('pickBtn');if(pickBtn){pickBtn.innerHTML='🎯 '+(document.documentElement.lang==='ar'?'اختيار عادل':'Fair Pick');pickBtn.onclick=fairPick;}
  const spinToggle=document.getElementById('spinnerToggle');if(spinToggle)spinToggle.title='Fair cycle: every present student is picked before the cycle resets';
})();
</script></body>`);

await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html, 'utf8');
await writeFile('dist/offline.html', html, 'utf8');
await writeFile('dist/manifest.webmanifest', JSON.stringify({name:'Classroom Compass Pro',short_name:'Classroom Compass',start_url:'/?tools=1',display:'standalone',background_color:'#f2f7f3',theme_color:'#153d2b'}, null, 2));
console.log('Built enhanced standalone Classroom Compass for Vercel.');
