import { EdgePaymentProtocolInfo, EdgeSpendTarget } from 'edge-core-js'
import parse from 'url-parse'

interface BitPayOutput {
  amount: number
  address: string
}

interface getSpendTargetsReturn {
  nativeAmount: number
  spendTargets: EdgeSpendTarget[]
}

export function getSpendTargets(
  outputs: BitPayOutput[]
): getSpendTargetsReturn {
  let nativeAmount = 0
  const spendTargets: EdgeSpendTarget[] = []
  for (const output of outputs) {
    nativeAmount += output.amount
    spendTargets.push({
      publicAddress: output.address,
      nativeAmount: `${output.amount}`
    })
  }
  return { nativeAmount, spendTargets }
}

export async function getPaymentDetails(
  paymentProtocolURL: string,
  network: string,
  currencyCode: string,
  fetch: any
): Promise<EdgePaymentProtocolInfo> {
  const headers = {
    Accept: 'application/payment-request',
    'x-currency': currencyCode
  }
  const result = await fetch(paymentProtocolURL, { headers })
  if (parseInt(result.status) !== 200) {
    const error = await result.text()
    throw new Error(error)
  }
  const paymentRequest = await result.json()
  const {
    outputs,
    memo,
    paymentUrl,
    paymentId,
    requiredFeeRate
  } = paymentRequest

  const { nativeAmount, spendTargets } = getSpendTargets(outputs)
  const domain = parse(paymentUrl, {}).hostname

  const edgePaymentProtocolInfo: EdgePaymentProtocolInfo = {
    nativeAmount: `${nativeAmount}`,
    merchant: `{ ${JSON.stringify(paymentId)}, ${JSON.stringify(
      requiredFeeRate
    )} }`,
    memo,
    domain,
    spendTargets
  }

  return edgePaymentProtocolInfo
}

export function createPayment(tx: string, currencyCode: string): any {
  return { currency: currencyCode, transactions: [tx] }
}

export async function sendPayment(
  fetch: any,
  paymentUrl: string,
  payment: any
): Promise<any> {
  const headers = { 'Content-Type': 'application/payment' }
  const result = await fetch(paymentUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payment)
  })
  if (parseInt(result.status) !== 200) {
    const error = await result.text()
    throw new Error(error)
  }
  const paymentACK = await result.json()
  return paymentACK
}
