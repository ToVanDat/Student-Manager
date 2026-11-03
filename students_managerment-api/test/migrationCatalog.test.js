const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlDir = path.join(__dirname, '..', 'sql');
const catalogPath = path.join(sqlDir, 'migration-catalog.json');

test('manual migration catalog covers every executable SQL migration', () => {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const actual = fs.readdirSync(sqlDir)
        .filter(file => file.endsWith('.sql'))
        .filter(file => !file.includes('readonly_audit'))
        .sort();
    const declared = catalog.migrations.map(item => item.file).sort();

    assert.equal(catalog.policy.automaticExecutionAllowed, false);
    assert.equal(catalog.policy.alphabeticalExecutionAllowed, false);
    assert.equal(catalog.policy.approvalRequiredBeforeApplying, true);
    assert.deepEqual(declared, actual, 'every executable SQL migration must have an explicit catalog entry');
});

test('migration catalog has unique entries and valid file dependencies', () => {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const byFile = new Map(catalog.migrations.map(item => [item.file, item]));

    assert.equal(byFile.size, catalog.migrations.length, 'duplicate migration catalog entry');

    for (const migration of catalog.migrations) {
        assert.ok(migration.feature, `${migration.file}: feature is required`);
        assert.ok(migration.risk, `${migration.file}: risk is required`);
        assert.ok(Array.isArray(migration.dependsOn), `${migration.file}: dependsOn must be an array`);
        assert.ok(migration.notes, `${migration.file}: review notes are required`);

        for (const dependency of migration.dependsOn) {
            if (dependency.endsWith('.sql')) {
                assert.ok(byFile.has(dependency), `${migration.file}: unknown migration dependency ${dependency}`);
            }
        }
    }
});

test('overlapping migration groups are explicitly marked for manual resolution', () => {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const byFile = new Map(catalog.migrations.map(item => [item.file, item]));

    assert.match(byFile.get('group_presence.sql').notes, /Overlaps/i);
    assert.match(byFile.get('group_chat_presence.sql').notes, /Overlaps/i);
    assert.match(byFile.get('conversation_management.sql').notes, /overlaps/i);
    assert.match(byFile.get('chat_safety_features.sql').notes, /different definitions/i);
});
