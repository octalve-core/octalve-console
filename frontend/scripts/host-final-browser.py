"""Actual Chromium + production Next build + local Django. No production credentials."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

assert os.environ.get("CI")=="true" and not os.environ.get("VERCEL_ENV")
BASE="http://localhost:3000"
ARTIFACT=Path(__file__).resolve().parent.parent/"browser-fixture-evidence"
ARTIFACT.mkdir(exist_ok=True)
PASSWORD="Synthetic-only-Browser-2026!"

def capture(page,name,width):
    page.evaluate("document.fonts.ready")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 3"), "Horizontal document overflow: "+name
    page.screenshot(path=str(ARTIFACT/f"{name}-{width}.png"),full_page=True,animations="disabled")

def browser_get(page,path):
    # Use Chromium cookie semantics (including localhost Secure cookies), not
    # Playwright\'s separate HTTP client cookie implementation.
    return page.evaluate("""async path => {
        const response = await fetch(path, {credentials: "same-origin", cache: "no-store"});
        return {status: response.status, ok: response.ok, body: await response.json()};
    }""",path)

def login(page,role,target):
    page.goto(BASE+"/login?next="+target,wait_until="domcontentloaded")
    page.locator('input[name="email"]').fill(("admin" if role=="admin" else "owner")+"@fixture.example.test")
    page.locator('input[name="password"]').fill(PASSWORD)
    with page.expect_response(lambda r: r.request.method=="POST" and r.url.rstrip("/")==BASE+"/api/cloud/auth/jwt/create" and not 300<=r.status<400,timeout=45000) as login_response:
        page.get_by_role("button",name="Sign in",exact=True).click()
    assert login_response.value.ok, f"Sign-in HTTP {login_response.value.status}"
    # Exact URL: the previous glob also matched /login?next=/admin/...
    page.wait_for_url(BASE+target,timeout=45000)
    assert page.evaluate("location.pathname")==target
    auth=browser_get(page,"/api/auth/session")
    assert auth["ok"] and auth["body"].get("authenticated") is True, f"Browser session unavailable: {auth['status']}"
    cookies=page.context.cookies()
    assert any(c["name"]=="__Host-octalve_console_access" and c["secure"] and c["httpOnly"] for c in cookies), "Expected secure HttpOnly session cookie"
    assert page.evaluate("!localStorage.getItem('octalve_console_access_token') && !sessionStorage.getItem('octalve_console_access_token')")

with sync_playwright() as pw:
    browser=pw.chromium.launch()
    for width,height in ((1440,900),(390,844)):
        with browser.new_context(viewport={"width":width,"height":height}) as admin:
            page=admin.new_page()
            login(page,"admin","/admin/settings/cron-jobs")
            expect(page.get_by_role("heading",name="Hosting renewal policy",exact=True)).to_be_visible(timeout=30000)
            expect(page.get_by_role("heading",name="Nonpayment lifecycle",exact=True)).to_be_visible()
            expect(page.get_by_role("heading",name="Cancellation and retention",exact=True)).to_be_visible()
            expect(page.get_by_text("Renewal authority is not enabled.",exact=True)).to_be_visible(timeout=30000)
            for route in ("renewal-policy","lifecycle-policy","cancellation-policy"):
                response=browser_get(page,"/api/cloud/services/"+route+"/")
                assert response["ok"] and response["body"]["available"] is False, f"{route}: {response['status']}"
            capture(page,"admin-lifecycle",width)
            page.goto(BASE+"/admin/settings/mail",wait_until="domcontentloaded")
            expect(page.get_by_role("heading",name="Email delivery providers",exact=True)).to_be_visible(timeout=30000)
            expect(page.get_by_role("heading",name="Delivery queue",exact=True)).to_be_visible()
            outbox=browser_get(page,"/api/cloud/settings/console-mail/outbox/")
            assert outbox["ok"] and outbox["body"]["sender_ready"] is False
            capture(page,"admin-mail",width)
            page.goto(BASE+"/admin/integrations",wait_until="domcontentloaded")
            expect(page.get_by_role("heading",name="Integration Store",exact=True)).to_be_visible(timeout=30000)
            capture(page,"admin-integrations",width)
        with browser.new_context(viewport={"width":width,"height":height}) as client:
            page=client.new_page()
            login(page,"client","/client/services")
            expect(page.get_by_role("heading",name="My services",exact=False).first).to_be_visible(timeout=30000)
            expect(page.get_by_text("fixture-own.example.test",exact=False).filter(visible=True).first).to_be_visible(timeout=30000)
            expect(page.get_by_text("fixture-other.example.test",exact=False)).to_have_count(0)
            for route in ("renewal-policy","lifecycle-policy","cancellation-policy"):
                assert browser_get(page,"/api/cloud/services/"+route+"/")["status"]==403
            capture(page,"client-services",width)
    browser.close()
print("PASS: local authenticated admin and customer routes, desktop/mobile, ownership and denied policy access; no production credentials.")
