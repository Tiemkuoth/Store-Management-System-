#!/usr/bin/env node
// Cross-platform Node helper to run mysqldump using provided env vars or CLI args

const { spawn } = require('child_process');
const fs = require('fs');

const argv = require('minimist')(process.argv.slice(2));
const out = argv.out || argv.o || './store_dump.sql';
const host = argv.host || process.env.DB_HOST || 'localhost';
const user = argv.user || process.env.DB_USER;
const db = argv.db || process.env.DB_NAME;

if (!user || !db) {
  console.error('Please provide --user and --db (or set DB_USER and DB_NAME env vars)');
  process.exit(1);
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('DB password (leave empty for none): ', (pwd) => {
  rl.close();

  const args = ['-u', user];
  if (pwd) args.push(`-p${pwd}`);
  if (host) { args.push('-h', host); }
  args.push(db);

  const proc = spawn('mysqldump', args);
  const ws = fs.createWriteStream(out);
  proc.stdout.pipe(ws);
  proc.stderr.pipe(process.stderr);

  proc.on('close', (code) => {
    if (code === 0) console.log(`Export complete: ${out}`);
    else console.error('mysqldump failed with code', code);
  });
});
