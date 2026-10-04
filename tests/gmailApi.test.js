// The Gmail API must be configured before the mailer is loaded
process.env.GMAIL_CLIENT_ID = "client-id";
process.env.GMAIL_CLIENT_SECRET = "client-secret";
process.env.GMAIL_REFRESH_TOKEN = "refresh-token";
process.env.MAIL_FROM = "AzanMart <shop@gmail.com>";

const { sendMail, checkMailer, emailEnabled } = require("../utils/mailer");
const { resetToken } = require("../utils/gmailApi");

// Stand-in for Google: the token endpoint and the Gmail send endpoint
const calls = [];
let sendStatus = 200;
global.fetch = jest.fn(async (url, options) => {
  calls.push({ url, options });
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return { ok: true, json: async () => ({ access_token: "access-1", expires_in: 3599 }) };
  }
  return {
    ok: sendStatus === 200,
    status: sendStatus,
    json: async () => (sendStatus === 200 ? { id: "msg-1" } : { error: { message: "Forbidden" } }),
  };
});

const sendCalls = () => calls.filter((call) => call.url.includes("/messages/send"));

beforeEach(() => {
  calls.length = 0;
  sendStatus = 200;
  resetToken();
});

describe("sending email through the Gmail API", () => {
  it("is used when the Google credentials are set", () => {
    expect(emailEnabled).toBe(true);
  });

  it("swaps the refresh token for an access token and sends the email", async () => {
    await sendMail({ to: "shopper@example.com", subject: "Your code: 123456", html: "<p>Hi</p>" });

    const tokenRequest = calls[0];
    expect(tokenRequest.options.body.get("refresh_token")).toBe("refresh-token");
    expect(tokenRequest.options.body.get("grant_type")).toBe("refresh_token");

    const [send] = sendCalls();
    expect(send.url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(send.options.headers.Authorization).toBe("Bearer access-1");
    const raw = Buffer.from(JSON.parse(send.options.body).raw, "base64url").toString();
    expect(raw).toContain("To: shopper@example.com");
    expect(raw).toContain("From: AzanMart <shop@gmail.com>");
    expect(raw).toContain("Subject: Your code: 123456");
  });

  it("reuses the access token until it expires", async () => {
    await sendMail({ to: "a@example.com", subject: "One", html: "1" });
    await sendMail({ to: "b@example.com", subject: "Two", html: "2" });

    expect(calls.filter((call) => call.url.includes("oauth2"))).toHaveLength(1);
    expect(sendCalls()).toHaveLength(2);
  });

  it("logs a failed send instead of throwing", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    sendStatus = 403;

    await expect(sendMail({ to: "a@example.com", subject: "Hi", html: "x" })).resolves.toBe(
      undefined,
    );

    expect(error.mock.calls[0][1]).toMatch(/Gmail API error 403: Forbidden/);
    error.mockRestore();
  });

  it("checks the credentials at startup", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});

    await checkMailer();

    expect(log).toHaveBeenCalledWith("Email: sending through the Gmail API");
    log.mockRestore();
  });
});
