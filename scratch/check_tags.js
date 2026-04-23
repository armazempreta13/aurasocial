const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Philippe\\Documents\\PHSTATIC\\a22ura\\app\\communities\\[id]\\page.tsx', 'utf8');

function checkBalance(text) {
    let divCount = 0;
    let jsxCount = 0;
    const lines = text.split('\n');
    lines.forEach((line, i) => {
        const divOpens = (line.match(/<div/g) || []).length;
        const divCloses = (line.match(/<\/div>/g) || []).length;
        divCount += divOpens - divCloses;
        
        const jsxOpens = (line.match(/{[^{}]*\(&&/g) || []).length; // simple check for {cond && (
    });
    console.log('Final div balance:', divCount);
}

// Better check: just count tags properly
function countTags(text) {
    const tags = text.match(/<[a-zA-Z]+|<\/[a-zA-Z]+>/g) || [];
    let stack = [];
    tags.forEach(tag => {
        if (tag.startsWith('</')) {
            const tagName = tag.substring(2, tag.length - 1);
            if (stack.length > 0 && stack[stack.length - 1] === tagName) {
                stack.pop();
            } else {
                console.log('Mismatch! Found', tag, 'but stack has', stack[stack.length - 1]);
            }
        } else if (!tag.endsWith('/>')) {
            const tagName = tag.substring(1);
            stack.push(tagName);
        }
    });
    console.log('Final stack:', stack);
}

// But wait, it's TSX, so we have components too.
// Let's just count <div and </div>
const divOpens = (content.match(/<div/g) || []).length;
const divCloses = (content.match(/<\/div>/g) || []).length;
console.log('Divs: open=', divOpens, 'close=', divCloses);

const appLayoutOpens = (content.match(/<AppLayout/g) || []).length;
const appLayoutCloses = (content.match(/<\/AppLayout>/g) || []).length;
console.log('AppLayout: open=', appLayoutOpens, 'close=', appLayoutCloses);
