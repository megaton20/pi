// models/airtimeData.js

function generateUniqueNumericCode(length = 8) {
    const numbers = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return result;
  }
  


module.exports = generateUniqueNumericCode;