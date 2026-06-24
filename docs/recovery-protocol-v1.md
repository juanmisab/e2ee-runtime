# Recovery Protocol v1

Status: pre-alpha public contract.

This protocol defines generic encrypted device-state bundles for browser E2EE
runtime consumers. It does not define product auth, passkeys, QR ceremonies,
organization membership, storage buckets, RLS, or UI.

## Boundary

```text
private product app -> JSON postMessage -> public AGPL Worker artifact
```

The Worker may export encrypted recovery artifacts. Private key material must
not be stored or transported in plaintext outside the local Worker call result.

## Worker Ops

- `exportDeviceTransferBundle`
- `importDeviceTransferBundle`
- `exportEncryptedRecoveryBundle`
- `importEncryptedRecoveryBundle`

## Device Transfer

`exportDeviceTransferBundle` encrypts a full device material snapshot for a
recipient that has a user-controlled transfer secret.

Expected private-product ceremony examples:

- same-account new-device QR code
- old-device approval screen
- passkey step-up before the old device exports

The runtime does not know how that approval happened. It only receives a JSON
payload and a transfer secret.

## Encrypted Recovery Bundle

`exportEncryptedRecoveryBundle` encrypts a full device material snapshot for
later recovery with a user-controlled recovery secret or passphrase.

Expected private-product ceremony examples:

- passkey step-up before backup download
- recovery phrase or recovery key typed locally
- optional product-side escrow of encrypted ciphertext only

Passkeys authenticate or approve recovery, but this runtime does not treat a
passkey as the encryption key. Product code must provide the recovery secret.

## Bundle Shape

```json
{
  "schemaVersion": 1,
  "protocol": "e2ee-runtime-recovery-v1",
  "mode": "local_encrypted_transfer",
  "createdAt": "2026-06-24T00:00:00.000Z",
  "runtimeVersion": "0.1.0-prealpha.5",
  "sourceRepository": "https://github.com/juanmisab/e2ee-runtime",
  "kdf": {
    "name": "PBKDF2-SHA-256",
    "iterations": 210000,
    "saltBase64": "..."
  },
  "cipher": {
    "name": "AES-GCM",
    "ivBase64": "..."
  },
  "encryptedDeviceStateBase64": "...",
  "publicPrekeyBundle": {}
}
```

Modes:

- `local_encrypted_transfer`
- `passphrase_encrypted_backup`

## Non-Goals

- No Supabase tables or RLS.
- No Dominize org or location membership logic.
- No passkey implementation.
- No server-readable private key material.
- No mobile/Expo approval for the AGPL runtime route.
