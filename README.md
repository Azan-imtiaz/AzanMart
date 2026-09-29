# ShopEase

A server-side rendered e-commerce platform built with **Express**, **EJS**, **MongoDB (Mongoose)** and **Tailwind CSS**.

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

| Name                 | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `NODE_ENV`           | `development` or `production`                        |
| `PORT`               | Port to listen on (default `3000`)                   |
| `MONGODB_URL`        | MongoDB connection string                            |
| `SECRET_KEY`         | Secret used to sign JWTs                             |
| `EXP_SESSION_SECRET` | Secret used to sign the session cookie               |

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
