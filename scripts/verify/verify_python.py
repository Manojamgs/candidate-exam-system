"""Verifies seed/programming/python.json.

1. Structure: 5 sets x 10 questions, difficulty Easy 3 / Medium 5 / Hard 2 per set,
   >=5 write_code, >=1 fix_bug, >=1 explain_output per set, codes unique and well-formed,
   expected_minutes 3-6 and set totals 40-50.
2. Near duplicates: difflib ratio > 0.75 between any two question texts is flagged.
3. Execution: every reference_solution is run against its test_cases. A test input is a
   '; '-separated sequence of statements whose last part is an expression; expected is a Python
   literal compared with ==, or 'raises <ExceptionName>'. For fix_bug the buggy starter_code must
   fail at least one test. For explain_output, starter_code is executed and its stdout must equal
   both the 'Output:' block of reference_solution and the test case expected value exactly.
"""
import contextlib
import difflib
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path

PATH = Path(__file__).resolve().parents[2] / "seed" / "programming" / "python.json"
errors = []


def err(msg):
    errors.append(msg)


def run_case(code, test):
    ns = {"__name__": "__verify__"}
    exec(code, ns)
    parts = test["input"].split("; ")
    expected = test["expected"]
    try:
        for stmt in parts[:-1]:
            exec(stmt, ns)
        result = eval(parts[-1], ns)
    except Exception as exc:  # noqa: BLE001
        if expected.startswith("raises "):
            return type(exc).__name__ == expected.split()[1], f"raised {type(exc).__name__}"
        return False, f"raised {type(exc).__name__}: {exc}"
    if expected.startswith("raises "):
        return False, f"returned {result!r}, expected exception"
    want = eval(expected, {})
    return result == want and type(result) is type(want) or (
        result == want and {type(result), type(want)} <= {int, float}), repr(result)


def capture(code):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(code, {"__name__": "__main__"})
    return buf.getvalue().rstrip("\n")


data = json.loads(PATH.read_text())
if data.get("language") != "python" or data.get("label") != "Python":
    err("language/label wrong")
sets = data["sets"]
if [s["set_number"] for s in sets] != [1, 2, 3, 4, 5]:
    err("set numbers must be 1..5")

codes = []
all_q = []
REQUIRED = {"code", "topic", "task_type", "difficulty", "question", "reference_solution",
            "evaluation_points", "test_cases", "expected_minutes", "marks"}
executed = 0
explained = 0
for s in sets:
    n = s["set_number"]
    qs = s["questions"]
    if len(qs) != 10:
        err(f"set {n}: {len(qs)} questions")
    diff = Counter(q["difficulty"] for q in qs)
    if diff != Counter({"Easy": 3, "Medium": 5, "Hard": 2}):
        err(f"set {n}: difficulty {dict(diff)}")
    types = Counter(q["task_type"] for q in qs)
    if types["write_code"] < 5 or types["fix_bug"] < 1 or types["explain_output"] < 1:
        err(f"set {n}: task types {dict(types)}")
    minutes = sum(q["expected_minutes"] for q in qs)
    if not 40 <= minutes <= 50:
        err(f"set {n}: total minutes {minutes}")
    for i, q in enumerate(qs, start=1):
        c = q.get("code")
        codes.append(c)
        all_q.append(q)
        if c != f"PRG-PYTHON-S{n}-{i:02d}":
            err(f"bad code {c} at set {n} position {i}")
        missing = REQUIRED - q.keys()
        if missing:
            err(f"{c}: missing {missing}")
        if q["task_type"] not in {"write_code", "fix_bug", "explain_output", "complete_code"}:
            err(f"{c}: bad task_type")
        if q["task_type"] in {"fix_bug", "explain_output", "complete_code"} and not q.get("starter_code"):
            err(f"{c}: starter_code required")
        if not 3 <= len(q["evaluation_points"]) <= 5:
            err(f"{c}: {len(q['evaluation_points'])} evaluation points")
        if not 3 <= q["expected_minutes"] <= 6 or q["marks"] != 10:
            err(f"{c}: minutes/marks out of range")
        if q["task_type"] != "explain_output" and not 2 <= len(q["test_cases"]) <= 4:
            if not (q["task_type"] == "fix_bug" and len(q["test_cases"]) >= 1):
                err(f"{c}: {len(q['test_cases'])} test cases")

        if q["task_type"] == "explain_output":
            actual = capture(q["starter_code"])
            m = re.search(r"^Output:\n(.*?)\n\nExplanation:", q["reference_solution"], re.S)
            stated = m.group(1) if m else None
            if stated != actual:
                err(f"{c}: stated output {stated!r} != actual {actual!r}")
            for t in q["test_cases"]:
                if t["expected"] != actual:
                    err(f"{c}: test case expected != actual output")
            explained += 1
            continue

        for t in q["test_cases"]:
            ok, got = run_case(q["reference_solution"], t)
            executed += 1
            if not ok:
                err(f"{c}: {t['input']!r} -> {got}, expected {t['expected']}")
        if q["task_type"] in {"fix_bug", "complete_code"}:
            if all(run_case(q["starter_code"], t)[0] for t in q["test_cases"]):
                err(f"{c}: starter_code passes all tests (bug/TODO not exercised)")

dupes = [c for c, k in Counter(codes).items() if k > 1]
if dupes:
    err(f"duplicate codes: {dupes}")

flags = []
for a in range(len(all_q)):
    for b in range(a + 1, len(all_q)):
        qa, qb = all_q[a], all_q[b]
        if qa["task_type"] == qb["task_type"] == "explain_output":
            ta, tb = qa["starter_code"], qb["starter_code"]
        else:
            ta, tb = qa["question"], qb["question"]
        r = difflib.SequenceMatcher(None, ta.lower(), tb.lower()).ratio()
        if r > 0.75:
            flags.append(f"near-duplicate {qa['code']} ~ {qb['code']} ratio {r:.2f}")
errors.extend(flags)

print(f"questions: {len(all_q)}, test cases executed: {executed}, explain_output checked: {explained}")
print("types:", dict(Counter(q["task_type"] for q in all_q)))
print("topics:", dict(Counter(q["topic"] for q in all_q)))
if errors:
    print("FAILURES:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("ALL CHECKS PASSED")
