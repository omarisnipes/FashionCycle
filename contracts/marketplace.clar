;; Marketplace Contract
;; Clarity v2
;; Manages buying, selling, and royalty distribution for FashionNFTs

(define-constant ERR-NOT-AUTHORIZED u200)
(define-constant ERR-INVALID-TOKEN-ID u201)
(define-constant ERR-NOT-LISTED u202)
(define-constant ERR-INSUFFICIENT-FUNDS u203)
(define-constant ERR-PAUSED u204)
(define-constant ERR-ZERO-ADDRESS u205)
(define-constant ERR-INVALID-AMOUNT u206)
(define-constant ERR-NOT-APPROVED u207)
(define-constant ERR-INVALID-PERCENTAGE u208)
(define-constant ERR-TOKEN-NOT-EXISTS u209)

;; Contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var platform-fee-address principal tx-sender)
(define-data-var platform-fee-percent uint u200) ;; 2.00% (basis points)
(define-data-var max-royalty-percent uint u1000) ;; 10.00% max royalty (basis points)

;; Marketplace data
(define-map listings uint { price: uint, seller: principal, royalty-percent: uint })
(define-map approvals { token-id: uint, operator: principal } bool)

;; Events for transparency
(define-data-var last-event-id uint u0)
(define-map events uint { event-type: (string-ascii 32), token-id: uint, sender: principal, data: (string-ascii 256) })

;; External contract reference
(define-constant NFT-CONTRACT 'SP000000000000000000002Q6VF78.fashion-nft)

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

;; Set platform fee address
(define-public (set-platform-fee-address (new-address principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-address 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set platform-fee-address new-address)
    (try! (emit-event "fee-address-updated" u0 (unwrap-panic (to-string new-address))))
    (ok true)
  )
)

;; Set platform fee percentage
(define-public (set-platform-fee-percent (new-percent uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= new-percent u500) (err ERR-INVALID-PERCENTAGE)) ;; Max 5%
    (var-set platform-fee-percent new-percent)
    (try! (emit-event "fee-percent-updated" u0 (unwrap-panic (to-string new-percent))))
    (ok true)
  )
)

;; Approve operator for NFT
(define-public (approve-operator (token-id uint) (operator principal))
  (begin
    (ensure-not-paused)
    (asserts! (is-eq (unwrap-panic (contract-call? NFT-CONTRACT get-token-owner token-id)) tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq operator 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (map-set approvals { token-id: token-id, operator: operator } true)
    (try! (emit-event "operator-approved" token-id (unwrap-panic (to-string operator))))
    (ok true)
  )
)

;; Revoke operator approval
(define-public (revoke-operator (token-id uint) (operator principal))
  (begin
    (ensure-not-paused)
    (asserts! (is-eq (unwrap-panic (contract-call? NFT-CONTRACT get-token-owner token-id)) tx-sender) (err ERR-NOT-AUTHORIZED))
    (map-delete approvals { token-id: token-id, operator: operator })
    (try! (emit-event "operator-revoked" token-id (unwrap-panic (to-string operator))))
    (ok true)
  )
)

;; List NFT for sale
(define-public (list-nft (token-id uint) (price uint) (royalty-percent uint))
  (begin
    (ensure-not-paused)
    (asserts! (> price u0) (err ERR-INVALID-AMOUNT))
    (asserts! (<= royalty-percent (var-get max-royalty-percent)) (err ERR-INVALID-PERCENTAGE))
    (asserts! (is-some (contract-call? NFT-CONTRACT get-token-owner token-id)) (err ERR-TOKEN-NOT-EXISTS))
    (asserts! (or 
                (is-eq (unwrap-panic (contract-call? NFT-CONTRACT get-token-owner token-id)) tx-sender)
                (map-get? approvals { token-id: token-id, operator: tx-sender })) (err ERR-NOT-AUTHORIZED))
    (map-set listings token-id { price: price, seller: tx-sender, royalty-percent: royalty-percent })
    (try! (emit-event "nft-listed" token-id (unwrap-panic (to-string price))))
    (ok true)
  )
)

;; Delist NFT
(define-public (delist-nft (token-id uint))
  (begin
    (ensure-not-paused)
    (let ((listing (unwrap-panic (map-get? listings token-id))))
      (asserts! (is-eq (get seller listing) tx-sender) (err ERR-NOT-AUTHORIZED))
      (map-delete listings token-id)
      (try! (emit-event "nft-delisted" token-id ""))
      (ok true)
    )
  )
)

;; Buy NFT
(define-public (buy-nft (token-id uint))
  (begin
    (ensure-not-paused)
    (let ((listing (unwrap-panic (map-get? listings token-id)))
          (metadata (unwrap-panic (contract-call? NFT-CONTRACT get-token-metadata token-id))))
      (asserts! (>= (stx-get-balance tx-sender) (get price listing)) (err ERR-INSUFFICIENT-FUNDS))
      (let ((platform-fee (/ (* (get price listing) (var-get platform-fee-percent)) u10000))
            (royalty (/ (* (get price listing) (get royalty-percent listing)) u10000))
            (seller-amount (- (get price listing) (+ platform-fee royalty))))
        (try! (stx-transfer? platform-fee tx-sender (var-get platform-fee-address)))
        (try! (stx-transfer? royalty tx-sender (get creator metadata)))
        (try! (stx-transfer? seller-amount tx-sender (get seller listing)))
        (try! (contract-call? NFT-CONTRACT transfer-nft token-id tx-sender))
        (map-delete listings token-id)
        (try! (emit-event "nft-sold" token-id (unwrap-panic (to-string (get price listing)))))
        (ok true)
      )
    )
  )
)

;; Read-only: get listing
(define-read-only (get-listing (token-id uint))
  (ok (map-get? listings token-id))
)

;; Read-only: get platform fee address
(define-read-only (get-platform-fee-address)
  (ok (var-get platform-fee-address))
)

;; Read-only: get platform fee percent
(define-read-only (get-platform-fee-percent)
  (ok (var-get platform-fee-percent))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: check operator approval
(define-read-only (is-approved (token-id uint) (operator principal))
  (ok (default-to false (map-get? approvals { token-id: token-id, operator: operator })))
)