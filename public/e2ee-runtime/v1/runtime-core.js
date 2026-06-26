import initWasm, {
  WasmIdentityKeyPair,
  WasmInMemIdentityKeyStore,
  WasmInMemKyberPreKeyStore,
  WasmInMemPreKeyStore,
  WasmInMemSessionStore,
  WasmInMemSignedPreKeyStore,
  WasmPrivateKey,
  WasmProtocolAddress,
  WasmPublicKey,
  decryptMessage,
  encryptMessage,
  generate_attachment_key,
  generateKyberPreKey,
  generatePreKeys,
  generateRegistrationId,
  generateSignedPreKey,
  generate_random_bytes,
  generate_uuid,
  message_type_pre_key,
  message_type_sender_key,
  message_type_signal,
  processPreKeyBundle,
  uuid_to_string,
} from "./signal_wasm.js";
import { runtimeMetadata } from "./abi.js";

const LOCAL_DEVICE_ATTACHMENT_KEY_WRAP_ALGORITHM = "local-device-private-state-v1";

export {
  generateRegistrationId,
  generate_random_bytes,
  generate_uuid,
  message_type_pre_key,
  message_type_sender_key,
  message_type_signal,
};

let wasmReady;

export async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = initWasm({ module_or_path: new URL("./runtime.wasm", import.meta.url) });
  }
  await wasmReady;
}

export function generateIdentityKeyPair() {
  const privateKey = WasmPrivateKey.generate();
  const publicKey = privateKey.getPublicKey();
  const identity = new WasmIdentityKeyPair(publicKey, privateKey);
  try {
    return {
      identityKeyPairBase64: bytesToBase64(identity.serialize()),
      publicKeyBase64: bytesToBase64(identity.public_key.serialize()),
      privateKeyBase64: bytesToBase64(identity.private_key.serialize()),
    };
  } finally {
    identity.free();
    publicKey.free();
    privateKey.free();
  }
}

export async function createDeviceMaterial(payload) {
  const options = normalizeCreateDeviceMaterialPayload(payload);
  const privateKey = WasmPrivateKey.generate();
  const publicKey = privateKey.getPublicKey();
  const identity = new WasmIdentityKeyPair(publicKey, privateKey);
  const preKeyStore = new WasmInMemPreKeyStore();
  const signedPreKeyStore = new WasmInMemSignedPreKeyStore();
  const kyberPreKeyStore = new WasmInMemKyberPreKeyStore();
  const preKeys = [];
  const kyberPreKeys = [];
  let signedPreKey;

  try {
    for (const preKey of await generatePreKeys(
      options.oneTimePreKeyStartId,
      options.oneTimePreKeyCount,
      preKeyStore,
    )) {
      preKeys.push(preKey);
    }
    signedPreKey = await generateSignedPreKey(
      options.signedPreKeyId,
      identity,
      signedPreKeyStore,
    );
    for (let index = 0; index < options.kyberPreKeyCount; index += 1) {
      kyberPreKeys.push(
        await generateKyberPreKey(
          options.kyberPreKeyStartId + index,
          identity,
          kyberPreKeyStore,
        ),
      );
    }

    const oneTimePrekeys = preKeys.map((preKey) => ({
      prekeyId: preKey.id,
      publicKey: bytesToBase64(preKey.public_key),
    }));
    const oneTimePreKeyRecords = preKeys.map((preKey) => ({
      prekeyId: preKey.id,
      record: bytesToBase64(preKey.record),
    }));
    const signedPrekey = {
      prekeyId: signedPreKey.id,
      publicKey: bytesToBase64(signedPreKey.public_key),
      signature: bytesToBase64(signedPreKey.signature),
    };
    const kyberPrekeys = kyberPreKeys.map((preKey) => ({
      prekeyId: preKey.id,
      publicKey: bytesToBase64(preKey.public_key),
      signature: bytesToBase64(preKey.signature),
    }));
    const kyberPreKeyRecords = kyberPreKeys.map((preKey) => ({
      prekeyId: preKey.id,
      record: bytesToBase64(preKey.record),
      timestamp: preKey.timestamp.toString(),
    }));
    const material = {
      protocol: "signal-v1",
      registrationId: options.registrationId,
      signalDeviceId: options.signalDeviceId,
      identityKeyPublic: bytesToBase64(publicKey.serialize()),
      identityKeyPrivate: bytesToBase64(privateKey.serialize()),
      signedPrekey,
      oneTimePrekeys,
      kyberPrekeys,
      privateKeyMaterial: {
        signalPrivateStateSchemaVersion: 1,
        libsignalPackage: "getmaapp/signal-wasm@0.2.0",
        identityKeyPairRecord: bytesToBase64(identity.serialize()),
        signedPreKeyRecord: bytesToBase64(signedPreKey.record),
        signedPreKeyRecords: [
          {
            prekeyId: signedPreKey.id,
            record: bytesToBase64(signedPreKey.record),
            timestamp: signedPreKey.timestamp.toString(),
          },
        ],
        oneTimePreKeyRecord: oneTimePreKeyRecords[0]?.record,
        oneTimePreKeyRecords,
        kyberPreKeyRecord: kyberPreKeyRecords[0]?.record,
        kyberPreKeyRecords,
        sessionRecords: [],
        trustedIdentities: [],
        knownRecipientDevices: [],
      },
    };

    return {
      material,
      prekeyBundle: createPrekeyBundleFromMaterial(material),
    };
  } finally {
    for (const preKey of preKeys) {
      preKey.free();
    }
    for (const preKey of kyberPreKeys) {
      preKey.free();
    }
    signedPreKey?.free();
    preKeyStore.free();
    signedPreKeyStore.free();
    kyberPreKeyStore.free();
    identity.free();
    publicKey.free();
    privateKey.free();
  }
}

export function exportPrekeyBundle(payload) {
  const material = resolveDeviceMaterial(payload);
  return createPrekeyBundleFromMaterial(material);
}

