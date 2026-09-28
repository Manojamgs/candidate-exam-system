# Question seed file spec

One JSON file per set: seed/questions/set-0N.json

{
  "set_code": "SET-0N",
  "name": "Exam Set 0N",
  "aptitude": [ 20 items ],
  "communication": [ 10 items ]
}

Aptitude item:
{
  "code": "APT-S0N-01",            // 01..20
  "category": "Quantitative Aptitude" | "Logical Reasoning" | "Numerical Reasoning" | "Data Interpretation",
  "topic": "Percentage",            // sub-topic, e.g. Profit and Loss, Number Series, Blood Relations, Table, ...
  "difficulty": "Easy" | "Medium" | "Hard",
  "question": "Full self-contained question text.",
  "table": { "headers": ["Year","Sales"], "rows": [["2022","120"],["2023","150"]] },   // OPTIONAL, only for data-interpretation style questions
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct": "A" | "B" | "C" | "D",
  "explanation": "Short worked solution showing why the answer is correct.",
  "marks": 1
}

Per set (exactly):
- 20 aptitude items: difficulty Easy 6, Medium 10, Hard 4.
- Category mix: Quantitative Aptitude 8, Logical Reasoning 6, Numerical Reasoning 3, Data Interpretation 3.
- Four distinct options; exactly one correct. Spread correct letters roughly evenly (about 5 each of A/B/C/D).
- Do NOT use "All of the above"/"None of the above"/"Both A and B" (options are shuffled at runtime).
- No ambiguity, no culturally sensitive/discriminatory content, no protected personal information.
- Numbers must be verified: double-check every calculation.

Communication item:
{
  "code": "COM-S0N-01",            // 01..10
  "category": "Self-presentation" | "Problem Solving" | "Teamwork" | "Customer Handling" | "Leadership" | "Time Management" | "Workplace Communication" | "Career Goals" | "Adaptability" | "Ethics & Professionalism",
  "question": "Open prompt requiring a 100–200 word written paragraph answer.",
  "expected_words_min": 100,
  "expected_words_max": 200,
  "marks": 10
}
- Not multiple choice. Workplace-appropriate, no protected personal info (no age, religion, family status, health, etc.).
- Every question in every set must be different in substance from all other sets.
