# Programming Question Bank & Reference Solutions

Confidential – staff only. Written code questions; AI evaluation compares each answer with the reference solution and evaluation points. Candidate code is never executed.

## Salesforce Apex

### Salesforce Apex – Set 1

**1. PRG-APEX-S1-01** · Variables & Types · write_code · Easy · ~3 min

Write an Apex method `public static Decimal applyDiscount(Decimal amount, Integer percent)` that returns the invoice amount after deducting `percent` percent, rounded to 2 decimal places using half-up rounding. Rules: if `amount` is null return 0; if `percent` is null or negative treat it as 0; if `percent` is greater than 100 treat it as 100.

Reference solution:

```
public static Decimal applyDiscount(Decimal amount, Integer percent) {
    if (amount == null) {
        return 0;
    }
    Integer p = (percent == null || percent < 0) ? 0 : Math.min(percent, 100);
    Decimal discounted = amount - (amount * p / 100);
    return discounted.setScale(2, RoundingMode.HALF_UP);
}
```

Evaluation points: Returns 0 when amount is null; Clamps percent to the 0..100 range and treats null as 0; Uses Decimal arithmetic (not Integer division) for the discount; Rounds to 2 decimals with setScale(2, RoundingMode.HALF_UP) or equivalent

**2. PRG-APEX-S1-02** · Variables & Types · explain_output · Easy · ~3 min

What does the following anonymous Apex print (each System.debug line in order)? Briefly explain each result, in particular why the two 'Total' lines differ.

Given code:

```
Integer a = 7;
Integer b = 2;
Decimal d = 7;
Integer c;
System.debug(a / b);
System.debug(d / b);
System.debug(Math.mod(a, b));
System.debug(c == null);
System.debug('Total: ' + a + b);
System.debug('Total: ' + (a + b));
```

Reference solution:

```
Output:
3
3.5
1
true
Total: 72
Total: 9

Explanation:
- a / b is Integer / Integer, so the fraction is truncated: 3.
- d / b is Decimal / Integer, so the result is Decimal: 3.5.
- Math.mod(7, 2) is the remainder: 1.
- An Integer declared without a value is null (not 0), so c == null is true.
- 'Total: ' + a + b is evaluated left to right: the String is concatenated with 7, then with 2, giving 'Total: 72'.
- In 'Total: ' + (a + b) the parentheses force numeric addition first (9), then concatenation: 'Total: 9'.
```

Evaluation points: Integer division truncates to 3; Decimal division gives 3.5; Uninitialised Integer is null, not 0; Explains left-to-right String concatenation (72) vs parenthesised addition (9)

**3. PRG-APEX-S1-03** · Arrays/Lists · write_code · Easy · ~3 min

Write `public static List<Integer> getEvenQuantities(List<Integer> quantities)` that returns a new list containing only the even numbers from `quantities`, in their original order. Null elements must be skipped. If the input list itself is null, return an empty list (never null).

Reference solution:

```
public static List<Integer> getEvenQuantities(List<Integer> quantities) {
    List<Integer> result = new List<Integer>();
    if (quantities == null) {
        return result;
    }
    for (Integer n : quantities) {
        if (n != null && Math.mod(n, 2) == 0) {
            result.add(n);
        }
    }
    return result;
}
```

Evaluation points: Uses Math.mod (Apex has no % operator) to test evenness; Preserves original order; Skips null elements without throwing; Returns an empty list (not null) for null input

**4. PRG-APEX-S1-04** · Maps/Dictionaries · write_code · Medium · ~5 min

Write `public static Map<String, Integer> countByIndustry(List<Account> accounts)` that returns how many Accounts belong to each Industry value. Accounts whose Industry is null or blank must be counted under the key 'Unknown'. Do not run any SOQL; the list is already loaded.

Reference solution:

```
public static Map<String, Integer> countByIndustry(List<Account> accounts) {
    Map<String, Integer> counts = new Map<String, Integer>();
    for (Account acc : accounts) {
        String key = String.isBlank(acc.Industry) ? 'Unknown' : acc.Industry;
        if (counts.containsKey(key)) {
            counts.put(key, counts.get(key) + 1);
        } else {
            counts.put(key, 1);
        }
    }
    return counts;
}
```

Evaluation points: Initialises the Map before use; Uses containsKey/get/put correctly to increment counts; Maps null or blank Industry to 'Unknown'; No SOQL or DML inside the method

**5. PRG-APEX-S1-05** · SOQL Basics · write_code · Medium · ~5 min

Write `public static List<Contact> getContactsWithEmail(Id accountId)` that returns the Contacts of the given Account that have an Email address. Return the fields Id, FirstName, LastName and Email, sorted by LastName ascending, and at most 50 records. Use a bind variable for the Account Id.

Reference solution:

```
public static List<Contact> getContactsWithEmail(Id accountId) {
    return [
        SELECT Id, FirstName, LastName, Email
        FROM Contact
        WHERE AccountId = :accountId AND Email != null
        ORDER BY LastName ASC
        LIMIT 50
    ];
}
```

Evaluation points: Uses a bind variable (:accountId) rather than string concatenation; Filters on AccountId and Email != null; Includes ORDER BY LastName and LIMIT 50; Selects the four requested fields

**6. PRG-APEX-S1-06** · Governor Limits & Bulkification · fix_bug · Medium · ~5 min

The method below sets Description = 'No contacts' on each Account that has no Contacts (the caller performs the update). It works in a small test but fails with 'System.LimitException: Too many SOQL queries: 101' when called with 150 Accounts. Explain the problem and rewrite the method so it is bulk-safe.

Given code:

```
public static void flagAccountsWithoutContacts(List<Account> accounts) {
    for (Account acc : accounts) {
        List<Contact> cons = [SELECT Id FROM Contact WHERE AccountId = :acc.Id];
        if (cons.isEmpty()) {
            acc.Description = 'No contacts';
        }
    }
}
```

Reference solution:

```
// Problem: a SOQL query runs once per Account inside the loop. The synchronous
// limit is 100 SOQL queries per transaction, so 101+ Accounts fail.
// Fix: collect the Ids, run ONE query outside the loop, then check membership.
public static void flagAccountsWithoutContacts(List<Account> accounts) {
    Set<Id> accountIds = new Set<Id>();
    for (Account acc : accounts) {
        accountIds.add(acc.Id);
    }
    Set<Id> withContacts = new Set<Id>();
    for (Contact c : [SELECT AccountId FROM Contact WHERE AccountId IN :accountIds]) {
        withContacts.add(c.AccountId);
    }
    for (Account acc : accounts) {
        if (!withContacts.contains(acc.Id)) {
            acc.Description = 'No contacts';
        }
    }
}
```

Evaluation points: Identifies SOQL inside a loop and the 100-query limit; Collects Account Ids into a Set first; Runs a single query with IN :accountIds outside the loop; Uses a Set/Map lookup to decide which Accounts to flag

**7. PRG-APEX-S1-07** · DML & Database Methods · write_code · Medium · ~5 min

Write `public static List<String> insertContacts(List<Contact> contacts)` that inserts the Contacts with partial success allowed (valid records are saved even if some fail). Return a list of error strings in the format 'Row <index>: <error message>' for every failed record, where <index> is the position in the input list. Return an empty list if all succeed.

Reference solution:

```
public static List<String> insertContacts(List<Contact> contacts) {
    List<String> errors = new List<String>();
    List<Database.SaveResult> results = Database.insert(contacts, false);
    for (Integer i = 0; i < results.size(); i++) {
        if (!results[i].isSuccess()) {
            for (Database.Error err : results[i].getErrors()) {
                errors.add('Row ' + i + ': ' + err.getMessage());
            }
        }
    }
    return errors;
}
```

Evaluation points: Uses Database.insert(list, false) (allOrNone = false) instead of the insert statement; Iterates SaveResults by index, relying on results matching input order; Uses isSuccess() and getErrors()/getMessage(); Single DML call, not one per record

**8. PRG-APEX-S1-08** · Exceptions · explain_output · Medium · ~5 min

What does `Demo.run()` print? Then state what it would print if the line `Integer x = nums[5];` were replaced by `Integer y; Integer x = y + 1;`. Explain which catch block runs in each case and why.

Given code:

```
public class Demo {
    public static void run() {
        List<Integer> nums = new List<Integer>{10, 20};
        try {
            System.debug('A');
            Integer x = nums[5];
            System.debug('B');
        } catch (ListException e) {
            System.debug('C');
        } catch (Exception e) {
            System.debug('D');
        } finally {
            System.debug('E');
        }
        System.debug('F');
    }
}
```

Reference solution:

```
Original code prints: A, C, E, F
- nums[5] throws System.ListException (List index out of bounds: 5), so 'B' is skipped.
- The first matching catch is ListException -> 'C'. Only one catch block runs.
- finally always runs -> 'E'. The exception was handled, so execution continues -> 'F'.

With `Integer y; Integer x = y + 1;` it prints: A, D, E, F
- y is null, so y + 1 throws System.NullPointerException.
- It is not a ListException, so the generic catch (Exception e) handles it -> 'D'.
- finally -> 'E', then 'F'.
```

Evaluation points: Correct order A, C, E, F for the original code; Recognises the ListException and that 'B' is skipped; Correct order A, D, E, F for the null case (NullPointerException); Explains that catch blocks are checked in order and finally always runs

**9. PRG-APEX-S1-09** · Triggers · write_code · Hard · ~6 min

Write a trigger `OpportunityStageTrigger` on Opportunity (before update) that only acts when StageName has CHANGED in this update: (1) if the new StageName is 'Closed Won' and CloseDate is in the future, set CloseDate to today; (2) if the new StageName is 'Closed Lost' and Description is blank, set Description to 'Lost - reason pending'. The trigger must be bulk-safe and must not perform any DML or SOQL.

Reference solution:

```
trigger OpportunityStageTrigger on Opportunity (before update) {
    for (Opportunity opp : Trigger.new) {
        Opportunity oldOpp = (Opportunity) Trigger.oldMap.get(opp.Id);
        if (opp.StageName == oldOpp.StageName) {
            continue;
        }
        if (opp.StageName == 'Closed Won' && opp.CloseDate > Date.today()) {
            opp.CloseDate = Date.today();
        } else if (opp.StageName == 'Closed Lost' && String.isBlank(opp.Description)) {
            opp.Description = 'Lost - reason pending';
        }
    }
}
```

Evaluation points: Uses Trigger.oldMap to detect that StageName actually changed; Loops over all of Trigger.new (bulk-safe); Modifies fields directly on Trigger.new records without an update statement (before trigger); Handles both the Closed Won and Closed Lost rules correctly

**10. PRG-APEX-S1-10** · Async Apex · write_code · Hard · ~6 min

Write a Queueable class `CaseEscalationJob` that receives a Set<Id> of Account Ids through its constructor. When executed it must find all open Cases (IsClosed = false) for those Accounts whose Priority is 'Medium', change their Priority to 'High', and save them with a single DML statement. Also show the one line of code that enqueues the job and captures the job Id.

Reference solution:

```
public class CaseEscalationJob implements Queueable {
    private Set<Id> accountIds;

    public CaseEscalationJob(Set<Id> accountIds) {
        this.accountIds = accountIds;
    }

    public void execute(QueueableContext context) {
        List<Case> cases = [
            SELECT Id, Priority
            FROM Case
            WHERE AccountId IN :accountIds
            AND IsClosed = false
            AND Priority = 'Medium'
        ];
        for (Case c : cases) {
            c.Priority = 'High';
        }
        if (!cases.isEmpty()) {
            update cases;
        }
    }
}

// Enqueue:
Id jobId = System.enqueueJob(new CaseEscalationJob(accountIds));
```

Evaluation points: Class implements Queueable and defines public void execute(QueueableContext); Stores the Set<Id> passed in the constructor in a member variable; One SOQL with IN :accountIds, IsClosed = false and Priority = 'Medium'; one update outside the loop; Enqueues with System.enqueueJob and captures the returned Id

### Salesforce Apex – Set 2

**1. PRG-APEX-S2-01** · Strings · write_code · Easy · ~3 min

Write `public static String getInitials(String fullName)` that returns the upper-case initials of each word in a name. Words may be separated by one or more spaces and the input may have leading/trailing spaces. Return an empty string for null or blank input.

Reference solution:

```
public static String getInitials(String fullName) {
    if (String.isBlank(fullName)) {
        return '';
    }
    String initials = '';
    for (String part : fullName.trim().split('\\s+')) {
        initials += part.substring(0, 1).toUpperCase();
    }
    return initials;
}
```

Evaluation points: Handles null/blank with String.isBlank; Trims and splits on one-or-more whitespace (split('\\s+')); Takes the first character of each word and upper-cases it; Does not produce errors for multiple spaces

**2. PRG-APEX-S2-02** · Loops · fix_bug · Easy · ~3 min

The method below should return the total Amount of the given Opportunities, ignoring Opportunities with no Amount, and return 0 for an empty list. It currently throws exceptions. Find all three bugs and write the corrected method.

Given code:

```
public static Decimal sumAmounts(List<Opportunity> opps) {
    Decimal total;
    for (Integer i = 0; i <= opps.size(); i++) {
        total += opps[i].Amount;
    }
    return total;
}
```

Reference solution:

```
// Bug 1: total is never initialised, so it is null and 'total +=' throws NullPointerException.
// Bug 2: i <= opps.size() reads one element past the end -> ListException (index out of bounds).
// Bug 3: a null Amount added to the total throws NullPointerException.
public static Decimal sumAmounts(List<Opportunity> opps) {
    Decimal total = 0;
    for (Integer i = 0; i < opps.size(); i++) {
        if (opps[i].Amount != null) {
            total += opps[i].Amount;
        }
    }
    return total;
}
```

Evaluation points: Initialises total to 0; Changes the loop condition to i < opps.size(); Skips Opportunities whose Amount is null; Returns 0 for an empty list

**3. PRG-APEX-S2-03** · Collections · explain_output · Easy · ~3 min

What does this anonymous Apex print? Explain each value.

Given code:

```
Set<String> regions = new Set<String>{'North', 'South'};
regions.add('North');
regions.add('north');
System.debug(regions.size());

List<String> items = new List<String>{'A', 'B'};
items.add('A');
System.debug(items.size());

Map<String, Integer> stock = new Map<String, Integer>();
stock.put('Pen', 10);
stock.put('Pen', 25);
System.debug(stock.get('Pen'));
System.debug(stock.get('Pencil'));
System.debug(stock.size());
```

Reference solution:

```
Output:
3
3
25
null
1

- A Set ignores duplicates, so adding 'North' again changes nothing, but Set<String> is case-sensitive, so 'north' is a new element: size 3.
- A List allows duplicates: 'A', 'B', 'A' -> size 3.
- put() with an existing key overwrites the value: 'Pen' -> 25.
- get() on a missing key returns null (no exception).
- Only one key ('Pen') exists: size 1.
```

Evaluation points: Set ignores the duplicate but treats 'north' as different (case-sensitive): 3; List keeps duplicates: 3; Map.put overwrites existing key: 25; Map.get for a missing key returns null; size is 1

**4. PRG-APEX-S2-04** · SOQL Relationships · write_code · Medium · ~5 min

Write `public static List<String> getContactLabels(String industry)` that queries all Contacts whose parent Account has the given Industry (child-to-parent relationship query, one SOQL) and returns labels in the form 'LastName (Account Name)', ordered by Contact LastName.

Reference solution:

```
public static List<String> getContactLabels(String industry) {
    List<String> labels = new List<String>();
    for (Contact c : [
        SELECT LastName, Account.Name
        FROM Contact
        WHERE Account.Industry = :industry
        ORDER BY LastName
    ]) {
        labels.add(c.LastName + ' (' + c.Account.Name + ')');
    }
    return labels;
}
```

Evaluation points: Uses dot notation Account.Name / Account.Industry (child-to-parent); Filters on the parent field with a bind variable; Exactly one SOQL query, ordered by LastName; Builds the label from c.Account.Name

**5. PRG-APEX-S2-05** · Classes & Methods · write_code · Medium · ~5 min

Write a class `InvoiceLine` with private fields `quantity` (Integer) and `unitPrice` (Decimal). The constructor `InvoiceLine(Integer quantity, Decimal unitPrice)` must throw an IllegalArgumentException if quantity is null or <= 0, or unitPrice is null or negative. Add an instance method `getTotal()` returning quantity * unitPrice, and a static method `sumLines(List<InvoiceLine> lines)` returning the total of all lines.

Reference solution:

```
public class InvoiceLine {
    private Integer quantity;
    private Decimal unitPrice;

    public InvoiceLine(Integer quantity, Decimal unitPrice) {
        if (quantity == null || quantity <= 0 || unitPrice == null || unitPrice < 0) {
            throw new IllegalArgumentException('Invalid quantity or price');
        }
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    public Decimal getTotal() {
        return quantity * unitPrice;
    }

    public static Decimal sumLines(List<InvoiceLine> lines) {
        Decimal total = 0;
        for (InvoiceLine line : lines) {
            total += line.getTotal();
        }
        return total;
    }
}
```

Evaluation points: Private fields assigned via this. in the constructor; Validates inputs and throws IllegalArgumentException; getTotal is an instance method; sumLines is static; sumLines initialises the total to 0 and adds each line

**6. PRG-APEX-S2-06** · Governor Limits & Bulkification · fix_bug · Medium · ~5 min

The method below should move every Case whose Origin is 'Web' and Status is 'New' to Status 'Working'. When a batch of 200 Cases is passed it fails with 'Too many DML statements: 151'. Explain why and fix it.

Given code:

```
public static void startWebCases(List<Case> cases) {
    for (Case c : cases) {
        if (c.Origin == 'Web' && c.Status == 'New') {
            c.Status = 'Working';
            update c;
        }
    }
}
```

Reference solution:

```
// Problem: 'update c' executes one DML statement per matching Case. The limit is
// 150 DML statements per transaction, so more than 150 matches fails.
// Fix: collect changed records and update them once, after the loop.
public static void startWebCases(List<Case> cases) {
    List<Case> toUpdate = new List<Case>();
    for (Case c : cases) {
        if (c.Origin == 'Web' && c.Status == 'New') {
            c.Status = 'Working';
            toUpdate.add(c);
        }
    }
    if (!toUpdate.isEmpty()) {
        update toUpdate;
    }
}
```

Evaluation points: Identifies DML inside a loop and the 150 DML statement limit; Collects records into a List inside the loop; Performs a single update after the loop; Only updates records that actually changed

**7. PRG-APEX-S2-07** · Exceptions · write_code · Medium · ~5 min

Write `public static String createAccount(String name)` that inserts an Account with the given Name. On success return 'OK:' followed by the new record Id. If the insert fails, catch the DmlException (do not let it propagate) and return 'ERROR:' followed by the first DML error message.

Reference solution:

```
public static String createAccount(String name) {
    Account acc = new Account(Name = name);
    try {
        insert acc;
        return 'OK:' + acc.Id;
    } catch (DmlException e) {
        return 'ERROR:' + e.getDmlMessage(0);
    }
}
```

Evaluation points: Wraps the insert in try/catch; Catches DmlException specifically (not only generic Exception); Uses e.getDmlMessage(0) (or getMessage) for the error; Reads acc.Id after insert, which is populated automatically

**8. PRG-APEX-S2-08** · Triggers · explain_output · Medium · ~5 min

A developer deploys the trigger below. What happens when a user inserts a Contact, and why? How would you fix it? In general, when should you use a before trigger and when an after trigger?

Given code:

```
trigger ContactTrigger on Contact (after insert) {
    for (Contact c : Trigger.new) {
        c.Description = 'Created via trigger';
    }
}
```

Reference solution:

```
The insert fails with 'System.FinalException: Record is read-only'. In an after trigger
the records in Trigger.new are already saved and are read-only, so their fields cannot
be assigned. The whole insert is rolled back and the user sees the error.

Fix: change the event to (before insert). In a before trigger you can set fields on
Trigger.new directly and they are saved automatically - no DML statement is needed.

Before triggers: validate or change values on the records being saved (defaults,
calculated fields, addError validation).
After triggers: when you need system-set values such as the record Id or to create/update
OTHER records (related records, child records, logging), because the record now exists.
```

Evaluation points: States the error: Trigger.new is read-only in an after trigger; Fix: use before insert and assign fields without DML; Before = modify/validate the records being saved; After = need Id / work on related records

**9. PRG-APEX-S2-09** · Triggers · write_code · Hard · ~6 min

Implement the one-trigger-per-object handler pattern for Account. Write (a) a single trigger `AccountTrigger` for before insert, before update and after insert that contains no business logic and only delegates to (b) a class `AccountTriggerHandler` with static methods: `beforeInsert(List<Account> newList)` sets Rating to 'Warm' when blank; `beforeUpdate(List<Account> newList, Map<Id, Account> oldMap)` sets Rating to 'Hot' when AnnualRevenue changed and is now greater than 1,000,000; `afterInsert(List<Account> newList)` creates one Case per new Account with Subject 'Onboard ' + Account Name, using one DML statement.

Reference solution:

```
trigger AccountTrigger on Account (before insert, before update, after insert) {
    if (Trigger.isBefore && Trigger.isInsert) {
        AccountTriggerHandler.beforeInsert(Trigger.new);
    } else if (Trigger.isBefore && Trigger.isUpdate) {
        AccountTriggerHandler.beforeUpdate(Trigger.new, (Map<Id, Account>) Trigger.oldMap);
    } else if (Trigger.isAfter && Trigger.isInsert) {
        AccountTriggerHandler.afterInsert(Trigger.new);
    }
}

public class AccountTriggerHandler {
    public static void beforeInsert(List<Account> newList) {
        for (Account a : newList) {
            if (String.isBlank(a.Rating)) {
                a.Rating = 'Warm';
            }
        }
    }

    public static void beforeUpdate(List<Account> newList, Map<Id, Account> oldMap) {
        for (Account a : newList) {
            Account oldA = oldMap.get(a.Id);
            if (a.AnnualRevenue != oldA.AnnualRevenue
                    && a.AnnualRevenue != null && a.AnnualRevenue > 1000000) {
                a.Rating = 'Hot';
            }
        }
    }

    public static void afterInsert(List<Account> newList) {
        List<Case> cases = new List<Case>();
        for (Account a : newList) {
            cases.add(new Case(AccountId = a.Id, Subject = 'Onboard ' + a.Name));
        }
        insert cases;
    }
}
```

Evaluation points: Single trigger covering all three events, routing with Trigger.isBefore/isAfter/isInsert/isUpdate; No business logic inside the trigger body; beforeUpdate compares with oldMap to detect the AnnualRevenue change; afterInsert uses Account Ids (available after insert) and one bulk insert of Cases

**10. PRG-APEX-S2-10** · SOQL Aggregation · write_code · Hard · ~6 min

Write `public static Map<Id, Decimal> getWonAmountByAccount(Set<Id> accountIds)` that returns, for each Account Id in the input, the total Amount of its won Opportunities (IsWon = true). Use a single aggregate SOQL query with GROUP BY (do not loop over individual Opportunities). Every input Account Id must appear in the result; Accounts with no won Opportunities map to 0.

Reference solution:

```
public static Map<Id, Decimal> getWonAmountByAccount(Set<Id> accountIds) {
    Map<Id, Decimal> totals = new Map<Id, Decimal>();
    Decimal zero = 0;
    for (Id accId : accountIds) {
        totals.put(accId, zero);
    }
    for (AggregateResult ar : [
        SELECT AccountId, SUM(Amount) total
        FROM Opportunity
        WHERE IsWon = true AND AccountId IN :accountIds
        GROUP BY AccountId
    ]) {
        Decimal sumAmount = (Decimal) ar.get('total');
        if (sumAmount != null) {
            totals.put((Id) ar.get('AccountId'), sumAmount);
        }
    }
    return totals;
}
```

Evaluation points: Single aggregate query using SUM(Amount) with an alias and GROUP BY AccountId; Reads values with ar.get('alias') and casts to Id / Decimal; Pre-fills every input Id with 0; Filters IsWon = true and AccountId IN :accountIds

### Salesforce Apex – Set 3

**1. PRG-APEX-S3-01** · Loops · write_code · Easy · ~3 min

Write `public static Integer reverseDigits(Integer n)` that returns the digits of `n` in reverse order using a while loop (do not convert to a String). The sign must be preserved and trailing zeros disappear (1200 -> 21). You may ignore overflow.

Reference solution:

```
public static Integer reverseDigits(Integer n) {
    Integer num = Math.abs(n);
    Integer reversed = 0;
    while (num > 0) {
        reversed = reversed * 10 + Math.mod(num, 10);
        num = num / 10;
    }
    return n < 0 ? -reversed : reversed;
}
```

Evaluation points: Uses a while loop with Math.mod(num, 10) and integer division by 10; Handles negative numbers via Math.abs and restores the sign; Returns 0 for input 0; No String conversion

**2. PRG-APEX-S3-02** · Variables & Types · write_code · Easy · ~3 min

Write `public static Integer daysUntilDue(Date invoiceDate, Integer paymentTermsDays, Date today)`. The due date is invoiceDate plus paymentTermsDays. Return the number of days from `today` until the due date (negative if the invoice is overdue). Return null if invoiceDate is null. Use Apex Date methods.

Reference solution:

```
public static Integer daysUntilDue(Date invoiceDate, Integer paymentTermsDays, Date today) {
    if (invoiceDate == null) {
        return null;
    }
    Date dueDate = invoiceDate.addDays(paymentTermsDays);
    return today.daysBetween(dueDate);
}
```

Evaluation points: Computes the due date with addDays; Uses today.daysBetween(dueDate) so overdue gives a negative number; Returns null when invoiceDate is null

**3. PRG-APEX-S3-03** · Strings · explain_output · Easy · ~3 min

What does the following code print? Explain the first three lines carefully - Apex string comparison differs from Java here.

Given code:

```
String a = 'Acme';
String b = 'ACME';
System.debug(a == b);
System.debug(a.equals(b));
System.debug(a.equalsIgnoreCase(b));
String code = '  inv-2024-007 ';
System.debug(code.trim().toUpperCase());
System.debug(code.trim().substringAfterLast('-'));
System.debug('a,b,,c'.split(',').size());
System.debug(String.isBlank('   '));
```

Reference solution:

```
Output:
true
false
true
INV-2024-007
007
4
true

- In Apex the == operator on Strings is case-INSENSITIVE, so 'Acme' == 'ACME' is true.
- equals() is case-sensitive, so it returns false.
- equalsIgnoreCase() is explicitly case-insensitive: true.
- trim() removes surrounding spaces, toUpperCase() gives INV-2024-007.
- substringAfterLast('-') returns the text after the last hyphen: 007 (still a String).
- split(',') keeps the empty value between the two commas: [a, b, '', c] -> 4.
- isBlank is true for whitespace-only strings.
```

Evaluation points: States that == is case-insensitive for Apex Strings (true); equals is case-sensitive (false), equalsIgnoreCase true; Correct trim/toUpperCase and substringAfterLast results; split keeps the middle empty element (4); isBlank true

**4. PRG-APEX-S3-04** · SOQL Relationships · write_code · Medium · ~5 min

Write `public static Map<String, Integer> getContactCountByAccount(Set<Id> accountIds)` that returns Account Name -> number of Contacts for the given Accounts. You must use exactly ONE SOQL query with a parent-to-child subquery (no aggregate functions, no second query). Accounts with no Contacts must appear with 0.

Reference solution:

```
public static Map<String, Integer> getContactCountByAccount(Set<Id> accountIds) {
    Map<String, Integer> result = new Map<String, Integer>();
    for (Account acc : [
        SELECT Name, (SELECT Id FROM Contacts)
        FROM Account
        WHERE Id IN :accountIds
    ]) {
        result.put(acc.Name, acc.Contacts.size());
    }
    return result;
}
```

Evaluation points: Uses a subquery on the child relationship name 'Contacts' (plural); Filters Accounts with Id IN :accountIds; Reads acc.Contacts.size() - the list is empty (not null) when there are no children; Only one SOQL query

**5. PRG-APEX-S3-05** · Maps/Dictionaries · write_code · Medium · ~5 min

Write `public static Map<Id, List<Contact>> groupByAccount(List<Contact> contacts)` that groups the given Contacts by their AccountId. Contacts with no AccountId must be skipped. Do not use SOQL.

Reference solution:

```
public static Map<Id, List<Contact>> groupByAccount(List<Contact> contacts) {
    Map<Id, List<Contact>> grouped = new Map<Id, List<Contact>>();
    for (Contact c : contacts) {
        if (c.AccountId == null) {
            continue;
        }
        if (!grouped.containsKey(c.AccountId)) {
            grouped.put(c.AccountId, new List<Contact>());
        }
        grouped.get(c.AccountId).add(c);
    }
    return grouped;
}
```

Evaluation points: Declares Map<Id, List<Contact>> correctly; Creates a new List the first time an AccountId is seen; Adds each Contact to the list for its AccountId; Skips Contacts with null AccountId

**6. PRG-APEX-S3-06** · Triggers · fix_bug · Medium · ~5 min

This before update trigger should set Status to 'Escalated' for Cases whose Priority is 'High' and Status is 'New'. It throws an error on every update and the Status is never changed. Identify both bugs and write the corrected trigger.

Given code:

```
trigger CaseTrigger on Case (before update) {
    for (Case c : Trigger.old) {
        if (c.Priority == 'High' && c.Status == 'New') {
            c.Status = 'Escalated';
        }
    }
    update Trigger.new;
}
```

Reference solution:

```
// Bug 1: the loop modifies Trigger.old. Trigger.old holds the previous values and is
//        read-only; changes to it are never saved. Loop over Trigger.new instead.
// Bug 2: 'update Trigger.new' - DML on Trigger.new is not allowed in a before trigger
//        (and is unnecessary). Changes to Trigger.new in a before trigger are saved automatically.
trigger CaseTrigger on Case (before update) {
    for (Case c : Trigger.new) {
        if (c.Priority == 'High' && c.Status == 'New') {
            c.Status = 'Escalated';
        }
    }
}
```

Evaluation points: Identifies that Trigger.old is read-only and the loop must use Trigger.new; Identifies that DML on Trigger.new in a before trigger is invalid/unnecessary; Corrected trigger assigns the field with no DML

**7. PRG-APEX-S3-07** · Test Classes · write_code · Medium · ~5 min

Write a test class `OpportunityServiceTest` for the class below. Cover: an Opportunity with Amount above the threshold, one exactly at 100000, one below, and one with no Amount. Use @isTest, Test.startTest()/Test.stopTest() and System.assertEquals with messages.

Given code:

```
public class OpportunityService {
    public static void applyLargeDealFlag(List<Opportunity> opps) {
        for (Opportunity opp : opps) {
            if (opp.Amount != null && opp.Amount >= 100000) {
                opp.Description = 'Large deal';
            }
        }
    }
}
```

Reference solution:

```
@isTest
private class OpportunityServiceTest {
    @isTest
    static void flagsOnlyLargeDeals() {
        Date closeDate = Date.today().addDays(30);
        Opportunity big = new Opportunity(Name = 'Big', StageName = 'Prospecting', CloseDate = closeDate, Amount = 150000);
        Opportunity edge = new Opportunity(Name = 'Edge', StageName = 'Prospecting', CloseDate = closeDate, Amount = 100000);
        Opportunity small = new Opportunity(Name = 'Small', StageName = 'Prospecting', CloseDate = closeDate, Amount = 5000);
        Opportunity noAmount = new Opportunity(Name = 'None', StageName = 'Prospecting', CloseDate = closeDate);

        Test.startTest();
        OpportunityService.applyLargeDealFlag(new List<Opportunity>{ big, edge, small, noAmount });
        Test.stopTest();

        System.assertEquals('Large deal', big.Description, 'Amount above threshold should be flagged');
        System.assertEquals('Large deal', edge.Description, 'Amount equal to threshold should be flagged');
        System.assertEquals(null, small.Description, 'Small amount should not be flagged');
        System.assertEquals(null, noAmount.Description, 'Null amount should not be flagged');
    }
}
```

Evaluation points: Class and method annotated with @isTest; test creates its own data; Calls the method between Test.startTest() and Test.stopTest(); Uses System.assertEquals(expected, actual, message) with expected value first; Covers above, boundary, below and null cases

**8. PRG-APEX-S3-08** · SOSL · write_code · Medium · ~5 min

Write `public static List<String> searchCustomerNames(String term)` that uses a single SOSL search to find Accounts and Contacts whose name fields match `term`, returning the Account names first, then the Contact names. If `term` is null or shorter than 2 characters, return an empty list without searching. In one sentence, state when SOSL is preferable to SOQL.

Reference solution:

```
public static List<String> searchCustomerNames(String term) {
    List<String> names = new List<String>();
    if (term == null || term.length() < 2) {
        return names;
    }
    List<List<SObject>> results = [
        FIND :term IN NAME FIELDS
        RETURNING Account(Id, Name), Contact(Id, Name)
    ];
    for (Account a : (List<Account>) results[0]) {
        names.add(a.Name);
    }
    for (Contact c : (List<Contact>) results[1]) {
        names.add(c.Name);
    }
    return names;
}
// SOSL is preferable when you need a text search across several objects/fields at once
// and do not know which object or field contains the value; SOQL is for querying one
// object (and its relationships) with precise filters.
```

Evaluation points: Uses FIND ... IN NAME FIELDS RETURNING Account(...), Contact(...); Result is List<List<SObject>>; index 0 = Accounts, 1 = Contacts in RETURNING order; Guards against null/short search terms; Correct explanation of SOSL vs SOQL

**9. PRG-APEX-S3-09** · Triggers · write_code · Hard · ~6 min

Write a trigger `OpportunityTrigger` on Opportunity (after insert). For every new Opportunity with an Amount of 500,000 or more that is linked to an Account, set the parent Account's Rating to 'Hot'. Requirements: bulk-safe (one SOQL, one DML at most), each Account updated only once even if it has several large Opportunities, and Accounts already rated 'Hot' must not be updated.

Reference solution:

```
trigger OpportunityTrigger on Opportunity (after insert) {
    Set<Id> accountIds = new Set<Id>();
    for (Opportunity opp : Trigger.new) {
        if (opp.AccountId != null && opp.Amount != null && opp.Amount >= 500000) {
            accountIds.add(opp.AccountId);
        }
    }
    if (accountIds.isEmpty()) {
        return;
    }
    List<Account> toUpdate = new List<Account>();
    for (Account acc : [SELECT Id, Rating FROM Account WHERE Id IN :accountIds]) {
        if (acc.Rating != 'Hot') {
            acc.Rating = 'Hot';
            toUpdate.add(acc);
        }
    }
    if (!toUpdate.isEmpty()) {
        update toUpdate;
    }
}
```

Evaluation points: Collects AccountIds in a Set (de-duplicates Accounts); One SOQL outside the loop, one update after the loop; Skips Accounts already rated 'Hot' and Opportunities without Account/Amount; Uses an after trigger because it updates related (parent) records

**10. PRG-APEX-S3-10** · Async Apex · fix_bug · Hard · ~6 min

The class below is supposed to mark Contacts as synced asynchronously. It does not even compile, and it would also break governor limits for large volumes. Explain every problem and rewrite it correctly. Also show how the caller should invoke it when it has a List<Contact> named contactList.

Given code:

```
public class ContactSyncService {
    @future
    public static void markContactsSynced(List<Contact> contacts) {
        for (Contact c : contacts) {
            Contact fresh = [SELECT Id, Description FROM Contact WHERE Id = :c.Id];
            fresh.Description = 'Synced';
            update fresh;
        }
    }
}
```

Reference solution:

```
// Problem 1 (compile error): @future methods accept only primitive types or collections of
//   primitives (e.g. Set<Id>, List<String>); sObjects cannot be passed, because the data may
//   change before the async method runs. Pass Ids and re-query.
// Problem 2: SOQL inside the loop (100 query limit).
// Problem 3: DML inside the loop (150 DML statement limit).
public class ContactSyncService {
    @future
    public static void markContactsSynced(Set<Id> contactIds) {
        List<Contact> contacts = [SELECT Id, Description FROM Contact WHERE Id IN :contactIds];
        for (Contact c : contacts) {
            c.Description = 'Synced';
        }
        update contacts;
    }
}

// Caller:
ContactSyncService.markContactsSynced(new Map<Id, Contact>(contactList).keySet());
```

Evaluation points: Explains that @future parameters must be primitives/collections of primitives (no sObjects); Changes the parameter to Set<Id> (or List<Id>) and re-queries inside the method; Moves SOQL and DML out of the loop (single query, single update); Method remains static void with @future; caller passes Ids

### Salesforce Apex – Set 4

**1. PRG-APEX-S4-01** · Strings · write_code · Easy · ~3 min

Write `public static List<String> buildInvoiceNumbers(Integer startNum, Integer count)` that returns `count` consecutive invoice numbers starting at `startNum`, formatted as 'INV-' followed by the number left-padded with zeros to 4 digits. Numbers with more than 4 digits are not truncated.

Reference solution:

```
public static List<String> buildInvoiceNumbers(Integer startNum, Integer count) {
    List<String> numbers = new List<String>();
    for (Integer i = 0; i < count; i++) {
        numbers.add('INV-' + String.valueOf(startNum + i).leftPad(4, '0'));
    }
    return numbers;
}
```

Evaluation points: Loops exactly count times; Converts the number to a String (String.valueOf); Uses leftPad(4, '0') or equivalent padding logic; Does not truncate numbers longer than 4 digits

**2. PRG-APEX-S4-02** · SOQL Basics · write_code · Easy · ~3 min

Write `public static Integer countOpenHighPriorityCases(Id accountId)` that returns the number of Cases for the given Account whose Priority is 'High' and that are not closed. Let the database do the counting (do not load the records and call size()).

Reference solution:

```
public static Integer countOpenHighPriorityCases(Id accountId) {
    return [
        SELECT COUNT()
        FROM Case
        WHERE AccountId = :accountId
        AND Priority = 'High'
        AND IsClosed = false
    ];
}
```

