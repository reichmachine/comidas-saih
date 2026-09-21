(function(root){
const uid=()=>globalThis.crypto.randomUUID();
const seed=()=>({version:1,users:Array.from({length:6},(_,i)=>({id:'demo-'+(i+1),name:'Invitado '+String(i+1).padStart(2,'0'),team:['Sistemas','Hidrología','SAD','Operadores','SAICA','Sistemas'][i],email:'',allergyStatus:'unknown',allergies:'',preferences:''})),events:[{id:'comida-demo',title:'Comida de otoño',date:'',place:'Por decidir',deadline:'',stage:'poll',food:'',options:[{id:'cocido',label:'Cocido'},{id:'arroz',label:'Arroces'},{id:'parrilla',label:'Parrilla'},{id:'vegetariano',label:'Menú vegetariano'}],invitations:Array.from({length:6},(_,i)=>({userId:'demo-'+(i+1),response:'pending',vote:null}))}]});
const isExpired=(event,now=new Date())=>Boolean(event.deadline && new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)>event.deadline);
function invite(event,userId){const i=event.invitations.find(i=>i.userId===userId);if(!i)throw Error('Esta persona no está invitada a esta comida.');return i;}
function vote(event,userId,option){if(event.stage!=='poll'||isExpired(event))throw Error('La encuesta ya no admite votos.');if(!event.options.some(o=>o.id===option))throw Error('Elige una opción de la encuesta.');invite(event,userId).vote=option;}
function ready(event){if(!/^\d{4}-\d{2}-\d{2}$/.test(event.date||'')||!/^\d{2}:\d{2}$/.test(event.time||'')||!event.place?.trim()||event.place.trim().toLowerCase()==='por decidir')throw Error('Antes de confirmar asistencia, indica fecha, hora de reserva y lugar.');}
function safeUrl(value){if(!value?.trim())return '';let url;try{url=new URL(value.trim());}catch{throw Error('Escribe un enlace completo que empiece por https://.');}if(url.protocol!=='https:'||url.username||url.password)throw Error('Los enlaces deben empezar por https:// y no incluir credenciales.');return url.href;}
function respond(event,userId,response){ready(event);if(event.stage!=='confirm'||isExpired(event))throw Error('La confirmación está cerrada.');if(!['yes','no','pending'].includes(response))throw Error('Respuesta no válida.');invite(event,userId).response=response;}
function counts(event){return {total:event.invitations.length,yes:event.invitations.filter(i=>i.response==='yes').length,no:event.invitations.filter(i=>i.response==='no').length,pending:event.invitations.filter(i=>i.response==='pending').length,voted:event.invitations.filter(i=>i.vote!==null).length};}
function profile(user,data){if(!['unknown','none','specified'].includes(data.allergyStatus))throw Error('Indica el estado de alergias.');if(data.allergyStatus==='specified'&&!data.allergies.trim())throw Error('Detalla las alergias o intolerancias.');Object.assign(user,{allergyStatus:data.allergyStatus,allergies:data.allergyStatus==='specified'?data.allergies.trim():'',preferences:data.preferences.trim()});}
const csvCell=value=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,m=>"'"+m).replaceAll('"','""')+'"';
const csv=rows=>'\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');
root.SaihCore={uid,seed,isExpired,invite,vote,respond,counts,profile,csv,ready,safeUrl};
if(typeof module!=='undefined')module.exports=root.SaihCore;
})(globalThis);

