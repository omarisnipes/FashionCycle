;; FashionNFT Contract
;; Clarity v2
;; Manages minting, transfer, and metadata for digital/physical fashion NFTs

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-ALREADY-MINTED u101)
(define-constant ERR-INVALID-TOKEN-ID u102)
(define-constant ERR-INVALID-METADATA u103)
(define-constant ERR-NOT-OWNER u104)
(define-constant ERR-PAUSED u105)
(define-constant ERR-ZERO-ADDRESS u106)
(define-constant ERR-MAX-MINT-LIMIT u107)
(define-constant ERR-INVALID-CREATOR u108)

;; NFT metadata
(define-constant NFT-NAME "FashionCycle NFT")
(define-constant NFT-SYMBOL "FASHNFT")
(define-constant MAX-MINT-PER-CREATOR u1000) ;; Max NFTs per creator

;; Contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var token-id-counter uint u0)
(define-data-var creator-registry (list 1000 principal) (list))

;; NFT storage
(define-non-fungible-token fashion-nft uint)
(define-map token-metadata uint { uri: (string-ascii 256), creator: principal })
(define-map creator-mint-count principal uint)

;; Events for transparency
(define-data-var last-event-id uint u0)
(define-map events uint { event-type: (string-ascii 32), token-id: uint, sender: principal, data: (string-ascii 256) })

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: emit event
(define-private (emit-event (event-type (string-ascii 32)) (token-id uint) (data (string-ascii 256)))
  (let ((event-id (+ (var-get last-event-id) u1)))
    (map-set events event-id { event-type: event-type, token-id: token-id, sender: tx-sender, data: data })
    (var-set last-event-id event-id)
    (ok event-id)
  )
)

;; Register a creator
(define-public (register-creator (creator principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq creator 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (not (is-some (index-of (var-get creator-registry) creator))) (err ERR-INVALID-CREATOR))
    (var-set creator-registry (unwrap-panic (as-max-len? (append (var-get creator-registry) creator) u1000)))
    (ok true)
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (try! (emit-event "admin-transferred" u0 (unwrap-panic (to-string new-admin))))
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (try! (emit-event "pause-toggled" u0 (if pause "paused" "unpaused")))
    (ok pause)
  )
)

;; Mint a new NFT
(define-public (mint-nft (recipient principal) (token-uri (string-ascii 256)))
  (begin
    (ensure-not-paused)
    (asserts! (is-some (index-of (var-get creator-registry) tx-sender)) (err ERR-INVALID-CREATOR))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> (len token-uri) u0) (err ERR-INVALID-METADATA))
    (let ((new-id (+ (var-get token-id-counter) u1))
          (creator-count (default-to u0 (map-get? creator-mint-count tx-sender))))
      (asserts! (< creator-count MAX-MINT-PER-CREATOR) (err ERR-MAX-MINT-LIMIT))
      (try! (nft-mint? fashion-nft new-id recipient))
      (map-set token-metadata new-id { uri: token-uri, creator: tx-sender })
      (map-set creator-mint-count tx-sender (+ creator-count u1))
      (var-set token-id-counter new-id)
      (try! (emit-event "nft-minted" new-id token-uri))
      (ok new-id)
    )
  )
)

;; Transfer NFT
(define-public (transfer-nft (token-id uint) (recipient principal))
  (begin
    (ensure-not-paused)
    (asserts! (is-eq (unwrap-panic (nft-get-owner? fashion-nft token-id)) tx-sender) (err ERR-NOT-OWNER))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (try! (nft-transfer? fashion-nft token-id tx-sender recipient))
    (try! (emit-event "nft-transferred" token-id (unwrap-panic (to-string recipient))))
    (ok true)
  )
)

;; Update token metadata (only by creator)
(define-public (update-metadata (token-id uint) (new-uri (string-ascii 256)))
  (begin
    (ensure-not-paused)
    (let ((metadata (unwrap-panic (map-get? token-metadata token-id))))
      (asserts! (is-eq (get creator metadata) tx-sender) (err ERR-NOT-AUTHORIZED))
      (asserts! (> (len new-uri) u0) (err ERR-INVALID-METADATA))
      (map-set token-metadata token-id { uri: new-uri, creator: (get creator metadata) })
      (try! (emit-event "metadata-updated" token-id new-uri))
      (ok true)
    )
  )
)

;; Read-only: get token metadata
(define-read-only (get-token-metadata (token-id uint))
  (ok (map-get? token-metadata token-id))
)

;; Read-only: get token owner
(define-read-only (get-token-owner (token-id uint))
  (ok (nft-get-owner? fashion-nft token-id))
)

;; Read-only: get total minted
(define-read-only (get-total-minted)
  (ok (var-get token-id-counter))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: get creator mint count
(define-read-only (get-creator-mint-count (creator principal))
  (ok (default-to u0 (map-get? creator-mint-count creator)))
)

;; Read-only: check if creator is registered
(define-read-only (is-creator-registered (creator principal))
  (ok (is-some (index-of (var-get creator-registry) creator)))
)