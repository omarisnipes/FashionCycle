import { describe, it, expect, beforeEach } from "vitest";

interface MockFashionNFT {
  admin: string;
  paused: boolean;
  tokenIdCounter: bigint;
  creatorRegistry: string[];
  tokenMetadata: Map<bigint, { uri: string; creator: string }>;
  creatorMintCount: Map<string, bigint>;
  owners: Map<bigint, string>;
  events: Map<bigint, { eventType: string; tokenId: bigint; sender: string; data: string }>;
  lastEventId: bigint;
  mintNFT(caller: string, recipient: string, tokenUri: string): { value: bigint } | { error: number };
  transferNFT(caller: string, tokenId: bigint, recipient: string): { value: boolean } | { error: number };
  updateMetadata(caller: string, tokenId: bigint, newUri: string): { value: boolean } | { error: number };
  registerCreator(caller: string, creator: string): { value: boolean } | { error: number };
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
}

const mockContract: MockFashionNFT = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  tokenIdCounter: 0n,
  creatorRegistry: [],
  tokenMetadata: new Map(),
  creatorMintCount: new Map(),
  owners: new Map(),
  events: new Map(),
  lastEventId: 0n,

  registerCreator(caller: string, creator: string) {
    if (caller !== this.admin) return { error: 100 };
    if (creator === "SP000000000000000000002Q6VF78") return { error: 106 };
    if (this.creatorRegistry.includes(creator)) return { error: 108 };
    this.creatorRegistry.push(creator);
    return { value: true };
  },

  setPaused(caller: string, pause: boolean) {
    if (caller !== this.admin) return { error: 100 };
    this.paused = pause;
    this.events.set(++this.lastEventId, { eventType: "pause-toggled", tokenId: 0n, sender: caller, data: pause ? "paused" : "unpaused" });
    return { value: pause };
  },

  mintNFT(caller: string, recipient: string, tokenUri: string) {
    if (this.paused) return { error: 105 };
    if (!this.creatorRegistry.includes(caller)) return { error: 108 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 106 };
    if (tokenUri.length === 0) return { error: 103 };
    const creatorCount = (this.creatorMintCount.get(caller) || 0n);
    if (creatorCount >= 1000n) return { error: 107 };
    const newId = ++this.tokenIdCounter;
    this.owners.set(newId, recipient);
    this.tokenMetadata.set(newId, { uri: tokenUri, creator: caller });
    this.creatorMintCount.set(caller, creatorCount + 1n);
    this.events.set(++this.lastEventId, { eventType: "nft-minted", tokenId: newId, sender: caller, data: tokenUri });
    return { value: newId };
  },

  transferNFT(caller: string, tokenId: bigint, recipient: string) {
    if (this.paused) return { error: 105 };
    if (this.owners.get(tokenId) !== caller) return { error: 104 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 106 };
    this.owners.set(tokenId, recipient);
    this.events.set(++this.lastEventId, { eventType: "nft-transferred", tokenId, sender: caller, data: recipient });
    return { value: true };
  },

  updateMetadata(caller: string, tokenId: bigint, newUri: string) {
    if (this.paused) return { error: 105 };
    const metadata = this.tokenMetadata.get(tokenId);
    if (!metadata || metadata.creator !== caller) return { error: 100 };
    if (newUri.length === 0) return { error: 103 };
    this.tokenMetadata.set(tokenId, { uri: newUri, creator: metadata.creator });
    this.events.set(++this.lastEventId, { eventType: "metadata-updated", tokenId, sender: caller, data: newUri });
    return { value: true };
  },
};

describe("FashionNFT Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.tokenIdCounter = 0n;
    mockContract.creatorRegistry = [];
    mockContract.tokenMetadata = new Map();
    mockContract.creatorMintCount = new Map();
    mockContract.owners = new Map();
    mockContract.events = new Map();
    mockContract.lastEventId = 0n;
  });

  it("should register a creator", () => {
    const result = mockContract.registerCreator(mockContract.admin, "ST2CY5...");
    expect(result).toEqual({ value: true });
    expect(mockContract.creatorRegistry).toContain("ST2CY5...");
  });

  it("should prevent non-admin from registering creators", () => {
    const result = mockContract.registerCreator("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 100 });
  });

  it("should mint NFT for registered creator", () => {
    mockContract.registerCreator(mockContract.admin, "ST2CY5...");
    const result = mockContract.mintNFT("ST2CY5...", "ST3NB...", "ipfs://metadata");
    expect(result).toEqual({ value: 1n });
    expect(mockContract.owners.get(1n)).toBe("ST3NB...");
    expect(mockContract.tokenMetadata.get(1n)).toEqual({ uri: "ipfs://metadata", creator: "ST2CY5..." });
    expect(mockContract.creatorMintCount.get("ST2CY5...")).toBe(1n);
  });

  it("should prevent minting by unregistered creator", () => {
    const result = mockContract.mintNFT("ST2CY5...", "ST3NB...", "ipfs://metadata");
    expect(result).toEqual({ error: 108 });
  });

  it("should prevent minting with empty URI", () => {
    mockContract.registerCreator(mockContract.admin, "ST2CY5...");
    const result = mockContract.mintNFT("ST2CY5...", "ST3NB...", "");
    expect(result).toEqual({ error: 103 });
  });

  it("should transfer NFT", () => {
    mockContract.registerCreator(mockContract.admin, "ST2CY5...");
    mockContract.mintNFT("ST2CY5...", "ST3NB...", "ipfs://metadata");
    const result = mockContract.transferNFT("ST3NB...", 1n, "ST4JQ...");
    expect(result).toEqual({ value: true });
    expect(mockContract.owners.get(1n)).toBe("ST4JQ...");
  });

  it("should prevent transfer by non-owner", () => {
    mockContract.registerCreator(mockContract.admin, "ST2CY5...");
    mockContract.mintNFT("ST2CY5...", "ST3NB...", "ipfs://metadata");
    const result = mockContract.transferNFT("ST4JQ...", 1n, "ST5RK...");
    expect(result).toEqual({ error: 104 });
  });

  it("should update metadata by creator", () => {
    mockContract.registerCreator(mockContract.admin, "ST2CY5...");
    mockContract.mintNFT("ST2CY5...", "ST3NB...", "ipfs://metadata");
    const result = mockContract.updateMetadata("ST2CY5...", 1n, "ipfs://new-metadata");
    expect(result).toEqual({ value: true });
    expect(mockContract.tokenMetadata.get(1n)).toEqual({ uri: "ipfs://new-metadata", creator: "ST2CY5..." });
  });

  it("should prevent metadata update by non-creator", () => {
    mockContract.registerCreator(mockContract.admin, "ST2CY5...");
    mockContract.mintNFT("ST2CY5...", "ST3NB...", "ipfs://metadata");
    const result = mockContract.updateMetadata("ST4JQ...", 1n, "ipfs://new-metadata");
    expect(result).toEqual({ error: 100 });
  });

  it("should prevent actions when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    mockContract.registerCreator(mockContract.admin, "ST2CY5...");
    const mintResult = mockContract.mintNFT("ST2CY5...", "ST3NB...", "ipfs://metadata");
    expect(mintResult).toEqual({ error: 105 });
    const transferResult = mockContract.transferNFT("ST3NB...", 1n, "ST4JQ...");
    expect(transferResult).toEqual({ error: 105 });
  });
});