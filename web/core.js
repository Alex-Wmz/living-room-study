/* Copyright 2026 Alex-Wmz. See LICENSE and NOTICE. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudyCore = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_BYTES = 1024 * 1024;
  const OWN = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  function fail(message) { throw new Error(message); }
  function keys(o, required, optional, path) {
    if (!isObject(o)) fail(path + ' 必须是对象');
    for (const k of required) if (!OWN(o, k)) fail(path + ' 缺少 ' + k);
    for (const k of Object.keys(o)) if (!required.includes(k) && !optional.includes(k)) fail(path + ' 含不支持字段 ' + k);
  }
  function text(v, max, path) {
    if (typeof v !== 'string' || !v.trim() || v.trim().length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v)) fail(path + ' 必须是 1–' + max + ' 字的文字');
    return v.trim();
  }
  function id(v, path) {
    if (typeof v !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(v)) fail(path + ' 只支持 1–48 位小写字母、数字、横线和下划线');
    return v;
  }
  function parseBank(raw) {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_BYTES) fail('题库文件须为不超过 1 MiB 的 UTF-8 JSON');
    let input;
    try { input = JSON.parse(raw.replace(/^\uFEFF/, '')); } catch (_) { fail('JSON 格式不正确，请检查逗号、引号和括号'); }
    return validateBank(input);
  }
  function validateBank(input) {
    keys(input, ['schemaVersion', 'id', 'title', 'courses', 'questions'], ['description'], '题库');
    if (input.schemaVersion !== 1) fail('仅支持 schemaVersion 1');
    if (!Array.isArray(input.courses) || input.courses.length < 1 || input.courses.length > 30) fail('课程数量须为 1–30');
    if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 500) fail('题目数量须为 1–500');
    const courseIds = new Set(), questionIds = new Set();
    const courses = input.courses.map((c, i) => {
      const p = '课程 ' + (i + 1);
      keys(c, ['id', 'title', 'subject', 'stage', 'unit', 'source'], [], p);
      const value = { id: id(c.id, p + ' id'), title: text(c.title, 60, p + ' 标题'), subject: text(c.subject, 20, p + ' 学科'), stage: text(c.stage, 40, p + ' 阶段'), unit: text(c.unit, 60, p + ' 单元'), source: text(c.source, 180, p + ' 来源') };
      if (courseIds.has(value.id)) fail('课程 id 重复：' + value.id);
      courseIds.add(value.id); return value;
    });
    const questions = input.questions.map((q, i) => {
      const p = '题目 ' + (i + 1);
      keys(q, ['id', 'courseId', 'prompt', 'choices', 'answerIndex', 'explanation'], ['tags'], p);
      const qid = id(q.id, p + ' id');
      if (questionIds.has(qid)) fail('题目 id 重复：' + qid);
      questionIds.add(qid);
      if (!courseIds.has(q.courseId)) fail(p + ' 的 courseId 不存在');
      if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 4) fail(p + ' 须含 2–4 个选项');
      const choices = q.choices.map((v, n) => text(v, 140, p + ' 选项 ' + (n + 1)));
      if (new Set(choices).size !== choices.length) fail(p + ' 的选项不能重复');
      if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= choices.length) fail(p + ' answerIndex 超出范围（从 0 起算）');
      const tags = q.tags === undefined ? [] : q.tags;
      if (!Array.isArray(tags) || tags.length > 8) fail(p + ' tags 须为最多 8 项的数组');
      return { id: qid, courseId: q.courseId, prompt: text(q.prompt, 320, p + ' 题干'), choices, answerIndex: q.answerIndex, explanation: text(q.explanation, 480, p + ' 解析'), tags: tags.map(v => text(v, 32, p + ' 标签')) };
    });
    for (const c of courses) if (!questions.some(q => q.courseId === c.id)) fail('课程 ' + c.id + ' 没有题目');
    return { schemaVersion: 1, id: id(input.id, '题库 id'), title: text(input.title, 80, '题库标题'), description: input.description === undefined || input.description === '' ? '' : text(input.description, 300, '题库说明'), courses, questions };
  }
  function selectQuestions(bank, courseId, limit, wrongIds, random) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) fail('练习题数须为 1–500');
    const pool = bank.questions.filter(q => q.courseId === courseId);
    if (!pool.length) fail('所选课程没有可用题目');
    const wrong = new Set(wrongIds || []), rng = random || Math.random;
    function shuffle(items) {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const r = rng();
        if (!(r >= 0 && r < 1)) fail('随机值超出范围');
        const j = Math.floor(r * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }
    return shuffle(pool.filter(q => wrong.has(q.id))).concat(shuffle(pool.filter(q => !wrong.has(q.id)))).slice(0, limit);
  }
  function createSession(questions) {
    if (!Array.isArray(questions) || !questions.length) fail('本轮没有题目');
    return { questions: questions.slice(), index: 0, answers: [], phase: 'question' };
  }
  function answer(session, choice) {
    if (session.phase !== 'question') fail('这道题已作答，请先进入下一题');
    const q = session.questions[session.index];
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.choices.length) fail('选项超出范围');
    const result = { questionId: q.id, selectedIndex: choice, correct: choice === q.answerIndex };
    session.answers.push(result); session.phase = 'feedback'; return result;
  }
  function next(session) {
    if (session.phase !== 'feedback') fail('请先作答');
    if (session.index + 1 >= session.questions.length) session.phase = 'done';
    else { session.index++; session.phase = 'question'; }
    return session.phase;
  }
  function updateWrongIds(previous, answers) {
    const wrong = new Set(previous || []);
    for (const a of answers) { if (a.correct) wrong.delete(a.questionId); else wrong.add(a.questionId); }
    return Array.from(wrong);
  }
  function remaining(deadline, now) { return Math.max(0, Math.ceil((deadline - now) / 1000)); }
  function fingerprint(bank) {
    // Content bucket only; not a cryptographic identity or security boundary.
    let hash = 2166136261;
    for (const c of JSON.stringify(bank)) { hash ^= c.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return bank.id + '-' + (hash >>> 0).toString(16);
  }
  return Object.freeze({ MAX_BYTES, parseBank, validateBank, selectQuestions, createSession, answer, next, updateWrongIds, remaining, fingerprint });
}));
