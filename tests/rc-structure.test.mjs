import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {ADVANCED_QUESTIONS} from '../supabase/functions/_shared/advanced-question-bank.mjs';
import {rules} from '../supabase/functions/_shared/gas-v6-domain.mjs';

assert.equal(rules.unitId,'fr-revolution');
assert.equal(rules.lessonId,'H1-U05-M01-L03');
const curriculumLesson=rules.curriculum.units
 .flatMap(unit=>unit.middles.map(middle=>({unit,middle})))
 .flatMap(({unit,middle})=>middle.lessons.map(lesson=>({unit,middle,lesson})))
 .find(row=>row.lesson.lessonId===rules.lessonId);
assert(curriculumLesson);
assert.equal(curriculumLesson.unit.title,'제국주의와 국민 국가 건설 운동');
assert.equal(curriculumLesson.middle.title,'유럽과 아메리카의 국민 국가 체제');
assert.equal(curriculumLesson.lesson.title,'프랑스 혁명이 일어나다');

assert.equal(ADVANCED_QUESTIONS.length,12);
assert.equal(new Set(ADVANCED_QUESTIONS.map(q=>q.eventId)).size,12);
for(const question of ADVANCED_QUESTIONS){
 assert.equal(question.choices.length,5,question.id);
 assert(Number.isInteger(question.correctIndex)&&question.correctIndex>=0&&question.correctIndex<5,question.id);
 assert.equal(question.acceptedAnswers[0],String(question.correctIndex+1),question.id);
 assert.equal(question.acceptedAnswers[1],question.choices[question.correctIndex],question.id);
 assert(question.passage.length>=20&&question.prompt.length>=10&&question.explanation.length>=20,question.id);
 if(question.imageUsed){assert(question.image?.startsWith('content/fr-revolution/images/'));assert(existsSync(new URL('../'+question.image,import.meta.url)),question.image)}
}

const studentRuntime=readFileSync(new URL('../student-v42.js',import.meta.url),'utf8');
const fastQuiz=readFileSync(new URL('../student-fast-quiz.js',import.meta.url),'utf8');
assert(studentRuntime.includes("['beginner','intermediate','advanced'].includes(view)?quiz(view)"));
assert(fastQuiz.includes("new Set(['beginner','intermediate','advanced'])"));
assert(fastQuiz.includes('교과서용 사건 삽화'));

console.log('PASS: curriculum ownership, 12 advanced five-choice questions, answer keys/explanations, image assets, and advanced quiz routing.');
