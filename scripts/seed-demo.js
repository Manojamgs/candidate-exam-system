'use strict';
// Populates a demo/test dataset through the real API: staff users, 12 candidates in every workflow state,
// completed attempts across all six sets, a retake, evaluations, a manual score adjustment and finalised results.
// Usage: npm run seed:demo   (uses DB_PATH from .env; safe to run on an empty database only)
process.env.DISABLE_BACKGROUND_JOBS = 'true';
process.env.LOG_EMAILS = 'false';
const http = require('http');
const { createApp } = require('../server/app');
const { getDb } = require('../server/db');
const config = require('../server/config');

class Client {
  constructor(base) { this.base = base; this.cookies = new Map(); }
  async req(method, url, body) {
    const headers = { 'x-requested-with': 'cexs' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const r = await fetch(this.base + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.cookies.set(kv.slice(0, i), kv.slice(i + 1)); }
    const t = await r.text(); const j = t ? JSON.parse(t) : null;
    if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${j?.error}`);
    return j;
  }
  get(u) { return this.req('GET', u); } post(u, b = {}) { return this.req('POST', u, b); } put(u, b = {}) { return this.req('PUT', u, b); }
}

const PEOPLE = [
  ['Aisha', 'Rahman', 'Sales Executive', 'Sales', 'LinkedIn', 3], ['Rohan', 'Mehta', 'Accountant', 'Finance', 'Referral', 5],
  ['Fatima', 'Al Mansoori', 'HR Coordinator', 'Human Resources', 'Company Website', 2], ['Daniel', 'Okafor', 'Python Developer', 'IT', 'Job Portal', 6],
  ['Priya', 'Nair', 'Customer Service Agent', 'Customer Service', 'Walk-in', 1], ['Omar', 'Haddad', 'Sales Executive', 'Sales', 'Recruitment Agency', 4],
  ['Sofia', 'Martins', 'Marketing Coordinator', 'Marketing', 'LinkedIn', 3], ['Arjun', 'Reddy', 'Salesforce Administrator', 'IT', 'Referral', 4],
  ['Layla', 'Hassan', 'Office Administrator', 'Administration', 'Job Portal', 2], ['Kenji', 'Tanaka', 'Java Developer', 'IT', 'LinkedIn', 7],
  ['Grace', 'Mensah', 'Accountant', 'Finance', 'Campus', 0], ['Vikram', 'Singh', 'Software Engineer', 'IT', 'Referral', 5],
];
const GOOD = (topic) => `In my previous role, ${topic} was an important part of my daily work. First, I make sure I clearly understand the objective and the expectations of everyone involved, so I ask questions early and confirm the key details in writing.

Next, I plan the work, agree on priorities with my manager and keep the team informed with short, regular updates. For example, when our team faced a tight deadline last year, I prepared a simple plan, shared responsibilities and checked progress every afternoon. However, when requirements changed, I stayed flexible and communicated the impact on the timeline straight away.

As a result, we delivered on time and the client gave us positive feedback. In conclusion, I believe that clear, respectful communication, good planning and ownership of my responsibilities are the most effective ways to achieve results.`;
const AVERAGE = (topic) => `I think ${topic} is very important in any company. In my last job I had to deal with this many times and I always try my best. I talk with my team and my manager when there is a problem and we find a solution together. Sometimes it is difficult because there is a lot of work and deadlines are short, but I stay calm and focus on the most important tasks first. I also learned that it is good to write down what was agreed so nobody forgets. This helped me to improve my work and to have a good relation with my colleagues and customers. I want to continue improving these skills in my next role.`;
const WEAK = (topic) => `${topic} is important. i will do my best and work hard. i am good with people and i can handle it no problem. thanks`;

const PRG_ANSWER = {
  python: 'def solve(items):\n    result = []\n    for x in items:\n        if x is not None:\n            result.append(x)\n    return result',
  apex: 'public static List<Account> solve(Set<Id> ids) {\n    return [SELECT Id, Name FROM Account WHERE Id IN :ids];\n}',
  java: 'public static int solve(int[] values) {\n    int total = 0;\n    for (int v : values) total += v;\n    return total;\n}',
};
async function answerExam(base, link, code, { quality, correctRate, submit = true, blanks = 0, prg = null }) {
  const c = new Client(base);
  await c.post('/api/candidate/login', { token: new URL(link).searchParams.get('t'), access_code: code });
  const skills = prg === 'python' ? [{ skill: 'Python', level: 'Advanced', years: 4 }, { skill: 'SQL', level: 'Intermediate', years: 3 }, { skill: 'Git', level: 'Intermediate', years: 3 }]
    : prg === 'apex' ? [{ skill: 'Salesforce Apex', level: 'Advanced', years: 4 }, { skill: 'Lightning Web Components', level: 'Intermediate', years: 2 }, { skill: 'JavaScript', level: 'Intermediate', years: 3 }]
      : prg === 'java' ? [{ skill: 'Java', level: 'Expert', years: 7 }, { skill: 'SQL', level: 'Advanced', years: 6 }]
        : [{ skill: 'Excel', level: 'Advanced', years: 3 }, { skill: 'Customer Service', level: 'Intermediate', years: 2 }];
  await c.post('/api/candidate/skills', { skills, programming_language: prg || undefined });
  await c.post('/api/candidate/start', { agree: true });
  const paper = await c.get('/api/candidate/paper');
  const db = getDb();
  const apt = paper.aptitude.map((q, i) => {
    const eq = db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(q.id);
    const key = db.prepare('SELECT correct_answer FROM aptitude_questions WHERE id = ?').get(eq.question_id).correct_answer;
    const right = ['A', 'B', 'C', 'D'][JSON.parse(eq.option_order).indexOf(key)];
    const wrong = ['A', 'B', 'C', 'D'].find((l) => l !== right);
    return { id: q.id, answer: i >= paper.aptitude.length - blanks ? null : (i / paper.aptitude.length < correctRate ? right : wrong) };
  });
  const writer = quality === 'good' ? GOOD : quality === 'average' ? AVERAGE : WEAK;
  const com = paper.communication.map((q, i) => ({ id: q.id, text: i >= paper.communication.length - blanks ? '' : writer(q.question.replace(/[?.]$/, '').toLowerCase().split(' ').slice(0, 6).join(' ')) }));
  const prgAns = (paper.programming || []).map((q, i) => ({ id: q.id, text: i >= (paper.programming.length - blanks) ? '' : (PRG_ANSWER[prg] || 'return result;') }));
  await c.post('/api/candidate/answers', { aptitude: apt, communication: com, programming: prgAns });
  if (Math.random() < 0.5) await c.post('/api/candidate/events', { type: 'tab_hidden' });
  if (submit) await c.post('/api/candidate/submit', {});
  return c;
}

(async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const db = getDb();
  if (db.prepare('SELECT COUNT(*) n FROM candidates').get().n > 0) { console.error('Database already contains candidates – demo seed skipped. Run "npm run reset -- --yes" first.'); process.exit(1); }
  const admin = new Client(base);
  await admin.post('/api/auth/login', { username: config.initialAdmin.username, password: config.initialAdmin.password });
  await admin.put('/api/settings', { 'ai.provider': 'rule', 'email.hr_notification_address': 'hr@example.com' });
  for (const u of [['hr.demo', 'hr.demo@example.com', 'Hana Recruiter', 'hr'], ['evaluator.demo', 'evaluator.demo@example.com', 'Evan Evaluator', 'evaluator']]) {
    try { await admin.post('/api/users', { username: u[0], email: u[1], full_name: u[2], role: u[3], password: 'Demo@Pass2026' }); } catch { /* exists */ }
  }
  const cands = [];
  for (const [i, p] of PEOPLE.entries()) {
    cands.push(await admin.post('/api/candidates', { first_name: p[0], last_name: p[1], email: `${p[0]}.${p[1].replace(/\s/g, '')}@example.com`.toLowerCase(),
      mobile: `+97150${String(1000000 + i * 7919).slice(0, 7)}`, position_applied: p[2], department: p[3], recruitment_source: p[4], years_of_experience: p[5],
      experience: `${p[5]} years`, highest_qualification: i % 3 ? 'Bachelor' : 'Master', recruiter_name: 'Hana Recruiter', interviewer: 'Line Manager',
      country: 'United Arab Emirates', city: i % 2 ? 'Dubai' : 'Abu Dhabi', nationality: ['Indian', 'Emirati', 'Nigerian', 'Filipino', 'Egyptian', 'Portuguese'][i % 6],
      notice_period: ['Immediate', '30 days', '60 days'][i % 3], application_date: new Date(Date.now() - (20 - i) * 864e5).toISOString().slice(0, 10) }));
  }
  const plan = [
    { quality: 'good', correctRate: 0.9, finalize: true }, { quality: 'average', correctRate: 0.75, finalize: true }, { quality: 'weak', correctRate: 0.45, finalize: true },
    { quality: 'good', correctRate: 0.7, finalize: true, adjust: true, prg: 'python' }, { quality: 'average', correctRate: 0.6 }, { quality: 'good', correctRate: 0.85, blanks: 2 },
    { quality: 'average', correctRate: 0.8, finalize: true }, { quality: 'good', correctRate: 0.95, submit: false, prg: 'apex' }, { assignOnly: true },
    { assignOnly: true, prg: 'java', hrLanguage: true }, { skip: true }, { quality: 'good', correctRate: 0.8, prg: 'java' },
  ];
  const evaluator = new Client(base);
  await evaluator.post('/api/auth/login', { username: 'evaluator.demo', password: 'Demo@Pass2026' });
  const hr = new Client(base);
  await hr.post('/api/auth/login', { username: 'hr.demo', password: 'Demo@Pass2026' });
  for (const [i, step] of plan.entries()) {
    if (step.skip) continue;
    const a = await admin.post(`/api/candidates/${cands[i].id}/assign`, step.prg ? { exam_type: 'APT-COMM-PRG', programming_language: step.hrLanguage ? step.prg : undefined } : {});
    if (step.assignOnly) continue;
    await answerExam(base, a.link, a.access_code, step);
    if (step.submit === false) {
      // simulate a connection drop and an HR reschedule request awaiting Admin approval
      await hr.post(`/api/exams/${a.exam_id}/reschedule-requests`, { reason_category: 'internet_outage', requested_option: 'resume_extra_time', extra_minutes: 15,
        description: 'Candidate called to report a broadband outage lasting about 20 minutes during the programming section.', evidence_notes: 'Screenshot of ISP status page emailed to HR' });
      continue;
    }
    for (let k = 0; k < 50; k++) { const d = await admin.get(`/api/exams/${a.exam_id}`); if (d.result?.communication_evaluated === 10) break; await new Promise((r) => setTimeout(r, 100)); }
    if (step.prg) { // demo runs without an AI key, so an evaluator scores the code answers manually
      const d = await evaluator.get(`/api/exams/${a.exam_id}`);
      for (const [n, q] of d.programming.entries()) {
        if (q.current_evaluation) continue;
        const good = n % 3 !== 2;
        await evaluator.put(`/api/evaluation/programming-answers/${q.answer_id}`, good ? { correctness: 34, logic: 17, code_quality: 12, efficiency: 8, edge_cases: 10, comments: 'Reviewed manually (demo)' }
          : { correctness: 18, logic: 10, code_quality: 9, efficiency: 6, edge_cases: 5, comments: 'Partially correct (demo)' });
      }
    }
    if (step.adjust) {
      const d = await evaluator.get(`/api/exams/${a.exam_id}`);
      await evaluator.put(`/api/evaluation/answers/${d.communication[0].answer_id}`, { grammar: 18, vocabulary: 17, clarity: 18, structure: 17, professional: 18, comments: 'Adjusted after manual review – strong, well-structured answer.' });
    }
    if (step.finalize) await evaluator.post(`/api/evaluation/exams/${a.exam_id}/finalize`, { comments: step.quality === 'weak' ? 'Communication needs significant improvement.' : 'Meets the communication standard for the role.' });
  }
  // Retake for the failed candidate (#3) – admin assigns directly with a reason; a different set is chosen automatically.
  const retake = await admin.post(`/api/candidates/${cands[2].id}/assign`, { retake_reason: 'Candidate requested a retake after connectivity issues; approved by hiring manager.' });
  await answerExam(base, retake.link, retake.access_code, { quality: 'average', correctRate: 0.7 });
  for (let k = 0; k < 50; k++) { const d = await admin.get(`/api/exams/${retake.exam_id}`); if (d.result?.communication_evaluated === 10) break; await new Promise((r) => setTimeout(r, 100)); }
  await admin.put(`/api/candidates/${cands[0].id}`, { candidate_status: 'Selected' });
  await admin.put(`/api/candidates/${cands[11].id}`, { candidate_status: 'Shortlisted' });
  const sets = db.prepare("SELECT s.code, COUNT(e.id) n FROM exam_sets s LEFT JOIN exams e ON e.exam_set_id = s.id GROUP BY s.code").all();
  console.log('Demo data created:', db.prepare('SELECT COUNT(*) n FROM candidates').get().n, 'candidates;', db.prepare('SELECT COUNT(*) n FROM exams').get().n, 'exams;', sets.map((s) => `${s.code}:${s.n}`).join(' '));
  console.log('Staff logins: admin /', '(ADMIN_PASSWORD)', '· hr.demo / Demo@Pass2026 · evaluator.demo / Demo@Pass2026');
  server.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
