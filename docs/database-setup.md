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

## Run Migrations

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