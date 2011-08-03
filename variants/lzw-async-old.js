/**
 * Copyright (c) 2011 Ramesh Nair (www.hiddentao.com)
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Asynchronous LZW algorithm implementation.
 *
 * Source: https://github.com/hiddentao/lzw-async
 *
 * This is the original implementation without any optimisations. This works correctly.
 *
 * Blog post: http://www.hiddentao.com/archives/2011/08/01/asynchronous-implementation-of-lzw-algorithm-in-javascript/
 * Source: https://github.com/hiddentao/lzw-async
 */

window.LZWAsync = (function(){

    return new function() {

        var initialDictSize = 256;  // only expecting ASCII characters
        var maxDictSize = 65536;    // UTF-16 limit


        /**
         * The compression dictionary.
         *
         * @param characterList if given then the dictionary is initialised with these characters, thus assuming that
         * the input will only contain these characters and allowing for better compression ratios.
         */
        var CompressionDict = function(characterList){
            var hashTable;
            var nextCode;

            var reset = function() {
                hashTable = {};
                nextCode = 0;
                if (undefined != characterList && 0 < characterList.length) {
                    for (var i=0; i<characterList.length; ++i)
                        hashTable[characterList.charAt(i)] = nextCode++;
                } else {
                    for (var i = 0; i < initialDictSize; i++)
                        hashTable[String.fromCharCode(i)] = nextCode++;
                }
            }

            this.get = function(str) {
                return (hashTable.hasOwnProperty(str) ? hashTable[str] : false);
            }

            this.add = function(str) {
                hashTable[str] = nextCode++;
            }

            this.resetIfFull = function() {
                if (maxDictSize == nextCode) {
                    reset();
                    return true;
                }
                return false;
            }

            reset();
        }



        /**
         * Compress given input string.
         *
         * Parameters:-
         *   input: input string.
         *
         *   output: function(result) - gets called with the resulting output.
         *
         *   progress (optional): function(percent) - gets called every half a second or so with a progress update.
         *
         *   dict (optional): string of characters to expect in the input, and to thus limit the dictionary to.
         *
         * @param params the parameters.
         */
        this.compress = function(params) {
            if (!params.hasOwnProperty("progress")) {
                params.progress = function(percent) {}
            }
            var input = params.input;

            var dictionary = new CompressionDict(params.dict ? params.dict : undefined);

            var output = "";
            var w = "";
            var offset = 0;

            // the asynchronous compressor
            var _do_compress = function() {

                var startTimeInMs = new Date().getTime();
                var done = 0;
                while (offset < input.length) {
                    var c = input.charAt(offset);
                    var wc = w + c;
                    if (false !== dictionary.get(wc))
                        w = wc;
                    else {
                        dictionary.add(wc);

                        if ("" != w)
                            output += String.fromCharCode(dictionary.get(w));

                        w = c;
                        dictionary.resetIfFull();
                    }

                    offset++;

                    // every 10 items we check how long things took
                    done++;
                    if (0 == (done % 10)) {
                        var timeTakenInMs = new Date().getTime() - startTimeInMs;
                        if (100 < timeTakenInMs)
                            break;
                    }
                }

                // update progress
                params.progress(Math.round(offset / input.length * 100.0));

                // more to do?
                if (offset < input.length) {
                    // next iteration
                    setTimeout(function(){ _do_compress(); }, 0);
                } else {
                    // Output the code for w.
                    if (w != "")
                        output += String.fromCharCode(dictionary.get(w));
                    // all done, send result back
                    setTimeout(function(){params.output.call(null, output);},0);
                }
            }

            _do_compress();
        }




        /**
         * The de-compression dictionary.
         *
         * @param characterList if given then the dictionary is initialised with these characters, thus assuming that
         * the input will only contain these characters and allowing for better compression ratios.
         */
        var DecompressionDict = function(characterList){
            var hashTable;
            var nextCode;

            reset = function() {
                hashTable = {};
                nextCode = 0;
                if (undefined != characterList && 0 < characterList.length) {
                    for (var i=0; i<characterList.length; ++i)
                        hashTable[nextCode++] = characterList.charAt(i);
                } else {
                    for (var i = 0; i < initialDictSize; i++)
                        hashTable[nextCode++] = String.fromCharCode(i);
                }
            }

            this.get = function(code) {
                return (hashTable.hasOwnProperty(code) ? hashTable[code] : false);
            }

            this.add = function(str) {
                hashTable[nextCode++] = str;
            }

            this.resetIfFull = function() {
                if (maxDictSize-1 == nextCode) {
                    reset();
                    return true;
                }
                return false;
            }

            reset();
        }


        /**
         * Decompress given input string.
         *
         * Parameters:-
         *   input: input string.
         *
         *   output: function(result) - gets called with the resulting output.
         *
         *   progress (optional): function(percent) - gets called every half a second or so with a progress update.
         *
         *   dict (optional): string of characters to expect in the input, and to thus limit the dictionary to.
         *
         * @param params the parameters.
         */
        this.decompress = function(params) {
            if (!params.hasOwnProperty("progress")) {
                params.progress = function(percent) {}
            }
            var input = params.input;

            var dictionary = new DecompressionDict(params.dict ? params.dict : undefined);

            var w = dictionary.get(input.charCodeAt(0));
            var output = w;
            var offset = 1;

            // the asynchronous decompressor
            var _do_decompress = function() {

                var startTimeInMs = new Date().getTime();
                var done = 0;
                while (offset < input.length)
                {
                    var entry = "";
                    var k = input.charCodeAt(offset);
                    var str_k = dictionary.get(k);
                    if (false !== str_k) {
                        entry = str_k;
                        dictionary.add(w + entry.charAt(0));
                    }
                    else {
                        entry = w + w.charAt(0);
                        dictionary.add(entry);
                    }

                    output += entry;

                    offset++;

                    // start all over again if dictionary is full
                    if (dictionary.resetIfFull()) {
                        if (offset < input.length) {
                            w = input.charAt(offset++);
                            output += w;
                        }
                    } else {
                        w = entry;
                    }

                    // every 10 items we check how long things took
                    done++;
                    if (0 == (done % 10)) {
                        var timeTakenInMs = new Date().getTime() - startTimeInMs;
                        if (100 < timeTakenInMs)
                            break;
                    }
                }

                // update progress
                params.progress(Math.round(offset / input.length * 100.0));

                // more to do?
                if (offset < input.length) {
                    // next iteration
                    setTimeout(function(){ _do_decompress(); }, 0);
                } else {
                    // all done, send result back
                    setTimeout(function(){params.output.call(null, output);},0);
                }
            }

            _do_decompress();
        }

    }

})();
