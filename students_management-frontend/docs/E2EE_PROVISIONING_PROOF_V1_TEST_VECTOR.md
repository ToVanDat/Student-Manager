# Provisioning Proof v1 — Deterministic Test Vector

This vector is synthetic and MUST only be used in tests. The ECDH shared secret and all public inputs are fixed byte patterns, not production credentials. The derived proof key is intentionally shown here so implementations can be cross-checked; never log or expose a production proof key.

## Inputs

- Protocol version: `0x01`
- Session ID UTF-8: `test-session-001`
- Shared secret: `11` repeated 32 bytes
- Challenge: `22` repeated 32 bytes
- Primary ephemeral public key: `33` repeated 32 bytes
- New-device ephemeral public key: `44` repeated 32 bytes
- Exact encrypted-message UTF-8 string:

```json
{"ciphertext":"AQIDBA==","iv":"BQUFBQUFBQUFBQUF","authTag":"BgYGBgYGBgYGBgYGBgYGBg=="}
```

## Expected intermediate values

- SHA-256(exact ciphertext UTF-8):
  `5f0e97b00b7260b889a4c769e76668255c74bab52dd1e749f42333bbd3273fe5`
- Salt:
  `dc30c970c6d9422c5be80bf2b521be3427b3e03f71afdceea62acd9a5e13d1a6`
- Derived proof key (test only):
  `517cfcffb6232d2f6e7453c4841aff6836172afa4493087649fb5a18d669c007`
- SHA-256(canonical transcript):
  `7ba6ebba1874ec0418ee48cb06fc38f94baab7fbebce376baf2eba8e65aa3e22`
- HMAC-SHA-256 proof:
  - Hex: `591552357325914907c226ab5fc9eabd6465f65285626f66f0cb7d914cacbf01`
  - Base64: `WRVSNXMlkUkHwiarX8nqvWRl9lKFYm9m8Mt9kUysvwE=`

## Encoding rules exercised

- The transcript begins with ASCII `StudentManager/E2EE/ProvisioningTranscript/v1`.
- The version is one byte.
- Session ID is prefixed by a 4-byte unsigned big-endian length.
- Challenge, both X25519 public keys, and ciphertext digest are each exactly 32 bytes.
- Ciphertext digest is computed over the exact UTF-8 string, not parsed/re-serialized JSON.
- HKDF-SHA-256 uses the salt and info labels specified in `E2EE_PROVISIONING_PROOF_SDK_FORK_CONTRACT.md`.

An SDK implementation MUST reproduce these exact values before backend integration. Add negative tests by changing one input byte at a time and asserting the proof changes; reject noncanonical Base64 and any fixed-size field that is not exactly 32 bytes.
