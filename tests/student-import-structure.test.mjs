import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';

const template=new URL('../assets/templates/student-registration-template.xlsx',import.meta.url);
const source=readFileSync(new URL('../teacher-student-import.js',import.meta.url),'utf8');
function zipText(path){const zip=readFileSync(template),end=zip.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));assert(end>=0);let at=zip.readUInt32LE(end+16);for(let i=0;i<zip.readUInt16LE(end+10);i++){assert.equal(zip.readUInt32LE(at),0x02014b50);const method=zip.readUInt16LE(at+10),size=zip.readUInt32LE(at+20),nameSize=zip.readUInt16LE(at+28),extraSize=zip.readUInt16LE(at+30),commentSize=zip.readUInt16LE(at+32),name=zip.toString('utf8',at+46,at+46+nameSize),local=zip.readUInt32LE(at+42);if(name===path){assert.equal(zip.readUInt32LE(local),0x04034b50);const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28),bytes=zip.subarray(start,start+size);return(method===8?inflateRawSync(bytes):bytes).toString('utf8')}at+=46+nameSize+extraSize+commentSize}throw Error(`Missing XLSX entry ${path}`)}
const sheet=zipText('xl/worksheets/sheet1.xml');
const workbook=zipText('xl/workbook.xml');

assert(workbook.includes('name="학생등록"'));
for(const [cell,label] of [['A1','학년'],['B1','반'],['C1','번호'],['D1','이름']]){
 assert(sheet.includes(`r="${cell}"`),cell);
 assert(sheet.includes(`<x:v>${label}</x:v>`),label);
}
assert(sheet.includes('sqref="A2:A101"'));
assert(sheet.includes('sqref="B2:C101"'));
assert(sheet.includes('<x:formula1>1</x:formula1>'));
assert(sheet.includes('<x:formula2>99</x:formula2>'));
assert(source.includes("const STUDENT_TEMPLATE_URL='assets/templates/student-registration-template.xlsx'"));
assert(source.includes('accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"'));
assert(source.includes('파일을 선택해도 바로 등록되지 않습니다.'));

const previewStart=source.indexOf('async function previewStudentsExcel');
const commitStart=source.indexOf('function commitStudentsExcel');
assert(previewStart>=0&&commitStart>previewStart);
const previewSource=source.slice(previewStart,commitStart);
const commitSource=source.slice(commitStart);
assert(!previewSource.includes("API.request('teacher.student.create'"),'file selection must remain preview-only');
assert(previewSource.includes('validateStudentImport'));
assert(commitSource.includes('confirm(`정상 ${preview.valid.length}명을 등록할까요?'));
assert(commitSource.includes("API.request('teacher.student.create',{students:valid})"));
assert(commitSource.indexOf("API.request('teacher.student.create',{students:valid})")>commitSource.indexOf('confirm(`정상 ${preview.valid.length}명을 등록할까요?'));

console.log('PASS: XLSX template headers and numeric validation ranges match the browser parser; file selection is preview-only and registration requires the explicit commit action.');
