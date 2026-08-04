import { describe, expect, it } from "vitest";
import { formatValidLocalDate, parseValidLocalDate, toLocalDateKey } from "@/lib/dateUtils";

describe("dateUtils", () => {
  it("rejects legacy years outside the supported range", () => {
    expect(parseValidLocalDate("20001-09-11")).toBeNull();
    expect(parseValidLocalDate("20000-12-16")).toBeNull();
  });

  it("rejects impossible calendar dates", () => {
    expect(parseValidLocalDate("2026-02-31")).toBeNull();
  });

  it("returns the fallback instead of throwing", () => {
    expect(formatValidLocalDate("20001-09-11", "dd/MM/yyyy", "—")).toBe("—");
  });

  it("formats valid local dates", () => {
    expect(formatValidLocalDate("2026-08-04", "dd/MM/yyyy")).toBe("04/08/2026");
    expect(toLocalDateKey(new Date(2026, 7, 4, 12))).toBe("2026-08-04");
  });
});