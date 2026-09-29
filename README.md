# AzanMart

> Everyday essentials, thoughtfully picked.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![EJS](https://img.shields.io/badge/Views-EJS-B4CA65)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

AzanMart is a server-side rendered e-commerce store built with **Express**, **EJS**, **MongoDB (Mongoose)** and **Tailwind CSS**.

Designed and developed by **Azan Imtiaz** · [GitHub](https://github.com/Azan-imtiaz) · [LinkedIn](https://www.linkedin.com/in/azan-imtiaz)

## Features

- User registration and login (bcrypt-hashed passwords, JWT in an HTTP-only cookie)
- Product listing and cart
- Owner (admin) login and product creation with image upload
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

### Creating the owner account

In development only, the first owner can be created once:

```bash
curl -X POST http://localhost:3000/owners/create \
  -H "Content-Type: application/json" \
  -d '{"fullname":"Admin","email":"admin@example.com","password":"change-me"}'
```

Then log in at `/owners/login` to add products.

## Project structure

```
config/        database and upload configuration
controllers/   request handlers
middlewares/   auth guards (users and owners)
models/        Mongoose schemas
routes/        Express routers
utils/         helpers (JWT generation)
views/         EJS templates
```

## License

[MIT](LICENSE) © Azan Imtiaz
