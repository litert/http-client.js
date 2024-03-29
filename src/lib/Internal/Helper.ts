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

import * as C from '../Common';
import * as $QS from 'querystring';
import * as A from './Abstract';

export class HttpHelper implements A.IHelper {

    /**
     * Check if the HTTP METHOD requires entity.
     */
    public requireEntity(method: C.TMethod): boolean {

        switch (method) {
            case 'GET':
            case 'HEAD':
            case 'OPTIONS':
            case 'TRACE':
                return false;
            default:
                return true;
        }
    }

    /**
     * Check if the HTTP METHOD will responses a entity.
     */
    public hasEntity(method: C.TMethod): boolean {

        switch (method) {
            case 'HEAD':
            case 'TRACE':
                return false;
            default:
                return true;
        }
    }

    public buildPath(url: C.IUrl): string {

        let ret = url.pathname;

        if (url.query) {

            ret += `?${$QS.stringify(url.query as Record<string, string>)}`;
        }

        return ret;
    }

    public getAuthority(url: C.IUrl): string {

        return `${url.protocol}://${url.hostname}:${url.port!}`.toLowerCase();
    }
}
