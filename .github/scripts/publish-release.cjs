'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const repository = process.env.GITHUB_REPOSITORY || 'AgrarJulian/LS-Launcher';
const tag = process.env.GITHUB_REF_NAME;
const token = process.env.GH_TOKEN;
const version = require('../../package.json').version;
if (!token) throw new Error('Missing GH_TOKEN.');
if (!tag || tag !== `v${version}`) throw new Error(`Release tag ${tag || '(missing)'} must match package version v${version}.`);

function api(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = https.request(`https://api.github.com${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Agri-Nexus-Release-Workflow',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {})
      }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch {}
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`GitHub API ${method} ${endpoint} returned ${response.statusCode}: ${text.slice(0, 500)}`));
          return;
        }
        resolve(parsed);
      });
    });
    request.on('error', reject);
    if (data) request.write(data);
    request.end();
  });
}

function upload(releaseId, file) {
  const name = path.basename(file);
  const size = fs.statSync(file).size;
  return new Promise((resolve, reject) => {
    const request = https.request(`https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Agri-Nexus-Release-Workflow',
        'Content-Type': name.endsWith('.yml') ? 'text/yaml' : 'application/octet-stream',
        'Content-Length': size
      }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch {}
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`GitHub asset upload ${name} returned ${response.statusCode}: ${text.slice(0, 500)}`));
          return;
        }
        console.log(`Uploaded ${name} (${size} bytes).`);
        resolve(parsed);
      });
    });
    request.on('error', reject);
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.pipe(request);
  });
}

async function main() {
  const assetNames = [
    `Agri-Nexus-${version}-x64.exe`,
    `Agri-Nexus-${version}-x64.exe.blockmap`,
    'latest.yml'
  ];
  const files = assetNames.map((name) => path.join(process.cwd(), 'dist', name));
  for (const file of files) if (!fs.existsSync(file)) throw new Error(`Build output missing: ${file}`);
  const manifest = fs.readFileSync(files[2], 'utf8');
  if (!manifest.includes(`version: ${version}`) || !manifest.includes(assetNames[0])) throw new Error('latest.yml does not match the installer version.');

  const prefix = `/repos/${repository}/releases`;
  let release;
  try {
    release = await api('GET', `${prefix}/tags/${encodeURIComponent(tag)}`);
  } catch (error) {
    if (!String(error.message).includes('returned 404')) throw error;
    release = await api('POST', prefix, {
      tag_name: tag,
      name: `Agri Nexus ${version}`,
      body: 'Windows NSIS installer and auto-update metadata.',
      draft: false,
      prerelease: true
    });
  }

  for (const asset of (release.assets || []).filter((item) => assetNames.includes(item.name))) {
    await api('DELETE', `${prefix}/assets/${asset.id}`);
    console.log(`Replaced previous ${asset.name}.`);
  }
  for (const file of files) await upload(release.id, file);
  console.log(`Release ready: ${release.html_url}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
