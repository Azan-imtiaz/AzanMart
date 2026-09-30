const userModel = require("../models/userModel");
const { startDatabase, clearDatabase, stopDatabase } = require("./helpers/db");
const { createUser, createProduct } = require("./helpers/factories");
const { app, request, csrfToken, loginAs, postForm } = require("./helpers/http");

jest.mock("../utils/mailer", () => ({ sendMail: jest.fn() }));
const { sendMail } = require("../utils/mailer");

beforeAll(startDatabase);
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(stopDatabase);

// The code is in the subject line: "123456 is your AzanMart verification code"
const lastCode = () => {
  const codeMails = sendMail.mock.calls.filter(([mail]) => /verification code/.test(mail.subject));
  return codeMails.at(-1)[0].subject.slice(0, 6);
};

async function register(email = "new@example.com") {
  const agent = request.agent(app);
  const _csrf = await csrfToken(agent, "/register");
  const res = await agent
    .post("/register")
    .type("form")
    .send({ _csrf, fullname: "New Shopper", email, password: "secret123" });
  return { agent, res, email };
}

const submitCode = (agent, code) => postForm(agent, "/verify-email", { code }, "/verify-email");

describe("email verification", () => {
  it("emails a code on sign-up and stores only a hash of it", async () => {
    const { res, email } = await register();

    expect(res.headers.location).toBe("/verify-email");
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: email }));

    const code = lastCode();
    const user = await userModel.findOne({ email });
    expect(code).toMatch(/^\d{6}$/);
    expect(user.emailVerified).toBe(false);
    expect(user.emailCodeHash).not.toContain(code);
  });

  it("verifies the account with the right code", async () => {
    const { agent, email } = await register();

    const res = await submitCode(agent, lastCode());

    expect(res.headers.location).toBe("/shop");
    const user = await userModel.findOne({ email });
    expect(user.emailVerified).toBe(true);
    expect(user.emailCodeHash).toBeUndefined();
  });

  it("stops accepting codes after 5 wrong tries", async () => {
    const { agent, email } = await register();
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i++) await submitCode(agent, wrong);
    await submitCode(agent, code);

    expect((await userModel.findOne({ email })).emailVerified).toBe(false);
  });

  it("rejects an expired code and sends a new one", async () => {
    const { agent, email } = await register();
    const oldCode = lastCode();
    await userModel.updateOne(
      { email },
      {
        emailCodeExpires: new Date(Date.now() - 1000),
        emailCodeSentAt: new Date(Date.now() - 120000),
      },
    );

    await submitCode(agent, oldCode);

    expect((await userModel.findOne({ email })).emailVerified).toBe(false);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("limits how often a new code can be requested", async () => {
    const { agent } = await register();

    await postForm(agent, "/verify-email/resend", {}, "/verify-email");

    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("asks for a new verification when the email address changes", async () => {
    const account = await createUser();
    const agent = await loginAs(account);

    const res = await postForm(
      agent,
      "/account/profile",
      { fullname: account.user.fullName, email: "changed@example.com" },
      "/account",
    );

    expect(res.headers.location).toBe("/verify-email");
    const user = await userModel.findById(account.user._id);
    expect(user).toMatchObject({ email: "changed@example.com", emailVerified: false });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "changed@example.com" }));
  });
});

describe("checkout needs a verified email", () => {
  it("sends unverified shoppers to verify first, then back to checkout", async () => {
    const { agent, email } = await register();
    const product = await createProduct();
    await userModel.updateOne({ email }, { cart: [{ product: product._id, quantity: 1 }] });

    const blocked = await agent.get("/checkout");
    expect(blocked.headers.location).toBe("/verify-email");

    const verified = await submitCode(agent, lastCode());
    expect(verified.headers.location).toBe("/checkout");
    expect((await agent.get("/checkout")).status).toBe(200);
  });

  it("lets accounts from before verification existed check out", async () => {
    const account = await createUser();
    const product = await createProduct();
    await userModel.updateOne(
      { _id: account.user._id },
      { $unset: { emailVerified: 1 }, cart: [{ product: product._id, quantity: 1 }] },
    );
    const agent = await loginAs(account);

    expect((await agent.get("/checkout")).status).toBe(200);
  });
});
