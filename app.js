const APP_VERSION = 'v2.4';
const STORE = 'tdafocus_v2_tasks';
const SETTINGS = 'tdafocus_v2_settings';
const PROJECTS = [
  { id:'kdp', label:'KDP / Livres', color:'#f5a623' },
  { id:'revente', label:'Revente', color:'#60c8f5' },
  { id:'compta', label:'Compta', color:'#4ecb71' },
  { id:'maison', label:'Maison', color:'#9b8ff5' },
  { id:'perso', label:'Personnel', color:'#7a7a96' }
];
const PRIORITIES = [
  { id:'haute', label:'Haute' }, { id:'moyenne', label:'Moyenne' }, { id:'basse', label:'Basse' }
];
const TEMPLATES = [
  { id:'kdp-book', label:'Créer un livre KDP', project:'kdp', priority:'haute', note:'Template complet pour avancer sans se disperser.', steps:['Définir le public cible et la promesse','Choisir le titre provisoire','Créer le plan ou la structure','Préparer intérieur ou manuscrit','Créer couverture / visuel principal','Relire les points bloquants','Préparer publication KDP'] },
  { id:'kdp-cover', label:'Couverture KDP', project:'kdp', priority:'haute', note:'Pour sortir une couverture propre et vérifiable.', steps:['Noter format, pages, papier et tranche','Définir ambiance et cible acheteur','Créer le visuel avant','Préparer dos + tranche + arrière','Contrôler marges, fond perdu et texte','Exporter PDF final','Vérifier dans le previewer KDP'] },
  { id:'lbc', label:'Annonce Leboncoin', project:'revente', priority:'moyenne', note:'Optimisé pour vendre plus vite.', steps:['Nettoyer le produit','Prendre 6 à 10 photos nettes','Chercher 3 prix concurrents','Définir prix rapide / moyen / haut','Rédiger titre avec mots-clés','Publier annonce','Relancer ou baisser si pas de contact'] },
  { id:'shipping', label:'Préparer colis / vente', project:'revente', priority:'moyenne', note:'Check rapide pour éviter les oublis.', steps:['Tester le produit si nécessaire','Prendre photo preuve état','Emballer correctement','Peser et mesurer le colis','Imprimer ou préparer étiquette','Envoyer le suivi à l’acheteur'] },
  { id:'urssaf', label:'Compta / URSSAF', project:'compta', priority:'haute', note:'Routine administrative simple.', steps:['Rassembler ventes et recettes','Rassembler frais utiles','Vérifier dates et montants','Mettre à jour le tableau','Calculer estimation charges','Archiver justificatifs'] },
  { id:'menage', label:'Rangement rapide', project:'maison', priority:'basse', note:'Méthode 20 minutes sans réfléchir.', steps:['Prendre un sac poubelle','Retirer ce qui traîne au sol','Regrouper les objets par zone','Essuyer la surface principale','Remettre seulement l’utile','Préparer la prochaine mini-action'] },
  { id:'sport', label:'Séance sport courte', project:'perso', priority:'basse', note:'Quand tu veux juste lancer la machine.', steps:['Mettre tenue et chaussures','Préparer eau et timer','Échauffement 5 minutes','Bloc principal 15 minutes','Retour au calme 3 minutes','Noter séance terminée'] }
];
const today = () => new Date().toISOString().slice(0,10);
const genId = () => Math.random().toString(36).slice(2,10);
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
let tasks = JSON.parse(localStorage.getItem(STORE) || '[]');
let settings = JSON.parse(localStorage.getItem(SETTINGS) || '{"screen":"today","filter":"all"}');
let currentScreen = settings.screen || 'today';
let filter = settings.filter || 'all';
let editId = null;
let formSteps = [];
let focusTaskId = localStorage.getItem('tdafocus_v2_focus') || null;
let timer = { mode:'work', secs:25*60, running:false, interval:null, sessions:Number(localStorage.getItem('tdafocus_v2_sessions') || 0) };
const SCREEN_ORDER = ['today','tasks','focus','stats'];
let lastSwipeDirection = null;
const save = () => localStorage.setItem(STORE, JSON.stringify(tasks));
const saveSettings = () => localStorage.setItem(SETTINGS, JSON.stringify({screen:currentScreen, filter}));
const project = id => PROJECTS.find(p=>p.id===id) || PROJECTS[PROJECTS.length-1];
const taskProgress = t => { const total=t.steps?.length || 0; const done=(t.steps||[]).filter(s=>s.done).length; return {total,done,pct:total?Math.round(done/total*100):0}; };
function dueText(t){ if(!t.dueDate) return 'Sans échéance'; if(t.dueDate < today() && !t.done) return 'En retard'; if(t.dueDate === today()) return 'Aujourd’hui'; return t.dueDate; }
function setScreen(s, direction=null){
  if(!SCREEN_ORDER.includes(s)) return;
  if(s===currentScreen){ render(); return; }
  if(!direction){
    const oldIndex = SCREEN_ORDER.indexOf(currentScreen);
    const newIndex = SCREEN_ORDER.indexOf(s);
    direction = newIndex > oldIndex ? 'left' : 'right';
  }
  lastSwipeDirection = direction;
  currentScreen=s;
  saveSettings();
  render();
}
function setFilter(f){ filter=f; saveSettings(); render(); }
function getOpen(){ return tasks.filter(t=>!t.done); }
function todayTasks(){ const po={haute:0,moyenne:1,basse:2}; return getOpen().filter(t=>!t.dueDate || t.dueDate<=today()).sort((a,b)=>(po[a.priority]??1)-(po[b.priority]??1)).slice(0,3); }
function allTasks(){ const po={haute:0,moyenne:1,basse:2}; return getOpen().filter(t=>filter==='all'||t.project===filter).sort((a,b)=>(po[a.priority]??1)-(po[b.priority]??1)); }

