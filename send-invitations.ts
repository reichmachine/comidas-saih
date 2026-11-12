// Supabase Edge Function: send-invitations. No secrets in this file.
const SITE='https://comidas.reichmax.com/';
const cors={'Access-Control-Allow-Origin':SITE.slice(0,-1),'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const esc=(x:string)=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({message:'Método no permitido.'},405);
 const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,key=Deno.env.get('RESEND_API_KEY');
 if(!key)return reply({message:'Falta conectar la cuenta de correo para activar el envío automático.'},503);
 const authorization=req.headers.get('Authorization')||'';
 try{
  const input=await req.json();
  // Diagnostic available only from the trusted server dashboard, never to guests.
  if(input.action==='connection-test' && (authorization==='Bearer '+service || Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')).includes(req.headers.get('apikey')||'__missing__'))){
   const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'saih-connection-test-20260922'},body:JSON.stringify({from:'Comidas SAIH <comidas@reichmax.com>',to:['reichmachine@gmail.com'],reply_to:'reichmachine@gmail.com',subject:'Prueba de correo · Comidas SAIH',html:'<div style="font-family:Arial;text-align:center;padding:32px;color:#18324d"><img src="https://comidas.reichmax.com/logo-saih.png" width="180" alt="Comidas SAIH"><h1>¡El correo de Comidas SAIH está conectado!</h1><p>Richard, este es el correo de prueba autorizado.</p><p><a href="https://comidas.reichmax.com/">Abrir Comidas SAIH</a></p><p>Las invitaciones incluirán un botón con el enlace personal de cada invitado.</p></div>',text:'Richard, este es el correo de prueba autorizado de Comidas SAIH. Web: https://comidas.reichmax.com/'} )});
   if(!sent.ok)return reply({message:'El servicio no ha aceptado la prueba.',providerStatus:sent.status},502);
   return reply({test:'sent',id:(await sent.json()).id});
  }
  const auth=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:authorization}});
  if(!auth.ok)return reply({message:'Tu sesión ha caducado. Vuelve a acceder con tu correo.'},401);
  const actor=(await auth.json()).id;
  // Recheck organizer membership before processing any recipients.
  const admin=await fetch(base+'/rest/v1/rpc/saih_admin_snapshot',{method:'POST',headers:{apikey:service,Authorization:authorization,'Content-Type':'application/json'},body:'{}'});
  if(!admin.ok)return reply({message:'No tienes permiso para realizar esta acción. Contacta con Richard.'},403);
  await admin.body?.cancel();
  if(!uuid(input.eventId)||!uuid(input.requestId)||!Array.isArray(input.userIds)||input.userIds.length<1||input.userIds.length>30||!input.userIds.every(uuid)||new Set(input.userIds).size!==input.userIds.length)return reply({message:'Selecciona entre 1 y 30 invitados por envío.'},400);
  const rpc=async(name:string,args:unknown)=>{
   const r=await fetch(base+'/rest/v1/rpc/saih_email_'+name,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(args)});
   if(!r.ok)throw new Error('No se ha preparado el envío. Revisa el plazo, el correo y los envíos anteriores antes de repetir.');
   return r.json();
  };
  const results=[];
  for(const person of input.userIds){
   try{
    const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
    const j=await rpc(input.kind==='attendance'?'prepare_attendance':input.kind==='reminder'?'prepare_reminder':'prepare',{p_actor:actor,p_request:input.requestId,p_meal:input.eventId,p_person:person,p_token:token,...(input.kind==='reminder'?{p_pending_only:input.audience==='pending'}:{})});
    if(j.status==='sent'){results.push({userId:person,status:'sent'});continue;}
    const d=j.data,link=SITE+'#invite='+j.token;
    const reminder=d.kind==='reminder';
    const countdown=reminder?(d.days===0?'Hoy es la comida':d.days===1?'Mañana es la comida':`Quedan ${d.days} días para la comida`):'';
    const summary=reminder?`${d.confirmed} personas confirmadas + ${d.companions} acompañantes · ${d.pending} pendientes`:'';
    let subject=reminder?`${countdown} · ${d.title}`:d.title;
    const button=reminder?'Confirmar o modificar mi asistencia':d.stage==='poll'?'Elegir tipo de comida':'Confirmar disponibilidad';
    const date=d.date?d.date.split('-').reverse().join('/'):'Por decidir';
    let text=`Hola ${d.name}:\n\n${d.title}\n${reminder?countdown+'\n'+summary+'\n':''}Fecha: ${date}\nHora: ${d.time||'Por decidir'}\nLugar: ${d.place||'Por decidir'}\n\n${button}: ${link}\n\nPuedes indicar tus alergias y preferencias en tu ficha. Este enlace es personal; no lo reenvíes.\nSi necesitas ayuda, contacta con Richard.`;
    let html=`<!doctype html><html lang="es"><body style="margin:0;background:#f3f6fa;font-family:Arial,sans-serif;color:#18324d"><div style="max-width:580px;margin:24px auto;background:white;border-radius:20px;padding:32px;text-align:center"><img src="${SITE}logo-saih.png" width="160" alt="Comidas SAIH Tajo"><h1 style="font-size:26px">${esc(d.title)}</h1><p>Hola ${esc(d.name)}, ${reminder?esc(countdown.toLowerCase())+'.':'¡contamos contigo para organizar la próxima comida!'}</p>${reminder?`<p style="padding:16px;background:#edf3fe;border-radius:10px"><strong>${esc(summary)}</strong></p><p>Si aún no has respondido, confirma tu disponibilidad. Si tus planes han cambiado, puedes modificar tu respuesta.</p>`:''}<p><strong>${esc(date)} · ${esc(d.time||'Hora por decidir')}</strong><br>${esc(d.place||'Lugar por decidir')}</p><p style="margin:28px 0"><a href="${link}" style="display:inline-block;padding:16px 24px;background:#245dcc;color:white;border-radius:10px;text-decoration:none;font-weight:bold">${button}</a></p>${d.maps?`<p><a href="${esc(d.maps)}">Cómo llegar</a></p>`:''}${d.website?`<p><a href="${esc(d.website)}">Web del restaurante</a></p>`:''}<p style="font-size:14px;color:#60738b">Puedes indicar tus alergias y preferencias en tu ficha.<br>Este enlace es personal; no lo reenvíes.<br>Si necesitas ayuda, contacta con Richard.</p></div></body></html>`;
    if(d.kind==='attendance'){
     const when=d.days===0?'Hoy es la comida':d.days===1?'Mañana es la comida':`Quedan ${d.days} días para la comida`;
     subject=`${when} · ${d.title}`;
     text=`Hola ${d.name}:\n\n${when}: ${d.title}. Contamos contigo.\nFecha: ${date}\nHora: ${d.time||'Por decidir'}\nLugar: ${d.place||'Por decidir'}\n${d.maps?'Cómo llegar: '+d.maps:''}\n${d.website?'Web del restaurante: '+d.website:''}\n\nEste aviso es informativo. Si no puedes acudir o necesitas cambiar algo, contacta con Richard.`;
     html=`<!doctype html><html lang="es"><body style="margin:0;background:#f3f6fa;font-family:Arial,sans-serif;color:#18324d"><div style="max-width:580px;margin:24px auto;background:white;border-radius:20px;padding:32px;text-align:center"><img src="${SITE}logo-saih.png" width="160" alt="Comidas SAIH Tajo"><h1>${esc(when)}</h1><h2>${esc(d.title)}</h2><p>Hola ${esc(d.name)}, contamos contigo.</p><p style="padding:20px;background:#edf3fe;border-radius:12px"><strong>${esc(date)} · ${esc(d.time||'Hora por decidir')}</strong><br>${esc(d.place||'Lugar por decidir')}</p>${d.maps?`<p><a href="${esc(d.maps)}">Cómo llegar</a></p>`:''}${d.website?`<p><a href="${esc(d.website)}">Web del restaurante</a></p>`:''}<p>Este aviso es informativo. Si no puedes acudir o necesitas cambiar algo, contacta con Richard.</p></div></body></html>`;
    }
    const sent=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':input.requestId+'/'+person},body:JSON.stringify({from:'Comidas SAIH <comidas@reichmax.com>',to:[d.email],reply_to:'reichmachine@gmail.com',subject,html,text})});
    if(!sent.ok)throw new Error('No se ha confirmado el envío. Puedes reintentar este mismo lote.');
    const receipt=await sent.json();
    await rpc('sent',{p_actor:actor,p_request:input.requestId,p_person:person,p_provider:receipt.id});
    results.push({userId:person,status:'sent'});
   }catch{results.push({userId:person,status:'failed',message:'No se ha confirmado el envío. Reintenta este mismo lote; si continúa, contacta con Richard.'});}
   await new Promise(resolve=>setTimeout(resolve,600));
  }
  return reply({results});
 }catch{return reply({message:'No se ha podido completar el envío. Vuelve a intentarlo con el mismo lote.'},500);}
});

