#!/usr/bin/env python3
"""Structural checks for a programming seed file (see seed/PROGRAMMING_SPEC.md).

Usage: python3 scripts/check-programming-seed.py seed/programming/javascript.json
"""
import difflib
import json
import re
import sys
from collections import Counter
from itertools import combinations

path = sys.argv[1] if len(sys.argv) > 1 else 'seed/programming/javascript.json'
data = json.load(open(path, encoding='utf-8'))
errors = []
key = data['language'].upper()

nums = [s['set_number'] for s in data['sets']]
if nums != [1, 2, 3, 4, 5]:
    errors.append(f'set_numbers are {nums}, expected 1..5')

all_q = []
for s in data['sets']:
    qs = s['questions']
    n = s['set_number']
    if len(qs) != 10:
        errors.append(f'set {n}: {len(qs)} questions (need 10)')
    diff = Counter(q['difficulty'] for q in qs)
    if (diff['Easy'], diff['Medium'], diff['Hard']) != (3, 5, 2):
        errors.append(f'set {n}: difficulty {dict(diff)} (need Easy 3 / Medium 5 / Hard 2)')
    tt = Counter(q['task_type'] for q in qs)
    if tt['write_code'] < 5: errors.append(f'set {n}: only {tt["write_code"]} write_code')
    if tt['fix_bug'] < 1: errors.append(f'set {n}: no fix_bug')
    if tt['explain_output'] < 1: errors.append(f'set {n}: no explain_output')
    mins = sum(q['expected_minutes'] for q in qs)
    if not 40 <= mins <= 50: errors.append(f'set {n}: total minutes {mins} not in 40-50')
    for i, q in enumerate(qs, 1):
        exp_code = f'PRG-{key}-S{n}-{i:02d}'
        if q['code'] != exp_code: errors.append(f'{q["code"]}: expected code {exp_code}')
        if q['task_type'] not in ('write_code', 'fix_bug', 'explain_output', 'complete_code'):
            errors.append(f'{q["code"]}: bad task_type')
        if q['task_type'] != 'write_code' and not q.get('starter_code'):
            errors.append(f'{q["code"]}: starter_code required')
        if not 3 <= len(q['evaluation_points']) <= 5: errors.append(f'{q["code"]}: needs 3-5 evaluation_points')
        if not 3 <= q['expected_minutes'] <= 6: errors.append(f'{q["code"]}: expected_minutes out of range')
        if q['marks'] != 10: errors.append(f'{q["code"]}: marks != 10')
        all_q.append(q)

codes = Counter(q['code'] for q in all_q)
for c, k in codes.items():
    if k > 1: errors.append(f'duplicate code {c}')

def norm(t):
    return re.sub(r'\s+', ' ', t.lower()).strip()

flagged = 0
for a, b in combinations(all_q, 2):
    r = difflib.SequenceMatcher(None, norm(a['question']), norm(b['question'])).ratio()
    if r > 0.75:
        flagged += 1
        errors.append(f'near-duplicate question text {a["code"]} ~ {b["code"]} (ratio {r:.2f})')

print(f'{len(all_q)} questions, {len(codes)} unique codes')
if errors:
    print('\n'.join(errors))
    sys.exit(1)
print('All structural checks passed')
