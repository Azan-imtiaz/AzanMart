// Runs before each test file, before the app is loaded
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret";
process.env.APP_URL = "http://localhost:3000";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.SMTP_HOST;
