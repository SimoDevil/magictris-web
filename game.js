(function(){
  const X = 'x';
  const O = 'o';

  const PIECES = {
    circle: { label:'Cerchio', type:'svg', svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="12" cy="12" r="8.4"/></svg>' },
    cross:  { label:'Croce', type:'svg', svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' },
    heart:  { label:'Cuore', type:'emoji', emoji:'❤️' },
    star:   { label:'Stellina', type:'emoji', emoji:'⭐' },
    unicorn:{ label:'Unicorno', type:'emoji', emoji:'🦄' },
    rainbow:{ label:'Arcobaleno', type:'emoji', emoji:'🌈' },
    mushroom:{ label:'Fungo', type:'emoji', emoji:'🍄' },
    lion:   { label:'Leone', type:'emoji', emoji:'🦁' },
    mermaid:{ label:'Sirena', type:'emoji', emoji:'🧜‍♀️' },
    strawberry:{ label:'Fragola', type:'emoji', emoji:'🍓' },
    flower: { label:'Fiore', type:'emoji', emoji:'🌸' },
    ladybug:{ label:'Coccinella', type:'emoji', emoji:'🐞' },
    sun:    { label:'Sole', type:'emoji', emoji:'☀️' },
    moon:   { label:'Mezzaluna', type:'emoji', emoji:'🌙' }
  };
  const PIECE_ORDER = ['cross','circle','heart','star','unicorn','rainbow','mushroom','lion','mermaid','strawberry','flower','ladybug','sun','moon'];

  const TEAMS = [
    { id:'juve', name:'Juventus', abbr:'JUV', bg:'#161616' },
    { id:'inter', name:'Inter', abbr:'INT', bg:'#0c1c8c' },
    { id:'milan', name:'Milan', abbr:'MIL', bg:'#a5121c' },
    { id:'napoli', name:'Napoli', abbr:'NAP', bg:'#1298c9' },
    { id:'roma', name:'Roma', abbr:'ROM', bg:'#8e1f2f' },
    { id:'lazio', name:'Lazio', abbr:'LAZ', bg:'#6bb9e8' },
    { id:'atalanta', name:'Atalanta', abbr:'ATA', bg:'#1e71b8' },
    { id:'fiorentina', name:'Fiorentina', abbr:'FIO', bg:'#5a2d81' },
    { id:'torino', name:'Torino', abbr:'TOR', bg:'#7b1113' },
    { id:'bologna', name:'Bologna', abbr:'BOL', bg:'#8a1731' }
  ];
  let footballMode = false;
  let teamX = 'juve';
  let teamO = 'inter';

  let pieceX = 'cross';
  let pieceO = 'circle';

  let board = Array(9).fill(null);
  let current = X;
  let vsCpu = false;
  let cpuDifficulty = 'facile'; // facile | medio | difficile
  let gameOver = false;
  let scores = { x: 0, o: 0, draw: 0 };

  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const score1El = document.getElementById('score1');
  const score2El = document.getElementById('score2');
  const scoreDrawEl = document.getElementById('scoreDraw');
  const p2label = document.getElementById('p2label');
  const pieceRowX = document.getElementById('pieceRowX');
  const pieceRowO = document.getElementById('pieceRowO');
  const pieceLabelO = document.getElementById('pieceLabelO');
  const teamRowX = document.getElementById('teamRowX');
  const teamRowO = document.getElementById('teamRowO');
  const teamLabelO = document.getElementById('teamLabelO');
  const previewX = document.getElementById('previewX');
  const previewO = document.getElementById('previewO');

  const WIN_LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  /* ---------- audio (sintetizzato, 100% offline) ---------- */
  let audioCtx = null;
  function getAudioCtx(){
    if(!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    if(audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function playTone(freq, start, duration, type, peak){
    try{
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak || 0.16, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.03);
    } catch(e){ /* audio non disponibile, si ignora silenziosamente */ }
  }
  function playPlaceSound(player){
    const base = player === X ? 660 : 500;
    playTone(base, 0, 0.13, 'sine', 0.15);
    playTone(base * 1.5, 0.02, 0.09, 'sine', 0.06);
  }
  function playNoiseBurst(duration, peakGain, filterFreq){
    try{
      const ctx = getAudioCtx();
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0;i<bufferSize;i++){ data[i] = Math.random()*2-1; }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq || 1200;
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(t0);
      noise.stop(t0 + duration + 0.05);
    } catch(e){ /* audio non disponibile */ }
  }
  function playSirenSweep(startFreq, endFreq, start, duration, peak){
    try{
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const gain = ctx.createGain();
      const t0 = ctx.currentTime + start;
      osc.frequency.setValueAtTime(startFreq, t0);
      osc.frequency.linearRampToValueAtTime(endFreq, t0 + duration);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch(e){ /* audio non disponibile */ }
  }
  function playVictoryAudio(){
    try{
      const el = document.getElementById('victoryAudio');
      if(!el) return;
      el.currentTime = 0;
      const p = el.play();
      if(p && p.catch) p.catch(() => { /* riproduzione bloccata, si ignora silenziosamente */ });
    } catch(e){ /* audio non disponibile */ }
  }
  function playDrawSound(){
    playTone(392, 0, 0.22, 'sine', 0.12);
    playTone(330, 0.15, 0.28, 'sine', 0.1);
  }

  /* ---------- screen navigation ---------- */
  function showScreen(id){
    const current = document.querySelector('.screen.active');
    const next = document.getElementById(id);
    if(current === next) return;
    if(current){
      current.classList.add('zoom-out');
      setTimeout(() => {
        current.classList.remove('active','zoom-out');
        next.classList.add('active','zoom-in');
        setTimeout(() => next.classList.remove('zoom-in'), 320);
      }, 220);
    } else {
      next.classList.add('active');
    }
  }

  /* ---------- magic particle burst (tap su blocchi di pietra) ---------- */
  function spawnMagicParticles(x, y, color){
    const n = 14;
    for(let i=0;i<n;i++){
      const p = document.createElement('div');
      p.className = 'magic-particle';
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random()*70;
      p.style.setProperty('--dx', Math.cos(ang)*dist + 'px');
      p.style.setProperty('--dy', Math.sin(ang)*dist + 'px');
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = color;
      p.style.boxShadow = '0 0 8px ' + color;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 750);
    }
  }
  function spawnMagicRings(x, y, color, size){
    for(let i=0;i<3;i++){
      const ring = document.createElement('div');
      ring.className = 'magic-ring';
      ring.style.setProperty('--ring-color', color);
      ring.style.width = size + 'px';
      ring.style.height = size + 'px';
      ring.style.left = x + 'px';
      ring.style.top = y + 'px';
      ring.style.animationDelay = (i*0.1) + 's';
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 700);
    }
  }
  function burstFromElement(el, color){
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    spawnMagicParticles(cx, cy, color);
    spawnMagicRings(cx, cy, color, Math.max(r.width, r.height));
  }

  /* ---------- sciame ambient di stelline sui blocchi (idle, home) ---------- */
  function buildAmbientSparks(){
    document.querySelectorAll('.stone-tablet.grey, .stone-tablet.gold').forEach(tablet => {
      const color = tablet.classList.contains('gold') ? '#ffe9a8' : '#c8fff0';
      for(let i=0;i<6;i++){
        const s = document.createElement('div');
        s.className = 'ambient-spark';
        const size = 2 + Math.random()*2;
        s.style.width = size + 'px';
        s.style.height = size + 'px';
        s.style.background = color;
        s.style.left = (Math.random()*100) + '%';
        s.style.top = (Math.random()*100) + '%';
        s.style.animationDelay = (Math.random()*2.4) + 's';
        tablet.appendChild(s);
      }
    });
  }

  document.getElementById('modeClassic').addEventListener('click', (e) => {
    footballMode = false;
    document.getElementById('modeClassic').classList.add('active');
    document.getElementById('modeFootball').classList.remove('active');
    burstFromElement(e.currentTarget, '#8ffcdc');
  });
  document.getElementById('modeFootball').addEventListener('click', (e) => {
    footballMode = true;
    document.getElementById('modeFootball').classList.add('active');
    document.getElementById('modeClassic').classList.remove('active');
    burstFromElement(e.currentTarget, '#ffd778');
  });

  document.getElementById('goCpu').addEventListener('click', () => {
    vsCpu = true;
    showScreen('screenDifficulty');
  });
  document.getElementById('go2p').addEventListener('click', () => {
    vsCpu = false;
    pieceLabelO.textContent = 'Pedina Due';
    teamLabelO.textContent = 'Squadra Due';
    goToSelectionScreen();
  });
  document.getElementById('diffBack').addEventListener('click', () => showScreen('screenHome'));
  document.getElementById('startCpuGame').addEventListener('click', () => {
    pieceLabelO.textContent = 'Pedina Due';
    teamLabelO.textContent = 'Squadra del Robot';
    goToSelectionScreen();
  });
  function goToSelectionScreen(){
    if(footballMode){ showScreen('screenTeams'); }
    else { showScreen('screenPieces'); }
  }
  document.getElementById('piecesBack').addEventListener('click', () => {
    showScreen(vsCpu ? 'screenDifficulty' : 'screenHome');
  });
  document.getElementById('teamsBack').addEventListener('click', () => {
    showScreen(vsCpu ? 'screenDifficulty' : 'screenHome');
  });
  document.getElementById('startFromPieces').addEventListener('click', () => startGameScreen());
  document.getElementById('startFromTeams').addEventListener('click', () => startGameScreen());
  document.getElementById('backBtn').addEventListener('click', () => showScreen('screenHome'));
  document.getElementById('homeBtn').addEventListener('click', () => showScreen('screenHome'));

  function startGameScreen(){
    scores = { x:0, o:0, draw:0 };
    updateScoreboard();
    showScreen('screenGame');
    newRound();
  }

  /* ---------- difficulty screen ---------- */
  const diffSlider = document.getElementById('diffSlider');
  const diffFace = document.getElementById('diffFace');
  const diffName = document.getElementById('diffName');
  const DIFF_META = [
    { key:'facile', label:'FACILE', emoji:'🙂' },
    { key:'medio', label:'MEDIO', emoji:'😐' },
    { key:'difficile', label:'DIFFICILE', emoji:'😈' }
  ];
  function updateDifficultyUI(){
    const meta = DIFF_META[diffSlider.value];
    cpuDifficulty = meta.key;
    diffFace.textContent = meta.emoji;
    diffName.textContent = meta.label;
  }
  diffSlider.addEventListener('input', updateDifficultyUI);
  updateDifficultyUI();

  /* ---------- piece picker ---------- */
  function pieceMarkup(id){
    const p = PIECES[id];
    if(p.type === 'svg') return p.svg;
    return `<span class="emoji">${p.emoji}</span>`;
  }

  function buildPiecePickers(){
    pieceRowX.innerHTML = '';
    pieceRowO.innerHTML = '';
    PIECE_ORDER.forEach(id => {
      const btnX = document.createElement('button');
      btnX.className = 'piece-btn x' + (pieceX === id ? ' selected x' : '');
      btnX.innerHTML = pieceMarkup(id);
      btnX.title = PIECES[id].label;
      btnX.addEventListener('click', () => selectPiece('x', id));
      pieceRowX.appendChild(btnX);

      const btnO = document.createElement('button');
      btnO.className = 'piece-btn o' + (pieceO === id ? ' selected o' : '');
      btnO.innerHTML = pieceMarkup(id);
      btnO.title = PIECES[id].label;
      btnO.addEventListener('click', () => selectPiece('o', id));
      pieceRowO.appendChild(btnO);
    });
    previewX.innerHTML = pieceMarkup(pieceX);
    previewO.innerHTML = pieceMarkup(pieceO);
  }

  function selectPiece(player, id){
    if(player === 'x'){
      if(id === pieceO) pieceO = pieceX;
      pieceX = id;
    } else {
      if(id === pieceX) pieceX = pieceO;
      pieceO = id;
    }
    buildPiecePickers();
    render();
  }

  function teamBadgeMarkup(id){
    const t = TEAMS.find(tm => tm.id === id);
    return `<svg viewBox="0 0 40 46" width="100%" height="100%">
      <path d="M20 2 L36 8 V21 C36 33 28 41.5 20 44.5 C12 41.5 4 33 4 21 V8 Z" fill="${t.bg}" stroke="#ffd76b" stroke-width="2"/>
      <path d="M20 5.5 L32.5 10 V21 C32.5 30.5 26 37 20 40 C14 37 7.5 30.5 7.5 21 V10 Z" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1"/>
      <polygon points="20,6.5 21.1,9.6 24.4,9.6 21.7,11.5 22.7,14.6 20,12.7 17.3,14.6 18.3,11.5 15.6,9.6 18.9,9.6" fill="#ffd76b"/>
      <text x="20" y="29" text-anchor="middle" font-size="10.5" font-weight="900" fill="#ffffff" font-family="Segoe UI, sans-serif" style="paint-order:stroke; stroke:rgba(0,0,0,0.5); stroke-width:2px;">${t.abbr}</text>
    </svg>`;
  }

  function buildTeamPickers(){
    teamRowX.innerHTML = '';
    teamRowO.innerHTML = '';
    TEAMS.forEach(t => {
      const btnX = document.createElement('button');
      btnX.className = 'team-btn' + (teamX === t.id ? ' selected' : '');
      btnX.innerHTML = teamBadgeMarkup(t.id);
      btnX.title = t.name;
      btnX.addEventListener('click', () => selectTeam('x', t.id));
      teamRowX.appendChild(btnX);

      const btnO = document.createElement('button');
      btnO.className = 'team-btn' + (teamO === t.id ? ' selected' : '');
      btnO.innerHTML = teamBadgeMarkup(t.id);
      btnO.title = t.name;
      btnO.addEventListener('click', () => selectTeam('o', t.id));
      teamRowO.appendChild(btnO);
    });
  }

  function selectTeam(player, id){
    if(player === 'x'){
      if(id === teamO) teamO = teamX;
      teamX = id;
    } else {
      if(id === teamX) teamX = teamO;
      teamO = id;
    }
    buildTeamPickers();
    render();
  }

  /* ---------- mini board decoration on home ---------- */
  function buildMiniBoard(){
    const mini = document.getElementById('miniBoard');
    const demo = ['x','o','','x','o','o','','x',''];
    mini.innerHTML = '';
    demo.forEach(v => {
      const c = document.createElement('div');
      c.className = 'mc' + (v ? ' ' + v : '');
      c.textContent = v ? (v === 'x' ? 'X' : 'O') : '';
      mini.appendChild(c);
    });
  }

  /* ---------- board logic ---------- */
  function buildBoard(){
    boardEl.innerHTML = '';
    for(let i=0;i<9;i++){
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.dataset.index = i;
      cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
    }
    const line = document.createElement('div');
    line.className = 'win-line';
    line.id = 'winLine';
    boardEl.appendChild(line);
  }

  function render(){
    const cells = boardEl.querySelectorAll('.cell');
    for(let i=0;i<9;i++){
      const val = board[i];
      cells[i].classList.toggle('filled', !!val);
      if(val){
        if(footballMode){
          const teamId = val === X ? teamX : teamO;
          cells[i].innerHTML = `<span class="mark ${val}" style="width:70%;height:70%;">${teamBadgeMarkup(teamId)}</span>`;
        } else {
          const pieceId = val === X ? pieceX : pieceO;
          cells[i].innerHTML = `<span class="mark ${val}">${pieceMarkup(pieceId)}</span>`;
        }
      } else {
        cells[i].innerHTML = '';
      }
    }
    if(footballMode){
      previewX.innerHTML = `<span style="display:inline-block;width:76px;height:76px;">${teamBadgeMarkup(teamX)}</span>`;
      previewO.innerHTML = `<span style="display:inline-block;width:76px;height:76px;">${teamBadgeMarkup(teamO)}</span>`;
    } else {
      previewX.innerHTML = pieceMarkup(pieceX);
      previewO.innerHTML = pieceMarkup(pieceO);
    }
  }

  function updateStatus(text){ statusEl.innerHTML = '<span class="flourish">&infin;</span> ' + text + ' <span class="flourish">&infin;</span>'; }

  function checkWinnerOn(b){
    for(const line of WIN_LINES){
      const [a,bb,c] = line;
      if(b[a] && b[a] === b[bb] && b[bb] === b[c]){
        return { winner: b[a], line };
      }
    }
    if(b.every(c => c !== null)) return { winner: 'draw', line: [] };
    return null;
  }

  function drawWinLine(line, winner){
    const cells = boardEl.querySelectorAll('.cell');
    const boardRect = boardEl.getBoundingClientRect();
    const startRect = cells[line[0]].getBoundingClientRect();
    const endRect = cells[line[2]].getBoundingClientRect();

    const x1 = startRect.left + startRect.width/2 - boardRect.left;
    const y1 = startRect.top + startRect.height/2 - boardRect.top;
    const x2 = endRect.left + endRect.width/2 - boardRect.left;
    const y2 = endRect.top + endRect.height/2 - boardRect.top;

    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.sqrt(dx*dx + dy*dy) + 20;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    const winLine = document.getElementById('winLine');
    winLine.style.width = length + 'px';
    winLine.style.left = (x1 - 10) + 'px';
    winLine.style.top = (y1 - 3.5) + 'px';
    winLine.style.transform = `rotate(${angle}deg)`;
    winLine.classList.toggle('blue', winner === X);
    winLine.classList.add('show');
  }

  function onCellClick(e){
    if(gameOver) return;
    const i = parseInt(e.currentTarget.dataset.index);
    if(board[i]) return;
    if(vsCpu && current === O) return;
    playMove(i);
  }

  function playMove(i){
    if(board[i] || gameOver) return;
    board[i] = current;
    playPlaceSound(current);
    render();
    spawnPlacementFx(i, current);

    const result = checkWinnerOn(board);
    if(result){ finishGame(result); return; }

    current = current === X ? O : X;
    updateTurnStatus();

    if(vsCpu && current === O && !gameOver){
      setTimeout(cpuMove, 500);
    }
  }

  /* ---------- effetto schegge radiali + orbita al piazzamento pedina ---------- */
  function spawnPlacementFx(i, who){
    const cells = boardEl.querySelectorAll('.cell');
    const cellEl = cells[i];
    const markEl = cellEl.querySelector('.mark');
    if(!cellEl) return;
    const r = cellEl.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const color = who === X ? getComputedStyle(document.documentElement).getPropertyValue('--blue-glow') || '#2fd8ff' : '#ffcf4d';

    const n = 9;
    for(let k=0;k<n;k++){
      const shard = document.createElement('div');
      shard.className = 'placement-shard';
      const ang = (360/n)*k + Math.random()*10;
      shard.style.setProperty('--ang', ang + 'deg');
      shard.style.left = cx + 'px';
      shard.style.top = cy + 'px';
      shard.style.background = color;
      shard.style.boxShadow = '0 0 6px ' + color;
      document.body.appendChild(shard);
      setTimeout(() => shard.remove(), 500);
    }

    if(markEl){
      for(let k=0;k<4;k++){
        const orb = document.createElement('div');
        orb.className = 'orbit-particle';
        orb.style.setProperty('--orbit-r', (22 + Math.random()*6) + 'px');
        orb.style.background = color;
        orb.style.boxShadow = '0 0 5px ' + color;
        orb.style.animationDelay = (k*0.15) + 's';
        markEl.appendChild(orb);
        setTimeout(() => orb.remove(), 2000);
      }
    }
  }

  function updateTurnStatus(){
    if(current === X){
      updateStatus('Tocca a X!');
    } else {
      updateStatus(vsCpu ? 'Tocca al Robot...' : 'Tocca a O!');
    }
  }

  function finishGame(result){
    gameOver = true;
    if(result.winner === 'draw'){
      scores.draw++;
      updateStatus('Pareggio! 🤝');
      playDrawSound();
    } else {
      scores[result.winner]++;
      const name = result.winner === X ? 'X' : (vsCpu ? 'Robot' : 'O');
      updateStatus(`Ha vinto ${name}! 🎉`);
      drawWinLine(result.line, result.winner);
      playVictoryAudio();
    }
    updateScoreboard();
    showWinOverlay(result);
  }

  function showWinOverlay(result){
    const overlay = document.getElementById('winOverlay');
    const title = document.getElementById('winTitle');
    const emoji = document.getElementById('winEmoji');
    title.classList.remove('blue','pink','draw');
    if(result.winner === 'draw'){
      title.textContent = 'PAREGGIO!';
      title.classList.add('draw');
      emoji.textContent = '🤝';
    } else if(result.winner === X){
      title.textContent = 'HA VINTO X!';
      title.classList.add('blue');
      emoji.textContent = footballMode ? '⚽🥅' : '🎉';
    } else {
      title.textContent = vsCpu ? 'HA VINTO IL ROBOT!' : 'HA VINTO O!';
      title.classList.add('pink');
      emoji.textContent = footballMode ? '⚽🥅' : (vsCpu ? '🤖' : '🎉');
    }
    setTimeout(() => overlay.classList.add('show'), 350);
  }

  function hideWinOverlay(){
    document.getElementById('winOverlay').classList.remove('show');
  }

  document.getElementById('winRetry').addEventListener('click', () => {
    hideWinOverlay();
    newRound();
  });
  document.getElementById('winHome').addEventListener('click', () => {
    hideWinOverlay();
    showScreen('screenHome');
  });

  /* ---------- quick piece/team change during the match ---------- */
  const quickPieceOverlay = document.getElementById('quickPieceOverlay');
  const quickPieceRow = document.getElementById('quickPieceRow');
  const quickPieceTitle = document.getElementById('quickPieceTitle');

  function openQuickPieceChange(player){
    quickPieceTitle.textContent = footballMode
      ? (player === 'x' ? 'SQUADRA DI X' : 'SQUADRA DI O')
      : (player === 'x' ? 'PEDINA DI X' : 'PEDINA DI O');
    quickPieceRow.innerHTML = '';

    if(footballMode){
      TEAMS.forEach(t => {
        const current = player === 'x' ? teamX : teamO;
        const btn = document.createElement('button');
        btn.className = 'team-btn' + (current === t.id ? ' selected' : '');
        btn.innerHTML = teamBadgeMarkup(t.id);
        btn.title = t.name;
        btn.addEventListener('click', () => {
          selectTeam(player, t.id);
          quickPieceOverlay.classList.remove('show');
        });
        quickPieceRow.appendChild(btn);
      });
    } else {
      PIECE_ORDER.forEach(id => {
        const current = player === 'x' ? pieceX : pieceO;
        const btn = document.createElement('button');
        btn.className = 'piece-btn ' + player + (current === id ? ' selected ' + player : '');
        btn.innerHTML = pieceMarkup(id);
        btn.title = PIECES[id].label;
        btn.addEventListener('click', () => {
          selectPiece(player, id);
          quickPieceOverlay.classList.remove('show');
        });
        quickPieceRow.appendChild(btn);
      });
    }
    quickPieceOverlay.classList.add('show');
  }

  document.getElementById('chipX').addEventListener('click', () => openQuickPieceChange('x'));
  document.getElementById('chipO').addEventListener('click', () => openQuickPieceChange('o'));
  document.getElementById('quickPieceClose').addEventListener('click', () => {
    quickPieceOverlay.classList.remove('show');
  });

  function updateScoreboard(){
    score1El.textContent = scores.x;
    score2El.textContent = scores.o;
    scoreDrawEl.textContent = scores.draw;
  }

  /* ---------- CPU logic with difficulty ---------- */
  function emptyIndices(b){ return b.map((v,i)=> v===null?i:null).filter(v=>v!==null); }

  function findWinningMove(player, b){
    for(const line of WIN_LINES){
      const vals = line.map(i => b[i]);
      const countPlayer = vals.filter(v => v === player).length;
      const countEmpty = vals.filter(v => v === null).length;
      if(countPlayer === 2 && countEmpty === 1){
        return line[vals.findIndex(v => v === null)];
      }
    }
    return null;
  }

  function randomStrategicMove(empty, b){
    if(b[4] === null) return 4;
    const corners = [0,2,6,8].filter(i => b[i] === null);
    if(corners.length) return corners[Math.floor(Math.random()*corners.length)];
    return empty[Math.floor(Math.random()*empty.length)];
  }

  function minimax(b, player){
    const result = checkWinnerOn(b);
    if(result){
      if(result.winner === O) return { score: 10 };
      if(result.winner === X) return { score: -10 };
      return { score: 0 };
    }
    const avail = emptyIndices(b);
    const moves = avail.map(idx => {
      const nb = b.slice();
      nb[idx] = player;
      const r = minimax(nb, player === O ? X : O);
      return { index: idx, score: r.score };
    });
    if(player === O){
      return moves.reduce((best, m) => m.score > best.score ? m : best, moves[0]);
    } else {
      return moves.reduce((best, m) => m.score < best.score ? m : best, moves[0]);
    }
  }

  function cpuMove(){
    if(gameOver) return;
    const empty = emptyIndices(board);
    if(empty.length === 0) return;

    let move;
    if(cpuDifficulty === 'difficile'){
      move = minimax(board, O).index;
    } else if(cpuDifficulty === 'medio'){
      if(Math.random() < 0.25){
        move = empty[Math.floor(Math.random()*empty.length)];
      } else {
        move = findWinningMove(O, board) ?? findWinningMove(X, board) ?? randomStrategicMove(empty, board);
      }
    } else { // facile
      if(Math.random() < 0.75){
        move = empty[Math.floor(Math.random()*empty.length)];
      } else {
        move = findWinningMove(X, board) ?? empty[Math.floor(Math.random()*empty.length)];
      }
    }
    playMove(move);
  }

  function newRound(){
    board = Array(9).fill(null);
    current = X;
    gameOver = false;
    render();
    const winLine = document.getElementById('winLine');
    if(winLine) winLine.classList.remove('show');
    updateTurnStatus();
    hideWinOverlay();
  }

  function giveHint(){
    if(gameOver) return;
    const cells = boardEl.querySelectorAll('.cell');
    const empty = emptyIndices(board);
    if(empty.length === 0) return;
    const suggestion = findWinningMove(current, board) ?? findWinningMove(current === X ? O : X, board) ?? empty[Math.floor(Math.random()*empty.length)];
    cells[suggestion].style.boxShadow = '0 0 0 3px var(--gold), 0 0 16px var(--gold)';
    setTimeout(() => { cells[suggestion].style.boxShadow = ''; }, 1200);
  }

  document.getElementById('newRound').addEventListener('click', newRound);
  document.getElementById('hintBtn').addEventListener('click', giveHint);
  document.getElementById('resetScore').addEventListener('click', () => {
    scores = { x:0, o:0, draw:0 };
    updateScoreboard();
    newRound();
  });

  buildPiecePickers();
  buildTeamPickers();
  buildMiniBoard();
  buildBoard();
  render();
  updateScoreboard();
  updateTurnStatus();
  buildAmbientSparks();
})();
