import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class AtomFeedStrategy implements DiscoveryStrategy {
  readonly label = 'Atom Feed Listing'
  readonly source: ExtractedRDF['source'] = 'atom-feed' as any
  readonly location = 'Domain' as const
  readonly extraction = 'Uplifting' as const
  readonly stage = 2 as const
  readonly specLink = 'https://datatracker.ietf.org/doc/html/rfc4287'
  readonly standard = 'RFC 4287 (Atom Syndication Format)'
  readonly extraInfo = 'TODO: Harvest resources from host Atom XML feed and generate metadata triples.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement Atom feed parsing
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement Atom feed parsing
  }
}

export const atomFeedStrategy = new AtomFeedStrategy()
