# Database Setup

## Install Sequelize and Sequelize CLI

```bash
npm install --save sequelize
npm install --save-dev sequelize-cli
```

## Initialize Sequelize

```bash
npx sequelize-cli init
## Generate Migrations

```bash
npx sequelize-cli migration:generate --name create-tables
```

Note: Sequelize CLI does not automatically generate migrations from models. You need to manually create migration files using the `sequelize-cli migration:generate` command.

## Automatic Migrations with `sequelize-auto-migrations`

To simplify the migration process, you can use `sequelize-auto-migrations`, which can infer changes from your model structures.

### Install `sequelize-auto-migrations`

```bash
npm install --save-dev sequelize-auto-migrations
```

### Add Scripts to `package.json`

```json
"scripts": {
  "makemigration": "node ./node_modules/sequelize-auto-migrations/bin/makemigration.js",
  "runmigration": "node ./node_modules/sequelize-auto-migrations/bin/runmigration.js"
}
```

### Generate and Run Migrations

```bash
npm run makemigration
npm run runmigration
```

This tool will compare your current models with the state of your database and generate appropriate migration files. It's not perfect and may require some manual tweaking for complex changes, but it can significantly reduce the amount of manual migration writing for simple additive changes like adding columns or tables.

## Run Migrations

```bash
npx sequelize-cli db:migrate
```
```bash
npx sequelize-cli db:migrate
```
```bash
npx sequelize-cli db:migrate
```

## Database Configuration

Ensure your `.env` file contains the correct database URL:

```env
DATABASE_URL=postgres://user:password@localhost:5432/mydatabase
```

For SQLite, you can use:

```env
DATABASE_URL=sqlite:///./test.db
```