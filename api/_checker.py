"""
AI Visibility Checker - crawling and scoring logic.

Scoring follows the AES framework:
  AI Citation Rate 30% | Content Structure 20% | Authority Signals 20%
  Content Freshness 10% | Technical Crawlability 10% | Answer-Ready Content 10%
Each factor is scored 0-100. Factors that haven't been measured yet are left out
and the remaining weights are re-scaled, and the result is flagged "provisional".
"""

import json
import re
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

WEIGHTS = {
    "AI Citation Rate": 30,
    "Content Structure": 20,
    "Authority Signals": 20,
    "Content Freshness": 10,
    "Technical Crawlability": 10,
    "Answer-Ready Content": 10,
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 AES-AIVisibilityChecker/1.0"
    ),
    "Accept-Language": "en;q=0.9",
}
TIMEOUT = 15

# Bots that fetch pages to answer live questions (these decide whether you can be cited)
SEARCH_BOTS = {
    "OAI-SearchBot": "ChatGPT search results",
    "ChatGPT-User": "ChatGPT opening a link for a user",
    "PerplexityBot": "Perplexity answers",
    "Claude-SearchBot": "Claude web search",
    "Googlebot": "Google Search + AI Overviews + Gemini grounding",
    "Bingbot": "Bing + Copilot (and feeds ChatGPT search)",
}
# Bots that collect training data (blocking these is a business choice, not an error)
TRAINING_BOTS = {
    "GPTBot": "OpenAI model training",
    "ClaudeBot": "Anthropic model training",
    "Google-Extended": "Gemini training (does NOT affect AI Overviews)",
    "CCBot": "Common Crawl (used by many AI models)",
}

SKIP_EXT = re.compile(r"\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?|pptx?|xml)$", re.I)
SKIP_PATH = re.compile(r"/(tag|tags|category|author|page|feed|wp-json|cart|checkout|login|wp-admin)/", re.I)
STAT_RE = re.compile(
    r"(?:[$€£₹]\s?\d[\d,.]*\s?(?:k|m|bn|million|billion|crore|lakh)?"
    r"|\b\d[\d,.]*\s?(?:%|percent|\+|x\b|million|billion|crore|lakh|years?|months?|clients|customers"
    r"|projects|countries|users|employees|hours|days|people|companies|businesses))",
    re.I,
)


# ---------------------------------------------------------------- helpers
def normalize_domain(raw):
    raw = raw.strip()
    if not raw:
        raise ValueError("Enter a website address.")
    if not re.match(r"^https?://", raw, re.I):
        raw = "https://" + raw
    p = urlparse(raw)
    if not p.netloc or "." not in p.netloc:
        raise ValueError(f"'{raw}' doesn't look like a website address.")
    return f"{p.scheme}://{p.netloc}"


def fetch(url, session):
    start = time.time()
    try:
        r = session.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
        return r, time.time() - start
    except requests.RequestException:
        return None, time.time() - start


def parse_date(value):
    if not value:
        return None
    try:
        d = dateparser.parse(str(value))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        if d.year < 1995 or d > datetime.now(timezone.utc).replace(year=datetime.now().year + 1):
            return None
        return d
    except (ValueError, OverflowError, TypeError):
        return None


def same_site(url, host):
    h = urlparse(url).netloc.lower()
    host = host.lower()
    return h == host or h.replace("www.", "") == host.replace("www.", "")


# ---------------------------------------------------------------- site-level checks
def check_robots(base, session):
    r, _ = fetch(base + "/robots.txt", session)
    result = {"found": False, "sitemaps": [], "bots": {}}
    rp = RobotFileParser()
    if r is not None and r.status_code == 200 and "html" not in r.headers.get("Content-Type", ""):
        result["found"] = True
        lines = r.text.splitlines()
        rp.parse(lines)
        result["sitemaps"] = [l.split(":", 1)[1].strip() for l in lines if l.lower().startswith("sitemap:")]
    else:
        rp.parse([])  # no robots.txt = everything allowed
    for bot, purpose in {**SEARCH_BOTS, **TRAINING_BOTS}.items():
        result["bots"][bot] = {
            "allowed": rp.can_fetch(bot, base + "/"),
            "purpose": purpose,
            "type": "Search / answers" if bot in SEARCH_BOTS else "Training",
        }
    return result


