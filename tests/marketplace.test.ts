import { describe, it, expect, beforeEach } from "vitest";

interface MockMarketplace {
  admin: string;
  paused: boolean;
  platformFeeAddress: string;
  platformFeePercent: bigint;
  maxRoyaltyPercent: bigint;
  listings: Map<bigint, { price: bigint; seller: string; royaltyPercent: bigint }>;
  approvals: Map<string, boolean>;
  events: Map<bigint, { eventType: string; tokenId: bigint; sender: string; data: string }>;
  lastEventId: bigint;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  setPlatformFeeAddress(caller: string, newAddress: string): { value: boolean } | { error: number };
  setPlatformFeePercent(caller: string, newPercent: bigint): { value: boolean } | { error: number };
  approveOperator(caller: string, tokenId: bigint, operator: string): { value: boolean } | { error: number };
  revokeOperator(caller: string, tokenId: bigint, operator: string): { value: boolean } | { error: number };
  listNFT(caller: string, tokenId: bigint, price: bigint, royaltyPercent: bigint): { value: boolean } | { error: number };
  delistNFT(caller: string, tokenId: bigint): { value: boolean } | { error: number };
  buyNFT(caller: string, tokenId: bigint, balance: bigint): { value: boolean } | { error: number };
}

const mockNFTContract = {
  owners: new Map<bigint, string>(),
  metadata: new Map<bigint, { uri: string; creator: string }>(),
  setOwner(tokenId: bigint, owner: string) {
    this.owners.set(tokenId, owner);
  },
  setMetadata(tokenId: bigint, uri: string, creator: string) {
    this.metadata.set(tokenId, { uri, creator });
  },
};

const mockMarketplace: MockMarketplace = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  platformFeeAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  platformFeePercent: 200n,
  maxRoyaltyPercent: 1000n,
  listings: new Map(),
  approvals: new Map(),
  events: new Map(),
  lastEventId: 0n,

  setPaused(caller: string, pause: boolean) {
    if (caller !== this.admin) return { error: 200 };
    this.paused = pause;
    this.events.set(++this.lastEventId, { eventType: "pause-toggled", tokenId: 0n, sender: caller, data: pause ? "paused" : "unpaused" });
    return { value: pause };
  },

  setPlatformFeeAddress(caller: string, newAddress: string) {
    if (caller !== this.admin) return { error: 200 };
    if (newAddress === "SP000000000000000000002Q6VF78") return { error: 205 };
    this.platformFeeAddress = newAddress;
    this.events.set(++this.lastEventId, { eventType: "fee-address-updated", tokenId: 0n, sender: caller, data: newAddress });
    return { value: true };
  },

  setPlatformFeePercent(caller: string, newPercent: bigint) {
    if (caller !== this.admin) return { error: 200 };
    if (newPercent > 500n) return { error: 208 };
    this.platformFeePercent = newPercent;
    this.events.set(++this.lastEventId, { eventType: "fee-percent-updated", tokenId: 0n, sender: caller, data: newPercent.toString() });
    return { value: true };
  },

  approveOperator(caller: string, tokenId: bigint, operator: string) {
    if (this.paused) return { error: 204 };
    if (mockNFTContract.owners.get(tokenId) !== caller) return { error: 200 };
    if (operator === "SP000000000000000000002Q6VF78") return { error: 205 };
    this.approvals.set(`${tokenId}-${operator}`, true);
    this.events.set(++this.lastEventId, { eventType: "operator-approved", tokenId, sender: caller, data: operator });
    return { value: true };
  },

  revokeOperator(caller: string, tokenId: bigint, operator: string) {
    if (this.paused) return { error: 204 };
    if (mockNFTContract.owners.get(tokenId) !== caller) return { error: 200 };
    this.approvals.delete(`${tokenId}-${operator}`);
    this.events.set(++this.lastEventId, { eventType: "operator-revoked", tokenId, sender: caller, data: operator });
    return { value: true };
  },

  listNFT(caller: string, tokenId: bigint, price: bigint, royaltyPercent: bigint) {
    if (this.paused) return { error: 204 };
    if (price === 0n) return { error: 206 };
    if (royaltyPercent > this.maxRoyaltyPercent) return { error: 208 };
    if (!mockNFTContract.owners.has(tokenId)) return { error: 209 };
    if (mockNFTContract.owners.get(tokenId) !== caller && !this.approvals.get(`${tokenId}-${caller}`)) return { error: 200 };
    this.listings.set(tokenId, { price, seller: caller, royaltyPercent });
    this.events.set(++this.lastEventId, { eventType: "nft-listed", tokenId, sender: caller, data: price.toString() });
    return { value: true };
  },

  delistNFT(caller: string, tokenId: bigint) {
    if (this.paused) return { error: 204 };
    const listing = this.listings.get(tokenId);
    if (!listing) return { error: 202 };
    if (listing.seller !== caller) return { error: 200 };
    this.listings.delete(tokenId);
    this.events.set(++this.lastEventId, { eventType: "nft-delisted", tokenId, sender: caller, data: "" });
    return { value: true };
  },

  buyNFT(caller: string, tokenId: bigint, balance: bigint) {
    if (this.paused) return { error: 204 };
    const listing = this.listings.get(tokenId);
    if (!listing) return { error: 202 };
    if (balance < listing.price) return { error: 203 };
    const metadata = mockNFTContract.metadata.get(tokenId);
    if (!metadata) return { error: 209 };
    const platformFee = (listing.price * this.platformFeePercent) / 10000n;
    const royalty = (listing.price * listing.royaltyPercent) / 10000n;
    mockNFTContract.owners.set(tokenId, caller);
    this.listings.delete(tokenId);
    this.events.set(++this.lastEventId, { eventType: "nft-sold", tokenId, sender: caller, data: listing.price.toString() });
    return { value: true };
  },
};