Evaluation points: Uses SELECT COUNT(), which returns an Integer directly; Filters by AccountId with a bind variable; Filters Priority = 'High' and IsClosed = false (or Status != 'Closed')

**3. PRG-APEX-S4-03** · Loops · explain_output · Easy · ~3 min

What does this code print? Explain the effect of `continue`, `break` and the do-while loop.

Given code:

```
List<Integer> qty = new List<Integer>{5, 0, 12, -1, 8, 3};
Integer total = 0;
for (Integer q : qty) {
    if (q == 0) {
        continue;
    }
    if (q < 0) {
        break;
    }
    total += q;
    System.debug('Added ' + q);
}
System.debug('Total = ' + total);

Integer i = 10;
do {
    System.debug('i = ' + i);
    i += 5;
} while (i < 10);
```

Reference solution:

```
Output:
Added 5
Added 12
Total = 17
i = 10

- 5 is added. 0 triggers continue: the rest of that iteration is skipped. 12 is added.
- -1 triggers break: the loop ends immediately, so 8 and 3 are never processed. Total = 5 + 12 = 17.
- A do-while loop always runs its body at least once before checking the condition, so
  'i = 10' is printed even though 10 < 10 is false; then i becomes 15 and the loop stops.
```

Evaluation points: Correct lines Added 5, Added 12; continue skips 0; break stops at -1 so 8 and 3 are not added; Total = 17; do-while executes once: prints i = 10

**4. PRG-APEX-S4-04** · DML & Database Methods · write_code · Medium · ~5 min

Write `public static Integer closeStaleOpportunities()` that finds open Opportunities (IsClosed = false) whose CloseDate is before today, sets their StageName to 'Closed Lost', and saves them with partial success allowed so that one invalid record does not block the others. Return the number of Opportunities that were successfully updated. Process at most 200 records.

Reference solution:

```
public static Integer closeStaleOpportunities() {
    List<Opportunity> stale = [
        SELECT Id, StageName
        FROM Opportunity
        WHERE IsClosed = false AND CloseDate < TODAY
        LIMIT 200
    ];
    for (Opportunity opp : stale) {
        opp.StageName = 'Closed Lost';
    }
    Integer successCount = 0;
    for (Database.SaveResult sr : Database.update(stale, false)) {
        if (sr.isSuccess()) {
            successCount++;
        }
    }
    return successCount;
}
```

Evaluation points: SOQL filters IsClosed = false and CloseDate < TODAY (date literal) with LIMIT 200; Sets StageName on all records in a loop without DML inside the loop; Uses Database.update(list, false) and counts isSuccess() results

**5. PRG-APEX-S4-05** · Exceptions · write_code · Medium · ~5 min

Create a custom exception `StockException` and a class `InventoryService` with `public static Integer reserve(Integer available, Integer requested)`. It returns the remaining stock (available - requested). It must throw StockException with the message 'Requested quantity must be positive' if requested is null or <= 0, and 'Only <available> units available' if requested exceeds available. Also show a short caller that catches the exception and logs its message.

Reference solution:

```
public class StockException extends Exception {}

public class InventoryService {
    public static Integer reserve(Integer available, Integer requested) {
        if (requested == null || requested <= 0) {
            throw new StockException('Requested quantity must be positive');
        }
        if (requested > available) {
            throw new StockException('Only ' + available + ' units available');
        }
        return available - requested;
    }
}

// Caller:
try {
    Integer remaining = InventoryService.reserve(5, 8);
} catch (StockException e) {
    System.debug(e.getMessage());   // Only 5 units available
}
```

Evaluation points: Custom exception class extends Exception and its name ends with 'Exception'; Throws with the message constructor new StockException('...'); Validates both conditions in the right order; Caller catches StockException and uses getMessage()

**6. PRG-APEX-S4-06** · Governor Limits & Bulkification · fix_bug · Medium · ~5 min

This trigger should copy the parent Account's Phone to every new Contact that has no Phone. It works when one Contact is created in the UI but fails for Data Loader imports of many Contacts. Explain what goes wrong and rewrite the trigger so it is bulk-safe.

Given code:

```
trigger ContactTrigger on Contact (before insert) {
    Contact c = Trigger.new[0];
    if (c.AccountId != null) {
        Account acc = [SELECT Phone FROM Account WHERE Id = :c.AccountId];
        if (c.Phone == null) {
            c.Phone = acc.Phone;
        }
    }
}
```

Reference solution:

```
// Problem: only Trigger.new[0] is processed, so in a batch of up to 200 records the other
// 199 Contacts are ignored. Simply looping and querying per record would then hit the
// 100 SOQL limit. Fix: loop over all records, collect Account Ids, query once into a Map.
trigger ContactTrigger on Contact (before insert) {
    Set<Id> accountIds = new Set<Id>();
    for (Contact c : Trigger.new) {
        if (c.AccountId != null && String.isBlank(c.Phone)) {
            accountIds.add(c.AccountId);
        }
    }
    if (accountIds.isEmpty()) {
        return;
    }
    Map<Id, Account> accounts = new Map<Id, Account>(
        [SELECT Id, Phone FROM Account WHERE Id IN :accountIds]
    );
    for (Contact c : Trigger.new) {
        if (String.isBlank(c.Phone) && accounts.containsKey(c.AccountId)) {
            c.Phone = accounts.get(c.AccountId).Phone;
        }
    }
}
```

Evaluation points: Explains that Trigger.new can contain up to 200 records and [0] ignores the rest; Loops over all of Trigger.new; One SOQL using IN :accountIds loaded into a Map<Id, Account>; No DML needed because it is a before trigger

**7. PRG-APEX-S4-07** · Sharing & Security · explain_output · Medium · ~5 min

A sales user can see 40 of the org's 1,000 Accounts through the sharing model. The user runs code that calls each method below directly. How many Accounts does each method see, and why? Explain `inherited sharing`, which keyword you would choose by default for a class called from a Lightning component, and whether these keywords enforce field-level security.

Given code:

```
public with sharing class AccountListController {
    public static List<Account> getAccounts() {
        return [SELECT Id, Name FROM Account];
    }
}

public without sharing class AccountStatsService {
    public static Integer countAllAccounts() {
        return [SELECT COUNT() FROM Account];
    }
}

public inherited sharing class AccountQueryHelper {
    public static List<Account> getAll() {
        return [SELECT Id FROM Account];
    }
}
```

Reference solution:

```
- AccountListController.getAccounts(): 40. 'with sharing' enforces the running user's
  record-level sharing rules, so only records the user can see are returned.
- AccountStatsService.countAllAccounts(): 1,000. 'without sharing' ignores sharing rules
  (system context), so all records are counted.
- AccountQueryHelper.getAll(): depends on the caller. 'inherited sharing' runs with the
  sharing mode of the class that called it: 40 if called from a with sharing class,
  1,000 if called from a without sharing class. When it is the entry point (e.g. called
  directly from a Lightning component) it behaves as with sharing -> 40.
- Default choice for a Lightning controller: 'with sharing', using 'without sharing' only
  for specific, justified system operations.
- These keywords only control record-level access (sharing). They do NOT enforce object
  permissions or field-level security; for that use WITH USER_MODE / WITH SECURITY_ENFORCED
  in SOQL or Security.stripInaccessible.
```

