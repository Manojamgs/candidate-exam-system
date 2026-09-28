# Question-bank verification scripts

Run from the project root. They execute reference solutions against the test cases stored in each seed file.

| Language | Command | Needs |
|---|---|---|
| All (structure, counts, difficulty 3/5/2, duplicates) | `python3 scripts/check-programming-seed.py seed/programming/<lang>.json` | Python 3 |
| Python | `python3 scripts/verify/verify_python.py` | Python 3 |
| JavaScript | `node scripts/verify/verify-programming-javascript.js seed/programming/javascript.json` | Node.js |
| SQL | `python3 scripts/verify/verify_sql.py` | Python 3 (sqlite3) |
| Java | `cd scripts/verify && python3 verify_java.py` (source: `java_q.py`, regenerates java.json) | JDK 17+ |
| C# | `cd scripts/verify && python3 gen_csharp.py ../../seed/programming/csharp.json harness.json && python3 verify_csharp.py harness.json` | Mono `mcs` or .NET |
| Apex | `python3 scripts/verify/check_programming_apex.py` (structure only; no compiler) | Python 3 |

Note: `verify_java.py` and `gen_csharp.py` regenerate their JSON from the generator source; if you edit `java.json` / `csharp.json` directly, update the generator too or skip regeneration.
