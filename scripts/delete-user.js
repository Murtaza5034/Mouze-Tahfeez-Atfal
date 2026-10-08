import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://medypnbcsjytbxiwenob.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return res.status(400).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in environment' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let userId = req.query.userId;

    if (!userId && req.query.email) {
      const { data: uid, error: lookupError } = await supabase.rpc('get_user_id_by_email', {
        target_email: req.query.email,
      });
      if (lookupError) throw new Error(`Lookup failed: ${lookupError.message}`);
      if (!uid) return res.status(404).json({ error: 'No user found with that email' });
      userId = uid;
    }

    if (!userId) {
      return res.status(400).json({ error: 'Provide ?userId=UUID or ?email=email@example.com' });
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Delete failed: ${error.message}`);

    return res.json({ success: true, message: `User ${userId} deleted (portal access cascaded)` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
