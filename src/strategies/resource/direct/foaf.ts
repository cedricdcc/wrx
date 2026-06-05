import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class FoafStrategy implements DiscoveryStrategy {
  readonly label = 'FOAF Relations'
  readonly source: ExtractedRDF['source'] = 'foaf' as any
  readonly location = 'Resource' as const
  readonly extraction = 'Direct' as const
  readonly quadrant = 1 as const
  readonly specLink = 'http://xmlns.com/foaf/spec/'
  readonly standard = 'FOAF Vocabulary Specification'
  readonly extraInfo = 'TODO: Parse FOAF triples defined directly in the resource payload.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement FOAF relations discovery
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement FOAF relations discovery
  }
}

export const foafStrategy = new FoafStrategy()
