import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class SkosStrategy implements DiscoveryStrategy {
  readonly label = 'SKOS Relations'
  readonly source: ExtractedRDF['source'] = 'skos' as any
  readonly location = 'Resource' as const
  readonly extraction = 'Direct' as const
  readonly quadrant = 1 as const
  readonly specLink = 'https://www.w3.org/TR/skos-reference/'
  readonly standard = 'SKOS Simple Knowledge Organization System'
  readonly extraInfo = 'TODO: Discover concept scheme and term relationships via SKOS assertions in the RDF payload.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement SKOS relations discovery
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement SKOS relations discovery
  }
}

export const skosStrategy = new SkosStrategy()