export async function generatePrekeyBatch(payload) {
  const input = assertObject(payload, "payload");
  const material = cloneJson(resolveDeviceMaterial(input.material ?? input.deviceMaterial ?? input.localDevice ?? input));
  const privateKeyMaterial = {
    ...(isObject(material.privateKeyMaterial) ? material.privateKeyMaterial : {}),
  };
  const options = normalizeGeneratePrekeyBatchPayload(input, material, privateKeyMaterial);
  const identity = restoreIdentityKeyPair(material, privateKeyMaterial);
  const preKeyStore = new WasmInMemPreKeyStore();
  const signedPreKeyStore = new WasmInMemSignedPreKeyStore();
  const kyberPreKeyStore = new WasmInMemKyberPreKeyStore();
  const preKeys = [];
  const kyberPreKeys = [];
  let signedPreKey;

  try {
    for (const preKey of await generatePreKeys(
      options.oneTimePreKeyStartId,
      options.oneTimePreKeyCount,
      preKeyStore,
    )) {
      preKeys.push(preKey);
    }
    for (let index = 0; index < options.kyberPreKeyCount; index += 1) {
      kyberPreKeys.push(
        await generateKyberPreKey(
          options.kyberPreKeyStartId + index,
          identity,
          kyberPreKeyStore,
        ),
      );
    }
    if (options.rotateSignedPrekey) {
      signedPreKey = await generateSignedPreKey(
        options.signedPreKeyId,
        identity,
        signedPreKeyStore,
      );
    }

    const generatedOneTimePrekeys = preKeys.map((preKey) => ({
      prekeyId: preKey.id,
      publicKey: bytesToBase64(preKey.public_key),
    }));
    const generatedOneTimePreKeyRecords = preKeys.map((preKey) => ({
      prekeyId: preKey.id,
      record: bytesToBase64(preKey.record),
    }));
    const generatedKyberPrekeys = kyberPreKeys.map((preKey) => ({
      prekeyId: preKey.id,
      publicKey: bytesToBase64(preKey.public_key),
      signature: bytesToBase64(preKey.signature),
    }));
    const generatedKyberPreKeyRecords = kyberPreKeys.map((preKey) => ({
      prekeyId: preKey.id,
      record: bytesToBase64(preKey.record),
      timestamp: preKey.timestamp.toString(),
    }));

    material.oneTimePrekeys = [
      ...assertOptionalArray(material.oneTimePrekeys, "material.oneTimePrekeys"),
      ...generatedOneTimePrekeys,
    ];
    privateKeyMaterial.oneTimePreKeyRecords = [
      ...assertOptionalArray(privateKeyMaterial.oneTimePreKeyRecords, "privateKeyMaterial.oneTimePreKeyRecords"),
      ...generatedOneTimePreKeyRecords,
    ];
    privateKeyMaterial.oneTimePreKeyRecord = privateKeyMaterial.oneTimePreKeyRecords[0]?.record;

    material.kyberPrekeys = [
      ...assertOptionalArray(material.kyberPrekeys, "material.kyberPrekeys"),
      ...generatedKyberPrekeys,
    ];
    privateKeyMaterial.kyberPreKeyRecords = [
      ...assertOptionalArray(privateKeyMaterial.kyberPreKeyRecords, "privateKeyMaterial.kyberPreKeyRecords"),
      ...generatedKyberPreKeyRecords,
    ];
    privateKeyMaterial.kyberPreKeyRecord = privateKeyMaterial.kyberPreKeyRecords[0]?.record;

    let generatedSignedPrekey = null;
    if (signedPreKey) {
      generatedSignedPrekey = {
        prekeyId: signedPreKey.id,
        publicKey: bytesToBase64(signedPreKey.public_key),
        signature: bytesToBase64(signedPreKey.signature),
      };
      material.signedPrekey = generatedSignedPrekey;
      privateKeyMaterial.signedPreKeyRecord = bytesToBase64(signedPreKey.record);
      privateKeyMaterial.signedPreKeyRecords = [
        ...assertOptionalArray(privateKeyMaterial.signedPreKeyRecords, "privateKeyMaterial.signedPreKeyRecords"),
        {
          prekeyId: signedPreKey.id,
          record: privateKeyMaterial.signedPreKeyRecord,
          timestamp: signedPreKey.timestamp.toString(),
        },
      ];
    }

    material.privateKeyMaterial = privateKeyMaterial;

    return {
      material,
      prekeyBundle: createPrekeyBundleFromMaterial(material),
      generated: {
        oneTimePrekeys: generatedOneTimePrekeys,
        kyberPrekeys: generatedKyberPrekeys,
        ...(generatedSignedPrekey ? { signedPrekey: generatedSignedPrekey } : {}),
      },
    };
  } finally {
    for (const preKey of preKeys) {
      preKey.free();
    }
    for (const preKey of kyberPreKeys) {
      preKey.free();
    }
    signedPreKey?.free();
    preKeyStore.free();
    signedPreKeyStore.free();
    kyberPreKeyStore.free();
    identity.free();
  }
}

export async function encryptEnvelope(payload) {
  return encryptRuntimeEnvelope(payload, { requirePrekeyBundle: true });
}

export async function encryptKnownSessionEnvelope(payload) {
  return encryptRuntimeEnvelope(payload, { requirePrekeyBundle: false });
}

async function encryptRuntimeEnvelope(payload, options) {
  const input = assertObject(payload, "payload");
  const senderMaterial = resolveDeviceMaterial(
    input.senderMaterial ?? input.localDevice ?? input.material,
  );
  const prekeyBundleInput = input.recipientPrekeyBundle ?? input.prekeyBundle ?? input.recipientBundle;
  const recipientPrekeyBundle = isObject(prekeyBundleInput) ? prekeyBundleInput : null;
  if (options.requirePrekeyBundle && !recipientPrekeyBundle) {
    throw new Error("encryptEnvelope payload requires recipientPrekeyBundle");
  }
  const plaintext = resolvePlaintextBytes(input);
  const senderAddressName = optionalString(input.senderAddressName) ?? "sender";
  const knownRecipient = recipientPrekeyBundle
    ? null
    : resolveKnownRecipientDevice(senderMaterial, input);
  const recipientAddressName =
    optionalString(input.recipientAddressName) ??
    optionalString(knownRecipient?.addressName) ??
    "recipient";
  const recipientDeviceId = optionalString(input.recipientDeviceId) ?? recipientAddressName;
  const envelopeType = optionalString(input.envelopeType) ?? "message";
  const senderState = await createSenderRuntimeState(senderMaterial);
  const senderAddress = new WasmProtocolAddress(
    senderAddressName,
    assertInteger(senderMaterial.signalDeviceId, "senderMaterial.signalDeviceId", 1, 127),
  );
  const recipientProtocolDeviceId = recipientPrekeyBundle
    ? assertInteger(recipientPrekeyBundle.signalDeviceId, "recipientPrekeyBundle.signalDeviceId", 1, 127)
    : resolveRecipientProtocolDeviceId(senderMaterial, input, recipientAddressName, recipientDeviceId);
  const recipientAddress = new WasmProtocolAddress(
    recipientAddressName,
    recipientProtocolDeviceId,
  );
  let recipientIdentityKey = null;
  let signedPrekeyPublic = null;
  let ciphertext;

  try {
    if (recipientPrekeyBundle) {
      recipientIdentityKey = WasmPublicKey.deserialize(
        base64ToBytes(assertString(recipientPrekeyBundle.identityKeyPublic, "recipientPrekeyBundle.identityKeyPublic")),
      );
      const signedPrekey = assertObject(recipientPrekeyBundle.signedPrekey, "recipientPrekeyBundle.signedPrekey");
      signedPrekeyPublic = WasmPublicKey.deserialize(
        base64ToBytes(assertString(signedPrekey.publicKey, "recipientPrekeyBundle.signedPrekey.publicKey")),
      );
      const oneTimePrekey = firstOptionalPrekey(
        recipientPrekeyBundle.oneTimePrekeys,
        "recipientPrekeyBundle.oneTimePrekeys",
      );
      const kyberPrekey = firstRequiredPrekey(
        recipientPrekeyBundle.kyberPrekeys,
        "recipientPrekeyBundle.kyberPrekeys",
      );

      await processPreKeyBundle(
        recipientAddress,
        senderAddress,
        assertInteger(recipientPrekeyBundle.registrationId, "recipientPrekeyBundle.registrationId", 1, 0x7fffffff),
        recipientIdentityKey,
        assertInteger(signedPrekey.prekeyId, "recipientPrekeyBundle.signedPrekey.prekeyId", 1, 0x00ffffff),
        signedPrekeyPublic,
        base64ToBytes(assertString(signedPrekey.signature, "recipientPrekeyBundle.signedPrekey.signature")),
        oneTimePrekey?.prekeyId,
        oneTimePrekey?.publicKeyBytes,
        kyberPrekey.prekeyId,
        kyberPrekey.publicKeyBytes,
        kyberPrekey.signatureBytes,
        senderState.sessionStore,
        senderState.identityStore,
      );
    }

    ciphertext = await encryptMessage(
      plaintext,
      recipientAddress,
      senderAddress,
      senderState.sessionStore,
      senderState.identityStore,
    );
    const sessionRecord = await senderState.sessionStore.export_session(recipientAddress);
    const updatedSenderMaterial = updateSenderMaterialAfterEncrypt(
      senderMaterial,
      {
        recipientDeviceId,
        addressName: recipientAddressName,
        signalDeviceId: recipientAddress.deviceId,
        sessionRecordBase64: sessionRecord ? bytesToBase64(sessionRecord) : null,
        recipientIdentityKeyPublic: recipientPrekeyBundle
          ? assertString(recipientPrekeyBundle.identityKeyPublic, "recipientPrekeyBundle.identityKeyPublic")
          : optionalString(input.recipientIdentityKeyPublic),
      },
    );
    const ciphertextBase64 = bytesToBase64(ciphertext.body);

    return {
      recipientDeviceId,
      envelopeType,
      ciphertext: ciphertextBase64,
      ciphertextBase64,
      signalCiphertextType: ciphertext.message_type,
      senderAddress: senderAddress.name,
      senderProtocolDeviceId: senderAddress.deviceId,
      recipientAddress: recipientAddress.name,
      recipientProtocolDeviceId: recipientAddress.deviceId,
      prekeyBundleProcessed: Boolean(recipientPrekeyBundle),
      updatedSenderMaterial,
    };
  } finally {
    ciphertext?.free();
    signedPrekeyPublic?.free();
    recipientIdentityKey?.free();
    recipientAddress.free();
    senderAddress.free();
    senderState.free();
  }
}

