# Scoring & Communication Evaluation Framework

All scoring runs **server-side**. The candidate's browser never receives correct answers, answer keys or scores. The only exception is when an Admin enables showing results to candidates, and even then only after the result is finalised.

## 1. Aptitude (auto-scored)

- 20 questions per set, 1 mark each (marks are configurable per question), so the aptitude section is worth 20 marks.
- Each set's difficulty split is Easy 6 / Medium 10 / Hard 4.
- Category mix per set: Quantitative Aptitude 8, Logical Reasoning 6, Numerical Reasoning 3, Data Interpretation 3.
- Question order and option order are shuffled per attempt on the server and stored in `exam_questions`. The candidate's choice is converted back to the original option letter before it is stored, so answer mapping cannot drift.
- Unanswered questions are recorded as *Unanswered* and score 0. There is no negative marking.
- **Aptitude % = aptitude score ÷ aptitude maximum × 100.**
- A category-wise breakdown (correct / total / %) is stored with each result.

## 2. Communication (written paragraphs)

- 10 open questions per set, 10 marks each, so the communication section is worth 100 marks. The recommended answer length is 100–200 words.
- Each answer is scored on five criteria, **each out of 20**, giving 100 in total:

| Criterion | What is assessed |
|---|---|
| Grammar (20%) | Grammar, sentence structure, verb usage, articles, prepositions, basic correctness |
| Vocabulary (20%) | Word choice, range, professional terminology, appropriate language |
| Clarity (20%) | Clear, logical, unambiguous explanation that is easy to follow |
| Structure (20%) | Introduction, main points, supporting detail, conclusion, paragraph organisation |
| Professional Communication (20%) | Tone, relevance to the question, confidence, workplace appropriateness |

- **Question score = rubric total ÷ 100 × question marks.** For example, a rubric total of 82 gives 8.2 out of 10.
- **Communication score** is the sum of the 10 question scores (out of 100). **Communication % = communication score ÷ 100 × 100.**
- The result report shows the average of each criterion across the 10 answers, with each criterion out of 20.

### Evaluation sources (always labelled)

| Source | Label shown | When used |
|---|---|---|
| `ai` | **AI Evaluation** (provider/model) | AI is enabled and the provider is Claude or OpenAI |
| `rule` | **Automated rule-based** | AI is off or the provider is `rule`; the AI call failed with fallback enabled; the answer was blank (scored 0 without calling the AI) |
| `manual` | **Manual (evaluator)** | An evaluator saved scores on the Evaluate page |

Every evaluation is stored in `communication_evaluations`. A newer evaluation marks older ones as not current, and nothing is deleted. AI output **never** changes the candidate's answer. Re-running AI evaluation never overwrites a manual score. Each manual change is written to the audit log with the before and after scores and the evaluator's comment.

### AI contract

The server sends the rubric as a system prompt and the question plus the delimited answer as the user message. Instructions inside the answer are explicitly ignored. The model must return:

```json
{"grammar":16,"vocabulary":15,"clarity":18,"structure":16,"professional_communication":17,"total":82,
 "feedback":"…","strengths":["…"],"improvements":["…"]}
```

The server extracts the JSON, clamps every criterion to 0–20 in 0.5 steps, and **recalculates the total itself** rather than trusting the model's arithmetic. Anthropic calls use `temperature 0`. OpenAI calls use `temperature 0` with `response_format: json_object`. A failed call is retried once and then falls back to the rule engine; the failure is audit-logged as `AI_EVALUATION_FAILED`.

### Rule-based engine (offline fallback)

`server/services/evaluation/rule.js` is deterministic and scores each criterion from observable features:

