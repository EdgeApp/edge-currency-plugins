export interface ScriptTemplates {
  [key: string]: ScriptTemplate
}

export type ScriptTemplate = (
  pubkey: string,
  optionalArgs?: OptionalScriptTemplateArgs
) => string

export interface OptionalScriptTemplateArgs {
  cdsSig?: string
  cdsMsg?: string
  cdsPubKey?: string
}
