import json, textwrap

def d(s):
    return textwrap.dedent(s).strip("\n")

Q = []  # list of (set, dict)

def q(set_no, topic, task_type, difficulty, minutes, question, reference, points, tests,
      starter=None, main=None, exp=None, wrap=True, support="", out=None, explanation=None):
    item = {
        "topic": topic, "task_type": task_type, "difficulty": difficulty,
        "question": d(question),
    }
    if starter is not None:
        item["starter_code"] = d(starter)
    if task_type == "explain_output":
        item["reference_solution"] = "Output:\n" + d(out) + "\n\nExplanation: " + d(explanation)
    else:
        item["reference_solution"] = d(reference)
    item["evaluation_points"] = points
    item["test_cases"] = tests
    item["expected_minutes"] = minutes
    item["marks"] = 10
    item["_main"] = main
    item["_exp"] = exp
    item["_wrap"] = wrap
    item["_support"] = d(support) if support else ""
    item["_out"] = d(out) if out else None
    Q.append((set_no, item))

# ------------------------------------------------------------------ SET 1
q(1, "Conditionals", "write_code", "Easy", 3,
  """
  Write a C# method `static string Classify(int n)` that returns "Positive" if n is greater than zero, "Negative" if n is less than zero, and "Zero" if n equals zero.
  """,
  """
  static string Classify(int n)
  {
      if (n > 0) return "Positive";
      if (n < 0) return "Negative";
      return "Zero";
  }
  """,
  ["Returns exactly \"Positive\", \"Negative\" or \"Zero\" (correct spelling/case)",
   "Handles zero as its own case",
   "Correct comparison operators (no off-by-one such as >= 0 for Positive)",
   "Every code path returns a value"],
  [{"input": "n = 5", "expected": "Positive"}, {"input": "n = -3", "expected": "Negative"}, {"input": "n = 0", "expected": "Zero"}],
  main=['Console.WriteLine(Classify(5));', 'Console.WriteLine(Classify(-3));', 'Console.WriteLine(Classify(0));'])

q(1, "Value vs Reference Types", "explain_output", "Easy", 3,
  """
  The program below copies a struct variable and a class variable, then modifies each copy. Predict the two values it prints and explain, in terms of value types and reference types, why they differ.
  """, None,
  ["States the exact output: 1 then 10",
   "Explains that a struct is a value type, so `b = a` copies the data",
   "Explains that a class is a reference type, so `d = c` copies the reference and both variables point to the same object",
   "Explains that changing d.X is therefore visible through c"],
  [],
  starter="""
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
  """,
  out="""
  1
  10
  """,
  explanation="""
  PointS is a struct (value type): `PointS b = a;` copies the whole value, so changing b.X does not affect a, and a.X is still 1. PointC is a class (reference type): `PointC d = c;` copies only the reference, so c and d refer to the same object on the heap; setting d.X = 10 changes the object that c also refers to, so c.X prints 10.
  """)

q(1, "Loops", "write_code", "Easy", 3,
  """
  Write a C# method `static int SumDigits(int n)` that returns the sum of the decimal digits of n. Negative numbers should be treated as their absolute value (e.g. -507 gives 5 + 0 + 7 = 12). You may assume |n| <= 1,000,000,000. Use a loop; do not convert the number to a string.
  """,
  """
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
  """,
  ["Uses % 10 and / 10 in a loop to extract digits",
   "Handles negative input via Math.Abs (or equivalent)",
   "Returns 0 for input 0",
   "Does not convert to string as required"],
  [{"input": "n = 1234", "expected": "10"}, {"input": "n = -507", "expected": "12"}, {"input": "n = 0", "expected": "0"}],
  main=['Console.WriteLine(SumDigits(1234));', 'Console.WriteLine(SumDigits(-507));', 'Console.WriteLine(SumDigits(0));'])

q(1, "Strings", "write_code", "Medium", 5,
  """
  Write a C# method `static bool IsPalindrome(string s)` that returns true if s reads the same forwards and backwards when you consider only letters and digits and ignore case. Spaces and punctuation are ignored. An empty string is a palindrome. Use a two-pointer approach (do not build a reversed copy with LINQ).
  """,
  """
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
  """,
  ["Skips characters that are not letters or digits (char.IsLetterOrDigit)",
   "Compares case-insensitively (char.ToLower / ToUpper)",
   "Two pointers move towards each other and stop when they meet",
   "Returns true for an empty string or a string with no letters/digits"],
  [{"input": "s = \"A man, a plan, a canal: Panama\"", "expected": "true"},
   {"input": "s = \"race a car\"", "expected": "false"},
   {"input": "s = \"\"", "expected": "true"}],
  main=['Console.WriteLine(IsPalindrome("A man, a plan, a canal: Panama"));',
        'Console.WriteLine(IsPalindrome("race a car"));',
        'Console.WriteLine(IsPalindrome(""));'],
  exp=["True", "False", "True"])

q(1, "Dictionary<TKey,TValue>", "write_code", "Medium", 4,
  """
  Write a C# method `static Dictionary<string, int> WordFrequency(string text)` that counts how many times each word appears in text. Words are separated by one or more spaces. Counting is case-insensitive: store every key in lower case. An empty string returns an empty dictionary.
  """,
  """
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
  """,
  ["Splits on spaces and ignores empty entries caused by repeated spaces",
   "Normalises keys to lower case",
   "Checks for an existing key (ContainsKey/TryGetValue) before incrementing, avoiding KeyNotFoundException",
   "Returns an empty dictionary for empty input"],
  [{"input": "text = \"the cat and the hat\"", "expected": "{the: 2, cat: 1, and: 1, hat: 1}"},
   {"input": "text = \"Go  go GO\"", "expected": "{go: 3}"},
   {"input": "text = \"\"", "expected": "{} (empty)"}],
  main=['Console.WriteLine(string.Join(", ", WordFrequency("the cat and the hat").OrderBy(p => p.Key).Select(p => p.Key + "=" + p.Value)));',
        'Console.WriteLine(string.Join(", ", WordFrequency("Go  go GO").OrderBy(p => p.Key).Select(p => p.Key + "=" + p.Value)));',
        'Console.WriteLine(WordFrequency("").Count);'],
  exp=["and=1, cat=1, hat=1, the=2", "go=3", "0"])

q(1, "Arrays", "fix_bug", "Medium", 4,
  """
  The method below should return the largest value in a non-empty integer array, but it returns the wrong result for some inputs. Find the bug, explain it, and provide the corrected method.
  """,
  """
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
  """,
  ["Identifies that initialising max to 0 is wrong when all values are negative",
   "Initialises max with numbers[0] (or int.MinValue)",
   "Keeps the rest of the loop logic correct",
   "Correctly returns -2 for { -5, -2, -8 }"],
  [{"input": "numbers = { 3, 9, 2 }", "expected": "9"}, {"input": "numbers = { -5, -2, -8 }", "expected": "-2"}],
  starter="""
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
  """,
  main=['Console.WriteLine(FindMax(new[] { 3, 9, 2 }));', 'Console.WriteLine(FindMax(new[] { -5, -2, -8 }));'])

q(1, "Classes, Properties & Constructors", "write_code", "Medium", 5,
  """
  Write a C# class `BankAccount` with:
  - a read-only property `Owner` (string) and a property `Balance` (decimal) that can be read publicly but only changed inside the class;
  - a constructor `BankAccount(string owner, decimal initialBalance)` that throws ArgumentException if initialBalance is negative;
  - `void Deposit(decimal amount)` that throws ArgumentException if amount <= 0, otherwise adds it to Balance;
  - `bool Withdraw(decimal amount)` that returns false (and changes nothing) if amount <= 0 or amount > Balance, otherwise subtracts it and returns true.
  """,
  """
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
  """,
  ["Balance has a public getter and a private setter; Owner is get-only",
   "Constructor validates initialBalance and assigns both properties",
   "Deposit throws ArgumentException for non-positive amounts",
   "Withdraw returns false without modifying Balance when the amount is invalid or exceeds Balance",
   "Uses decimal for money"],
  [{"input": "new BankAccount(\"Ana\", 100); Deposit(50); Balance", "expected": "150"},
   {"input": "then Withdraw(200); Balance", "expected": "false, Balance stays 150"},
   {"input": "then Withdraw(30); Balance", "expected": "true, Balance 120"},
   {"input": "Deposit(-5)", "expected": "throws ArgumentException"}],
  main=['var a = new BankAccount("Ana", 100m); a.Deposit(50m); Console.WriteLine(a.Balance);',
        'Console.WriteLine(a.Withdraw(200m) + " " + a.Balance);',
        'Console.WriteLine(a.Withdraw(30m) + " " + a.Balance);',
        'try { a.Deposit(-5m); Console.WriteLine("no exception"); } catch (Exception e) { Console.WriteLine(e.GetType().Name); }'],
  exp=["150", "False 150", "True 120", "ArgumentException"], wrap=False)

