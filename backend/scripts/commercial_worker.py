"""Linux event-driven dispatcher. No provider credentials or payloads in signals."""
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import psycopg

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE","octalve_backend.settings")
import django
django.setup()
from services.commercial_scheduler import CHANNEL,INTERVALS,enabled

def run(lane):
    try:
        return subprocess.run([sys.executable,str(ROOT/"manage.py"),"run_commercial_lane",lane],
                              cwd=ROOT,timeout=240,check=False).returncode==0
    except (subprocess.TimeoutExpired,OSError):
        print("Commercial worker interrupted: "+lane,flush=True)
        return False

def main():
    if not enabled():
        raise SystemExit("Commercial scheduler is not configured for this runtime.")
    dsn=os.environ.get("OCTALVE_WORKER_LISTEN_DSN")
    if not dsn:
        raise SystemExit("OCTALVE_WORKER_LISTEN_DSN must point to the direct PostgreSQL database.")
    due={lane:time.monotonic()+5*i for i,lane in enumerate(INTERVALS)}
    pending={}
    listener=None
    reconnect=0
    with ThreadPoolExecutor(max_workers=2) as pool:
        while True:
            now=time.monotonic()
            for lane,future in list(pending.items()):
                if future.done():
                    del pending[lane]
                    if not future.result():
                        due[lane]=min(due[lane],now+60)
            for lane in sorted(due,key=due.get):
                if len(pending)>=2:
                    break
                if lane not in pending and due[lane]<=now:
                    due[lane]=now+INTERVALS[lane]
                    pending[lane]=pool.submit(run,lane)
            try:
                if listener is None and now>=reconnect:
                    listener=psycopg.connect(dsn,autocommit=True,connect_timeout=5)
                    listener.execute("LISTEN "+CHANNEL)
                if listener is not None:
                    for notice in listener.notifies(timeout=1,stop_after=20):
                        if notice.payload in due:
                            due[notice.payload]=min(due[notice.payload],time.monotonic()+5)
                else:
                    time.sleep(1)
            except psycopg.Error:
                if listener is not None:
                    listener.close()
                listener=None
                reconnect=time.monotonic()+30
                time.sleep(1)

if __name__=="__main__":
    main()
