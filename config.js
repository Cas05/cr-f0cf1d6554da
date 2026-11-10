/* Public config. The publishable (anon) key is safe to ship. With it, the database only allows:
   get_client_proposal / choose_client_proposal (by long random token) and submit_lead (rate-limited).
   Everything else (requests, bundles, leads, proposals) needs a signed-in advisor on the allowlist. */
window.TS_CONFIG = {
  supabaseUrl: 'https://onqtuqhtgugshldkpydw.supabase.co',
  supabaseKey: 'sb_publishable_8GbTD9gY7da-VUtlOkH__g_OGMFUJ1O',
  pollMs: 60000
};
