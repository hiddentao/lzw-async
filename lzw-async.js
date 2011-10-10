/** @license
 * Copyright (c) 2011 by Ramesh Nair (www.hiddentao.com)
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
 * Blog post: http://www.hiddentao.com/archives/2011/08/01/asynchronous-implementation-of-lzw-algorithm-in-javascript/
 * Source: https://github.com/hiddentao/lzw-async
 */
(function () {
    // global object
    var global = this;


    // attach to global object
    (function (singletonInstance) {
        var initialBitSize = 8,    // extended ASCII
            maxBitSize = 16,        // upto UTF-16
            StringBuilder,
            DictString,
            Dictionary,
            BitStreamWriter,
            BitStreamReader;


        /**
         * Used to build up large strings, without being able to modify existing characters.
         */
        StringBuilder = function () {
            var finalStr = '';
            /**
             * Append a fragment to the string.
             */
            this.append = function (str) {
                finalStr += str;
            };
            /**
             * Get the whole string as it currently is.
             */
            this.getOutput = function () {
                return finalStr;
            };
        };

        /**
         * A bit stream writer which writes bits to a Javascripts string.
         */
        BitStreamWriter = function () {
            var BitsPerCharacter = maxBitSize,
                str = [],
                currentOffset = 0,
                bitsRemainingAtCurrentOffset = BitsPerCharacter;

            /**
             * Write a value to output.
             * @param value the integer value to write.
             * @param bits the number of bits to use to write it.
             */
            this.write = function (value, bits) {
                while (0 < bits) {
                    // get code at current offset in string
                    var currentOffsetCode = 0;
                    if (str.length > currentOffset) {
                        currentOffsetCode = str[currentOffset].charCodeAt(0);
                    }

                    // if we can't fit the whole value in the current offset
                    if (bits > bitsRemainingAtCurrentOffset) {
                        bits = bits - bitsRemainingAtCurrentOffset;
                        currentOffsetCode |= (value >> bits);
                        value &= ((1 << bits) - 1);
                        bitsRemainingAtCurrentOffset = 0;
                    // if we can fit the whole value at the current offset
                    } else {
                        bitsRemainingAtCurrentOffset -= bits;
                        currentOffsetCode |= (value << bitsRemainingAtCurrentOffset);
                        bits = 0;
                    }

                    // update string
                    str[currentOffset] = String.fromCharCode(currentOffsetCode);

                    // move onto next offset?
                    if (0 === bitsRemainingAtCurrentOffset) {
                        currentOffset++;
                        bitsRemainingAtCurrentOffset = BitsPerCharacter;
                    }
                }
            };

            /**
             * Get output string.
             */
            this.getOutput = function () {
                return str.join('');
            };
        };



        /**
         * A bit stream reader which reads bits from a Javascript string.
         * @param str the input string.
         */
        BitStreamReader = function (str) {
            var BitsPerCharacter = maxBitSize,
                currentOffset = 0,
                bitsRemainingTotal = str.length * 16,
                bitsRemainingAtCurrentOffset = BitsPerCharacter;

            /**
             * Read the next value from the input.
             * @param bits the number of bits to read.
             * @return null if no more bits left to read in string.
             */
            this.read = function (bits) {
                if (bitsRemainingTotal < bits) {
                    return null;
                }
                bitsRemainingTotal -= bits;

                var result = 0,
                    currentOffsetCode,
                    remainingValueAtCurrentOffset;

                while (0 < bits) {
                    currentOffsetCode = str.charCodeAt(currentOffset);
                    remainingValueAtCurrentOffset = (currentOffsetCode & ((1 << bitsRemainingAtCurrentOffset) - 1));

                    // if we can't get the whole value from the current offset
                    if (bits > bitsRemainingAtCurrentOffset) {
                        bits = bits - bitsRemainingAtCurrentOffset;
                        result |= remainingValueAtCurrentOffset << bits;
                        bitsRemainingAtCurrentOffset = 0;
                    // if we can get the whole value from the current offset
                    } else {
                        result |= remainingValueAtCurrentOffset >> (bitsRemainingAtCurrentOffset - bits);
                        bitsRemainingAtCurrentOffset -= bits;
                        bits = 0;
                    }

                    // move onto next offset?
                    if (0 === bitsRemainingAtCurrentOffset) {
                        currentOffset++;
                        bitsRemainingAtCurrentOffset = BitsPerCharacter;
                    }
                }

                return result;
            };


            this.percent_read = function () {
                return Math.round((currentOffset + 1) / str.length * 100.0);
            };
        };



        /**
         * Represents a string stored in the dictionary (a binary tree node).
         *
         * This is used only in the compression phase to speed up lookups.
         *
         * @param str the string. If ommitted then empty string is used.
         * @param code the index of this string in the dictionary. If ommitted then -1 is used.
         */
        DictString = function (str, code) {
            this.str = str;
            this.code = code;
            this.left = null;
            this.right = null;
        };
        /**
         * Get dummy DictString.
         */
        DictString.getDummy = function () {
            return new DictString("", -1);
        };


        /**
         * The dictionary.
         *
         * @param characterList if given then the dictionary is initialised with these characters, thus assuming that
         * the input will only contain these characters and allowing for better compression ratios.
         *
         * @param compressOrDecompress true if in compression mode; false if in decompression mode. In compression
         * mode the dictionary uses a binary search tree to store its data for maximum lookup speed. In decompression
         * mode the dictionary uses a simple Object hashtable instead of the binary search tree to maximise
         * performance (both in terms of minimal memory allocations and speed of the algorithm).
         */
        Dictionary = function (characterList, compressOrDecompress) {
            var thisDict = this,
                dictTable,
                nextCode,
                eofMarkerCode = -1;

            /**
             * Get the number of bits required to represent the next available code.
             */
            this.bitSize = function () {
                return parseInt(Math.ceil(Math.log(nextCode + 1) / Math.LN2), 10);
            };

            /**
             * Reset the dictionary to its initial state.
             */
            this.reset = function () {
                dictTable = {};
                nextCode = 0;
                var i = 0;
                if (undefined !== characterList && 0 < characterList.length) {
                    for (i = 0; i < characterList.length; ++i) {
                        if (compressOrDecompress) {
                            dictTable[characterList.charCodeAt(i)] = new DictString(characterList.charAt(i), i);
                        } else {
                            dictTable[i] = characterList.charAt(i);
                        }
                    }
                } else {
                    for (i = 0; i < (1 << initialBitSize); i++) {
                        if (compressOrDecompress) {
                            dictTable[i] = new DictString(String.fromCharCode(i), i);
                        } else {
                            dictTable[i] = String.fromCharCode(i);
                        }
                    }
                }

                nextCode = i;

                // take next available code as the stream EOF marker
                eofMarkerCode = nextCode;
                nextCode++;
            };

            /**
             * Find whether given string is in dictionary, adding it if not so.
             *
             * This is used in the compression phase.
             *
             * @param dictString the DictString representing the prefix of the string.
             * @param chr the character forming the suffix of the string.
             *
             * @return map{
             *      found : true if string found or false if it needed to be added,
             *      dictString : the DictString representing the new string,
             *      nextCode : the next available code in the dictionary
             *      }
             */
            this.findAdd = function (dictString, chr) {
                var newStr = dictString.str + chr,
                    found = true,
                    tree = dictString,
                    old_tree = null,
                    newNode;

                if (0 <= dictString.code) {
                    do {
                        old_tree = tree;
                        tree = (tree.str > newStr ? tree.left : tree.right);
                    } while (null !== tree && tree.str !== newStr);

                    if (null !== tree) {
                        dictString = tree;
                    } else {
                        newNode = new DictString(newStr, nextCode);
                        nextCode++;
                        if (old_tree.str > dictString.str) {
                            old_tree.left = newNode;
                        } else {
                            old_tree.right = newNode;
                        }

                        dictString = dictTable[chr.charCodeAt(0)];
                        found = false;
                    }
                } else {
                    dictString = dictTable[chr.charCodeAt(0)];
                }

                return {
                    found : found,
                    dictString : dictString,
                    nextCode : nextCode
                };
            };


            /**
             * Find whether code is in the dictionary. If not then add it in.
             *
             * This is used in the decompression phase.
             *
             * @param code the code to search for.
             * @param prefixStr the current prefix string the decompressor holds.
             *
             * @return map{
             *      str : the string to output,
             *      nextCode : the next available code in the dictionary
             *      }
             *      ...OR null if the code represents the EOF marker.
             */
            this.decode = function (code, prefixStr) {
                if (eofMarkerCode === code) {
                    return null;
                }

                var str = dictTable.hasOwnProperty(code) ? dictTable[code] : "";
                
                if (0 >= str.length) {
                    str = prefixStr + prefixStr.charAt(0);
                    dictTable[nextCode] = str;
                    nextCode++;
                } else if (0 < prefixStr.length) {
                    dictTable[nextCode] = prefixStr + str.charAt(0);
                    nextCode++;
                }

                return {
                    str : str,
                    nextCode: nextCode
                };
            };


            this.getEOF = function () {
                return eofMarkerCode;
            };


            thisDict.reset();
        };



        /**
         * Compress given input string.
         *
         * Parameters:-
         *   input: input string.
         *
         *   output: function (result) - gets called with the resulting output.
         *
         *   progress (optional): function (percent) - gets called every half a second or so with a progress update.
         *
         *   dict (optional): string of characters to expect in the input, and to thus limit the dictionary to.
         *
         * @param params the parameters.
         */
        singletonInstance.compress = function (params) {
            if (!params.hasOwnProperty("progress")) {
                params.progress = function () {};
            }

            var input = params.input,
                dictionary = new Dictionary(params.dict || undefined, true),
                currentBitSize = dictionary.bitSize(),
                maxIndexAtCurrentBitSize = (1 << currentBitSize) - 1,
                nextIndex = 0,
                output = new BitStreamWriter(),
                w = DictString.getDummy(),
                offset = 0,
                fnRecalculateBitSize,
                fnDoCompress;


            /**
             * Recalculate bit size.
             * @return true if dictionary was full and had to be reset; false otherwise.
             */
            fnRecalculateBitSize = function () {
                var full = false;
                // ready to inc. bit size?
                if (maxIndexAtCurrentBitSize <= nextIndex) {
                    // if dictionary full then reset it
                    if (maxBitSize === currentBitSize) {
                        dictionary.reset();
                        currentBitSize = dictionary.bitSize();
                        full = true;
                    } else {
                        currentBitSize++;
                    }
                    maxIndexAtCurrentBitSize = (1 << currentBitSize) - 1;
                }
                return full;
            };

            /**
             * The compression inner loop.
             */
            fnDoCompress = function () {

                var startTimeInMs = new Date().getTime(),
                    timeTakenInMs,
                    done = 0,
                    nextChar,
                    result;

                while (offset < input.length) {
                    nextChar = input.charAt(offset);
                    offset++;
                    result = dictionary.findAdd(w, nextChar);
                    if (!result.found) {
                        if (0 <= w.code) {
                            output.write(w.code, currentBitSize);
                        }

                        nextIndex = result.nextCode;
                        if (fnRecalculateBitSize()) {
                            result = dictionary.findAdd(DictString.getDummy(), nextChar);
                        }
                    }

                    w = result.dictString;

                    // every 10 items we check how long things took
                    done++;
                    if (0 === (done % 10)) {
                        timeTakenInMs = new Date().getTime() - startTimeInMs;
                        if (100 < timeTakenInMs) {
                            break;
                        }
                    }
                }

                // update progress
                global.setTimeout(function () {params.progress(Math.round(offset / input.length * 100.0)); }, 0);

                // more to do?
                if (offset < input.length) {
                    // next iteration
                    global.setTimeout(function () { fnDoCompress(); }, 0);
                } else {
                    // Output the code for w.
                    if (0 <= w.code) {
                        output.write(w.code, currentBitSize);
                    }

                    /*
                     Output EOF marker.
                        - If we're one away from the next bit size change then do the change so that we're in sync with
                        the decompressor.
                     */
                    if (maxIndexAtCurrentBitSize - 1 === nextIndex) {
                        nextIndex++;
                        fnRecalculateBitSize();
                    }
                    output.write(dictionary.getEOF(), currentBitSize);

                    // all done, send result back
                    global.setTimeout(function () {params.output.call(null, output.getOutput()); }, 0);
                }
            };

            fnDoCompress();
        };



        /**
         * Decompress given input string.
         *
         * Parameters:-
         *   input: input string.
         *
         *   output: function (result) - gets called with the resulting output.
         *
         *   progress (optional): function (percent) - gets called every half a second or so with a progress update.
         *
         *   dict (optional): string of characters to expect in the input, and to thus limit the dictionary to.
         *
         * @param params the parameters.
         */
        singletonInstance.decompress = function (params) {
            if (!params.hasOwnProperty("progress")) {
                params.progress = function () {};
            }
            var input = new BitStreamReader(params.input),
                dictionary = new Dictionary(params.dict || undefined, false),
                currentBitSize = dictionary.bitSize(),
                maxIndexAtCurrentBitSize = (1 << currentBitSize) - 2,
                nextIndex = 0,
                output = new StringBuilder(),
                w = "",
                fnRecalculateBitSize,
                fnDoDecompress;

            /**
             * Recalculate bit size.
             * @return true if dictionary was full and had to be reset; false otherwise.
             */
            fnRecalculateBitSize = function () {
                var full = false;
                // ready to inc. bit size?
                if (maxIndexAtCurrentBitSize <= nextIndex) {
                    // if dictionary full then reset it
                    if (maxBitSize === currentBitSize) {
                        full = true;
                        dictionary.reset();
                        currentBitSize = dictionary.bitSize();
                    } else {
                        currentBitSize++;
                    }
                    maxIndexAtCurrentBitSize = (1 << currentBitSize) - 2;
                }
                return full;
            };

            /**
             * The decompression inner loop.
             */
            fnDoDecompress = function () {

                var startTimeInMs = new Date().getTime(),
                    timeTakenInMs,
                    done = 0,
                    result = 0;

                while (null !== result) {
                    result = dictionary.decode(input.read(currentBitSize), w);
                    if (null === result) {
                        break;
                    }

                    w = result.str;
                    nextIndex = result.nextCode;
                    output.append(w);

                    // time to increase bit size?
                    if (fnRecalculateBitSize()) {
                        w = "";
                    }

                    // every 10 items we check how long things took
                    done++;
                    if (0 === (done % 10)) {
                        timeTakenInMs = new Date().getTime() - startTimeInMs;
                        if (100 < timeTakenInMs) {
                            break;
                        }
                    }
                }

                // update progress
                global.setTimeout(function () {params.progress(input.percent_read()); }, 0);

                // more to do?
                if (null !== result) {
                    // next iteration
                    global.setTimeout(function () { fnDoDecompress(); }, 0);
                } else {
                    // all done, send result back
                    global.setTimeout(function () {params.output.call(null, output.getOutput()); }, 0);
                }
            };

            fnDoDecompress();
        }; // decompresss

    }(typeof exports === 'undefined' ? global.LZWAsync = {} : exports)); // LZWAsync

}());