q(1, "LINQ Basics", "write_code", "Medium", 4,
  """
  Given the class below, write a C# method `static List<string> NamesAtOrAbove(List<Product> products, decimal minPrice)` that uses LINQ to return the names of all products whose Price is greater than or equal to minPrice, ordered by Price ascending and then by Name ascending for equal prices. Return an empty list if nothing matches.

  public class Product { public string Name { get; set; } public decimal Price { get; set; } }
  """,
  """
  static List<string> NamesAtOrAbove(List<Product> products, decimal minPrice)
  {
      return products
          .Where(p => p.Price >= minPrice)
          .OrderBy(p => p.Price)
          .ThenBy(p => p.Name)
          .Select(p => p.Name)
          .ToList();
  }
  """,
  ["Filters with Where using >= (inclusive)",
   "Orders by Price then by Name (OrderBy + ThenBy, not two OrderBy calls)",
   "Projects to names with Select and materialises with ToList",
   "Returns an empty list (not null) when nothing matches"],
  [{"input": "products = [Pen 2, Book 12, Lamp 30, Mug 12], minPrice = 10", "expected": "[Book, Mug, Lamp]"},
   {"input": "same products, minPrice = 100", "expected": "[] (empty list)"}],
  support="public class Product { public string Name { get; set; } public decimal Price { get; set; } }",
  main=['var ps = new List<Product> { new Product { Name = "Pen", Price = 2m }, new Product { Name = "Book", Price = 12m }, new Product { Name = "Lamp", Price = 30m }, new Product { Name = "Mug", Price = 12m } };',
        'Console.WriteLine(string.Join(", ", NamesAtOrAbove(ps, 10m)));',
        'Console.WriteLine(NamesAtOrAbove(ps, 100m).Count);'],
  exp=[None, "Book, Mug, Lamp", "0"])

q(1, "Recursion", "write_code", "Hard", 6,
  """
  Write a recursive C# method `static List<string> Permutations(string s)` that returns every permutation of the characters in s. All characters in s are distinct and 1 <= s.Length <= 6. The order of the returned strings does not matter, but each permutation must appear exactly once.
  """,
  """
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
  """,
  ["Has a correct base case (no characters left -> add the built string)",
   "Recursive step picks each remaining character once and recurses on the rest",
   "Produces n! results with no duplicates or missing permutations",
   "Accumulates results in a list (helper method or returned lists)"],
  [{"input": "s = \"ab\"", "expected": "[ab, ba]"},
   {"input": "s = \"abc\"", "expected": "[abc, acb, bac, bca, cab, cba] (any order)"},
   {"input": "s = \"x\"", "expected": "[x]"}],
  main=['Console.WriteLine(string.Join(", ", Permutations("ab").OrderBy(x => x, StringComparer.Ordinal)));',
        'Console.WriteLine(string.Join(", ", Permutations("abc").OrderBy(x => x, StringComparer.Ordinal)));',
        'Console.WriteLine(string.Join(", ", Permutations("x")));'],
  exp=["ab, ba", "abc, acb, bac, bca, cab, cba", "x"])

q(1, "Methods (out parameters)", "write_code", "Hard", 5,
  """
  Write a C# method `static bool TryParseTime(string s, out int totalMinutes)` that parses a 24-hour time in the exact format "HH:MM" (two digits, a colon, two digits). If s is valid (hours 00-23, minutes 00-59) set totalMinutes to the number of minutes since midnight and return true. Otherwise set totalMinutes to 0 and return false. Null, wrong length, missing colon or non-digit characters are invalid. Do not throw exceptions.
  """,
  """
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
  """,
  ["Assigns the out parameter on every path (required by the compiler)",
   "Validates null, length 5, colon position and digit characters before parsing",
   "Rejects hours > 23 and minutes > 59",
   "Computes hours * 60 + minutes and never throws"],
  [{"input": "s = \"09:30\"", "expected": "true, totalMinutes = 570"},
   {"input": "s = \"23:59\"", "expected": "true, totalMinutes = 1439"},
   {"input": "s = \"24:00\"", "expected": "false, totalMinutes = 0"},
   {"input": "s = \"9:30\"", "expected": "false, totalMinutes = 0"}],
  main=['{ bool ok = TryParseTime("09:30", out int m); Console.WriteLine(ok + " " + m); }',
        '{ bool ok = TryParseTime("23:59", out int m); Console.WriteLine(ok + " " + m); }',
        '{ bool ok = TryParseTime("24:00", out int m); Console.WriteLine(ok + " " + m); }',
        '{ bool ok = TryParseTime("9:30", out int m); Console.WriteLine(ok + " " + m); }'],
  exp=["True 570", "True 1439", "False 0", "False 0"])

# ------------------------------------------------------------------ SET 2
q(2, "Strings", "write_code", "Easy", 3,
  """
  Write a C# method `static int CountVowels(string s)` that returns how many vowels (a, e, i, o, u, in upper or lower case) appear in s.
  """,
  """
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
  """,
  ["Iterates over every character",
   "Treats upper and lower case vowels the same",
   "Counts only a, e, i, o, u (not y)",
   "Returns 0 when there are no vowels"],
  [{"input": "s = \"Hello World\"", "expected": "3"}, {"input": "s = \"rhythm\"", "expected": "0"}, {"input": "s = \"AEIOU\"", "expected": "5"}],
  main=['Console.WriteLine(CountVowels("Hello World"));', 'Console.WriteLine(CountVowels("rhythm"));', 'Console.WriteLine(CountVowels("AEIOU"));'])

q(2, "Null Handling", "explain_output", "Easy", 3,
  """
  What does the following C# program print? Explain what the ?. and ?? operators do on each line.
  """, None,
  ["States the exact four output lines: No city, No customer, 4, []",
   "Explains ?. returns null instead of throwing when the left side is null",
   "Explains ?? supplies the right-hand value when the left side is null",
   "Explains that c1.Name?.Length gives an int? with value 4, and a null string interpolates as empty text"],
  [],
  starter="""
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
  """,
  out="""
  No city
  No customer
  4
  []
  """,
  explanation="""
  c1.Address was never set, so it is null; `c1.Address?.City` short-circuits to null instead of throwing NullReferenceException, and `?? "No city"` replaces the null. c2 is null, so `c2?.Name` is null and "No customer" is printed. c1.Name is "Ravi", so `c1.Name?.Length` evaluates to an int? holding 4. A null string inside an interpolated string is formatted as an empty string, giving "[]".
  """)

q(2, "Arrays", "write_code", "Easy", 3,
  """
  Write a C# method `static void ReverseInPlace(int[] arr)` that reverses the elements of arr in place (the same array object is modified). Do not use Array.Reverse, LINQ or a second array.
  """,
  """
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
  """,
  ["Swaps elements from both ends moving inwards",
   "Stops at the middle (does not swap back)",
   "Uses no extra array, Array.Reverse or LINQ",
   "Works for empty and even/odd length arrays"],
  [{"input": "arr = { 1, 2, 3, 4, 5 }", "expected": "arr becomes { 5, 4, 3, 2, 1 }"},
   {"input": "arr = { 7, 8 }", "expected": "arr becomes { 8, 7 }"},
   {"input": "arr = { }", "expected": "arr stays { }"}],
  main=['{ var a = new[] { 1, 2, 3, 4, 5 }; ReverseInPlace(a); Console.WriteLine(string.Join(",", a)); }',
        '{ var a = new[] { 7, 8 }; ReverseInPlace(a); Console.WriteLine(string.Join(",", a)); }',
        '{ var a = new int[0]; ReverseInPlace(a); Console.WriteLine(a.Length); }'],
  exp=["5,4,3,2,1", "8,7", "0"])

