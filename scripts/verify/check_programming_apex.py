#!/usr/bin/env python3
"""Validate seed/programming/apex.json against PROGRAMMING_SPEC.md rules.

Usage: python3 check_programming_apex.py [path/to/apex.json]
Exits non-zero if any check fails.
"""
import difflib
import itertools
import json
import os
import re
import sys
from collections import Counter

DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "seed", "programming", "apex.json")
TASK_TYPES = {"write_code", "fix_bug", "explain_output", "complete_code"}
NEEDS_STARTER = {"fix_bug", "explain_output", "complete_code"}
DUP_RATIO = 0.75


def main(path):
    with open(path) as f:
        data = json.load(f)
    errors = []
    err = errors.append

    if data.get("language") != "apex":
        err("language must be 'apex'")
    if data.get("label") != "Salesforce Apex":
        err("label must be 'Salesforce Apex'")
    sets = data.get("sets", [])
    if [s.get("set_number") for s in sets] != [1, 2, 3, 4, 5]:
        err("set_number must be 1..5 in order")

    all_q = []
    codes = Counter()
    for s in sets:
        n = s.get("set_number")
        qs = s.get("questions", [])
        if len(qs) != 10:
            err(f"S{n}: {len(qs)} questions (expected 10)")
        diff = Counter(q.get("difficulty") for q in qs)
        if (diff["Easy"], diff["Medium"], diff["Hard"]) != (3, 5, 2):
            err(f"S{n}: difficulty {dict(diff)} (expected Easy 3 / Medium 5 / Hard 2)")
        types = Counter(q.get("task_type") for q in qs)
        if types["write_code"] < 5:
            err(f"S{n}: only {types['write_code']} write_code")
        if types["fix_bug"] < 1:
            err(f"S{n}: no fix_bug")
        if types["explain_output"] < 1:
            err(f"S{n}: no explain_output")
        minutes = sum(q.get("expected_minutes", 0) for q in qs)
        if not 40 <= minutes <= 50:
            err(f"S{n}: total minutes {minutes} (expected 40-50)")
        for i, q in enumerate(qs, start=1):
            code = q.get("code", "")
            codes[code] += 1
            exp = f"PRG-APEX-S{n}-{i:02d}"
            if code != exp:
                err(f"{code}: expected code {exp}")
            if q.get("task_type") not in TASK_TYPES:
                err(f"{code}: bad task_type {q.get('task_type')}")
            if q.get("task_type") in NEEDS_STARTER and not q.get("starter_code", "").strip():
                err(f"{code}: starter_code required for {q.get('task_type')}")
            for field in ("topic", "question", "reference_solution"):
                if not str(q.get(field, "")).strip():
                    err(f"{code}: missing {field}")
            if not 3 <= len(q.get("evaluation_points", [])) <= 5:
                err(f"{code}: evaluation_points must have 3-5 items")
            tc = q.get("test_cases", [])
            if q.get("task_type") != "explain_output" and not 1 <= len(tc) <= 4:
                err(f"{code}: test_cases must have 1-4 items")
            if not 3 <= q.get("expected_minutes", 0) <= 6:
                err(f"{code}: expected_minutes out of 3-6")
            if q.get("marks") != 10:
                err(f"{code}: marks must be 10")
            all_q.append(q)

    for c, k in codes.items():
        if k > 1:
            err(f"duplicate code {c}")

    norm = lambda t: re.sub(r"\s+", " ", t.lower()).strip()
    for a, b in itertools.combinations(all_q, 2):
        for field in ("question", "reference_solution"):
            r = difflib.SequenceMatcher(None, norm(a[field]), norm(b[field])).ratio()
            if r > DUP_RATIO:
                err(f"near-duplicate {field}: {a['code']} vs {b['code']} (ratio {r:.2f})")

    topics = Counter(q["topic"] for q in all_q)
    sosl = sum(1 for q in all_q if "FIND " in q["reference_solution"])
    asyncs = sum(1 for q in all_q if re.search(r"@future|implements Queueable", q["reference_solution"]))
    if sosl > 1:
        err(f"SOSL questions: {sosl} (max 1)")
    if asyncs > 2:
        err(f"async questions: {asyncs} (max 2)")

    print(f"{len(all_q)} questions, {len(codes)} unique codes; SOSL={sosl}, async={asyncs}")
    print("topics:", dict(topics))
    if errors:
        print(f"FAILED ({len(errors)} problems):")
        for e in errors:
            print("  -", e)
        return 1
    print("OK: all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT))
