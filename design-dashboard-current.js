/* Design Management - Dashboard Current Drawing Counters
   Dashboard KPIs count only the latest logical revision per Project + Drawing No.
   PDF/DWG/DXF companion files and archived revisions are not double-counted.
*/
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const activeProject=()=>typeof getActiveProject==="function"?String(getActiveProject()||"").trim():"";
  function parseMeta(r){
    const m=String(r&&r.remarks||"").match(/^\[\[DM1:([^\]]+)\]\]/);
    if(!m)return {};
    try{return JSON.parse(decodeURIComponent(m[1]))||{};}catch(_e){return {};}
  }
  function mainCategory(r){
    const meta=parseMeta(r);if(meta.mainCategory)return meta.mainCategory;
    const d=String(r&&r.discipline||"").toLowerCase();
    if(d.indexOf("struct")>=0)return "Structural";
    if(["mep","electrical","plumbing","hvac","fire fighting","fire alarm","elv","ict","bms","lift"].some(x=>d.indexOf(x)>=0))return "MEP";
    return "Architecture / Finishes";
  }
  function revParts(v){
    let s=String(v||"").trim().toUpperCase().replace(/^REV(?:ISION)?[\s._-]*/,"").replace(/^R(?=\d)/,"");
    let m=s.match(/^(\d+)([A-Z]*)$/);if(m)return {kind:3,n:+m[1],tail:m[2]};
    m=s.match(/^([A-Z]+)(\d*)$/);if(m)return {kind:2,n:m[2]?+m[2]:0,tail:m[1]};
    return {kind:1,n:0,tail:s};
  }
  function cmpRev(a,b){const x=revParts(a),y=revParts(b);if(x.kind!==y.kind)return x.kind-y.kind;if(x.n!==y.n)return x.n-y.n;return x.tail.localeCompare(y.tail);}
  function currentRows(){
    const p=activeProject();const groups={};
    (window.drawingsData||[]).forEach(r=>{
      if(p&&String(r.project||"").trim()!==p)return;
      const k=[r.project,r.drawingNo].map(x=>String(x||"").trim().toLowerCase()).join("||");
      (groups[k]||(groups[k]=[])).push(r);
    });
    const out=[];
    Object.values(groups).forEach(arr=>{
      let best=arr[0];
      arr.forEach(r=>{const c=cmpRev(r.revision,best.revision);if(c>0||(c===0&&String(r.issueDate||"")>String(best.issueDate||"")))best=r;});
      const same=arr.filter(r=>cmpRev(r.revision,best.revision)===0);
      const preferred=same.find(r=>String(r.status||"").toLowerCase()!=="superseded")||same[0]||best;
      out.push(preferred);
    });
    return out;
  }
  function info(r){const m=parseMeta(r);return {priority:m.priority||"Normal",impact:m.impact||"None",requiredAtSite:m.requiredAtSite||""};}
  function closed(r){return ["approved","superseded"].includes(String(r&&r.status||"").toLowerCase());}
  function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function overdue(r){const x=info(r);return !!x.requiredAtSite&&x.requiredAtSite<today()&&!closed(r);}
  function next14(r){const x=info(r);if(!x.requiredAtSite||closed(r))return false;const a=new Date(today()+"T00:00:00"),b=new Date(a);b.setDate(b.getDate()+14);const d=new Date(x.requiredAtSite+"T00:00:00");return d>=a&&d<=b;}
  function apply(){
    const panel=$("designDashboardPanel");if(!panel)return;
    const rows=currentRows();
    panel.querySelectorAll('.design-category-card').forEach(card=>{
      const title=card.querySelector('.design-category-title');if(!title)return;
      const cat=String(title.textContent||"").trim();const set=rows.filter(r=>mainCategory(r)===cat);
      const total=card.querySelector('.design-category-total');if(total)total.textContent=set.length;
      const mini=card.querySelectorAll('.design-mini');
      const vals=[
        set.filter(r=>String(r.status||"").toLowerCase()==="approved").length,
        set.filter(r=>["submitted","under review","approved with comments","revise & resubmit"].includes(String(r.status||"").toLowerCase())).length,
        set.filter(overdue).length,
        set.filter(r=>String(info(r).priority).toLowerCase()==="critical").length
      ];
      mini.forEach((m,i)=>{const b=m.querySelector('b');if(b&&i<vals.length)b.textContent=vals[i];});
    });
    const inds=panel.querySelectorAll('.design-indicator');
    const vals=[
      rows.filter(r=>["submitted","under review","approved with comments","revise & resubmit"].includes(String(r.status||"").toLowerCase())).length,
      rows.filter(overdue).length,
      rows.filter(r=>info(r).impact==="Site"&&!closed(r)).length,
      rows.filter(next14).length
    ];
    inds.forEach((x,i)=>{const b=x.querySelector('b');if(b&&i<vals.length)b.textContent=vals[i];});
    panel.dataset.currentLogicalCount=String(rows.length);
  }
  let scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;apply();},0);}
  function install(){
    const panel=$("designDashboardPanel");if(!panel){setTimeout(install,200);return;}
    apply();
    new MutationObserver(schedule).observe(panel,{childList:true,subtree:true,characterData:true});
    const tab=$("designDashboardTab");if(tab)tab.addEventListener('click',()=>setTimeout(apply,0));
  }
  window.refreshDesignDashboardCurrentCounts=apply;
  window.addEventListener('load',()=>setTimeout(install,550));
})();