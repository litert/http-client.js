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
import * as E from './Errors';

type TFilterFn = (value: unknown, ...args: unknown[]) => unknown;

interface IFilterInfo {

    key: string | symbol;

    fn: TFilterFn;

    priority: number;
}

abstract class AbstractFilterManager {

    protected readonly _filters = new Map<string | symbol, IFilterInfo[]>();

    public register(opts: {
        name: string | symbol;
        key: string | symbol;
        callback: C.IFilterCallback;
        priority?: number;
    }): this {

        opts.priority ??= 0;

        let filters = this._filters.get(opts.name);

        if (!filters) {

            filters = [];
            this._filters.set(opts.name, filters);
        }

        if (filters.find((value) => value.key === opts.key)) {

            throw new E.E_DUP_FILTER_FUNCTION({ metadata: { name: opts.name, key: opts.key } });
        }

        filters.push({
            key: opts.key,
            fn: opts.callback,
            priority: opts.priority
        });

        filters.sort((a, b) => a.priority - b.priority);

        return this;
    }

    public unregister(
        name: string | symbol,
        key?: string | symbol
    ): this {

        const filters = this._filters.get(name);

        if (!filters) {

            return this;
        }

        if (undefined === key) {

            this._filters.delete(name);

            return this;
        }

        const index = filters.findIndex((value) => value.key === key);

        if (index !== -1) {

            filters.splice(index, 1);
        }

        return this;
    }

    public abstract filter(
        name: string | symbol,
        value: unknown,
        ...args: unknown[]
    ): unknown;
}

class AsyncFilterManager extends AbstractFilterManager {

    public async filter(
        name: string | symbol,
        value: unknown,
        ...args: unknown[]
    ): Promise<unknown> {

        const items = this._filters.get(name);

        if (!items) {

            return value;
        }

        for (const filter of items) {

            value = await filter.fn(value, ...args);
        }

        return value;
    }
}

class SyncFilterManager extends AbstractFilterManager {

    public filter(
        name: string | symbol,
        value: unknown,
        ...args: unknown[]
    ): unknown {

        const items = this._filters.get(name);

        if (!items) {

            return value;
        }

        for (const filter of items) {

            value = filter.fn(value, ...args);
        }

        return value;
    }
}

export function createAsyncFilterManager<
    T extends NonNullable<unknown> = C.IDefaultFilterTemplate
>(): C.IFilterManager<T, true> {

    return new AsyncFilterManager() as unknown as C.IFilterManager<T, true>;
}

export function createSyncFilterManager<
    T extends NonNullable<unknown> = C.IDefaultFilterTemplate
>(): C.IFilterManager<T> {

    return new SyncFilterManager() as unknown as C.IFilterManager<T>;
}
