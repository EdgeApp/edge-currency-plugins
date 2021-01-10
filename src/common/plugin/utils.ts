import { Disklet } from 'disklet'

import { LocalWalletMetadata, NetworkEnum } from './types'
import {
  bip43PurposeNumberToTypeEnum,
  BIP43PurposeTypeEnum,
  seedOrMnemonicToXPriv,
  xprivToXPub
} from '../utxobased/keymanager/keymanager'

const metadataPath = `metadata.json`

export const fetchMetadata = async (disklet: Disklet): Promise<LocalWalletMetadata> => {
  try {
    const dataStr = await disklet.getText(metadataPath)
    return JSON.parse(dataStr)
  } catch {
    const data: LocalWalletMetadata = {
      balance: '0',
      lastSeenBlockHeight: 0
    }
    await setMetadata(disklet, data)
    return data
  }
}

export const setMetadata = (disklet: Disklet, data: LocalWalletMetadata): Promise<void> =>
  disklet.setText(metadataPath, JSON.stringify(data)).then()

export const getMnemonicKey = ({ coin }: { coin: string }): string =>
  `${coin}Key`

export const getXprivKey = ({ coin }: { coin: string }): string =>
  `${coin}Xpriv`

export const getXpubKey = ({ coin }: { coin: string }): string =>
  `${coin}Xpub`

export const getMnemonic = (args: { keys: any, coin: string }): string =>
  args.keys[getMnemonicKey(args)]

export const getXpriv = (args: { keys: any, coin: string }): string =>
  args.keys[getXprivKey(args)]

export const getXpub = (args: { keys: any, coin: string }): string =>
  args.keys[getXpubKey(args)]

export const getCoinType = (args: { keys: any }): number =>
  args.keys.coinType

export const getPurposeType = ({ keys }: { keys: any }): BIP43PurposeTypeEnum => {
  const formatNum = (keys.format as string).replace('bip', '')
  return bip43PurposeNumberToTypeEnum(Number(formatNum))
}

export const fetchOrDeriveXpriv = async (args: { keys: any, walletLocalEncryptedDisklet: Disklet, coin: string, network: NetworkEnum, }): Promise<string> => {
  const xprivKey = getXprivKey({ coin: args.coin })
  try {
    return await args.walletLocalEncryptedDisklet.getText(xprivKey)
  } catch (e) {
    const xpriv = deriveXpriv(args)
    await args.walletLocalEncryptedDisklet.setText(xprivKey, xpriv)
    return xpriv
  }
}

export const deriveXpriv = (args: { keys: any, coin: string, network: NetworkEnum }): string =>
  seedOrMnemonicToXPriv({
    seed: getMnemonic({ coin: args.coin, keys: args.keys }),
    coinType: getCoinType(args),
    type: getPurposeType({ keys: args.keys }),
    coin: args.coin,
    network: args.network
  })

export const deriveXpub = (args: { keys: any, coin: string, network: NetworkEnum }): string =>
  xprivToXPub({
    xpriv: deriveXpriv(args),
    type: getPurposeType(args),
    coin: args.coin,
    network: args.network
  })
