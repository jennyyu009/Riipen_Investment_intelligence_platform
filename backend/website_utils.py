import asyncio

try:
    from .config import ENABLE_CRAWL_ENRICHMENT
except ImportError:
    from config import ENABLE_CRAWL_ENRICHMENT

try:
    from crawl4ai import AsyncWebCrawler
    _HAS_CRAWL4AI = True
except ImportError:
    AsyncWebCrawler = None
    _HAS_CRAWL4AI = False


async def crawl_website_async(url: str, timeout_seconds: int = 20) -> str:
    if not url or not _HAS_CRAWL4AI:
        return ""

    try:
        async with AsyncWebCrawler() as crawler:
            result = await asyncio.wait_for(crawler.arun(url=url), timeout=timeout_seconds)
            return result.markdown or ""
    except (Exception, asyncio.TimeoutError):
        return ""


def crawl_website(url: str, *, allow_online: bool = False, timeout_seconds: int = 20) -> str:
    if not url:
        return ""
    if not allow_online and not ENABLE_CRAWL_ENRICHMENT:
        return ""

    try:
        return asyncio.run(crawl_website_async(url, timeout_seconds=timeout_seconds))
    except RuntimeError:
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(crawl_website_async(url, timeout_seconds=timeout_seconds))
