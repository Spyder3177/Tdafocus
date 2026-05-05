// 
const PROJECTS=[
  {id:"kdp",    label:"KDP / Livres",    color:"#f5a623"},
  {id:"urssaf", label:"URSSAF / Compta", color:"#4ecb71"},
  {id:"perso",  label:"Personnel",       color:"#9b8ff5"},
  {id:"autre",  label:"Autre",           color:"#7a7a96"},
];
const PRIORITIES=[
  {id:"haute",  label:"Haute",   color:"#e05c5c"},
  {id:"moyenne",label:"Moyenne", color:"#f5a623"},
  {id:"basse",  label:"Basse",   color:"#4ecb71"},
];

let tasks    = JSON.parse(localStorage.getItem("tdafocus_pwa_v1")||"[]");
let view     = "today";
let filter   = "all";
let showStats= false;
let editId   = null;
let formSteps= [];
let T = {secs:25*60, running:false, mode:"work", sessions:0, interval:null};

const save  = () => localStorage.setItem("tdafocus_pwa_v1", JSON.stringify(tasks));
const genId = () => Math.random().toString(36).slice(2,9);
const today = () => new Date().toISOString().slice(0,10);
const fmtT  = s => String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
const esc   = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// 
async function decomposeAI(title, project, note) {
  const projLabel = PROJECTS.find(p=>p.id===project)?.label ?? project;
  const prompt = `Tu es un assistant expert pour les personnes TDA/TDAH.
Décompose cette tâche en 4 à 7 micro-étapes concrètes, chacune réalisable en 5 à 15 minutes.
Tâche : "${title}"
Projet : ${projLabel}
${note ? "Contexte : "+note : ""}
Règles : action physique précise, commencer par la plus simple, adapté TDA.
Réponds UNIQUEMENT avec un tableau JSON pur, sans texte ni backticks.`;

  const res = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})
  });
  if(!res.ok) throw new Error("API "+res.status);
  const data = await res.json();
  const text = data.content?.find(b=>b.type==="text")?.text ?? "[]";
  const arr  = JSON.parse(text.replace(/```json|```/g,"").trim());
  if(!Array.isArray(arr)) throw new Error("Format inattendu");
  return arr.map(t=>({id:genId(),text:String(t),done:false}));
}

// 
function render() {
  document.getElementById("date-label").textContent =
    new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});

  const od = tasks.filter(t=>!t.done&&t.dueDate&&t.dueDate<today());
  const ob = document.getElementById("overdue-badge");
  if(od.length){ob.textContent=od.length+" en retard";ob.style.display="";}
  else ob.style.display="none";

  document.getElementById("tab-today").className="tab"+(view==="today"?" active":"");
  document.getElementById("tab-all").className="tab"+(view==="all"?" active":"");

  // Stats
  const ss = document.getElementById("stats-section");
  if(showStats){
    const wk=new Date(); wk.setDate(wk.getDate()-7); const ws=wk.toISOString().slice(0,10);
    const items=[
      {l:"Aujourd'hui", v:tasks.filter(t=>t.done&&t.doneAt===today()).length,      c:"var(--accent)"},
      {l:"Cette sem.",  v:tasks.filter(t=>t.done&&t.doneAt>=ws).length,            c:"var(--ai)"},
      {l:"En cours",    v:tasks.filter(t=>!t.done).length,                          c:"var(--purple)"},
      {l:"Étapes",    v:tasks.reduce((a,t)=>a+t.steps.filter(s=>s.done).length,0),c:"var(--ok)"},
    ];
    ss.style.display="";
    ss.innerHTML='<div class="stats">'+items.map(i=>
      `<div class="stat-box"><div class="stat-val" style="color:${i.c}">${i.v}</div><div class="stat-lbl">${i.l}</div></div>`
    ).join("")+"</div>";
  } else ss.style.display="none";

  // Filtres projet
  const ps = document.getElementById("pills-section");
  if(view==="all"){
    ps.style.display="";
    ps.innerHTML=[{id:"all",label:"Tous",color:"var(--accent)"},...PROJECTS].map(p=>{
      const a=filter===p.id;
      return `<button class="pill" onclick="setFilter('${p.id}')"
        style="background:${a?p.color+"22":"transparent"};border-color:${a?p.color:"var(--border)"};color:${a?p.color:"var(--muted)"}">${p.label}</button>`;
    }).join("");
  } else ps.style.display="none";

  // Bandeau today
  const b = document.getElementById("banner");
  if(view==="today"){
    b.style.display="";
    const tl=getTodayTasks();
    b.textContent = tl.length===0
      ? "Aucune tâche prioritaire — bien joué ou à planifier ?"
      : `${tl.length} tâche${tl.length>1?"s":""} max aujourd'hui. Commence par la première.`;
  } else b.style.display="none";

  // Liste
  const displayed = view==="today" ? getTodayTasks() : getAllTasks();
  const tl = document.getElementById("task-list");
  tl.innerHTML = displayed.length===0
    ? `<div class="empty"><div class="empty-icon">OK</div><div class="empty-text">Rien ici pour l'instant</div><button class="btn btn-md btn-accent" onclick="openForm()">Créer une tâche</button></div>`
    : displayed.map(renderCard).join("");

  // Complétées
  const ds = document.getElementById("done-section");
  if(view==="all"){
    const comp=tasks.filter(t=>t.done&&(filter==="all"||t.project===filter));
    ds.innerHTML = comp.length
      ? `<div class="section-label">Complétées (${comp.length})</div>`+comp.slice(0,8).map(renderCard).join("")
      : "";
  } else ds.innerHTML="";
}

