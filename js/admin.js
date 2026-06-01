// Zenter Admin Platform — Phase 1.
// Self-contained bootstrap:
//   1. requireAdmin() — Firebase auth + Supabase role check (cached)
//   2. Hash router for the 7 sections (#dashboard, #users, #feedback, …)
//   3. Lightweight data loaders (run once per section activation)
//
// Non-admins never see the shell — they're redirected before the gate lifts.

import { requireAdmin, logout, getCurrentUser } from './auth.js';
import { formatPhonePretty } from './utils.js';

const ROUTES_LIST = ['dashboard', 'users', 'feedback', 'reports', 'exams', 'analytics', 'settings'];
const loadedSections = new Set();
let currentRoute = 'dashboard';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

(async function init() {
  const user = await requireAdmin();
  if (!user) return; // redirected away

  // Reveal the shell — gate fades out
  document.getElementById('adm-shell').hidden = false;
  document.getElementById('adm-gate')?.classList.add('is-hidden');
  setTimeout(() => document.getElementById('adm-gate')?.remove(), 400);

  // Topbar identity
  const phone = user.phoneNumber || '';
  document.getElementById('adm-user-phone').textContent = formatPhonePretty(phone) || phone;
  document.getElementById('adm-user-avatar').textContent = (phone.slice(-2) || 'A').toUpperCase();

  // Logout button (event delegation)
  document.addEventListener('click', (e) => {
    if (e.target?.dataset?.action === 'logout') logout('/login.html');
  });

  wireRouter();
  activateRoute(getRouteFromHash());
})();

// ─── Hash router ─────────────────────────────────────────────────────────────

function getRouteFromHash() {
  const h = (location.hash || '').slice(1).toLowerCase();
  return ROUTES_LIST.includes(h) ? h : 'dashboard';
}

function wireRouter() {
  window.addEventListener('hashchange', () => activateRoute(getRouteFromHash()));
}

function activateRoute(route) {
  currentRoute = route;

  // Sidebar active state
  document.querySelectorAll('.adm-nav a').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.route === route);
  });

  // Panel visibility
  document.querySelectorAll('.adm-panel').forEach((p) => {
    p.classList.toggle('is-active', p.dataset.route === route);
  });

  // Topbar title
  const titleEl = document.getElementById('adm-page-title');
  if (titleEl) titleEl.textContent = capitalize(route);

  // Lazy-load section data (idempotent)
  if (!loadedSections.has(route)) {
    loadedSections.add(route);
    SECTION_LOADERS[route]?.();
  }
}

// ─── Section data loaders ────────────────────────────────────────────────────

const SECTION_LOADERS = {
  dashboard: loadDashboard,
  users:     loadUsers,
  feedback:  loadFeedback,
  reports:   loadReports,
  // exams / analytics / settings are pure placeholders — no loader needed
};

async function loadDashboard() {
  const { getAdminStats, getRecentUsers } = await import('./supabase.js');
  const [statsRes, usersRes] = await Promise.all([getAdminStats(), getRecentUsers(8)]);

  if (statsRes.data) {
    setStat('stat-total-users',  statsRes.data.totalUsers);
    setStat('stat-active-users', statsRes.data.activeUsers);
    setStat('stat-connections',  statsRes.data.connections);
    setStat('stat-feedback',     statsRes.data.feedback);
    setStat('stat-reports',      statsRes.data.reports);
  }

  const container = document.getElementById('adm-latest-users');
  if (statsRes.error || !usersRes.data?.length) {
    container.innerHTML = emptyState('🌱', 'No users yet.');
    return;
  }
  container.innerHTML = renderUsersTable(usersRes.data.slice(0, 8));
}

async function loadUsers() {
  const { getRecentUsers } = await import('./supabase.js');
  const container = document.getElementById('adm-users-list');
  const { data, error } = await getRecentUsers(50);
  if (error || !data?.length) {
    container.innerHTML = emptyState('👥', error ? 'Could not load users.' : 'No users yet.');
    return;
  }
  container.innerHTML = renderUsersTable(data);
}

async function loadFeedback() {
  const { getRecentFeedbacks } = await import('./supabase.js');
  const container = document.getElementById('adm-feedback-list');
  const { data, error } = await getRecentFeedbacks(50);
  if (error || !data?.length) {
    container.innerHTML = emptyState('💬', error ? 'Could not load feedback.' : 'No feedback yet.');
    return;
  }
  container.innerHTML = `
    <table class="adm-table">
      <thead><tr><th>Date</th><th>User</th><th>Exam</th><th>Message</th></tr></thead>
      <tbody>
        ${data.map((f) => `
          <tr>
            <td>${esc(fmtDate(f.created_at))}</td>
            <td>${esc(f.user_name || '—')}</td>
            <td>${esc(f.exam_type || '—')}</td>
            <td>${esc(f.feedback_message || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

async function loadReports() {
  const { getRecentReports } = await import('./supabase.js');
  const container = document.getElementById('adm-reports-list');
  const { data, error } = await getRecentReports(50);
  if (error || !data?.length) {
    container.innerHTML = emptyState('🚩', error ? 'Could not load reports.' : 'No reports yet.');
    return;
  }
  container.innerHTML = `
    <table class="adm-table">
      <thead><tr><th>Date</th><th>Reporter (UUID)</th><th>Reported (UUID)</th><th>Reason</th></tr></thead>
      <tbody>
        ${data.map((r) => `
          <tr>
            <td>${esc(fmtDate(r.created_at))}</td>
            <td><code>${esc((r.blocker_user_id || '').slice(0, 8))}…</code></td>
            <td><code>${esc((r.blocked_user_id || '').slice(0, 8))}…</code></td>
            <td>${esc(r.reason || '—')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

// ─── Render helpers ──────────────────────────────────────────────────────────

function renderUsersTable(users) {
  return `
    <table class="adm-table">
      <thead><tr><th>Name</th><th>Phone</th><th>Gender</th><th>Exam</th><th>Role</th><th>Joined</th></tr></thead>
      <tbody>
        ${users.map((u) => `
          <tr>
            <td>${esc(u.full_name || '—')}</td>
            <td>${esc(formatPhonePretty(u.phone) || u.phone || '—')}</td>
            <td>${esc(u.gender || '—')}</td>
            <td>${esc(u.exam_type || '—')}</td>
            <td><span class="adm-pill adm-pill--${esc(u.role || 'user')}">${esc(u.role || 'user')}</span></td>
            <td>${esc(fmtDate(u.created_at))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function emptyState(icon, text) {
  return `<div class="adm-empty"><div class="adm-empty__icon">${icon}</div>${esc(text)}</div>`;
}

function setStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