export async function decryptEnvelope(payload) {
  const input = assertObject(payload, "payload");
  const envelope = isObject(input.envelope) ? input.envelope : input;
  const recipientMaterial = resolveDeviceMaterial(
    input.recipientMaterial ?? input.localDevice ?? input.material,
  );
  const ciphertextBytes = resolveCiphertextBytes(input, envelope);
  const messageType = assertInteger(
    input.signalCiphertextType ?? envelope.signalCiphertextType ?? input.messageType ?? envelope.messageType,
    "signalCiphertextType",
    1,
    255,
  );
  const senderAddressName =
    optionalString(input.senderAddressName) ??
    optionalString(envelope.senderAddress) ??
    "sender";
  const recipientAddressName =
    optionalString(input.recipientAddressName) ??
    optionalString(input.localAddressName) ??
    optionalString(envelope.recipientAddress) ??
    "recipient";
  const senderProtocolDeviceId = resolveSenderProtocolDeviceId(input, envelope);
  const recipientProtocolDeviceId = assertInteger(
    input.recipientProtocolDeviceId ?? recipientMaterial.signalDeviceId,
    "recipientProtocolDeviceId",
    1,
    127,
  );
  const receiverState = await createReceiverRuntimeState(recipientMaterial);
  const senderAddress = new WasmProtocolAddress(senderAddressName, senderProtocolDeviceId);
  const recipientAddress = new WasmProtocolAddress(recipientAddressName, recipientProtocolDeviceId);

  try {
    const plaintextBytes = await decryptMessage(
      ciphertextBytes,
      messageType,
      senderAddress,
      recipientAddress,
      receiverState.sessionStore,
      receiverState.identityStore,
      receiverState.preKeyStore,
      receiverState.signedPreKeyStore,
      receiverState.kyberPreKeyStore,
    );
    const sessionRecord = await receiverState.sessionStore.export_session(senderAddress);
    const updatedRecipientMaterial = await updateRecipientMaterialAfterDecrypt(
      recipientMaterial,
      receiverState,
      {
        senderAddressName,
        senderProtocolDeviceId,
        senderIdentityKeyPublic: optionalString(input.senderIdentityKeyPublic ?? envelope.senderIdentityKeyPublic),
        sessionRecordBase64: sessionRecord ? bytesToBase64(sessionRecord) : null,
      },
    );
    const plaintextBase64 = bytesToBase64(plaintextBytes);

    return {
      plaintext: bytesToUtf8(plaintextBytes),
      plaintextBase64,
      senderAddress: senderAddress.name,
      senderProtocolDeviceId: senderAddress.deviceId,
      recipientAddress: recipientAddress.name,
      recipientProtocolDeviceId: recipientAddress.deviceId,
      updatedRecipientMaterial,
    };
  } finally {
    senderAddress.free();
    recipientAddress.free();
    receiverState.free();
  }
}

export function exportDeviceState(payload) {
  const material = resolveDeviceMaterial(payload);
  return {
    material: cloneJson(material),
    privateKeyMaterial: cloneJson(assertObject(material.privateKeyMaterial, "privateKeyMaterial")),
    prekeyBundle: createPrekeyBundleFromMaterial(material),
  };
}

export async function exportDeviceTransferBundle(payload) {
  return exportEncryptedDeviceStateBundle(payload, {
    mode: "local_encrypted_transfer",
    secretLabel: "transferSecret",
  });
}

export async function importDeviceTransferBundle(payload) {
  return importEncryptedDeviceStateBundle(payload, {
    expectedMode: "local_encrypted_transfer",
    secretLabel: "transferSecret",
  });
}

export async function exportEncryptedRecoveryBundle(payload) {
  return exportEncryptedDeviceStateBundle(payload, {
    mode: "passphrase_encrypted_backup",
    secretLabel: "recoverySecret",
  });
}

export async function importEncryptedRecoveryBundle(payload) {
  return importEncryptedDeviceStateBundle(payload, {
    expectedMode: "passphrase_encrypted_backup",
    secretLabel: "recoverySecret",
  });
}

export async function encryptAttachment(payload) {
  assertAttachmentCryptoAvailable();
  const input = assertObject(payload, "payload");
  const senderMaterial = resolveDeviceMaterial(
    input.senderMaterial ?? input.senderDevice ?? input.localDevice ?? input.material,
  );
  const recipients = assertOptionalArray(input.recipients, "recipients");
  if (recipients.length === 0) {
    throw new Error("encryptAttachment payload requires at least one recipient");
  }

  const plaintextBytes = resolveAttachmentPlaintextBytes(input);
  const attachmentKey = generate_attachment_key();
  const contentKeyBytes = await deriveAttachmentContentKeyBytes(attachmentKey);
  const nonceBytes = randomBytes(12);
  const associatedData = resolveAttachmentAssociatedData(input, null);
  const contentKey = await importAttachmentContentKey(contentKeyBytes, ["encrypt"]);
  const encryptedBytes = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonceBytes,
        ...(associatedData ? { additionalData: utf8Bytes(associatedData) } : {}),
      },
      contentKey,
      plaintextBytes,
    ),
  );

  let updatedSenderMaterial = senderMaterial;
  const keyWrappers = [];
  for (const [index, recipientValue] of recipients.entries()) {
    const recipient = assertObject(recipientValue, `recipients[${index}]`);
    const recipientDeviceId = assertString(
      recipient.recipientDeviceId,
      `recipients[${index}].recipientDeviceId`,
    );
    const recipientPrekeyBundle =
      isObject(recipient.recipientPrekeyBundle)
        ? recipient.recipientPrekeyBundle
        : isObject(recipient.prekeyBundle)
          ? recipient.prekeyBundle
          : isObject(recipient.recipientBundle)
            ? recipient.recipientBundle
            : null;
    if (recipient.localDeviceKeyWrap === true) {
      keyWrappers.push(
        await encryptLocalDeviceAttachmentKeyWrapper({
          senderMaterial,
          recipientDeviceId,
          attachmentKey,
        }),
      );
      continue;
    }
    const wrappedKey = await encryptRuntimeEnvelope(
      {
        senderMaterial: updatedSenderMaterial,
        ...(recipientPrekeyBundle ? { recipientPrekeyBundle } : {}),
        senderAddressName:
          optionalString(recipient.senderAddressName) ??
          optionalString(input.senderAddressName) ??
          "sender",
        recipientAddressName:
          optionalString(recipient.recipientAddressName) ??
          optionalString(recipient.addressName) ??
          optionalString(recipient.principalId),
        recipientDeviceId,
        ...(recipient.recipientProtocolDeviceId != null
          ? { recipientProtocolDeviceId: recipient.recipientProtocolDeviceId }
          : recipient.signalDeviceId != null
            ? { recipientProtocolDeviceId: recipient.signalDeviceId }
            : recipient.recipientSignalDeviceId != null
              ? { recipientProtocolDeviceId: recipient.recipientSignalDeviceId }
              : {}),
        ...(optionalString(recipient.identityKeyPublic)
          ? { recipientIdentityKeyPublic: recipient.identityKeyPublic }
          : {}),
        plaintextBase64: bytesToBase64(attachmentKey),
        envelopeType: "attachment_key",
      },
      { requirePrekeyBundle: false },
    );
    updatedSenderMaterial = wrappedKey.updatedSenderMaterial;
    keyWrappers.push({
      recipientDeviceId,
      wrappedKeyCiphertext: wrappedKey.ciphertextBase64,
      wrappingAlgorithm: "signal-envelope-key-wrap-v1",
      signalCiphertextType: wrappedKey.signalCiphertextType,
      senderAddress: wrappedKey.senderAddress,
      senderProtocolDeviceId: wrappedKey.senderProtocolDeviceId,
      recipientAddress: wrappedKey.recipientAddress,
      recipientProtocolDeviceId: wrappedKey.recipientProtocolDeviceId,
      prekeyBundleProcessed: wrappedKey.prekeyBundleProcessed,
    });
  }

  const nonce = bytesToBase64(nonceBytes);
  const encryptedMetadata = {
    version: 1,
    algorithm: "AES-256-GCM",
    nonce,
    ...(associatedData ? { associatedData } : {}),
    keyWrappers,
  };
  const ciphertextBase64 = bytesToBase64(encryptedBytes);
  return {
    algorithm: encryptedMetadata.algorithm,
    ciphertext: ciphertextBase64,
    ciphertextBase64,
    ciphertextSizeBytes: encryptedBytes.byteLength,
    nonce,
    ...(associatedData ? { associatedData } : {}),
    keyWrappers,
    encryptedMetadata,
    updatedSenderMaterial,
  };
}

