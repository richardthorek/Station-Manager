#!/bin/bash
# Validation script for machine-readable registry files
# Run this before committing changes to ensure JSON files are valid

set -e

echo "Validating machine-readable registry files..."

# Check if files exist
if [ ! -f "docs/api_register.json" ]; then
    echo "❌ ERROR: docs/api_register.json not found"
    exit 1
fi

if [ ! -f "docs/function_register.json" ]; then
    echo "❌ ERROR: docs/function_register.json not found"
    exit 1
fi

# Validate JSON syntax
echo "Checking JSON syntax..."

if ! node -e "JSON.parse(require('fs').readFileSync('docs/api_register.json', 'utf8'));" 2>/dev/null; then
    echo "❌ ERROR: docs/api_register.json is not valid JSON"
    exit 1
else
    echo "✓ docs/api_register.json is valid JSON"
fi

if ! node -e "JSON.parse(require('fs').readFileSync('docs/function_register.json', 'utf8'));" 2>/dev/null; then
    echo "❌ ERROR: docs/function_register.json is not valid JSON"
    exit 1
else
    echo "✓ docs/function_register.json is valid JSON"
fi

# Check required fields in api_register.json
echo "Validating api_register.json structure..."
node -e "
const data = JSON.parse(require('fs').readFileSync('docs/api_register.json', 'utf8'));
if (!data.version) throw new Error('Missing version field');
if (!data.endpoints) throw new Error('Missing endpoints field');
if (!data.definitions) throw new Error('Missing definitions field');
if (!data.socketEvents) throw new Error('Missing socketEvents field');
console.log('✓ api_register.json has required structure');
"

# Check required fields in function_register.json
echo "Validating function_register.json structure..."
node -e "
const data = JSON.parse(require('fs').readFileSync('docs/function_register.json', 'utf8'));
if (!data.version) throw new Error('Missing version field');
if (!data.services) throw new Error('Missing services field');
if (!data.routes) throw new Error('Missing routes field');
console.log('✓ function_register.json has required structure');
"

echo ""
echo "✅ All registry files validated successfully!"
exit 0
