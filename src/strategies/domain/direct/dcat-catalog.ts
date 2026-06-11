import type { ExtractedRDF } from '../../../core/types'
import type { StrategyContext, DiscoveryStrategy } from '../../strategy-interface'

export class DcatCatalogStrategy implements DiscoveryStrategy {
  readonly label = 'DCAT Catalog'
  readonly source: ExtractedRDF['source'] = 'dcat-catalog' as any
  readonly location = 'Domain' as const
  readonly extraction = 'Direct' as const
  readonly stage = 1 as const
  readonly specLink = 'https://www.w3.org/TR/vocab-dcat-2/'
  readonly standard = 'Data Catalog Vocabulary (DCAT)'
  readonly extraInfo = 'TODO: Query host/domain level DCAT portals directly to extract dataset metadata.'

  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return null // TODO: Implement DCAT catalog query
  }

  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return [] // TODO: Implement DCAT catalog query
  }
}

export const dcatCatalogStrategy = new DcatCatalogStrategy()
