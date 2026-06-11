import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class ApiDiscoveryStrategy implements DiscoveryStrategy {
  readonly label = 'API Discovery'
  readonly source: ExtractedRDF['source'] = 'api-discovery' as any
  readonly location = 'Domain' as const
  readonly extraction = 'Uplifting' as const
  readonly stage = 2 as const
  readonly specLink = 'https://www.w3.org/TR/dwbp/'
  readonly standard = 'Data on the Web Best Practices'
  readonly extraInfo = 'TODO: Traverse hypermedia catalogs and API endpoints to discover and map resource fields.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement JSON API discovery
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement JSON API discovery
  }
}

export const apiDiscoveryStrategy = new ApiDiscoveryStrategy()
