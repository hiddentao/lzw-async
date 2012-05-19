# Asynchronous Javascript implementation of LZW algorithm.

This is an efficient asynchronous implementation of the Lempel-Ziv-Welch (LZW) compression algorithm in Javascript.

## Features

* Input can contain any character from the full ASCII set (i.e. the first 256 Unicode characters).
* Runs asynchronously (both compression and decompression) and provides progress updates every 0.5 seconds.
* Supports use of a custom dictionary where input character range is known in advance. This helps to reduce compressed
size.
* Compression dictionary uses binary search tree to speed up lookups.
* Variable-length output encoding (i.e. using the minimum no. of bits necessary) for better compression ratios.
* Automated tests as well as manual testing facility (see `index.html`).
* Passes [Javascript Lint](http://www.javascriptlint.com/).
* Available for node.js via [npm](http://npmjs.org/).

Minified library size is only ~4KB (~2KB when gzipped).

## Install for browser

The **index.html** file included contains a testing form for the algorithm as well as automated tests based
on predefined data which is good at catching boundary case errors.

To use the algorithm in your own projects include the **lzw-async.js** file using a `script` tag:

    <script type="text/javascript" src="lzw-async.min.js"></script>


## Install for node.js

To use with node.js install the module:

    $ npm install lzw-async


## Examples

To compress call:

    LZWAsync.compress({
            input : "rawtext",
            output : function(output) {
                console.log(output);
            }
    });

To decompress call:

    LZWAsync.decompress({
            input : "compressedtext",
            output : function(output) {
                console.log(output);
            }
    });


To receive progress updates:

    LZWAsync.compress({
            input : "rawtext",
            output : function(output) {
                console.log(output);
            },
            progress: function (percent) {
                console.log(percent + " % done");
            }
    });

If you already know which characters will appear in the raw input then you can tell LZWAsync to restrict the
dictionary to only those characters, thereby improving the compression ratio:

    LZWAsync.compress({
            input : "rawtext",
            output : function(output) {
                console.log(output);
            },
            dict: 'abcdefghijklmnopqrstuvwxyz'
    });

**Note:** be sure to pass in the same dictionary value when decompressing in order to get the original input back.



## API

There are two methods provided within the **LZWAsync** namespace:

* **compress**
  * Compress an input string consisting of ASCII characters.

* **decompress**
  * Decompresss an input string compressed using `compress`.

Each method takes a single dictionary parameter which can contain the following entries:

* `input`
  * **Required**. This is the input string.
* `output`
  * **Required**. A callback function with the signature `function(result)`. This gets called with the resulting output
  once the compression/decompression is finished.
* `progress`
  * Optional. A callback function with the signature `function(percent)`. This gets called every a half second
  with a progress update.
* `dict`
  * Optional. A string consisting of all the characters that can be expected in the `input`. This may allow the
  algorithm to initialize a smaller dictionary and thus enable better compression ratios.


## Known limitations and future work

At the moment the compressor only accepts ASCII (upto 256) characters even though Javascript supports UTF-16 characters in its strings. For now, unless you can specify your required characters in the `dict` parameter, you should base64-encode your input prior to compression if it contains non-latin script. By base64 encoding you'll also be able to pass in a more limited dictionary character list and thereby gain greater compression ratios.

There are also dictionary optimisations which can be made to decrease the amount of memory used by the dictionary though speed will be impacted as a result.

## Useful resources

The following resources where enormously helpful:

* http://rosettacode.org/wiki/LZW_compression#JavaScript
* http://warp.povusers.org/EfficientLZW/index.html
* http://marklomas.net/ch-egg/articles/lzwjs.htm
* http://michael.dipperstein.com/lzw/


---
Developed by [Ramesh Nair](http://www.hiddentao.com/). Originally released July 2011.

* Blog post: [Link](http://www.hiddentao.com/archives/2011/08/01/asynchronous-implementation-of-lzw-algorithm-in-javascript/).
* Source code: [Github](https://github.com/hiddentao/lzw-async.js).


