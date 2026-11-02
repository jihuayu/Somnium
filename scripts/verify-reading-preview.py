import argparse
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright


parser = argparse.ArgumentParser(description="验收博客预览的搜索、导航、排版和评论展示。")
parser.add_argument("url")
parser.add_argument("--output", default=".cache/quiet-reading")
args = parser.parse_args()
base_url = args.url.rstrip("/")
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
origin = f"{urlparse(base_url).scheme}://{urlparse(base_url).netloc}"
expect.set_options(timeout=15000)


def check_viewport(page, width):
    assert page.evaluate("document.documentElement.scrollWidth") == width, page.url


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=True)
    for width, theme in [(320, "light"), (390, "light"), (390, "dark"), (1440, "light"), (1440, "dark")]:
        context = browser.new_context(viewport={"width": width, "height": 844}, color_scheme=theme)
        comment_fixture = {"has_comment": False}
        cors = {"access-control-allow-origin": origin, "access-control-allow-credentials": "true"}

        def comments_response(route):
            path = urlparse(route.request.url).path
            if path == "/api/v1/comments/current":
                comments = []
                if comment_fixture["has_comment"]:
                    comments.append({
                        "id": 1, "parent_id": None,
                        "body": "用于检查已有评论的显示。",
                        "author": {"id": 1, "login": "preview-reader", "display_name": "预览读者", "avatar_url": ""},
                        "reactions": dict.fromkeys(["like", "dislike", "heart", "laugh", "hooray", "confused", "rocket", "eyes", "total"], 0),
                        "created_at": "2026-10-14T10:00:00Z", "updated_at": "2026-10-14T10:00:00Z"
                    })
                route.fulfill(json={"data": comments, "pagination": {"has_more": False, "next_cursor": None}}, headers=cors)
            elif path.endswith("/replies"):
                route.fulfill(json={"data": [], "pagination": {"has_more": False, "next_cursor": None}}, headers=cors)
            else:
                route.fulfill(status=401, json={}, headers=cors)

        context.route("https://atrium.jihuayu.com/**", comments_response)
        context.route("**/api/request-geo", lambda route: route.fulfill(json={"hideComments": False}))
        page = context.new_page()
        page_errors = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.goto(f"{base_url}/search", wait_until="domcontentloaded")
        expect(page.get_by_role("heading", name="搜索", exact=True)).to_be_visible()
        search = page.get_by_role("searchbox", name="搜索文章", exact=True)
        expect(search).to_be_visible()
        expect(page.get_by_role("navigation", name="按标签浏览")).to_be_visible()
        page.screenshot(path=str(output / f"{width}-{theme}-search.png"))
        search.fill("影评")
        expect(page.get_by_role("status")).to_have_text("正在搜索…")
        expect(page.locator(".post-entry").first).to_be_visible()
        assert "Notion" not in page.locator("main").inner_text()
        check_viewport(page, width)
        page.screenshot(path=str(output / f"{width}-{theme}-search-results.png"))
        page.reload(wait_until="domcontentloaded")
        expect(search).to_have_value("影评")
        expect(page.locator(".post-entry").first).to_be_visible()

        search.fill("RocksDB")
        expect(page.locator(".post-entry h2 a")).to_have_text("RocksDB 上的布谷鸟过滤器")
        page.get_by_role("navigation", name="按标签浏览").get_by_role("link", name=re.compile("^技术")).click()
        expect(page.get_by_role("heading", name="技术", exact=True)).to_be_visible()
        search = page.get_by_role("searchbox")
        expect(search).to_have_value("RocksDB")
        expect(page.locator(".post-entry h2 a")).to_have_text("RocksDB 上的布谷鸟过滤器")
        assert parse_qs(urlparse(page.url).query)["q"] == ["RocksDB"]
        page.locator(".post-entry h2 a").click()
        expect(page.locator(".article-title")).to_be_visible()
        page.go_back(wait_until="domcontentloaded")
        expect(page.get_by_role("searchbox")).to_have_value("RocksDB")
        expect(page.locator(".post-entry h2 a")).to_be_visible()
        page.get_by_role("button", name="清空", exact=True).click()
        expect(page.get_by_role("searchbox")).to_have_value("")
        expect(page.locator(".post-entry").first).to_be_visible()
        assert "q" not in parse_qs(urlparse(page.url).query)

        page.goto(f"{base_url}/search", wait_until="domcontentloaded")
        search = page.get_by_role("searchbox")
        page.route("**/api/search?**", lambda route: route.fulfill(status=503, json={"error": "Internal Notion detail"}))
        search.fill("影评")
        expect(page.get_by_role("status")).to_have_text("搜索暂时不可用，请重试。")
        assert "Internal Notion detail" not in page.locator("main").inner_text()
        page.unroute("**/api/search?**")
        page.get_by_role("button", name="重试", exact=True).click()
        expect(page.locator(".post-entry").first).to_be_visible()
        search.fill("zzzyyyxxx666777")
        expect(page.get_by_role("status")).to_have_text("没有找到相关文章，试试其他关键词。")

        if width == 390 and theme == "light":
            page.evaluate("""() => {
              window.previewOriginalFetch = window.fetch;
              window.previewPendingSearch = [];
              window.fetch = (url, options) => String(url).startsWith('/api/search?')
                ? new Promise(resolve => window.previewPendingSearch.push({url, resolve}))
                : window.previewOriginalFetch(url, options);
            }""")
            search.fill("旧请求")
            page.wait_for_function("window.previewPendingSearch.length === 1")
            search.fill("新请求")
            page.wait_for_function("window.previewPendingSearch.length === 2")
            page.evaluate("""() => {
              const post = {id: 'current', slug: 'current', title: '当前查询的文章', summary: '', date: 1770000000000};
              window.previewPendingSearch[1].resolve(Response.json({posts: [post]}));
            }""")
            expect(page.locator(".post-entry h2 a")).to_have_text("当前查询的文章")
            page.evaluate("""() => {
              const post = {id: 'outdated', slug: 'outdated', title: '已经过期的文章', summary: '', date: 1770000000000};
              window.previewPendingSearch[0].resolve(Response.json({posts: [post]}));
              window.fetch = window.previewOriginalFetch;
            }""")
            expect(page.locator(".post-entry h2 a")).to_have_text("当前查询的文章")

        listing_links = set()
        page.goto(f"{base_url}/", wait_until="domcontentloaded")
        while True:
            listing_links.update(page.locator(".post-entry h2 a").evaluate_all("links => links.map(link => link.getAttribute('href'))"))
            check_viewport(page, width)
            next_page = page.locator('.pagination a[rel="next"]')
            if not next_page.count():
                break
            page.goto(f"{base_url}{next_page.get_attribute('href')}", wait_until="domcontentloaded")
        page.goto(f"{base_url}/archive", wait_until="domcontentloaded")
        expect(page.get_by_role("heading", name="全部文章", exact=True)).to_be_visible()
        archived_links = set(page.locator(".archive-entry a").evaluate_all("links => links.map(link => link.getAttribute('href'))"))
        assert archived_links == listing_links
        check_viewport(page, width)
        page.screenshot(path=str(output / f"{width}-{theme}-archive.png"))

        for slug in ["some-qwkjhs", "repo-the-world-of-love", "rocksdb-cuckoo-filter"]:
            page.goto(f"{base_url}/{slug}", wait_until="domcontentloaded")
            expect(page.locator(".article-title")).to_be_visible()
            check_viewport(page, width)
            metrics = page.locator(".reading-body .notion").evaluate(
                "element => ({font: getComputedStyle(element).fontSize, width: element.clientWidth})"
            )
            assert metrics["font"] == "17px"
            assert metrics["width"] == min(width - 40, 920 if slug == "rocksdb-cuckoo-filter" else 680)
            assert page.locator(".site-header").evaluate("element => getComputedStyle(element).position") == "static"
            if slug == "some-qwkjhs":
                assert page.locator(".inline-toc, .side-toc").count() == 0
            if slug == "repo-the-world-of-love":
                if width < 1280:
                    page.locator(".inline-toc summary").click()
                    page.locator(".inline-toc a").first.click()
                    assert "#notion-heading-" in page.url
                    page.evaluate("window.scrollTo({top: 0, behavior: 'instant'})")
                else:
                    expect(page.locator(".side-toc")).to_be_visible()
            if slug == "rocksdb-cuckoo-filter":
                assert page.locator(".notion-code-block").count() == 2
                assert page.locator(".notion-table-wrapper").count() == 1
            page.screenshot(path=str(output / f"{width}-{theme}-{slug}.png"))
            page.locator("#comments").scroll_into_view_if_needed()
            expect(page.locator("#comments").get_by_text("还没有评论。", exact=True)).to_have_count(1)
            assert "0 条评论" not in page.locator("#comments").inner_text()
            assert "读完之后，可以在这里继续这段讨论。" not in page.locator("#comments").inner_text()
            assert page.locator("textarea:focus").count() == 0

        comment_fixture["has_comment"] = True
        page.reload(wait_until="domcontentloaded")
        page.locator("#comments").scroll_into_view_if_needed()
        expect(page.locator("#comments").get_by_text("1 条评论", exact=True)).to_be_visible()
        expect(page.locator("#comments").get_by_text("用于检查已有评论的显示。", exact=True)).to_be_visible()
        expect(page.locator("#comments").get_by_text("还没有评论。", exact=True)).to_have_count(0)
        page.screenshot(path=str(output / f"{width}-{theme}-comments.png"))

        page.goto(f"{base_url}/personal-software-development", wait_until="domcontentloaded")
        expect(page.get_by_role("navigation", name="后续阅读").get_by_role("link")).to_have_attribute(
            "href", "/personal-software-update-261014"
        )
        page.goto(f"{base_url}/", wait_until="domcontentloaded")
        page.keyboard.press("Tab")
        assert page.locator(":focus").evaluate("element => getComputedStyle(element).outlineStyle") != "none"
        last_post = page.locator(".post-entry h2 a").last
        last_post.scroll_into_view_if_needed()
        before = page.evaluate("scrollY")
        last_post.click()
        expect(page.locator(".article-title")).to_be_visible()
        page.go_back(wait_until="domcontentloaded")
        expect(page.locator(".post-entry").first).to_be_attached()
        page.wait_for_timeout(500)
        assert abs(page.evaluate("scrollY") - before) < 4
        assert not page_errors, page_errors
        print(json.dumps({"width": width, "theme": theme, "result": "通过"}, ensure_ascii=False), flush=True)
        context.close()
    browser.close()
