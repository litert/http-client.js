"use strict";
/**
 *  Copyright 2018 superxrb <superxrb@163.com>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const HTTPLib = require("../libs");
const fs = require("fs");
let httpClient = HTTPLib.createHttpClient();
async function testGet() {
    let response = await httpClient.get({
        "url": "https://www.baidu.com"
    });
    // tslint:disable-next-line:no-console
    console.log(response.content);
    // tslint:disable-next-line:no-console
    console.log(response.statusCode);
    let stream = await httpClient.get({
        "url": "https://www.baidu.com",
        "returnStream": true
    });
    let wstream = fs.createWriteStream("./baidu.html");
    stream.content.pipe(wstream);
}
exports.testGet = testGet;
async function testPostBuffer() {
    let path = "/api/v1/recomm/blogpost/reco";
    let body = {
        "encoding": "json",
        "data": {
            "itemId": 8037843,
            "itemTitle": "SQL 中多个 and or 的组合运算"
        }
    };
    let host = "recomm.cnblogs.com";
    let headers = {
        "content-type": "application/json"
    };
    try {
        let result = await httpClient.post({
            "url": {
                "host": host,
                "path": path,
                "secure": true
            },
            "body": body,
            "headers": headers
        });
        // tslint:disable-next-line:no-console
        console.log(result);
    }
    catch (e) {
        // tslint:disable-next-line:no-console
        console.error(e);
    }
}
exports.testPostBuffer = testPostBuffer;
async function testPostStream() {
    let path = "/api/v1/recomm/blogpost/reco";
    let body = fs.createReadStream("./tmp.txt");
    let host = "recomm.cnblogs.com";
    let headers = {
        "content-type": "application/json",
        "content-length": 69
    };
    try {
        let result = await httpClient.post({
            "url": {
                "host": host,
                "path": path,
                "secure": true
            },
            "body": body,
            "headers": headers,
            "returnStream": true
        });
        result.content.pipe(fs.createWriteStream("./result.txt"));
        // tslint:disable-next-line:no-console
        console.log(result);
    }
    catch (e) {
        // tslint:disable-next-line:no-console
        console.error(e);
    }
}
exports.testPostStream = testPostStream;
(async () => {
    await testPostStream();
})();
//# sourceMappingURL=sample-01.js.map