function getTodayTasks(){
  const po={haute:0,moyenne:1,basse:2};
  return tasks.filter(t=>!t.done&&(t.dueDate===today()||!t.dueDate))
    .sort((a,b)=>(po[a.priority]??1)-(po[b.priority]??1)).slice(0,5);
}
function getAllTasks(){
  const po={haute:0,moyenne:1,basse:2};
  return tasks.filter(t=>!t.done&&(filter==="all"||t.project===filter))
    .sort((a,b)=>(po[a.priority]??1)-(po[b.priority]??1));
}

// 
function renderCard(t){
  const proj  = PROJECTS.find(p=>p.id===t.project) ?? PROJECTS[3];
  const dn    = t.steps.filter(s=>s.done).length;
  const total = t.steps.length;
  const pct   = total>0 ? dn/total : 0;
  const ov    = t.dueDate && t.dueDate<today() && !t.done;

  const tags = [
    `<span class="tag" style="background:${proj.color}22;color:${proj.color};border:1px solid ${proj.color}44">${proj.label}</span>`,
    ov ? `<span class="tag" style="background:rgba(224,92,92,.15);color:var(--danger);border:1px solid rgba(224,92,92,.3)">En retard</span>` : "",
    t.recurring&&t.recurring!=="none" ? `<span class="tag" style="background:rgba(155,143,245,.15);color:var(--purple);border:1px solid rgba(155,143,245,.3)">Récurrent</span>` : "",
    total>0 ? `<span class="tag" style="background:var(--ai-soft);color:var(--ai);border:1px solid rgba(96,200,245,.3)">${dn}/${total}</span>` : "",
  ].filter(Boolean).join("");

  const stepsHtml = t.expanded && total>0 ? `
    <div class="steps-list">
      ${t.steps.map((s,i)=>`
        <div class="step-row">
          <button class="step-cb ${s.done?"done":""}" onclick="toggleStep('${t.id}','${s.id}')">
            ${s.done?'<span style="color:#0f0f13;font-size:10px;font-weight:800">OK</span>':""}
          </button>
          <span style="font-size:13px;flex:1;color:${s.done?"var(--muted)":"var(--text)"};text-decoration:${s.done?"line-through":"none"}">${i+1}. ${esc(s.text)}</span>
        </div>`).join("")}
      ${t.note?`<div style="padding:10px 14px;background:var(--accent-soft);font-size:12px;color:var(--muted);font-style:italic">→ ${esc(t.note)}</div>`:""}
    </div>` : "";

  return `
  <div class="card${t.done?" done":""}" style="border-left:3px solid ${t.done?"var(--faint)":proj.color}">
    <div class="card-top">
      <button class="checkbox${t.done?" checked":""}" onclick="toggleTask('${t.id}')">
        ${t.done?'<span style="color:#0f0f13;font-size:10px;font-weight:800">OK</span>':""}
      </button>
      <div style="flex:1;min-width:0">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:14px;font-weight:600;color:${t.done?"var(--muted)":"var(--text)"};text-decoration:${t.done?"line-through":"none"}">${esc(t.title)}</span>
          ${tags}
        </div>
        ${t.dueDate&&!t.done?`<div style="font-size:11px;color:${ov?"var(--danger)":"var(--muted)"}">Échéance : ${t.dueDate}</div>`:""}
        ${t.note?`<div style="font-size:12px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px">→ ${esc(t.note)}</div>`:""}
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;align-items:center">
        ${total>0?`<button class="btn btn-sm btn-ghost" onclick="toggleExpand('${t.id}')">${t.expanded?"Réduire":"Détails"}</button>`:""}
        <button class="btn btn-sm btn-ghost" onclick="openForm('${t.id}')">Modifier</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="deleteTask('${t.id}')">×</button>
      </div>
    </div>
    ${total>0?`<div class="progress-bar"><div class="progress-fill" style="width:${pct*100}%"></div></div>`:""}
    ${stepsHtml}
  </div>`;
}