def get_sitemap(base, robots_sitemaps, session):
    candidates = list(dict.fromkeys(robots_sitemaps + [base + "/sitemap.xml", base + "/sitemap_index.xml", base + "/wp-sitemap.xml"]))
    entries, found_at = [], None
    for sm in candidates:
        r, _ = fetch(sm, session)
        if r is None or r.status_code != 200 or "<" not in r.text[:500]:
            continue
        soup = BeautifulSoup(r.content, "xml")
        if soup.find("sitemapindex"):
            children = [l.get_text(strip=True) for l in soup.find_all("loc")]
            children.sort(key=lambda u: (0 if re.search(r"post|page|article|blog|service", u, re.I) else 1))
            for child in children[:6]:
                cr, _ = fetch(child, session)
                if cr is not None and cr.status_code == 200:
                    entries += _parse_urlset(BeautifulSoup(cr.content, "xml"))
        else:
            entries += _parse_urlset(soup)
        if entries:
            found_at = sm
            break
    return {"found": bool(entries), "url": found_at, "entries": entries[:3000]}


def _parse_urlset(soup):
    out = []
    for u in soup.find_all("url"):
        loc = u.find("loc")
        lm = u.find("lastmod")
        if loc:
            out.append({"url": loc.get_text(strip=True), "lastmod": parse_date(lm.get_text(strip=True)) if lm else None})
    return out


def check_llms_txt(base, session):
    r, _ = fetch(base + "/llms.txt", session)
    return r is not None and r.status_code == 200 and "html" not in r.headers.get("Content-Type", "").lower()


def check_wikipedia(brand, domain_host, session):
    """Does Wikipedia have an article for the brand, and do any articles link to the site?"""
    api = "https://en.wikipedia.org/w/api.php"
    out = {"article": None, "links_to_site": 0, "checked": False}
    try:
        r = session.get(api, params={"action": "query", "list": "search", "srsearch": f'intitle:"{brand}"',
                                     "srlimit": 5, "format": "json"}, headers=HEADERS, timeout=TIMEOUT)
        nb = re.sub(r"[^a-z0-9]", "", brand.lower())
        for hit in r.json().get("query", {}).get("search", []):
            nt = re.sub(r"[^a-z0-9]", "", re.sub(r"\(.*?\)", "", hit["title"]).lower())
            if nb and (nt == nb or (len(nb) > 4 and nt.startswith(nb))):
                out["article"] = "https://en.wikipedia.org/wiki/" + hit["title"].replace(" ", "_")
                break
        host = domain_host.replace("www.", "")
        total = 0
        for proto in ("https", "http"):
            r = session.get(api, params={"action": "query", "list": "exturlusage", "euquery": host,
                                         "euprotocol": proto, "eunamespace": 0, "eulimit": 50, "format": "json"},
                            headers=HEADERS, timeout=TIMEOUT)
            total += len(r.json().get("query", {}).get("exturlusage", []))
        out["links_to_site"] = total
        out["checked"] = True
    except Exception:
        pass
    return out