function planDay(){
  const po={haute:0,moyenne:1,basse:2};
  const open=getOpen();
  if(!open.length){ openTemplates(); return; }
  const scored=open.map(t=>{
    let score=0;
    if(t.dueDate && t.dueDate < today()) score+=100;
    if(t.dueDate === today()) score+=70;
    score += t.priority==='haute'?40:t.priority==='moyenne'?20:5;
    const pr=taskProgress(t);
    if(pr.total && pr.pct>0 && pr.pct<100) score+=12;
    if(t.project==='kdp') score+=4;
    if(t.project==='compta') score+=3;
    return {...t, _score:score};
  }).sort((a,b)=>b._score-a._score || (po[a.priority]??1)-(po[b.priority]??1));
  const selected=scored.slice(0,3).map(t=>t.id);
  tasks=tasks.map(t=>selected.includes(t.id)?{...t,dueDate:today(),expanded:t.id===selected[0]?true:t.expanded}:t);
  const first=selected[0];
  save();
  focusTaskId=first;
  localStorage.setItem('tdafocus_v2_focus', first);
  showToast('Journée planifiée : Top 3 mis à jour.');
  setScreen('today');
}
function showToast(message){
  let el=document.getElementById('toast');
  if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.textContent=message;
  el.className='toast show';
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>el.className='toast',2200);
}
function render(){
  document.getElementById('date-label').textContent = new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  SCREEN_ORDER.forEach(s=>{
    const screen = document.getElementById('screen-'+s);
    screen.className='screen'+(s===currentScreen?' active'+(lastSwipeDirection?' swipe-'+lastSwipeDirection:''):'');
    document.getElementById('nav-'+s).className='nav-btn'+(s===currentScreen?' active':'');
  });
  updateNavIndicator();
  lastSwipeDirection = null;
  renderToday(); renderTasks(); renderFocus(); renderStats();
}
function renderToday(){
  const list=todayTasks(); const main=list[0]; const second=list.slice(1);
  document.getElementById('screen-today').innerHTML = `
    <div class="hero"><div class="hero-kicker">Focus du jour</div><div class="hero-title">${main ? esc(main.title) : 'Planifie une tâche importante'}</div><div class="hero-sub">${main ? 'Objectif : une seule vraie priorité, puis deux secondaires maximum.' : 'Ajoute une tâche ou utilise un template pour lancer ta journée.'}</div><div style="margin-top:16px" class="row hero-actions"><button class="btn btn-md btn-accent" onclick="${main?`startFocus('${main.id}')`:'openTemplates()'}">${main?'Démarrer focus':'Utiliser un template'}</button><button class="btn btn-md btn-default" onclick="openForm()">Nouvelle tâche</button><button class="btn btn-md btn-default" onclick="planDay()">Planifier ma journée</button></div></div>
    <div class="grid"><div class="big-stat"><div class="stat-val">${tasks.filter(t=>t.done&&t.doneAt===today()).length}</div><div class="stat-label">terminées aujourd’hui</div></div><div class="big-stat"><div class="stat-val">${getOpen().length}</div><div class="stat-label">en cours</div></div></div>
    <div class="section-title">Top 3</div>
    <div class="stack">${list.length?list.map((t,i)=>renderTaskCard(t,{main:i===0})).join(''):`<div class="empty">Rien à faire pour aujourd’hui.<br><br><div class="row empty-actions"><button class="btn btn-md btn-accent" onclick="openTemplates()">Créer depuis un template</button><button class="btn btn-md btn-default" onclick="planDay()">Planifier</button></div></div>`}</div>
    ${second.length?'<div class="hero-sub" style="margin:14px 2px 0">Astuce : termine la tâche principale avant d’ouvrir les secondaires.</div>':''}
  `;
}
function renderTasks(){
  document.getElementById('screen-tasks').innerHTML = `
    <div class="spread" style="margin-bottom:14px"><div><div class="section-title" style="margin:0">Toutes les tâches</div></div><button class="btn btn-sm btn-accent" onclick="openTemplates()">Templates</button></div>
    <div class="pill-row"><button class="pill ${filter==='all'?'active':''}" onclick="setFilter('all')">Toutes</button>${PROJECTS.map(p=>`<button class="pill ${filter===p.id?'active':''}" onclick="setFilter('${p.id}')">${p.label}</button>`).join('')}</div>
    <div class="stack">${allTasks().length?allTasks().map(t=>renderTaskCard(t)).join(''):'<div class="empty">Aucune tâche dans ce filtre.</div>'}</div>
    ${tasks.filter(t=>t.done).length?`<div class="section-title">Terminées</div><div class="stack">${tasks.filter(t=>t.done).slice(0,8).map(t=>renderTaskCard(t)).join('')}</div>`:''}
  `;
}
function renderTaskCard(t, opts={}){
  const p=project(t.project), pr=taskProgress(t); const overdue=t.dueDate && t.dueDate<today() && !t.done;
  return `<article class="card ${opts.main?'task-main':''} ${t.done?'done':''}"><div class="task-top"><button class="check ${t.done?'checked':''}" onclick="toggleTask('${t.id}')">${t.done?'✓':''}</button><div style="flex:1;min-width:0"><div class="task-title">${esc(t.title)}</div><div class="task-meta">${esc(p.label)} · ${esc(PRIORITIES.find(x=>x.id===t.priority)?.label||'Moyenne')} · <span style="color:${overdue?'var(--danger)':'var(--muted)'}">${dueText(t)}</span></div><div class="row" style="margin-top:9px;flex-wrap:wrap"><span class="tag accent">${pr.done}/${pr.total} étapes</span>${t.recurring&&t.recurring!=='none'?'<span class="tag">Récurrent</span>':''}</div>${pr.total?`<div class="progress"><span style="width:${pr.pct}%"></span></div>`:''}</div><div class="task-actions"><button class="btn btn-sm btn-default" onclick="startFocus('${t.id}')">Focus</button><button class="btn btn-sm btn-ghost" onclick="openForm('${t.id}')">Modifier</button></div></div>${t.expanded?renderSteps(t):''}<div style="margin-top:10px"><button class="btn btn-sm btn-ghost" onclick="toggleExpand('${t.id}')">${t.expanded?'Masquer':'Voir étapes'}</button></div></article>`;
}
function renderSteps(t){ return `<div class="steps">${(t.steps||[]).map(s=>`<div class="step ${s.done?'done':''}"><button class="check ${s.done?'checked':''}" style="width:20px;height:20px;border-radius:7px" onclick="toggleStep('${t.id}','${s.id}')">${s.done?'✓':''}</button><div class="step-text">${esc(s.text)}</div></div>`).join('') || '<div class="step"><div class="step-text">Aucune étape.</div></div>'}</div>`; }
function renderFocus(){
  const t=tasks.find(x=>x.id===focusTaskId && !x.done); const pr=t?taskProgress(t):null; const next=t?(t.steps||[]).find(s=>!s.done):null;
  document.getElementById('screen-focus').innerHTML = t ? `
    <div class="card focus-panel"><div class="hero-kicker">Mode Focus</div><div class="focus-task">${esc(t.title)}</div><div class="task-meta" style="margin-top:8px">${esc(project(t.project).label)} · progression ${pr.done}/${pr.total}</div><div class="timer" id="timer-display">${fmt(timer.secs)}</div><div class="row" style="justify-content:center"><button class="btn btn-md btn-accent" onclick="toggleTimer()">${timer.running?'Pause':'Démarrer'}</button><button class="btn btn-md btn-default" onclick="resetTimer()">Reset</button></div><div class="focus-step"><div class="stat-label">Étape actuelle</div><div style="font-size:16px;font-weight:760;margin-top:8px;line-height:1.35">${next?esc(next.text):'Toutes les étapes sont cochées.'}</div></div><div class="grid"><button class="btn btn-lg btn-default" onclick="completeNextStep('${t.id}')">Étape suivante</button><button class="btn btn-lg btn-accent" onclick="toggleTask('${t.id}')">Terminer tâche</button></div><div style="margin-top:14px"><button class="btn btn-sm btn-ghost" onclick="clearFocus()">Quitter ce focus</button></div></div>
  ` : `<div class="hero"><div class="hero-kicker">Mode Focus</div><div class="hero-title">Aucune tâche sélectionnée</div><div class="hero-sub">Choisis une tâche pour lancer un timer et avancer étape par étape.</div><div style="margin-top:16px"><button class="btn btn-md btn-accent" onclick="setScreen('today')">Voir aujourd’hui</button></div></div>`;
}
function renderStats(){
  const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-7); const ws=weekStart.toISOString().slice(0,10);
  const doneToday=tasks.filter(t=>t.done&&t.doneAt===today()).length, doneWeek=tasks.filter(t=>t.done&&t.doneAt>=ws).length, steps=tasks.reduce((a,t)=>a+(t.steps||[]).filter(s=>s.done).length,0);
  document.getElementById('screen-stats').innerHTML = `<div class="section-title">Statistiques</div><div class="grid"><div class="big-stat"><div class="stat-val">${doneToday}</div><div class="stat-label">aujourd’hui</div></div><div class="big-stat"><div class="stat-val">${doneWeek}</div><div class="stat-label">7 derniers jours</div></div><div class="big-stat"><div class="stat-val">${steps}</div><div class="stat-label">étapes cochées</div></div><div class="big-stat"><div class="stat-val">${timer.sessions}</div><div class="stat-label">sessions focus</div></div></div><div class="section-title">Répartition</div><div class="stack">${PROJECTS.map(p=>`<div class="card spread"><div><div class="task-title">${p.label}</div><div class="task-meta">${tasks.filter(t=>t.project===p.id&&!t.done).length} en cours · ${tasks.filter(t=>t.project===p.id&&t.done).length} terminées</div></div><span class="tag accent">${tasks.filter(t=>t.project===p.id).length}</span></div>`).join('')}</div>`;
}
function toggleTask(id){ tasks=tasks.map(t=>t.id===id?{...t,done:!t.done,doneAt:!t.done?today():undefined}:t); if(focusTaskId===id && tasks.find(t=>t.id===id)?.done) clearFocus(false); save(); render(); }
function toggleStep(tid,sid){ tasks=tasks.map(t=>t.id===tid?{...t,steps:t.steps.map(s=>s.id===sid?{...s,done:!s.done}:s)}:t); save(); render(); }
function completeNextStep(id){ const t=tasks.find(x=>x.id===id); const next=t?.steps.find(s=>!s.done); if(next) toggleStep(id,next.id); }
function toggleExpand(id){ tasks=tasks.map(t=>t.id===id?{...t,expanded:!t.expanded}:t); save(); render(); }
function startFocus(id){ focusTaskId=id; localStorage.setItem('tdafocus_v2_focus', id); setScreen('focus'); }
function clearFocus(doRender=true){ focusTaskId=null; localStorage.removeItem('tdafocus_v2_focus'); if(doRender) render(); }
function openForm(id=null){ editId=id; const t=id?tasks.find(x=>x.id===id):null; formSteps=t?[...(t.steps||[])].map(s=>({...s})):[]; document.getElementById('modal').innerHTML = `<div class="modal-title"><h2>${t?'Modifier':'Nouvelle tâche'}</h2><button class="btn btn-sm btn-ghost" onclick="closeModal()">Fermer</button></div><div class="stack"><input id="f-title" placeholder="Titre de la tâche" value="${t?esc(t.title):''}"><div class="form-row"><select id="f-project">${PROJECTS.map(p=>`<option value="${p.id}" ${(t?.project||'kdp')===p.id?'selected':''}>${p.label}</option>`).join('')}</select><select id="f-priority">${PRIORITIES.map(p=>`<option value="${p.id}" ${(t?.priority||'moyenne')===p.id?'selected':''}>Priorité ${p.label}</option>`).join('')}</select></div><div class="form-row"><input id="f-due" type="date" value="${t?.dueDate||''}"><select id="f-recurring"><option value="none">Pas de récurrence</option><option value="daily" ${t?.recurring==='daily'?'selected':''}>Quotidienne</option><option value="weekly" ${t?.recurring==='weekly'?'selected':''}>Hebdomadaire</option><option value="monthly" ${t?.recurring==='monthly'?'selected':''}>Mensuelle</option></select></div><textarea id="f-note" rows="2" placeholder="Note / contexte">${t?esc(t.note):''}</textarea><div><div class="spread" style="margin-bottom:8px"><div class="stat-label">Micro-étapes</div><button class="btn btn-sm btn-default" onclick="addStep()">Ajouter</button></div><div id="form-steps" class="stack"></div></div><div class="form-actions"><button class="btn btn-lg btn-default" onclick="closeModal()">Annuler</button><button class="btn btn-lg btn-accent" onclick="saveTask()">Enregistrer</button></div></div>`; document.getElementById('overlay').classList.remove('hidden'); renderFormSteps(); }
function renderFormSteps(){ const el=document.getElementById('form-steps'); if(!el) return; el.innerHTML=formSteps.map((s,i)=>`<div class="card" style="padding:10px"><div class="row"><span class="tag">${i+1}</span><input value="${esc(s.text)}" onchange="formSteps[${i}].text=this.value" placeholder="Étape"><button class="btn btn-sm btn-ghost" onclick="removeStep(${i})">×</button></div></div>`).join('') || '<div class="empty" style="padding:20px">Aucune étape.</div>'; }
function addStep(text=''){ formSteps.push({id:genId(), text:text||'Nouvelle étape', done:false}); renderFormSteps(); }
function removeStep(i){ formSteps.splice(i,1); renderFormSteps(); }
function saveTask(){ const title=document.getElementById('f-title').value.trim(); if(!title) return; const old=editId?tasks.find(t=>t.id===editId):null; const task={ id:editId||genId(), title, project:document.getElementById('f-project').value, priority:document.getElementById('f-priority').value, dueDate:document.getElementById('f-due').value, recurring:document.getElementById('f-recurring').value, note:document.getElementById('f-note').value, steps:formSteps.filter(s=>s.text.trim()).map(s=>({id:s.id||genId(), text:s.text.trim(), done:!!s.done})), done:old?.done||false, doneAt:old?.doneAt, createdAt:old?.createdAt||today(), expanded:old?.expanded||false }; tasks=editId?tasks.map(t=>t.id===editId?task:t):[task,...tasks]; save(); closeModal(); render(); }
function openTemplates(){ document.getElementById('modal').innerHTML=`<div class="modal-title"><h2>Templates rapides</h2><button class="btn btn-sm btn-ghost" onclick="closeModal()">Fermer</button></div><div class="stack">${TEMPLATES.map(t=>`<button class="card template-card" onclick="createFromTemplate('${t.id}')"><div class="template-title">${esc(t.label)}</div><div class="template-desc">${esc(t.note)} · ${t.steps.length} étapes</div></button>`).join('')}</div>`; document.getElementById('overlay').classList.remove('hidden'); }
function createFromTemplate(id){ const tpl=TEMPLATES.find(t=>t.id===id); if(!tpl) return; tasks=[{id:genId(), title:tpl.label, project:tpl.project, priority:tpl.priority, dueDate:today(), recurring:'none', note:tpl.note, steps:tpl.steps.map(x=>({id:genId(), text:x, done:false})), done:false, createdAt:today(), expanded:true}, ...tasks]; save(); closeModal(); setScreen('today'); }
function closeModal(){ document.getElementById('overlay').classList.add('hidden'); }
const MODES={work:25*60, short:5*60, long:15*60};
function toggleTimer(){ timer.running=!timer.running; if(timer.running){ timer.interval=setInterval(()=>{ timer.secs--; if(timer.secs<=0){ clearInterval(timer.interval); timer.running=false; timer.sessions++; localStorage.setItem('tdafocus_v2_sessions', timer.sessions); timer.secs = timer.sessions%4===0 ? MODES.long : MODES.short; } renderFocus(); },1000); } else clearInterval(timer.interval); renderFocus(); }
function resetTimer(){ clearInterval(timer.interval); timer.running=false; timer.secs=MODES.work; renderFocus(); }


