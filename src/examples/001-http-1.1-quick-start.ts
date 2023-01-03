/**
 * Copyright 2023 Angus.Fenying <fenying@litert.org>
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
import * as $NativeHttp from 'http';
import * as $ZLib from 'zlib';

const hcli = $Http.createHttpClient();

const SERVER_ADDR = '127.0.0.1';
const SERVER_PORT = 8089;
const SERVER_BACKLOG = 512;

const server = $NativeHttp.createServer(function(req, resp) {

    if (req.method === 'GET') {

        resp.setHeader($Http.Headers.CONTENT_TYPE, 'text/plain');
        resp.setHeader($Http.Headers.CONTENT_ENCODING, 'gzip');

        const gzip = $ZLib.createGzip();

        resp.writeHead(200);
        gzip.pipe(resp);

        gzip.write('hello ');
        gzip.end('world!');
    }
    else if (req.method === 'HEAD') {

        resp.writeHead(200);
        resp.end();
    }
    else if (req.method === 'POST') {

        if (!req.headers[$Http.Headers.CONTENT_LENGTH_H1]) {

            resp.writeHead(400);
            resp.setHeader($Http.Headers.CONTENT_LENGTH_H1, 0);
            resp.end();
            return;
        }

        console.log(`[Server] Host: ${req.headers['host']}`);

        if (req.headers['content-type']) {

            resp.setHeader('content-type', req.headers['content-type']);
        }

        if (req.headers[$Http.Headers.CONTENT_LENGTH_H1]) {

            resp.setHeader(
                $Http.Headers.CONTENT_LENGTH_H1,
                req.headers[$Http.Headers.CONTENT_LENGTH_H1]
            );
        }

        req.pipe(resp);
    }
    else {

        resp.setHeader($Http.Headers.CONTENT_LENGTH_H1, 0);
        resp.writeHead(405);
        resp.end();
    }
});

server.listen(SERVER_PORT, SERVER_ADDR, SERVER_BACKLOG, (): void => {

    (async (): Promise<void> => {

        let req = await hcli.request({
            url: {
                protocol: 'http',
                hostname: SERVER_ADDR,
                port: SERVER_PORT,
                pathname: '/'
            },
            method: 'POST',
            data: 'hello world! angus'
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
                protocol: 'http',
                hostname: SERVER_ADDR,
                port: SERVER_PORT,
                pathname: '/'
            },
            method: 'GET'
        });

        console.log(`HTTP/1.1 ${req.statusCode}`);

        req.abort();

        req = await hcli.request({
            url: {
                protocol: 'http',
                hostname: SERVER_ADDR,
                port: SERVER_PORT,
                pathname: '/'
            },
            method: 'GET'
        });

        try {

            console.log(`HTTP/1.1 ${req.statusCode}`);
            console.log((await req.getBuffer()).toString());

        }
        catch (e) {

            console.error(e);
        }

        req = await hcli.request({
            url: `http://${SERVER_ADDR}:${SERVER_PORT}/`,
            method: 'HEAD'
        });

        try {

            console.log(`HTTP/1.1 ${req.statusCode}`);
            console.log('Response is', (await req.getBuffer()).toString().length === 0 ? 'empty' : 'non-empty');

        }
        catch (e) {

            console.error(e);
        }

        req = await hcli.request({
            url: `http://a.local.org:${SERVER_PORT}/`,
            method: 'POST',
            data: 'This is a test for "a.local.org".',
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

    })().catch((e) => {

        console.error(e);
    });
});
