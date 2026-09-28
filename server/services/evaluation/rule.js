'use strict';
// Deterministic, offline rule-based evaluator. Used when AI is disabled/unavailable, and clearly labelled as such.
// It is a screening heuristic, not a substitute for human judgement – evaluators can override any score.
const { wordCount, clamp, round2 } = require('../../lib/util');

const STOP = new Set('a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those i me my we our you your he she they them their his her not no do does did have has had will would can could should may might must so than then there here what which who whom when where why how all any each some such very just also into about over after before up down out more most other only own same too'.split(' '));
const PROFESSIONAL = new Set(['stakeholder', 'stakeholders', 'deadline', 'deadlines', 'prioritise', 'prioritize', 'priority', 'priorities', 'objective',
  'objectives', 'collaborate', 'collaboration', 'communicate', 'communication', 'responsibility', 'responsibilities', 'initiative', 'solution',
  'solutions', 'efficient', 'efficiency', 'effective', 'effectively', 'customer', 'client', 'clients', 'team', 'teamwork', 'manager', 'feedback',
  'improve', 'improvement', 'process', 'processes', 'project', 'projects', 'deliver', 'delivered', 'outcome', 'outcomes', 'strategy', 'goal',
  'goals', 'professional', 'professionally', 'resolve', 'resolved', 'resolution', 'analyse', 'analyze', 'analysis', 'plan', 'planning',
  'organise', 'organize', 'organised', 'organized', 'accountable', 'accountability', 'transparent', 'transparency', 'expectations', 'quality',
  'performance', 'productivity', 'escalate', 'escalated', 'coordinate', 'coordinated', 'schedule', 'budget', 'requirements', 'implement',
  'implemented', 'learned', 'learnt', 'experience', 'skills', 'leadership', 'respect', 'respectful', 'constructive', 'positive', 'support',
  'supported', 'ensure', 'ensured', 'opportunity', 'opportunities', 'contribute', 'contribution', 'develop', 'development', 'achieve', 'achieved']);
const CONNECTORS = ['first', 'firstly', 'second', 'secondly', 'finally', 'however', 'therefore', 'moreover', 'furthermore', 'additionally',
  'for example', 'for instance', 'as a result', 'in addition', 'in conclusion', 'to conclude', 'overall', 'consequently', 'because', 'although',
  'on the other hand', 'in summary', 'then', 'afterwards', 'meanwhile', 'similarly', 'specifically', 'ultimately'];
const INFORMAL = ['gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'u ', ' ur ', 'lol', 'btw', 'idk', 'dunno', 'ya ', 'yeah', 'stuff', 'things like that',
  'awesome', 'cool', 'omg', 'plz', 'pls', 'thx', '!!', '??'];
const CONCLUSION = /(in conclusion|to conclude|overall|in summary|to sum up|ultimately|finally|this (experience|approach|shows|taught))/i;

function sentences(text) { return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean); }

