import { describe, expect, it } from "vitest";
import { contentPreview } from "../src/processor/preview";

describe("contentPreview", () => {
  it("collapses whitespace and trims", () => {
    expect(contentPreview("  hello   \n\n world  ")).toBe("hello world");
  });

  it("truncates with ellipsis beyond max", () => {
    expect(contentPreview("abcdefghij", 5)).toBe("abcde…");
  });

  it("keeps short content untouched", () => {
    expect(contentPreview("short", 100)).toBe("short");
  });
});
