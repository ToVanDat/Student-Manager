import { IndexedDbSignalProtocolSecretVault } from '@open-e2ee/signal-protocol-sdk/local/vault/indexed-db';

const DB_NAME = 'student-manager-e2ee-pin-vault-v1';
const STORE_NAME = 'wrapped-keys';
const ITERATIONS = 310000;
const activeWrappingKeys = new Map();

const databaseNameForUser = userId => `student-manager-e2ee-user-${String(userId)}.db`;
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

function openDatabase() {
    if (!globalThis.indexedDB) throw new Error('IndexedDB không khả dụng trong trình duyệt này.');
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Không mở được kho khóa PIN.'));
    });
}

async function readRecord(name) {
    const db = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get(name);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('Không đọc được bản ghi khóa PIN.'));
            tx.onabort = () => reject(tx.error || new Error('Đọc kho khóa PIN bị hủy.'));
        });
    } finally {
        db.close();
    }
}

async function writeRecord(name, value) {
    const db = await openDatabase();
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(value, name);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Không ghi được bản ghi khóa PIN.'));
            tx.onabort = () => reject(tx.error || new Error('Ghi kho khóa PIN bị hủy.'));
        });
    } finally {
        db.close();
    }
}

async function deleteRecord(name) {
    const db = await openDatabase();
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(name);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Không xóa được bản ghi khóa PIN.'));
            tx.onabort = () => reject(tx.error || new Error('Xóa kho khóa PIN bị hủy.'));
        });
    } finally {
        db.close();
    }
}

async function deriveWrappingKey(pin, salt) {
    const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(pin),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptSecret(secret, key, salt) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new Uint8Array(secret)
    );
    return { version: 1, salt: encode(salt), iv: encode(iv), ciphertext: encode(ciphertext) };
}

async function decryptSecret(record, key) {
    if (!record?.iv || !record?.ciphertext) return null;
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: decode(record.iv) },
        key,
        decode(record.ciphertext)
    );
    return new Uint8Array(plaintext);
}

function requireWrappingKey(name) {
    const key = activeWrappingKeys.get(name);
    if (!key) {
        const error = new Error('Kho khóa E2EE đang khóa. Hãy mở khóa chat bằng PIN trước.');
        error.code = 'E2EE_PIN_VAULT_LOCKED';
        throw error;
    }
    return key;
}

/**
 * Derives an in-memory wrapping key from the chat PIN and migrates the existing
 * SDK database key from the default IndexedDB vault to this PIN-protected vault.
 * The SQLite database itself is never reset, so existing E2EE history is kept.
 */
export async function unlockPinProtectedE2EEVault(userId, pin) {
    if (!/^[1-9][0-9]*$/.test(String(userId ?? ''))) {
        throw new Error('Không xác định được tài khoản để mở kho khóa E2EE.');
    }
    if (!/^[0-9]{6,12}$/.test(pin)) throw new Error('PIN phải gồm từ 6 đến 12 chữ số.');

    const name = databaseNameForUser(userId);
    let record = await readRecord(name);
    if (!record) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        record = { version: 1, salt: encode(salt), iv: null, ciphertext: null };
        await writeRecord(name, record);
    }
    if (record.version !== 1 || !record.salt) {
        throw new Error('Định dạng kho khóa PIN không được hỗ trợ.');
    }

    const wrappingKey = await deriveWrappingKey(pin, decode(record.salt));
    if (record.ciphertext) {
        try {
            await decryptSecret(record, wrappingKey);
        } catch {
            throw new Error('PIN không thể mở khóa kho E2EE này.');
        }
    }
    activeWrappingKeys.set(name, wrappingKey);

    const legacyVault = new IndexedDbSignalProtocolSecretVault();
    try {
        const legacyKey = await legacyVault.getSecret(name);
        if (legacyKey) {
            if (!record.ciphertext) {
                const wrapped = await encryptSecret(legacyKey, wrappingKey, decode(record.salt));
                await writeRecord(name, wrapped);
            }
            // Delete the unwrapped copy only after the wrapped copy is durable.
            await legacyVault.deleteSecret(name);
        }
    } catch (error) {
        activeWrappingKeys.delete(name);
        throw new Error(`Không thể chuyển khóa E2EE sang bảo vệ bằng PIN: ${error.message}`);
    }
}

export function lockPinProtectedE2EEVault(userId) {
    if (userId != null) activeWrappingKeys.delete(databaseNameForUser(userId));
}

/**
 * Returns the vault adapter required by webSqliteStore. Its database key is
 * encrypted with AES-GCM under a PBKDF2-derived key; the derived key is memory-only.
 */
export function createPinProtectedE2EEVault(userId) {
    const name = databaseNameForUser(userId);
    return {
        async getSecret(secretName) {
            if (secretName !== name) throw new Error('Tên khóa kho E2EE không khớp tài khoản.');
            const wrappingKey = requireWrappingKey(name);
            let record = await readRecord(name);
            if (record?.ciphertext) return decryptSecret(record, wrappingKey);

            // Migration path for a pre-PIN installation whose SDK key is still
            // in the legacy vault. This does not reset or recreate the database.
            const legacyVault = new IndexedDbSignalProtocolSecretVault();
            const legacyKey = await legacyVault.getSecret(name);
            if (!legacyKey) return null;
            const salt = record?.salt ? decode(record.salt) : crypto.getRandomValues(new Uint8Array(16));
            const wrapped = await encryptSecret(legacyKey, wrappingKey, salt);
            await writeRecord(name, wrapped);
            await legacyVault.deleteSecret(name);
            return legacyKey;
        },
        async setSecret(secretName, secret) {
            if (secretName !== name) throw new Error('Tên khóa kho E2EE không khớp tài khoản.');
            const wrappingKey = requireWrappingKey(name);
            const current = await readRecord(name);
            const salt = current?.salt ? decode(current.salt) : crypto.getRandomValues(new Uint8Array(16));
            await writeRecord(name, await encryptSecret(secret, wrappingKey, salt));
        },
        async deleteSecret(secretName) {
            if (secretName !== name) throw new Error('Tên khóa kho E2EE không khớp tài khoản.');
            await deleteRecord(name);
        }
    };
}

/** Removes PIN protection only after restoring the SDK key to its default vault. */
export async function removePinProtectionFromE2EEVault(userId) {
    const name = databaseNameForUser(userId);
    const record = await readRecord(name);
    if (record?.ciphertext) {
        const wrappingKey = requireWrappingKey(name);
        const key = await decryptSecret(record, wrappingKey);
        const legacyVault = new IndexedDbSignalProtocolSecretVault();
        await legacyVault.setSecret(name, key);
    }
    await deleteRecord(name);
    activeWrappingKeys.delete(name);
}

/** Returns the PIN vault only when this account has opted into PIN protection. */
export async function getPinProtectedE2EEVault(userId) {
    const name = databaseNameForUser(userId);
    const record = await readRecord(name);
    return record ? createPinProtectedE2EEVault(userId) : null;
}

/** Cleans up an unfinished PIN setup without touching an already-wrapped key. */
export async function cancelPinProtectedE2EEVaultSetup(userId) {
    const name = databaseNameForUser(userId);
    const record = await readRecord(name);
    if (!record?.ciphertext) {
        await deleteRecord(name);
        activeWrappingKeys.delete(name);
    }
}
