/**
 * Copyright 2020 Angus.Fenying <fenying@litert.org>
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
import * as $NativeHttps from 'http2';
import * as $FS from 'fs';
import * as $zlib from 'zlib';

const SERVER_ADDR = '127.0.0.1';
const SERVER_HOST = 'b.local.org';
const SERVER_PORT = 8089;
const SERVER_BACKLOG = 512;

const server = $NativeHttps.createSecureServer({
    ca: $FS.readFileSync('./test/ca/cert.pem'),
    cert: $FS.readFileSync('./test/certs/b.local.org/cert.pem'),
    key: $FS.readFileSync('./test/certs/b.local.org/key.pem'),
}, function(req, resp) {

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

        if (req.headers[$NativeHttps.constants.HTTP2_HEADER_PATH] === '/gzip') {

            resp.setHeader('content-encoding', 'gzip');

            resp.writeHead(200);

            req.pipe($zlib.createGzip()).pipe(resp.stream);
        }
        else {

            resp.writeHead(200);

            req.pipe(resp.stream);
        }
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
                hostname: SERVER_HOST,
                port: SERVER_PORT,
                pathname: '/gzip',
            },
            method: 'POST',
            version: $Http.EVersion.HTTP_2,
            ca: $FS.readFileSync('./test/ca/cert.pem'),
            data: 'GZIP Result: hello world! angus'
        });

        try {

            console.log(`HTTP/2 ${req.statusCode}`);
            console.log((await req.getBuffer()).toString());
        }
        catch (e) {

            console.error(e);
        }

        req = await hcli.request({
            url: {
                protocol: 'https',
                hostname: SERVER_HOST,
                port: SERVER_PORT,
                pathname: '/',
            },
            method: 'POST',
            version: $Http.EVersion.HTTP_2,
            localAddress: '127.0.0.24',
            ca: $FS.readFileSync('./test/ca/cert.pem'),
            data: 'Plain Result: hello world! angus'
        });

        try {

            console.log(`HTTP/2 ${req.statusCode}`);
            console.log((await req.getBuffer()).toString());

        }
        catch (e) {

            console.error(e);
        }

        req = await hcli.request({
            url: {
                protocol: 'https',
                hostname: SERVER_HOST,
                port: SERVER_PORT,
                pathname: '/',
            },
            method: 'POST',
            localAddress: '127.0.0.22',
            ca: $FS.readFileSync('./test/ca/cert.pem'),
            data: 'Auto-detected HTTP/2'
        });

        try {

            console.log(`HTTP/2 ${req.statusCode}`);
            console.log((await req.getBuffer()).toString());

        }
        catch (e) {

            console.error(e);
        }

        req = await hcli.request({
            url: {
                protocol: 'https',
                hostname: SERVER_HOST,
                port: SERVER_PORT,
                pathname: '/',
            },
            method: 'POST',
            localAddress: '127.0.0.22',
            ca: $FS.readFileSync('./test/ca/cert.pem'),
            data: 'Auto-detected HTTP/2'
        });

        try {

            console.log(`HTTP/2 ${req.statusCode}`);
            console.log((await req.getBuffer()).toString());

        }
        catch (e) {

            console.error(e);
        }

        req = await hcli.request({
            url: {
                protocol: 'https',
                hostname: SERVER_HOST,
                port: SERVER_PORT,
                pathname: '/',
            },
            method: 'GET',
            localAddress: '127.0.0.22',
            ca: $FS.readFileSync('./test/ca/cert.pem')
        });

        console.log(`HTTP/2 ${req.statusCode}`);
        req.abort();

        req = await hcli.request({
            url: {
                protocol: 'https',
                hostname: SERVER_HOST,
                port: SERVER_PORT,
                pathname: '/',
            },
            method: 'GET',
            localAddress: '127.0.0.22',
            ca: $FS.readFileSync('./test/ca/cert.pem')
        });

        try {

            console.log(`HTTP/2 ${req.statusCode}`);
            console.log((await req.getBuffer()).toString());

        }
        catch (e) {

            console.error(e);
        }

        hcli.close();

        server.close();
    })().catch((e) => console.error(e));
});
