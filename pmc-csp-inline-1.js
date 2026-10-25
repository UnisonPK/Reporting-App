
/* Reporting App - BOQ Smart Import V3.0 - Work Package totals */
(function(){
  "use strict";

  let importRows=[];
  let detectedInfo=null;

  const ALIASES={
    itemNo:["boq code","code no","code number","code","boq item no","item no","item number","no"],
    description:["description specification","description/specification","description","specification","item description"],
    tower:["tower / block","tower/block","tower","block"],
    floor:["floor / area","floor/area","floor","area"],
    contractQty:["qty","qty.","quantity","contract qty","contract quantity"],
    unit:["unit","uom"],
    rate:["rate","unit rate","rate pkr","rate (pkr)"],
    amount:["amount","contract amount","total amount"],
    workPackage:["work package","workpackage","package","category"],
    project:["project","project name"]
  };

  const COMPONENT_ALIASES={
    labor:["labor","labour"],termite:["termite"],ghassu:["ghassu"],cement:["cement"],
    chenab:["chenab"],lpSand:["lp sand","l.p sand","sand"],crush:["crush"],admix:["admix","admixture"],
    plant:["plant &","plant","plant & equipment","plant equipment"],pump:["pump"],form:["form","formwork"],
    steel:["steel"],water:["water"]
  };

  const norm=v=>String(v==null?"":v).replace(/\s+/g," ").trim();
  const canon=v=>norm(v).toLowerCase().replace(/[\n\r]+/g," ").replace(/[_-]+/g," ").replace(/\s+/g," ").replace(/[.:]+$/g,"").trim();
  function num(v){if(typeof v==="number")return v;const s=norm(v).replace(/,/g,"").replace(/\s/g,"");if(!s)return NaN;const n=Number(s);return Number.isFinite(n)?n:NaN;}
  function safe(v){if(typeof window.escapeHtml==="function")return window.escapeHtml(v);return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
  function getMD(){return (typeof masterData!=="undefined"&&masterData)?masterData:{projects:[],towers:[],floors:[]};}

  function aliasMatch(header,aliases){
    const h=canon(header);
    if(!h)return false;
    return aliases.some(a=>{const x=canon(a);return h===x||h.indexOf(x)!==-1;});
  }
  function findColumn(headers,aliases){for(let i=0;i<headers.length;i++){if(aliasMatch(headers[i],aliases))return i;}return -1;}

  function findProjectColumn(headers){
    for(let i=0;i<headers.length;i++){
      const h=canon(headers[i]);
      /* Project must be its own real column header.
         Do NOT match combined title/header text such as
         "One Lake City Project Code". */
      if(h==="project" || h==="project name"){
        return i;
      }
    }
    return -1;
  }
  function projectExists(p){
    const target=canon(p);
    return (getMD().projects||[]).some(
      x=>canon(x["Project Name"])===target
    );
  }
  function towerExists(p,t){
    const projectKey=canon(p);
    const towerKey=canon(t);
    return (getMD().towers||[]).some(
      x=>
        canon(x["Project"])===projectKey &&
        canon(x["Tower / Block"])===towerKey
    );
  }
  function floorExists(p,t,f){
    if(canon(f)==="overall / all floors" || canon(f)==="overall all floors")return true;

    const projectKey=canon(p);
    const towerKey=canon(t);
    const floorKey=canon(f);

    return (getMD().floors||[]).some(x=>{
      const rowProject=canon(x["Project"]);
      return (
        canon(x["Tower / Block"])===towerKey &&
        (!rowProject || rowProject===projectKey) &&
        canon(x["Floor"])===floorKey
      );
    });
  }

  function normalizeImportedTower(project,tower){
    const raw=norm(tower);
    if(!raw)return "";

    const projectKey=canon(project);
    const rawKey=canon(raw);

    const towers=(getMD().towers||[])
      .filter(x=>canon(x["Project"])===projectKey)
      .map(x=>norm(x["Tower / Block"]))
      .filter(Boolean);

    const exact=towers.find(x=>canon(x)===rawKey);
    if(exact)return exact;

    /* Real BOQ uses 1 / 2 while master data uses Tower 1 / Tower 2. */
    if(/^\d+$/.test(raw)){
      const candidate="Tower "+raw;
      const found=towers.find(x=>canon(x)===canon(candidate));
      if(found)return found;
    }

    return raw;
  }

  function normalizeImportedFloor(project,tower,floor){
    const raw=norm(floor);

    if(!raw){
      return "Overall / All Floors";
    }

    const c=canon(raw);

    /* Explicit overall values. */
    if([
      "all",
      "overall",
      "all floor",
      "all floors",
      "overall all floor",
      "overall all floors",
      "overall / all floors"
    ].includes(c)){
      return "Overall / All Floors";
    }

    const projectKey=canon(project);
    const towerKey=canon(tower);

    const floors=(getMD().floors||[])
      .filter(x=>
        (!towerKey || canon(x["Tower / Block"])===towerKey) &&
        (!projectKey || !canon(x["Project"]) || canon(x["Project"])===projectKey)
      )
      .map(x=>norm(x["Floor"]))
      .filter(Boolean);

    /* Priority 1: exact master-data floor match. */
    const exact=floors.find(x=>canon(x)===c);
    if(exact)return exact;

    /* Priority 2: any clear nF reference means nth Floor.
       Examples:
       5F -> 5th Floor
       6 F -> 6th Floor
       5th Slab (4F level) -> 4th Floor
    */
    const fMatch=raw.match(/(?:^|[^0-9])(\d{1,2})\s*F(?:\b|[^A-Za-z])/i);

    if(fMatch){
      const n=Number(fMatch[1]);

      const suffix=
        (n%10===1&&n%100!==11)?"st":
        (n%10===2&&n%100!==12)?"nd":
        (n%10===3&&n%100!==13)?"rd":
        "th";

      const candidate=n+suffix+" Floor";

      const found=floors.find(x=>canon(x)===canon(candidate));
      return found || candidate;
    }

    /* Also accept a simple numeric floor. */
    if(/^\d+$/.test(raw)){
      const n=Number(raw);

      const suffix=
        (n%10===1&&n%100!==11)?"st":
        (n%10===2&&n%100!==12)?"nd":
        (n%10===3&&n%100!==13)?"rd":
        "th";

      const candidate=n+suffix+" Floor";
      const found=floors.find(x=>canon(x)===canon(candidate));
      return found || candidate;
    }

    /* User rule:
       Any other non-standard Floor / Area value is treated as Overall. */
    return "Overall / All Floors";
  }

  function addStyle(){
    if(document.getElementById("boqBulkImportStyle"))return;
    const s=document.createElement("style");s.id="boqBulkImportStyle";s.textContent=`
    .boq-import-btn{border:0;background:#0b3f88;color:#fff;padding:10px 14px;border-radius:8px;font-weight:800;cursor:pointer;margin-left:8px}
    .boq-import-modal{display:none;position:fixed;inset:0;z-index:1600;background:rgba(15,23,42,.62);padding:20px;overflow:auto}
    .boq-import-card{max-width:1180px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25)}
    .boq-import-head{padding:20px 22px;background:#f8fafc;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:15px;align-items:flex-start}
    .boq-import-body{padding:20px 22px}.boq-import-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;align-items:center}
    .boq-import-defaults{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc}
    .boq-import-defaults label{margin-top:0}.boq-import-status{margin:12px 0;font-weight:700}.boq-import-summary{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
    .boq-import-chip{padding:7px 11px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:12px;font-weight:800}.boq-detected{padding:10px 12px;border-radius:10px;background:#ecfdf5;color:#166534;font-size:12px;margin:10px 0}
    .boq-package-summary{margin:12px 0 16px;border:1px solid #dbe3ef;border-radius:12px;overflow:hidden;background:#fff}
    .boq-package-summary-title{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font-weight:900;color:#334155}
    .boq-package-summary-table{width:100%;border-collapse:collapse}
    .boq-package-summary-table th,.boq-package-summary-table td{padding:9px 12px;border-bottom:1px solid #eef2f7;font-size:12px;text-align:left}
    .boq-package-summary-table th{background:#fbfcfe;color:#64748b;font-weight:800}
    .boq-package-summary-table td:last-child,.boq-package-summary-table th:last-child{text-align:right}
    .boq-package-summary-table tr:last-child td{border-bottom:0}
    .boq-package-total-row td{font-weight:900;background:#f8fafc;color:#0b3f88}
    .boq-import-table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:10px;max-height:430px}.boq-import-table{width:100%;border-collapse:collapse;min-width:1150px}
    .boq-import-table th,.boq-import-table td{padding:8px 9px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:left}.boq-import-table th{position:sticky;top:0;background:#f8fafc;z-index:2}
    .boq-import-error{background:#fef2f2;color:#991b1b}.boq-import-valid{background:#f0fdf4}
    @media(max-width:760px){.boq-import-modal{padding:0}.boq-import-card{margin:0;min-height:100vh;border-radius:0}.boq-import-defaults{grid-template-columns:1fr}.boq-import-btn{margin-left:0}}`;
    document.head.appendChild(s);
  }

  function injectSheetJs(){if(window.XLSX)return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";s.onload=resolve;s.onerror=()=>reject(new Error("Unable to load Excel reader library."));document.head.appendChild(s);});}

  function injectUi(){
    addStyle();
    if(!document.getElementById("boqBulkImportModal")){
      const modal=document.createElement("div");modal.id="boqBulkImportModal";modal.className="boq-import-modal";
      modal.innerHTML=`<div class="boq-import-card"><div class="boq-import-head"><div><div style="font-size:22px;font-weight:900">BOQ Smart Excel Import V3.0</div><div style="color:#64748b;margin-top:4px">Automatically detects project BOQ layouts, two-line headers and common column names.</div></div><button class="modal-close" type="button" onclick="closeBOQBulkImport()">Close</button></div>
      <div class="boq-import-body"><div class="module-note"><b>Smart Import V3.0:</b> Mandatory measurable fields remain Code, Description, Work Package, QTY, Unit, Rate and Amount. Project, Tower / Block, Floor / Area and Contractor are optional. Repeated remeasurable rows are retained. The preview now also shows a Work Package Summary with BOQ item count and total amount for each package.</div>
      <div class="boq-import-actions"><input id="boqBulkFile" type="file" accept=".xlsx,.xls" style="max-width:430px"><button class="boq-import-btn" type="button" onclick="previewBOQExcel()">Detect & Preview</button><button id="boqBulkImportNow" class="boq-import-btn" type="button" onclick="commitBOQBulkImport()" disabled>Import Valid Rows</button></div>
      <div class="boq-import-defaults"><div><label>Default Project <span style="font-weight:400;color:#64748b">(optional)</span></label><select id="boqImportProject"><option value="">Auto-detect / Select Project</option></select></div><div><label>Work Package / Category * <span style="font-weight:400;color:#64748b">(used when Excel is blank)</span></label><input id="boqImportPackage" placeholder="e.g. Structural Works"></div><div><label>Contractor</label><input id="boqImportContractor" placeholder="Not Assigned"></div></div>
      <div id="boqDetectedInfo"></div><div id="boqBulkStatus" class="boq-import-status"></div><div id="boqBulkSummary" class="boq-import-summary"></div><div id="boqWorkPackageSummary"></div><div id="boqBulkPreview"></div></div></div>`;
      document.body.appendChild(modal);
    }
  }

  function populateProjectDefaults(){
    const sel=document.getElementById("boqImportProject");if(!sel)return;const current=sel.value;sel.innerHTML='<option value="">Auto-detect / Select Project</option>';
    (getMD().projects||[]).forEach(p=>{const name=norm(p["Project Name"]);if(name){const o=document.createElement("option");o.value=name;o.textContent=name;sel.appendChild(o);}});sel.value=current;
  }

  function readWorkbookArrays(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:"array",cellDates:false});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true});resolve({rows,workbook:wb,sheetName:wb.SheetNames[0]});}catch(err){reject(err);}};reader.onerror=()=>reject(new Error("Unable to read Excel file."));reader.readAsArrayBuffer(file);});}

  function combinedHeaders(rows,rowIndex){const a=rows[rowIndex]||[],b=rows[rowIndex+1]||[],len=Math.max(a.length,b.length);const out=[];for(let i=0;i<len;i++){const x=norm(a[i]),y=norm(b[i]);out.push(x&&y&&!aliasMatch(x,[y])?norm(x+" "+y):(x||y));}return out;}
  function headerScore(headers){let score=0;[ALIASES.itemNo,ALIASES.description,ALIASES.contractQty,ALIASES.unit,ALIASES.rate].forEach(a=>{if(findColumn(headers,a)>=0)score+=2;});[ALIASES.tower,ALIASES.floor,ALIASES.amount,ALIASES.workPackage].forEach(a=>{if(findColumn(headers,a)>=0)score+=1;});if(findProjectColumn(headers)>=0)score+=1;return score;}
  function detectHeader(rows){
    const max=Math.min(rows.length,25);

    /* First preference: a genuine single-row BOQ header.
       This prevents the title row "One Lake City Project" from being
       merged with the Code header below it. */
    let bestSingle={score:-1,rowIndex:-1,headers:[],twoLine:false};

    for(let r=0;r<max;r++){
      const headers=(rows[r]||[]).map(norm);
      const score=headerScore(headers);

      const hasCode=findColumn(headers,ALIASES.itemNo)>=0;
      const hasDescription=findColumn(headers,ALIASES.description)>=0;
      const hasQty=findColumn(headers,ALIASES.contractQty)>=0;
      const hasUnit=findColumn(headers,ALIASES.unit)>=0;
      const hasRate=findColumn(headers,ALIASES.rate)>=0;
      const hasAmount=findColumn(headers,ALIASES.amount)>=0;
      const hasProject=findProjectColumn(headers)>=0;

      if(
        score>bestSingle.score &&
        hasCode &&
        hasDescription &&
        hasQty &&
        hasUnit &&
        hasRate &&
        hasAmount &&
        hasProject
      ){
        bestSingle={
          score:score,
          rowIndex:r,
          headers:headers,
          twoLine:false
        };
      }
    }

    if(bestSingle.rowIndex>=0){
      return bestSingle;
    }

    /* Fallback only for other BOQ formats that genuinely use two
       separate header rows. */
    let best={score:-1,rowIndex:-1,headers:[],twoLine:false};

    for(let r=0;r<max;r++){
      const h1=(rows[r]||[]).map(norm);
      const s1=headerScore(h1);

      if(s1>best.score){
        best={
          score:s1,
          rowIndex:r,
          headers:h1,
          twoLine:false
        };
      }

      const h2=combinedHeaders(rows,r);
      const s2=headerScore(h2);

      if(s2>best.score){
        best={
          score:s2,
          rowIndex:r,
          headers:h2,
          twoLine:true
        };
      }
    }

    if(best.score<7){
      throw new Error(
        "Could not detect the BOQ header row. Expected columns similar to Code, Description, Project, Work Package, Qty, Unit, Rate and Amount."
      );
    }

    return best;
  }

  function inferProject(rows,headerRow){
    const md=getMD();const names=(md.projects||[]).map(x=>norm(x["Project Name"])).filter(Boolean);let text="";
    for(let r=0;r<Math.min(headerRow,12);r++)text+=" "+(rows[r]||[]).map(norm).join(" ");const c=canon(text);
    for(const name of names){const n=canon(name);if(c.indexOf(n)!==-1)return name;if(n==="one lake city"&&c.indexOf("one lake city project")!==-1)return name;}
    return "";
  }

  function mapColumns(headers){
    const map={};
    Object.keys(ALIASES).forEach(k=>map[k]=findColumn(headers,ALIASES[k]));
    map.project=findProjectColumn(headers);
    map.components={};
    Object.keys(COMPONENT_ALIASES).forEach(k=>map.components[k]=findColumn(headers,COMPONENT_ALIASES[k]));
    return map;
  }

  function buildComponentRemark(row,map){const parts=[];Object.keys(map.components).forEach(k=>{const i=map.components[k];if(i>=0&&norm(row[i])!=="")parts.push(k.replace(/([A-Z])/g," $1")+"="+norm(row[i]));});return parts.length?"Cost Components: "+parts.join("; "):"";}
  function isLikelyDataRow(row,map){
    const code=map.itemNo>=0?norm(row[map.itemNo]):"";
    const desc=map.description>=0?norm(row[map.description]):"";
    const qtyRaw=map.contractQty>=0?norm(row[map.contractQty]):"";

    /* Smart Import V2.3 selection rule:
       - Ignore the secondary header row such as "NO." / "SPECIFICATION".
       - Keep row when QTY contains any value, including 0.
       - If QTY is empty, keep row only when BOQ Code contains a value.
       - If both QTY and BOQ Code are empty, discard the row silently.
    */
    const c=canon(code);
    const d=canon(desc);
    if((c==="no"||c==="no."||c==="code no"||c==="code number") &&
       (d==="specification"||d==="description specification")){
      return false;
    }

    return qtyRaw!=="" || code!=="";
  }

  function buildRows(rawRows,detected,defaults){
    const map=mapColumns(detected.headers);
    const start=detected.rowIndex+(detected.twoLine?2:1);
    const out=[];

    let activeCode="";
    let activeContext={
      tower:"",
      floor:"",
      project:"",
      workPackage:""
    };

    const contextByCode={};

    for(let r=start;r<rawRows.length;r++){
      const row=rawRows[r]||[];

      if(!isLikelyDataRow(row,map))continue;

      const rawCode=map.itemNo>=0?norm(row[map.itemNo]):"";
      const qtyRaw=map.contractQty>=0?norm(row[map.contractQty]):"";

      /* Any explicit Code starts/refreshes a BOQ item context. */
      if(rawCode){
        activeCode=rawCode;
      }

      const code=rawCode || (qtyRaw!=="" ? activeCode : "");
      if(!code && qtyRaw==="")continue;

      const excelProject=map.project>=0?norm(row[map.project]):"";
      const excelPackage=map.workPackage>=0?norm(row[map.workPackage]):"";
      const sourceTower=map.tower>=0?norm(row[map.tower]):"";
      const sourceFloor=map.floor>=0?norm(row[map.floor]):"";

      /* Preserve context stated on heading rows such as:
         Code 3 | Site Preparation | Tower 1 | Project One Lake City */
      if(rawCode){
        const prior=contextByCode[rawCode]||{};

        const headingProject=
          excelProject ||
          prior.project ||
          activeContext.project ||
          defaults.project ||
          "";

        const headingTower=
          sourceTower ||
          prior.tower ||
          activeContext.tower ||
          "";

        const headingFloor=
          sourceFloor ||
          prior.floor ||
          activeContext.floor ||
          "";

        const headingPackage=
          excelPackage ||
          prior.workPackage ||
          activeContext.workPackage ||
          defaults.workPackage ||
          "";

        contextByCode[rawCode]={
          project:headingProject,
          tower:headingTower,
          floor:headingFloor,
          workPackage:headingPackage
        };

        activeContext=contextByCode[rawCode];
      }

      const ctx=contextByCode[code]||activeContext||{};

      const resolvedProject=
        excelProject ||
        ctx.project ||
        defaults.project ||
        "";

      const towerRaw=
        sourceTower ||
        ctx.tower ||
        "";

      const normalizedTower=
        normalizeImportedTower(
          resolvedProject,
          towerRaw
        );

      const floorRaw=
        sourceFloor ||
        ctx.floor ||
        "";

      const normalizedFloor=
        normalizeImportedFloor(
          resolvedProject,
          normalizedTower,
          floorRaw
        );

      const resolvedPackage=
        excelPackage ||
        ctx.workPackage ||
        defaults.workPackage ||
        "";

      /* Refresh the context after normalization. */
      if(code){
        contextByCode[code]={
          project:resolvedProject,
          tower:towerRaw,
          floor:floorRaw,
          workPackage:resolvedPackage
        };
        activeContext=contextByCode[code];
      }

      const codeOnlyRow=code!=="" && qtyRaw==="";

      const comp=buildComponentRemark(row,map);

      out.push({
        _row:r+1,
        _codeOnly:codeOnlyRow,

        itemNo:code,
        description:
          map.description>=0
            ? norm(row[map.description])
            : "",

        unit:
          codeOnlyRow
            ? ""
            : (map.unit>=0?norm(row[map.unit]):""),

        contractQty:
          codeOnlyRow
            ? ""
            : (map.contractQty>=0?row[map.contractQty]:""),

        rate:
          codeOnlyRow
            ? ""
            : (map.rate>=0?row[map.rate]:""),

        sourceAmount:
          codeOnlyRow
            ? ""
            : (map.amount>=0?row[map.amount]:""),

        /* As agreed, code-only heading rows display only
           Code, Description and Floor in preview. */
        project:
          codeOnlyRow
            ? ""
            : resolvedProject,

        tower:
          codeOnlyRow
            ? ""
            : normalizedTower,

        floor:
          normalizedFloor,

        workPackage:
          codeOnlyRow
            ? ""
            : resolvedPackage,

        contractor:
          codeOnlyRow
            ? ""
            : (defaults.contractor||"Not Assigned"),

        remarks:
          codeOnlyRow
            ? ""
            : ["Imported by BOQ Smart Import V2.7",comp]
                .filter(Boolean)
                .join(" | ")
      });
    }

    return out;
  }

  function validateRows(rows){
    const seen=new Set();

    return rows.map(r=>{
      const errors=[];
      const warnings=[];
      const codeOnlyRow=!!r.itemNo && norm(r.contractQty)==="";

      r._codeOnly=codeOnlyRow;

      /* Code-only BOQ heading / section row:
         retained for preview context; not treated as a measurable item. */
      if(codeOnlyRow){
        if(!r.itemNo)errors.push("BOQ Code is required");
        if(!r.description)errors.push("Description is required");

        r.contractQty="";
        r.rate="";
        r.amount="";
        r._errors=errors;
        r._warnings=warnings;
        return r;
      }

      /* Mandatory measurable BOQ fields agreed with user. */
      if(!r.itemNo)errors.push("BOQ Code is required");
      if(!r.description)errors.push("Description is required");
      if(!r.workPackage)errors.push("Work Package is required");
      if(norm(r.contractQty)==="")errors.push("Qty is required");
      if(!r.unit)errors.push("Unit is required");
      if(norm(r.rate)==="")errors.push("Rate is required");
      if(norm(r.sourceAmount)==="")errors.push("Amount is required");

      const qty=num(r.contractQty);
      const rate=num(r.rate);
      const sourceAmount=num(r.sourceAmount);

      if(norm(r.contractQty)!=="" && (!Number.isFinite(qty)||qty<0)){
        errors.push("Qty must be a non-negative number");
      }

      if(norm(r.rate)!=="" && (!Number.isFinite(rate)||rate<0)){
        errors.push("Rate must be a non-negative number");
      }

      if(norm(r.sourceAmount)!=="" && (!Number.isFinite(sourceAmount)||sourceAmount<0)){
        errors.push("Amount must be a non-negative number");
      }

      /* Optional fields: do not block import. */
      if(!r.project)warnings.push("Project not assigned");
      if(!r.tower)warnings.push("Tower/Block not assigned");
      if(!r.floor)warnings.push("Floor/Area not assigned");
      if(!r.contractor)warnings.push("Contractor not assigned");

      /* If optional hierarchy fields are present, normalize/validate where possible.
         Invalid optional hierarchy is a warning, not an import-blocking error. */
      if(r.project && !projectExists(r.project)){
        warnings.push("Project not found in master data");
      }

      if(r.project && r.tower && !towerExists(r.project,r.tower)){
        warnings.push("Tower/Block not found in master data");
      }

      if(r.project && r.tower && r.floor && !floorExists(r.project,r.tower,r.floor)){
        warnings.push("Floor/Area not found in master data");
      }

      r.contractQty=Number.isFinite(qty)?qty:0;
      r.rate=Number.isFinite(rate)?Math.round(rate*100)/100:0;

      /* Amount is mandatory in the source workbook.
         We retain the workbook amount, rounded to 2 decimals. */
      r.amount=Number.isFinite(sourceAmount)
        ? Math.round(sourceAmount*100)/100
        : 0;

      r._errors=errors;
      r._warnings=warnings;
      return r;
    });
  }

  function renderWorkPackageSummary(){
    const container=document.getElementById("boqWorkPackageSummary");
    if(!container)return;

    const packageMap={};

    importRows
      .filter(r=>!r._codeOnly && !r._errors.length)
      .forEach(r=>{
        const pkg=norm(r.workPackage)||"Unassigned";
        if(!packageMap[pkg]){
          packageMap[pkg]={
            count:0,
            qty:0,
            amount:0
          };
        }

        packageMap[pkg].count++;
        packageMap[pkg].qty+=(Number(r.contractQty)||0);
        packageMap[pkg].amount+=(Number(r.amount)||0);
      });

    const packages=Object.keys(packageMap).sort((a,b)=>a.localeCompare(b));

    if(!packages.length){
      container.innerHTML="";
      return;
    }

    let grandCount=0;
    let grandAmount=0;

    let html='<div class="boq-package-summary">';
    html+='<div class="boq-package-summary-title">Work Package Summary</div>';
    html+='<table class="boq-package-summary-table"><thead><tr>';
    html+='<th>Work Package</th><th>BOQ Items</th><th>Total Amount (PKR)</th>';
    html+='</tr></thead><tbody>';

    packages.forEach(pkg=>{
      const x=packageMap[pkg];
      grandCount+=x.count;
      grandAmount+=x.amount;

      html+='<tr>';
      html+='<td>'+safe(pkg)+'</td>';
      html+='<td>'+x.count.toLocaleString()+'</td>';
      html+='<td>'+x.amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>';
      html+='</tr>';
    });

    html+='<tr class="boq-package-total-row">';
    html+='<td>GRAND TOTAL</td>';
    html+='<td>'+grandCount.toLocaleString()+'</td>';
    html+='<td>'+grandAmount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>';
    html+='</tr>';

    html+='</tbody></table></div>';

    container.innerHTML=html;
  }

  function renderPreview(){
    const headings=importRows.filter(r=>r._codeOnly).length;
    const measurable=importRows.filter(r=>!r._codeOnly);
    const valid=measurable.filter(r=>!r._errors.length).length;
    const invalid=measurable.filter(r=>r._errors.length).length;
    const total=measurable.reduce((s,r)=>s+(r._errors.length?0:(Number(r.amount)||0)),0);
    document.getElementById("boqBulkSummary").innerHTML=`<span class="boq-import-chip">Rows: ${importRows.length}</span><span class="boq-import-chip">Headings: ${headings}</span><span class="boq-import-chip">Valid Measurable: ${valid}</span><span class="boq-import-chip">Errors: ${invalid}</span><span class="boq-import-chip">Valid Amount: PKR ${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`;
    renderWorkPackageSummary();
    let h='<div class="boq-import-table-wrap"><table class="boq-import-table"><thead><tr><th>Excel Row</th><th>Code</th><th>Description</th><th>Tower</th><th>Floor</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th>Project</th><th>Package</th><th>Validation</th></tr></thead><tbody>';
    importRows.forEach(r=>{
      const codeOnly=!!r._codeOnly;
      const towerCell=codeOnly?"":safe(r.tower);
      const qtyCell=codeOnly?"":r.contractQty;
      const unitCell=codeOnly?"":safe(r.unit);
      const rateCell=codeOnly?"":Number(r.rate||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
      const amountCell=codeOnly?"":Number(r.amount||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
      const projectCell=codeOnly?"":safe(r.project);
      const packageCell=codeOnly?"":safe(r.workPackage);
      h+=`<tr class="${r._errors.length?"boq-import-error":"boq-import-valid"}"><td>${r._row}</td><td><b>${safe(r.itemNo)}</b></td><td>${safe(r.description)}</td><td>${towerCell}</td><td>${safe(r.floor)}</td><td>${qtyCell}</td><td>${unitCell}</td><td>${rateCell}</td><td>${amountCell}</td><td>${projectCell}</td><td>${packageCell}</td><td>${r._errors.length?safe(r._errors.join("; ")):(r._codeOnly?"Heading / Context":((r._warnings||[]).length?"Ready • "+safe(r._warnings.join("; ")):"Ready"))}</td></tr>`;
    });
    document.getElementById("boqBulkPreview").innerHTML=h+'</tbody></table></div>';
  }

  window.openBOQBulkImport=function(){if(typeof hasExecutiveAccess==="function"&&!hasExecutiveAccess()){alert("BOQ & Cost is available to CEO and Project Manager only.");return;}injectUi();populateProjectDefaults();importRows=[];detectedInfo=null;["boqBulkStatus","boqDetectedInfo"].forEach(id=>document.getElementById(id).textContent="");document.getElementById("boqBulkSummary").innerHTML="";document.getElementById("boqWorkPackageSummary").innerHTML="";document.getElementById("boqBulkPreview").innerHTML="";document.getElementById("boqBulkImportNow").disabled=true;document.getElementById("boqBulkImportModal").style.display="block";document.body.style.overflow="hidden";};
  window.closeBOQBulkImport=function(){const m=document.getElementById("boqBulkImportModal");if(m)m.style.display="none";document.body.style.overflow="";};

  window.previewBOQExcel=async function(){
    const file=document.getElementById("boqBulkFile").files[0],status=document.getElementById("boqBulkStatus");if(!file){status.style.color="#dc2626";status.textContent="Select an Excel file first.";return;}
    try{
      status.style.color="#475569";status.textContent="Detecting BOQ structure...";await injectSheetJs();const data=await readWorkbookArrays(file);const detected=detectHeader(data.rows);const inferred=inferProject(data.rows,detected.rowIndex);const selected=norm(document.getElementById("boqImportProject").value);const project=selected||inferred;const pkg=norm(document.getElementById("boqImportPackage").value);const contractor=norm(document.getElementById("boqImportContractor").value)||"Not Assigned";
      if(inferred&&!selected){document.getElementById("boqImportProject").value=inferred;}
      detectedInfo={sheetName:data.sheetName,headerRow:detected.rowIndex+1,twoLine:detected.twoLine,headers:detected.headers,project:project};
      document.getElementById("boqDetectedInfo").innerHTML=`<div class="boq-detected"><b>Detected:</b> Sheet “${safe(data.sheetName)}”, header row ${detected.rowIndex+1}${detected.twoLine?" + next row":""}${project?", Project: "+safe(project):""}. Recognized columns: ${safe(detected.headers.filter(Boolean).join(" | "))}</div>`;
      importRows=validateRows(buildRows(data.rows,detected,{project:project,workPackage:pkg,contractor:contractor}));renderPreview();const measurable=importRows.filter(r=>!r._codeOnly);const valid=measurable.filter(r=>!r._errors.length).length,invalid=measurable.filter(r=>r._errors.length).length;const headings=importRows.filter(r=>r._codeOnly).length;status.style.color=invalid?"#b45309":"#166534";status.textContent=invalid?`${valid} measurable row(s) ready, ${invalid} measurable row(s) need correction; ${headings} heading/context row(s) retained in preview.`:`${valid} measurable row(s) validated and ready to import; ${headings} heading/context row(s) retained in preview.`;document.getElementById("boqBulkImportNow").disabled=valid===0;
    }catch(err){importRows=[];status.style.color="#dc2626";status.textContent=err.message;document.getElementById("boqBulkImportNow").disabled=true;}
  };

  window.commitBOQBulkImport=function(){
    const validRows=importRows.filter(r=>!r._errors.length&&!r._codeOnly).map(r=>({itemNo:r.itemNo,description:r.description,unit:r.unit,contractQty:r.contractQty,rate:r.rate,amount:r.amount,project:r.project||"",tower:r.tower||"",floor:r.floor||"",workPackage:r.workPackage,contractor:r.contractor||"",status:"Active",certifiedQty:0,paidAmount:0,variationAmount:0,remarks:r.remarks}));if(!validRows.length)return;
    const btn=document.getElementById("boqBulkImportNow"),status=document.getElementById("boqBulkStatus");btn.disabled=true;status.style.color="#475569";status.textContent="Importing validated BOQ rows...";
    if(!window.LCRG_API||typeof window.LCRG_API.call!=="function"){btn.disabled=false;status.style.color="#dc2626";status.textContent="Reporting App API is not available.";return;}
    window.LCRG_API.call("bulkImportBOQ",{rows:validRows}).then(result=>{status.style.color=result.skipped>0?"#b45309":"#166534";status.textContent=`Import complete: ${result.imported} imported, ${result.skipped} duplicate/skipped.`;btn.disabled=false;if(typeof loadBOQCost==="function")loadBOQCost();}).catch(err=>{btn.disabled=false;status.style.color="#dc2626";status.textContent=err.message;});
  };

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",injectUi);else injectUi();
})();

