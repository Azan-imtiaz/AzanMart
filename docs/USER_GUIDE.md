# AzanMart user guide

This guide explains how to use AzanMart, first as a shopper and then as a store admin.
For installing and deploying the app, see the [README](../README.md) and the
[deployment guide](DEPLOYMENT.md).

- [For shoppers](#for-shoppers)
  - [Browsing and searching](#browsing-and-searching)
  - [Your account](#your-account)
  - [Cart and wishlist](#cart-and-wishlist)
  - [Checking out](#checking-out)
  - [Orders and emails](#orders-and-emails)
  - [Reviews](#reviews)
- [For store admins](#for-store-admins)
  - [Getting admin access](#getting-admin-access)
  - [The dashboard](#the-dashboard)
  - [Managing products](#managing-products)
  - [Processing orders](#processing-orders)
  - [Managing users](#managing-users)
  - [Moderating reviews](#moderating-reviews)
- [Troubleshooting](#troubleshooting)

---

## For shoppers

### Browsing and searching

You don't need an account to browse. From the home page you can jump into a category or open
**Shop** to see everything.

![Shop page](screenshots/shop.webp)

On the shop page you can:

| To…                 | Do this                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Search              | Type in the search box (top of every page on larger screens, or in the filters). It matches product names, categories and descriptions. |
| Filter by category  | Pick a category in the filters panel, or click a category on the home page.                                                             |
| Set a price range   | Enter a minimum and/or maximum price in dollars, then **Apply**.                                                                        |
| See only deals      | Tick **On sale**.                                                                                                                       |
| Hide sold-out items | Tick **In stock only**.                                                                                                                 |
| Change the order    | Use **Sort by**: newest, price low→high, price high→low or top rated. When you search, the best matches come first.                     |
| Start over          | Click **Clear**.                                                                                                                        |

On a phone, the filters are folded into a **Filters** panel above the products. Tap it to open it.

Each product card shows the price (with the original price crossed out when it's on sale), its
rating and a **+** button to add it to your cart. Click a product to open its page, where you can
flip through its photos, read the description and reviews, choose a quantity, and see how many are
left when stock is low.

### Your account

- **Sign up:** click **Sign up** and enter your name, email and a password (at least 6 characters).
  You're logged in straight away, and we email you a **6-digit code** to confirm your address.
- **Verify your email:** type the code on the **Check your email** page. Codes last 10 minutes; if
  one expires or doesn't arrive (check spam), click **send a new code** (once a minute at most). You
  can browse and fill your cart before verifying, but you need a verified email to place an order.
  After 5 wrong codes, ask for a new one.
- **Log in / log out:** use **Log in** in the header. To log out, open the menu under your name and
  choose **Log out**.
- **Forgot your password?** On the login page click **Forgot password?** and enter your email.
  You'll receive a link that lets you choose a new password. The link works once and expires after
  one hour.
- **Account settings:** open the menu under your name and choose **Account**. There you can change
  your name, email and password (you'll need your current password). A new email address has to be
  verified with a code, just like at sign-up.
- **Dark mode:** click the moon or sun icon in the header. AzanMart remembers your choice; until you
  pick one, it follows your device's setting.

### Cart and wishlist

![Cart](screenshots/cart.webp)

- **Add to cart:** use the **+** button on a product card, or choose a quantity and click
  **Add to cart** on the product page. You need to be logged in; if you aren't, you'll be asked to
  log in first.
- **Change quantities:** on the **Cart** page, change the number next to an item. It updates
  straight away. **Remove** takes the item out.
- **Stock limits:** you can't add more than is in stock. If an item sells out, or its stock drops
  below the amount in your cart, the cart tells you what to fix before you can check out.
- **Shipping:** orders of $50 or more ship free; below that, shipping is $5. The cart shows how much
  more you need for free shipping.
- **Wishlist:** tap the heart on any product to save it for later. Open **Wishlist** from the menu
  under your name to see saved items. Tap the heart again to remove one.

### Checking out

![Checkout](screenshots/checkout.webp)

1. From your cart, click **Checkout**.
2. Enter your shipping address. Next time it will be filled in from your last order.
3. Choose how to pay:
   - **Card:** you'll be taken to Stripe's secure payment page. AzanMart never sees your card
     details. When the payment goes through, you come back to your order page. If you cancel,
     your items stay in your cart. An unfinished card payment is released after 30 minutes.
   - **Cash on delivery:** pay the courier when your order arrives.
4. Click **Place order**.

The items are reserved for you the moment you place the order, so nobody else can buy the last one
while you're paying.

> The card option only appears when the store owner has connected Stripe. In test mode, use card
> `4242 4242 4242 4242`, any future expiry date and any CVC.

### Orders and emails

![Order page](screenshots/order.webp)

- **My orders** (in the menu under your name) lists every order with its status and total. Click one
  to see its items, shipping address, payment details and a **delivery timeline**. Once it ships,
  the timeline shows the courier and tracking number.
- We email you at every step:

  | Email           | When                                                      | What's in it                                                |
  | --------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
  | Order confirmed | You place a cash order, or your card payment goes through | Items, total and delivery address                           |
  | On its way      | The order ships                                           | Courier, tracking number, and the cash amount to have ready |
  | Delivered       | The order arrives                                         | Delivery date, a receipt for cash payments, review links    |
  | Cancelled       | The order is cancelled                                    | Whether you'll be refunded or weren't charged               |

- Order statuses mean:

  | Status     | Meaning                                       |
  | ---------- | --------------------------------------------- |
  | Pending    | Waiting for your card payment to be confirmed |
  | Processing | Confirmed and being prepared                  |
  | Shipped    | On its way to you                             |
  | Delivered  | Arrived                                       |
  | Cancelled  | Cancelled; any items were returned to stock   |

### Reviews

On a product page, scroll to **Reviews**, pick 1 to 5 stars, optionally add a comment and click
**Post review**. You can review each product once. Posting again updates your review, and you can
delete it at any time. Reviews from people who ordered the product show a **Verified purchase** badge.

---

## For store admins

### Getting admin access

The first admin account is created from the command line:

```bash
npm run create-admin -- you@example.com "a-strong-password" "Your Name"
```

This creates the account, or upgrades an existing one. Log in normally and you'll land on the admin
dashboard. After that, you can make other people admins from **Users**.

If you ran `npm run seed`, the demo admin is `admin@azanmart.dev` / `Admin@12345`.

The admin area is at `/admin`, also reachable from **Admin** in the menu under your name. The sidebar
links to **Dashboard**, **Products**, **Orders**, **Users** and back to the store.

### The dashboard

![Admin dashboard](screenshots/admin-dashboard.webp)

- **Revenue:** the total of all paid orders. Card orders count once Stripe confirms payment; cash on
  delivery orders count once you mark them delivered.
- **Orders, Customers, Products:** simple counts.
- **Revenue, last 30 days:** daily totals for paid orders. Hover over the line to see a day's figure.
- **Best sellers:** the five products with the most units sold (cancelled orders excluded).
- **Orders by status:** how many orders are at each stage.
- **Recent orders** and **Low stock** (products with 5 or fewer left) link straight to the order or product.

Every chart has a **Show as table** link if you prefer the numbers.

### Managing products

**Products** lists everything in the catalog, newest first, with a search box for product names.

**To add a product,** click **Add product** and fill in:

| Field           | Notes                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name            | Also used to create the product's web address, e.g. `/products/navy-backpack`. The address doesn't change if you rename the product later, so links keep working. |
| Description     | Shown on the product page and used by search. Line breaks are kept.                                                                                               |
| Category        | Backpacks, Totes, Travel or Accessories.                                                                                                                          |
| Stock           | How many you have. Customers can't order more than this.                                                                                                          |
| Price (USD)     | The full price, at least $0.50.                                                                                                                                   |
| Discount (%)    | 0 to 90. The sale price is worked out for you and shown with the original crossed out.                                                                            |
| Images          | 1 to 4 JPEG, PNG, WebP or GIF files, up to 2 MB each. They're resized and converted to WebP automatically. The first image is the main one.                       |
| Card background | The colour behind the product photo on cards and the product page.                                                                                                |

**To edit a product,** click **Edit**. Leave the image field empty to keep the current photos;
uploading new ones replaces all of them.

**To delete a product,** click **Delete** and confirm. It's removed from shoppers' carts and
wishlists. Past orders keep their own copy of the name and price, so order history isn't affected.

### Processing orders

![Order management](screenshots/admin-orders.webp)

**Orders** lists all orders, newest first. Filter by status or search by order number (with or
without the `AZM-` prefix). Click an order to see its items, customer, address and payment.

Use **Update status** on the order page to move it along. When you mark an order as **Shipped**,
fill in the **courier** (common ones are suggested as you type) and the **tracking number**. They're
shown to the customer on their order page and included in the shipping email.

| Change to  | What happens                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Processing | Marks the order as being prepared.                                                                                                           |
| Shipped    | Emails the customer that their order is on its way.                                                                                          |
| Delivered  | Final. For cash on delivery, the order is also marked as paid.                                                                               |
| Cancelled  | Final. Emails the customer and puts the items back into stock. For a card order that was already paid, refund it from your Stripe dashboard. |

Delivered and cancelled orders can't be changed again.

Card orders you see as **Pending** are waiting for Stripe. They become **Processing** automatically
when payment is confirmed, or **Cancelled** (with stock returned) if the customer doesn't pay within
30 minutes.

### Managing users

**Users** lists every account with the number of orders and total spent (cancelled orders
excluded). Search by name or email. Use the **Role** menu to make someone an admin or turn them back
into a customer. The change takes effect on their next click. You can't change your own role, so you
can't lock yourself out by accident.

### Moderating reviews

Admins see a **Remove (admin)** link under each review on product pages. Removing a review updates the
product's average rating straight away.

---

## Troubleshooting

**"This form has expired. Please refresh the page and try again."**
Forms carry a security token tied to your session. If you left a page open for a long time, or logged
in or out in another tab, refresh the page and submit again.

**"Too many attempts. Please wait 15 minutes and try again."**
Logins, sign-ups and password resets are limited to 10 tries per 15 minutes to stop password guessing.

**I didn't get an email or verification code.**
Check your spam folder, then use **send a new code** on the verification page. If nobody is getting
emails, check the server log at startup: it says whether it could log in to Gmail (see
[Send email with Gmail](DEPLOYMENT.md#5-send-email-with-gmail)). On a development setup without SMTP
settings, emails aren't sent; the log prints the path of an HTML copy of each email instead.

**The card payment option is missing.**
The store owner hasn't set `STRIPE_SECRET_KEY` yet. Cash on delivery still works.

**An item disappeared from my cart.**
The product was removed from the store. Your past orders are not affected.
