import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ post: vi.fn() }));
const clearAllLocalState = vi.hoisted(() => vi.fn());
const getStoredRefreshToken = vi.hoisted(() => vi.fn());

vi.mock("./api", () => ({ default: api }));
vi.mock("./state", () => ({ clearAllLocalState }));
vi.mock("./refreshTokenStorage", () => ({ getStoredRefreshToken }));

import { logout } from "./auth";

describe("logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ status: 200 });
  });

  it("sends the stored refresh token so native sessions are revoked", async () => {
    getStoredRefreshToken.mockResolvedValue("rotated-token");

    await logout();

    expect(api.post).toHaveBeenCalledWith(
      "/users/logout",
      {},
      { headers: { "X-Refresh-Token": "rotated-token" } },
    );
    expect(clearAllLocalState).toHaveBeenCalledTimes(1);
  });

  it("omits the header on the web where no token is stored", async () => {
    getStoredRefreshToken.mockResolvedValue(null);

    await logout();

    expect(api.post).toHaveBeenCalledWith("/users/logout", {}, { headers: {} });
  });

  it("clears local state even if the server request fails", async () => {
    getStoredRefreshToken.mockResolvedValue("rotated-token");
    api.post.mockRejectedValue(new Error("offline"));

    await logout();

    expect(clearAllLocalState).toHaveBeenCalledTimes(1);
  });
});
