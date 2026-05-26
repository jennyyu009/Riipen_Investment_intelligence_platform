import asyncio

try:
    from crawl4ai import AsyncWebCrawler
    _HAS_CRAWL4AI = True
except ImportError:
    AsyncWebCrawler = None
    _HAS_CRAWL4AI = False


async def crawl_website_async(url: str) -> str:
    if not url or not _HAS_CRAWL4AI:
        return ""

    try:
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=url)
            return result.markdown or ""
    except Exception:
        return ""


def crawl_website(url: str) -> str:
    if not url:
        return ""

    try:
        return asyncio.run(crawl_website_async(url))
    except RuntimeError:
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(crawl_website_async(url))
