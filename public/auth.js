/**
 * Auth0 Universal Login for Basa.
 *
 * Same shape as the official vanilla JavaScript quickstart:
 * https://auth0.com/docs/quickstart/spa/vanillajs
 *
 *   1. Read the public domain and client id from GET /api/config.
 *   2. Create one Auth0 SPA client (Authorization Code + PKCE).
 *   3. If Auth0 just redirected back, finish that callback.
 *   4. Show the profile when logged in, or a Log in button when not.
 *
 * There is no client secret. The chat UI stays closed until login.
 */

const authUi = {
  app: document.getElementById('appContainer'),
  status: document.getElementById('authStatus'),
  error: document.getElementById('authError'),
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  userName: document.getElementById('userName'),
  userAvatar: document.getElementById('userAvatar'),
  userFallback: document.getElementById('userFallback')
};

let auth0Client = null;

document.addEventListener('DOMContentLoaded', () => {
  authUi.loginBtn.addEventListener('click', onLogin);
  authUi.logoutBtn.addEventListener('click', onLogout);
  initAuth();
});

async function initAuth() {
  setStatus('Checking your session...');

  try {
    if (!window.auth0 || typeof window.auth0.createAuth0Client !== 'function') {
      throw new Error('The Auth0 SDK did not load. Check your connection and refresh the page.');
    }

    const config = await loadAuthConfig();

    // redirect_uri is the origin only, for example http://localhost:3000
    // with no path and no trailing slash. Allowed Callback URLs must match it.
    auth0Client = await window.auth0.createAuth0Client({
      domain: config.domain,
      clientId: config.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin
      }
    });

    await completeRedirectIfNeeded();

    if (await auth0Client.isAuthenticated()) {
      showLoggedIn(await auth0Client.getUser());
      return;
    }

    showLoggedOut();
  } catch (err) {
    console.error('Auth0 init error:', err);
    showAuthError(readableAuthError(err));
  }
}

async function loadAuthConfig() {
  const res = await fetch('/api/config');
  let data = {};
  try {
    data = await res.json();
  } catch (parseErr) {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.error || 'Could not load Auth0 configuration.');
  }
  if (!data.domain || !data.clientId) {
    throw new Error('Auth0 configuration is incomplete.');
  }
  return data;
}

async function completeRedirectIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  const cameBackFromAuth0 = (params.has('code') || params.has('error')) && params.has('state');
  if (!cameBackFromAuth0) return;

  try {
    await auth0Client.handleRedirectCallback();
  } catch (err) {
    console.error('Auth0 redirect error:', err);
    showAuthError(readableAuthError(err), true);
  } finally {
    window.history.replaceState({}, document.title, window.location.pathname || '/');
  }
}

async function onLogin() {
  if (!auth0Client) return;

  authUi.loginBtn.disabled = true;
  authUi.loginBtn.textContent = 'Redirecting...';
  clearAuthError();

  try {
    await auth0Client.loginWithRedirect();
  } catch (err) {
    console.error('Login error:', err);
    authUi.loginBtn.disabled = false;
    authUi.loginBtn.textContent = 'Log in';
    showAuthError(readableAuthError(err), true);
  }
}

async function onLogout() {
  if (!auth0Client) return;

  authUi.logoutBtn.disabled = true;
  try {
    // returnTo must match an Allowed Logout URL exactly (no trailing slash).
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  } catch (err) {
    console.error('Logout error:', err);
    authUi.logoutBtn.disabled = false;
    const message = readableAuthError(err);
    const banner = document.getElementById('errorBanner');
    const messageEl = document.getElementById('errorMessage');
    if (banner && messageEl) {
      messageEl.textContent = message;
      banner.classList.remove('hidden');
    }
  }
}

function showLoggedIn(user) {
  if (typeof window.startBasaApp !== 'function') {
    showAuthError('The app failed to start after login. Refresh the page.');
    return;
  }

  renderProfile(user || {});
  document.getElementById('headerActions').inert = false;
  document.getElementById('chatContainer').inert = false;
  document.getElementById('chatFooter').inert = false;
  authUi.app.classList.add('is-logged-in');
  window.startBasaApp();
}

function showLoggedOut() {
  authUi.app.classList.remove('is-logged-in');
  authUi.loginBtn.disabled = false;
  authUi.loginBtn.textContent = 'Log in';
  authUi.loginBtn.classList.remove('hidden');
  setStatus('');
}

function showAuthError(message, canRetry) {
  authUi.error.textContent = message;
  authUi.error.classList.remove('hidden');
  setStatus('');

  if (canRetry && auth0Client) {
    authUi.loginBtn.disabled = false;
    authUi.loginBtn.textContent = 'Log in';
    authUi.loginBtn.classList.remove('hidden');
  }
}

function clearAuthError() {
  authUi.error.textContent = '';
  authUi.error.classList.add('hidden');
}

function setStatus(text) {
  if (!text) {
    authUi.status.textContent = '';
    authUi.status.classList.add('hidden');
    return;
  }

  authUi.status.textContent = text;
  authUi.status.classList.remove('hidden');
}

function renderProfile(user) {
  const name = user.name || user.nickname || user.email || 'Signed in';
  authUi.userName.textContent = name;

  const showFallback = () => {
    authUi.userAvatar.classList.add('hidden');
    authUi.userFallback.textContent = name.trim().charAt(0).toUpperCase() || '?';
    authUi.userFallback.classList.remove('hidden');
  };

  if (user.picture) {
    authUi.userAvatar.onload = () => {
      authUi.userAvatar.classList.remove('hidden');
      authUi.userFallback.classList.add('hidden');
    };
    authUi.userAvatar.onerror = showFallback;
    authUi.userAvatar.alt = name;
    authUi.userAvatar.src = user.picture;
    return;
  }

  showFallback();
}

function readableAuthError(err) {
  if (!err) return 'Something went wrong with Auth0 login.';
  return err.error_description || err.message || 'Something went wrong with Auth0 login.';
}
