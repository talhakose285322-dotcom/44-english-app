// Test-only stand-in for Tesseract.js (normally downloaded from jsDelivr): window.__ocr.texts[i] is "recognised"
// from the i-th image; window.__ocr.sizes records the size of each image handed to it.
(function(){
  window.__ocr={texts:[],sizes:[],langs:null,terminated:0};
  window.Tesseract={createWorker:function(langs,oem,opt){
    window.__ocr.langs=langs;var n=0;
    return Promise.resolve({
      recognize:function(cv){
        var i=n++;window.__ocr.sizes.push([cv.width,cv.height]);
        if(opt&&opt.logger)opt.logger({status:'recognizing text',progress:0.5});
        return Promise.resolve({data:{text:window.__ocr.texts[i]||''}});
      },
      terminate:function(){window.__ocr.terminated++;return Promise.resolve()}
    });
  }};
})();
