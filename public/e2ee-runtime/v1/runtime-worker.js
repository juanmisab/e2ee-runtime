import initWasm, {
  WasmIdentityKeyPair,
  WasmPrivateKey,
  generateRegistrationId,
  generate_random_bytes,
  generate_uuid,
  message_type_pre_key,
  message_type_sender_key,
  message_type_signal,
  uuid_to_string,
} from "./signal_wasm.js";

const metadata = {
  runtimeName: "e2ee-runtime",
  runtimeVersion: "0.1.0-prealpha.1",
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
