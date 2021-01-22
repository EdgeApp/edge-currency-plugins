import { Disklet } from 'disklet'

import { LocalWalletMetadata } from './types'

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

export const getMnemonic = (args: { keys: any, coin: string }): string =>
  args.keys[getMnemonicKey(args)]