Evaluation points: with sharing -> 40 (user's record access); without sharing -> 1,000 (ignores sharing); inherited sharing follows the caller and defaults to with sharing as entry point; Recommends with sharing by default and notes sharing keywords do not enforce CRUD/FLS

**8. PRG-APEX-S4-08** · OOP Basics · write_code · Medium · ~5 min

Define an interface `DiscountRule` with a method `Decimal apply(Decimal amount)`. Implement two classes: `PercentDiscount` (constructor takes a percent, reduces the amount by that percent) and `FlatDiscount` (constructor takes a fixed amount to subtract, never returning less than 0). Then write `PricingService.applyAll(Decimal amount, List<DiscountRule> rules)` that applies each rule in order to the running result.

Reference solution:

```
public interface DiscountRule {
    Decimal apply(Decimal amount);
}

public class PercentDiscount implements DiscountRule {
    private Decimal percent;
    public PercentDiscount(Decimal percent) {
        this.percent = percent;
    }
    public Decimal apply(Decimal amount) {
        return amount - (amount * percent / 100);
    }
}

public class FlatDiscount implements DiscountRule {
    private Decimal flat;
    public FlatDiscount(Decimal flat) {
        this.flat = flat;
    }
    public Decimal apply(Decimal amount) {
        Decimal result = amount - flat;
        if (result < 0) {
            return 0;
        }
        return result;
    }
}

public class PricingService {
    public static Decimal applyAll(Decimal amount, List<DiscountRule> rules) {
        Decimal result = amount;
        for (DiscountRule rule : rules) {
            result = rule.apply(result);
        }
        return result;
    }
}
```

Evaluation points: Interface method declared without body or access modifier; implementations are public; Both classes use 'implements DiscountRule' and store constructor values in private fields; FlatDiscount never returns a negative value; applyAll works only through the interface type (polymorphism), chaining results

**9. PRG-APEX-S4-09** · Triggers · write_code · Hard · ~6 min

Write a trigger on Account (before delete) that prevents deletion of any Account that still has at least one open Opportunity (IsClosed = false). Blocked records must show the error 'Cannot delete an account with open opportunities.' while other Accounts in the same batch are deleted normally. Use at most one SOQL query and no DML.

Reference solution:

```
trigger AccountTrigger on Account (before delete) {
    Set<Id> blocked = new Set<Id>();
    for (Opportunity opp : [
        SELECT AccountId
        FROM Opportunity
        WHERE AccountId IN :Trigger.oldMap.keySet() AND IsClosed = false
    ]) {
        blocked.add(opp.AccountId);
    }
    for (Account acc : Trigger.old) {
        if (blocked.contains(acc.Id)) {
            acc.addError('Cannot delete an account with open opportunities.');
        }
    }
}
```

Evaluation points: Uses before delete and Trigger.old / Trigger.oldMap (Trigger.new is null on delete); Single SOQL with IN :Trigger.oldMap.keySet() and IsClosed = false (or a parent-to-child subquery); Calls addError on the specific records so only those are blocked; No DML and no SOQL inside a loop

**10. PRG-APEX-S4-10** · Test Classes · write_code · Hard · ~6 min

Write a bulk test class for the trigger below. Insert 200 Cases without a Subject (100 with Origin 'Phone', 100 with Origin 'Email') plus one Phone Case that already has Subject 'Broken printer'. After the insert, re-query the records and assert that exactly 100 have 'Phone enquiry', exactly 100 have 'General enquiry', and the existing subject was not overwritten. Use Test.startTest()/Test.stopTest().

Given code:

```
trigger CaseDefaultsTrigger on Case (before insert) {
    for (Case c : Trigger.new) {
        if (String.isBlank(c.Subject)) {
            c.Subject = (c.Origin == 'Phone') ? 'Phone enquiry' : 'General enquiry';
        }
    }
}
```

Reference solution:

```
@isTest
private class CaseDefaultsTriggerTest {
    @isTest
    static void setsDefaultSubjectsInBulk() {
        List<Case> cases = new List<Case>();
        for (Integer i = 0; i < 200; i++) {
            String origin = Math.mod(i, 2) == 0 ? 'Phone' : 'Email';
            cases.add(new Case(Origin = origin));
        }
        Case withSubject = new Case(Origin = 'Phone', Subject = 'Broken printer');
        cases.add(withSubject);

        Test.startTest();
        insert cases;
        Test.stopTest();

        Integer phoneCount = 0;
        Integer generalCount = 0;
        for (Case c : [SELECT Subject FROM Case WHERE Id IN :cases]) {
            if (c.Subject == 'Phone enquiry') {
                phoneCount++;
            } else if (c.Subject == 'General enquiry') {
                generalCount++;
            }
        }
        System.assertEquals(100, phoneCount, 'Phone cases should get the phone subject');
        System.assertEquals(100, generalCount, 'Other cases should get the general subject');

        Case saved = [SELECT Subject FROM Case WHERE Id = :withSubject.Id];
        System.assertEquals('Broken printer', saved.Subject, 'Existing subject must not change');
    }
}
```

Evaluation points: Builds 200+ records in a loop and inserts them with one DML (bulk test); Insert wrapped in Test.startTest()/Test.stopTest(); Re-queries the records from the database before asserting (values set by the trigger); Asserts counts for both branches and the unchanged subject with System.assertEquals

### Salesforce Apex – Set 5

**1. PRG-APEX-S5-01** · Strings · write_code · Easy · ~3 min

Write `public static String maskAccountNumber(String accNum)` that hides all but the last 4 characters of an account number by replacing them with '*'. If the value is null or has 4 or fewer characters, return it unchanged.

Reference solution:

```
public static String maskAccountNumber(String accNum) {
    if (accNum == null || accNum.length() <= 4) {
        return accNum;
    }
    Integer hidden = accNum.length() - 4;
    return '*'.repeat(hidden) + accNum.right(4);
}
```

Evaluation points: Handles null and short values before using string methods; Keeps exactly the last 4 characters (right(4) or substring); Replaces the rest with the correct number of '*' characters

**2. PRG-APEX-S5-02** · Collections · write_code · Easy · ~3 min

Write `public static List<String> uniqueEmails(List<String> emails)` that removes duplicate email addresses. Comparison is case-insensitive and ignores surrounding spaces; blank/null entries are skipped. Return the emails trimmed and in lower case, in the order of their first occurrence. Use a Set to detect duplicates.

Reference solution:

```
public static List<String> uniqueEmails(List<String> emails) {
    Set<String> seen = new Set<String>();
    List<String> result = new List<String>();
    for (String e : emails) {
        if (String.isBlank(e)) {
            continue;
        }
        String normalized = e.trim().toLowerCase();
        if (!seen.contains(normalized)) {
            seen.add(normalized);
            result.add(normalized);
        }
    }
    return result;
}
```

Evaluation points: Normalises with trim() and toLowerCase() before comparison; Uses a Set<String> to track seen values; Keeps first-occurrence order using a List for the result; Skips null/blank entries

**3. PRG-APEX-S5-03** · Conditionals · write_code · Easy · ~3 min

Write `public static Boolean isLeapYear(Integer year)` without using Date.isLeapYear. A year is a leap year if it is divisible by 4, except years divisible by 100, unless they are also divisible by 400.

Reference solution:

```
public static Boolean isLeapYear(Integer year) {
    if (Math.mod(year, 400) == 0) {
        return true;
    }
    if (Math.mod(year, 100) == 0) {
        return false;
    }
    return Math.mod(year, 4) == 0;
}
```

Evaluation points: Uses Math.mod for divisibility; Checks the 400 rule before the 100 rule; Returns Boolean for all paths

**4. PRG-APEX-S5-04** · DML & Database Methods · write_code · Medium · ~5 min

Write `public static Id createAccountWithContacts(String accountName, List<String> lastNames)` that inserts an Account and then one Contact per last name linked to that Account, using one DML statement for all Contacts. If any insert fails, nothing must remain saved (roll back the Account too) and the DmlException must be re-thrown to the caller. Return the new Account Id.

Reference solution:

```
public static Id createAccountWithContacts(String accountName, List<String> lastNames) {
    Savepoint sp = Database.setSavepoint();
    try {
        Account acc = new Account(Name = accountName);
        insert acc;
        List<Contact> contacts = new List<Contact>();
        for (String ln : lastNames) {
            contacts.add(new Contact(LastName = ln, AccountId = acc.Id));
        }
        insert contacts;
        return acc.Id;
    } catch (DmlException e) {
        Database.rollback(sp);
        throw e;
    }
}
```

Evaluation points: Inserts the parent first and uses acc.Id to set AccountId on children; Builds all Contacts in a list and inserts them with one DML; Uses Database.setSavepoint()/Database.rollback() to undo the Account on failure; Re-throws the exception after rollback

**5. PRG-APEX-S5-05** · SOQL Basics · explain_output · Medium · ~5 min

Assume there is no Account named 'Does Not Exist' and there are exactly two Accounts named 'Acme'. For each of the three blocks below (run separately), say what is printed or what error occurs, and explain why. Which pattern is safest when a query may return zero rows?

Given code:

```
// Block 1
Account acc = [SELECT Id, Name FROM Account WHERE Name = 'Does Not Exist'];
System.debug(acc.Name);

// Block 2
List<Account> accs = [SELECT Id, Name FROM Account WHERE Name = 'Does Not Exist'];
System.debug(accs.size());
Account first = accs.isEmpty() ? null : accs[0];
System.debug(first);

// Block 3
Account acme = [SELECT Id FROM Account WHERE Name = 'Acme'];
System.debug(acme.Id);
```

Reference solution:

```
Block 1: throws System.QueryException: 'List has no rows for assignment to SObject'.
  Assigning a query directly to a single sObject requires exactly one row; the debug line never runs.
Block 2: prints 0 and then null. Assigning to a List never fails - an empty list is returned -
  and the isEmpty() check avoids an index error.
Block 3: throws System.QueryException: 'List has more than 1 row for assignment to SObject',
  because two records match.
Safest pattern: query into a List and check isEmpty()/size() (or use LIMIT 1 plus a List)
before reading a record.
```

Evaluation points: Block 1: QueryException for no rows; Block 2: prints 0 and null, no exception; Block 3: QueryException for more than 1 row; Recommends querying into a List and checking before access

**6. PRG-APEX-S5-06** · SOQL Relationships · fix_bug · Medium · ~5 min

Both methods below fail to compile because of SOQL mistakes. Find the three errors and write the corrected queries. The first method should return Contacts of the Account with the given name, including the Account name; the second should return Accounts that have Cases, with their Cases' Id and Subject.

Given code:

```
public static List<Contact> findContacts(String accName) {
    return [
        SELECT Id, LastName, Account__r.Name
        FROM Contact
        WHERE Account.Name = accName
        ORDER BY LastName
    ];
}

public static List<Account> accountsWithCases() {
    return [
        SELECT Id, Name, (SELECT Id, Subject FROM Case)
        FROM Account
        WHERE Id IN (SELECT AccountId FROM Case)
    ];
}
```

Reference solution:

```
// Error 1: Account__r is the syntax for CUSTOM relationships. The standard Contact->Account
//          relationship is simply Account (Account.Name).
// Error 2: accName is an Apex variable and needs a colon to be a bind variable (:accName).
// Error 3: a parent-to-child subquery must use the child relationship name (plural 'Cases'),
//          not the object name 'Case'.
public static List<Contact> findContacts(String accName) {
    return [
        SELECT Id, LastName, Account.Name
        FROM Contact
        WHERE Account.Name = :accName
        ORDER BY LastName
    ];
}

public static List<Account> accountsWithCases() {
    return [
        SELECT Id, Name, (SELECT Id, Subject FROM Cases)
        FROM Account
        WHERE Id IN (SELECT AccountId FROM Case)
    ];
}
```

Evaluation points: Replaces Account__r.Name with Account.Name (standard relationship); Adds the colon for the bind variable :accName; Uses the child relationship name 'Cases' in the subquery; Keeps the valid semi-join WHERE Id IN (SELECT AccountId FROM Case)

**7. PRG-APEX-S5-07** · Classes & Static · write_code · Medium · ~5 min

Triggers can fire more than once in a transaction (for example when a workflow updates the record again). Write a class `TriggerGuard` with a private static Set<Id> and two static methods: `Boolean isFirstTime(Id recordId)` returns true the first time an Id is seen in the transaction and false afterwards; `List<SObject> filterUnprocessed(List<SObject> records)` returns only the records not processed yet (and marks them processed). In one sentence explain why a static variable works for this.

Reference solution:

```
public class TriggerGuard {
    private static Set<Id> processedIds = new Set<Id>();

    public static Boolean isFirstTime(Id recordId) {
        if (processedIds.contains(recordId)) {
            return false;
        }
        processedIds.add(recordId);
        return true;
    }

    public static List<SObject> filterUnprocessed(List<SObject> records) {
        List<SObject> result = new List<SObject>();
        for (SObject rec : records) {
            if (isFirstTime(rec.Id)) {
                result.add(rec);
            }
        }
        return result;
    }
}
// Static variables keep their value for the whole transaction (shared by every trigger
// execution in it) and are reset for the next transaction, so they remember which records
// were already handled without affecting other users or requests.
```

Evaluation points: Static Set<Id> initialised once at declaration; isFirstTime adds the Id and returns true only on first call; filterUnprocessed reuses isFirstTime and returns a new list; Explains that static values persist for one transaction only

**8. PRG-APEX-S5-08** · Test Classes · write_code · Medium · ~5 min

Write a test class `ContactServiceTest` for the class below with two test methods: (1) a positive test that creates its own Account, calls createContact and asserts, by re-querying, that the Contact was saved with the right AccountId and LastName; (2) a negative test that passes a null last name and asserts that a DmlException is thrown with status code REQUIRED_FIELD_MISSING. The negative test must fail if no exception occurs.

Given code:

```
public class ContactService {
    public static Contact createContact(Id accountId, String lastName) {
        Contact c = new Contact(AccountId = accountId, LastName = lastName);
        insert c;
        return c;
    }
}
```

Reference solution:

```
@isTest
private class ContactServiceTest {
    @isTest
    static void createsContact() {
        Account acc = new Account(Name = 'Test Co');
        insert acc;

        Test.startTest();
        Contact c = ContactService.createContact(acc.Id, 'Smith');
        Test.stopTest();

        Contact saved = [SELECT AccountId, LastName FROM Contact WHERE Id = :c.Id];
        System.assertEquals(acc.Id, saved.AccountId, 'Contact should be linked to the account');
        System.assertEquals('Smith', saved.LastName, 'LastName should be saved');
    }

    @isTest
    static void missingLastNameThrows() {
        Boolean thrown = false;
        Test.startTest();
        try {
            ContactService.createContact(null, null);
        } catch (DmlException e) {
            thrown = true;
            System.assertEquals(StatusCode.REQUIRED_FIELD_MISSING, e.getDmlType(0), 'Wrong error type');
        }
        Test.stopTest();
        System.assertEquals(true, thrown, 'Expected a DmlException');
    }
}
```

Evaluation points: Test data (Account) created inside the test, no reliance on org data; Positive test re-queries and asserts AccountId and LastName; Negative test uses try/catch DmlException and a flag asserted after the block so it fails when nothing is thrown; Checks e.getDmlType(0) == StatusCode.REQUIRED_FIELD_MISSING

**9. PRG-APEX-S5-09** · Governor Limits & Bulkification · write_code · Hard · ~6 min

Write `public static Integer createOnboardingCases(List<Opportunity> wonOpps)`. For the Accounts of the given Opportunities, create exactly one Case with Subject 'Onboarding' and Priority 'Medium' per Account, but skip Accounts that already have an open Case (IsClosed = false) with Subject 'Onboarding'. Several Opportunities may share an Account; Opportunities without an Account are ignored. Use at most one SOQL and one DML. Return the number of Cases created.

Reference solution:

```
public static Integer createOnboardingCases(List<Opportunity> wonOpps) {
    Set<Id> accountIds = new Set<Id>();
    for (Opportunity opp : wonOpps) {
        if (opp.AccountId != null) {
            accountIds.add(opp.AccountId);
        }
    }
    Set<Id> alreadyHasCase = new Set<Id>();
    for (Case c : [
        SELECT AccountId
        FROM Case
        WHERE AccountId IN :accountIds
        AND Subject = 'Onboarding'
        AND IsClosed = false
    ]) {
        alreadyHasCase.add(c.AccountId);
    }
    List<Case> newCases = new List<Case>();
    for (Id accId : accountIds) {
        if (!alreadyHasCase.contains(accId)) {
            newCases.add(new Case(AccountId = accId, Subject = 'Onboarding', Priority = 'Medium'));
        }
    }
    if (!newCases.isEmpty()) {
        insert newCases;
    }
    return newCases.size();
}
```

Evaluation points: De-duplicates Accounts with a Set<Id> and ignores null AccountId; One SOQL outside loops to find Accounts with an open 'Onboarding' Case; Creates Cases only for Accounts without one; single insert; Returns the number of Cases created

**10. PRG-APEX-S5-10** · Sorting/Searching · write_code · Hard · ~6 min

Write a class `AccountRevenueWrapper` that wraps an Account and implements the Comparable interface so that a List of wrappers sorts by AnnualRevenue DESCENDING, with null revenue last. Add a static method `List<String> topAccountNames(List<Account> accounts, Integer n)` that returns the names of the n Accounts with the highest revenue (or fewer if the list is shorter). Do not use SOQL.

Reference solution:

```
public class AccountRevenueWrapper implements Comparable {
    public Account acc;

    public AccountRevenueWrapper(Account acc) {
        this.acc = acc;
    }

    public Integer compareTo(Object other) {
        AccountRevenueWrapper that = (AccountRevenueWrapper) other;
        Decimal a = this.acc.AnnualRevenue;
        Decimal b = that.acc.AnnualRevenue;
        if (a == b) {
            return 0;
        }
        if (a == null) {
            return 1;
        }
        if (b == null) {
            return -1;
        }
        return a > b ? -1 : 1;
    }

    public static List<String> topAccountNames(List<Account> accounts, Integer n) {
        List<AccountRevenueWrapper> wrappers = new List<AccountRevenueWrapper>();
        for (Account acc : accounts) {
            wrappers.add(new AccountRevenueWrapper(acc));
        }
        wrappers.sort();
        List<String> names = new List<String>();
        for (Integer i = 0; i < Math.min(n, wrappers.size()); i++) {
            names.add(wrappers[i].acc.Name);
        }
        return names;
    }
}
```

Evaluation points: Implements Comparable with public Integer compareTo(Object other) and casts the argument; Returns negative/positive values so higher revenue sorts first; Places null revenue last and handles equal values (0); Wraps, calls List.sort(), and takes at most n names

## C#

### C# – Set 1

**1. PRG-CSHARP-S1-01** · Conditionals · write_code · Easy · ~3 min

Write a C# method `static string Classify(int n)` that returns "Positive" if n is greater than zero, "Negative" if n is less than zero, and "Zero" if n equals zero.

Reference solution:

```
static string Classify(int n)
{
    if (n > 0) return "Positive";
    if (n < 0) return "Negative";
    return "Zero";
}
```

Evaluation points: Returns exactly "Positive", "Negative" or "Zero" (correct spelling/case); Handles zero as its own case; Correct comparison operators (no off-by-one such as >= 0 for Positive); Every code path returns a value

**2. PRG-CSHARP-S1-02** · Value vs Reference Types · explain_output · Easy · ~3 min

The program below copies a struct variable and a class variable, then modifies each copy. Predict the two values it prints and explain, in terms of value types and reference types, why they differ.

Given code:

```
using System;

struct PointS { public int X; }
class PointC { public int X; }

class Program
{
    static void Main()
    {
        PointS a = new PointS { X = 1 };
        PointS b = a;
        b.X = 10;

        PointC c = new PointC { X = 1 };
        PointC d = c;
        d.X = 10;

        Console.WriteLine(a.X);
        Console.WriteLine(c.X);
    }
}
```

Reference solution:

```
Output:
1
10

Explanation: PointS is a struct (value type): `PointS b = a;` copies the whole value, so changing b.X does not affect a, and a.X is still 1. PointC is a class (reference type): `PointC d = c;` copies only the reference, so c and d refer to the same object on the heap; setting d.X = 10 changes the object that c also refers to, so c.X prints 10.
```

Evaluation points: States the exact output: 1 then 10; Explains that a struct is a value type, so `b = a` copies the data; Explains that a class is a reference type, so `d = c` copies the reference and both variables point to the same object; Explains that changing d.X is therefore visible through c

**3. PRG-CSHARP-S1-03** · Loops · write_code · Easy · ~3 min

Write a C# method `static int SumDigits(int n)` that returns the sum of the decimal digits of n. Negative numbers should be treated as their absolute value (e.g. -507 gives 5 + 0 + 7 = 12). You may assume |n| <= 1,000,000,000. Use a loop; do not convert the number to a string.

Reference solution:

```
static int SumDigits(int n)
{
    n = Math.Abs(n);
    int sum = 0;
    while (n > 0)
    {
        sum += n % 10;
        n /= 10;
    }
    return sum;
}
```

Evaluation points: Uses % 10 and / 10 in a loop to extract digits; Handles negative input via Math.Abs (or equivalent); Returns 0 for input 0; Does not convert to string as required

**4. PRG-CSHARP-S1-04** · Strings · write_code · Medium · ~5 min

Write a C# method `static bool IsPalindrome(string s)` that returns true if s reads the same forwards and backwards when you consider only letters and digits and ignore case. Spaces and punctuation are ignored. An empty string is a palindrome. Use a two-pointer approach (do not build a reversed copy with LINQ).

Reference solution:

```
static bool IsPalindrome(string s)
{
    int left = 0, right = s.Length - 1;
    while (left < right)
    {
        if (!char.IsLetterOrDigit(s[left])) { left++; continue; }
        if (!char.IsLetterOrDigit(s[right])) { right--; continue; }
        if (char.ToLower(s[left]) != char.ToLower(s[right])) return false;
        left++;
        right--;
    }
    return true;
}
```

Evaluation points: Skips characters that are not letters or digits (char.IsLetterOrDigit); Compares case-insensitively (char.ToLower / ToUpper); Two pointers move towards each other and stop when they meet; Returns true for an empty string or a string with no letters/digits

**5. PRG-CSHARP-S1-05** · Dictionary<TKey,TValue> · write_code · Medium · ~4 min

Write a C# method `static Dictionary<string, int> WordFrequency(string text)` that counts how many times each word appears in text. Words are separated by one or more spaces. Counting is case-insensitive: store every key in lower case. An empty string returns an empty dictionary.

Reference solution:

```
static Dictionary<string, int> WordFrequency(string text)
{
    var counts = new Dictionary<string, int>();
    string[] words = text.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
    foreach (string w in words)
    {
        string key = w.ToLower();
        if (counts.ContainsKey(key))
            counts[key]++;
        else
            counts[key] = 1;
    }
    return counts;
}
```

Evaluation points: Splits on spaces and ignores empty entries caused by repeated spaces; Normalises keys to lower case; Checks for an existing key (ContainsKey/TryGetValue) before incrementing, avoiding KeyNotFoundException; Returns an empty dictionary for empty input

**6. PRG-CSHARP-S1-06** · Arrays · fix_bug · Medium · ~4 min

The method below should return the largest value in a non-empty integer array, but it returns the wrong result for some inputs. Find the bug, explain it, and provide the corrected method.

Given code:

```
static int FindMax(int[] numbers)
{
    int max = 0;
    for (int i = 0; i < numbers.Length; i++)
    {
        if (numbers[i] > max)
            max = numbers[i];
    }
    return max;
}
```

Reference solution:

```
static int FindMax(int[] numbers)
{
    int max = numbers[0];   // bug fix: start from the first element, not 0
    for (int i = 1; i < numbers.Length; i++)
    {
        if (numbers[i] > max)
            max = numbers[i];
    }
    return max;
}
```

Evaluation points: Identifies that initialising max to 0 is wrong when all values are negative; Initialises max with numbers[0] (or int.MinValue); Keeps the rest of the loop logic correct; Correctly returns -2 for { -5, -2, -8 }

**7. PRG-CSHARP-S1-07** · Classes, Properties & Constructors · write_code · Medium · ~5 min

Write a C# class `BankAccount` with:
- a read-only property `Owner` (string) and a property `Balance` (decimal) that can be read publicly but only changed inside the class;
- a constructor `BankAccount(string owner, decimal initialBalance)` that throws ArgumentException if initialBalance is negative;
- `void Deposit(decimal amount)` that throws ArgumentException if amount <= 0, otherwise adds it to Balance;
- `bool Withdraw(decimal amount)` that returns false (and changes nothing) if amount <= 0 or amount > Balance, otherwise subtracts it and returns true.

Reference solution:

```
public class BankAccount
{
    public string Owner { get; }
    public decimal Balance { get; private set; }

    public BankAccount(string owner, decimal initialBalance)
    {
        if (initialBalance < 0)
            throw new ArgumentException("Initial balance cannot be negative.");
        Owner = owner;
        Balance = initialBalance;
    }

    public void Deposit(decimal amount)
    {
        if (amount <= 0)
            throw new ArgumentException("Deposit amount must be positive.");
        Balance += amount;
    }

    public bool Withdraw(decimal amount)
    {
        if (amount <= 0 || amount > Balance)
            return false;
        Balance -= amount;
        return true;
    }
}
```

Evaluation points: Balance has a public getter and a private setter; Owner is get-only; Constructor validates initialBalance and assigns both properties; Deposit throws ArgumentException for non-positive amounts; Withdraw returns false without modifying Balance when the amount is invalid or exceeds Balance; Uses decimal for money

**8. PRG-CSHARP-S1-08** · LINQ Basics · write_code · Medium · ~4 min

Given the class below, write a C# method `static List<string> NamesAtOrAbove(List<Product> products, decimal minPrice)` that uses LINQ to return the names of all products whose Price is greater than or equal to minPrice, ordered by Price ascending and then by Name ascending for equal prices. Return an empty list if nothing matches.

public class Product { public string Name { get; set; } public decimal Price { get; set; } }

Reference solution:

```
static List<string> NamesAtOrAbove(List<Product> products, decimal minPrice)
{
    return products
        .Where(p => p.Price >= minPrice)
        .OrderBy(p => p.Price)
        .ThenBy(p => p.Name)
        .Select(p => p.Name)
        .ToList();
}
```

Evaluation points: Filters with Where using >= (inclusive); Orders by Price then by Name (OrderBy + ThenBy, not two OrderBy calls); Projects to names with Select and materialises with ToList; Returns an empty list (not null) when nothing matches

**9. PRG-CSHARP-S1-09** · Recursion · write_code · Hard · ~6 min

Write a recursive C# method `static List<string> Permutations(string s)` that returns every permutation of the characters in s. All characters in s are distinct and 1 <= s.Length <= 6. The order of the returned strings does not matter, but each permutation must appear exactly once.

Reference solution:

```
static List<string> Permutations(string s)
{
    var result = new List<string>();
    Build("", s, result);
    return result;
}

static void Build(string prefix, string remaining, List<string> result)
{
    if (remaining.Length == 0)
    {
        result.Add(prefix);
        return;
    }
    for (int i = 0; i < remaining.Length; i++)
    {
        Build(prefix + remaining[i], remaining.Remove(i, 1), result);
    }
}
```

Evaluation points: Has a correct base case (no characters left -> add the built string); Recursive step picks each remaining character once and recurses on the rest; Produces n! results with no duplicates or missing permutations; Accumulates results in a list (helper method or returned lists)

**10. PRG-CSHARP-S1-10** · Methods (out parameters) · write_code · Hard · ~5 min

Write a C# method `static bool TryParseTime(string s, out int totalMinutes)` that parses a 24-hour time in the exact format "HH:MM" (two digits, a colon, two digits). If s is valid (hours 00-23, minutes 00-59) set totalMinutes to the number of minutes since midnight and return true. Otherwise set totalMinutes to 0 and return false. Null, wrong length, missing colon or non-digit characters are invalid. Do not throw exceptions.

Reference solution:

```
static bool TryParseTime(string s, out int totalMinutes)
{
    totalMinutes = 0;
    if (s == null || s.Length != 5 || s[2] != ':')
        return false;
    if (!char.IsDigit(s[0]) || !char.IsDigit(s[1]) || !char.IsDigit(s[3]) || !char.IsDigit(s[4]))
        return false;

    int hours = int.Parse(s.Substring(0, 2));
    int minutes = int.Parse(s.Substring(3, 2));
    if (hours > 23 || minutes > 59)
        return false;

    totalMinutes = hours * 60 + minutes;
    return true;
}
```

Evaluation points: Assigns the out parameter on every path (required by the compiler); Validates null, length 5, colon position and digit characters before parsing; Rejects hours > 23 and minutes > 59; Computes hours * 60 + minutes and never throws

### C# – Set 2

**1. PRG-CSHARP-S2-01** · Strings · write_code · Easy · ~3 min

Write a C# method `static int CountVowels(string s)` that returns how many vowels (a, e, i, o, u, in upper or lower case) appear in s.

Reference solution:

```
static int CountVowels(string s)
{
    int count = 0;
    foreach (char c in s.ToLower())
    {
        if ("aeiou".IndexOf(c) >= 0)
            count++;
    }
    return count;
}
```

Evaluation points: Iterates over every character; Treats upper and lower case vowels the same; Counts only a, e, i, o, u (not y); Returns 0 when there are no vowels

**2. PRG-CSHARP-S2-02** · Null Handling · explain_output · Easy · ~3 min

What does the following C# program print? Explain what the ?. and ?? operators do on each line.

Given code:

```
using System;

class Address { public string City; }
class Customer { public string Name; public Address Address; }

class Program
{
    static void Main()
    {
        Customer c1 = new Customer { Name = "Ravi" };
        Customer c2 = null;

        Console.WriteLine(c1.Address?.City ?? "No city");
        Console.WriteLine(c2?.Name ?? "No customer");

        int? length = c1.Name?.Length;
        Console.WriteLine(length);

        string s = null;
        Console.WriteLine($"[{s}]");
    }
}
```

Reference solution:

```
Output:
No city
No customer
4
[]

Explanation: c1.Address was never set, so it is null; `c1.Address?.City` short-circuits to null instead of throwing NullReferenceException, and `?? "No city"` replaces the null. c2 is null, so `c2?.Name` is null and "No customer" is printed. c1.Name is "Ravi", so `c1.Name?.Length` evaluates to an int? holding 4. A null string inside an interpolated string is formatted as an empty string, giving "[]".
```

Evaluation points: States the exact four output lines: No city, No customer, 4, []; Explains ?. returns null instead of throwing when the left side is null; Explains ?? supplies the right-hand value when the left side is null; Explains that c1.Name?.Length gives an int? with value 4, and a null string interpolates as empty text

**3. PRG-CSHARP-S2-03** · Arrays · write_code · Easy · ~3 min

Write a C# method `static void ReverseInPlace(int[] arr)` that reverses the elements of arr in place (the same array object is modified). Do not use Array.Reverse, LINQ or a second array.

Reference solution:

```
static void ReverseInPlace(int[] arr)
{
    int left = 0, right = arr.Length - 1;
    while (left < right)
    {
        int temp = arr[left];
        arr[left] = arr[right];
        arr[right] = temp;
        left++;
        right--;
    }
}
```

Evaluation points: Swaps elements from both ends moving inwards; Stops at the middle (does not swap back); Uses no extra array, Array.Reverse or LINQ; Works for empty and even/odd length arrays

**4. PRG-CSHARP-S2-04** · List<T> · write_code · Medium · ~4 min

Write a C# method `static List<string> RemoveDuplicates(List<string> items)` that returns a new list containing each distinct string from items once, keeping the order of first appearance. Comparison is case-sensitive. Do not modify the input list and do not use LINQ's Distinct.

Reference solution:

```
static List<string> RemoveDuplicates(List<string> items)
{
    var seen = new HashSet<string>();
    var result = new List<string>();
    foreach (string item in items)
    {
        if (seen.Add(item))
            result.Add(item);
    }
    return result;
}
```

Evaluation points: Returns a new list and leaves the input unchanged; Keeps first-occurrence order; Uses a HashSet (or equivalent) for efficient lookups rather than nested loops (preferred, not mandatory); Handles an empty list

**5. PRG-CSHARP-S2-05** · Inheritance & Polymorphism · fix_bug · Medium · ~4 min

In the code below, `Shape s = new Rectangle(3, 4); Console.WriteLine(s.Area());` prints 0 instead of 12. Find the bug, explain why it happens, and provide the corrected code.

Given code:

```
public class Shape
{
    public virtual double Area() { return 0; }
}

public class Rectangle : Shape
{
    private double width, height;
    public Rectangle(double w, double h) { width = w; height = h; }

    public new double Area() { return width * height; }
}
```

Reference solution:

```
public class Shape
{
    public virtual double Area() { return 0; }
}

public class Rectangle : Shape
{
    private double width, height;
    public Rectangle(double w, double h) { width = w; height = h; }

    // fix: 'override' instead of 'new', so the call is dispatched at runtime
    public override double Area() { return width * height; }
}
```

Evaluation points: Identifies that `new` hides the base method instead of overriding it; Explains that with `new`, a call through a Shape reference uses Shape.Area; Replaces `new` with `override`; Result through the base-class reference is 12

**6. PRG-CSHARP-S2-06** · Loops · write_code · Medium · ~4 min

Write a C# method `static bool IsPrime(int n)` that returns true if n is a prime number and false otherwise. Numbers less than 2 are not prime. Your loop should only test divisors up to the square root of n.

Reference solution:

```
static bool IsPrime(int n)
{
    if (n < 2) return false;
    for (int i = 2; (long)i * i <= n; i++)
    {
        if (n % i == 0)
            return false;
    }
    return true;
}
```

Evaluation points: Returns false for n < 2 (including 0, 1 and negatives); Loops only while i * i <= n (or i <= Math.Sqrt(n)); Returns false as soon as a divisor is found; Correctly treats 2 as prime and perfect squares such as 49 as not prime

**7. PRG-CSHARP-S2-07** · Exceptions · write_code · Medium · ~4 min

Write a C# method `static decimal DiscountedPrice(decimal price, int percent)` that returns price reduced by percent percent. Throw ArgumentException if price is negative, and ArgumentOutOfRangeException if percent is less than 0 or greater than 100. Include a meaningful message (and the parameter name) in each exception.

Reference solution:

```
static decimal DiscountedPrice(decimal price, int percent)
{
    if (price < 0)
        throw new ArgumentException("Price cannot be negative.", nameof(price));
    if (percent < 0 || percent > 100)
        throw new ArgumentOutOfRangeException(nameof(percent), "Percent must be between 0 and 100.");
    return price - price * percent / 100;
}
```

Evaluation points: Validates inputs before computing; Throws ArgumentException for negative price and ArgumentOutOfRangeException for percent outside 0-100; Uses the correct constructor argument order (ArgumentOutOfRangeException takes paramName first); Computes the discount with decimal arithmetic (no integer division issues)

**8. PRG-CSHARP-S2-08** · Strings & StringBuilder · write_code · Medium · ~5 min

Write a C# method `static string RunLengthEncode(string s)` that compresses s by replacing each run of identical consecutive characters with the character followed by the run length. For example "aaabcc" becomes "a3b1c2". An empty string returns an empty string. Build the result with StringBuilder.

Reference solution:

```
static string RunLengthEncode(string s)
{
    var sb = new StringBuilder();
    int i = 0;
    while (i < s.Length)
    {
        char current = s[i];
        int count = 0;
        while (i < s.Length && s[i] == current)
        {
            count++;
            i++;
        }
        sb.Append(current).Append(count);
    }
    return sb.ToString();
}
```

Evaluation points: Counts consecutive runs correctly, including the final run; Appends character then count for every run (including count 1); Uses StringBuilder instead of repeated string concatenation; Returns an empty string for empty input without index errors

**9. PRG-CSHARP-S2-09** · Dictionary<TKey,TValue> · write_code · Hard · ~6 min

Write a C# method `static List<List<string>> GroupAnagrams(List<string> words)` that groups words that are anagrams of each other (same letters in a different order). All words are lower case. Groups must appear in the order their first word appears in the input, and words inside a group keep their input order.

Reference solution:

```
static List<List<string>> GroupAnagrams(List<string> words)
{
    var groups = new Dictionary<string, List<string>>();
    var result = new List<List<string>>();
    foreach (string word in words)
    {
        char[] letters = word.ToCharArray();
        Array.Sort(letters);
        string key = new string(letters);

        if (!groups.TryGetValue(key, out List<string> group))
        {
            group = new List<string>();
            groups[key] = group;
            result.Add(group);
        }
        group.Add(word);
    }
    return result;
}
```

Evaluation points: Builds a canonical key per word (sorted letters or a letter count); Uses a Dictionary from key to list of words; Preserves the order of groups by first appearance and the order of words within a group; Handles an empty input list (returns an empty list)

**10. PRG-CSHARP-S2-10** · Collections (Stack) · write_code · Hard · ~6 min

Write a C# method `static bool IsBalanced(string s)` that returns true if every bracket in s is correctly matched and nested. The bracket pairs are (), [] and {}. All other characters are ignored. Use a Stack<char>.

Reference solution:

```
static bool IsBalanced(string s)
{
    var stack = new Stack<char>();
    foreach (char c in s)
    {
        if (c == '(' || c == '[' || c == '{')
        {
            stack.Push(c);
        }
        else if (c == ')' || c == ']' || c == '}')
        {
            if (stack.Count == 0) return false;
            char open = stack.Pop();
            if ((c == ')' && open != '(') || (c == ']' && open != '[') || (c == '}' && open != '{'))
                return false;
        }
    }
    return stack.Count == 0;
}
```

Evaluation points: Pushes opening brackets and pops on closing brackets; Returns false when a closing bracket arrives with an empty stack; Checks that the popped bracket matches the closing type; Returns false if unclosed brackets remain at the end; Ignores non-bracket characters

### C# – Set 3

**1. PRG-CSHARP-S3-01** · Conditionals · write_code · Easy · ~3 min

Write a C# method `static string GetGrade(int score)` that converts an exam score (0-100) into a letter grade: 90 and above "A", 80-89 "B", 70-79 "C", 60-69 "D", below 60 "F". Throw ArgumentOutOfRangeException if score is less than 0 or greater than 100.

Reference solution:

```
static string GetGrade(int score)
{
    if (score < 0 || score > 100)
        throw new ArgumentOutOfRangeException(nameof(score), "Score must be between 0 and 100.");
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
}
```

Evaluation points: Validates the range first and throws ArgumentOutOfRangeException; Checks thresholds from highest to lowest so each score maps to one grade; Boundary values (90, 80, 70, 60) map to the higher grade; Returns "F" for scores below 60

**2. PRG-CSHARP-S3-02** · String Interpolation · explain_output · Easy · ~3 min

What does the following C# program print? Explain the format specifier, alignment and brace syntax used in each interpolated string.

Given code:

```
using System;

class Program
{
    static void Main()
    {
        string item = "Laptop";
        int qty = 3;
        int id = 7;

        Console.WriteLine($"Order {id:D4}: {qty} x {item}");
        Console.WriteLine($"{qty} item{(qty == 1 ? "" : "s")}");
        Console.WriteLine($"[{item,8}]");
        Console.WriteLine($"[{item,-8}]");
        Console.WriteLine($"{{{qty * 2}}}");
    }
}
```

Reference solution:

```
Output:
Order 0007: 3 x Laptop
3 items
[  Laptop]
[Laptop  ]
{6}

Explanation: {id:D4} formats 7 as a 4-digit integer with leading zeros (0007). The ternary operator is placed in parentheses so the colon is not read as a format specifier; qty is 3 so "s" is appended. {item,8} right-aligns "Laptop" (6 chars) in a field of 8, adding two leading spaces; {item,-8} left-aligns it, adding two trailing spaces. In the last line {{ and }} are escaped literal braces and the inner {qty * 2} evaluates to 6, producing {6}.
```

Evaluation points: States all five output lines exactly, including padding; Explains :D4 pads an integer with leading zeros to 4 digits; Explains the conditional expression must be wrapped in parentheses inside the braces; Explains ,8 right-aligns and ,-8 left-aligns within 8 characters; Explains {{ and }} produce literal braces

**3. PRG-CSHARP-S3-03** · Loops · write_code · Easy · ~3 min

Write a C# method `static long Factorial(int n)` that returns n! using a loop (not recursion). 0! is 1. Throw ArgumentOutOfRangeException if n is negative or greater than 20 (21! does not fit in a long).

Reference solution:

```
static long Factorial(int n)
{
    if (n < 0 || n > 20)
        throw new ArgumentOutOfRangeException(nameof(n), "n must be between 0 and 20.");
    long result = 1;
    for (int i = 2; i <= n; i++)
        result *= i;
    return result;
}
```

Evaluation points: Uses long for the accumulator; Returns 1 for n = 0; Iterative loop multiplies 1..n (or 2..n); Throws ArgumentOutOfRangeException for n < 0 or n > 20

**4. PRG-CSHARP-S3-04** · Static Members · write_code · Medium · ~4 min

Write a C# class `Ticket` for a support desk. Each new Ticket must automatically receive a unique sequential integer `Id` starting at 1 (first ticket 1, second 2, ...). It has a read-only `Title` property set through the constructor `Ticket(string title)`. Also expose a static read-only property `Count` returning how many Ticket objects have been created so far.

Reference solution:

```
public class Ticket
{
    private static int nextId = 1;

    public static int Count { get; private set; }

    public int Id { get; }
    public string Title { get; }

    public Ticket(string title)
    {
        Id = nextId++;
        Title = title;
        Count++;
    }
}
```

Evaluation points: Uses a static field to hold the next id, shared by all instances; Assigns Id in the constructor and then increments the counter; Id and Title are instance properties that cannot be changed from outside; Count is static with a private setter (or computed from the static field)

**5. PRG-CSHARP-S3-05** · Strings · fix_bug · Medium · ~4 min

The method below should reverse the order of the words in a sentence (words are separated by single spaces), e.g. "one two three" -> "three two one". It gives wrong results. Find the bug, explain it, and provide the corrected method.

Given code:

```
static string ReverseWords(string sentence)
{
    string[] words = sentence.Split(' ');
    string result = "";
    for (int i = words.Length - 1; i > 0; i--)
    {
        result += words[i] + " ";
    }
    return result.Trim();
}
```

Reference solution:

```
static string ReverseWords(string sentence)
{
    string[] words = sentence.Split(' ');
    string result = "";
    for (int i = words.Length - 1; i >= 0; i--)   // fix: >= 0 so the first word is included
    {
        result += words[i] + " ";
    }
    return result.Trim();
}
```

Evaluation points: Identifies the loop condition `i > 0` skips index 0 (the first word); Changes the condition to `i >= 0`; Single-word input now returns the word instead of an empty string; Optionally mentions StringBuilder or string.Join(" ", words.Reverse()) as cleaner alternatives

**6. PRG-CSHARP-S3-06** · Arrays & Nullable Types · write_code · Medium · ~5 min

Write a C# method `static int? SecondLargest(int[] nums)` that returns the second largest DISTINCT value in nums, or null if the array has fewer than two distinct values. Use a single pass through the array; do not sort.

Reference solution:

```
static int? SecondLargest(int[] nums)
{
    int? first = null, second = null;
    foreach (int n in nums)
    {
        if (first == null || n > first)
        {
            second = first;
            first = n;
        }
        else if (n != first && (second == null || n > second))
        {
            second = n;
        }
    }
    return second;
}
```

Evaluation points: Returns int? and uses null to signal no answer; Tracks largest and second largest in one pass; Ignores duplicates of the largest value (distinct requirement); Handles negative numbers (does not initialise with 0); Returns null for empty arrays or all-equal values

**7. PRG-CSHARP-S3-07** · Methods (ref parameters) · write_code · Medium · ~4 min

Write a C# method `static void NormalizeTime(ref int hours, ref int minutes)` that normalises a time value in place: minutes of 60 or more are carried into hours, so minutes ends up in 0-59, and hours wraps around a 24-hour clock (0-23). Both inputs are non-negative. For example hours = 1, minutes = 135 becomes hours = 3, minutes = 15.

Reference solution:

```
static void NormalizeTime(ref int hours, ref int minutes)
{
    hours += minutes / 60;
    minutes %= 60;
    hours %= 24;
}
```

Evaluation points: Uses ref parameters so the caller's variables change; Carries minutes / 60 into hours before reducing minutes with % 60; Wraps hours with % 24; Leaves already-normal values unchanged

**8. PRG-CSHARP-S3-08** · LINQ Basics · write_code · Medium · ~4 min

Given the class below, write a C# method `static Dictionary<string, int> HeadcountByDepartment(List<Employee> employees)` that uses LINQ GroupBy to return a dictionary mapping each department name to the number of employees in it. An empty list returns an empty dictionary.

public class Employee { public string Name { get; set; } public string Department { get; set; } }

Reference solution:

```
static Dictionary<string, int> HeadcountByDepartment(List<Employee> employees)
{
    return employees
        .GroupBy(e => e.Department)
        .ToDictionary(g => g.Key, g => g.Count());
}
```

Evaluation points: Groups by Department using GroupBy; Uses the group Key as dictionary key and Count() as value; Converts to a Dictionary with ToDictionary; Works for an empty list

**9. PRG-CSHARP-S3-09** · Recursion · write_code · Hard · ~6 min

A staircase has n steps and you can climb either 1 or 2 steps at a time. Write a recursive C# method `static long CountWays(int n)` that returns the number of distinct ways to reach the top. Use memoisation (e.g. a Dictionary<int, long>) so that n up to 80 runs instantly. Treat n = 0 and n = 1 as 1 way.

Reference solution:

```
static Dictionary<int, long> memo = new Dictionary<int, long>();

static long CountWays(int n)
{
    if (n <= 1) return 1;
    if (memo.TryGetValue(n, out long cached)) return cached;

    long ways = CountWays(n - 1) + CountWays(n - 2);
    memo[n] = ways;
    return ways;
}
```

Evaluation points: Correct base cases for n = 0 and n = 1; Recurrence ways(n) = ways(n-1) + ways(n-2); Stores and reuses computed results (memoisation) to avoid exponential time; Uses long to avoid overflow for large n

**10. PRG-CSHARP-S3-10** · Arrays · write_code · Hard · ~5 min

Write a C# method `static int[] MergeSorted(int[] a, int[] b)` that merges two arrays already sorted in ascending order into a new sorted array containing all elements of both (duplicates kept). Do not call Array.Sort, LINQ or any other sorting method; use a single pass with two indexes.

Reference solution:

```
static int[] MergeSorted(int[] a, int[] b)
{
    int[] result = new int[a.Length + b.Length];
    int i = 0, j = 0, k = 0;
    while (i < a.Length && j < b.Length)
    {
        if (a[i] <= b[j]) result[k++] = a[i++];
        else result[k++] = b[j++];
    }
    while (i < a.Length) result[k++] = a[i++];
    while (j < b.Length) result[k++] = b[j++];
    return result;
}
```

Evaluation points: Allocates a result array of length a.Length + b.Length; Compares the current elements of both arrays and takes the smaller; Copies the remaining elements of whichever array is not exhausted; Handles empty arrays and duplicate values; Does not use a sorting method

### C# – Set 4

**1. PRG-CSHARP-S4-01** · Conditionals · write_code · Easy · ~3 min

Write a C# method `static bool IsLeapYear(int year)` that returns true if year is a leap year in the Gregorian calendar: divisible by 4, except years divisible by 100, unless they are also divisible by 400. Do not use DateTime.IsLeapYear.

Reference solution:

```
static bool IsLeapYear(int year)
{
    if (year % 400 == 0) return true;
    if (year % 100 == 0) return false;
    return year % 4 == 0;
}
```

Evaluation points: Applies the divisible-by-400 rule; Applies the divisible-by-100 exception; Applies the divisible-by-4 rule; Rules are ordered/combined so 1900 is false and 2000 is true

**2. PRG-CSHARP-S4-02** · Loops · explain_output · Easy · ~3 min

What does the following C# program print? Explain how continue and break affect the nested loops and how the while loop ends.

Given code:

```
using System;

class Program
{
    static void Main()
    {
        for (int i = 1; i <= 3; i++)
        {
            for (int j = 1; j <= 3; j++)
            {
                if (j == 2) continue;
                if (i == 3) break;
                Console.Write(i * 10 + j + " ");
            }
        }
        Console.WriteLine();

        int k = 0;
        while (k < 10)
        {
            k += 4;
        }
        Console.WriteLine(k);
    }
}
```

Reference solution:

```
Output:
11 13 21 23
12

Explanation: For i = 1 and i = 2 the inner loop prints j = 1 and j = 3; j = 2 is skipped by continue, which moves to the next iteration of the inner loop only. The expression i * 10 + j is evaluated numerically first (left to right) and then the space is appended, so values such as 11 and 13 are printed. When i = 3, j = 1 reaches break, which exits only the inner loop; the outer loop then ends because i becomes 4. The while loop adds 4 each time (4, 8, 12) and stops when k is no longer less than 10, so it prints 12.
```

Evaluation points: States the output: first line `11 13 21 23 ` and second line `12`; Explains continue skips j == 2 but the inner loop keeps going; Explains break (when i == 3) exits only the inner loop; Explains i * 10 + j is added as numbers before being concatenated with " "; Explains k becomes 4, 8, 12 and the loop stops once k >= 10

**3. PRG-CSHARP-S4-03** · List<T> · write_code · Easy · ~3 min

Write a C# method `static int CountOccurrences(List<string> items, string target)` that returns how many elements of items equal target, ignoring case. Null elements in the list must be skipped without throwing. Use a loop (no LINQ).

Reference solution:

```
static int CountOccurrences(List<string> items, string target)
{
    int count = 0;
    foreach (string item in items)
    {
        if (item != null && string.Equals(item, target, StringComparison.OrdinalIgnoreCase))
            count++;
    }
    return count;
}
```

Evaluation points: Loops over the list and counts matches; Comparison ignores case (StringComparison.OrdinalIgnoreCase or equivalent); Does not throw on null elements (avoids item.ToLower() on null); Returns 0 for an empty list

**4. PRG-CSHARP-S4-04** · Dictionary<TKey,TValue> · fix_bug · Medium · ~4 min

The method below should count how many times each letter appears in text (non-letters are ignored, case-sensitive), but it throws an exception at runtime. Identify the exception, explain why it occurs, and provide the corrected method.

Given code:

```
static Dictionary<char, int> CountLetters(string text)
{
    var counts = new Dictionary<char, int>();
    foreach (char c in text)
    {
        if (char.IsLetter(c))
        {
            counts[c]++;
        }
    }
    return counts;
}
```

Reference solution:

```
static Dictionary<char, int> CountLetters(string text)
{
    var counts = new Dictionary<char, int>();
    foreach (char c in text)
    {
        if (char.IsLetter(c))
        {
            // fix: a missing key cannot be read, so read it safely first
            counts.TryGetValue(c, out int current);
            counts[c] = current + 1;
        }
    }
    return counts;
}
```

Evaluation points: Identifies KeyNotFoundException; Explains that counts[c]++ reads the key before writing it, and the key does not exist the first time; Fixes with TryGetValue, ContainsKey check, or initialising the key to 0; The corrected method returns correct counts

**5. PRG-CSHARP-S4-05** · Abstract Classes & Inheritance · write_code · Medium · ~5 min

Write an abstract C# class `Employee` with a read-only `Name` property set by a protected constructor and an abstract method `decimal MonthlyPay()`. Then write two subclasses:
- `SalariedEmployee(string name, decimal annualSalary)` whose monthly pay is annualSalary / 12;
- `HourlyEmployee(string name, decimal hourlyRate, int hoursWorked)` whose monthly pay is hourlyRate * hoursWorked.

Reference solution:

```
public abstract class Employee
{
    public string Name { get; }

    protected Employee(string name)
    {
        Name = name;
    }

    public abstract decimal MonthlyPay();
}

public class SalariedEmployee : Employee
{
    private readonly decimal annualSalary;

    public SalariedEmployee(string name, decimal annualSalary) : base(name)
    {
        this.annualSalary = annualSalary;
    }

    public override decimal MonthlyPay() => annualSalary / 12;
}

public class HourlyEmployee : Employee
{
    private readonly decimal hourlyRate;
    private readonly int hoursWorked;

    public HourlyEmployee(string name, decimal hourlyRate, int hoursWorked) : base(name)
    {
        this.hourlyRate = hourlyRate;
        this.hoursWorked = hoursWorked;
    }

    public override decimal MonthlyPay() => hourlyRate * hoursWorked;
}
```

Evaluation points: Employee is abstract with an abstract MonthlyPay method; Subclasses call the base constructor with : base(name); Subclasses use override and implement the correct formulas; Uses decimal for money values; Objects can be used polymorphically through an Employee reference

**6. PRG-CSHARP-S4-06** · Strings & StringBuilder · write_code · Medium · ~4 min

Write a C# method `static string CapitalizeWords(string s)` that returns s with the first letter of every word in upper case and all other letters in lower case. Words are separated by spaces; keep all spaces exactly as they are (including multiple or leading spaces). Use StringBuilder.

Reference solution:

```
static string CapitalizeWords(string s)
{
    var sb = new StringBuilder(s.Length);
    bool startOfWord = true;
    foreach (char c in s)
    {
        if (c == ' ')
        {
            sb.Append(c);
            startOfWord = true;
        }
        else
        {
            sb.Append(startOfWord ? char.ToUpper(c) : char.ToLower(c));
            startOfWord = false;
        }
    }
    return sb.ToString();
}
```

Evaluation points: Upper-cases the first character after a space or at the start; Lower-cases the remaining characters of each word; Preserves the original spacing (does not Split and Join with single spaces); Uses StringBuilder and handles an empty string

**7. PRG-CSHARP-S4-07** · Exceptions · explain_output · Medium · ~4 min

What does the following C# program print? Explain the order in which the try, catch and finally blocks run, including when a return statement is inside try or catch.

Given code:

```
using System;

class Program
{
    static int Divide(int a, int b)
    {
        try
        {
            Console.WriteLine("Start");
            return a / b;
        }
        catch (DivideByZeroException)
        {
            Console.WriteLine("Cannot divide by zero");
            return -1;
        }
        finally
        {
            Console.WriteLine("Finally");
        }
    }

    static void Main()
    {
        Console.WriteLine(Divide(10, 2));
        Console.WriteLine(Divide(1, 0));
    }
}
```

Reference solution:

```
Output:
Start
Finally
5
Start
Cannot divide by zero
Finally
-1

Explanation: In the first call, try prints "Start" and evaluates a / b = 5 for the return; before control leaves the method, finally prints "Finally"; then Main prints the returned 5. In the second call, 1 / 0 with integers throws DivideByZeroException, so the catch block prints its message and prepares to return -1; finally again runs before the method returns, and then Main prints -1.
```

Evaluation points: States the exact output (seven lines, in order); Explains finally always runs, even after return; Explains the return value is computed before finally runs but is printed by Main afterwards; Explains integer division by zero throws DivideByZeroException which is caught and returns -1

**8. PRG-CSHARP-S4-08** · Loops & StringBuilder · write_code · Medium · ~4 min

Write a C# method `static string FizzBuzzLine(int n)` that returns the numbers from 1 to n separated by single spaces, where multiples of 3 are replaced by "Fizz", multiples of 5 by "Buzz", and multiples of both by "FizzBuzz". There must be no leading or trailing space. Use StringBuilder. Assume n >= 1.

Reference solution:

```
static string FizzBuzzLine(int n)
{
    var sb = new StringBuilder();
    for (int i = 1; i <= n; i++)
    {
        if (i > 1) sb.Append(' ');
        if (i % 15 == 0) sb.Append("FizzBuzz");
        else if (i % 3 == 0) sb.Append("Fizz");
        else if (i % 5 == 0) sb.Append("Buzz");
        else sb.Append(i);
    }
    return sb.ToString();
}
```

Evaluation points: Checks the multiple-of-15 case before 3 and 5; Loops from 1 to n inclusive; Separates items with single spaces and no trailing space; Uses StringBuilder rather than repeated string concatenation

**9. PRG-CSHARP-S4-09** · LINQ Basics · write_code · Hard · ~6 min

Given the class below, write a C# method `static List<string> TopCustomers(List<Order> orders, int n)` that uses LINQ to return the names of the n customers with the highest total order Amount. Sort by total descending; when totals are equal, sort by customer name ascending. If there are fewer than n customers, return all of them.

public class Order { public string Customer { get; set; } public decimal Amount { get; set; } }

Reference solution:

```
static List<string> TopCustomers(List<Order> orders, int n)
{
    return orders
        .GroupBy(o => o.Customer)
        .Select(g => new { Customer = g.Key, Total = g.Sum(o => o.Amount) })
        .OrderByDescending(x => x.Total)
        .ThenBy(x => x.Customer)
        .Take(n)
        .Select(x => x.Customer)
        .ToList();
}
```

Evaluation points: Groups orders by customer and sums Amount per group; Orders by total descending then by name ascending (OrderByDescending + ThenBy); Uses Take(n) so fewer than n customers is handled naturally; Returns only customer names as a List<string>

**10. PRG-CSHARP-S4-10** · Classes & Collections · write_code · Hard · ~6 min

Write a C# class `Inventory` that tracks stock quantities by item name using a private Dictionary<string, int>. It must provide:
- `void Add(string item, int quantity)`: increases the stock; throws ArgumentException if quantity <= 0;
- `void Remove(string item, int quantity)`: decreases the stock; throws ArgumentException if quantity <= 0 and InvalidOperationException if there is not enough stock; when stock reaches 0 the item is removed from the dictionary;
- `int GetQuantity(string item)`: returns the current stock, or 0 for unknown items;
- a read-only property `int DistinctItems` returning how many different items are in stock.

Reference solution:

```
public class Inventory
{
    private readonly Dictionary<string, int> stock = new Dictionary<string, int>();

    public int DistinctItems => stock.Count;

    public void Add(string item, int quantity)
    {
        if (quantity <= 0) throw new ArgumentException("Quantity must be positive.", nameof(quantity));
        stock[item] = GetQuantity(item) + quantity;
    }

    public void Remove(string item, int quantity)
    {
        if (quantity <= 0) throw new ArgumentException("Quantity must be positive.", nameof(quantity));
        int current = GetQuantity(item);
        if (quantity > current) throw new InvalidOperationException("Insufficient stock for " + item);

        if (current == quantity) stock.Remove(item);
        else stock[item] = current - quantity;
    }

    public int GetQuantity(string item)
    {
        return stock.TryGetValue(item, out int qty) ? qty : 0;
    }
}
```

Evaluation points: Dictionary field is private (encapsulation); Add creates or increases an entry without KeyNotFoundException; Remove validates quantity and stock before changing anything, and removes the key at zero; Throws the specified exception types; GetQuantity returns 0 for unknown items; DistinctItems reflects the dictionary count

### C# – Set 5

**1. PRG-CSHARP-S5-01** · Strings · write_code · Easy · ~3 min

Write a C# method `static string Initials(string fullName)` that returns the upper-case initials of each word followed by a dot, e.g. "john ronald tolkien" -> "J.R.T.". Ignore extra spaces anywhere in the input. An empty or all-space string returns "".

Reference solution:

```
static string Initials(string fullName)
{
    string[] parts = fullName.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
    string result = "";
    foreach (string part in parts)
    {
        result += char.ToUpper(part[0]) + ".";
    }
    return result;
}
```

Evaluation points: Splits into words and removes empty entries; Takes the first character of each word and upper-cases it; Appends a dot after each initial; Returns an empty string for empty or whitespace-only input

**2. PRG-CSHARP-S5-02** · Arrays · write_code · Easy · ~3 min

Write a C# method `static int[] RunningTotal(int[] values)` that returns a new array where element i is the sum of values[0] through values[i]. The input array must not be modified. An empty input returns an empty array.

Reference solution:

```
static int[] RunningTotal(int[] values)
{
    int[] result = new int[values.Length];
    int sum = 0;
    for (int i = 0; i < values.Length; i++)
    {
        sum += values[i];
        result[i] = sum;
    }
    return result;
}
```

Evaluation points: Creates a new array of the same length; Keeps a running sum and stores it at each index; Does not modify the input array; Handles empty arrays and negative numbers

**3. PRG-CSHARP-S5-03** · Methods & Parameter Passing · explain_output · Easy · ~3 min

What does the following C# program print? Explain what happens to each of the three arguments inside Update.

Given code:

```
using System;

class Program
{
    static void Update(int number, int[] values, ref int counter)
    {
        number = 100;
        values[0] = 100;
        counter++;
        values = new int[] { 7, 7, 7 };
    }

    static void Main()
    {
        int n = 1;
        int[] arr = { 1, 2, 3 };
        int c = 0;

        Update(n, arr, ref c);

        Console.WriteLine(n);
        Console.WriteLine(string.Join(",", arr));
        Console.WriteLine(c);
    }
}
```

Reference solution:

```
Output:
1
100,2,3
1

Explanation: number is an int passed by value, so the method works on a copy and n stays 1. values receives a copy of the reference to the same array object, so values[0] = 100 modifies the caller's arr; the later `values = new int[] {7,7,7}` only points the local parameter at a new array and does not affect arr, which prints 100,2,3. counter is passed with ref, so counter++ updates the caller's variable c to 1.
```

Evaluation points: States the exact output: 1, then 100,2,3, then 1; Explains int is passed by value, so changing number does not affect n; Explains the array reference is copied, so values[0] = 100 changes the caller's array; Explains that assigning a new array to values only changes the local copy of the reference; Explains ref lets counter++ change c

**4. PRG-CSHARP-S5-04** · Null Handling · write_code · Medium · ~4 min

Given the class below, write a C# method `static string DisplayName(Customer c)` that returns the text to show for a customer: the Nickname if it is not null/empty/whitespace, otherwise the FullName if it is not null/empty/whitespace, otherwise "Guest". If c itself is null, return "Guest". Trim the returned name. Use the null-conditional (?.) and null-coalescing (??) operators where appropriate.

public class Customer { public string FullName { get; set; } public string Nickname { get; set; } }

Reference solution:

```
static string DisplayName(Customer c)
{
    string nick = string.IsNullOrWhiteSpace(c?.Nickname) ? null : c.Nickname.Trim();
    string full = string.IsNullOrWhiteSpace(c?.FullName) ? null : c.FullName.Trim();
    return nick ?? full ?? "Guest";
}
```

Evaluation points: Does not throw when c is null (uses ?. or an explicit null check); Treats empty and whitespace-only strings like null (string.IsNullOrWhiteSpace); Applies the priority Nickname -> FullName -> "Guest" (e.g. with chained ??); Trims the returned value

**5. PRG-CSHARP-S5-05** · Sorting/Searching · fix_bug · Medium · ~5 min

The iterative binary search below should return the index of target in an array sorted in ascending order, or -1 if target is not present. For some inputs it returns -1 even though the value exists (for example searching for 9 in { 1, 3, 5, 7, 9 }). Find the bug, explain it, and provide the corrected method.

Given code:

```
static int BinarySearch(int[] sorted, int target)
{
    int low = 0, high = sorted.Length - 1;
    while (low < high)
    {
        int mid = (low + high) / 2;
        if (sorted[mid] == target) return mid;
        if (sorted[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}
```

Reference solution:

```
static int BinarySearch(int[] sorted, int target)
{
    int low = 0, high = sorted.Length - 1;
    while (low <= high)   // fix: <= so the last remaining element is also checked
    {
        int mid = low + (high - low) / 2;
        if (sorted[mid] == target) return mid;
        if (sorted[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}
```

Evaluation points: Identifies that `low < high` stops before checking the element when low == high; Changes the loop condition to `low <= high`; Keeps low = mid + 1 / high = mid - 1 updates (no infinite loop); Optionally notes low + (high - low) / 2 avoids overflow; Single-element arrays now work

**6. PRG-CSHARP-S5-06** · Interfaces · write_code · Medium · ~5 min

Define a C# interface `IDiscount` with one method `decimal Apply(decimal amount)`. Implement it in two classes:
- `PercentageDiscount(decimal percent)`: reduces the amount by percent percent;
- `FlatDiscount(decimal value)`: subtracts a fixed value, but never returns less than 0.
Then write `public static decimal ApplyAll(decimal amount, List<IDiscount> discounts)` in a static class `Checkout` that applies each discount in list order and returns the final amount.

Reference solution:

```
public interface IDiscount
{
    decimal Apply(decimal amount);
}

public class PercentageDiscount : IDiscount
{
    private readonly decimal percent;
    public PercentageDiscount(decimal percent) { this.percent = percent; }
    public decimal Apply(decimal amount) => amount - amount * percent / 100;
}

public class FlatDiscount : IDiscount
{
    private readonly decimal value;
    public FlatDiscount(decimal value) { this.value = value; }
    public decimal Apply(decimal amount) => Math.Max(0m, amount - value);
}

public static class Checkout
{
    public static decimal ApplyAll(decimal amount, List<IDiscount> discounts)
    {
        foreach (IDiscount d in discounts)
            amount = d.Apply(amount);
        return amount;
    }
}
```

Evaluation points: Declares the interface method without a body and implements it publicly in both classes; PercentageDiscount and FlatDiscount compute correctly; FlatDiscount clamps at 0; ApplyAll depends only on IDiscount (polymorphism) and applies discounts in order; Uses decimal for money

**7. PRG-CSHARP-S5-07** · Dictionary<TKey,TValue> · write_code · Medium · ~4 min

Write a C# method `static char? FirstUniqueChar(string s)` that returns the first character in s that occurs exactly once, or null if every character repeats (or s is empty). The comparison is case-sensitive. Use a Dictionary<char, int> to count characters, then scan the string a second time.

Reference solution:

```
static char? FirstUniqueChar(string s)
{
    var counts = new Dictionary<char, int>();
    foreach (char c in s)
    {
        counts.TryGetValue(c, out int n);
        counts[c] = n + 1;
    }
    foreach (char c in s)
    {
        if (counts[c] == 1)
            return c;
    }
    return null;
}
```

Evaluation points: First pass counts every character in a Dictionary; Second pass iterates over the string (not the dictionary) to respect original order; Returns char? and null when no unique character exists; Case-sensitive ('L' and 'l' are different)

**8. PRG-CSHARP-S5-08** · LINQ Basics · complete_code · Medium · ~4 min

Complete the C# method below by filling in the three lambda expressions marked 1, 2 and 3. The method must return the squares of all odd numbers in the list, sorted from largest to smallest. Negative odd numbers count as odd.

Given code:

```
static List<int> OddSquaresDescending(List<int> numbers)
{
    return numbers
        .Where(/* 1: keep only odd numbers */)
        .Select(/* 2: square each number */)
        .OrderByDescending(/* 3: sort key */)
        .ToList();
}
```

Reference solution:

```
static List<int> OddSquaresDescending(List<int> numbers)
{
    return numbers
        .Where(n => n % 2 != 0)
        .Select(n => n * n)
        .OrderByDescending(sq => sq)
        .ToList();
}
```

Evaluation points: Filter uses n % 2 != 0 (n % 2 == 1 fails for negative odd numbers); Select squares each value; OrderByDescending uses the squared value as the key; Returns an empty list when there are no odd numbers

**9. PRG-CSHARP-S5-09** · Recursion · write_code · Hard · ~6 min

Write a recursive C# method `static List<string> NoConsecutiveOnes(int n)` that returns all binary strings of length n (1 <= n <= 15) that do not contain two adjacent '1' characters, in ascending lexicographic order. For n = 3 the result is ["000", "001", "010", "100", "101"].

Reference solution:

```
static List<string> NoConsecutiveOnes(int n)
{
    var result = new List<string>();
    Generate("", n, result);
    return result;
}

static void Generate(string current, int n, List<string> result)
{
    if (current.Length == n)
    {
        result.Add(current);
        return;
    }
    Generate(current + "0", n, result);
    if (current.Length == 0 || current[current.Length - 1] != '1')
        Generate(current + "1", n, result);
}
```

Evaluation points: Base case adds the string when it reaches length n; Always tries appending '0'; Appends '1' only if the previous character is not '1' (prunes invalid strings instead of filtering afterwards); Trying '0' before '1' yields lexicographic order without sorting

**10. PRG-CSHARP-S5-10** · Arrays (2D) · write_code · Hard · ~6 min

Write a C# method `static int[,] RotateClockwise(int[,] matrix)` that takes an n x n matrix and returns a NEW n x n matrix rotated 90 degrees clockwise. The input must not be modified. For example [[1,2],[3,4]] becomes [[3,1],[4,2]].

Reference solution:

```
static int[,] RotateClockwise(int[,] matrix)
{
    int n = matrix.GetLength(0);
    int[,] result = new int[n, n];
    for (int row = 0; row < n; row++)
    {
        for (int col = 0; col < n; col++)
        {
            result[col, n - 1 - row] = matrix[row, col];
        }
    }
    return result;
}
```

Evaluation points: Uses GetLength(0) to get the size of a rectangular int[,] array; Maps element [row, col] to [col, n - 1 - row]; Writes into a new array and leaves the input unchanged; Works for 1 x 1 and larger matrices

## Java

### Java – Set 1

**1. PRG-JAVA-S1-01** · Variables & Types · write_code · Easy · ~3 min

Write a method `public static double averageOfThree(int a, int b, int c)` that returns the exact average of the three integers as a double. For example averageOfThree(1, 2, 2) must return 1.6666666666666667, not 1.0. Make sure integer division does not truncate the result.

Reference solution:

```
public static double averageOfThree(int a, int b, int c) {
    return (a + b + c) / 3.0;
}
```

Evaluation points: Return type is double; Avoids integer division (divides by 3.0 or casts before dividing); Correct for negative values; Simple one-expression solution; no unnecessary rounding

**2. PRG-JAVA-S1-02** · Variables & Types · explain_output · Easy · ~3 min

The program below mixes int arithmetic, the modulo operator and casting to double. Write down exactly what it prints, line by line, and explain why the second and fourth lines differ.

Given code:

```
public class Main {
    public static void main(String[] args) {
        int a = 7;
        int b = 2;
        System.out.println(a / b);
        System.out.println((double) a / b);
        System.out.println(a % b);
        System.out.println((double) (a / b));
    }
}
```

Reference solution:

```
Output:
3
3.5
1
3.0

Explanation: a / b is integer division (7 / 2 = 3). In (double) a / b the cast applies to a first, so the division is done in floating point: 3.5. a % b is the remainder, 1. In (double) (a / b) the integer division happens first (3) and only the result is converted, giving 3.0.
```

Evaluation points: Gives all four lines exactly: 3, 3.5, 1, 3.0; Explains integer division truncation; Explains that the cast binds before division in line 2 but after it in line 4; Explains % as remainder

**3. PRG-JAVA-S1-03** · Loops · write_code · Easy · ~3 min

Write a method `public static int sumOfDigits(int n)` that returns the sum of the decimal digits of a non-negative integer n using a loop (do not convert the number to a String). Example: sumOfDigits(1234) returns 10.

Reference solution:

```
public static int sumOfDigits(int n) {
    int sum = 0;
    while (n > 0) {
        sum += n % 10;
        n /= 10;
    }
    return sum;
}
```

Evaluation points: Uses % 10 to extract the last digit and / 10 to drop it; Loop terminates correctly; Returns 0 for n = 0; Handles zeros inside the number (e.g. 9005)

**4. PRG-JAVA-S1-04** · Strings · write_code · Medium · ~5 min

Write a method `public static boolean isPalindrome(String s)` that returns true if s reads the same forwards and backwards when you ignore letter case and ignore every character that is not a letter or digit. An empty string counts as a palindrome. Example: "A man, a plan, a canal: Panama" returns true.

Reference solution:

```
public static boolean isPalindrome(String s) {
    int left = 0;
    int right = s.length() - 1;
    while (left < right) {
        char l = s.charAt(left);
        char r = s.charAt(right);
        if (!Character.isLetterOrDigit(l)) {
            left++;
        } else if (!Character.isLetterOrDigit(r)) {
            right--;
        } else {
            if (Character.toLowerCase(l) != Character.toLowerCase(r)) {
                return false;
            }
            left++;
            right--;
        }
    }
    return true;
}
```

Evaluation points: Ignores non letter/digit characters; Case-insensitive comparison; Empty string returns true; Correct loop bounds (no index out of range); Two-pointer or cleaned-string-reverse approach both acceptable

**5. PRG-JAVA-S1-05** · Maps/Dictionaries · write_code · Medium · ~5 min

Write a method `public static char firstNonRepeating(String s)` that returns the first character in s that appears exactly once. If every character repeats (or s is empty), return '_'. Use a HashMap (or LinkedHashMap) to count characters. Example: firstNonRepeating("swiss") returns 'w'.

Reference solution:

```
public static char firstNonRepeating(String s) {
    Map<Character, Integer> counts = new HashMap<>();
    for (char c : s.toCharArray()) {
        counts.put(c, counts.getOrDefault(c, 0) + 1);
    }
    for (char c : s.toCharArray()) {
        if (counts.get(c) == 1) {
            return c;
        }
    }
    return '_';
}
```

Evaluation points: Counts occurrences with a map; Second pass over the string (or insertion-ordered map) to respect original order; Returns '_' when no unique character exists; O(n) time rather than nested loops

**6. PRG-JAVA-S1-06** · Arrays · fix_bug · Medium · ~4 min

The method below should return the largest value in a non-empty int array, but it returns the wrong answer for some inputs (for example when every value is negative). Identify the bug, explain why it happens, and write the corrected method.

Given code:

```
public static int findMax(int[] nums) {
    int max = 0;
    for (int i = 0; i < nums.length; i++) {
        if (nums[i] > max) {
            max = nums[i];
        }
    }
    return max;
}
```

Reference solution:

```
public static int findMax(int[] nums) {
    int max = nums[0];
    for (int i = 1; i < nums.length; i++) {
        if (nums[i] > max) {
            max = nums[i];
        }
    }
    return max;
}
```

Evaluation points: Identifies that initialising max to 0 is wrong when all values are negative; Initialises max to nums[0] (or Integer.MIN_VALUE); Loop still covers every element; Explanation is clear

**7. PRG-JAVA-S1-07** · OOP Basics · write_code · Medium · ~5 min

Write a class `BankAccount` with a private String owner and a private double balance. Provide: a constructor `BankAccount(String owner, double initialBalance)`; `boolean deposit(double amount)` that adds the amount and returns true, or returns false (no change) if amount <= 0; `boolean withdraw(double amount)` that subtracts the amount and returns true, or returns false (no change) if amount <= 0 or amount is greater than the balance; and `double getBalance()`.

Reference solution:

```
class BankAccount {
    private String owner;
    private double balance;

    public BankAccount(String owner, double initialBalance) {
        this.owner = owner;
        this.balance = initialBalance;
    }

    public boolean deposit(double amount) {
        if (amount <= 0) {
            return false;
        }
        balance += amount;
        return true;
    }

    public boolean withdraw(double amount) {
        if (amount <= 0 || amount > balance) {
            return false;
        }
        balance -= amount;
        return true;
    }

    public double getBalance() {
        return balance;
    }
}
```

Evaluation points: Fields are private (encapsulation); Constructor initialises both fields using this.; deposit rejects non-positive amounts; withdraw rejects non-positive amounts and overdrafts without changing the balance; getBalance returns the current balance

**8. PRG-JAVA-S1-08** · Strings · explain_output · Medium · ~4 min

This program compares String objects using == and using equals(). Predict each printed line exactly and explain the difference between comparing references and comparing contents, including what happens with a string created with new String(...).

Given code:

```
public class Main {
    public static void main(String[] args) {
        String s1 = "java";
        String s2 = "java";
        String s3 = new String("java");
        System.out.println(s1 == s2);
        System.out.println(s1 == s3);
        System.out.println(s1.equals(s3));
        System.out.println(s1.equalsIgnoreCase("JAVA"));
    }
}
```

Reference solution:

```
Output:
true
false
true
true

Explanation: s1 and s2 are the same literal, so they refer to the same pooled String object and == is true. new String("java") always creates a new object, so s1 == s3 compares two different references and is false. equals() compares the characters, so s1.equals(s3) is true. equalsIgnoreCase ignores case, so it is also true.
```

Evaluation points: Correct output: true, false, true, true; Explains == compares references; Explains equals compares content; Mentions the string pool / literals being shared and new String creating a separate object

**9. PRG-JAVA-S1-09** · Sorting/Searching · write_code · Hard · ~6 min

Write an iterative method `public static int binarySearch(int[] sorted, int target)` that returns the index of target in an array sorted in ascending order, or -1 if it is not present. It must run in O(log n) time; do not use Arrays.binarySearch or any library search.

Reference solution:

```
public static int binarySearch(int[] sorted, int target) {
    int low = 0;
    int high = sorted.length - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (sorted[mid] == target) {
            return mid;
        } else if (sorted[mid] < target) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return -1;
}
```

Evaluation points: Maintains low/high bounds and loops while low <= high; Moves bounds past mid (mid + 1 / mid - 1) so the loop terminates; Returns -1 when not found, including for an empty array; O(log n); no linear scan; Bonus: overflow-safe midpoint low + (high - low) / 2

**10. PRG-JAVA-S1-10** · Arrays · complete_code · Hard · ~6 min

Complete the method mergeSorted so that it merges two int arrays that are each already sorted in ascending order into one new sorted array containing all elements of both (duplicates kept). Fill in the two TODO sections using the indexes i, j and k; do not call Arrays.sort.

Given code:

```
public static int[] mergeSorted(int[] a, int[] b) {
    int[] result = new int[a.length + b.length];
    int i = 0, j = 0, k = 0;
    // TODO 1: while both arrays still have elements, copy the smaller one

    // TODO 2: copy whatever is left in a or b

    return result;
}
```

Reference solution:

```
public static int[] mergeSorted(int[] a, int[] b) {
    int[] result = new int[a.length + b.length];
    int i = 0, j = 0, k = 0;
    while (i < a.length && j < b.length) {
        if (a[i] <= b[j]) {
            result[k++] = a[i++];
        } else {
            result[k++] = b[j++];
        }
    }
    while (i < a.length) {
        result[k++] = a[i++];
    }
    while (j < b.length) {
        result[k++] = b[j++];
    }
    return result;
}
```

Evaluation points: Main loop runs while both indexes are in range and picks the smaller element; Copies remaining elements of both arrays afterwards; Handles an empty input array; Keeps duplicates; Runs in O(n + m) without sorting

### Java – Set 2

**1. PRG-JAVA-S2-01** · Conditionals · write_code · Easy · ~3 min

Write a method `public static String letterGrade(int score)` that converts an exam score to a grade: 90-100 is "A", 80-89 is "B", 70-79 is "C", 60-69 is "D", 0-59 is "F". Any score below 0 or above 100 returns "Invalid".

Reference solution:

```
public static String letterGrade(int score) {
    if (score < 0 || score > 100) {
        return "Invalid";
    } else if (score >= 90) {
        return "A";
    } else if (score >= 80) {
        return "B";
    } else if (score >= 70) {
        return "C";
    } else if (score >= 60) {
        return "D";
    }
    return "F";
}
```

Evaluation points: Validates the 0-100 range first; Boundary values (90, 80, 70, 60) map to the higher grade; Uses an if / else-if chain in a sensible order; Every path returns a value

**2. PRG-JAVA-S2-02** · Loops · explain_output · Easy · ~3 min

The program below uses nested for loops together with a continue statement. Write the exact output it produces and explain what continue does to the outer loop on the iteration where i equals 3.

Given code:

```
public class Main {
    public static void main(String[] args) {
        for (int i = 1; i <= 4; i++) {
            if (i == 3) {
                continue;
            }
            for (int j = 1; j <= i; j++) {
                System.out.print(j);
            }
            System.out.println();
        }
    }
}
```

Reference solution:

```
Output:
1
12
1234

Explanation: For each i the inner loop prints 1..i on one line. When i is 3, continue skips the rest of that outer iteration, so neither the inner loop nor the println runs and no line (not even an empty one) is printed for 3.
```

Evaluation points: Correct three lines: 1, 12, 1234; States that no line (not even a blank line) is printed for i = 3; Explains that continue jumps to the next iteration of the loop it is in; Explains the inner loop prints 1..i

**3. PRG-JAVA-S2-03** · Arrays · write_code · Easy · ~3 min

Write a method `public static int countEvens(int[] nums)` that returns how many values in the array are even. Zero and negative even numbers count as even. An empty array returns 0.

Reference solution:

```
public static int countEvens(int[] nums) {
    int count = 0;
    for (int n : nums) {
        if (n % 2 == 0) {
            count++;
        }
    }
    return count;
}
```

Evaluation points: Uses n % 2 == 0 (works for negatives; n % 2 == 1 style checks for odd would fail on negatives); Iterates over every element; Returns 0 for an empty array

**4. PRG-JAVA-S2-04** · Strings · write_code · Medium · ~5 min

Write a method `public static String reverseWords(String sentence)` that returns the words of the sentence in reverse order, separated by exactly one space. The input may have leading, trailing or repeated spaces between words; the result must not. Example: "  hello   world java " returns "java world hello". A blank input returns "".

Reference solution:

```
public static String reverseWords(String sentence) {
    String trimmed = sentence.trim();
    if (trimmed.isEmpty()) {
        return "";
    }
    String[] words = trimmed.split("\\s+");
    StringBuilder sb = new StringBuilder();
    for (int i = words.length - 1; i >= 0; i--) {
        sb.append(words[i]);
        if (i > 0) {
            sb.append(' ');
        }
    }
    return sb.toString();
}
```

Evaluation points: Trims and splits on one-or-more whitespace (\\s+); Iterates words from last to first; No leading/trailing or double spaces in the result; Handles blank input; Uses StringBuilder or String.join rather than repeated concatenation (preferred)

**5. PRG-JAVA-S2-05** · Maps/Dictionaries · write_code · Medium · ~5 min

Write a method `public static Map<String, Integer> wordCount(String text)` that counts how many times each word occurs. Words are separated by one or more spaces and counting is case-insensitive (store keys in lower case). A blank string returns an empty map. Example: wordCount("The cat and the hat") maps "the" to 2 and every other word to 1.

Reference solution:

```
public static Map<String, Integer> wordCount(String text) {
    Map<String, Integer> counts = new HashMap<>();
    if (text.trim().isEmpty()) {
        return counts;
    }
    for (String word : text.trim().toLowerCase().split("\\s+")) {
        counts.put(word, counts.getOrDefault(word, 0) + 1);
    }
    return counts;
}
```

Evaluation points: Uses a HashMap<String, Integer>; Lower-cases words so counting is case-insensitive; Uses getOrDefault / merge / containsKey to handle first occurrence; Splits on repeated spaces and handles blank input

**6. PRG-JAVA-S2-06** · Debugging · fix_bug · Medium · ~4 min

countVowels should return the number of vowels (a, e, i, o, u) in a string, counting both upper and lower case. The current version throws StringIndexOutOfBoundsException and also miscounts words with capital vowels. Find both bugs and write the corrected method.

Given code:

```
public static int countVowels(String s) {
    int count = 0;
    for (int i = 0; i <= s.length(); i++) {
        char c = s.charAt(i);
        if ("aeiou".indexOf(c) != -1) {
            count++;
        }
    }
    return count;
}
```

Reference solution:

```
public static int countVowels(String s) {
    int count = 0;
    for (int i = 0; i < s.length(); i++) {
        char c = Character.toLowerCase(s.charAt(i));
        if ("aeiou".indexOf(c) != -1) {
            count++;
        }
    }
    return count;
}
```

Evaluation points: Fixes the loop condition from <= to < (off-by-one); Makes the check case-insensitive (toLowerCase or "aeiouAEIOU"); Explains why charAt(s.length()) throws; Empty string returns 0

**7. PRG-JAVA-S2-07** · OOP Basics · write_code · Medium · ~5 min

Given `interface Shape { double area(); }`, write two classes that implement it: `Circle` (constructor takes a double radius; area = Math.PI * r * r) and `Rectangle` (constructor takes double width and height). Then write `public static double totalArea(List<Shape> shapes)` inside a class `ShapeUtils` that returns the sum of the areas of all shapes (0.0 for an empty list).

Given code:

```
interface Shape {
    double area();
}
```

Reference solution:

```
class Circle implements Shape {
    private final double radius;

    Circle(double radius) {
        this.radius = radius;
    }

    @Override
    public double area() {
        return Math.PI * radius * radius;
    }
}

class Rectangle implements Shape {
    private final double width;
    private final double height;

    Rectangle(double width, double height) {
        this.width = width;
        this.height = height;
    }

    @Override
    public double area() {
        return width * height;
    }
}

class ShapeUtils {
    public static double totalArea(List<Shape> shapes) {
        double total = 0.0;
        for (Shape s : shapes) {
            total += s.area();
        }
        return total;
    }
}
```

Evaluation points: Both classes use implements Shape and override area() as public; Constructors store the dimensions in fields; totalArea works through the Shape interface (polymorphism), no instanceof checks; Returns 0.0 for an empty list

**8. PRG-JAVA-S2-08** · OOP Basics · explain_output · Medium · ~4 min

The Ticket class below has one static field and one instance field. After three tickets are created, what does main print? Explain how a static field differs from an instance field and why a.issued prints what it does.

Given code:

```
class Ticket {
    static int issued = 0;
    int number;

    Ticket() {
        issued++;
        number = issued;
    }
}

public class Main {
    public static void main(String[] args) {
        Ticket a = new Ticket();
        Ticket b = new Ticket();
        Ticket c = new Ticket();
        System.out.println(a.number);
        System.out.println(c.number);
        System.out.println(Ticket.issued);
        System.out.println(a.issued);
    }
}
```

Reference solution:

```
Output:
1
3
3
3

Explanation: issued is static, so there is a single copy shared by all Ticket objects; each constructor call increments it. number is an instance field, so each object keeps the value issued had at its creation: a gets 1, b gets 2, c gets 3. Ticket.issued is 3 after three objects. a.issued is the same shared static field (accessing it through an instance is allowed but misleading), so it is also 3.
```

Evaluation points: Correct output: 1, 3, 3, 3; Explains a static field is shared by all instances; Explains each object has its own number; Explains a.issued refers to the same static variable

**9. PRG-JAVA-S2-09** · Recursion · write_code · Hard · ~6 min

Write a recursive method `public static List<String> permutations(String s)` that returns all permutations of a string whose characters are all distinct. Build them by choosing each character in turn (left to right) as the first character and recursively permuting the rest, so permutations("abc") returns [abc, acb, bac, bca, cab, cba] in that order. For a string of length 0 or 1, return a list containing just that string.

Reference solution:

```
public static List<String> permutations(String s) {
    List<String> result = new ArrayList<>();
    if (s.length() <= 1) {
        result.add(s);
        return result;
    }
    for (int i = 0; i < s.length(); i++) {
        char first = s.charAt(i);
        String rest = s.substring(0, i) + s.substring(i + 1);
        for (String p : permutations(rest)) {
            result.add(first + p);
        }
    }
    return result;
}
```

Evaluation points: Correct base case for length 0/1; Removes the chosen character correctly with substring; Recursive call on the remaining characters and prefixes the chosen char; Produces n! results in the required order; No duplicates for distinct input characters

**10. PRG-JAVA-S2-10** · Sorting/Searching · complete_code · Hard · ~6 min

Complete the insertion sort below so that it sorts the array in place in ascending order. For each position i, the variable key holds arr[i]; shift every larger element of the already-sorted part arr[0..i-1] one place to the right, then drop key into the gap. Do not use Arrays.sort.

Given code:

```
public static void insertionSort(int[] arr) {
    for (int i = 1; i < arr.length; i++) {
        int key = arr[i];
        int j = i - 1;
        // TODO 1: shift elements greater than key one position to the right

        // TODO 2: place key in its correct position
    }
}
```

Reference solution:

```
public static void insertionSort(int[] arr) {
    for (int i = 1; i < arr.length; i++) {
        int key = arr[i];
        int j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}
```

Evaluation points: Inner while loop checks j >= 0 before accessing arr[j]; Shifts with arr[j + 1] = arr[j] and decrements j; Places key at arr[j + 1] after the loop; Stable: uses > (not >=) so equal elements keep their order; Works for empty and single-element arrays

### Java – Set 3

**1. PRG-JAVA-S3-01** · Conditionals · write_code · Easy · ~3 min

Write a method `public static boolean isLeapYear(int year)` using the Gregorian rules: a year is a leap year if it is divisible by 4, except years divisible by 100, which are leap years only if they are also divisible by 400. Examples: 2024 is a leap year, 1900 is not, 2000 is.

Reference solution:

```
public static boolean isLeapYear(int year) {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}
```

Evaluation points: Divisible by 4 rule; Century exception (divisible by 100 is not a leap year); 400 exception (2000 is a leap year); Correct operator precedence / parentheses

**2. PRG-JAVA-S3-02** · Strings · explain_output · Easy · ~3 min

Strings in Java are immutable. Using that fact, predict exactly what this program prints and explain why the first line is not in upper case even though toUpperCase() was called.

Given code:

```
public class Main {
    public static void main(String[] args) {
        String s = "hello";
        s.toUpperCase();
        System.out.println(s);
        s = s.concat(" world");
        System.out.println(s);
        System.out.println(s.length());
        System.out.println(s.indexOf('o'));
    }
}
```

Reference solution:

```
Output:
hello
hello world
11
4

Explanation: String methods never modify the original object; they return a new String. s.toUpperCase() returns "HELLO" but the result is discarded, so s is still "hello". concat also returns a new string, but this time it is assigned back to s, giving "hello world" (11 characters including the space). indexOf('o') returns the first position of 'o', which is index 4.
```

Evaluation points: Correct output: hello, hello world, 11, 4; Explains String immutability and that the toUpperCase result was discarded; Explains the reassignment s = s.concat(...); Counts length and zero-based index correctly

**3. PRG-JAVA-S3-03** · Loops · write_code · Easy · ~3 min

Write an iterative (loop-based, not recursive) method `public static long factorial(int n)` that returns n! for 0 <= n <= 20. factorial(0) is 1. If n is negative, throw an IllegalArgumentException.

Reference solution:

```
public static long factorial(int n) {
    if (n < 0) {
        throw new IllegalArgumentException("n must be non-negative");
    }
    long result = 1;
    for (int i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}
```

Evaluation points: Uses long so 20! does not overflow; Returns 1 for 0 (and 1); Throws IllegalArgumentException for negative input; Uses a loop, not recursion

**4. PRG-JAVA-S3-04** · Strings · write_code · Medium · ~5 min

Write a method `public static String compress(String s)` that performs run-length encoding using a StringBuilder: each run of the same character is replaced by the character followed by the length of the run. Example: "aaabccdddd" returns "a3b1c2d4". An empty string returns "".

Reference solution:

```
public static String compress(String s) {
    StringBuilder sb = new StringBuilder();
    int i = 0;
    while (i < s.length()) {
        char c = s.charAt(i);
        int run = 0;
        while (i < s.length() && s.charAt(i) == c) {
            run++;
            i++;
        }
        sb.append(c).append(run);
    }
    return sb.toString();
}
```

Evaluation points: Uses StringBuilder rather than repeated String concatenation; Counts consecutive runs correctly, including the final run; Single characters get count 1; Empty string handled without errors

**5. PRG-JAVA-S3-05** · Collections · write_code · Medium · ~4 min

Write a method `public static List<String> removeDuplicates(List<String> items)` that returns a new ArrayList containing each distinct item once, in the order of its first appearance. The original list must not be modified. Example: [apple, pear, apple, fig, pear] returns [apple, pear, fig].

Reference solution:

```
public static List<String> removeDuplicates(List<String> items) {
    List<String> result = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (String item : items) {
        if (seen.add(item)) {
            result.add(item);
        }
    }
    return result;
}
```

Evaluation points: Returns a new list and leaves the input untouched; Preserves first-occurrence order; Uses a HashSet / LinkedHashSet (or contains check) to detect duplicates; Handles an empty list

**6. PRG-JAVA-S3-06** · Maps/Dictionaries · fix_bug · Medium · ~4 min

countOrdersByCustomer should return a map from customer name to the number of orders that customer placed. Instead it crashes with a NullPointerException on the very first order. Explain the cause and write a corrected version.

Given code:

```
public static Map<String, Integer> countOrdersByCustomer(String[] customers) {
    Map<String, Integer> counts = new HashMap<>();
    for (String c : customers) {
        counts.put(c, counts.get(c) + 1);
    }
    return counts;
}
```

Reference solution:

```
public static Map<String, Integer> countOrdersByCustomer(String[] customers) {
    Map<String, Integer> counts = new HashMap<>();
    for (String c : customers) {
        counts.put(c, counts.getOrDefault(c, 0) + 1);
    }
    return counts;
}
```

Evaluation points: Explains get returns null for a missing key and auto-unboxing null to int throws NullPointerException; Uses getOrDefault(c, 0), merge(c, 1, Integer::sum) or a containsKey check; Counts are correct for repeated customers; Empty array returns an empty map

**7. PRG-JAVA-S3-07** · Exceptions · write_code · Medium · ~4 min

Write a method `public static int parseOrDefault(String text, int defaultValue)` that converts text to an int using Integer.parseInt after trimming surrounding spaces. If text is null or is not a valid integer, return defaultValue instead of throwing. Example: parseOrDefault(" 7 ", 0) returns 7; parseOrDefault("abc", 0) returns 0.

Reference solution:

```
public static int parseOrDefault(String text, int defaultValue) {
    if (text == null) {
        return defaultValue;
    }
    try {
        return Integer.parseInt(text.trim());
    } catch (NumberFormatException e) {
        return defaultValue;
    }
}
```

Evaluation points: Uses try/catch around Integer.parseInt; Catches NumberFormatException specifically (not a bare catch of Throwable); Handles null without a NullPointerException; Trims whitespace before parsing

**8. PRG-JAVA-S3-08** · Exceptions · explain_output · Medium · ~4 min

Trace the try / catch / finally flow in this program, which reads past the end of an array. Write the exact output and explain which statements run, which are skipped, and why the finally block and the last println both execute.

Given code:

```
public class Main {
    public static void main(String[] args) {
        int[] data = {10, 20, 30};
        try {
            System.out.println("A");
            System.out.println(data[3]);
            System.out.println("B");
        } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println("C");
        } finally {
            System.out.println("D");
        }
        System.out.println("E");
    }
}
```

Reference solution:

```
Output:
A
C
D
E

Explanation: "A" prints first. data[3] is out of bounds (valid indexes are 0-2), so an ArrayIndexOutOfBoundsException is thrown before anything is printed for that line, and the rest of the try block ("B") is skipped. The matching catch prints "C". finally always runs, printing "D". Because the exception was handled, execution continues normally and "E" prints.
```

Evaluation points: Correct output: A, C, D, E; Explains B is skipped once the exception is thrown; Explains finally always runs; Explains the program continues after a caught exception

**9. PRG-JAVA-S3-09** · Sorting/Searching · write_code · Hard · ~6 min

Using the Employee class shown, write `public static void sortEmployees(List<Employee> list)` inside a class `EmployeeSorter` that sorts the list in place by salary from highest to lowest; employees with equal salary must be ordered by name alphabetically (A to Z). Use a Comparator (lambda, method references or an anonymous class).

Given code:

```
class Employee {
    private final String name;
    private final double salary;

    Employee(String name, double salary) {
        this.name = name;
        this.salary = salary;
    }

    String getName() { return name; }
    double getSalary() { return salary; }
}
```

Reference solution:

```
class EmployeeSorter {
    public static void sortEmployees(List<Employee> list) {
        list.sort((a, b) -> {
            int bySalary = Double.compare(b.getSalary(), a.getSalary());
            if (bySalary != 0) {
                return bySalary;
            }
            return a.getName().compareTo(b.getName());
        });
    }
}
```

Evaluation points: Sorts by salary descending (Double.compare(b, a) or .reversed()); Tie-break by name ascending with compareTo / thenComparing; Sorts in place (list.sort or Collections.sort); Does not subtract doubles and cast to int for comparison; Handles an empty list

**10. PRG-JAVA-S3-10** · Recursion · complete_code · Hard · ~6 min

Complete the recursive Tower of Hanoi method. It must add to moves, in order, every move needed to transfer n disks from peg `from` to peg `to` using peg `via`, where each move is recorded as a string like "A->C". For example hanoi(2, 'A', 'C', 'B', moves) produces [A->B, A->C, B->C]. Only the TODO part needs to be written.

Given code:

```
public static void hanoi(int n, char from, char to, char via, List<String> moves) {
    if (n == 0) {
        return;
    }
    // TODO: move n-1 disks out of the way, record the move of the largest disk,
    //       then move the n-1 disks on top of it
}
```

Reference solution:

```
public static void hanoi(int n, char from, char to, char via, List<String> moves) {
    if (n == 0) {
        return;
    }
    hanoi(n - 1, from, via, to, moves);
    moves.add(from + "->" + to);
    hanoi(n - 1, via, to, from, moves);
}
```

Evaluation points: First recursive call moves n-1 disks from 'from' to 'via'; Records the move from 'from' to 'to'; Second recursive call moves n-1 disks from 'via' to 'to'; Produces 2^n - 1 moves; Builds the move string correctly (not char arithmetic)

### Java – Set 4

**1. PRG-JAVA-S4-01** · Arrays · write_code · Easy · ~3 min

Write a method `public static void reverseInPlace(int[] arr)` that reverses the order of the elements of the array itself (do not create a second array). Example: {1, 2, 3, 4} becomes {4, 3, 2, 1}.

Reference solution:

```
public static void reverseInPlace(int[] arr) {
    int left = 0;
    int right = arr.length - 1;
    while (left < right) {
        int temp = arr[left];
        arr[left] = arr[right];
        arr[right] = temp;
        left++;
        right--;
    }
}
```

Evaluation points: Swaps elements from both ends using a temporary variable; Stops at the middle (left < right) so elements are not swapped back; No second array; Works for odd, even, empty and single-element arrays

**2. PRG-JAVA-S4-02** · Functions · explain_output · Easy · ~3 min

Java passes arguments to methods by value. The update method below receives an int, an int array and a String and tries to change all three. What does main print afterwards? Explain why only one of the three changes is visible to the caller.

Given code:

```
public class Main {
    static void update(int count, int[] totals, String label) {
        count = 100;
        totals[0] = 100;
        label = "changed";
    }

    public static void main(String[] args) {
        int count = 5;
        int[] totals = {5, 6};
        String label = "original";
        update(count, totals, label);
        System.out.println(count);
        System.out.println(totals[0]);
        System.out.println(label);
    }
}
```

Reference solution:

```
Output:
5
100
original

Explanation: Java copies each argument into the parameter. count is a primitive, so the method changes only its own copy: main still sees 5. For the array, the copied value is a reference to the same array object, so totals[0] = 100 modifies the shared array and main sees 100. label = "changed" only points the local parameter at a different String; main's variable still refers to "original".
```

Evaluation points: Correct output: 5, 100, original; Explains primitives are copied; Explains the array reference is copied but points to the same object, so element changes are visible; Explains reassigning a reference parameter does not affect the caller's variable

**3. PRG-JAVA-S4-03** · Strings · write_code · Easy · ~3 min

Write a method `public static int countChar(String s, char target)` that returns how many times target occurs in s. The comparison is case-sensitive. Example: countChar("banana", 'a') returns 3.

Reference solution:

```
public static int countChar(String s, char target) {
    int count = 0;
    for (int i = 0; i < s.length(); i++) {
        if (s.charAt(i) == target) {
            count++;
        }
    }
    return count;
}
```

Evaluation points: Iterates over every character with correct bounds; Compares chars with == (appropriate for primitives); Case-sensitive as required; Returns 0 for an empty string

**4. PRG-JAVA-S4-04** · Maps/Dictionaries · write_code · Medium · ~5 min

Write a method `public static int[] twoSum(int[] nums, int target)` that returns the indexes {i, j} (with i < j) of the two elements that add up to target. Exactly one valid pair exists. Solve it in a single pass using a HashMap from value to index (O(n) time), not with nested loops.

Reference solution:

```
public static int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> indexByValue = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int needed = target - nums[i];
        if (indexByValue.containsKey(needed)) {
            return new int[]{indexByValue.get(needed), i};
        }
        indexByValue.put(nums[i], i);
    }
    return new int[0];
}
```

Evaluation points: Uses a HashMap from value to index; Checks for the complement before inserting the current value (so an element is not paired with itself); Returns indexes in order i < j; O(n) single pass; Handles duplicate values such as {3, 3}

**5. PRG-JAVA-S4-05** · OOP Basics · write_code · Medium · ~5 min

Write a class `Product` with private fields name (String), price (double) and quantity (int). The constructor `Product(String name, double price, int quantity)` must throw IllegalArgumentException if price or quantity is negative. Add `double getPrice()`, `double getInventoryValue()` (price x quantity) and `void applyDiscount(double percent)` which reduces the price by that percentage and throws IllegalArgumentException if percent is outside 0-100.

Reference solution:

```
class Product {
    private final String name;
    private double price;
    private final int quantity;

    public Product(String name, double price, int quantity) {
        if (price < 0 || quantity < 0) {
            throw new IllegalArgumentException("price and quantity must be non-negative");
        }
        this.name = name;
        this.price = price;
        this.quantity = quantity;
    }

    public double getPrice() {
        return price;
    }

    public double getInventoryValue() {
        return price * quantity;
    }

    public void applyDiscount(double percent) {
        if (percent < 0 || percent > 100) {
            throw new IllegalArgumentException("percent must be between 0 and 100");
        }
        price = price * (100 - percent) / 100;
    }
}
```

Evaluation points: Private fields with a constructor that assigns them; Constructor validates and throws IllegalArgumentException; getInventoryValue multiplies price by quantity; applyDiscount validates the range and updates price correctly; Invalid discount leaves the price unchanged

**6. PRG-JAVA-S4-06** · Debugging · fix_bug · Medium · ~4 min

countMatches should count how many product codes in the array equal target. When the codes are read from a file at runtime it often returns fewer matches than expected, even though printing the values shows identical text. The method must also tolerate null entries in the array (target is never null). Explain the bug and fix it.

Given code:

```
public static int countMatches(String[] codes, String target) {
    int count = 0;
    for (String code : codes) {
        if (code == target) {
            count++;
        }
    }
    return count;
}
```

Reference solution:

```
public static int countMatches(String[] codes, String target) {
    int count = 0;
    for (String code : codes) {
        if (target.equals(code)) {
            count++;
        }
    }
    return count;
}
```

Evaluation points: Identifies that == compares references, not string content; Replaces it with equals(); Calls equals on target (or uses Objects.equals) so null entries do not throw; Explains why literals may appear to work while runtime strings fail

**7. PRG-JAVA-S4-07** · Loops · write_code · Medium · ~4 min

Write a method `public static boolean isPrime(int n)` that returns true if n is a prime number. Numbers less than 2 are not prime. Only test divisors up to the square root of n (i * i <= n) instead of checking every number below n.

Reference solution:

```
public static boolean isPrime(int n) {
    if (n < 2) {
        return false;
    }
    for (int i = 2; (long) i * i <= n; i++) {
        if (n % i == 0) {
            return false;
        }
    }
    return true;
}
```

Evaluation points: Returns false for n < 2 (0, 1 and negatives); Loop bound i * i <= n (or i <= Math.sqrt(n)); Returns false as soon as a divisor is found; 2 and 3 are prime; Perfect squares such as 49 are detected as not prime

**8. PRG-JAVA-S4-08** · OOP Basics · explain_output · Medium · ~4 min

All three objects below are stored in variables declared as Vehicle, but they are instances of different classes in an inheritance chain. Predict the output exactly and explain how method overriding, dynamic dispatch and the super.describe() call determine each line.

Given code:

```
class Vehicle {
    String describe() {
        return "Vehicle";
    }

    int wheels() {
        return 0;
    }
}

class Car extends Vehicle {
    @Override
    String describe() {
        return "Car with " + wheels() + " wheels";
    }

    @Override
    int wheels() {
        return 4;
    }
}

class SportsCar extends Car {
    @Override
    String describe() {
        return "Sports " + super.describe();
    }
}

public class Main {
    public static void main(String[] args) {
        Vehicle v1 = new Vehicle();
        Vehicle v2 = new Car();
        Vehicle v3 = new SportsCar();
        System.out.println(v1.describe());
        System.out.println(v2.describe());
        System.out.println(v3.describe());
        System.out.println(v3 instanceof Car);
    }
}
```

Reference solution:

```
Output:
Vehicle
Car with 4 wheels
Sports Car with 4 wheels
true

Explanation: The method that runs is chosen by the object's actual class, not the variable's declared type (dynamic dispatch). v1 is a Vehicle, so "Vehicle". v2 is a Car; Car.describe calls wheels(), which Car overrides to return 4. v3 is a SportsCar; its describe prefixes "Sports " to super.describe(), which is Car's version, and wheels() still resolves to Car's override (4). A SportsCar is a Car, so instanceof is true.
```

Evaluation points: Correct output: Vehicle / Car with 4 wheels / Sports Car with 4 wheels / true; Explains dynamic dispatch uses the runtime type; Explains super.describe() calls the parent (Car) implementation; Explains instanceof is true for subclasses

**9. PRG-JAVA-S4-09** · Arrays · write_code · Hard · ~6 min

Write a method `public static int[][] rotateClockwise(int[][] matrix)` that returns a new matrix equal to the input rotated 90 degrees clockwise. The input has R rows and C columns (R, C >= 1, not necessarily square), so the result has C rows and R columns. Example: {{1, 2}, {3, 4}} becomes {{3, 1}, {4, 2}}.

Reference solution:

```
public static int[][] rotateClockwise(int[][] matrix) {
    int rows = matrix.length;
    int cols = matrix[0].length;
    int[][] result = new int[cols][rows];
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            result[c][rows - 1 - r] = matrix[r][c];
        }
    }
    return result;
}
```

Evaluation points: Allocates the result as [cols][rows]; Correct index mapping result[c][rows - 1 - r] = matrix[r][c]; Works for non-square matrices; Does not modify the input matrix

**10. PRG-JAVA-S4-10** · Collections · write_code · Hard · ~6 min

Write a method `public static boolean isBalanced(String s)` that returns true if every bracket in s is correctly matched and nested. The bracket pairs are (), [] and {}; all other characters are ignored. Use a stack (Deque<Character> / ArrayDeque). Examples: "{[()]}" and "a(b)c" are balanced; "([)]", "((" and ")(" are not.

Reference solution:

```
public static boolean isBalanced(String s) {
    Deque<Character> stack = new ArrayDeque<>();
    for (char c : s.toCharArray()) {
        if (c == '(' || c == '[' || c == '{') {
            stack.push(c);
        } else if (c == ')' || c == ']' || c == '}') {
            if (stack.isEmpty()) {
                return false;
            }
            char open = stack.pop();
            if ((c == ')' && open != '(')
                    || (c == ']' && open != '[')
                    || (c == '}' && open != '{')) {
                return false;
            }
        }
    }
    return stack.isEmpty();
}
```

Evaluation points: Pushes opening brackets onto a stack; On a closing bracket, returns false if the stack is empty or the top does not match; Returns stack.isEmpty() at the end (unclosed brackets fail); Ignores non-bracket characters; O(n) single pass

### Java – Set 5

**1. PRG-JAVA-S5-01** · Conditionals · write_code · Easy · ~3 min

Write a method `public static String classifyTriangle(int a, int b, int c)` that returns "Invalid" if the three side lengths cannot form a triangle (any side <= 0, or the sum of two sides is not greater than the third), otherwise "Equilateral" (all sides equal), "Isosceles" (exactly two equal) or "Scalene" (all different).

Reference solution:

```
public static String classifyTriangle(int a, int b, int c) {
    if (a <= 0 || b <= 0 || c <= 0 || a + b <= c || a + c <= b || b + c <= a) {
        return "Invalid";
    }
    if (a == b && b == c) {
        return "Equilateral";
    }
    if (a == b || b == c || a == c) {
        return "Isosceles";
    }
    return "Scalene";
}
```

Evaluation points: Checks validity first, including non-positive sides; Checks all three triangle inequalities; Equilateral checked before Isosceles; Isosceles covers all three pairs

**2. PRG-JAVA-S5-02** · Collections · explain_output · Easy · ~3 min

The program below builds an ArrayList of office items and then inserts at an index and removes by value. Write the four lines it prints and explain what add(1, ...) and remove("pen") each do to the list.

Given code:

```
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> items = new ArrayList<>();
        items.add("pen");
        items.add("book");
        items.add("lamp");
        items.add(1, "cup");
        items.remove("pen");
        System.out.println(items);
        System.out.println(items.size());
        System.out.println(items.get(1));
        System.out.println(items.indexOf("desk"));
    }
}
```

Reference solution:

```
Output:
[cup, book, lamp]
3
book
-1

Explanation: After the three add calls the list is [pen, book, lamp]. add(1, "cup") inserts at index 1 and shifts the rest right: [pen, cup, book, lamp]. remove("pen") removes the first element equal to "pen": [cup, book, lamp]. size() is 3, get(1) is "book", and indexOf returns -1 for an element that is not present.
```

Evaluation points: Correct output: [cup, book, lamp], 3, book, -1; Explains add(index, value) inserts and shifts elements; Explains remove(Object) removes by value; Explains indexOf returns -1 when absent

**3. PRG-JAVA-S5-03** · Arrays · write_code · Easy · ~3 min

Write a method `public static int[] runningTotals(int[] amounts)` that returns a new array of the same length where element i is the sum of amounts[0] through amounts[i]. Example: {1, 2, 3, 4} returns {1, 3, 6, 10}. An empty array returns an empty array.

Reference solution:

```
public static int[] runningTotals(int[] amounts) {
    int[] totals = new int[amounts.length];
    int sum = 0;
    for (int i = 0; i < amounts.length; i++) {
        sum += amounts[i];
        totals[i] = sum;
    }
    return totals;
}
```

Evaluation points: Creates a new array of the same length; Keeps a running sum instead of re-summing with a nested loop; Handles negative values and an empty array; Does not modify the input

**4. PRG-JAVA-S5-04** · Strings · write_code · Medium · ~5 min

Write a method `public static boolean isAnagram(String a, String b)` that returns true if the two strings contain exactly the same letters with the same counts, ignoring case and ignoring spaces. Examples: ("Listen", "Silent") and ("Dormitory", "Dirty room") return true; ("aab", "abb") returns false.

Reference solution:

```
public static boolean isAnagram(String a, String b) {
    char[] x = a.replace(" ", "").toLowerCase().toCharArray();
    char[] y = b.replace(" ", "").toLowerCase().toCharArray();
    if (x.length != y.length) {
        return false;
    }
    Arrays.sort(x);
    Arrays.sort(y);
    return Arrays.equals(x, y);
}
```

Evaluation points: Removes spaces and normalises case; Compares character counts (sorting or a frequency map/array); Uses Arrays.equals / count comparison, not == on arrays; Different counts of the same letters return false

**5. PRG-JAVA-S5-05** · OOP Basics · write_code · Medium · ~5 min

Given the abstract class Worker below, write two subclasses. `FullTimeWorker(String name, double annualSalary)` pays annualSalary / 12 per month. `Contractor(String name, double hoursWorked, double hourlyRate)` pays hoursWorked x hourlyRate per month. Both constructors must pass the name to the Worker constructor using super, and both must override monthlyPay().

Given code:

```
abstract class Worker {
    protected final String name;

    Worker(String name) {
        this.name = name;
    }

    abstract double monthlyPay();

    String summary() {
        return name + ": " + monthlyPay();
    }
}
```

Reference solution:

```
class FullTimeWorker extends Worker {
    private final double annualSalary;

    FullTimeWorker(String name, double annualSalary) {
        super(name);
        this.annualSalary = annualSalary;
    }

    @Override
    double monthlyPay() {
        return annualSalary / 12;
    }
}

class Contractor extends Worker {
    private final double hoursWorked;
    private final double hourlyRate;

    Contractor(String name, double hoursWorked, double hourlyRate) {
        super(name);
        this.hoursWorked = hoursWorked;
        this.hourlyRate = hourlyRate;
    }

    @Override
    double monthlyPay() {
        return hoursWorked * hourlyRate;
    }
}
```

Evaluation points: Both classes extend Worker; Constructors call super(name) as the first statement; monthlyPay is overridden with the correct formula; Subclass-specific data stored in private fields; summary() works without being rewritten (inherited)

**6. PRG-JAVA-S5-06** · Recursion · fix_bug · Medium · ~4 min

sumFrom is meant to recursively return the sum of nums[index] through the end of the array, so sumFrom(nums, 0) sums the whole array. Calling it on any non-empty array ends in a StackOverflowError. Explain why the recursion never reaches its base case and write the corrected method.

Given code:

```
public static int sumFrom(int[] nums, int index) {
    if (index == nums.length) {
        return 0;
    }
    return nums[index] + sumFrom(nums, index);
}
```

Reference solution:

```
public static int sumFrom(int[] nums, int index) {
    if (index >= nums.length) {
        return 0;
    }
    return nums[index] + sumFrom(nums, index + 1);
}
```

Evaluation points: Identifies that index is never advanced, so the same call repeats forever; Fix passes index + 1 in the recursive call; Base case returns 0 at the end of the array; Explains StackOverflowError as unbounded recursion depth

**7. PRG-JAVA-S5-07** · Collections · complete_code · Medium · ~4 min

Complete expensiveProductNames using a single Java Stream pipeline. It must return the names of all products whose price is greater than or equal to minPrice, converted to upper case and sorted alphabetically, as a List<String>. The Product class (with getName() and getPrice()) is shown in the starter code.

Given code:

```
class Product {
    private final String name;
    private final double price;

    Product(String name, double price) {
        this.name = name;
        this.price = price;
    }

    String getName() { return name; }
    double getPrice() { return price; }
}

public static List<String> expensiveProductNames(List<Product> products, double minPrice) {
    return products.stream()
            // TODO: keep products with price >= minPrice
            // TODO: map each product to its name in upper case
            // TODO: sort alphabetically and collect into a List
            ;
}
```

Reference solution:

```
public static List<String> expensiveProductNames(List<Product> products, double minPrice) {
    return products.stream()
            .filter(p -> p.getPrice() >= minPrice)
            .map(p -> p.getName().toUpperCase())
            .sorted()
            .collect(Collectors.toList());
}
```

Evaluation points: filter with >= minPrice (inclusive); map to getName().toUpperCase(); sorted() before collecting; collect(Collectors.toList()) or .toList(); Correct operation order; no loops mixed in

**8. PRG-JAVA-S5-08** · Strings · explain_output · Medium · ~4 min

Unlike String, StringBuilder is mutable. Follow each call on the StringBuilder below (append, insert, reverse, deleteCharAt) and write the exact output of the program, showing the builder's contents after every step.

Given code:

```
public class Main {
    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder("code");
        sb.append("r");
        System.out.println(sb);
        sb.insert(0, "en");
        System.out.println(sb);
        sb.reverse();
        System.out.println(sb);
        sb.deleteCharAt(0);
        System.out.println(sb.length());
        System.out.println(sb);
    }
}
```

Reference solution:

```
Output:
coder
encoder
redocne
6
edocne

Explanation: StringBuilder methods change the same object. append("r") gives "coder". insert(0, "en") puts "en" at the start: "encoder". reverse() reverses in place: "redocne". deleteCharAt(0) removes 'r', leaving "edocne" with length 6.
```

Evaluation points: Correct output: coder, encoder, redocne, 6, edocne; Explains StringBuilder is modified in place (mutable); Correct handling of insert at index 0; Correct result of reverse and deleteCharAt

**9. PRG-JAVA-S5-09** · Sorting/Searching · write_code · Hard · ~6 min

Write a method `public static int[][] mergeIntervals(int[][] intervals)` where each element is {start, end} with start <= end. Merge every group of overlapping intervals and return the result sorted by start. Intervals that touch (e.g. {1, 4} and {4, 5}) count as overlapping. The input may be in any order. Example: {{1,3},{8,10},{2,6},{15,18}} returns {{1,6},{8,10},{15,18}}.

Reference solution:

```
public static int[][] mergeIntervals(int[][] intervals) {
    if (intervals.length == 0) {
        return new int[0][];
    }
    int[][] sorted = intervals.clone();
    Arrays.sort(sorted, (x, y) -> Integer.compare(x[0], y[0]));
    List<int[]> merged = new ArrayList<>();
    int[] current = {sorted[0][0], sorted[0][1]};
    for (int i = 1; i < sorted.length; i++) {
        if (sorted[i][0] <= current[1]) {
            current[1] = Math.max(current[1], sorted[i][1]);
        } else {
            merged.add(current);
            current = new int[]{sorted[i][0], sorted[i][1]};
        }
    }
    merged.add(current);
    return merged.toArray(new int[0][]);
}
```

Evaluation points: Sorts intervals by start first; Merges when next start <= current end (touching included); Extends the end with Math.max (handles fully contained intervals); Adds the last interval after the loop; Handles empty input

**10. PRG-JAVA-S5-10** · Exceptions · write_code · Hard · ~6 min

Write a checked exception class `OutOfStockException` (extends Exception, constructor takes a String message) and a class `Inventory` backed by a HashMap<String, Integer>. Inventory needs: `void addStock(String item, int qty)`; `void removeStock(String item, int qty) throws OutOfStockException`, which throws OutOfStockException with the message "Not enough <item>: requested <qty>, available <n>" when there is not enough stock (leaving stock unchanged); and `int getQuantity(String item)`, which returns 0 for unknown items. Both addStock and removeStock throw IllegalArgumentException if qty <= 0.

Reference solution:

```
class OutOfStockException extends Exception {
    public OutOfStockException(String message) {
        super(message);
    }
}

class Inventory {
    private final Map<String, Integer> stock = new HashMap<>();

    public void addStock(String item, int qty) {
        if (qty <= 0) {
            throw new IllegalArgumentException("qty must be positive");
        }
        stock.put(item, getQuantity(item) + qty);
    }

    public void removeStock(String item, int qty) throws OutOfStockException {
        if (qty <= 0) {
            throw new IllegalArgumentException("qty must be positive");
        }
        int available = getQuantity(item);
        if (qty > available) {
            throw new OutOfStockException("Not enough " + item + ": requested " + qty + ", available " + available);
        }
        stock.put(item, available - qty);
    }

    public int getQuantity(String item) {
        return stock.getOrDefault(item, 0);
    }
}
```

Evaluation points: OutOfStockException extends Exception and passes the message to super; removeStock declares throws OutOfStockException; Stock is unchanged when the exception is thrown; Exact message format; IllegalArgumentException for qty <= 0; getQuantity returns 0 for unknown items

## JavaScript

### JavaScript – Set 1

**1. PRG-JAVASCRIPT-S1-01** · Variables & Scope · explain_output · Easy · ~3 min

A function declares one variable with var and one with let inside an if block, then checks both with typeof outside the block. State the exact console output and explain the scoping rule behind each line.

Given code:

```
function test() {
  if (true) {
    var a = 1;
    let b = 2;
  }
  console.log(typeof a);
  console.log(typeof b);
}
test();
```

Reference solution:

```
Output:
number
undefined

Explanation: 'var' is function-scoped, so 'a' is visible anywhere inside test() and holds the number 1. 'let' is block-scoped, so 'b' only exists inside the if block; outside it the identifier is not declared, and typeof on an undeclared identifier returns 'undefined' instead of throwing.
```

Evaluation points: States the exact output: number then undefined; Explains var is function-scoped; Explains let is block-scoped; Notes typeof on an undeclared name returns "undefined" rather than throwing

**2. PRG-JAVASCRIPT-S1-02** · Strings · write_code · Easy · ~3 min

Write a function reverseWords(sentence) that returns the words of the sentence in reverse order, separated by single spaces. Words are separated by one or more spaces; leading/trailing spaces should be ignored. Example: reverseWords("hello big world") returns "world big hello".

Given code:

```
function reverseWords(sentence) {
  // your code
}
```

Reference solution:

```
function reverseWords(sentence) {
  return sentence.trim().split(/\s+/).reverse().join(' ');
}
```

Evaluation points: Splits on whitespace and handles multiple spaces; Ignores leading/trailing spaces (trim); Reverses word order, not characters; Joins with single spaces

**3. PRG-JAVASCRIPT-S1-03** · Arrays · write_code · Easy · ~3 min

Write a function sumOfEvens(nums) that returns the sum of all even numbers in the array nums. Return 0 if there are none or the array is empty. Example: sumOfEvens([1, 2, 3, 4]) returns 6.

Given code:

```
function sumOfEvens(nums) {
  // your code
}
```

Reference solution:

```
function sumOfEvens(nums) {
  return nums.filter(n => n % 2 === 0).reduce((sum, n) => sum + n, 0);
}
```

Evaluation points: Correctly identifies even numbers (including negatives and 0); Returns 0 for an empty array or no evens; Uses a loop or filter/reduce with an initial value of 0

**4. PRG-JAVASCRIPT-S1-04** · Objects · write_code · Medium · ~5 min

Write a function countOccurrences(words) that takes an array of strings and returns an object mapping each distinct word to the number of times it appears. Matching is case-sensitive. Example: countOccurrences(["pen", "cup", "pen"]) returns { pen: 2, cup: 1 }.

Given code:

```
function countOccurrences(words) {
  // your code
}
```

Reference solution:

```
function countOccurrences(words) {
  const counts = {};
  for (const w of words) {
    counts[w] = (counts[w] || 0) + 1;
  }
  return counts;
}
```

Evaluation points: Returns a plain object keyed by word; Initialises unseen keys correctly (no NaN); Counts every occurrence; Returns {} for an empty array

**5. PRG-JAVASCRIPT-S1-05** · Debugging · fix_bug · Medium · ~5 min

The function findMax(nums) should return the largest number in a non-empty array of numbers, but it returns the wrong result for some inputs. Identify the bug and provide the corrected function.

Given code:

```
function findMax(nums) {
  let max = 0;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] > max) {
      max = nums[i];
    }
  }
  return max;
}
```

Reference solution:

```
function findMax(nums) {
  let max = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > max) {
      max = nums[i];
    }
  }
  return max;
}
// Bug: max started at 0, so an array of only negative numbers returned 0. Start from the first element instead.
```

Evaluation points: Identifies that initialising max to 0 fails for all-negative arrays; Initialises max from nums[0] (or -Infinity); Keeps correct behaviour for positive numbers

**6. PRG-JAVASCRIPT-S1-06** · Closures · write_code · Medium · ~5 min

Write a function makeCounter(start) that returns an object with three methods: increment() adds 1 and returns the new value, decrement() subtracts 1 and returns the new value, and value() returns the current value. The count must be private (not accessible as a property). If start is omitted, begin at 0. Each call to makeCounter must create an independent counter.

Given code:

```
function makeCounter(start) {
  // your code
}
```

Reference solution:

```
function makeCounter(start = 0) {
  let count = start;
  return {
    increment() { count += 1; return count; },
    decrement() { count -= 1; return count; },
    value() { return count; }
  };
}
```

Evaluation points: Uses a closure variable to keep the count private; Defaults start to 0; increment/decrement return the updated value; Separate counters do not share state

**7. PRG-JAVASCRIPT-S1-07** · Sorting/Searching · write_code · Medium · ~5 min

Write a function sortProducts(products) where products is an array of objects { name, price }. Return a NEW array sorted by price ascending; products with the same price are ordered by name alphabetically (A to Z). The original array must not be modified.

Given code:

```
function sortProducts(products) {
  // your code
}
```

Reference solution:

```
function sortProducts(products) {
  return [...products].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
}
```

Evaluation points: Copies the array before sorting (does not mutate input); Uses a numeric comparator (a.price - b.price), not the default string sort; Breaks ties by name alphabetically; Returns the sorted array

**8. PRG-JAVASCRIPT-S1-08** · Types & Coercion · explain_output · Medium · ~5 min

Four console.log lines mix numbers and strings with +, -, == and ===. Write the exact output and explain the type coercion (or lack of it) on each line.

Given code:

```
console.log(1 + "2");
console.log("5" - 2);
console.log(0 == "");
console.log(0 === "");
```

Reference solution:

```
Output:
12
3
true
false

Explanation: + with a string operand does string concatenation, so 1 becomes "1" and the result is "12". The - operator only works on numbers, so "5" is converted to 5 and the result is 3. == performs type coercion: "" converts to the number 0, so 0 == "" is true. === compares without coercion and the types differ (number vs string), so it is false.
```

Evaluation points: States the exact output: 12, 3, true, false; Explains + concatenates when one operand is a string; Explains - converts strings to numbers; Explains == coerces while === compares type and value

**9. PRG-JAVASCRIPT-S1-09** · Recursion · write_code · Hard · ~6 min

Write a recursive function flatten(arr) that takes an array which may contain nested arrays to any depth and returns a new, single-level array with all values in their original order. Do not use Array.prototype.flat. Example: flatten([1, [2, [3, [4]], 5]]) returns [1, 2, 3, 4, 5].

Given code:

```
function flatten(arr) {
  // your code
}
```

Reference solution:

```
function flatten(arr) {
  const result = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...flatten(item));
    } else {
      result.push(item);
    }
  }
  return result;
}
```

Evaluation points: Uses recursion for nested arrays of any depth; Uses Array.isArray to detect arrays; Preserves original order; Does not use .flat(); Handles empty nested arrays

**10. PRG-JAVASCRIPT-S1-10** · Strings · write_code · Hard · ~6 min

Write a function parseQuery(query) that parses a URL query string such as "item=pen&qty=2&tag=a&tag=b" into an object. Values are strings and must be URL-decoded (use decodeURIComponent). A key that appears more than once maps to an array of its values in order; a key that appears once maps to a single string. A key with no "=" gets the value "" (empty string). An empty input returns {}.

Given code:

```
function parseQuery(query) {
  // your code
}
```

Reference solution:

```
function parseQuery(query) {
  const result = {};
  if (!query) return result;
  for (const part of query.split("&")) {
    const idx = part.indexOf("=");
    const key = decodeURIComponent(idx === -1 ? part : part.slice(0, idx));
    const value = idx === -1 ? "" : decodeURIComponent(part.slice(idx + 1));
    if (key in result) {
      result[key] = [].concat(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
```

Evaluation points: Splits on "&" and then on the first "="; Decodes keys/values with decodeURIComponent; Turns repeated keys into an array in order; Handles missing "=" and empty input

### JavaScript – Set 2

**1. PRG-JAVASCRIPT-S2-01** · Conditionals · write_code · Easy · ~3 min

Write a function gradeFor(score) that returns a letter grade for a numeric score from 0 to 100: "A" for 90 and above, "B" for 80-89, "C" for 70-79, "D" for 60-69 and "F" below 60.

Given code:

```
function gradeFor(score) {
  // your code
}
```

Reference solution:

```
function gradeFor(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
```

Evaluation points: Checks thresholds in the correct order; Boundary values (90, 80, 70, 60) map correctly; Returns "F" for scores below 60

**2. PRG-JAVASCRIPT-S2-02** · Variables & Scope · explain_output · Easy · ~3 min

This snippet pushes to an array declared with const and then tries to reassign it inside try/catch. Give the exact console output and explain what const does and does not prevent.

Given code:

```
const items = [1, 2];
items.push(3);
console.log(items.length);
try {
  items = [];
} catch (e) {
  console.log(e.name);
}
console.log(items.join(","));
```

Reference solution:

```
Output:
3
TypeError
1,2,3

Explanation: const prevents re-assigning the variable, not changing the value it refers to. push() mutates the same array, so the length becomes 3. Assigning a new array to a const variable throws a TypeError ("Assignment to constant variable"), which is caught and its name printed. The array still holds 1,2,3.
```

Evaluation points: States the exact output: 3, TypeError, 1,2,3; Explains const blocks re-assignment, not mutation; Identifies the error type as TypeError

**3. PRG-JAVASCRIPT-S2-03** · Strings · write_code · Easy · ~3 min

Write a function capitalizeWords(text) that returns the text with the first letter of every word in upper case and the remaining letters in lower case. Words are separated by single spaces. Example: capitalizeWords("hELLO wORLD") returns "Hello World".

Given code:

```
function capitalizeWords(text) {
  // your code
}
```

Reference solution:

```
function capitalizeWords(text) {
  return text
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
```

Evaluation points: Splits into words and rejoins with spaces; Upper-cases the first character of each word; Lower-cases the rest of each word; Handles an empty string without error

**4. PRG-JAVASCRIPT-S2-04** · Array Methods · write_code · Medium · ~5 min

Write a function activeEmployeeNames(employees, department) where employees is an array of objects { name, department, active }. Return an array of the names of employees who are active and belong to the given department, in the original order. Use array methods (filter/map) rather than a manual loop.

Given code:

```
function activeEmployeeNames(employees, department) {
  // your code
}
```

Reference solution:

```
function activeEmployeeNames(employees, department) {
  return employees
    .filter(e => e.active && e.department === department)
    .map(e => e.name);
}
```

Evaluation points: Filters on both active and department; Maps to names only; Preserves original order; Returns [] when nothing matches

**5. PRG-JAVASCRIPT-S2-05** · this Keyword · fix_bug · Medium · ~5 min

The cart.total() method should return the sum of the item prices after applying the discount (for the data below it should return 54), but calling it throws an error. Explain the bug and fix the code.

Given code:

```
const cart = {
  items: [10, 20, 30],
  discount: 0.1,
  total: () => {
    const sum = this.items.reduce((s, p) => s + p, 0);
    return sum * (1 - this.discount);
  }
};
```

Reference solution:

```
const cart = {
  items: [10, 20, 30],
  discount: 0.1,
  total() {
    const sum = this.items.reduce((s, p) => s + p, 0);
    return sum * (1 - this.discount);
  }
};
// Bug: arrow functions do not get their own "this"; they use the "this" of the surrounding scope, so this.items is undefined. A regular method (or function expression) receives the cart as "this" when called as cart.total().
```

Evaluation points: Identifies that arrow functions do not bind their own this; Replaces the arrow with a method shorthand or function expression; Correct result 54 for the sample data

**6. PRG-JAVASCRIPT-S2-06** · Destructuring & Spread · write_code · Medium · ~5 min

Write a function mergeSettings(defaults, overrides) that returns a NEW object containing all keys of defaults, with values replaced by those in overrides. Any key in overrides whose value is undefined must be ignored (the default is kept). Neither input object may be modified. Use the spread operator.

Given code:

```
function mergeSettings(defaults, overrides) {
  // your code
}
```

Reference solution:

```
function mergeSettings(defaults, overrides) {
  const cleaned = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return { ...defaults, ...cleaned };
}
```

Evaluation points: Returns a new object using spread; Override values win over defaults; Skips undefined override values; Does not mutate either input; Keeps falsy but defined values such as 0, false or ""

**7. PRG-JAVASCRIPT-S2-07** · Promises & Async · write_code · Medium · ~5 min

Write an async function retry(task, attempts) where task is a function that returns a Promise. Call task(); if it resolves, return its value. If it rejects, try again, up to attempts calls in total. If every attempt fails, throw the error from the last attempt. No network access is involved; task is supplied by the caller.

Given code:

```
async function retry(task, attempts) {
  // your code
}
```

Reference solution:

```
async function retry(task, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
```

Evaluation points: Uses await inside try/catch; Stops as soon as one attempt succeeds; Makes at most attempts calls; Rethrows the last error when all attempts fail

**8. PRG-JAVASCRIPT-S2-08** · Objects · explain_output · Medium · ~5 min

An object containing a nested array is copied with the spread operator and the copy is then modified. Predict the exact console output and explain shallow versus deep copying.

Given code:

```
const a = { n: 1, tags: ["x"] };
const b = { ...a };
b.n = 2;
b.tags.push("y");
console.log(a.n, a.tags.length);
console.log(a.tags === b.tags);
```

Reference solution:

```
Output:
1 2
true

Explanation: The spread operator makes a shallow copy. The primitive property n is copied, so changing b.n does not affect a.n (still 1). The tags property holds a reference to the same array, so pushing "y" through b also changes the array seen through a (length 2), and a.tags === b.tags is true.
```

Evaluation points: States the exact output: "1 2" then "true"; Explains spread creates a shallow copy; Explains primitives are copied but nested objects/arrays are shared by reference

**9. PRG-JAVASCRIPT-S2-09** · Classes · write_code · Hard · ~6 min

Write a class BankAccount. The constructor takes an opening balance (default 0). Provide: deposit(amount) and withdraw(amount), which update the balance; a read-only getter balance. Both methods must throw an Error with message "Invalid amount" if amount is not a positive number. withdraw must throw an Error with message "Insufficient funds" if amount is greater than the current balance (the balance must stay unchanged).

Given code:

```
class BankAccount {
  // your code
}
```

Reference solution:

```
class BankAccount {
  #balance;
  constructor(openingBalance = 0) {
    this.#balance = openingBalance;
  }
  get balance() {
    return this.#balance;
  }
  deposit(amount) {
    if (typeof amount !== "number" || amount <= 0) throw new Error("Invalid amount");
    this.#balance += amount;
  }
  withdraw(amount) {
    if (typeof amount !== "number" || amount <= 0) throw new Error("Invalid amount");
    if (amount > this.#balance) throw new Error("Insufficient funds");
    this.#balance -= amount;
  }
}
```

Evaluation points: Constructor with default opening balance; Getter exposes balance without a setter; Validates amount is a positive number; Throws "Insufficient funds" and leaves balance unchanged; Uses the class syntax correctly

**10. PRG-JAVASCRIPT-S2-10** · Recursion · write_code · Hard · ~6 min

Write a function deepEqual(a, b) that returns true if a and b are deeply equal: primitives are compared with ===; arrays are equal if they have the same length and deeply equal elements in order; plain objects are equal if they have the same set of keys and deeply equal values for each key. An array is never equal to a non-array object. null must be handled correctly.

Given code:

```
function deepEqual(a, b) {
  // your code
}
```

Reference solution:

```
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}
```

Evaluation points: Handles primitives and null without errors; Recurses into nested arrays and objects; Compares key sets (same count, same keys); Distinguishes arrays from plain objects

### JavaScript – Set 3

**1. PRG-JAVASCRIPT-S3-01** · Closures · explain_output · Easy · ~3 min

Two loops schedule setTimeout callbacks, one using a var counter and one using a let counter. Write the exact console output and explain how each loop variable is captured by the callbacks.

Given code:

```
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var", i), 0);
}
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log("let", j), 0);
}
```

Reference solution:

```
Output:
var 3
var 3
var 3
let 0
let 1
let 2

Explanation: The callbacks run after both loops have finished. With var there is a single function-scoped i shared by all callbacks, and by then it equals 3. With let each loop iteration gets a new binding of j, so each callback closes over its own value 0, 1 and 2.
```

Evaluation points: States the exact output in order; Explains callbacks run after the loops complete; Explains var creates one shared binding; Explains let creates a new binding per iteration

**2. PRG-JAVASCRIPT-S3-02** · Strings · write_code · Easy · ~3 min

Write a function isPalindrome(text) that returns true if text reads the same forwards and backwards, ignoring letter case and any character that is not a letter or digit. Example: isPalindrome("Never odd or even") returns true.

Given code:

```
function isPalindrome(text) {
  // your code
}
```

Reference solution:

```
function isPalindrome(text) {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned === cleaned.split("").reverse().join("");
}
```

Evaluation points: Normalises case; Removes non-alphanumeric characters; Compares with the reversed string (or two-pointer check); Returns a boolean

**3. PRG-JAVASCRIPT-S3-03** · Types & Coercion · fix_bug · Easy · ~3 min

countZeros(values) should count how many elements are exactly the number 0. The array may contain mixed types. For [0, "0", "", false, 0, null] it should return 2 but returns 5. Fix the bug and explain it.

Given code:

```
function countZeros(values) {
  let count = 0;
  for (const v of values) {
    if (v == 0) count++;
  }
  return count;
}
```

Reference solution:

```
function countZeros(values) {
  let count = 0;
  for (const v of values) {
    if (v === 0) count++;
  }
  return count;
}
// Bug: == coerces types, so "0", "" and false are all converted to 0 and counted. === compares without coercion.
```

Evaluation points: Replaces == with ===; Explains loose equality coerces "0", "" and false to 0; Returns 2 for the sample input

**4. PRG-JAVASCRIPT-S3-04** · Array Methods · write_code · Medium · ~5 min

Write a function findFirstOverdue(invoices, today) where invoices is an array of { id, dueDate, paid } and dates are strings in "YYYY-MM-DD" format (today uses the same format). Return the first invoice (in array order) that is not paid and whose dueDate is before today, or null if there is none. Use Array.prototype.find.

Given code:

```
function findFirstOverdue(invoices, today) {
  // your code
}
```

Reference solution:

```
function findFirstOverdue(invoices, today) {
  return invoices.find(inv => !inv.paid && inv.dueDate < today) ?? null;
}
```

Evaluation points: Uses find to return the first match; Checks both unpaid and dueDate before today (strictly); Returns null instead of undefined when nothing matches; Date strings in YYYY-MM-DD can be compared directly (or converted to Date)

**5. PRG-JAVASCRIPT-S3-05** · Array Methods · write_code · Medium · ~5 min

Write a function totalByCategory(orders) where orders is an array of { category, amount }. Return an object mapping each category to the sum of its amounts. Use Array.prototype.reduce. Example: [{ category: "books", amount: 10 }, { category: "toys", amount: 5 }, { category: "books", amount: 7 }] returns { books: 17, toys: 5 }.

Given code:

```
function totalByCategory(orders) {
  // your code
}
```

Reference solution:

```
function totalByCategory(orders) {
  return orders.reduce((totals, { category, amount }) => {
    totals[category] = (totals[category] || 0) + amount;
    return totals;
  }, {});
}
```

Evaluation points: Uses reduce with an initial empty object; Initialises each category before adding; Returns the accumulator from the callback; Returns {} for an empty array

**6. PRG-JAVASCRIPT-S3-06** · JSON & Error Handling · write_code · Medium · ~5 min

Write a function parseConfig(jsonText) that parses a JSON string and returns the resulting object. If the text is not valid JSON, throw an Error with message "Invalid config". If the parsed value does not have a numeric "port" property, throw an Error with message "Missing port". If "host" is missing, default it to "localhost" in the returned object.

Given code:

```
function parseConfig(jsonText) {
  // your code
}
```

Reference solution:

```
function parseConfig(jsonText) {
  let config;
  try {
    config = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("Invalid config");
  }
  if (!config || typeof config.port !== "number") {
    throw new Error("Missing port");
  }
  return { host: "localhost", ...config };
}
```

Evaluation points: Wraps JSON.parse in try/catch; Throws "Invalid config" on a parse error; Validates port is a number; Defaults host to "localhost" without overwriting a given host

**7. PRG-JAVASCRIPT-S3-07** · Functions · write_code · Medium · ~5 min

Write a function compose(...fns) that takes any number of single-argument functions and returns a new function that applies them from right to left. compose(f, g, h)(x) must equal f(g(h(x))). compose() with no functions returns a function that returns its argument unchanged. Use arrow functions.

Given code:

```
const compose = (...fns) => {
  // your code
};
```

Reference solution:

```
const compose = (...fns) => (x) => fns.reduceRight((value, fn) => fn(value), x);
```

Evaluation points: Uses rest parameters to accept any number of functions; Returns a function (higher-order); Applies functions right to left; Works with zero functions (identity)

**8. PRG-JAVASCRIPT-S3-08** · this Keyword · explain_output · Medium · ~5 min

The same greet method is invoked three ways: on its original object, on a second object that borrows it, and through .call(). Give the exact output and explain how this is determined in each call.

Given code:

```
const user = {
  name: "Asha",
  greet() {
    return "Hi " + this.name;
  }
};
const other = { name: "Ravi", greet: user.greet };
console.log(user.greet());
console.log(other.greet());
console.log(user.greet.call({ name: "Meera" }));
```

Reference solution:

```
Output:
Hi Asha
Hi Ravi
Hi Meera

Explanation: For a regular function, this is decided by how the function is called, not where it was defined. user.greet() is called on user, so this is user. other.greet() calls the same function on other, so this is other. .call() sets this explicitly to the object passed in.
```

Evaluation points: States the exact output; Explains this is determined by the call site for regular functions; Explains .call() sets this explicitly

**9. PRG-JAVASCRIPT-S3-09** · Classes · write_code · Hard · ~6 min

Write a class Employee with a constructor(name, salary) and a method describe() returning "<name> earns <salary>". Then write a class Manager that extends Employee, whose constructor(name, salary) also creates an empty list of reports, a method addReport(employee) that adds an Employee to that list, and overrides describe() to return the Employee description followed by " and manages <n> people" (call the parent method using super).

Given code:

```
class Employee {
  // your code
}

class Manager extends Employee {
  // your code
}
```

Reference solution:

```
class Employee {
  constructor(name, salary) {
    this.name = name;
    this.salary = salary;
  }
  describe() {
    return this.name + " earns " + this.salary;
  }
}

class Manager extends Employee {
  constructor(name, salary) {
    super(name, salary);
    this.reports = [];
  }
  addReport(employee) {
    this.reports.push(employee);
  }
  describe() {
    return super.describe() + " and manages " + this.reports.length + " people";
  }
}
```

Evaluation points: Uses extends and calls super(...) before using this; Each Manager has its own reports array; Overrides describe() and reuses super.describe(); Correct string format

**10. PRG-JAVASCRIPT-S3-10** · Sorting/Searching · fix_bug · Hard · ~6 min

binarySearch(arr, target) should return the index of target in a sorted array of numbers, or -1 if it is not present. For some inputs (e.g. searching for 4 in [1, 3, 5, 7, 9]) it never finishes. Find the bug, explain why it loops forever, and fix it.

Given code:

```
function binarySearch(arr, target) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return -1;
}
```

Reference solution:

```
function binarySearch(arr, target) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return -1;
}
// Bug: lo = mid does not shrink the range when hi = lo + 1 (mid equals lo), so the loop repeats forever. Since arr[mid] is already known to be too small, use lo = mid + 1.
```

Evaluation points: Identifies lo = mid as the cause; Explains the search range stops shrinking when mid equals lo; Fixes with lo = mid + 1 while keeping the half-open [lo, hi) range consistent; Returns -1 for missing targets

### JavaScript – Set 4

**1. PRG-JAVASCRIPT-S4-01** · Loops · write_code · Easy · ~3 min

Write a function fizzBuzz(n) that returns an array of strings for the numbers 1 to n: "FizzBuzz" for multiples of both 3 and 5, "Fizz" for multiples of 3, "Buzz" for multiples of 5, and the number as a string otherwise. Example: fizzBuzz(5) returns ["1", "2", "Fizz", "4", "Buzz"].

Given code:

```
function fizzBuzz(n) {
  // your code
}
```

Reference solution:

```
function fizzBuzz(n) {
  const result = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) result.push("FizzBuzz");
    else if (i % 3 === 0) result.push("Fizz");
    else if (i % 5 === 0) result.push("Buzz");
    else result.push(String(i));
  }
  return result;
}
```

Evaluation points: Loops from 1 to n inclusive; Checks the combined case (15) first; Returns numbers as strings; Returns [] for n = 0

**2. PRG-JAVASCRIPT-S4-02** · Strings · write_code · Easy · ~3 min

Write a function countVowels(text) that returns how many vowels (a, e, i, o, u, upper or lower case) the string contains. Example: countVowels("Invoice Total") returns 6.

Given code:

```
function countVowels(text) {
  // your code
}
```

Reference solution:

```
function countVowels(text) {
  let count = 0;
  for (const ch of text.toLowerCase()) {
    if ("aeiou".includes(ch)) count++;
  }
  return count;
}
```

Evaluation points: Handles both upper and lower case; Counts only a, e, i, o, u; Returns 0 for an empty string or no vowels

**3. PRG-JAVASCRIPT-S4-03** · Types & Coercion · explain_output · Easy · ~3 min

Using typeof and Array.isArray on null, an array, undefined and NaN: write the exact console output and explain any surprising results.

Given code:

```
console.log(typeof null);
console.log(typeof []);
console.log(Array.isArray([]));
console.log(typeof undefined);
console.log(typeof NaN);
```

Reference solution:

```
Output:
object
object
true
undefined
number

Explanation: typeof null is "object" (a long-standing quirk of the language). Arrays are objects, so typeof [] is "object"; Array.isArray is the correct way to test for an array. typeof undefined is "undefined". NaN ("not a number") is still of type number.
```

Evaluation points: States the exact output; Notes typeof null is "object" as a known quirk; Explains typeof cannot distinguish arrays; use Array.isArray; Notes NaN is of type number

**4. PRG-JAVASCRIPT-S4-04** · Arrays · write_code · Medium · ~5 min

Write a function chunk(items, size) that splits an array into consecutive groups of length size and returns an array of these groups. The last group may be shorter. The original array must not be modified. Assume size is a positive integer. Example: chunk([1, 2, 3, 4, 5], 2) returns [[1, 2], [3, 4], [5]].

Given code:

```
function chunk(items, size) {
  // your code
}
```

Reference solution:

```
function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
```

Evaluation points: Steps through the array by size; Uses slice (non-mutating) or equivalent; Handles a shorter final chunk; Returns [] for an empty array

**5. PRG-JAVASCRIPT-S4-05** · Promises & Async · fix_bug · Medium · ~5 min

getTotal(fetchPrice, ids) should return (a Promise of) the sum of prices, where fetchPrice(id) returns a Promise that resolves to a number. It always resolves to 0. Explain the bug and fix it so the prices are awaited before returning.

Given code:

```
async function getTotal(fetchPrice, ids) {
  let total = 0;
  ids.forEach(async (id) => {
    total += await fetchPrice(id);
  });
  return total;
}
```

Reference solution:

```
async function getTotal(fetchPrice, ids) {
  let total = 0;
  for (const id of ids) {
    total += await fetchPrice(id);
  }
  return total;
}
// Bug: forEach does not wait for async callbacks; it starts them and returns immediately, so total is returned before any price has been added. Use for...of with await (or Promise.all and then sum).
```

Evaluation points: Explains forEach ignores the promises returned by async callbacks; Uses for...of with await, or Promise.all; Returns the correct total

**6. PRG-JAVASCRIPT-S4-06** · Destructuring & Spread · write_code · Medium · ~5 min

Write a function summarizeOrder(order) where order has the shape { id, customer: { name }, items: [{ qty, price }] }. Use destructuring to read the values and return the string "Order #<id> for <name>: <count> items, total <total>", where count is the sum of all qty and total is the sum of qty * price formatted with exactly 2 decimals.

Given code:

```
function summarizeOrder(order) {
  // your code
}
```

Reference solution:

```
function summarizeOrder({ id, customer: { name }, items }) {
  let count = 0;
  let total = 0;
  for (const { qty, price } of items) {
    count += qty;
    total += qty * price;
  }
  return "Order #" + id + " for " + name + ": " + count + " items, total " + total.toFixed(2);
}
```

Evaluation points: Uses nested destructuring for customer name; Destructures qty and price from items; Sums quantities and line totals correctly; Formats the total with toFixed(2)

**7. PRG-JAVASCRIPT-S4-07** · Conditionals · write_code · Medium · ~5 min

Write a function passwordProblems(password) that returns an array of messages for every rule the password breaks, in this order: "Too short" (fewer than 8 characters), "Needs a digit" (no 0-9), "Needs an uppercase letter" (no A-Z), "Needs a lowercase letter" (no a-z). Return [] if the password is valid.

Given code:

```
function passwordProblems(password) {
  // your code
}
```

Reference solution:

```
function passwordProblems(password) {
  const problems = [];
  if (password.length < 8) problems.push("Too short");
  if (!/[0-9]/.test(password)) problems.push("Needs a digit");
  if (!/[A-Z]/.test(password)) problems.push("Needs an uppercase letter");
  if (!/[a-z]/.test(password)) problems.push("Needs a lowercase letter");
  return problems;
}
```

Evaluation points: Checks every rule independently (not else-if); Messages in the required order; Correct length boundary (8 is valid); Returns [] for a valid password

**8. PRG-JAVASCRIPT-S4-08** · Exceptions · write_code · Medium · ~5 min

Write a custom error class ValidationError that extends Error, takes (field, message) in its constructor, stores field as a property, and sets name to "ValidationError". Then write validateProduct(product) that throws a ValidationError with field "name" and message "Name is required" if name is missing or an empty string, or with field "price" and message "Price must be positive" if price is not a number greater than 0. Otherwise it returns true.

Given code:

```
class ValidationError extends Error {
  // your code
}

function validateProduct(product) {
  // your code
}
```

Reference solution:

```
class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

function validateProduct(product) {
  if (!product.name) {
    throw new ValidationError("name", "Name is required");
  }
  if (typeof product.price !== "number" || product.price <= 0) {
    throw new ValidationError("price", "Price must be positive");
  }
  return true;
}
```

Evaluation points: Extends Error and calls super(message); Sets name and field properties; Throws the right error for each rule; Returns true for a valid product

**9. PRG-JAVASCRIPT-S4-09** · Recursion · write_code · Hard · ~6 min

Write a recursive function subsets(items) that returns all subsets of an array of distinct values, as an array of arrays. Each subset must keep the elements in their original relative order, and the subsets must be returned in this order: for [1, 2, 3] the result is [[], [3], [2], [2, 3], [1], [1, 3], [1, 2], [1, 2, 3]] (subsets without the first element, followed by the same subsets with the first element prepended).

Given code:

```
function subsets(items) {
  // your code
}
```

Reference solution:

```
function subsets(items) {
  if (items.length === 0) return [[]];
  const [first, ...rest] = items;
  const without = subsets(rest);
  const withFirst = without.map(s => [first, ...s]);
  return [...without, ...withFirst];
}
```

Evaluation points: Correct base case returning [[]]; Recursive step on the rest of the array; Builds subsets with and without the first element; Result has 2^n subsets in the required order

**10. PRG-JAVASCRIPT-S4-10** · Recursion · explain_output · Hard · ~6 min

Trace the recursive build(n) function below, which combines results with spread syntax. State exactly what is logged for build(2) and build(3) and show the calls that produce it.

Given code:

```
function build(n) {
  if (n <= 1) return [n];
  return [...build(n - 1), n, ...build(n - 2)];
}
console.log(build(2).join(" "));
console.log(build(3).join(" "));
```

Reference solution:

```
Output:
1 2 0
1 2 0 3 1

Explanation: Base cases: build(1) = [1] and build(0) = [0]. build(2) = [...build(1), 2, ...build(0)] = [1, 2, 0]. build(3) = [...build(2), 3, ...build(1)] = [1, 2, 0, 3, 1].
```

Evaluation points: States the exact output for both lines; Identifies the base cases build(1) and build(0); Shows the trace combining results with spread

### JavaScript – Set 5

**1. PRG-JAVASCRIPT-S5-01** · Conditionals · write_code · Easy · ~3 min

Write a function isLeapYear(year) that returns true if year is a leap year: divisible by 4, except years divisible by 100, unless they are also divisible by 400. Example: 2024 and 2000 are leap years; 1900 and 2023 are not.

Given code:

```
function isLeapYear(year) {
  // your code
}
```

Reference solution:

```
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
```

Evaluation points: Handles the divisible-by-4 rule; Excludes centuries not divisible by 400; Includes years divisible by 400; Returns a boolean

**2. PRG-JAVASCRIPT-S5-02** · Debugging · fix_bug · Easy · ~3 min

average(nums) should return the average of an array of numbers, and 0 for an empty array. It currently returns NaN for every input. Find and fix the problem(s).

Given code:

```
function average(nums) {
  let sum;
  for (const n of nums) {
    sum += n;
  }
  return sum / nums.length;
}
```

Reference solution:

```
function average(nums) {
  if (nums.length === 0) return 0;
  let sum = 0;
  for (const n of nums) {
    sum += n;
  }
  return sum / nums.length;
}
// Bug: sum was declared without a value, so it is undefined and undefined + number is NaN. Initialise it to 0, and handle the empty array to avoid 0 / 0 (NaN).
```

Evaluation points: Initialises sum to 0; Explains undefined + number gives NaN; Returns 0 for an empty array

**3. PRG-JAVASCRIPT-S5-03** · Functions · explain_output · Easy · ~3 min

One function reassigns a number parameter and another modifies a property of an object parameter. Predict the single line of output and explain why only one change is visible to the caller.

Given code:

```
let count = 5;
function change(n) {
  n = 10;
}
function changeObj(o) {
  o.value = 10;
}
const box = { value: 5 };
change(count);
changeObj(box);
console.log(count, box.value);
```

Reference solution:

```
Output:
5 10

Explanation: Arguments are passed by value. change receives a copy of the number 5; reassigning its parameter n does not affect count. changeObj receives a copy of the reference to the same object, so modifying o.value changes the object that box also refers to.
```

Evaluation points: States the exact output "5 10"; Explains primitives are copied into parameters; Explains objects are accessed through a shared reference, so mutation is visible to the caller

**4. PRG-JAVASCRIPT-S5-04** · Arrays · write_code · Medium · ~5 min

Write a function rotateRight(items, k) that returns a NEW array with the elements rotated k positions to the right. k is a non-negative integer and may be larger than the array length. The input array must not be modified. Example: rotateRight([1, 2, 3, 4, 5], 2) returns [4, 5, 1, 2, 3].

Given code:

```
function rotateRight(items, k) {
  // your code
}
```

Reference solution:

```
function rotateRight(items, k) {
  if (items.length === 0) return [];
  const shift = k % items.length;
  if (shift === 0) return [...items];
  return [...items.slice(-shift), ...items.slice(0, -shift)];
}
```

Evaluation points: Uses k % length to handle large k; Returns a new array without mutating input; Handles k = 0 and empty arrays; Correct element order after rotation

**5. PRG-JAVASCRIPT-S5-05** · Objects · write_code · Medium · ~5 min

Write a function changedFields(before, after) that compares two flat objects and returns an array of { field, from, to } for every key whose value differs (using ===). Include keys present in only one object (the missing side is undefined). Return the results sorted by field name.

Given code:

```
function changedFields(before, after) {
  // your code
}
```

Reference solution:

```
function changedFields(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  for (const field of keys) {
    if (before[field] !== after[field]) {
      changes.push({ field, from: before[field], to: after[field] });
    }
  }
  return changes.sort((a, b) => a.field.localeCompare(b.field));
}
```

Evaluation points: Considers keys from both objects (e.g. with a Set); Compares values with ===; Reports added and removed keys with undefined on the missing side; Sorts the result by field name

**6. PRG-JAVASCRIPT-S5-06** · Sorting/Searching · explain_output · Medium · ~5 min

Arrays of numbers and words are sorted with and without a comparator. Give the exact three lines of output and explain why the default sort produces an unexpected order.

Given code:

```
const nums = [10, 1, 5, 100];
console.log(nums.sort().join(","));
console.log(nums.sort((a, b) => a - b).join(","));
const words = ["banana", "apple", "Cherry"];
console.log(words.sort().join(","));
```

Reference solution:

```
Output:
1,10,100,5
1,5,10,100
Cherry,apple,banana

Explanation: Without a comparator, sort converts elements to strings and compares them by UTF-16 code units, so "10" and "100" come before "5". Passing (a, b) => a - b sorts numerically. For strings, upper-case letters have lower code units than lower-case ones, so "Cherry" comes before "apple". (Note that sort also changes the array in place.)
```

Evaluation points: States the exact output for all three lines; Explains default sort compares values as strings; Explains the numeric comparator a - b; Explains upper-case letters sort before lower-case by default

**7. PRG-JAVASCRIPT-S5-07** · Strings · write_code · Medium · ~5 min

Write a function compress(text) that performs run-length encoding: each run of the same consecutive character is replaced by the character followed by the run length. Example: compress("aaabccdddd") returns "a3b1c2d4". An empty string returns "".

Given code:

```
function compress(text) {
  // your code
}
```

Reference solution:

```
function compress(text) {
  let result = "";
  let i = 0;
  while (i < text.length) {
    let j = i;
    while (j < text.length && text[j] === text[i]) j++;
    result += text[i] + (j - i);
    i = j;
  }
  return result;
}
```

Evaluation points: Groups consecutive identical characters; Appends character plus run length; Handles the final run correctly; Returns "" for an empty string

**8. PRG-JAVASCRIPT-S5-08** · Classes · write_code · Medium · ~5 min

Write a class Stack with methods push(item), pop() which removes and returns the top item, peek() which returns the top item without removing it, isEmpty() and a getter size. pop() and peek() must throw an Error with message "Stack is empty" when there are no items.

Given code:

```
class Stack {
  // your code
}
```

Reference solution:

```
class Stack {
  constructor() {
    this.items = [];
  }
  push(item) {
    this.items.push(item);
  }
  pop() {
    if (this.isEmpty()) throw new Error("Stack is empty");
    return this.items.pop();
  }
  peek() {
    if (this.isEmpty()) throw new Error("Stack is empty");
    return this.items[this.items.length - 1];
  }
  isEmpty() {
    return this.items.length === 0;
  }
  get size() {
    return this.items.length;
  }
}
```

Evaluation points: LIFO order for push/pop; peek does not remove the item; Throws "Stack is empty" on pop/peek of an empty stack; size is a getter reflecting the number of items

**9. PRG-JAVASCRIPT-S5-09** · Sorting/Searching · write_code · Hard · ~6 min

Write a function mergeIntervals(intervals) where intervals is an array of [start, end] pairs (start <= end) in any order. Merge all overlapping or touching intervals (e.g. [1, 3] and [3, 5] become [1, 5]) and return the merged list sorted by start. Do not modify the input array.

Given code:

```
function mergeIntervals(intervals) {
  // your code
}
```

Reference solution:

```
function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}
```

Evaluation points: Sorts a copy by start with a numeric comparator; Merges overlapping and touching intervals; Uses Math.max so contained intervals are handled; Does not mutate the input intervals; Returns [] for empty input

**10. PRG-JAVASCRIPT-S5-10** · Closures · fix_bug · Hard · ~6 min

makeFib() returns a memoized Fibonacci function (fib(0) = 0, fib(1) = 1). It returns correct values, but fib(50) takes far too long to finish because the memoization does not work. Find the bug and fix it so each value is computed only once.

Given code:

```
function makeFib() {
  const cache = {};
  return function fib(n) {
    if (n <= 1) return n;
    if (cache[n] !== undefined) return cache[n];
    const result = fib(n - 1) + fib(n - 2);
    return result;
  };
}
```

Reference solution:

```
function makeFib() {
  const cache = {};
  return function fib(n) {
    if (n <= 1) return n;
    if (cache[n] !== undefined) return cache[n];
    const result = fib(n - 1) + fib(n - 2);
    cache[n] = result;
    return result;
  };
}
// Bug: the result is never stored in the cache, so the lookup always misses and the recursion stays exponential. Save it with cache[n] = result before returning.
```

Evaluation points: Identifies that the cache is never written; Stores the computed value before returning; Explains the closure keeps the cache between calls; fib(50) completes quickly with the correct value

## Python

### Python – Set 1

**1. PRG-PYTHON-S1-01** · Strings · write_code · Easy · ~3 min

Write a function count_vowels(text) that returns the number of vowels (a, e, i, o, u)       in the string text. The check must be case-insensitive. Return 0 for an empty string.

Reference solution:

```
def count_vowels(text):
    count = 0
    for ch in text.lower():
        if ch in "aeiou":
            count += 1
    return count
```

Evaluation points: Counts a, e, i, o, u only (y is not a vowel); Case-insensitive (upper-case vowels counted); Returns 0 for an empty string; Returns an int, not a list or string

**2. PRG-PYTHON-S1-02** · Variables & Types · explain_output · Easy · ~3 min

This program divides two integers with the /, // and % operators and checks a float comparison. What does it print? Write the exact output line by line, then briefly explain why each line is produced.

Given code:

```
a = 7
b = 2
print(a / b)
print(a // b)
print(a % b)
print(type(a / b).__name__)
print(a * 1.0 == 7)
```

Reference solution:

```
Output:
3.5
3
1
float
True

Explanation: / is true division and always returns a float (3.5). // is floor division, which keeps             the int type for int operands (3). % gives the remainder (1). The type of a / b is float.             7.0 == 7 compares numeric values, so it is True.
```

Evaluation points: States 3.5 for / (true division returns float); States 3 for // and 1 for %; Identifies the result type as float; Explains that 7.0 == 7 is True because values are compared

**3. PRG-PYTHON-S1-03** · Conditionals · write_code · Easy · ~3 min

Write a function shipping_fee(order_total) for an online store. Rules: an order total of       100 or more ships free (0); a total of 50 or more but below 100 costs 5; any lower total costs 10.       If order_total is negative, raise ValueError.

Reference solution:

```
def shipping_fee(order_total):
    if order_total < 0:
        raise ValueError("order_total cannot be negative")
    if order_total >= 100:
        return 0
    if order_total >= 50:
        return 5
    return 10
```

Evaluation points: Boundary 100 is free and boundary 50 costs 5 (>= not >); Totals below 50 cost 10; Negative totals raise ValueError; Conditions checked in a correct order

**4. PRG-PYTHON-S1-04** · Maps/Dictionaries · write_code · Medium · ~5 min

Write a function word_frequency(text) that returns a dictionary mapping each word to how       many times it appears. Words are separated by whitespace, comparison is case-insensitive       (store keys in lower case), and the punctuation characters . , ! ? must be stripped from the       start and end of each word. Ignore anything that becomes empty after stripping.

Reference solution:

```
def word_frequency(text):
    counts = {}
    for raw in text.split():
        word = raw.strip(".,!?").lower()
        if word:
            counts[word] = counts.get(word, 0) + 1
    return counts
```

Evaluation points: Splits on any whitespace; Lower-cases words before counting; Strips . , ! ? from word edges; Skips tokens that are empty after stripping; Uses a dict with get/defaultdict or equivalent counting

**5. PRG-PYTHON-S1-05** · Debugging · fix_bug · Medium · ~5 min

The function add_to_cart(item, cart) should add item to the given cart and return it; when       no cart is passed it should start a new, empty cart. Calling add_to_cart('pen') and then       add_to_cart('book') returns ['pen', 'book'] for the second call instead of ['book']. Explain the       bug and write the corrected function.

Given code:

```
def add_to_cart(item, cart=[]):
    cart.append(item)
    return cart
```

Reference solution:

```
# Bug: the default list is created once, when the function is defined, and is shared by
# every call that omits cart. Use None as the default and create a new list inside.
def add_to_cart(item, cart=None):
    if cart is None:
        cart = []
    cart.append(item)
    return cart
```

Evaluation points: Identifies that default argument values are evaluated once at definition time; Uses None (or a sentinel) as the default and creates a new list inside the function; Still appends to and returns a cart that the caller passes in; Calls without a cart no longer share state

**6. PRG-PYTHON-S1-06** · Sorting/Searching · write_code · Medium · ~5 min

Write a function sort_employees(employees) where employees is a list of tuples       (name, department, salary). Return a new list sorted by department in ascending alphabetical       order and, within the same department, by salary from highest to lowest. Do not modify the       input list.

Reference solution:

```
def sort_employees(employees):
    return sorted(employees, key=lambda e: (e[1], -e[2]))
```

Evaluation points: Uses sorted() (or copies before sort) so the input is not modified; Primary key is department ascending; Secondary key is salary descending (e.g. negated in a tuple key); Returns the full tuples, not just names

**7. PRG-PYTHON-S1-07** · OOP Basics · complete_code · Medium · ~5 min

Complete the BankAccount class. deposit(amount) adds money and withdraw(amount) removes it;       both must raise ValueError if amount is not positive, and withdraw must raise ValueError if the       balance is insufficient. get_balance() returns the current balance. The balance starts at the       opening_balance passed to the constructor (default 0).

Given code:

```
class BankAccount:
    def __init__(self, owner, opening_balance=0):
        # TODO: store owner and balance
        pass

    def deposit(self, amount):
        # TODO
        pass

    def withdraw(self, amount):
        # TODO
        pass

    def get_balance(self):
        # TODO
        pass
```

Reference solution:

```
class BankAccount:
    def __init__(self, owner, opening_balance=0):
        self.owner = owner
        self.balance = opening_balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("amount must be positive")
        self.balance += amount

    def withdraw(self, amount):
        if amount <= 0:
            raise ValueError("amount must be positive")
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount

    def get_balance(self):
        return self.balance
```

Evaluation points: Stores owner and balance as instance attributes in __init__; deposit/withdraw reject non-positive amounts with ValueError; withdraw rejects amounts larger than the balance; Balance is unchanged when an error is raised; Uses self correctly in all methods

**8. PRG-PYTHON-S1-08** · Arrays/Lists · write_code · Medium · ~5 min

Write a function second_largest(nums) that returns the second largest distinct value in a       list of integers. If there are fewer than two distinct values, return None. Do not sort the       list; solve it in a single pass.

Reference solution:

```
def second_largest(nums):
    first = second = None
    for n in nums:
        if first is None or n > first:
            if first is not None:
                second = first
            first = n
        elif n != first and (second is None or n > second):
            second = n
    return second
```

Evaluation points: Handles duplicates of the maximum (distinct values only); Returns None for empty or single-valued lists; Works with negative numbers (does not assume 0 as a starting value); Single pass without sorting

**9. PRG-PYTHON-S1-09** · Recursion · write_code · Hard · ~6 min

Write a recursive function flatten(items) that takes a list which may contain integers and       other lists nested to any depth, and returns a single flat list of all integers in their       original left-to-right order. Example: [1, [2, [3, 4]], 5] -> [1, 2, 3, 4, 5].

Reference solution:

```
def flatten(items):
    result = []
    for item in items:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result
```

Evaluation points: Uses recursion for nested lists; Handles any nesting depth and empty inner lists; Preserves left-to-right order; Uses isinstance (or type check) to detect lists; Returns a new list without modifying the input

**10. PRG-PYTHON-S1-10** · Text Parsing · write_code · Hard · ~6 min

Write a function totals_by_customer(csv_text) that receives the contents of a small CSV       export as a single string. The first line is the header 'order_id,customer,amount'. Each       following line is one order. Return a dictionary mapping customer name to the total amount       of their orders, rounded to 2 decimals. Skip blank lines and any line that does not have       exactly 3 fields or whose amount is not a valid number. Strip whitespace around fields.

Reference solution:

```
def totals_by_customer(csv_text):
    totals = {}
    lines = csv_text.strip().splitlines()
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) != 3:
            continue
        try:
            amount = float(parts[2])
        except ValueError:
            continue
        customer = parts[1]
        totals[customer] = totals.get(customer, 0) + amount
    return {c: round(t, 2) for c, t in totals.items()}
```

Evaluation points: Skips the header line; Ignores blank lines and lines with the wrong number of fields; Uses try/except (or equivalent) to skip invalid amounts; Accumulates totals per customer in a dict; Rounds totals to 2 decimals

### Python – Set 2

**1. PRG-PYTHON-S2-01** · Loops · write_code · Easy · ~3 min

Write a function sum_of_multiples(limit) that returns the sum of all positive integers       below limit that are divisible by 3 or by 5. Numbers divisible by both must be counted only       once. Return 0 if limit is 1 or less.

Reference solution:

```
def sum_of_multiples(limit):
    total = 0
    for n in range(1, limit):
        if n % 3 == 0 or n % 5 == 0:
            total += n
    return total
```

Evaluation points: Only numbers strictly below limit are included; Uses 'or' so multiples of 15 are counted once; Returns 0 for limit <= 1; Correct loop range

**2. PRG-PYTHON-S2-02** · Strings · write_code · Easy · ~3 min

Write a function is_palindrome(text) that returns True if text reads the same forwards and       backwards when you ignore letter case and every character that is not a letter or digit,       otherwise False. An empty string counts as a palindrome.

Reference solution:

```
def is_palindrome(text):
    cleaned = [ch.lower() for ch in text if ch.isalnum()]
    return cleaned == cleaned[::-1]
```

Evaluation points: Ignores case; Ignores spaces and punctuation (keeps only alphanumerics); Compares against the reversed sequence (slicing or two pointers); Returns a bool

**3. PRG-PYTHON-S2-03** · Arrays/Lists · explain_output · Easy · ~3 min

This program assigns a list to a second name, then makes a slice copy, and appends to both. What does it print, and what do the identity checks show? Write the exact output line by line, then briefly explain why each line is produced.

Given code:

```
a = [1, 2, 3]
b = a
b.append(4)
c = a[:]
c.append(5)
print(a)
print(b)
print(c)
print(a is b, a is c)
```

Reference solution:

```
Output:
[1, 2, 3, 4]
[1, 2, 3, 4]
[1, 2, 3, 4, 5]
True False

Explanation: b = a does not copy the list; both names refer to the same object, so appending 4 through b             also changes a. a[:] creates a new (shallow) copy, so appending 5 to c does not affect a.             'is' checks identity: a and b are the same object, a and c are not.
```

Evaluation points: a and b both print [1, 2, 3, 4]; c prints [1, 2, 3, 4, 5]; Explains that assignment creates an alias, not a copy; Explains that slicing makes a new list and 'is' compares identity

**4. PRG-PYTHON-S2-04** · Sets · write_code · Medium · ~5 min

Write a function compare_customers(store_a, store_b) where each argument is a list of       customer names (possibly with repeats). Return a tuple (both, only_one) where both is a sorted       list of names that appear in both stores and only_one is a sorted list of names that appear in       exactly one of the stores. Each name appears at most once in each result list.

Reference solution:

```
def compare_customers(store_a, store_b):
    a, b = set(store_a), set(store_b)
    return sorted(a & b), sorted(a ^ b)
```

Evaluation points: Converts lists to sets to remove duplicates; Uses intersection for 'both'; Uses symmetric difference (or equivalent) for 'only_one'; Returns sorted lists inside a tuple

**5. PRG-PYTHON-S2-05** · Debugging · fix_bug · Medium · ~5 min

The function remove_negatives(nums) should return a list with all negative numbers removed,       keeping the original order. For the input [-1, -2, 3, -4] it returns [-2, 3] instead of [3].       Explain why and write a corrected version that also does not change the list passed in.

Given code:

```
def remove_negatives(nums):
    for n in nums:
        if n < 0:
            nums.remove(n)
    return nums
```

Reference solution:

```
# Bug: removing items from a list while iterating over it shifts the remaining items left,
# so the loop skips the element right after each removal. Build a new list instead.
def remove_negatives(nums):
    return [n for n in nums if n >= 0]
```

Evaluation points: Explains that modifying a list during iteration makes the loop skip elements; Builds a new list (comprehension or loop with append) instead of removing in place; Keeps zero and positive values in original order; Does not mutate the caller's list

**6. PRG-PYTHON-S2-06** · Maps/Dictionaries · write_code · Medium · ~5 min

Write a function group_by_department(employees) where employees is a list of dictionaries,       each with the keys 'name' and 'dept'. Return a dictionary mapping each department to a list of       employee names in that department, in the same order they appear in the input.

Reference solution:

```
def group_by_department(employees):
    groups = {}
    for emp in employees:
        groups.setdefault(emp["dept"], []).append(emp["name"])
    return groups
```

Evaluation points: Creates a new list the first time a department is seen (setdefault/defaultdict/if-check); Appends names, not whole dictionaries; Preserves input order within each department; Returns an empty dict for an empty input

**7. PRG-PYTHON-S2-07** · List Comprehensions · write_code · Medium · ~5 min

Write a function transpose(matrix) that returns the transpose of a rectangular matrix given       as a list of rows (lists of equal length), so that row i of the result is column i of the input.       Use list comprehensions and do not use zip. An empty matrix returns [].

Reference solution:

```
def transpose(matrix):
    if not matrix:
        return []
    return [[row[c] for row in matrix] for c in range(len(matrix[0]))]
```

Evaluation points: Uses a nested list comprehension; Result has len(matrix[0]) rows and len(matrix) columns; Handles the empty matrix; Does not use zip as instructed

**8. PRG-PYTHON-S2-08** · Inheritance · complete_code · Medium · ~5 min

Complete the Rectangle and Circle subclasses of Shape. Each subclass must call the parent       constructor with its name ('Rectangle' or 'Circle') and override area(). Rectangle takes width       and height; Circle takes radius (use math.pi). The inherited describe() method must then work       without changes, e.g. Rectangle(2, 3).describe() returns 'Rectangle with area 6.00'.

Given code:

```
import math

class Shape:
    def __init__(self, name):
        self.name = name

    def area(self):
        raise NotImplementedError

    def describe(self):
        return f"{self.name} with area {self.area():.2f}"

class Rectangle(Shape):
    # TODO: __init__(self, width, height) and area()
    pass

class Circle(Shape):
    # TODO: __init__(self, radius) and area()
    pass
```

Reference solution:

```
import math

class Shape:
    def __init__(self, name):
        self.name = name

    def area(self):
        raise NotImplementedError

    def describe(self):
        return f"{self.name} with area {self.area():.2f}"

class Rectangle(Shape):
    def __init__(self, width, height):
        super().__init__("Rectangle")
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height

class Circle(Shape):
    def __init__(self, radius):
        super().__init__("Circle")
        self.radius = radius

    def area(self):
        return math.pi * self.radius ** 2
```

Evaluation points: Both subclasses inherit from Shape; Calls super().__init__ with the correct name; Overrides area() with the correct formula; describe() works through polymorphism without being rewritten

**9. PRG-PYTHON-S2-09** · Recursion · write_code · Hard · ~6 min

Write a recursive function permutations(text) that returns a sorted list of all distinct       rearrangements of the characters in text. Do not use itertools. Duplicate characters must not       produce duplicate results, e.g. permutations('aab') returns ['aab', 'aba', 'baa'].       permutations('') returns [''].

Reference solution:

```
def permutations(text):
    if len(text) <= 1:
        return [text]
    results = set()
    for i, ch in enumerate(text):
        for rest in permutations(text[:i] + text[i + 1:]):
            results.add(ch + rest)
    return sorted(results)
```

Evaluation points: Correct base case for length 0 or 1; Recursive step fixes one character and permutes the rest; Removes duplicates (set or skip repeated characters); Returns a sorted list; Does not use itertools

**10. PRG-PYTHON-S2-10** · Debugging · fix_bug · Hard · ~6 min

apply_discount(orders, pct) should return a NEW list of orders with each price reduced by       pct percent (rounded to 2 decimals), leaving the original orders untouched. After calling it,       the caller finds that the prices in the original list have also changed. Explain the bug and       fix it.

Given code:

```
def apply_discount(orders, pct):
    updated = orders.copy()
    for order in updated:
        order["price"] = round(order["price"] * (1 - pct / 100), 2)
    return updated
```

Reference solution:

```
# Bug: orders.copy() is a shallow copy. The new list holds references to the same dict
# objects, so changing order["price"] changes the caller's dicts. Create new dicts.
def apply_discount(orders, pct):
    updated = []
    for order in orders:
        new_order = dict(order)
        new_order["price"] = round(order["price"] * (1 - pct / 100), 2)
        updated.append(new_order)
    return updated
```

Evaluation points: Explains that list.copy() is shallow and the inner dicts are shared; Creates a new dict per order (dict(order), order.copy(), {**order} or deepcopy); Original list and dicts are unchanged after the call; Discounted prices are correct and rounded

### Python – Set 3

**1. PRG-PYTHON-S3-01** · Conditionals · write_code · Easy · ~3 min

Write a function letter_grade(score) that converts a numeric score from 0 to 100 into a       grade: 90 and above 'A', 80-89 'B', 70-79 'C', 60-69 'D', below 60 'F'. Raise ValueError if       score is below 0 or above 100.

Reference solution:

```
def letter_grade(score):
    if score < 0 or score > 100:
        raise ValueError("score must be between 0 and 100")
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"
```

Evaluation points: Validates the range and raises ValueError; Correct boundaries (90 is A, 89 is B, 60 is D); Uses an if/elif chain in a sensible order; Returns the grade as a string

**2. PRG-PYTHON-S3-02** · Tuples · write_code · Easy · ~3 min

Write a function min_max(nums) that returns a tuple (smallest, largest) for a list of       numbers, using a single loop and without calling the built-in min(), max() or sorted().       Return None if the list is empty.

Reference solution:

```
def min_max(nums):
    if not nums:
        return None
    low = high = nums[0]
    for n in nums[1:]:
        if n < low:
            low = n
        elif n > high:
            high = n
    return (low, high)
```

Evaluation points: Returns a tuple in the order (smallest, largest); Initialises from the first element, not 0; Returns None for an empty list; Does not use min/max/sorted

**3. PRG-PYTHON-S3-03** · Strings · explain_output · Easy · ~3 min

Given the string "Recruitment", predict the result of each slice and string-method call below, and explain the slicing rules you used.

Given code:

```
s = "Recruitment"
print(s[0:3])
print(s[-4:])
print(s[::3])
print(s.upper().count("T"))
print(len(s), s.find("z"))
```

Reference solution:

```
Output:
Rec
ment
Rrtn
2
11 -1

Explanation: s[0:3] takes indexes 0-2 ('Rec'). s[-4:] takes the last four characters ('ment').             s[::3] takes every third character starting at index 0: indexes 0, 3, 6, 9 ('R', 'r', 't', 'n').             'RECRUITMENT' contains two 'T' characters. The string has 11 characters and find() returns -1             when the substring is not found.
```

Evaluation points: Correct slices 'Rec' and 'ment'; Correct step slice 'Rrtn'; Counts 2 T characters after upper(); States len is 11 and find returns -1 for a missing substring

**4. PRG-PYTHON-S3-04** · Exceptions · write_code · Medium · ~5 min

Write a function safe_ratios(pairs) that takes a list of (numerator, denominator) tuples and       returns a list with numerator / denominator for each pair. If a division fails because the       denominator is zero or a value is not a number, put None in that position instead of stopping.       Catch only ZeroDivisionError and TypeError.

Reference solution:

```
def safe_ratios(pairs):
    results = []
    for num, den in pairs:
        try:
            results.append(num / den)
        except (ZeroDivisionError, TypeError):
            results.append(None)
    return results
```

Evaluation points: Uses try/except inside the loop so one failure does not stop the rest; Catches ZeroDivisionError and TypeError specifically (no bare except); Appends None for failures and keeps positions aligned; Unpacks each tuple correctly

**5. PRG-PYTHON-S3-05** · Strings · write_code · Medium · ~5 min

Write a function compress(text) that performs run-length encoding: each run of the same       consecutive character is replaced by the character followed by the run length.       Example: 'aaabccdddd' -> 'a3b1c2d4'. An empty string returns ''.

Reference solution:

```
def compress(text):
    if not text:
        return ""
    parts = []
    current, count = text[0], 1
    for ch in text[1:]:
        if ch == current:
            count += 1
        else:
            parts.append(f"{current}{count}")
            current, count = ch, 1
    parts.append(f"{current}{count}")
    return "".join(parts)
```

Evaluation points: Counts consecutive runs only (not total occurrences); Emits the final run after the loop; Handles the empty string; Builds the result efficiently (list + join or equivalent)

**6. PRG-PYTHON-S3-06** · Sorting/Searching · fix_bug · Medium · ~5 min

binary_search(items, target) should return the index of target in the sorted list items, or       -1 if it is not present. It fails to find some values, e.g. binary_search([1, 3, 5, 7], 7)       returns -1, and binary_search([4], 4) returns -1. Find and fix the bug.

Given code:

```
def binary_search(items, target):
    low, high = 0, len(items) - 1
    while low < high:
        mid = (low + high) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
```

Reference solution:

```
# Bug: with high = len(items) - 1 (inclusive bound) the loop must run while low <= high;
# 'low < high' stops before checking the last remaining element.
def binary_search(items, target):
    low, high = 0, len(items) - 1
    while low <= high:
        mid = (low + high) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
```

Evaluation points: Identifies the loop condition as the bug (inclusive high needs <=); Keeps low = mid + 1 / high = mid - 1 so the loop terminates; Returns -1 for missing values and for an empty list; Finds the first and last elements

**7. PRG-PYTHON-S3-07** · Maps/Dictionaries · write_code · Medium · ~5 min

Write a function invert_mapping(mapping) that swaps keys and values of a dictionary. Because       several keys can share a value, the result maps each original value to a sorted list of the       original keys. Example: {'pen': 'office', 'mug': 'kitchen', 'stapler': 'office'} ->       {'office': ['pen', 'stapler'], 'kitchen': ['mug']}.

Reference solution:

```
def invert_mapping(mapping):
    inverted = {}
    for key, value in mapping.items():
        inverted.setdefault(value, []).append(key)
    for value in inverted:
        inverted[value].sort()
    return inverted
```

Evaluation points: Iterates with items(); Collects keys into lists so repeated values are not overwritten; Sorts each list of keys; Does not modify the input dictionary

**8. PRG-PYTHON-S3-08** · OOP Basics · complete_code · Medium · ~5 min

Complete the Product class. __str__ must return the name followed by the price with two       decimals in brackets, e.g. 'Laptop ($999.50)'. Two products are equal (==) when their sku       values are equal, regardless of name or price. in_stock() returns True when quantity is       greater than 0.

Given code:

```
class Product:
    def __init__(self, sku, name, price, quantity=0):
        self.sku = sku
        self.name = name
        self.price = price
        self.quantity = quantity

    def __str__(self):
        # TODO
        pass

    def __eq__(self, other):
        # TODO
        pass

    def in_stock(self):
        # TODO
        pass
```

Reference solution:

```
class Product:
    def __init__(self, sku, name, price, quantity=0):
        self.sku = sku
        self.name = name
        self.price = price
        self.quantity = quantity

    def __str__(self):
        return f"{self.name} (${self.price:.2f})"

    def __eq__(self, other):
        if not isinstance(other, Product):
            return NotImplemented
        return self.sku == other.sku

    def in_stock(self):
        return self.quantity > 0
```

Evaluation points: __str__ returns the exact required format with 2 decimals; __eq__ compares only sku; __eq__ handles comparison with a non-Product safely (NotImplemented or False); in_stock returns a bool based on quantity

**9. PRG-PYTHON-S3-09** · Collections · write_code · Hard · ~6 min

Write a function is_balanced(text) that returns True if every bracket in text is correctly       matched and nested, otherwise False. Brackets are (), [] and {}; all other characters are       ignored. Example: 'calc(a[1] + {b})' -> True, '([)]' -> False, '((' -> False.

Reference solution:

```
def is_balanced(text):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in text:
        if ch in "([{":
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack
```

Evaluation points: Uses a stack (list append/pop); Checks that each closing bracket matches the most recent opening one; Returns False when a closing bracket appears with an empty stack; Returns False when opening brackets remain at the end; Ignores non-bracket characters

**10. PRG-PYTHON-S3-10** · Text Parsing · write_code · Hard · ~6 min

Write a function parse_query(query) that parses a URL query string such as       'item=pen&qty=2&tag=red&tag=blue&note=' into a dictionary. Pairs are separated by '&' and       keys from values by the first '='. A key that appears once maps to its string value; a key       that appears more than once maps to a list of its values in order. Empty values are allowed       (''). Skip segments that contain no '='. Do not use urllib.

Reference solution:

```
def parse_query(query):
    result = {}
    for segment in query.split("&"):
        if "=" not in segment:
            continue
        key, value = segment.split("=", 1)
        if key in result:
            if isinstance(result[key], list):
                result[key].append(value)
            else:
                result[key] = [result[key], value]
        else:
            result[key] = value
    return result
```

Evaluation points: Splits on '&' and on the first '=' only; Skips segments without '='; Keeps empty values as ''; Converts a repeated key to a list and appends further values in order; Single occurrences stay plain strings

### Python – Set 4

**1. PRG-PYTHON-S4-01** · Arrays/Lists · write_code · Easy · ~3 min

Write a function running_totals(amounts) that returns a new list where each element is the       sum of all amounts up to and including that position. Example: [5, 3, 2] -> [5, 8, 10].       An empty list returns [].

Reference solution:

```
def running_totals(amounts):
    totals = []
    total = 0
    for amount in amounts:
        total += amount
        totals.append(total)
    return totals
```

Evaluation points: Keeps a running sum across iterations; Each position includes the current element; Returns a new list of the same length; Handles the empty list

**2. PRG-PYTHON-S4-02** · Sets · write_code · Easy · ~3 min

Write a function first_duplicate(items) that returns the first item in the list that has       already appeared earlier in the list (scanning left to right), or None if all items are       unique. Use a set to keep track of what you have seen.

Reference solution:

```
def first_duplicate(items):
    seen = set()
    for item in items:
        if item in seen:
            return item
        seen.add(item)
    return None
```

Evaluation points: Uses a set for O(1) membership checks; Returns the first repeat encountered while scanning; Returns None when there are no duplicates; Single pass through the list

**3. PRG-PYTHON-S4-03** · Maps/Dictionaries · explain_output · Easy · ~3 min

This program updates a stock dictionary using -=, setdefault() and get(), then tests membership. What does it print? Write the exact output line by line, then briefly explain why each line is produced.

Given code:

```
stock = {"pen": 10, "book": 4}
stock["pen"] -= 3
stock.setdefault("bag", 0)
stock.setdefault("book", 99)
print(stock)
print(stock.get("lamp", "missing"))
print(len(stock), "book" in stock, 4 in stock)
```

Reference solution:

```
Output:
{'pen': 7, 'book': 4, 'bag': 0}
missing
3 True False

Explanation: pen is reduced from 10 to 7. setdefault adds 'bag' with 0 because it is missing, but does             nothing for 'book' because it already exists, so book stays 4. get() returns the default             'missing' for an absent key without adding it. There are 3 keys; 'in' checks keys, so             'book' in stock is True while 4 (a value) in stock is False.
```

Evaluation points: Shows pen as 7 and book unchanged at 4; Explains setdefault only inserts missing keys; Explains get() returns the default without inserting; Explains that 'in' tests keys, not values

**4. PRG-PYTHON-S4-04** · Sorting/Searching · write_code · Medium · ~5 min

Write a function top_products(sales, n) where sales is a list of (product_name, units_sold)       tuples. Return a list of the names of the n best-selling products, highest units first. If two       products sold the same number of units, order them alphabetically by name. If n is larger than       the number of products, return all of them.

Reference solution:

```
def top_products(sales, n):
    ranked = sorted(sales, key=lambda s: (-s[1], s[0]))
    return [name for name, units in ranked[:n]]
```

Evaluation points: Sorts by units descending; Breaks ties alphabetically by name; Returns only names, limited to n; Slicing handles n larger than the list

**5. PRG-PYTHON-S4-05** · Debugging · fix_bug · Medium · ~5 min

Each Team should have its own list of members, but after creating two teams and adding a       member to one of them, the member shows up in both teams. Explain the bug and fix the class.

Given code:

```
class Team:
    members = []

    def __init__(self, name):
        self.name = name

    def add(self, person):
        self.members.append(person)
```

Reference solution:

```
# Bug: members is a class attribute, so one list is shared by every Team instance.
# Create the list per instance in __init__.
class Team:
    def __init__(self, name):
        self.name = name
        self.members = []

    def add(self, person):
        self.members.append(person)
```

Evaluation points: Identifies members as a class attribute shared by all instances; Moves initialisation of the list into __init__ as self.members; add() still appends to the instance list; Teams no longer affect each other

**6. PRG-PYTHON-S4-06** · Strings · write_code · Medium · ~5 min

Write a function camel_to_snake(name) that converts a camelCase or PascalCase identifier to       snake_case. Insert an underscore before each upper-case letter that is not the first character       and convert everything to lower case. Example: 'orderTotalAmount' -> 'order_total_amount',       'InvoiceId' -> 'invoice_id'.

Reference solution:

```
def camel_to_snake(name):
    result = []
    for i, ch in enumerate(name):
        if ch.isupper() and i > 0:
            result.append("_")
        result.append(ch.lower())
    return "".join(result)
```

Evaluation points: Adds '_' before upper-case letters except at position 0; Lower-cases all letters; Leaves already-lowercase names unchanged; Builds the string with join or equivalent

**7. PRG-PYTHON-S4-07** · Generators · write_code · Medium · ~5 min

Write a generator function chunked(items, size) that yields consecutive lists of at most size       elements from the list items. The last chunk may be shorter. Raise ValueError if size is less       than 1. Example: list(chunked([1, 2, 3, 4, 5], 2)) -> [[1, 2], [3, 4], [5]].

Reference solution:

```
def chunked(items, size):
    if size < 1:
        raise ValueError("size must be at least 1")
    for start in range(0, len(items), size):
        yield items[start:start + size]
```

Evaluation points: Uses yield (is a generator, not a function returning a full list); Chunks have at most size elements; Includes the shorter final chunk; Validates size

**8. PRG-PYTHON-S4-08** · Exceptions · complete_code · Medium · ~5 min

Complete call_with_retry(func, attempts). It must call func() (no arguments) up to attempts       times. As soon as a call succeeds, return its result. If a call raises an exception, try       again. If every attempt fails, re-raise the last exception. Raise ValueError if attempts is       less than 1.

Given code:

```
def call_with_retry(func, attempts):
    if attempts < 1:
        raise ValueError("attempts must be at least 1")
    last_error = None
    for _ in range(attempts):
        # TODO: call func, return on success, remember the error on failure
        pass
    # TODO: all attempts failed
```

Reference solution:

```
def call_with_retry(func, attempts):
    if attempts < 1:
        raise ValueError("attempts must be at least 1")
    last_error = None
    for _ in range(attempts):
        try:
            return func()
        except Exception as exc:
            last_error = exc
    raise last_error
```

Evaluation points: Returns immediately on the first successful call; Catches exceptions and retries up to attempts times; Re-raises the last exception after all attempts fail; Validates attempts; Does not swallow the error silently

**9. PRG-PYTHON-S4-09** · Recursion · write_code · Hard · ~6 min

Implement merge_sort(nums), a recursive merge sort that returns a new sorted list (ascending)       and does not modify the input. Do not use sort() or sorted(). Write the merge step yourself.

Reference solution:

```
def merge_sort(nums):
    if len(nums) <= 1:
        return list(nums)
    mid = len(nums) // 2
    left = merge_sort(nums[:mid])
    right = merge_sort(nums[mid:])
    merged = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged
```

Evaluation points: Base case for lists of length 0 or 1; Splits the list and sorts both halves recursively; Merge step compares heads and appends remaining elements; Handles duplicates and negatives; Returns a new list without using sort/sorted

**10. PRG-PYTHON-S4-10** · Inheritance · write_code · Hard · ~6 min

Write a base class Employee(name) with a method monthly_pay() that raises       NotImplementedError, and two subclasses: SalariedEmployee(name, annual_salary), paid       annual_salary / 12 per month, and HourlyEmployee(name, hourly_rate, hours), paid hourly_rate       per hour for the first 160 hours and 1.5 times hourly_rate for every hour above 160. Then       write a function total_payroll(employees) that returns the sum of monthly_pay() for a list of       employees, rounded to 2 decimals.

Reference solution:

```
class Employee:
    def __init__(self, name):
        self.name = name

    def monthly_pay(self):
        raise NotImplementedError

class SalariedEmployee(Employee):
    def __init__(self, name, annual_salary):
        super().__init__(name)
        self.annual_salary = annual_salary

    def monthly_pay(self):
        return self.annual_salary / 12

class HourlyEmployee(Employee):
    def __init__(self, name, hourly_rate, hours):
        super().__init__(name)
        self.hourly_rate = hourly_rate
        self.hours = hours

    def monthly_pay(self):
        regular = min(self.hours, 160)
        overtime = max(self.hours - 160, 0)
        return regular * self.hourly_rate + overtime * self.hourly_rate * 1.5

def total_payroll(employees):
    return round(sum(e.monthly_pay() for e in employees), 2)
```

Evaluation points: Subclasses inherit from Employee and call super().__init__; Each subclass overrides monthly_pay(); Overtime is applied only to hours above 160 at 1.5x; total_payroll relies on polymorphism, not type checks; Result rounded to 2 decimals

### Python – Set 5

**1. PRG-PYTHON-S5-01** · Variables & Types · write_code · Easy · ~3 min

Write a function format_duration(total_minutes) that converts a whole number of minutes into       a string of the form '<hours>h <minutes>m', where minutes always has two digits.       Example: 125 -> '2h 05m', 45 -> '0h 45m'. Raise ValueError for negative input.

Reference solution:

```
def format_duration(total_minutes):
    if total_minutes < 0:
        raise ValueError("minutes cannot be negative")
    hours, minutes = divmod(total_minutes, 60)
    return f"{hours}h {minutes:02d}m"
```

Evaluation points: Uses // and % (or divmod) correctly; Pads minutes to two digits; Exact output format with a space; Rejects negative input

**2. PRG-PYTHON-S5-02** · List Comprehensions · write_code · Easy · ~3 min

Write a function long_words_upper(words, min_length) that returns a list containing, in       upper case, only the words whose length is at least min_length, in their original order. The       body of the function must be a single return statement with a list comprehension.

Reference solution:

```
def long_words_upper(words, min_length):
    return [w.upper() for w in words if len(w) >= min_length]
```

Evaluation points: Uses a single list comprehension with a filter condition; Uses >= (words of exactly min_length included); Converts to upper case; Keeps original order

**3. PRG-PYTHON-S5-03** · Functions · explain_output · Easy · ~3 min

This program calls a function that has two default arguments, using positional and keyword arguments. What does each call print? Write the exact output line by line, then briefly explain why each line is produced.

Given code:

```
def greet(name, greeting="Hello", punct="!"):
    return f"{greeting}, {name}{punct}"

print(greet("Ana"))
print(greet("Ben", "Hi"))
print(greet("Cy", punct="?"))
print(greet(greeting="Hey", name="Di"))
```

Reference solution:

```
Output:
Hello, Ana!
Hi, Ben!
Hello, Cy?
Hey, Di!

Explanation: Parameters not supplied use their defaults. The second positional argument fills greeting.             punct="?" is a keyword argument, so greeting keeps its default. Keyword arguments can be given             in any order, so greeting="Hey", name="Di" works and punct defaults to '!'.
```

Evaluation points: All four lines exactly correct; Explains default parameter values; Explains positional vs keyword arguments; Notes keyword arguments can be passed in any order

**4. PRG-PYTHON-S5-04** · Maps/Dictionaries · write_code · Medium · ~5 min

Write a function merge_inventories(first, second) where each argument is a dictionary mapping       product name to quantity. Return a NEW dictionary containing every product from both, with       quantities added together for products present in both. Neither input dictionary may be       modified.

Reference solution:

```
def merge_inventories(first, second):
    merged = dict(first)
    for product, qty in second.items():
        merged[product] = merged.get(product, 0) + qty
    return merged
```

Evaluation points: Copies the first dict instead of modifying it; Adds quantities for shared keys; Includes keys that appear in only one dict; Neither input is mutated

**5. PRG-PYTHON-S5-05** · Collections · explain_output · Medium · ~5 min

This program makes a shallow copy and a deep copy of a dictionary that contains a list, then modifies the copies. What do the three dictionaries print? Write the exact output line by line, then briefly explain why each line is produced.

Given code:

```
import copy

original = {"items": [1, 2], "total": 3}
shallow = original.copy()
deep = copy.deepcopy(original)

shallow["items"].append(99)
shallow["total"] = 0
deep["items"].append(7)

print(original)
print(shallow)
print(deep)
```

Reference solution:

```
Output:
{'items': [1, 2, 99], 'total': 3}
{'items': [1, 2, 99], 'total': 0}
{'items': [1, 2, 7], 'total': 3}

Explanation: dict.copy() makes a shallow copy: a new outer dict whose values are the same objects, so             original and shallow share one 'items' list and appending 99 is visible in both. Assigning             shallow['total'] = 0 rebinds a key in the new dict only, so original keeps 3. deepcopy copies             the nested list too, so appending 7 affects only deep.
```

Evaluation points: original shows 99 in items but total still 3; shallow shows total 0 and the shared list; deep shows only 7 appended; Explains shallow copy shares nested objects while deepcopy does not; Distinguishes mutating a shared list from reassigning a key

**6. PRG-PYTHON-S5-06** · Debugging · fix_bug · Medium · ~5 min

reverse_words(sentence) should return the words of the sentence in reverse order separated by       single spaces, with no leading or trailing spaces. For 'close the  ticket' (note the double space)       it returns 'ticket  the close ' with an extra space in the middle and a trailing space. Fix it.

Given code:

```
def reverse_words(sentence):
    words = sentence.split(" ")
    result = ""
    for w in words:
        result = w + " " + result
    return result
```

Reference solution:

```
# Bug: split(" ") produces empty strings for repeated spaces, and prepending w + " " leaves
# a trailing space. split() with no argument discards empty items; join adds single spaces.
def reverse_words(sentence):
    return " ".join(reversed(sentence.split()))
```

Evaluation points: Explains that split(' ') keeps empty strings for consecutive spaces; Uses split() without arguments (or filters empties); Removes the trailing space (join or strip); Returns '' for an empty or blank sentence

**7. PRG-PYTHON-S5-07** · Sets · write_code · Medium · ~5 min

Write a function unique_visitors_per_day(visits) where visits is a list of (day, user_id)       tuples from a website log. The same user may visit several times per day. Return a dictionary       mapping each day to the number of distinct users who visited that day.

Reference solution:

```
def unique_visitors_per_day(visits):
    users_by_day = {}
    for day, user_id in visits:
        users_by_day.setdefault(day, set()).add(user_id)
    return {day: len(users) for day, users in users_by_day.items()}
```

Evaluation points: Groups by day using a dict; Uses a set per day so repeat visits are counted once; Returns counts (ints), not the sets themselves; Handles an empty list

**8. PRG-PYTHON-S5-08** · OOP Basics · write_code · Medium · ~5 min

Write a class TaskQueue that processes support tickets in first-in, first-out order. It must       provide: enqueue(task) to add a task at the back; dequeue() to remove and return the task at the       front, raising IndexError('queue is empty') if there is none; peek() to return the front task       without removing it (None if empty); and __len__ so len(queue) returns the number of tasks.

Reference solution:

```
class TaskQueue:
    def __init__(self):
        self._items = []

    def enqueue(self, task):
        self._items.append(task)

    def dequeue(self):
        if not self._items:
            raise IndexError("queue is empty")
        return self._items.pop(0)

    def peek(self):
        return self._items[0] if self._items else None

    def __len__(self):
        return len(self._items)
```

Evaluation points: Stores items in an instance attribute created in __init__; FIFO order: dequeue returns the oldest task; dequeue on empty raises IndexError; peek does not remove and returns None when empty; Implements __len__

**9. PRG-PYTHON-S5-09** · Recursion · write_code · Hard · ~6 min

An organisation chart is stored as nested dictionaries: each node is {'name': str,       'reports': [list of nodes]}. Write a recursive function chart_stats(node) that returns a tuple       (headcount, levels), where headcount is the total number of people in the chart including the       root, and levels is the number of levels (a single person with no reports has 1 level).

Reference solution:

```
def chart_stats(node):
    headcount = 1
    deepest = 0
    for child in node["reports"]:
        child_count, child_levels = chart_stats(child)
        headcount += child_count
        deepest = max(deepest, child_levels)
    return headcount, deepest + 1
```

Evaluation points: Recursive call on each report; Headcount sums the subtrees plus the node itself; Levels is 1 + the maximum levels among children; Leaf node returns (1, 1); Returns a tuple

**10. PRG-PYTHON-S5-10** · Text Parsing · write_code · Hard · ~6 min

Write a function parse_duration(text) that converts a duration string such as '1h 30m 15s'       into a total number of seconds (int). The string contains one or more space-separated tokens,       each a positive whole number followed by one unit letter: h (hours), m (minutes) or s (seconds).       Units may appear in any order, upper or lower case. Raise ValueError for an empty string or any       token that is not in this format (e.g. '10x', 'h', '1.5h').

Reference solution:

```
def parse_duration(text):
    units = {"h": 3600, "m": 60, "s": 1}
    tokens = text.split()
    if not tokens:
        raise ValueError("empty duration")
    total = 0
    for token in tokens:
        number, unit = token[:-1], token[-1].lower()
        if unit not in units or not number.isdigit():
            raise ValueError(f"invalid token: {token}")
        total += int(number) * units[unit]
    return total
```

Evaluation points: Splits into tokens and separates the number from the unit letter; Maps units to seconds (h=3600, m=60, s=1), case-insensitive; Validates the number part is digits only; Raises ValueError for empty input and invalid tokens; Returns an int total

## SQL

### SQL – Set 1

**1. PRG-SQL-S1-01** · SELECT / WHERE · write_code · Easy · ~3 min

Write a query that returns the name and price of every product in the 'Stationery' category that costs less than 5.00 and currently has stock greater than 0. Sort the result by price, lowest first.

Given code:

```
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  stock INT NOT NULL
);
INSERT INTO products VALUES
 (1, 'Stapler', 'Stationery', 7.50, 40),
 (2, 'Pencil Pack', 'Stationery', 3.20, 120),
 (3, 'Desk Lamp', 'Furniture', 4.99, 15),
 (4, 'Sticky Notes', 'Stationery', 2.75, 0),
 (5, 'Office Chair', 'Furniture', 89.00, 8),
 (6, 'Eraser', 'Stationery', 0.99, 300);
```

Reference solution:

```
SELECT name, price
FROM products
WHERE category = 'Stationery'
  AND price < 5.00
  AND stock > 0
ORDER BY price ASC;
```

Evaluation points: Filters on all three conditions combined with AND (category, price < 5, stock > 0); Excludes out-of-stock 'Sticky Notes' and the cheap non-Stationery 'Desk Lamp'; Selects only name and price; Sorts by price ascending

**2. PRG-SQL-S1-02** · DISTINCT · write_code · Easy · ~3 min

The customers table contains many customers from the same cities. Write a query that lists each city that has at least one customer exactly once, in alphabetical order. Return a single column named city.

Given code:

```
CREATE TABLE customers (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  city VARCHAR(40) NOT NULL
);
INSERT INTO customers VALUES
 (1, 'Acme Traders', 'Pune'),
 (2, 'Blue Hill Ltd', 'Chennai'),
 (3, 'Corner Mart', 'Pune'),
 (4, 'Delta Foods', 'Austin'),
 (5, 'Evergreen Co', 'Chennai');
```

Reference solution:

```
SELECT DISTINCT city
FROM customers
ORDER BY city;
```

Evaluation points: Uses DISTINCT (or GROUP BY city) so each city appears once; Returns only the city column; Orders alphabetically ascending

**3. PRG-SQL-S1-03** · NULL Handling · explain_output · Easy · ~3 min

Some employees have no bonus recorded (NULL). State the exact single row returned by the query in starter_code (all four column values) and explain why COUNT(*) and COUNT(bonus) differ.

Given code:

```
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  bonus DECIMAL(10,2)
);
INSERT INTO employees VALUES
 (1, 'Asha', 500),
 (2, 'Ben', NULL),
 (3, 'Chen', 300),
 (4, 'Dina', NULL),
 (5, 'Eli', 200);

-- Query:
SELECT COUNT(*) AS total_rows,
       COUNT(bonus) AS with_bonus,
       SUM(bonus) AS bonus_sum,
       MIN(bonus) AS min_bonus
FROM employees;
```

Reference solution:

```
Result rows:
total_rows | with_bonus | bonus_sum | min_bonus
5 | 3 | 1000 | 200

COUNT(*) counts all 5 rows. COUNT(bonus), SUM(bonus) and MIN(bonus) ignore NULL values, so only the 3 recorded bonuses (500, 300, 200) are counted, summed (1000) and compared (minimum 200). NULL is not treated as zero.
```

Evaluation points: total_rows = 5 because COUNT(*) counts rows regardless of NULLs; with_bonus = 3 because COUNT(column) skips NULLs; bonus_sum = 1000 and min_bonus = 200: SUM and MIN ignore NULLs (NULL is not treated as 0)

**4. PRG-SQL-S1-04** · GROUP BY / HAVING · write_code · Medium · ~5 min

Using the orders table, return customer_id, the number of orders (order_count) and the total order amount (total_amount) for every customer who has placed at least 3 orders. Sort by total_amount, highest first.

Given code:

```
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO orders VALUES
 (1, 10, 120.00), (2, 20, 75.50), (3, 10, 60.00),
 (4, 30, 40.00), (5, 30, 55.25), (6, 10, 30.00),
 (7, 30, 80.00), (8, 20, 99.00), (9, 30, 10.00);
```

Reference solution:

```
SELECT customer_id,
       COUNT(*) AS order_count,
       SUM(amount) AS total_amount
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 3
ORDER BY total_amount DESC;
```

Evaluation points: Groups by customer_id; Uses HAVING (not WHERE) to filter on COUNT(*) >= 3; Computes COUNT and SUM per customer; Sorts by total amount descending

**5. PRG-SQL-S1-05** · INNER JOIN · write_code · Medium · ~5 min

Write a query that returns employee_name and department_name for every employee who is assigned to a department. Employees with no department must not appear. Sort by department_name, then employee_name.

Given code:

```
CREATE TABLE departments (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL
);
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  dept_id INT REFERENCES departments(id)
);
INSERT INTO departments VALUES (1, 'Finance'), (2, 'IT'), (3, 'Legal');
INSERT INTO employees VALUES
 (1, 'Ravi', 2), (2, 'Anna', 1), (3, 'Tom', 2),
 (4, 'Meera', NULL), (5, 'Carl', 1);
```

Reference solution:

```
SELECT e.name AS employee_name,
       d.name AS department_name
FROM employees e
INNER JOIN departments d ON d.id = e.dept_id
ORDER BY d.name, e.name;
```

Evaluation points: Joins employees to departments on dept_id = departments.id; Uses INNER JOIN so the employee with NULL dept_id is excluded; Department 'Legal' (no employees) does not appear; Correct aliases and two-level sort

**6. PRG-SQL-S1-06** · LEFT JOIN · fix_bug · Medium · ~5 min

The query in starter_code should list EVERY customer with the number of orders they placed (order_count), showing 0 for customers with no orders, sorted by name. It currently omits customers without orders. Fix it.

Given code:

```
CREATE TABLE customers (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL
);
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO customers VALUES (1, 'Arun'), (2, 'Bela'), (3, 'Chris');
INSERT INTO orders VALUES (1, 1, 50.00), (2, 1, 20.00), (3, 3, 70.00);

-- Query to fix:
SELECT c.name, COUNT(*) AS order_count
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;
```

Reference solution:

```
SELECT c.name, COUNT(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;
```

Evaluation points: Changes INNER JOIN to LEFT JOIN (customers on the left); Counts COUNT(o.id) instead of COUNT(*) so unmatched customers show 0, not 1; Keeps grouping per customer and sort by name

**7. PRG-SQL-S1-07** · Subqueries · write_code · Medium · ~5 min

Return the name and price of every product whose price is greater than the average price of all products. Use a subquery to compute the average. Sort by price, highest first.

Given code:

```
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  price DECIMAL(8,2) NOT NULL
);
INSERT INTO products VALUES
 (1, 'Keyboard', 25.00), (2, 'Monitor', 180.00), (3, 'Mouse', 15.00),
 (4, 'Headset', 60.00), (5, 'Webcam', 45.00);
```

Reference solution:

```
SELECT name, price
FROM products
WHERE price > (SELECT AVG(price) FROM products)
ORDER BY price DESC;
```

Evaluation points: Uses a scalar subquery SELECT AVG(price) FROM products; Strictly greater than (>) the average; Does not hard-code the average value (65 in the sample); Sorts by price descending

**8. PRG-SQL-S1-08** · Constraints & Keys · explain_output · Medium · ~5 min

Each numbered statement in starter_code runs on its own (autocommit) with foreign keys enforced; a statement that violates a constraint is rejected and the rest continue. Name the statements that fail and the constraint each violates, then state the rows returned by the final query.

Given code:

```
CREATE TABLE departments (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL
);
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  dept_id INT REFERENCES departments(id),
  salary DECIMAL(10,2) CHECK (salary > 0)
);
INSERT INTO departments VALUES (1, 'Sales'), (2, 'IT');  -- (1)
INSERT INTO employees VALUES (1, 'Asha', 1, 50000);      -- (2)
INSERT INTO employees VALUES (2, 'Ben', 3, 42000);       -- (3)
INSERT INTO employees VALUES (1, 'Chen', 2, 61000);      -- (4)
INSERT INTO employees VALUES (3, 'Dina', 2, -100);       -- (5)
INSERT INTO employees VALUES (4, 'Eli', NULL, 39000);    -- (6)
INSERT INTO employees VALUES (5, NULL, 1, 45000);        -- (7)

-- Query:
SELECT id, name, dept_id FROM employees ORDER BY id;
```

Reference solution:

```
Failing statements: (3), (4), (5), (7)

Result rows:
id | name | dept_id
1 | Asha | 1
4 | Eli | NULL

(3) violates the FOREIGN KEY (department 3 does not exist); (4) violates the PRIMARY KEY (id 1 already used); (5) violates the CHECK (salary > 0); (7) violates NOT NULL on name. (6) succeeds: a NULL foreign key value is allowed because it references nothing.
```

Evaluation points: (3) fails: FOREIGN KEY, department 3 does not exist; (4) fails: PRIMARY KEY, id 1 already exists; (5) fails: CHECK salary > 0; (7) fails: NOT NULL on name; (6) succeeds because a NULL foreign key is allowed; Final rows: (1, Asha, 1) and (4, Eli, NULL)

**9. PRG-SQL-S1-09** · Window Functions · write_code · Hard · ~6 min

Return the single highest-paid employee of each department: department, name, salary. If two employees in a department have the same top salary, return the one with the lower id. Use ROW_NUMBER(). Sort by department.

Given code:

```
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  department VARCHAR(30) NOT NULL,
  salary DECIMAL(10,2) NOT NULL
);
INSERT INTO employees VALUES
 (1, 'Asha', 'IT', 72000), (2, 'Ben', 'IT', 81000),
 (3, 'Chen', 'Sales', 55000), (4, 'Dina', 'Sales', 55000),
 (5, 'Eli', 'HR', 48000), (6, 'Fay', 'IT', 81000);
```

Reference solution:

```
SELECT department, name, salary
FROM (
  SELECT department, name, salary,
         ROW_NUMBER() OVER (PARTITION BY department
                            ORDER BY salary DESC, id ASC) AS rn
  FROM employees
) ranked
WHERE rn = 1
ORDER BY department;
```

Evaluation points: ROW_NUMBER() partitioned by department; Ordered by salary DESC with id ASC as tie-breaker; Filters rn = 1 in an outer query/CTE (window results cannot be filtered in WHERE of the same level); Exactly one row per department (Ben for IT, Chen for Sales)

**10. PRG-SQL-S1-10** · CASE Expressions · write_code · Hard · ~6 min

For every customer, including customers with no invoices, return name, paid_total (sum of invoices with status 'PAID') and unpaid_total (sum of invoices with status 'UNPAID'). Totals must be 0, not NULL, when there is nothing to sum. Use one query with conditional aggregation. Sort by name.

Given code:

```
CREATE TABLE customers (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL
);
CREATE TABLE invoices (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(10) NOT NULL
);
INSERT INTO customers VALUES (1, 'Northwind'), (2, 'Orbit'), (3, 'Pioneer');
INSERT INTO invoices VALUES
 (1, 1, 200.00, 'PAID'), (2, 1, 150.00, 'UNPAID'),
 (3, 1, 50.00, 'PAID'), (4, 3, 300.00, 'UNPAID');
```

Reference solution:

```
SELECT c.name,
       COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN i.amount END), 0) AS paid_total,
       COALESCE(SUM(CASE WHEN i.status = 'UNPAID' THEN i.amount END), 0) AS unpaid_total
FROM customers c
LEFT JOIN invoices i ON i.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;
```

Evaluation points: LEFT JOIN so customers without invoices (Orbit) appear; SUM(CASE WHEN status = ... THEN amount END) per status; COALESCE (or ELSE 0) so empty totals show 0; Groups per customer and sorts by name

### SQL – Set 2

**1. PRG-SQL-S2-01** · ORDER BY · write_code · Easy · ~3 min

List every employee's name, department and salary, sorted by department alphabetically and, within each department, by salary from highest to lowest.

Given code:

```
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  department VARCHAR(30) NOT NULL,
  salary DECIMAL(10,2) NOT NULL
);
INSERT INTO employees VALUES
 (1, 'Omar', 'Sales', 45000), (2, 'Priya', 'IT', 70000),
 (3, 'Quinn', 'Sales', 52000), (4, 'Rosa', 'IT', 64000),
 (5, 'Sam', 'Admin', 38000);
```

Reference solution:

```
SELECT name, department, salary
FROM employees
ORDER BY department ASC, salary DESC;
```

Evaluation points: Selects name, department, salary; First sort key department ascending; Second sort key salary descending (DESC applies only to salary)

**2. PRG-SQL-S2-02** · LIKE · write_code · Easy · ~3 min

Electronics products have a SKU that begins with the prefix 'EL-'. Return sku and name of all products whose SKU starts with 'EL-', sorted by sku.

Given code:

```
CREATE TABLE products (
  id INT PRIMARY KEY,
  sku VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL
);
INSERT INTO products VALUES
 (1, 'EL-100', 'USB Cable'), (2, 'FU-200', 'Bookshelf'),
 (3, 'EL-050', 'Power Bank'), (4, 'XEL-300', 'Label Printer'),
 (5, 'ST-010', 'EL- Marker Set');
```

Reference solution:

```
SELECT sku, name
FROM products
WHERE sku LIKE 'EL-%'
ORDER BY sku;
```

Evaluation points: Uses LIKE 'EL-%' on the sku column; Wildcard only at the end (not '%EL-%', which would match 'XEL-300'); Does not filter on name; Sorted by sku

**3. PRG-SQL-S2-03** · IN / BETWEEN · explain_output · Easy · ~3 min

State the rows (id, amount) returned by the query in starter_code and explain how BETWEEN treats the boundary values.

Given code:

```
CREATE TABLE orders (
  id INT PRIMARY KEY,
  status VARCHAR(15) NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO orders VALUES
 (1, 'Shipped', 100.00), (2, 'Cancelled', 150.00),
 (3, 'Pending', 200.00), (4, 'Shipped', 250.00),
 (5, 'Returned', 120.00), (6, 'Pending', 99.99);

-- Query:
SELECT id, amount
FROM orders
WHERE amount BETWEEN 100 AND 200
  AND status NOT IN ('Cancelled', 'Returned')
ORDER BY id;
```

Reference solution:

```
Result rows:
id | amount
1 | 100
3 | 200

BETWEEN 100 AND 200 is inclusive, so 100.00 and 200.00 qualify. Order 2 (Cancelled) and 5 (Returned) are excluded by NOT IN; 250.00 and 99.99 are outside the range.
```

Evaluation points: Rows returned: 1 (100) and 3 (200); BETWEEN is inclusive of both ends, so 100 and 200 qualify; Orders 2 and 5 are removed by NOT IN, 4 and 6 are outside the range

**4. PRG-SQL-S2-04** · Aggregates · write_code · Medium · ~5 min

For each product category return: category, product_count, cheapest (lowest price), most_expensive (highest price) and avg_price (average price rounded to 2 decimals). Sort by category.

Given code:

```
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL,
  price DECIMAL(8,2) NOT NULL
);
INSERT INTO products VALUES
 (1, 'Notebook', 'Paper', 2.50), (2, 'Printer Paper', 'Paper', 6.00),
 (3, 'Card Stock', 'Paper', 4.25), (4, 'Gel Pen', 'Pens', 1.20),
 (5, 'Fountain Pen', 'Pens', 18.00);
```

Reference solution:

```
SELECT category,
       COUNT(*) AS product_count,
       MIN(price) AS cheapest,
       MAX(price) AS most_expensive,
       ROUND(AVG(price), 2) AS avg_price
FROM products
GROUP BY category
ORDER BY category;
```

Evaluation points: GROUP BY category; Uses COUNT, MIN, MAX, AVG correctly; Rounds the average with ROUND(..., 2); Sorted by category

**5. PRG-SQL-S2-05** · GROUP BY / HAVING · fix_bug · Medium · ~5 min

The query in starter_code should return each region whose total sales exceed 1000, with the total as total_sales, sorted by region. It fails with an error. Fix it.

Given code:

```
CREATE TABLE sales (
  id INT PRIMARY KEY,
  region VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO sales VALUES
 (1, 'North', 600.00), (2, 'South', 300.00), (3, 'North', 700.00),
 (4, 'East', 1200.00), (5, 'South', 450.00), (6, 'West', 1000.00);

-- Query to fix:
SELECT region, SUM(amount) AS total_sales
FROM sales
WHERE SUM(amount) > 1000
GROUP BY region
ORDER BY region;
```

Reference solution:

```
SELECT region, SUM(amount) AS total_sales
FROM sales
GROUP BY region
HAVING SUM(amount) > 1000
ORDER BY region;
```

Evaluation points: Moves the aggregate condition from WHERE to HAVING (aggregates are not allowed in WHERE); HAVING appears after GROUP BY; Keeps strict > 1000 (West with exactly 1000 is excluded)

**6. PRG-SQL-S2-06** · Self Join · write_code · Medium · ~5 min

The employees table stores each person's manager in manager_id (which refers to another employee's id). Return every employee's name and their manager's name as manager_name. Employees without a manager must still appear with NULL. Sort by employee name.

