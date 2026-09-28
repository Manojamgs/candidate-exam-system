
# Source of truth for Java programming questions + verification metadata.
# Each entry: dict with JSON fields plus harness keys:
#   kind: "method" (solution inside class Main) | "toplevel" (solution outside Main)
#   extra: top-level Java code needed (given classes)
#   setup: statements run once before checks (shared state)
#   checks: list of (input_desc, pre_statements, java_expr, expected_string)
#   show: number of checks exported as test_cases (default 4)
#   output: expected stdout for explain_output

def C(inp, expr, exp, pre=""):
    return (inp, pre, expr, exp)

SETS = {}

# ---------------------------------------------------------------- SET 1
SETS[1] = [
dict(topic="Variables & Types", task_type="write_code", difficulty="Easy", expected_minutes=3,
 question="Write a method `public static double averageOfThree(int a, int b, int c)` that returns the exact average of the three integers as a double. For example averageOfThree(1, 2, 2) must return 1.6666666666666667, not 1.0. Make sure integer division does not truncate the result.",
 reference_solution="""public static double averageOfThree(int a, int b, int c) {
    return (a + b + c) / 3.0;
}""",
 evaluation_points=["Return type is double", "Avoids integer division (divides by 3.0 or casts before dividing)", "Correct for negative values", "Simple one-expression solution; no unnecessary rounding"],
 kind="method",
 checks=[C("averageOfThree(1, 2, 2)", "averageOfThree(1, 2, 2)", "1.6666666666666667"),
         C("averageOfThree(2, 4, 6)", "averageOfThree(2, 4, 6)", "4.0"),
         C("averageOfThree(-1, 0, 0)", "averageOfThree(-1, 0, 0)", "-0.3333333333333333")]),

dict(topic="Variables & Types", task_type="explain_output", difficulty="Easy", expected_minutes=3,
 question="The program below mixes int arithmetic, the modulo operator and casting to double. Write down exactly what it prints, line by line, and explain why the second and fourth lines differ.",
 starter_code="""public class Main {
    public static void main(String[] args) {
        int a = 7;
        int b = 2;
        System.out.println(a / b);
        System.out.println((double) a / b);
        System.out.println(a % b);
        System.out.println((double) (a / b));
    }
}""",
 output="3\n3.5\n1\n3.0\n",
 explanation="a / b is integer division (7 / 2 = 3). In (double) a / b the cast applies to a first, so the division is done in floating point: 3.5. a % b is the remainder, 1. In (double) (a / b) the integer division happens first (3) and only the result is converted, giving 3.0.",
 evaluation_points=["Gives all four lines exactly: 3, 3.5, 1, 3.0", "Explains integer division truncation", "Explains that the cast binds before division in line 2 but after it in line 4", "Explains % as remainder"]),

dict(topic="Loops", task_type="write_code", difficulty="Easy", expected_minutes=3,
 question="Write a method `public static int sumOfDigits(int n)` that returns the sum of the decimal digits of a non-negative integer n using a loop (do not convert the number to a String). Example: sumOfDigits(1234) returns 10.",
 reference_solution="""public static int sumOfDigits(int n) {
    int sum = 0;
    while (n > 0) {
        sum += n % 10;
        n /= 10;
    }
    return sum;
}""",
 evaluation_points=["Uses % 10 to extract the last digit and / 10 to drop it", "Loop terminates correctly", "Returns 0 for n = 0", "Handles zeros inside the number (e.g. 9005)"],
 kind="method",
 checks=[C("sumOfDigits(1234)", "sumOfDigits(1234)", "10"),
         C("sumOfDigits(0)", "sumOfDigits(0)", "0"),
         C("sumOfDigits(9005)", "sumOfDigits(9005)", "14"),
         C("sumOfDigits(7)", "sumOfDigits(7)", "7")]),

dict(topic="Strings", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Write a method `public static boolean isPalindrome(String s)` that returns true if s reads the same forwards and backwards when you ignore letter case and ignore every character that is not a letter or digit. An empty string counts as a palindrome. Example: \"A man, a plan, a canal: Panama\" returns true.",
 reference_solution="""public static boolean isPalindrome(String s) {
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
}""",
 evaluation_points=["Ignores non letter/digit characters", "Case-insensitive comparison", "Empty string returns true", "Correct loop bounds (no index out of range)", "Two-pointer or cleaned-string-reverse approach both acceptable"],
 kind="method",
 checks=[C("\"A man, a plan, a canal: Panama\"", "isPalindrome(\"A man, a plan, a canal: Panama\")", "true"),
         C("\"hello\"", "isPalindrome(\"hello\")", "false"),
         C("\"\"", "isPalindrome(\"\")", "true"),
         C("\"No lemon, no melon\"", "isPalindrome(\"No lemon, no melon\")", "true"),
         C("\"ab2a\"", "isPalindrome(\"ab2a\")", "false")]),

dict(topic="Maps/Dictionaries", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Write a method `public static char firstNonRepeating(String s)` that returns the first character in s that appears exactly once. If every character repeats (or s is empty), return '_'. Use a HashMap (or LinkedHashMap) to count characters. Example: firstNonRepeating(\"swiss\") returns 'w'.",
 reference_solution="""public static char firstNonRepeating(String s) {
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
}""",
 evaluation_points=["Counts occurrences with a map", "Second pass over the string (or insertion-ordered map) to respect original order", "Returns '_' when no unique character exists", "O(n) time rather than nested loops"],
 kind="method",
 checks=[C("\"swiss\"", "firstNonRepeating(\"swiss\")", "w"),
         C("\"aabb\"", "firstNonRepeating(\"aabb\")", "_"),
         C("\"leetcode\"", "firstNonRepeating(\"leetcode\")", "l"),
         C("\"\"", "firstNonRepeating(\"\")", "_")]),

dict(topic="Arrays", task_type="fix_bug", difficulty="Medium", expected_minutes=4,
 question="The method below should return the largest value in a non-empty int array, but it returns the wrong answer for some inputs (for example when every value is negative). Identify the bug, explain why it happens, and write the corrected method.",
 starter_code="""public static int findMax(int[] nums) {
    int max = 0;
    for (int i = 0; i < nums.length; i++) {
        if (nums[i] > max) {
            max = nums[i];
        }
    }
    return max;
}""",
 reference_solution="""public static int findMax(int[] nums) {
    int max = nums[0];
    for (int i = 1; i < nums.length; i++) {
        if (nums[i] > max) {
            max = nums[i];
        }
    }
    return max;
}""",
 evaluation_points=["Identifies that initialising max to 0 is wrong when all values are negative", "Initialises max to nums[0] (or Integer.MIN_VALUE)", "Loop still covers every element", "Explanation is clear"],
 kind="method",
 checks=[C("[3, 9, 2]", "findMax(new int[]{3, 9, 2})", "9"),
         C("[-5, -2, -8]", "findMax(new int[]{-5, -2, -8})", "-2"),
         C("[7]", "findMax(new int[]{7})", "7")]),

dict(topic="OOP Basics", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Write a class `BankAccount` with a private String owner and a private double balance. Provide: a constructor `BankAccount(String owner, double initialBalance)`; `boolean deposit(double amount)` that adds the amount and returns true, or returns false (no change) if amount <= 0; `boolean withdraw(double amount)` that subtracts the amount and returns true, or returns false (no change) if amount <= 0 or amount is greater than the balance; and `double getBalance()`.",
 reference_solution="""class BankAccount {
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
}""",
 evaluation_points=["Fields are private (encapsulation)", "Constructor initialises both fields using this.", "deposit rejects non-positive amounts", "withdraw rejects non-positive amounts and overdrafts without changing the balance", "getBalance returns the current balance"],
 kind="toplevel",
 setup='BankAccount acc = new BankAccount("Asha", 100.0);',
 checks=[C("new BankAccount(\"Asha\", 100.0); deposit(50)", "acc.deposit(50)", "true"),
         C("then withdraw(200)", "acc.withdraw(200)", "false"),
         C("then withdraw(30)", "acc.withdraw(30)", "true"),
         C("then getBalance()", "acc.getBalance()", "120.0"),
         C("then deposit(-5)", "acc.deposit(-5)", "false"),
         C("balance unchanged", "acc.getBalance()", "120.0")]),

dict(topic="Strings", task_type="explain_output", difficulty="Medium", expected_minutes=4,
 question="This program compares String objects using == and using equals(). Predict each printed line exactly and explain the difference between comparing references and comparing contents, including what happens with a string created with new String(...).",
 starter_code="""public class Main {
    public static void main(String[] args) {
        String s1 = "java";
        String s2 = "java";
        String s3 = new String("java");
        System.out.println(s1 == s2);
        System.out.println(s1 == s3);
        System.out.println(s1.equals(s3));
        System.out.println(s1.equalsIgnoreCase("JAVA"));
    }
}""",
 output="true\nfalse\ntrue\ntrue\n",
 explanation="s1 and s2 are the same literal, so they refer to the same pooled String object and == is true. new String(\"java\") always creates a new object, so s1 == s3 compares two different references and is false. equals() compares the characters, so s1.equals(s3) is true. equalsIgnoreCase ignores case, so it is also true.",
 evaluation_points=["Correct output: true, false, true, true", "Explains == compares references", "Explains equals compares content", "Mentions the string pool / literals being shared and new String creating a separate object"]),

dict(topic="Sorting/Searching", task_type="write_code", difficulty="Hard", expected_minutes=6,
 question="Write an iterative method `public static int binarySearch(int[] sorted, int target)` that returns the index of target in an array sorted in ascending order, or -1 if it is not present. It must run in O(log n) time; do not use Arrays.binarySearch or any library search.",
 reference_solution="""public static int binarySearch(int[] sorted, int target) {
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
}""",
 evaluation_points=["Maintains low/high bounds and loops while low <= high", "Moves bounds past mid (mid + 1 / mid - 1) so the loop terminates", "Returns -1 when not found, including for an empty array", "O(log n); no linear scan", "Bonus: overflow-safe midpoint low + (high - low) / 2"],
 kind="method",
 checks=[C("[1, 3, 5, 7, 9, 11], 7", "binarySearch(new int[]{1, 3, 5, 7, 9, 11}, 7)", "3"),
         C("[1, 3, 5, 7, 9, 11], 4", "binarySearch(new int[]{1, 3, 5, 7, 9, 11}, 4)", "-1"),
         C("[], 5", "binarySearch(new int[]{}, 5)", "-1"),
         C("[2, 4], 2", "binarySearch(new int[]{2, 4}, 2)", "0"),
         C("[2, 4], 4", "binarySearch(new int[]{2, 4}, 4)", "1")]),

dict(topic="Arrays", task_type="complete_code", difficulty="Hard", expected_minutes=6,
 question="Complete the method mergeSorted so that it merges two int arrays that are each already sorted in ascending order into one new sorted array containing all elements of both (duplicates kept). Fill in the two TODO sections using the indexes i, j and k; do not call Arrays.sort.",
 starter_code="""public static int[] mergeSorted(int[] a, int[] b) {
    int[] result = new int[a.length + b.length];
    int i = 0, j = 0, k = 0;
    // TODO 1: while both arrays still have elements, copy the smaller one

    // TODO 2: copy whatever is left in a or b

    return result;
}""",
 reference_solution="""public static int[] mergeSorted(int[] a, int[] b) {
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
}""",
 evaluation_points=["Main loop runs while both indexes are in range and picks the smaller element", "Copies remaining elements of both arrays afterwards", "Handles an empty input array", "Keeps duplicates", "Runs in O(n + m) without sorting"],
 kind="method",
 checks=[C("[1, 3, 5], [2, 4, 6]", "Arrays.toString(mergeSorted(new int[]{1, 3, 5}, new int[]{2, 4, 6}))", "[1, 2, 3, 4, 5, 6]"),
         C("[], [1, 2]", "Arrays.toString(mergeSorted(new int[]{}, new int[]{1, 2}))", "[1, 2]"),
         C("[1, 1, 9], [1, 2]", "Arrays.toString(mergeSorted(new int[]{1, 1, 9}, new int[]{1, 2}))", "[1, 1, 1, 2, 9]"),
         C("[4, 8], []", "Arrays.toString(mergeSorted(new int[]{4, 8}, new int[]{}))", "[4, 8]")]),
]

# ---------------------------------------------------------------- SET 2
SETS[2] = [
dict(topic="Conditionals", task_type="write_code", difficulty="Easy", expected_minutes=3,
 question="Write a method `public static String letterGrade(int score)` that converts an exam score to a grade: 90-100 is \"A\", 80-89 is \"B\", 70-79 is \"C\", 60-69 is \"D\", 0-59 is \"F\". Any score below 0 or above 100 returns \"Invalid\".",
 reference_solution="""public static String letterGrade(int score) {
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
}""",
 evaluation_points=["Validates the 0-100 range first", "Boundary values (90, 80, 70, 60) map to the higher grade", "Uses an if / else-if chain in a sensible order", "Every path returns a value"],
 kind="method",
 checks=[C("95", "letterGrade(95)", "A"), C("80", "letterGrade(80)", "B"),
         C("59", "letterGrade(59)", "F"), C("101", "letterGrade(101)", "Invalid"),
         C("-3", "letterGrade(-3)", "Invalid"), C("70", "letterGrade(70)", "C"), C("65", "letterGrade(65)", "D")]),

dict(topic="Loops", task_type="explain_output", difficulty="Easy", expected_minutes=3,
 question="The program below uses nested for loops together with a continue statement. Write the exact output it produces and explain what continue does to the outer loop on the iteration where i equals 3.",
 starter_code="""public class Main {
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
}""",
 output="1\n12\n1234\n",
 explanation="For each i the inner loop prints 1..i on one line. When i is 3, continue skips the rest of that outer iteration, so neither the inner loop nor the println runs and no line (not even an empty one) is printed for 3.",
 evaluation_points=["Correct three lines: 1, 12, 1234", "States that no line (not even a blank line) is printed for i = 3", "Explains that continue jumps to the next iteration of the loop it is in", "Explains the inner loop prints 1..i"]),

dict(topic="Arrays", task_type="write_code", difficulty="Easy", expected_minutes=3,
 question="Write a method `public static int countEvens(int[] nums)` that returns how many values in the array are even. Zero and negative even numbers count as even. An empty array returns 0.",
 reference_solution="""public static int countEvens(int[] nums) {
    int count = 0;
    for (int n : nums) {
        if (n % 2 == 0) {
            count++;
        }
    }
    return count;
}""",
 evaluation_points=["Uses n % 2 == 0 (works for negatives; n % 2 == 1 style checks for odd would fail on negatives)", "Iterates over every element", "Returns 0 for an empty array"],
 kind="method",
 checks=[C("[1, 2, 3, 4]", "countEvens(new int[]{1, 2, 3, 4})", "2"),
         C("[]", "countEvens(new int[]{})", "0"),
         C("[-2, 0, 7]", "countEvens(new int[]{-2, 0, 7})", "2")]),

dict(topic="Strings", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Write a method `public static String reverseWords(String sentence)` that returns the words of the sentence in reverse order, separated by exactly one space. The input may have leading, trailing or repeated spaces between words; the result must not. Example: \"  hello   world java \" returns \"java world hello\". A blank input returns \"\".",
 reference_solution="""public static String reverseWords(String sentence) {
    String trimmed = sentence.trim();
    if (trimmed.isEmpty()) {
        return "";
    }
    String[] words = trimmed.split("\\\\s+");
    StringBuilder sb = new StringBuilder();
    for (int i = words.length - 1; i >= 0; i--) {
        sb.append(words[i]);
        if (i > 0) {
            sb.append(' ');
        }
    }
    return sb.toString();
}""",
 evaluation_points=["Trims and splits on one-or-more whitespace (\\\\s+)", "Iterates words from last to first", "No leading/trailing or double spaces in the result", "Handles blank input", "Uses StringBuilder or String.join rather than repeated concatenation (preferred)"],
 kind="method",
 checks=[C("\"  hello   world java \"", "reverseWords(\"  hello   world java \")", "java world hello"),
         C("\"one\"", "reverseWords(\"one\")", "one"),
         C("\"   \"", "reverseWords(\"   \")", ""),
         C("\"a b c\"", "reverseWords(\"a b c\")", "c b a")]),

dict(topic="Maps/Dictionaries", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Write a method `public static Map<String, Integer> wordCount(String text)` that counts how many times each word occurs. Words are separated by one or more spaces and counting is case-insensitive (store keys in lower case). A blank string returns an empty map. Example: wordCount(\"The cat and the hat\") maps \"the\" to 2 and every other word to 1.",
 reference_solution="""public static Map<String, Integer> wordCount(String text) {
    Map<String, Integer> counts = new HashMap<>();
    if (text.trim().isEmpty()) {
        return counts;
    }
    for (String word : text.trim().toLowerCase().split("\\\\s+")) {
        counts.put(word, counts.getOrDefault(word, 0) + 1);
    }
    return counts;
}""",
 evaluation_points=["Uses a HashMap<String, Integer>", "Lower-cases words so counting is case-insensitive", "Uses getOrDefault / merge / containsKey to handle first occurrence", "Splits on repeated spaces and handles blank input"],
 kind="method",
 checks=[C("\"The cat and the hat\" -> get(\"the\")", "wordCount(\"The cat and the hat\").get(\"the\")", "2"),
         C("\"The cat and the hat\" -> get(\"cat\")", "wordCount(\"The cat and the hat\").get(\"cat\")", "1"),
         C("\"The cat and the hat\" -> size()", "wordCount(\"The cat and the hat\").size()", "4"),
         C("\"\" -> size()", "wordCount(\"\").size()", "0"),
         C("\"go  GO go\" -> get(\"go\")", "wordCount(\"go  GO go\").get(\"go\")", "3")]),

dict(topic="Debugging", task_type="fix_bug", difficulty="Medium", expected_minutes=4,
 question="countVowels should return the number of vowels (a, e, i, o, u) in a string, counting both upper and lower case. The current version throws StringIndexOutOfBoundsException and also miscounts words with capital vowels. Find both bugs and write the corrected method.",
 starter_code="""public static int countVowels(String s) {
    int count = 0;
    for (int i = 0; i <= s.length(); i++) {
        char c = s.charAt(i);
        if ("aeiou".indexOf(c) != -1) {
            count++;
        }
    }
    return count;
}""",
 reference_solution="""public static int countVowels(String s) {
    int count = 0;
    for (int i = 0; i < s.length(); i++) {
        char c = Character.toLowerCase(s.charAt(i));
        if ("aeiou".indexOf(c) != -1) {
            count++;
        }
    }
    return count;
}""",
 evaluation_points=["Fixes the loop condition from <= to < (off-by-one)", "Makes the check case-insensitive (toLowerCase or \"aeiouAEIOU\")", "Explains why charAt(s.length()) throws", "Empty string returns 0"],
 kind="method",
 checks=[C("\"Hello World\"", "countVowels(\"Hello World\")", "3"),
         C("\"AEIOU\"", "countVowels(\"AEIOU\")", "5"),
         C("\"\"", "countVowels(\"\")", "0"),
         C("\"rhythm\"", "countVowels(\"rhythm\")", "0")]),

dict(topic="OOP Basics", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Given `interface Shape { double area(); }`, write two classes that implement it: `Circle` (constructor takes a double radius; area = Math.PI * r * r) and `Rectangle` (constructor takes double width and height). Then write `public static double totalArea(List<Shape> shapes)` inside a class `ShapeUtils` that returns the sum of the areas of all shapes (0.0 for an empty list).",
 starter_code="""interface Shape {
    double area();
}""",
 reference_solution="""class Circle implements Shape {
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
}""",
 evaluation_points=["Both classes use implements Shape and override area() as public", "Constructors store the dimensions in fields", "totalArea works through the Shape interface (polymorphism), no instanceof checks", "Returns 0.0 for an empty list"],
 kind="toplevel", extra="""interface Shape {
    double area();
}""",
 checks=[C("new Rectangle(2, 3).area()", "new Rectangle(2, 3).area()", "6.0"),
         C("new Circle(1).area()", "new Circle(1).area()", "3.141592653589793"),
         C("totalArea([Rectangle(2,3), Rectangle(1,1)])", "ShapeUtils.totalArea(List.of(new Rectangle(2, 3), new Rectangle(1, 1)))", "7.0"),
         C("totalArea([])", "ShapeUtils.totalArea(new ArrayList<Shape>())", "0.0")]),

dict(topic="OOP Basics", task_type="explain_output", difficulty="Medium", expected_minutes=4,
 question="The Ticket class below has one static field and one instance field. After three tickets are created, what does main print? Explain how a static field differs from an instance field and why a.issued prints what it does.",
 starter_code="""class Ticket {
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
}""",
 output="1\n3\n3\n3\n",
 explanation="issued is static, so there is a single copy shared by all Ticket objects; each constructor call increments it. number is an instance field, so each object keeps the value issued had at its creation: a gets 1, b gets 2, c gets 3. Ticket.issued is 3 after three objects. a.issued is the same shared static field (accessing it through an instance is allowed but misleading), so it is also 3.",
 evaluation_points=["Correct output: 1, 3, 3, 3", "Explains a static field is shared by all instances", "Explains each object has its own number", "Explains a.issued refers to the same static variable"]),

dict(topic="Recursion", task_type="write_code", difficulty="Hard", expected_minutes=6,
 question="Write a recursive method `public static List<String> permutations(String s)` that returns all permutations of a string whose characters are all distinct. Build them by choosing each character in turn (left to right) as the first character and recursively permuting the rest, so permutations(\"abc\") returns [abc, acb, bac, bca, cab, cba] in that order. For a string of length 0 or 1, return a list containing just that string.",
 reference_solution="""public static List<String> permutations(String s) {
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
}""",
 evaluation_points=["Correct base case for length 0/1", "Removes the chosen character correctly with substring", "Recursive call on the remaining characters and prefixes the chosen char", "Produces n! results in the required order", "No duplicates for distinct input characters"],
 kind="method",
 checks=[C("\"abc\"", "permutations(\"abc\")", "[abc, acb, bac, bca, cab, cba]"),
         C("\"a\"", "permutations(\"a\")", "[a]"),
         C("\"abcd\" -> size()", "permutations(\"abcd\").size()", "24"),
         C("\"ab\"", "permutations(\"ab\")", "[ab, ba]")]),

dict(topic="Sorting/Searching", task_type="complete_code", difficulty="Hard", expected_minutes=6,
 question="Complete the insertion sort below so that it sorts the array in place in ascending order. For each position i, the variable key holds arr[i]; shift every larger element of the already-sorted part arr[0..i-1] one place to the right, then drop key into the gap. Do not use Arrays.sort.",
 starter_code="""public static void insertionSort(int[] arr) {
    for (int i = 1; i < arr.length; i++) {
        int key = arr[i];
        int j = i - 1;
        // TODO 1: shift elements greater than key one position to the right

        // TODO 2: place key in its correct position
    }
}""",
 reference_solution="""public static void insertionSort(int[] arr) {
    for (int i = 1; i < arr.length; i++) {
        int key = arr[i];
        int j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}""",
 evaluation_points=["Inner while loop checks j >= 0 before accessing arr[j]", "Shifts with arr[j + 1] = arr[j] and decrements j", "Places key at arr[j + 1] after the loop", "Stable: uses > (not >=) so equal elements keep their order", "Works for empty and single-element arrays"],
 kind="method",
 checks=[C("[5, 2, 9, 1, 5]", "Arrays.toString(t)", "[1, 2, 5, 5, 9]", pre="int[] t = {5, 2, 9, 1, 5}; insertionSort(t);"),
         C("[]", "Arrays.toString(t)", "[]", pre="int[] t = {}; insertionSort(t);"),
         C("[3, -1, 2]", "Arrays.toString(t)", "[-1, 2, 3]", pre="int[] t = {3, -1, 2}; insertionSort(t);"),
         C("[1, 2, 3]", "Arrays.toString(t)", "[1, 2, 3]", pre="int[] t = {1, 2, 3}; insertionSort(t);")]),
]

# ---------------------------------------------------------------- SET 3
SETS[3] = [
dict(topic="Conditionals", task_type="write_code", difficulty="Easy", expected_minutes=3,
 question="Write a method `public static boolean isLeapYear(int year)` using the Gregorian rules: a year is a leap year if it is divisible by 4, except years divisible by 100, which are leap years only if they are also divisible by 400. Examples: 2024 is a leap year, 1900 is not, 2000 is.",
 reference_solution="""public static boolean isLeapYear(int year) {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}""",
 evaluation_points=["Divisible by 4 rule", "Century exception (divisible by 100 is not a leap year)", "400 exception (2000 is a leap year)", "Correct operator precedence / parentheses"],
 kind="method",
 checks=[C("2024", "isLeapYear(2024)", "true"), C("1900", "isLeapYear(1900)", "false"),
         C("2000", "isLeapYear(2000)", "true"), C("2023", "isLeapYear(2023)", "false")]),

dict(topic="Strings", task_type="explain_output", difficulty="Easy", expected_minutes=3,
 question="Strings in Java are immutable. Using that fact, predict exactly what this program prints and explain why the first line is not in upper case even though toUpperCase() was called.",
 starter_code="""public class Main {
    public static void main(String[] args) {
        String s = "hello";
        s.toUpperCase();
        System.out.println(s);
        s = s.concat(" world");
        System.out.println(s);
        System.out.println(s.length());
        System.out.println(s.indexOf('o'));
    }
}""",
 output="hello\nhello world\n11\n4\n",
 explanation="String methods never modify the original object; they return a new String. s.toUpperCase() returns \"HELLO\" but the result is discarded, so s is still \"hello\". concat also returns a new string, but this time it is assigned back to s, giving \"hello world\" (11 characters including the space). indexOf('o') returns the first position of 'o', which is index 4.",
 evaluation_points=["Correct output: hello, hello world, 11, 4", "Explains String immutability and that the toUpperCase result was discarded", "Explains the reassignment s = s.concat(...)", "Counts length and zero-based index correctly"]),

dict(topic="Loops", task_type="write_code", difficulty="Easy", expected_minutes=3,
 question="Write an iterative (loop-based, not recursive) method `public static long factorial(int n)` that returns n! for 0 <= n <= 20. factorial(0) is 1. If n is negative, throw an IllegalArgumentException.",
 reference_solution="""public static long factorial(int n) {
    if (n < 0) {
        throw new IllegalArgumentException("n must be non-negative");
    }
    long result = 1;
    for (int i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}""",
 evaluation_points=["Uses long so 20! does not overflow", "Returns 1 for 0 (and 1)", "Throws IllegalArgumentException for negative input", "Uses a loop, not recursion"],
 kind="method",
 checks=[C("0", "factorial(0)", "1"), C("5", "factorial(5)", "120"),
         C("20", "factorial(20)", "2432902008176640000"),
         C("-1 -> exception", "thrown(() -> factorial(-1))", "IllegalArgumentException")]),

dict(topic="Strings", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Write a method `public static String compress(String s)` that performs run-length encoding using a StringBuilder: each run of the same character is replaced by the character followed by the length of the run. Example: \"aaabccdddd\" returns \"a3b1c2d4\". An empty string returns \"\".",
 reference_solution="""public static String compress(String s) {
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
}""",
 evaluation_points=["Uses StringBuilder rather than repeated String concatenation", "Counts consecutive runs correctly, including the final run", "Single characters get count 1", "Empty string handled without errors"],
 kind="method",
 checks=[C("\"aaabccdddd\"", "compress(\"aaabccdddd\")", "a3b1c2d4"),
         C("\"\"", "compress(\"\")", ""),
         C("\"abc\"", "compress(\"abc\")", "a1b1c1"),
         C("\"zzzzzz\"", "compress(\"zzzzzz\")", "z6"),
         C("\"aabaa\"", "compress(\"aabaa\")", "a2b1a2")]),

dict(topic="Collections", task_type="write_code", difficulty="Medium", expected_minutes=4,
 question="Write a method `public static List<String> removeDuplicates(List<String> items)` that returns a new ArrayList containing each distinct item once, in the order of its first appearance. The original list must not be modified. Example: [apple, pear, apple, fig, pear] returns [apple, pear, fig].",
 reference_solution="""public static List<String> removeDuplicates(List<String> items) {
    List<String> result = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (String item : items) {
        if (seen.add(item)) {
            result.add(item);
        }
    }
    return result;
}""",
 evaluation_points=["Returns a new list and leaves the input untouched", "Preserves first-occurrence order", "Uses a HashSet / LinkedHashSet (or contains check) to detect duplicates", "Handles an empty list"],
 kind="method",
 checks=[C("[apple, pear, apple, fig, pear]", "removeDuplicates(List.of(\"apple\", \"pear\", \"apple\", \"fig\", \"pear\"))", "[apple, pear, fig]"),
         C("[]", "removeDuplicates(new ArrayList<String>())", "[]"),
         C("original list unchanged", "src", "[b, a, b]", pre="List<String> src = new ArrayList<>(List.of(\"b\", \"a\", \"b\")); removeDuplicates(src);"),
         C("[x, x, x]", "removeDuplicates(List.of(\"x\", \"x\", \"x\"))", "[x]")]),

dict(topic="Maps/Dictionaries", task_type="fix_bug", difficulty="Medium", expected_minutes=4,
 question="countOrdersByCustomer should return a map from customer name to the number of orders that customer placed. Instead it crashes with a NullPointerException on the very first order. Explain the cause and write a corrected version.",
 starter_code="""public static Map<String, Integer> countOrdersByCustomer(String[] customers) {
    Map<String, Integer> counts = new HashMap<>();
    for (String c : customers) {
        counts.put(c, counts.get(c) + 1);
    }
    return counts;
}""",
 reference_solution="""public static Map<String, Integer> countOrdersByCustomer(String[] customers) {
    Map<String, Integer> counts = new HashMap<>();
    for (String c : customers) {
        counts.put(c, counts.getOrDefault(c, 0) + 1);
    }
    return counts;
}""",
 evaluation_points=["Explains get returns null for a missing key and auto-unboxing null to int throws NullPointerException", "Uses getOrDefault(c, 0), merge(c, 1, Integer::sum) or a containsKey check", "Counts are correct for repeated customers", "Empty array returns an empty map"],
 kind="method",
 checks=[C("[ana, raj, ana] -> get(\"ana\")", "countOrdersByCustomer(new String[]{\"ana\", \"raj\", \"ana\"}).get(\"ana\")", "2"),
         C("[ana, raj, ana] -> get(\"raj\")", "countOrdersByCustomer(new String[]{\"ana\", \"raj\", \"ana\"}).get(\"raj\")", "1"),
         C("[] -> size()", "countOrdersByCustomer(new String[]{}).size()", "0")]),

dict(topic="Exceptions", task_type="write_code", difficulty="Medium", expected_minutes=4,
 question="Write a method `public static int parseOrDefault(String text, int defaultValue)` that converts text to an int using Integer.parseInt after trimming surrounding spaces. If text is null or is not a valid integer, return defaultValue instead of throwing. Example: parseOrDefault(\" 7 \", 0) returns 7; parseOrDefault(\"abc\", 0) returns 0.",
 reference_solution="""public static int parseOrDefault(String text, int defaultValue) {
    if (text == null) {
        return defaultValue;
    }
    try {
        return Integer.parseInt(text.trim());
    } catch (NumberFormatException e) {
        return defaultValue;
    }
}""",
 evaluation_points=["Uses try/catch around Integer.parseInt", "Catches NumberFormatException specifically (not a bare catch of Throwable)", "Handles null without a NullPointerException", "Trims whitespace before parsing"],
 kind="method",
 checks=[C("\"42\", 0", "parseOrDefault(\"42\", 0)", "42"),
         C("\" 7 \", 0", "parseOrDefault(\" 7 \", 0)", "7"),
         C("\"abc\", 0", "parseOrDefault(\"abc\", 0)", "0"),
         C("null, 5", "parseOrDefault(null, 5)", "5"),
         C("\"-15\", 1", "parseOrDefault(\"-15\", 1)", "-15")]),

dict(topic="Exceptions", task_type="explain_output", difficulty="Medium", expected_minutes=4,
 question="Trace the try / catch / finally flow in this program, which reads past the end of an array. Write the exact output and explain which statements run, which are skipped, and why the finally block and the last println both execute.",
 starter_code="""public class Main {
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
}""",
 output="A\nC\nD\nE\n",
 explanation="\"A\" prints first. data[3] is out of bounds (valid indexes are 0-2), so an ArrayIndexOutOfBoundsException is thrown before anything is printed for that line, and the rest of the try block (\"B\") is skipped. The matching catch prints \"C\". finally always runs, printing \"D\". Because the exception was handled, execution continues normally and \"E\" prints.",
 evaluation_points=["Correct output: A, C, D, E", "Explains B is skipped once the exception is thrown", "Explains finally always runs", "Explains the program continues after a caught exception"]),

dict(topic="Sorting/Searching", task_type="write_code", difficulty="Hard", expected_minutes=6,
 question="Using the Employee class shown, write `public static void sortEmployees(List<Employee> list)` inside a class `EmployeeSorter` that sorts the list in place by salary from highest to lowest; employees with equal salary must be ordered by name alphabetically (A to Z). Use a Comparator (lambda, method references or an anonymous class).",
 starter_code="""class Employee {
    private final String name;
    private final double salary;

    Employee(String name, double salary) {
        this.name = name;
        this.salary = salary;
    }

    String getName() { return name; }
    double getSalary() { return salary; }
}""",
 reference_solution="""class EmployeeSorter {
    public static void sortEmployees(List<Employee> list) {
        list.sort((a, b) -> {
            int bySalary = Double.compare(b.getSalary(), a.getSalary());
            if (bySalary != 0) {
                return bySalary;
            }
            return a.getName().compareTo(b.getName());
        });
    }
}""",
 evaluation_points=["Sorts by salary descending (Double.compare(b, a) or .reversed())", "Tie-break by name ascending with compareTo / thenComparing", "Sorts in place (list.sort or Collections.sort)", "Does not subtract doubles and cast to int for comparison", "Handles an empty list"],
 kind="toplevel", extra="""class Employee {
    private final String name;
    private final double salary;

    Employee(String name, double salary) {
        this.name = name;
        this.salary = salary;
    }

    String getName() { return name; }
    double getSalary() { return salary; }
}""",
 checks=[C("[Ravi 50000, Anu 70000, Bala 50000]", "l.stream().map(Employee::getName).collect(Collectors.toList())", "[Anu, Bala, Ravi]",
           pre="List<Employee> l = new ArrayList<>(List.of(new Employee(\"Ravi\", 50000), new Employee(\"Anu\", 70000), new Employee(\"Bala\", 50000))); EmployeeSorter.sortEmployees(l);"),
         C("[Zed 100.5, Amy 100.25]", "l.stream().map(Employee::getName).collect(Collectors.toList())", "[Zed, Amy]",
           pre="List<Employee> l = new ArrayList<>(List.of(new Employee(\"Amy\", 100.25), new Employee(\"Zed\", 100.5))); EmployeeSorter.sortEmployees(l);"),
         C("[]", "l.size()", "0", pre="List<Employee> l = new ArrayList<>(); EmployeeSorter.sortEmployees(l);")]),

dict(topic="Recursion", task_type="complete_code", difficulty="Hard", expected_minutes=6,
 question="Complete the recursive Tower of Hanoi method. It must add to moves, in order, every move needed to transfer n disks from peg `from` to peg `to` using peg `via`, where each move is recorded as a string like \"A->C\". For example hanoi(2, 'A', 'C', 'B', moves) produces [A->B, A->C, B->C]. Only the TODO part needs to be written.",
 starter_code="""public static void hanoi(int n, char from, char to, char via, List<String> moves) {
    if (n == 0) {
        return;
    }
    // TODO: move n-1 disks out of the way, record the move of the largest disk,
    //       then move the n-1 disks on top of it
}""",
 reference_solution="""public static void hanoi(int n, char from, char to, char via, List<String> moves) {
    if (n == 0) {
        return;
    }
    hanoi(n - 1, from, via, to, moves);
    moves.add(from + "->" + to);
    hanoi(n - 1, via, to, from, moves);
}""",
 evaluation_points=["First recursive call moves n-1 disks from 'from' to 'via'", "Records the move from 'from' to 'to'", "Second recursive call moves n-1 disks from 'via' to 'to'", "Produces 2^n - 1 moves", "Builds the move string correctly (not char arithmetic)"],
 kind="method",
 checks=[C("n=2, A->C via B", "m", "[A->B, A->C, B->C]", pre="List<String> m = new ArrayList<>(); hanoi(2, 'A', 'C', 'B', m);"),
         C("n=1, A->C via B", "m", "[A->C]", pre="List<String> m = new ArrayList<>(); hanoi(1, 'A', 'C', 'B', m);"),
         C("n=3 -> number of moves", "m.size()", "7", pre="List<String> m = new ArrayList<>(); hanoi(3, 'A', 'C', 'B', m);"),
         C("n=3 -> 4th move", "m.get(3)", "A->C", pre="List<String> m = new ArrayList<>(); hanoi(3, 'A', 'C', 'B', m);")]),
]

# ---------------------------------------------------------------- SET 4
SETS[4] = [
dict(topic="Arrays", task_type="write_code", difficulty="Easy", expected_minutes=3,
 question="Write a method `public static void reverseInPlace(int[] arr)` that reverses the order of the elements of the array itself (do not create a second array). Example: {1, 2, 3, 4} becomes {4, 3, 2, 1}.",
 reference_solution="""public static void reverseInPlace(int[] arr) {
    int left = 0;
    int right = arr.length - 1;
    while (left < right) {
        int temp = arr[left];
        arr[left] = arr[right];
        arr[right] = temp;
        left++;
        right--;
    }
}""",
 evaluation_points=["Swaps elements from both ends using a temporary variable", "Stops at the middle (left < right) so elements are not swapped back", "No second array", "Works for odd, even, empty and single-element arrays"],
 kind="method",
 checks=[C("[1, 2, 3, 4]", "Arrays.toString(t)", "[4, 3, 2, 1]", pre="int[] t = {1, 2, 3, 4}; reverseInPlace(t);"),
         C("[5, 6, 7]", "Arrays.toString(t)", "[7, 6, 5]", pre="int[] t = {5, 6, 7}; reverseInPlace(t);"),
         C("[]", "Arrays.toString(t)", "[]", pre="int[] t = {}; reverseInPlace(t);")]),

dict(topic="Functions", task_type="explain_output", difficulty="Easy", expected_minutes=3,
 question="Java passes arguments to methods by value. The update method below receives an int, an int array and a String and tries to change all three. What does main print afterwards? Explain why only one of the three changes is visible to the caller.",
 starter_code="""public class Main {
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
}""",
 output="5\n100\noriginal\n",
 explanation="Java copies each argument into the parameter. count is a primitive, so the method changes only its own copy: main still sees 5. For the array, the copied value is a reference to the same array object, so totals[0] = 100 modifies the shared array and main sees 100. label = \"changed\" only points the local parameter at a different String; main's variable still refers to \"original\".",
 evaluation_points=["Correct output: 5, 100, original", "Explains primitives are copied", "Explains the array reference is copied but points to the same object, so element changes are visible", "Explains reassigning a reference parameter does not affect the caller's variable"]),

dict(topic="Strings", task_type="write_code", difficulty="Easy", expected_minutes=3,
 question="Write a method `public static int countChar(String s, char target)` that returns how many times target occurs in s. The comparison is case-sensitive. Example: countChar(\"banana\", 'a') returns 3.",
 reference_solution="""public static int countChar(String s, char target) {
    int count = 0;
    for (int i = 0; i < s.length(); i++) {
        if (s.charAt(i) == target) {
            count++;
        }
    }
    return count;
}""",
 evaluation_points=["Iterates over every character with correct bounds", "Compares chars with == (appropriate for primitives)", "Case-sensitive as required", "Returns 0 for an empty string"],
 kind="method",
 checks=[C("\"banana\", 'a'", "countChar(\"banana\", 'a')", "3"),
         C("\"\", 'x'", "countChar(\"\", 'x')", "0"),
         C("\"Apple\", 'a'", "countChar(\"Apple\", 'a')", "0"),
         C("\"Mississippi\", 's'", "countChar(\"Mississippi\", 's')", "4")]),

dict(topic="Maps/Dictionaries", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Write a method `public static int[] twoSum(int[] nums, int target)` that returns the indexes {i, j} (with i < j) of the two elements that add up to target. Exactly one valid pair exists. Solve it in a single pass using a HashMap from value to index (O(n) time), not with nested loops.",
 reference_solution="""public static int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> indexByValue = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int needed = target - nums[i];
        if (indexByValue.containsKey(needed)) {
            return new int[]{indexByValue.get(needed), i};
        }
        indexByValue.put(nums[i], i);
    }
    return new int[0];
}""",
 evaluation_points=["Uses a HashMap from value to index", "Checks for the complement before inserting the current value (so an element is not paired with itself)", "Returns indexes in order i < j", "O(n) single pass", "Handles duplicate values such as {3, 3}"],
 kind="method",
 checks=[C("[2, 7, 11, 15], 9", "Arrays.toString(twoSum(new int[]{2, 7, 11, 15}, 9))", "[0, 1]"),
         C("[3, 2, 4], 6", "Arrays.toString(twoSum(new int[]{3, 2, 4}, 6))", "[1, 2]"),
         C("[3, 3], 6", "Arrays.toString(twoSum(new int[]{3, 3}, 6))", "[0, 1]"),
         C("[-4, 10, 1, 8], 4", "Arrays.toString(twoSum(new int[]{-4, 10, 1, 8}, 4))", "[0, 3]")]),

dict(topic="OOP Basics", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Write a class `Product` with private fields name (String), price (double) and quantity (int). The constructor `Product(String name, double price, int quantity)` must throw IllegalArgumentException if price or quantity is negative. Add `double getPrice()`, `double getInventoryValue()` (price x quantity) and `void applyDiscount(double percent)` which reduces the price by that percentage and throws IllegalArgumentException if percent is outside 0-100.",
 reference_solution="""class Product {
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
}""",
 evaluation_points=["Private fields with a constructor that assigns them", "Constructor validates and throws IllegalArgumentException", "getInventoryValue multiplies price by quantity", "applyDiscount validates the range and updates price correctly", "Invalid discount leaves the price unchanged"],
 kind="toplevel",
 checks=[C("new Product(\"Pen\", 2.0, 10).getInventoryValue()", "new Product(\"Pen\", 2.0, 10).getInventoryValue()", "20.0"),
         C("Pen 2.0 x10, applyDiscount(25) -> getPrice()", "p.getPrice()", "1.5", pre="Product p = new Product(\"Pen\", 2.0, 10); p.applyDiscount(25);"),
         C("new Product(\"X\", -1, 1)", "thrown(() -> new Product(\"X\", -1, 1))", "IllegalArgumentException"),
         C("applyDiscount(150)", "thrown(() -> new Product(\"Pen\", 2.0, 10).applyDiscount(150))", "IllegalArgumentException"),
         C("after failed discount price unchanged", "p.getPrice()", "2.0", pre="Product p = new Product(\"Pen\", 2.0, 10); thrown(() -> p.applyDiscount(-5));")]),

dict(topic="Debugging", task_type="fix_bug", difficulty="Medium", expected_minutes=4,
 question="countMatches should count how many product codes in the array equal target. When the codes are read from a file at runtime it often returns fewer matches than expected, even though printing the values shows identical text. The method must also tolerate null entries in the array (target is never null). Explain the bug and fix it.",
 starter_code="""public static int countMatches(String[] codes, String target) {
    int count = 0;
    for (String code : codes) {
        if (code == target) {
            count++;
        }
    }
    return count;
}""",
 reference_solution="""public static int countMatches(String[] codes, String target) {
    int count = 0;
    for (String code : codes) {
        if (target.equals(code)) {
            count++;
        }
    }
    return count;
}""",
 evaluation_points=["Identifies that == compares references, not string content", "Replaces it with equals()", "Calls equals on target (or uses Objects.equals) so null entries do not throw", "Explains why literals may appear to work while runtime strings fail"],
 kind="method",
 checks=[C("[new String(\"A1\"), \"B2\", new String(\"A1\")], \"A1\"", "countMatches(arr, \"A1\")", "2", pre="String[] arr = {new String(\"A1\"), \"B2\", new String(\"A1\")};"),
         C("[null, \"X9\"], \"X9\"", "countMatches(new String[]{null, \"X9\"}, \"X9\")", "1"),
         C("[], \"A1\"", "countMatches(new String[]{}, \"A1\")", "0")]),

dict(topic="Loops", task_type="write_code", difficulty="Medium", expected_minutes=4,
 question="Write a method `public static boolean isPrime(int n)` that returns true if n is a prime number. Numbers less than 2 are not prime. Only test divisors up to the square root of n (i * i <= n) instead of checking every number below n.",
 reference_solution="""public static boolean isPrime(int n) {
    if (n < 2) {
        return false;
    }
    for (int i = 2; (long) i * i <= n; i++) {
        if (n % i == 0) {
            return false;
        }
    }
    return true;
}""",
 evaluation_points=["Returns false for n < 2 (0, 1 and negatives)", "Loop bound i * i <= n (or i <= Math.sqrt(n))", "Returns false as soon as a divisor is found", "2 and 3 are prime", "Perfect squares such as 49 are detected as not prime"],
 kind="method",
 checks=[C("1", "isPrime(1)", "false"), C("2", "isPrime(2)", "true"), C("17", "isPrime(17)", "true"),
         C("21", "isPrime(21)", "false"), C("49", "isPrime(49)", "false"), C("97", "isPrime(97)", "true")]),

dict(topic="OOP Basics", task_type="explain_output", difficulty="Medium", expected_minutes=4,
 question="All three objects below are stored in variables declared as Vehicle, but they are instances of different classes in an inheritance chain. Predict the output exactly and explain how method overriding, dynamic dispatch and the super.describe() call determine each line.",
 starter_code="""class Vehicle {
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
}""",
 output="Vehicle\nCar with 4 wheels\nSports Car with 4 wheels\ntrue\n",
 explanation="The method that runs is chosen by the object's actual class, not the variable's declared type (dynamic dispatch). v1 is a Vehicle, so \"Vehicle\". v2 is a Car; Car.describe calls wheels(), which Car overrides to return 4. v3 is a SportsCar; its describe prefixes \"Sports \" to super.describe(), which is Car's version, and wheels() still resolves to Car's override (4). A SportsCar is a Car, so instanceof is true.",
 evaluation_points=["Correct output: Vehicle / Car with 4 wheels / Sports Car with 4 wheels / true", "Explains dynamic dispatch uses the runtime type", "Explains super.describe() calls the parent (Car) implementation", "Explains instanceof is true for subclasses"]),

dict(topic="Arrays", task_type="write_code", difficulty="Hard", expected_minutes=6,
 question="Write a method `public static int[][] rotateClockwise(int[][] matrix)` that returns a new matrix equal to the input rotated 90 degrees clockwise. The input has R rows and C columns (R, C >= 1, not necessarily square), so the result has C rows and R columns. Example: {{1, 2}, {3, 4}} becomes {{3, 1}, {4, 2}}.",
 reference_solution="""public static int[][] rotateClockwise(int[][] matrix) {
    int rows = matrix.length;
    int cols = matrix[0].length;
    int[][] result = new int[cols][rows];
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            result[c][rows - 1 - r] = matrix[r][c];
        }
    }
    return result;
}""",
 evaluation_points=["Allocates the result as [cols][rows]", "Correct index mapping result[c][rows - 1 - r] = matrix[r][c]", "Works for non-square matrices", "Does not modify the input matrix"],
 kind="method",
 checks=[C("[[1, 2], [3, 4]]", "Arrays.deepToString(rotateClockwise(new int[][]{{1, 2}, {3, 4}}))", "[[3, 1], [4, 2]]"),
         C("[[1, 2, 3]]", "Arrays.deepToString(rotateClockwise(new int[][]{{1, 2, 3}}))", "[[1], [2], [3]]"),
         C("[[1, 2, 3], [4, 5, 6]]", "Arrays.deepToString(rotateClockwise(new int[][]{{1, 2, 3}, {4, 5, 6}}))", "[[4, 1], [5, 2], [6, 3]]"),
         C("[[1,2,3],[4,5,6],[7,8,9]]", "Arrays.deepToString(rotateClockwise(new int[][]{{1, 2, 3}, {4, 5, 6}, {7, 8, 9}}))", "[[7, 4, 1], [8, 5, 2], [9, 6, 3]]")]),

dict(topic="Collections", task_type="write_code", difficulty="Hard", expected_minutes=6,
 question="Write a method `public static boolean isBalanced(String s)` that returns true if every bracket in s is correctly matched and nested. The bracket pairs are (), [] and {}; all other characters are ignored. Use a stack (Deque<Character> / ArrayDeque). Examples: \"{[()]}\" and \"a(b)c\" are balanced; \"([)]\", \"((\" and \")(\" are not.",
 reference_solution="""public static boolean isBalanced(String s) {
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
}""",
 evaluation_points=["Pushes opening brackets onto a stack", "On a closing bracket, returns false if the stack is empty or the top does not match", "Returns stack.isEmpty() at the end (unclosed brackets fail)", "Ignores non-bracket characters", "O(n) single pass"],
 kind="method",
 checks=[C("\"{[()]}\"", "isBalanced(\"{[()]}\")", "true"), C("\"([)]\"", "isBalanced(\"([)]\")", "false"),
         C("\"((\"", "isBalanced(\"((\")", "false"), C("\"a(b)c\"", "isBalanced(\"a(b)c\")", "true"),
         C("\")(\"", "isBalanced(\")(\")", "false"), C("\"\"", "isBalanced(\"\")", "true")]),
]

# ---------------------------------------------------------------- SET 5
SETS[5] = [
dict(topic="Conditionals", task_type="write_code", difficulty="Easy", expected_minutes=3,
 question="Write a method `public static String classifyTriangle(int a, int b, int c)` that returns \"Invalid\" if the three side lengths cannot form a triangle (any side <= 0, or the sum of two sides is not greater than the third), otherwise \"Equilateral\" (all sides equal), \"Isosceles\" (exactly two equal) or \"Scalene\" (all different).",
 reference_solution="""public static String classifyTriangle(int a, int b, int c) {
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
}""",
 evaluation_points=["Checks validity first, including non-positive sides", "Checks all three triangle inequalities", "Equilateral checked before Isosceles", "Isosceles covers all three pairs"],
 kind="method",
 checks=[C("3, 3, 3", "classifyTriangle(3, 3, 3)", "Equilateral"), C("3, 4, 3", "classifyTriangle(3, 4, 3)", "Isosceles"),
         C("3, 4, 5", "classifyTriangle(3, 4, 5)", "Scalene"), C("1, 2, 3", "classifyTriangle(1, 2, 3)", "Invalid"),
         C("0, 4, 4", "classifyTriangle(0, 4, 4)", "Invalid")]),

dict(topic="Collections", task_type="explain_output", difficulty="Easy", expected_minutes=3,
 question="The program below builds an ArrayList of office items and then inserts at an index and removes by value. Write the four lines it prints and explain what add(1, ...) and remove(\"pen\") each do to the list.",
 starter_code="""import java.util.ArrayList;
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
}""",
 output="[cup, book, lamp]\n3\nbook\n-1\n",
 explanation="After the three add calls the list is [pen, book, lamp]. add(1, \"cup\") inserts at index 1 and shifts the rest right: [pen, cup, book, lamp]. remove(\"pen\") removes the first element equal to \"pen\": [cup, book, lamp]. size() is 3, get(1) is \"book\", and indexOf returns -1 for an element that is not present.",
 evaluation_points=["Correct output: [cup, book, lamp], 3, book, -1", "Explains add(index, value) inserts and shifts elements", "Explains remove(Object) removes by value", "Explains indexOf returns -1 when absent"]),

dict(topic="Arrays", task_type="write_code", difficulty="Easy", expected_minutes=3,
 question="Write a method `public static int[] runningTotals(int[] amounts)` that returns a new array of the same length where element i is the sum of amounts[0] through amounts[i]. Example: {1, 2, 3, 4} returns {1, 3, 6, 10}. An empty array returns an empty array.",
 reference_solution="""public static int[] runningTotals(int[] amounts) {
    int[] totals = new int[amounts.length];
    int sum = 0;
    for (int i = 0; i < amounts.length; i++) {
        sum += amounts[i];
        totals[i] = sum;
    }
    return totals;
}""",
 evaluation_points=["Creates a new array of the same length", "Keeps a running sum instead of re-summing with a nested loop", "Handles negative values and an empty array", "Does not modify the input"],
 kind="method",
 checks=[C("[1, 2, 3, 4]", "Arrays.toString(runningTotals(new int[]{1, 2, 3, 4}))", "[1, 3, 6, 10]"),
         C("[]", "Arrays.toString(runningTotals(new int[]{}))", "[]"),
         C("[5, -2, 7]", "Arrays.toString(runningTotals(new int[]{5, -2, 7}))", "[5, 3, 10]")]),

dict(topic="Strings", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Write a method `public static boolean isAnagram(String a, String b)` that returns true if the two strings contain exactly the same letters with the same counts, ignoring case and ignoring spaces. Examples: (\"Listen\", \"Silent\") and (\"Dormitory\", \"Dirty room\") return true; (\"aab\", \"abb\") returns false.",
 reference_solution="""public static boolean isAnagram(String a, String b) {
    char[] x = a.replace(" ", "").toLowerCase().toCharArray();
    char[] y = b.replace(" ", "").toLowerCase().toCharArray();
    if (x.length != y.length) {
        return false;
    }
    Arrays.sort(x);
    Arrays.sort(y);
    return Arrays.equals(x, y);
}""",
 evaluation_points=["Removes spaces and normalises case", "Compares character counts (sorting or a frequency map/array)", "Uses Arrays.equals / count comparison, not == on arrays", "Different counts of the same letters return false"],
 kind="method",
 checks=[C("\"Listen\", \"Silent\"", "isAnagram(\"Listen\", \"Silent\")", "true"),
         C("\"Dormitory\", \"Dirty room\"", "isAnagram(\"Dormitory\", \"Dirty room\")", "true"),
         C("\"abc\", \"abd\"", "isAnagram(\"abc\", \"abd\")", "false"),
         C("\"aab\", \"abb\"", "isAnagram(\"aab\", \"abb\")", "false")]),

dict(topic="OOP Basics", task_type="write_code", difficulty="Medium", expected_minutes=5,
 question="Given the abstract class Worker below, write two subclasses. `FullTimeWorker(String name, double annualSalary)` pays annualSalary / 12 per month. `Contractor(String name, double hoursWorked, double hourlyRate)` pays hoursWorked x hourlyRate per month. Both constructors must pass the name to the Worker constructor using super, and both must override monthlyPay().",
 starter_code="""abstract class Worker {
    protected final String name;

    Worker(String name) {
        this.name = name;
    }

    abstract double monthlyPay();

    String summary() {
        return name + ": " + monthlyPay();
    }
}""",
 reference_solution="""class FullTimeWorker extends Worker {
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
}""",
 evaluation_points=["Both classes extend Worker", "Constructors call super(name) as the first statement", "monthlyPay is overridden with the correct formula", "Subclass-specific data stored in private fields", "summary() works without being rewritten (inherited)"],
 kind="toplevel", extra="""abstract class Worker {
    protected final String name;

    Worker(String name) {
        this.name = name;
    }

    abstract double monthlyPay();

    String summary() {
        return name + ": " + monthlyPay();
    }
}""",
 checks=[C("new FullTimeWorker(\"Mira\", 60000).monthlyPay()", "new FullTimeWorker(\"Mira\", 60000).monthlyPay()", "5000.0"),
         C("new Contractor(\"Leo\", 80, 25.5).monthlyPay()", "new Contractor(\"Leo\", 80, 25.5).monthlyPay()", "2040.0"),
         C("new FullTimeWorker(\"Mira\", 60000).summary()", "new FullTimeWorker(\"Mira\", 60000).summary()", "Mira: 5000.0"),
         C("Worker w = new Contractor(\"Ivy\", 10, 30); w.summary()", "w.summary()", "Ivy: 300.0", pre="Worker w = new Contractor(\"Ivy\", 10, 30);")]),

dict(topic="Recursion", task_type="fix_bug", difficulty="Medium", expected_minutes=4,
 question="sumFrom is meant to recursively return the sum of nums[index] through the end of the array, so sumFrom(nums, 0) sums the whole array. Calling it on any non-empty array ends in a StackOverflowError. Explain why the recursion never reaches its base case and write the corrected method.",
 starter_code="""public static int sumFrom(int[] nums, int index) {
    if (index == nums.length) {
        return 0;
    }
    return nums[index] + sumFrom(nums, index);
}""",
 reference_solution="""public static int sumFrom(int[] nums, int index) {
    if (index >= nums.length) {
        return 0;
    }
    return nums[index] + sumFrom(nums, index + 1);
}""",
 evaluation_points=["Identifies that index is never advanced, so the same call repeats forever", "Fix passes index + 1 in the recursive call", "Base case returns 0 at the end of the array", "Explains StackOverflowError as unbounded recursion depth"],
 kind="method",
 checks=[C("[1, 2, 3], 0", "sumFrom(new int[]{1, 2, 3}, 0)", "6"),
         C("[], 0", "sumFrom(new int[]{}, 0)", "0"),
         C("[5, -2, 4], 1", "sumFrom(new int[]{5, -2, 4}, 1)", "2")]),

dict(topic="Collections", task_type="complete_code", difficulty="Medium", expected_minutes=4,
 question="Complete expensiveProductNames using a single Java Stream pipeline. It must return the names of all products whose price is greater than or equal to minPrice, converted to upper case and sorted alphabetically, as a List<String>. The Product class (with getName() and getPrice()) is shown in the starter code.",
 starter_code="""class Product {
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
}""",
 reference_solution="""public static List<String> expensiveProductNames(List<Product> products, double minPrice) {
    return products.stream()
            .filter(p -> p.getPrice() >= minPrice)
            .map(p -> p.getName().toUpperCase())
            .sorted()
            .collect(Collectors.toList());
}""",
 evaluation_points=["filter with >= minPrice (inclusive)", "map to getName().toUpperCase()", "sorted() before collecting", "collect(Collectors.toList()) or .toList()", "Correct operation order; no loops mixed in"],
 kind="method", extra="""class Product {
    private final String name;
    private final double price;

    Product(String name, double price) {
        this.name = name;
        this.price = price;
    }

    String getName() { return name; }
    double getPrice() { return price; }
}""",
 checks=[C("[mouse 25, laptop 900, desk 150, cable 5], 100", "expensiveProductNames(List.of(new Product(\"mouse\", 25), new Product(\"laptop\", 900), new Product(\"desk\", 150), new Product(\"cable\", 5)), 100)", "[DESK, LAPTOP]"),
         C("[pen 10], 10 (boundary)", "expensiveProductNames(List.of(new Product(\"pen\", 10)), 10)", "[PEN]"),
         C("[], 1", "expensiveProductNames(new ArrayList<Product>(), 1)", "[]")]),

dict(topic="Strings", task_type="explain_output", difficulty="Medium", expected_minutes=4,
 question="Unlike String, StringBuilder is mutable. Follow each call on the StringBuilder below (append, insert, reverse, deleteCharAt) and write the exact output of the program, showing the builder's contents after every step.",
 starter_code="""public class Main {
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
}""",
 output="coder\nencoder\nredocne\n6\nedocne\n",
 explanation="StringBuilder methods change the same object. append(\"r\") gives \"coder\". insert(0, \"en\") puts \"en\" at the start: \"encoder\". reverse() reverses in place: \"redocne\". deleteCharAt(0) removes 'r', leaving \"edocne\" with length 6.",
 evaluation_points=["Correct output: coder, encoder, redocne, 6, edocne", "Explains StringBuilder is modified in place (mutable)", "Correct handling of insert at index 0", "Correct result of reverse and deleteCharAt"]),

dict(topic="Sorting/Searching", task_type="write_code", difficulty="Hard", expected_minutes=6,
 question="Write a method `public static int[][] mergeIntervals(int[][] intervals)` where each element is {start, end} with start <= end. Merge every group of overlapping intervals and return the result sorted by start. Intervals that touch (e.g. {1, 4} and {4, 5}) count as overlapping. The input may be in any order. Example: {{1,3},{8,10},{2,6},{15,18}} returns {{1,6},{8,10},{15,18}}.",
 reference_solution="""public static int[][] mergeIntervals(int[][] intervals) {
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
}""",
 evaluation_points=["Sorts intervals by start first", "Merges when next start <= current end (touching included)", "Extends the end with Math.max (handles fully contained intervals)", "Adds the last interval after the loop", "Handles empty input"],
 kind="method",
 checks=[C("[[1,3],[8,10],[2,6],[15,18]]", "Arrays.deepToString(mergeIntervals(new int[][]{{1, 3}, {8, 10}, {2, 6}, {15, 18}}))", "[[1, 6], [8, 10], [15, 18]]"),
         C("[[1,4],[4,5]]", "Arrays.deepToString(mergeIntervals(new int[][]{{1, 4}, {4, 5}}))", "[[1, 5]]"),
         C("[[1,10],[2,3]]", "Arrays.deepToString(mergeIntervals(new int[][]{{1, 10}, {2, 3}}))", "[[1, 10]]"),
         C("[]", "Arrays.deepToString(mergeIntervals(new int[][]{}))", "[]")]),

dict(topic="Exceptions", task_type="write_code", difficulty="Hard", expected_minutes=6,
 question="Write a checked exception class `OutOfStockException` (extends Exception, constructor takes a String message) and a class `Inventory` backed by a HashMap<String, Integer>. Inventory needs: `void addStock(String item, int qty)`; `void removeStock(String item, int qty) throws OutOfStockException`, which throws OutOfStockException with the message \"Not enough <item>: requested <qty>, available <n>\" when there is not enough stock (leaving stock unchanged); and `int getQuantity(String item)`, which returns 0 for unknown items. Both addStock and removeStock throw IllegalArgumentException if qty <= 0.",
 reference_solution="""class OutOfStockException extends Exception {
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
}""",
 evaluation_points=["OutOfStockException extends Exception and passes the message to super", "removeStock declares throws OutOfStockException", "Stock is unchanged when the exception is thrown", "Exact message format", "IllegalArgumentException for qty <= 0; getQuantity returns 0 for unknown items"],
 kind="toplevel",
 setup='Inventory inv = new Inventory(); inv.addStock("bolt", 10);',
 checks=[C("addStock(bolt,10); removeStock(bolt,4); getQuantity(bolt)", "inv.getQuantity(\"bolt\")", "6", pre="inv.removeStock(\"bolt\", 4);"),
         C("then removeStock(bolt,10)", "thrown(() -> inv.removeStock(\"bolt\", 10))", "OutOfStockException"),
         C("exception message", "msg", "Not enough bolt: requested 10, available 6",
           pre="String msg = \"none\"; try { inv.removeStock(\"bolt\", 10); } catch (OutOfStockException e) { msg = e.getMessage(); }"),
         C("stock unchanged after failure", "inv.getQuantity(\"bolt\")", "6"),
         C("getQuantity(\"nut\")", "inv.getQuantity(\"nut\")", "0"),
         C("addStock(nut, 0)", "thrown(() -> inv.addStock(\"nut\", 0))", "IllegalArgumentException")]),
]
