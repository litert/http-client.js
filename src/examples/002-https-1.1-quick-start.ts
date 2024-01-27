/**
 * Copyright 2024 Angus.Fenying <fenying@litert.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */
import * as $Http from '../lib';
import * as $NativeHttps from 'https';
import * as $TLS from 'tls';
import * as $FS from 'fs';
import * as $zlib from 'zlib';

const SERVER_ADDR = '127.0.0.1';
const SERVER_HOST_B = 'b.local.org';
const SERVER_HOST_D = 'd.local.org';
const SERVER_PORT = 8089;
const SERVER_BACKLOG = 512;

const PEM_CERT_B = $FS.readFileSync('./test/certs/b.local.org/cert.pem');
const PEM_KEY_B = $FS.readFileSync('./test/certs/b.local.org/key.pem');
const PEM_CERT_D = $FS.readFileSync('./test/certs/d.local.org/cert.pem');
const PEM_KEY_D = $FS.readFileSync('./test/certs/d.local.org/key.pem');
const PEM_CA = $FS.readFileSync('./test/ca/cert.pem');

const server = $NativeHttps.createServer({
    ca: PEM_CA,
    cert: PEM_CERT_B,
    key: PEM_KEY_B,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    SNICallback: (servername, cb): void => {
        switch (servername) {
            case 'b.local.org':
                cb(null, $TLS.createSecureContext({
                    ca: PEM_CA,
                    cert: PEM_CERT_B,
                    key: PEM_KEY_B
                }));
                break;
            case 'd.local.org':
                cb(null, $TLS.createSecureContext({
                    ca: PEM_CA,
                    cert: PEM_CERT_D,
                    key: PEM_KEY_D
                }));
                break;
            default:
                cb(new Error('Unknown servername'));
                break;
        }
    }
}, function(req, resp) {

    console.log(`Request: ${req.method} ${req.url} [${req.headers.host!}]`);

    if (req.method === 'GET') {

        resp.setHeader('content-type', 'text/plain');
        resp.setHeader('content-length', 12);
        resp.end('hello world!');
    }
    else if (req.method === 'POST') {

        if (!req.headers['content-length']) {

            resp.writeHead(400);
            resp.setHeader('content-length', 0);
            resp.end();
            return;
        }

        if (req.headers['content-type']) {

            resp.setHeader('content-type', req.headers['content-type']);
        }

        resp.setHeader('content-encoding', 'gzip');

        req.pipe($zlib.createGzip()).pipe(resp);
    }
    else {

        resp.setHeader('content-length', 0);
        resp.writeHead(405);
        resp.end();
    }
});

server.listen(SERVER_PORT, SERVER_ADDR, SERVER_BACKLOG, (): void => {
    (async (): Promise<void> => {

        const hcli = $Http.createHttpClient();

        let req = await hcli.request({
            url: {
                protocol: 'https',
                hostname: SERVER_HOST_B,
                port: SERVER_PORT,
                pathname: '/',
            },
            method: 'POST',
            version: $Http.EVersion.HTTP_1_1,
            keepAlive: false,
            ca: PEM_CA,
            data: 'hello world! angus',
            connectionOptions: {
                remoteHost: SERVER_ADDR
            }
        });

        try {

            console.log(`HTTP/1.1 ${req.statusCode}`);
            console.log((await req.getBuffer()).toString());

        }
        catch (e) {

            console.error(e);
        }

        req = await hcli.request({
            url: {
                protocol: 'https',
                hostname: SERVER_HOST_D,
                port: SERVER_PORT,
                pathname: '/',
            },
            method: 'POST',
            version: $Http.EVersion.HTTP_1_1,
            keepAlive: false,
            ca: PEM_CA,
            data: 'hello world! angus',
            connectionOptions: {
                remoteHost: SERVER_ADDR
            }
        });

        try {

            console.log(`HTTP/1.1 ${req.statusCode}`);
            console.log((await req.getBuffer()).toString());

        }
        catch (e) {

            console.error(e);
        }

        req = await hcli.request({
            url: {
                protocol: 'https',
                hostname: SERVER_HOST_B,
                port: SERVER_PORT,
                pathname: '/',
            },
            method: 'POST',
            keepAlive: false,
            ca: PEM_CA,
            data: 'Plain Result: Auto-detected HTTP/1.1',
            connectionOptions: {
                remoteHost: SERVER_ADDR
            }
        });

        try {

            console.log(`HTTP/1.1 ${req.statusCode}`);
            console.log((await req.getBuffer()).toString());

        }
        catch (e) {

            console.error(e);
        }

        req = await hcli.request({
            url: {
                protocol: 'https',
                hostname: SERVER_HOST_B,
                port: SERVER_PORT,
                pathname: '/',
            },
            method: 'GET',
            keepAlive: false,
            ca: PEM_CA,
            connectionOptions: {
                remoteHost: SERVER_ADDR
            }
        });

        try {

            console.log(`HTTP/1.1 ${req.statusCode}`);
            console.log((await req.getBuffer()).toString());
        }
        catch (e) {

            console.error(e);
        }

        hcli.close();
        server.close();

        console.log('Done');

    })().catch((e) => { console.error(e); });
});
