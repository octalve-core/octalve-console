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

def login(page,role,target):
    page.goto(BASE+"/login?next="+target,wait_until="domcontentloaded")
    page.locator('input[name="email"]').fill(("admin" if role=="admin" else "owner")+"@fixture.example.test")
    page.locator('input[name="password"]').fill(PASSWORD)
    page.get_by_role("button",name="Sign in",exact=True).click()
    page.wait_for_url("**"+target,timeout=45000)
    auth=page.request.get(BASE+"/api/auth/session")
    assert auth.ok and auth.json().get("authenticated") is True
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
                response=admin.request.get(BASE+"/api/cloud/services/"+route+"/")
                assert response.ok and response.json()["available"] is False
            capture(page,"admin-lifecycle",width)
            page.goto(BASE+"/admin/settings/mail",wait_until="domcontentloaded")
            expect(page.get_by_role("heading",name="Email delivery providers",exact=True)).to_be_visible(timeout=30000)
            expect(page.get_by_role("heading",name="Delivery queue",exact=True)).to_be_visible()
            outbox=admin.request.get(BASE+"/api/cloud/settings/console-mail/outbox/")
            assert outbox.ok and outbox.json()["sender_ready"] is False
            capture(page,"admin-mail",width)
            page.goto(BASE+"/admin/integrations",wait_until="domcontentloaded")
            expect(page.get_by_role("heading",name="Integration Store",exact=True)).to_be_visible(timeout=30000)
            capture(page,"admin-integrations",width)
        with browser.new_context(viewport={"width":width,"height":height}) as client:
            page=client.new_page()
            login(page,"client","/client/services")
            expect(page.get_by_role("heading",name="My services",exact=False).first).to_be_visible(timeout=30000)
            expect(page.get_by_text("fixture-own.example.test",exact=False).first).to_be_visible(timeout=30000)
            expect(page.get_by_text("fixture-other.example.test",exact=False)).to_have_count(0)
            for route in ("renewal-policy","lifecycle-policy","cancellation-policy"):
                assert client.request.get(BASE+"/api/cloud/services/"+route+"/").status==403
            capture(page,"client-services",width)
    browser.close()
print("PASS: local authenticated admin and customer routes, desktop/mobile, ownership and denied policy access; no production credentials.")
