import { describe, expect, it } from "vitest";
import { parseMonthParam } from "./month-filter";

describe("parseMonthParam", () => {
  it("returns null for an undefined value (no filter applied)", () => {
    expect(parseMonthParam(undefined)).toBeNull();
  });

  it("returns null for a malformed value", () => {
    expect(parseMonthParam("not-a-month")).toBeNull();
    expect(parseMonthParam("2026")).toBeNull();
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam("2026-00")).toBeNull();
  });

  it("parses a valid YYYY-MM into a [from, toExclusive) range", () => {
    const range = parseMonthParam("2026-03");
    expect(range).not.toBeNull();
    expect(range?.from).toEqual(new Date(2026, 2, 1));
    expect(range?.to).toEqual(new Date(2026, 3, 1));
  });

  it("rolls December into January of the next year", () => {
    const range = parseMonthParam("2026-12");
    expect(range?.from).toEqual(new Date(2026, 11, 1));
    expect(range?.to).toEqual(new Date(2027, 0, 1));
  });

  it("accepts a single-digit month", () => {
    const range = parseMonthParam("2026-3");
    expect(range?.from).toEqual(new Date(2026, 2, 1));
  });
});
