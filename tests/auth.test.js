const userModel = require("../models/userModel");
const { startDatabase, clearDatabase, stopDatabase } = require("./helpers/db");
const { createUser } = require("./helpers/factories");
const { app, request, csrfToken, loginAs, postForm } = require("./helpers/http");

beforeAll(startDatabase);
afterEach(clearDatabase);
afterAll(stopDatabase);

describe("registration", () => {
  it("creates an account, logs the user in and asks them to verify their email", async () => {
    const agent = request.agent(app);
    const _csrf = await csrfToken(agent, "/register");

    const res = await agent
      .post("/register")
      .type("form")
      .send({ _csrf, fullname: "Azan Imtiaz", email: "Azan@Example.com", password: "secret123" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/verify-email");

    const user = await userModel.findOne({ email: "azan@example.com" });
    expect(user).not.toBeNull();
    expect(user.password).not.toBe("secret123");
    expect(user.role).toBe("customer");
    expect(user.emailVerified).toBe(false);

    const account = await agent.get("/account");
    expect(account.status).toBe(200);
  });

  it("rejects an email that is already registered", async () => {
    const { user } = await createUser();
    const agent = request.agent(app);
    const _csrf = await csrfToken(agent, "/register");

    const res = await agent
      .post("/register")
      .type("form")
      .send({ _csrf, fullname: "Someone", email: user.email, password: "secret123" });

    expect(res.headers.location).toBe("/login");
    expect(await userModel.countDocuments()).toBe(1);
  });

  it("validates the form fields", async () => {
    const agent = request.agent(app);
    const _csrf = await csrfToken(agent, "/register");

    const res = await agent
      .post("/register")
      .type("form")
      .send({ _csrf, fullname: "A", email: "not-an-email", password: "123" });

    expect(res.headers.location).toBe("/register");
    expect(await userModel.countDocuments()).toBe(0);
  });
});

describe("login and logout", () => {
  it("logs in with the right password and sends admins to the dashboard", async () => {
    const admin = await createUser({ role: "admin" });
    const agent = await loginAs(admin);

    const res = await agent.get("/admin");
    expect(res.status).toBe(200);
  });

  it("rejects a wrong password", async () => {
    const { user } = await createUser();
    const agent = request.agent(app);
    const _csrf = await csrfToken(agent);

    const res = await agent
      .post("/login")
      .type("form")
      .send({ _csrf, email: user.email, password: "wrong-password" });

    expect(res.headers.location).toBe("/login");
    expect((await agent.get("/account")).headers.location).toBe("/login");
  });

  it("ends the session on logout", async () => {
    const agent = await loginAs(await createUser());

    await postForm(agent, "/logout");

    const res = await agent.get("/account");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("returns to the page the user originally asked for", async () => {
    const { user, password } = await createUser();
    const agent = request.agent(app);

    await agent.get("/wishlist"); // redirected to login, remembered
    const _csrf = await csrfToken(agent);
    const res = await agent
      .post("/login")
      .type("form")
      .send({ _csrf, email: user.email, password });

    expect(res.headers.location).toBe("/wishlist");
  });
});

describe("security", () => {
  it("rejects form posts without a CSRF token", async () => {
    const { user, password } = await createUser();

    const res = await request(app)
      .post("/login")
      .type("form")
      .send({ email: user.email, password });

    expect(res.status).toBe(403);
  });

  it("does not let an operator in the body match a user", async () => {
    await createUser();
    const agent = request.agent(app);
    const _csrf = await csrfToken(agent);

    const res = await agent
      .post("/login")
      .set("x-csrf-token", _csrf)
      .send({ email: { $ne: "x" }, password: { $ne: "x" } });

    expect(res.headers.location).toBe("/login");
    expect((await agent.get("/account")).status).toBe(302);
  });

  it("keeps customers out of the admin area", async () => {
    const agent = await loginAs(await createUser());

    const res = await agent.get("/admin");

    expect(res.status).toBe(403);
  });

  it("sends security headers", async () => {
    const res = await request(app).get("/");

    expect(res.headers["content-security-policy"]).toContain("script-src 'self'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
