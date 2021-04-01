export const getMnemonicKey = ({ coin }: { coin: string }): string =>
  `${coin}Key`

export const getMnemonic = (args: { keys: any; coin: string }): string =>
  args.keys[getMnemonicKey(args)]
