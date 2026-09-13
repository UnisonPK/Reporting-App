/* Programme Risk Ranking V1
   Derived management risk engine. No new backend register.
   Score = Float 40 + Delay/Variance 25 + Remaining Duration 10 + Design 15 + Procurement 10.
*/
(function(){
  "use strict";
  if(window.__PMC_PROGRAMME_RISK_V1__)return;
  window.__PMC_PROGRAMME_RISK_V1__=true;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const norm=v=>String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const iso=v=>String(v||"").slice(0,10);
  const dt=v=>{const d=new Date(iso(v)+"T00:00:00");return isNaN(d)?null:d};
  const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
  const days=(a,b)=>Math.round((b-a)/86400000);
  let loading=false,last=[];

  function api(a,d){if(!window.LCRG_API||typeof window.LCRG_API.call!=="function")return Promise.reject(new Error("API not ready"));return window.LCRG_API.call(a,d||{});}
  function arr(x){return Array.isArray(x)?x:(x&&Array.isArray(x.rows)?x.rows:[])}
  function project(){const e=$("cockpitProjectFilter");if(e&&e.value)return String(e.value).trim();try{return typeof getActiveProject==="function"?String(getActiveProject()||"").trim():"";}catch(_e){return""}}
  function towerFilter(){const e=$("cockpitTowerFilter");return e?String(e.value||"").trim():""}
  function tower(r){return String(r&& (r.tower||r.area||r.towerArea||r.block)||"").trim()}
  function title(r){return String(r&& (r.milestone||r.activity||r.name)||"—").trim()}
  function done(r){return /completed|closed|delivered|approved|ready|implemented|resolved/i.test(String(r&&r.status||""))||!!iso(r&& (r.actualDate||r.actual))}
  function target(r){return iso(r&&(r.forecastDate||r.currentTargetDate||r.targetDate||r.target||r.baselineDate||r.baseline))}
  function baseline(r){return iso(r&&(r.baselineDate||r.baseline))}
  function parseToken(remarks,label){const m=String(remarks||"").match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\s*:\\s*([^|]+)","i"));return m?m[1].trim():""}
  function floatInfo(r){const s=String(r&&r.remarks||"");if(!/\[P6FLOAT\]/i.test(s))return {tf:null,remaining:null,criticality:""};const tf=Number(parseToken(s,"Total Float").replace(/\s*d.*$/i,""));const rem=Number(parseToken(s,"Remaining Duration").replace(/\s*d.*$/i,""));return {tf:Number.isFinite(tf)?tf:null,remaining:Number.isFinite(rem)?rem:null,criticality:parseToken(s,"Criticality")}}
  function words(v){return new Set(norm(v).split(/\s+/).filter(x=>x.length>3&&!['tower','floor','area','work','works','complete','completion','project','milestone'].includes(x)))}
  function overlap(a,b){const A=words(a),B=words(b);let n=0;A.forEach(x=>{if(B.has(x))n++});return n}
  function sameTower(a,b){if(!a||!b)return true;const A=norm(a),B=norm(b);return A===B||A.includes(B)||B.includes(A)}
  function delayDays(r){const t=dt(target(r));return t&&!done(r)?Math.max(0,days(t,today())):0}
  function varianceDays(r){const b=dt(baseline(r)),t=dt(target(r));return b&&t?Math.max(0,days(b,t)):0}

  function floatScore(tf){if(tf==null)return 0;if(tf<=0)return 40;if(tf<=5)return 34;if(tf<=10)return 28;if(tf<=20)return 18;if(tf<=30)return 8;return 0}
  function delayScore(d,v){const x=Math.max(d,v);if(x>=30)return 25;if(x>=14)return 20;if(x>=7)return 15;if(x>0)return 10;return 0}
  function durationScore(r){if(r==null)return 0;if(r>=60)return 10;if(r>=30)return 8;if(r>=14)return 5;if(r>=7)return 3;return 0}
  function band(s){return s>=70?"Red":s>=40?"Amber":"Green"}

  function dependencies(m,design,proc){
    const tw=tower(m),name=title(m),t=dt(target(m));
    const ds=design.filter(d=>{if(done(d)||!sameTower(tw,tower(d)))return false;const rd=dt(d.requiredDate||d.requiredAtSite||d.target);const relevant=overlap(name,[d.activity,d.deliverable,d.requirement,d.remarks,d.action,d.title].join(" "))>0;return relevant||(rd&&t&&rd<=t)});
    const ps=proc.filter(p=>{if(done(p)||!sameTower(tw,tower(p)))return false;const req=dt(p.requiredDate),fc=dt(p.forecastDate),late=!!p.isLate||!!p.isAtRisk||(req&&fc&&fc>req);const relevant=overlap(name,[p.packageName,p.vendor,p.remarks].join(" "))>0;return relevant||late&&req&&t&&req<=t});
    const dCritical=ds.some(x=>String(x.priority||"").toLowerCase()==="critical"||/at risk|blocked|overdue/i.test(String(x.status||"")));
    const pCritical=ps.some(x=>x.isLate||x.isAtRisk||/late|delayed|at risk|blocked/i.test(String(x.status||"")));
    return {design:ds,proc:ps,designScore:dCritical?15:ds.length?10:0,procScore:pCritical?10:ps.length?6:0};
  }

  function scoreRows(prog,design,proc){
    const p=project(),tf=towerFilter();
    return prog.filter(r=>!done(r)&&(!p||String(r.project||"").trim()===p)&&(!tf||tower(r)===tf)).map(r=>{
      const fi=floatInfo(r),d=delayDays(r),v=varianceDays(r),dep=dependencies(r,design,proc);
      const parts={float:floatScore(fi.tf),delay:delayScore(d,v),duration:durationScore(fi.remaining),design:dep.designScore,procurement:dep.procScore};
      const score=Math.min(100,parts.float+parts.delay+parts.duration+parts.design+parts.procurement);
      const drivers=[];
      if(fi.tf!=null)drivers.push("Float "+fi.tf+"d");
      if(d)drivers.push(d+"d overdue");else if(v)drivers.push(v+"d variance");
      if(fi.remaining!=null&&fi.remaining>=14)drivers.push(fi.remaining+"d remaining");
      if(dep.design.length)drivers.push(dep.design.length+" design blocker"+(dep.design.length>1?"s":""));
      if(dep.proc.length)drivers.push(dep.proc.length+" procurement blocker"+(dep.proc.length>1?"s":""));
      return {row:r,title:title(r),tower:tower(r)||"All / Overall",target:target(r),score,band:band(score),parts,drivers,design:dep.design,proc:dep.proc,totalFloat:fi.tf,remaining:fi.remaining,delay:d,variance:v};
    }).sort((a,b)=>b.score-a.score||(a.totalFloat==null?999:a.totalFloat)-(b.totalFloat==null?999:b.totalFloat)||String(a.target).localeCompare(String(b.target)));
  }

  function styles(){if($("programmeRiskStyles"))return;const s=document.createElement("style");s.id="programmeRiskStyles";s.textContent=`
  .prr-wrap{margin-top:10px;border:1px solid #e2e8f0;border-radius:11px;background:#fff;overflow:hidden}.prr-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.prr-head b{font-size:11px;color:#172b4d}.prr-head span{display:block;font-size:8px;color:#64748b;margin-top:2px}.prr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:9px}.prr-kpi{background:#f8fafc;border-radius:8px;padding:7px}.prr-kpi span{font-size:7px;text-transform:uppercase;color:#64748b;font-weight:900}.prr-kpi b{display:block;font-size:15px;color:#172b4d}.prr-list{padding:0 9px 9px}.prr-row{display:grid;grid-template-columns:54px 1.5fr 95px 1.2fr;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #eef2f7;font-size:8px}.prr-score{font-size:16px;font-weight:900;text-align:center;border-radius:8px;padding:7px 3px}.prr-red{background:#fee2e2;color:#991b1b}.prr-amber{background:#ffedd5;color:#9a3412}.prr-green{background:#dcfce7;color:#166534}.prr-driver{color:#64748b}.prr-open{border:0;background:#0b3f88;color:#fff;border-radius:6px;padding:6px 9px;font-size:8px;font-weight:900;cursor:pointer}.prr-page{margin:12px 0;border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:12px}.prr-table{overflow:auto}.prr-table table{width:100%;border-collapse:collapse;min-width:1050px}.prr-table th{background:#f8fafc;color:#64748b;text-transform:uppercase;font-size:8px;text-align:left;padding:8px}.prr-table td{font-size:9px;padding:8px;border-top:1px solid #eef2f7;vertical-align:top}@media(max-width:850px){.prr-kpis{grid-template-columns:1fr 1fr}.prr-row{grid-template-columns:48px 1fr 80px}.prr-driver{display:none}}
  `;document.head.appendChild(s)}

  function ensureCockpit(){const root=$("managementCockpit");if(!root||$("cockpitProgrammeRisk"))return;styles();const w=document.createElement("div");w.id="cockpitProgrammeRisk";w.className="prr-wrap";w.innerHTML='<div class="prr-head"><div><b>Top Programme Threats</b><span>Risk score: Float + Delay + Duration + Design + Procurement</span></div><button id="prrOpen" class="prr-open">Open Programme →</button></div><div id="prrKpis" class="prr-kpis"></div><div id="prrList" class="prr-list"></div>';const pc=$("cockpitProgrammeControl");if(pc)pc.insertAdjacentElement("afterend",w);else root.appendChild(w);$("prrOpen").onclick=()=>{if(typeof window.openProgramme==="function")window.openProgramme()}}

  function ensureProgramme(){const page=$("programmePage");if(!page||$("programmeRiskRanking"))return;styles();const container=page.querySelector(".container");if(!container)return;const p=document.createElement("div");p.id="programmeRiskRanking";p.className="prr-page";p.innerHTML='<div class="prr-head"><div><b>Programme Risk Ranking</b><span>Derived risk; no duplicate register</span></div><button id="prrRefresh" class="prr-open">↻ Refresh</button></div><div id="prrPageTable"></div>';container.appendChild(p);$("prrRefresh").onclick=()=>refresh(true)}

  function renderCockpit(a){ensureCockpit();if(!$("prrKpis"))return;const red=a.filter(x=>x.band==="Red").length,amber=a.filter(x=>x.band==="Amber").length,top=a[0]||null,critical=a.filter(x=>x.totalFloat!=null&&x.totalFloat<=0).length;$("prrKpis").innerHTML='<div class="prr-kpi"><span>Red Threats</span><b>'+red+'</b></div><div class="prr-kpi"><span>Amber</span><b>'+amber+'</b></div><div class="prr-kpi"><span>Critical Float</span><b>'+critical+'</b></div><div class="prr-kpi"><span>Top Score</span><b>'+(top?top.score:'—')+'</b></div>';const top5=a.slice(0,5);$("prrList").innerHTML=top5.length?top5.map(x=>'<div class="prr-row"><div class="prr-score prr-'+x.band.toLowerCase()+'">'+x.score+'</div><div><b>'+esc(x.title)+'</b><br>'+esc(x.tower)+'</div><div>'+esc(x.target||'—')+'</div><div class="prr-driver">'+esc(x.drivers.slice(0,3).join(' • ')||'Open programme exposure')+'</div></div>').join(''):'<div style="padding:8px;color:#64748b;font-size:9px">No open programme threats for this scope.</div>'}

  function renderProgramme(a){ensureProgramme();const p=$("prrPageTable");if(!p)return;const top=a.slice(0,20);p.innerHTML=top.length?'<div class="prr-table"><table><thead><tr><th>Score</th><th>Band</th><th>Activity / Milestone</th><th>Tower</th><th>Target</th><th>Float</th><th>Delay / Variance</th><th>Remaining</th><th>Design</th><th>Procurement</th><th>Primary Drivers</th></tr></thead><tbody>'+top.map(x=>'<tr><td><b>'+x.score+'</b></td><td><span class="prr-score prr-'+x.band.toLowerCase()+'" style="display:inline-block;font-size:9px;padding:4px 7px">'+x.band+'</span></td><td><b>'+esc(x.title)+'</b></td><td>'+esc(x.tower)+'</td><td>'+esc(x.target||'—')+'</td><td>'+esc(x.totalFloat==null?'—':x.totalFloat+' d')+'</td><td>'+esc(x.delay?x.delay+' d overdue':x.variance?x.variance+' d variance':'—')+'</td><td>'+esc(x.remaining==null?'—':x.remaining+' d')+'</td><td>'+x.design.length+'</td><td>'+x.proc.length+'</td><td>'+esc(x.drivers.join(' • ')||'Open programme exposure')+'</td></tr>').join('')+'</tbody></table></div>':'<div style="padding:18px;color:#64748b">No open programme items are available for risk ranking.</div>'}

  async function refresh(force){if(loading&&!force)return;loading=true;try{const pr=project();const rs=await Promise.allSettled([api("programme",{project:pr}),api("designLookAhead",{project:pr}),api("procurement",{project:pr})]);const prog=arr(rs[0].status==="fulfilled"?rs[0].value:[]),design=arr(rs[1].status==="fulfilled"?rs[1].value:[]),proc=arr(rs[2].status==="fulfilled"?rs[2].value:[]);last=scoreRows(prog,design,proc);renderCockpit(last);renderProgramme(last);window.PMC_PROGRAMME_RISK_DATA=last}catch(e){console.warn("Programme Risk Ranking:",e)}finally{loading=false}}

  function hook(){ensureCockpit();ensureProgramme();const oldRender=window.renderManagementCockpitFromCache;if(typeof oldRender==="function"&&!oldRender.__prr){const w=function(){const r=oldRender.apply(this,arguments);setTimeout(()=>refresh(false),550);return r};w.__prr=true;window.renderManagementCockpitFromCache=w}const oldLoad=window.loadManagementCockpit;if(typeof oldLoad==="function"&&!oldLoad.__prr){const w=function(){const r=oldLoad.apply(this,arguments);setTimeout(()=>refresh(false),900);return r};w.__prr=true;window.loadManagementCockpit=w}const oldProg=window.loadProgramme;if(typeof oldProg==="function"&&!oldProg.__prr){const w=function(){const r=oldProg.apply(this,arguments);setTimeout(()=>refresh(false),450);return r};w.__prr=true;window.loadProgramme=w}['cockpitProjectFilter','cockpitTowerFilter','dashboardRefreshButton'].forEach(id=>{const e=$(id);if(e&&!e.__prr){e.__prr=true;e.addEventListener(id==='dashboardRefreshButton'?'click':'change',()=>setTimeout(()=>refresh(true),500))}});setTimeout(()=>refresh(false),1100)}

  function boot(){let n=0,t=setInterval(()=>{n++;if($("managementCockpit")||$("programmePage")){hook();clearInterval(t)}else if(n>60)clearInterval(t)},250)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();window.addEventListener("load",boot,{once:true});
  window.refreshProgrammeRiskRanking=()=>refresh(true);
})();