// Cognito Hosted UI authentication via OAuth2 authorization-code flow with PKCE.
// No Amplify dependency — plain fetch against the Cognito endpoints.
// Tokens are kept in sessionStorage (per the 1-day POC scope).
const config = {
  domain: import.meta.env.VITE_COGNITO_DOMAIN, // e.g. https://my-prefix.auth.us-east-1.amazoncognito.com
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI,
  logoutUri: import.meta.env.VITE_LOGOUT_URI,
  apiUrl: import.meta.env.VITE_API_URL, // e.g. https://abc123.execute-api.us-east-1.amazonaws.com
};

function base64UrlEncode(bytes) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function codeChallenge(verifier) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64UrlEncode(new Uint8Array(digest));
}

function decodePayload(token) {
  const part = token.split(".")[1];
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(b64));
}

export function clearTokens() {
  for (const k of ["id_token", "access_token", "refresh_token", "expires_at", "pkce_verifier"]) {
    sessionStorage.removeItem(k);
  }
}

export async function login() {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(48))); // ~64 chars
  sessionStorage.setItem("pkce_verifier", verifier);
  const challenge = await codeChallenge(verifier);
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: config.redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  window.location.assign(`${config.domain}/oauth2/authorize?${params.toString()}`);
}

export async function handleCallback() {
  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) throw new Error("No authorization code in callback URL");
  const verifier = sessionStorage.getItem("pkce_verifier");
  if (!verifier) throw new Error("Missing PKCE verifier — please sign in again");

  const res = await fetch(`${config.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error("Token exchange failed");
  const tokens = await res.json();
  sessionStorage.setItem("id_token", tokens.id_token);
  sessionStorage.setItem("access_token", tokens.access_token);
  if (tokens.refresh_token) sessionStorage.setItem("refresh_token", tokens.refresh_token);
  sessionStorage.setItem("expires_at", String(Date.now() + tokens.expires_in * 1000));
  sessionStorage.removeItem("pkce_verifier");
}

export function isAuthenticated() {
  const idToken = sessionStorage.getItem("id_token");
  const expiresAt = Number(sessionStorage.getItem("expires_at") || 0);
  return !!idToken && Date.now() < expiresAt;
}

// Role rule for this POC: membership in the Cognito "Agents" group => agent.
export function getRole() {
  try {
    const payload = decodePayload(sessionStorage.getItem("id_token"));
    const groups = payload["cognito:groups"] || [];
    return groups.includes("Agents") ? "agent" : "customer";
  } catch {
    return "customer";
  }
}

export function getUserEmail() {
  try {
    return decodePayload(sessionStorage.getItem("id_token")).email || "";
  } catch {
    return "";
  }
}

export function logout() {
  clearTokens();
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutUri,
  });
  window.location.assign(`${config.domain}/logout?${params.toString()}`);
}

// Authenticated fetch against the API. Throws on HTTP error.
export async function authFetch(path, options = {}) {
  const idToken = sessionStorage.getItem("id_token");
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    clearTokens();
    window.location.assign("/login");
    throw new Error("Session expired — please sign in again");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}
