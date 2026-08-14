/**
 * Classification of an all-servers-failed broadcast.
 *
 * An explicit rejection is a server answering the broadcast with a Blockbook
 * error response: the server received the transaction and refused it, so the
 * same signed bytes will be refused again and cannot be on the network from
 * this attempt. Anything else (a request timeout, a dropped connection, an
 * HTTP status error whose body was never read) leaves relay possible: a
 * server can relay the transaction to the network and still fail to answer.
 *
 * The classification is pure error-shape inspection. It adds no network
 * calls, so it cannot add latency to the send path.
 */

/**
 * A broadcast that failed on every server where at least one failure was a
 * transport error rather than an explicit rejection. The transaction cannot
 * be assumed absent from the network, so a retry could produce a second real
 * payment. Consumers branch on `name === 'BroadcastAmbiguityError'`; class
 * identity does not survive the core bridge, names and properties do.
 */
export class BroadcastAmbiguityError extends Error {
  readonly causes: string[]

  constructor(causes: string[]) {
    super('Broadcast failed, but the transaction may have reached the network')
    this.name = 'BroadcastAmbiguityError'
    this.causes = causes
  }
}

export const isExplicitBroadcastRejection = (error: unknown): boolean =>
  String(error instanceof Error ? error.message : error).includes(
    'Blockbook Error: '
  )

/**
 * A rejection that means the server ALREADY HAS the transaction
 * ("transaction already in block chain", "txn-already-in-mempool",
 * "txn-already-known"). This is a confirmation the transaction reached the
 * network, from this attempt or an earlier one with the same signed bytes,
 * so the broadcast must be treated as a success: presenting it as a
 * failure invites the duplicate-payment retry this work exists to stop.
 */
export const isAlreadyKnownRejection = (error: unknown): boolean =>
  isExplicitBroadcastRejection(error) &&
  /alread/i.test(String(error instanceof Error ? error.message : error))

/**
 * A failure from a server that provably never accepted the payload, so it
 * cannot have relayed the transaction: the Electrum stub refuses
 * broadcastTx synchronously. Such failures say nothing about relay and are
 * excluded from the ambiguity determination. (A not-yet-connected blockbook
 * is NOT in this class: its queued request can still send once the
 * connection completes, so its timeout stays ambiguous.)
 */
export const isNonRelayFailure = (error: unknown): boolean =>
  String(error instanceof Error ? error.message : error).includes(
    'not supported for Electrum connections'
  )

export const classifyBroadcastFailure = (
  errors: unknown[]
): 'rejected' | 'ambiguous' => {
  if (errors.length === 0) return 'ambiguous'
  const relayCapable = errors.filter(error => !isNonRelayFailure(error))
  return relayCapable.every(isExplicitBroadcastRejection)
    ? 'rejected'
    : 'ambiguous'
}
