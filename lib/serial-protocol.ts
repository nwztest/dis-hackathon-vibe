export const SERIAL_WRITE_CHUNK_BYTES = 32;
export const SERIAL_WRITE_CHUNK_DELAY_MS = 50;

type SerialWriter = {
  write(chunk: Uint8Array): Promise<void>;
};

type SerialWriteOptions = {
  chunkBytes?: number;
  chunkDelayMs?: number;
  delay?: (milliseconds: number) => Promise<void>;
};

function defaultDelay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function writeSerialLine(
  writer: SerialWriter,
  line: string,
  {
    chunkBytes = SERIAL_WRITE_CHUNK_BYTES,
    chunkDelayMs = SERIAL_WRITE_CHUNK_DELAY_MS,
    delay = defaultDelay,
  }: SerialWriteOptions = {},
) {
  if (!Number.isInteger(chunkBytes) || chunkBytes <= 0) {
    throw new Error("Serial chunk size must be a positive integer.");
  }

  const bytes = new TextEncoder().encode(line);
  for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
    const end = Math.min(offset + chunkBytes, bytes.length);
    await writer.write(bytes.slice(offset, end));
    if (end < bytes.length && chunkDelayMs > 0) {
      await delay(chunkDelayMs);
    }
  }
}
