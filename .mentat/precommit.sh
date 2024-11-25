npx tsc -p tsconfig.server.json --noEmit --skipLibCheck
npm test -- --testPathIgnorePatterns="selenium"