/* FIELD NOTES / 08 — 실시간 설정
   여기만 고치면 됩니다. firebase 가 null 이면 '리허설 모드'(같은 브라우저 탭끼리만 연결)로 동작해요. */
window.FIELD_CONFIG = {
  room: 'field8',                 // 방 이름. 발표마다 바꾸면 기록이 분리돼요.

  // Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)에서 복사한 값을 붙여넣으세요.
  // Realtime Database 를 만들고 databaseURL 까지 꼭 넣어야 해요.
  firebase: {
    apiKey: "AIzaSyDJ5l2HwbBUkdc2I2tJUlk_OAnAzZEqzTs",
    authDomain: "field-notes-8.firebaseapp.com",
    databaseURL: "https://field-notes-8-default-rtdb.firebaseio.com",
    projectId: "field-notes-8",
    storageBucket: "field-notes-8.firebasestorage.app",
    messagingSenderId: "948398739240",
    appId: "1:948398739240:web:85ba364a461fe19e56ca1d"
  },
  /* 예)
  firebase: {
    apiKey: '...',
    authDomain: 'your-project.firebaseapp.com',
    databaseURL: 'https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'your-project',
    appId: '...'
  },
  */

  // 닉네임 앞에 자동으로 붙는 직급
  ranks: ['견습생', '수습 기사', '주임', '대리', '선임 기술자', '배관 기사', '안전 관리자', '현장 소장', '수석 엔지니어'],

  // 무전 시스템 알림. at: 'cue0'(미션1 시작) · 'cue1'(미션2 시작) 또는 영상 전체 기준 초(예: 120)
  alerts: [
    { at: 'cue0', text: '[시스템 알림] ⚠️ 1번 밸브 압력 이상 발생. 즉각적인 조치가 필요합니다.' },
    { at: 'cue1', text: '[시스템 알림] ⚠️ 설계 도면과 현장 치수 불일치 감지. 원리부터 분석하세요.' }
    // { at: 120, text: '[시스템 알림] 현장 점검 시작.' },
  ],

  // 미션 1 · 통수 테스트: 목표 인원(이 수만큼 성공하면 압력 0%). 'auto' = 현재 접속자 수. autoNext 를 false 로 하면 자동으로 넘어가지 않아요
  m1: { goal: 10, minGoal: 1, autoNext: true, autoNextMs: 3000 },   // goal: 성공 인원 목표(10명이면 압력 0%) · autoNext: 0%가 되면 3초 뒤 자동으로 다음 이야기로

  // 미션 2 · 도면 검수: 기본은 내장 SVG 도면(결함 4곳). 실제 도면을 쓰려면 이미지 주소와 결함 좌표를 넣으세요.
  // 예) imgNormal:'media/design.png', imgSite:'media/site.png', aspect:1.6,
  //     defects:[{id:'d1',x:0.31,y:0.62,r:0.05,note:'설명'}]   (x,y,r 은 이미지 크기에 대한 0~1 비율)
  m2: { imgNormal: null, imgSite: null, aspect: null, defects: null }
};
