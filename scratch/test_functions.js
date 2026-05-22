import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testFCM() {
  console.log("Testing FCM...");
  const { data, error } = await supabase.functions.invoke("fcm-notification", {
    body: {
      title: "Test LIVE!",
      body: "Testing FCM.",
      targetRole: "parents"
    }
  });
  console.log("FCM Result:", { data, error });
}

async function testWA() {
  console.log("Testing WA...");
  const res = await fetch(process.env.VITE_SUPABASE_URL + '/functions/v1/whatsapp-notification', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ phone: "+1234567890", message: "Testing WA", studentName: "Test" })
  });
  console.log("WA Result Status:", res.status);
  console.log("WA Result Body:", await res.text());
}

async function run() {
  await testFCM();
  await testWA();
}

run();
