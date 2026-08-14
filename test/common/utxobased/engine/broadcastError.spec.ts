import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  BroadcastAmbiguityError,
  classifyBroadcastFailure,
  isAlreadyKnownRejection,
  isExplicitBroadcastRejection,
  isNonRelayFailure
} from '../../../../src/common/utxobased/engine/broadcastError'

describe('broadcast failure classification', function () {
  it('classifies all-explicit-rejection sets as rejected', function () {
    assert.equal(
      classifyBroadcastFailure([
        new Error('Blockbook Error: -26: dust'),
        new Error('Blockbook Error: -25: missing inputs')
      ]),
      'rejected'
    )
  })

  it('classifies any transport failure in the set as ambiguous', function () {
    assert.equal(
      classifyBroadcastFailure([
        new Error('Blockbook Error: -26: dust'),
        new Error('Timeout for request 42')
      ]),
      'ambiguous'
    )
    assert.equal(
      classifyBroadcastFailure([new Error('Timeout for request 42')]),
      'ambiguous'
    )
    assert.equal(
      classifyBroadcastFailure([
        new Error('Failed to broadcast transaction via Blockbook: HTTP 503')
      ]),
      'ambiguous'
    )
  })

  it('treats missing or empty error information as ambiguous', function () {
    assert.equal(classifyBroadcastFailure([]), 'ambiguous')
    assert.equal(classifyBroadcastFailure([undefined]), 'ambiguous')
  })

  it('excludes non-relay failures from the ambiguity determination', function () {
    const electrumStub = new Error(
      'broadcastTx not supported for Electrum connections'
    )
    assert.isTrue(isNonRelayFailure(electrumStub))
    // An Electrum stub alongside explicit rejections must not turn a
    // definitively failed broadcast into an ambiguous one.
    assert.equal(
      classifyBroadcastFailure([
        electrumStub,
        new Error('Blockbook Error: -26: dust')
      ]),
      'rejected'
    )
    // All-stub sets never sent anything anywhere: definitively failed.
    assert.equal(classifyBroadcastFailure([electrumStub]), 'rejected')
    // A transport failure still dominates.
    assert.equal(
      classifyBroadcastFailure([
        electrumStub,
        new Error('Timeout for request 42')
      ]),
      'ambiguous'
    )
  })

  it('recognizes explicit rejections by the Blockbook error marker', function () {
    assert.isTrue(
      isExplicitBroadcastRejection(new Error('Blockbook Error: -26: dust'))
    )
    assert.isFalse(isExplicitBroadcastRejection(new Error('socket closed')))
    assert.isFalse(isExplicitBroadcastRejection(undefined))
  })

  it('recognizes already-known rejections as network confirmation', function () {
    assert.isTrue(
      isAlreadyKnownRejection(
        new Error('Blockbook Error: -27: transaction already in block chain')
      )
    )
    assert.isTrue(
      isAlreadyKnownRejection(
        new Error('Blockbook Error: txn-already-in-mempool')
      )
    )
    assert.isTrue(
      isAlreadyKnownRejection(new Error('Blockbook Error: txn-already-known'))
    )
    assert.isFalse(
      isAlreadyKnownRejection(new Error('Blockbook Error: -26: dust'))
    )
    // "already" in a transport error is not a Blockbook rejection.
    assert.isFalse(isAlreadyKnownRejection(new Error('socket already closed')))
  })

  it('keeps a bridge-stable name and carries its causes', function () {
    const error = new BroadcastAmbiguityError(['Timeout for request 42'])
    assert.equal(error.name, 'BroadcastAmbiguityError')
    assert.deepEqual(error.causes, ['Timeout for request 42'])
    assert.instanceOf(error, Error)
  })
})
