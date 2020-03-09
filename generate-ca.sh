#!/bin/bash

CA_ROOT=test/ca

mkdir -p $CA_ROOT

CA_ROOT=$(cd $CA_ROOT; pwd)
CA_PRIV_KEY=$CA_ROOT/key.pem
CA_CERT=$CA_ROOT/cert.pem
CA_CONF_FILE=$CA_ROOT/ca.conf

# Generate CA Private Key

openssl genrsa -out $CA_PRIV_KEY 2048

# Generate Certificate for CA

openssl req \
    -new \
    -x509 \
    -key $CA_PRIV_KEY \
    -out $CA_CERT \
    -days 3650 \
    -subj "//skip=yes/C=CN/ST=GD/L=Shenzhen/O=Local/OU=Master/CN=ca.local.org"

# Initialize the CA configuration.


if [ -d /c/windows ]; then
    CA_BASEDIR=$(echo $CA_ROOT | sed -e 's/^\///' -e 's/^./\0:/')
else
    CA_BASEDIR=$CA_ROOT
fi;


echo "[ ca ]" > $CA_CONF_FILE
echo "default_ca = local" >> $CA_CONF_FILE
echo "[ local ]" >> $CA_CONF_FILE
echo "serial = $CA_BASEDIR/serial" >> $CA_CONF_FILE
echo "database = $CA_BASEDIR/index.txt" >> $CA_CONF_FILE
echo "new_certs_dir = $CA_BASEDIR/../certs" >> $CA_CONF_FILE
echo "certificate = $CA_BASEDIR/cert.pem" >> $CA_CONF_FILE
echo "private_key = $CA_BASEDIR/key.pem" >> $CA_CONF_FILE
echo "default_md = sha256" >> $CA_CONF_FILE
echo "default_days = 365" >> $CA_CONF_FILE
echo "policy = my_policy" >> $CA_CONF_FILE
echo "copy_extensions = copy" >> $CA_CONF_FILE
echo "[ my_policy ]" >> $CA_CONF_FILE
echo "countryName = supplied" >> $CA_CONF_FILE
echo "stateOrProvinceName = supplied" >> $CA_CONF_FILE
echo "organizationName = supplied" >> $CA_CONF_FILE
echo "commonName = supplied" >> $CA_CONF_FILE
echo "organizationalUnitName = optional" >> $CA_CONF_FILE
echo "commonName = supplied" >> $CA_CONF_FILE

touch $CA_ROOT/index.txt
echo 'unique_subject = no' > $CA_ROOT/index.txt.attr
echo '01' > $CA_ROOT/serial