q(2, "List<T>", "write_code", "Medium", 4,
  """
  Write a C# method `static List<string> RemoveDuplicates(List<string> items)` that returns a new list containing each distinct string from items once, keeping the order of first appearance. Comparison is case-sensitive. Do not modify the input list and do not use LINQ's Distinct.
  """,
  """
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
  """,
  ["Returns a new list and leaves the input unchanged",
   "Keeps first-occurrence order",
   "Uses a HashSet (or equivalent) for efficient lookups rather than nested loops (preferred, not mandatory)",
   "Handles an empty list"],
  [{"input": "items = [\"a\", \"b\", \"a\", \"c\", \"b\"]", "expected": "[\"a\", \"b\", \"c\"]"},
   {"input": "items = [\"X\", \"x\", \"X\"]", "expected": "[\"X\", \"x\"]"},
   {"input": "items = []", "expected": "[]"}],
  main=['Console.WriteLine(string.Join(",", RemoveDuplicates(new List<string> { "a", "b", "a", "c", "b" })));',
        'Console.WriteLine(string.Join(",", RemoveDuplicates(new List<string> { "X", "x", "X" })));',
        'Console.WriteLine(RemoveDuplicates(new List<string>()).Count);'],
  exp=["a,b,c", "X,x", "0"])

q(2, "Inheritance & Polymorphism", "fix_bug", "Medium", 4,
  """
  In the code below, `Shape s = new Rectangle(3, 4); Console.WriteLine(s.Area());` prints 0 instead of 12. Find the bug, explain why it happens, and provide the corrected code.
  """,
  """
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
  """,
  ["Identifies that `new` hides the base method instead of overriding it",
   "Explains that with `new`, a call through a Shape reference uses Shape.Area",
   "Replaces `new` with `override`",
   "Result through the base-class reference is 12"],
  [{"input": "Shape s = new Rectangle(3, 4); s.Area()", "expected": "12"},
   {"input": "Shape s = new Shape(); s.Area()", "expected": "0"}],
  starter="""
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
  """,
  main=['{ Shape s = new Rectangle(3, 4); Console.WriteLine(s.Area()); }', '{ Shape s = new Shape(); Console.WriteLine(s.Area()); }'],
  wrap=False)

q(2, "Loops", "write_code", "Medium", 4,
  """
  Write a C# method `static bool IsPrime(int n)` that returns true if n is a prime number and false otherwise. Numbers less than 2 are not prime. Your loop should only test divisors up to the square root of n.
  """,
  """
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
  """,
  ["Returns false for n < 2 (including 0, 1 and negatives)",
   "Loops only while i * i <= n (or i <= Math.Sqrt(n))",
   "Returns false as soon as a divisor is found",
   "Correctly treats 2 as prime and perfect squares such as 49 as not prime"],
  [{"input": "n = 2", "expected": "true"}, {"input": "n = 1", "expected": "false"}, {"input": "n = 29", "expected": "true"}, {"input": "n = 49", "expected": "false"}],
  main=['Console.WriteLine(IsPrime(2));', 'Console.WriteLine(IsPrime(1));', 'Console.WriteLine(IsPrime(29));', 'Console.WriteLine(IsPrime(49));'],
  exp=["True", "False", "True", "False"])

q(2, "Exceptions", "write_code", "Medium", 4,
  """
  Write a C# method `static decimal DiscountedPrice(decimal price, int percent)` that returns price reduced by percent percent. Throw ArgumentException if price is negative, and ArgumentOutOfRangeException if percent is less than 0 or greater than 100. Include a meaningful message (and the parameter name) in each exception.
  """,
  """
  static decimal DiscountedPrice(decimal price, int percent)
  {
      if (price < 0)
          throw new ArgumentException("Price cannot be negative.", nameof(price));
      if (percent < 0 || percent > 100)
          throw new ArgumentOutOfRangeException(nameof(percent), "Percent must be between 0 and 100.");
      return price - price * percent / 100;
  }
  """,
  ["Validates inputs before computing",
   "Throws ArgumentException for negative price and ArgumentOutOfRangeException for percent outside 0-100",
   "Uses the correct constructor argument order (ArgumentOutOfRangeException takes paramName first)",
   "Computes the discount with decimal arithmetic (no integer division issues)"],
  [{"input": "price = 200, percent = 15", "expected": "170"},
   {"input": "price = 50, percent = 120", "expected": "throws ArgumentOutOfRangeException"},
   {"input": "price = -5, percent = 10", "expected": "throws ArgumentException"}],
  main=['try { Console.WriteLine(DiscountedPrice(200m, 15)); } catch (Exception e) { Console.WriteLine(e.GetType().Name); }',
        'try { Console.WriteLine(DiscountedPrice(50m, 120)); } catch (Exception e) { Console.WriteLine(e.GetType().Name); }',
        'try { Console.WriteLine(DiscountedPrice(-5m, 10)); } catch (Exception e) { Console.WriteLine(e.GetType().Name); }'],
  exp=["170", "ArgumentOutOfRangeException", "ArgumentException"])

q(2, "Strings & StringBuilder", "write_code", "Medium", 5,
  """
  Write a C# method `static string RunLengthEncode(string s)` that compresses s by replacing each run of identical consecutive characters with the character followed by the run length. For example "aaabcc" becomes "a3b1c2". An empty string returns an empty string. Build the result with StringBuilder.
  """,
  """
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
  """,
  ["Counts consecutive runs correctly, including the final run",
   "Appends character then count for every run (including count 1)",
   "Uses StringBuilder instead of repeated string concatenation",
   "Returns an empty string for empty input without index errors"],
  [{"input": "s = \"aaabcc\"", "expected": "\"a3b1c2\""}, {"input": "s = \"zzzz\"", "expected": "\"z4\""}, {"input": "s = \"abca\"", "expected": "\"a1b1c1a1\""}, {"input": "s = \"\"", "expected": "\"\""}],
  main=['Console.WriteLine(RunLengthEncode("aaabcc"));', 'Console.WriteLine(RunLengthEncode("zzzz"));', 'Console.WriteLine(RunLengthEncode("abca"));', 'Console.WriteLine("[" + RunLengthEncode("") + "]");'],
  exp=["a3b1c2", "z4", "a1b1c1a1", "[]"])

q(2, "Dictionary<TKey,TValue>", "write_code", "Hard", 6,
  """
  Write a C# method `static List<List<string>> GroupAnagrams(List<string> words)` that groups words that are anagrams of each other (same letters in a different order). All words are lower case. Groups must appear in the order their first word appears in the input, and words inside a group keep their input order.
  """,
  """
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
  """,
  ["Builds a canonical key per word (sorted letters or a letter count)",
   "Uses a Dictionary from key to list of words",
   "Preserves the order of groups by first appearance and the order of words within a group",
   "Handles an empty input list (returns an empty list)"],
  [{"input": "words = [\"eat\", \"tea\", \"tan\", \"ate\", \"nat\", \"bat\"]", "expected": "[[eat, tea, ate], [tan, nat], [bat]]"},
   {"input": "words = [\"abc\"]", "expected": "[[abc]]"},
   {"input": "words = []", "expected": "[]"}],
  main=['Console.WriteLine(string.Join(" | ", GroupAnagrams(new List<string> { "eat", "tea", "tan", "ate", "nat", "bat" }).Select(g => string.Join(",", g))));',
        'Console.WriteLine(string.Join(" | ", GroupAnagrams(new List<string> { "abc" }).Select(g => string.Join(",", g))));',
        'Console.WriteLine(GroupAnagrams(new List<string>()).Count);'],
  exp=["eat,tea,ate | tan,nat | bat", "abc", "0"])

q(2, "Collections (Stack)", "write_code", "Hard", 6,
  """
  Write a C# method `static bool IsBalanced(string s)` that returns true if every bracket in s is correctly matched and nested. The bracket pairs are (), [] and {}. All other characters are ignored. Use a Stack<char>.
  """,
  """
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
  """,
  ["Pushes opening brackets and pops on closing brackets",
   "Returns false when a closing bracket arrives with an empty stack",
   "Checks that the popped bracket matches the closing type",
   "Returns false if unclosed brackets remain at the end",
   "Ignores non-bracket characters"],
  [{"input": "s = \"{[()]}\"", "expected": "true"}, {"input": "s = \"([)]\"", "expected": "false"}, {"input": "s = \"((\"", "expected": "false"}, {"input": "s = \"a(b)c]\"", "expected": "false"}],
  main=['Console.WriteLine(IsBalanced("{[()]}"));', 'Console.WriteLine(IsBalanced("([)]"));', 'Console.WriteLine(IsBalanced("(("));', 'Console.WriteLine(IsBalanced("a(b)c]"));'],
  exp=["True", "False", "False", "False"])

