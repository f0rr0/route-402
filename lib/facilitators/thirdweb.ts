import type { FacilitatorAdapter } from "./types";

export const thirdwebAdapter: FacilitatorAdapter = {
  provider: "thirdweb",
  async supported() {
    throw new Error("thirdweb adapter not implemented");
  },
  async verify() {
    throw new Error("thirdweb adapter not implemented");
  },
  async settle() {
    throw new Error("thirdweb adapter not implemented");
  },
};
