// Local runs without installing MongoDB: starts one in .data/ (kept between runs), then `next dev`, or
// with "start", the production build (what a tunnel should serve). On a server, set MONGODB_URI and use
// `npm run build && npm start` instead.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const dbPath = new URL("../.data/db", import.meta.url).pathname;
mkdirSync(dbPath, { recursive: true });

const mongo = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: "wiredTiger", port: 27027 } });
const uri = `${mongo.getUri().replace(/\/$/, "")}/mailcheap`;
console.log(`[dev] MongoDB at ${uri}`);

const port = process.env.PORT || "3100";
const mode = process.argv[2] === "start" ? "start" : "dev";
const next = spawn("npx", ["next", mode, "-p", port], {
	stdio: "inherit",
	env: { ...process.env, MONGODB_URI: process.env.MONGODB_URI || uri },
});

async function stop() {
	next.kill("SIGTERM");
	await mongo.stop({ doCleanup: false });
	process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("exit", async (code) => {
	await mongo.stop({ doCleanup: false });
	process.exit(code ?? 0);
});
