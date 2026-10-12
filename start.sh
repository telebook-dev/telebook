#!/bin/bash
cd "$(dirname "$0")"

if [ ! -x venv/bin/websockify ]; then
    rm -rf venv
    python3 -m venv venv
    venv/bin/pip install -r requirements.txt
fi

source venv/bin/activate
PYTHONPATH=. websockify --web . --token-plugin=ip_token.IpToken 6080