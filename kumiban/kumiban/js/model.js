// ============================================================
//  model.js — 質問・プロフィール・コードの決まりごと
//  質問文を直したいときは、このファイルだけを編集してください。
// ============================================================

/*
 * プロフィールは6つの値でできています。
 *   weight   0..4  軽いゲーム ← → 重いゲーム
 *   strategy 0..4  運まかせ   ← → じっくり戦略
 *   talk     0..4  静かに集中 ← → わいわい喋る
 *   pace     0..4  長考OK     ← → テンポ重視
 *   exp      0..2  ほぼ初めて / 何回か / 説明もできる
 *   leave    0..1  途中で帰らない / 帰る
 */

const QUESTIONS = [
  {
    axis: 'weight',
    text: '1回のゲームに、どれくらい時間をかけたいですか。',
    options: [
      { label: '15分くらいでサクッと', value: 0 },
      { label: '30分〜1時間くらい', value: 2 },
      { label: '1時間以上でもいい', value: 4 }
    ]
  },
  {
    axis: 'weight',
    text: 'ルール説明に15分かかるゲームは、どうですか。',
    options: [
      { label: '正直しんどい', value: 0 },
      { label: '内容による', value: 2 },
      { label: 'むしろ好き', value: 4 }
    ]
  },
  {
    axis: 'strategy',
    text: 'サイコロやカードの引きで勝敗が変わるのは、どうですか。',
    options: [
      { label: 'それが楽しい', value: 0 },
      { label: '気にならない', value: 2 },
      { label: '実力で決めたい', value: 4 }
    ]
  },
  {
    axis: 'strategy',
    text: 'じっくり考えて最善手を探すのは、どうですか。',
    options: [
      { label: '疲れてしまう', value: 0 },
      { label: 'ほどほどなら', value: 2 },
      { label: '一番の楽しみ', value: 4 }
    ]
  },
  {
    axis: 'talk',
    text: 'ゲーム中は、どう過ごしたいですか。',
    options: [
      { label: '静かに集中したい', value: 0 },
      { label: 'ほどほどに喋りたい', value: 2 },
      { label: 'わいわい盛り上がりたい', value: 4 }
    ]
  },
  {
    axis: 'talk',
    text: '交渉したり、相談しながら進めるゲームは、どうですか。',
    options: [
      { label: '苦手', value: 0 },
      { label: 'ふつう', value: 2 },
      { label: '得意', value: 4 }
    ]
  },
  {
    axis: 'pace',
    text: '他の人が長考していると、どう感じますか。',
    options: [
      { label: '気にならない', value: 0 },
      { label: '少し待つのは平気', value: 2 },
      { label: '退屈してしまう', value: 4 }
    ]
  },
  {
    axis: 'exp',
    text: 'ボードゲームで遊んだ経験はどれくらいですか。',
    options: [
      { label: 'ほぼ初めて', value: 0 },
      { label: '何回か遊んだ', value: 1 },
      { label: 'ルール説明もできる', value: 2 }
    ]
  },
  {
    axis: 'leave',
    text: '今日は途中で帰る予定がありますか。',
    options: [
      { label: '最後までいる', value: 0 },
      { label: '途中で帰る', value: 1 }
    ]
  }
];

// 卓の色。会場では「A卓」より「赤の卓」の方が探しやすいので色で呼びます。
const TABLE_COLORS = [
  { name: '赤', hex: '#C0392B' },
  { name: '青', hex: '#2A6FB0' },
  { name: '緑', hex: '#2E7D4F' },
  { name: '黄', hex: '#C89211' },
  { name: '紫', hex: '#7B4F9D' },
  { name: '橙', hex: '#CC6314' },
  { name: '桃', hex: '#BE1F63' },
  { name: '黒', hex: '#33322F' }
];

// ---- コードの変換 ------------------------------------------
// 見間違えやすい 0 1 I O を除いた32文字
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function encodeProfile(p) {
  let v = 0;
  v = v * 5 + p.weight;
  v = v * 5 + p.strategy;
  v = v * 5 + p.talk;
  v = v * 5 + p.pace;
  v = v * 3 + p.exp;
  v = v * 2 + p.leave;

  let body = '';
  let x = v;
  for (let i = 0; i < 3; i++) {
    body = CODE_ALPHABET[x % 32] + body;
    x = Math.floor(x / 32);
  }
  let sum = 0;
  for (const ch of body) sum += CODE_ALPHABET.indexOf(ch);
  return body + CODE_ALPHABET[sum % 32];
}

