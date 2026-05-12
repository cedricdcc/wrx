// src/core/constants.ts
var STRATEGY_ORDER = [
  "content-negotiation",
  "signposting-link-header",
  "linkset",
  "signposting-html-link",
  "embedded-script",
  "sitemap-signposting"
];
var RDF_MIMES = [
  "text/turtle",
  "application/ld+json",
  "application/rdf+xml",
  "application/n-triples",
  "application/n-quads",
  "application/trig",
  "text/n3"
];
var RDF_ACCEPT = RDF_MIMES.join(", ");
var RDF_MIME_SET = new Set(RDF_MIMES.map((m) => m.toLowerCase()));

// src/core/utils.ts
function baseMime(contentType) {
  if (!contentType)
    return "";
  const semi = contentType.indexOf(";");
  return (semi === -1 ? contentType : contentType.slice(0, semi)).trim().toLowerCase();
}
function relHasToken(rel, token) {
  if (!rel)
    return false;
  return rel.toLowerCase().split(/\s+/).some((r) => r.trim() === token);
}
function splitRelValues(rel) {
  if (!rel)
    return [];
  return rel.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}
function isAbsoluteUri(value) {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}
function normUri(u) {
  return u.toLowerCase().replace(/\/$/, "");
}
function sanitizeRelationToken(rel) {
  return rel.trim();
}
function isRDFMime(mime) {
  const normalized = (mime ?? "").toLowerCase().trim();
  return normalized === "text/turtle" || normalized === "application/ld+json" || normalized === "application/rdf+xml" || normalized === "application/n-triples" || normalized === "application/n-quads" || normalized === "application/trig" || normalized === "text/n3";
}
function isLinksetMime(mime) {
  const normalized = (mime ?? "").toLowerCase().trim();
  return normalized === "application/linkset+json" || normalized === "application/linkset";
}

// src/core/fetch.ts
function fetchWithRedirect(url, init) {
  return fetch(url, { ...init, redirect: "follow" });
}
function fetchRDF(url) {
  return fetchWithRedirect(url, { headers: { Accept: RDF_ACCEPT } });
}
async function fetchHeadLinkHeader(url) {
  try {
    const res = await fetchWithRedirect(url, {
      method: "HEAD",
      headers: { Accept: RDF_ACCEPT }
    });
    return res.headers.get("link");
  } catch {
    return null;
  }
}
async function fetchHtmlFallback(uri) {
  try {
    const res = await fetchWithRedirect(uri, {
      headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.3" }
    });
    if (res.ok) {
      const ct = baseMime(res.headers.get("content-type"));
      if (ct === "text/html" || ct === "application/xhtml+xml") {
        return { body: await res.text(), linkHeader: res.headers.get("link") };
      }
    }
  } catch {}
  return { body: "", linkHeader: null };
}
function fetchDescribedBy(url, declaredType) {
  if (!declaredType)
    return fetchRDF(url);
  const declared = declaredType.toLowerCase().trim();
  const others = [
    "text/turtle",
    "application/ld+json",
    "application/rdf+xml",
    "application/n-triples",
    "text/n3",
    "application/n-quads",
    "application/trig"
  ].filter((m) => m !== declared).map((m, i) => `${m};q=${Math.max(0.1, 0.9 - i * 0.1).toFixed(1)}`);
  const accept = [`${declared};q=1.0`, ...others].join(", ");
  return fetchWithRedirect(url, { headers: { Accept: accept } });
}

// src/core/html-parser.ts
function parseTagAttributes(tagText) {
  const attrs = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match;
  while ((match = attrRegex.exec(tagText)) !== null) {
    const key = (match[1] ?? "").toLowerCase();
    const val = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (key)
      attrs[key] = val;
  }
  return attrs;
}
function extractHtmlHints(bodyText) {
  const describedByLinks = [];
  const linksets = [];
  const embeddedScripts = [];
  const linkRegex = /<link\b[^>]*>/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(bodyText)) !== null) {
    const tag = linkMatch[0] ?? "";
    if (!tag)
      continue;
    const attrs = parseTagAttributes(tag);
    const rel = attrs["rel"] ?? null;
    const href = attrs["href"] ?? null;
    const type = attrs["type"] ?? null;
    if (!href)
      continue;
    if (relHasToken(rel, "describedby")) {
      describedByLinks.push({ href, type });
    }
    if (relHasToken(rel, "linkset")) {
      linksets.push(href);
    }
  }
  const scriptRegex = /(<script\b[^>]*>)([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(bodyText)) !== null) {
    const openTag = scriptMatch[1] ?? "";
    const content = (scriptMatch[2] ?? "").trim();
    if (!openTag || !content)
      continue;
    const attrs = parseTagAttributes(openTag);
    const type = (attrs["type"] ?? "").toLowerCase();
    if (type)
      embeddedScripts.push({ type, content });
  }
  return { describedByLinks, linksets, embeddedScripts };
}

