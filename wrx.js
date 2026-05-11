// @bun
// wrx.ts
var STRATEGY_LABELS = {
  "content-negotiation": "Content Negotiation",
  "signposting-link-header": "HTTP Link header (rel=describedby)",
  linkset: "Linkset (rel=linkset)",
  "signposting-html-link": "HTML link[rel=describedby]",
  "embedded-script": "Embedded RDF script",
  "sitemap-signposting": "Sitemap signposting (robots.txt)"
};
var STRATEGY_ORDER = [
  "content-negotiation",
  "signposting-link-header",
  "linkset",
  "signposting-html-link",
  "embedded-script",
  "sitemap-signposting"
];
var RDF_MIMES = new Set([
  "text/turtle",
  "application/ld+json",
  "application/rdf+xml",
  "application/n-triples",
  "text/n3",
  "application/n-quads",
  "application/trig"
]);
var RDF_ACCEPT = "text/turtle;q=1.0,application/ld+json;q=0.9,application/rdf+xml;q=0.8,application/n-triples;q=0.7,text/n3;q=0.6,application/n-quads;q=0.6,application/trig;q=0.6,text/html;q=0.3";
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
function isRDFMime(mime) {
  return RDF_MIMES.has(mime.toLowerCase().trim());
}
function isLinksetMime(mime) {
  const m = mime.toLowerCase().trim();
  return m === "application/linkset+json" || m === "application/linkset";
}
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
function formatOptionsForKey(options) {
  return options.slice().sort((a, b) => {
    if (a.key === b.key)
      return a.value.localeCompare(b.value);
    return a.key.localeCompare(b.key);
  }).map((opt) => `${opt.key}=${opt.value}`).join("|");
}
function relationKey(item) {
  return [item.anchor, item.rel, item.href, item.origin, formatOptionsForKey(item.options)].join("::");
}
function addLinkRelation(items, seen, item) {
  const key = relationKey(item);
  if (seen.has(key))
    return;
  seen.add(key);
  items.push(item);
}
function sanitizeRelationToken(rel) {
  return rel.trim();
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
    const options = Object.entries(entry).filter(([key]) => key !== "url" && key !== "rel" && key !== "anchor").map(([key, value]) => ({ key, value }));
    for (const rel of relValues) {
      const relToken = sanitizeRelationToken(rel);
      if (!relToken)
        continue;
      addLinkRelation(sink, seen, { anchor, rel: relToken, href, options, origin });
    }
  }
}
function collectFromHtmlHints(uri, htmlHints, sink, seen) {
  for (const link of htmlHints.describedByLinks) {
    try {
      const href = new URL(link.href, uri).toString();
      const options = link.type ? [{ key: "type", value: link.type }] : [];
      addLinkRelation(sink, seen, {
        anchor: uri,
        rel: "describedby",
        href,
        options,
        origin: "html-link"
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
        origin: "html-link"
      });
    } catch {}
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
      const options = Object.entries(row).filter(([key]) => key !== "href").filter(([, value]) => typeof value === "string").map(([key, value]) => ({ key, value }));
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
    if (!isRDFMime(ct) || !discovery.ok) {
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
  collectFromParsedLinkEntries(headerLinks, uri, "http-link-header", relations, seen, uri);
  const htmlHints = bodyText ? extractHtmlHints(bodyText) : { describedByLinks: [], linksets: [], embeddedScripts: [] };
  collectFromHtmlHints(uri, htmlHints, relations, seen);
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
        return `[ a xhtml:LinkOption;
       xhtml:optionKey "${escapeLiteral(opt.key)}";
       xhtml:optionVal "${escapeLiteral(opt.value)}" ]`;
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
async function fetchWithRedirect(url, init) {
  return await fetch(url, { ...init, redirect: "follow" });
}
async function fetchRDF(url) {
  return fetchWithRedirect(url, {
    headers: { Accept: RDF_ACCEPT }
  });
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
async function fetchDescribedBy(url, declaredType) {
  if (!declaredType || !isRDFMime(declaredType))
    return fetchRDF(url);
  const others = [
    "text/turtle",
    "application/ld+json",
    "application/rdf+xml",
    "application/n-triples",
    "text/n3",
    "application/n-quads",
    "application/trig"
  ].filter((m) => m !== declaredType).map((m, i) => `${m};q=${Math.max(0.1, 0.9 - i * 0.1).toFixed(1)}`);
  const accept = [`${declaredType};q=1.0`, ...others].join(", ");
  return fetchWithRedirect(url, { headers: { Accept: accept } });
}
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
  if (isRDFMime(responseCt))
    return responseCt;
  if (declaredType && isRDFMime(declaredType) && responseCt === "application/json" && looksLikeJsonLd(body)) {
    return declaredType;
  }
  return null;
}
function normUri(u) {
  return u.toLowerCase().replace(/\/$/, "");
}
async function tryExtractFromLinkset(linksetUrl, baseUri) {
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
          if (target.type && !isRDFMime(target.type))
            continue;
          const metaUrl = new URL(target.href, linksetUrl).toString();
          try {
            const metaRes = await fetchDescribedBy(metaUrl, target.type);
            if (!metaRes.ok)
              continue;
            const metaCt = baseMime(metaRes.headers.get("content-type"));
            const body = await metaRes.text();
            const format = resolveRdfFormat(metaCt, target.type, body);
            if (format)
              return { content: body, format, source: "linkset", url: metaUrl };
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
            return { content: await doiRes.text(), format: doiCt, source: "linkset", url: doiUrl };
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
        if (declaredType && !isRDFMime(declaredType))
          continue;
        const metaUrl = new URL(link["url"], linksetUrl).toString();
        try {
          const metaRes = await fetchDescribedBy(metaUrl, declaredType);
          if (!metaRes.ok)
            continue;
          const metaCt = baseMime(metaRes.headers.get("content-type"));
          const body = await metaRes.text();
          const format = resolveRdfFormat(metaCt, declaredType, body);
          if (format)
            return { content: body, format, source: "linkset", url: metaUrl };
        } catch {}
      }
    }
  }
  return null;
}
async function tryExtractFromSitemapAndDCAT(uri) {
  let urlObj;
  try {
    urlObj = new URL(uri);
  } catch {
    return null;
  }
  const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
  let robotsText;
  try {
    const res = await fetchWithRedirect(robotsUrl);
    if (!res.ok)
      return null;
    robotsText = await res.text();
  } catch {
    return null;
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
    let xmlDoc;
    try {
      xmlDoc = new DOMParser().parseFromString(sText, "text/xml");
      if (xmlDoc.getElementsByTagName("parsererror").length > 0)
        continue;
    } catch {
      continue;
    }
    const urlElements = xmlDoc.getElementsByTagName("url");
    for (const urlEl of urlElements) {
      const locEl = urlEl.getElementsByTagName("loc")[0];
      if (!locEl)
        continue;
      const loc = locEl.textContent?.trim();
      if (loc === uri || loc === uri + "/" || uri === loc + "/") {
        const xhtmlNs = "http://www.w3.org/1999/xhtml";
        const xLinks = urlEl.getElementsByTagNameNS(xhtmlNs, "link");
        for (const xLink of xLinks) {
          const rel = xLink.getAttribute("rel");
          const type = xLink.getAttribute("type");
          const href = xLink.getAttribute("href");
          if (rel === "describedby" && href && (!type || isRDFMime(type))) {
            const metaUrl = new URL(href, sitemapUrl).toString();
            const metaRes = await fetchRDF(metaUrl);
            const metaCt = baseMime(metaRes.headers.get("content-type"));
            if (isRDFMime(metaCt) && metaRes.ok) {
              return {
                content: await metaRes.text(),
                format: metaCt,
                source: "sitemap-signposting",
                url: metaUrl
              };
            }
          }
        }
      }
    }
  }
  return null;
}
async function tryExtractAllFromLinkset(linksetUrl, baseUri) {
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
          if (target.type && !isRDFMime(target.type))
            continue;
          const metaUrl = new URL(target.href, linksetUrl).toString();
          try {
            const metaRes = await fetchDescribedBy(metaUrl, target.type);
            if (!metaRes.ok)
              continue;
            const metaCt = baseMime(metaRes.headers.get("content-type"));
            const body = await metaRes.text();
            const format = resolveRdfFormat(metaCt, target.type, body);
            if (format)
              results.push({ content: body, format, source: "linkset", url: metaUrl });
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
            results.push({ content: await doiRes.text(), format: doiCt, source: "linkset", url: doiUrl });
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
        if (declaredType && !isRDFMime(declaredType))
          continue;
        const metaUrl = new URL(link["url"], linksetUrl).toString();
        try {
          const metaRes = await fetchDescribedBy(metaUrl, declaredType);
          if (!metaRes.ok)
            continue;
          const metaCt = baseMime(metaRes.headers.get("content-type"));
          const body = await metaRes.text();
          const format = resolveRdfFormat(metaCt, declaredType, body);
          if (format)
            results.push({ content: body, format, source: "linkset", url: metaUrl });
        } catch {}
      }
    }
  }
  return results;
}
async function tryExtractAllFromSitemapAndDCAT(uri) {
  const results = [];
  let urlObj;
  try {
    urlObj = new URL(uri);
  } catch {
    return results;
  }
  const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
  let robotsText;
  try {
    const res = await fetchWithRedirect(robotsUrl);
    if (!res.ok)
      return results;
    robotsText = await res.text();
  } catch {
    return results;
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
    let xmlDoc;
    try {
      xmlDoc = new DOMParser().parseFromString(sText, "text/xml");
      if (xmlDoc.getElementsByTagName("parsererror").length > 0)
        continue;
    } catch {
      continue;
    }
    const urlElements = xmlDoc.getElementsByTagName("url");
    for (const urlEl of urlElements) {
      const locEl = urlEl.getElementsByTagName("loc")[0];
      if (!locEl)
        continue;
      const loc = locEl.textContent?.trim();
      if (loc === uri || loc === uri + "/" || uri === loc + "/") {
        const xhtmlNs = "http://www.w3.org/1999/xhtml";
        const xLinks = urlEl.getElementsByTagNameNS(xhtmlNs, "link");
        for (const xLink of xLinks) {
          const rel = xLink.getAttribute("rel");
          const type = xLink.getAttribute("type");
          const href = xLink.getAttribute("href");
          if (rel === "describedby" && href && (!type || isRDFMime(type))) {
            const metaUrl = new URL(href, sitemapUrl).toString();
            try {
              const metaRes = await fetchRDF(metaUrl);
              const metaCt = baseMime(metaRes.headers.get("content-type"));
              if (isRDFMime(metaCt) && metaRes.ok) {
                results.push({
                  content: await metaRes.text(),
                  format: metaCt,
                  source: "sitemap-signposting",
                  url: metaUrl
                });
              }
            } catch {}
          }
        }
      }
    }
  }
  return results;
}
async function extractAllRDF(uri) {
  const found = [];
  const notFound = [];
  const contentNegotiations = [];
  let bodyText = "";
  let linkHeader = null;
  try {
    const discRes = await fetchRDF(uri);
    linkHeader = discRes.headers.get("link");
    const discCt = baseMime(discRes.headers.get("content-type"));
    if (!isRDFMime(discCt) || !discRes.ok) {
      try {
        bodyText = await discRes.text();
      } catch {
        bodyText = "";
      }
    } else {
      try {
        await discRes.text();
      } catch {}
    }
  } catch {}
  const MIME_ORDER = [
    "text/turtle",
    "application/ld+json",
    "application/rdf+xml",
    "application/n-triples",
    "text/n3",
    "application/n-quads",
    "application/trig"
  ];
  let cnFound = false;
  for (const mime of MIME_ORDER) {
    try {
      const cnRes = await fetchWithRedirect(uri, { headers: { Accept: mime } });
      const cnCt = baseMime(cnRes.headers.get("content-type"));
      const cnBody = await cnRes.text();
      const isRdf = cnRes.ok && isRDFMime(cnCt);
      contentNegotiations.push({
        requestedMime: mime,
        responseMime: cnCt || "(unknown)",
        chars: cnBody.length,
        isRdf,
        url: cnRes.url || uri
      });
      if (isRdf) {
        const isDup = found.some((f) => f.source === "content-negotiation" && f.format === cnCt);
        if (!isDup) {
          found.push({ content: cnBody, format: cnCt, source: "content-negotiation", url: uri });
          cnFound = true;
        }
      }
    } catch {}
  }
  if (!cnFound)
    notFound.push("content-negotiation");
  if (!bodyText) {
    const { body: fallbackBody, linkHeader: fallbackLink } = await fetchHtmlFallback(uri);
    if (fallbackBody) {
      bodyText = fallbackBody;
      if (!linkHeader)
        linkHeader = fallbackLink;
    }
  }
  const htmlHints = bodyText ? extractHtmlHints(bodyText) : { describedByLinks: [], linksets: [], embeddedScripts: [] };
  let htmlDoc = null;
  if (bodyText) {
    try {
      if (typeof DOMParser !== "undefined") {
        htmlDoc = new DOMParser().parseFromString(bodyText, "text/html");
      }
    } catch {}
  }
  const links = parseLinkHeader(linkHeader);
  const headerDescribedBy = links.filter((l) => l["rel"] === "describedby" && (!l["type"] || isRDFMime(l["type"])));
  const profileLinks = links.filter((l) => l["rel"] === "profile");
  const headerDescribedByAll = [
    ...headerDescribedBy,
    ...profileLinks.filter((pl) => !pl["type"] || isRDFMime(pl["type"]))
  ];
  let headerDescribedByFound = false;
  for (const link of headerDescribedByAll) {
    const metaUrl = new URL(link["url"], uri).toString();
    try {
      const metaRes = await fetchRDF(metaUrl);
      const metaCt = baseMime(metaRes.headers.get("content-type"));
      if (isRDFMime(metaCt) && metaRes.ok) {
        found.push({ content: await metaRes.text(), format: metaCt, source: "signposting-link-header", url: metaUrl });
        headerDescribedByFound = true;
      }
    } catch {}
  }
  if (!headerDescribedByFound)
    notFound.push("signposting-link-header");
  const headerLinksets = links.filter((l) => l["rel"] === "linkset");
  const headerLinksetNorms = new Set(headerLinksets.map((ls) => normUri(new URL(ls["url"], uri).toString())));
  const profileLinksetLinks = profileLinks.filter((pl) => pl["type"] && isLinksetMime(pl["type"]) && !headerLinksetNorms.has(normUri(new URL(pl["url"], uri).toString())));
  const allLinksetHeaderLinks = [...headerLinksets, ...profileLinksetLinks];
  let headerLinksetFound = false;
  for (const ls of allLinksetHeaderLinks) {
    const lsUrl = new URL(ls["url"], uri).toString();
    const hits = await tryExtractAllFromLinkset(lsUrl, uri);
    if (hits.length > 0) {
      found.push(...hits);
      headerLinksetFound = true;
    }
  }
  const headerLinksetUriNorms = new Set(allLinksetHeaderLinks.map((ls) => normUri(new URL(ls["url"], uri).toString())));
  if (!headerLinksetUriNorms.has(normUri(uri))) {
    const connegHits = await tryExtractAllFromLinkset(uri, uri);
    if (connegHits.length > 0) {
      found.push(...connegHits);
      headerLinksetFound = true;
    }
  }
  if (!headerLinksetFound)
    notFound.push("linkset");
  const htmlDescribedBy = new Map;
  const htmlLinksets = new Set;
  const htmlScripts = [];
  if (htmlDoc) {
    for (const el of htmlDoc.querySelectorAll("link")) {
      const rel = el.getAttribute("rel");
      const href = el.getAttribute("href");
      const type = el.getAttribute("type");
      if (!href)
        continue;
      if (relHasToken(rel, "describedby"))
        htmlDescribedBy.set(href, type);
      if (relHasToken(rel, "linkset"))
        htmlLinksets.add(href);
    }
    for (const script of htmlDoc.querySelectorAll("script[type]")) {
      const type = script.getAttribute("type")?.toLowerCase() ?? "";
      const content = script.textContent?.trim() ?? "";
      if (type && content)
        htmlScripts.push({ type, content });
    }
  }
  for (const link of htmlHints.describedByLinks)
    htmlDescribedBy.set(link.href, link.type);
  for (const linkset of htmlHints.linksets)
    htmlLinksets.add(linkset);
  htmlScripts.push(...htmlHints.embeddedScripts);
  let htmlDescribedByFound = false;
  for (const [href, type] of htmlDescribedBy) {
    if (!type || isRDFMime(type)) {
      const metaUrl = new URL(href, uri).toString();
      try {
        const metaRes = await fetchRDF(metaUrl);
        const metaCt = baseMime(metaRes.headers.get("content-type"));
        if (isRDFMime(metaCt) && metaRes.ok) {
          found.push({ content: await metaRes.text(), format: metaCt, source: "signposting-html-link", url: metaUrl });
          htmlDescribedByFound = true;
        }
      } catch {}
    }
  }
  if (!htmlDescribedByFound)
    notFound.push("signposting-html-link");
  const headerLinksetUrls = new Set(allLinksetHeaderLinks.map((ls) => new URL(ls["url"], uri).toString()));
  headerLinksetUrls.add(uri);
  let htmlLinksetFound = false;
  for (const href of htmlLinksets) {
    const lsUrl = new URL(href, uri).toString();
    if (headerLinksetUrls.has(lsUrl))
      continue;
    const hits = await tryExtractAllFromLinkset(lsUrl, uri);
    if (hits.length > 0) {
      found.push(...hits);
      htmlLinksetFound = true;
    }
  }
  if (!headerLinksetFound && !htmlLinksetFound && notFound.includes("linkset")) {} else if (!headerLinksetFound && htmlLinksetFound) {
    const idx = notFound.indexOf("linkset");
    if (idx !== -1)
      notFound.splice(idx, 1);
  }
  let embeddedFound = false;
  for (const script of htmlScripts) {
    const type = script.type.toLowerCase();
    if (isRDFMime(type)) {
      found.push({ content: script.content, format: type, source: "embedded-script", url: uri });
      embeddedFound = true;
    }
  }
  if (!embeddedFound)
    notFound.push("embedded-script");
  const sitemapHits = await tryExtractAllFromSitemapAndDCAT(uri);
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
      label: STRATEGY_LABELS[source],
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
async function extractRDF(uri) {
  let res;
  try {
    res = await fetchRDF(uri);
  } catch {
    console.error(`Error fetching URI ${uri}`);
  }
  if (res) {
    try {
      let ct = baseMime(res.headers.get("content-type"));
      if (isRDFMime(ct) && res.ok) {
        return {
          content: await res.text(),
          format: ct,
          source: "content-negotiation",
          url: uri
        };
      }
    } catch {
      console.error(`Error reading body for URI ${uri}`);
    }
  }
  let bodyText = "";
  if (res) {
    try {
      bodyText = await res.text();
    } catch {
      bodyText = "";
    }
  }
  let linkHeader = res ? res.headers.get("link") : null;
  if (!bodyText) {
    const { body: fallbackBody, linkHeader: fallbackLink } = await fetchHtmlFallback(uri);
    if (fallbackBody) {
      bodyText = fallbackBody;
      if (!linkHeader)
        linkHeader = fallbackLink;
    }
  }
  let htmlDoc = null;
  if (bodyText) {
    try {
      if (typeof DOMParser !== "undefined") {
        htmlDoc = new DOMParser().parseFromString(bodyText, "text/html");
      }
    } catch {}
  }
  const htmlHints = bodyText ? extractHtmlHints(bodyText) : { describedByLinks: [], linksets: [], embeddedScripts: [] };
  const links = parseLinkHeader(linkHeader);
  const describedByFromHeader = links.filter((l) => l["rel"] === "describedby" && (!l["type"] || isRDFMime(l["type"])));
  for (const link of describedByFromHeader) {
    const metaUrl = new URL(link["url"], uri).toString();
    try {
      const metaRes = await fetchRDF(metaUrl);
      const metaCt = baseMime(metaRes.headers.get("content-type"));
      if (isRDFMime(metaCt) && metaRes.ok) {
        return {
          content: await metaRes.text(),
          format: metaCt,
          source: "signposting-link-header",
          url: metaUrl
        };
      }
    } catch {}
  }
  const linksetFromHeader = links.filter((l) => l["rel"] === "linkset");
  const profileLinks = links.filter((l) => l["rel"] === "profile");
  const profileLinksetLinks = profileLinks.filter((pl) => pl["type"] && isLinksetMime(pl["type"]));
  const linksetFromHeaderNorms = new Set(linksetFromHeader.map((ls) => normUri(new URL(ls["url"], uri).toString())));
  const allLinksetLinks = [
    ...linksetFromHeader,
    ...profileLinksetLinks.filter((pl) => !linksetFromHeaderNorms.has(normUri(new URL(pl["url"], uri).toString())))
  ];
  for (const ls of allLinksetLinks) {
    const lsUrl = new URL(ls["url"], uri).toString();
    const rdf = await tryExtractFromLinkset(lsUrl, uri);
    if (rdf)
      return rdf;
  }
  const profileDescribedBy = profileLinks.filter((pl) => !pl["type"] || isRDFMime(pl["type"]));
  for (const pl of profileDescribedBy) {
    const profileUrl = new URL(pl["url"], uri).toString();
    try {
      const metaRes = await fetchRDF(profileUrl);
      const metaCt = baseMime(metaRes.headers.get("content-type"));
      if (isRDFMime(metaCt) && metaRes.ok) {
        return {
          content: await metaRes.text(),
          format: metaCt,
          source: "signposting-link-header",
          url: profileUrl
        };
      }
    } catch {}
  }
  const triedLinksetNorms = new Set(allLinksetLinks.map((ls) => normUri(new URL(ls["url"], uri).toString())));
  if (!triedLinksetNorms.has(normUri(uri))) {
    const connegLinkset = await tryExtractFromLinkset(uri, uri);
    if (connegLinkset)
      return connegLinkset;
  }
  const htmlDescribedBy = new Map;
  const htmlLinksets = new Set;
  const htmlScripts = [];
  if (htmlDoc) {
    for (const el of htmlDoc.querySelectorAll("link")) {
      const rel = el.getAttribute("rel");
      const href = el.getAttribute("href");
      const type = el.getAttribute("type");
      if (!href)
        continue;
      if (relHasToken(rel, "describedby")) {
        htmlDescribedBy.set(href, type);
      }
      if (relHasToken(rel, "linkset")) {
        htmlLinksets.add(href);
      }
    }
    for (const script of htmlDoc.querySelectorAll("script[type]")) {
      const type = script.getAttribute("type")?.toLowerCase() ?? "";
      const content = script.textContent?.trim() ?? "";
      if (type && content) {
        htmlScripts.push({ type, content });
      }
    }
  }
  for (const link of htmlHints.describedByLinks) {
    htmlDescribedBy.set(link.href, link.type);
  }
  for (const linkset of htmlHints.linksets) {
    htmlLinksets.add(linkset);
  }
  htmlScripts.push(...htmlHints.embeddedScripts);
  for (const [href, type] of htmlDescribedBy) {
    if (!type || isRDFMime(type)) {
      const metaUrl = new URL(href, uri).toString();
      let metaRes;
      try {
        metaRes = await fetchRDF(metaUrl);
      } catch {
        for (const script of htmlScripts) {
          const scriptType = script.type.toLowerCase();
          if (isRDFMime(scriptType)) {
            return {
              content: script.content,
              format: scriptType,
              source: "embedded-script",
              url: uri
            };
          }
        }
        continue;
      }
      const metaCt = baseMime(metaRes.headers.get("content-type"));
      if (isRDFMime(metaCt) && metaRes.ok) {
        return {
          content: await metaRes.text(),
          format: metaCt,
          source: "signposting-html-link",
          url: metaUrl
        };
      }
    }
  }
  for (const href of htmlLinksets) {
    const lsUrl = new URL(href, uri).toString();
    const rdf = await tryExtractFromLinkset(lsUrl, uri);
    if (rdf)
      return rdf;
  }
  for (const script of htmlScripts) {
    const type = script.type.toLowerCase();
    if (isRDFMime(type)) {
      return {
        content: script.content,
        format: type,
        source: "embedded-script",
        url: uri
      };
    }
  }
  const sitemapRDF = await tryExtractFromSitemapAndDCAT(uri);
  if (sitemapRDF)
    return sitemapRDF;
  return null;
}
async function runWrxCli(args = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid CLI arguments.";
    console.error(message);
    console.error("Usage: bun run wrx.js [--all] [--profile] [--extend-links] <URI>");
    process.exit(1);
  }
  const { allMode, profileMode, extendLinksMode, url } = parsed;
  if (!url) {
    console.error("Usage: bun run wrx.js [--all] [--profile] [--extend-links] <URI>");
    process.exit(1);
  }
  let harvestedOverview = null;
  if (allMode) {
    console.log(`\uD83D\uDD0D Exploring all RDF paths for: ${url}
`);
    const overview = await extractAllRDF(url);
    harvestedOverview = overview;
    const bySource = new Map;
    for (const entry of overview.found) {
      const key = entry.source;
      if (!bySource.has(key))
        bySource.set(key, []);
      bySource.get(key).push(entry);
    }
    let stratNum = 0;
    for (const source of STRATEGY_ORDER) {
      stratNum++;
      const label = STRATEGY_LABELS[source];
      const hits = bySource.get(source) ?? [];
      if (source === "content-negotiation") {
        const rdfHits = overview.contentNegotiations.filter((r) => r.isRdf);
        if (rdfHits.length > 0) {
          console.log(`  \u2705 Strategy ${stratNum} \u2014 ${label} (${rdfHits.length} RDF format(s) found)`);
        } else {
          console.log(`  \u274C Strategy ${stratNum} \u2014 ${label}`);
        }
        const reqW = overview.contentNegotiations.length > 0 ? Math.max(...overview.contentNegotiations.map((r) => r.requestedMime.length), "Requested MIME".length) : "Requested MIME".length;
        const resW = overview.contentNegotiations.length > 0 ? Math.max(...overview.contentNegotiations.map((r) => r.responseMime.length), "Response MIME".length) : "Response MIME".length;
        console.log(`       ${"Requested MIME".padEnd(reqW)}  \u2192  ${"Response MIME".padEnd(resW)}  Chars`);
        console.log(`       ${"\u2500".repeat(reqW)}     ${"\u2500".repeat(resW)}  \u2500\u2500\u2500\u2500\u2500`);
        for (const cn of overview.contentNegotiations) {
          const flag = cn.isRdf ? "\u2705" : "\u274C";
          console.log(`       ${cn.requestedMime.padEnd(reqW)}  \u2192  ${cn.responseMime.padEnd(resW)}  ${cn.chars.toLocaleString().padStart(7)}  ${flag}`);
        }
      } else if (hits.length > 0) {
        console.log(`  \u2705 Strategy ${stratNum} \u2014 ${label}`);
        for (const hit of hits) {
          console.log(`       ${hit.format}  ${hit.url}  (${hit.content.length} chars)`);
        }
      } else {
        console.log(`  \u274C Strategy ${stratNum} \u2014 ${label}`);
      }
    }
    console.log("");
    if (overview.contentNegotiations.length > 0) {
      console.log("\uD83D\uDCCB Content Negotiation Overview (all MIME types):");
      for (const cn of overview.contentNegotiations) {
        const flag = cn.isRdf ? "\u2705 RDF" : "\u274C not RDF";
        console.log(`   ${cn.requestedMime.padEnd(26)} \u2192 ${cn.chars.toLocaleString().padStart(7)} chars  (${cn.responseMime})  ${flag}`);
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
    const shouldRunFullHarvest = profileMode;
    const result = shouldRunFullHarvest ? (harvestedOverview = await extractAllRDF(url), harvestedOverview.found[0] ?? null) : await extractRDF(url);
    if (result) {
      console.log(`\u2705 Found RDF (${result.source}) from ${result.url}`);
      console.log(`Format: ${result.format}`);
      console.log(`Content length: ${result.content.length} chars`);
      console.log(`
--- First 500 chars of RDF ---`);
      console.log(result.content.slice(0, 500) + (result.content.length > 500 ? "..." : ""));
    } else {
      console.log("\u274C No RDF found after trying all strategies.");
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
    const harvestCount = harvestedOverview ? harvestedOverview.found.length : 0;
    console.log("");
    console.log(`\uD83E\uDDEA --profile placeholder: harvested ${harvestCount} RDF source(s).`);
    console.log("TODO: profile discovery step is reserved and intentionally not implemented yet.");
  }
}
if (import.meta.main) {
  await runWrxCli();
}
export {
  runWrxCli,
  extractRDF,
  extractAllRDF
};
