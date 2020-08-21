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
import * as $TLS from 'tls';
import * as $NativeHttps from 'http2';
import * as $FS from 'fs';

const SERVER_ADDR = '127.0.0.1';
const SERVER_HOST = 'b.local.org';
const SERVER_PORT = 8089;
const SERVER_BACKLOG = 512;

const THE_CA = $FS.readFileSync('./test/ca/cert.pem');

const server = $NativeHttps.createSecureServer({
    ca: THE_CA,
    cert: $FS.readFileSync('./test/certs/b.local.org/cert.pem'),
    key: $FS.readFileSync('./test/certs/b.local.org/key.pem'),
}, function(req, resp) {

    resp.setHeader('content-type', 'text/plain');
    resp.setHeader('content-length', 12);
    resp.end('hello world!');
});

server.listen(SERVER_PORT, SERVER_ADDR, SERVER_BACKLOG, (): void => {
    const socket = $TLS.connect({
        host: SERVER_ADDR,
        port: SERVER_PORT,
        servername: SERVER_HOST,
        ca: THE_CA,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ALPNProtocols: ['h2']
    }, function() {

        console.log('TLS ok');
        $NativeHttps.connect(`https://${SERVER_ADDR}:${SERVER_PORT}`, {
            createConnection() { return socket; }
        }, function() {

            console.log('H2 ok');
        }).on('error', console.error);
    });
});
