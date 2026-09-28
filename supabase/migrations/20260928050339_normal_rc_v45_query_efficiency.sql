-- v4.5 RC query-path optimization.
-- Keep the v4.4 functions in place so the Edge Function can be rolled back
-- independently. The new loader preserves the old predicates while removing
-- one client round trip and repeated jsonb object copying.

create or replace function history_v5.lock_actor_v45(p_actor text, p_exclusive boolean)
returns void
language plpgsql
set search_path=''
as $$
begin
  if p_exclusive then
    perform pg_advisory_xact_lock(73432023, 0);
  else
    perform pg_advisory_xact_lock_shared(73432023, 0);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor, 73432023));
end
$$;

create or replace function history_v5.load_scope_v45(
  p_actor text,
  p_session text,
  p_request text,
  p_action text,
  p_staff boolean,
  p_limit_ids text,
  p_rank_mode text
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
    select data->>'schoolYear'
      into rank_year
      from history_v5.gas_students
     where id = p_actor;
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
      t.physical_name,
      pred
    )
      into table_rows
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

-- sessionScopes3 cannot use owner_id because that generated column is NULL in
-- the isolated schema. The expression is part of the authenticated scope read.
create index if not exists v5_sessionscopes_user_v45
  on history_v5.gas_sessionscopes3 ((data->>'userId'));

revoke all on function history_v5.lock_actor_v45(text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function history_v5.load_scope_v45(text, text, text, text, boolean, text, text)
  from public, anon, authenticated, service_role;
grant execute on function history_v5.lock_actor_v45(text, boolean)
  to history_v5_worker;
grant execute on function history_v5.load_scope_v45(text, text, text, text, boolean, text, text)
  to history_v5_worker;
