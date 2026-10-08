const api = process.env.SMOKE_API_URL || 'http://127.0.0.1:3001';
const web = process.env.SMOKE_WEB_URL || 'http://localhost:3000';
for (const url of [`${api}/api/v1/health/live`, `${api}/api/v1/health/ready`, `${web}/login`]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  console.log(`PASS ${url}`);
}
