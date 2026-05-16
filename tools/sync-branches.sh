#!/bin/bash

set -e

BASE_COMMIT="37b35d40df14ed1674540888f89d243f7d5c48c6"

echo "== Resetting main to clean base structure =="
git checkout main
git reset --hard $BASE_COMMIT
git clean -fd

echo "== Fetching latest remote branches =="
git fetch origin

echo "== Removing old temp worktrees =="
rm -rf ../backend-temp ../frontend-temp

echo "== Creating backend temp worktree =="
git worktree add ../backend-temp origin/backend

echo "== Syncing backend branch into backend/ directory =="
rm -rf backend/*
cp -r ../backend-temp/* backend/ 2>/dev/null || true
cp -r ../backend-temp/.[!.]* backend/ 2>/dev/null || true
rm -rf backend/.git

echo "== Creating frontend temp worktree =="
git worktree add ../frontend-temp origin/frontend

echo "== Syncing frontend branch into frontend/ directory =="
rm -rf frontend/*
cp -r ../frontend-temp/* frontend/ 2>/dev/null || true
cp -r ../frontend-temp/.[!.]* frontend/ 2>/dev/null || true
rm -rf frontend/.git

echo "== Cleaning temp worktrees =="
git worktree remove ../backend-temp --force
git worktree remove ../frontend-temp --force

echo "== Commiting synchronized structure =="
git add .

git commit -m "Sync backend and frontend branches into monorepo"

echo "== Pushing to main =="
git push origin main

echo "== Done successfully =="
