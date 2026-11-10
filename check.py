"""Vercel function: POST /api/check  {"url": "example.com"}  ->  AI visibility score (JSON).
Uses the checker logic in _checker.py. Four signals, equal weight."""
import ipaddress, json, os, re, socket, sys, time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler
from urllib.parse import urljoin, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import requests
from bs4 import BeautifulSoup
import _checker as ck

ck.TIMEOUT = 6
MAX_PAGES = 6
MAX_BYTES = 2_000_000
ALLOW_PORTS = False  # tests only
ORG = ("Organization", "LocalBusiness", "Corporation", "ProfessionalService")


def is_public_host(host):
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    return bool(infos) and all(ipaddress.ip_address(i[4][0]).is_global for i in infos)


def safe_fetch(url, session):
    """Same as checker.fetch, but refuses private addresses (also on redirects) and huge pages."""
    start = time.time()
    try:
        for _ in range(5):
            u = urlparse(url)
            if u.scheme not in ("http", "https") or not is_public_host(u.hostname or ""):
                return None, time.time() - start
            r = session.get(url, headers=ck.HEADERS, timeout=ck.TIMEOUT, allow_redirects=False, stream=True)
            if r.is_redirect and r.headers.get("Location"):
                url = urljoin(url, r.headers["Location"])
                r.close()
                continue
            data = b""
            for chunk in r.iter_content(65536):
                data += chunk
                if len(data) > MAX_BYTES:
                    break
            r._content, r._content_consumed = data, True
            return r, time.time() - start
    except requests.RequestException:
        pass
    return None, time.time() - start


ck.fetch = safe_fetch