Given code:

```
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  manager_id INT REFERENCES employees(id)
);
INSERT INTO employees VALUES
 (1, 'Grace', NULL), (2, 'Henry', 1), (3, 'Irene', 1),
 (4, 'Jack', 2), (5, 'Kim', 2);
```

Reference solution:

```
SELECT e.name, m.name AS manager_name
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
ORDER BY e.name;
```

Evaluation points: Joins the employees table to itself using two aliases; Join condition m.id = e.manager_id (direction matters); LEFT JOIN so the top manager (Grace) appears with NULL; Sorted by employee name

**7. PRG-SQL-S2-07** · EXISTS · write_code · Medium · ~5 min

Return the names of customers who placed at least one order during 2024 (order_date from 2024-01-01 to 2024-12-31 inclusive). Use EXISTS with a correlated subquery. Each customer must appear once; sort by name.

Given code:

```
CREATE TABLE customers (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL
);
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  order_date DATE NOT NULL
);
INSERT INTO customers VALUES (1, 'Alpha'), (2, 'Bravo'), (3, 'Charlie'), (4, 'Delta');
INSERT INTO orders VALUES
 (1, 1, '2024-03-10'), (2, 1, '2024-07-01'), (3, 2, '2023-12-31'),
 (4, 3, '2024-12-31'), (5, 4, '2025-01-01');
```

