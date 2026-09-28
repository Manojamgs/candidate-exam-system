'use strict';
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_PATH || path.join(__dirname, '..', '.env') });

const env = process.env;
const config = {
  env: env.NODE_ENV || 'development',
  port: parseInt(env.PORT || '3000', 10),
  host: env.HOST || '0.0.0.0',
  // APP_BASE_URL is used in exam links; on Render it defaults to the service's public https URL.
  baseUrl: (env.APP_BASE_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  dbPath: env.DB_PATH || path.join(__dirname, '..', 'data', 'exam.db'),
  // Used for encrypting secrets stored in the settings table and hashing tokens. MUST be set in production.
  appSecret: env.APP_SECRET || 'dev-only-insecure-secret-change-me',
  trustProxy: env.TRUST_PROXY === 'true' || !!env.RENDER, // behind Render's HTTPS load balancer
  secureCookies: env.SECURE_COOKIES === 'true' || env.NODE_ENV === 'production',
  tlsCert: env.TLS_CERT_PATH || '',
  tlsKey: env.TLS_KEY_PATH || '',
  disableBackgroundJobs: env.DISABLE_BACKGROUND_JOBS === 'true',
  initialAdmin: {
    username: env.ADMIN_USERNAME || 'admin',
    email: env.ADMIN_EMAIL || 'admin@example.com',
    password: env.ADMIN_PASSWORD || 'ChangeMe@123',
    fullName: env.ADMIN_FULL_NAME || 'System Administrator',
  },
  // Secrets read from the environment take precedence over values stored in Settings.
  secretsFromEnv: {
    'ai.anthropic_api_key': env.ANTHROPIC_API_KEY,
    'ai.openai_api_key': env.OPENAI_API_KEY,
    'google.service_account_json': env.GOOGLE_SERVICE_ACCOUNT_JSON,
    'sharepoint.client_secret': env.SHAREPOINT_CLIENT_SECRET,
    'email.smtp_password': env.SMTP_PASSWORD,
  },
  // Overridable service endpoints (used by tests / sovereign clouds)
  endpoints: {
    anthropic: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    openai: env.OPENAI_BASE_URL || 'https://api.openai.com',
    googleToken: env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
    googleSheets: env.GOOGLE_SHEETS_BASE_URL || 'https://sheets.googleapis.com',
    msLogin: env.MS_LOGIN_BASE_URL || 'https://login.microsoftonline.com',
    msGraph: env.MS_GRAPH_BASE_URL || 'https://graph.microsoft.com',
  },
};

if (config.env === 'production' && !env.ADMIN_PASSWORD) console.warn('WARNING: ADMIN_PASSWORD is not set – the first admin account would use the default password. Set it before first start.');
if (config.env === 'production' && config.appSecret.startsWith('dev-only')) {
  console.error('FATAL: APP_SECRET must be set in production.');
  process.exit(1);
}
module.exports = config;
