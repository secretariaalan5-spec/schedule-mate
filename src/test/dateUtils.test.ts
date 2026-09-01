import { describe, expect, it } from "vitest";
import { addYearsToLocalDateKey, formatValidLocalDate, parseValidLocalDate, toLocalDateKey, validLocalDateKeyOrNull } from "@/lib/dateUtils";

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

  it("adds years without accepting malformed legacy values", () => {
    expect(addYearsToLocalDateKey("2026-08-04", 3)).toBe("2029-08-04");
    expect(addYearsToLocalDateKey("20001-09-11", 3)).toBeNull();
    expect(addYearsToLocalDateKey("2026-02-31", 3)).toBeNull();
  });

  it("sanitizes malformed database date values before rendering", () => {
    expect(validLocalDateKeyOrNull("20001-09-11")).toBeNull();
    expect(validLocalDateKeyOrNull("2003-06-09T00:00:00Z")).toBe("2003-06-09");
  });
});