# ------------------------------------------------------------------ SET 3
q(3, "Conditionals", "write_code", "Easy", 3,
  """
  Write a C# method `static string GetGrade(int score)` that converts an exam score (0-100) into a letter grade: 90 and above "A", 80-89 "B", 70-79 "C", 60-69 "D", below 60 "F". Throw ArgumentOutOfRangeException if score is less than 0 or greater than 100.
  """,
  """
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
  """,
  ["Validates the range first and throws ArgumentOutOfRangeException",
   "Checks thresholds from highest to lowest so each score maps to one grade",
   "Boundary values (90, 80, 70, 60) map to the higher grade",
   "Returns \"F\" for scores below 60"],
  [{"input": "score = 95", "expected": "\"A\""}, {"input": "score = 80", "expected": "\"B\""}, {"input": "score = 59", "expected": "\"F\""}, {"input": "score = 101", "expected": "throws ArgumentOutOfRangeException"}],
  main=['Console.WriteLine(GetGrade(95));', 'Console.WriteLine(GetGrade(80));', 'Console.WriteLine(GetGrade(59));',
        'try { Console.WriteLine(GetGrade(101)); } catch (Exception e) { Console.WriteLine(e.GetType().Name); }'],
  exp=["A", "B", "F", "ArgumentOutOfRangeException"])

q(3, "String Interpolation", "explain_output", "Easy", 3,
  """
  What does the following C# program print? Explain the format specifier, alignment and brace syntax used in each interpolated string.
  """, None,
  ["States all five output lines exactly, including padding",
   "Explains :D4 pads an integer with leading zeros to 4 digits",
   "Explains the conditional expression must be wrapped in parentheses inside the braces",
   "Explains ,8 right-aligns and ,-8 left-aligns within 8 characters",
   "Explains {{ and }} produce literal braces"],
  [],
  starter="""
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
  """,
  out="""
  Order 0007: 3 x Laptop
  3 items
  [  Laptop]
  [Laptop  ]
  {6}
  """,
  explanation="""
  {id:D4} formats 7 as a 4-digit integer with leading zeros (0007). The ternary operator is placed in parentheses so the colon is not read as a format specifier; qty is 3 so "s" is appended. {item,8} right-aligns "Laptop" (6 chars) in a field of 8, adding two leading spaces; {item,-8} left-aligns it, adding two trailing spaces. In the last line {{ and }} are escaped literal braces and the inner {qty * 2} evaluates to 6, producing {6}.
  """)

q(3, "Loops", "write_code", "Easy", 3,
  """
  Write a C# method `static long Factorial(int n)` that returns n! using a loop (not recursion). 0! is 1. Throw ArgumentOutOfRangeException if n is negative or greater than 20 (21! does not fit in a long).
  """,
  """
  static long Factorial(int n)
  {
      if (n < 0 || n > 20)
          throw new ArgumentOutOfRangeException(nameof(n), "n must be between 0 and 20.");
      long result = 1;
      for (int i = 2; i <= n; i++)
          result *= i;
      return result;
  }
  """,
  ["Uses long for the accumulator",
   "Returns 1 for n = 0",
   "Iterative loop multiplies 1..n (or 2..n)",
   "Throws ArgumentOutOfRangeException for n < 0 or n > 20"],
  [{"input": "n = 0", "expected": "1"}, {"input": "n = 5", "expected": "120"}, {"input": "n = 20", "expected": "2432902008176640000"}, {"input": "n = -1", "expected": "throws ArgumentOutOfRangeException"}],
  main=['Console.WriteLine(Factorial(0));', 'Console.WriteLine(Factorial(5));', 'Console.WriteLine(Factorial(20));',
        'try { Console.WriteLine(Factorial(-1)); } catch (Exception e) { Console.WriteLine(e.GetType().Name); }'],
  exp=["1", "120", "2432902008176640000", "ArgumentOutOfRangeException"])

q(3, "Static Members", "write_code", "Medium", 4,
  """
  Write a C# class `Ticket` for a support desk. Each new Ticket must automatically receive a unique sequential integer `Id` starting at 1 (first ticket 1, second 2, ...). It has a read-only `Title` property set through the constructor `Ticket(string title)`. Also expose a static read-only property `Count` returning how many Ticket objects have been created so far.
  """,
  """
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
  """,
  ["Uses a static field to hold the next id, shared by all instances",
   "Assigns Id in the constructor and then increments the counter",
   "Id and Title are instance properties that cannot be changed from outside",
   "Count is static with a private setter (or computed from the static field)"],
  [{"input": "var t1 = new Ticket(\"Login issue\"); t1.Id", "expected": "1"},
   {"input": "then var t2 = new Ticket(\"Printer\"); var t3 = new Ticket(\"VPN\"); t3.Id", "expected": "3"},
   {"input": "Ticket.Count after creating three tickets", "expected": "3"}],
  main=['var t1 = new Ticket("Login issue"); Console.WriteLine(t1.Id);',
        'var t2 = new Ticket("Printer"); var t3 = new Ticket("VPN"); Console.WriteLine(t3.Id);',
        'Console.WriteLine(Ticket.Count);'],
  exp=["1", "3", "3"], wrap=False)

q(3, "Strings", "fix_bug", "Medium", 4,
  """
  The method below should reverse the order of the words in a sentence (words are separated by single spaces), e.g. "one two three" -> "three two one". It gives wrong results. Find the bug, explain it, and provide the corrected method.
  """,
  """
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
  """,
  ["Identifies the loop condition `i > 0` skips index 0 (the first word)",
   "Changes the condition to `i >= 0`",
   "Single-word input now returns the word instead of an empty string",
   "Optionally mentions StringBuilder or string.Join(\" \", words.Reverse()) as cleaner alternatives"],
  [{"input": "sentence = \"one two three\"", "expected": "\"three two one\""}, {"input": "sentence = \"hello\"", "expected": "\"hello\""}],
  starter="""
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
  """,
  main=['Console.WriteLine(ReverseWords("one two three"));', 'Console.WriteLine("[" + ReverseWords("hello") + "]");'],
  exp=["three two one", "[hello]"])

q(3, "Arrays & Nullable Types", "write_code", "Medium", 5,
  """
  Write a C# method `static int? SecondLargest(int[] nums)` that returns the second largest DISTINCT value in nums, or null if the array has fewer than two distinct values. Use a single pass through the array; do not sort.
  """,
  """
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
  """,
  ["Returns int? and uses null to signal no answer",
   "Tracks largest and second largest in one pass",
   "Ignores duplicates of the largest value (distinct requirement)",
   "Handles negative numbers (does not initialise with 0)",
   "Returns null for empty arrays or all-equal values"],
  [{"input": "nums = { 4, 1, 9, 7 }", "expected": "7"}, {"input": "nums = { 3, 8, 8 }", "expected": "3"}, {"input": "nums = { 5, 5, 5 }", "expected": "null"}, {"input": "nums = { }", "expected": "null"}],
  main=['Console.WriteLine(SecondLargest(new[] { 4, 1, 9, 7 })?.ToString() ?? "null");',
        'Console.WriteLine(SecondLargest(new[] { 3, 8, 8 })?.ToString() ?? "null");',
        'Console.WriteLine(SecondLargest(new[] { 5, 5, 5 })?.ToString() ?? "null");',
        'Console.WriteLine(SecondLargest(new int[0])?.ToString() ?? "null");'])

q(3, "Methods (ref parameters)", "write_code", "Medium", 4,
  """
  Write a C# method `static void NormalizeTime(ref int hours, ref int minutes)` that normalises a time value in place: minutes of 60 or more are carried into hours, so minutes ends up in 0-59, and hours wraps around a 24-hour clock (0-23). Both inputs are non-negative. For example hours = 1, minutes = 135 becomes hours = 3, minutes = 15.
  """,
  """
  static void NormalizeTime(ref int hours, ref int minutes)
  {
      hours += minutes / 60;
      minutes %= 60;
      hours %= 24;
  }
  """,
  ["Uses ref parameters so the caller's variables change",
   "Carries minutes / 60 into hours before reducing minutes with % 60",
   "Wraps hours with % 24",
   "Leaves already-normal values unchanged"],
  [{"input": "hours = 1, minutes = 135", "expected": "hours = 3, minutes = 15"},
   {"input": "hours = 23, minutes = 75", "expected": "hours = 0, minutes = 15"},
   {"input": "hours = 5, minutes = 30", "expected": "hours = 5, minutes = 30"}],
  main=['{ int h = 1, m = 135; NormalizeTime(ref h, ref m); Console.WriteLine(h + ":" + m); }',
        '{ int h = 23, m = 75; NormalizeTime(ref h, ref m); Console.WriteLine(h + ":" + m); }',
        '{ int h = 5, m = 30; NormalizeTime(ref h, ref m); Console.WriteLine(h + ":" + m); }'],
  exp=["3:15", "0:15", "5:30"])

