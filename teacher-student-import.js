'use strict';

const STUDENT_TEMPLATE_URL='assets/templates/student-registration-template.xlsx';
const STUDENT_IMPORT_LIMIT=100;

function studentRegistrationPanel(){return`<section class="panel"><h2>학생 등록·학년도 관리</h2><p>학번 5자리와 이름을 붙여 입력하세요. 학번은 학년 1자리, 반 2자리, 번호 2자리 순서입니다.</p><div class="student-import-guide"><strong>직접 입력 예시</strong><code>20401홍길동, 20402김철수</code><small>학생 사이는 쉼표(,) 또는 줄바꿈으로 구분합니다. 기존의 학년,반,번호,이름 형식도 계속 사용할 수 있습니다.</small></div><form onsubmit="addStudents(event)"><label>등록할 학년도<input name="schoolYear" type="number" min="2020" max="2200" value="${year}" required></label><label>학생 명부 (최대 ${STUDENT_IMPORT_LIMIT}명)<textarea name="roster" placeholder="20401홍길동, 20402김철수" required></textarea></label><div class="actions"><button class="primary">학생 등록 및 코드 발급</button>${API.session?.role==='owner'?'<button type="button" onclick="newYear()">새 학년도 설정 만들기</button>':''}</div></form><div class="student-excel-box"><h3>엑셀로 일괄 등록</h3><p>양식을 내려받아 학년·반·번호·이름을 입력하고 저장한 뒤, 그 파일을 선택해 등록하세요.</p><div class="actions"><a class="student-template-button" href="${STUDENT_TEMPLATE_URL}" download="학생등록_양식.xlsx">엑셀 양식 다운로드</a></div><form onsubmit="importStudentsExcel(event)"><label>등록할 학년도<input name="schoolYear" type="number" min="2020" max="2200" value="${year}" required></label><label>작성한 엑셀 파일<input name="studentFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required></label><button class="primary">엑셀 명부 등록 및 코드 발급</button></form></div>${created.length?`<div class="warning">이번에 발급된 코드를 저장하세요. 기존 학생의 코드는 조회할 수 없습니다.</div><button onclick="downloadCodes()">발급 명부 다운로드</button><div class="tablewrap"><table><tr><th>학번</th><th>이름</th><th>접속 코드</th></tr>${created.map(x=>`<tr><td>${E(x.student.id)}</td><td>${E(x.student.name)}</td><td class="credential">${E(x.code)}</td></tr>`).join('')}</table></div>`:''}<h3 style="margin-top:24px">등록 학생 ${info.students.length}명</h3><div class="tablewrap"><table><tr><th>학번</th><th>이름</th><th>별명</th></tr>${info.students.map(s=>`<tr><td>${E(s.id)}</td><td>${E(s.name)}</td><td>${E(s.nickname)}</td></tr>`).join('')}</table></div></section>`}

students=studentRegistrationPanel;

function studentRowError(message,index){throw new Error(`${index+1}번째 학생: ${message}`)}
function normalizeStudentRows(rows,schoolYear){
  if(!Number.isInteger(schoolYear)||schoolYear<2020||schoolYear>2200)throw new Error('학년도를 확인해 주세요.');
  if(!rows.length)throw new Error('등록할 학생이 없습니다.');
  if(rows.length>STUDENT_IMPORT_LIMIT)throw new Error(`학생은 한 번에 ${STUDENT_IMPORT_LIMIT}명까지 등록할 수 있습니다.`);
  const seen=new Set();
  return rows.map((row,index)=>{
    const grade=Number(row.grade),classNo=Number(row.classNo),number=Number(row.number),name=String(row.name??'').trim();
    if(!Number.isInteger(grade)||grade<1||grade>6)studentRowError('학년은 1~6 사이의 숫자여야 합니다.',index);
    if(!Number.isInteger(classNo)||classNo<1||classNo>99)studentRowError('반은 1~99 사이의 숫자여야 합니다.',index);
    if(!Number.isInteger(number)||number<1||number>99)studentRowError('번호는 1~99 사이의 숫자여야 합니다.',index);
    if(!name||name.length>50)studentRowError('이름을 1~50자로 입력해 주세요.',index);
    const key=`${grade}-${classNo}-${number}`;
    if(seen.has(key))studentRowError('같은 학년·반·번호가 파일이나 입력란에 두 번 있습니다.',index);
    seen.add(key);
    return{schoolYear,grade,classNo,number,name,nickname:String(row.nickname??'').trim()||`역사가${number}`};
  });
}

