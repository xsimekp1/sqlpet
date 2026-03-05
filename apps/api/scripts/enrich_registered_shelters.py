#!/usr/bin/env python3
"""
Enrich registered_shelters table with website and phone data via web search + scraping.

Usage:
    python scripts/enrich_registered_shelters.py              # both phases
    python scripts/enrich_registered_shelters.py --limit 20
    python scripts/enrich_registered_shelters.py --only-search
    python scripts/enrich_registered_shelters.py --only-scrape

Search providers (auto-detected from env):
    - SERPAPI_KEY set  → SerpAPI
    - BING_SEARCH_KEY set → Bing Search API
    - neither          → DuckDuckGo HTML (no key needed)
"""

import argparse
import asyncio
import io
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

# Force UTF-8 output on Windows (console is cp1250 by default)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

script_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.dirname(script_dir)
sys.path.insert(0, api_dir)
sys.path.insert(0, os.path.join(api_dir, "src"))

from src.app.core.config import settings

import requests
from bs4 import BeautifulSoup
import phonenumbers
from phonenumbers import PhoneNumberFormat
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# ─── Logging setup ────────────────────────────────────────────────────────────

os.makedirs(os.path.join(api_dir, "logs"), exist_ok=True)
log_file = os.path.join(api_dir, "logs", "enrich_shelters.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
HTTP_TIMEOUT = 10
RATE_LIMIT_SLEEP = 5  # seconds between shelters
RETRY_ATTEMPTS = 3
RETRY_BACKOFF = [2, 4, 8]

# Catalog/directory domains to filter out — not official shelter sites
CATALOG_DOMAINS = {
    # Czech business/firm registries & aggregators
    "firmy.cz", "najisto.cz", "zlatestranky.cz", "zivefirmy.cz",
    "remspace.cz", "hledej.cz", "kurzy.cz", "rejstrik-firem.kurzy.cz",
    "rzp.cz", "ares.gov.cz", "justice.cz", "or.justice.cz",
    "finmag.cz", "penize.cz", "rejstrik.penize.cz", "obchodnirejstrik.cz",
    "administrativniregistr.cz", "rzp.cz", "zivnostnik.cz",
    "companycheck.cz", "cribis.cz", "creditreform.cz", "bisnode.cz",
    "czechpoint.cz", "registr-firem.cz", "podnikatel.cz",
    # Donation/crowdfunding platforms (not official shelter sites)
    "darcovstvi.vaschovatel.cz", "darujme.cz", "hithit.cz", "startovac.cz",
    # Generic directories & search
    "yelp.com", "tripadvisor.com", "google.com", "maps.google.com",
    "wikipedia.org", "wikipedie.org", "seznam.cz", "centrum.cz",
    "zoominfo.com", "linkedin.com", "twitter.com", "youtube.com",
    # NOTE: facebook.com and instagram.com are intentionally allowed
    # (user wants to save social media pages if no official site is found)
}

CONTACT_SUBPAGES = ["/kontakt", "/contact", "/kontakty", "/o-nas", "/about"]

# Czech phone regex: +420/00420/0 followed by 9 digits (with optional separators)
PHONE_REGEX = re.compile(
    r"(?:\+420|00420|0)[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{3}"
)

# ─── HTTP helpers ─────────────────────────────────────────────────────────────

def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def fetch_with_retry(url: str, session: requests.Session | None = None) -> requests.Response | None:
    """Fetch URL with retry + exponential backoff. Returns None on failure."""
    s = session or _session()
    for attempt, backoff in enumerate(RETRY_BACKOFF, start=1):
        try:
            resp = s.get(url, timeout=HTTP_TIMEOUT, allow_redirects=True)
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as exc:
            if attempt < RETRY_ATTEMPTS:
                log.debug("Attempt %d failed for %s: %s — retrying in %ds", attempt, url, exc, backoff)
                time.sleep(backoff)
            else:
                log.debug("All %d attempts failed for %s: %s", RETRY_ATTEMPTS, url, exc)
    return None


# ─── Search providers ─────────────────────────────────────────────────────────

def search_serpapi(query: str, serpapi_key: str) -> list[str]:
    """Return top result URLs via SerpAPI."""
    try:
        resp = requests.get(
            "https://serpapi.com/search",
            params={"q": query, "api_key": serpapi_key, "num": 5, "hl": "cs", "gl": "cz"},
            timeout=HTTP_TIMEOUT,
        )
        data = resp.json()
        return [r["link"] for r in data.get("organic_results", [])[:5]]
    except Exception as exc:
        log.warning("SerpAPI error: %s", exc)
        return []


def search_bing(query: str, bing_key: str) -> list[str]:
    """Return top result URLs via Bing Search API."""
    try:
        resp = requests.get(
            "https://api.bing.microsoft.com/v7.0/search",
            headers={"Ocp-Apim-Subscription-Key": bing_key},
            params={"q": query, "count": 5, "mkt": "cs-CZ"},
            timeout=HTTP_TIMEOUT,
        )
        data = resp.json()
        return [r["url"] for r in data.get("webPages", {}).get("value", [])[:5]]
    except Exception as exc:
        log.warning("Bing API error: %s", exc)
        return []


def search_duckduckgo(query: str) -> list[str]:
    """Return top result URLs by scraping DuckDuckGo HTML (no key needed)."""
    from urllib.parse import unquote
    try:
        resp = requests.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            headers={"User-Agent": USER_AGENT, "Accept-Language": "cs,en;q=0.9"},
            timeout=HTTP_TIMEOUT,
        )
        soup = BeautifulSoup(resp.text, "html.parser")
        urls = []

        # DDG HTML: result links are <a class="result__a"> with redirect href containing uddg= param
        for a in soup.select("a.result__a"):
            href = a.get("href", "")
            if href.startswith("http") and "duckduckgo.com" not in href:
                urls.append(href)
            elif "uddg=" in href:
                m = re.search(r"uddg=([^&]+)", href)
                if m:
                    real = unquote(m.group(1))
                    if real.startswith("http"):
                        urls.append(real)

        # Fallback: any link with uddg param
        if not urls:
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "uddg=" in href:
                    m = re.search(r"uddg=([^&]+)", href)
                    if m:
                        real = unquote(m.group(1))
                        if real.startswith("http"):
                            urls.append(real)

        log.debug("DDG returned %d URLs for: %s", len(urls), query)
        return urls[:5]
    except Exception as exc:
        log.warning("DuckDuckGo search error: %s", exc)
        return []


