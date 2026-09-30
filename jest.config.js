module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/helpers/env.js"],
  testTimeout: 30000,
  collectCoverageFrom: [
    "app.js",
    "config/**/*.js",
    "controllers/**/*.js",
    "middlewares/**/*.js",
    "models/**/*.js",
    "routes/**/*.js",
    "services/**/*.js",
    "utils/**/*.js",
  ],
};
