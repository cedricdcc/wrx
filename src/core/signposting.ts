import { isRDFMime } from './utils'

export function hasNonEmptyProfileAttribute(profile: string | null | undefined): boolean {
  return Boolean((profile ?? '').trim())
}

export function shouldAcceptDeclaredType(type: string | null | undefined, hasProfile: boolean): boolean {
  const declaredType = (type ?? '').trim()
  if (!declaredType) return true
  if (isRDFMime(declaredType)) return true
  return hasProfile
}