Reference solution:

```
SELECT c.name
FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders o
  WHERE o.customer_id = c.id
    AND o.order_date BETWEEN '2024-01-01' AND '2024-12-31'
)
ORDER BY c.name;
```

Evaluation points: Uses EXISTS with a subquery correlated on customer_id = c.id; Date range includes both 2024-01-01 and 2024-12-31; Alpha appears once even though it has two 2024 orders (no duplicate rows); Sorted by name

**8. PRG-SQL-S2-08** · Indexes · explain_output · Medium · ~5 min

starter_code creates a UNIQUE INDEX on users(email) and then runs numbered INSERTs, each on its own. Say which statements fail and why, state the rows returned by the final query, and briefly explain what else the index does for a query such as WHERE email = 'bela@example.com'.

Given code:

```
CREATE TABLE users (
  id INT PRIMARY KEY,
  username VARCHAR(30) NOT NULL,
  email VARCHAR(60) NOT NULL
);
CREATE UNIQUE INDEX ux_users_email ON users(email);
INSERT INTO users VALUES (1, 'arun', 'arun@example.com');   -- (1)
INSERT INTO users VALUES (2, 'bela', 'bela@example.com');   -- (2)
INSERT INTO users VALUES (3, 'arun2', 'arun@example.com');  -- (3)
INSERT INTO users VALUES (4, 'chris', 'chris@example.com'); -- (4)
INSERT INTO users VALUES (5, 'arun', 'dev@example.com');    -- (5)

-- Query:
SELECT id, username FROM users ORDER BY id;
```

