#!/usr/bin/env bash
set -e
cmd="$1"
shift

case "$cmd" in
  test|install|ci);;
  *)
    echo "Unknown integration subcommand $cmd"
    exit 2
  ;;
esac

if [[ -z "$@" ]]; then
  echo "No eslint major versions were provided"
  exit 2
fi

echo "Will perform $cmd for following eslint majors lines: $@"

for version in $@; do
    (cd test/packages/eslint-v$version && npm $cmd)
done
