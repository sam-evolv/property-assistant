const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenHouse AI - Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }
    .card {
      background: white;
      border-radius: 24px;
      padding: 3rem;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .logo {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #D4AF37 0%, #F4CF47 100%);
      border-radius: 20px;
      margin: 0 auto 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      color: white;
      font-weight: bold;
    }
    h1 {
      text-align: center;
      font-size: 1.75rem;
      color: #1a1a1a;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 2rem;
    }
    .success-banner {
      background: #d1fae5;
      border: 1px solid #6ee7b7;
      border-radius: 12px;
      padding: 1rem;
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .success-banner .icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .success-banner p { color: #047857; font-weight: 500; }
    .stats {
      display: grid;
      gap: 0.75rem;
    }
    .stat {
      display: flex;
      justify-content: space-between;
      padding: 0.875rem 1rem;
      background: #f8fafc;
      border-radius: 10px;
    }
    .stat-label { color: #64748b; }
    .stat-value { font-weight: 600; color: #1e293b; }
    .info {
      margin-top: 2rem;
      padding: 1rem;
      background: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 12px;
    }
    .info p {
      color: #92400e;
      font-size: 0.875rem;
      text-align: center;
    }
    .footer {
      margin-top: 2rem;
      text-align: center;
      color: #94a3b8;
      font-size: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">OH</div>
    <h1>OpenHouse AI</h1>
    <p class="subtitle">Unified Portal Preview</p>
    
    <div class="success-banner">
      <div class="icon">✅</div>
      <p>QR Pack Generated Successfully!</p>
    </div>
    
    <div class="stats">
      <div class="stat">
        <span class="stat-label">Development</span>
        <span class="stat-value">Longview Park</span>
      </div>
      <div class="stat">
        <span class="stat-label">Total Units</span>
        <span class="stat-value">77</span>
      </div>
      <div class="stat">
        <span class="stat-label">PDF Size</span>
        <span class="stat-value">666 KB</span>
      </div>
      <div class="stat">
        <span class="stat-label">URL Format</span>
        <span class="stat-value">portal.openhouseai.ie/units/{id}</span>
      </div>
    </div>
    
    <div class="info">
      <p>
        <strong>Note:</strong> Full Next.js portal requires more memory than Replit provides.<br>
        Build externally and deploy the production bundle for full functionality.
      </p>
    </div>
    
    <p class="footer">
      OpenHouse AI &copy; 2025 | Preview Mode
    </p>
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(html);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Preview Server] Running at http://0.0.0.0:${PORT}`);
  console.log('[Preview Server] Full Next.js app cannot run due to Replit memory constraints.');
  console.log('[Preview Server] QR pack has been generated via CLI script.');
});