Reference solution:

```
Failing statements: (3)

Result rows:
id | username
1 | arun
2 | bela
4 | chris
5 | arun

Only (3) fails, because 'arun@example.com' already exists and the UNIQUE index forbids duplicate emails. (5) succeeds because username has no unique constraint. Besides enforcing uniqueness, the index is a sorted lookup structure, so WHERE email = '...' can jump straight to the matching row instead of scanning the table; the trade-off is extra storage and slightly slower INSERT/UPDATE.
```

Evaluation points: Only (3) fails: duplicate email violates the unique index; (5) succeeds: username is not indexed/unique, so a repeated username is allowed; Final rows: 1 arun, 2 bela, 4 chris, 5 arun; The index also lets the database find rows by email quickly without scanning the whole table (at some cost to insert/update speed and storage)

**9. PRG-SQL-S2-09** · Window Functions · write_code · Hard · ~6 min

Each row of sales is one sale of a product. First total the sales per product, then rank products inside each category by total (highest = 1) using RANK() so that ties share a rank. Return category, product, total_sales, sales_rank for products ranked 1 or 2. Sort by category, sales_rank, product.

Given code:

```
CREATE TABLE sales (
  id INT PRIMARY KEY,
  category VARCHAR(20) NOT NULL,
  product VARCHAR(30) NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO sales VALUES
 (1, 'Audio', 'Speaker', 300), (2, 'Audio', 'Earbuds', 200),
 (3, 'Audio', 'Speaker', 100), (4, 'Audio', 'Headphones', 200),
 (5, 'Audio', 'Soundbar', 150), (6, 'Video', 'Camera', 500),
 (7, 'Video', 'Tripod', 120), (8, 'Video', 'Camera', 50);
```

