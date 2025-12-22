import type { FacilitatorAdapter } from "./types";

export const cdpAdapter: FacilitatorAdapter = {
  provider: "cdp",
  async supported() {
    throw new Error("CDP adapter not implemented");
  },
  async verify() {
    throw new Error("CDP adapter not implemented");
  },
  async settle() {
    throw new Error("CDP adapter not implemented");
  },
};
