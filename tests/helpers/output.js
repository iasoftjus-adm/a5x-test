const fs = require('fs');

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { writeJson };