q(3, "LINQ Basics", "write_code", "Medium", 4,
  """
  Given the class below, write a C# method `static Dictionary<string, int> HeadcountByDepartment(List<Employee> employees)` that uses LINQ GroupBy to return a dictionary mapping each department name to the number of employees in it. An empty list returns an empty dictionary.

  public class Employee { public string Name { get; set; } public string Department { get; set; } }
  """,
  """
  static Dictionary<string, int> HeadcountByDepartment(List<Employee> employees)
  {
      return employees
          .GroupBy(e => e.Department)
          .ToDictionary(g => g.Key, g => g.Count());
  }
  """,
  ["Groups by Department using GroupBy",
   "Uses the group Key as dictionary key and Count() as value",
   "Converts to a Dictionary with ToDictionary",
   "Works for an empty list"],
  [{"input": "employees = [Asha/Sales, Ben/IT, Chen/Sales, Dev/HR]", "expected": "{Sales: 2, IT: 1, HR: 1}"},
   {"input": "employees = []", "expected": "{} (empty)"}],
  support="public class Employee { public string Name { get; set; } public string Department { get; set; } }",
  main=['var emps = new List<Employee> { new Employee { Name = "Asha", Department = "Sales" }, new Employee { Name = "Ben", Department = "IT" }, new Employee { Name = "Chen", Department = "Sales" }, new Employee { Name = "Dev", Department = "HR" } };',
        'Console.WriteLine(string.Join(", ", HeadcountByDepartment(emps).OrderBy(p => p.Key).Select(p => p.Key + "=" + p.Value)));',
        'Console.WriteLine(HeadcountByDepartment(new List<Employee>()).Count);'],
  exp=[None, "HR=1, IT=1, Sales=2", "0"])

q(3, "Recursion", "write_code", "Hard", 6,
  """
  A staircase has n steps and you can climb either 1 or 2 steps at a time. Write a recursive C# method `static long CountWays(int n)` that returns the number of distinct ways to reach the top. Use memoisation (e.g. a Dictionary<int, long>) so that n up to 80 runs instantly. Treat n = 0 and n = 1 as 1 way.
  """,
  """
  static Dictionary<int, long> memo = new Dictionary<int, long>();

  static long CountWays(int n)
  {
      if (n <= 1) return 1;
      if (memo.TryGetValue(n, out long cached)) return cached;

      long ways = CountWays(n - 1) + CountWays(n - 2);
      memo[n] = ways;
      return ways;
  }
  """,
  ["Correct base cases for n = 0 and n = 1",
   "Recurrence ways(n) = ways(n-1) + ways(n-2)",
   "Stores and reuses computed results (memoisation) to avoid exponential time",
   "Uses long to avoid overflow for large n"],
  [{"input": "n = 2", "expected": "2"}, {"input": "n = 5", "expected": "8"}, {"input": "n = 50", "expected": "20365011074"}],
  main=['Console.WriteLine(CountWays(2));', 'Console.WriteLine(CountWays(5));', 'Console.WriteLine(CountWays(50));'])

q(3, "Arrays", "write_code", "Hard", 5,
  """
  Write a C# method `static int[] MergeSorted(int[] a, int[] b)` that merges two arrays already sorted in ascending order into a new sorted array containing all elements of both (duplicates kept). Do not call Array.Sort, LINQ or any other sorting method; use a single pass with two indexes.
  """,
  """
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
  """,
  ["Allocates a result array of length a.Length + b.Length",
   "Compares the current elements of both arrays and takes the smaller",
   "Copies the remaining elements of whichever array is not exhausted",
   "Handles empty arrays and duplicate values",
   "Does not use a sorting method"],
  [{"input": "a = { 1, 3, 5 }, b = { 2, 4, 6, 8 }", "expected": "{ 1, 2, 3, 4, 5, 6, 8 }"},
   {"input": "a = { }, b = { 1, 2 }", "expected": "{ 1, 2 }"},
   {"input": "a = { 1, 1 }, b = { 1 }", "expected": "{ 1, 1, 1 }"}],
  main=['Console.WriteLine(string.Join(",", MergeSorted(new[] { 1, 3, 5 }, new[] { 2, 4, 6, 8 })));',
        'Console.WriteLine(string.Join(",", MergeSorted(new int[0], new[] { 1, 2 })));',
        'Console.WriteLine(string.Join(",", MergeSorted(new[] { 1, 1 }, new[] { 1 })));'],
  exp=["1,2,3,4,5,6,8", "1,2", "1,1,1"])

# ------------------------------------------------------------------ SET 4
q(4, "Conditionals", "write_code", "Easy", 3,
  """
  Write a C# method `static bool IsLeapYear(int year)` that returns true if year is a leap year in the Gregorian calendar: divisible by 4, except years divisible by 100, unless they are also divisible by 400. Do not use DateTime.IsLeapYear.
  """,
  """
  static bool IsLeapYear(int year)
  {
      if (year % 400 == 0) return true;
      if (year % 100 == 0) return false;
      return year % 4 == 0;
  }
  """,
  ["Applies the divisible-by-400 rule",
   "Applies the divisible-by-100 exception",
   "Applies the divisible-by-4 rule",
   "Rules are ordered/combined so 1900 is false and 2000 is true"],
  [{"input": "year = 2024", "expected": "true"}, {"input": "year = 1900", "expected": "false"}, {"input": "year = 2000", "expected": "true"}, {"input": "year = 2023", "expected": "false"}],
  main=['Console.WriteLine(IsLeapYear(2024));', 'Console.WriteLine(IsLeapYear(1900));', 'Console.WriteLine(IsLeapYear(2000));', 'Console.WriteLine(IsLeapYear(2023));'],
  exp=["True", "False", "True", "False"])

q(4, "Loops", "explain_output", "Easy", 3,
  """
  What does the following C# program print? Explain how continue and break affect the nested loops and how the while loop ends.
  """, None,
  ["States the output: first line `11 13 21 23 ` and second line `12`",
   "Explains continue skips j == 2 but the inner loop keeps going",
   "Explains break (when i == 3) exits only the inner loop",
   "Explains i * 10 + j is added as numbers before being concatenated with \" \"",
   "Explains k becomes 4, 8, 12 and the loop stops once k >= 10"],
  [],
  starter="""
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
  """,
  out="""
  11 13 21 23
  12
  """,
  explanation="""
  For i = 1 and i = 2 the inner loop prints j = 1 and j = 3; j = 2 is skipped by continue, which moves to the next iteration of the inner loop only. The expression i * 10 + j is evaluated numerically first (left to right) and then the space is appended, so values such as 11 and 13 are printed. When i = 3, j = 1 reaches break, which exits only the inner loop; the outer loop then ends because i becomes 4. The while loop adds 4 each time (4, 8, 12) and stops when k is no longer less than 10, so it prints 12.
  """)

q(4, "List<T>", "write_code", "Easy", 3,
  """
  Write a C# method `static int CountOccurrences(List<string> items, string target)` that returns how many elements of items equal target, ignoring case. Null elements in the list must be skipped without throwing. Use a loop (no LINQ).
  """,
  """
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
  """,
  ["Loops over the list and counts matches",
   "Comparison ignores case (StringComparison.OrdinalIgnoreCase or equivalent)",
   "Does not throw on null elements (avoids item.ToLower() on null)",
   "Returns 0 for an empty list"],
  [{"input": "items = [\"Apple\", \"apple\", \"Pear\", \"APPLE\"], target = \"apple\"", "expected": "3"},
   {"input": "items = [\"a\", null, \"A\"], target = \"a\"", "expected": "2"},
   {"input": "items = [], target = \"x\"", "expected": "0"}],
  main=['Console.WriteLine(CountOccurrences(new List<string> { "Apple", "apple", "Pear", "APPLE" }, "apple"));',
        'Console.WriteLine(CountOccurrences(new List<string> { "a", null, "A" }, "a"));',
        'Console.WriteLine(CountOccurrences(new List<string>(), "x"));'])

