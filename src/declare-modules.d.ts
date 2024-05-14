declare module 'react-native' {
  export const NativeModules: {
    EdgeCurrencyPluginsModule: {
      getConstants: () => {
        sourceUri: string
      }
    }
  }
}
