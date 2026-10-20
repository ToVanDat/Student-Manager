var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var MAX_CIPHERTEXT_BYTES = 500 * 1024 * 1024;
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var json = /* @__PURE__ */ __name((status, message, headers = {}) => new Response(JSON.stringify({ message }), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
}), "json");
var corsHeaders = /* @__PURE__ */ __name((request, env) => {
  const origin = request.headers.get("origin");
  const allowed = env.E2EE_FRONTEND_ORIGIN;
  if (origin && allowed && origin === allowed) {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "PUT, GET, HEAD, DELETE, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type",
      "access-control-max-age": "600",
      "vary": "Origin"
    };
  }
  return {};
}, "corsHeaders");
var decodeBase64Url = /* @__PURE__ */ __name((value) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}, "decodeBase64Url");
var verifyTicket = /* @__PURE__ */ __name(async (token, secret) => {
  if (typeof token !== "string" || token.length > 4096 || !secret || secret.length < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  } catch {
    return null;
  }
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(parts[1]), new TextEncoder().encode(parts[0]));
    if (!valid || payload?.v !== 1 || !["PUT", "GET", "HEAD", "DELETE"].includes(payload.method) || !UUID_RE.test(payload.attachmentId || "") || !UUID_RE.test(payload.objectKey || "") || !Number.isSafeInteger(payload.exp) || payload.exp < Math.floor(Date.now() / 1e3) || !Number.isSafeInteger(payload.expectedSize) || payload.expectedSize < 1 || payload.expectedSize > MAX_CIPHERTEXT_BYTES || typeof payload.expectedDigest !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(payload.expectedDigest) || decodeBase64Url(payload.expectedDigest).length !== 32 || !Number.isSafeInteger(payload.conversationId) || payload.conversationId < 1 || !Number.isSafeInteger(payload.userId) || payload.userId < 1) return null;
    return payload;
  } catch {
    return null;
  }
}, "verifyTicket");
var withCors = /* @__PURE__ */ __name((response, headers) => {
  const nextHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) nextHeaders.set(key, value);
  nextHeaders.set("cache-control", "no-store");
  nextHeaders.set("x-content-type-options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: nextHeaders });
}, "withCors");
var src_default = {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      if (request.headers.get("origin") && !cors["access-control-allow-origin"]) return json(403, "Origin kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p");
      return new Response(null, { status: 204, headers: cors });
    }
    if (!["PUT", "GET", "HEAD", "DELETE"].includes(request.method) || !/^\/v1\/objects\/[0-9a-f-]{36}$/i.test(url.pathname)) {
      return withCors(json(404, "Kh\xF4ng t\xECm th\u1EA5y endpoint"), cors);
    }
    const attachmentId = url.pathname.split("/").at(-1);
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const ticket = await verifyTicket(token, env.E2EE_ATTACHMENT_TICKET_SECRET);
    if (!ticket || ticket.attachmentId !== attachmentId || ticket.method !== request.method) {
      return withCors(json(403, "Ticket kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n"), cors);
    }
    const key = `e2ee/${ticket.objectKey}`;
    if (request.method === "DELETE") {
      try {
        await env.E2EE_BUCKET.delete(key);
        return withCors(new Response(null, { status: 204 }), cors);
      } catch {
        return withCors(json(502, "Kh\xF4ng th\u1EC3 x\xF3a ciphertext"), cors);
      }
    }
    if (request.method === "PUT") {
      const declaredLength = request.headers.get("content-length");
      if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) !== ticket.expectedSize)) {
        return withCors(json(413, "K\xEDch th\u01B0\u1EDBc ciphertext kh\xF4ng kh\u1EDBp ticket"), cors);
      }
      if (!request.body) return withCors(json(400, "Thi\u1EBFu ciphertext"), cors);
      let observedBytes = 0;
      const limiter = new TransformStream({
        transform(chunk, controller) {
          observedBytes += chunk.byteLength;
          if (observedBytes > ticket.expectedSize || observedBytes > MAX_CIPHERTEXT_BYTES) {
            controller.error(new Error("E2EE_CIPHERTEXT_SIZE_LIMIT"));
            return;
          }
          controller.enqueue(chunk);
        },
        flush(controller) {
          if (observedBytes !== ticket.expectedSize) controller.error(new Error("E2EE_CIPHERTEXT_SIZE_MISMATCH"));
        }
      });
      try {
        const expectedDigest = decodeBase64Url(ticket.expectedDigest);
        const result = await env.E2EE_BUCKET.put(key, request.body.pipeThrough(limiter), {
          sha256: expectedDigest.buffer.slice(expectedDigest.byteOffset, expectedDigest.byteOffset + expectedDigest.byteLength),
          onlyIf: { etagDoesNotMatch: "*" },
          httpMetadata: { contentType: "application/octet-stream", cacheControl: "private, no-store" },
          customMetadata: { attachmentId, expectedDigest: ticket.expectedDigest }
        });
        if (!result) return withCors(json(409, "T\u1EC7p \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA3i l\xEAn; ticket kh\xF4ng th\u1EC3 ghi \u0111\xE8 object"), cors);
        const storedDigest2 = result.checksums?.sha256;
        const toHex = /* @__PURE__ */ __name((bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""), "toHex");
        if (!storedDigest2 || toHex(new Uint8Array(storedDigest2)) !== toHex(expectedDigest)) {
          await env.E2EE_BUCKET.delete(key);
          return withCors(json(422, "Digest ciphertext kh\xF4ng kh\u1EDBp"), cors);
        }
        return withCors(new Response(null, { status: 201, headers: { "content-length": "0" } }), cors);
      } catch (error) {
        return withCors(json(400, error?.message === "E2EE_CIPHERTEXT_SIZE_LIMIT" || error?.message === "E2EE_CIPHERTEXT_SIZE_MISMATCH" ? "K\xEDch th\u01B0\u1EDBc ciphertext kh\xF4ng h\u1EE3p l\u1EC7" : "Kh\xF4ng th\u1EC3 l\u01B0u ciphertext"), cors);
      }
    }
    const object = request.method === "HEAD" ? await env.E2EE_BUCKET.head(key) : await env.E2EE_BUCKET.get(key);
    if (!object) return withCors(json(404, "Kh\xF4ng t\xECm th\u1EA5y ciphertext"), cors);
    if (object.size !== ticket.expectedSize) return withCors(json(409, "K\xEDch th\u01B0\u1EDBc ciphertext kh\xF4ng kh\u1EDBp"), cors);
    const storedDigest = object.checksums?.sha256;
    const storedDigestB64 = storedDigest ? btoa(String.fromCharCode(...new Uint8Array(storedDigest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "") : "";
    if (storedDigestB64 !== ticket.expectedDigest) return withCors(json(409, "Digest ciphertext kh\xF4ng kh\u1EDBp"), cors);
    if (request.method === "HEAD") {
      return withCors(new Response(null, {
        status: 200,
        headers: { "content-type": "application/octet-stream", "content-length": String(object.size), "x-e2ee-sha256": storedDigestB64 }
      }), cors);
    }
    return withCors(new Response(object.body, {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(object.size),
        "x-e2ee-sha256": storedDigestB64,
        "content-disposition": "attachment",
        "x-content-type-options": "nosniff"
      }
    }), cors);
  }
};

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-fYI3zO/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-fYI3zO/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
