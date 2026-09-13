/* PMC App Stability & Performance V1.1
   - Central reliability layer for the Apps Script HTTP API.
   - Deduplicates simultaneous read requests and keeps a short read memory cache.
   - Retries transient READ failures once; never auto-retries mutations.
   - Persists the last successful Master Data response for reliable project selection.
   - Replaces the legacy two-project emergency fallback with last-known-good Master Data.
   - Adds lightweight API timing diagnostics in the browser console.
*/
(function(){
  "use strict";
  if(window.__PMC_STABILITY_V1__)return;
  window.__PMC_STABILITY_V1__=true;

  const MASTER_CACHE_KEY="pmcMasterDataApiResponseV1";
  const MASTER_CACHE_AT_KEY="pmcMasterDataApiResponseAtV1";
  const MASTER_MAX_AGE=24*60*60*1000;
  const READ_MEMORY_TTL=45000;
  const RETRY_DELAY=700;
  const READ_TIMEOUT=25000;
  const previousFetch=window.fetch.bind(window);
  const inFlight=new Map();
  const memory=new Map();

  const READ_ACTIONS=new Set([
    "masterData","activities","reports","pendingInspections","dailySummary",
    "executiveReport","boqCost","actionRegister","actionHistory","drawings",
    "administrationData","programme","procurement","designIssues","designChanges",
    "designLookAhead","cashFlow","cashflow"
  ]);

  function wait(ms){return new Promise(r=>setTimeout(r,ms));}
  function apiUrl(){return String(window.LCRG_APP_CONFIG&&window.LCRG_APP_CONFIG.API_URL||"");}
  function isApi(input){const u=typeof input==="string"?input:(input&&input.url)||"";return !!apiUrl()&&String(u)===apiUrl();}
  function parseRequest(init){
    try{
      const body=String(init&&init.body||"");
      const j=JSON.parse(body);
      return {body,action:String(j&&j.action||"").trim(),data:j&&j.data||{}};
    }catch(_e){return {body:"",action:"",data:{}};}
  }
  function cacheKey(req){return req.action+"|"+JSON.stringify(req.data||{});}
  function cloneHeaders(headers){const out={};try{headers.forEach((v,k)=>out[k]=v);}catch(_e){}return out;}
  function makeResponse(entry){return new Response(entry.text,{status:entry.status||200,statusText:entry.statusText||"OK",headers:entry.headers||{"content-type":"text/plain;charset=utf-8"}});}
  function getMasterFallback(){
    try{
      const at=Number(localStorage.getItem(MASTER_CACHE_AT_KEY)||0);
      const raw=localStorage.getItem(MASTER_CACHE_KEY)||"";
      if(!raw||!at||Date.now()-at>MASTER_MAX_AGE)return null;
      const j=JSON.parse(raw);
      if(!j||!j.ok||!j.data||!Array.isArray(j.data.projects)||!j.data.projects.length)return null;
      return {text:raw,status:200,statusText:"OK",headers:{"content-type":"text/plain;charset=utf-8"}};
    }catch(_e){return null;}
  }
  function saveMaster(text){
    try{
      const j=JSON.parse(text);
      if(j&&j.ok&&j.data&&Array.isArray(j.data.projects)&&j.data.projects.length){
        localStorage.setItem(MASTER_CACHE_KEY,text);
        localStorage.setItem(MASTER_CACHE_AT_KEY,String(Date.now()));
      }
    }catch(_e){}
  }
  function transientStatus(s){return [408,425,429,500,502,503,504].includes(Number(s));}
  async function timedFetch(input,init,timeoutMs){
    const controller=new AbortController();
    const t=setTimeout(()=>controller.abort(),timeoutMs||READ_TIMEOUT);
    const opts=Object.assign({},init||{}, {signal:controller.signal});
    try{return await previousFetch(input,opts);}finally{clearTimeout(t);}
  }
  async function performRead(input,init,req,attempt){
    const started=performance.now();
    try{
      const response=await timedFetch(input,init,READ_TIMEOUT);
      const text=await response.clone().text();
      let valid=false;
      try{JSON.parse(text);valid=true;}catch(_e){}
      const bad=!response.ok||transientStatus(response.status)||!valid;
      if(bad&&attempt===0){await wait(RETRY_DELAY);return performRead(input,init,req,1);}
      if(bad)throw new Error(!valid?"API returned a non-JSON response.":"API returned HTTP "+response.status+".");
      const entry={text,status:response.status,statusText:response.statusText,headers:cloneHeaders(response.headers),at:Date.now()};
      if(req.action==="masterData")saveMaster(text);
      memory.set(cacheKey(req),entry);
      console.info("[PMC API]",req.action,Math.round(performance.now()-started)+" ms",attempt?"(retry)":"");
      return makeResponse(entry);
    }catch(err){
      if(attempt===0){await wait(RETRY_DELAY);return performRead(input,init,req,1);}
      if(req.action==="masterData"){
        const fallback=getMasterFallback();
        if(fallback){
          console.warn("[PMC API] masterData unavailable; using last successful cached Master Data.");
          return makeResponse(fallback);
        }
      }
      console.warn("[PMC API]",req.action,"failed:",err&&err.message||err);
      throw err;
    }
  }

  window.fetch=function(input,init){
    const method=String(init&&init.method||"GET").toUpperCase();
    if(method!=="POST"||!isApi(input))return previousFetch(input,init);
    const req=parseRequest(init);
    if(!req.action)return previousFetch(input,init);

    if(req.action==="login")return previousFetch(input,init);

    if(!READ_ACTIONS.has(req.action)){
      memory.clear();
      return previousFetch(input,init);
    }

    const k=cacheKey(req),cached=memory.get(k);
    if(cached&&Date.now()-cached.at<READ_MEMORY_TTL)return Promise.resolve(makeResponse(cached));
    if(inFlight.has(k))return inFlight.get(k).then(r=>r.clone());

    const p=performRead(input,init,req,0).finally(()=>inFlight.delete(k));
    inFlight.set(k,p);
    return p.then(r=>r.clone());
  };

  function installProjectLauncherFix(){
    if(typeof window.loadProjectLauncher!=="function"||typeof window.renderProjectLauncher!=="function")return false;
    if(window.loadProjectLauncher.__pmcStable)return true;

    const stable=function(){
      const grid=document.getElementById("projectLauncherGrid");
      const count=document.getElementById("projectLauncherCount");
      if(grid)grid.innerHTML='<div class="project-launcher-loading">Loading active projects...</div>';
      if(count){count.innerText="Loading projects...";count.title="";}

      google.script.run
        .withSuccessHandler(function(d){
          try{masterData=d||masterData||{};}catch(_e){}
          try{projectLauncherData=Array.isArray(d&&d.projects)?d.projects:[];}catch(_e){}
          try{window.renderProjectLauncher();}catch(e){console.error(e);}
        })
        .withFailureHandler(function(e){
          console.error("Project launcher Master Data load failed:",e);
          let cached=null;
          try{
            const raw=localStorage.getItem(MASTER_CACHE_KEY)||"";
            const j=raw?JSON.parse(raw):null;
            cached=j&&j.ok&&j.data?j.data:null;
          }catch(_e){}
          if(cached&&Array.isArray(cached.projects)&&cached.projects.length){
            try{masterData=cached;}catch(_e){}
            try{projectLauncherData=cached.projects;}catch(_e){}
            try{window.renderProjectLauncher();}catch(_e){}
            if(count)count.title="Live Master Data is temporarily unavailable. Showing the last successful project list.";
            return;
          }
          try{projectLauncherData=[];}catch(_e){}
          if(grid)grid.innerHTML='<div class="project-launcher-loading">Projects could not be loaded. Please press Refresh or sign in again.</div>';
          if(count){count.innerText="Project data unavailable";count.title="No last-known-good Master Data is available on this device.";}
        })
        .getMasterData();
    };
    stable.__pmcStable=true;
    window.loadProjectLauncher=stable;
    return true;
  }

  let tries=0;
  const timer=setInterval(function(){
    tries++;
    if(installProjectLauncherFix()||tries>60)clearInterval(timer);
  },250);

  window.PMC_STABILITY={
    version:"1.1",
    readCacheSeconds:45,
    clearReadCache:function(){memory.clear();},
    clearMasterDataCache:function(){localStorage.removeItem(MASTER_CACHE_KEY);localStorage.removeItem(MASTER_CACHE_AT_KEY);},
    masterDataCached:function(){return !!getMasterFallback();}
  };
})();