export async function decryptAttachment(payload) {
  assertAttachmentCryptoAvailable();
  const input = assertObject(payload, "payload");
  const attachment = isObject(input.attachment) ? input.attachment : input;
  const encryptedMetadata = resolveAttachmentMetadata(input, attachment);
  const recipientMaterial = resolveDeviceMaterial(
    input.recipientMaterial ?? input.recipientDevice ?? input.localDevice ?? input.material,
  );
  const recipientDeviceId =
    optionalString(input.recipientDeviceId) ??
    optionalString(input.localDeviceId) ??
    optionalString(input.deviceId);
  const wrapper = selectAttachmentKeyWrapper(encryptedMetadata.keyWrappers, recipientDeviceId);
  const header = resolveAttachmentWrapperHeader(wrapper);
  let attachmentKey;
  let updatedRecipientMaterial = recipientMaterial;
  if (header.wrappingAlgorithm === LOCAL_DEVICE_ATTACHMENT_KEY_WRAP_ALGORITHM) {
    attachmentKey = await decryptLocalDeviceAttachmentKeyWrapper({
      recipientMaterial,
      recipientDeviceId: wrapper.recipientDeviceId,
      wrappedKeyCiphertext: wrapper.wrappedKeyCiphertext,
      nonce: assertString(header.nonce ?? wrapper.nonce, "attachment wrapper nonce"),
    });
  } else {
    const keyEnvelope = {
      recipientDeviceId: wrapper.recipientDeviceId,
      envelopeType: "attachment_key",
      ciphertext: wrapper.wrappedKeyCiphertext,
      ciphertextBase64: wrapper.wrappedKeyCiphertext,
      signalCiphertextType: assertInteger(
        header.signalCiphertextType,
        "attachment wrapper signalCiphertextType",
        1,
        255,
      ),
      senderAddress: assertString(header.senderAddress, "attachment wrapper senderAddress"),
      senderProtocolDeviceId: assertInteger(
        header.senderProtocolDeviceId,
        "attachment wrapper senderProtocolDeviceId",
        1,
        127,
      ),
      recipientAddress: assertString(header.recipientAddress, "attachment wrapper recipientAddress"),
      recipientProtocolDeviceId: assertInteger(
        header.recipientProtocolDeviceId,
        "attachment wrapper recipientProtocolDeviceId",
        1,
        127,
      ),
      prekeyBundleProcessed: header.prekeyBundleProcessed === true,
    };
    const unwrappedKey = await decryptEnvelope({
      recipientMaterial,
      envelope: keyEnvelope,
      senderProtocolDeviceId: keyEnvelope.senderProtocolDeviceId,
      recipientProtocolDeviceId: keyEnvelope.recipientProtocolDeviceId,
    });
    attachmentKey = base64ToBytes(unwrappedKey.plaintextBase64);
    updatedRecipientMaterial = unwrappedKey.updatedRecipientMaterial;
  }
  const contentKeyBytes = await deriveAttachmentContentKeyBytes(attachmentKey);
  const contentKey = await importAttachmentContentKey(contentKeyBytes, ["decrypt"]);
  const associatedData = resolveAttachmentAssociatedData(input, encryptedMetadata);
  const plaintextBytes = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(assertString(encryptedMetadata.nonce, "encryptedMetadata.nonce")),
        ...(associatedData ? { additionalData: utf8Bytes(associatedData) } : {}),
      },
      contentKey,
      resolveAttachmentCiphertextBytes(input, attachment),
    ),
  );

  return {
    plaintextBase64: bytesToBase64(plaintextBytes),
    updatedRecipientMaterial,
  };
}

async function exportEncryptedDeviceStateBundle(payload, options) {
  const input = assertObject(payload, "payload");
  const material = resolveDeviceMaterial(
    input.material ?? input.deviceMaterial ?? input.localDevice ?? input,
  );
  const secret = resolveRecoverySecret(input, options.secretLabel);
  const createdAt = optionalString(input.createdAt) ?? new Date().toISOString();
  const saltBytes = randomBytes(16);
  const ivBytes = randomBytes(12);
  const encryptedBytes = await encryptJsonWithSecret(
    {
      schemaVersion: 1,
      exportedAt: createdAt,
      material: cloneJson(material),
    },
    secret,
    saltBytes,
    ivBytes,
  );

  return {
    schemaVersion: 1,
    protocol: "e2ee-runtime-recovery-v1",
    mode: options.mode,
    createdAt,
    runtimeVersion: runtimeMetadata.runtimeVersion,
    sourceRepository: runtimeMetadata.sourceRepository,
    kdf: {
      name: "PBKDF2-SHA-256",
      iterations: 210000,
      saltBase64: bytesToBase64(saltBytes),
    },
    cipher: {
      name: "AES-GCM",
      ivBase64: bytesToBase64(ivBytes),
    },
    encryptedDeviceStateBase64: bytesToBase64(encryptedBytes),
    publicPrekeyBundle: createPrekeyBundleFromMaterial(material),
  };
}

async function importEncryptedDeviceStateBundle(payload, options) {
  const input = assertObject(payload, "payload");
  const bundle = assertObject(input.bundle ?? input.transferBundle ?? input.recoveryBundle, "bundle");
  const secret = resolveRecoverySecret(input, options.secretLabel);
  assertRecoveryBundleEnvelope(bundle, options.expectedMode);
  const decrypted = await decryptJsonWithSecret(bundle, secret);
  const payloadSchemaVersion = assertInteger(
    decrypted.schemaVersion,
    "bundle payload schemaVersion",
    1,
    1,
  );
  if (payloadSchemaVersion !== 1) {
    throw new Error("Unsupported recovery bundle payload schemaVersion");
  }
  const material = resolveDeviceMaterial(decrypted.material);
  return {
    material: cloneJson(material),
    privateKeyMaterial: cloneJson(assertObject(material.privateKeyMaterial, "privateKeyMaterial")),
    prekeyBundle: createPrekeyBundleFromMaterial(material),
  };
}

