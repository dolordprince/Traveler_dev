#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$HOME/traveler-dev"
REMOTE="origin"
BRANCH="main"

cd "$REPO_DIR"

echo "============================================================"
echo "TRAVELER DEV — GITHUB SYNCHRONIZATION VERIFICATION"
echo "============================================================"

echo
echo "=== REPOSITORY ==="
git remote get-url "$REMOTE"

echo
echo "=== LOCAL HEAD ==="
LOCAL_HEAD="$(git rev-parse HEAD)"
echo "$LOCAL_HEAD"

echo
echo "=== REMOTE MAIN ==="
REMOTE_HEAD="$(git ls-remote "$REMOTE" "refs/heads/$BRANCH" | awk '{print $1}')"
echo "$REMOTE_HEAD"

echo
echo "=== COMPARISON ==="
if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    echo "FAIL: LOCAL HEAD AND GITHUB MAIN DIFFER"
    echo "LOCAL : $LOCAL_HEAD"
    echo "REMOTE: $REMOTE_HEAD"
    exit 1
fi

echo "PASS: LOCAL HEAD == GITHUB MAIN"

echo
echo "=== BRANCH TRACKING ==="
git branch -vv

echo
echo "=== WORKTREE ==="
git status --short

echo
echo "=== COMMIT ==="
git show -s --format='Commit: %H%nParent: %P%nSubject: %s%nAuthor: %an <%ae>%nDate: %ci' HEAD

echo
echo "============================================================"
echo "RESULT: GITHUB MAIN IS SYNCHRONIZED"
echo "COMMIT: $LOCAL_HEAD"
echo "============================================================"
