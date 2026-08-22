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

    const s=document.createElement("style");
    s.id="boqBulkImportStyle";
    s.textContent=`
    .boq-import-btn{border:0;background:#0b3f88;color:#fff;padding:10px 14px;border-radius:8px;font-weight:800;cursor:pointer;margin-left:8px}
    .boq-import-modal{display:none;position:fixed;inset:0;z-index:1600;background:rgba(15,23,42,.62);padding:20px;overflow:auto}
    .boq-import-card{max-width:1180px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25)}
    .boq-import-head{padding:20px 22px;background:#f8fafc;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:15px;align-items:flex-start}
    .boq-import-body{padding:20px 22px}
    .boq-import-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;align-items:center}
    .boq-import-defaults{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc}
    .boq-import-defaults label{margin-top:0}
    .boq-import-status{margin:12px 0;font-weight:700}
    .boq-import-summary{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
    .boq-import-chip{padding:7px 11px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:12px;font-weight:800}
    .boq-detected{padding:10px 12px;border-radius:10px;background:#ecfdf5;color:#166534;font-size:12px;margin:10px 0}
    .boq-package-summary{margin:12px 0 16px;border:1px solid #dbe3ef;border-radius:12px;overflow:hidden;background:#fff}
    .boq-package-summary-title{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font-weight:900;color:#334155}
    .boq-package-summary-table{width:100%;border-collapse:collapse}
    .boq-package-summary-table th,.boq-package-summary-table td{padding:9px 12px;border-bottom:1px solid #eef2f7;font-size:12px;text-align:left}
    .boq-package-summary-table th{background:#fbfcfe;color:#64748b;font-weight:800}
    .boq-package-summary-table td:last-child,.boq-package-summary-table th:last-child{text-align:right}
    .boq-package-summary-table tr:last-child td{border-bottom:0}
    .boq-package-total-row td{font-weight:900;background:#f8fafc;color:#0b3f88}
    .boq-import-table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:10px;max-height:430px}
    .boq-import-table{width:100%;border-collapse:collapse;min-width:1150px}
    .boq-import-table th,.boq-import-table td{padding:8px 9px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:left}
    .boq-import-table th{position:sticky;top:0;background:#f8fafc;z-index:2}
    .boq-import-error{background:#fef2f2;color:#991b1b}
    .boq-import-valid{background:#f0fdf4}
    @media(max-width:760px){
      .boq-import-modal{padding:0}
      .boq-import-card{margin:0;min-height:100vh;border-radius:0}
      .boq-import-defaults{grid-template-columns:1fr}
      .boq-import-btn{margin-left:0}
    }`;

    document.head.appendChild(s);
  }

  function injectSheetJs(){
    if(window.XLSX)return Promise.resolve();

    return new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.onload=resolve;
      s.onerror=()=>reject(new Error("Unable to load Excel reader library."));
      document.head.appendChild(s);
    });
  }

  function injectUi(){
    addStyle();

    if(!document.getElementById("boqBulkImportModal")){
      const modal=document.createElement("div");
      modal.id="boqBulkImportModal";
      modal.className="boq-import-modal";

      modal.innerHTML=`
      <div class="boq-import-card">
        <div class="boq-import-head">
          <div>
            <div style="font-size:22px;font-weight:900">
              BOQ Smart Excel Import V3.0
            </div>
            <div style="color:#64748b;margin-top:4px">
              Automatically detects project BOQ layouts, two-line headers and common column names.
            </div>
          </div>
          <button class="modal-close" type="button" onclick="closeBOQBulkImport()">Close</button>
        </div>

        <div class="boq-import-body">
          <div class="module-note">
            <b>Smart Import V3.0:</b>
            Mandatory measurable fields remain Code, Description, Work Package,
            QTY, Unit, Rate and Amount. Project, Tower / Block, Floor / Area
            and Contractor are optional. Repeated remeasurable rows are retained.
            The preview now also shows a Work Package Summary with BOQ item count
            and total amount for each package.
          </div>

          <div class="boq-import-actions">
            <input id="boqBulkFile" type="file" accept=".xlsx,.xls" style="max-width:430px">
            <button class="boq-import-btn" type="button" onclick="previewBOQExcel()">
              Detect & Preview
            </button>
            <button id="boqBulkImportNow" class="boq-import-btn" type="button"
                    onclick="commitBOQBulkImport()" disabled>
              Import Valid Rows
            </button>
          </div>

          <div class="boq-import-defaults">
            <div>
              <label>
                Default Project
                <span style="font-weight:400;color:#64748b">(optional)</span>
              </label>
              <select id="boqImportProject">
                <option value="">Auto-detect / Select Project</option>
              </select>
            </div>

            <div>
              <label>
                Work Package / Category *
                <span style="font-weight:400;color:#64748b">
                  (used when Excel is blank)
                </span>
              </label>
              <input id="boqImportPackage" placeholder="e.g. Structural Works">
            </div>

            <div>
              <label>Contractor</label>
              <input id="boqImportContractor" placeholder="Not Assigned">
            </div>
          </div>

          <div id="boqDetectedInfo"></div>
          <div id="boqBulkStatus" class="boq-import-status"></div>
          <div id="boqBulkSummary" class="boq-import-summary"></div>
          <div id="boqWorkPackageSummary"></div>
          <div id="boqBulkPreview"></div>
        </div>
      </div>`;

      document.body.appendChild(modal);
    }
  }

  function populateProjectDefaults(){
    const sel=document.getElementById("boqImportProject");
    if(!sel)return;

    const current=sel.value;

    sel.innerHTML=
      '<option value="">Auto-detect / Select Project</option>';

    (getMD().projects||[]).forEach(p=>{
      const name=norm(p["Project Name"]);

      if(name){
        const o=document.createElement("option");
        o.value=name;
        o.textContent=name;
        sel.appendChild(o);
      }
    });

    sel.value=current;
  }

  function readWorkbookArrays(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();

      reader.onload=e=>{
        try{
          const wb=XLSX.read(
            e.target.result,
            {type:"array",cellDates:false}
          );

          const ws=wb.Sheets[wb.SheetNames[0]];

          const rows=XLSX.utils.sheet_to_json(
            ws,
            {
              header:1,
              defval:"",
              raw:true
            }
          );

          resolve({
            rows,
            workbook:wb,
            sheetName:wb.SheetNames[0]
          });

        }catch(err){
          reject(err);
        }
      };

      reader.onerror=()=>
        reject(new Error("Unable to read Excel file."));

      reader.readAsArrayBuffer(file);
    });
  }

  function combinedHeaders(rows,rowIndex){
    const a=rows[rowIndex]||[];
    const b=rows[rowIndex+1]||[];
    const len=Math.max(a.length,b.length);
    const out=[];

    for(let i=0;i<len;i++){
      const x=norm(a[i]);
      const y=norm(b[i]);

      out.push(
        x&&y&&!aliasMatch(x,[y])
          ?norm(x+" "+y)
          :(x||y)
      );
    }

    return out;
  }

  function headerScore(headers){
    let score=0;

    [
      ALIASES.itemNo,
      ALIASES.description,
      ALIASES.contractQty,
      ALIASES.unit,
      ALIASES.rate
    ].forEach(a=>{
      if(findColumn(headers,a)>=0)score+=2;
    });

    [
      ALIASES.tower,
      ALIASES.floor,
      ALIASES.amount,
      ALIASES.workPackage
    ].forEach(a=>{
      if(findColumn(headers,a)>=0)score+=1;
    });

    if(findProjectColumn(headers)>=0)score+=1;

    return score;
  }

  function detectHeader(rows){
    const max=Math.min(rows.length,25);

    /* First preference: a genuine single-row BOQ header.
       This prevents the title row "One Lake City Project" from being
       merged with the Code header below it. */
    let bestSingle={
      score:-1,
      rowIndex:-1,
      headers:[],
      twoLine:false
    };

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
    let best={
      score:-1,
      rowIndex:-1,
      headers:[],
      twoLine:false
    };

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
    const md=getMD();
    const names=(md.projects||[])
      .map(x=>norm(x["Project Name"]))
      .filter(Boolean);

    let text="";

    for(let r=0;r<Math.min(headerRow,12);r++){
      text+=" "+(rows[r]||[]).map(norm).join(" ");
    }

    const c=canon(text);

    for(const name of names){
      const n=canon(name);

      if(c.indexOf(n)!==-1)return name;

      if(
        n==="one lake city" &&
        c.indexOf("one lake city project")!==-1
      ){
        return name;
      }
    }

    return "";
  }

  function mapColumns(headers){
    const map={};

    Object.keys(ALIASES).forEach(
      k=>map[k]=findColumn(headers,ALIASES[k])
    );

    map.project=findProjectColumn(headers);

    map.components={};

    Object.keys(COMPONENT_ALIASES).forEach(
      k=>map.components[k]=findColumn(
        headers,
        COMPONENT_ALIASES[k]
      )
    );

    return map;
  }

  function buildComponentRemark(row,map){
    const parts=[];

    Object.keys(map.components).forEach(k=>{
      const i=map.components[k];

      if(i>=0&&norm(row[i])!==""){
        parts.push(
          k.replace(/([A-Z])/g," $1")+
          "="+
          norm(row[i])
        );
      }
    });

    return parts.length
      ?"Cost Components: "+parts.join("; ")
      :"";
  }

  function isLikelyDataRow(row,map){
    const code=
      map.itemNo>=0
        ?norm(row[map.itemNo])
        :"";

    const desc=
      map.description>=0
        ?norm(row[map.description])
        :"";

    const qtyRaw=
      map.contractQty>=0
        ?norm(row[map.contractQty])
        :"";

    /* Smart Import V2.3 selection rule:
       - Ignore the secondary header row such as "NO." / "SPECIFICATION".
       - Keep row when QTY contains any value, including 0.
       - If QTY is empty, keep row only when BOQ Code contains a value.
       - If both QTY and BOQ Code are empty, discard the row silently.
    */
    const c=canon(code);
    const d=canon(desc);

    if(
      (c==="no"||c==="no."||c==="code no"||c==="code number") &&
      (d==="specification"||d==="description specification")
    ){
      return false;
    }

    return qtyRaw!=="" || code!=="";
  }

  function buildRows(rawRows,detected,defaults){
    const map=mapColumns(detected.headers);

    const start=
      detected.rowIndex+
      (detected.twoLine?2:1);

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

      const rawCode=
        map.itemNo>=0
          ?norm(row[map.itemNo])
          :"";

      const qtyRaw=
        map.contractQty>=0
          ?norm(row[map.contractQty])
          :"";

      /* Any explicit Code starts/refreshes a BOQ item context. */
      if(rawCode){
        activeCode=rawCode;
      }

      const code=
        rawCode ||
        (qtyRaw!=="" ? activeCode : "");

      if(!code && qtyRaw==="")continue;

      const excelProject=
        map.project>=0
          ?norm(row[map.project])
          :"";

      const excelPackage=
        map.workPackage>=0
          ?norm(row[map.workPackage])
          :"";
            let project=
        excelProject ||
        activeContext.project ||
        defaults.project ||
        detected.inferredProject ||
        "";

      let tower=
        map.tower>=0
          ?norm(row[map.tower])
          :"";

      let floor=
        map.floor>=0
          ?norm(row[map.floor])
          :"";

      let workPackage=
        excelPackage ||
        activeContext.workPackage ||
        defaults.workPackage ||
        "";

      /*
       * When a row contains a new explicit context value,
       * retain it for subsequent measurable rows.
       */
      if(excelProject){
        activeContext.project=excelProject;
      }

      if(tower){
        activeContext.tower=tower;
      }

      if(floor){
        activeContext.floor=floor;
      }

      if(excelPackage){
        activeContext.workPackage=excelPackage;
      }

      if(!project){
        project=activeContext.project||"";
      }

      if(!tower){
        tower=activeContext.tower||"";
      }

      if(!floor){
        floor=activeContext.floor||"";
      }

      if(!workPackage){
        workPackage=activeContext.workPackage||"";
      }

      /*
       * Preserve context against the BOQ code. This is useful where
       * subsequent rows repeat quantities but omit location fields.
       */
      if(rawCode){
        contextByCode[rawCode]={
          project:project,
          tower:tower,
          floor:floor,
          workPackage:workPackage
        };
      }else if(code && contextByCode[code]){
        const saved=contextByCode[code];

        if(!project){
          project=saved.project||"";
        }

        if(!tower){
          tower=saved.tower||"";
        }

        if(!floor){
          floor=saved.floor||"";
        }

        if(!workPackage){
          workPackage=saved.workPackage||"";
        }
      }

      tower=normalizeImportedTower(
        project,
        tower
      );

      floor=normalizeImportedFloor(
        project,
        tower,
        floor
      );

      const description=
        map.description>=0
          ?norm(row[map.description])
          :"";

      const unit=
        map.unit>=0
          ?norm(row[map.unit])
          :"";

      const rateRaw=
        map.rate>=0
          ?norm(row[map.rate])
          :"";

      const amountRaw=
        map.amount>=0
          ?norm(row[map.amount])
          :"";

      const qtyNumber=num(qtyRaw);
      const rateNumber=num(rateRaw);
      const amountNumber=num(amountRaw);

      /*
       * If Qty is empty, Qty / Rate / Amount must remain empty.
       * This preserves BOQ heading / descriptive rows instead of
       * displaying artificial zeros.
       */
      const hasQty=qtyRaw!=="";

      const contractQty=
        hasQty && Number.isFinite(qtyNumber)
          ?qtyNumber
          :(hasQty?qtyRaw:"");

      const rate=
        hasQty && Number.isFinite(rateNumber)
          ?Number(rateNumber.toFixed(2))
          :(hasQty?rateRaw:"");

      let amount="";

      if(hasQty){
        if(Number.isFinite(amountNumber)){
          amount=Number(amountNumber.toFixed(2));
        }else if(
          Number.isFinite(qtyNumber) &&
          Number.isFinite(rateNumber)
        ){
          amount=Number(
            (qtyNumber*rateNumber).toFixed(2)
          );
        }else{
          amount=amountRaw;
        }
      }

      const contractor=
        defaults.contractor||"";

      const componentRemark=
        buildComponentRemark(
          row,
          map
        );

      const errors=[];

      /*
       * Mandatory BOQ structure.
       * Code and Description identify the item.
       * Work Package, Qty, Unit, Rate and Amount are mandatory
       * for measurable rows.
       */
      if(!code){
        errors.push("BOQ Code missing");
      }

      if(!description){
        errors.push("Description missing");
      }

      if(!project){
        errors.push("Project missing");
      }else if(!projectExists(project)){
        errors.push(
          "Project not found in Master Data"
        );
      }

      if(!tower){
        errors.push("Tower / Block missing");
      }else if(
        project &&
        projectExists(project) &&
        !towerExists(project,tower)
      ){
        errors.push(
          "Tower / Block not found in Master Data"
        );
      }

      if(
        floor &&
        project &&
        tower &&
        projectExists(project) &&
        towerExists(project,tower) &&
        !floorExists(project,tower,floor)
      ){
        errors.push(
          "Floor / Area not found in Master Data"
        );
      }

      /*
       * A BOQ row with Code but no Qty is deliberately retained as
       * a descriptive/header row. Qty, Unit, Rate and Amount are
       * therefore not validated as measurable values in that case.
       */
      if(hasQty){
        if(!workPackage){
          errors.push(
            "Work Package missing"
          );
        }

        if(!unit){
          errors.push("Unit missing");
        }

        if(
          qtyRaw!=="" &&
          !Number.isFinite(qtyNumber)
        ){
          errors.push("Invalid Qty");
        }

        if(rateRaw===""){
          errors.push("Rate missing");
        }else if(!Number.isFinite(rateNumber)){
          errors.push("Invalid Rate");
        }

        if(amountRaw!=="" && !Number.isFinite(amountNumber)){
          errors.push("Invalid Amount");
        }

        if(
          amountRaw==="" &&
          !(
            Number.isFinite(qtyNumber) &&
            Number.isFinite(rateNumber)
          )
        ){
          errors.push("Amount missing");
        }
      }

      out.push({
        sourceRow:r+1,
        itemNo:code,
        description:description,
        project:project,
        tower:tower,
        floor:floor,
        contractQty:contractQty,
        unit:hasQty?unit:"",
        rate:hasQty?rate:"",
        amount:hasQty?amount:"",
        workPackage:workPackage,
        contractor:contractor,
        remarks:componentRemark,
        measurable:hasQty,
        errors:errors
      });
    }

    return out;
  }

  function getValidRows(){
    return importRows.filter(
      r=>!r.errors.length
    );
  }

  function getInvalidRows(){
    return importRows.filter(
      r=>r.errors.length
    );
  }

  function money(v){
    const n=Number(v);

    if(!Number.isFinite(n)){
      return norm(v);
    }

    return n.toLocaleString(
      undefined,
      {
        minimumFractionDigits:2,
        maximumFractionDigits:2
      }
    );
  }

  function renderDetected(){
    const box=document.getElementById(
      "boqDetectedInfo"
    );

    if(!box)return;

    if(!detectedInfo){
      box.innerHTML="";
      return;
    }

    const d=detectedInfo;

    box.innerHTML=`
      <div class="boq-detected">
        <b>Detected:</b>
        Sheet:
        ${safe(d.sheetName)}
        &nbsp;•&nbsp;
        Header Row:
        ${d.headerRow}
        &nbsp;•&nbsp;
        Header Type:
        ${d.twoLine?"Two-line":"Single-line"}
        &nbsp;•&nbsp;
        Project:
        ${safe(d.inferredProject||"Not detected")}
      </div>
    `;
  }

  function renderSummary(){
    const box=document.getElementById(
      "boqBulkSummary"
    );

    if(!box)return;

    const valid=getValidRows();
    const invalid=getInvalidRows();

    const measurable=
      importRows.filter(
        r=>r.measurable
      ).length;

    const headings=
      importRows.length-measurable;

    box.innerHTML=`
      <div class="boq-import-chip">
        ${importRows.length} Rows Detected
      </div>

      <div class="boq-import-chip">
        ${valid.length} Valid
      </div>

      <div class="boq-import-chip"
           style="${
             invalid.length
               ?"background:#fee2e2;color:#991b1b"
               :"background:#dcfce7;color:#166534"
           }">
        ${invalid.length} With Errors
      </div>

      <div class="boq-import-chip">
        ${measurable} Measurable
      </div>

      <div class="boq-import-chip">
        ${headings} Descriptive
      </div>
    `;

    const btn=document.getElementById(
      "boqBulkImportNow"
    );

    if(btn){
      btn.disabled=!valid.length;
    }
  }

  function buildPackageSummary(){
    const rows=getValidRows();

    const summary={};

    rows.forEach(r=>{
      /*
       * Descriptive BOQ rows are retained in the import but should
       * not artificially increase measurable Work Package totals.
       */
      if(!r.measurable)return;

      const key=
        norm(r.workPackage)||
        "Unspecified";

      if(!summary[key]){
        summary[key]={
          count:0,
          amount:0
        };
      }

      summary[key].count++;

      const a=Number(r.amount);

      if(Number.isFinite(a)){
        summary[key].amount+=a;
      }
    });

    return summary;
  }

  function renderPackageSummary(){
    const box=document.getElementById(
      "boqWorkPackageSummary"
    );

    if(!box)return;

    const summary=buildPackageSummary();
    const names=Object.keys(summary);

    if(!names.length){
      box.innerHTML="";
      return;
    }

    names.sort(
      (a,b)=>a.localeCompare(b)
    );

    let grandCount=0;
    let grandAmount=0;

    names.forEach(name=>{
      grandCount+=summary[name].count;
      grandAmount+=summary[name].amount;
    });

    box.innerHTML=`
      <div class="boq-package-summary">
        <div class="boq-package-summary-title">
          Work Package Summary
        </div>

        <table class="boq-package-summary-table">
          <thead>
            <tr>
              <th>Work Package</th>
              <th>BOQ Items</th>
              <th>Total Amount</th>
            </tr>
          </thead>

          <tbody>
            ${names.map(name=>`
              <tr>
                <td>${safe(name)}</td>
                <td>${summary[name].count}</td>
                <td>${money(summary[name].amount)}</td>
              </tr>
            `).join("")}

            <tr class="boq-package-total-row">
              <td>Grand Total</td>
              <td>${grandCount}</td>
              <td>${money(grandAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPreview(){
    const box=document.getElementById(
      "boqBulkPreview"
    );

    if(!box)return;

    if(!importRows.length){
      box.innerHTML="";
      return;
    }

    const rows=importRows.slice(0,300);

    box.innerHTML=`
      <div class="boq-import-table-wrap">
        <table class="boq-import-table">
          <thead>
            <tr>
              <th>Excel Row</th>
              <th>Code</th>
              <th>Description</th>
              <th>Project</th>
              <th>Tower</th>
              <th>Floor / Area</th>
              <th>Work Package</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Rate</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            ${rows.map(r=>`
              <tr class="${
                r.errors.length
                  ?"boq-import-error"
                  :"boq-import-valid"
              }">
                <td>${r.sourceRow}</td>
                <td>${safe(r.itemNo)}</td>
                <td>${safe(r.description)}</td>
                <td>${safe(r.project)}</td>
                <td>${safe(r.tower)}</td>
                <td>${safe(r.floor)}</td>
                <td>${safe(r.workPackage)}</td>
                <td>${
                  r.contractQty===""
                    ?""
                    :safe(r.contractQty)
                }</td>
                <td>${safe(r.unit)}</td>
                <td>${
                  r.rate===""
                    ?""
                    :money(r.rate)
                }</td>
                <td>${
                  r.amount===""
                    ?""
                    :money(r.amount)
                }</td>
                <td>
                  ${
                    r.errors.length
                      ?safe(r.errors.join("; "))
                      :"Ready"
                  }
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      ${
        importRows.length>300
          ?'<div style="margin-top:8px;color:#64748b;font-size:12px">Preview limited to first 300 rows. All valid rows will still be imported.</div>'
          :""
      }
    `;
  }

  function renderAll(){
    renderDetected();
    renderSummary();
    renderPackageSummary();
    renderPreview();
  }

  window.openBOQBulkImport=function(){
    injectUi();
    populateProjectDefaults();

    const modal=document.getElementById(
      "boqBulkImportModal"
    );

    if(modal){
      modal.style.display="block";
    }

    const status=document.getElementById(
      "boqBulkStatus"
    );

    if(status){
      status.textContent="";
    }
  };

  window.closeBOQBulkImport=function(){
    const modal=document.getElementById(
      "boqBulkImportModal"
    );

    if(modal){
      modal.style.display="none";
    }
  };

  window.previewBOQExcel=async function(){
    const fileInput=document.getElementById(
      "boqBulkFile"
    );

    const status=document.getElementById(
      "boqBulkStatus"
    );

    if(!fileInput||!fileInput.files||!fileInput.files[0]){
      if(status){
        status.style.color="#b91c1c";
        status.textContent=
          "Please select an Excel BOQ file.";
      }
      return;
    }

    if(status){
      status.style.color="#475569";
      status.textContent=
        "Reading Excel file and detecting BOQ structure...";
    }

    try{
      await injectSheetJs();

      const result=await readWorkbookArrays(
        fileInput.files[0]
      );

      const detected=detectHeader(
        result.rows
      );

      const inferredProject=inferProject(
        result.rows,
        detected.rowIndex
      );

      detectedInfo={
        sheetName:result.sheetName,
        headerRow:detected.rowIndex+1,
        twoLine:detected.twoLine,
        inferredProject:inferredProject
      };

      const defaults={
        project:norm(
          document.getElementById(
            "boqImportProject"
          ).value
        ),
        workPackage:norm(
          document.getElementById(
            "boqImportPackage"
          ).value
        ),
        contractor:norm(
          document.getElementById(
            "boqImportContractor"
          ).value
        )
      };

      /*
       * If the project was detected from the BOQ title/header and the
       * user did not manually select a default, use the detected value.
       */
      if(
        !defaults.project &&
        inferredProject
      ){
        defaults.project=inferredProject;

        const projectSelect=
          document.getElementById(
            "boqImportProject"
          );

        if(projectSelect){
          projectSelect.value=
            inferredProject;
        }
      }

      importRows=buildRows(
        result.rows,
        detected,
        defaults
      );

      renderAll();

      const valid=getValidRows();
      const invalid=getInvalidRows();

      if(status){
        if(valid.length){
          status.style.color="#166534";
          status.textContent=
            "Preview ready. "+
            valid.length+
            " valid row(s) can be imported"+
            (
              invalid.length
                ?" and "+invalid.length+" row(s) need attention."
                :"."
            );
        }else{
          status.style.color="#b91c1c";
          status.textContent=
            "No valid BOQ rows were detected.";
        }
      }

    }catch(err){
      importRows=[];
      detectedInfo=null;
      renderAll();

      if(status){
        status.style.color="#b91c1c";
        status.textContent=
          err&&err.message
            ?err.message
            :String(err);
      }
    }
  };

  function buildImportPayload(row){
    return {
      itemNo:row.itemNo,
      description:row.description,
      project:row.project,
      tower:row.tower,
      floor:row.floor,
      contractQty:row.contractQty,
      unit:row.unit,
      rate:row.rate,
      amount:row.amount,
      workPackage:row.workPackage,
      contractor:row.contractor,
      remarks:row.remarks,
      status:"Budgeted"
    };
  }

  function saveSingleBOQRow(payload){
    if(
      window.LCRG_API &&
      typeof LCRG_API.apiRequest==="function"
    ){
      return LCRG_API.apiRequest(
        "saveBOQCost",
        payload
      );
    }

    return Promise.reject(
      new Error(
        "BOQ API is not available."
      )
    );
  }

  async function saveRowsSequentially(rows,onProgress){
    const results=[];

    for(let i=0;i<rows.length;i++){
      const row=rows[i];

      try{
        const response=
          await saveSingleBOQRow(
            buildImportPayload(row)
          );

        results.push({
          ok:true,
          row:row,
          response:response
        });

      }catch(err){
        results.push({
          ok:false,
          row:row,
          error:
            err&&err.message
              ?err.message
              :String(err)
        });
      }

      if(typeof onProgress==="function"){
        onProgress(
          i+1,
          rows.length,
          results
        );
      }
    }

    return results;
  }

  window.commitBOQBulkImport=async function(){
    const valid=getValidRows();

    const status=document.getElementById(
      "boqBulkStatus"
    );

    const btn=document.getElementById(
      "boqBulkImportNow"
    );

    if(!valid.length){
      if(status){
        status.style.color="#b91c1c";
        status.textContent=
          "There are no valid rows to import.";
      }
      return;
    }

    const confirmed=window.confirm(
      "Import "+
      valid.length+
      " valid BOQ row(s)?\n\n"+
      "Repeated remeasurable BOQ rows will be retained."
    );

    if(!confirmed)return;

    if(btn){
      btn.disabled=true;
    }

    if(status){
      status.style.color="#475569";
      status.textContent=
        "Starting BOQ import...";
    }

    try{
      const results=
        await saveRowsSequentially(
          valid,
          (done,total)=>{
            if(status){
              status.style.color="#475569";
              status.textContent=
                "Importing BOQ rows... "+
                done+
                " / "+
                total;
            }
          }
        );

      const success=
        results.filter(x=>x.ok);

      const failed=
        results.filter(x=>!x.ok);

      if(status){
        if(failed.length){
          status.style.color="#b45309";
          status.textContent=
            success.length+
            " row(s) imported successfully. "+
            failed.length+
            " row(s) failed.";
        }else{
          status.style.color="#166534";
          status.textContent=
            success.length+
            " BOQ row(s) imported successfully.";
        }
      }

      if(failed.length){
        failed.forEach(x=>{
          const target=importRows.find(
            r=>r===x.row
          );

          if(target){
            target.errors.push(
              "Import failed: "+x.error
            );
          }
        });

        renderAll();
      }

      /*
       * Refresh the BOQ module using the existing application
       * function after successful import.
       */
      if(
        success.length &&
        typeof window.loadBOQCost==="function"
      ){
        window.loadBOQCost();
      }

    }catch(err){
      if(status){
        status.style.color="#b91c1c";
        status.textContent=
          err&&err.message
            ?err.message
            :String(err);
      }

    }finally{
      if(btn){
        btn.disabled=
          !getValidRows().length;
      }
    }
  };

  function installImportButton(){
    injectUi();

    const addButton=
      Array.from(
        document.querySelectorAll("button")
      ).find(btn=>
        canon(btn.textContent)
          .includes("add boq")
      );

    if(
      addButton &&
      !document.getElementById(
        "boqSmartImportButton"
      )
    ){
      const b=document.createElement(
        "button"
      );

      b.id="boqSmartImportButton";
      b.type="button";
      b.className="boq-import-btn";
      b.textContent="Smart Excel Import";
      b.onclick=window.openBOQBulkImport;

      addButton.insertAdjacentElement(
        "afterend",
        b
      );
    }
  }

  function bootImport(){
    injectUi();
    installImportButton();

    /*
     * The BOQ page can be opened later without a page reload,
     * therefore retry briefly so the import button remains available.
     */
    let tries=0;

    const timer=setInterval(()=>{
      tries++;
      installImportButton();

      if(
        document.getElementById(
          "boqSmartImportButton"
        ) ||
        tries>30
      ){
        clearInterval(timer);
      }
    },500);
  }

  if(
    document.readyState==="loading"
  ){
    document.addEventListener(
      "DOMContentLoaded",
      bootImport
    );
  }else{
    bootImport();
  }

})();
let loggedInUser=null,masterData=null,currentStep=0,myReportsData=[],currentReportActivityId="";