// 
function setView(v)    { view=v; render(); }
function setFilter(f)  { filter=f; render(); }
function toggleStats() { showStats=!showStats; render(); }
function toggleTask(id){ tasks=tasks.map(t=>t.id===id?{...t,done:!t.done,doneAt:!t.done?today():undefined}:t); save(); render(); }
function toggleStep(tid,sid){ tasks=tasks.map(t=>t.id===tid?{...t,steps:t.steps.map(s=>s.id===sid?{...s,done:!s.done}:s)}:t); save(); render(); }
function toggleExpand(id){ tasks=tasks.map(t=>t.id===id?{...t,expanded:!t.expanded}:t); render(); }
function deleteTask(id){ if(confirm("Supprimer cette tâche ?")){ tasks=tasks.filter(t=>t.id!==id); save(); render(); } }

// 
function openForm(id) {
  id = id || null; editId = id;
  const t = id ? tasks.find(x=>x.id===id) : null;
  formSteps = t ? t.steps.map(s=>({...s})) : [];
  document.getElementById("modal-content").innerHTML = buildFormHTML(t);
  document.getElementById("overlay").style.display = "flex";
  renderFormSteps();
}

function buildFormHTML(t){
  return `
  <div class="modal-title">
    <h2>${t?"Modifier la tâche":"Nouvelle tâche"}</h2>
    <button class="modal-close btn" onclick="closeAll()">×</button>
  </div>
  <div class="form-group">
    <input class="field" id="f-title" placeholder="Nom de la tâche..." value="${t?esc(t.title):""}"/>
    <div class="form-row">
      <select class="field" id="f-proj">
        ${PROJECTS.map(p=>`<option value="${p.id}"${(t?.project??"kdp")===p.id?" selected":""}>${p.label}</option>`).join("")}
      </select>
      <select class="field" id="f-prio">
        ${PRIORITIES.map(p=>`<option value="${p.id}"${(t?.priority??"moyenne")===p.id?" selected":""}>${p.label} priorité</option>`).join("")}
      </select>
    </div>
    <div class="form-row">
      <input class="field" id="f-due" placeholder="Échéance AAAA-MM-JJ" value="${t?.dueDate??""}"/>
      <select class="field" id="f-recur">
        <option value="none"${(t?.recurring??"none")==="none"?" selected":""}>Pas de récurrence</option>
        <option value="daily"${t?.recurring==="daily"?" selected":""}>Quotidienne</option>
        <option value="weekly"${t?.recurring==="weekly"?" selected":""}>Hebdomadaire</option>
        <option value="monthly"${t?.recurring==="monthly"?" selected":""}>Mensuelle</option>
      </select>
    </div>
    <textarea class="field" id="f-note" rows="2" placeholder="Contexte / note / prochaine action...">${t?.note??""}</textarea>
    <div class="steps-box">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em">Micro-étapes</span>
        <button class="btn btn-sm btn-ai" id="ai-btn" onclick="runAI()">Décomposer avec l'IA</button>
      </div>
      <div id="ai-status"></div>
      <div id="steps-list"></div>
      <div class="step-input-row">
        <input class="field" id="new-step" placeholder="Ajouter une étape manuellement..."
          style="font-size:13px" onkeydown="if(event.key==='Enter'){event.preventDefault();addStepManual();}"/>
        <button class="btn btn-sm btn-default" onclick="addStepManual()">+</button>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-md btn-ghost" onclick="closeAll()">Annuler</button>
      <button class="btn btn-md btn-accent" onclick="saveTask()">Enregistrer</button>
    </div>
  </div>`;
}

