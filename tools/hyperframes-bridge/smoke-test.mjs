/**
 * Test de fumée du pont HyperFrames.
 *
 * Vérifie que le pont démarre, expose ses outils, refuse une traversée de chemin, et que
 * HyperFrames peut rendre sur cette machine.
 *
 *   node tools/hyperframes-bridge/smoke-test.mjs
 *
 * Ne rend pas de vidéo : le rendu prend plusieurs minutes. Pour le vérifier, demandez-le
 * à l'agent depuis l'application.
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

const projects = await client.callTool({ name: "list_projects", arguments: {} });
console.log(`✓ list_projects répond : ${projects.content[0].text}`);

const traversal = await client.callTool({
  name: "init",
  arguments: { project: "../../etc" },
});
if (!traversal.isError) {
  console.error("✗ ÉCHEC : une traversée de chemin a été acceptée");
  process.exitCode = 1;
} else {
  console.log("✓ traversée de chemin refusée");
}

const doctor = await client.callTool({ name: "doctor", arguments: {} });
const output = doctor.content[0].text;
for (const dep of ["FFmpeg", "Chrome", "FFprobe"]) {
  const ok = new RegExp(`✓\\s+${dep}`).test(output);
  console.log(`${ok ? "✓" : "✗"} ${dep}${ok ? "" : " manquant — le rendu échouera"}`);
  if (!ok) process.exitCode = 1;
}

await client.close();
