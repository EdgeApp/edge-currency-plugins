import {
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  ScriptTypeEnum
} from '../../../../../src/common/utxobased/keymanager/keymanager'

interface SeedToXPrivTests {
  xpriv: string
  type: BIP43PurposeTypeEnum
}

interface XPrivToXPubTests {
  xpriv: string
  xpub: string
  type: BIP43PurposeTypeEnum
}

interface WifToPrivateKeyTests {
  wifKey: string
}

interface XPrivToWifTests {
  xpriv: string
  wifKey: string
  type: BIP43PurposeTypeEnum
}

interface AddressToScriptPubkeyTests {
  extraMessage?: string
  address: string
  scriptPubkey: string
}

interface XPubToPubkeyTests {
  xpub: string
  type: BIP43PurposeTypeEnum
  bip44ChangeIndex: 0 | 1
  bip44AddressIndex: number
  scriptType: ScriptTypeEnum
  addressType: AddressTypeEnum
  address: string
  legacyAddress?: string
}

interface SignMessageTests {
  wif: string
  message: string
  signature: string
}

interface Coin {
  name: string
  mnemonic: string
  seedToXPrivTests: SeedToXPrivTests[]
  xprivToXPubTests: XPrivToXPubTests[]
  wifToPrivateKeyTests?: WifToPrivateKeyTests[]
  xprivToWifTests?: XPrivToWifTests[]
  xpubToPubkeyTests: XPubToPubkeyTests[]
  addressToScriptPubkeyTests: AddressToScriptPubkeyTests[]
  signMessageTests?: SignMessageTests[]
}

interface Fixture {
  coins: Coin[]
}

