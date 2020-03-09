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

import * as C from './Common';

interface ICachedItem {

    value: any;

    expiringAt: number;
}

export function createSimpleKVSCache(ttl: number): C.IKeyValueCache {

    let data: Record<string, ICachedItem> = {};

    return {
        get(key: string): any {

            const ret = data[key];

            if (ret) {

                if (ret.expiringAt < Date.now()) {

                    delete data[key];

                    return null;
                }

                return ret.value;
            }

            return null;
        },
        set(key: string, value: any) {

            data[key] = {
                value,
                expiringAt: Date.now() + ttl
            };
        },
        remove(key): void {

            delete data[key];
        }
    };
}
