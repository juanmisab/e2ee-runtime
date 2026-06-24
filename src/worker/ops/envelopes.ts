import type { DeviceMaterial, PublicPrekeyBundle } from "./device";

export type EncryptEnvelopePayload = {
  senderMaterial?: DeviceMaterial;
  localDevice?: DeviceMaterial;
  material?: DeviceMaterial;
  recipientPrekeyBundle?: PublicPrekeyBundle;
  prekeyBundle?: PublicPrekeyBundle;
  recipientBundle?: PublicPrekeyBundle;
  plaintext?: string;
  plaintextBase64?: string;
  envelopeType?: string;
  senderAddressName?: string;
  recipientAddressName?: string;
  recipientDeviceId?: string;
  recipientProtocolDeviceId?: number;
  recipientSignalDeviceId?: number;
  recipientIdentityKeyPublic?: string;
};

export type DecryptEnvelopePayload = {
  recipientMaterial?: DeviceMaterial;
  localDevice?: DeviceMaterial;
  material?: DeviceMaterial;
  envelope?: Record<string, unknown>;
  ciphertext?: string;
  ciphertextBase64?: string;
  signalCiphertextType?: number;
  messageType?: number;
  senderAddressName?: string;
  recipientAddressName?: string;
  senderProtocolDeviceId?: number;
  senderSignalDeviceId?: number;
  recipientProtocolDeviceId?: number;
  senderIdentityKeyPublic?: string;
};

export type EncryptEnvelopeResult = {
  recipientDeviceId: string;
  envelopeType: string;
  ciphertext: string;
  ciphertextBase64: string;
  signalCiphertextType: number;
  senderAddress: string;
  senderProtocolDeviceId: number;
  recipientAddress: string;
  recipientProtocolDeviceId: number;
  prekeyBundleProcessed: boolean;
  updatedSenderMaterial: DeviceMaterial;
};

export type DecryptEnvelopeResult = {
  plaintext: string;
  plaintextBase64: string;
  senderAddress: string;
  senderProtocolDeviceId: number;
  recipientAddress: string;
  recipientProtocolDeviceId: number;
  updatedRecipientMaterial: DeviceMaterial;
};

