// ─── REPUTATION ENGINE ─────────────────────────────────────────────
// Server-side reputation processing.
// DISABLED firebase-admin for Cloudflare Workers compatibility.
// Reputation updates are handled via client-side Firestore listeners
// or direct client-side increments when needed.

export async function processInteraction(
  _type: string,
  _fromUid: string,
  _toUid: string,
  _postId: string
) {
  // Server-side processing is disabled to prevent Worker crashes.
  // The interaction is already logged to Firestore in the API route.
  console.log('[ReputationEngine] Server-side processing disabled in this environment');
}
