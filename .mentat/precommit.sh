npx tsc -p tsconfig.server.json --noEmit --skipLibCheck
npx eslint . --fix --ignore-pattern "**/*.stories.tsx"
npm test