export const fixtures: Fixture = {
  coins: [
    {
      name: 'smartcash',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9yWirNER4qGZHR9cLGqJi8Z23wy2M9JmbCA7zkCunzneLv84Gxj4DmZkdjjkqotSverQ7pWsHnkPdFH2RqfkmSizzR6rZFHQ9cHSqjCKs3b',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9yWirNER4qGZHR9cLGqJi8Z23wy2M9JmbCA7zkCunzneLv84Gxj4DmZkdjjkqotSverQ7pWsHnkPdFH2RqfkmSizzR6rZFHQ9cHSqjCKs3b',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6CW5FsmJuCprVuE5SJNK5GVkbyoWkc2cxR5io8cXMLKdDiTCpW3JmZtEUzKML8iYKp5Fs7iGSLnW4EjGZFaRtmVo9RPW36CY2w4imVdUNjK'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6CW5FsmJuCprVuE5SJNK5GVkbyoWkc2cxR5io8cXMLKdDiTCpW3JmZtEUzKML8iYKp5Fs7iGSLnW4EjGZFaRtmVo9RPW36CY2w4imVdUNjK',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'SkYmjrcQQgc9XWFAfBRG61YEYRWUqGEZnG'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'VLqHRdvdNPgspEjPM6ee5CcLKc4CFBvafN183pevjxXKX1uZGe1m'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
          scriptPubkey: '76a914a763fb8d08fdd6b5f6e3e3bf41ab33901b86e72088ac'
        }
      ]
    },
    {
      name: 'ravencoin',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9zG1qmEumfwLUb2rTjKTxJEfLRxBqMGYyYm4S6wXpJyjyqrnqWN2aYf4EEt6iv27QMeHWyzressEVbmgrRFoqJQX47F3ncu2ghzeRYPhTJc',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9zG1qmEumfwLUb2rTjKTxJEfLRxBqMGYyYm4S6wXpJyjyqrnqWN2aYf4EEt6iv27QMeHWyzressEVbmgrRFoqJQX47F3ncu2ghzeRYPhTJc',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6DFNFGmoc3Vdh57KZkrUKSBPtTngEozQLmgfEVM9NeWireBwP3gH8LyY5VMsVB9zCGxzsph27TuppVSrbGP5sjqcJPrWLUwsEPrXPvCVgL1'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6DFNFGmoc3Vdh57KZkrUKSBPtTngEozQLmgfEVM9NeWireBwP3gH8LyY5VMsVB9zCGxzsph27TuppVSrbGP5sjqcJPrWLUwsEPrXPvCVgL1',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'RDjNvZL1TJQ7R8L23jDutdEioQG4eTC38V'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'L37GeVaqwRDGoeHckfe8DmzsbDTBgmEuMBAZ7KDPDHN6RpUovWRP'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'RDjNvZL1TJQ7R8L23jDutdEioQG4eTC38V',
          scriptPubkey: '76a91430d45f1e2c0d24c8340bd0b634ce89c5b0e579b388ac'
        }
      ]
    },
    {
      name: 'qtum',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9yNMmQAw1VJVPvfhyQiCoDT5hpKGuddV8ciqvzDiZkpjURynLpPAsTyDArW8ZUySHdeWnTLy3mJE8RMxo6AaKywAEGVe9t84tcBFssGyVNo',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9yNMmQAw1VJVPvfhyQiCoDT5hpKGuddV8ciqvzDiZkpjURynLpPAsTyDArW8ZUySHdeWnTLy3mJE8RMxo6AaKywAEGVe9t84tcBFssGyVNo',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6CMiAuhpqrrncQkB5SFDAMPpFr9mK6MLVqeSjNdL86MiMEJvtMhRRGHh27KNR7zLG8BPcjSEHQ2g6MYcKVssJGVZekhuYQQJc9kGC9ofwJX'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6CMiAuhpqrrncQkB5SFDAMPpFr9mK6MLVqeSjNdL86MiMEJvtMhRRGHh27KNR7zLG8BPcjSEHQ2g6MYcKVssJGVZekhuYQQJc9kGC9ofwJX',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'QXykR884CoPkbYHCFZ68bNVTMRvicWAFq2'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'KxU83MzcLXP1WJtoFJXMDMcN3z5ykAa9xLdFTDY5XpV4e6Zit9BA'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'QXykR884CoPkbYHCFZ68bNVTMRvicWAFq2',
          scriptPubkey: '76a9147cc71ace3e2abcc05b3214d284cf7abba684758c88ac'
        }
      ]
    },
    {
      name: 'zcoin',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9yDcvGwNLgwS8rV5AYuupanjnfAoDZksQkDdXagMv5MAfrdSaKhoxqhic4NupSGNXtg1eqoAH7UezJMFoBfNNZHL2wVHjX1hEfU1xhceu8b',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9yDcvGwNLgwS8rV5AYuupanjnfAoDZksQkDdXagMv5MAfrdSaKhoxqhic4NupSGNXtg1eqoAH7UezJMFoBfNNZHL2wVHjX1hEfU1xhceu8b',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6CCyKnUGB4VjMLZYGaSvBijULh1Hd2Uimy9EKy5yUQt9Yexb7s24We2CTM54hWaQZYhCzSR6yEFAs5cQ8TwbaSn53S6HRrmaFkdgqczb85v'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6CCyKnUGB4VjMLZYGaSvBijULh1Hd2Uimy9EKy5yUQt9Yexb7s24We2CTM54hWaQZYhCzSR6yEFAs5cQ8TwbaSn53S6HRrmaFkdgqczb85v',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'a1bW3sVVUsLqgKuTMXtSaAHGvpxKwugxPH'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'Y6U2XvHuURXs7sDsokirN2CwZedNeGdkSA3dNBMPKqFpBttBeH8s'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'a1bW3sVVUsLqgKuTMXtSaAHGvpxKwugxPH',
          scriptPubkey: '76a91409a72463ad9977d0b81baacbf25054de672d69f088ac'
        }
      ]
    },
    {
      name: 'dogecoin',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'dgpv57bftCH9z6cEAdAY9SCDV9NfVsygaQWdi5LuCXdumz5qUPWnw1S3YBM7PdHXMvA8oSGS6Pbes1xEHMd5Zi2qHVK45y5FKKXzBXsZcTtYmX5',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'dgpv57bftCH9z6cEAdAY9SCDV9NfVsygaQWdi5LuCXdumz5qUPWnw1S3YBM7PdHXMvA8oSGS6Pbes1xEHMd5Zi2qHVK45y5FKKXzBXsZcTtYmX5',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'dgub8rUhDtD3YFGZTUphBfpBbzvFxSMKQXYLzg87Me2ta78r2SdVLmypBUkkxrrn9RTnchsyiJSkHZyLWxD13ibBiXtuFWktBoDaGaZjQUBLNLs'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'dgub8rUhDtD3YFGZTUphBfpBbzvFxSMKQXYLzg87Me2ta78r2SdVLmypBUkkxrrn9RTnchsyiJSkHZyLWxD13ibBiXtuFWktBoDaGaZjQUBLNLs',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'QPkeC1ZfHx3c9g7WTj9cQ8gnvk2iSAfAcbq1aVAWjNTwDAKfZUzx'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC',
          scriptPubkey: '76a9144a483568665dcdfa68dd58a1f62893448a64333988ac'
        }
      ]
    },
    {
      name: 'eboost',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9zYTou2k1nf6MGqBjTJPr2sE3uZxtNs189FwEEsmm35n5jNVsv3pwVyUPpxWfeDwbhz1ByQW6eh6EFnPp34oEnDC1VZ22xapWJu3Ham3JYK',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'eMvfrRkQqgc9igciD3j9tCrrmw2KzJ2yu4'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'ZcSgeybBZAQ7y7eFUEfPk6ZDA2843QMAJBvEfFMvyQfi8HsHfgEq'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'eMvfrRkQqgc9igciD3j9tCrrmw2KzJ2yu4',
          scriptPubkey: '76a914d986ed01b7a22225a70edbf2ba7cfb63a15cb3aa88ac'
        }
      ]
    },
    {
      name: 'dash',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'drkvjRAxdpDmxjUnQKX26VwVQ2mbVjXn67Tr4LZoyobdJyQpPW4ssDTnrcf1zHJui9XqpNuPYxZkHYymoZEowFHHCP6VZncvx9q9UNuerwSVDzr',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'drkvjRAxdpDmxjUnQKX26VwVQ2mbVjXn67Tr4LZoyobdJyQpPW4ssDTnrcf1zHJui9XqpNuPYxZkHYymoZEowFHHCP6VZncvx9q9UNuerwSVDzr',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'drkpRzJp5yxNJdtLq7YmV6Bfg7NtjycEopwQtnqre1mPRoie9DPWBfCu23U5gVteaKYiMF3gaFd88RnZUfowGYoBoR4sWk4RApm4jrbSAGgQUdq'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'drkpRzJp5yxNJdtLq7YmV6Bfg7NtjycEopwQtnqre1mPRoie9DPWBfCu23U5gVteaKYiMF3gaFd88RnZUfowGYoBoR4sWk4RApm4jrbSAGgQUdq',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'XGihgbi7c1nVqrjkPSvzJydLVWYW7hTrcXdfSdpFMwi3Xhbabw93'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5',
          scriptPubkey: '76a9148a4f58c222cd5544c527bc66925652baa70b5e8088ac'
        }
      ]
    },
    {
      name: 'vertcoin',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9ymzu53azAnFBpJxehxAZi18cA112AVvbeBwMMjfHBieJwrqZjaV3EBE7k5yJPf7RfYBEJzwGKvZP1Gps312YU6BJvdobsd1CmD1xobGkrR',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9ymzu53azAnFBpJxehxAZi18cA112AVvbeBwMMjfHBieJwrqZjaV3EBE7k5yJPf7RfYBEJzwGKvZP1Gps312YU6BJvdobsd1CmD1xobGkrR',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6CmMJaaUpYLYQJPRkjVAvqwsABqVRdDmxs7Y9k9GqXFdBkBz7Gtjb2VhxzCeYKuXkEzZ23MNRFj9tqjYS5UgvewWpxYmhWuwDiLR84spHS8'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6CmMJaaUpYLYQJPRkjVAvqwsABqVRdDmxs7Y9k9GqXFdBkBz7Gtjb2VhxzCeYKuXkEzZ23MNRFj9tqjYS5UgvewWpxYmhWuwDiLR84spHS8',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'Vce16eJifb7HpuoTFEBJyKNLsBJPo7fM83'
        },
        {
          xpub:
            'xpub6D1pK4ozztYgDWaNcvgYjXTQoWNfzSgQY9poZkJWhhbCKYVjQdUmhkRYF6NkLPNzTohQ3KEMm1ZqzZAHTPPQYuDYzVmkXtTLzLYPDhjoUrm',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkhp2sh,
          addressType: AddressTypeEnum.p2sh,
          address: '3GKaSv31kZoxGwMs2Kp25ngoHRHi5pz2SP'
        },
        {
          xpub:
            'xpub6Cq877KwJnLWBSAoVoFLwoe7BbPhxxkpBkvEugZRzmWRsGqPJDJU3t8jWFuNWMR5uYLQuYPgypSR2F9HWjVaroCNtRqH43Chwjeox4je1yB',
          type: BIP43PurposeTypeEnum.Segwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkh,
          addressType: AddressTypeEnum.p2wpkh,
          address: 'vtc1qfe8v6c4r39fq8xnjgcpunt5spdfcxw63zzfwru'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'KxQ19nBiiNeR743RdgwWxsYogKCWgjNKp9jT2ug8wvhJdXCP8HNh'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'Vce16eJifb7HpuoTFEBJyKNLsBJPo7fM83',
          scriptPubkey: '76a9141cf825a7d790c30f6eef81f397a66c156540036e88ac'
        },
        {
          address: '3GKaSv31kZoxGwMs2Kp25ngoHRHi5pz2SP',
          scriptPubkey: 'a914a07be28d5d535951b4882821e519391bf9a39f4987'
        },
        {
          address: 'vtc1qfe8v6c4r39fq8xnjgcpunt5spdfcxw63zzfwru',
          scriptPubkey: '00144e4ecd62a38952039a724603c9ae900b53833b51'
        }
      ]
    },
    {
      name: 'uniformfiscalobject',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9ytsf7bk77SoYKsJAvqg3sB9gLDp54YHT8bditZW7L5Y6o914va5v6XwZcf6DAuJ4nAbJAxrtwZo8b1jA9ozd73zBz2pTT1ic533idtEwtJ',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9ytsf7bk77SoYKsJAvqg3sB9gLDp54YHT8bditZW7L5Y6o914va5v6XwZcf6DAuJ4nAbJAxrtwZo8b1jA9ozd73zBz2pTT1ic533idtEwtJ',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6CtE4d8dwV16kowmGxNgR17tEN4JUXG8pMXEXGy7ffcWybU9cTtLTtrRQsDwHkMADcjoXSNeoebv5XAGJg6n7Zh9vz5TWWvUJzKTSdeUFHn'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6CtE4d8dwV16kowmGxNgR17tEN4JUXG8pMXEXGy7ffcWybU9cTtLTtrRQsDwHkMADcjoXSNeoebv5XAGJg6n7Zh9vz5TWWvUJzKTSdeUFHn',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'C3mUHE7dpemNsGoa4rahQoEworx5DkbnFA'
        },
        {
          xpub:
            'ypub6Wu2Ax4NRoLJW1UCNBRMatwYW5Vr7vqgE4SK6FdKssNEUA2NCor8c5oSdMTUgHT3V9yj1LzMLTJpXwCh7hVenJdfhLB9M6qxmi6bcoFSdVd',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkhp2sh,
          addressType: AddressTypeEnum.p2sh,
          address: 'USM3tijpLBdWpKrvHjPsdzSSpK55k9V79A',
          legacyAddress: '3643rsxfbpSKJ25TkJQo66HtAXqf2hGP3i'
        },
        {
          xpub:
            'zpub6sBMnpX8349mvyqk3Y4U1mTJAeCpY4qGNgMeJejYe1sjPYyVVs6qBDrycdTNd7kHXCZBUxuTB9kojxvHKVU6kS9hsoUeekK1QRBU9nDYtx2',
          type: BIP43PurposeTypeEnum.Segwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkh,
          addressType: AddressTypeEnum.p2wpkh,
          address: 'uf1qkwnu2phwvard2spr2n0a9d84x590ahywqd6hp9'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'Q2paQ28ajBabp1xuCqmjP7HdeuGSK2vVNaEvrVgLiqP9qYHYFrtL'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'C3mUHE7dpemNsGoa4rahQoEworx5DkbnFA',
          scriptPubkey: '76a91474b99370640b77b9ad609c90017fea39dbda907888ac'
        },
        {
          address: 'uf1qkwnu2phwvard2spr2n0a9d84x590ahywqd6hp9',
          scriptPubkey: '0014b3a7c506ee6746d5402354dfd2b4f5350afedc8e'
        }
      ]
    },
    {
      name: 'feathercoin',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xqMPAtc6rF1XptQ6QavaQ5fNyJkDgrZ3BLW4qwzMiDKmnRV4jWoDQHFdCzFMCJfXvxNtVcMW3rdD2FGVd54ygV72BVHNDMkr3k1HE3dE6NdQwc8',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xqMPAtc6rF1XptQ6QavaQ5fNyJkDgrZ3BLW4qwzMiDKmnRV4jWoDQHFdCzFMCJfXvxNtVcMW3rdD2FGVd54ygV72BVHNDMkr3k1HE3dE6NdQwc8',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xq1vow2yefS81cbgEiWByGtkSSpvaKbitriBYioqhEvBRmRnoHaozKGHmnJCkisCuwv1NebnzGWLsuPwjZZABdb8f42MtkJqekEzqo7q7hUCpvB'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xq1vow2yefS81cbgEiWByGtkSSpvaKbitriBYioqhEvBRmRnoHaozKGHmnJCkisCuwv1NebnzGWLsuPwjZZABdb8f42MtkJqekEzqo7q7hUCpvB',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: '6foXhTEUMC85RAhkPS2MfoxD6oS69x4rBS'
        },
        {
          xpub:
            'ypub6Wu2Ax4NRoLJW1UCNBRMatwYW5Vr7vqgE4SK6FdKssNEUA2NCor8c5oSdMTUgHT3V9yj1LzMLTJpXwCh7hVenJdfhLB9M6qxmi6bcoFSdVd',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkhp2sh,
          addressType: AddressTypeEnum.p2sh,
          address: '3643rsxfbpSKJ25TkJQo66HtAXqf2hGP3i'
        },
        {
          xpub:
            'zpub6sBMnpX8349mvyqk3Y4U1mTJAeCpY4qGNgMeJejYe1sjPYyVVs6qBDrycdTNd7kHXCZBUxuTB9kojxvHKVU6kS9hsoUeekK1QRBU9nDYtx2',
          type: BIP43PurposeTypeEnum.Segwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkh,
          addressType: AddressTypeEnum.p2wpkh,
          address: 'fc1qkwnu2phwvard2spr2n0a9d84x590ahywnuszd4'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'N7sWmZgvC2X451cLTriK8PD8tnUGhRMJkNNaarmLpJP9aJBLBgA4'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: '6foXhTEUMC85RAhkPS2MfoxD6oS69x4rBS',
          scriptPubkey: '76a91416b60429ed63dedf0d83d004bc4464130ee4cefb88ac'
        },
        {
          address: '3643rsxfbpSKJ25TkJQo66HtAXqf2hGP3i',
          scriptPubkey: 'a9142fdadae8827ecedb668946c073ebbb0482820c6387'
        },
        {
          address: 'fc1qkwnu2phwvard2spr2n0a9d84x590ahywnuszd4',
          scriptPubkey: '0014b3a7c506ee6746d5402354dfd2b4f5350afedc8e'
        }
      ]
    },
    {
      name: 'digibyte',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9xnwuEJDHfgLkhZwH8cNnSrQfRbZG287x39mVqDEePQy5SRWKjV2pLjri8x93UfBSQdsGPeJFi8qXKexJUNj5eU3gEKfHUzo6EmuK6CSgEq',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9xnwuEJDHfgLkhZwH8cNnSrQfRbZG287x39mVqDEePQy5SRWKjV2pLjri8x93UfBSQdsGPeJFi8qXKexJUNj5eU3gEKfHUzo6EmuK6CSgEq',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6BnJJjq783EdyBeQPA9P9ao9DTS3fUqyKG5NJDcrCiwwxEkesGoHN94LZRGE7rz1jgcvmmp8j55BNx573KFq1WBwKiemzkdfNKffKx6Mvku'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6Cj2cdNXaWhn9mwjaxofCJujxrALww7kw6WcyCsGnU9twBEsGcaMqR6gCtQ9b3k6awqL2egNaat2btUCVoETYzcmngU9outdn6RA2KxmNEn',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'DG1KhhBKpsyWXTakHNezaDQ34focsXjN1i'
        },
        {
          xpub:
            'ypub6YAzMR6Pck8es9hsWTDoHUw95DS2ajZtmf6k9epK6aUoteJe5LWEtsW6ys97MqeK18CJe2MDYXWaitVDwogT46t6F7uGrHHk9VHzvxoX5in',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkhp2sh,
          addressType: AddressTypeEnum.p2sh,
          address: 'SQ9EXABrHztGgefL9aH3FyeRjowdjtLfn4',
          legacyAddress: '34YFQru97Y1TFWaJjExZ8hroEYzvXK2JGw'
        },
        {
          xpub:
            'zpub6qSFywPULarUNuzKdbWVZwFpYnb2igv9AqLCufRkXwWfexmdhkAgAsosnc3UiYaBNWBHm3DpuCfmwEG9g27X5t6vKGuLq7jvtsmLoCBMw3j',
          type: BIP43PurposeTypeEnum.Segwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkh,
          addressType: AddressTypeEnum.p2wpkh,
          address: 'dgb1q9gmf0pv8jdymcly6lz6fl7lf6mhslsd72e2jq8'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'L1CAcXSxB48WoRs91gjSaj8eerBj3ruTyun7MvqBpnrc62cXAJqq'
        },
        {
          wifKey: 'KzAwX4sqvmrvuUtSEwBq93CcTHLFqXKK5mYf1JwYzgnATrYLeGEz'
        },
        {
          wifKey: 'L5Xn1K6XobLbBFhLgxj6yEzMecZmmUDHwY9izkPx4kfYTSWcHcGd'
        },
        {
          wifKey: '5JQsweUVF7V243N2qmoJtDjGqhXqPcwViWG961P1hsrAoMsNAnQ'
        },
        {
          wifKey: '5J367GdKAsPTKunGfiv5ZWZRxq9N2a8BHoXhsuT5FZLadsF7Tif'
        },
        {
          wifKey: 'QRZrfugqBPM491HUqD2d2G3DvKMpt5T7y2EZnwLPj3PWunVUAzBS'
        },
        {
          wifKey: 'QUNJ3111WoYX4VASJHo5B9LrjwZUV1H368KZUuX6dtGrH6hoCD3z'
        },
        {
          wifKey: 'QWvhA9uX4CpiQn6PHEZtrTpy7ebLp2M6pnqdnNnno7GtuNTnRzgP'
        },
        {
          wifKey: '6JjDEbwSosmp6eoC3ARHVqiWK81NtkDmKgPNQW1uXY3oc32GfX7'
        },
        {
          wifKey: '6JMRQE6GjdgFNXDRs7Y4B8YfSFcuXhQStyewCQ5y5DYDSWuVdTB'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'DG1KhhBKpsyWXTakHNezaDQ34focsXjN1i',
          scriptPubkey: '76a91477310b27af676f9663881f649860a327d28777be88ac'
        },
        {
          address: 'SQ9EXABrHztGgefL9aH3FyeRjowdjtLfn4',
          scriptPubkey: 'a9141f3fe4a26b7d41be615d020c177c20882a2d95d287'
        },
        {
          address: 'dgb1q9gmf0pv8jdymcly6lz6fl7lf6mhslsd72e2jq8',
          scriptPubkey: '00142a369785879349bc7c9af8b49ffbe9d6ef0fc1be'
        }
      ]
    },
    {
      name: 'litecoin',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'zprvAdQSgFiAHcXKb1gcktyukXyGZykTBemmPZ9brfYnxqxM2CocMdxy9aPXTbTLv7dvJgWn2Efi4vFSyPbT4QqgarYrs583WCeMXM2q3TUU8FS',
          type: BIP43PurposeTypeEnum.Segwit
        },
        {
          xpriv:
            'Mtpv7RooeEQDUitupgpJcxZnfDwvq8hC24R7GAiscrqFhHHhit96vCNY7yudJgrM841dMbiRUQceC12566XAHHC8Rd1BtnBdokq9tmF7jLLvUdh',
          type: BIP43PurposeTypeEnum.WrappedSegwit
        },
        {
          xpriv:
            'xprv9xnwuEJDHfgLkhZwH8cNnSrQfRbZG287x39mVqDEePQy5SRWKjV2pLjri8x93UfBSQdsGPeJFi8qXKexJUNj5eU3gEKfHUzo6EmuK6CSgEq',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'zprvAdQSgFiAHcXKb1gcktyukXyGZykTBemmPZ9brfYnxqxM2CocMdxy9aPXTbTLv7dvJgWn2Efi4vFSyPbT4QqgarYrs583WCeMXM2q3TUU8FS',
          type: BIP43PurposeTypeEnum.Segwit,
          xpub:
            'zpub6rPo5mF47z5coVm5rvWv7fv181awb7Vckn5Cf3xQXBVKu18kuBHDhNi1Jrb4br6vVD3ZbrnXemEsWJoR18mZwkUdzwD8TQnHDUCGxqZ6swA'
        },
        {
          xpriv:
            'Mtpv7RooeEQDUitupgpJcxZnfDwvq8hC24R7GAiscrqFhHHhit96vCNY7yudJgrM841dMbiRUQceC12566XAHHC8Rd1BtnBdokq9tmF7jLLvUdh',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          xpub:
            'Mtub2rz9F1pkisRsSZX8sa4Ajon9GhPP6JymLgpuHqbYdU5JKFLBF7Qy8b1tZ3dccj2fefrAxfrPdVkpCxuWn3g72UctH2bvJRkp6iFmp8aLeRZ'
        },
        {
          xpriv:
            'xprv9xnwuEJDHfgLkhZwH8cNnSrQfRbZG287x39mVqDEePQy5SRWKjV2pLjri8x93UfBSQdsGPeJFi8qXKexJUNj5eU3gEKfHUzo6EmuK6CSgEq',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6BnJJjq783EdyBeQPA9P9ao9DTS3fUqyKG5NJDcrCiwwxEkesGoHN94LZRGE7rz1jgcvmmp8j55BNx573KFq1WBwKiemzkdfNKffKx6Mvku'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6BnJJjq783EdyBeQPA9P9ao9DTS3fUqyKG5NJDcrCiwwxEkesGoHN94LZRGE7rz1jgcvmmp8j55BNx573KFq1WBwKiemzkdfNKffKx6Mvku',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'LUWPbpM43E2p7ZSh8cyTBEkvpHmr3cB8Ez'
        },
        {
          xpub:
            'Mtub2rz9F1pkisRsSZX8sa4Ajon9GhPP6JymLgpuHqbYdU5JKFLBF7Qy8b1tZ3dccj2fefrAxfrPdVkpCxuWn3g72UctH2bvJRkp6iFmp8aLeRZ',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkhp2sh,
          addressType: AddressTypeEnum.p2sh,
          address: 'M7wtsL7wSHDBJVMWWhtQfTMSYYkyooAAXM',
          legacyAddress: '31jkZShyVAMkVz5cQpu4qp73DrAXtFP3rZ'
        },
        {
          xpub:
            'zpub6rPo5mF47z5coVm5rvWv7fv181awb7Vckn5Cf3xQXBVKu18kuBHDhNi1Jrb4br6vVD3ZbrnXemEsWJoR18mZwkUdzwD8TQnHDUCGxqZ6swA',
          type: BIP43PurposeTypeEnum.Segwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkh,
          addressType: AddressTypeEnum.p2wpkh,
          address: 'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'T5b4RiWRs7XG8xZ2bCHBoJcn4JrpMTbGRFYXgoZHd7nD8izwqhMK'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'LUWPbpM43E2p7ZSh8cyTBEkvpHmr3cB8Ez',
          scriptPubkey: '76a91465d4f0444069f3881221e24bb6a99b1d53e008cf88ac'
        },
        {
          address: 'M7wtsL7wSHDBJVMWWhtQfTMSYYkyooAAXM',
          scriptPubkey: 'a91400846c3f4a7bb38e9b422b4129bf8b191287289e87'
        },
        {
          address: 'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh',
          scriptPubkey: '001496cd3178f3de0f307bcee1aeaa4d5987862dd30a'
        }
      ]
    },
    {
      name: 'groestlcoin',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9zG5s8VhyRCaktqFMWHHkaxX1XdgDsD2GjX31daogFTCcer54yTtWroAXRAHZV6GuuiTSUfNheduV4i8rJEJ45QGcCrfKyCwmbD4zaLp9Y7',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9zG5s8VhyRCaktqFMWHHkaxX1XdgDsD2GjX31daogFTCcer54yTtWroAXRAHZV6GuuiTSUfNheduV4i8rJEJ45QGcCrfKyCwmbD4zaLp9Y7',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6DFSGe2bonksyNuiTXpJ7iuFZZUAdKvsdxSdp1zREazBVTBDcWn94f7eNg5MN148WHsaUfG3Mmmqa6nBi1VCde1t7wM3NA3993CcjChk1g5'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6DFSGe2bonksyNuiTXpJ7iuFZZUAdKvsdxSdp1zREazBVTBDcWn94f7eNg5MN148WHsaUfG3Mmmqa6nBi1VCde1t7wM3NA3993CcjChk1g5',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'Fpzstx4fKWhqZYbVVmuncuhbEmgecqPTgg'
        },
        {
          xpub:
            'ypub6X46SconPpL9QhXPnMGuPLB9jYai7nrHz7ki4zq3awHb462iPSG5eV19oBWv22RWt69npsi75XGcANsevtTWE8YFgqpygrGUPnEKp6vty5v',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkhp2sh,
          addressType: AddressTypeEnum.p2sh,
          address: '3299Qf2x9BnzLaZu4HCLvm26RbBB3ZRf4u'
        },
        {
          xpub:
            'zpub6qdhcNVVLJ2t8kLzGLzeaiJv7EahaRBsXmu1yVPyXHvMdFmS4d7JSi5aS6mc1oz5k6DZN781Ffn3GAs3r2FJnCPSw5nti63s3c9EDg2u7MS',
          type: BIP43PurposeTypeEnum.Segwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkh,
          addressType: AddressTypeEnum.p2wpkh,
          address: 'grs1qrm2uggqj846nljryvmuga56vtwfey0dtnc4z55'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'L2JewQFXAVSw4zrihJY91G6ZUTL1F8YhcCqXgJTJd1AyCTABCzMD'
        },
        {
          wifKey: 'KyeNA49yfj4JDoMEWtpQiosP6eig55att3cTv6NBXCeFNsHoNnyM'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'Fpzstx4fKWhqZYbVVmuncuhbEmgecqPTgg',
          scriptPubkey: '76a914d9863e608009f46ce023c852c7c209a607f8542b88ac'
        },
        {
          address: '3299Qf2x9BnzLaZu4HCLvm26RbBB3ZRf4u',
          scriptPubkey: 'a91404f1101bb0f5ca39c735bf1aa9bc99be571a9f5d87'
        },
        {
          address: 'grs1qrm2uggqj846nljryvmuga56vtwfey0dtnc4z55',
          scriptPubkey: '00141ed5c420123d753fc86466f88ed34c5b93923dab'
        }
      ],
      xprivToWifTests: [
        {
          xpriv:
            'xprv9zG5s8VhyRCaktqFMWHHkaxX1XdgDsD2GjX31daogFTCcer54yTtWroAXRAHZV6GuuiTSUfNheduV4i8rJEJ45QGcCrfKyCwmbD4zaLp9Y7',
          wifKey: 'KyeNA49yfj4JDoMEWtpQiosP6eig55att3cTv6NBXCeFNsHoNnyM',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ]
    },
    {
      name: 'bitcoinsv',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9ydzpAw8scxgS53bvJyqSwDvfxDQZZtaJV98SYjZto3Pg7MCsPBjCcYqUtnWPRNayEXUcSYZDvXux545bHZwda7YUWvReJiRkx38VXathgK',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9ydzpAw8scxgS53bvJyqSwDvfxDQZZtaJV98SYjZto3Pg7MCsPBjCcYqUtnWPRNayEXUcSYZDvXux545bHZwda7YUWvReJiRkx38VXathgK',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6CdMDgU2hzWyeZ852LWqp5AfDz3ty2cRfi4jEw9BT8aNYugMQvVykQsKLARZdbqKKp7yTviJdL1N9saYLmJNKD1rwVAwLTmU8r8qKeoyG4R'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6CdMDgU2hzWyeZ852LWqp5AfDz3ty2cRfi4jEw9BT8aNYugMQvVykQsKLARZdbqKKp7yTviJdL1N9saYLmJNKD1rwVAwLTmU8r8qKeoyG4R',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: '1K6LZdwpKT5XkEZo2T2kW197aMXYbYMc4f',
          legacyAddress: '1K6LZdwpKT5XkEZo2T2kW197aMXYbYMc4f'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'KxU83MzcLXP1WJtoFJXMDMcN3z5ykAa9xLdFTDY5XpV4e6Zit9BA'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: '1K6LZdwpKT5XkEZo2T2kW197aMXYbYMc4f',
          scriptPubkey: '76a914c674ac8e0534044717c9ee450d5d9f25e243645088ac'
        }
      ]
    },
    {
      name: 'bitcoingold',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9xwq8XoNMYibm1tgqx9MknBEhV2piDRtYrVLdbRFHaQiYc8Y3yxhWVBui2Pcw6GK1GjhMMsY9qnJAAFEW5QhvvQP8wCyBRMnnGCSADhBBY5',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9xwq8XoNMYibm1tgqx9MknBEhV2piDRtYrVLdbRFHaQiYc8Y3yxhWVBui2Pcw6GK1GjhMMsY9qnJAAFEW5QhvvQP8wCyBRMnnGCSADhBBY5',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6BwBY3LGBvGtyVy9wygN7v7yFWsK7g9jv5QwRyprquwhRQTgbXGx4HWPZHRnF5ueji94Dztce4k3RJnt2ir3xWBS7y6bDk8ryS8vKXyoYPL'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6BwBY3LGBvGtyVy9wygN7v7yFWsK7g9jv5QwRyprquwhRQTgbXGx4HWPZHRnF5ueji94Dztce4k3RJnt2ir3xWBS7y6bDk8ryS8vKXyoYPL',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'GeTZ7bjfXtGsyEcerSSFJNUSZwLfjtCJX9'
        },
        {
          xpub:
            'ypub6Wu2Ax4NRoLJW1UCNBRMatwYW5Vr7vqgE4SK6FdKssNEUA2NCor8c5oSdMTUgHT3V9yj1LzMLTJpXwCh7hVenJdfhLB9M6qxmi6bcoFSdVd',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkhp2sh,
          addressType: AddressTypeEnum.p2sh,
          address: 'AL8uaqKrP4n61pb2BrQXpMC3VcUdjmpAwn'
        },
        {
          xpub:
            'zpub6sBMnpX8349mvyqk3Y4U1mTJAeCpY4qGNgMeJejYe1sjPYyVVs6qBDrycdTNd7kHXCZBUxuTB9kojxvHKVU6kS9hsoUeekK1QRBU9nDYtx2',
          type: BIP43PurposeTypeEnum.Segwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkh,
          addressType: AddressTypeEnum.p2wpkh,
          address: 'btg1qkwnu2phwvard2spr2n0a9d84x590ahywl3yacu'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'L4gU3tKvsS3XQ5eJXDARFEnMyoCvE8vsoYBngMAJESexY5yHsdkJ'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'GeTZ7bjfXtGsyEcerSSFJNUSZwLfjtCJX9',
          scriptPubkey: '76a914e21fb547704ff606ba769b9d6d7985f4cca760f788ac'
        },
        {
          address: 'AL8uaqKrP4n61pb2BrQXpMC3VcUdjmpAwn',
          scriptPubkey: 'a9142fdadae8827ecedb668946c073ebbb0482820c6387'
        },
        {
          address: 'btg1qkwnu2phwvard2spr2n0a9d84x590ahywl3yacu',
          scriptPubkey: '0014b3a7c506ee6746d5402354dfd2b4f5350afedc8e'
        }
      ]
    },
    {
      name: 'bitcoingoldtestnet',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
        }
      ],
      xpubToPubkeyTests: [
        // TODO: Convert each formated extended key or address to the testnet format
        // {
        //   xpub:
        //     'xpub6BwBY3LGBvGtyVy9wygN7v7yFWsK7g9jv5QwRyprquwhRQTgbXGx4HWPZHRnF5ueji94Dztce4k3RJnt2ir3xWBS7y6bDk8ryS8vKXyoYPL',
        //   type: BIP43PurposeTypeEnum.Legacy,
        //   bip44ChangeIndex: 0,
        //   bip44AddressIndex: 0,
        //   scriptType: ScriptTypeEnum.p2pkh,
        //   addressType: AddressTypeEnum.p2pkh,
        //   address: 'GeTZ7bjfXtGsyEcerSSFJNUSZwLfjtCJX9',
        //   legacyAddress: '1McdhUQiZ2fatmKMvVn8sc8YemYpeDum1k'
        // },
        // {
        //   xpub:
        //     'ypub6Wu2Ax4NRoLJW1UCNBRMatwYW5Vr7vqgE4SK6FdKssNEUA2NCor8c5oSdMTUgHT3V9yj1LzMLTJpXwCh7hVenJdfhLB9M6qxmi6bcoFSdVd',
        //   type: BIP43PurposeTypeEnum.WrappedSegwit,
        //   bip44ChangeIndex: 0,
        //   bip44AddressIndex: 0,
        //   scriptType: ScriptTypeEnum.p2wpkhp2sh,
        //   addressType: AddressTypeEnum.p2sh,
        //   address: 'AL8uaqKrP4n61pb2BrQXpMC3VcUdjmpAwn',
        //   legacyAddress: '3643rsxfbpSKJ25TkJQo66HtAXqf2hGP3i'
        // },
        // {
        //   xpub:
        //     'zpub6sBMnpX8349mvyqk3Y4U1mTJAeCpY4qGNgMeJejYe1sjPYyVVs6qBDrycdTNd7kHXCZBUxuTB9kojxvHKVU6kS9hsoUeekK1QRBU9nDYtx2',
        //   type: BIP43PurposeTypeEnum.Segwit,
        //   bip44ChangeIndex: 0,
        //   bip44AddressIndex: 0,
        //   scriptType: ScriptTypeEnum.p2wpkh,
        //   addressType: AddressTypeEnum.p2wpkh,
        //   address: 'btg1qkwnu2phwvard2spr2n0a9d84x590ahywl3yacu',
        //   legacyAddress: 'bc1qkwnu2phwvard2spr2n0a9d84x590ahywfczcd5'
        // }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'cV3TWoKnJVjnZX7ZucyYcZHRc2WKtb2ZsaLFnmcojZJxnq3pPeBy'
        }
      ],
      addressToScriptPubkeyTests: [
        // TODO: Convert each formated extended key or address to the testnet format
        // {
        //   address: 'GeTZ7bjfXtGsyEcerSSFJNUSZwLfjtCJX9',
        //   scriptPubkey: '76a914e21fb547704ff606ba769b9d6d7985f4cca760f788ac'
        // },
        // {
        //   address: 'AL8uaqKrP4n61pb2BrQXpMC3VcUdjmpAwn',
        //   scriptPubkey: 'a9142fdadae8827ecedb668946c073ebbb0482820c6387'
        // },
        // {
        //   address: 'btg1qkwnu2phwvard2spr2n0a9d84x590ahywl3yacu',
        //   scriptPubkey: '0014b3a7c506ee6746d5402354dfd2b4f5350afedc8e'
        // }
      ]
    },
    {
      name: 'bitcoincash',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'xprv9xywTsqYa9uDLdJs8QpXf7xwRWgPw4rq5FtkcShsDoZTqfNQjVQ3dDCdyedXX3FqB18U8e8PfVMeFqkhzPGseKVMDjGe5rPdiUXMxy7BQNJ',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'xprv9xywTsqYa9uDLdJs8QpXf7xwRWgPw4rq5FtkcShsDoZTqfNQjVQ3dDCdyedXX3FqB18U8e8PfVMeFqkhzPGseKVMDjGe5rPdiUXMxy7BQNJ',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6ByHsPNSQXTWZ7PLESMY2FufyYWtLXagSUpMQq7Un96SiThZH2iJB1X7pwviH1WtKVeDP6K8d6xxFzzoaFzF3s8BKCZx8oEDdDkNnp4owAZ'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6ByHsPNSQXTWZ7PLESMY2FufyYWtLXagSUpMQq7Un96SiThZH2iJB1X7pwviH1WtKVeDP6K8d6xxFzzoaFzF3s8BKCZx8oEDdDkNnp4owAZ',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'qqyx49mu0kkn9ftfj6hje6g2wfer34yfnq5tahq3q6',
          legacyAddress: '1mW6fDEMjKrDHvLvoEsaeLxSCzZBf3Bfg'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'KxbEv3FeYig2afQp7QEA9R3gwqdTBFwAJJ6Ma7j1SkmZoxC9bAXZ'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'bitcoincash:qr9q6dsyfcxupz3zwf805mm2q7cwcnre4g60ww9wd5',
          scriptPubkey: '76a914ca0d36044e0dc08a22724efa6f6a07b0ec4c79aa88ac'
        },
        {
          extraMessage: 'without prefix',
          address: 'qr9q6dsyfcxupz3zwf805mm2q7cwcnre4g60ww9wd5',
          scriptPubkey: '76a914ca0d36044e0dc08a22724efa6f6a07b0ec4c79aa88ac'
        },
        {
          extraMessage: 'p2sh',
          address: 'bitcoincash:pz689gnx6z7cnsfhq6jpxtx0k9hhcwulev5cpumfk0',
          scriptPubkey: 'a914b472a266d0bd89c13706a4132ccfb16f7c3b9fcb87'
        },
        {
          extraMessage: 'p2sh without prefix',
          address: 'pz689gnx6z7cnsfhq6jpxtx0k9hhcwulev5cpumfk0',
          scriptPubkey: 'a914b472a266d0bd89c13706a4132ccfb16f7c3b9fcb87'
        }
      ]
    },
    {
      name: 'bitcoincashtestnet',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: 'qqaz6s295ncfs53m86qj0uw6sl8u2kuw0ymst35fx4',
          legacyAddress: 'mkpZhYtJu2r87Js3pDiWJDmPte2NRZ8bJV'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'cNxENxFVynNHk6t5Vp3HWjYka4vrqi2rNLEpgYBWwsRa4hEx8Uj8'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: 'bchtest:qrall9d5uddv4yvdyms4wwfw59jr5twzsvashd0fst',
          scriptPubkey: '76a914fbff95b4e35aca918d26e157392ea1643a2dc28388ac'
        },
        {
          extraMessage: 'without prefix',
          address: 'qrall9d5uddv4yvdyms4wwfw59jr5twzsvashd0fst',
          scriptPubkey: '76a914fbff95b4e35aca918d26e157392ea1643a2dc28388ac'
        },
        {
          extraMessage: 'p2sh',
          address: 'bchtest:pq2wfeuppegjpnrg64ws8vmv7e4fatwzwq9rvngx8x',
          scriptPubkey: 'a91414e4e7810e5120cc68d55d03b36cf66a9eadc27087'
        },
        {
          extraMessage: 'without prefix',
          address: 'pq2wfeuppegjpnrg64ws8vmv7e4fatwzwq9rvngx8x',
          scriptPubkey: 'a91414e4e7810e5120cc68d55d03b36cf66a9eadc27087'
        }
      ]
    },
    {
      name: 'bitcoin',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE',
          type: BIP43PurposeTypeEnum.Segwit
        },
        {
          xpriv:
            'yprvAHwhK6RbpuS3dgCYHM5jc2ZvEKd7Bi61u9FVhYMpgMSuZS613T1xxQeKTffhrHY79hZ5PsskBjcc6C2V7DrnsMsNaGDaWev3GLRQRgV7hxF',
          type: BIP43PurposeTypeEnum.WrappedSegwit
        },
        {
          xpriv:
            'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE',
          type: BIP43PurposeTypeEnum.Segwit,
          xpub:
            'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs'
        },
        {
          xpriv:
            'yprvAHwhK6RbpuS3dgCYHM5jc2ZvEKd7Bi61u9FVhYMpgMSuZS613T1xxQeKTffhrHY79hZ5PsskBjcc6C2V7DrnsMsNaGDaWev3GLRQRgV7hxF',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          xpub:
            'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP'
        },
        {
          xpriv:
            'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj'
        }
      ],
      xpubToPubkeyTests: [
        {
          xpub:
            'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
          type: BIP43PurposeTypeEnum.Legacy,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2pkh,
          addressType: AddressTypeEnum.p2pkh,
          address: '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA'
        },
        {
          xpub:
            'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkhp2sh,
          addressType: AddressTypeEnum.p2sh,
          address: '37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf'
        },
        {
          xpub:
            'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
          type: BIP43PurposeTypeEnum.Segwit,
          bip44ChangeIndex: 0,
          bip44AddressIndex: 0,
          scriptType: ScriptTypeEnum.p2wpkh,
          addressType: AddressTypeEnum.p2wpkh,
          address: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'
        }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: '1KRMKfeZcmosxALVYESdPNez1AP1mEtywp',
          scriptPubkey: '76a914ca0d36044e0dc08a22724efa6f6a07b0ec4c79aa88ac'
        },
        {
          address: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
          scriptPubkey: '0014c0cebcd6c3d3ca8c75dc5ec62ebe55330ef910e2'
        }
      ],
      signMessageTests: [
        {
          wif: 'L4rK1yDtCWekvXuE6oXD9jCYfFNV2cWRpVuPLBcCU2z8TrisoyY1',
          message: 'This is an example of a signed message.',
          signature:
            'H9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk='
        }
      ]
    },
    {
      name: 'bitcointestnet',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedToXPrivTests: [
        {
          xpriv:
            'vprv9K7GLAaERuM58PVvbk1sMo7wzVCoPwzZpVXLRBmum93gL5pSqQCAAvZjtmz93nnnYMr9i2FwG2fqrwYLRgJmDDwFjGiamGsbRMJ5Y6siJ8H',
          type: BIP43PurposeTypeEnum.Segwit
        },
        {
          xpriv:
            'uprv91G7gZkzehuMVxDJTYE6tLivdF8e4rvzSu1LFfKw3b2Qx1Aj8vpoFnHdfUZ3hmi9jsvPifmZ24RTN2KhwB8BfMLTVqaBReibyaFFcTP1s9n',
          type: BIP43PurposeTypeEnum.WrappedSegwit
        },
        {
          xpriv:
            'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
          type: BIP43PurposeTypeEnum.Legacy
        }
      ],
      xprivToXPubTests: [
        {
          xpriv:
            'vprv9K7GLAaERuM58PVvbk1sMo7wzVCoPwzZpVXLRBmum93gL5pSqQCAAvZjtmz93nnnYMr9i2FwG2fqrwYLRgJmDDwFjGiamGsbRMJ5Y6siJ8H',
          type: BIP43PurposeTypeEnum.Segwit,
          xpub:
            'vpub5Y6cjg78GGuNLsaPhmYsiw4gYX3HoQiRBiSwDaBXKUafCt9bNwWQiitDk5VZ5BVxYnQdwoTyXSs2JHRPAgjAvtbBrf8ZhDYe2jWAqvZVnsc'
        },
        {
          xpriv:
            'uprv91G7gZkzehuMVxDJTYE6tLivdF8e4rvzSu1LFfKw3b2Qx1Aj8vpoFnHdfUZ3hmi9jsvPifmZ24RTN2KhwB8BfMLTVqaBReibyaFFcTP1s9n',
          type: BIP43PurposeTypeEnum.WrappedSegwit,
          xpub:
            'upub5EFU65HtV5TeiSHmZZm7FUffBGy8UKeqp7vw43jYbvZPpoVsgU93oac7Wk3u6moKegAEWtGNF8DehrnHtv21XXEMYRUocHqguyjknFHYfgY'
        },
        {
          xpriv:
            'tprv8fVU32aAEuEPeH1WYx3LhXtSFZTRaFqjbFNPaJZ9R8fCVja44tSaUPZEKGpMK6McUDkWWMvRiVfKR3Wzei6AmLoTNYHMAZ9KtvVTLZZdhvA',
          type: BIP43PurposeTypeEnum.Legacy,
          xpub:
            'tpubDCBWBScQPGv4Xk3JSbhw6wYYpayMjb2eAYyArpbSqQTbLDpphHGAetB6VQgVeftLML8vDSUEWcC2xDi3qJJ3YCDChJDvqVzpgoYSuT52MhJ'
        }
      ],
      xpubToPubkeyTests: [
        // TODO: Convert each formated extended key or address to the testnet format
        // {
        //   xpub:
        //     'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
        //   type: BIP43PurposeTypeEnum.Legacy,
        //   bip44ChangeIndex: 0,
        //   bip44AddressIndex: 0,
        //   scriptType: ScriptTypeEnum.p2pkh,
        //   addressType: AddressTypeEnum.p2pkh,
        //   address: '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA'
        // },
        // {
        //   xpub:
        //     'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP',
        //   type: BIP43PurposeTypeEnum.WrappedSegwit,
        //   bip44ChangeIndex: 0,
        //   bip44AddressIndex: 0,
        //   scriptType: ScriptTypeEnum.p2wpkhp2sh,
        //   addressType: AddressTypeEnum.p2sh,
        //   address: '37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf'
        // },
        // {
        //   xpub:
        //     'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
        //   type: BIP43PurposeTypeEnum.Segwit,
        //   bip44ChangeIndex: 0,
        //   bip44AddressIndex: 0,
        //   scriptType: ScriptTypeEnum.p2wpkh,
        //   addressType: AddressTypeEnum.p2wpkh,
        //   address: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'
        // }
      ],
      wifToPrivateKeyTests: [
        {
          wifKey: 'cTGP1SdrZ28j12fzxL99bCUb1RtwYH2Jy7ukSdzzC7HUrJQdDJgq'
        }
      ],
      addressToScriptPubkeyTests: [
        {
          address: '2Mu9hifsg4foPLkyo9i1isPWTobnNmXL3Qk',
          scriptPubkey: 'a91414e4e7810e5120cc68d55d03b36cf66a9eadc27087'
        },
        {
          address:
            'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
          scriptPubkey:
            '00201863143c14c5166804bd19203356da136c985678cd4d27a1b8c6329604903262'
        }
      ]
    }
  ]
}
