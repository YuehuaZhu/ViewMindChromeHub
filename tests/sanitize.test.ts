import { describe, expect, it } from "vitest";
import {
  MAX_CONTENT_CHARS,
  isLoadingPlaceholder,
  isVerificationWallText,
  sanitizeMarkdown,
} from "../src/processor/sanitize";

describe("sanitizeMarkdown", () => {
  it("strips data:URI (base64) images entirely", () => {
    const md = "正文开头 _![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUg) 正文结尾";
    const out = sanitizeMarkdown(md);
    expect(out).not.toContain("base64");
    expect(out).not.toContain("data:image");
    expect(out).toContain("正文开头");
    expect(out).toContain("正文结尾");
  });

  it("keeps alt text of http images but drops the link", () => {
    expect(sanitizeMarkdown("![港科大校徽](https://x.com/logo.jpg)")).toBe("港科大校徽");
    expect(sanitizeMarkdown("![](https://x.com/a.png) 后面")).toBe(" 后面");
  });

  it("H1: handles image URLs containing parentheses without leaking trailing chars", () => {
    // 维基式带括号文件名：旧正则会在第一个 ) 截断、残留 ".jpg)"
    const out = sanitizeMarkdown("![图](https://en.wikipedia.org/wiki/File:Foo_(bar).jpg)");
    expect(out).toBe("图");
    expect(out).not.toContain(")");
    expect(out).not.toContain(".jpg");
  });

  it("H1: strips URL-encoded svg data URI with inner parens", () => {
    const out = sanitizeMarkdown("前![](data:image/svg+xml,%3Csvg%3E(x)%3C/svg%3E)后");
    expect(out).toBe("前后");
  });

  it("H2: linked image [![alt](src)](href) keeps only alt, not a mislinked label", () => {
    expect(sanitizeMarkdown("[![logo](https://x.com/l.png)](https://x.com)")).toBe("logo");
    // 不能歪曲成指向图片宿主页的链接
    expect(sanitizeMarkdown("[![logo](https://x.com/l.png)](https://x.com)")).not.toContain("](");
  });

  it("collapses adjacent duplicate lines (label repeated twice)", () => {
    const md = "基础空间\n\n基础空间\n\n每月分享流量\n\n每月分享流量";
    const out = sanitizeMarkdown(md);
    expect(out.match(/基础空间/g)?.length).toBe(1);
    expect(out.match(/每月分享流量/g)?.length).toBe(1);
  });

  it("does not collapse distinct lines", () => {
    const md = "第一段\n第二段\n第三段";
    expect(sanitizeMarkdown(md)).toBe(md);
  });

  it("M1: does not collapse duplicate lines inside code fences", () => {
    const md = "```\nx = 1\nx = 1\n```";
    expect(sanitizeMarkdown(md)).toBe(md);
  });

  it("M1: does not collapse repeated list items", () => {
    const md = "- 待办\n- 待办";
    expect(sanitizeMarkdown(md)).toBe(md);
  });

  it("truncates oversize content after stripping images", () => {
    const md = "x".repeat(MAX_CONTENT_CHARS + 5000);
    expect(sanitizeMarkdown(md).length).toBe(MAX_CONTENT_CHARS);
  });
});

describe("isVerificationWallText", () => {
  it("flags short verification-wall pages", () => {
    expect(isVerificationWallText("正在验证连接安全性，请勾选下方复选框。")).toBe(true);
    expect(isVerificationWallText("Just a moment...")).toBe(true);
    expect(isVerificationWallText("Checking your browser before accessing")).toBe(true);
  });

  it("does not flag long articles that merely mention the phrase", () => {
    const article = "这是一篇关于网络安全的长文。".repeat(60) + "正在验证连接安全";
    expect(isVerificationWallText(article)).toBe(false);
  });
});

describe("isLoadingPlaceholder", () => {
  it("flags empty / loading / upload-placeholder skeletons", () => {
    expect(isLoadingPlaceholder("")).toBe(true);
    expect(isLoadingPlaceholder("loading...")).toBe(true);
    expect(isLoadingPlaceholder("在此处拖放文件\n文件数量：最多 50 个")).toBe(true);
  });

  it("does not flag real rendered content", () => {
    expect(isLoadingPlaceholder("这是一篇正常渲染完成的文章正文，内容足够长。".repeat(20))).toBe(
      false,
    );
  });
});