- **Grammar:** capitalisation, a lowercase "i", repeated words, spacing around punctuation, a/an misuse, simple subject–verb errors, "could of", run-on sentences, missing final punctuation, and sentence variety.
- **Vocabulary:** lexical diversity, professional terms, average word length, and a penalty for informal words.
- **Clarity:** sentence-length range, relevance (overlap with the question's key terms), and informality.
- **Structure:** sentence count, linking words, a conclusion, and paragraphs.
- **Professional:** first-person ownership, concrete examples, professional terms, relevance, and informality or exclamation marks.

Answers below the recommended length are scaled down in proportion. It is a **screening heuristic**: use AI evaluation with evaluator review for hiring decisions.

## 3. Programming (optional section, exam type APT-COMM-PRG)

- 10 written tasks in the candidate's language (Java, Python, JavaScript, C#, SQL or Salesforce Apex), 10 marks each, for a section total of 100.
- Task types: *write code*, *fix the bug*, *predict the output and explain*, *complete the code*.
- Each language has 5 balanced sets, each with 3 Easy, 5 Medium and 2 Hard tasks. Retakes and rescheduled attempts get a different set.
- **Rubric per answer (100):**

| Criterion | Max | Assesses |
|---|---|---|
| Correctness | 40 | Right result for the task and test cases (for explain-output: the exact predicted output) |
| Logic | 20 | Sound algorithm, control flow, data structures (or the quality of the explanation) |
| Code quality | 15 | Readability, naming, structure, idiomatic use of the language |
| Efficiency | 10 | Reasonable time and space for the task |
| Edge cases | 15 | Empty, null and boundary inputs; error handling |

- **Question score = rubric total ÷ 100 × marks.** **Programming % = sum of question scores ÷ 100 × 100.**
- **Verdict per answer:** correct, partially correct, incorrect or not attempted.
- **How the AI evaluates:**
  - The AI receives the task, the given code, the reference solution, the evaluation points and the test cases. The candidate never sees any of these except the task and the given code.
  - It is told to accept any correct alternative in the same language, to ignore trivial typos a compiler would catch (answers are typed without a compiler), and to cap correctness at 10 if the answer is in a different language.
  - It also ignores instructions written inside the answer.
  - The server clamps every criterion to its maximum and recalculates the total.
- **Code is never executed** on the server.
- **Blank answers** score 0 automatically.
- **No AI configured, or an AI call fails:** the answer shows *Needs review*, and the result stays *Pending Evaluation* until an evaluator scores it. Heuristic scoring of code would be unreliable, so there is none.

## 4. Overall result

Both sections are normalised to 100 so that the 100-mark communication section does not dominate the 20-mark aptitude section.

```
Without programming:  Final % = (Apt % × Wa + Comm % × Wc) ÷ (Wa + Wc)                          default Wa = Wc = 50
With programming:     Final % = (Apt % × Wa + Comm % × Wc + Prog % × Wp) ÷ (Wa + Wc + Wp)      default 40 / 30 / 30
PASS  ⇔  every section % ≥ its minimum (default 60 each)  AND  Final % ≥ Overall-min (default 60)
```

Example from the specification: aptitude 70% and communication 75% give an overall score of 72.5%, so the result is **PASS**. If aptitude were 55% and communication 95%, the result would be **FAIL**, because every minimum is mandatory.

- The result is recalculated automatically after submission, after each evaluation and after each manual adjustment. The weights, thresholds and fail reasons in force at that moment are saved in `scoring_snapshot`, so later settings changes never silently rewrite history.
- While any answer is still unevaluated, the status is *Pending Evaluation*.
- With **Require evaluator finalisation** on (the default), the result shows as *provisional PASS/FAIL* until an evaluator selects **Finalise**. Finalised results are frozen. Only an Admin can reopen one, and must give an audit-logged reason. With the setting off, results finalise automatically once all answers are evaluated.

## 5. Timer rules

- The server holds the deadline (`exams.deadline_at`). The client countdown is only a display.
- **Combined mode:** one timer (default 60 min) and free navigation between sections.
- With programming, the combined timer adds `timer.programming_minutes` (default 45, so 105 minutes in total).
- **Sectional mode:** aptitude has its own timer (default 30 min), then communication (default 30 min), then programming (default 45 min). Aptitude answers lock once the candidate moves on or its time ends.
- When time expires, the browser submits automatically. If the browser is closed, the server's sweeper submits the attempt within about 15 seconds of expiry, or the next candidate request triggers it. In both cases `submission_type = auto_timer`. All saved answers are kept and unanswered questions score 0.
- A configurable grace period (default 20 s) accepts the final autosave that is still in transit when the timer reaches zero.
