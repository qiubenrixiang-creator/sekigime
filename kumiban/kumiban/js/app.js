// ============================================================
//  app.js — 画面の動きと保存
// ============================================================

const STORE_KEY = 'kumi.state.v1';

let state = {
  participants: [],   // { id, name, profile, locked }
  capacities: [],
  groups: null,       // [[id, ...], ...]
  history: [],        // 過去ラウンドの組み合わせ（pairKey の配列）
  round: 0
};

let selectedId = null;

// ---- 保存 --------------------------------------------------
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { /* 保存できなくても操作は続けられる */ }
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s && Array.isArray(s.participants)) state = Object.assign(state, s);
  } catch (e) { /* 壊れていたら初期状態のまま始める */ }
}

// ---- 画面切り替え ------------------------------------------
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'host') renderAll();
}

// ---- 質問 --------------------------------------------------
let quiz = { mode: 'code', index: 0, answers: [] };

function startQuiz(mode) {
  quiz = { mode: mode, index: 0, answers: [] };
  showView('quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[quiz.index];
  document.getElementById('quiz-progress').textContent =
    `${quiz.index + 1} / ${QUESTIONS.length}`;
  document.getElementById('quiz-bar').style.width =
    `${(quiz.index / QUESTIONS.length) * 100}%`;
  document.getElementById('quiz-question').textContent = q.text;

  const box = document.getElementById('quiz-options');
  box.innerHTML = '';
  q.options.forEach((opt) => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = opt.label;
    b.onclick = () => answerQuestion(opt.value);
    box.appendChild(b);
  });
}

function answerQuestion(value) {
  quiz.answers[quiz.index] = value;
  quiz.index++;
  if (quiz.index < QUESTIONS.length) { renderQuestion(); return; }

  const profile = buildProfile(quiz.answers);
  if (quiz.mode === 'add') {
    const name = (prompt('この人の名前を入力してください') || '').trim();
    if (!name) { showView('host'); return; }
    addParticipant(name, profile);
    showView('host');
  } else {
    showCode(profile);
  }
}

function quizBack() {
  if (quiz.index === 0) { quizAbort(); return; }
  quiz.index--;
  renderQuestion();
}

function quizAbort() {
  showView(quiz.mode === 'add' ? 'host' : 'home');
}

function showCode(profile) {
  document.getElementById('code-value').textContent = encodeProfile(profile);
  const tags = document.getElementById('code-tags');
  tags.innerHTML = '';
  describeProfile(profile).forEach((t) => {
    const el = document.createElement('span');
    el.className = 'tag';
    el.textContent = t;
    tags.appendChild(el);
  });
  showView('code');
}

// ---- 参加者 ------------------------------------------------
function newId() {
  return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function addParticipant(name, profile) {
  state.participants.push({ id: newId(), name: name, profile: profile, locked: null });
  state.groups = null;
  recalcCapacities(true);
  save();
  renderAll();
}

function addByCode() {
  const nameEl = document.getElementById('add-name');
  const codeEl = document.getElementById('add-code');
  const msg = document.getElementById('add-msg');
  const name = nameEl.value.trim();
  const code = codeEl.value.trim();

  if (!name) { msg.className = 'note note-warn'; msg.textContent = '名前を入力してください。'; nameEl.focus(); return; }
  const profile = decodeProfile(code);
  if (!profile) {
    msg.className = 'note note-warn';
    msg.textContent = 'コードが読み取れません。4文字を確認して、もう一度入力してください。';
    codeEl.focus();
    return;
  }
  if (state.participants.some((p) => p.name === name)) {
    // 同姓同名は実際に起きるので、止めずに区別できる形で受け入れる
    let n = 2;
    while (state.participants.some((p) => p.name === `${name}(${n})`)) n++;
    addParticipant(`${name}(${n})`, profile);
    msg.className = 'note';
    msg.textContent = `同じ名前の人がいたので「${name}(${n})」として追加しました。`;
  } else {
    addParticipant(name, profile);
    msg.className = 'note';
    msg.textContent = `${name} さんを追加しました。`;
  }
  nameEl.value = '';
  codeEl.value = '';
  nameEl.focus();
}

function removeParticipant(id) {
  const p = state.participants.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`${p.name} さんを削除しますか。`)) return;
  state.participants = state.participants.filter((x) => x.id !== id);
  if (state.groups) state.groups = state.groups.map((g) => g.filter((x) => x !== id));
  recalcCapacities(true);
  save();
  renderAll();
}

// ---- 卓の設定 ----------------------------------------------
function recalcCapacities(silent) {
  const size = parseInt(document.getElementById('pref-size').value) || 4;
  state.capacities = suggestCapacities(state.participants.length, size);
  state.groups = null;
  if (!silent) { save(); renderAll(); }
}

