-- Aviso informativo independiente del plazo de votación. No cambia enlaces ni respuestas.
begin;
create or replace function public.saih_email_prepare_attendance(p_actor uuid,p_request uuid,p_meal uuid,p_person uuid,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j saih_private.email_jobs; m saih_private.meals; p saih_private.people; body jsonb;
begin
 if not exists(select 1 from saih_private.organizers where user_id=p_actor) then raise exception 'No autorizado';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_request::text||p_person::text,0));
 select * into m from saih_private.meals where id=p_meal for share;
 if not found or m.stage='poll' or m.meal_date is null or m.meal_date<timezone('Europe/Madrid',now())::date then raise exception 'La comida no admite recordatorios';end if;
 perform 1 from saih_private.invitations where meal_id=p_meal and person_id=p_person and response='yes' for share;
 if not found then raise exception 'Destinatario excluido';end if;
 select * into p from saih_private.people where id=p_person for share;
 if not found then raise exception 'Persona no válida';end if;
 select * into j from saih_private.email_jobs where request_id=p_request and person_id=p_person;
 if found then
  if j.actor<>p_actor or j.meal_id<>p_meal or j.payload->>'kind' is distinct from 'attendance' then raise exception 'Solicitud no válida';end if;
  if j.status='sent' then return jsonb_build_object('status','sent');end if;
  if j.created_at<now()-interval '23 hours' then raise exception 'Revisa el resultado anterior con Richard antes de repetir el envío.';end if;
  if p.email is distinct from j.payload->>'email' then raise exception 'El correo ha cambiado. Prepara una nueva invitación.';end if;
  return jsonb_build_object('status','pending','data',j.payload);
 end if;
 if exists(select 1 from saih_private.email_jobs where meal_id=p_meal and person_id=p_person and created_at>now()-interval '2 minutes') then raise exception 'Espera dos minutos antes de reenviar a esta persona.';end if;
 if (select count(*) from saih_private.email_jobs where actor=p_actor and created_at>now()-interval '1 day')>=100 then raise exception 'Se ha alcanzado el límite diario de 100 invitaciones.';end if;
 body=jsonb_build_object('kind','attendance','email',p.email,'name',p.name,'title',m.title,'date',m.meal_date::text,'days',m.meal_date-timezone('Europe/Madrid',now())::date,'time',coalesce(to_char(m.reservation_time,'HH24:MI'),''),'place',m.place,'maps',m.maps_url,'website',m.website_url);
 insert into saih_private.email_jobs(request_id,person_id,meal_id,actor,token,payload) values(p_request,p_person,p_meal,p_actor,'',body);
 return jsonb_build_object('status','pending','data',body);
end $$;
revoke all on function public.saih_email_prepare_attendance(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.saih_email_prepare_attendance(uuid,uuid,uuid,uuid,text) to service_role;
commit;
