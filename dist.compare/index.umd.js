(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.EventBus = {}));
})(this, (function (exports) { 'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    function getAugmentedNamespace(n) {
      var f = n.default;
    	if (typeof f == "function") {
    		var a = function () {
    			return f.apply(this, arguments);
    		};
    		a.prototype = f.prototype;
      } else a = {};
      Object.defineProperty(a, '__esModule', {value: true});
    	Object.keys(n).forEach(function (k) {
    		var d = Object.getOwnPropertyDescriptor(n, k);
    		Object.defineProperty(a, k, d.get ? d : {
    			enumerable: true,
    			get: function () {
    				return n[k];
    			}
    		});
    	});
    	return a;
    }

    /*! https://mths.be/punycode v1.4.1 by @mathias */


    /** Highest positive signed 32-bit float value */
    var maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

    /** Bootstring parameters */
    var base = 36;
    var tMin = 1;
    var tMax = 26;
    var skew = 38;
    var damp = 700;
    var initialBias = 72;
    var initialN = 128; // 0x80
    var delimiter = '-'; // '\x2D'
    var regexNonASCII = /[^\x20-\x7E]/; // unprintable ASCII chars + non-ASCII chars
    var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

    /** Error messages */
    var errors = {
      'overflow': 'Overflow: input needs wider integers to process',
      'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
      'invalid-input': 'Invalid input'
    };

    /** Convenience shortcuts */
    var baseMinusTMin = base - tMin;
    var floor = Math.floor;
    var stringFromCharCode = String.fromCharCode;

    /*--------------------------------------------------------------------------*/

    /**
     * A generic error utility function.
     * @private
     * @param {String} type The error type.
     * @returns {Error} Throws a `RangeError` with the applicable error message.
     */
    function error(type) {
      throw new RangeError(errors[type]);
    }

    /**
     * A generic `Array#map` utility function.
     * @private
     * @param {Array} array The array to iterate over.
     * @param {Function} callback The function that gets called for every array
     * item.
     * @returns {Array} A new array of values returned by the callback function.
     */
    function map$1(array, fn) {
      var length = array.length;
      var result = [];
      while (length--) {
        result[length] = fn(array[length]);
      }
      return result;
    }

    /**
     * A simple `Array#map`-like wrapper to work with domain name strings or email
     * addresses.
     * @private
     * @param {String} domain The domain name or email address.
     * @param {Function} callback The function that gets called for every
     * character.
     * @returns {Array} A new string of characters returned by the callback
     * function.
     */
    function mapDomain(string, fn) {
      var parts = string.split('@');
      var result = '';
      if (parts.length > 1) {
        // In email addresses, only the domain name should be punycoded. Leave
        // the local part (i.e. everything up to `@`) intact.
        result = parts[0] + '@';
        string = parts[1];
      }
      // Avoid `split(regex)` for IE8 compatibility. See #17.
      string = string.replace(regexSeparators, '\x2E');
      var labels = string.split('.');
      var encoded = map$1(labels, fn).join('.');
      return result + encoded;
    }

    /**
     * Creates an array containing the numeric code points of each Unicode
     * character in the string. While JavaScript uses UCS-2 internally,
     * this function will convert a pair of surrogate halves (each of which
     * UCS-2 exposes as separate characters) into a single code point,
     * matching UTF-16.
     * @see `punycode.ucs2.encode`
     * @see <https://mathiasbynens.be/notes/javascript-encoding>
     * @memberOf punycode.ucs2
     * @name decode
     * @param {String} string The Unicode input string (UCS-2).
     * @returns {Array} The new array of code points.
     */
    function ucs2decode(string) {
      var output = [],
        counter = 0,
        length = string.length,
        value,
        extra;
      while (counter < length) {
        value = string.charCodeAt(counter++);
        if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
          // high surrogate, and there is a next character
          extra = string.charCodeAt(counter++);
          if ((extra & 0xFC00) == 0xDC00) { // low surrogate
            output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
          } else {
            // unmatched surrogate; only append this code unit, in case the next
            // code unit is the high surrogate of a surrogate pair
            output.push(value);
            counter--;
          }
        } else {
          output.push(value);
        }
      }
      return output;
    }

    /**
     * Converts a digit/integer into a basic code point.
     * @see `basicToDigit()`
     * @private
     * @param {Number} digit The numeric value of a basic code point.
     * @returns {Number} The basic code point whose value (when used for
     * representing integers) is `digit`, which needs to be in the range
     * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
     * used; else, the lowercase form is used. The behavior is undefined
     * if `flag` is non-zero and `digit` has no uppercase form.
     */
    function digitToBasic(digit, flag) {
      //  0..25 map to ASCII a..z or A..Z
      // 26..35 map to ASCII 0..9
      return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
    }

    /**
     * Bias adaptation function as per section 3.4 of RFC 3492.
     * https://tools.ietf.org/html/rfc3492#section-3.4
     * @private
     */
    function adapt(delta, numPoints, firstTime) {
      var k = 0;
      delta = firstTime ? floor(delta / damp) : delta >> 1;
      delta += floor(delta / numPoints);
      for ( /* no initialization */ ; delta > baseMinusTMin * tMax >> 1; k += base) {
        delta = floor(delta / baseMinusTMin);
      }
      return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
    }

    /**
     * Converts a string of Unicode symbols (e.g. a domain name label) to a
     * Punycode string of ASCII-only symbols.
     * @memberOf punycode
     * @param {String} input The string of Unicode symbols.
     * @returns {String} The resulting Punycode string of ASCII-only symbols.
     */
    function encode(input) {
      var n,
        delta,
        handledCPCount,
        basicLength,
        bias,
        j,
        m,
        q,
        k,
        t,
        currentValue,
        output = [],
        /** `inputLength` will hold the number of code points in `input`. */
        inputLength,
        /** Cached calculation results */
        handledCPCountPlusOne,
        baseMinusT,
        qMinusT;

      // Convert the input in UCS-2 to Unicode
      input = ucs2decode(input);

      // Cache the length
      inputLength = input.length;

      // Initialize the state
      n = initialN;
      delta = 0;
      bias = initialBias;

      // Handle the basic code points
      for (j = 0; j < inputLength; ++j) {
        currentValue = input[j];
        if (currentValue < 0x80) {
          output.push(stringFromCharCode(currentValue));
        }
      }

      handledCPCount = basicLength = output.length;

      // `handledCPCount` is the number of code points that have been handled;
      // `basicLength` is the number of basic code points.

      // Finish the basic string - if it is not empty - with a delimiter
      if (basicLength) {
        output.push(delimiter);
      }

      // Main encoding loop:
      while (handledCPCount < inputLength) {

        // All non-basic code points < n have been handled already. Find the next
        // larger one:
        for (m = maxInt, j = 0; j < inputLength; ++j) {
          currentValue = input[j];
          if (currentValue >= n && currentValue < m) {
            m = currentValue;
          }
        }

        // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
        // but guard against overflow
        handledCPCountPlusOne = handledCPCount + 1;
        if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
          error('overflow');
        }

        delta += (m - n) * handledCPCountPlusOne;
        n = m;

        for (j = 0; j < inputLength; ++j) {
          currentValue = input[j];

          if (currentValue < n && ++delta > maxInt) {
            error('overflow');
          }

          if (currentValue == n) {
            // Represent delta as a generalized variable-length integer
            for (q = delta, k = base; /* no condition */ ; k += base) {
              t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
              if (q < t) {
                break;
              }
              qMinusT = q - t;
              baseMinusT = base - t;
              output.push(
                stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
              );
              q = floor(qMinusT / baseMinusT);
            }

            output.push(stringFromCharCode(digitToBasic(q, 0)));
            bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
            delta = 0;
            ++handledCPCount;
          }
        }

        ++delta;
        ++n;

      }
      return output.join('');
    }

    /**
     * Converts a Unicode string representing a domain name or an email address to
     * Punycode. Only the non-ASCII parts of the domain name will be converted,
     * i.e. it doesn't matter if you call it with a domain that's already in
     * ASCII.
     * @memberOf punycode
     * @param {String} input The domain name or email address to convert, as a
     * Unicode string.
     * @returns {String} The Punycode representation of the given domain name or
     * email address.
     */
    function toASCII(input) {
      return mapDomain(input, function(string) {
        return regexNonASCII.test(string) ?
          'xn--' + encode(string) :
          string;
      });
    }

    function isNull(arg) {
      return arg === null;
    }

    function isNullOrUndefined(arg) {
      return arg == null;
    }

    function isString(arg) {
      return typeof arg === 'string';
    }

    function isObject(arg) {
      return typeof arg === 'object' && arg !== null;
    }

    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.


    // If obj.hasOwnProperty has been overridden, then calling
    // obj.hasOwnProperty(prop) will break.
    // See: https://github.com/joyent/node/issues/1707
    function hasOwnProperty(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    }
    var isArray = Array.isArray || function (xs) {
      return Object.prototype.toString.call(xs) === '[object Array]';
    };
    function stringifyPrimitive(v) {
      switch (typeof v) {
        case 'string':
          return v;

        case 'boolean':
          return v ? 'true' : 'false';

        case 'number':
          return isFinite(v) ? v : '';

        default:
          return '';
      }
    }

    function stringify (obj, sep, eq, name) {
      sep = sep || '&';
      eq = eq || '=';
      if (obj === null) {
        obj = undefined;
      }

      if (typeof obj === 'object') {
        return map(objectKeys(obj), function(k) {
          var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
          if (isArray(obj[k])) {
            return map(obj[k], function(v) {
              return ks + encodeURIComponent(stringifyPrimitive(v));
            }).join(sep);
          } else {
            return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
          }
        }).join(sep);

      }

      if (!name) return '';
      return encodeURIComponent(stringifyPrimitive(name)) + eq +
             encodeURIComponent(stringifyPrimitive(obj));
    }
    function map (xs, f) {
      if (xs.map) return xs.map(f);
      var res = [];
      for (var i = 0; i < xs.length; i++) {
        res.push(f(xs[i], i));
      }
      return res;
    }

    var objectKeys = Object.keys || function (obj) {
      var res = [];
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
      }
      return res;
    };

    function parse$1(qs, sep, eq, options) {
      sep = sep || '&';
      eq = eq || '=';
      var obj = {};

      if (typeof qs !== 'string' || qs.length === 0) {
        return obj;
      }

      var regexp = /\+/g;
      qs = qs.split(sep);

      var maxKeys = 1000;
      if (options && typeof options.maxKeys === 'number') {
        maxKeys = options.maxKeys;
      }

      var len = qs.length;
      // maxKeys <= 0 means that we should not limit keys count
      if (maxKeys > 0 && len > maxKeys) {
        len = maxKeys;
      }

      for (var i = 0; i < len; ++i) {
        var x = qs[i].replace(regexp, '%20'),
            idx = x.indexOf(eq),
            kstr, vstr, k, v;

        if (idx >= 0) {
          kstr = x.substr(0, idx);
          vstr = x.substr(idx + 1);
        } else {
          kstr = x;
          vstr = '';
        }

        k = decodeURIComponent(kstr);
        v = decodeURIComponent(vstr);

        if (!hasOwnProperty(obj, k)) {
          obj[k] = v;
        } else if (isArray(obj[k])) {
          obj[k].push(v);
        } else {
          obj[k] = [obj[k], v];
        }
      }

      return obj;
    }

    // Copyright Joyent, Inc. and other Node contributors.
    var url = {
      parse: urlParse,
      resolve: urlResolve,
      resolveObject: urlResolveObject,
      format: urlFormat,
      Url: Url
    };
    function Url() {
      this.protocol = null;
      this.slashes = null;
      this.auth = null;
      this.host = null;
      this.port = null;
      this.hostname = null;
      this.hash = null;
      this.search = null;
      this.query = null;
      this.pathname = null;
      this.path = null;
      this.href = null;
    }

    // Reference: RFC 3986, RFC 1808, RFC 2396

    // define these here so at least they only have to be
    // compiled once on the first module load.
    var protocolPattern = /^([a-z0-9.+-]+:)/i,
      portPattern = /:[0-9]*$/,

      // Special case for a simple path URL
      simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

      // RFC 2396: characters reserved for delimiting URLs.
      // We actually just auto-escape these.
      delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

      // RFC 2396: characters not allowed for various reasons.
      unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

      // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
      autoEscape = ['\''].concat(unwise),
      // Characters that are never ever allowed in a hostname.
      // Note that any invalid chars are also handled, but these
      // are the ones that are *expected* to be seen, so we fast-path
      // them.
      nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
      hostEndingChars = ['/', '?', '#'],
      hostnameMaxLen = 255,
      hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
      hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
      // protocols that can allow "unsafe" and "unwise" chars.
      unsafeProtocol = {
        'javascript': true,
        'javascript:': true
      },
      // protocols that never have a hostname.
      hostlessProtocol = {
        'javascript': true,
        'javascript:': true
      },
      // protocols that always contain a // bit.
      slashedProtocol = {
        'http': true,
        'https': true,
        'ftp': true,
        'gopher': true,
        'file': true,
        'http:': true,
        'https:': true,
        'ftp:': true,
        'gopher:': true,
        'file:': true
      };

    function urlParse(url, parseQueryString, slashesDenoteHost) {
      if (url && isObject(url) && url instanceof Url) return url;

      var u = new Url;
      u.parse(url, parseQueryString, slashesDenoteHost);
      return u;
    }
    Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
      return parse(this, url, parseQueryString, slashesDenoteHost);
    };

    function parse(self, url, parseQueryString, slashesDenoteHost) {
      if (!isString(url)) {
        throw new TypeError('Parameter \'url\' must be a string, not ' + typeof url);
      }

      // Copy chrome, IE, opera backslash-handling behavior.
      // Back slashes before the query string get converted to forward slashes
      // See: https://code.google.com/p/chromium/issues/detail?id=25916
      var queryIndex = url.indexOf('?'),
        splitter =
        (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
        uSplit = url.split(splitter),
        slashRegex = /\\/g;
      uSplit[0] = uSplit[0].replace(slashRegex, '/');
      url = uSplit.join(splitter);

      var rest = url;

      // trim before proceeding.
      // This is to support parse stuff like "  http://foo.com  \n"
      rest = rest.trim();

      if (!slashesDenoteHost && url.split('#').length === 1) {
        // Try fast path regexp
        var simplePath = simplePathPattern.exec(rest);
        if (simplePath) {
          self.path = rest;
          self.href = rest;
          self.pathname = simplePath[1];
          if (simplePath[2]) {
            self.search = simplePath[2];
            if (parseQueryString) {
              self.query = parse$1(self.search.substr(1));
            } else {
              self.query = self.search.substr(1);
            }
          } else if (parseQueryString) {
            self.search = '';
            self.query = {};
          }
          return self;
        }
      }

      var proto = protocolPattern.exec(rest);
      if (proto) {
        proto = proto[0];
        var lowerProto = proto.toLowerCase();
        self.protocol = lowerProto;
        rest = rest.substr(proto.length);
      }

      // figure out if it's got a host
      // user@server is *always* interpreted as a hostname, and url
      // resolution will treat //foo/bar as host=foo,path=bar because that's
      // how the browser resolves relative URLs.
      if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
        var slashes = rest.substr(0, 2) === '//';
        if (slashes && !(proto && hostlessProtocol[proto])) {
          rest = rest.substr(2);
          self.slashes = true;
        }
      }
      var i, hec, l, p;
      if (!hostlessProtocol[proto] &&
        (slashes || (proto && !slashedProtocol[proto]))) {

        // there's a hostname.
        // the first instance of /, ?, ;, or # ends the host.
        //
        // If there is an @ in the hostname, then non-host chars *are* allowed
        // to the left of the last @ sign, unless some host-ending character
        // comes *before* the @-sign.
        // URLs are obnoxious.
        //
        // ex:
        // http://a@b@c/ => user:a@b host:c
        // http://a@b?@c => user:a host:c path:/?@c

        // v0.12 TODO(isaacs): This is not quite how Chrome does things.
        // Review our test case against browsers more comprehensively.

        // find the first instance of any hostEndingChars
        var hostEnd = -1;
        for (i = 0; i < hostEndingChars.length; i++) {
          hec = rest.indexOf(hostEndingChars[i]);
          if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
            hostEnd = hec;
        }

        // at this point, either we have an explicit point where the
        // auth portion cannot go past, or the last @ char is the decider.
        var auth, atSign;
        if (hostEnd === -1) {
          // atSign can be anywhere.
          atSign = rest.lastIndexOf('@');
        } else {
          // atSign must be in auth portion.
          // http://a@b/c@d => host:b auth:a path:/c@d
          atSign = rest.lastIndexOf('@', hostEnd);
        }

        // Now we have a portion which is definitely the auth.
        // Pull that off.
        if (atSign !== -1) {
          auth = rest.slice(0, atSign);
          rest = rest.slice(atSign + 1);
          self.auth = decodeURIComponent(auth);
        }

        // the host is the remaining to the left of the first non-host char
        hostEnd = -1;
        for (i = 0; i < nonHostChars.length; i++) {
          hec = rest.indexOf(nonHostChars[i]);
          if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
            hostEnd = hec;
        }
        // if we still have not hit it, then the entire thing is a host.
        if (hostEnd === -1)
          hostEnd = rest.length;

        self.host = rest.slice(0, hostEnd);
        rest = rest.slice(hostEnd);

        // pull out port.
        parseHost(self);

        // we've indicated that there is a hostname,
        // so even if it's empty, it has to be present.
        self.hostname = self.hostname || '';

        // if hostname begins with [ and ends with ]
        // assume that it's an IPv6 address.
        var ipv6Hostname = self.hostname[0] === '[' &&
          self.hostname[self.hostname.length - 1] === ']';

        // validate a little.
        if (!ipv6Hostname) {
          var hostparts = self.hostname.split(/\./);
          for (i = 0, l = hostparts.length; i < l; i++) {
            var part = hostparts[i];
            if (!part) continue;
            if (!part.match(hostnamePartPattern)) {
              var newpart = '';
              for (var j = 0, k = part.length; j < k; j++) {
                if (part.charCodeAt(j) > 127) {
                  // we replace non-ASCII char with a temporary placeholder
                  // we need this to make sure size of hostname is not
                  // broken by replacing non-ASCII by nothing
                  newpart += 'x';
                } else {
                  newpart += part[j];
                }
              }
              // we test again with ASCII char only
              if (!newpart.match(hostnamePartPattern)) {
                var validParts = hostparts.slice(0, i);
                var notHost = hostparts.slice(i + 1);
                var bit = part.match(hostnamePartStart);
                if (bit) {
                  validParts.push(bit[1]);
                  notHost.unshift(bit[2]);
                }
                if (notHost.length) {
                  rest = '/' + notHost.join('.') + rest;
                }
                self.hostname = validParts.join('.');
                break;
              }
            }
          }
        }

        if (self.hostname.length > hostnameMaxLen) {
          self.hostname = '';
        } else {
          // hostnames are always lower case.
          self.hostname = self.hostname.toLowerCase();
        }

        if (!ipv6Hostname) {
          // IDNA Support: Returns a punycoded representation of "domain".
          // It only converts parts of the domain name that
          // have non-ASCII characters, i.e. it doesn't matter if
          // you call it with a domain that already is ASCII-only.
          self.hostname = toASCII(self.hostname);
        }

        p = self.port ? ':' + self.port : '';
        var h = self.hostname || '';
        self.host = h + p;
        self.href += self.host;

        // strip [ and ] from the hostname
        // the host field still retains them, though
        if (ipv6Hostname) {
          self.hostname = self.hostname.substr(1, self.hostname.length - 2);
          if (rest[0] !== '/') {
            rest = '/' + rest;
          }
        }
      }

      // now rest is set to the post-host stuff.
      // chop off any delim chars.
      if (!unsafeProtocol[lowerProto]) {

        // First, make 100% sure that any "autoEscape" chars get
        // escaped, even if encodeURIComponent doesn't think they
        // need to be.
        for (i = 0, l = autoEscape.length; i < l; i++) {
          var ae = autoEscape[i];
          if (rest.indexOf(ae) === -1)
            continue;
          var esc = encodeURIComponent(ae);
          if (esc === ae) {
            esc = escape(ae);
          }
          rest = rest.split(ae).join(esc);
        }
      }


      // chop off from the tail first.
      var hash = rest.indexOf('#');
      if (hash !== -1) {
        // got a fragment string.
        self.hash = rest.substr(hash);
        rest = rest.slice(0, hash);
      }
      var qm = rest.indexOf('?');
      if (qm !== -1) {
        self.search = rest.substr(qm);
        self.query = rest.substr(qm + 1);
        if (parseQueryString) {
          self.query = parse$1(self.query);
        }
        rest = rest.slice(0, qm);
      } else if (parseQueryString) {
        // no query string, but parseQueryString still requested
        self.search = '';
        self.query = {};
      }
      if (rest) self.pathname = rest;
      if (slashedProtocol[lowerProto] &&
        self.hostname && !self.pathname) {
        self.pathname = '/';
      }

      //to support http.request
      if (self.pathname || self.search) {
        p = self.pathname || '';
        var s = self.search || '';
        self.path = p + s;
      }

      // finally, reconstruct the href based on what has been validated.
      self.href = format(self);
      return self;
    }

    // format a parsed object into a url string
    function urlFormat(obj) {
      // ensure it's an object, and not a string url.
      // If it's an obj, this is a no-op.
      // this way, you can call url_format() on strings
      // to clean up potentially wonky urls.
      if (isString(obj)) obj = parse({}, obj);
      return format(obj);
    }

    function format(self) {
      var auth = self.auth || '';
      if (auth) {
        auth = encodeURIComponent(auth);
        auth = auth.replace(/%3A/i, ':');
        auth += '@';
      }

      var protocol = self.protocol || '',
        pathname = self.pathname || '',
        hash = self.hash || '',
        host = false,
        query = '';

      if (self.host) {
        host = auth + self.host;
      } else if (self.hostname) {
        host = auth + (self.hostname.indexOf(':') === -1 ?
          self.hostname :
          '[' + this.hostname + ']');
        if (self.port) {
          host += ':' + self.port;
        }
      }

      if (self.query &&
        isObject(self.query) &&
        Object.keys(self.query).length) {
        query = stringify(self.query);
      }

      var search = self.search || (query && ('?' + query)) || '';

      if (protocol && protocol.substr(-1) !== ':') protocol += ':';

      // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
      // unless they had them to begin with.
      if (self.slashes ||
        (!protocol || slashedProtocol[protocol]) && host !== false) {
        host = '//' + (host || '');
        if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
      } else if (!host) {
        host = '';
      }

      if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
      if (search && search.charAt(0) !== '?') search = '?' + search;

      pathname = pathname.replace(/[?#]/g, function(match) {
        return encodeURIComponent(match);
      });
      search = search.replace('#', '%23');

      return protocol + host + pathname + search + hash;
    }

    Url.prototype.format = function() {
      return format(this);
    };

    function urlResolve(source, relative) {
      return urlParse(source, false, true).resolve(relative);
    }

    Url.prototype.resolve = function(relative) {
      return this.resolveObject(urlParse(relative, false, true)).format();
    };

    function urlResolveObject(source, relative) {
      if (!source) return relative;
      return urlParse(source, false, true).resolveObject(relative);
    }

    Url.prototype.resolveObject = function(relative) {
      if (isString(relative)) {
        var rel = new Url();
        rel.parse(relative, false, true);
        relative = rel;
      }

      var result = new Url();
      var tkeys = Object.keys(this);
      for (var tk = 0; tk < tkeys.length; tk++) {
        var tkey = tkeys[tk];
        result[tkey] = this[tkey];
      }

      // hash is always overridden, no matter what.
      // even href="" will remove it.
      result.hash = relative.hash;

      // if the relative url is empty, then there's nothing left to do here.
      if (relative.href === '') {
        result.href = result.format();
        return result;
      }

      // hrefs like //foo/bar always cut to the protocol.
      if (relative.slashes && !relative.protocol) {
        // take everything except the protocol from relative
        var rkeys = Object.keys(relative);
        for (var rk = 0; rk < rkeys.length; rk++) {
          var rkey = rkeys[rk];
          if (rkey !== 'protocol')
            result[rkey] = relative[rkey];
        }

        //urlParse appends trailing / to urls like http://www.example.com
        if (slashedProtocol[result.protocol] &&
          result.hostname && !result.pathname) {
          result.path = result.pathname = '/';
        }

        result.href = result.format();
        return result;
      }
      var relPath;
      if (relative.protocol && relative.protocol !== result.protocol) {
        // if it's a known url protocol, then changing
        // the protocol does weird things
        // first, if it's not file:, then we MUST have a host,
        // and if there was a path
        // to begin with, then we MUST have a path.
        // if it is file:, then the host is dropped,
        // because that's known to be hostless.
        // anything else is assumed to be absolute.
        if (!slashedProtocol[relative.protocol]) {
          var keys = Object.keys(relative);
          for (var v = 0; v < keys.length; v++) {
            var k = keys[v];
            result[k] = relative[k];
          }
          result.href = result.format();
          return result;
        }

        result.protocol = relative.protocol;
        if (!relative.host && !hostlessProtocol[relative.protocol]) {
          relPath = (relative.pathname || '').split('/');
          while (relPath.length && !(relative.host = relPath.shift()));
          if (!relative.host) relative.host = '';
          if (!relative.hostname) relative.hostname = '';
          if (relPath[0] !== '') relPath.unshift('');
          if (relPath.length < 2) relPath.unshift('');
          result.pathname = relPath.join('/');
        } else {
          result.pathname = relative.pathname;
        }
        result.search = relative.search;
        result.query = relative.query;
        result.host = relative.host || '';
        result.auth = relative.auth;
        result.hostname = relative.hostname || relative.host;
        result.port = relative.port;
        // to support http.request
        if (result.pathname || result.search) {
          var p = result.pathname || '';
          var s = result.search || '';
          result.path = p + s;
        }
        result.slashes = result.slashes || relative.slashes;
        result.href = result.format();
        return result;
      }

      var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
        isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
        ),
        mustEndAbs = (isRelAbs || isSourceAbs ||
          (result.host && relative.pathname)),
        removeAllDots = mustEndAbs,
        srcPath = result.pathname && result.pathname.split('/') || [],
        psychotic = result.protocol && !slashedProtocol[result.protocol];
      relPath = relative.pathname && relative.pathname.split('/') || [];
      // if the url is a non-slashed url, then relative
      // links like ../.. should be able
      // to crawl up to the hostname, as well.  This is strange.
      // result.protocol has already been set by now.
      // Later on, put the first path part into the host field.
      if (psychotic) {
        result.hostname = '';
        result.port = null;
        if (result.host) {
          if (srcPath[0] === '') srcPath[0] = result.host;
          else srcPath.unshift(result.host);
        }
        result.host = '';
        if (relative.protocol) {
          relative.hostname = null;
          relative.port = null;
          if (relative.host) {
            if (relPath[0] === '') relPath[0] = relative.host;
            else relPath.unshift(relative.host);
          }
          relative.host = null;
        }
        mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
      }
      var authInHost;
      if (isRelAbs) {
        // it's absolute.
        result.host = (relative.host || relative.host === '') ?
          relative.host : result.host;
        result.hostname = (relative.hostname || relative.hostname === '') ?
          relative.hostname : result.hostname;
        result.search = relative.search;
        result.query = relative.query;
        srcPath = relPath;
        // fall through to the dot-handling below.
      } else if (relPath.length) {
        // it's relative
        // throw away the existing file, and take the new path instead.
        if (!srcPath) srcPath = [];
        srcPath.pop();
        srcPath = srcPath.concat(relPath);
        result.search = relative.search;
        result.query = relative.query;
      } else if (!isNullOrUndefined(relative.search)) {
        // just pull out the search.
        // like href='?foo'.
        // Put this after the other two cases because it simplifies the booleans
        if (psychotic) {
          result.hostname = result.host = srcPath.shift();
          //occationaly the auth can get stuck only in host
          //this especially happens in cases like
          //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
          authInHost = result.host && result.host.indexOf('@') > 0 ?
            result.host.split('@') : false;
          if (authInHost) {
            result.auth = authInHost.shift();
            result.host = result.hostname = authInHost.shift();
          }
        }
        result.search = relative.search;
        result.query = relative.query;
        //to support http.request
        if (!isNull(result.pathname) || !isNull(result.search)) {
          result.path = (result.pathname ? result.pathname : '') +
            (result.search ? result.search : '');
        }
        result.href = result.format();
        return result;
      }

      if (!srcPath.length) {
        // no path at all.  easy.
        // we've already handled the other stuff above.
        result.pathname = null;
        //to support http.request
        if (result.search) {
          result.path = '/' + result.search;
        } else {
          result.path = null;
        }
        result.href = result.format();
        return result;
      }

      // if a url ENDs in . or .., then it must get a trailing slash.
      // however, if it ends in anything else non-slashy,
      // then it must NOT get a trailing slash.
      var last = srcPath.slice(-1)[0];
      var hasTrailingSlash = (
        (result.host || relative.host || srcPath.length > 1) &&
        (last === '.' || last === '..') || last === '');

      // strip single dots, resolve double dots to parent dir
      // if the path tries to go above the root, `up` ends up > 0
      var up = 0;
      for (var i = srcPath.length; i >= 0; i--) {
        last = srcPath[i];
        if (last === '.') {
          srcPath.splice(i, 1);
        } else if (last === '..') {
          srcPath.splice(i, 1);
          up++;
        } else if (up) {
          srcPath.splice(i, 1);
          up--;
        }
      }

      // if the path is allowed to go above the root, restore leading ..s
      if (!mustEndAbs && !removeAllDots) {
        for (; up--; up) {
          srcPath.unshift('..');
        }
      }

      if (mustEndAbs && srcPath[0] !== '' &&
        (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
        srcPath.unshift('');
      }

      if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
        srcPath.push('');
      }

      var isAbsolute = srcPath[0] === '' ||
        (srcPath[0] && srcPath[0].charAt(0) === '/');

      // put the host back
      if (psychotic) {
        result.hostname = result.host = isAbsolute ? '' :
          srcPath.length ? srcPath.shift() : '';
        //occationaly the auth can get stuck only in host
        //this especially happens in cases like
        //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
        authInHost = result.host && result.host.indexOf('@') > 0 ?
          result.host.split('@') : false;
        if (authInHost) {
          result.auth = authInHost.shift();
          result.host = result.hostname = authInHost.shift();
        }
      }

      mustEndAbs = mustEndAbs || (result.host && srcPath.length);

      if (mustEndAbs && !isAbsolute) {
        srcPath.unshift('');
      }

      if (!srcPath.length) {
        result.pathname = null;
        result.path = null;
      } else {
        result.pathname = srcPath.join('/');
      }

      //to support request.http
      if (!isNull(result.pathname) || !isNull(result.search)) {
        result.path = (result.pathname ? result.pathname : '') +
          (result.search ? result.search : '');
      }
      result.auth = relative.auth || result.auth;
      result.slashes = result.slashes || relative.slashes;
      result.href = result.format();
      return result;
    };

    Url.prototype.parseHost = function() {
      return parseHost(this);
    };

    function parseHost(self) {
      var host = self.host;
      var port = portPattern.exec(host);
      if (port) {
        port = port[0];
        if (port !== ':') {
          self.port = port.substr(1);
        }
        host = host.substr(0, host.length - port.length);
      }
      if (host) self.hostname = host;
    }

    var url$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        parse: urlParse,
        resolve: urlResolve,
        resolveObject: urlResolveObject,
        format: urlFormat,
        'default': url,
        Url: Url
    });

    var require$$0 = /*@__PURE__*/getAugmentedNamespace(url$1);

    var helpers$3 = {};

    var uri = require$$0;

    var ValidationError = helpers$3.ValidationError = function ValidationError (message, instance, schema, path, name, argument) {
      if(Array.isArray(path)){
        this.path = path;
        this.property = path.reduce(function(sum, item){
          return sum + makeSuffix(item);
        }, 'instance');
      }else if(path !== undefined){
        this.property = path;
      }
      if (message) {
        this.message = message;
      }
      if (schema) {
        var id = schema.$id || schema.id;
        this.schema = id || schema;
      }
      if (instance !== undefined) {
        this.instance = instance;
      }
      this.name = name;
      this.argument = argument;
      this.stack = this.toString();
    };

    ValidationError.prototype.toString = function toString() {
      return this.property + ' ' + this.message;
    };

    var ValidatorResult$2 = helpers$3.ValidatorResult = function ValidatorResult(instance, schema, options, ctx) {
      this.instance = instance;
      this.schema = schema;
      this.options = options;
      this.path = ctx.path;
      this.propertyPath = ctx.propertyPath;
      this.errors = [];
      this.throwError = options && options.throwError;
      this.throwFirst = options && options.throwFirst;
      this.throwAll = options && options.throwAll;
      this.disableFormat = options && options.disableFormat === true;
    };

    ValidatorResult$2.prototype.addError = function addError(detail) {
      var err;
      if (typeof detail == 'string') {
        err = new ValidationError(detail, this.instance, this.schema, this.path);
      } else {
        if (!detail) throw new Error('Missing error detail');
        if (!detail.message) throw new Error('Missing error message');
        if (!detail.name) throw new Error('Missing validator type');
        err = new ValidationError(detail.message, this.instance, this.schema, this.path, detail.name, detail.argument);
      }

      this.errors.push(err);
      if (this.throwFirst) {
        throw new ValidatorResultError$1(this);
      }else if(this.throwError){
        throw err;
      }
      return err;
    };

    ValidatorResult$2.prototype.importErrors = function importErrors(res) {
      if (typeof res == 'string' || (res && res.validatorType)) {
        this.addError(res);
      } else if (res && res.errors) {
        this.errors = this.errors.concat(res.errors);
      }
    };

    function stringizer (v,i){
      return i+': '+v.toString()+'\n';
    }
    ValidatorResult$2.prototype.toString = function toString(res) {
      return this.errors.map(stringizer).join('');
    };

    Object.defineProperty(ValidatorResult$2.prototype, "valid", { get: function() {
      return !this.errors.length;
    } });

    helpers$3.ValidatorResultError = ValidatorResultError$1;
    function ValidatorResultError$1(result) {
      if(Error.captureStackTrace){
        Error.captureStackTrace(this, ValidatorResultError$1);
      }
      this.instance = result.instance;
      this.schema = result.schema;
      this.options = result.options;
      this.errors = result.errors;
    }
    ValidatorResultError$1.prototype = new Error();
    ValidatorResultError$1.prototype.constructor = ValidatorResultError$1;
    ValidatorResultError$1.prototype.name = "Validation Error";

    /**
     * Describes a problem with a Schema which prevents validation of an instance
     * @name SchemaError
     * @constructor
     */
    var SchemaError$2 = helpers$3.SchemaError = function SchemaError (msg, schema) {
      this.message = msg;
      this.schema = schema;
      Error.call(this, msg);
      Error.captureStackTrace(this, SchemaError);
    };
    SchemaError$2.prototype = Object.create(Error.prototype,
      {
        constructor: {value: SchemaError$2, enumerable: false},
        name: {value: 'SchemaError', enumerable: false},
      });

    var SchemaContext$1 = helpers$3.SchemaContext = function SchemaContext (schema, options, path, base, schemas) {
      this.schema = schema;
      this.options = options;
      if(Array.isArray(path)){
        this.path = path;
        this.propertyPath = path.reduce(function(sum, item){
          return sum + makeSuffix(item);
        }, 'instance');
      }else {
        this.propertyPath = path;
      }
      this.base = base;
      this.schemas = schemas;
    };

    SchemaContext$1.prototype.resolve = function resolve (target) {
      return uri.resolve(this.base, target);
    };

    SchemaContext$1.prototype.makeChild = function makeChild(schema, propertyName){
      var path = (propertyName===undefined) ? this.path : this.path.concat([propertyName]);
      var id = schema.$id || schema.id;
      var base = uri.resolve(this.base, id||'');
      var ctx = new SchemaContext$1(schema, this.options, path, base, Object.create(this.schemas));
      if(id && !ctx.schemas[base]){
        ctx.schemas[base] = schema;
      }
      return ctx;
    };

    var FORMAT_REGEXPS = helpers$3.FORMAT_REGEXPS = {
      // 7.3.1. Dates, Times, and Duration
      'date-time': /^\d{4}-(?:0[0-9]{1}|1[0-2]{1})-(3[01]|0[1-9]|[12][0-9])[tT ](2[0-4]|[01][0-9]):([0-5][0-9]):(60|[0-5][0-9])(\.\d+)?([zZ]|[+-]([0-5][0-9]):(60|[0-5][0-9]))$/,
      'date': /^\d{4}-(?:0[0-9]{1}|1[0-2]{1})-(3[01]|0[1-9]|[12][0-9])$/,
      'time': /^(2[0-4]|[01][0-9]):([0-5][0-9]):(60|[0-5][0-9])$/,
      'duration': /P(T\d+(H(\d+M(\d+S)?)?|M(\d+S)?|S)|\d+(D|M(\d+D)?|Y(\d+M(\d+D)?)?)(T\d+(H(\d+M(\d+S)?)?|M(\d+S)?|S))?|\d+W)/i,

      // 7.3.2. Email Addresses
      // TODO: fix the email production
      'email': /^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/,
      'idn-email': /^("(?:[!#-\[\]-\u{10FFFF}]|\\[\t -\u{10FFFF}])*"|[!#-'*+\-/-9=?A-Z\^-\u{10FFFF}](?:\.?[!#-'*+\-/-9=?A-Z\^-\u{10FFFF}])*)@([!#-'*+\-/-9=?A-Z\^-\u{10FFFF}](?:\.?[!#-'*+\-/-9=?A-Z\^-\u{10FFFF}])*|\[[!-Z\^-\u{10FFFF}]*\])$/u,

      // 7.3.3. Hostnames

      // 7.3.4. IP Addresses
      'ip-address': /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      // FIXME whitespace is invalid
      'ipv6': /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/,

      // 7.3.5. Resource Identifiers
      // TODO: A more accurate regular expression for "uri" goes:
      // [A-Za-z][+\-.0-9A-Za-z]*:((/(/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?)?)?#(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|(/(/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?[/?]|[!$&-.0-;=?-Z_a-z~])|/?%[0-9A-Fa-f]{2}|[!$&-.0-;=?-Z_a-z~])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*(#(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*)?|/(/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+(:\d*)?|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?:\d*|\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)?)?
      'uri': /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/,
      'uri-reference': /^(((([A-Za-z][+\-.0-9A-Za-z]*(:%[0-9A-Fa-f]{2}|:[!$&-.0-;=?-Z_a-z~]|[/?])|\?)(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|([A-Za-z][+\-.0-9A-Za-z]*:?)?)|([A-Za-z][+\-.0-9A-Za-z]*:)?\/((%[0-9A-Fa-f]{2}|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?[/?]|[!$&-.0-;=?-Z_a-z~])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|(\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?)?))#(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|(([A-Za-z][+\-.0-9A-Za-z]*)?%[0-9A-Fa-f]{2}|[!$&-.0-9;=@_~]|[A-Za-z][+\-.0-9A-Za-z]*[!$&-*,;=@_~])(%[0-9A-Fa-f]{2}|[!$&-.0-9;=@-Z_a-z~])*((([/?](%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*)?#|[/?])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*)?|([A-Za-z][+\-.0-9A-Za-z]*(:%[0-9A-Fa-f]{2}|:[!$&-.0-;=?-Z_a-z~]|[/?])|\?)(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|([A-Za-z][+\-.0-9A-Za-z]*:)?\/((%[0-9A-Fa-f]{2}|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?[/?]|[!$&-.0-;=?-Z_a-z~])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+(:\d*)?|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?:\d*|\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)?|[A-Za-z][+\-.0-9A-Za-z]*:?)?$/,
      'iri': /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/,
      'iri-reference': /^(((([A-Za-z][+\-.0-9A-Za-z]*(:%[0-9A-Fa-f]{2}|:[!$&-.0-;=?-Z_a-z~-\u{10FFFF}]|[/?])|\?)(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*|([A-Za-z][+\-.0-9A-Za-z]*:?)?)|([A-Za-z][+\-.0-9A-Za-z]*:)?\/((%[0-9A-Fa-f]{2}|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~-\u{10FFFF}])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~-\u{10FFFF}]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?[/?]|[!$&-.0-;=?-Z_a-z~-\u{10FFFF}])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*|(\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~-\u{10FFFF}])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~-\u{10FFFF}]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?)?))#(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*|(([A-Za-z][+\-.0-9A-Za-z]*)?%[0-9A-Fa-f]{2}|[!$&-.0-9;=@_~-\u{10FFFF}]|[A-Za-z][+\-.0-9A-Za-z]*[!$&-*,;=@_~-\u{10FFFF}])(%[0-9A-Fa-f]{2}|[!$&-.0-9;=@-Z_a-z~-\u{10FFFF}])*((([/?](%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*)?#|[/?])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*)?|([A-Za-z][+\-.0-9A-Za-z]*(:%[0-9A-Fa-f]{2}|:[!$&-.0-;=?-Z_a-z~-\u{10FFFF}]|[/?])|\?)(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*|([A-Za-z][+\-.0-9A-Za-z]*:)?\/((%[0-9A-Fa-f]{2}|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~-\u{10FFFF}])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~-\u{10FFFF}]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?[/?]|[!$&-.0-;=?-Z_a-z~-\u{10FFFF}])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~-\u{10FFFF}])+(:\d*)?|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~-\u{10FFFF}]+)?|[.0-:A-Fa-f]+)\])?:\d*|\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~-\u{10FFFF}]+)?|[.0-:A-Fa-f]+)\])?)?|[A-Za-z][+\-.0-9A-Za-z]*:?)?$/u,
      'uuid': /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i,

      // 7.3.6. uri-template
      'uri-template': /(%[0-9a-f]{2}|[!#$&(-;=?@\[\]_a-z~]|\{[!#&+,./;=?@|]?(%[0-9a-f]{2}|[0-9_a-z])(\.?(%[0-9a-f]{2}|[0-9_a-z]))*(:[1-9]\d{0,3}|\*)?(,(%[0-9a-f]{2}|[0-9_a-z])(\.?(%[0-9a-f]{2}|[0-9_a-z]))*(:[1-9]\d{0,3}|\*)?)*\})*/iu,

      // 7.3.7. JSON Pointers
      'json-pointer': /^(\/([\x00-\x2e0-@\[-}\x7f]|~[01])*)*$/iu,
      'relative-json-pointer': /^\d+(#|(\/([\x00-\x2e0-@\[-}\x7f]|~[01])*)*)$/iu,

      // hostname regex from: http://stackoverflow.com/a/1420225/5628
      'hostname': /^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$/,
      'host-name': /^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$/,

      'utc-millisec': function (input) {
        return (typeof input === 'string') && parseFloat(input) === parseInt(input, 10) && !isNaN(input);
      },

      // 7.3.8. regex
      'regex': function (input) {
        var result = true;
        try {
          new RegExp(input);
        } catch (e) {
          result = false;
        }
        return result;
      },

      // Other definitions
      // "style" was removed from JSON Schema in draft-4 and is deprecated
      'style': /[\r\n\t ]*[^\r\n\t ][^:]*:[\r\n\t ]*[^\r\n\t ;]*[\r\n\t ]*;?/,
      // "color" was removed from JSON Schema in draft-4 and is deprecated
      'color': /^(#?([0-9A-Fa-f]{3}){1,2}\b|aqua|black|blue|fuchsia|gray|green|lime|maroon|navy|olive|orange|purple|red|silver|teal|white|yellow|(rgb\(\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*,\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*,\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*\))|(rgb\(\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*\)))$/,
      'phone': /^\+(?:[0-9] ?){6,14}[0-9]$/,
      'alpha': /^[a-zA-Z]+$/,
      'alphanumeric': /^[a-zA-Z0-9]+$/,
    };

    FORMAT_REGEXPS.regexp = FORMAT_REGEXPS.regex;
    FORMAT_REGEXPS.pattern = FORMAT_REGEXPS.regex;
    FORMAT_REGEXPS.ipv4 = FORMAT_REGEXPS['ip-address'];

    helpers$3.isFormat = function isFormat (input, format, validator) {
      if (typeof input === 'string' && FORMAT_REGEXPS[format] !== undefined) {
        if (FORMAT_REGEXPS[format] instanceof RegExp) {
          return FORMAT_REGEXPS[format].test(input);
        }
        if (typeof FORMAT_REGEXPS[format] === 'function') {
          return FORMAT_REGEXPS[format](input);
        }
      } else if (validator && validator.customFormats &&
          typeof validator.customFormats[format] === 'function') {
        return validator.customFormats[format](input);
      }
      return true;
    };

    var makeSuffix = helpers$3.makeSuffix = function makeSuffix (key) {
      key = key.toString();
      // This function could be capable of outputting valid a ECMAScript string, but the
      // resulting code for testing which form to use would be tens of thousands of characters long
      // That means this will use the name form for some illegal forms
      if (!key.match(/[.\s\[\]]/) && !key.match(/^[\d]/)) {
        return '.' + key;
      }
      if (key.match(/^\d+$/)) {
        return '[' + key + ']';
      }
      return '[' + JSON.stringify(key) + ']';
    };

    var deepCompareStrict = helpers$3.deepCompareStrict = function deepCompareStrict (a, b) {
      if (typeof a !== typeof b) {
        return false;
      }
      if (Array.isArray(a)) {
        if (!Array.isArray(b)) {
          return false;
        }
        if (a.length !== b.length) {
          return false;
        }
        return a.every(function (v, i) {
          return deepCompareStrict(a[i], b[i]);
        });
      }
      if (typeof a === 'object') {
        if (!a || !b) {
          return a === b;
        }
        var aKeys = Object.keys(a);
        var bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) {
          return false;
        }
        return aKeys.every(function (v) {
          return deepCompareStrict(a[v], b[v]);
        });
      }
      return a === b;
    };

    function deepMerger (target, dst, e, i) {
      if (typeof e === 'object') {
        dst[i] = deepMerge(target[i], e);
      } else {
        if (target.indexOf(e) === -1) {
          dst.push(e);
        }
      }
    }

    function copyist (src, dst, key) {
      dst[key] = src[key];
    }

    function copyistWithDeepMerge (target, src, dst, key) {
      if (typeof src[key] !== 'object' || !src[key]) {
        dst[key] = src[key];
      }
      else {
        if (!target[key]) {
          dst[key] = src[key];
        } else {
          dst[key] = deepMerge(target[key], src[key]);
        }
      }
    }

    function deepMerge (target, src) {
      var array = Array.isArray(src);
      var dst = array && [] || {};

      if (array) {
        target = target || [];
        dst = dst.concat(target);
        src.forEach(deepMerger.bind(null, target, dst));
      } else {
        if (target && typeof target === 'object') {
          Object.keys(target).forEach(copyist.bind(null, target, dst));
        }
        Object.keys(src).forEach(copyistWithDeepMerge.bind(null, target, src, dst));
      }

      return dst;
    }

    helpers$3.deepMerge = deepMerge;

    /**
     * Validates instance against the provided schema
     * Implements URI+JSON Pointer encoding, e.g. "%7e"="~0"=>"~", "~1"="%2f"=>"/"
     * @param o
     * @param s The path to walk o along
     * @return any
     */
    helpers$3.objectGetPath = function objectGetPath(o, s) {
      var parts = s.split('/').slice(1);
      var k;
      while (typeof (k=parts.shift()) == 'string') {
        var n = decodeURIComponent(k.replace(/~0/,'~').replace(/~1/g,'/'));
        if (!(n in o)) return;
        o = o[n];
      }
      return o;
    };

    function pathEncoder (v) {
      return '/'+encodeURIComponent(v).replace(/~/g,'%7E');
    }
    /**
     * Accept an Array of property names and return a JSON Pointer URI fragment
     * @param Array a
     * @return {String}
     */
    helpers$3.encodePath = function encodePointer(a){
      // ~ must be encoded explicitly because hacks
      // the slash is encoded by encodeURIComponent
      return a.map(pathEncoder).join('');
    };


    /**
     * Calculate the number of decimal places a number uses
     * We need this to get correct results out of multipleOf and divisibleBy
     * when either figure is has decimal places, due to IEEE-754 float issues.
     * @param number
     * @returns {number}
     */
    helpers$3.getDecimalPlaces = function getDecimalPlaces(number) {

      var decimalPlaces = 0;
      if (isNaN(number)) return decimalPlaces;

      if (typeof number !== 'number') {
        number = Number(number);
      }

      var parts = number.toString().split('e');
      if (parts.length === 2) {
        if (parts[1][0] !== '-') {
          return decimalPlaces;
        } else {
          decimalPlaces = Number(parts[1].slice(1));
        }
      }

      var decimalParts = parts[0].split('.');
      if (decimalParts.length === 2) {
        decimalPlaces += decimalParts[1].length;
      }

      return decimalPlaces;
    };

    helpers$3.isSchema = function isSchema(val){
      return (typeof val === 'object' && val) || (typeof val === 'boolean');
    };

    var helpers$2 = helpers$3;

    /** @type ValidatorResult */
    var ValidatorResult$1 = helpers$2.ValidatorResult;
    /** @type SchemaError */
    var SchemaError$1 = helpers$2.SchemaError;

    var attribute$1 = {};

    attribute$1.ignoreProperties = {
      // informative properties
      'id': true,
      'default': true,
      'description': true,
      'title': true,
      // arguments to other properties
      'additionalItems': true,
      'then': true,
      'else': true,
      // special-handled properties
      '$schema': true,
      '$ref': true,
      'extends': true,
    };

    /**
     * @name validators
     */
    var validators = attribute$1.validators = {};

    /**
     * Validates whether the instance if of a certain type
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {ValidatorResult|null}
     */
    validators.type = function validateType (instance, schema, options, ctx) {
      // Ignore undefined instances
      if (instance === undefined) {
        return null;
      }
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some(this.testType.bind(this, instance, schema, options, ctx))) {
        var list = types.map(function (v) {
          if(!v) return;
          var id = v.$id || v.id;
          return id ? ('<' + id + '>') : (v+'');
        });
        result.addError({
          name: 'type',
          argument: list,
          message: "is not of a type(s) " + list,
        });
      }
      return result;
    };

    function testSchemaNoThrow(instance, options, ctx, callback, schema){
      var throwError = options.throwError;
      var throwAll = options.throwAll;
      options.throwError = false;
      options.throwAll = false;
      var res = this.validateSchema(instance, schema, options, ctx);
      options.throwError = throwError;
      options.throwAll = throwAll;

      if (!res.valid && callback instanceof Function) {
        callback(res);
      }
      return res.valid;
    }

    /**
     * Validates whether the instance matches some of the given schemas
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {ValidatorResult|null}
     */
    validators.anyOf = function validateAnyOf (instance, schema, options, ctx) {
      // Ignore undefined instances
      if (instance === undefined) {
        return null;
      }
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var inner = new ValidatorResult$1(instance, schema, options, ctx);
      if (!Array.isArray(schema.anyOf)){
        throw new SchemaError$1("anyOf must be an array");
      }
      if (!schema.anyOf.some(
        testSchemaNoThrow.bind(
          this, instance, options, ctx, function(res){inner.importErrors(res);}
        ))) {
        var list = schema.anyOf.map(function (v, i) {
          var id = v.$id || v.id;
          if(id) return '<' + id + '>';
          return (v.title && JSON.stringify(v.title)) || (v['$ref'] && ('<' + v['$ref'] + '>')) || '[subschema '+i+']';
        });
        if (options.nestedErrors) {
          result.importErrors(inner);
        }
        result.addError({
          name: 'anyOf',
          argument: list,
          message: "is not any of " + list.join(','),
        });
      }
      return result;
    };

    /**
     * Validates whether the instance matches every given schema
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {String|null}
     */
    validators.allOf = function validateAllOf (instance, schema, options, ctx) {
      // Ignore undefined instances
      if (instance === undefined) {
        return null;
      }
      if (!Array.isArray(schema.allOf)){
        throw new SchemaError$1("allOf must be an array");
      }
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var self = this;
      schema.allOf.forEach(function(v, i){
        var valid = self.validateSchema(instance, v, options, ctx);
        if(!valid.valid){
          var id = v.$id || v.id;
          var msg = id || (v.title && JSON.stringify(v.title)) || (v['$ref'] && ('<' + v['$ref'] + '>')) || '[subschema '+i+']';
          result.addError({
            name: 'allOf',
            argument: { id: msg, length: valid.errors.length, valid: valid },
            message: 'does not match allOf schema ' + msg + ' with ' + valid.errors.length + ' error[s]:',
          });
          result.importErrors(valid);
        }
      });
      return result;
    };

    /**
     * Validates whether the instance matches exactly one of the given schemas
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {String|null}
     */
    validators.oneOf = function validateOneOf (instance, schema, options, ctx) {
      // Ignore undefined instances
      if (instance === undefined) {
        return null;
      }
      if (!Array.isArray(schema.oneOf)){
        throw new SchemaError$1("oneOf must be an array");
      }
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var inner = new ValidatorResult$1(instance, schema, options, ctx);
      var count = schema.oneOf.filter(
        testSchemaNoThrow.bind(
          this, instance, options, ctx, function(res) {inner.importErrors(res);}
        ) ).length;
      var list = schema.oneOf.map(function (v, i) {
        var id = v.$id || v.id;
        return id || (v.title && JSON.stringify(v.title)) || (v['$ref'] && ('<' + v['$ref'] + '>')) || '[subschema '+i+']';
      });
      if (count!==1) {
        if (options.nestedErrors) {
          result.importErrors(inner);
        }
        result.addError({
          name: 'oneOf',
          argument: list,
          message: "is not exactly one from " + list.join(','),
        });
      }
      return result;
    };

    /**
     * Validates "then" or "else" depending on the result of validating "if"
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {String|null}
     */
    validators.if = function validateIf (instance, schema, options, ctx) {
      // Ignore undefined instances
      if (instance === undefined) return null;
      if (!helpers$2.isSchema(schema.if)) throw new Error('Expected "if" keyword to be a schema');
      var ifValid = testSchemaNoThrow.call(this, instance, options, ctx, null, schema.if);
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var res;
      if(ifValid){
        if (schema.then === undefined) return;
        if (!helpers$2.isSchema(schema.then)) throw new Error('Expected "then" keyword to be a schema');
        res = this.validateSchema(instance, schema.then, options, ctx.makeChild(schema.then));
        result.importErrors(res);
      }else {
        if (schema.else === undefined) return;
        if (!helpers$2.isSchema(schema.else)) throw new Error('Expected "else" keyword to be a schema');
        res = this.validateSchema(instance, schema.else, options, ctx.makeChild(schema.else));
        result.importErrors(res);
      }
      return result;
    };

    function getEnumerableProperty(object, key){
      // Determine if `key` shows up in `for(var key in object)`
      // First test Object.hasOwnProperty.call as an optimization: that guarantees it does
      if(Object.hasOwnProperty.call(object, key)) return object[key];
      // Test `key in object` as an optimization; false means it won't
      if(!(key in object)) return;
      while( (object = Object.getPrototypeOf(object)) ){
        if(Object.propertyIsEnumerable.call(object, key)) return object[key];
      }
    }

    /**
     * Validates propertyNames
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {String|null|ValidatorResult}
     */
    validators.propertyNames = function validatePropertyNames (instance, schema, options, ctx) {
      if(!this.types.object(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var subschema = schema.propertyNames!==undefined ? schema.propertyNames : {};
      if(!helpers$2.isSchema(subschema)) throw new SchemaError$1('Expected "propertyNames" to be a schema (object or boolean)');

      for (var property in instance) {
        if(getEnumerableProperty(instance, property) !== undefined){
          var res = this.validateSchema(property, subschema, options, ctx.makeChild(subschema));
          result.importErrors(res);
        }
      }

      return result;
    };

    /**
     * Validates properties
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {String|null|ValidatorResult}
     */
    validators.properties = function validateProperties (instance, schema, options, ctx) {
      if(!this.types.object(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var properties = schema.properties || {};
      for (var property in properties) {
        var subschema = properties[property];
        if(subschema===undefined){
          continue;
        }else if(subschema===null){
          throw new SchemaError$1('Unexpected null, expected schema in "properties"');
        }
        if (typeof options.preValidateProperty == 'function') {
          options.preValidateProperty(instance, property, subschema, options, ctx);
        }
        var prop = getEnumerableProperty(instance, property);
        var res = this.validateSchema(prop, subschema, options, ctx.makeChild(subschema, property));
        if(res.instance !== result.instance[property]) result.instance[property] = res.instance;
        result.importErrors(res);
      }
      return result;
    };

    /**
     * Test a specific property within in instance against the additionalProperties schema attribute
     * This ignores properties with definitions in the properties schema attribute, but no other attributes.
     * If too many more types of property-existence tests pop up they may need their own class of tests (like `type` has)
     * @private
     * @return {boolean}
     */
    function testAdditionalProperty (instance, schema, options, ctx, property, result) {
      if(!this.types.object(instance)) return;
      if (schema.properties && schema.properties[property] !== undefined) {
        return;
      }
      if (schema.additionalProperties === false) {
        result.addError({
          name: 'additionalProperties',
          argument: property,
          message: "is not allowed to have the additional property " + JSON.stringify(property),
        });
      } else {
        var additionalProperties = schema.additionalProperties || {};

        if (typeof options.preValidateProperty == 'function') {
          options.preValidateProperty(instance, property, additionalProperties, options, ctx);
        }

        var res = this.validateSchema(instance[property], additionalProperties, options, ctx.makeChild(additionalProperties, property));
        if(res.instance !== result.instance[property]) result.instance[property] = res.instance;
        result.importErrors(res);
      }
    }

    /**
     * Validates patternProperties
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {String|null|ValidatorResult}
     */
    validators.patternProperties = function validatePatternProperties (instance, schema, options, ctx) {
      if(!this.types.object(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var patternProperties = schema.patternProperties || {};

      for (var property in instance) {
        var test = true;
        for (var pattern in patternProperties) {
          var subschema = patternProperties[pattern];
          if(subschema===undefined){
            continue;
          }else if(subschema===null){
            throw new SchemaError$1('Unexpected null, expected schema in "patternProperties"');
          }
          try {
            var regexp = new RegExp(pattern, 'u');
          } catch(_e) {
            // In the event the stricter handling causes an error, fall back on the forgiving handling
            // DEPRECATED
            regexp = new RegExp(pattern);
          }
          if (!regexp.test(property)) {
            continue;
          }
          test = false;

          if (typeof options.preValidateProperty == 'function') {
            options.preValidateProperty(instance, property, subschema, options, ctx);
          }

          var res = this.validateSchema(instance[property], subschema, options, ctx.makeChild(subschema, property));
          if(res.instance !== result.instance[property]) result.instance[property] = res.instance;
          result.importErrors(res);
        }
        if (test) {
          testAdditionalProperty.call(this, instance, schema, options, ctx, property, result);
        }
      }

      return result;
    };

    /**
     * Validates additionalProperties
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {String|null|ValidatorResult}
     */
    validators.additionalProperties = function validateAdditionalProperties (instance, schema, options, ctx) {
      if(!this.types.object(instance)) return;
      // if patternProperties is defined then we'll test when that one is called instead
      if (schema.patternProperties) {
        return null;
      }
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      for (var property in instance) {
        testAdditionalProperty.call(this, instance, schema, options, ctx, property, result);
      }
      return result;
    };

    /**
     * Validates whether the instance value is at least of a certain length, when the instance value is a string.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.minProperties = function validateMinProperties (instance, schema, options, ctx) {
      if (!this.types.object(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var keys = Object.keys(instance);
      if (!(keys.length >= schema.minProperties)) {
        result.addError({
          name: 'minProperties',
          argument: schema.minProperties,
          message: "does not meet minimum property length of " + schema.minProperties,
        });
      }
      return result;
    };

    /**
     * Validates whether the instance value is at most of a certain length, when the instance value is a string.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.maxProperties = function validateMaxProperties (instance, schema, options, ctx) {
      if (!this.types.object(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var keys = Object.keys(instance);
      if (!(keys.length <= schema.maxProperties)) {
        result.addError({
          name: 'maxProperties',
          argument: schema.maxProperties,
          message: "does not meet maximum property length of " + schema.maxProperties,
        });
      }
      return result;
    };

    /**
     * Validates items when instance is an array
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {String|null|ValidatorResult}
     */
    validators.items = function validateItems (instance, schema, options, ctx) {
      var self = this;
      if (!this.types.array(instance)) return;
      if (schema.items===undefined) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      instance.every(function (value, i) {
        if(Array.isArray(schema.items)){
          var items =  schema.items[i]===undefined ? schema.additionalItems : schema.items[i];
        }else {
          var items = schema.items;
        }
        if (items === undefined) {
          return true;
        }
        if (items === false) {
          result.addError({
            name: 'items',
            message: "additionalItems not permitted",
          });
          return false;
        }
        var res = self.validateSchema(value, items, options, ctx.makeChild(items, i));
        if(res.instance !== result.instance[i]) result.instance[i] = res.instance;
        result.importErrors(res);
        return true;
      });
      return result;
    };

    /**
     * Validates the "contains" keyword
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {String|null|ValidatorResult}
     */
    validators.contains = function validateContains (instance, schema, options, ctx) {
      var self = this;
      if (!this.types.array(instance)) return;
      if (schema.contains===undefined) return;
      if (!helpers$2.isSchema(schema.contains)) throw new Error('Expected "contains" keyword to be a schema');
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var count = instance.some(function (value, i) {
        var res = self.validateSchema(value, schema.contains, options, ctx.makeChild(schema.contains, i));
        return res.errors.length===0;
      });
      if(count===false){
        result.addError({
          name: 'contains',
          argument: schema.contains,
          message: "must contain an item matching given schema",
        });
      }
      return result;
    };

    /**
     * Validates minimum and exclusiveMinimum when the type of the instance value is a number.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.minimum = function validateMinimum (instance, schema, options, ctx) {
      if (!this.types.number(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      if (schema.exclusiveMinimum && schema.exclusiveMinimum === true) {
        if(!(instance > schema.minimum)){
          result.addError({
            name: 'minimum',
            argument: schema.minimum,
            message: "must be greater than " + schema.minimum,
          });
        }
      } else {
        if(!(instance >= schema.minimum)){
          result.addError({
            name: 'minimum',
            argument: schema.minimum,
            message: "must be greater than or equal to " + schema.minimum,
          });
        }
      }
      return result;
    };

    /**
     * Validates maximum and exclusiveMaximum when the type of the instance value is a number.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.maximum = function validateMaximum (instance, schema, options, ctx) {
      if (!this.types.number(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      if (schema.exclusiveMaximum && schema.exclusiveMaximum === true) {
        if(!(instance < schema.maximum)){
          result.addError({
            name: 'maximum',
            argument: schema.maximum,
            message: "must be less than " + schema.maximum,
          });
        }
      } else {
        if(!(instance <= schema.maximum)){
          result.addError({
            name: 'maximum',
            argument: schema.maximum,
            message: "must be less than or equal to " + schema.maximum,
          });
        }
      }
      return result;
    };

    /**
     * Validates the number form of exclusiveMinimum when the type of the instance value is a number.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.exclusiveMinimum = function validateExclusiveMinimum (instance, schema, options, ctx) {
      // Support the boolean form of exclusiveMinimum, which is handled by the "minimum" keyword.
      if(typeof schema.exclusiveMinimum === 'boolean') return;
      if (!this.types.number(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var valid = instance > schema.exclusiveMinimum;
      if (!valid) {
        result.addError({
          name: 'exclusiveMinimum',
          argument: schema.exclusiveMinimum,
          message: "must be strictly greater than " + schema.exclusiveMinimum,
        });
      }
      return result;
    };

    /**
     * Validates the number form of exclusiveMaximum when the type of the instance value is a number.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.exclusiveMaximum = function validateExclusiveMaximum (instance, schema, options, ctx) {
      // Support the boolean form of exclusiveMaximum, which is handled by the "maximum" keyword.
      if(typeof schema.exclusiveMaximum === 'boolean') return;
      if (!this.types.number(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var valid = instance < schema.exclusiveMaximum;
      if (!valid) {
        result.addError({
          name: 'exclusiveMaximum',
          argument: schema.exclusiveMaximum,
          message: "must be strictly less than " + schema.exclusiveMaximum,
        });
      }
      return result;
    };

    /**
     * Perform validation for multipleOf and divisibleBy, which are essentially the same.
     * @param instance
     * @param schema
     * @param validationType
     * @param errorMessage
     * @returns {String|null}
     */
    var validateMultipleOfOrDivisbleBy = function validateMultipleOfOrDivisbleBy (instance, schema, options, ctx, validationType, errorMessage) {
      if (!this.types.number(instance)) return;

      var validationArgument = schema[validationType];
      if (validationArgument == 0) {
        throw new SchemaError$1(validationType + " cannot be zero");
      }

      var result = new ValidatorResult$1(instance, schema, options, ctx);

      var instanceDecimals = helpers$2.getDecimalPlaces(instance);
      var divisorDecimals = helpers$2.getDecimalPlaces(validationArgument);

      var maxDecimals = Math.max(instanceDecimals , divisorDecimals);
      var multiplier = Math.pow(10, maxDecimals);

      if (Math.round(instance * multiplier) % Math.round(validationArgument * multiplier) !== 0) {
        result.addError({
          name: validationType,
          argument:  validationArgument,
          message: errorMessage + JSON.stringify(validationArgument),
        });
      }

      return result;
    };

    /**
     * Validates divisibleBy when the type of the instance value is a number.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.multipleOf = function validateMultipleOf (instance, schema, options, ctx) {
      return validateMultipleOfOrDivisbleBy.call(this, instance, schema, options, ctx, "multipleOf", "is not a multiple of (divisible by) ");
    };

    /**
     * Validates multipleOf when the type of the instance value is a number.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.divisibleBy = function validateDivisibleBy (instance, schema, options, ctx) {
      return validateMultipleOfOrDivisbleBy.call(this, instance, schema, options, ctx, "divisibleBy", "is not divisible by (multiple of) ");
    };

    /**
     * Validates whether the instance value is present.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.required = function validateRequired (instance, schema, options, ctx) {
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      if (instance === undefined && schema.required === true) {
        // A boolean form is implemented for reverse-compatibility with schemas written against older drafts
        result.addError({
          name: 'required',
          message: "is required",
        });
      } else if (this.types.object(instance) && Array.isArray(schema.required)) {
        schema.required.forEach(function(n){
          if(getEnumerableProperty(instance, n)===undefined){
            result.addError({
              name: 'required',
              argument: n,
              message: "requires property " + JSON.stringify(n),
            });
          }
        });
      }
      return result;
    };

    /**
     * Validates whether the instance value matches the regular expression, when the instance value is a string.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.pattern = function validatePattern (instance, schema, options, ctx) {
      if (!this.types.string(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var pattern = schema.pattern;
      try {
        var regexp = new RegExp(pattern, 'u');
      } catch(_e) {
        // In the event the stricter handling causes an error, fall back on the forgiving handling
        // DEPRECATED
        regexp = new RegExp(pattern);
      }
      if (!instance.match(regexp)) {
        result.addError({
          name: 'pattern',
          argument: schema.pattern,
          message: "does not match pattern " + JSON.stringify(schema.pattern.toString()),
        });
      }
      return result;
    };

    /**
     * Validates whether the instance value is of a certain defined format or a custom
     * format.
     * The following formats are supported for string types:
     *   - date-time
     *   - date
     *   - time
     *   - ip-address
     *   - ipv6
     *   - uri
     *   - color
     *   - host-name
     *   - alpha
     *   - alpha-numeric
     *   - utc-millisec
     * @param instance
     * @param schema
     * @param [options]
     * @param [ctx]
     * @return {String|null}
     */
    validators.format = function validateFormat (instance, schema, options, ctx) {
      if (instance===undefined) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      if (!result.disableFormat && !helpers$2.isFormat(instance, schema.format, this)) {
        result.addError({
          name: 'format',
          argument: schema.format,
          message: "does not conform to the " + JSON.stringify(schema.format) + " format",
        });
      }
      return result;
    };

    /**
     * Validates whether the instance value is at least of a certain length, when the instance value is a string.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.minLength = function validateMinLength (instance, schema, options, ctx) {
      if (!this.types.string(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var hsp = instance.match(/[\uDC00-\uDFFF]/g);
      var length = instance.length - (hsp ? hsp.length : 0);
      if (!(length >= schema.minLength)) {
        result.addError({
          name: 'minLength',
          argument: schema.minLength,
          message: "does not meet minimum length of " + schema.minLength,
        });
      }
      return result;
    };

    /**
     * Validates whether the instance value is at most of a certain length, when the instance value is a string.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.maxLength = function validateMaxLength (instance, schema, options, ctx) {
      if (!this.types.string(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      // TODO if this was already computed in "minLength", use that value instead of re-computing
      var hsp = instance.match(/[\uDC00-\uDFFF]/g);
      var length = instance.length - (hsp ? hsp.length : 0);
      if (!(length <= schema.maxLength)) {
        result.addError({
          name: 'maxLength',
          argument: schema.maxLength,
          message: "does not meet maximum length of " + schema.maxLength,
        });
      }
      return result;
    };

    /**
     * Validates whether instance contains at least a minimum number of items, when the instance is an Array.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.minItems = function validateMinItems (instance, schema, options, ctx) {
      if (!this.types.array(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      if (!(instance.length >= schema.minItems)) {
        result.addError({
          name: 'minItems',
          argument: schema.minItems,
          message: "does not meet minimum length of " + schema.minItems,
        });
      }
      return result;
    };

    /**
     * Validates whether instance contains no more than a maximum number of items, when the instance is an Array.
     * @param instance
     * @param schema
     * @return {String|null}
     */
    validators.maxItems = function validateMaxItems (instance, schema, options, ctx) {
      if (!this.types.array(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      if (!(instance.length <= schema.maxItems)) {
        result.addError({
          name: 'maxItems',
          argument: schema.maxItems,
          message: "does not meet maximum length of " + schema.maxItems,
        });
      }
      return result;
    };

    /**
     * Deep compares arrays for duplicates
     * @param v
     * @param i
     * @param a
     * @private
     * @return {boolean}
     */
    function testArrays (v, i, a) {
      var j, len = a.length;
      for (j = i + 1, len; j < len; j++) {
        if (helpers$2.deepCompareStrict(v, a[j])) {
          return false;
        }
      }
      return true;
    }

    /**
     * Validates whether there are no duplicates, when the instance is an Array.
     * @param instance
     * @return {String|null}
     */
    validators.uniqueItems = function validateUniqueItems (instance, schema, options, ctx) {
      if (schema.uniqueItems!==true) return;
      if (!this.types.array(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      if (!instance.every(testArrays)) {
        result.addError({
          name: 'uniqueItems',
          message: "contains duplicate item",
        });
      }
      return result;
    };

    /**
     * Validate for the presence of dependency properties, if the instance is an object.
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {null|ValidatorResult}
     */
    validators.dependencies = function validateDependencies (instance, schema, options, ctx) {
      if (!this.types.object(instance)) return;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      for (var property in schema.dependencies) {
        if (instance[property] === undefined) {
          continue;
        }
        var dep = schema.dependencies[property];
        var childContext = ctx.makeChild(dep, property);
        if (typeof dep == 'string') {
          dep = [dep];
        }
        if (Array.isArray(dep)) {
          dep.forEach(function (prop) {
            if (instance[prop] === undefined) {
              result.addError({
                // FIXME there's two different "dependencies" errors here with slightly different outputs
                // Can we make these the same? Or should we create different error types?
                name: 'dependencies',
                argument: childContext.propertyPath,
                message: "property " + prop + " not found, required by " + childContext.propertyPath,
              });
            }
          });
        } else {
          var res = this.validateSchema(instance, dep, options, childContext);
          if(result.instance !== res.instance) result.instance = res.instance;
          if (res && res.errors.length) {
            result.addError({
              name: 'dependencies',
              argument: childContext.propertyPath,
              message: "does not meet dependency required by " + childContext.propertyPath,
            });
            result.importErrors(res);
          }
        }
      }
      return result;
    };

    /**
     * Validates whether the instance value is one of the enumerated values.
     *
     * @param instance
     * @param schema
     * @return {ValidatorResult|null}
     */
    validators['enum'] = function validateEnum (instance, schema, options, ctx) {
      if (instance === undefined) {
        return null;
      }
      if (!Array.isArray(schema['enum'])) {
        throw new SchemaError$1("enum expects an array", schema);
      }
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      if (!schema['enum'].some(helpers$2.deepCompareStrict.bind(null, instance))) {
        result.addError({
          name: 'enum',
          argument: schema['enum'],
          message: "is not one of enum values: " + schema['enum'].map(String).join(','),
        });
      }
      return result;
    };

    /**
     * Validates whether the instance exactly matches a given value
     *
     * @param instance
     * @param schema
     * @return {ValidatorResult|null}
     */
    validators['const'] = function validateEnum (instance, schema, options, ctx) {
      if (instance === undefined) {
        return null;
      }
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      if (!helpers$2.deepCompareStrict(schema['const'], instance)) {
        result.addError({
          name: 'const',
          argument: schema['const'],
          message: "does not exactly match expected constant: " + schema['const'],
        });
      }
      return result;
    };

    /**
     * Validates whether the instance if of a prohibited type.
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @return {null|ValidatorResult}
     */
    validators.not = validators.disallow = function validateNot (instance, schema, options, ctx) {
      var self = this;
      if(instance===undefined) return null;
      var result = new ValidatorResult$1(instance, schema, options, ctx);
      var notTypes = schema.not || schema.disallow;
      if(!notTypes) return null;
      if(!Array.isArray(notTypes)) notTypes=[notTypes];
      notTypes.forEach(function (type) {
        if (self.testType(instance, schema, options, ctx, type)) {
          var id = type && (type.$id || type.id);
          var schemaId = id || type;
          result.addError({
            name: 'not',
            argument: schemaId,
            message: "is of prohibited type " + schemaId,
          });
        }
      });
      return result;
    };

    var attribute_1 = attribute$1;

    var scan = {};

    var urilib$1 = require$$0;
    var helpers$1 = helpers$3;

    scan.SchemaScanResult = SchemaScanResult;
    function SchemaScanResult(found, ref){
      this.id = found;
      this.ref = ref;
    }

    /**
     * Adds a schema with a certain urn to the Validator instance.
     * @param string uri
     * @param object schema
     * @return {Object}
     */
    scan.scan = function scan(base, schema){
      function scanSchema(baseuri, schema){
        if(!schema || typeof schema!='object') return;
        // Mark all referenced schemas so we can tell later which schemas are referred to, but never defined
        if(schema.$ref){
          var resolvedUri = urilib$1.resolve(baseuri, schema.$ref);
          ref[resolvedUri] = ref[resolvedUri] ? ref[resolvedUri]+1 : 0;
          return;
        }
        var id = schema.$id || schema.id;
        var ourBase = id ? urilib$1.resolve(baseuri, id) : baseuri;
        if (ourBase) {
          // If there's no fragment, append an empty one
          if(ourBase.indexOf('#')<0) ourBase += '#';
          if(found[ourBase]){
            if(!helpers$1.deepCompareStrict(found[ourBase], schema)){
              throw new Error('Schema <'+ourBase+'> already exists with different definition');
            }
            return found[ourBase];
          }
          found[ourBase] = schema;
          // strip trailing fragment
          if(ourBase[ourBase.length-1]=='#'){
            found[ourBase.substring(0, ourBase.length-1)] = schema;
          }
        }
        scanArray(ourBase+'/items', (Array.isArray(schema.items)?schema.items:[schema.items]));
        scanArray(ourBase+'/extends', (Array.isArray(schema.extends)?schema.extends:[schema.extends]));
        scanSchema(ourBase+'/additionalItems', schema.additionalItems);
        scanObject(ourBase+'/properties', schema.properties);
        scanSchema(ourBase+'/additionalProperties', schema.additionalProperties);
        scanObject(ourBase+'/definitions', schema.definitions);
        scanObject(ourBase+'/patternProperties', schema.patternProperties);
        scanObject(ourBase+'/dependencies', schema.dependencies);
        scanArray(ourBase+'/disallow', schema.disallow);
        scanArray(ourBase+'/allOf', schema.allOf);
        scanArray(ourBase+'/anyOf', schema.anyOf);
        scanArray(ourBase+'/oneOf', schema.oneOf);
        scanSchema(ourBase+'/not', schema.not);
      }
      function scanArray(baseuri, schemas){
        if(!Array.isArray(schemas)) return;
        for(var i=0; i<schemas.length; i++){
          scanSchema(baseuri+'/'+i, schemas[i]);
        }
      }
      function scanObject(baseuri, schemas){
        if(!schemas || typeof schemas!='object') return;
        for(var p in schemas){
          scanSchema(baseuri+'/'+p, schemas[p]);
        }
      }

      var found = {};
      var ref = {};
      scanSchema(base, schema);
      return new SchemaScanResult(found, ref);
    };

    var urilib = require$$0;

    var attribute = attribute_1;
    var helpers = helpers$3;
    var scanSchema = scan.scan;
    var ValidatorResult = helpers.ValidatorResult;
    var ValidatorResultError = helpers.ValidatorResultError;
    var SchemaError = helpers.SchemaError;
    var SchemaContext = helpers.SchemaContext;
    //var anonymousBase = 'vnd.jsonschema:///';
    var anonymousBase = '/';

    /**
     * Creates a new Validator object
     * @name Validator
     * @constructor
     */
    var Validator$1 = function Validator () {
      // Allow a validator instance to override global custom formats or to have their
      // own custom formats.
      this.customFormats = Object.create(Validator.prototype.customFormats);
      this.schemas = {};
      this.unresolvedRefs = [];

      // Use Object.create to make this extensible without Validator instances stepping on each other's toes.
      this.types = Object.create(types);
      this.attributes = Object.create(attribute.validators);
    };

    // Allow formats to be registered globally.
    Validator$1.prototype.customFormats = {};

    // Hint at the presence of a property
    Validator$1.prototype.schemas = null;
    Validator$1.prototype.types = null;
    Validator$1.prototype.attributes = null;
    Validator$1.prototype.unresolvedRefs = null;

    /**
     * Adds a schema with a certain urn to the Validator instance.
     * @param schema
     * @param urn
     * @return {Object}
     */
    Validator$1.prototype.addSchema = function addSchema (schema, base) {
      var self = this;
      if (!schema) {
        return null;
      }
      var scan = scanSchema(base||anonymousBase, schema);
      var ourUri = base || schema.$id || schema.id;
      for(var uri in scan.id){
        this.schemas[uri] = scan.id[uri];
      }
      for(var uri in scan.ref){
        // If this schema is already defined, it will be filtered out by the next step
        this.unresolvedRefs.push(uri);
      }
      // Remove newly defined schemas from unresolvedRefs
      this.unresolvedRefs = this.unresolvedRefs.filter(function(uri){
        return typeof self.schemas[uri]==='undefined';
      });
      return this.schemas[ourUri];
    };

    Validator$1.prototype.addSubSchemaArray = function addSubSchemaArray(baseuri, schemas) {
      if(!Array.isArray(schemas)) return;
      for(var i=0; i<schemas.length; i++){
        this.addSubSchema(baseuri, schemas[i]);
      }
    };

    Validator$1.prototype.addSubSchemaObject = function addSubSchemaArray(baseuri, schemas) {
      if(!schemas || typeof schemas!='object') return;
      for(var p in schemas){
        this.addSubSchema(baseuri, schemas[p]);
      }
    };



    /**
     * Sets all the schemas of the Validator instance.
     * @param schemas
     */
    Validator$1.prototype.setSchemas = function setSchemas (schemas) {
      this.schemas = schemas;
    };

    /**
     * Returns the schema of a certain urn
     * @param urn
     */
    Validator$1.prototype.getSchema = function getSchema (urn) {
      return this.schemas[urn];
    };

    /**
     * Validates instance against the provided schema
     * @param instance
     * @param schema
     * @param [options]
     * @param [ctx]
     * @return {Array}
     */
    Validator$1.prototype.validate = function validate (instance, schema, options, ctx) {
      if((typeof schema !== 'boolean' && typeof schema !== 'object') || schema === null){
        throw new SchemaError('Expected `schema` to be an object or boolean');
      }
      if (!options) {
        options = {};
      }
      // This section indexes subschemas in the provided schema, so they don't need to be added with Validator#addSchema
      // This will work so long as the function at uri.resolve() will resolve a relative URI to a relative URI
      var id = schema.$id || schema.id;
      var base = urilib.resolve(options.base||anonymousBase, id||'');
      if(!ctx){
        ctx = new SchemaContext(schema, options, [], base, Object.create(this.schemas));
        if (!ctx.schemas[base]) {
          ctx.schemas[base] = schema;
        }
        var found = scanSchema(base, schema);
        for(var n in found.id){
          var sch = found.id[n];
          ctx.schemas[n] = sch;
        }
      }
      if(options.required && instance===undefined){
        var result = new ValidatorResult(instance, schema, options, ctx);
        result.addError('is required, but is undefined');
        return result;
      }
      var result = this.validateSchema(instance, schema, options, ctx);
      if (!result) {
        throw new Error('Result undefined');
      }else if(options.throwAll && result.errors.length){
        throw new ValidatorResultError(result);
      }
      return result;
    };

    /**
    * @param Object schema
    * @return mixed schema uri or false
    */
    function shouldResolve(schema) {
      var ref = (typeof schema === 'string') ? schema : schema.$ref;
      if (typeof ref=='string') return ref;
      return false;
    }

    /**
     * Validates an instance against the schema (the actual work horse)
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @private
     * @return {ValidatorResult}
     */
    Validator$1.prototype.validateSchema = function validateSchema (instance, schema, options, ctx) {
      var result = new ValidatorResult(instance, schema, options, ctx);

      // Support for the true/false schemas
      if(typeof schema==='boolean') {
        if(schema===true){
          // `true` is always valid
          schema = {};
        }else if(schema===false){
          // `false` is always invalid
          schema = {type: []};
        }
      }else if(!schema){
        // This might be a string
        throw new Error("schema is undefined");
      }

      if (schema['extends']) {
        if (Array.isArray(schema['extends'])) {
          var schemaobj = {schema: schema, ctx: ctx};
          schema['extends'].forEach(this.schemaTraverser.bind(this, schemaobj));
          schema = schemaobj.schema;
          schemaobj.schema = null;
          schemaobj.ctx = null;
          schemaobj = null;
        } else {
          schema = helpers.deepMerge(schema, this.superResolve(schema['extends'], ctx));
        }
      }

      // If passed a string argument, load that schema URI
      var switchSchema = shouldResolve(schema);
      if (switchSchema) {
        var resolved = this.resolve(schema, switchSchema, ctx);
        var subctx = new SchemaContext(resolved.subschema, options, ctx.path, resolved.switchSchema, ctx.schemas);
        return this.validateSchema(instance, resolved.subschema, options, subctx);
      }

      var skipAttributes = options && options.skipAttributes || [];
      // Validate each schema attribute against the instance
      for (var key in schema) {
        if (!attribute.ignoreProperties[key] && skipAttributes.indexOf(key) < 0) {
          var validatorErr = null;
          var validator = this.attributes[key];
          if (validator) {
            validatorErr = validator.call(this, instance, schema, options, ctx);
          } else if (options.allowUnknownAttributes === false) {
            // This represents an error with the schema itself, not an invalid instance
            throw new SchemaError("Unsupported attribute: " + key, schema);
          }
          if (validatorErr) {
            result.importErrors(validatorErr);
          }
        }
      }

      if (typeof options.rewrite == 'function') {
        var value = options.rewrite.call(this, instance, schema, options, ctx);
        result.instance = value;
      }
      return result;
    };

    /**
    * @private
    * @param Object schema
    * @param SchemaContext ctx
    * @returns Object schema or resolved schema
    */
    Validator$1.prototype.schemaTraverser = function schemaTraverser (schemaobj, s) {
      schemaobj.schema = helpers.deepMerge(schemaobj.schema, this.superResolve(s, schemaobj.ctx));
    };

    /**
    * @private
    * @param Object schema
    * @param SchemaContext ctx
    * @returns Object schema or resolved schema
    */
    Validator$1.prototype.superResolve = function superResolve (schema, ctx) {
      var ref = shouldResolve(schema);
      if(ref) {
        return this.resolve(schema, ref, ctx).subschema;
      }
      return schema;
    };

    /**
    * @private
    * @param Object schema
    * @param Object switchSchema
    * @param SchemaContext ctx
    * @return Object resolved schemas {subschema:String, switchSchema: String}
    * @throws SchemaError
    */
    Validator$1.prototype.resolve = function resolve (schema, switchSchema, ctx) {
      switchSchema = ctx.resolve(switchSchema);
      // First see if the schema exists under the provided URI
      if (ctx.schemas[switchSchema]) {
        return {subschema: ctx.schemas[switchSchema], switchSchema: switchSchema};
      }
      // Else try walking the property pointer
      var parsed = urilib.parse(switchSchema);
      var fragment = parsed && parsed.hash;
      var document = fragment && fragment.length && switchSchema.substr(0, switchSchema.length - fragment.length);
      if (!document || !ctx.schemas[document]) {
        throw new SchemaError("no such schema <" + switchSchema + ">", schema);
      }
      var subschema = helpers.objectGetPath(ctx.schemas[document], fragment.substr(1));
      if(subschema===undefined){
        throw new SchemaError("no such schema " + fragment + " located in <" + document + ">", schema);
      }
      return {subschema: subschema, switchSchema: switchSchema};
    };

    /**
     * Tests whether the instance if of a certain type.
     * @private
     * @param instance
     * @param schema
     * @param options
     * @param ctx
     * @param type
     * @return {boolean}
     */
    Validator$1.prototype.testType = function validateType (instance, schema, options, ctx, type) {
      if(type===undefined){
        return;
      }else if(type===null){
        throw new SchemaError('Unexpected null in "type" keyword');
      }
      if (typeof this.types[type] == 'function') {
        return this.types[type].call(this, instance);
      }
      if (type && typeof type == 'object') {
        var res = this.validateSchema(instance, type, options, ctx);
        return res === undefined || !(res && res.errors.length);
      }
      // Undefined or properties not on the list are acceptable, same as not being defined
      return true;
    };

    var types = Validator$1.prototype.types = {};
    types.string = function testString (instance) {
      return typeof instance == 'string';
    };
    types.number = function testNumber (instance) {
      // isFinite returns false for NaN, Infinity, and -Infinity
      return typeof instance == 'number' && isFinite(instance);
    };
    types.integer = function testInteger (instance) {
      return (typeof instance == 'number') && instance % 1 === 0;
    };
    types.boolean = function testBoolean (instance) {
      return typeof instance == 'boolean';
    };
    types.array = function testArray (instance) {
      return Array.isArray(instance);
    };
    types['null'] = function testNull (instance) {
      return instance === null;
    };
    types.date = function testDate (instance) {
      return instance instanceof Date;
    };
    types.any = function testAny (instance) {
      return true;
    };
    types.object = function testObject (instance) {
      // TODO: fix this - see #15
      return instance && (typeof instance === 'object') && !(Array.isArray(instance)) && !(instance instanceof Date);
    };

    var validator = Validator$1;

    var Validator = validator;

    helpers$3.ValidatorResult;
    helpers$3.ValidatorResultError;
    helpers$3.ValidationError;
    helpers$3.SchemaError;

    var validate = function (instance, schema, options) {
      var v = new Validator();
      return v.validate(instance, schema, options);
    };

    var PayloadMismatchError = /** @class */ (function (_super) {
        __extends(PayloadMismatchError, _super);
        /**
         * Creates a new PayloadMismatchError error
         * @param channel - name of event channel
         * @param schema - registered schema on event channel
         * @param payload - payload detail sent
         */
        function PayloadMismatchError(channel, schema, payload) {
            var _this = _super.call(this, "payload does not match the specified schema for channel [".concat(channel, "].")) || this;
            _this.channel = channel;
            _this.schema = schema;
            _this.payload = payload;
            if (Error.captureStackTrace) {
                Error.captureStackTrace(_this, PayloadMismatchError);
            }
            _this.name = 'PayloadMismatchError';
            return _this;
        }
        return PayloadMismatchError;
    }(Error));
    var SchemaMismatchError = /** @class */ (function (_super) {
        __extends(SchemaMismatchError, _super);
        /**
         * Creates a new SchemaMismatchError error
         * @param channel - name of event channel
         * @param schema - registered schema on event channel
         * @param newSchema - new schema attempting to be registered on event channel
         */
        function SchemaMismatchError(channel, schema, newSchema) {
            var _this = _super.call(this, "schema registration for [".concat(channel, "] must match already registered schema.")) || this;
            _this.channel = channel;
            _this.schema = schema;
            _this.newSchema = newSchema;
            if (Error.captureStackTrace) {
                Error.captureStackTrace(_this, SchemaMismatchError);
            }
            _this.name = 'SchemaMismatchError';
            return _this;
        }
        return SchemaMismatchError;
    }(Error));
    var EventBus = /** @class */ (function () {
        function EventBus() {
            this._lastId = 0;
            this._subscriptions = {};
        }
        EventBus.prototype._getNextId = function () {
            return this._lastId++;
        };
        /**
         * Register a schema for the specified channel and equality checking on subsequent registers.
         * Subsequent registers must use an equal schema or an error will be thrown.
         * @param channel - name of event channel to register schema to
         * @param schema - all communication on channel must follow this schema
         * @returns returns true if event channel already existed of false if a new one was created
         *
         * @throws {@link SchemaMismatchError}
         * This exception is thrown if new schema does not match already registered schema.
         */
        EventBus.prototype.register = function (channel, schema) {
            var exists = true;
            if (!this._subscriptions[channel]) {
                exists = false;
                this._subscriptions[channel] = {};
            }
            var registered = this._subscriptions[channel].__schema;
            if (registered && !deepCompareStrict(registered, schema)) {
                throw new SchemaMismatchError(channel, registered, schema);
            }
            this._subscriptions[channel].__schema = schema;
            return exists;
        };
        /**
         * Unregister the schema for the specified channel if channel exists.
         * @param channel - name of event channel to unregister schema from
         * @returns returns true if event channel existed and an existing schema was removed
         */
        EventBus.prototype.unregister = function (channel) {
            var subscriptions = this._subscriptions[channel];
            var exists = false;
            if (subscriptions && subscriptions.__schema) {
                exists = true;
                delete subscriptions.__schema;
            }
            return exists;
        };
        EventBus.prototype.subscribe = function (channel, param2, param3) {
            var id = this._getNextId();
            var replay = typeof param2 === 'boolean' ? param2 : false;
            var callback = typeof param2 === 'function' ? param2 : param3;
            if (typeof callback !== 'function')
                throw new Error('Callback function must be supplied as either the second or third argument.');
            var channelObject = this._subscriptions[channel];
            if (!channelObject)
                channelObject = this._subscriptions[channel] = {};
            else if (replay)
                callback({ channel: channel, payload: channelObject.__replay });
            channelObject[id] = callback;
            return {
                unsubscribe: function () { return delete channelObject[id]; },
            };
        };
        /**
         * Publish to event channel with an optional payload triggering all subscription callbacks.
         * @param channel - name of event channel to send payload on
         * @param payload - payload to be sent
         *
         * @throws {@link PayloadMismatchError}
         * This exception is thrown if payload does is not valid against registered schema.
         */
        EventBus.prototype.publish = function (channel, payload) {
            var channelObject = this._subscriptions[channel];
            if (!channelObject)
                channelObject = this._subscriptions[channel] = {};
            var schema = channelObject.__schema;
            if (typeof payload !== 'undefined' && schema && !validate(payload, schema).valid) {
                throw new PayloadMismatchError(channel, schema, payload);
            }
            channelObject.__replay = payload;
            for (var id in channelObject) {
                // istanbul ignore if - ignore robustness check
                if (id === '__replay' || id === '__schema')
                    continue;
                if (typeof channelObject[id] !== 'function')
                    continue;
                channelObject[id]({ channel: channel, payload: payload });
            }
            // Publish all events on the wildcard channel
            channelObject = this._subscriptions['*'];
            if (channelObject) {
                for (var id in channelObject) {
                    // istanbul ignore if - ignore robustness check
                    if (id === '__replay' || id === '__schema')
                        continue;
                    if (typeof channelObject[id] !== 'function')
                        continue;
                    channelObject[id]({ channel: channel, payload: payload });
                }
            }
        };
        /**
         * Get the latest published payload on the specified event channel.
         * @param channel - name of the event channel to fetch the latest payload from
         * @returns the latest payload or `undefined`
         */
        EventBus.prototype.getLatest = function (channel) {
            if (this._subscriptions[channel])
                return this._subscriptions[channel].__replay;
        };
        /**
         * Get the schema registered on the specified event channel.
         * @param channel - name of the event channel to fetch the schema from
         * @returns the schema or `undefined`
         */
        EventBus.prototype.getSchema = function (channel) {
            if (this._subscriptions[channel])
                return this._subscriptions[channel].__schema;
        };
        return EventBus;
    }());

    var getGlobal = function () {
        /* istanbul ignore next */
        if (typeof self !== 'undefined') {
            return self;
        }
        /* istanbul ignore next */
        if (typeof window !== 'undefined') {
            return window;
        }
        /* istanbul ignore next */
        if (typeof global !== 'undefined') {
            return global;
        }
        /* istanbul ignore next */
        throw new Error('unable to locate global object');
    };
    getGlobal().eventBus = new EventBus();

    exports.EventBus = EventBus;
    exports.getGlobal = getGlobal;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