# ---------------------------------------------------------------- page analysis
def analyze_page(url, session):
    r, elapsed = fetch(url, session)
    page = {"url": url, "ok": False, "load_time": round(elapsed, 2)}
    if r is None:
        page["error"] = "No response (timeout or blocked)"
        return page
    page["status"] = r.status_code
    page["final_url"] = r.url
    if r.status_code != 200 or "html" not in r.headers.get("Content-Type", "html").lower():
        page["error"] = f"HTTP {r.status_code}"
        return page
    page["ok"] = True
    soup = BeautifulSoup(r.content, "lxml")

    # Structured data (read before stripping scripts)
    schema_types, schema_dates, same_as, org_names = set(), [], [], []
    for tag in soup.find_all("script", type=re.compile("ld\\+json", re.I)):
        try:
            data = json.loads(tag.string or tag.get_text() or "")
        except (json.JSONDecodeError, TypeError):
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
                continue
            if not isinstance(node, dict):
                continue
            t = node.get("@type")
            types = t if isinstance(t, list) else [t] if t else []
            schema_types.update(str(x) for x in types)
            for k in ("dateModified", "datePublished"):
                d = parse_date(node.get(k))
                if d:
                    schema_dates.append(d)
            if any(x in ("Organization", "LocalBusiness", "Corporation", "ProfessionalService") for x in types):
                sa = node.get("sameAs") or []
                same_as += sa if isinstance(sa, list) else [sa]
                if node.get("name"):
                    org_names.append(str(node["name"]))
            for v in node.values():
                if isinstance(v, (dict, list)):
                    stack.append(v)
    for el in soup.find_all(attrs={"itemtype": True}):
        schema_types.add(el["itemtype"].rstrip("/").split("/")[-1])

    def meta(**kw):
        m = soup.find("meta", attrs=kw)
        return m.get("content", "").strip() if m else ""

    page["title"] = soup.title.get_text(strip=True) if soup.title else ""
    page["meta_description"] = meta(name="description")
    page["site_name"] = meta(property="og:site_name")
    page["canonical"] = bool(soup.find("link", rel="canonical"))
    page["lang"] = bool(soup.html and soup.html.get("lang"))
    script_count = len(soup.find_all("script"))

    meta_dates = [parse_date(meta(property=p)) for p in ("article:modified_time", "article:published_time", "og:updated_time")]
    time_dates = [parse_date(t.get("datetime")) for t in soup.find_all("time") if t.get("datetime")]
    header_date = parse_date(r.headers.get("Last-Modified"))
    all_dates = [d for d in schema_dates + meta_dates + time_dates if d]
    page["content_date"] = max(all_dates) if all_dates else None
    page["header_date"] = header_date

    for t in soup(["script", "style", "noscript", "svg", "template", "iframe"]):
        t.decompose()
    headings = {f"h{i}": [h.get_text(" ", strip=True) for h in soup.find_all(f"h{i}")] for i in range(1, 4)}
    page["h1_count"] = len(headings["h1"])
    page["h1"] = headings["h1"][0] if headings["h1"] else ""
    page["h2"] = headings["h2"][:12]
    page["subheading_count"] = len(headings["h2"]) + len(headings["h3"])
    all_heads = headings["h1"] + headings["h2"] + headings["h3"]
    q_words = r"^(what|how|why|when|where|which|who|can|does|do|is|are|should|will)\b"
    page["question_headings"] = sum(1 for h in all_heads if h.endswith("?") or re.match(q_words, h, re.I))
    page["has_faq_section"] = "FAQPage" in schema_types or any(
        re.search(r"\bfaq|frequently asked|common questions", h, re.I) for h in all_heads)
    page["lists_tables"] = bool(soup.find(["table", "ol"]) or soup.select("main ul, article ul, section ul"))

    main = soup.find("main") or soup.find("article") or soup.body or soup
    for t in main.find_all(["nav", "footer", "header", "aside", "form"]):
        t.decompose()
    text = main.get_text(" ", strip=True)
    words = text.split()
    page["word_count"] = len(words)
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text) if len(s.split()) >= 4]
    page["avg_sentence_len"] = round(sum(len(s.split()) for s in sentences) / len(sentences), 1) if sentences else 0
    page["stat_count"] = len(STAT_RE.findall(text))
    first_p = next((p.get_text(" ", strip=True) for p in main.find_all("p") if len(p.get_text(" ", strip=True).split()) >= 8), "")
    page["first_para_words"] = len(first_p.split())
    page["js_dependent"] = page["word_count"] < 120 and script_count >= 5
    page["schema_types"] = sorted(t for t in schema_types if t and t != "None")
    page["same_as"] = [s for s in same_as if isinstance(s, str)]
    page["org_names"] = org_names
    return page


def choose_pages(base, host, sitemap_entries, homepage_links, n):
    pool = [e["url"] for e in sitemap_entries] or homepage_links
    pool = [u.split("#")[0] for u in pool if same_site(u, host) and not SKIP_EXT.search(u) and not SKIP_PATH.search(u + "/")]
    pool = [u for u in dict.fromkeys(pool) if u.rstrip("/") != base.rstrip("/")]
    groups = defaultdict(list)
    for u in pool:
        seg = urlparse(u).path.strip("/").split("/")[0] or "_root"
        groups[seg].append(u)
    picked, buckets = [], list(groups.values())
    while len(picked) < n - 1 and any(buckets):
        for b in buckets:
            if b and len(picked) < n - 1:
                picked.append(b.pop(0))
    return [base + "/"] + picked


# ---------------------------------------------------------------- findings helper
def finding(factor, status, check, detail, fix="", priority="Medium"):
    return {"factor": factor, "status": status, "check": check, "detail": detail, "fix": fix, "priority": priority}


