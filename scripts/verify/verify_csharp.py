import json, subprocess, os, sys, tempfile

H = json.load(open(sys.argv[1]))
USINGS = "using System;\nusing System.Collections.Generic;\nusing System.Linq;\nusing System.Text;\n\n"
work = tempfile.mkdtemp(dir=os.path.dirname(os.path.abspath(__file__)))

def run(src, name):
    cs = os.path.join(work, name + ".cs"); exe = os.path.join(work, name + ".exe")
    open(cs, "w").write(src)
    c = subprocess.run(["mcs", "-nowarn:0649,0169,0414", "-out:" + exe, cs], capture_output=True, text=True)
    if c.returncode != 0:
        return None, c.stdout + c.stderr
    r = subprocess.run(["mono", exe], capture_output=True, text=True, timeout=30)
    return r.stdout, r.stderr

def build(item, body):
    main = "\n        ".join(item["_main"])
    mainsrc = "    static void Main()\n    {\n        " + main + "\n    }\n"
    sup = item["_support"] + "\n\n" if item["_support"] else ""
    if item["_wrap"]:
        return USINGS + sup + "static class H\n{\n" + body + "\n\n" + mainsrc + "}\n"
    return USINGS + sup + body + "\n\nstatic class H\n{\n" + mainsrc + "}\n"

fails = 0
for item in H:
    code = item["code"]
    if item["task_type"] == "explain_output":
        out, err = run(item["starter_code"], code)
        got = [l.rstrip() for l in (out or "").rstrip("\n").split("\n")]
        exp = [l.rstrip() for l in item["_out"].split("\n")]
        ok = out is not None and got == exp and item["_out"] in item["reference_solution"]
        print(("PASS" if ok else "FAIL"), code, "explain_output")
        if not ok: fails += 1; print(err, got, exp)
        continue
    exp = item["_exp"] or [t["expected"] for t in item["test_cases"]]
    exp = [e for e in exp if e is not None]
    out, err = run(build(item, item["reference_solution"]), code)
    got = (out or "").rstrip("\n").split("\n")
    ok = out is not None and got == exp
    print(("PASS" if ok else "FAIL"), code, item["task_type"])
    if not ok: fails += 1; print(err, got, exp)
    if item["task_type"] == "fix_bug":
        bout, berr = run(build(item, item["starter_code"]), code + "_bug")
        bgot = (bout or "").rstrip("\n").split("\n")
        if bout is None: print("   buggy starter does not compile:", berr[:300]); fails += 1
        elif bgot == exp: print("   WARNING buggy starter passes all tests!"); fails += 1
        else: print("   buggy starter output differs (good):", bgot)
print("FAILURES:", fails)
