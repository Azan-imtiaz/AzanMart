const orderModel = require("../models/orderModel");
const userModel = require("../models/userModel");
const { startDatabase, clearDatabase, stopDatabase } = require("./helpers/db");
const { createUser, createProduct } = require("./helpers/factories");
const { loginAs, postForm } = require("./helpers/http");

jest.mock("../utils/mailer", () => ({ sendMail: jest.fn() }));
const { sendMail } = require("../utils/mailer");

beforeAll(startDatabase);
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(stopDatabase);

const address = {
  fullName: "Ayesha Khan",
  phone: "0300 7654321",
  line1: "44 Canal Road",
  city: "Lahore",
  postalCode: "54000",
  country: "Pakistan",
};

async function placeCodOrder() {
  const shopper = await createUser();
  const product = await createProduct({ name: "Navy Backpack", price: 6900 });
  await userModel.updateOne(
    { _id: shopper.user._id },
    { cart: [{ product: product._id, quantity: 1 }] },
  );
  const agent = await loginAs(shopper);
  await postForm(agent, "/checkout", { ...address, paymentMethod: "cod" }, "/checkout");

  const order = await orderModel.findOne().lean();
  const admin = await loginAs(await createUser({ role: "admin" }));
  const setStatus = (status, extra = {}) =>
    postForm(
      admin,
      `/admin/orders/${order.orderNumber}/status`,
      { status, ...extra },
      `/admin/orders/${order.orderNumber}`,
    );
  return { order, shopper, setStatus };
}

const lastMail = () => sendMail.mock.calls.at(-1)[0];

describe("order emails", () => {
  it("confirms the order with its items and delivery address", async () => {
    const { order, shopper } = await placeCodOrder();

    const mail = lastMail();
    expect(mail.to).toBe(shopper.user.email);
    expect(mail.subject).toContain(order.orderNumber);
    expect(mail.html).toContain("Navy Backpack");
    expect(mail.html).toContain("44 Canal Road");
  });

  it("sends the courier and tracking number when the order ships", async () => {
    const { setStatus } = await placeCodOrder();

    await setStatus("shipped", { carrier: "TCS", trackingNumber: "TCS-123456" });

    const mail = lastMail();
    expect(mail.subject).toMatch(/on its way/);
    expect(mail.html).toContain("TCS-123456");
    expect(mail.html).toContain("Cash on delivery");
    expect(mail.html).toContain("0300 7654321");
  });

  it("sends a receipt when a cash order is delivered", async () => {
    const { setStatus } = await placeCodOrder();

    await setStatus("shipped");
    await setStatus("delivered");

    const mail = lastMail();
    expect(mail.subject).toMatch(/delivered/);
    expect(mail.html).toContain("We received your cash payment");
  });

  it("tells the customer when an order is cancelled", async () => {
    const { setStatus } = await placeCodOrder();

    await setStatus("cancelled");

    const mail = lastMail();
    expect(mail.subject).toMatch(/cancelled/);
    expect(mail.html).toContain("haven't been charged");
  });

  it("doesn't email for internal steps like processing", async () => {
    const { setStatus } = await placeCodOrder();
    sendMail.mockClear();

    await setStatus("processing");

    expect(sendMail).not.toHaveBeenCalled();
  });
});
