// HallMate — Route-aware bootstrap entry point.
// Every page loads this single file. It mounts shared chrome, wires up nav state,
// and dispatches to a page-specific initializer based on the current route.

import { mountChrome, highlightActiveNav, $, on } from './ui.js';
import { whenReady, onAuthChange, logout, requireAuth, redirectIfAuthed } from './auth.js';
import { currentRoute } from './utils.js';
import { ROUTES } from './config.js';

// Route -> initializer. Each page registers its concerns here.
// Phase 1: shells only. Logic lands in Phase 2.
const ROUTE_INITIALIZERS = {
  index: initLanding,
  login: initLogin,
  onboarding: initOnboarding,
  dashboard: initDashboard,
  profile: initProfile,
};

document.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
  const route = currentRoute();
  document.body.dataset.route = route;

  await mountChrome();
  highlightActiveNav(route);
  wireGlobalNav();

  // Reflect auth state into the navbar (login button <-> avatar/logout).
  onAuthChange(renderNavAuthState);

  const init = ROUTE_INITIALIZERS[route];
  if (init) {
    try { await init(); }
    catch (err) { console.error(`[app] init error on ${route}`, err); }
  }
}

function wireGlobalNav() {
  // Logout buttons can appear anywhere — delegate from document.
  on(document, 'click', (e) => {
    const target = e.target.closest('[data-action="logout"]');
    if (!target) return;
    e.preventDefault();
    logout().catch((err) => console.error('[app] logout failed', err));
  });
}

function renderNavAuthState(user) {
  const loggedOut = $('[data-auth="logged-out"]');
  const loggedIn = $('[data-auth="logged-in"]');
  if (loggedOut) loggedOut.hidden = !!user;
  if (loggedIn) loggedIn.hidden = !user;
}

// --- Page initializers (shells) ----------------------------------------------

async function initLanding() {
  // Public marketing page — no auth required. Hook hero CTA into login flow.
  const ctaPrimary = $('[data-cta="primary"]');
  on(ctaPrimary, 'click', () => { window.location.href = ROUTES.login; });
}

async function initLogin() {
  // If already signed in, skip the OTP flow.
  await redirectIfAuthed(ROUTES.dashboard);
  // Phase 2: wire phone form -> Firebase RecaptchaVerifier -> signInWithPhoneNumber.
}

async function initOnboarding() {
  const user = await requireAuth();
  if (!user) return;
  // Phase 2: multi-step wizard -> upsert into Supabase `profiles`.
}

async function initDashboard() {
  const user = await requireAuth();
  if (!user) return;
  // Phase 2: load centre mates, filters, connection requests.
}

async function initProfile() {
  const user = await requireAuth();
  if (!user) return;
  // Phase 2: load + edit profile, manage privacy + connections.
}

// Surface a one-time ready signal for debugging in DevTools.
whenReady().then((user) => {
  window.__hm = { ready: true, user };
});
