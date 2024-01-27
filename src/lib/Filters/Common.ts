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

export type IFilterCallback = (value: any, ...args: any[]) => any;

export type IAsyncFilterCallback<T extends IFilterCallback> = (...args: Parameters<T>) => Promise<ReturnType<T>>;

export type IDefaultFilterTemplate = Record<string, IFilterCallback>;

export interface IFilterManager<
    T extends NonNullable<unknown> = IDefaultFilterTemplate,
    TAsync extends boolean = false
> {

    /**
     * Register a new filter function of the specific filter.
     */
    register<TK extends keyof T>(opts: {

        /**
         * The name of filter.
         */
        name: TK;

        /**
         * The key of filter function.
         */
        key: string | symbol;

        /**
         * The filter function.
         */
        callback: T[TK] extends IFilterCallback ? T[TK] : never;

        /**
         * The priority of filter function (the lower would be executed earlier). [Default: 0]
         */
        priority?: number;

    }): this;

    /**
     * Unregister an existing filter function from a specific filter.
     *
     * @param name      The name of filter.
     * @param key       The key of filter function. If omitted, all filter functions of the filter would be unregistered.
     */
    unregister(name: string | symbol, key?: string | symbol): this;

    /**
     * Execute a filter.
     *
     * @param name      The name of filter.
     * @param value     The initial value for filter.
     * @param args      The extra arguments of filter.
     */
    filter<TK extends keyof T>(
        name: TK,
        ...args: T[TK] extends IFilterCallback ? Parameters<T[TK]> : never
    ): T[TK] extends IFilterCallback ? TAsync extends true ? Promise<ReturnType<T[TK]>> : ReturnType<T[TK]> : never;
}
