import type { DeviceMaterial, PublicPrekeyBundle } from "./device";

export type RecoveryBundleMode = "local_encrypted_transfer" | "passphrase_encrypted_backup";

export type ExportDeviceTransferBundlePayload = {
  material?: DeviceMaterial;
  deviceMaterial?: DeviceMaterial;
  localDevice?: DeviceMaterial;
  transferSecret?: string;
  createdAt?: string;
};

export type ImportDeviceTransferBundlePayload = {
  bundle?: RecoveryBundle;
  transferBundle?: RecoveryBundle;
  transferSecret?: string;
};

export type ExportEncryptedRecoveryBundlePayload = {
  material?: DeviceMaterial;
  deviceMaterial?: DeviceMaterial;
  localDevice?: DeviceMaterial;
  recoverySecret?: string;
  passphrase?: string;
  userControlledSecret?: string;
  createdAt?: string;
};

export type ImportEncryptedRecoveryBundlePayload = {
  bundle?: RecoveryBundle;
  recoveryBundle?: RecoveryBundle;
  recoverySecret?: string;
  passphrase?: string;
  userControlledSecret?: string;
};

export type RecoveryBundle = {
  schemaVersion: 1;
  protocol: "e2ee-runtime-recovery-v1";
  mode: RecoveryBundleMode;
  createdAt: string;
  runtimeVersion: string;
  sourceRepository: string;
  kdf: {
    name: "PBKDF2-SHA-256";
    iterations: number;
    saltBase64: string;
  };
  cipher: {
    name: "AES-GCM";
    ivBase64: string;
  };
  encryptedDeviceStateBase64: string;
  publicPrekeyBundle: PublicPrekeyBundle;
};

export type ImportRecoveryBundleResult = {
  material: DeviceMaterial;
  privateKeyMaterial: Record<string, unknown>;
  prekeyBundle: PublicPrekeyBundle;
};

