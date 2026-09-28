-- v4.6 RC: amortize immutable/shared configuration reads across a short
-- Edge-isolate window. Login and every staff request still read authoritative
-- rows directly. Existing v4.5 functions remain available for rollback.

create or replace function history_v5.load_shared_v46()
returns jsonb
language plpgsql
stable
set search_path=''
as $$
declare
  t record;
  table_rows jsonb;
  result_keys text[] := '{}';
  result_values jsonb[] := '{}';
begin
  for t in select * from history_v5.catalog where shared order by logical_name loop
    execute format(
      'select coalesce(jsonb_agg(data),''[]''::jsonb) from history_v5.%I',
      t.physical_name
    ) into table_rows;
    result_keys := array_append(result_keys, t.logical_name);
    result_values := array_append(result_values, table_rows);
  end loop;
  return (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
      from unnest(result_keys, result_values) as u(k, v)
  );
end
$$;

create or replace function history_v5.load_scope_v46(
  p_actor text,
  p_session text,
  p_request text,
  p_action text,
  p_staff boolean,
  p_limit_ids text,
  p_rank_mode text,
  p_skip_shared boolean default false
)
returns jsonb
language plpgsql
stable
set search_path=''
as $$
declare
  t record;
  pred text;
  table_rows jsonb;
  result_keys text[] := '{}';
  result_values jsonb[] := '{}';
  minimal boolean := p_action in ('student.login', 'teacher.login');
  roster boolean := p_action = 'teacher.student.create';
  ranking boolean := p_action = 'rankings.read';
  rank_year text;
  rank_mode text := coalesce(nullif(p_rank_mode, ''), 'speedrun');
begin
  if ranking and not p_staff then
    select data->>'schoolYear' into rank_year
      from history_v5.gas_students where id = p_actor;
  end if;

  for t in select * from history_v5.catalog order by logical_name loop
    if (minimal and t.logical_name not in (
          'students','studentScopes3','teachers','teacherPolicies','schools3',
          'system','games','scopedSettings3','sessions','sessionScopes3',
          'sessionRevocations3','limits','receipts'
        ))
       or (roster and t.logical_name not in (
          'students','studentScopes3','teachers','teacherPolicies','schools3',
          'system','games','scopedSettings3','sessions','sessionScopes3',
          'sessionRevocations3','limits','receipts','objectScopes3'
        )) then
      result_keys := array_append(result_keys, t.logical_name);
      result_values := array_append(result_values, '[]'::jsonb);
      continue;
    end if;

    if p_skip_shared and t.shared and not minimal and not roster and not p_staff then
      continue;
    end if;

    pred := case
      when minimal and t.logical_name = 'students' then 'id=$1'
      when minimal and t.logical_name = 'teachers' then 'id=$1'
      when minimal and t.logical_name = 'teacherPolicies' then 'data->>''teacherId''=$1'
      when minimal and t.logical_name in ('sessions','studentScopes3') then 'owner_id=$1'
      when t.logical_name = 'limits' then 'id=any(string_to_array($5,'',''))'
      when t.logical_name = 'receipts' and not (p_staff and p_action like 'teacher.backup.%') then '(owner_id=$1 and data->>''requestId''=$3)'
      when p_staff then 'true'
      when ranking and t.logical_name in ('students','studentScopes3') then 'data->>''schoolYear''=$6'
      when ranking and t.logical_name = 'records' then '(data->>''schoolYear''=$6 and data->>''mode''=$7)'
      when ranking and t.logical_name = 'attempts' then 'id in (select data->>''attemptId'' from history_v5.gas_records where data->>''schoolYear''=$6 and data->>''mode''=$7)'
      when t.logical_name = 'students' then 'id=$1'
      when t.logical_name = 'studentScopes3' then 'owner_id=$1'
      when t.logical_name = 'system' then '(owner_id is null or owner_id=$1)'
      when t.logical_name = 'sessionScopes3' then '(id=$2 or data->>''userId''=$1)'
      when t.logical_name = 'sessionRevocations3' then '(id=$2 or owner_id=$1)'
      when t.shared then 'true'
      when t.logical_name in ('audit','securityEvents','journals','migration','backups','boardSnapshots27') then 'false'
      else 'owner_id=$1'
    end;

    execute format(
      'select coalesce(jsonb_agg(data),''[]''::jsonb) from history_v5.%I where %s',
      t.physical_name, pred
    ) into table_rows
      using p_actor, p_session, p_request, p_action, p_limit_ids, rank_year, rank_mode;
    result_keys := array_append(result_keys, t.logical_name);
    result_values := array_append(result_values, table_rows);
  end loop;

  return (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
      from unnest(result_keys, result_values) as u(k, v)
  );
end
$$;

revoke all on function history_v5.load_shared_v46()
  from public, anon, authenticated, service_role;
revoke all on function history_v5.load_scope_v46(text,text,text,text,boolean,text,text,boolean)
  from public, anon, authenticated, service_role;
grant execute on function history_v5.load_shared_v46()
  to history_v5_worker;
grant execute on function history_v5.load_scope_v46(text,text,text,text,boolean,text,text,boolean)
  to history_v5_worker;
