const OP_CHECKDATASIGVERIFY = 'bb'
const OP_CHECKDATASIG = 'ba'
const OP_CHECKSIG = 'ac'
const CDS_SIGNATURE =
  '30440220256c12175e809381f97637933ed6ab97737d263eaaebca6add21bced67fd12a402205ce29ecc1369d6fc1b51977ed38faaf41119e3be1d7edfafd7cfaf0b6061bd07'
const CDS_MESSAGE = ''
const CDS_PUBKEY =
  '038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508'

const hexToVarByte = (hex: string): string => {
  const len = hex.length / 2
  const str = len.toString(16)
  const hexLen = str.length % 2 === 0 ? str : `0${str}`
  return hexLen + hex
}

const cds = (
  cdsSigs: string,
  cdsMsg: string,
  cdsPubKey: string,
  pubKey: string
): string[] => {
  const cdsSuffix = `${hexToVarByte(pubKey)}${OP_CHECKSIG}`
  const cdsPrefix = `${hexToVarByte(cdsSigs)}${hexToVarByte(
    cdsMsg
  )}${hexToVarByte(cdsPubKey)}`
  return [cdsPrefix, cdsSuffix]
}

export const cdsScriptTemplates = {
  replayProtection: (pubKey: string): string =>
    cds(CDS_SIGNATURE, CDS_MESSAGE, CDS_PUBKEY, pubKey).join(
      OP_CHECKDATASIGVERIFY
    ),
  checkdatasig: (pubKey: string) => (
    cdsSig = '',
    cdsMsg = '',
    cdsPubKey = ''
  ): string => cds(cdsSig, cdsMsg, cdsPubKey, pubKey).join(OP_CHECKDATASIG),
  checkdatasigverify: (pubKey: string) => (
    cdsSig = '',
    cdsMsg = '',
    cdsPubKey = ''
  ): string =>
    cds(cdsSig, cdsMsg, cdsPubKey, pubKey).join(OP_CHECKDATASIGVERIFY)
}
