// 배포 직전에 실행되어 public/version.json 에 배포 시각을 기록합니다. (firebase.json predeploy)
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'public', 'version.json');
fs.writeFileSync(out, JSON.stringify({ updated: new Date().toISOString() }) + '\n');
console.log('version.json 기록:', out);
