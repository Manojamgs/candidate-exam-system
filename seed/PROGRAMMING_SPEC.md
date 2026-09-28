# Programming question seed spec

One JSON file per language: seed/programming/<language-key>.json   (keys: java, python, javascript, csharp, sql, apex)

{
  "language": "java",
  "label": "Java",
  "sets": [
    { "set_number": 1, "questions": [ 10 items ] },
    ... set_number 1..5
  ]
}

Question item:
{
  "code": "PRG-JAVA-S1-01",               // PRG-<LANGKEY upper>-S<set>-<nn>
  "topic": "Strings",                       // e.g. Variables & Types, Conditionals, Loops, Strings, Arrays/Lists, Maps/Dictionaries, Functions, OOP Basics, Exceptions, Recursion, Sorting/Searching, Collections, Debugging, SQL Joins, Aggregation ...
  "task_type": "write_code" | "fix_bug" | "explain_output" | "complete_code",
  "difficulty": "Easy" | "Medium" | "Hard",
  "question": "Clear, self-contained task statement. State function/method signature, inputs, expected output, constraints.",
  "starter_code": "Optional code shown to the candidate (required for fix_bug / explain_output / complete_code). Use \n for newlines.",
  "reference_solution": "A correct, idiomatic solution (or the correct explanation for explain_output).",
  "evaluation_points": ["Key point the answer must satisfy", "... 3-5 points: correctness conditions, edge cases, expected approach"],
  "test_cases": [ { "input": "...", "expected": "..." } ],   // 2-4 examples used by the AI evaluator (may be [] for explain tasks)
  "expected_minutes": 4,                    // 3-6; the 10 questions of a set should total 40-50 minutes
  "marks": 10
}

Per set (exactly 10 questions):
- Difficulty: Easy 3, Medium 5, Hard 2.
- Mix of task types: at least 5 write_code, at least 1 fix_bug, at least 1 explain_output (complete_code optional).
- Programming BASICS appropriate for a recruitment screening (junior-to-mid developer): no frameworks, no external libraries, no trick questions, no platform-specific setup.
- Every question in a language file must be different in substance from every other question in that file (across all 5 sets) — no reworded duplicates, no same task with different numbers.
- Sets must be balanced in difficulty so any set is equally fair.
- Answers are hand-written in a text box (no compiler), so tasks must be small (5-25 lines of code).
- Do not ask for protected personal information; neutral workplace/business contexts (orders, invoices, employees, products) are fine.
