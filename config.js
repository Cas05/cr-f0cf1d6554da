/* Public config. The publishable key is safe to ship: the database only lets it call
   submit_trip_request / get_trip_request / get_trip_request_statuses (no table access). */
window.TS_CONFIG = {
  supabaseUrl: 'https://onqtuqhtgugshldkpydw.supabase.co',
  supabaseKey: 'sb_publishable_8GbTD9gY7da-VUtlOkH__g_OGMFUJ1O',
  pollMs: 60000
};
