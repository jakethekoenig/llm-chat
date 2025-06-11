#!/bin/bash

# Run TypeScript compilation check (ignore chrome type issues)
echo "🔍 Checking TypeScript compilation..."
npx tsc --noEmit 2>&1 | grep -v "Cannot find type definition file for 'chrome'" | grep -v "Entry point of type library 'chrome'"
ts_result=${PIPESTATUS[0]}

# Check if there are actual TypeScript errors (not just chrome config warnings)
if [ $ts_result -ne 0 ]; then
    error_count=$(npx tsc --noEmit 2>&1 | grep -v "Cannot find type definition file for 'chrome'" | grep -v "Entry point of type library 'chrome'" | grep "error TS" | wc -l)
    if [ $error_count -gt 0 ]; then
        echo "❌ TypeScript compilation failed"
        exit 1
    fi
fi

echo "🧪 Running tests..."
npm test
if [ $? -ne 0 ]; then
    echo "❌ Tests failed"
    exit 1
fi

echo "✅ All checks passed!"
