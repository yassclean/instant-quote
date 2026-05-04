const fs = require('fs');

let maintenance = {};
let deepClean = {};
let moveInOut = {};
let tierMatrix = {};

for (let beds = 1; beds <= 6; beds++) {
    for (let baths = 1; baths <= 6; baths++) {
        const key = `${beds}-${baths}`;
        
        maintenance[key] = 150 + ((beds - 1) * 28) + ((baths - 1) * 37);
        deepClean[key] = 225 + ((beds - 1) * 41) + ((baths - 1) * 55);
        moveInOut[key] = 299 + ((beds - 1) * 56) + ((baths - 1) * 74);
        
        const baselineSqft = 700 + ((beds - 1) * 200) + ((baths - 1) * 150);
        
        let downTo = null;
        let upTo = null;
        
        if (baths > 1) {
            downTo = `${beds}-${baths - 1}`;
        } else if (beds > 1) {
            downTo = `${beds - 1}-${baths}`;
        }
        
        if (baths < 6) {
            upTo = `${beds}-${baths + 1}`;
        } else if (beds < 6) {
            upTo = `${beds + 1}-${baths}`;
        }
        
        tierMatrix[key] = {
            baselineSqft,
            downMax: Math.round(baselineSqft * 0.8),
            upMin: Math.round(baselineSqft * 1.2),
            downTo,
            upTo
        };
    }
}

// Convert objects to formatted strings
function formatPricing(obj) {
    let str = "{\n";
    for (let beds = 1; beds <= 6; beds++) {
        let row = "            ";
        for (let baths = 1; baths <= 6; baths++) {
            const key = `${beds}-${baths}`;
            row += `'${key}': ${obj[key]}`;
            if (!(beds === 6 && baths === 6)) row += ", ";
        }
        str += row + "\n";
    }
    str += "        }";
    return str;
}

function formatTierMatrix(obj) {
    let str = "{\n";
    for (let beds = 1; beds <= 6; beds++) {
        for (let baths = 1; baths <= 6; baths++) {
            const key = `${beds}-${baths}`;
            const m = obj[key];
            const downTo = m.downTo ? `'${m.downTo}'` : 'null';
            const upTo = m.upTo ? `'${m.upTo}'` : 'null';
            str += `        '${key}': { baselineSqft: ${m.baselineSqft}, downMax: ${m.downMax}, upMin: ${m.upMin}, downTo: ${downTo}, upTo: ${upTo} }`;
            if (!(beds === 6 && baths === 6)) {
                str += ",\n";
            } else {
                str += "\n";
            }
        }
    }
    str += "    }";
    return str;
}

const pricingCode = `    pricing: {
        maintenance: ${formatPricing(maintenance)},
        deepClean: ${formatPricing(deepClean)},
        moveInOut: ${formatPricing(moveInOut)}
    },`;

const tierCode = `    tierMatrix: ${formatTierMatrix(tierMatrix)},`;

// Replace in pricing-config.js
let configContent = fs.readFileSync('pricing-config.js', 'utf8');

configContent = configContent.replace(/    pricing: \{[\s\S]*?    \},/, pricingCode);
configContent = configContent.replace(/    tierMatrix: \{[\s\S]*?    \},/, tierCode);

fs.writeFileSync('pricing-config.js', configContent);
console.log('Successfully updated pricing-config.js');