// src/core/link-parser.ts
function parseLinkHeader(header) {
  if (!header?.trim())
    return [];
  return header.split(",").map((part) => {
    part = part.trim();
    const urlMatch = part.match(/<([^>]+)>/);
    if (!urlMatch)
      return null;
    const url = urlMatch[1] ?? "";
    if (!url)
      return null;
    const link = { url };
    const paramsPart = part.substring(part.indexOf(">") + 1).trim();
    if (paramsPart) {
      const paramParts = paramsPart.split(";").map((p) => p.trim()).filter(Boolean);
      for (const p of paramParts) {
        const eqIndex = p.indexOf("=");
        if (eqIndex === -1)
          continue;
        const key = p.slice(0, eqIndex).trim().toLowerCase();
        let val = p.slice(eqIndex + 1).trim();
        if (val.startsWith('"') && val.endsWith('"'))
          val = val.slice(1, -1);
        link[key] = val;
      }
    }
    return link;
  }).filter((l) => l !== null);
}
function relationKey(item) {
  const opts = (item.options ?? []).slice().sort((a, b) => {
    const aKey = a.name ?? a.key ?? "";
    const bKey = b.name ?? b.key ?? "";
    if (aKey === bKey)
      return (a.value ?? "").localeCompare(b.value ?? "");
    return aKey.localeCompare(bKey);
  }).map((opt) => {
    const k = opt.name ?? opt.key ?? "";
    const v = opt.value ?? "";
    return `${k}=${v}`;
  }).join("|");
  return [item.anchor, item.rel, item.href, item.origin, opts].join("::");
}
function addLinkRelation(items, seen, item) {
  const key = relationKey(item);
  if (seen.has(key))
    return;
  seen.add(key);
  items.push(item);
}
function collectFromParsedLinkEntries(entries, defaultAnchor, origin, sink, seen, baseForTargetResolution) {
  for (const entry of entries) {
    const relValues = splitRelValues(entry["rel"]);
    if (relValues.length === 0)
      continue;
    const hrefRaw = entry["url"];
    if (!hrefRaw)
      continue;
    let href;
    try {
      href = new URL(hrefRaw, baseForTargetResolution).toString();
    } catch {
      continue;
    }
    const anchorRaw = entry["anchor"];
    let anchor = defaultAnchor;
    if (anchorRaw) {
      try {
        anchor = new URL(anchorRaw, baseForTargetResolution).toString();
      } catch {
        anchor = defaultAnchor;
      }
    }
    const options = Object.entries(entry).filter(([key]) => key !== "url" && key !== "rel" && key !== "anchor").map(([key, value]) => ({ name: key, value }));
    for (const rel of relValues) {
      const relToken = sanitizeRelationToken(rel);
      if (!relToken)
        continue;
      addLinkRelation(sink, seen, { anchor, rel: relToken, href, options, origin });
    }
  }
}
function collectFromJsonLinksetContext(context, linksetUrl, baseUri, sink, seen) {
  const anchorValue = typeof context["anchor"] === "string" ? context["anchor"] : baseUri;
  let anchor = baseUri;
  try {
    anchor = new URL(anchorValue, linksetUrl).toString();
  } catch {
    anchor = baseUri;
  }
  for (const [relName, rawVal] of Object.entries(context)) {
    if (relName === "anchor")
      continue;
    if (!Array.isArray(rawVal))
      continue;
    for (const item of rawVal) {
      if (typeof item !== "object" || item === null)
        continue;
      const row = item;
      if (typeof row.href !== "string")
        continue;
      let href;
      try {
        href = new URL(row.href, linksetUrl).toString();
      } catch {
        continue;
      }
      const options = Object.entries(row).filter(([key]) => key !== "href").filter(([, value]) => typeof value === "string").map(([key, value]) => ({ name: key, value }));
      addLinkRelation(sink, seen, {
        anchor,
        rel: relName,
        href,
        options,
        origin: "linkset"
      });
    }
  }
}
async function collectLinkRelationsFromLinkset(linksetUrl, baseUri, sink, seen) {
  const acceptLinkset = "application/linkset+json;q=1.0, application/ld+json;q=0.9, application/linkset;q=0.8";
  let res;
  try {
    res = await fetchWithRedirect(linksetUrl, { headers: { Accept: acceptLinkset } });
    if (!res.ok)
      return;
  } catch {
    return;
  }
  const ct = baseMime(res.headers.get("content-type"));
  if (ct === "application/linkset+json" || ct === "application/json" || ct === "application/ld+json") {
    let data;
    try {
      data = await res.json();
    } catch {
      return;
    }
    const linkset = data?.linkset;
    if (!Array.isArray(linkset))
      return;
    for (const ctx of linkset) {
      collectFromJsonLinksetContext(ctx, linksetUrl, baseUri, sink, seen);
    }
    return;
  }
  if (ct === "application/linkset") {
    let text;
    try {
      text = await res.text();
    } catch {
      return;
    }
    const links = parseLinkHeader(text.replace(/[\r\n\t]+/g, " "));
    collectFromParsedLinkEntries(links, baseUri, "linkset", sink, seen, linksetUrl);
  }
}
async function collectLinkRelationsForUri(uri) {
  const relations = [];
  const seen = new Set;
  let bodyText = "";
  let linkHeader = null;
  try {
    const discovery = await fetchRDF(uri);
    linkHeader = discovery.headers.get("link");
    const ct = baseMime(discovery.headers.get("content-type"));
    if (!ct || !discovery.ok) {
      try {
        bodyText = await discovery.text();
      } catch {
        bodyText = "";
      }
    } else {
      try {
        await discovery.text();
      } catch {}
    }
  } catch {}
  if (!bodyText) {
    const fallback = await fetchHtmlFallback(uri);
    if (fallback.body) {
      bodyText = fallback.body;
      if (!linkHeader)
        linkHeader = fallback.linkHeader;
    }
  }
  const headerLinks = parseLinkHeader(linkHeader);
  collectFromParsedLinkEntries(headerLinks, uri, "signposting-link-header", relations, seen, uri);
  const htmlHints = bodyText ? extractHtmlHints(bodyText) : { describedByLinks: [], linksets: [], embeddedScripts: [] };
  collectFromHtmlHintsInternal(uri, htmlHints, relations, seen);
  const linksetTargets = new Set;
  for (const link of headerLinks) {
    const relValues = splitRelValues(link["rel"]);
    if (!relValues.includes("linkset"))
      continue;
    try {
      linksetTargets.add(new URL(link["url"], uri).toString());
    } catch {}
  }
  for (const href of htmlHints.linksets) {
    try {
      linksetTargets.add(new URL(href, uri).toString());
    } catch {}
  }
  for (const lsUrl of linksetTargets) {
    await collectLinkRelationsFromLinkset(lsUrl, uri, relations, seen);
  }
  return relations;
}
function collectFromHtmlHintsInternal(uri, htmlHints, sink, seen) {
  for (const link of htmlHints.describedByLinks) {
    try {
      const href = new URL(link.href, uri).toString();
      const options = link.type ? [{ name: "type", value: link.type }] : [];
      addLinkRelation(sink, seen, {
        anchor: uri,
        rel: "describedby",
        href,
        options,
        origin: "signposting-html-link"
      });
    } catch {}
  }
  for (const linkset of htmlHints.linksets) {
    try {
      const href = new URL(linkset, uri).toString();
      addLinkRelation(sink, seen, {
        anchor: uri,
        rel: "linkset",
        href,
        options: [],
        origin: "signposting-html-link"
      });
    } catch {}
  }
}

