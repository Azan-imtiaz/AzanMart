# Deploying AzanMart

This guide deploys AzanMart to [Render](https://render.com) with a free
[MongoDB Atlas](https://www.mongodb.com/atlas) database. Railway works the
same way; the build and start commands are identical.

## 1. Create the database (MongoDB Atlas)

1. Create a free **M0** cluster.
2. Under **Database Access**, add a database user with a strong, generated password.
3. Under **Network Access**, allow `0.0.0.0/0`. Render's outgoing IPs change, and
   the database user's password is what protects the cluster.
4. Click **Connect → Drivers** and copy the connection string. Add a database
   name before the `?`, for example:

   ```
   mongodb+srv://azanmart:<password>@cluster0.xxxxx.mongodb.net/azanmart?retryWrites=true&w=majority
   ```

## 2. Create the web service (Render)

The repository includes a `render.yaml` blueprint.

1. In Render, choose **New → Blueprint** and select this repository.
2. Fill in the variables Render asks for:

   | Variable      | Value                                                 |
   | ------------- | ----------------------------------------------------- |
   | `MONGODB_URL` | the Atlas connection string from step 1               |
   | `APP_URL`     | your site's URL, e.g. `https://azanmart.onrender.com` |

   `SESSION_SECRET` is generated for you. Leave the Stripe and SMTP variables
   empty for now; the store works without them (cash on delivery only, emails
   written to the log). Step 5 sets up Gmail.

3. Deploy. Render runs `npm ci --include=dev && npm run build`, then `npm start`,
   and checks `/health` before sending traffic to the new version.

Prefer to set it up by hand? Create a **Web Service** with the same build and
start commands, set the health check path to `/health`, and add the variables
from `.env.example`.

> `APP_URL` must start with `https://` in production. It turns on secure
> cookies, HSTS and `upgrade-insecure-requests`, and it's used for links in
> emails, Stripe redirects, the sitemap and social previews.

## 3. Load demo data and create an admin

From your own machine, point the scripts at the Atlas database:

```bash
# Demo catalog, customers, orders and reviews. This deletes existing data!
MONGODB_URL="<atlas url>" NODE_ENV=development npm run seed

# Or, for a real store, just create your admin account
MONGODB_URL="<atlas url>" npm run create-admin -- you@example.com "a-strong-password" "Your Name"
```

## 4. Turn on card payments (optional)

1. In the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys), copy
   your **test** secret key into `STRIPE_SECRET_KEY`.
2. Under **Developers → Webhooks**, add an endpoint:
   - URL: `https://<your-domain>/webhooks/stripe`
   - Events: `checkout.session.completed`, `checkout.session.expired`,
     `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
3. Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

Test with card `4242 4242 4242 4242`, any future expiry date and any CVC.

To try webhooks locally, use the [Stripe CLI](https://docs.stripe.com/stripe-cli):

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

It prints a `whsec_...` secret to put in your local `.env`.

## 5. Send email with Gmail

AzanMart sends verification codes, order confirmations and shipping, delivery and
cancellation updates. Gmail works well for a small store (about 500 emails a day on a
normal Gmail account).

1. Sign in to the Gmail account the store should send from. Ideally, create a separate
   one for the shop.
2. Turn on **2-Step Verification**: https://myaccount.google.com/security
3. Create an **App Password**: https://myaccount.google.com/apppasswords. Name it
   "AzanMart" and copy the 16-character password. Google only shows it once. This is
   _not_ your normal Gmail password, and Gmail won't accept your normal password here.
4. Set these variables (in `.env` locally, or in Render's environment settings):

   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=yourshop@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop     # the App Password; spaces are fine
   MAIL_FROM="AzanMart <yourshop@gmail.com>"   # optional, defaults to SMTP_USER
   ```

5. Restart the app. The log should say:

   ```
   Email: sending through smtp.gmail.com as yourshop@gmail.com
   ```

   If it says `could not log in`, the App Password is wrong or 2-Step Verification is off.

Gmail always sends from the logged-in account, so customers see your Gmail address and
their replies reach your inbox. Any other SMTP provider (Brevo, Mailgun, Postmark…) works
the same way with its own host, port and credentials. Without `SMTP_HOST` and `SMTP_USER`,
emails aren't sent at all: each one is saved to a temporary HTML file and its path is logged.

> Keep the App Password out of git. It only belongs in `.env` (which is gitignored) or
> in your host's environment settings. If it ever leaks, delete it at
> https://myaccount.google.com/apppasswords and create a new one.

## Running with Docker

```bash
docker compose up --build
docker compose exec app npm run seed -- --force   # optional demo data
```

The app is then on http://localhost:3000, with MongoDB data kept in a Docker volume.

## Checklist before sharing the link

- [ ] `APP_URL` is the real `https://` address
- [ ] `/health` returns `{"status":"ok","db":"up"}`
- [ ] `/sitemap.xml` lists your products with the right domain
- [ ] You can log in, check out with cash on delivery, and see the order in `/admin/orders`
- [ ] If Stripe is on: a test card payment shows as **paid** in the admin area
