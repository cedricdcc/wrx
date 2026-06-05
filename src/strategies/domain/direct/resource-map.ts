import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class ResourceMapStrategy implements DiscoveryStrategy {
  readonly label = 'Resource Map'
  readonly source: ExtractedRDF['source'] = 'resource-map' as any
  readonly location = 'Both' as const
  readonly extraction = 'Both' as const
  readonly quadrant = 3 as const
  readonly specLink = 'https://www.openarchives.org/ore/1.0/toc.html'
  readonly standard = 'OAI Object Reuse and Exchange (OAI-ORE)'
  readonly extraInfo = 'TODO: Fetch and parse domain resource maps detailing page representations.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement OAI-ORE resource map parsing
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement OAI-ORE resource map parsing
  }
}

export const resourceMapStrategy = new ResourceMapStrategy()