def pct(pages, cond):
    return sum(1 for p in pages if cond(p)) / len(pages) if pages else 0


def examples(pages, cond, k=3):
    return [p["url"] for p in pages if cond(p)][:k]


# ---------------------------------------------------------------- factor scoring
def score_crawlability(site, pages):
    F, out, s = "Technical Crawlability", [], 0
    bots = site["robots"]["bots"]
    search_ok = [b for b in SEARCH_BOTS if bots[b]["allowed"]]
    s += 50 * len(search_ok) / len(SEARCH_BOTS)
    blocked = [b for b in SEARCH_BOTS if not bots[b]["allowed"]]
    if blocked:
        out.append(finding(F, "fail", "AI search bots blocked",
                           f"robots.txt blocks: {', '.join(blocked)}. These bots fetch pages to answer questions, so a block means the site can't be cited there.",
                           "Remove the Disallow rules for these user-agents in robots.txt (ask whoever manages the site or the SEO plugin).", "High"))
    else:
        out.append(finding(F, "pass", "AI search bots allowed", "All major AI search/answer bots can reach the homepage."))
    train_ok = [b for b in TRAINING_BOTS if bots[b]["allowed"]]
    s += 10 * len(train_ok) / len(TRAINING_BOTS)
    tb = [b for b in TRAINING_BOTS if not bots[b]["allowed"]]
    if tb:
        out.append(finding(F, "warn", "Training bots blocked",
                           f"Blocked: {', '.join(tb)}. This stops your content shaping what models 'know' about the brand long-term. Not an error; it's a business choice.",
                           "Decide deliberately with the client. If brand awareness in AI answers matters more than content protection, allow them.", "Low"))
    if site["sitemap"]["found"]:
        s += 10
        out.append(finding(F, "pass", "XML sitemap found", f"{len(site['sitemap']['entries'])} URLs at {site['sitemap']['url']}"))
    else:
        out.append(finding(F, "fail", "No XML sitemap found", "Checked robots.txt, /sitemap.xml, /sitemap_index.xml and /wp-sitemap.xml.",
                           "Generate a sitemap (Yoast/RankMath do this automatically) and list it in robots.txt.", "Medium"))
    js_share = pct(pages, lambda p: p["js_dependent"])
    s += 20 * (1 - js_share)
    if js_share > 0:
        out.append(finding(F, "fail", "Content needs JavaScript to appear",
                           f"{js_share:.0%} of pages show almost no text in the raw HTML. Most AI crawlers don't run JavaScript, so they see an empty page. E.g. {', '.join(examples(pages, lambda p: p['js_dependent']))}",
                           "Ask the developer to enable server-side rendering or pre-rendering so the text is in the HTML.", "High"))
    else:
        out.append(finding(F, "pass", "Content readable without JavaScript", "Page text is present in the raw HTML."))
    avg_t = sum(p["load_time"] for p in pages) / len(pages) if pages else 9
    s += 10 if avg_t < 1 else 6 if avg_t < 2.5 else 2
    if avg_t >= 2.5:
        out.append(finding(F, "warn", "Slow server response", f"Average HTML response {avg_t:.1f}s. AI fetchers have tight timeouts.",
                           "Look at caching/CDN and hosting. Aim for under 1 second for the HTML.", "Medium"))
    if not site["base"].startswith("https"):
        out.append(finding(F, "fail", "Not on HTTPS", "The site resolves over plain HTTP.", "Install an SSL certificate and redirect HTTP to HTTPS.", "High"))
    out.append(finding(F, "pass" if site["llms_txt"] else "info", "llms.txt file",
                       "Found /llms.txt." if site["llms_txt"] else "No /llms.txt. Informational only: no major AI platform has confirmed it uses this file, so it isn't scored.",
                       "" if site["llms_txt"] else "Optional, low effort. Don't prioritise it over the items above.", "Low"))
    return round(s), out


