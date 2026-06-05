import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class HtmlLinksStrategy implements DiscoveryStrategy {
  readonly label = 'HTML Hyperlinks'
  readonly source: ExtractedRDF['source'] = 'html-links' as any
  readonly location = 'Resource' as const
  readonly extraction = 'Inferenced' as const
  readonly quadrant = 2 as const
  readonly specLink = 'https://html.spec.whatwg.org/multipage/links.html'
  readonly standard = 'HTML5 Hyperlink Specification'
  readonly extraInfo = 'TODO: Parse anchor links from HTML body and map page relationships to construct RDF graph.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement HTML hyperlink inference
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement HTML hyperlink inference
  }
}

export const htmlLinksStrategy = new HtmlLinksStrategy()