function createPrekeyBundleFromMaterial(material) {
  assertObject(material, "device material");
  const signedPrekey = assertObject(material.signedPrekey, "signedPrekey");
  const oneTimePrekeys = assertOptionalArray(material.oneTimePrekeys, "oneTimePrekeys");
  const kyberPrekeys = assertOptionalArray(material.kyberPrekeys, "kyberPrekeys");

  return {
    protocol: assertString(material.protocol, "protocol"),
    registrationId: assertInteger(material.registrationId, "registrationId", 1, 0x7fffffff),
    identityKeyPublic: assertString(material.identityKeyPublic, "identityKeyPublic"),
    signedPrekey: {
      prekeyId: assertInteger(signedPrekey.prekeyId, "signedPrekey.prekeyId", 1, 0x00ffffff),
      publicKey: assertString(signedPrekey.publicKey, "signedPrekey.publicKey"),
      signature: assertString(signedPrekey.signature, "signedPrekey.signature"),
    },
    signalDeviceId: assertInteger(material.signalDeviceId, "signalDeviceId", 1, 127),
    oneTimePrekeys: oneTimePrekeys.map((preKey, index) => {
      const record = assertObject(preKey, `oneTimePrekeys[${index}]`);
      return {
        prekeyId: assertInteger(record.prekeyId, `oneTimePrekeys[${index}].prekeyId`, 1, 0x00ffffff),
        publicKey: assertString(record.publicKey, `oneTimePrekeys[${index}].publicKey`),
      };
    }),
    kyberPrekeys: kyberPrekeys.map((preKey, index) => {
      const record = assertObject(preKey, `kyberPrekeys[${index}]`);
      return {
        prekeyId: assertInteger(record.prekeyId, `kyberPrekeys[${index}].prekeyId`, 1, 0x00ffffff),
        publicKey: assertString(record.publicKey, `kyberPrekeys[${index}].publicKey`),
        signature: assertString(record.signature, `kyberPrekeys[${index}].signature`),
      };
    }),
  };
}

function normalizeCreateDeviceMaterialPayload(payload) {
  const input = isObject(payload) ? payload : {};
  return {
    registrationId:
      input.registrationId == null
        ? generateRegistrationId()
        : assertInteger(input.registrationId, "registrationId", 1, 0x7fffffff),
    signalDeviceId:
      input.signalDeviceId == null
        ? 1
        : assertInteger(input.signalDeviceId, "signalDeviceId", 1, 127),
    signedPreKeyId:
      input.signedPreKeyId == null
        ? 1
        : assertInteger(input.signedPreKeyId, "signedPreKeyId", 1, 0x00ffffff),
    oneTimePreKeyStartId:
      input.oneTimePreKeyStartId == null
        ? 2
        : assertInteger(input.oneTimePreKeyStartId, "oneTimePreKeyStartId", 1, 0x00ffffff),
    oneTimePreKeyCount:
      input.oneTimePreKeyCount == null
        ? 10
        : assertInteger(input.oneTimePreKeyCount, "oneTimePreKeyCount", 1, 500),
    kyberPreKeyStartId:
      input.kyberPreKeyStartId == null
        ? input.kyberPreKeyId == null
          ? 1
          : assertInteger(input.kyberPreKeyId, "kyberPreKeyId", 1, 0x00ffffff)
        : assertInteger(input.kyberPreKeyStartId, "kyberPreKeyStartId", 1, 0x00ffffff),
    kyberPreKeyCount:
      input.kyberPreKeyCount == null
        ? 10
        : assertInteger(input.kyberPreKeyCount, "kyberPreKeyCount", 1, 500),
  };
}

function normalizeGeneratePrekeyBatchPayload(input, material, privateKeyMaterial) {
  const oneTimePreKeys = [
    ...assertOptionalArray(material.oneTimePrekeys, "material.oneTimePrekeys"),
    ...assertOptionalArray(privateKeyMaterial.oneTimePreKeyRecords, "privateKeyMaterial.oneTimePreKeyRecords"),
  ];
  const kyberPreKeys = [
    ...assertOptionalArray(material.kyberPrekeys, "material.kyberPrekeys"),
    ...assertOptionalArray(privateKeyMaterial.kyberPreKeyRecords, "privateKeyMaterial.kyberPreKeyRecords"),
  ];
  const signedPreKeys = [
    ...assertOptionalArray(privateKeyMaterial.signedPreKeyRecords, "privateKeyMaterial.signedPreKeyRecords"),
    ...(isObject(material.signedPrekey) ? [material.signedPrekey] : []),
  ];
  return {
    oneTimePreKeyStartId:
      input.oneTimePreKeyStartId == null
        ? nextPreKeyId(oneTimePreKeys, 2)
        : assertInteger(input.oneTimePreKeyStartId, "oneTimePreKeyStartId", 1, 0x00ffffff),
    oneTimePreKeyCount:
      input.oneTimePreKeyCount == null
        ? 10
        : assertInteger(input.oneTimePreKeyCount, "oneTimePreKeyCount", 0, 500),
    kyberPreKeyStartId:
      input.kyberPreKeyStartId == null
        ? nextPreKeyId(kyberPreKeys, 1)
        : assertInteger(input.kyberPreKeyStartId, "kyberPreKeyStartId", 1, 0x00ffffff),
    kyberPreKeyCount:
      input.kyberPreKeyCount == null
        ? 10
        : assertInteger(input.kyberPreKeyCount, "kyberPreKeyCount", 0, 500),
    rotateSignedPrekey: input.rotateSignedPrekey === true,
    signedPreKeyId:
      input.signedPreKeyId == null
        ? nextPreKeyId(signedPreKeys, 1)
        : assertInteger(input.signedPreKeyId, "signedPreKeyId", 1, 0x00ffffff),
  };
}

function nextPreKeyId(records, fallback) {
  let maxId = fallback - 1;
  for (const record of records) {
    if (!isObject(record)) continue;
    const prekeyId = record.prekeyId;
    if (Number.isInteger(prekeyId) && prekeyId > maxId) {
      maxId = prekeyId;
    }
  }
  return maxId + 1;
}

function resolveDeviceMaterial(payload) {
  const input = assertObject(payload, "payload");
  return input.material ?? input.deviceMaterial ?? input;
}

async function createSenderRuntimeState(senderMaterial) {
  assertObject(senderMaterial, "senderMaterial");
  const privateKeyMaterial = assertObject(
    senderMaterial.privateKeyMaterial,
    "senderMaterial.privateKeyMaterial",
  );
  const identity = restoreIdentityKeyPair(senderMaterial, privateKeyMaterial);
  const identityStore = new WasmInMemIdentityKeyStore(
    identity,
    assertInteger(senderMaterial.registrationId, "senderMaterial.registrationId", 1, 0x7fffffff),
  );
  const sessionStore = new WasmInMemSessionStore();
  const importedAddresses = [];

  try {
    await importSessionRecords(
      privateKeyMaterial.sessionRecords,
      sessionStore,
      importedAddresses,
      "senderMaterial.privateKeyMaterial.sessionRecords",
    );
  } catch (error) {
    identityStore.free();
    sessionStore.free();
    identity.free();
    for (const address of importedAddresses) {
      address.free();
    }
    throw error;
  }

  return {
    identity,
    identityStore,
    sessionStore,
    free() {
      for (const address of importedAddresses) {
        address.free();
      }
      sessionStore.free();
      identityStore.free();
      identity.free();
    },
  };
}