function parseCompactStudent(token,index){
  const match=String(token).trim().match(/^([1-6])(\d{2})(\d{2})(.+)$/u);
  if(!match)studentRowError('20401홍길동처럼 학번 5자리와 이름을 붙여 입력해 주세요.',index);
  return{grade:Number(match[1]),classNo:Number(match[2]),number:Number(match[3]),name:match[4].trim()};
}

function parseStudentRoster(value,schoolYear){
  const source=String(value??'').trim();
  if(!source)throw new Error('등록할 학생을 입력해 주세요.');
  const compactTokens=source.split(/[\n,]+/).map(value=>value.trim()).filter(Boolean);
  if(compactTokens.length&&compactTokens.every(value=>/^[1-6]\d{4}.+$/u.test(value)))return normalizeStudentRows(compactTokens.map(parseCompactStudent),schoolYear);
  const lines=source.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
  const rows=lines.map((line,index)=>{
    const fields=line.split(',').map(value=>value.trim());
    if(fields.length<4||fields.length>5)studentRowError('기존 형식은 학년,반,번호,이름,별명 순서로 입력해 주세요.',index);
    return{grade:fields[0],classNo:fields[1],number:fields[2],name:fields[3],nickname:fields[4]};
  });
  return normalizeStudentRows(rows,schoolYear);
}

async function registerStudentRows(rows){created=(await API.request('teacher.student.create',{students:rows})).created;await refresh();msg(`${created.length}명을 등록했습니다. 새 접속 코드는 지금 한 번만 표시됩니다.`)}
addStudents=function(e){e.preventDefault();let rows;try{const data=new FormData(e.target);rows=parseStudentRoster(data.get('roster'),Number(data.get('schoolYear')))}catch(error){return msg(error.message)}task(()=>registerStudentRows(rows))};

function readZipUint16(view,offset){return view.getUint16(offset,true)}
function readZipUint32(view,offset){return view.getUint32(offset,true)}
function zipPath(base,target){
  if(target.startsWith('/'))return target.slice(1);
  const parts=(base.slice(0,base.lastIndexOf('/')+1)+target).split('/'),out=[];
  for(const part of parts){if(!part||part==='.')continue;if(part==='..')out.pop();else out.push(part)}
  return out.join('/');
}
async function unzipXlsx(buffer){
  const bytes=new Uint8Array(buffer),view=new DataView(buffer);
  let eocd=-1;
  for(let i=Math.max(0,bytes.length-65557);i<=bytes.length-22;i++)if(readZipUint32(view,i)===0x06054b50)eocd=i;
  if(eocd<0)throw new Error('올바른 .xlsx 파일이 아닙니다. 제공된 양식으로 다시 저장해 주세요.');
  const count=readZipUint16(view,eocd+10),centralOffset=readZipUint32(view,eocd+16);
  if(count>200)throw new Error('엑셀 파일의 내부 항목이 너무 많습니다. 제공된 양식을 사용해 주세요.');
  const decoder=new TextDecoder('utf-8'),entries=new Map();
  let offset=centralOffset,totalSize=0;
  for(let i=0;i<count;i++){
    if(offset+46>bytes.length||readZipUint32(view,offset)!==0x02014b50)throw new Error('엑셀 파일 구조를 읽을 수 없습니다.');
    const flags=readZipUint16(view,offset+8),method=readZipUint16(view,offset+10),compressedSize=readZipUint32(view,offset+20),size=readZipUint32(view,offset+24),nameLength=readZipUint16(view,offset+28),extraLength=readZipUint16(view,offset+30),commentLength=readZipUint16(view,offset+32),localOffset=readZipUint32(view,offset+42);
    if(flags&1)throw new Error('암호가 설정된 엑셀 파일은 등록할 수 없습니다. 암호를 해제해 주세요.');
    if(size>5_000_000||(totalSize+=size)>10_000_000)throw new Error('엑셀 파일이 너무 큽니다. 학생 명부만 남겨 주세요.');
    const name=decoder.decode(bytes.slice(offset+46,offset+46+nameLength));
    if(localOffset+30>bytes.length||readZipUint32(view,localOffset)!==0x04034b50)throw new Error('엑셀 파일 구조를 읽을 수 없습니다.');
    const localNameLength=readZipUint16(view,localOffset+26),localExtraLength=readZipUint16(view,localOffset+28),start=localOffset+30+localNameLength+localExtraLength,end=start+compressedSize;
    if(end>bytes.length)throw new Error('엑셀 파일이 손상되었습니다.');
    entries.set(name,async()=>{
      const compressed=bytes.slice(start,end);
      if(method===0)return compressed;
      if(method!==8||typeof DecompressionStream==='undefined')throw new Error('이 브라우저에서는 엑셀 파일을 읽을 수 없습니다. 최신 Chrome 또는 Edge를 사용해 주세요.');
      const result=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      if(result.byteLength>5_000_000)throw new Error('엑셀 파일의 압축을 푼 내용이 너무 큽니다.');
      return result;
    });
    offset+=46+nameLength+extraLength+commentLength;
  }
  return{has:name=>entries.has(name),text:async name=>{const read=entries.get(name);if(!read)throw new Error('엑셀 파일에 필요한 시트가 없습니다.');return decoder.decode(await read())}};
}

