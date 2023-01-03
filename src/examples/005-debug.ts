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

/* eslint-disable @typescript-eslint/no-magic-numbers */
import * as $Http from '../lib';
(async (): Promise<void> => {

    const hcli = $Http.createHttpClient();

    const req = await hcli.request({
        url: 'https://www.google.com',
        method: 'GET'
    });

    try {

        console.log(`HTTP/2 ${req.statusCode}`);
        console.log((await req.getBuffer()).toString());
    }
    catch (e) {

        console.error(e);
    }

    hcli.close();

})().catch((e) => { console.error(e); });
