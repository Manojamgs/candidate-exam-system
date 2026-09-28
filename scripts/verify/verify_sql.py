#!/usr/bin/env python3
"""Verify seed/programming/sql.json.

* Executes every question in SQLite (foreign keys ON): runs starter_code setup,
  optional extra data from the test case input, then the reference solution
  (or, for explain_output, the given query) and compares the rendered rows to
  test_cases[].expected.
* explain_output: the stated rows must also appear in reference_solution, and
  "Which numbered statements fail?" cases are checked against real failures.
* fix_bug: the buggy query must error or give a different result.
* Structure: per set 10 questions, difficulty 3/5/2, >=5 write_code,
  >=1 fix_bug, >=1 explain_output, minutes 40-50, unique codes, and no
  near-duplicate question texts (difflib ratio > 0.75).

Test case input conventions:
  "Sample data from starter_code[, plus: <SQL>][ Then check with: <SELECT>]"
"""
import difflib, itertools, json, os, re, sqlite3, sys

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "seed", "programming", "sql.json")
FAIL_Q = "Which numbered statements fail?"
MARKERS = ("\n\n-- Query to fix:\n", "\n\n-- Query:\n")


def split_sql(text):
    """Split on semicolons outside string literals and -- comments."""
    out, buf, q, i = [], [], False, 0
    while i < len(text):
        ch = text[i]
        if not q and text.startswith("--", i):
            j = text.find("\n", i)
            j = len(text) if j == -1 else j
            buf.append(text[i:j]); i = j; continue
        if ch == "'":
            q = not q
        if ch == ";" and not q:
            out.append("".join(buf)); buf = []
        else:
            buf.append(ch)
        i += 1
    out.append("".join(buf))
    res = []
    for s in out:
        body = "\n".join(l for l in s.splitlines() if not l.strip().startswith("--")).strip()
        if body:
            res.append(body)
    return res


def fmt(v):
    if v is None:
        return "NULL"
    if isinstance(v, float):
        return str(int(round(v))) if abs(v - round(v)) < 1e-9 else f"{v:.2f}"
    return str(v)


def render(cur):
    head = " | ".join(d[0] for d in cur.description)
    rows = [" | ".join(fmt(v) for v in r) for r in cur.fetchall()]
    return "\n".join([head] + rows)


def parts(item):
    s = item["starter_code"]
    for m in MARKERS:
        if m in s:
            a, b = s.split(m, 1)
            return a, b
    return s, None


def parse_input(inp):
    extra = check = None
    m = re.search(r"Then check with: (.*)$", inp, re.S)
    if m:
        check = m.group(1); inp = inp[:m.start()]
    m = re.search(r", plus: (.*)$", inp, re.S)
    if m:
        extra = m.group(1)
    return extra, check


def setup(item):
    con = sqlite3.connect(":memory:")
    con.execute("PRAGMA foreign_keys = ON")
    schema, _ = parts(item)
    failed, n = [], 0
    for st in split_sql(schema):
        dml = st.split(None, 1)[0].upper() in ("INSERT", "UPDATE", "DELETE")
        n += dml
        try:
            con.execute(st)
        except sqlite3.DatabaseError:
            if item["task_type"] != "explain_output" or not dml:
                raise
            failed.append(n)
    con.commit()
    return con, failed


def run_case(item, inp, query=None):
    con, _ = setup(item)
    extra, check = parse_input(inp)
    if extra:
        for st in split_sql(extra):
            con.execute(st)
    if query is None:
        query = parts(item)[1] if item["task_type"] == "explain_output" else item["reference_solution"]
    stmts = split_sql(query)
    cur = None
    for st in stmts:
        cur = con.execute(st)
    if check:
        cur = con.execute(check)
    return render(cur)


def main():
    d = json.load(open(PATH))
    errs = []
    assert d["language"] == "sql" and d["label"] == "SQL"
    assert [s["set_number"] for s in d["sets"]] == [1, 2, 3, 4, 5], "set numbers"
    codes, texts, executed = [], [], 0
    for s in d["sets"]:
        qs = s["questions"]
        n = s["set_number"]
        if len(qs) != 10:
            errs.append(f"set {n}: {len(qs)} questions")
        diff = [q["difficulty"] for q in qs]
        if (diff.count("Easy"), diff.count("Medium"), diff.count("Hard")) != (3, 5, 2):
            errs.append(f"set {n}: difficulty mix {diff}")
        tt = [q["task_type"] for q in qs]
        if tt.count("write_code") < 5 or tt.count("fix_bug") < 1 or tt.count("explain_output") < 1:
            errs.append(f"set {n}: task mix {tt}")
        mins = sum(q["expected_minutes"] for q in qs)
        if not 40 <= mins <= 50:
            errs.append(f"set {n}: minutes {mins}")
        for i, q in enumerate(qs, 1):
            code = q["code"]
            codes.append(code); texts.append((code, q["question"]))
            if code != f"PRG-SQL-S{n}-{i:02d}":
                errs.append(f"{code}: bad code")
            if not 3 <= len(q["evaluation_points"]) <= 5:
                errs.append(f"{code}: evaluation_points count")
            if "CREATE TABLE" not in q["starter_code"] or "INSERT INTO" not in q["starter_code"]:
                errs.append(f"{code}: starter_code lacks schema/data")
            if not q["test_cases"]:
                errs.append(f"{code}: no test cases")
            for tc in q["test_cases"]:
                try:
                    if tc["input"] == FAIL_Q:
                        _, failed = setup(q)
                        got = ", ".join(f"({x})" for x in failed)
                    else:
                        got = run_case(q, tc["input"])
                    executed += 1
                except Exception as e:
                    errs.append(f"{code}: error {e!r}"); continue
                if got != tc["expected"]:
                    errs.append(f"{code}: mismatch\n  got:\n{got}\n  expected:\n{tc['expected']}")
                if q["task_type"] == "explain_output" and tc["expected"] not in q["reference_solution"]:
                    errs.append(f"{code}: reference_solution does not state {tc['expected']!r}")
            if q["task_type"] == "fix_bug":
                tc = q["test_cases"][0]
                try:
                    bug = run_case(q, tc["input"], query=parts(q)[1])
                    if bug == tc["expected"]:
                        errs.append(f"{code}: buggy query already gives expected result")
                except sqlite3.DatabaseError:
                    pass  # buggy query errors: fine
    if len(set(codes)) != len(codes):
        errs.append("duplicate codes")
    for (c1, t1), (c2, t2) in itertools.combinations(texts, 2):
        r = difflib.SequenceMatcher(None, t1, t2).ratio()
        if r > 0.75:
            errs.append(f"near-duplicate {c1} / {c2}: {r:.2f}")
    if errs:
        print("\n".join(errs)); print(f"FAILED ({len(errs)} problems)"); sys.exit(1)
    print(f"OK: {len(codes)} questions, {executed} test cases executed and matched")


if __name__ == "__main__":
    main()