def alnum(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def scan(raw):
    session = requests.Session()
    base = ck.normalize_domain(raw)
    if "@" in base or (not ALLOW_PORTS and re.search(r":\d+$", base)) or "[" in base:
        raise ValueError("Enter a normal website address, like yoursite.com.")
    r, _ = ck.fetch(base + "/", session)
    if (r is None or r.status_code >= 400) and not urlparse(base).netloc.startswith("www."):
        r2, _ = ck.fetch(base.replace("://", "://www.", 1) + "/", session)
        if r2 is not None and r2.status_code < 400:
            r = r2
    if r is None:
        raise ConnectionError("We couldn't reach that site. Check the address, or the site may be blocking automated visits.")
    if r.status_code >= 400:
        raise ConnectionError(f"That site answered with an error (HTTP {r.status_code}). It may be blocking automated visits.")
    fin = urlparse(r.url)
    base, host = f"{fin.scheme}://{fin.netloc}", fin.netloc
    links = [urljoin(r.url, a["href"]) for a in BeautifulSoup(r.content, "lxml").find_all("a", href=True)]
    urls = ck.choose_pages(base, host, [], links, MAX_PAGES)
    with ThreadPoolExecutor(max_workers=8) as ex:
        f_rob = ex.submit(ck.check_robots, base, session)
        f_llm = ex.submit(ck.check_llms_txt, base, session)
        f_sm = ex.submit(ck.get_sitemap, base, [], session)
        f_pg = [ex.submit(ck.analyze_page, u, session) for u in urls]
        robots, llms, sitemap = f_rob.result(), f_llm.result(), f_sm.result()
        pages_all = [f.result() for f in f_pg]
    if not sitemap["found"] and robots["sitemaps"]:
        sitemap = ck.get_sitemap(base, robots["sitemaps"], session)
    pages = [p for p in pages_all if p["ok"]]
    if not pages:
        raise ConnectionError("We couldn't read any pages. The site may be blocking automated visits.")
    home = pages[0]
    brand = (home.get("org_names") or [None])[0] or home.get("site_name") or ""
    site = {"base": base, "host": host, "brand": brand, "robots": robots, "sitemap": sitemap,
            "llms_txt": llms, "pages": pages}

    F = []  # (signal, finding)
    s_crawl, f = ck.score_crawlability(site, pages)
    F += [("Crawlability", x) for x in f]
    s_ans, f = ck.score_answer_ready(site, pages)
    F += [("Answer-readiness", x) for x in f]
    _, f = ck.score_structure(site, pages)
    for x in f:
        F.append(("Structured data" if re.search(r"schema|structured", x["check"], re.I) else "Answer-readiness", x))

    # Answer-readiness: 75% answer content + 25% headings/lists
    head = sum((40 if p["h1_count"] == 1 else 0) + (40 if p["subheading_count"] >= 3 else 0)
               + (20 if p["lists_tables"] else 0) for p in pages) / len(pages)
    s_ans = round(0.75 * s_ans + 0.25 * head)

    # Structured data
    has_org = any(t in home["schema_types"] for t in ORG)
    rich = {t for p in pages for t in p["schema_types"]} & {"FAQPage", "Service", "Product", "Article", "BlogPosting", "HowTo"}
    s_struct = round(min(100, 50 * ck.pct(pages, lambda p: p["schema_types"]) + (30 if has_org else 0) + (20 if rich else 0)))
    if not rich:
        F.append(("Structured data", ck.finding("Structured data", "warn", "No FAQ, Service, Product or Article schema",
                  "None of the scanned pages uses these schema types, which tell AI exactly what a page offers.",
                  "Add FAQPage schema to pages with questions, and Service or Product schema to offer pages.", "Medium")))

    # Entity clarity
    same_as = {s for p in pages for s in p["same_as"]}
    label = alnum(host.replace("www.", "").split(".")[0])
    names = {x for x in (label, alnum(brand)) if len(x) >= 3}
    in_title = any(n in alnum(home["title"] + " " + home["h1"]) for n in names)
    s_ent = (30 if home["org_names"] else 0) + (30 if len(same_as) >= 3 else 15 if same_as else 0) \
        + (20 if in_title else 0) + (10 if home["site_name"] else 0) + (10 if len(home["meta_description"]) >= 50 else 0)
    E = "Entity clarity"
    if not home["org_names"]:
        F.append((E, ck.finding(E, "fail", "Business name not stated in schema", "The homepage doesn't name the business in structured data, so AI has to guess who you are.",
                  "Add Organization schema with your exact business name, logo and URL.", "High")))
    if len(same_as) < 3:
        F.append((E, ck.finding(E, "warn", "Few linked brand profiles", f"{len(same_as)} profile link(s) found in schema. These connect your site to your brand elsewhere on the web.",
                  "Add sameAs links (LinkedIn, X, YouTube, Crunchbase, directories) to your Organization schema.", "Medium")))
    if not in_title:
        F.append((E, ck.finding(E, "warn", "Brand name missing from homepage title or main heading", "AI tools match your brand by name. Your homepage doesn't clearly say it.",
                  "Put your business name in the homepage title and H1, with a plain line on what you do.", "Medium")))
    if not home["site_name"]:
        F.append((E, ck.finding(E, "warn", "No site name tag", "The og:site_name tag is missing.", "Add an og:site_name meta tag with your business name.", "Low")))
    if len(home["meta_description"]) < 50:
        F.append((E, ck.finding(E, "warn", "Homepage description missing or too short", "A clear description helps AI summarise what you do.",
                  "Write a 140-160 character homepage description that states what you do and who for.", "Low")))

    scores = {"Crawlability": s_crawl, "Structured data": s_struct, "Answer-readiness": s_ans, "Entity clarity": min(s_ent, 100)}
    total = round(sum(scores.values()) / 4)
    pr = {"High": 0, "Medium": 1, "Low": 2}
    bad = sorted([(s, x) for s, x in F if x["status"] in ("fail", "warn")],
                 key=lambda t: (pr.get(t[1]["priority"], 3), t[1]["status"] != "fail"))
    return {
        "ok": True, "host": host, "score": total,
        "band": "High" if total >= 71 else "Medium" if total >= 41 else "Low",
        "signals": [{"name": k, "score": v} for k, v in scores.items()],
        "fixes": [{"signal": s, "title": x["check"], "detail": x["detail"][:300], "fix": x["fix"][:300], "priority": x["priority"]} for s, x in bad[:8]],
        "passed": [x["check"] for s, x in F if x["status"] == "pass"][:6],
        "pages_scanned": len(pages),
    }


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            n = int(self.headers.get("content-length") or 0)
            if n > 2048:
                return self._send(413, {"ok": False, "error": "Request too large."})
            raw = str(json.loads(self.rfile.read(n) or b"{}").get("url", ""))[:300]
            self._send(200, scan(raw))
        except ValueError as e:
            self._send(400, {"ok": False, "error": str(e)})
        except ConnectionError as e:
            self._send(422, {"ok": False, "error": str(e)})
        except Exception:
            self._send(500, {"ok": False, "error": "Something went wrong scanning that site. Please try again."})

    def do_GET(self):
        self._send(405, {"ok": False, "error": "Use POST."})
