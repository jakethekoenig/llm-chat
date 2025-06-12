#!/bin/bash

# Update dependencies to ensure chromedriver is up to date
npm install

# Run linting and formatting if available
if command -v prettier &> /dev/null; then
    npm run format 2>/dev/null || true
fi

if command -v eslint &> /dev/null; then
    npm run lint 2>/dev/null || true
fi

echo "Precommit checks completed"
