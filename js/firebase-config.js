// HallMate — Firebase initialization (Phone OTP only).
// Architecture-only: exposes the configured `auth` instance and OTP primitives.
// Auth flow logic is intentionally not implemented in Phase 1.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

import { FIREBASE } from './config.js';

const firebaseApp = initializeApp({
  apiKey: FIREBASE.apiKey,
  authDomain: FIREBASE.authDomain,
  projectId: FIREBASE.projectId,
  appId: FIREBASE.appId,
});

export const auth = getAuth(firebaseApp);

// reCAPTCHA is disabled for all users — no bot check, no popup, ever.
// OTP delivery + 6-digit code verification remain the security layer.
auth.settings.appVerificationDisabledForTesting = true;

// Keep sessions across reloads. Phone-OTP-only apps want local persistence.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('[firebase] persistence init failed', err);
});

// Re-export OTP primitives so feature modules import a single surface.
export { signInWithPhoneNumber, onAuthStateChanged, signOut };

// No-op verifier — reCAPTCHA is fully disabled.
// signInWithPhoneNumber requires a verifier object; this satisfies the
// full Firebase ApplicationVerifier interface without triggering any
// Google reCAPTCHA calls.
// _reset() is Firebase's private post-verification lifecycle hook — it is
// called internally after signInWithPhoneNumber resolves to prepare the
// verifier for subsequent attempts. Without it the SDK throws
// "r._reset is not a function".
export function createRecaptcha() {
  return {
    type:   'recaptcha',
    verify: () => Promise.resolve(''),
    clear:  () => {},
    render: () => Promise.resolve(0),
    _reset: () => {},
  };
}
