import 'dotenv/config';

export function validateNphiesTransport(baseUrl, env = process.env) {
  const url = new URL(baseUrl);
  if (url.protocol === 'https:') return;
  // The existing OBA sandbox supports HTTP. Preserve it only by explicit opt-in;
  // never silently switch credentials or requests to another NPHIES endpoint.
  if (url.protocol === 'http:' && env.NPHIES_ENVIRONMENT === 'sandbox' &&
      env.NPHIES_ALLOW_INSECURE_SANDBOX === 'true') return;
  throw new Error('NPHIES requires HTTPS. HTTP is allowed only with NPHIES_ENVIRONMENT=sandbox and NPHIES_ALLOW_INSECURE_SANDBOX=true (synthetic data only).');
}