function evaluateRule(questionText, answerText, { minWords = 100, maxWords = 200 } = {}) {
  const text = String(answerText || '').trim();
  const wc = wordCount(text);
  if (wc === 0) {
    return { grammar: 0, vocabulary: 0, clarity: 0, structure: 0, professional_communication: 0, total: 0,
      feedback: 'No answer was submitted for this question.', strengths: [], improvements: ['Provide a complete written answer'] };
  }
  const words = (text.toLowerCase().match(/[a-z][a-z'’-]*/g) || []);
  const sents = sentences(text);
  const avgLen = wc / Math.max(1, sents.length);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;

  // Length factor: full credit within the recommended band, proportional below it.
  const lengthFactor = wc >= minWords ? (wc > maxWords * 1.5 ? 0.9 : 1) : clamp(wc / minWords, 0.15, 1);

  // ---- Grammar (20) – surface-level checks
  let gErr = 0;
  gErr += (text.match(/(^|[.!?]\s+)[a-z]/g) || []).length;                 // sentence starting lowercase
  gErr += (text.match(/\bi\b/g) || []).length;                              // lowercase pronoun i
  gErr += (text.match(/\b(\w+)\s+\1\b/gi) || []).length;                    // repeated word
  gErr += (text.match(/\s[,.;:!?]/g) || []).length;                        // space before punctuation
  gErr += (text.match(/[,.;:!?][A-Za-z]/g) || []).length;                  // missing space after punctuation
  gErr += (text.match(/\b(a)\s+[aeiou]\w+/gi) || []).filter((m) => !/\ba\s+(uni|use|user|one|euro|us)/i.test(m)).length; // a + vowel
  gErr += (text.match(/\b(an)\s+[bcdfgjklmnpqrstvwxyz]\w+/gi) || []).filter((m) => !/\ban\s+(hour|honest|honou?r)/i.test(m)).length;
  gErr += (text.match(/\b(he|she|it)\s+(have|do|are|were)\b/gi) || []).length; // subject-verb
  gErr += (text.match(/\b(we|they|you)\s+(has|does|is|was)\b|\bi\s+(has|does|is)\b/gi) || []).length;
  gErr += (text.match(/\b(could|should|would|must) of\b/gi) || []).length;
  gErr += /[.!?]["')\]]?\s*$/.test(text) ? 0 : 1;                          // missing final punctuation
  gErr += sents.filter((s) => wordCount(s) > 45).length;                    // run-on sentences
  const errRate = gErr / Math.max(1, wc / 50);                             // errors per 50 words
  // Surface checks cannot see every error, so full marks also require some sentence variety (length spread, complex punctuation).
  const lens = sents.map((x) => wordCount(x));
  const mean = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length);
  const spread = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lens.length));
  const variety = clamp(spread / 6, 0, 1) + clamp(((text.match(/[,;:]/g) || []).length / Math.max(1, sents.length)) * 0.6, 0, 1);
  const grammar = clamp(18 + variety - errRate * 3.2, 4, 20) * lengthFactor;

  // ---- Vocabulary (20) – diversity + professional terms + word length
  const content = words.filter((w) => !STOP.has(w));
  const ttr = new Set(content).size / Math.max(1, content.length);
  const profHits = new Set(words.filter((w) => PROFESSIONAL.has(w))).size;
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / Math.max(1, words.length);
  let vocabulary = 6 + clamp((ttr - 0.45) * 22, 0, 7) + clamp(profHits * 0.9, 0, 5) + clamp((avgWordLen - 3.8) * 2.5, 0, 2);
  const informalHits = INFORMAL.filter((w) => (' ' + text.toLowerCase() + ' ').includes(w)).length;
  vocabulary = clamp(vocabulary - informalHits * 1.5, 3, 20) * lengthFactor;

  // ---- Clarity (20) – sentence length sweet spot, relevance to the question
  const qWords = new Set((String(questionText).toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !STOP.has(w)));
  const overlap = [...qWords].filter((w) => words.some((x) => x.startsWith(w.slice(0, 5)))).length / Math.max(1, qWords.size);
  const lenScore = avgLen >= 10 && avgLen <= 24 ? 8 : avgLen < 10 ? clamp(8 - (10 - avgLen) * 1.2, 2, 8) : clamp(8 - (avgLen - 24) * 0.5, 2, 8);
  const clarity = clamp(5 + lenScore + clamp(overlap * 9, 0, 7) - informalHits, 3, 20) * lengthFactor;

  // ---- Structure (20) – multiple sentences, connectors, conclusion, paragraphs
  const lower = text.toLowerCase();
  const connHits = CONNECTORS.filter((c) => new RegExp(`\\b${c}\\b`).test(lower)).length;
  const structure = clamp(5 + clamp(sents.length * 0.8, 0, 6) + clamp(connHits * 1.3, 0, 5) + (CONCLUSION.test(text) ? 2.5 : 0)
    + (paragraphs > 1 ? 1.5 : 0), 3, 20) * lengthFactor;

  // ---- Professional communication (20) – tone, first-person ownership, examples, no informal language
  const ownership = (lower.match(/\b(i (would|will|have|ensured|led|managed|handled|learned|took|made|worked|believe))\b/g) || []).length;
  const example = /\b(for example|for instance|once|in my (previous|last|current) (role|job|position)|when i|at my)\b/i.test(text) ? 2 : 0;
  const exclam = (text.match(/!/g) || []).length;
  const professional = clamp(8 + clamp(ownership * 1.2, 0, 4) + example + clamp(profHits * 0.6, 0, 4) + clamp(overlap * 3, 0, 2)
    - informalHits * 2 - Math.max(0, exclam - 1), 3, 20) * lengthFactor;

  const r = (n) => Math.round(n * 2) / 2;
  const out = { grammar: r(grammar), vocabulary: r(vocabulary), clarity: r(clarity), structure: r(structure), professional_communication: r(professional) };
  out.total = round2(out.grammar + out.vocabulary + out.clarity + out.structure + out.professional_communication);

  const strengths = []; const improvements = [];
  if (out.grammar >= 16) strengths.push('Generally accurate grammar and punctuation'); else improvements.push('Improve grammar and punctuation accuracy');
  if (out.vocabulary >= 15) strengths.push('Good range of professional vocabulary'); else improvements.push('Use a wider and more professional vocabulary');
  if (out.clarity >= 15) strengths.push('Ideas are expressed clearly and stay on topic'); else improvements.push('Answer the question more directly and clearly');
  if (out.structure >= 15) strengths.push('Logical structure with linking words'); else improvements.push('Organise the answer with an introduction, supporting points and a conclusion');
  if (out.professional_communication >= 15) strengths.push('Professional, workplace-appropriate tone'); else improvements.push('Use specific workplace examples and a confident professional tone');
  if (wc < minWords) improvements.unshift(`Answer is shorter than the recommended ${minWords} words (${wc} words)`);
  if (wc > maxWords * 1.5) improvements.push(`Answer is considerably longer than the recommended ${maxWords} words`);
  if (informalHits) improvements.push('Avoid informal expressions');
  const band = out.total >= 80 ? 'strong' : out.total >= 60 ? 'competent' : out.total >= 40 ? 'basic' : 'limited';
  out.feedback = `Automated rule-based assessment: the response shows ${band} written communication (${wc} words, ${sents.length} sentences).`
    + (strengths.length ? ` Strengths: ${strengths.slice(0, 2).join('; ').toLowerCase()}.` : '')
    + (improvements.length ? ` Focus areas: ${improvements.slice(0, 2).join('; ').toLowerCase()}.` : '');
  out.strengths = strengths.slice(0, 4);
  out.improvements = improvements.slice(0, 4);
  return out;
}
module.exports = { evaluateRule };
