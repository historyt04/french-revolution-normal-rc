/* Stable effect IDs. Visual preview only: this file never grants game rewards. */
(function(g){'use strict';
  const effects=[
    ['01','무지개 홀로그램','SPECTRUM VEIL','myth','비스듬히 흐르는 무지개 광막과 가장자리의 분광 섬광.'],
    ['02','얼음 프리즘','SAPPHIRE ICE','normal','사진 1 · 네 모서리의 날카로운 청색 결정과 냉기, 결정면을 따라 흐르는 흰 섬광.'],
    ['03','황금 광채','GILDED LIGHT','normal','좌측 위에서 스며드는 금빛 광선과 천천히 떠오르는 금가루.'],
    ['04','붉은 불꽃','EMBER BLOOM','legend','아래에서 피어오르는 불꽃의 혀와 비스듬히 상승하는 불씨.'],
    ['05','에메랄드 오로라','EMERALD CURRENT','rare','양옆의 휘어진 초록 장막이 서로 다른 속도로 흐릅니다.'],
    ['06','보라 성운','VIOLET NEBULA','unique','모서리에 쌓이는 보라 성운과 안개 사이의 미세한 별빛.'],
    ['07','극채 홀로그램','VIVID HOLOGRAM','myth','굵게 접힌 다층 무지개 굴절 띠와 선명한 전경 결정. 서로 다른 속도의 분광층과 모서리 백색 섬광.'],
    ['08','사파이어 번개','SAPPHIRE ARC','rare','푸른 잔광 사이로 짧은 전기 가지가 한 번씩 흐릅니다.'],
    ['09','홀로그램 원형 파동','CHROMATIC ORBITS','unique','서로 어긋난 타원 궤도와 바깥으로 번져 사라지는 파동.'],
    ['10','무지개 결정광','SPECTRAL RIBBONS','unique','사진 2 · 가장자리를 따라 불규칙하게 흐르는 선명한 무지개 굴절 띠와 모서리 결정.'],
    ['11','황실 금사','ROYAL GOLD FILIGREE','legend','검은 일식 대신 양옆에서 왕관처럼 갈라지는 금빛 실선, 샴페인 광선과 상승하는 금가루.'],
    ['12','진주 오팔','PEARLESCENT TIDE','myth','흰 진주광 속에 분홍·하늘·보라가 부드럽게 번집니다.'],
    ['13','태양의 광륜','SOLAR HALO',null,'기존 타원 흐름을 유지하며 카드틀 아래까지 부피를 확장한 황금 광륜. 황백색·샴페인·순금·호박·적금색 몸체 위로 금빛 유선과 국소 섬광이 흐릅니다.'],
    ['14','홍염의 화관','CRIMSON WREATH',null,'상승 불길 대신 카드틀 아래까지 엉긴 적금색·구리색 용융 열광. 내부의 황금 균열이 천천히 흐르고 짧은 불꽃 파편이 여러 방향으로 튑니다.'],
    ['15','자수정 성운','AMETHYST CONSTELLATION',null,'사진 5 · 그림 가장자리에 쌓인 보라색 성운, 깊이 다른 안개와 불규칙한 별빛.'],
    ['16','백야 수정광','POLAR CRYSTAL',null,'수정의 형태와 움직임은 유지하고 밝기·불투명도·대비를 낮춘 은은한 백색·빙청색 수정광. 외곽 배치를 카드틀 쪽으로 넓히되 중앙 굴절광은 자르지 않습니다.'],
    ['17','오팔의 물결','OPAL AURORA',null,'사진 6 오른쪽 · 분홍·하늘·연보라빛이 부드럽게 섞이는 유동적인 진주광.'],
    ['18','백광 오팔','LUMINOUS OPAL',null,'백색 진주광과 분홍·하늘·연보라·연두의 곡면을 보존한 채 카드틀 아래까지 외곽 배치를 넓힌 백광 오팔. 밝은 중심광과 부드러운 흐름을 유지합니다.']
  ].map(([id,name,en,tier,description])=>Object.freeze({id,name,en,tier,description}));
  const tiers={normal:'노말',rare:'레어',unique:'유니크',legend:'전설',myth:'신화'};
  g.GlowEffectsConfig=Object.freeze({version:'1.3.0-preview.1',approved:false,effects:Object.freeze(effects),tiers:Object.freeze(tiers),
    geometry:Object.freeze({aspectRatio:'2 / 3',pictureLeft:8.25,pictureTop:18.8,pictureWidth:83.5,pictureHeight:51.4}),
    // Existing assignments are retained. New 08/10/11 are candidates, not game settings.
    assignments:Object.freeze({normal:['02','03'],rare:['02','05'],unique:['06','09'],legend:['03','04','07'],myth:['01','07','12']}),
    candidates:Object.freeze(['08','10','11','13','14','15','16','17','18']),
    // Presentation suggestions only. NOT game rarity assignments.
    previewFrames:Object.freeze({'02':'rare','07':'myth','10':'myth','11':'legend','13':'legend','14':'legend','15':'unique','16':'myth','17':'myth','18':'myth'}),
    renamedFrom:Object.freeze({'07':'은빛 프리즘','10':'스테인드글라스 굴절','11':'흑금 일식'}),
    maxIntensity:1.4});
})(globalThis);
