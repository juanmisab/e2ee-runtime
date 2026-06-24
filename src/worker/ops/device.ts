export type DeviceMaterial = {
  protocol: "signal-v1";
  registrationId: number;
  signalDeviceId: number;
  identityKeyPublic: string;
  identityKeyPrivate: string;
  signedPrekey: PublicSignedPrekey;
  oneTimePrekeys: PublicOneTimePrekey[];
  kyberPrekeys: PublicKyberPrekey[];
  privateKeyMaterial: Record<string, unknown>;
};

export type PublicOneTimePrekey = {
  prekeyId: number;
  publicKey: string;
};

export type PublicSignedPrekey = {
  prekeyId: number;
  publicKey: string;
  signature: string;
};

export type PublicKyberPrekey = PublicSignedPrekey;

export type CreateDeviceMaterialPayload = {
  registrationId?: number;
  signalDeviceId?: number;
  signedPreKeyId?: number;
  oneTimePreKeyStartId?: number;
  oneTimePreKeyCount?: number;
  kyberPreKeyId?: number;
  kyberPreKeyStartId?: number;
  kyberPreKeyCount?: number;
};

export type GeneratePrekeyBatchPayload = {
  material?: DeviceMaterial;
  deviceMaterial?: DeviceMaterial;
  localDevice?: DeviceMaterial;
  oneTimePreKeyStartId?: number;
  oneTimePreKeyCount?: number;
  kyberPreKeyStartId?: number;
  kyberPreKeyCount?: number;
  rotateSignedPrekey?: boolean;
  signedPreKeyId?: number;
};

export type DeviceMaterialResult = {
  material: DeviceMaterial;
  prekeyBundle: PublicPrekeyBundle;
};

export type GeneratePrekeyBatchResult = DeviceMaterialResult & {
  generated: {
    oneTimePrekeys: PublicOneTimePrekey[];
    kyberPrekeys: PublicKyberPrekey[];
    signedPrekey?: PublicSignedPrekey;
  };
};

export type PublicPrekeyBundle = {
  protocol: "signal-v1";
  registrationId: number;
  identityKeyPublic: string;
  signedPrekey: PublicSignedPrekey;
  signalDeviceId: number;
  oneTimePrekeys: PublicOneTimePrekey[];
  kyberPrekeys: PublicKyberPrekey[];
};

