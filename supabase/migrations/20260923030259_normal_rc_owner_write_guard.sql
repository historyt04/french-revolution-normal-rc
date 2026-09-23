create or replace function history_v5.write_rows(p_changes jsonb) returns void language plpgsql set search_path='' as $$
declare target record; affected int; expected int;
begin
 if jsonb_typeof(p_changes) is distinct from 'array' then raise exception 'INVALID_CHANGES'; end if;
 if exists(select 1 from jsonb_array_elements(p_changes) change left join history_v5.catalog catalog_entry on catalog_entry.logical_name=change->>'table' where catalog_entry.logical_name is null) then raise exception 'UNKNOWN_TABLE'; end if;
 for target in select distinct catalog_entry.physical_name,catalog_entry.logical_name from history_v5.catalog catalog_entry join jsonb_array_elements(p_changes) change on catalog_entry.logical_name=change->>'table' loop
  execute format('insert into history_v5.%I as existing(id,data) select x->''row''->>''id'',x->''row'' from jsonb_array_elements($1) x where x->>''table''=$2 on conflict(id) do update set data=excluded.data where existing.owner_id is not distinct from excluded.owner_id',target.physical_name) using p_changes,target.logical_name;
  get diagnostics affected=row_count;
  select count(*) into expected from jsonb_array_elements(p_changes) x where x->>'table'=target.logical_name;
  if affected<>expected then raise exception 'OWNER_CONFLICT' using errcode='23514'; end if;
 end loop;
end $$;