async function createReceiverRuntimeState(receiverMaterial) {
  assertObject(receiverMaterial, "receiverMaterial");
  const privateKeyMaterial = assertObject(
    receiverMaterial.privateKeyMaterial,
    "receiverMaterial.privateKeyMaterial",
  );
  const identity = restoreIdentityKeyPair(receiverMaterial, privateKeyMaterial);
  const identityStore = new WasmInMemIdentityKeyStore(
    identity,
    assertInteger(receiverMaterial.registrationId, "receiverMaterial.registrationId", 1, 0x7fffffff),
  );
  const sessionStore = new WasmInMemSessionStore();
  const preKeyStore = new WasmInMemPreKeyStore();
  const signedPreKeyStore = new WasmInMemSignedPreKeyStore();
  const kyberPreKeyStore = new WasmInMemKyberPreKeyStore();
  const importedAddresses = [];

  try {
    await importSessionRecords(
      privateKeyMaterial.sessionRecords,
      sessionStore,
      importedAddresses,
      "receiverMaterial.privateKeyMaterial.sessionRecords",
    );
    await importPrivatePreKeyRecords(
      privateKeyMaterial.oneTimePreKeyRecords,
      "receiverMaterial.privateKeyMaterial.oneTimePreKeyRecords",
      (prekeyId, recordBytes) => preKeyStore.import_pre_key(prekeyId, recordBytes),
    );
    await importPrivatePreKeyRecords(
      privateKeyMaterial.signedPreKeyRecords,
      "receiverMaterial.privateKeyMaterial.signedPreKeyRecords",
      (prekeyId, recordBytes) => signedPreKeyStore.import_signed_pre_key(prekeyId, recordBytes),
    );
    await importPrivatePreKeyRecords(
      privateKeyMaterial.kyberPreKeyRecords,
      "receiverMaterial.privateKeyMaterial.kyberPreKeyRecords",
      (prekeyId, recordBytes) => kyberPreKeyStore.import_kyber_pre_key(prekeyId, recordBytes),
    );
  } catch (error) {
    for (const address of importedAddresses) {
      address.free();
    }
    kyberPreKeyStore.free();
    signedPreKeyStore.free();
    preKeyStore.free();
    sessionStore.free();
    identityStore.free();
    identity.free();
    throw error;
  }

  return {
    identity,
    identityStore,
    sessionStore,
    preKeyStore,
    signedPreKeyStore,
    kyberPreKeyStore,
    free() {
      for (const address of importedAddresses) {
        address.free();
      }
      kyberPreKeyStore.free();
      signedPreKeyStore.free();
      preKeyStore.free();
      sessionStore.free();
      identityStore.free();
      identity.free();
    },
  };
}

async function importSessionRecords(records, sessionStore, importedAddresses, label) {
  const sessionRecords = assertOptionalArray(records, label);
  for (const [index, recordValue] of sessionRecords.entries()) {
    const record = assertObject(recordValue, `${label}[${index}]`);
    const address = new WasmProtocolAddress(
      assertString(record.addressName, `${label}[${index}].addressName`),
      assertInteger(record.deviceId, `${label}[${index}].deviceId`, 1, 127),
    );
    importedAddresses.push(address);
    await sessionStore.import_session(
      address,
      base64ToBytes(assertString(record.record, `${label}[${index}].record`)),
    );
  }
}

async function importPrivatePreKeyRecords(records, label, importRecord) {
  const prekeyRecords = assertOptionalArray(records, label);
  for (const [index, recordValue] of prekeyRecords.entries()) {
    const record = assertObject(recordValue, `${label}[${index}]`);
    await importRecord(
      assertInteger(record.prekeyId, `${label}[${index}].prekeyId`, 1, 0x00ffffff),
      base64ToBytes(assertString(record.record, `${label}[${index}].record`)),
    );
  }
}

function restoreIdentityKeyPair(senderMaterial, privateKeyMaterial) {
  const identityRecord = optionalString(privateKeyMaterial.identityKeyPairRecord);
  if (identityRecord) {
    return WasmIdentityKeyPair.deserialize(base64ToBytes(identityRecord));
  }
  const publicKey = WasmPublicKey.deserialize(
    base64ToBytes(assertString(senderMaterial.identityKeyPublic, "senderMaterial.identityKeyPublic")),
  );
  const privateKey = WasmPrivateKey.deserialize(
    base64ToBytes(assertString(senderMaterial.identityKeyPrivate, "senderMaterial.identityKeyPrivate")),
  );
  try {
    return new WasmIdentityKeyPair(publicKey, privateKey);
  } finally {
    publicKey.free();
    privateKey.free();
  }
}

function updateSenderMaterialAfterEncrypt(senderMaterial, update) {
  const updatedMaterial = cloneJson(senderMaterial);
  const privateKeyMaterial = {
    ...(isObject(updatedMaterial.privateKeyMaterial)
      ? updatedMaterial.privateKeyMaterial
      : {}),
  };
  privateKeyMaterial.sessionRecords = upsertAddressedRecord(
    privateKeyMaterial.sessionRecords,
    {
      addressName: update.addressName,
      deviceId: update.signalDeviceId,
      record: update.sessionRecordBase64,
    },
    "record",
  );
  privateKeyMaterial.trustedIdentities = upsertAddressedRecord(
    privateKeyMaterial.trustedIdentities,
    {
      addressName: update.addressName,
      deviceId: update.signalDeviceId,
      publicKey: update.recipientIdentityKeyPublic,
    },
    "publicKey",
  );
  privateKeyMaterial.knownRecipientDevices = upsertRecipientDeviceRecord(
    privateKeyMaterial.knownRecipientDevices,
    {
      recipientDeviceId: update.recipientDeviceId,
      addressName: update.addressName,
      signalDeviceId: update.signalDeviceId,
    },
  );
  updatedMaterial.privateKeyMaterial = privateKeyMaterial;
  return updatedMaterial;
}

async function updateRecipientMaterialAfterDecrypt(recipientMaterial, receiverState, update) {
  const updatedMaterial = cloneJson(recipientMaterial);
  const privateKeyMaterial = {
    ...(isObject(updatedMaterial.privateKeyMaterial)
      ? updatedMaterial.privateKeyMaterial
      : {}),
  };
  privateKeyMaterial.sessionRecords = upsertAddressedRecord(
    privateKeyMaterial.sessionRecords,
    {
      addressName: update.senderAddressName,
      deviceId: update.senderProtocolDeviceId,
      record: update.sessionRecordBase64,
    },
    "record",
  );
  if (update.senderIdentityKeyPublic) {
    privateKeyMaterial.trustedIdentities = upsertAddressedRecord(
      privateKeyMaterial.trustedIdentities,
      {
        addressName: update.senderAddressName,
        deviceId: update.senderProtocolDeviceId,
        publicKey: update.senderIdentityKeyPublic,
      },
      "publicKey",
    );
  }
  privateKeyMaterial.oneTimePreKeyRecords = await exportPrivatePreKeyRecords(
    privateKeyMaterial.oneTimePreKeyRecords,
    "oneTimePreKeyRecords",
    (prekeyId) => receiverState.preKeyStore.export_pre_key(prekeyId),
  );
  privateKeyMaterial.oneTimePreKeyRecord = privateKeyMaterial.oneTimePreKeyRecords[0]?.record;
  privateKeyMaterial.signedPreKeyRecords = await exportPrivatePreKeyRecords(
    privateKeyMaterial.signedPreKeyRecords,
    "signedPreKeyRecords",
    (prekeyId) => receiverState.signedPreKeyStore.export_signed_pre_key(prekeyId),
  );
  privateKeyMaterial.signedPreKeyRecord =
    privateKeyMaterial.signedPreKeyRecords[0]?.record ?? privateKeyMaterial.signedPreKeyRecord;
  privateKeyMaterial.kyberPreKeyRecords = await exportPrivatePreKeyRecords(
    privateKeyMaterial.kyberPreKeyRecords,
    "kyberPreKeyRecords",
    (prekeyId) => receiverState.kyberPreKeyStore.export_kyber_pre_key(prekeyId),
  );
  privateKeyMaterial.kyberPreKeyRecord =
    privateKeyMaterial.kyberPreKeyRecords[0]?.record ?? privateKeyMaterial.kyberPreKeyRecord;
  updatedMaterial.privateKeyMaterial = privateKeyMaterial;
  return updatedMaterial;
}

async function exportPrivatePreKeyRecords(records, label, exportRecord) {
  const exportedRecords = [];
  const inputRecords = assertOptionalArray(records, label);
  for (const [index, recordValue] of inputRecords.entries()) {
    const record = assertObject(recordValue, `${label}[${index}]`);
    const prekeyId = assertInteger(record.prekeyId, `${label}[${index}].prekeyId`, 1, 0x00ffffff);
    const exported = await exportRecord(prekeyId);
    if (!exported) continue;
    exportedRecords.push({
      ...record,
      prekeyId,
      record: bytesToBase64(exported),
    });
  }
  return exportedRecords;
}

