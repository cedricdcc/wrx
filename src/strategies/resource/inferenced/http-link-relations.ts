import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class HttpLinkRelationsStrategy implements DiscoveryStrategy {
  readonly label = 'HTTP Link Relations'
  readonly source: ExtractedRDF['source'] = 'http-link-relations' as any
  readonly location = 'Resource' as const
  readonly extraction = 'Inferenced' as const
  readonly quadrant = 2 as const
  readonly specLink = 'https://datatracker.ietf.org/doc/html/rfc8288'
  readonly standard = 'RFC 8288 (Web Linking) - Collection/Item'
  readonly extraInfo = 'TODO: Parse Link headers with rel=collection/item/up to construct structural graph.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement HTTP Link relations inference
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement HTTP Link relations inference
  }
}

export const httpLinkRelationsStrategy = new HttpLinkRelationsStrategy()
