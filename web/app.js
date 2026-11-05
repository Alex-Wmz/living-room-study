/* Copyright 2026 Alex-Wmz. See LICENSE and NOTICE. */
(function () {
  'use strict';
  const C = window.StudyCore;
  let bank = C.validateBank(window.DEMO_BANK);
  let courseId = bank.courses[0].id, session = null, page = 'home';
  let mode = 'practice', size = 3, seconds = 20, deadline = 0, timer = null;
  let wrongIds = [], remember = false, lastAnswers = [], workshopText = '';
  const app = document.getElementById('app'), notice = document.getElementById('notice');
  let noticeTimer;
  const progressKey = () => 'livingroom-study.progress.v1.' + C.fingerprint(bank);
  function element(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'className') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value !== false && value !== undefined) node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children || []) {
      if (child === null || child === undefined) continue;
      node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }
  const text = (tag, value, className) => element(tag, { text: value, className });
  const button = (title, action, className, extra) => element('button', { type: 'button', className: className || 'secondary', onClick: action, ...extra }, [title]);
  function notify(message) {
    clearTimeout(noticeTimer); notice.textContent = message; notice.classList.add('show');
    noticeTimer = setTimeout(() => notice.classList.remove('show'), 4200);
  }
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }
  function focusFirst() {
    const target = app.querySelector('[data-initial-focus]') || app.querySelector('button:not(:disabled),select,textarea,input,a[href]');
    if (target) target.focus({ preventScroll: true });
  }
  function render() {
    document.getElementById('nav-study').classList.toggle('current', page !== 'bank');
    document.getElementById('nav-bank').classList.toggle('current', page === 'bank');
    app.replaceChildren(page === 'bank' ? workshop() : page === 'watch' ? watch() : page === 'quiz' ? quiz() : page === 'result' ? result() : home());
    focusFirst();
  }
  function goHome() { stopTimer(); session = null; page = 'home'; render(); }
  function options(values, selected, change) {
    const select = element('select', { onChange: e => change(e.target.value) });
    for (const [value, title] of values) {
      const o = element('option', { value }, [title]); o.selected = String(value) === String(selected); select.append(o);
    }
    return select;
  }
  function field(title, control) {
    if (!control.hasAttribute('aria-label')) control.setAttribute('aria-label', title);
    return element('label', { className: 'field' }, [text('span', title), control]);
  }
  function beginQuiz() {
    stopTimer();
    session = C.createSession(C.selectQuestions(bank, courseId, size, wrongIds));
    page = 'quiz'; render();
  }
  function beginWatch() {
    stopTimer(); page = 'watch'; deadline = performance.now() + seconds * 1000; render();
    timer = setInterval(() => {
      const left = C.remaining(deadline, performance.now());
      const label = document.getElementById('remaining');
      if (label) label.textContent = String(left).padStart(2, '0');
      if (left === 0) beginQuiz();
    }, 200);
  }
  function persist() {
    if (!remember) return;
    try { localStorage.setItem(progressKey(), JSON.stringify({ wrongIds })); }
    catch (_) { remember = false; notify('浏览器不允许保存，本轮仍可继续；记录暂留当前页面。'); }
  }
  function toggleRemember(enabled) {
    remember = enabled;
    try {
      if (enabled) {
        const raw = localStorage.getItem(progressKey());
        if (raw && raw.length <= 50000) {
          const data = JSON.parse(raw), ids = new Set(bank.questions.map(q => q.id));
          if (Array.isArray(data.wrongIds)) wrongIds = Array.from(new Set(wrongIds.concat(data.wrongIds.filter(x => typeof x === 'string' && ids.has(x))))).slice(0, 500);
        }
        persist();
      } else localStorage.removeItem(progressKey());
      notify(enabled ? '仅在这个浏览器记住这份题库的待复习题目。' : '已关闭记忆，并清除这份题库在浏览器保存的记录。');
    } catch (_) { remember = false; notify('无法读取本地保存；本轮可以照常使用。'); }
  }
  function home() {
    const wrap = element('div');
    const intro = element('section', { className: 'intro' }, [element('div', {}, [text('p', 'A LITTLE LEARNING, AT HOME', 'eyebrow'), text('h1', '从一道题开始。'), text('p', '选一组题，用方向键和确认键练习。题库、题数和练习节奏，都可以自己安排。', 'lede')]), text('div', bank.questions.length + ' 道题 · 本地读取', 'bank-tag')]);
    const courses = element('section', { className: 'course-section', 'aria-label': '课程选择' }, [element('div', { className: 'section-head' }, [text('h2', '今天，学一点什么？'), text('span', bank.courses.length + ' 组课程', 'quiet')])]);
    const list = element('div', { className: 'course-list' });
    for (const [i, course] of bank.courses.entries()) {
      const count = bank.questions.filter(q => q.courseId === course.id).length;
      const item = button('', () => { courseId = course.id; render(); }, 'course' + (courseId === course.id ? ' selected' : ''), { 'aria-pressed': courseId === course.id ? 'true' : 'false', 'aria-label': course.title + '，' + count + ' 题' });
      item.append(text('span', ['数', '文', 'Aa'][i % 3], 'course-icon'), element('span', {}, [text('strong', course.title), text('small', course.subject + ' · ' + course.stage + ' · ' + count + ' 题'), text('small', course.unit)]), text('span', courseId === course.id ? '✓' : '↗', 'check')); list.append(item);
    }
    courses.append(list, element('p', { className: 'privacy' }, [element('span', { className: 'dot' }), '内置题为原创演示，未与具体教材或教学大纲对齐。自己的课程可在「题库工坊」导入。']));
    const selected = bank.courses.find(c => c.id === courseId);
    const card = element('aside', { className: 'session-card' }, [text('p', 'YOUR NEXT SESSION', 'eyebrow'), text('h2', '安排这一小会'), text('p', selected.title, 'hint'), field('练习方式', options([['practice', '直接练习'], ['break', '观看 → 练习（流程演示）']], mode, value => { mode = value; render(); })), element('div', { className: 'two' }, [field('每轮题数', options([[3, '3 道题'], [5, '5 道题'], [500, '本课全部']], size, value => { size = Number(value); })), field('演示倒计时', options([[20, '20 秒'], [45, '45 秒'], [90, '90 秒']], seconds, value => { seconds = Number(value); }))]), button(mode === 'practice' ? '开始这一轮  →' : '演示观看到练习  →', () => mode === 'practice' ? beginQuiz() : beginWatch(), 'primary full', { 'data-initial-focus': true }), text('p', '仅当前页面模拟观看计时，不会暂停视频、覆盖其他应用或锁定电视。随时可返回。', 'hint'), element('div', { className: 'rule' }, [text('p', '答后有解析，待复习题优先。答错也可以继续，不追加惩罚题。', 'hint')])]);
    const checkbox = element('input', { type: 'checkbox', onChange: e => toggleRemember(e.target.checked) }); checkbox.checked = remember;
    card.append(element('label', { className: 'tick-label' }, [checkbox, text('span', '记住这份题库的待复习题（仅此浏览器，默认关闭）')]));
    wrap.append(intro, element('div', { className: 'dashboard' }, [courses, card])); return wrap;
  }
  function watch() {
    const course = bank.courses.find(c => c.id === courseId);
    return element('section', {}, [text('p', 'SCREEN BREAK · FLOW PREVIEW', 'eyebrow'), text('h2', '把观看与练习，接成一个流程。'), element('div', { className: 'watch' }, [element('div', {}, [text('h1', '模拟观看中'), text('p', '倒计时结束后，自动切换到「' + course.title + '」的答题环节。这里只演示流程，不控制外部视频或电视系统。'), element('div', { className: 'actions' }, [button('立即进入练习', beginQuiz, 'primary'), button('结束演示', goHome, 'soft')])]), element('div', { className: 'countdown', 'aria-live': 'off' }, [element('span', { id: 'remaining', text: String(seconds).padStart(2, '0') }), text('small', '秒后进入练习')])]), text('p', '电视实机阶段还需单独验证安装、权限、后台存活、遥控器和恢复退出。', 'hint')]);
  }
  function quiz() {
    const q = session.questions[session.index], feedback = session.phase === 'feedback';
    const course = bank.courses.find(c => c.id === q.courseId);
    const choices = element('div', { className: 'answers', role: 'group', 'aria-label': '答案选项' });
    for (const [i, value] of q.choices.entries()) {
      const a = session.answers[session.index];
      const cls = feedback && i === q.answerIndex ? ' correct' : feedback && a.selectedIndex === i ? ' wrong' : '';
      const choice = button('', () => { C.answer(session, i); render(); }, 'answer' + cls, { disabled: feedback, 'data-initial-focus': !feedback && i === 0 });
      choice.append(text('span', 'ABCD'[i], 'letter'), text('span', value)); choices.append(choice);
    }
    const card = element('div', { className: 'quiz-card' }, [element('div', { className: 'meta-row' }, [text('span', course.subject, 'pill'), text('span', course.unit, 'pill')]), text('h1', q.prompt, 'question'), choices]);
    if (feedback) {
      const a = session.answers[session.index];
      card.append(element('section', { className: 'feedback' + (a.correct ? ' good' : ''), role: 'status' }, [text('h3', a.correct ? '答对了，看看为什么。' : '这题先记下来，一起看解析。'), text('p', '正确答案：' + 'ABCD'[q.answerIndex] + ' · ' + q.choices[q.answerIndex]), text('p', q.explanation)]));
    }
    const actions = [button('结束本轮', goHome, 'soft')];
    if (feedback) actions.push(button(session.index + 1 < session.questions.length ? '下一题  →' : '查看本轮记录  →', () => {
      C.next(session);
      if (session.phase === 'done') {
        lastAnswers = session.answers.slice(); wrongIds = C.updateWrongIds(wrongIds, lastAnswers); persist(); page = 'result';
      }
      render();
    }, 'primary', { 'data-initial-focus': true }));
    const fill = element('div', { className: 'progress-fill' }); fill.style.width = ((session.index + (feedback ? 1 : 0)) / session.questions.length * 100) + '%';
    return element('section', { className: 'quiz-wrap' }, [element('div', { className: 'quiz-header' }, [text('h2', course.title), text('span', '第 ' + (session.index + 1) + ' / ' + session.questions.length + ' 题', 'quiet')]), element('div', { className: 'progress', role: 'progressbar', 'aria-valuenow': session.index + (feedback ? 1 : 0), 'aria-valuemin': 0, 'aria-valuemax': session.questions.length }, [fill]), card, element('div', { className: 'quiz-actions' }, actions)]);
  }
  function download(name, content, type) {
    const blob = new Blob([content], { type: type || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = element('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function result() {
    const good = lastAnswers.filter(a => a.correct).length;
    const recap = element('div', { className: 'recap' });
    for (const a of lastAnswers) {
      const q = bank.questions.find(q => q.id === a.questionId);
      recap.append(element('div', { className: 'recap-item' + (a.correct ? '' : ' missed') }, [text('b', a.correct ? '✓' : '复习'), text('span', q.prompt)]));
    }
    const score = text('div', String(good), 'score'); score.append(text('small', ' / ' + lastAnswers.length));
    return element('section', { className: 'result' }, [text('p', 'ONE SMALL SESSION, COMPLETED', 'eyebrow'), text('h1', '这一轮，完成了。'), score, text('p', good === lastAnswers.length ? '都答对了。可以继续，也可以休息一会。' : '有 ' + (lastAnswers.length - good) + ' 道题值得再看一遍。下轮会优先安排这些题。', 'lede'), recap, element('div', { className: 'actions' }, [button('再练一轮', beginQuiz, 'primary', { 'data-initial-focus': true }), button('回到学习台', goHome, 'secondary'), button('导出本轮记录', () => download('study-session.json', JSON.stringify({ schemaVersion: 1, bankId: bank.id, answers: lastAnswers }, null, 2)), 'soft')]), text('p', remember ? '待复习题已按你的选择保存在此浏览器。导出的记录也请留在自己的设备。' : '记录仅在当前页面；刷新后清除。导出的记录请留在自己的设备。', 'privacy')]);
  }
  function workshop() {
    if (!workshopText) workshopText = JSON.stringify(bank, null, 2);
    const editor = element('textarea', { id: 'bank-editor', spellcheck: 'false', 'aria-label': '题库 JSON', onInput: e => { workshopText = e.target.value; } }); editor.value = workshopText;
    const report = element('div', { role: 'status', id: 'bank-report', 'aria-live': 'polite' });
    function validate(apply) {
      try {
        const candidate = C.parseBank(editor.value);
        report.className = 'saved'; report.textContent = '检查通过：' + candidate.courses.length + ' 组课程，' + candidate.questions.length + ' 道题。';
        if (apply) { bank = candidate; courseId = bank.courses[0].id; wrongIds = []; lastAnswers = []; remember = false; session = null; notify('已在当前页面切换题库。练习记录独立，原保存记录仍可用原题库读取。'); goHome(); }
        return candidate;
      } catch (error) { report.className = 'error'; report.textContent = error.message; return null; }
    }
    const fileInput = element('input', { type: 'file', accept: '.json,application/json', className: 'file-input', 'aria-label': '选择自己的题库 JSON', onChange: async e => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > C.MAX_BYTES) { report.className = 'error'; report.textContent = '文件过大：题库上限为 1 MiB。'; return; }
      try { editor.value = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); workshopText = editor.value; validate(false); }
      catch (_) { report.className = 'error'; report.textContent = '文件读取失败：请使用有效 UTF-8 编码的 JSON。'; }
    } });
    const panel = element('section', { className: 'workshop-card' }, [text('h2', '自己的课程，自己的题库'), text('p', '在电脑上编辑 JSON，检查通过后即可预览。题库只在当前页面读取，不发送到服务器。', 'hint'), field('从文件载入', fileInput), field('题库 JSON', editor), element('div', { className: 'actions' }, [button('检查题库', () => validate(false), 'secondary'), button('应用并去练习', () => validate(true), 'primary'), button('下载这份题库', () => { const b = validate(false); if (b) download('question-bank.json', JSON.stringify(b, null, 2)); }, 'soft')]), report]);
    const side = element('aside', { className: 'workshop-card' }, [text('p', 'MAKE IT YOUR OWN', 'eyebrow'), text('h2', '先把内容讲清楚'), element('ol', { className: 'numbered' }, [text('li', '按学科、学习阶段和单元划分课程。'), text('li', '每题 2–4 个选项，answerIndex 从 0 起算。'), text('li', '补上答案解析和题目来源。'), text('li', '先人工核对，再做电视适配。')]), text('p', '不要直接导入整套教材、付费题库或儿童个人资料。AI 生成题也需要审核答案、难度和歧义。', 'hint'), button('恢复内置示例到编辑器', () => { workshopText = JSON.stringify(C.validateBank(window.DEMO_BANK), null, 2); page = 'bank'; render(); }, 'secondary full'), element('div', { className: 'rule' }, [text('p', '这是网页流程演示。电视端的开机触发、覆盖层和应用计时，需按实现指南单独开发与验收。', 'hint')])]);
    return element('div', {}, [element('div', { className: 'intro' }, [element('div', {}, [text('p', 'COURSE BANK WORKSHOP', 'eyebrow'), text('h1', '内容换一份，流程不重写。'), text('p', '把课程、题目、答案与解析放在同一份可校验的文件里。', 'lede')])]), element('div', { className: 'workshop' }, [panel, side])]);
  }
  document.getElementById('brand').addEventListener('click', e => { e.preventDefault(); goHome(); });
  document.getElementById('nav-study').addEventListener('click', goHome);
  document.getElementById('nav-bank').addEventListener('click', () => { stopTimer(); page = 'bank'; render(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); goHome(); return; }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    const active = document.activeElement;
    if (active && (['SELECT', 'TEXTAREA'].includes(active.tagName) || (active.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(active.type)))) return;
    const nodes = Array.from(document.querySelectorAll('a[href],button:not(:disabled),input,select,textarea')).filter(n => n.getClientRects().length && !n.disabled);
    if (!active || !nodes.includes(active)) { if (nodes[0]) nodes[0].focus(); return; }
    const a = active.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown', sign = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
    const candidates = nodes.filter(n => n !== active).map(n => {
      const r = n.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      const along = (vertical ? dy : dx) * sign, across = Math.abs(vertical ? dx : dy);
      return { node: n, along, cost: along + across * 2.5 };
    }).filter(c => c.along > 6).sort((a, b) => a.cost - b.cost);
    e.preventDefault(); if (candidates[0]) { candidates[0].node.focus(); candidates[0].node.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  });
  render();
}());
