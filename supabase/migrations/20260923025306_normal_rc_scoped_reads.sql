-- Query only the tables needed for authentication/roster insertion. A STABLE
-- loader uses one statement snapshot for consistent rankings and staff reports.
create or replace function history_v5.load_scope(p_actor text, p_session text, p_request text, p_action text, p_staff boolean default false)
returns jsonb language plpgsql stable set search_path='' as $$
declare t record; pred text; rows jsonb; result jsonb='{}';
 minimal boolean=p_action in ('student.login','teacher.login');
 roster boolean=p_action='teacher.student.create';
 ranking boolean=p_action='rankings.read';
 rank_year text; rank_mode text=coalesce(nullif(current_setting('history_v5.rank_mode',true),''),'speedrun');
begin
 if ranking and not p_staff then select data->>'schoolYear' into rank_year from history_v5.gas_students where id=p_actor; end if;
 for t in select * from history_v5.catalog order by logical_name loop
  if (minimal and t.logical_name not in ('students','studentScopes3','teachers','teacherPolicies','schools3','system','games','scopedSettings3','sessions','sessionScopes3','sessionRevocations3','limits','receipts'))
   or (roster and t.logical_name not in ('students','studentScopes3','teachers','teacherPolicies','schools3','system','games','scopedSettings3','sessions','sessionScopes3','sessionRevocations3','limits','receipts','objectScopes3')) then
   result:=result || jsonb_build_object(t.logical_name,'[]'::jsonb);
   continue;
  end if;
  pred := case
   when minimal and t.logical_name='students' then 'id=$1'
   when minimal and t.logical_name='teachers' then 'id=$1'
   when minimal and t.logical_name='teacherPolicies' then 'data->>''teacherId''=$1'
   when minimal and t.logical_name in ('sessions','studentScopes3') then 'owner_id=$1'
   when t.logical_name='limits' then 'id=any(string_to_array($5,'',''))'
   when t.logical_name='receipts' and not (p_staff and p_action like 'teacher.backup.%') then '(owner_id=$1 and data->>''requestId''=$3)'
   when p_staff then 'true'
   when ranking and t.logical_name in ('students','studentScopes3') then 'data->>''schoolYear''=$6'
   when ranking and t.logical_name='records' then '(data->>''schoolYear''=$6 and data->>''mode''=$7)'
   when ranking and t.logical_name='attempts' then 'id in (select data->>''attemptId'' from history_v5.gas_records where data->>''schoolYear''=$6 and data->>''mode''=$7)'
   when t.logical_name='students' then 'id=$1'
   when t.logical_name='studentScopes3' then 'owner_id=$1'
   when t.logical_name='system' then '(owner_id is null or owner_id=$1)'
   when t.logical_name in ('sessionScopes3','sessionRevocations3') then '(id=$2 or data->>''userId''=$1)'
   when t.shared then 'true'
   when t.logical_name in ('audit','securityEvents','journals','migration','backups','boardSnapshots27') then 'false'
   else 'owner_id=$1' end;
  execute format('select coalesce(jsonb_agg(data),''[]''::jsonb) from history_v5.%I where %s',t.physical_name,pred)
   into rows using p_actor,p_session,p_request,p_action,current_setting('history_v5.limit_ids',true),rank_year,rank_mode;
  result:=result || jsonb_build_object(t.logical_name,rows);
 end loop;
 return result;
end $$;

create index v5_records_year_mode on history_v5.gas_records((data->>'schoolYear'),(data->>'mode'));
create index v5_students_year on history_v5.gas_students((data->>'schoolYear'));
create index v5_student_scopes_year on history_v5.gas_studentscopes3((data->>'schoolYear'));
