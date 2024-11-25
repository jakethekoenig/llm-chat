npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.server.json --noEmit
npx eslint . --fix
npm test