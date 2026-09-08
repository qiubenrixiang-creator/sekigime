// ============================================================
//  assign.js — 卓の割り当てを計算する部分
//
//  考え方:
//   1. 「揃えたい軸」だけをコストにする。
//      会話量・テンポ・重さがバラバラな卓は、実際に居心地が悪くなります。
//      逆に運/戦略の好みは違っていても構わないので、コストに入れません。
//   2. 定員を必ず守る。
//   3. まず素朴に配ってから、2人ずつ入れ替えて改善できるか試す。
//      参加者が数十人なら、これで十分よい答えが出ます。
// ============================================================

const COST_WEIGHTS = { talk: 1.5, pace: 1.2, weight: 1.0 };
const PENALTY_NO_TEACHER = 12;   // 初心者だけの卓を作らない
const PENALTY_LEAVE_HEAVY = 6;   // 途中退出者を重い卓に入れない
const PENALTY_REPEAT = 4;        // 前のラウンドと同じ顔ぶれを避ける

function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

function tableCost(members, pastPairs) {
  if (members.length <= 1) return 0;
  let cost = 0;

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i].profile, b = members[j].profile;
      cost += COST_WEIGHTS.talk * Math.abs(a.talk - b.talk);
      cost += COST_WEIGHTS.pace * Math.abs(a.pace - b.pace);
      cost += COST_WEIGHTS.weight * Math.abs(a.weight - b.weight);
      if (pastPairs && pastPairs.has(pairKey(members[i].id, members[j].id))) {
        cost += PENALTY_REPEAT;
      }
    }
  }
  cost = cost / (members.length - 1);

  const hasBeginner = members.some((m) => m.profile.exp === 0);
  const hasTeacher = members.some((m) => m.profile.exp === 2);
  if (hasBeginner && !hasTeacher) cost += PENALTY_NO_TEACHER;

  const avgWeight = members.reduce((s, m) => s + m.profile.weight, 0) / members.length;
  const leavers = members.filter((m) => m.profile.leave === 1).length;
  if (leavers > 0) cost += PENALTY_LEAVE_HEAVY * leavers * (avgWeight / 4);

  return cost;
}

function totalCost(groups, pastPairs) {
  return groups.reduce((s, g) => s + tableCost(g, pastPairs), 0);
}

function shuffled(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 同じ結果を再現できるよう、乱数は種から作ります。
function makeRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/*
 * people    : [{ id, name, profile, lockedTable }]
 * capacities: [4, 4, 4, ...]
 * pastPairs : Set of pairKey
 * 戻り値    : [[person, ...], [person, ...], ...]
 */
function assignTables(people, capacities, pastPairs) {
  const totalSeats = capacities.reduce((a, b) => a + b, 0);
  if (people.length > totalSeats) {
    throw new Error(`席が足りません。参加者${people.length}名に対して${totalSeats}席しかありません。`);
  }

  const locked = people.filter((p) => Number.isInteger(p.lockedTable));
  const free = people.filter((p) => !Number.isInteger(p.lockedTable));

  let best = null, bestCost = Infinity;

  for (let restart = 0; restart < 6; restart++) {
    const rand = makeRandom(restart * 7919 + 13);
    const groups = capacities.map(() => []);

    // 固定された人を先に座らせる
    locked.forEach((p) => {
      const t = Math.min(p.lockedTable, groups.length - 1);
      groups[t].push(p);
    });

    // 会話量の近い人が固まるように並べてから、順に空席へ配る
    const order = restart === 0
      ? free.slice().sort((a, b) => (b.profile.talk * 5 + b.profile.pace) - (a.profile.talk * 5 + a.profile.pace))
      : shuffled(free, rand);

    order.forEach((p) => {
      let target = -1, targetCost = Infinity;
      for (let t = 0; t < groups.length; t++) {
        if (groups[t].length >= capacities[t]) continue;
        const c = tableCost(groups[t].concat([p]), pastPairs) - tableCost(groups[t], pastPairs);
        if (c < targetCost) { targetCost = c; target = t; }
      }
      groups[target].push(p);
    });

    // 2人を入れ替えて、全体が良くなるなら採用する
    let cur = totalCost(groups, pastPairs);
    const movable = [];
    groups.forEach((g, t) => g.forEach((p, i) => {
      if (!Number.isInteger(p.lockedTable)) movable.push([t, i]);
    }));

    for (let iter = 0; iter < 8000; iter++) {
      const ti = Math.floor(rand() * groups.length);
      const tj = Math.floor(rand() * groups.length);
      if (ti === tj) continue;
      const gi = groups[ti], gj = groups[tj];
      if (gi.length === 0) continue;

      const ii = Math.floor(rand() * gi.length);
      if (Number.isInteger(gi[ii].lockedTable)) continue;

      const before = tableCost(gi, pastPairs) + tableCost(gj, pastPairs);

      if (gj.length < capacities[tj]) {
        // 空席があるなら、移動も試す
        const moved = gi[ii];
        gi.splice(ii, 1); gj.push(moved);
        const after = tableCost(gi, pastPairs) + tableCost(gj, pastPairs);
        if (after < before) { cur += after - before; continue; }
        gj.pop(); gi.splice(ii, 0, moved);
      }

      if (gj.length === 0) continue;
      const jj = Math.floor(rand() * gj.length);
      if (Number.isInteger(gj[jj].lockedTable)) continue;

      [gi[ii], gj[jj]] = [gj[jj], gi[ii]];
      const after = tableCost(gi, pastPairs) + tableCost(gj, pastPairs);
      if (after < before) { cur += after - before; }
      else { [gi[ii], gj[jj]] = [gj[jj], gi[ii]]; }
    }

    const finalCost = totalCost(groups, pastPairs);
    if (finalCost < bestCost) { bestCost = finalCost; best = groups; }
  }

  return best;
}

// 人数から卓数と定員を決める。1卓だけ少人数になるより、均等に散らす方がよい。
function suggestCapacities(peopleCount, preferredSize) {
  const size = preferredSize || 4;
  if (peopleCount < 2) return [];
  let tables = Math.max(1, Math.round(peopleCount / size));
  // 1卓あたり2名を切らないよう調整
  while (tables > 1 && peopleCount / tables < 2) tables--;
  const base = Math.floor(peopleCount / tables);
  let rest = peopleCount % tables;
  const caps = [];
  for (let i = 0; i < tables; i++) {
    caps.push(base + (rest > 0 ? 1 : 0));
    if (rest > 0) rest--;
  }
  return caps;
}

if (typeof module !== 'undefined') {
  module.exports = { assignTables, suggestCapacities, tableCost, pairKey };
}
