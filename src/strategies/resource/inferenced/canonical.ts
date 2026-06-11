import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class CanonicalStrategy implements DiscoveryStrategy {
  readonly label = 'Canonical URLs'
  readonly source: ExtractedRDF['source'] = 'canonical' as any
  readonly location = 'Resource' as const
  readonly extraction = 'Uplifting' as const
  readonly stage = 2 as const
  readonly specLink = 'https://datatracker.ietf.org/doc/html/rfc6596'
  readonly standard = 'RFC 6596 (Canonical Link)'
  readonly extraInfo = 'TODO: Parse rel=canonical link to verify page equivalence identity and mapping.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement Canonical URL inference
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement Canonical URL inference
  }
}

export const canonicalStrategy = new CanonicalStrategy()