Reference solution:

```
WITH totals AS (
  SELECT category, product, SUM(amount) AS total_sales
  FROM sales
  GROUP BY category, product
), ranked AS (
  SELECT category, product, total_sales,
         RANK() OVER (PARTITION BY category ORDER BY total_sales DESC) AS sales_rank
  FROM totals
)
SELECT category, product, total_sales, sales_rank
FROM ranked
WHERE sales_rank <= 2
ORDER BY category, sales_rank, product;
```

Evaluation points: Aggregates SUM(amount) per category and product before ranking; RANK() OVER (PARTITION BY category ORDER BY total DESC); Ties share a rank (Earbuds and Headphones both rank 2 in Audio); Filters rank <= 2 in an outer query/CTE; correct sort

**10. PRG-SQL-S2-10** · Subqueries · write_code · Hard · ~6 min

Return name, department and salary of every employee who earns more than the average salary of their own department (not the company average). Use a correlated subquery. Sort by department, then salary highest first.

Given code:

```
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  department VARCHAR(30) NOT NULL,
  salary DECIMAL(10,2) NOT NULL
);
INSERT INTO employees VALUES
 (1, 'Uma', 'IT', 90000), (2, 'Victor', 'IT', 60000), (3, 'Wendy', 'IT', 75000),
 (4, 'Xavier', 'Support', 40000), (5, 'Yara', 'Support', 44000),
 (6, 'Zane', 'Support', 42000), (7, 'Abel', 'Legal', 80000);
```

