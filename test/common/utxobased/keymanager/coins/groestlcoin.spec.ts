import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptPubkey,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  createTx,
  mnemonicToXPriv,
  NetworkEnum,
  privateKeyToPubkey,
  privateKeyToWIF,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  ScriptTypeEnum,
  signTx,
  TransactionInputTypeEnum,
  wifToPrivateKey,
  xprivToPrivateKey,
  xprivToXPub,
  xpubToPubkey,
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('groestlcoin mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/17'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'groestlcoin',
    })
    expect(resultLegacy).to.equal(
      'xprv9zG5s8VhyRCaktqFMWHHkaxX1XdgDsD2GjX31daogFTCcer54yTtWroAXRAHZV6GuuiTSUfNheduV4i8rJEJ45QGcCrfKyCwmbD4zaLp9Y7'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'groestlcoin',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JDr5AGu'
    )
  })
})

describe('groestlcoin bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9zG5s8VhyRCaktqFMWHHkaxX1XdgDsD2GjX31daogFTCcer54yTtWroAXRAHZV6GuuiTSUfNheduV4i8rJEJ45QGcCrfKyCwmbD4zaLp9Y7',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'groestlcoin',
    })
    expect(resultLegacy).to.equals(
      'xpub6DFSGe2bonksyNuiTXpJ7iuFZZUAdKvsdxSdp1zREazBVTBDcWn94f7eNg5MN148WHsaUfG3Mmmqa6nBi1VCde1t7wM3NA3993CcjChk1g5'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JDr5AGu',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'groestlcoin',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCaq6qME'
    )
  })
})

describe('groestlcoin xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6DFSGe2bonksyNuiTXpJ7iuFZZUAdKvsdxSdp1zREazBVTBDcWn94f7eNg5MN148WHsaUfG3Mmmqa6nBi1VCde1t7wM3NA3993CcjChk1g5',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'groestlcoin',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'groestlcoin',
    })
    expect(p2pkhAddress).to.equals('Fpzstx4fKWhqZYbVVmuncuhbEmgecqPTgg')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'Fpzstx4fKWhqZYbVVmuncuhbEmgecqPTgg',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'groestlcoin',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })

  it('given an ypub, generate p2wpkh-p2sh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKHP2SH = xpubToPubkey({
      xpub:
        'ypub6X46SconPpL9QhXPnMGuPLB9jYai7nrHz7ki4zq3awHb462iPSG5eV19oBWv22RWt69npsi75XGcANsevtTWE8YFgqpygrGUPnEKp6vty5v',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'groestlcoin',
    })
    const scriptPubkeyP2WPKHP2SH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKHP2SH,
      scriptType: ScriptTypeEnum.p2wpkhp2sh,
    }).scriptPubkey
    const p2wpkhp2shAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKHP2SH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'groestlcoin',
    })
    expect(p2wpkhp2shAddress).to.equals('3299Qf2x9BnzLaZu4HCLvm26RbBB3ZRf4u')
    const scriptPubkeyP2WPKHP2SHRoundTrip = addressToScriptPubkey({
      address: '3299Qf2x9BnzLaZu4HCLvm26RbBB3ZRf4u',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'groestlcoin',
    })
    expect(scriptPubkeyP2WPKHP2SHRoundTrip).to.equals(scriptPubkeyP2WPKHP2SH)
  })

  it('given a zpub, generate p2wpkh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKH = xpubToPubkey({
      xpub:
        'zpub6qdhcNVVLJ2t8kLzGLzeaiJv7EahaRBsXmu1yVPyXHvMdFmS4d7JSi5aS6mc1oz5k6DZN781Ffn3GAs3r2FJnCPSw5nti63s3c9EDg2u7MS',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'groestlcoin',
    })
    const scriptPubkeyP2WPKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKH,
      scriptType: ScriptTypeEnum.p2wpkh,
    }).scriptPubkey
    const p2wpkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'groestlcoin',
    })
    expect(p2wpkhAddress).to.equals(
      'grs1qrm2uggqj846nljryvmuga56vtwfey0dtnc4z55'
    )
    const scriptPubkeyP2WPKHRoundTrip = addressToScriptPubkey({
      address: 'grs1qrm2uggqj846nljryvmuga56vtwfey0dtnc4z55',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'groestlcoin',
    })
    expect(scriptPubkeyP2WPKHRoundTrip).to.be.equal(scriptPubkeyP2WPKH)
  })
})

