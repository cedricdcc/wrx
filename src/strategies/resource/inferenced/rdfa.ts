import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class RdfaStrategy implements DiscoveryStrategy {
  readonly label = 'RDFa Markup'
  readonly source: ExtractedRDF['source'] = 'rdfa' as any
  readonly location = 'Resource' as const
  readonly extraction = 'Inferenced' as const
  readonly quadrant = 2 as const
  readonly specLink = 'https://www.w3.org/TR/rdfa-core/'
  readonly standard = 'RDFa Core 1.1 Specification'
  readonly extraInfo = 'TODO: Traverse HTML DOM looking for property, about, and typeof attributes to build RDF triples.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement RDFa parsing
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement RDFa parsing
  }
}

export const rdfaStrategy = new RdfaStrategy()
