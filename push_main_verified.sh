#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$HOME/traveler-dev"
REMOTE="origin"
BRANCH="main"

cd "$REPO_DIR"

echo "============================================================"
echo "TRAVELER DEV — VERIFIED MAIN DEPLOYMENT PUSH"
echo "============================================================"

echo
echo "=== REMOTE ==="
git remote get-url "$REMOTE"

echo
echo "=== LOCAL HEAD ==="
LOCAL_HEAD="$(git rev-parse HEAD)"
echo "$LOCAL_HEAD"

echo
echo "=== WORKTREE ==="
git status --short

echo
echo "=== CURRENT REMOTE MAIN ==="
REMOTE_BEFORE="$(git ls-remote "$REMOTE" "refs/heads/$BRANCH" | awk '{print $1}')"
echo "$REMOTE_BEFORE"

if [[ -z "$REMOTE_BEFORE" ]]; then
    echo "FAIL: Could not resolve remote main."
    exit 1
fi

if [[ "$LOCAL_HEAD" == "$REMOTE_BEFORE" ]]; then
    echo
    echo "ALREADY SYNCHRONIZED."
    exit 0
fi

echo
echo "=== PUSHING LOCAL MAIN ==="

git -c http.version=HTTP/1.1 \
    -c core.compression=0 \
    push "$REMOTE" \
    "HEAD:refs/heads/$BRANCH"

echo
echo "=== VERIFYING REMOTE MAIN ==="

REMOTE_AFTER="$(git ls-remote "$REMOTE" "refs/heads/$BRANCH" | awk '{print $1}')"
echo "$REMOTE_AFTER"

if [[ "$LOCAL_HEAD" != "$REMOTE_AFTER" ]]; then
    echo "FAIL: Remote verification failed."
    echo "LOCAL : $LOCAL_HEAD"
    echo "REMOTE: $REMOTE_AFTER"
    exit 1
fi

git fetch --no-tags "$REMOTE" "$BRANCH"

echo
echo "=== FINAL BRANCH STATE ==="
git branch -vv

echo
echo "============================================================"
echo "RESULT: PUSH SUCCESSFUL"
echo "LOCAL : $LOCAL_HEAD"
echo "REMOTE: $REMOTE_AFTER"
echo "============================================================"