// ---- 割り当て ----------------------------------------------
function pastPairSet() {
  const s = new Set();
  state.history.forEach((round) => round.forEach((k) => s.add(k)));
  return s;
}

function runAssign() {
  const msg = document.getElementById('assign-msg');
  if (state.participants.length < 2) {
    msg.className = 'note note-warn';
    msg.textContent = '参加者を2名以上追加してください。';
    return;
  }
  if (!state.capacities.length) recalcCapacities(true);

  const people = state.participants.map((p) => ({
    id: p.id, name: p.name, profile: p.profile,
    lockedTable: Number.isInteger(p.locked) ? p.locked : undefined
  }));

  try {
    const groups = assignTables(people, state.capacities, pastPairSet());
    state.groups = groups.map((g) => g.map((p) => p.id));
    if (state.round === 0) state.round = 1;
    msg.className = 'note';
    msg.textContent = `第${state.round}ラウンドの割り当てができました。`;
    save();
    renderAll();
  } catch (e) {
    msg.className = 'note note-warn';
    msg.textContent = e.message;
  }
}

function nextRound() {
  if (!state.groups) { runAssign(); return; }
  // 今の組み合わせを記録してから、同じ顔ぶれを避けて組み直す
  const pairs = [];
  state.groups.forEach((g) => {
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++) pairs.push(pairKey(g[i], g[j]));
  });
  state.history.push(pairs);
  state.round++;
  state.participants.forEach((p) => { p.locked = null; });
  runAssign();
}

// ---- 手で入れ替える ----------------------------------------
function seatClick(tableIndex, id) {
  if (!state.groups) return;

  if (selectedId === null) {
    if (id === null) return;
    selectedId = id;
    renderTables();
    return;
  }
  if (selectedId === id) { selectedId = null; renderTables(); return; }

  const from = state.groups.findIndex((g) => g.includes(selectedId));
  if (from < 0) { selectedId = null; renderTables(); return; }

  if (id === null) {
    // 空席へ移動
    if (state.groups[tableIndex].length >= state.capacities[tableIndex]) { selectedId = null; renderTables(); return; }
    state.groups[from] = state.groups[from].filter((x) => x !== selectedId);
    state.groups[tableIndex].push(selectedId);
  } else {
    // 2人を入れ替え
    const to = state.groups.findIndex((g) => g.includes(id));
    if (to === from) { selectedId = null; renderTables(); return; }
    state.groups[from] = state.groups[from].map((x) => (x === selectedId ? id : x));
    state.groups[to] = state.groups[to].map((x) => (x === id ? selectedId : x));
  }
  selectedId = null;
  save();
  renderAll();
}

function toggleLock(id) {
  const p = state.participants.find((x) => x.id === id);
  if (!p) return;
  if (Number.isInteger(p.locked)) p.locked = null;
  else {
    const t = state.groups ? state.groups.findIndex((g) => g.includes(id)) : -1;
    p.locked = t >= 0 ? t : null;
  }
  save();
  renderAll();
}

// ---- 表示 --------------------------------------------------
function tableColor(i) {
  const c = TABLE_COLORS[i % TABLE_COLORS.length];
  const cycle = Math.floor(i / TABLE_COLORS.length);
  return { name: cycle === 0 ? c.name : `${c.name}${cycle + 1}`, hex: c.hex };
}

function renderRoster() {
  const box = document.getElementById('roster');
  document.getElementById('roster-count').textContent = `${state.participants.length}名`;
  box.innerHTML = '';

  if (state.participants.length === 0) {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = 'まだ誰もいません。名前とコードを入れて追加してください。';
    box.appendChild(p);
    return;
  }

  state.participants.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'roster-row';

    const who = document.createElement('div');
    who.className = 'who';
    const marks = [];
    if (p.profile.exp === 2) marks.push('説明できる');
    if (p.profile.exp === 0) marks.push('初心者');
    if (p.profile.leave === 1) marks.push('途中で帰る');
    if (Number.isInteger(p.locked)) marks.push(`${tableColor(p.locked).name}の卓に固定`);
    who.innerHTML = `<b></b><span class="meta"></span>`;
    who.querySelector('b').textContent = p.name;
    who.querySelector('.meta').textContent =
      describeProfile(p.profile).slice(0, 2).join('・') + (marks.length ? '／' + marks.join('・') : '');
    row.appendChild(who);

    const lock = document.createElement('button');
    lock.className = 'icon-btn';
    lock.title = '今の卓に固定する';
    lock.textContent = Number.isInteger(p.locked) ? '固定中' : '固定';
    lock.style.fontSize = '12px';
    lock.onclick = () => toggleLock(p.id);
    row.appendChild(lock);

    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.title = '削除';
    del.textContent = '×';
    del.onclick = () => removeParticipant(p.id);
    row.appendChild(del);

    box.appendChild(row);
  });
}