def score_structure(site, pages):
    F, out = "Content Structure", []
    per = []
    for p in pages:
        v = 0
        v += 10 if 25 <= len(p["title"]) <= 65 else 5 if p["title"] else 0
        v += 10 if p["meta_description"] else 0
        v += 15 if p["h1_count"] == 1 else 7 if p["h1_count"] > 1 else 0
        v += 15 if p["subheading_count"] >= 3 else 7 if p["subheading_count"] else 0
        v += 10 if p["lists_tables"] else 0
        v += 20 if p["schema_types"] else 0
        v += 5 if p["canonical"] else 0
        v += 5 if p["lang"] else 0
        per.append(v)
    home = pages[0] if pages else {}
    org = any(t in home.get("schema_types", []) for t in ("Organization", "LocalBusiness", "Corporation", "ProfessionalService"))
    s = (sum(per) / len(per) if per else 0) + (10 if org else 0)

    def rule(cond, check, fix, prio, why):
        share = pct(pages, cond)
        if share > 0:
            out.append(finding(F, "fail" if share > 0.5 else "warn", check,
                               f"{share:.0%} of pages. {why} E.g. {', '.join(examples(pages, cond))}", fix, prio))
        return share

    rule(lambda p: not p["schema_types"], "No structured data (schema)",
         "Add JSON-LD schema matching each page type: Article/BlogPosting for posts, Service or Product for offer pages, FAQPage where there are Q&As.",
         "High", "Schema tells AI tools exactly what a page is about, who wrote it and when.")
    rule(lambda p: p["h1_count"] != 1, "Missing or multiple H1",
         "Give each page exactly one H1 that states the topic plainly.", "Medium", "A single clear H1 is the page's main 'claim'.")
    rule(lambda p: p["subheading_count"] < 3, "Thin heading structure",
         "Break content into sections with descriptive H2/H3s (ideally phrased the way people ask).", "Medium",
         "AI tools pull passages section by section; headings mark where answers start.")
    rule(lambda p: not p["meta_description"], "Missing meta description",
         "Write a 140-160 character summary per page.", "Low", "Often used as the page summary by AI and search.")
    rule(lambda p: not p["lists_tables"], "No lists or tables in content",
         "Use bullet lists, numbered steps and comparison tables where content suits it.", "Low",
         "Lists and tables are among the easiest formats for AI to extract and quote.")
    if org:
        out.append(finding(F, "pass", "Organization schema on homepage", "The brand entity is defined for AI and search engines."))
    else:
        out.append(finding(F, "fail", "No Organization schema on homepage",
                           "Without it, AI tools have to guess who the company is, what it does and which profiles belong to it.",
                           "Add Organization (or LocalBusiness) JSON-LD with name, logo, url, address, contact and sameAs links to LinkedIn, social profiles, Crunchbase, etc.", "High"))
    found = sorted({t for p in pages for t in p["schema_types"]})
    if found:
        out.append(finding(F, "info", "Schema types found", ", ".join(found[:20])))
    return round(min(s, 100)), out


def score_answer_ready(site, pages):
    F, out = "Answer-Ready Content", []
    content_pages = [p for p in pages if p["word_count"] >= 150] or pages
    per = []
    for p in content_pages:
        v = 0
        v += 20 if p["question_headings"] >= 2 else 10 if p["question_headings"] == 1 else 0
        v += 20 if 15 <= p["first_para_words"] <= 80 else 8 if p["first_para_words"] else 0
        v += 20 if p["stat_count"] >= 3 else 10 if p["stat_count"] else 0
        v += 15 if 0 < p["avg_sentence_len"] <= 22 else 7 if p["avg_sentence_len"] <= 28 else 0
        v += 10 if p["word_count"] >= 300 else 4
        per.append(v)
    has_faq = any(p["has_faq_section"] for p in pages)
    s = (sum(per) / len(per) if per else 0) + (15 if has_faq else 0)
    P = content_pages

    if not has_faq:
        out.append(finding(F, "fail", "No FAQ content found",
                           "None of the crawled pages has an FAQ section or FAQPage schema.",
                           "Add FAQ sections to key service pages using real customer questions (from sales calls, People Also Ask, support emails), with 2-4 sentence answers.", "High"))
    else:
        out.append(finding(F, "pass", "FAQ content present", f"Found on: {', '.join(examples(pages, lambda p: p['has_faq_section']))}"))
    for cond, check, why, fix, prio in [
        (lambda p: p["question_headings"] == 0, "No question-style headings",
         "AI prompts are questions; headings that mirror them get matched more easily.",
         "Rephrase some H2s as the questions buyers ask, e.g. 'How long does X take?' then answer directly underneath.", "Medium"),
        (lambda p: p["stat_count"] < 3, "Few quotable facts or numbers",
         "AI answers love specific, citable numbers (prices, timelines, results, counts).",
         "Add concrete stats: years in business, projects delivered, typical cost ranges, measured outcomes, with a source where relevant.", "High"),
        (lambda p: not (15 <= p["first_para_words"] <= 80), "No short, direct opening answer",
         "The first paragraph should answer the page's main question in a few sentences.",
         "Open each page with a 2-3 sentence summary answering 'what is this and who is it for' before any marketing copy.", "Medium"),
        (lambda p: p["avg_sentence_len"] > 25, "Long, complex sentences",
         "Long sentences are harder to lift out as a clean answer.",
         "Edit toward 15-20 words per sentence on key pages.", "Low"),
        (lambda p: p["word_count"] < 300, "Thin content",
         "Pages with little text give AI little to cite.",
         "Expand key pages with substance: process, pricing guidance, examples, FAQs.", "Medium"),
    ]:
        share = pct(P, cond)
        if share > 0.3:
            out.append(finding(F, "fail" if share > 0.6 else "warn", check,
                               f"{share:.0%} of content pages. {why} E.g. {', '.join(examples(P, cond))}", fix, prio))
    return round(min(s, 100)), out


