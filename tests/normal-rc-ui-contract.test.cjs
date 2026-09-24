const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync(new URL('../'+name,`file://${__filename}`),'utf8');
const opening=read('student-stage28.js'),legacy=read('legacy-game.js'),fusion=read('student-stage25.js');

for(const label of ['한 장씩 자동개봉','연속 개봉 시작','연속 개봉 계속','직접 개봉 · 다음 카드'])assert(!opening.includes(label),`obsolete opening label remains: ${label}`);
assert(opening.includes('>1장씩 까기</button>'));assert(opening.includes('>모두 까기'));
assert(opening.includes("count=chosen==='all'?plan.total:1"),'one-by-one base request must use count 1');
assert(opening.includes('onclick="toggleOpeningZoom28()" aria-label="카드 확대"'),'revealed card must only toggle the inspection zoom');
assert(opening.includes("else if(packReward?.phase!=='done')advanceOpening28()"),'Enter must use the explicit advance path');
assert(opening.includes("x.isNew?'<b class=\"opening-new28\">NEW</b>'"),'NEW badge must use the server result flag');
assert(!opening.includes('${escape41(p.note)}'),'pack vault must not render long pack descriptions');
assert(legacy.includes("name:'노말팩'"));assert(!legacy.includes("name:'노말 확정팩'"));
assert(legacy.includes('bonusSlotSwapSelection={kind:\'\',index:-1}'),'speedrun must track a placed-card click selection');
assert(legacy.includes("cl+=' selected'"),'the selected placed card must have a visible state');
assert(legacy.includes('첫 카드와 두 번째 카드를 차례로 눌러 서로 바꿀 수 있습니다.'),'speedrun instructions must explain click-to-click swapping');
assert(fusion.includes('기본 성공률 ${a.baseSuccess}%'));assert(fusion.includes('광휘 보너스 ${a.shinyBonus}%p'));assert(fusion.includes('광휘 카드가 합성 재료로 소모됩니다.'));

const interaction=legacy.match(/let bonusSlotSwapSelection=.*\n/)[0],place=legacy.match(/function bonusPlace\(k,i\).*\n/)[0];
const context={speed:{slots:[1,2,null],deck:[3],selected:null,checked:true,status:'active',startedAt:0},practice:{state:null},dragging:false,cardTimer:0,performance:{now:()=>1000},clearTimeout:()=>{},setTimeout:fn=>fn(),render:()=>{},queueSpeedJudge:()=>{}};
context.bonusState=kind=>kind==='speedrun'?context.speed:context.practice.state;
vm.createContext(context);vm.runInContext(interaction+place,context);
context.bonusSlotClick('speedrun',0);assert.equal(context.speed.selected,1,'first placed-card click selects it');
context.bonusSlotClick('speedrun',1);assert.deepEqual(context.speed.slots,[2,1,null],'second placed-card click swaps both positions');
context.bonusSlotClick('speedrun',0);context.bonusSlotClick('speedrun',0);assert.equal(context.speed.selected,null,'clicking the selected card cancels');
context.bonusSlotClick('speedrun',0);context.bonusSlotClick('speedrun',2);assert.deepEqual(context.speed.slots,[2,1,null],'clicking an empty slot cancels without moving a placed card');
const transfer={value:'',setData(_,value){this.value=value},getData(){return this.value}};context.bonusDragStart({dataTransfer:transfer},'speedrun',2);context.bonusDrop({preventDefault(){},dataTransfer:transfer},'speedrun',1);assert.deepEqual(context.speed.slots,[1,2,null],'drag swapping remains functional after click swapping');

console.log('PASS: pack controls/text, NEW persistence binding, zoom-only card click, Enter advance, speedrun click/click and drag swaps, and fusion bonus display contract');
