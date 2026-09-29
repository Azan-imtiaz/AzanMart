# AzanMart

> Everyday essentials, thoughtfully picked.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![EJS](https://img.shields.io/badge/Views-EJS-B4CA65)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

AzanMart is a server-side rendered e-commerce store built with **Express**, **EJS**, **MongoDB (Mongoose)** and **Tailwind CSS**.

Designed and developed by **Azan Imtiaz** · [GitHub](https://github.com/Azan-imtiaz) · [LinkedIn](https://www.linkedin.com/in/azan-imtiaz)

## Features

- User registration and login (bcrypt-hashed passwords, JWT in an HTTP-only cookie)
- Product listing and cart
- Role-based admin area for adding products with image upload
- Flash messages for feedback

## Getting started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Setup

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # or: npm start
```

The app runs on `http://localhost:3000` by default.

### Environment variables

| Name                 | Description                            |
| -------------------- | -------------------------------------- |
| `NODE_ENV`           | `development` or `production`          |
| `PORT`               | Port to listen on (default `3000`)     |
| `MONGODB_URL`        | MongoDB connection string              |
| `SECRET_KEY`         | Secret used to sign JWTs               |
| `EXP_SESSION_SECRET` | Secret used to sign the session cookie |

### Creating an admin account

```bash
npm run create-admin -- admin@example.com "a-strong-password" "Your Name"
```

This creates the account, or promotes an existing user to admin. Log in normally and you will land on `/admin`.

## Project structure

```
config/        database and upload configuration
controllers/   request handlers
middlewares/   auth, validation, flash and error handling
models/        Mongoose schemas
routes/        Express routers
scripts/       one-off tasks (create an admin)
utils/         small helpers
views/         EJS templates
```

## License

[MIT](LICENSE) © Azan Imtiaz
