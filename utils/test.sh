#!/usr/bin/env bash

set -e

node \
    --test \
    --experimental-test-coverage \
    --test-coverage-include='lib/**/*.js' \
    --test-coverage-exclude='lib/**/index.js' \
    'test/**/*.test.js'