describe('groestlcoin from XPriv to WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const xpriv =
      'xprv9zG5s8VhyRCaktqFMWHHkaxX1XdgDsD2GjX31daogFTCcer54yTtWroAXRAHZV6GuuiTSUfNheduV4i8rJEJ45QGcCrfKyCwmbD4zaLp9Y7'
    const derivedPrivateKey = xprivToPrivateKey({
      xpriv: xpriv,
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'groestlcoin',
    })
    const derivedWIFKey = privateKeyToWIF({
      privateKey: derivedPrivateKey,
      network: NetworkEnum.Mainnet,
      coin: 'groestlcoin',
    })
    const wifKey2 = 'L2JewQFXAVSw4zrihJY91G6ZUTL1F8YhcCqXgJTJd1AyCTABCzMD'
    const privateKey2 = wifToPrivateKey({
      wifKey: wifKey2,
      network: NetworkEnum.Mainnet,
      coin: 'groestlcoin',
    })
    const wifKeyRoundTrip2 = privateKeyToWIF({
      privateKey: privateKey2,
      network: NetworkEnum.Mainnet,
      coin: 'groestlcoin',
    })
    expect(wifKey2).to.be.equal(wifKeyRoundTrip2)

    const wifKey = 'KyeNA49yfj4JDoMEWtpQiosP6eig55att3cTv6NBXCeFNsHoNnyM'
    expect(derivedWIFKey).to.equal(wifKey)
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'groestlcoin',
    })
    expect(derivedPrivateKey).to.equal(privateKey)
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'groestlcoin',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('groestlcoin guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'Fpzstx4fKWhqZYbVVmuncuhbEmgecqPTgg',
      network: NetworkEnum.Mainnet,
      coin: 'groestlcoin',
    })
    expect(scriptPubkey).to.equal(
      '76a914d9863e608009f46ce023c852c7c209a607f8542b88ac'
    )
  })
  it('p2sh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: '3299Qf2x9BnzLaZu4HCLvm26RbBB3ZRf4u',
      network: NetworkEnum.Mainnet,
      coin: 'groestlcoin',
    })
    expect(scriptPubkey).to.equal(
      'a91404f1101bb0f5ca39c735bf1aa9bc99be571a9f5d87'
    )
  })

  it('p2wpkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'grs1qrm2uggqj846nljryvmuga56vtwfey0dtnc4z55',
      network: NetworkEnum.Mainnet,
      coin: 'groestlcoin',
    })
    expect(scriptPubkey).to.equal(
      '00141ed5c420123d753fc86466f88ed34c5b93923dab'
    )
  })
})

describe('groestlcoin transaction creation and signing test', () => {
  // key with control on the unspent output and used to sign the transaction
  const wifKey = 'KyeNA49yfj4JDoMEWtpQiosP6eig55att3cTv6NBXCeFNsHoNnyM'
  const privateKey = wifToPrivateKey({
    wifKey,
    network: NetworkEnum.Mainnet,
    coin: 'groestlcoin',
  })
  const segwitScriptPubkey: string = pubkeyToScriptPubkey({
    pubkey: privateKeyToPubkey(privateKey),
    scriptType: ScriptTypeEnum.p2wpkh,
  }).scriptPubkey

  it('Create transaction with one input and one output', async () => {
    /*
      This here is the rawtransaction as assembled below:
      0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc5660209e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec631e5e1e66009ce3710ceea5b1ad13ffffffff01905f0100000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000
      The test case deconstructs the value, script pubkey and locktime values to show some deserialized values.
      This deserialization is not required in the usual form from the caller.
      It is enough to pass the full previous rawtransaction.
    */
    const base64Tx: string = createTx({
      network: NetworkEnum.Mainnet,
      rbf: false,
      inputs: [
        {
          type: TransactionInputTypeEnum.Segwit,
          prevTxid:
            '7d067b4a697a09d2c3cff7d4d9506c9955e93bff41bf82d439da7d030382bc3e',
          // prev_tx only for non segwit inputs
          prevScriptPubkey: segwitScriptPubkey,
          value: 80000,
          index: 0,
        },
      ],
      outputs: [
        {
          scriptPubkey: addressToScriptPubkey({
            address: 'Fpzstx4fKWhqZYbVVmuncuhbEmgecqPTgg',
            network: NetworkEnum.Mainnet,
            addressType: AddressTypeEnum.p2pkh,
            coin: 'groestlcoin',
          }),
          amount: 80000,
        },
      ],
    }).psbt
    const hexTxSigned: string = await signTx({
      psbt: base64Tx,
      privateKeys: [privateKey],
      coin: 'groestlcoin',
    })
    expect(hexTxSigned).to.equal(
      '020000000001013ebc8203037dda39d482bf41ff3be955996c50d9d4f7cfc3d2097a694a7b067d0000000000ffffffff0180380100000000001976a914d9863e608009f46ce023c852c7c209a607f8542b88ac024730440220558f35be4edc22260bf98fe197e39aff6bfc3717be853735be837a30bd2a0f4202207b2429dd031e851b82836e24524689c70a8c8bf4be58f9b4be23bf3e76fa577a0121030f25e157a5ddc119bf370beb688878a3600461eb5c769a5556bdfe225d9a246e00000000'
    )
  })
})