def web_search(query: str) -> list[str]:
    """Search using best available provider."""
    serpapi_key = os.environ.get("SERPAPI_KEY", "")
    bing_key = os.environ.get("BING_SEARCH_KEY", "")
    if serpapi_key:
        log.debug("Using SerpAPI")
        return search_serpapi(query, serpapi_key)
    elif bing_key:
        log.debug("Using Bing")
        return search_bing(query, bing_key)
    else:
        log.debug("Using DuckDuckGo")
        return search_duckduckgo(query)


# ─── Scoring helpers ──────────────────────────────────────────────────────────

def _extract_city(address: str) -> str:
    """Best-effort city extraction from Czech address string."""
    # Czech addresses often end with city after last comma
    parts = [p.strip() for p in address.split(",")]
    if len(parts) >= 2:
        # Last part or second-to-last (if last is just postal code)
        candidate = parts[-1]
        if re.match(r"^\d{3}\s?\d{2}$", candidate):
            candidate = parts[-2] if len(parts) >= 3 else parts[0]
        # Remove postal code prefix if present
        candidate = re.sub(r"^\d{3}\s?\d{2}\s+", "", candidate)
        return candidate.strip()
    return ""


def score_candidate(url: str, html: str, shelter_name: str, city: str) -> float:
    """Score a candidate URL based on page content relevance."""
    score = 0.0
    text_lower = html.lower()
    name_lower = shelter_name.lower()
    city_lower = city.lower()

    try:
        soup = BeautifulSoup(html, "html.parser")
        page_text = soup.get_text(separator=" ").lower()
        title = soup.find("title")
        title_text = title.get_text().lower() if title else ""
    except Exception:
        page_text = text_lower
        title_text = ""

    # +0.5 if page mentions shelter name
    if name_lower in page_text:
        score += 0.5

    # +0.3 if page mentions city
    if city_lower and city_lower in page_text:
        score += 0.3

    # +0.2 if title contains "útulek" or "shelter"
    if "útulek" in title_text or "shelter" in title_text or "útulku" in title_text:
        score += 0.2

    return score


def is_catalog_domain(url: str) -> bool:
    """Return True if URL belongs to a known directory/catalog site."""
    try:
        domain = urlparse(url).netloc.lower()
        # Strip www.
        domain = re.sub(r"^www\.", "", domain)
        if domain in CATALOG_DOMAINS:
            return True
        # Catch Czech business registry sites by URL path pattern
        path = urlparse(url).path.lower()
        if "obchodni-rejstrik" in path or "rejstrik" in domain:
            return True
        return False
    except Exception:
        return False


# ─── Phone extraction ─────────────────────────────────────────────────────────

