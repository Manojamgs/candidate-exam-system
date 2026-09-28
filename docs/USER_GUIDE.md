# User Guide

## HR / Recruiter

1. **Create a candidate:** go to Candidates → **+ New candidate** and fill in the Candidate Master fields. First name, last name and email are required. A Candidate ID is generated automatically, for example CAN-2026-00013.
2. **Assign an exam:** open the candidate and click **Assign exam**. Alternatively, use **Exam Assignment** to assign all new candidates at once.
   - **Automatic** picks the least recently used set the candidate has not taken. **Random** picks any unused set. **Manual** lets you choose a set.
   - A dialog shows the exam link and access code. The invitation email containing both is sent automatically.
   - **Email the link again (or to someone else):** click **Email link** on the exam row. The email goes to the candidate by default; you can change the address, CC colleagues, add a personal message and leave the access code out (to share it separately). **Open in my email app** creates a draft in Outlook/Mail instead.
   - **With programming:** choose the exam type *Aptitude, Communication & Programming*. Either leave the language empty so the candidate picks it from their skills, or select it yourself. The programming set is chosen automatically, or you can pick one.
   - **Schedule (optional):** set *Available from* and *Link expires*. Before the window opens, candidates see a countdown.
   - **Skills:** record them on the candidate page (**Edit skills**). Candidates can add or update their own before starting.
3. **Technical issues:** open the candidate, then **Request reschedule** on the affected exam.
   - Choose the reason and the action: resume with extra time (exam in progress), a new window (not started), or a new attempt on a different set.
   - Describe what happened and add any evidence reference. System diagnostics are attached automatically.
   - An Admin approves or rejects the request on **Reschedule Requests**.
4. **Monitor:** Exam Monitoring shows who is in progress, their time left, answers saved and tab switches. From a candidate's page you can:
   - **New link:** re-issue a lost or expired link.
   - **Reset session:** let a candidate whose browser crashed resume, optionally with extra minutes.
   - **Reset exam:** start again with a new paper.
   - **Force submit:** submit the answers saved so far.
   - **Cancel:** cancel an exam that has not started.
5. **Retakes:** after an attempt ends, click **Assign retake** and give a reason.
   - Retakes by HR need Admin approval (see Exam Assignment → *Retakes awaiting approval*).
   - A different set is chosen automatically.
   - The maximum number of attempts is set in Settings (default 2).
6. **Results and reports:**
   - **Exam Results** lists every submitted attempt. Open one for the full *Candidate Examination Result* and the PDF report.
   - **Reports & Export** downloads Excel, CSV or PDF files of candidates, results, communication evaluations, aptitude answers, the audit log or the question bank.
7. **Final hiring status:** once a result is finalised, set the candidate's status (Selected, Rejected or On Hold) from the status selector on the candidate page.

## Evaluator

1. **Open the queue:** go to **Communication Evaluation** to see exams awaiting review. Communication answers are normally scored automatically on submission; the badge shows *AI Evaluation* or *Automated rule-based*.
2. **Review each answer:** open an exam to see every written answer with its word count, the five criterion scores (out of 20), feedback, strengths and improvements.
3. **Adjust scores if needed:** change any score, add a comment and click **Save manual score**. The AI or rule evaluation stays in the history, and the change is audit-logged.
4. **Programming answers:**
   - Each answer shows the candidate's code, the given code, the reference solution and the evaluation points, plus the AI verdict, feedback and issues.
   - To adjust, set correctness (/40), logic (/20), code quality (/15), efficiency (/10), edge cases (/15) and optionally a verdict and comment.
   - Without AI, every non-blank programming answer needs your score before the result can be finalised.
5. **Re-run evaluation:** use **Evaluate pending** or **Re-run all**, optionally with a different provider. Manual scores are never overwritten.
6. **Finalise:** add overall evaluator comments and click **Finalise result**. PASS or FAIL is calculated automatically from the configured weights and minimums. The candidate record is updated, HR receives an email, and the result is frozen. Only an Admin can reopen it, and must give a reason.

## Admin

Admins have everything above, plus:

- **Branding:** Settings → Branding – upload the company logo, set the primary and accent colours, application title and subtitle. For emails and PDFs, upload a PNG (SVG logos show on screen only; emails then show the company name).
- **Settings:** passing criteria and weighting, timer, resume and randomisation rules, attempts and retakes, AI provider, Google Sheets or SharePoint, email, security and users.
- **Question Bank:** add, edit, preview, deactivate or delete questions, create new exam sets, and export the answer key.
- **Audit Log:** a searchable record of all activity.
- **Reschedule Requests:** review the description, evidence and system diagnostics, then **Approve** (you can adjust the extra minutes or the new window) or **Reject** (notes required).
  - You cannot approve a request you raised yourself unless Settings allow it.
  - Approving a new attempt voids the interrupted one (kept for audit, not counted) and emails the candidate a new link.
- **Programming Questions:** manage languages, sets and questions (reference solution and at least 2 evaluation points are required to activate), and export the bank with its reference solutions.

## Candidate

1. **Open your link:** use the personal link in your invitation email and enter the access code.
2. **Your skills:** add every skill that applies, with its level and years. If the exam has a programming section, choose the language for your programming questions (your matching skills are listed first).
3. **Read the instructions:** check your details, read the instructions, tick the agreement and click **I Agree & Start Examination**. The timer starts now.
4. **Section 1 – Aptitude:** select one answer per question.
   - Use **Previous** and **Next**, or click a number in the navigation panel. Green means answered, white unanswered, amber marked for review.
   - **Mark for Review** flags a question to return to. **Clear Answer** removes your choice.
5. **Section 2 – Communication:** write a paragraph of about 100–200 words for each question. The word counter shows your progress.
6. **Section 3 – Programming (if included):** write, fix or explain short pieces of code in the code box. Tab indents. Use **Insert starter code** when a task gives you code, because pasting is disabled. No compiler is used: focus on correct logic and readable code.
7. **Submit:** answers save automatically. Click **Review & Submit** to see which questions are unanswered, then **Submit Examination**. If the timer runs out, your saved answers are submitted automatically.
8. **Rules during the exam:**
   - Do not refresh, close the tab, use the back button or switch tabs. These actions are recorded.
   - Copy and paste are disabled.
   - Once submitted, answers cannot be changed.