def score_freshness(site, pages):
    F, out = "Content Freshness", []
    now = datetime.now(timezone.utc)
    candidates = [e["lastmod"] for e in site["sitemap"]["entries"] if e["lastmod"]]
    candidates += [p["content_date"] for p in pages if p.get("content_date")]
    candidates = [d for d in candidates if d <= now]
    dated_share = pct(pages, lambda p: p.get("content_date"))
    if not candidates:
        out.append(finding(F, "fail", "No update dates found",
                           "No dates in the sitemap, schema or page metadata, so AI tools can't tell if content is current.",
                           "Add dateModified to Article schema, show 'Last updated' on pages, and make sure the sitemap includes <lastmod>.", "High"))
        return 25, out
    newest = max(candidates)
    days = (now - newest).days
    recent_90 = sum(1 for d in candidates if (now - d).days <= 90) / len(candidates)
    base = 100 if days <= 30 else 85 if days <= 90 else 65 if days <= 180 else 40 if days <= 365 else 15
    s = base * 0.6 + recent_90 * 100 * 0.25 + dated_share * 100 * 0.15
    out.append(finding(F, "pass" if days <= 90 else "warn" if days <= 365 else "fail", "Most recent update",
                       f"Newest dated content: {newest:%d %b %Y} ({days} days ago). {recent_90:.0%} of dated URLs changed in the last 90 days.",
                       "" if days <= 90 else "Set a refresh schedule for top pages: update stats, examples and the year, then change dateModified.",
                       "Medium" if days > 90 else "Low"))
    if dated_share < 0.5:
        out.append(finding(F, "warn", "Pages don't show their date",
                           f"Only {dated_share:.0%} of crawled pages expose a published/modified date in schema or meta tags.",
                           "Add datePublished/dateModified to schema and a visible 'Last updated' line.", "Medium"))
    return round(min(s, 100)), out


