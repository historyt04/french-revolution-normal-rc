const variants = [
  ['normal','노말','청동 고문서','절제된 금속 광택'],
  ['rare','레어','빙결 사파이어','푸른 유리 보석'],
  ['unique','유니크','아케인 바이올렛','보랏빛 마력 광채'],
  ['legend','전설','황금 성휘','강한 황금 광택'],
  ['myth','신화','오색 수정','무지개 프리즘'],
  ['crimson','크림슨 신화','크림슨 레드','붉은 보석과 불꽃'],
  ['emerald','에메랄드 신화','에메랄드 왕관','초록 보석과 금장']
];

const grid = document.querySelector('#cardGrid');
const template = document.querySelector('#cardTemplate');

variants.forEach(([cls, rarity, name, note], index) => {
  const node = template.content.cloneNode(true);
  const wrap = node.querySelector('.card-wrap');
  const card = node.querySelector('.history-card');
  card.classList.add(cls);
  card.style.setProperty('--delay', `${index * -.37}s`);
  node.querySelector('.rarity-name').textContent = rarity;
  node.querySelector('.caption strong').textContent = `${index + 1}. ${name}`;
  node.querySelector('.caption span').textContent = note;
  bindTilt(card);
  grid.appendChild(wrap);
});

function bindTilt(card) {
  const move = (clientX, clientY) => {
    const r = card.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    card.style.setProperty('--mx', `${x * 100}%`);
    card.style.setProperty('--my', `${y * 100}%`);
    card.style.transform = `rotateY(${(x - .5) * 13}deg) rotateX(${(.5 - y) * 11}deg) translateY(-5px)`;
  };
  card.addEventListener('pointermove', e => move(e.clientX, e.clientY));
  card.addEventListener('pointerleave', () => {
    card.style.transform = '';
    card.style.setProperty('--mx', '50%');
    card.style.setProperty('--my', '30%');
  });
}

document.querySelector('#shineRange').addEventListener('input', e => {
  document.documentElement.style.setProperty('--shine', e.target.value / 100);
});

document.querySelector('#motionToggle').addEventListener('click', e => {
  const off = document.body.classList.toggle('motion-off');
  e.currentTarget.textContent = off ? '자동 광택 꺼짐' : '자동 광택 켜짐';
  e.currentTarget.setAttribute('aria-pressed', String(!off));
});
