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

import * as C from './Common';
import * as E from './Errors';

type TFilterFn = (value: any, ...args: any[]) => Promise<void>;

interface IFilterInfo {

    key: string | symbol;

    fn: TFilterFn;

    priority: number;
}

abstract class AbstractFilterManager<TAsync extends boolean>
implements C.IFilterManager<Record<string, C.IFilterCallback>, TAsync> {

    protected readonly _filters: Record<string, IFilterInfo[]> = {};

    public register(opts: {
        name: string;
        key: string | symbol;
        callback: C.IFilterCallback;
        priority?: number;
    }): this {

        opts.priority ??= 0;

        if (!this._filters[opts.name]) {

            this._filters[opts.name] = [];
        }

        if (this._filters[opts.name].find((v) => v.key === opts.key)) {

            throw new E.E_DUP_FILTER_FUNCTION({ metadata: { name: opts.name, key: opts.key } });
        }

        this._filters[opts.name].push({
            key: opts.key,
            fn: opts.callback,
            priority: opts.priority
        });

        this._filters[opts.name] = this._filters[opts.name].sort((a, b) => a.priority - b.priority);

        return this;
    }

    public unregister(
        name: string,
        key?: string
    ): this {

        if (!this._filters[name]) {

            return this;
        }

        if (undefined === key) {

            delete this._filters[name];

            return this;
        }

        const index = this._filters[name].findIndex((v) => v.key === key);

        if (index !== -1) {

            this._filters[name].splice(index, 1);
        }

        return this;
    }

    public abstract filter(name: string, value: any, ...args: any[]): any;
}

class AsyncFilterManager extends AbstractFilterManager<true> {

    public async filter(name: string, value: any, ...args: any[]): Promise<any> {

        const items = this._filters[name];

        if (!items) {

            return value;
        }

        for (const filter of items) {

            const v = filter.fn(value, ...args);

            // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
            value = v instanceof Promise ? await v : v;
        }

        return value;
    }
}

class SyncFilterManager extends AbstractFilterManager<false> {

    public filter(name: string, value: any, ...args: any[]): any {

        const items = this._filters[name];

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