def score_authority(site, pages, manual):
    F, out = "Authority Signals", []
    auto = 0
    wiki = site["wikipedia"]
    if wiki["checked"]:
        if wiki["article"]:
            auto += 40
            out.append(finding(F, "pass", "Wikipedia article", f"Found: {wiki['article']}"))
        else:
            out.append(finding(F, "info", "No Wikipedia article", f"None found for '{site['brand']}'. Normal for smaller companies; don't chase it artificially.",
                               "Focus on earned press and industry directories instead.", "Low"))
        links = wiki["links_to_site"]
        auto += 20 if links >= 5 else 10 if links else 0
        out.append(finding(F, "pass" if links else "info", "Wikipedia links to the site", f"{links} Wikipedia article link(s) point to this domain."))
    else:
        out.append(finding(F, "warn", "Wikipedia check failed", "Couldn't reach Wikipedia, so that part of Authority scored 0. Re-run the check.", "", "Low"))
    same_as = {s for p in pages for s in p["same_as"]}
    auto += 25 if len(same_as) >= 3 else 12 if same_as else 0
    if len(same_as) >= 3:
        out.append(finding(F, "pass", "Linked brand profiles", f"{len(same_as)} sameAs profiles in schema."))
    else:
        out.append(finding(F, "warn", "Few linked brand profiles",
                           f"{len(same_as)} sameAs profile(s) in schema. These help AI tools connect the site to the brand's mentions elsewhere.",
                           "Add sameAs links (LinkedIn, Crunchbase, G2/Clutch, YouTube, X, Facebook) to Organization schema.", "Medium"))
    auto += 15 if any(t in ("Person",) for p in pages for t in p["schema_types"]) else 0
    auto = min(auto, 100)

    dr, rd = manual.get("domain_rating"), manual.get("referring_domains")
    if dr is None and rd is None:
        out.append(finding(F, "info", "Backlink data not entered",
                           "Authority is based only on the automatic checks above. Enter Domain Rating and referring domains (Ahrefs/Semrush/Moz) in the sidebar for a full score.",
                           "", "Medium"))
        return round(auto), out, True
    import math
    parts = []
    if dr is not None:
        parts.append(dr)
    if rd is not None:
        parts.append(min(100, math.log10(rd + 1) / math.log10(5001) * 100))  # 5,000 RDs ~ 100
    link_score = sum(parts) / len(parts)
    if link_score < 30:
        out.append(finding(F, "fail", "Weak backlink profile", f"Link score {link_score:.0f}/100 from entered data.",
                           "Digital PR, industry directories, partner/supplier pages, guest contributions, and getting listed in 'best X' roundup articles (those are exactly what AI tools cite).", "High"))
    return round(link_score * 0.6 + auto * 0.4), out, False


# ---------------------------------------------------------------- citation rate
CITE_VALUES = {"Cited with link": 100, "Mentioned, no link": 60, "Not mentioned": 0}
PLATFORMS = ["ChatGPT", "Perplexity", "Google AI Overview", "Gemini", "Copilot", "Claude"]


def score_citations(rows):
    vals = []
    for row in rows:
        for p in PLATFORMS:
            v = row.get(p)
            if v in CITE_VALUES:
                vals.append(CITE_VALUES[v])
    if not vals:
        return None, 0
    return round(sum(vals) / len(vals)), len(vals)


def suggest_prompts(site):
    brand = site["brand"]
    home = site["pages"][0] if site["pages"] else {}
    topic = (home.get("h1") or home.get("title") or brand).split("|")[0].split(" - ")[0].strip()[:70]
    return [
        f"Who are the best providers of {topic.lower()}?",
        f"What should I look for when choosing a company for {topic.lower()}?",
        f"Recommend companies offering {topic.lower()} near me",
        f"What does {brand} do?",
        f"Is {brand} a good choice for {topic.lower()}? What are alternatives?",
    ]


# ---------------------------------------------------------------- orchestration
def crawl(domain, max_pages=10, progress=None):
    def step(msg, frac):
        if progress:
            progress(msg, frac)

    session = requests.Session()
    base = normalize_domain(domain)
    step("Opening homepage", 0.05)
    r, _ = fetch(base + "/", session)
    if r is None or r.status_code >= 400:
        if base.startswith("https://") and not urlparse(base).netloc.startswith("www."):
            alt = base.replace("https://", "https://www.")
            r2, _ = fetch(alt + "/", session)
            if r2 is not None and r2.status_code < 400:
                r, base = r2, alt
    if r is None:
        raise ConnectionError("Couldn't reach the site. Check the address, or the site may be blocking automated requests.")
    if r.status_code >= 400:
        raise ConnectionError(f"The homepage returned HTTP {r.status_code}. The site may be blocking automated requests (firewall/Cloudflare).")
    final = urlparse(r.url)
    base = f"{final.scheme}://{final.netloc}"
    host = final.netloc

    step("Reading robots.txt", 0.12)
    robots = check_robots(base, session)
    step("Reading sitemap", 0.2)
    sitemap = get_sitemap(base, robots["sitemaps"], session)
    llms = check_llms_txt(base, session)

    home_soup = BeautifulSoup(r.content, "lxml")
    home_links = [urljoin(r.url, a["href"]) for a in home_soup.find_all("a", href=True)]
    urls = choose_pages(base, host, sitemap["entries"], home_links, max_pages)

    pages, done = [], 0
    with ThreadPoolExecutor(max_workers=4) as ex:
        for p in ex.map(lambda u: analyze_page(u, session), urls):
            done += 1
            step(f"Analysing pages ({done}/{len(urls)})", 0.25 + 0.6 * done / len(urls))
            pages.append(p)
    ok_pages = [p for p in pages if p["ok"]]
    if not ok_pages:
        raise ConnectionError("No pages could be read. The site may be blocking automated requests.")

    home = ok_pages[0]
    brand = (home.get("org_names") or [None])[0] or home.get("site_name") or ""
    if not brand:
        parts = re.split(r"\s[|\-–—:]\s", home.get("title", ""))
        brand = parts[-1].strip() if len(parts) > 1 else host.replace("www.", "").split(".")[0].upper()
    step("Checking Wikipedia", 0.9)
    wiki = check_wikipedia(brand, host, session)
    step("Scoring", 0.97)
    return {
        "base": base, "host": host, "brand": brand, "robots": robots, "sitemap": sitemap,
        "llms_txt": llms, "wikipedia": wiki, "pages": ok_pages,
        "failed_pages": [p for p in pages if not p["ok"]],
        "checked_at": datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC"),
    }


