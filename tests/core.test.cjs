'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const C = require('../web/core.js');
const raw = fs.readFileSync(require('node:path').join(__dirname, '../banks/demo.json'), 'utf8');
const fresh = () => JSON.parse(raw);
const bank = C.parseBank(raw);
test('bundled browser bank exactly matches the separately editable example', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../web/demo-bank.js'), 'utf8'), sandbox);
  assert.equal(JSON.stringify(sandbox.window.DEMO_BANK), JSON.stringify(fresh()));
});
test('original demo has complete courses and explanations; canonical export round-trips', () => {
  assert.equal(bank.courses.length, 3); assert.equal(bank.questions.length, 18);
  assert.deepEqual(C.parseBank(JSON.stringify(bank)), bank);
  const b = fresh(); delete b.description;
  assert.deepEqual(C.parseBank(JSON.stringify(C.validateBank(b))), C.validateBank(b));
});
test('malformed, oversized and unsupported-version banks fail before use', () => {
  assert.throws(() => C.parseBank('{oops'), /JSON/);
  assert.throws(() => C.parseBank('界'.repeat(400000)), /1 MiB/);
  const b = fresh(); b.schemaVersion = 2; assert.throws(() => C.validateBank(b), /schemaVersion/);
});
test('unknown personal-data fields and prototype-shaped input are rejected', () => {
  const b = fresh(); b.childName = 'Synthetic example'; assert.throws(() => C.validateBank(b), /childName/);
  assert.throws(() => C.parseBank(raw.replace('"schemaVersion": 1', '"__proto__": {}, "schemaVersion": 1')), /__proto__/);
});
test('duplicate ids, unknown course links and empty courses cannot silently pass', () => {
  let b = fresh(); b.questions[1].id = b.questions[0].id; assert.throws(() => C.validateBank(b), /重复/);
  b = fresh(); b.courses[1].id = b.courses[0].id; assert.throws(() => C.validateBank(b), /重复/);
  b = fresh(); b.questions[0].courseId = 'unknown'; assert.throws(() => C.validateBank(b), /不存在/);
  b = fresh(); b.questions = b.questions.filter(q => q.courseId !== b.courses[0].id); assert.throws(() => C.validateBank(b), /没有题目/);
});
test('ambiguous options, invalid answers and unsupported numbers of choices are refused', () => {
  for (const invalid of [-1, 4, 0.5, '2']) { const b = fresh(); b.questions[0].answerIndex = invalid; assert.throws(() => C.validateBank(b), /answerIndex/); }
  const b = fresh(); b.questions[0].choices[1] = b.questions[0].choices[0]; assert.throws(() => C.validateBank(b), /重复/);
  b.questions[0].choices = ['only']; assert.throws(() => C.validateBank(b), /2–4/);
});
test('text bounds and control characters are rejected; markup remains inert text data', () => {
  let b = fresh(); b.questions[0].prompt = 'x'.repeat(321); assert.throws(() => C.validateBank(b), /320/);
  b = fresh(); b.questions[0].prompt = '\u0000'; assert.throws(() => C.validateBank(b), /文字/);
  b = fresh(); b.questions[0].prompt = '<img src=x onerror=alert(1)>';
  assert.equal(C.validateBank(b).questions[0].prompt, b.questions[0].prompt);
});
test('wrong-first scheduling is course-scoped, unique and capped by available questions', () => {
  const ids = [bank.questions[0].id, bank.questions[7].id];
  const picked = C.selectQuestions(bank, bank.courses[0].id, 500, ids, () => 0.5);
  assert.equal(picked.length, 6); assert.equal(picked[0].id, ids[0]);
  assert.equal(new Set(picked.map(q => q.id)).size, picked.length);
  assert.ok(picked.every(q => q.courseId === bank.courses[0].id));
});
test('empty selections, invalid sizes and invalid random sources fail clearly', () => {
  assert.throws(() => C.selectQuestions(bank, 'missing', 3), /没有/);
  assert.throws(() => C.selectQuestions(bank, bank.courses[0].id, 0), /题数/);
  assert.throws(() => C.selectQuestions(bank, bank.courses[0].id, 3, [], () => 1), /随机/);
});
test('finite session records one answer per question and requires feedback before next', () => {
  const s = C.createSession(bank.questions.slice(0, 2));
  assert.throws(() => C.next(s), /先作答/);
  assert.throws(() => C.answer(s, -1), /范围/); assert.equal(s.answers.length, 0);
  const q = s.questions[0]; assert.equal(C.answer(s, q.answerIndex).correct, true);
  assert.throws(() => C.answer(s, q.answerIndex), /已作答/);
  assert.equal(C.next(s), 'question'); C.answer(s, (s.questions[1].answerIndex + 1) % 4);
  assert.equal(C.next(s), 'done'); assert.equal(s.answers.length, 2);
  assert.throws(() => C.answer(s, 0), /已作答/);
});
test('a wrong answer can proceed without an unbounded punishment loop', () => {
  const s = C.createSession([bank.questions[0]]);
  C.answer(s, (s.questions[0].answerIndex + 1) % 4);
  assert.equal(C.next(s), 'done'); assert.equal(s.questions.length, 1);
});
test('review ids clear on a later correct answer without mixing unrelated questions', () => {
  assert.deepEqual(C.updateWrongIds(['a', 'b'], [{ questionId: 'a', correct: true }, { questionId: 'c', correct: false }]), ['b', 'c']);
});
test('countdown uses elapsed time, catches delayed ticks and clamps at zero', () => {
  assert.equal(C.remaining(20000, 0), 20); assert.equal(C.remaining(20000, 19999), 1);
  assert.equal(C.remaining(20000, 30000), 0);
});
test('same-id edited banks get independent progress buckets', () => {
  const b = fresh(); b.questions[0].prompt += ' 新版本';
  assert.notEqual(C.fingerprint(bank), C.fingerprint(C.validateBank(b)));
});
test('CLI checks the editable sample without printing its full content', () => {
  const r = spawnSync(process.execPath, ['tools/check-bank.cjs', 'banks/demo.json'], { cwd: require('node:path').join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(r.status, 0); assert.deepEqual(JSON.parse(r.stdout), { valid: true, courses: 3, questions: 18 });
});
test('CLI rejects malformed UTF-8 instead of silently replacing text', () => {
  const path = require('node:path');
  const folder = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'livingroom-bank-test-'));
  const file = path.join(folder, 'invalid.json');
  try {
    fs.writeFileSync(file, Buffer.from([0x7b,0x22,0x78,0x22,0x3a,0x22,0xff,0x22,0x7d]));
    const r = spawnSync(process.execPath, ['tools/check-bank.cjs', file], { cwd:path.join(__dirname,'..'),encoding:'utf8' });
    assert.equal(r.status, 1); assert.equal(r.stdout, ''); assert.match(r.stderr, /题库检查未通过/);
  } finally { fs.unlinkSync(file); fs.rmdirSync(folder); }
});
