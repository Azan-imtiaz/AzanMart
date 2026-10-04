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
stripe listen \
  --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed \
  --forward-to localhost:3000/webhooks/stripe
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

## 6. Turn on crypto payments (optional)

Shoppers can pay in USDC from a wallet such as MetaMask. The server checks every payment on the
blockchain itself; there is no third-party payment provider.

1. Create a wallet for the store (for example a new MetaMask account) and copy its address.
   **Only the address goes on the server.** Never put a private key or seed phrase in `.env` or in
   your host's settings; the app never needs it.
2. Set `CRYPTO_RECEIVER_ADDRESS` to that address and redeploy. A **USDC (crypto)** option appears
   at checkout.

That's all for the demo: the defaults use **Base Sepolia**, a free test network. Test USDC comes
from the [Circle faucet](https://faucet.circle.com) and test ETH for fees from the
[Coinbase faucet](https://portal.cdp.coinbase.com/products/faucet).

| Variable                  | Default (Base Sepolia test network)          | Base mainnet (real money)                    |
| ------------------------- | -------------------------------------------- | -------------------------------------------- |
| `CRYPTO_RECEIVER_ADDRESS` | (required to turn crypto on)                 | your store wallet                            |
| `CRYPTO_CHAIN_ID`         | `84532`                                      | `8453`                                       |
| `CRYPTO_TOKEN_ADDRESS`    | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `CRYPTO_RPC_URL`          | `https://sepolia.base.org`                   | an RPC provider URL (Alchemy, Infura…)       |
| `CRYPTO_PUBLIC_RPC_URL`   | `https://sepolia.base.org`                   | `https://mainnet.base.org`                   |
| `CRYPTO_NETWORK_NAME`     | `Base Sepolia`                               | `Base`                                       |
| `CRYPTO_EXPLORER_URL`     | `https://sepolia.basescan.org`               | `https://basescan.org`                       |
| `CRYPTO_CONFIRMATIONS`    | `1`                                          | `3` or more                                  |

`CRYPTO_RPC_URL` is what the server uses to read the blockchain and may contain a private API key;
`CRYPTO_PUBLIC_RPC_URL` is the one shown to shoppers' wallets, so keep it a public endpoint.

Unpaid crypto orders are cancelled automatically 30 minutes after checkout (plus a 5-minute grace
period for payments already on their way), and their stock goes back on sale.

## 7. Turn on the AI assistant (optional)

1. Create an API key at [build.nvidia.com](https://build.nvidia.com) (click your profile, then **API Keys**).
2. Set `NVIDIA_API_KEY` and redeploy. An **Ask AI** button appears on every store page.

Each question costs a small amount of API usage. The assistant is limited to 20 questions per visitor
every 10 minutes, and you can watch your usage on build.nvidia.com. The model defaults to
`nvidia/nemotron-3-super-120b-a12b`; set `NVIDIA_MODEL` to use another one that supports tool calling.

## 8. Demo mode

`DEMO_MODE` is on unless you set it to `false`. It shows a banner saying payments run in test mode and,
at checkout, the Stripe test card and test-USDC instructions. Turn it off before taking real orders,
along with switching Stripe to live keys and crypto to mainnet.

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
- [ ] If crypto is on: a test USDC payment shows as **paid**, with a link to the transaction
- [ ] If the assistant is on: **Ask AI** answers a question with product cards
- [ ] `/features` and `/guide` load, and the demo banner is on or off as intended
