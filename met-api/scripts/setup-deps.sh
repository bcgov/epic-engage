#!/bin/bash
# Ubuntu/Debian system dependencies for Python 3.12 project

sudo apt update
sudo apt install -y \
    build-essential \
    libpq-dev \
    python3.12-dev \
    python3.12-venv \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    libgeos-dev \
    libproj-dev \
    libgdal-dev
