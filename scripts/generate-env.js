const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

function isPrivateIPv4(ip) {
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = Number(ip.split('.')[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

function getLocalIPv4() {
  const preferredFromRoute = getPreferredIPv4FromDefaultRoute();
  if (preferredFromRoute) {
    return preferredFromRoute;
  }

  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const iface of Object.values(interfaces)) {
    for (const item of iface || []) {
      if (item.family === 'IPv4' && !item.internal) {
        candidates.push(item.address);
      }
    }
  }

  const filtered = candidates.filter((ip) => !ip.startsWith('169.254.'));
  const finalCandidates = filtered.length > 0 ? filtered : candidates;

  if (finalCandidates.length === 0) {
    return '127.0.0.1';
  }

  const privateIp = finalCandidates.find(isPrivateIPv4);
  return privateIp || finalCandidates[0];
}

function getPreferredIPv4FromDefaultRoute() {
  if (process.platform !== 'win32') return null;

  try {
    const output = execSync('route print -4', { stdio: 'pipe' }).toString();
    const lines = output.split(/\r?\n/);
    const matches = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Format umum: 0.0.0.0  0.0.0.0  <gateway>  <interface-ip>  <metric>
      const parts = trimmed.split(/\s+/);
      if (parts.length < 5) continue;
      if (parts[0] !== '0.0.0.0' || parts[1] !== '0.0.0.0') continue;

      const interfaceIp = parts[3];
      const metric = Number(parts[4]);

      if (!interfaceIp || interfaceIp.startsWith('169.254.')) continue;
      if (!Number.isFinite(metric)) continue;

      matches.push({ interfaceIp, metric });
    }

    if (matches.length === 0) return null;

    matches.sort((a, b) => a.metric - b.metric);
    const privateBest = matches.find((m) => isPrivateIPv4(m.interfaceIp));
    return (privateBest || matches[0]).interfaceIp;
  } catch (_) {
    return null;
  }
}

function upsertEnvValue(lines, key, value) {
  const prefix = `${key}=`;
  const index = lines.findIndex((line) => line.startsWith(prefix));
  const newLine = `${key}=${value}`;

  if (index >= 0) {
    lines[index] = newLine;
  } else {
    lines.push(newLine);
  }
}

function main() {
  const rootDir = path.join(__dirname, '..');
  const envPath = path.join(rootDir, '.env');
  const localIp = getLocalIPv4();

  let lines = [];
  if (fs.existsSync(envPath)) {
    lines = fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '');
  }

  upsertEnvValue(lines, 'LOCAL_IP', localIp);

  if (!lines.some((line) => line.startsWith('PORT='))) {
    lines.push('PORT=3001');
  }

  fs.writeFileSync(envPath, `${lines.join('\n')}\n`, 'utf8');

  const portLine = lines.find((line) => line.startsWith('PORT=')) || 'PORT=3001';
  const port = portLine.split('=')[1] || '3001';
  console.log(`.env diperbarui. LOCAL_IP=${localIp}, PORT=${port}`);
}

main();
