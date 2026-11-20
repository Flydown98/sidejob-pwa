#!/usr/bin/env bash
set -euo pipefail
: "${CLASPRC_JSON:?Set GitHub Actions secret CLASPRC_JSON}"
: "${APPS_SCRIPT_ID:?Set GitHub Actions variable APPS_SCRIPT_ID}"
: "${APPS_SCRIPT_DEPLOYMENT_ID:?Set GitHub Actions variable APPS_SCRIPT_DEPLOYMENT_ID}"
: "${CLASP_BIN:?Set CLASP_BIN to the clasp executable}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Fail before any remote mutation if the IDs do not target the app's current URL.
node - "$repo_root/config.js" <<'JS'
const fs=require('node:fs');
const config=fs.readFileSync(process.argv[2],'utf8');
const id=config.match(/https:\/\/script\.google\.com\/macros\/s\/([^/]+)\/exec/)?.[1];
if(!id||id!==process.env.APPS_SCRIPT_DEPLOYMENT_ID)throw new Error('Deployment ID must match config.js API_URL. Script ID is a different ID.');
const auth=JSON.parse(process.env.CLASPRC_JSON);
if(!auth||typeof auth!=='object'||Array.isArray(auth))throw new Error('CLASPRC_JSON must contain the complete clasp credential file');
JS
umask 077
deploy_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/sidejob-deploy.XXXXXX")"
trap 'rm -rf -- "$deploy_dir"' EXIT
printf '%s' "$CLASPRC_JSON" > "$deploy_dir/auth.json"
unset CLASPRC_JSON
mkdir "$deploy_dir/project"
cd "$deploy_dir/project"
# Clone the existing project first: retain its manifest, scopes and other files.
"$CLASP_BIN" --auth "$deploy_dir/auth.json" clone-script "$APPS_SCRIPT_ID"
node - "$APPS_SCRIPT_ID" <<'JS'
const fs=require('node:fs');
if(JSON.parse(fs.readFileSync('.clasp.json','utf8')).scriptId!==process.argv[2])throw new Error('Unexpected script project');
if(!fs.existsSync('appsscript.json'))throw new Error('Original Apps Script manifest is missing');
JS
# clasp can use .js or .gs for server scripts. Replace only the existing Code file.
if [[ -f Code.js && ! -f Code.gs ]]; then
  cp "$repo_root/apps-script/Code.gs" Code.js
elif [[ -f Code.gs && ! -f Code.js ]]; then
  cp "$repo_root/apps-script/Code.gs" Code.gs
else
  echo 'Expected exactly one existing Code.js or Code.gs; inspect the project file names.' >&2
  exit 1
fi
"$CLASP_BIN" --auth "$deploy_dir/auth.json" push --force
"$CLASP_BIN" --auth "$deploy_dir/auth.json" update-deployment "$APPS_SCRIPT_DEPLOYMENT_ID" --description "sidejob-pwa ${GITHUB_SHA:-manual}"
# Read-only health request; do not write production data during deployment.
node - <<'JS'
(async()=>{
const url=`https://script.google.com/macros/s/${process.env.APPS_SCRIPT_DEPLOYMENT_ID}/exec`;
let last;
for(let i=0;i<6;i++){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Health HTTP ${r.status}`);const d=await r.json();if(d.ok&&d.data?.service==='sidejob-settlement-api'&&d.data?.status==='ready'){console.log('API health PASS (authenticated data access not tested)');return}throw new Error('Unexpected health response')}catch(e){last=e}
 await new Promise(r=>setTimeout(r,5000));
}
throw last;
})().catch(e=>{console.error(e.message);process.exitCode=1});
JS