function renderFormSteps(){
  const sl = document.getElementById("steps-list");
  if(!sl) return;
  sl.innerHTML = formSteps.map((s,i)=>`
    <div class="step-item">
      <span class="step-num">${i+1}</span>
      <span style="flex:1;font-size:13px;color:var(--text)">${esc(s.text)}</span>
      <button onclick="removeFormStep('${s.id}')" style="background:none;border:none;color:var(--faint);cursor:pointer;font-size:15px;line-height:1;padding:2px">×</button>
    </div>`).join("");
}

function removeFormStep(id){ formSteps=formSteps.filter(s=>s.id!==id); renderFormSteps(); }

function addStepManual(){
  const inp = document.getElementById("new-step");
  if(!inp?.value.trim()) return;
  formSteps.push({id:genId(),text:inp.value.trim(),done:false});
  inp.value=""; renderFormSteps();
}

async function runAI(){
  const title  = document.getElementById("f-title")?.value?.trim();
  const proj   = document.getElementById("f-proj")?.value;
  const note   = document.getElementById("f-note")?.value;
  const status = document.getElementById("ai-status");
  const btn    = document.getElementById("ai-btn");
  if(!title){ status.innerHTML='<div class="err-msg">Saisis d\'abord le nom de la tâche.</div>'; return; }
  btn.disabled=true;
  btn.innerHTML='<span style="animation:spin 1s linear infinite;display:inline-block">...</span> Génération...';
  status.innerHTML='<div class="ai-msg">L\'IA analyse ta tâche et génère des micro-étapes adaptées TDA...</div>';
  try {
    formSteps = await decomposeAI(title, proj, note);
    renderFormSteps(); status.innerHTML="";
  } catch(e) {
    status.innerHTML=`<div class="err-msg">Erreur : ${esc(e.message)}</div>`;
  } finally {
    btn.disabled=false; btn.innerHTML="Décomposer avec l'IA";
  }
}

function saveTask(){
  const title = document.getElementById("f-title")?.value?.trim();
  if(!title) return;
  const task = {
    id: editId ?? genId(), title,
    note:      document.getElementById("f-note")?.value  ?? "",
    project:   document.getElementById("f-proj")?.value  ?? "kdp",
    priority:  document.getElementById("f-prio")?.value  ?? "moyenne",
    dueDate:   document.getElementById("f-due")?.value   ?? "",
    recurring: document.getElementById("f-recur")?.value ?? "none",
    steps: formSteps,
    done: editId ? (tasks.find(t=>t.id===editId)?.done ?? false) : false,
    createdAt: editId ? (tasks.find(t=>t.id===editId)?.createdAt ?? today()) : today(),
  };
  if(editId) tasks=tasks.map(t=>t.id===editId?task:t);
  else       tasks=[task,...tasks];
  save(); closeAll(); render();
}

// 
const TMODES = {
  work: {label:"Focus 25min", dur:25*60, color:"var(--accent)"},
  short:{label:"Pause 5min",  dur:5*60,  color:"var(--ok)"},
  long: {label:"Pause 15min", dur:15*60, color:"var(--purple)"},
};

function openTimer(){
  document.getElementById("modal-content").innerHTML = buildTimerHTML();
  document.getElementById("overlay").style.display = "flex";
  updateTimerUI();
}

