import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const sampleId = "00000000-0000-4000-8000-000000000001";

test("Cloudflare deploy config binds the requested D1 database", () => {
  const root = mkdtempSync(join(tmpdir(), "persona-deploy-"));
  try {
    const source = join(root, "wrangler.json");
    const output = join(root, "wrangler.persona.json");
    writeFileSync(source, JSON.stringify({
      main: "index.js",
      assets: { directory: "../client" },
      d1_databases: [{ binding: "DB", database_name: "placeholder", database_id: "00000000-0000-4000-8000-000000000000" }],
    }));
    const run = (id) => spawnSync(process.execPath, ["scripts/cloudflare-deploy.mjs", "--dry-run"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PERSONA_WRANGLER_SOURCE: source,
        PERSONA_WRANGLER_OUTPUT: output,
        PERSONA_D1_DATABASE_ID: id,
      },
    });
    assert.equal(run(sampleId).status, 0);
    const config = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(config.main, "index.js");
    assert.equal(config.assets.directory, "../client");
    assert.equal(config.name, "persona-assessment");
    assert.equal(config.d1_databases[0].database_id, sampleId);
    assert.equal(config.d1_databases[0].database_name, "persona-assessment");
    assert.notEqual(run("").status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Cloudflare deploy config rejects a build missing the DB binding", () => {
  const root = mkdtempSync(join(tmpdir(), "persona-deploy-"));
  try {
    const source = join(root, "wrangler.json");
    writeFileSync(source, JSON.stringify({ main: "index.js", d1_databases: [] }));
    const result = spawnSync(process.execPath, ["scripts/cloudflare-deploy.mjs", "--dry-run"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PERSONA_WRANGLER_SOURCE: source,
        PERSONA_WRANGLER_OUTPUT: join(root, "wrangler.persona.json"),
        PERSONA_D1_DATABASE_ID: sampleId,
      },
    });
    assert.notEqual(result.status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
