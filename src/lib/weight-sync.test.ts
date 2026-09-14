import { beforeEach, describe, expect, it, vi } from "vitest";

const weightLogFindFirstMock = vi.fn();
const bodyCompFindFirstMock = vi.fn();
const userUpdateMock = vi.fn();
vi.mock("./db", () => ({
  db: {
    weightLog: { findFirst: (...args: unknown[]) => weightLogFindFirstMock(...args) },
    bodyCompositionLog: { findFirst: (...args: unknown[]) => bodyCompFindFirstMock(...args) },
    user: { update: (...args: unknown[]) => userUpdateMock(...args) },
  },
}));

const { syncWeightKgToLatestLog } = await import("./weight-sync");

beforeEach(() => {
  weightLogFindFirstMock.mockReset();
  bodyCompFindFirstMock.mockReset();
  userUpdateMock.mockReset();
});

describe("syncWeightKgToLatestLog", () => {
  it("uses the WeightLog value when it's more recent than the latest body-composition scan", async () => {
    weightLogFindFirstMock.mockResolvedValue({ weightKg: 70, loggedAt: new Date("2026-02-01") });
    bodyCompFindFirstMock.mockResolvedValue({ weightKg: 68, loggedAt: new Date("2026-01-01") });
    await syncWeightKgToLatestLog("u1");
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: "u1" }, data: { weightKg: 70 } });
  });

  it("uses the body-composition scan's value when it's more recent than the latest WeightLog", async () => {
    weightLogFindFirstMock.mockResolvedValue({ weightKg: 70, loggedAt: new Date("2026-01-01") });
    bodyCompFindFirstMock.mockResolvedValue({ weightKg: 68, loggedAt: new Date("2026-02-01") });
    await syncWeightKgToLatestLog("u1");
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: "u1" }, data: { weightKg: 68 } });
  });

  it("falls back to whichever source has a row when only one does", async () => {
    weightLogFindFirstMock.mockResolvedValue(null);
    bodyCompFindFirstMock.mockResolvedValue({ weightKg: 68, loggedAt: new Date("2026-01-01") });
    await syncWeightKgToLatestLog("u1");
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: "u1" }, data: { weightKg: 68 } });
  });

  it("leaves User.weightKg untouched when neither table has any rows left for this user", async () => {
    weightLogFindFirstMock.mockResolvedValue(null);
    bodyCompFindFirstMock.mockResolvedValue(null);
    await syncWeightKgToLatestLog("u1");
    expect(userUpdateMock).not.toHaveBeenCalled();
  });
});
