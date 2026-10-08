import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://medypnbcsjytbxiwenob.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return res.status(400).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY not set in environment',
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.id === 'marhala_post_photos');

    if (exists) {
      return res.json({ success: true, message: 'Bucket already exists' });
    }

    const { data, error } = await supabase.storage.createBucket('marhala_post_photos', {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    });

    if (error) throw error;

    return res.json({ success: true, message: 'Bucket created' });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
}
