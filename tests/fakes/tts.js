// Test-only stand-in for speech: records what the app asks for (window.__tts.spoken) instead of speaking.
// window.__tts.end() finishes the utterance being spoken (fires its onend), as a real voice would at the end.
(function(){
  var cur=null;
  window.__tts={spoken:[],cancels:0,end:function(){var u=cur;cur=null;if(u&&u.onend)u.onend({})}};
  var voices=[{lang:'tr-TR',voiceURI:'tr',name:'Turkish'},{lang:'en-GB',voiceURI:'gb',name:'British'},{lang:'en-US',voiceURI:'us',name:'American'}];
  window.SpeechSynthesisUtterance=function(t){this.text=t};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
    getVoices:function(){return voices},
    cancel:function(){window.__tts.cancels++;cur=null},
    speak:function(u){cur=u;window.__tts.spoken.push({text:u.text,rate:u.rate,voice:u.voice&&u.voice.voiceURI,lang:u.lang})},
    onvoiceschanged:null
  }});
})();
