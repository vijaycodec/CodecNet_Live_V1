// Test phone number formatting in user service

const testCases = [
  { input: '+91 9876543210', expected: '+91 9876543210', description: 'Correctly formatted' },
  { input: '+919876543210', expected: '+91 9876543210', description: 'No space' },
  { input: '+91  9876543210', expected: '+91 9876543210', description: 'Extra space' },
  { input: '+1 234567890', expected: '+1 234567890', description: 'US number' },
  { input: '+1234567890', expected: '+1 234567890', description: 'US number no space' },
  { input: '+44 7911123456', expected: '+44 7911123456', description: 'UK number' },
  { input: '+9198 76543210', expected: '+91 9876543210', description: 'Space in wrong place' },
  { input: '+91-9876543210', expected: '+91 9876543210', description: 'With dash' },
  { input: '+91(98)76543210', expected: '+91 9876543210', description: 'With parentheses' },
];

const formatPhoneNumber = (phone) => {
  if (!phone) return phone;

  // Remove all spaces, dashes, and parentheses
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // If it doesn't start with +, assume it needs country code
  if (!cleaned.startsWith('+')) {
    throw new Error('Phone number must include country code starting with +');
  }

  // Extract country code and number
  // Try matching longer country codes first (3, 2, then 1 digit)
  // This ensures we match the most specific country code
  let match = cleaned.match(/^\+([1-9]\d{2})(\d{6,14})$/);  // 3-digit country code (e.g., +123)
  if (!match) {
    match = cleaned.match(/^\+([1-9]\d)(\d{7,14})$/);  // 2-digit country code (e.g., +91)
  }
  if (!match) {
    match = cleaned.match(/^\+([1-9])(\d{10})$/);  // 1-digit country code with exactly 10 digits (e.g., +1 for US/Canada)
  }

  if (!match) {
    throw new Error('Invalid phone number format. Expected: +<country code> <mobile number>');
  }

  const [, countryCode, number] = match;

  // Return formatted: "+<country code> <mobile number>"
  return `+${countryCode} ${number}`;
};

console.log('Testing phone number formatting:\n');
let passed = 0;
let failed = 0;

testCases.forEach(test => {
  try {
    const result = formatPhoneNumber(test.input);
    if (result === test.expected) {
      console.log(`✅ ${test.description}: "${test.input}" → "${result}"`);
      passed++;
    } else {
      console.log(`❌ ${test.description}: Expected "${test.expected}", got "${result}"`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.description}: Error - ${error.message}`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