function buildTimerHTML(){
  return `
  <div class="modal-title">
    <h2>Timer Focus</h2>
    <button class="modal-close btn" onclick="closeAll()">×</button>
  </div>
  <div style="text-align:center">
    <div class="timer-modes">
      ${Object.entries(TMODES).map(([k,v])=>
        `<button class="btn btn-sm ${T.mode===k?"btn-accent":"btn-default"}" onclick="setTimerMode('${k}')">${v.label}</button>`
      ).join("")}
    </div>
    <div class="timer-ring">
      <svg width="140" height="140" style="transform:rotate(-90deg)">
        <circle cx="70" cy="70" r="54" fill="none" stroke="var(--border)" stroke-width="8"/>
        <circle id="t-arc" cx="70" cy="70" r="54" fill="none" stroke-width="8"
          stroke-dasharray="${2*Math.PI*54}" stroke-dashoffset="${2*Math.PI*54}"
          style="transition:stroke-dashoffset .5s"/>
      </svg>
      <div class="timer-center">
        <span class="timer-time" id="t-disp">${fmtT(T.secs)}</span>
        <span class="timer-label" id="t-lbl">${TMODES[T.mode].label}</span>
      </div>
    </div>
    <div class="timer-actions">
      <button class="btn btn-md btn-accent" id="t-start" onclick="toggleTimer()">${T.running?"Pause":"Démarrer"}</button>
      <button class="btn btn-md btn-default" onclick="resetTimer()">Reset</button>
    </div>
    <div class="timer-sessions" id="t-sess"></div>
    <div class="timer-tip"><strong>Conseil TDA :</strong> toutes les 4 sessions, prends 15 min loin de l'écran.</div>
  </div>`;
}

function updateTimerUI(){
  const arc=document.getElementById("t-arc"); if(!arc) return;
  const m=TMODES[T.mode]; const circ=2*Math.PI*54;
  arc.style.strokeDashoffset = circ*(T.secs/m.dur);
  arc.style.stroke = m.color;
  const d=document.getElementById("t-disp"), l=document.getElementById("t-lbl"),
        s=document.getElementById("t-start"), se=document.getElementById("t-sess");
  if(d)  d.textContent  = fmtT(T.secs);
  if(l)  l.textContent  = m.label;
  if(s)  s.textContent  = T.running ? "Pause" : "Démarrer";
  if(se) se.textContent = T.sessions>0
    ? T.sessions+" session"+(T.sessions>1?"s":"")+" complétée"+(T.sessions>1?"s":"")
    : "";
}

function setTimerMode(m){
  clearInterval(T.interval); T.interval=null;
  T.mode=m; T.secs=TMODES[m].dur; T.running=false;
  document.getElementById("modal-content").innerHTML=buildTimerHTML();
  updateTimerUI();
}

function toggleTimer(){
  T.running=!T.running;
  if(T.running){
    T.interval=setInterval(()=>{
      T.secs--;
      if(T.secs<=0){
        clearInterval(T.interval); T.interval=null; T.running=false;
        if(T.mode==="work"){
          T.sessions++;
          T.mode=T.sessions%4===0?"long":"short";
          T.secs=TMODES[T.mode].dur;
        } else { T.mode="work"; T.secs=25*60; }
        document.getElementById("modal-content").innerHTML=buildTimerHTML();
      }
      updateTimerUI();
    },1000);
  } else {
    clearInterval(T.interval); T.interval=null;
  }
  updateTimerUI();
}

function resetTimer(){
  clearInterval(T.interval); T.interval=null; T.running=false;
  T.secs=TMODES[T.mode].dur; updateTimerUI();
}

function closeAll(){ document.getElementById("overlay").style.display="none"; render(); }

// 
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt", e=>{
  e.preventDefault(); deferredPrompt=e;
  document.getElementById("install-banner")?.classList.remove("hidden");
});
document.getElementById("install-btn")?.addEventListener("click", async()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  document.getElementById("install-banner")?.classList.add("hidden");
});

window.addEventListener("online",  ()=>{ document.getElementById("offline-bar").style.display="none"; });
window.addEventListener("offline", ()=>{ document.getElementById("offline-bar").style.display="block"; });
if(!navigator.onLine) document.getElementById("offline-bar").style.display="block";

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("/sw.js")
      .then(r=>console.log("SW ok", r.scope))
      .catch(e=>console.warn("SW err", e));
  });
}

render();
