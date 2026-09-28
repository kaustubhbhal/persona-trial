import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const source = process.env.PERSONA_WRANGLER_SOURCE || "dist/server/wrangler.json";
const output = process.env.PERSONA_WRANGLER_OUTPUT || "dist/server/wrangler.persona.json";
const id = process.env.PERSONA_D1_DATABASE_ID || "";

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
  throw new Error("PERSONA_D1_DATABASE_ID must be a D1 database UUID.");
}
if (dirname(resolve(source)) !== dirname(resolve(output))) {
  throw new Error("The deploy config must be beside the Vinext config so relative paths remain valid.");
}

const config = JSON.parse(readFileSync(source, "utf8"));
if (!config.main) throw new Error("Vinext build did not emit a Worker entrypoint.");
const database = config.d1_databases?.find((item) => item.binding === "DB");
if (!database) throw new Error("Vinext build did not emit the DB binding.");

database.database_id = id;
database.database_name = "persona-assessment";
config.name = "persona-assessment";
writeFileSync(output, `${JSON.stringify(config, null, 2)}\n`);

if (process.argv.includes("--dry-run")) process.exit(0);
const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const result = spawnSync(process.execPath, [wrangler, "deploy", "--config", output], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