q(4, "Dictionary<TKey,TValue>", "fix_bug", "Medium", 4,
  """
  The method below should count how many times each letter appears in text (non-letters are ignored, case-sensitive), but it throws an exception at runtime. Identify the exception, explain why it occurs, and provide the corrected method.
  """,
  """
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
  """,
  ["Identifies KeyNotFoundException",
   "Explains that counts[c]++ reads the key before writing it, and the key does not exist the first time",
   "Fixes with TryGetValue, ContainsKey check, or initialising the key to 0",
   "The corrected method returns correct counts"],
  [{"input": "text = \"banana\"", "expected": "{b: 1, a: 3, n: 2}"}, {"input": "text = \"a1a\"", "expected": "{a: 2}"}],
  starter="""
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
  """,
  main=['try { Console.WriteLine(string.Join(", ", CountLetters("banana").OrderBy(p => p.Key).Select(p => p.Key + "=" + p.Value))); } catch (Exception e) { Console.WriteLine(e.GetType().Name); }',
        'try { Console.WriteLine(string.Join(", ", CountLetters("a1a").OrderBy(p => p.Key).Select(p => p.Key + "=" + p.Value))); } catch (Exception e) { Console.WriteLine(e.GetType().Name); }'],
  exp=["a=3, b=1, n=2", "a=2"])

q(4, "Abstract Classes & Inheritance", "write_code", "Medium", 5,
  """
  Write an abstract C# class `Employee` with a read-only `Name` property set by a protected constructor and an abstract method `decimal MonthlyPay()`. Then write two subclasses:
  - `SalariedEmployee(string name, decimal annualSalary)` whose monthly pay is annualSalary / 12;
  - `HourlyEmployee(string name, decimal hourlyRate, int hoursWorked)` whose monthly pay is hourlyRate * hoursWorked.
  """,
  """
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
  """,
  ["Employee is abstract with an abstract MonthlyPay method",
   "Subclasses call the base constructor with : base(name)",
   "Subclasses use override and implement the correct formulas",
   "Uses decimal for money values",
   "Objects can be used polymorphically through an Employee reference"],
  [{"input": "Employee e = new SalariedEmployee(\"Mia\", 60000); e.MonthlyPay()", "expected": "5000"},
   {"input": "Employee e = new HourlyEmployee(\"Leo\", 25, 160); e.MonthlyPay()", "expected": "4000"},
   {"input": "sum of MonthlyPay() for both in a List<Employee>", "expected": "9000"}],
  main=['Employee e1 = new SalariedEmployee("Mia", 60000m); Console.WriteLine(e1.MonthlyPay());',
        'Employee e2 = new HourlyEmployee("Leo", 25m, 160); Console.WriteLine(e2.MonthlyPay());',
        'decimal total = 0; foreach (Employee e in new List<Employee> { e1, e2 }) total += e.MonthlyPay(); Console.WriteLine(total);'],
  wrap=False)

q(4, "Strings & StringBuilder", "write_code", "Medium", 4,
  """
  Write a C# method `static string CapitalizeWords(string s)` that returns s with the first letter of every word in upper case and all other letters in lower case. Words are separated by spaces; keep all spaces exactly as they are (including multiple or leading spaces). Use StringBuilder.
  """,
  """
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
  """,
  ["Upper-cases the first character after a space or at the start",
   "Lower-cases the remaining characters of each word",
   "Preserves the original spacing (does not Split and Join with single spaces)",
   "Uses StringBuilder and handles an empty string"],
  [{"input": "s = \"hello wORLD\"", "expected": "\"Hello World\""},
   {"input": "s = \"  multiple   spaces\"", "expected": "\"  Multiple   Spaces\""},
   {"input": "s = \"\"", "expected": "\"\""}],
  main=['Console.WriteLine("[" + CapitalizeWords("hello wORLD") + "]");',
        'Console.WriteLine("[" + CapitalizeWords("  multiple   spaces") + "]");',
        'Console.WriteLine("[" + CapitalizeWords("") + "]");'],
  exp=["[Hello World]", "[  Multiple   Spaces]", "[]"])

q(4, "Exceptions", "explain_output", "Medium", 4,
  """
  What does the following C# program print? Explain the order in which the try, catch and finally blocks run, including when a return statement is inside try or catch.
  """, None,
  ["States the exact output (seven lines, in order)",
   "Explains finally always runs, even after return",
   "Explains the return value is computed before finally runs but is printed by Main afterwards",
   "Explains integer division by zero throws DivideByZeroException which is caught and returns -1"],
  [],
  starter="""
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
  """,
  out="""
  Start
  Finally
  5
  Start
  Cannot divide by zero
  Finally
  -1
  """,
  explanation="""
  In the first call, try prints "Start" and evaluates a / b = 5 for the return; before control leaves the method, finally prints "Finally"; then Main prints the returned 5. In the second call, 1 / 0 with integers throws DivideByZeroException, so the catch block prints its message and prepares to return -1; finally again runs before the method returns, and then Main prints -1.
  """)

q(4, "Loops & StringBuilder", "write_code", "Medium", 4,
  """
  Write a C# method `static string FizzBuzzLine(int n)` that returns the numbers from 1 to n separated by single spaces, where multiples of 3 are replaced by "Fizz", multiples of 5 by "Buzz", and multiples of both by "FizzBuzz". There must be no leading or trailing space. Use StringBuilder. Assume n >= 1.
  """,
  """
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
  """,
  ["Checks the multiple-of-15 case before 3 and 5",
   "Loops from 1 to n inclusive",
   "Separates items with single spaces and no trailing space",
   "Uses StringBuilder rather than repeated string concatenation"],
  [{"input": "n = 5", "expected": "\"1 2 Fizz 4 Buzz\""},
   {"input": "n = 15", "expected": "\"1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz\""},
   {"input": "n = 1", "expected": "\"1\""}],
  main=['Console.WriteLine("[" + FizzBuzzLine(5) + "]");', 'Console.WriteLine("[" + FizzBuzzLine(15) + "]");', 'Console.WriteLine("[" + FizzBuzzLine(1) + "]");'],
  exp=["[1 2 Fizz 4 Buzz]", "[1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz]", "[1]"])

q(4, "LINQ Basics", "write_code", "Hard", 6,
  """
  Given the class below, write a C# method `static List<string> TopCustomers(List<Order> orders, int n)` that uses LINQ to return the names of the n customers with the highest total order Amount. Sort by total descending; when totals are equal, sort by customer name ascending. If there are fewer than n customers, return all of them.

  public class Order { public string Customer { get; set; } public decimal Amount { get; set; } }
  """,
  """
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
  """,
  ["Groups orders by customer and sums Amount per group",
   "Orders by total descending then by name ascending (OrderByDescending + ThenBy)",
   "Uses Take(n) so fewer than n customers is handled naturally",
   "Returns only customer names as a List<string>"],
  [{"input": "orders = [Ana 50, Raj 30, Ana 40, Kim 60, Raj 30], n = 2", "expected": "[Ana, Kim]  (totals Ana 90, Kim 60, Raj 60)"},
   {"input": "same orders, n = 5", "expected": "[Ana, Kim, Raj]"},
   {"input": "orders = [], n = 3", "expected": "[]"}],
  support="public class Order { public string Customer { get; set; } public decimal Amount { get; set; } }",
  main=['var os = new List<Order> { new Order { Customer = "Ana", Amount = 50m }, new Order { Customer = "Raj", Amount = 30m }, new Order { Customer = "Ana", Amount = 40m }, new Order { Customer = "Kim", Amount = 60m }, new Order { Customer = "Raj", Amount = 30m } };',
        'Console.WriteLine(string.Join(", ", TopCustomers(os, 2)));',
        'Console.WriteLine(string.Join(", ", TopCustomers(os, 5)));',
        'Console.WriteLine(TopCustomers(new List<Order>(), 3).Count);'],
  exp=[None, "Ana, Kim", "Ana, Kim, Raj", "0"])

