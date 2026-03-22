#!/usr/bin/env node
/**
 * Commandarr Helper — Lightweight companion service that runs on the host machine.
 * Allows Commandarr (running in Docker) to restart Plex and perform other host-level actions.
 *
 * Usage:
 *   node commandarr-helper.js
 *
 * Environment variables:
 *   HELPER_PORT        - Port to listen on (default: 9484)
 *   HELPER_TOKEN       - Shared secret for authentication (recommended)
 *   PLEX_RESTART_CMD   - Custom restart command (auto-detected if not set)
 *
 * The helper auto-detects your OS and Plex installation:
 *   Windows: net stop/start "Plex Media Server" or taskkill/restart
 *   Linux:   systemctl restart plexmediaserver
 *   macOS:   osascript quit/open or launchctl
 */

const http = require('http');
const { exec } = require('child_process');
const os = require('os');

const PORT = parseInt(process.env.HELPER_PORT || '9484', 10);
const TOKEN = process.env.HELPER_TOKEN || '';
const CUSTOM_CMD = process.env.PLEX_RESTART_CMD || '';

// ─── Auto-detect restart commands per OS ────────────────────────────

function getRestartCommands() {
  const platform = os.platform();

  if (CUSTOM_CMD) {
    return { stop: CUSTOM_CMD, start: '', label: 'custom command' };
  }

  switch (platform) {
    case 'win32':
      return {
        // Try Windows service first, fall back to process kill + relaunch
        stop: 'net stop "Plex Media Server" 2>nul || (taskkill /F /IM "Plex Media Server.exe" 2>nul)',
        start: 'net start "Plex Media Server" 2>nul || (start "" "C:\\Program Files\\Plex\\Plex Media Server\\Plex Media Server.exe")',
        label: 'Windows service/process',
      };
    case 'linux':
      return {
        stop: 'sudo systemctl stop plexmediaserver 2>/dev/null || sudo service plexmediaserver stop 2>/dev/null || (pkill -f "Plex Media Server" 2>/dev/null)',
        start: 'sudo systemctl start plexmediaserver 2>/dev/null || sudo service plexmediaserver start 2>/dev/null',
        label: 'Linux systemd/service',
      };
    case 'darwin':
      return {
        stop: 'osascript -e \'quit app "Plex Media Server"\' 2>/dev/null || pkill -f "Plex Media Server" 2>/dev/null',
        start: 'open -a "Plex Media Server"',
        label: 'macOS app',
      };
    default:
      return {
        stop: 'pkill -f "Plex Media Server"',
        start: '',
        label: `${platform} (generic kill)`,
      };
  }
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    if (!cmd) return resolve('(no command)');
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error && error.killed) {
        reject(new Error('Command timed out after 30s'));
      } else {
        // Some restart commands "fail" with exit code but still work
        resolve(stdout || stderr || 'done');
      }
    });
  });
}

// ─── HTTP Server ────────────────────────────────────────────────────

const commands = getRestartCommands();

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Auth check
  if (TOKEN) {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${TOKEN}`) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      platform: os.platform(),
      hostname: os.hostname(),
      restartMethod: commands.label,
    }));
    return;
  }

  // Restart Plex
  if (url.pathname === '/restart-plex' && req.method === 'POST') {
    console.log(`[${new Date().toISOString()}] Restart requested`);

    try {
      console.log(`  Stopping Plex (${commands.label})...`);
      const stopResult = await runCommand(commands.stop);
      console.log(`  Stop result: ${stopResult.trim()}`);

      // Brief pause to let process fully stop
      await new Promise(r => setTimeout(r, 2000));

      if (commands.start) {
        console.log('  Starting Plex...');
        const startResult = await runCommand(commands.start);
        console.log(`  Start result: ${startResult.trim()}`);
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: `Plex restart initiated via ${commands.label}`,
        platform: os.platform(),
      }));
    } catch (e) {
      console.error(`  Restart failed: ${e.message}`);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        message: `Restart failed: ${e.message}`,
      }));
    }
    return;
  }

  // Custom command (optional, for advanced users)
  if (url.pathname === '/exec' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { command } = JSON.parse(body);
        if (!command) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No command provided' }));
          return;
        }
        console.log(`[${new Date().toISOString()}] Exec: ${command}`);
        const result = await runCommand(command);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, output: result.trim() }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found. Endpoints: GET /health, POST /restart-plex' }));
});

server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   Commandarr Helper                       ║
  ║                                           ║
  ║   Port:     ${String(PORT).padEnd(30)}║
  ║   Platform: ${os.platform().padEnd(30)}║
  ║   Restart:  ${commands.label.padEnd(30)}║
  ║   Auth:     ${(TOKEN ? 'enabled' : 'disabled').padEnd(30)}║
  ╚═══════════════════════════════════════════╝
  `);
});
