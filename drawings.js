/* 미션 2 도면 · 발표 화면과 휴대폰이 같은 좌표계(0~1 비율)를 쓰도록 한곳에서 관리해요.
   config.js 의 m2.imgNormal / m2.imgSite 에 이미지 주소를 넣으면 SVG 대신 실제 도면 이미지를 겹칩니다.
   이때 m2.defects 에 결함 위치(x,y: 이미지 가로·세로 비율, r: 판정 반경)를 꼭 같이 적어 주세요. */
(function () {
  'use strict';
  var C = window.FIELD_CONFIG || {}, M = C.m2 || {};
  var W = 800, H = 500;
  // 난도 상향: 결함 8곳, 대부분 눈에 잘 안 띄는 작은 차이(숫자 한 자리, 6px 어긋남, 기호 방향, 이음새 틈 등)
  var DEFAULT_DEFECTS = [
    { id: 'd1', x: 0.390,  y: 0.836, r: 0.040, note: '전체 치수 표기 오류 (4,600 → 4,060)' },
    { id: 'd2', x: 0.800,  y: 0.486, r: 0.075, note: '지선 BR-2가 약 5cm 어긋남' },
    { id: 'd3', x: 0.393,  y: 0.512, r: 0.040, note: '밸브 번호 불일치 (V-1 → V-7)' },
    { id: 'd4', x: 0.800,  y: 0.802, r: 0.040, note: '도면에 없는 지지대 추가' },
    { id: 'd5', x: 0.1525, y: 0.760, r: 0.040, note: '펌프 유동 방향 기호가 반대' },
    { id: 'd6', x: 0.650,  y: 0.760, r: 0.040, note: '엘보 접합부(노드) 누락' },
    { id: 'd7', x: 0.422,  y: 0.288, r: 0.040, note: '배관 호칭 불일치 (DN80 → DN65)' },
    { id: 'd8', x: 0.770,  y: 0.170, r: 0.040, note: '탱크 연결 배관이 닿지 않고 떠 있음' }
  ];
  function txt(x, y, s, a, sz) { return '<text x="' + x + '" y="' + y + '" text-anchor="' + (a || 'middle') + '"' + (sz ? ' font-size="' + sz + '"' : '') + '>' + s + '</text>'; }

  // site=false: 정상 설계도 / site=true: 현장 시공 도면 (결함 8곳이 숨어 있어요)
  function svg(site) {
    var s = '';
    // 도곽·표제란·일반 주기
    s += '<rect x="16" y="16" width="768" height="468" stroke-width="1.5" opacity=".55"/>';
    s += '<rect x="560" y="440" width="224" height="44" stroke-width="1.5" opacity=".7"/>' + txt(572, 467, 'FIELD NOTES · DWG-08', 'start');
    s += txt(30, 40, 'NOTES: 1. ALL DIMS IN mm', 'start', 11) + txt(30, 54, '2. SEE P&amp;ID-08 FOR TAGS', 'start', 11);
    // 눈금 표시(눈을 어지럽히는 요소)
    for (var i = 1; i < 16; i++) s += '<path d="M' + (i * 50) + ' 16 v6 M' + (i * 50) + ' 478 v6" stroke-width="1" opacity=".45"/>';
    // 보일러와 연결 배관
    s += '<rect x="330" y="56" width="140" height="64" rx="6" stroke-width="3"/>' + txt(400, 94, 'BOILER');
    s += '<path d="M400 120 V160" stroke-width="6"/>';
    // 주 배관 루프
    s += '<path d="M60 380 H260 V160 H520 V380 H740" stroke-width="6" stroke-linejoin="round"/>';
    s += '<g stroke-width="3"><circle cx="260" cy="380" r="9"/><circle cx="260" cy="160" r="9"/><circle cx="520" cy="160" r="9"/>' + (site ? '' : '<circle cx="520" cy="380" r="9"/>') + '</g>'; // d6
    // 펌프 (d5: 현장은 유동 방향 기호가 반대)
    s += '<g stroke-width="3"><circle cx="120" cy="380" r="20"/><path d="' + (site ? 'M134 370 L110 380 L134 390 Z' : 'M110 370 L134 380 L110 390 Z') + '"/></g>' + txt(120, 345, 'P-101');
    // 치수선 (d1)
    s += '<path d="M60 432 H520 M60 422 V442 M520 422 V442" stroke-width="2"/>' + txt(290, 424, site ? 'L = 4,060' : 'L = 4,600');
    s += '<path d="M36 160 V380 M26 160 H46 M26 380 H46" stroke-width="2"/>' + txt(60, 275, 'H 2,200', 'start');
    // 배관 호칭 (d7)
    s += txt(330, 148, site ? 'DN65' : 'DN80', 'middle', 13) + txt(600, 372, 'DN80', 'middle', 13) + txt(180, 372, 'DN80', 'middle', 13);
    // 밸브 V-1 (d3: 번호)
    s += '<g stroke-width="3"><circle cx="260" cy="270" r="16"/><path d="M248 258 L272 282 M272 258 L248 282"/></g>' + txt(292, 262, site ? 'V-7' : 'V-1', 'start');
    // 지선 BR-2 (d2: 현장은 6px 아래로)
    var by = site ? 246 : 240;
    s += '<path d="M520 ' + by + ' H700" stroke-width="6"/><circle cx="700" cy="' + by + '" r="7" stroke-width="3"/>' + txt(610, 224, 'BR-2');
    // 탱크 T-02와 연결 배관 (d8: 현장은 8px 떠 있음)
    s += '<rect x="620" y="60" width="110" height="50" rx="4" stroke-width="3"/>' + txt(675, 90, 'T-02');
    s += '<path d="M520 160 V85 H' + (site ? 612 : 620) + '" stroke-width="6" stroke-linejoin="round"/>';
    // 압력계 PI-1, 드레인 DR-1 (양쪽 동일)
    s += '<path d="M460 160 V200" stroke-width="2"/><circle cx="460" cy="214" r="14" stroke-width="2"/>' + txt(460, 218, 'PI', 'middle', 11);
    s += '<path d="M390 380 V412" stroke-width="6"/><circle cx="390" cy="396" r="7" stroke-width="3"/>' + txt(404, 400, 'DR-1', 'start', 12);
    // 지지대 (양쪽 공통 2곳 + d4: 현장에만 1곳 추가)
    s += '<g stroke-width="3"><path d="M166 404 L180 392 L194 404 Z"/><path d="M446 404 L460 392 L474 404 Z"/>' + (site ? '<path d="M626 404 L640 392 L654 404 Z"/>' : '') + '</g>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" ' +
      'stroke-linecap="round" font-family="IBM Plex Mono,ui-monospace,monospace" font-size="15" aria-hidden="true">' +
      '<style>text{fill:currentColor;stroke:none}</style>' + s + '</svg>';
  }

  function layer(site) { // DOM 노드 하나를 돌려줘요
    var d = document.createElement('div');
    var url = site ? M.imgSite : M.imgNormal;
    if (url) d.innerHTML = '<img alt="" draggable="false" src="' + String(url).replace(/"/g, '&quot;') + '">';
    else d.innerHTML = svg(site);
    return d;
  }

  window.FieldBP = {
    aspect: M.aspect || (M.imgNormal ? 1.6 : W / H),
    defects: function () { return (M.defects && M.defects.length) ? M.defects : DEFAULT_DEFECTS; },
    layer: layer,
    // (x,y) 비율 좌표가 결함 d 의 판정 반경 안인지 — 가로·세로 비율이 달라도 원형으로 판정
    hit: function (d, x, y) {
      var a = window.FieldBP.aspect, dx = (x - d.x) * a, dy = (y - d.y);
      return Math.sqrt(dx * dx + dy * dy) <= d.r * a;
    }
  };
})();
