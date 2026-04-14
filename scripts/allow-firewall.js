const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const out = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key) out[key] = value;
  }

  return out;
}

function runNetsh(command) {
  return execSync(command, { stdio: 'pipe' }).toString();
}

function buildNetshArgs(ruleName, port) {
  return [
    'advfirewall',
    'firewall',
    'add',
    'rule',
    `name="${ruleName}"`,
    'dir=in',
    'action=allow',
    'protocol=TCP',
    `localport=${port}`,
    'profile=any'
  ];
}

function runElevatedNetsh(ruleName, port) {
  const netshArgs = buildNetshArgs(ruleName, port).join(' ');
  const psScript = `$argsLine='${netshArgs.replace(/'/g, "''")}'; Start-Process -FilePath netsh -ArgumentList $argsLine -Verb RunAs -Wait`;

  const result = spawnSync('powershell', ['-NoProfile', '-Command', psScript], {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  return result;
}

function ruleExists(ruleName) {
  try {
    const output = runNetsh(`netsh advfirewall firewall show rule name="${ruleName}"`);
    return output.toLowerCase().includes(ruleName.toLowerCase());
  } catch (_) {
    return false;
  }
}

function main() {
  if (process.platform !== 'win32') {
    console.log('Skip firewall setup: hanya dijalankan otomatis di Windows.');
    return;
  }

  const envPath = path.join(__dirname, '..', '.env');
  const env = parseEnvFile(envPath);
  const port = Number(process.env.PORT || env.PORT || 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.warn('Skip firewall setup: PORT tidak valid.');
    return;
  }

  const ruleName = `Skripsi Node ${port}`;
  const addCmd = `netsh ${buildNetshArgs(ruleName, port).join(' ')}`;

  if (ruleExists(ruleName)) {
    console.log(`Rule firewall ${ruleName} sudah ada.`);
    return;
  }

  try {
    runNetsh(addCmd);
    console.log(`Firewall inbound diizinkan untuk TCP port ${port} (profile any).`);
    return;
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`.toLowerCase();

    // Jika rule sudah ada, anggap sukses agar npm start tetap lanjut.
    if (output.includes('already exists') || output.includes('sudah ada')) {
      console.log(`Rule firewall untuk port ${port} sudah ada.`);
      return;
    }

    if (output.includes('access is denied') || output.includes('akses ditolak') || output.includes('requires elevation')) {
      console.warn('Mencoba meminta izin Administrator (UAC) untuk menambah rule firewall...');
      const elevated = runElevatedNetsh(ruleName, port);

      if (elevated.status === 0 && ruleExists(ruleName)) {
        console.log(`Firewall inbound diizinkan untuk TCP port ${port} (setelah elevasi).`);
        return;
      }

      console.warn('Izin Administrator tidak diberikan atau gagal dieksekusi.');
      console.warn(`Jalankan manual (PowerShell Administrator): netsh ${buildNetshArgs(ruleName, port).join(' ')}`);
      return;
    }

    console.warn('Gagal menambah rule firewall otomatis. Jalankan terminal sebagai Administrator agar akses LAN terbuka.');
  }
}

main();
