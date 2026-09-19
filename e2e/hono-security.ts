import assert from "node:assert/strict";

process.env.DATABASE_URL = "file:./.tmp/hono-security.sqlite";
process.env.NODE_ENV = "production";
process.env.CAV_ALLOWED_ORIGINS = "https://mobile.example";

const { default: app } = await import("../packages/web/src/api");

async function preflight(origin: string) {
  return app.fetch(
    new Request("https://app.example/api/rpc/auth/login", {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type",
      },
    }),
  );
}

assert.equal(
  (await preflight("https://app.example")).headers.get("access-control-allow-origin"),
  "https://app.example",
);
assert.equal(
  (await preflight("https://mobile.example")).headers.get("access-control-allow-origin"),
  "https://mobile.example",
);
assert.equal(
  (await preflight("https://evil.example")).headers.get("access-control-allow-origin"),
  null,
);
assert.equal(
  (await preflight("https://evil.example")).headers.get(
    "access-control-allow-credentials",
  ),
  null,
);

console.log("CORS: origem própria e allowlist aceitas; origem arbitrária bloqueada.");