// src/strategies/content-negotiation.ts
class ContentNegotiationStrategy {
  label = "Content Negotiation";
  source = "content-negotiation";
  async executeFirstHit(ctx) {
    try {
      const res = await fetchRDF(ctx.uri);
      const ct = baseMime(res.headers.get("content-type"));
      const body = await res.text();
      if (res.ok && isRDFMime(ct)) {
        return {
          content: body,
          format: ct,
          source: this.source,
          url: ctx.uri
        };
      }
    } catch {}
    return null;
  }
  async executeAllHits(ctx) {
    const found = [];
    const contentNegotiations = [];
    const seenFormats = new Set;
    for (const mime of RDF_MIMES) {
      try {
        const res = await fetchWithRedirect(ctx.uri, { headers: { Accept: mime } });
        const ct = baseMime(res.headers.get("content-type"));
        const body = await res.text();
        const isRdf = res.ok && isRDFMime(ct);
        contentNegotiations.push({
          requestedMime: mime,
          responseMime: ct || "(unknown)",
          chars: body.length,
          isRdf,
          url: res.url || ctx.uri
        });
        if (isRdf && !seenFormats.has(ct)) {
          seenFormats.add(ct);
          found.push({
            content: body,
            format: ct,
            source: this.source,
            url: ctx.uri
          });
        }
      } catch {}
    }
    return found;
  }
}
var contentNegotiationStrategy = new ContentNegotiationStrategy;
// src/core/mime.ts
function looksLikeJsonLd(text) {
  try {
    const obj = JSON.parse(text);
    const records = Array.isArray(obj) ? obj : [obj];
    return records.some((item) => typeof item === "object" && item !== null && (("@context" in item) || ("@type" in item) || ("@graph" in item)));
  } catch {
    return false;
  }
}
function resolveRdfFormat(responseCt, declaredType, body) {
  const ct = (responseCt ?? "").toLowerCase().trim();
  if (RDF_MIME_SET.has(ct))
    return ct;
  if (declaredType && RDF_MIME_SET.has(declaredType.toLowerCase().trim()) && ct === "application/json" && looksLikeJsonLd(body)) {
    return declaredType;
  }
  return null;
}

// src/strategies/link-header.ts
function hasDeclaredProfile(link) {
  return Boolean((link["profile"] ?? "").trim());
}
function shouldTryDescribedBy(link) {
  const declaredType = (link["type"] ?? "").trim();
  if (!declaredType)
    return true;
  if (isRDFMime(declaredType))
    return true;
  return hasDeclaredProfile(link);
}

