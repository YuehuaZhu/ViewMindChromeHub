import { describe, it, expect } from "vitest";
import { sha256Hex } from "../src/collector/fingerprint";

describe("sha256Hex", () => {
  it("returns 64-char lowercase hex string", async () => {
    const result = await sha256Hex("hello world");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("known hash: empty string", async () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const result = await sha256Hex("");
    expect(result).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("same input always produces same hash", async () => {
    const text = "viewmind copy-paste fingerprint";
    const a = await sha256Hex(text);
    const b = await sha256Hex(text);
    expect(a).toBe(b);
  });

  it("different inputs produce different hashes", async () => {
    const a = await sha256Hex("foo");
    const b = await sha256Hex("bar");
    expect(a).not.toBe(b);
  });
});
