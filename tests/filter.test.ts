import { describe, expect, it } from "vitest";
import { isBlocked, isNoise, shouldCapture } from "../src/collector/filter";

describe("filter", () => {
  it("blocks default sensitive domains", () => {
    expect(isBlocked("https://mail.google.com/inbox")).toBe(true);
    expect(isBlocked("https://example.com/article")).toBe(false);
  });

  it("supports wildcard patterns", () => {
    expect(isBlocked("https://my.bank/login", ["*.bank"])).toBe(true);
  });

  it("treats internal/empty urls as noise", () => {
    expect(isNoise("chrome://newtab/")).toBe(true);
    expect(isNoise("about:blank")).toBe(true);
    expect(isNoise("https://example.com")).toBe(false);
  });

  it("captures only non-noise non-blocked urls", () => {
    expect(shouldCapture("https://example.com/post")).toBe(true);
    expect(shouldCapture("https://paypal.com/pay")).toBe(false);
    expect(shouldCapture("chrome://settings")).toBe(false);
  });
});
