import { initEccLib } from 'altcoin-js'
import { expect } from 'chai'
import { ECPairAPI, ECPairFactory } from 'ecpair'
import { describe, it } from 'mocha'

import {
  addressToScriptPubkey,
  privateKeyToWIF,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  seedOrMnemonicToXPriv,
  signMessageBase64,
  wifToPrivateKeyEncoding,
  xprivToPrivateKey,
  xprivToXPub,
  xpubToPubkey
} from '../../../../../src/common/utxobased/keymanager/keymanager'
import { fixtures } from './altcointestfixtures'

describe('altcoin test fixtures', () => {
  let ECPair: ECPairAPI

  before(async function () {
    await import('@bitcoin-js/tiny-secp256k1-asmjs').then(tinysecp => {
      initEccLib(tinysecp)
      ECPair = ECPairFactory(tinysecp)
    })
  })

  fixtures.coins.forEach(f => {
    // test deriving a xpriv from a seed for each coin
    f.seedToXPrivTests.forEach(j => {
      it(`${f.name} bip44 mnemonic to xpriv ${j.type}`, () => {
        const resultLegacy = seedOrMnemonicToXPriv({
          seed: f.mnemonic,
          type: j.type,
          coin: f.name
        })
        expect(resultLegacy).to.equal(j.xpriv)
      })
    })
    // test deriving a xpub from a xpriv for each coin
    f.xprivToXPubTests.forEach(j => {
      it(`${f.name} bip32 xpriv to xpub ${j.type}`, () => {
        const resultLegacy = xprivToXPub({
          xpriv: j.xpriv,
          type: j.type,
          coin: f.name
        })
        expect(resultLegacy).to.equals(j.xpub)
      })
    })
    // derive a public key from an xpub and create a scriptPubkey for each coin
    f.xpubToPubkeyTests.forEach(j => {
      it(`${f.name} given an xpub, generate a ${j.addressType} address and cross verify script pubkey result`, () => {
        const pubkey = xpubToPubkey({
          xpub: j.xpub,
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
          addressType: j.addressType,
          coin: f.name
        })
        expect(address.address).to.equals(j.address)
        const legacyAddress = j.legacyAddress ?? j.address
        expect(address.legacyAddress).to.equals(legacyAddress)
        const scriptPubkeyRoundTrip = addressToScriptPubkey({
          address: address.address,
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
          const privateKeyEncoding = wifToPrivateKeyEncoding({
            wifKey: j.wifKey,
            coin: f.name
          })
          const wifKey = privateKeyToWIF({
            privateKey: privateKeyEncoding.hex,
            coin: f.name
          })
          const privateKeyEncodingRoundTrip = wifToPrivateKeyEncoding({
            wifKey,
            coin: f.name
          })
          const wifKeyRoundTrip = privateKeyToWIF({
            privateKey: privateKeyEncodingRoundTrip.hex,
            coin: f.name
          })
          expect(wifKey).to.be.equal(wifKeyRoundTrip)
        })
      })
    }
    f.addressToScriptPubkeyTests.forEach(j => {
      const message = j.extraMessage ?? ''
      it(`${f.name} guess script pubkeys from address ${message}`, () => {
        const scriptPubkey = addressToScriptPubkey({
          address: j.address,
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
            type: j.type,
            bip44ChangeIndex: 0,
            bip44AddressIndex: 0,
            coin: f.name
          })
          const derivedWIFKey = privateKeyToWIF({
            privateKey: derivedPrivateKey,
            coin: f.name
          })
          expect(derivedWIFKey).to.equal(j.wifKey)
        })
      })
    }
    if (f.signMessageTests != null) {
      f.signMessageTests.forEach(j => {
        it(`${f.name} sign message test`, () => {
          const privateKey = ECPair.fromWIF(j.wif).privateKey?.toString('hex')
          if (privateKey == null) {
            throw new Error('private key cannot be null')
          }
          const signature = signMessageBase64(j.message, privateKey)
          expect(signature).to.eqls(j.signature)
        })
      })
    }
  })
})
