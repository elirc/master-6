import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("createApp", () => {
  it("creates an express application", () => {
    const app = createApp();
    expect(typeof app).toBe("function");
  });
});
