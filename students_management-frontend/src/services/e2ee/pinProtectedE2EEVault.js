const DB_NAME = 'student-manager-e2ee-pin-vault-v1';
const STORE_NAME = 'wrapped-keys';
const ITERATIONS = 310000;
const activeWrappingKeys = new Map();

const databaseNameForUser = userId => `student-manager-e2ee-user-${String(userId)}.db`;
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const bytesEqual = (left, right) => {
    const a = new Uint8Array(left);
    const b = new Uint8Array(right);
    if (a.length !== b.length) return false;
    let difference = 0;
    for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
    return difference === 0;
};

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

/*
 * Compatibility bridge to the SDK's documented default web vault layout.
 * The SDK does not export its IndexedDB vault implementation as a public
 * package subpath, so use the same DB/store/key shape for one-time migration.
 */
const LEGACY_DB_NAME = 'open-e2ee-secret-vault';
const LEGACY_STORE_NAME = 'secrets';

function openLegacyDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(LEGACY_DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(LEGACY_STORE_NAME)) {
                request.result.createObjectStore(LEGACY_STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Không mở được kho khóa E2EE cũ.'));
    });
}

async function legacyGetSecret(name) {
    const db = await openLegacyDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(LEGACY_STORE_NAME, 'readonly');
            const request = tx.objectStore(LEGACY_STORE_NAME).get(name);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error || new Error('Không đọc được khóa E2EE cũ.'));
            tx.onabort = () => reject(tx.error || new Error('Đọc khóa E2EE cũ bị hủy.'));
        });
    } finally {
        db.close();
    }
}

async function legacySetSecret(name, value) {
    const db = await openLegacyDatabase();
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(LEGACY_STORE_NAME, 'readwrite');
            tx.objectStore(LEGACY_STORE_NAME).put(new Uint8Array(value), name);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Không ghi được khóa E2EE cũ.'));
            tx.onabort = () => reject(tx.error || new Error('Ghi khóa E2EE cũ bị hủy.'));
        });
    } finally {
        db.close();
    }
}

async function legacyDeleteSecret(name) {
    const db = await openLegacyDatabase();
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(LEGACY_STORE_NAME, 'readwrite');
            tx.objectStore(LEGACY_STORE_NAME).delete(name);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Không xóa được khóa E2EE cũ.'));
            tx.onabort = () => reject(tx.error || new Error('Xóa khóa E2EE cũ bị hủy.'));
        });
    } finally {
        db.close();
    }
}

const legacyVault = {
    getSecret: legacyGetSecret,
    setSecret: legacySetSecret,
    deleteSecret: legacyDeleteSecret
};

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

async function encryptSecret(secret, key, salt, context) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) },
        key,
        new Uint8Array(secret)
    );
    return { version: 1, salt: encode(salt), iv: encode(iv), ciphertext: encode(ciphertext) };
}

async function decryptSecret(record, key, context) {
    if (!record?.iv || !record?.ciphertext) return null;
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: decode(record.iv), additionalData: new TextEncoder().encode(context) },
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
/** True only when this account already has PIN-wrapped or legacy E2EE key material. */
export async function hasExistingPinProtectedE2EEVaultMaterial(userId) {
    if (!/^[1-9][0-9]*$/.test(String(userId ?? ''))) return false;
    const name = databaseNameForUser(userId);
    const wrappedRecord = await readRecord(name);
    if (wrappedRecord?.ciphertext) return true;
    return Boolean(await legacyVault.getSecret(name));
}

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
            await decryptSecret(record, wrappingKey, name);
        } catch {
            throw new Error('PIN không thể mở khóa kho E2EE này.');
        }
    }
    activeWrappingKeys.set(name, wrappingKey);

    try {
        const legacyKey = await legacyVault.getSecret(name);
        if (legacyKey) {
            if (!record.ciphertext) {
                const wrapped = await encryptSecret(legacyKey, wrappingKey, decode(record.salt), name);
                await writeRecord(name, wrapped);
                record = wrapped;
            } else {
                const wrappedKey = await decryptSecret(record, wrappingKey, name);
                if (!bytesEqual(wrappedKey, legacyKey)) {
                    throw new Error('Khóa trong kho cũ khác khóa đã bọc; giữ nguyên bản gốc để tránh mất lịch sử E2EE.');
                }
            }
            // Delete the unwrapped copy only after the wrapped copy is durable and verified.
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
            if (record?.ciphertext) return decryptSecret(record, wrappingKey, name);

            // Migration path for a pre-PIN installation whose SDK key is still
            // in the legacy vault. This does not reset or recreate the database.
            const legacyKey = await legacyVault.getSecret(name);
            if (!legacyKey) return null;
            const salt = record?.salt ? decode(record.salt) : crypto.getRandomValues(new Uint8Array(16));
            const wrapped = await encryptSecret(legacyKey, wrappingKey, salt, name);
            await writeRecord(name, wrapped);
            await legacyVault.deleteSecret(name);
            return legacyKey;
        },
        async setSecret(secretName, secret) {
            if (secretName !== name) throw new Error('Tên khóa kho E2EE không khớp tài khoản.');
            const wrappingKey = requireWrappingKey(name);
            const current = await readRecord(name);
            const salt = current?.salt ? decode(current.salt) : crypto.getRandomValues(new Uint8Array(16));
            await writeRecord(name, await encryptSecret(secret, wrappingKey, salt, name));
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
        const key = await decryptSecret(record, wrappingKey, name);
        await legacyVault.setSecret(name, key);
    }
    await deleteRecord(name);
    activeWrappingKeys.delete(name);
}

/** Returns the PIN vault only when this account has opted into PIN protection. */
export async function getPinProtectedE2EEVault(userId) {
    // Preserve the existing E2EE startup path when chat PIN protection is not enabled.
    if (!globalThis.localStorage?.getItem('student-manager:chat-lock:v1')) return null;
    const name = databaseNameForUser(userId);
    const record = await readRecord(name);
    if (!record) {
        const error = new Error('PIN đã bật nhưng kho khóa E2EE chưa được mở bằng PIN.');
        error.code = 'E2EE_PIN_VAULT_NOT_PROVISIONED';
        throw error;
    }
    return createPinProtectedE2EEVault(userId);
}

/** Cancels PIN setup safely; if a key was already wrapped, restore it first. */
export async function cancelPinProtectedE2EEVaultSetup(userId) {
    const name = databaseNameForUser(userId);
    const record = await readRecord(name);
    if (record?.ciphertext) {
        const wrappingKey = requireWrappingKey(name);
        const key = await decryptSecret(record, wrappingKey, name);
            await legacyVault.setSecret(name, key);
    }
    await deleteRecord(name);
    activeWrappingKeys.delete(name);
}
