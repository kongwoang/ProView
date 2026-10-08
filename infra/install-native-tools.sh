#!/usr/bin/env bash
# Ubuntu x86_64; installs only beneath the checkout, without sudo.
set -euo pipefail
umask 077
root_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
if [[ $(uname -s) != Linux || $(uname -m) != x86_64 || $(id -u) == 0 ]]; then
  echo 'Run as an ordinary user on Linux x86_64.' >&2
  exit 1
fi
mkdir -p "$root_dir"/{.tools,.runtime/logs,.runtime/tmp,.runtime/cache,.runtime/config,.runtime/share}
export TMPDIR="$root_dir/.runtime/tmp"
export XDG_CACHE_HOME="$root_dir/.runtime/cache"
export XDG_CONFIG_HOME="$root_dir/.runtime/config"
export XDG_DATA_HOME="$root_dir/.runtime/share"
export npm_config_cache="$root_dir/.runtime/cache/npm"
downloads="$root_dir/.tools/downloads"
mkdir -p "$downloads"
cd "$downloads"

node_version=24.21.0
node_archive="node-v${node_version}-linux-x64.tar.xz"
if [[ ! -x "$root_dir/.tools/node/bin/node" ]]; then
  curl --fail --location --retry 3 --output "$node_archive" "https://nodejs.org/dist/v${node_version}/${node_archive}"
  curl --fail --location --retry 3 --output node-checksums.txt "https://nodejs.org/dist/v${node_version}/SHASUMS256.txt"
  awk -v file="$node_archive" '$2 == file' node-checksums.txt > node-checksum.txt
  test -s node-checksum.txt
  sha256sum --check node-checksum.txt
  tar -xf "$node_archive" -C "$root_dir/.tools"
  mv "$root_dir/.tools/node-v${node_version}-linux-x64" "$root_dir/.tools/node"
fi
export PATH="$root_dir/.tools/node/bin:$root_dir/.tools/pnpm/node_modules/.bin:$PATH"
if [[ ! -x "$root_dir/.tools/pnpm/node_modules/.bin/pnpm" ]]; then
  npm install --prefix "$root_dir/.tools/pnpm" --no-audit --no-fund pnpm@10.34.6
fi
node --version
pnpm --version

pg_version=17.10
pg_archive="postgresql-${pg_version}.tar.bz2"
if [[ ! -x "$root_dir/.tools/postgres/bin/postgres" ]]; then
  # apt-get download and dpkg-deb --extract do not install system packages.
  if ! command -v bison >/dev/null || ! command -v flex >/dev/null; then
    mkdir -p "$root_dir/.tools/build-deps/packages" "$root_dir/.tools/build-deps/runtime"
    cd "$root_dir/.tools/build-deps/packages"
    apt-get download bison flex m4
    for package in ./*.deb; do
      dpkg-deb --extract "$package" "$root_dir/.tools/build-deps/runtime"
    done
    export PATH="$root_dir/.tools/build-deps/runtime/usr/bin:$PATH"
    export BISON_PKGDATADIR="$root_dir/.tools/build-deps/runtime/usr/share/bison"
    export M4="$root_dir/.tools/build-deps/runtime/usr/bin/m4"
  fi
  cd "$downloads"
  curl --fail --location --retry 3 --output "$pg_archive" "https://ftp.postgresql.org/pub/source/v${pg_version}/${pg_archive}"
  curl --fail --location --retry 3 --output postgres-checksum.txt "https://ftp.postgresql.org/pub/source/v${pg_version}/${pg_archive}.sha256"
  sha256sum --check postgres-checksum.txt
  tar -xf "$pg_archive" -C "$root_dir/.tools"
  cd "$root_dir/.tools/postgresql-${pg_version}"
  ./configure --prefix="$root_dir/.tools/postgres" --without-icu --without-readline --with-ssl=openssl
  nice -n 10 make -j2
  make install
fi
"$root_dir/.tools/postgres/bin/postgres" --version

cd "$downloads"
if [[ ! -x "$root_dir/.tools/cloudflared" ]]; then
  curl --fail --location --retry 3 --output cloudflared "https://github.com/cloudflare/cloudflared/releases/download/2026.10.0/cloudflared-linux-amd64"
  printf '%s  cloudflared\n' d33ff2d14475178d2012c2c56beba87389ac5ded27649519f198a7d3134a99db | sha256sum --check -
  install -m 700 cloudflared "$root_dir/.tools/cloudflared"
fi
"$root_dir/.tools/cloudflared" --version
if [[ ! -x "$root_dir/.tools/caddy" ]]; then
  caddy_archive=caddy_2.11.7_linux_amd64.tar.gz
  curl --fail --location --retry 3 --output "$caddy_archive" "https://github.com/caddyserver/caddy/releases/download/v2.11.7/${caddy_archive}"
  curl --fail --location --retry 3 --output caddy-checksums.txt "https://github.com/caddyserver/caddy/releases/download/v2.11.7/caddy_2.11.7_checksums.txt"
  awk -v file="$caddy_archive" '$2 == file' caddy-checksums.txt > caddy-checksum.txt
  test -s caddy-checksum.txt
  sha512sum --check caddy-checksum.txt
  mkdir -p "$root_dir/.tools/caddy-package"
  tar -xf "$caddy_archive" -C "$root_dir/.tools/caddy-package"
  install -m 700 "$root_dir/.tools/caddy-package/caddy" "$root_dir/.tools/caddy"
fi
"$root_dir/.tools/caddy" version
echo 'Native tools ready; all installation files are inside the checkout.'