function parseXml(text,label){const xml=new DOMParser().parseFromString(text,'application/xml');if(xml.getElementsByTagName('parsererror').length)throw new Error(`${label} 정보를 읽을 수 없습니다.`);return xml}
function xmlElements(root,name){return Array.from(root.getElementsByTagNameNS('*',name))}
function cellColumn(address){const letters=String(address).match(/^[A-Z]+/i)?.[0]?.toUpperCase()||'A';let column=0;for(const letter of letters)column=column*26+letter.charCodeAt(0)-64;return column-1}
function worksheetRows(xml,shared){
  return xmlElements(xml,'row').map(row=>{
    const values=[];
    for(const cell of xmlElements(row,'c')){
      const type=cell.getAttribute('t'),column=cellColumn(cell.getAttribute('r'));let value='';
      if(type==='inlineStr')value=xmlElements(cell,'t').map(node=>node.textContent||'').join('');
      else{const raw=xmlElements(cell,'v')[0]?.textContent??'';if(type==='s')value=shared[Number(raw)]??'';else if(type==='b')value=raw==='1';else if(type==='str')value=raw;else value=raw===''?'':Number(raw)}
      values[column]=value;
    }
    return values;
  });
}

async function parseStudentWorkbook(file,schoolYear){
  if(!file||!file.name.toLowerCase().endsWith('.xlsx'))throw new Error('.xlsx 형식의 엑셀 파일을 선택해 주세요.');
  if(file.size>2_000_000)throw new Error('엑셀 파일은 2MB 이하로 만들어 주세요.');
  const zip=await unzipXlsx(await file.arrayBuffer());
  const workbook=parseXml(await zip.text('xl/workbook.xml'),'통합 문서'),relationships=parseXml(await zip.text('xl/_rels/workbook.xml.rels'),'시트 연결'),firstSheet=xmlElements(workbook,'sheet')[0];
  if(!firstSheet)throw new Error('엑셀 파일에 시트가 없습니다.');
  const relationshipId=firstSheet.getAttribute('r:id')||firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),relationship=xmlElements(relationships,'Relationship').find(node=>node.getAttribute('Id')===relationshipId);
  if(!relationship)throw new Error('첫 번째 시트를 찾을 수 없습니다.');
  const sheetPath=zipPath('xl/workbook.xml',relationship.getAttribute('Target'));
  let shared=[];
  if(zip.has('xl/sharedStrings.xml')){const strings=parseXml(await zip.text('xl/sharedStrings.xml'),'문자열');shared=xmlElements(strings,'si').map(item=>xmlElements(item,'t').map(node=>node.textContent||'').join(''))}
  const rows=worksheetRows(parseXml(await zip.text(sheetPath),'학생 명부'),shared),normalized=value=>String(value??'').replace(/\s+/g,'');
  let headerIndex=-1,columns={};
  for(let i=0;i<Math.min(rows.length,10);i++){const map=Object.fromEntries(rows[i].map((value,column)=>[normalized(value),column]));if(['학년','반','번호','이름'].every(key=>map[key]!==undefined)){headerIndex=i;columns=map;break}}
  if(headerIndex<0)throw new Error('첫 번째 시트에서 학년, 반, 번호, 이름 열을 찾지 못했습니다. 양식을 다시 내려받아 주세요.');
  const students=rows.slice(headerIndex+1).filter(row=>['학년','반','번호','이름'].some(key=>String(row[columns[key]]??'').trim())).map(row=>({grade:row[columns.학년],classNo:row[columns.반],number:row[columns.번호],name:row[columns.이름]}));
  return normalizeStudentRows(students,schoolYear);
}

async function importStudentsExcel(e){
  e.preventDefault();
  const form=e.target,file=form.elements.studentFile.files[0],schoolYear=Number(form.elements.schoolYear.value);
  await task(async()=>{
    const rows=await parseStudentWorkbook(file,schoolYear),sample=rows.slice(0,6).map(row=>`${row.grade}${String(row.classNo).padStart(2,'0')}${String(row.number).padStart(2,'0')} ${row.name}`).join('\n');
    if(!confirm(`${rows.length}명을 등록할까요?\n\n${sample}${rows.length>6?'\n외 '+(rows.length-6)+'명':''}`))return;
    await registerStudentRows(rows);
  });
}
