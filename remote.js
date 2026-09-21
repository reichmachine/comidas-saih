(function(root){
const cfg=root.SAIH_CONFIG||{},enabled=cfg.mode==='online',SESSION='saih-organizer-session';
// Only approved user-facing messages are displayed; service details stay private.
const spanishMessages=new Set(["Antes de confirmar asistencia, indica fecha, hora de reserva y lugar.", "Añade al menos dos opciones.", "Añade al menos una persona antes de crear la comida.", "Añade personas antes de crear la comida.", "Cada opción puede tener hasta 100 caracteres.", "Completa nombre y equipo.", "Detalla las alergias o intolerancias.", "El enlace no es válido o ha caducado.", "El enlace no es válido o ha caducado. Pide uno nuevo a la organización.", "El enlace no es válido.", "El plazo de respuesta no puede ser posterior a la comida.", "El servicio devolvió una respuesta inesperada.", "Elige una opción de la encuesta.", "Encuesta no válida.", "Escribe el nombre de la comida.", "Escribe un enlace completo que empiece por https://.", "Esta persona no está invitada a esta comida.", "Esta persona no está invitada a la comida.", "Este correo no tiene acceso de organización.", "Falta completar la conexión y la dirección pública de la web.", "Falta conectar la cuenta de correo para activar el envío automático.", "Hay opciones repetidas.", "Indica el estado de alergias.", "Indica fecha, hora y lugar antes de abrir la confirmación.", "La comida ha cambiado. Actualiza antes de editarla.", "La confirmación está cerrada.", "La encuesta está cerrada.", "La encuesta necesita entre 2 y 8 opciones.", "La encuesta ya no admite votos.", "La fecha, hora o lugar no están definidos.", "La ficha ha cambiado. Actualiza la página antes de editarla.", "La ficha ha cambiado. Actualiza la página y vuelve a intentarlo.", "La operación debe modificar una única ficha o comida.", "Las opciones de una encuesta existente no se pueden sustituir.", "Los detalles de la comida han cambiado. Actualiza antes de responder.", "Los enlaces deben empezar por https:// y no incluir credenciales.", "No se pudo guardar. El navegador tiene el almacenamiento bloqueado o lleno.", "Opción no válida.", "Respuesta no válida.", "Token no válido.", "Ya existe una persona con ese correo."]);
spanishMessages.add('El enlace no es válido o ha caducado. Pide uno nuevo a Richard.');
function errorMessage(error,status=0){
 const message=typeof error==='string'?error:(error?.message||error?.msg||error?.error_description||'');
 const code=error?.code||error?.error_code||'';
 if(spanishMessages.has(message))return message.replace('Pide uno nuevo a la organización.', 'Pide uno nuevo a Richard.');
 if(code==='signup_disabled'||code==='user_not_found'||/signups not allowed|user not found/i.test(message))return 'Este correo no está registrado para acceder al evento. Comprueba la dirección o contacta con Richard.';
 if(code==='email_address_invalid'||/invalid email address|email address.*invalid/i.test(message))return 'Introduce una dirección de correo válida.';
 if(status===429||/rate.limit|too many requests|security purposes|too many emails/i.test(message))return 'Has realizado demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
 if(/expired|otp_expired|invalid.*token|invalid.*jwt/i.test(code+' '+message))return 'El enlace de acceso ha caducado o no es válido. Solicita uno nuevo.';
 if(status===401||/session.*missing|not authenticated/i.test(message))return 'Tu sesión ha caducado. Vuelve a acceder con tu correo.';
 if(status===403||code==='42501'||/permission denied|access denied|not authorized/i.test(message))return 'No tienes permiso para realizar esta acción. Contacta con Richard.';
 if(code==='23505')return 'Ya existe un registro con esos datos. Revisa el correo introducido.';
 if(['23514','23502','22P02','22007','22008'].includes(code))return 'Revisa los datos del formulario: falta algún campo o su formato no es válido.';
 if(/fetch|network|load failed|offline/i.test(message))return 'No se ha podido conectar. Comprueba tu conexión a Internet y vuelve a intentarlo.';
 if(status>=500||/email.*send|sending.*email|smtp/i.test(message))return 'El servicio no está disponible en este momento. Vuelve a intentarlo dentro de unos minutos.';
 return 'No se ha podido completar la operación. Vuelve a intentarlo. Si el problema continúa, contacta con Richard.';
}
let access='',guestToken='';
const headers=()=>({'Content-Type':'application/json',apikey:cfg.publishableKey,...(access?{Authorization:'Bearer '+access}:{})});
async function request(path,payload,method='POST'){
 const res=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+path,{method,headers:headers(),...(payload!==undefined?{body:JSON.stringify(payload)}:{})});
 const text=await res.text();let value;try{value=text?JSON.parse(text):null;}catch{throw Error('El servicio devolvió una respuesta inesperada.');}
 if(!res.ok){if(res.status===401){access='';sessionStorage.removeItem(SESSION);}throw Error(errorMessage(value,res.status));}return value;
}
const rpc=(name,args={})=>request('/rest/v1/rpc/saih_'+name,args);
async function initialize(){
 if(!enabled)return {role:'admin'};
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl)||!cfg.publishableKey||!/^https:\/\//.test(cfg.siteUrl))throw Error('Falta completar la conexión y la dirección pública de la web.');
 const hash=new URLSearchParams(location.hash.slice(1));
 guestToken=hash.get('invite')||'';
 const short=hash.get('i');if(short){if(!/^[A-Za-z0-9_-]{43}$/.test(short))throw Error('El enlace no es válido.');guestToken=Array.from(atob(short.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');}
 if(guestToken){access='';return {role:'guest',data:await snapshot()};}
 const token=hash.get('access_token');
 if(hash.get('error_description')){history.replaceState(null,'',location.pathname+location.search);throw Error(errorMessage({message:hash.get('error_description'),code:hash.get('error_code')}));}
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
async function invitation(eventId,userId){const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');await rpc('issue_invitation',{p_event:eventId,p_user:userId,p_token:token});const url=new URL(cfg.siteUrl);url.hash='i='+btoa(String.fromCharCode(...token.match(/../g).map(x=>parseInt(x,16)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return url.href;}
async function sendInvitations(eventId,userIds,requestId){if(!cfg.emailEnabled)throw Error('Falta conectar la cuenta de correo para activar el envío automático.');return request('/functions/v1/send-invitations',{eventId,userIds,requestId});}
for(const text of errorMessage.toString().matchAll(/return '([^']+)'/g))spanishMessages.add(text[1]);
root.SaihRemote={errorMessage,emailEnabled:!!cfg.emailEnabled,sendInvitations,enabled,initialize,login,logout,snapshot,apply,invitation};
})(globalThis);



