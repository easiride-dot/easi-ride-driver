const fs = require('fs');
const https = require('https');

function parseEnv(filePath) {
  const envStr = fs.readFileSync(filePath, 'utf8');
  const env = {};
  envStr.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
  return env;
}

const env = parseEnv('.env');

function makeRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(env.VITE_SUPABASE_URL + urlPath);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': env.VITE_SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + env.VITE_SUPABASE_ANON_KEY,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    console.log("Checking ride_invitations...");
    const invs = await makeRequest('/rest/v1/ride_invitations?select=*&order=created_at.desc&limit=5');
    console.log(JSON.stringify(invs, null, 2));

    console.log("\nChecking rides (searching_driver)...");
    const rides = await makeRequest('/rest/v1/rides?select=id,status,created_at,pickup,destination&status=eq.searching_driver&order=created_at.desc&limit=5');
    console.log(JSON.stringify(rides, null, 2));
    
  } catch(e) {
    console.error("Error:", e);
  }
})();
