import json, os, subprocess, sys, tempfile, shutil, difflib
sys.path.insert(0, os.path.dirname(__file__))
from java_q import SETS

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "seed", "programming", "java.json")
HARNESS_KEYS = {"kind", "extra", "setup", "checks", "show", "output", "explanation"}
FIELD_ORDER = ["code", "topic", "task_type", "difficulty", "question", "starter_code",
               "reference_solution", "evaluation_points", "test_cases", "expected_minutes", "marks"]

def jstr(s):
    return json.dumps(s)  # valid Java string literal for our ASCII content

def run_java(src, timeout=20):
    d = tempfile.mkdtemp()
    try:
        open(os.path.join(d, "Main.java"), "w").write(src)
        c = subprocess.run(["javac", "Main.java"], cwd=d, capture_output=True, text=True)
        if c.returncode != 0:
            return False, "COMPILE ERROR:\n" + c.stderr
        try:
            r = subprocess.run(["java", "-Xss512k", "Main"], cwd=d, capture_output=True, text=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            return False, "TIMEOUT"
        return r.returncode == 0, r.stdout
    finally:
        shutil.rmtree(d)

def harness(q, code):
    top = (q.get("extra") or "") + "\n"
    inner = ""
    if q["kind"] == "toplevel":
        top += code
    else:
        inner = code
    body = [q.get("setup", "")]
    for i, (_, pre, expr, exp) in enumerate(q["checks"]):
        body.append(f"""try {{ {pre} String got = String.valueOf({expr});
  if (!got.equals({jstr(exp)})) {{ fails++; System.out.println("FAIL #{i}: got [" + got + "] expected [" + {jstr(exp)} + "]"); }}
}} catch (Throwable t) {{ fails++; System.out.println("ERROR #{i}: " + t); }}""")
    return f"""import java.util.*;
import java.util.stream.*;
import java.util.function.*;
{top}
public class Main {{
    interface ThrowingRunnable {{ void run() throws Exception; }}
    static String thrown(ThrowingRunnable r) {{
        try {{ r.run(); return "no exception"; }} catch (Exception e) {{ return e.getClass().getSimpleName(); }}
    }}
    static int fails = 0;
{inner}
    public static void main(String[] args) throws Exception {{
{chr(10).join(body)}
        System.out.println(fails == 0 ? "ALL PASS" : ("FAILURES: " + fails));
    }}
}}
"""

def build():
    data = {"language": "java", "label": "Java", "sets": []}
    problems = []
    for sn in sorted(SETS):
        qs = []
        for i, q in enumerate(SETS[sn], 1):
            code = f"PRG-JAVA-S{sn}-{i:02d}"
            item = {k: v for k, v in q.items() if k not in HARNESS_KEYS}
            item["code"] = code
            item["marks"] = 10
            item.setdefault("starter_code", "")
            if q["task_type"] == "explain_output":
                item["reference_solution"] = "Output:\n" + q["output"].rstrip("\n") + "\n\nExplanation: " + q["explanation"]
                item["test_cases"] = [{"input": "(run main)", "expected": q["output"].rstrip("\n")}]
            else:
                item["test_cases"] = [{"input": c[0], "expected": c[3]} for c in q["checks"][:q.get("show", 4)]]
            qs.append({k: item[k] for k in FIELD_ORDER})
        data["sets"].append({"set_number": sn, "questions": qs})
    return data

def verify(data):
    fails = 0
    n = 0
    for sn in sorted(SETS):
        for i, q in enumerate(SETS[sn], 1):
            code = f"PRG-JAVA-S{sn}-{i:02d}"
            item = data["sets"][sn-1]["questions"][i-1]
            n += 1
            if q["task_type"] == "explain_output":
                ok, out = run_java(item["starter_code"])
                good = ok and out == q["output"]
                if not good:
                    fails += 1
                    print(f"{code} EXPLAIN MISMATCH: got {out!r} expected {q['output']!r}")
                else:
                    print(f"{code} explain_output OK")
                continue
            ok, out = run_java(harness(q, item["reference_solution"]))
            if not (ok and "ALL PASS" in out):
                fails += 1
                print(f"{code} REFERENCE FAILED:\n{out}")
            else:
                print(f"{code} {q['task_type']} reference OK ({len(q['checks'])} checks)")
            if q["task_type"] == "fix_bug":
                ok2, out2 = run_java(harness(q, item["starter_code"]))
                if ok2 and "ALL PASS" in out2:
                    fails += 1
                    print(f"{code} BUGGY STARTER PASSES ALL TESTS (bug not exercised)")
                else:
                    print(f"{code}   buggy starter correctly fails: {out2.strip().splitlines()[0][:90]}")
    print(f"\nJava verification: {n} questions, {fails} failures")
    return fails

if __name__ == "__main__":
    data = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    sys.exit(1 if verify(data) else 0)