def score_site(site, manual, citation_rows):
    pages = site["pages"]
    factors, findings = {}, []
    for name, fn in [("Content Structure", score_structure), ("Content Freshness", score_freshness),
                     ("Technical Crawlability", score_crawlability), ("Answer-Ready Content", score_answer_ready)]:
        sc, f = fn(site, pages)
        factors[name] = {"score": sc, "partial": False}
        findings += f
    sc, f, partial = score_authority(site, pages, manual)
    factors["Authority Signals"] = {"score": sc, "partial": partial}
    findings += f
    cite, n = score_citations(citation_rows)
    factors["AI Citation Rate"] = {"score": cite, "partial": n < 12, "tests": n}
    if cite is None:
        findings.append(finding("AI Citation Rate", "info", "Citation test not run yet",
                                "This is the biggest factor (30%). Run the prompts in the Citation test tab and record results.", "", "High"))
    elif cite < 40:
        findings.append(finding("AI Citation Rate", "fail", "Rarely cited by AI tools",
                                f"Average {cite}/100 across {n} prompt/platform tests.",
                                "Work on the High-priority items here, and get the brand into the third-party pages AI tools cite for these prompts (roundups, directories, review sites). Check which sources they cite instead of you.", "High"))

    measured = {k: v for k, v in factors.items() if v["score"] is not None}
    wsum = sum(WEIGHTS[k] for k in measured)
    total = round(sum(v["score"] * WEIGHTS[k] for k, v in measured.items()) / wsum) if wsum else 0
    provisional = len(measured) < len(WEIGHTS) or any(v["partial"] for v in factors.values())
    band = "High" if total >= 71 else "Medium" if total >= 41 else "Low"
    order = {"High": 0, "Medium": 1, "Low": 2}
    findings.sort(key=lambda x: ({"fail": 0, "warn": 1, "info": 2, "pass": 3}[x["status"]], order.get(x["priority"], 3)))
    return {"total": total, "band": band, "provisional": provisional, "factors": factors, "findings": findings}


def markdown_report(site, result, competitors=None):
    lines = [f"# AI Visibility Report: {site['host']}", "", f"Checked {site['checked_at']} | {len(site['pages'])} pages analysed", "",
             f"**Score: {result['total']}/100 ({result['band']} visibility)**" + (" — provisional" if result["provisional"] else ""), "",
             "| Factor | Weight | Score |", "|---|---|---|"]
    for k, w in WEIGHTS.items():
        v = result["factors"][k]["score"]
        lines.append(f"| {k} | {w}% | {'not tested' if v is None else v} |")
    lines += ["", "## What to fix", ""]
    for f in result["findings"]:
        if f["status"] in ("fail", "warn"):
            lines += [f"### [{f['priority']}] {f['check']} ({f['factor']})", f["detail"], "", f"**Fix:** {f['fix']}", ""]
    if competitors:
        lines += ["## Sites AI tools cite instead", "", "| Domain | Times cited | Platforms |", "|---|---|---|"]
        lines += [f"| {c['Domain']} | {c['Times cited']} | {c['Platforms']} |" for c in competitors[:10]]
        lines += [""]
    lines += ["## Working well", ""] + [f"- {f['check']}: {f['detail']}" for f in result["findings"] if f["status"] == "pass"]
    return "\n".join(lines)