describe("Marketplace Contract", () => {
  beforeEach(() => {
    mockMarketplace.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockMarketplace.paused = false;
    mockMarketplace.platformFeeAddress = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockMarketplace.platformFeePercent = 200n;
    mockMarketplace.maxRoyaltyPercent = 1000n;
    mockMarketplace.listings = new Map();
    mockMarketplace.approvals = new Map();
    mockMarketplace.events = new Map();
    mockMarketplace.lastEventId = 0n;
    mockNFTContract.owners = new Map();
    mockNFTContract.metadata = new Map();
  });

  it("should set platform fee address", () => {
    const result = mockMarketplace.setPlatformFeeAddress(mockMarketplace.admin, "ST2CY5...");
    expect(result).toEqual({ value: true });
    expect(mockMarketplace.platformFeeAddress).toBe("ST2CY5...");
  });

  it("should prevent non-admin from setting fee address", () => {
    const result = mockMarketplace.setPlatformFeeAddress("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 200 });
  });

  it("should set platform fee percent", () => {
    const result = mockMarketplace.setPlatformFeePercent(mockMarketplace.admin, 300n);
    expect(result).toEqual({ value: true });
    expect(mockMarketplace.platformFeePercent).toBe(300n);
  });

  it("should prevent invalid fee percent", () => {
    const result = mockMarketplace.setPlatformFeePercent(mockMarketplace.admin, 600n);
    expect(result).toEqual({ error: 208 });
  });

  it("should approve operator", () => {
    mockNFTContract.setOwner(1n, "ST2CY5...");
    const result = mockMarketplace.approveOperator("ST2CY5...", 1n, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockMarketplace.approvals.get("1-ST3NB...")).toBe(true);
  });

  it("should prevent non-owner from approving operator", () => {
    mockNFTContract.setOwner(1n, "ST2CY5...");
    const result = mockMarketplace.approveOperator("ST3NB...", 1n, "ST4JQ...");
    expect(result).toEqual({ error: 200 });
  });

  it("should list NFT", () => {
    mockNFTContract.setOwner(1n, "ST2CY5...");
    mockNFTContract.setMetadata(1n, "ipfs://metadata", "ST4JQ...");
    const result = mockMarketplace.listNFT("ST2CY5...", 1n, 1000n, 500n);
    expect(result).toEqual({ value: true });
    expect(mockMarketplace.listings.get(1n)).toEqual({ price: 1000n, seller: "ST2CY5...", royaltyPercent: 500n });
  });

  it("should prevent listing with zero price", () => {
    mockNFTContract.setOwner(1n, "ST2CY5...");
    const result = mockMarketplace.listNFT("ST2CY5...", 1n, 0n, 500n);
    expect(result).toEqual({ error: 206 });
  });

  it("should delist NFT", () => {
    mockNFTContract.setOwner(1n, "ST2CY5...");
    mockNFTContract.setMetadata(1n, "ipfs://metadata", "ST4JQ...");
    mockMarketplace.listNFT("ST2CY5...", 1n, 1000n, 500n);
    const result = mockMarketplace.delistNFT("ST2CY5...", 1n);
    expect(result).toEqual({ value: true });
    expect(mockMarketplace.listings.has(1n)).toBe(false);
  });

  it("should prevent delisting by non-seller", () => {
    mockNFTContract.setOwner(1n, "ST2CY5...");
    mockNFTContract.setMetadata(1n, "ipfs://metadata", "ST4JQ...");
    mockMarketplace.listNFT("ST2CY5...", 1n, 1000n, 500n);
    const result = mockMarketplace.delistNFT("ST3NB...", 1n);
    expect(result).toEqual({ error: 200 });
  });

  it("should buy NFT", () => {
    mockNFTContract.setOwner(1n, "ST2CY5...");
    mockNFTContract.setMetadata(1n, "ipfs://metadata", "ST4JQ...");
    mockMarketplace.listNFT("ST2CY5...", 1n, 1000n, 500n);
    const result = mockMarketplace.buyNFT("ST3NB...", 1n, 1000n);
    expect(result).toEqual({ value: true });
    expect(mockNFTContract.owners.get(1n)).toBe("ST3NB...");
    expect(mockMarketplace.listings.has(1n)).toBe(false);
  });

  it("should prevent buying with insufficient funds", () => {
    mockNFTContract.setOwner(1n, "ST2CY5...");
    mockNFTContract.setMetadata(1n, "ipfs://metadata", "ST4JQ...");
    mockMarketplace.listNFT("ST2CY5...", 1n, 1000n, 500n);
    const result = mockMarketplace.buyNFT("ST3NB...", 1n, 500n);
    expect(result).toEqual({ error: 203 });
  });

  it("should prevent actions when paused", () => {
    mockMarketplace.setPaused(mockMarketplace.admin, true);
    mockNFTContract.setOwner(1n, "ST2CY5...");
    mockNFTContract.setMetadata(1n, "ipfs://metadata", "ST4JQ...");
    const listResult = mockMarketplace.listNFT("ST2CY5...", 1n, 1000n, 500n);
    expect(listResult).toEqual({ error: 204 });
    const buyResult = mockMarketplace.buyNFT("ST3NB...", 1n, 1000n);
    expect(buyResult).toEqual({ error: 204 });
  });
});