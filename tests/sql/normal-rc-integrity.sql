-- Run on the isolated history_v5 schema. All diagnostic rows are rolled back.
begin;
set local role history_v5_worker;
do $$
declare scope jsonb; count_before int;
begin
 insert into history_v5.gas_packs(id,data) values('integrity-probe-pack',jsonb_build_object('id','integrity-probe-pack','studentId','integrity-probe-a','packId','basic','count',2,'guarantees',jsonb_build_array(0,0)));
 begin
  update history_v5.gas_packs set data=data||'{"count":-1,"guarantees":[]}' where id='integrity-probe-pack';
  raise exception 'FAIL: negative pack count accepted';
 exception when check_violation then null; end;
 begin
  update history_v5.gas_packs set data=data||'{"count":1,"guarantees":[]}' where id='integrity-probe-pack';
  raise exception 'FAIL: mismatched guarantees accepted';
 exception when check_violation then null; end;
 begin
  perform history_v5.write_rows('[{"table":"packs","row":{"id":"integrity-probe-pack","studentId":"integrity-probe-b","packId":"basic","count":2,"guarantees":[0,0]}}]'::jsonb);
  raise exception 'FAIL: another student overwrote a row';
 exception when check_violation then null; end;
 -- A failure after a pack decrement must roll back the whole mutation batch.
 begin
  perform history_v5.write_rows('[{"table":"packs","row":{"id":"integrity-probe-pack","studentId":"integrity-probe-a","packId":"basic","count":1,"guarantees":[0]}}]'::jsonb);
  perform history_v5.write_rows('[{"table":"cards","row":{"id":"integrity-probe-card","studentId":"integrity-probe-a","count":-1}}]'::jsonb);
  raise exception 'FAIL: invalid card mutation accepted';
 exception when check_violation then null; end;
 select (data->>'count')::int into count_before from history_v5.gas_packs where id='integrity-probe-pack';
 if count_before<>2 then raise exception 'FAIL: transaction rollback lost pack'; end if;
 insert into history_v5.gas_records(id,data) values('integrity-probe-record',jsonb_build_object('id','integrity-probe-record','studentId','integrity-probe-a','attemptId','integrity-probe-attempt','mode','beginner','elapsedMs',10000));
 begin
  insert into history_v5.gas_records(id,data) values('integrity-probe-record-duplicate',jsonb_build_object('id','integrity-probe-record-duplicate','studentId','integrity-probe-a','attemptId','integrity-probe-attempt','mode','beginner','elapsedMs',10000));
  raise exception 'FAIL: duplicate completion accepted';
 exception when unique_violation then null; end;
 insert into history_v5.gas_packopenings28(id,data) values('integrity-probe-opening',jsonb_build_object('id','integrity-probe-opening','studentId','integrity-probe-a','requestId','integrity-probe-request'));
 begin
  insert into history_v5.gas_packopenings28(id,data) values('integrity-probe-opening-duplicate',jsonb_build_object('id','integrity-probe-opening-duplicate','studentId','integrity-probe-a','requestId','integrity-probe-request'));
  raise exception 'FAIL: duplicate pack request accepted';
 exception when unique_violation then null; end;
 scope:=history_v5.load_scope('integrity-probe-b','','probe','student.state',false);
 if jsonb_array_length(scope->'packs')<>0 or jsonb_array_length(scope->'records')<>0 then raise exception 'FAIL: foreign student data loaded'; end if;
 scope:=history_v5.load_scope('integrity-probe-a','','probe','student.state',false);
 if jsonb_array_length(scope->'packs')<>1 then raise exception 'FAIL: own student data absent'; end if;
 scope:=history_v5.load_scope('integrity-probe-a','','probe','student.login',false);
 if jsonb_array_length(scope->'packs')<>0 or jsonb_array_length(scope->'records')<>0 then raise exception 'FAIL: login loads gameplay history'; end if;
 scope:=history_v5.load_scope('integrity-probe-a','','probe','teacher.student.create',true);
 if jsonb_array_length(scope->'packs')<>0 or jsonb_array_length(scope->'records')<>0 then raise exception 'FAIL: bulk registration loads gameplay history'; end if;
end $$;
select 'PASS: pack constraints, transaction rollback, unique completion/opening, actor partition, minimal login and bulk roster load' as result;
rollback;
