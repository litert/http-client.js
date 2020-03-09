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

import * as $Http from '../lib';
import * as $NativeHttp from 'http';

const hcli = $Http.createHttpClient();

const SERVER_ADDR = '127.0.0.1';
const SERVER_PORT = 8089;
const SERVER_BACKLOG = 512;

const server = $NativeHttp.createServer(function(req, resp) {

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

        resp.setHeader('content-length', req.headers['content-length']);

        req.pipe(resp);
    }
    else {

        resp.setHeader('content-length', 0);
        resp.writeHead(405);
        resp.end();
    }
});

server.listen(SERVER_PORT, SERVER_ADDR, SERVER_BACKLOG, async function() {

    const req = await hcli.request({
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

    hcli.close();

    server.close();
});
