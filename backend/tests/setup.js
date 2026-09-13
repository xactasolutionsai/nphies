process.env.NODE_ENV = 'test';
process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:9';
process.env.NPHIES_BASE_URL = 'https://nphies.invalid';
process.env.JWT_SECRET = 'isolated-regression-secret-at-least-32-characters';
// Tests must stub upstream transports; no configured production endpoint is used.
if (process.env.TEST_VERBOSE !== 'true') console.log = () => {};