def extract_phones_from_html(html: str, base_url: str) -> list[str]:
    """Extract and validate CZ phone numbers from HTML. Returns normalized E.164 strings."""
    found = set()

    try:
        soup = BeautifulSoup(html, "html.parser")

        # tel: links
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("tel:"):
                raw = href[4:].strip()
                norm = _normalize_phone(raw)
                if norm:
                    found.add(norm)

        # Regex in full text
        for raw in PHONE_REGEX.findall(soup.get_text(separator=" ")):
            norm = _normalize_phone(raw)
            if norm:
                found.add(norm)
    except Exception as exc:
        log.debug("Phone extraction error: %s", exc)

    return list(found)


def _normalize_phone(raw: str) -> str | None:
    """Validate and normalize a phone number string to E.164 (+420XXXXXXXXX)."""
    try:
        cleaned = re.sub(r"[\s\-\(\)]", "", raw)
        parsed = phonenumbers.parse(cleaned, "CZ")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, PhoneNumberFormat.E164)
    except Exception:
        pass
    return None


# ─── Phase 1: Website search ──────────────────────────────────────────────────

async def phase1_search_websites(
    conn,
    limit: int | None,
    stats: dict,
) -> None:
    """Find official websites for shelters that don't have one yet."""
    log.info("=== Phase 1: Website search ===")

    query = """
        SELECT id, name, address
        FROM registered_shelters
        WHERE website IS NULL AND scrape_status IS NULL
        ORDER BY name
    """
    if limit:
        query += f" LIMIT {limit}"

    result = await conn.execute(text(query))
    rows = result.fetchall()
    log.info("Found %d shelters to search", len(rows))

    session = _session()

    now = datetime.now(timezone.utc)

    for shelter_id, name, address in rows:
        stats["processed"] += 1
        city = _extract_city(address or "")
        search_query = f'"{name}" {city} útulek zvířata web'
        log.info("[%d/%d] Searching: %s (%s)", stats["processed"], len(rows), name, city)

        try:
            candidate_urls = await asyncio.to_thread(web_search, search_query)

            best_url = None
            best_score = 0.0
            catalog_urls: list[tuple[str, str]] = []  # (url, html) for phone fallback

            for url in candidate_urls:
                resp = await asyncio.to_thread(fetch_with_retry, url, session)
                if not resp:
                    continue

                html = resp.text

                if is_catalog_domain(url):
                    # Keep catalog pages as phone fallback if they mention the shelter
                    score = score_candidate(url, html, name, city)
                    if score >= 0.3:
                        catalog_urls.append((url, html))
                    log.debug("  Catalog (score=%.2f): %s", score, url)
                    continue

                score = score_candidate(url, html, name, city)
                log.debug("  Score %.2f: %s", score, url)

                if score > best_score:
                    best_score = score
                    best_url = url

            if best_url and best_score >= 0.3:
                log.info("  -> Website found (score=%.2f): %s", best_score, best_url)
                await conn.execute(
                    text("""
                        UPDATE registered_shelters
                        SET website = :url,
                            search_confidence = :confidence,
                            scrape_status = 'website_found'
                        WHERE id = :id
                    """),
                    {"url": best_url, "confidence": best_score, "id": shelter_id},
                )
                stats["website_found"] += 1
            else:
                # No official website — try to extract phone from catalog results
                phone_found = None
                phone_source_url = None
                for cat_url, cat_html in catalog_urls:
                    phones = extract_phones_from_html(cat_html, cat_url)
                    if phones:
                        phone_found = phones[0]
                        phone_source_url = cat_url
                        break

                if phone_found:
                    log.info("  -> No web, but phone found from catalog: %s (%s)", phone_found, phone_source_url)
                    await conn.execute(
                        text("""
                            UPDATE registered_shelters
                            SET phone = :phone,
                                phone_source = :source,
                                scrape_status = 'phone_from_catalog',
                                last_checked = :now
                            WHERE id = :id
                        """),
                        {"phone": phone_found, "source": phone_source_url, "now": now, "id": shelter_id},
                    )
                    stats["phone_from_catalog"] += 1
                else:
                    log.info("  -> No website, no phone found")
                    await conn.execute(
                        text("""
                            UPDATE registered_shelters
                            SET scrape_status = 'website_not_found'
                            WHERE id = :id
                        """),
                        {"id": shelter_id},
                    )
                    stats["website_not_found"] += 1

        except Exception as exc:
            log.error("  ERROR processing shelter %s: %s", name, exc)
            stats["website_not_found"] += 1

        await asyncio.sleep(RATE_LIMIT_SLEEP)


# ─── Phase 2: Phone scraping ──────────────────────────────────────────────────

