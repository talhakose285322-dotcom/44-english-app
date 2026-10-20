// Test-only stand-in for speech: records what the app asks for (window.__tts.spoken) instead of speaking.
(function(){
  window.__tts={spoken:[],cancels:0};
  var voices=[{lang:'tr-TR',voiceURI:'tr',name:'Turkish'},{lang:'en-GB',voiceURI:'gb',name:'British'},{lang:'en-US',voiceURI:'us',name:'American'}];
  window.SpeechSynthesisUtterance=function(t){this.text=t};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
    getVoices:function(){return voices},
    cancel:function(){window.__tts.cancels++},
    speak:function(u){window.__tts.spoken.push({text:u.text,rate:u.rate,voice:u.voice&&u.voice.voiceURI,lang:u.lang})},
    onvoiceschanged:null
  }});
})();