function value(id){return document.getElementById(id).value.trim()}
function togglePassword(){let p=document.getElementById("password"),t=document.getElementById("passwordToggle");p.type=p.type==="password"?"text":"password";t.innerText=p.type==="password"?"Show":"Hide"}

function normalizeRole(role){
  return String(role||"").trim().toLowerCase();
}

function hasFullAccess(){
  if(!loggedInUser)return false;
  return [
    "admin",
    "ceo",
    "project manager",
    "construction manager",
    "planning engineer",
    "mep manager"
  ].includes(normalizeRole(loggedInUser.role));
}

function hasExecutiveAccess(){
  if(!loggedInUser)return false;
  return ["ceo","project manager"].includes(normalizeRole(loggedInUser.role));
}

function hasAdministrationAccess(){
  if(!loggedInUser)return false;
  return ["admin","project manager"].includes(normalizeRole(loggedInUser.role));
}

function applyRoleAccess(){
  const adminCard=document.getElementById("adminCard");
  const executiveCard=document.getElementById("executiveReportCard");
  const projectControlsSection=document.getElementById("projectControlsDashboardSection");
  const adminSection=document.getElementById("administrationDashboardSection");
  const siteOperationsSection=document.getElementById("siteOperationsDashboardSection");
  const isCEO=normalizeRole(loggedInUser&&loggedInUser.role)==="ceo";
  if(siteOperationsSection)siteOperationsSection.style.display="block";
  if(adminCard)adminCard.style.display=hasAdministrationAccess()?"block":"none";
  if(adminSection)adminSection.style.display=hasAdministrationAccess()?"block":"none";
  if(projectControlsSection)projectControlsSection.style.display=hasExecutiveAccess()?"block":"none";
  if(executiveCard)executiveCard.style.display=hasExecutiveAccess()?"block":"none";

  const reportTitle=document.querySelector("#myReportsPage .step-title");
  const reportSubtitle=document.querySelector("#myReportsPage .step-subtitle");
  if(reportTitle)reportTitle.innerText=hasFullAccess()?"Activity Reports":"My Activity Reports";
  if(reportSubtitle)reportSubtitle.innerText=hasFullAccess()
    ?"Search and filter all submitted reports. Click View for full details and photo evidence."
    :"Search and filter your submitted reports. Click View for full details and photo evidence.";
}