function resolveKnownRecipientDevice(senderMaterial, input) {
  const privateKeyMaterial = isObject(senderMaterial.privateKeyMaterial)
    ? senderMaterial.privateKeyMaterial
    : {};
  const knownRecipientDevices = assertOptionalArray(
    privateKeyMaterial.knownRecipientDevices,
    "senderMaterial.privateKeyMaterial.knownRecipientDevices",
  );
  const recipientDeviceId = optionalString(input.recipientDeviceId);
  const recipientAddressName = optionalString(input.recipientAddressName);
  return knownRecipientDevices.find(
    (record) =>
      isObject(record) &&
      ((recipientDeviceId && record.recipientDeviceId === recipientDeviceId) ||
        (recipientAddressName && record.addressName === recipientAddressName)),
  ) ?? null;
}

function resolveRecipientProtocolDeviceId(senderMaterial, input, recipientAddressName, recipientDeviceId) {
  if (input.recipientProtocolDeviceId != null) {
    return assertInteger(input.recipientProtocolDeviceId, "recipientProtocolDeviceId", 1, 127);
  }
  if (input.recipientSignalDeviceId != null) {
    return assertInteger(input.recipientSignalDeviceId, "recipientSignalDeviceId", 1, 127);
  }
  const knownRecipient = resolveKnownRecipientDevice(senderMaterial, {
    recipientAddressName,
    recipientDeviceId,
  });
  if (knownRecipient) {
    return assertInteger(knownRecipient.signalDeviceId, "knownRecipientDevices[].signalDeviceId", 1, 127);
  }
  throw new Error(
    "encryptKnownSessionEnvelope payload requires recipientProtocolDeviceId or knownRecipientDevices match",
  );
}

function resolveSenderProtocolDeviceId(input, envelope) {
  for (const [label, value] of [
    ["senderProtocolDeviceId", input.senderProtocolDeviceId],
    ["envelope.senderProtocolDeviceId", envelope.senderProtocolDeviceId],
    ["senderSignalDeviceId", input.senderSignalDeviceId],
    ["envelope.senderSignalDeviceId", envelope.senderSignalDeviceId],
  ]) {
    if (value == null) continue;
    return assertInteger(value, label, 1, 127);
  }
  const senderMaterial = isObject(input.senderMaterial) ? input.senderMaterial : null;
  if (senderMaterial?.signalDeviceId != null) {
    return assertInteger(senderMaterial.signalDeviceId, "senderMaterial.signalDeviceId", 1, 127);
  }
  throw new Error("decryptEnvelope payload requires senderProtocolDeviceId");
}

function upsertAddressedRecord(records, nextRecord, valueKey) {
  if (!nextRecord[valueKey]) return Array.isArray(records) ? records : [];
  const nextRecords = Array.isArray(records) ? [...records] : [];
  const existingIndex = nextRecords.findIndex(
    (record) =>
      isObject(record) &&
      record.addressName === nextRecord.addressName &&
      record.deviceId === nextRecord.deviceId,
  );
  if (existingIndex >= 0) {
    nextRecords[existingIndex] = nextRecord;
    return nextRecords;
  }
  nextRecords.push(nextRecord);
  return nextRecords;
}

function upsertRecipientDeviceRecord(records, nextRecord) {
  const nextRecords = Array.isArray(records) ? [...records] : [];
  const existingIndex = nextRecords.findIndex(
    (record) =>
      isObject(record) &&
      record.recipientDeviceId === nextRecord.recipientDeviceId,
  );
  if (existingIndex >= 0) {
    nextRecords[existingIndex] = nextRecord;
    return nextRecords;
  }
  nextRecords.push(nextRecord);
  return nextRecords;
}

function firstOptionalPrekey(value, label) {
  const prekeys = assertOptionalArray(value, label);
  if (prekeys.length === 0) return null;
  const prekey = assertObject(prekeys[0], `${label}[0]`);
  return {
    prekeyId: assertInteger(prekey.prekeyId, `${label}[0].prekeyId`, 1, 0x00ffffff),
    publicKeyBytes: base64ToBytes(assertString(prekey.publicKey, `${label}[0].publicKey`)),
  };
}

function firstRequiredPrekey(value, label) {
  const prekey = firstOptionalPrekey(value, label);
  if (!prekey) {
    throw new Error(`${label} must contain at least one prekey`);
  }
  const record = assertObject(value[0], `${label}[0]`);
  return {
    ...prekey,
    signatureBytes: base64ToBytes(assertString(record.signature, `${label}[0].signature`)),
  };
}

function resolvePlaintextBytes(input) {
  if (typeof input.plaintextBase64 === "string") {
    return base64ToBytes(input.plaintextBase64);
  }
  if (typeof input.plaintext === "string") {
    return new TextEncoder().encode(input.plaintext);
  }
  throw new Error("encryptEnvelope payload requires plaintextBase64 or plaintext");
}

function resolveCiphertextBytes(input, envelope) {
  if (typeof input.ciphertextBase64 === "string") {
    return base64ToBytes(input.ciphertextBase64);
  }
  if (typeof envelope.ciphertextBase64 === "string") {
    return base64ToBytes(envelope.ciphertextBase64);
  }
  if (typeof input.ciphertext === "string") {
    return base64ToBytes(input.ciphertext);
  }
  if (typeof envelope.ciphertext === "string") {
    return base64ToBytes(envelope.ciphertext);
  }
  throw new Error("decryptEnvelope payload requires ciphertextBase64 or envelope.ciphertextBase64");
}

function resolveAttachmentPlaintextBytes(input) {
  if (typeof input.plaintextBase64 === "string") {
    return base64ToBytes(input.plaintextBase64);
  }
  if (typeof input.attachmentPlaintextBase64 === "string") {
    return base64ToBytes(input.attachmentPlaintextBase64);
  }
  if (input.plaintext instanceof Uint8Array) {
    return input.plaintext;
  }
  if (Array.isArray(input.plaintext)) {
    return bytesFromNumberArray(input.plaintext, "plaintext");
  }
  if (typeof input.plaintext === "string") {
    return utf8Bytes(input.plaintext);
  }
  throw new Error("encryptAttachment payload requires plaintextBase64 or plaintext bytes");
}

function resolveAttachmentCiphertextBytes(input, attachment) {
  if (typeof input.ciphertextBase64 === "string") {
    return base64ToBytes(input.ciphertextBase64);
  }
  if (typeof attachment.ciphertextBase64 === "string") {
    return base64ToBytes(attachment.ciphertextBase64);
  }
  if (typeof input.ciphertext === "string") {
    return base64ToBytes(input.ciphertext);
  }
  if (typeof attachment.ciphertext === "string") {
    return base64ToBytes(attachment.ciphertext);
  }
  if (input.ciphertext instanceof Uint8Array) {
    return input.ciphertext;
  }
  if (attachment.ciphertext instanceof Uint8Array) {
    return attachment.ciphertext;
  }
  if (Array.isArray(input.ciphertext)) {
    return bytesFromNumberArray(input.ciphertext, "ciphertext");
  }
  if (Array.isArray(attachment.ciphertext)) {
    return bytesFromNumberArray(attachment.ciphertext, "attachment.ciphertext");
  }
  throw new Error("decryptAttachment payload requires ciphertextBase64 or attachment.ciphertextBase64");
}

function resolveAttachmentMetadata(input, attachment) {
  const metadata =
    isObject(input.encryptedMetadata)
      ? input.encryptedMetadata
      : isObject(input.metadata)
        ? input.metadata
        : isObject(attachment.encryptedMetadata)
          ? attachment.encryptedMetadata
          : isObject(attachment.metadata)
            ? attachment.metadata
            : attachment;
  assertInteger(metadata.version, "encryptedMetadata.version", 1, 1);
  const algorithm = assertString(metadata.algorithm, "encryptedMetadata.algorithm");
  if (algorithm !== "AES-256-GCM") {
    throw new Error(`Unsupported attachment algorithm: ${algorithm}`);
  }
  assertString(metadata.nonce, "encryptedMetadata.nonce");
  const keyWrappers = assertOptionalArray(metadata.keyWrappers, "encryptedMetadata.keyWrappers");
  if (keyWrappers.length === 0) {
    throw new Error("encryptedMetadata.keyWrappers must contain at least one wrapper");
  }
  return metadata;
}

