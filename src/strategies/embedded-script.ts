import type { ExtractedRDF } from '../core/types'
import type { StrategyContext, DiscoveryStrategy } from './strategy-interface'
import { isRDFMime } from '../core/utils'

/**
 * Embedded RDF Script Strategy
 *
 * Extracts RDF content from <script type="application/ld+json"> or other RDF MIME type scripts
 * embedded directly in the HTML body.
 *
 * In single-hit mode, returns the first matching script.
 * In all-hits mode, collects all embedded RDF scripts.
 */
export class EmbeddedScriptStrategy implements DiscoveryStrategy {
  readonly label = 'Embedded RDF script'
  readonly source: ExtractedRDF['source'] = 'embedded-script'

  /**
   * Single-hit mode: return the first embedded RDF script found.
   */
  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    // If no body text, nothing to extract
    if (!ctx.bodyText) return null

    // Parse HTML to find embedded scripts
    const scripts = this._extractScriptsFromHtml(ctx.bodyText, ctx.htmlDoc)

    // Find first RDF-typed script
    for (const script of scripts) {
      const type = script.type.toLowerCase()
      if (isRDFMime(type)) {
        return {
          content: script.content,
          mime: type,
          format: type,
          source: this.source,
          url: ctx.uri,
        }
      }
    }

    return null
  }

  /**
   * All-hits mode: collect all embedded RDF scripts.
   */
  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    const found: ExtractedRDF[] = []

    // If no body text, nothing to extract
    if (!ctx.bodyText) return found

    // Parse HTML to find embedded scripts
    const scripts = this._extractScriptsFromHtml(ctx.bodyText, ctx.htmlDoc)

    // Collect all RDF-typed scripts
    for (const script of scripts) {
      const type = script.type.toLowerCase()
      if (isRDFMime(type)) {
        found.push({
          content: script.content,
          mime: type,
          format: type,
          source: this.source,
          url: ctx.uri,
        })
      }
    }

    return found
  }

  /**
   * Extract scripts from HTML body using DOMParser if available, else regex fallback.
   */
  private _extractScriptsFromHtml(
    bodyText: string,
    htmlDoc: Document | null
  ): Array<{ type: string; content: string }> {
    const scripts: Array<{ type: string; content: string }> = []

    // Prefer DOMParser if available
    if (htmlDoc) {
      try {
        for (const script of htmlDoc.querySelectorAll('script[type]')) {
          const type = script.getAttribute('type')?.toLowerCase() ?? ''
          const content = script.textContent?.trim() ?? ''
          if (type && content) {
            scripts.push({ type, content })
          }
        }
        return scripts
      } catch {
        // Fall through to regex approach
      }
    }

    // Fallback: regex extraction (no DOMParser available)
    const scriptRegex = /(<script\b[^>]*>)([\s\S]*?)<\/script>/gi
    let match: RegExpExecArray | null
    while ((match = scriptRegex.exec(bodyText)) !== null) {
      const openTag = match[1] ?? ''
      const content = (match[2] ?? '').trim()
      if (!openTag || !content) continue

      // Parse attributes from opening tag
      const typeMatch = openTag.match(/type\s*=\s*["']?([^\s"'>;]+)/i)
      const type = typeMatch?.[1]?.toLowerCase() ?? ''

      if (type) {
        scripts.push({ type, content })
      }
    }

    return scripts
  }
}

export const embeddedScriptStrategy = new EmbeddedScriptStrategy()
