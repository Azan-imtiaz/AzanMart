// The site is served over HTTPS behind a proxy (like Render), and NODE_ENV
// isn't "production". Must be set before the app is loaded.
process.env.APP_URL = "https://shop.example.com";

const { startDatabase, clearDatabase, stopDatabase } = require("./helpers/db");
const { createUser } = require("./helpers/factories");
const { app, request } = require("./helpers/http");

beforeAll(startDatabase);
afterEach(clearDatabase);
afterAll(stopDatabase);

describe("behind an HTTPS proxy", () => {
  it("sets a secure session cookie so forms and logins work", async () => {
    const { user, password } = await createUser();
    const agent = request.agent(app);

    const page = await agent.get("/login").set("X-Forwarded-Proto", "https");
    const cookie = page.headers["set-cookie"]?.find((c) => c.startsWith("azanmart.sid="));
    expect(cookie).toMatch(/; Secure/);

    const _csrf = page.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
    const res = await agent
      .post("/login")
      .set("X-Forwarded-Proto", "https")
      .set("Cookie", cookie.split(";")[0])
      .type("form")
      .send({ _csrf, email: user.email, password });

    expect(res.status).toBe(302);
  });
});
