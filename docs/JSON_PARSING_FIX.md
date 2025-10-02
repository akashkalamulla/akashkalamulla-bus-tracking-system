# JSON Parsing Error Fix

## Problem
The application was encountering "Unexpected token i in JSON at position 0" errors, indicating invalid JSON was being received in request bodies. This error was being logged from `src/utils/logger.js` at line 29, but the root cause was inadequate JSON parsing validation.

## Solution
Created a centralized request parsing utility (`src/utils/request-parser.js`) that provides:

### Features
1. **Safe JSON Parsing**: Handles JSON parsing with comprehensive error handling
2. **Multiple Input Types**: Supports both string and object body formats (useful for testing)
3. **Validation**: Optional required field validation
4. **Detailed Error Messages**: Clear error responses for different failure scenarios
5. **Security**: Logs only safe snippets of request bodies to avoid exposing sensitive data

### API

#### `parseRequestBody(event)`
Safely parses the request body from a Lambda event object.

```javascript
const { parseRequestBody } = require('./utils/request-parser');

const result = parseRequestBody(event);
if (!result.success) {
  return result.error; // Returns proper HTTP error response
}
const body = result.data; // Parsed body object
```

#### `validateRequiredFields(body, requiredFields)`
Validates that parsed body contains required fields.

```javascript
const { validateRequiredFields } = require('./utils/request-parser');

const validation = validateRequiredFields(body, ['latitude', 'longitude']);
if (!validation.valid) {
  return validation.error;
}
```

#### `parseAndValidateBody(event, requiredFields)`
Combines parsing and validation in one step.

```javascript
const { parseAndValidateBody } = require('./utils/request-parser');

const result = parseAndValidateBody(event, ['latitude', 'longitude']);
if (!result.success) {
  return result.error;
}
const body = result.data;
```

## Implementation

### Updated Files

1. **`src/utils/request-parser.js`** (NEW)
   - Core parsing and validation utility
   - Handles all edge cases including invalid JSON, empty bodies, wrong types

2. **`src/handlers/location.js`** (UPDATED)
   - Replaced manual JSON parsing with `parseAndValidateBody` utility
   - Simplified code from ~30 lines to ~5 lines
   - Now validates required fields automatically

3. **`tests/utils/request-parser.test.js`** (NEW)
   - Comprehensive test suite for the parser utility
   - Tests all edge cases including the "Unexpected token i" scenario

## Error Scenarios Handled

| Scenario | Old Behavior | New Behavior |
|----------|-------------|--------------|
| Invalid JSON (`"invalid"`) | Crash or unclear error | HTTP 400 with "Invalid JSON format" |
| Empty body | Unclear error | HTTP 400 with "Request body is required" |
| Empty string body | May parse as empty object | HTTP 400 with "Request body cannot be empty" |
| Missing required fields | Checked after parsing | Checked automatically with clear message |
| Object body (testing) | Works | Works with explicit handling |
| Unsupported types (number, etc.) | Unclear error | HTTP 400 with "Unsupported request body format" |

## Testing

Run the tests to verify the fix:

```bash
npm test -- tests/utils/request-parser.test.js
```

## Migration Guide

To use this utility in other handlers:

1. Import the utility:
```javascript
const { parseAndValidateBody } = require('../utils/request-parser');
```

2. Replace manual parsing:
```javascript
// Old way
let body;
try {
  body = JSON.parse(event.body);
} catch (err) {
  return errorResponse(400, 'Invalid JSON');
}

// New way
const result = parseAndValidateBody(event, ['field1', 'field2']);
if (!result.success) {
  return result.error;
}
const body = result.data;
```

## Security Notes

- Only the first 100 characters of invalid request bodies are logged
- Error messages don't expose internal implementation details
- All parsing errors are caught and handled gracefully
- No sensitive data is leaked in error responses

## Performance

- Minimal overhead (single try-catch wrapper)
- No external dependencies
- Reusable across all Lambda handlers

## Future Improvements

Consider adding:
- Schema validation using Joi or similar
- Custom error messages per field
- Type coercion (e.g., string to number)
- Maximum body size validation
- Content-Type header validation
