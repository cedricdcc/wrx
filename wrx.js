var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

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

// src/core/constants.ts
var STRATEGY_ORDER, RDF_MIMES, RDF_ACCEPT, RDF_MIME_SET;
var init_constants = __esm(() => {
  STRATEGY_ORDER = [
    "content-negotiation",
    "signposting-link-header",
    "linkset",
    "signposting-html-link",
    "embedded-script",
    "sitemap-signposting"
  ];
  RDF_MIMES = [
    "text/turtle",
    "application/ld+json",
    "application/rdf+xml",
    "application/n-triples",
    "application/n-quads",
    "application/trig",
    "text/n3"
  ];
  RDF_ACCEPT = RDF_MIMES.join(", ");
  RDF_MIME_SET = new Set(RDF_MIMES.map((m) => m.toLowerCase()));
});

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
var init_fetch = __esm(() => {
  init_constants();
});

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
var init_html_parser = () => {};

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
var init_link_parser = __esm(() => {
  init_fetch();
  init_html_parser();
});

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
          mime: ct,
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
            mime: ct,
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
var contentNegotiationStrategy;
var init_content_negotiation = __esm(() => {
  init_fetch();
  init_constants();
  contentNegotiationStrategy = new ContentNegotiationStrategy;
});

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
var init_mime = __esm(() => {
  init_constants();
});

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
            mime: format,
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
            mime: format,
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
var linkHeaderStrategy;
var init_link_header = __esm(() => {
  init_link_parser();
  init_fetch();
  init_mime();
  linkHeaderStrategy = new LinkHeaderStrategy;
});

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
          mime: type,
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
          mime: type,
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
var embeddedScriptStrategy;
var init_embedded_script = __esm(() => {
  embeddedScriptStrategy = new EmbeddedScriptStrategy;
});

// src/core/signposting.ts
function hasNonEmptyProfileAttribute(profile) {
  return Boolean((profile ?? "").trim());
}
function shouldAcceptDeclaredType(type, hasProfile) {
  const declaredType = (type ?? "").trim();
  if (!declaredType)
    return true;
  if (isRDFMime(declaredType))
    return true;
  return hasProfile;
}
var init_signposting = () => {};

// src/strategies/linkset.ts
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
            if (!shouldAcceptDeclaredType(target.type, hasNonEmptyProfileAttribute(target.profile)))
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
                return { content: body, mime: format, format, source: this.source, url: metaUrl };
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
                mime: doiCt,
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
          if (!shouldAcceptDeclaredType(declaredType, hasNonEmptyProfileAttribute(link["profile"])))
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
              return { content: body, mime: format, format, source: this.source, url: metaUrl };
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
            if (!shouldAcceptDeclaredType(target.type, hasNonEmptyProfileAttribute(target.profile)))
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
                results.push({ content: body, mime: format, format, source: this.source, url: metaUrl });
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
                mime: doiCt,
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
          if (!shouldAcceptDeclaredType(declaredType, hasNonEmptyProfileAttribute(link["profile"])))
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
              results.push({ content: body, mime: format, format, source: this.source, url: metaUrl });
            }
          } catch {}
        }
      }
    }
    return results;
  }
}
var linksetStrategy;
var init_linkset = __esm(() => {
  init_fetch();
  init_mime();
  init_signposting();
  init_link_parser();
  linksetStrategy = new LinksetStrategy;
});

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
              mime: ct,
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
              mime: ct,
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
var htmlSignpostingStrategy;
var init_html_signposting = __esm(() => {
  init_fetch();
  htmlSignpostingStrategy = new HtmlSignpostingStrategy;
});

// src/strategies/sitemap-signposting.ts
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
          if (!shouldAcceptDeclaredType(type, hasNonEmptyProfileAttribute(signpostingLink.profile)))
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
                mime: format,
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
var SITEMAP_LINK_NAMESPACES, SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9", sitemapSignpostingStrategy;
var init_sitemap_signposting = __esm(() => {
  init_fetch();
  init_mime();
  init_html_parser();
  init_signposting();
  SITEMAP_LINK_NAMESPACES = [
    { namespaceUri: "http://www.w3.org/1999/xhtml", localName: "link" },
    { namespaceUri: "http://www.openarchives.org/rs/terms/", localName: "ln" }
  ];
  sitemapSignpostingStrategy = new SitemapSignpostingStrategy;
});

// src/strategies/index.ts
var init_strategies = __esm(() => {
  init_content_negotiation();
  init_link_header();
  init_embedded_script();
  init_linkset();
  init_html_signposting();
  init_sitemap_signposting();
  init_constants();
});

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
      mime: ctx.initialMime,
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
          mime: probe.responseMime,
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
var init_pipeline = __esm(() => {
  init_constants();
  init_fetch();
  init_html_parser();
  init_strategies();
});

// src/cli/args.ts
function getCliUsage() {
  return USAGE;
}
function parseCliArgs(args) {
  let all = false;
  let extendLinks = false;
  let help = false;
  let output;
  let profile = false;
  let input;
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--extend-links") {
      extendLinks = true;
      continue;
    }
    if (arg === "--profile") {
      profile = true;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      const next = args[index + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("Missing value for --output");
      }
      output = next;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    if (!input) {
      input = arg;
      continue;
    }
    throw new Error(`Unexpected extra positional argument: ${arg}`);
  }
  return { all, extendLinks, help, input, output, profile };
}
var USAGE = `Usage: bun run wrx.js [options] <URI>

Options:
  -h, --help           Show this help message
  --all                Explore all extraction strategies
  --extend-links       Print modeled link relations
  --profile            Print discovered profile URIs
  -o, --output <path>  Write extracted RDF to a file

Examples:
  bun run wrx.js https://example.org/dataset
  bun run wrx.js --all --output output.ttl https://example.org/dataset
`;

// node:path
function assertPath(path) {
  if (typeof path !== "string")
    throw TypeError("Path must be a string. Received " + JSON.stringify(path));
}
function normalizeStringPosix(path, allowAboveRoot) {
  var res = "", lastSegmentLength = 0, lastSlash = -1, dots = 0, code;
  for (var i = 0;i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47)
      break;
    else
      code = 47;
    if (code === 47) {
      if (lastSlash === i - 1 || dots === 1)
        ;
      else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1)
                res = "", lastSegmentLength = 0;
              else
                res = res.slice(0, lastSlashIndex), lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
              lastSlash = i, dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = "", lastSegmentLength = 0, lastSlash = i, dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += "/..";
          else
            res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += "/" + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i, dots = 0;
    } else if (code === 46 && dots !== -1)
      ++dots;
    else
      dots = -1;
  }
  return res;
}
function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root, base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
  if (!dir)
    return base;
  if (dir === pathObject.root)
    return dir + base;
  return dir + sep + base;
}
function resolve() {
  var resolvedPath = "", resolvedAbsolute = false, cwd;
  for (var i = arguments.length - 1;i >= -1 && !resolvedAbsolute; i--) {
    var path;
    if (i >= 0)
      path = arguments[i];
    else {
      if (cwd === undefined)
        cwd = process.cwd();
      path = cwd;
    }
    if (assertPath(path), path.length === 0)
      continue;
    resolvedPath = path + "/" + resolvedPath, resolvedAbsolute = path.charCodeAt(0) === 47;
  }
  if (resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute), resolvedAbsolute)
    if (resolvedPath.length > 0)
      return "/" + resolvedPath;
    else
      return "/";
  else if (resolvedPath.length > 0)
    return resolvedPath;
  else
    return ".";
}
function normalize(path) {
  if (assertPath(path), path.length === 0)
    return ".";
  var isAbsolute = path.charCodeAt(0) === 47, trailingSeparator = path.charCodeAt(path.length - 1) === 47;
  if (path = normalizeStringPosix(path, !isAbsolute), path.length === 0 && !isAbsolute)
    path = ".";
  if (path.length > 0 && trailingSeparator)
    path += "/";
  if (isAbsolute)
    return "/" + path;
  return path;
}
function isAbsolute(path) {
  return assertPath(path), path.length > 0 && path.charCodeAt(0) === 47;
}
function join() {
  if (arguments.length === 0)
    return ".";
  var joined;
  for (var i = 0;i < arguments.length; ++i) {
    var arg = arguments[i];
    if (assertPath(arg), arg.length > 0)
      if (joined === undefined)
        joined = arg;
      else
        joined += "/" + arg;
  }
  if (joined === undefined)
    return ".";
  return normalize(joined);
}
function relative(from, to) {
  if (assertPath(from), assertPath(to), from === to)
    return "";
  if (from = resolve(from), to = resolve(to), from === to)
    return "";
  var fromStart = 1;
  for (;fromStart < from.length; ++fromStart)
    if (from.charCodeAt(fromStart) !== 47)
      break;
  var fromEnd = from.length, fromLen = fromEnd - fromStart, toStart = 1;
  for (;toStart < to.length; ++toStart)
    if (to.charCodeAt(toStart) !== 47)
      break;
  var toEnd = to.length, toLen = toEnd - toStart, length = fromLen < toLen ? fromLen : toLen, lastCommonSep = -1, i = 0;
  for (;i <= length; ++i) {
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === 47)
          return to.slice(toStart + i + 1);
        else if (i === 0)
          return to.slice(toStart + i);
      } else if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === 47)
          lastCommonSep = i;
        else if (i === 0)
          lastCommonSep = 0;
      }
      break;
    }
    var fromCode = from.charCodeAt(fromStart + i), toCode = to.charCodeAt(toStart + i);
    if (fromCode !== toCode)
      break;
    else if (fromCode === 47)
      lastCommonSep = i;
  }
  var out = "";
  for (i = fromStart + lastCommonSep + 1;i <= fromEnd; ++i)
    if (i === fromEnd || from.charCodeAt(i) === 47)
      if (out.length === 0)
        out += "..";
      else
        out += "/..";
  if (out.length > 0)
    return out + to.slice(toStart + lastCommonSep);
  else {
    if (toStart += lastCommonSep, to.charCodeAt(toStart) === 47)
      ++toStart;
    return to.slice(toStart);
  }
}
function _makeLong(path) {
  return path;
}
function dirname(path) {
  if (assertPath(path), path.length === 0)
    return ".";
  var code = path.charCodeAt(0), hasRoot = code === 47, end = -1, matchedSlash = true;
  for (var i = path.length - 1;i >= 1; --i)
    if (code = path.charCodeAt(i), code === 47) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else
      matchedSlash = false;
  if (end === -1)
    return hasRoot ? "/" : ".";
  if (hasRoot && end === 1)
    return "//";
  return path.slice(0, end);
}
function basename(path, ext) {
  if (ext !== undefined && typeof ext !== "string")
    throw TypeError('"ext" argument must be a string');
  assertPath(path);
  var start = 0, end = -1, matchedSlash = true, i;
  if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
    if (ext.length === path.length && ext === path)
      return "";
    var extIdx = ext.length - 1, firstNonSlashEnd = -1;
    for (i = path.length - 1;i >= 0; --i) {
      var code = path.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else {
        if (firstNonSlashEnd === -1)
          matchedSlash = false, firstNonSlashEnd = i + 1;
        if (extIdx >= 0)
          if (code === ext.charCodeAt(extIdx)) {
            if (--extIdx === -1)
              end = i;
          } else
            extIdx = -1, end = firstNonSlashEnd;
      }
    }
    if (start === end)
      end = firstNonSlashEnd;
    else if (end === -1)
      end = path.length;
    return path.slice(start, end);
  } else {
    for (i = path.length - 1;i >= 0; --i)
      if (path.charCodeAt(i) === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1)
        matchedSlash = false, end = i + 1;
    if (end === -1)
      return "";
    return path.slice(start, end);
  }
}
function extname(path) {
  assertPath(path);
  var startDot = -1, startPart = 0, end = -1, matchedSlash = true, preDotState = 0;
  for (var i = path.length - 1;i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1)
      matchedSlash = false, end = i + 1;
    if (code === 46) {
      if (startDot === -1)
        startDot = i;
      else if (preDotState !== 1)
        preDotState = 1;
    } else if (startDot !== -1)
      preDotState = -1;
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
    return "";
  return path.slice(startDot, end);
}
function format(pathObject) {
  if (pathObject === null || typeof pathObject !== "object")
    throw TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
  return _format("/", pathObject);
}
function parse(path) {
  assertPath(path);
  var ret = { root: "", dir: "", base: "", ext: "", name: "" };
  if (path.length === 0)
    return ret;
  var code = path.charCodeAt(0), isAbsolute2 = code === 47, start;
  if (isAbsolute2)
    ret.root = "/", start = 1;
  else
    start = 0;
  var startDot = -1, startPart = 0, end = -1, matchedSlash = true, i = path.length - 1, preDotState = 0;
  for (;i >= start; --i) {
    if (code = path.charCodeAt(i), code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1)
      matchedSlash = false, end = i + 1;
    if (code === 46) {
      if (startDot === -1)
        startDot = i;
      else if (preDotState !== 1)
        preDotState = 1;
    } else if (startDot !== -1)
      preDotState = -1;
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    if (end !== -1)
      if (startPart === 0 && isAbsolute2)
        ret.base = ret.name = path.slice(1, end);
      else
        ret.base = ret.name = path.slice(startPart, end);
  } else {
    if (startPart === 0 && isAbsolute2)
      ret.name = path.slice(1, startDot), ret.base = path.slice(1, end);
    else
      ret.name = path.slice(startPart, startDot), ret.base = path.slice(startPart, end);
    ret.ext = path.slice(startDot, end);
  }
  if (startPart > 0)
    ret.dir = path.slice(0, startPart - 1);
  else if (isAbsolute2)
    ret.dir = "/";
  return ret;
}
var sep = "/", delimiter = ":", posix;
var init_path = __esm(() => {
  posix = ((p) => (p.posix = p, p))({ resolve, normalize, isAbsolute, join, relative, _makeLong, dirname, basename, extname, format, parse, sep, delimiter, win32: null, posix: null });
});

// node:buffer
function getLens(b64) {
  var len2 = b64.length;
  if (len2 % 4 > 0)
    throw Error("Invalid string. Length must be a multiple of 4");
  var validLen = b64.indexOf("=");
  if (validLen === -1)
    validLen = len2;
  var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
  return [validLen, placeHoldersLen];
}
function _byteLength(validLen, placeHoldersLen) {
  return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
}
function toByteArray(b64) {
  var tmp, lens = getLens(b64), validLen = lens[0], placeHoldersLen = lens[1], arr = new Uint8Array(_byteLength(validLen, placeHoldersLen)), curByte = 0, len2 = placeHoldersLen > 0 ? validLen - 4 : validLen, i2;
  for (i2 = 0;i2 < len2; i2 += 4)
    tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)], arr[curByte++] = tmp >> 16 & 255, arr[curByte++] = tmp >> 8 & 255, arr[curByte++] = tmp & 255;
  if (placeHoldersLen === 2)
    tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4, arr[curByte++] = tmp & 255;
  if (placeHoldersLen === 1)
    tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2, arr[curByte++] = tmp >> 8 & 255, arr[curByte++] = tmp & 255;
  return arr;
}
function tripletToBase64(num) {
  return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
}
function encodeChunk(uint8, start, end) {
  var tmp, output = [];
  for (var i2 = start;i2 < end; i2 += 3)
    tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255), output.push(tripletToBase64(tmp));
  return output.join("");
}
function fromByteArray(uint8) {
  var tmp, len2 = uint8.length, extraBytes = len2 % 3, parts = [], maxChunkLength = 16383;
  for (var i2 = 0, len22 = len2 - extraBytes;i2 < len22; i2 += maxChunkLength)
    parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
  if (extraBytes === 1)
    tmp = uint8[len2 - 1], parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==");
  else if (extraBytes === 2)
    tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1], parts.push(lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "=");
  return parts.join("");
}
function read(buffer, offset, isLE, mLen, nBytes) {
  var e, m, eLen = nBytes * 8 - mLen - 1, eMax = (1 << eLen) - 1, eBias = eMax >> 1, nBits = -7, i2 = isLE ? nBytes - 1 : 0, d = isLE ? -1 : 1, s = buffer[offset + i2];
  i2 += d, e = s & (1 << -nBits) - 1, s >>= -nBits, nBits += eLen;
  for (;nBits > 0; e = e * 256 + buffer[offset + i2], i2 += d, nBits -= 8)
    ;
  m = e & (1 << -nBits) - 1, e >>= -nBits, nBits += mLen;
  for (;nBits > 0; m = m * 256 + buffer[offset + i2], i2 += d, nBits -= 8)
    ;
  if (e === 0)
    e = 1 - eBias;
  else if (e === eMax)
    return m ? NaN : (s ? -1 : 1) * (1 / 0);
  else
    m = m + Math.pow(2, mLen), e = e - eBias;
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
}
function write(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c, eLen = nBytes * 8 - mLen - 1, eMax = (1 << eLen) - 1, eBias = eMax >> 1, rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0, i2 = isLE ? 0 : nBytes - 1, d = isLE ? 1 : -1, s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
  if (value = Math.abs(value), isNaN(value) || value === 1 / 0)
    m = isNaN(value) ? 1 : 0, e = eMax;
  else {
    if (e = Math.floor(Math.log(value) / Math.LN2), value * (c = Math.pow(2, -e)) < 1)
      e--, c *= 2;
    if (e + eBias >= 1)
      value += rt / c;
    else
      value += rt * Math.pow(2, 1 - eBias);
    if (value * c >= 2)
      e++, c /= 2;
    if (e + eBias >= eMax)
      m = 0, e = eMax;
    else if (e + eBias >= 1)
      m = (value * c - 1) * Math.pow(2, mLen), e = e + eBias;
    else
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen), e = 0;
  }
  for (;mLen >= 8; buffer[offset + i2] = m & 255, i2 += d, m /= 256, mLen -= 8)
    ;
  e = e << mLen | m, eLen += mLen;
  for (;eLen > 0; buffer[offset + i2] = e & 255, i2 += d, e /= 256, eLen -= 8)
    ;
  buffer[offset + i2 - d] |= s * 128;
}
function createBuffer(length) {
  if (length > kMaxLength)
    throw RangeError('The value "' + length + '" is invalid for option "size"');
  let buf = new Uint8Array(length);
  return Object.setPrototypeOf(buf, Buffer.prototype), buf;
}
function E(sym, getMessage, Base) {
  return class extends Base {
    constructor() {
      super();
      Object.defineProperty(this, "message", { value: getMessage.apply(this, arguments), writable: true, configurable: true }), this.name = `${this.name} [${sym}]`, this.stack, delete this.name;
    }
    get code() {
      return sym;
    }
    set code(value) {
      Object.defineProperty(this, "code", { configurable: true, enumerable: true, value, writable: true });
    }
    toString() {
      return `${this.name} [${sym}]: ${this.message}`;
    }
  };
}
function Buffer(arg, encodingOrOffset, length) {
  if (typeof arg === "number") {
    if (typeof encodingOrOffset === "string")
      throw TypeError('The "string" argument must be of type string. Received type number');
    return allocUnsafe(arg);
  }
  return from(arg, encodingOrOffset, length);
}
function from(value, encodingOrOffset, length) {
  if (typeof value === "string")
    return fromString(value, encodingOrOffset);
  if (ArrayBuffer.isView(value))
    return fromArrayView(value);
  if (value == null)
    throw TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value);
  if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer))
    return fromArrayBuffer(value, encodingOrOffset, length);
  if (typeof SharedArrayBuffer < "u" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer)))
    return fromArrayBuffer(value, encodingOrOffset, length);
  if (typeof value === "number")
    throw TypeError('The "value" argument must not be of type number. Received type number');
  let valueOf = value.valueOf && value.valueOf();
  if (valueOf != null && valueOf !== value)
    return Buffer.from(valueOf, encodingOrOffset, length);
  let b = fromObject(value);
  if (b)
    return b;
  if (typeof Symbol < "u" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function")
    return Buffer.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
  throw TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value);
}
function assertSize(size) {
  if (typeof size !== "number")
    throw TypeError('"size" argument must be of type number');
  else if (size < 0)
    throw RangeError('The value "' + size + '" is invalid for option "size"');
}
function alloc(size, fill, encoding) {
  if (assertSize(size), size <= 0)
    return createBuffer(size);
  if (fill !== undefined)
    return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
  return createBuffer(size);
}
function allocUnsafe(size) {
  return assertSize(size), createBuffer(size < 0 ? 0 : checked(size) | 0);
}
function fromString(string, encoding) {
  if (typeof encoding !== "string" || encoding === "")
    encoding = "utf8";
  if (!Buffer.isEncoding(encoding))
    throw TypeError("Unknown encoding: " + encoding);
  let length = byteLength(string, encoding) | 0, buf = createBuffer(length), actual = buf.write(string, encoding);
  if (actual !== length)
    buf = buf.slice(0, actual);
  return buf;
}
function fromArrayLike(array) {
  let length = array.length < 0 ? 0 : checked(array.length) | 0, buf = createBuffer(length);
  for (let i2 = 0;i2 < length; i2 += 1)
    buf[i2] = array[i2] & 255;
  return buf;
}
function fromArrayView(arrayView) {
  if (isInstance(arrayView, Uint8Array)) {
    let copy = new Uint8Array(arrayView);
    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
  }
  return fromArrayLike(arrayView);
}
function fromArrayBuffer(array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset)
    throw RangeError('"offset" is outside of buffer bounds');
  if (array.byteLength < byteOffset + (length || 0))
    throw RangeError('"length" is outside of buffer bounds');
  let buf;
  if (byteOffset === undefined && length === undefined)
    buf = new Uint8Array(array);
  else if (length === undefined)
    buf = new Uint8Array(array, byteOffset);
  else
    buf = new Uint8Array(array, byteOffset, length);
  return Object.setPrototypeOf(buf, Buffer.prototype), buf;
}
function fromObject(obj) {
  if (Buffer.isBuffer(obj)) {
    let len2 = checked(obj.length) | 0, buf = createBuffer(len2);
    if (buf.length === 0)
      return buf;
    return obj.copy(buf, 0, 0, len2), buf;
  }
  if (obj.length !== undefined) {
    if (typeof obj.length !== "number" || Number.isNaN(obj.length))
      return createBuffer(0);
    return fromArrayLike(obj);
  }
  if (obj.type === "Buffer" && Array.isArray(obj.data))
    return fromArrayLike(obj.data);
}
function checked(length) {
  if (length >= kMaxLength)
    throw RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + kMaxLength.toString(16) + " bytes");
  return length | 0;
}
function byteLength(string, encoding) {
  if (Buffer.isBuffer(string))
    return string.length;
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer))
    return string.byteLength;
  if (typeof string !== "string")
    throw TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string);
  let len2 = string.length, mustMatch = arguments.length > 2 && arguments[2] === true;
  if (!mustMatch && len2 === 0)
    return 0;
  let loweredCase = false;
  for (;; )
    switch (encoding) {
      case "ascii":
      case "latin1":
      case "binary":
        return len2;
      case "utf8":
      case "utf-8":
        return utf8ToBytes(string).length;
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return len2 * 2;
      case "hex":
        return len2 >>> 1;
      case "base64":
        return base64ToBytes(string).length;
      default:
        if (loweredCase)
          return mustMatch ? -1 : utf8ToBytes(string).length;
        encoding = ("" + encoding).toLowerCase(), loweredCase = true;
    }
}
function slowToString(encoding, start, end) {
  let loweredCase = false;
  if (start === undefined || start < 0)
    start = 0;
  if (start > this.length)
    return "";
  if (end === undefined || end > this.length)
    end = this.length;
  if (end <= 0)
    return "";
  if (end >>>= 0, start >>>= 0, end <= start)
    return "";
  if (!encoding)
    encoding = "utf8";
  while (true)
    switch (encoding) {
      case "hex":
        return hexSlice(this, start, end);
      case "utf8":
      case "utf-8":
        return utf8Slice(this, start, end);
      case "ascii":
        return asciiSlice(this, start, end);
      case "latin1":
      case "binary":
        return latin1Slice(this, start, end);
      case "base64":
        return base64Slice(this, start, end);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return utf16leSlice(this, start, end);
      default:
        if (loweredCase)
          throw TypeError("Unknown encoding: " + encoding);
        encoding = (encoding + "").toLowerCase(), loweredCase = true;
    }
}
function swap(b, n, m) {
  let i2 = b[n];
  b[n] = b[m], b[m] = i2;
}
function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
  if (buffer.length === 0)
    return -1;
  if (typeof byteOffset === "string")
    encoding = byteOffset, byteOffset = 0;
  else if (byteOffset > 2147483647)
    byteOffset = 2147483647;
  else if (byteOffset < -2147483648)
    byteOffset = -2147483648;
  if (byteOffset = +byteOffset, Number.isNaN(byteOffset))
    byteOffset = dir ? 0 : buffer.length - 1;
  if (byteOffset < 0)
    byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length)
    if (dir)
      return -1;
    else
      byteOffset = buffer.length - 1;
  else if (byteOffset < 0)
    if (dir)
      byteOffset = 0;
    else
      return -1;
  if (typeof val === "string")
    val = Buffer.from(val, encoding);
  if (Buffer.isBuffer(val)) {
    if (val.length === 0)
      return -1;
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
  } else if (typeof val === "number") {
    if (val = val & 255, typeof Uint8Array.prototype.indexOf === "function")
      if (dir)
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
      else
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
  }
  throw TypeError("val must be string, number or Buffer");
}
function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
  let indexSize = 1, arrLength = arr.length, valLength = val.length;
  if (encoding !== undefined) {
    if (encoding = String(encoding).toLowerCase(), encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
      if (arr.length < 2 || val.length < 2)
        return -1;
      indexSize = 2, arrLength /= 2, valLength /= 2, byteOffset /= 2;
    }
  }
  function read2(buf, i3) {
    if (indexSize === 1)
      return buf[i3];
    else
      return buf.readUInt16BE(i3 * indexSize);
  }
  let i2;
  if (dir) {
    let foundIndex = -1;
    for (i2 = byteOffset;i2 < arrLength; i2++)
      if (read2(arr, i2) === read2(val, foundIndex === -1 ? 0 : i2 - foundIndex)) {
        if (foundIndex === -1)
          foundIndex = i2;
        if (i2 - foundIndex + 1 === valLength)
          return foundIndex * indexSize;
      } else {
        if (foundIndex !== -1)
          i2 -= i2 - foundIndex;
        foundIndex = -1;
      }
  } else {
    if (byteOffset + valLength > arrLength)
      byteOffset = arrLength - valLength;
    for (i2 = byteOffset;i2 >= 0; i2--) {
      let found = true;
      for (let j = 0;j < valLength; j++)
        if (read2(arr, i2 + j) !== read2(val, j)) {
          found = false;
          break;
        }
      if (found)
        return i2;
    }
  }
  return -1;
}
function hexWrite(buf, string, offset, length) {
  offset = Number(offset) || 0;
  let remaining = buf.length - offset;
  if (!length)
    length = remaining;
  else if (length = Number(length), length > remaining)
    length = remaining;
  let strLen = string.length;
  if (length > strLen / 2)
    length = strLen / 2;
  let i2;
  for (i2 = 0;i2 < length; ++i2) {
    let parsed = parseInt(string.substr(i2 * 2, 2), 16);
    if (Number.isNaN(parsed))
      return i2;
    buf[offset + i2] = parsed;
  }
  return i2;
}
function utf8Write(buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
}
function asciiWrite(buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length);
}
function base64Write(buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length);
}
function ucs2Write(buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
}
function base64Slice(buf, start, end) {
  if (start === 0 && end === buf.length)
    return fromByteArray(buf);
  else
    return fromByteArray(buf.slice(start, end));
}
function utf8Slice(buf, start, end) {
  end = Math.min(buf.length, end);
  let res = [], i2 = start;
  while (i2 < end) {
    let firstByte = buf[i2], codePoint = null, bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
    if (i2 + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint;
      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 128)
            codePoint = firstByte;
          break;
        case 2:
          if (secondByte = buf[i2 + 1], (secondByte & 192) === 128) {
            if (tempCodePoint = (firstByte & 31) << 6 | secondByte & 63, tempCodePoint > 127)
              codePoint = tempCodePoint;
          }
          break;
        case 3:
          if (secondByte = buf[i2 + 1], thirdByte = buf[i2 + 2], (secondByte & 192) === 128 && (thirdByte & 192) === 128) {
            if (tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63, tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343))
              codePoint = tempCodePoint;
          }
          break;
        case 4:
          if (secondByte = buf[i2 + 1], thirdByte = buf[i2 + 2], fourthByte = buf[i2 + 3], (secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
            if (tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63, tempCodePoint > 65535 && tempCodePoint < 1114112)
              codePoint = tempCodePoint;
          }
      }
    }
    if (codePoint === null)
      codePoint = 65533, bytesPerSequence = 1;
    else if (codePoint > 65535)
      codePoint -= 65536, res.push(codePoint >>> 10 & 1023 | 55296), codePoint = 56320 | codePoint & 1023;
    res.push(codePoint), i2 += bytesPerSequence;
  }
  return decodeCodePointsArray(res);
}
function decodeCodePointsArray(codePoints) {
  let len2 = codePoints.length;
  if (len2 <= MAX_ARGUMENTS_LENGTH)
    return String.fromCharCode.apply(String, codePoints);
  let res = "", i2 = 0;
  while (i2 < len2)
    res += String.fromCharCode.apply(String, codePoints.slice(i2, i2 += MAX_ARGUMENTS_LENGTH));
  return res;
}
function asciiSlice(buf, start, end) {
  let ret = "";
  end = Math.min(buf.length, end);
  for (let i2 = start;i2 < end; ++i2)
    ret += String.fromCharCode(buf[i2] & 127);
  return ret;
}
function latin1Slice(buf, start, end) {
  let ret = "";
  end = Math.min(buf.length, end);
  for (let i2 = start;i2 < end; ++i2)
    ret += String.fromCharCode(buf[i2]);
  return ret;
}
function hexSlice(buf, start, end) {
  let len2 = buf.length;
  if (!start || start < 0)
    start = 0;
  if (!end || end < 0 || end > len2)
    end = len2;
  let out = "";
  for (let i2 = start;i2 < end; ++i2)
    out += hexSliceLookupTable[buf[i2]];
  return out;
}
function utf16leSlice(buf, start, end) {
  let bytes = buf.slice(start, end), res = "";
  for (let i2 = 0;i2 < bytes.length - 1; i2 += 2)
    res += String.fromCharCode(bytes[i2] + bytes[i2 + 1] * 256);
  return res;
}
function checkOffset(offset, ext, length) {
  if (offset % 1 !== 0 || offset < 0)
    throw RangeError("offset is not uint");
  if (offset + ext > length)
    throw RangeError("Trying to access beyond buffer length");
}
function checkInt(buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf))
    throw TypeError('"buffer" argument must be a Buffer instance');
  if (value > max || value < min)
    throw RangeError('"value" argument is out of bounds');
  if (offset + ext > buf.length)
    throw RangeError("Index out of range");
}
function wrtBigUInt64LE(buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);
  let lo = Number(value & BigInt(4294967295));
  buf[offset++] = lo, lo = lo >> 8, buf[offset++] = lo, lo = lo >> 8, buf[offset++] = lo, lo = lo >> 8, buf[offset++] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(4294967295));
  return buf[offset++] = hi, hi = hi >> 8, buf[offset++] = hi, hi = hi >> 8, buf[offset++] = hi, hi = hi >> 8, buf[offset++] = hi, offset;
}
function wrtBigUInt64BE(buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);
  let lo = Number(value & BigInt(4294967295));
  buf[offset + 7] = lo, lo = lo >> 8, buf[offset + 6] = lo, lo = lo >> 8, buf[offset + 5] = lo, lo = lo >> 8, buf[offset + 4] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(4294967295));
  return buf[offset + 3] = hi, hi = hi >> 8, buf[offset + 2] = hi, hi = hi >> 8, buf[offset + 1] = hi, hi = hi >> 8, buf[offset] = hi, offset + 8;
}
function checkIEEE754(buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length)
    throw RangeError("Index out of range");
  if (offset < 0)
    throw RangeError("Index out of range");
}
function writeFloat(buf, value, offset, littleEndian, noAssert) {
  if (value = +value, offset = offset >>> 0, !noAssert)
    checkIEEE754(buf, value, offset, 4, 340282346638528860000000000000000000000, -340282346638528860000000000000000000000);
  return write(buf, value, offset, littleEndian, 23, 4), offset + 4;
}
function writeDouble(buf, value, offset, littleEndian, noAssert) {
  if (value = +value, offset = offset >>> 0, !noAssert)
    checkIEEE754(buf, value, offset, 8, 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000, -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000);
  return write(buf, value, offset, littleEndian, 52, 8), offset + 8;
}
function addNumericalSeparator(val) {
  let res = "", i2 = val.length, start = val[0] === "-" ? 1 : 0;
  for (;i2 >= start + 4; i2 -= 3)
    res = `_${val.slice(i2 - 3, i2)}${res}`;
  return `${val.slice(0, i2)}${res}`;
}
function checkBounds(buf, offset, byteLength2) {
  if (validateNumber(offset, "offset"), buf[offset] === undefined || buf[offset + byteLength2] === undefined)
    boundsError(offset, buf.length - (byteLength2 + 1));
}
function checkIntBI(value, min, max, buf, offset, byteLength2) {
  if (value > max || value < min) {
    let n = typeof min === "bigint" ? "n" : "", range;
    if (byteLength2 > 3)
      if (min === 0 || min === BigInt(0))
        range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
      else
        range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
    else
      range = `>= ${min}${n} and <= ${max}${n}`;
    throw new ERR_OUT_OF_RANGE("value", range, value);
  }
  checkBounds(buf, offset, byteLength2);
}
function validateNumber(value, name) {
  if (typeof value !== "number")
    throw new ERR_INVALID_ARG_TYPE(name, "number", value);
}
function boundsError(value, length, type) {
  if (Math.floor(value) !== value)
    throw validateNumber(value, type), new ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
  if (length < 0)
    throw new ERR_BUFFER_OUT_OF_BOUNDS;
  throw new ERR_OUT_OF_RANGE(type || "offset", `>= ${type ? 1 : 0} and <= ${length}`, value);
}
function base64clean(str) {
  if (str = str.split("=")[0], str = str.trim().replace(INVALID_BASE64_RE, ""), str.length < 2)
    return "";
  while (str.length % 4 !== 0)
    str = str + "=";
  return str;
}
function utf8ToBytes(string, units) {
  units = units || 1 / 0;
  let codePoint, length = string.length, leadSurrogate = null, bytes = [];
  for (let i2 = 0;i2 < length; ++i2) {
    if (codePoint = string.charCodeAt(i2), codePoint > 55295 && codePoint < 57344) {
      if (!leadSurrogate) {
        if (codePoint > 56319) {
          if ((units -= 3) > -1)
            bytes.push(239, 191, 189);
          continue;
        } else if (i2 + 1 === length) {
          if ((units -= 3) > -1)
            bytes.push(239, 191, 189);
          continue;
        }
        leadSurrogate = codePoint;
        continue;
      }
      if (codePoint < 56320) {
        if ((units -= 3) > -1)
          bytes.push(239, 191, 189);
        leadSurrogate = codePoint;
        continue;
      }
      codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
    } else if (leadSurrogate) {
      if ((units -= 3) > -1)
        bytes.push(239, 191, 189);
    }
    if (leadSurrogate = null, codePoint < 128) {
      if ((units -= 1) < 0)
        break;
      bytes.push(codePoint);
    } else if (codePoint < 2048) {
      if ((units -= 2) < 0)
        break;
      bytes.push(codePoint >> 6 | 192, codePoint & 63 | 128);
    } else if (codePoint < 65536) {
      if ((units -= 3) < 0)
        break;
      bytes.push(codePoint >> 12 | 224, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
    } else if (codePoint < 1114112) {
      if ((units -= 4) < 0)
        break;
      bytes.push(codePoint >> 18 | 240, codePoint >> 12 & 63 | 128, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
    } else
      throw Error("Invalid code point");
  }
  return bytes;
}
function asciiToBytes(str) {
  let byteArray = [];
  for (let i2 = 0;i2 < str.length; ++i2)
    byteArray.push(str.charCodeAt(i2) & 255);
  return byteArray;
}
function utf16leToBytes(str, units) {
  let c, hi, lo, byteArray = [];
  for (let i2 = 0;i2 < str.length; ++i2) {
    if ((units -= 2) < 0)
      break;
    c = str.charCodeAt(i2), hi = c >> 8, lo = c % 256, byteArray.push(lo), byteArray.push(hi);
  }
  return byteArray;
}
function base64ToBytes(str) {
  return toByteArray(base64clean(str));
}
function blitBuffer(src, dst, offset, length) {
  let i2;
  for (i2 = 0;i2 < length; ++i2) {
    if (i2 + offset >= dst.length || i2 >= src.length)
      break;
    dst[i2 + offset] = src[i2];
  }
  return i2;
}
function isInstance(obj, type) {
  return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
}
function defineBigIntMethod(fn) {
  return typeof BigInt > "u" ? BufferBigIntNotDefined : fn;
}
function BufferBigIntNotDefined() {
  throw Error("BigInt not supported");
}
function notimpl(name) {
  return () => {
    throw Error(name + " is not implemented for node:buffer browser polyfill");
  };
}
var lookup, revLookup, code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", i, len, customInspectSymbol, INSPECT_MAX_BYTES = 50, kMaxLength = 2147483647, btoa, atob, File, Blob, ERR_BUFFER_OUT_OF_BOUNDS, ERR_INVALID_ARG_TYPE, ERR_OUT_OF_RANGE, MAX_ARGUMENTS_LENGTH = 4096, INVALID_BASE64_RE, hexSliceLookupTable, resolveObjectURL, isUtf8, transcode;
var init_buffer = __esm(() => {
  lookup = [];
  revLookup = [];
  for (i = 0, len = code.length;i < len; ++i)
    lookup[i] = code[i], revLookup[code.charCodeAt(i)] = i;
  revLookup[45] = 62;
  revLookup[95] = 63;
  customInspectSymbol = typeof Symbol === "function" && typeof Symbol.for === "function" ? Symbol.for("nodejs.util.inspect.custom") : null;
  btoa = globalThis.btoa;
  atob = globalThis.atob;
  File = globalThis.File;
  Blob = globalThis.Blob;
  ERR_BUFFER_OUT_OF_BOUNDS = E("ERR_BUFFER_OUT_OF_BOUNDS", function(name) {
    if (name)
      return `${name} is outside of buffer bounds`;
    return "Attempt to access memory outside buffer bounds";
  }, RangeError);
  ERR_INVALID_ARG_TYPE = E("ERR_INVALID_ARG_TYPE", function(name, actual) {
    return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
  }, TypeError);
  ERR_OUT_OF_RANGE = E("ERR_OUT_OF_RANGE", function(str, range, input) {
    let msg = `The value of "${str}" is out of range.`, received = input;
    if (Number.isInteger(input) && Math.abs(input) > 4294967296)
      received = addNumericalSeparator(String(input));
    else if (typeof input === "bigint") {
      if (received = String(input), input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32)))
        received = addNumericalSeparator(received);
      received += "n";
    }
    return msg += ` It must be ${range}. Received ${received}`, msg;
  }, RangeError);
  Object.defineProperty(Buffer.prototype, "parent", { enumerable: true, get: function() {
    if (!Buffer.isBuffer(this))
      return;
    return this.buffer;
  } });
  Object.defineProperty(Buffer.prototype, "offset", { enumerable: true, get: function() {
    if (!Buffer.isBuffer(this))
      return;
    return this.byteOffset;
  } });
  Buffer.poolSize = 8192;
  Buffer.from = function(value, encodingOrOffset, length) {
    return from(value, encodingOrOffset, length);
  };
  Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
  Object.setPrototypeOf(Buffer, Uint8Array);
  Buffer.alloc = function(size, fill, encoding) {
    return alloc(size, fill, encoding);
  };
  Buffer.allocUnsafe = function(size) {
    return allocUnsafe(size);
  };
  Buffer.allocUnsafeSlow = function(size) {
    return allocUnsafe(size);
  };
  Buffer.isBuffer = function(b) {
    return b != null && b._isBuffer === true && b !== Buffer.prototype;
  };
  Buffer.compare = function(a, b) {
    if (isInstance(a, Uint8Array))
      a = Buffer.from(a, a.offset, a.byteLength);
    if (isInstance(b, Uint8Array))
      b = Buffer.from(b, b.offset, b.byteLength);
    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
      throw TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
    if (a === b)
      return 0;
    let x = a.length, y = b.length;
    for (let i2 = 0, len2 = Math.min(x, y);i2 < len2; ++i2)
      if (a[i2] !== b[i2]) {
        x = a[i2], y = b[i2];
        break;
      }
    if (x < y)
      return -1;
    if (y < x)
      return 1;
    return 0;
  };
  Buffer.isEncoding = function(encoding) {
    switch (String(encoding).toLowerCase()) {
      case "hex":
      case "utf8":
      case "utf-8":
      case "ascii":
      case "latin1":
      case "binary":
      case "base64":
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return true;
      default:
        return false;
    }
  };
  Buffer.concat = function(list, length) {
    if (!Array.isArray(list))
      throw TypeError('"list" argument must be an Array of Buffers');
    if (list.length === 0)
      return Buffer.alloc(0);
    let i2;
    if (length === undefined) {
      length = 0;
      for (i2 = 0;i2 < list.length; ++i2)
        length += list[i2].length;
    }
    let buffer = Buffer.allocUnsafe(length), pos = 0;
    for (i2 = 0;i2 < list.length; ++i2) {
      let buf = list[i2];
      if (isInstance(buf, Uint8Array))
        if (pos + buf.length > buffer.length) {
          if (!Buffer.isBuffer(buf))
            buf = Buffer.from(buf);
          buf.copy(buffer, pos);
        } else
          Uint8Array.prototype.set.call(buffer, buf, pos);
      else if (!Buffer.isBuffer(buf))
        throw TypeError('"list" argument must be an Array of Buffers');
      else
        buf.copy(buffer, pos);
      pos += buf.length;
    }
    return buffer;
  };
  Buffer.byteLength = byteLength;
  Buffer.prototype._isBuffer = true;
  Buffer.prototype.swap16 = function() {
    let len2 = this.length;
    if (len2 % 2 !== 0)
      throw RangeError("Buffer size must be a multiple of 16-bits");
    for (let i2 = 0;i2 < len2; i2 += 2)
      swap(this, i2, i2 + 1);
    return this;
  };
  Buffer.prototype.swap32 = function() {
    let len2 = this.length;
    if (len2 % 4 !== 0)
      throw RangeError("Buffer size must be a multiple of 32-bits");
    for (let i2 = 0;i2 < len2; i2 += 4)
      swap(this, i2, i2 + 3), swap(this, i2 + 1, i2 + 2);
    return this;
  };
  Buffer.prototype.swap64 = function() {
    let len2 = this.length;
    if (len2 % 8 !== 0)
      throw RangeError("Buffer size must be a multiple of 64-bits");
    for (let i2 = 0;i2 < len2; i2 += 8)
      swap(this, i2, i2 + 7), swap(this, i2 + 1, i2 + 6), swap(this, i2 + 2, i2 + 5), swap(this, i2 + 3, i2 + 4);
    return this;
  };
  Buffer.prototype.toString = function() {
    let length = this.length;
    if (length === 0)
      return "";
    if (arguments.length === 0)
      return utf8Slice(this, 0, length);
    return slowToString.apply(this, arguments);
  };
  Buffer.prototype.toLocaleString = Buffer.prototype.toString;
  Buffer.prototype.equals = function(b) {
    if (!Buffer.isBuffer(b))
      throw TypeError("Argument must be a Buffer");
    if (this === b)
      return true;
    return Buffer.compare(this, b) === 0;
  };
  Buffer.prototype.inspect = function() {
    let str = "", max = INSPECT_MAX_BYTES;
    if (str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim(), this.length > max)
      str += " ... ";
    return "<Buffer " + str + ">";
  };
  if (customInspectSymbol)
    Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect;
  Buffer.prototype.compare = function(target, start, end, thisStart, thisEnd) {
    if (isInstance(target, Uint8Array))
      target = Buffer.from(target, target.offset, target.byteLength);
    if (!Buffer.isBuffer(target))
      throw TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target);
    if (start === undefined)
      start = 0;
    if (end === undefined)
      end = target ? target.length : 0;
    if (thisStart === undefined)
      thisStart = 0;
    if (thisEnd === undefined)
      thisEnd = this.length;
    if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length)
      throw RangeError("out of range index");
    if (thisStart >= thisEnd && start >= end)
      return 0;
    if (thisStart >= thisEnd)
      return -1;
    if (start >= end)
      return 1;
    if (start >>>= 0, end >>>= 0, thisStart >>>= 0, thisEnd >>>= 0, this === target)
      return 0;
    let x = thisEnd - thisStart, y = end - start, len2 = Math.min(x, y), thisCopy = this.slice(thisStart, thisEnd), targetCopy = target.slice(start, end);
    for (let i2 = 0;i2 < len2; ++i2)
      if (thisCopy[i2] !== targetCopy[i2]) {
        x = thisCopy[i2], y = targetCopy[i2];
        break;
      }
    if (x < y)
      return -1;
    if (y < x)
      return 1;
    return 0;
  };
  Buffer.prototype.includes = function(val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1;
  };
  Buffer.prototype.indexOf = function(val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
  };
  Buffer.prototype.lastIndexOf = function(val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
  };
  Buffer.prototype.write = function(string, offset, length, encoding) {
    if (offset === undefined)
      encoding = "utf8", length = this.length, offset = 0;
    else if (length === undefined && typeof offset === "string")
      encoding = offset, length = this.length, offset = 0;
    else if (isFinite(offset))
      if (offset = offset >>> 0, isFinite(length)) {
        if (length = length >>> 0, encoding === undefined)
          encoding = "utf8";
      } else
        encoding = length, length = undefined;
    else
      throw Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
    let remaining = this.length - offset;
    if (length === undefined || length > remaining)
      length = remaining;
    if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length)
      throw RangeError("Attempt to write outside buffer bounds");
    if (!encoding)
      encoding = "utf8";
    let loweredCase = false;
    for (;; )
      switch (encoding) {
        case "hex":
          return hexWrite(this, string, offset, length);
        case "utf8":
        case "utf-8":
          return utf8Write(this, string, offset, length);
        case "ascii":
        case "latin1":
        case "binary":
          return asciiWrite(this, string, offset, length);
        case "base64":
          return base64Write(this, string, offset, length);
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return ucs2Write(this, string, offset, length);
        default:
          if (loweredCase)
            throw TypeError("Unknown encoding: " + encoding);
          encoding = ("" + encoding).toLowerCase(), loweredCase = true;
      }
  };
  Buffer.prototype.toJSON = function() {
    return { type: "Buffer", data: Array.prototype.slice.call(this._arr || this, 0) };
  };
  Buffer.prototype.slice = function(start, end) {
    let len2 = this.length;
    if (start = ~~start, end = end === undefined ? len2 : ~~end, start < 0) {
      if (start += len2, start < 0)
        start = 0;
    } else if (start > len2)
      start = len2;
    if (end < 0) {
      if (end += len2, end < 0)
        end = 0;
    } else if (end > len2)
      end = len2;
    if (end < start)
      end = start;
    let newBuf = this.subarray(start, end);
    return Object.setPrototypeOf(newBuf, Buffer.prototype), newBuf;
  };
  Buffer.prototype.readUintLE = Buffer.prototype.readUIntLE = function(offset, byteLength2, noAssert) {
    if (offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert)
      checkOffset(offset, byteLength2, this.length);
    let val = this[offset], mul = 1, i2 = 0;
    while (++i2 < byteLength2 && (mul *= 256))
      val += this[offset + i2] * mul;
    return val;
  };
  Buffer.prototype.readUintBE = Buffer.prototype.readUIntBE = function(offset, byteLength2, noAssert) {
    if (offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert)
      checkOffset(offset, byteLength2, this.length);
    let val = this[offset + --byteLength2], mul = 1;
    while (byteLength2 > 0 && (mul *= 256))
      val += this[offset + --byteLength2] * mul;
    return val;
  };
  Buffer.prototype.readUint8 = Buffer.prototype.readUInt8 = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 1, this.length);
    return this[offset];
  };
  Buffer.prototype.readUint16LE = Buffer.prototype.readUInt16LE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 2, this.length);
    return this[offset] | this[offset + 1] << 8;
  };
  Buffer.prototype.readUint16BE = Buffer.prototype.readUInt16BE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 2, this.length);
    return this[offset] << 8 | this[offset + 1];
  };
  Buffer.prototype.readUint32LE = Buffer.prototype.readUInt32LE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
  };
  Buffer.prototype.readUint32BE = Buffer.prototype.readUInt32BE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
  };
  Buffer.prototype.readBigUInt64LE = defineBigIntMethod(function(offset) {
    offset = offset >>> 0, validateNumber(offset, "offset");
    let first = this[offset], last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);
    let lo = first + this[++offset] * 256 + this[++offset] * 65536 + this[++offset] * 16777216, hi = this[++offset] + this[++offset] * 256 + this[++offset] * 65536 + last * 16777216;
    return BigInt(lo) + (BigInt(hi) << BigInt(32));
  });
  Buffer.prototype.readBigUInt64BE = defineBigIntMethod(function(offset) {
    offset = offset >>> 0, validateNumber(offset, "offset");
    let first = this[offset], last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);
    let hi = first * 16777216 + this[++offset] * 65536 + this[++offset] * 256 + this[++offset], lo = this[++offset] * 16777216 + this[++offset] * 65536 + this[++offset] * 256 + last;
    return (BigInt(hi) << BigInt(32)) + BigInt(lo);
  });
  Buffer.prototype.readIntLE = function(offset, byteLength2, noAssert) {
    if (offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert)
      checkOffset(offset, byteLength2, this.length);
    let val = this[offset], mul = 1, i2 = 0;
    while (++i2 < byteLength2 && (mul *= 256))
      val += this[offset + i2] * mul;
    if (mul *= 128, val >= mul)
      val -= Math.pow(2, 8 * byteLength2);
    return val;
  };
  Buffer.prototype.readIntBE = function(offset, byteLength2, noAssert) {
    if (offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert)
      checkOffset(offset, byteLength2, this.length);
    let i2 = byteLength2, mul = 1, val = this[offset + --i2];
    while (i2 > 0 && (mul *= 256))
      val += this[offset + --i2] * mul;
    if (mul *= 128, val >= mul)
      val -= Math.pow(2, 8 * byteLength2);
    return val;
  };
  Buffer.prototype.readInt8 = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 1, this.length);
    if (!(this[offset] & 128))
      return this[offset];
    return (255 - this[offset] + 1) * -1;
  };
  Buffer.prototype.readInt16LE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 2, this.length);
    let val = this[offset] | this[offset + 1] << 8;
    return val & 32768 ? val | 4294901760 : val;
  };
  Buffer.prototype.readInt16BE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 2, this.length);
    let val = this[offset + 1] | this[offset] << 8;
    return val & 32768 ? val | 4294901760 : val;
  };
  Buffer.prototype.readInt32LE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
  };
  Buffer.prototype.readInt32BE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
  };
  Buffer.prototype.readBigInt64LE = defineBigIntMethod(function(offset) {
    offset = offset >>> 0, validateNumber(offset, "offset");
    let first = this[offset], last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);
    let val = this[offset + 4] + this[offset + 5] * 256 + this[offset + 6] * 65536 + (last << 24);
    return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 256 + this[++offset] * 65536 + this[++offset] * 16777216);
  });
  Buffer.prototype.readBigInt64BE = defineBigIntMethod(function(offset) {
    offset = offset >>> 0, validateNumber(offset, "offset");
    let first = this[offset], last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);
    let val = (first << 24) + this[++offset] * 65536 + this[++offset] * 256 + this[++offset];
    return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 16777216 + this[++offset] * 65536 + this[++offset] * 256 + last);
  });
  Buffer.prototype.readFloatLE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return read(this, offset, true, 23, 4);
  };
  Buffer.prototype.readFloatBE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return read(this, offset, false, 23, 4);
  };
  Buffer.prototype.readDoubleLE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 8, this.length);
    return read(this, offset, true, 52, 8);
  };
  Buffer.prototype.readDoubleBE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 8, this.length);
    return read(this, offset, false, 52, 8);
  };
  Buffer.prototype.writeUintLE = Buffer.prototype.writeUIntLE = function(value, offset, byteLength2, noAssert) {
    if (value = +value, offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert) {
      let maxBytes = Math.pow(2, 8 * byteLength2) - 1;
      checkInt(this, value, offset, byteLength2, maxBytes, 0);
    }
    let mul = 1, i2 = 0;
    this[offset] = value & 255;
    while (++i2 < byteLength2 && (mul *= 256))
      this[offset + i2] = value / mul & 255;
    return offset + byteLength2;
  };
  Buffer.prototype.writeUintBE = Buffer.prototype.writeUIntBE = function(value, offset, byteLength2, noAssert) {
    if (value = +value, offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert) {
      let maxBytes = Math.pow(2, 8 * byteLength2) - 1;
      checkInt(this, value, offset, byteLength2, maxBytes, 0);
    }
    let i2 = byteLength2 - 1, mul = 1;
    this[offset + i2] = value & 255;
    while (--i2 >= 0 && (mul *= 256))
      this[offset + i2] = value / mul & 255;
    return offset + byteLength2;
  };
  Buffer.prototype.writeUint8 = Buffer.prototype.writeUInt8 = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 1, 255, 0);
    return this[offset] = value & 255, offset + 1;
  };
  Buffer.prototype.writeUint16LE = Buffer.prototype.writeUInt16LE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 2, 65535, 0);
    return this[offset] = value & 255, this[offset + 1] = value >>> 8, offset + 2;
  };
  Buffer.prototype.writeUint16BE = Buffer.prototype.writeUInt16BE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 2, 65535, 0);
    return this[offset] = value >>> 8, this[offset + 1] = value & 255, offset + 2;
  };
  Buffer.prototype.writeUint32LE = Buffer.prototype.writeUInt32LE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 4, 4294967295, 0);
    return this[offset + 3] = value >>> 24, this[offset + 2] = value >>> 16, this[offset + 1] = value >>> 8, this[offset] = value & 255, offset + 4;
  };
  Buffer.prototype.writeUint32BE = Buffer.prototype.writeUInt32BE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 4, 4294967295, 0);
    return this[offset] = value >>> 24, this[offset + 1] = value >>> 16, this[offset + 2] = value >>> 8, this[offset + 3] = value & 255, offset + 4;
  };
  Buffer.prototype.writeBigUInt64LE = defineBigIntMethod(function(value, offset = 0) {
    return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
  });
  Buffer.prototype.writeBigUInt64BE = defineBigIntMethod(function(value, offset = 0) {
    return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
  });
  Buffer.prototype.writeIntLE = function(value, offset, byteLength2, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert) {
      let limit = Math.pow(2, 8 * byteLength2 - 1);
      checkInt(this, value, offset, byteLength2, limit - 1, -limit);
    }
    let i2 = 0, mul = 1, sub = 0;
    this[offset] = value & 255;
    while (++i2 < byteLength2 && (mul *= 256)) {
      if (value < 0 && sub === 0 && this[offset + i2 - 1] !== 0)
        sub = 1;
      this[offset + i2] = (value / mul >> 0) - sub & 255;
    }
    return offset + byteLength2;
  };
  Buffer.prototype.writeIntBE = function(value, offset, byteLength2, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert) {
      let limit = Math.pow(2, 8 * byteLength2 - 1);
      checkInt(this, value, offset, byteLength2, limit - 1, -limit);
    }
    let i2 = byteLength2 - 1, mul = 1, sub = 0;
    this[offset + i2] = value & 255;
    while (--i2 >= 0 && (mul *= 256)) {
      if (value < 0 && sub === 0 && this[offset + i2 + 1] !== 0)
        sub = 1;
      this[offset + i2] = (value / mul >> 0) - sub & 255;
    }
    return offset + byteLength2;
  };
  Buffer.prototype.writeInt8 = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 1, 127, -128);
    if (value < 0)
      value = 255 + value + 1;
    return this[offset] = value & 255, offset + 1;
  };
  Buffer.prototype.writeInt16LE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 2, 32767, -32768);
    return this[offset] = value & 255, this[offset + 1] = value >>> 8, offset + 2;
  };
  Buffer.prototype.writeInt16BE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 2, 32767, -32768);
    return this[offset] = value >>> 8, this[offset + 1] = value & 255, offset + 2;
  };
  Buffer.prototype.writeInt32LE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 4, 2147483647, -2147483648);
    return this[offset] = value & 255, this[offset + 1] = value >>> 8, this[offset + 2] = value >>> 16, this[offset + 3] = value >>> 24, offset + 4;
  };
  Buffer.prototype.writeInt32BE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 4, 2147483647, -2147483648);
    if (value < 0)
      value = 4294967295 + value + 1;
    return this[offset] = value >>> 24, this[offset + 1] = value >>> 16, this[offset + 2] = value >>> 8, this[offset + 3] = value & 255, offset + 4;
  };
  Buffer.prototype.writeBigInt64LE = defineBigIntMethod(function(value, offset = 0) {
    return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
  });
  Buffer.prototype.writeBigInt64BE = defineBigIntMethod(function(value, offset = 0) {
    return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
  });
  Buffer.prototype.writeFloatLE = function(value, offset, noAssert) {
    return writeFloat(this, value, offset, true, noAssert);
  };
  Buffer.prototype.writeFloatBE = function(value, offset, noAssert) {
    return writeFloat(this, value, offset, false, noAssert);
  };
  Buffer.prototype.writeDoubleLE = function(value, offset, noAssert) {
    return writeDouble(this, value, offset, true, noAssert);
  };
  Buffer.prototype.writeDoubleBE = function(value, offset, noAssert) {
    return writeDouble(this, value, offset, false, noAssert);
  };
  Buffer.prototype.copy = function(target, targetStart, start, end) {
    if (!Buffer.isBuffer(target))
      throw TypeError("argument should be a Buffer");
    if (!start)
      start = 0;
    if (!end && end !== 0)
      end = this.length;
    if (targetStart >= target.length)
      targetStart = target.length;
    if (!targetStart)
      targetStart = 0;
    if (end > 0 && end < start)
      end = start;
    if (end === start)
      return 0;
    if (target.length === 0 || this.length === 0)
      return 0;
    if (targetStart < 0)
      throw RangeError("targetStart out of bounds");
    if (start < 0 || start >= this.length)
      throw RangeError("Index out of range");
    if (end < 0)
      throw RangeError("sourceEnd out of bounds");
    if (end > this.length)
      end = this.length;
    if (target.length - targetStart < end - start)
      end = target.length - targetStart + start;
    let len2 = end - start;
    if (this === target && typeof Uint8Array.prototype.copyWithin === "function")
      this.copyWithin(targetStart, start, end);
    else
      Uint8Array.prototype.set.call(target, this.subarray(start, end), targetStart);
    return len2;
  };
  Buffer.prototype.fill = function(val, start, end, encoding) {
    if (typeof val === "string") {
      if (typeof start === "string")
        encoding = start, start = 0, end = this.length;
      else if (typeof end === "string")
        encoding = end, end = this.length;
      if (encoding !== undefined && typeof encoding !== "string")
        throw TypeError("encoding must be a string");
      if (typeof encoding === "string" && !Buffer.isEncoding(encoding))
        throw TypeError("Unknown encoding: " + encoding);
      if (val.length === 1) {
        let code2 = val.charCodeAt(0);
        if (encoding === "utf8" && code2 < 128 || encoding === "latin1")
          val = code2;
      }
    } else if (typeof val === "number")
      val = val & 255;
    else if (typeof val === "boolean")
      val = Number(val);
    if (start < 0 || this.length < start || this.length < end)
      throw RangeError("Out of range index");
    if (end <= start)
      return this;
    if (start = start >>> 0, end = end === undefined ? this.length : end >>> 0, !val)
      val = 0;
    let i2;
    if (typeof val === "number")
      for (i2 = start;i2 < end; ++i2)
        this[i2] = val;
    else {
      let bytes = Buffer.isBuffer(val) ? val : Buffer.from(val, encoding), len2 = bytes.length;
      if (len2 === 0)
        throw TypeError('The value "' + val + '" is invalid for argument "value"');
      for (i2 = 0;i2 < end - start; ++i2)
        this[i2 + start] = bytes[i2 % len2];
    }
    return this;
  };
  INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
  hexSliceLookupTable = function() {
    let table = Array(256);
    for (let i2 = 0;i2 < 16; ++i2) {
      let i16 = i2 * 16;
      for (let j = 0;j < 16; ++j)
        table[i16 + j] = "0123456789abcdef"[i2] + "0123456789abcdef"[j];
    }
    return table;
  }();
  resolveObjectURL = notimpl("resolveObjectURL");
  isUtf8 = notimpl("isUtf8");
  transcode = notimpl("transcode");
});

// node_modules/n3/src/IRIs.js
var RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#", XSD = "http://www.w3.org/2001/XMLSchema#", SWAP = "http://www.w3.org/2000/10/swap/", IRIs_default;
var init_IRIs = __esm(() => {
  IRIs_default = {
    xsd: {
      decimal: `${XSD}decimal`,
      boolean: `${XSD}boolean`,
      double: `${XSD}double`,
      integer: `${XSD}integer`,
      string: `${XSD}string`
    },
    rdf: {
      type: `${RDF}type`,
      nil: `${RDF}nil`,
      first: `${RDF}first`,
      rest: `${RDF}rest`,
      langString: `${RDF}langString`,
      dirLangString: `${RDF}dirLangString`,
      reifies: `${RDF}reifies`
    },
    owl: {
      sameAs: "http://www.w3.org/2002/07/owl#sameAs"
    },
    r: {
      forSome: `${SWAP}reify#forSome`,
      forAll: `${SWAP}reify#forAll`
    },
    log: {
      implies: `${SWAP}log#implies`,
      isImpliedBy: `${SWAP}log#isImpliedBy`
    }
  };
});

// node_modules/n3/src/N3Lexer.js
class N3Lexer {
  constructor(options) {
    this._iri = /^<((?:[^ <>{}\\]|\\[uU])+)>[ \t]*/;
    this._unescapedIri = /^<([^\x00-\x20<>\\"\{\}\|\^\`]*)>[ \t]*/;
    this._simpleQuotedString = /^"([^"\\\r\n]*)"(?=[^"])/;
    this._simpleApostropheString = /^'([^'\\\r\n]*)'(?=[^'])/;
    this._langcode = /^@([a-z]+(?:-[a-z0-9]+)*)(?=[^a-z0-9])/i;
    this._dircode = /^--(ltr)|(rtl)/;
    this._prefix = /^((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:(?=[#\s<])/;
    this._prefixed = /^((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:((?:(?:[0-:A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])(?:(?:[\.\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])*(?:[\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~]))?)?)(?:[ \t]+|(?=\.?[,;!\^\s#()\[\]\{\}"'<>]))/;
    this._variable = /^\?(?:(?:[A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:[\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)(?=[.,;!\^\s#()\[\]\{\}"'<>])/;
    this._blank = /^_:((?:[0-9A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)(?:[ \t]+|(?=\.?[,;:\s#()\[\]\{\}"'<>]))/;
    this._number = /^[\-+]?(?:(\d+\.\d*|\.?\d+)[eE][\-+]?|\d*(\.)?)\d+(?=\.?[,;:\s#()\[\]\{\}"'<>])/;
    this._boolean = /^(?:true|false)(?=[.,;\s#()\[\]\{\}"'<>])/;
    this._atKeyword = /^@[a-z]+(?=[\s#<:])/i;
    this._keyword = /^(?:PREFIX|BASE|VERSION|GRAPH)(?=[\s#<])/i;
    this._shortPredicates = /^a(?=[\s#()\[\]\{\}"'<>])/;
    this._newline = /^[ \t]*(?:#[^\n\r]*)?(?:\r\n|\n|\r)[ \t]*/;
    this._comment = /#([^\n\r]*)/;
    this._whitespace = /^[ \t]+/;
    this._endOfFile = /^(?:#[^\n\r]*)?$/;
    options = options || {};
    this._isImpliedBy = options.isImpliedBy;
    if (this._lineMode = !!options.lineMode) {
      this._n3Mode = false;
      for (const key in this) {
        if (!(key in lineModeRegExps) && this[key] instanceof RegExp)
          this[key] = invalidRegExp;
      }
    } else {
      this._n3Mode = options.n3 !== false;
    }
    this.comments = !!options.comments;
    this._literalClosingPos = 0;
  }
  _tokenizeToEnd(callback, inputFinished) {
    let input = this._input;
    let currentLineLength = input.length;
    while (true) {
      let whiteSpaceMatch, comment;
      while (whiteSpaceMatch = this._newline.exec(input)) {
        if (this.comments && (comment = this._comment.exec(whiteSpaceMatch[0])))
          emitToken("comment", comment[1], "", this._line, whiteSpaceMatch[0].length);
        input = input.substr(whiteSpaceMatch[0].length, input.length);
        currentLineLength = input.length;
        this._line++;
      }
      if (!whiteSpaceMatch && (whiteSpaceMatch = this._whitespace.exec(input)))
        input = input.substr(whiteSpaceMatch[0].length, input.length);
      if (this._endOfFile.test(input)) {
        if (inputFinished) {
          if (this.comments && (comment = this._comment.exec(input)))
            emitToken("comment", comment[1], "", this._line, input.length);
          input = null;
          emitToken("eof", "", "", this._line, 0);
        }
        return this._input = input;
      }
      const line = this._line, firstChar = input[0];
      let type = "", value = "", prefix = "", match = null, matchLength = 0, inconclusive = false;
      switch (firstChar) {
        case "^":
          if (input.length < 3)
            break;
          else if (input[1] === "^") {
            this._previousMarker = "^^";
            input = input.substr(2);
            if (input[0] !== "<") {
              inconclusive = true;
              break;
            }
          } else {
            if (this._n3Mode) {
              matchLength = 1;
              type = "^";
            }
            break;
          }
        case "<":
          if (match = this._unescapedIri.exec(input))
            type = "IRI", value = match[1];
          else if (match = this._iri.exec(input)) {
            value = this._unescape(match[1]);
            if (value === null || illegalIriChars.test(value))
              return reportSyntaxError(this);
            type = "IRI";
          } else if (input.length > 2 && input[1] === "<" && input[2] === "(")
            type = "<<(", matchLength = 3;
          else if (!this._lineMode && input.length > (inputFinished ? 1 : 2) && input[1] === "<")
            type = "<<", matchLength = 2;
          else if (this._n3Mode && input.length > 1 && input[1] === "=") {
            matchLength = 2;
            if (this._isImpliedBy)
              type = "abbreviation", value = "<";
            else
              type = "inverse", value = ">";
          }
          break;
        case ">":
          if (input.length > 1 && input[1] === ">")
            type = ">>", matchLength = 2;
          break;
        case "_":
          if ((match = this._blank.exec(input)) || inputFinished && (match = this._blank.exec(`${input} `)))
            type = "blank", prefix = "_", value = match[1];
          break;
        case '"':
          if (match = this._simpleQuotedString.exec(input))
            value = match[1];
          else {
            ({ value, matchLength } = this._parseLiteral(input));
            if (value === null)
              return reportSyntaxError(this);
          }
          if (match !== null || matchLength !== 0) {
            type = "literal";
            this._literalClosingPos = 0;
          }
          break;
        case "'":
          if (!this._lineMode) {
            if (match = this._simpleApostropheString.exec(input))
              value = match[1];
            else {
              ({ value, matchLength } = this._parseLiteral(input));
              if (value === null)
                return reportSyntaxError(this);
            }
            if (match !== null || matchLength !== 0) {
              type = "literal";
              this._literalClosingPos = 0;
            }
          }
          break;
        case "?":
          if (this._n3Mode && (match = this._variable.exec(input)))
            type = "var", value = match[0];
          break;
        case "@":
          if (this._previousMarker === "literal" && (match = this._langcode.exec(input)) && match[1] !== "version")
            type = "langcode", value = match[1];
          else if (match = this._atKeyword.exec(input))
            type = match[0];
          break;
        case ".":
          if (input.length === 1 ? inputFinished : input[1] < "0" || input[1] > "9") {
            type = ".";
            matchLength = 1;
            break;
          }
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
        case "+":
        case "-":
          if (input[1] === "-") {
            if (this._previousMarker === "langcode" && (match = this._dircode.exec(input)))
              type = "dircode", matchLength = 2, value = match[1] || match[2], matchLength = value.length + 2;
            break;
          }
          if (match = this._number.exec(input) || inputFinished && (match = this._number.exec(`${input} `))) {
            type = "literal", value = match[0];
            prefix = typeof match[1] === "string" ? xsd.double : typeof match[2] === "string" ? xsd.decimal : xsd.integer;
          }
          break;
        case "B":
        case "b":
        case "p":
        case "P":
        case "G":
        case "g":
        case "V":
        case "v":
          if (match = this._keyword.exec(input))
            type = match[0].toUpperCase();
          else
            inconclusive = true;
          break;
        case "f":
        case "t":
          if (match = this._boolean.exec(input))
            type = "literal", value = match[0], prefix = xsd.boolean;
          else
            inconclusive = true;
          break;
        case "a":
          if (match = this._shortPredicates.exec(input))
            type = "abbreviation", value = "a";
          else
            inconclusive = true;
          break;
        case "=":
          if (this._n3Mode && input.length > 1) {
            type = "abbreviation";
            if (input[1] !== ">")
              matchLength = 1, value = "=";
            else
              matchLength = 2, value = ">";
          }
          break;
        case "!":
          if (!this._n3Mode)
            break;
        case ")":
          if (!inputFinished && (input.length === 1 || input.length === 2 && input[1] === ">")) {
            break;
          }
          if (input.length > 2 && input[1] === ">" && input[2] === ">") {
            type = ")>>", matchLength = 3;
            break;
          }
        case ",":
        case ";":
        case "[":
        case "]":
        case "(":
        case "}":
        case "~":
          if (!this._lineMode) {
            matchLength = 1;
            type = firstChar;
          }
          break;
        case "{":
          if (!this._lineMode && input.length >= 2) {
            if (input[1] === "|")
              type = "{|", matchLength = 2;
            else
              type = firstChar, matchLength = 1;
          }
          break;
        case "|":
          if (input.length >= 2 && input[1] === "}")
            type = "|}", matchLength = 2;
          break;
        default:
          inconclusive = true;
      }
      if (inconclusive) {
        if ((this._previousMarker === "@prefix" || this._previousMarker === "PREFIX") && (match = this._prefix.exec(input)))
          type = "prefix", value = match[1] || "";
        else if ((match = this._prefixed.exec(input)) || inputFinished && (match = this._prefixed.exec(`${input} `)))
          type = "prefixed", prefix = match[1] || "", value = this._unescape(match[2]);
      }
      if (this._previousMarker === "^^") {
        switch (type) {
          case "prefixed":
            type = "type";
            break;
          case "IRI":
            type = "typeIRI";
            break;
          default:
            type = "";
        }
      }
      if (!type) {
        if (inputFinished || !/^'''|^"""/.test(input) && /\n|\r/.test(input))
          return reportSyntaxError(this);
        else
          return this._input = input;
      }
      const length = matchLength || match[0].length;
      const token = emitToken(type, value, prefix, line, length);
      this.previousToken = token;
      this._previousMarker = type;
      input = input.substr(length, input.length);
    }
    function emitToken(type, value, prefix, line, length) {
      const start = input ? currentLineLength - input.length : currentLineLength;
      const end = start + length;
      const token = { type, value, prefix, line, start, end };
      callback(null, token);
      return token;
    }
    function reportSyntaxError(self2) {
      callback(self2._syntaxError(/^\S*/.exec(input)[0]));
    }
  }
  _unescape(item) {
    let invalid = false;
    const replaced = item.replace(escapeSequence, (sequence, unicode4, unicode8, escapedChar) => {
      if (typeof unicode4 === "string")
        return String.fromCharCode(Number.parseInt(unicode4, 16));
      if (typeof unicode8 === "string") {
        let charCode = Number.parseInt(unicode8, 16);
        return charCode <= 65535 ? String.fromCharCode(Number.parseInt(unicode8, 16)) : String.fromCharCode(55296 + ((charCode -= 65536) >> 10), 56320 + (charCode & 1023));
      }
      if (escapedChar in escapeReplacements)
        return escapeReplacements[escapedChar];
      invalid = true;
      return "";
    });
    return invalid ? null : replaced;
  }
  _parseLiteral(input) {
    if (input.length >= 3) {
      const opening = input.match(/^(?:"""|"|'''|'|)/)[0];
      const openingLength = opening.length;
      let closingPos = Math.max(this._literalClosingPos, openingLength);
      while ((closingPos = input.indexOf(opening, closingPos)) > 0) {
        let backslashCount = 0;
        while (input[closingPos - backslashCount - 1] === "\\")
          backslashCount++;
        if (backslashCount % 2 === 0) {
          const raw = input.substring(openingLength, closingPos);
          const lines = raw.split(/\r\n|\r|\n/).length - 1;
          const matchLength = closingPos + openingLength;
          if (openingLength === 1 && lines !== 0 || openingLength === 3 && this._lineMode)
            break;
          this._line += lines;
          return { value: this._unescape(raw), matchLength };
        }
        closingPos++;
      }
      this._literalClosingPos = input.length - openingLength + 1;
    }
    return { value: "", matchLength: 0 };
  }
  _syntaxError(issue) {
    this._input = null;
    const err = new Error(`Unexpected "${issue}" on line ${this._line}.`);
    err.context = {
      token: undefined,
      line: this._line,
      previousToken: this.previousToken
    };
    return err;
  }
  _readStartingBom(input) {
    return input.startsWith("\uFEFF") ? input.substr(1) : input;
  }
  tokenize(input, callback) {
    this._line = 1;
    if (typeof input === "string") {
      this._input = this._readStartingBom(input);
      if (typeof callback === "function")
        queueMicrotask(() => this._tokenizeToEnd(callback, true));
      else {
        const tokens = [];
        let error;
        this._tokenizeToEnd((e, t) => e ? error = e : tokens.push(t), true);
        if (error)
          throw error;
        return tokens;
      }
    } else {
      this._pendingBuffer = null;
      if (typeof input.setEncoding === "function")
        input.setEncoding("utf8");
      input.on("data", (data) => {
        if (this._input !== null && data.length !== 0) {
          if (this._pendingBuffer) {
            data = Buffer.concat([this._pendingBuffer, data]);
            this._pendingBuffer = null;
          }
          if (data[data.length - 1] & 128) {
            this._pendingBuffer = data;
          } else {
            if (typeof this._input === "undefined")
              this._input = this._readStartingBom(typeof data === "string" ? data : data.toString());
            else
              this._input += data;
            this._tokenizeToEnd(callback, false);
          }
        }
      });
      input.on("end", () => {
        if (typeof this._input === "string")
          this._tokenizeToEnd(callback, true);
      });
      input.on("error", callback);
    }
  }
}
var xsd, escapeSequence, escapeReplacements, illegalIriChars, lineModeRegExps, invalidRegExp;
var init_N3Lexer = __esm(() => {
  init_buffer();
  init_IRIs();
  ({ xsd } = IRIs_default);
  escapeSequence = /\\u([a-fA-F0-9]{4})|\\U([a-fA-F0-9]{8})|\\([^])/g;
  escapeReplacements = {
    "\\": "\\",
    "'": "'",
    '"': '"',
    n: `
`,
    r: "\r",
    t: "\t",
    f: "\f",
    b: "\b",
    _: "_",
    "~": "~",
    ".": ".",
    "-": "-",
    "!": "!",
    $: "$",
    "&": "&",
    "(": "(",
    ")": ")",
    "*": "*",
    "+": "+",
    ",": ",",
    ";": ";",
    "=": "=",
    "/": "/",
    "?": "?",
    "#": "#",
    "@": "@",
    "%": "%"
  };
  illegalIriChars = /[\x00-\x20<>\\"\{\}\|\^\`]/;
  lineModeRegExps = {
    _iri: true,
    _unescapedIri: true,
    _simpleQuotedString: true,
    _langcode: true,
    _dircode: true,
    _blank: true,
    _newline: true,
    _comment: true,
    _whitespace: true,
    _endOfFile: true
  };
  invalidRegExp = /$0^/;
});

// node_modules/n3/src/N3DataFactory.js
class Term {
  constructor(id) {
    this.id = id;
  }
  get value() {
    return this.id;
  }
  equals(other) {
    if (other instanceof Term)
      return this.id === other.id;
    return !!other && this.termType === other.termType && this.value === other.value;
  }
  hashCode() {
    return 0;
  }
  toJSON() {
    return {
      termType: this.termType,
      value: this.value
    };
  }
}
function namedNode(iri) {
  return new NamedNode(iri);
}
function blankNode(name) {
  return new BlankNode(name || `n3-${_blankNodeCounter++}`);
}
function literal(value, languageOrDataType) {
  if (typeof languageOrDataType === "string")
    return new Literal(`"${value}"@${languageOrDataType.toLowerCase()}`);
  if (languageOrDataType !== undefined && !("termType" in languageOrDataType)) {
    return new Literal(`"${value}"@${languageOrDataType.language.toLowerCase()}${languageOrDataType.direction ? `--${languageOrDataType.direction.toLowerCase()}` : ""}`);
  }
  let datatype = languageOrDataType ? languageOrDataType.value : "";
  if (datatype === "") {
    if (typeof value === "boolean")
      datatype = xsd2.boolean;
    else if (typeof value === "number") {
      if (Number.isFinite(value))
        datatype = Number.isInteger(value) ? xsd2.integer : xsd2.double;
      else {
        datatype = xsd2.double;
        if (!Number.isNaN(value))
          value = value > 0 ? "INF" : "-INF";
      }
    }
  }
  return datatype === "" || datatype === xsd2.string ? new Literal(`"${value}"`) : new Literal(`"${value}"^^${datatype}`);
}
function variable(name) {
  return new Variable(name);
}
function defaultGraph() {
  return DEFAULTGRAPH;
}
function quad(subject, predicate, object, graph) {
  return new Quad(subject, predicate, object, graph);
}
function fromTerm(term) {
  if (term instanceof Term)
    return term;
  switch (term.termType) {
    case "NamedNode":
      return namedNode(term.value);
    case "BlankNode":
      return blankNode(term.value);
    case "Variable":
      return variable(term.value);
    case "DefaultGraph":
      return DEFAULTGRAPH;
    case "Literal":
      return literal(term.value, term.language || term.datatype);
    case "Quad":
      return fromQuad(term);
    default:
      throw new Error(`Unexpected termType: ${term.termType}`);
  }
}
function fromQuad(inQuad) {
  if (inQuad instanceof Quad)
    return inQuad;
  if (inQuad.termType !== "Quad")
    throw new Error(`Unexpected termType: ${inQuad.termType}`);
  return quad(fromTerm(inQuad.subject), fromTerm(inQuad.predicate), fromTerm(inQuad.object), fromTerm(inQuad.graph));
}
var rdf, xsd2, DEFAULTGRAPH, _blankNodeCounter = 0, DataFactory, N3DataFactory_default, NamedNode, Literal, BlankNode, Variable, DefaultGraph, Quad;
var init_N3DataFactory = __esm(() => {
  init_IRIs();
  ({ rdf, xsd: xsd2 } = IRIs_default);
  DataFactory = {
    namedNode,
    blankNode,
    variable,
    literal,
    defaultGraph,
    quad,
    triple: quad,
    fromTerm,
    fromQuad
  };
  N3DataFactory_default = DataFactory;
  NamedNode = class NamedNode extends Term {
    get termType() {
      return "NamedNode";
    }
  };
  Literal = class Literal extends Term {
    get termType() {
      return "Literal";
    }
    get value() {
      return this.id.substring(1, this.id.lastIndexOf('"'));
    }
    get language() {
      const id = this.id;
      let atPos = id.lastIndexOf('"') + 1;
      const dirPos = id.lastIndexOf("--");
      return atPos < id.length && id[atPos++] === "@" ? (dirPos > atPos ? id.substr(0, dirPos) : id).substr(atPos).toLowerCase() : "";
    }
    get direction() {
      const id = this.id;
      const endPos = id.lastIndexOf('"');
      const dirPos = id.lastIndexOf("--");
      return dirPos > endPos && dirPos + 2 < id.length ? id.substr(dirPos + 2).toLowerCase() : "";
    }
    get datatype() {
      return new NamedNode(this.datatypeString);
    }
    get datatypeString() {
      const id = this.id, dtPos = id.lastIndexOf('"') + 1;
      const char = dtPos < id.length ? id[dtPos] : "";
      return char === "^" ? id.substr(dtPos + 2) : char !== "@" ? xsd2.string : id.indexOf("--", dtPos) > 0 ? rdf.dirLangString : rdf.langString;
    }
    equals(other) {
      if (other instanceof Literal)
        return this.id === other.id;
      return !!other && !!other.datatype && this.termType === other.termType && this.value === other.value && this.language === other.language && (this.direction === other.direction || this.direction === "" && !other.direction) && this.datatype.value === other.datatype.value;
    }
    toJSON() {
      return {
        termType: this.termType,
        value: this.value,
        language: this.language,
        direction: this.direction,
        datatype: { termType: "NamedNode", value: this.datatypeString }
      };
    }
  };
  BlankNode = class BlankNode extends Term {
    constructor(name) {
      super(`_:${name}`);
    }
    get termType() {
      return "BlankNode";
    }
    get value() {
      return this.id.substr(2);
    }
  };
  Variable = class Variable extends Term {
    constructor(name) {
      super(`?${name}`);
    }
    get termType() {
      return "Variable";
    }
    get value() {
      return this.id.substr(1);
    }
  };
  DefaultGraph = class DefaultGraph extends Term {
    constructor() {
      super("");
      return DEFAULTGRAPH || this;
    }
    get termType() {
      return "DefaultGraph";
    }
    equals(other) {
      return this === other || !!other && this.termType === other.termType;
    }
  };
  DEFAULTGRAPH = new DefaultGraph;
  Quad = class Quad extends Term {
    constructor(subject, predicate, object, graph) {
      super("");
      this._subject = subject;
      this._predicate = predicate;
      this._object = object;
      this._graph = graph || DEFAULTGRAPH;
    }
    get termType() {
      return "Quad";
    }
    get subject() {
      return this._subject;
    }
    get predicate() {
      return this._predicate;
    }
    get object() {
      return this._object;
    }
    get graph() {
      return this._graph;
    }
    toJSON() {
      return {
        termType: this.termType,
        subject: this._subject.toJSON(),
        predicate: this._predicate.toJSON(),
        object: this._object.toJSON(),
        graph: this._graph.toJSON()
      };
    }
    equals(other) {
      return !!other && this._subject.equals(other.subject) && this._predicate.equals(other.predicate) && this._object.equals(other.object) && this._graph.equals(other.graph);
    }
  };
});

// node_modules/n3/src/N3Parser.js
class N3Parser {
  constructor(options) {
    this._contextStack = [];
    this._graph = null;
    options = options || {};
    this._setBase(options.baseIRI);
    options.factory && initDataFactory(this, options.factory);
    const format2 = typeof options.format === "string" ? options.format.match(/\w*$/)[0].toLowerCase() : "", isTurtle = /turtle/.test(format2), isTriG = /trig/.test(format2), isNTriples = /triple/.test(format2), isNQuads = /quad/.test(format2), isN3 = this._n3Mode = /n3/.test(format2), isLineMode = isNTriples || isNQuads;
    if (!(this._supportsNamedGraphs = !(isTurtle || isN3)))
      this._readPredicateOrNamedGraph = this._readPredicate;
    this._supportsQuads = !(isTurtle || isTriG || isNTriples || isN3);
    this._isImpliedBy = options.isImpliedBy;
    if (isLineMode)
      this._resolveRelativeIRI = (iri) => {
        return null;
      };
    this._blankNodePrefix = typeof options.blankNodePrefix !== "string" ? "" : options.blankNodePrefix.replace(/^(?!_:)/, "_:");
    this._lexer = options.lexer || new N3Lexer({ lineMode: isLineMode, n3: isN3, isImpliedBy: this._isImpliedBy });
    this._explicitQuantifiers = !!options.explicitQuantifiers;
    this._parseUnsupportedVersions = !!options.parseUnsupportedVersions;
    this._version = options.version;
  }
  static _resetBlankNodePrefix() {
    blankNodePrefix = 0;
  }
  _setBase(baseIRI) {
    if (!baseIRI) {
      this._base = "";
      this._basePath = "";
    } else {
      const fragmentPos = baseIRI.indexOf("#");
      if (fragmentPos >= 0)
        baseIRI = baseIRI.substr(0, fragmentPos);
      this._base = baseIRI;
      this._basePath = baseIRI.indexOf("/") < 0 ? baseIRI : baseIRI.replace(/[^\/?]*(?:\?.*)?$/, "");
      baseIRI = baseIRI.match(/^(?:([a-z][a-z0-9+.-]*:))?(?:\/\/[^\/]*)?/i);
      this._baseRoot = baseIRI[0];
      this._baseScheme = baseIRI[1];
    }
  }
  _saveContext(type, graph, subject, predicate, object) {
    const n3Mode = this._n3Mode;
    this._contextStack.push({
      type,
      subject,
      predicate,
      object,
      graph,
      inverse: n3Mode ? this._inversePredicate : false,
      blankPrefix: n3Mode ? this._prefixes._ : "",
      quantified: n3Mode ? this._quantified : null
    });
    if (n3Mode) {
      this._inversePredicate = false;
      this._prefixes._ = this._graph ? `${this._graph.value}.` : ".";
      this._quantified = Object.create(this._quantified);
    }
  }
  _restoreContext(type, token) {
    const context = this._contextStack.pop();
    if (!context || context.type !== type)
      return this._error(`Unexpected ${token.type}`, token);
    this._subject = context.subject;
    this._predicate = context.predicate;
    this._object = context.object;
    this._graph = context.graph;
    if (this._n3Mode) {
      this._inversePredicate = context.inverse;
      this._prefixes._ = context.blankPrefix;
      this._quantified = context.quantified;
    }
  }
  _readBeforeTopContext(token) {
    if (this._version && !this._isValidVersion(this._version))
      return this._error(`Detected unsupported version as media type parameter: "${this._version}"`, token);
    return this._readInTopContext(token);
  }
  _readInTopContext(token) {
    switch (token.type) {
      case "eof":
        if (this._graph !== null)
          return this._error("Unclosed graph", token);
        delete this._prefixes._;
        return this._callback(null, null, this._prefixes);
      case "PREFIX":
        this._sparqlStyle = true;
      case "@prefix":
        return this._readPrefix;
      case "BASE":
        this._sparqlStyle = true;
      case "@base":
        return this._readBaseIRI;
      case "VERSION":
        this._sparqlStyle = true;
      case "@version":
        return this._readVersion;
      case "{":
        if (this._supportsNamedGraphs) {
          this._graph = "";
          this._subject = null;
          return this._readSubject;
        }
      case "GRAPH":
        if (this._supportsNamedGraphs)
          return this._readNamedGraphLabel;
      default:
        return this._readSubject(token);
    }
  }
  _readEntity(token, quantifier) {
    let value;
    switch (token.type) {
      case "IRI":
      case "typeIRI":
        const iri = this._resolveIRI(token.value);
        if (iri === null)
          return this._error("Invalid IRI", token);
        value = this._factory.namedNode(iri);
        break;
      case "type":
      case "prefixed":
        const prefix = this._prefixes[token.prefix];
        if (prefix === undefined)
          return this._error(`Undefined prefix "${token.prefix}:"`, token);
        value = this._factory.namedNode(prefix + token.value);
        break;
      case "blank":
        value = this._factory.blankNode(this._prefixes[token.prefix] + token.value);
        break;
      case "var":
        value = this._factory.variable(token.value.substr(1));
        break;
      default:
        return this._error(`Expected entity but got ${token.type}`, token);
    }
    if (!quantifier && this._n3Mode && value.id in this._quantified)
      value = this._quantified[value.id];
    return value;
  }
  _readSubject(token) {
    this._predicate = null;
    switch (token.type) {
      case "[":
        this._saveContext("blank", this._graph, this._subject = this._factory.blankNode(), null, null);
        return this._readBlankNodeHead;
      case "(":
        const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
        if (parent.type === "<<") {
          return this._error("Unexpected list in reified triple", token);
        }
        this._saveContext("list", this._graph, this.RDF_NIL, null, null);
        this._subject = null;
        return this._readListItem;
      case "{":
        if (!this._n3Mode)
          return this._error("Unexpected graph", token);
        this._saveContext("formula", this._graph, this._graph = this._factory.blankNode(), null, null);
        return this._readSubject;
      case "}":
        return this._readPunctuation(token);
      case "@forSome":
        if (!this._n3Mode)
          return this._error('Unexpected "@forSome"', token);
        this._subject = null;
        this._predicate = this.N3_FORSOME;
        this._quantifier = "blankNode";
        return this._readQuantifierList;
      case "@forAll":
        if (!this._n3Mode)
          return this._error('Unexpected "@forAll"', token);
        this._subject = null;
        this._predicate = this.N3_FORALL;
        this._quantifier = "variable";
        return this._readQuantifierList;
      case "literal":
        if (!this._n3Mode)
          return this._error("Unexpected literal", token);
        if (token.prefix.length === 0) {
          this._literalValue = token.value;
          return this._completeSubjectLiteral;
        } else
          this._subject = this._factory.literal(token.value, this._factory.namedNode(token.prefix));
        break;
      case "<<(":
        if (!this._n3Mode)
          return this._error("Disallowed triple term as subject", token);
        this._saveContext("<<(", this._graph, null, null, null);
        this._graph = null;
        return this._readSubject;
      case "<<":
        this._saveContext("<<", this._graph, null, null, null);
        this._graph = null;
        return this._readSubject;
      default:
        if ((this._subject = this._readEntity(token)) === undefined)
          return;
        if (this._n3Mode)
          return this._getPathReader(this._readPredicateOrNamedGraph);
    }
    return this._readPredicateOrNamedGraph;
  }
  _readPredicate(token) {
    const type = token.type;
    switch (type) {
      case "inverse":
        this._inversePredicate = true;
      case "abbreviation":
        this._predicate = this.ABBREVIATIONS[token.value];
        break;
      case ".":
      case "]":
      case "}":
      case "|}":
        if (this._predicate === null)
          return this._error(`Unexpected ${type}`, token);
        this._subject = null;
        return type === "]" ? this._readBlankNodeTail(token) : this._readPunctuation(token);
      case ";":
        return this._predicate !== null ? this._readPredicate : this._error("Expected predicate but got ;", token);
      case "[":
        if (this._n3Mode) {
          this._saveContext("blank", this._graph, this._subject, this._subject = this._factory.blankNode(), null);
          return this._readBlankNodeHead;
        }
      case "blank":
        if (!this._n3Mode)
          return this._error("Disallowed blank node as predicate", token);
      default:
        if ((this._predicate = this._readEntity(token)) === undefined)
          return;
    }
    this._validAnnotation = true;
    return this._readObject;
  }
  _readObject(token) {
    switch (token.type) {
      case "literal":
        if (token.prefix.length === 0) {
          this._literalValue = token.value;
          return this._readDataTypeOrLang;
        } else
          this._object = this._factory.literal(token.value, this._factory.namedNode(token.prefix));
        break;
      case "[":
        this._saveContext("blank", this._graph, this._subject, this._predicate, this._subject = this._factory.blankNode());
        return this._readBlankNodeHead;
      case "(":
        const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
        if (parent.type === "<<") {
          return this._error("Unexpected list in reified triple", token);
        }
        this._saveContext("list", this._graph, this._subject, this._predicate, this.RDF_NIL);
        this._subject = null;
        return this._readListItem;
      case "{":
        if (!this._n3Mode)
          return this._error("Unexpected graph", token);
        this._saveContext("formula", this._graph, this._subject, this._predicate, this._graph = this._factory.blankNode());
        return this._readSubject;
      case "<<(":
        this._saveContext("<<(", this._graph, this._subject, this._predicate, null);
        this._graph = null;
        return this._readSubject;
      case "<<":
        this._saveContext("<<", this._graph, this._subject, this._predicate, null);
        this._graph = null;
        return this._readSubject;
      default:
        if ((this._object = this._readEntity(token)) === undefined)
          return;
        if (this._n3Mode)
          return this._getPathReader(this._getContextEndReader());
    }
    return this._getContextEndReader();
  }
  _readPredicateOrNamedGraph(token) {
    return token.type === "{" ? this._readGraph(token) : this._readPredicate(token);
  }
  _readGraph(token) {
    if (token.type !== "{")
      return this._error(`Expected graph but got ${token.type}`, token);
    this._graph = this._subject, this._subject = null;
    return this._readSubject;
  }
  _readBlankNodeHead(token) {
    if (token.type === "]") {
      this._subject = null;
      return this._readBlankNodeTail(token);
    } else {
      const stack = this._contextStack, parentParent = stack.length > 1 && stack[stack.length - 2];
      if (parentParent.type === "<<") {
        return this._error("Unexpected compound blank node expression in reified triple", token);
      }
      this._predicate = null;
      return this._readPredicate(token);
    }
  }
  _readBlankNodeTail(token) {
    if (token.type !== "]")
      return this._readBlankNodePunctuation(token);
    if (this._subject !== null)
      this._emit(this._subject, this._predicate, this._object, this._graph);
    const empty = this._predicate === null;
    this._restoreContext("blank", token);
    if (this._object !== null)
      return this._getContextEndReader();
    else if (this._predicate !== null)
      return this._readObject;
    else
      return empty ? this._readPredicateOrNamedGraph : this._readPredicateAfterBlank;
  }
  _readPredicateAfterBlank(token) {
    switch (token.type) {
      case ".":
      case "}":
        this._subject = null;
        return this._readPunctuation(token);
      default:
        return this._readPredicate(token);
    }
  }
  _readListItem(token) {
    let item = null, list = null, next = this._readListItem;
    const previousList = this._subject, stack = this._contextStack, parent = stack[stack.length - 1];
    switch (token.type) {
      case "[":
        this._saveContext("blank", this._graph, list = this._factory.blankNode(), this.RDF_FIRST, this._subject = item = this._factory.blankNode());
        next = this._readBlankNodeHead;
        break;
      case "(":
        this._saveContext("list", this._graph, list = this._factory.blankNode(), this.RDF_FIRST, this.RDF_NIL);
        this._subject = null;
        break;
      case ")":
        this._restoreContext("list", token);
        if (stack.length !== 0 && stack[stack.length - 1].type === "list")
          this._emit(this._subject, this._predicate, this._object, this._graph);
        if (this._predicate === null) {
          next = this._readPredicate;
          if (this._subject === this.RDF_NIL)
            return next;
        } else {
          next = this._getContextEndReader();
          if (this._object === this.RDF_NIL)
            return next;
        }
        list = this.RDF_NIL;
        break;
      case "literal":
        if (token.prefix.length === 0) {
          this._literalValue = token.value;
          next = this._readListItemDataTypeOrLang;
        } else {
          item = this._factory.literal(token.value, this._factory.namedNode(token.prefix));
          next = this._getContextEndReader();
        }
        break;
      case "{":
        if (!this._n3Mode)
          return this._error("Unexpected graph", token);
        this._saveContext("formula", this._graph, this._subject, this._predicate, this._graph = this._factory.blankNode());
        return this._readSubject;
      case "<<":
        this._saveContext("<<", this._graph, null, null, null);
        this._graph = null;
        next = this._readSubject;
        break;
      default:
        if ((item = this._readEntity(token)) === undefined)
          return;
    }
    if (list === null)
      this._subject = list = this._factory.blankNode();
    if (token.type === "<<")
      stack[stack.length - 1].subject = this._subject;
    if (previousList === null) {
      if (parent.predicate === null)
        parent.subject = list;
      else
        parent.object = list;
    } else {
      this._emit(previousList, this.RDF_REST, list, this._graph);
    }
    if (item !== null) {
      if (this._n3Mode && (token.type === "IRI" || token.type === "prefixed")) {
        this._saveContext("item", this._graph, list, this.RDF_FIRST, item);
        this._subject = item, this._predicate = null;
        return this._getPathReader(this._readListItem);
      }
      this._emit(list, this.RDF_FIRST, item, this._graph);
    }
    return next;
  }
  _readDataTypeOrLang(token) {
    return this._completeObjectLiteral(token, false);
  }
  _readListItemDataTypeOrLang(token) {
    return this._completeObjectLiteral(token, true);
  }
  _completeLiteral(token, component) {
    let literal2 = this._factory.literal(this._literalValue);
    let readCb;
    switch (token.type) {
      case "type":
      case "typeIRI":
        const datatype = this._readEntity(token);
        if (datatype === undefined)
          return;
        if (datatype.value === IRIs_default.rdf.langString || datatype.value === IRIs_default.rdf.dirLangString) {
          return this._error("Detected illegal (directional) languaged-tagged string with explicit datatype", token);
        }
        literal2 = this._factory.literal(this._literalValue, datatype);
        token = null;
        break;
      case "langcode":
        if (token.value.split("-").some((t) => t.length > 8))
          return this._error("Detected language tag with subtag longer than 8 characters", token);
        literal2 = this._factory.literal(this._literalValue, token.value);
        this._literalLanguage = token.value;
        token = null;
        readCb = this._readDirCode.bind(this, component);
        break;
    }
    return { token, literal: literal2, readCb };
  }
  _readDirCode(component, listItem, token) {
    if (token.type === "dircode") {
      const term = this._factory.literal(this._literalValue, { language: this._literalLanguage, direction: token.value });
      if (component === "subject")
        this._subject = term;
      else
        this._object = term;
      this._literalLanguage = undefined;
      token = null;
    }
    if (component === "subject")
      return token === null ? this._readPredicateOrNamedGraph : this._readPredicateOrNamedGraph(token);
    return this._completeObjectLiteralPost(token, listItem);
  }
  _completeSubjectLiteral(token) {
    const completed = this._completeLiteral(token, "subject");
    this._subject = completed.literal;
    if (completed.readCb)
      return completed.readCb.bind(this, false);
    return this._readPredicateOrNamedGraph;
  }
  _completeObjectLiteral(token, listItem) {
    const completed = this._completeLiteral(token, "object");
    if (!completed)
      return;
    this._object = completed.literal;
    if (completed.readCb)
      return completed.readCb.bind(this, listItem);
    return this._completeObjectLiteralPost(completed.token, listItem);
  }
  _completeObjectLiteralPost(token, listItem) {
    if (listItem)
      this._emit(this._subject, this.RDF_FIRST, this._object, this._graph);
    if (token === null)
      return this._getContextEndReader();
    else {
      this._readCallback = this._getContextEndReader();
      return this._readCallback(token);
    }
  }
  _readFormulaTail(token) {
    if (token.type !== "}")
      return this._readPunctuation(token);
    if (this._subject !== null)
      this._emit(this._subject, this._predicate, this._object, this._graph);
    this._restoreContext("formula", token);
    return this._object === null ? this._readPredicate : this._getContextEndReader();
  }
  _readPunctuation(token) {
    let next, graph = this._graph, startingAnnotation = false;
    const subject = this._subject, inversePredicate = this._inversePredicate;
    switch (token.type) {
      case "}":
        if (this._graph === null)
          return this._error("Unexpected graph closing", token);
        if (this._n3Mode)
          return this._readFormulaTail(token);
        this._graph = null;
      case ".":
        this._subject = null;
        this._tripleTerm = null;
        next = this._contextStack.length ? this._readSubject : this._readInTopContext;
        if (inversePredicate)
          this._inversePredicate = false;
        break;
      case ";":
        next = this._readPredicate;
        break;
      case ",":
        next = this._readObject;
        break;
      case "~":
        next = this._readReifierInAnnotation;
        startingAnnotation = true;
        break;
      case "{|":
        this._subject = this._readTripleTerm();
        this._validAnnotation = false;
        startingAnnotation = true;
        next = this._readPredicate;
        break;
      case "|}":
        if (!this._annotation)
          return this._error("Unexpected annotation syntax closing", token);
        if (!this._validAnnotation)
          return this._error("Annotation block can not be empty", token);
        this._subject = null;
        this._annotation = false;
        next = this._readPunctuation;
        break;
      default:
        if (this._supportsQuads && this._graph === null && (graph = this._readEntity(token)) !== undefined) {
          next = this._readQuadPunctuation;
          break;
        }
        return this._error(`Expected punctuation to follow "${this._object.id}"`, token);
    }
    if (subject !== null && (!startingAnnotation || startingAnnotation && !this._annotation)) {
      const predicate = this._predicate, object = this._object;
      if (!inversePredicate)
        this._emit(subject, predicate, object, graph);
      else
        this._emit(object, predicate, subject, graph);
    }
    if (startingAnnotation) {
      this._annotation = true;
    }
    return next;
  }
  _readBlankNodePunctuation(token) {
    let next;
    switch (token.type) {
      case ";":
        next = this._readPredicate;
        break;
      case ",":
        next = this._readObject;
        break;
      default:
        return this._error(`Expected punctuation to follow "${this._object.id}"`, token);
    }
    this._emit(this._subject, this._predicate, this._object, this._graph);
    return next;
  }
  _readQuadPunctuation(token) {
    if (token.type !== ".")
      return this._error("Expected dot to follow quad", token);
    return this._readInTopContext;
  }
  _readPrefix(token) {
    if (token.type !== "prefix")
      return this._error("Expected prefix to follow @prefix", token);
    this._prefix = token.value;
    return this._readPrefixIRI;
  }
  _readPrefixIRI(token) {
    if (token.type !== "IRI")
      return this._error(`Expected IRI to follow prefix "${this._prefix}:"`, token);
    const prefixNode = this._readEntity(token);
    this._prefixes[this._prefix] = prefixNode.value;
    this._prefixCallback(this._prefix, prefixNode);
    return this._readDeclarationPunctuation;
  }
  _readBaseIRI(token) {
    const iri = token.type === "IRI" && this._resolveIRI(token.value);
    if (!iri)
      return this._error("Expected valid IRI to follow base declaration", token);
    this._setBase(iri);
    return this._readDeclarationPunctuation;
  }
  _isValidVersion(version) {
    return this._parseUnsupportedVersions || N3Parser.SUPPORTED_VERSIONS.includes(version);
  }
  _readVersion(token) {
    if (token.type !== "literal")
      return this._error("Expected literal to follow version declaration", token);
    if (token.end - token.start !== token.value.length + 2)
      return this._error("Version declarations must use single quotes", token);
    this._versionCallback(token.value);
    if (!this._isValidVersion(token.value))
      return this._error(`Detected unsupported version: "${token.value}"`, token);
    return this._readDeclarationPunctuation;
  }
  _readNamedGraphLabel(token) {
    switch (token.type) {
      case "IRI":
      case "blank":
      case "prefixed":
        return this._readSubject(token), this._readGraph;
      case "[":
        return this._readNamedGraphBlankLabel;
      default:
        return this._error("Invalid graph label", token);
    }
  }
  _readNamedGraphBlankLabel(token) {
    if (token.type !== "]")
      return this._error("Invalid graph label", token);
    this._subject = this._factory.blankNode();
    return this._readGraph;
  }
  _readDeclarationPunctuation(token) {
    if (this._sparqlStyle) {
      this._sparqlStyle = false;
      return this._readInTopContext(token);
    }
    if (token.type !== ".")
      return this._error("Expected declaration to end with a dot", token);
    return this._readInTopContext;
  }
  _readQuantifierList(token) {
    let entity;
    switch (token.type) {
      case "IRI":
      case "prefixed":
        if ((entity = this._readEntity(token, true)) !== undefined)
          break;
      default:
        return this._error(`Unexpected ${token.type}`, token);
    }
    if (!this._explicitQuantifiers)
      this._quantified[entity.id] = this._factory[this._quantifier](this._factory.blankNode().value);
    else {
      if (this._subject === null)
        this._emit(this._graph || this.DEFAULTGRAPH, this._predicate, this._subject = this._factory.blankNode(), this.QUANTIFIERS_GRAPH);
      else
        this._emit(this._subject, this.RDF_REST, this._subject = this._factory.blankNode(), this.QUANTIFIERS_GRAPH);
      this._emit(this._subject, this.RDF_FIRST, entity, this.QUANTIFIERS_GRAPH);
    }
    return this._readQuantifierPunctuation;
  }
  _readQuantifierPunctuation(token) {
    if (token.type === ",")
      return this._readQuantifierList;
    else {
      if (this._explicitQuantifiers) {
        this._emit(this._subject, this.RDF_REST, this.RDF_NIL, this.QUANTIFIERS_GRAPH);
        this._subject = null;
      }
      this._readCallback = this._getContextEndReader();
      return this._readCallback(token);
    }
  }
  _getPathReader(afterPath) {
    this._afterPath = afterPath;
    return this._readPath;
  }
  _readPath(token) {
    switch (token.type) {
      case "!":
        return this._readForwardPath;
      case "^":
        return this._readBackwardPath;
      default:
        const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
        if (parent && parent.type === "item") {
          const item = this._subject;
          this._restoreContext("item", token);
          this._emit(this._subject, this.RDF_FIRST, item, this._graph);
        }
        return this._afterPath(token);
    }
  }
  _readForwardPath(token) {
    let subject, predicate;
    const object = this._factory.blankNode();
    if ((predicate = this._readEntity(token)) === undefined)
      return;
    if (this._predicate === null)
      subject = this._subject, this._subject = object;
    else
      subject = this._object, this._object = object;
    this._emit(subject, predicate, object, this._graph);
    return this._readPath;
  }
  _readBackwardPath(token) {
    const subject = this._factory.blankNode();
    let predicate, object;
    if ((predicate = this._readEntity(token)) === undefined)
      return;
    if (this._predicate === null)
      object = this._subject, this._subject = subject;
    else
      object = this._object, this._object = subject;
    this._emit(subject, predicate, object, this._graph);
    return this._readPath;
  }
  _readTripleTermTail(token) {
    if (token.type !== ")>>")
      return this._error(`Expected )>> but got ${token.type}`, token);
    const quad2 = this._factory.quad(this._subject, this._predicate, this._object, this._graph || this.DEFAULTGRAPH);
    this._restoreContext("<<(", token);
    if (this._subject === null) {
      this._subject = quad2;
      return this._readPredicate;
    } else {
      this._object = quad2;
      return this._getContextEndReader();
    }
  }
  _readReifiedTripleTailOrReifier(token) {
    if (token.type === "~") {
      return this._readReifier;
    }
    return this._readReifiedTripleTail(token);
  }
  _readReifiedTripleTail(token) {
    if (token.type !== ">>")
      return this._error(`Expected >> but got ${token.type}`, token);
    this._tripleTerm = null;
    const reifier = this._readTripleTerm();
    this._restoreContext("<<", token);
    const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
    if (parent && parent.type === "list") {
      this._emit(this._subject, this.RDF_FIRST, reifier, this._graph);
      return this._getContextEndReader();
    } else if (this._subject === null) {
      this._subject = reifier;
      return this._readPredicateOrReifierTripleEnd;
    } else {
      this._object = reifier;
      return this._getContextEndReader();
    }
  }
  _readPredicateOrReifierTripleEnd(token) {
    if (token.type === ".") {
      this._subject = null;
      return this._readPunctuation(token);
    }
    return this._readPredicate(token);
  }
  _readReifier(token) {
    this._reifier = this._readEntity(token);
    return this._readReifiedTripleTail;
  }
  _readReifierInAnnotation(token) {
    if (token.type === "IRI" || token.type === "typeIRI" || token.type === "type" || token.type === "prefixed" || token.type === "blank" || token.type === "var") {
      this._reifier = this._readEntity(token);
      return this._readPunctuation;
    }
    this._readTripleTerm();
    this._subject = null;
    return this._readPunctuation(token);
  }
  _readTripleTerm() {
    const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
    const parentGraph = parent ? parent.graph : undefined;
    const reifier = this._reifier || this._factory.blankNode();
    this._reifier = null;
    this._tripleTerm = this._tripleTerm || this._factory.quad(this._subject, this._predicate, this._object);
    this._emit(reifier, this.RDF_REIFIES, this._tripleTerm, parentGraph || this.DEFAULTGRAPH);
    return reifier;
  }
  _getContextEndReader() {
    const contextStack = this._contextStack;
    if (!contextStack.length)
      return this._readPunctuation;
    switch (contextStack[contextStack.length - 1].type) {
      case "blank":
        return this._readBlankNodeTail;
      case "list":
        return this._readListItem;
      case "formula":
        return this._readFormulaTail;
      case "<<(":
        return this._readTripleTermTail;
      case "<<":
        return this._readReifiedTripleTailOrReifier;
    }
  }
  _emit(subject, predicate, object, graph) {
    this._callback(null, this._factory.quad(subject, predicate, object, graph || this.DEFAULTGRAPH));
  }
  _error(message, token) {
    const err = new Error(`${message} on line ${token.line}.`);
    err.context = {
      token,
      line: token.line,
      previousToken: this._lexer.previousToken
    };
    this._callback(err);
    this._callback = noop;
  }
  _resolveIRI(iri) {
    return /^[a-z][a-z0-9+.-]*:/i.test(iri) ? iri : this._resolveRelativeIRI(iri);
  }
  _resolveRelativeIRI(iri) {
    if (!iri.length)
      return this._base;
    switch (iri[0]) {
      case "#":
        return this._base + iri;
      case "?":
        return this._base.replace(/(?:\?.*)?$/, iri);
      case "/":
        return (iri[1] === "/" ? this._baseScheme : this._baseRoot) + this._removeDotSegments(iri);
      default:
        return /^[^/:]*:/.test(iri) ? null : this._removeDotSegments(this._basePath + iri);
    }
  }
  _removeDotSegments(iri) {
    if (!/(^|\/)\.\.?($|[/#?])/.test(iri))
      return iri;
    const length = iri.length;
    let result = "", i2 = -1, pathStart = -1, segmentStart = 0, next = "/";
    while (i2 < length) {
      switch (next) {
        case ":":
          if (pathStart < 0) {
            if (iri[++i2] === "/" && iri[++i2] === "/")
              while ((pathStart = i2 + 1) < length && iri[pathStart] !== "/")
                i2 = pathStart;
          }
          break;
        case "?":
        case "#":
          i2 = length;
          break;
        case "/":
          if (iri[i2 + 1] === ".") {
            next = iri[++i2 + 1];
            switch (next) {
              case "/":
                result += iri.substring(segmentStart, i2 - 1);
                segmentStart = i2 + 1;
                break;
              case undefined:
              case "?":
              case "#":
                return result + iri.substring(segmentStart, i2) + iri.substr(i2 + 1);
              case ".":
                next = iri[++i2 + 1];
                if (next === undefined || next === "/" || next === "?" || next === "#") {
                  result += iri.substring(segmentStart, i2 - 2);
                  if ((segmentStart = result.lastIndexOf("/")) >= pathStart)
                    result = result.substr(0, segmentStart);
                  if (next !== "/")
                    return `${result}/${iri.substr(i2 + 1)}`;
                  segmentStart = i2 + 1;
                }
            }
          }
      }
      next = iri[++i2];
    }
    return result + iri.substring(segmentStart);
  }
  parse(input, quadCallback, prefixCallback, versionCallback) {
    let onQuad, onPrefix, onComment, onVersion;
    if (quadCallback && (quadCallback.onQuad || quadCallback.onPrefix || quadCallback.onComment || quadCallback.onVersion)) {
      onQuad = quadCallback.onQuad;
      onPrefix = quadCallback.onPrefix;
      onComment = quadCallback.onComment;
      onVersion = quadCallback.onVersion;
    } else {
      onQuad = quadCallback;
      onPrefix = prefixCallback;
      onVersion = versionCallback;
    }
    this._readCallback = this._readBeforeTopContext;
    this._sparqlStyle = false;
    this._prefixes = Object.create(null);
    this._prefixes._ = this._blankNodePrefix ? this._blankNodePrefix.substr(2) : `b${blankNodePrefix++}_`;
    this._prefixCallback = onPrefix || noop;
    this._versionCallback = onVersion || noop;
    this._inversePredicate = false;
    this._quantified = Object.create(null);
    if (!onQuad) {
      const quads = [];
      let error;
      this._callback = (e, t) => {
        e ? error = e : t && quads.push(t);
      };
      this._lexer.tokenize(input).every((token) => {
        return this._readCallback = this._readCallback(token);
      });
      if (error)
        throw error;
      return quads;
    }
    let processNextToken = (error, token) => {
      if (error !== null)
        this._callback(error), this._callback = noop;
      else if (this._readCallback)
        this._readCallback = this._readCallback(token);
    };
    if (onComment) {
      this._lexer.comments = true;
      processNextToken = (error, token) => {
        if (error !== null)
          this._callback(error), this._callback = noop;
        else if (this._readCallback) {
          if (token.type === "comment")
            onComment(token.value);
          else
            this._readCallback = this._readCallback(token);
        }
      };
    }
    this._callback = onQuad;
    this._lexer.tokenize(input, processNextToken);
  }
}
function noop() {}
function initDataFactory(parser, factory) {
  parser._factory = factory;
  parser.DEFAULTGRAPH = factory.defaultGraph();
  parser.RDF_FIRST = factory.namedNode(IRIs_default.rdf.first);
  parser.RDF_REST = factory.namedNode(IRIs_default.rdf.rest);
  parser.RDF_NIL = factory.namedNode(IRIs_default.rdf.nil);
  parser.RDF_REIFIES = factory.namedNode(IRIs_default.rdf.reifies);
  parser.N3_FORALL = factory.namedNode(IRIs_default.r.forAll);
  parser.N3_FORSOME = factory.namedNode(IRIs_default.r.forSome);
  parser.ABBREVIATIONS = {
    a: factory.namedNode(IRIs_default.rdf.type),
    "=": factory.namedNode(IRIs_default.owl.sameAs),
    ">": factory.namedNode(IRIs_default.log.implies),
    "<": factory.namedNode(IRIs_default.log.isImpliedBy)
  };
  parser.QUANTIFIERS_GRAPH = factory.namedNode("urn:n3:quantifiers");
}
var blankNodePrefix = 0;
var init_N3Parser = __esm(() => {
  init_N3Lexer();
  init_N3DataFactory();
  init_IRIs();
  N3Parser.SUPPORTED_VERSIONS = [
    "1.2",
    "1.2-basic",
    "1.1"
  ];
  initDataFactory(N3Parser.prototype, N3DataFactory_default);
});

// node_modules/n3/src/N3Util.js
function isDefaultGraph(term) {
  return !!term && term.termType === "DefaultGraph";
}
var init_N3Util = () => {};

// node_modules/n3/src/Util.js
function escapeRegex(regex) {
  return regex.replace(/[\]\/\(\)\*\+\?\.\\\$]/g, "\\$&");
}

// node_modules/n3/src/BaseIRI.js
class BaseIRI {
  constructor(base) {
    this.base = base;
    this._baseLength = 0;
    this._baseMatcher = null;
    this._pathReplacements = new Array(base.length + 1);
  }
  static supports(base) {
    return !BASE_UNSUPPORTED.test(base);
  }
  _getBaseMatcher() {
    if (this._baseMatcher)
      return this._baseMatcher;
    if (!BaseIRI.supports(this.base))
      return this._baseMatcher = /.^/;
    const scheme = /^[^:]*:\/*/.exec(this.base)[0];
    const regexHead = ["^", escapeRegex(scheme)];
    const regexTail = [];
    const segments = [], segmenter = /[^/?#]*([/?#])/y;
    let segment, query = 0, fragment = 0, last = segmenter.lastIndex = scheme.length;
    while (!query && !fragment && (segment = segmenter.exec(this.base))) {
      if (segment[1] === FRAGMENT)
        fragment = segmenter.lastIndex - 1;
      else {
        regexHead.push(escapeRegex(segment[0]), "(?:");
        regexTail.push(")?");
        if (segment[1] !== QUERY)
          segments.push(last = segmenter.lastIndex);
        else {
          query = last = segmenter.lastIndex;
          fragment = this.base.indexOf(FRAGMENT, query);
          this._pathReplacements[query] = QUERY;
        }
      }
    }
    for (let i2 = 0;i2 < segments.length; i2++)
      this._pathReplacements[segments[i2]] = PARENT.repeat(segments.length - i2 - 1);
    this._pathReplacements[segments[segments.length - 1]] = CURRENT;
    this._baseLength = fragment > 0 ? fragment : this.base.length;
    regexHead.push(escapeRegex(this.base.substring(last, this._baseLength)), query ? "(?:#|$)" : "(?:[?#]|$)");
    return this._baseMatcher = new RegExp([...regexHead, ...regexTail].join(""));
  }
  toRelative(iri) {
    const match = this._getBaseMatcher().exec(iri);
    if (!match)
      return iri;
    const length = match[0].length;
    if (length === this._baseLength && length === iri.length)
      return "";
    const parentPath = this._pathReplacements[length];
    if (parentPath) {
      const suffix = iri.substring(length);
      if (parentPath !== QUERY && !SUFFIX_SUPPORTED.test(suffix))
        return iri;
      if (parentPath === CURRENT && /^[^?#]/.test(suffix))
        return suffix;
      return parentPath + suffix;
    }
    return iri.substring(length - 1);
  }
}
var BASE_UNSUPPORTED, SUFFIX_SUPPORTED, CURRENT = "./", PARENT = "../", QUERY = "?", FRAGMENT = "#";
var init_BaseIRI = __esm(() => {
  BASE_UNSUPPORTED = /^:?[^:?#]*(?:[?#]|$)|^file:|^[^:]*:\/*[^?#]+?\/(?:\.\.?(?:\/|$)|\/)/i;
  SUFFIX_SUPPORTED = /^(?:(?:[^/?#]{3,}|\.?[^/?#.]\.?)(?:\/[^/?#]{3,}|\.?[^/?#.]\.?)*\/?)?(?:[?#]|$)/;
});

// node_modules/n3/src/N3Writer.js
class N3Writer {
  constructor(outputStream, options) {
    this._prefixRegex = /$0^/;
    if (outputStream && typeof outputStream.write !== "function")
      options = outputStream, outputStream = null;
    options = options || {};
    this._lists = options.lists;
    if (!outputStream) {
      let output = "";
      this._outputStream = {
        write(chunk, encoding, done) {
          output += chunk;
          done && done();
        },
        end: (done) => {
          done && done(null, output);
        }
      };
      this._endStream = true;
    } else {
      this._outputStream = outputStream;
      this._endStream = options.end === undefined ? true : !!options.end;
    }
    this._subject = null;
    if (!/triple|quad/i.test(options.format)) {
      this._lineMode = false;
      this._graph = DEFAULTGRAPH2;
      this._prefixIRIs = Object.create(null);
      options.prefixes && this.addPrefixes(options.prefixes);
      if (options.baseIRI) {
        this._baseIri = new BaseIRI(options.baseIRI);
      }
    } else {
      this._lineMode = true;
      this._writeQuad = this._writeQuadLine;
    }
  }
  get _inDefaultGraph() {
    return DEFAULTGRAPH2.equals(this._graph);
  }
  _write(string, callback) {
    this._outputStream.write(string, "utf8", callback);
  }
  _writeQuad(subject, predicate, object, graph, done) {
    try {
      if (!graph.equals(this._graph)) {
        this._write((this._subject === null ? "" : this._inDefaultGraph ? `.
` : `
}
`) + (DEFAULTGRAPH2.equals(graph) ? "" : `${this._encodeIriOrBlank(graph)} {
`));
        this._graph = graph;
        this._subject = null;
      }
      if (subject.equals(this._subject)) {
        if (predicate.equals(this._predicate))
          this._write(`, ${this._encodeObject(object)}`, done);
        else
          this._write(`;
    ${this._encodePredicate(this._predicate = predicate)} ${this._encodeObject(object)}`, done);
      } else
        this._write(`${(this._subject === null ? "" : `.
`) + this._encodeSubject(this._subject = subject)} ${this._encodePredicate(this._predicate = predicate)} ${this._encodeObject(object)}`, done);
    } catch (error) {
      done && done(error);
    }
  }
  _writeQuadLine(subject, predicate, object, graph, done) {
    delete this._prefixMatch;
    this._write(this.quadToString(subject, predicate, object, graph), done);
  }
  quadToString(subject, predicate, object, graph) {
    return `${this._encodeSubject(subject)} ${this._encodeIriOrBlank(predicate)} ${this._encodeObject(object)}${graph && graph.value ? ` ${this._encodeIriOrBlank(graph)} .
` : ` .
`}`;
  }
  quadsToString(quads) {
    let quadsString = "";
    for (const quad2 of quads)
      quadsString += this.quadToString(quad2.subject, quad2.predicate, quad2.object, quad2.graph);
    return quadsString;
  }
  _encodeSubject(entity) {
    return entity.termType === "Quad" ? this._encodeQuad(entity) : this._encodeIriOrBlank(entity);
  }
  _encodeIriOrBlank(entity) {
    if (entity.termType !== "NamedNode") {
      if (this._lists && entity.value in this._lists)
        entity = this.list(this._lists[entity.value]);
      return "id" in entity ? entity.id : `_:${entity.value}`;
    }
    let iri = entity.value;
    if (this._baseIri) {
      iri = this._baseIri.toRelative(iri);
    }
    if (escape.test(iri))
      iri = iri.replace(escapeAll, characterReplacer);
    const prefixMatch = this._prefixRegex.exec(iri);
    return !prefixMatch ? `<${iri}>` : !prefixMatch[1] ? iri : this._prefixIRIs[prefixMatch[1]] + prefixMatch[2];
  }
  _encodeLiteral(literal2) {
    let value = literal2.value;
    if (escape.test(value))
      value = value.replace(escapeAll, characterReplacer);
    const direction = literal2.direction ? `--${literal2.direction}` : "";
    if (literal2.language)
      return `"${value}"@${literal2.language}${direction}`;
    if (this._lineMode) {
      if (literal2.datatype.value === xsd3.string)
        return `"${value}"`;
    } else {
      switch (literal2.datatype.value) {
        case xsd3.string:
          return `"${value}"`;
        case xsd3.boolean:
          if (value === "true" || value === "false")
            return value;
          break;
        case xsd3.integer:
          if (/^[+-]?\d+$/.test(value))
            return value;
          break;
        case xsd3.decimal:
          if (/^[+-]?\d*\.\d+$/.test(value))
            return value;
          break;
        case xsd3.double:
          if (/^[+-]?(?:\d+\.\d*|\.?\d+)[eE][+-]?\d+$/.test(value))
            return value;
          break;
      }
    }
    return `"${value}"^^${this._encodeIriOrBlank(literal2.datatype)}`;
  }
  _encodePredicate(predicate) {
    return predicate.value === rdf2.type ? "a" : this._encodeIriOrBlank(predicate);
  }
  _encodeObject(object) {
    switch (object.termType) {
      case "Quad":
        return this._encodeQuad(object);
      case "Literal":
        return this._encodeLiteral(object);
      default:
        return this._encodeIriOrBlank(object);
    }
  }
  _encodeQuad({ subject, predicate, object, graph }) {
    return `<<(${this._encodeSubject(subject)} ${this._encodePredicate(predicate)} ${this._encodeObject(object)}${isDefaultGraph(graph) ? "" : ` ${this._encodeIriOrBlank(graph)}`})>>`;
  }
  _blockedWrite() {
    throw new Error("Cannot write because the writer has been closed.");
  }
  addQuad(subject, predicate, object, graph, done) {
    if (object === undefined)
      this._writeQuad(subject.subject, subject.predicate, subject.object, subject.graph, predicate);
    else if (typeof graph === "function")
      this._writeQuad(subject, predicate, object, DEFAULTGRAPH2, graph);
    else
      this._writeQuad(subject, predicate, object, graph || DEFAULTGRAPH2, done);
  }
  addQuads(quads) {
    for (let i2 = 0;i2 < quads.length; i2++)
      this.addQuad(quads[i2]);
  }
  addPrefix(prefix, iri, done) {
    const prefixes = {};
    prefixes[prefix] = iri;
    this.addPrefixes(prefixes, done);
  }
  addPrefixes(prefixes, done) {
    if (!this._prefixIRIs)
      return done && done();
    let hasPrefixes = false;
    for (let prefix in prefixes) {
      let iri = prefixes[prefix];
      if (typeof iri !== "string")
        iri = iri.value;
      hasPrefixes = true;
      if (this._subject !== null) {
        this._write(this._inDefaultGraph ? `.
` : `
}
`);
        this._subject = null, this._graph = "";
      }
      this._prefixIRIs[iri] = prefix += ":";
      this._write(`@prefix ${prefix} <${iri}>.
`);
    }
    if (hasPrefixes) {
      let IRIlist = "", prefixList = "";
      for (const prefixIRI in this._prefixIRIs) {
        IRIlist += IRIlist ? `|${prefixIRI}` : prefixIRI;
        prefixList += (prefixList ? "|" : "") + this._prefixIRIs[prefixIRI];
      }
      IRIlist = escapeRegex(IRIlist, /[\]\/\(\)\*\+\?\.\\\$]/g, "\\$&");
      this._prefixRegex = new RegExp(`^(?:${prefixList})[^/]*$|` + `^(${IRIlist})([_a-zA-Z0-9][\\-_a-zA-Z0-9]*)$`);
    }
    this._write(hasPrefixes ? `
` : "", done);
  }
  blank(predicate, object) {
    let children = predicate, child, length;
    if (predicate === undefined)
      children = [];
    else if (predicate.termType)
      children = [{ predicate, object }];
    else if (!("length" in predicate))
      children = [predicate];
    switch (length = children.length) {
      case 0:
        return new SerializedTerm("[]");
      case 1:
        child = children[0];
        if (!(child.object instanceof SerializedTerm))
          return new SerializedTerm(`[ ${this._encodePredicate(child.predicate)} ${this._encodeObject(child.object)} ]`);
      default:
        let contents = "[";
        for (let i2 = 0;i2 < length; i2++) {
          child = children[i2];
          if (child.predicate.equals(predicate))
            contents += `, ${this._encodeObject(child.object)}`;
          else {
            contents += `${(i2 ? `;
  ` : `
  `) + this._encodePredicate(child.predicate)} ${this._encodeObject(child.object)}`;
            predicate = child.predicate;
          }
        }
        return new SerializedTerm(`${contents}
]`);
    }
  }
  list(elements) {
    const length = elements && elements.length || 0, contents = new Array(length);
    for (let i2 = 0;i2 < length; i2++)
      contents[i2] = this._encodeObject(elements[i2]);
    return new SerializedTerm(`(${contents.join(" ")})`);
  }
  end(done) {
    if (this._subject !== null) {
      this._write(this._inDefaultGraph ? `.
` : `
}
`);
      this._subject = null;
    }
    this._write = this._blockedWrite;
    let singleDone = done && ((error, result) => {
      singleDone = null, done(error, result);
    });
    if (this._endStream) {
      try {
        return this._outputStream.end(singleDone);
      } catch (error) {}
    }
    singleDone && singleDone();
  }
}
function characterReplacer(character) {
  let result = escapedCharacters[character];
  if (result === undefined) {
    if (character.length === 1) {
      result = character.charCodeAt(0).toString(16);
      result = "\\u0000".substr(0, 6 - result.length) + result;
    } else {
      result = ((character.charCodeAt(0) - 55296) * 1024 + character.charCodeAt(1) + 9216).toString(16);
      result = "\\U00000000".substr(0, 10 - result.length) + result;
    }
  }
  return result;
}
var DEFAULTGRAPH2, rdf2, xsd3, escape, escapeAll, escapedCharacters, SerializedTerm;
var init_N3Writer = __esm(() => {
  init_IRIs();
  init_N3DataFactory();
  init_N3Util();
  init_BaseIRI();
  DEFAULTGRAPH2 = N3DataFactory_default.defaultGraph();
  ({ rdf: rdf2, xsd: xsd3 } = IRIs_default);
  escape = /["\\\t\n\r\b\f\u0000-\u0019\ud800-\udbff]/;
  escapeAll = /["\\\t\n\r\b\f\u0000-\u0019]|[\ud800-\udbff][\udc00-\udfff]/g;
  escapedCharacters = {
    "\\": "\\\\",
    '"': "\\\"",
    "\t": "\\t",
    "\n": "\\n",
    "\r": "\\r",
    "\b": "\\b",
    "\f": "\\f"
  };
  SerializedTerm = class SerializedTerm extends Term {
    equals(other) {
      return other === this;
    }
  };
});

// node_modules/n3/src/index.js
var init_src = __esm(() => {
  init_N3Parser();
  init_N3Writer();
  init_N3DataFactory();
});

// node_modules/rdf-canonize/lib/IdentifierIssuer.js
var require_IdentifierIssuer = __commonJS((exports, module) => {
  module.exports = class IdentifierIssuer {
    constructor(prefix, existing = new Map, counter = 0) {
      this.prefix = prefix;
      this._existing = existing;
      this.counter = counter;
    }
    clone() {
      const { prefix, _existing, counter } = this;
      return new IdentifierIssuer(prefix, new Map(_existing), counter);
    }
    getId(old) {
      const existing = old && this._existing.get(old);
      if (existing) {
        return existing;
      }
      const identifier = this.prefix + this.counter;
      this.counter++;
      if (old) {
        this._existing.set(old, identifier);
      }
      return identifier;
    }
    hasId(old) {
      return this._existing.has(old);
    }
    getOldIds() {
      return [...this._existing.keys()];
    }
  };
});

// node_modules/setimmediate/setImmediate.js
var require_setImmediate = __commonJS((exports) => {
  (function(global2, undefined2) {
    if (global2.setImmediate) {
      return;
    }
    var nextHandle = 1;
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global2.document;
    var registerImmediate;
    function setImmediate2(callback) {
      if (typeof callback !== "function") {
        callback = new Function("" + callback);
      }
      var args = new Array(arguments.length - 1);
      for (var i2 = 0;i2 < args.length; i2++) {
        args[i2] = arguments[i2 + 1];
      }
      var task = { callback, args };
      tasksByHandle[nextHandle] = task;
      registerImmediate(nextHandle);
      return nextHandle++;
    }
    function clearImmediate(handle) {
      delete tasksByHandle[handle];
    }
    function run(task) {
      var callback = task.callback;
      var args = task.args;
      switch (args.length) {
        case 0:
          callback();
          break;
        case 1:
          callback(args[0]);
          break;
        case 2:
          callback(args[0], args[1]);
          break;
        case 3:
          callback(args[0], args[1], args[2]);
          break;
        default:
          callback.apply(undefined2, args);
          break;
      }
    }
    function runIfPresent(handle) {
      if (currentlyRunningATask) {
        setTimeout(runIfPresent, 0, handle);
      } else {
        var task = tasksByHandle[handle];
        if (task) {
          currentlyRunningATask = true;
          try {
            run(task);
          } finally {
            clearImmediate(handle);
            currentlyRunningATask = false;
          }
        }
      }
    }
    function installNextTickImplementation() {
      registerImmediate = function(handle) {
        process.nextTick(function() {
          runIfPresent(handle);
        });
      };
    }
    function canUsePostMessage() {
      if (global2.postMessage && !global2.importScripts) {
        var postMessageIsAsynchronous = true;
        var oldOnMessage = global2.onmessage;
        global2.onmessage = function() {
          postMessageIsAsynchronous = false;
        };
        global2.postMessage("", "*");
        global2.onmessage = oldOnMessage;
        return postMessageIsAsynchronous;
      }
    }
    function installPostMessageImplementation() {
      var messagePrefix = "setImmediate$" + Math.random() + "$";
      var onGlobalMessage = function(event) {
        if (event.source === global2 && typeof event.data === "string" && event.data.indexOf(messagePrefix) === 0) {
          runIfPresent(+event.data.slice(messagePrefix.length));
        }
      };
      if (global2.addEventListener) {
        global2.addEventListener("message", onGlobalMessage, false);
      } else {
        global2.attachEvent("onmessage", onGlobalMessage);
      }
      registerImmediate = function(handle) {
        global2.postMessage(messagePrefix + handle, "*");
      };
    }
    function installMessageChannelImplementation() {
      var channel = new MessageChannel;
      channel.port1.onmessage = function(event) {
        var handle = event.data;
        runIfPresent(handle);
      };
      registerImmediate = function(handle) {
        channel.port2.postMessage(handle);
      };
    }
    function installReadyStateChangeImplementation() {
      var html = doc.documentElement;
      registerImmediate = function(handle) {
        var script = doc.createElement("script");
        script.onreadystatechange = function() {
          runIfPresent(handle);
          script.onreadystatechange = null;
          html.removeChild(script);
          script = null;
        };
        html.appendChild(script);
      };
    }
    function installSetTimeoutImplementation() {
      registerImmediate = function(handle) {
        setTimeout(runIfPresent, 0, handle);
      };
    }
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global2);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global2;
    if ({}.toString.call(global2.process) === "[object process]") {
      installNextTickImplementation();
    } else if (canUsePostMessage()) {
      installPostMessageImplementation();
    } else if (global2.MessageChannel) {
      installMessageChannelImplementation();
    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
      installReadyStateChangeImplementation();
    } else {
      installSetTimeoutImplementation();
    }
    attachTo.setImmediate = setImmediate2;
    attachTo.clearImmediate = clearImmediate;
  })(typeof self === "undefined" ? typeof global === "undefined" ? exports : global : self);
});

// node_modules/rdf-canonize/lib/platform-browser.js
var require_platform_browser = __commonJS((exports) => {
  /*!
   * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
   */
  require_setImmediate();
  exports.setImmediate = setImmediate;
  exports.crypto = globalThis.crypto;
  var byteToHex = [];
  for (let n = 0;n <= 255; ++n) {
    byteToHex.push(n.toString(16).padStart(2, "0"));
  }
  exports.bufferToHex = function bufferToHex(buffer) {
    let hex = "";
    const bytes = new Uint8Array(buffer);
    for (let i2 = 0;i2 < bytes.length; ++i2) {
      hex += byteToHex[bytes[i2]];
    }
    return hex;
  };
});

// node_modules/rdf-canonize/lib/MessageDigest-webcrypto.js
var require_MessageDigest_webcrypto = __commonJS((exports, module) => {
  /*!
   * Copyright (c) 2016-2023 Digital Bazaar, Inc. All rights reserved.
   */
  var { bufferToHex, crypto } = require_platform_browser();
  var algorithmMap = new Map([
    ["sha256", "SHA-256"],
    ["SHA256", "SHA-256"],
    ["SHA-256", "SHA-256"],
    ["sha384", "SHA-384"],
    ["SHA384", "SHA-384"],
    ["SHA-384", "SHA-384"],
    ["sha512", "SHA-512"],
    ["SHA512", "SHA-512"],
    ["SHA-512", "SHA-512"]
  ]);
  module.exports = class MessageDigest {
    constructor(algorithm) {
      if (!(crypto && crypto.subtle)) {
        throw new Error("crypto.subtle not found.");
      }
      if (!algorithmMap.has(algorithm)) {
        throw new Error(`Unsupported algorithm "${algorithm}".`);
      }
      this.algorithm = algorithmMap.get(algorithm);
      this._content = "";
    }
    update(msg) {
      this._content += msg;
    }
    async digest() {
      const data = new TextEncoder().encode(this._content);
      const buffer = await crypto.subtle.digest(this.algorithm, data);
      return bufferToHex(buffer);
    }
  };
});

// node_modules/rdf-canonize/lib/Permuter.js
var require_Permuter = __commonJS((exports, module) => {
  /*!
   * Copyright (c) 2016-2022 Digital Bazaar, Inc. All rights reserved.
   */
  module.exports = class Permuter {
    constructor(list) {
      this.current = list.sort();
      this.done = false;
      this.dir = new Map;
      for (let i2 = 0;i2 < list.length; ++i2) {
        this.dir.set(list[i2], true);
      }
    }
    hasNext() {
      return !this.done;
    }
    next() {
      const { current, dir } = this;
      const rval = current.slice();
      let k = null;
      let pos = 0;
      const length = current.length;
      for (let i2 = 0;i2 < length; ++i2) {
        const element = current[i2];
        const left = dir.get(element);
        if ((k === null || element > k) && (left && i2 > 0 && element > current[i2 - 1] || !left && i2 < length - 1 && element > current[i2 + 1])) {
          k = element;
          pos = i2;
        }
      }
      if (k === null) {
        this.done = true;
      } else {
        const swap2 = dir.get(k) ? pos - 1 : pos + 1;
        current[pos] = current[swap2];
        current[swap2] = k;
        for (const element of current) {
          if (element > k) {
            dir.set(element, !dir.get(element));
          }
        }
      }
      return rval;
    }
  };
});

// node_modules/rdf-canonize/lib/NQuads.js
var require_NQuads = __commonJS((exports, module) => {
  /*!
   * Copyright (c) 2016-2022 Digital Bazaar, Inc. All rights reserved.
   */
  var RDF2 = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  var RDF_LANGSTRING = RDF2 + "langString";
  var XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
  var TYPE_NAMED_NODE = "NamedNode";
  var TYPE_BLANK_NODE = "BlankNode";
  var TYPE_LITERAL = "Literal";
  var TYPE_DEFAULT_GRAPH = "DefaultGraph";
  var REGEX = {};
  (() => {
    const PN_CHARS_BASE = "A-Z" + "a-z" + "À-Ö" + "Ø-ö" + "ø-˿" + "Ͱ-ͽ" + "Ϳ-῿" + "‌-‍" + "⁰-↏" + "Ⰰ-⿯" + "、-퟿" + "豈-﷏" + "ﷰ-�";
    const PN_CHARS_U = PN_CHARS_BASE + "_";
    const PN_CHARS = PN_CHARS_U + "0-9" + "-" + "·" + "̀-ͯ" + "‿-⁀";
    const BLANK_NODE_LABEL = "_:(" + "(?:[" + PN_CHARS_U + "0-9])" + "(?:(?:[" + PN_CHARS + ".])*(?:[" + PN_CHARS + "]))?" + ")";
    const UCHAR4 = "\\\\u[0-9A-Fa-f]{4}";
    const UCHAR8 = "\\\\U[0-9A-Fa-f]{8}";
    const IRI = "(?:<((?:" + '[^\x00- <>"{}|^`\\\\]' + "|" + UCHAR4 + "|" + UCHAR8 + ")*)>)";
    const bnode = BLANK_NODE_LABEL;
    const plain = '"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"';
    const datatype = "(?:\\^\\^" + IRI + ")";
    const language = "(?:@([a-zA-Z]+(?:-[a-zA-Z0-9]+)*))";
    const literal2 = "(?:" + plain + "(?:" + datatype + "|" + language + ")?)";
    const ws = "[ \\t]+";
    const wso = "[ \\t]*";
    const subject = "(?:" + IRI + "|" + bnode + ")" + ws;
    const property = IRI + ws;
    const object = "(?:" + IRI + "|" + bnode + "|" + literal2 + ")" + wso;
    const graphName = "(?:\\.|(?:(?:" + IRI + "|" + bnode + ")" + wso + "\\.))";
    REGEX.eoln = /(?:\r\n)|(?:\n)|(?:\r)/g;
    REGEX.empty = new RegExp("^" + wso + "$");
    REGEX.quad = new RegExp("^" + wso + subject + property + object + graphName + wso + "$");
  })();
  module.exports = class NQuads {
    static parse(input) {
      const dataset = [];
      const graphs = {};
      const lines = input.split(REGEX.eoln);
      let lineNumber = 0;
      for (const line of lines) {
        lineNumber++;
        if (REGEX.empty.test(line)) {
          continue;
        }
        const match = line.match(REGEX.quad);
        if (match === null) {
          throw new Error("N-Quads parse error on line " + lineNumber + ".");
        }
        const quad2 = { subject: null, predicate: null, object: null, graph: null };
        if (match[1] !== undefined) {
          quad2.subject = {
            termType: TYPE_NAMED_NODE,
            value: _iriUnescape(match[1])
          };
        } else {
          quad2.subject = {
            termType: TYPE_BLANK_NODE,
            value: match[2]
          };
        }
        quad2.predicate = {
          termType: TYPE_NAMED_NODE,
          value: _iriUnescape(match[3])
        };
        if (match[4] !== undefined) {
          quad2.object = {
            termType: TYPE_NAMED_NODE,
            value: _iriUnescape(match[4])
          };
        } else if (match[5] !== undefined) {
          quad2.object = {
            termType: TYPE_BLANK_NODE,
            value: match[5]
          };
        } else {
          quad2.object = {
            termType: TYPE_LITERAL,
            value: undefined,
            datatype: {
              termType: TYPE_NAMED_NODE
            }
          };
          if (match[7] !== undefined) {
            quad2.object.datatype.value = _iriUnescape(match[7]);
          } else if (match[8] !== undefined) {
            quad2.object.datatype.value = RDF_LANGSTRING;
            quad2.object.language = match[8];
          } else {
            quad2.object.datatype.value = XSD_STRING;
          }
          quad2.object.value = _stringLiteralUnescape(match[6]);
        }
        if (match[9] !== undefined) {
          quad2.graph = {
            termType: TYPE_NAMED_NODE,
            value: _iriUnescape(match[9])
          };
        } else if (match[10] !== undefined) {
          quad2.graph = {
            termType: TYPE_BLANK_NODE,
            value: match[10]
          };
        } else {
          quad2.graph = {
            termType: TYPE_DEFAULT_GRAPH,
            value: ""
          };
        }
        if (!(quad2.graph.value in graphs)) {
          graphs[quad2.graph.value] = [quad2];
          dataset.push(quad2);
        } else {
          let unique = true;
          const quads = graphs[quad2.graph.value];
          for (const q of quads) {
            if (_compareTriples(q, quad2)) {
              unique = false;
              break;
            }
          }
          if (unique) {
            quads.push(quad2);
            dataset.push(quad2);
          }
        }
      }
      return dataset;
    }
    static serialize(dataset) {
      const quads = [];
      for (const quad2 of dataset) {
        quads.push(NQuads.serializeQuad(quad2));
      }
      return quads.sort().join("");
    }
    static serializeQuadComponents(s, p, o, g) {
      let nquad = "";
      if (s.termType === TYPE_NAMED_NODE) {
        nquad += `<${_iriEscape(s.value)}>`;
      } else {
        nquad += `_:${s.value}`;
      }
      if (p.termType === TYPE_NAMED_NODE) {
        nquad += ` <${_iriEscape(p.value)}> `;
      } else {
        nquad += ` _:${p.value} `;
      }
      if (o.termType === TYPE_NAMED_NODE) {
        nquad += `<${_iriEscape(o.value)}>`;
      } else if (o.termType === TYPE_BLANK_NODE) {
        nquad += `_:${o.value}`;
      } else {
        nquad += `"${_stringLiteralEscape(o.value)}"`;
        if (o.datatype.value === RDF_LANGSTRING) {
          if (o.language) {
            nquad += `@${o.language}`;
          }
        } else if (o.datatype.value !== XSD_STRING) {
          nquad += `^^<${_iriEscape(o.datatype.value)}>`;
        }
      }
      if (g.termType === TYPE_NAMED_NODE) {
        nquad += ` <${_iriEscape(g.value)}>`;
      } else if (g.termType === TYPE_BLANK_NODE) {
        nquad += ` _:${g.value}`;
      }
      nquad += ` .
`;
      return nquad;
    }
    static serializeQuad(quad2) {
      return NQuads.serializeQuadComponents(quad2.subject, quad2.predicate, quad2.object, quad2.graph);
    }
  };
  function _compareTriples(t1, t2) {
    if (!(t1.subject.termType === t2.subject.termType && t1.object.termType === t2.object.termType)) {
      return false;
    }
    if (!(t1.subject.value === t2.subject.value && t1.predicate.value === t2.predicate.value && t1.object.value === t2.object.value)) {
      return false;
    }
    if (t1.object.termType !== TYPE_LITERAL) {
      return true;
    }
    return t1.object.datatype.termType === t2.object.datatype.termType && t1.object.language === t2.object.language && t1.object.datatype.value === t2.object.datatype.value;
  }
  var _stringLiteralEscapeRegex = /[\u0000-\u001F\u007F"\\]/g;
  var _stringLiteralEscapeMap = [];
  for (let n = 0;n <= 127; ++n) {
    if (_stringLiteralEscapeRegex.test(String.fromCharCode(n))) {
      _stringLiteralEscapeMap[n] = "\\u" + n.toString(16).toUpperCase().padStart(4, "0");
      _stringLiteralEscapeRegex.lastIndex = 0;
    }
  }
  _stringLiteralEscapeMap["\b".codePointAt(0)] = "\\b";
  _stringLiteralEscapeMap["\t".codePointAt(0)] = "\\t";
  _stringLiteralEscapeMap[`
`.codePointAt(0)] = "\\n";
  _stringLiteralEscapeMap["\f".codePointAt(0)] = "\\f";
  _stringLiteralEscapeMap["\r".codePointAt(0)] = "\\r";
  _stringLiteralEscapeMap['"'.codePointAt(0)] = "\\\"";
  _stringLiteralEscapeMap["\\".codePointAt(0)] = "\\\\";
  function _stringLiteralEscape(s) {
    if (!_stringLiteralEscapeRegex.test(s)) {
      return s;
    }
    return s.replace(_stringLiteralEscapeRegex, function(match) {
      return _stringLiteralEscapeMap[match.codePointAt(0)];
    });
  }
  var _stringLiteralUnescapeRegex = /(?:\\([btnfr"'\\]))|(?:\\u([0-9A-Fa-f]{4}))|(?:\\U([0-9A-Fa-f]{8}))/g;
  function _stringLiteralUnescape(s) {
    if (!_stringLiteralUnescapeRegex.test(s)) {
      return s;
    }
    return s.replace(_stringLiteralUnescapeRegex, function(match, code2, u, U) {
      if (code2) {
        switch (code2) {
          case "b":
            return "\b";
          case "t":
            return "\t";
          case "n":
            return `
`;
          case "f":
            return "\f";
          case "r":
            return "\r";
          case '"':
            return '"';
          case "'":
            return "'";
          case "\\":
            return "\\";
        }
      }
      if (u) {
        return String.fromCharCode(parseInt(u, 16));
      }
      if (U) {
        return String.fromCodePoint(parseInt(U, 16));
      }
    });
  }
  var _iriEscapeRegex = /[\u0000-\u0020<>"{}|^`\\]/g;
  var _iriEscapeRegexMap = [];
  for (let n = 0;n <= 127; ++n) {
    if (_iriEscapeRegex.test(String.fromCharCode(n))) {
      _iriEscapeRegexMap[n] = "\\u" + n.toString(16).toUpperCase().padStart(4, "0");
      _iriEscapeRegex.lastIndex = 0;
    }
  }
  function _iriEscape(s) {
    if (!_iriEscapeRegex.test(s)) {
      return s;
    }
    return s.replace(_iriEscapeRegex, function(match) {
      return _iriEscapeRegexMap[match.codePointAt(0)];
    });
  }
  var _iriUnescapeRegex = /(?:\\u([0-9A-Fa-f]{4}))|(?:\\U([0-9A-Fa-f]{8}))/g;
  function _iriUnescape(s) {
    if (!_iriUnescapeRegex.test(s)) {
      return s;
    }
    return s.replace(_iriUnescapeRegex, function(match, u, U) {
      if (u) {
        return String.fromCharCode(parseInt(u, 16));
      }
      if (U) {
        return String.fromCodePoint(parseInt(U, 16));
      }
    });
  }
});

// node_modules/rdf-canonize/lib/RDFC10.js
var require_RDFC10 = __commonJS((exports, module) => {
  /*!
   * Copyright (c) 2016-2023 Digital Bazaar, Inc. All rights reserved.
   */
  var IdentifierIssuer = require_IdentifierIssuer();
  var MessageDigest = require_MessageDigest_webcrypto();
  var Permuter = require_Permuter();
  var NQuads = require_NQuads();
  var { setImmediate: setImmediate2 } = require_platform_browser();
  module.exports = class RDFC10 {
    constructor({
      createMessageDigest = null,
      messageDigestAlgorithm = "sha256",
      canonicalIdMap = new Map,
      maxWorkFactor = 1,
      maxDeepIterations = -1,
      signal = null
    } = {}) {
      this.name = "RDFC-1.0";
      this.blankNodeInfo = new Map;
      this.canonicalIssuer = new IdentifierIssuer("c14n", canonicalIdMap);
      this.createMessageDigest = createMessageDigest || (() => new MessageDigest(messageDigestAlgorithm));
      this.maxWorkFactor = maxWorkFactor;
      this.maxDeepIterations = maxDeepIterations;
      this.remainingDeepIterations = 0;
      this.signal = signal;
      this.quads = null;
    }
    async main(dataset) {
      this.quads = dataset;
      for (const quad2 of dataset) {
        this._addBlankNodeQuadInfo({ quad: quad2, component: quad2.subject });
        this._addBlankNodeQuadInfo({ quad: quad2, component: quad2.object });
        this._addBlankNodeQuadInfo({ quad: quad2, component: quad2.graph });
      }
      const hashToBlankNodes = new Map;
      const nonNormalized = [...this.blankNodeInfo.keys()];
      let i2 = 0;
      for (const id of nonNormalized) {
        if (++i2 % 100 === 0) {
          await this._yield();
        }
        await this._hashAndTrackBlankNode({ id, hashToBlankNodes });
      }
      const hashes = [...hashToBlankNodes.keys()].sort();
      const nonUnique = [];
      for (const hash of hashes) {
        const idList = hashToBlankNodes.get(hash);
        if (idList.length > 1) {
          nonUnique.push(idList);
          continue;
        }
        const id = idList[0];
        this.canonicalIssuer.getId(id);
      }
      if (this.maxDeepIterations < 0) {
        if (this.maxWorkFactor === 0) {
          this.maxDeepIterations = 0;
        } else if (this.maxWorkFactor === Infinity) {
          this.maxDeepIterations = Infinity;
        } else {
          const nonUniqueCount = nonUnique.reduce((count, v) => count + v.length, 0);
          this.maxDeepIterations = nonUniqueCount ** this.maxWorkFactor;
        }
      }
      if (this.maxDeepIterations > Number.MAX_SAFE_INTEGER) {
        this.maxDeepIterations = Infinity;
      }
      this.remainingDeepIterations = this.maxDeepIterations;
      for (const idList of nonUnique) {
        const hashPathList = [];
        for (const id of idList) {
          if (this.canonicalIssuer.hasId(id)) {
            continue;
          }
          const issuer = new IdentifierIssuer("b");
          issuer.getId(id);
          const result = await this.hashNDegreeQuads(id, issuer);
          hashPathList.push(result);
        }
        hashPathList.sort(_stringHashCompare);
        for (const result of hashPathList) {
          const oldIds = result.issuer.getOldIds();
          for (const id of oldIds) {
            this.canonicalIssuer.getId(id);
          }
        }
      }
      const normalized = [];
      for (const quad2 of this.quads) {
        const nQuad = NQuads.serializeQuadComponents(this._componentWithCanonicalId(quad2.subject), quad2.predicate, this._componentWithCanonicalId(quad2.object), this._componentWithCanonicalId(quad2.graph));
        normalized.push(nQuad);
      }
      normalized.sort();
      return normalized.join("");
    }
    async hashFirstDegreeQuads(id) {
      const nquads = [];
      const info = this.blankNodeInfo.get(id);
      const quads = info.quads;
      for (const quad2 of quads) {
        nquads.push(NQuads.serializeQuadComponents(this.modifyFirstDegreeComponent(id, quad2.subject, "subject"), quad2.predicate, this.modifyFirstDegreeComponent(id, quad2.object, "object"), this.modifyFirstDegreeComponent(id, quad2.graph, "graph")));
      }
      nquads.sort();
      const md = this.createMessageDigest();
      for (const nquad of nquads) {
        md.update(nquad);
      }
      info.hash = await md.digest();
      return info.hash;
    }
    async hashRelatedBlankNode(related, quad2, issuer, position) {
      const md = this.createMessageDigest();
      md.update(position);
      if (position !== "g") {
        md.update(this.getRelatedPredicate(quad2));
      }
      let id;
      if (this.canonicalIssuer.hasId(related)) {
        id = "_:" + this.canonicalIssuer.getId(related);
      } else if (issuer.hasId(related)) {
        id = "_:" + issuer.getId(related);
      } else {
        id = this.blankNodeInfo.get(related).hash;
      }
      md.update(id);
      return md.digest();
    }
    async hashNDegreeQuads(id, issuer) {
      if (this.remainingDeepIterations === 0) {
        throw new Error(`Maximum deep iterations exceeded (${this.maxDeepIterations}).`);
      }
      this.remainingDeepIterations--;
      const md = this.createMessageDigest();
      const hashToRelated = await this.createHashToRelated(id, issuer);
      const hashes = [...hashToRelated.keys()].sort();
      for (const hash of hashes) {
        md.update(hash);
        let chosenPath = "";
        let chosenIssuer;
        const permuter = new Permuter(hashToRelated.get(hash));
        let i2 = 0;
        while (permuter.hasNext()) {
          const permutation = permuter.next();
          if (++i2 % 3 === 0) {
            if (this.signal && this.signal.aborted) {
              throw new Error(`Abort signal received: "${this.signal.reason}".`);
            }
            await this._yield();
          }
          let issuerCopy = issuer.clone();
          let path = "";
          const recursionList = [];
          let nextPermutation = false;
          for (const related of permutation) {
            if (this.canonicalIssuer.hasId(related)) {
              path += "_:" + this.canonicalIssuer.getId(related);
            } else {
              if (!issuerCopy.hasId(related)) {
                recursionList.push(related);
              }
              path += "_:" + issuerCopy.getId(related);
            }
            if (chosenPath.length !== 0 && path > chosenPath) {
              nextPermutation = true;
              break;
            }
          }
          if (nextPermutation) {
            continue;
          }
          for (const related of recursionList) {
            const result = await this.hashNDegreeQuads(related, issuerCopy);
            path += "_:" + issuerCopy.getId(related);
            path += `<${result.hash}>`;
            issuerCopy = result.issuer;
            if (chosenPath.length !== 0 && path > chosenPath) {
              nextPermutation = true;
              break;
            }
          }
          if (nextPermutation) {
            continue;
          }
          if (chosenPath.length === 0 || path < chosenPath) {
            chosenPath = path;
            chosenIssuer = issuerCopy;
          }
        }
        md.update(chosenPath);
        issuer = chosenIssuer;
      }
      return { hash: await md.digest(), issuer };
    }
    modifyFirstDegreeComponent(id, component) {
      if (component.termType !== "BlankNode") {
        return component;
      }
      return {
        termType: "BlankNode",
        value: component.value === id ? "a" : "z"
      };
    }
    getRelatedPredicate(quad2) {
      return `<${quad2.predicate.value}>`;
    }
    async createHashToRelated(id, issuer) {
      const hashToRelated = new Map;
      const quads = this.blankNodeInfo.get(id).quads;
      let i2 = 0;
      for (const quad2 of quads) {
        if (++i2 % 100 === 0) {
          await this._yield();
        }
        await Promise.all([
          this._addRelatedBlankNodeHash({
            quad: quad2,
            component: quad2.subject,
            position: "s",
            id,
            issuer,
            hashToRelated
          }),
          this._addRelatedBlankNodeHash({
            quad: quad2,
            component: quad2.object,
            position: "o",
            id,
            issuer,
            hashToRelated
          }),
          this._addRelatedBlankNodeHash({
            quad: quad2,
            component: quad2.graph,
            position: "g",
            id,
            issuer,
            hashToRelated
          })
        ]);
      }
      return hashToRelated;
    }
    async _hashAndTrackBlankNode({ id, hashToBlankNodes }) {
      const hash = await this.hashFirstDegreeQuads(id);
      const idList = hashToBlankNodes.get(hash);
      if (!idList) {
        hashToBlankNodes.set(hash, [id]);
      } else {
        idList.push(id);
      }
    }
    _addBlankNodeQuadInfo({ quad: quad2, component }) {
      if (component.termType !== "BlankNode") {
        return;
      }
      const id = component.value;
      const info = this.blankNodeInfo.get(id);
      if (info) {
        info.quads.add(quad2);
      } else {
        this.blankNodeInfo.set(id, { quads: new Set([quad2]), hash: null });
      }
    }
    async _addRelatedBlankNodeHash({ quad: quad2, component, position, id, issuer, hashToRelated }) {
      if (!(component.termType === "BlankNode" && component.value !== id)) {
        return;
      }
      const related = component.value;
      const hash = await this.hashRelatedBlankNode(related, quad2, issuer, position);
      const entries = hashToRelated.get(hash);
      if (entries) {
        entries.push(related);
      } else {
        hashToRelated.set(hash, [related]);
      }
    }
    _componentWithCanonicalId(component) {
      if (component.termType === "BlankNode" && !component.value.startsWith(this.canonicalIssuer.prefix)) {
        return {
          termType: "BlankNode",
          value: this.canonicalIssuer.getId(component.value)
        };
      }
      return component;
    }
    async _yield() {
      return new Promise((resolve2) => setImmediate2(resolve2));
    }
  };
  function _stringHashCompare(a, b) {
    return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0;
  }
});

// node_modules/rdf-canonize/lib/RDFC10Sync.js
var require_RDFC10Sync = __commonJS((exports, module) => {
  /*!
   * Copyright (c) 2016-2023 Digital Bazaar, Inc. All rights reserved.
   */
  var IdentifierIssuer = require_IdentifierIssuer();
  var MessageDigest = require_MessageDigest_webcrypto();
  var Permuter = require_Permuter();
  var NQuads = require_NQuads();
  module.exports = class RDFC10Sync {
    constructor({
      createMessageDigest = null,
      messageDigestAlgorithm = "sha256",
      canonicalIdMap = new Map,
      maxWorkFactor = 1,
      maxDeepIterations = -1,
      timeout = 0
    } = {}) {
      this.name = "RDFC-1.0";
      this.blankNodeInfo = new Map;
      this.canonicalIssuer = new IdentifierIssuer("c14n", canonicalIdMap);
      this.createMessageDigest = createMessageDigest || (() => new MessageDigest(messageDigestAlgorithm));
      this.maxWorkFactor = maxWorkFactor;
      this.maxDeepIterations = maxDeepIterations;
      this.remainingDeepIterations = 0;
      this.timeout = timeout;
      if (timeout > 0) {
        this.startTime = Date.now();
      }
      this.quads = null;
    }
    main(dataset) {
      this.quads = dataset;
      for (const quad2 of dataset) {
        this._addBlankNodeQuadInfo({ quad: quad2, component: quad2.subject });
        this._addBlankNodeQuadInfo({ quad: quad2, component: quad2.object });
        this._addBlankNodeQuadInfo({ quad: quad2, component: quad2.graph });
      }
      const hashToBlankNodes = new Map;
      const nonNormalized = [...this.blankNodeInfo.keys()];
      for (const id of nonNormalized) {
        this._hashAndTrackBlankNode({ id, hashToBlankNodes });
      }
      const hashes = [...hashToBlankNodes.keys()].sort();
      const nonUnique = [];
      for (const hash of hashes) {
        const idList = hashToBlankNodes.get(hash);
        if (idList.length > 1) {
          nonUnique.push(idList);
          continue;
        }
        const id = idList[0];
        this.canonicalIssuer.getId(id);
      }
      if (this.maxDeepIterations < 0) {
        if (this.maxWorkFactor === 0) {
          this.maxDeepIterations = 0;
        } else if (this.maxWorkFactor === Infinity) {
          this.maxDeepIterations = Infinity;
        } else {
          const nonUniqueCount = nonUnique.reduce((count, v) => count + v.length, 0);
          this.maxDeepIterations = nonUniqueCount ** this.maxWorkFactor;
        }
      }
      if (this.maxDeepIterations > Number.MAX_SAFE_INTEGER) {
        this.maxDeepIterations = Infinity;
      }
      this.remainingDeepIterations = this.maxDeepIterations;
      for (const idList of nonUnique) {
        const hashPathList = [];
        for (const id of idList) {
          if (this.canonicalIssuer.hasId(id)) {
            continue;
          }
          const issuer = new IdentifierIssuer("b");
          issuer.getId(id);
          const result = this.hashNDegreeQuads(id, issuer);
          hashPathList.push(result);
        }
        hashPathList.sort(_stringHashCompare);
        for (const result of hashPathList) {
          const oldIds = result.issuer.getOldIds();
          for (const id of oldIds) {
            this.canonicalIssuer.getId(id);
          }
        }
      }
      const normalized = [];
      for (const quad2 of this.quads) {
        const nQuad = NQuads.serializeQuadComponents(this._componentWithCanonicalId(quad2.subject), quad2.predicate, this._componentWithCanonicalId(quad2.object), this._componentWithCanonicalId(quad2.graph));
        normalized.push(nQuad);
      }
      normalized.sort();
      return normalized.join("");
    }
    hashFirstDegreeQuads(id) {
      const nquads = [];
      const info = this.blankNodeInfo.get(id);
      const quads = info.quads;
      for (const quad2 of quads) {
        nquads.push(NQuads.serializeQuadComponents(this.modifyFirstDegreeComponent(id, quad2.subject, "subject"), quad2.predicate, this.modifyFirstDegreeComponent(id, quad2.object, "object"), this.modifyFirstDegreeComponent(id, quad2.graph, "graph")));
      }
      nquads.sort();
      const md = this.createMessageDigest();
      for (const nquad of nquads) {
        md.update(nquad);
      }
      info.hash = md.digest();
      return info.hash;
    }
    hashRelatedBlankNode(related, quad2, issuer, position) {
      const md = this.createMessageDigest();
      md.update(position);
      if (position !== "g") {
        md.update(this.getRelatedPredicate(quad2));
      }
      let id;
      if (this.canonicalIssuer.hasId(related)) {
        id = "_:" + this.canonicalIssuer.getId(related);
      } else if (issuer.hasId(related)) {
        id = "_:" + issuer.getId(related);
      } else {
        id = this.blankNodeInfo.get(related).hash;
      }
      md.update(id);
      return md.digest();
    }
    hashNDegreeQuads(id, issuer) {
      if (this.remainingDeepIterations === 0) {
        throw new Error(`Maximum deep iterations exceeded (${this.maxDeepIterations}).`);
      }
      this.remainingDeepIterations--;
      const md = this.createMessageDigest();
      const hashToRelated = this.createHashToRelated(id, issuer);
      const hashes = [...hashToRelated.keys()].sort();
      for (const hash of hashes) {
        md.update(hash);
        let chosenPath = "";
        let chosenIssuer;
        const permuter = new Permuter(hashToRelated.get(hash));
        let i2 = 0;
        while (permuter.hasNext()) {
          const permutation = permuter.next();
          if (++i2 % 3 === 0) {
            if (this.timeout > 0 && Date.now() - this.startTime > this.timeout) {
              throw new Error("Canonize timeout.");
            }
          }
          let issuerCopy = issuer.clone();
          let path = "";
          const recursionList = [];
          let nextPermutation = false;
          for (const related of permutation) {
            if (this.canonicalIssuer.hasId(related)) {
              path += "_:" + this.canonicalIssuer.getId(related);
            } else {
              if (!issuerCopy.hasId(related)) {
                recursionList.push(related);
              }
              path += "_:" + issuerCopy.getId(related);
            }
            if (chosenPath.length !== 0 && path > chosenPath) {
              nextPermutation = true;
              break;
            }
          }
          if (nextPermutation) {
            continue;
          }
          for (const related of recursionList) {
            const result = this.hashNDegreeQuads(related, issuerCopy);
            path += "_:" + issuerCopy.getId(related);
            path += `<${result.hash}>`;
            issuerCopy = result.issuer;
            if (chosenPath.length !== 0 && path > chosenPath) {
              nextPermutation = true;
              break;
            }
          }
          if (nextPermutation) {
            continue;
          }
          if (chosenPath.length === 0 || path < chosenPath) {
            chosenPath = path;
            chosenIssuer = issuerCopy;
          }
        }
        md.update(chosenPath);
        issuer = chosenIssuer;
      }
      return { hash: md.digest(), issuer };
    }
    modifyFirstDegreeComponent(id, component) {
      if (component.termType !== "BlankNode") {
        return component;
      }
      return {
        termType: "BlankNode",
        value: component.value === id ? "a" : "z"
      };
    }
    getRelatedPredicate(quad2) {
      return `<${quad2.predicate.value}>`;
    }
    createHashToRelated(id, issuer) {
      const hashToRelated = new Map;
      const quads = this.blankNodeInfo.get(id).quads;
      for (const quad2 of quads) {
        this._addRelatedBlankNodeHash({
          quad: quad2,
          component: quad2.subject,
          position: "s",
          id,
          issuer,
          hashToRelated
        });
        this._addRelatedBlankNodeHash({
          quad: quad2,
          component: quad2.object,
          position: "o",
          id,
          issuer,
          hashToRelated
        });
        this._addRelatedBlankNodeHash({
          quad: quad2,
          component: quad2.graph,
          position: "g",
          id,
          issuer,
          hashToRelated
        });
      }
      return hashToRelated;
    }
    _hashAndTrackBlankNode({ id, hashToBlankNodes }) {
      const hash = this.hashFirstDegreeQuads(id);
      const idList = hashToBlankNodes.get(hash);
      if (!idList) {
        hashToBlankNodes.set(hash, [id]);
      } else {
        idList.push(id);
      }
    }
    _addBlankNodeQuadInfo({ quad: quad2, component }) {
      if (component.termType !== "BlankNode") {
        return;
      }
      const id = component.value;
      const info = this.blankNodeInfo.get(id);
      if (info) {
        info.quads.add(quad2);
      } else {
        this.blankNodeInfo.set(id, { quads: new Set([quad2]), hash: null });
      }
    }
    _addRelatedBlankNodeHash({ quad: quad2, component, position, id, issuer, hashToRelated }) {
      if (!(component.termType === "BlankNode" && component.value !== id)) {
        return;
      }
      const related = component.value;
      const hash = this.hashRelatedBlankNode(related, quad2, issuer, position);
      const entries = hashToRelated.get(hash);
      if (entries) {
        entries.push(related);
      } else {
        hashToRelated.set(hash, [related]);
      }
    }
    _componentWithCanonicalId(component) {
      if (component.termType === "BlankNode" && !component.value.startsWith(this.canonicalIssuer.prefix)) {
        return {
          termType: "BlankNode",
          value: this.canonicalIssuer.getId(component.value)
        };
      }
      return component;
    }
  };
  function _stringHashCompare(a, b) {
    return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0;
  }
});

// node_modules/rdf-canonize/lib/index.js
var require_lib = __commonJS((exports) => {
  var RDFC10 = require_RDFC10();
  var RDFC10Sync = require_RDFC10Sync();
  function _inputToDataset(input, options) {
    if (options.inputFormat) {
      if (options.inputFormat === "application/n-quads") {
        if (typeof input !== "string") {
          throw new Error("N-Quads input must be a string.");
        }
        return exports.NQuads.parse(input);
      }
      throw new Error(`Unknown canonicalization input format: "${options.inputFormat}".`);
    }
    return input;
  }
  function _checkOutputFormat(options) {
    if (options.format) {
      if (options.format !== "application/n-quads") {
        throw new Error(`Unknown canonicalization output format: "${options.format}".`);
      }
    }
  }
  function _traceURDNA2015() {
    if (!!globalThis.RDF_CANONIZE_TRACE_URDNA2015) {
      console.trace("[rdf-canonize] URDNA2015 is deprecated, use RDFC-1.0");
    }
  }
  exports.NQuads = require_NQuads();
  exports.IdentifierIssuer = require_IdentifierIssuer();
  exports.canonize = async function(input, options = {}) {
    const dataset = _inputToDataset(input, options);
    _checkOutputFormat(options);
    if (!("algorithm" in options)) {
      throw new Error("No RDF Dataset Canonicalization algorithm specified.");
    }
    if (options.algorithm === "RDFC-1.0") {
      return new RDFC10(options).main(dataset);
    }
    if (options.algorithm === "URDNA2015" && !options.rejectURDNA2015) {
      _traceURDNA2015();
      return new RDFC10(options).main(dataset);
    }
    throw new Error("Invalid RDF Dataset Canonicalization algorithm: " + options.algorithm);
  };
  exports._canonizeSync = function(input, options = {}) {
    const dataset = _inputToDataset(input, options);
    _checkOutputFormat(options);
    if (!("algorithm" in options)) {
      throw new Error("No RDF Dataset Canonicalization algorithm specified.");
    }
    if (options.algorithm === "RDFC-1.0") {
      return new RDFC10Sync(options).main(dataset);
    }
    if (options.algorithm === "URDNA2015" && !options.rejectURDNA2015) {
      _traceURDNA2015();
      return new RDFC10Sync(options).main(dataset);
    }
    throw new Error("Invalid RDF Dataset Canonicalization algorithm: " + options.algorithm);
  };
});

// node_modules/jsonld/lib/types.js
var require_types = __commonJS((exports, module) => {
  var api = {};
  module.exports = api;
  api.isArray = Array.isArray;
  api.isBoolean = (v) => typeof v === "boolean" || Object.prototype.toString.call(v) === "[object Boolean]";
  api.isDouble = (v) => api.isNumber(v) && (String(v).indexOf(".") !== -1 || Math.abs(v) >= 1000000000000000000000);
  api.isEmptyObject = (v) => api.isObject(v) && Object.keys(v).length === 0;
  api.isNumber = (v) => typeof v === "number" || Object.prototype.toString.call(v) === "[object Number]";
  api.isNumeric = (v) => !isNaN(parseFloat(v)) && isFinite(v);
  api.isObject = (v) => Object.prototype.toString.call(v) === "[object Object]";
  api.isString = (v) => typeof v === "string" || Object.prototype.toString.call(v) === "[object String]";
  api.isUndefined = (v) => typeof v === "undefined";
});

// node_modules/jsonld/lib/graphTypes.js
var require_graphTypes = __commonJS((exports, module) => {
  var types = require_types();
  var api = {};
  module.exports = api;
  api.isSubject = (v) => {
    if (types.isObject(v) && !(("@value" in v) || ("@set" in v) || ("@list" in v))) {
      const keyCount = Object.keys(v).length;
      return keyCount > 1 || !("@id" in v);
    }
    return false;
  };
  api.isSubjectReference = (v) => types.isObject(v) && Object.keys(v).length === 1 && ("@id" in v);
  api.isValue = (v) => types.isObject(v) && ("@value" in v);
  api.isList = (v) => types.isObject(v) && ("@list" in v);
  api.isGraph = (v) => {
    return types.isObject(v) && "@graph" in v && Object.keys(v).filter((key) => key !== "@id" && key !== "@index").length === 1;
  };
  api.isSimpleGraph = (v) => {
    return api.isGraph(v) && !("@id" in v);
  };
  api.isBlankNode = (v) => {
    if (types.isObject(v)) {
      if ("@id" in v) {
        const id = v["@id"];
        return !types.isString(id) || id.indexOf("_:") === 0;
      }
      return Object.keys(v).length === 0 || !(("@value" in v) || ("@set" in v) || ("@list" in v));
    }
    return false;
  };
});

// node_modules/jsonld/lib/JsonLdError.js
var require_JsonLdError = __commonJS((exports, module) => {
  module.exports = class JsonLdError extends Error {
    constructor(message = "An unspecified JSON-LD error occurred.", name = "jsonld.Error", details = {}) {
      super(message);
      this.name = name;
      this.message = message;
      this.details = details;
    }
  };
});

// node_modules/jsonld/lib/util.js
var require_util = __commonJS((exports, module) => {
  var graphTypes = require_graphTypes();
  var types = require_types();
  var IdentifierIssuer = require_lib().IdentifierIssuer;
  var JsonLdError = require_JsonLdError();
  var REGEX_BCP47 = /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/;
  var REGEX_LINK_HEADERS = /(?:<[^>]*?>|"[^"]*?"|[^,])+/g;
  var REGEX_LINK_HEADER = /\s*<([^>]*?)>\s*(?:;\s*(.*))?/;
  var REGEX_LINK_HEADER_PARAMS = /(.*?)=(?:(?:"([^"]*?)")|([^"]*?))\s*(?:(?:;\s*)|$)/g;
  var REGEX_KEYWORD = /^@[a-zA-Z]+$/;
  var DEFAULTS = {
    headers: {
      accept: "application/ld+json, application/json"
    }
  };
  var api = {};
  module.exports = api;
  api.IdentifierIssuer = IdentifierIssuer;
  api.REGEX_BCP47 = REGEX_BCP47;
  api.REGEX_KEYWORD = REGEX_KEYWORD;
  api.clone = function(value) {
    if (value && typeof value === "object") {
      let rval;
      if (types.isArray(value)) {
        rval = [];
        for (let i2 = 0;i2 < value.length; ++i2) {
          rval[i2] = api.clone(value[i2]);
        }
      } else if (value instanceof Map) {
        rval = new Map;
        for (const [k, v] of value) {
          rval.set(k, api.clone(v));
        }
      } else if (value instanceof Set) {
        rval = new Set;
        for (const v of value) {
          rval.add(api.clone(v));
        }
      } else if (types.isObject(value)) {
        rval = {};
        for (const key in value) {
          rval[key] = api.clone(value[key]);
        }
      } else {
        rval = value.toString();
      }
      return rval;
    }
    return value;
  };
  api.asArray = function(value) {
    return Array.isArray(value) ? value : [value];
  };
  api.buildHeaders = (headers = {}) => {
    const hasAccept = Object.keys(headers).some((h) => h.toLowerCase() === "accept");
    if (hasAccept) {
      throw new RangeError('Accept header may not be specified; only "' + DEFAULTS.headers.accept + '" is supported.');
    }
    return Object.assign({ Accept: DEFAULTS.headers.accept }, headers);
  };
  api.parseLinkHeader = (header) => {
    const rval = {};
    const entries = header.match(REGEX_LINK_HEADERS);
    for (let i2 = 0;i2 < entries.length; ++i2) {
      let match = entries[i2].match(REGEX_LINK_HEADER);
      if (!match) {
        continue;
      }
      const result = { target: match[1] };
      const params = match[2];
      while (match = REGEX_LINK_HEADER_PARAMS.exec(params)) {
        result[match[1]] = match[2] === undefined ? match[3] : match[2];
      }
      const rel = result.rel || "";
      if (Array.isArray(rval[rel])) {
        rval[rel].push(result);
      } else if (rval.hasOwnProperty(rel)) {
        rval[rel] = [rval[rel], result];
      } else {
        rval[rel] = result;
      }
    }
    return rval;
  };
  api.validateTypeValue = (v, isFrame) => {
    if (types.isString(v)) {
      return;
    }
    if (types.isArray(v) && v.every((vv) => types.isString(vv))) {
      return;
    }
    if (isFrame && types.isObject(v)) {
      switch (Object.keys(v).length) {
        case 0:
          return;
        case 1:
          if ("@default" in v && api.asArray(v["@default"]).every((vv) => types.isString(vv))) {
            return;
          }
      }
    }
    throw new JsonLdError('Invalid JSON-LD syntax; "@type" value must a string, an array of ' + "strings, an empty object, " + "or a default object.", "jsonld.SyntaxError", { code: "invalid type value", value: v });
  };
  api.hasProperty = (subject, property) => {
    if (subject.hasOwnProperty(property)) {
      const value = subject[property];
      return !types.isArray(value) || value.length > 0;
    }
    return false;
  };
  api.hasValue = (subject, property, value) => {
    if (api.hasProperty(subject, property)) {
      let val = subject[property];
      const isList = graphTypes.isList(val);
      if (types.isArray(val) || isList) {
        if (isList) {
          val = val["@list"];
        }
        for (let i2 = 0;i2 < val.length; ++i2) {
          if (api.compareValues(value, val[i2])) {
            return true;
          }
        }
      } else if (!types.isArray(value)) {
        return api.compareValues(value, val);
      }
    }
    return false;
  };
  api.addValue = (subject, property, value, options) => {
    options = options || {};
    if (!("propertyIsArray" in options)) {
      options.propertyIsArray = false;
    }
    if (!("valueIsArray" in options)) {
      options.valueIsArray = false;
    }
    if (!("allowDuplicate" in options)) {
      options.allowDuplicate = true;
    }
    if (!("prependValue" in options)) {
      options.prependValue = false;
    }
    if (options.valueIsArray) {
      subject[property] = value;
    } else if (types.isArray(value)) {
      if (value.length === 0 && options.propertyIsArray && !subject.hasOwnProperty(property)) {
        subject[property] = [];
      }
      if (options.prependValue) {
        value = value.concat(subject[property]);
        subject[property] = [];
      }
      for (let i2 = 0;i2 < value.length; ++i2) {
        api.addValue(subject, property, value[i2], options);
      }
    } else if (subject.hasOwnProperty(property)) {
      const hasValue = !options.allowDuplicate && api.hasValue(subject, property, value);
      if (!types.isArray(subject[property]) && (!hasValue || options.propertyIsArray)) {
        subject[property] = [subject[property]];
      }
      if (!hasValue) {
        if (options.prependValue) {
          subject[property].unshift(value);
        } else {
          subject[property].push(value);
        }
      }
    } else {
      subject[property] = options.propertyIsArray ? [value] : value;
    }
  };
  api.getValues = (subject, property) => [].concat(subject[property] || []);
  api.removeProperty = (subject, property) => {
    delete subject[property];
  };
  api.removeValue = (subject, property, value, options) => {
    options = options || {};
    if (!("propertyIsArray" in options)) {
      options.propertyIsArray = false;
    }
    const values = api.getValues(subject, property).filter((e) => !api.compareValues(e, value));
    if (values.length === 0) {
      api.removeProperty(subject, property);
    } else if (values.length === 1 && !options.propertyIsArray) {
      subject[property] = values[0];
    } else {
      subject[property] = values;
    }
  };
  api.relabelBlankNodes = (input, options) => {
    options = options || {};
    const issuer = options.issuer || new IdentifierIssuer("_:b");
    return _labelBlankNodes(issuer, input);
  };
  api.compareValues = (v1, v2) => {
    if (v1 === v2) {
      return true;
    }
    if (graphTypes.isValue(v1) && graphTypes.isValue(v2) && v1["@value"] === v2["@value"] && v1["@type"] === v2["@type"] && v1["@language"] === v2["@language"] && v1["@index"] === v2["@index"]) {
      return true;
    }
    if (types.isObject(v1) && "@id" in v1 && types.isObject(v2) && "@id" in v2) {
      return v1["@id"] === v2["@id"];
    }
    return false;
  };
  api.compareShortestLeast = (a, b) => {
    if (a.length < b.length) {
      return -1;
    }
    if (b.length < a.length) {
      return 1;
    }
    if (a === b) {
      return 0;
    }
    return a < b ? -1 : 1;
  };
  function _labelBlankNodes(issuer, element) {
    if (types.isArray(element)) {
      for (let i2 = 0;i2 < element.length; ++i2) {
        element[i2] = _labelBlankNodes(issuer, element[i2]);
      }
    } else if (graphTypes.isList(element)) {
      element["@list"] = _labelBlankNodes(issuer, element["@list"]);
    } else if (types.isObject(element)) {
      if (graphTypes.isBlankNode(element)) {
        element["@id"] = issuer.getId(element["@id"]);
      }
      const keys = Object.keys(element).sort();
      for (let ki = 0;ki < keys.length; ++ki) {
        const key = keys[ki];
        if (key !== "@id") {
          element[key] = _labelBlankNodes(issuer, element[key]);
        }
      }
    }
    return element;
  }
});

// node_modules/jsonld/lib/constants.js
var require_constants = __commonJS((exports, module) => {
  var RDF2 = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  var XSD2 = "http://www.w3.org/2001/XMLSchema#";
  module.exports = {
    LINK_HEADER_REL: "http://www.w3.org/ns/json-ld#context",
    LINK_HEADER_CONTEXT: "http://www.w3.org/ns/json-ld#context",
    RDF: RDF2,
    RDF_LIST: RDF2 + "List",
    RDF_FIRST: RDF2 + "first",
    RDF_REST: RDF2 + "rest",
    RDF_NIL: RDF2 + "nil",
    RDF_TYPE: RDF2 + "type",
    RDF_PLAIN_LITERAL: RDF2 + "PlainLiteral",
    RDF_XML_LITERAL: RDF2 + "XMLLiteral",
    RDF_JSON_LITERAL: RDF2 + "JSON",
    RDF_OBJECT: RDF2 + "object",
    RDF_LANGSTRING: RDF2 + "langString",
    XSD: XSD2,
    XSD_BOOLEAN: XSD2 + "boolean",
    XSD_DOUBLE: XSD2 + "double",
    XSD_INTEGER: XSD2 + "integer",
    XSD_STRING: XSD2 + "string"
  };
});

// node_modules/jsonld/lib/RequestQueue.js
var require_RequestQueue = __commonJS((exports, module) => {
  module.exports = class RequestQueue {
    constructor() {
      this._requests = {};
    }
    wrapLoader(loader) {
      const self2 = this;
      self2._loader = loader;
      return function() {
        return self2.add.apply(self2, arguments);
      };
    }
    async add(url) {
      let promise = this._requests[url];
      if (promise) {
        return Promise.resolve(promise);
      }
      promise = this._requests[url] = this._loader(url);
      try {
        return await promise;
      } finally {
        delete this._requests[url];
      }
    }
  };
});

// node_modules/jsonld/lib/url.js
var require_url = __commonJS((exports, module) => {
  var types = require_types();
  var api = {};
  module.exports = api;
  api.parsers = {
    simple: {
      keys: [
        "href",
        "scheme",
        "authority",
        "path",
        "query",
        "fragment"
      ],
      regex: /^(?:([^:\/?#]+):)?(?:\/\/([^\/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?/
    },
    full: {
      keys: [
        "href",
        "protocol",
        "scheme",
        "authority",
        "auth",
        "user",
        "password",
        "hostname",
        "port",
        "path",
        "directory",
        "file",
        "query",
        "fragment"
      ],
      regex: /^(([a-zA-Z][a-zA-Z0-9+-.]*):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?(?:(((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
  };
  api.parse = (str, parser) => {
    const parsed = {};
    const o = api.parsers[parser || "full"];
    const m = o.regex.exec(str);
    let i2 = o.keys.length;
    while (i2--) {
      parsed[o.keys[i2]] = m[i2] === undefined ? null : m[i2];
    }
    if (parsed.scheme === "https" && parsed.port === "443" || parsed.scheme === "http" && parsed.port === "80") {
      parsed.href = parsed.href.replace(":" + parsed.port, "");
      parsed.authority = parsed.authority.replace(":" + parsed.port, "");
      parsed.port = null;
    }
    parsed.normalizedPath = api.removeDotSegments(parsed.path);
    return parsed;
  };
  api.prependBase = (base, iri) => {
    if (base === null) {
      return iri;
    }
    if (api.isAbsolute(iri)) {
      return iri;
    }
    if (!base || types.isString(base)) {
      base = api.parse(base || "");
    }
    const rel = api.parse(iri);
    const transform = {
      protocol: base.protocol || ""
    };
    if (rel.authority !== null) {
      transform.authority = rel.authority;
      transform.path = rel.path;
      transform.query = rel.query;
    } else {
      transform.authority = base.authority;
      if (rel.path === "") {
        transform.path = base.path;
        if (rel.query !== null) {
          transform.query = rel.query;
        } else {
          transform.query = base.query;
        }
      } else {
        if (rel.path.indexOf("/") === 0) {
          transform.path = rel.path;
        } else {
          let path = base.path;
          path = path.substr(0, path.lastIndexOf("/") + 1);
          if ((path.length > 0 || base.authority) && path.substr(-1) !== "/") {
            path += "/";
          }
          path += rel.path;
          transform.path = path;
        }
        transform.query = rel.query;
      }
    }
    if (rel.path !== "") {
      transform.path = api.removeDotSegments(transform.path);
    }
    let rval = transform.protocol;
    if (transform.authority !== null) {
      rval += "//" + transform.authority;
    }
    rval += transform.path;
    if (transform.query !== null) {
      rval += "?" + transform.query;
    }
    if (rel.fragment !== null) {
      rval += "#" + rel.fragment;
    }
    if (rval === "") {
      rval = "./";
    }
    return rval;
  };
  api.removeBase = (base, iri) => {
    if (base === null) {
      return iri;
    }
    if (!base || types.isString(base)) {
      base = api.parse(base || "");
    }
    let root = "";
    if (base.href !== "") {
      root += (base.protocol || "") + "//" + (base.authority || "");
    } else if (iri.indexOf("//")) {
      root += "//";
    }
    if (iri.indexOf(root) !== 0) {
      return iri;
    }
    const rel = api.parse(iri.substr(root.length));
    const baseSegments = base.normalizedPath.split("/");
    const iriSegments = rel.normalizedPath.split("/");
    const last = rel.fragment || rel.query ? 0 : 1;
    while (baseSegments.length > 0 && iriSegments.length > last) {
      if (baseSegments[0] !== iriSegments[0]) {
        break;
      }
      baseSegments.shift();
      iriSegments.shift();
    }
    let rval = "";
    if (baseSegments.length > 0) {
      baseSegments.pop();
      for (let i2 = 0;i2 < baseSegments.length; ++i2) {
        rval += "../";
      }
    }
    rval += iriSegments.join("/");
    if (rel.query !== null) {
      rval += "?" + rel.query;
    }
    if (rel.fragment !== null) {
      rval += "#" + rel.fragment;
    }
    if (rval === "") {
      rval = "./";
    }
    return rval;
  };
  api.removeDotSegments = (path) => {
    if (path.length === 0) {
      return "";
    }
    const input = path.split("/");
    const output = [];
    while (input.length > 0) {
      const next = input.shift();
      const done = input.length === 0;
      if (next === ".") {
        if (done) {
          output.push("");
        }
        continue;
      }
      if (next === "..") {
        output.pop();
        if (done) {
          output.push("");
        }
        continue;
      }
      output.push(next);
    }
    if (path[0] === "/" && output.length > 0 && output[0] !== "") {
      output.unshift("");
    }
    if (output.length === 1 && output[0] === "") {
      return "/";
    }
    return output.join("/");
  };
  var isAbsoluteRegex = /^([A-Za-z][A-Za-z0-9+-.]*|_):[^\s]*$/;
  api.isAbsolute = (v) => types.isString(v) && isAbsoluteRegex.test(v);
  api.isRelative = (v) => types.isString(v);
});

// node_modules/jsonld/lib/documentLoaders/xhr.js
var require_xhr = __commonJS((exports, module) => {
  var { parseLinkHeader: parseLinkHeader2, buildHeaders } = require_util();
  var { LINK_HEADER_CONTEXT } = require_constants();
  var JsonLdError = require_JsonLdError();
  var RequestQueue = require_RequestQueue();
  var { prependBase } = require_url();
  var REGEX_LINK_HEADER = /(^|(\r\n))link:/i;
  module.exports = ({
    secure,
    headers = {},
    xhr
  } = { headers: {} }) => {
    headers = buildHeaders(headers);
    const queue = new RequestQueue;
    return queue.wrapLoader(loader);
    async function loader(url) {
      if (url.indexOf("http:") !== 0 && url.indexOf("https:") !== 0) {
        throw new JsonLdError('URL could not be dereferenced; only "http" and "https" URLs are ' + "supported.", "jsonld.InvalidUrl", { code: "loading document failed", url });
      }
      if (secure && url.indexOf("https") !== 0) {
        throw new JsonLdError("URL could not be dereferenced; secure mode is enabled and " + `the URL's scheme is not "https".`, "jsonld.InvalidUrl", { code: "loading document failed", url });
      }
      let req;
      try {
        req = await _get(xhr, url, headers);
      } catch (e) {
        throw new JsonLdError("URL could not be dereferenced, an error occurred.", "jsonld.LoadDocumentError", { code: "loading document failed", url, cause: e });
      }
      if (req.status >= 400) {
        throw new JsonLdError("URL could not be dereferenced: " + req.statusText, "jsonld.LoadDocumentError", {
          code: "loading document failed",
          url,
          httpStatusCode: req.status
        });
      }
      let doc = { contextUrl: null, documentUrl: url, document: req.response };
      let alternate = null;
      const contentType = req.getResponseHeader("Content-Type");
      let linkHeader;
      if (REGEX_LINK_HEADER.test(req.getAllResponseHeaders())) {
        linkHeader = req.getResponseHeader("Link");
      }
      if (linkHeader && contentType !== "application/ld+json") {
        const linkHeaders = parseLinkHeader2(linkHeader);
        const linkedContext = linkHeaders[LINK_HEADER_CONTEXT];
        if (Array.isArray(linkedContext)) {
          throw new JsonLdError("URL could not be dereferenced, it has more than one " + "associated HTTP Link Header.", "jsonld.InvalidUrl", { code: "multiple context link headers", url });
        }
        if (linkedContext) {
          doc.contextUrl = linkedContext.target;
        }
        alternate = linkHeaders.alternate;
        if (alternate && alternate.type == "application/ld+json" && !(contentType || "").match(/^application\/(\w*\+)?json$/)) {
          doc = await loader(prependBase(url, alternate.target));
        }
      }
      return doc;
    }
  };
  function _get(xhr, url, headers) {
    xhr = xhr || XMLHttpRequest;
    const req = new xhr;
    return new Promise((resolve2, reject) => {
      req.onload = () => resolve2(req);
      req.onerror = (err) => reject(err);
      req.open("GET", url, true);
      for (const k in headers) {
        req.setRequestHeader(k, headers[k]);
      }
      req.send();
    });
  }
});

// node_modules/jsonld/lib/platform-browser.js
var require_platform_browser2 = __commonJS((exports, module) => {
  var xhrLoader = require_xhr();
  var api = {};
  module.exports = api;
  api.setupDocumentLoaders = function(jsonld) {
    if (typeof XMLHttpRequest !== "undefined") {
      jsonld.documentLoaders.xhr = xhrLoader;
      jsonld.useDocumentLoader("xhr");
    }
  };
  api.setupGlobals = function(jsonld) {
    if (typeof globalThis.JsonLdProcessor === "undefined") {
      Object.defineProperty(globalThis, "JsonLdProcessor", {
        writable: true,
        enumerable: false,
        configurable: true,
        value: jsonld.JsonLdProcessor
      });
    }
  };
});

// node_modules/yallist/iterator.js
var require_iterator = __commonJS((exports, module) => {
  module.exports = function(Yallist) {
    Yallist.prototype[Symbol.iterator] = function* () {
      for (let walker = this.head;walker; walker = walker.next) {
        yield walker.value;
      }
    };
  };
});

// node_modules/yallist/yallist.js
var require_yallist = __commonJS((exports, module) => {
  module.exports = Yallist;
  Yallist.Node = Node;
  Yallist.create = Yallist;
  function Yallist(list) {
    var self2 = this;
    if (!(self2 instanceof Yallist)) {
      self2 = new Yallist;
    }
    self2.tail = null;
    self2.head = null;
    self2.length = 0;
    if (list && typeof list.forEach === "function") {
      list.forEach(function(item) {
        self2.push(item);
      });
    } else if (arguments.length > 0) {
      for (var i2 = 0, l = arguments.length;i2 < l; i2++) {
        self2.push(arguments[i2]);
      }
    }
    return self2;
  }
  Yallist.prototype.removeNode = function(node) {
    if (node.list !== this) {
      throw new Error("removing node which does not belong to this list");
    }
    var next = node.next;
    var prev = node.prev;
    if (next) {
      next.prev = prev;
    }
    if (prev) {
      prev.next = next;
    }
    if (node === this.head) {
      this.head = next;
    }
    if (node === this.tail) {
      this.tail = prev;
    }
    node.list.length--;
    node.next = null;
    node.prev = null;
    node.list = null;
    return next;
  };
  Yallist.prototype.unshiftNode = function(node) {
    if (node === this.head) {
      return;
    }
    if (node.list) {
      node.list.removeNode(node);
    }
    var head = this.head;
    node.list = this;
    node.next = head;
    if (head) {
      head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
    this.length++;
  };
  Yallist.prototype.pushNode = function(node) {
    if (node === this.tail) {
      return;
    }
    if (node.list) {
      node.list.removeNode(node);
    }
    var tail = this.tail;
    node.list = this;
    node.prev = tail;
    if (tail) {
      tail.next = node;
    }
    this.tail = node;
    if (!this.head) {
      this.head = node;
    }
    this.length++;
  };
  Yallist.prototype.push = function() {
    for (var i2 = 0, l = arguments.length;i2 < l; i2++) {
      push(this, arguments[i2]);
    }
    return this.length;
  };
  Yallist.prototype.unshift = function() {
    for (var i2 = 0, l = arguments.length;i2 < l; i2++) {
      unshift(this, arguments[i2]);
    }
    return this.length;
  };
  Yallist.prototype.pop = function() {
    if (!this.tail) {
      return;
    }
    var res = this.tail.value;
    this.tail = this.tail.prev;
    if (this.tail) {
      this.tail.next = null;
    } else {
      this.head = null;
    }
    this.length--;
    return res;
  };
  Yallist.prototype.shift = function() {
    if (!this.head) {
      return;
    }
    var res = this.head.value;
    this.head = this.head.next;
    if (this.head) {
      this.head.prev = null;
    } else {
      this.tail = null;
    }
    this.length--;
    return res;
  };
  Yallist.prototype.forEach = function(fn, thisp) {
    thisp = thisp || this;
    for (var walker = this.head, i2 = 0;walker !== null; i2++) {
      fn.call(thisp, walker.value, i2, this);
      walker = walker.next;
    }
  };
  Yallist.prototype.forEachReverse = function(fn, thisp) {
    thisp = thisp || this;
    for (var walker = this.tail, i2 = this.length - 1;walker !== null; i2--) {
      fn.call(thisp, walker.value, i2, this);
      walker = walker.prev;
    }
  };
  Yallist.prototype.get = function(n) {
    for (var i2 = 0, walker = this.head;walker !== null && i2 < n; i2++) {
      walker = walker.next;
    }
    if (i2 === n && walker !== null) {
      return walker.value;
    }
  };
  Yallist.prototype.getReverse = function(n) {
    for (var i2 = 0, walker = this.tail;walker !== null && i2 < n; i2++) {
      walker = walker.prev;
    }
    if (i2 === n && walker !== null) {
      return walker.value;
    }
  };
  Yallist.prototype.map = function(fn, thisp) {
    thisp = thisp || this;
    var res = new Yallist;
    for (var walker = this.head;walker !== null; ) {
      res.push(fn.call(thisp, walker.value, this));
      walker = walker.next;
    }
    return res;
  };
  Yallist.prototype.mapReverse = function(fn, thisp) {
    thisp = thisp || this;
    var res = new Yallist;
    for (var walker = this.tail;walker !== null; ) {
      res.push(fn.call(thisp, walker.value, this));
      walker = walker.prev;
    }
    return res;
  };
  Yallist.prototype.reduce = function(fn, initial) {
    var acc;
    var walker = this.head;
    if (arguments.length > 1) {
      acc = initial;
    } else if (this.head) {
      walker = this.head.next;
      acc = this.head.value;
    } else {
      throw new TypeError("Reduce of empty list with no initial value");
    }
    for (var i2 = 0;walker !== null; i2++) {
      acc = fn(acc, walker.value, i2);
      walker = walker.next;
    }
    return acc;
  };
  Yallist.prototype.reduceReverse = function(fn, initial) {
    var acc;
    var walker = this.tail;
    if (arguments.length > 1) {
      acc = initial;
    } else if (this.tail) {
      walker = this.tail.prev;
      acc = this.tail.value;
    } else {
      throw new TypeError("Reduce of empty list with no initial value");
    }
    for (var i2 = this.length - 1;walker !== null; i2--) {
      acc = fn(acc, walker.value, i2);
      walker = walker.prev;
    }
    return acc;
  };
  Yallist.prototype.toArray = function() {
    var arr = new Array(this.length);
    for (var i2 = 0, walker = this.head;walker !== null; i2++) {
      arr[i2] = walker.value;
      walker = walker.next;
    }
    return arr;
  };
  Yallist.prototype.toArrayReverse = function() {
    var arr = new Array(this.length);
    for (var i2 = 0, walker = this.tail;walker !== null; i2++) {
      arr[i2] = walker.value;
      walker = walker.prev;
    }
    return arr;
  };
  Yallist.prototype.slice = function(from2, to) {
    to = to || this.length;
    if (to < 0) {
      to += this.length;
    }
    from2 = from2 || 0;
    if (from2 < 0) {
      from2 += this.length;
    }
    var ret = new Yallist;
    if (to < from2 || to < 0) {
      return ret;
    }
    if (from2 < 0) {
      from2 = 0;
    }
    if (to > this.length) {
      to = this.length;
    }
    for (var i2 = 0, walker = this.head;walker !== null && i2 < from2; i2++) {
      walker = walker.next;
    }
    for (;walker !== null && i2 < to; i2++, walker = walker.next) {
      ret.push(walker.value);
    }
    return ret;
  };
  Yallist.prototype.sliceReverse = function(from2, to) {
    to = to || this.length;
    if (to < 0) {
      to += this.length;
    }
    from2 = from2 || 0;
    if (from2 < 0) {
      from2 += this.length;
    }
    var ret = new Yallist;
    if (to < from2 || to < 0) {
      return ret;
    }
    if (from2 < 0) {
      from2 = 0;
    }
    if (to > this.length) {
      to = this.length;
    }
    for (var i2 = this.length, walker = this.tail;walker !== null && i2 > to; i2--) {
      walker = walker.prev;
    }
    for (;walker !== null && i2 > from2; i2--, walker = walker.prev) {
      ret.push(walker.value);
    }
    return ret;
  };
  Yallist.prototype.splice = function(start, deleteCount, ...nodes) {
    if (start > this.length) {
      start = this.length - 1;
    }
    if (start < 0) {
      start = this.length + start;
    }
    for (var i2 = 0, walker = this.head;walker !== null && i2 < start; i2++) {
      walker = walker.next;
    }
    var ret = [];
    for (var i2 = 0;walker && i2 < deleteCount; i2++) {
      ret.push(walker.value);
      walker = this.removeNode(walker);
    }
    if (walker === null) {
      walker = this.tail;
    }
    if (walker !== this.head && walker !== this.tail) {
      walker = walker.prev;
    }
    for (var i2 = 0;i2 < nodes.length; i2++) {
      walker = insert(this, walker, nodes[i2]);
    }
    return ret;
  };
  Yallist.prototype.reverse = function() {
    var head = this.head;
    var tail = this.tail;
    for (var walker = head;walker !== null; walker = walker.prev) {
      var p = walker.prev;
      walker.prev = walker.next;
      walker.next = p;
    }
    this.head = tail;
    this.tail = head;
    return this;
  };
  function insert(self2, node, value) {
    var inserted = node === self2.head ? new Node(value, null, node, self2) : new Node(value, node, node.next, self2);
    if (inserted.next === null) {
      self2.tail = inserted;
    }
    if (inserted.prev === null) {
      self2.head = inserted;
    }
    self2.length++;
    return inserted;
  }
  function push(self2, item) {
    self2.tail = new Node(item, self2.tail, null, self2);
    if (!self2.head) {
      self2.head = self2.tail;
    }
    self2.length++;
  }
  function unshift(self2, item) {
    self2.head = new Node(item, null, self2.head, self2);
    if (!self2.tail) {
      self2.tail = self2.head;
    }
    self2.length++;
  }
  function Node(value, prev, next, list) {
    if (!(this instanceof Node)) {
      return new Node(value, prev, next, list);
    }
    this.list = list;
    this.value = value;
    if (prev) {
      prev.next = this;
      this.prev = prev;
    } else {
      this.prev = null;
    }
    if (next) {
      next.prev = this;
      this.next = next;
    } else {
      this.next = null;
    }
  }
  try {
    require_iterator()(Yallist);
  } catch (er) {}
});

// node_modules/lru-cache/index.js
var require_lru_cache = __commonJS((exports, module) => {
  var Yallist = require_yallist();
  var MAX = Symbol("max");
  var LENGTH = Symbol("length");
  var LENGTH_CALCULATOR = Symbol("lengthCalculator");
  var ALLOW_STALE = Symbol("allowStale");
  var MAX_AGE = Symbol("maxAge");
  var DISPOSE = Symbol("dispose");
  var NO_DISPOSE_ON_SET = Symbol("noDisposeOnSet");
  var LRU_LIST = Symbol("lruList");
  var CACHE = Symbol("cache");
  var UPDATE_AGE_ON_GET = Symbol("updateAgeOnGet");
  var naiveLength = () => 1;

  class LRUCache {
    constructor(options) {
      if (typeof options === "number")
        options = { max: options };
      if (!options)
        options = {};
      if (options.max && (typeof options.max !== "number" || options.max < 0))
        throw new TypeError("max must be a non-negative number");
      const max = this[MAX] = options.max || Infinity;
      const lc = options.length || naiveLength;
      this[LENGTH_CALCULATOR] = typeof lc !== "function" ? naiveLength : lc;
      this[ALLOW_STALE] = options.stale || false;
      if (options.maxAge && typeof options.maxAge !== "number")
        throw new TypeError("maxAge must be a number");
      this[MAX_AGE] = options.maxAge || 0;
      this[DISPOSE] = options.dispose;
      this[NO_DISPOSE_ON_SET] = options.noDisposeOnSet || false;
      this[UPDATE_AGE_ON_GET] = options.updateAgeOnGet || false;
      this.reset();
    }
    set max(mL) {
      if (typeof mL !== "number" || mL < 0)
        throw new TypeError("max must be a non-negative number");
      this[MAX] = mL || Infinity;
      trim(this);
    }
    get max() {
      return this[MAX];
    }
    set allowStale(allowStale) {
      this[ALLOW_STALE] = !!allowStale;
    }
    get allowStale() {
      return this[ALLOW_STALE];
    }
    set maxAge(mA) {
      if (typeof mA !== "number")
        throw new TypeError("maxAge must be a non-negative number");
      this[MAX_AGE] = mA;
      trim(this);
    }
    get maxAge() {
      return this[MAX_AGE];
    }
    set lengthCalculator(lC) {
      if (typeof lC !== "function")
        lC = naiveLength;
      if (lC !== this[LENGTH_CALCULATOR]) {
        this[LENGTH_CALCULATOR] = lC;
        this[LENGTH] = 0;
        this[LRU_LIST].forEach((hit) => {
          hit.length = this[LENGTH_CALCULATOR](hit.value, hit.key);
          this[LENGTH] += hit.length;
        });
      }
      trim(this);
    }
    get lengthCalculator() {
      return this[LENGTH_CALCULATOR];
    }
    get length() {
      return this[LENGTH];
    }
    get itemCount() {
      return this[LRU_LIST].length;
    }
    rforEach(fn, thisp) {
      thisp = thisp || this;
      for (let walker = this[LRU_LIST].tail;walker !== null; ) {
        const prev = walker.prev;
        forEachStep(this, fn, walker, thisp);
        walker = prev;
      }
    }
    forEach(fn, thisp) {
      thisp = thisp || this;
      for (let walker = this[LRU_LIST].head;walker !== null; ) {
        const next = walker.next;
        forEachStep(this, fn, walker, thisp);
        walker = next;
      }
    }
    keys() {
      return this[LRU_LIST].toArray().map((k) => k.key);
    }
    values() {
      return this[LRU_LIST].toArray().map((k) => k.value);
    }
    reset() {
      if (this[DISPOSE] && this[LRU_LIST] && this[LRU_LIST].length) {
        this[LRU_LIST].forEach((hit) => this[DISPOSE](hit.key, hit.value));
      }
      this[CACHE] = new Map;
      this[LRU_LIST] = new Yallist;
      this[LENGTH] = 0;
    }
    dump() {
      return this[LRU_LIST].map((hit) => isStale(this, hit) ? false : {
        k: hit.key,
        v: hit.value,
        e: hit.now + (hit.maxAge || 0)
      }).toArray().filter((h) => h);
    }
    dumpLru() {
      return this[LRU_LIST];
    }
    set(key, value, maxAge) {
      maxAge = maxAge || this[MAX_AGE];
      if (maxAge && typeof maxAge !== "number")
        throw new TypeError("maxAge must be a number");
      const now = maxAge ? Date.now() : 0;
      const len2 = this[LENGTH_CALCULATOR](value, key);
      if (this[CACHE].has(key)) {
        if (len2 > this[MAX]) {
          del(this, this[CACHE].get(key));
          return false;
        }
        const node = this[CACHE].get(key);
        const item = node.value;
        if (this[DISPOSE]) {
          if (!this[NO_DISPOSE_ON_SET])
            this[DISPOSE](key, item.value);
        }
        item.now = now;
        item.maxAge = maxAge;
        item.value = value;
        this[LENGTH] += len2 - item.length;
        item.length = len2;
        this.get(key);
        trim(this);
        return true;
      }
      const hit = new Entry(key, value, len2, now, maxAge);
      if (hit.length > this[MAX]) {
        if (this[DISPOSE])
          this[DISPOSE](key, value);
        return false;
      }
      this[LENGTH] += hit.length;
      this[LRU_LIST].unshift(hit);
      this[CACHE].set(key, this[LRU_LIST].head);
      trim(this);
      return true;
    }
    has(key) {
      if (!this[CACHE].has(key))
        return false;
      const hit = this[CACHE].get(key).value;
      return !isStale(this, hit);
    }
    get(key) {
      return get(this, key, true);
    }
    peek(key) {
      return get(this, key, false);
    }
    pop() {
      const node = this[LRU_LIST].tail;
      if (!node)
        return null;
      del(this, node);
      return node.value;
    }
    del(key) {
      del(this, this[CACHE].get(key));
    }
    load(arr) {
      this.reset();
      const now = Date.now();
      for (let l = arr.length - 1;l >= 0; l--) {
        const hit = arr[l];
        const expiresAt = hit.e || 0;
        if (expiresAt === 0)
          this.set(hit.k, hit.v);
        else {
          const maxAge = expiresAt - now;
          if (maxAge > 0) {
            this.set(hit.k, hit.v, maxAge);
          }
        }
      }
    }
    prune() {
      this[CACHE].forEach((value, key) => get(this, key, false));
    }
  }
  var get = (self2, key, doUse) => {
    const node = self2[CACHE].get(key);
    if (node) {
      const hit = node.value;
      if (isStale(self2, hit)) {
        del(self2, node);
        if (!self2[ALLOW_STALE])
          return;
      } else {
        if (doUse) {
          if (self2[UPDATE_AGE_ON_GET])
            node.value.now = Date.now();
          self2[LRU_LIST].unshiftNode(node);
        }
      }
      return hit.value;
    }
  };
  var isStale = (self2, hit) => {
    if (!hit || !hit.maxAge && !self2[MAX_AGE])
      return false;
    const diff = Date.now() - hit.now;
    return hit.maxAge ? diff > hit.maxAge : self2[MAX_AGE] && diff > self2[MAX_AGE];
  };
  var trim = (self2) => {
    if (self2[LENGTH] > self2[MAX]) {
      for (let walker = self2[LRU_LIST].tail;self2[LENGTH] > self2[MAX] && walker !== null; ) {
        const prev = walker.prev;
        del(self2, walker);
        walker = prev;
      }
    }
  };
  var del = (self2, node) => {
    if (node) {
      const hit = node.value;
      if (self2[DISPOSE])
        self2[DISPOSE](hit.key, hit.value);
      self2[LENGTH] -= hit.length;
      self2[CACHE].delete(hit.key);
      self2[LRU_LIST].removeNode(node);
    }
  };

  class Entry {
    constructor(key, value, length, now, maxAge) {
      this.key = key;
      this.value = value;
      this.length = length;
      this.now = now;
      this.maxAge = maxAge || 0;
    }
  }
  var forEachStep = (self2, fn, node, thisp) => {
    let hit = node.value;
    if (isStale(self2, hit)) {
      del(self2, node);
      if (!self2[ALLOW_STALE])
        hit = undefined;
    }
    if (hit)
      fn.call(thisp, hit.value, hit.key, self2);
  };
  module.exports = LRUCache;
});

// node_modules/jsonld/lib/ResolvedContext.js
var require_ResolvedContext = __commonJS((exports, module) => {
  var LRU = require_lru_cache();
  var MAX_ACTIVE_CONTEXTS = 10;
  module.exports = class ResolvedContext {
    constructor({ document }) {
      this.document = document;
      this.cache = new LRU({ max: MAX_ACTIVE_CONTEXTS });
    }
    getProcessed(activeCtx) {
      return this.cache.get(activeCtx);
    }
    setProcessed(activeCtx, processedCtx) {
      this.cache.set(activeCtx, processedCtx);
    }
  };
});

// node_modules/jsonld/lib/ContextResolver.js
var require_ContextResolver = __commonJS((exports, module) => {
  var {
    isArray: _isArray,
    isObject: _isObject,
    isString: _isString
  } = require_types();
  var {
    asArray: _asArray
  } = require_util();
  var { prependBase } = require_url();
  var JsonLdError = require_JsonLdError();
  var ResolvedContext = require_ResolvedContext();
  var MAX_CONTEXT_URLS = 10;
  module.exports = class ContextResolver {
    constructor({ sharedCache }) {
      this.perOpCache = new Map;
      this.sharedCache = sharedCache;
    }
    async resolve({
      activeCtx,
      context,
      documentLoader,
      base,
      cycles = new Set
    }) {
      if (context && _isObject(context) && context["@context"]) {
        context = context["@context"];
      }
      context = _asArray(context);
      const allResolved = [];
      for (const ctx of context) {
        if (_isString(ctx)) {
          let resolved2 = this._get(ctx);
          if (!resolved2) {
            resolved2 = await this._resolveRemoteContext({ activeCtx, url: ctx, documentLoader, base, cycles });
          }
          if (_isArray(resolved2)) {
            allResolved.push(...resolved2);
          } else {
            allResolved.push(resolved2);
          }
          continue;
        }
        if (ctx === null) {
          allResolved.push(new ResolvedContext({ document: null }));
          continue;
        }
        if (!_isObject(ctx)) {
          _throwInvalidLocalContext(context);
        }
        const key = JSON.stringify(ctx);
        let resolved = this._get(key);
        if (!resolved) {
          resolved = new ResolvedContext({ document: ctx });
          this._cacheResolvedContext({ key, resolved, tag: "static" });
        }
        allResolved.push(resolved);
      }
      return allResolved;
    }
    _get(key) {
      let resolved = this.perOpCache.get(key);
      if (!resolved) {
        const tagMap = this.sharedCache.get(key);
        if (tagMap) {
          resolved = tagMap.get("static");
          if (resolved) {
            this.perOpCache.set(key, resolved);
          }
        }
      }
      return resolved;
    }
    _cacheResolvedContext({ key, resolved, tag }) {
      this.perOpCache.set(key, resolved);
      if (tag !== undefined) {
        let tagMap = this.sharedCache.get(key);
        if (!tagMap) {
          tagMap = new Map;
          this.sharedCache.set(key, tagMap);
        }
        tagMap.set(tag, resolved);
      }
      return resolved;
    }
    async _resolveRemoteContext({ activeCtx, url, documentLoader, base, cycles }) {
      url = prependBase(base, url);
      const { context, remoteDoc } = await this._fetchContext({ activeCtx, url, documentLoader, cycles });
      base = remoteDoc.documentUrl || url;
      _resolveContextUrls({ context, base });
      const resolved = await this.resolve({ activeCtx, context, documentLoader, base, cycles });
      this._cacheResolvedContext({ key: url, resolved, tag: remoteDoc.tag });
      return resolved;
    }
    async _fetchContext({ activeCtx, url, documentLoader, cycles }) {
      if (cycles.size > MAX_CONTEXT_URLS) {
        throw new JsonLdError("Maximum number of @context URLs exceeded.", "jsonld.ContextUrlError", {
          code: activeCtx.processingMode === "json-ld-1.0" ? "loading remote context failed" : "context overflow",
          max: MAX_CONTEXT_URLS
        });
      }
      if (cycles.has(url)) {
        throw new JsonLdError("Cyclical @context URLs detected.", "jsonld.ContextUrlError", {
          code: activeCtx.processingMode === "json-ld-1.0" ? "recursive context inclusion" : "context overflow",
          url
        });
      }
      cycles.add(url);
      let context;
      let remoteDoc;
      try {
        remoteDoc = await documentLoader(url);
        context = remoteDoc.document || null;
        if (_isString(context)) {
          context = JSON.parse(context);
        }
      } catch (e) {
        throw new JsonLdError("Dereferencing a URL did not result in a valid JSON-LD object. " + "Possible causes are an inaccessible URL perhaps due to " + "a same-origin policy (ensure the server uses CORS if you are " + "using client-side JavaScript), too many redirects, a " + "non-JSON response, or more than one HTTP Link Header was " + "provided for a remote context. " + `URL: "${url}".`, "jsonld.InvalidUrl", { code: "loading remote context failed", url, cause: e });
      }
      if (!_isObject(context)) {
        throw new JsonLdError("Dereferencing a URL did not result in a JSON object. The " + "response was valid JSON, but it was not a JSON object. " + `URL: "${url}".`, "jsonld.InvalidUrl", { code: "invalid remote context", url });
      }
      if (!("@context" in context)) {
        context = { "@context": {} };
      } else {
        context = { "@context": context["@context"] };
      }
      if (remoteDoc.contextUrl) {
        if (!_isArray(context["@context"])) {
          context["@context"] = [context["@context"]];
        }
        context["@context"].push(remoteDoc.contextUrl);
      }
      return { context, remoteDoc };
    }
  };
  function _throwInvalidLocalContext(ctx) {
    throw new JsonLdError("Invalid JSON-LD syntax; @context must be an object.", "jsonld.SyntaxError", {
      code: "invalid local context",
      context: ctx
    });
  }
  function _resolveContextUrls({ context, base }) {
    if (!context) {
      return;
    }
    const ctx = context["@context"];
    if (_isString(ctx)) {
      context["@context"] = prependBase(base, ctx);
      return;
    }
    if (_isArray(ctx)) {
      for (let i2 = 0;i2 < ctx.length; ++i2) {
        const element = ctx[i2];
        if (_isString(element)) {
          ctx[i2] = prependBase(base, element);
          continue;
        }
        if (_isObject(element)) {
          _resolveContextUrls({ context: { "@context": element }, base });
        }
      }
      return;
    }
    if (!_isObject(ctx)) {
      return;
    }
    for (const term in ctx) {
      _resolveContextUrls({ context: ctx[term], base });
    }
  }
});

// node_modules/jsonld/lib/NQuads.js
var require_NQuads2 = __commonJS((exports, module) => {
  module.exports = require_lib().NQuads;
});

// node_modules/jsonld/lib/events.js
var require_events = __commonJS((exports, module) => {
  var JsonLdError = require_JsonLdError();
  var {
    isArray: _isArray
  } = require_types();
  var {
    asArray: _asArray
  } = require_util();
  var api = {};
  module.exports = api;
  api.defaultEventHandler = null;
  api.setupEventHandler = ({ options = {} }) => {
    const eventHandler = [].concat(options.safe ? api.safeEventHandler : [], options.eventHandler ? _asArray(options.eventHandler) : [], api.defaultEventHandler ? api.defaultEventHandler : []);
    return eventHandler.length === 0 ? null : eventHandler;
  };
  api.handleEvent = ({
    event,
    options
  }) => {
    _handle({ event, handlers: options.eventHandler });
  };
  function _handle({ event, handlers }) {
    let doNext = true;
    for (let i2 = 0;doNext && i2 < handlers.length; ++i2) {
      doNext = false;
      const handler = handlers[i2];
      if (_isArray(handler)) {
        doNext = _handle({ event, handlers: handler });
      } else if (typeof handler === "function") {
        handler({ event, next: () => {
          doNext = true;
        } });
      } else if (typeof handler === "object") {
        if (event.code in handler) {
          handler[event.code]({ event, next: () => {
            doNext = true;
          } });
        } else {
          doNext = true;
        }
      } else {
        throw new JsonLdError("Invalid event handler.", "jsonld.InvalidEventHandler", { event });
      }
    }
    return doNext;
  }
  var _notSafeEventCodes = new Set([
    "empty object",
    "free-floating scalar",
    "invalid @language value",
    "invalid property",
    "null @id value",
    "null @value value",
    "object with only @id",
    "object with only @language",
    "object with only @list",
    "object with only @value",
    "relative @id reference",
    "relative @type reference",
    "relative @vocab reference",
    "reserved @id value",
    "reserved @reverse value",
    "reserved term",
    "blank node predicate",
    "relative graph reference",
    "relative object reference",
    "relative predicate reference",
    "relative subject reference",
    "rdfDirection not set"
  ]);
  api.safeEventHandler = function safeEventHandler({ event, next }) {
    if (event.level === "warning" && _notSafeEventCodes.has(event.code)) {
      throw new JsonLdError("Safe mode validation error.", "jsonld.ValidationError", { event });
    }
    next();
  };
  api.logEventHandler = function logEventHandler({ event, next }) {
    console.log(`EVENT: ${event.message}`, { event });
    next();
  };
  api.logWarningEventHandler = function logWarningEventHandler({ event, next }) {
    if (event.level === "warning") {
      console.warn(`WARNING: ${event.message}`, { event });
    }
    next();
  };
  api.unhandledEventHandler = function unhandledEventHandler({ event }) {
    throw new JsonLdError("No handler for event.", "jsonld.UnhandledEvent", { event });
  };
  api.setDefaultEventHandler = function({ eventHandler } = {}) {
    api.defaultEventHandler = eventHandler ? _asArray(eventHandler) : null;
  };
});

// node_modules/jsonld/lib/context.js
var require_context = __commonJS((exports, module) => {
  var util = require_util();
  var JsonLdError = require_JsonLdError();
  var {
    isArray: _isArray,
    isObject: _isObject,
    isString: _isString,
    isUndefined: _isUndefined
  } = require_types();
  var {
    isAbsolute: _isAbsoluteIri,
    isRelative: _isRelativeIri,
    prependBase
  } = require_url();
  var {
    handleEvent: _handleEvent
  } = require_events();
  var {
    REGEX_BCP47,
    REGEX_KEYWORD,
    asArray: _asArray,
    compareShortestLeast: _compareShortestLeast
  } = require_util();
  var INITIAL_CONTEXT_CACHE = new Map;
  var INITIAL_CONTEXT_CACHE_MAX_SIZE = 1e4;
  var api = {};
  module.exports = api;
  api.process = async ({
    activeCtx,
    localCtx,
    options,
    propagate = true,
    overrideProtected = false,
    cycles = new Set
  }) => {
    if (_isObject(localCtx) && "@context" in localCtx && _isArray(localCtx["@context"])) {
      localCtx = localCtx["@context"];
    }
    const ctxs = _asArray(localCtx);
    if (ctxs.length === 0) {
      return activeCtx;
    }
    const events = [];
    const eventCaptureHandler = [
      ({ event, next }) => {
        events.push(event);
        next();
      }
    ];
    if (options.eventHandler) {
      eventCaptureHandler.push(options.eventHandler);
    }
    const originalOptions = options;
    options = { ...options, eventHandler: eventCaptureHandler };
    const resolved = await options.contextResolver.resolve({
      activeCtx,
      context: localCtx,
      documentLoader: options.documentLoader,
      base: options.base
    });
    if (_isObject(resolved[0].document) && typeof resolved[0].document["@propagate"] === "boolean") {
      propagate = resolved[0].document["@propagate"];
    }
    let rval = activeCtx;
    if (!propagate && !rval.previousContext) {
      rval = rval.clone();
      rval.previousContext = activeCtx;
    }
    for (const resolvedContext of resolved) {
      let { document: ctx } = resolvedContext;
      activeCtx = rval;
      if (ctx === null) {
        if (!overrideProtected && Object.keys(activeCtx.protected).length !== 0) {
          throw new JsonLdError("Tried to nullify a context with protected terms outside of " + "a term definition.", "jsonld.SyntaxError", { code: "invalid context nullification" });
        }
        rval = activeCtx = api.getInitialContext(options).clone();
        continue;
      }
      const processed = resolvedContext.getProcessed(activeCtx);
      if (processed) {
        if (originalOptions.eventHandler) {
          for (const event of processed.events) {
            _handleEvent({ event, options: originalOptions });
          }
        }
        rval = activeCtx = processed.context;
        continue;
      }
      if (_isObject(ctx) && "@context" in ctx) {
        ctx = ctx["@context"];
      }
      if (!_isObject(ctx)) {
        throw new JsonLdError("Invalid JSON-LD syntax; @context must be an object.", "jsonld.SyntaxError", { code: "invalid local context", context: ctx });
      }
      rval = rval.clone();
      const defined = new Map;
      if ("@version" in ctx) {
        if (ctx["@version"] !== 1.1) {
          throw new JsonLdError("Unsupported JSON-LD version: " + ctx["@version"], "jsonld.UnsupportedVersion", { code: "invalid @version value", context: ctx });
        }
        if (activeCtx.processingMode && activeCtx.processingMode === "json-ld-1.0") {
          throw new JsonLdError("@version: " + ctx["@version"] + " not compatible with " + activeCtx.processingMode, "jsonld.ProcessingModeConflict", { code: "processing mode conflict", context: ctx });
        }
        rval.processingMode = "json-ld-1.1";
        rval["@version"] = ctx["@version"];
        defined.set("@version", true);
      }
      rval.processingMode = rval.processingMode || activeCtx.processingMode;
      if ("@base" in ctx) {
        let base = ctx["@base"];
        if (base === null || _isAbsoluteIri(base)) {} else if (_isRelativeIri(base)) {
          base = prependBase(rval["@base"], base);
        } else {
          throw new JsonLdError('Invalid JSON-LD syntax; the value of "@base" in a ' + "@context must be an absolute IRI, a relative IRI, or null.", "jsonld.SyntaxError", { code: "invalid base IRI", context: ctx });
        }
        rval["@base"] = base;
        defined.set("@base", true);
      }
      if ("@vocab" in ctx) {
        const value = ctx["@vocab"];
        if (value === null) {
          delete rval["@vocab"];
        } else if (!_isString(value)) {
          throw new JsonLdError('Invalid JSON-LD syntax; the value of "@vocab" in a ' + "@context must be a string or null.", "jsonld.SyntaxError", { code: "invalid vocab mapping", context: ctx });
        } else if (!_isAbsoluteIri(value) && api.processingMode(rval, 1)) {
          throw new JsonLdError('Invalid JSON-LD syntax; the value of "@vocab" in a ' + "@context must be an absolute IRI.", "jsonld.SyntaxError", { code: "invalid vocab mapping", context: ctx });
        } else {
          const vocab = _expandIri(rval, value, { vocab: true, base: true }, undefined, undefined, options);
          if (!_isAbsoluteIri(vocab)) {
            if (options.eventHandler) {
              _handleEvent({
                event: {
                  type: ["JsonLdEvent"],
                  code: "relative @vocab reference",
                  level: "warning",
                  message: "Relative @vocab reference found.",
                  details: {
                    vocab
                  }
                },
                options
              });
            }
          }
          rval["@vocab"] = vocab;
        }
        defined.set("@vocab", true);
      }
      if ("@language" in ctx) {
        const value = ctx["@language"];
        if (value === null) {
          delete rval["@language"];
        } else if (!_isString(value)) {
          throw new JsonLdError('Invalid JSON-LD syntax; the value of "@language" in a ' + "@context must be a string or null.", "jsonld.SyntaxError", { code: "invalid default language", context: ctx });
        } else {
          if (!value.match(REGEX_BCP47)) {
            if (options.eventHandler) {
              _handleEvent({
                event: {
                  type: ["JsonLdEvent"],
                  code: "invalid @language value",
                  level: "warning",
                  message: "@language value must be valid BCP47.",
                  details: {
                    language: value
                  }
                },
                options
              });
            }
          }
          rval["@language"] = value.toLowerCase();
        }
        defined.set("@language", true);
      }
      if ("@direction" in ctx) {
        const value = ctx["@direction"];
        if (activeCtx.processingMode === "json-ld-1.0") {
          throw new JsonLdError("Invalid JSON-LD syntax; @direction not compatible with " + activeCtx.processingMode, "jsonld.SyntaxError", { code: "invalid context member", context: ctx });
        }
        if (value === null) {
          delete rval["@direction"];
        } else if (value !== "ltr" && value !== "rtl") {
          throw new JsonLdError('Invalid JSON-LD syntax; the value of "@direction" in a ' + '@context must be null, "ltr", or "rtl".', "jsonld.SyntaxError", { code: "invalid base direction", context: ctx });
        } else {
          rval["@direction"] = value;
        }
        defined.set("@direction", true);
      }
      if ("@propagate" in ctx) {
        const value = ctx["@propagate"];
        if (activeCtx.processingMode === "json-ld-1.0") {
          throw new JsonLdError("Invalid JSON-LD syntax; @propagate not compatible with " + activeCtx.processingMode, "jsonld.SyntaxError", { code: "invalid context entry", context: ctx });
        }
        if (typeof value !== "boolean") {
          throw new JsonLdError("Invalid JSON-LD syntax; @propagate value must be a boolean.", "jsonld.SyntaxError", { code: "invalid @propagate value", context: localCtx });
        }
        defined.set("@propagate", true);
      }
      if ("@import" in ctx) {
        const value = ctx["@import"];
        if (activeCtx.processingMode === "json-ld-1.0") {
          throw new JsonLdError("Invalid JSON-LD syntax; @import not compatible with " + activeCtx.processingMode, "jsonld.SyntaxError", { code: "invalid context entry", context: ctx });
        }
        if (!_isString(value)) {
          throw new JsonLdError("Invalid JSON-LD syntax; @import must be a string.", "jsonld.SyntaxError", { code: "invalid @import value", context: localCtx });
        }
        const resolvedImport = await options.contextResolver.resolve({
          activeCtx,
          context: value,
          documentLoader: options.documentLoader,
          base: options.base
        });
        if (resolvedImport.length !== 1) {
          throw new JsonLdError("Invalid JSON-LD syntax; @import must reference a single context.", "jsonld.SyntaxError", { code: "invalid remote context", context: localCtx });
        }
        const processedImport = resolvedImport[0].getProcessed(activeCtx);
        if (processedImport) {
          ctx = processedImport;
        } else {
          const importCtx = resolvedImport[0].document;
          if ("@import" in importCtx) {
            throw new JsonLdError("Invalid JSON-LD syntax: " + "imported context must not include @import.", "jsonld.SyntaxError", { code: "invalid context entry", context: localCtx });
          }
          for (const key in importCtx) {
            if (!ctx.hasOwnProperty(key)) {
              ctx[key] = importCtx[key];
            }
          }
          resolvedImport[0].setProcessed(activeCtx, ctx);
        }
        defined.set("@import", true);
      }
      defined.set("@protected", ctx["@protected"] || false);
      for (const key in ctx) {
        api.createTermDefinition({
          activeCtx: rval,
          localCtx: ctx,
          term: key,
          defined,
          options,
          overrideProtected
        });
        if (_isObject(ctx[key]) && "@context" in ctx[key]) {
          const keyCtx = ctx[key]["@context"];
          let process2 = true;
          if (_isString(keyCtx)) {
            const url = prependBase(options.base, keyCtx);
            if (cycles.has(url)) {
              process2 = false;
            } else {
              cycles.add(url);
            }
          }
          if (process2) {
            try {
              await api.process({
                activeCtx: rval.clone(),
                localCtx: ctx[key]["@context"],
                overrideProtected: true,
                options,
                cycles
              });
            } catch (e) {
              throw new JsonLdError("Invalid JSON-LD syntax; invalid scoped context.", "jsonld.SyntaxError", {
                code: "invalid scoped context",
                context: ctx[key]["@context"],
                term: key
              });
            }
          }
        }
      }
      resolvedContext.setProcessed(activeCtx, {
        context: rval,
        events
      });
    }
    return rval;
  };
  api.createTermDefinition = ({
    activeCtx,
    localCtx,
    term,
    defined,
    options,
    overrideProtected = false
  }) => {
    if (defined.has(term)) {
      if (defined.get(term)) {
        return;
      }
      throw new JsonLdError("Cyclical context definition detected.", "jsonld.CyclicalContext", { code: "cyclic IRI mapping", context: localCtx, term });
    }
    defined.set(term, false);
    let value;
    if (localCtx.hasOwnProperty(term)) {
      value = localCtx[term];
    }
    if (term === "@type" && _isObject(value) && (value["@container"] || "@set") === "@set" && api.processingMode(activeCtx, 1.1)) {
      const validKeys2 = ["@container", "@id", "@protected"];
      const keys = Object.keys(value);
      if (keys.length === 0 || keys.some((k) => !validKeys2.includes(k))) {
        throw new JsonLdError("Invalid JSON-LD syntax; keywords cannot be overridden.", "jsonld.SyntaxError", { code: "keyword redefinition", context: localCtx, term });
      }
    } else if (api.isKeyword(term)) {
      throw new JsonLdError("Invalid JSON-LD syntax; keywords cannot be overridden.", "jsonld.SyntaxError", { code: "keyword redefinition", context: localCtx, term });
    } else if (term.match(REGEX_KEYWORD)) {
      if (options.eventHandler) {
        _handleEvent({
          event: {
            type: ["JsonLdEvent"],
            code: "reserved term",
            level: "warning",
            message: 'Terms beginning with "@" are ' + "reserved for future use and dropped.",
            details: {
              term
            }
          },
          options
        });
      }
      return;
    } else if (term === "") {
      throw new JsonLdError("Invalid JSON-LD syntax; a term cannot be an empty string.", "jsonld.SyntaxError", { code: "invalid term definition", context: localCtx });
    }
    const previousMapping = activeCtx.mappings.get(term);
    if (activeCtx.mappings.has(term)) {
      activeCtx.mappings.delete(term);
    }
    let simpleTerm = false;
    if (_isString(value) || value === null) {
      simpleTerm = true;
      value = { "@id": value };
    }
    if (!_isObject(value)) {
      throw new JsonLdError("Invalid JSON-LD syntax; @context term values must be " + "strings or objects.", "jsonld.SyntaxError", { code: "invalid term definition", context: localCtx });
    }
    const mapping = {};
    activeCtx.mappings.set(term, mapping);
    mapping.reverse = false;
    const validKeys = ["@container", "@id", "@language", "@reverse", "@type"];
    if (api.processingMode(activeCtx, 1.1)) {
      validKeys.push("@context", "@direction", "@index", "@nest", "@prefix", "@protected");
    }
    for (const kw in value) {
      if (!validKeys.includes(kw)) {
        throw new JsonLdError("Invalid JSON-LD syntax; a term definition must not contain " + kw, "jsonld.SyntaxError", { code: "invalid term definition", context: localCtx });
      }
    }
    const colon = term.indexOf(":");
    mapping._termHasColon = colon > 0;
    if ("@reverse" in value) {
      if ("@id" in value) {
        throw new JsonLdError("Invalid JSON-LD syntax; a @reverse term definition must not " + "contain @id.", "jsonld.SyntaxError", { code: "invalid reverse property", context: localCtx });
      }
      if ("@nest" in value) {
        throw new JsonLdError("Invalid JSON-LD syntax; a @reverse term definition must not " + "contain @nest.", "jsonld.SyntaxError", { code: "invalid reverse property", context: localCtx });
      }
      const reverse = value["@reverse"];
      if (!_isString(reverse)) {
        throw new JsonLdError("Invalid JSON-LD syntax; a @context @reverse value must be a string.", "jsonld.SyntaxError", { code: "invalid IRI mapping", context: localCtx });
      }
      if (reverse.match(REGEX_KEYWORD)) {
        if (options.eventHandler) {
          _handleEvent({
            event: {
              type: ["JsonLdEvent"],
              code: "reserved @reverse value",
              level: "warning",
              message: '@reverse values beginning with "@" are ' + "reserved for future use and dropped.",
              details: {
                reverse
              }
            },
            options
          });
        }
        if (previousMapping) {
          activeCtx.mappings.set(term, previousMapping);
        } else {
          activeCtx.mappings.delete(term);
        }
        return;
      }
      const id2 = _expandIri(activeCtx, reverse, { vocab: true, base: false }, localCtx, defined, options);
      if (!_isAbsoluteIri(id2)) {
        throw new JsonLdError("Invalid JSON-LD syntax; a @context @reverse value must be an " + "absolute IRI or a blank node identifier.", "jsonld.SyntaxError", { code: "invalid IRI mapping", context: localCtx });
      }
      mapping["@id"] = id2;
      mapping.reverse = true;
    } else if ("@id" in value) {
      let id2 = value["@id"];
      if (id2 && !_isString(id2)) {
        throw new JsonLdError("Invalid JSON-LD syntax; a @context @id value must be an array " + "of strings or a string.", "jsonld.SyntaxError", { code: "invalid IRI mapping", context: localCtx });
      }
      if (id2 === null) {
        mapping["@id"] = null;
      } else if (!api.isKeyword(id2) && id2.match(REGEX_KEYWORD)) {
        if (options.eventHandler) {
          _handleEvent({
            event: {
              type: ["JsonLdEvent"],
              code: "reserved @id value",
              level: "warning",
              message: '@id values beginning with "@" are ' + "reserved for future use and dropped.",
              details: {
                id: id2
              }
            },
            options
          });
        }
        if (previousMapping) {
          activeCtx.mappings.set(term, previousMapping);
        } else {
          activeCtx.mappings.delete(term);
        }
        return;
      } else if (id2 !== term) {
        id2 = _expandIri(activeCtx, id2, { vocab: true, base: false }, localCtx, defined, options);
        if (!_isAbsoluteIri(id2) && !api.isKeyword(id2)) {
          throw new JsonLdError("Invalid JSON-LD syntax; a @context @id value must be an " + "absolute IRI, a blank node identifier, or a keyword.", "jsonld.SyntaxError", { code: "invalid IRI mapping", context: localCtx });
        }
        if (term.match(/(?::[^:])|\//)) {
          const termDefined = new Map(defined).set(term, true);
          const termIri = _expandIri(activeCtx, term, { vocab: true, base: false }, localCtx, termDefined, options);
          if (termIri !== id2) {
            throw new JsonLdError("Invalid JSON-LD syntax; term in form of IRI must " + "expand to definition.", "jsonld.SyntaxError", { code: "invalid IRI mapping", context: localCtx });
          }
        }
        mapping["@id"] = id2;
        mapping._prefix = simpleTerm && !mapping._termHasColon && id2.match(/[:\/\?#\[\]@]$/) !== null;
      }
    }
    if (!("@id" in mapping)) {
      if (mapping._termHasColon) {
        const prefix = term.substr(0, colon);
        if (localCtx.hasOwnProperty(prefix)) {
          api.createTermDefinition({
            activeCtx,
            localCtx,
            term: prefix,
            defined,
            options
          });
        }
        if (activeCtx.mappings.has(prefix)) {
          const suffix = term.substr(colon + 1);
          mapping["@id"] = activeCtx.mappings.get(prefix)["@id"] + suffix;
        } else {
          mapping["@id"] = term;
        }
      } else if (term === "@type") {
        mapping["@id"] = term;
      } else {
        if (!("@vocab" in activeCtx)) {
          throw new JsonLdError("Invalid JSON-LD syntax; @context terms must define an @id.", "jsonld.SyntaxError", { code: "invalid IRI mapping", context: localCtx, term });
        }
        mapping["@id"] = activeCtx["@vocab"] + term;
      }
    }
    if (value["@protected"] === true || defined.get("@protected") === true && value["@protected"] !== false) {
      activeCtx.protected[term] = true;
      mapping.protected = true;
    }
    defined.set(term, true);
    if ("@type" in value) {
      let type = value["@type"];
      if (!_isString(type)) {
        throw new JsonLdError("Invalid JSON-LD syntax; an @context @type value must be a string.", "jsonld.SyntaxError", { code: "invalid type mapping", context: localCtx });
      }
      if (type === "@json" || type === "@none") {
        if (api.processingMode(activeCtx, 1)) {
          throw new JsonLdError("Invalid JSON-LD syntax; an @context @type value must not be " + `"${type}" in JSON-LD 1.0 mode.`, "jsonld.SyntaxError", { code: "invalid type mapping", context: localCtx });
        }
      } else if (type !== "@id" && type !== "@vocab") {
        type = _expandIri(activeCtx, type, { vocab: true, base: false }, localCtx, defined, options);
        if (!_isAbsoluteIri(type)) {
          throw new JsonLdError("Invalid JSON-LD syntax; an @context @type value must be an " + "absolute IRI.", "jsonld.SyntaxError", { code: "invalid type mapping", context: localCtx });
        }
        if (type.indexOf("_:") === 0) {
          throw new JsonLdError("Invalid JSON-LD syntax; an @context @type value must be an IRI, " + "not a blank node identifier.", "jsonld.SyntaxError", { code: "invalid type mapping", context: localCtx });
        }
      }
      mapping["@type"] = type;
    }
    if ("@container" in value) {
      const container = _isString(value["@container"]) ? [value["@container"]] : value["@container"] || [];
      const validContainers = ["@list", "@set", "@index", "@language"];
      let isValid = true;
      const hasSet = container.includes("@set");
      if (api.processingMode(activeCtx, 1.1)) {
        validContainers.push("@graph", "@id", "@type");
        if (container.includes("@list")) {
          if (container.length !== 1) {
            throw new JsonLdError("Invalid JSON-LD syntax; @context @container with @list must " + "have no other values", "jsonld.SyntaxError", { code: "invalid container mapping", context: localCtx });
          }
        } else if (container.includes("@graph")) {
          if (container.some((key) => key !== "@graph" && key !== "@id" && key !== "@index" && key !== "@set")) {
            throw new JsonLdError("Invalid JSON-LD syntax; @context @container with @graph must " + "have no other values other than @id, @index, and @set", "jsonld.SyntaxError", { code: "invalid container mapping", context: localCtx });
          }
        } else {
          isValid &= container.length <= (hasSet ? 2 : 1);
        }
        if (container.includes("@type")) {
          mapping["@type"] = mapping["@type"] || "@id";
          if (!["@id", "@vocab"].includes(mapping["@type"])) {
            throw new JsonLdError("Invalid JSON-LD syntax; container: @type requires @type to be " + "@id or @vocab.", "jsonld.SyntaxError", { code: "invalid type mapping", context: localCtx });
          }
        }
      } else {
        isValid &= !_isArray(value["@container"]);
        isValid &= container.length <= 1;
      }
      isValid &= container.every((c) => validContainers.includes(c));
      isValid &= !(hasSet && container.includes("@list"));
      if (!isValid) {
        throw new JsonLdError("Invalid JSON-LD syntax; @context @container value must be " + "one of the following: " + validContainers.join(", "), "jsonld.SyntaxError", { code: "invalid container mapping", context: localCtx });
      }
      if (mapping.reverse && !container.every((c) => ["@index", "@set"].includes(c))) {
        throw new JsonLdError("Invalid JSON-LD syntax; @context @container value for a @reverse " + "type definition must be @index or @set.", "jsonld.SyntaxError", { code: "invalid reverse property", context: localCtx });
      }
      mapping["@container"] = container;
    }
    if ("@index" in value) {
      if (!("@container" in value) || !mapping["@container"].includes("@index")) {
        throw new JsonLdError("Invalid JSON-LD syntax; @index without @index in @container: " + `"${value["@index"]}" on term "${term}".`, "jsonld.SyntaxError", { code: "invalid term definition", context: localCtx });
      }
      if (!_isString(value["@index"]) || value["@index"].indexOf("@") === 0) {
        throw new JsonLdError("Invalid JSON-LD syntax; @index must expand to an IRI: " + `"${value["@index"]}" on term "${term}".`, "jsonld.SyntaxError", { code: "invalid term definition", context: localCtx });
      }
      mapping["@index"] = value["@index"];
    }
    if ("@context" in value) {
      mapping["@context"] = value["@context"];
    }
    if ("@language" in value && !("@type" in value)) {
      let language = value["@language"];
      if (language !== null && !_isString(language)) {
        throw new JsonLdError("Invalid JSON-LD syntax; @context @language value must be " + "a string or null.", "jsonld.SyntaxError", { code: "invalid language mapping", context: localCtx });
      }
      if (language !== null) {
        language = language.toLowerCase();
      }
      mapping["@language"] = language;
    }
    if ("@prefix" in value) {
      if (term.match(/:|\//)) {
        throw new JsonLdError("Invalid JSON-LD syntax; @context @prefix used on a compact IRI term", "jsonld.SyntaxError", { code: "invalid term definition", context: localCtx });
      }
      if (api.isKeyword(mapping["@id"])) {
        throw new JsonLdError("Invalid JSON-LD syntax; keywords may not be used as prefixes", "jsonld.SyntaxError", { code: "invalid term definition", context: localCtx });
      }
      if (typeof value["@prefix"] === "boolean") {
        mapping._prefix = value["@prefix"] === true;
      } else {
        throw new JsonLdError("Invalid JSON-LD syntax; @context value for @prefix must be boolean", "jsonld.SyntaxError", { code: "invalid @prefix value", context: localCtx });
      }
    }
    if ("@direction" in value) {
      const direction = value["@direction"];
      if (direction !== null && direction !== "ltr" && direction !== "rtl") {
        throw new JsonLdError("Invalid JSON-LD syntax; @direction value must be " + 'null, "ltr", or "rtl".', "jsonld.SyntaxError", { code: "invalid base direction", context: localCtx });
      }
      mapping["@direction"] = direction;
    }
    if ("@nest" in value) {
      const nest = value["@nest"];
      if (!_isString(nest) || nest !== "@nest" && nest.indexOf("@") === 0) {
        throw new JsonLdError("Invalid JSON-LD syntax; @context @nest value must be " + "a string which is not a keyword other than @nest.", "jsonld.SyntaxError", { code: "invalid @nest value", context: localCtx });
      }
      mapping["@nest"] = nest;
    }
    const id = mapping["@id"];
    if (id === "@context" || id === "@preserve") {
      throw new JsonLdError("Invalid JSON-LD syntax; @context and @preserve cannot be aliased.", "jsonld.SyntaxError", { code: "invalid keyword alias", context: localCtx });
    }
    if (previousMapping && previousMapping.protected && !overrideProtected) {
      activeCtx.protected[term] = true;
      mapping.protected = true;
      if (!_deepCompare(previousMapping, mapping)) {
        throw new JsonLdError("Invalid JSON-LD syntax; tried to redefine a protected term.", "jsonld.SyntaxError", { code: "protected term redefinition", context: localCtx, term });
      }
    }
  };
  api.expandIri = (activeCtx, value, relativeTo, options) => {
    return _expandIri(activeCtx, value, relativeTo, undefined, undefined, options);
  };
  function _expandIri(activeCtx, value, relativeTo, localCtx, defined, options) {
    if (value === null || !_isString(value) || api.isKeyword(value)) {
      return value;
    }
    if (value.match(REGEX_KEYWORD)) {
      return null;
    }
    if (localCtx && localCtx.hasOwnProperty(value) && defined.get(value) !== true) {
      api.createTermDefinition({
        activeCtx,
        localCtx,
        term: value,
        defined,
        options
      });
    }
    relativeTo = relativeTo || {};
    if (relativeTo.vocab) {
      const mapping = activeCtx.mappings.get(value);
      if (mapping === null) {
        return null;
      }
      if (_isObject(mapping) && "@id" in mapping) {
        return mapping["@id"];
      }
    }
    const colon = value.indexOf(":");
    if (colon > 0) {
      const prefix = value.substr(0, colon);
      const suffix = value.substr(colon + 1);
      if (prefix === "_" || suffix.indexOf("//") === 0) {
        return value;
      }
      if (localCtx && localCtx.hasOwnProperty(prefix)) {
        api.createTermDefinition({
          activeCtx,
          localCtx,
          term: prefix,
          defined,
          options
        });
      }
      const mapping = activeCtx.mappings.get(prefix);
      if (mapping && mapping._prefix) {
        return mapping["@id"] + suffix;
      }
      if (_isAbsoluteIri(value)) {
        return value;
      }
    }
    if (relativeTo.vocab && "@vocab" in activeCtx) {
      const prependedResult = activeCtx["@vocab"] + value;
      value = prependedResult;
    } else if (relativeTo.base) {
      let prependedResult;
      let base;
      if ("@base" in activeCtx) {
        if (activeCtx["@base"]) {
          base = prependBase(options.base, activeCtx["@base"]);
          prependedResult = prependBase(base, value);
        } else {
          base = activeCtx["@base"];
          prependedResult = value;
        }
      } else {
        base = options.base;
        prependedResult = prependBase(options.base, value);
      }
      value = prependedResult;
    }
    return value;
  }
  api.getInitialContext = (options) => {
    const key = JSON.stringify({ processingMode: options.processingMode });
    const cached = INITIAL_CONTEXT_CACHE.get(key);
    if (cached) {
      return cached;
    }
    const initialContext = {
      processingMode: options.processingMode,
      mappings: new Map,
      inverse: null,
      getInverse: _createInverseContext,
      clone: _cloneActiveContext,
      revertToPreviousContext: _revertToPreviousContext,
      protected: {}
    };
    if (INITIAL_CONTEXT_CACHE.size === INITIAL_CONTEXT_CACHE_MAX_SIZE) {
      INITIAL_CONTEXT_CACHE.clear();
    }
    INITIAL_CONTEXT_CACHE.set(key, initialContext);
    return initialContext;
    function _createInverseContext() {
      const activeCtx = this;
      if (activeCtx.inverse) {
        return activeCtx.inverse;
      }
      const inverse = activeCtx.inverse = {};
      const fastCurieMap = activeCtx.fastCurieMap = {};
      const irisToTerms = {};
      const defaultLanguage = (activeCtx["@language"] || "@none").toLowerCase();
      const defaultDirection = activeCtx["@direction"];
      const mappings = activeCtx.mappings;
      const terms = [...mappings.keys()].sort(_compareShortestLeast);
      for (const term of terms) {
        const mapping = mappings.get(term);
        if (mapping === null) {
          continue;
        }
        let container = mapping["@container"] || "@none";
        container = [].concat(container).sort().join("");
        if (mapping["@id"] === null) {
          continue;
        }
        const ids = _asArray(mapping["@id"]);
        for (const iri of ids) {
          let entry = inverse[iri];
          const isKeyword = api.isKeyword(iri);
          if (!entry) {
            inverse[iri] = entry = {};
            if (!isKeyword && !mapping._termHasColon) {
              irisToTerms[iri] = [term];
              const fastCurieEntry = { iri, terms: irisToTerms[iri] };
              if (iri[0] in fastCurieMap) {
                fastCurieMap[iri[0]].push(fastCurieEntry);
              } else {
                fastCurieMap[iri[0]] = [fastCurieEntry];
              }
            }
          } else if (!isKeyword && !mapping._termHasColon) {
            irisToTerms[iri].push(term);
          }
          if (!entry[container]) {
            entry[container] = {
              "@language": {},
              "@type": {},
              "@any": {}
            };
          }
          entry = entry[container];
          _addPreferredTerm(term, entry["@any"], "@none");
          if (mapping.reverse) {
            _addPreferredTerm(term, entry["@type"], "@reverse");
          } else if (mapping["@type"] === "@none") {
            _addPreferredTerm(term, entry["@any"], "@none");
            _addPreferredTerm(term, entry["@language"], "@none");
            _addPreferredTerm(term, entry["@type"], "@none");
          } else if ("@type" in mapping) {
            _addPreferredTerm(term, entry["@type"], mapping["@type"]);
          } else if ("@language" in mapping && "@direction" in mapping) {
            const language = mapping["@language"];
            const direction = mapping["@direction"];
            if (language && direction) {
              _addPreferredTerm(term, entry["@language"], `${language}_${direction}`.toLowerCase());
            } else if (language) {
              _addPreferredTerm(term, entry["@language"], language.toLowerCase());
            } else if (direction) {
              _addPreferredTerm(term, entry["@language"], `_${direction}`);
            } else {
              _addPreferredTerm(term, entry["@language"], "@null");
            }
          } else if ("@language" in mapping) {
            _addPreferredTerm(term, entry["@language"], (mapping["@language"] || "@null").toLowerCase());
          } else if ("@direction" in mapping) {
            if (mapping["@direction"]) {
              _addPreferredTerm(term, entry["@language"], `_${mapping["@direction"]}`);
            } else {
              _addPreferredTerm(term, entry["@language"], "@none");
            }
          } else if (defaultDirection) {
            _addPreferredTerm(term, entry["@language"], `_${defaultDirection}`);
            _addPreferredTerm(term, entry["@language"], "@none");
            _addPreferredTerm(term, entry["@type"], "@none");
          } else {
            _addPreferredTerm(term, entry["@language"], defaultLanguage);
            _addPreferredTerm(term, entry["@language"], "@none");
            _addPreferredTerm(term, entry["@type"], "@none");
          }
        }
      }
      for (const key2 in fastCurieMap) {
        _buildIriMap(fastCurieMap, key2, 1);
      }
      return inverse;
    }
    function _buildIriMap(iriMap, key2, idx) {
      const entries = iriMap[key2];
      const next = iriMap[key2] = {};
      let iri;
      let letter;
      for (const entry of entries) {
        iri = entry.iri;
        if (idx >= iri.length) {
          letter = "";
        } else {
          letter = iri[idx];
        }
        if (letter in next) {
          next[letter].push(entry);
        } else {
          next[letter] = [entry];
        }
      }
      for (const key3 in next) {
        if (key3 === "") {
          continue;
        }
        _buildIriMap(next, key3, idx + 1);
      }
    }
    function _addPreferredTerm(term, entry, typeOrLanguageValue) {
      if (!entry.hasOwnProperty(typeOrLanguageValue)) {
        entry[typeOrLanguageValue] = term;
      }
    }
    function _cloneActiveContext() {
      const child = {};
      child.mappings = util.clone(this.mappings);
      child.clone = this.clone;
      child.inverse = null;
      child.getInverse = this.getInverse;
      child.protected = util.clone(this.protected);
      if (this.previousContext) {
        child.previousContext = this.previousContext.clone();
      }
      child.revertToPreviousContext = this.revertToPreviousContext;
      if ("@base" in this) {
        child["@base"] = this["@base"];
      }
      if ("@language" in this) {
        child["@language"] = this["@language"];
      }
      if ("@vocab" in this) {
        child["@vocab"] = this["@vocab"];
      }
      return child;
    }
    function _revertToPreviousContext() {
      if (!this.previousContext) {
        return this;
      }
      return this.previousContext.clone();
    }
  };
  api.getContextValue = (ctx, key, type) => {
    if (key === null) {
      if (type === "@context") {
        return;
      }
      return null;
    }
    if (ctx.mappings.has(key)) {
      const entry = ctx.mappings.get(key);
      if (_isUndefined(type)) {
        return entry;
      }
      if (entry.hasOwnProperty(type)) {
        return entry[type];
      }
    }
    if (type === "@language" && type in ctx) {
      return ctx[type];
    }
    if (type === "@direction" && type in ctx) {
      return ctx[type];
    }
    if (type === "@context") {
      return;
    }
    return null;
  };
  api.processingMode = (activeCtx, version) => {
    if (version.toString() >= "1.1") {
      return !activeCtx.processingMode || activeCtx.processingMode >= "json-ld-" + version.toString();
    } else {
      return activeCtx.processingMode === "json-ld-1.0";
    }
  };
  api.isKeyword = (v) => {
    if (!_isString(v) || v[0] !== "@") {
      return false;
    }
    switch (v) {
      case "@base":
      case "@container":
      case "@context":
      case "@default":
      case "@direction":
      case "@embed":
      case "@explicit":
      case "@graph":
      case "@id":
      case "@included":
      case "@index":
      case "@json":
      case "@language":
      case "@list":
      case "@nest":
      case "@none":
      case "@omitDefault":
      case "@prefix":
      case "@preserve":
      case "@protected":
      case "@requireAll":
      case "@reverse":
      case "@set":
      case "@type":
      case "@value":
      case "@version":
      case "@vocab":
        return true;
    }
    return false;
  };
  function _deepCompare(x1, x2) {
    if (!(x1 && typeof x1 === "object") || !(x2 && typeof x2 === "object")) {
      return x1 === x2;
    }
    const x1Array = Array.isArray(x1);
    if (x1Array !== Array.isArray(x2)) {
      return false;
    }
    if (x1Array) {
      if (x1.length !== x2.length) {
        return false;
      }
      for (let i2 = 0;i2 < x1.length; ++i2) {
        if (!_deepCompare(x1[i2], x2[i2])) {
          return false;
        }
      }
      return true;
    }
    const k1s = Object.keys(x1);
    const k2s = Object.keys(x2);
    if (k1s.length !== k2s.length) {
      return false;
    }
    for (const k1 in x1) {
      let v1 = x1[k1];
      let v2 = x2[k1];
      if (k1 === "@container") {
        if (Array.isArray(v1) && Array.isArray(v2)) {
          v1 = v1.slice().sort();
          v2 = v2.slice().sort();
        }
      }
      if (!_deepCompare(v1, v2)) {
        return false;
      }
    }
    return true;
  }
});

// node_modules/jsonld/lib/expand.js
var require_expand = __commonJS((exports, module) => {
  var JsonLdError = require_JsonLdError();
  var {
    isArray: _isArray,
    isObject: _isObject,
    isEmptyObject: _isEmptyObject,
    isString: _isString,
    isUndefined: _isUndefined
  } = require_types();
  var {
    isList: _isList,
    isValue: _isValue,
    isGraph: _isGraph,
    isSubject: _isSubject
  } = require_graphTypes();
  var {
    expandIri: _expandIri,
    getContextValue: _getContextValue,
    isKeyword: _isKeyword,
    process: _processContext,
    processingMode: _processingMode
  } = require_context();
  var {
    isAbsolute: _isAbsoluteIri
  } = require_url();
  var {
    REGEX_BCP47,
    REGEX_KEYWORD,
    addValue: _addValue,
    asArray: _asArray,
    getValues: _getValues,
    validateTypeValue: _validateTypeValue
  } = require_util();
  var {
    handleEvent: _handleEvent
  } = require_events();
  var api = {};
  module.exports = api;
  api.expand = async ({
    activeCtx,
    activeProperty = null,
    element,
    options = {},
    insideList = false,
    insideIndex = false,
    typeScopedContext = null
  }) => {
    if (element === null || element === undefined) {
      return null;
    }
    if (activeProperty === "@default") {
      options = Object.assign({}, options, { isFrame: false });
    }
    if (!_isArray(element) && !_isObject(element)) {
      if (!insideList && (activeProperty === null || _expandIri(activeCtx, activeProperty, { vocab: true }, options) === "@graph")) {
        if (options.eventHandler) {
          _handleEvent({
            event: {
              type: ["JsonLdEvent"],
              code: "free-floating scalar",
              level: "warning",
              message: "Dropping free-floating scalar not in a list.",
              details: {
                value: element
              }
            },
            options
          });
        }
        return null;
      }
      return _expandValue({ activeCtx, activeProperty, value: element, options });
    }
    if (_isArray(element)) {
      let rval2 = [];
      const container = _getContextValue(activeCtx, activeProperty, "@container") || [];
      insideList = insideList || container.includes("@list");
      for (let i2 = 0;i2 < element.length; ++i2) {
        let e = await api.expand({
          activeCtx,
          activeProperty,
          element: element[i2],
          options,
          insideIndex,
          typeScopedContext
        });
        if (insideList && _isArray(e)) {
          e = { "@list": e };
        }
        if (e === null) {
          continue;
        }
        if (_isArray(e)) {
          rval2 = rval2.concat(e);
        } else {
          rval2.push(e);
        }
      }
      return rval2;
    }
    const expandedActiveProperty = _expandIri(activeCtx, activeProperty, { vocab: true }, options);
    const propertyScopedCtx = _getContextValue(activeCtx, activeProperty, "@context");
    typeScopedContext = typeScopedContext || (activeCtx.previousContext ? activeCtx : null);
    let keys = Object.keys(element).sort();
    let mustRevert = !insideIndex;
    if (mustRevert && typeScopedContext && keys.length <= 2 && !keys.includes("@context")) {
      for (const key of keys) {
        const expandedProperty = _expandIri(typeScopedContext, key, { vocab: true }, options);
        if (expandedProperty === "@value") {
          mustRevert = false;
          activeCtx = typeScopedContext;
          break;
        }
        if (expandedProperty === "@id" && keys.length === 1) {
          mustRevert = false;
          break;
        }
      }
    }
    if (mustRevert) {
      activeCtx = activeCtx.revertToPreviousContext();
    }
    if (!_isUndefined(propertyScopedCtx)) {
      activeCtx = await _processContext({
        activeCtx,
        localCtx: propertyScopedCtx,
        propagate: true,
        overrideProtected: true,
        options
      });
    }
    if ("@context" in element) {
      activeCtx = await _processContext({ activeCtx, localCtx: element["@context"], options });
    }
    typeScopedContext = activeCtx;
    let typeKey = null;
    for (const key of keys) {
      const expandedProperty = _expandIri(activeCtx, key, { vocab: true }, options);
      if (expandedProperty === "@type") {
        typeKey = typeKey || key;
        const value = element[key];
        const types = Array.isArray(value) ? value.length > 1 ? value.slice().sort() : value : [value];
        for (const type of types) {
          const ctx = _getContextValue(typeScopedContext, type, "@context");
          if (!_isUndefined(ctx)) {
            activeCtx = await _processContext({
              activeCtx,
              localCtx: ctx,
              options,
              propagate: false
            });
          }
        }
      }
    }
    let rval = {};
    await _expandObject({
      activeCtx,
      activeProperty,
      expandedActiveProperty,
      element,
      expandedParent: rval,
      options,
      insideList,
      typeKey,
      typeScopedContext
    });
    keys = Object.keys(rval);
    let count = keys.length;
    if ("@value" in rval) {
      if ("@type" in rval && (("@language" in rval) || ("@direction" in rval))) {
        throw new JsonLdError('Invalid JSON-LD syntax; an element containing "@value" may not ' + 'contain both "@type" and either "@language" or "@direction".', "jsonld.SyntaxError", { code: "invalid value object", element: rval });
      }
      let validCount = count - 1;
      if ("@type" in rval) {
        validCount -= 1;
      }
      if ("@index" in rval) {
        validCount -= 1;
      }
      if ("@language" in rval) {
        validCount -= 1;
      }
      if ("@direction" in rval) {
        validCount -= 1;
      }
      if (validCount !== 0) {
        throw new JsonLdError('Invalid JSON-LD syntax; an element containing "@value" may only ' + 'have an "@index" property and either "@type" ' + 'or either or both "@language" or "@direction".', "jsonld.SyntaxError", { code: "invalid value object", element: rval });
      }
      const values = rval["@value"] === null ? [] : _asArray(rval["@value"]);
      const types = _getValues(rval, "@type");
      if (_processingMode(activeCtx, 1.1) && types.includes("@json") && types.length === 1) {} else if (values.length === 0) {
        if (options.eventHandler) {
          _handleEvent({
            event: {
              type: ["JsonLdEvent"],
              code: "null @value value",
              level: "warning",
              message: "Dropping null @value value.",
              details: {
                value: rval
              }
            },
            options
          });
        }
        rval = null;
      } else if (!values.every((v) => _isString(v) || _isEmptyObject(v)) && "@language" in rval) {
        throw new JsonLdError("Invalid JSON-LD syntax; only strings may be language-tagged.", "jsonld.SyntaxError", { code: "invalid language-tagged value", element: rval });
      } else if (!types.every((t) => _isAbsoluteIri(t) && !(_isString(t) && t.indexOf("_:") === 0) || _isEmptyObject(t))) {
        throw new JsonLdError('Invalid JSON-LD syntax; an element containing "@value" and "@type" ' + 'must have an absolute IRI for the value of "@type".', "jsonld.SyntaxError", { code: "invalid typed value", element: rval });
      }
    } else if ("@type" in rval && !_isArray(rval["@type"])) {
      rval["@type"] = [rval["@type"]];
    } else if ("@set" in rval || "@list" in rval) {
      if (count > 1 && !(count === 2 && ("@index" in rval))) {
        throw new JsonLdError('Invalid JSON-LD syntax; if an element has the property "@set" ' + 'or "@list", then it can have at most one other property that is ' + '"@index".', "jsonld.SyntaxError", { code: "invalid set or list object", element: rval });
      }
      if ("@set" in rval) {
        rval = rval["@set"];
        keys = Object.keys(rval);
        count = keys.length;
      }
    } else if (count === 1 && "@language" in rval) {
      if (options.eventHandler) {
        _handleEvent({
          event: {
            type: ["JsonLdEvent"],
            code: "object with only @language",
            level: "warning",
            message: "Dropping object with only @language.",
            details: {
              value: rval
            }
          },
          options
        });
      }
      rval = null;
    }
    if (_isObject(rval) && !options.keepFreeFloatingNodes && !insideList && (activeProperty === null || expandedActiveProperty === "@graph" || (_getContextValue(activeCtx, activeProperty, "@container") || []).includes("@graph"))) {
      rval = _dropUnsafeObject({ value: rval, count, options });
    }
    return rval;
  };
  function _dropUnsafeObject({
    value,
    count,
    options
  }) {
    if (count === 0 || "@value" in value || "@list" in value || count === 1 && "@id" in value) {
      if (options.eventHandler) {
        let code2;
        let message;
        if (count === 0) {
          code2 = "empty object";
          message = "Dropping empty object.";
        } else if ("@value" in value) {
          code2 = "object with only @value";
          message = "Dropping object with only @value.";
        } else if ("@list" in value) {
          code2 = "object with only @list";
          message = "Dropping object with only @list.";
        } else if (count === 1 && "@id" in value) {
          code2 = "object with only @id";
          message = "Dropping object with only @id.";
        }
        _handleEvent({
          event: {
            type: ["JsonLdEvent"],
            code: code2,
            level: "warning",
            message,
            details: {
              value
            }
          },
          options
        });
      }
      return null;
    }
    return value;
  }
  async function _expandObject({
    activeCtx,
    activeProperty,
    expandedActiveProperty,
    element,
    expandedParent,
    options = {},
    insideList,
    typeKey,
    typeScopedContext
  }) {
    const keys = Object.keys(element).sort();
    const nests = [];
    let unexpandedValue;
    const isJsonType = element[typeKey] && _expandIri(activeCtx, _isArray(element[typeKey]) ? element[typeKey][0] : element[typeKey], { vocab: true }, {
      ...options,
      typeExpansion: true
    }) === "@json";
    for (const key of keys) {
      let value = element[key];
      let expandedValue;
      if (key === "@context") {
        continue;
      }
      const expandedProperty = _expandIri(activeCtx, key, { vocab: true }, options);
      if (expandedProperty === null || !(_isAbsoluteIri(expandedProperty) || _isKeyword(expandedProperty))) {
        if (options.eventHandler) {
          _handleEvent({
            event: {
              type: ["JsonLdEvent"],
              code: "invalid property",
              level: "warning",
              message: "Dropping property that did not expand into an " + "absolute IRI or keyword.",
              details: {
                property: key,
                expandedProperty
              }
            },
            options
          });
        }
        continue;
      }
      if (_isKeyword(expandedProperty)) {
        if (expandedActiveProperty === "@reverse") {
          throw new JsonLdError("Invalid JSON-LD syntax; a keyword cannot be used as a @reverse " + "property.", "jsonld.SyntaxError", { code: "invalid reverse property map", value });
        }
        if (expandedProperty in expandedParent && expandedProperty !== "@included" && expandedProperty !== "@type") {
          throw new JsonLdError("Invalid JSON-LD syntax; colliding keywords detected.", "jsonld.SyntaxError", { code: "colliding keywords", keyword: expandedProperty });
        }
      }
      if (expandedProperty === "@id") {
        if (!_isString(value)) {
          if (!options.isFrame) {
            throw new JsonLdError('Invalid JSON-LD syntax; "@id" value must a string.', "jsonld.SyntaxError", { code: "invalid @id value", value });
          }
          if (_isObject(value)) {
            if (!_isEmptyObject(value)) {
              throw new JsonLdError('Invalid JSON-LD syntax; "@id" value an empty object or array ' + "of strings, if framing", "jsonld.SyntaxError", { code: "invalid @id value", value });
            }
          } else if (_isArray(value)) {
            if (!value.every((v) => _isString(v))) {
              throw new JsonLdError('Invalid JSON-LD syntax; "@id" value an empty object or array ' + "of strings, if framing", "jsonld.SyntaxError", { code: "invalid @id value", value });
            }
          } else {
            throw new JsonLdError('Invalid JSON-LD syntax; "@id" value an empty object or array ' + "of strings, if framing", "jsonld.SyntaxError", { code: "invalid @id value", value });
          }
        }
        _addValue(expandedParent, "@id", _asArray(value).map((v) => {
          if (_isString(v)) {
            const ve = _expandIri(activeCtx, v, { base: true }, options);
            if (options.eventHandler) {
              if (ve === null) {
                if (v === null) {
                  _handleEvent({
                    event: {
                      type: ["JsonLdEvent"],
                      code: "null @id value",
                      level: "warning",
                      message: "Null @id found.",
                      details: {
                        id: v
                      }
                    },
                    options
                  });
                } else {
                  _handleEvent({
                    event: {
                      type: ["JsonLdEvent"],
                      code: "reserved @id value",
                      level: "warning",
                      message: "Reserved @id found.",
                      details: {
                        id: v
                      }
                    },
                    options
                  });
                }
              } else if (!_isAbsoluteIri(ve)) {
                _handleEvent({
                  event: {
                    type: ["JsonLdEvent"],
                    code: "relative @id reference",
                    level: "warning",
                    message: "Relative @id reference found.",
                    details: {
                      id: v,
                      expandedId: ve
                    }
                  },
                  options
                });
              }
            }
            return ve;
          }
          return v;
        }), { propertyIsArray: options.isFrame });
        continue;
      }
      if (expandedProperty === "@type") {
        if (_isObject(value)) {
          value = Object.fromEntries(Object.entries(value).map(([k, v]) => [
            _expandIri(typeScopedContext, k, { vocab: true }),
            _asArray(v).map((vv) => _expandIri(typeScopedContext, vv, { base: true, vocab: true }, { ...options, typeExpansion: true }))
          ]));
        }
        _validateTypeValue(value, options.isFrame);
        _addValue(expandedParent, "@type", _asArray(value).map((v) => {
          if (_isString(v)) {
            const ve = _expandIri(typeScopedContext, v, { base: true, vocab: true }, { ...options, typeExpansion: true });
            if (ve !== "@json" && !_isAbsoluteIri(ve)) {
              if (options.eventHandler) {
                _handleEvent({
                  event: {
                    type: ["JsonLdEvent"],
                    code: "relative @type reference",
                    level: "warning",
                    message: "Relative @type reference found.",
                    details: {
                      type: v
                    }
                  },
                  options
                });
              }
            }
            return ve;
          }
          return v;
        }), { propertyIsArray: !!options.isFrame });
        continue;
      }
      if (expandedProperty === "@included" && _processingMode(activeCtx, 1.1)) {
        const includedResult = _asArray(await api.expand({
          activeCtx,
          activeProperty,
          element: value,
          options
        }));
        if (!includedResult.every((v) => _isSubject(v))) {
          throw new JsonLdError("Invalid JSON-LD syntax; " + "values of @included must expand to node objects.", "jsonld.SyntaxError", { code: "invalid @included value", value });
        }
        _addValue(expandedParent, "@included", includedResult, { propertyIsArray: true });
        continue;
      }
      if (expandedProperty === "@graph" && !(_isObject(value) || _isArray(value))) {
        throw new JsonLdError('Invalid JSON-LD syntax; "@graph" value must not be an ' + "object or an array.", "jsonld.SyntaxError", { code: "invalid @graph value", value });
      }
      if (expandedProperty === "@value") {
        unexpandedValue = value;
        if (isJsonType && _processingMode(activeCtx, 1.1)) {
          expandedParent["@value"] = value;
        } else {
          _addValue(expandedParent, "@value", value, { propertyIsArray: options.isFrame });
        }
        continue;
      }
      if (expandedProperty === "@language") {
        if (value === null) {
          continue;
        }
        if (!_isString(value) && !options.isFrame) {
          throw new JsonLdError('Invalid JSON-LD syntax; "@language" value must be a string.', "jsonld.SyntaxError", { code: "invalid language-tagged string", value });
        }
        value = _asArray(value).map((v) => _isString(v) ? v.toLowerCase() : v);
        for (const language of value) {
          if (_isString(language) && !language.match(REGEX_BCP47)) {
            if (options.eventHandler) {
              _handleEvent({
                event: {
                  type: ["JsonLdEvent"],
                  code: "invalid @language value",
                  level: "warning",
                  message: "@language value must be valid BCP47.",
                  details: {
                    language
                  }
                },
                options
              });
            }
          }
        }
        _addValue(expandedParent, "@language", value, { propertyIsArray: options.isFrame });
        continue;
      }
      if (expandedProperty === "@direction") {
        if (!_isString(value) && !options.isFrame) {
          throw new JsonLdError('Invalid JSON-LD syntax; "@direction" value must be a string.', "jsonld.SyntaxError", { code: "invalid base direction", value });
        }
        value = _asArray(value);
        for (const dir of value) {
          if (_isString(dir) && dir !== "ltr" && dir !== "rtl") {
            throw new JsonLdError('Invalid JSON-LD syntax; "@direction" must be "ltr" or "rtl".', "jsonld.SyntaxError", { code: "invalid base direction", value });
          }
        }
        _addValue(expandedParent, "@direction", value, { propertyIsArray: options.isFrame });
        continue;
      }
      if (expandedProperty === "@index") {
        if (!_isString(value)) {
          throw new JsonLdError('Invalid JSON-LD syntax; "@index" value must be a string.', "jsonld.SyntaxError", { code: "invalid @index value", value });
        }
        _addValue(expandedParent, "@index", value);
        continue;
      }
      if (expandedProperty === "@reverse") {
        if (!_isObject(value)) {
          throw new JsonLdError('Invalid JSON-LD syntax; "@reverse" value must be an object.', "jsonld.SyntaxError", { code: "invalid @reverse value", value });
        }
        expandedValue = await api.expand({
          activeCtx,
          activeProperty: "@reverse",
          element: value,
          options
        });
        if ("@reverse" in expandedValue) {
          for (const property in expandedValue["@reverse"]) {
            _addValue(expandedParent, property, expandedValue["@reverse"][property], { propertyIsArray: true });
          }
        }
        let reverseMap = expandedParent["@reverse"] || null;
        for (const property in expandedValue) {
          if (property === "@reverse") {
            continue;
          }
          if (reverseMap === null) {
            reverseMap = expandedParent["@reverse"] = {};
          }
          _addValue(reverseMap, property, [], { propertyIsArray: true });
          const items = expandedValue[property];
          for (let ii = 0;ii < items.length; ++ii) {
            const item = items[ii];
            if (_isValue(item) || _isList(item)) {
              throw new JsonLdError('Invalid JSON-LD syntax; "@reverse" value must not be a ' + "@value or an @list.", "jsonld.SyntaxError", { code: "invalid reverse property value", value: expandedValue });
            }
            _addValue(reverseMap, property, item, { propertyIsArray: true });
          }
        }
        continue;
      }
      if (expandedProperty === "@nest") {
        nests.push(key);
        continue;
      }
      let termCtx = activeCtx;
      const ctx = _getContextValue(activeCtx, key, "@context");
      if (!_isUndefined(ctx)) {
        termCtx = await _processContext({
          activeCtx,
          localCtx: ctx,
          propagate: true,
          overrideProtected: true,
          options
        });
      }
      const container = _getContextValue(activeCtx, key, "@container") || [];
      if (container.includes("@language") && _isObject(value)) {
        const direction = _getContextValue(termCtx, key, "@direction");
        expandedValue = _expandLanguageMap(termCtx, value, direction, options);
      } else if (container.includes("@index") && _isObject(value)) {
        const asGraph = container.includes("@graph");
        const indexKey = _getContextValue(termCtx, key, "@index") || "@index";
        const propertyIndex = indexKey !== "@index" && _expandIri(activeCtx, indexKey, { vocab: true }, options);
        expandedValue = await _expandIndexMap({
          activeCtx: termCtx,
          options,
          activeProperty: key,
          value,
          asGraph,
          indexKey,
          propertyIndex
        });
      } else if (container.includes("@id") && _isObject(value)) {
        const asGraph = container.includes("@graph");
        expandedValue = await _expandIndexMap({
          activeCtx: termCtx,
          options,
          activeProperty: key,
          value,
          asGraph,
          indexKey: "@id"
        });
      } else if (container.includes("@type") && _isObject(value)) {
        expandedValue = await _expandIndexMap({
          activeCtx: termCtx.revertToPreviousContext(),
          options,
          activeProperty: key,
          value,
          asGraph: false,
          indexKey: "@type"
        });
      } else {
        const isList = expandedProperty === "@list";
        if (isList || expandedProperty === "@set") {
          let nextActiveProperty = activeProperty;
          if (isList && expandedActiveProperty === "@graph") {
            nextActiveProperty = null;
          }
          expandedValue = await api.expand({
            activeCtx: termCtx,
            activeProperty: nextActiveProperty,
            element: value,
            options,
            insideList: isList
          });
        } else if (_getContextValue(activeCtx, key, "@type") === "@json") {
          expandedValue = {
            "@type": "@json",
            "@value": value
          };
        } else {
          expandedValue = await api.expand({
            activeCtx: termCtx,
            activeProperty: key,
            element: value,
            options,
            insideList: false
          });
        }
      }
      if (expandedValue === null && expandedProperty !== "@value") {
        continue;
      }
      if (expandedProperty !== "@list" && !_isList(expandedValue) && container.includes("@list")) {
        expandedValue = { "@list": _asArray(expandedValue) };
      }
      if (container.includes("@graph") && !container.some((key2) => key2 === "@id" || key2 === "@index")) {
        expandedValue = _asArray(expandedValue);
        if (!options.isFrame) {
          expandedValue = expandedValue.filter((v) => {
            const count = Object.keys(v).length;
            return _dropUnsafeObject({ value: v, count, options }) !== null;
          });
        }
        if (expandedValue.length === 0) {
          continue;
        }
        expandedValue = expandedValue.map((v) => ({ "@graph": _asArray(v) }));
      }
      if (termCtx.mappings.has(key) && termCtx.mappings.get(key).reverse) {
        const reverseMap = expandedParent["@reverse"] = expandedParent["@reverse"] || {};
        expandedValue = _asArray(expandedValue);
        for (let ii = 0;ii < expandedValue.length; ++ii) {
          const item = expandedValue[ii];
          if (_isValue(item) || _isList(item)) {
            throw new JsonLdError('Invalid JSON-LD syntax; "@reverse" value must not be a ' + "@value or an @list.", "jsonld.SyntaxError", { code: "invalid reverse property value", value: expandedValue });
          }
          _addValue(reverseMap, expandedProperty, item, { propertyIsArray: true });
        }
        continue;
      }
      _addValue(expandedParent, expandedProperty, expandedValue, {
        propertyIsArray: true
      });
    }
    if ("@value" in expandedParent) {
      if (expandedParent["@type"] === "@json" && _processingMode(activeCtx, 1.1)) {} else if ((_isObject(unexpandedValue) || _isArray(unexpandedValue)) && !options.isFrame) {
        throw new JsonLdError('Invalid JSON-LD syntax; "@value" value must not be an ' + "object or an array.", "jsonld.SyntaxError", { code: "invalid value object value", value: unexpandedValue });
      }
    }
    for (const key of nests) {
      const nestedValues = _isArray(element[key]) ? element[key] : [element[key]];
      for (const nv of nestedValues) {
        if (!_isObject(nv) || Object.keys(nv).some((k) => _expandIri(activeCtx, k, { vocab: true }, options) === "@value")) {
          throw new JsonLdError("Invalid JSON-LD syntax; nested value must be a node object.", "jsonld.SyntaxError", { code: "invalid @nest value", value: nv });
        }
        await _expandObject({
          activeCtx,
          activeProperty,
          expandedActiveProperty,
          element: nv,
          expandedParent,
          options,
          insideList,
          typeScopedContext,
          typeKey
        });
      }
    }
  }
  function _expandValue({ activeCtx, activeProperty, value, options }) {
    if (value === null || value === undefined) {
      return null;
    }
    const expandedProperty = _expandIri(activeCtx, activeProperty, { vocab: true }, options);
    if (expandedProperty === "@id") {
      return _expandIri(activeCtx, value, { base: true }, options);
    } else if (expandedProperty === "@type") {
      return _expandIri(activeCtx, value, { vocab: true, base: true }, { ...options, typeExpansion: true });
    }
    const type = _getContextValue(activeCtx, activeProperty, "@type");
    if ((type === "@id" || expandedProperty === "@graph") && _isString(value)) {
      const expandedValue = _expandIri(activeCtx, value, { base: true }, options);
      if (expandedValue === null && value.match(REGEX_KEYWORD)) {
        if (options.eventHandler) {
          _handleEvent({
            event: {
              type: ["JsonLdEvent"],
              code: "reserved @id value",
              level: "warning",
              message: "Reserved @id found.",
              details: {
                id: activeProperty
              }
            },
            options
          });
        }
      }
      return { "@id": expandedValue };
    }
    if (type === "@vocab" && _isString(value)) {
      return {
        "@id": _expandIri(activeCtx, value, { vocab: true, base: true }, options)
      };
    }
    if (_isKeyword(expandedProperty)) {
      return value;
    }
    const rval = {};
    if (type && !["@id", "@vocab", "@none"].includes(type)) {
      rval["@type"] = type;
    } else if (_isString(value)) {
      const language = _getContextValue(activeCtx, activeProperty, "@language");
      if (language !== null) {
        rval["@language"] = language;
      }
      const direction = _getContextValue(activeCtx, activeProperty, "@direction");
      if (direction !== null) {
        rval["@direction"] = direction;
      }
    }
    if (!["boolean", "number", "string"].includes(typeof value)) {
      value = value.toString();
    }
    rval["@value"] = value;
    return rval;
  }
  function _expandLanguageMap(activeCtx, languageMap, direction, options) {
    const rval = [];
    const keys = Object.keys(languageMap).sort();
    for (const key of keys) {
      const expandedKey = _expandIri(activeCtx, key, { vocab: true }, options);
      let val = languageMap[key];
      if (!_isArray(val)) {
        val = [val];
      }
      for (const item of val) {
        if (item === null) {
          continue;
        }
        if (!_isString(item)) {
          throw new JsonLdError("Invalid JSON-LD syntax; language map values must be strings.", "jsonld.SyntaxError", { code: "invalid language map value", languageMap });
        }
        const val2 = { "@value": item };
        if (expandedKey !== "@none") {
          if (!key.match(REGEX_BCP47)) {
            if (options.eventHandler) {
              _handleEvent({
                event: {
                  type: ["JsonLdEvent"],
                  code: "invalid @language value",
                  level: "warning",
                  message: "@language value must be valid BCP47.",
                  details: {
                    language: key
                  }
                },
                options
              });
            }
          }
          val2["@language"] = key.toLowerCase();
        }
        if (direction) {
          val2["@direction"] = direction;
        }
        rval.push(val2);
      }
    }
    return rval;
  }
  async function _expandIndexMap({
    activeCtx,
    options,
    activeProperty,
    value,
    asGraph,
    indexKey,
    propertyIndex
  }) {
    const rval = [];
    const keys = Object.keys(value).sort();
    const isTypeIndex = indexKey === "@type";
    for (let key of keys) {
      if (isTypeIndex) {
        const ctx = _getContextValue(activeCtx, key, "@context");
        if (!_isUndefined(ctx)) {
          activeCtx = await _processContext({
            activeCtx,
            localCtx: ctx,
            propagate: false,
            options
          });
        }
      }
      let val = value[key];
      if (!_isArray(val)) {
        val = [val];
      }
      val = await api.expand({
        activeCtx,
        activeProperty,
        element: val,
        options,
        insideList: false,
        insideIndex: true
      });
      let expandedKey;
      if (propertyIndex) {
        if (key === "@none") {
          expandedKey = "@none";
        } else {
          expandedKey = _expandValue({ activeCtx, activeProperty: indexKey, value: key, options });
        }
      } else {
        expandedKey = _expandIri(activeCtx, key, { vocab: true }, options);
      }
      if (indexKey === "@id") {
        key = _expandIri(activeCtx, key, { base: true }, options);
      } else if (isTypeIndex) {
        key = expandedKey;
      }
      for (let item of val) {
        if (asGraph && !_isGraph(item)) {
          item = { "@graph": [item] };
        }
        if (indexKey === "@type") {
          if (expandedKey === "@none") {} else if (item["@type"]) {
            item["@type"] = [key].concat(item["@type"]);
          } else {
            item["@type"] = [key];
          }
        } else if (_isValue(item) && !["@language", "@type", "@index"].includes(indexKey)) {
          throw new JsonLdError("Invalid JSON-LD syntax; Attempt to add illegal key to value " + `object: "${indexKey}".`, "jsonld.SyntaxError", { code: "invalid value object", value: item });
        } else if (propertyIndex) {
          if (expandedKey !== "@none") {
            _addValue(item, propertyIndex, expandedKey, {
              propertyIsArray: true,
              prependValue: true
            });
          }
        } else if (expandedKey !== "@none" && !(indexKey in item)) {
          item[indexKey] = key;
        }
        rval.push(item);
      }
    }
    return rval;
  }
});

// node_modules/jsonld/lib/nodeMap.js
var require_nodeMap = __commonJS((exports, module) => {
  var { isKeyword } = require_context();
  var graphTypes = require_graphTypes();
  var types = require_types();
  var util = require_util();
  var JsonLdError = require_JsonLdError();
  var api = {};
  module.exports = api;
  api.createMergedNodeMap = (input, options) => {
    options = options || {};
    const issuer = options.issuer || new util.IdentifierIssuer("_:b");
    const graphs = { "@default": {} };
    api.createNodeMap(input, graphs, "@default", issuer);
    return api.mergeNodeMaps(graphs);
  };
  api.createNodeMap = (input, graphs, graph, issuer, name, list) => {
    if (types.isArray(input)) {
      for (const node of input) {
        api.createNodeMap(node, graphs, graph, issuer, undefined, list);
      }
      return;
    }
    if (!types.isObject(input)) {
      if (list) {
        list.push(input);
      }
      return;
    }
    if (graphTypes.isValue(input)) {
      if ("@type" in input) {
        let type = input["@type"];
        if (type.indexOf("_:") === 0) {
          input["@type"] = type = issuer.getId(type);
        }
      }
      if (list) {
        list.push(input);
      }
      return;
    } else if (list && graphTypes.isList(input)) {
      const _list = [];
      api.createNodeMap(input["@list"], graphs, graph, issuer, name, _list);
      list.push({ "@list": _list });
      return;
    }
    if ("@type" in input) {
      const types2 = input["@type"];
      for (const type of types2) {
        if (type.indexOf("_:") === 0) {
          issuer.getId(type);
        }
      }
    }
    if (types.isUndefined(name)) {
      name = graphTypes.isBlankNode(input) ? issuer.getId(input["@id"]) : input["@id"];
    }
    if (list) {
      list.push({ "@id": name });
    }
    const subjects = graphs[graph];
    const subject = subjects[name] = subjects[name] || {};
    subject["@id"] = name;
    const properties = Object.keys(input).sort();
    for (let property of properties) {
      if (property === "@id") {
        continue;
      }
      if (property === "@reverse") {
        const referencedNode = { "@id": name };
        const reverseMap = input["@reverse"];
        for (const reverseProperty in reverseMap) {
          const items = reverseMap[reverseProperty];
          for (const item of items) {
            let itemName = item["@id"];
            if (graphTypes.isBlankNode(item)) {
              itemName = issuer.getId(itemName);
            }
            api.createNodeMap(item, graphs, graph, issuer, itemName);
            util.addValue(subjects[itemName], reverseProperty, referencedNode, { propertyIsArray: true, allowDuplicate: false });
          }
        }
        continue;
      }
      if (property === "@graph") {
        if (!(name in graphs)) {
          graphs[name] = {};
        }
        api.createNodeMap(input[property], graphs, name, issuer);
        continue;
      }
      if (property === "@included") {
        api.createNodeMap(input[property], graphs, graph, issuer);
        continue;
      }
      if (property !== "@type" && isKeyword(property)) {
        if (property === "@index" && property in subject && (input[property] !== subject[property] || input[property]["@id"] !== subject[property]["@id"])) {
          throw new JsonLdError("Invalid JSON-LD syntax; conflicting @index property detected.", "jsonld.SyntaxError", { code: "conflicting indexes", subject });
        }
        subject[property] = input[property];
        continue;
      }
      const objects = input[property];
      if (property.indexOf("_:") === 0) {
        property = issuer.getId(property);
      }
      if (objects.length === 0) {
        util.addValue(subject, property, [], { propertyIsArray: true });
        continue;
      }
      for (let o of objects) {
        if (property === "@type") {
          o = o.indexOf("_:") === 0 ? issuer.getId(o) : o;
        }
        if (graphTypes.isSubject(o) || graphTypes.isSubjectReference(o)) {
          if ("@id" in o && !o["@id"]) {
            continue;
          }
          const id = graphTypes.isBlankNode(o) ? issuer.getId(o["@id"]) : o["@id"];
          util.addValue(subject, property, { "@id": id }, { propertyIsArray: true, allowDuplicate: false });
          api.createNodeMap(o, graphs, graph, issuer, id);
        } else if (graphTypes.isValue(o)) {
          util.addValue(subject, property, o, { propertyIsArray: true, allowDuplicate: false });
        } else if (graphTypes.isList(o)) {
          const _list = [];
          api.createNodeMap(o["@list"], graphs, graph, issuer, name, _list);
          o = { "@list": _list };
          util.addValue(subject, property, o, { propertyIsArray: true, allowDuplicate: false });
        } else {
          api.createNodeMap(o, graphs, graph, issuer, name);
          util.addValue(subject, property, o, { propertyIsArray: true, allowDuplicate: false });
        }
      }
    }
  };
  api.mergeNodeMapGraphs = (graphs) => {
    const merged = {};
    for (const name of Object.keys(graphs).sort()) {
      for (const id of Object.keys(graphs[name]).sort()) {
        const node = graphs[name][id];
        if (!(id in merged)) {
          merged[id] = { "@id": id };
        }
        const mergedNode = merged[id];
        for (const property of Object.keys(node).sort()) {
          if (isKeyword(property) && property !== "@type") {
            mergedNode[property] = util.clone(node[property]);
          } else {
            for (const value of node[property]) {
              util.addValue(mergedNode, property, util.clone(value), { propertyIsArray: true, allowDuplicate: false });
            }
          }
        }
      }
    }
    return merged;
  };
  api.mergeNodeMaps = (graphs) => {
    const defaultGraph2 = graphs["@default"];
    const graphNames = Object.keys(graphs).sort();
    for (const graphName of graphNames) {
      if (graphName === "@default") {
        continue;
      }
      const nodeMap = graphs[graphName];
      let subject = defaultGraph2[graphName];
      if (!subject) {
        defaultGraph2[graphName] = subject = {
          "@id": graphName,
          "@graph": []
        };
      } else if (!("@graph" in subject)) {
        subject["@graph"] = [];
      }
      const graph = subject["@graph"];
      for (const id of Object.keys(nodeMap).sort()) {
        const node = nodeMap[id];
        if (!graphTypes.isSubjectReference(node)) {
          graph.push(node);
        }
      }
    }
    return defaultGraph2;
  };
});

// node_modules/jsonld/lib/flatten.js
var require_flatten = __commonJS((exports, module) => {
  var {
    isSubjectReference: _isSubjectReference
  } = require_graphTypes();
  var {
    createMergedNodeMap: _createMergedNodeMap
  } = require_nodeMap();
  var api = {};
  module.exports = api;
  api.flatten = (input) => {
    const defaultGraph2 = _createMergedNodeMap(input);
    const flattened = [];
    const keys = Object.keys(defaultGraph2).sort();
    for (let ki = 0;ki < keys.length; ++ki) {
      const node = defaultGraph2[keys[ki]];
      if (!_isSubjectReference(node)) {
        flattened.push(node);
      }
    }
    return flattened;
  };
});

// node_modules/jsonld/lib/fromRdf.js
var require_fromRdf = __commonJS((exports, module) => {
  var JsonLdError = require_JsonLdError();
  var graphTypes = require_graphTypes();
  var types = require_types();
  var {
    REGEX_BCP47,
    addValue: _addValue
  } = require_util();
  var {
    handleEvent: _handleEvent
  } = require_events();
  var {
    RDF_LIST,
    RDF_FIRST,
    RDF_REST,
    RDF_NIL,
    RDF_TYPE,
    RDF_JSON_LITERAL,
    XSD_BOOLEAN,
    XSD_DOUBLE,
    XSD_INTEGER,
    XSD_STRING
  } = require_constants();
  var api = {};
  module.exports = api;
  api.fromRDF = async (dataset, options) => {
    const {
      useRdfType = false,
      useNativeTypes = false,
      rdfDirection = null
    } = options;
    const defaultGraph2 = {};
    const graphMap = { "@default": defaultGraph2 };
    const referencedOnce = {};
    if (rdfDirection) {
      if (rdfDirection === "compound-literal") {
        throw new JsonLdError("Unsupported rdfDirection value.", "jsonld.InvalidRdfDirection", { value: rdfDirection });
      } else if (rdfDirection !== "i18n-datatype") {
        throw new JsonLdError("Unknown rdfDirection value.", "jsonld.InvalidRdfDirection", { value: rdfDirection });
      }
    }
    for (const quad2 of dataset) {
      const name = quad2.graph.termType === "DefaultGraph" ? "@default" : quad2.graph.value;
      if (!(name in graphMap)) {
        graphMap[name] = {};
      }
      if (name !== "@default" && !(name in defaultGraph2)) {
        defaultGraph2[name] = { "@id": name };
      }
      const nodeMap = graphMap[name];
      const s = _nodeId(quad2.subject);
      const p = quad2.predicate.value;
      const o = quad2.object;
      if (!(s in nodeMap)) {
        nodeMap[s] = { "@id": s };
      }
      const node = nodeMap[s];
      const objectNodeId = _nodeId(o);
      const objectIsNode = !!objectNodeId;
      if (objectIsNode && !(objectNodeId in nodeMap)) {
        nodeMap[objectNodeId] = { "@id": objectNodeId };
      }
      if (p === RDF_TYPE && !useRdfType && objectIsNode) {
        _addValue(node, "@type", objectNodeId, { propertyIsArray: true });
        continue;
      }
      const value = _RDFToObject(o, useNativeTypes, rdfDirection, options);
      _addValue(node, p, value, { propertyIsArray: true });
      if (objectIsNode) {
        if (objectNodeId === RDF_NIL) {
          const object = nodeMap[objectNodeId];
          if (!("usages" in object)) {
            object.usages = [];
          }
          object.usages.push({
            node,
            property: p,
            value
          });
        } else if (objectNodeId in referencedOnce) {
          referencedOnce[objectNodeId] = false;
        } else {
          referencedOnce[objectNodeId] = {
            node,
            property: p,
            value
          };
        }
      }
    }
    for (const name in graphMap) {
      const graphObject = graphMap[name];
      if (!(RDF_NIL in graphObject)) {
        continue;
      }
      const nil = graphObject[RDF_NIL];
      if (!nil.usages) {
        continue;
      }
      for (let usage of nil.usages) {
        let node = usage.node;
        let property = usage.property;
        let head = usage.value;
        const list = [];
        const listNodes = [];
        let nodeKeyCount = Object.keys(node).length;
        while (property === RDF_REST && types.isObject(referencedOnce[node["@id"]]) && types.isArray(node[RDF_FIRST]) && node[RDF_FIRST].length === 1 && types.isArray(node[RDF_REST]) && node[RDF_REST].length === 1 && (nodeKeyCount === 3 || nodeKeyCount === 4 && types.isArray(node["@type"]) && node["@type"].length === 1 && node["@type"][0] === RDF_LIST)) {
          list.push(node[RDF_FIRST][0]);
          listNodes.push(node["@id"]);
          usage = referencedOnce[node["@id"]];
          node = usage.node;
          property = usage.property;
          head = usage.value;
          nodeKeyCount = Object.keys(node).length;
          if (!graphTypes.isBlankNode(node)) {
            break;
          }
        }
        delete head["@id"];
        head["@list"] = list.reverse();
        for (const listNode of listNodes) {
          delete graphObject[listNode];
        }
      }
      delete nil.usages;
    }
    const result = [];
    const subjects = Object.keys(defaultGraph2).sort();
    for (const subject of subjects) {
      const node = defaultGraph2[subject];
      if (subject in graphMap) {
        const graph = node["@graph"] = [];
        const graphObject = graphMap[subject];
        const graphSubjects = Object.keys(graphObject).sort();
        for (const graphSubject of graphSubjects) {
          const node2 = graphObject[graphSubject];
          if (!graphTypes.isSubjectReference(node2)) {
            graph.push(node2);
          }
        }
      }
      if (!graphTypes.isSubjectReference(node)) {
        result.push(node);
      }
    }
    return result;
  };
  function _RDFToObject(o, useNativeTypes, rdfDirection, options) {
    const nodeId = _nodeId(o);
    if (nodeId) {
      return { "@id": nodeId };
    }
    const rval = { "@value": o.value };
    if (o.language) {
      if (!o.language.match(REGEX_BCP47)) {
        if (options.eventHandler) {
          _handleEvent({
            event: {
              type: ["JsonLdEvent"],
              code: "invalid @language value",
              level: "warning",
              message: "@language value must be valid BCP47.",
              details: {
                language: o.language
              }
            },
            options
          });
        }
      }
      rval["@language"] = o.language;
    } else {
      let type = o.datatype.value;
      if (!type) {
        type = XSD_STRING;
      }
      if (type === RDF_JSON_LITERAL) {
        type = "@json";
        try {
          rval["@value"] = JSON.parse(rval["@value"]);
        } catch (e) {
          throw new JsonLdError("JSON literal could not be parsed.", "jsonld.InvalidJsonLiteral", { code: "invalid JSON literal", value: rval["@value"], cause: e });
        }
      }
      if (useNativeTypes) {
        if (type === XSD_BOOLEAN) {
          if (rval["@value"] === "true" || rval["@value"] === "1") {
            rval["@value"] = true;
          } else if (rval["@value"] === "false" || rval["@value"] === "0") {
            rval["@value"] = false;
          } else {
            rval["@type"] = type;
          }
        } else if (type === XSD_INTEGER) {
          if (types.isNumeric(rval["@value"])) {
            const i2 = parseInt(rval["@value"], 10);
            if (i2.toFixed(0) === rval["@value"]) {
              rval["@value"] = i2;
            }
          } else {
            rval["@type"] = type;
          }
        } else if (type === XSD_DOUBLE) {
          if (types.isNumeric(rval["@value"])) {
            rval["@value"] = parseFloat(rval["@value"]);
          } else {
            rval["@type"] = type;
          }
        } else {
          rval["@type"] = type;
        }
      } else if (rdfDirection === "i18n-datatype" && type.startsWith("https://www.w3.org/ns/i18n#")) {
        const [, language, direction] = type.split(/[#_]/);
        if (language.length > 0) {
          rval["@language"] = language;
          if (!language.match(REGEX_BCP47)) {
            if (options.eventHandler) {
              _handleEvent({
                event: {
                  type: ["JsonLdEvent"],
                  code: "invalid @language value",
                  level: "warning",
                  message: "@language value must be valid BCP47.",
                  details: {
                    language
                  }
                },
                options
              });
            }
          }
        }
        rval["@direction"] = direction;
      } else if (type !== XSD_STRING) {
        rval["@type"] = type;
      }
    }
    return rval;
  }
  function _nodeId(term) {
    if (term.termType === "NamedNode") {
      return term.value;
    } else if (term.termType === "BlankNode") {
      return "_:" + term.value;
    }
    return null;
  }
});

// node_modules/canonicalize/lib/canonicalize.js
var require_canonicalize = __commonJS((exports, module) => {
  module.exports = function serialize(object) {
    if (typeof object === "number" && isNaN(object)) {
      throw new Error("NaN is not allowed");
    }
    if (typeof object === "number" && !isFinite(object)) {
      throw new Error("Infinity is not allowed");
    }
    if (object === null || typeof object !== "object") {
      return JSON.stringify(object);
    }
    if (object.toJSON instanceof Function) {
      return serialize(object.toJSON());
    }
    if (Array.isArray(object)) {
      const values2 = object.reduce((t, cv, ci) => {
        const comma = ci === 0 ? "" : ",";
        const value = cv === undefined || typeof cv === "symbol" ? null : cv;
        return `${t}${comma}${serialize(value)}`;
      }, "");
      return `[${values2}]`;
    }
    const values = Object.keys(object).sort().reduce((t, cv) => {
      if (object[cv] === undefined || typeof object[cv] === "symbol") {
        return t;
      }
      const comma = t.length === 0 ? "" : ",";
      return `${t}${comma}${serialize(cv)}:${serialize(object[cv])}`;
    }, "");
    return `{${values}}`;
  };
});

// node_modules/jsonld/lib/toRdf.js
var require_toRdf = __commonJS((exports, module) => {
  var { createNodeMap } = require_nodeMap();
  var { isKeyword } = require_context();
  var graphTypes = require_graphTypes();
  var jsonCanonicalize = require_canonicalize();
  var JsonLdError = require_JsonLdError();
  var types = require_types();
  var util = require_util();
  var {
    handleEvent: _handleEvent
  } = require_events();
  var {
    RDF_FIRST,
    RDF_REST,
    RDF_NIL,
    RDF_TYPE,
    RDF_JSON_LITERAL,
    RDF_LANGSTRING,
    XSD_BOOLEAN,
    XSD_DOUBLE,
    XSD_INTEGER,
    XSD_STRING
  } = require_constants();
  var {
    isAbsolute: _isAbsoluteIri
  } = require_url();
  var api = {};
  module.exports = api;
  api.toRDF = (input, options) => {
    const issuer = new util.IdentifierIssuer("_:b");
    const nodeMap = { "@default": {} };
    createNodeMap(input, nodeMap, "@default", issuer);
    const dataset = [];
    const graphNames = Object.keys(nodeMap).sort();
    for (const graphName of graphNames) {
      let graphTerm;
      if (graphName === "@default") {
        graphTerm = { termType: "DefaultGraph", value: "" };
      } else if (_isAbsoluteIri(graphName)) {
        graphTerm = _makeTerm(graphName);
      } else {
        if (options.eventHandler) {
          _handleEvent({
            event: {
              type: ["JsonLdEvent"],
              code: "relative graph reference",
              level: "warning",
              message: "Relative graph reference found.",
              details: {
                graph: graphName
              }
            },
            options
          });
        }
        continue;
      }
      _graphToRDF(dataset, nodeMap[graphName], graphTerm, issuer, options);
    }
    return dataset;
  };
  function _graphToRDF(dataset, graph, graphTerm, issuer, options) {
    const ids = Object.keys(graph).sort();
    for (const id of ids) {
      const node = graph[id];
      const properties = Object.keys(node).sort();
      for (let property of properties) {
        const items = node[property];
        if (property === "@type") {
          property = RDF_TYPE;
        } else if (isKeyword(property)) {
          continue;
        }
        for (const item of items) {
          const subject = _makeTerm(id);
          if (!_isAbsoluteIri(id)) {
            if (options.eventHandler) {
              _handleEvent({
                event: {
                  type: ["JsonLdEvent"],
                  code: "relative subject reference",
                  level: "warning",
                  message: "Relative subject reference found.",
                  details: {
                    subject: id
                  }
                },
                options
              });
            }
            continue;
          }
          const predicate = _makeTerm(property);
          if (!_isAbsoluteIri(property)) {
            if (options.eventHandler) {
              _handleEvent({
                event: {
                  type: ["JsonLdEvent"],
                  code: "relative predicate reference",
                  level: "warning",
                  message: "Relative predicate reference found.",
                  details: {
                    predicate: property
                  }
                },
                options
              });
            }
            continue;
          }
          if (predicate.termType === "BlankNode" && !options.produceGeneralizedRdf) {
            if (options.eventHandler) {
              _handleEvent({
                event: {
                  type: ["JsonLdEvent"],
                  code: "blank node predicate",
                  level: "warning",
                  message: "Dropping blank node predicate.",
                  details: {
                    property: issuer.getOldIds().find((key) => issuer.getId(key) === property)
                  }
                },
                options
              });
            }
            continue;
          }
          const object = _objectToRDF(item, issuer, dataset, graphTerm, options.rdfDirection, options);
          if (object) {
            dataset.push({
              subject,
              predicate,
              object,
              graph: graphTerm
            });
          }
        }
      }
    }
  }
  function _listToRDF(list, issuer, dataset, graphTerm, rdfDirection, options) {
    const first = { termType: "NamedNode", value: RDF_FIRST };
    const rest = { termType: "NamedNode", value: RDF_REST };
    const nil = { termType: "NamedNode", value: RDF_NIL };
    const last = list.pop();
    const result = last ? {
      termType: "BlankNode",
      value: issuer.getId().slice(2)
    } : nil;
    let subject = result;
    for (const item of list) {
      const object = _objectToRDF(item, issuer, dataset, graphTerm, rdfDirection, options);
      const next = { termType: "BlankNode", value: issuer.getId().slice(2) };
      dataset.push({
        subject,
        predicate: first,
        object,
        graph: graphTerm
      });
      dataset.push({
        subject,
        predicate: rest,
        object: next,
        graph: graphTerm
      });
      subject = next;
    }
    if (last) {
      const object = _objectToRDF(last, issuer, dataset, graphTerm, rdfDirection, options);
      dataset.push({
        subject,
        predicate: first,
        object,
        graph: graphTerm
      });
      dataset.push({
        subject,
        predicate: rest,
        object: nil,
        graph: graphTerm
      });
    }
    return result;
  }
  function _objectToRDF(item, issuer, dataset, graphTerm, rdfDirection, options) {
    let object;
    if (graphTypes.isValue(item)) {
      object = {
        termType: "Literal",
        value: undefined,
        datatype: {
          termType: "NamedNode"
        }
      };
      let value = item["@value"];
      const datatype = item["@type"] || null;
      if (datatype === "@json") {
        object.value = jsonCanonicalize(value);
        object.datatype.value = RDF_JSON_LITERAL;
      } else if (types.isBoolean(value)) {
        object.value = value.toString();
        object.datatype.value = datatype || XSD_BOOLEAN;
      } else if (types.isDouble(value) || datatype === XSD_DOUBLE) {
        if (!types.isDouble(value)) {
          value = parseFloat(value);
        }
        object.value = value.toExponential(15).replace(/(\d)0*e\+?/, "$1E");
        object.datatype.value = datatype || XSD_DOUBLE;
      } else if (types.isNumber(value)) {
        object.value = value.toFixed(0);
        object.datatype.value = datatype || XSD_INTEGER;
      } else if ("@direction" in item && rdfDirection === "i18n-datatype") {
        const language = (item["@language"] || "").toLowerCase();
        const direction = item["@direction"];
        const datatype2 = `https://www.w3.org/ns/i18n#${language}_${direction}`;
        object.datatype.value = datatype2;
        object.value = value;
      } else if ("@direction" in item && rdfDirection === "compound-literal") {
        throw new JsonLdError("Unsupported rdfDirection value.", "jsonld.InvalidRdfDirection", { value: rdfDirection });
      } else if ("@direction" in item && rdfDirection) {
        throw new JsonLdError("Unknown rdfDirection value.", "jsonld.InvalidRdfDirection", { value: rdfDirection });
      } else if ("@language" in item) {
        if ("@direction" in item && !rdfDirection) {
          if (options.eventHandler) {
            _handleEvent({
              event: {
                type: ["JsonLdEvent"],
                code: "rdfDirection not set",
                level: "warning",
                message: "rdfDirection not set for @direction.",
                details: {
                  object: object.value
                }
              },
              options
            });
          }
        }
        object.value = value;
        object.datatype.value = datatype || RDF_LANGSTRING;
        object.language = item["@language"];
      } else {
        if ("@direction" in item && !rdfDirection) {
          if (options.eventHandler) {
            _handleEvent({
              event: {
                type: ["JsonLdEvent"],
                code: "rdfDirection not set",
                level: "warning",
                message: "rdfDirection not set for @direction.",
                details: {
                  object: object.value
                }
              },
              options
            });
          }
        }
        object.value = value;
        object.datatype.value = datatype || XSD_STRING;
      }
    } else if (graphTypes.isList(item)) {
      const _list = _listToRDF(item["@list"], issuer, dataset, graphTerm, rdfDirection, options);
      object = {
        termType: _list.termType,
        value: _list.value
      };
    } else {
      const id = types.isObject(item) ? item["@id"] : item;
      object = _makeTerm(id);
    }
    if (object.termType === "NamedNode" && !_isAbsoluteIri(object.value)) {
      if (options.eventHandler) {
        _handleEvent({
          event: {
            type: ["JsonLdEvent"],
            code: "relative object reference",
            level: "warning",
            message: "Relative object reference found.",
            details: {
              object: object.value
            }
          },
          options
        });
      }
      return null;
    }
    return object;
  }
  function _makeTerm(id) {
    if (id.startsWith("_:")) {
      return {
        termType: "BlankNode",
        value: id.slice(2)
      };
    }
    return {
      termType: "NamedNode",
      value: id
    };
  }
});

// node_modules/jsonld/lib/frame.js
var require_frame = __commonJS((exports, module) => {
  var { isKeyword } = require_context();
  var graphTypes = require_graphTypes();
  var types = require_types();
  var util = require_util();
  var url = require_url();
  var JsonLdError = require_JsonLdError();
  var {
    createNodeMap: _createNodeMap,
    mergeNodeMapGraphs: _mergeNodeMapGraphs
  } = require_nodeMap();
  var api = {};
  module.exports = api;
  api.frameMergedOrDefault = (input, frame, options) => {
    const state = {
      options,
      embedded: false,
      graph: "@default",
      graphMap: { "@default": {} },
      subjectStack: [],
      link: {},
      bnodeMap: {}
    };
    const issuer = new util.IdentifierIssuer("_:b");
    _createNodeMap(input, state.graphMap, "@default", issuer);
    if (options.merged) {
      state.graphMap["@merged"] = _mergeNodeMapGraphs(state.graphMap);
      state.graph = "@merged";
    }
    state.subjects = state.graphMap[state.graph];
    const framed = [];
    api.frame(state, Object.keys(state.subjects).sort(), frame, framed);
    if (options.pruneBlankNodeIdentifiers) {
      options.bnodesToClear = Object.keys(state.bnodeMap).filter((id) => state.bnodeMap[id].length === 1);
    }
    options.link = {};
    return _cleanupPreserve(framed, options);
  };
  api.frame = (state, subjects, frame, parent, property = null) => {
    _validateFrame(frame);
    frame = frame[0];
    const options = state.options;
    const flags = {
      embed: _getFrameFlag(frame, options, "embed"),
      explicit: _getFrameFlag(frame, options, "explicit"),
      requireAll: _getFrameFlag(frame, options, "requireAll")
    };
    if (!state.link.hasOwnProperty(state.graph)) {
      state.link[state.graph] = {};
    }
    const link = state.link[state.graph];
    const matches = _filterSubjects(state, subjects, frame, flags);
    const ids = Object.keys(matches).sort();
    for (const id of ids) {
      const subject = matches[id];
      if (property === null) {
        state.uniqueEmbeds = { [state.graph]: {} };
      } else {
        state.uniqueEmbeds[state.graph] = state.uniqueEmbeds[state.graph] || {};
      }
      if (flags.embed === "@link" && id in link) {
        _addFrameOutput(parent, property, link[id]);
        continue;
      }
      const output = { "@id": id };
      if (id.indexOf("_:") === 0) {
        util.addValue(state.bnodeMap, id, output, { propertyIsArray: true });
      }
      link[id] = output;
      if ((flags.embed === "@first" || flags.embed === "@last") && state.is11) {
        throw new JsonLdError("Invalid JSON-LD syntax; invalid value of @embed.", "jsonld.SyntaxError", { code: "invalid @embed value", frame });
      }
      if (!state.embedded && state.uniqueEmbeds[state.graph].hasOwnProperty(id)) {
        continue;
      }
      if (state.embedded && (flags.embed === "@never" || _createsCircularReference(subject, state.graph, state.subjectStack))) {
        _addFrameOutput(parent, property, output);
        continue;
      }
      if (state.embedded && (flags.embed == "@first" || flags.embed == "@once") && state.uniqueEmbeds[state.graph].hasOwnProperty(id)) {
        _addFrameOutput(parent, property, output);
        continue;
      }
      if (flags.embed === "@last") {
        if (id in state.uniqueEmbeds[state.graph]) {
          _removeEmbed(state, id);
        }
      }
      state.uniqueEmbeds[state.graph][id] = { parent, property };
      state.subjectStack.push({ subject, graph: state.graph });
      if (id in state.graphMap) {
        let recurse = false;
        let subframe = null;
        if (!("@graph" in frame)) {
          recurse = state.graph !== "@merged";
          subframe = {};
        } else {
          subframe = frame["@graph"][0];
          recurse = !(id === "@merged" || id === "@default");
          if (!types.isObject(subframe)) {
            subframe = {};
          }
        }
        if (recurse) {
          api.frame({ ...state, graph: id, embedded: false }, Object.keys(state.graphMap[id]).sort(), [subframe], output, "@graph");
        }
      }
      if ("@included" in frame) {
        api.frame({ ...state, embedded: false }, subjects, frame["@included"], output, "@included");
      }
      for (const prop of Object.keys(subject).sort()) {
        if (isKeyword(prop)) {
          output[prop] = util.clone(subject[prop]);
          if (prop === "@type") {
            for (const type of subject["@type"]) {
              if (type.indexOf("_:") === 0) {
                util.addValue(state.bnodeMap, type, output, { propertyIsArray: true });
              }
            }
          }
          continue;
        }
        if (flags.explicit && !(prop in frame)) {
          continue;
        }
        for (const o of subject[prop]) {
          const subframe = prop in frame ? frame[prop] : _createImplicitFrame(flags);
          if (graphTypes.isList(o)) {
            const subframe2 = frame[prop] && frame[prop][0] && frame[prop][0]["@list"] ? frame[prop][0]["@list"] : _createImplicitFrame(flags);
            const list = { "@list": [] };
            _addFrameOutput(output, prop, list);
            const src = o["@list"];
            for (const oo of src) {
              if (graphTypes.isSubjectReference(oo)) {
                api.frame({ ...state, embedded: true }, [oo["@id"]], subframe2, list, "@list");
              } else {
                _addFrameOutput(list, "@list", util.clone(oo));
              }
            }
          } else if (graphTypes.isSubjectReference(o)) {
            api.frame({ ...state, embedded: true }, [o["@id"]], subframe, output, prop);
          } else if (_valueMatch(subframe[0], o)) {
            _addFrameOutput(output, prop, util.clone(o));
          }
        }
      }
      for (const prop of Object.keys(frame).sort()) {
        if (prop === "@type") {
          if (!types.isObject(frame[prop][0]) || !("@default" in frame[prop][0])) {
            continue;
          }
        } else if (isKeyword(prop)) {
          continue;
        }
        const next = frame[prop][0] || {};
        const omitDefaultOn = _getFrameFlag(next, options, "omitDefault");
        if (!omitDefaultOn && !(prop in output)) {
          let preserve = "@null";
          if ("@default" in next) {
            preserve = util.clone(next["@default"]);
          }
          if (!types.isArray(preserve)) {
            preserve = [preserve];
          }
          output[prop] = [{ "@preserve": preserve }];
        }
      }
      for (const reverseProp of Object.keys(frame["@reverse"] || {}).sort()) {
        const subframe = frame["@reverse"][reverseProp];
        for (const subject2 of Object.keys(state.subjects)) {
          const nodeValues = util.getValues(state.subjects[subject2], reverseProp);
          if (nodeValues.some((v) => v["@id"] === id)) {
            output["@reverse"] = output["@reverse"] || {};
            util.addValue(output["@reverse"], reverseProp, [], { propertyIsArray: true });
            api.frame({ ...state, embedded: true }, [subject2], subframe, output["@reverse"][reverseProp], property);
          }
        }
      }
      _addFrameOutput(parent, property, output);
      state.subjectStack.pop();
    }
  };
  api.cleanupNull = (input, options) => {
    if (types.isArray(input)) {
      const noNulls = input.map((v) => api.cleanupNull(v, options));
      return noNulls.filter((v) => v);
    }
    if (input === "@null") {
      return null;
    }
    if (types.isObject(input)) {
      if ("@id" in input) {
        const id = input["@id"];
        if (options.link.hasOwnProperty(id)) {
          const idx = options.link[id].indexOf(input);
          if (idx !== -1) {
            return options.link[id][idx];
          }
          options.link[id].push(input);
        } else {
          options.link[id] = [input];
        }
      }
      for (const key in input) {
        input[key] = api.cleanupNull(input[key], options);
      }
    }
    return input;
  };
  function _createImplicitFrame(flags) {
    const frame = {};
    for (const key in flags) {
      if (flags[key] !== undefined) {
        frame["@" + key] = [flags[key]];
      }
    }
    return [frame];
  }
  function _createsCircularReference(subjectToEmbed, graph, subjectStack) {
    for (let i2 = subjectStack.length - 1;i2 >= 0; --i2) {
      const subject = subjectStack[i2];
      if (subject.graph === graph && subject.subject["@id"] === subjectToEmbed["@id"]) {
        return true;
      }
    }
    return false;
  }
  function _getFrameFlag(frame, options, name) {
    const flag = "@" + name;
    let rval = flag in frame ? frame[flag][0] : options[name];
    if (name === "embed") {
      if (rval === true) {
        rval = "@once";
      } else if (rval === false) {
        rval = "@never";
      } else if (rval !== "@always" && rval !== "@never" && rval !== "@link" && rval !== "@first" && rval !== "@last" && rval !== "@once") {
        throw new JsonLdError("Invalid JSON-LD syntax; invalid value of @embed.", "jsonld.SyntaxError", { code: "invalid @embed value", frame });
      }
    }
    return rval;
  }
  function _validateFrame(frame) {
    if (!types.isArray(frame) || frame.length !== 1 || !types.isObject(frame[0])) {
      throw new JsonLdError("Invalid JSON-LD syntax; a JSON-LD frame must be a single object.", "jsonld.SyntaxError", { frame });
    }
    if ("@id" in frame[0]) {
      for (const id of util.asArray(frame[0]["@id"])) {
        if (!(types.isObject(id) || url.isAbsolute(id)) || types.isString(id) && id.indexOf("_:") === 0) {
          throw new JsonLdError("Invalid JSON-LD syntax; invalid @id in frame.", "jsonld.SyntaxError", { code: "invalid frame", frame });
        }
      }
    }
    if ("@type" in frame[0]) {
      for (const type of util.asArray(frame[0]["@type"])) {
        if (!(types.isObject(type) || url.isAbsolute(type) || type === "@json") || types.isString(type) && type.indexOf("_:") === 0) {
          throw new JsonLdError("Invalid JSON-LD syntax; invalid @type in frame.", "jsonld.SyntaxError", { code: "invalid frame", frame });
        }
      }
    }
  }
  function _filterSubjects(state, subjects, frame, flags) {
    const rval = {};
    for (const id of subjects) {
      const subject = state.graphMap[state.graph][id];
      if (_filterSubject(state, subject, frame, flags)) {
        rval[id] = subject;
      }
    }
    return rval;
  }
  function _filterSubject(state, subject, frame, flags) {
    let wildcard = true;
    let matchesSome = false;
    for (const key in frame) {
      let matchThis = false;
      const nodeValues = util.getValues(subject, key);
      const isEmpty = util.getValues(frame, key).length === 0;
      if (key === "@id") {
        if (types.isEmptyObject(frame["@id"][0] || {})) {
          matchThis = true;
        } else if (frame["@id"].length >= 0) {
          matchThis = frame["@id"].includes(nodeValues[0]);
        }
        if (!flags.requireAll) {
          return matchThis;
        }
      } else if (key === "@type") {
        wildcard = false;
        if (isEmpty) {
          if (nodeValues.length > 0) {
            return false;
          }
          matchThis = true;
        } else if (frame["@type"].length === 1 && types.isEmptyObject(frame["@type"][0])) {
          matchThis = nodeValues.length > 0;
        } else {
          for (const type of frame["@type"]) {
            if (types.isObject(type) && "@default" in type) {
              matchThis = true;
            } else {
              matchThis = matchThis || nodeValues.some((tt) => tt === type);
            }
          }
        }
        if (!flags.requireAll) {
          return matchThis;
        }
      } else if (isKeyword(key)) {
        continue;
      } else {
        const thisFrame = util.getValues(frame, key)[0];
        let hasDefault = false;
        if (thisFrame) {
          _validateFrame([thisFrame]);
          hasDefault = "@default" in thisFrame;
        }
        wildcard = false;
        if (nodeValues.length === 0 && hasDefault) {
          continue;
        }
        if (nodeValues.length > 0 && isEmpty) {
          return false;
        }
        if (thisFrame === undefined) {
          if (nodeValues.length > 0) {
            return false;
          }
          matchThis = true;
        } else {
          if (graphTypes.isList(thisFrame)) {
            const listValue = thisFrame["@list"][0];
            if (graphTypes.isList(nodeValues[0])) {
              const nodeListValues = nodeValues[0]["@list"];
              if (graphTypes.isValue(listValue)) {
                matchThis = nodeListValues.some((lv) => _valueMatch(listValue, lv));
              } else if (graphTypes.isSubject(listValue) || graphTypes.isSubjectReference(listValue)) {
                matchThis = nodeListValues.some((lv) => _nodeMatch(state, listValue, lv, flags));
              }
            }
          } else if (graphTypes.isValue(thisFrame)) {
            matchThis = nodeValues.some((nv) => _valueMatch(thisFrame, nv));
          } else if (graphTypes.isSubjectReference(thisFrame)) {
            matchThis = nodeValues.some((nv) => _nodeMatch(state, thisFrame, nv, flags));
          } else if (types.isObject(thisFrame)) {
            matchThis = nodeValues.length > 0;
          } else {
            matchThis = false;
          }
        }
      }
      if (!matchThis && flags.requireAll) {
        return false;
      }
      matchesSome = matchesSome || matchThis;
    }
    return wildcard || matchesSome;
  }
  function _removeEmbed(state, id) {
    const embeds = state.uniqueEmbeds[state.graph];
    const embed = embeds[id];
    const parent = embed.parent;
    const property = embed.property;
    const subject = { "@id": id };
    if (types.isArray(parent)) {
      for (let i2 = 0;i2 < parent.length; ++i2) {
        if (util.compareValues(parent[i2], subject)) {
          parent[i2] = subject;
          break;
        }
      }
    } else {
      const useArray = types.isArray(parent[property]);
      util.removeValue(parent, property, subject, { propertyIsArray: useArray });
      util.addValue(parent, property, subject, { propertyIsArray: useArray });
    }
    const removeDependents = (id2) => {
      const ids = Object.keys(embeds);
      for (const next of ids) {
        if (next in embeds && types.isObject(embeds[next].parent) && embeds[next].parent["@id"] === id2) {
          delete embeds[next];
          removeDependents(next);
        }
      }
    };
    removeDependents(id);
  }
  function _cleanupPreserve(input, options) {
    if (types.isArray(input)) {
      return input.map((value) => _cleanupPreserve(value, options));
    }
    if (types.isObject(input)) {
      if ("@preserve" in input) {
        return input["@preserve"][0];
      }
      if (graphTypes.isValue(input)) {
        return input;
      }
      if (graphTypes.isList(input)) {
        input["@list"] = _cleanupPreserve(input["@list"], options);
        return input;
      }
      if ("@id" in input) {
        const id = input["@id"];
        if (options.link.hasOwnProperty(id)) {
          const idx = options.link[id].indexOf(input);
          if (idx !== -1) {
            return options.link[id][idx];
          }
          options.link[id].push(input);
        } else {
          options.link[id] = [input];
        }
      }
      for (const prop in input) {
        if (prop === "@id" && options.bnodesToClear.includes(input[prop])) {
          delete input["@id"];
          continue;
        }
        input[prop] = _cleanupPreserve(input[prop], options);
      }
    }
    return input;
  }
  function _addFrameOutput(parent, property, output) {
    if (types.isObject(parent)) {
      util.addValue(parent, property, output, { propertyIsArray: true });
    } else {
      parent.push(output);
    }
  }
  function _nodeMatch(state, pattern, value, flags) {
    if (!("@id" in value)) {
      return false;
    }
    const nodeObject = state.subjects[value["@id"]];
    return nodeObject && _filterSubject(state, nodeObject, pattern, flags);
  }
  function _valueMatch(pattern, value) {
    const v1 = value["@value"];
    const t1 = value["@type"];
    const l1 = value["@language"];
    const v2 = pattern["@value"] ? types.isArray(pattern["@value"]) ? pattern["@value"] : [pattern["@value"]] : [];
    const t2 = pattern["@type"] ? types.isArray(pattern["@type"]) ? pattern["@type"] : [pattern["@type"]] : [];
    const l2 = pattern["@language"] ? types.isArray(pattern["@language"]) ? pattern["@language"] : [pattern["@language"]] : [];
    if (v2.length === 0 && t2.length === 0 && l2.length === 0) {
      return true;
    }
    if (!(v2.includes(v1) || types.isEmptyObject(v2[0]))) {
      return false;
    }
    if (!(!t1 && t2.length === 0 || t2.includes(t1) || t1 && types.isEmptyObject(t2[0]))) {
      return false;
    }
    if (!(!l1 && l2.length === 0 || l2.includes(l1) || l1 && types.isEmptyObject(l2[0]))) {
      return false;
    }
    return true;
  }
});

// node_modules/jsonld/lib/compact.js
var require_compact = __commonJS((exports, module) => {
  var JsonLdError = require_JsonLdError();
  var {
    isArray: _isArray,
    isObject: _isObject,
    isString: _isString,
    isUndefined: _isUndefined
  } = require_types();
  var {
    isList: _isList,
    isValue: _isValue,
    isGraph: _isGraph,
    isSimpleGraph: _isSimpleGraph,
    isSubjectReference: _isSubjectReference
  } = require_graphTypes();
  var {
    expandIri: _expandIri,
    getContextValue: _getContextValue,
    isKeyword: _isKeyword,
    process: _processContext,
    processingMode: _processingMode
  } = require_context();
  var {
    removeBase: _removeBase,
    prependBase: _prependBase
  } = require_url();
  var {
    REGEX_KEYWORD,
    addValue: _addValue,
    asArray: _asArray,
    compareShortestLeast: _compareShortestLeast
  } = require_util();
  var api = {};
  module.exports = api;
  api.compact = async ({
    activeCtx,
    activeProperty = null,
    element,
    options = {}
  }) => {
    if (_isArray(element)) {
      let rval = [];
      for (let i2 = 0;i2 < element.length; ++i2) {
        const compacted = await api.compact({
          activeCtx,
          activeProperty,
          element: element[i2],
          options
        });
        if (compacted === null) {
          continue;
        }
        rval.push(compacted);
      }
      if (options.compactArrays && rval.length === 1) {
        const container = _getContextValue(activeCtx, activeProperty, "@container") || [];
        if (container.length === 0) {
          rval = rval[0];
        }
      }
      return rval;
    }
    const ctx = _getContextValue(activeCtx, activeProperty, "@context");
    if (!_isUndefined(ctx)) {
      activeCtx = await _processContext({
        activeCtx,
        localCtx: ctx,
        propagate: true,
        overrideProtected: true,
        options
      });
    }
    if (_isObject(element)) {
      if (options.link && "@id" in element && options.link.hasOwnProperty(element["@id"])) {
        const linked = options.link[element["@id"]];
        for (let i2 = 0;i2 < linked.length; ++i2) {
          if (linked[i2].expanded === element) {
            return linked[i2].compacted;
          }
        }
      }
      if (_isValue(element) || _isSubjectReference(element)) {
        const rval2 = api.compactValue({ activeCtx, activeProperty, value: element, options });
        if (options.link && _isSubjectReference(element)) {
          if (!options.link.hasOwnProperty(element["@id"])) {
            options.link[element["@id"]] = [];
          }
          options.link[element["@id"]].push({ expanded: element, compacted: rval2 });
        }
        return rval2;
      }
      if (_isList(element)) {
        const container = _getContextValue(activeCtx, activeProperty, "@container") || [];
        if (container.includes("@list")) {
          return api.compact({
            activeCtx,
            activeProperty,
            element: element["@list"],
            options
          });
        }
      }
      const insideReverse = activeProperty === "@reverse";
      const rval = {};
      const inputCtx = activeCtx;
      if (!_isValue(element) && !_isSubjectReference(element)) {
        activeCtx = activeCtx.revertToPreviousContext();
      }
      const propertyScopedCtx = _getContextValue(inputCtx, activeProperty, "@context");
      if (!_isUndefined(propertyScopedCtx)) {
        activeCtx = await _processContext({
          activeCtx,
          localCtx: propertyScopedCtx,
          propagate: true,
          overrideProtected: true,
          options
        });
      }
      if (options.link && "@id" in element) {
        if (!options.link.hasOwnProperty(element["@id"])) {
          options.link[element["@id"]] = [];
        }
        options.link[element["@id"]].push({ expanded: element, compacted: rval });
      }
      let types = element["@type"] || [];
      if (types.length > 1) {
        types = Array.from(types).sort();
      }
      const typeContext = activeCtx;
      for (const type of types) {
        const compactedType = api.compactIri({ activeCtx: typeContext, iri: type, relativeTo: { vocab: true } });
        const ctx2 = _getContextValue(inputCtx, compactedType, "@context");
        if (!_isUndefined(ctx2)) {
          activeCtx = await _processContext({
            activeCtx,
            localCtx: ctx2,
            options,
            propagate: false
          });
        }
      }
      const keys = Object.keys(element).sort();
      for (const expandedProperty of keys) {
        const expandedValue = element[expandedProperty];
        if (expandedProperty === "@id") {
          let compactedValue = _asArray(expandedValue).map((expandedIri) => api.compactIri({
            activeCtx,
            iri: expandedIri,
            relativeTo: { vocab: false },
            base: options.base
          }));
          if (compactedValue.length === 1) {
            compactedValue = compactedValue[0];
          }
          const alias = api.compactIri({ activeCtx, iri: "@id", relativeTo: { vocab: true } });
          rval[alias] = compactedValue;
          continue;
        }
        if (expandedProperty === "@type") {
          let compactedValue = _asArray(expandedValue).map((expandedIri) => api.compactIri({
            activeCtx: inputCtx,
            iri: expandedIri,
            relativeTo: { vocab: true }
          }));
          if (compactedValue.length === 1) {
            compactedValue = compactedValue[0];
          }
          const alias = api.compactIri({ activeCtx, iri: "@type", relativeTo: { vocab: true } });
          const container = _getContextValue(activeCtx, alias, "@container") || [];
          const typeAsSet = container.includes("@set") && _processingMode(activeCtx, 1.1);
          const isArray = typeAsSet || _isArray(compactedValue) && expandedValue.length === 0;
          _addValue(rval, alias, compactedValue, { propertyIsArray: isArray });
          continue;
        }
        if (expandedProperty === "@reverse") {
          const compactedValue = await api.compact({
            activeCtx,
            activeProperty: "@reverse",
            element: expandedValue,
            options
          });
          for (const compactedProperty in compactedValue) {
            if (activeCtx.mappings.has(compactedProperty) && activeCtx.mappings.get(compactedProperty).reverse) {
              const value = compactedValue[compactedProperty];
              const container = _getContextValue(activeCtx, compactedProperty, "@container") || [];
              const useArray = container.includes("@set") || !options.compactArrays;
              _addValue(rval, compactedProperty, value, { propertyIsArray: useArray });
              delete compactedValue[compactedProperty];
            }
          }
          if (Object.keys(compactedValue).length > 0) {
            const alias = api.compactIri({
              activeCtx,
              iri: expandedProperty,
              relativeTo: { vocab: true }
            });
            _addValue(rval, alias, compactedValue);
          }
          continue;
        }
        if (expandedProperty === "@preserve") {
          const compactedValue = await api.compact({
            activeCtx,
            activeProperty,
            element: expandedValue,
            options
          });
          if (!(_isArray(compactedValue) && compactedValue.length === 0)) {
            _addValue(rval, expandedProperty, compactedValue);
          }
          continue;
        }
        if (expandedProperty === "@index") {
          const container = _getContextValue(activeCtx, activeProperty, "@container") || [];
          if (container.includes("@index")) {
            continue;
          }
          const alias = api.compactIri({
            activeCtx,
            iri: expandedProperty,
            relativeTo: { vocab: true }
          });
          _addValue(rval, alias, expandedValue);
          continue;
        }
        if (expandedProperty !== "@graph" && expandedProperty !== "@list" && expandedProperty !== "@included" && _isKeyword(expandedProperty)) {
          const alias = api.compactIri({
            activeCtx,
            iri: expandedProperty,
            relativeTo: { vocab: true }
          });
          _addValue(rval, alias, expandedValue);
          continue;
        }
        if (!_isArray(expandedValue)) {
          throw new JsonLdError("JSON-LD expansion error; expanded value must be an array.", "jsonld.SyntaxError");
        }
        if (expandedValue.length === 0) {
          const itemActiveProperty = api.compactIri({
            activeCtx,
            iri: expandedProperty,
            value: expandedValue,
            relativeTo: { vocab: true },
            reverse: insideReverse
          });
          const nestProperty = activeCtx.mappings.has(itemActiveProperty) ? activeCtx.mappings.get(itemActiveProperty)["@nest"] : null;
          let nestResult = rval;
          if (nestProperty) {
            _checkNestProperty(activeCtx, nestProperty, options);
            if (!_isObject(rval[nestProperty])) {
              rval[nestProperty] = {};
            }
            nestResult = rval[nestProperty];
          }
          _addValue(nestResult, itemActiveProperty, expandedValue, {
            propertyIsArray: true
          });
        }
        for (const expandedItem of expandedValue) {
          const itemActiveProperty = api.compactIri({
            activeCtx,
            iri: expandedProperty,
            value: expandedItem,
            relativeTo: { vocab: true },
            reverse: insideReverse
          });
          const nestProperty = activeCtx.mappings.has(itemActiveProperty) ? activeCtx.mappings.get(itemActiveProperty)["@nest"] : null;
          let nestResult = rval;
          if (nestProperty) {
            _checkNestProperty(activeCtx, nestProperty, options);
            if (!_isObject(rval[nestProperty])) {
              rval[nestProperty] = {};
            }
            nestResult = rval[nestProperty];
          }
          const container = _getContextValue(activeCtx, itemActiveProperty, "@container") || [];
          const isGraph = _isGraph(expandedItem);
          const isList = _isList(expandedItem);
          let inner;
          if (isList) {
            inner = expandedItem["@list"];
          } else if (isGraph) {
            inner = expandedItem["@graph"];
          }
          let compactedItem = await api.compact({
            activeCtx,
            activeProperty: itemActiveProperty,
            element: isList || isGraph ? inner : expandedItem,
            options
          });
          if (isList) {
            if (!_isArray(compactedItem)) {
              compactedItem = [compactedItem];
            }
            if (!container.includes("@list")) {
              compactedItem = {
                [api.compactIri({
                  activeCtx,
                  iri: "@list",
                  relativeTo: { vocab: true }
                })]: compactedItem
              };
              if ("@index" in expandedItem) {
                compactedItem[api.compactIri({
                  activeCtx,
                  iri: "@index",
                  relativeTo: { vocab: true }
                })] = expandedItem["@index"];
              }
            } else {
              _addValue(nestResult, itemActiveProperty, compactedItem, {
                valueIsArray: true,
                allowDuplicate: true
              });
              continue;
            }
          }
          if (isGraph) {
            if (container.includes("@graph") && (container.includes("@id") || container.includes("@index") && _isSimpleGraph(expandedItem))) {
              let mapObject;
              if (nestResult.hasOwnProperty(itemActiveProperty)) {
                mapObject = nestResult[itemActiveProperty];
              } else {
                nestResult[itemActiveProperty] = mapObject = {};
              }
              const key = (container.includes("@id") ? expandedItem["@id"] : expandedItem["@index"]) || api.compactIri({
                activeCtx,
                iri: "@none",
                relativeTo: { vocab: true }
              });
              _addValue(mapObject, key, compactedItem, {
                propertyIsArray: !options.compactArrays || container.includes("@set")
              });
            } else if (container.includes("@graph") && _isSimpleGraph(expandedItem)) {
              if (_isArray(compactedItem) && compactedItem.length > 1) {
                compactedItem = { "@included": compactedItem };
              }
              _addValue(nestResult, itemActiveProperty, compactedItem, {
                propertyIsArray: !options.compactArrays || container.includes("@set")
              });
            } else {
              if (_isArray(compactedItem) && compactedItem.length === 1 && options.compactArrays) {
                compactedItem = compactedItem[0];
              }
              compactedItem = {
                [api.compactIri({
                  activeCtx,
                  iri: "@graph",
                  relativeTo: { vocab: true }
                })]: compactedItem
              };
              if ("@id" in expandedItem) {
                compactedItem[api.compactIri({
                  activeCtx,
                  iri: "@id",
                  relativeTo: { vocab: true }
                })] = expandedItem["@id"];
              }
              if ("@index" in expandedItem) {
                compactedItem[api.compactIri({
                  activeCtx,
                  iri: "@index",
                  relativeTo: { vocab: true }
                })] = expandedItem["@index"];
              }
              _addValue(nestResult, itemActiveProperty, compactedItem, {
                propertyIsArray: !options.compactArrays || container.includes("@set")
              });
            }
          } else if (container.includes("@language") || container.includes("@index") || container.includes("@id") || container.includes("@type")) {
            let mapObject;
            if (nestResult.hasOwnProperty(itemActiveProperty)) {
              mapObject = nestResult[itemActiveProperty];
            } else {
              nestResult[itemActiveProperty] = mapObject = {};
            }
            let key;
            if (container.includes("@language")) {
              if (_isValue(compactedItem)) {
                compactedItem = compactedItem["@value"];
              }
              key = expandedItem["@language"];
            } else if (container.includes("@index")) {
              const indexKey = _getContextValue(activeCtx, itemActiveProperty, "@index") || "@index";
              const containerKey = api.compactIri({ activeCtx, iri: indexKey, relativeTo: { vocab: true } });
              if (indexKey === "@index") {
                key = expandedItem["@index"];
                delete compactedItem[containerKey];
              } else {
                let others;
                [key, ...others] = _asArray(compactedItem[indexKey] || []);
                if (!_isString(key)) {
                  key = null;
                } else {
                  switch (others.length) {
                    case 0:
                      delete compactedItem[indexKey];
                      break;
                    case 1:
                      compactedItem[indexKey] = others[0];
                      break;
                    default:
                      compactedItem[indexKey] = others;
                      break;
                  }
                }
              }
            } else if (container.includes("@id")) {
              const idKey = api.compactIri({
                activeCtx,
                iri: "@id",
                relativeTo: { vocab: true }
              });
              key = compactedItem[idKey];
              delete compactedItem[idKey];
            } else if (container.includes("@type")) {
              const typeKey = api.compactIri({
                activeCtx,
                iri: "@type",
                relativeTo: { vocab: true }
              });
              let types2;
              [key, ...types2] = _asArray(compactedItem[typeKey] || []);
              switch (types2.length) {
                case 0:
                  delete compactedItem[typeKey];
                  break;
                case 1:
                  compactedItem[typeKey] = types2[0];
                  break;
                default:
                  compactedItem[typeKey] = types2;
                  break;
              }
              if (Object.keys(compactedItem).length === 1 && "@id" in expandedItem) {
                compactedItem = await api.compact({
                  activeCtx,
                  activeProperty: itemActiveProperty,
                  element: { "@id": expandedItem["@id"] },
                  options
                });
              }
            }
            if (!key) {
              key = api.compactIri({
                activeCtx,
                iri: "@none",
                relativeTo: { vocab: true }
              });
            }
            _addValue(mapObject, key, compactedItem, {
              propertyIsArray: container.includes("@set")
            });
          } else {
            const isArray = !options.compactArrays || container.includes("@set") || container.includes("@list") || _isArray(compactedItem) && compactedItem.length === 0 || expandedProperty === "@list" || expandedProperty === "@graph";
            _addValue(nestResult, itemActiveProperty, compactedItem, { propertyIsArray: isArray });
          }
        }
      }
      return rval;
    }
    return element;
  };
  api.compactIri = ({
    activeCtx,
    iri,
    value = null,
    relativeTo = { vocab: false },
    reverse = false,
    base = null
  }) => {
    if (iri === null) {
      return iri;
    }
    if (activeCtx.isPropertyTermScoped && activeCtx.previousContext) {
      activeCtx = activeCtx.previousContext;
    }
    const inverseCtx = activeCtx.getInverse();
    if (_isKeyword(iri) && iri in inverseCtx && "@none" in inverseCtx[iri] && "@type" in inverseCtx[iri]["@none"] && "@none" in inverseCtx[iri]["@none"]["@type"]) {
      return inverseCtx[iri]["@none"]["@type"]["@none"];
    }
    if (relativeTo.vocab && iri in inverseCtx) {
      const defaultLanguage = activeCtx["@language"] || "@none";
      const containers = [];
      if (_isObject(value) && "@index" in value && !("@graph" in value)) {
        containers.push("@index", "@index@set");
      }
      if (_isObject(value) && "@preserve" in value) {
        value = value["@preserve"][0];
      }
      if (_isGraph(value)) {
        if ("@index" in value) {
          containers.push("@graph@index", "@graph@index@set", "@index", "@index@set");
        }
        if ("@id" in value) {
          containers.push("@graph@id", "@graph@id@set");
        }
        containers.push("@graph", "@graph@set", "@set");
        if (!("@index" in value)) {
          containers.push("@graph@index", "@graph@index@set", "@index", "@index@set");
        }
        if (!("@id" in value)) {
          containers.push("@graph@id", "@graph@id@set");
        }
      } else if (_isObject(value) && !_isValue(value)) {
        containers.push("@id", "@id@set", "@type", "@set@type");
      }
      let typeOrLanguage = "@language";
      let typeOrLanguageValue = "@null";
      if (reverse) {
        typeOrLanguage = "@type";
        typeOrLanguageValue = "@reverse";
        containers.push("@set");
      } else if (_isList(value)) {
        if (!("@index" in value)) {
          containers.push("@list");
        }
        const list = value["@list"];
        if (list.length === 0) {
          typeOrLanguage = "@any";
          typeOrLanguageValue = "@none";
        } else {
          let commonLanguage = list.length === 0 ? defaultLanguage : null;
          let commonType = null;
          for (let i2 = 0;i2 < list.length; ++i2) {
            const item = list[i2];
            let itemLanguage = "@none";
            let itemType = "@none";
            if (_isValue(item)) {
              if ("@direction" in item) {
                const lang = (item["@language"] || "").toLowerCase();
                const dir = item["@direction"];
                itemLanguage = `${lang}_${dir}`;
              } else if ("@language" in item) {
                itemLanguage = item["@language"].toLowerCase();
              } else if ("@type" in item) {
                itemType = item["@type"];
              } else {
                itemLanguage = "@null";
              }
            } else {
              itemType = "@id";
            }
            if (commonLanguage === null) {
              commonLanguage = itemLanguage;
            } else if (itemLanguage !== commonLanguage && _isValue(item)) {
              commonLanguage = "@none";
            }
            if (commonType === null) {
              commonType = itemType;
            } else if (itemType !== commonType) {
              commonType = "@none";
            }
            if (commonLanguage === "@none" && commonType === "@none") {
              break;
            }
          }
          commonLanguage = commonLanguage || "@none";
          commonType = commonType || "@none";
          if (commonType !== "@none") {
            typeOrLanguage = "@type";
            typeOrLanguageValue = commonType;
          } else {
            typeOrLanguageValue = commonLanguage;
          }
        }
      } else {
        if (_isValue(value)) {
          if ("@language" in value && !("@index" in value)) {
            containers.push("@language", "@language@set");
            typeOrLanguageValue = value["@language"];
            const dir = value["@direction"];
            if (dir) {
              typeOrLanguageValue = `${typeOrLanguageValue}_${dir}`;
            }
          } else if ("@direction" in value && !("@index" in value)) {
            typeOrLanguageValue = `_${value["@direction"]}`;
          } else if ("@type" in value) {
            typeOrLanguage = "@type";
            typeOrLanguageValue = value["@type"];
          }
        } else {
          typeOrLanguage = "@type";
          typeOrLanguageValue = "@id";
        }
        containers.push("@set");
      }
      containers.push("@none");
      if (_isObject(value) && !("@index" in value)) {
        containers.push("@index", "@index@set");
      }
      if (_isValue(value) && Object.keys(value).length === 1) {
        containers.push("@language", "@language@set");
      }
      const term = _selectTerm(activeCtx, iri, value, containers, typeOrLanguage, typeOrLanguageValue);
      if (term !== null) {
        return term;
      }
    }
    if (relativeTo.vocab) {
      if ("@vocab" in activeCtx) {
        const vocab = activeCtx["@vocab"];
        if (iri.indexOf(vocab) === 0 && iri !== vocab) {
          const suffix = iri.substr(vocab.length);
          if (!activeCtx.mappings.has(suffix)) {
            return suffix;
          }
        }
      }
    }
    let choice = null;
    const partialMatches = [];
    let iriMap = activeCtx.fastCurieMap;
    const maxPartialLength = iri.length - 1;
    for (let i2 = 0;i2 < maxPartialLength && iri[i2] in iriMap; ++i2) {
      iriMap = iriMap[iri[i2]];
      if ("" in iriMap) {
        partialMatches.push(iriMap[""][0]);
      }
    }
    for (let i2 = partialMatches.length - 1;i2 >= 0; --i2) {
      const entry = partialMatches[i2];
      const terms = entry.terms;
      for (const term of terms) {
        const curie = term + ":" + iri.substr(entry.iri.length);
        const isUsableCurie = activeCtx.mappings.get(term)._prefix && (!activeCtx.mappings.has(curie) || value === null && activeCtx.mappings.get(curie)["@id"] === iri);
        if (isUsableCurie && (choice === null || _compareShortestLeast(curie, choice) < 0)) {
          choice = curie;
        }
      }
    }
    if (choice !== null) {
      return choice;
    }
    for (const [term, td] of activeCtx.mappings) {
      if (td && td._prefix && iri.startsWith(term + ":")) {
        throw new JsonLdError(`Absolute IRI "${iri}" confused with prefix "${term}".`, "jsonld.SyntaxError", { code: "IRI confused with prefix", context: activeCtx });
      }
    }
    if (!relativeTo.vocab) {
      if ("@base" in activeCtx) {
        if (!activeCtx["@base"]) {
          return iri;
        } else {
          const _iri = _removeBase(_prependBase(base, activeCtx["@base"]), iri);
          return REGEX_KEYWORD.test(_iri) ? `./${_iri}` : _iri;
        }
      } else {
        return _removeBase(base, iri);
      }
    }
    return iri;
  };
  api.compactValue = ({ activeCtx, activeProperty, value, options }) => {
    if (_isValue(value)) {
      const type2 = _getContextValue(activeCtx, activeProperty, "@type");
      const language = _getContextValue(activeCtx, activeProperty, "@language");
      const direction = _getContextValue(activeCtx, activeProperty, "@direction");
      const container = _getContextValue(activeCtx, activeProperty, "@container") || [];
      const preserveIndex = "@index" in value && !container.includes("@index");
      if (!preserveIndex && type2 !== "@none") {
        if (value["@type"] === type2) {
          return value["@value"];
        }
        if ("@language" in value && value["@language"] === language && "@direction" in value && value["@direction"] === direction) {
          return value["@value"];
        }
        if ("@language" in value && value["@language"] === language) {
          return value["@value"];
        }
        if ("@direction" in value && value["@direction"] === direction) {
          return value["@value"];
        }
      }
      const keyCount = Object.keys(value).length;
      const isValueOnlyKey = keyCount === 1 || keyCount === 2 && "@index" in value && !preserveIndex;
      const hasDefaultLanguage = "@language" in activeCtx;
      const isValueString = _isString(value["@value"]);
      const hasNullMapping = activeCtx.mappings.has(activeProperty) && activeCtx.mappings.get(activeProperty)["@language"] === null;
      if (isValueOnlyKey && type2 !== "@none" && (!hasDefaultLanguage || !isValueString || hasNullMapping)) {
        return value["@value"];
      }
      const rval = {};
      if (preserveIndex) {
        rval[api.compactIri({
          activeCtx,
          iri: "@index",
          relativeTo: { vocab: true }
        })] = value["@index"];
      }
      if ("@type" in value) {
        rval[api.compactIri({
          activeCtx,
          iri: "@type",
          relativeTo: { vocab: true }
        })] = api.compactIri({ activeCtx, iri: value["@type"], relativeTo: { vocab: true } });
      } else if ("@language" in value) {
        rval[api.compactIri({
          activeCtx,
          iri: "@language",
          relativeTo: { vocab: true }
        })] = value["@language"];
      }
      if ("@direction" in value) {
        rval[api.compactIri({
          activeCtx,
          iri: "@direction",
          relativeTo: { vocab: true }
        })] = value["@direction"];
      }
      rval[api.compactIri({
        activeCtx,
        iri: "@value",
        relativeTo: { vocab: true }
      })] = value["@value"];
      return rval;
    }
    const expandedProperty = _expandIri(activeCtx, activeProperty, { vocab: true }, options);
    const type = _getContextValue(activeCtx, activeProperty, "@type");
    const compacted = api.compactIri({
      activeCtx,
      iri: value["@id"],
      relativeTo: { vocab: type === "@vocab" },
      base: options.base
    });
    if (type === "@id" || type === "@vocab" || expandedProperty === "@graph") {
      return compacted;
    }
    return {
      [api.compactIri({
        activeCtx,
        iri: "@id",
        relativeTo: { vocab: true }
      })]: compacted
    };
  };
  function _selectTerm(activeCtx, iri, value, containers, typeOrLanguage, typeOrLanguageValue) {
    if (typeOrLanguageValue === null) {
      typeOrLanguageValue = "@null";
    }
    const prefs = [];
    if ((typeOrLanguageValue === "@id" || typeOrLanguageValue === "@reverse") && _isObject(value) && "@id" in value) {
      if (typeOrLanguageValue === "@reverse") {
        prefs.push("@reverse");
      }
      const term = api.compactIri({ activeCtx, iri: value["@id"], relativeTo: { vocab: true } });
      if (activeCtx.mappings.has(term) && activeCtx.mappings.get(term) && activeCtx.mappings.get(term)["@id"] === value["@id"]) {
        prefs.push.apply(prefs, ["@vocab", "@id"]);
      } else {
        prefs.push.apply(prefs, ["@id", "@vocab"]);
      }
    } else {
      prefs.push(typeOrLanguageValue);
      const langDir = prefs.find((el) => el.includes("_"));
      if (langDir) {
        prefs.push(langDir.replace(/^[^_]+_/, "_"));
      }
    }
    prefs.push("@none");
    const containerMap = activeCtx.inverse[iri];
    for (const container of containers) {
      if (!(container in containerMap)) {
        continue;
      }
      const typeOrLanguageValueMap = containerMap[container][typeOrLanguage];
      for (const pref of prefs) {
        if (!(pref in typeOrLanguageValueMap)) {
          continue;
        }
        return typeOrLanguageValueMap[pref];
      }
    }
    return null;
  }
  function _checkNestProperty(activeCtx, nestProperty, options) {
    if (_expandIri(activeCtx, nestProperty, { vocab: true }, options) !== "@nest") {
      throw new JsonLdError("JSON-LD compact error; nested property must have an @nest value " + "resolving to @nest.", "jsonld.SyntaxError", { code: "invalid @nest value" });
    }
  }
});

// node_modules/jsonld/lib/JsonLdProcessor.js
var require_JsonLdProcessor = __commonJS((exports, module) => {
  module.exports = (jsonld) => {
    class JsonLdProcessor {
      toString() {
        return "[object JsonLdProcessor]";
      }
    }
    Object.defineProperty(JsonLdProcessor, "prototype", {
      writable: false,
      enumerable: false
    });
    Object.defineProperty(JsonLdProcessor.prototype, "constructor", {
      writable: true,
      enumerable: false,
      configurable: true,
      value: JsonLdProcessor
    });
    JsonLdProcessor.compact = function(input, ctx) {
      if (arguments.length < 2) {
        return Promise.reject(new TypeError("Could not compact, too few arguments."));
      }
      return jsonld.compact(input, ctx);
    };
    JsonLdProcessor.expand = function(input) {
      if (arguments.length < 1) {
        return Promise.reject(new TypeError("Could not expand, too few arguments."));
      }
      return jsonld.expand(input);
    };
    JsonLdProcessor.flatten = function(input) {
      if (arguments.length < 1) {
        return Promise.reject(new TypeError("Could not flatten, too few arguments."));
      }
      return jsonld.flatten(input);
    };
    return JsonLdProcessor;
  };
});

// node_modules/jsonld/lib/jsonld.js
var require_jsonld = __commonJS((exports, module) => {
  var canonize = require_lib();
  var platform = require_platform_browser2();
  var util = require_util();
  var ContextResolver = require_ContextResolver();
  var IdentifierIssuer = util.IdentifierIssuer;
  var JsonLdError = require_JsonLdError();
  var LRU = require_lru_cache();
  var NQuads = require_NQuads2();
  var { expand: _expand } = require_expand();
  var { flatten: _flatten } = require_flatten();
  var { fromRDF: _fromRDF } = require_fromRdf();
  var { toRDF: _toRDF } = require_toRdf();
  var {
    frameMergedOrDefault: _frameMergedOrDefault,
    cleanupNull: _cleanupNull
  } = require_frame();
  var {
    isArray: _isArray,
    isObject: _isObject,
    isString: _isString
  } = require_types();
  var {
    isSubjectReference: _isSubjectReference
  } = require_graphTypes();
  var {
    expandIri: _expandIri,
    getInitialContext: _getInitialContext,
    process: _processContext,
    processingMode: _processingMode
  } = require_context();
  var {
    compact: _compact,
    compactIri: _compactIri
  } = require_compact();
  var {
    createNodeMap: _createNodeMap,
    createMergedNodeMap: _createMergedNodeMap,
    mergeNodeMaps: _mergeNodeMaps
  } = require_nodeMap();
  var {
    logEventHandler: _logEventHandler,
    logWarningEventHandler: _logWarningEventHandler,
    safeEventHandler: _safeEventHandler,
    setDefaultEventHandler: _setDefaultEventHandler,
    setupEventHandler: _setupEventHandler,
    strictEventHandler: _strictEventHandler,
    unhandledEventHandler: _unhandledEventHandler
  } = require_events();
  var wrapper = function(jsonld) {
    const _rdfParsers = {};
    const RESOLVED_CONTEXT_CACHE_MAX_SIZE = 100;
    const _resolvedContextCache = new LRU({ max: RESOLVED_CONTEXT_CACHE_MAX_SIZE });
    jsonld.compact = async function(input, ctx, options) {
      if (arguments.length < 2) {
        throw new TypeError("Could not compact, too few arguments.");
      }
      if (ctx === null) {
        throw new JsonLdError("The compaction context must not be null.", "jsonld.CompactError", { code: "invalid local context" });
      }
      if (input === null) {
        return null;
      }
      options = _setDefaults(options, {
        base: _isString(input) ? input : "",
        compactArrays: true,
        compactToRelative: true,
        graph: false,
        skipExpansion: false,
        link: false,
        issuer: new IdentifierIssuer("_:b"),
        contextResolver: new ContextResolver({ sharedCache: _resolvedContextCache })
      });
      if (options.link) {
        options.skipExpansion = true;
      }
      if (!options.compactToRelative) {
        delete options.base;
      }
      let expanded;
      if (options.skipExpansion) {
        expanded = input;
      } else {
        expanded = await jsonld.expand(input, options);
      }
      const activeCtx = await jsonld.processContext(_getInitialContext(options), ctx, options);
      let compacted = await _compact({
        activeCtx,
        element: expanded,
        options
      });
      if (options.compactArrays && !options.graph && _isArray(compacted)) {
        if (compacted.length === 1) {
          compacted = compacted[0];
        } else if (compacted.length === 0) {
          compacted = {};
        }
      } else if (options.graph && _isObject(compacted)) {
        compacted = [compacted];
      }
      if (_isObject(ctx) && "@context" in ctx) {
        ctx = ctx["@context"];
      }
      ctx = util.clone(ctx);
      if (!_isArray(ctx)) {
        ctx = [ctx];
      }
      const tmp = ctx;
      ctx = [];
      for (let i2 = 0;i2 < tmp.length; ++i2) {
        if (!_isObject(tmp[i2]) || Object.keys(tmp[i2]).length > 0) {
          ctx.push(tmp[i2]);
        }
      }
      const hasContext = ctx.length > 0;
      if (ctx.length === 1) {
        ctx = ctx[0];
      }
      if (_isArray(compacted)) {
        const graphAlias = _compactIri({
          activeCtx,
          iri: "@graph",
          relativeTo: { vocab: true }
        });
        const graph = compacted;
        compacted = {};
        if (hasContext) {
          compacted["@context"] = ctx;
        }
        compacted[graphAlias] = graph;
      } else if (_isObject(compacted) && hasContext) {
        const graph = compacted;
        compacted = { "@context": ctx };
        for (const key in graph) {
          compacted[key] = graph[key];
        }
      }
      return compacted;
    };
    jsonld.expand = async function(input, options) {
      if (arguments.length < 1) {
        throw new TypeError("Could not expand, too few arguments.");
      }
      options = _setDefaults(options, {
        keepFreeFloatingNodes: false,
        contextResolver: new ContextResolver({ sharedCache: _resolvedContextCache })
      });
      const toResolve = {};
      const contextsToProcess = [];
      if ("expandContext" in options) {
        const expandContext = util.clone(options.expandContext);
        if (_isObject(expandContext) && "@context" in expandContext) {
          toResolve.expandContext = expandContext;
        } else {
          toResolve.expandContext = { "@context": expandContext };
        }
        contextsToProcess.push(toResolve.expandContext);
      }
      let defaultBase;
      if (!_isString(input)) {
        toResolve.input = util.clone(input);
      } else {
        const remoteDoc = await jsonld.get(input, options);
        defaultBase = remoteDoc.documentUrl;
        toResolve.input = remoteDoc.document;
        if (remoteDoc.contextUrl) {
          toResolve.remoteContext = { "@context": remoteDoc.contextUrl };
          contextsToProcess.push(toResolve.remoteContext);
        }
      }
      if (!("base" in options)) {
        options.base = defaultBase || "";
      }
      let activeCtx = _getInitialContext(options);
      for (const localCtx of contextsToProcess) {
        activeCtx = await _processContext({ activeCtx, localCtx, options });
      }
      let expanded = await _expand({
        activeCtx,
        element: toResolve.input,
        options
      });
      if (_isObject(expanded) && "@graph" in expanded && Object.keys(expanded).length === 1) {
        expanded = expanded["@graph"];
      } else if (expanded === null) {
        expanded = [];
      }
      if (!_isArray(expanded)) {
        expanded = [expanded];
      }
      return expanded;
    };
    jsonld.flatten = async function(input, ctx, options) {
      if (arguments.length < 1) {
        return new TypeError("Could not flatten, too few arguments.");
      }
      if (typeof ctx === "function") {
        ctx = null;
      } else {
        ctx = ctx || null;
      }
      options = _setDefaults(options, {
        base: _isString(input) ? input : "",
        contextResolver: new ContextResolver({ sharedCache: _resolvedContextCache })
      });
      const expanded = await jsonld.expand(input, options);
      const flattened = _flatten(expanded);
      if (ctx === null) {
        return flattened;
      }
      options.graph = true;
      options.skipExpansion = true;
      const compacted = await jsonld.compact(flattened, ctx, options);
      return compacted;
    };
    jsonld.frame = async function(input, frame, options) {
      if (arguments.length < 2) {
        throw new TypeError("Could not frame, too few arguments.");
      }
      options = _setDefaults(options, {
        base: _isString(input) ? input : "",
        embed: "@once",
        explicit: false,
        requireAll: false,
        omitDefault: false,
        bnodesToClear: [],
        contextResolver: new ContextResolver({ sharedCache: _resolvedContextCache })
      });
      if (_isString(frame)) {
        const remoteDoc = await jsonld.get(frame, options);
        frame = remoteDoc.document;
        if (remoteDoc.contextUrl) {
          let ctx = frame["@context"];
          if (!ctx) {
            ctx = remoteDoc.contextUrl;
          } else if (_isArray(ctx)) {
            ctx.push(remoteDoc.contextUrl);
          } else {
            ctx = [ctx, remoteDoc.contextUrl];
          }
          frame["@context"] = ctx;
        }
      }
      const frameContext = frame ? frame["@context"] || {} : {};
      const activeCtx = await jsonld.processContext(_getInitialContext(options), frameContext, options);
      if (!options.hasOwnProperty("omitGraph")) {
        options.omitGraph = _processingMode(activeCtx, 1.1);
      }
      if (!options.hasOwnProperty("pruneBlankNodeIdentifiers")) {
        options.pruneBlankNodeIdentifiers = _processingMode(activeCtx, 1.1);
      }
      const expanded = await jsonld.expand(input, options);
      const opts = { ...options };
      opts.isFrame = true;
      opts.keepFreeFloatingNodes = true;
      const expandedFrame = await jsonld.expand(frame, opts);
      const frameKeys = Object.keys(frame).map((key) => _expandIri(activeCtx, key, { vocab: true }));
      opts.merged = !frameKeys.includes("@graph");
      opts.is11 = _processingMode(activeCtx, 1.1);
      const framed = _frameMergedOrDefault(expanded, expandedFrame, opts);
      opts.graph = !options.omitGraph;
      opts.skipExpansion = true;
      opts.link = {};
      opts.framing = true;
      let compacted = await jsonld.compact(framed, frameContext, opts);
      opts.link = {};
      compacted = _cleanupNull(compacted, opts);
      return compacted;
    };
    jsonld.link = async function(input, ctx, options) {
      const frame = {};
      if (ctx) {
        frame["@context"] = ctx;
      }
      frame["@embed"] = "@link";
      return jsonld.frame(input, frame, options);
    };
    jsonld.normalize = jsonld.canonize = async function(input, options) {
      if (arguments.length < 1) {
        throw new TypeError("Could not canonize, too few arguments.");
      }
      options = _setDefaults(options, {
        skipExpansion: false,
        safe: true,
        contextResolver: new ContextResolver({ sharedCache: _resolvedContextCache })
      });
      const canonizeOptions = Object.assign({}, {
        algorithm: "RDFC-1.0"
      }, options.canonizeOptions || null);
      if ("inputFormat" in options) {
        if (options.inputFormat !== "application/n-quads") {
          throw new JsonLdError("Unknown canonicalization input format.", "jsonld.CanonizeError");
        }
        const parsedInput = NQuads.parse(input);
        return canonize.canonize(parsedInput, canonizeOptions);
      }
      const opts = { ...options };
      delete opts.format;
      delete opts.canonizeOptions;
      opts.produceGeneralizedRdf = false;
      const dataset = await jsonld.toRDF(input, opts);
      return canonize.canonize(dataset, canonizeOptions);
    };
    jsonld.fromRDF = async function(dataset, options) {
      if (arguments.length < 1) {
        throw new TypeError("Could not convert from RDF, too few arguments.");
      }
      options = _setDefaults(options, {
        format: _isString(dataset) ? "application/n-quads" : undefined
      });
      const { format: format2 } = options;
      let { rdfParser } = options;
      if (format2) {
        rdfParser = rdfParser || _rdfParsers[format2];
        if (!rdfParser) {
          throw new JsonLdError("Unknown input format.", "jsonld.UnknownFormat", { format: format2 });
        }
      } else {
        rdfParser = () => dataset;
      }
      const parsedDataset = await rdfParser(dataset);
      return _fromRDF(parsedDataset, options);
    };
    jsonld.toRDF = async function(input, options) {
      if (arguments.length < 1) {
        throw new TypeError("Could not convert to RDF, too few arguments.");
      }
      options = _setDefaults(options, {
        skipExpansion: false,
        contextResolver: new ContextResolver({ sharedCache: _resolvedContextCache })
      });
      let expanded;
      if (options.skipExpansion) {
        expanded = input;
      } else {
        expanded = await jsonld.expand(input, options);
      }
      const dataset = _toRDF(expanded, options);
      if (options.format) {
        if (options.format === "application/n-quads") {
          return NQuads.serialize(dataset);
        }
        throw new JsonLdError("Unknown output format.", "jsonld.UnknownFormat", { format: options.format });
      }
      return dataset;
    };
    jsonld.createNodeMap = async function(input, options) {
      if (arguments.length < 1) {
        throw new TypeError("Could not create node map, too few arguments.");
      }
      options = _setDefaults(options, {
        base: _isString(input) ? input : "",
        contextResolver: new ContextResolver({ sharedCache: _resolvedContextCache })
      });
      const expanded = await jsonld.expand(input, options);
      return _createMergedNodeMap(expanded, options);
    };
    jsonld.merge = async function(docs, ctx, options) {
      if (arguments.length < 1) {
        throw new TypeError("Could not merge, too few arguments.");
      }
      if (!_isArray(docs)) {
        throw new TypeError('Could not merge, "docs" must be an array.');
      }
      if (typeof ctx === "function") {
        ctx = null;
      } else {
        ctx = ctx || null;
      }
      options = _setDefaults(options, {
        contextResolver: new ContextResolver({ sharedCache: _resolvedContextCache })
      });
      const expanded = await Promise.all(docs.map((doc) => {
        const opts = { ...options };
        return jsonld.expand(doc, opts);
      }));
      let mergeNodes = true;
      if ("mergeNodes" in options) {
        mergeNodes = options.mergeNodes;
      }
      const issuer = options.issuer || new IdentifierIssuer("_:b");
      const graphs = { "@default": {} };
      for (let i2 = 0;i2 < expanded.length; ++i2) {
        const doc = util.relabelBlankNodes(expanded[i2], {
          issuer: new IdentifierIssuer("_:b" + i2 + "-")
        });
        const _graphs = mergeNodes || i2 === 0 ? graphs : { "@default": {} };
        _createNodeMap(doc, _graphs, "@default", issuer);
        if (_graphs !== graphs) {
          for (const graphName in _graphs) {
            const _nodeMap = _graphs[graphName];
            if (!(graphName in graphs)) {
              graphs[graphName] = _nodeMap;
              continue;
            }
            const nodeMap = graphs[graphName];
            for (const key in _nodeMap) {
              if (!(key in nodeMap)) {
                nodeMap[key] = _nodeMap[key];
              }
            }
          }
        }
      }
      const defaultGraph2 = _mergeNodeMaps(graphs);
      const flattened = [];
      const keys = Object.keys(defaultGraph2).sort();
      for (let ki = 0;ki < keys.length; ++ki) {
        const node = defaultGraph2[keys[ki]];
        if (!_isSubjectReference(node)) {
          flattened.push(node);
        }
      }
      if (ctx === null) {
        return flattened;
      }
      options.graph = true;
      options.skipExpansion = true;
      const compacted = await jsonld.compact(flattened, ctx, options);
      return compacted;
    };
    Object.defineProperty(jsonld, "documentLoader", {
      get: () => jsonld._documentLoader,
      set: (v) => jsonld._documentLoader = v
    });
    jsonld.documentLoader = async (url) => {
      throw new JsonLdError("Could not retrieve a JSON-LD document from the URL. URL " + "dereferencing not implemented.", "jsonld.LoadDocumentError", { code: "loading document failed", url });
    };
    jsonld.get = async function(url, options) {
      let load;
      if (typeof options.documentLoader === "function") {
        load = options.documentLoader;
      } else {
        load = jsonld.documentLoader;
      }
      const remoteDoc = await load(url);
      try {
        if (!remoteDoc.document) {
          throw new JsonLdError("No remote document found at the given URL.", "jsonld.NullRemoteDocument");
        }
        if (_isString(remoteDoc.document)) {
          remoteDoc.document = JSON.parse(remoteDoc.document);
        }
      } catch (e) {
        throw new JsonLdError("Could not retrieve a JSON-LD document from the URL.", "jsonld.LoadDocumentError", {
          code: "loading document failed",
          cause: e,
          remoteDoc
        });
      }
      return remoteDoc;
    };
    jsonld.processContext = async function(activeCtx, localCtx, options) {
      options = _setDefaults(options, {
        base: "",
        contextResolver: new ContextResolver({ sharedCache: _resolvedContextCache })
      });
      if (localCtx === null) {
        return _getInitialContext(options);
      }
      localCtx = util.clone(localCtx);
      if (!(_isObject(localCtx) && ("@context" in localCtx))) {
        localCtx = { "@context": localCtx };
      }
      return _processContext({ activeCtx, localCtx, options });
    };
    jsonld.getContextValue = require_context().getContextValue;
    jsonld.documentLoaders = {};
    jsonld.useDocumentLoader = function(type) {
      if (!(type in jsonld.documentLoaders)) {
        throw new JsonLdError('Unknown document loader type: "' + type + '"', "jsonld.UnknownDocumentLoader", { type });
      }
      jsonld.documentLoader = jsonld.documentLoaders[type].apply(jsonld, Array.prototype.slice.call(arguments, 1));
    };
    jsonld.registerRDFParser = function(contentType, parser) {
      _rdfParsers[contentType] = parser;
    };
    jsonld.unregisterRDFParser = function(contentType) {
      delete _rdfParsers[contentType];
    };
    jsonld.registerRDFParser("application/n-quads", NQuads.parse);
    jsonld.url = require_url();
    jsonld.logEventHandler = _logEventHandler;
    jsonld.logWarningEventHandler = _logWarningEventHandler;
    jsonld.safeEventHandler = _safeEventHandler;
    jsonld.setDefaultEventHandler = _setDefaultEventHandler;
    jsonld.strictEventHandler = _strictEventHandler;
    jsonld.unhandledEventHandler = _unhandledEventHandler;
    jsonld.util = util;
    Object.assign(jsonld, util);
    jsonld.promises = jsonld;
    jsonld.RequestQueue = require_RequestQueue();
    jsonld.JsonLdProcessor = require_JsonLdProcessor()(jsonld);
    platform.setupGlobals(jsonld);
    platform.setupDocumentLoaders(jsonld);
    function _setDefaults(options, {
      documentLoader = jsonld.documentLoader,
      ...defaults
    }) {
      if (options && "compactionMap" in options) {
        throw new JsonLdError('"compactionMap" not supported.', "jsonld.OptionsError");
      }
      if (options && "expansionMap" in options) {
        throw new JsonLdError('"expansionMap" not supported.', "jsonld.OptionsError");
      }
      return Object.assign({}, { documentLoader }, defaults, options, { eventHandler: _setupEventHandler({ options }) });
    }
    return jsonld;
  };
  var factory = function() {
    return wrapper(function() {
      return factory();
    });
  };
  wrapper(factory);
  module.exports = factory;
});

// src/cli/output.ts
function normalizeMime(mime) {
  return (mime ?? "").toLowerCase().trim();
}
function mimeToParserFormat(mime) {
  switch (normalizeMime(mime)) {
    case "text/turtle":
      return "Turtle";
    case "text/n3":
      return "N3";
    case "application/n-triples":
      return "N-Triples";
    case "application/n-quads":
      return "N-Quads";
    case "application/trig":
      return "TriG";
    default:
      return "";
  }
}
function mimeToWriterFormat(mime) {
  switch (normalizeMime(mime)) {
    case "text/turtle":
      return "Turtle";
    case "text/n3":
      return "N3";
    case "application/n-triples":
      return "N-Triples";
    case "application/n-quads":
      return "N-Quads";
    case "application/trig":
      return "TriG";
    default:
      return "";
  }
}
function parseRdfText(content, mime) {
  const normalizedMime = normalizeMime(mime);
  if (normalizedMime === "application/ld+json") {
    return (async () => {
      const parsed = JSON.parse(content);
      function sanitizeContext(obj) {
        if (!obj || typeof obj !== "object")
          return obj;
        if (Array.isArray(obj))
          return obj.map(sanitizeContext);
        if (typeof obj["@context"] === "string") {
          obj = { ...obj, "@context": {} };
        } else if (typeof obj["@context"] === "object") {
          obj = { ...obj, "@context": sanitizeContext(obj["@context"]) };
        }
        return obj;
      }
      try {
        const nquads = await import_jsonld.default.toRDF(parsed, { format: "application/n-quads" });
        return parseRdfText(String(nquads), "application/n-quads");
      } catch {
        const safeParsed = sanitizeContext(parsed);
        const nquads = await import_jsonld.default.toRDF(safeParsed, { format: "application/n-quads" });
        return parseRdfText(String(nquads), "application/n-quads");
      }
    })();
  }
  const parserFormat = mimeToParserFormat(normalizedMime);
  if (!parserFormat) {
    throw new Error(`Unsupported RDF source MIME for merging: ${mime}`);
  }
  const parser = new N3Parser({ format: parserFormat });
  const quads = [];
  return new Promise((resolve2, reject) => {
    parser.parse(content, (error, quad2) => {
      if (error) {
        reject(error);
        return;
      }
      if (quad2) {
        quads.push(quad2);
        return;
      }
      resolve2(quads);
    });
  });
}
function relationToQuads(relation) {
  const rdfType = N3DataFactory_default.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
  const xhtml = "http://www.w3.org/1999/xhtml#";
  const subject = N3DataFactory_default.blankNode();
  const quads = [
    N3DataFactory_default.quad(subject, rdfType, N3DataFactory_default.namedNode(`${xhtml}link`)),
    N3DataFactory_default.quad(subject, N3DataFactory_default.namedNode(`${xhtml}anchor`), N3DataFactory_default.namedNode(relation.anchor ?? relation.href)),
    N3DataFactory_default.quad(subject, N3DataFactory_default.namedNode(`${xhtml}rel`), /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(relation.rel) ? N3DataFactory_default.namedNode(relation.rel) : N3DataFactory_default.literal(relation.rel)),
    N3DataFactory_default.quad(subject, N3DataFactory_default.namedNode(`${xhtml}href`), N3DataFactory_default.namedNode(relation.href))
  ];
  for (const option of relation.options ?? []) {
    const optionNode = N3DataFactory_default.blankNode();
    quads.push(N3DataFactory_default.quad(subject, N3DataFactory_default.namedNode(`${xhtml}option`), optionNode));
    quads.push(N3DataFactory_default.quad(optionNode, rdfType, N3DataFactory_default.namedNode(`${xhtml}LinkOption`)));
    quads.push(N3DataFactory_default.quad(optionNode, N3DataFactory_default.namedNode(`${xhtml}optionKey`), N3DataFactory_default.literal(option.name ?? "")));
    quads.push(N3DataFactory_default.quad(optionNode, N3DataFactory_default.namedNode(`${xhtml}optionVal`), N3DataFactory_default.literal(option.value ?? "")));
  }
  if ((relation.options ?? []).length === 0) {
    quads.push(N3DataFactory_default.quad(subject, N3DataFactory_default.namedNode(`${xhtml}option`), N3DataFactory_default.blankNode()));
  }
  return quads;
}
async function mergeRdfDocuments(documents, relations) {
  const seen = new Set;
  const merged = [];
  for (const document of documents) {
    const quads = await parseRdfText(document.content, document.mime);
    for (const quad2 of quads) {
      const key = quad2.toString();
      if (seen.has(key))
        continue;
      seen.add(key);
      merged.push(quad2);
    }
  }
  for (const relation of relations) {
    for (const quad2 of relationToQuads(relation)) {
      const key = quad2.toString();
      if (seen.has(key))
        continue;
      seen.add(key);
      merged.push(quad2);
    }
  }
  return merged;
}
async function serializeMergedQuads(quads, outputMime) {
  const normalizedMime = normalizeMime(outputMime);
  if (normalizedMime === "application/ld+json") {
    const writer2 = new N3Writer({ format: "N-Quads" });
    writer2.addQuads(quads);
    const nquads = await new Promise((resolve2, reject) => {
      writer2.end((error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve2(result ?? "");
      });
    });
    const json = await import_jsonld.default.fromRDF(nquads, { format: "application/n-quads" });
    return `${JSON.stringify(json, null, 2)}
`;
  }
  const writerFormat = mimeToWriterFormat(normalizedMime);
  if (!writerFormat) {
    throw new Error(`Unsupported output MIME for merged RDF serialization: ${outputMime}`);
  }
  const writer = new N3Writer({ format: writerFormat });
  writer.addQuads(quads);
  return await new Promise((resolve2, reject) => {
    writer.end((error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve2(result ?? "");
    });
  });
}
function resolveOutputTarget(outputPath) {
  const absolutePath = isAbsolute(outputPath) ? outputPath : resolve(process.cwd(), outputPath);
  const extension = extname(outputPath).toLowerCase();
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime) {
    throw new Error(`Unsupported output extension for ${outputPath}`);
  }
  return { path: absolutePath, mime };
}
function canWriteAsIs(sourceMime, targetMime) {
  const source = normalizeMime(sourceMime);
  const target = normalizeMime(targetMime);
  if (source === target) {
    return true;
  }
  if (source === "application/n-triples" && (target === "text/turtle" || target === "text/n3")) {
    return true;
  }
  return false;
}
async function serializeRdfForOutput(document, outputMime) {
  const sourceMime = normalizeMime(document.mime);
  const targetMime = normalizeMime(outputMime);
  if (!sourceMime) {
    throw new Error("Cannot serialize RDF without a source MIME type");
  }
  if (sourceMime === targetMime) {
    return document.content;
  }
  if (sourceMime === "application/rdf+xml" || targetMime === "application/rdf+xml") {
    throw new Error(`RDF/XML conversion is not supported yet: ${sourceMime} → ${targetMime}`);
  }
  if (sourceMime === "application/ld+json" && targetMime === "application/ld+json") {
    return document.content;
  }
  if (canWriteAsIs(sourceMime, targetMime)) {
    return document.content;
  }
  throw new Error(`Serialization from ${document.mime} to ${outputMime} is not implemented yet`);
}
async function writeRdfOutput(document, outputPath) {
  const target = resolveOutputTarget(outputPath);
  const serialized = await serializeRdfForOutput(document, target.mime);
  await Bun.write(target.path, serialized);
  return target;
}
async function writeMergedRdfOutput(documents, relations, outputPath) {
  const target = resolveOutputTarget(outputPath);
  const merged = await mergeRdfDocuments(documents, relations);
  const serialized = await serializeMergedQuads(merged, target.mime);
  await Bun.write(target.path, serialized);
  return target;
}
var import_jsonld, MIME_BY_EXTENSION;
var init_output = __esm(() => {
  init_path();
  init_src();
  import_jsonld = __toESM(require_jsonld(), 1);
  MIME_BY_EXTENSION = {
    ".ttl": "text/turtle",
    ".n3": "text/n3",
    ".nt": "application/n-triples",
    ".nq": "application/n-quads",
    ".trig": "application/trig",
    ".jsonld": "application/ld+json",
    ".rdf": "application/rdf+xml"
  };
});

// src/cli/run.ts
var exports_run = {};
__export(exports_run, {
  runWrxCli: () => runWrxCli
});
function collectProfileValues(relations) {
  const profiles = new Set;
  for (const relation of relations) {
    if (relation.rel === "profile") {
      profiles.add(relation.href);
    }
    for (const option of relation.options ?? []) {
      const optionName = (option.name ?? "").toLowerCase();
      const optionValue = (option.value ?? "").trim();
      if (optionName === "profile" && optionValue) {
        profiles.add(optionValue);
      }
    }
  }
  return [...profiles];
}
function printHelp() {
  console.log(getCliUsage());
}
function selectPrimaryRdf(overview) {
  return overview.found?.[0] ?? null;
}
async function writeOutputIfRequested(parsed, rdf3) {
  if (!parsed.output) {
    return;
  }
  if (!rdf3) {
    throw new Error("Cannot write output because no RDF was discovered");
  }
  const target = await writeRdfOutput(rdf3, parsed.output);
  console.error("");
  console.error(`\uD83D\uDCBE Wrote RDF output to: ${target.path}`);
  console.error(`   MIME: ${target.mime}`);
}
async function runWrxCli(args = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return;
  }
  if (parsed.help) {
    printHelp();
    return;
  }
  const url = parsed.input ?? null;
  if (!url) {
    printHelp();
    return;
  }
  let outputDocument = null;
  let mergedDocuments = [];
  let mergedRelations = [];
  if (parsed.all) {
    const overview = await extractAllRDF(url);
    console.error(`\uD83D\uDD0D Extracting RDF from: ${url}`);
    console.error("");
    console.error("\uD83D\uDCCA Strategy Trace:");
    for (const step of overview.trace ?? []) {
      const hits = step.hits;
      const stratNum = step.strategy;
      const label = step.label;
      if (step.source === "content-negotiation") {
        const rdfHits = (overview.contentNegotiations ?? []).filter((r) => r.isRdf);
        if (rdfHits.length > 0) {
          console.error(`  ✅ Strategy ${stratNum} — ${label} (${rdfHits.length} RDF format(s) found)`);
        } else {
          console.error(`  ❌ Strategy ${stratNum} — ${label}`);
        }
        const reqW = (overview.contentNegotiations ?? []).length > 0 ? Math.max(...(overview.contentNegotiations ?? []).map((r) => r.requestedMime.length), "Requested MIME".length) : "Requested MIME".length;
        const resW = (overview.contentNegotiations ?? []).length > 0 ? Math.max(...(overview.contentNegotiations ?? []).map((r) => r.responseMime.length), "Response MIME".length) : "Response MIME".length;
        console.error(`       ${"Requested MIME".padEnd(reqW)}  →  ${"Response MIME".padEnd(resW)}  Chars`);
        console.error(`       ${"─".repeat(reqW)}     ${"─".repeat(resW)}  ─────`);
        for (const cn of overview.contentNegotiations ?? []) {
          const flag = cn.isRdf ? "✅" : "❌";
          console.error(`       ${cn.requestedMime.padEnd(reqW)}  →  ${cn.responseMime.padEnd(resW)}  ${cn.chars.toLocaleString().padStart(7)}  ${flag}`);
        }
      } else if (hits.length > 0) {
        console.error(`  ✅ Strategy ${stratNum} — ${label}`);
        for (const hit of hits) {
          console.error(`       ${hit.format}  ${hit.url}  (${hit.chars} chars)`);
        }
      } else {
        console.error(`  ❌ Strategy ${stratNum} — ${label}`);
      }
    }
    console.error("");
    if ((overview.contentNegotiations ?? []).length > 0) {
      console.error("\uD83D\uDCCB Content Negotiation Overview (all MIME types):");
      for (const cn of overview.contentNegotiations ?? []) {
        const flag = cn.isRdf ? "✅ RDF" : "❌ not RDF";
        console.error(`   ${cn.requestedMime.padEnd(26)} → ${cn.chars.toLocaleString().padStart(7)} chars  (${cn.responseMime})  ${flag}`);
      }
      console.error("");
    }
    mergedRelations = parsed.extendLinks || parsed.profile || parsed.all ? await collectLinkRelationsForUri(url) : [];
    mergedDocuments = (overview.found ?? []).filter((doc) => Boolean(doc));
    if ((overview.found ?? []).length > 0) {
      console.error(`\uD83D\uDCCA ${(overview.found ?? []).length} unique RDF source(s) found across ${STRATEGY_ORDER.length} strategies tried.`);
    } else {
      console.error("\uD83D\uDCCA No RDF found after exploring all strategies.");
    }
    outputDocument = selectPrimaryRdf(overview);
  } else {
    console.error(`\uD83D\uDD0D Extracting RDF from: ${url}`);
    const result = await extractRDF(url);
    if (result) {
      console.error(`✅ Found RDF (${result.source}) from ${result.url}`);
      console.error(`Format: ${result.format}`);
      console.error(`Content length: ${result.content.length} chars`);
      console.error(`
--- First 500 chars of RDF ---`);
      console.error(result.content.slice(0, 500) + (result.content.length > 500 ? "..." : ""));
    } else {
      console.error("❌ No RDF found after trying all strategies.");
    }
    outputDocument = result;
    if (parsed.extendLinks || parsed.profile) {
      mergedRelations = await collectLinkRelationsForUri(url);
    }
  }
  if (parsed.profile) {
    if (mergedRelations.length === 0) {
      mergedRelations = await collectLinkRelationsForUri(url);
    }
    const profiles = collectProfileValues(mergedRelations);
    console.error("");
    console.error(`\uD83E\uDDEA Profiles discovered: ${profiles.length}`);
    if (profiles.length > 0) {
      for (const profile of profiles) {
        console.error(`   - ${profile}`);
      }
    }
  }
  try {
    if (parsed.output) {
      if (parsed.extendLinks || parsed.all) {
        const documentsToWrite = mergedDocuments.length > 0 ? mergedDocuments : outputDocument ? [outputDocument] : [];
        await writeMergedRdfOutput(documentsToWrite, mergedRelations, parsed.output);
      } else {
        await writeOutputIfRequested(parsed, outputDocument);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }
}
var init_run = __esm(async () => {
  init_constants();
  init_link_parser();
  init_output();
  await init_wrx();
});

// wrx.ts
async function extractAllRDF(uri) {
  return discoverAllRdf(uri);
}
async function extractRDF(uri) {
  return discoverFirstRdf(uri);
}
async function extractLinkRelations(uri) {
  return collectLinkRelationsForUri(uri);
}
var init_wrx = __esm(async () => {
  init_link_parser();
  init_pipeline();
  if (import.meta.main) {
    const { runWrxCli: runWrxCli2 } = await init_run().then(() => exports_run);
    await runWrxCli2();
  }
});
await init_wrx();

export {
  extractRDF,
  extractLinkRelations,
  extractAllRDF
};
