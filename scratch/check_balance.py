
import sys

def check_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    braces = 0
    brackets = 0
    parens = 0
    tags = []
    
    for i, char in enumerate(content):
        if char == '{': braces += 1
        elif char == '}': braces -= 1
        elif char == '[': brackets += 1
        elif char == ']': brackets -= 1
        elif char == '(': parens += 1
        elif char == ')': parens -= 1
        
        if braces < 0: print(f"Extra }} at {i}")
        if brackets < 0: print(f"Extra ] at {i}")
        if parens < 0: print(f"Extra ) at {i}")

    print(f"Braces: {braces}, Brackets: {brackets}, Parens: {parens}")

check_balance(sys.argv[1])
