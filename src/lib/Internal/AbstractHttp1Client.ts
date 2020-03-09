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

import * as C from '../Common';
import { AbstractProtocolClient } from './AbstractProtocolClient';
import { Readable } from 'stream';
import * as $H1 from 'http';
import * as A from './Abstract';

export abstract class AbstractHttp1Client extends AbstractProtocolClient {

    public constructor(
        protected _: A.IHelper
    ) {

        super();
    }

    protected _processRequest(
        theReq: $H1.ClientRequest,
        opts: C.IRequestOptions,
        REQ_ENTITY: boolean
    ): Promise<A.IRequestResult> {

        if (REQ_ENTITY) {

            if (opts.data instanceof Readable) {

                opts.data.pipe(theReq);
            }
            else {

                theReq.end(opts.data);
            }

            delete opts.data;
        }

        return new Promise((resolve, reject) => {

            theReq.on('response', (resp: $H1.IncomingMessage) => {

                resolve({
                    'gzip': opts.gzip,
                    'deflate': opts.deflate,
                    'stream': resp,
                    'headers': resp.headers as any,
                    'statusCode': resp.statusCode as number,
                    'contentLength': resp.headers[C.Headers.CONTENT_LENGTH_H1] === undefined ?
                        Infinity : parseInt(resp.headers[C.Headers.CONTENT_LENGTH_H1] as string)
                });

            }).once('error', (e) => {

                reject(e);
            });
        });
    }
}