q(4, "Classes & Collections", "write_code", "Hard", 6,
  """
  Write a C# class `Inventory` that tracks stock quantities by item name using a private Dictionary<string, int>. It must provide:
  - `void Add(string item, int quantity)`: increases the stock; throws ArgumentException if quantity <= 0;
  - `void Remove(string item, int quantity)`: decreases the stock; throws ArgumentException if quantity <= 0 and InvalidOperationException if there is not enough stock; when stock reaches 0 the item is removed from the dictionary;
  - `int GetQuantity(string item)`: returns the current stock, or 0 for unknown items;
  - a read-only property `int DistinctItems` returning how many different items are in stock.
  """,
  """
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
  """,
  ["Dictionary field is private (encapsulation)",
   "Add creates or increases an entry without KeyNotFoundException",
   "Remove validates quantity and stock before changing anything, and removes the key at zero",
   "Throws the specified exception types",
   "GetQuantity returns 0 for unknown items; DistinctItems reflects the dictionary count"],
  [{"input": "Add(\"pen\", 10); Add(\"pen\", 5); Remove(\"pen\", 3); GetQuantity(\"pen\")", "expected": "12"},
   {"input": "Remove(\"ink\", 1)", "expected": "throws InvalidOperationException"},
   {"input": "Add(\"cap\", 2); Remove(\"cap\", 2); GetQuantity(\"cap\"), DistinctItems", "expected": "0, 1 (only pen remains)"},
   {"input": "Add(\"pen\", 0)", "expected": "throws ArgumentException"}],
  main=['var inv = new Inventory(); inv.Add("pen", 10); inv.Add("pen", 5); inv.Remove("pen", 3); Console.WriteLine(inv.GetQuantity("pen"));',
        'try { inv.Remove("ink", 1); Console.WriteLine("no exception"); } catch (Exception e) { Console.WriteLine(e.GetType().Name); }',
        'inv.Add("cap", 2); inv.Remove("cap", 2); Console.WriteLine(inv.GetQuantity("cap") + ", " + inv.DistinctItems);',
        'try { inv.Add("pen", 0); Console.WriteLine("no exception"); } catch (Exception e) { Console.WriteLine(e.GetType().Name); }'],
  exp=["12", "InvalidOperationException", "0, 1", "ArgumentException"], wrap=False)

# ------------------------------------------------------------------ SET 5
q(5, "Strings", "write_code", "Easy", 3,
  """
  Write a C# method `static string Initials(string fullName)` that returns the upper-case initials of each word followed by a dot, e.g. "john ronald tolkien" -> "J.R.T.". Ignore extra spaces anywhere in the input. An empty or all-space string returns "".
  """,
  """
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
  """,
  ["Splits into words and removes empty entries",
   "Takes the first character of each word and upper-cases it",
   "Appends a dot after each initial",
   "Returns an empty string for empty or whitespace-only input"],
  [{"input": "fullName = \"john ronald tolkien\"", "expected": "\"J.R.T.\""},
   {"input": "fullName = \"  ada   lovelace \"", "expected": "\"A.L.\""},
   {"input": "fullName = \"\"", "expected": "\"\""}],
  main=['Console.WriteLine("[" + Initials("john ronald tolkien") + "]");', 'Console.WriteLine("[" + Initials("  ada   lovelace ") + "]");', 'Console.WriteLine("[" + Initials("") + "]");'],
  exp=["[J.R.T.]", "[A.L.]", "[]"])

q(5, "Arrays", "write_code", "Easy", 3,
  """
  Write a C# method `static int[] RunningTotal(int[] values)` that returns a new array where element i is the sum of values[0] through values[i]. The input array must not be modified. An empty input returns an empty array.
  """,
  """
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
  """,
  ["Creates a new array of the same length",
   "Keeps a running sum and stores it at each index",
   "Does not modify the input array",
   "Handles empty arrays and negative numbers"],
  [{"input": "values = { 1, 2, 3, 4 }", "expected": "{ 1, 3, 6, 10 }"}, {"input": "values = { 5, -2 }", "expected": "{ 5, 3 }"}, {"input": "values = { }", "expected": "{ }"}],
  main=['Console.WriteLine(string.Join(",", RunningTotal(new[] { 1, 2, 3, 4 })));', 'Console.WriteLine(string.Join(",", RunningTotal(new[] { 5, -2 })));', 'Console.WriteLine(RunningTotal(new int[0]).Length);'],
  exp=["1,3,6,10", "5,3", "0"])

q(5, "Methods & Parameter Passing", "explain_output", "Easy", 3,
  """
  What does the following C# program print? Explain what happens to each of the three arguments inside Update.
  """, None,
  ["States the exact output: 1, then 100,2,3, then 1",
   "Explains int is passed by value, so changing number does not affect n",
   "Explains the array reference is copied, so values[0] = 100 changes the caller's array",
   "Explains that assigning a new array to values only changes the local copy of the reference",
   "Explains ref lets counter++ change c"],
  [],
  starter="""
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
  """,
  out="""
  1
  100,2,3
  1
  """,
  explanation="""
  number is an int passed by value, so the method works on a copy and n stays 1. values receives a copy of the reference to the same array object, so values[0] = 100 modifies the caller's arr; the later `values = new int[] {7,7,7}` only points the local parameter at a new array and does not affect arr, which prints 100,2,3. counter is passed with ref, so counter++ updates the caller's variable c to 1.
  """)

q(5, "Null Handling", "write_code", "Medium", 4,
  """
  Given the class below, write a C# method `static string DisplayName(Customer c)` that returns the text to show for a customer: the Nickname if it is not null/empty/whitespace, otherwise the FullName if it is not null/empty/whitespace, otherwise "Guest". If c itself is null, return "Guest". Trim the returned name. Use the null-conditional (?.) and null-coalescing (??) operators where appropriate.

  public class Customer { public string FullName { get; set; } public string Nickname { get; set; } }
  """,
  """
  static string DisplayName(Customer c)
  {
      string nick = string.IsNullOrWhiteSpace(c?.Nickname) ? null : c.Nickname.Trim();
      string full = string.IsNullOrWhiteSpace(c?.FullName) ? null : c.FullName.Trim();
      return nick ?? full ?? "Guest";
  }
  """,
  ["Does not throw when c is null (uses ?. or an explicit null check)",
   "Treats empty and whitespace-only strings like null (string.IsNullOrWhiteSpace)",
   "Applies the priority Nickname -> FullName -> \"Guest\" (e.g. with chained ??)",
   "Trims the returned value"],
  [{"input": "c = { FullName = \"Priya Shah\", Nickname = \"Pri\" }", "expected": "\"Pri\""},
   {"input": "c = { FullName = \"Tom Lee\", Nickname = \"  \" }", "expected": "\"Tom Lee\""},
   {"input": "c = null", "expected": "\"Guest\""},
   {"input": "c = { FullName = null, Nickname = null }", "expected": "\"Guest\""}],
  support="public class Customer { public string FullName { get; set; } public string Nickname { get; set; } }",
  main=['Console.WriteLine(DisplayName(new Customer { FullName = "Priya Shah", Nickname = "Pri" }));',
        'Console.WriteLine(DisplayName(new Customer { FullName = "Tom Lee", Nickname = "  " }));',
        'Console.WriteLine(DisplayName(null));',
        'Console.WriteLine(DisplayName(new Customer()));'],
  exp=["Pri", "Tom Lee", "Guest", "Guest"])

q(5, "Sorting/Searching", "fix_bug", "Medium", 5,
  """
  The iterative binary search below should return the index of target in an array sorted in ascending order, or -1 if target is not present. For some inputs it returns -1 even though the value exists (for example searching for 9 in { 1, 3, 5, 7, 9 }). Find the bug, explain it, and provide the corrected method.
  """,
  """
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
  """,
  ["Identifies that `low < high` stops before checking the element when low == high",
   "Changes the loop condition to `low <= high`",
   "Keeps low = mid + 1 / high = mid - 1 updates (no infinite loop)",
   "Optionally notes low + (high - low) / 2 avoids overflow",
   "Single-element arrays now work"],
  [{"input": "sorted = { 1, 3, 5, 7, 9 }, target = 9", "expected": "4"},
   {"input": "sorted = { 1, 3, 5, 7, 9 }, target = 3", "expected": "1"},
   {"input": "sorted = { 2 }, target = 2", "expected": "0"},
   {"input": "sorted = { 1, 3, 5 }, target = 4", "expected": "-1"}],
  starter="""
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
  """,
  main=['Console.WriteLine(BinarySearch(new[] { 1, 3, 5, 7, 9 }, 9));', 'Console.WriteLine(BinarySearch(new[] { 1, 3, 5, 7, 9 }, 3));',
        'Console.WriteLine(BinarySearch(new[] { 2 }, 2));', 'Console.WriteLine(BinarySearch(new[] { 1, 3, 5 }, 4));'])

