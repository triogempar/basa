/**
 * Auth0 Universal Login for Basa.
 *
 * Same shape as the Auth0 SPA quickstart:
 * https://auth0.com/docs/quickstart/spa/vanillajs
 *
 * Domain and Client ID are public. The server reads them from .env and
 * serves them at GET /api/auth-config. This file never uses a client secret.
 */

let auth0Client = null;

function normalizeDomain(domain) {
  return String(domain || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

async function loadAuthConfig() {
  const response = await fetch('/api/auth-config');
  if (!response.ok) {
    throw new Error('Could not load Auth0 config from the server.');
  }

  const config = await response.json();
  const domain = normalizeDomain(config.domain);
  const clientId = String(config.clientId || '').trim();

  if (!domain || !clientId) {
    throw new Error('Set AUTH0_DOMAIN and AUTH0_CLIENT_ID in .env, then restart the server.');
  }

  return { domain, clientId };
}

/**
 * Create the Auth0 client. If the browser just returned from Universal Login,
 * exchange the code and then drop ?code=&state= from the address bar.
 * Returns { isAuthenticated, user }.
 */
async function initAuth() {
  if (typeof auth0 === 'undefined' || typeof auth0.createAuth0Client !== 'function') {
    throw new Error('Auth0 SPA SDK failed to load.');
  }

  const { domain, clientId } = await loadAuthConfig();

  auth0Client = await auth0.createAuth0Client({
    domain,
    clientId,
    authorizationParams: {
      // Must be listed under Allowed Callback URLs in the Auth0 dashboard.
      redirect_uri: window.location.origin
    }
  });

  const params = new URLSearchParams(window.location.search);
  const cameBackFromAuth0 = (params.has('code') || params.has('error')) && params.has('state');

  if (cameBackFromAuth0) {
    try {
      await auth0Client.handleRedirectCallback();
    } finally {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  const isAuthenticated = await auth0Client.isAuthenticated();
  const user = isAuthenticated ? await auth0Client.getUser() : null;
  return { isAuthenticated, user };
}

async function login() {
  if (!auth0Client) {
    throw new Error('Auth0 is not ready yet.');
  }
  await auth0Client.loginWithRedirect();
}

function logout() {
  if (!auth0Client) return;
  auth0Client.logout({
    logoutParams: {
      // Must be listed under Allowed Logout URLs in the Auth0 dashboard.
      returnTo: window.location.origin
    }
  });
}

function isReady() {
  return Boolean(auth0Client);
}

window.BasaAuth = { initAuth, login, logout, isReady };
