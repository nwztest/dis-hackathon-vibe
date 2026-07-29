import assert from "node:assert/strict";
import test from "node:test";
import {
  SERIAL_WRITE_CHUNK_BYTES,
  SERIAL_WRITE_CHUNK_DELAY_MS,
  writeSerialLine,
} from "../lib/serial-protocol.ts";

test("serial lines are written in bounded chunks without changing their bytes", async () => {
  const line = `${JSON.stringify({
    protocolVersion: 1,
    command: "configure",
    requestId: "test-request",
    payload: { padding: "x".repeat(400) },
  })}\n`;
  const chunks: Uint8Array[] = [];
  const delays: number[] = [];

  await writeSerialLine(
    { write: async (chunk) => { chunks.push(chunk); } },
    line,
    { delay: async (milliseconds) => { delays.push(milliseconds); } },
  );

  assert.ok(chunks.length > 1);
  assert.equal(Math.max(...chunks.map((chunk) => chunk.byteLength)), SERIAL_WRITE_CHUNK_BYTES);
  assert.equal(delays.length, chunks.length - 1);
  assert.ok(delays.every((milliseconds) => milliseconds === SERIAL_WRITE_CHUNK_DELAY_MS));

  const reconstructed = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  assert.equal(reconstructed, line);
});

test("serial line chunk size must be a positive integer", async () => {
  await assert.rejects(
    writeSerialLine({ write: async () => undefined }, "status\n", { chunkBytes: 0 }),
    /positive integer/,
  );
});
