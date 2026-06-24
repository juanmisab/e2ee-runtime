import initWasm, {
  WasmIdentityKeyPair,
  WasmInMemKyberPreKeyStore,
  WasmInMemPreKeyStore,
  WasmInMemSignedPreKeyStore,
  WasmPrivateKey,
  generateKyberPreKey,
  generatePreKeys,
  generateRegistrationId,
  generateSignedPreKey,
  generate_random_bytes,
  generate_uuid,
  message_type_pre_key,
  message_type_sender_key,
  message_type_signal,
  uuid_to_string,
} from "./signal_wasm.js";

const metadata = {
  runtimeName: "e2ee-runtime",
  runtimeVersion: "0.1.0-prealpha.2",
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
