# FashionCycle

A blockchain-powered decentralized marketplace for digital and physical fashion, leveraging NFTs to ensure authenticity, automate royalties, and promote a circular economy through tokenized incentives for sustainable practices.

---

## Overview

FashionCycle is a Web3 platform built on the Stacks blockchain using Clarity smart contracts. It addresses counterfeiting, lack of transparency, and unsustainable practices in the fashion industry by enabling creators to mint NFTs for digital and physical fashion items, automate royalty distribution, verify authenticity, and incentivize recycling. The platform fosters a decentralized marketplace for peer-to-peer trading and promotes sustainability through tokenized rewards.

The platform consists of five main smart contracts that together create a transparent, creator-focused, and eco-friendly fashion ecosystem:

1. **FashionNFT Contract** – Manages the minting and metadata for digital and physical fashion NFTs.
2. **Marketplace Contract** – Facilitates buying, selling, and royalty distribution for fashion NFTs.
3. **Authenticity Contract** – Verifies the authenticity of physical fashion items linked to NFTs.
4. **RecyclingRewards Contract** – Issues tokenized rewards for recycling or reselling fashion items.
5. **Treasury Contract** – Manages platform fees and fund distribution.

---

## Features

- **NFT-based Digital and Physical Fashion**: Creators mint NFTs for digital fashion (metaverse wearables) or physical luxury items with linked authenticity certificates.
- **Automated Royalties**: Creators earn royalties on every resale via smart contracts.
- **Authenticity Verification**: Blockchain-based tracking ensures genuine products, reducing counterfeiting.
- **Circular Economy Incentives**: Users earn tokens for recycling or reselling fashion items, promoting sustainability.
- **Decentralized Marketplace**: Peer-to-peer trading of fashion NFTs with minimal fees.
- **Transparent Fund Management**: Platform fees and payouts are managed on-chain for trust and auditability.

---

## Smart Contracts

### FashionNFT Contract
- Mints NFTs for digital or physical fashion items.
- Stores metadata (e.g., design details, authenticity certificate URLs).
- Restricts minting to authorized creators.

### Marketplace Contract
- Lists NFTs for sale with creator-defined prices.
- Handles NFT purchases with automatic royalty distribution (e.g., 10% to creator).
- Collects platform fees (e.g., 2%) and routes them to the treasury.

### Authenticity Contract
- Verifies physical item authenticity via oracle or creator-signed certificates.
- Links NFTs to authenticity records on-chain.
- Allows buyers to check item provenance.

### RecyclingRewards Contract
- Issues platform tokens (e.g., FASH tokens) for recycling or reselling items.
- Tracks user contributions to the circular economy (e.g., via recycling center partnerships).
- Distributes rewards based on verified actions.

### Treasury Contract
- Collects platform fees from marketplace transactions.
- Routes funds to creators, recyclers, and platform maintenance.
- Provides transparent transaction logs.

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started):
   ```bash
   npm install -g @hirosystems/clarinet
   ```
2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/fashioncycle.git
   ```
3. Navigate to the project directory:
   ```bash
   cd fashioncycle
   ```
4. Run tests:
   ```bash
   clarinet test
   ```
5. Deploy contracts to the Stacks testnet:
   ```bash
   clarinet deploy
   ```

## Usage

Each smart contract is designed to operate independently but integrates seamlessly with others to create a cohesive fashion marketplace. Below are example interactions:

- **Minting an NFT**: Creators call the `FashionNFT` contract’s mint function to create a digital or physical fashion NFT with metadata.
- **Listing an Item**: Sellers use the `Marketplace` contract to list NFTs for sale, specifying a price.
- **Buying an Item**: Buyers purchase NFTs, with royalties and fees automatically handled by the `Marketplace` contract.
- **Verifying Authenticity**: Buyers query the `Authenticity` contract to confirm an item’s provenance.
- **Earning Rewards**: Users submit proof of recycling (via oracle or partner verification) to the `RecyclingRewards` contract to receive tokens.

Refer to individual contract documentation in the `/contracts` folder for detailed function calls, parameters, and usage examples.

## Example Clarity Contract Snippet (FashionNFT)

```clarity
(define-non-fungible-token fashion-nft uint)
(define-data-var token-id-counter uint u0)
(define-constant contract-owner tx-sender)

(define-public (mint-nft (recipient principal) (token-uri (string-ascii 256)))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err u403)) ;; Only owner can mint
    (let ((new-id (+ (var-get token-id-counter) u1)))
      (try! (nft-mint? fashion-nft new-id recipient))
      (var-set token-id-counter new-id)
      (ok new-id))))
```

## License

MIT License