/* ===================== GENERIC PROJECT LAUNCHER — V2 ===================== */
const ACTIVE_PROJECT_KEY="pmcActiveProject";
let projectLauncherData=[];

function normalizeProjectName_(project){
  const key=String(project||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

  /* Backward compatibility — DO NOT REMOVE.
     These aliases preserve all existing LCRG / OLC records and module logic. */
  if(["lcrg","lake city roof garden","lake city roof gardens"].includes(key))return "Lake City Roof Garden";
  if(["olc","one lake city"].includes(key))return "One Lake City";

  return String(project||"").trim();
}

function getActiveProject(){
  return normalizeProjectName_(localStorage.getItem(ACTIVE_PROJECT_KEY)||"");
}

function rowMatchesActiveProject_(row){
  const active=getActiveProject();
  if(!active)return false;
  const p=String(
    row?.project ??
    row?.Project ??
    row?.["Project Name"] ??
    ""
  ).trim();
  return normalizeProjectName_(p)===active;
}

function scopeRowsToActiveProject_(rows){
  return (rows||[]).filter(rowMatchesActiveProject_);
}

function lockProjectSelectToActive_(id){
  const el=document.getElementById(id);
  const active=getActiveProject();
  if(!el||!active)return;

  let opt=Array.from(el.options||[]).find(o=>
    normalizeProjectName_(o.value||o.textContent)===active
  );

  if(!opt){
    opt=document.createElement("option");
    opt.value=active;
    opt.textContent=projectLauncherDisplayName_(active);
    el.insertBefore(opt,el.firstChild);
  }

  el.value=opt.value;
  el.disabled=true;
  el.classList.add("project-context-locked");
  el.title="Project is controlled by the Project Launcher. Use Change Project from Dashboard.";
}

function projectMatchesActive_(row){
  const active=getActiveProject();
  return !!active&&normalizeProjectName_(cockpitRowProject(row))===active;
}

function projectLauncherName_(row){
  return String(
    row?.["Project Name"] ??
    row?.projectName ??
    row?.Project ??
    row?.project ??
    ""
  ).trim();
}

function projectLauncherId_(row){
  return String(
    row?.["Project ID"] ??
    row?.projectId ??
    row?.ID ??
    row?.id ??
    ""
  ).trim();
}

function projectLauncherCode_(name,id){
  const normalized=normalizeProjectName_(name);

  /* Preserve familiar legacy codes. */
  if(normalized==="Lake City Roof Garden")return "LCRG";
  if(normalized==="One Lake City")return "OLC";

  const words=String(name||"").trim().split(/\s+/).filter(Boolean);
  if(words.length>=2){
    return words.slice(0,4).map(w=>w.charAt(0).toUpperCase()).join("").slice(0,5);
  }

  const cleaned=String(name||id||"PRJ").replace(/[^A-Za-z0-9]/g,"").toUpperCase();
  return cleaned.slice(0,5)||"PRJ";
}

function projectLauncherDisplayName_(name){
  const normalized=normalizeProjectName_(name);
  if(normalized==="Lake City Roof Garden")return "Lake City Roof Gardens";
  return name;
}

function projectLauncherMeta_(name){
  const normalized=normalizeProjectName_(name);

  /* Preserve the existing project hierarchy information. */
  if(normalized==="Lake City Roof Garden")return "Tower I • L1 • L2";
  if(normalized==="One Lake City")return "Tower 1 • Tower 2";

  const towers=(masterData?.towers||[]).filter(t=>{
    return normalizeProjectName_(t["Project"]||t["Project Name"]||t.project||"")===normalized;
  }).map(t=>String(t["Tower / Block"]||t["Tower"]||t.tower||"").trim()).filter(Boolean);

  const unique=[...new Set(towers)];
  if(unique.length===1)return unique[0];
  if(unique.length>1)return unique.slice(0,3).join(" • ")+(unique.length>3?" • +"+(unique.length-3):"");

  return "Project Management Dashboard";
}

function userHasAllProjectAccess_(){
  const role=String(loggedInUser?.role||"").trim().toLowerCase();
  return role==="ceo"||role==="project manager";
}

function userProjectAccessTokens_(){
  return String(loggedInUser?.projectAccess||"")
    .split(/[\n,;|]+/)
    .map(v=>String(v||"").trim())
    .filter(Boolean);
}

function projectAccessTokenKey_(v){
  return String(v||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}

function projectRowAllowedForUser_(row){
  if(userHasAllProjectAccess_())return true;

  const tokens=userProjectAccessTokens_();
  if(!tokens.length)return false;

  const name=projectLauncherName_(row);
  const id=projectLauncherId_(row);
  const nameKey=projectAccessTokenKey_(name);
  const idKey=projectAccessTokenKey_(id);

  return tokens.some(t=>{
    const key=projectAccessTokenKey_(t);
    return key===nameKey||key===idKey;
  });
}

function renderProjectLauncher(){
  const grid=document.getElementById("projectLauncherGrid");
  const count=document.getElementById("projectLauncherCount");
  if(!grid)return;

  const q=String(document.getElementById("projectLauncherSearch")?.value||"").trim().toLowerCase();

  const rows=(projectLauncherData||[])
    .filter(projectRowAllowedForUser_)
    .map(r=>({
      raw:r,
      name:projectLauncherName_(r),
      id:projectLauncherId_(r)
    }))
    .filter(r=>r.name)
    .filter(r=>!q||[r.name,r.id].join(" ").toLowerCase().includes(q))
    .sort((a,b)=>a.name.localeCompare(b.name));

  if(count){
    const total=(projectLauncherData||[])
      .filter(projectRowAllowedForUser_)
      .filter(r=>projectLauncherName_(r)).length;
    count.innerText=q?rows.length+" of "+total+" projects":total+" accessible project"+(total===1?"":"s");
  }

  if(!rows.length){
    const noAssignment=!userHasAllProjectAccess_()&&!userProjectAccessTokens_().length;
    grid.innerHTML='<div class="project-launcher-empty">'+
      (q
        ?'No accessible project matches your search.'
        :(noAssignment
          ?'No project has been assigned to your account. Please contact the Administrator.'
          :'No accessible active projects are available.'))+
      '</div>';
    return;
  }

  grid.innerHTML=rows.map(r=>{
    const display=projectLauncherDisplayName_(r.name);
    const code=projectLauncherCode_(r.name,r.id);
    const meta=projectLauncherMeta_(r.name);

    return '<button type="button" class="project-choice" data-project="'+escapeHtml(r.name)+'" aria-label="Open '+escapeHtml(display)+' dashboard">'+
      '<div class="project-list-badge">'+escapeHtml(code)+'</div>'+
      '<div class="project-list-main">'+
        '<div class="project-list-name">'+escapeHtml(display)+'</div>'+
        '<div class="project-list-meta">'+escapeHtml(meta)+'</div>'+
        (r.id?'<div class="project-list-id">'+escapeHtml(r.id)+'</div>':'')+
      '</div>'+
      '<div class="project-list-status">Active</div>'+
      '<div class="project-list-arrow">→</div>'+
    '</button>';
  }).join("");

  grid.querySelectorAll(".project-choice[data-project]").forEach(btn=>{
    btn.addEventListener("click",()=>selectActiveProject(btn.getAttribute("data-project")));
  });
}

function loadProjectLauncher(){
  const grid=document.getElementById("projectLauncherGrid");
  const count=document.getElementById("projectLauncherCount");

  if(grid){
    grid.innerHTML=
      '<div class="project-launcher-loading">Loading active projects...</div>';
  }

  if(count){
    count.innerText="Loading projects...";
  }

  function useFallback(){
    /*
     * Preserve our existing LCRG / OLC projects.
     * This also prevents the launcher from becoming unusable
     * while Projects Master Data is being connected.
     */
    projectLauncherData=[
      {
        "Project ID":"PRJ-001",
        "Project Name":"Lake City Roof Garden",
        "Status":"Active"
      },
      {
        "Project ID":"PRJ-002",
        "Project Name":"One Lake City",
        "Status":"Active"
      }
    ];

    renderProjectLauncher();
  }

  /*
   * GitHub Pages version:
   * use API shim instead of google.script.run.
   */
  if(
    window.LCRG_API &&
    typeof window.LCRG_API.call==="function"
  ){
    window.LCRG_API.call(
      "masterData",
      {}
    )
    .then(function(d){

      masterData=d||masterData||{};

      projectLauncherData=
        Array.isArray(d?.projects)
          ?d.projects
          :[];

      /*
       * Existing projects must never be lost.
       */
      if(!projectLauncherData.length){
        useFallback();
        return;
      }

      renderProjectLauncher();
    })
    .catch(function(err){

      console.error(
        "Project launcher master-data API failed:",
        err
      );

      useFallback();
    });

    return;
  }

  /*
   * Safety fallback.
   */
  console.warn(
    "LCRG_API unavailable. Using existing project list."
  );

  useFallback();
}
function syncActiveProjectDashboard_(){
  const active=getActiveProject();
  const label=document.getElementById("activeProjectDisplay");
  if(label)label.innerText=projectLauncherDisplayName_(active)||"No Project Selected";

  const sel=document.getElementById("cockpitProjectFilter");
  if(sel&&active){
    let option=Array.from(sel.options).find(o=>normalizeProjectName_(o.value||o.textContent)===active);
    if(!option){
      option=document.createElement("option");
      option.value=active;
      option.textContent=projectLauncherDisplayName_(active);
      sel.insertBefore(option,sel.firstChild);
    }
    sel.value=option.value;
  }

  if(active)localStorage.setItem("managementCockpitProject",active);
  syncSmartProjectIdentity_();
}

function showProjectSelection(){
  if(!loggedInUser){
    hideAppPages();
    document.getElementById("loginPage").style.display="flex";
    return;
  }

  hideAppPages();

  const page=document.getElementById("projectSelectionPage");
  if(page)page.style.display="flex";

  const user=document.getElementById("projectSelectionUser");
  if(user){
    const name=loggedInUser.supervisorName||loggedInUser.username||"User";
    const role=loggedInUser.role||"";
    user.innerText=role?name+" • "+role:name;
  }

  const accessNote=document.getElementById("projectAccessNote");
  if(accessNote){
    accessNote.innerText=userHasAllProjectAccess_()
      ?"All active projects are available for your role."
      :"Only projects assigned to your account are shown.";
  }

  const search=document.getElementById("projectLauncherSearch");
  if(search)search.value="";

  loadProjectLauncher();
}

function selectActiveProject(project){
  const normalized=normalizeProjectName_(project);
  if(!normalized)return;

  /* Generic: any active project returned by Projects Master Data is valid. */
  const valid=(projectLauncherData||[]).some(r=>
    projectRowAllowedForUser_(r)&&
    normalizeProjectName_(projectLauncherName_(r))===normalized
  );

  /* Legacy fallback is allowed only for CEO / Project Manager. */
  const legacy=userHasAllProjectAccess_()&&
    ["Lake City Roof Garden","One Lake City"].includes(normalized);

  if(!valid&&!legacy){
    alert("You do not have permission to access this project. Please contact the Administrator.");
    return;
  }

  localStorage.setItem(ACTIVE_PROJECT_KEY,normalized);
  localStorage.setItem("managementCockpitProject",normalized);

  const tower=document.getElementById("cockpitTowerFilter");
  if(tower)tower.value="";

  showDashboard();
}

function changeActiveProject(){
  localStorage.removeItem(ACTIVE_PROJECT_KEY);
  localStorage.removeItem("managementCockpitProject");
  managementCockpitSourceData=null;
  managementCockpitLastData=null;
  showProjectSelection();
}

function hideAppPages(){
  ["loginPage","projectSelectionPage","dashboardPage","activityPage","myReportsPage","pendingInspectionsPage","dailySummaryPage","administrationPage","executiveReportPage","cashFlowPage","boqCostPage","drawingsPage","actionRegisterPage","programmePage","procurementPage","placeholderModulePage"].forEach(function(id){
    const el=document.getElementById(id);
    if(el)el.style.display="none";
  });
}

function login(){
  const u=value("username");
  const p=document.getElementById("password").value;
  const m=document.getElementById("message");
  const b=document.getElementById("loginButton");

  if(!u||!p){
    m.style.color="#dc2626";
    m.innerText="Username and password are required.";
    return;
  }

  b.disabled=true;
  b.innerText="LOGGING IN...";
  m.style.color="#64748b";
  m.innerText="Checking login details...";

  google.script.run
    .withSuccessHandler(function(r){
      b.disabled=false;
      b.innerText="LOGIN";
      if(r.success){
        loggedInUser=r.user;
        if(document.getElementById("rememberMe").checked){
          localStorage.setItem("rememberedUsername",u);
        }else{
          localStorage.removeItem("rememberedUsername");
        }
        m.innerText="";
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
        localStorage.removeItem("managementCockpitProject");
        showProjectSelection();
      }else{
        m.style.color="#dc2626";
        m.innerText=r.message;
      }
    })
    .withFailureHandler(function(e){
      b.disabled=false;
      b.innerText="LOGIN";
      m.style.color="#dc2626";
      m.innerText="Login error: "+e.message;
    })
    .loginUser(u,p);
}

function showDashboard(){
  if(!loggedInUser){hideAppPages();document.getElementById("loginPage").style.display="flex";return}
  if(!getActiveProject()){showProjectSelection();return}
  hideAppPages();document.getElementById("dashboardPage").style.display="block";
  document.getElementById("welcome").innerText="Welcome, "+loggedInUser.supervisorName;
  document.getElementById("userRole").innerText="Role: "+loggedInUser.role+" | Employee ID: "+loggedInUser.employeeId;
  syncDashboardSidebarUser();applyRoleAccess();syncActiveProjectDashboard_();
  const attentionBox=document.getElementById("dashboardManagementAttention");if(attentionBox)attentionBox.style.display=hasExecutiveAccess()?"block":"none";
  loadDashboardStats();loadManagementCockpit();loadActionDashboardBadge();
}

function addOption(s,v){
  if(!v)return;
  let o=document.createElement("option");
  o.value=v;
  o.textContent=v;
  s.appendChild(o);
}

function dashboardTodayString(){
  const n=new Date();
  return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");
}

function loadDashboardStats(){
  if(!loggedInUser)return;

  const btn=document.getElementById("dashboardRefreshButton");
  const status=document.getElementById("dashboardStatus");
  const dateEl=document.getElementById("dashboardDate");
  const today=dashboardTodayString();

  if(dateEl){
    dateEl.innerText=new Date().toLocaleDateString(
      undefined,
      {
        weekday:"long",
        year:"numeric",
        month:"long",
        day:"numeric"
      }
    );
  }

  if(btn){
    btn.disabled=true;
    btn.innerText="↻ Refreshing...";
  }

  if(status){
    status.innerText="Updating live dashboard counts...";
  }

  let summaryDone=false;
  let inspectionDone=false;
  let hadError=false;

  function finish(){
    if(!summaryDone||!inspectionDone)return;

    if(btn){
      btn.disabled=false;
      btn.innerText="↻ Refresh Dashboard";
    }

    if(status){
      status.innerText=
        hadError
          ?"Some dashboard counts could not be refreshed."
          :"Live snapshot updated just now.";
    }
  }

  google.script.run
    .withSuccessHandler(function(rows){
      rows=(rows||[]).filter(projectMatchesActive_);

      const completed=
        rows.filter(
          r=>
            String(r.workStatus||"")
              .trim()
              .toLowerCase()==="completed"
        ).length;

      const progress=
        rows.filter(
          r=>
            String(r.workStatus||"")
              .trim()
              .toLowerCase()==="in progress"
        ).length;

      const constraints=
        rows.filter(r=>{
          const issue=
            String(r.issueConstraint||"")
              .trim()
              .toLowerCase();

          const cat=
            String(r.delayCategory||"")
              .trim()
              .toLowerCase();

          return (
            issue &&
            issue!=="none" &&
            issue!=="n/a"
          ) || (
            cat &&
            cat!=="none" &&
            cat!=="n/a"
          );
        }).length;

      document.getElementById("dashActivities").innerText=rows.length;
      document.getElementById("dashProgress").innerText=progress;
      document.getElementById("dashCompleted").innerText=completed;
      document.getElementById("dashConstraints").innerText=constraints;
      document.getElementById("dashReportsCardCount").innerText=rows.length;
      document.getElementById("dashCompletionCardCount").innerText=completed;

      const cc=document.getElementById("dashConstraintCardCount");
      if(cc)cc.innerText=constraints;

      if(hasExecutiveAccess()){
        const attention=rows.filter(r=>{
          const issue=String(r.issueConstraint||"").trim();
          const cat=String(r.delayCategory||"").trim();
          const ws=String(r.workStatus||"").trim().toLowerCase();
          const ins=String(r.inspectionStatus||"").trim();

          const meaningful=v=>
            v &&
            ![
              "none",
              "n/a",
              "na",
              "nil",
              "not applicable"
            ].includes(v.toLowerCase());

          return (
            meaningful(issue) ||
            meaningful(cat) ||
            ws==="hold" ||
            ws==="on hold" ||
            ws==="delayed" ||
            ins==="Rectification Required"
          );
        }).slice(0,5);

        const ae=document.getElementById("dashboardAttentionList");

        if(ae){
          ae.innerHTML=
            !attention.length
              ?'<div class="summary-empty">No management attention items reported today.</div>'
              :attention.map(r=>{
                const issue=
                  r.issueConstraint ||
                  r.delayCategory ||
                  (
                    r.inspectionStatus==="Rectification Required"
                      ?"Rectification Required"
                      :"Activity on Hold"
                  );

                const location=
                  [r.project,r.tower,r.activity]
                    .filter(Boolean)
                    .join(" • ");

                const state=
                  r.inspectionStatus==="Rectification Required"
                    ?"Rectification"
                    :(r.workStatus||"Attention");

                return (
                  '<div class="dashboard-attention-item">'+
                    '<div class="dashboard-attention-issue">'+
                      escapeHtml(issue)+
                    '</div>'+
                    '<div class="dashboard-attention-location">'+
                      escapeHtml(location)+
                    '</div>'+
                    '<div class="dashboard-attention-status">'+
                      escapeHtml(state)+
                    '</div>'+
                  '</div>'
                );
              }).join("");
        }
      }

      summaryDone=true;
      finish();
    })
    .withFailureHandler(function(){
      [
        "dashActivities",
        "dashProgress",
        "dashCompleted",
        "dashConstraints",
        "dashReportsCardCount",
        "dashCompletionCardCount",
        "dashConstraintCardCount"
      ].forEach(id=>{
        const e=document.getElementById(id);
        if(e)e.innerText="—";
      });

      hadError=true;
      summaryDone=true;
      finish();
    })
    .getDailySummaryRowsForUser(
      today,
      loggedInUser.userId,
      loggedInUser.username,
      loggedInUser.role
    );

  google.script.run
    .withSuccessHandler(function(rows){
      rows=(rows||[]).filter(projectMatchesActive_);
      const n=rows.length;

      document.getElementById("dashPending").innerText=n;
      document.getElementById("dashInspectionCardCount").innerText=n;

      const nb=document.getElementById("inspectionNotificationBadge");
      if(nb){
        nb.innerText=n;
        nb.style.display=n?"flex":"none";
      }

      inspectionDone=true;
      finish();
    })
    .withFailureHandler(function(){
      document.getElementById("dashPending").innerText="—";
      document.getElementById("dashInspectionCardCount").innerText="—";

      hadError=true;
      inspectionDone=true;
      finish();
    })
    .getPendingInspectionsForUser(
      loggedInUser.userId,
      loggedInUser.username,
      loggedInUser.role
    );

  updateDashboardDraftBadge();

  const adminBadge=document.getElementById("adminNotificationBadge");
  if(adminBadge){
    adminBadge.style.display="none";
  }

  if(hasAdministrationAccess()){
    google.script.run
      .withSuccessHandler(function(data){
        const n=
          ((data&&data.passwordResetRequests)||[])
            .filter(
              r=>
                String(r.status||"")
                  .toLowerCase()==="pending"
            ).length;

        if(adminBadge){
          adminBadge.innerText=n;
          adminBadge.style.display=n?"flex":"none";
        }
      })
      .withFailureHandler(function(){
        if(adminBadge){
          adminBadge.style.display="none";
        }
      })
      .getAdministrationData(
        loggedInUser.userId,
        loggedInUser.username
      );
  }
}


/* ===================== MANAGEMENT COCKPIT V1 ===================== */
let managementCockpitLastData=null;

function cockpitSetHealth(name,color,text,detail){
  const dot=document.getElementById("health"+name+"Dot");
  const txt=document.getElementById("health"+name+"Text");
  const det=document.getElementById("health"+name+"Detail");

  if(dot)dot.className="health-dot "+color;
  if(txt)txt.innerText=text;
  if(det)det.innerText=detail;
}

function cockpitMoney(v){
  const n=Number(v||0);

  if(!isFinite(n)){
    return "PKR 0";
  }

  const a=Math.abs(n);

  if(a>=1000000000){
    return "PKR "+(n/1000000000).toFixed(2).replace(/\.00$/,'')+" B";
  }

  if(a>=1000000){
    return "PKR "+(n/1000000).toFixed(1).replace(/\.0$/,'')+" M";
  }

  if(a>=1000){
    return "PKR "+(n/1000).toFixed(1).replace(/\.0$/,'')+" K";
  }

  return "PKR "+Math.round(n).toLocaleString();
}

function cockpitNum(v){
  if(v===null||v===undefined||v===""){
    return 0;
  }

  if(typeof v==="number"){
    return isFinite(v)?v:0;
  }

  let s=String(v).trim();
  const neg=/^\(.*\)$/.test(s);

  s=s
    .replace(/[(),]/g,"")
    .replace(/%/g,"")
    .replace(/PKR/ig,"")
    .replace(/Rs\.?/ig,"")
    .replace(/[^\d.\-]/g,"");

  let n=Number(s);

  if(!isFinite(n)){
    n=0;
  }

  if(neg&&n>0){
    n=-n;
  }

  return n;
}

function setCockpitHealth(name,status,text,detail){
  const dot=document.getElementById("health"+name+"Dot");
  const tx=document.getElementById("health"+name+"Text");
  const dt=document.getElementById("health"+name+"Detail");

  if(dot)dot.className="health-dot "+status;
  if(tx)tx.innerText=text||status;
  if(dt)dt.innerText=detail||"";
}

function cockpitApi(action,data){
  if(
    window.LCRG_API &&
    typeof window.LCRG_API.call==="function"
  ){
    return window.LCRG_API.call(
      action,
      data||{}
    );
  }

  return Promise.reject(
    new Error("API unavailable")
  );
}

function cockpitMeaningful(v){
  v=String(v||"").trim().toLowerCase();

  return !!v &&
    ![
      "none",
      "n/a",
      "na",
      "nil",
      "not applicable",
      "-"
    ].includes(v);
}

function cockpitDelta(current,previous,suffix){
  if(previous===null||previous===undefined){
    return "Baseline saved";
  }

  const d=current-previous;

  if(!d){
    return "No change";
  }

  return (d>0?"+":"")+d+(suffix||"");
}

function cockpitMoneyDelta(current,previous){
  if(previous===null||previous===undefined){
    return "Baseline saved";
  }

  const d=current-previous;

  if(Math.abs(d)<1){
    return "No change";
  }

  return (d>0?"+":"−")+cockpitMoney(Math.abs(d));
}

let managementCockpitSourceData=null;

function cockpitRowProject(r){
  return String(
    (r&&r.project) ||
    (r&&r.projectName) ||
    (r&&r["Project"]) ||
    (r&&r["Project Name"]) ||
    ""
  ).trim();
}

function cockpitRowTower(r){
  return String(
    (r&&r.tower) ||
    (r&&r.towerArea) ||
    (r&&r.area) ||
    (r&&r["Tower / Block"]) ||
    (r&&r["Tower / Area"]) ||
    ""
  ).trim();
}

function cockpitPopulateProjectFilter(data){
  const sel=document.getElementById(
    'cockpitProjectFilter'
  );

  if(!sel){
    return '';
  }

  const active=getActiveProject();

  const projects=[
    ...new Set(
      []
        .concat(
          data.daily,
          data.inspections,
          data.cash,
          data.boq,
          data.drawings
        )
        .map(cockpitRowProject)
        .filter(Boolean)
    )
  ].sort();

  if(
    active &&
    !projects.some(
      p=>normalizeProjectName_(p)===active
    )
  ){
    projects.unshift(active);
  }

  sel.innerHTML=
    projects.length
      ?projects.map(
        p=>
          '<option value="'+
          escapeHtml(p)+
          '">'+
          escapeHtml(p)+
          '</option>'
      ).join('')
      :'<option value="'+
        escapeHtml(active)+
        '">'+
        escapeHtml(active||'No project data')+
        '</option>';

  const matched=
    projects.find(
      p=>normalizeProjectName_(p)===active
    ) ||
    active ||
    projects[0] ||
    '';

  sel.value=matched;

  if(matched){
    localStorage.setItem(
      'managementCockpitProject',
      normalizeProjectName_(matched)
    );
  }

  syncActiveProjectDashboard_();

  return matched;
}

function cockpitPopulateTowerFilter(data,project){
  const sel=document.getElementById("cockpitTowerFilter");

  if(!sel){
    return;
  }

  const previous=sel.value||"";
  const activeProject=normalizeProjectName_(
    project || getActiveProject() || ""
  );

  let towers=[];

  /*
   * 1. PRIMARY SOURCE:
   * Project Master Data.
   *
   * This ensures towers are available even when Daily Summary,
   * BOQ, Cash Flow, Drawings etc. do not yet contain any records.
   */
  if(
    typeof masterData!=="undefined" &&
    masterData &&
    Array.isArray(masterData.towers)
  ){
    masterData.towers.forEach(function(r){

      const rowProject=normalizeProjectName_(
        r["Project"] ||
        r["Project Name"] ||
        r.project ||
        ""
      );

      const tower=String(
        r["Tower / Block"] ||
        r["Tower"] ||
        r.tower ||
        ""
      ).trim();

      if(
        tower &&
        rowProject===activeProject
      ){
        towers.push(tower);
      }
    });
  }

  /*
   * 2. SECONDARY SOURCE:
   * Merge tower / area names already present in live module data.
   *
   * This keeps compatibility with External Development,
   * Overall Areas or future project-specific areas.
   */
  [
    ...(data?.daily||[]),
    ...(data?.inspections||[]),
    ...(data?.cash||[]),
    ...(data?.boq||[]),
    ...(data?.drawings||[]),
    ...(data?.actions||[]),
    ...(data?.programme||[]),
    ...(data?.procurement||[])
  ].forEach(function(r){

    const rowProject=normalizeProjectName_(
      cockpitRowProject(r)
    );

    const tower=String(
      cockpitRowTower(r)||""
    ).trim();

    if(
      tower &&
      rowProject===activeProject
    ){
      towers.push(tower);
    }
  });

  /*
   * 3. LEGACY SAFETY FALLBACK
   *
   * Preserve our existing LCRG / OLC structure if Master Data
   * temporarily fails to load.
   */
  if(!towers.length){

    if(activeProject==="Lake City Roof Garden"){
      towers=[
        "Tower I",
        "L1",
        "L2"
      ];
    }

    else if(activeProject==="One Lake City"){
      towers=[
        "Tower 1",
        "Tower 2"
      ];
    }
  }

  /*
   * Remove duplicates and blank values.
   */
  towers=[
    ...new Set(
      towers
        .map(function(v){
          return String(v||"").trim();
        })
        .filter(Boolean)
    )
  ];

  /*
   * Keep sensible project order for the two current projects.
   * Future projects remain dynamically driven by Master Data.
   */
  if(activeProject==="Lake City Roof Garden"){

    const order={
      "Tower I":1,
      "L1":2,
      "L2":3
    };

    towers.sort(function(a,b){
      return (
        (order[a]||999) -
        (order[b]||999) ||
        a.localeCompare(b)
      );
    });

  }else if(activeProject==="One Lake City"){

    const order={
      "Tower 1":1,
      "Tower 2":2
    };

    towers.sort(function(a,b){
      return (
        (order[a]||999) -
        (order[b]||999) ||
        a.localeCompare(b)
      );
    });

  }else{

    towers.sort(function(a,b){
      return a.localeCompare(b);
    });
  }

  sel.innerHTML=
    '<option value="">All Towers / Areas</option>'+
    towers.map(function(t){
      return (
        '<option value="'+
        escapeHtml(t)+
        '">'+
        escapeHtml(t)+
        '</option>'
      );
    }).join("");

  /*
   * Keep the previously selected tower where possible.
   */
  if(towers.includes(previous)){
    sel.value=previous;
  }else{
    sel.value="";
  }
}

function pmcProjectImageFor_(project){
  const key=String(project||"").trim().toLowerCase();

  if(
    key==="one lake city" ||
    key==="olc"
  ){
    return "olc-elevation.jpg?v=20260820-1";
  }

  return "lcrg-elevation.jpg?v=20260820-1";
}

function syncSmartProjectIdentity_(){
  const project=
    (document.getElementById("cockpitProjectFilter")||{}).value ||
    "";

  const img=pmcProjectImageFor_(project);

  [
    "projectElevationImage",
    "projectHealthThumb"
  ].forEach(function(id){
    const el=document.getElementById(id);

    if(
      el &&
      el.getAttribute("src")!==img
    ){
      el.setAttribute("src",img);
    }
  });

  const hero=document.getElementById(
    "projectHeroName"
  );

  if(hero){
    hero.innerText=
      project||"Selected Project";
  }

  const kpi=document.getElementById(
    "selectedProjectKpiName"
  );

  if(kpi){
    kpi.innerText=
      project||"—";
  }

  const ht=document.getElementById(
    "projectHealthTitle"
  );

  if(ht){
    ht.innerText=
      "Project Health"+
      (project?" — "+project:"");
  }

  const at=document.getElementById(
    "projectAlertsTitle"
  );

  if(at){
    at.innerText=
      "Key Alerts"+
      (project?" — "+project:"");
  }
}

function syncSmartExecutiveDashboard_(data){
  data=data||{};

  syncSmartProjectIdentity_();

  const pct=
    Math.max(
      0,
      Math.min(
        100,
        Number(data.financial||0)
      )
    );

  const pp=document.getElementById(
    "projectHealthProgress"
  );

  if(pp){
    pp.innerText=pct.toFixed(1)+"%";
  }

  const bar=document.getElementById(
    "projectHealthProgressBar"
  );

  if(bar){
    bar.style.width=pct.toFixed(1)+"%";

    bar.style.background=
      data.overall==="red"
        ?"#dc2626"
        :data.overall==="amber"
          ?"#f59e0b"
          :"#16a34a";
  }

  const st=document.getElementById(
    "projectHealthStatus"
  );

  if(st){
    st.innerText=data.overallText||"Stable";

    st.className=
      "pmc-status-pill "+
      (
        data.overall==="red"
          ?"red"
          :data.overall==="amber"
            ?"amber"
            :"green"
      );
  }

  const on=document.getElementById(
    "ceoOnTrackCount"
  );

  const risk=document.getElementById(
    "ceoAtRiskCount"
  );

  const onNote=document.getElementById(
    "ceoOnTrackNote"
  );

  const riskNote=document.getElementById(
    "ceoAtRiskNote"
  );

  const atRisk=
    data.overall==="red" ||
    data.overall==="amber";

  if(on){
    on.innerText=
      atRisk?"0":"1";
  }

  if(risk){
    risk.innerText=
      atRisk?"1":"0";
  }

  if(onNote){
    onNote.innerText=
      atRisk
        ?"0% of selected project"
        :"100% of selected project";
  }

  if(riskNote){
    riskNote.innerText=
      atRisk
        ?"100% of selected project"
        :"0% of selected project";
  }
}

function syncSmartTopbarUser_(){
  if(!loggedInUser){
    return;
  }

  const name=document.getElementById(
    "topbarUserName"
  );

  const role=document.getElementById(
    "topbarUserRole"
  );

  const initials=document.getElementById(
    "topbarUserInitials"
  );

  if(name){
    name.innerText=
      loggedInUser.supervisorName ||
      loggedInUser.username ||
      "User";
  }

  if(role){
    role.innerText=
      loggedInUser.role||"";
  }

  if(initials){
    const parts=
      String(
        loggedInUser.supervisorName ||
        loggedInUser.username ||
        "U"
      )
      .trim()
      .split(/\s+/);

    initials.innerText=
      (parts[0]?.[0]||"U")+
      (
        parts.length>1
          ?(parts[parts.length-1][0]||"")
          :""
      );
  }
}

function cockpitProjectChanged(){
  const p=
    document.getElementById(
      'cockpitProjectFilter'
    ).value||'';

  if(p){
    localStorage.setItem(
      'managementCockpitProject',
      p
    );
  }

  if(managementCockpitSourceData){
    cockpitPopulateTowerFilter(
      managementCockpitSourceData,
      p
    );
  }

  syncSmartProjectIdentity_();
  renderManagementCockpitFromCache();
}

function cockpitScopeRows(rows,project,tower){
  return (rows||[]).filter(
    r=>
      (!project||cockpitRowProject(r)===project) &&
      (!tower||cockpitRowTower(r)===tower)
  );
}
function loadManagementCockpit(){
  const cockpit=document.getElementById("managementCockpit");
  const legacy=document.getElementById("legacyDashboardKpis");
  const legacyAttention=document.getElementById("dashboardManagementAttention");
  if(!cockpit)return;
  if(!hasExecutiveAccess()){
    cockpit.style.display="none";if(legacy)legacy.style.display="grid";if(legacyAttention)legacyAttention.style.display="none";return;
  }
  cockpit.style.display="block";if(legacy)legacy.style.display="none";if(legacyAttention)legacyAttention.style.display="none";
  const updated=document.getElementById("cockpitUpdated");if(updated)updated.innerText="Updating live project view...";
  const today=dashboardTodayString();

  Promise.allSettled([
    cockpitApi("dailySummary",{date:today}),
    cockpitApi("pendingInspections",{}),
    cockpitApi("cashFlow",{}),
    cockpitApi("boqCost",{}),
    cockpitApi("drawings",{}),
    actionApi("actionRegister",{}),
    cockpitApi("programme",{}),
    cockpitApi("procurement",{})
  ]).then(function(results){
    managementCockpitSourceData={
      daily:results[0].status==="fulfilled"?(results[0].value||[]):[],
      inspections:results[1].status==="fulfilled"?(results[1].value||[]):[],
      cash:results[2].status==="fulfilled"?(results[2].value||[]):[],
      boq:results[3].status==="fulfilled"?(results[3].value||[]):[],
      drawings:results[4].status==="fulfilled"?(results[4].value||[]):[],
      actions:results[5].status==="fulfilled"?(results[5].value||[]):[],
      programme:results[6].status==="fulfilled"?(results[6].value||[]):[],
      procurement:results[7].status==="fulfilled"?(results[7].value||[]):[],
      failed:results.filter(x=>x.status!=="fulfilled").length
    };

    const project=cockpitPopulateProjectFilter(managementCockpitSourceData);
    cockpitPopulateTowerFilter(managementCockpitSourceData,project);
    renderManagementCockpitFromCache();
  });
}

function renderManagementCockpitFromCache(){
  if(!managementCockpitSourceData)return;

  const source=managementCockpitSourceData;

  const project=
    (document.getElementById('cockpitProjectFilter')||{}).value||'';

  const tower=
    (document.getElementById('cockpitTowerFilter')||{}).value||'';

  const daily=
        cockpitScopeRows(source.daily,project,tower),

        inspections=
        cockpitScopeRows(source.inspections,project,tower),

        cash=
        cockpitScopeRows(source.cash,project,tower),

        boq=
        cockpitScopeRows(source.boq,project,tower),

        drawings=
        cockpitScopeRows(source.drawings,project,tower),

        actionRows=
        cockpitScopeRows(source.actions||[],project,tower),

        programmeRows=
        cockpitScopeRows(source.programme||[],project,tower),

        procurementRows=
        cockpitScopeRows(source.procurement||[],project,tower),

        failed=
        source.failed||0;

  const openActions=
    actionRows.filter(
      r=>
        String(r.status||"")
          .trim()
          .toLowerCase()!=="closed"
    );

  const decisionActions=
    openActions.filter(r=>{
      const d=
        String(r.decisionRequired||"")
          .trim();

      return d&&
        d.toLowerCase()!=="no decision required";
    });

  const criticalActions=
    openActions.filter(
      r=>
        String(r.priority||"")
          .trim()
          .toLowerCase()==="critical" ||
        !!r.isOverdue
    );

  const overdueActions=
    openActions.filter(
      r=>!!r.isOverdue
    );

  const programmeDelayed=
    programmeRows.filter(
      r=>
        r.isDelayed ||
        String(r.status||"")
          .toLowerCase()==="delayed"
    );

  if(!programmeRows.length){
    cockpitSetHealth(
      'Programme',
      'gray',
      'No Data',
      'No programme milestones recorded'
    );
  }else if(programmeDelayed.length){
    cockpitSetHealth(
      'Programme',
      'red',
      'Delayed',
      programmeDelayed.length+
      ' delayed / overdue milestone'+
      (programmeDelayed.length===1?'':'s')
    );
  }else if(
    programmeRows.some(
      r=>Number(r.varianceDays||0)>0
    )
  ){
    cockpitSetHealth(
      'Programme',
      'amber',
      'At Risk',
      'Forecast slippage exists in programme milestones'
    );
  }else{
    cockpitSetHealth(
      'Programme',
      'green',
      'On Track',
      'No delayed programme milestones'
    );
  }

  const procurementLate=
    procurementRows.filter(
      r=>r.isLate
    );

  const procurementRisk=
    procurementRows.filter(
      r=>r.isAtRisk&&!r.isLate
    );

  if(!procurementRows.length){
    cockpitSetHealth(
      'Procurement',
      'gray',
      'No Data',
      'No procurement packages recorded'
    );
  }else if(procurementLate.length){
    cockpitSetHealth(
      'Procurement',
      'red',
      'Delayed',
      procurementLate.length+
      ' package'+
      (procurementLate.length===1?'':'s')+
      ' late'
    );
  }else if(procurementRisk.length){
    cockpitSetHealth(
      'Procurement',
      'amber',
      'At Risk',
      procurementRisk.length+
      ' package'+
      (procurementRisk.length===1?'':'s')+
      ' forecast after required date'
    );
  }else{
    cockpitSetHealth(
      'Procurement',
      'green',
      'On Track',
      'No late procurement packages'
    );
  }

  const completed=
    daily.filter(
      r=>
        String(r.workStatus||"")
          .trim()
          .toLowerCase()==="completed"
    ).length;

  const inProgress=
    daily.filter(
      r=>
        String(r.workStatus||"")
          .trim()
          .toLowerCase()==="in progress"
    ).length;

  const constraints=
    daily.filter(
      r=>
        cockpitMeaningful(r.issueConstraint) ||
        cockpitMeaningful(r.delayCategory) ||
        ['hold','on hold','delayed']
          .includes(
            String(r.workStatus||"")
              .trim()
              .toLowerCase()
          ) ||
        String(r.inspectionStatus||"")
          .trim()
          .toLowerCase()==="rectification required"
    );

  const rectification=
    daily.filter(
      r=>
        String(r.inspectionStatus||"")
          .trim()
          .toLowerCase()==="rectification required"
    ).length;

  const cashUnique=
    new Map();

  cash.forEach(r=>
    cashUnique.set(
      [
        String(r.serialNo||'').toLowerCase(),
        cockpitRowProject(r).toLowerCase(),
        cockpitRowTower(r).toLowerCase(),
        String(r.activity||'').toLowerCase()
      ].join('||'),
      r
    )
  );

  const cashRows=
    Array.from(cashUnique.values()),

    awarded=
    cashRows.reduce(
      (a,r)=>a+cockpitNum(r.awardedValue),
      0
    ),

    spent=
    cashRows.reduce(
      (a,r)=>a+cockpitNum(r.actualSpending),
      0
    ),

    pending=
    cashRows.reduce(
      (a,r)=>a+cockpitNum(r.pendingApproval),
      0
    ),

    initial=
    cashRows.reduce(
      (a,r)=>a+cockpitNum(r.initialBudget),
      0
    ),

    financial=
    awarded
      ?(spent/awarded)*100
      :0;

  const revised=
    boq.reduce(
      (a,r)=>a+cockpitNum(r.revisedAmount),
      0
    ),

    certified=
    boq.reduce(
      (a,r)=>a+cockpitNum(r.certifiedAmount),
      0
    ),

    paid=
    boq.reduce(
      (a,r)=>a+cockpitNum(r.paidAmount),
      0
    ),

    variations=
    boq.reduce(
      (a,r)=>a+cockpitNum(r.variationAmount),
      0
    ),

    certifiedOutstanding=
    Math.max(certified-paid,0),

    costCompletion=
    revised
      ?(certified/revised)*100
      :0;

  const technicalAttention=
    drawings.filter(
      r=>
        [
          'under review',
          'approved with comments',
          'superseded'
        ].includes(
          String(r.status||"")
            .trim()
            .toLowerCase()
        )
    );

  let siteStatus='green',
      siteText='On Track';

  if(
    constraints.length>=3 ||
    rectification>=2
  ){
    siteStatus='red';
    siteText='Attention';
  }else if(
    constraints.length ||
    inspections.length>=5 ||
    rectification
  ){
    siteStatus='amber';
    siteText='Watch';
  }

  setCockpitHealth(
    'Site',
    siteStatus,
    siteText,
    'Why: '+
    constraints.length+
    ' constraints • '+
    inspections.length+
    ' pending inspections • '+
    rectification+
    ' rectification'
  );

  let costStatus='green',
      costText='Within Position';

  if(
    initial>0 &&
    awarded+pending>initial*1.05
  ){
    costStatus='red';
    costText='Exposure';
  }else if(
    pending>0 ||
    (
      initial>0 &&
      awarded>initial
    )
  ){
    costStatus='amber';
    costText='Watch';
  }

  setCockpitHealth(
    'Cost',
    costStatus,
    costText,
    'Why: '+
    cockpitMoney(pending)+
    ' pending • '+
    financial.toFixed(1)+
    '% financial progress • '+
    cockpitMoney(awarded)+
    ' awarded'
  );

  let techStatus='green',
      techText='Controlled';

  if(technicalAttention.length>=10){
    techStatus='red';
    techText='Attention';
  }else if(technicalAttention.length){
    techStatus='amber';
    techText='Watch';
  }

  setCockpitHealth(
    'Technical',
    techStatus,
    techText,
    'Why: '+
    technicalAttention.length+
    ' drawing / technical item'+
    (technicalAttention.length===1?'':'s')+
    ' need review'
  );

  let approvalsStatus='green',
      approvalsText='Clear';

  if(
    initial>0 &&
    pending>initial*0.05
  ){
    approvalsStatus='red';
    approvalsText='Critical';
  }else if(pending>0){
    approvalsStatus='amber';
    approvalsText='Pending';
  }

  setCockpitHealth(
    'Approvals',
    approvalsStatus,
    approvalsText,
    pending>0
      ?'Why: '+
       cockpitMoney(pending)+
       ' awaiting approval'
      :'Why: No financial approvals pending'
  );

  let commercialStatus='green',
      commercialText='Controlled';

  const variationRatio=
    revised
      ?Math.abs(variations)/revised
      :0;

  if(variationRatio>0.10){
    commercialStatus='red';
    commercialText='Exposure';
  }else if(
    Math.abs(variations)>0 ||
    certifiedOutstanding>0
  ){
    commercialStatus='amber';
    commercialText='Watch';
  }

  setCockpitHealth(
    'Commercial',
    commercialStatus,
    commercialText,
    'Why: '+
    cockpitMoney(certifiedOutstanding)+
    ' certified unpaid • '+
    cockpitMoney(variations)+
    ' variations'
  );

  const redCount=
    [
      siteStatus,
      costStatus,
      techStatus,
      approvalsStatus,
      commercialStatus
    ].filter(x=>x==='red').length,

    amberCount=
    [
      siteStatus,
      costStatus,
      techStatus,
      approvalsStatus,
      commercialStatus
    ].filter(x=>x==='amber').length;

  let overall='green',
      overallText='Stable';

  if(redCount>=2){
    overall='red';
    overallText='Critical';
  }else if(
    redCount>=1 ||
    amberCount>=2
  ){
    overall='amber';
    overallText='Attention';
  }

  const overallReason=
    redCount
      ?redCount+
       ' Red + '+
       amberCount+
       ' Amber connected areas'
      :amberCount
        ?amberCount+
         ' Amber connected area'+
         (amberCount===1?'':'s')
        :'All connected areas within position';

  setCockpitHealth(
    'Overall',
    overall,
    overallText,
    'Why: '+
    overallReason+
    (
      failed
        ?' • '+failed+' source(s) unavailable'
        :''
    )
  );

  const setText=(id,v)=>{
    const e=document.getElementById(id);
    if(e)e.innerText=v;
  };

  setText(
    'cockpitDecisionCount',
    decisionActions.length
  );

  setText(
    'cockpitConstraintCount',
    constraints.length
  );

  setText(
    'cockpitConstraintImpact',
    constraints.length
      ?'Requires site / management follow-up'
      :'No current exceptions'
  );

  setText(
    'cockpitTechnicalCount',
    technicalAttention.length
  );

  setText(
    'cockpitPendingApproval',
    cockpitMoney(pending)
  );

  setText(
    'cockpitActivities',
    daily.length
  );

  setText(
    'cockpitCompleted',
    completed
  );

  setText(
    'cockpitFinancial',
    financial.toFixed(1)+'%'
  );

  setText(
    'cockpitCostCompletion',
    costCompletion.toFixed(1)+'%'
  );

  const scopeKey=
    (project||'none')+
    '_'+
    (tower||'all'),

    snapshot={
      activities:daily.length,
      inspections:inspections.length,
      constraints:constraints.length,
      pending:Math.round(pending),
      openActions:openActions.length,
      criticalActions:criticalActions.length,
      decisions:decisionActions.length,
      at:Date.now()
    };

  let previous=null;

  try{
    previous=
      JSON.parse(
        localStorage.getItem(
          'managementCockpitSnapshot_'
          +(loggedInUser.username||loggedInUser.userId||'user')
          +'_'
          +scopeKey
        )||'null'
      );
  }catch(e){}

  setText(
    'changeActivities',
    cockpitDelta(
      snapshot.activities,
      previous&&previous.activities
    )
  );

  setText(
    'changeInspections',
    cockpitDelta(
      snapshot.inspections,
      previous&&previous.inspections
    )
  );

  setText(
    'changeConstraints',
    cockpitDelta(
      snapshot.constraints,
      previous&&previous.constraints
    )
  );

  setText(
    'changePendingCost',
    cockpitMoneyDelta(
      snapshot.pending,
      previous&&previous.pending
    )
  );

  try{
    localStorage.setItem(
      'managementCockpitSnapshot_'
      +(loggedInUser.username||loggedInUser.userId||'user')
      +'_'
      +scopeKey,
      JSON.stringify(snapshot)
    );
  }catch(e){}

  const brief=[];

  brief.push(
    '<b>'+
    escapeHtml(project||'Selected project')+
    (tower?' — '+escapeHtml(tower):'')+
    '</b> overall status is <b>'+
    overallText.toUpperCase()+
    '</b>.'
  );

  if(daily.length){
    brief.push(
      'Today '+
      daily.length+
      ' site activities are reported, with '+
      completed+
      ' completed and '+
      inProgress+
      ' in progress.'
    );
  }

  if(constraints.length){
    brief.push(
      '<b>'+
      constraints.length+
      ' site constraint'+
      (constraints.length===1?'':'s')+
      '</b> currently require follow-up.'
    );
  }else{
    brief.push(
      'No site constraints are currently surfaced from today’s reports.'
    );
  }

  if(pending>0){
    brief.push(
      '<b>'+
      cockpitMoney(pending)+
      '</b> is recorded as pending approval in Cash Flow.'
    );
  }else{
    brief.push(
      'No financial approvals are currently pending.'
    );
  }

  if(
    certifiedOutstanding>0 ||
    Math.abs(variations)>0
  ){
    brief.push(
      'Commercial watch: <b>'+
      cockpitMoney(certifiedOutstanding)+
      '</b> certified amount remains unpaid and <b>'+
      cockpitMoney(variations)+
      '</b> is recorded in variations.'
    );
  }

  if(technicalAttention.length){
    brief.push(
      technicalAttention.length+
      ' design / technical item'+
      (
        technicalAttention.length===1
          ?' requires'
          :'s require'
      )+
      ' attention.'
    );
  }

  if(openActions.length){
    brief.push(
      '<b>'+
      openActions.length+
      ' management action'+
      (openActions.length===1?' is':'s are')+
      '</b> open; '+
      criticalActions.length+
      ' critical / overdue and '+
      decisionActions.length+
      ' requiring management decision.'
    );
  }else{
    brief.push(
      'No open management actions are currently recorded for this project.'
    );
  }

  if(programmeRows.length){
    brief.push(
      'Programme: <b>'+
      programmeDelayed.length+
      '</b> delayed / overdue milestone'+
      (programmeDelayed.length===1?'':'s')+
      '.'
    );
  }

  if(procurementRows.length){
    brief.push(
      'Procurement: <b>'+
      procurementLate.length+
      '</b> late and <b>'+
      procurementRisk.length+
      '</b> at-risk package'+
      (
        (procurementLate.length+procurementRisk.length)===1
          ?''
          :'s'
      )+
      '.'
    );
  }

  const be=
    document.getElementById(
      'cockpitManagementBrief'
    );

  if(be){
    be.innerHTML=
      brief.join(' ');
  }

  setText(
    'cockpitBriefStatus',
    'Project-wise'+
    (
      tower
        ?' • tower filtered'
        :' • all towers'
    )+
    (
      failed
        ?' • partial live data'
        :' • live data'
    )
  );

  const actions=[];

  /* 1. Formal Decision / Action Register is the primary management source. */
  const rankedActions=
    openActions.slice().sort(
      (a,b)=>{
        function score(r){
          let s=0;

          if(r.isOverdue){
            s+=100;
          }

          const p=
            String(r.priority||"")
              .trim()
              .toLowerCase();

          if(p==="critical"){
            s+=80;
          }else if(p==="high"){
            s+=50;
          }else if(p==="attention"){
            s+=25;
          }

          const d=
            String(r.decisionRequired||"")
              .trim()
              .toLowerCase();

          if(
            d &&
            d!=="no decision required"
          ){
            s+=35;
          }

          return s;
        }

        return score(b)-score(a);
      }
    );

  rankedActions
    .slice(0,4)
    .forEach(r=>{
      const flags=[];

      if(r.isOverdue){
        flags.push("OVERDUE");
      }

      if(r.priority){
        flags.push(r.priority);
      }

      if(
        r.decisionRequired &&
        String(r.decisionRequired)
          .trim()
          .toLowerCase()!=="no decision required"
      ){
        flags.push("Decision Required");
      }

      if(r.status){
        flags.push(r.status);
      }

      actions.push({
        title:
          r.issue ||
          r.actionRequired ||
          r.actionId ||
          "Management Action",

        meta:
          [
            r.actionId,
            r.category,
            r.tower,
            r.floor,
            r.targetDate
              ?("Target "+r.targetDate)
              :""
          ]
          .filter(Boolean)
          .join(" • "),

        owner:
          r.responsiblePerson ||
          r.responsibleParty ||
          "Management",

        impact:
          flags.join(" • ") ||
          "Open",

        button:
          "Open Action",

        fn:
          "openActionDetail('"+
          escAttr(r.actionId)+
          "')"
      });
    });

  /* 2. Surface operational exceptions only when they are not already
        represented by the formal action register shortlist. */
  if(actions.length<6){
    constraints
      .slice(0,2)
      .forEach(r=>{
        if(actions.length>=6){
          return;
        }

        const issue=
          r.issueConstraint ||
          r.delayCategory ||
          (
            String(r.inspectionStatus||'')
              .toLowerCase()==='rectification required'
              ?'Rectification Required'
              :'Activity on Hold'
          );

        actions.push({
          title:issue,

          meta:
            [
              r.tower,
              r.floor,
              r.activity
            ]
            .filter(Boolean)
            .join(' • '),

          owner:
            r.contractor ||
            r.supervisorName ||
            'Site Team',

          impact:
            r.workStatus ||
            r.inspectionStatus ||
            'Attention',

          button:
            'View Summary',

          fn:
            'openDailySummary()'
        });
      });
  }

  if(actions.length<6){
    technicalAttention
      .slice(0,1)
      .forEach(r=>
        actions.push({
          title:
            r.drawingTitle ||
            r.title ||
            r.drawingNo ||
            'Technical Item',

          meta:
            [
              r.drawingNo,
              r.revision,
              r.status
            ]
            .filter(Boolean)
            .join(' • '),

          owner:
            r.consultant ||
            r.issuer ||
            'Technical Team',

          impact:
            'Technical review',

          button:
            'Open Drawings',

          fn:
            'openDrawings()'
        })
      );
  }

  if(
    actions.length<6 &&
    pending>0
  ){
    actions.push({
      title:
        'Pending Financial Approval',

      meta:
        cockpitMoney(pending)+
        ' currently recorded',

      owner:
        'Management / Commercial',

      impact:
        'Cost exposure',

      button:
        'Open Cash Flow',

      fn:
        'openCashFlow()'
    });
  }

  const ae=
    document.getElementById(
      'cockpitActions'
    );

  if(ae){
    if(!actions.length){
      ae.innerHTML=
        '<div class="summary-empty">'+
        'No management actions or connected exceptions require attention for this project / area.'+
        '</div>';
    }else{
      ae.innerHTML=
        actions
          .slice(0,6)
          .map(a=>
            '<div class="cockpit-action-row">'+
              '<div>'+
                '<div class="cockpit-action-title">'+
                  escapeHtml(a.title)+
                '</div>'+
                '<div class="cockpit-action-meta">'+
                  escapeHtml(a.meta||'')+
                '</div>'+
              '</div>'+
              '<div class="cockpit-owner">'+
                '<b>Owner:</b> '+
                escapeHtml(a.owner)+
              '</div>'+
              '<div class="cockpit-impact">'+
                '<b>Status:</b> '+
                escapeHtml(a.impact)+
              '</div>'+
              '<button class="cockpit-action-btn" onclick="'+
                a.fn+
              '">'+
                escapeHtml(a.button)+
              '</button>'+
            '</div>'
          )
          .join('');
    }
  }

  actionRegisterData=
    actionRows;

  updateActionDashboardBadge();

  managementCockpitLastData=
    snapshot;

  const updated=
    document.getElementById(
      'cockpitUpdated'
    );

  if(updated){
    updated.innerText=
      (project||'Project')+
      (
        tower
          ?' • '+tower
          :''
      )+
      ' • updated '+
      new Date()
        .toLocaleTimeString(
          [],
          {
            hour:'2-digit',
            minute:'2-digit'
          }
        )+
      (
        failed
          ?' • partial connection'
          :''
      );
  }

  syncSmartExecutiveDashboard_({
    project:project,
    tower:tower,
    financial:financial,
    costCompletion:costCompletion,
    overall:overall,
    overallText:overallText,
    constraints:constraints.length,
    pending:pending
  });
}

function resetSelect(id,t){
  document.getElementById(id).innerHTML=
    '<option value="">'+t+'</option>';
}

const ACTIVITY_DRAFT_KEY=
  "LCRG_OLC_ACTIVITY_DRAFT_V1";

let draftAutosaveTimer=null,
    draftAutosaveBound=false;

function updateNetworkStatus(){
  const el=
    document.getElementById(
      "networkStatusBadge"
    );

  if(el){
    const online=
      navigator.onLine;

    el.className=
      "network-status "+
      (online?"online":"offline");

    el.innerText=
      online
        ?"● Online"
        :"● Offline — draft stays on this device";
  }
}

window.addEventListener(
  "online",
  updateNetworkStatus
);

window.addEventListener(
  "offline",
  updateNetworkStatus
);

function activityDraftFieldIds(){
  return [
    "project",
    "tower",
    "floor",
    "locationType",
    "apartment",
    "specificLocation",
    "trade",
    "subTrade",
    "activity",
    "contractor",
    "quantity",
    "unit",
    "workStatus",
    "startDate",
    "plannedCompletionDate",
    "actualCompletionDate",
    "todayQuantity",
    "cumulativeQuantity",
    "inspectionRequired",
    "inspectionStatus",
    "inspectionDate",
    "inspector",
    "inspectionRemarks",
    "housekeepingStatus",
    "housekeepingRemarks",
    "supervisorRemarks",
    "issueConstraint",
    "actionRequired",
    "workFrontAvailable",
    "materialAvailable",
    "drawingApprovalAvailable",
    "delayCategory",
    "siteLatitude",
    "siteLongitude",
    "siteGpsAccuracy",
    "siteLocationCapturedAt"
  ];
}
function renderProcurement(){
  const q=value("procurementSearch").toLowerCase(),tower=value("procurementTowerFilter"),status=value("procurementStatusFilter");

  const rows=procurementData.filter(r=>{
    const s=[r.packageName,r.vendor,r.tower,r.remarks].join(" ").toLowerCase();
    return (!q||s.includes(q))&&(!tower||r.tower===tower)&&(!status||r.status===status);
  });

  const delivered=rows.filter(r=>["Delivered","Closed"].includes(r.status)).length;
  const awarded=rows.filter(r=>["Awarded","Manufacturing","Shipped","Delivered","Closed"].includes(r.status)).length;
  const late=rows.filter(r=>r.isLate||r.isAtRisk).length;
  const totalValue=rows.reduce((a,r)=>a+Number(r.packageValue||0),0);

  setText("procKpiTotal",rows.length);
  setText("procKpiAwarded",awarded);
  setText("procKpiDelivered",delivered);
  setText("procKpiLate",late);
  setText("procKpiValue",cockpitMoney(totalValue));

  const box=document.getElementById("procurementTableContainer");

  if(!rows.length){
    box.innerHTML='<div class="empty-state">No procurement packages found for this project / filter.</div>';
    return;
  }

  box.innerHTML='<table class="control-table"><thead><tr><th>Package</th><th>Tower / Area</th><th>Vendor</th><th>Status</th><th>Required on Site</th><th>Forecast</th><th>Actual</th><th>Variance</th><th>Lead Time</th><th>Value</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>'+
    rows.map(r=>
      '<tr>'+
        '<td><b>'+escapeHtml(r.packageName)+'</b></td>'+
        '<td>'+escapeHtml(r.tower)+'</td>'+
        '<td>'+escapeHtml(r.vendor||"—")+'</td>'+
        '<td><span class="control-status '+slugify(r.status)+'">'+escapeHtml(r.status)+'</span></td>'+
        '<td>'+escapeHtml(r.requiredDate)+'</td>'+
        '<td>'+escapeHtml(r.forecastDate)+'</td>'+
        '<td>'+escapeHtml(r.actualDate||"—")+'</td>'+
        '<td class="'+(Number(r.varianceDays)>0?"control-danger":Number(r.varianceDays)<0?"control-good":"")+'">'+Number(r.varianceDays||0)+' d</td>'+
        '<td>'+Number(r.leadTimeDays||0)+' d</td>'+
        '<td>'+cockpitMoney(r.packageValue||0)+'</td>'+
        '<td>'+escapeHtml(r.remarks||"")+'</td>'+
        '<td>'+
          '<button class="control-edit" onclick="openProcurementModal(\''+escAttr(r.procurementId)+'\')">Edit</button>'+
          '<button class="control-delete" onclick="deleteProcurementItem(\''+escAttr(r.procurementId)+'\')">Delete</button>'+
        '</td>'+
      '</tr>'
    ).join("")+
    '</tbody></table>';
}

function openProcurementModal(id){
  procurementEditId=id||"";

  const r=
    procurementData.find(
      x=>x.procurementId===procurementEditId
    )||{};

  fillSimpleSelect(
    "procurementProject",
    [getActiveProject()],
    "Project"
  );

  lockProjectSelectToActive_(
    "procurementProject"
  );

  const towers=
    (masterData?.towers||[])
      .filter(
        t=>
          normalizeProjectName_(
            t["Project"]||""
          )===getActiveProject()
      )
      .map(
        t=>t["Tower / Block"]
      )
      .filter(Boolean);

  fillSimpleSelect(
    "procurementTower",
    [...new Set(towers)],
    "Select Tower / Area"
  );

  document.getElementById(
    "procurementTower"
  ).value=r.tower||"";

  document.getElementById(
    "procurementPackage"
  ).value=r.packageName||"";

  document.getElementById(
    "procurementVendor"
  ).value=r.vendor||"";

  document.getElementById(
    "procurementStatus"
  ).value=r.status||"Planned";

  document.getElementById(
    "procurementRequiredDate"
  ).value=r.requiredDateInput||"";

  document.getElementById(
    "procurementForecastDate"
  ).value=r.forecastDateInput||"";

  document.getElementById(
    "procurementActualDate"
  ).value=r.actualDateInput||"";

  document.getElementById(
    "procurementLeadTime"
  ).value=r.leadTimeDays??"";

  document.getElementById(
    "procurementValue"
  ).value=r.packageValue??"";

  document.getElementById(
    "procurementRemarks"
  ).value=r.remarks||"";

  setText(
    "procurementModalTitle",
    procurementEditId
      ?"Edit Procurement Package"
      :"Add Procurement Package"
  );

  setText(
    "procurementMessage",
    ""
  );

  document.getElementById(
    "procurementModal"
  ).style.display="block";
}

function closeProcurementModal(){
  document.getElementById(
    "procurementModal"
  ).style.display="none";
}

function saveProcurementItem(){
  const payload={
    procurementId:
      procurementEditId,

    project:
      getActiveProject(),

    tower:
      value("procurementTower"),

    packageName:
      value("procurementPackage"),

    vendor:
      value("procurementVendor"),

    status:
      value("procurementStatus"),

    requiredDate:
      value("procurementRequiredDate"),

    forecastDate:
      value("procurementForecastDate"),

    actualDate:
      value("procurementActualDate"),

    leadTimeDays:
      value("procurementLeadTime"),

    packageValue:
      value("procurementValue"),

    remarks:
      value("procurementRemarks")
  };

  const msg=
    document.getElementById(
      "procurementMessage"
    );

  if(
    !payload.project ||
    !payload.tower ||
    !payload.packageName ||
    !payload.status ||
    !payload.requiredDate ||
    !payload.forecastDate
  ){
    msg.style.color="#dc2626";
    msg.innerText=
      "Please complete all mandatory fields.";
    return;
  }

  msg.style.color="#475569";
  msg.innerText="Saving...";

  procurementApi(
    "saveProcurement",
    payload
  )
  .then(r=>{
    msg.style.color="#166534";
    msg.innerText=
      r.message||"Saved.";

    setTimeout(()=>{
      closeProcurementModal();
      loadProcurement();
      loadManagementCockpit();
    },450);
  })
  .catch(e=>{
    msg.style.color="#dc2626";
    msg.innerText=
      e.message||String(e);
  });
}

function deleteProcurementItem(id){
  if(
    !confirm(
      "Delete this procurement package?"
    )
  ){
    return;
  }

  procurementApi(
    "deleteProcurement",
    {
      procurementId:id
    }
  )
  .then(()=>{
    loadProcurement();
    loadManagementCockpit();
  })
  .catch(
    e=>alert(
      e.message||String(e)
    )
  );
}

function openPlaceholderModule(
  icon,
  title,
  text
){
  hideAppPages();

  document.getElementById(
    "placeholderModulePage"
  ).style.display="block";

  document.getElementById(
    "placeholderModuleHeader"
  ).innerText=
    icon+" "+title;

  document.getElementById(
    "placeholderModuleIcon"
  ).innerText=
    icon;

  document.getElementById(
    "placeholderModuleTitle"
  ).innerText=
    title;

  document.getElementById(
    "placeholderModuleText"
  ).innerText=
    text;
}

function toggleDashboardSidebar(open){
  const s=
    document.getElementById(
      "pmcSidebar"
    );

  if(!s){
    return;
  }

  s.classList.toggle(
    "open",
    open!==false
  );
}

function syncDashboardSidebarUser(){
  if(!loggedInUser){
    return;
  }

  const name=
    document.getElementById(
      "sidebarUserName"
    );

  const role=
    document.getElementById(
      "sidebarUserRole"
    );

  const initials=
    document.getElementById(
      "sidebarUserInitials"
    );

  if(name){
    name.innerText=
      loggedInUser.supervisorName ||
      loggedInUser.username ||
      "User";
  }

  if(role){
    role.innerText=
      loggedInUser.role||"";
  }

  if(initials){
    const parts=
      String(
        loggedInUser.supervisorName ||
        loggedInUser.username ||
        "U"
      )
      .trim()
      .split(/\s+/);

    initials.innerText=
      (parts[0]?.[0]||"U")+
      (
        parts.length>1
          ?(parts[parts.length-1][0]||"")
          :""
      );
  }

  syncSmartTopbarUser_();
}

function logout(){
  localStorage.removeItem(
    ACTIVE_PROJECT_KEY
  );

  localStorage.removeItem(
    "managementCockpitProject"
  );

  loggedInUser=null;

  if(
    window.LCRG_API &&
    LCRG_API.clearToken
  ){
    LCRG_API.clearToken();
  }

  location.reload();
}

window.onload=function(){
  let u=
    localStorage.getItem(
      "rememberedUsername"
    );

  if(u){
    document.getElementById(
      "username"
    ).value=u;

    document.getElementById(
      "rememberMe"
    ).checked=true;
  }

  updateStepDisplay();
  updateNetworkStatus();
  updateDashboardDraftBadge();
};

function parseReportDate(s){
  if(!s){
    return null;
  }

  const m=
    String(s).match(
      /(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/
    );

  if(!m){
    return null;
  }

  const months={
    Jan:0,
    Feb:1,
    Mar:2,
    Apr:3,
    May:4,
    Jun:5,
    Jul:6,
    Aug:7,
    Sep:8,
    Oct:9,
    Nov:10,
    Dec:11
  };

  return new Date(
    Number(m[3]),
    months[m[2]],
    Number(m[1]),
    Number(m[4]||0),
    Number(m[5]||0)
  );
}

function resetMyReportFilters(){
  [
    "reportSearch",
    "reportProject",
    "reportTower",
    "reportFloor",
    "reportStatus",
    "reportFromDate",
    "reportToDate"
  ].forEach(id=>{
    const el=
      document.getElementById(id);

    if(el){
      el.value="";
    }
  });

  applyReportFilters();
}

/* ===== extracted script block ===== */

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    function() {
      navigator.serviceWorker
        .register(
          "./service-worker.js"
        )
        .catch(
          function(err) {
            console.warn(
              "Service worker registration failed:",
              err
            );
          }
        );
    }
  );
}
