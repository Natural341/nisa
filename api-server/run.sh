#!/bin/bash
echo "========================================"
echo "  Nexus API Server - Starting..."
echo "========================================"
echo

export PORT=3000
export RUST_LOG=info

cargo run --release
