/* MR,KHORASANI v1.6 — Supabase production client (no service-role key) */
(function(){
  const CONFIG = window.MRK_SUPABASE || {
    url: 'https://klomsegarpfdkhkmoazy.supabase.co',
    publishableKey: 'sb_publishable_bkwQJ96fqM2zd0yu0XQ6LA_QJl2c2RV'
  };
  const TOKEN_KEY='mrk-supabase-session-v1';
  const jsonHeaders=token=>({
    'Content-Type':'application/json',
    'apikey':CONFIG.publishableKey,
    ...(token?{'Authorization':'Bearer '+token}:{})
  });
  const readSession=()=>{try{return JSON.parse(localStorage.getItem(TOKEN_KEY)||'null')}catch{return null}};
  const saveSession=s=>{try{const v={...s};if(!v.expires_at)v.expires_at=Math.floor(Date.now()/1000)+Number(v.expires_in||3600);localStorage.setItem(TOKEN_KEY,JSON.stringify(v))}catch{}};
  const clearSession=()=>{try{localStorage.removeItem(TOKEN_KEY)}catch{}};
  async function refreshSession(force=false){
    const s=readSession();if(!s?.refresh_token)return s;
    const exp=Number(s.expires_at||0);if(!force&&exp>Math.floor(Date.now()/1000)+60)return s;
    const r=await fetch(CONFIG.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:jsonHeaders(),body:JSON.stringify({refresh_token:s.refresh_token})});
    const t=await r.text();let body=null;try{body=t?JSON.parse(t):null}catch{}
    if(!r.ok){clearSession();throw new Error(body?.error_description||body?.msg||'نشست منقضی شده است؛ دوباره وارد شوید.')}
    saveSession(body);return readSession();
  }
  async function req(path,options={}){
    const s=await refreshSession();
    const h={...jsonHeaders(s?.access_token),...(options.headers||{})};
    const r=await fetch(CONFIG.url+path,{...options,headers:h});
    const text=await r.text();
    let body=null; try{body=text?JSON.parse(text):null}catch{body=text}
    if(!r.ok) throw new Error(body?.msg||body?.message||body?.error_description||body?.error||('HTTP '+r.status));
    return body;
  }
  async function login(email,password){
    const r=await fetch(CONFIG.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:jsonHeaders(),body:JSON.stringify({email,password})});
    const text=await r.text(); let body=null; try{body=JSON.parse(text)}catch{}
    if(!r.ok) throw new Error(body?.error_description||body?.msg||'ورود ابری ناموفق بود.');
    saveSession(body); return body;
  }
  async function user(){return req('/auth/v1/user');}
  async function logout(){
    const s=readSession();
    try{if(s?.access_token) await fetch(CONFIG.url+'/auth/v1/logout',{method:'POST',headers:jsonHeaders(s.access_token)});}finally{clearSession();}
    return true;
  }
  async function profile(companyId,uid){
    const r=await req('/rest/v1/company_user_profiles?company_id=eq.'+encodeURIComponent(companyId)+'&user_id=eq.'+encodeURIComponent(uid)+'&select=display_name,job_title,role_key,permission_keys,is_active');
    return r?.[0]||null;
  }
  async function manageUsers(payload){
    const s=await refreshSession(); if(!s?.access_token) throw new Error('ابتدا با حساب سازمانی وارد شوید.');
    const r=await fetch(CONFIG.url+'/functions/v1/manage-company-users',{method:'POST',headers:{...jsonHeaders(s.access_token)},body:JSON.stringify(payload||{})});
    const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch{j={error:t}}
    if(!r.ok)throw new Error(j?.error||'مدیریت کاربران ناموفق بود.');return j;
  }
  async function memberships(uid){return req('/rest/v1/company_members?user_id=eq.'+encodeURIComponent(uid)+'&is_active=eq.true&select=company_id,role,is_active');}
  async function company(id){const r=await req('/rest/v1/companies?id=eq.'+encodeURIComponent(id)+'&select=*');return r?.[0]||null;}
  async function claimInitialCompany(name){return req('/rest/v1/rpc/claim_initial_company',{method:'POST',body:JSON.stringify({p_company_name:name||'MR,KHORASANI'})});}
  function roleFa(code){return ({OWNER:'مدیر عامل',ADMIN:'مدیر سیستم',FINANCE:'مدیر مالی',ACCOUNTANT:'حسابدار',SALES:'فروش',PURCHASE:'خرید',CASHIER:'صندوقدار',WAREHOUSE:'انباردار',AUDITOR:'حسابرس',VIEWER:'ناظر'}[String(code||'').toUpperCase()])||'حسابدار';}
  function scrub(state){
    const s=JSON.parse(JSON.stringify(state||{}));
    delete s.password; delete s.passwordHash; delete s.passwordSalt;
    // Real user identities and permissions live in Supabase Auth + company_members/profile tables.
    // Never replicate local PIN credentials or legacy local user accounts in a shared company snapshot.
    s.users=[];
    delete s.syncKey; delete s.syncUrl;
    s.schemaVersion='2.1.0';
    return s;
  }
  async function pushState(companyId,state,expectedUpdatedAt=null){
    if(!companyId||!/^[0-9a-f-]{36}$/i.test(companyId)) throw new Error('شناسه شرکت ابری معتبر نیست.');
    const result=await req('/rest/v1/rpc/save_app_state_snapshot',{method:'POST',body:JSON.stringify({p_company_id:companyId,p_state:scrub(state),p_schema_version:'2.1.0',p_expected_updated_at:expectedUpdatedAt})});
    return {updated_at:result};
  }
  async function pullState(companyId){
    if(!companyId) throw new Error('شرکت فعال انتخاب نشده است.');
    const r=await req('/rest/v1/app_state_snapshots?company_id=eq.'+encodeURIComponent(companyId)+'&select=state,schema_version,updated_at');
    return r?.[0]||null;
  }
  async function uploadDocument(companyId,path,file){
    if(!companyId||!file) throw new Error('اطلاعات سند ناقص است.');
    const s=await refreshSession();
    const safe=String(path||file.name).replace(/^\/+/, '').replace(/\.\.+/g,'.');
    const objectPath=companyId+'/'+safe;
    const r=await fetch(CONFIG.url+'/storage/v1/object/mrk-documents/'+encodeURIComponent(objectPath).replace(/%2F/g,'/'),{method:'POST',headers:{...jsonHeaders(s?.access_token),'x-upsert':'true'},body:file});
    if(!r.ok) throw new Error('ذخیره سند در Storage ناموفق بود.');
    return {path:objectPath};
  }
  async function uploadBackup(companyId,fileName,blob){
    const s=await refreshSession(); const objectPath=companyId+'/'+fileName;
    const r=await fetch(CONFIG.url+'/storage/v1/object/mrk-backups/'+encodeURIComponent(objectPath).replace(/%2F/g,'/'),{method:'POST',headers:{...jsonHeaders(s?.access_token),'x-upsert':'true'},body:blob});
    if(!r.ok) throw new Error('ذخیره Backup ابری ناموفق بود.');
    return {path:objectPath};
  }
  async function guestAudit(limit=100){
    const s=await refreshSession();if(!s?.access_token)throw new Error('برای مشاهده گزارش مهمان، ابتدا با حساب مدیر وارد شوید.');
    const r=await fetch(CONFIG.url+'/functions/v1/mrk-guest-demo',{method:'POST',headers:jsonHeaders(s.access_token),body:JSON.stringify({action:'admin',limit:Math.min(100,Math.max(1,Number(limit)||100))})});
    const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch{j={error:t}}
    if(!r.ok||j?.ok===false)throw new Error(j?.error||'دریافت گزارش مهمان ناموفق بود.');return j;
  }
  window.MRKCloud={CONFIG,readSession,saveSession,clearSession,refreshSession,login,logout,user,profile,memberships,company,claimInitialCompany,manageUsers,roleFa,pushState,pullState,uploadDocument,uploadBackup,guestAudit,ready:true};
})();