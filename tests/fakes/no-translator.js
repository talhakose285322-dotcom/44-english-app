// Test-only: hide the browser's built-in Translator API, so machine translation always goes to the (fixed) MyMemory
// answers and results do not depend on which Chrome version or language models are installed.
(function(){try{delete window.Translator;Object.defineProperty(window,'Translator',{configurable:true,get:function(){return undefined}})}catch(e){}})();
