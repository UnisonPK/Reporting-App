/* Temporary Design Issues API diagnostic helper */
(function(){
  "use strict";
  function install(){
    if(!window.LCRG_API || typeof window.LCRG_API.call!=="function"){
      return setTimeout(install,250);
    }
    if(window.LCRG_API.__designIssuesDiagnosticInstalled)return;
    window.LCRG_API.__designIssuesDiagnosticInstalled=true;
    const original=window.LCRG_API.call.bind(window.LCRG_API);
    window.LCRG_API.call=function(action,data){
      return original(action,data).catch(function(err){
        if(action==="designIssues" || action==="saveDesignIssue"){
          const msg=(err&&err.message)?err.message:String(err||"Unknown error");
          console.error("Design Issues API error:",action,msg,err);
          alert("Design Issues API error: "+msg);
        }
        throw err;
      });
    };
  }
  install();
})();