Reference solution:

```
SELECT e.name, e.department, e.salary
FROM employees e
WHERE e.salary > (
  SELECT AVG(e2.salary)
  FROM employees e2
  WHERE e2.department = e.department
)
ORDER BY e.department, e.salary DESC;
```

Evaluation points: Subquery is correlated on department (e2.department = e.department); Compares with strictly greater than the department average; A single-person department (Legal) is excluded because salary equals its own average; Sorted by department then salary descending

### SQL – Set 3

**1. PRG-SQL-S3-01** · IN / BETWEEN · write_code · Easy · ~3 min

Return id and status of all orders whose status is either 'Shipped' or 'Delivered'. Use the IN operator. Sort by id.

Given code:

```
CREATE TABLE orders (
  id INT PRIMARY KEY,
  reference VARCHAR(20) NOT NULL,
  status VARCHAR(15) NOT NULL
);
INSERT INTO orders VALUES
 (1, 'R-1001', 'Pending'), (2, 'R-1002', 'Shipped'), (3, 'R-1003', 'Delivered'),
 (4, 'R-1004', 'Cancelled'), (5, 'R-1005', 'Shipped');
```

Reference solution:

```
SELECT id, status
FROM orders
WHERE status IN ('Shipped', 'Delivered')
ORDER BY id;
```

Evaluation points: Uses IN ('Shipped', 'Delivered'); Returns id and status only; Sorted by id

**2. PRG-SQL-S3-02** · NULL Handling · write_code · Easy · ~3 min

Some employees do not have a desk phone extension yet; for them phone_ext is NULL. Write a query that returns the names of those employees, sorted by name.

Given code:

```
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  phone_ext VARCHAR(6)
);
INSERT INTO employees VALUES
 (1, 'Nora', '2101'), (2, 'Oscar', NULL), (3, 'Paula', '2107'),
 (4, 'Adam', NULL), (5, 'Ian', '2110');
```

Reference solution:

```
SELECT name
FROM employees
WHERE phone_ext IS NULL
ORDER BY name;
```

Evaluation points: Uses IS NULL (not = NULL, which never matches); Returns only the name column; Sorted by name

**3. PRG-SQL-S3-03** · LIKE · fix_bug · Easy · ~3 min

The query in starter_code should return the id and name of every product whose name contains the word 'Desk' anywhere (e.g. 'Standing Desk', 'Desk Lamp'), sorted by id. It returns no rows. Fix it.

Given code:

```
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);
INSERT INTO products VALUES
 (1, 'Desk Lamp'), (2, 'Office Chair'), (3, 'Standing Desk'),
 (4, 'Monitor Arm'), (5, 'Desk Organizer Tray');

-- Query to fix:
SELECT id, name
FROM products
WHERE name = '%Desk%'
ORDER BY id;
```

Reference solution:

```
SELECT id, name
FROM products
WHERE name LIKE '%Desk%'
ORDER BY id;
```

Evaluation points: Replaces = with LIKE (= compares literally, '%' is not a wildcard with =); Pattern has % on both sides to match anywhere in the name; Keeps sort by id

**4. PRG-SQL-S3-04** · LEFT JOIN · write_code · Medium · ~5 min

Return id and name of every product that has never been ordered, i.e. has no row in order_items. Sort by id.

Given code:

```
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);
CREATE TABLE order_items (
  id INT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL REFERENCES products(id),
  qty INT NOT NULL
);
INSERT INTO products VALUES (1, 'Router'), (2, 'Switch'), (3, 'Cable'), (4, 'Antenna'), (5, 'Rack');
INSERT INTO order_items VALUES (1, 100, 1, 2), (2, 100, 3, 10), (3, 101, 3, 5), (4, 102, 5, 1);
```

Reference solution:

```
SELECT p.id, p.name
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
WHERE oi.id IS NULL
ORDER BY p.id;
```

Evaluation points: Anti-join: LEFT JOIN + WHERE child IS NULL, or NOT EXISTS / NOT IN on a non-null column; Checks the NULL on a column of order_items (not products); Returns Switch and Antenna for the sample; sorted by id

**5. PRG-SQL-S3-05** · CASE Expressions · write_code · Medium · ~5 min

Return name, salary and a salary_band column for every employee: 'Junior' when salary is below 40000, 'Mid' when salary is at least 40000 but below 70000, and 'Senior' when salary is 70000 or more. Sort by salary ascending.

Given code:

```
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  salary DECIMAL(10,2) NOT NULL
);
INSERT INTO employees VALUES
 (1, 'Aria', 35000), (2, 'Bo', 40000), (3, 'Cy', 69999.99),
 (4, 'Di', 70000), (5, 'Ed', 91000);
```

Reference solution:

```
SELECT name, salary,
       CASE
         WHEN salary < 40000 THEN 'Junior'
         WHEN salary < 70000 THEN 'Mid'
         ELSE 'Senior'
       END AS salary_band
FROM employees
ORDER BY salary;
```

Evaluation points: Uses a searched CASE expression with the band aliased salary_band; Boundaries correct: 40000 is Mid, 70000 is Senior; WHEN branches in an order that does not mis-classify; Sorted by salary ascending

**6. PRG-SQL-S3-06** · GROUP BY / HAVING · explain_output · Medium · ~5 min

State the rows returned by the query in starter_code (assignee, tickets, prioritized) and explain what happens to the tickets that have no assignee.

Given code:

```
CREATE TABLE tickets (
  id INT PRIMARY KEY,
  assignee VARCHAR(20),
  priority VARCHAR(10)
);
INSERT INTO tickets VALUES
 (1, 'Maya', 'High'), (2, 'Maya', NULL), (3, 'Liam', 'Low'),
 (4, 'Maya', 'Low'), (5, 'Noah', 'High'), (6, 'Noah', 'Low'),
 (7, NULL, 'High'), (8, 'Liam', NULL);

-- Query:
SELECT assignee,
       COUNT(*) AS tickets,
       COUNT(priority) AS prioritized
FROM tickets
GROUP BY assignee
HAVING COUNT(*) >= 2
ORDER BY assignee;
```

Reference solution:

```
Result rows:
assignee | tickets | prioritized
Liam | 2 | 1
Maya | 3 | 2
Noah | 2 | 2

GROUP BY puts all NULL assignees into one group (ticket 7), but that group has only 1 row and is removed by HAVING COUNT(*) >= 2. COUNT(priority) ignores NULLs, so Liam has 1 prioritized ticket and Maya 2.
```

Evaluation points: Liam 2 1, Maya 3 2, Noah 2 2; COUNT(priority) skips the NULL priorities of tickets 2 and 8; The NULL assignee forms its own group but has only 1 ticket, so HAVING removes it

**7. PRG-SQL-S3-07** · UPDATE · write_code · Medium · ~5 min

Write a single UPDATE statement that increases the price of every product in the 'Toys' category by 10%. Products in other categories must not change.

Given code:

```
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL,
  price DECIMAL(8,2) NOT NULL
);
INSERT INTO products VALUES
 (1, 'Puzzle', 'Toys', 20.00), (2, 'Cookbook', 'Books', 18.00),
 (3, 'Kite', 'Toys', 15.50), (4, 'Board Game', 'Toys', 30.00);
```

Reference solution:

```
UPDATE products
SET price = price * 1.10
WHERE category = 'Toys';
```

Evaluation points: Single UPDATE with SET price = price * 1.10 (or price + price * 0.10); WHERE category = 'Toys' so other rows are untouched (no WHERE would update everything); Does not hard-code new prices per row

**8. PRG-SQL-S3-08** · SELECT / WHERE · fix_bug · Medium · ~5 min

The query in starter_code should return id, name and price of products in the 'Books' or 'Music' category that cost less than 15, sorted by id. It also returns an expensive book. Explain the cause and fix it.

Given code:

```
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL,
  price DECIMAL(8,2) NOT NULL
);
INSERT INTO products VALUES
 (1, 'SQL Primer', 'Books', 12.00), (2, 'Jazz Hits', 'Music', 9.99),
 (3, 'Atlas', 'Books', 30.00), (4, 'Rock Live', 'Music', 22.00),
 (5, 'Chess Set', 'Games', 8.00);

-- Query to fix:
SELECT id, name, price
FROM products
WHERE category = 'Books' OR category = 'Music'
  AND price < 15
ORDER BY id;
```

Reference solution:

```
SELECT id, name, price
FROM products
WHERE (category = 'Books' OR category = 'Music')
  AND price < 15
ORDER BY id;
```

Evaluation points: Identifies operator precedence: AND binds tighter than OR; Adds parentheses around the OR (or uses category IN ('Books', 'Music')); Price filter now applies to both categories, so 'Atlas' (30.00) is excluded

**9. PRG-SQL-S3-09** · Window Functions · write_code · Hard · ~6 min

The daily_sales table has one row per day. Return sale_date, amount and running_total, where running_total is the cumulative sum of amount from the first day up to and including that day. Use a window function. Sort by sale_date.

Given code:

```
CREATE TABLE daily_sales (
  sale_date DATE PRIMARY KEY,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO daily_sales VALUES
 ('2024-05-01', 120.00), ('2024-05-02', 80.00), ('2024-05-03', 200.00),
 ('2024-05-04', 50.00);
```

Reference solution:

```
SELECT sale_date, amount,
       SUM(amount) OVER (ORDER BY sale_date
                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM daily_sales
ORDER BY sale_date;
```

Evaluation points: Uses SUM(amount) OVER (ORDER BY sale_date ...); No PARTITION BY (one running total over all days); Includes the current day in the total; Sorted by sale_date (a correlated subquery answer is acceptable but less idiomatic)

**10. PRG-SQL-S3-10** · Constraints & Keys · explain_output · Hard · ~6 min

Foreign keys are enforced. orders references customers with ON DELETE CASCADE; payments references customers with no ON DELETE action. Each numbered statement runs on its own. Say which numbered statements fail and why, and state the single row returned by the final query.

Given code:

```
CREATE TABLE customers (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL
);
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE
);
CREATE TABLE payments (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id)
);
INSERT INTO customers VALUES (1, 'Iris'), (2, 'Jon'), (3, 'Kai');  -- (1)
INSERT INTO orders VALUES (10, 1), (11, 1), (12, 2);               -- (2)
INSERT INTO payments VALUES (100, 2);                              -- (3)
DELETE FROM customers WHERE id = 1;                                -- (4)
DELETE FROM customers WHERE id = 2;                                -- (5)
INSERT INTO orders VALUES (13, 1);                                 -- (6)

-- Query:
SELECT (SELECT COUNT(*) FROM customers) AS customers_left,
       (SELECT COUNT(*) FROM orders) AS orders_left,
       (SELECT COUNT(*) FROM payments) AS payments_left;
```

Reference solution:

```
Failing statements: (5), (6)

Result rows:
customers_left | orders_left | payments_left
2 | 1 | 1

(4) deletes customer 1 and ON DELETE CASCADE removes orders 10 and 11. (5) fails because payment 100 references customer 2 and that foreign key has no cascade, so the delete is rejected as a whole (customer 2 and order 12 remain). (6) fails because customer 1 no longer exists. Remaining: customers 2 and 3, order 12, payment 100.
```

Evaluation points: (4) succeeds and cascades: orders 10 and 11 are deleted automatically; (5) fails: payment 100 still references customer 2 and payments has no cascade, so the whole DELETE is rejected (order 12 stays); (6) fails: customer 1 no longer exists (foreign key); Result: customers_left 2, orders_left 1, payments_left 1

### SQL – Set 4

**1. PRG-SQL-S4-01** · IN / BETWEEN · write_code · Easy · ~3 min

Return invoice_no and amount for every invoice whose amount is from 100 to 500, both limits included. Use BETWEEN. Sort by amount ascending.

Given code:

```
CREATE TABLE invoices (
  id INT PRIMARY KEY,
  invoice_no VARCHAR(12) NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO invoices VALUES
 (1, 'INV-001', 99.00), (2, 'INV-002', 100.00), (3, 'INV-003', 320.40),
 (4, 'INV-004', 500.00), (5, 'INV-005', 875.00);
```

Reference solution:

```
SELECT invoice_no, amount
FROM invoices
WHERE amount BETWEEN 100 AND 500
ORDER BY amount;
```

Evaluation points: Uses BETWEEN 100 AND 500; Both limits included (100.00 and 500.00 appear); Sorted by amount ascending

**2. PRG-SQL-S4-02** · Aggregates · write_code · Easy · ~3 min

Write a query that returns one number, unique_customers: how many different customers have placed at least one order. A customer with several orders counts once.

Given code:

```
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO orders VALUES
 (1, 7, 20.00), (2, 8, 35.00), (3, 7, 12.00), (4, 9, 50.00), (5, 8, 10.00);
```

Reference solution:

```
SELECT COUNT(DISTINCT customer_id) AS unique_customers
FROM orders;
```

Evaluation points: Uses COUNT(DISTINCT customer_id) (or counts rows of a DISTINCT subquery); Does not use COUNT(*) (which would give 5); Returns a single value aliased unique_customers

**3. PRG-SQL-S4-03** · DISTINCT · explain_output · Easy · ~3 min

State every row returned by the query in starter_code, in order, and explain what DISTINCT does when more than one column is selected.

Given code:

```
CREATE TABLE shipments (
  id INT PRIMARY KEY,
  city VARCHAR(20) NOT NULL,
  carrier VARCHAR(20) NOT NULL
);
INSERT INTO shipments VALUES
 (1, 'Delhi', 'FastShip'), (2, 'Delhi', 'FastShip'), (3, 'Delhi', 'QuickLog'),
 (4, 'Mumbai', 'FastShip'), (5, 'Mumbai', 'FastShip'), (6, 'Agra', 'QuickLog');

-- Query:
SELECT DISTINCT city, carrier
FROM shipments
ORDER BY city, carrier;
```

Reference solution:

```
Result rows:
city | carrier
Agra | QuickLog
Delhi | FastShip
Delhi | QuickLog
Mumbai | FastShip

DISTINCT applies to the whole selected row, so duplicates are removed only when both city and carrier are equal. Delhi appears twice because it has two different carriers.
```

Evaluation points: Four rows: Agra/QuickLog, Delhi/FastShip, Delhi/QuickLog, Mumbai/FastShip; DISTINCT removes rows only when ALL selected columns match (the combination is unique); Delhi appears twice because the carrier differs

**4. PRG-SQL-S4-04** · INSERT · write_code · Medium · ~5 min

Write one INSERT ... SELECT statement that copies the id, customer_id and amount of every order with status 'Closed' from orders into orders_archive. Do not modify or delete rows in orders.

Given code:

```
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  status VARCHAR(10) NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
CREATE TABLE orders_archive (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO orders VALUES
 (1, 5, 'Closed', 40.00), (2, 6, 'Open', 25.00),
 (3, 5, 'Closed', 60.00), (4, 7, 'Open', 90.00);
```

Reference solution:

```
INSERT INTO orders_archive (id, customer_id, amount)
SELECT id, customer_id, amount
FROM orders
WHERE status = 'Closed';
```

Evaluation points: Uses INSERT INTO ... SELECT (no VALUES list with hard-coded rows); Lists target columns in matching order; Filters WHERE status = 'Closed'; orders is left unchanged

**5. PRG-SQL-S4-05** · INNER JOIN · write_code · Medium · ~5 min

Produce an order line report: order_id, customer_name, product_name, qty and line_total (qty multiplied by the product's unit_price) for every order item. Join the four tables. Sort by order_id, then product_name.

Given code:

```
CREATE TABLE customers (id INT PRIMARY KEY, name VARCHAR(40) NOT NULL);
CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR(40) NOT NULL, unit_price DECIMAL(8,2) NOT NULL);
CREATE TABLE orders (id INT PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(id));
CREATE TABLE order_items (
  order_id INT NOT NULL REFERENCES orders(id),
  product_id INT NOT NULL REFERENCES products(id),
  qty INT NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
INSERT INTO customers VALUES (1, 'Lumen Ltd'), (2, 'Mesa Inc');
INSERT INTO products VALUES (1, 'Toner', 45.00), (2, 'Paper Box', 12.50), (3, 'Binder', 3.00);
INSERT INTO orders VALUES (500, 1), (501, 2);
INSERT INTO order_items VALUES (500, 2, 4), (500, 1, 1), (501, 3, 10);
```

Reference solution:

```
SELECT o.id AS order_id,
       c.name AS customer_name,
       p.name AS product_name,
       oi.qty,
       oi.qty * p.unit_price AS line_total
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN customers c ON c.id = o.customer_id
JOIN products p ON p.id = oi.product_id
ORDER BY o.id, p.name;
```

Evaluation points: Joins order_items -> orders -> customers and order_items -> products with correct keys; Computes qty * unit_price as line_total; No cartesian product (every join has an ON condition); Sorted by order_id then product_name

**6. PRG-SQL-S4-06** · Subqueries · fix_bug · Medium · ~5 min

The query in starter_code should return the names of employees working in any department located in 'Pune', sorted by name. Pune has two departments; the query errors on most databases ('subquery returns more than one row') or silently misses employees. Fix it.

Given code:

```
CREATE TABLE departments (
  id INT PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  location VARCHAR(30) NOT NULL
);
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  dept_id INT REFERENCES departments(id)
);
INSERT INTO departments VALUES (1, 'R&D', 'Pune'), (2, 'Support', 'Pune'), (3, 'Sales', 'Delhi');
INSERT INTO employees VALUES (1, 'Aman', 1), (2, 'Bina', 2), (3, 'Chet', 3), (4, 'Dia', 2);

-- Query to fix:
SELECT name
FROM employees
WHERE dept_id = (SELECT id FROM departments WHERE location = 'Pune')
ORDER BY name;
```

Reference solution:

```
SELECT name
FROM employees
WHERE dept_id IN (SELECT id FROM departments WHERE location = 'Pune')
ORDER BY name;
```

Evaluation points: Recognises that = requires the subquery to return a single value; Replaces = with IN (or rewrites as a JOIN / EXISTS); Returns employees of both Pune departments (Aman, Bina, Dia)

**7. PRG-SQL-S4-07** · UNION · write_code · Medium · ~5 min

Customers and suppliers are stored in separate tables. Return a single list of everyone located in 'Chennai' with two columns: name and party_type, where party_type is the text 'Customer' or 'Supplier'. Sort by name.

Given code:

```
CREATE TABLE customers (id INT PRIMARY KEY, name VARCHAR(40) NOT NULL, city VARCHAR(30) NOT NULL);
CREATE TABLE suppliers (id INT PRIMARY KEY, name VARCHAR(40) NOT NULL, city VARCHAR(30) NOT NULL);
INSERT INTO customers VALUES (1, 'Kavya Stores', 'Chennai'), (2, 'Leela Mart', 'Madurai'), (3, 'Anand Retail', 'Chennai');
INSERT INTO suppliers VALUES (1, 'Bharat Steel', 'Chennai'), (2, 'Zenith Paper', 'Pune');
```

Reference solution:

```
SELECT name, 'Customer' AS party_type FROM customers WHERE city = 'Chennai'
UNION ALL
SELECT name, 'Supplier' AS party_type FROM suppliers WHERE city = 'Chennai'
ORDER BY name;
```

Evaluation points: Combines two SELECTs with UNION or UNION ALL (same number/order of columns); Adds a literal column to label the source; Filters each part on city = 'Chennai'; Single ORDER BY at the end of the whole union

**8. PRG-SQL-S4-08** · Indexes · explain_output · Medium · ~5 min

starter_code creates a composite UNIQUE INDEX on stock(store_id, sku) and runs numbered INSERTs, each on its own. Say which statements fail, state the rows returned by the final query, and explain whether this index would help a query that filters only on sku.

Given code:

```
CREATE TABLE stock (
  store_id INT NOT NULL,
  sku VARCHAR(20) NOT NULL,
  qty INT NOT NULL
);
CREATE UNIQUE INDEX ux_stock_store_sku ON stock(store_id, sku);
INSERT INTO stock VALUES (1, 'A100', 5);  -- (1)
INSERT INTO stock VALUES (1, 'B200', 3);  -- (2)
INSERT INTO stock VALUES (2, 'A100', 7);  -- (3)
INSERT INTO stock VALUES (1, 'A100', 9);  -- (4)
INSERT INTO stock VALUES (2, 'B200', 1);  -- (5)

-- Query:
SELECT store_id, COUNT(*) AS sku_count, SUM(qty) AS total_qty
FROM stock
GROUP BY store_id
ORDER BY store_id;
```

Reference solution:

```
Failing statements: (4)

Result rows:
store_id | sku_count | total_qty
1 | 2 | 8
2 | 2 | 8

The composite unique index forbids a repeated (store_id, sku) pair, so only (4) fails; the same sku in a different store is fine. The index is sorted by store_id first and sku second, so it helps filters on store_id or on store_id + sku; a filter on sku alone usually cannot seek into it (it may at best scan the index), so a separate index on sku would be needed.
```

Evaluation points: Only (4) fails: the pair (1, 'A100') already exists; (3) and (5) succeed: uniqueness is on the combination, not on each column; Result: store 1 -> 2 SKUs, qty 8; store 2 -> 2 SKUs, qty 8; A (store_id, sku) index is ordered by store_id first, so a filter on sku alone generally cannot use it efficiently (needs its own index on sku)

**9. PRG-SQL-S4-09** · Window Functions · write_code · Hard · ~6 min

For each customer return their most recent order: customer_id, order_id, order_date and amount. If a customer has two orders on the same latest date, choose the one with the higher id. Use ROW_NUMBER(). Sort by customer_id.

Given code:

```
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  order_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO orders VALUES
 (1, 1, '2024-01-05', 30.00), (2, 1, '2024-02-10', 45.00),
 (3, 2, '2024-03-01', 20.00), (4, 2, '2024-03-01', 70.00),
 (5, 3, '2023-11-20', 15.00), (6, 1, '2024-01-28', 60.00);
```

Reference solution:

```
SELECT customer_id, order_id, order_date, amount
FROM (
  SELECT customer_id, id AS order_id, order_date, amount,
         ROW_NUMBER() OVER (PARTITION BY customer_id
                            ORDER BY order_date DESC, id DESC) AS rn
  FROM orders
) latest
WHERE rn = 1
ORDER BY customer_id;
```

Evaluation points: ROW_NUMBER() partitioned by customer_id; Ordered by order_date DESC, then id DESC for ties; Filters rn = 1 in an outer query or CTE; One row per customer (order 4 for customer 2)

**10. PRG-SQL-S4-10** · DELETE · write_code · Hard · ~6 min

An import loaded some products more than once: rows in products_import can share the same barcode. Write a single DELETE statement that removes the duplicates, keeping only the row with the lowest id for each barcode.

Given code:

```
CREATE TABLE products_import (
  id INT PRIMARY KEY,
  barcode VARCHAR(13) NOT NULL,
  name VARCHAR(40) NOT NULL
);
INSERT INTO products_import VALUES
 (1, '8901001', 'Tea 250g'), (2, '8901002', 'Coffee 200g'),
 (3, '8901001', 'Tea 250g'), (4, '8901003', 'Sugar 1kg'),
 (5, '8901002', 'Coffee 200g'), (6, '8901001', 'Tea 250g');
```

Reference solution:

```
DELETE FROM products_import
WHERE id NOT IN (
  SELECT MIN(id)
  FROM products_import
  GROUP BY barcode
);
```

Evaluation points: Keeps MIN(id) per barcode using GROUP BY barcode in a subquery; Deletes every other row (NOT IN / correlated EXISTS with a lower id); Does not delete rows that have no duplicate (Sugar); Single DELETE statement, no hard-coded ids

### SQL – Set 5

**1. PRG-SQL-S5-01** · SELECT / WHERE · write_code · Easy · ~3 min

Return product, quantity, unit_price and a calculated column line_total (quantity multiplied by unit_price) for every row in order_items, sorted by line_total from highest to lowest.

Given code:

```
CREATE TABLE order_items (
  id INT PRIMARY KEY,
  product VARCHAR(40) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(8,2) NOT NULL
);
INSERT INTO order_items VALUES
 (1, 'Folder', 10, 1.50), (2, 'Scanner', 1, 120.00),
 (3, 'Toner', 3, 45.00), (4, 'Tape', 6, 2.25);
```

Reference solution:

```
SELECT product, quantity, unit_price,
       quantity * unit_price AS line_total
FROM order_items
ORDER BY line_total DESC;
```

Evaluation points: Computes quantity * unit_price in the SELECT list; Aliases it line_total; Sorts by the computed value descending (alias or expression)

**2. PRG-SQL-S5-02** · DELETE · write_code · Easy · ~3 min

Write a DELETE statement that removes every order whose status is 'Cancelled' and leaves all other orders in place.

Given code:

```
CREATE TABLE orders (
  id INT PRIMARY KEY,
  status VARCHAR(15) NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO orders VALUES
 (1, 'Paid', 40.00), (2, 'Cancelled', 15.00), (3, 'Pending', 22.00),
 (4, 'Cancelled', 60.00), (5, 'Paid', 18.00);
```

Reference solution:

```
DELETE FROM orders
WHERE status = 'Cancelled';
```

Evaluation points: Uses DELETE FROM orders with a WHERE clause; Condition status = 'Cancelled'; Does not delete other rows (a DELETE without WHERE empties the table)

**3. PRG-SQL-S5-03** · NULL Handling · explain_output · Easy · ~3 min

Some products have no discount (NULL). State the rows (name, net_a, net_b) returned by the query in starter_code and explain why net_a and net_b differ.

Given code:

```
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  discount DECIMAL(8,2)
);
INSERT INTO products VALUES
 (1, 'Lamp', 40.00, 5.00), (2, 'Mat', 25.00, NULL), (3, 'Clock', 30.00, 0.00);

-- Query:
SELECT name,
       price - discount AS net_a,
       price - COALESCE(discount, 0) AS net_b
FROM products
ORDER BY id;
```

Reference solution:

```
Result rows:
name | net_a | net_b
Lamp | 35 | 35
Mat | NULL | 25
Clock | 30 | 30

price - NULL is NULL, so Mat's net_a is NULL. COALESCE(discount, 0) turns the missing discount into 0, giving 25. A stored 0.00 discount is not NULL, so Clock gives 30 in both columns.
```

Evaluation points: Lamp 35 35; Mat NULL 25; Clock 30 30; Any arithmetic with NULL yields NULL (net_a for Mat); COALESCE(discount, 0) replaces NULL with 0, so net_b is 25

**4. PRG-SQL-S5-04** · GROUP BY / HAVING · write_code · Medium · ~5 min

Return region, sales_year and total_amount (sum of amount) for every combination of region and year that appears in the sales table. Sort by region, then sales_year.

Given code:

```
CREATE TABLE sales (
  id INT PRIMARY KEY,
  region VARCHAR(20) NOT NULL,
  sales_year INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO sales VALUES
 (1, 'East', 2023, 100.00), (2, 'East', 2024, 250.00), (3, 'West', 2023, 80.00),
 (4, 'East', 2023, 40.00), (5, 'West', 2024, 60.00), (6, 'West', 2024, 90.00);
```

Reference solution:

```
SELECT region, sales_year, SUM(amount) AS total_amount
FROM sales
GROUP BY region, sales_year
ORDER BY region, sales_year;
```

Evaluation points: GROUP BY both region and sales_year; Every non-aggregated selected column is in GROUP BY; SUM(amount) aliased total_amount; Sorted by region then year

**5. PRG-SQL-S5-05** · Self Join · write_code · Medium · ~5 min

List every pair of different employees who work in the same department, each pair only once: employee_1, employee_2 and department, where employee_1 is the employee with the smaller id. Sort by department, then by the ids of employee_1 and employee_2.

Given code:

```
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  department VARCHAR(30) NOT NULL
);
INSERT INTO employees VALUES
 (1, 'Ajay', 'Ops'), (2, 'Bea', 'Ops'), (3, 'Cara', 'Finance'),
 (4, 'Dan', 'Ops'), (5, 'Eve', 'Finance'), (6, 'Finn', 'HR');
```

Reference solution:

```
SELECT e1.name AS employee_1, e2.name AS employee_2, e1.department
FROM employees e1
JOIN employees e2
  ON e2.department = e1.department
 AND e1.id < e2.id
ORDER BY e1.department, e1.id, e2.id;
```

Evaluation points: Self join on equal department; Uses e1.id < e2.id so no one is paired with themselves and each pair appears once; HR (only one employee) produces no pair; Correct sort

**6. PRG-SQL-S5-06** · Subqueries · fix_bug · Medium · ~5 min

The query in starter_code should return the names of customers who have no orders, sorted by name. Some orders were entered without a customer (customer_id is NULL), and now the query returns no rows at all. Explain why and fix it.

Given code:

```
CREATE TABLE customers (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL
);
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO customers VALUES (1, 'Asha'), (2, 'Bilal'), (3, 'Cleo'), (4, 'Dmitri');
INSERT INTO orders VALUES (1, 1, 30.00), (2, NULL, 12.00), (3, 3, 45.00);

-- Query to fix:
SELECT name
FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders)
ORDER BY name;
```

Reference solution:

```
SELECT c.name
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
)
ORDER BY c.name;
```

Evaluation points: Explains that NOT IN against a list containing NULL evaluates to UNKNOWN for every row, so nothing is returned; Fixes with NOT EXISTS (or adds WHERE customer_id IS NOT NULL inside the subquery, or LEFT JOIN ... IS NULL); Returns Bilal and Dmitri

**7. PRG-SQL-S5-07** · GROUP BY / HAVING · write_code · Medium · ~5 min

Return each product_code that was bought by at least 2 different customers, together with buyer_count (the number of different customers). The same customer buying a product several times counts once. Sort by product_code.

Given code:

```
CREATE TABLE order_lines (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  product_code VARCHAR(10) NOT NULL
);
INSERT INTO order_lines VALUES
 (1, 1, 'P-10'), (2, 1, 'P-10'), (3, 1, 'P-20'), (4, 2, 'P-20'),
 (5, 3, 'P-30'), (6, 3, 'P-30'), (7, 2, 'P-30'), (8, 4, 'P-40');
```

Reference solution:

```
SELECT product_code, COUNT(DISTINCT customer_id) AS buyer_count
FROM order_lines
GROUP BY product_code
HAVING COUNT(DISTINCT customer_id) >= 2
ORDER BY product_code;
```

Evaluation points: GROUP BY product_code; COUNT(DISTINCT customer_id) rather than COUNT(*); P-10 (one customer, twice) excluded; filter in HAVING; Sorted by product_code

**8. PRG-SQL-S5-08** · Constraints & Keys · explain_output · Medium · ~5 min

The accounts table uses UNIQUE, NOT NULL and DEFAULT constraints. Each numbered INSERT runs on its own. Say which statements fail and why, and state the rows (id, code, status, credit_limit) returned by the final query, showing NULL where applicable.

Given code:

```
CREATE TABLE accounts (
  id INT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  status VARCHAR(10) DEFAULT 'ACTIVE' NOT NULL,
  credit_limit DECIMAL(10,2) DEFAULT 1000
);
INSERT INTO accounts (id, code) VALUES (1, 'AC01');                        -- (1)
INSERT INTO accounts (id, code, status) VALUES (2, 'AC02', 'CLOSED');      -- (2)
INSERT INTO accounts (id, code) VALUES (3, 'AC01');                        -- (3)
INSERT INTO accounts (id, code, credit_limit) VALUES (4, 'AC04', NULL);    -- (4)
INSERT INTO accounts (id, status) VALUES (5, 'ACTIVE');                    -- (5)

-- Query:
SELECT id, code, status, credit_limit FROM accounts ORDER BY id;
```

Reference solution:

```
Failing statements: (3), (5)

Result rows:
id | code | status | credit_limit
1 | AC01 | ACTIVE | 1000
2 | AC02 | CLOSED | 1000
4 | AC04 | ACTIVE | NULL

(3) violates UNIQUE on code; (5) violates NOT NULL on code because the column was omitted and has no default. DEFAULT values are used only when a column is left out of the INSERT, so row 1 gets 'ACTIVE' and 1000, row 2 keeps 'CLOSED' with the default limit, and row 4's explicit NULL is kept as NULL.
```

Evaluation points: (3) fails: UNIQUE on code ('AC01' exists); (5) fails: code is NOT NULL and has no default; Defaults apply only to omitted columns: row 1 gets ACTIVE and 1000; An explicit NULL is stored as NULL (row 4 credit_limit is NULL, not 1000)

**9. PRG-SQL-S5-09** · Subqueries · write_code · Hard · ~6 min

For each customer who has at least one order, return name, total_spent (sum of their order amounts) and pct_of_total: their total as a percentage of the total of ALL orders, rounded to 2 decimals. Sort by total_spent, highest first.

Given code:

```
CREATE TABLE customers (id INT PRIMARY KEY, name VARCHAR(40) NOT NULL);
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO customers VALUES (1, 'Helix'), (2, 'Ionic'), (3, 'Juno'), (4, 'Kappa');
INSERT INTO orders VALUES
 (1, 1, 300.00), (2, 2, 150.00), (3, 1, 200.00), (4, 3, 100.00), (5, 2, 50.00);
```

Reference solution:

```
SELECT c.name,
       SUM(o.amount) AS total_spent,
       ROUND(100.0 * SUM(o.amount) / (SELECT SUM(amount) FROM orders), 2) AS pct_of_total
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY total_spent DESC;
```

Evaluation points: Groups orders per customer and sums amounts; Divides by the grand total from a scalar subquery (not hard-coded); Avoids integer division (multiplies by 100.0) and rounds to 2 decimals; Customers with no orders (Kappa) are excluded; sorted by total descending

**10. PRG-SQL-S5-10** · UPDATE · write_code · Hard · ~6 min

customers.total_spent is out of date. Write a single UPDATE statement that sets total_spent for every customer to the sum of that customer's order amounts, or 0 for customers who have no orders.

Given code:

```
CREATE TABLE customers (
  id INT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  total_spent DECIMAL(10,2)
);
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  amount DECIMAL(10,2) NOT NULL
);
INSERT INTO customers VALUES (1, 'Lyra', 5.00), (2, 'Milo', NULL), (3, 'Nia', 999.00);
INSERT INTO orders VALUES (1, 1, 40.00), (2, 1, 35.50), (3, 3, 120.00);
```

Reference solution:

```
UPDATE customers
SET total_spent = COALESCE(
  (SELECT SUM(o.amount) FROM orders o WHERE o.customer_id = customers.id),
  0
);
```

Evaluation points: Uses a correlated subquery in SET linked on customer_id = customers.id; COALESCE(..., 0) so customers without orders get 0 instead of NULL; Updates all customers (no WHERE that skips anyone); Single statement, no hard-coded values
