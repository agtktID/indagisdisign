/**
 * Test de fumée du pont Remotion.
 *
 *   node tools/remotion-bridge/smoke-test.mjs
 *
 * Ne crée pas de projet : `init` installe des dépendances et prend plusieurs minutes.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(HERE, "server.mjs")],
});
const client = new Client({ name: "smoke-test", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`✓ ${tools.length} outils exposés : ${tools.map((t) => t.name).join(", ")}`);

const notice = await client.callTool({ name: "license_notice", arguments: {} });
console.log(`✓ avis de licence : ${notice.content[0].text.split("\n")[0]}`);

const doctor = await client.callTool({ name: "doctor", arguments: {} });
console.log(`✓ ${doctor.content[0].text.trim()}`);

const traversal = await client.callTool({
  name: "write_composition",
  arguments: { project: "x", file: "../../../etc/passwd", content: "nope" },
});
console.log(
  traversal.isError
    ? "✓ écriture hors projet refusée"
    : "✗ ÉCHEC : écriture hors projet acceptée",
);
if (!traversal.isError) process.exitCode = 1;

await client.close();
