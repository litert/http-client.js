/**
 * Copyright 2026 Angus.Fenying <fenying@litert.org>
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

import * as C from './Common';

interface ICachedItem {

    value: unknown;

    expiringAt: number;
}

class SimpleKVSCache implements C.IKeyValueCache {

    private readonly _data: Record<string, ICachedItem> = Object.create(null);

    public constructor(private readonly _ttl: number) {}

    public get(key: string): unknown {

        const ret = this._data[key];

        if (ret) {

            if (ret.expiringAt <= Date.now()) {

                delete this._data[key];

                return null;
            }

            return ret.value;
        }

        return null;
    }

    public set(key: string, value: unknown): void {

        this._data[key] = {
            value,
            'expiringAt': Date.now() + this._ttl
        };
    }

    public remove(key: string): void {

        delete this._data[key];
    }
}

export function createSimpleKVSCache(ttl: number): C.IKeyValueCache {

    return new SimpleKVSCache(ttl);
}
