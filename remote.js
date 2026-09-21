(function(root){
const cfg=root.SAIH_CONFIG||{},enabled=cfg.mode==='online',SESSION='saih-organizer-session';
let access='',guestToken='';
const headers=()=>({'Content-Type':'application/json',apikey:cfg.publishableKey,...(access?{Authorization:'Bearer '+access}:{})});
async function request(path,payload,method='POST'){
 const res=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+path,{method,headers:headers(),...(payload!==undefined?{body:JSON.stringify(payload)}:{})});
 const text=await res.text();let value;try{value=text?JSON.parse(text):null;}catch{throw Error('El servicio devolvió una respuesta inesperada.');}
 if(!res.ok){if(res.status===401){access='';sessionStorage.removeItem(SESSION);}throw Error(value?.message||value?.msg||value?.error_description||'No se pudo conectar. Inténtalo de nuevo.');}return value;
}
const rpc=(name,args={})=>request('/rest/v1/rpc/saih_'+name,args);
async function initialize(){
 if(!enabled)return {role:'admin'};
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl)||!cfg.publishableKey||!/^https:\/\//.test(cfg.siteUrl))throw Error('Falta completar la conexión y la dirección pública de la web.');
 const hash=new URLSearchParams(location.hash.slice(1));
 guestToken=hash.get('invite')||'';
 if(guestToken){access='';return {role:'guest',data:await snapshot()};}
 const token=hash.get('access_token');
 if(hash.get('error_description')){history.replaceState(null,'',location.pathname+location.search);throw Error(hash.get('error_description'));}
 access=token||sessionStorage.getItem(SESSION)||'';
 if(token){history.replaceState(null,'',location.pathname+location.search);}
 if(!access)return {role:'login'};
 try{await request('/auth/v1/user',undefined,'GET');const data=await snapshot();sessionStorage.setItem(SESSION,access);return {role:'admin',data};}catch(error){access='';sessionStorage.removeItem(SESSION);throw error;}
}
const snapshot=()=>rpc(guestToken?'guest_view':'admin_snapshot',guestToken?{p_token:guestToken}:{});
async function login(email){await request('/auth/v1/otp?redirect_to='+encodeURIComponent(cfg.siteUrl),{email,create_user:false});}
async function logout(){try{if(access)await request('/auth/v1/logout',{});}finally{access='';sessionStorage.removeItem(SESSION);}}
async function apply(before,after,role){
 // Send only the intended mutation: never write a cached database snapshot.
 const changedUsers=after.users.filter(u=>JSON.stringify(u)!==JSON.stringify(before.users.find(x=>x.id===u.id)));
 const changedEvents=after.events.filter(e=>JSON.stringify(e)!==JSON.stringify(before.events.find(x=>x.id===e.id)));
 if(changedUsers.length+changedEvents.length===0)return await snapshot();
 if(changedUsers.length+changedEvents.length!==1)throw Error('La operación debe modificar una única ficha o comida.');
 if(changedUsers.length){const u=changedUsers[0];await rpc(role==='guest'?'guest_profile':'save_user',role==='guest'?{p_token:guestToken,p_profile:u}:{p_user:u});}
 if(changedEvents.length){const e=changedEvents[0];if(role==='admin')await rpc('save_event',{p_event:e});else{const old=before.events.find(x=>x.id===e.id),next=e.invitations[0],prev=old.invitations[0];if(next.vote!==prev.vote)await rpc('guest_vote',{p_token:guestToken,p_option:next.vote,p_revision:e.revision});else await rpc('guest_reply',{p_token:guestToken,p_response:next.response,p_revision:e.revision});}}
 return await snapshot();
}
async function invitation(eventId,userId){const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');await rpc('issue_invitation',{p_event:eventId,p_user:userId,p_token:token});const url=new URL(cfg.siteUrl);url.hash='invite='+token;return url.href;}
root.SaihRemote={enabled,initialize,login,logout,snapshot,apply,invitation};
})(globalThis);
