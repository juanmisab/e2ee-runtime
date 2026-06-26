import { runtimeMetadata } from "./abi.js";

// Public AGPL Worker entrypoint. Private apps must use the JSON postMessage ABI only.
import {
  assertByteLength,
  bytesToBase64,
  ensureWasm,
  generate_random_bytes,
  generate_uuid,
  generateRegistrationId,
  message_type_pre_key,
  message_type_sender_key,
  message_type_signal,
  uuidResult,
} from "./runtime-core.js?artifact=0d05ab3e";
import {
  createDeviceMaterial,
  exportDeviceState,
  exportPrekeyBundle,
  generateIdentityKeyPair,
  generatePrekeyBatch,
} from "./ops/device.js";
import {
  decryptEnvelope,
  encryptEnvelope,
  encryptKnownSessionEnvelope,
} from "./ops/envelopes.js";
import {
  decryptAttachment,
  encryptAttachment,
} from "./ops/attachments.js";
import {
  exportDeviceTransferBundle,
  exportEncryptedRecoveryBundle,
  importDeviceTransferBundle,
  importEncryptedRecoveryBundle,
} from "./ops/recovery.js";

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
      return ok(requestId, runtimeMetadata);
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
      case "generatePrekeyBatch":
        return ok(requestId, await generatePrekeyBatch(message.payload));
      case "exportPrekeyBundle":
        return ok(requestId, exportPrekeyBundle(message.payload));
      case "encryptEnvelope":
        return ok(requestId, await encryptEnvelope(message.payload));
      case "encryptKnownSessionEnvelope":
        return ok(requestId, await encryptKnownSessionEnvelope(message.payload));
      case "decryptEnvelope":
        return ok(requestId, await decryptEnvelope(message.payload));
      case "encryptAttachment":
        return ok(requestId, await encryptAttachment(message.payload));
      case "decryptAttachment":
        return ok(requestId, await decryptAttachment(message.payload));
      case "exportDeviceState":
        return ok(requestId, exportDeviceState(message.payload));
      case "exportDeviceTransferBundle":
        return ok(requestId, await exportDeviceTransferBundle(message.payload));
      case "importDeviceTransferBundle":
        return ok(requestId, await importDeviceTransferBundle(message.payload));
      case "exportEncryptedRecoveryBundle":
        return ok(requestId, await exportEncryptedRecoveryBundle(message.payload));
      case "importEncryptedRecoveryBundle":
        return ok(requestId, await importEncryptedRecoveryBundle(message.payload));
      default:
        throw new Error(`Unsupported runtime op: ${message.op}`);
    }
  } catch (error) {
    return fail(requestId, error);
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
