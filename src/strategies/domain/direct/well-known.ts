import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class WellKnownStrategy implements DiscoveryStrategy {
  readonly label = 'Well-Known RFC 8615 Endpoints'
  readonly source: ExtractedRDF['source'] = 'well-known' as any
  readonly location = 'Both' as const
  readonly extraction = 'Both' as const
  readonly quadrant = 3 as const
  readonly specLink = 'https://datatracker.ietf.org/doc/html/rfc8615'
  readonly standard = 'RFC 8615 / RFC 9264'
  readonly extraInfo = 'TODO: Fetch standard host endpoints (e.g. /.well-known/api-catalog or lod-catalog).'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement well-known endpoint checks
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement well-known endpoint checks
  }
}

export const wellKnownStrategy = new WellKnownStrategy()