// 打ち間違いをその場で弾けるよう、4文字目は検査用の文字にしています。
function decodeProfile(code) {
  if (typeof code !== 'string') return null;
  const s = code.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.length !== 4) return null;
  for (const ch of s) if (CODE_ALPHABET.indexOf(ch) < 0) return null;

  const body = s.slice(0, 3);
  let sum = 0;
  for (const ch of body) sum += CODE_ALPHABET.indexOf(ch);
  if (CODE_ALPHABET[sum % 32] !== s[3]) return null;

  let v = 0;
  for (const ch of body) v = v * 32 + CODE_ALPHABET.indexOf(ch);
  if (v >= 5 * 5 * 5 * 5 * 3 * 2) return null;

  const leave = v % 2; v = Math.floor(v / 2);
  const exp = v % 3; v = Math.floor(v / 3);
  const pace = v % 5; v = Math.floor(v / 5);
  const talk = v % 5; v = Math.floor(v / 5);
  const strategy = v % 5; v = Math.floor(v / 5);
  const weight = v % 5;
  return { weight, strategy, talk, pace, exp, leave };
}

// ---- 回答からプロフィールを作る ----------------------------
function buildProfile(answers) {
  const bucket = {};
  QUESTIONS.forEach((q, i) => {
    (bucket[q.axis] = bucket[q.axis] || []).push(answers[i]);
  });
  const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  return {
    weight: avg(bucket.weight),
    strategy: avg(bucket.strategy),
    talk: avg(bucket.talk),
    pace: avg(bucket.pace),
    exp: bucket.exp[0],
    leave: bucket.leave[0]
  };
}

// ---- 言葉にする --------------------------------------------
function band(v, low, high) { return v < 1.3 ? low : (v < 2.7 ? null : high); }

function describeProfile(p) {
  const parts = [];
  parts.push(p.weight < 1.3 ? '軽めのゲーム好き' : p.weight < 2.7 ? '中量級が好み' : '重量級もいける');
  parts.push(p.talk < 1.3 ? '静かに集中したい' : p.talk < 2.7 ? '会話はほどほど' : 'わいわい喋りたい');
  parts.push(p.strategy < 1.3 ? '運まかせを楽しむ' : p.strategy < 2.7 ? '運も戦略も' : 'じっくり戦略派');
  parts.push(p.pace >= 2.7 ? 'テンポ重視' : p.pace < 1.3 ? '長考も平気' : 'ペースはふつう');
  return parts;
}

function describeTable(members) {
  if (members.length === 0) return 'まだ誰もいません';
  const avg = (k) => members.reduce((s, m) => s + m.profile[k], 0) / members.length;
  const w = avg('weight'), t = avg('talk'), s = avg('strategy'), pc = avg('pace');
  const out = [];
  out.push(t < 1.3 ? '静かに集中' : t < 2.7 ? '会話はほどほど' : 'わいわい賑やか');
  out.push(w < 1.3 ? '軽めのゲーム' : w < 2.7 ? '中量級' : '重量級もOK');
  out.push(s < 1.3 ? '運まかせ寄り' : s < 2.7 ? '運と戦略のバランス' : 'じっくり戦略');
  if (pc >= 2.7) out.push('テンポ重視');
  return out.join('・');
}

// 幹事が当日気にするべきことだけを警告として出します。
function tableWarnings(members) {
  const w = [];
  if (members.length === 0) return w;
  const hasBeginner = members.some((m) => m.profile.exp === 0);
  const hasTeacher = members.some((m) => m.profile.exp === 2);
  if (hasBeginner && !hasTeacher) w.push('初心者がいますが、ルール説明ができる人がいません');

  const talks = members.map((m) => m.profile.talk);
  if (Math.max(...talks) - Math.min(...talks) >= 3) w.push('会話量の希望が大きく違う人が同席しています');

  const avgWeight = members.reduce((s, m) => s + m.profile.weight, 0) / members.length;
  if (members.some((m) => m.profile.leave === 1) && avgWeight >= 2.7) {
    w.push('途中で帰る人がいるので、長いゲームは避けてください');
  }
  return w;
}