class LinkHeaderStrategy {
  label = "HTTP Link header (rel=describedby)";
  source = "signposting-link-header";
  async executeFirstHit(ctx) {
    if (!ctx.linkHeader)
      return null;
    const links = parseLinkHeader(ctx.linkHeader);
    const describedByLinks = links.filter((l) => l["rel"] === "describedby" && shouldTryDescribedBy(l));
    const profileLinks = links.filter((l) => l["rel"] === "profile");
    const profileDescribedBy = profileLinks.filter((pl) => shouldTryDescribedBy(pl));
    const allDescribedBy = [...describedByLinks, ...profileDescribedBy];
    for (const link of allDescribedBy) {
      const url = link["url"];
      if (!url)
        continue;
      try {
        const metaUrl = new URL(url, ctx.uri).toString();
        const res = await fetchRDF(metaUrl);
        const ct = baseMime(res.headers.get("content-type"));
        const body = await res.text();
        const format = resolveRdfFormat(ct, link["type"], body);
        if (format && res.ok) {
          return {
            content: body,
            format,
            source: this.source,
            url: metaUrl
          };
        }
      } catch {}
    }
    return null;
  }
  async executeAllHits(ctx) {
    const found = [];
    if (!ctx.linkHeader)
      return found;
    const links = parseLinkHeader(ctx.linkHeader);
    const describedByLinks = links.filter((l) => l["rel"] === "describedby" && shouldTryDescribedBy(l));
    const profileLinks = links.filter((l) => l["rel"] === "profile");
    const profileDescribedBy = profileLinks.filter((pl) => shouldTryDescribedBy(pl));
    const allDescribedBy = [...describedByLinks, ...profileDescribedBy];
    const seenUrls = new Set;
    for (const link of allDescribedBy) {
      const url = link["url"];
      if (!url)
        continue;
      try {
        const metaUrl = new URL(url, ctx.uri).toString();
        if (seenUrls.has(normUri(metaUrl)))
          continue;
        seenUrls.add(normUri(metaUrl));
        const res = await fetchRDF(metaUrl);
        const ct = baseMime(res.headers.get("content-type"));
        const body = await res.text();
        const format = resolveRdfFormat(ct, link["type"], body);
        if (format && res.ok) {
          found.push({
            content: body,
            format,
            source: this.source,
            url: metaUrl
          });
        }
      } catch {}
    }
    return found;
  }
  extractLinksetUrls(linkHeader, baseUri) {
    const urls = [];
    if (!linkHeader)
      return urls;
    const links = parseLinkHeader(linkHeader);
    const linksetLinks = links.filter((l) => l["rel"] === "linkset");
    for (const link of linksetLinks) {
      if (link["url"]) {
        try {
          urls.push(new URL(link["url"], baseUri).toString());
        } catch {}
      }
    }
    const profileLinks = links.filter((l) => l["rel"] === "profile" && l["type"] && isLinksetMime(l["type"]));
    for (const link of profileLinks) {
      if (link["url"]) {
        try {
          const url = new URL(link["url"], baseUri).toString();
          if (!urls.some((u) => normUri(u) === normUri(url))) {
            urls.push(url);
          }
        } catch {}
      }
    }
    return urls;
  }
}
var linkHeaderStrategy = new LinkHeaderStrategy;
// src/strategies/embedded-script.ts
class EmbeddedScriptStrategy {
  label = "Embedded RDF script";
  source = "embedded-script";
  async executeFirstHit(ctx) {
    if (!ctx.bodyText)
      return null;
    const scripts = this._extractScriptsFromHtml(ctx.bodyText, ctx.htmlDoc);
    for (const script of scripts) {
      const type = script.type.toLowerCase();
      if (isRDFMime(type)) {
        return {
          content: script.content,
          format: type,
          source: this.source,
          url: ctx.uri
        };
      }
    }
    return null;
  }
  async executeAllHits(ctx) {
    const found = [];
    if (!ctx.bodyText)
      return found;
    const scripts = this._extractScriptsFromHtml(ctx.bodyText, ctx.htmlDoc);
    for (const script of scripts) {
      const type = script.type.toLowerCase();
      if (isRDFMime(type)) {
        found.push({
          content: script.content,
          format: type,
          source: this.source,
          url: ctx.uri
        });
      }
    }
    return found;
  }
  _extractScriptsFromHtml(bodyText, htmlDoc) {
    const scripts = [];
    if (htmlDoc) {
      try {
        for (const script of htmlDoc.querySelectorAll("script[type]")) {
          const type = script.getAttribute("type")?.toLowerCase() ?? "";
          const content = script.textContent?.trim() ?? "";
          if (type && content) {
            scripts.push({ type, content });
          }
        }
        return scripts;
      } catch {}
    }
    const scriptRegex = /(<script\b[^>]*>)([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(bodyText)) !== null) {
      const openTag = match[1] ?? "";
      const content = (match[2] ?? "").trim();
      if (!openTag || !content)
        continue;
      const typeMatch = openTag.match(/type\s*=\s*["']?([^\s"'>;]+)/i);
      const type = typeMatch?.[1]?.toLowerCase() ?? "";
      if (type) {
        scripts.push({ type, content });
      }
    }
    return scripts;
  }
}
var embeddedScriptStrategy = new EmbeddedScriptStrategy;
// src/strategies/linkset.ts
function hasDeclaredProfile2(target) {
  const raw = target["profile"];
  return typeof raw === "string" && raw.trim().length > 0;
}
function shouldTryDeclaredType(type, hasProfile) {
  if (!type)
    return true;
  if (isRDFMime(type))
    return true;
  return hasProfile;
}

class LinksetStrategy {
  label = "RFC 9264 Linkset";
  source = "linkset";
  async executeFirstHit(ctx) {
    const linksetUrl = ctx.linksetUrl ?? ctx.uri;
    const result = await this._tryFetchLinkset(linksetUrl, ctx.uri);
    if (result)
      return result;
    return null;
  }
  async executeAllHits(ctx) {
    const found = [];
    const linksetUrl = ctx.linksetUrl ?? ctx.uri;
    const results = await this._tryFetchAllFromLinkset(linksetUrl, ctx.uri);
    found.push(...results);
    return found;
  }
  async _tryFetchLinkset(linksetUrl, baseUri) {
    const acceptLinkset = "application/linkset+json;q=1.0, application/ld+json;q=0.9, application/linkset;q=0.8";
    let res;
    try {
      res = await fetchWithRedirect(linksetUrl, { headers: { Accept: acceptLinkset } });
      if (!res.ok)
        return null;
    } catch {
      return null;
    }
    const ct = baseMime(res.headers.get("content-type"));
    if (ct === "application/linkset+json" || ct === "application/json" || ct === "application/ld+json") {
      let data;
      try {
        data = await res.json();
      } catch {
        return null;
      }
      const typedData = data;
      if (!Array.isArray(typedData?.linkset))
        return null;
      const allCtxs = typedData.linkset;
      const baseNorm = normUri(baseUri);
      const matchedCtxs = allCtxs.filter((ctx) => {
        const anchor = typeof ctx["anchor"] === "string" ? normUri(ctx["anchor"]) : null;
        return anchor === baseNorm;
      });
      const contexts = matchedCtxs.length > 0 ? matchedCtxs : allCtxs;
      for (const ctx of contexts) {
        for (const rel of ["describedby", "profile"]) {
          const targets = Array.isArray(ctx[rel]) ? ctx[rel] : [];
          for (const target of targets) {
            if (!target.href)
              continue;
            if (!shouldTryDeclaredType(target.type, hasDeclaredProfile2(target)))
              continue;
            const metaUrl = new URL(target.href, linksetUrl).toString();
            try {
              const metaRes = await fetchDescribedBy(metaUrl, target.type);
              if (!metaRes.ok)
                continue;
              const metaCt = baseMime(metaRes.headers.get("content-type"));
              const body = await metaRes.text();
              const format = resolveRdfFormat(metaCt, target.type, body);
              if (format) {
                return { content: body, format, source: this.source, url: metaUrl };
              }
            } catch {}
          }
        }
        const citeAsArr = Array.isArray(ctx["cite-as"]) ? ctx["cite-as"] : [];
        for (const citeAs of citeAsArr) {
          if (!citeAs.href)
            continue;
          const doiUrl = new URL(citeAs.href, linksetUrl).toString();
          try {
            const doiRes = await fetchRDF(doiUrl);
            if (!doiRes.ok)
              continue;
            const doiCt = baseMime(doiRes.headers.get("content-type"));
            if (isRDFMime(doiCt)) {
              return {
                content: await doiRes.text(),
                format: doiCt,
                source: this.source,
                url: doiUrl
              };
            }
          } catch {}
        }
      }
    } else if (ct === "application/linkset") {
      let text = await res.text();
      text = text.replace(/[\r\n\t]+/g, " ");
      const links = parseLinkHeader(text);
      const baseNorm = normUri(baseUri);
      for (const link of links) {
        if (link["anchor"] && normUri(link["anchor"]) !== baseNorm)
          continue;
        if ((link["rel"] === "describedby" || link["rel"] === "profile") && link["url"]) {
          const declaredType = link["type"];
          if (!shouldTryDeclaredType(declaredType, hasDeclaredProfile2(link)))
            continue;
          const metaUrl = new URL(link["url"], linksetUrl).toString();
          try {
            const metaRes = await fetchDescribedBy(metaUrl, declaredType);
            if (!metaRes.ok)
              continue;
            const metaCt = baseMime(metaRes.headers.get("content-type"));
            const body = await metaRes.text();
            const format = resolveRdfFormat(metaCt, declaredType, body);
            if (format) {
              return { content: body, format, source: this.source, url: metaUrl };
            }
          } catch {}
        }
      }
    }
    return null;
  }
  async _tryFetchAllFromLinkset(linksetUrl, baseUri) {
    const results = [];
    const acceptLinkset = "application/linkset+json;q=1.0, application/ld+json;q=0.9, application/linkset;q=0.8";
    let res;
    try {
      res = await fetchWithRedirect(linksetUrl, { headers: { Accept: acceptLinkset } });
      if (!res.ok)
        return results;
    } catch {
      return results;
    }
    const ct = baseMime(res.headers.get("content-type"));
    if (ct === "application/linkset+json" || ct === "application/json" || ct === "application/ld+json") {
      let data;
      try {
        data = await res.json();
      } catch {
        return results;
      }
      const typedData = data;
      if (!Array.isArray(typedData?.linkset))
        return results;
      const allCtxs = typedData.linkset;
      const baseNorm = normUri(baseUri);
      const matchedCtxs = allCtxs.filter((ctx) => {
        const anchor = typeof ctx["anchor"] === "string" ? normUri(ctx["anchor"]) : null;
        return anchor === baseNorm;
      });
      const contexts = matchedCtxs.length > 0 ? matchedCtxs : allCtxs;
      for (const ctx of contexts) {
        for (const rel of ["describedby", "profile"]) {
          const targets = Array.isArray(ctx[rel]) ? ctx[rel] : [];
          for (const target of targets) {
            if (!target.href)
              continue;
            if (!shouldTryDeclaredType(target.type, hasDeclaredProfile2(target)))
              continue;
            const metaUrl = new URL(target.href, linksetUrl).toString();
            try {
              const metaRes = await fetchDescribedBy(metaUrl, target.type);
              if (!metaRes.ok)
                continue;
              const metaCt = baseMime(metaRes.headers.get("content-type"));
              const body = await metaRes.text();
              const format = resolveRdfFormat(metaCt, target.type, body);
              if (format) {
                results.push({ content: body, format, source: this.source, url: metaUrl });
              }
            } catch {}
          }
        }
        const citeAsArr = Array.isArray(ctx["cite-as"]) ? ctx["cite-as"] : [];
        for (const citeAs of citeAsArr) {
          if (!citeAs.href)
            continue;
          const doiUrl = new URL(citeAs.href, linksetUrl).toString();
          try {
            const doiRes = await fetchRDF(doiUrl);
            if (!doiRes.ok)
              continue;
            const doiCt = baseMime(doiRes.headers.get("content-type"));
            if (isRDFMime(doiCt)) {
              results.push({
                content: await doiRes.text(),
                format: doiCt,
                source: this.source,
                url: doiUrl
              });
            }
          } catch {}
        }
      }
    } else if (ct === "application/linkset") {
      let text = await res.text();
      text = text.replace(/[\r\n\t]+/g, " ");
      const links = parseLinkHeader(text);
      const baseNorm = normUri(baseUri);
      for (const link of links) {
        if (link["anchor"] && normUri(link["anchor"]) !== baseNorm)
          continue;
        if ((link["rel"] === "describedby" || link["rel"] === "profile") && link["url"]) {
          const declaredType = link["type"];
          if (!shouldTryDeclaredType(declaredType, hasDeclaredProfile2(link)))
            continue;
          const metaUrl = new URL(link["url"], linksetUrl).toString();
          try {
            const metaRes = await fetchDescribedBy(metaUrl, declaredType);
            if (!metaRes.ok)
              continue;
            const metaCt = baseMime(metaRes.headers.get("content-type"));
            const body = await metaRes.text();
            const format = resolveRdfFormat(metaCt, declaredType, body);
            if (format) {
              results.push({ content: body, format, source: this.source, url: metaUrl });
            }
          } catch {}
        }
      }
    }
    return results;
  }
}
var linksetStrategy = new LinksetStrategy;
// src/strategies/html-signposting.ts
class HtmlSignpostingStrategy {
  label = "HTML link[rel=describedby]";
  source = "signposting-html-link";
  async executeFirstHit(ctx) {
    if (!ctx.bodyText)
      return null;
    const links = this._extractDescribedByLinks(ctx.bodyText, ctx.htmlDoc);
    for (const { href, type } of links) {
      if (!type || isRDFMime(type)) {
        const metaUrl = new URL(href, ctx.uri).toString();
        try {
          const res = await fetchRDF(metaUrl);
          const ct = baseMime(res.headers.get("content-type"));
          if (isRDFMime(ct) && res.ok) {
            return {
              content: await res.text(),
              format: ct,
              source: this.source,
              url: metaUrl
            };
          }
        } catch {}
      }
    }
    return null;
  }
  async executeAllHits(ctx) {
    const found = [];
    if (!ctx.bodyText)
      return found;
    const links = this._extractDescribedByLinks(ctx.bodyText, ctx.htmlDoc);
    for (const { href, type } of links) {
      if (!type || isRDFMime(type)) {
        const metaUrl = new URL(href, ctx.uri).toString();
        try {
          const res = await fetchRDF(metaUrl);
          const ct = baseMime(res.headers.get("content-type"));
          if (isRDFMime(ct) && res.ok) {
            found.push({
              content: await res.text(),
              format: ct,
              source: this.source,
              url: metaUrl
            });
          }
        } catch {}
      }
    }
    return found;
  }
  _extractDescribedByLinks(bodyText, htmlDoc) {
    const links = [];
    const seenUrls = new Set;
    if (htmlDoc) {
      try {
        for (const el of htmlDoc.querySelectorAll("link")) {
          const rel = el.getAttribute("rel");
          const href = el.getAttribute("href");
          const type = el.getAttribute("type");
          if (!href)
            continue;
          if (!relHasToken(rel, "describedby"))
            continue;
          if (!seenUrls.has(href)) {
            links.push({ href, type: type || null });
            seenUrls.add(href);
          }
        }
        return links;
      } catch {}
    }
    const linkRegex = /<link\b[^>]*>/gi;
    let match;
    while ((match = linkRegex.exec(bodyText)) !== null) {
      const tag = match[0] ?? "";
      if (!tag)
        continue;
      const relMatch = tag.match(/rel\s*=\s*["']?([^\s"'>;]+)/i);
      const hrefMatch = tag.match(/href\s*=\s*["']?([^\s"'>;]+)/i);
      const typeMatch = tag.match(/type\s*=\s*["']?([^\s"'>;]+)/i);
      const rel = relMatch?.[1];
      const href = hrefMatch?.[1];
      const type = typeMatch?.[1];
      if (!href || !rel)
        continue;
      if (!relHasToken(rel, "describedby"))
        continue;
      if (!seenUrls.has(href)) {
        links.push({ href, type: type || null });
        seenUrls.add(href);
      }
    }
    return links;
  }
}
var htmlSignpostingStrategy = new HtmlSignpostingStrategy;
// src/strategies/sitemap-signposting.ts
var SITEMAP_LINK_NAMESPACES = [
  { namespaceUri: "http://www.w3.org/1999/xhtml", localName: "link" },
  { namespaceUri: "http://www.openarchives.org/rs/terms/", localName: "ln" }
];
var SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
function shouldTryDeclaredType2(type, hasProfile) {
  const declaredType = (type ?? "").trim();
  if (!declaredType)
    return true;
  if (isRDFMime(declaredType))
    return true;
  return hasProfile;
}
function collectConfiguredLinkElements(urlEl) {
  const found = [];
  const seen = new Set;
  for (const { namespaceUri, localName } of SITEMAP_LINK_NAMESPACES) {
    for (const el of urlEl.getElementsByTagNameNS(namespaceUri, localName)) {
      if (!seen.has(el)) {
        seen.add(el);
        found.push(el);
      }
    }
  }
  return found;
}
function collectSitemapUrlElements(xmlDoc) {
  const found = [];
  const seen = new Set;
  for (const urlEl of xmlDoc.getElementsByTagName("url")) {
    if (!seen.has(urlEl)) {
      seen.add(urlEl);
      found.push(urlEl);
    }
  }
  for (const urlEl of xmlDoc.getElementsByTagNameNS(SITEMAP_NS, "url")) {
    if (!seen.has(urlEl)) {
      seen.add(urlEl);
      found.push(urlEl);
    }
  }
  return found;
}
function getLocElement(urlEl) {
  const plain = urlEl.getElementsByTagName("loc")[0];
  if (plain)
    return plain;
  const namespaced = urlEl.getElementsByTagNameNS(SITEMAP_NS, "loc")[0];
  return namespaced ?? null;
}
function parseSitemapEntriesFallback(xmlText) {
  const entries = [];
  const urlBlocks = xmlText.match(/<url\b[\s\S]*?<\/url>/gi) ?? [];
  const localNames = SITEMAP_LINK_NAMESPACES.map((cfg) => cfg.localName.toLowerCase());
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i);
    const loc = (locMatch?.[1] ?? "").trim();
    if (!loc)
      continue;
    const links = [];
    const linkTags = block.match(/<([a-zA-Z_][\w.-]*:)?([a-zA-Z_][\w.-]*)\b[^>]*\/?>/g) ?? [];
    for (const tagText of linkTags) {
      const localNameMatch = tagText.match(/^<([a-zA-Z_][\w.-]*:)?([a-zA-Z_][\w.-]*)/i);
      const localName = (localNameMatch?.[2] ?? "").toLowerCase();
      if (!localNames.includes(localName))
        continue;
      const attrs = parseTagAttributes(tagText);
      links.push({
        rel: attrs["rel"] ?? null,
        type: attrs["type"] ?? null,
        href: attrs["href"] ?? null,
        profile: attrs["profile"] ?? null
      });
    }
    entries.push({ loc, links });
  }
  return entries;
}

class SitemapSignpostingStrategy {
  label = "Sitemap signposting";
  source = "sitemap-signposting";
  async executeFirstHit(ctx) {
    return this._tryExtractFromSitemap(ctx.uri, true);
  }
  async executeAllHits(ctx) {
    return this._tryExtractFromSitemap(ctx.uri, false);
  }
  async _tryExtractFromSitemap(uri, firstHit) {
    const results = [];
    let urlObj;
    try {
      urlObj = new URL(uri);
    } catch {
      return firstHit ? null : results;
    }
    const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
    let robotsText;
    try {
      const res = await fetchWithRedirect(robotsUrl);
      if (!res.ok)
        return firstHit ? null : results;
      robotsText = await res.text();
    } catch {
      return firstHit ? null : results;
    }
    const sitemaps = [];
    for (const line of robotsText.split(`
`)) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith("sitemap:")) {
        const sUrl = trimmed.slice(8).trim();
        if (sUrl)
          sitemaps.push(sUrl);
      }
    }
    for (const sitemapUrl of sitemaps) {
      let sText;
      try {
        const res = await fetchWithRedirect(sitemapUrl);
        if (!res.ok)
          continue;
        sText = await res.text();
      } catch {
        continue;
      }
      const entries = [];
      if (typeof DOMParser !== "undefined") {
        try {
          const xmlDoc = new DOMParser().parseFromString(sText, "text/xml");
          if (xmlDoc.getElementsByTagName("parsererror").length > 0)
            continue;
          const urlElements = collectSitemapUrlElements(xmlDoc);
          for (const urlEl of urlElements) {
            const locEl = getLocElement(urlEl);
            const loc = locEl?.textContent?.trim();
            if (!loc)
              continue;
            const links = collectConfiguredLinkElements(urlEl).map((element) => ({
              rel: element.getAttribute("rel"),
              type: element.getAttribute("type"),
              href: element.getAttribute("href"),
              profile: element.getAttribute("profile")
            }));
            entries.push({ loc, links });
          }
        } catch {
          continue;
        }
      } else {
        entries.push(...parseSitemapEntriesFallback(sText));
      }
      for (const entry of entries) {
        const loc = entry.loc;
        if (loc !== uri && loc !== `${uri}/` && uri !== `${loc}/`)
          continue;
        const signpostingLinks = entry.links;
        for (const signpostingLink of signpostingLinks) {
          const relValues = splitRelValues(signpostingLink.rel).map((value) => value.toLowerCase());
          const type = signpostingLink.type;
          const href = signpostingLink.href;
          if (!href)
            continue;
          if (!relValues.includes("describedby") && !relValues.includes("profile"))
            continue;
          if (!shouldTryDeclaredType2(type, Boolean((signpostingLink.profile ?? "").trim())))
            continue;
          const metaUrl = new URL(href, sitemapUrl).toString();
          try {
            const metaRes = await fetchRDF(metaUrl);
            const metaCt = baseMime(metaRes.headers.get("content-type"));
            const body = await metaRes.text();
            const format = resolveRdfFormat(metaCt, type ?? undefined, body);
            if (format && metaRes.ok) {
              const rdf = {
                content: body,
                format,
                source: this.source,
                url: metaUrl
              };
              if (firstHit)
                return rdf;
              results.push(rdf);
            }
          } catch {}
        }
      }
    }
    return firstHit ? null : results;
  }
}
var sitemapSignpostingStrategy = new SitemapSignpostingStrategy;
// src/strategies/pipeline.ts
async function runHeadSignpostingPreflight(uri) {
  const linkHeader = await fetchHeadLinkHeader(uri);
  if (!linkHeader)
    return null;
  const headCtx = {
    uri,
    bodyText: "",
    linkHeader,
    htmlDoc: null
  };
  const headerHit = await linkHeaderStrategy.executeFirstHit(headCtx);
  if (headerHit)
    return headerHit;
  for (const linksetUrl of collectLinksetCandidates(uri, "", linkHeader)) {
    const linksetHit = await linksetStrategy.executeFirstHit({ ...headCtx, linksetUrl });
    if (linksetHit)
      return linksetHit;
  }
  return null;
}
async function buildStrategyContext(uri, allowHtmlFallbackAfterInitialRdf) {
  let bodyText = "";
  let linkHeader = null;
  let initialMime = "";
  let initialOk = false;
  let initialBody = "";
  try {
    const discovery = await fetchRDF(uri);
    linkHeader = discovery.headers.get("link");
    initialMime = baseMime(discovery.headers.get("content-type"));
    initialOk = discovery.ok;
    try {
      initialBody = await discovery.text();
      bodyText = initialOk && isRDFMime(initialMime) ? "" : initialBody;
    } catch {
      bodyText = "";
    }
  } catch {}
  if (!bodyText && (!initialOk || !isRDFMime(initialMime) || allowHtmlFallbackAfterInitialRdf)) {
    const fallback = await fetchHtmlFallback(uri);
    if (fallback.body) {
      bodyText = fallback.body;
      if (!linkHeader)
        linkHeader = fallback.linkHeader;
    }
  }
  let htmlDoc = null;
  if (bodyText) {
    try {
      if (typeof DOMParser !== "undefined") {
        htmlDoc = new DOMParser().parseFromString(bodyText, "text/html");
      }
    } catch {
      htmlDoc = null;
    }
  }
  return {
    uri,
    bodyText,
    linkHeader,
    htmlDoc,
    initialMime,
    initialOk,
    initialBody
  };
}
function collectLinksetCandidates(uri, bodyText, linkHeader) {
  const candidates = new Set;
  for (const candidate of linkHeaderStrategy.extractLinksetUrls(linkHeader, uri)) {
    candidates.add(candidate);
  }
  if (bodyText) {
    const htmlHints = extractHtmlHints(bodyText);
    for (const linkset of htmlHints.linksets) {
      try {
        candidates.add(new URL(linkset, uri).toString());
      } catch {}
    }
  }
  candidates.add(uri);
  return [...candidates];
}
async function probeContentNegotiation(uri) {
  const probes = [];
  const seenFormats = new Set;
  for (const mime of RDF_MIMES) {
    try {
      const res = await fetchWithRedirect(uri, { headers: { Accept: mime } });
      const responseMime = baseMime(res.headers.get("content-type"));
      const body = await res.text();
      const isRdf = res.ok && isRDFMime(responseMime);
      probes.push({
        requestedMime: mime,
        responseMime: responseMime || "(unknown)",
        chars: body.length,
        isRdf,
        url: res.url || uri,
        body
      });
      if (isRdf && !seenFormats.has(responseMime)) {
        seenFormats.add(responseMime);
      }
    } catch {}
  }
  return probes;
}
async function discoverFirstRdf(uri) {
  const headPreflightHit = await runHeadSignpostingPreflight(uri);
  if (headPreflightHit)
    return headPreflightHit;
  const ctx = await buildStrategyContext(uri, false);
  if (ctx.initialOk && isRDFMime(ctx.initialMime)) {
    return {
      content: ctx.initialBody,
      format: ctx.initialMime,
      source: "content-negotiation",
      url: uri
    };
  }
  const headerHit = await linkHeaderStrategy.executeFirstHit(ctx);
  if (headerHit)
    return headerHit;
  const htmlHit = await htmlSignpostingStrategy.executeFirstHit(ctx);
  if (htmlHit)
    return htmlHit;
  const embeddedHit = await embeddedScriptStrategy.executeFirstHit(ctx);
  if (embeddedHit)
    return embeddedHit;
  for (const linksetUrl of collectLinksetCandidates(uri, ctx.bodyText, ctx.linkHeader)) {
    const linksetHit = await linksetStrategy.executeFirstHit({ ...ctx, linksetUrl });
    if (linksetHit)
      return linksetHit;
  }
  return sitemapSignpostingStrategy.executeFirstHit(ctx);
}
async function discoverAllRdf(uri) {
  const ctx = await buildStrategyContext(uri, true);
  const found = [];
  const notFound = [];
  const contentNegotiations = await probeContentNegotiation(uri);
  const connegHits = [];
  for (const probe of contentNegotiations) {
    if (probe.isRdf) {
      const existing = connegHits.find((hit) => hit.format === probe.responseMime);
      if (!existing) {
        connegHits.push({
          content: probe.body,
          format: probe.responseMime,
          source: "content-negotiation",
          url: uri
        });
      }
    }
  }
  if (connegHits.length > 0) {
    found.push(...connegHits);
  } else {
    notFound.push("content-negotiation");
  }
  const headerHits = await linkHeaderStrategy.executeAllHits(ctx);
  if (headerHits.length > 0) {
    found.push(...headerHits);
  } else {
    notFound.push("signposting-link-header");
  }
  const linksetCandidates = collectLinksetCandidates(uri, ctx.bodyText, ctx.linkHeader);
  let linksetHits = [];
  for (const linksetUrl of linksetCandidates) {
    const hits = await linksetStrategy.executeAllHits({ ...ctx, linksetUrl });
    if (hits.length > 0) {
      linksetHits.push(...hits);
    }
  }
  if (linksetHits.length > 0) {
    found.push(...linksetHits);
  } else {
    notFound.push("linkset");
  }
  const htmlHits = await htmlSignpostingStrategy.executeAllHits(ctx);
  if (htmlHits.length > 0) {
    found.push(...htmlHits);
  } else {
    notFound.push("signposting-html-link");
  }
  const embeddedHits = await embeddedScriptStrategy.executeAllHits(ctx);
  if (embeddedHits.length > 0) {
    found.push(...embeddedHits);
  } else {
    notFound.push("embedded-script");
  }
  const sitemapHits = await sitemapSignpostingStrategy.executeAllHits(ctx);
  if (sitemapHits.length > 0) {
    found.push(...sitemapHits);
  } else {
    notFound.push("sitemap-signposting");
  }
  const trace = STRATEGY_ORDER.map((source, i) => {
    const hits = found.filter((item) => item.source === source);
    return {
      strategy: i + 1,
      source,
      label: source === "content-negotiation" ? "Content Negotiation" : source === "signposting-link-header" ? "HTTP Link header (rel=describedby)" : source === "linkset" ? "Linkset (rel=linkset)" : source === "signposting-html-link" ? "HTML link[rel=describedby]" : source === "embedded-script" ? "Embedded RDF script" : "Sitemap signposting (robots.txt)",
      found: hits.length > 0,
      hits: hits.map((hit) => ({
        format: hit.format,
        url: hit.url,
        chars: hit.content.length
      }))
    };
  });
  return { found, notFound, contentNegotiations, trace };
}

// wrx.ts
function parseCliArgs(args) {
  let allMode = false;
  let profileMode = false;
  let extendLinksMode = false;
  let url = null;
  for (const arg of args) {
    if (arg === "--all") {
      allMode = true;
      continue;
    }
    if (arg === "--profile") {
      profileMode = true;
      continue;
    }
    if (arg === "--extend-links") {
      extendLinksMode = true;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    if (!url) {
      url = arg;
      continue;
    }
    throw new Error(`Unexpected extra positional argument: ${arg}`);
  }
  return { allMode, profileMode, extendLinksMode, url };
}
function escapeLiteral(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
function renderRelForTurtle(rel) {
  return isAbsoluteUri(rel) ? `<${rel}>` : `"${escapeLiteral(rel)}"`;
}
function renderLinkRelationsJson(relations) {
  return JSON.stringify(relations.map((rel) => ({
    anchor: rel.anchor,
    rel: rel.rel,
    href: rel.href,
    origin: rel.origin,
    options: rel.options
  })), null, 2);
}
function renderLinkRelationsTurtle(relations) {
  const lines = ["@prefix xhtml: <http://www.w3.org/1999/xhtml>.", ""];
  for (const rel of relations) {
    lines.push("[] a xhtml:link;");
    lines.push(`   xhtml:anchor <${rel.anchor}>;`);
    lines.push(`   xhtml:rel ${renderRelForTurtle(rel.rel)};`);
    lines.push(`   xhtml:href <${rel.href}>;`);
    if (rel.options.length > 0) {
      const optionNodes = rel.options.map((opt) => {
        const optName = opt.name ?? opt.key ?? "";
        const optVal = opt.value ?? "";
        return `[ a xhtml:LinkOption;
       xhtml:optionKey "${escapeLiteral(optName)}";
       xhtml:optionVal "${escapeLiteral(optVal)}" ]`;
      });
      lines.push(`   xhtml:option ${optionNodes.join(`,
                `)}.`);
    } else {
      lines.push("   xhtml:option [].");
    }
    lines.push("");
  }
  return lines.join(`
`).trimEnd();
}
async function extractAllRDF(uri) {
  return discoverAllRdf(uri);
}
async function extractRDF(uri) {
  return discoverFirstRdf(uri);
}
async function extractLinkRelations(uri) {
  return collectLinkRelationsForUri(uri);
}
function collectProfileValues(relations) {
  const profiles = new Set;
  for (const relation of relations) {
    if (relation.rel === "profile") {
      profiles.add(relation.href);
    }
    for (const option of relation.options) {
      const optionName = (option.name ?? "").toLowerCase();
      const optionValue = (option.value ?? "").trim();
      if (optionName === "profile" && optionValue) {
        profiles.add(optionValue);
      }
    }
  }
  return [...profiles];
}
async function runWrxCli(args = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return;
  }
  const parsedArgs = parsed;
  const url = parsedArgs.url ?? null;
  const allMode = Boolean(parsedArgs.allMode);
  const profileMode = Boolean(parsedArgs.profileMode);
  const extendLinksMode = Boolean(parsedArgs.extendLinksMode);
  if (!url) {
    console.error("Usage: bun run wrx.js [--all] [--profile] [--extend-links] <URI>");
    return;
  }
  if (allMode) {
    const overview = await extractAllRDF(url);
    console.log(`\uD83D\uDD0D Extracting RDF from: ${url}`);
    console.log("");
    console.log("\uD83D\uDCCA Strategy Trace:");
    for (const step of overview.trace) {
      const hits = step.hits;
      const stratNum = step.strategy;
      const label = step.label;
      if (step.source === "content-negotiation") {
        const rdfHits = overview.contentNegotiations.filter((r) => r.isRdf);
        if (rdfHits.length > 0) {
          console.log(`  ✅ Strategy ${stratNum} — ${label} (${rdfHits.length} RDF format(s) found)`);
        } else {
          console.log(`  ❌ Strategy ${stratNum} — ${label}`);
        }
        const reqW = overview.contentNegotiations.length > 0 ? Math.max(...overview.contentNegotiations.map((r) => r.requestedMime.length), "Requested MIME".length) : "Requested MIME".length;
        const resW = overview.contentNegotiations.length > 0 ? Math.max(...overview.contentNegotiations.map((r) => r.responseMime.length), "Response MIME".length) : "Response MIME".length;
        console.log(`       ${"Requested MIME".padEnd(reqW)}  →  ${"Response MIME".padEnd(resW)}  Chars`);
        console.log(`       ${"─".repeat(reqW)}     ${"─".repeat(resW)}  ─────`);
        for (const cn of overview.contentNegotiations) {
          const flag = cn.isRdf ? "✅" : "❌";
          console.log(`       ${cn.requestedMime.padEnd(reqW)}  →  ${cn.responseMime.padEnd(resW)}  ${cn.chars.toLocaleString().padStart(7)}  ${flag}`);
        }
      } else if (hits.length > 0) {
        console.log(`  ✅ Strategy ${stratNum} — ${label}`);
        for (const hit of hits) {
          console.log(`       ${hit.format}  ${hit.url}  (${hit.chars} chars)`);
        }
      } else {
        console.log(`  ❌ Strategy ${stratNum} — ${label}`);
      }
    }
    console.log("");
    if (overview.contentNegotiations.length > 0) {
      console.log("\uD83D\uDCCB Content Negotiation Overview (all MIME types):");
      for (const cn of overview.contentNegotiations) {
        const flag = cn.isRdf ? "✅ RDF" : "❌ not RDF";
        console.log(`   ${cn.requestedMime.padEnd(26)} → ${cn.chars.toLocaleString().padStart(7)} chars  (${cn.responseMime})  ${flag}`);
      }
      console.log("");
    }
    if (overview.found.length > 0) {
      console.log(`\uD83D\uDCCA ${overview.found.length} unique RDF source(s) found across ${STRATEGY_ORDER.length} strategies tried.`);
    } else {
      console.log("\uD83D\uDCCA No RDF found after exploring all strategies.");
    }
  } else {
    console.log(`\uD83D\uDD0D Extracting RDF from: ${url}`);
    const result = await extractRDF(url);
    if (result) {
      console.log(`✅ Found RDF (${result.source}) from ${result.url}`);
      console.log(`Format: ${result.format}`);
      console.log(`Content length: ${result.content.length} chars`);
      console.log(`
--- First 500 chars of RDF ---`);
      console.log(result.content.slice(0, 500) + (result.content.length > 500 ? "..." : ""));
    } else {
      console.log("❌ No RDF found after trying all strategies.");
    }
  }
  if (extendLinksMode) {
    const relations = await collectLinkRelationsForUri(url);
    console.log("");
    console.log("\uD83D\uDD17 Extended Link Relations (JSON):");
    console.log(renderLinkRelationsJson(relations));
    console.log("");
    console.log("\uD83D\uDD17 Extended Link Relations (xhtml Turtle-like):");
    console.log(renderLinkRelationsTurtle(relations));
  }
  if (profileMode) {
    const relations = await collectLinkRelationsForUri(url);
    const profiles = collectProfileValues(relations);
    console.log("");
    console.log(`\uD83E\uDDEA Profiles discovered: ${profiles.length}`);
    if (profiles.length > 0) {
      for (const profile of profiles) {
        console.log(`   - ${profile}`);
      }
    }
  }
}
if (import.meta.main) {
  await runWrxCli();
}
export {
  runWrxCli,
  extractRDF,
  extractLinkRelations,
  extractAllRDF
};
