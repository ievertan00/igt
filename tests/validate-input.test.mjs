import { describe, it } from "node:test";
import assert from "node:assert";
import { isMainlyChinese } from "../lib/cli/validate-input.mjs";

describe("validate-input utility", () => {
  describe("isMainlyChinese", () => {
    it("should return false for empty or non-string inputs", () => {
      assert.strictEqual(isMainlyChinese(""), false);
      assert.strictEqual(isMainlyChinese(null), false);
      assert.strictEqual(isMainlyChinese(undefined), false);
      assert.strictEqual(isMainlyChinese(123), false);
    });

    it("should return true for purely Chinese text", () => {
      assert.strictEqual(isMainlyChinese("你好世界"), true);
      assert.strictEqual(isMainlyChinese("这是一个测试"), true);
    });

    it("should return true for mixed text with sufficient Chinese characters", () => {
      assert.strictEqual(isMainlyChinese("这是一个测试 test!"), true);
      assert.strictEqual(isMainlyChinese("这是一个测试 Hello!"), true); // 6/15 = 0.4 > 0.3
    });

    it("should return false for text with mostly English", () => {
      assert.strictEqual(isMainlyChinese("Hello world, this is a test. 你好"), false); // 2/31 = 0.06 < 0.3
    });

    it("should respect custom minRatio", () => {
      assert.strictEqual(isMainlyChinese("Hello 你好!", 0.2), true); // 2/9 = 0.22 >= 0.2
      assert.strictEqual(isMainlyChinese("Hello 你好!", 0.5), false); // 2/9 < 0.5
    });

    it("should handle punctuation properly", () => {
      assert.strictEqual(isMainlyChinese("！！！你好"), true); // length = 5, pure = 2, ratio = 0.4 > 0.3
      assert.strictEqual(isMainlyChinese("!@#$"), false); // pure = 0
    });
  });
});
