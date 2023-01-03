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

import * as Req from './Request';
import * as Resp from './Response';
import { Filters } from '@litert/observable';

export type TPreprocessor = (opts: Req.IRequestOptions) => Req.IRequestOptions;

export interface IFilterPrerequest extends Filters.IFilterTemplate {

    name: 'pre_request';

    callback(value: Req.IRequestOptions): Promise<Req.IRequestOptions>;
}

export interface IKeyValueCache {

    set(key: string, value: any): void;

    get(key: string): any;

    remove(key: string): void;
}

export interface IClient {

    readonly filters: Filters.IFilterManager;

    /**
     * Start a HTTP request.
     *
     * @param opts The options for
     */
    request(opts: Req.IRequestOptionsInput): Promise<Resp.IResponse>;

    /**
     * Close all keep-alive connections.
     */
    close(): void;
}

export interface IClientOptions {

    filters: Filters.IFilterManager;

    kvCache: IKeyValueCache;
}
