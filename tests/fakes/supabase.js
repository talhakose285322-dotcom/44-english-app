// Test-only stand-in for supabase-js, injected before the page loads. The app sees window.supabase and so never loads
// the real library or contacts Supabase. Signed out by default. Test control lives in window.__sb:
//   __sb.signIn(user)  sign in (fires onAuthStateChange)    __sb.row  the in-memory cloud_backups row (or null)
//   __sb.fail = 'select' | 'upsert' | 'otp'  make that call fail    __sb.calls  what the app asked for
//   __sb.created  how many clients the app created (0 = the library was never needed)
//   sessionStorage '__sb_user' (JSON)  a saved session that getSession returns, as after a page reload
(function(){
  var cb=null,user=null;
  try{user=JSON.parse(sessionStorage.getItem('__sb_user')||'null')}catch(e){}
  var sb=window.__sb={row:null,fail:null,calls:[],created:0};
  sb.signIn=function(u){user=u;cb&&cb('SIGNED_IN',{user:u})};
  function err(m){return Promise.resolve({data:null,error:{message:m}})}
  function table(){
    var st={cols:'',up:null,filters:{}},api={
      select:function(c){st.cols=c||'';return api},
      eq:function(k,v){st.filters[k]=v;return api},
      maybeSingle:function(){sb.calls.push('select');if(sb.beforeSelect){var hook=sb.beforeSelect;sb.beforeSelect=null;hook()}if(sb.fail==='select')return err('network down');
        if(!sb.row||Object.keys(st.filters).some(function(k){return sb.row[k]!==st.filters[k]}))return Promise.resolve({data:null,error:null});
        var o={};st.cols.split(',').forEach(function(k){k=k.trim();o[k]=sb.row[k]});return Promise.resolve({data:o,error:null})},
      upsert:function(o){st.up=o;return api},
      single:function(){sb.calls.push('upsert');if(sb.beforeUpsert){var hook=sb.beforeUpsert;sb.beforeUpsert=null;hook()}if(sb.fail==='upsert')return err('upload failed');
        sb.row={user_id:st.up.user_id,data:st.up.data,updated_at:new Date().toISOString()};
        return Promise.resolve({data:{updated_at:sb.row.updated_at},error:null})}
    };
    return api;
  }
  window.supabase={createClient:function(){sb.created++;return {
    auth:{
      onAuthStateChange:function(f){cb=f;return {data:{subscription:{unsubscribe:function(){}}}}},
      getSession:function(){return Promise.resolve({data:{session:user?{user:user}:null},error:null})},
      signInWithOAuth:function(o){sb.calls.push('oauth:'+(o&&o.provider)+':'+((o&&o.options&&o.options.queryParams&&o.options.queryParams.prompt)||''));return Promise.resolve({error:null})},
      signInWithOtp:function(o){sb.calls.push('otp:'+o.email);return sb.fail==='otp'?err('For security purposes, you can only request this after 37 seconds.'):Promise.resolve({data:{},error:null})},
      verifyOtp:function(o){sb.calls.push('verify:'+o.token);if(o.token!=='123456')return err('Token has expired or is invalid');
        var u={id:'u-email',email:o.email,app_metadata:{provider:'email',providers:['email']}};setTimeout(function(){sb.signIn(u)},0);
        return Promise.resolve({data:{session:{user:u}},error:null})},
      signOut:function(){user=null;setTimeout(function(){cb&&cb('SIGNED_OUT',null)},0);return Promise.resolve({error:null})}
    },
    from:function(){return table()}
  }}};
})();
