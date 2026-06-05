import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class MicrodataStrategy implements DiscoveryStrategy {
  readonly label = 'Microdata Markup'
  readonly source: ExtractedRDF['source'] = 'microdata' as any
  readonly location = 'Resource' as const
  readonly extraction = 'Inferenced' as const
  readonly quadrant = 2 as const
  readonly specLink = 'https://www.w3.org/TR/microdata/'
  readonly standard = 'HTML Microdata'
  readonly extraInfo = 'TODO: Parse HTML microdata attributes (itemscope, itemtype, itemprop) and translate to RDF.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement HTML microdata parsing
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement HTML microdata parsing
  }
}

export const microdataStrategy = new MicrodataStrategy()
