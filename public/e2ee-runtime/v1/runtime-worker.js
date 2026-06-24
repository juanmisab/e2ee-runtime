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

const metadata = {
  runtimeName: "e2ee-runtime",
  runtimeVersion: "0.1.0-prealpha.4",
  artifactPath: "/e2ee-runtime/v1/runtime-worker.js",
  implementation: "getmaapp-signal-wasm/libsignal",
  license: "AGPL-3.0-only",
  sourceRepository: "https://github.com/juanmisab/e2ee-runtime",
  upstreamRepository: "https://github.com/getmaapp/signal-wasm",
  upstreamCommit: "3a5293905e7eacfad42b0b324665849bdd4c9cdf",
  affiliation: "Signal Protocol-compatible target; not affiliated with Signal.",
  boundary: "JSON postMessage ABI only",
};

let wasmReady;

self.addEventListener("message", (event) => {
  handleRequest(event.data).then((response) => {
    self.postMessage(response);
  });
});

async function handleRequest(message) {
  const requestId = isObject(message) && typeof message.requestId === "string" ? message.requestId : null;

  try {
    if (!isObject(message) || typeof message.op !== "string") {
      throw new Error("Invalid runtime request");
    }

    if (message.op === "runtimeMetadata") {
      return ok(requestId, metadata);
    }

    await ensureWasm();

    switch (message.op) {
      case "runtimeReady":
        return ok(requestId, { ready: true });
      case "messageTypes":
        return ok(requestId, {
          signal: message_type_signal(),
          preKey: message_type_pre_key(),
          senderKey: message_type_sender_key(),
        });
      case "generateRegistrationId":
        return ok(requestId, { registrationId: generateRegistrationId() });
      case "generateRandomBytes":
        return ok(requestId, {
          bytesBase64: bytesToBase64(generate_random_bytes(assertByteLength(message.payload?.length))),
        });
      case "generateUuid":
        return ok(requestId, uuidResult(generate_uuid()));
      case "generateIdentityKeyPair":
        return ok(requestId, generateIdentityKeyPair());
      case "createDeviceMaterial":
        return ok(requestId, await createDeviceMaterial(message.payload));
      case "exportPrekeyBundle":
        return ok(requestId, exportPrekeyBundle(message.payload));
      case "encryptEnvelope":
        return ok(requestId, await encryptEnvelope(message.payload));
      case "encryptKnownSessionEnvelope":
        return ok(requestId, await encryptKnownSessionEnvelope(message.payload));
      case "decryptEnvelope":
        return ok(requestId, await decryptEnvelope(message.payload));
      case "exportDeviceState":
        return ok(requestId, exportDeviceState(message.payload));
      default:
        throw new Error(`Unsupported runtime op: ${message.op}`);
    }
  } catch (error) {
    return fail(requestId, error);
  }
}

async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = initWasm({ module_or_path: new URL("./runtime.wasm", import.meta.url) });
  }
  await wasmReady;
}

function generateIdentityKeyPair() {
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

async function createDeviceMaterial(payload) {
  const options = normalizeCreateDeviceMaterialPayload(payload);
  const privateKey = WasmPrivateKey.generate();
  const publicKey = privateKey.getPublicKey();
  const identity = new WasmIdentityKeyPair(publicKey, privateKey);
  const preKeyStore = new WasmInMemPreKeyStore();
  const signedPreKeyStore = new WasmInMemSignedPreKeyStore();
  const kyberPreKeyStore = new WasmInMemKyberPreKeyStore();
  const preKeys = [];
  let signedPreKey;
  let kyberPreKey;

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
    kyberPreKey = await generateKyberPreKey(
      options.kyberPreKeyId,
      identity,
      kyberPreKeyStore,
    );

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
    const kyberPrekey = {
      prekeyId: kyberPreKey.id,
      publicKey: bytesToBase64(kyberPreKey.public_key),
      signature: bytesToBase64(kyberPreKey.signature),
    };
    const material = {
      protocol: "signal-v1",
      registrationId: options.registrationId,
      signalDeviceId: options.signalDeviceId,
      identityKeyPublic: bytesToBase64(publicKey.serialize()),
      identityKeyPrivate: bytesToBase64(privateKey.serialize()),
      signedPrekey,
      oneTimePrekeys,
      kyberPrekeys: [kyberPrekey],
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
        kyberPreKeyRecord: bytesToBase64(kyberPreKey.record),
        kyberPreKeyRecords: [
          {
            prekeyId: kyberPreKey.id,
            record: bytesToBase64(kyberPreKey.record),
            timestamp: kyberPreKey.timestamp.toString(),
          },
        ],
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
    signedPreKey?.free();
    kyberPreKey?.free();
    preKeyStore.free();
    signedPreKeyStore.free();
    kyberPreKeyStore.free();
    identity.free();
    publicKey.free();
    privateKey.free();
  }
}

function exportPrekeyBundle(payload) {
  const material = resolveDeviceMaterial(payload);
  return createPrekeyBundleFromMaterial(material);
}

async function encryptEnvelope(payload) {
  return encryptRuntimeEnvelope(payload, { requirePrekeyBundle: true });
}

async function encryptKnownSessionEnvelope(payload) {
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

async function decryptEnvelope(payload) {
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

function exportDeviceState(payload) {
  const material = resolveDeviceMaterial(payload);
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
    kyberPreKeyId:
      input.kyberPreKeyId == null
        ? 1
        : assertInteger(input.kyberPreKeyId, "kyberPreKeyId", 1, 0x00ffffff),
  };
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function uuidResult(bytes) {
  return {
    uuid: uuid_to_string(bytes),
    bytesBase64: bytesToBase64(bytes),
  };
}

function assertByteLength(value) {
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

function bytesToBase64(bytes) {
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
