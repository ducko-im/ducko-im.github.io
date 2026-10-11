#!/bin/zsh
# Screenshots the web side of /lab/<id>/ at 2x, the scale of the captures, into <work>/web/<id>.<appearance>.png.
# Usage: shoot.sh <work> <id> <appearance> [port]
set -e
work=${1:?work folder}; id=${2:?state id}; appearance=${3:?light or dark}; port=${4:-13269}
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-fidelity-pass}
mkdir -p "$work/web"
# Gives the dev server time to rebuild after an edit. `open` on the URL already shown has returned the page from before
# the edit, so reload too.
sleep 1.5
agent-browser set viewport 1400 1200 2 >/dev/null
agent-browser open "http://localhost:$port/lab/$id/?appearance=$appearance&mode=side" >/dev/null
agent-browser reload >/dev/null
agent-browser screenshot "[data-pair=$appearance] [data-web]" "$work/web/$id.$appearance.png" >/dev/null
echo "$work/web/$id.$appearance.png"
