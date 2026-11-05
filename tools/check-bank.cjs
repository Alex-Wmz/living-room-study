#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const core = require('../web/core.js');
const path = process.argv[2];
if (!path) { console.error('Usage: node tools/check-bank.cjs banks/demo.json'); process.exit(2); }
try {
  if (fs.statSync(path).size > core.MAX_BYTES) throw new Error('文件超过 1 MiB');
  const bank = core.parseBank(new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(path)));
  console.log(JSON.stringify({ valid: true, courses: bank.courses.length, questions: bank.questions.length }));
} catch (error) { console.error('题库检查未通过：' + error.message); process.exitCode = 1; }
