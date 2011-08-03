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
 * This is an implementation of the compressor using code strings and a fixed-size array
 * (see  https://github.com/hiddentao/lzw-async/wiki/Optimizing-the-dictionary). At the moment this is slower
 * than the normal compressor implementation using a hashtable,
 *
 * Blog post: http://www.hiddentao.com/archives/2011/08/01/asynchronous-implementation-of-lzw-algorithm-in-javascript/
 * Source: https://github.com/hiddentao/lzw-async
 */


window.LZWAsync = (function(){

    return new function() {

        var initialDictSize = 256;  // only expecting ASCII characters
        var maxDictSize = 65536;    // UTF-16 limit

        
        /**
         * Represents a code string.
         *
         * A code string is a string represented by <prefixIndex><suffix>, where:
         *
         *  - prefixIndex = index into dictionary of another code string
         *  - suffix = a single character
         */
        var CodeString = function(){
            this.prefixIndex = -1;
            this.suffix = "";
            if (2 == arguments.length) {
                this.prefixIndex = arguments[0];
                this.suffix = arguments[1];
            }
        }
        /**
         * Get whether this code string equals the given code string.
         * @param codeString
         * @return true if so; false otherwise.
         */
        CodeString.prototype.equals = function(codeString) {
            return this.prefixIndex == codeString.prefixIndex && this.suffix == codeString.suffix;
        }
        /**
         * Get a copy of this CodeString.
         * @return a copy of this code string.
         */
        CodeString.prototype.clone = function() {
            return new CodeString(this.prefixIndex, this.suffix);
        }


        /**
         * The compression dictionary.
         */
        var CompressionDict = function(){
            var data;
            var nextCode = 0;

            var reset = function() {
                data = new Array(maxDictSize);
                for (var i = 0; i < initialDictSize; i++)
                    data[i] = new CodeString(-1, String.fromCharCode(i));
                nextCode = initialDictSize;
            }

            /**
             * Find given CodeString in the dictionary.
             *
             * This will add it if it doesn't already exist.
             *
             * Upon completion the prefixIndex of the passed-in CodeString will point to the new/existing item in the
             * dictionary.
             *
             * @param codeString the CodeString to look for.
             *
             * @return true if CodeString was already present in the dictionary, false if it needed to be added.
             */
            this.findAdd = function(codeString) {
                // a single character?
                if (-1 == codeString.prefixIndex) {
                    codeString.prefixIndex = codeString.suffix.charCodeAt(0);
                    return true;
                }
                else {
                    for (var i=initialDictSize; i<nextCode; ++i) {
                        if (data[i].equals(codeString)) {
                            codeString.prefixIndex = i;
                            return true;
                        }
                    }
                    // at this point we should add the code string to the db
                    data[nextCode++] = codeString.clone();
                    return false;
                }
            }


            /**
             * Reset this dictionary to its initial state if it is full.
             * @return true if dictionary needed to be reset; false otherwise.
             */
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
         * @param input the input string.
         * @param options compression options (see above).
         */
        this.compress = function(input, options) {
            if (!options.hasOwnProperty("progress")) {
                options.progress = function(percent) {}
            }
            if (!options.hasOwnProperty("result")) {
                options.result = function(output) {}
            }

            var dictionary = new CompressionDict();

            var output = "";
            var w = new CodeString();
            var offset = 0;

            // the asynchronous compressor
            var _do_compress = function() {

                var startTimeInMs = new Date().getTime();
                var done = 0;
                while (offset < input.length) {
                    w.suffix = input.charAt(offset);
                    if (!dictionary.findAdd(w)) {
                        output += String.fromCharCode(w.prefixIndex);
                        w.prefixIndex = w.suffix.charCodeAt(0);
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
                options.progress(Math.round(offset / input.length * 100.0));

                // more to do?
                if (offset < input.length) {
                    // next iteration
                    setTimeout(function(){ _do_compress(); }, 0);
                } else {
                    // Output remaining chars
                    output += String.fromCharCode(w.prefixIndex);
                    // all done, send result back
                    setTimeout(function(){options.result.call(null, output);},0);
                }
            }

            _do_compress();
        }




        /**
         * The de-compression dictionary.
         */
        var DecompressionDict = function(){
            var hashTable;
            var nextCode;

            this.reset = function() {
                hashTable = {};
                nextCode = 0;
                for (var i = 0; i < initialDictSize; i++)
                    hashTable[nextCode++] = String.fromCharCode(i);
            }

            this.get = function(code) {
                return (hashTable.hasOwnProperty(code) ? hashTable[code] : false);
            }

            this.add = function(str) {
                hashTable[nextCode++] = str;
            }

            this.resetIfFull = function() {
                if (maxDictSize-1 == nextCode) {
                    this.reset();
                    return true;
                }
                return false;
            }

            this.reset();
        }


        /**
         * Decompress given input string.
         *
         * @param input the input string.
         * @param options decompression options (see above).
         */
        this.decompress = function(input, options) {
            if (!options.hasOwnProperty("progress")) {
                options.progress = function(percent) {}
            }
            if (!options.hasOwnProperty("result")) {
                options.result = function(output) {}
            }

            var dictionary = new DecompressionDict();

            var w = input.charAt(0);
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
                    if (str_k) {
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
                options.progress(Math.round(offset / input.length * 100.0));

                // more to do?
                if (offset < input.length) {
                    // next iteration
                    setTimeout(function(){ _do_decompress(); }, 0);
                } else {
                    // all done, send result back
                    setTimeout(function(){options.result.call(null, output);},0);
                }
            }

            _do_decompress();
        }

    }

})();
