import type { DeviceMaterial, PublicPrekeyBundle } from "./device";

export type AttachmentRecipient = {
  recipientDeviceId: string;
  recipientPrekeyBundle?: PublicPrekeyBundle;
  prekeyBundle?: PublicPrekeyBundle;
  recipientBundle?: PublicPrekeyBundle;
  senderAddressName?: string;
  recipientAddressName?: string;
  addressName?: string;
  principalId?: string;
  recipientProtocolDeviceId?: number;
  signalDeviceId?: number;
  recipientSignalDeviceId?: number;
  identityKeyPublic?: string;
};

export type EncryptAttachmentPayload = {
  senderMaterial?: DeviceMaterial;
  senderDevice?: DeviceMaterial;
  localDevice?: DeviceMaterial;
  material?: DeviceMaterial;
  recipients: AttachmentRecipient[];
  plaintext?: string | number[];
  plaintextBase64?: string;
  attachmentPlaintextBase64?: string;
  associatedData?: string;
  senderAddressName?: string;
};

export type AttachmentKeyWrapper = {
  recipientDeviceId: string;
  wrappedKeyCiphertext: string;
  wrappingAlgorithm: "signal-envelope-key-wrap-v1";
  signalCiphertextType: number;
  senderAddress: string;
  senderProtocolDeviceId: number;
  recipientAddress: string;
  recipientProtocolDeviceId: number;
  prekeyBundleProcessed: boolean;
};

export type EncryptAttachmentResult = {
  algorithm: "AES-256-GCM";
  ciphertext: string;
  ciphertextBase64: string;
  ciphertextSizeBytes: number;
  nonce: string;
  associatedData?: string;
  keyWrappers: AttachmentKeyWrapper[];
  encryptedMetadata: {
    version: 1;
    algorithm: "AES-256-GCM";
    nonce: string;
    associatedData?: string;
    keyWrappers: AttachmentKeyWrapper[];
  };
  updatedSenderMaterial: DeviceMaterial;
};

export type DecryptAttachmentPayload = {
  recipientMaterial?: DeviceMaterial;
  recipientDevice?: DeviceMaterial;
  localDevice?: DeviceMaterial;
  material?: DeviceMaterial;
  attachment?: Record<string, unknown>;
  encryptedMetadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  recipientDeviceId?: string;
  localDeviceId?: string;
  deviceId?: string;
  ciphertext?: string | number[];
  ciphertextBase64?: string;
  associatedData?: string;
};

export type DecryptAttachmentResult = {
  plaintextBase64: string;
  updatedRecipientMaterial: DeviceMaterial;
};

