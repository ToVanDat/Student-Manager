const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, chmod, readFile, readdir, rm, stat } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, '../scripts/backup-postgres.sh');
const bashAvailable = spawnSync('bash', ['--version'], { encoding: 'utf8' }).status === 0;

async function fixture(t, overrides = {}) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'student-manager-backup-test-'));
    const bin = path.join(root, 'bin');
    const backupDir = path.join(root, 'backups');
    await mkdir(bin);
    const stubs = {
        psql: '#!/usr/bin/env bash\nprintf "%s" "\${IDENTITY_RESULT:-t}"\n',
        pg_dump: '#!/usr/bin/env bash\nfor arg in "$@"; do case "$arg" in --file=*) output="\${arg#--file=}";; esac; done\n[[ "\${PG_DUMP_FAIL:-0}" != 1 ]] || exit 31\nprintf "test-archive" > "$output"\n',
        pg_restore: '#!/usr/bin/env bash\n[[ "\${RESTORE_FAIL:-0}" != 1 ]] || exit 32\n[[ -s "$2" ]]\n',
        sha256sum: '#!/usr/bin/env bash\n[[ "\${SHA_FAIL:-0}" != 1 ]] || exit 33\nprintf "test-checksum  %s\\n" "$1"'
    };
    for (const [name, body] of Object.entries(stubs)) {
        const file = path.join(bin, name);
        await writeFile(file, body, { mode: 0o700 });
        await chmod(file, 0o700);
    }
    t.after(() => rm(root, { recursive: true, force: true }));
    const env = {
        ...process.env,
        PATH: bin + path.delimiter + process.env.PATH,
        DB_NAME: 'student_manager_test',
        DB_USER: 'backup_operator',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5432',
        BACKUP_DIR: backupDir,
        ...overrides
    };
    return { root, backupDir, env };
}

function run(env) {
    return spawnSync('bash', [script], { env, encoding: 'utf8' });
}

test('backup script refuses a mismatched database identity before creating artifacts', { skip: !bashAvailable }, async t => {
    const f = await fixture(t, { IDENTITY_RESULT: 'f' });
    const result = run(f.env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match DB_NAME\/DB_USER/i);
    await assert.rejects(stat(f.backupDir), error => error.code === 'ENOENT');
});

test('backup script creates a validated archive and portable checksum manifest', { skip: !bashAvailable }, async t => {
    const f = await fixture(t);
    const result = run(f.env);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const files = await readdir(f.backupDir);
    const archive = files.find(name => name.endsWith('.dump'));
    assert.ok(archive);
    assert.ok(files.includes(archive + '.sha256'));
    assert.equal(await readFile(path.join(f.backupDir, archive), 'utf8'), 'test-archive');
    const manifest = await readFile(path.join(f.backupDir, archive + '.sha256'), 'utf8');
    assert.ok(manifest.trimEnd().endsWith(archive), 'checksum manifest should contain only the archive basename');
    const archiveMode = (await stat(path.join(f.backupDir, archive))).mode & 0o777;
    assert.equal(archiveMode, 0o600);
});

test('backup script removes partial archive when pg_dump fails', { skip: !bashAvailable }, async t => {
    const f = await fixture(t, { PG_DUMP_FAIL: '1' });
    const result = run(f.env);
    assert.notEqual(result.status, 0);
    assert.deepEqual(await readdir(f.backupDir), []);
});

test('backup script removes partial archive when archive validation fails', { skip: !bashAvailable }, async t => {
    const f = await fixture(t, { RESTORE_FAIL: '1' });
    const result = run(f.env);
    assert.notEqual(result.status, 0);
    assert.deepEqual(await readdir(f.backupDir), []);
});

test('backup script removes archive when checksum generation fails', { skip: !bashAvailable }, async t => {
    const f = await fixture(t, { SHA_FAIL: '1' });
    const result = run(f.env);
    assert.notEqual(result.status, 0);
    assert.deepEqual(await readdir(f.backupDir), []);
});

test('backup script removes archive when checksum generation fails', { skip: !bashAvailable }, async t => {
    const f = await fixture(t, { SHA_FAIL: '1' });
    const result = run(f.env);
    assert.notEqual(result.status, 0);
    assert.deepEqual(await readdir(f.backupDir), []);
});
