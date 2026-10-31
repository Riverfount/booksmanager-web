#!/usr/bin/env bash
# Smoke test of the front-end image (issue #53): starts it, checks what the production setup depends on, and stops it.
# Usage: scripts/smoke-image.sh <image>      (needs docker and curl)
set -euo pipefail

image="${1:?usage: scripts/smoke-image.sh <image>}"
name="booksmanager-web-smoke-$$"
failures=0

cleanup() { docker rm --force "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

check() {
  local description="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "ok   - $description"
  else
    echo "FAIL - $description"
    failures=$((failures + 1))
  fi
}

# The HTTP status and one header of a request, from the running container.
status_of() { curl --silent --output /dev/null --write-out '%{http_code}' "$1"; }
header_of() { curl --silent --head "$2" | tr -d '\r' | awk -v h="$1" 'tolower($1) == tolower(h ":") { $1 = ""; sub(/^ /, ""); print }'; }
body_of() { curl --silent "$1"; }

docker run --detach --name "$name" --publish 127.0.0.1::8080 "$image" >/dev/null
port=$(docker port "$name" 8080/tcp | head -n 1 | sed 's/.*://')
base="http://127.0.0.1:$port"

# Nginx takes a moment to answer.
for _ in $(seq 1 30); do
  [ "$(status_of "$base/healthz" || true)" = "200" ] && break
  sleep 1
done

# The body must be its own "ok": the single-page fallback also answers 200, so the status alone proves nothing.
check "/healthz answers 200 with its own body" bash -c "test \"\$(curl --silent --write-out '%{http_code}' '$base/healthz')\" = \"ok
200\""
check "/ serves the app" bash -c "curl --silent '$base/' | grep -q '<div id=\"root\">'"

# A reload on a deep link must return the app, not a 404.
for path in /livros /usuarios '/convite?token=abc' '/redefinir-senha?token=abc' /meu/dados; do
  check "a reload on $path returns the app" bash -c "test \"\$(curl --silent --output /dev/null --write-out '%{http_code}' '$base$path')\" = 200 && curl --silent '$base$path' | grep -q '<div id=\"root\">'"
done

# A missing file under /assets/ is a real 404 (a stale bundle must not load index.html as JavaScript).
check "a missing /assets/ file is a 404" test "$(status_of "$base/assets/nao-existe-abc123.js")" = "404"

# The hashed files are cached for a year; the entry page never.
asset=$(body_of "$base/" | grep -o '/assets/[^"]*\.js' | head -n 1)
check "an /assets/ file is cached as immutable" bash -c "curl --silent --head '$base$asset' | tr -d '\r' | grep -iq '^cache-control: public, max-age=31536000, immutable'"
check "index.html is not cached" bash -c "curl --silent --head '$base/index.html' | tr -d '\r' | grep -iq '^cache-control: no-cache'"
check "a missing /assets/ file is not cached as immutable" bash -c "! curl --silent --head '$base/assets/nao-existe-abc123.js' | grep -iq immutable"

# The API is not served here: it must be a plain 404, not the app.
check "/api/ is a plain 404" test "$(status_of "$base/api/v1/users/me")" = "404"

# No host baked into the bundle: it calls /api/... on whatever host serves it.
check "no API host is baked into the bundle" bash -c "! curl --silent '$base$asset' | grep -Eq 'localhost:[0-9]+|127\.0\.0\.1:[0-9]+'"

# The image does not run as root, and the server does not say its version.
check "the server does not run as root" bash -c "test \"\$(docker exec '$name' id -u)\" != 0"
check "the server does not say its version" bash -c "! curl --silent --head '$base/' | grep -Eiq '^server: nginx/'"

# The text assets are compressed.
check "text assets are gzipped" bash -c "curl --silent --head --header 'Accept-Encoding: gzip' '$base$asset' | tr -d '\r' | grep -iq '^content-encoding: gzip'"

# The HEALTHCHECK of the image eventually reports healthy.
for _ in $(seq 1 40); do
  state=$(docker inspect --format '{{.State.Health.Status}}' "$name")
  [ "$state" = "healthy" ] && break
  sleep 1
done
check "the container reports healthy" test "$state" = "healthy"

if [ "$failures" -ne 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
