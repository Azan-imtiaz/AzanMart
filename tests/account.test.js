const bcrypt = require("bcrypt");
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

describe("account settings", () => {
  it("changes the password only with the current one", async () => {
    const account = await createUser({ password: "oldpass1" });
    const agent = await loginAs(account);
    const change = (currentPassword) =>
      postForm(
        agent,
        "/account/password",
        { currentPassword, newPassword: "newpass1", confirmPassword: "newpass1" },
        "/account",
      );

    await change("wrong");
    expect(
      await bcrypt.compare("oldpass1", (await userModel.findById(account.user._id)).password),
    ).toBe(true);

    await change("oldpass1");
    expect(
      await bcrypt.compare("newpass1", (await userModel.findById(account.user._id)).password),
    ).toBe(true);
  });

  it("won't take an email another account uses", async () => {
    const { user: other } = await createUser();
    const account = await createUser();
    const agent = await loginAs(account);

    await postForm(
      agent,
      "/account/profile",
      { fullname: "New Name", email: other.email },
      "/account",
    );

    expect((await userModel.findById(account.user._id)).email).toBe(account.user.email);
  });
});

describe("wishlist", () => {
  it("toggles a product on and off", async () => {
    const account = await createUser();
    const product = await createProduct();
    const agent = await loginAs(account);

    await postForm(agent, `/wishlist/${product._id}`);
    expect((await userModel.findById(account.user._id)).wishlist).toHaveLength(1);

    await postForm(agent, `/wishlist/${product._id}`);
    expect((await userModel.findById(account.user._id)).wishlist).toHaveLength(0);
  });
});

describe("password reset", () => {
  async function requestReset(email) {
    const agent = request.agent(app);
    const _csrf = await csrfToken(agent, "/forgot-password");
    const res = await agent.post("/forgot-password").type("form").send({ _csrf, email });
    return { agent, res };
  }

  const linkFromEmail = () =>
    sendMail.mock.calls[0][0].html.match(/\/reset-password\/([a-f0-9]{64})/)[1];

  it("answers the same way whether or not the account exists", async () => {
    const { user } = await createUser();

    const unknown = await requestReset("nobody@example.com");
    const known = await requestReset(user.email);

    expect(unknown.res.headers.location).toBe(known.res.headers.location);
    await new Promise((resolve) => setImmediate(resolve));
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("stores only a hash of the token and resets the password once", async () => {
    const { user } = await createUser({ password: "forgotten1" });
    const { agent } = await requestReset(user.email);
    await new Promise((resolve) => setImmediate(resolve));
    const token = linkFromEmail();

    const stored = await userModel.findById(user._id);
    expect(stored.passwordResetHash).toBeDefined();
    expect(stored.passwordResetHash).not.toBe(token);

    const _csrf = await csrfToken(agent, `/reset-password/${token}`);
    const res = await agent
      .post(`/reset-password/${token}`)
      .type("form")
      .send({ _csrf, password: "brandnew1", confirmPassword: "brandnew1" });

    expect(res.headers.location).toBe("/login");
    const updated = await userModel.findById(user._id);
    expect(await bcrypt.compare("brandnew1", updated.password)).toBe(true);
    expect(updated.passwordResetHash).toBeUndefined();

    // The link can't be used a second time
    const reuse = await agent.get(`/reset-password/${token}`);
    expect(reuse.headers.location).toBe("/forgot-password");
  });

  it("rejects expired links", async () => {
    const { user } = await createUser();
    await requestReset(user.email);
    await new Promise((resolve) => setImmediate(resolve));
    const token = linkFromEmail();
    await userModel.updateOne(
      { _id: user._id },
      { passwordResetExpires: new Date(Date.now() - 1000) },
    );

    const res = await request(app).get(`/reset-password/${token}`);

    expect(res.headers.location).toBe("/forgot-password");
  });
});
