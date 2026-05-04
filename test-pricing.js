const fs = require('fs');

// Read pricing-config.js
const configCode = fs.readFileSync('pricing-config.js', 'utf8');
// Evaluate the CONFIG object from the file
let code = configCode.replace('const CONFIG', 'global.CONFIG');
eval(code);
const CONFIG = global.CONFIG;

let hasErrors = false;

// Test all beds/baths from 1 to 6
for (let beds = 1; beds <= 6; beds++) {
    for (let baths = 1; baths <= 6; baths++) {
        const key = `${beds}-${baths}`;
        
        // Check maintenance
        if (CONFIG.pricing.maintenance[key] === undefined) {
            console.error(`Missing maintenance price for ${key}`);
            hasErrors = true;
        }
        
        // Check deep clean
        if (CONFIG.pricing.deepClean[key] === undefined) {
            console.error(`Missing deep clean price for ${key}`);
            hasErrors = true;
        }
        
        // Check move in/out
        if (CONFIG.pricing.moveInOut[key] === undefined) {
            console.error(`Missing move in/out price for ${key}`);
            hasErrors = true;
        }
        
        // Check tier matrix
        if (!CONFIG.tierMatrix[key]) {
            console.error(`Missing tier matrix for ${key}`);
            hasErrors = true;
        }
    }
}

if (!hasErrors) {
    console.log("All configurations up to 6-6 are valid.");
} else {
    process.exit(1);
}
