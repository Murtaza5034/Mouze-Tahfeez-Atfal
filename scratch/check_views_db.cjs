const https = require('https');

const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZHlwbmJjc2p5dGJ4aXdlbm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODkxNDYsImV4cCI6MjA5MjI2NTE0Nn0.uuZr6KQ0AB2jGxk40AcTdUYcMHT-sI4P6sMYV_0L_uQ';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'medypnbcsjytbxiwenob.supabase.co',
      path: path,
      method: method,
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', err => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  try {
    console.log("Checking parent_report_views contents...");
    const res = await makeRequest('/rest/v1/parent_report_views?select=*');
    console.log("Status Code:", res.statusCode);
    console.log("Response Body:", JSON.stringify(res.body, null, 2));
  } catch (err) {
    console.error("Request failed:", err);
  }
}

run();
