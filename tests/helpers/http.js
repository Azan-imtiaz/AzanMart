const request = require("supertest");
const app = require("../../app");

// Reads the CSRF token out of a rendered form, like a browser would submit it
async function csrfToken(agent, path = "/login") {
  const res = await agent.get(path);
  const match = res.text.match(/name="_csrf" value="([a-f0-9]+)"/);
  if (!match) throw new Error(`No CSRF token on ${path} (status ${res.status})`);
  return match[1];
}

// A logged-in browser-like agent that keeps cookies between requests
async function loginAs({ user, password }) {
  const agent = request.agent(app);
  const _csrf = await csrfToken(agent);
  const res = await agent.post("/login").type("form").send({ _csrf, email: user.email, password });
  if (res.status !== 302) throw new Error(`Login failed with status ${res.status}`);
  return agent;
}

// Posts a form with a fresh CSRF token taken from `formPage`
async function postForm(agent, url, data = {}, formPage = "/shop") {
  const _csrf = await csrfToken(agent, formPage);
  return agent
    .post(url)
    .type("form")
    .send({ _csrf, ...data });
}

module.exports = { app, request, csrfToken, loginAs, postForm };