async def phase2_scrape_phones(
    conn,
    limit: int | None,
    stats: dict,
) -> None:
    """Scrape phone numbers from known shelter websites."""
    log.info("=== Phase 2: Phone scraping ===")

    query = """
        SELECT id, name, website
        FROM registered_shelters
        WHERE website IS NOT NULL AND phone IS NULL
        ORDER BY name
    """
    if limit:
        query += f" LIMIT {limit}"

    result = await conn.execute(text(query))
    rows = result.fetchall()
    log.info("Found %d shelters to scrape for phone", len(rows))

    session = _session()
    now = datetime.now(timezone.utc)

    for shelter_id, name, website in rows:
        log.info("Scraping phone: %s → %s", name, website)

        try:
            phones: list[str] = []
            phone_source: str | None = None

            # Try homepage first
            resp = await asyncio.to_thread(fetch_with_retry, website, session)
            if resp:
                phones = extract_phones_from_html(resp.text, website)
                if phones:
                    phone_source = website

            # Try contact sub-pages if homepage gave nothing
            if not phones:
                for subpage in CONTACT_SUBPAGES:
                    contact_url = urljoin(website.rstrip("/") + "/", subpage.lstrip("/"))
                    resp = await asyncio.to_thread(fetch_with_retry, contact_url, session)
                    if resp and resp.status_code == 200:
                        phones = extract_phones_from_html(resp.text, contact_url)
                        if phones:
                            phone_source = contact_url
                            break

            if phones:
                # Prefer the first found (tel: links take priority — already in list order)
                phone = phones[0]
                log.info("  -> Phone found: %s (from %s)", phone, phone_source)
                await conn.execute(
                    text("""
                        UPDATE registered_shelters
                        SET phone = :phone,
                            phone_source = :source,
                            scrape_status = 'success',
                            last_checked = :now
                        WHERE id = :id
                    """),
                    {"phone": phone, "source": phone_source, "now": now, "id": shelter_id},
                )
                stats["phone_found"] += 1
            else:
                log.info("  -> No phone found")
                await conn.execute(
                    text("""
                        UPDATE registered_shelters
                        SET scrape_status = 'phone_not_found',
                            last_checked = :now
                        WHERE id = :id
                    """),
                    {"now": now, "id": shelter_id},
                )
                stats["phone_not_found"] += 1

        except Exception as exc:
            log.error("  ERROR scraping %s: %s", name, exc)
            stats["phone_not_found"] += 1

        await asyncio.sleep(RATE_LIMIT_SLEEP)


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich registered_shelters with website + phone")
    parser.add_argument("--limit", type=int, default=None, help="Max shelters to process per phase")
    parser.add_argument("--only-search", action="store_true", help="Run phase 1 (website search) only")
    parser.add_argument("--only-scrape", action="store_true", help="Run phase 2 (phone scraping) only")
    args = parser.parse_args()

    run_search = not args.only_scrape
    run_scrape = not args.only_search

    database_url = settings.DATABASE_URL_ASYNC
    if not database_url:
        log.error("DATABASE_URL_ASYNC not set")
        sys.exit(1)

    engine = create_async_engine(database_url, echo=False)

    stats = {
        "processed": 0,
        "website_found": 0,
        "website_not_found": 0,
        "phone_found": 0,
        "phone_not_found": 0,
        "phone_from_catalog": 0,
    }

    start_time = time.monotonic()

    async with engine.begin() as conn:
        # Count already-processed shelters (skipped in phase 1)
        result = await conn.execute(
            text("SELECT COUNT(*) FROM registered_shelters WHERE scrape_status IS NOT NULL")
        )
        already_done = result.scalar() or 0
        stats["skipped"] = already_done

        if run_search:
            await phase1_search_websites(conn, args.limit, stats)

        if run_scrape:
            await phase2_scrape_phones(conn, args.limit, stats)

    elapsed = time.monotonic() - start_time
    total = stats["processed"]
    avg = (elapsed / total) if total else 0.0

    print("\n" + "=" * 42)
    print(" Enrich Registered Shelters - Summary")
    print("=" * 42)
    print(f"  Celkem zpracovano:    {total}")
    print(f"  Website nalezeno:     {stats['website_found']}")
    print(f"  Website nenalezeno:   {stats['website_not_found']}")
    print(f"  Preskoceno (ma web):  {stats['skipped']}")
    print(f"  Telefon nalezeno:     {stats['phone_found']}")
    print(f"  Telefon z katalogu:   {stats['phone_from_catalog']}")
    print(f"  Telefon nenalezeno:   {stats['phone_not_found']}")
    print(f"  Prumerna doba:        {avg:.1f}s / zaznam")
    print("=" * 42 + "\n")

    log.info("Enrichment complete. Log saved to: %s", log_file)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
