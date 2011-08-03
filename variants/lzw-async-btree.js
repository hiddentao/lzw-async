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
 * This implementation uses a binary search tree for constructing the compression dictionary. This is a precursor to
 * the current main implementation.
 *
 * Blog post: http://www.hiddentao.com/archives/2011/08/01/asynchronous-implementation-of-lzw-algorithm-in-javascript/
 * Source: https://github.com/hiddentao/lzw-async
 */

window.LZWAsync = (function(){

    return new function() {

        var initialDictSize = 256;  // only expecting extended ASCII characters
        var maxBitSize = 16;


        /**
         * A bit stream writer which writes bits to a Javascript string.
         */
        var BitStreamWriter = function() {
            var BitsPerCharacter = 16;  // javascript strings are UTF-16

            var str = [];
            var currentOffset = 0;
            var bitsRemainingAtCurrentOffset = BitsPerCharacter;

            /**
             * Write a value to output.
             * @param value the integer value to write.
             * @param bits the number of bits to use to write it.
             */
            this.write = function(value, bits) {
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
                    if (str.length == currentOffset) {
                        str.push(String.fromCharCode(currentOffsetCode));
                    } else {
                        str[currentOffset] = String.fromCharCode(currentOffsetCode);
                    }

                    // move onto next offset?
                    if (0 == bitsRemainingAtCurrentOffset) {
                        currentOffset++;
                        bitsRemainingAtCurrentOffset = BitsPerCharacter;
                    }
                }
            }

            /**
             * Get output string.
             */
            this.getOutput = function() {
                return str.join('');
            }
        }


        var BTree = function(str, code) {
            this.str = str;
            this.code = code;
            this.left = null;
            this.right = null;
        };


        /**
         * The compression dictionary.
         *
         * @param characterList if given then the dictionary is initialised with these characters, thus assuming that
         * the input will only contain these characters and allowing for better compression ratios.
         */
        var CompressionDict = function(characterList){
            var _self = this;
            var table;
            var nextCode;

            var eofMarkerCode = -1;



            /**
             * Get the number of bits required to represent the next available code.
             */
            this.bitSize = function() {
                return parseInt(Math.ceil(Math.log(nextCode+1) / Math.LN2));
            }

            /**
             * Reset the dictionary to its initial state.
             */
            this.reset = function() {
                table = {};
                nextCode = 0;
                if (undefined != characterList && 0 < characterList.length) {
                    for (var i=0; i<characterList.length; ++i) {
                        table[characterList.charCodeAt(i)] = new BTree(characterList.charAt(i), nextCode++);
                    }
                } else {
                    for (var i = 0; i < initialDictSize; i++) {
                        table[i] = new BTree(String.fromCharCode(i), nextCode++);
                    }
                }

                // take next available code as the stream EOF marker
                eofMarkerCode = nextCode++;
            }

            /**
             * Find whether given string is in dictionary, adding it if not so.
             *
             * Upon completion the 'code' component of the given BTree will be updated the code of the string.
             *
             * @param btree used for prefix of string
             * @param c the character forming the suffix of the string.
             * 
             * @return true if the string was already in the dictionary; false if it needed to be added.
             */
            this.findAdd = function(btree, chr, output) {
                var newstr = btree.str + chr;
                var found = true;

                if (0 <= btree.code) {
                    var tree = btree;
                    var old_tree;
                    do {
                        old_tree = tree;
                        tree = (tree.str > newstr ? tree.left : tree.right);
                    } while (null != tree && tree.str != newstr);

                    if (null != tree) {
                        btree = tree;
                    } else {
                        var newnode = new BTree(newstr, nextCode++);
                        if (old_tree.str > btree.str)
                            old_tree.left = newnode;
                        else
                            old_tree.right = newnode;

                        btree = table[chr.charCodeAt(0)];
                        found = false;
                    }
                } else {
                    btree = table[chr.charCodeAt(0)];
                }

                return {
                    found : found,
                    btree : btree,
                    nextCode : nextCode
                };
            };

            this.getEOF = function() {
                return eofMarkerCode;
            }

            _self.reset();
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

            var currentBitSize = dictionary.bitSize();
            var maxIndexAtCurrentBitSize = (1 << currentBitSize) - 1;
            var nextIndex = 0;

            var w = new BTree("",-1);

            /**
             * Recalculate bit size.
             */
            var _recalculateBitSize = function() {
                var reset = false;
                // ready to inc. bit size?
                if (maxIndexAtCurrentBitSize <= nextIndex) {
                    // if dictionary full then reset it
                    if (maxBitSize == currentBitSize) {
                        dictionary.reset();
                        currentBitSize = dictionary.bitSize();
                        reset = true;
                    } else {
                        currentBitSize++;
                    }
                    maxIndexAtCurrentBitSize = (1 << currentBitSize) - 1;
                }
                return reset;
            }

            var output = new BitStreamWriter();
            var offset = 0;

            // the algorithm
            var _do_compress = function() {

                var startTimeInMs = new Date().getTime();
                var done = 0;
                while (offset < input.length) {
                    var c = input.charAt(offset++);
                    var result = dictionary.findAdd(w, c);
                    if (!result.found) {
                        if (0 <= w.code)
                            output.write(w.code, currentBitSize);

                        nextIndex = result.nextCode;
                        if (_recalculateBitSize()) {
                            result = dictionary.findAdd(new BTree("", -1), c);
                        }
                    }

                    w = result.btree;

                    // every 10 items we check how long things took
                    done++;
                    if (0 == (done % 10)) {
                        var timeTakenInMs = new Date().getTime() - startTimeInMs;
                        if (100 < timeTakenInMs)
                            break;
                    }
                }

                // update progress
                setTimeout(function(){params.progress(Math.round(offset / input.length * 100.0));},0);

                // more to do?
                if (offset < input.length) {
                    // next iteration
                    setTimeout(function(){ _do_compress(); }, 0);
                } else {
                    // Output the code for w.
                    if (0 <= w.code)
                        output.write(w.code, currentBitSize);

                    /*
                     Output EOF marker.
                        - If we're one away from the next bit size change then do the change so that we're in sync with
                        the decompressor.
                     */
                    if (maxIndexAtCurrentBitSize-1 == nextIndex) {
                        nextIndex++;
                        _recalculateBitSize();
                    }
                    output.write(dictionary.getEOF(), currentBitSize);
                    
                    // all done, send result back
                    setTimeout(function(){params.output.call(null, output.getOutput());},0);
                }
            }

            _do_compress();
        }



        /**
         * A bit stream reader which reads bits from a Javascript string.
         * @param str the input string.
         */
        var BitStreamReader = function(str) {
            var BitsPerCharacter = 16;  // javascript strings are UTF-16

            var currentOffset = 0;
            var bitsRemainingTotal = str.length * 16;
            var bitsRemainingAtCurrentOffset = BitsPerCharacter;

            /**
             * Read the next value from the input.
             * @param bits the number of bits to read.
             * @return null if no more bits left to read in string.
             */
            this.read = function(bits) {
                if (bitsRemainingTotal < bits)
                    return null;
                bitsRemainingTotal -= bits;

                var result = 0;

                while (0 < bits) {
                    var currentOffsetCode = str.charCodeAt(currentOffset);
                    var remainingValueAtCurrentOffset = (currentOffsetCode & ((1 << bitsRemainingAtCurrentOffset) - 1));

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
                    if (0 == bitsRemainingAtCurrentOffset) {
                        currentOffset++;
                        bitsRemainingAtCurrentOffset = BitsPerCharacter;
                    }
                }

                return result;
            }


            this.percent_read = function() {
                return Math.round((currentOffset+1) / str.length * 100.0);
            }
        }




        /**
         * The de-compression dictionary.
         *
         * @param characterList if given then the dictionary is initialised with these characters, thus assuming that
         * the input will only contain these characters and allowing for better compression ratios.
         */
        var DecompressionDict = function(characterList){
            var _self = this;
            var hashTable;
            var nextCode;

            var eofMarkerCode = -1;

            /**
             * Get the number of bits required to represent the next available code.
             */
            this.bitSize = function() {
                return parseInt(Math.ceil(Math.log(nextCode+1) / Math.LN2));
            }

            this.reset = function() {
                hashTable = {};
                nextCode = 0;
                if (undefined != characterList && 0 < characterList.length) {
                    for (var i=0; i<characterList.length; ++i)
                        hashTable[nextCode++] = characterList.charAt(i);
                } else {
                    for (var i = 0; i < initialDictSize; i++)
                        hashTable[nextCode++] = String.fromCharCode(i);
                }

                eofMarkerCode = nextCode++;
            }

            /**
             * Get string corresponding to given code.
             * @return null if the code is the EOF marker; empty string if the code could not found in the dictionary;
             * otherwise the string corresponding to the code.
             */
            this.get = function(code) {
                if (null == code || eofMarkerCode == code)
                    return null;
                return (hashTable.hasOwnProperty(code) ? hashTable[code] : "");
            }

            
            this.add = function(str) {
                hashTable[nextCode++] = str;
                return nextCode;
            }

            _self.reset();
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
            var input = new BitStreamReader(params.input);

            var dictionary = new DecompressionDict(params.dict ? params.dict : undefined);

            var currentBitSize = dictionary.bitSize();
            var maxIndexAtCurrentBitSize = (1 << currentBitSize) - 2;
            var nextIndex = 0;

            /**
             * Recalculate bit size.
             */
            var _recalculateBitSize = function() {
                var full = false;
                // ready to inc. bit size?
                if (maxIndexAtCurrentBitSize <= nextIndex) {
                    // if dictionary full then reset it
                    if (maxBitSize == currentBitSize) {
                        full = true;
                        dictionary.reset();
                        currentBitSize = dictionary.bitSize();
                    } else {
                        currentBitSize++;
                    }
                    maxIndexAtCurrentBitSize = (1 << currentBitSize) - 2;
                }
                return full;
            }

            var w = dictionary.get(input.read(currentBitSize));
            var output = [w];
            var offset = 1;

            // the asynchronous decompressor
            var _do_decompress = function() {

                var startTimeInMs = new Date().getTime();
                var done = 0;
                while ("" != w)
                {
                    var entry = "";
                    var str_k = dictionary.get(input.read(currentBitSize));
                    if ("" === str_k) {
                        entry = w + w.charAt(0);
                        nextIndex = dictionary.add(entry);
                    }
                    else if (null != str_k) {
                        entry = str_k;
                        nextIndex = dictionary.add(w + entry.charAt(0));
                    } else {
                        // EOF, so exit loop
                        w = "";
                        break;
                    }

                    output.push(entry);
                    offset++;

                    // time to increase bit size?
                    if (_recalculateBitSize()) {
                        w = dictionary.get(input.read(currentBitSize));
                        if ("" != w && null != w)
                            output.push(w);
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
                setTimeout(function(){params.progress(input.percent_read());},0);

                // more to do?
                if ("" != w) {
                    // next iteration
                    setTimeout(function(){ _do_decompress(); }, 0);
                } else {
                    // all done, send result back
                    setTimeout(function(){params.output.call(null, output.join(''));},0);
                }
            }

            _do_decompress();
        }

    }

})();
