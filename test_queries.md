# Test Queries

Run these against the sample document `data/company_policy.txt`:


## 1. Direct questions (the answer is stated plainly in the document)

Question: How many leaves are allowed? 
Expected answer: Employees are allowed the following leaves:
Paid leave: 20 days annually (credited at 5 days per quarter)
Sick leave: 8 days per year
Public holidays: 10 days per year
Maternity leave: 26 weeks of paid leave (for female employees)
Paternity leave: 10 working days of paid leave (for male employees)
Adoption leave: 12 weeks (for adopting a child below 3 months of age)

# -------------------------------------------------------------------------------------------------------
Question: What are the working hours? 
Expected answer: The standard working hours are 9:30 AM to 6:30 PM, Monday to Friday, including a one-hour lunch break (40 hours per week). Flexible timing is permitted, provided employees are available during the core hours of 11:00 AM to 4:00 PM.

# -------------------------------------------------------------------------------------------------------
Question: How much sick leave do employees get? 
Expected answer:  Employees receive 8 days of sick leave per year.

# -------------------------------------------------------------------------------------------------------
Question: How long is maternity leave? 
Expected answer: Female employees are entitled to 26 weeks of paid maternity leave.
# -------------------------------------------------------------------------------------------------------

Question: What is the annual learning budget? 
Expected answer: The annual learning budget is Rs. 25,000 per employee.
# -------------------------------------------------------------------------------------------------------


## 2. Paraphrased questions (different words from the document)

These check that retrieval works on **meaning**, not just keyword matching.

| Question | Expected answer |
|---|---|
Question: Can I work remotely while I'm still on probation? 
Expected answer:  No, employees on probation are not eligible to work from home, except in the case of a medical emergency approved by HR.

# -------------------------------------------------------------------------------------------------------

Question: How many vacation days can I carry over to next year? 
Expected answer: Up to 10 unused paid leave days can be carried forward to the next year.

# -------------------------------------------------------------------------------------------------------

Question: How much will the company pay for my home wifi? 
Expected answer: Employees can claim internet reimbursement of up to Rs. 1,000 per month on submission of a valid bill.

# -------------------------------------------------------------------------------------------------------

Question: How long do I need to serve after resigning once confirmed? 
Expected answer: After confirmation, the notice period is 60 days.

# -------------------------------------------------------------------------------------------------------

Question: Are my parents covered under health insurance? 
Expected answer: Parents are not automatically covered, but employees can add their parents to the policy by paying an additional premium, which is deducted from their salary.

# -------------------------------------------------------------------------------------------------------


## 3. Out-of-scope questions (NOT in the document)

The system must **not** make up an answer. Expected reply for all of these:
`I couldn't find this information in the document.`

Questions: What is the CEO's salary?
Expected answer: I couldn't find this information in the document.
# -------------------------------------------------------------------------------------------------------

Questions: Does the company provide free lunch?
Expected answer: I couldn't find this information in the document.
# -------------------------------------------------------------------------------------------------------

Questions: Who won the last cricket world cup?
Expected answer: I couldn't find this information in the document.
# -------------------------------------------------------------------------------------------------------

Questions: What is the dress code?
Expected answer: I couldn't find this information in the document.
# -------------------------------------------------------------------------------------------------------


