export function getUriKeyParams(uri: string): string[] {
  const params = uri.match(/%\{(\w|\d)+\}/g)
  return params ?? []
}

export function replaceKeyParams<T extends string>(
  uri: string,
  options: { [P in T]?: string }
): string {
  const keyParams = getUriKeyParams(uri)

  for (const keyParam of keyParams) {
    const keyIndex = keyParam.replace(/%|{|}/g, '') as T
    const key: string | undefined = options[keyIndex]
    if (key == null) throw new Error(`Missing key for connection URI ${uri}`)
    uri = uri.replace(keyParam, key)
  }

  return uri
}
