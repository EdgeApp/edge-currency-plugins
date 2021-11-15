import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  cashAddressToHash,
  CashaddrTypeEnum,
  hashToCashAddress
} from '../../../../../src/common/utxobased/keymanager/bitcoincashUtils/cashAddress'
import {
  addressToScriptPubkey,
  AddressTypeEnum,
  scriptPubkeyToScriptHash,
  ScriptTypeEnum
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('bitcoin cash address tests', () => {
  const pubkeyHash = scriptPubkeyToScriptHash({
    scriptPubkey: addressToScriptPubkey({
      address: '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
      addressType: AddressTypeEnum.p2pkh,
      coin: 'bitcoin'
    }),
    scriptType: ScriptTypeEnum.p2pkh,
    coin: 'bitcoin'
  })
  it('pubkey hash to cashaddr', () => {
    const address = hashToCashAddress(
      pubkeyHash,
      CashaddrTypeEnum.pubkeyhash,
      'bitcoincash'
    )
    expect(address).to.equal(
      'bitcoincash:qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gms8s0u59'
    )
  })

  it('cash address to pubkey hash', () => {
    const info = cashAddressToHash(
      'bitcoincash:qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gms8s0u59',
      ['bitcoincash']
    )
    expect(info.scriptHash.toString('hex')).to.equal(
      'd986ed01b7a22225a70edbf2ba7cfb63a15cb3aa'
    )
  })

  const scriptHash = scriptPubkeyToScriptHash({
    scriptPubkey: addressToScriptPubkey({
      address: '37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf',
      addressType: AddressTypeEnum.p2sh,
      coin: 'bitcoin'
    }),
    scriptType: ScriptTypeEnum.p2sh,
    coin: 'bitcoin'
  })

  it('script hash to cashaddr', () => {
    const address = hashToCashAddress(
      scriptHash,
      CashaddrTypeEnum.scripthash,
      'bitcoincash'
    )
    expect(address).to.equal(
      'bitcoincash:pqlmd62cztjhhdrfr7dy5c5gv2np5nmknvhfvqp85n'
    )
  })

  it('cash address to script hash', () => {
    const info = cashAddressToHash(
      'bitcoincash:pqlmd62cztjhhdrfr7dy5c5gv2np5nmknvhfvqp85n',
      ['bitcoincash']
    )
    expect(info.scriptHash.toString('hex')).to.equal(
      '3fb6e95812e57bb4691f9a4a628862a61a4f769b'
    )
  })
})
