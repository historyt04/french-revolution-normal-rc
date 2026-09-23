create or replace function history_v5.write_rows(p_changes jsonb) returns void language plpgsql set search_path='' as $$
declare target record;
begin
 if jsonb_typeof(p_changes) is distinct from 'array' then raise exception 'INVALID_CHANGES'; end if;
 if exists(select 1 from jsonb_array_elements(p_changes) change left join history_v5.catalog catalog_entry on catalog_entry.logical_name=change->>'table' where catalog_entry.logical_name is null) then raise exception 'UNKNOWN_TABLE'; end if;
 for target in select distinct catalog_entry.physical_name,catalog_entry.logical_name from history_v5.catalog catalog_entry join jsonb_array_elements(p_changes) change on catalog_entry.logical_name=change->>'table' loop
  execute format('insert into history_v5.%I(id,data) select x->''row''->>''id'',x->''row'' from jsonb_array_elements($1) x where x->>''table''=$2 on conflict(id) do update set data=excluded.data',target.physical_name) using p_changes,target.logical_name;
 end loop;
end $$;
