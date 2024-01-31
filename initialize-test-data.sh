#!/bin/bash

PRJ_ROOT=$(cd $(dirname $0); pwd)

cd $PRJ_ROOT;

rm -rf test

./generate-ca.sh
./generate-cert.sh a.local.org
./generate-cert.sh d.local.org
./generate-cert.sh b.local.org c.local.org
./generate-cert.sh x.local.org local.org '*.local.org'

echo "Initialization completed."
echo "Please add a.local.org, b.local.org, c.local.org, d.local.org, x.local.org, local.org,"
echo "dddd.local.org, g.local.org to /etc/hosts or C:/Windows/System32/drivers/etc/hosts"