function updateNavIndicator(idx = SCREEN_ORDER.indexOf(currentScreen), immediate=false){
  const indicator = document.getElementById('nav-indicator');
  const inner = document.querySelector('.nav-inner');
  if(!indicator || !inner) return;
  const gap = 5;
  const itemW = (inner.clientWidth - gap * 3) / 4;
  indicator.style.width = itemW + 'px';
  indicator.style.transition = immediate ? 'none' : 'transform .24s cubic-bezier(.2,.8,.2,1)';
  indicator.style.transform = `translateX(${idx * (itemW + gap)}px)`;
}
function setScreenFromNavIndex(idx){
  idx = Math.max(0, Math.min(SCREEN_ORDER.length - 1, idx));
  setScreen(SCREEN_ORDER[idx]);
}

function moveScreen(delta){
  const i = SCREEN_ORDER.indexOf(currentScreen);
  const ni = Math.max(0, Math.min(SCREEN_ORDER.length - 1, i + delta));
  if(ni !== i) setScreen(SCREEN_ORDER[ni], delta > 0 ? 'left' : 'right');
}
function initSwipeNavigation(){
  let startX=0, startY=0, startTime=0, startTarget=null;

  const isBlocked = target => target.closest('input, textarea, select, .modal, .overlay, .pill-row');

  const onStart = e => {
    if(isBlocked(e.target)) return;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX;
    startY = t.clientY;
    startTime = Date.now();
    startTarget = e.target;
  };

  const onEnd = e => {
    if(!startTarget) return;
    if(isBlocked(startTarget)) { startTarget=null; return; }
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const fast = Date.now() - startTime < 650;

    // Swipe global : fonctionne sur le header, les cards, le vide, et même la nav.
    if(Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.12 && fast){
      moveScreen(dx < 0 ? 1 : -1);
    }
    startTarget = null;
  };

  document.addEventListener('touchstart', onStart, {passive:true});
  document.addEventListener('touchend', onEnd, {passive:true});

  // Barre du bas type Photos : le curseur suit le doigt, puis valide la catégorie au lâcher.
  const nav = document.querySelector('.bottom-nav');
  const inner = document.querySelector('.nav-inner');
  let draggingNav = false;
  let navIdx = SCREEN_ORDER.indexOf(currentScreen);
  const indexFromTouch = e => {
    const t = e.touches?.[0] || e.changedTouches?.[0]; if(!t || !inner) return null;
    const r = inner.getBoundingClientRect();
    if(t.clientY < r.top - 26 || t.clientY > r.bottom + 26) return null;
    return Math.max(0, Math.min(3, Math.floor((t.clientX - r.left) / (r.width / 4))));
  };
  if(nav && inner){
    nav.addEventListener('touchstart', e => {
      const idx = indexFromTouch(e); if(idx === null) return;
      draggingNav = true; navIdx = idx; updateNavIndicator(idx, true);
    }, {passive:true});
    nav.addEventListener('touchmove', e => {
      if(!draggingNav) return;
      const idx = indexFromTouch(e); if(idx === null) return;
      if(idx !== navIdx){ navIdx = idx; updateNavIndicator(idx, true); }
    }, {passive:true});
    nav.addEventListener('touchend', e => {
      if(!draggingNav) return;
      draggingNav = false;
      const idx = indexFromTouch(e);
      if(idx !== null) setScreenFromNavIndex(idx);
      else updateNavIndicator();
    }, {passive:true});
  }
}
initSwipeNavigation();
window.addEventListener('resize', () => updateNavIndicator(), {passive:true});

window.addEventListener('online',()=>document.getElementById('offline-bar').style.display='none');
window.addEventListener('offline',()=>document.getElementById('offline-bar').style.display='block');
if(!navigator.onLine) document.getElementById('offline-bar').style.display='block';
let deferredPrompt=null; window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; document.getElementById('install-banner').classList.remove('hidden'); });
document.getElementById('install-btn').addEventListener('click', async()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; hideInstall(); });
function hideInstall(){ document.getElementById('install-banner').classList.add('hidden'); }
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.warn)); }
render();