function selectAttachmentKeyWrapper(keyWrappers, recipientDeviceId) {
  const wrappers = assertOptionalArray(keyWrappers, "encryptedMetadata.keyWrappers");
  const wrapper =
    recipientDeviceId
      ? wrappers.find(
          (candidate) =>
            isObject(candidate) && candidate.recipientDeviceId === recipientDeviceId,
        )
      : wrappers[0];
  if (!wrapper) {
    throw new Error("decryptAttachment could not find a key wrapper for the local device");
  }
  assertString(wrapper.recipientDeviceId, "attachment wrapper recipientDeviceId");
  assertString(wrapper.wrappedKeyCiphertext, "attachment wrapper wrappedKeyCiphertext");
  return wrapper;
}

function resolveAttachmentWrapperHeader(wrapper) {
  const header = isObject(wrapper.header) ? wrapper.header : wrapper;
  return assertObject(header, "attachment wrapper header");
}

function resolveAttachmentAssociatedData(input, metadata) {
  const inputAssociatedData = optionalString(input.associatedData);
  const metadataAssociatedData = metadata ? optionalString(metadata.associatedData) : undefined;
  if (
    inputAssociatedData &&
    metadataAssociatedData &&
    inputAssociatedData !== metadataAssociatedData
  ) {
    throw new Error("Attachment associatedData does not match encrypted metadata");
  }
  return inputAssociatedData ?? metadataAssociatedData;
}

function resolveRecoverySecret(input, preferredField) {
  const value =
    input[preferredField] ??
    input.transferSecret ??
    input.recoverySecret ??
    input.passphrase ??
    input.userControlledSecret;
  const secret = assertString(value, preferredField);
  if (secret.length < 12) {
    throw new Error(`${preferredField} must be at least 12 characters`);
  }
  return secret;
}

function assertRecoveryBundleEnvelope(bundle, expectedMode) {
  assertInteger(bundle.schemaVersion, "bundle.schemaVersion", 1, 1);
  const protocol = assertString(bundle.protocol, "bundle.protocol");
  if (protocol !== "e2ee-runtime-recovery-v1") {
    throw new Error(`Unsupported recovery bundle protocol: ${protocol}`);
  }
  const mode = assertString(bundle.mode, "bundle.mode");
  if (mode !== expectedMode) {
    throw new Error(`Recovery bundle mode mismatch: expected ${expectedMode}, got ${mode}`);
  }
  assertObject(bundle.kdf, "bundle.kdf");
  assertObject(bundle.cipher, "bundle.cipher");
  assertString(bundle.encryptedDeviceStateBase64, "bundle.encryptedDeviceStateBase64");
}

async function encryptJsonWithSecret(value, secret, saltBytes, ivBytes) {
  const key = await deriveRecoveryAesKey(secret, saltBytes);
  const plaintextBytes = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    plaintextBytes,
  );
  return new Uint8Array(encrypted);
}

async function decryptJsonWithSecret(bundle, secret) {
  const kdf = assertObject(bundle.kdf, "bundle.kdf");
  const cipher = assertObject(bundle.cipher, "bundle.cipher");
  const kdfName = assertString(kdf.name, "bundle.kdf.name");
  const cipherName = assertString(cipher.name, "bundle.cipher.name");
  if (kdfName !== "PBKDF2-SHA-256") {
    throw new Error(`Unsupported recovery bundle KDF: ${kdfName}`);
  }
  if (cipherName !== "AES-GCM") {
    throw new Error(`Unsupported recovery bundle cipher: ${cipherName}`);
  }
  const saltBytes = base64ToBytes(assertString(kdf.saltBase64, "bundle.kdf.saltBase64"));
  const ivBytes = base64ToBytes(assertString(cipher.ivBase64, "bundle.cipher.ivBase64"));
  const encryptedBytes = base64ToBytes(
    assertString(bundle.encryptedDeviceStateBase64, "bundle.encryptedDeviceStateBase64"),
  );
  const key = await deriveRecoveryAesKey(secret, saltBytes);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    encryptedBytes,
  );
  return JSON.parse(bytesToUtf8(new Uint8Array(decrypted)));
}

async function deriveRecoveryAesKey(secret, saltBytes) {
  if (!crypto?.subtle) {
    throw new Error("Recovery bundle encryption requires Web Crypto subtle API");
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations: 210000,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function assertAttachmentCryptoAvailable() {
  if (!crypto?.subtle) {
    throw new Error("Attachment encryption requires Web Crypto subtle API");
  }
}

async function deriveAttachmentContentKeyBytes(attachmentKey) {
  if (attachmentKey.byteLength === 32) {
    return attachmentKey;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", attachmentKey));
}

async function encryptLocalDeviceAttachmentKeyWrapper(input) {
  const key = await deriveLocalDeviceAttachmentWrappingKey(
    input.senderMaterial,
    input.recipientDeviceId,
    ["encrypt"],
  );
  const nonceBytes = randomBytes(12);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonceBytes,
        additionalData: localDeviceAttachmentWrapperAdditionalData(input.recipientDeviceId),
      },
      key,
      input.attachmentKey,
    ),
  );
  return {
    recipientDeviceId: input.recipientDeviceId,
    wrappedKeyCiphertext: bytesToBase64(ciphertext),
    wrappingAlgorithm: LOCAL_DEVICE_ATTACHMENT_KEY_WRAP_ALGORITHM,
    nonce: bytesToBase64(nonceBytes),
  };
}

async function decryptLocalDeviceAttachmentKeyWrapper(input) {
  const key = await deriveLocalDeviceAttachmentWrappingKey(
    input.recipientMaterial,
    input.recipientDeviceId,
    ["decrypt"],
  );
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(input.nonce),
        additionalData: localDeviceAttachmentWrapperAdditionalData(input.recipientDeviceId),
      },
      key,
      base64ToBytes(input.wrappedKeyCiphertext),
    ),
  );
}

async function deriveLocalDeviceAttachmentWrappingKey(material, recipientDeviceId, usages) {
  const keyBytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      utf8Bytes(localDeviceAttachmentWrappingKeyMaterial(material, recipientDeviceId)),
    ),
  );
  return importAttachmentContentKey(keyBytes, usages);
}

function localDeviceAttachmentWrappingKeyMaterial(material, recipientDeviceId) {
  return [
    LOCAL_DEVICE_ATTACHMENT_KEY_WRAP_ALGORITHM,
    recipientDeviceId,
    assertString(material.identityKeyPublic, "identityKeyPublic"),
    assertString(material.identityKeyPrivate, "identityKeyPrivate"),
    String(assertInteger(material.registrationId, "registrationId", 1, 0x7fffffff)),
    String(assertInteger(material.signalDeviceId, "signalDeviceId", 1, 127)),
  ].join(":");
}

function localDeviceAttachmentWrapperAdditionalData(recipientDeviceId) {
  return utf8Bytes(`${LOCAL_DEVICE_ATTACHMENT_KEY_WRAP_ALGORITHM}:${recipientDeviceId}`);
}

async function importAttachmentContentKey(keyBytes, usages) {
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function uuidResult(bytes) {
  return {
    uuid: uuid_to_string(bytes),
    bytesBase64: bytesToBase64(bytes),
  };
}

export function assertByteLength(value) {
  if (!Number.isInteger(value) || value < 1 || value > 4096) {
    throw new Error("payload.length must be an integer from 1 to 4096");
  }
  return value;
}

function assertInteger(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function assertString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function optionalString(value) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function assertObject(value, label) {
  if (!isObject(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertOptionalArray(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

export function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value);
}

function bytesFromNumberArray(value, label) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const byte = value[index];
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new Error(`${label}[${index}] must be a byte`);
    }
    bytes[index] = byte;
  }
  return bytes;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ok(requestId, result) {
  return { ok: true, requestId, result };
}

function fail(requestId, error) {
  return {
    ok: false,
    requestId,
    error: {
      message: error instanceof Error ? error.message : String(error),
    },
  };
}