function renderCapSummary() {
  const el = document.getElementById('cap-summary');
  if (!state.capacities.length) { el.textContent = '参加者を追加すると、卓数のめやすが出ます。'; return; }
  const seats = state.capacities.reduce((a, b) => a + b, 0);
  el.textContent = `${state.capacities.length}卓（${state.capacities.join('・')}名）＝ ${seats}席／参加者 ${state.participants.length}名`;
}

function renderTables() {
  const box = document.getElementById('tables');
  const heading = document.getElementById('result-heading');
  const hint = document.getElementById('swap-hint');
  box.innerHTML = '';

  if (!state.groups) {
    heading.textContent = '卓の割り当て';
    hint.textContent = '';
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = '「卓を組む」を押すと、ここに結果が出ます。';
    box.appendChild(p);
    return;
  }

  heading.textContent = `第${state.round}ラウンドの割り当て`;
  hint.textContent = selectedId
    ? '入れ替える相手か、空席をタップしてください。'
    : '名前をタップして、もう1人をタップすると席を入れ替えられます。';

  state.groups.forEach((ids, ti) => {
    const color = tableColor(ti);
    const members = ids.map((id) => state.participants.find((p) => p.id === id)).filter(Boolean);

    const card = document.createElement('div');
    card.className = 'table-card';

    const head = document.createElement('div');
    head.className = 'table-head';
    head.style.background = color.hex;
    head.innerHTML = `<span class="label"></span><span class="count"></span>`;
    head.querySelector('.label').textContent = `${color.name}の卓`;
    head.querySelector('.count').textContent = `${members.length} / ${state.capacities[ti]}名`;
    card.appendChild(head);

    const body = document.createElement('div');
    body.className = 'table-body';

    members.forEach((m) => {
      const b = document.createElement('button');
      b.className = 'seat' + (selectedId === m.id ? ' selected' : '');
      const role = m.profile.exp === 2 ? 'ルール説明できる'
        : m.profile.exp === 0 ? '初心者' : '';
      const leave = m.profile.leave === 1 ? '途中退出' : '';
      const sub = [role, leave].filter(Boolean).join('・');
      b.innerHTML = `<span class="dot"></span><span class="nm"></span> <span class="role"></span>`;
      b.querySelector('.dot').style.background = color.hex;
      b.querySelector('.nm').textContent = m.name;
      b.querySelector('.role').textContent = sub;
      b.onclick = () => seatClick(ti, m.id);
      body.appendChild(b);
    });

    for (let k = members.length; k < state.capacities[ti]; k++) {
      const b = document.createElement('button');
      b.className = 'seat empty';
      b.textContent = '空席';
      b.onclick = () => seatClick(ti, null);
      body.appendChild(b);
    }

    const note = document.createElement('p');
    note.className = 'table-note';
    note.textContent = describeTable(members);
    body.appendChild(note);

    tableWarnings(members).forEach((w) => {
      const el = document.createElement('p');
      el.className = 'table-warn';
      el.textContent = w;
      body.appendChild(el);
    });

    card.appendChild(body);
    box.appendChild(card);
  });
}

function renderAll() {
  renderRoster();
  renderCapSummary();
  renderTables();
}

// ---- 書き出し ----------------------------------------------
function buildResultText() {
  if (!state.groups) return '';
  const lines = [`卓組み（第${state.round}ラウンド）`, ''];
  state.groups.forEach((ids, ti) => {
    const color = tableColor(ti);
    const members = ids.map((id) => state.participants.find((p) => p.id === id)).filter(Boolean);
    lines.push(`【${color.name}の卓】 ${members.map((m) => m.name).join('、')}`);
    lines.push(`  ${describeTable(members)}`);
    tableWarnings(members).forEach((w) => lines.push(`  ※${w}`));
    lines.push('');
  });
  return lines.join('\n');
}

function copyResult() {
  const text = buildResultText();
  if (!text) { alert('先に「卓を組む」を押してください。'); return; }
  navigator.clipboard.writeText(text)
    .then(() => alert('コピーしました。'))
    .catch(() => {
      // クリップボードが使えない環境向けの逃げ道
      window.prompt('下の文字を選択してコピーしてください。', text);
    });
}

function clearAll() {
  if (!confirm('参加者・割り当て・履歴をすべて消します。元に戻せません。よろしいですか。')) return;
  state = { participants: [], capacities: [], groups: null, history: [], round: 0 };
  selectedId = null;
  try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 消せなくても画面上は初期化される */ }
  renderAll();
}

// ---- 起動 --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  load();
  renderAll();

  // Enter で次の入力欄へ、コード欄では追加まで進む
  document.getElementById('add-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('add-code').focus(); }
  });
  document.getElementById('add-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addByCode(); }
  });
});