q(5, "Interfaces", "write_code", "Medium", 5,
  """
  Define a C# interface `IDiscount` with one method `decimal Apply(decimal amount)`. Implement it in two classes:
  - `PercentageDiscount(decimal percent)`: reduces the amount by percent percent;
  - `FlatDiscount(decimal value)`: subtracts a fixed value, but never returns less than 0.
  Then write `public static decimal ApplyAll(decimal amount, List<IDiscount> discounts)` in a static class `Checkout` that applies each discount in list order and returns the final amount.
  """,
  """
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
  """,
  ["Declares the interface method without a body and implements it publicly in both classes",
   "PercentageDiscount and FlatDiscount compute correctly; FlatDiscount clamps at 0",
   "ApplyAll depends only on IDiscount (polymorphism) and applies discounts in order",
   "Uses decimal for money"],
  [{"input": "new PercentageDiscount(10).Apply(200)", "expected": "180"},
   {"input": "new FlatDiscount(50).Apply(30)", "expected": "0"},
   {"input": "Checkout.ApplyAll(100, [PercentageDiscount(20), FlatDiscount(15)])", "expected": "65"}],
  main=['Console.WriteLine(new PercentageDiscount(10m).Apply(200m));', 'Console.WriteLine(new FlatDiscount(50m).Apply(30m));',
        'Console.WriteLine(Checkout.ApplyAll(100m, new List<IDiscount> { new PercentageDiscount(20m), new FlatDiscount(15m) }));'],
  wrap=False)

q(5, "Dictionary<TKey,TValue>", "write_code", "Medium", 4,
  """
  Write a C# method `static char? FirstUniqueChar(string s)` that returns the first character in s that occurs exactly once, or null if every character repeats (or s is empty). The comparison is case-sensitive. Use a Dictionary<char, int> to count characters, then scan the string a second time.
  """,
  """
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
  """,
  ["First pass counts every character in a Dictionary",
   "Second pass iterates over the string (not the dictionary) to respect original order",
   "Returns char? and null when no unique character exists",
   "Case-sensitive ('L' and 'l' are different)"],
  [{"input": "s = \"swiss\"", "expected": "'w'"}, {"input": "s = \"aabb\"", "expected": "null"}, {"input": "s = \"Level\"", "expected": "'L'"}, {"input": "s = \"\"", "expected": "null"}],
  main=['Console.WriteLine(FirstUniqueChar("swiss")?.ToString() ?? "null");', 'Console.WriteLine(FirstUniqueChar("aabb")?.ToString() ?? "null");',
        'Console.WriteLine(FirstUniqueChar("Level")?.ToString() ?? "null");', 'Console.WriteLine(FirstUniqueChar("")?.ToString() ?? "null");'],
  exp=["w", "null", "L", "null"])

q(5, "LINQ Basics", "complete_code", "Medium", 4,
  """
  Complete the C# method below by filling in the three lambda expressions marked 1, 2 and 3. The method must return the squares of all odd numbers in the list, sorted from largest to smallest. Negative odd numbers count as odd.
  """,
  """
  static List<int> OddSquaresDescending(List<int> numbers)
  {
      return numbers
          .Where(n => n % 2 != 0)
          .Select(n => n * n)
          .OrderByDescending(sq => sq)
          .ToList();
  }
  """,
  ["Filter uses n % 2 != 0 (n % 2 == 1 fails for negative odd numbers)",
   "Select squares each value",
   "OrderByDescending uses the squared value as the key",
   "Returns an empty list when there are no odd numbers"],
  [{"input": "numbers = [1, 2, 3, 4, 5]", "expected": "[25, 9, 1]"}, {"input": "numbers = [-3, 2, 7]", "expected": "[49, 9]"}, {"input": "numbers = [2, 4]", "expected": "[]"}],
  starter="""
  static List<int> OddSquaresDescending(List<int> numbers)
  {
      return numbers
          .Where(/* 1: keep only odd numbers */)
          .Select(/* 2: square each number */)
          .OrderByDescending(/* 3: sort key */)
          .ToList();
  }
  """,
  main=['Console.WriteLine(string.Join(",", OddSquaresDescending(new List<int> { 1, 2, 3, 4, 5 })));', 'Console.WriteLine(string.Join(",", OddSquaresDescending(new List<int> { -3, 2, 7 })));',
        'Console.WriteLine(OddSquaresDescending(new List<int> { 2, 4 }).Count);'],
  exp=["25,9,1", "49,9", "0"])

q(5, "Recursion", "write_code", "Hard", 6,
  """
  Write a recursive C# method `static List<string> NoConsecutiveOnes(int n)` that returns all binary strings of length n (1 <= n <= 15) that do not contain two adjacent '1' characters, in ascending lexicographic order. For n = 3 the result is ["000", "001", "010", "100", "101"].
  """,
  """
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
  """,
  ["Base case adds the string when it reaches length n",
   "Always tries appending '0'",
   "Appends '1' only if the previous character is not '1' (prunes invalid strings instead of filtering afterwards)",
   "Trying '0' before '1' yields lexicographic order without sorting"],
  [{"input": "n = 1", "expected": "[\"0\", \"1\"]"}, {"input": "n = 2", "expected": "[\"00\", \"01\", \"10\"]"}, {"input": "n = 3", "expected": "[\"000\", \"001\", \"010\", \"100\", \"101\"]"}],
  main=['Console.WriteLine(string.Join(",", NoConsecutiveOnes(1)));', 'Console.WriteLine(string.Join(",", NoConsecutiveOnes(2)));', 'Console.WriteLine(string.Join(",", NoConsecutiveOnes(3)));'],
  exp=["0,1", "00,01,10", "000,001,010,100,101"])

q(5, "Arrays (2D)", "write_code", "Hard", 6,
  """
  Write a C# method `static int[,] RotateClockwise(int[,] matrix)` that takes an n x n matrix and returns a NEW n x n matrix rotated 90 degrees clockwise. The input must not be modified. For example [[1,2],[3,4]] becomes [[3,1],[4,2]].
  """,
  """
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
  """,
  ["Uses GetLength(0) to get the size of a rectangular int[,] array",
   "Maps element [row, col] to [col, n - 1 - row]",
   "Writes into a new array and leaves the input unchanged",
   "Works for 1 x 1 and larger matrices"],
  [{"input": "matrix = [[1, 2], [3, 4]]", "expected": "[[3, 1], [4, 2]]"},
   {"input": "matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]", "expected": "[[7, 4, 1], [8, 5, 2], [9, 6, 3]]"},
   {"input": "matrix = [[5]]", "expected": "[[5]]"}],
  support="""
  static class MatrixText
  {
      public static string Show(int[,] m)
      {
          var rows = new List<string>();
          for (int r = 0; r < m.GetLength(0); r++)
          {
              var cells = new List<string>();
              for (int c = 0; c < m.GetLength(1); c++) cells.Add(m[r, c].ToString());
              rows.Add(string.Join(",", cells));
          }
          return string.Join(";", rows);
      }
  }
  """,
  main=['Console.WriteLine(MatrixText.Show(RotateClockwise(new int[,] { { 1, 2 }, { 3, 4 } })));',
        'var m3 = new int[,] { { 1, 2, 3 }, { 4, 5, 6 }, { 7, 8, 9 } }; Console.WriteLine(MatrixText.Show(RotateClockwise(m3)));',
        'Console.WriteLine(MatrixText.Show(m3));',
        'Console.WriteLine(MatrixText.Show(RotateClockwise(new int[,] { { 5 } })));'],
  exp=["3,1;4,2", "7,4,1;8,5,2;9,6,3", "1,2,3;4,5,6;7,8,9", "5"])

# ------------------------------------------------------------------ assemble
sets = {}
counters = {}
for s, item in Q:
    counters[s] = counters.get(s, 0) + 1
    item = dict(item)
    code = f"PRG-CSHARP-S{s}-{counters[s]:02d}"
    sets.setdefault(s, []).append((code, item))

out = {"language": "csharp", "label": "C#", "sets": []}
harness = []
for s in sorted(sets):
    qs = []
    for code, item in sets[s]:
        public = {"code": code}
        public.update({k: v for k, v in item.items() if not k.startswith("_")})
        qs.append(public)
        harness.append({"code": code, **item})
    out["sets"].append({"set_number": s, "questions": qs})

import sys
with open(sys.argv[1], "w") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
    f.write("\n")
with open(sys.argv[2], "w") as f:
    json.dump(harness, f, indent=2)
print("written", sum(len(v) for v in sets.values()))
