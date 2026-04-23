const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Philippe\\Documents\\PHSTATIC\\a22ura\\app\\communities\\[id]\\page.tsx', 'utf8');

function checkBalance(text) {
    let counts = {
        '{': 0,
        '}': 0,
        '(': 0,
        ')': 0,
        '[': 0,
        ']': 0,
        '<div': 0,
        '</div>': 0
    };
    
    // Simple state machine to avoid strings and comments
    let inString = null;
    let inComment = false;
    let i = 0;
    while (i < text.length) {
        const char = text[i];
        const next = text[i+1];
        
        if (inComment) {
            if (char === '*' && next === '/') { inComment = false; i++; }
            else if (char === '\n') { /* single line comment logic would go here if needed */ }
        } else if (inString) {
            if (char === inString) { inString = null; }
            else if (char === '\\') { i++; }
        } else {
            if (char === '/' && next === '/') { // skip line
                i = text.indexOf('\n', i);
                if (i === -1) break;
            } else if (char === '/' && next === '*') {
                inComment = true; i++;
            } else if (char === '"' || char === "'" || char === '`') {
                inString = char;
            } else {
                if (char === '{') counts['{']++;
                if (char === '}') counts['}']++;
                if (char === '(') counts['(']++;
                if (char === ')') counts[')']++;
                if (char === '[') counts['[']++;
                if (char === ']') counts[']']++;
                if (text.substring(i, i+4) === '<div') { counts['<div']++; i+=3; }
                if (text.substring(i, i+6) === '</div>') { counts['</div>']++; i+=5; }
            }
        }
        i++;
    }
    console.log(counts);
}

checkBalance(content);
