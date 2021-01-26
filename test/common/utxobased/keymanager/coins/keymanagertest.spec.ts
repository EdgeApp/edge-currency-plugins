import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptPubkey,
  privateKeyToWIF,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  seedOrMnemonicToXPriv,
  wifToPrivateKey,
  xprivToPrivateKey,
  xprivToXPub,
  xpubToPubkey
} from '../../../../../src/common/utxobased/keymanager/keymanager'
import { fixtures } from './altcointestfixtures'

describe('altcoin test fixtures', () => {
  fixtures.coins.forEach(f => {
    // test deriving a xpriv from a seed for each coin
    f.seedToXPrivTests.forEach(j => {
      it(`${f.name} bip44 mnemonic to xpriv ${j.network} ${j.type}`, () => {
        const resultLegacy = seedOrMnemonicToXPriv({
          seed: f.mnemonic,
          network: j.network,
          type: j.type,
          coin: f.name
        })
        expect(resultLegacy).to.equal(j.xpriv)
      })
    })
    // test deriving a xpub from a xpriv for each coin
    f.xprivToXPubTests.forEach(j => {
      it(`${f.name} bip32 xpriv to xpub ${j.network} ${j.type}`, () => {
        const resultLegacy = xprivToXPub({
          xpriv: j.xpriv,
          network: j.network,
          type: j.type,
          coin: f.name
        })
        expect(resultLegacy).to.equals(j.xpub)
      })
    })
    // derive a public key from an xpub and create a scriptPubkey for each coin
    f.xpubToPubkeyTests.forEach(j => {
      it(`${f.name} ${j.network} given an xpub, generate a ${j.addressType} address and cross verify script pubkey result`, () => {
        const pubkey = xpubToPubkey({
          xpub: j.xpub,
          network: j.network,
          type: j.type,
          bip44ChangeIndex: 0,
          bip44AddressIndex: j.bip44AddressIndex,
          coin: f.name
        })
        const scriptPubkey = pubkeyToScriptPubkey({
          pubkey: pubkey,
          scriptType: j.scriptType
        }).scriptPubkey
        const address = scriptPubkeyToAddress({
          scriptPubkey: scriptPubkey,
          network: j.network,
          addressType: j.addressType,
          coin: f.name
        })
        expect(address.address).to.equals(j.address)
        const legacyAddress = j.legacyAddress ?? j.address
        expect(address.legacyAddress).to.equals(legacyAddress)
        const scriptPubkeyRoundTrip = addressToScriptPubkey({
          address: address.address,
          network: j.network,
          addressType: j.addressType,
          coin: f.name
        })
        expect(scriptPubkeyRoundTrip).to.equals(scriptPubkey)
      })
    })
    // convert from WIF to raw private key and back for each coin
    if (typeof f.wifToPrivateKeyTests !== 'undefined') {
      f.wifToPrivateKeyTests.forEach(j => {
        it(`${f.name} WIF to private key to WIF`, () => {
          const privateKey = wifToPrivateKey({
            wifKey: j.wifKey,
            network: j.network,
            coin: f.name
          })
          const wifKeyRoundTrip = privateKeyToWIF({
            privateKey: privateKey,
            network: j.network,
            coin: f.name
          })
          expect(j.wifKey).to.be.equal(wifKeyRoundTrip)
        })
      })
    }
    f.addressToScriptPubkeyTests.forEach(j => {
      const message = j.extraMessage ?? ''
      it(`${f.name} guess script pubkeys from address ${message}`, () => {
        const scriptPubkey = addressToScriptPubkey({
          address: j.address,
          network: j.network,
          coin: f.name
        })
        expect(scriptPubkey).to.equal(j.scriptPubkey)
      })
    })
    // convert an xpriv to a WIF private key for each coin
    if (typeof f.xprivToWifTests !== 'undefined') {
      f.xprivToWifTests.forEach(j => {
        it(`${f.name} xpriv to wif`, () => {
          const derivedPrivateKey = xprivToPrivateKey({
            xpriv: j.xpriv,
            network: j.network,
            type: j.type,
            bip44ChangeIndex: 0,
            bip44AddressIndex: 0,
            coin: f.name
          })
          const derivedWIFKey = privateKeyToWIF({
            privateKey: derivedPrivateKey,
            network: j.network,
            coin: f.name
          })
          expect(derivedWIFKey).to.equal(j.wifKey)
        })
      })
    }
  })
})
